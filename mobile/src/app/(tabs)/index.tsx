import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export default function DashboardScreen() {
  const { session } = useAuth();
  const [totalRent, setTotalRent] = useState(0);
  const [pendingTasks, setPendingTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [session]);

  async function fetchDashboardData() {
    try {
      setLoading(true);
      if (!session?.user) return;

      // 1. Calculate Total Rent Collected
      const { data: payments } = await supabase
        .from('payments')
        .select('amount')
        .eq('status', 'paid');
      
      const sum = payments?.reduce((acc, curr) => acc + curr.amount, 0) || 0;
      setTotalRent(sum);

      // 2. Fetch Pending Maintenance
      const { data: tasks } = await supabase
        .from('maintenance_requests')
        .select('id, title, status, priority, units(unit_number)')
        .in('status', ['open', 'in_progress'])
        .limit(3);

      setPendingTasks(tasks || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <View className="flex-1 bg-surface-dark justify-center items-center">
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-surface px-6 pt-16">
      <View className="mb-10">
        <Text className="text-sm text-brand-600 mb-1 tracking-widest uppercase" style={{ fontFamily: 'Cinzel_700Bold' }}>Overview</Text>
        <Text className="text-4xl text-textMain leading-tight" style={{ fontFamily: 'Cinzel_700Bold' }}>Welcome back,</Text>
        <Text className="text-4xl text-textMain leading-tight opacity-60" style={{ fontFamily: 'Cinzel_400Regular' }}>Landlord</Text>
      </View>
      
      <View className="bg-brand-500 rounded-[32px] p-8 mb-10 shadow-lg shadow-brand-500/20">
        <Text className="text-white/70 text-xs tracking-widest uppercase mb-2" style={{ fontFamily: 'JosefinSans_400Regular' }}>Total Revenue</Text>
        <Text className="text-white text-5xl tracking-tighter" style={{ fontFamily: 'Cinzel_700Bold' }}>
          ${totalRent.toLocaleString(undefined, { minimumFractionDigits: 0 })}
        </Text>
        <View className="mt-8 flex-row items-center justify-between">
          <Text className="text-white/70 text-sm" style={{ fontFamily: 'JosefinSans_400Regular' }}>+14% from last month</Text>
          <View className="bg-white/20 px-4 py-2 rounded-full">
            <Text className="text-white text-xs tracking-widest uppercase" style={{ fontFamily: 'Cinzel_600SemiBold' }}>View Report</Text>
          </View>
        </View>
      </View>

      <View className="flex-row items-center justify-between mb-6">
        <Text className="text-xl text-textMain" style={{ fontFamily: 'Cinzel_600SemiBold' }}>Action Required</Text>
        <Text className="text-brand-500 text-sm" style={{ fontFamily: 'JosefinSans_700Bold' }}>See All</Text>
      </View>
      
      {pendingTasks.length === 0 ? (
        <View className="bg-white rounded-3xl p-8 items-center shadow-sm border border-slate-100 mb-10">
          <Text className="text-textMain/50 text-base" style={{ fontFamily: 'JosefinSans_400Regular' }}>No pending tasks! Enjoy your day.</Text>
        </View>
      ) : (
        pendingTasks.map(task => (
          <View key={task.id} className="bg-white rounded-[24px] p-5 mb-4 flex-row items-center shadow-sm border border-slate-100">
            <View className={`w-12 h-12 rounded-full items-center justify-center mr-4 ${task.priority === 'urgent' || task.priority === 'high' ? 'bg-critical/10' : 'bg-warning/10'}`}>
              <Text className={`text-xl ${task.priority === 'urgent' || task.priority === 'high' ? 'text-critical' : 'text-warning'}`}>!</Text>
            </View>
            <View className="flex-1">
              <Text className="text-textMain text-lg mb-1" style={{ fontFamily: 'JosefinSans_700Bold' }}>{task.title}</Text>
              <Text className="text-textMain/60 text-sm" style={{ fontFamily: 'JosefinSans_400Regular' }}>Unit {task.units?.unit_number} • {task.status.replace('_', ' ')}</Text>
            </View>
          </View>
        ))
      )}
      <View className="h-10" />
    </ScrollView>
  );
}
