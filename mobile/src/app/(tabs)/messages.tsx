import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

// Real feature, not a port — the web owner/tenant portals run on a separate
// database with a token-based auth model, so there's no existing
// implementation to mirror. Built fresh against Rentified's own `messages`
// table (sender_id/receiver_id are auth.users.id — the one ID space shared
// by both landlords and tenants; profileId differs per role).

interface MessageRow {
  id: string;
  sender_id: string;
  receiver_id: string;
  lease_id: string;
  body: string;
  read: boolean;
  created_at: string;
}

interface ThreadTarget {
  leaseId: string;
  otherAuthId: string;
  otherName: string;
  unitLabel: string;
}

export default function MessagesScreen() {
  const { role, user, profileId } = useAuth();
  const router = useRouter();
  const [thread, setThread] = useState<ThreadTarget | null>(null);

  if (!user || !profileId) {
    return <View className="flex-1 bg-pageBg justify-center items-center"><ActivityIndicator color="#1F2F3A" /></View>;
  }

  if (role === 'tenant') {
    return <TenantMessages myAuthId={user.id} profileId={profileId} router={router} />;
  }

  return thread
    ? <ThreadView myAuthId={user.id} target={thread} onBack={() => setThread(null)} router={router} backLabel={thread.otherName} />
    : <OwnerThreadList profileId={profileId} onOpenThread={setThread} router={router} />;
}

// ── Tenant: resolves their landlord, then shows the single thread ──────────
function TenantMessages({ myAuthId, profileId, router }: { myAuthId: string; profileId: string; router: ReturnType<typeof useRouter> }) {
  const [target, setTarget] = useState<ThreadTarget | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: lease } = await supabase
        .from('leases')
        .select('id, landlord_id, units ( unit_number, properties ( name, address ) )')
        .eq('tenant_id', profileId)
        .limit(1)
        .maybeSingle();

      if (!lease) { setNotFound(true); setLoading(false); return; }

      const { data: landlord } = await supabase
        .from('landlords')
        .select('user_id, first_name, last_name')
        .eq('id', (lease as any).landlord_id)
        .single();

      if (!landlord?.user_id) { setNotFound(true); setLoading(false); return; }

      const units = (lease as any).units as { unit_number: string | null; properties: { name: string | null; address: string | null } | null } | null;
      const unitLabel = units?.unit_number
        ? `${units.properties?.name ?? units.properties?.address ?? ''} · Unit ${units.unit_number}`
        : units?.properties?.name ?? units?.properties?.address ?? '';

      setTarget({
        leaseId: (lease as any).id,
        otherAuthId: landlord.user_id,
        otherName: `${landlord.first_name ?? ''} ${landlord.last_name ?? ''}`.trim() || 'Your landlord',
        unitLabel,
      });
      setLoading(false);
    })();
  }, [profileId]);

  if (loading) return <View className="flex-1 bg-pageBg justify-center items-center"><ActivityIndicator color="#1F2F3A" /></View>;

  if (notFound || !target) {
    return (
      <View className="flex-1 bg-pageBg justify-center items-center px-8">
        <Text className="text-navy-muted font-sans text-center">No active lease found, so there&apos;s no landlord to message yet.</Text>
      </View>
    );
  }

  return <ThreadView myAuthId={myAuthId} target={target} onBack={() => router.back()} router={router} backLabel="Back" />;
}

// ── Owner: list of tenants with unread counts, tap to open a thread ────────
function OwnerThreadList({ profileId, onOpenThread, router }: {
  profileId: string;
  onOpenThread: (t: ThreadTarget) => void;
  router: ReturnType<typeof useRouter>;
}) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<{ target: ThreadTarget; lastBody: string | null; lastAt: string | null; unread: number }[]>([]);

  useEffect(() => {
    (async () => {
      const { data: authData } = await supabase.auth.getUser();
      const myAuthId = authData.user?.id;
      if (!myAuthId) { setLoading(false); return; }

      const { data: tenants } = await supabase
        .from('tenants')
        .select(`
          first_name, last_name, user_id,
          leases ( id, units ( unit_number, properties ( name, address ) ) )
        `)
        .eq('landlord_id', profileId);

      const { data: messages } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${myAuthId},receiver_id.eq.${myAuthId}`)
        .order('created_at', { ascending: false });

      const msgs = (messages ?? []) as MessageRow[];

      const built = (tenants ?? [])
        .filter((t: any) => t.user_id)
        .map((t: any) => {
          const lease = Array.isArray(t.leases) ? t.leases[0] : t.leases;
          const units = lease?.units;
          const unitLabel = units?.unit_number
            ? `${units.properties?.name ?? units.properties?.address ?? ''} · Unit ${units.unit_number}`
            : units?.properties?.name ?? units?.properties?.address ?? '';

          const threadMsgs = msgs.filter((m) => m.sender_id === t.user_id || m.receiver_id === t.user_id);
          const unread = threadMsgs.filter((m) => m.receiver_id === myAuthId && !m.read).length;

          return {
            target: {
              leaseId: lease?.id ?? '',
              otherAuthId: t.user_id,
              otherName: `${t.first_name ?? ''} ${t.last_name ?? ''}`.trim() || 'Resident',
              unitLabel,
            },
            lastBody: threadMsgs[0]?.body ?? null,
            lastAt: threadMsgs[0]?.created_at ?? null,
            unread,
          };
        })
        .filter((r: any) => r.target.leaseId);

      setRows(built);
      setLoading(false);
    })();
  }, [profileId]);

  return (
    <View className="flex-1 bg-pageBg">
      <View className="pt-16 px-6 pb-6 bg-card border-b border-navy-border flex-row items-center justify-between">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-3 w-9 h-9 rounded-full bg-pageBg border border-navy-border items-center justify-center">
            <Feather name="chevron-left" size={20} color="#1F2F3A" />
          </TouchableOpacity>
          <Text className="text-2xl font-sansBold text-navy">Messages</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/announcements')} className="flex-row items-center px-3.5 py-2 rounded-full bg-navy">
          <Feather name="volume-2" size={14} color="#fff" style={{ marginRight: 6 }} />
          <Text className="text-white font-sansBold text-[12px]">Announcement</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center"><ActivityIndicator color="#1F2F3A" /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 24 }}>
          {rows.length === 0 ? (
            <View className="bg-card rounded-2xl p-8 items-center border border-navy-border">
              <Text className="text-navy-muted font-sans text-center">No tenants to message yet.</Text>
            </View>
          ) : (
            rows.map((r) => (
              <TouchableOpacity
                key={r.target.otherAuthId}
                onPress={() => onOpenThread(r.target)}
                className="bg-card rounded-2xl p-5 mb-4 border border-navy-border shadow-sm flex-row items-center justify-between"
              >
                <View className="flex-1 pr-3">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-navy font-sansBold text-[16px]">{r.target.otherName}</Text>
                    {r.unread > 0 && (
                      <View className="bg-burgundy rounded-full min-w-[20px] h-5 px-1.5 items-center justify-center">
                        <Text className="text-white font-sansBold text-[11px]">{r.unread}</Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-navy-muted font-sans text-[13px] mt-1">{r.target.unitLabel}</Text>
                  {r.lastBody && (
                    <Text className="text-navy-muted font-sans text-[13px] mt-1.5" numberOfLines={1}>{r.lastBody}</Text>
                  )}
                </View>
                <Feather name="chevron-right" size={18} color="#1F2F3A" style={{ opacity: 0.3 }} />
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

// ── Shared thread view ──────────────────────────────────────────────────────
function ThreadView({ myAuthId, target, onBack, backLabel }: {
  myAuthId: string;
  target: ThreadTarget;
  onBack: () => void;
  backLabel: string;
  router: ReturnType<typeof useRouter>;
}) {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const fetchThread = useCallback(async () => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('lease_id', target.leaseId)
      .order('created_at', { ascending: true });
    setMessages((data ?? []) as MessageRow[]);
    setLoading(false);

    const unreadIds = (data ?? [])
      .filter((m: MessageRow) => m.receiver_id === myAuthId && !m.read)
      .map((m: MessageRow) => m.id);
    if (unreadIds.length > 0) {
      await supabase.from('messages').update({ read: true }).in('id', unreadIds);
    }
  }, [target.leaseId, myAuthId]);

  useEffect(() => {
    setTimeout(() => fetchThread(), 0);
    const interval = setInterval(fetchThread, 5000);
    return () => clearInterval(interval);
  }, [fetchThread]);

  async function send() {
    const text = body.trim();
    if (!text) return;
    setSending(true);
    setBody('');
    await supabase.from('messages').insert({
      sender_id: myAuthId,
      receiver_id: target.otherAuthId,
      lease_id: target.leaseId,
      body: text,
      read: false,
    });
    await fetchThread();
    setSending(false);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-pageBg" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View className="pt-16 px-6 pb-6 bg-card border-b border-navy-border flex-row items-center">
        <TouchableOpacity onPress={onBack} className="mr-3 w-9 h-9 rounded-full bg-pageBg border border-navy-border items-center justify-center">
          <Feather name="chevron-left" size={20} color="#1F2F3A" />
        </TouchableOpacity>
        <View>
          <Text className="text-lg font-sansBold text-navy">{target.otherName}</Text>
          {!!target.unitLabel && <Text className="text-navy-muted font-sans text-[12px]">{target.unitLabel}</Text>}
        </View>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center"><ActivityIndicator color="#1F2F3A" /></View>
      ) : (
        <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 20, flexGrow: 1 }} onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}>
          {messages.length === 0 ? (
            <View className="flex-1 justify-center items-center">
              <Text className="text-navy-muted font-sans text-center">No messages yet. Say hello.</Text>
            </View>
          ) : (
            messages.map((m) => {
              const mine = m.sender_id === myAuthId;
              return (
                <View key={m.id} className={`mb-3 max-w-[80%] ${mine ? 'self-end items-end' : 'self-start items-start'}`}>
                  <View className={`rounded-2xl px-4 py-3 ${mine ? 'bg-navy' : 'bg-card border border-navy-border'}`}>
                    <Text className={`font-sans text-[15px] ${mine ? 'text-white' : 'text-navy'}`}>{m.body}</Text>
                  </View>
                  <Text className="text-navy-muted font-sans text-[11px] mt-1">
                    {new Date(m.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </Text>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      <View className="flex-row items-center px-4 py-3 border-t border-navy-border bg-card gap-3">
        <TextInput
          className="flex-1 bg-pageBg rounded-full px-4 py-3 font-sans text-navy border border-navy-border"
          placeholder="Message..."
          placeholderTextColor="#94a3b8"
          value={body}
          onChangeText={setBody}
          multiline
        />
        <TouchableOpacity
          onPress={send}
          disabled={sending || !body.trim()}
          className="w-11 h-11 bg-navy rounded-full items-center justify-center"
          style={{ opacity: !body.trim() ? 0.4 : 1 }}
        >
          <Feather name="arrow-up" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
