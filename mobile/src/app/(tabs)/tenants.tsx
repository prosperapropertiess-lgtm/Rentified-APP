import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, FlatList, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { money } from '../../lib/format';

interface TenantRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  payment_streak: number | null;
  leases: {
    id: string;
    rent_amount: number | null;
    status: string | null;
    units: { id: string; unit_number: string | null; properties: { name: string | null; address: string | null } | null } | null;
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
          id, first_name, last_name, email, payment_streak,
          leases ( id, rent_amount, status, units ( id, unit_number, properties ( name, address ) ) )
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

  useFocusEffect(useCallback(() => { fetchTenants(); }, [fetchTenants]));

  const [endingLeaseId, setEndingLeaseId] = useState<string | null>(null);

  // Ends the tenancy without deleting the tenant record — payment history,
  // maintenance requests, and LTB notices all reference this tenant/lease,
  // so a hard delete would either orphan that history or fail on a foreign
  // key. Terminating the lease and freeing the unit is the real operation:
  // the resident stops showing as active anywhere in the app (tenants list,
  // property "By Property" cards, rent collection), and the unit becomes
  // available to re-let, while every past record stays intact.
  function confirmEndLease(tenant: TenantRow, lease: NonNullable<ReturnType<typeof activeLease>>) {
    const name = `${tenant.first_name ?? ''} ${tenant.last_name ?? ''}`.trim() || 'This resident';
    Alert.alert(
      'End this lease?',
      `${name} will no longer show as an active resident, and ${lease.units?.unit_number ? `Unit ${lease.units.unit_number}` : 'their unit'} will be marked vacant. Past payments and history are kept.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Lease',
          style: 'destructive',
          onPress: async () => {
            setEndingLeaseId(lease.id);
            const { error: leaseError } = await supabase.from('leases').update({ status: 'terminated' }).eq('id', lease.id);
            if (leaseError) {
              setEndingLeaseId(null);
              Alert.alert('Could not end lease', leaseError.message);
              return;
            }
            if (lease.units?.id) {
              await supabase.from('units').update({ status: 'vacant' }).eq('id', lease.units.id);
            }

            // Best-effort dual notification — never blocks the lease
            // ending itself, which has already succeeded by this point.
            const unitLabel = lease.units?.properties?.name || lease.units?.properties?.address
              ? `${lease.units?.properties?.name ?? lease.units?.properties?.address}${lease.units?.unit_number ? ` · Unit ${lease.units.unit_number}` : ''}`
              : `Unit ${lease.units?.unit_number ?? ''}`;
            if (profileId) {
              supabase
                .from('landlords')
                .select('email, first_name')
                .eq('id', profileId)
                .single()
                .then(({ data: landlordProfile }) => {
                  if (!landlordProfile?.email) return;
                  supabase.functions
                    .invoke('notify', {
                      body: {
                        type: 'lease_ended',
                        landlordEmail: landlordProfile.email,
                        landlordName: landlordProfile.first_name ?? 'there',
                        tenantEmail: tenant.email,
                        tenantName: name,
                        unitLabel,
                      },
                    })
                    .catch((e) => console.error('lease-ended notification email failed', e));
                });
            }

            setEndingLeaseId(null);
            fetchTenants();
          },
        },
      ]
    );
  }

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
                <View className={`px-3 py-1.5 rounded-full mb-2 ${lease?.status === 'active' ? 'bg-emerald-500/10' : 'bg-navy/5'}`}>
                  <Text className={`text-xs font-sansBold ${lease?.status === 'active' ? 'text-emerald-700' : 'text-navy-muted'}`}>
                    {lease?.status ? lease.status.charAt(0).toUpperCase() + lease.status.slice(1) : 'No lease'}
                  </Text>
                </View>
                {lease?.status === 'active' && (
                  <TouchableOpacity
                    onPress={() => confirmEndLease(item, lease)}
                    disabled={endingLeaseId === lease.id}
                    hitSlop={8}
                  >
                    <Text className="text-[11px] font-sansBold text-navy-muted underline">
                      {endingLeaseId === lease.id ? 'Ending…' : 'End Lease'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        }}
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </View>
  );
}
