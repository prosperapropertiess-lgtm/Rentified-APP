import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Animated, Easing, ScrollView, Pressable, Dimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';

type Item = { label: string; icon: keyof typeof Feather.glyphMap; href: string; hint?: string };

// Everything that isn't one of the five daily tabs lives here, grouped by job.
const SECTIONS: { title: string; items: Item[] }[] = [
  {
    title: 'Talk',
    items: [
      { label: 'Messages', icon: 'message-circle', href: '/messages', hint: 'Residents and your manager' },
      { label: 'Announcements', icon: 'volume-2', href: '/announcements', hint: 'Notices to residents' },
    ],
  },
  {
    title: 'Stay compliant',
    items: [
      { label: 'Legal & LTB', icon: 'file-text', href: '/(tabs)/ltb', hint: 'N4, N12 and other notices' },
      { label: 'Property health', icon: 'activity', href: '/property-health', hint: 'What needs attention' },
      { label: 'Lease renewals', icon: 'refresh-cw', href: '/lease-renewal' },
    ],
  },
  {
    title: 'Run the buildings',
    items: [
      { label: 'Rent collection', icon: 'send', href: '/rent-collection', hint: 'Reminders and history' },
      { label: 'Equipment', icon: 'cpu', href: '/assets', hint: 'Furnaces, water heaters, appliances' },
      { label: 'Improvements log', icon: 'trending-up', href: '/improvements' },
      { label: 'Contractors', icon: 'truck', href: '/contractor-dispatch' },
    ],
  },
  {
    title: 'Money',
    items: [
      { label: 'Tax export', icon: 'download', href: '/tax-export' },
      { label: 'Payouts', icon: 'credit-card', href: '/stripe-connect' },
    ],
  },
  {
    title: 'Account',
    items: [{ label: 'Profile & settings', icon: 'user', href: '/(tabs)/profile' }],
  },
];

export default function SideMenu({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isManager } = useAuth();
  const width = Math.min(340, Dimensions.get('window').width * 0.84);
  const [anim] = useState(() => new Animated.Value(0));
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    Animated.timing(anim, {
      toValue: visible ? 1 : 0, duration: visible ? 280 : 200,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic), useNativeDriver: true,
    }).start(({ finished }) => { if (finished && !visible) setMounted(false); });
  }, [visible, anim]);

  const go = (href: string) => {
    onClose();
    setTimeout(() => router.push(href as any), 120);
  };

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(15,28,40,0.45)', opacity: anim } as any}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>
      <Animated.View
        style={{
          position: 'absolute', top: 0, bottom: 0, left: 0, width,
          backgroundColor: '#F7F5F2', borderTopRightRadius: 28, borderBottomRightRadius: 28,
          transform: [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [-width, 0] }) }],
          shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 6, height: 0 },
        }}
      >
        <View style={{ paddingTop: insets.top + 18 }} className="px-6 pb-5 bg-navy" >
          <View className="flex-row items-center justify-between">
            <Text className="text-white font-cormorantRegular text-[30px]">Rentified</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10} className="w-9 h-9 rounded-full bg-white/10 items-center justify-center">
              <Feather name="x" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <Text className="text-white/50 font-sans text-[12px] mt-1">Managed by Prospera Properties</Text>
          {isManager && (
            <View className="self-start mt-3 px-2.5 py-1 rounded-full bg-burgundy">
              <Text className="text-white font-sansBold text-[10px] uppercase tracking-widest">Manager</Text>
            </View>
          )}
        </View>

        <ScrollView contentContainerStyle={{ paddingVertical: 12, paddingBottom: insets.bottom + 24 }}>
          {SECTIONS.map((section) => (
            <View key={section.title} className="px-4 mt-3">
              <Text className="text-navy-muted font-sansBold text-[10px] uppercase tracking-[2px] mb-1.5 px-2 opacity-60">{section.title}</Text>
              {section.items.map((item) => (
                <TouchableOpacity key={item.label} onPress={() => go(item.href)} className="flex-row items-center px-2 py-2.5 rounded-2xl active:bg-navy/5">
                  <View className="w-9 h-9 rounded-xl bg-card border border-navy/5 items-center justify-center mr-3">
                    <Feather name={item.icon} size={16} color="#1F2F3A" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-navy font-sansBold text-[15px]">{item.label}</Text>
                    {!!item.hint && <Text className="text-navy-muted font-sans text-[11px] opacity-60" numberOfLines={1}>{item.hint}</Text>}
                  </View>
                  <Feather name="chevron-right" size={16} color="#1F2F3A" style={{ opacity: 0.25 }} />
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}
