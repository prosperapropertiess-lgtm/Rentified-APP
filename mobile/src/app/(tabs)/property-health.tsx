import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { money } from '../../lib/format';

// Spec B Module 2 — Property Health as an explainable operational view, not
// a fake single number. Every subscore and "needs attention" line traces to
// a real row somewhere (maintenance_requests, assets, property_improvements,
// leases) — nothing here is invented. Domains this app can honestly score
// today: Maintenance (open requests) and Preventive Service (asset service
// intervals). Occupancy and Improvements are shown as informational context,
// not scored — there's no honest basis for "vacancy = unhealthy" (a unit
// can be intentionally vacant), so faking a penalty there would violate the
// spec's own "do not create a fake scientific score" instruction.

interface TenantRef { first_name: string | null; last_name: string | null }
interface LeaseRow { id: string; status: string; start_date: string | null; end_date: string | null; rent_amount: number | null; tenants: TenantRef | null }
interface RequestRow { id: string; title: string; status: string; priority: string | null; created_at: string; updated_at: string }
interface UnitRow { id: string; unit_number: string | null; leases: LeaseRow[]; maintenance_requests: RequestRow[] }
interface PropertyRow { id: string; name: string | null; address: string | null; units: UnitRow[] }
interface AssetRow { id: string; category: string; make: string | null; model: string | null; status: string; installed_date: string | null; retired_at: string | null; last_service_date: string | null; next_service_date: string | null; warranty_expires: string | null }
interface ServiceEventRow { id: string; asset_id: string; service_date: string; description: string; vendor: string | null; cost: number | null }
interface ImprovementRow { id: string; title: string; description: string | null; start_date: string | null; completion_date: string | null; cost: number | null; contractor: string | null }

interface TimelineItem {
  id: string;
  date: string;
  type: 'Maintenance' | 'Tenancies' | 'Appliances' | 'Improvements';
  title: string;
  subtitle?: string;
}

const FILTERS = ['All', 'Maintenance', 'Tenancies', 'Appliances', 'Improvements'] as const;

function daysBetween(a: Date, b: Date) {
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

export default function PropertyHealthScreen() {
  const { profileId } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [serviceEvents, setServiceEvents] = useState<ServiceEventRow[]>([]);
  const [improvements, setImprovements] = useState<ImprovementRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');

  const fetchData = useCallback(async () => {
    if (!profileId) return;
    const { data: propData } = await supabase
      .from('properties')
      .select(`
        id, name, address,
        units ( id, unit_number,
          leases ( id, status, start_date, end_date, rent_amount, tenants ( first_name, last_name ) ),
          maintenance_requests ( id, title, status, priority, created_at, updated_at )
        )
      `)
      .eq('landlord_id', profileId);

    const props = (propData || []) as unknown as PropertyRow[];
    setProperties(props);
    setSelectedId((prev) => prev ?? props[0]?.id ?? null);

    const propertyIds = props.map((p) => p.id);
    const { data: assetData } = propertyIds.length
      ? await supabase.from('assets').select('id, property_id, category, make, model, status, installed_date, retired_at, last_service_date, next_service_date, warranty_expires').eq('landlord_id', profileId)
      : { data: [] as any[] };
    setAssets((assetData || []) as unknown as AssetRow[]);

    const assetIds = (assetData || []).map((a: any) => a.id);
    const { data: eventData } = assetIds.length
      ? await supabase.from('asset_service_events').select('id, asset_id, service_date, description, vendor, cost').in('asset_id', assetIds).order('service_date', { ascending: false })
      : { data: [] as any[] };
    setServiceEvents((eventData || []) as unknown as ServiceEventRow[]);

    const { data: improvementData } = await supabase
      .from('property_improvements')
      .select('id, property_id, title, description, start_date, completion_date, cost, contractor')
      .eq('landlord_id', profileId);
    setImprovements((improvementData || []) as unknown as ImprovementRow[]);

    setLoading(false);
    setRefreshing(false);
  }, [profileId]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  if (loading) return <View className="flex-1 bg-pageBg justify-center items-center"><ActivityIndicator color="#1F2F3A" /></View>;

  const active = properties.find((p) => p.id === selectedId) ?? properties[0] ?? null;
  const activeAssets = active ? assets.filter((a: any) => (a as any).property_id === active.id) : [];
  const activeAssetIds = new Set(activeAssets.map((a) => a.id));
  const activeServiceEvents = serviceEvents.filter((e) => activeAssetIds.has(e.asset_id));
  const activeImprovements = active ? improvements.filter((i: any) => (i as any).property_id === active.id) : [];
  const activeRequests = active ? active.units.flatMap((u) => u.maintenance_requests ?? []) : [];
  const activeLeases = active ? active.units.flatMap((u) => (u.leases ?? []).map((l) => ({ ...l, unit_number: u.unit_number }))) : [];

  const today = new Date();
  const openRequests = activeRequests.filter((r) => !['resolved', 'closed'].includes(r.status));
  const urgentOpen = openRequests.filter((r) => r.priority === 'urgent' || r.priority === 'high');
  const oldestOpenDays = openRequests.length
    ? Math.max(...openRequests.map((r) => daysBetween(today, new Date(r.created_at))))
    : 0;

  const activeAssetsOnly = activeAssets.filter((a) => a.status === 'active');
  const overdueAssets = activeAssetsOnly.filter((a) => a.next_service_date && new Date(a.next_service_date) < today);
  const dueSoonAssets = activeAssetsOnly.filter((a) => a.next_service_date && !overdueAssets.includes(a) && daysBetween(new Date(a.next_service_date), today) >= -30);
  const expiringWarranties = activeAssetsOnly.filter((a) => a.warranty_expires && daysBetween(new Date(a.warranty_expires), today) >= -30 && daysBetween(new Date(a.warranty_expires), today) <= 0);

  let score = 100;
  score -= urgentOpen.length * 15;
  score -= (openRequests.length - urgentOpen.length) * 8;
  score -= overdueAssets.length * 10;
  score -= dueSoonAssets.length * 4;
  score = Math.max(0, Math.min(100, score));

  const meta = score >= 85
    ? { color: '#059669', bg: 'rgba(5,150,105,0.1)', border: 'rgba(5,150,105,0.3)', label: 'Excellent' }
    : score >= 60
    ? { color: '#D97706', bg: 'rgba(217,119,6,0.1)', border: 'rgba(217,119,6,0.3)', label: 'Needs Attention' }
    : { color: '#DC2626', bg: 'rgba(220,38,38,0.1)', border: 'rgba(220,38,38,0.3)', label: 'Critical' };

  const needsAttention: { title: string; subtitle: string; action?: () => void; actionLabel?: string }[] = [];
  urgentOpen.forEach((r) => needsAttention.push({
    title: `${r.priority === 'urgent' ? 'Urgent' : 'High priority'} maintenance: ${r.title}`,
    subtitle: `Reported ${new Date(r.created_at).toLocaleDateString()}`,
    action: () => router.push('/maintenance'),
    actionLabel: 'View',
  }));
  overdueAssets.forEach((a) => needsAttention.push({
    title: `${labelAsset(a)} service overdue`,
    subtitle: a.last_service_date ? `Last serviced: ${new Date(a.last_service_date).toLocaleDateString()}` : 'No service on record',
    action: () => router.push(`/assets/${a.id}`),
    actionLabel: 'Record Service',
  }));
  dueSoonAssets.forEach((a) => needsAttention.push({
    title: `${labelAsset(a)} service due soon`,
    subtitle: `Next service: ${new Date(a.next_service_date!).toLocaleDateString()}`,
    action: () => router.push(`/assets/${a.id}`),
    actionLabel: 'View',
  }));
  expiringWarranties.forEach((a) => needsAttention.push({
    title: `${labelAsset(a)} warranty expiring`,
    subtitle: `Expires ${new Date(a.warranty_expires!).toLocaleDateString()}`,
    action: () => router.push(`/assets/${a.id}`),
    actionLabel: 'View Asset',
  }));
  if (oldestOpenDays > 14 && openRequests.length > 0) {
    needsAttention.push({ title: 'A maintenance request has been open 2+ weeks', subtitle: `Oldest open request: ${oldestOpenDays} days`, action: () => router.push('/maintenance'), actionLabel: 'View' });
  }

  const healthy: string[] = [];
  if (urgentOpen.length === 0) healthy.push('No urgent or high-priority maintenance open');
  if (overdueAssets.length === 0 && activeAssetsOnly.length > 0) healthy.push('All tracked appliances are within their service interval');
  if (activeLeases.some((l) => l.status === 'active')) healthy.push(`${activeLeases.filter((l) => l.status === 'active').length} active tenancy${activeLeases.filter((l) => l.status === 'active').length === 1 ? '' : 'ies'} on file`);
  if (activeImprovements.length > 0) healthy.push(`${activeImprovements.length} capital improvement${activeImprovements.length === 1 ? '' : 's'} recorded`);

  // Life history — generated from real records, not a separately
  // maintained log (spec 2.4): tenancy events from leases, maintenance
  // events from maintenance_requests, appliance events from assets +
  // asset_service_events, improvements from property_improvements.
  const timeline: TimelineItem[] = [];
  activeLeases.forEach((l) => {
    const tenantName = `${l.tenants?.first_name ?? ''} ${l.tenants?.last_name ?? ''}`.trim() || 'Resident';
    if (l.start_date) timeline.push({ id: `${l.id}-start`, date: l.start_date, type: 'Tenancies', title: `New tenancy — ${tenantName}`, subtitle: `Unit ${l.unit_number ?? ''} · $${money(l.rent_amount ?? 0)}/mo` });
    if (l.status !== 'active' && l.end_date) timeline.push({ id: `${l.id}-end`, date: l.end_date, type: 'Tenancies', title: `Tenancy ended — ${tenantName}`, subtitle: `Unit ${l.unit_number ?? ''}` });
  });
  activeRequests.forEach((r) => {
    timeline.push({ id: `${r.id}-created`, date: r.created_at, type: 'Maintenance', title: r.title, subtitle: 'Request reported' });
    if (['resolved', 'closed'].includes(r.status) && r.updated_at !== r.created_at) {
      timeline.push({ id: `${r.id}-resolved`, date: r.updated_at, type: 'Maintenance', title: `${r.title} — marked ${r.status}`, subtitle: undefined });
    }
  });
  activeAssets.forEach((a) => {
    if (a.installed_date) timeline.push({ id: `${a.id}-installed`, date: a.installed_date, type: 'Appliances', title: `${labelAsset(a)} installed`, subtitle: undefined });
    if (a.retired_at) timeline.push({ id: `${a.id}-retired`, date: a.retired_at, type: 'Appliances', title: `${labelAsset(a)} retired`, subtitle: undefined });
  });
  activeServiceEvents.forEach((e) => {
    const asset = activeAssets.find((a) => a.id === e.asset_id);
    timeline.push({ id: `${e.id}`, date: e.service_date, type: 'Appliances', title: `${asset ? labelAsset(asset) + ' — ' : ''}${e.description}`, subtitle: e.cost ? `$${money(e.cost)}${e.vendor ? ` · ${e.vendor}` : ''}` : (e.vendor ?? undefined) });
  });
  activeImprovements.forEach((i) => {
    const done = !!i.completion_date;
    timeline.push({ id: i.id, date: i.completion_date ?? i.start_date ?? new Date().toISOString(), type: 'Improvements', title: `${i.title}${done ? '' : ' (in progress)'}`, subtitle: i.cost ? `$${money(i.cost)}${i.contractor ? ` · ${i.contractor}` : ''}` : (i.contractor ?? undefined) });
  });

  const sortedTimeline = [...timeline]
    .filter((t) => filter === 'All' || t.type === filter)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <View className="flex-1 bg-pageBg">
      <View className="pt-16 px-6 pb-6 bg-card border-b border-navy-border">
        <Text className="text-2xl font-sansBold text-navy">Property Health</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 24, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0F1C28" />}
      >
        {properties.length === 0 ? (
          <View className="bg-card rounded-2xl p-8 items-center border border-navy-border">
            <Text className="text-navy-muted font-sans text-center">No properties yet.</Text>
          </View>
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-5" contentContainerStyle={{ gap: 8 }}>
              {properties.map((p) => {
                const isSelected = p.id === active?.id;
                return (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => setSelectedId(p.id)}
                    className="px-4 py-2.5 rounded-full border"
                    style={{ borderColor: isSelected ? '#1F2F3A' : '#D8D2C8', backgroundColor: isSelected ? '#1F2F3A' : '#FFFFFF' }}
                  >
                    <Text className="font-sansBold text-[13px]" style={{ color: isSelected ? '#FFFFFF' : '#333333' }}>
                      {p.name || p.address}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {active && (
              <>
                <View className="bg-navy rounded-[28px] p-6 mb-6">
                  <Text className="text-white/60 font-sans text-[11px] uppercase tracking-[0.12em] mb-1">{active.name || active.address}</Text>
                  <View className="flex-row items-baseline justify-between">
                    <View className="flex-row items-baseline">
                      <Text className="text-white font-sansBold text-[48px]">{score}</Text>
                      <Text className="text-white/50 text-[18px] ml-1">/100</Text>
                    </View>
                    <View className="px-3 py-1.5 rounded-full border" style={{ backgroundColor: meta.bg, borderColor: meta.border }}>
                      <Text className="font-sansBold text-[11px] uppercase" style={{ color: meta.color }}>{meta.label}</Text>
                    </View>
                  </View>
                  <View className="h-2.5 bg-white/10 rounded-full overflow-hidden mt-4 mb-4">
                    <View className="h-full rounded-full" style={{ width: `${score}%`, backgroundColor: meta.color }} />
                  </View>
                  <Text className="text-white/70 font-sans text-[13px]">Based on open maintenance and appliance service intervals.</Text>
                </View>

                <View className="flex-row gap-3 mb-6">
                  <TouchableOpacity onPress={() => router.push({ pathname: '/assets', params: { propertyId: active.id } } as any)} className="flex-1 bg-card border border-navy-border rounded-xl p-3.5 items-center">
                    <Feather name="box" size={18} color="#1F2F3A" style={{ marginBottom: 4 }} />
                    <Text className="text-navy font-sansBold text-[12px]">Appliances ({activeAssets.length})</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => router.push({ pathname: '/improvements', params: { propertyId: active.id } } as any)} className="flex-1 bg-card border border-navy-border rounded-xl p-3.5 items-center">
                    <Feather name="trending-up" size={18} color="#1F2F3A" style={{ marginBottom: 4 }} />
                    <Text className="text-navy font-sansBold text-[12px]">Improvements ({activeImprovements.length})</Text>
                  </TouchableOpacity>
                </View>

                {needsAttention.length > 0 && (
                  <View className="mb-6">
                    <Text className="text-navy font-sansBold text-[18px] mb-3">{needsAttention.length} Thing{needsAttention.length === 1 ? '' : 's'} Need{needsAttention.length === 1 ? 's' : ''} Attention</Text>
                    {needsAttention.map((item, i) => (
                      <View key={i} className="bg-card rounded-2xl p-4 border border-amber-300 mb-3">
                        <Text className="text-navy font-sansBold text-[14px] mb-1">{item.title}</Text>
                        <Text className="text-navy-muted font-sans text-[12px] mb-2">{item.subtitle}</Text>
                        {item.action && (
                          <TouchableOpacity onPress={item.action} className="self-start px-3 py-1.5 rounded-full bg-navy">
                            <Text className="text-white font-sansBold text-[11px]">{item.actionLabel}</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}
                  </View>
                )}

                {healthy.length > 0 && (
                  <View className="bg-card rounded-2xl p-4 border border-navy-border mb-6">
                    <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-3">Healthy</Text>
                    {healthy.map((h, i) => (
                      <View key={i} className="flex-row items-center mb-2">
                        <MaterialIcons name="check-circle" size={16} color="#059669" style={{ marginRight: 8 }} />
                        <Text className="text-navy font-sans text-[13px] flex-1">{h}</Text>
                      </View>
                    ))}
                  </View>
                )}

                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-navy font-sansBold text-[18px]">Property History</Text>
                  <TouchableOpacity onPress={() => router.push('/maintenance')} className="flex-row items-center">
                    <Text className="text-navy-muted font-sansBold text-[13px] mr-1">Maintenance</Text>
                    <Feather name="chevron-right" size={16} color="#1F2F3A" style={{ opacity: 0.5 }} />
                  </TouchableOpacity>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4" contentContainerStyle={{ gap: 8 }}>
                  {FILTERS.map((f) => (
                    <TouchableOpacity
                      key={f}
                      onPress={() => setFilter(f)}
                      className="px-3.5 py-2 rounded-full border"
                      style={{ borderColor: filter === f ? '#1F2F3A' : '#D8D2C8', backgroundColor: filter === f ? '#1F2F3A' : '#FFFFFF' }}
                    >
                      <Text className="font-sansBold text-[12px]" style={{ color: filter === f ? '#FFFFFF' : '#333333' }}>{f}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {sortedTimeline.length === 0 ? (
                  <View className="bg-card rounded-2xl p-8 items-center border border-navy-border">
                    <MaterialIcons name="history" size={28} color="#94A3B8" />
                    <Text className="text-navy-muted font-sans text-center mt-2">No history yet for this filter.</Text>
                  </View>
                ) : (
                  sortedTimeline.slice(0, 30).map((t) => (
                    <View key={t.id} className="bg-card rounded-2xl p-4 mb-3 border border-navy-border">
                      <View className="flex-row items-center justify-between mb-1">
                        <Text className="text-navy-muted font-sansBold text-[10px] uppercase tracking-wide">{new Date(t.date).toLocaleDateString()} · {t.type}</Text>
                      </View>
                      <Text className="text-navy font-sansBold text-[14px]">{t.title}</Text>
                      {t.subtitle && <Text className="text-navy-muted font-sans text-[12px] mt-0.5">{t.subtitle}</Text>}
                    </View>
                  ))
                )}
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function labelAsset(a: { category: string; make: string | null; model: string | null }) {
  const brand = [a.make, a.model].filter(Boolean).join(' ');
  return brand ? `${a.category} (${brand})` : a.category;
}
