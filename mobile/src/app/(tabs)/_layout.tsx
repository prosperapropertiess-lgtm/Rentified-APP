import { Tabs } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { Feather } from '@expo/vector-icons';

export default function TabLayout() {
  const { role, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View className="flex-1 bg-surface justify-center items-center">
        <ActivityIndicator size="large" color="#0F766E" />
      </View>
    );
  }

  const screenOptions = {
    headerShown: false,
    tabBarActiveTintColor: '#0F766E', // Trust Teal
    tabBarInactiveTintColor: '#94a3b8',
    tabBarLabelStyle: {
      fontFamily: 'JosefinSans_700Bold',
      fontSize: 10,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    tabBarStyle: {
      backgroundColor: '#ffffff',
      borderTopColor: '#f1f5f9',
      borderTopWidth: 1,
      height: 60,
      paddingTop: 8,
    },
  } as any;

  if (role === 'tenant') {
    return (
      <Tabs screenOptions={screenOptions}>
        <Tabs.Screen name="tenant-home" options={{ title: 'Home', tabBarIcon: ({ color }) => <Feather name="home" size={20} color={color} /> }} />
        <Tabs.Screen name="tenant-payments" options={{ title: 'Pay', tabBarIcon: ({ color }) => <Feather name="credit-card" size={20} color={color} /> }} />
        <Tabs.Screen name="tenant-maintenance" options={{ title: 'Fix', tabBarIcon: ({ color }) => <Feather name="tool" size={20} color={color} /> }} />
        
        {/* Hide landlord tabs */}
        <Tabs.Screen name="index" options={{ href: null }} />
        <Tabs.Screen name="properties" options={{ href: null }} />
        <Tabs.Screen name="tenants" options={{ href: null }} />
        <Tabs.Screen name="payments" options={{ href: null }} />
        <Tabs.Screen name="profile" options={{ href: null }} />
      </Tabs>
    );
  }

  // Default to Landlord
  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen name="index" options={{ title: 'Dashboard', tabBarIcon: ({ color }) => <Feather name="grid" size={20} color={color} /> }} />
      <Tabs.Screen name="properties" options={{ title: 'Properties', tabBarIcon: ({ color }) => <Feather name="home" size={20} color={color} /> }} />
      <Tabs.Screen name="tenants" options={{ title: 'Tenants', tabBarIcon: ({ color }) => <Feather name="users" size={20} color={color} /> }} />
      <Tabs.Screen name="payments" options={{ title: 'Payments', tabBarIcon: ({ color }) => <Feather name="dollar-sign" size={20} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color }) => <Feather name="user" size={20} color={color} /> }} />
      
      {/* Hide tenant tabs */}
      <Tabs.Screen name="tenant-home" options={{ href: null }} />
      <Tabs.Screen name="tenant-payments" options={{ href: null }} />
      <Tabs.Screen name="tenant-maintenance" options={{ href: null }} />
    </Tabs>
  );
}
