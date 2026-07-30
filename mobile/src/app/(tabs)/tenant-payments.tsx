import React from 'react';
import { View, Text } from 'react-native';

export default function TenantPaymentsScreen() {
  return (
    <View className="flex-1 bg-surface justify-center items-center">
      <Text className="text-2xl font-bold text-primary">Payments</Text>
      <Text className="text-secondary mt-2">Tenant payments scaffold</Text>
    </View>
  );
}
