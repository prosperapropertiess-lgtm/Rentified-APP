import React, { useEffect, useMemo } from 'react';
import { View, Text, Image, Animated, StyleSheet } from 'react-native';

// Plays once over the app's real launch fonts/auth loading, then calls
// onFinish. Timings are fixed (not tied to data-readiness) so the brand
// moment always reads the same; _layout.tsx keeps this overlaid until
// BOTH the animation and the real app are ready, whichever is longer.
export default function AnimatedSplash({ onFinish }: { onFinish: () => void }) {
  const wordmark = useMemo(() => new Animated.Value(0), []);
  const wordmarkScale = useMemo(() => new Animated.Value(0.94), []);
  const tagline = useMemo(() => new Animated.Value(0), []);
  const taglineY = useMemo(() => new Animated.Value(8), []);
  const credit = useMemo(() => new Animated.Value(0), []);
  const overlay = useMemo(() => new Animated.Value(1), []);

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(wordmark, { toValue: 1, duration: 550, useNativeDriver: true }),
        Animated.timing(wordmarkScale, { toValue: 1, duration: 550, useNativeDriver: true }),
      ]),
      Animated.delay(150),
      Animated.parallel([
        Animated.timing(tagline, { toValue: 1, duration: 450, useNativeDriver: true }),
        Animated.timing(taglineY, { toValue: 0, duration: 450, useNativeDriver: true }),
      ]),
      Animated.delay(250),
      Animated.timing(credit, { toValue: 1, duration: 450, useNativeDriver: true }),
      Animated.delay(550),
      Animated.timing(overlay, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start(() => onFinish());
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: overlay }]} pointerEvents="none">
      <View style={styles.center}>
        <Animated.Text
          className="font-cormorant"
          style={[
            styles.wordmark,
            { opacity: wordmark, transform: [{ scale: wordmarkScale }] },
          ]}
        >
          Rentified
        </Animated.Text>

        <Animated.Text
          className="font-sansBold"
          style={[
            styles.tagline,
            { opacity: tagline, transform: [{ translateY: taglineY }] },
          ]}
        >
          A NEW WAY OF LANDLORDING
        </Animated.Text>
      </View>

      <Animated.View style={[styles.credit, { opacity: credit }]}>
        <Image
          source={require('../../assets/images/prospera-logo.png')}
          style={styles.creditLogo}
          resizeMode="contain"
        />
        <Text className="font-sans" style={styles.creditText}>by Prospera Properties</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#F7F5F2',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  center: {
    alignItems: 'center',
  },
  wordmark: {
    fontSize: 52,
    color: '#1F2F3A',
    letterSpacing: -0.5,
  },
  tagline: {
    marginTop: 10,
    fontSize: 11,
    letterSpacing: 2.5,
    color: '#8B2030',
  },
  credit: {
    position: 'absolute',
    bottom: 56,
    alignItems: 'center',
  },
  creditLogo: {
    width: 40,
    height: 40,
    marginBottom: 6,
  },
  creditText: {
    fontSize: 12,
    color: '#333333',
    opacity: 0.6,
  },
});
