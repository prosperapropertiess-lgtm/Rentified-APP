import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { money } from '../../lib/format';

export type PaymentStatus = 'pending' | 'paid' | 'overdue';

interface PaymentRow {
  id: string;
  amount: number;
  status: PaymentStatus;
  due_date: string;
  paid_at: string | null;
  tenants: { first_name: string | null; last_name: string | null } | null;
}

interface UnitInfo {
  rent_amount: number | null;
  leases: { status: string | null; rent_amount: number | null }[];
}
interface PropertyRow {
  id: string;
  name: string | null;
  address: string | null;
  units: UnitInfo[];
}
interface LedgerEntry {
  property_id: string;
  amount: number;
}

function tenantName(t: { first_name: string | null; last_name: string | null } | null) {
  return `${t?.first_name ?? ''} ${t?.last_name ?? ''}`.trim() || 'Tenant';
}

function expectedRentFor(units: UnitInfo[]) {
  return units.reduce((sum, u) => {
    const active = u.leases?.find((l) => l.status === 'active') ?? u.leases?.[0] ?? null;
    return sum + Number(active?.rent_amount ?? u.rent_amount ?? 0);
  }, 0);
}

export default function OwnerPaymentsScreen() {
  const { profileId } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [expenses, setExpenses] = useState<LedgerEntry[]>([]);
  const [income, setIncome] = useState<LedgerEntry[]>([]);

  const fetchAll = useCallback(async () => {
    if (!profileId) return;
    try {
      const [{ data: paymentData }, { data: propData }, { data: expData }, { data: incData }] = await Promise.all([
        supabase
          .from('payments')
          .select(`id, amount, status, due_date, paid_at, tenants ( first_name, last_name )`)
          .eq('landlord_id', profileId)
          .order('due_date', { ascending: false }),
        supabase
          .from('properties')
          .select(`id, name, address, units ( rent_amount, leases ( status, rent_amount ) )`)
          .eq('landlord_id', profileId),
        supabase.from('expenses').select('property_id, amount').eq('landlord_id', profileId),
        supabase.from('income').select('property_id, amount').eq('landlord_id', profileId),
      ]);

      // Supabase's default (ungenerated) client types every nested embed as
      // an array regardless of FK cardinality; leases->tenants is verified
      // to-one (units->leases is genuinely to-many, left as an array).
      setPayments((paymentData || []) as unknown as PaymentRow[]);
      setProperties((propData || []) as unknown as PropertyRow[]);
      setExpenses((expData || []) as LedgerEntry[]);
      setIncome((incData || []) as LedgerEntry[]);
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
  const expectedMonthlyRent = properties.reduce((sum, p) => sum + expectedRentFor(p.units), 0);
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
            <Text className="text-navy font-sansBold text-[22px] mt-1.5">${money(expectedMonthlyRent)}</Text>
          </View>
          <View className="flex-1 bg-card rounded-[20px] p-5 border border-navy-border shadow-sm">
            <Text className="text-navy-muted font-sans text-[12px] uppercase tracking-wide">Collected this month</Text>
            <Text className="text-navy font-sansBold text-[22px] mt-1.5">${money(collectedThisMonth)}</Text>
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
                <Text className="text-burgundy font-sansBold text-[17px] mt-1.5">${money(entry.amount)}</Text>
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
                <Text className="text-navy font-sansBold text-[17px] mb-1.5">+${money(entry.amount)}</Text>
                <View className="bg-emerald-500/10 px-2.5 py-1.5 rounded-full mt-1">
                  <Text className="text-emerald-700 font-sansBold text-[12px]">PAID</Text>
                </View>
              </View>
            </View>
          ))
        )}

        <Text className="text-[22px] text-navy font-sansBold mb-5 mt-4">By Property</Text>
        {properties.length === 0 ? (
          <Text className="text-navy-muted font-sans">No properties yet.</Text>
        ) : (
          properties.map((p) => {
            const propExpected = expectedRentFor(p.units);
            const propIncome = income.filter((i) => i.property_id === p.id).reduce((s, i) => s + Number(i.amount), 0);
            const propExpenses = expenses.filter((e) => e.property_id === p.id).reduce((s, e) => s + Number(e.amount), 0);
            const net = propIncome - propExpenses;
            return (
              <TouchableOpacity
                key={p.id}
                onPress={() => router.push(`/property/${p.id}`)}
                className="bg-card p-5 rounded-[20px] mb-4 border border-navy-border shadow-sm"
              >
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-navy font-sansBold text-[16px] flex-1 pr-3" numberOfLines={1}>{p.name || p.address}</Text>
                  <Feather name="chevron-right" size={18} color="#1F2F3A" style={{ opacity: 0.3 }} />
                </View>
                <View className="flex-row justify-between">
                  <View>
                    <Text className="text-navy-muted font-sans text-[11px] uppercase tracking-wide">Expected</Text>
                    <Text className="text-navy font-sansBold text-[15px] mt-0.5">${money(propExpected)}/mo</Text>
                  </View>
                  <View>
                    <Text className="text-navy-muted font-sans text-[11px] uppercase tracking-wide">Income</Text>
                    <Text className="text-emerald-700 font-sansBold text-[15px] mt-0.5">${money(propIncome)}</Text>
                  </View>
                  <View>
                    <Text className="text-navy-muted font-sans text-[11px] uppercase tracking-wide">Expenses</Text>
                    <Text className="text-burgundy font-sansBold text-[15px] mt-0.5">${money(propExpenses)}</Text>
                  </View>
                  <View>
                    <Text className="text-navy-muted font-sans text-[11px] uppercase tracking-wide">Net</Text>
                    <Text className="text-navy font-sansBold text-[15px] mt-0.5">${money(net)}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
