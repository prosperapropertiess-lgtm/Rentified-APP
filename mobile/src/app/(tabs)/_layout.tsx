import { Tabs } from 'expo-router';
import { View, Text, ActivityIndicator } from 'react-native';
import { useAuth } from '../../context/AuthContext';

function TabBarIcon({ name, color }: { name: string; color: any }) {
  return (
    <View className="items-center justify-center">
      <Text style={{ color, fontSize: 12 }}>{name}</Text>
    </View>
  );
}

export default function TabLayout() {
  const { role, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View className="flex-1 bg-surface justify-center items-center">
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  const screenOptions = {
    headerShown: false,
    tabBarActiveTintColor: '#4F46E5',
    tabBarInactiveTintColor: '#64748B',
    tabBarStyle: {
      backgroundColor: '#FAFAFA',
      borderTopColor: '#E2E8F0',
    },
  };

  if (role === 'tenant') {
    return (
      <Tabs screenOptions={screenOptions}>
        <Tabs.Screen name="tenant-home" options={{ title: 'My Lease', tabBarIcon: ({ color }) => <TabBarIcon name="Home" color={color} /> }} />
        <Tabs.Screen name="tenant-payments" options={{ title: 'Payments', tabBarIcon: ({ color }) => <TabBarIcon name="Pay" color={color} /> }} />
        <Tabs.Screen name="tenant-maintenance" options={{ title: 'Maintenance', tabBarIcon: ({ color }) => <TabBarIcon name="Fix" color={color} /> }} />
        
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
      <Tabs.Screen name="index" options={{ title: 'Dashboard', tabBarIcon: ({ color }) => <TabBarIcon name="Dash" color={color} /> }} />
      <Tabs.Screen name="properties" options={{ title: 'Properties', tabBarIcon: ({ color }) => <TabBarIcon name="Props" color={color} /> }} />
      <Tabs.Screen name="tenants" options={{ title: 'Tenants', tabBarIcon: ({ color }) => <TabBarIcon name="Tenants" color={color} /> }} />
      <Tabs.Screen name="payments" options={{ title: 'Payments', tabBarIcon: ({ color }) => <TabBarIcon name="Pay" color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color }) => <TabBarIcon name="Prof" color={color} /> }} />
      
      {/* Hide tenant tabs */}
      <Tabs.Screen name="tenant-home" options={{ href: null }} />
      <Tabs.Screen name="tenant-payments" options={{ href: null }} />
      <Tabs.Screen name="tenant-maintenance" options={{ href: null }} />
    </Tabs>
  );
}
