import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Ellipse, G, Path, Rect, Text as SvgText } from 'react-native-svg';
import { CARD_BY_ID, CHAINS, CHAIN_LENGTH, COURSES, courseOf } from '../content';
import type { Card } from '../content/types';
import type { FeedItem, Prize } from '../engine/engine';
import { fx } from '../feedback/sound';
import { SUBJECT_NAME, type SurfaceKind, type Theme } from '../theme';
import { useApp } from './context';
import { Btn, Label, Rich, Rv } from './primitives';
import { WidgetView } from './widgets';

export const HUD_H = 74;
export const DOCK_H = 64;

const FORMAT_LABEL: Record<Card['format'], string> = {
  hook: 'Hook', explain: 'Explainer', story: 'Story', reallife: 'Real life', quiz: 'Quiz', predict: 'Predict',
  myth: 'Myth or fact', meme: 'Meme', interactive: 'Interactive',
};
const LEVEL_LABEL = ['', 'UG1', 'UG2', 'UG3', 'MSc'];

/* ---------------- frame shared by every card ---------------- */

function Frame({ surface, theme, legendary, children }: { surface: SurfaceKind; theme: Theme; legendary?: boolean; children: React.ReactNode }) {
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.bg(surface) }]}>
      {legendary && <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderWidth: 10, borderColor: theme.gold }]} />}
      <View style={[styles.inner, { paddingTop: HUD_H + 6, paddingBottom: DOCK_H + 8 }]}>{children}</View>
    </View>
  );
}

function Eyebrow({ card, theme, rerun }: { card: Card; theme: Theme; rerun?: boolean }) {
  const s = card.subject;
  const course = courseOf(card);
  const chain = card.chain ? CHAINS[card.chain] : undefined;
  const left = course ? `${COURSES.find(c => c.id === course)?.short} · ${FORMAT_LABEL[card.format]}` : `${SUBJECT_NAME[s]} · ${FORMAT_LABEL[card.format]}`;
  const lvl = chain && chain.level > 0 ? LEVEL_LABEL[chain.level] : '';
  const right = [rerun ? 'Rerun' : '', lvl, card.chain ? `${card.order}/${CHAIN_LENGTH[card.chain]}` : card.depthOnly ? 'Deeper' : ''].filter(Boolean).join('  ');
  const color = theme.ink(s);
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8 }}>
      <Label theme={theme} surface={s} color={color} style={{ flexShrink: 1 }}>{left}</Label>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {card.legendary && <Stamp theme={theme} />}
        <Label theme={theme} surface={s} color={theme.muted(s)}>{right}</Label>
      </View>
    </View>
  );
}

function Cliff({ text, theme, surface, active, i, deeper }: { text: string; theme: Theme; surface: SurfaceKind; active: boolean; i: number; deeper?: boolean }) {
  const arrow = deeper ? '→' : '↑';
  return (
    <Rv i={i} active={active} theme={theme} style={{ marginTop: 'auto' }}>
      <View style={{ borderTopWidth: 3, borderColor: theme.ink(surface), paddingTop: 10, flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
        <Text style={{ flex: 1, fontFamily: theme.label, fontSize: 16, lineHeight: 20, color: theme.ink(surface), letterSpacing: -0.2 }}>
          {text}
        </Text>
        {<Text style={{ fontFamily: theme.display, fontSize: 24, lineHeight: 24, color: theme.ink(surface) }}>{arrow}</Text>}
      </View>
    </Rv>
  );
}

function Title({ text, theme, surface, size = 'title' }: { text: string; theme: Theme; surface: SurfaceKind; size?: 'hook' | 'title' | 'small' }) {
  const fs = size === 'hook' ? ((text.length < 14 ? 92 : text.length < 34 ? 58 : 44))
    : size === 'small' ? (28) : ((text.length > 90 ? 28 : text.length > 55 ? 33 : 40));
  return (
    <Text style={{
      fontFamily: size === 'hook' ? theme.display : theme.heavy, fontSize: fs, lineHeight: fs * (0.95),
      letterSpacing: size === 'hook' ? theme.hookTracking : theme.titleTracking,
      color: theme.ink(surface),
    }}>
      {text}
    </Text>
  );
}

function Lines({ lines, theme, surface, active, start = 1, size = 17 }: { lines?: string[]; theme: Theme; surface: SurfaceKind; active: boolean; start?: number; size?: number }) {
  if (!lines?.length) return null;
  return (
    <View style={{ gap: 9, marginTop: 14 }}>
      {lines.map((l, k) => (
        <Rv key={k} i={start + k} active={active} theme={theme}>
          <Rich text={l} theme={theme} surface={surface} size={size} />
        </Rv>
      ))}
    </View>
  );
}

function Stamp({ theme }: { theme: Theme }) {
  return (
    <View style={{ backgroundColor: theme.gold, paddingHorizontal: 6, paddingVertical: 2 }}>
      <Text style={{ fontFamily: theme.label, fontSize: 11, letterSpacing: 1.2, color: '#0A0A0A' }}>
        {'★ LEGENDARY'}
      </Text>
    </View>
  );
}

/* ---------------- card renderers ---------------- */

interface CardProps { card: Card; item: FeedItem; active: boolean; theme: Theme }

function TextCard({ card, item, active, theme }: CardProps) {
  const s = card.subject;
  return (
    <>
      <Eyebrow card={card} theme={theme} rerun={item.kind === 'card' && item.rerun} />
      <View style={card.format === 'hook' ? { marginTop: 'auto', marginBottom: 'auto' } : undefined}>
        <Title text={card.title} theme={theme} surface={s} size={card.format === 'hook' ? 'hook' : 'title'} />
        <Lines lines={card.lines} theme={theme} surface={s} active={active} size={card.format === 'hook' ? 19 : 17} />
      </View>
      <Cliff text={card.cliff} theme={theme} surface={s} active={active} i={(card.lines?.length ?? 0) + 2} deeper={!!card.deeper?.length} />
    </>
  );
}

function AnswerCard({ card, item, active, theme }: CardProps) {
  const { engine, markInteracted } = useApp();
  const s = card.subject;
  const [picked, setPicked] = useState<number | null>(null);
  const [bet, setBet] = useState(25);
  const [result, setResult] = useState<{ xp: number; crit: number } | null>(null);
  const [revealed, setRevealed] = useState(card.format !== 'predict' || card.scene !== 'moon');
  const isMyth = card.format === 'myth';
  const options = isMyth ? ['Myth', 'Fact'] : card.options ?? [];
  const correctIdx = isMyth ? (card.truth ? 1 : 0) : card.answer ?? 0;

  function choose(i: number) {
    if (picked !== null) return;
    setPicked(i);
    markInteracted(item.key);
    const ok = i === correctIdx;
    fx.both(ok ? 'pop' : 'nope', ok ? 'success' : 'fail');
    const r = engine.answer(card.id, ok, card.format === 'predict' ? bet : undefined);
    setResult(r);
    if (card.scene === 'moon') setTimeout(() => setRevealed(true), 1500);
  }
  const done = picked !== null;
  const ok = picked === correctIdx;
  const verdict = !done ? '' : card.format === 'predict'
    ? ok ? `Called it. +${result?.xp ?? bet} XP${(result?.crit ?? 1) > 1 ? `  ×${result?.crit} CRIT` : ''}` : `Nope. −${bet} XP.`
    : isMyth ? `${card.truth ? 'Fact' : 'Myth'}.${ok ? ` +${result?.xp ?? 10} XP` : ''}`
    : ok ? `Correct. +${result?.xp ?? 15} XP${(result?.crit ?? 1) > 1 ? `  ×${result?.crit} CRIT` : ''}` : `Not quite: ${options[correctIdx]}.`;

  return (
    <>
      <Eyebrow card={card} theme={theme} rerun={item.kind === 'card' && item.rerun} />
      <Title text={card.title} theme={theme} surface={s} size={card.title.length > 110 ? 'small' : 'title'} />
      {card.scene === 'moon' && <Moon theme={theme} surface={s} dropping={done} />}
      {!done && card.format === 'predict' && (
        <Rv i={1} active={active} theme={theme} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
          <Label theme={theme} surface={s} color={theme.muted(s)}>Bet</Label>
          {[10, 25, 50].map(b => (
            <Btn key={b} label={String(b)} theme={theme} surface={s} state={bet === b ? 'selected' : 'idle'} style={{ minHeight: 38, paddingVertical: 6, minWidth: 50, alignItems: 'center' }}
              onPress={() => { setBet(b); fx.buzz('select'); fx.play('tick'); markInteracted(item.key); }} />
          ))}
          <Label theme={theme} surface={s} color={theme.muted(s)}>XP</Label>
        </Rv>
      )}
      <Rv i={2} active={active} theme={theme} style={{ marginTop: 12, gap: 8, flexDirection: isMyth || (options.length === 3 && options.every(o => o.length < 12)) ? 'row' : 'column' }}>
        {options.map((o, i) => (
          <Btn key={i} label={o} theme={theme} surface={s} flex={isMyth || (options.length === 3 && options.every(x => x.length < 12))}
            sub={isMyth || options.length <= 3 && options.every(x => x.length < 12) ? undefined : String.fromCharCode(65 + i)}
            state={!done ? 'idle' : i === correctIdx ? 'right' : i === picked ? 'wrong' : 'dim'}
            onPress={done ? undefined : () => choose(i)} />
        ))}
      </Rv>
      {done && revealed && (
        <View style={{ marginTop: 12 }}>
          <Text style={{ fontFamily: theme.heavy, fontSize: 26, letterSpacing: theme.titleTracking / 2, color: theme.ink(s) }}>{verdict}</Text>
          {card.format === 'predict' && !ok && bet === 50 && (
            <Text style={{ fontFamily: theme.label, fontSize: 13, color: theme.ink(s), marginTop: 4 }}>High-confidence miss: this is the one you will remember.</Text>
          )}
          <Lines lines={card.reveal} theme={theme} surface={s} active={done} start={0} size={16} />
        </View>
      )}
      <Cliff text={card.cliff} theme={theme} surface={s} active={active} i={4} deeper={!!card.deeper?.length} />
    </>
  );
}

function Moon({ theme, surface, dropping }: { theme: Theme; surface: SurfaceKind; dropping: boolean }) {
  const [y, setY] = useState(0);
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!dropping) return;
    const T = 1.405, start = Date.now();
    let raf = 0;
    const step = () => {
      const s = Math.min(T, (Date.now() - start) / 1000);
      setT(s); setY(72 * (s / T) * (s / T));
      if (s < T) raf = requestAnimationFrame(step);
      else fx.both('thud', 'heavy');
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [dropping]);
  const ink = theme.ink(surface), acc = theme.accent(surface), muted = theme.muted(surface);
  return (
    <Svg viewBox="0 0 320 150" style={{ width: '100%', aspectRatio: 320 / 150, maxHeight: 150, marginTop: 8 }}>
      <Path d="M0 136 Q 80 131 160 135 T 320 134 V150 H0Z" fill={muted} fillOpacity={0.25} stroke={ink} strokeWidth={1.5} />
      <Ellipse cx={58} cy={142} rx={14} ry={2.6} fill="none" stroke={muted} />
      <Ellipse cx={248} cy={143} rx={20} ry={3} fill="none" stroke={muted} />
      <Path d="M24 22 V134 M20 22 H28 M20 134 H28" stroke={muted} strokeWidth={1} fill="none" />
      <SvgText x={32} y={82} fontSize={10} fill={muted}>1.6 m</SvgText>
      <G transform={`translate(0 ${y})`}>
        <Rect x={117} y={10} width={7} height={42} fill={ink} />
        <Rect x={103} y={46} width={35} height={16} fill={ink} />
        <Path d="M211 56 C 200 44, 196 24, 205 6 C 219 20, 222 40, 211 56 Z" fill={theme.bg(surface)} stroke={ink} strokeWidth={2} />
        <Path d="M211 62 C 210 44, 208 24, 205 6" stroke={ink} strokeWidth={1.5} fill="none" />
      </G>
      <SvgText x={300} y={30} fontSize={13} fontWeight="bold" fill={ink} textAnchor="end">{t.toFixed(2)} s</SvgText>
    </Svg>
  );
}

function MemeCard({ card, item, active, theme }: CardProps) {
  const s = card.subject;
  const panels = card.panels ?? [];
  return (
    <>
      <Eyebrow card={card} theme={theme} rerun={item.kind === 'card' && item.rerun} />
      <Title text={card.title} theme={theme} surface={s} size={card.title.length > 60 ? 'small' : 'title'} />
      <View style={{ gap: 8, marginTop: 14 }}>
        {panels.map(([who, say], k) => {
          const last = k === panels.length - 1;
          return (
            <Rv key={k} i={1 + k * 2} active={active} theme={theme}>
              <View style={{ borderWidth: theme.rule, borderColor: last ? theme.accent(s) : theme.ink(s), backgroundColor: last ? theme.accent(s) : 'transparent', padding: 12, flexDirection: 'row', alignItems: 'baseline', gap: 12 }}>
                <Label theme={theme} surface={s} color={last ? theme.onAccent(s) : theme.muted(s)} style={{ width: 96 }}>{who}</Label>
                <Text style={{ flex: 1, fontFamily: theme.heavy, fontSize: 28, lineHeight: 28, letterSpacing: theme.titleTracking / 2, color: last ? theme.onAccent(s) : theme.ink(s) }}>{say}</Text>
              </View>
            </Rv>
          );
        })}
      </View>
      <Lines lines={card.lines} theme={theme} surface={s} active={active} start={panels.length * 2 + 1} size={16} />
      <Cliff text={card.cliff} theme={theme} surface={s} active={active} i={panels.length * 2 + (card.lines?.length ?? 0) + 2} />
    </>
  );
}

function InteractiveCard({ card, item, active, theme }: CardProps) {
  const { engine, markInteracted } = useApp();
  const s = card.subject;
  return (
    <>
      <Eyebrow card={card} theme={theme} rerun={item.kind === 'card' && item.rerun} />
      <Title text={card.title} theme={theme} surface={s} size="small" />
      <Lines lines={card.lines} theme={theme} surface={s} active={active} size={15} />
      <Rv i={2} active={active} theme={theme} style={{ marginTop: 10 }}>
        <WidgetView widget={card.widget!} theme={theme} surface={s} active={active}
          onTouch={() => { markInteracted(item.key); engine.touch(card.id); fx.buzz('select'); }} />
      </Rv>
      <Cliff text={card.cliff} theme={theme} surface={s} active={active} i={4} deeper={!!card.deeper?.length} />
    </>
  );
}

export function CardBody({ card, item, active, theme }: CardProps) {
  const inner = card.format === 'quiz' || card.format === 'predict' || card.format === 'myth' ? <AnswerCard card={card} item={item} active={active} theme={theme} />
    : card.format === 'meme' ? <MemeCard card={card} item={item} active={active} theme={theme} />
    : card.format === 'interactive' ? <InteractiveCard card={card} item={item} active={active} theme={theme} />
    : <TextCard card={card} item={item} active={active} theme={theme} />;
  return (
    <Frame surface={card.subject} theme={theme} legendary={card.legendary}>
      {inner}
    </Frame>
  );
}

/* ---------------- system cards ---------------- */

function ChestCard({ item, active, theme }: { item: FeedItem & { kind: 'chest' }; active: boolean; theme: Theme }) {
  const { engine, markInteracted } = useApp();
  const s: SurfaceKind = 'chest';
  const [prize, setPrize] = useState<Prize | null>(null);
  const wobble = useSharedValue(0);
  const scale = useSharedValue(1);
  useEffect(() => {
    if (active && !prize) wobble.value = withRepeat(withSequence(withTiming(-4, { duration: 70 }), withTiming(4, { duration: 70 }), withTiming(0, { duration: 70 }), withTiming(0, { duration: 900 })), -1);
  }, [active, prize, wobble]);
  const box = useAnimatedStyle(() => ({ transform: [{ rotate: `${wobble.value}deg` }, { scale: scale.value }] }));
  function open() {
    if (prize) return;
    markInteracted(item.key);
    wobble.value = withTiming(0, { duration: 50 });
    scale.value = withSequence(withTiming(0.85, { duration: 120 }), withSpring(1.08, { damping: 6 }), withSpring(1));
    setTimeout(() => { const p = engine.openChest(item.key); setPrize(p); fx.both(p.kind === 'xp' && p.jackpot ? 'legend' : 'drop', 'heavy'); }, 260);
  }
  const prizeText = !prize ? '' : prize.kind === 'xp' ? (prize.jackpot ? `JACKPOT\n+${prize.amount} XP` : `+${prize.amount} XP`)
    : prize.kind === 'freeze' ? 'STREAK\nFREEZE' : 'COMBO\nSHIELD';
  const prizeSub = !prize ? '' : prize.kind === 'freeze' ? 'Miss a day, keep your streak.' : prize.kind === 'shield' ? 'Absorbs your next combo break.' : prize.jackpot ? '8% chance. You hit it.' : 'Added to your total.';
  return (
    <Frame surface={s} theme={theme}>
      <Label theme={theme} surface={s} color={theme.gold}>Mystery drop</Label>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 22 }}>
        <Pressable onPress={open}>
          <Animated.View style={[box, { width: 190, height: 190, borderWidth: 8, borderColor: theme.gold, borderStyle: 'solid', backgroundColor: prize ? theme.gold : 'transparent', alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ fontFamily: theme.display, fontSize: prize ? 34 : 96, lineHeight: prize ? 36 : 96, textAlign: 'center', color: prize ? '#0A0A0A' : theme.gold }}>{prize ? prizeText : '?'}</Text>
          </Animated.View>
        </Pressable>
        <Text style={{ fontFamily: theme.label, fontSize: 15, color: theme.ink(s), textAlign: 'center' }}>{prize ? prizeSub : 'Tap to open'}</Text>
      </View>
      <Text style={{ fontFamily: theme.body, fontSize: 13, color: theme.muted(s) }}>{prize ? 'Next drop: somewhere in the next few cards.' : 'Could be XP, a streak freeze, a combo shield. Or the jackpot.'}</Text>
    </Frame>
  );
}

function RecallCard({ item, active, theme }: { item: FeedItem & { kind: 'recall' }; active: boolean; theme: Theme }) {
  const { engine, markInteracted } = useApp();
  const card = CARD_BY_ID[item.cardId];
  const s: SurfaceKind = 'recall';
  const [shown, setShown] = useState(false);
  const [graded, setGraded] = useState<boolean | null>(null);
  const q = card.recall?.[0] ?? card.title;
  const a = card.recall?.[1] ?? (card.options && card.answer !== undefined ? card.options[card.answer] : card.format === 'myth' ? `${card.truth ? 'Fact' : 'Myth'}. ${card.reveal?.[0] ?? ''}` : (card.lines?.[0] ?? card.reveal?.[0] ?? '').replace(/^\$ /, ''));
  const box = engine.s.srs[card.id]?.box ?? 0;
  return (
    <Frame surface={s} theme={theme}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
        <Label theme={theme} surface={s} color={theme.ink(s)}>Remember this? · {SUBJECT_NAME[card.subject]}</Label>
        <Label theme={theme} surface={s} color={theme.muted(s)}>Review {box + 1}</Label>
      </View>
      <Title text={q} theme={theme} surface={s} size={q.length > 70 ? 'small' : 'title'} />
      <View style={{ marginTop: 18, gap: 12 }}>
        {!shown ? (
          <Btn label="Show answer" theme={theme} surface={s} onPress={() => { setShown(true); markInteracted(item.key); fx.buzz('select'); }} />
        ) : (
          <>
            <Rich text={a} theme={theme} surface={s} size={18} />
            {graded === null ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Btn flex label="Forgot" theme={theme} surface={s} onPress={() => { setGraded(false); engine.gradeRecall(item.key, card.id, false); fx.both('nope', 'fail'); }} />
                <Btn flex label="Got it" theme={theme} surface={s} state="selected" onPress={() => { setGraded(true); engine.gradeRecall(item.key, card.id, true); fx.both('pop', 'success'); }} />
              </View>
            ) : (
              <Text style={{ fontFamily: theme.label, fontSize: 15, color: theme.ink(s) }}>{graded ? 'Locked in. Next review in a few days.' : 'It comes back in a few cards.'}</Text>
            )}
          </>
        )}
      </View>
      <Cliff text="Spaced repetition: each review you pass pushes the next one further out" theme={theme} surface={s} active={active} i={3} />
    </Frame>
  );
}

function MilestoneCard({ item, active, theme }: { item: FeedItem & { kind: 'milestone' }; active: boolean; theme: Theme }) {
  const s: SurfaceKind = 'milestone';
  const pop = useSharedValue(0.6);
  useEffect(() => { if (active) pop.value = withSpring(1, { damping: 7, stiffness: 160 }); }, [active, pop]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const tag = { goal: 'Daily goal', level: 'Level up', chain: 'Chain complete', title: 'New title', welcome: 'Mindscroll' }[item.tone];
  return (
    <Frame surface={s} theme={theme}>
      <Label theme={theme} surface={s} color={theme.ink(s)}>{tag}</Label>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Animated.View style={a}>
          <Title text={item.title} theme={theme} surface={s} size="hook" />
        </Animated.View>
        <Lines lines={item.lines} theme={theme} surface={s} active={active} size={19} />
      </View>
      <Cliff text={item.tone === 'welcome' ? 'Swipe up to start' : 'Keep going'} theme={theme} surface={s} active={active} i={item.lines.length + 2} />
    </Frame>
  );
}

export function ItemView({ item, active, theme }: { item: FeedItem; active: boolean; theme: Theme }) {
  if (item.kind === 'chest') return <ChestCard item={item} active={active} theme={theme} />;
  if (item.kind === 'recall') return <RecallCard item={item} active={active} theme={theme} />;
  if (item.kind === 'milestone') return <MilestoneCard item={item} active={active} theme={theme} />;
  return <CardBody card={CARD_BY_ID[item.cardId]} item={item} active={active} theme={theme} />;
}

/** Surface colour of an item, so the HUD can match it. */
export function surfaceOf(item: FeedItem | undefined): SurfaceKind {
  if (!item) return 'maths';
  if (item.kind === 'chest') return 'chest';
  if (item.kind === 'milestone') return 'milestone';
  if (item.kind === 'recall') return 'recall';
  return CARD_BY_ID[item.cardId].subject;
}

const styles = StyleSheet.create({
  inner: { flex: 1, paddingHorizontal: 24 },
});

