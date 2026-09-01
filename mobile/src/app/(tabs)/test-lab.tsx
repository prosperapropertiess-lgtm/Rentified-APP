import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';

// Observability spec, sections 6/7/8/9/29/40 — a real, in-app "Admin →
// Test Lab" rather than requiring Ebin to read Supabase's own dashboard
// logs (the spec's explicit goal: no SSHing into servers to figure out
// what broke). Deliberately lean per the spec's own section 39 ("do not
// overengineer") — one events feed instead of a full observability
// platform, one seeded test fixture instead of a separate staging
// environment, one real fault-injection toggle instead of a chaos suite.

interface EventRow {
  id: string;
  created_at: string;
  level: 'info' | 'warn' | 'error';
  request_id: string;
  operation: string;
  message: string;
  error_code: string | null;
  retryable: boolean;
  context: any;
  release: string | null;
}

function levelStyle(level: string) {
  if (level === 'error') return { bg: '#fee2e2', color: '#991b1b' };
  if (level === 'warn') return { bg: '#fef3c7', color: '#92400e' };
  return { bg: '#e0e7ff', color: '#3730a3' };
}

export default function TestLabScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const [expandedTrace, setExpandedTrace] = useState<{ requestId: string; events: EventRow[] } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: summaryData }, { data: eventsData }] = await Promise.all([
      supabase.functions.invoke('test-lab', { body: { action: 'summary' } }),
      supabase.functions.invoke('test-lab', { body: { action: 'list_events', limit: 30 } }),
    ]);
    setSummary(summaryData);
    setEvents(((eventsData as any)?.events ?? []) as EventRow[]);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function seedPortfolio() {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('test-lab', { body: { action: 'seed_test_portfolio' } });
    setBusy(false);
    if (error || (data as any)?.error) { Alert.alert('Could not seed', (data as any)?.error ?? error?.message); return; }
    load();
  }

  async function resetPortfolio() {
    Alert.alert('Reset test data?', 'This deletes the test property, unit, tenant, and lease.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset', style: 'destructive', onPress: async () => {
          setBusy(true);
          await supabase.functions.invoke('test-lab', { body: { action: 'reset_test_data' } });
          setBusy(false);
          setLastResult(null);
          load();
        },
      },
    ]);
  }

  async function fireInjectedFailure() {
    setBusy(true);
    await supabase.functions.invoke('test-lab', { body: { action: 'arm_failure_injection' } });
    const { data, error } = await supabase.functions.invoke('test-lab', { body: { action: 'fire_test_email' } });
    setBusy(false);
    if (error) { Alert.alert('Could not fire test', error.message); return; }
    if ((data as any)?.error) {
      Alert.alert('No test portfolio', 'Seed a test portfolio first.');
      return;
    }
    setLastResult(data);
    load();
  }

  async function retry() {
    if (!lastResult) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('test-lab', { body: { action: 'fire_test_email' } });
    setBusy(false);
    if (error) { Alert.alert('Could not retry', error.message); return; }
    setLastResult(data);
    load();
  }

  async function openTrace(requestId: string) {
    const { data } = await supabase.functions.invoke('test-lab', { body: { action: 'get_trace', requestId } });
    setExpandedTrace({ requestId, events: ((data as any)?.trace ?? []) as EventRow[] });
  }

  if (loading) return <View className="flex-1 bg-pageBg justify-center items-center"><ActivityIndicator color="#1F2F3A" /></View>;

  return (
    <View className="flex-1 bg-pageBg">
      <View className="pt-16 px-6 pb-6 bg-card border-b border-navy-border flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="mr-3 w-9 h-9 rounded-full bg-pageBg border border-navy-border items-center justify-center">
          <Feather name="chevron-left" size={20} color="#1F2F3A" />
        </TouchableOpacity>
        <Text className="text-xl font-sansBold text-navy">Test Lab</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 60 }}>
        <View className="bg-navy rounded-2xl p-5 mb-6 flex-row justify-between">
          <View>
            <Text className="text-white/60 font-sansBold text-[11px] uppercase tracking-wide mb-1">Last 24h</Text>
            <Text className="text-white font-sansBold text-[24px]">{summary?.last24h?.total ?? 0} events</Text>
            <Text className="text-white/70 font-sans text-[12px] mt-1">{summary?.last24h?.errors ?? 0} errors · {summary?.last24h?.warnings ?? 0} warnings</Text>
          </View>
          <Text className="text-white/50 font-sans text-[11px]">Release {summary?.release}</Text>
        </View>

        <Text className="text-navy font-sansBold text-[16px] mb-3">Test Portfolio</Text>
        <View className="bg-card rounded-2xl p-4 border border-navy-border mb-6">
          <Text className="text-navy-muted font-sans text-[12px] mb-3">A safe, isolated test property + tenant, marked so it never mixes with real data. Test emails go to your own account email.</Text>
          <View className="flex-row gap-3">
            <TouchableOpacity onPress={seedPortfolio} disabled={busy} className="flex-1 bg-navy py-3 rounded-xl items-center">
              <Text className="text-white font-sansBold text-[12px]">Seed Test Portfolio</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={resetPortfolio} disabled={busy} className="flex-1 border border-burgundy py-3 rounded-xl items-center">
              <Text className="text-burgundy font-sansBold text-[12px]">Reset</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text className="text-navy font-sansBold text-[16px] mb-3">Failure Injection</Text>
        <View className="bg-card rounded-2xl p-4 border border-navy-border mb-6">
          <Text className="text-navy-muted font-sans text-[12px] mb-3">Deliberately fail one real send, see the full trace, then retry and watch it actually succeed.</Text>
          <TouchableOpacity onPress={fireInjectedFailure} disabled={busy} className="bg-burgundy py-3 rounded-xl items-center mb-3">
            {busy ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-sansBold text-[12px]">Fire Test Failure</Text>}
          </TouchableOpacity>

          {lastResult && (
            <View className="bg-pageBg rounded-xl p-3.5">
              <View className="flex-row items-center justify-between mb-2">
                <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: lastResult.status === 'SENT' ? '#d1fae5' : '#fee2e2' }}>
                  <Text className="font-sansBold text-[11px]" style={{ color: lastResult.status === 'SENT' ? '#065f46' : '#991b1b' }}>{lastResult.status === 'SENT' ? 'SUCCEEDED' : 'FAILED'}</Text>
                </View>
                {lastResult.status !== 'SENT' && (
                  <TouchableOpacity onPress={retry} disabled={busy} className="px-3 py-1.5 rounded-full bg-navy">
                    <Text className="text-white font-sansBold text-[11px]">Retry</Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text className="text-navy font-sans text-[12px] mb-1">{lastResult.message ?? (lastResult.status === 'SENT' ? 'Real email sent successfully.' : '')}</Text>
              <TouchableOpacity onPress={() => openTrace(lastResult.requestId)}>
                <Text className="text-navy-muted font-sans text-[11px] mt-1" numberOfLines={1}>Request ID: {lastResult.requestId} · tap to view full trace</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <Text className="text-navy font-sansBold text-[16px] mb-3">Recent Events</Text>
        {events.length === 0 ? (
          <View className="bg-card rounded-2xl p-8 items-center border border-navy-border">
            <Text className="text-navy-muted font-sans text-center">No events yet.</Text>
          </View>
        ) : (
          events.map((e) => {
            const style = levelStyle(e.level);
            return (
              <TouchableOpacity key={e.id} onPress={() => openTrace(e.request_id)} className="bg-card rounded-2xl p-4 border border-navy-border mb-3">
                <View className="flex-row items-center justify-between mb-1">
                  <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: style.bg }}>
                    <Text className="font-sansBold text-[10px] uppercase" style={{ color: style.color }}>{e.level}</Text>
                  </View>
                  <Text className="text-navy-muted font-sans text-[11px]">{new Date(e.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</Text>
                </View>
                <Text className="text-navy font-sansBold text-[13px] mb-0.5">{e.operation}</Text>
                <Text className="text-navy-muted font-sans text-[12px]" numberOfLines={2}>{e.message}</Text>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {expandedTrace && (
        <View className="absolute inset-0 bg-black/50 justify-end">
          <View className="bg-pageBg rounded-t-3xl p-6" style={{ maxHeight: '80%' }}>
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-navy font-sansBold text-[16px]">Trace</Text>
              <TouchableOpacity onPress={() => setExpandedTrace(null)}><Feather name="x" size={22} color="#1F2F3A" /></TouchableOpacity>
            </View>
            <ScrollView>
              <Text className="text-navy-muted font-sans text-[11px] mb-3" numberOfLines={1}>Request ID: {expandedTrace.requestId}</Text>
              {expandedTrace.events.map((e) => {
                const style = levelStyle(e.level);
                return (
                  <View key={e.id} className="bg-card rounded-2xl p-4 border border-navy-border mb-3">
                    <View className="flex-row items-center justify-between mb-1">
                      <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: style.bg }}>
                        <Text className="font-sansBold text-[10px] uppercase" style={{ color: style.color }}>{e.level}</Text>
                      </View>
                      <Text className="text-navy-muted font-sans text-[11px]">{new Date(e.created_at).toLocaleTimeString()}</Text>
                    </View>
                    <Text className="text-navy font-sansBold text-[13px] mb-1">{e.operation}</Text>
                    <Text className="text-navy font-sans text-[12px] mb-1">{e.message}</Text>
                    {e.error_code && <Text className="text-burgundy font-sans text-[11px] mb-1">Error code: {e.error_code}</Text>}
                    {e.retryable && <Text className="text-navy-muted font-sans text-[11px] mb-1">Retryable</Text>}
                    {e.release && <Text className="text-navy-muted font-sans text-[11px]">Release: {e.release}</Text>}
                    {e.context && <Text className="text-navy-muted font-sans text-[10px] mt-2" numberOfLines={4}>{JSON.stringify(e.context)}</Text>}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  );
}
