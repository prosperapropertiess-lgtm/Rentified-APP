import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, Image } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';

export default function LoginScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isSignupMode = mode === 'signup';
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
      if (error.message.toLowerCase().includes('email not confirmed')) {
        Alert.alert('Verification Required', 'Please check your email inbox and click the verification link before signing in.');
      } else {
        Alert.alert('Sign In Failed', error.message);
      }
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
      Alert.alert('Success', 'Account created! Logging you in...');
    }
    setLoading(false);
  }

  async function handleMagicLink() {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address to receive a magic link.');
      return;
    }

    setLoading(true);
    // In React Native, you often need to provide an emailRedirectTo option for the deep link,
    // but for now we'll just trigger the basic OTP flow.
    const { error } = await supabase.auth.signInWithOtp({
      email,
    });

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Check your inbox!', 'We just sent a magic login link to your email address!');
    }
    setLoading(false);
  }
  return (
    <View className="flex-1 justify-center px-8 bg-pageBg">
      <View className="items-center mb-12 mt-[-6%]">
        <Image
          source={require('../../../assets/images/splash-icon.png')}
          style={{ width: 148, height: 148, marginBottom: 20 }}
          resizeMode="contain"
        />
        <Text className="text-5xl text-navy mb-2" style={{ fontFamily: 'DMSans_700Bold' }}>Rentified</Text>
        <Text className="text-xs text-navy-muted tracking-[3px] uppercase font-sansBold">by Prospera Properties</Text>
        {isSignupMode && (
          <Text className="text-navy-muted font-sans text-sm mt-4 text-center">Create your Property Partner account to get started.</Text>
        )}
      </View>

      <View className="space-y-6">
        <View>
          <Text className="text-xs text-navy mb-2 ml-1 tracking-widest uppercase font-sansBold">Email Address</Text>
          <TextInput 
            className="w-full h-16 px-6 bg-card rounded-3xl border border-navy-border shadow-sm text-navy font-sans"
            style={{ fontSize: 16 }}
            placeholder="investor@example.com" 
            placeholderTextColor="#8B95A1"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            editable={!loading}
          />
        </View>
        
        <View>
          <Text className="text-xs text-navy mb-2 ml-1 tracking-widest uppercase font-sansBold">Secure Password</Text>
          <TextInput 
            className="w-full h-16 px-6 bg-card rounded-3xl border border-navy-border shadow-sm text-navy font-sans"
            style={{ fontSize: 16 }}
            placeholder="••••••••" 
            placeholderTextColor="#8B95A1"
            secureTextEntry 
            value={password}
            onChangeText={setPassword}
            editable={!loading}
          />
        </View>

        <View className="mt-8 space-y-4">
          <TouchableOpacity
            className={`w-full h-16 rounded-full items-center justify-center shadow-lg shadow-navy/30 ${loading ? 'bg-navy/70' : 'bg-navy'}`}
            onPress={isSignupMode ? handleSignUp : handleSignIn}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white text-lg tracking-wider font-sansBold">{isSignupMode ? 'CREATE ACCOUNT' : 'SIGN IN TO PORTFOLIO'}</Text>
            )}
          </TouchableOpacity>

          <View className="flex-row justify-center items-center gap-2 mt-6">
            <TouchableOpacity onPress={isSignupMode ? handleSignIn : handleSignUp} disabled={loading}>
              <Text className="text-navy/70 text-sm tracking-wide font-sansBold">{isSignupMode ? 'I already have an account' : 'Create account'}</Text>
            </TouchableOpacity>
            <Text className="text-navy/30">·</Text>
            <TouchableOpacity onPress={handleMagicLink} disabled={loading}>
              <Text className="text-navy/70 text-sm tracking-wide font-sansBold">Send magic link</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}
