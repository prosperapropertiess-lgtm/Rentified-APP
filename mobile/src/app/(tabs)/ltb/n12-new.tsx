import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Alert, Switch } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { N12Workflow, type N12WorkflowInput, type CompensationMethod, COMPENSATION_METHOD_LABELS } from '../../../lib/ltb/rules/n12Workflow';
import { N12_REASON_LABELS, type N12Reason } from '../../../lib/ltb/rules/n12';
import { hasBlockers } from '../../../lib/ltb/workflow';
import { todayCalendarDate, formatCalendarDateHuman } from '../../../lib/ltb/dateEngine';
import { SERVICE_METHOD_LABELS } from '../../../lib/ltb/serviceMethodRules';
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
const REASONS: N12Reason[] = ['landlord_use', 'purchaser_use', 'qualifying_family_member', 'other'];
const COMPENSATION_METHODS: { key: CompensationMethod; label: string }[] = (Object.keys(COMPENSATION_METHOD_LABELS) as CompensationMethod[]).map((key) => ({ key, label: COMPENSATION_METHOD_LABELS[key] }));

export default function N12NewScreen() {
  const { profileId } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [leases, setLeases] = useState<LeaseOption[]>([]);
  const [selectedLeaseId, setSelectedLeaseId] = useState<string | null>(null);
  const [landlordName, setLandlordName] = useState('');
  const [reason, setReason] = useState<N12Reason>('landlord_use');
  const [personMovingIn, setPersonMovingIn] = useState('');
  const [relationship, setRelationship] = useState('');
  const [occupancyDetails, setOccupancyDetails] = useState('');
  const [saleDetails, setSaleDetails] = useState('');
  const [apsReference, setApsReference] = useState('');
  const [declarationConfirmed, setDeclarationConfirmed] = useState(false);
  const [compensationMethod, setCompensationMethod] = useState<CompensationMethod | null>(null);
  const [compensationDetails, setCompensationDetails] = useState('');
  const [serviceMethod, setServiceMethod] = useState<ServiceMethod>('hand_to_tenant');
  const [serviceDate, setServiceDate] = useState(todayCalendarDate());
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!profileId) return;
    (async () => {
      const [{ data: leaseData }, { data: landlordData }] = await Promise.all([
        supabase
          .from('leases')
          .select(`id, unit_id, tenants ( id, first_name, last_name ), units ( id, property_id, unit_number, properties ( id, name, address ) )`)
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

  const workflowInput: N12WorkflowInput | null = selectedLease
    ? {
        tenantNames: [selectedLease.tenant_name],
        propertyAddress: selectedLease.address ?? selectedLease.property_label,
        unitNumber: selectedLease.unit_number,
        landlordName,
        reason,
        personMovingIn,
        relationship,
        intendedOccupancyDetails: occupancyDetails,
        propertySaleDetails: saleDetails,
        agreementOfPurchaseAndSaleReference: apsReference,
        declarationConfirmed,
        compensationMethod,
        compensationDetails,
        serviceMethod,
        intendedServiceDate: serviceDate,
        rentFrequency: 'monthly',
      }
    : null;

  const validation = workflowInput ? N12Workflow.validate(workflowInput) : [];
  const dates = workflowInput ? N12Workflow.calculateDates(workflowInput) : null;
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
        form_code: 'N12',
        reason,
        status: 'DRAFT',
        rules_version_used: dates.ruleVersion,
        snapshot: {
          landlord_name: landlordName,
          property_address: selectedLease.address ?? selectedLease.property_label,
          unit: selectedLease.unit_number,
          tenant_names: [selectedLease.tenant_name],
          reason,
          person_moving_in: personMovingIn,
          relationship,
          occupancy_details: occupancyDetails,
          sale_details: saleDetails,
          aps_reference: apsReference,
          compensation_method: compensationMethod,
          compensation_details: compensationDetails,
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
        new_value: { form_code: 'N12', status: 'DRAFT' },
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
        <Text className="text-xl font-sansBold text-navy">N12 — Landlord/Purchaser/Family Requires Unit</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
        <Text className="text-navy font-sansBold text-[15px] mb-3">Which tenancy?</Text>
        <View className="gap-3 mb-6">
          {leases.map((l) => (
            <TouchableOpacity
              key={l.lease_id}
              onPress={() => setSelectedLeaseId(l.lease_id)}
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
                  <Text className="text-navy font-sans text-[13px]">{N12_REASON_LABELS[r]}</Text>
                  {reason === r && <Feather name="check" size={16} color="#1F2F3A" />}
                </TouchableOpacity>
              ))}
            </View>

            <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Person moving in</Text>
            <TextInput className="bg-card border border-navy-border rounded-xl p-4 font-sans text-navy mb-4" value={personMovingIn} onChangeText={setPersonMovingIn} placeholder="Full name" placeholderTextColor="#94a3b8" />

            {reason === 'qualifying_family_member' && (
              <>
                <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Relationship to landlord</Text>
                <TextInput className="bg-card border border-navy-border rounded-xl p-4 font-sans text-navy mb-4" value={relationship} onChangeText={setRelationship} placeholder="e.g. spouse, parent, child" placeholderTextColor="#94a3b8" />
              </>
            )}

            <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Intended occupancy details</Text>
            <TextInput
              className="bg-card border border-navy-border rounded-xl p-4 font-sans text-navy mb-4"
              value={occupancyDetails}
              onChangeText={setOccupancyDetails}
              placeholder="How long, and why this unit specifically."
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={3}
              style={{ minHeight: 80, textAlignVertical: 'top' }}
            />

            {reason === 'purchaser_use' && (
              <>
                <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Property sale details</Text>
                <TextInput className="bg-card border border-navy-border rounded-xl p-4 font-sans text-navy mb-4" value={saleDetails} onChangeText={setSaleDetails} placeholder="Sale status, closing date" placeholderTextColor="#94a3b8" />
                <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Agreement of Purchase and Sale reference</Text>
                <TextInput className="bg-card border border-navy-border rounded-xl p-4 font-sans text-navy mb-4" value={apsReference} onChangeText={setApsReference} placeholder="Reference / file number" placeholderTextColor="#94a3b8" />
              </>
            )}

            <Text className="text-navy font-sansBold text-[15px] mb-3">Compensation (mandatory)</Text>
            <View className="gap-2 mb-4">
              {COMPENSATION_METHODS.map((c) => (
                <TouchableOpacity
                  key={c.key}
                  onPress={() => setCompensationMethod(c.key)}
                  className="flex-row items-center justify-between bg-card rounded-xl p-3.5 border"
                  style={{ borderColor: compensationMethod === c.key ? '#1F2F3A' : '#D8D2C8' }}
                >
                  <Text className="text-navy font-sans text-[13px]">{c.label}</Text>
                  {compensationMethod === c.key && <Feather name="check" size={16} color="#1F2F3A" />}
                </TouchableOpacity>
              ))}
            </View>
            {compensationMethod && compensationMethod !== 'one_months_rent' && (
              <TextInput className="bg-card border border-navy-border rounded-xl p-4 font-sans text-navy mb-6" value={compensationDetails} onChangeText={setCompensationDetails} placeholder="Describe the compensation" placeholderTextColor="#94a3b8" />
            )}

            <View className="flex-row items-center justify-between bg-card rounded-xl p-4 border border-navy-border mb-6">
              <Text className="text-navy font-sans text-[13px] flex-1 pr-3">I confirm in good faith the unit is genuinely required for the stated purpose.</Text>
              <Switch value={declarationConfirmed} onValueChange={setDeclarationConfirmed} trackColor={{ true: '#1F2F3A' }} />
            </View>

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
            <TextInput className="bg-card border border-navy-border rounded-xl p-4 font-sans text-navy mb-6" value={serviceDate} onChangeText={setServiceDate} placeholder="YYYY-MM-DD" placeholderTextColor="#94a3b8" />

            {dates && (
              <View className="bg-navy rounded-2xl p-5 mb-6">
                <Text className="text-white/60 font-sansBold text-[11px] uppercase tracking-wide mb-2">Earliest termination date</Text>
                <Text className="text-white font-sansBold text-[26px] mb-3">{formatCalendarDateHuman(dates.earliestValidTerminationDate)}</Text>
                <View className="bg-amber-500/20 rounded-lg px-3 py-2">
                  <Text className="text-amber-200 font-sansBold text-[11px]">Must also align with the end of a rental period/term. Notice period and compensation rules verified against tribunalsontario.ca on 2026-08-31.</Text>
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
              <Text className="text-white font-sansBold text-[16px]">{creating ? 'Creating...' : 'Review & Generate N12'}</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}
