import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Animated } from 'react-native';
import { money } from '../lib/format';

const CATEGORY_COLORS: Record<string, string> = {
  repairs: '#1F2F3A',
  utilities: '#8B2030',
  insurance: '#B8860B',
  taxes: '#6B7280',
  management: '#0E7490',
  other: '#94A3B8',
};

interface Props {
  expenses: { category: string | null; amount: number | string }[];
}

// Same hand-rolled Animated approach as MonthlyRevenueChart/IncomeExpenseBar
// — a stacked segmented bar showing where a property's expense dollars
// actually went, category by category, animating in on mount/focus.
export function ExpenseCategoryBar({ expenses }: Props) {
  const segments = useMemo(() => {
    const totals = new Map<string, number>();
    for (const e of expenses) {
      const cat = e.category ?? 'other';
      totals.set(cat, (totals.get(cat) ?? 0) + Number(e.amount));
    }
    const total = Array.from(totals.values()).reduce((s, v) => s + v, 0);
    return Array.from(totals.entries())
      .map(([category, amount]) => ({ category, amount, share: total > 0 ? amount / total : 0 }))
      .sort((a, b) => b.amount - a.amount);
  }, [expenses]);

  const total = segments.reduce((s, seg) => s + seg.amount, 0);
  const [anims] = useState(() => segments.map(() => new Animated.Value(0)));

  useEffect(() => {
    Animated.stagger(
      60,
      segments.map((seg, i) => Animated.spring(anims[i] ?? new Animated.Value(0), { toValue: seg.share, useNativeDriver: false, friction: 8, tension: 40 }))
    ).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments.map((s) => `${s.category}:${s.amount}`).join(',')]);

  if (total === 0) return null;

  return (
    <View className="bg-card rounded-2xl p-4 border border-navy-border shadow-sm mb-8">
      <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-4">Where expenses went</Text>

      <View className="h-3 rounded-full overflow-hidden flex-row bg-navy-border/30">
        {segments.map((seg, i) => (
          <Animated.View
            key={seg.category}
            style={{
              height: '100%',
              backgroundColor: CATEGORY_COLORS[seg.category] ?? CATEGORY_COLORS.other,
              width: (anims[i] ?? new Animated.Value(seg.share)).interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            }}
          />
        ))}
      </View>

      <View className="flex-row flex-wrap gap-x-4 gap-y-2 mt-4">
        {segments.map((seg) => (
          <View key={seg.category} className="flex-row items-center gap-1.5">
            <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: CATEGORY_COLORS[seg.category] ?? CATEGORY_COLORS.other }} />
            <Text className="text-navy font-sans text-[12px] capitalize">
              {seg.category} <Text className="text-navy-muted">${money(seg.amount)}</Text>
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
