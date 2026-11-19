import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';
import { GestureDetector, usePanGesture, useSimultaneousGestures, useTapGesture } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import { cachedBook } from '../books/library';
import { CARD_BY_ID } from '../content';
import { TUNING, type FeedItem } from '../engine/engine';
import { fx } from '../feedback/sound';
import type { Theme } from '../theme';
import { DOCK_H, HUD_H, ItemView, surfaceOf } from './cards';
import { useApp, useEngineVersion } from './context';
import { Hud } from './Hud';
import { Overlays, type OverlayHandle } from './Overlays';

const SPRING = { damping: 22, stiffness: 240, mass: 0.9 };

function rubber(v: number, lo: number, hi: number) {
  'worklet';
  if (v < lo) return lo + (v - lo) * 0.3;
  if (v > hi) return hi + (v - hi) * 0.3;
  return v;
}

export function Feed({ onOpenMe, overlayRef }: { onOpenMe: () => void; overlayRef: React.RefObject<OverlayHandle | null> }) {
  const { engine, theme } = useApp();
  useEngineVersion(engine);
  const [size, setSize] = useState({ w: 1, h: 1 });
  const [cur, setCur] = useState(engine.cur);
  const [depths, setDepths] = useState<Record<string, number>>({});

  const pos = useSharedValue(engine.cur);
  const dpos = useSharedValue(0);
  const W = useSharedValue(1), H = useSharedValue(1);
  const curSV = useSharedValue(engine.cur);
  const maxDepth = useSharedValue(0);
  const axis = useSharedValue(0);
  const startV = useSharedValue(0);
  const stiff = useSharedValue(SPRING.stiffness);

  // dwell + interaction tracking for the live item
  const liveSince = useRef(Date.now());
  const wentDeeper = useRef(false);
  const visited = useRef(new Set<string>());
  const interacted = useRef(new Set<string>());
  const paneSince = useRef(Date.now());
  const depthRef = useRef<Record<string, number>>({});
  /** A bite counts as read once you move past it after a fair look (scaled to its length, 2.5–8 s). */
  const markBite = useCallback((it: FeedItem | undefined, depth: number) => {
    if (it?.kind !== 'read') return;
    const idx = it.start + depth;
    const text = cachedBook(it.bookId)?.bites[idx];
    if (!text) return;
    const need = Math.min(8000, Math.max(2500, (text.split(/\s+/).length * 60000) / 700));
    if (Date.now() - paneSince.current >= need) engine.readBite(it.bookId, idx);
  }, [engine]);
  markInteractedRef.current = (k: string) => interacted.current.add(k);

  const items = engine.items;
  const item = items[cur];
  const panes = paneIds(item);

  useEffect(() => { maxDepth.value = Math.max(0, panes.length - 1); }, [panes.length, maxDepth]);
  // "the feed gets slicker as the combo grows"
  useEffect(() => { stiff.value = SPRING.stiffness + Math.min(engine.combo, 10) * 14; }, [engine.combo, stiff]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: width, h: height });
    W.value = width; H.value = height;
  };

  /** Row change committed by a swipe or key press. */
  const commitRow = useCallback((target: number) => {
    const from = engine.cur;
    if (target === from) return;
    const leaving = engine.items[from];
    if (leaving) markBite(leaving, depthRef.current[leaving.key] ?? 0);
    if (leaving) {
      engine.exit(from, {
        dwellMs: Date.now() - liveSince.current,
        deeper: wentDeeper.current,
        interacted: interacted.current.has(leaving.key),
        revisit: visited.current.has(leaving.key) && leaving.kind === 'card',
      });
      visited.current.add(leaving.key);
    }
    engine.setCurrent(target);
    curSV.value = engine.cur;
    liveSince.current = Date.now();
    paneSince.current = Date.now();
    wentDeeper.current = false;
    dpos.value = 0;
    setCur(engine.cur);
    fx.both('tick', 'tick');
    const next = engine.items[engine.cur];
    if (next?.kind === 'card' && CARD_BY_ID[next.cardId]?.legendary && !visited.current.has(next.key)) setTimeout(() => fx.both('legend', 'heavy'), 220);
    overlayRef.current?.flush();
  }, [engine, curSV, dpos, overlayRef, markBite]);

  const commitDepth = useCallback((target: number) => {
    const it = engine.items[engine.cur];
    if (!it) return;
    const prev = depthRef.current[it.key] ?? 0;
    if (target > prev) markBite(it, prev);
    depthRef.current[it.key] = target;
    paneSince.current = Date.now();
    setDepths(d => (d[it.key] === target ? d : { ...d, [it.key]: target }));
    if (target > 0 && it.kind === 'card') { wentDeeper.current = true; engine.wentDeeper(it.cardId); }
    fx.both('tick', 'tick');
    overlayRef.current?.flush();
  }, [engine, overlayRef, markBite]);

  const doubleTap = useCallback(() => {
    const it = engine.items[engine.cur];
    if (!it || it.kind !== 'card') return;
    const id = paneIds(it)[Math.round(dpos.value)] ?? it.cardId;
    engine.like(id);
    interacted.current.add(it.key);
    overlayRef.current?.heart();
    fx.both('pop', 'success');
    overlayRef.current?.flush();
  }, [engine, dpos, overlayRef]);

  const pan = usePanGesture({
    minDistance: 12,
    onActivate: () => {
      'worklet';
      axis.value = 0; // decided on the first update: the activation event can report zero translation
    },
    onUpdate: e => {
      'worklet';
      if (axis.value === 0) {
        if (Math.max(Math.abs(e.translationX), Math.abs(e.translationY)) < 2) return;
        axis.value = Math.abs(e.translationY) >= Math.abs(e.translationX) ? 1 : 2;
        startV.value = axis.value === 1 ? pos.value : dpos.value;
      }
      if (axis.value === 1) pos.value = rubber(startV.value - e.translationY / H.value, 0, 1e9);
      else dpos.value = rubber(startV.value + e.translationX / W.value, 0, maxDepth.value);
    },
    onDeactivate: e => {
      'worklet';
      const cfg = { damping: SPRING.damping, stiffness: stiff.value, mass: SPRING.mass };
      if (axis.value === 1) {
        const base = curSV.value, off = pos.value - base, v = -e.velocityY / H.value;
        let t = base;
        if (v > 0.6 || (off > 0.18 && v > -0.3)) t = base + 1;
        else if (v < -0.6 || (off < -0.18 && v < 0.3)) t = base - 1;
        t = Math.max(0, t);
        pos.value = withSpring(t, { ...cfg, velocity: v });
        if (t !== base) scheduleOnRN(commitRow, t);
      } else if (axis.value === 2) {
        const base = Math.round(startV.value), off = dpos.value - base, v = e.velocityX / W.value;
        let t = base;
        if (v > 0.6 || (off > 0.18 && v > -0.3)) t = base + 1;
        else if (v < -0.6 || (off < -0.18 && v < 0.3)) t = base - 1;
        t = Math.max(0, Math.min(maxDepth.value, t));
        dpos.value = withSpring(t, { ...cfg, velocity: v });
        if (t !== base) scheduleOnRN(commitDepth, t);
      }
      axis.value = 0;
    },
  });
  const tap2 = useTapGesture({ numberOfTaps: 2, onActivate: () => { 'worklet'; scheduleOnRN(doubleTap); } });
  const gesture = useSimultaneousGestures(pan, tap2);

  /* keyboard + wheel on web, for previews */
  const go = useCallback((dRow: number, dDepth: number) => {
    if (dRow) {
      const t = Math.max(0, engine.cur + dRow);
      pos.value = withSpring(t, SPRING);
      commitRow(t);
    } else if (dDepth) {
      const it = engine.items[engine.cur];
      const max = paneIds(it).length - 1;
      const curD = Math.round(dpos.value);
      const t = Math.max(0, Math.min(max, curD + dDepth));
      if (t === curD) return;
      dpos.value = withSpring(t, SPRING);
      commitDepth(t);
    }
  }, [engine, pos, dpos, commitRow, commitDepth]);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'j') go(1, 0);
      else if (e.key === 'ArrowUp' || e.key === 'k') go(-1, 0);
      else if (e.key === 'ArrowRight' || e.key === 'l') go(0, 1);
      else if (e.key === 'ArrowLeft' || e.key === 'h') go(0, -1);
      else return;
      e.preventDefault();
    };
    let lock = 0;
    const onWheel = (e: WheelEvent) => {
      const now = Date.now();
      if (now < lock || Math.max(Math.abs(e.deltaX), Math.abs(e.deltaY)) < 14) return;
      lock = now + 550;
      if (Math.abs(e.deltaY) >= Math.abs(e.deltaX)) go(e.deltaY > 0 ? 1 : -1, 0); else go(0, e.deltaX < 0 ? 1 : -1);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('wheel', onWheel, { passive: true });
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('wheel', onWheel); };
  }, [go]);

  const surface = surfaceOf(item);
  const rows: number[] = [];
  for (let i = Math.max(0, cur - 1); i <= Math.min(items.length - 1, cur + 2); i++) rows.push(i);

  return (
    <View style={styles.fill} onLayout={onLayout}>
      <GestureDetector gesture={gesture}>
        <View style={[styles.fill, { backgroundColor: theme.bg(surface) }]} collapsable={false}>
          {rows.map(i => (
            <Row key={items[i].key} index={i} item={items[i]} pos={pos} dpos={dpos} isCur={i === cur}
              depth={depths[items[i].key] ?? 0} w={size.w} h={size.h} theme={theme} />
          ))}
        </View>
      </GestureDetector>
      <Hud surface={surface} item={item} depth={depths[item?.key ?? ''] ?? 0} panes={panes.length} onOpenMe={onOpenMe}
        onLike={() => { if (item?.kind === 'card') { const id = panes[depths[item.key] ?? 0] ?? item.cardId; const liked = engine.toggleLike(id); interacted.current.add(item.key); if (liked) { overlayRef.current?.heart(); fx.both('pop', 'success'); } overlayRef.current?.flush(); } }}
        onSave={() => { if (item?.kind === 'card') { const id = panes[depths[item.key] ?? 0] ?? item.cardId; const saved = engine.toggleSave(id); overlayRef.current?.toast(saved ? 'Saved. Find it under Me.' : 'Removed from saved'); fx.buzz('select'); } }}
        liked={item?.kind === 'card' && !!engine.s.cards[panes[depths[item.key] ?? 0] ?? item.cardId]?.liked}
        saved={item?.kind === 'card' && !!engine.s.cards[panes[depths[item.key] ?? 0] ?? item.cardId]?.saved} />
      <Overlays ref={overlayRef} theme={theme} surface={surface} />
    </View>
  );
}

/** Pane ids in a row: the card plus its deeper cards, or the run of book bites. */
function paneIds(item: FeedItem | undefined): string[] {
  if (item?.kind === 'read') {
    const total = cachedBook(item.bookId)?.bites.length ?? 0;
    const n = Math.max(1, Math.min(TUNING.readRow, total - item.start));
    return Array.from({ length: n }, (_, k) => `b${item.start + k}`);
  }
  if (!item || item.kind !== 'card') return [];
  const c = CARD_BY_ID[item.cardId];
  return [c.id, ...(c.deeper ?? [])];
}

/** Lets cards (via context) tell the live feed that the user engaged with an item. */
export const markInteractedRef: { current: (k: string) => void } = { current: () => {} };

function Row({ index, item, pos, dpos, isCur, depth, w, h, theme }: {
  index: number; item: FeedItem; pos: SharedValue<number>; dpos: SharedValue<number>; isCur: boolean; depth: number; w: number; h: number; theme: Theme;
}) {
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: (index - pos.value) * h }] }));
  const ids = paneIds(item);
  if (ids.length <= 1) {
    return (
      <Animated.View style={[StyleSheet.absoluteFill, style]}>
        <ItemView item={item} active={isCur} theme={theme} />
      </Animated.View>
    );
  }
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      {ids.map((id, k) => (
        <Pane key={id} k={k} dpos={dpos} isCur={isCur} depth={depth} w={w}>
          {item.kind === 'read'
            ? (Math.abs(k - depth) <= 1 ? <ItemView item={item} bite={item.start + k} active={isCur && depth === k} theme={theme} /> : null)
            : <ItemView item={k === 0 ? item : { key: `${item.key}:${id}`, kind: 'card', cardId: id }} active={isCur && depth === k} theme={theme} />}
        </Pane>
      ))}
    </Animated.View>
  );
}

function Pane({ k, dpos, isCur, depth, w, children }: { k: number; dpos: SharedValue<number>; isCur: boolean; depth: number; w: number; children: React.ReactNode }) {
  // Deeper cards sit to the left and slide in as you swipe right.
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: ((isCur ? dpos.value : depth) - k) * w }] }));
  return <Animated.View style={[StyleSheet.absoluteFill, style]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({ fill: { flex: 1, overflow: 'hidden' } });

export { HUD_H, DOCK_H };
