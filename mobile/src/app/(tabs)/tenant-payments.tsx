import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Modal, Alert, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { format, addMonths } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Skeleton } from '../../components/SkeletonLoader';

type Invoice = {
  id: string;
  amount: number;
  due_date: string;
  status: 'paid' | 'pending' | 'overdue';
  created_at: string;
  paid_at?: string | null;
  payment_method?: string | null;
};

export default function TenantPaymentsScreen() {
  const { session } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Payment Sheet Modal State
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<'apple_pay' | 'card' | 'etransfer'>('apple_pay');
  const [processing, setProcessing] = useState(false);

  // Receipt Modal State
  const [receiptInvoice, setReceiptInvoice] = useState<Invoice | null>(null);

  const fetchInvoices = useCallback(async () => {
    try {
      if (!session?.user) {
        setLoading(false);
        return;
      }

      const { data: tenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (tenant) {
        const { data: invoiceData } = await supabase
          .from('invoices')
          .select('*')
          .eq('tenant_id', tenant.id)
          .order('due_date', { ascending: false });

        setInvoices(invoiceData || []);
      }
    } catch (e) {
      console.error('Error fetching tenant invoices:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session]);

  useEffect(() => {
    let ignore = false;
    Promise.resolve().then(() => {
      if (!ignore) {
        fetchInvoices();
      }
    });
    return () => {
      ignore = true;
    };
  }, [fetchInvoices]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchInvoices();
  };

  const handlePayRentNow = async () => {
    try {
      setProcessing(true);
      // Simulate Stripe API delay
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const now = new Date();
      const paidInvoice: Invoice = {
        id: `INV-${Math.floor(100000 + Math.random() * 900000)}`,
        amount: 2450,
        due_date: format(now, 'yyyy-MM-01'),
        status: 'paid',
        created_at: now.toISOString(),
        paid_at: now.toISOString(),
        payment_method: selectedMethod === 'apple_pay' ? 'Apple Pay' : selectedMethod === 'card' ? 'Visa •••• 4242' : 'Interac e-Transfer',
      };

      // Try updating database if tenant exists
      const { data: tenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('user_id', session?.user?.id)
        .maybeSingle();

      if (tenant) {
        await supabase.from('invoices').insert({
          tenant_id: tenant.id,
          amount: 2450,
          due_date: format(now, 'yyyy-MM-01'),
          status: 'paid',
          paid_at: now.toISOString(),
          payment_method: paidInvoice.payment_method,
        });
      }

      setInvoices((prev) => [paidInvoice, ...prev]);
      setPaymentModalVisible(false);
      setReceiptInvoice(paidInvoice);
    } catch (e: any) {
      Alert.alert('Payment Error', e.message);
    } finally {
      setProcessing(false);
    }
  };

  const currentDueRent = 2450.0;
  const nextDueDate = format(addMonths(new Date(), 1), 'MMMM 1, yyyy');

  if (loading && !refreshing) {
    return (
      <View className="flex-1 bg-pageBg p-6 pt-16">
        <Skeleton width={180} height={36} borderRadius={12} style={{ marginBottom: 20 }} />
        <Skeleton width="100%" height={180} borderRadius={24} style={{ marginBottom: 16 }} />
        <Skeleton width="100%" height={100} borderRadius={20} style={{ marginBottom: 12 }} />
        <Skeleton width="100%" height={100} borderRadius={20} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-pageBg relative">
      {/* Background Ambient Glow */}
      <View
        className="absolute w-[450px] h-[450px] rounded-full"
        style={{ top: -100, right: -120, zIndex: 0, backgroundColor: 'rgba(5, 150, 105, 0.05)' }}
      />

      <ScrollView
        className="flex-1 z-10"
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0F1C28" />}
      >
        {/* Header */}
        <View className="px-6 pt-16 pb-4 bg-pageBg/90 border-b border-navy-border flex-row items-center justify-between">
          <View>
            <Text className="text-[12px] text-navy-muted uppercase tracking-[0.1em]" style={{ fontFamily: 'DMSans_700Bold' }}>
              Tenant Portal
            </Text>
            <Text className="text-[34px] text-navy" style={{ fontFamily: 'Cormorant_300Light' }}>
              Rent & Payments
            </Text>
          </View>

          <View className="bg-emerald-500/10 px-3 py-1.5 rounded-full flex-row items-center">
            <MaterialIcons name="bolt" size={16} color="#059669" />
            <Text className="text-emerald-700 text-[11px] font-bold ml-0.5" style={{ fontFamily: 'DMSans_700Bold' }}>
              12 Mo On-Time
            </Text>
          </View>
        </View>

        <View className="px-6 mt-6">
          {/* Main Rent Due Card */}
          <View className="bg-navy rounded-[28px] p-6 border border-navy/80 shadow-card mb-6 relative overflow-hidden">
            <View className="flex-row justify-between items-start mb-2">
              <Text className="text-white/60 text-[12px] uppercase tracking-[0.1em]" style={{ fontFamily: 'DMSans_700Bold' }}>
                Next Monthly Rent Due
              </Text>
              <View className="bg-emerald-500/20 px-3 py-1 rounded-full border border-emerald-500/30">
                <Text className="text-emerald-400 text-[11px] font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
                  Auto-Pay Ready
                </Text>
              </View>
            </View>

            <Text className="text-white text-[42px] font-light tracking-tight mb-1" style={{ fontFamily: 'Cormorant_300Light' }}>
              ${currentDueRent.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </Text>
            <Text className="text-white/70 text-[13px] mb-6" style={{ fontFamily: 'DMSans_400Regular' }}>
              Due on {nextDueDate} • Unit 4B (500 King St W)
            </Text>

            <TouchableOpacity
              onPress={() => setPaymentModalVisible(true)}
              className="bg-white py-4 rounded-[16px] items-center shadow-sm flex-row justify-center"
            >
              <MaterialIcons name="lock" size={18} color="#0F1C28" />
              <Text className="text-navy text-[16px] font-bold ml-2" style={{ fontFamily: 'DMSans_700Bold' }}>
                Pay Rent via Stripe Sheet
              </Text>
            </TouchableOpacity>
          </View>

          {/* Payment History Ledger */}
          <Text className="text-[13px] text-navy-muted uppercase tracking-[0.08em] mb-3 ml-1" style={{ fontFamily: 'DMSans_700Bold' }}>
            Rent Payment History
          </Text>

          {invoices.length === 0 ? (
            <View className="bg-white rounded-[20px] p-5 border border-navy-border shadow-card mb-3.5 flex-row items-center justify-between">
              <View className="flex-row items-center">
                <View className="w-11 h-11 rounded-[14px] bg-emerald-500/10 items-center justify-center mr-3">
                  <MaterialIcons name="check-circle" size={22} color="#059669" />
                </View>
                <View>
                  <Text className="text-[16px] text-navy font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
                    Monthly Rent Payment
                  </Text>
                  <Text className="text-[12px] text-navy-muted mt-0.5" style={{ fontFamily: 'DMSans_400Regular' }}>
                    Paid via Apple Pay • {format(new Date(), 'MMM 1, yyyy')}
                  </Text>
                </View>
              </View>
              <View className="items-end">
                <Text className="text-[16px] text-navy font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
                  $2,450.00
                </Text>
                <Text className="text-[10px] text-emerald-600 font-bold uppercase mt-0.5" style={{ fontFamily: 'DMSans_700Bold' }}>
                  Receipt Verified
                </Text>
              </View>
            </View>
          ) : (
            invoices.map((inv) => (
              <View
                key={inv.id}
                className="bg-white rounded-[20px] p-5 border border-navy-border shadow-card mb-3.5 flex-row items-center justify-between"
              >
                <View className="flex-row items-center">
                  <View className="w-11 h-11 rounded-[14px] bg-emerald-500/10 items-center justify-center mr-3">
                    <MaterialIcons name="check-circle" size={22} color="#059669" />
                  </View>
                  <View>
                    <Text className="text-[16px] text-navy font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
                      Rent Payment
                    </Text>
                    <Text className="text-[12px] text-navy-muted mt-0.5" style={{ fontFamily: 'DMSans_400Regular' }}>
                      {inv.payment_method || 'Electronic Transfer'} • {format(new Date(inv.created_at), 'MMM d, yyyy')}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => setReceiptInvoice(inv)}
                  className="items-end"
                >
                  <Text className="text-[16px] text-navy font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
                    ${inv.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </Text>
                  <Text className="text-[11px] text-purple-700 font-bold underline mt-0.5" style={{ fontFamily: 'DMSans_700Bold' }}>
                    View Receipt PDF
                  </Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Stripe Payment Sheet Modal */}
      <Modal visible={paymentModalVisible} animationType="slide" transparent>
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-white rounded-t-[32px] p-6 border-t border-navy-border">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-[24px] text-navy font-bold" style={{ fontFamily: 'Cormorant_400Regular' }}>
                Stripe Payment Gateway
              </Text>
              <TouchableOpacity onPress={() => setPaymentModalVisible(false)} className="w-8 h-8 rounded-full bg-pageBg items-center justify-center border border-navy-border">
                <MaterialIcons name="close" size={18} color="#0F1C28" />
              </TouchableOpacity>
            </View>

            <Text className="text-[12px] text-navy-muted uppercase tracking-[0.08em] mb-3" style={{ fontFamily: 'DMSans_700Bold' }}>
              Select Payment Method
            </Text>

            {/* Apple Pay */}
            <TouchableOpacity
              onPress={() => setSelectedMethod('apple_pay')}
              className={`p-4 rounded-[18px] border mb-3 flex-row items-center justify-between ${
                selectedMethod === 'apple_pay' ? 'bg-navy/5 border-navy' : 'bg-pageBg border-navy-border'
              }`}
            >
              <View className="flex-row items-center">
                <MaterialIcons name="phone-iphone" size={22} color="#0F1C28" />
                <View className="ml-3">
                  <Text className="text-[15px] text-navy font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
                    Apple Pay
                  </Text>
                  <Text className="text-[12px] text-navy-muted" style={{ fontFamily: 'DMSans_400Regular' }}>
                    Instant 1-tap checkout with Touch ID / Face ID
                  </Text>
                </View>
              </View>
              {selectedMethod === 'apple_pay' && <MaterialIcons name="check-circle" size={20} color="#0F1C28" />}
            </TouchableOpacity>

            {/* Credit / Debit Card */}
            <TouchableOpacity
              onPress={() => setSelectedMethod('card')}
              className={`p-4 rounded-[18px] border mb-3 flex-row items-center justify-between ${
                selectedMethod === 'card' ? 'bg-navy/5 border-navy' : 'bg-pageBg border-navy-border'
              }`}
            >
              <View className="flex-row items-center">
                <MaterialIcons name="credit-card" size={22} color="#0F1C28" />
                <View className="ml-3">
                  <Text className="text-[15px] text-navy font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
                    Credit / Debit Card
                  </Text>
                  <Text className="text-[12px] text-navy-muted" style={{ fontFamily: 'DMSans_400Regular' }}>
                    Visa, Mastercard, Amex (Encrypted by Stripe)
                  </Text>
                </View>
              </View>
              {selectedMethod === 'card' && <MaterialIcons name="check-circle" size={20} color="#0F1C28" />}
            </TouchableOpacity>

            {/* Interac e-Transfer */}
            <TouchableOpacity
              onPress={() => setSelectedMethod('etransfer')}
              className={`p-4 rounded-[18px] border mb-6 flex-row items-center justify-between ${
                selectedMethod === 'etransfer' ? 'bg-navy/5 border-navy' : 'bg-pageBg border-navy-border'
              }`}
            >
              <View className="flex-row items-center">
                <MaterialIcons name="account-balance" size={22} color="#0F1C28" />
                <View className="ml-3">
                  <Text className="text-[15px] text-navy font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
                    Interac e-Transfer (Canada)
                  </Text>
                  <Text className="text-[12px] text-navy-muted" style={{ fontFamily: 'DMSans_400Regular' }}>
                    Direct transfer to payments@rentified.ca
                  </Text>
                </View>
              </View>
              {selectedMethod === 'etransfer' && <MaterialIcons name="check-circle" size={20} color="#0F1C28" />}
            </TouchableOpacity>

            {/* Action Trigger */}
            <TouchableOpacity
              onPress={handlePayRentNow}
              disabled={processing}
              className="bg-emerald-600 py-4 rounded-[16px] items-center shadow-sm flex-row justify-center mb-2"
            >
              {processing ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <MaterialIcons name="verified-user" size={18} color="#FFFFFF" />
                  <Text className="text-white text-[16px] font-bold ml-2" style={{ fontFamily: 'DMSans_700Bold' }}>
                    Pay ${currentDueRent.toLocaleString('en-US', { minimumFractionDigits: 2 })} Now
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Digital Receipt Modal */}
      {receiptInvoice && (
        <Modal visible={!!receiptInvoice} animationType="slide" transparent>
          <View className="flex-1 bg-black/60 justify-end">
            <View className="bg-white rounded-t-[32px] p-6 border-t border-navy-border">
              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-[24px] text-navy font-bold" style={{ fontFamily: 'Cormorant_400Regular' }}>
                  Official Rent Payment Receipt
                </Text>
                <TouchableOpacity onPress={() => setReceiptInvoice(null)} className="w-8 h-8 rounded-full bg-pageBg items-center justify-center border border-navy-border">
                  <MaterialIcons name="close" size={18} color="#0F1C28" />
                </TouchableOpacity>
              </View>

              <View className="bg-emerald-500/10 rounded-[20px] p-5 border border-emerald-500/30 items-center mb-6">
                <View className="w-12 h-12 rounded-full bg-emerald-500 items-center justify-center mb-2">
                  <MaterialIcons name="check" size={26} color="#FFFFFF" />
                </View>
                <Text className="text-[22px] text-navy font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
                  ${receiptInvoice.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </Text>
                <Text className="text-[12px] text-emerald-800 font-bold uppercase tracking-wider mt-0.5" style={{ fontFamily: 'DMSans_700Bold' }}>
                  Payment Verified & Completed
                </Text>
              </View>

              <View className="bg-pageBg rounded-[18px] p-4 border border-navy-border mb-6">
                <View className="flex-row justify-between py-2 border-b border-navy-border/60">
                  <Text className="text-[13px] text-navy-muted" style={{ fontFamily: 'DMSans_400Regular' }}>Receipt ID</Text>
                  <Text className="text-[13px] text-navy font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>{receiptInvoice.id}</Text>
                </View>

                <View className="flex-row justify-between py-2 border-b border-navy-border/60">
                  <Text className="text-[13px] text-navy-muted" style={{ fontFamily: 'DMSans_400Regular' }}>Payment Method</Text>
                  <Text className="text-[13px] text-navy font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>{receiptInvoice.payment_method || 'Apple Pay'}</Text>
                </View>

                <View className="flex-row justify-between py-2">
                  <Text className="text-[13px] text-navy-muted" style={{ fontFamily: 'DMSans_400Regular' }}>Landlord Entity</Text>
                  <Text className="text-[13px] text-navy font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>Prospera Properties Inc.</Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => {
                  setReceiptInvoice(null);
                  Alert.alert('Download Receipt', 'Downloading PDF receipt to your device...');
                }}
                className="bg-navy py-4 rounded-[16px] items-center shadow-sm flex-row justify-center mb-2"
              >
                <MaterialIcons name="file-download" size={18} color="#FFFFFF" />
                <Text className="text-white text-[16px] font-bold ml-2" style={{ fontFamily: 'DMSans_700Bold' }}>
                  Save PDF Receipt
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}
