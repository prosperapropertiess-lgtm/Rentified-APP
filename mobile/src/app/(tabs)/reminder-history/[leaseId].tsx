import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';

interface DeliveryRow {
  channel: string;
  status: string;
  sent_at: string | null;
  delivered_at: string | null;
  failure_message: string | null;
  failure_code: string | null;
}

interface ReminderRow {
  id: string;
  created_at: string;
  rendered_body: string;
  deliveries: DeliveryRow[];
}

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  DELIVERED: { bg: '#dcfce7', color: '#15803d', label: 'Delivered' },
  SENT: { bg: '#e0e7ff', color: '#3730a3', label: 'Sent' },
  FAILED: { bg: '#fee2e2', color: '#991b1b', label: 'Failed' },
  SKIPPED_NO_CHANNEL: { bg: '#f1f5f9', color: '#64748b', label: 'Skipped' },
};

const CHANNEL_LABEL: Record<string, string> = { EMAIL: 'Email', SMS: 'SMS', IN_APP: 'In-app' };

export default function ReminderHistoryScreen() {
  const { leaseId } = useLocalSearchParams<{ leaseId: string }>();
  const { profileId } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [tenantName, setTenantName] = useState('');
  const [propertyLabel, setPropertyLabel] = useState('');
  const [reminders, setReminders] = useState<ReminderRow[]>([]);

  const load = useCallback(async () => {
    if (!profileId || !leaseId) return;
    setLoading(true);

    const { data: lease } = await supabase
      .from('leases')
      .select(`id, tenants ( first_name, last_name ), units ( unit_number, properties ( name, address ) )`)
      .eq('id', leaseId)
      .eq('landlord_id', profileId)
      .maybeSingle();

    if (lease) {
      const t = (lease as any).tenants;
      const u = (lease as any).units;
      setTenantName(`${t?.first_name ?? ''} ${t?.last_name ?? ''}`.trim() || 'Tenant');
      const property = u?.properties?.name ?? u?.properties?.address ?? 'Property';
      setPropertyLabel(`${property}${u?.unit_number ? ` · Unit ${u.unit_number}` : ''}`);
    }

    const { data: recipients } = await supabase
      .from('communication_recipients')
      .select(`id, created_at, rendered_body, communications!inner ( type, landlord_id ), communication_deliveries ( channel, status, sent_at, delivered_at, failure_message, failure_code )`)
      .eq('lease_id', leaseId)
      .eq('communications.type', 'RENT_REMINDER')
      .eq('communications.landlord_id', profileId)
      .order('created_at', { ascending: false });

    const mapped: ReminderRow[] = (recipients ?? []).map((r: any) => ({
      id: r.id,
      created_at: r.created_at,
      rendered_body: r.rendered_body,
      deliveries: r.communication_deliveries ?? [],
    }));

    setReminders(mapped);
    setLoading(false);
  }, [profileId, leaseId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View className="flex-1 bg-pageBg">
      <View className="pt-16 px-6 pb-6 bg-card border-b border-navy-border flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="mr-3 w-9 h-9 rounded-full bg-pageBg border border-navy-border items-center justify-center">
          <Feather name="chevron-left" size={20} color="#1F2F3A" />
        </TouchableOpacity>
        <View>
          <Text className="text-xl font-sansBold text-navy">Reminder History</Text>
          {!!tenantName && <Text className="text-navy-muted font-sans text-[12px] mt-0.5">{tenantName} · {propertyLabel}</Text>}
        </View>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center"><ActivityIndicator color="#1F2F3A" /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 60 }}>
          {reminders.length === 0 && (
            <Text className="text-navy-muted font-sans text-[14px] text-center mt-8">No reminders have been sent to this tenancy yet.</Text>
          )}

          {reminders.map((r) => (
            <View key={r.id} className="bg-card rounded-2xl p-4 border border-navy-border mb-3">
              <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">
                {new Date(r.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
              </Text>
              <Text className="text-navy font-sans text-[13px] mb-3" numberOfLines={4}>{r.rendered_body}</Text>
              <View className="flex-row flex-wrap gap-2">
                {r.deliveries.map((d, i) => {
                  const style = STATUS_STYLE[d.status] ?? { bg: '#f1f5f9', color: '#64748b', label: d.status };
                  return (
                    <View key={i} className="px-2.5 py-1 rounded-full flex-row items-center" style={{ backgroundColor: style.bg }}>
                      <Text className="font-sansBold text-[11px]" style={{ color: style.color }}>
                        {CHANNEL_LABEL[d.channel] ?? d.channel} · {style.label}
                      </Text>
                    </View>
                  );
                })}
              </View>
              {r.deliveries.some((d) => d.status === 'FAILED' && d.failure_message) && (
                <Text className="text-burgundy font-sans text-[11px] mt-2">
                  {r.deliveries.find((d) => d.status === 'FAILED')?.failure_message}
                </Text>
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
