import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

type Payment = {
  id: string;
  amount: number;
  due_date: string;
  status: string;
  payment_method: string;
};

export default function PaymentsScreen() {
  const { session } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPayments();
  }, [session]);

  async function fetchPayments() {
    try {
      setLoading(true);
      if (!session?.user) return;

      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .order('due_date', { ascending: false });

      if (error) {
        console.error('Error fetching payments:', error.message);
        return;
      }

      setPayments(data || []);
    } catch (error) {
      console.error('Unexpected error:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <View className="flex-1 bg-surface justify-center items-center">
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-surface pt-12">
      <View className="px-6 mb-6 flex-row justify-between items-center">
        <Text className="text-2xl font-semibold text-primary tracking-tight">Payments</Text>
        <TouchableOpacity className="bg-brand-500 px-4 py-2 rounded-lg">
          <Text className="text-white font-medium text-sm">Record Payment</Text>
        </TouchableOpacity>
      </View>

      <View className="px-6 pb-8">
        {payments.length === 0 ? (
          <View className="bg-white border border-slate-200 rounded-xl p-8 items-center shadow-sm">
            <Text className="text-secondary text-base mb-4 text-center">No payment history found.</Text>
          </View>
        ) : (
          payments.map((payment) => (
            <View 
              key={payment.id} 
              className="bg-white border border-slate-200 rounded-xl mb-4 p-4 shadow-sm flex-row items-center justify-between"
            >
              <View className="flex-1">
                <Text className="text-lg font-semibold text-primary tabular-nums mb-1">
                  ${payment.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </Text>
                <Text className="text-sm text-secondary">
                  Due: {new Date(payment.due_date).toLocaleDateString()}
                </Text>
              </View>
              
              <View className="items-end">
                <View className={`px-2 py-1 rounded mb-1 ${
                  payment.status === 'paid' ? 'bg-emerald-100' : 
                  payment.status === 'overdue' ? 'bg-rose-100' : 'bg-amber-100'
                }`}>
                  <Text className={`text-xs font-medium capitalize ${
                    payment.status === 'paid' ? 'text-emerald-700' : 
                    payment.status === 'overdue' ? 'text-rose-700' : 'text-amber-700'
                  }`}>
                    {payment.status}
                  </Text>
                </View>
                <Text className="text-xs text-secondary capitalize">{payment.payment_method}</Text>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}
