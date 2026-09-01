import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

// Option A — "Tell us what happened" (spec section 5). The system MAY
// suggest a form ("N4 may apply"), never asserts one ("you must use N4").
const REASONS: { key: string; label: string; suggestedForm: string | null }[] = [
  { key: 'non_payment', label: "Tenant didn't pay rent", suggestedForm: 'N4' },
  { key: 'late_payment', label: 'Tenant repeatedly pays late', suggestedForm: 'N8' },
  { key: 'damage', label: 'Tenant damaged the property', suggestedForm: 'N5' },
  { key: 'disturbance', label: 'Tenant is disturbing others', suggestedForm: 'N5' },
  { key: 'overcrowding', label: 'Tenant is overcrowding the unit', suggestedForm: 'N5' },
  { key: 'safety', label: 'Serious safety issue', suggestedForm: 'N7' },
  { key: 'illegal_activity', label: 'Suspected illegal activity', suggestedForm: 'N6' },
  { key: 'landlord_needs_unit', label: 'Landlord/family needs unit', suggestedForm: 'N12' },
  { key: 'purchaser_needs_unit', label: 'Purchaser requires unit', suggestedForm: 'N12' },
  { key: 'renovation', label: 'Renovation/repair requires vacancy', suggestedForm: 'N13' },
  { key: 'demolition', label: 'Property will be demolished', suggestedForm: 'N13' },
  { key: 'conversion', label: 'Property being converted', suggestedForm: 'N13' },
  { key: 'rent_increase', label: 'Increase the rent', suggestedForm: 'N1' },
  { key: 'agreed_to_leave', label: 'Tenant agreed to leave', suggestedForm: 'N11' },
];

const FORM_CARDS: { code: string; name: string; description: string; ready: boolean }[] = [
  { code: 'N4', name: 'Non-payment of rent', description: 'Tenant has not paid all rent owed.', ready: true },
  { code: 'N5', name: 'Interference, damage or overcrowding', description: 'Substantial interference, damage, or overcrowding.', ready: true },
  { code: 'N8', name: 'Persistent late payment / end of term', description: 'End-of-term situations, including repeated late payment.', ready: true },
  { code: 'N12', name: 'Landlord, purchaser or family member requires unit', description: 'Landlord, purchaser, or qualifying family member requires the unit.', ready: true },
  { code: 'N13', name: 'Demolition, repairs or conversion', description: 'Vacancy required for demolition, renovation, or conversion.', ready: true },
  { code: 'N1', name: 'Rent increase', description: 'Notice of a rent increase at or below the guideline.', ready: true },
  { code: 'N7', name: 'Serious problems', description: 'Safety impairment, wilful damage, or serious misuse of the unit.', ready: true },
  { code: 'N6', name: 'Illegal acts or misrepresenting income', description: 'Illegal activity at the complex, or misrepresented income in a rent-geared-to-income unit.', ready: true },
  { code: 'N11', name: 'Agreement to end the tenancy', description: 'Landlord and tenant mutually agree on a termination date.', ready: true },
];

export default function CreateNoticeScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<'A' | 'B' | null>(null);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);

  function startForm(formCode: string) {
    if (formCode === 'N4') {
      router.push('/(tabs)/ltb/n4-new');
      return;
    }
    if (formCode === 'N5') {
      router.push('/(tabs)/ltb/n5-new');
      return;
    }
    if (formCode === 'N1') {
      router.push('/(tabs)/ltb/n1-new');
      return;
    }
    if (formCode === 'N8') {
      router.push('/(tabs)/ltb/n8-new');
      return;
    }
    if (formCode === 'N12') {
      router.push('/(tabs)/ltb/n12-new');
      return;
    }
    if (formCode === 'N13') {
      router.push('/(tabs)/ltb/n13-new');
      return;
    }
    if (formCode === 'N6') {
      router.push('/(tabs)/ltb/n6-new');
      return;
    }
    if (formCode === 'N7') {
      router.push('/(tabs)/ltb/n7-new');
      return;
    }
    if (formCode === 'N11') {
      router.push('/(tabs)/ltb/n11-new');
      return;
    }
    // Other forms aren't built yet — say so plainly rather than opening a
    // broken flow. See LTB_BUILD_STATUS.md for what's next.
    router.push({ pathname: '/(tabs)/ltb/create', params: { comingSoon: formCode } } as any);
  }

  const reason = REASONS.find((r) => r.key === selectedReason);

  return (
    <View className="flex-1 bg-pageBg">
      <View className="pt-16 px-6 pb-6 bg-card border-b border-navy-border flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="mr-3 w-9 h-9 rounded-full bg-pageBg border border-navy-border items-center justify-center">
          <Feather name="chevron-left" size={20} color="#1F2F3A" />
        </TouchableOpacity>
        <Text className="text-2xl font-sansBold text-navy">Create Notice</Text>
      </View>

      {mode === null ? (
        <ScrollView contentContainerStyle={{ padding: 24 }}>
          <Text className="text-navy font-sansBold text-[19px] mb-2">What&apos;s happening?</Text>
          <Text className="text-navy-muted font-sans text-[14px] mb-6">
            Tell us what happened, or jump straight to a form if you already know which one you need.
          </Text>

          <TouchableOpacity onPress={() => setMode('A')} className="bg-card rounded-2xl p-5 mb-4 border border-navy-border shadow-sm flex-row items-center">
            <View className="w-11 h-11 bg-navy/5 rounded-full items-center justify-center mr-4">
              <Feather name="message-circle" size={20} color="#1F2F3A" />
            </View>
            <View className="flex-1">
              <Text className="text-navy font-sansBold text-[16px]">Tell us what happened</Text>
              <Text className="text-navy-muted font-sans text-[13px] mt-0.5">We&apos;ll suggest which form may apply.</Text>
            </View>
            <Feather name="chevron-right" size={18} color="#1F2F3A" style={{ opacity: 0.3 }} />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setMode('B')} className="bg-card rounded-2xl p-5 border border-navy-border shadow-sm flex-row items-center">
            <View className="w-11 h-11 bg-navy/5 rounded-full items-center justify-center mr-4">
              <Feather name="file-text" size={20} color="#1F2F3A" />
            </View>
            <View className="flex-1">
              <Text className="text-navy font-sansBold text-[16px]">I already know which form I need</Text>
              <Text className="text-navy-muted font-sans text-[13px] mt-0.5">Choose a form directly.</Text>
            </View>
            <Feather name="chevron-right" size={18} color="#1F2F3A" style={{ opacity: 0.3 }} />
          </TouchableOpacity>
        </ScrollView>
      ) : mode === 'A' ? (
        <ScrollView contentContainerStyle={{ padding: 24 }}>
          <TouchableOpacity onPress={() => { setMode(null); setSelectedReason(null); }} className="mb-4">
            <Text className="text-navy-muted font-sansBold text-[13px]">← Back</Text>
          </TouchableOpacity>
          {REASONS.map((r) => (
            <TouchableOpacity
              key={r.key}
              onPress={() => setSelectedReason(r.key)}
              className="bg-card rounded-2xl p-4 mb-3 border flex-row items-center justify-between"
              style={{ borderColor: selectedReason === r.key ? '#1F2F3A' : '#D8D2C8' }}
            >
              <Text className="text-navy font-sans text-[15px] flex-1">{r.label}</Text>
              {selectedReason === r.key && <Feather name="check-circle" size={18} color="#1F2F3A" />}
            </TouchableOpacity>
          ))}

          {reason && (
            <View className="bg-navy/5 rounded-2xl p-5 mt-4 border border-navy-border">
              <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Why this form may apply</Text>
              <Text className="text-navy font-sans text-[15px] mb-4">
                Based on the information provided, <Text className="font-sansBold">{reason.suggestedForm}</Text> may apply. This is a
                suggestion, not legal advice — review the official LTB information before proceeding.
              </Text>
              <TouchableOpacity onPress={() => reason.suggestedForm && startForm(reason.suggestedForm)} className="bg-navy py-3.5 rounded-xl items-center">
                <Text className="text-white font-sansBold">Continue with {reason.suggestedForm}</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 24 }}>
          <TouchableOpacity onPress={() => setMode(null)} className="mb-4">
            <Text className="text-navy-muted font-sansBold text-[13px]">← Back</Text>
          </TouchableOpacity>
          {FORM_CARDS.map((f) => (
            <View key={f.code} className="bg-card rounded-2xl p-5 mb-4 border border-navy-border shadow-sm">
              <View className="flex-row items-center justify-between mb-1">
                <Text className="text-navy font-sansBold text-[18px]">{f.code}</Text>
                {!f.ready && (
                  <View className="bg-navy/5 px-2.5 py-1 rounded-full">
                    <Text className="text-navy-muted font-sansBold text-[10px] uppercase">Coming Soon</Text>
                  </View>
                )}
              </View>
              <Text className="text-navy font-sansBold text-[15px] mb-1">{f.name}</Text>
              <Text className="text-navy-muted font-sans text-[13px] mb-4">{f.description}</Text>
              <TouchableOpacity
                onPress={() => startForm(f.code)}
                disabled={!f.ready}
                className="bg-navy py-3 rounded-xl items-center"
                style={{ opacity: f.ready ? 1 : 0.4 }}
              >
                <Text className="text-white font-sansBold text-[14px]">{f.ready ? 'Start' : 'Not yet available'}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
