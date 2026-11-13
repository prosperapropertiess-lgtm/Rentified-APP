import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Animated, Easing, LayoutChangeEvent } from 'react-native';

/** Pill switcher with a sliding highlight. */
export default function Segmented<T extends string>({
  options, value, onChange,
}: { options: { value: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void }) {
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const [anim] = useState(() => new Animated.Value(index));

  useEffect(() => {
    Animated.timing(anim, { toValue: index, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [anim, index]);

  const seg = width / options.length;
  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width - 8)}
      className="flex-row bg-navy/5 rounded-2xl p-1"
    >
      {width > 0 && (
        <Animated.View
          style={{
            position: 'absolute', top: 4, bottom: 4, left: 4, width: seg, borderRadius: 14, backgroundColor: '#FFFFFF',
            shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
            transform: [{ translateX: anim.interpolate({ inputRange: [0, Math.max(1, options.length - 1)], outputRange: [0, seg * Math.max(1, options.length - 1)] }) }],
          }}
        />
      )}
      {options.map((o) => {
        const active = o.value === value;
        return (
          <TouchableOpacity key={o.value} onPress={() => onChange(o.value)} className="flex-1 py-2.5 items-center flex-row justify-center">
            <Text className="font-sansBold text-[13px]" style={{ color: active ? '#1F2F3A' : 'rgba(31,47,58,0.5)' }}>{o.label}</Text>
            {typeof o.count === 'number' && o.count > 0 && (
              <View className="ml-1.5 px-1.5 rounded-full" style={{ backgroundColor: active ? '#8B2030' : 'rgba(31,47,58,0.12)' }}>
                <Text className="font-sansBold text-[10px]" style={{ color: active ? '#FFFFFF' : '#1F2F3A' }}>{o.count}</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
