import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'];

export default function PinEntryScreen() {
  const { role } = useLocalSearchParams<{ role: 'owner' | 'tenant' }>();
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submitPin(fullPin: string) {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('pin-login', {
        body: { role, pin: fullPin },
      });

      if (fnError || !data?.token_hash) {
        setError((data as any)?.error ?? 'Incorrect PIN. Please try again.');
        setPin('');
        setLoading(false);
        return;
      }

      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: data.token_hash,
        type: 'magiclink',
      });

      if (verifyError) {
        setError('Could not sign you in. Please try again.');
        setPin('');
        setLoading(false);
        return;
      }
      // Session is now set — the root layout's auth listener takes over
      // and routes to the right dashboard. No manual navigation needed.
    } catch {
      setError('Something went wrong. Please try again.');
      setPin('');
      setLoading(false);
    }
  }

  function press(key: string) {
    if (loading) return;
    if (key === '' ) return;
    if (key === 'back') {
      setPin((p) => p.slice(0, -1));
      setError(null);
      return;
    }
    if (pin.length >= 4) return;
    const next = pin + key;
    setPin(next);
    setError(null);
    if (next.length === 4) submitPin(next);
  }

  return (
    <View className="flex-1 justify-center px-8 bg-pageBg">
      <TouchableOpacity onPress={() => router.back()} className="absolute top-16 left-8 w-9 h-9 rounded-full bg-card border border-navy-border items-center justify-center">
        <Feather name="chevron-left" size={20} color="#1F2F3A" />
      </TouchableOpacity>

      <View className="items-center mb-12">
        <Text className="text-3xl text-navy font-sansBold mb-2">Enter your PIN</Text>
        <Text className="text-navy-muted font-sans text-base">
          {role === 'owner' ? 'Property Partner' : 'Resident'}
        </Text>
      </View>

      <View className="flex-row justify-center gap-4 mb-6">
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            className="w-5 h-5 rounded-full border-2 border-navy"
            style={{ backgroundColor: pin.length > i ? '#1F2F3A' : 'transparent' }}
          />
        ))}
      </View>

      <View style={{ height: 24 }} className="items-center justify-center mb-6">
        {loading ? (
          <ActivityIndicator color="#1F2F3A" />
        ) : error ? (
          <Text className="text-burgundy font-sansBold text-sm text-center px-4">{error}</Text>
        ) : null}
      </View>

      <View className="flex-row flex-wrap justify-center" style={{ maxWidth: 320, alignSelf: 'center' }}>
        {KEYS.map((key, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => press(key)}
            disabled={key === '' || loading}
            style={{ width: 88, height: 88, margin: 8 }}
            className="items-center justify-center rounded-full"
          >
            {key === 'back' ? (
              <Feather name="delete" size={24} color="#1F2F3A" />
            ) : key ? (
              <Text className="text-navy text-3xl font-sansBold">{key}</Text>
            ) : null}
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity onPress={() => router.push('/(auth)/login')} className="mt-10 items-center">
        <Text className="text-navy/60 text-sm font-sansBold">Having trouble? Sign in with email instead</Text>
      </TouchableOpacity>
    </View>
  );
}
