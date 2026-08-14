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
      // Create landlord profile — landlords.id = auth.users.id in Prospera schema
      const { error: profileError } = await supabase.from('landlords').insert({
        id: authData.user.id,
        full_name: email.split('@')[0],
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
    <View className="flex-1 justify-center px-8 bg-surface">
      <View className="items-center mb-16 mt-[-10%]">
        <Text className="text-5xl text-brand-500 mb-3" style={{ fontFamily: 'Cinzel_700Bold' }}>Rentified</Text>
        <Text className="text-base text-textMain opacity-70 tracking-widest" style={{ fontFamily: 'JosefinSans_400Regular' }}>OPERATING SYSTEM</Text>
      </View>

      <View className="space-y-6">
        <View>
          <Text className="text-xs text-brand-500 mb-2 ml-1 tracking-widest uppercase" style={{ fontFamily: 'Cinzel_700Bold' }}>Email Address</Text>
          <TextInput 
            className="w-full h-16 px-6 bg-white rounded-3xl border-0 shadow-sm text-textMain"
            style={{ fontFamily: 'JosefinSans_400Regular', fontSize: 16 }}
            placeholder="investor@example.com" 
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            editable={!loading}
          />
        </View>
        
        <View>
          <Text className="text-xs text-brand-500 mb-2 ml-1 tracking-widest uppercase" style={{ fontFamily: 'Cinzel_700Bold' }}>Secure Password</Text>
          <TextInput 
            className="w-full h-16 px-6 bg-white rounded-3xl border-0 shadow-sm text-textMain"
            style={{ fontFamily: 'JosefinSans_400Regular', fontSize: 16 }}
            placeholder="••••••••" 
            placeholderTextColor="#9ca3af"
            secureTextEntry 
            value={password}
            onChangeText={setPassword}
            editable={!loading}
          />
        </View>

        <View className="mt-8 space-y-4">
          <TouchableOpacity 
            className={`w-full h-16 rounded-full items-center justify-center shadow-lg shadow-brand-500/30 ${loading ? 'bg-brand-500/70' : 'bg-brand-500'}`}
            onPress={handleSignIn}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white text-lg tracking-wider" style={{ fontFamily: 'Cinzel_600SemiBold' }}>SIGN IN TO PORTFOLIO</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            className="w-full h-16 rounded-full border-2 border-brand-500 items-center justify-center"
            onPress={handleSignUp}
            disabled={loading}
          >
            <Text className="text-brand-500 text-lg tracking-wider" style={{ fontFamily: 'Cinzel_600SemiBold' }}>CREATE ACCOUNT</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
