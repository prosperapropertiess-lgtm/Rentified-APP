import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Alert, Switch } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { N11Workflow, type N11WorkflowInput } from '../../../lib/ltb/rules/n11Workflow';
import { hasBlockers } from '../../../lib/ltb/workflow';
import { todayCalendarDate, formatCalendarDateHuman } from '../../../lib/ltb/dateEngine';

interface LeaseOption {
  lease_id: string; unit_id: string; property_id: string; property_label: string;
  unit_number: string | null; tenant_id: string; tenant_name: string; address: string | null;
}

export default function N11NewScreen() {
  const { profileId } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [leases, setLeases] = useState<LeaseOption[]>([]);
  const [selectedLeaseId, setSelectedLeaseId] = useState<string | null>(null);
  const [landlordName, setLandlordName] = useState('');
  const [agreementSignedDate, setAgreementSignedDate] = useState(todayCalendarDate());
  const [agreedTerminationDate, setAgreedTerminationDate] = useState('');
  const [tenantSignedVoluntarily, setTenantSignedVoluntarily] = useState(false);
  const [isTenancyStart, setIsTenancyStart] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!profileId) return;
    (async () => {
      const [{ data: leaseData }, { data: landlordData }] = await Promise.all([
        supabase.from('leases').select(`id, unit_id, tenants ( id, first_name, last_name ), units ( id, property_id, unit_number, properties ( id, name, address ) )`).eq('landlord_id', profileId),
        supabase.from('landlords').select('first_name, last_name').eq('id', profileId).single(),
      ]);
      if (landlordData) setLandlordName(`${landlordData.first_name ?? ''} ${landlordData.last_name ?? ''}`.trim());
      setLeases((leaseData || []).map((l: any) => ({
        lease_id: l.id, unit_id: l.unit_id, property_id: l.units?.property_id,
        property_label: l.units?.properties?.name ?? l.units?.properties?.address ?? 'Property',
        unit_number: l.units?.unit_number ?? null, tenant_id: l.tenants?.id,
        tenant_name: `${l.tenants?.first_name ?? ''} ${l.tenants?.last_name ?? ''}`.trim() || 'Tenant',
        address: l.units?.properties?.address ?? null,
      })));
      setLoading(false);
    })();
  }, [profileId]);

  const selectedLease = leases.find((l) => l.lease_id === selectedLeaseId) ?? null;

  const workflowInput: N11WorkflowInput | null = selectedLease ? {
    tenantNames: [selectedLease.tenant_name], propertyAddress: selectedLease.address ?? selectedLease.property_label,
    unitNumber: selectedLease.unit_number, landlordName, agreementSignedDate, agreedTerminationDate,
    tenantSignedVoluntarily, isTenancyStart,
  } : null;

  const validation = workflowInput ? N11Workflow.validate(workflowInput) : [];
  const dates = workflowInput && agreedTerminationDate ? N11Workflow.calculateDates(workflowInput) : null;
  const canGenerate = workflowInput !== null && !!agreedTerminationDate && !hasBlockers(validation);

  async function handleGenerate() {
    if (!selectedLease || !profileId || !dates || !workflowInput) return;
    setCreating(true);
    try {
      const { data: notice, error: insertError } = await supabase.from('ltb_notices').insert({
        landlord_id: profileId, property_id: selectedLease.property_id, unit_id: selectedLease.unit_id,
        lease_id: selectedLease.lease_id, tenant_ids: [selectedLease.tenant_id], form_code: 'N11',
        reason: 'mutual_agreement', status: 'DRAFT', rules_version_used: dates.ruleVersion,
        snapshot: {
          landlord_name: landlordName, property_address: selectedLease.address ?? selectedLease.property_label,
          unit: selectedLease.unit_number, tenant_names: [selectedLease.tenant_name],
          notice_created_at: new Date().toISOString(),
        },
        service_method_intended: 'hand_to_tenant', service_date_intended: agreementSignedDate,
        deemed_service_date: dates.deemedServiceDate, termination_date: dates.earliestValidTerminationDate,
      }).select().single();

      if (insertError || !notice) {
        Alert.alert('Could not create notice', insertError?.message ?? 'Please try again.');
        setCreating(false); return;
      }

      await supabase.from('ltb_audit_events').insert({ notice_id: notice.id, landlord_id: profileId, event_type: 'notice_created', new_value: { form_code: 'N11', status: 'DRAFT' } });
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
        <Text className="text-xl font-sansBold text-navy">N11 — Agreement to End the Tenancy</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
        <View className="bg-card rounded-2xl p-4 border border-navy-border mb-6">
          <Text className="text-navy-muted font-sans text-[12px]">This is a mutual agreement, not a landlord-issued notice — both the landlord and tenant agree to a termination date together. There is no minimum notice period.</Text>
        </View>

        <Text className="text-navy font-sansBold text-[15px] mb-3">Which tenancy?</Text>
        <View className="gap-3 mb-6">
          {leases.map((l) => (
            <TouchableOpacity key={l.lease_id} onPress={() => setSelectedLeaseId(l.lease_id)} className="bg-card rounded-2xl p-4 border flex-row items-center justify-between" style={{ borderColor: selectedLeaseId === l.lease_id ? '#1F2F3A' : '#D8D2C8' }}>
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
            <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Date the agreement was signed</Text>
            <TextInput className="bg-card border border-navy-border rounded-xl p-4 font-sans text-navy mb-4" value={agreementSignedDate} onChangeText={setAgreementSignedDate} placeholder="YYYY-MM-DD" placeholderTextColor="#94a3b8" />

            <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Agreed termination date</Text>
            <TextInput className="bg-card border border-navy-border rounded-xl p-4 font-sans text-navy mb-6" value={agreedTerminationDate} onChangeText={setAgreedTerminationDate} placeholder="YYYY-MM-DD" placeholderTextColor="#94a3b8" />

            <View className="flex-row items-center justify-between bg-card rounded-xl p-4 border border-navy-border mb-4">
              <Text className="text-navy font-sans text-[13px] flex-1 pr-3">The tenant signed this voluntarily — I did not require it</Text>
              <Switch value={tenantSignedVoluntarily} onValueChange={setTenantSignedVoluntarily} trackColor={{ true: '#1F2F3A' }} />
            </View>

            <View className="flex-row items-center justify-between bg-card rounded-xl p-4 border border-navy-border mb-6">
              <Text className="text-navy font-sans text-[13px] flex-1 pr-3">This is being signed at the start of the tenancy for a later date</Text>
              <Switch value={isTenancyStart} onValueChange={setIsTenancyStart} trackColor={{ true: '#8B2030' }} />
            </View>

            {dates && agreedTerminationDate && (
              <View className="bg-navy rounded-2xl p-5 mb-6">
                <Text className="text-white/60 font-sansBold text-[11px] uppercase tracking-wide mb-2">Agreed termination date</Text>
                <Text className="text-white font-sansBold text-[26px]">{formatCalendarDateHuman(dates.earliestValidTerminationDate)}</Text>
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
              <Text className="text-white font-sansBold text-[16px]">{creating ? 'Creating...' : 'Review & Generate N11'}</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}
