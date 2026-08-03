import React from 'react';
import { View, Text } from 'react-native';
import { PaymentStatus } from '../app/(tabs)/payments';

type Props = {
  status: PaymentStatus;
};

export default function StatusChip({ status }: Props) {
  const isPaid = status === 'paid';
  const isOverdue = status === 'overdue';

  return (
    <View
      className={`px-3 py-1 rounded-full flex-row items-center border ${
        isPaid
          ? 'bg-emerald-500/10 border-emerald-500/30'
          : isOverdue
          ? 'bg-rose-500/10 border-rose-500/30'
          : 'bg-amber-500/10 border-amber-500/30'
      }`}
    >
      <View
        className={`w-2 h-2 rounded-full mr-1.5 ${
          isPaid ? 'bg-emerald-500' : isOverdue ? 'bg-rose-500' : 'bg-amber-500'
        }`}
      />
      <Text
        className={`text-[11px] font-bold uppercase ${
          isPaid ? 'text-emerald-700' : isOverdue ? 'text-rose-700' : 'text-amber-800'
        }`}
        style={{ fontFamily: 'DMSans_700Bold' }}
      >
        {isPaid ? 'Paid' : isOverdue ? 'Overdue' : 'Due Today'}
      </Text>
    </View>
  );
}
