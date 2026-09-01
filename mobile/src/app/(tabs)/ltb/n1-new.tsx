import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { money } from '../../../lib/format';
import { N1Workflow, type N1WorkflowInput } from '../../../lib/ltb/rules/n1Workflow';
import { hasBlockers } from '../../../lib/ltb/workflow';
import { todayCalendarDate, formatCalendarDateHuman } from '../../../lib/ltb/dateEngine';

interface LeaseOption {
  lease_id: string;
  unit_id: string;
  property_id: string;
  property_label: string;
  unit_number: string | null;
  tenant_id: string;
  tenant_name: string;
  currentRent: number;
  startDate: string;
  address: string | null;
}

export default function N1NewScreen() {
  const { profileId } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [leases, setLeases] = useState<LeaseOption[]>([]);
  const [selectedLeaseId, setSelectedLeaseId] = useState<string | null>(null);
  const [landlordName, setLandlordName] = useState('');
  const [lastIncreaseDate, setLastIncreaseDate] = useState('');
  const [checkingHistory, setCheckingHistory] = useState(false);
  const [anotherScheduled, setAnotherScheduled] = useState(false);
  const [proposedRent, setProposedRent] = useState('');
  const [serviceDate, setServiceDate] = useState(todayCalendarDate());
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!profileId) return;
    (async () => {
      const [{ data: leaseData }, { data: landlordData }] = await Promise.all([
        supabase
          .from('leases')
          .select(`id, unit_id, rent_amount, start_date, tenants ( id, first_name, last_name ), units ( id, property_id, unit_number, properties ( id, name, address ) )`)
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
        currentRent: Number(l.rent_amount ?? 0),
        startDate: l.start_date,
        address: l.units?.properties?.address ?? null,
      }));
      setLeases(mapped);
      setLoading(false);
    })();
  }, [profileId]);

  const selectedLease = leases.find((l) => l.lease_id === selectedLeaseId) ?? null;

  async function selectLease(leaseId: string) {
    setSelectedLeaseId(leaseId);
    const lease = leases.find((l) => l.lease_id === leaseId);
    if (!lease) return;
    setCheckingHistory(true);

    // Real rent history if it exists, tenancy start as the fallback per
    // spec section 22 — never invent a "last increase" date.
    const { data: lastIncrease } = await supabase
      .from('ltb_rent_increases')
      .select('effective_date')
      .eq('lease_id', leaseId)
      .order('effective_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: scheduled } = await supabase
      .from('ltb_notices')
      .select('id')
      .eq('lease_id', leaseId)
      .eq('form_code', 'N1')
      .in('status', ['SERVED', 'WAITING_PERIOD'])
      .limit(1)
      .maybeSingle();

    setLastIncreaseDate(lastIncrease?.effective_date ?? lease.startDate);
    setAnotherScheduled(!!scheduled);
    setProposedRent('');
    setCheckingHistory(false);
  }

  const workflowInput: N1WorkflowInput | null = selectedLease && lastIncreaseDate
    ? {
        tenantNames: [selectedLease.tenant_name],
        propertyAddress: selectedLease.address ?? selectedLease.property_label,
        unitNumber: selectedLease.unit_number,
        landlordName,
        currentRent: selectedLease.currentRent,
        proposedRent: Number(proposedRent) || 0,
        lastIncreaseEffectiveDateOrTenancyStart: lastIncreaseDate,
        intendedServiceDate: serviceDate,
        anotherIncreaseAlreadyScheduled: anotherScheduled,
      }
    : null;

  const validation = workflowInput ? N1Workflow.validate(workflowInput) : [];
  const dates = workflowInput ? N1Workflow.calculateDates(workflowInput) : null;
  const canGenerate = workflowInput !== null && proposedRent !== '' && !hasBlockers(validation);

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
        form_code: 'N1',
        reason: 'rent_increase',
        status: 'DRAFT',
        rules_version_used: dates.ruleVersion,
        snapshot: {
          landlord_name: landlordName,
          property_address: selectedLease.address ?? selectedLease.property_label,
          unit: selectedLease.unit_number,
          tenant_names: [selectedLease.tenant_name],
          current_rent: selectedLease.currentRent,
          proposed_rent: workflowInput.proposedRent,
          last_increase_or_tenancy_start: lastIncreaseDate,
          notice_created_at: new Date().toISOString(),
        },
        service_method_intended: 'hand_to_tenant',
        service_date_intended: serviceDate,
        deemed_service_date: serviceDate,
        termination_date: dates.earliestEffectiveDate,
      }).select().single();

      if (insertError || !notice) {
        Alert.alert('Could not create notice', insertError?.message ?? 'Please try again.');
        setCreating(false);
        return;
      }

      await supabase.from('ltb_rent_increases').insert({
        notice_id: notice.id,
        lease_id: selectedLease.lease_id,
        landlord_id: profileId,
        previous_rent: selectedLease.currentRent,
        new_rent: workflowInput.proposedRent,
        increase_percent: dates.proposedIncreasePercent,
        effective_date: dates.earliestEffectiveDate,
        applied: false,
      });

      await supabase.from('ltb_audit_events').insert({
        notice_id: notice.id,
        landlord_id: profileId,
        event_type: 'notice_created',
        new_value: { form_code: 'N1', status: 'DRAFT' },
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
        <Text className="text-xl font-sansBold text-navy">N1 — Notice of Rent Increase</Text>
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
                <Text className="text-navy-muted font-sans text-[13px] mt-0.5">{l.property_label}{l.unit_number ? ` · Unit ${l.unit_number}` : ''} · ${money(l.currentRent)}/mo</Text>
              </View>
              {selectedLeaseId === l.lease_id && <Feather name="check-circle" size={18} color="#1F2F3A" />}
            </TouchableOpacity>
          ))}
        </View>

        {selectedLease && (
          checkingHistory ? (
            <ActivityIndicator color="#1F2F3A" style={{ marginBottom: 24 }} />
          ) : (
            <>
              <View className="bg-card rounded-2xl p-4 mb-6 border border-navy-border">
                <Text className="text-navy-muted font-sans text-[12px] mb-1">Current rent: ${money(selectedLease.currentRent)}/mo</Text>
                <Text className="text-navy-muted font-sans text-[12px]">
                  {lastIncreaseDate === selectedLease.startDate ? 'Tenancy start' : 'Last increase'}: {formatCalendarDateHuman(lastIncreaseDate)}
                </Text>
              </View>

              <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Proposed new rent</Text>
              <TextInput
                className="bg-card border border-navy-border rounded-xl p-4 font-sans text-navy mb-6"
                value={proposedRent}
                onChangeText={setProposedRent}
                placeholder={`e.g. ${(selectedLease.currentRent * 1.025).toFixed(0)}`}
                placeholderTextColor="#94a3b8"
                keyboardType="decimal-pad"
              />

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
                  <Text className="text-white/60 font-sansBold text-[11px] uppercase tracking-wide mb-2">Earliest effective date</Text>
                  <Text className="text-white font-sansBold text-[26px] mb-3">{formatCalendarDateHuman(dates.earliestEffectiveDate)}</Text>
                  <View className="flex-row justify-between py-1">
                    <Text className="text-white/60 font-sans text-[12px]">Proposed increase</Text>
                    <Text className="text-white font-sans text-[12px]">{dates.proposedIncreasePercent}%</Text>
                  </View>
                  <View className="flex-row justify-between py-1">
                    <Text className="text-white/60 font-sans text-[12px]">2026 Guideline</Text>
                    <Text className="text-white font-sans text-[12px]">{dates.guidelinePercent}%</Text>
                  </View>
                  <View className="bg-emerald-500/20 rounded-lg px-3 py-2 mt-3">
                    <Text className="text-emerald-200 font-sansBold text-[11px]">Verified against tribunalsontario.ca on 2026-08-31 — the guideline changes every year, so this must be re-checked each January.</Text>
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
                <Text className="text-white font-sansBold text-[16px]">{creating ? 'Creating...' : 'Review & Generate N1'}</Text>
              </TouchableOpacity>
            </>
          )
        )}
      </ScrollView>
    </View>
  );
}
