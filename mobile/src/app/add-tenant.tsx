import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../lib/supabase';

function randomPin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

interface UnitContext {
  id: string;
  unit_number: string | null;
  rent_amount: number | null;
  property_id: string;
  properties: { name: string | null; address: string | null; landlord_id: string } | null;
}

export default function AddTenantScreen() {
  const { unitId } = useLocalSearchParams<{ unitId: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [unit, setUnit] = useState<UnitContext | null>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [rentAmount, setRentAmount] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchUnit = useCallback(async () => {
    if (!unitId) return;
    const { data } = await supabase
      .from('units')
      .select('id, unit_number, rent_amount, property_id, properties ( name, address, landlord_id )')
      .eq('id', unitId)
      .single();
    const u = data as unknown as UnitContext | null;
    setUnit(u);
    if (u?.rent_amount) setRentAmount(String(u.rent_amount));
    setLoading(false);
  }, [unitId]);

  useEffect(() => { setTimeout(() => fetchUnit(), 0); }, [fetchUnit]);

  const canSave = firstName.trim().length > 0 && email.trim().length > 0 && rentAmount.trim().length > 0 && !saving;

  async function save() {
    if (!unit?.properties?.landlord_id || !canSave) return;
    setSaving(true);
    const landlordId = unit.properties.landlord_id;
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    // leases.end_date is required in this schema (no month-to-month/open-ended
    // leases) — default to one year out when the landlord leaves it blank.
    const resolvedEndDate = endDate || (() => {
      const d = new Date(startDate);
      d.setFullYear(d.getFullYear() + 1);
      return d.toISOString().split('T')[0];
    })();

    // This is the tenant's permanent login PIN — retry on the rare exact
    // collision (tenants.pin has a unique constraint as the hard backstop).
    let tenant: { id: string; email: string } | null = null;
    let pin = '';
    let tenantError: { message: string; code?: string } | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      pin = randomPin();
      const { data, error } = await supabase
        .from('tenants')
        .insert({
          landlord_id: landlordId,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          pin,
        })
        .select()
        .single();
      if (!error) { tenant = data; tenantError = null; break; }
      tenantError = error;
      if (error.code !== '23505') break; // not a uniqueness collision, don't retry
    }

    if (tenantError || !tenant) {
      setSaving(false);
      Alert.alert('Could not add resident', tenantError?.message ?? 'Please try again.');
      return;
    }

    const { error: leaseError } = await supabase.from('leases').insert({
      unit_id: unit.id,
      tenant_id: tenant.id,
      landlord_id: landlordId,
      start_date: startDate,
      end_date: resolvedEndDate,
      rent_amount: Number(rentAmount),
      security_deposit: depositAmount ? Number(depositAmount) : 0,
      status: 'active',
    });

    if (leaseError) {
      // Compensating cleanup — without this, the tenant row is orphaned
      // (a resident with a PIN and email but no lease/unit), and any retry
      // fails on that same email/PIN, permanently blocking this unit.
      await supabase.from('tenants').delete().eq('id', tenant.id);
      setSaving(false);
      Alert.alert('Could not add resident', `The lease couldn't be saved (${leaseError.message}), so nothing was created. Please try again.`);
      return;
    }

    const { error: unitError } = await supabase.from('units').update({ status: 'occupied' }).eq('id', unit.id);
    if (unitError) {
      console.error('Unit status update failed after lease creation:', unitError);
    }

    // The "inviteToken" field carries the PIN — the tenant's account and
    // permanent login credential, not a one-time claim code.
    const { error: inviteError } = await supabase.functions.invoke('send-tenant-invite', {
      body: { email: tenant.email, firstName: firstName.trim(), inviteToken: pin, landlordName: unit.properties?.name ?? 'your landlord' },
    });

    setSaving(false);

    if (inviteError) {
      Alert.alert(
        'Resident added',
        `${fullName} is on the lease, but the invite email failed to send. Share their PIN with them to log in: ${pin}`
      );
    } else {
      Alert.alert('Resident added', `${fullName} has been added and invited. Their login PIN is ${pin}.`);
    }
    router.back();
  }

  if (loading) return <View className="flex-1 bg-pageBg justify-center items-center"><ActivityIndicator color="#1F2F3A" /></View>;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-pageBg">
      <View className="pt-16 px-6 pb-6 bg-card border-b border-navy-border flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="mr-3 w-9 h-9 rounded-full bg-pageBg border border-navy-border items-center justify-center">
          <Feather name="chevron-left" size={20} color="#1F2F3A" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-xl font-sansBold text-navy">Assign Resident</Text>
          {!!unit && (
            <Text className="text-navy-muted font-sans text-[13px] mt-0.5">
              {unit.properties?.name ?? unit.properties?.address} · Unit {unit.unit_number}
            </Text>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <Text className="text-navy font-sansBold text-[15px] mb-3">Resident</Text>
        <View className="flex-row gap-3 mb-4">
          <View className="flex-1">
            <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">First Name</Text>
            <TextInput className="bg-card border border-navy-border rounded-xl p-4 font-sans text-navy" value={firstName} onChangeText={setFirstName} placeholder="First name" placeholderTextColor="#94a3b8" />
          </View>
          <View className="flex-1">
            <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Last Name</Text>
            <TextInput className="bg-card border border-navy-border rounded-xl p-4 font-sans text-navy" value={lastName} onChangeText={setLastName} placeholder="Last name" placeholderTextColor="#94a3b8" />
          </View>
        </View>

        <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Email</Text>
        <TextInput
          className="bg-card border border-navy-border rounded-xl p-4 font-sans text-navy mb-4"
          value={email}
          onChangeText={setEmail}
          placeholder="resident@email.com"
          placeholderTextColor="#94a3b8"
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Phone</Text>
        <TextInput
          className="bg-card border border-navy-border rounded-xl p-4 font-sans text-navy mb-6"
          value={phone}
          onChangeText={setPhone}
          placeholder="(555) 555-5555"
          placeholderTextColor="#94a3b8"
          keyboardType="phone-pad"
        />

        <Text className="text-navy font-sansBold text-[15px] mb-3">Lease</Text>
        <View className="flex-row gap-3 mb-4">
          <View className="flex-1">
            <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Start Date</Text>
            <TextInput className="bg-card border border-navy-border rounded-xl p-4 font-sans text-navy" value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" placeholderTextColor="#94a3b8" />
          </View>
          <View className="flex-1">
            <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">End Date <Text className="text-navy-muted/50 normal-case">(defaults to 1yr)</Text></Text>
            <TextInput className="bg-card border border-navy-border rounded-xl p-4 font-sans text-navy" value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DD" placeholderTextColor="#94a3b8" />
          </View>
        </View>

        <View className="flex-row gap-3 mb-4">
          <View className="flex-1">
            <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Monthly Rent</Text>
            <TextInput className="bg-card border border-navy-border rounded-xl p-4 font-sans text-navy" value={rentAmount} onChangeText={setRentAmount} placeholder="0.00" placeholderTextColor="#94a3b8" keyboardType="decimal-pad" />
          </View>
          <View className="flex-1">
            <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Deposit</Text>
            <TextInput className="bg-card border border-navy-border rounded-xl p-4 font-sans text-navy" value={depositAmount} onChangeText={setDepositAmount} placeholder="0.00" placeholderTextColor="#94a3b8" keyboardType="decimal-pad" />
          </View>
        </View>

        <TouchableOpacity onPress={save} disabled={!canSave} className="bg-navy py-4 rounded-xl items-center mt-4" style={{ opacity: canSave ? 1 : 0.5 }}>
          <Text className="text-white font-sansBold text-[15px]">{saving ? 'Saving...' : 'Add Tenant & Send Invite'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
