import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Alert, Switch } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { N13Workflow, type N13WorkflowInput } from '../../../lib/ltb/rules/n13Workflow';
import { N13_REASON_LABELS, type N13Reason } from '../../../lib/ltb/rules/n13';
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
const REASONS: N13Reason[] = ['demolition', 'renovation_repair', 'conversion', 'other'];

export default function N13NewScreen() {
  const { profileId } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [leases, setLeases] = useState<LeaseOption[]>([]);
  const [selectedLeaseId, setSelectedLeaseId] = useState<string | null>(null);
  const [landlordName, setLandlordName] = useState('');
  const [reason, setReason] = useState<N13Reason>('renovation_repair');
  const [projectDescription, setProjectDescription] = useState('');
  const [permitRequired, setPermitRequired] = useState(false);
  const [permitNumber, setPermitNumber] = useState('');
  const [contractor, setContractor] = useState('');
  const [expectedStart, setExpectedStart] = useState('');
  const [expectedCompletion, setExpectedCompletion] = useState('');
  const [vacantPossessionRequired, setVacantPossessionRequired] = useState(true);
  const [unitsInComplex, setUnitsInComplex] = useState('');
  const [rightOfFirstRefusalOffered, setRightOfFirstRefusalOffered] = useState(false);
  const [orderedByLawToDemolishOrRepair, setOrderedByLawToDemolishOrRepair] = useState(false);
  const [isMobileHomeOrLandLeaseOwner, setIsMobileHomeOrLandLeaseOwner] = useState(false);
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

  const workflowInput: N13WorkflowInput | null = selectedLease
    ? {
        tenantNames: [selectedLease.tenant_name],
        propertyAddress: selectedLease.address ?? selectedLease.property_label,
        unitNumber: selectedLease.unit_number,
        landlordName,
        reason,
        projectDescription,
        permitRequired,
        permitNumber,
        contractor,
        expectedStart,
        expectedCompletion,
        vacantPossessionRequired,
        unitsInComplex: unitsInComplex ? Number(unitsInComplex) : null,
        rightOfFirstRefusalOffered,
        orderedByLawToDemolishOrRepair,
        isMobileHomeOrLandLeaseOwner,
        compensationDetails,
        serviceMethod,
        intendedServiceDate: serviceDate,
        rentFrequency: 'monthly',
      }
    : null;

  const validation = workflowInput ? N13Workflow.validate(workflowInput) : [];
  const dates = workflowInput ? N13Workflow.calculateDates(workflowInput) : null;
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
        form_code: 'N13',
        reason,
        status: 'DRAFT',
        rules_version_used: dates.ruleVersion,
        snapshot: {
          landlord_name: landlordName,
          property_address: selectedLease.address ?? selectedLease.property_label,
          unit: selectedLease.unit_number,
          tenant_names: [selectedLease.tenant_name],
          reason,
          project_description: projectDescription,
          permit_required: permitRequired,
          permit_number: permitNumber,
          contractor,
          expected_start: expectedStart || null,
          expected_completion: expectedCompletion || null,
          vacant_possession_required: vacantPossessionRequired,
          units_in_complex: unitsInComplex ? Number(unitsInComplex) : null,
          right_of_first_refusal_offered: rightOfFirstRefusalOffered,
          ordered_by_law_to_demolish_or_repair: orderedByLawToDemolishOrRepair,
          is_mobile_home_or_land_lease_owner: isMobileHomeOrLandLeaseOwner,
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
        new_value: { form_code: 'N13', status: 'DRAFT' },
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
        <Text className="text-xl font-sansBold text-navy">N13 — Demolition, Repairs or Conversion</Text>
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
                  <Text className="text-navy font-sans text-[13px]">{N13_REASON_LABELS[r]}</Text>
                  {reason === r && <Feather name="check" size={16} color="#1F2F3A" />}
                </TouchableOpacity>
              ))}
            </View>

            <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Project description</Text>
            <TextInput
              className="bg-card border border-navy-border rounded-xl p-4 font-sans text-navy mb-4"
              value={projectDescription}
              onChangeText={setProjectDescription}
              placeholder="What work, and why vacancy is required."
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={3}
              style={{ minHeight: 80, textAlignVertical: 'top' }}
            />

            <View className="flex-row items-center justify-between bg-card rounded-xl p-4 border border-navy-border mb-4">
              <Text className="text-navy font-sans text-[13px] flex-1 pr-3">A permit is required for this work</Text>
              <Switch value={permitRequired} onValueChange={setPermitRequired} trackColor={{ true: '#1F2F3A' }} />
            </View>
            {permitRequired && (
              <TextInput className="bg-card border border-navy-border rounded-xl p-4 font-sans text-navy mb-4" value={permitNumber} onChangeText={setPermitNumber} placeholder="Permit number" placeholderTextColor="#94a3b8" />
            )}

            <TextInput className="bg-card border border-navy-border rounded-xl p-4 font-sans text-navy mb-4" value={contractor} onChangeText={setContractor} placeholder="Contractor (optional)" placeholderTextColor="#94a3b8" />

            <View className="flex-row gap-3 mb-4">
              <View className="flex-1">
                <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Expected start</Text>
                <TextInput className="bg-card border border-navy-border rounded-xl p-4 font-sans text-navy" value={expectedStart} onChangeText={setExpectedStart} placeholder="YYYY-MM-DD" placeholderTextColor="#94a3b8" />
              </View>
              <View className="flex-1">
                <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Expected completion</Text>
                <TextInput className="bg-card border border-navy-border rounded-xl p-4 font-sans text-navy" value={expectedCompletion} onChangeText={setExpectedCompletion} placeholder="YYYY-MM-DD" placeholderTextColor="#94a3b8" />
              </View>
            </View>

            <View className="flex-row items-center justify-between bg-card rounded-xl p-4 border border-navy-border mb-4">
              <Text className="text-navy font-sans text-[13px] flex-1 pr-3">Vacant possession is required for this work</Text>
              <Switch value={vacantPossessionRequired} onValueChange={setVacantPossessionRequired} trackColor={{ true: '#1F2F3A' }} />
            </View>

            <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Number of units in the complex</Text>
            <TextInput className="bg-card border border-navy-border rounded-xl p-4 font-sans text-navy mb-4" value={unitsInComplex} onChangeText={setUnitsInComplex} placeholder="e.g. 12" placeholderTextColor="#94a3b8" keyboardType="number-pad" />

            {reason === 'renovation_repair' && (
              <View className="flex-row items-center justify-between bg-card rounded-xl p-4 border border-navy-border mb-4">
                <Text className="text-navy font-sans text-[13px] flex-1 pr-3">Right of first refusal to return has been offered</Text>
                <Switch value={rightOfFirstRefusalOffered} onValueChange={setRightOfFirstRefusalOffered} trackColor={{ true: '#1F2F3A' }} />
              </View>
            )}

            <View className="flex-row items-center justify-between bg-card rounded-xl p-4 border border-navy-border mb-4">
              <Text className="text-navy font-sans text-[13px] flex-1 pr-3">Landlord was ordered to demolish/repair under an Act or law</Text>
              <Switch value={orderedByLawToDemolishOrRepair} onValueChange={setOrderedByLawToDemolishOrRepair} trackColor={{ true: '#1F2F3A' }} />
            </View>

            <View className="flex-row items-center justify-between bg-card rounded-xl p-4 border border-navy-border mb-4">
              <Text className="text-navy font-sans text-[13px] flex-1 pr-3">Tenant owns a mobile home / land lease home on this site</Text>
              <Switch value={isMobileHomeOrLandLeaseOwner} onValueChange={setIsMobileHomeOrLandLeaseOwner} trackColor={{ true: '#1F2F3A' }} />
            </View>

            <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Compensation details (if any)</Text>
            <TextInput className="bg-card border border-navy-border rounded-xl p-4 font-sans text-navy mb-6" value={compensationDetails} onChangeText={setCompensationDetails} placeholder="Optional" placeholderTextColor="#94a3b8" />

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
                <View className="bg-emerald-500/20 rounded-lg px-3 py-2">
                  <Text className="text-emerald-200 font-sansBold text-[11px]">Notice period and compensation rules verified against tribunalsontario.ca on 2026-08-31. See the Validation section below for the exact compensation owed.</Text>
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
              <Text className="text-white font-sansBold text-[16px]">{creating ? 'Creating...' : 'Review & Generate N13'}</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}
