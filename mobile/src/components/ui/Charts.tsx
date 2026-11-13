import React, { useEffect, useState } from 'react';
import { View, Text, Animated, Easing } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Progress ring that sweeps in from 0 to `value` (0–1). */
export function Ring({
  value, size = 120, stroke = 12, color = '#8B2030', track = 'rgba(31,47,58,0.08)', children,
}: { value: number; size?: number; stroke?: number; color?: string; track?: string; children?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const [anim] = useState(() => new Animated.Value(0));
  const target = Math.max(0, Math.min(1, value || 0));

  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, { toValue: target, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [anim, target]);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
          <AnimatedCircle
            cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
            strokeDasharray={`${c} ${c}`}
            strokeDashoffset={anim.interpolate({ inputRange: [0, 1], outputRange: [c, 0] })}
          />
        </G>
      </Svg>
      {children}
    </View>
  );
}

/** Donut split into coloured segments, drawn in sequence. */
export function Donut({
  segments, size = 140, stroke = 18, children,
}: { segments: { value: number; color: string }[]; size?: number; stroke?: number; children?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0);
  const [anim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 1200, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [anim, total]);

  let offset = 0;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(31,47,58,0.06)" strokeWidth={stroke} fill="none" />
          {total > 0 && segments.map((seg, i) => {
            const len = (Math.max(0, seg.value) / total) * c;
            const start = offset;
            offset += len;
            return (
              <AnimatedCircle
                key={i}
                cx={size / 2} cy={size / 2} r={r} stroke={seg.color} strokeWidth={stroke} fill="none"
                strokeDasharray={anim.interpolate({ inputRange: [0, 1], outputRange: [`0 ${c}`, `${Math.max(0, len - 2)} ${c}`] }) as any}
                strokeDashoffset={-start}
              />
            );
          })}
        </G>
      </Svg>
      {children}
    </View>
  );
}

/** Number that counts up to its value. */
export function CountUp({ value, prefix = '', suffix = '', decimals = 0, style, className }: {
  value: number; prefix?: string; suffix?: string; decimals?: number; style?: any; className?: string;
}) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const dur = 900;
    let raf: ReturnType<typeof requestAnimationFrame>;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / dur);
      setShown(value * (1 - Math.pow(1 - t, 3)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  const text = shown.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return <Text className={className} style={style}>{prefix}{text}{suffix}</Text>;
}

/** Horizontal bar that grows to `value` (0–1). */
export function GrowBar({ value, color = '#1F2F3A', height = 8, delay = 0 }: { value: number; color?: string; height?: number; delay?: number }) {
  const [anim] = useState(() => new Animated.Value(0));
  const target = Math.max(0, Math.min(1, value || 0));
  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, { toValue: target, duration: 900, delay, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [anim, target, delay]);
  return (
    <View style={{ height, borderRadius: height, backgroundColor: 'rgba(31,47,58,0.07)', overflow: 'hidden' }}>
      <Animated.View style={{ height, borderRadius: height, backgroundColor: color, width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
    </View>
  );
}

/** Small legend dot + label + value row. */
export function LegendRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between py-1.5">
      <View className="flex-row items-center flex-1 pr-2">
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color, marginRight: 8 }} />
        <Text className="text-navy-muted font-sans text-[13px]" numberOfLines={1}>{label}</Text>
      </View>
      <Text className="text-navy font-sansBold text-[13px]">{value}</Text>
    </View>
  );
}
