import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useRouter, useFocusEffect } from 'expo-router';
import { money } from '../../lib/format';
import NotificationsModal from '../../components/NotificationsModal';

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
  const [ownerName, setOwnerName] = useState('');
  const [properties, setProperties] = useState<PropertyInfo[]>([]);
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [ltbSummary, setLtbSummary] = useState({ active: 0, needsAttention: 0 });

  // Kept as its own independently-failing effect, not part of the main
  // Promise.all above — the LTB module being unreachable shouldn't take
  // down the whole dashboard, this is a nice-to-have summary, not core data.
  useEffect(() => {
    if (!profileId) return;
    (async () => {
      const { data } = await supabase
        .from('ltb_notices')
        .select('status, termination_date')
        .eq('landlord_id', profileId)
        .not('status', 'in', '(CLOSED,CANCELLED,VOID,RESOLVED,DRAFT,NEEDS_INFORMATION,READY_FOR_REVIEW,READY_TO_SERVE)');
      const rows = data ?? [];
      const needsAttention = rows.filter((n: any) => n.status === 'ELIGIBLE_FOR_APPLICATION').length;
      setLtbSummary({ active: rows.length, needsAttention });
    })();
  }, [profileId]);

  const fetchData = useCallback(async () => {
    if (!profileId) return;
    setLoadError(false);
    try {
      const [
        { count: issueCount, error: issueError },
        { data: propData, error: propError },
        { data: payments, error: paymentsError },
        { data: landlordRow },
      ] = await Promise.all([
        supabase
          .from('maintenance_requests')
          .select('id', { count: 'exact', head: true })
          .eq('landlord_id', profileId)
          .not('status', 'in', '(resolved,closed)'),
        supabase
          .from('properties')
          .select(`
            id, name, address, city,
            units ( id, unit_number, rent_amount, status, leases ( id, status, rent_amount, tenants ( first_name, last_name ) ) )
          `)
          .eq('landlord_id', profileId),
        supabase
          .from('payments')
          .select('amount, paid_at, created_at, status, tenants(first_name, last_name)')
          .eq('landlord_id', profileId)
          .eq('status', 'paid')
          .order('paid_at', { ascending: false }),
        supabase.from('landlords').select('first_name').eq('id', profileId).maybeSingle(),
      ]);

      // A failed fetch must not render as "you have no properties/payments"
      // — that's indistinguishable from actually having none, and there's
      // no way for the owner to tell the dashboard is lying vs. accurate.
      if (issueError || propError || paymentsError) {
        throw issueError || propError || paymentsError;
      }

      setOwnerName(landlordRow?.first_name ?? '');

      // "This month" means paid_at falls in the current calendar month —
      // not all-time revenue (paid_at is when it was actually collected;
      // created_at is just when the row was inserted, which for manually
      // logged payments can be later than the real payment date).
      // Uses UTC accessors on both sides: paid_at is stored as a UTC
      // midnight timestamp (date-only values have no real time-of-day), so
      // comparing it against local-timezone month/year rolls it back a day
      // west of UTC — e.g. Aug 1 00:00 UTC reads as July 31 in US timezones.
      const now = new Date();
      const revenue = (payments ?? [])
        .filter((p) => {
          if (!p.paid_at) return false;
          const d = new Date(p.paid_at);
          return d.getUTCMonth() === now.getUTCMonth() && d.getUTCFullYear() === now.getUTCFullYear();
        })
        .reduce((sum, p) => sum + Number(p.amount), 0);
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
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  // useFocusEffect, not a plain mount-only effect — Expo Router's Tabs keep
  // screens mounted in the background, so recording a payment on the Money
  // tab and returning here wouldn't otherwise pick up the new total.
  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  if (loading) return <View className="flex-1 bg-pageBg justify-center items-center"><ActivityIndicator color="#1F2F3A" /></View>;

  if (loadError) {
    return (
      <View className="flex-1 bg-pageBg justify-center items-center px-8">
        <Feather name="wifi-off" size={28} color="#8B2030" />
        <Text className="text-navy font-sansBold text-lg mt-4 mb-1 text-center">Couldn&apos;t load your dashboard</Text>
        <Text className="text-navy-muted font-sans text-center mb-6">Check your connection and try again.</Text>
        <TouchableOpacity onPress={() => { setLoading(true); fetchData(); }} className="bg-navy px-6 py-4 rounded-2xl">
          <Text className="text-white font-sansBold">Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const totalUnits = properties.reduce((s, p) => s + p.units.length, 0);
  const occupiedUnits = properties.reduce((s, p) => s + p.units.filter((u) => u.status === 'occupied').length, 0);

  return (
    <>
    <ScrollView className="flex-1 bg-pageBg" bounces={false}>
      {/* Header */}
      <View className="bg-navy pt-20 px-6 pb-14 rounded-b-[40px] shadow-lg">
        {!!ownerName && (
          <Text className="text-white font-sansBold text-[22px] mb-6">Hello {ownerName}!</Text>
        )}
        <View className="flex-row justify-between items-center mb-10">
          <View>
            <Text className="text-white/60 font-sans text-[14px] uppercase tracking-widest mb-1">Collected This Month</Text>
            <Text className="text-white font-sansBold text-[44px] tracking-tighter">${money(metrics.revenue)}</Text>
            <Text className="text-white/50 font-sans text-[13px] mt-1">${money(metrics.expectedRent)}/mo expected across all leases</Text>
          </View>
          <View className="flex-row items-center gap-3">
            <TouchableOpacity onPress={() => setShowNotifications(true)} className="w-12 h-12 bg-white/10 rounded-full items-center justify-center border border-white/20">
              <Feather name="bell" size={20} color="#FFFFFF" />
              {metrics.openIssues > 0 && <View className="absolute top-0 right-0 w-3 h-3 bg-burgundy rounded-full border-2 border-[#1F2F3A]" />}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/(tabs)/profile')} className="w-12 h-12 bg-white/10 rounded-full items-center justify-center border border-white/20">
              <Feather name="user" size={20} color="#FFFFFF" />
            </TouchableOpacity>
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
          <TouchableOpacity onPress={() => router.push('/maintenance')} className="bg-burgundy flex-1 rounded-3xl p-4 border border-white/10">
            <View className="flex-row items-center mb-2">
              <MaterialIcons name="build" size={16} color="#FFFFFF" style={{ opacity: 0.8 }} />
              <Text className="text-white/80 font-sans ml-2 text-[13px]">Requests</Text>
            </View>
            <Text className="text-white font-sansBold text-[22px]">{metrics.openIssues}</Text>
          </TouchableOpacity>
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
                onPress={() => router.push(`/property/${property.id}`)}
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
                                ? `${lease.tenants?.first_name ?? ''} ${lease.tenants?.last_name ?? ''}`.trim() || 'Resident on lease'
                                : 'Vacant'}
                            </Text>
                          </View>
                          <Text className="text-navy font-sansBold text-[14px]">
                            ${money(lease?.rent_amount ?? unit.rent_amount)}/mo
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

        {ltbSummary.active > 0 && (
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/ltb/index' as any)}
            className="bg-card rounded-3xl p-5 mb-12 shadow-sm border border-navy/5 active:bg-navy/5 flex-row items-center"
          >
            <View className="w-12 h-12 bg-navy/5 rounded-full items-center justify-center mr-4">
              <Feather name="file-text" size={20} color="#1F2F3A" />
            </View>
            <View className="flex-1">
              <Text className="text-navy font-sansBold text-[16px]">Legal & Compliance</Text>
              <Text className="text-navy-muted font-sans text-[13px] mt-0.5">
                {ltbSummary.active} active notice{ltbSummary.active === 1 ? '' : 's'}
                {ltbSummary.needsAttention > 0 ? ` · ${ltbSummary.needsAttention} eligible for next step` : ''}
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color="#1F2F3A" style={{ opacity: 0.3 }} />
          </TouchableOpacity>
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
                <Text className="text-emerald-700 font-sansBold text-[16px]">+${money(payment.amount)}</Text>
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
    {profileId && <NotificationsModal visible={showNotifications} onClose={() => setShowNotifications(false)} profileId={profileId} />}
    </>
  );
}
