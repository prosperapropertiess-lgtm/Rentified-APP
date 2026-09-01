import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function OwnerEntryScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 justify-center px-8 bg-pageBg">
      <TouchableOpacity onPress={() => router.back()} className="absolute top-16 left-8 w-9 h-9 rounded-full bg-card border border-navy-border items-center justify-center">
        <Feather name="chevron-left" size={20} color="#1F2F3A" />
      </TouchableOpacity>

      <View className="items-center mb-12">
        <Text className="text-3xl text-navy font-sansBold mb-2 text-center">Welcome, Property Partner</Text>
        <Text className="text-navy-muted font-sans text-base text-center">Are you setting up a new account, or do you already have one?</Text>
      </View>

      <View className="gap-4">
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={() => router.push('/(auth)/login?mode=signup')}
          className="bg-card rounded-[28px] p-6 flex-row items-center border border-navy-border shadow-sm"
        >
          <View className="w-16 h-16 bg-navy/5 rounded-2xl items-center justify-center mr-4">
            <Feather name="user-plus" size={26} color="#1F2F3A" />
          </View>
          <View className="flex-1">
            <Text className="text-navy text-xl font-sansBold" style={{ lineHeight: 26 }}>
              I&apos;m a new Property Partner
            </Text>
            <Text className="text-navy-muted font-sans text-sm mt-1">Set up your account and portfolio</Text>
          </View>
          <Feather name="chevron-right" size={22} color="#1F2F3A" style={{ opacity: 0.3 }} />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.75}
          onPress={() => router.push('/(auth)/pin-entry?role=owner')}
          className="bg-card rounded-[28px] p-6 flex-row items-center border border-navy-border shadow-sm"
        >
          <View className="w-16 h-16 bg-navy/5 rounded-2xl items-center justify-center mr-4">
            <Feather name="key" size={26} color="#1F2F3A" />
          </View>
          <View className="flex-1">
            <Text className="text-navy text-xl font-sansBold" style={{ lineHeight: 26 }}>
              I already have a PIN
            </Text>
            <Text className="text-navy-muted font-sans text-sm mt-1">Sign in to your existing account</Text>
          </View>
          <Feather name="chevron-right" size={22} color="#1F2F3A" style={{ opacity: 0.3 }} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
