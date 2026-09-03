import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface Identity {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  notification_prefs?: { push?: boolean; email?: boolean } | null;
}

export default function ProfileScreen() {
  const { role, profileId } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [notifications, setNotifications] = useState(true);
  const [emails, setEmails] = useState(false);

  const fetchIdentity = useCallback(async () => {
    if (!profileId || !role) return;
    try {
      const table = role === 'owner' ? 'landlords' : 'tenants';
      const columns = role === 'owner'
        ? 'first_name, last_name, email, phone, notification_prefs'
        : 'first_name, last_name, email, phone';
      const { data } = await supabase.from(table).select(columns).eq('id', profileId).single();

      if (data) {
        setIdentity(data as unknown as Identity);
        const prefs = (data as unknown as Identity).notification_prefs;
        if (prefs) {
          setNotifications(prefs.push ?? true);
          setEmails(prefs.email ?? false);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [profileId, role]);

  useFocusEffect(useCallback(() => { fetchIdentity(); }, [fetchIdentity]));

  async function updatePrefs(next: { push?: boolean; email?: boolean }) {
    if (role !== 'owner' || !profileId) return; // notification_prefs only exists on landlords today
    const merged = { push: notifications, email: emails, ...next };
    await supabase.from('landlords').update({ notification_prefs: merged }).eq('id', profileId);
  }

  const name = `${identity?.first_name ?? ''} ${identity?.last_name ?? ''}`.trim() || 'Your account';
  const roleLabel = role === 'owner' ? 'Owner' : role === 'tenant' ? 'Resident' : '';

  if (loading) return <View className="flex-1 bg-pageBg justify-center items-center"><ActivityIndicator color="#1F2F3A" /></View>;

  return (
    <ScrollView className="flex-1 bg-pageBg">
      <View className="pt-16 pb-8 px-6 items-center bg-card border-b border-navy-border">
        <View className="w-24 h-24 rounded-full bg-pageBg border-2 border-navy-border items-center justify-center mb-5 overflow-hidden">
          <Feather name="user" size={40} color="#1F2F3A" />
        </View>
        <Text className="text-2xl font-sansBold text-navy">{name}</Text>
        {roleLabel ? <Text className="text-base font-sans text-navy-muted mt-1.5">{roleLabel}</Text> : null}
      </View>

      <View className="p-6">
        <Text className="text-sm font-sansBold text-navy-muted uppercase mb-3 ml-1">Personal Information</Text>
        <View className="bg-card rounded-2xl border border-navy-border overflow-hidden mb-9">
          <View className="px-5 py-5 border-b border-navy-border flex-row justify-between items-center">
            <Text className="text-base font-sans text-navy">Email</Text>
            <Text className="text-base font-sans text-navy-muted">{identity?.email || '—'}</Text>
          </View>
          <View className="px-5 py-5 flex-row justify-between items-center">
            <Text className="text-base font-sans text-navy">Phone</Text>
            <Text className="text-base font-sans text-navy-muted">{identity?.phone || '—'}</Text>
          </View>
        </View>

        <Text className="text-sm font-sansBold text-navy-muted uppercase mb-3 ml-1">Preferences</Text>
        <View className="bg-card rounded-2xl border border-navy-border overflow-hidden mb-9">
          <View className="px-5 py-5 border-b border-navy-border flex-row justify-between items-center">
            <View className="flex-row items-center">
              <Feather name="bell" size={20} color="#1F2F3A" style={{ marginRight: 14 }} />
              <Text className="text-base font-sans text-navy">Push Notifications</Text>
            </View>
            <Switch
              value={notifications}
              onValueChange={(v) => { setNotifications(v); updatePrefs({ push: v }); }}
              trackColor={{ false: '#767577', true: '#10B981' }}
            />
          </View>
          <View className="px-5 py-5 flex-row justify-between items-center">
            <View className="flex-row items-center">
              <Feather name="mail" size={20} color="#1F2F3A" style={{ marginRight: 14 }} />
              <Text className="text-base font-sans text-navy">Email Updates</Text>
            </View>
            <Switch
              value={emails}
              onValueChange={(v) => { setEmails(v); updatePrefs({ email: v }); }}
              trackColor={{ false: '#767577', true: '#10B981' }}
            />
          </View>
        </View>

        {role === 'owner' && (
          <>
            <Text className="text-sm font-sansBold text-navy-muted uppercase mb-3 ml-1">Developer</Text>
            <TouchableOpacity
              className="bg-card rounded-2xl border border-navy-border py-5 px-5 flex-row justify-between items-center mb-9"
              onPress={() => router.push('/test-lab')}
            >
              <View className="flex-row items-center">
                <Feather name="terminal" size={20} color="#1F2F3A" style={{ marginRight: 14 }} />
                <Text className="text-base font-sans text-navy">Test Lab</Text>
              </View>
              <Feather name="chevron-right" size={18} color="#1F2F3A" style={{ opacity: 0.4 }} />
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity
          className="bg-card rounded-2xl border border-navy-border py-5 flex-row justify-center items-center mt-2"
          onPress={async () => {
            await supabase.auth.signOut();
          }}
        >
          <Text className="text-base font-sansBold text-burgundy">Sign Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
