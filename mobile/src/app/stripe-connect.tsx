import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Alert, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { stripeService, StripeAccountStatus } from '../services/stripeService';
import { Skeleton } from '../components/SkeletonLoader';

export default function StripeConnectScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [status, setStatus] = useState<StripeAccountStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payoutLoading, setPayoutLoading] = useState(false);

  const fetchStripeData = useCallback(async () => {
    try {
      if (!session?.user) {
        setLoading(false);
        return;
      }
      const data = await stripeService.getLandlordStripeStatus(session.user.id);
      setStatus(data);
    } catch (e) {
      console.error('Error loading Stripe data:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session]);

  useEffect(() => {
    let ignore = false;
    Promise.resolve().then(() => {
      if (!ignore) {
        fetchStripeData();
      }
    });
    return () => {
      ignore = true;
    };
  }, [fetchStripeData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchStripeData();
  };

  const handleInstantPayout = async () => {
    if (!status || status.availableBalance <= 0) {
      Alert.alert('No Available Funds', 'There are currently no funds available for instant payout.');
      return;
    }

    Alert.alert(
      'Instant Payout',
      `Payout $${status.availableBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })} directly to ${status.bankName} (**** ${status.last4})?`,
      [
        {
          text: 'Transfer Funds Now',
          onPress: async () => {
            try {
              setPayoutLoading(true);
              const result = await stripeService.requestInstantPayout(status.availableBalance);
              if (result.success) {
                setStatus((prev) => (prev ? { ...prev, availableBalance: 0 } : null));
                Alert.alert(
                  'Payout Transferred! 🏦',
                  `$${status.availableBalance.toLocaleString()} sent to ${status.bankName}. Transaction ID: ${result.transactionId}`
                );
              }
            } catch (e: any) {
              Alert.alert('Payout Error', e.message);
            } finally {
              setPayoutLoading(false);
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  if (loading && !refreshing) {
    return (
      <View className="flex-1 bg-pageBg p-6 pt-16">
        <Skeleton width={180} height={36} borderRadius={12} style={{ marginBottom: 20 }} />
        <Skeleton width="100%" height={180} borderRadius={24} style={{ marginBottom: 16 }} />
        <Skeleton width="100%" height={120} borderRadius={20} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-pageBg relative">
      <ScrollView
        className="flex-1 z-10 px-6 pt-16 pb-28"
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0F1C28" />}
      >
        {/* Header */}
        <View className="flex-row items-center mb-6">
          <TouchableOpacity onPress={() => router.back()} className="mr-3 w-9 h-9 rounded-full bg-white border border-navy-border items-center justify-center">
            <MaterialIcons name="arrow-back" size={20} color="#0F1C28" />
          </TouchableOpacity>
          <View>
            <Text className="text-[11px] text-navy-muted uppercase tracking-[0.12em]" style={{ fontFamily: 'DMSans_700Bold' }}>
              Financial Services
            </Text>
            <Text className="text-[30px] text-navy leading-tight" style={{ fontFamily: 'Cormorant_300Light' }}>
              Stripe Bank Payouts
            </Text>
          </View>
        </View>

        {/* Balance Hero Card */}
        <View className="bg-navy rounded-[30px] p-7 border border-navy/80 shadow-card mb-6 overflow-hidden">
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-white/60 text-[11px] uppercase tracking-[0.12em]" style={{ fontFamily: 'DMSans_700Bold' }}>
              Available Payout Balance
            </Text>
            <View className="bg-emerald-500/20 px-3 py-1 rounded-full border border-emerald-500/30 flex-row items-center">
              <View className="w-2 h-2 rounded-full bg-emerald-400 mr-1.5" />
              <Text className="text-emerald-400 text-[11px] font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
                Direct Deposit Active
              </Text>
            </View>
          </View>

          <Text className="text-white text-[48px] font-light mb-6" style={{ fontFamily: 'Cormorant_300Light' }}>
            ${status?.availableBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </Text>

          <View className="flex-row justify-between items-center pt-4 border-t border-white/10 mb-4">
            <View>
              <Text className="text-white/50 text-[11px] uppercase" style={{ fontFamily: 'DMSans_700Bold' }}>
                Pending Clearing
              </Text>
              <Text className="text-amber-400 text-[18px] font-bold mt-0.5" style={{ fontFamily: 'DMSans_700Bold' }}>
                ${status?.pendingBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </Text>
            </View>

            <View className="items-end">
              <Text className="text-white/50 text-[11px] uppercase" style={{ fontFamily: 'DMSans_700Bold' }}>
                Linked Account
              </Text>
              <Text className="text-white text-[14px] font-bold mt-0.5" style={{ fontFamily: 'DMSans_700Bold' }}>
                {status?.bankName} (**** {status?.last4})
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={handleInstantPayout}
            disabled={payoutLoading}
            className="bg-emerald-500 py-3.5 rounded-[16px] items-center flex-row justify-center shadow-sm"
          >
            {payoutLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <MaterialIcons name="account-balance-wallet" size={18} color="#FFFFFF" />
                <Text className="text-white text-[15px] font-bold ml-2" style={{ fontFamily: 'DMSans_700Bold' }}>
                  Instant Payout to Bank
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Stripe Merchant Details */}
        <Text className="text-[13px] text-navy-muted uppercase tracking-[0.08em] mb-3 ml-1" style={{ fontFamily: 'DMSans_700Bold' }}>
          Stripe Express Merchant Configuration
        </Text>

        <View className="bg-white rounded-[24px] p-5 border border-navy-border shadow-card mb-4">
          <View className="flex-row justify-between items-center py-2 border-b border-navy-border/50">
            <Text className="text-[13px] text-navy-muted" style={{ fontFamily: 'DMSans_400Regular' }}>Stripe Account ID</Text>
            <Text className="text-[14px] text-navy font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>{status?.accountId}</Text>
          </View>

          <View className="flex-row justify-between items-center py-2 border-b border-navy-border/50">
            <Text className="text-[13px] text-navy-muted" style={{ fontFamily: 'DMSans_400Regular' }}>Payout Schedule</Text>
            <Text className="text-[14px] text-emerald-700 font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>Daily Rolling Payouts</Text>
          </View>

          <View className="flex-row justify-between items-center py-2">
            <Text className="text-[13px] text-navy-muted" style={{ fontFamily: 'DMSans_400Regular' }}>Processing Fee</Text>
            <Text className="text-[14px] text-navy font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>0% (Tenant Paid ACH)</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
