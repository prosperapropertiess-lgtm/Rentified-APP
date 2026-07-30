import { Tabs } from 'expo-router';
import { View, Text } from 'react-native';

// Standard fallback if we want to use lucide-react-native later
function TabBarIcon({ name, color }: { name: string; color: any }) {
  // Placeholder since we haven't installed vector icons yet
  return (
    <View className="items-center justify-center">
      <Text style={{ color, fontSize: 12 }}>{name}</Text>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#4F46E5', // brand-500
        tabBarInactiveTintColor: '#64748B', // secondary
        tabBarStyle: {
          backgroundColor: '#FAFAFA', // surface
          borderTopColor: '#E2E8F0',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }: { color: any }) => <TabBarIcon name="Dash" color={color} />,
        }}
      />
      <Tabs.Screen
        name="properties"
        options={{
          title: 'Properties',
          tabBarIcon: ({ color }: { color: any }) => <TabBarIcon name="Props" color={color} />,
        }}
      />
      <Tabs.Screen
        name="tenants"
        options={{
          title: 'Tenants',
          tabBarIcon: ({ color }: { color: any }) => <TabBarIcon name="Tenants" color={color} />,
        }}
      />
      <Tabs.Screen
        name="payments"
        options={{
          title: 'Payments',
          tabBarIcon: ({ color }: { color: any }) => <TabBarIcon name="Pay" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }: { color: any }) => <TabBarIcon name="Prof" color={color} />,
        }}
      />
    </Tabs>
  );
}
