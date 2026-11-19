import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, FadeOutUp, SlideInDown, ZoomIn } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import type { Effect } from '../engine/engine';
import { fx } from '../feedback/sound';
import type { SurfaceKind, Theme } from '../theme';
import { HUD_H } from './cards';
import { useApp } from './context';

export interface OverlayHandle { flush: () => void; heart: () => void; toast: (t: string) => void }

type Pop =
  | { id: number; kind: 'xp'; text: string; big: boolean }
  | { id: number; kind: 'banner'; text: string; sub?: string; tone: 'gold' | 'ink' | 'warn' }
  | { id: number; kind: 'heart' }
  | { id: number; kind: 'toast'; text: string };
type PopInput = Pop extends infer P ? (P extends Pop ? Omit<P, 'id'> : never) : never;

export const Overlays = forwardRef<OverlayHandle, { theme: Theme; surface: SurfaceKind }>(function Overlays({ theme, surface }, ref) {
  const { engine } = useApp();
  const [pops, setPops] = useState<Pop[]>([]);
  const seq = useRef(0);

  const add = useCallback((p: PopInput, ms: number) => {
    const id = ++seq.current;
    setPops(ps => [...ps.filter(x => !(p.kind === 'toast' && x.kind === 'toast')), { ...p, id } as Pop]);
    setTimeout(() => setPops(ps => ps.filter(x => x.id !== id)), ms);
  }, []);

  const show = useCallback((e: Effect) => {
    switch (e.type) {
      case 'xp':
        add({ kind: 'xp', text: `${e.amount > 0 ? '+' : '−'}${Math.abs(e.amount)} XP${e.label ? ` · ${e.label}` : ''}${e.crit ? ` · ×${e.crit} CRIT` : ''}`, big: !!e.crit || Math.abs(e.amount) >= 25 }, 1300);
        if (e.crit) fx.both('combo', 'heavy');
        break;
      case 'combo':
        add({ kind: 'banner', text: e.name, sub: `Combo ×${engine.combo} · XP ×${engine.comboTier?.mult ?? 1}`, tone: 'gold' }, 1400);
        fx.both('combo', 'heavy');
        break;
      case 'comboBreak':
        add({ kind: 'banner', text: 'COMBO LOST', sub: `×${e.lost} gone. Fast skips break it.`, tone: 'warn' }, 1300);
        fx.both('nope', 'fail');
        break;
      case 'shield':
        add({ kind: 'toast', text: 'Combo shield used. Your combo survives.' }, 2000);
        break;
      case 'level':
        add({ kind: 'banner', text: `LEVEL ${e.level}`, sub: 'Unlocked', tone: 'gold' }, 1700);
        fx.both('level', 'heavy');
        break;
      case 'goal':
        add({ kind: 'banner', text: 'DAILY GOAL', sub: `Streak ${engine.s.streak.count} · bonus round on`, tone: 'gold' }, 1800);
        fx.both('level', 'success');
        break;
      case 'toast':
        add({ kind: 'toast', text: e.text }, 2400);
        break;
    }
  }, [add, engine]);

  useImperativeHandle(ref, () => ({
    flush: () => engine.drainEffects().forEach(show),
    heart: () => add({ kind: 'heart' }, 700),
    toast: (t: string) => add({ kind: 'toast', text: t }, 2000),
  }), [engine, show, add]);

  const ink = theme.ink(surface);
  const xps = pops.filter(p => p.kind === 'xp');
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={{ position: 'absolute', right: 20, top: HUD_H - 30, alignItems: 'flex-end', gap: 4 }}>
        {xps.map(p => p.kind === 'xp' && (
          <Animated.Text key={p.id} entering={SlideInDown.springify().damping(14)} exiting={FadeOutUp.duration(400)}
            style={{ fontFamily: theme.label, fontSize: p.big ? 18 : 14, color: p.big ? theme.bg(surface) : ink, backgroundColor: p.big ? ink : 'transparent', paddingHorizontal: p.big ? 6 : 0 }}>
            {p.text}
          </Animated.Text>
        ))}
      </View>
      {pops.map(p => {
        if (p.kind === 'banner') {
          const bg = p.tone === 'gold' ? theme.gold : p.tone === 'warn' ? '#0A0A0A' : ink;
          const fg = p.tone === 'warn' ? '#FF4F1A' : '#0A0A0A';
          return (
            <Animated.View key={p.id} entering={ZoomIn.springify().damping(9).stiffness(220)} exiting={FadeOut.duration(250)}
              style={[styles.center]}>
              <View style={{ backgroundColor: bg, paddingHorizontal: 18, paddingVertical: 12, transform: [{ rotate: '-4deg' }] }}>
                <Text style={{ fontFamily: theme.display, fontSize: 56, lineHeight: 56, letterSpacing: theme.hookTracking, color: fg, textAlign: 'center' }}>{p.text}</Text>
                {p.sub && <Text style={{ fontFamily: theme.label, fontSize: 13, color: fg, textAlign: 'center', marginTop: 4 }}>{p.sub}</Text>}
              </View>
            </Animated.View>
          );
        }
        if (p.kind === 'heart') {
          return (
            <Animated.View key={p.id} entering={ZoomIn.springify().damping(6)} exiting={FadeOut.duration(300)} style={styles.center}>
              <Svg width={140} height={140} viewBox="0 0 24 24">
                <Path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z" fill={ink} />
              </Svg>
            </Animated.View>
          );
        }
        if (p.kind === 'toast') {
          return (
            <Animated.View key={p.id} entering={FadeIn.duration(180)} exiting={FadeOut.duration(200)}
              style={{ position: 'absolute', left: 20, right: 20, top: HUD_H + 2, alignItems: 'flex-start' }}>
              <Text style={{ fontFamily: theme.label, fontSize: 13, color: theme.bg(surface), backgroundColor: ink, paddingHorizontal: 12, paddingVertical: 8, overflow: 'hidden' }}>{p.text}</Text>
            </Animated.View>
          );
        }
        return null;
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
});
