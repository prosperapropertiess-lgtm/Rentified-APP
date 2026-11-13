import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { money, monthDay } from '../../../lib/format';
import { useSignedUrls } from '../../../lib/media';
import ScreenHeader from '../../../components/ScreenHeader';
import Segmented from '../../../components/ui/Segmented';
import { Ring, GrowBar } from '../../../components/ui/Charts';
import { type Project, type Stage, progress, currentStage, phaseLabel, STATUS_LABEL, PRIORITY_COLOR } from '../../../lib/projects';

type Row = Project & {
  project_stages: Stage[];
  project_action_items: { status: string }[];
  project_costs: { amount: number; kind: string }[];
};
interface AssetRow { id: string; category: string | null; make: string | null; model: string | null; next_service_date: string | null; last_service_date: string | null; properties: { name: string | null; address: string | null } | null }
interface TicketRow { id: string; title: string; priority: string | null; status: string; created_at: string; units: { unit_number: string | null; properties: { name: string | null; address: string | null } | null } | null }

const daysUntil = (d: string) => Math.round((new Date(d).getTime() - Date.now()) / 86400000);
const TICKET_STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  open: { label: 'Open', bg: '#FEF3C7', fg: '#92400E' },
  in_progress: { label: 'In progress', bg: '#DBEAFE', fg: '#1E40AF' },
  scheduled: { label: 'Scheduled', bg: '#EDE9FE', fg: '#5B21B6' },
  resolved: { label: 'Resolved', bg: '#D1FAE5', fg: '#065F46' },
  closed: { label: 'Closed', bg: '#F3F4F6', fg: '#6B7280' },
};

export default function MaintenanceHub() {
  const { profileId, isManager } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<'projects' | 'routine' | 'tickets'>((params.tab as any) || 'projects');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [projects, setProjects] = useState<Row[]>([]);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [showDone, setShowDone] = useState(false);

  const load = useCallback(async () => {
    if (!profileId) return;
    // Managers see every owner's projects (row-level security decides); owners see their own.
    let pq = supabase
      .from('maintenance_projects')
      .select('*, properties ( name, address ), landlords ( first_name, last_name ), project_stages ( * ), project_action_items ( status ), project_costs ( amount, kind )')
      .order('updated_at', { ascending: false });
    if (!isManager) pq = pq.eq('landlord_id', profileId);
    const [{ data: p }, { data: a }, { data: t }] = await Promise.all([
      pq,
      supabase.from('assets').select('id, category, make, model, next_service_date, last_service_date, properties ( name, address )').eq('landlord_id', profileId).neq('status', 'retired').order('next_service_date', { ascending: true, nullsFirst: false }),
      supabase.from('maintenance_requests').select('id, title, priority, status, created_at, units ( unit_number, properties ( name, address ) )').eq('landlord_id', profileId).order('created_at', { ascending: false }).limit(40),
    ]);
    setProjects((p ?? []) as unknown as Row[]);
    setAssets((a ?? []) as unknown as AssetRow[]);
    setTickets((t ?? []) as unknown as TicketRow[]);
    setLoading(false);
    setRefreshing(false);
  }, [profileId, isManager]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const active = projects.filter((p) => p.status === 'active' || p.status === 'on_hold');
  const done = projects.filter((p) => p.status === 'completed' || p.status === 'cancelled');
  const ownerTodos = active.reduce((s, p) => s + p.project_action_items.filter((a) => a.status === 'open').length, 0);
  const avgProgress = active.length ? active.reduce((s, p) => s + progress(p.project_stages), 0) / active.length / 100 : 0;
  const spent = active.reduce((s, p) => s + p.project_costs.filter((c) => c.kind === 'actual').reduce((x, c) => x + Number(c.amount), 0), 0);
  const openTickets = tickets.filter((t) => t.status !== 'resolved' && t.status !== 'closed');
  const dueAssets = assets.filter((a) => a.next_service_date && daysUntil(a.next_service_date) <= 30);
  const covers = useSignedUrls(projects.map((p) => p.cover_photo).filter(Boolean) as string[]);

  return (
    <View className="flex-1 bg-pageBg">
      <ScreenHeader
        title="Maintenance"
        subtitle="Projects, routine upkeep and repair tickets"
        right={tab === 'projects' ? (
          <TouchableOpacity onPress={() => router.push('/project-editor')} className="h-11 px-4 bg-navy rounded-full flex-row items-center">
            <Feather name="plus" size={16} color="#FFFFFF" />
            <Text className="text-white font-sansBold text-[13px] ml-1.5">Project</Text>
          </TouchableOpacity>
        ) : tab === 'routine' ? (
          <TouchableOpacity onPress={() => router.push('/assets/new' as any)} className="h-11 px-4 bg-navy rounded-full flex-row items-center">
            <Feather name="plus" size={16} color="#FFFFFF" />
            <Text className="text-white font-sansBold text-[13px] ml-1.5">Equipment</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => router.push('/maintenance')} className="h-11 px-4 bg-card border border-navy/10 rounded-full flex-row items-center">
            <Text className="text-navy font-sansBold text-[13px]">Manage tickets</Text>
          </TouchableOpacity>
        )}
      />
      <View className="px-6 mb-3">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'projects', label: 'Projects', count: active.length },
            { value: 'routine', label: 'Routine', count: dueAssets.length },
            { value: 'tickets', label: 'Tickets', count: openTickets.length },
          ]}
        />
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator color="#1F2F3A" /></View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        >
          {tab === 'projects' && (
            <>
              <View className="bg-navy rounded-[28px] p-5 mb-5 flex-row items-center">
                <Ring value={avgProgress} size={104} stroke={10} color="#E8B4BC" track="rgba(255,255,255,0.12)">
                  <Text className="text-white font-sansBold text-[22px]">{Math.round(avgProgress * 100)}%</Text>
                  <Text className="text-white/50 font-sans text-[9px] uppercase tracking-widest">avg done</Text>
                </Ring>
                <View className="flex-1 ml-5 gap-3">
                  <View className="flex-row gap-5">
                    <View>
                      <Text className="text-white font-sansBold text-[22px]">{active.length}</Text>
                      <Text className="text-white/50 font-sans text-[11px]">active</Text>
                    </View>
                    <View>
                      <Text className="font-sansBold text-[22px]" style={{ color: ownerTodos ? '#F8C9D0' : '#FFFFFF' }}>{ownerTodos}</Text>
                      <Text className="text-white/50 font-sans text-[11px]">need you</Text>
                    </View>
                  </View>
                  <View>
                    <Text className="text-white font-sansBold text-[16px]">${money(spent).replace('.00', '')}</Text>
                    <Text className="text-white/50 font-sans text-[11px]">spent so far on active projects</Text>
                  </View>
                </View>
              </View>

              {active.length === 0 ? (
                <View className="bg-card rounded-[24px] p-8 items-center border border-navy/5 mb-5">
                  <View className="w-14 h-14 rounded-full bg-navy/5 items-center justify-center mb-3">
                    <Feather name="tool" size={22} color="#1F2F3A" />
                  </View>
                  <Text className="text-navy font-sansBold text-[16px] mb-1">No active projects</Text>
                  <Text className="text-navy-muted font-sans text-[13px] text-center opacity-70">Big jobs like a new deck, roof or renovation show up here, stage by stage.</Text>
                </View>
              ) : (
                active.map((p, i) => <ProjectCard key={p.id} p={p} cover={p.cover_photo ? covers[p.cover_photo] : undefined} showOwner={isManager} index={i} onPress={() => router.push(`/projects/${p.id}`)} />)
              )}

              {done.length > 0 && (
                <>
                  <TouchableOpacity onPress={() => setShowDone((v) => !v)} className="flex-row items-center justify-between py-3 mt-2">
                    <Text className="text-navy-muted font-sansBold text-[13px]">Past projects ({done.length})</Text>
                    <Feather name={showDone ? 'chevron-up' : 'chevron-down'} size={18} color="#1F2F3A" style={{ opacity: 0.4 }} />
                  </TouchableOpacity>
                  {showDone && done.map((p, i) => <ProjectCard key={p.id} p={p} cover={p.cover_photo ? covers[p.cover_photo] : undefined} showOwner={isManager} index={i} onPress={() => router.push(`/projects/${p.id}`)} />)}
                </>
              )}
            </>
          )}

          {tab === 'routine' && (
            <>
              <View className="flex-row gap-3 mb-5">
                {[
                  { n: assets.filter((a) => a.next_service_date && daysUntil(a.next_service_date) < 0).length, label: 'Overdue', color: '#8B2030' },
                  { n: assets.filter((a) => a.next_service_date && daysUntil(a.next_service_date) >= 0 && daysUntil(a.next_service_date) <= 30).length, label: 'Due in 30 days', color: '#B45309' },
                  { n: assets.length, label: 'Tracked', color: '#1F2F3A' },
                ].map((k) => (
                  <View key={k.label} className="flex-1 bg-card rounded-[20px] p-4 border border-navy/5 shadow-sm">
                    <Text className="font-sansBold text-[24px]" style={{ color: k.color }}>{k.n}</Text>
                    <Text className="text-navy-muted font-sans text-[11px]">{k.label}</Text>
                  </View>
                ))}
              </View>
              {assets.length === 0 ? (
                <View className="bg-card rounded-[24px] p-8 items-center border border-navy/5">
                  <Feather name="cpu" size={26} color="#1F2F3A" style={{ opacity: 0.25 }} />
                  <Text className="text-navy font-sansBold text-[16px] mt-3 mb-1">Nothing tracked yet</Text>
                  <Text className="text-navy-muted font-sans text-[13px] text-center opacity-70">Add a furnace, water heater or smoke alarms with how often they need service. We&apos;ll show what&apos;s coming up.</Text>
                </View>
              ) : (
                assets.map((a) => {
                  const d = a.next_service_date ? daysUntil(a.next_service_date) : null;
                  const color = d === null ? '#94A3B8' : d < 0 ? '#8B2030' : d <= 30 ? '#B45309' : '#0A7A52';
                  return (
                    <TouchableOpacity key={a.id} onPress={() => router.push(`/assets/${a.id}` as any)} className="bg-card rounded-[22px] p-4 mb-3 border border-navy/5 shadow-sm flex-row items-center">
                      <View className="w-11 h-11 rounded-2xl items-center justify-center mr-3" style={{ backgroundColor: `${color}14` }}>
                        <Feather name="settings" size={18} color={color} />
                      </View>
                      <View className="flex-1 pr-2">
                        <Text className="text-navy font-sansBold text-[15px]" numberOfLines={1}>{[a.category, a.make].filter(Boolean).join(' · ') || 'Equipment'}</Text>
                        <Text className="text-navy-muted font-sans text-[12px] opacity-70" numberOfLines={1}>{a.properties?.name || a.properties?.address || ''}{a.last_service_date ? ` · last done ${monthDay(a.last_service_date)}` : ''}</Text>
                      </View>
                      <View className="items-end">
                        <Text className="font-sansBold text-[13px]" style={{ color }}>
                          {d === null ? 'No schedule' : d < 0 ? `${-d} days late` : d === 0 ? 'Today' : `in ${d} days`}
                        </Text>
                        {a.next_service_date && <Text className="text-navy-muted font-sans text-[11px] opacity-60">{monthDay(a.next_service_date)}</Text>}
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </>
          )}

          {tab === 'tickets' && (
            <>
              {tickets.length === 0 ? (
                <View className="bg-card rounded-[24px] p-8 items-center border border-navy/5">
                  <Feather name="inbox" size={26} color="#1F2F3A" style={{ opacity: 0.25 }} />
                  <Text className="text-navy font-sansBold text-[16px] mt-3">No repair tickets</Text>
                </View>
              ) : (
                tickets.map((t) => {
                  const st = TICKET_STATUS[t.status] ?? TICKET_STATUS.open;
                  const closed = t.status === 'resolved' || t.status === 'closed';
                  return (
                    <View key={t.id} className="bg-card rounded-[22px] p-4 mb-3 border border-navy/5 shadow-sm" style={{ opacity: closed ? 0.6 : 1 }}>
                      <TouchableOpacity onPress={() => router.push('/maintenance')} className="flex-row items-center">
                        <View className="flex-1 pr-3">
                          <Text className="text-navy font-sansBold text-[15px]" numberOfLines={1}>{t.title}</Text>
                          <Text className="text-navy-muted font-sans text-[12px] opacity-70" numberOfLines={1}>
                            {t.units?.properties?.name || t.units?.properties?.address || ''}{t.units?.unit_number ? ` · Unit ${t.units.unit_number}` : ''} · {monthDay(t.created_at)}
                          </Text>
                        </View>
                        <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: st.bg }}>
                          <Text className="font-sansBold text-[11px]" style={{ color: st.fg }}>{st.label}</Text>
                        </View>
                      </TouchableOpacity>
                      {!closed && (
                        <TouchableOpacity
                          onPress={() => router.push({ pathname: '/project-editor', params: { requestId: t.id } } as any)}
                          className="flex-row items-center mt-3 pt-3 border-t border-navy/5"
                        >
                          <Feather name="layers" size={13} color="#8B2030" />
                          <Text className="text-burgundy font-sansBold text-[12px] ml-1.5">Turn into a project</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })
              )}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function ProjectCard({ p, cover, showOwner, index, onPress }: { p: Row; cover?: string; showOwner: boolean; index: number; onPress: () => void }) {
  const pct = progress(p.project_stages);
  const cur = currentStage(p.project_stages);
  const todos = p.project_action_items.filter((a) => a.status === 'open').length;
  const spent = p.project_costs.filter((c) => c.kind === 'actual').reduce((s, c) => s + Number(c.amount), 0);
  const finished = p.status === 'completed';
  return (
    <TouchableOpacity onPress={onPress} className="bg-card rounded-[24px] mb-4 border border-navy/5 shadow-sm overflow-hidden active:opacity-90">
      {cover ? (
        <Image source={{ uri: cover }} style={{ width: '100%', height: 120 }} contentFit="cover" transition={200} />
      ) : (
        <View className="h-2" style={{ backgroundColor: PRIORITY_COLOR[p.priority] }} />
      )}
      <View className="p-5">
        <View className="flex-row items-start justify-between mb-1">
          <Text className="text-navy font-sansBold text-[17px] flex-1 pr-3" numberOfLines={2}>{p.title}</Text>
          {todos > 0 ? (
            <View className="bg-burgundy px-2.5 py-1 rounded-full flex-row items-center">
              <Feather name="bell" size={10} color="#FFFFFF" />
              <Text className="text-white font-sansBold text-[11px] ml-1">{todos} for you</Text>
            </View>
          ) : (
            <View className="bg-navy/5 px-2.5 py-1 rounded-full">
              <Text className="text-navy font-sansBold text-[11px]">{STATUS_LABEL[p.status]}</Text>
            </View>
          )}
        </View>
        <Text className="text-navy-muted font-sans text-[12px] opacity-70 mb-4" numberOfLines={1}>
          {p.properties?.name || p.properties?.address || 'No property'}
          {showOwner && p.landlords ? ` · ${[p.landlords.first_name, p.landlords.last_name].filter(Boolean).join(' ')}` : ''}
        </Text>
        <GrowBar value={pct / 100} color={finished ? '#0A7A52' : '#8B2030'} height={8} delay={index * 80} />
        <View className="flex-row justify-between items-center mt-2.5">
          <Text className="text-navy font-sansBold text-[12px]" numberOfLines={1} style={{ flex: 1 }}>
            {finished ? 'Completed' : cur ? `${phaseLabel(cur.phase)}${cur.phase === 'work' ? ` · ${cur.title}` : ''}` : ''}
          </Text>
          <Text className="text-navy-muted font-sansBold text-[12px] ml-2">{pct}%{spent ? ` · $${money(spent).replace('.00', '')}` : ''}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}
