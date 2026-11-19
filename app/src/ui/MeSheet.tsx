import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CARD_BY_ID, COURSES } from '../content';
import type { CourseId } from '../content/types';
import { levelStart, levelTitle } from '../engine/engine';
import { type LogEvent, dayKey, daysBetween } from '../engine/state';
import { SUBJECT_NAME, type Theme } from '../theme';
import { useApp, useEngineVersion } from './context';

interface Props { visible: boolean; onClose: () => void; loadEvents: (since: number) => Promise<LogEvent[]> }

export function MeSheet({ visible, onClose, loadEvents }: Props) {
  const { engine, theme } = useApp();
  useEngineVersion(engine);
  const insets = useSafeAreaInsets();
  const [events, setEvents] = useState<LogEvent[]>([]);
  useEffect(() => { if (visible) loadEvents(Date.now() - 14 * 86400000).then(setEvents).catch(() => setEvents([])); }, [visible, loadEvents]);

  const bg = '#FFFFFF';
  const ink = '#0A0A0A';
  const muted = 'rgba(10,10,10,0.6)';
  const acc = '#1E3CFF';
  const s = engine.s;
  const lvl = engine.level;
  const T = (st: object) => [{ color: ink, fontFamily: theme.body }, st];

  // ---- weekly stats from the event log ----
  const week = events.filter(e => e.ts >= Date.now() - 7 * 86400000);
  const exits = week.filter(e => e.type === 'exit');
  const answers = week.filter(e => e.type === 'answer');
  const acc7 = answers.length ? Math.round((answers.filter(a => a.value === 1).length / answers.length) * 100) : null;
  const prevAnswers = events.filter(e => e.type === 'answer' && e.ts < Date.now() - 7 * 86400000);
  const accPrev = prevAnswers.length ? Math.round((prevAnswers.filter(a => a.value === 1).length / prevAnswers.length) * 100) : null;
  const byFormat: Record<string, { n: number; skip: number }> = {};
  for (const e of exits) { const f = (byFormat[e.format ?? '?'] ??= { n: 0, skip: 0 }); f.n++; if ((e.dwell ?? 0) < 1500 && (e.value ?? 0) === 0) f.skip++; }
  const sessions = s.sessions.filter(x => x.start >= Date.now() - 7 * 86400000 && x.cards > 0);
  const cardsPerSession = sessions.length ? Math.round(sessions.reduce((a, b) => a + b.cards, 0) / sessions.length) : 0;
  const minsPerSession = sessions.length ? Math.round(sessions.reduce((a, b) => a + (b.end - b.start), 0) / sessions.length / 60000) : 0;
  const daysThisWeek = s.daysUsed.filter(d => daysBetween(d, dayKey()) < 7).length;
  const arms = Object.entries(s.arms).map(([k, [a, b]]) => ({ k, mean: a / (a + b), n: a + b - 2 })).filter(x => x.n > 0.5).sort((x, y) => y.mean - x.mean).slice(0, 5);
  const saved = Object.entries(s.cards).filter(([, v]) => v.saved).map(([id]) => CARD_BY_ID[id]).filter(Boolean);

  const shiftExam = (id: CourseId, days: number) => {
    const base = s.exams[id] ? new Date(s.exams[id] + 'T12:00:00') : new Date(Date.now() + 30 * 86400000);
    if (s.exams[id]) base.setDate(base.getDate() + days);
    engine.setExam(id, dayKey(base.getTime()));
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <View style={{ flex: 1, backgroundColor: bg, paddingTop: insets.top + 8 }}>
        <View style={styles.head}>
          <Text style={{ fontFamily: theme.display, fontSize: 44, letterSpacing: theme.hookTracking, color: ink }}>{'ME'}</Text>
          <Pressable onPress={onClose} hitSlop={12} style={{ borderWidth: theme.rule, borderColor: ink, paddingHorizontal: 12, paddingVertical: 6 }}>
            <Text style={{ fontFamily: theme.label, color: ink }}>Back to feed</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40, gap: 26 }}>
          {/* profile */}
          <Section title="Progress" theme={theme} ink={ink}>
            <Text style={T({ fontFamily: theme.heavy, fontSize: 34, letterSpacing: theme.titleTracking })}>Level {lvl} · {levelTitle(lvl)}</Text>
            <Bar frac={engine.levelProgress} ink={ink} muted={muted} />
            <Text style={T({ color: muted, fontSize: 13 })}>{s.xp.toLocaleString('en-GB')} XP · {levelStart(lvl + 1) - s.xp} to level {lvl + 1}</Text>
            <Grid ink={ink} muted={muted} theme={theme} cells={[
              ['Streak', `${engine.effectiveStreak}`], ['Best streak', `${s.streak.best}`], ['Freezes', `${s.streak.freezes}`],
              ['Shields', `${s.shields}`], ['Best combo', `×${s.bestCombo}`], ['Today', `${Math.min(s.daily.done, engine.goal)}/${engine.goal}`],
            ]} />
            {s.titles.length > 0 && <Text style={T({ fontSize: 14 })}>Titles: {s.titles.join(' · ')}</Text>}
          </Section>

          {/* courses */}
          <Section title="Courses · exam readiness" theme={theme} ink={ink}>
            {COURSES.map(c => {
              const r = engine.readiness(c.id), p = engine.courseProgress(c.id), exam = s.exams[c.id];
              const days = exam ? daysBetween(dayKey(), exam) : null;
              return (
                <View key={c.id} style={{ gap: 6, paddingBottom: 12, borderBottomWidth: 1, borderColor: muted }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <Text style={T({ fontFamily: theme.label, fontSize: 16 })}>{c.name}</Text>
                    <Text style={T({ fontFamily: theme.heavy, fontSize: 26, color: r < 0.4 && p.seen > 0 ? ('#FF4F1A') : ink })}>{Math.round(r * 100)}%</Text>
                  </View>
                  <Bar frac={r} ink={ink} muted={muted} />
                  <Text style={T({ color: muted, fontSize: 12 })}>{p.seen}/{p.total} cards seen{days !== null ? ` · exam ${days >= 0 ? `in ${days} day${days === 1 ? '' : 's'}` : 'passed'} (${exam})` : ''}</Text>
                  <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                    {!exam ? <Chip label="Set exam date" onPress={() => shiftExam(c.id, 0)} theme={theme} ink={ink} /> : (
                      <>
                        {[-7, -1, 1, 7].map(d => <Chip key={d} label={`${d > 0 ? '+' : ''}${d}d`} onPress={() => shiftExam(c.id, d)} theme={theme} ink={ink} />)}
                        <Chip label="Clear" onPress={() => engine.setExam(c.id, null)} theme={theme} ink={ink} />
                      </>
                    )}
                  </View>
                </View>
              );
            })}
            <Text style={T({ color: muted, fontSize: 12 })}>In the last 14 days before an exam, that course takes up to 85% of the feed.</Text>
          </Section>

          {/* measure */}
          <Section title="This week" theme={theme} ink={ink}>
            <Grid ink={ink} muted={muted} theme={theme} cells={[
              ['Cards / session', `${cardsPerSession}`], ['Min / session', `${minsPerSession}`], ['Days used', `${daysThisWeek}/7`],
              ['Quiz accuracy', acc7 === null ? '–' : `${acc7}%`], ['Last week', accPrev === null ? '–' : `${accPrev}%`], ['Cards seen', `${exits.length}`],
            ]} />
            <Text style={T({ fontFamily: theme.label, fontSize: 13, marginTop: 6 })}>Skip rate by format</Text>
            {Object.entries(byFormat).sort((a, b) => b[1].skip / b[1].n - a[1].skip / a[1].n).map(([f, v]) => (
              <View key={f} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={T({ width: 90, fontSize: 13 })}>{f}</Text>
                <View style={{ flex: 1 }}><Bar frac={v.skip / v.n} ink={v.skip / v.n > 0.4 ? ('#FF4F1A') : ink} muted={muted} /></View>
                <Text style={T({ width: 70, fontSize: 12, color: muted, textAlign: 'right' })}>{Math.round((v.skip / v.n) * 100)}% of {v.n}</Text>
              </View>
            ))}
            {!exits.length && <Text style={T({ color: muted, fontSize: 13 })}>Swipe some cards and this fills in.</Text>}
            {arms.length > 0 && <Text style={T({ fontFamily: theme.label, fontSize: 13, marginTop: 6 })}>What hooks you (bandit favourites)</Text>}
            {arms.map(a => {
              const [sub, fmt] = a.k.split('|');
              return <Text key={a.k} style={T({ fontSize: 13 })}>{SUBJECT_NAME[sub as keyof typeof SUBJECT_NAME] ?? sub} · {fmt}: {Math.round(a.mean * 100)}%</Text>;
            })}
          </Section>

          {saved.length > 0 && (
            <Section title={`Saved · ${saved.length}`} theme={theme} ink={ink}>
              {saved.map(c => <Text key={c.id} style={T({ fontSize: 14 })}>· {c.title}</Text>)}
            </Section>
          )}

          {/* settings */}
          <Section title="Settings" theme={theme} ink={ink}>
            <Setting label="Daily goal" theme={theme} ink={ink}>
              {[10, 15, 25, 40].map(g => <Chip key={g} label={`${g} cards`} on={s.settings.goal === g} onPress={() => engine.updateSettings({ goal: g })} theme={theme} ink={ink} />)}
            </Setting>
            <Setting label="Courses vs curiosity" theme={theme} ink={ink}>
              {[0.4, 0.6, 0.8].map(v => <Chip key={v} label={`${Math.round(v * 100)}/${Math.round((1 - v) * 100)}`} on={s.settings.courseShare === v} onPress={() => engine.updateSettings({ courseShare: v })} theme={theme} ink={ink} />)}
            </Setting>
            <Setting label="Sound and haptics" theme={theme} ink={ink}>
              <Chip label={s.settings.sound ? 'Sound on' : 'Sound off'} on={s.settings.sound} onPress={() => engine.updateSettings({ sound: !s.settings.sound })} theme={theme} ink={ink} />
              <Chip label={s.settings.haptics ? 'Haptics on' : 'Haptics off'} on={s.settings.haptics} onPress={() => engine.updateSettings({ haptics: !s.settings.haptics })} theme={theme} ink={ink} />
            </Setting>
            <Setting label="At daily goal" theme={theme} ink={ink}>
              <Chip label="Keep going (bonus round)" on={!s.settings.stopAtGoal} onPress={() => engine.updateSettings({ stopAtGoal: false })} theme={theme} ink={ink} />
              <Chip label="Tell me to stop" on={s.settings.stopAtGoal} onPress={() => engine.updateSettings({ stopAtGoal: true })} theme={theme} ink={ink} />
            </Setting>
          </Section>
          <Text style={T({ color: muted, fontSize: 12 })}>{Object.keys(CARD_BY_ID).length} cards in the deck · {Object.values(s.cards).filter(c => c.seen).length} seen · {Object.keys(s.srs).length} in review. Accent: <Text style={{ color: acc }}>●</Text></Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

function Section({ title, theme, ink, children }: { title: string; theme: Theme; ink: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ fontFamily: theme.label, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', color: ink, borderTopWidth: theme.rule, borderColor: ink, paddingTop: 8 }}>{title}</Text>
      {children}
    </View>
  );
}
function Bar({ frac, ink, muted }: { frac: number; ink: string; muted: string }) {
  return (
    <View style={{ height: 8, borderWidth: 1, borderColor: muted }}>
      <View style={{ height: '100%', width: `${Math.max(0, Math.min(1, frac)) * 100}%`, backgroundColor: ink }} />
    </View>
  );
}
function Grid({ cells, ink, muted, theme }: { cells: [string, string][]; ink: string; muted: string; theme: Theme }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {cells.map(([k, v]) => (
        <View key={k} style={{ width: '33.33%', paddingVertical: 8 }}>
          <Text style={{ fontFamily: theme.label, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: muted }}>{k}</Text>
          <Text style={{ fontFamily: theme.heavy, fontSize: 28, color: ink, letterSpacing: theme.titleTracking / 2 }}>{v}</Text>
        </View>
      ))}
    </View>
  );
}
function Setting({ label, theme, ink, children }: { label: string; theme: Theme; ink: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontFamily: theme.label, fontSize: 13, color: ink }}>{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{children}</View>
    </View>
  );
}
function Chip({ label, onPress, on, theme, ink }: { label: string; onPress: () => void; on?: boolean; theme: Theme; ink: string }) {
  const bg = '#FFFFFF';
  return (
    <Pressable onPress={onPress} style={{ borderWidth: 2, borderColor: ink, backgroundColor: on ? ink : 'transparent', paddingHorizontal: 10, paddingVertical: 7 }}>
      <Text style={{ fontFamily: theme.label, fontSize: 13, color: on ? bg : ink }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20 },
});
