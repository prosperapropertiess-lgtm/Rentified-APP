import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { money } from '../../../lib/format';

interface AssetDetail {
  id: string;
  landlord_id: string;
  category: string;
  make: string | null;
  model: string | null;
  serial_number: string | null;
  installed_date: string | null;
  purchase_date: string | null;
  purchase_cost: number | null;
  vendor: string | null;
  warranty_expires: string | null;
  service_interval_months: number | null;
  last_service_date: string | null;
  next_service_date: string | null;
  condition: string | null;
  notes: string | null;
  status: string;
  retired_at: string | null;
  retired_reason: string | null;
  property_id: string;
  properties: { name: string | null; address: string | null } | null;
  units: { unit_number: string | null } | null;
}

interface ServiceEvent { id: string; service_date: string; description: string; vendor: string | null; cost: number | null; notes: string | null }

export default function AssetDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [events, setEvents] = useState<ServiceEvent[]>([]);
  const [showRecordForm, setShowRecordForm] = useState(false);
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [vendor, setVendor] = useState('');
  const [cost, setCost] = useState('');
  const [savingService, setSavingService] = useState(false);
  const savingServiceRef = React.useRef(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { data: a } = await supabase
      .from('assets')
      .select('id, landlord_id, category, make, model, serial_number, installed_date, purchase_date, purchase_cost, vendor, warranty_expires, service_interval_months, last_service_date, next_service_date, condition, notes, status, retired_at, retired_reason, property_id, properties ( name, address ), units ( unit_number )')
      .eq('id', id)
      .maybeSingle();
    setAsset(a as unknown as AssetDetail);

    const { data: svc } = await supabase
      .from('asset_service_events')
      .select('id, service_date, description, vendor, cost, notes')
      .eq('asset_id', id)
      .order('service_date', { ascending: false });
    setEvents((svc ?? []) as ServiceEvent[]);
    setLoading(false);
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function recordService() {
    if (!asset || !description.trim() || savingServiceRef.current) return;
    savingServiceRef.current = true;
    setSavingService(true);

    const { error } = await supabase.from('asset_service_events').insert({
      asset_id: asset.id,
      landlord_id: asset.landlord_id,
      service_date: serviceDate,
      description: description.trim(),
      vendor: vendor.trim() || null,
      cost: cost ? Number(cost) : null,
    });

    if (!error) {
      await supabase.from('assets').update({ last_service_date: serviceDate }).eq('id', asset.id);
    }

    setSavingService(false);
    savingServiceRef.current = false;
    if (error) {
      Alert.alert('Could not record service', error.message);
      return;
    }
    setShowRecordForm(false);
    setDescription('');
    setVendor('');
    setCost('');
    load();
  }

  async function retireAsset() {
    if (!asset) return;
    Alert.alert('Retire this asset?', 'It will be marked retired and kept in history, not deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Retire', style: 'destructive', onPress: async () => {
          const { error } = await supabase.from('assets').update({ status: 'retired', retired_at: new Date().toISOString().split('T')[0] }).eq('id', asset.id);
          if (error) { Alert.alert('Could not retire asset', error.message); return; }
          load();
        },
      },
    ]);
  }

  if (loading || !asset) return <View className="flex-1 bg-pageBg justify-center items-center"><ActivityIndicator color="#1F2F3A" /></View>;

  const lifetimeCost = events.reduce((sum, e) => sum + (e.cost ?? 0), 0);
  const brand = [asset.make, asset.model].filter(Boolean).join(' ');

  return (
    <View className="flex-1 bg-pageBg">
      <View className="pt-16 px-6 pb-6 bg-card border-b border-navy-border flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="mr-3 w-9 h-9 rounded-full bg-pageBg border border-navy-border items-center justify-center">
          <Feather name="chevron-left" size={20} color="#1F2F3A" />
        </TouchableOpacity>
        <View>
          <Text className="text-xl font-sansBold text-navy">{asset.category}</Text>
          {!!brand && <Text className="text-navy-muted font-sans text-[12px] mt-0.5">{brand}</Text>}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 60 }}>
        {asset.status === 'retired' && (
          <View className="bg-slate-100 rounded-xl p-3 mb-4">
            <Text className="text-navy-muted font-sansBold text-[12px]">Retired {asset.retired_at ? new Date(asset.retired_at).toLocaleDateString() : ''}</Text>
          </View>
        )}

        <View className="bg-card rounded-2xl p-4 border border-navy-border mb-4">
          <Row label="Location" value={`${asset.properties?.name ?? asset.properties?.address ?? ''}${asset.units?.unit_number ? ` · Unit ${asset.units.unit_number}` : ''}`} />
          {asset.serial_number && <Row label="Serial" value={asset.serial_number} />}
          {asset.vendor && <Row label="Vendor" value={asset.vendor} />}
          {asset.installed_date && <Row label="Installed" value={new Date(asset.installed_date).toLocaleDateString()} />}
          {asset.purchase_cost != null && <Row label="Purchase cost" value={`$${money(asset.purchase_cost)}`} />}
          {asset.warranty_expires && <Row label="Warranty expires" value={new Date(asset.warranty_expires).toLocaleDateString()} />}
          {asset.condition && <Row label="Condition" value={asset.condition} />}
        </View>

        <View className="bg-card rounded-2xl p-4 border border-navy-border mb-4">
          <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Service Schedule</Text>
          <Row label="Last service" value={asset.last_service_date ? new Date(asset.last_service_date).toLocaleDateString() : 'None on record'} />
          <Row label="Next service" value={asset.next_service_date ? new Date(asset.next_service_date).toLocaleDateString() : 'Not set (set an interval)'} />
          <Row label="Interval" value={asset.service_interval_months ? `${asset.service_interval_months} months` : 'Not set'} />
          <Row label="Lifetime service cost" value={`$${money(lifetimeCost)}`} />
        </View>

        {asset.status === 'active' && (
          <TouchableOpacity onPress={() => setShowRecordForm((s) => !s)} className="border border-navy-border py-3 rounded-xl items-center mb-4">
            <Text className="text-navy font-sansBold text-[13px]">{showRecordForm ? 'Cancel' : 'Record Service'}</Text>
          </TouchableOpacity>
        )}

        {showRecordForm && (
          <View className="bg-card rounded-2xl p-4 border border-navy-border mb-4">
            <Text className="text-navy font-sansBold text-[13px] mb-2">Service date</Text>
            <TextInput className="bg-pageBg border border-navy-border rounded-xl p-3.5 font-sans text-navy mb-3" value={serviceDate} onChangeText={setServiceDate} placeholder="YYYY-MM-DD" placeholderTextColor="#94a3b8" />
            <Text className="text-navy font-sansBold text-[13px] mb-2">What was done</Text>
            <TextInput className="bg-pageBg border border-navy-border rounded-xl p-3.5 font-sans text-navy mb-3" value={description} onChangeText={setDescription} placeholder="e.g. Annual furnace maintenance" placeholderTextColor="#94a3b8" />
            <Text className="text-navy font-sansBold text-[13px] mb-2">Vendor</Text>
            <TextInput className="bg-pageBg border border-navy-border rounded-xl p-3.5 font-sans text-navy mb-3" value={vendor} onChangeText={setVendor} placeholder="e.g. ABC HVAC" placeholderTextColor="#94a3b8" />
            <Text className="text-navy font-sansBold text-[13px] mb-2">Cost</Text>
            <TextInput className="bg-pageBg border border-navy-border rounded-xl p-3.5 font-sans text-navy mb-4" value={cost} onChangeText={setCost} placeholder="179" placeholderTextColor="#94a3b8" keyboardType="decimal-pad" />
            <TouchableOpacity onPress={recordService} disabled={savingService || !description.trim()} className="bg-navy py-3.5 rounded-xl items-center" style={{ opacity: !description.trim() ? 0.5 : 1 }}>
              {savingService ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-sansBold text-[14px]">Save Service Record</Text>}
            </TouchableOpacity>
          </View>
        )}

        <Text className="text-navy font-sansBold text-[16px] mb-3">Service History</Text>
        {events.length === 0 ? (
          <View className="bg-card rounded-2xl p-6 items-center border border-navy-border mb-6">
            <Text className="text-navy-muted font-sans text-center">No service recorded yet.</Text>
          </View>
        ) : (
          events.map((e) => (
            <View key={e.id} className="bg-card rounded-2xl p-4 mb-3 border border-navy-border">
              <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-1">{new Date(e.service_date).toLocaleDateString()}</Text>
              <Text className="text-navy font-sansBold text-[14px]">{e.description}</Text>
              <Text className="text-navy-muted font-sans text-[12px] mt-1">
                {[e.vendor, e.cost != null ? `$${money(e.cost)}` : null].filter(Boolean).join(' · ')}
              </Text>
            </View>
          ))
        )}

        {asset.status === 'active' && (
          <TouchableOpacity onPress={retireAsset} className="border border-burgundy py-3.5 rounded-xl items-center mt-2">
            <Text className="text-burgundy font-sansBold text-[13px]">Retire This Asset</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between py-1.5">
      <Text className="text-navy-muted font-sans text-[13px]">{label}</Text>
      <Text className="text-navy font-sans text-[13px]">{value}</Text>
    </View>
  );
}
