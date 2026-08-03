import { Tabs } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { Feather } from '@expo/vector-icons';

export default function TabLayout() {
  const { role, isLoading } = useAuth();

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
      fontSize: 10,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    tabBarStyle: {
      backgroundColor: '#FFFFFF',
      borderTopColor: 'rgba(15, 28, 40, 0.08)',
      borderTopWidth: 1,
      height: 64,
      paddingTop: 8,
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
        
        {/* Hide landlord-only tabs */}
        <Tabs.Screen name="index" options={{ href: null }} />
        <Tabs.Screen name="properties" options={{ href: null }} />
        <Tabs.Screen name="tenants" options={{ href: null }} />
        <Tabs.Screen name="payments" options={{ href: null }} />
      </Tabs>
    );
  }

  // Default to Landlord
  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen name="index" options={{ title: 'Command', tabBarIcon: ({ color }) => <Feather name="grid" size={20} color={color} /> }} />
      <Tabs.Screen name="properties" options={{ title: 'Buildings', tabBarIcon: ({ color }) => <Feather name="home" size={20} color={color} /> }} />
      <Tabs.Screen name="tenants" options={{ title: 'Tenants', tabBarIcon: ({ color }) => <Feather name="users" size={20} color={color} /> }} />
      <Tabs.Screen name="payments" options={{ title: 'Financials', tabBarIcon: ({ color }) => <Feather name="dollar-sign" size={20} color={color} /> }} />
      <Tabs.Screen name="documents" options={{ title: 'Vault', tabBarIcon: ({ color }) => <Feather name="folder" size={20} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color }) => <Feather name="user" size={20} color={color} /> }} />
      
      {/* Hide tenant-specific tabs */}
      <Tabs.Screen name="tenant-home" options={{ href: null }} />
      <Tabs.Screen name="tenant-payments" options={{ href: null }} />
      <Tabs.Screen name="tenant-maintenance" options={{ href: null }} />
    </Tabs>
  );
}
