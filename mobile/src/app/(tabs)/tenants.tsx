import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

type Tenant = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  invite_accepted: boolean;
  payment_streak: number;
};

export default function TenantsScreen() {
  const { session } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTenants = useCallback(async () => {
    try {
      if (!session?.user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching tenants:', error.message);
        return;
      }

      setTenants(data || []);
    } catch (error) {
      console.error('Unexpected error:', error);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    let ignore = false;
    Promise.resolve().then(() => {
      if (!ignore) {
        fetchTenants();
      }
    });
    return () => {
      ignore = true;
    };
  }, [fetchTenants]);

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
        <Text className="text-2xl font-semibold text-primary tracking-tight">Tenants</Text>
        <TouchableOpacity className="bg-brand-500 px-4 py-2 rounded-lg">
          <Text className="text-white font-medium text-sm">+ Invite</Text>
        </TouchableOpacity>
      </View>

      <View className="px-6 pb-8">
        {tenants.length === 0 ? (
          <View className="bg-white border border-slate-200 rounded-xl p-8 items-center shadow-sm">
            <Text className="text-secondary text-base mb-4 text-center">You have no active tenants.</Text>
            <TouchableOpacity className="bg-brand-500 px-6 py-3 rounded-lg">
              <Text className="text-white font-medium">Invite a Tenant</Text>
            </TouchableOpacity>
          </View>
        ) : (
          tenants.map((tenant) => (
            <TouchableOpacity 
              key={tenant.id} 
              className="bg-white border border-slate-200 rounded-xl mb-4 p-4 shadow-sm flex-row items-center justify-between"
              activeOpacity={0.7}
            >
              <View className="flex-1">
                <Text className="text-lg font-semibold text-primary mb-1">
                  {tenant.first_name} {tenant.last_name}
                </Text>
                <Text className="text-sm text-secondary mb-2">{tenant.email}</Text>
                
                <View className="flex-row items-center">
                  <View className={`px-2 py-1 rounded ${tenant.invite_accepted ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                    <Text className={`text-xs font-medium ${tenant.invite_accepted ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {tenant.invite_accepted ? 'Active' : 'Pending Invite'}
                    </Text>
                  </View>
                  {tenant.payment_streak > 0 && (
                    <Text className="text-xs font-medium text-emerald-600 ml-3">
                      🔥 {tenant.payment_streak}mo streak
                    </Text>
                  )}
                </View>
              </View>
              
              <View className="w-10 h-10 bg-slate-100 rounded-full items-center justify-center">
                <Text className="text-brand-500 font-semibold text-lg">
                  {tenant.first_name[0]}{tenant.last_name[0]}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}
