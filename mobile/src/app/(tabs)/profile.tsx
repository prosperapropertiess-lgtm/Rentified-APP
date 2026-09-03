import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, ActivityIndicator, Modal, TextInput, KeyboardAvoidingView, Platform, Alert } from 'react-native';
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

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

  async function deleteAccount() {
    setDeleting(true);
    try {
      const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
      if (error) throw error;
      // The account (and its auth session) no longer exists server-side —
      // sign out locally to clear the stale session and land back on
      // role-select via the root layout's normal redirect guard.
      await supabase.auth.signOut();
    } catch (err: any) {
      setDeleting(false);
      setShowDeleteConfirm(false);
      setDeleteConfirmText('');
      Alert.alert('Could not delete account', err.message || 'Please try again.');
    }
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

        <TouchableOpacity
          className="py-5 flex-row justify-center items-center mt-2"
          onPress={() => setShowDeleteConfirm(true)}
        >
          <Text className="text-sm font-sans text-navy-muted" style={{ opacity: 0.6 }}>Delete Account</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={showDeleteConfirm} animationType="slide" transparent onRequestClose={() => setShowDeleteConfirm(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 justify-end">
          <View className="bg-card rounded-t-[28px] p-6" style={{ maxHeight: '85%' }}>
            <Text className="text-navy font-sansBold text-[19px] mb-2">Delete Account</Text>
            <Text className="text-navy-muted font-sans text-[14px] leading-relaxed mb-4">
              {role === 'owner'
                ? 'This permanently deletes your account and everything in it — every property, unit, resident, lease, payment record, and maintenance request you manage. This cannot be undone.'
                : 'This permanently deletes your account, including your maintenance requests and payment history. This cannot be undone.'}
            </Text>

            <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">
              Type DELETE to confirm
            </Text>
            <TextInput
              className="bg-pageBg border border-navy-border rounded-xl p-4 font-sans text-navy mb-6"
              placeholder="DELETE"
              placeholderTextColor="#94a3b8"
              autoCapitalize="characters"
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
            />

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }}
                className="flex-1 py-4 rounded-xl items-center border border-navy-border"
              >
                <Text className="text-navy-muted font-sansBold text-[15px]">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={deleteAccount}
                disabled={deleting || deleteConfirmText !== 'DELETE'}
                className="flex-1 bg-burgundy py-4 rounded-xl items-center"
                style={{ opacity: deleteConfirmText !== 'DELETE' ? 0.4 : 1 }}
              >
                <Text className="text-white font-sansBold text-[15px]">{deleting ? 'Deleting...' : 'Delete Forever'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}
