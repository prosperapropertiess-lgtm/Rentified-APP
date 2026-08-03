import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function ContractorDispatchScreen() {
  const router = useRouter();
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);

  const contractors = [
    {
      id: 'c-1',
      name: 'Apex Master Plumbers Ltd.',
      trade: 'Emergency Plumbing & Water Lines',
      rating: '4.9 ★ (124 reviews)',
      eta: '25 Mins',
      estimate: '$150 - $220',
      verified: true,
      phone: '+1 (416) 555-9081',
    },
    {
      id: 'c-2',
      name: 'Toronto Climate HVAC Specialist',
      trade: 'Heating, AC & Venting',
      rating: '4.8 ★ (98 reviews)',
      eta: '45 Mins',
      estimate: '$180 - $250',
      verified: true,
      phone: '+1 (416) 555-8820',
    },
    {
      id: 'c-3',
      name: 'ProShield Electrical Solutions',
      trade: 'Emergency Panel & Wiring',
      rating: '5.0 ★ (64 reviews)',
      eta: '30 Mins',
      estimate: '$160 - $240',
      verified: true,
      phone: '+1 (416) 555-7711',
    },
  ];

  const handleDispatch = (contractorName: string, id: string) => {
    Alert.alert(
      'Confirm Emergency Dispatch',
      `Dispatch ${contractorName} to King Street West Condos (Unit 4B) immediately?`,
      [
        {
          text: 'Confirm Dispatch',
          onPress: async () => {
            setDispatchingId(id);
            await new Promise((res) => setTimeout(res, 900));
            setDispatchingId(null);
            Alert.alert(
              'Work Order Dispatched! 🚨',
              `Work Order dispatched to ${contractorName}. ETA: 25 Mins. Tenant and landlord will receive real-time SMS updates.`
            );
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  return (
    <View className="flex-1 bg-pageBg relative">
      <ScrollView className="flex-1 z-10 px-6 pt-16 pb-28" contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Header */}
        <View className="flex-row items-center mb-6">
          <TouchableOpacity onPress={() => router.back()} className="mr-3 w-9 h-9 rounded-full bg-white border border-navy-border items-center justify-center">
            <MaterialIcons name="arrow-back" size={20} color="#0F1C28" />
          </TouchableOpacity>
          <View>
            <Text className="text-[11px] text-navy-muted uppercase tracking-[0.12em]" style={{ fontFamily: 'DMSans_700Bold' }}>
              24/7 Service Marketplace
            </Text>
            <Text className="text-[30px] text-navy leading-tight" style={{ fontFamily: 'Cormorant_300Light' }}>
              Contractor Dispatch
            </Text>
          </View>
        </View>

        {/* Emergency Triage Header */}
        <View className="bg-red-500/10 border border-red-500/20 rounded-[24px] p-5 mb-6">
          <View className="flex-row items-center mb-1">
            <MaterialIcons name="warning" size={20} color="#DC2626" />
            <Text className="text-red-700 text-[13px] font-bold uppercase ml-1.5" style={{ fontFamily: 'DMSans_700Bold' }}>
              High-Priority Emergency Ticket #402
            </Text>
          </View>
          <Text className="text-navy text-[16px] font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
            500 King St W • Unit 4B — Water Heater Valve Leak
          </Text>
          <Text className="text-navy-muted text-[12px] mt-0.5" style={{ fontFamily: 'DMSans_400Regular' }}>
            Submitted by tenant 18 minutes ago. Instant dispatch active.
          </Text>
        </View>

        {/* Contractor List */}
        <Text className="text-[13px] text-navy-muted uppercase tracking-[0.08em] mb-3 ml-1" style={{ fontFamily: 'DMSans_700Bold' }}>
          Pre-Vetted Local Contractors Nearby ({contractors.length})
        </Text>

        {contractors.map((c) => (
          <View key={c.id} className="bg-white rounded-[24px] p-5 border border-navy-border shadow-card mb-4">
            <View className="flex-row justify-between items-start mb-2">
              <View className="flex-1 mr-2">
                <View className="flex-row items-center mb-0.5">
                  <Text className="text-[17px] text-navy font-bold mr-1.5" style={{ fontFamily: 'DMSans_700Bold' }}>
                    {c.name}
                  </Text>
                  {c.verified && <MaterialIcons name="verified" size={16} color="#059669" />}
                </View>
                <Text className="text-[12px] text-navy-muted" style={{ fontFamily: 'DMSans_400Regular' }}>
                  {c.trade} • {c.rating}
                </Text>
              </View>

              <View className="bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/30">
                <Text className="text-emerald-700 text-[11px] font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
                  ETA {c.eta}
                </Text>
              </View>
            </View>

            <View className="flex-row justify-between items-center py-2.5 my-2 border-y border-navy-border/50">
              <Text className="text-[12px] text-navy-muted" style={{ fontFamily: 'DMSans_400Regular' }}>
                Est. Diagnostic Cost: <Text className="font-bold text-navy">{c.estimate}</Text>
              </Text>
              <Text className="text-[12px] text-navy-muted" style={{ fontFamily: 'DMSans_400Regular' }}>
                Direct Call: <Text className="font-bold text-navy">{c.phone}</Text>
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => handleDispatch(c.name, c.id)}
              disabled={dispatchingId === c.id}
              className="bg-navy py-3 rounded-[14px] items-center flex-row justify-center shadow-sm"
            >
              <MaterialIcons name="bolt" size={18} color="#FFFFFF" />
              <Text className="text-white text-[13px] font-bold ml-1.5" style={{ fontFamily: 'DMSans_700Bold' }}>
                {dispatchingId === c.id ? 'Dispatching...' : '1-Tap Emergency Dispatch'}
              </Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
