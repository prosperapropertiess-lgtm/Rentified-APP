import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { monthDay } from '../../lib/format';

export default function TenantPaymentsScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<any[]>([]);

  const fetchRent = React.useCallback(async () => {
    if (!user) return;
    try {
      const { data: tenant } = await supabase.from('tenants').select('id').eq('user_id', user.id).single();
      if (!tenant) return;
      
      const { data: history } = await supabase
        .from('payments')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('due_date', { ascending: false });
        
      setPayments(history || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    setTimeout(() => fetchRent(), 0);
  }, [fetchRent]);

  if (loading) return <View className="flex-1 bg-pageBg justify-center items-center"><ActivityIndicator color="#1F2F3A" /></View>;

  const unpaid = payments.filter(p => p.status !== 'paid');
  const totalUnpaid = unpaid.reduce((sum, item) => sum + Number(item.amount), 0);

  return (
    <View className="flex-1 bg-pageBg">
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 100 }}>
        
        <Text className="text-[40px] text-navy font-sansBold mb-8">Rent & Payments</Text>

        <View className="bg-navy p-6 rounded-[24px] mb-8 shadow-sm">
          <Text className="text-white/70 font-sansBold text-[13px] uppercase tracking-wider mb-2">Current Balance</Text>
          <Text className="text-[56px] text-white font-sansBold leading-none tracking-tight mb-6">
            ${totalUnpaid.toLocaleString()}
          </Text>
          
          <TouchableOpacity 
            className={`w-full py-4 rounded-xl items-center ${totalUnpaid > 0 ? 'bg-burgundy' : 'bg-white/20 opacity-50'}`}
            disabled={totalUnpaid === 0}
          >
            <Text className="text-white font-sansBold text-[17px]">
              {totalUnpaid > 0 ? 'Pay Now' : 'All Caught Up'}
            </Text>
          </TouchableOpacity>
        </View>

        <Text className="text-[24px] text-navy font-sansBold mb-4 mt-2">Payment History</Text>
        
        {payments.length === 0 ? (
          <Text className="text-navy-muted font-sans">No payment history found.</Text>
        ) : (
          payments.map(entry => {
            const isPaid = entry.status === 'paid';
            return (
              <View key={entry.id} className="bg-card p-5 rounded-[20px] mb-4 border border-navy-border shadow-sm flex-row items-center justify-between">
                <View>
                  <Text className="text-navy font-sansBold text-[17px] mb-1">{entry.type || 'Rent'}</Text>
                  <Text className="text-navy-muted font-sans text-[14px]">
                    {isPaid && entry.paid_at ? `Paid on ${monthDay(entry.paid_at)}` : `Due ${monthDay(entry.due_date)}`}
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="text-navy font-sansBold text-[17px] mb-1">${entry.amount}</Text>
                  <View className={`px-2 py-1 rounded-md ${isPaid ? 'bg-navy/10' : 'bg-burgundy/10'}`}>
                    <Text className={`font-sansBold text-[12px] ${isPaid ? 'text-navy' : 'text-burgundy'}`}>
                      {entry.status.toUpperCase()}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })
        )}

      </ScrollView>
    </View>
  );
}
