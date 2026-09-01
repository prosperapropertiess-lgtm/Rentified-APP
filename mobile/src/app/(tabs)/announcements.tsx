import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Switch } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

// Module 3: Property Announcements (spec B section 3). Direct
// tenant-to-owner messaging already exists as a real threaded chat
// (messages.tsx, backed by the `messages` table) — this screen is
// deliberately scoped to the piece that was actually missing, broadcast
// property announcements, rather than rebuilding direct messaging on top
// of the batch communications pipeline and ending up with two competing
// "direct message" systems (spec 3.11 explicitly warns against a chaotic
// mixed stream — keeping these two paths separate honors that).

const TEMPLATES = [
  { id: 'water_shutdown', title: 'Water Shutdown', body: '{{greeting}}\n\nWater service at {{property_address}} will be shut off temporarily for maintenance. We will notify you when it is restored.\n\nThank you for your patience.' },
  { id: 'planned_maintenance', title: 'Planned Maintenance', body: '{{greeting}}\n\nWe have scheduled maintenance work at {{property_address}}. Please expect some noise and activity during this time.\n\nThank you.' },
  { id: 'inspection', title: 'Property Inspection', body: '{{greeting}}\n\nA routine inspection of {{property_address}} is scheduled. We will provide advance notice of the exact date/time as required.\n\nThank you.' },
  { id: 'fire_alarm', title: 'Fire Alarm Testing', body: '{{greeting}}\n\nFire alarm testing will take place at {{property_address}}. You may hear brief alarm activations — this is expected and no action is needed.\n\nThank you.' },
  { id: 'snow_removal', title: 'Snow Removal', body: '{{greeting}}\n\nSnow removal is scheduled at {{property_address}}. Please move vehicles from affected areas if requested.\n\nThank you.' },
  { id: 'parking', title: 'Parking Reminder', body: '{{greeting}}\n\nThis is a reminder about parking policies at {{property_address}}{{unit}}. Please ensure vehicles are parked in designated spots only.\n\nThank you.' },
  { id: 'garbage', title: 'Garbage / Recycling', body: '{{greeting}}\n\nA reminder about garbage and recycling collection at {{property_address}}. Please have bins out by the scheduled time.\n\nThank you.' },
  { id: 'contractor_access', title: 'Contractor Access', body: '{{greeting}}\n\nA contractor will require access to {{property_address}}{{unit}} for scheduled work. We will do our best to minimize disruption.\n\nThank you.' },
  { id: 'general', title: 'General Announcement', body: '{{greeting}}\n\n[Your message here]\n\nThank you,\n{{property_address}} management' },
];

interface PropertyOption { id: string; name: string | null; address: string | null }
interface ScheduledRow { id: string; type: string; subject: string | null; body: string; scheduled_at: string; properties: { name: string | null; address: string | null } | null }

function randomIdempotencyKey(): string {
  return `idem_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export default function AnnouncementsScreen() {
  const { profileId } = useAuth();
  const router = useRouter();
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [channels, setChannels] = useState<Set<string>>(new Set(['EMAIL', 'IN_APP']));
  const [urgent, setUrgent] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const sendRef = React.useRef(false);
  const [scheduleMode, setScheduleMode] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [scheduled, setScheduled] = useState<ScheduledRow[]>([]);

  const load = useCallback(async () => {
    if (!profileId) return;
    const { data } = await supabase.from('properties').select('id, name, address').eq('landlord_id', profileId);
    setProperties((data ?? []) as PropertyOption[]);
    if (!propertyId && data && data.length > 0) setPropertyId(data[0].id);

    const { data: scheduledData } = await supabase.functions.invoke('announcements', { body: { action: 'list_scheduled' } });
    setScheduled(((scheduledData as any)?.scheduled ?? []) as ScheduledRow[]);
  }, [profileId, propertyId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function applyTemplate(t: typeof TEMPLATES[number]) {
    setSubject(t.title);
    setMessage(t.body);
    setPreview(null);
  }

  async function runPreview() {
    if (!propertyId || !message.trim()) return;
    setPreviewing(true);
    const { data, error } = await supabase.functions.invoke('announcements', {
      body: { action: 'preview_property', propertyId, channels: Array.from(channels), customMessage: message, subject: subject || undefined },
    });
    setPreviewing(false);
    if (error || (data as any)?.error) {
      Alert.alert('Could not preview', (data as any)?.message ?? (data as any)?.error ?? error?.message ?? 'Please try again.');
      return;
    }
    setPreview(data);
  }

  async function doSend() {
    if (!propertyId || !message.trim() || sendRef.current) return;
    sendRef.current = true;
    setSending(true);
    const { data, error } = await supabase.functions.invoke('announcements', {
      body: { action: 'send_property', propertyId, channels: Array.from(channels), customMessage: message, subject: (urgent ? 'URGENT: ' : '') + (subject || 'Property Announcement'), idempotencyKey: randomIdempotencyKey() },
    });
    setSending(false);
    sendRef.current = false;
    if (error || (data as any)?.error) {
      Alert.alert('Could not send', (data as any)?.message ?? (data as any)?.error ?? error?.message ?? 'Please try again.');
      return;
    }
    Alert.alert('Announcement sent', `${(data as any).sentCount} sent, ${(data as any).failedCount} failed.`);
    resetForm();
  }

  function confirmSend() {
    if (!preview) { Alert.alert('Preview first', 'Preview the announcement to see who will receive it before sending.'); return; }
    const audienceLine = `${preview.recipientCount} recipient${preview.recipientCount === 1 ? '' : 's'} at this property.`;
    Alert.alert(
      urgent ? 'Send Urgent Update?' : 'Send Announcement?',
      `${audienceLine}\n\nThis cannot be undone.`,
      [{ text: 'Cancel', style: 'cancel' }, { text: urgent ? 'Send Urgent Update' : 'Send', onPress: doSend }]
    );
  }

  async function doSchedule() {
    if (!propertyId || !message.trim() || !scheduledAt || sendRef.current) return;
    sendRef.current = true;
    setSending(true);
    const { data, error } = await supabase.functions.invoke('announcements', {
      body: { action: 'schedule_property', propertyId, channels: Array.from(channels), customMessage: message, subject: subject || 'Property Announcement', scheduledAt: new Date(scheduledAt).toISOString() },
    });
    setSending(false);
    sendRef.current = false;
    if (error || (data as any)?.error) {
      Alert.alert('Could not schedule', (data as any)?.message ?? (data as any)?.error ?? error?.message ?? 'Please try again.');
      return;
    }
    Alert.alert('Scheduled', 'This announcement will send at the scheduled time. Recipients are resolved automatically at send time, so no one who has since moved out will receive it.');
    resetForm();
    load();
  }

  async function cancelScheduled(id: string) {
    const { error } = await supabase.functions.invoke('announcements', { body: { action: 'cancel_scheduled', communicationId: id } });
    if (error) { Alert.alert('Could not cancel', error.message); return; }
    load();
  }

  function resetForm() {
    setSubject(''); setMessage(''); setPreview(null); setScheduleMode(false); setScheduledAt(''); setUrgent(false);
  }

  const messageLength = message.length;
  const smsSegments = Math.ceil(messageLength / 153) || 0;

  return (
    <View className="flex-1 bg-pageBg">
      <View className="pt-16 px-6 pb-6 bg-card border-b border-navy-border flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="mr-3 w-9 h-9 rounded-full bg-pageBg border border-navy-border items-center justify-center">
          <Feather name="chevron-left" size={20} color="#1F2F3A" />
        </TouchableOpacity>
        <Text className="text-xl font-sansBold text-navy">Announcements</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 60 }}>
        {scheduled.length > 0 && (
          <View className="mb-6">
            <Text className="text-navy font-sansBold text-[16px] mb-3">Scheduled</Text>
            {scheduled.map((s) => (
              <View key={s.id} className="bg-card rounded-2xl p-4 border border-navy-border mb-2">
                <Text className="text-navy font-sansBold text-[13px] mb-1">{s.subject ?? 'Announcement'}</Text>
                <Text className="text-navy-muted font-sans text-[12px] mb-2">
                  {s.properties?.name ?? s.properties?.address ?? ''} · {new Date(s.scheduled_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                </Text>
                <TouchableOpacity onPress={() => cancelScheduled(s.id)} className="self-start px-3 py-1.5 rounded-full border border-burgundy">
                  <Text className="text-burgundy font-sansBold text-[11px]">Cancel</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <Text className="text-navy font-sansBold text-[16px] mb-3">New Announcement</Text>

        <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Property</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4" contentContainerStyle={{ gap: 8 }}>
          {properties.map((p) => (
            <TouchableOpacity key={p.id} onPress={() => { setPropertyId(p.id); setPreview(null); }} className="px-4 py-2.5 rounded-full border" style={{ borderColor: propertyId === p.id ? '#1F2F3A' : '#D8D2C8', backgroundColor: propertyId === p.id ? '#1F2F3A' : '#FFFFFF' }}>
              <Text className="font-sansBold text-[13px]" style={{ color: propertyId === p.id ? '#FFFFFF' : '#333333' }}>{p.name || p.address}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Templates</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4" contentContainerStyle={{ gap: 8 }}>
          {TEMPLATES.map((t) => (
            <TouchableOpacity key={t.id} onPress={() => applyTemplate(t)} className="px-3.5 py-2 rounded-full border border-navy-border bg-white">
              <Text className="font-sansBold text-[12px] text-navy">{t.title}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Subject</Text>
        <TextInput className="bg-card border border-navy-border rounded-xl p-4 font-sans text-navy mb-4" value={subject} onChangeText={setSubject} placeholder="e.g. Water Shutdown" placeholderTextColor="#94a3b8" />

        <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Message</Text>
        <Text className="text-navy-muted font-sans text-[11px] mb-2">Available: {'{{greeting}}'} {'{{property_address}}'} {'{{unit}}'} — missing names fall back to &ldquo;Hello,&rdquo; never &ldquo;undefined.&rdquo;</Text>
        <TextInput
          className="bg-card border border-navy-border rounded-xl p-4 font-sans text-navy mb-1"
          value={message}
          onChangeText={(t) => { setMessage(t); setPreview(null); }}
          multiline
          numberOfLines={6}
          style={{ minHeight: 140, textAlignVertical: 'top' }}
          placeholder="Write your announcement..."
          placeholderTextColor="#94a3b8"
        />
        <Text className="text-navy-muted font-sans text-[11px] mb-4">{messageLength} characters{smsSegments > 1 ? ` · would be ${smsSegments} SMS segments if SMS were enabled` : ''}</Text>

        <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Channels</Text>
        <View className="gap-2 mb-4">
          {(['EMAIL', 'SMS', 'IN_APP'] as const).map((ch) => (
            <View key={ch} className="flex-row items-center justify-between bg-card rounded-xl p-3 border border-navy-border" style={{ opacity: ch === 'SMS' ? 0.5 : 1 }}>
              <Text className="text-navy font-sans text-[13px]">{ch === 'EMAIL' ? 'Email' : ch === 'SMS' ? 'SMS (not configured yet)' : 'In-app'}</Text>
              <Switch
                value={channels.has(ch)}
                disabled={ch === 'SMS'}
                onValueChange={(v) => { setChannels((prev) => { const next = new Set(prev); if (v) next.add(ch); else next.delete(ch); return next; }); setPreview(null); }}
                trackColor={{ true: '#1F2F3A' }}
              />
            </View>
          ))}
        </View>

        <View className="flex-row items-center justify-between bg-card rounded-xl p-3.5 border border-navy-border mb-4">
          <View className="flex-1 pr-3">
            <Text className="text-navy font-sansBold text-[13px]">Mark Urgent</Text>
            <Text className="text-navy-muted font-sans text-[11px] mt-0.5">Prefixes the subject and requires an extra confirmation before sending.</Text>
          </View>
          <Switch value={urgent} onValueChange={setUrgent} trackColor={{ true: '#8B2030' }} />
        </View>

        <TouchableOpacity onPress={runPreview} disabled={previewing || !propertyId || !message.trim()} className="border border-navy-border py-3.5 rounded-xl items-center mb-4" style={{ opacity: !message.trim() ? 0.5 : 1 }}>
          <Text className="text-navy font-sansBold text-[13px]">{previewing ? 'Checking...' : 'Preview Recipients'}</Text>
        </TouchableOpacity>

        {preview && (
          <View className="bg-card rounded-2xl p-4 border border-navy-border mb-4">
            <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Audience</Text>
            <Text className="text-navy font-sansBold text-[16px] mb-1">{preview.recipientCount} active leaseholder{preview.recipientCount === 1 ? '' : 's'}</Text>
            <Text className="text-navy-muted font-sans text-[12px] mb-3">{preview.totalUnits} total units · {preview.vacantCount} vacant (excluded)</Text>
            <View className="flex-row gap-4 mb-3">
              <Text className="text-navy-muted font-sans text-[12px]">Email: {preview.channelCounts.EMAIL}</Text>
              <Text className="text-navy-muted font-sans text-[12px]">SMS: {preview.channelCounts.SMS}</Text>
              <Text className="text-navy-muted font-sans text-[12px]">In-app: {preview.channelCounts.IN_APP}</Text>
            </View>
            {preview.recipients.some((r: any) => r.excludedChannels.length > 0) && (
              <View>
                <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-1">Exclusions</Text>
                {preview.recipients.filter((r: any) => r.excludedChannels.length > 0).map((r: any, i: number) => (
                  <Text key={i} className="text-amber-700 font-sans text-[11px] mt-0.5">{r.tenantName} — {r.excludedChannels.map((e: any) => e.reason).join(', ')}</Text>
                ))}
              </View>
            )}
          </View>
        )}

        <View className="flex-row items-center justify-between bg-card rounded-xl p-3.5 border border-navy-border mb-4">
          <Text className="text-navy font-sansBold text-[13px]">Schedule for later</Text>
          <Switch value={scheduleMode} onValueChange={setScheduleMode} trackColor={{ true: '#1F2F3A' }} />
        </View>

        {scheduleMode && (
          <View className="mb-4">
            <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Send at</Text>
            <TextInput className="bg-card border border-navy-border rounded-xl p-4 font-sans text-navy" value={scheduledAt} onChangeText={setScheduledAt} placeholder="YYYY-MM-DD HH:MM" placeholderTextColor="#94a3b8" />
            <Text className="text-navy-muted font-sans text-[11px] mt-2">Recipients are resolved right before sending, not now — anyone who moves out before then won&apos;t receive it.</Text>
          </View>
        )}

        <TouchableOpacity
          onPress={scheduleMode ? doSchedule : confirmSend}
          disabled={sending || !propertyId || !message.trim() || (scheduleMode && !scheduledAt)}
          className="py-4 rounded-xl items-center"
          style={{ backgroundColor: urgent ? '#8B2030' : '#1F2F3A', opacity: !message.trim() ? 0.5 : 1 }}
        >
          {sending ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-sansBold text-[15px]">{scheduleMode ? 'Schedule Announcement' : urgent ? 'Send Urgent Update' : 'Send Announcement'}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
