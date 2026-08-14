import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';

export default function SetPasswordScreen() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        setError(updateError.message);
        setLoading(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        await supabase.from('landlords').upsert({
          id: user.id,
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Landlord',
          email: user.email,
        });
      }

      router.replace('/(tabs)');
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  return (
    <View className="flex-1 justify-center px-8 bg-surface">
      <View className="items-center mb-12 mt-[-10%]">
        <Text className="text-5xl text-brand-500 mb-3" style={{ fontFamily: 'Cinzel_700Bold' }}>Rentified</Text>
        <Text className="text-base text-textMain opacity-70 tracking-widest" style={{ fontFamily: 'JosefinSans_400Regular' }}>OPERATING SYSTEM</Text>
      </View>

      <View className="mb-10">
        <Text className="text-3xl text-textMain mb-3 leading-tight" style={{ fontFamily: 'Cinzel_700Bold' }}>Welcome to Rentified</Text>
        <Text className="text-sm text-textMain opacity-60 leading-relaxed" style={{ fontFamily: 'JosefinSans_400Regular' }}>
          Create your password to access your landlord portal.
        </Text>
      </View>

      <View className="space-y-6">
        <View>
          <Text className="text-xs text-brand-500 mb-2 ml-1 tracking-widest uppercase" style={{ fontFamily: 'Cinzel_700Bold' }}>Password</Text>
          <TextInput
            className="w-full h-16 px-6 bg-white rounded-3xl border-0 shadow-sm text-textMain"
            style={{ fontFamily: 'JosefinSans_400Regular', fontSize: 16 }}
            placeholder="Min. 8 characters"
            placeholderTextColor="#9ca3af"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            editable={!loading}
          />
        </View>

        <View>
          <Text className="text-xs text-brand-500 mb-2 ml-1 tracking-widest uppercase" style={{ fontFamily: 'Cinzel_700Bold' }}>Confirm Password</Text>
          <TextInput
            className="w-full h-16 px-6 bg-white rounded-3xl border-0 shadow-sm text-textMain"
            style={{ fontFamily: 'JosefinSans_400Regular', fontSize: 16 }}
            placeholder="Re-enter password"
            placeholderTextColor="#9ca3af"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            editable={!loading}
          />
        </View>

        {error && (
          <View className="px-4 py-3 rounded-2xl bg-red-50">
            <Text className="text-red-700 text-sm" style={{ fontFamily: 'JosefinSans_400Regular' }}>{error}</Text>
          </View>
        )}

        <View className="mt-4">
          <TouchableOpacity
            className={`w-full h-16 rounded-full items-center justify-center shadow-lg shadow-brand-500/30 ${loading ? 'bg-brand-500/70' : 'bg-brand-500'}`}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white text-lg tracking-wider" style={{ fontFamily: 'Cinzel_600SemiBold' }}>SET PASSWORD</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
