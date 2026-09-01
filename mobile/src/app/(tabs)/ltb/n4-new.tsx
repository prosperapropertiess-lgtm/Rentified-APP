import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { money } from '../../../lib/format';
import { calculateArrears, type PaymentLedgerRow } from '../../../lib/ltb/arrearsEngine';
import { N4Workflow, type N4WorkflowInput } from '../../../lib/ltb/rules/n4Workflow';
import { hasBlockers } from '../../../lib/ltb/workflow';
import { SERVICE_METHOD_LABELS } from '../../../lib/ltb/serviceMethodRules';
import { todayCalendarDate, formatCalendarDateHuman } from '../../../lib/ltb/dateEngine';
import type { ServiceMethod } from '../../../lib/ltb/types';

interface LeaseOption {
  lease_id: string;
  unit_id: string;
  property_id: string;
  property_label: string;
  unit_number: string | null;
  tenant_id: string;
  tenant_name: string;
  rent_amount: number;
  postal_code: string | null;
  address: string | null;
}

const SERVICE_METHODS: ServiceMethod[] = ['hand_to_tenant', 'adult_in_unit', 'mailbox_or_mail_slot', 'under_door', 'regular_mail', 'courier'];

export default function N4NewScreen() {
  const { profileId } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [leases, setLeases] = useState<LeaseOption[]>([]);
  const [selectedLeaseId, setSelectedLeaseId] = useState<string | null>(null);
  const [arrearsRows, setArrearsRows] = useState<PaymentLedgerRow[]>([]);
  const [arrearsLoading, setArrearsLoading] = useState(false);
  const [serviceMethod, setServiceMethod] = useState<ServiceMethod>('hand_to_tenant');
  const [serviceDate, setServiceDate] = useState(todayCalendarDate());
  const [creating, setCreating] = useState(false);
  const [landlordName, setLandlordName] = useState('');

  useEffect(() => {
    if (!profileId) return;
    (async () => {
      const [{ data: leaseData }, { data: landlordData }] = await Promise.all([
        supabase
          .from('leases')
          .select(`
            id, unit_id, rent_amount,
            tenants ( id, first_name, last_name ),
            units ( id, property_id, unit_number, properties ( id, name, address, postal_code ) )
          `)
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
        rent_amount: Number(l.rent_amount ?? 0),
        postal_code: l.units?.properties?.postal_code ?? null,
        address: l.units?.properties?.address ?? null,
      }));
      setLeases(mapped);
      setLoading(false);
    })();
  }, [profileId]);

  const selectedLease = leases.find((l) => l.lease_id === selectedLeaseId) ?? null;

  const fetchArrears = useCallback(async (leaseId: string) => {
    setArrearsLoading(true);
    const { data } = await supabase
      .from('payments')
      .select('id, amount, due_date, status, classification')
      .eq('lease_id', leaseId)
      .order('due_date', { ascending: true });
    setArrearsRows((data || []) as PaymentLedgerRow[]);
    setArrearsLoading(false);
  }, []);

  function selectLease(leaseId: string) {
    setSelectedLeaseId(leaseId);
    fetchArrears(leaseId);
  }

  const arrears = useMemo(() => calculateArrears(arrearsRows), [arrearsRows]);

  const workflowInput: N4WorkflowInput | null = selectedLease
    ? {
        tenantNames: [selectedLease.tenant_name],
        propertyAddress: selectedLease.address ?? selectedLease.property_label,
        unitNumber: selectedLease.unit_number,
        postalCode: selectedLease.postal_code,
        landlordName,
        arrears,
        intendedServiceDate: serviceDate,
        serviceMethod,
        rentFrequency: 'monthly',
      }
    : null;

  const validation = workflowInput ? N4Workflow.validate(workflowInput) : [];
  const dates = workflowInput ? N4Workflow.calculateDates(workflowInput) : null;
  const canGenerate = workflowInput !== null && !hasBlockers(validation);

  async function handleGenerate() {
    if (!selectedLease || !profileId || !dates) return;
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('ltb-notice-actions', {
        body: {
          action: 'create_n4_notice',
          landlordId: profileId,
          propertyId: selectedLease.property_id,
          unitId: selectedLease.unit_id,
          leaseId: selectedLease.lease_id,
          tenantIds: [selectedLease.tenant_id],
          snapshot: {
            landlord_name: landlordName,
            property_address: selectedLease.address ?? selectedLease.property_label,
            unit: selectedLease.unit_number,
            tenant_names: [selectedLease.tenant_name],
            monthly_rent: selectedLease.rent_amount,
            notice_created_at: new Date().toISOString(),
          },
          arrearsData: arrears,
          intendedServiceDate: serviceDate,
          serviceMethod,
          rentFrequency: 'monthly',
        },
      });

      if (error || (data as any)?.error) {
        Alert.alert('Could not create notice', (data as any)?.error ?? error?.message ?? 'Please try again.');
        setCreating(false);
        return;
      }

      router.replace(`/(tabs)/ltb/notice/${(data as any).notice.id}`);
    } catch (e: any) {
      Alert.alert('Something went wrong', e.message ?? 'No notice was created. Please try again.');
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
        <Text className="text-xl font-sansBold text-navy">N4 — Non-payment of Rent</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
        <Text className="text-navy font-sansBold text-[15px] mb-3">Which tenancy?</Text>
        <View className="gap-3 mb-6">
          {leases.length === 0 ? (
            <Text className="text-navy-muted font-sans">No tenancies found.</Text>
          ) : (
            leases.map((l) => (
              <TouchableOpacity
                key={l.lease_id}
                onPress={() => selectLease(l.lease_id)}
                className="bg-card rounded-2xl p-4 border flex-row items-center justify-between"
                style={{ borderColor: selectedLeaseId === l.lease_id ? '#1F2F3A' : '#D8D2C8' }}
              >
                <View className="flex-1 pr-3">
                  <Text className="text-navy font-sansBold text-[15px]">{l.tenant_name}</Text>
                  <Text className="text-navy-muted font-sans text-[13px] mt-0.5">
                    {l.property_label}{l.unit_number ? ` · Unit ${l.unit_number}` : ''} · ${money(l.rent_amount)}/mo
                  </Text>
                </View>
                {selectedLeaseId === l.lease_id && <Feather name="check-circle" size={18} color="#1F2F3A" />}
              </TouchableOpacity>
            ))
          )}
        </View>

        {selectedLease && (
          <>
            <Text className="text-navy font-sansBold text-[15px] mb-3">Rent Arrears</Text>
            {arrearsLoading ? (
              <ActivityIndicator color="#1F2F3A" style={{ marginBottom: 24 }} />
            ) : (
              <View className="bg-card rounded-2xl p-5 mb-6 border border-navy-border">
                {arrears.periods.length === 0 ? (
                  <Text className="text-navy-muted font-sans">No recorded rent periods for this tenancy yet.</Text>
                ) : (
                  arrears.periods.map((p, i) => (
                    <View key={i} className="flex-row items-center justify-between py-2 border-b border-navy-border/40 last:border-b-0">
                      <Text className="text-navy font-sans text-[14px]">{p.periodLabel}</Text>
                      <Text className="text-navy-muted font-sans text-[13px]">Charged ${money(p.rentCharged)} · Paid ${money(p.rentPaid)}</Text>
                      <Text className={`font-sansBold text-[14px] ${p.balance > 0 ? 'text-burgundy' : 'text-navy'}`}>${money(p.balance)}</Text>
                    </View>
                  ))
                )}
                <View className="flex-row items-center justify-between pt-4 mt-2 border-t border-navy-border">
                  <Text className="text-navy font-sansBold text-[16px]">TOTAL RENT OWING</Text>
                  <Text className="text-burgundy font-sansBold text-[22px]">${money(arrears.totalOwing)}</Text>
                </View>
              </View>
            )}

            <Text className="text-navy font-sansBold text-[15px] mb-3">How will you serve this notice?</Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
              {SERVICE_METHODS.map((m) => (
                <TouchableOpacity
                  key={m}
                  onPress={() => setServiceMethod(m)}
                  className="px-3 py-2 rounded-full border"
                  style={{ borderColor: serviceMethod === m ? '#1F2F3A' : '#D8D2C8', backgroundColor: serviceMethod === m ? '#1F2F3A' : 'transparent' }}
                >
                  <Text className="font-sansBold text-[12px]" style={{ color: serviceMethod === m ? '#FFFFFF' : '#333333' }}>{SERVICE_METHOD_LABELS[m]}</Text>
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
                <Text className="text-white/60 font-sansBold text-[11px] uppercase tracking-wide mb-2">Earliest valid termination date</Text>
                <Text className="text-white font-sansBold text-[26px] mb-3">{formatCalendarDateHuman(dates.earliestValidTerminationDate)}</Text>
                {dates.needsReview && (
                  <View className="bg-amber-500/20 rounded-lg px-3 py-2 mb-3">
                    <Text className="text-amber-200 font-sansBold text-[11px]">
                      Notice period (14/7 days) verified against tribunalsontario.ca on 2026-08-31. Service-method extra-day rules still NEEDS_REVIEW.
                    </Text>
                  </View>
                )}
                {dates.explanation.map((e, i) => (
                  <View key={i} className="flex-row justify-between py-1">
                    <Text className="text-white/60 font-sans text-[12px]">{e.label}</Text>
                    <Text className="text-white font-sans text-[12px] flex-1 text-right ml-3">{e.value}</Text>
                  </View>
                ))}
              </View>
            )}

            <Text className="text-navy font-sansBold text-[15px] mb-3">Validation</Text>
            <View className="bg-card rounded-2xl p-4 mb-6 border border-navy-border">
              {validation.map((v, i) => (
                <View key={i} className="flex-row items-start py-1.5">
                  <Feather
                    name={v.level === 'BLOCKER' ? 'x-circle' : v.level === 'WARNING' ? 'alert-triangle' : 'info'}
                    size={15}
                    color={v.level === 'BLOCKER' ? '#8B2030' : v.level === 'WARNING' ? '#D97706' : '#64748b'}
                    style={{ marginTop: 2, marginRight: 8 }}
                  />
                  <Text className="text-navy font-sans text-[13px] flex-1">{v.message}</Text>
                </View>
              ))}
            </View>

            <View className="bg-pageBg border border-navy-border rounded-2xl p-4 mb-6">
              <Text className="text-navy-muted font-sans text-[12px] leading-relaxed">
                This software assists with document preparation, calculations, recordkeeping and workflow management. It does not
                provide legal advice or guarantee that a notice will be accepted by the Landlord and Tenant Board.
              </Text>
            </View>

            <TouchableOpacity
              onPress={handleGenerate}
              disabled={!canGenerate || creating}
              className="bg-navy py-4 rounded-2xl items-center"
              style={{ opacity: canGenerate ? 1 : 0.4 }}
            >
              <Text className="text-white font-sansBold text-[16px]">{creating ? 'Creating...' : 'Review & Generate N4'}</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}
