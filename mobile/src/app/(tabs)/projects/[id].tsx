import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Modal, TextInput, Alert, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { money, monthDay } from '../../../lib/format';
import { pickPhotos, uploadImages, useSignedUrls } from '../../../lib/media';
import { Ring, GrowBar } from '../../../components/ui/Charts';
import {
  type Project, type Stage, type ProjectUpdate, type ProjectCost, type ActionItem,
  PHASES, progress, currentStage, phaseLabel, costTotals, STATUS_LABEL,
} from '../../../lib/projects';

type Full = Project & { created_by: string | null };
type Sheet =
  | { kind: 'update'; stageId: string | null }
  | { kind: 'cost' }
  | { kind: 'action' }
  | { kind: 'stage'; stage: Stage }
  | { kind: 'respond'; item: ActionItem }
  | null;

const ACTION_KIND: Record<ActionItem['kind'], { label: string; icon: keyof typeof Feather.glyphMap }> = {
  approval: { label: 'Approval', icon: 'check-square' },
  decision: { label: 'Decision', icon: 'help-circle' },
  task: { label: 'To do', icon: 'check-circle' },
  payment: { label: 'Payment', icon: 'dollar-sign' },
};

export default function ProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, isManager } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Full | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [updates, setUpdates] = useState<ProjectUpdate[]>([]);
  const [costs, setCosts] = useState<ProjectCost[]>([]);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [openStage, setOpenStage] = useState<string | null>(null);
  const [showCosts, setShowCosts] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [viewer, setViewer] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const [{ data: p }, { data: s }, { data: u }, { data: c }, { data: a }] = await Promise.all([
      supabase.from('maintenance_projects').select('*, properties ( name, address ), landlords ( first_name, last_name )').eq('id', id).maybeSingle(),
      supabase.from('project_stages').select('*').eq('project_id', id).order('position'),
      supabase.from('project_updates').select('*').eq('project_id', id).order('created_at', { ascending: false }),
      supabase.from('project_costs').select('*').eq('project_id', id).order('incurred_on', { ascending: false }),
      supabase.from('project_action_items').select('*').eq('project_id', id).order('created_at', { ascending: false }),
    ]);
    setProject(p as unknown as Full);
    setStages((s ?? []) as Stage[]);
    setUpdates((u ?? []) as ProjectUpdate[]);
    setCosts((c ?? []) as ProjectCost[]);
    setActions((a ?? []) as ActionItem[]);
    setLoading(false);
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const allPhotos = updates.flatMap((u) => u.photos ?? []);
  const urls = useSignedUrls([...allPhotos, ...(project?.cover_photo ? [project.cover_photo] : [])]);

  if (loading) return <View className="flex-1 bg-pageBg items-center justify-center"><ActivityIndicator color="#1F2F3A" /></View>;
  if (!project) {
    return (
      <View className="flex-1 bg-pageBg items-center justify-center px-8">
        <Text className="text-navy font-sansBold text-[16px] mb-4">This project isn&apos;t available.</Text>
        <TouchableOpacity onPress={() => router.back()} className="bg-navy px-5 py-3 rounded-xl"><Text className="text-white font-sansBold">Go back</Text></TouchableOpacity>
      </View>
    );
  }

  // Managers run every project; an owner can edit only the ones they created themselves.
  const canEdit = isManager || project.created_by === user?.id;
  const pct = progress(stages);
  const cur = currentStage(stages);
  const money$ = costTotals(costs, project.budget);
  const openActions = actions.filter((a) => a.status === 'open');
  const workSteps = stages.filter((s) => s.phase === 'work');
  const workDone = workSteps.filter((s) => s.status === 'done').length;
  const cover = project.cover_photo ? urls[project.cover_photo] : undefined;

  async function advance(stage: Stage, status: 'done' | 'skipped') {
    const { error } = await supabase.from('project_stages').update({ status, completed_at: status === 'done' ? new Date().toISOString() : null }).eq('id', stage.id);
    if (error) return Alert.alert('Could not update', error.message);
    const next = stages.filter((s) => s.position > stage.position && s.status === 'pending').sort((a, b) => a.position - b.position)[0];
    const anotherCurrent = stages.some((s) => s.id !== stage.id && s.status === 'current');
    if (next && !anotherCurrent) await supabase.from('project_stages').update({ status: 'current' }).eq('id', next.id);
    if (!next && stage.phase === 'completed' && status === 'done') {
      await supabase.from('maintenance_projects').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', project!.id);
    }
    setSheet(null);
    load();
  }

  async function makeCurrent(stage: Stage) {
    await supabase.from('project_stages').update({ status: 'pending' }).eq('project_id', project!.id).eq('status', 'current');
    await supabase.from('project_stages').update({ status: 'current', completed_at: null }).eq('id', stage.id);
    setSheet(null);
    load();
  }

  async function setProjectStatus(status: Project['status']) {
    await supabase.from('maintenance_projects').update({ status, completed_at: status === 'completed' ? new Date().toISOString() : null }).eq('id', project!.id);
    load();
  }

  function statusMenu() {
    Alert.alert('Project status', undefined, [
      { text: 'Active', onPress: () => setProjectStatus('active') },
      { text: 'On hold', onPress: () => setProjectStatus('on_hold') },
      { text: 'Completed', onPress: () => setProjectStatus('completed') },
      { text: 'Cancelled', style: 'destructive', onPress: () => setProjectStatus('cancelled') },
      { text: 'Close', style: 'cancel' },
    ]);
  }

  return (
    <View className="flex-1 bg-pageBg">
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        {/* Hero */}
        <View className="bg-navy rounded-b-[36px] overflow-hidden">
          {cover && <Image source={{ uri: cover }} style={{ position: 'absolute', inset: 0, opacity: 0.35 } as any} contentFit="cover" />}
          <View style={{ paddingTop: insets.top + 8 }} className="px-6 pb-7">
            <View className="flex-row items-center justify-between mb-5">
              <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 rounded-full bg-white/10 items-center justify-center">
                <Feather name="arrow-left" size={18} color="#FFFFFF" />
              </TouchableOpacity>
              {canEdit && (
                <View className="flex-row gap-2">
                  <TouchableOpacity onPress={statusMenu} className="h-10 px-3.5 rounded-full bg-white/10 flex-row items-center">
                    <Text className="text-white font-sansBold text-[12px]">{STATUS_LABEL[project.status]}</Text>
                    <Feather name="chevron-down" size={14} color="#FFFFFF" style={{ marginLeft: 4 }} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => router.push({ pathname: '/project-editor', params: { id: project.id } } as any)} className="w-10 h-10 rounded-full bg-white/10 items-center justify-center">
                    <Feather name="edit-2" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
            <Text className="text-white/50 font-sans text-[12px] uppercase tracking-widest mb-1" numberOfLines={1}>
              {[project.category, project.properties?.name || project.properties?.address].filter(Boolean).join(' · ')}
            </Text>
            <Text className="text-white font-sansBold text-[28px] leading-tight mb-5">{project.title}</Text>
            <View className="flex-row items-center">
              <Ring value={pct / 100} size={108} stroke={10} color="#E8B4BC" track="rgba(255,255,255,0.14)">
                <Text className="text-white font-sansBold text-[24px]">{pct}%</Text>
                <Text className="text-white/50 font-sans text-[9px] uppercase tracking-widest">complete</Text>
              </Ring>
              <View className="flex-1 ml-5">
                <Text className="text-white/50 font-sans text-[11px] uppercase tracking-widest">Now</Text>
                <Text className="text-white font-sansBold text-[17px] mb-1" numberOfLines={2}>
                  {project.status === 'completed' ? 'Completed' : cur ? (cur.phase === 'work' ? cur.title : phaseLabel(cur.phase)) : '—'}
                </Text>
                {!!cur?.next_step && project.status !== 'completed' && (
                  <Text className="text-white/70 font-sans text-[13px]" numberOfLines={3}>Next: {cur.next_step}</Text>
                )}
                {project.target_date && (
                  <Text className="text-white/50 font-sans text-[12px] mt-2">Target finish {monthDay(project.target_date)}</Text>
                )}
              </View>
            </View>
          </View>
        </View>

        <View className="px-6 pt-6">
          {/* Owner to-dos */}
          {(openActions.length > 0 || canEdit) && (
            <View className="mb-6">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-navy font-sansBold text-[18px]">Needs the owner</Text>
                {canEdit && (
                  <TouchableOpacity onPress={() => setSheet({ kind: 'action' })} className="flex-row items-center">
                    <Feather name="plus" size={14} color="#8B2030" />
                    <Text className="text-burgundy font-sansBold text-[13px] ml-1">Add</Text>
                  </TouchableOpacity>
                )}
              </View>
              {openActions.length === 0 ? (
                <View className="bg-card rounded-[20px] p-4 border border-navy/5 flex-row items-center">
                  <Feather name="check-circle" size={16} color="#0A7A52" />
                  <Text className="text-navy-muted font-sans text-[13px] ml-2">Nothing waiting on the owner.</Text>
                </View>
              ) : (
                openActions.map((a) => (
                  <View key={a.id} className="rounded-[22px] p-4 mb-3" style={{ backgroundColor: 'rgba(139,32,48,0.06)', borderWidth: 1, borderColor: 'rgba(139,32,48,0.18)' }}>
                    <View className="flex-row items-center mb-1.5">
                      <Feather name={ACTION_KIND[a.kind].icon} size={14} color="#8B2030" />
                      <Text className="text-burgundy font-sansBold text-[11px] uppercase tracking-widest ml-1.5">{ACTION_KIND[a.kind].label}</Text>
                      {a.due_date && <Text className="text-navy-muted font-sans text-[11px] ml-auto">by {monthDay(a.due_date)}</Text>}
                    </View>
                    <Text className="text-navy font-sansBold text-[15px]">{a.title}{a.amount ? ` · $${money(a.amount).replace('.00', '')}` : ''}</Text>
                    {!!a.detail && <Text className="text-navy-muted font-sans text-[13px] mt-1">{a.detail}</Text>}
                    <View className="flex-row gap-2 mt-3">
                      {a.kind === 'approval' ? (
                        <>
                          <TouchableOpacity onPress={() => respond(a, 'done', 'Approved')} className="flex-1 bg-navy rounded-xl py-3 items-center"><Text className="text-white font-sansBold text-[13px]">Approve</Text></TouchableOpacity>
                          <TouchableOpacity onPress={() => setSheet({ kind: 'respond', item: a })} className="flex-1 bg-card border border-navy/10 rounded-xl py-3 items-center"><Text className="text-navy font-sansBold text-[13px]">Questions / decline</Text></TouchableOpacity>
                        </>
                      ) : (
                        <TouchableOpacity onPress={() => setSheet({ kind: 'respond', item: a })} className="flex-1 bg-navy rounded-xl py-3 items-center"><Text className="text-white font-sansBold text-[13px]">{a.kind === 'decision' ? 'Answer' : 'Mark done'}</Text></TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

          {/* Money */}
          <View className="bg-card rounded-[24px] p-5 mb-6 border border-navy/5 shadow-sm">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide">Money</Text>
              {canEdit && (
                <TouchableOpacity onPress={() => setSheet({ kind: 'cost' })} className="flex-row items-center">
                  <Feather name="plus" size={14} color="#8B2030" />
                  <Text className="text-burgundy font-sansBold text-[13px] ml-1">Add cost</Text>
                </TouchableOpacity>
              )}
            </View>
            <View className="flex-row justify-between mb-3">
              <View>
                <Text className="text-navy font-sansBold text-[24px]">${money(money$.spent).replace('.00', '')}</Text>
                <Text className="text-navy-muted font-sans text-[12px]">spent so far</Text>
              </View>
              <View className="items-end">
                <Text className="text-navy font-sansBold text-[18px]">{money$.budget ? `$${money(money$.budget).replace('.00', '')}` : '—'}</Text>
                <Text className="text-navy-muted font-sans text-[12px]">{project.budget ? 'approved budget' : money$.quoted ? 'quoted' : 'no budget set'}</Text>
              </View>
            </View>
            <GrowBar value={money$.budget ? money$.spent / money$.budget : 0} color={money$.over ? '#8B2030' : '#0A7A52'} height={10} />
            {money$.budget > 0 && (
              <Text className="font-sansBold text-[12px] mt-2" style={{ color: money$.over ? '#8B2030' : '#0A7A52' }}>
                {money$.over ? `$${money(-money$.remaining!).replace('.00', '')} over budget` : `$${money(money$.remaining!).replace('.00', '')} left in budget`}
              </Text>
            )}
            {costs.length > 0 && (
              <TouchableOpacity onPress={() => setShowCosts((v) => !v)} className="flex-row items-center mt-4 pt-3 border-t border-navy/5">
                <Text className="text-navy font-sansBold text-[13px] flex-1">{costs.length} line item{costs.length === 1 ? '' : 's'}</Text>
                <Feather name={showCosts ? 'chevron-up' : 'chevron-down'} size={16} color="#1F2F3A" style={{ opacity: 0.4 }} />
              </TouchableOpacity>
            )}
            {showCosts && costs.map((c) => (
              <View key={c.id} className="flex-row items-center py-2">
                <View className="flex-1 pr-2">
                  <Text className="text-navy font-sans text-[13px]" numberOfLines={1}>{c.label}{c.vendor ? ` · ${c.vendor}` : ''}</Text>
                  <Text className="text-navy-muted font-sans text-[11px] opacity-60">{monthDay(c.incurred_on)}{c.kind === 'quote' ? ' · quote' : ''}</Text>
                </View>
                <Text className="font-sansBold text-[13px]" style={{ color: c.kind === 'quote' ? '#64748B' : '#1F2F3A' }}>${money(c.amount).replace('.00', '')}</Text>
              </View>
            ))}
          </View>

          {/* Timeline */}
          <Text className="text-navy font-sansBold text-[18px] mb-3">Stages</Text>
          <View className="bg-card rounded-[24px] p-5 mb-6 border border-navy/5 shadow-sm">
            {PHASES.map((phase, pi) => {
              const inPhase = stages.filter((s) => s.phase === phase.key);
              if (!inPhase.length) return null;
              const isWork = phase.key === 'work';
              const phaseDone = inPhase.every((s) => s.status === 'done' || s.status === 'skipped');
              const phaseActive = inPhase.some((s) => s.status === 'current');
              const last = pi === PHASES.length - 1;
              return (
                <View key={phase.key} className="flex-row">
                  <View className="items-center mr-4" style={{ width: 28 }}>
                    <Dot state={phaseDone ? 'done' : phaseActive ? 'current' : 'pending'} icon={phase.icon} />
                    {!last && <View style={{ width: 2, flex: 1, backgroundColor: phaseDone ? '#0A7A52' : 'rgba(31,47,58,0.1)', marginVertical: 2 }} />}
                  </View>
                  <View className="flex-1 pb-5">
                    {isWork ? (
                      <>
                        <View className="flex-row items-center justify-between">
                          <Text className="text-navy font-sansBold text-[15px]">{phase.label}</Text>
                          <Text className="text-navy-muted font-sansBold text-[12px]">{workDone}/{workSteps.length} steps</Text>
                        </View>
                        <View className="my-2"><GrowBar value={workSteps.length ? workDone / workSteps.length : 0} color="#8B2030" height={5} /></View>
                        {inPhase.map((s, i) => (
                          <StageRow key={s.id} s={s} index={i + 1} open={openStage === s.id} onToggle={() => setOpenStage(openStage === s.id ? null : s.id)}
                            updates={updates.filter((u) => u.stage_id === s.id)} urls={urls} onPhoto={setViewer}
                            canEdit={canEdit} onManage={() => setSheet({ kind: 'stage', stage: s })} onAddUpdate={() => setSheet({ kind: 'update', stageId: s.id })} />
                        ))}
                      </>
                    ) : (
                      inPhase.map((s) => (
                        <StageRow key={s.id} s={s} open={openStage === s.id} onToggle={() => setOpenStage(openStage === s.id ? null : s.id)}
                          updates={updates.filter((u) => u.stage_id === s.id)} urls={urls} onPhoto={setViewer}
                          canEdit={canEdit} onManage={() => setSheet({ kind: 'stage', stage: s })} onAddUpdate={() => setSheet({ kind: 'update', stageId: s.id })} headline />
                      ))
                    )}
                  </View>
                </View>
              );
            })}
          </View>

          {/* Photos */}
          {allPhotos.length > 0 && (
            <>
              <Text className="text-navy font-sansBold text-[18px] mb-3">Photos</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-6 mb-6" contentContainerStyle={{ paddingHorizontal: 24, gap: 10 }}>
                {allPhotos.map((path) => (
                  <TouchableOpacity key={path} onPress={() => setViewer(path)}>
                    <Image source={{ uri: urls[path] }} style={{ width: 120, height: 120, borderRadius: 18, backgroundColor: '#E8E4DE' }} contentFit="cover" transition={150} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          {/* Activity */}
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-navy font-sansBold text-[18px]">Updates</Text>
            {canEdit && (
              <TouchableOpacity onPress={() => setSheet({ kind: 'update', stageId: cur?.id ?? null })} className="flex-row items-center">
                <Feather name="plus" size={14} color="#8B2030" />
                <Text className="text-burgundy font-sansBold text-[13px] ml-1">Post update</Text>
              </TouchableOpacity>
            )}
          </View>
          {updates.length === 0 ? (
            <Text className="text-navy-muted font-sans text-[13px] mb-6">No updates yet.</Text>
          ) : (
            updates.map((u) => {
              const st = stages.find((s) => s.id === u.stage_id);
              return (
                <View key={u.id} className="bg-card rounded-[20px] p-4 mb-3 border border-navy/5">
                  <View className="flex-row items-center mb-1.5">
                    <Text className="text-navy font-sansBold text-[12px]">{u.author_name || 'Prospera'}</Text>
                    <Text className="text-navy-muted font-sans text-[11px] ml-2 opacity-60">{monthDay(u.created_at)}</Text>
                    {st && <Text className="text-burgundy font-sansBold text-[11px] ml-auto" numberOfLines={1}>{st.phase === 'work' ? st.title : phaseLabel(st.phase)}</Text>}
                  </View>
                  {!!u.body && <Text className="text-navy font-sans text-[14px] leading-5">{u.body}</Text>}
                  {u.photos?.length > 0 && (
                    <View className="flex-row flex-wrap gap-2 mt-2">
                      {u.photos.map((ph) => (
                        <TouchableOpacity key={ph} onPress={() => setViewer(ph)}>
                          <Image source={{ uri: urls[ph] }} style={{ width: 72, height: 72, borderRadius: 12, backgroundColor: '#E8E4DE' }} contentFit="cover" />
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              );
            })
          )}

          {/* Details */}
          <View className="bg-card rounded-[24px] p-5 mt-3 border border-navy/5">
            <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-3">Details</Text>
            {[
              ['Contractor', project.contractor],
              ['Start', project.start_date ? monthDay(project.start_date) : null],
              ['Target finish', project.target_date ? monthDay(project.target_date) : null],
              ['Priority', project.priority.charAt(0).toUpperCase() + project.priority.slice(1)],
              ['Owner', project.landlords ? [project.landlords.first_name, project.landlords.last_name].filter(Boolean).join(' ') : null],
            ].filter(([, v]) => v).map(([k, v]) => (
              <View key={k as string} className="flex-row justify-between py-1.5">
                <Text className="text-navy-muted font-sans text-[13px]">{k}</Text>
                <Text className="text-navy font-sansBold text-[13px]">{v}</Text>
              </View>
            ))}
            {!!project.description && <Text className="text-navy font-sans text-[14px] leading-5 mt-3">{project.description}</Text>}
          </View>
        </View>
      </ScrollView>

      <Modal visible={!!viewer} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <Pressable onPress={() => setViewer(null)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center' }}>
          {viewer && <Image source={{ uri: urls[viewer] }} style={{ width: '100%', height: '80%' }} contentFit="contain" />}
        </Pressable>
      </Modal>

      <ProjectSheet
        sheet={sheet} project={project} stages={stages} onClose={() => setSheet(null)} onSaved={() => { setSheet(null); load(); }}
        onAdvance={advance} onMakeCurrent={makeCurrent} authorName={isManager ? 'Prospera Properties' : undefined}
      />
    </View>
  );

  async function respond(item: ActionItem, status: 'done' | 'declined', response: string) {
    const { error } = await supabase.from('project_action_items').update({ status, response, responded_at: new Date().toISOString() }).eq('id', item.id);
    if (error) return Alert.alert('Could not save', error.message);
    await supabase.from('project_updates').insert({ project_id: project!.id, stage_id: item.stage_id, body: `${item.title}: ${response}`, author_name: 'Owner' });
    setSheet(null);
    load();
  }
}

function Dot({ state, icon }: { state: 'done' | 'current' | 'pending'; icon: string }) {
  const bg = state === 'done' ? '#0A7A52' : state === 'current' ? '#8B2030' : '#FFFFFF';
  return (
    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: bg, borderWidth: state === 'pending' ? 2 : 0, borderColor: 'rgba(31,47,58,0.15)', alignItems: 'center', justifyContent: 'center' }}>
      <Feather name={state === 'done' ? 'check' : (icon as any)} size={13} color={state === 'pending' ? 'rgba(31,47,58,0.35)' : '#FFFFFF'} />
    </View>
  );
}

function StageRow({ s, index, open, onToggle, updates, urls, onPhoto, canEdit, onManage, onAddUpdate, headline }: {
  s: Stage; index?: number; open: boolean; onToggle: () => void; updates: ProjectUpdate[]; urls: Record<string, string>;
  onPhoto: (p: string) => void; canEdit: boolean; onManage: () => void; onAddUpdate: () => void; headline?: boolean;
}) {
  const color = s.status === 'done' ? '#0A7A52' : s.status === 'current' ? '#8B2030' : s.status === 'skipped' ? '#94A3B8' : '#1F2F3A';
  return (
    <View className={headline ? '' : 'py-1.5'}>
      <TouchableOpacity onPress={onToggle} className="flex-row items-center">
        {!headline && (
          <View className="w-6 h-6 rounded-full items-center justify-center mr-2.5" style={{ backgroundColor: s.status === 'done' ? '#0A7A52' : s.status === 'current' ? '#8B2030' : 'rgba(31,47,58,0.06)' }}>
            {s.status === 'done' ? <Feather name="check" size={12} color="#FFFFFF" /> : <Text className="font-sansBold text-[10px]" style={{ color: s.status === 'current' ? '#FFFFFF' : '#1F2F3A' }}>{index}</Text>}
          </View>
        )}
        <View className="flex-1">
          <Text className={`font-sansBold ${headline ? 'text-[15px]' : 'text-[14px]'}`} style={{ color: headline ? '#1F2F3A' : color, textDecorationLine: s.status === 'skipped' ? 'line-through' : 'none' }}>
            {s.title}
          </Text>
          {(s.status === 'current' || s.is_inspection || s.due_date || updates.length > 0) && (
            <View className="flex-row flex-wrap items-center mt-0.5 gap-x-2">
              {s.status === 'current' && <Text className="text-burgundy font-sansBold text-[11px]">In progress now</Text>}
              {s.is_inspection && <Text className="text-[#5B21B6] font-sansBold text-[11px]">Inspection</Text>}
              {s.due_date && <Text className="text-navy-muted font-sans text-[11px]">due {monthDay(s.due_date)}</Text>}
              {updates.length > 0 && <Text className="text-navy-muted font-sans text-[11px]">{updates.length} note{updates.length === 1 ? '' : 's'}</Text>}
              {s.completed_at && <Text className="text-[#0A7A52] font-sans text-[11px]">done {monthDay(s.completed_at)}</Text>}
            </View>
          )}
        </View>
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={15} color="#1F2F3A" style={{ opacity: 0.3 }} />
      </TouchableOpacity>
      {open && (
        <View className="mt-2 ml-1 pl-3 border-l-2 border-navy/10">
          {!!s.description && <Text className="text-navy font-sans text-[13px] mb-2">{s.description}</Text>}
          {!!s.next_step && <Text className="text-navy font-sans text-[13px] mb-2"><Text className="font-sansBold">Next: </Text>{s.next_step}</Text>}
          {updates.map((u) => (
            <View key={u.id} className="mb-2">
              {!!u.body && <Text className="text-navy-muted font-sans text-[13px]">{monthDay(u.created_at)} · {u.body}</Text>}
              {u.photos?.length > 0 && (
                <View className="flex-row flex-wrap gap-1.5 mt-1">
                  {u.photos.map((ph) => (
                    <TouchableOpacity key={ph} onPress={() => onPhoto(ph)}>
                      <Image source={{ uri: urls[ph] }} style={{ width: 56, height: 56, borderRadius: 10, backgroundColor: '#E8E4DE' }} contentFit="cover" />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          ))}
          {!s.description && !s.next_step && updates.length === 0 && <Text className="text-navy-muted font-sans text-[12px] opacity-60 mb-2">No notes on this stage yet.</Text>}
          {canEdit && (
            <View className="flex-row gap-2 mt-1 mb-2">
              <TouchableOpacity onPress={onAddUpdate} className="flex-row items-center bg-navy/5 rounded-full px-3 py-1.5">
                <Feather name="camera" size={12} color="#1F2F3A" /><Text className="text-navy font-sansBold text-[11px] ml-1.5">Note / photos</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onManage} className="flex-row items-center bg-navy rounded-full px-3 py-1.5">
                <Feather name="sliders" size={12} color="#FFFFFF" /><Text className="text-white font-sansBold text-[11px] ml-1.5">Update stage</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// One bottom sheet for every edit: post update, add cost, ask the owner, update a stage, answer a to-do.
function ProjectSheet({ sheet, project, stages, onClose, onSaved, onAdvance, onMakeCurrent, authorName }: {
  sheet: Sheet; project: Full; stages: Stage[]; onClose: () => void; onSaved: () => void;
  onAdvance: (s: Stage, status: 'done' | 'skipped') => void; onMakeCurrent: (s: Stage) => void; authorName?: string;
}) {
  const [text, setText] = useState('');
  const [text2, setText2] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [kind, setKind] = useState<string>('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [stageId, setStageId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSheet, setLastSheet] = useState<Sheet>(null);

  // Reset the form whenever a different sheet opens.
  if (sheet !== lastSheet) {
    setLastSheet(sheet);
    setText(sheet?.kind === 'stage' ? sheet.stage.next_step ?? '' : '');
    setText2(sheet?.kind === 'stage' ? sheet.stage.description ?? '' : '');
    setAmount(''); setPhotos([]); setSaving(false);
    setDate(sheet?.kind === 'stage' ? sheet.stage.due_date ?? '' : '');
    setKind(sheet?.kind === 'cost' ? 'actual' : sheet?.kind === 'action' ? 'approval' : '');
    setStageId(sheet?.kind === 'update' ? sheet.stageId : null);
  }

  if (!sheet) return null;

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      if (sheet!.kind === 'update') {
        if (!text.trim() && !photos.length) { setSaving(false); return; }
        const paths = photos.length ? await uploadImages(`projects/${project.id}`, photos) : [];
        const { error } = await supabase.from('project_updates').insert({ project_id: project.id, stage_id: stageId, body: text.trim() || null, photos: paths, author_name: authorName ?? null });
        if (error) throw error;
        if (paths.length && !project.cover_photo) await supabase.from('maintenance_projects').update({ cover_photo: paths[0] }).eq('id', project.id);
      } else if (sheet!.kind === 'cost') {
        if (!text.trim() || !Number(amount)) { setSaving(false); return; }
        const { error } = await supabase.from('project_costs').insert({ project_id: project.id, label: text.trim(), vendor: text2.trim() || null, amount: Number(amount), kind, incurred_on: date || undefined });
        if (error) throw error;
      } else if (sheet!.kind === 'action') {
        if (!text.trim()) { setSaving(false); return; }
        const cur = currentStage(stages);
        const { error } = await supabase.from('project_action_items').insert({ project_id: project.id, stage_id: cur?.id ?? null, title: text.trim(), detail: text2.trim() || null, kind, amount: amount ? Number(amount) : null, due_date: date || null });
        if (error) throw error;
      } else if (sheet!.kind === 'stage') {
        const { error } = await supabase.from('project_stages').update({ next_step: text.trim() || null, description: text2.trim() || null, due_date: date || null }).eq('id', sheet!.stage.id);
        if (error) throw error;
      } else if (sheet!.kind === 'respond') {
        const item = sheet!.item;
        const status = kind === 'declined' ? 'declined' : 'done';
        const response = text.trim() || (status === 'declined' ? 'Declined' : 'Done');
        const { error } = await supabase.from('project_action_items').update({ status, response, responded_at: new Date().toISOString() }).eq('id', item.id);
        if (error) throw error;
        await supabase.from('project_updates').insert({ project_id: project.id, stage_id: item.stage_id, body: `${item.title}: ${response}`, author_name: authorName ?? 'Owner' });
      }
      onSaved();
    } catch (e: any) {
      Alert.alert('Could not save', e.message);
      setSaving(false);
    }
  }

  const title = { update: 'Post an update', cost: 'Add a cost', action: 'Ask the owner', stage: 'Update stage', respond: 'Respond' }[sheet.kind];

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View className="bg-card rounded-t-[28px] p-6" style={{ maxHeight: '88%' }}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-navy font-sansBold text-[20px]">{title}</Text>
              <TouchableOpacity onPress={onClose} className="w-9 h-9 rounded-full bg-navy/5 items-center justify-center"><Feather name="x" size={16} color="#1F2F3A" /></TouchableOpacity>
            </View>

            {sheet.kind === 'stage' && (
              <>
                <Text className="text-navy font-sansBold text-[15px] mb-3">{sheet.stage.phase === 'work' ? sheet.stage.title : phaseLabel(sheet.stage.phase)}</Text>
                <View className="flex-row gap-2 mb-5">
                  <Chip label="Mark done" icon="check" active onPress={() => onAdvance(sheet.stage, 'done')} />
                  <Chip label="Working on it" icon="play" onPress={() => onMakeCurrent(sheet.stage)} />
                  <Chip label="Skip" icon="skip-forward" onPress={() => onAdvance(sheet.stage, 'skipped')} />
                </View>
                <Field label="Next step (the owner sees this)" value={text} onChange={setText} placeholder="e.g. City inspector booked for Tuesday" multiline />
                <Field label="Notes on this stage" value={text2} onChange={setText2} placeholder="What's happening, what we found" multiline />
                <Field label="Due date (YYYY-MM-DD)" value={date} onChange={setDate} placeholder="2026-11-20" />
              </>
            )}

            {sheet.kind === 'update' && (
              <>
                <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Stage</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4" contentContainerStyle={{ gap: 6 }}>
                  {stages.map((s) => (
                    <Chip key={s.id} label={s.phase === 'work' ? s.title : phaseLabel(s.phase)} active={stageId === s.id} onPress={() => setStageId(s.id)} />
                  ))}
                </ScrollView>
                <Field label="What happened" value={text} onChange={setText} placeholder="e.g. Footings poured, curing until Thursday" multiline />
                <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Photos</Text>
                <View className="flex-row flex-wrap gap-2 mb-5">
                  {photos.map((uri) => (
                    <TouchableOpacity key={uri} onPress={() => setPhotos((p) => p.filter((x) => x !== uri))}>
                      <Image source={{ uri }} style={{ width: 64, height: 64, borderRadius: 12 }} />
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity onPress={async () => setPhotos([...photos, ...(await pickPhotos('camera'))])} className="w-16 h-16 rounded-xl bg-navy/5 items-center justify-center"><Feather name="camera" size={18} color="#1F2F3A" /></TouchableOpacity>
                  <TouchableOpacity onPress={async () => setPhotos([...photos, ...(await pickPhotos('library'))])} className="w-16 h-16 rounded-xl bg-navy/5 items-center justify-center"><Feather name="image" size={18} color="#1F2F3A" /></TouchableOpacity>
                </View>
              </>
            )}

            {sheet.kind === 'cost' && (
              <>
                <View className="flex-row gap-2 mb-4">
                  <Chip label="Paid / invoiced" active={kind === 'actual'} onPress={() => setKind('actual')} />
                  <Chip label="Quote" active={kind === 'quote'} onPress={() => setKind('quote')} />
                </View>
                <Field label="What for" value={text} onChange={setText} placeholder="e.g. Concrete and rebar" />
                <Field label="Vendor (optional)" value={text2} onChange={setText2} placeholder="e.g. Home Depot" />
                <Field label="Amount" value={amount} onChange={setAmount} placeholder="0.00" numeric />
                <Field label="Date (YYYY-MM-DD, optional)" value={date} onChange={setDate} placeholder="Today" />
              </>
            )}

            {sheet.kind === 'action' && (
              <>
                <View className="flex-row flex-wrap gap-2 mb-4">
                  {(['approval', 'decision', 'task', 'payment'] as const).map((k) => <Chip key={k} label={ACTION_KIND[k].label} active={kind === k} onPress={() => setKind(k)} />)}
                </View>
                <Field label="What the owner needs to do" value={text} onChange={setText} placeholder="e.g. Approve the framing quote" />
                <Field label="Details (optional)" value={text2} onChange={setText2} placeholder="Anything that helps them decide" multiline />
                <Field label="Amount (optional)" value={amount} onChange={setAmount} placeholder="0.00" numeric />
                <Field label="Needed by (YYYY-MM-DD, optional)" value={date} onChange={setDate} placeholder="2026-11-20" />
              </>
            )}

            {sheet.kind === 'respond' && (
              <>
                <Text className="text-navy font-sansBold text-[15px] mb-3">{sheet.item.title}</Text>
                {sheet.item.kind === 'approval' && (
                  <View className="flex-row gap-2 mb-4">
                    <Chip label="Approve" active={kind !== 'declined'} onPress={() => setKind('done')} />
                    <Chip label="Decline" active={kind === 'declined'} onPress={() => setKind('declined')} />
                  </View>
                )}
                <Field label={sheet.item.kind === 'decision' ? 'Your answer' : 'Note (optional)'} value={text} onChange={setText} placeholder="Type here" multiline />
              </>
            )}

            <TouchableOpacity onPress={save} disabled={saving} className="bg-navy rounded-2xl py-4 items-center mt-2 mb-2">
              {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text className="text-white font-sansBold text-[15px]">{sheet.kind === 'stage' ? 'Save notes' : 'Save'}</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Chip({ label, icon, active, onPress }: { label: string; icon?: keyof typeof Feather.glyphMap; active?: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} className="flex-row items-center px-3.5 py-2 rounded-full border" style={{ borderColor: active ? '#1F2F3A' : '#D8D2C8', backgroundColor: active ? '#1F2F3A' : 'transparent' }}>
      {icon && <Feather name={icon} size={12} color={active ? '#FFFFFF' : '#1F2F3A'} style={{ marginRight: 5 }} />}
      <Text className="font-sansBold text-[12px]" style={{ color: active ? '#FFFFFF' : '#1F2F3A' }} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

function Field({ label, value, onChange, placeholder, multiline, numeric }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean; numeric?: boolean }) {
  return (
    <View className="mb-4">
      <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">{label}</Text>
      <TextInput
        className="bg-pageBg border border-navy-border rounded-xl px-4 py-3.5 font-sans text-navy"
        style={multiline ? { minHeight: 84, textAlignVertical: 'top' } : undefined}
        value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor="#94a3b8"
        multiline={multiline} keyboardType={numeric ? 'decimal-pad' : 'default'}
      />
    </View>
  );
}
