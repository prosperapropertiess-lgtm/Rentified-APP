import React, { useState, useCallback, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Alert, Modal, Switch } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { money } from '../../lib/format';
import { calculateBalance, isEligibleForReminder, RENT_STATE_LABELS, RENT_STATE_COLORS, type BalanceResult } from '../../lib/rentCollection/balanceState';

interface TenancyRow {
  lease_id: string;
  tenant_id: string;
  tenant_name: string;
  property_label: string;
  unit_number: string | null;
  rent_amount: number;
  balance: BalanceResult;
  emailAvailable: boolean;
  smsAvailable: boolean;
  inAppAvailable: boolean;
  lastReminderAt: string | null;
}

function randomIdempotencyKey(): string {
  return `idem_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export default function RentCollectionScreen() {
  const { profileId } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<TenancyRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Single-reminder modal state
  const [singleTarget, setSingleTarget] = useState<TenancyRow | null>(null);
  const [singleChannels, setSingleChannels] = useState<Set<string>>(new Set(['EMAIL', 'IN_APP']));
  const [singleMessage, setSingleMessage] = useState('');
  const [singlePreviewing, setSinglePreviewing] = useState(false);
  const [singlePreview, setSinglePreview] = useState<any>(null);
  const [singleSending, setSingleSending] = useState(false);
  const singleSendRef = useRef(false);

  // Bulk flow state
  const [bulkStage, setBulkStage] = useState<'none' | 'preview' | 'sending' | 'done'>('none');
  const [bulkPreview, setBulkPreview] = useState<any>(null);
  const bulkSendRef = useRef(false);

  const load = useCallback(async () => {
    if (!profileId) return;
    setLoading(true);
    const { data: leases } = await supabase
      .from('leases')
      .select(`id, rent_amount, tenants ( id, first_name, last_name, email, phone, user_id ), units ( unit_number, properties ( id, name, address ) )`)
      .eq('landlord_id', profileId)
      .eq('status', 'active');

    const leaseIds = (leases ?? []).map((l: any) => l.id);
    const { data: payments } = leaseIds.length
      ? await supabase.from('payments').select('id, lease_id, amount, due_date, status, classification, paid_at').in('lease_id', leaseIds)
      : { data: [] as any[] };

    const { data: recentComms } = await supabase
      .from('communications')
      .select('id, created_at, communication_recipients!inner(lease_id)')
      .eq('landlord_id', profileId)
      .eq('type', 'RENT_REMINDER')
      .order('created_at', { ascending: false });

    const lastReminderByLease = new Map<string, string>();
    (recentComms ?? []).forEach((c: any) => {
      (c.communication_recipients ?? []).forEach((r: any) => {
        if (!lastReminderByLease.has(r.lease_id)) lastReminderByLease.set(r.lease_id, c.created_at);
      });
    });

    const mapped: TenancyRow[] = (leases ?? []).map((l: any) => {
      const leasePayments = (payments ?? []).filter((p: any) => p.lease_id === l.id);
      const balance = calculateBalance(leasePayments);
      return {
        lease_id: l.id,
        tenant_id: l.tenants?.id,
        tenant_name: `${l.tenants?.first_name ?? ''} ${l.tenants?.last_name ?? ''}`.trim() || 'Tenant',
        property_label: l.units?.properties?.name ?? l.units?.properties?.address ?? 'Property',
        unit_number: l.units?.unit_number ?? null,
        rent_amount: Number(l.rent_amount ?? 0),
        balance,
        emailAvailable: !!l.tenants?.email,
        smsAvailable: false,
        inAppAvailable: !!l.tenants?.user_id,
        lastReminderAt: lastReminderByLease.get(l.id) ?? null,
      };
    });

    setRows(mapped);
    setLoading(false);
  }, [profileId]);

  // useFocusEffect alone covers both the initial mount and every
  // return-to-screen refresh — a separate useEffect calling the same
  // load() would double-fire on mount and trip the "no setState directly
  // in an effect body" lint rule.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const eligibleRows = rows.filter((r) => isEligibleForReminder(r.balance.state));
  const totalDue = rows.reduce((sum, r) => sum + r.balance.totalCharged, 0);
  const totalCollected = rows.reduce((sum, r) => sum + r.balance.totalPaid, 0);
  const counts = {
    paid: rows.filter((r) => r.balance.state === 'PAID').length,
    partial: rows.filter((r) => r.balance.state === 'PARTIAL').length,
    outstanding: rows.filter((r) => r.balance.state === 'OUTSTANDING' || r.balance.state === 'DUE_TODAY').length,
    overdue: rows.filter((r) => r.balance.state === 'OVERDUE').length,
  };

  function toggleSelect(leaseId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(leaseId)) next.delete(leaseId); else next.add(leaseId);
      return next;
    });
  }

  function selectAllEligible() {
    setSelected(new Set(eligibleRows.map((r) => r.lease_id)));
  }

  function openSingle(row: TenancyRow) {
    setSingleTarget(row);
    setSingleChannels(new Set([
      ...(row.emailAvailable ? ['EMAIL'] : []),
      ...(row.inAppAvailable ? ['IN_APP'] : []),
    ]));
    setSingleMessage('');
    setSinglePreview(null);
  }

  async function previewSingle() {
    if (!singleTarget) return;
    setSinglePreviewing(true);
    const { data, error } = await supabase.functions.invoke('rent-reminders', {
      body: { action: 'preview_single', leaseId: singleTarget.lease_id, channels: Array.from(singleChannels), customMessage: singleMessage || undefined },
    });
    setSinglePreviewing(false);
    if (error || (data as any)?.error) {
      Alert.alert('Could not preview', (data as any)?.message ?? (data as any)?.error ?? error?.message ?? 'Please try again.');
      return;
    }
    setSinglePreview(data);
  }

  async function sendSingle(confirmRecentDuplicate?: boolean) {
    if (!singleTarget || singleSendRef.current) return;
    singleSendRef.current = true;
    setSingleSending(true);
    const { data, error } = await supabase.functions.invoke('rent-reminders', {
      body: { action: 'send_single', leaseId: singleTarget.lease_id, channels: Array.from(singleChannels), customMessage: singleMessage || undefined, idempotencyKey: randomIdempotencyKey(), confirmRecentDuplicate: !!confirmRecentDuplicate },
    });
    setSingleSending(false);
    singleSendRef.current = false;
    if ((data as any)?.error === 'RECENT_REMINDER_WARNING') {
      Alert.alert(
        'Reminder sent recently',
        (data as any).message,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Send Again Anyway', onPress: () => sendSingle(true) },
        ]
      );
      return;
    }
    if (error || (data as any)?.error) {
      Alert.alert('Could not send', (data as any)?.message ?? (data as any)?.error ?? error?.message ?? 'Please try again.');
      return;
    }
    const status = (data as any).status;
    Alert.alert(
      status === 'SENT' ? 'Reminder sent' : status === 'PARTIAL' ? 'Reminder partially sent' : 'Could not send reminder',
      status === 'PARTIAL' ? 'One or more channels failed — check delivery status.' : undefined
    );
    setSingleTarget(null);
    load();
  }

  async function previewBulk() {
    if (selected.size === 0) return;
    setBulkStage('preview');
    const { data, error } = await supabase.functions.invoke('rent-reminders', {
      body: { action: 'preview_bulk', leaseIds: Array.from(selected), channels: ['EMAIL', 'IN_APP'] },
    });
    if (error || (data as any)?.error) {
      Alert.alert('Could not preview', (data as any)?.message ?? (data as any)?.error ?? error?.message ?? 'Please try again.');
      setBulkStage('none');
      return;
    }
    setBulkPreview(data);
  }

  async function sendBulk() {
    if (bulkSendRef.current) return;
    bulkSendRef.current = true;
    setBulkStage('sending');
    const { data, error } = await supabase.functions.invoke('rent-reminders', {
      body: { action: 'send_bulk', leaseIds: Array.from(selected), channels: ['EMAIL', 'IN_APP'], idempotencyKey: randomIdempotencyKey() },
    });
    bulkSendRef.current = false;
    if (error || (data as any)?.error) {
      Alert.alert('Could not send', (data as any)?.message ?? (data as any)?.error ?? error?.message ?? 'Please try again.');
      setBulkStage('none');
      return;
    }
    setBulkPreview(data);
    setBulkStage('done');
    setSelected(new Set());
    load();
  }

  if (loading) return <View className="flex-1 bg-pageBg justify-center items-center"><ActivityIndicator color="#1F2F3A" /></View>;

  return (
    <View className="flex-1 bg-pageBg">
      <View className="pt-16 px-6 pb-6 bg-card border-b border-navy-border flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="mr-3 w-9 h-9 rounded-full bg-pageBg border border-navy-border items-center justify-center">
          <Feather name="chevron-left" size={20} color="#1F2F3A" />
        </TouchableOpacity>
        <Text className="text-xl font-sansBold text-navy">Rent Collection</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: selected.size > 0 ? 120 : 60 }}>
        <View className="bg-navy rounded-2xl p-5 mb-6">
          <Text className="text-white/60 font-sansBold text-[11px] uppercase tracking-wide mb-2">Collected</Text>
          <Text className="text-white font-sansBold text-[28px] mb-4">${money(totalCollected)} / ${money(totalDue)}</Text>
          <View className="flex-row flex-wrap gap-4">
            <Text className="text-white/70 font-sans text-[12px]">{counts.paid} paid in full</Text>
            <Text className="text-white/70 font-sans text-[12px]">{counts.partial} partial</Text>
            <Text className="text-white/70 font-sans text-[12px]">{counts.outstanding} outstanding</Text>
            <Text className="text-white/70 font-sans text-[12px]">{counts.overdue} overdue</Text>
          </View>
        </View>

        {eligibleRows.length > 0 && (
          <TouchableOpacity onPress={selectAllEligible} className="bg-card border border-navy-border rounded-xl p-3.5 mb-4 flex-row items-center justify-center">
            <Feather name="check-square" size={16} color="#1F2F3A" style={{ marginRight: 8 }} />
            <Text className="text-navy font-sansBold text-[13px]">Select All Outstanding ({eligibleRows.length})</Text>
          </TouchableOpacity>
        )}

        {rows.length === 0 && (
          <Text className="text-navy-muted font-sans text-[14px] text-center mt-8">No active leases yet.</Text>
        )}

        {rows.map((row) => {
          const style = RENT_STATE_COLORS[row.balance.state];
          const eligible = isEligibleForReminder(row.balance.state);
          return (
            <View key={row.lease_id} className="bg-card rounded-2xl p-4 border border-navy-border mb-3 flex-row items-start">
              {eligible && (
                <TouchableOpacity onPress={() => toggleSelect(row.lease_id)} className="mr-3 mt-1 w-6 h-6 rounded-md border-2 items-center justify-center" style={{ borderColor: '#1F2F3A', backgroundColor: selected.has(row.lease_id) ? '#1F2F3A' : 'transparent' }}>
                  {selected.has(row.lease_id) && <Feather name="check" size={14} color="#fff" />}
                </TouchableOpacity>
              )}
              <View className="flex-1">
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-navy font-sansBold text-[15px]">{row.tenant_name}</Text>
                  <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: style.bg }}>
                    <Text className="font-sansBold text-[11px]" style={{ color: style.color }}>{RENT_STATE_LABELS[row.balance.state]}</Text>
                  </View>
                </View>
                <Text className="text-navy-muted font-sans text-[12px] mb-2">{row.property_label}{row.unit_number ? ` · Unit ${row.unit_number}` : ''}</Text>
                <View className="flex-row gap-4 mb-2">
                  <Text className="text-navy-muted font-sans text-[12px]">Rent: ${money(row.rent_amount)}</Text>
                  {row.balance.totalOwing > 0 && <Text className="text-burgundy font-sansBold text-[12px]">Owing: ${money(row.balance.totalOwing)}</Text>}
                </View>
                {row.lastReminderAt && (
                  <Text className="text-navy-muted/60 font-sans text-[11px] mb-2">Last reminder: {new Date(row.lastReminderAt).toLocaleDateString()}</Text>
                )}
                <View className="flex-row gap-2 mt-1">
                  {eligible && (
                    <TouchableOpacity onPress={() => openSingle(row)} className="bg-navy self-start px-4 py-2 rounded-full">
                      <Text className="text-white font-sansBold text-[12px]">Send Reminder</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => router.push(`/reminder-history/${row.lease_id}`)} className="border border-navy-border self-start px-4 py-2 rounded-full">
                    <Text className="text-navy font-sansBold text-[12px]">History</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {selected.size > 0 && (
        <View className="absolute bottom-0 left-0 right-0 bg-navy px-6 py-4 flex-row items-center justify-between" style={{ paddingBottom: 32 }}>
          <Text className="text-white font-sansBold text-[14px]">{selected.size} tenant{selected.size === 1 ? '' : 's'} selected</Text>
          <TouchableOpacity onPress={previewBulk} className="bg-white px-5 py-2.5 rounded-full">
            <Text className="text-navy font-sansBold text-[13px]">Send Reminder</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Single reminder modal */}
      <Modal visible={!!singleTarget} transparent animationType="slide">
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-pageBg rounded-t-3xl p-6" style={{ maxHeight: '85%' }}>
            <ScrollView>
              <Text className="text-navy font-sansBold text-lg mb-1">{singleTarget?.tenant_name}</Text>
              <Text className="text-navy-muted font-sans text-[13px] mb-4">{singleTarget?.property_label}{singleTarget?.unit_number ? ` · Unit ${singleTarget.unit_number}` : ''}</Text>

              <View className="bg-card rounded-2xl p-4 border border-navy-border mb-4">
                <View className="flex-row justify-between py-1"><Text className="text-navy-muted font-sans text-[12px]">Rent due</Text><Text className="text-navy font-sans text-[12px]">${money(singleTarget?.rent_amount ?? 0)}</Text></View>
                <View className="flex-row justify-between py-1"><Text className="text-navy-muted font-sans text-[12px]">Paid</Text><Text className="text-navy font-sans text-[12px]">${money(singleTarget?.balance.totalPaid ?? 0)}</Text></View>
                <View className="flex-row justify-between py-1"><Text className="text-navy-muted font-sansBold text-[12px]">Outstanding</Text><Text className="text-burgundy font-sansBold text-[12px]">${money(singleTarget?.balance.totalOwing ?? 0)}</Text></View>
              </View>

              <Text className="text-navy font-sansBold text-[13px] mb-2">Channels</Text>
              <View className="gap-2 mb-4">
                {(['EMAIL', 'SMS', 'IN_APP'] as const).map((ch) => {
                  const available = ch === 'EMAIL' ? singleTarget?.emailAvailable : ch === 'SMS' ? singleTarget?.smsAvailable : singleTarget?.inAppAvailable;
                  const reason = ch === 'EMAIL' ? 'No email address on file' : ch === 'SMS' ? 'SMS not configured yet' : 'Account not activated';
                  return (
                    <View key={ch} className="flex-row items-center justify-between bg-card rounded-xl p-3 border border-navy-border" style={{ opacity: available ? 1 : 0.5 }}>
                      <View>
                        <Text className="text-navy font-sans text-[13px]">{ch === 'EMAIL' ? 'Email' : ch === 'SMS' ? 'SMS' : 'In-app'}</Text>
                        {!available && <Text className="text-navy-muted font-sans text-[11px]">{reason}</Text>}
                      </View>
                      <Switch
                        value={singleChannels.has(ch)}
                        disabled={!available}
                        onValueChange={(v) => setSingleChannels((prev) => { const next = new Set(prev); if (v) next.add(ch); else next.delete(ch); return next; })}
                        trackColor={{ true: '#1F2F3A' }}
                      />
                    </View>
                  );
                })}
              </View>

              <Text className="text-navy font-sansBold text-[13px] mb-2">Message</Text>
              <TextInput
                className="bg-card border border-navy-border rounded-xl p-4 font-sans text-navy mb-3 text-[13px]"
                value={singleMessage}
                onChangeText={setSingleMessage}
                placeholder="Leave blank to use the default reminder for this balance state"
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={4}
                style={{ minHeight: 90, textAlignVertical: 'top' }}
              />
              <TouchableOpacity onPress={previewSingle} disabled={singlePreviewing} className="border border-navy-border py-3 rounded-xl items-center mb-4">
                <Text className="text-navy font-sansBold text-[13px]">{singlePreviewing ? 'Checking...' : 'Preview'}</Text>
              </TouchableOpacity>

              {singlePreview?.recentReminder && (
                <View className="bg-amber-50 border border-amber-300 rounded-xl p-3 mb-4">
                  <Text className="text-navy font-sansBold text-[12px]">A rent reminder was sent to this tenancy {singlePreview.recentReminder.minutesAgo} minute(s) ago.</Text>
                </View>
              )}

              {singlePreview && (
                <View className="bg-card rounded-2xl p-4 border border-navy-border mb-4">
                  <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Preview</Text>
                  <Text className="text-navy font-sans text-[13px]">{singlePreview.renderedMessage}</Text>
                  {singlePreview.excludedChannels?.length > 0 && (
                    <Text className="text-amber-700 font-sans text-[11px] mt-2">
                      {singlePreview.excludedChannels.map((e: any) => `${e.channel}: ${e.reason}`).join(' · ')}
                    </Text>
                  )}
                </View>
              )}

              <View className="flex-row gap-3">
                <TouchableOpacity onPress={() => setSingleTarget(null)} className="flex-1 border border-navy-border py-3.5 rounded-xl items-center">
                  <Text className="text-navy font-sansBold text-[14px]">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => sendSingle()} disabled={singleSending || singleChannels.size === 0} className="flex-1 bg-navy py-3.5 rounded-xl items-center" style={{ opacity: singleChannels.size === 0 ? 0.4 : 1 }}>
                  <Text className="text-white font-sansBold text-[14px]">{singleSending ? 'Sending...' : 'Send Reminder'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Bulk flow modal */}
      <Modal visible={bulkStage !== 'none'} transparent animationType="slide">
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-pageBg rounded-t-3xl p-6" style={{ maxHeight: '85%' }}>
            {bulkStage === 'preview' && !bulkPreview && (
              <View className="items-center py-8"><ActivityIndicator color="#1F2F3A" /></View>
            )}
            {bulkStage === 'preview' && bulkPreview && (
              <ScrollView>
                <Text className="text-navy font-sansBold text-lg mb-1">Send Rent Reminder</Text>
                <Text className="text-navy-muted font-sans text-[13px] mb-4">Recipients: {bulkPreview.eligibleCount} tenancies · Total outstanding: ${money(bulkPreview.totalOutstanding)}</Text>
                {bulkPreview.removedCount > 0 && (
                  <View className="bg-amber-50 border border-amber-300 rounded-xl p-3 mb-4">
                    <Text className="text-navy font-sansBold text-[12px]">{bulkPreview.removedCount} account{bulkPreview.removedCount === 1 ? '' : 's'} changed and {bulkPreview.removedCount === 1 ? 'was' : 'were'} removed</Text>
                    {bulkPreview.removed.map((r: any, i: number) => (
                      <Text key={i} className="text-navy-muted font-sans text-[11px] mt-1">{r.tenantName ?? 'Tenant'}: {r.reason}</Text>
                    ))}
                  </View>
                )}
                <View className="bg-card rounded-2xl border border-navy-border mb-4">
                  {bulkPreview.eligible.map((r: any, i: number) => (
                    <View key={r.leaseId} className={`p-3 ${i !== bulkPreview.eligible.length - 1 ? 'border-b border-navy-border/30' : ''}`}>
                      <Text className="text-navy font-sans text-[13px]">{r.tenantName} — ${money(r.balance.totalOwing)}</Text>
                      {!r.emailAvailable && !r.smsAvailable && !r.inAppAvailable && <Text className="text-burgundy font-sans text-[11px]">No channels available</Text>}
                    </View>
                  ))}
                </View>
                <View className="flex-row gap-3">
                  <TouchableOpacity onPress={() => { setBulkStage('none'); setBulkPreview(null); }} className="flex-1 border border-navy-border py-3.5 rounded-xl items-center">
                    <Text className="text-navy font-sansBold text-[14px]">Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={sendBulk} disabled={bulkPreview.eligibleCount === 0} className="flex-1 bg-navy py-3.5 rounded-xl items-center" style={{ opacity: bulkPreview.eligibleCount === 0 ? 0.4 : 1 }}>
                    <Text className="text-white font-sansBold text-[14px]">Send Reminders</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
            {bulkStage === 'sending' && (
              <View className="items-center py-8">
                <ActivityIndicator color="#1F2F3A" style={{ marginBottom: 12 }} />
                <Text className="text-navy font-sans text-[13px]">Sending reminders…</Text>
              </View>
            )}
            {bulkStage === 'done' && bulkPreview && (
              <ScrollView>
                <Text className="text-navy font-sansBold text-lg mb-3">Reminders Sent</Text>
                <View className="flex-row gap-3 mb-4">
                  <View className="bg-card rounded-xl p-3 border border-navy-border flex-1">
                    <Text className="text-navy font-sansBold text-[18px]">{bulkPreview.sentCount ?? 0}</Text>
                    <Text className="text-navy-muted font-sans text-[11px]">Sent</Text>
                  </View>
                  {bulkPreview.partialCount > 0 && (
                    <View className="bg-card rounded-xl p-3 border border-navy-border flex-1">
                      <Text className="text-navy font-sansBold text-[18px]">{bulkPreview.partialCount}</Text>
                      <Text className="text-navy-muted font-sans text-[11px]">Partial</Text>
                    </View>
                  )}
                  {bulkPreview.failedCount > 0 && (
                    <View className="bg-card rounded-xl p-3 border border-navy-border flex-1">
                      <Text className="text-burgundy font-sansBold text-[18px]">{bulkPreview.failedCount}</Text>
                      <Text className="text-navy-muted font-sans text-[11px]">Failed</Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity onPress={() => { setBulkStage('none'); setBulkPreview(null); }} className="bg-navy py-3.5 rounded-xl items-center">
                  <Text className="text-white font-sansBold text-[14px]">Done</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
