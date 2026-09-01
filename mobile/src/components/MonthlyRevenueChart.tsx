import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Animated } from 'react-native';
import { money } from '../lib/format';

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface Props {
  payments: { amount: number | string; paid_at: string | null }[];
}

// Uses UTC accessors — paid_at is a date-only value stored as UTC midnight,
// so bucketing by local month/year would misfile payments near month
// boundaries in timezones west of UTC (see lib/format.ts for the same fix
// applied to date display).
export function MonthlyRevenueChart({ payments }: Props) {
  const months = useMemo(() => {
    const now = new Date();
    const buckets: { key: string; label: string; total: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      buckets.push({ key: `${d.getUTCFullYear()}-${d.getUTCMonth()}`, label: MONTH_ABBR[d.getUTCMonth()], total: 0 });
    }
    const byKey = new Map(buckets.map((b) => [b.key, b]));
    for (const p of payments) {
      if (!p.paid_at) continue;
      const d = new Date(p.paid_at);
      const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
      const bucket = byKey.get(key);
      if (bucket) bucket.total += Number(p.amount);
    }
    return buckets;
  }, [payments]);

  const max = Math.max(1, ...months.map((m) => m.total));
  // useState (not useRef) for the stable Animated.Value array — the window
  // is always a fixed 6 months, so this never needs to be recreated, and
  // reading it during render (below, in the JSX map) is fine for state but
  // not for a ref's .current, which React's strict render-purity rules flag.
  const [anims] = useState(() => months.map(() => new Animated.Value(0)));

  useEffect(() => {
    Animated.stagger(
      70,
      anims.map((a, i) =>
        Animated.spring(a, { toValue: months[i].total / max, useNativeDriver: false, friction: 7, tension: 40 })
      )
    ).start();
    // Re-run whenever the underlying totals change, not just on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [months.map((m) => m.total).join(',')]);

  return (
    <View className="bg-card rounded-[24px] p-5 border border-navy-border shadow-sm mb-8">
      <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-5">Rent Collected — Last 6 Months</Text>
      <View className="flex-row items-end justify-between" style={{ height: 140 }}>
        {months.map((m, i) => (
          <View key={m.key} className="flex-1 items-center">
            {m.total > 0 && (
              <Text className="text-navy font-sansBold text-[11px] mb-1.5">${money(m.total).replace('.00', '')}</Text>
            )}
            <View className="w-full items-center justify-end" style={{ height: 96 }}>
              <Animated.View
                style={{
                  width: 22,
                  borderRadius: 8,
                  backgroundColor: i === months.length - 1 ? '#8B2030' : '#1F2F3A',
                  height: anims[i].interpolate({ inputRange: [0, 1], outputRange: ['4%', '100%'] }),
                  opacity: m.total > 0 ? 1 : 0.15,
                }}
              />
            </View>
            <Text className="text-navy-muted font-sans text-[11px] mt-2">{m.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
