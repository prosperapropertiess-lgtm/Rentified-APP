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
    <ScrollView className="flex-1 bg-surface-dark px-4 pt-12">
      <Text className="text-3xl font-bold text-white mb-6 tracking-tight">Dashboard</Text>
      
      <View className="bg-brand-500 rounded-xl p-6 mb-6 shadow-sm">
        <Text className="text-white/80 text-sm font-medium mb-1">Total Rent Collected</Text>
        <Text className="text-white text-4xl font-bold tabular-nums">
          ${totalRent.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </Text>
        <Text className="text-white/80 text-xs mt-2">All time</Text>
      </View>

      <Text className="text-xl font-semibold text-white mb-4">Pending Tasks</Text>
      
      {pendingTasks.length === 0 ? (
        <View className="bg-white/5 border border-white/10 rounded-xl p-6 items-center">
          <Text className="text-secondary text-base">No pending tasks!</Text>
        </View>
      ) : (
        pendingTasks.map(task => (
          <View key={task.id} className="bg-white/5 border border-white/10 rounded-xl p-4 mb-3 flex-row items-center justify-between">
            <View>
              <Text className="text-white font-medium text-base">{task.title}</Text>
              <Text className="text-secondary text-sm">Unit {task.units?.unit_number} • {task.status.replace('_', ' ')}</Text>
            </View>
            <View className={`px-3 py-1 rounded-full ${task.priority === 'urgent' || task.priority === 'high' ? 'bg-critical/20' : 'bg-warning/20'}`}>
              <Text className={`text-xs font-medium capitalize ${task.priority === 'urgent' || task.priority === 'high' ? 'text-critical' : 'text-warning'}`}>
                {task.priority}
              </Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}
