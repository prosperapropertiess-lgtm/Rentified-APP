import React, { useEffect, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';

// Real signals only — no invented activity feed. Bell taps show what
// actually needs the owner's attention right now, each linking to the tab
// that handles it, rather than a scrollable log of fabricated events.

type Props = {
  visible: boolean;
  onClose: () => void;
  profileId: string;
};

export default function NotificationsModal({ visible, onClose, profileId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [openIssues, setOpenIssues] = useState(0);
  const [unpaidCount, setUnpaidCount] = useState(0);

  useEffect(() => {
    if (!visible || !profileId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: authData } = await supabase.auth.getUser();
      const myAuthId = authData.user?.id;

      const [{ count: msgCount }, { count: issueCount }, { count: unpaid }] = await Promise.all([
        myAuthId
          ? supabase.from('messages').select('id', { count: 'exact', head: true }).eq('receiver_id', myAuthId).eq('read', false)
          : Promise.resolve({ count: 0 }),
        supabase.from('maintenance_requests').select('id', { count: 'exact', head: true }).eq('landlord_id', profileId).not('status', 'in', '(resolved,closed)'),
        supabase.from('payments').select('id', { count: 'exact', head: true }).eq('landlord_id', profileId).in('status', ['pending', 'overdue', 'partial']),
      ]);

      if (!cancelled) {
        setUnreadMessages(msgCount ?? 0);
        setOpenIssues(issueCount ?? 0);
        setUnpaidCount(unpaid ?? 0);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [visible, profileId]);

  function go(path: string) {
    onClose();
    router.push(path as any);
  }

  const rows = [
    { key: 'messages', icon: 'message-circle' as const, label: 'Unread messages', count: unreadMessages, path: '/messages', color: '#1F2F3A' },
    { key: 'maintenance', icon: 'tool' as const, label: 'Open maintenance requests', count: openIssues, path: '/maintenance', color: '#8B2030' },
    { key: 'payments', icon: 'dollar-sign' as const, label: 'Rent needing action', count: unpaidCount, path: '/(tabs)/payments', color: '#D97706' },
  ];
  const total = unreadMessages + openIssues + unpaidCount;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/50 justify-end">
        <View className="bg-white rounded-t-[32px] p-6 border-t border-navy-border" style={{ paddingBottom: 40 }}>
          <View className="flex-row justify-between items-center mb-5">
            <Text className="text-[22px] text-navy font-sansBold">Notifications</Text>
            <TouchableOpacity onPress={onClose} className="w-8 h-8 rounded-full bg-pageBg items-center justify-center border border-navy-border">
              <Feather name="x" size={18} color="#0F1C28" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator color="#1F2F3A" style={{ marginVertical: 24 }} />
          ) : total === 0 ? (
            <View className="items-center py-6">
              <Feather name="check-circle" size={28} color="#059669" />
              <Text className="text-navy-muted font-sans text-center mt-2">You&apos;re all caught up.</Text>
            </View>
          ) : (
            <View className="gap-3">
              {rows.filter((r) => r.count > 0).map((r) => (
                <TouchableOpacity
                  key={r.key}
                  onPress={() => go(r.path)}
                  className="flex-row items-center p-4 rounded-2xl border border-navy-border bg-pageBg"
                >
                  <View className="w-10 h-10 rounded-full items-center justify-center mr-3" style={{ backgroundColor: `${r.color}1A` }}>
                    <Feather name={r.icon} size={18} color={r.color} />
                  </View>
                  <Text className="flex-1 text-navy font-sansBold text-[15px]">{r.label}</Text>
                  <View className="bg-navy px-2.5 py-1 rounded-full mr-2">
                    <Text className="text-white font-sansBold text-[12px]">{r.count}</Text>
                  </View>
                  <Feather name="chevron-right" size={18} color="#1F2F3A" style={{ opacity: 0.3 }} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
