import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Modal, TextInput, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { money } from '../../../lib/format';
import { calculateArrears, type PaymentLedgerRow } from '../../../lib/ltb/arrearsEngine';
import { generateAndUploadPdf } from '../../../lib/ltb/pdf/generateNoticePdf';
import { formatCalendarDateHuman } from '../../../lib/ltb/dateEngine';
import { assertValidTransition, InvalidNoticeTransitionError } from '../../../lib/ltb/noticeStateMachine';
import type { NoticeStatus } from '../../../lib/ltb/types';

// L1/L2 application prep — spec section 18. Carries forward everything
// already known instead of asking the landlord to re-type it, and checks
// real prerequisites rather than just letting them click through.

interface NoticeForApp {
  id: string;
  landlord_id: string;
  form_code: string;
  status: string;
  lease_id: string | null;
  termination_date: string | null;
  snapshot: any;
}

interface PrereqCheck {
  label: string;
  passed: boolean;
}

export default function ApplicationNewScreen() {
  const { noticeId } = useLocalSearchParams<{ noticeId: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<NoticeForApp | null>(null);
  const [hasCertificate, setHasCertificate] = useState(false);
  const [currentBalance, setCurrentBalance] = useState<number | null>(null);
  const [existingCase, setExistingCase] = useState<{ id: string; status: string; ltb_file_number: string | null } | null>(null);
  const [busy, setBusy] = useState(false);

  const [showFiledModal, setShowFiledModal] = useState(false);
  const [filedDate, setFiledDate] = useState('');
  const [filedMethod, setFiledMethod] = useState('');
  const [fileNumber, setFileNumber] = useState('');
  const [fee, setFee] = useState('');

  const applicationType = notice?.form_code === 'N4' ? 'L1' : 'L2';

  // Real, validated transitions (spec section 8) — never a raw status
  // write. Throws (visibly, via Alert) rather than silently skipping a
  // state if something calls this out of order.
  async function advanceNoticeStatus(currentStatus: NoticeStatus, to: NoticeStatus) {
    try {
      assertValidTransition(currentStatus, to);
    } catch (e) {
      if (e instanceof InvalidNoticeTransitionError) {
        Alert.alert('Not allowed', e.message);
        throw e;
      }
      throw e;
    }
    const { error } = await supabase.from('ltb_notices').update({ status: to, updated_at: new Date().toISOString() }).eq('id', notice!.id);
    if (error) throw error;
  }

  const fetchAll = useCallback(async () => {
    if (!noticeId) return;
    const [{ data: n }, { data: docs }, { data: existingCaseData }] = await Promise.all([
      supabase.from('ltb_notices').select('id, landlord_id, form_code, status, lease_id, termination_date, snapshot').eq('id', noticeId).single(),
      supabase.from('ltb_notice_documents').select('doc_type').eq('notice_id', noticeId).eq('doc_type', 'certificate_of_service'),
      supabase.from('ltb_cases').select('id, status, ltb_file_number').eq('notice_id', noticeId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    setNotice(n as NoticeForApp);
    setHasCertificate((docs?.length ?? 0) > 0);
    setExistingCase(existingCaseData as any);

    if (n?.lease_id) {
      const { data: payments } = await supabase.from('payments').select('id, amount, due_date, status, classification').eq('lease_id', n.lease_id);
      setCurrentBalance(calculateArrears((payments || []) as PaymentLedgerRow[]).totalOwing);
    }
    setLoading(false);
  }, [noticeId]);

  useEffect(() => { setTimeout(() => fetchAll(), 0); }, [fetchAll]);

  if (loading || !notice) return <View className="flex-1 bg-pageBg justify-center items-center"><ActivityIndicator color="#1F2F3A" /></View>;

  // Real prerequisite checks (spec section 18's example checklist), not a
  // decorative list — each one reflects an actual query above.
  const prereqs: PrereqCheck[] = [
    { label: `${notice.form_code} exists`, passed: true },
    { label: `${notice.form_code} served`, passed: ['SERVED', 'WAITING_PERIOD', 'CURE_PERIOD', 'RESOLVED', 'VOID', 'ELIGIBLE_FOR_APPLICATION'].includes(notice.status) },
    { label: 'Certificate of Service completed', passed: hasCertificate },
    { label: 'Required waiting period passed', passed: notice.status === 'ELIGIBLE_FOR_APPLICATION' },
    { label: `${notice.form_code} not recorded as void`, passed: notice.status !== 'VOID' },
  ];
  if (applicationType === 'L1') {
    prereqs.push({ label: 'Rent still owing', passed: (currentBalance ?? 0) > 0 });
  }
  const allPassed = prereqs.every((p) => p.passed);

  async function generatePackage() {
    if (!notice) return;
    setBusy(true);
    try {
      const tenantNames: string[] = Array.isArray(notice.snapshot?.tenant_names) ? notice.snapshot.tenant_names : ['Tenant'];
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
        body{font-family:-apple-system,Helvetica,Arial,sans-serif;color:#1F2F3A;padding:32px;}
        .watermark{background:#FEF3C7;border:2px solid #D97706;border-radius:8px;padding:12px 16px;margin-bottom:24px;font-weight:bold;color:#92400E;font-size:13px;}
        h1{font-size:20px;} .field{margin-bottom:6px;font-size:13px;} .field strong{display:inline-block;min-width:160px;color:#64748b;font-weight:normal;}
      </style></head><body>
        <div class="watermark">DRAFT — NOT AN OFFICIAL LTB APPLICATION — DO NOT FILE THIS DOCUMENT AS-IS</div>
        <h1>${applicationType} Application Package — Preparation Summary</h1>
        <div class="field"><strong>Landlord</strong>${notice.snapshot?.landlord_name ?? ''}</div>
        <div class="field"><strong>Tenant(s)</strong>${tenantNames.join(', ')}</div>
        <div class="field"><strong>Property</strong>${notice.snapshot?.property_address ?? ''}${notice.snapshot?.unit ? ` · Unit ${notice.snapshot.unit}` : ''}</div>
        <div class="field"><strong>Underlying notice</strong>${notice.form_code}</div>
        <div class="field"><strong>Termination date</strong>${notice.termination_date ? formatCalendarDateHuman(notice.termination_date) : ''}</div>
        ${applicationType === 'L1' ? `<div class="field"><strong>Current balance owing</strong>$${money(currentBalance ?? 0)}</div>` : ''}
        <p style="margin-top:24px;font-size:12px;color:#94a3b8;">This assists with preparation and recordkeeping only. It is not legal advice and does not guarantee LTB acceptance. Review the current official ${applicationType} form and instructions before filing.</p>
      </body></html>`;

      const path = await generateAndUploadPdf(html, notice.landlord_id, `${applicationType}-Package_${notice.id.slice(0, 8)}.pdf`);

      let caseId = existingCase?.id;
      if (!caseId) {
        const { data: newCase, error } = await supabase.from('ltb_cases').insert({
          notice_id: notice.id,
          landlord_id: notice.landlord_id,
          application_type: applicationType,
          status: 'PREPARING',
          created_by: user?.id ?? null,
        }).select().single();
        if (error) throw error;
        caseId = newCase.id;
      }

      await supabase.from('ltb_notice_documents').insert({
        notice_id: notice.id,
        doc_type: 'application_package',
        file_name: `${applicationType}-Package_${notice.id.slice(0, 8)}.pdf`,
        file_url: path,
        is_official_pdf: false,
        generated_by: user?.id ?? null,
      });
      await supabase.from('ltb_audit_events').insert({
        notice_id: notice.id,
        case_id: caseId,
        landlord_id: notice.landlord_id,
        event_type: 'application_prepared',
        actor_user_id: user?.id ?? null,
        new_value: { application_type: applicationType },
      });

      // ELIGIBLE_FOR_APPLICATION -> APPLICATION_DRAFT -> APPLICATION_READY:
      // two real, validated steps (spec section 8), not a raw status write.
      // Only advance from ELIGIBLE_FOR_APPLICATION the first time; a
      // regenerated package while already APPLICATION_DRAFT just needs the
      // second step.
      if (notice.status === 'ELIGIBLE_FOR_APPLICATION') {
        await advanceNoticeStatus('ELIGIBLE_FOR_APPLICATION', 'APPLICATION_DRAFT');
        await advanceNoticeStatus('APPLICATION_DRAFT', 'APPLICATION_READY');
      } else if (notice.status === 'APPLICATION_DRAFT') {
        await advanceNoticeStatus('APPLICATION_DRAFT', 'APPLICATION_READY');
      }

      fetchAll();
      Alert.alert('Application package generated', 'Draft package created and saved. Review the current official form before filing.');
    } catch (e: any) {
      Alert.alert('Could not generate package', e.message ?? 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function markFiled() {
    if (!existingCase || !filedDate || !fileNumber.trim()) {
      Alert.alert('Missing information', 'Enter the filing date and LTB file number.');
      return;
    }
    setBusy(true);
    const { error } = await supabase.from('ltb_cases').update({
      status: 'FILED',
      filed_at: filedDate,
      filed_method: filedMethod || null,
      ltb_file_number: fileNumber.trim(),
      application_fee: fee ? Number(fee) : null,
      updated_at: new Date().toISOString(),
    }).eq('id', existingCase.id);
    setBusy(false);
    if (error) {
      Alert.alert('Could not update', error.message);
      return;
    }
    try {
      await advanceNoticeStatus('APPLICATION_READY', 'APPLICATION_FILED');
    } catch {
      // advanceNoticeStatus already alerted on an invalid transition —
      // the case record itself is still updated above, so nothing is lost.
      return;
    }
    await supabase.from('ltb_audit_events').insert({
      notice_id: notice!.id,
      case_id: existingCase.id,
      landlord_id: notice!.landlord_id,
      event_type: 'application_marked_filed',
      new_value: { ltb_file_number: fileNumber.trim(), filed_at: filedDate },
    });
    setShowFiledModal(false);
    fetchAll();
    Alert.alert('Marked as filed', 'This does not file anything with the LTB automatically — it just records that you did.');
  }

  return (
    <View className="flex-1 bg-pageBg">
      <View className="pt-16 px-6 pb-6 bg-card border-b border-navy-border flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="mr-3 w-9 h-9 rounded-full bg-pageBg border border-navy-border items-center justify-center">
          <Feather name="chevron-left" size={20} color="#1F2F3A" />
        </TouchableOpacity>
        <Text className="text-xl font-sansBold text-navy">{applicationType} Application</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 80 }}>
        <Text className="text-navy font-sansBold text-[15px] mb-3">Prerequisites</Text>
        <View className="bg-card rounded-2xl p-4 mb-6 border border-navy-border">
          {prereqs.map((p, i) => (
            <View key={i} className="flex-row items-center py-1.5">
              <Feather name={p.passed ? 'check-circle' : 'x-circle'} size={16} color={p.passed ? '#059669' : '#8B2030'} style={{ marginRight: 8 }} />
              <Text className="text-navy font-sans text-[13px]">{p.label}</Text>
            </View>
          ))}
        </View>

        <Text className="text-navy font-sansBold text-[15px] mb-3">Carried Forward</Text>
        <View className="bg-card rounded-2xl p-4 mb-6 border border-navy-border">
          <Text className="text-navy font-sans text-[13px] mb-1">Landlord: {notice.snapshot?.landlord_name}</Text>
          <Text className="text-navy font-sans text-[13px] mb-1">Tenant(s): {Array.isArray(notice.snapshot?.tenant_names) ? notice.snapshot.tenant_names.join(', ') : ''}</Text>
          <Text className="text-navy font-sans text-[13px] mb-1">Property: {notice.snapshot?.property_address}{notice.snapshot?.unit ? ` · Unit ${notice.snapshot.unit}` : ''}</Text>
          {applicationType === 'L1' && <Text className="text-navy font-sans text-[13px]">Current balance: ${money(currentBalance ?? 0)}</Text>}
        </View>

        {existingCase?.status === 'FILED' ? (
          <View className="bg-emerald-50 border border-emerald-300 rounded-2xl p-5 mb-4">
            <Text className="text-navy font-sansBold text-[15px] mb-1">Filed</Text>
            <Text className="text-navy-muted font-sans text-[13px]">LTB File #: {existingCase.ltb_file_number}</Text>
          </View>
        ) : (
          <View className="gap-3">
            <TouchableOpacity
              onPress={generatePackage}
              disabled={!allPassed || busy}
              className="bg-navy py-4 rounded-2xl items-center"
              style={{ opacity: allPassed ? 1 : 0.4 }}
            >
              <Text className="text-white font-sansBold">{busy ? 'Working...' : 'Generate Application Package'}</Text>
            </TouchableOpacity>
            {existingCase && (
              <TouchableOpacity onPress={() => setShowFiledModal(true)} disabled={busy} className="bg-card border border-navy-border py-4 rounded-2xl items-center">
                <Text className="text-navy font-sansBold">Mark as Filed</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {!allPassed && (
          <Text className="text-navy-muted font-sans text-[12px] mt-4 text-center">
            All prerequisites must pass before a package can be generated.
          </Text>
        )}
      </ScrollView>

      <Modal visible={showFiledModal} animationType="slide" transparent onRequestClose={() => setShowFiledModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 justify-end">
          <View className="bg-card rounded-t-[28px] p-6">
            <Text className="text-navy font-sansBold text-[19px] mb-5">Mark as Filed</Text>
            <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Date filed</Text>
            <TextInput className="bg-pageBg border border-navy-border rounded-xl p-4 font-sans text-navy mb-4" value={filedDate} onChangeText={setFiledDate} placeholder="YYYY-MM-DD" placeholderTextColor="#94a3b8" />
            <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Method</Text>
            <TextInput className="bg-pageBg border border-navy-border rounded-xl p-4 font-sans text-navy mb-4" value={filedMethod} onChangeText={setFiledMethod} placeholder="e.g. LTB Portal, mail" placeholderTextColor="#94a3b8" />
            <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">LTB file number</Text>
            <TextInput className="bg-pageBg border border-navy-border rounded-xl p-4 font-sans text-navy mb-4" value={fileNumber} onChangeText={setFileNumber} placeholder="e.g. LTB-L-000000-26" placeholderTextColor="#94a3b8" />
            <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Application fee (optional)</Text>
            <TextInput className="bg-pageBg border border-navy-border rounded-xl p-4 font-sans text-navy mb-6" value={fee} onChangeText={setFee} placeholder="0.00" keyboardType="decimal-pad" placeholderTextColor="#94a3b8" />
            <View className="flex-row gap-3">
              <TouchableOpacity onPress={() => setShowFiledModal(false)} className="flex-1 py-4 rounded-xl items-center border border-navy-border">
                <Text className="text-navy-muted font-sansBold text-[15px]">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={markFiled} disabled={busy} className="flex-1 bg-navy py-4 rounded-xl items-center">
                <Text className="text-white font-sansBold text-[15px]">{busy ? 'Saving...' : 'Confirm Filed'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
