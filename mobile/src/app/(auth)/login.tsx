import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { supabase } from '../../lib/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      Alert.alert('Sign In Failed', error.message);
    }
    setLoading(false);
  }

  async function handleSignUp() {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password.');
      return;
    }

    setLoading(true);
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      Alert.alert('Sign Up Failed', authError.message);
    } else if (authData.user) {
      // By default, create a landlord profile for new signups
      const { error: profileError } = await supabase.from('landlords').insert({
        user_id: authData.user.id,
        first_name: 'New',
        last_name: 'User',
        email: email,
      });
      
      if (profileError) {
        console.error('Error creating landlord profile', profileError);
      }
      
      Alert.alert('Success', 'Account created! You can now sign in.');
    }
    setLoading(false);
  }

  return (
    <View className="flex-1 justify-center px-6 bg-surface">
      <Text className="text-2xl font-semibold text-primary mb-2">Rentified OS</Text>
      <Text className="text-sm text-secondary mb-8">Sign in or create a new account to manage your properties</Text>

      <View className="space-y-4">
        <View>
          <Text className="text-sm text-secondary mb-1">Email</Text>
          <TextInput 
            className="w-full h-12 px-4 rounded-lg border border-slate-300 focus:border-brand-500 text-primary" 
            placeholder="name@example.com" 
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            editable={!loading}
          />
        </View>
        
        <View>
          <Text className="text-sm text-secondary mb-1">Password</Text>
          <TextInput 
            className="w-full h-12 px-4 rounded-lg border border-slate-300 focus:border-brand-500 text-primary" 
            placeholder="••••••••" 
            secureTextEntry 
            value={password}
            onChangeText={setPassword}
            editable={!loading}
          />
        </View>

        <View className="flex-row mt-4 space-x-3">
          <TouchableOpacity 
            className={`flex-1 h-12 rounded-lg items-center justify-center ${loading ? 'bg-brand-500/70' : 'bg-brand-500'}`}
            onPress={handleSignIn}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-medium text-base">Sign In</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            className="flex-1 h-12 rounded-lg border border-brand-500 items-center justify-center"
            onPress={handleSignUp}
            disabled={loading}
          >
            <Text className="text-brand-500 font-medium text-base">Sign Up</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
