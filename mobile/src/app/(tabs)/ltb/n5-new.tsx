import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Alert, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { N5Workflow, type N5WorkflowInput, type N5Incident } from '../../../lib/ltb/rules/n5Workflow';
import { hasBlockers } from '../../../lib/ltb/workflow';
import { isWithinN5Lookback } from '../../../lib/ltb/rules/n5';
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
  postal_code: string | null;
  address: string | null;
}

const REASONS: { key: N5WorkflowInput['reason']; label: string }[] = [
  { key: 'interference', label: 'Substantial interference' },
  { key: 'damage', label: 'Damage' },
  { key: 'overcrowding', label: 'Overcrowding' },
  { key: 'other', label: 'Another legally supported N5 ground' },
];

const SERVICE_METHODS: ServiceMethod[] = ['hand_to_tenant', 'adult_in_unit', 'mailbox_or_mail_slot', 'under_door', 'regular_mail', 'courier'];

export default function N5NewScreen() {
  const { profileId } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [leases, setLeases] = useState<LeaseOption[]>([]);
  const [selectedLeaseId, setSelectedLeaseId] = useState<string | null>(null);
  const [landlordName, setLandlordName] = useState('');
  const [reason, setReason] = useState<N5WorkflowInput['reason']>('interference');
  const [incidents, setIncidents] = useState<N5Incident[]>([]);
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [priorN5, setPriorN5] = useState<{ served_at: string; reason: string; status: string } | null>(null);
  const [checkingPrior, setCheckingPrior] = useState(false);
  const [serviceMethod, setServiceMethod] = useState<ServiceMethod>('hand_to_tenant');
  const [serviceDate, setServiceDate] = useState(todayCalendarDate());
  const [creating, setCreating] = useState(false);

  const [incDate, setIncDate] = useState(todayCalendarDate());
  const [incLocation, setIncLocation] = useState('');
  const [incPeople, setIncPeople] = useState('');
  const [incDescription, setIncDescription] = useState('');
  const [incWitnesses, setIncWitnesses] = useState('');
  const [incPolice, setIncPolice] = useState('');

  useEffect(() => {
    if (!profileId) return;
    (async () => {
      const [{ data: leaseData }, { data: landlordData }] = await Promise.all([
        supabase
          .from('leases')
          .select(`id, unit_id, tenants ( id, first_name, last_name ), units ( id, property_id, unit_number, properties ( id, name, address, postal_code ) )`)
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
        postal_code: l.units?.properties?.postal_code ?? null,
        address: l.units?.properties?.address ?? null,
      }));
      setLeases(mapped);
      setLoading(false);
    })();
  }, [profileId]);

  const selectedLease = leases.find((l) => l.lease_id === selectedLeaseId) ?? null;

  async function selectLease(leaseId: string) {
    setSelectedLeaseId(leaseId);
    setIncidents([]);
    setPriorN5(null);
    const lease = leases.find((l) => l.lease_id === leaseId);
    if (!lease) return;

    // First-vs-subsequent detection (spec section 20) — search the notice
    // database rather than relying on the landlord to remember.
    setCheckingPrior(true);
    const { data } = await supabase
      .from('ltb_notices')
      .select('reason, status, service_date_intended, ltb_notice_service(served_at)')
      .eq('form_code', 'N5')
      .eq('unit_id', lease.unit_id)
      .order('created_at', { ascending: false })
      .limit(5);

    const withServiceDate = (data || [])
      .map((n: any) => ({
        served_at: n.ltb_notice_service?.[0]?.served_at ?? n.service_date_intended,
        reason: n.reason,
        status: n.status,
      }))
      .filter((n: any) => n.served_at);

    const withinLookback = withServiceDate.find((n: any) => isWithinN5Lookback(n.served_at, todayCalendarDate()));
    setPriorN5(withinLookback ?? null);
    setCheckingPrior(false);
  }

  function addIncident() {
    if (!incDescription.trim()) {
      Alert.alert('Missing description', 'Describe what happened.');
      return;
    }
    setIncidents((prev) => [
      ...prev,
      {
        occurredAt: incDate,
        location: incLocation.trim() || null,
        peopleInvolved: incPeople.trim() || null,
        description: incDescription.trim(),
        witnesses: incWitnesses.trim() || null,
        policeReportNumber: incPolice.trim() || null,
      },
    ]);
    setIncDate(todayCalendarDate());
    setIncLocation('');
    setIncPeople('');
    setIncDescription('');
    setIncWitnesses('');
    setIncPolice('');
    setShowIncidentModal(false);
  }

  const workflowInput: N5WorkflowInput | null = selectedLease
    ? {
        tenantNames: [selectedLease.tenant_name],
        propertyAddress: selectedLease.address ?? selectedLease.property_label,
        unitNumber: selectedLease.unit_number,
        postalCode: selectedLease.postal_code,
        landlordName,
        reason,
        incidents,
        isSubsequentNotice: !!priorN5,
        priorN5ServedDate: priorN5?.served_at ?? null,
        intendedServiceDate: serviceDate,
        serviceMethod,
      }
    : null;

  const validation = workflowInput ? N5Workflow.validate(workflowInput) : [];
  const dates = workflowInput ? N5Workflow.calculateDates(workflowInput) : null;
  const canGenerate = workflowInput !== null && !hasBlockers(validation);

  async function handleGenerate() {
    if (!selectedLease || !profileId || !dates) return;
    setCreating(true);
    try {
      const { data: notice, error: insertError } = await supabase.from('ltb_notices').insert({
        landlord_id: profileId,
        property_id: selectedLease.property_id,
        unit_id: selectedLease.unit_id,
        lease_id: selectedLease.lease_id,
        tenant_ids: [selectedLease.tenant_id],
        form_code: 'N5',
        reason,
        status: 'DRAFT',
        rules_version_used: dates.ruleVersion,
        snapshot: {
          landlord_name: landlordName,
          property_address: selectedLease.address ?? selectedLease.property_label,
          unit: selectedLease.unit_number,
          tenant_names: [selectedLease.tenant_name],
          notice_created_at: new Date().toISOString(),
        },
        service_method_intended: serviceMethod,
        service_date_intended: serviceDate,
        deemed_service_date: dates.deemedServiceDate,
        termination_date: dates.earliestValidTerminationDate,
        is_subsequent_notice: !!priorN5,
        cure_deadline: dates.cureDeadline,
      }).select().single();

      if (insertError || !notice) {
        Alert.alert('Could not create notice', insertError?.message ?? 'Please try again.');
        setCreating(false);
        return;
      }

      const incidentRows = incidents.map((inc) => ({
        notice_id: notice.id,
        landlord_id: profileId,
        unit_id: selectedLease.unit_id,
        occurred_at: inc.occurredAt,
        location: inc.location,
        people_involved: inc.peopleInvolved,
        description: inc.description,
        witnesses: inc.witnesses,
        police_report_number: inc.policeReportNumber,
      }));
      if (incidentRows.length > 0) {
        await supabase.from('ltb_notice_incidents').insert(incidentRows);
      }

      await supabase.from('ltb_audit_events').insert({
        notice_id: notice.id,
        landlord_id: profileId,
        event_type: 'notice_created',
        new_value: { form_code: 'N5', status: 'DRAFT', is_subsequent: !!priorN5 },
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
        <Text className="text-xl font-sansBold text-navy">N5 — Interference, Damage or Overcrowding</Text>
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
          <>
            {checkingPrior ? (
              <ActivityIndicator color="#1F2F3A" style={{ marginBottom: 16 }} />
            ) : priorN5 ? (
              <View className="bg-amber-50 border border-amber-300 rounded-2xl p-4 mb-6">
                <Text className="text-navy font-sansBold text-[13px] mb-1">Previous N5 detected</Text>
                <Text className="text-navy-muted font-sans text-[12px]">Served: {priorN5.served_at} · Status: {priorN5.status}</Text>
                <Text className="text-navy-muted font-sans text-[12px] mt-1">This will be treated as a subsequent notice — cure/monitoring rights may not apply. Verify against current LTB instructions.</Text>
              </View>
            ) : (
              <View className="bg-navy/5 rounded-2xl p-4 mb-6">
                <Text className="text-navy-muted font-sans text-[12px]">No prior N5 found for this tenancy — treated as a first notice.</Text>
              </View>
            )}

            <Text className="text-navy font-sansBold text-[15px] mb-3">Reason</Text>
            <View className="flex-row flex-wrap gap-2 mb-6">
              {REASONS.map((r) => (
                <TouchableOpacity key={r.key} onPress={() => setReason(r.key)} className="px-3 py-2 rounded-full border" style={{ borderColor: reason === r.key ? '#1F2F3A' : '#D8D2C8', backgroundColor: reason === r.key ? '#1F2F3A' : 'transparent' }}>
                  <Text className="font-sansBold text-[12px]" style={{ color: reason === r.key ? '#FFFFFF' : '#333333' }}>{r.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-navy font-sansBold text-[15px]">Incident Chronology</Text>
              <TouchableOpacity onPress={() => setShowIncidentModal(true)} className="flex-row items-center">
                <Feather name="plus-circle" size={16} color="#8B2030" />
                <Text className="text-burgundy font-sansBold text-[13px] ml-1">Add Incident</Text>
              </TouchableOpacity>
            </View>
            {incidents.length === 0 ? (
              <View className="bg-card rounded-2xl p-6 items-center border border-navy-border mb-6">
                <Text className="text-navy-muted font-sans text-center">No incidents added yet.</Text>
              </View>
            ) : (
              <View className="mb-6 gap-2">
                {incidents.map((inc, i) => (
                  <View key={i} className="bg-card rounded-2xl p-4 border border-navy-border">
                    <Text className="text-navy font-sansBold text-[13px]">{formatCalendarDateHuman(inc.occurredAt)}{inc.location ? ` — ${inc.location}` : ''}</Text>
                    <Text className="text-navy-muted font-sans text-[13px] mt-1">{inc.description}</Text>
                  </View>
                ))}
              </View>
            )}

            <Text className="text-navy font-sansBold text-[15px] mb-3">How will you serve this notice?</Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
              {SERVICE_METHODS.map((m) => (
                <TouchableOpacity key={m} onPress={() => setServiceMethod(m)} className="px-3 py-2 rounded-full border" style={{ borderColor: serviceMethod === m ? '#1F2F3A' : '#D8D2C8', backgroundColor: serviceMethod === m ? '#1F2F3A' : 'transparent' }}>
                  <Text className="font-sansBold text-[12px]" style={{ color: serviceMethod === m ? '#FFFFFF' : '#333333' }}>{SERVICE_METHOD_LABELS[m]}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Intended service date</Text>
            <TextInput className="bg-card border border-navy-border rounded-xl p-4 font-sans text-navy mb-6" value={serviceDate} onChangeText={setServiceDate} placeholder="YYYY-MM-DD" placeholderTextColor="#94a3b8" />

            {dates && (
              <View className="bg-navy rounded-2xl p-5 mb-6">
                <Text className="text-white/60 font-sansBold text-[11px] uppercase tracking-wide mb-2">Earliest valid termination date</Text>
                <Text className="text-white font-sansBold text-[26px] mb-3">{formatCalendarDateHuman(dates.earliestValidTerminationDate)}</Text>
                {dates.cureDeadline && (
                  <Text className="text-white/80 font-sans text-[13px] mb-3">Cure/monitoring period ends: {formatCalendarDateHuman(dates.cureDeadline)}</Text>
                )}
                <View className="bg-amber-500/20 rounded-lg px-3 py-2">
                  <Text className="text-amber-200 font-sansBold text-[11px]">Notice periods verified against tribunalsontario.ca on 2026-08-31. Service-method extra-day rules still NEEDS_REVIEW.</Text>
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
              <Text className="text-white font-sansBold text-[16px]">{creating ? 'Creating...' : 'Review & Generate N5'}</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      <Modal visible={showIncidentModal} animationType="slide" transparent onRequestClose={() => setShowIncidentModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 justify-end">
          <View className="bg-card rounded-t-[28px] p-6" style={{ maxHeight: '85%' }}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text className="text-navy font-sansBold text-[19px] mb-5">Add Incident</Text>
              <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Date</Text>
              <TextInput className="bg-pageBg border border-navy-border rounded-xl p-4 font-sans text-navy mb-4" value={incDate} onChangeText={setIncDate} placeholder="YYYY-MM-DD" placeholderTextColor="#94a3b8" />
              <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Location</Text>
              <TextInput className="bg-pageBg border border-navy-border rounded-xl p-4 font-sans text-navy mb-4" value={incLocation} onChangeText={setIncLocation} placeholder="e.g. Unit 2 hallway" placeholderTextColor="#94a3b8" />
              <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">People involved</Text>
              <TextInput className="bg-pageBg border border-navy-border rounded-xl p-4 font-sans text-navy mb-4" value={incPeople} onChangeText={setIncPeople} placeholder="Names/roles" placeholderTextColor="#94a3b8" />
              <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Description</Text>
              <TextInput className="bg-pageBg border border-navy-border rounded-xl p-4 font-sans text-navy mb-4" value={incDescription} onChangeText={setIncDescription} placeholder="What happened" placeholderTextColor="#94a3b8" multiline style={{ minHeight: 80 }} />
              <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Witnesses</Text>
              <TextInput className="bg-pageBg border border-navy-border rounded-xl p-4 font-sans text-navy mb-4" value={incWitnesses} onChangeText={setIncWitnesses} placeholder="Optional" placeholderTextColor="#94a3b8" />
              <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Police occurrence number (if applicable)</Text>
              <TextInput className="bg-pageBg border border-navy-border rounded-xl p-4 font-sans text-navy mb-6" value={incPolice} onChangeText={setIncPolice} placeholder="Optional" placeholderTextColor="#94a3b8" />
              <View className="flex-row gap-3">
                <TouchableOpacity onPress={() => setShowIncidentModal(false)} className="flex-1 py-4 rounded-xl items-center border border-navy-border">
                  <Text className="text-navy-muted font-sansBold text-[15px]">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={addIncident} className="flex-1 bg-navy py-4 rounded-xl items-center">
                  <Text className="text-white font-sansBold text-[15px]">Add</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
