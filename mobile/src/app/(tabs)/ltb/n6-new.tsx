import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Alert, Switch, Modal } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { N6Workflow, type N6WorkflowInput, type N6Incident } from '../../../lib/ltb/rules/n6Workflow';
import { N6_REASON_LABELS, type N6Reason } from '../../../lib/ltb/rules/n6';
import { hasBlockers } from '../../../lib/ltb/workflow';
import { todayCalendarDate, formatCalendarDateHuman } from '../../../lib/ltb/dateEngine';
import { SERVICE_METHOD_LABELS } from '../../../lib/ltb/serviceMethodRules';
import type { ServiceMethod } from '../../../lib/ltb/types';

interface LeaseOption {
  lease_id: string; unit_id: string; property_id: string; property_label: string;
  unit_number: string | null; tenant_id: string; tenant_name: string; address: string | null;
}

const SERVICE_METHODS: ServiceMethod[] = ['hand_to_tenant', 'adult_in_unit', 'mailbox_or_mail_slot', 'under_door', 'regular_mail', 'courier'];
const REASONS: N6Reason[] = ['drug_related_illegal_act', 'other_illegal_act', 'misrepresented_rgi_income'];

export default function N6NewScreen() {
  const { profileId } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [leases, setLeases] = useState<LeaseOption[]>([]);
  const [selectedLeaseId, setSelectedLeaseId] = useState<string | null>(null);
  const [landlordName, setLandlordName] = useState('');
  const [reason, setReason] = useState<N6Reason>('other_illegal_act');
  const [isSubsequentNotice, setIsSubsequentNotice] = useState(false);
  const [incidents, setIncidents] = useState<N6Incident[]>([]);
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [incidentDate, setIncidentDate] = useState(todayCalendarDate());
  const [incidentLocation, setIncidentLocation] = useState('');
  const [incidentDesc, setIncidentDesc] = useState('');
  const [serviceMethod, setServiceMethod] = useState<ServiceMethod>('hand_to_tenant');
  const [serviceDate, setServiceDate] = useState(todayCalendarDate());
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

  function addIncident() {
    if (!incidentDesc.trim()) return;
    setIncidents((prev) => [...prev, { occurredAt: incidentDate, location: incidentLocation.trim() || null, description: incidentDesc.trim() }]);
    setIncidentDate(todayCalendarDate()); setIncidentLocation(''); setIncidentDesc('');
    setShowIncidentModal(false);
  }

  const workflowInput: N6WorkflowInput | null = selectedLease ? {
    tenantNames: [selectedLease.tenant_name], propertyAddress: selectedLease.address ?? selectedLease.property_label,
    unitNumber: selectedLease.unit_number, landlordName, reason, incidents, isSubsequentNotice,
    serviceMethod, intendedServiceDate: serviceDate,
  } : null;

  const validation = workflowInput ? N6Workflow.validate(workflowInput) : [];
  const dates = workflowInput ? N6Workflow.calculateDates(workflowInput) : null;
  const canGenerate = workflowInput !== null && !hasBlockers(validation);

  async function handleGenerate() {
    if (!selectedLease || !profileId || !dates || !workflowInput) return;
    setCreating(true);
    try {
      const { data: notice, error: insertError } = await supabase.from('ltb_notices').insert({
        landlord_id: profileId, property_id: selectedLease.property_id, unit_id: selectedLease.unit_id,
        lease_id: selectedLease.lease_id, tenant_ids: [selectedLease.tenant_id], form_code: 'N6', reason,
        status: 'DRAFT', rules_version_used: dates.ruleVersion, is_subsequent_notice: isSubsequentNotice,
        snapshot: {
          landlord_name: landlordName, property_address: selectedLease.address ?? selectedLease.property_label,
          unit: selectedLease.unit_number, tenant_names: [selectedLease.tenant_name], reason,
          notice_created_at: new Date().toISOString(),
        },
        service_method_intended: serviceMethod, service_date_intended: serviceDate,
        deemed_service_date: dates.deemedServiceDate, termination_date: dates.earliestValidTerminationDate,
      }).select().single();

      if (insertError || !notice) {
        Alert.alert('Could not create notice', insertError?.message ?? 'Please try again.');
        setCreating(false); return;
      }

      for (const inc of incidents) {
        await supabase.from('ltb_notice_incidents').insert({
          notice_id: notice.id, occurred_at: inc.occurredAt, location: inc.location, description: inc.description,
        });
      }
      await supabase.from('ltb_audit_events').insert({ notice_id: notice.id, landlord_id: profileId, event_type: 'notice_created', new_value: { form_code: 'N6', status: 'DRAFT' } });
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
        <Text className="text-xl font-sansBold text-navy">N6 — Illegal Acts / Misrepresenting Income</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
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
            <Text className="text-navy font-sansBold text-[15px] mb-3">Reason</Text>
            <View className="gap-2 mb-6">
              {REASONS.map((r) => (
                <TouchableOpacity key={r} onPress={() => setReason(r)} className="flex-row items-center justify-between bg-card rounded-xl p-3.5 border" style={{ borderColor: reason === r ? '#1F2F3A' : '#D8D2C8' }}>
                  <Text className="text-navy font-sans text-[13px] flex-1 pr-3">{N6_REASON_LABELS[r]}</Text>
                  {reason === r && <Feather name="check" size={16} color="#1F2F3A" />}
                </TouchableOpacity>
              ))}
            </View>

            {reason !== 'drug_related_illegal_act' && (
              <View className="flex-row items-center justify-between bg-card rounded-xl p-4 border border-navy-border mb-6">
                <Text className="text-navy font-sans text-[13px] flex-1 pr-3">This is a second N6 (with a prior 7-day-correction notice) in the past 6 months</Text>
                <Switch value={isSubsequentNotice} onValueChange={setIsSubsequentNotice} trackColor={{ true: '#1F2F3A' }} />
              </View>
            )}

            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-navy font-sansBold text-[15px]">Details</Text>
              <TouchableOpacity onPress={() => setShowIncidentModal(true)} className="flex-row items-center">
                <Feather name="plus" size={16} color="#1F2F3A" />
                <Text className="text-navy font-sansBold text-[13px] ml-1">Add</Text>
              </TouchableOpacity>
            </View>
            <View className="bg-card rounded-2xl border border-navy-border mb-6">
              {incidents.length === 0 && <Text className="text-navy-muted font-sans text-[13px] p-4">No details added yet.</Text>}
              {incidents.map((inc, i) => (
                <View key={i} className={`p-4 ${i !== incidents.length - 1 ? 'border-b border-navy-border/40' : ''}`}>
                  <Text className="text-navy font-sansBold text-[13px]">{formatCalendarDateHuman(inc.occurredAt)}{inc.location ? ` — ${inc.location}` : ''}</Text>
                  <Text className="text-navy-muted font-sans text-[12px] mt-1">{inc.description}</Text>
                </View>
              ))}
            </View>

            <Text className="text-navy font-sansBold text-[15px] mb-3">Service method</Text>
            <View className="flex-row flex-wrap gap-2 mb-6">
              {SERVICE_METHODS.map((m) => (
                <TouchableOpacity key={m} onPress={() => setServiceMethod(m)} className="px-3.5 py-2.5 rounded-xl border" style={{ borderColor: serviceMethod === m ? '#1F2F3A' : '#D8D2C8', backgroundColor: serviceMethod === m ? '#1F2F3A' : 'transparent' }}>
                  <Text className="font-sans text-[13px]" style={{ color: serviceMethod === m ? '#fff' : '#1F2F3A' }}>{SERVICE_METHOD_LABELS[m]}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Intended service date</Text>
            <TextInput className="bg-card border border-navy-border rounded-xl p-4 font-sans text-navy mb-6" value={serviceDate} onChangeText={setServiceDate} placeholder="YYYY-MM-DD" placeholderTextColor="#94a3b8" />

            {dates && (
              <View className="bg-navy rounded-2xl p-5 mb-6">
                <Text className="text-white/60 font-sansBold text-[11px] uppercase tracking-wide mb-2">Earliest termination date</Text>
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
              <Text className="text-white font-sansBold text-[16px]">{creating ? 'Creating...' : 'Review & Generate N6'}</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      <Modal visible={showIncidentModal} transparent animationType="slide">
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-pageBg rounded-t-3xl p-6" style={{ maxHeight: '80%' }}>
            <Text className="text-navy font-sansBold text-lg mb-4">Add Details</Text>
            <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Date</Text>
            <TextInput className="bg-card border border-navy-border rounded-xl p-4 font-sans text-navy mb-4" value={incidentDate} onChangeText={setIncidentDate} placeholder="YYYY-MM-DD" placeholderTextColor="#94a3b8" />
            <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Location (optional)</Text>
            <TextInput className="bg-card border border-navy-border rounded-xl p-4 font-sans text-navy mb-4" value={incidentLocation} onChangeText={setIncidentLocation} placeholder="e.g. hallway, unit interior" placeholderTextColor="#94a3b8" />
            <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Details</Text>
            <TextInput className="bg-card border border-navy-border rounded-xl p-4 font-sans text-navy mb-6" value={incidentDesc} onChangeText={setIncidentDesc} placeholder="What happened" placeholderTextColor="#94a3b8" multiline numberOfLines={4} style={{ minHeight: 90, textAlignVertical: 'top' }} />
            <View className="flex-row gap-3">
              <TouchableOpacity onPress={() => setShowIncidentModal(false)} className="flex-1 border border-navy-border py-3.5 rounded-xl items-center">
                <Text className="text-navy font-sansBold text-[14px]">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={addIncident} disabled={!incidentDesc.trim()} className="flex-1 bg-navy py-3.5 rounded-xl items-center" style={{ opacity: incidentDesc.trim() ? 1 : 0.4 }}>
                <Text className="text-white font-sansBold text-[14px]">Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
