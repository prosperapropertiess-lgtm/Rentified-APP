import { Tabs } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { Feather } from '@expo/vector-icons';

export default function TabLayout() {
  const { role, isLoading } = useAuth();
  // A fixed tabBarStyle.height overrides React Navigation's default
  // safe-area handling, so the bottom inset (home indicator) has to be
  // added back manually or labels get clipped under it.
  const insets = useSafeAreaInsets();

  if (isLoading) {
    return (
      <View className="flex-1 bg-pageBg justify-center items-center">
        <ActivityIndicator size="large" color="#0F1C28" />
      </View>
    );
  }

  const screenOptions = {
    headerShown: false,
    tabBarActiveTintColor: '#0F1C28', // Deep Obsidian Navy
    tabBarInactiveTintColor: '#94A3B8',
    tabBarLabelStyle: {
      fontFamily: 'DMSans_700Bold',
      fontSize: 9,
      textTransform: 'uppercase',
      letterSpacing: 0.2,
      marginBottom: 4,
    },
    tabBarStyle: {
      backgroundColor: '#FFFFFF',
      borderTopColor: 'rgba(15, 28, 40, 0.08)',
      borderTopWidth: 1,
      height: 64 + insets.bottom,
      paddingTop: 8,
      paddingBottom: insets.bottom,
    },
  } as any;

  if (role === 'tenant') {
    return (
      <Tabs screenOptions={screenOptions}>
        <Tabs.Screen name="tenant-home" options={{ title: 'Home', tabBarIcon: ({ color }) => <Feather name="home" size={20} color={color} /> }} />
        <Tabs.Screen name="tenant-payments" options={{ title: 'Rent', tabBarIcon: ({ color }) => <Feather name="credit-card" size={20} color={color} /> }} />
        <Tabs.Screen name="tenant-maintenance" options={{ title: 'Repair', tabBarIcon: ({ color }) => <Feather name="tool" size={20} color={color} /> }} />
        <Tabs.Screen name="documents" options={{ title: 'Docs', tabBarIcon: ({ color }) => <Feather name="folder" size={20} color={color} /> }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color }) => <Feather name="user" size={20} color={color} /> }} />
        
        {/* Hide owner-only tabs */}
        <Tabs.Screen name="index" options={{ href: null }} />
        <Tabs.Screen name="properties" options={{ href: null }} />
        <Tabs.Screen name="tenants" options={{ href: null }} />
        <Tabs.Screen name="payments" options={{ href: null }} />
        <Tabs.Screen name="maintenance" options={{ href: null }} />
        <Tabs.Screen name="property/[id]" options={{ href: null }} />
        <Tabs.Screen name="ltb/index" options={{ href: null }} />
        <Tabs.Screen name="ltb/create" options={{ href: null }} />
        <Tabs.Screen name="ltb/n4-new" options={{ href: null }} />
        <Tabs.Screen name="ltb/n5-new" options={{ href: null }} />
        <Tabs.Screen name="ltb/n1-new" options={{ href: null }} />
        <Tabs.Screen name="ltb/n8-new" options={{ href: null }} />
        <Tabs.Screen name="ltb/n12-new" options={{ href: null }} />
        <Tabs.Screen name="ltb/n13-new" options={{ href: null }} />
        <Tabs.Screen name="ltb/n6-new" options={{ href: null }} />
        <Tabs.Screen name="ltb/n7-new" options={{ href: null }} />
        <Tabs.Screen name="ltb/n11-new" options={{ href: null }} />
        <Tabs.Screen name="ltb/application-new" options={{ href: null }} />
        <Tabs.Screen name="ltb/notice/[id]" options={{ href: null }} />

        {/* Reachable but not tab-bar items — kept as Tabs children so the bar stays visible */}
        <Tabs.Screen name="messages" options={{ href: null }} />
      </Tabs>
    );
  }

  // Default to Owner
  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen name="index" options={{ title: 'Command', tabBarIcon: ({ color }) => <Feather name="grid" size={20} color={color} /> }} />
      <Tabs.Screen name="properties" options={{ title: 'Buildings', tabBarIcon: ({ color }) => <Feather name="home" size={20} color={color} /> }} />
      <Tabs.Screen name="tenants" options={{ title: 'Residents', tabBarIcon: ({ color }) => <Feather name="users" size={20} color={color} /> }} />
      <Tabs.Screen name="payments" options={{ title: 'Money', tabBarIcon: ({ color }) => <Feather name="dollar-sign" size={20} color={color} /> }} />
      <Tabs.Screen name="property-health" options={{ title: 'Health', tabBarIcon: ({ color }) => <Feather name="activity" size={20} color={color} /> }} />
      <Tabs.Screen name="ltb/index" options={{ title: 'Legal', tabBarIcon: ({ color }) => <Feather name="file-text" size={20} color={color} /> }} />

      {/* Notices & LTB sub-screens — reachable but not their own tab slot */}
      <Tabs.Screen name="ltb/create" options={{ href: null }} />
      <Tabs.Screen name="ltb/n4-new" options={{ href: null }} />
      <Tabs.Screen name="ltb/n5-new" options={{ href: null }} />
      <Tabs.Screen name="ltb/n1-new" options={{ href: null }} />
      <Tabs.Screen name="ltb/n8-new" options={{ href: null }} />
      <Tabs.Screen name="ltb/n12-new" options={{ href: null }} />
      <Tabs.Screen name="ltb/n13-new" options={{ href: null }} />
      <Tabs.Screen name="ltb/n6-new" options={{ href: null }} />
      <Tabs.Screen name="ltb/n7-new" options={{ href: null }} />
      <Tabs.Screen name="ltb/n11-new" options={{ href: null }} />
      <Tabs.Screen name="ltb/application-new" options={{ href: null }} />
      <Tabs.Screen name="ltb/notice/[id]" options={{ href: null }} />

      {/* Profile moved to a header icon (next to the bell on the dashboard)
          instead of taking a tab slot — reachable via router.push, still
          needs to be a Tabs child so the bar stays visible when open.
          Repairs merged into Health — maintenance.tsx is still reachable
          from the dashboard "Requests" card and Health's "Manage" link. */}
      <Tabs.Screen name="maintenance" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="documents" options={{ href: null }} />
      <Tabs.Screen name="rent-collection" options={{ href: null }} />
      <Tabs.Screen name="reminder-history/[leaseId]" options={{ href: null }} />
      <Tabs.Screen name="assets/index" options={{ href: null }} />
      <Tabs.Screen name="assets/new" options={{ href: null }} />
      <Tabs.Screen name="assets/[id]" options={{ href: null }} />
      <Tabs.Screen name="improvements/index" options={{ href: null }} />
      <Tabs.Screen name="announcements" options={{ href: null }} />
      <Tabs.Screen name="test-lab" options={{ href: null }} />

      {/* Hide tenant-specific tabs */}
      <Tabs.Screen name="tenant-home" options={{ href: null }} />
      <Tabs.Screen name="tenant-payments" options={{ href: null }} />
      <Tabs.Screen name="tenant-maintenance" options={{ href: null }} />

      {/* Reachable but not tab-bar items — kept as Tabs children so the bar stays visible */}
      <Tabs.Screen name="messages" options={{ href: null }} />
      <Tabs.Screen name="property/[id]" options={{ href: null }} />
    </Tabs>
  );
}
