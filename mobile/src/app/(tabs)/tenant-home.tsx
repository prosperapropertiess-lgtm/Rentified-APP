import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

export default function TenantHomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  
  // Data states
  const [tenant, setTenant] = useState<any>(null);
  const [property, setProperty] = useState<any>(null);
  const [nextPayment, setNextPayment] = useState<any>(null);

  useEffect(() => {
    async function fetchData() {
      if (!user) return;
      
      try {
        // 1. Fetch Tenant (using user_id)
        const { data: tenantData, error: tenantErr } = await supabase
          .from('tenants')
          .select('*')
          .eq('user_id', user.id)
          .single();
          
        if (tenantErr || !tenantData) {
          console.log("No tenant profile found for this user");
          setLoading(false);
          return;
        }
        setTenant(tenantData);

        // 2. Fetch Property
        if (tenantData.property_id) {
          const { data: propData } = await supabase
            .from('properties')
            .select('address, city')
            .eq('id', tenantData.property_id)
            .single();
          setProperty(propData);
        }

        // 3. Fetch Next Payment (Unpaid rent)
        const { data: payData } = await supabase
          .from('payments')
          .select('amount, due_date')
          .eq('tenant_id', tenantData.id)
          .neq('status', 'paid')
          .order('due_date', { ascending: true })
          .limit(1)
          .single();
          
        if (payData) {
          setNextPayment(payData);
        }

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [user]);

  if (loading) {
    return (
      <View className="flex-1 bg-pageBg justify-center items-center">
        <ActivityIndicator size="large" color="#1F2F3A" />
      </View>
    );
  }

  // Fallback values if data is missing
  const propertyName = property?.address || 'Property Not Assigned';
  const amountDue = nextPayment ? `$${nextPayment.amount}` : '$0.00';
  const dueDateStr = nextPayment ? new Date(nextPayment.due_date).toLocaleDateString() : 'All caught up';

  return (
    <View className="flex-1 bg-pageBg">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24, paddingBottom: 100 }}>
        
        {/* Header section */}
        <View className="mb-8 mt-4">
          <Text className="text-navy-muted font-sans text-lg mb-1">Welcome back,</Text>
          <Text className="text-[40px] text-navy font-sansBold leading-tight tracking-tight">
            {tenant?.full_name?.split(' ')[0] || 'Tenant'}
          </Text>
        </View>

        {/* Home Info Card */}
        <View className="bg-card p-6 rounded-[24px] mb-8 border border-navy-border shadow-sm flex-row items-center justify-between">
          <View>
            <Text className="text-navy font-sansBold text-[19px] mb-1">{propertyName}</Text>
            <Text className="text-navy-muted font-sans text-[15px]">{property?.city || ''}</Text>
          </View>
          <View className="w-12 h-12 bg-pageBg rounded-full items-center justify-center border border-navy-border">
            <Feather name="home" size={20} color="#1F2F3A" />
          </View>
        </View>

        {/* Action Grid */}
        <View className="flex-row justify-between mb-8 gap-4">
          
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/tenant-payments')}
            className="flex-1 bg-navy p-5 rounded-[24px] shadow-sm justify-between min-h-[160px]"
          >
            <View className="w-10 h-10 bg-white/10 rounded-full items-center justify-center mb-4">
              <Feather name="credit-card" size={20} color="#FFFFFF" />
            </View>
            <View>
              <Text className="text-white/70 font-sans text-[14px] mb-1">Next Payment</Text>
              <Text className="text-white font-sansBold text-[24px] mb-1">{amountDue}</Text>
              <Text className="text-white/60 font-sans text-[12px]">{dueDateStr}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/(tabs)/tenant-maintenance')}
            className="flex-1 bg-card p-5 rounded-[24px] border border-navy-border shadow-sm justify-between min-h-[160px]"
          >
            <View className="w-10 h-10 bg-pageBg rounded-full items-center justify-center mb-4 border border-navy-border">
              <Feather name="tool" size={20} color="#1F2F3A" />
            </View>
            <View>
              <Text className="text-navy-muted font-sans text-[14px] mb-1">Maintenance</Text>
              <Text className="text-navy font-sansBold text-[20px] leading-tight">Request Repair</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Quick Links */}
        <Text className="text-[24px] text-navy font-sansBold mb-4">Quick Links</Text>

        <View className="bg-card rounded-[24px] border border-navy-border shadow-sm overflow-hidden mb-4">
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/documents')}
            className="flex-row items-center p-5 border-b border-navy-border/50"
          >
            <View className="w-8 h-8 bg-pageBg rounded-full items-center justify-center mr-4 border border-navy-border/50">
              <Feather name="file-text" size={16} color="#1F2F3A" />
            </View>
            <Text className="text-navy font-sansBold text-[16px] flex-1">View Lease Agreement</Text>
            <Feather name="chevron-right" size={20} color="#8B95A1" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/messages')}
            className="flex-row items-center p-5"
          >
            <View className="w-8 h-8 bg-pageBg rounded-full items-center justify-center mr-4 border border-navy-border/50">
              <Feather name="message-circle" size={16} color="#1F2F3A" />
            </View>
            <Text className="text-navy font-sansBold text-[16px] flex-1">Message Landlord</Text>
            <Feather name="chevron-right" size={20} color="#8B95A1" />
          </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  );
}
