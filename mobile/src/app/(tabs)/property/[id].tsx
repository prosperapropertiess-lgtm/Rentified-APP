import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Modal, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { money, monthDay } from '../../../lib/format';

// The "data broken by property" view — property detail didn't exist at all
// before; tapping a property card in the Portfolio list did nothing.

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
  bedrooms: number | null;
  bathrooms: number | null;
  leases: LeaseInfo[];
}
interface PropertyInfo {
  id: string;
  name: string | null;
  address: string | null;
  city: string | null;
  landlord_id: string;
  units: UnitInfo[];
}
interface LedgerRow {
  id: string;
  amount: number;
  category: string | null;
  description: string | null;
  date: string;
}

const EXPENSE_CATEGORIES = ['repairs', 'utilities', 'insurance', 'taxes', 'management', 'other'];

function activeLease(unit: UnitInfo) {
  return unit.leases?.find((l) => l.status === 'active') ?? unit.leases?.[0] ?? null;
}

export default function PropertyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [property, setProperty] = useState<PropertyInfo | null>(null);
  const [expenses, setExpenses] = useState<LedgerRow[]>([]);
  const [income, setIncome] = useState<LedgerRow[]>([]);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [expAmount, setExpAmount] = useState('');
  const [expCategory, setExpCategory] = useState('repairs');
  const [expDescription, setExpDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const [showAddUnit, setShowAddUnit] = useState(false);
  const [unitNumber, setUnitNumber] = useState('');
  const [unitBedrooms, setUnitBedrooms] = useState('');
  const [unitBathrooms, setUnitBathrooms] = useState('');
  const [unitSqft, setUnitSqft] = useState('');
  const [unitRent, setUnitRent] = useState('');
  const [savingUnit, setSavingUnit] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!id) return;
    const [{ data: prop }, { data: exp }, { data: inc }] = await Promise.all([
      supabase
        .from('properties')
        .select(`
          id, name, address, city, landlord_id,
          units ( id, unit_number, rent_amount, status, bedrooms, bathrooms, leases ( id, status, rent_amount, tenants ( first_name, last_name ) ) )
        `)
        .eq('id', id)
        .single(),
      supabase.from('expenses').select('id, amount, category, description, date').eq('property_id', id).order('date', { ascending: false }),
      supabase.from('income').select('id, amount, category, description, date').eq('property_id', id).order('date', { ascending: false }),
    ]);

    // Supabase's default (ungenerated) client types every nested embed as
    // an array regardless of FK cardinality; these are verified to-one.
    setProperty((prop as unknown as PropertyInfo) ?? null);
    setExpenses((exp || []) as LedgerRow[]);
    setIncome((inc || []) as LedgerRow[]);
    setLoading(false);
  }, [id]);

  useFocusEffect(useCallback(() => { fetchAll(); }, [fetchAll]));

  async function addExpense() {
    const amount = Number(expAmount);
    if (!amount || amount <= 0 || !property) return;
    setSaving(true);
    await supabase.from('expenses').insert({
      property_id: id,
      landlord_id: property.landlord_id,
      category: expCategory,
      amount,
      description: expDescription || null,
      date: new Date().toISOString().split('T')[0],
    });
    setExpAmount(''); setExpDescription(''); setExpCategory('repairs');
    setShowAddExpense(false);
    setSaving(false);
    fetchAll();
  }

  async function addUnit() {
    if (!unitNumber.trim() || !property) return;
    setSavingUnit(true);
    const { error } = await supabase.from('units').insert({
      property_id: id,
      unit_number: unitNumber.trim(),
      bedrooms: unitBedrooms ? Number(unitBedrooms) : 0,
      bathrooms: unitBathrooms ? Number(unitBathrooms) : 0,
      sqft: unitSqft ? Number(unitSqft) : null,
      rent_amount: unitRent ? Number(unitRent) : 0,
      status: 'vacant',
    });
    setSavingUnit(false);
    if (error) {
      Alert.alert('Could not add unit', error.message);
      return;
    }
    setUnitNumber(''); setUnitBedrooms(''); setUnitBathrooms(''); setUnitSqft(''); setUnitRent('');
    setShowAddUnit(false);
    fetchAll();
  }

  if (loading) return <View className="flex-1 bg-pageBg justify-center items-center"><ActivityIndicator color="#1F2F3A" /></View>;

  if (!property) {
    return (
      <View className="flex-1 bg-pageBg justify-center items-center px-8">
        <Text className="text-navy-muted font-sans text-center">Property not found.</Text>
      </View>
    );
  }

  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const totalIncome = income.reduce((s, e) => s + Number(e.amount), 0);
  const expectedRent = property.units.reduce((s, u) => s + Number(activeLease(u)?.rent_amount ?? u.rent_amount ?? 0), 0);

  return (
    <View className="flex-1 bg-pageBg">
      <View className="pt-16 px-6 pb-6 bg-card border-b border-navy-border flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="mr-3 w-9 h-9 rounded-full bg-pageBg border border-navy-border items-center justify-center">
          <Feather name="chevron-left" size={20} color="#1F2F3A" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-xl font-sansBold text-navy" numberOfLines={1}>{property.name || property.address}</Text>
          <Text className="text-navy-muted font-sans text-[13px] mt-0.5">{property.city || ''}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 60 }}>
        {/* Financial summary */}
        <View className="flex-row gap-3 mb-8">
          <View className="flex-1 bg-card rounded-2xl p-4 border border-navy-border shadow-sm">
            <Text className="text-navy-muted font-sans text-[11px] uppercase tracking-wide">Expected / mo</Text>
            <Text className="text-navy font-sansBold text-[19px] mt-1">${money(expectedRent)}</Text>
          </View>
          <View className="flex-1 bg-card rounded-2xl p-4 border border-navy-border shadow-sm">
            <Text className="text-navy-muted font-sans text-[11px] uppercase tracking-wide">Income (recorded)</Text>
            <Text className="text-navy font-sansBold text-[19px] mt-1">${money(totalIncome)}</Text>
          </View>
          <View className="flex-1 bg-card rounded-2xl p-4 border border-navy-border shadow-sm">
            <Text className="text-navy-muted font-sans text-[11px] uppercase tracking-wide">Expenses</Text>
            <Text className="text-burgundy font-sansBold text-[19px] mt-1">${money(totalExpenses)}</Text>
          </View>
        </View>

        {/* Units */}
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-navy font-sansBold text-[18px]">Units</Text>
          <TouchableOpacity onPress={() => setShowAddUnit(true)} className="flex-row items-center gap-1">
            <Feather name="plus-circle" size={16} color="#8B2030" />
            <Text className="text-burgundy font-sansBold text-[13px]">Add</Text>
          </TouchableOpacity>
        </View>
        <View className="mb-8 gap-3">
          {property.units.length === 0 ? (
            <View className="bg-card rounded-2xl p-6 items-center border border-navy-border">
              <Text className="text-navy-muted font-sans text-center">No units on this property yet.</Text>
            </View>
          ) : (
            property.units.map((u) => {
              const lease = activeLease(u);
              return (
                <View key={u.id} className="bg-card rounded-2xl p-4 border border-navy-border flex-row items-center justify-between">
                  <View className="flex-1 pr-3">
                    <Text className="text-navy font-sansBold text-[15px]">{u.unit_number ? `Unit ${u.unit_number}` : 'Unit'}</Text>
                    <Text className="text-navy-muted font-sans text-[13px] mt-0.5">
                      {lease ? `${lease.tenants?.first_name ?? ''} ${lease.tenants?.last_name ?? ''}`.trim() || 'Resident on lease' : 'Vacant'}
                      {(u.bedrooms || u.bathrooms) ? ` · ${u.bedrooms ?? '—'}bd ${u.bathrooms ?? '—'}ba` : ''}
                    </Text>
                    {!lease && (
                      <TouchableOpacity onPress={() => router.push(`/add-tenant?unitId=${u.id}`)} className="flex-row items-center mt-1.5">
                        <Feather name="user-plus" size={13} color="#8B2030" />
                        <Text className="text-burgundy font-sansBold text-[12px] ml-1">Assign Resident</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text className="text-navy font-sansBold text-[14px]">${money(lease?.rent_amount ?? u.rent_amount)}/mo</Text>
                </View>
              );
            })
          )}
        </View>

        {/* Expenses */}
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-navy font-sansBold text-[18px]">Expenses</Text>
          <TouchableOpacity onPress={() => setShowAddExpense(true)} className="flex-row items-center gap-1">
            <Feather name="plus-circle" size={16} color="#8B2030" />
            <Text className="text-burgundy font-sansBold text-[13px]">Add</Text>
          </TouchableOpacity>
        </View>
        <View className="mb-8 gap-3">
          {expenses.length === 0 ? (
            <View className="bg-card rounded-2xl p-6 items-center border border-navy-border">
              <Text className="text-navy-muted font-sans text-center">No expenses recorded for this property yet.</Text>
            </View>
          ) : (
            expenses.map((e) => (
              <View key={e.id} className="bg-card rounded-2xl p-4 border border-navy-border flex-row items-center justify-between">
                <View className="flex-1 pr-3">
                  <Text className="text-navy font-sansBold text-[14px] capitalize">{e.category ?? 'Expense'}</Text>
                  {!!e.description && <Text className="text-navy-muted font-sans text-[13px] mt-0.5">{e.description}</Text>}
                  <Text className="text-navy-muted font-sans text-[12px] mt-0.5">{monthDay(e.date)}</Text>
                </View>
                <Text className="text-burgundy font-sansBold text-[14px]">−${money(e.amount)}</Text>
              </View>
            ))
          )}
        </View>

        {/* Income */}
        <Text className="text-navy font-sansBold text-[18px] mb-4">Income</Text>
        <View className="gap-3">
          {income.length === 0 ? (
            <View className="bg-card rounded-2xl p-6 items-center border border-navy-border">
              <Text className="text-navy-muted font-sans text-center">No income recorded for this property yet.</Text>
            </View>
          ) : (
            income.map((e) => (
              <View key={e.id} className="bg-card rounded-2xl p-4 border border-navy-border flex-row items-center justify-between">
                <View className="flex-1 pr-3">
                  <Text className="text-navy font-sansBold text-[14px] capitalize">{e.category ?? 'Income'}</Text>
                  {!!e.description && <Text className="text-navy-muted font-sans text-[13px] mt-0.5">{e.description}</Text>}
                  <Text className="text-navy-muted font-sans text-[12px] mt-0.5">{monthDay(e.date)}</Text>
                </View>
                <Text className="text-emerald-700 font-sansBold text-[14px]">+${money(e.amount)}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <Modal visible={showAddExpense} animationType="slide" transparent onRequestClose={() => setShowAddExpense(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 justify-end">
          <View className="bg-card rounded-t-[28px] p-6">
            <Text className="text-navy font-sansBold text-[19px] mb-5">Add Expense</Text>

            <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Category</Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
              {EXPENSE_CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setExpCategory(c)}
                  className="px-3 py-1.5 rounded-full border"
                  style={{ borderColor: expCategory === c ? '#1F2F3A' : '#D8D2C8', backgroundColor: expCategory === c ? '#1F2F3A' : 'transparent' }}
                >
                  <Text className="font-sansBold text-[12px] capitalize" style={{ color: expCategory === c ? '#FFFFFF' : '#333333' }}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Amount</Text>
            <TextInput
              className="bg-pageBg border border-navy-border rounded-xl p-4 font-sans text-navy mb-4"
              placeholder="0.00"
              placeholderTextColor="#94a3b8"
              keyboardType="decimal-pad"
              value={expAmount}
              onChangeText={setExpAmount}
            />

            <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Description (optional)</Text>
            <TextInput
              className="bg-pageBg border border-navy-border rounded-xl p-4 font-sans text-navy mb-6"
              placeholder="What was this for?"
              placeholderTextColor="#94a3b8"
              value={expDescription}
              onChangeText={setExpDescription}
            />

            <View className="flex-row gap-3">
              <TouchableOpacity onPress={() => setShowAddExpense(false)} className="flex-1 py-4 rounded-xl items-center border border-navy-border">
                <Text className="text-navy-muted font-sansBold text-[15px]">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={addExpense} disabled={saving || !expAmount} className="flex-1 bg-navy py-4 rounded-xl items-center" style={{ opacity: !expAmount ? 0.5 : 1 }}>
                <Text className="text-white font-sansBold text-[15px]">{saving ? 'Saving...' : 'Save Expense'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showAddUnit} animationType="slide" transparent onRequestClose={() => setShowAddUnit(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 justify-end">
          <View className="bg-card rounded-t-[28px] p-6">
            <Text className="text-navy font-sansBold text-[19px] mb-5">Add Unit</Text>

            <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Unit Number</Text>
            <TextInput
              className="bg-pageBg border border-navy-border rounded-xl p-4 font-sans text-navy mb-4"
              placeholder="e.g. 1, A, 204"
              placeholderTextColor="#94a3b8"
              value={unitNumber}
              onChangeText={setUnitNumber}
            />

            <View className="flex-row gap-3 mb-4">
              <View className="flex-1">
                <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Bedrooms</Text>
                <TextInput
                  className="bg-pageBg border border-navy-border rounded-xl p-4 font-sans text-navy"
                  placeholder="0"
                  placeholderTextColor="#94a3b8"
                  keyboardType="number-pad"
                  value={unitBedrooms}
                  onChangeText={setUnitBedrooms}
                />
              </View>
              <View className="flex-1">
                <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Bathrooms</Text>
                <TextInput
                  className="bg-pageBg border border-navy-border rounded-xl p-4 font-sans text-navy"
                  placeholder="0"
                  placeholderTextColor="#94a3b8"
                  keyboardType="number-pad"
                  value={unitBathrooms}
                  onChangeText={setUnitBathrooms}
                />
              </View>
              <View className="flex-1">
                <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Sqft</Text>
                <TextInput
                  className="bg-pageBg border border-navy-border rounded-xl p-4 font-sans text-navy"
                  placeholder="—"
                  placeholderTextColor="#94a3b8"
                  keyboardType="number-pad"
                  value={unitSqft}
                  onChangeText={setUnitSqft}
                />
              </View>
            </View>

            <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Monthly Rent</Text>
            <TextInput
              className="bg-pageBg border border-navy-border rounded-xl p-4 font-sans text-navy mb-6"
              placeholder="0.00"
              placeholderTextColor="#94a3b8"
              keyboardType="decimal-pad"
              value={unitRent}
              onChangeText={setUnitRent}
            />

            <View className="flex-row gap-3">
              <TouchableOpacity onPress={() => setShowAddUnit(false)} className="flex-1 py-4 rounded-xl items-center border border-navy-border">
                <Text className="text-navy-muted font-sansBold text-[15px]">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={addUnit} disabled={savingUnit || !unitNumber.trim()} className="flex-1 bg-navy py-4 rounded-xl items-center" style={{ opacity: !unitNumber.trim() ? 0.5 : 1 }}>
                <Text className="text-white font-sansBold text-[15px]">{savingUnit ? 'Saving...' : 'Save Unit'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
