import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';

export default function TenantHomeScreen() {
  const router = useRouter();
  const { role, setRole } = useAuth();

  return (
    <View className="flex-1 bg-pageBg relative">
      {/* Background Glow */}
      <View
        className="absolute w-[450px] h-[450px] rounded-full"
        style={{ top: -100, right: -120, zIndex: 0, backgroundColor: 'rgba(5, 150, 105, 0.04)' }}
      />

      <ScrollView className="flex-1 z-10" contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Header */}
        <View className="px-6 pt-16 pb-4 bg-pageBg/90 border-b border-navy-border flex-row items-center justify-between">
          <View>
            <View className="flex-row items-center mb-1">
              <Text className="text-[11px] text-navy-muted uppercase tracking-[0.12em] mr-2" style={{ fontFamily: 'DMSans_700Bold' }}>
                Tenant Portal
              </Text>
              <TouchableOpacity
                onPress={() => setRole(role === 'landlord' ? 'tenant' : 'landlord')}
                className="bg-navy/10 px-2.5 py-0.5 rounded-full border border-navy/20"
              >
                <Text className="text-[10px] text-navy font-bold uppercase" style={{ fontFamily: 'DMSans_700Bold' }}>
                  🔑 Tenant Mode (Tap to Switch ⚡)
                </Text>
              </TouchableOpacity>
            </View>

            <Text className="text-[34px] text-navy" style={{ fontFamily: 'Cormorant_300Light' }}>
              My Sanctuary
            </Text>
          </View>

          <View className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 items-center justify-center">
            <MaterialIcons name="home" size={24} color="#059669" />
          </View>
        </View>

        <View className="px-6 mt-6">
          {/* Main Lease Card */}
          <View className="bg-navy rounded-[28px] p-6 border border-navy/80 shadow-card mb-6 overflow-hidden relative">
            <Image
              source={{ uri: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1000&q=80' }}
              className="absolute inset-0 w-full h-full opacity-20"
              resizeMode="cover"
            />

            <View className="flex-row justify-between items-start mb-2">
              <Text className="text-white/60 text-[12px] uppercase tracking-[0.1em]" style={{ fontFamily: 'DMSans_700Bold' }}>
                Active Lease Summary
              </Text>
              <View className="bg-emerald-500/20 px-3 py-1 rounded-full border border-emerald-500/30">
                <Text className="text-emerald-400 text-[11px] font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
                  Good Standing
                </Text>
              </View>
            </View>

            <Text className="text-white text-[28px] font-bold mb-1" style={{ fontFamily: 'DMSans_700Bold' }}>
              500 King St W • Unit 4B
            </Text>
            <Text className="text-white/70 text-[13px] mb-6" style={{ fontFamily: 'DMSans_400Regular' }}>
              Toronto, ON M5V 2T6 • Lease Expires Sept 30, 2026
            </Text>

            <View className="flex-row justify-between pt-4 border-t border-white/10">
              <View>
                <Text className="text-white/50 text-[11px] uppercase" style={{ fontFamily: 'DMSans_700Bold' }}>
                  Monthly Rent
                </Text>
                <Text className="text-white text-[20px] font-bold mt-0.5" style={{ fontFamily: 'DMSans_700Bold' }}>
                  $2,450.00
                </Text>
              </View>

              <View className="items-end">
                <Text className="text-white/50 text-[11px] uppercase" style={{ fontFamily: 'DMSans_700Bold' }}>
                  On-Time Streak
                </Text>
                <Text className="text-emerald-400 text-[20px] font-bold mt-0.5" style={{ fontFamily: 'DMSans_700Bold' }}>
                  ⚡ 12 Months
                </Text>
              </View>
            </View>
          </View>

          {/* Quick Action Grid */}
          <Text className="text-[13px] text-navy-muted uppercase tracking-[0.08em] mb-3 ml-1" style={{ fontFamily: 'DMSans_700Bold' }}>
            Tenant Quick Actions
          </Text>

          <View className="flex-row gap-3 mb-3">
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/tenant-payments')}
              className="flex-1 bg-white p-5 rounded-[22px] border border-navy-border shadow-card items-start"
            >
              <View className="w-11 h-11 rounded-[14px] bg-emerald-500/10 items-center justify-center mb-3">
                <MaterialIcons name="credit-card" size={22} color="#059669" />
              </View>
              <Text className="text-[16px] text-navy font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
                Pay Rent
              </Text>
              <Text className="text-[12px] text-navy-muted mt-0.5" style={{ fontFamily: 'DMSans_400Regular' }}>
                Stripe Sheet / Apple Pay
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/(tabs)/tenant-maintenance')}
              className="flex-1 bg-white p-5 rounded-[22px] border border-navy-border shadow-card items-start"
            >
              <View className="w-11 h-11 rounded-[14px] bg-purple-500/10 items-center justify-center mb-3">
                <MaterialIcons name="build" size={22} color="#7C3AED" />
              </View>
              <Text className="text-[16px] text-navy font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
                Report Issue
              </Text>
              <Text className="text-[12px] text-navy-muted mt-0.5" style={{ fontFamily: 'DMSans_400Regular' }}>
                AI Triage & Dispatch
              </Text>
            </TouchableOpacity>
          </View>

          <View className="flex-row gap-3 mb-6">
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/documents')}
              className="flex-1 bg-white p-5 rounded-[22px] border border-navy-border shadow-card items-start"
            >
              <View className="w-11 h-11 rounded-[14px] bg-blue-500/10 items-center justify-center mb-3">
                <MaterialIcons name="folder" size={22} color="#2563EB" />
              </View>
              <Text className="text-[16px] text-navy font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
                Lease Vault 📁
              </Text>
              <Text className="text-[12px] text-navy-muted mt-0.5" style={{ fontFamily: 'DMSans_400Regular' }}>
                View Lease & Receipts
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setRole('landlord')}
              className="flex-1 bg-navy/5 p-5 rounded-[22px] border border-navy/20 items-start"
            >
              <View className="w-11 h-11 rounded-[14px] bg-navy/10 items-center justify-center mb-3">
                <MaterialIcons name="swap-horiz" size={22} color="#0F1C28" />
              </View>
              <Text className="text-[16px] text-navy font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
                Switch Role
              </Text>
              <Text className="text-[12px] text-navy-muted mt-0.5" style={{ fontFamily: 'DMSans_400Regular' }}>
                Return to Landlord View
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
