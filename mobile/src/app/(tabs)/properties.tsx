import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export default function PropertiesList() {
  const { user, profileId } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<any[]>([]);

  useEffect(() => {
    async function fetchProperties() {
      if (!profileId) return;
      try {
        const { data } = await supabase
          .from('properties')
          .select(`
            id, name, address, city,
            units ( id, status )
          `)
          .eq('landlord_id', profileId);
          
        setProperties(data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchProperties();
  }, [user]);

  if (loading) return <View className="flex-1 bg-pageBg justify-center items-center"><ActivityIndicator color="#1F2F3A" /></View>;

  return (
    <ScrollView className="flex-1 bg-pageBg p-6">
      <View className="mb-8 mt-16 flex-row justify-between items-center">
        <View>
          <Text className="text-navy font-sansBold text-[40px] font-bold tracking-tight">Portfolio</Text>
          <Text className="text-navy-muted font-sans text-[15px] mt-1 opacity-70">{properties.length} Active Buildings</Text>
        </View>
        <TouchableOpacity className="w-12 h-12 bg-navy rounded-full items-center justify-center shadow-md">
          <Feather name="plus" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View className="pb-10">
        {properties.length === 0 ? (
          <View className="bg-card rounded-[28px] p-8 items-center justify-center shadow-sm border border-navy/5">
            <Feather name="home" size={40} color="#1F2F3A" style={{ opacity: 0.2 }} className="mb-4" />
            <Text className="text-navy-muted font-sans text-center">No properties found. Add your first building!</Text>
          </View>
        ) : (
          properties.map(prop => {
            const totalUnits = prop.units?.length || 0;
            const occupiedUnits = prop.units?.filter((u: any) => u.status === 'occupied').length || 0;
            const isFull = totalUnits > 0 && occupiedUnits === totalUnits;

            return (
              <TouchableOpacity
                key={prop.id}
                onPress={() => router.push(`/property/${prop.id}`)}
                className="bg-card rounded-[28px] p-5 mb-4 shadow-sm flex-row items-center active:scale-[0.98] transition-transform"
              >
                <View className="w-16 h-16 bg-navy/5 rounded-[20px] items-center justify-center mr-5">
                  <Feather name="home" size={24} color="#1F2F3A" style={{ opacity: 0.8 }} />
                </View>
                <View className="flex-1">
                  <Text className="text-navy font-sansBold text-[18px]">{prop.name || prop.address}</Text>
                  <Text className="text-navy-muted font-sans text-[14px] mt-1 opacity-70">{prop.city || 'Location unknown'}</Text>
                  <View className="flex-row items-center mt-3 gap-2">
                    <View className="bg-pageBg px-3 py-1.5 rounded-full">
                      <Text className="text-navy font-sansBold text-[12px] opacity-70">{totalUnits} Units</Text>
                    </View>
                    {totalUnits > 0 && (
                      <View className={`${isFull ? 'bg-navy/5' : 'bg-burgundy-bg'} px-3 py-1.5 rounded-full`}>
                        <Text className={`${isFull ? 'text-navy' : 'text-burgundy'} font-sansBold text-[12px]`}>
                          {occupiedUnits}/{totalUnits} Occupied
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}
