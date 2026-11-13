import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMenu } from '../context/MenuContext';

/** Page title row used by every owner tab: menu button, title, optional action on the right. */
export default function ScreenHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const { open } = useMenu();
  return (
    <View style={{ paddingTop: insets.top + 12 }} className="px-6 pb-4 bg-pageBg">
      <View className="flex-row items-center justify-between mb-4">
        <TouchableOpacity onPress={open} hitSlop={10} className="w-11 h-11 rounded-full bg-card border border-navy/5 items-center justify-center shadow-sm">
          <Feather name="menu" size={19} color="#1F2F3A" />
        </TouchableOpacity>
        {right}
      </View>
      <Text className="text-navy font-sansBold text-[34px] tracking-tight">{title}</Text>
      {!!subtitle && <Text className="text-navy-muted font-sans text-[14px] mt-1 opacity-70">{subtitle}</Text>}
    </View>
  );
}
