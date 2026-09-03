import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

// New build, not a port — same reason as messages.tsx: the web owner
// portal's maintenance page runs on a separate database. This is the
// dashboard's "Requests" count made actually openable; previously there
// was no way to see or act on a request beyond the number on the badge.

interface RequestRow {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  priority: string | null;
  status: string;
  created_at: string;
  tenants: { first_name: string | null; last_name: string | null } | null;
  units: { unit_number: string | null; properties: { name: string | null; address: string | null } | null } | null;
}

// Real check constraint on maintenance_requests.status — verified against
// the database, not the 'pending' the old tenant-submit code used to send
// (which meant every submission failed outright before this fix).
const STATUS_ORDER = ['open', 'in_progress', 'scheduled', 'resolved'];
const STATUS_LABELS: Record<string, string> = {
  open: 'Open', in_progress: 'In Progress', scheduled: 'Scheduled', resolved: 'Resolved', closed: 'Closed',
};
const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  open: { bg: '#FEF3C7', text: '#92400E' },
  in_progress: { bg: '#DBEAFE', text: '#1E40AF' },
  scheduled: { bg: '#EDE9FE', text: '#5B21B6' },
  resolved: { bg: '#D1FAE5', text: '#065F46' },
  closed: { bg: '#F3F4F6', text: '#6B7280' },
};
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const PRIORITY_COLORS: Record<string, string> = { low: '#64748b', medium: '#1F2F3A', high: '#B45309', urgent: '#8B2030' };

export default function MaintenanceScreen() {
  const { profileId } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const [loadError, setLoadError] = useState(false);

  const fetchRequests = useCallback(async () => {
    if (!profileId) return;
    setLoadError(false);
    const { data, error } = await supabase
      .from('maintenance_requests')
      .select(`
        id, title, description, category, priority, status, created_at,
        tenants ( first_name, last_name ),
        units ( unit_number, properties ( name, address ) )
      `)
      .eq('landlord_id', profileId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      setLoadError(true);
      setLoading(false);
      return;
    }

    // Supabase's default (ungenerated) client types every nested embed as
    // an array regardless of FK cardinality; these are verified to-one.
    setRequests((data || []) as unknown as RequestRow[]);
    setLoading(false);
  }, [profileId]);

  useFocusEffect(useCallback(() => { fetchRequests(); }, [fetchRequests]));

  async function updateRequest(id: string, updates: Record<string, string>) {
    const { error } = await supabase.from('maintenance_requests').update(updates).eq('id', id);
    if (error) {
      Alert.alert('Could not update', error.message);
      return;
    }
    fetchRequests();
  }

  const visible = filter === 'open' ? requests.filter((r) => !['resolved', 'closed'].includes(r.status)) : requests;

  return (
    <View className="flex-1 bg-pageBg">
      <View className="pt-16 px-6 pb-6 bg-card border-b border-navy-border">
        <View className="flex-row items-center mb-5">
          <TouchableOpacity onPress={() => router.back()} className="mr-3 w-9 h-9 rounded-full bg-pageBg border border-navy-border items-center justify-center">
            <Feather name="chevron-left" size={20} color="#1F2F3A" />
          </TouchableOpacity>
          <Text className="text-2xl font-sansBold text-navy">Maintenance</Text>
        </View>
        <View className="flex-row gap-2">
          {(['open', 'all'] as const).map((f) => (
            <TouchableOpacity
              key={f}
              onPress={() => setFilter(f)}
              className="px-4 py-2 rounded-full"
              style={{ backgroundColor: filter === f ? '#1F2F3A' : '#F7F5F2', borderWidth: 1, borderColor: filter === f ? '#1F2F3A' : '#D8D2C8' }}
            >
              <Text className="font-sansBold text-[13px]" style={{ color: filter === f ? '#FFFFFF' : '#333333' }}>
                {f === 'open' ? 'Open' : 'All'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center"><ActivityIndicator color="#1F2F3A" /></View>
      ) : loadError ? (
        <View className="flex-1 justify-center items-center px-8">
          <Feather name="wifi-off" size={26} color="#8B2030" />
          <Text className="text-navy font-sansBold text-lg mt-4 mb-1 text-center">Couldn&apos;t load requests</Text>
          <Text className="text-navy-muted font-sans text-center mb-6">Check your connection and try again.</Text>
          <TouchableOpacity onPress={() => { setLoading(true); fetchRequests(); }} className="bg-navy px-6 py-4 rounded-2xl">
            <Text className="text-white font-sansBold">Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 24 }}>
          {visible.length === 0 ? (
            <View className="bg-card rounded-2xl p-10 items-center border border-navy-border">
              <Text className="text-navy-muted font-sans text-center">
                {filter === 'open' ? 'No open requests.' : 'No requests yet.'}
              </Text>
            </View>
          ) : (
            visible.map((r) => {
              const sc = STATUS_COLORS[r.status] ?? STATUS_COLORS.open;
              const tenantName = `${r.tenants?.first_name ?? ''} ${r.tenants?.last_name ?? ''}`.trim() || 'Resident';
              const unitLabel = r.units?.unit_number
                ? `${r.units.properties?.name ?? r.units.properties?.address ?? ''} · Unit ${r.units.unit_number}`
                : r.units?.properties?.name ?? r.units?.properties?.address ?? '';
              const isOpen = expanded === r.id;
              const nextStatus = STATUS_ORDER[STATUS_ORDER.indexOf(r.status) + 1];

              return (
                <TouchableOpacity
                  key={r.id}
                  onPress={() => setExpanded(isOpen ? null : r.id)}
                  className="bg-card rounded-2xl p-5 mb-4 border border-navy-border shadow-sm"
                >
                  <View className="flex-row items-start justify-between mb-2">
                    <View className="flex-1 pr-3">
                      <Text className="text-navy font-sansBold text-[16px]">{r.title}</Text>
                      <Text className="text-navy-muted font-sans text-[13px] mt-1">{tenantName}{unitLabel ? ` · ${unitLabel}` : ''}</Text>
                    </View>
                    <View className="px-3 py-1.5 rounded-full" style={{ backgroundColor: sc.bg }}>
                      <Text className="font-sansBold text-[11px]" style={{ color: sc.text }}>{STATUS_LABELS[r.status] ?? r.status}</Text>
                    </View>
                  </View>

                  {r.priority && (
                    <Text className="font-sansBold text-[12px] mt-1" style={{ color: PRIORITY_COLORS[r.priority] ?? '#64748b' }}>
                      {r.priority.toUpperCase()} PRIORITY
                    </Text>
                  )}

                  {isOpen && (
                    <View className="mt-4 pt-4 border-t border-navy-border">
                      {!!r.description && (
                        <Text className="text-navy font-sans text-[14px] leading-relaxed mb-4">{r.description}</Text>
                      )}
                      <Text className="text-navy-muted font-sans text-[12px] mb-4">
                        Reported {new Date(r.created_at).toLocaleDateString()}
                      </Text>

                      <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Priority</Text>
                      <View className="flex-row gap-2 mb-4 flex-wrap">
                        {PRIORITIES.map((p) => (
                          <TouchableOpacity
                            key={p}
                            onPress={() => updateRequest(r.id, { priority: p })}
                            className="px-3 py-1.5 rounded-full border"
                            style={{ borderColor: r.priority === p ? PRIORITY_COLORS[p] : '#D8D2C8', backgroundColor: r.priority === p ? PRIORITY_COLORS[p] : 'transparent' }}
                          >
                            <Text className="font-sansBold text-[12px]" style={{ color: r.priority === p ? '#FFFFFF' : '#333333' }}>
                              {p.charAt(0).toUpperCase() + p.slice(1)}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      <View className="flex-row gap-3">
                        {nextStatus && (
                          <TouchableOpacity
                            onPress={() => updateRequest(r.id, { status: nextStatus })}
                            className="flex-1 bg-navy py-3 rounded-xl items-center"
                          >
                            <Text className="text-white font-sansBold text-[14px]">
                              Mark {STATUS_LABELS[nextStatus]}
                            </Text>
                          </TouchableOpacity>
                        )}
                        {r.status !== 'closed' && (
                          <TouchableOpacity
                            onPress={() => updateRequest(r.id, { status: 'closed' })}
                            className="px-4 py-3 rounded-xl items-center border border-navy-border"
                          >
                            <Text className="text-navy-muted font-sansBold text-[14px]">Close</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}
