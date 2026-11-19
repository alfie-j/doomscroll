import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { CARD_BY_ID, CHAINS, COURSES, courseOf } from '../content';
import type { FeedItem } from '../engine/engine';
import type { SurfaceKind } from '../theme';
import { DOCK_H, HUD_H } from './cards';
import { useApp } from './context';

function Flame({ color, hollow }: { color: string; hollow?: boolean }) {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24">
      <Path d="M12 2.5c.8 3.3 5.5 5.6 5.5 11a5.5 5.5 0 0 1-11 0c0-2.6 1.3-4.1 2.6-5.3.1 2 1 3.3 2.3 3.6-.3-3.6-.4-6.4.6-9.3z"
        fill={hollow ? 'none' : color} stroke={color} strokeWidth={hollow ? 2 : 0} />
    </Svg>
  );
}
function Heart({ color, filled }: { color: string; filled: boolean }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z" fill={filled ? color : 'none'} stroke={color} strokeWidth={1.9} strokeLinejoin="round" />
    </Svg>
  );
}
function Bookmark({ color, filled }: { color: string; filled: boolean }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path d="M6.5 3.5h11v17l-5.5-4-5.5 4z" fill={filled ? color : 'none'} stroke={color} strokeWidth={1.9} strokeLinejoin="round" />
    </Svg>
  );
}

export function Hud({ surface, item, depth, panes, onOpenMe, onLike, onSave, liked, saved }: {
  surface: SurfaceKind; item?: FeedItem; depth: number; panes: number; onOpenMe: () => void;
  onLike: () => void; onSave: () => void; liked: boolean; saved: boolean;
}) {
  const { engine, theme } = useApp();
  const ink = theme.ink(surface);
  const muted = theme.muted(surface);
  const label = { fontFamily: theme.label, fontSize: 12, color: ink, letterSpacing: 0.8 } as const;

  let where = '';
  if (item?.kind === 'card') {
    const c = CARD_BY_ID[item.cardId];
    const course = courseOf(c);
    where = c.chain ? `${course ? COURSES.find(x => x.id === course)?.short + ' · ' : ''}${CHAINS[c.chain].name}` : 'Wildcard';
  } else if (item?.kind === 'recall') where = 'Review';
  else if (item?.kind === 'chest') where = 'Drop';
  else if (item?.kind === 'read') where = `Book · ${engine.s.books[item.bookId]?.title ?? ''}`;

  const goalFrac = Math.min(1, engine.s.daily.done / engine.goal);
  const left = Math.max(0, engine.goal - engine.s.daily.done);
  const tier = engine.comboTier;
  const pending = engine.pendingInfo();

  return (
    <>
      <View pointerEvents="box-none" style={[styles.top, { height: HUD_H }]}>
        <View style={styles.row}>
          <Pressable onPress={onOpenMe} hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
            <Text style={[label, { borderWidth: 2, borderColor: ink, paddingHorizontal: 5, paddingVertical: 1 }]}>LV {engine.level}</Text>
            <Text numberOfLines={1} style={[label, { textTransform: 'uppercase', opacity: 0.85, flexShrink: 1 }]}>{where}</Text>
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Flame color={ink} hollow={engine.streakAtRisk} />
              <Text style={label}>{engine.effectiveStreak}</Text>
            </View>
            <Text style={label}>{engine.s.xp.toLocaleString('en-GB')} XP</Text>
          </View>
        </View>
        {/* daily goal: goal-gradient bar */}
        <View style={{ height: 3, backgroundColor: 'transparent', marginTop: 7, borderWidth: 0 }}>
          <View style={{ height: 3, width: `${goalFrac * 100}%`, backgroundColor: ink }} />
          {<View style={[StyleSheet.absoluteFill, { borderBottomWidth: 1, borderColor: muted, opacity: 0.5 }]} />}
        </View>
        <View style={[styles.row, { marginTop: 5, justifyContent: 'flex-start', gap: 8 }]}>
          {!engine.s.daily.completed && left <= 3 && left > 0 && <Chip text={`${left} TO GOAL`} ink={ink} theme={theme.name} />}
          {engine.combo >= 2 && <Chip text={`COMBO ×${engine.combo}${tier ? ` · ${tier.name}` : ''}`} ink={ink} theme={theme.name} solid={!!tier} bg={theme.bg(surface)} />}
          {engine.bonusLeft > 0 && <Chip text={`BONUS ×1.5 · ${engine.bonusLeft}`} ink={ink} theme={theme.name} />}
          {pending && <Chip text={`PART ${pending.part} IN ${pending.inCards}`} ink={ink} theme={theme.name} />}
        </View>
      </View>

      <View pointerEvents="box-none" style={[styles.dock, { height: DOCK_H }]}>
        {item?.kind === 'card' && (
          <>
            <Pressable onPress={onLike} hitSlop={8} style={styles.act}><Heart color={ink} filled={liked} /><Text style={label}>Like</Text></Pressable>
            <Pressable onPress={onSave} hitSlop={8} style={styles.act}><Bookmark color={ink} filled={saved} /><Text style={label}>Save</Text></Pressable>
          </>
        )}
        {panes > 1 && (
          <View style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Text style={[label, { fontSize: 11 }]}>{item?.kind === 'read' ? (depth === 0 ? 'SWIPE RIGHT: READ ON' : `BITE ${depth + 1}/${panes}`) : depth === 0 ? 'SWIPE RIGHT: DEEPER' : 'DEPTH'}</Text>
            {Array.from({ length: panes }, (_, k) => <View key={k} style={{ width: panes > 6 ? 8 : 14, height: 4, backgroundColor: ink, opacity: k === depth ? 1 : k < depth && item?.kind === 'read' ? 0.6 : 0.3 }} />)}
          </View>
        )}
      </View>
    </>
  );
}

function Chip({ text, ink, theme, solid, bg }: { text: string; ink: string; theme: string; solid?: boolean; bg?: string }) {
  return (
    <Text style={{
      fontFamily: 'ArchivoBold', fontSize: 10, letterSpacing: 1,
      color: solid ? bg : ink, backgroundColor: solid ? ink : 'transparent', borderWidth: 1.5, borderColor: ink, paddingHorizontal: 5, paddingVertical: 1,
    }}>{text}</Text>
  );
}

const styles = StyleSheet.create({
  top: { position: 'absolute', left: 0, right: 0, top: 0, paddingTop: 10, paddingHorizontal: 20, zIndex: 5 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dock: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 14, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 4, zIndex: 5 },
  act: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 44, paddingHorizontal: 8 },
});
