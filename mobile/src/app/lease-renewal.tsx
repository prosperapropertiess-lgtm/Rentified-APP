import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, TextInput } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { leaseService } from '../services/leaseService';

export default function LeaseRenewalScreen() {
  const router = useRouter();
  const [lease] = useState(leaseService.getSampleLease());
  const [increasePercent, setIncreasePercent] = useState('2.5');
  const [sending, setSending] = useState(false);

  const offer = leaseService.generateRenewalOffer(lease, Number(increasePercent) || 0);

  const handleSendOffer = async () => {
    Alert.alert(
      'Deliver Renewal Offer 📄',
      `Deliver 12-Month Lease Renewal Offer ($${offer.proposedRent.toLocaleString()}/mo) to ${lease.tenantName} (${lease.tenantEmail})?`,
      [
        {
          text: 'Send Official Offer',
          onPress: async () => {
            setSending(true);
            await new Promise((res) => setTimeout(res, 800));
            setSending(false);
            Alert.alert(
              'Renewal Offer Sent! ✉️',
              `Standard Ontario Lease Renewal notification sent to ${lease.tenantName}. Tenant can review and e-sign in 1 tap from their Tenant Portal.`
            );
            router.back();
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

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
              Automated Retention
            </Text>
            <Text className="text-[30px] text-navy leading-tight" style={{ fontFamily: 'Cormorant_300Light' }}>
              Lease Renewal Engine
            </Text>
          </View>
        </View>

        {/* Expiry Banner */}
        <View className="bg-navy rounded-[28px] p-6 border border-navy/80 shadow-card mb-6 overflow-hidden">
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-white/60 text-[11px] uppercase tracking-[0.12em]" style={{ fontFamily: 'DMSans_700Bold' }}>
              Notice Window Active
            </Text>
            <View className="bg-amber-500/20 px-3 py-1 rounded-full border border-amber-500/30">
              <Text className="text-amber-400 text-[11px] font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
                Expires in {lease.noticeDaysRemaining} Days
              </Text>
            </View>
          </View>

          <Text className="text-white text-[24px] font-bold mb-1" style={{ fontFamily: 'DMSans_700Bold' }}>
            {lease.propertyName} • {lease.unit}
          </Text>
          <Text className="text-white/70 text-[13px]" style={{ fontFamily: 'DMSans_400Regular' }}>
            Tenant: {lease.tenantName} ({lease.tenantEmail})
          </Text>
        </View>

        {/* Guideline Rent Calculator */}
        <Text className="text-[13px] text-navy-muted uppercase tracking-[0.08em] mb-3 ml-1" style={{ fontFamily: 'DMSans_700Bold' }}>
          Rent Increase Calculation (2026 CRA/LTB Compliant)
        </Text>

        <View className="bg-white rounded-[24px] p-5 border border-navy-border shadow-card mb-6">
          <Text className="text-[11px] text-navy-muted uppercase tracking-[0.08em] mb-1" style={{ fontFamily: 'DMSans_700Bold' }}>
            Proposed Rent Increase (%)
          </Text>
          <TextInput
            value={increasePercent}
            onChangeText={setIncreasePercent}
            keyboardType="numeric"
            className="bg-pageBg border border-navy-border rounded-[14px] p-3.5 text-[18px] text-navy font-bold mb-4"
          />

          <View className="flex-row justify-between items-center py-2.5 border-b border-navy-border/50">
            <Text className="text-[13px] text-navy-muted" style={{ fontFamily: 'DMSans_400Regular' }}>Current Monthly Rent</Text>
            <Text className="text-[15px] text-navy font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>${lease.monthlyRent.toLocaleString()}</Text>
          </View>

          <View className="flex-row justify-between items-center py-2.5 border-b border-navy-border/50">
            <Text className="text-[13px] text-navy-muted" style={{ fontFamily: 'DMSans_400Regular' }}>Proposed Monthly Rent</Text>
            <Text className="text-[18px] text-emerald-700 font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>${offer.proposedRent.toLocaleString()}</Text>
          </View>

          <View className="flex-row justify-between items-center py-2.5 mb-4">
            <Text className="text-[13px] text-navy-muted" style={{ fontFamily: 'DMSans_400Regular' }}>Provincial Guideline Compliance</Text>
            <Text className="text-[13px] text-emerald-700 font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
              {offer.guidelineCompliant ? 'Compliant (Max 2.5%) 🟢' : 'Above Guideline ⚠️'}
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleSendOffer}
            disabled={sending}
            className="bg-navy py-4 rounded-[16px] items-center shadow-sm flex-row justify-center"
          >
            <MaterialIcons name="send" size={18} color="#FFFFFF" />
            <Text className="text-white text-[15px] font-bold ml-2" style={{ fontFamily: 'DMSans_700Bold' }}>
              {sending ? 'Delivering...' : 'Deliver 1-Tap Lease Renewal Offer'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
