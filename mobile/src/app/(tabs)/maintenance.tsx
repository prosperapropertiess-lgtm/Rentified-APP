import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
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

interface OccupiedUnitOption {
  id: string;
  unit_number: string | null;
  properties: { name: string | null; address: string | null } | null;
  tenantId: string;
  tenantName: string;
}

export default function MaintenanceScreen() {
  const { profileId } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const [loadError, setLoadError] = useState(false);

  const [showAddItem, setShowAddItem] = useState(false);
  const [occupiedUnits, setOccupiedUnits] = useState<OccupiedUnitOption[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState('medium');
  const [savingItem, setSavingItem] = useState(false);

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

  // Only occupied units have a tenant to attach the item to — tenant_id is
  // NOT NULL on maintenance_requests, so an owner-added item on a vacant
  // unit isn't possible without a schema change. Not attempted here; the
  // real ask (owner adds an item the current resident can also see) is
  // fully covered by occupied units, which is the case that matters.
  const fetchOccupiedUnits = useCallback(async () => {
    if (!profileId) return;
    const { data } = await supabase
      .from('units')
      .select(`
        id, unit_number,
        properties!inner ( name, address, landlord_id ),
        leases ( tenant_id, status, tenants ( first_name, last_name ) )
      `)
      .eq('properties.landlord_id', profileId)
      .eq('status', 'occupied');

    const options: OccupiedUnitOption[] = [];
    for (const u of (data ?? []) as any[]) {
      const activeLease = (u.leases ?? []).find((l: any) => l.status === 'active');
      if (!activeLease) continue;
      options.push({
        id: u.id,
        unit_number: u.unit_number,
        properties: u.properties,
        tenantId: activeLease.tenant_id,
        tenantName: `${activeLease.tenants?.first_name ?? ''} ${activeLease.tenants?.last_name ?? ''}`.trim() || 'Resident',
      });
    }
    setOccupiedUnits(options);
  }, [profileId]);

  function openAddItem() {
    setNewTitle(''); setNewDescription(''); setNewPriority('medium'); setSelectedUnitId(null);
    fetchOccupiedUnits();
    setShowAddItem(true);
  }

  async function addOwnerItem() {
    const unit = occupiedUnits.find((u) => u.id === selectedUnitId);
    if (!unit || !newTitle.trim() || !profileId) return;
    setSavingItem(true);
    const { error } = await supabase.from('maintenance_requests').insert({
      unit_id: unit.id,
      tenant_id: unit.tenantId,
      landlord_id: profileId,
      title: newTitle.trim(),
      description: newDescription.trim() || null,
      priority: newPriority,
      status: 'open',
    });
    setSavingItem(false);
    if (error) {
      Alert.alert('Could not add item', error.message);
      return;
    }
    setShowAddItem(false);
    fetchRequests();
  }

  async function updateRequest(id: string, updates: Record<string, string>) {
    const { error } = await supabase.from('maintenance_requests').update(updates).eq('id', id);
    if (error) {
      Alert.alert('Could not update', error.message);
      return;
    }
    fetchRequests();
  }

  // Resolved/closed items disappear from the default "Open" filter the
  // instant they're set, with no visible way back unless you already know
  // to switch to "All" — confirm before either one so a mis-tap doesn't
  // feel like the request vanished.
  function confirmSetStatus(id: string, status: string, label: string) {
    Alert.alert(`Mark ${label}?`, `This will disappear from the Open list. You can find it again under "All" and reopen it.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: label, style: status === 'closed' ? 'destructive' : 'default', onPress: () => updateRequest(id, { status }) },
    ]);
  }

  const visible = filter === 'open' ? requests.filter((r) => !['resolved', 'closed'].includes(r.status)) : requests;

  return (
    <View className="flex-1 bg-pageBg">
      <View className="pt-16 px-6 pb-6 bg-card border-b border-navy-border">
        <View className="flex-row items-center mb-5">
          <TouchableOpacity onPress={() => router.back()} className="mr-3 w-9 h-9 rounded-full bg-pageBg border border-navy-border items-center justify-center">
            <Feather name="chevron-left" size={20} color="#1F2F3A" />
          </TouchableOpacity>
          <Text className="text-2xl font-sansBold text-navy flex-1">Maintenance</Text>
          <TouchableOpacity onPress={openAddItem} className="flex-row items-center gap-1.5 bg-navy px-3.5 py-2 rounded-full">
            <Feather name="plus" size={14} color="#FFFFFF" />
            <Text className="text-white font-sansBold text-[13px]">Add Item</Text>
          </TouchableOpacity>
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
                        {['resolved', 'closed'].includes(r.status) ? (
                          <TouchableOpacity
                            onPress={() => updateRequest(r.id, { status: 'open' })}
                            className="flex-1 bg-navy py-3 rounded-xl items-center"
                          >
                            <Text className="text-white font-sansBold text-[14px]">Reopen</Text>
                          </TouchableOpacity>
                        ) : (
                          <>
                            {nextStatus && (
                              <TouchableOpacity
                                onPress={() => confirmSetStatus(r.id, nextStatus, STATUS_LABELS[nextStatus])}
                                className="flex-1 bg-navy py-3 rounded-xl items-center"
                              >
                                <Text className="text-white font-sansBold text-[14px]">
                                  Mark {STATUS_LABELS[nextStatus]}
                                </Text>
                              </TouchableOpacity>
                            )}
                            <TouchableOpacity
                              onPress={() => confirmSetStatus(r.id, 'closed', 'Closed')}
                              className="px-4 py-3 rounded-xl items-center border border-navy-border"
                            >
                              <Text className="text-navy-muted font-sansBold text-[14px]">Close</Text>
                            </TouchableOpacity>
                          </>
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

      <Modal visible={showAddItem} animationType="slide" transparent onRequestClose={() => setShowAddItem(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 justify-end">
          <View className="bg-card rounded-t-[28px] p-6" style={{ maxHeight: '85%' }}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text className="text-navy font-sansBold text-[19px] mb-1">Add Maintenance Item</Text>
              <Text className="text-navy-muted font-sans text-[13px] mb-5">
                Visible to the resident on that unit, same as anything they&apos;d report themselves — good for a heads-up or a reminder you want tracked.
              </Text>

              <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Unit</Text>
              {occupiedUnits.length === 0 ? (
                <Text className="text-navy-muted font-sans text-[13px] mb-4">No occupied units found.</Text>
              ) : (
                <View className="gap-2 mb-4">
                  {occupiedUnits.map((u) => {
                    const label = `${u.properties?.name ?? u.properties?.address ?? ''}${u.unit_number ? ` · Unit ${u.unit_number}` : ''}`;
                    const selected = selectedUnitId === u.id;
                    return (
                      <TouchableOpacity
                        key={u.id}
                        onPress={() => setSelectedUnitId(u.id)}
                        className="px-4 py-3 rounded-xl border"
                        style={{ borderColor: selected ? '#1F2F3A' : '#D8D2C8', backgroundColor: selected ? '#1F2F3A' : 'transparent' }}
                      >
                        <Text className="font-sansBold text-[13px]" style={{ color: selected ? '#FFFFFF' : '#1F2F3A' }}>{label}</Text>
                        <Text className="font-sans text-[12px] mt-0.5" style={{ color: selected ? 'rgba(255,255,255,0.7)' : '#333333' }}>{u.tenantName}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Title</Text>
              <TextInput
                className="bg-pageBg border border-navy-border rounded-xl p-4 font-sans text-navy mb-4"
                placeholder="e.g. Furnace filter replacement"
                placeholderTextColor="#94a3b8"
                value={newTitle}
                onChangeText={setNewTitle}
              />

              <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Description (optional)</Text>
              <TextInput
                className="bg-pageBg border border-navy-border rounded-xl p-4 font-sans text-navy mb-4"
                placeholder="Any details worth noting"
                placeholderTextColor="#94a3b8"
                value={newDescription}
                onChangeText={setNewDescription}
                multiline
              />

              <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Priority</Text>
              <View className="flex-row gap-2 mb-6 flex-wrap">
                {PRIORITIES.map((p) => (
                  <TouchableOpacity
                    key={p}
                    onPress={() => setNewPriority(p)}
                    className="px-3 py-1.5 rounded-full border"
                    style={{ borderColor: newPriority === p ? PRIORITY_COLORS[p] : '#D8D2C8', backgroundColor: newPriority === p ? PRIORITY_COLORS[p] : 'transparent' }}
                  >
                    <Text className="font-sansBold text-[12px]" style={{ color: newPriority === p ? '#FFFFFF' : '#333333' }}>
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View className="flex-row gap-3 mb-2">
                <TouchableOpacity onPress={() => setShowAddItem(false)} className="flex-1 py-4 rounded-xl items-center border border-navy-border">
                  <Text className="text-navy-muted font-sansBold text-[15px]">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={addOwnerItem}
                  disabled={savingItem || !selectedUnitId || !newTitle.trim()}
                  className="flex-1 bg-navy py-4 rounded-xl items-center"
                  style={{ opacity: !selectedUnitId || !newTitle.trim() ? 0.5 : 1 }}
                >
                  <Text className="text-white font-sansBold text-[15px]">{savingItem ? 'Saving...' : 'Add Item'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
