import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { STATUS_LABELS, isServedOrLater } from '../../../lib/ltb/noticeStateMachine';
import { daysUntil } from '../../../lib/ltb/rules/n4';
import type { NoticeStatus } from '../../../lib/ltb/types';

interface NoticeRow {
  id: string;
  form_code: string;
  status: string;
  termination_date: string | null;
  cure_deadline: string | null;
  created_at: string;
  snapshot: any;
  units: { unit_number: string | null; properties: { name: string | null; address: string | null } | null } | null;
}

function tenantNamesFromSnapshot(snapshot: any): string {
  const names = snapshot?.tenant_names;
  return Array.isArray(names) ? names.join(', ') : 'Tenant';
}

function propertyLabel(n: NoticeRow): string {
  const p = n.units?.properties;
  const label = p?.name ?? p?.address ?? 'Property';
  return n.units?.unit_number ? `${label} · Unit ${n.units.unit_number}` : label;
}

export default function LTBHomeScreen() {
  const { profileId } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [notices, setNotices] = useState<NoticeRow[]>([]);

  const fetchNotices = useCallback(async () => {
    if (!profileId) return;
    setLoadError(false);
    const { data, error } = await supabase
      .from('ltb_notices')
      .select(`id, form_code, status, termination_date, cure_deadline, created_at, snapshot, units ( unit_number, properties ( name, address ) )`)
      .eq('landlord_id', profileId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      setLoadError(true);
      setLoading(false);
      return;
    }
    setNotices((data || []) as unknown as NoticeRow[]);
    setLoading(false);
  }, [profileId]);

  // useFocusEffect (not a plain mount-only effect) — Expo Router's Tabs
  // keeps screens mounted when you navigate away, so a mount-only fetch
  // goes stale the moment you create a notice and come back here. This
  // refetches every time the screen regains focus instead.
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchNotices();
    }, [fetchNotices])
  );

  const drafts = notices.filter((n) => ['DRAFT', 'NEEDS_INFORMATION', 'READY_FOR_REVIEW', 'READY_TO_SERVE'].includes(n.status));
  const active = notices.filter((n) => isServedOrLater(n.status as NoticeStatus) && !['CLOSED', 'CANCELLED', 'VOID', 'RESOLVED'].includes(n.status));
  const closed = notices.filter((n) => ['CLOSED', 'CANCELLED', 'VOID', 'RESOLVED'].includes(n.status));

  // Action Center — spec section 36. Specific, actionable messages grouped
  // by urgency, not just a generic "needs attention" list.
  interface ActionItem { notice: NoticeRow; message: string; urgency: 'today' | 'upcoming'; sortDays: number }
  const actionItems: ActionItem[] = [];
  for (const n of active) {
    const label = `${n.form_code} — ${propertyLabel(n)}`;
    if (n.status === 'ELIGIBLE_FOR_APPLICATION') {
      actionItems.push({ notice: n, message: `${label}: eligible to proceed to the next application step`, urgency: 'today', sortDays: -1 });
    } else if (n.status === 'CURE_PERIOD' && n.cure_deadline) {
      const d = daysUntil(n.cure_deadline);
      if (d <= 3) actionItems.push({ notice: n, message: `${label}: monitoring period ${d <= 0 ? 'has ended' : `ends in ${d} day${d === 1 ? '' : 's'}`}`, urgency: d <= 0 ? 'today' : 'upcoming', sortDays: d });
    } else if (n.status === 'WAITING_PERIOD' && n.termination_date) {
      const d = daysUntil(n.termination_date);
      if (d <= 7) actionItems.push({ notice: n, message: `${label}: termination date ${d <= 0 ? 'has passed' : `in ${d} day${d === 1 ? '' : 's'}`}`, urgency: d <= 1 ? 'today' : 'upcoming', sortDays: d });
    }
  }
  actionItems.sort((a, b) => a.sortDays - b.sortDays);
  const todayItems = actionItems.filter((i) => i.urgency === 'today');
  const upcomingItems = actionItems.filter((i) => i.urgency === 'upcoming');

  return (
    <View className="flex-1 bg-pageBg">
      <View className="pt-16 px-6 pb-6 bg-card border-b border-navy-border">
        <Text className="text-2xl font-sansBold text-navy">Notices & LTB</Text>
        <Text className="text-navy-muted font-sans text-[13px] mt-1">
          Turns landlord notices into structured workflows — not legal advice.
        </Text>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center"><ActivityIndicator color="#1F2F3A" /></View>
      ) : loadError ? (
        <View className="flex-1 justify-center items-center px-8">
          <Feather name="wifi-off" size={26} color="#8B2030" />
          <Text className="text-navy font-sansBold text-lg mt-4 mb-1 text-center">Couldn&apos;t load notices</Text>
          <TouchableOpacity onPress={() => { setLoading(true); fetchNotices(); }} className="bg-navy px-6 py-4 rounded-2xl mt-2">
            <Text className="text-white font-sansBold">Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 100 }}>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/ltb/create')}
            className="bg-navy py-4 rounded-2xl flex-row items-center justify-center mb-8"
          >
            <Feather name="plus" size={18} color="#FFFFFF" />
            <Text className="text-white font-sansBold text-[15px] ml-2">Create Notice</Text>
          </TouchableOpacity>

          {actionItems.length > 0 && (
            <>
              <Text className="text-[18px] text-navy font-sansBold mb-4">Needs Attention</Text>
              {todayItems.length > 0 && (
                <View className="mb-4">
                  <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2 ml-1">Today</Text>
                  {todayItems.map((item) => (
                    <TouchableOpacity
                      key={item.notice.id}
                      onPress={() => router.push(`/(tabs)/ltb/notice/${item.notice.id}`)}
                      className="bg-burgundy/5 border border-burgundy/30 rounded-2xl p-4 mb-3 flex-row items-center justify-between"
                    >
                      <View className="flex-1 pr-3">
                        <Text className="text-navy font-sansBold text-[14px]">{tenantNamesFromSnapshot(item.notice.snapshot)}</Text>
                        <Text className="text-burgundy font-sans text-[13px] mt-0.5">{item.message}</Text>
                      </View>
                      <Feather name="chevron-right" size={18} color="#8B2030" />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {upcomingItems.length > 0 && (
                <View className="mb-4">
                  <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2 ml-1">Coming Up</Text>
                  {upcomingItems.map((item) => (
                    <TouchableOpacity
                      key={item.notice.id}
                      onPress={() => router.push(`/(tabs)/ltb/notice/${item.notice.id}`)}
                      className="bg-card border border-navy-border rounded-2xl p-4 mb-3 flex-row items-center justify-between"
                    >
                      <View className="flex-1 pr-3">
                        <Text className="text-navy font-sansBold text-[14px]">{tenantNamesFromSnapshot(item.notice.snapshot)}</Text>
                        <Text className="text-navy-muted font-sans text-[13px] mt-0.5">{item.message}</Text>
                      </View>
                      <Feather name="chevron-right" size={18} color="#1F2F3A" style={{ opacity: 0.3 }} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}

          <Text className="text-[18px] text-navy font-sansBold mb-4 mt-4">Active Notices</Text>
          {active.length === 0 ? (
            <View className="bg-card rounded-2xl p-8 items-center border border-navy-border mb-8">
              <Text className="text-navy-muted font-sans text-center">No active notices.</Text>
            </View>
          ) : (
            active.map((n) => (
              <TouchableOpacity
                key={n.id}
                onPress={() => router.push(`/(tabs)/ltb/notice/${n.id}`)}
                className="bg-card rounded-2xl p-4 mb-3 border border-navy-border flex-row items-center justify-between"
              >
                <View className="flex-1 pr-3">
                  <Text className="text-navy font-sansBold text-[15px]">{n.form_code} — {tenantNamesFromSnapshot(n.snapshot)}</Text>
                  <Text className="text-navy-muted font-sans text-[13px] mt-0.5">{propertyLabel(n)}</Text>
                </View>
                <View className="bg-navy/5 px-3 py-1.5 rounded-full">
                  <Text className="text-navy font-sansBold text-[11px]">{STATUS_LABELS[n.status as keyof typeof STATUS_LABELS] ?? n.status}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}

          <Text className="text-[18px] text-navy font-sansBold mb-4 mt-4">Drafts</Text>
          {drafts.length === 0 ? (
            <Text className="text-navy-muted font-sans mb-8">No drafts.</Text>
          ) : (
            drafts.map((n) => (
              <TouchableOpacity
                key={n.id}
                onPress={() => router.push(`/(tabs)/ltb/notice/${n.id}`)}
                className="bg-card rounded-2xl p-4 mb-3 border border-navy-border flex-row items-center justify-between opacity-80"
              >
                <View className="flex-1 pr-3">
                  <Text className="text-navy font-sansBold text-[15px]">{n.form_code} — {tenantNamesFromSnapshot(n.snapshot)}</Text>
                  <Text className="text-navy-muted font-sans text-[13px] mt-0.5">{propertyLabel(n)}</Text>
                </View>
                <Text className="text-navy-muted font-sansBold text-[11px]">{STATUS_LABELS[n.status as keyof typeof STATUS_LABELS] ?? n.status}</Text>
              </TouchableOpacity>
            ))
          )}

          <Text className="text-[18px] text-navy font-sansBold mb-4 mt-4">Completed / Closed</Text>
          {closed.length === 0 ? (
            <Text className="text-navy-muted font-sans">Nothing closed yet.</Text>
          ) : (
            closed.map((n) => (
              <TouchableOpacity
                key={n.id}
                onPress={() => router.push(`/(tabs)/ltb/notice/${n.id}`)}
                className="bg-card rounded-2xl p-4 mb-3 border border-navy-border flex-row items-center justify-between opacity-60"
              >
                <View className="flex-1 pr-3">
                  <Text className="text-navy font-sansBold text-[15px]">{n.form_code} — {tenantNamesFromSnapshot(n.snapshot)}</Text>
                  <Text className="text-navy-muted font-sans text-[13px] mt-0.5">{propertyLabel(n)}</Text>
                </View>
                <Text className="text-navy-muted font-sansBold text-[11px]">{STATUS_LABELS[n.status as keyof typeof STATUS_LABELS] ?? n.status}</Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}
