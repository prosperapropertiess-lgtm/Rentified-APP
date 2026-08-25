import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';

interface LeaseInfo {
  id: string;
  status: string | null;
  rent_amount: number | null;
  tenants: { first_name: string | null; last_name: string | null } | null;
}
interface UnitInfo {
  id: string;
  unit_number: string | null;
  rent_amount: number | null;
  status: string | null;
  leases: LeaseInfo[];
}
interface PropertyInfo {
  id: string;
  name: string | null;
  address: string | null;
  city: string | null;
  units: UnitInfo[];
}

// Prefer a lease explicitly marked 'active', but every lease in this
// database is currently stuck at 'pending' from the Notion ETL (verified:
// 9/9 leases, all units they belong to are separately marked 'occupied') —
// fall back to any lease on the unit so occupied units aren't shown as
// vacant. Matches the fallback already used for tenants in tenants.tsx.
function activeLease(unit: UnitInfo) {
  return unit.leases?.find((l) => l.status === 'active') ?? unit.leases?.[0] ?? null;
}

export default function OwnerDashboard() {
  const { profileId } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({ revenue: 0, openIssues: 0, expectedRent: 0 });
  const [properties, setProperties] = useState<PropertyInfo[]>([]);
  const [recentPayments, setRecentPayments] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    if (!profileId) return;
    try {
      const [{ count: issueCount }, { data: propData }, { data: payments }] = await Promise.all([
        supabase
          .from('maintenance_requests')
          .select('id', { count: 'exact', head: true })
          .eq('landlord_id', profileId)
          .neq('status', 'resolved'),
        supabase
          .from('properties')
          .select(`
            id, name, address, city,
            units ( id, unit_number, rent_amount, status, leases ( id, status, rent_amount, tenants ( first_name, last_name ) ) )
          `)
          .eq('landlord_id', profileId),
        supabase
          .from('payments')
          .select('amount, created_at, status, tenants(first_name, last_name)')
          .eq('landlord_id', profileId)
          .eq('status', 'paid')
          .order('created_at', { ascending: false }),
      ]);

      const revenue = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
      // Supabase's default (ungenerated) client types every nested embed as
      // an array regardless of FK cardinality; units->leases->tenants and
      // units->properties are verified to-one relationships.
      const props = (propData || []) as unknown as PropertyInfo[];
      const expectedRent = props.reduce(
        (sum, p) => sum + p.units.reduce((uSum, u) => uSum + (activeLease(u)?.rent_amount ? Number(activeLease(u)!.rent_amount) : 0), 0),
        0
      );

      setMetrics({ revenue, openIssues: issueCount || 0, expectedRent });
      setProperties(props);
      setRecentPayments(payments?.slice(0, 3) || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => { setTimeout(() => fetchData(), 0); }, [fetchData]);

  if (loading) return <View className="flex-1 bg-pageBg justify-center items-center"><ActivityIndicator color="#1F2F3A" /></View>;

  const totalUnits = properties.reduce((s, p) => s + p.units.length, 0);
  const occupiedUnits = properties.reduce((s, p) => s + p.units.filter((u) => u.status === 'occupied').length, 0);

  return (
    <ScrollView className="flex-1 bg-pageBg" bounces={false}>
      {/* Header */}
      <View className="bg-navy pt-20 px-6 pb-14 rounded-b-[40px] shadow-lg">
        <View className="flex-row justify-between items-center mb-10">
          <View>
            <Text className="text-white/60 font-sans text-[14px] uppercase tracking-widest mb-1">Collected This Month</Text>
            <Text className="text-white font-sansBold text-[44px] tracking-tighter">${metrics.revenue.toLocaleString()}</Text>
            <Text className="text-white/50 font-sans text-[13px] mt-1">${metrics.expectedRent.toLocaleString()}/mo expected across all leases</Text>
          </View>
          <View className="w-12 h-12 bg-white/10 rounded-full items-center justify-center border border-white/20">
            <Feather name="bell" size={20} color="#FFFFFF" />
            {metrics.openIssues > 0 && <View className="absolute top-0 right-0 w-3 h-3 bg-burgundy rounded-full border-2 border-[#1F2F3A]" />}
          </View>
        </View>

        <View className="flex-row gap-4">
          <View className="bg-white/10 flex-1 rounded-3xl p-4 border border-white/10">
            <View className="flex-row items-center mb-2">
              <MaterialIcons name="home-work" size={16} color="#FFFFFF" style={{ opacity: 0.6 }} />
              <Text className="text-white/60 font-sans ml-2 text-[13px]">Occupied</Text>
            </View>
            <Text className="text-white font-sansBold text-[22px]">{occupiedUnits}/{totalUnits}</Text>
          </View>
          <View className="bg-burgundy flex-1 rounded-3xl p-4 border border-white/10">
            <View className="flex-row items-center mb-2">
              <MaterialIcons name="build" size={16} color="#FFFFFF" style={{ opacity: 0.8 }} />
              <Text className="text-white/80 font-sans ml-2 text-[13px]">Requests</Text>
            </View>
            <Text className="text-white font-sansBold text-[22px]">{metrics.openIssues}</Text>
          </View>
        </View>
      </View>

      <View className="p-6">
        {/* Portfolio — properties, units, and who's in them, all on this screen */}
        <Text className="text-navy font-sansBold text-[20px] mb-5 mt-4">Your Portfolio</Text>

        {properties.length === 0 ? (
          <View className="bg-card rounded-3xl p-8 items-center justify-center border border-navy/5 mb-12">
            <Text className="text-navy-muted font-sans text-center">No properties yet. Add your first building to get started.</Text>
          </View>
        ) : (
          <View className="mb-12">
            {properties.map((property) => (
              <TouchableOpacity
                key={property.id}
                onPress={() => router.push('/(tabs)/properties')}
                className="bg-card rounded-[24px] p-5 mb-5 shadow-sm border border-navy/5 active:bg-navy/5"
              >
                <View className="flex-row items-center justify-between mb-4">
                  <View className="flex-1 pr-3">
                    <Text className="text-navy font-sansBold text-[17px]">{property.name || property.address}</Text>
                    <Text className="text-navy-muted font-sans text-[13px] mt-0.5 opacity-70">{property.city || 'Location unknown'}</Text>
                  </View>
                  <View className="bg-navy/5 px-3 py-1.5 rounded-full">
                    <Text className="text-navy font-sansBold text-[12px] opacity-70">
                      {property.units.filter((u) => u.status === 'occupied').length}/{property.units.length} Occupied
                    </Text>
                  </View>
                </View>

                {property.units.length > 0 && (
                  <View className="gap-2.5">
                    {property.units.map((unit) => {
                      const lease = activeLease(unit);
                      return (
                        <View key={unit.id} className="flex-row items-center justify-between bg-pageBg rounded-2xl px-4 py-3">
                          <View className="flex-1 pr-2">
                            <Text className="text-navy font-sansBold text-[14px]">
                              {unit.unit_number ? `Unit ${unit.unit_number}` : 'Unit'}
                            </Text>
                            <Text className="text-navy-muted font-sans text-[13px] mt-0.5">
                              {lease
                                ? `${lease.tenants?.first_name ?? ''} ${lease.tenants?.last_name ?? ''}`.trim() || 'Tenant on lease'
                                : 'Vacant'}
                            </Text>
                          </View>
                          <Text className="text-navy font-sansBold text-[14px]">
                            ${Number(lease?.rent_amount ?? unit.rent_amount ?? 0).toLocaleString()}/mo
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Recent Activity */}
        <Text className="text-navy font-sansBold text-[20px] mb-5">Recent Activity</Text>

        {recentPayments.length === 0 ? (
          <View className="bg-card rounded-3xl p-8 items-center justify-center border border-navy/5 mb-12">
            <Text className="text-navy-muted font-sans">No payments recorded yet.</Text>
          </View>
        ) : (
          <View className="bg-card rounded-3xl p-2 border border-navy/5 shadow-sm mb-12">
            {recentPayments.map((payment, i) => (
              <View key={i} className={`flex-row items-center p-4 ${i !== recentPayments.length - 1 ? 'border-b border-navy/5' : ''}`}>
                <View className="w-12 h-12 bg-emerald-500/10 rounded-full items-center justify-center mr-4">
                  <Feather name="arrow-down-left" size={20} color="#0A7A52" />
                </View>
                <View className="flex-1">
                  <Text className="text-navy font-sansBold text-[16px]">{payment.tenants?.first_name} {payment.tenants?.last_name}</Text>
                  <Text className="text-navy-muted font-sans text-[13px] mt-0.5">Rent Payment</Text>
                </View>
                <Text className="text-emerald-700 font-sansBold text-[16px]">+${Number(payment.amount).toLocaleString()}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Documents and Messages are the destinations not already on the
            bottom tab bar for owners (Buildings/Tenants/Financials cover
            the rest), so they're what's worth surfacing here instead of a
            full quick-actions grid that just duplicates the tab bar. */}
        <View className="gap-4 mb-10">
          <TouchableOpacity
            onPress={() => router.push('/messages')}
            className="bg-card rounded-3xl p-5 flex-row items-center shadow-sm border border-navy/5 active:bg-navy/5"
          >
            <View className="w-12 h-12 bg-navy/5 rounded-full items-center justify-center mr-4">
              <Feather name="message-circle" size={20} color="#1F2F3A" />
            </View>
            <Text className="text-navy font-sansBold text-[16px] flex-1">Messages</Text>
            <Feather name="chevron-right" size={20} color="#1F2F3A" style={{ opacity: 0.3 }} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/(tabs)/documents')}
            className="bg-card rounded-3xl p-5 flex-row items-center shadow-sm border border-navy/5 active:bg-navy/5"
          >
            <View className="w-12 h-12 bg-navy/5 rounded-full items-center justify-center mr-4">
              <Feather name="file-text" size={20} color="#1F2F3A" />
            </View>
            <Text className="text-navy font-sansBold text-[16px] flex-1">Documents</Text>
            <Feather name="chevron-right" size={20} color="#1F2F3A" style={{ opacity: 0.3 }} />
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}
