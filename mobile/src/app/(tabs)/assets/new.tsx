import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';

const CATEGORIES = ['Refrigerator', 'Stove', 'Dishwasher', 'Washer', 'Dryer', 'Furnace', 'AC', 'Water Heater', 'Heat Pump', 'Sump Pump', 'Smoke Alarm', 'Other'];

interface PropertyOption { id: string; name: string | null; address: string | null }
interface UnitOption { id: string; unit_number: string | null }

export default function NewAssetScreen() {
  const params = useLocalSearchParams<{ propertyId?: string }>();
  const { profileId } = useAuth();
  const router = useRouter();

  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [propertyId, setPropertyId] = useState<string | null>(params.propertyId ?? null);
  const [unitId, setUnitId] = useState<string | null>(null);
  const [category, setCategory] = useState('Refrigerator');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [installedDate, setInstalledDate] = useState('');
  const [purchaseCost, setPurchaseCost] = useState('');
  const [vendor, setVendor] = useState('');
  const [warrantyExpires, setWarrantyExpires] = useState('');
  const [serviceInterval, setServiceInterval] = useState('12');
  const [lastServiceDate, setLastServiceDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = React.useRef(false);

  const load = useCallback(async () => {
    if (!profileId) return;
    const { data } = await supabase.from('properties').select('id, name, address').eq('landlord_id', profileId);
    setProperties((data ?? []) as PropertyOption[]);
    if (!propertyId && data && data.length > 0) setPropertyId(data[0].id);
  }, [profileId, propertyId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useFocusEffect(useCallback(() => {
    if (!propertyId) { setUnits([]); return; }
    supabase.from('units').select('id, unit_number').eq('property_id', propertyId).then(({ data }) => setUnits((data ?? []) as UnitOption[]));
  }, [propertyId]));

  async function save() {
    if (!profileId || !propertyId || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    const { error } = await supabase.from('assets').insert({
      landlord_id: profileId,
      property_id: propertyId,
      unit_id: unitId,
      category,
      make: make.trim() || null,
      model: model.trim() || null,
      installed_date: installedDate || null,
      purchase_cost: purchaseCost ? Number(purchaseCost) : null,
      vendor: vendor.trim() || null,
      warranty_expires: warrantyExpires || null,
      service_interval_months: serviceInterval ? Number(serviceInterval) : null,
      last_service_date: lastServiceDate || null,
      notes: notes.trim() || null,
      status: 'active',
    });
    setSaving(false);
    savingRef.current = false;
    if (error) {
      Alert.alert('Could not save asset', error.message);
      return;
    }
    router.back();
  }

  return (
    <View className="flex-1 bg-pageBg">
      <View className="pt-16 px-6 pb-6 bg-card border-b border-navy-border flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="mr-3 w-9 h-9 rounded-full bg-pageBg border border-navy-border items-center justify-center">
          <Feather name="chevron-left" size={20} color="#1F2F3A" />
        </TouchableOpacity>
        <Text className="text-xl font-sansBold text-navy">Add Asset</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 60 }}>
        <Text className="text-navy font-sansBold text-[13px] mb-2">Property</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4" contentContainerStyle={{ gap: 8 }}>
          {properties.map((p) => (
            <TouchableOpacity key={p.id} onPress={() => { setPropertyId(p.id); setUnitId(null); }} className="px-4 py-2.5 rounded-full border" style={{ borderColor: propertyId === p.id ? '#1F2F3A' : '#D8D2C8', backgroundColor: propertyId === p.id ? '#1F2F3A' : '#FFFFFF' }}>
              <Text className="font-sansBold text-[13px]" style={{ color: propertyId === p.id ? '#FFFFFF' : '#333333' }}>{p.name || p.address}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {units.length > 0 && (
          <>
            <Text className="text-navy font-sansBold text-[13px] mb-2">Unit (optional — leave unselected for whole-property assets)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4" contentContainerStyle={{ gap: 8 }}>
              <TouchableOpacity onPress={() => setUnitId(null)} className="px-4 py-2.5 rounded-full border" style={{ borderColor: unitId === null ? '#1F2F3A' : '#D8D2C8', backgroundColor: unitId === null ? '#1F2F3A' : '#FFFFFF' }}>
                <Text className="font-sansBold text-[13px]" style={{ color: unitId === null ? '#FFFFFF' : '#333333' }}>Whole property</Text>
              </TouchableOpacity>
              {units.map((u) => (
                <TouchableOpacity key={u.id} onPress={() => setUnitId(u.id)} className="px-4 py-2.5 rounded-full border" style={{ borderColor: unitId === u.id ? '#1F2F3A' : '#D8D2C8', backgroundColor: unitId === u.id ? '#1F2F3A' : '#FFFFFF' }}>
                  <Text className="font-sansBold text-[13px]" style={{ color: unitId === u.id ? '#FFFFFF' : '#333333' }}>Unit {u.unit_number}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        <Text className="text-navy font-sansBold text-[13px] mb-2">Category</Text>
        <View className="flex-row flex-wrap gap-2 mb-4">
          {CATEGORIES.map((c) => (
            <TouchableOpacity key={c} onPress={() => setCategory(c)} className="px-3.5 py-2 rounded-full border" style={{ borderColor: category === c ? '#1F2F3A' : '#D8D2C8', backgroundColor: category === c ? '#1F2F3A' : '#FFFFFF' }}>
              <Text className="font-sansBold text-[12px]" style={{ color: category === c ? '#FFFFFF' : '#333333' }}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View className="flex-row gap-3 mb-4">
          <View className="flex-1">
            <Text className="text-navy font-sansBold text-[13px] mb-2">Make</Text>
            <TextInput className="bg-card border border-navy-border rounded-xl p-4 font-sans text-navy" value={make} onChangeText={setMake} placeholder="e.g. Bosch" placeholderTextColor="#94a3b8" />
          </View>
          <View className="flex-1">
            <Text className="text-navy font-sansBold text-[13px] mb-2">Model</Text>
            <TextInput className="bg-card border border-navy-border rounded-xl p-4 font-sans text-navy" value={model} onChangeText={setModel} placeholder="e.g. 300 Series" placeholderTextColor="#94a3b8" />
          </View>
        </View>

        <View className="flex-row gap-3 mb-4">
          <View className="flex-1">
            <Text className="text-navy font-sansBold text-[13px] mb-2">Installed date</Text>
            <TextInput className="bg-card border border-navy-border rounded-xl p-4 font-sans text-navy" value={installedDate} onChangeText={setInstalledDate} placeholder="YYYY-MM-DD" placeholderTextColor="#94a3b8" />
          </View>
          <View className="flex-1">
            <Text className="text-navy font-sansBold text-[13px] mb-2">Purchase cost</Text>
            <TextInput className="bg-card border border-navy-border rounded-xl p-4 font-sans text-navy" value={purchaseCost} onChangeText={setPurchaseCost} placeholder="1149" placeholderTextColor="#94a3b8" keyboardType="decimal-pad" />
          </View>
        </View>

        <View className="mb-4">
          <Text className="text-navy font-sansBold text-[13px] mb-2">Vendor</Text>
          <TextInput className="bg-card border border-navy-border rounded-xl p-4 font-sans text-navy" value={vendor} onChangeText={setVendor} placeholder="e.g. ABC Appliances" placeholderTextColor="#94a3b8" />
        </View>

        <View className="flex-row gap-3 mb-4">
          <View className="flex-1">
            <Text className="text-navy font-sansBold text-[13px] mb-2">Warranty expires</Text>
            <TextInput className="bg-card border border-navy-border rounded-xl p-4 font-sans text-navy" value={warrantyExpires} onChangeText={setWarrantyExpires} placeholder="YYYY-MM-DD" placeholderTextColor="#94a3b8" />
          </View>
          <View className="flex-1">
            <Text className="text-navy font-sansBold text-[13px] mb-2">Service interval (months)</Text>
            <TextInput className="bg-card border border-navy-border rounded-xl p-4 font-sans text-navy" value={serviceInterval} onChangeText={setServiceInterval} placeholder="12" placeholderTextColor="#94a3b8" keyboardType="number-pad" />
          </View>
        </View>

        <View className="mb-4">
          <Text className="text-navy font-sansBold text-[13px] mb-2">Last service date (optional)</Text>
          <TextInput className="bg-card border border-navy-border rounded-xl p-4 font-sans text-navy" value={lastServiceDate} onChangeText={setLastServiceDate} placeholder="YYYY-MM-DD" placeholderTextColor="#94a3b8" />
        </View>

        <View className="mb-6">
          <Text className="text-navy font-sansBold text-[13px] mb-2">Notes</Text>
          <TextInput
            className="bg-card border border-navy-border rounded-xl p-4 font-sans text-navy"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            style={{ minHeight: 80, textAlignVertical: 'top' }}
          />
        </View>

        <TouchableOpacity onPress={save} disabled={saving || !propertyId} className="bg-navy py-4 rounded-xl items-center" style={{ opacity: !propertyId ? 0.5 : 1 }}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-sansBold text-[15px]">Save Asset</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
