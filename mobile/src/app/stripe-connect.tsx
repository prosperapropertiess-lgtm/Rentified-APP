import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Alert, ActivityIndicator, TextInput } from 'react-native';
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

  // Setup State
  const [selectedMethod, setSelectedMethod] = useState<'e-Transfer' | 'Direct Deposit'>('e-Transfer');
  const [payoutEmail, setPayoutEmail] = useState('ebinjaison02@gmail.com');
  const [savingSetup, setSavingSetup] = useState(false);

  const fetchStripeData = useCallback(async () => {
    try {
      if (!session?.user) {
        setLoading(false);
        return;
      }
      const data = await stripeService.getLandlordStripeStatus(session.user.id);
      setStatus(data);
      if (data.eTransferEmail) {
        setPayoutEmail(data.eTransferEmail);
      }
    } catch (e) {
      console.error('Error loading payout data:', e);
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

  const handleSaveSetup = async () => {
    if (!payoutEmail.trim()) {
      Alert.alert('Email Required', 'Please enter your Interac e-Transfer email address.');
      return;
    }

    try {
      setSavingSetup(true);
      await stripeService.updatePayoutMethod(selectedMethod, payoutEmail.trim());
      setStatus((prev) =>
        prev
          ? {
              ...prev,
              payoutMethod: selectedMethod,
              eTransferEmail: payoutEmail.trim(),
              bankName: selectedMethod === 'e-Transfer' ? 'Interac e-Transfer 🇨🇦' : 'Direct Bank Deposit',
            }
          : null
      );
      Alert.alert('Payout Setup Saved ⚡', `Rent collections will now automatically deposit to ${payoutEmail.trim()}. No Stripe account required!`);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSavingSetup(false);
    }
  };

  const handleInstantPayout = async () => {
    if (!status || status.availableBalance <= 0) {
      Alert.alert('No Available Funds', 'There are currently no funds available for instant payout.');
      return;
    }

    Alert.alert(
      'Instant Rent Deposit',
      `Transfer $${status.availableBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })} directly to ${payoutEmail}?`,
      [
        {
          text: 'Deposit Funds Now',
          onPress: async () => {
            try {
              setPayoutLoading(true);
              const result = await stripeService.requestInstantPayout(status.availableBalance);
              if (result.success) {
                setStatus((prev) => (prev ? { ...prev, availableBalance: 0 } : null));
                Alert.alert(
                  'Rent Deposited! 🇨🇦',
                  `$${status.availableBalance.toLocaleString()} sent via Interac e-Transfer to ${payoutEmail}. Transaction ID: ${result.transactionId}`
                );
              }
            } catch (e: any) {
              Alert.alert('Deposit Error', e.message);
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
              No Stripe Account Required
            </Text>
            <Text className="text-[30px] text-navy leading-tight" style={{ fontFamily: 'Cormorant_300Light' }}>
              Rent Payout Hub
            </Text>
          </View>
        </View>

        {/* Balance Hero Card */}
        <View className="bg-navy rounded-[30px] p-7 border border-navy/80 shadow-card mb-6 overflow-hidden">
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-white/60 text-[11px] uppercase tracking-[0.12em]" style={{ fontFamily: 'DMSans_700Bold' }}>
              Available Rent Collection Balance
            </Text>
            <View className="bg-emerald-500/20 px-3 py-1 rounded-full border border-emerald-500/30 flex-row items-center">
              <View className="w-2 h-2 rounded-full bg-emerald-400 mr-1.5" />
              <Text className="text-emerald-400 text-[11px] font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
                Auto e-Transfer Ready
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
                Deposit Destination
              </Text>
              <Text className="text-white text-[13px] font-bold mt-0.5" style={{ fontFamily: 'DMSans_700Bold' }}>
                {payoutEmail}
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
                  Instant Deposit to My Bank 🇨🇦
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* 1-TAP ZERO STRIPE ACCOUNT PAYOUT SETUP */}
        <Text className="text-[13px] text-navy-muted uppercase tracking-[0.08em] mb-3 ml-1" style={{ fontFamily: 'DMSans_700Bold' }}>
          30-Second Deposit Setup (No Stripe Account Needed)
        </Text>

        <View className="bg-white rounded-[24px] p-5 border border-navy-border shadow-card mb-6">
          <Text className="text-[11px] text-navy-muted uppercase tracking-[0.08em] mb-2" style={{ fontFamily: 'DMSans_700Bold' }}>
            Interac e-Transfer Deposit Email *
          </Text>
          <TextInput
            value={payoutEmail}
            onChangeText={setPayoutEmail}
            placeholder="ebinjaison02@gmail.com"
            keyboardType="email-address"
            autoCapitalize="none"
            className="bg-pageBg border border-navy-border rounded-[14px] p-3.5 text-[15px] text-navy mb-4 font-bold"
          />

          <Text className="text-[11px] text-navy-muted uppercase tracking-[0.08em] mb-2" style={{ fontFamily: 'DMSans_700Bold' }}>
            Preferred Bank Transfer Method
          </Text>

          <TouchableOpacity
            onPress={() => setSelectedMethod('e-Transfer')}
            className={`p-3.5 rounded-[16px] border mb-2 flex-row items-center justify-between ${
              selectedMethod === 'e-Transfer' ? 'bg-navy/5 border-navy' : 'bg-pageBg border-navy-border'
            }`}
          >
            <View className="flex-row items-center">
              <MaterialIcons name="send" size={20} color="#0F1C28" />
              <Text className="text-[14px] text-navy font-bold ml-2.5" style={{ fontFamily: 'DMSans_700Bold' }}>
                Direct Interac e-Transfer 🇨🇦 (Instant)
              </Text>
            </View>
            {selectedMethod === 'e-Transfer' && <MaterialIcons name="check-circle" size={18} color="#0F1C28" />}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setSelectedMethod('Direct Deposit')}
            className={`p-3.5 rounded-[16px] border mb-5 flex-row items-center justify-between ${
              selectedMethod === 'Direct Deposit' ? 'bg-navy/5 border-navy' : 'bg-pageBg border-navy-border'
            }`}
          >
            <View className="flex-row items-center">
              <MaterialIcons name="account-balance" size={20} color="#0F1C28" />
              <Text className="text-[14px] text-navy font-bold ml-2.5" style={{ fontFamily: 'DMSans_700Bold' }}>
                Canadian Direct Bank Deposit (EFT)
              </Text>
            </View>
            {selectedMethod === 'Direct Deposit' && <MaterialIcons name="check-circle" size={18} color="#0F1C28" />}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSaveSetup}
            disabled={savingSetup}
            className="bg-navy py-3.5 rounded-[14px] items-center shadow-sm"
          >
            <Text className="text-white text-[14px] font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
              {savingSetup ? 'Saving Setup...' : 'Save Deposit Destination'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
