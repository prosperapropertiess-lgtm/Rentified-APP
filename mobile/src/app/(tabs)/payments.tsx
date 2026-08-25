import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export type PaymentStatus = 'pending' | 'paid' | 'overdue';

interface PaymentRow {
  id: string;
  amount: number;
  status: PaymentStatus;
  due_date: string;
  paid_at: string | null;
  tenants: { first_name: string | null; last_name: string | null } | null;
}

interface ActiveLeaseRow {
  id: string;
  rent_amount: number | null;
  tenants: { first_name: string | null; last_name: string | null } | null;
  units: { unit_number: string | null; properties: { name: string | null; address: string | null } | null } | null;
}

function tenantName(t: { first_name: string | null; last_name: string | null } | null) {
  return `${t?.first_name ?? ''} ${t?.last_name ?? ''}`.trim() || 'Tenant';
}

export default function OwnerPaymentsScreen() {
  const { profileId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [activeLeases, setActiveLeases] = useState<ActiveLeaseRow[]>([]);

  const fetchAll = useCallback(async () => {
    if (!profileId) return;
    try {
      const [{ data: paymentData }, { data: leaseData }] = await Promise.all([
        supabase
          .from('payments')
          .select(`id, amount, status, due_date, paid_at, tenants ( first_name, last_name )`)
          .eq('landlord_id', profileId)
          .order('due_date', { ascending: false }),
        // Not filtering by status='active': every lease in this database is
        // currently 'pending' from the Notion ETL (verified 9/9), even for
        // units marked 'occupied'. Filtering here would always return zero
        // rows. Showing all leases until lease-status lifecycle is decided.
        supabase
          .from('leases')
          .select(`id, rent_amount, tenants ( first_name, last_name ), units ( unit_number, properties ( name, address ) )`)
          .eq('landlord_id', profileId),
      ]);

      // Supabase's default (ungenerated) client types every nested embed as
      // an array regardless of FK cardinality; these are verified to-one.
      setPayments((paymentData || []) as unknown as PaymentRow[]);
      setActiveLeases((leaseData || []) as unknown as ActiveLeaseRow[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => { setTimeout(() => fetchAll(), 0); }, [fetchAll]);

  const markAsPaid = async (paymentId: string) => {
    try {
      const { error } = await supabase
        .from('payments')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', paymentId);

      if (error) throw error;
      fetchAll();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  if (loading) return <View className="flex-1 bg-pageBg justify-center items-center"><ActivityIndicator color="#1F2F3A" /></View>;

  const unpaid = payments.filter((r) => r.status !== 'paid');
  const paid = payments.filter((r) => r.status === 'paid');
  const expectedMonthlyRent = activeLeases.reduce((sum, l) => sum + Number(l.rent_amount ?? 0), 0);
  const collectedThisMonth = paid
    .filter((p) => p.paid_at && new Date(p.paid_at).getMonth() === new Date().getMonth())
    .reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <View className="flex-1 bg-pageBg">
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 64, paddingBottom: 100 }}>
        <Text className="text-[40px] text-navy font-sansBold mb-8">Financials</Text>

        <View className="flex-row gap-4 mb-10">
          <View className="flex-1 bg-card rounded-[20px] p-5 border border-navy-border shadow-sm">
            <Text className="text-navy-muted font-sans text-[12px] uppercase tracking-wide">Expected / mo</Text>
            <Text className="text-navy font-sansBold text-[22px] mt-1.5">${expectedMonthlyRent.toLocaleString()}</Text>
          </View>
          <View className="flex-1 bg-card rounded-[20px] p-5 border border-navy-border shadow-sm">
            <Text className="text-navy-muted font-sans text-[12px] uppercase tracking-wide">Collected this month</Text>
            <Text className="text-navy font-sansBold text-[22px] mt-1.5">${collectedThisMonth.toLocaleString()}</Text>
          </View>
        </View>

        <Text className="text-[22px] text-navy font-sansBold mb-5">Needs Action (Unpaid)</Text>
        {unpaid.length === 0 ? (
          <Text className="text-navy-muted font-sans mb-10">No unpaid rent recorded.</Text>
        ) : (
          unpaid.map((entry) => (
            <View key={entry.id} className="bg-card p-5 rounded-[20px] mb-5 border border-navy-border shadow-sm flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-navy font-sansBold text-[17px] mb-1.5">{tenantName(entry.tenants)}</Text>
                <Text className="text-navy-muted font-sans text-[15px]">Due: {new Date(entry.due_date).toLocaleDateString()}</Text>
                <Text className="text-burgundy font-sansBold text-[17px] mt-1.5">${entry.amount}</Text>
              </View>
              <TouchableOpacity onPress={() => markAsPaid(entry.id)} className="bg-navy px-4 py-2.5 rounded-xl">
                <Text className="text-white font-sansBold">Mark Paid</Text>
              </TouchableOpacity>
            </View>
          ))
        )}

        <Text className="text-[22px] text-navy font-sansBold mb-5 mt-4">Recent Payments</Text>
        {paid.length === 0 ? (
          <Text className="text-navy-muted font-sans mb-10">No payments recorded yet.</Text>
        ) : (
          paid.map((entry) => (
            <View key={entry.id} className="bg-card p-5 rounded-[20px] mb-5 border border-navy-border shadow-sm flex-row items-center justify-between opacity-80">
              <View>
                <Text className="text-navy font-sansBold text-[17px] mb-1.5">{tenantName(entry.tenants)}</Text>
                <Text className="text-navy-muted font-sans text-[15px]">Paid: {new Date(entry.paid_at || entry.due_date).toLocaleDateString()}</Text>
              </View>
              <View className="items-end">
                <Text className="text-navy font-sansBold text-[17px] mb-1.5">+${entry.amount}</Text>
                <View className="bg-emerald-500/10 px-2.5 py-1.5 rounded-full mt-1">
                  <Text className="text-emerald-700 font-sansBold text-[12px]">PAID</Text>
                </View>
              </View>
            </View>
          ))
        )}

        <Text className="text-[22px] text-navy font-sansBold mb-5 mt-4">Current Leases</Text>
        {activeLeases.length === 0 ? (
          <Text className="text-navy-muted font-sans">No active leases.</Text>
        ) : (
          activeLeases.map((lease) => {
            const unitLabel = lease.units?.unit_number
              ? `${lease.units.properties?.name ?? lease.units.properties?.address ?? ''} · Unit ${lease.units.unit_number}`
              : lease.units?.properties?.name ?? lease.units?.properties?.address ?? '';
            return (
              <View key={lease.id} className="bg-card p-5 rounded-[16px] mb-4 border border-navy-border flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="text-navy font-sansBold text-[15px]">{tenantName(lease.tenants)}</Text>
                  <Text className="text-navy-muted font-sans text-[13px] mt-1">{unitLabel}</Text>
                </View>
                <Text className="text-navy font-sansBold text-[15px]">${Number(lease.rent_amount ?? 0).toLocaleString()}/mo</Text>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
