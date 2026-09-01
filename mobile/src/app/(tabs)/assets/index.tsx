import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';

interface AssetRow {
  id: string;
  category: string;
  make: string | null;
  model: string | null;
  status: string;
  next_service_date: string | null;
  property_id: string;
  properties: { name: string | null; address: string | null } | null;
  units: { unit_number: string | null } | null;
}

function serviceState(nextServiceDate: string | null): { label: string; color: string; bg: string } | null {
  if (!nextServiceDate) return null;
  const days = Math.round((new Date(nextServiceDate).getTime() - Date.now()) / 86400000);
  if (days < 0) return { label: 'Overdue', color: '#991b1b', bg: '#fee2e2' };
  if (days <= 30) return { label: 'Due Soon', color: '#92400e', bg: '#fef3c7' };
  return { label: 'Upcoming', color: '#3730a3', bg: '#e0e7ff' };
}

export default function AssetsScreen() {
  const { propertyId } = useLocalSearchParams<{ propertyId?: string }>();
  const { profileId } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [showRetired, setShowRetired] = useState(false);

  const load = useCallback(async () => {
    if (!profileId) return;
    setLoading(true);
    let query = supabase
      .from('assets')
      .select('id, category, make, model, status, next_service_date, property_id, properties ( name, address ), units ( unit_number )')
      .eq('landlord_id', profileId)
      .order('created_at', { ascending: false });
    if (propertyId) query = query.eq('property_id', propertyId);
    const { data } = await query;
    setAssets((data ?? []) as unknown as AssetRow[]);
    setLoading(false);
  }, [profileId, propertyId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const visible = assets.filter((a) => (showRetired ? a.status === 'retired' : a.status === 'active'));

  return (
    <View className="flex-1 bg-pageBg">
      <View className="pt-16 px-6 pb-6 bg-card border-b border-navy-border flex-row items-center justify-between">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-3 w-9 h-9 rounded-full bg-pageBg border border-navy-border items-center justify-center">
            <Feather name="chevron-left" size={20} color="#1F2F3A" />
          </TouchableOpacity>
          <Text className="text-xl font-sansBold text-navy">Appliances & Assets</Text>
        </View>
        <TouchableOpacity onPress={() => router.push({ pathname: '/assets/new', params: propertyId ? { propertyId } : {} } as any)} className="w-9 h-9 rounded-full bg-navy items-center justify-center">
          <Feather name="plus" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      <View className="px-6 pt-4 flex-row gap-2">
        {(['active', 'retired'] as const).map((s) => (
          <TouchableOpacity
            key={s}
            onPress={() => setShowRetired(s === 'retired')}
            className="px-4 py-2 rounded-full border"
            style={{ borderColor: (showRetired ? 'retired' : 'active') === s ? '#1F2F3A' : '#D8D2C8', backgroundColor: (showRetired ? 'retired' : 'active') === s ? '#1F2F3A' : '#FFFFFF' }}
          >
            <Text className="font-sansBold text-[13px]" style={{ color: (showRetired ? 'retired' : 'active') === s ? '#FFFFFF' : '#333333' }}>
              {s === 'active' ? 'Active' : 'Retired'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center"><ActivityIndicator color="#1F2F3A" /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 24 }}>
          {visible.length === 0 ? (
            <View className="bg-card rounded-2xl p-10 items-center border border-navy-border">
              <Text className="text-navy-muted font-sans text-center">{showRetired ? 'No retired assets.' : 'No appliances or assets tracked yet.'}</Text>
            </View>
          ) : (
            visible.map((a) => {
              const state = serviceState(a.next_service_date);
              const brand = [a.make, a.model].filter(Boolean).join(' ');
              return (
                <TouchableOpacity key={a.id} onPress={() => router.push(`/assets/${a.id}`)} className="bg-card rounded-2xl p-4 mb-3 border border-navy-border flex-row items-center justify-between">
                  <View className="flex-1 pr-3">
                    <Text className="text-navy font-sansBold text-[15px]">{a.category}</Text>
                    {!!brand && <Text className="text-navy-muted font-sans text-[12px] mt-0.5">{brand}</Text>}
                    <Text className="text-navy-muted font-sans text-[12px] mt-0.5">
                      {a.properties?.name ?? a.properties?.address ?? ''}{a.units?.unit_number ? ` · Unit ${a.units.unit_number}` : ''}
                    </Text>
                  </View>
                  {state && (
                    <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: state.bg }}>
                      <Text className="font-sansBold text-[11px]" style={{ color: state.color }}>{state.label}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}
