import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { money } from '../../../lib/format';

interface ImprovementRow {
  id: string;
  title: string;
  description: string | null;
  start_date: string | null;
  completion_date: string | null;
  cost: number | null;
  contractor: string | null;
  permit_ref: string | null;
  property_id: string;
  properties: { name: string | null; address: string | null } | null;
}

interface PropertyOption { id: string; name: string | null; address: string | null }

export default function ImprovementsScreen() {
  const { propertyId: paramPropertyId } = useLocalSearchParams<{ propertyId?: string }>();
  const { profileId } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [improvements, setImprovements] = useState<ImprovementRow[]>([]);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [showAdd, setShowAdd] = useState(false);

  const [propertyId, setPropertyId] = useState<string | null>(paramPropertyId ?? null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [completionDate, setCompletionDate] = useState('');
  const [cost, setCost] = useState('');
  const [contractor, setContractor] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = React.useRef(false);

  const load = useCallback(async () => {
    if (!profileId) return;
    setLoading(true);
    let query = supabase
      .from('property_improvements')
      .select('id, title, description, start_date, completion_date, cost, contractor, permit_ref, property_id, properties ( name, address )')
      .eq('landlord_id', profileId)
      .order('created_at', { ascending: false });
    if (paramPropertyId) query = query.eq('property_id', paramPropertyId);
    const { data } = await query;
    setImprovements((data ?? []) as unknown as ImprovementRow[]);

    const { data: props } = await supabase.from('properties').select('id, name, address').eq('landlord_id', profileId);
    setProperties((props ?? []) as PropertyOption[]);
    if (!propertyId && props && props.length > 0) setPropertyId(paramPropertyId ?? props[0].id);

    setLoading(false);
  }, [profileId, paramPropertyId, propertyId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function save() {
    if (!profileId || !propertyId || !title.trim() || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    const { error } = await supabase.from('property_improvements').insert({
      landlord_id: profileId,
      property_id: propertyId,
      title: title.trim(),
      description: description.trim() || null,
      start_date: startDate || null,
      completion_date: completionDate || null,
      cost: cost ? Number(cost) : null,
      contractor: contractor.trim() || null,
    });
    setSaving(false);
    savingRef.current = false;
    if (error) {
      Alert.alert('Could not save improvement', error.message);
      return;
    }
    setShowAdd(false);
    setTitle(''); setDescription(''); setStartDate(''); setCompletionDate(''); setCost(''); setContractor('');
    load();
  }

  return (
    <View className="flex-1 bg-pageBg">
      <View className="pt-16 px-6 pb-6 bg-card border-b border-navy-border flex-row items-center justify-between">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-3 w-9 h-9 rounded-full bg-pageBg border border-navy-border items-center justify-center">
            <Feather name="chevron-left" size={20} color="#1F2F3A" />
          </TouchableOpacity>
          <Text className="text-xl font-sansBold text-navy">Capital Improvements</Text>
        </View>
        <TouchableOpacity onPress={() => setShowAdd((s) => !s)} className="w-9 h-9 rounded-full bg-navy items-center justify-center">
          <Feather name={showAdd ? 'x' : 'plus'} size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center"><ActivityIndicator color="#1F2F3A" /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 24 }}>
          {showAdd && (
            <View className="bg-card rounded-2xl p-4 border border-navy-border mb-5">
              <Text className="text-navy font-sansBold text-[13px] mb-2">Property</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3" contentContainerStyle={{ gap: 8 }}>
                {properties.map((p) => (
                  <TouchableOpacity key={p.id} onPress={() => setPropertyId(p.id)} className="px-4 py-2 rounded-full border" style={{ borderColor: propertyId === p.id ? '#1F2F3A' : '#D8D2C8', backgroundColor: propertyId === p.id ? '#1F2F3A' : '#FFFFFF' }}>
                    <Text className="font-sansBold text-[12px]" style={{ color: propertyId === p.id ? '#FFFFFF' : '#333333' }}>{p.name || p.address}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text className="text-navy font-sansBold text-[13px] mb-2">Title</Text>
              <TextInput className="bg-pageBg border border-navy-border rounded-xl p-3.5 font-sans text-navy mb-3" value={title} onChangeText={setTitle} placeholder="e.g. New roof" placeholderTextColor="#94a3b8" />

              <Text className="text-navy font-sansBold text-[13px] mb-2">Description</Text>
              <TextInput className="bg-pageBg border border-navy-border rounded-xl p-3.5 font-sans text-navy mb-3" value={description} onChangeText={setDescription} multiline numberOfLines={2} style={{ minHeight: 60, textAlignVertical: 'top' }} />

              <View className="flex-row gap-3 mb-3">
                <View className="flex-1">
                  <Text className="text-navy font-sansBold text-[13px] mb-2">Start date</Text>
                  <TextInput className="bg-pageBg border border-navy-border rounded-xl p-3.5 font-sans text-navy" value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" placeholderTextColor="#94a3b8" />
                </View>
                <View className="flex-1">
                  <Text className="text-navy font-sansBold text-[13px] mb-2">Completion date</Text>
                  <TextInput className="bg-pageBg border border-navy-border rounded-xl p-3.5 font-sans text-navy" value={completionDate} onChangeText={setCompletionDate} placeholder="YYYY-MM-DD" placeholderTextColor="#94a3b8" />
                </View>
              </View>

              <View className="flex-row gap-3 mb-4">
                <View className="flex-1">
                  <Text className="text-navy font-sansBold text-[13px] mb-2">Cost</Text>
                  <TextInput className="bg-pageBg border border-navy-border rounded-xl p-3.5 font-sans text-navy" value={cost} onChangeText={setCost} placeholder="8500" placeholderTextColor="#94a3b8" keyboardType="decimal-pad" />
                </View>
                <View className="flex-1">
                  <Text className="text-navy font-sansBold text-[13px] mb-2">Contractor</Text>
                  <TextInput className="bg-pageBg border border-navy-border rounded-xl p-3.5 font-sans text-navy" value={contractor} onChangeText={setContractor} placeholder="e.g. XYZ Roofing" placeholderTextColor="#94a3b8" />
                </View>
              </View>

              <TouchableOpacity onPress={save} disabled={saving || !title.trim() || !propertyId} className="bg-navy py-3.5 rounded-xl items-center" style={{ opacity: !title.trim() ? 0.5 : 1 }}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-sansBold text-[14px]">Save Improvement</Text>}
              </TouchableOpacity>
            </View>
          )}

          {improvements.length === 0 ? (
            <View className="bg-card rounded-2xl p-10 items-center border border-navy-border">
              <Text className="text-navy-muted font-sans text-center">No capital improvements recorded yet.</Text>
            </View>
          ) : (
            improvements.map((i) => (
              <View key={i.id} className="bg-card rounded-2xl p-4 mb-3 border border-navy-border">
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-navy font-sansBold text-[15px]">{i.title}</Text>
                  {!i.completion_date && <View className="px-2 py-0.5 rounded-full bg-amber-100"><Text className="text-amber-800 font-sansBold text-[10px]">In Progress</Text></View>}
                </View>
                <Text className="text-navy-muted font-sans text-[12px] mb-1">{i.properties?.name ?? i.properties?.address ?? ''}</Text>
                {!!i.description && <Text className="text-navy font-sans text-[13px] mb-2">{i.description}</Text>}
                <Text className="text-navy-muted font-sans text-[12px]">
                  {[i.completion_date ? `Completed ${new Date(i.completion_date).toLocaleDateString()}` : i.start_date ? `Started ${new Date(i.start_date).toLocaleDateString()}` : null, i.cost != null ? `$${money(i.cost)}` : null, i.contractor].filter(Boolean).join(' · ')}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}
