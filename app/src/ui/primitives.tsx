import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import type { SurfaceKind, Theme } from '../theme';

/* ---------- staggered reveal ---------- */

/**
 * Lines stay hidden while a card only peeks in, then slam in from the left once it
 * becomes the live card. After that they stay visible, so swiping back shows the full card.
 */
export function Rv({ i, active, theme, style, children }: { i: number; active: boolean; theme: Theme; style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  const p = useSharedValue(0);
  const shown = useRef(false);
  useEffect(() => {
    if (active && !shown.current) {
      shown.current = true;
      p.value = withDelay(i * 85 + 60, withSpring(1, { damping: 13, stiffness: 190, mass: 0.8 }));
    }
  }, [active, i, p]);
  const a = useAnimatedStyle(() => ({ opacity: p.value > 0.02 ? 1 : 0, transform: [{ translateX: (1 - p.value) * -30 }] }));
  return <Animated.View style={[style, a]}>{children}</Animated.View>;
}

/* ---------- rich text: *highlight* and $ equations ---------- */

export function Rich({ text, theme, surface, size, style }: { text: string; theme: Theme; surface: SurfaceKind; size: number; style?: StyleProp<TextStyle> }) {
  const ink = theme.ink(surface);
  if (text.startsWith('$ ')) {
    return (
      <Text style={[{ fontFamily: theme.eq, fontSize: size * 1.12, color: ink, lineHeight: size * 1.5 }, style]}>
        {text.slice(2)}
      </Text>
    );
  }
  const parts = text.split('*');
  return (
    <Text style={[{ fontFamily: theme.body, fontSize: size, color: ink, lineHeight: size * 1.38 }, style]}>
      {parts.map((seg, k) => (k % 2 === 1
        ? <Text key={k} style={{ backgroundColor: theme.accent(surface), color: theme.onAccent(surface), fontFamily: theme.label }}> {seg} </Text>
        : <Text key={k}>{seg}</Text>))}
    </Text>
  );
}

/* ---------- buttons ---------- */

export function Btn({ label, onPress, theme, surface, state = 'idle', style, sub, flex }: {
  label: string; onPress?: () => void; theme: Theme; surface: SurfaceKind;
  state?: 'idle' | 'selected' | 'right' | 'wrong' | 'dim'; style?: StyleProp<ViewStyle>; sub?: string; flex?: boolean;
}) {
  const ink = theme.ink(surface), acc = theme.accent(surface);
  const filled = state === 'selected' || state === 'right';
  const shake = useSharedValue(0);
  useEffect(() => {
    if (state === 'wrong') {
      shake.value = withSequenceShake();
    }
  }, [state, shake]);
  function withSequenceShake() {
    // a quick damped wobble
    return withSpring(0, { velocity: 900, damping: 6, stiffness: 400 });
  }
  const a = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));
  return (
    <Animated.View style={[flex && { flex: 1 }, a, state === 'dim' && { opacity: 0.35 }]}>
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        style={({ pressed }) => [
          styles.btn,
          { borderColor: filled ? acc : ink, borderWidth: theme.rule, backgroundColor: filled ? acc : 'transparent' },
          pressed && onPress && { backgroundColor: ink },
          style,
        ]}>
        {({ pressed }) => (
          <View>
            <Text style={{ fontFamily: theme.label, fontSize: 15, letterSpacing: -0.2, color: filled || (pressed && onPress) ? theme.onAccent(surface) : ink }}>
              {sub ? `${sub}  ` : ''}{label}
            </Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  btn: { minHeight: 48, paddingHorizontal: 14, paddingVertical: 11, justifyContent: 'center' },
});

/* ---------- slider (own gesture, wins over the feed swipe) ---------- */

export function Slider({ value, onChange, onStart, theme, surface, steps }: {
  value: number; onChange: (v: number) => void; onStart?: () => void; theme: Theme; surface: SurfaceKind; steps?: number;
}) {
  const [w, setW] = useState(1);
  const width = useRef(1);
  const snap = (v: number) => (steps ? Math.round(v * steps) / steps : v);
  const setFromX = (x: number) => onChange(snap(Math.max(0, Math.min(1, x / width.current))));
  const pan = usePanGesture({
    runOnJS: true,
    minDistance: 0,
    onBegin: e => { onStart?.(); setFromX(e.x); },
    onUpdate: e => setFromX(e.x),
  });
  const ink = theme.ink(surface), acc = theme.accent(surface);
  const thumb = 26;
  return (
    <GestureDetector gesture={pan}>
      <View
        onLayout={(e: LayoutChangeEvent) => { width.current = e.nativeEvent.layout.width; setW(e.nativeEvent.layout.width); }}
        style={{ height: 44, justifyContent: 'center' }}>
        <View style={{ height: 5, backgroundColor: ink }} />
        <View style={{ position: 'absolute', left: 0, width: Math.max(0, value * w), height: 5, backgroundColor: ink }} />
        <View style={{
          position: 'absolute', left: Math.max(0, Math.min(w - thumb, value * w - thumb / 2)), width: thumb, height: thumb,
          backgroundColor: ink, borderRadius: 0,
        }} />
      </View>
    </GestureDetector>
  );
}

/** Small uppercase label. */
export function Label({ children, theme, surface, style, color }: { children: React.ReactNode; theme: Theme; surface: SurfaceKind; style?: StyleProp<TextStyle>; color?: string }) {
  return (
    <Text style={[{ fontFamily: theme.label, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', color: color ?? theme.ink(surface) }, style]}>
      {children}
    </Text>
  );
}
