import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Modal, TextInput, KeyboardAvoidingView, Platform, Alert, Linking } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../context/AuthContext';
import { money } from '../../../../lib/format';
import { STATUS_LABELS, assertValidTransition, InvalidNoticeTransitionError } from '../../../../lib/ltb/noticeStateMachine';
import { calculateEarliestL1Date, daysUntil } from '../../../../lib/ltb/rules/n4';
import { calculateN1 } from '../../../../lib/ltb/rules/n1';
import { N8_REASON_LABELS } from '../../../../lib/ltb/rules/n8';
import { N6_REASON_LABELS } from '../../../../lib/ltb/rules/n6';
import { N7_REASON_LABELS } from '../../../../lib/ltb/rules/n7';
import { N12_REASON_LABELS } from '../../../../lib/ltb/rules/n12';
import { N13_REASON_LABELS, calculateN13Compensation } from '../../../../lib/ltb/rules/n13';
import { estimateRepairPeriodMonths } from '../../../../lib/ltb/rules/n13Workflow';
import { COMPENSATION_METHOD_LABELS } from '../../../../lib/ltb/rules/n12Workflow';
import { calculateArrears, type PaymentLedgerRow } from '../../../../lib/ltb/arrearsEngine';
import { SERVICE_METHOD_LABELS } from '../../../../lib/ltb/serviceMethodRules';
import { formatCalendarDateHuman } from '../../../../lib/ltb/dateEngine';
import { generateAndUploadPdf } from '../../../../lib/ltb/pdf/generateNoticePdf';
import { buildN4Html, buildN5Html, buildN1Html, buildN8Html, buildN12Html, buildN13Html, buildN6Html, buildN7Html, buildN11Html, buildCertificateOfServiceHtml } from '../../../../lib/ltb/pdf/htmlTemplates';
import { buildPaymentChronology } from '../../../../lib/ltb/paymentChronology';
import type { NoticeStatus, ServiceMethod } from '../../../../lib/ltb/types';

interface NoticeDetail {
  id: string;
  landlord_id: string;
  unit_id: string;
  lease_id: string | null;
  form_code: string;
  status: NoticeStatus;
  snapshot: any;
  arrears_data: any;
  service_method_intended: string | null;
  service_date_intended: string | null;
  deemed_service_date: string | null;
  termination_date: string | null;
  is_subsequent_notice: boolean;
  cure_deadline: string | null;
  created_at: string;
}

interface AuditEvent {
  id: string;
  event_type: string;
  new_value: any;
  created_at: string;
}

interface NoticeDocumentRow {
  id: string;
  doc_type: string;
  file_name: string | null;
  file_url: string | null;
  is_official_pdf: boolean;
}

const SERVICE_METHODS: ServiceMethod[] = ['hand_to_tenant', 'adult_in_unit', 'mailbox_or_mail_slot', 'under_door', 'regular_mail', 'courier'];

export default function NoticeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<NoticeDetail | null>(null);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [documents, setDocuments] = useState<NoticeDocumentRow[]>([]);
  const [currentBalance, setCurrentBalance] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const [showServiceModal, setShowServiceModal] = useState(false);
  const [actualDate, setActualDate] = useState('');
  const [actualMethod, setActualMethod] = useState<ServiceMethod>('hand_to_tenant');
  const [servedBy, setServedBy] = useState('');
  const [receivedBy, setReceivedBy] = useState('');
  const [serviceNotes, setServiceNotes] = useState('');

  const fetchAll = useCallback(async () => {
    if (!id) return;
    const [{ data: n }, { data: ev }, { data: docs }] = await Promise.all([
      supabase.from('ltb_notices').select('*').eq('id', id).single(),
      supabase.from('ltb_audit_events').select('id, event_type, new_value, created_at').eq('notice_id', id).order('created_at', { ascending: true }),
      supabase.from('ltb_notice_documents').select('id, doc_type, file_name, file_url, is_official_pdf').eq('notice_id', id).order('generated_at', { ascending: false }),
    ]);
    setNotice(n as NoticeDetail);
    setEvents((ev || []) as AuditEvent[]);
    setDocuments((docs || []) as NoticeDocumentRow[]);

    if (n?.lease_id) {
      const { data: payments } = await supabase.from('payments').select('id, amount, due_date, status, classification').eq('lease_id', n.lease_id).order('due_date', { ascending: true });
      const arrears = calculateArrears((payments || []) as PaymentLedgerRow[]);
      setCurrentBalance(arrears.totalOwing);
    }
    setLoading(false);
  }, [id]);

  useFocusEffect(useCallback(() => { fetchAll(); }, [fetchAll]));

  async function logEvent(eventType: string, newValue: Record<string, unknown>) {
    if (!notice) return;
    await supabase.from('ltb_audit_events').insert({
      notice_id: notice.id,
      landlord_id: notice.landlord_id,
      event_type: eventType,
      actor_user_id: user?.id ?? null,
      new_value: newValue,
    });
  }

  async function transitionTo(newStatus: NoticeStatus) {
    if (!notice) return;
    try {
      assertValidTransition(notice.status, newStatus);
    } catch (e) {
      if (e instanceof InvalidNoticeTransitionError) {
        Alert.alert('Not allowed', e.message);
        return;
      }
      throw e;
    }
    setBusy(true);
    const { error } = await supabase.from('ltb_notices').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', notice.id);
    if (error) {
      Alert.alert('Could not update', error.message);
      setBusy(false);
      return;
    }
    await logEvent('status_changed', { from: notice.status, to: newStatus });
    setBusy(false);
    fetchAll();
  }

  async function recordActualService() {
    if (!notice || !actualDate) {
      Alert.alert('Missing information', 'Enter the date it was actually served.');
      return;
    }
    setBusy(true);

    // Actual service overrides intended — recalculate everything from what
    // really happened, per spec section 14. This is now server-side
    // authority (spec sections 66/67): the edge function fetches the
    // notice itself and computes every date from data it trusts, not from
    // anything this client could have tampered with — the client only
    // sends what actually happened (date, method, who served/received it).
    const plannedDiffers = actualDate !== notice.service_date_intended || actualMethod !== notice.service_method_intended;

    const { data, error } = await supabase.functions.invoke('ltb-notice-actions', {
      body: {
        action: 'record_actual_service',
        noticeId: notice.id,
        actualServiceDate: actualDate,
        actualMethod,
        servedBy: servedBy || null,
        receivedBy: receivedBy || null,
        notes: serviceNotes || null,
      },
    });

    if (error || (data as any)?.error) {
      Alert.alert('Could not record service', (data as any)?.error ?? error?.message ?? 'Please try again.');
      setBusy(false);
      return;
    }

    setShowServiceModal(false);
    setBusy(false);
    fetchAll();

    if (plannedDiffers) {
      Alert.alert(
        'Dates recalculated',
        'Actual service differed from the plan — deadlines were recalculated from what really happened.'
      );
    }
  }

  async function generateNoticePdfAction() {
    if (!notice) return;
    setBusy(true);
    try {
      const tenantNames: string[] = Array.isArray(notice.snapshot?.tenant_names) ? notice.snapshot.tenant_names : ['Tenant'];
      const propertyAddress = notice.snapshot?.property_address ?? 'Unknown Address';
      const unitNumber = notice.snapshot?.unit ?? null;
      const landlordName = notice.snapshot?.landlord_name ?? 'Landlord';
      const fileNameBase = `${notice.form_code}_${propertyAddress.replace(/[^a-zA-Z0-9]/g, '-')}_${tenantNames[0]?.replace(/[^a-zA-Z0-9]/g, '-')}_${notice.termination_date ?? ''}.pdf`;

      let html: string;
      if (notice.form_code === 'N4') {
        html = buildN4Html({
          landlordName,
          tenantNames,
          propertyAddress,
          unitNumber,
          postalCode: notice.snapshot?.postal_code ?? null,
          arrears: notice.arrears_data,
          serviceMethod: SERVICE_METHOD_LABELS[(notice.service_method_intended as ServiceMethod) ?? 'hand_to_tenant'],
          intendedServiceDate: notice.service_date_intended ?? '',
          deemedServiceDate: notice.deemed_service_date ?? '',
          terminationDate: notice.termination_date ?? '',
          rulesVersion: 'DRAFT-NEEDS-REVIEW',
        });
      } else if (notice.form_code === 'N5') {
        const { data: incidents } = await supabase
          .from('ltb_notice_incidents')
          .select('occurred_at, location, description, witnesses, police_report_number')
          .eq('notice_id', notice.id)
          .order('occurred_at', { ascending: true });
        html = buildN5Html({
          landlordName,
          tenantNames,
          propertyAddress,
          unitNumber,
          reason: notice.snapshot?.reason ?? 'other',
          incidents: (incidents || []).map((i: any) => ({ occurredAt: i.occurred_at, location: i.location, description: i.description, witnesses: i.witnesses, policeReportNumber: i.police_report_number })),
          isSubsequentNotice: notice.is_subsequent_notice,
          serviceMethod: SERVICE_METHOD_LABELS[(notice.service_method_intended as ServiceMethod) ?? 'hand_to_tenant'],
          intendedServiceDate: notice.service_date_intended ?? '',
          deemedServiceDate: notice.deemed_service_date ?? '',
          terminationDate: notice.termination_date ?? '',
          cureDeadline: notice.cure_deadline,
          rulesVersion: 'DRAFT-NEEDS-REVIEW',
        });
      } else if (notice.form_code === 'N1') {
        const calc = calculateN1({
          intendedServiceDate: notice.service_date_intended ?? '',
          lastIncreaseEffectiveDateOrTenancyStart: notice.snapshot?.last_increase_or_tenancy_start ?? notice.service_date_intended ?? '',
          currentRent: Number(notice.snapshot?.current_rent ?? 0),
          proposedRent: Number(notice.snapshot?.proposed_rent ?? 0),
        });
        html = buildN1Html({
          landlordName,
          tenantNames,
          propertyAddress,
          unitNumber,
          currentRent: Number(notice.snapshot?.current_rent ?? 0),
          proposedRent: Number(notice.snapshot?.proposed_rent ?? 0),
          proposedIncreasePercent: calc.proposedIncreasePercent,
          guidelinePercent: calc.guidelinePercent,
          intendedServiceDate: notice.service_date_intended ?? '',
          earliestEffectiveDate: notice.termination_date ?? '',
          rulesVersion: calc.ruleVersion,
        });
      } else if (notice.form_code === 'N8') {
        const n8Reason = (notice.snapshot?.reason ?? 'persistent_late_payment') as string;
        let chronologySummary: string | null = null;
        if (n8Reason === 'persistent_late_payment') {
          const { data: paymentRows } = await supabase
            .from('payments')
            .select('amount, due_date, status, paid_at, classification')
            .eq('lease_id', notice.lease_id ?? '')
            .order('due_date', { ascending: true });
          const chronology = buildPaymentChronology(paymentRows || []);
          const counts = { on_time: 0, partially_late: 0, late: 0, unpaid: 0 } as Record<string, number>;
          chronology.forEach((c) => { counts[c.status] += 1; });
          chronologySummary = `${counts.on_time} on time, ${counts.late} late, ${counts.partially_late} partially late, ${counts.unpaid} unpaid (of ${chronology.length} recorded periods).`;
        }
        html = buildN8Html({
          landlordName,
          tenantNames,
          propertyAddress,
          unitNumber,
          reasonLabel: N8_REASON_LABELS[n8Reason as keyof typeof N8_REASON_LABELS] ?? n8Reason,
          groundsDescription: notice.snapshot?.grounds_description ?? '',
          chronologySummary,
          serviceMethod: SERVICE_METHOD_LABELS[(notice.service_method_intended as ServiceMethod) ?? 'hand_to_tenant'],
          intendedServiceDate: notice.service_date_intended ?? '',
          deemedServiceDate: notice.deemed_service_date ?? '',
          terminationDate: notice.termination_date ?? '',
          rulesVersion: 'NOTICE-PERIOD-VERIFIED-2026-08-31',
        });
      } else if (notice.form_code === 'N12') {
        html = buildN12Html({
          landlordName,
          tenantNames,
          propertyAddress,
          unitNumber,
          reasonLabel: N12_REASON_LABELS[notice.snapshot?.reason as keyof typeof N12_REASON_LABELS] ?? notice.snapshot?.reason ?? '',
          personMovingIn: notice.snapshot?.person_moving_in ?? '',
          relationship: notice.snapshot?.relationship || null,
          occupancyDetails: notice.snapshot?.occupancy_details ?? '',
          saleDetails: notice.snapshot?.sale_details || null,
          apsReference: notice.snapshot?.aps_reference || null,
          compensationMethodLabel: COMPENSATION_METHOD_LABELS[notice.snapshot?.compensation_method as keyof typeof COMPENSATION_METHOD_LABELS] ?? 'Not specified',
          compensationDetails: notice.snapshot?.compensation_details || null,
          serviceMethod: SERVICE_METHOD_LABELS[(notice.service_method_intended as ServiceMethod) ?? 'hand_to_tenant'],
          intendedServiceDate: notice.service_date_intended ?? '',
          deemedServiceDate: notice.deemed_service_date ?? '',
          terminationDate: notice.termination_date ?? '',
          rulesVersion: 'VERIFIED-2026-08-31',
        });
      } else if (notice.form_code === 'N13') {
        const n13Compensation = calculateN13Compensation({
          reason: notice.snapshot?.reason ?? 'other',
          unitsInComplex: notice.snapshot?.units_in_complex ?? null,
          tenantPlansToMoveBackIn: notice.snapshot?.reason === 'renovation_repair' && !!notice.snapshot?.right_of_first_refusal_offered,
          orderedByLawToDemolishOrRepair: !!notice.snapshot?.ordered_by_law_to_demolish_or_repair,
          isMobileHomeOrLandLeaseOwner: !!notice.snapshot?.is_mobile_home_or_land_lease_owner,
          repairPeriodMonths: estimateRepairPeriodMonths(notice.snapshot?.expected_start ?? '', notice.snapshot?.expected_completion ?? ''),
        });
        html = buildN13Html({
          landlordName,
          tenantNames,
          propertyAddress,
          unitNumber,
          reasonLabel: N13_REASON_LABELS[notice.snapshot?.reason as keyof typeof N13_REASON_LABELS] ?? notice.snapshot?.reason ?? '',
          projectDescription: notice.snapshot?.project_description ?? '',
          permitNumber: notice.snapshot?.permit_number || null,
          expectedStart: notice.snapshot?.expected_start || null,
          expectedCompletion: notice.snapshot?.expected_completion || null,
          vacantPossessionRequired: !!notice.snapshot?.vacant_possession_required,
          rightOfFirstRefusalOffered: !!notice.snapshot?.right_of_first_refusal_offered,
          compensationDescription: n13Compensation.description,
          compensationDetails: notice.snapshot?.compensation_details || null,
          serviceMethod: SERVICE_METHOD_LABELS[(notice.service_method_intended as ServiceMethod) ?? 'hand_to_tenant'],
          intendedServiceDate: notice.service_date_intended ?? '',
          deemedServiceDate: notice.deemed_service_date ?? '',
          terminationDate: notice.termination_date ?? '',
          rulesVersion: 'VERIFIED-2026-08-31',
        });
      } else if (notice.form_code === 'N6') {
        const { data: incidents } = await supabase
          .from('ltb_notice_incidents')
          .select('occurred_at, location, description')
          .eq('notice_id', notice.id)
          .order('occurred_at', { ascending: true });
        html = buildN6Html({
          landlordName,
          tenantNames,
          propertyAddress,
          unitNumber,
          reasonLabel: N6_REASON_LABELS[notice.snapshot?.reason as keyof typeof N6_REASON_LABELS] ?? notice.snapshot?.reason ?? '',
          isSubsequentNotice: notice.is_subsequent_notice,
          incidents: (incidents || []).map((i: any) => ({ occurredAt: i.occurred_at, location: i.location, description: i.description })),
          serviceMethod: SERVICE_METHOD_LABELS[(notice.service_method_intended as ServiceMethod) ?? 'hand_to_tenant'],
          intendedServiceDate: notice.service_date_intended ?? '',
          deemedServiceDate: notice.deemed_service_date ?? '',
          terminationDate: notice.termination_date ?? '',
          rulesVersion: 'NOTICE-PERIOD-VERIFIED-2026-08-31',
        });
      } else if (notice.form_code === 'N7') {
        const { data: incidents } = await supabase
          .from('ltb_notice_incidents')
          .select('occurred_at, location, description')
          .eq('notice_id', notice.id)
          .order('occurred_at', { ascending: true });
        html = buildN7Html({
          landlordName,
          tenantNames,
          propertyAddress,
          unitNumber,
          reasonLabel: N7_REASON_LABELS[notice.snapshot?.reason as keyof typeof N7_REASON_LABELS] ?? notice.snapshot?.reason ?? '',
          incidents: (incidents || []).map((i: any) => ({ occurredAt: i.occurred_at, location: i.location, description: i.description })),
          serviceMethod: SERVICE_METHOD_LABELS[(notice.service_method_intended as ServiceMethod) ?? 'hand_to_tenant'],
          intendedServiceDate: notice.service_date_intended ?? '',
          deemedServiceDate: notice.deemed_service_date ?? '',
          terminationDate: notice.termination_date ?? '',
          rulesVersion: 'NOTICE-PERIOD-VERIFIED-2026-08-31',
        });
      } else if (notice.form_code === 'N11') {
        html = buildN11Html({
          landlordName,
          tenantNames,
          propertyAddress,
          unitNumber,
          agreementSignedDate: notice.service_date_intended ?? '',
          agreedTerminationDate: notice.termination_date ?? '',
          rulesVersion: 'DRAFT-NEEDS-REVIEW',
        });
      } else {
        Alert.alert('Not supported yet', `PDF generation for ${notice.form_code} isn't built yet.`);
        setBusy(false);
        return;
      }

      const path = await generateAndUploadPdf(html, notice.landlord_id, fileNameBase);
      const { error } = await supabase.from('ltb_notice_documents').insert({
        notice_id: notice.id,
        doc_type: 'notice_pdf',
        file_name: fileNameBase,
        file_url: path,
        is_official_pdf: false,
        generated_by: user?.id ?? null,
      });
      if (error) throw error;
      await logEvent('pdf_generated', { doc_type: 'notice_pdf' });
      fetchAll();
      Alert.alert('Draft PDF generated', 'This is a labeled DRAFT document, not an official LTB form — see the watermark. Review before relying on it.');
    } catch (e: any) {
      Alert.alert('Could not generate PDF', e.message ?? 'No document was created.');
    } finally {
      setBusy(false);
    }
  }

  async function generateCertificate() {
    if (!notice) return;
    setBusy(true);
    try {
      const { data: serviceRecord } = await supabase
        .from('ltb_notice_service')
        .select('served_at, method_used, served_by, received_by, notes')
        .eq('notice_id', notice.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!serviceRecord) {
        Alert.alert('No service recorded yet', 'Record actual service before generating a Certificate of Service.');
        setBusy(false);
        return;
      }

      const tenantNames: string[] = Array.isArray(notice.snapshot?.tenant_names) ? notice.snapshot.tenant_names : ['Tenant'];
      const html = buildCertificateOfServiceHtml({
        formCode: notice.form_code,
        propertyAddress: notice.snapshot?.property_address ?? 'Unknown Address',
        unitNumber: notice.snapshot?.unit ?? null,
        tenantNames,
        servedAt: serviceRecord.served_at,
        methodUsed: SERVICE_METHOD_LABELS[serviceRecord.method_used as ServiceMethod] ?? serviceRecord.method_used,
        servedBy: serviceRecord.served_by,
        receivedBy: serviceRecord.received_by,
        notes: serviceRecord.notes,
      });
      const fileName = `Certificate-of-Service_${notice.form_code}_${notice.id.slice(0, 8)}.pdf`;
      const path = await generateAndUploadPdf(html, notice.landlord_id, fileName);

      const { error } = await supabase.from('ltb_notice_documents').insert({
        notice_id: notice.id,
        doc_type: 'certificate_of_service',
        file_name: fileName,
        file_url: path,
        is_official_pdf: false,
        generated_by: user?.id ?? null,
      });
      if (error) throw error;
      await logEvent('certificate_generated', {});
      fetchAll();
      Alert.alert('Certificate of Service generated', 'This is a labeled DRAFT document, not an official LTB Certificate of Service — see the watermark.');
    } catch (e: any) {
      Alert.alert('Could not generate certificate', e.message ?? 'No document was created.');
    } finally {
      setBusy(false);
    }
  }

  async function openDocument(doc: NoticeDocumentRow) {
    if (!doc.file_url) return;
    try {
      const { data, error } = await supabase.storage.from('documents').createSignedUrl(doc.file_url, 3600);
      if (error || !data?.signedUrl) throw new Error(error?.message ?? 'Could not generate a link for this document.');
      await Linking.openURL(data.signedUrl);
    } catch (e: any) {
      Alert.alert('Unable to open document', e.message);
    }
  }

  async function applyRentIncrease() {
    if (!notice) return;
    Alert.alert(
      'Apply this rent increase?',
      'This marks the increase as applied and closes out the N1 notice. Update the lease/rent amount separately.',
      [
        { text: 'Not yet', style: 'cancel' },
        {
          text: 'Apply Increase',
          onPress: async () => {
            setBusy(true);
            const { error: rentIncreaseError } = await supabase
              .from('ltb_rent_increases')
              .update({ applied: true, applied_at: new Date().toISOString() })
              .eq('notice_id', notice.id);
            if (rentIncreaseError) {
              Alert.alert('Could not apply increase', rentIncreaseError.message);
              setBusy(false);
              return;
            }
            await logEvent('rent_increase_applied', {});
            setBusy(false);
            transitionTo('RESOLVED');
          },
        },
      ]
    );
  }

  async function checkVoidStatus() {
    if (currentBalance !== null && currentBalance <= 0 && notice) {
      Alert.alert(
        'N4 appears to be void based on recorded payments',
        'The rent ledger shows $0 currently owing. Mark this notice void/resolved?',
        [
          { text: 'Not yet', style: 'cancel' },
          { text: 'Mark Void', onPress: () => transitionTo('VOID') },
        ]
      );
    } else {
      Alert.alert('Still owing', `Current balance is $${money(currentBalance ?? 0)} — not eligible to be marked void yet.`);
    }
  }

  if (loading || !notice) return <View className="flex-1 bg-pageBg justify-center items-center"><ActivityIndicator color="#1F2F3A" /></View>;

  const tenantNames = Array.isArray(notice.snapshot?.tenant_names) ? notice.snapshot.tenant_names.join(', ') : 'Tenant';
  const daysToTermination = notice.termination_date ? daysUntil(notice.termination_date) : null;
  const earliestL1 = notice.termination_date ? calculateEarliestL1Date(notice.termination_date) : null;

  return (
    <View className="flex-1 bg-pageBg">
      <View className="pt-16 px-6 pb-6 bg-card border-b border-navy-border">
        <View className="flex-row items-center mb-3">
          <TouchableOpacity onPress={() => router.back()} className="mr-3 w-9 h-9 rounded-full bg-pageBg border border-navy-border items-center justify-center">
            <Feather name="chevron-left" size={20} color="#1F2F3A" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-xl font-sansBold text-navy">
              {notice.form_code} — {notice.form_code === 'N4' ? 'Non-payment of Rent' : notice.form_code === 'N5' ? 'Interference, Damage or Overcrowding' : notice.form_code === 'N1' ? 'Rent Increase' : notice.form_code === 'N8' ? 'End of Term / Persistent Late Payment' : notice.form_code === 'N12' ? 'Landlord/Purchaser/Family Requires Unit' : notice.form_code === 'N13' ? 'Demolition, Repairs or Conversion' : notice.form_code === 'N6' ? 'Illegal Acts or Misrepresenting Income' : notice.form_code === 'N7' ? 'Serious Problems' : notice.form_code === 'N11' ? 'Agreement to End the Tenancy' : notice.form_code}
            </Text>
            <Text className="text-navy-muted font-sans text-[13px] mt-0.5">
              {notice.snapshot?.property_address} {notice.snapshot?.unit ? `· Unit ${notice.snapshot.unit}` : ''} · {tenantNames}
            </Text>
          </View>
        </View>
        <View className="bg-navy/5 self-start px-3 py-1.5 rounded-full">
          <Text className="text-navy font-sansBold text-[12px]">{STATUS_LABELS[notice.status] ?? notice.status}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 100 }}>
        <View className="flex-row gap-3 mb-6">
          {notice.form_code === 'N4' && (
            <View className="flex-1 bg-card rounded-2xl p-4 border border-navy-border">
              <Text className="text-navy-muted font-sans text-[11px] uppercase tracking-wide">Current Balance</Text>
              <Text className="text-burgundy font-sansBold text-[22px] mt-1">${money(currentBalance ?? 0)}</Text>
            </View>
          )}
          {notice.termination_date && (
            <View className="flex-1 bg-card rounded-2xl p-4 border border-navy-border">
              <Text className="text-navy-muted font-sans text-[11px] uppercase tracking-wide">{notice.form_code === 'N1' ? 'Earliest Effective Date' : 'Termination Date'}</Text>
              <Text className="text-navy font-sansBold text-[16px] mt-1">{formatCalendarDateHuman(notice.termination_date)}</Text>
              {daysToTermination !== null && (
                <Text className="text-navy-muted font-sans text-[11px] mt-0.5">
                  {daysToTermination > 0 ? `${daysToTermination} days away` : daysToTermination === 0 ? 'Today' : `${-daysToTermination} days ago`}
                </Text>
              )}
            </View>
          )}
        </View>

        {notice.status === 'DRAFT' && (
          <View className="gap-3 mb-4">
            <TouchableOpacity onPress={generateNoticePdfAction} disabled={busy} className="bg-card border border-navy-border py-4 rounded-2xl items-center">
              <Text className="text-navy font-sansBold">{busy ? 'Generating...' : `Generate Draft ${notice.form_code} PDF`}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => transitionTo('READY_TO_SERVE')} disabled={busy} className="bg-navy py-4 rounded-2xl items-center">
              <Text className="text-white font-sansBold">Mark Ready to Serve</Text>
            </TouchableOpacity>
          </View>
        )}

        {notice.status === 'READY_TO_SERVE' && (
          <TouchableOpacity onPress={() => { setActualDate(notice.service_date_intended ?? ''); setActualMethod((notice.service_method_intended as ServiceMethod) ?? 'hand_to_tenant'); setShowServiceModal(true); }} className="bg-navy py-4 rounded-2xl items-center mb-4">
            <Text className="text-white font-sansBold">Record Actual Service</Text>
          </TouchableOpacity>
        )}

        {notice.status === 'WAITING_PERIOD' && (
          <View className="gap-3 mb-4">
            <TouchableOpacity onPress={generateCertificate} disabled={busy} className="bg-card border border-navy-border py-4 rounded-2xl items-center">
              <Text className="text-navy font-sansBold">Generate Certificate of Service</Text>
            </TouchableOpacity>
            {notice.form_code === 'N4' && (
              <TouchableOpacity onPress={checkVoidStatus} disabled={busy} className="bg-card border border-navy-border py-4 rounded-2xl items-center">
                <Text className="text-navy font-sansBold">Check Payment / Void Status</Text>
              </TouchableOpacity>
            )}
            {notice.form_code === 'N1' && daysToTermination !== null && daysToTermination <= 0 && (
              <TouchableOpacity onPress={applyRentIncrease} disabled={busy} className="bg-burgundy py-4 rounded-2xl items-center">
                <Text className="text-white font-sansBold">Apply the Rent Increase</Text>
              </TouchableOpacity>
            )}
            {notice.form_code !== 'N1' && daysToTermination !== null && daysToTermination <= 0 && (
              <TouchableOpacity onPress={() => transitionTo('ELIGIBLE_FOR_APPLICATION')} disabled={busy} className="bg-burgundy py-4 rounded-2xl items-center">
                <Text className="text-white font-sansBold">Mark Eligible for {notice.form_code === 'N4' ? 'L1' : 'L2'} Application</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {notice.status === 'CURE_PERIOD' && (
          <View className="gap-3 mb-4">
            {notice.cure_deadline && (
              <View className="bg-amber-50 border border-amber-300 rounded-2xl p-4">
                <Text className="text-navy font-sansBold text-[13px] mb-1">Monitoring Period</Text>
                <Text className="text-navy-muted font-sans text-[13px]">Ends: {formatCalendarDateHuman(notice.cure_deadline)}</Text>
              </View>
            )}
            <TouchableOpacity onPress={generateCertificate} disabled={busy} className="bg-card border border-navy-border py-4 rounded-2xl items-center">
              <Text className="text-navy font-sansBold">Generate Certificate of Service</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => transitionTo('ELIGIBLE_FOR_APPLICATION')} disabled={busy} className="bg-burgundy py-4 rounded-2xl items-center">
              <Text className="text-white font-sansBold">Recorded Information May Make Next Step Available</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => transitionTo('RESOLVED')} disabled={busy} className="bg-card border border-navy-border py-4 rounded-2xl items-center">
              <Text className="text-navy font-sansBold">No Further Incidents — Mark Resolved</Text>
            </TouchableOpacity>
          </View>
        )}

        {notice.form_code !== 'N1' && ['ELIGIBLE_FOR_APPLICATION', 'APPLICATION_DRAFT', 'APPLICATION_READY', 'APPLICATION_FILED'].includes(notice.status) && (
          <View className="bg-burgundy/5 border border-burgundy/30 rounded-2xl p-5 mb-4">
            <Text className="text-navy font-sansBold text-[15px] mb-1">
              {notice.status === 'APPLICATION_FILED' ? `${notice.form_code === 'N4' ? 'L1' : 'L2'} Filed` : 'Next Step Available'}
            </Text>
            {notice.status === 'ELIGIBLE_FOR_APPLICATION' && notice.form_code === 'N4' && earliestL1 && (
              <Text className="text-navy-muted font-sans text-[13px] mb-3">Earliest potential L1 date: {formatCalendarDateHuman(earliestL1)}.</Text>
            )}
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/(tabs)/ltb/application-new', params: { noticeId: notice.id } } as any)}
              className="bg-burgundy py-3.5 rounded-xl items-center"
            >
              <Text className="text-white font-sansBold text-[14px]">
                {notice.status === 'APPLICATION_FILED' ? `View ${notice.form_code === 'N4' ? 'L1' : 'L2'} Application` : `Prepare ${notice.form_code === 'N4' ? 'L1' : 'L2'} Application`}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {documents.length > 0 && (
          <>
            <Text className="text-navy font-sansBold text-[16px] mb-3 mt-2">Documents</Text>
            <View className="bg-card rounded-2xl border border-navy-border mb-6">
              {documents.map((doc, i) => (
                <TouchableOpacity
                  key={doc.id}
                  onPress={() => openDocument(doc)}
                  className={`p-4 flex-row items-center justify-between ${i !== documents.length - 1 ? 'border-b border-navy-border/40' : ''}`}
                >
                  <View className="flex-row items-center flex-1 pr-3">
                    <Feather name="file-text" size={16} color="#1F2F3A" style={{ marginRight: 10 }} />
                    <Text className="text-navy font-sans text-[13px] flex-1" numberOfLines={1}>{doc.file_name ?? doc.doc_type}</Text>
                  </View>
                  <Feather name="download" size={16} color="#1F2F3A" style={{ opacity: 0.4 }} />
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <Text className="text-navy font-sansBold text-[16px] mb-3 mt-2">Timeline</Text>
        <View className="bg-card rounded-2xl border border-navy-border mb-6">
          {events.length === 0 ? (
            <Text className="text-navy-muted font-sans p-4">No events yet.</Text>
          ) : (
            events.map((e, i) => (
              <View key={e.id} className={`p-4 ${i !== events.length - 1 ? 'border-b border-navy-border/40' : ''}`}>
                <Text className="text-navy font-sansBold text-[13px] capitalize">{e.event_type.replace(/_/g, ' ')}</Text>
                <Text className="text-navy-muted font-sans text-[11px] mt-0.5">{new Date(e.created_at).toLocaleString()}</Text>
              </View>
            ))
          )}
        </View>

        <View className="bg-pageBg border border-navy-border rounded-2xl p-4">
          <Text className="text-navy-muted font-sans text-[11px] leading-relaxed">
            This software assists with document preparation, calculations, recordkeeping and workflow management. It does not provide
            legal advice or guarantee that this notice will be accepted by the Landlord and Tenant Board.
          </Text>
        </View>
      </ScrollView>

      <Modal visible={showServiceModal} animationType="slide" transparent onRequestClose={() => setShowServiceModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 justify-end">
          <View className="bg-card rounded-t-[28px] p-6" style={{ maxHeight: '85%' }}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text className="text-navy font-sansBold text-[19px] mb-5">Record Actual Service</Text>

              <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Date actually served</Text>
              <TextInput className="bg-pageBg border border-navy-border rounded-xl p-4 font-sans text-navy mb-4" value={actualDate} onChangeText={setActualDate} placeholder="YYYY-MM-DD" placeholderTextColor="#94a3b8" />

              <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Method actually used</Text>
              <View className="flex-row flex-wrap gap-2 mb-4">
                {SERVICE_METHODS.map((m) => (
                  <TouchableOpacity key={m} onPress={() => setActualMethod(m)} className="px-3 py-2 rounded-full border" style={{ borderColor: actualMethod === m ? '#1F2F3A' : '#D8D2C8', backgroundColor: actualMethod === m ? '#1F2F3A' : 'transparent' }}>
                    <Text className="font-sansBold text-[11px]" style={{ color: actualMethod === m ? '#FFFFFF' : '#333333' }}>{SERVICE_METHOD_LABELS[m]}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Who served it</Text>
              <TextInput className="bg-pageBg border border-navy-border rounded-xl p-4 font-sans text-navy mb-4" value={servedBy} onChangeText={setServedBy} placeholder="Name" placeholderTextColor="#94a3b8" />

              <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Who received it (if applicable)</Text>
              <TextInput className="bg-pageBg border border-navy-border rounded-xl p-4 font-sans text-navy mb-4" value={receivedBy} onChangeText={setReceivedBy} placeholder="Name" placeholderTextColor="#94a3b8" />

              <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Notes (optional)</Text>
              <TextInput className="bg-pageBg border border-navy-border rounded-xl p-4 font-sans text-navy mb-6" value={serviceNotes} onChangeText={setServiceNotes} placeholder="Anything worth recording" placeholderTextColor="#94a3b8" multiline />

              <View className="flex-row gap-3">
                <TouchableOpacity onPress={() => setShowServiceModal(false)} className="flex-1 py-4 rounded-xl items-center border border-navy-border">
                  <Text className="text-navy-muted font-sansBold text-[15px]">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={recordActualService} disabled={busy || !actualDate} className="flex-1 bg-navy py-4 rounded-xl items-center" style={{ opacity: !actualDate ? 0.5 : 1 }}>
                  <Text className="text-white font-sansBold text-[15px]">{busy ? 'Saving...' : 'Save & Recalculate'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
