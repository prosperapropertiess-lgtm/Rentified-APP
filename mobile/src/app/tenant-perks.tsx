import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function TenantPerksScreen() {
  const router = useRouter();
  const [creditReportEnabled, setCreditReportEnabled] = useState(true);

  const perks = [
    { id: '1', title: '$10 Off Local Artisan Coffee', partner: 'Pilot Coffee Roasters', code: 'RENTIFIED10', status: 'ready' },
    { id: '2', title: '15% Off House Cleaning', partner: 'Cleanly Toronto', code: 'CLEANRENT15', status: 'ready' },
    { id: '3', title: '$25 Grocery Voucher', partner: 'Instacart Canada', code: 'PERK25', status: 'claimed' },
  ];

  return (
    <View className="flex-1 bg-pageBg relative">
      <ScrollView className="flex-1 z-10 px-6 pt-16 pb-28" contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Header */}
        <View className="flex-row items-center mb-6">
          <TouchableOpacity onPress={() => router.back()} className="mr-3 w-9 h-9 rounded-full bg-white border border-navy-border items-center justify-center">
            <MaterialIcons name="arrow-back" size={20} color="#0F1C28" />
          </TouchableOpacity>
          <View>
            <Text className="text-[11px] text-navy-muted uppercase tracking-[0.12em]" style={{ fontFamily: 'DMSans_700Bold' }}>
              Tenant VIP Rewards
            </Text>
            <Text className="text-[30px] text-navy leading-tight" style={{ fontFamily: 'Cormorant_300Light' }}>
              Perks & Credit Booster
            </Text>
          </View>
        </View>

        {/* On-Time Rent Streak Badge */}
        <View className="bg-navy rounded-[28px] p-6 border border-navy/80 shadow-card mb-6 overflow-hidden">
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-white/60 text-[11px] uppercase tracking-[0.12em]" style={{ fontFamily: 'DMSans_700Bold' }}>
              On-Time Payment Streak
            </Text>
            <View className="bg-emerald-500/20 px-3 py-1 rounded-full border border-emerald-500/30">
              <Text className="text-emerald-400 text-[11px] font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
                VIP Status
              </Text>
            </View>
          </View>

          <Text className="text-white text-[42px] font-light mb-1" style={{ fontFamily: 'Cormorant_300Light' }}>
            ⚡ 12 Months
          </Text>
          <Text className="text-white/70 text-[13px]" style={{ fontFamily: 'DMSans_400Regular' }}>
            You have unlocked Level 3 Resident Rewards for 100% on-time rent payments!
          </Text>
        </View>

        {/* Credit Building Feature */}
        <Text className="text-[13px] text-navy-muted uppercase tracking-[0.08em] mb-3 ml-1" style={{ fontFamily: 'DMSans_700Bold' }}>
          Credit Score Building Engine
        </Text>

        <View className="bg-white rounded-[24px] p-5 border border-navy-border shadow-card mb-6">
          <View className="flex-row justify-between items-center mb-3">
            <View className="flex-row items-center flex-1 mr-2">
              <View className="w-10 h-10 rounded-[14px] bg-purple-500/10 items-center justify-center mr-3">
                <MaterialIcons name="trending-up" size={22} color="#7C3AED" />
              </View>
              <View className="flex-1">
                <Text className="text-[16px] text-navy font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
                  Report Rent to Equifax & TransUnion
                </Text>
                <Text className="text-[12px] text-navy-muted" style={{ fontFamily: 'DMSans_400Regular' }}>
                  Build +35 credit score points by reporting your on-time rent payments
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => setCreditReportEnabled(!creditReportEnabled)}
              className={`px-3 py-1.5 rounded-full border ${
                creditReportEnabled ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-pageBg border-navy-border'
              }`}
            >
              <Text className={`text-[12px] font-bold ${creditReportEnabled ? 'text-emerald-700' : 'text-navy-muted'}`}>
                {creditReportEnabled ? 'Active 🟢' : 'Enable'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Unlocked Rewards List */}
        <Text className="text-[13px] text-navy-muted uppercase tracking-[0.08em] mb-3 ml-1" style={{ fontFamily: 'DMSans_700Bold' }}>
          Unlocked Resident Perks
        </Text>

        {perks.map((p) => (
          <View key={p.id} className="bg-white rounded-[22px] p-5 border border-navy-border shadow-card mb-3.5 flex-row justify-between items-center">
            <View className="flex-1 mr-2">
              <Text className="text-[16px] text-navy font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
                {p.title}
              </Text>
              <Text className="text-[12px] text-navy-muted" style={{ fontFamily: 'DMSans_400Regular' }}>
                Partner: {p.partner}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => Alert.alert('Promo Code', `Use code ${p.code} at checkout for ${p.partner}.`)}
              className="bg-navy px-3.5 py-2 rounded-[12px]"
            >
              <Text className="text-white text-[12px] font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
                Claim Code
              </Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
