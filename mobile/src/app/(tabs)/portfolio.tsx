import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { money, monthDay } from '../../lib/format';
import ScreenHeader from '../../components/ScreenHeader';
import Segmented from '../../components/ui/Segmented';
import { Ring, GrowBar, CountUp } from '../../components/ui/Charts';
import TenantsScreen from './tenants';

interface Lease { status: string | null; rent_amount: number | null; end_date: string | null; tenants: { first_name: string | null; last_name: string | null } | null }
interface Unit { id: string; unit_number: string | null; status: string | null; rent_amount: number | null; leases: Lease[] }
interface Property { id: string; name: string | null; address: string | null; city: string | null; units: Unit[] }

// Same fallback the dashboard uses: leases imported from Notion sit at 'pending'.
const liveLease = (u: Unit) => u.leases?.find((l) => l.status === 'active') ?? u.leases?.find((l) => l.status !== 'terminated') ?? null;
const daysUntil = (d: string) => Math.round((new Date(d).getTime() - Date.now()) / 86400000);

export default function PortfolioScreen() {
  const { profileId } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<'buildings' | 'residents'>('buildings');
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<Property[]>([]);

  const load = useCallback(async () => {
    if (!profileId) return;
    const { data } = await supabase
      .from('properties')
      .select('id, name, address, city, units ( id, unit_number, status, rent_amount, leases ( status, rent_amount, end_date, tenants ( first_name, last_name ) ) )')
      .eq('landlord_id', profileId)
      .is('deleted_at', null);
    setProperties((data ?? []) as unknown as Property[]);
    setLoading(false);
  }, [profileId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const units = properties.flatMap((p) => p.units ?? []);
  const occupied = units.filter((u) => u.status === 'occupied').length;
  const rentRoll = units.reduce((s, u) => s + Number(liveLease(u)?.rent_amount ?? 0), 0);
  const residents = units.filter((u) => liveLease(u)?.tenants).length;
  const expiring = properties.flatMap((p) => (p.units ?? []).map((u) => ({ p, u, l: liveLease(u) })))
    .filter((x) => x.l?.end_date && daysUntil(x.l.end_date) >= 0 && daysUntil(x.l.end_date) <= 120)
    .sort((a, b) => a.l!.end_date!.localeCompare(b.l!.end_date!));

  return (
    <View className="flex-1 bg-pageBg">
      <ScreenHeader
        title="Portfolio"
        subtitle={`${properties.length} building${properties.length === 1 ? '' : 's'} · ${units.length} unit${units.length === 1 ? '' : 's'}`}
        right={
          <TouchableOpacity onPress={() => router.push(tab === 'buildings' ? '/add-property' : '/add-tenant')} className="h-11 px-4 bg-navy rounded-full flex-row items-center">
            <Feather name="plus" size={16} color="#FFFFFF" />
            <Text className="text-white font-sansBold text-[13px] ml-1.5">{tab === 'buildings' ? 'Building' : 'Resident'}</Text>
          </TouchableOpacity>
        }
      />
      <View className="px-6 mb-3">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[{ value: 'buildings', label: 'Buildings', count: properties.length }, { value: 'residents', label: 'Residents', count: residents }]}
        />
      </View>

      {tab === 'residents' ? (
        <TenantsScreen embedded />
      ) : loading ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator color="#1F2F3A" /></View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 120 }}>
          {/* Snapshot */}
          <View className="bg-navy rounded-[28px] p-5 mb-5 flex-row items-center">
            <Ring value={units.length ? occupied / units.length : 0} size={112} stroke={11} color="#E8B4BC" track="rgba(255,255,255,0.12)">
              <Text className="text-white font-sansBold text-[24px]">{units.length ? Math.round((occupied / units.length) * 100) : 0}%</Text>
              <Text className="text-white/50 font-sans text-[10px] uppercase tracking-widest">Occupied</Text>
            </Ring>
            <View className="flex-1 ml-5 gap-3">
              <View>
                <Text className="text-white/50 font-sans text-[11px] uppercase tracking-widest">Monthly rent roll</Text>
                <CountUp value={rentRoll} prefix="$" className="text-white font-sansBold text-[24px]" />
              </View>
              <View className="flex-row gap-5">
                <View>
                  <Text className="text-white font-sansBold text-[17px]">{occupied}/{units.length}</Text>
                  <Text className="text-white/50 font-sans text-[11px]">units filled</Text>
                </View>
                <View>
                  <Text className="text-white font-sansBold text-[17px]">{units.length - occupied}</Text>
                  <Text className="text-white/50 font-sans text-[11px]">vacant</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Leases ending soon */}
          {expiring.length > 0 && (
            <View className="bg-card rounded-[24px] p-5 mb-5 border border-navy/5 shadow-sm">
              <View className="flex-row items-center mb-3">
                <Feather name="clock" size={15} color="#B45309" />
                <Text className="text-navy font-sansBold text-[15px] ml-2">Leases ending in the next 4 months</Text>
              </View>
              {expiring.slice(0, 4).map(({ p, u, l }) => (
                <View key={u.id} className="flex-row items-center justify-between py-2 border-t border-navy/5">
                  <View className="flex-1 pr-3">
                    <Text className="text-navy font-sansBold text-[14px]" numberOfLines={1}>{`${l?.tenants?.first_name ?? ''} ${l?.tenants?.last_name ?? ''}`.trim() || 'Resident'}</Text>
                    <Text className="text-navy-muted font-sans text-[12px] opacity-70" numberOfLines={1}>{p.name || p.address}{u.unit_number ? ` · Unit ${u.unit_number}` : ''}</Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-navy font-sansBold text-[13px]">{monthDay(l!.end_date)}</Text>
                    <Text className="font-sans text-[11px]" style={{ color: daysUntil(l!.end_date!) <= 60 ? '#B45309' : '#64748B' }}>in {daysUntil(l!.end_date!)} days</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Buildings */}
          {properties.length === 0 ? (
            <View className="bg-card rounded-[24px] p-8 items-center border border-navy/5">
              <Feather name="home" size={32} color="#1F2F3A" style={{ opacity: 0.2 }} />
              <Text className="text-navy-muted font-sans text-center mt-3">No buildings yet. Add your first one.</Text>
            </View>
          ) : (
            properties.map((p, i) => {
              const total = p.units?.length ?? 0;
              const occ = (p.units ?? []).filter((u) => u.status === 'occupied').length;
              const roll = (p.units ?? []).reduce((s, u) => s + Number(liveLease(u)?.rent_amount ?? 0), 0);
              const full = total > 0 && occ === total;
              return (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => router.push(`/property/${p.id}`)}
                  className="bg-card rounded-[24px] p-5 mb-3 border border-navy/5 shadow-sm active:bg-navy/5"
                >
                  <View className="flex-row items-center">
                    <View className="w-12 h-12 rounded-2xl items-center justify-center mr-4" style={{ backgroundColor: full ? 'rgba(10,122,82,0.08)' : 'rgba(139,32,48,0.08)' }}>
                      <Feather name="home" size={20} color={full ? '#0A7A52' : '#8B2030'} />
                    </View>
                    <View className="flex-1 pr-2">
                      <Text className="text-navy font-sansBold text-[16px]" numberOfLines={1}>{p.name || p.address}</Text>
                      <Text className="text-navy-muted font-sans text-[12px] opacity-70" numberOfLines={1}>{p.city || p.address || ''}</Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-navy font-sansBold text-[15px]">${money(roll).replace('.00', '')}</Text>
                      <Text className="text-navy-muted font-sans text-[11px] opacity-60">per month</Text>
                    </View>
                  </View>
                  <View className="mt-4">
                    <GrowBar value={total ? occ / total : 0} color={full ? '#0A7A52' : '#8B2030'} delay={i * 80} />
                    <View className="flex-row justify-between mt-2">
                      <Text className="text-navy-muted font-sans text-[12px]">{occ} of {total} unit{total === 1 ? '' : 's'} filled</Text>
                      {!full && total > 0 && <Text className="text-burgundy font-sansBold text-[12px]">{total - occ} vacant</Text>}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}
