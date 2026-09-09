import React, { useEffect, useRef } from 'react';
import { Animated, SafeAreaView, StyleSheet, View } from 'react-native';

export function Screen({ children }) {
  const drift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(drift, { toValue: 1, duration: 7000, useNativeDriver: true }),
      Animated.timing(drift, { toValue: 0, duration: 7000, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [drift]);
  return <SafeAreaView style={styles.screen}><Animated.View pointerEvents="none" style={[styles.orbOne, { transform: [{ translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [-25, 42] }) }, { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [0, 34] }) }] }]} /><Animated.View pointerEvents="none" style={[styles.orbTwo, { transform: [{ translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [25, -35] }) }] }]} />{children}</SafeAreaView>;
}

export function GlassCard({ children, style }) { return <View style={[styles.card, style]}>{children}</View>; }

export const theme = { bg: '#07111f', text: '#eef4ff', muted: '#9aa9c5', cyan: '#8ce7fa', indigo: '#8177ff', line: 'rgba(192,210,255,0.16)' };

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  orbOne: { position: 'absolute', width: 250, height: 250, borderRadius: 125, backgroundColor: 'rgba(91, 106, 255, 0.26)', top: -95, left: -80 },
  orbTwo: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(41, 210, 181, 0.16)', right: -70, top: 190 },
  card: { marginHorizontal: 20, padding: 18, borderRadius: 24, backgroundColor: 'rgba(20, 34, 57, 0.82)', borderWidth: 1, borderColor: theme.line, shadowColor: '#000', shadowOpacity: 0.28, shadowOffset: { width: 0, height: 16 }, shadowRadius: 28, elevation: 8 },
});
