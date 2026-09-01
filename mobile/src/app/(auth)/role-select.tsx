import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function RoleSelectScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 justify-center px-8 bg-pageBg">
      <View className="items-center mb-16">
        <Image
          source={require('../../../assets/images/splash-icon.png')}
          style={{ width: 132, height: 132, marginBottom: 24 }}
          resizeMode="contain"
        />
        {/* Explicit lineHeight (not just fontSize) — Tailwind's text-5xl sets
            lineHeight equal to fontSize, which clips this bold font's
            ascenders (capital letters get cut off at the top on iOS). */}
        <Text
          className="text-navy"
          style={{ fontFamily: 'DMSans_700Bold', fontSize: 44, lineHeight: 56 }}
        >
          Rentified
        </Text>
        <Text className="text-xs text-navy-muted tracking-[3px] uppercase font-sansBold mt-1">
          by Prospera Properties
        </Text>
      </View>

      <View className="gap-4">
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={() => router.push('/(auth)/owner-entry')}
          className="bg-card rounded-[28px] p-6 flex-row items-center border border-navy-border shadow-sm"
        >
          <View className="w-16 h-16 bg-navy/5 rounded-2xl items-center justify-center mr-4">
            <Feather name="briefcase" size={26} color="#1F2F3A" />
          </View>
          <View className="flex-1">
            <Text className="text-navy text-xl font-sansBold" style={{ lineHeight: 26 }}>
              I&apos;m a Property Partner
            </Text>
            <Text className="text-navy-muted font-sans text-sm mt-1">Manage your portfolio</Text>
          </View>
          <Feather name="chevron-right" size={22} color="#1F2F3A" style={{ opacity: 0.3 }} />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.75}
          onPress={() => router.push('/(auth)/pin-entry?role=tenant')}
          className="bg-card rounded-[28px] p-6 flex-row items-center border border-navy-border shadow-sm"
        >
          <View className="w-16 h-16 bg-navy/5 rounded-2xl items-center justify-center mr-4">
            <Feather name="home" size={26} color="#1F2F3A" />
          </View>
          <View className="flex-1">
            <Text className="text-navy text-xl font-sansBold" style={{ lineHeight: 26 }}>
              I&apos;m a Resident
            </Text>
            <Text className="text-navy-muted font-sans text-sm mt-1">View your rental &amp; pay rent</Text>
          </View>
          <Feather name="chevron-right" size={22} color="#1F2F3A" style={{ opacity: 0.3 }} />
        </TouchableOpacity>
      </View>

      <Text className="text-navy-muted/50 font-sans text-xs text-center mt-12">
        Your landlord sets up your access — just pick your role and enter your PIN.
      </Text>
    </View>
  );
}
