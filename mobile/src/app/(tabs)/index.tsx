import { View, Text, ScrollView } from 'react-native';

export default function DashboardScreen() {
  return (
    <ScrollView className="flex-1 bg-surface-dark px-4 pt-12">
      <Text className="text-3xl font-bold text-white mb-6">Dashboard</Text>
      
      <View className="bg-brand-500 rounded-xl p-6 mb-6">
        <Text className="text-white/80 text-sm font-medium mb-1">Total Rent Collected</Text>
        <Text className="text-white text-4xl font-bold tabular-nums">$14,500</Text>
        <Text className="text-white/80 text-xs mt-2">+2% from last month</Text>
      </View>

      <Text className="text-xl font-semibold text-white mb-4">Pending Tasks</Text>
      
      <View className="bg-white/5 border border-white/10 rounded-xl p-4 mb-3 flex-row items-center justify-between">
        <View>
          <Text className="text-white font-medium text-base">Leaky Faucet</Text>
          <Text className="text-secondary text-sm">Unit 4B • Reported 2h ago</Text>
        </View>
        <View className="bg-warning/20 px-3 py-1 rounded-full">
          <Text className="text-warning text-xs font-medium">Medium</Text>
        </View>
      </View>
      
      <View className="bg-white/5 border border-white/10 rounded-xl p-4 mb-3 flex-row items-center justify-between">
        <View>
          <Text className="text-white font-medium text-base">Overdue Rent</Text>
          <Text className="text-secondary text-sm">Unit 2A • Due 5 days ago</Text>
        </View>
        <View className="bg-critical/20 px-3 py-1 rounded-full">
          <Text className="text-critical text-xs font-medium">Action Required</Text>
        </View>
      </View>
    </ScrollView>
  );
}
