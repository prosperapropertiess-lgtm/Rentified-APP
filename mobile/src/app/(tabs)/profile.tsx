import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export default function ProfileScreen() {
  const router = useRouter();
  const { session, role, setRole } = useAuth();

  const userEmail = session?.user?.email || 'ebinjaison123@gmail.com';
  const userName = userEmail.split('@')[0].toUpperCase();

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      router.replace('/(auth)/login');
    } catch (e: any) {
      Alert.alert('Sign Out Error', e.message);
    }
  };

  return (
    <View className="flex-1 bg-pageBg relative">
      {/* Ambient Background Glow */}
      <View
        className="absolute w-[450px] h-[450px] rounded-full"
        style={{ top: -100, right: -120, zIndex: 0, backgroundColor: 'rgba(15, 28, 40, 0.04)' }}
      />

      <ScrollView className="flex-1 z-10" contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Header */}
        <View className="px-6 pt-16 pb-4 border-b border-navy-border/50">
          <Text className="text-[12px] text-navy-muted uppercase tracking-[0.12em]" style={{ fontFamily: 'DMSans_700Bold' }}>
            Account Settings
          </Text>
          <Text className="text-[34px] text-navy leading-tight mt-0.5" style={{ fontFamily: 'Cormorant_300Light' }}>
            Profile & Vault
          </Text>
        </View>

        <View className="px-6 mt-6">
          {/* User Profile Card */}
          <View className="bg-white rounded-[24px] p-6 border border-navy-border shadow-card mb-6 flex-row items-center">
            <View className="w-16 h-16 rounded-full bg-navy items-center justify-center mr-4 shadow-sm">
              <Text className="text-white text-[24px] font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
                {userName[0]}
              </Text>
            </View>

            <View className="flex-1">
              <Text className="text-[20px] text-navy font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
                Ebin Jaison
              </Text>
              <Text className="text-[13px] text-navy-muted mb-2" style={{ fontFamily: 'DMSans_400Regular' }}>
                {userEmail}
              </Text>

              <View className="flex-row items-center">
                <View className="bg-navy/10 px-2.5 py-0.5 rounded-full border border-navy/20 mr-2">
                  <Text className="text-[11px] text-navy font-bold uppercase" style={{ fontFamily: 'DMSans_700Bold' }}>
                    {role === 'landlord' ? '⚡ Landlord Admin' : '🔑 Verified Tenant'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Interactive Role Switcher Pill */}
          <Text className="text-[12px] text-navy-muted uppercase tracking-[0.08em] mb-2 ml-1" style={{ fontFamily: 'DMSans_700Bold' }}>
            Testing Role Mode Switcher
          </Text>

          <TouchableOpacity
            onPress={() => setRole(role === 'landlord' ? 'tenant' : 'landlord')}
            className="bg-navy p-5 rounded-[22px] shadow-card mb-6 flex-row items-center justify-between"
          >
            <View className="flex-row items-center flex-1 pr-2">
              <View className="w-11 h-11 rounded-[14px] bg-white/10 items-center justify-center mr-3.5">
                <MaterialIcons name="swap-horiz" size={24} color="#FFFFFF" />
              </View>
              <View>
                <Text className="text-white text-[16px] font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
                  Switch to {role === 'landlord' ? 'Tenant Portal Mode' : 'Landlord Mode'}
                </Text>
                <Text className="text-white/70 text-[12px] mt-0.5" style={{ fontFamily: 'DMSans_400Regular' }}>
                  Currently viewing app as {role === 'landlord' ? 'Landlord' : 'Tenant'}
                </Text>
              </View>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Account Options */}
          <Text className="text-[12px] text-navy-muted uppercase tracking-[0.08em] mb-2 ml-1" style={{ fontFamily: 'DMSans_700Bold' }}>
            App Options & Vault
          </Text>

          <TouchableOpacity
            onPress={() => router.push('/(tabs)/documents')}
            className="bg-white p-4 rounded-[18px] border border-navy-border shadow-card mb-3 flex-row items-center justify-between"
          >
            <View className="flex-row items-center">
              <MaterialIcons name="folder" size={22} color="#7C3AED" />
              <Text className="text-[15px] text-navy font-bold ml-3" style={{ fontFamily: 'DMSans_700Bold' }}>
                Property Documents Vault 📁
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color="#94A3B8" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => Alert.alert('Payment Setup', 'Stripe Connect Payout Account: Active')}
            className="bg-white p-4 rounded-[18px] border border-navy-border shadow-card mb-3 flex-row items-center justify-between"
          >
            <View className="flex-row items-center">
              <MaterialIcons name="account-balance" size={22} color="#059669" />
              <Text className="text-[15px] text-navy font-bold ml-3" style={{ fontFamily: 'DMSans_700Bold' }}>
                Stripe Bank Payout Account
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color="#94A3B8" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSignOut}
            className="bg-red-500/10 border border-red-500/30 p-4 rounded-[18px] mt-4 flex-row items-center justify-center"
          >
            <MaterialIcons name="logout" size={20} color="#DC2626" />
            <Text className="text-red-600 font-bold text-[15px] ml-2" style={{ fontFamily: 'DMSans_700Bold' }}>
              Sign Out of Rentified
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
