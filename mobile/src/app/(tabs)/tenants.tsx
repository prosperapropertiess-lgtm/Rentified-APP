import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { money } from '../../lib/format';

interface TenantRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  payment_streak: number | null;
  leases: {
    id: string;
    rent_amount: number | null;
    status: string | null;
    units: { unit_number: string | null; properties: { name: string | null; address: string | null } | null } | null;
  }[];
}

function activeLease(t: TenantRow) {
  return t.leases?.find((l) => l.status === 'active') ?? t.leases?.[0] ?? null;
}

export default function TenantsScreen() {
  const { profileId } = useAuth();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loadError, setLoadError] = useState(false);

  const fetchTenants = useCallback(async () => {
    if (!profileId) return;
    setLoadError(false);
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select(`
          id, first_name, last_name, payment_streak,
          leases ( id, rent_amount, status, units ( unit_number, properties ( name, address ) ) )
        `)
        .eq('landlord_id', profileId);

      if (error) throw error;

      // Supabase's default (ungenerated) client types every nested embed as
      // an array regardless of FK cardinality; leases->tenants and
      // leases->units->properties are verified to-one relationships.
      setTenants((data || []) as unknown as TenantRow[]);
    } catch (err) {
      console.error(err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => { setTimeout(() => fetchTenants(), 0); }, [fetchTenants]);

  const filteredTenants = tenants.filter((t) => {
    const name = `${t.first_name ?? ''} ${t.last_name ?? ''}`.toLowerCase();
    const lease = activeLease(t);
    const unit = lease?.units?.unit_number?.toLowerCase() ?? '';
    const property = lease?.units?.properties?.name?.toLowerCase() ?? lease?.units?.properties?.address?.toLowerCase() ?? '';
    const q = search.toLowerCase();
    return name.includes(q) || unit.includes(q) || property.includes(q);
  });

  if (loading) return <View className="flex-1 bg-pageBg justify-center items-center"><ActivityIndicator color="#1F2F3A" /></View>;

  return (
    <View className="flex-1 bg-pageBg px-6 pt-16">
      <View className="flex-row items-center justify-between mb-8">
        <Text className="text-3xl font-sansBold text-navy">Residents</Text>
        <TouchableOpacity
          onPress={() => router.push('/add-tenant')}
          className="bg-navy px-4 py-3 rounded-2xl flex-row items-center"
        >
          <Feather name="user-plus" size={16} color="#FFFFFF" />
          <Text className="text-white font-sansBold text-[13px] ml-1.5">Add Resident</Text>
        </TouchableOpacity>
      </View>

      <View className="flex-row items-center bg-card rounded-2xl px-5 py-4 mb-8 border border-navy-border shadow-sm">
        <Feather name="search" size={20} color="#94a3b8" />
        <TextInput
          className="flex-1 ml-3 font-sans text-navy"
          placeholder="Search residents, units, or properties..."
          placeholderTextColor="#94a3b8"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        data={filteredTenants}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View className="bg-card rounded-2xl p-10 items-center border border-navy-border">
            {loadError ? (
              <>
                <Feather name="wifi-off" size={22} color="#8B2030" style={{ marginBottom: 8 }} />
                <Text className="text-navy font-sansBold text-center mb-3">Couldn&apos;t load residents</Text>
                <TouchableOpacity onPress={() => { setLoading(true); fetchTenants(); }} className="bg-navy px-5 py-3 rounded-xl">
                  <Text className="text-white font-sansBold text-[13px]">Try Again</Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text className="text-navy-muted font-sans text-center">
                {tenants.length === 0 ? 'No residents yet.' : 'No residents match your search.'}
              </Text>
            )}
          </View>
        }
        renderItem={({ item }) => {
          const lease = activeLease(item);
          const name = `${item.first_name ?? ''} ${item.last_name ?? ''}`.trim() || 'Unnamed resident';
          const unitLabel = lease?.units?.unit_number
            ? `${lease.units.properties?.name ?? lease.units.properties?.address ?? ''} · Unit ${lease.units.unit_number}`
            : lease?.units?.properties?.name ?? lease?.units?.properties?.address ?? 'No unit assigned';

          return (
            <View className="bg-card rounded-2xl p-5 mb-5 border border-navy-border shadow-sm flex-row justify-between items-center">
              <View className="flex-1 pr-3">
                <Text className="text-lg font-sansBold text-navy">{name}</Text>
                <View className="flex-row items-center mt-2">
                  <Feather name="home" size={14} color="#64748b" />
                  <Text className="text-sm font-sans text-navy-muted ml-1.5">{unitLabel}</Text>
                </View>
                {typeof item.payment_streak === 'number' && item.payment_streak > 0 && (
                  <View className="flex-row items-center mt-2">
                    <Feather name="trending-up" size={14} color="#059669" />
                    <Text className="text-sm font-sans text-navy-muted ml-1.5">{item.payment_streak}-month payment streak</Text>
                  </View>
                )}
              </View>
              <View className="items-end">
                <Text className="text-base font-sansBold text-navy mb-2">
                  {lease?.rent_amount ? `$${money(lease.rent_amount)}` : '—'}
                </Text>
                <View className={`px-3 py-1.5 rounded-full ${lease?.status === 'active' ? 'bg-emerald-500/10' : 'bg-navy/5'}`}>
                  <Text className={`text-xs font-sansBold ${lease?.status === 'active' ? 'text-emerald-700' : 'text-navy-muted'}`}>
                    {lease?.status ? lease.status.charAt(0).toUpperCase() + lease.status.slice(1) : 'No lease'}
                  </Text>
                </View>
              </View>
            </View>
          );
        }}
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </View>
  );
}
