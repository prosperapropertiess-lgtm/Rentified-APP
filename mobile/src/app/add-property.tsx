import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const PROPERTY_TYPES = [
  { value: 'single_family', label: 'Single Family' },
  { value: 'multi_unit', label: 'Multi-Unit' },
  { value: 'condo', label: 'Condo' },
  { value: 'townhouse', label: 'Townhouse' },
];

export default function AddPropertyScreen() {
  const router = useRouter();
  const { profileId } = useAuth();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [type, setType] = useState('single_family');
  const [saving, setSaving] = useState(false);

  const canSave = address.trim().length > 0 && city.trim().length > 0 && !saving;

  async function save() {
    if (!profileId || !canSave) return;
    setSaving(true);
    const { data, error } = await supabase
      .from('properties')
      .insert({
        landlord_id: profileId,
        name: name.trim() || address.trim(),
        address: address.trim(),
        city: city.trim(),
        province: province.trim() || 'ON',
        postal_code: postalCode.trim() || '000000',
        type,
      })
      .select()
      .single();
    setSaving(false);

    if (error || !data) {
      Alert.alert('Could not add property', error?.message ?? 'Please try again.');
      return;
    }
    router.replace(`/property/${data.id}`);
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-pageBg">
      <View className="pt-16 px-6 pb-6 bg-card border-b border-navy-border flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="mr-3 w-9 h-9 rounded-full bg-pageBg border border-navy-border items-center justify-center">
          <Feather name="chevron-left" size={20} color="#1F2F3A" />
        </TouchableOpacity>
        <Text className="text-xl font-sansBold text-navy">Add Property</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Property Name (optional)</Text>
        <TextInput
          className="bg-card border border-navy-border rounded-xl p-4 font-sans text-navy mb-4"
          placeholder="e.g. 27 Horton Upper Unit"
          placeholderTextColor="#94a3b8"
          value={name}
          onChangeText={setName}
        />

        <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Address</Text>
        <TextInput
          className="bg-card border border-navy-border rounded-xl p-4 font-sans text-navy mb-4"
          placeholder="Street address"
          placeholderTextColor="#94a3b8"
          value={address}
          onChangeText={setAddress}
        />

        <View className="flex-row gap-3 mb-4">
          <View className="flex-1">
            <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">City</Text>
            <TextInput
              className="bg-card border border-navy-border rounded-xl p-4 font-sans text-navy"
              placeholder="City"
              placeholderTextColor="#94a3b8"
              value={city}
              onChangeText={setCity}
            />
          </View>
          <View className="w-24">
            <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Province</Text>
            <TextInput
              className="bg-card border border-navy-border rounded-xl p-4 font-sans text-navy"
              placeholder="ON"
              placeholderTextColor="#94a3b8"
              value={province}
              onChangeText={setProvince}
              autoCapitalize="characters"
              maxLength={2}
            />
          </View>
        </View>

        <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Postal Code</Text>
        <TextInput
          className="bg-card border border-navy-border rounded-xl p-4 font-sans text-navy mb-4"
          placeholder="A1A 1A1"
          placeholderTextColor="#94a3b8"
          value={postalCode}
          onChangeText={setPostalCode}
          autoCapitalize="characters"
        />

        <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Type</Text>
        <View className="flex-row flex-wrap gap-2 mb-8">
          {PROPERTY_TYPES.map((t) => (
            <TouchableOpacity
              key={t.value}
              onPress={() => setType(t.value)}
              className="px-4 py-2.5 rounded-full border"
              style={{ borderColor: type === t.value ? '#1F2F3A' : '#D8D2C8', backgroundColor: type === t.value ? '#1F2F3A' : 'transparent' }}
            >
              <Text className="font-sansBold text-[13px]" style={{ color: type === t.value ? '#FFFFFF' : '#333333' }}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity onPress={save} disabled={!canSave} className="bg-navy py-4 rounded-xl items-center" style={{ opacity: canSave ? 1 : 0.5 }}>
          <Text className="text-white font-sansBold text-[15px]">{saving ? 'Saving...' : 'Add Property'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
