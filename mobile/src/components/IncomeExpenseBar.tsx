import React, { useEffect, useState } from 'react';
import { View, Animated } from 'react-native';

interface Props {
  income: number;
  expenses: number;
}

// Same hand-rolled Animated approach as MonthlyRevenueChart (no charting
// library in this project) — a single split bar showing income vs expense
// share of a property's total cash movement, animating in on mount/focus.
export function IncomeExpenseBar({ income, expenses }: Props) {
  const total = income + expenses;
  const incomeShare = total > 0 ? income / total : 0.5;
  const [anim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    anim.setValue(0);
    Animated.spring(anim, { toValue: incomeShare, useNativeDriver: false, friction: 8, tension: 40 }).start();
    // Re-run whenever this property's underlying figures change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [income, expenses]);

  if (total === 0) {
    return <View className="h-2 rounded-full bg-navy-border/40 mt-3" />;
  }

  return (
    <View className="h-2 rounded-full overflow-hidden flex-row mt-3 bg-navy-border/30">
      <Animated.View
        style={{
          height: '100%',
          backgroundColor: '#059669',
          width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        }}
      />
      <View style={{ flex: 1, backgroundColor: '#8B2030' }} />
    </View>
  );
}
