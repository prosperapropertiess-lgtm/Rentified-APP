import React, { useEffect, useMemo } from 'react';
import { View, Animated } from 'react-native';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
}

export function Skeleton({ width = '100%', height = 20, borderRadius = 8, style }: SkeletonProps) {
  const opacity = useMemo(() => new Animated.Value(0.3), []);

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.8,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: 'rgba(15, 28, 40, 0.08)',
          opacity,
        },
        style,
      ]}
    />
  );
}

export function DashboardSkeleton() {
  return (
    <View className="flex-1 bg-pageBg p-6 pt-16">
      <View className="flex-row justify-between items-center mb-8">
        <Skeleton width={140} height={32} borderRadius={12} />
        <Skeleton width={36} height={36} borderRadius={18} />
      </View>

      <Skeleton width={200} height={44} borderRadius={12} style={{ marginBottom: 12 }} />
      <Skeleton width={260} height={20} borderRadius={8} style={{ marginBottom: 24 }} />

      <Skeleton width="100%" height={180} borderRadius={24} style={{ marginBottom: 20 }} />

      <View className="flex-row justify-between mb-6">
        <Skeleton width="31%" height={70} borderRadius={16} />
        <Skeleton width="31%" height={70} borderRadius={16} />
        <Skeleton width="31%" height={70} borderRadius={16} />
      </View>

      <View className="flex-row flex-wrap justify-between">
        <Skeleton width="48%" height={140} borderRadius={20} style={{ marginBottom: 16 }} />
        <Skeleton width="48%" height={140} borderRadius={20} style={{ marginBottom: 16 }} />
        <Skeleton width="48%" height={140} borderRadius={20} style={{ marginBottom: 16 }} />
        <Skeleton width="48%" height={140} borderRadius={20} style={{ marginBottom: 16 }} />
      </View>
    </View>
  );
}
