import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Alert, Switch } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { N8Workflow, type N8WorkflowInput } from '../../../lib/ltb/rules/n8Workflow';
import { N8_REASON_LABELS, type N8Reason } from '../../../lib/ltb/rules/n8';
import { hasBlockers } from '../../../lib/ltb/workflow';
import { todayCalendarDate, formatCalendarDateHuman } from '../../../lib/ltb/dateEngine';
import { SERVICE_METHOD_LABELS } from '../../../lib/ltb/serviceMethodRules';
import { buildPaymentChronology, type ChronologyEntry, type ChronologyStatus } from '../../../lib/ltb/paymentChronology';
import type { ServiceMethod } from '../../../lib/ltb/types';

interface LeaseOption {
  lease_id: string;
  unit_id: string;
  property_id: string;
  property_label: string;
  unit_number: string | null;
  tenant_id: string;
  tenant_name: string;
  address: string | null;
}

const SERVICE_METHODS: ServiceMethod[] = ['hand_to_tenant', 'adult_in_unit', 'mailbox_or_mail_slot', 'under_door', 'regular_mail', 'courier'];
const REASONS: N8Reason[] = ['persistent_late_payment', 'no_longer_qualifies_subsidized_housing', 'employment_conditioned_unit_ended', 'aps_terminated_condo', 'rehab_therapeutic_period_ended'];

const STATUS_STYLE: Record<ChronologyStatus, { label: string; color: string; bg: string }> = {
  on_time: { label: 'On Time', color: '#166534', bg: '#DCFCE7' },
  partially_late: { label: 'Partially Late', color: '#B45309', bg: '#FEF3C7' },
  late: { label: 'Late', color: '#B45309', bg: '#FEF3C7' },
  unpaid: { label: 'Unpaid', color: '#8B2030', bg: '#FCE7EA' },
};

export default function N8NewScreen() {
  const { profileId } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [leases, setLeases] = useState<LeaseOption[]>([]);
  const [selectedLeaseId, setSelectedLeaseId] = useState<string | null>(null);
  const [landlordName, setLandlordName] = useState('');
  const [chronology, setChronology] = useState<ChronologyEntry[]>([]);
  const [loadingChronology, setLoadingChronology] = useState(false);
  const [reason, setReason] = useState<N8Reason>('persistent_late_payment');
  const [noOtherRehabTenantOverFourYears, setNoOtherRehabTenantOverFourYears] = useState(false);
  const [groundsDescription, setGroundsDescription] = useState('');
  const [serviceMethod, setServiceMethod] = useState<ServiceMethod>('hand_to_tenant');
  const [serviceDate, setServiceDate] = useState(todayCalendarDate());
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!profileId) return;
    (async () => {
      const [{ data: leaseData }, { data: landlordData }] = await Promise.all([
        supabase
          .from('leases')
          .select(`id, unit_id, start_date, tenants ( id, first_name, last_name ), units ( id, property_id, unit_number, properties ( id, name, address ) )`)
          .eq('landlord_id', profileId),
        supabase.from('landlords').select('first_name, last_name').eq('id', profileId).single(),
      ]);
      if (landlordData) setLandlordName(`${landlordData.first_name ?? ''} ${landlordData.last_name ?? ''}`.trim());
      const mapped: LeaseOption[] = (leaseData || []).map((l: any) => ({
        lease_id: l.id,
        unit_id: l.unit_id,
        property_id: l.units?.property_id,
        property_label: l.units?.properties?.name ?? l.units?.properties?.address ?? 'Property',
        unit_number: l.units?.unit_number ?? null,
        tenant_id: l.tenants?.id,
        tenant_name: `${l.tenants?.first_name ?? ''} ${l.tenants?.last_name ?? ''}`.trim() || 'Tenant',
        address: l.units?.properties?.address ?? null,
      }));
      setLeases(mapped);
      setLoading(false);
    })();
  }, [profileId]);

  const selectedLease = leases.find((l) => l.lease_id === selectedLeaseId) ?? null;

  async function selectLease(leaseId: string) {
    setSelectedLeaseId(leaseId);
    setLoadingChronology(true);
    const { data } = await supabase
      .from('payments')
      .select('amount, due_date, status, paid_at, classification')
      .eq('lease_id', leaseId)
      .order('due_date', { ascending: true });
    setChronology(buildPaymentChronology(data || []));
    setGroundsDescription('');
    setLoadingChronology(false);
  }

  const workflowInput: N8WorkflowInput | null = selectedLease
    ? {
        tenantNames: [selectedLease.tenant_name],
        propertyAddress: selectedLease.address ?? selectedLease.property_label,
        unitNumber: selectedLease.unit_number,
        landlordName,
        reason,
        groundsDescription,
        chronology,
        noOtherRehabTenantOverFourYears,
        serviceMethod,
        intendedServiceDate: serviceDate,
        rentFrequency: 'monthly',
      }
    : null;

  const validation = workflowInput ? N8Workflow.validate(workflowInput) : [];
  const dates = workflowInput ? N8Workflow.calculateDates(workflowInput) : null;
  const canGenerate = workflowInput !== null && !hasBlockers(validation);

  async function handleGenerate() {
    if (!selectedLease || !profileId || !dates || !workflowInput) return;
    setCreating(true);
    try {
      const { data: notice, error: insertError } = await supabase.from('ltb_notices').insert({
        landlord_id: profileId,
        property_id: selectedLease.property_id,
        unit_id: selectedLease.unit_id,
        lease_id: selectedLease.lease_id,
        tenant_ids: [selectedLease.tenant_id],
        form_code: 'N8',
        reason,
        status: 'DRAFT',
        rules_version_used: dates.ruleVersion,
        snapshot: {
          landlord_name: landlordName,
          property_address: selectedLease.address ?? selectedLease.property_label,
          unit: selectedLease.unit_number,
          tenant_names: [selectedLease.tenant_name],
          reason,
          grounds_description: groundsDescription,
          no_other_rehab_tenant_over_four_years: noOtherRehabTenantOverFourYears,
          notice_created_at: new Date().toISOString(),
        },
        service_method_intended: serviceMethod,
        service_date_intended: serviceDate,
        deemed_service_date: dates.deemedServiceDate,
        termination_date: dates.earliestValidTerminationDate,
      }).select().single();

      if (insertError || !notice) {
        Alert.alert('Could not create notice', insertError?.message ?? 'Please try again.');
        setCreating(false);
        return;
      }

      await supabase.from('ltb_audit_events').insert({
        notice_id: notice.id,
        landlord_id: profileId,
        event_type: 'notice_created',
        new_value: { form_code: 'N8', status: 'DRAFT' },
      });

      router.replace(`/(tabs)/ltb/notice/${notice.id}`);
    } catch (e: any) {
      Alert.alert('Something went wrong', e.message ?? 'No notice was created.');
      setCreating(false);
    }
  }

  if (loading) return <View className="flex-1 bg-pageBg justify-center items-center"><ActivityIndicator color="#1F2F3A" /></View>;

  return (
    <View className="flex-1 bg-pageBg">
      <View className="pt-16 px-6 pb-6 bg-card border-b border-navy-border flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="mr-3 w-9 h-9 rounded-full bg-pageBg border border-navy-border items-center justify-center">
          <Feather name="chevron-left" size={20} color="#1F2F3A" />
        </TouchableOpacity>
        <Text className="text-xl font-sansBold text-navy">N8 — End of Term / Persistent Late Payment</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
        <Text className="text-navy font-sansBold text-[15px] mb-3">Which tenancy?</Text>
        <View className="gap-3 mb-6">
          {leases.map((l) => (
            <TouchableOpacity
              key={l.lease_id}
              onPress={() => selectLease(l.lease_id)}
              className="bg-card rounded-2xl p-4 border flex-row items-center justify-between"
              style={{ borderColor: selectedLeaseId === l.lease_id ? '#1F2F3A' : '#D8D2C8' }}
            >
              <View className="flex-1 pr-3">
                <Text className="text-navy font-sansBold text-[15px]">{l.tenant_name}</Text>
                <Text className="text-navy-muted font-sans text-[13px] mt-0.5">{l.property_label}{l.unit_number ? ` · Unit ${l.unit_number}` : ''}</Text>
              </View>
              {selectedLeaseId === l.lease_id && <Feather name="check-circle" size={18} color="#1F2F3A" />}
            </TouchableOpacity>
          ))}
        </View>

        {selectedLease && (
          loadingChronology ? (
            <ActivityIndicator color="#1F2F3A" style={{ marginBottom: 24 }} />
          ) : (
            <>
              <Text className="text-navy font-sansBold text-[15px] mb-3">Reason</Text>
              <View className="gap-2 mb-6">
                {REASONS.map((r) => (
                  <TouchableOpacity
                    key={r}
                    onPress={() => setReason(r)}
                    className="flex-row items-center justify-between bg-card rounded-xl p-3.5 border"
                    style={{ borderColor: reason === r ? '#1F2F3A' : '#D8D2C8' }}
                  >
                    <Text className="text-navy font-sans text-[13px] flex-1 pr-3">{N8_REASON_LABELS[r]}</Text>
                    {reason === r && <Feather name="check" size={16} color="#1F2F3A" />}
                  </TouchableOpacity>
                ))}
              </View>

              {reason === 'persistent_late_payment' && (
                <>
                  <Text className="text-navy font-sansBold text-[15px] mb-1">Payment chronology</Text>
                  <Text className="text-navy-muted font-sans text-[12px] mb-3">This is recorded history only — it does not conclude the legal threshold has been met.</Text>
                  <View className="bg-card rounded-2xl border border-navy-border mb-6">
                    {chronology.length === 0 && (
                      <Text className="text-navy-muted font-sans text-[13px] p-4">No recorded payment history for this tenancy yet.</Text>
                    )}
                    {chronology.map((c, i) => (
                      <View key={i} className={`flex-row items-center justify-between p-4 ${i !== chronology.length - 1 ? 'border-b border-navy-border/40' : ''}`}>
                        <Text className="text-navy font-sans text-[13px]">{c.periodLabel}</Text>
                        <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: STATUS_STYLE[c.status].bg }}>
                          <Text className="font-sansBold text-[11px]" style={{ color: STATUS_STYLE[c.status].color }}>{STATUS_STYLE[c.status].label}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </>
              )}

              {reason === 'rehab_therapeutic_period_ended' && (
                <View className="flex-row items-center justify-between bg-card rounded-xl p-4 border border-navy-border mb-6">
                  <Text className="text-navy font-sans text-[13px] flex-1 pr-3">No other tenant receiving rehab/therapeutic services has lived in the complex for more than 4 years</Text>
                  <Switch value={noOtherRehabTenantOverFourYears} onValueChange={setNoOtherRehabTenantOverFourYears} trackColor={{ true: '#1F2F3A' }} />
                </View>
              )}

              <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Grounds for this notice</Text>
              <TextInput
                className="bg-card border border-navy-border rounded-xl p-4 font-sans text-navy mb-6"
                value={groundsDescription}
                onChangeText={setGroundsDescription}
                placeholder="Describe the specific dates and details that establish this ground — required."
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={4}
                style={{ minHeight: 90, textAlignVertical: 'top' }}
              />

              <Text className="text-navy font-sansBold text-[15px] mb-3">Service method</Text>
              <View className="flex-row flex-wrap gap-2 mb-6">
                {SERVICE_METHODS.map((m) => (
                  <TouchableOpacity
                    key={m}
                    onPress={() => setServiceMethod(m)}
                    className="px-3.5 py-2.5 rounded-xl border"
                    style={{ borderColor: serviceMethod === m ? '#1F2F3A' : '#D8D2C8', backgroundColor: serviceMethod === m ? '#1F2F3A' : 'transparent' }}
                  >
                    <Text className="font-sans text-[13px]" style={{ color: serviceMethod === m ? '#fff' : '#1F2F3A' }}>{SERVICE_METHOD_LABELS[m]}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Intended service date</Text>
              <TextInput
                className="bg-card border border-navy-border rounded-xl p-4 font-sans text-navy mb-6"
                value={serviceDate}
                onChangeText={setServiceDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#94a3b8"
              />

              {dates && (
                <View className="bg-navy rounded-2xl p-5 mb-6">
                  <Text className="text-white/60 font-sansBold text-[11px] uppercase tracking-wide mb-2">Earliest termination date</Text>
                  <Text className="text-white font-sansBold text-[26px] mb-3">{formatCalendarDateHuman(dates.earliestValidTerminationDate)}</Text>
                  <View className="bg-amber-500/20 rounded-lg px-3 py-2">
                    <Text className="text-amber-200 font-sansBold text-[11px]">Must also align with the end of a rental period/term. Notice period verified against tribunalsontario.ca on 2026-08-31.</Text>
                  </View>
                </View>
              )}

              <Text className="text-navy font-sansBold text-[15px] mb-3">Validation</Text>
              <View className="bg-card rounded-2xl p-4 mb-6 border border-navy-border">
                {validation.map((v, i) => (
                  <View key={i} className="flex-row items-start py-1.5">
                    <Feather name={v.level === 'BLOCKER' ? 'x-circle' : v.level === 'WARNING' ? 'alert-triangle' : 'info'} size={15} color={v.level === 'BLOCKER' ? '#8B2030' : v.level === 'WARNING' ? '#D97706' : '#64748b'} style={{ marginTop: 2, marginRight: 8 }} />
                    <Text className="text-navy font-sans text-[13px] flex-1">{v.message}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity onPress={handleGenerate} disabled={!canGenerate || creating} className="bg-navy py-4 rounded-2xl items-center" style={{ opacity: canGenerate ? 1 : 0.4 }}>
                <Text className="text-white font-sansBold text-[16px]">{creating ? 'Creating...' : 'Review & Generate N8'}</Text>
              </TouchableOpacity>
            </>
          )
        )}
      </ScrollView>
    </View>
  );
}
