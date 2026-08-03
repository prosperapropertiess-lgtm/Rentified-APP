import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import NotificationCenterModal from '../../components/NotificationCenterModal';

type PendingTask = {
  id: string;
  title: string;
  category: string;
  priority: string;
};

export default function HomeScreen() {
  const router = useRouter();
  const { session, role, setRole } = useAuth();
  const [totalRent] = useState(12850);
  const [pendingTasks, setPendingTasks] = useState<PendingTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifVisible, setNotifVisible] = useState(false);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        setLoading(true);
        if (!session?.user) return;

        // Fetch Landlord Profile
        const { data: landlord } = await supabase
          .from('landlords')
          .select('id')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (landlord) {
          // Fetch Total Rent / Maintenance Tasks
          const { data: tickets } = await supabase
            .from('maintenance_tickets')
            .select('*')
            .eq('status', 'submitted');

          if (tickets) {
            setPendingTasks(
              tickets.map((t) => ({
                id: t.id,
                title: t.title,
                category: t.category,
                priority: t.priority,
              }))
            );
          }
        }
      } catch (err) {
        console.error('Error loading dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboardData();
  }, [session]);

  if (loading) {
    return (
      <View className="flex-1 bg-pageBg justify-center items-center">
        <ActivityIndicator size="large" color="#0F1C28" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-pageBg relative">
      <ScrollView className="flex-1 z-10 px-6 pt-16 pb-28" contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Header with 1-Tap Role Testing Switcher */}
        <View className="mb-6 flex-row justify-between items-center">
          <View>
            <View className="flex-row items-center mb-0.5">
              <Text className="text-[11px] text-navy-muted uppercase tracking-[0.12em] mr-2" style={{ fontFamily: 'DMSans_700Bold' }}>
                Command Center
              </Text>
              <TouchableOpacity
                onPress={() => {
                  const newRole = role === 'landlord' ? 'tenant' : 'landlord';
                  setRole(newRole);
                  if (newRole === 'tenant') {
                    router.push('/tenant-home');
                  }
                }}
                className="bg-navy/10 px-2.5 py-0.5 rounded-full border border-navy/20"
              >
                <Text className="text-[10px] text-navy font-bold uppercase" style={{ fontFamily: 'DMSans_700Bold' }}>
                  {role === 'landlord' ? '⚡ Landlord Mode' : '🔑 Tenant Mode'}
                </Text>
              </TouchableOpacity>
            </View>
            <Text className="text-[34px] text-navy leading-tight mt-0.5" style={{ fontFamily: 'Cormorant_300Light' }}>
              Welcome back
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => setNotifVisible(true)}
            className="w-12 h-12 rounded-full bg-white border border-navy-border items-center justify-center shadow-card relative"
          >
            <MaterialIcons name="notifications-none" size={22} color="#0F1C28" />
            <View className="absolute top-2.5 right-2.5 w-2.5 h-2.5 rounded-full bg-burgundy border-2 border-white" />
          </TouchableOpacity>
        </View>

        {/* ----------------------------------------------------------------- */}
        {/* TENANT PORTAL QUICK SWITCHER CARD */}
        {/* ----------------------------------------------------------------- */}
        <TouchableOpacity
          onPress={() => {
            setRole('tenant');
            router.push('/tenant-home');
          }}
          className="bg-gradient-to-r from-purple-900 to-indigo-900 bg-purple-950 rounded-[22px] p-4 mb-6 border border-purple-800 shadow-card flex-row items-center justify-between"
          activeOpacity={0.85}
        >
          <View className="flex-row items-center flex-1 mr-2">
            <View className="w-11 h-11 rounded-[14px] bg-white/10 items-center justify-center mr-3">
              <MaterialIcons name="vpn-key" size={22} color="#E9D5FF" />
            </View>
            <View className="flex-1">
              <Text className="text-white text-[15px] font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
                🔑 Tenant Portal Experience
              </Text>
              <Text className="text-purple-200 text-[12px]" style={{ fontFamily: 'DMSans_400Regular' }}>
                Tap to test rent payment, maintenance requests & lease docs as a tenant
              </Text>
            </View>
          </View>

          <View className="bg-white/15 px-3 py-1.5 rounded-full flex-row items-center">
            <Text className="text-white text-[11px] font-bold uppercase" style={{ fontFamily: 'DMSans_700Bold' }}>
              Switch ➔
            </Text>
          </View>
        </TouchableOpacity>

        {/* Revenue Hero Card */}
        <View className="bg-navy rounded-[28px] p-7 mb-6 shadow-card relative overflow-hidden">
          <Text className="text-white/60 text-[12px] uppercase tracking-[0.1em] mb-2" style={{ fontFamily: 'DMSans_700Bold' }}>
            Portfolio Monthly Revenue
          </Text>
          <Text className="text-white text-[44px] tracking-tight mb-4" style={{ fontFamily: 'Cormorant_300Light' }}>
            ${totalRent.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </Text>

          <View className="flex-row items-center justify-between pt-4 border-t border-white/10">
            <View className="flex-row items-center">
              <MaterialIcons name="trending-up" size={16} color="#34D399" />
              <Text className="text-emerald-400 text-[13px] ml-1.5 font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
                +14% vs Last Month
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => setNotifVisible(true)}
              className="bg-white/15 px-4 py-2 rounded-full"
            >
              <Text className="text-white text-[12px] font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
                View Hub
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ----------------------------------------------------------------- */}
        {/* PROPERTY HEALTH OVERVIEW CARD (Specification #7) */}
        {/* ----------------------------------------------------------------- */}
        <TouchableOpacity
          onPress={() => router.push('/property-health')}
          className="bg-white rounded-[26px] p-6 border border-navy-border shadow-card mb-8"
          activeOpacity={0.85}
        >
          <View className="flex-row justify-between items-start mb-3">
            <View className="flex-row items-center">
              <View className="w-10 h-10 rounded-[14px] bg-emerald-500/10 items-center justify-center mr-3">
                <MaterialIcons name="favorite" size={22} color="#059669" />
              </View>
              <View>
                <Text className="text-[18px] text-navy font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
                  Property Health Status
                </Text>
                <Text className="text-[12px] text-navy-muted" style={{ fontFamily: 'DMSans_400Regular' }}>
                  System Telemetry & Maintenance Audit
                </Text>
              </View>
            </View>

            <View className="bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/30 flex-row items-center">
              <Text className="text-emerald-700 text-[13px] font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
                91% Avg 🟢
              </Text>
            </View>
          </View>

          {/* 4-Column Metrics Grid (#7 Specification) */}
          <View className="bg-pageBg rounded-[18px] p-3.5 border border-navy-border/60 flex-row justify-around mb-3">
            <View className="items-center">
              <Text className="text-[10px] text-navy-muted uppercase font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>Avg Score</Text>
              <Text className="text-[16px] text-emerald-700 font-bold mt-0.5" style={{ fontFamily: 'DMSans_700Bold' }}>91%</Text>
            </View>
            <View className="w-[1px] bg-navy-border" />
            <View className="items-center">
              <Text className="text-[10px] text-navy-muted uppercase font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>Attention</Text>
              <Text className="text-[16px] text-amber-700 font-bold mt-0.5" style={{ fontFamily: 'DMSans_700Bold' }}>2</Text>
            </View>
            <View className="w-[1px] bg-navy-border" />
            <View className="items-center">
              <Text className="text-[10px] text-navy-muted uppercase font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>Upcoming</Text>
              <Text className="text-[16px] text-navy font-bold mt-0.5" style={{ fontFamily: 'DMSans_700Bold' }}>5</Text>
            </View>
            <View className="w-[1px] bg-navy-border" />
            <View className="items-center">
              <Text className="text-[10px] text-navy-muted uppercase font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>Overdue</Text>
              <Text className="text-[16px] text-rose-600 font-bold mt-0.5" style={{ fontFamily: 'DMSans_700Bold' }}>1</Text>
            </View>
          </View>

          <View className="flex-row items-center justify-between pt-1">
            <Text className="text-[12px] text-navy-muted" style={{ fontFamily: 'DMSans_400Regular' }}>
              Next: <Text className="font-bold text-navy">HVAC Filter Replacement (in 18 days)</Text>
            </Text>
            <MaterialIcons name="chevron-right" size={20} color="#94A3B8" />
          </View>
        </TouchableOpacity>

        {/* Landlord Operating System Shortcuts Grid */}
        <Text className="text-[13px] text-navy-muted uppercase tracking-[0.08em] mb-3 ml-1" style={{ fontFamily: 'DMSans_700Bold' }}>
          Automation Center & Tax Tools
        </Text>

        <View className="flex-row gap-2.5 mb-8">
          <TouchableOpacity
            onPress={() => router.push('/lease-renewal')}
            className="flex-1 bg-white p-4 rounded-[20px] border border-navy-border shadow-card items-start"
          >
            <View className="w-10 h-10 rounded-[12px] bg-purple-500/10 items-center justify-center mb-2">
              <MaterialIcons name="autorenew" size={20} color="#7C3AED" />
            </View>
            <Text className="text-[13px] text-navy font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
              Lease Renew
            </Text>
            <Text className="text-[10px] text-navy-muted" style={{ fontFamily: 'DMSans_400Regular' }}>
              Ontario Form
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/tax-export')}
            className="flex-1 bg-white p-4 rounded-[20px] border border-navy-border shadow-card items-start"
          >
            <View className="w-10 h-10 rounded-[12px] bg-emerald-500/10 items-center justify-center mb-2">
              <MaterialIcons name="description" size={20} color="#059669" />
            </View>
            <Text className="text-[13px] text-navy font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
              T776 Tax
            </Text>
            <Text className="text-[10px] text-navy-muted" style={{ fontFamily: 'DMSans_400Regular' }}>
              CRA Report
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/contractor-dispatch')}
            className="flex-1 bg-white p-4 rounded-[20px] border border-navy-border shadow-card items-start"
          >
            <View className="w-10 h-10 rounded-[12px] bg-amber-500/10 items-center justify-center mb-2">
              <MaterialIcons name="build" size={20} color="#D97706" />
            </View>
            <Text className="text-[13px] text-navy font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
              Contractors
            </Text>
            <Text className="text-[10px] text-navy-muted" style={{ fontFamily: 'DMSans_400Regular' }}>
              24/7 Dispatch
            </Text>
          </TouchableOpacity>
        </View>

        {/* Action Required Section */}
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-[20px] text-navy font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
            Requires Attention
          </Text>
          <TouchableOpacity onPress={() => setNotifVisible(true)}>
            <Text className="text-burgundy text-[13px] font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
              View All ({pendingTasks.length + 2})
            </Text>
          </TouchableOpacity>
        </View>

        {pendingTasks.length === 0 ? (
          <View className="bg-white rounded-[24px] p-6 border border-navy-border items-center shadow-card mb-6">
            <View className="w-12 h-12 rounded-full bg-emerald-500/10 items-center justify-center mb-2">
              <MaterialIcons name="check-circle" size={24} color="#059669" />
            </View>
            <Text className="text-[16px] text-navy font-bold mb-1" style={{ fontFamily: 'DMSans_700Bold' }}>
              All Systems Operational
            </Text>
            <Text className="text-[13px] text-navy-muted text-center" style={{ fontFamily: 'DMSans_400Regular' }}>
              No critical maintenance emergencies or overdue rents requiring action.
            </Text>
          </View>
        ) : (
          pendingTasks.map((task) => (
            <View key={task.id} className="bg-white rounded-[20px] p-5 mb-3.5 flex-row items-center shadow-card border border-navy-border">
              <View className={`w-11 h-11 rounded-[14px] items-center justify-center mr-3.5 ${
                task.priority === 'urgent' || task.priority === 'high' ? 'bg-red-500/10' : 'bg-amber-500/10'
              }`}>
                <MaterialIcons
                  name="warning"
                  size={22}
                  color={task.priority === 'urgent' || task.priority === 'high' ? '#DC2626' : '#D97706'}
                />
              </View>

              <View className="flex-1">
                <Text className="text-[16px] text-navy font-bold mb-0.5" style={{ fontFamily: 'DMSans_700Bold' }}>
                  {task.title}
                </Text>
                <Text className="text-[12px] text-navy-muted capitalize" style={{ fontFamily: 'DMSans_400Regular' }}>
                  {task.category} • Priority: {task.priority}
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Notification Center Modal */}
      <NotificationCenterModal visible={notifVisible} onClose={() => setNotifVisible(false)} />
    </View>
  );
}
