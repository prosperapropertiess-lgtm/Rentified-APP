import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { TEMPLATES, PHASES, buildStages, type Stage, type Project } from '../lib/projects';

interface Owner { id: string; first_name: string | null; last_name: string | null }
interface Prop { id: string; name: string | null; address: string | null }
interface Step { key: string; id?: string; title: string; inspection: boolean; locked: boolean }

let seq = 0;
const newKey = () => `s${Date.now()}-${seq++}`;
const PRIORITIES: Project['priority'][] = ['low', 'normal', 'high', 'urgent'];
const CATEGORIES = ['Exterior', 'Interior', 'Mechanical', 'Plumbing', 'Electrical', 'Roofing', 'Landscaping', 'Other'];

// New project, or edit an existing one. The SOP phases are fixed; the
// "In progress" steps are whatever this job actually needs.
export default function ProjectEditor() {
  const { id, requestId } = useLocalSearchParams<{ id?: string; requestId?: string }>();
  const { profileId, isManager } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const editing = !!id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [props, setProps] = useState<Prop[]>([]);
  const [landlordId, setLandlordId] = useState<string | null>(isManager ? null : profileId);
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [unitId, setUnitId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Exterior');
  const [priority, setPriority] = useState<Project['priority']>('normal');
  const [budget, setBudget] = useState('');
  const [contractor, setContractor] = useState('');
  const [startDate, setStartDate] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [template, setTemplate] = useState<string | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      if (isManager) {
        const { data } = await supabase.from('landlords').select('id, first_name, last_name').order('first_name');
        setOwners((data ?? []) as Owner[]);
      }
      if (id) {
        const [{ data: p }, { data: s }] = await Promise.all([
          supabase.from('maintenance_projects').select('*').eq('id', id).single(),
          supabase.from('project_stages').select('*').eq('project_id', id).eq('phase', 'work').order('position'),
        ]);
        if (p) {
          setLandlordId(p.landlord_id); setPropertyId(p.property_id); setUnitId(p.unit_id);
          setTitle(p.title); setDescription(p.description ?? ''); setCategory(p.category ?? 'Other');
          setPriority(p.priority); setBudget(p.budget ? String(p.budget) : ''); setContractor(p.contractor ?? '');
          setStartDate(p.start_date ?? ''); setTargetDate(p.target_date ?? '');
        }
        setSteps(((s ?? []) as Stage[]).map((x) => ({ key: x.id, id: x.id, title: x.title, inspection: x.is_inspection, locked: x.status === 'done' })));
      } else if (requestId) {
        const { data: r } = await supabase.from('maintenance_requests').select('title, description, landlord_id, unit_id, units ( property_id )').eq('id', requestId).single();
        if (r) {
          setTitle(r.title); setDescription(r.description ?? ''); setLandlordId(r.landlord_id);
          setUnitId(r.unit_id); setPropertyId((r.units as any)?.property_id ?? null);
        }
        applyTemplate('blank');
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, requestId, isManager]);

  useEffect(() => {
    if (!landlordId) return;
    supabase.from('properties').select('id, name, address').eq('landlord_id', landlordId).is('deleted_at', null)
      .then(({ data }) => setProps((data ?? []) as Prop[]));
  }, [landlordId]);

  function applyTemplate(key: string) {
    const t = TEMPLATES.find((x) => x.key === key)!;
    setTemplate(key);
    if (key !== 'blank') setCategory(t.category);
    if (!title.trim() && key !== 'blank') setTitle(t.label);
    setSteps(t.steps.map((s) => ({ key: newKey(), title: s.title, inspection: !!s.inspection, locked: false })));
  }

  const move = (i: number, d: -1 | 1) => setSteps((list) => {
    const j = i + d;
    if (j < 0 || j >= list.length) return list;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
  const update = (i: number, patch: Partial<Step>) => setSteps((list) => list.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  const remove = (i: number) => setSteps((list) => {
    const s = list[i];
    if (s.id) setRemoved((r) => [...r, s.id!]);
    return list.filter((_, k) => k !== i);
  });

  async function save() {
    if (saving) return;
    if (!landlordId) return Alert.alert('Pick an owner first');
    if (!title.trim()) return Alert.alert('Give the project a name');
    if (!steps.some((s) => s.title.trim())) return Alert.alert('Add at least one work step');
    setSaving(true);
    try {
      const fields = {
        landlord_id: landlordId, property_id: propertyId, unit_id: unitId, title: title.trim(), description: description.trim() || null,
        category, priority, budget: budget ? Number(budget) : null, contractor: contractor.trim() || null,
        start_date: startDate || null, target_date: targetDate || null,
      };

      if (!editing) {
        const { data: p, error } = await supabase.from('maintenance_projects').insert({ ...fields, maintenance_request_id: requestId ?? null }).select('id').single();
        if (error) throw error;
        const rows = buildStages(steps.map((s) => ({ title: s.title, inspection: s.inspection })));
        // Started from a repair ticket: the request stage is already done.
        if (requestId) { rows[0].status = 'done'; rows[0].completed_at = new Date().toISOString(); rows[1].status = 'current'; }
        const { error: se } = await supabase.from('project_stages').insert(rows.map((r) => ({ ...r, project_id: p.id })));
        if (se) throw se;
        if (requestId) await supabase.from('maintenance_requests').update({ status: 'in_progress' }).eq('id', requestId);
        router.replace(`/projects/${p.id}` as any);
        return;
      }

      const { error } = await supabase.from('maintenance_projects').update(fields).eq('id', id!);
      if (error) throw error;
      if (removed.length) await supabase.from('project_stages').delete().in('id', removed);
      for (const s of steps.filter((x) => x.id)) {
        await supabase.from('project_stages').update({ title: s.title.trim(), is_inspection: s.inspection }).eq('id', s.id!);
      }
      const added = steps.filter((x) => !x.id && x.title.trim());
      let insertedIds: Record<string, string> = {};
      if (added.length) {
        const { data: ins, error: ie } = await supabase.from('project_stages')
          .insert(added.map((s) => ({ project_id: id, phase: 'work', title: s.title.trim(), is_inspection: s.inspection, position: 999, status: 'pending' })))
          .select('id');
        if (ie) throw ie;
        insertedIds = Object.fromEntries(added.map((s, i) => [s.key, ins![i].id]));
      }
      // Re-number every stage: SOP order, with the work steps in the order shown here.
      const { data: all } = await supabase.from('project_stages').select('id, phase').eq('project_id', id!);
      const workOrder = steps.filter((s) => s.title.trim()).map((s) => s.id ?? insertedIds[s.key]);
      const ordered: string[] = [];
      for (const ph of PHASES) {
        if (ph.key === 'work') ordered.push(...workOrder);
        else ordered.push(...(all ?? []).filter((x) => x.phase === ph.key).map((x) => x.id));
      }
      await Promise.all(ordered.map((sid, i) => supabase.from('project_stages').update({ position: i }).eq('id', sid)));
      router.back();
    } catch (e: any) {
      Alert.alert('Could not save', e.message);
      setSaving(false);
    }
  }

  async function deleteProject() {
    Alert.alert('Delete this project?', 'Its stages, notes, photos and costs are removed. This can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await supabase.from('maintenance_projects').delete().eq('id', id!);
        router.replace('/projects' as any);
      } },
    ]);
  }

  if (loading) return <View className="flex-1 bg-pageBg items-center justify-center"><ActivityIndicator color="#1F2F3A" /></View>;
  const ownerProps = landlordId ? props : [];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-pageBg">
      <View style={{ paddingTop: insets.top + 8 }} className="px-6 pb-3 flex-row items-center justify-between">
        <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 rounded-full bg-card border border-navy/5 items-center justify-center">
          <Feather name="x" size={18} color="#1F2F3A" />
        </TouchableOpacity>
        <Text className="text-navy font-sansBold text-[16px]">{editing ? 'Edit project' : 'New project'}</Text>
        <TouchableOpacity onPress={save} disabled={saving} className="h-10 px-4 rounded-full bg-navy items-center justify-center">
          {saving ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text className="text-white font-sansBold text-[13px]">Save</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 60 }}>
        {isManager && (
          <Section title="Owner">
            <Chips items={owners.map((o) => ({ value: o.id, label: [o.first_name, o.last_name].filter(Boolean).join(' ') || 'Owner' }))} value={landlordId} onChange={(v) => { setLandlordId(v); setPropertyId(null); setUnitId(null); }} />
          </Section>
        )}

        <Section title="Property">
          {ownerProps.length === 0 ? (
            <Text className="text-navy-muted font-sans text-[13px]">{landlordId ? 'This owner has no properties yet.' : 'Pick an owner first.'}</Text>
          ) : (
            <Chips items={ownerProps.map((p) => ({ value: p.id, label: p.name || p.address || 'Property' }))} value={propertyId} onChange={(v) => { setPropertyId(v); setUnitId(null); }} />
          )}
        </Section>

        <Section title="Project">
          <Input value={title} onChange={setTitle} placeholder="e.g. Back deck rebuild" />
          <Input value={description} onChange={setDescription} placeholder="What's being done and why (the owner reads this)" multiline />
          <View className="flex-row gap-3">
            <View className="flex-1"><Input value={budget} onChange={setBudget} placeholder="Budget $" numeric /></View>
            <View className="flex-1"><Input value={contractor} onChange={setContractor} placeholder="Contractor" /></View>
          </View>
          <View className="flex-row gap-3">
            <View className="flex-1"><Input value={startDate} onChange={setStartDate} placeholder="Start YYYY-MM-DD" /></View>
            <View className="flex-1"><Input value={targetDate} onChange={setTargetDate} placeholder="Finish YYYY-MM-DD" /></View>
          </View>
          <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2 mt-1">Type</Text>
          <Chips items={CATEGORIES.map((c) => ({ value: c, label: c }))} value={category} onChange={setCategory} />
          <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2 mt-4">Priority</Text>
          <Chips items={PRIORITIES.map((p) => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) }))} value={priority} onChange={(v) => setPriority(v as Project['priority'])} />
        </Section>

        {!editing && (
          <Section title="Start from a template">
            <Chips items={TEMPLATES.map((t) => ({ value: t.key, label: t.label }))} value={template} onChange={applyTemplate} />
          </Section>
        )}

        <Section title="Stages">
          <Text className="text-navy-muted font-sans text-[13px] mb-4 leading-5">
            Every project goes Request → Assessment → Quotes → Owner approval → Scheduled → <Text className="font-sansBold text-navy">In progress</Text> → Final inspection → Completed. Write the in-progress steps for this job below.
          </Text>
          {steps.map((s, i) => (
            <View key={s.key} className="flex-row items-center bg-card rounded-2xl border border-navy/5 pl-3 pr-1.5 py-1.5 mb-2">
              <Text className="text-navy-muted font-sansBold text-[12px] w-5">{i + 1}</Text>
              <TextInput
                className="flex-1 font-sans text-navy text-[14px] py-2"
                value={s.title} onChangeText={(t) => update(i, { title: t })} placeholder="Step name" placeholderTextColor="#94a3b8"
                editable={!s.locked}
              />
              <TouchableOpacity onPress={() => update(i, { inspection: !s.inspection })} className="w-8 h-8 rounded-full items-center justify-center" style={{ backgroundColor: s.inspection ? 'rgba(91,33,182,0.12)' : 'transparent' }}>
                <Feather name="shield" size={14} color={s.inspection ? '#5B21B6' : '#94A3B8'} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => move(i, -1)} className="w-8 h-8 items-center justify-center"><Feather name="arrow-up" size={14} color="#1F2F3A" /></TouchableOpacity>
              <TouchableOpacity onPress={() => move(i, 1)} className="w-8 h-8 items-center justify-center"><Feather name="arrow-down" size={14} color="#1F2F3A" /></TouchableOpacity>
              {!s.locked && <TouchableOpacity onPress={() => remove(i)} className="w-8 h-8 items-center justify-center"><Feather name="trash-2" size={14} color="#8B2030" /></TouchableOpacity>}
            </View>
          ))}
          <View className="flex-row gap-2 mt-1">
            <TouchableOpacity onPress={() => setSteps((l) => [...l, { key: newKey(), title: '', inspection: false, locked: false }])} className="flex-1 flex-row items-center justify-center py-3 rounded-2xl border border-dashed border-navy/20">
              <Feather name="plus" size={14} color="#1F2F3A" /><Text className="text-navy font-sansBold text-[13px] ml-1.5">Add step</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSteps((l) => [...l, { key: newKey(), title: 'Inspection', inspection: true, locked: false }])} className="flex-1 flex-row items-center justify-center py-3 rounded-2xl border border-dashed border-[#5B21B6]/30">
              <Feather name="shield" size={14} color="#5B21B6" /><Text className="font-sansBold text-[13px] ml-1.5" style={{ color: '#5B21B6' }}>Add inspection</Text>
            </TouchableOpacity>
          </View>
        </Section>

        {editing && (
          <TouchableOpacity onPress={deleteProject} className="items-center py-4 mt-4">
            <Text className="text-burgundy font-sansBold text-[13px]">Delete project</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mb-6">
      <Text className="text-navy font-sansBold text-[17px] mb-3">{title}</Text>
      {children}
    </View>
  );
}

function Chips({ items, value, onChange }: { items: { value: string; label: string }[]; value: string | null; onChange: (v: string) => void }) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {items.map((it) => {
        const on = it.value === value;
        return (
          <TouchableOpacity key={it.value} onPress={() => onChange(it.value)} className="px-3.5 py-2 rounded-full border" style={{ borderColor: on ? '#1F2F3A' : '#D8D2C8', backgroundColor: on ? '#1F2F3A' : '#FFFFFF' }}>
            <Text className="font-sansBold text-[12px]" style={{ color: on ? '#FFFFFF' : '#1F2F3A' }}>{it.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function Input({ value, onChange, placeholder, multiline, numeric }: { value: string; onChange: (v: string) => void; placeholder: string; multiline?: boolean; numeric?: boolean }) {
  return (
    <TextInput
      className="bg-card border border-navy/10 rounded-2xl px-4 py-3.5 font-sans text-navy mb-3"
      style={multiline ? { minHeight: 88, textAlignVertical: 'top' } : undefined}
      value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor="#94a3b8"
      multiline={multiline} keyboardType={numeric ? 'decimal-pad' : 'default'}
    />
  );
}
