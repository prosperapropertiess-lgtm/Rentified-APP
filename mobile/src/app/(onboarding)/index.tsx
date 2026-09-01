import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';


export default function OnboardingIndex() {
  const router = useRouter();


  return (
    <View className="flex-1 bg-pageBg">
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24 }}>
        <View className="mt-16 mb-12">
          <View className="w-12 h-12 bg-navy rounded-full items-center justify-center mb-6">
            <Text className="text-white text-xl font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>R</Text>
          </View>
          <Text className="text-[40px] text-navy leading-tight tracking-[-0.02em] mb-3" style={{ fontFamily: 'Cormorant_300Light' }}>
            Welcome to Rentified.
          </Text>
          <Text className="text-[17px] text-navy-muted leading-relaxed" style={{ fontFamily: 'DMSans_400Regular' }}>
            Before we set up your dashboard, how will you be using the platform?
          </Text>
        </View>

        <View>
          {/* Landlord Option */}
          <TouchableOpacity 
            onPress={() => router.push('/(onboarding)/landlord')}
            className="w-full bg-white rounded-[20px] p-6 border border-navy-border shadow-card mb-4"
          >
            <View className="flex-row items-center justify-between mb-4">
              <View className="w-12 h-12 rounded-[16px] bg-[#0A7A52]/10 items-center justify-center">
                <MaterialIcons name="apartment" size={24} color="#0A7A52" />
              </View>
              <MaterialIcons name="arrow-forward" size={20} color="rgba(15,28,40,0.3)" />
            </View>
            <Text className="text-[21px] text-navy mb-2" style={{ fontFamily: 'DMSans_700Bold' }}>
              Property Partner
            </Text>
            <Text className="text-[15px] text-navy-muted leading-relaxed" style={{ fontFamily: 'DMSans_400Regular' }}>
              Manage properties, collect rent, track maintenance, and oversee tenants.
            </Text>
          </TouchableOpacity>

          {/* Tenant Option */}
          <TouchableOpacity 
            onPress={() => router.push('/(onboarding)/tenant')}
            className="w-full bg-white rounded-[20px] p-6 border border-navy-border shadow-card"
          >
            <View className="flex-row items-center justify-between mb-4">
              <View className="w-12 h-12 rounded-[16px] bg-[#1D4ED8]/10 items-center justify-center">
                <MaterialIcons name="vpn-key" size={24} color="#1D4ED8" />
              </View>
              <MaterialIcons name="arrow-forward" size={20} color="rgba(15,28,40,0.3)" />
            </View>
            <Text className="text-[21px] text-navy mb-2" style={{ fontFamily: 'DMSans_700Bold' }}>
              Tenant
            </Text>
            <Text className="text-[15px] text-navy-muted leading-relaxed" style={{ fontFamily: 'DMSans_400Regular' }}>
              Pay rent, submit maintenance requests, and communicate with your landlord.
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
