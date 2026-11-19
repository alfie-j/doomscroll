import { CARD_BY_ID, CARDS, CHAINS, CHAIN_CARDS, CHAIN_LENGTH, COURSES, courseCards, courseOf } from '../content';
import type { Card, CourseId, Format, Subject } from '../content/types';
import { SUBJECT_NOUN } from '../theme';
import { betaSample, pick, rand, randInt } from './random';
import { type LogEvent, type PersistedState, dayKey, daysBetween } from './state';

/* ---------------- feed items ---------------- */

export type MilestoneTone = 'goal' | 'level' | 'chain' | 'title' | 'welcome';
export type FeedItem =
  | { key: string; kind: 'card'; cardId: string; rerun?: boolean }
  | { key: string; kind: 'recall'; cardId: string }
  | { key: string; kind: 'chest' }
  | { key: string; kind: 'milestone'; tone: MilestoneTone; title: string; lines: string[] };

export type Effect =
  | { type: 'xp'; amount: number; label?: string; crit?: number }
  | { type: 'combo'; tier: number; name: string }
  | { type: 'comboBreak'; lost: number }
  | { type: 'shield' }
  | { type: 'level'; level: number }
  | { type: 'toast'; text: string }
  | { type: 'goal' };

export type Prize = { kind: 'xp'; amount: number; jackpot?: boolean } | { kind: 'freeze' } | { kind: 'shield' };

export interface ExitInfo {
  dwellMs: number;
  deeper: boolean;
  interacted: boolean;
  revisit: boolean;
}

/* ---------------- tuning ---------------- */

export const TUNING = {
  skipMs: 1500,
  wildcard: 0.15,
  bangerEvery: [4, 6] as [number, number],
  chestEvery: [6, 11] as [number, number],
  recallEvery: 5,
  chainGap: [2, 4] as [number, number],
  comboTiers: [
    { at: 5, mult: 1.5, name: 'ON FIRE' },
    { at: 10, mult: 2, name: 'UNSTOPPABLE' },
    { at: 20, mult: 3, name: 'GALAXY BRAIN' },
  ],
  srsDays: [1, 3, 7, 16, 35, 90],
  bonusRound: 10,
  armCap: 60,
};

export const LEVEL_TITLES: [number, string][] = [
  [1, 'Curious'], [3, 'Apprentice'], [5, 'Scholar'], [8, 'Researcher'], [12, 'Polymath'], [18, 'Sage'], [25, 'Oracle'],
];
const SUBJECT_TIERS: [number, string][] = [[60, 'Apprentice'], [200, 'Journeyman'], [500, 'Expert'], [1200, 'Master']];

/** XP needed to reach level l. Steepens over time so levels keep coming for months. */
export const levelStart = (l: number) => Math.round(100 * Math.pow(Math.max(0, l - 1), 1.8));
export const levelFor = (xp: number) => { let l = 1; while (xp >= levelStart(l + 1)) l++; return l; };
export const levelTitle = (l: number) => [...LEVEL_TITLES].reverse().find(([at]) => l >= at)?.[1] ?? 'Curious';

/** Group formats for the bandit so each arm gets enough data. */
export function formatGroup(f: Format): string {
  if (f === 'hook' || f === 'explain' || f === 'reallife') return 'text';
  return f;
}
const armKey = (c: Card) => `${c.subject}|${formatGroup(c.format)}`;

/** Expected reading time for a card, used to judge dwell. */
export function expectedMs(c: Card): number {
  const words = [c.title, ...(c.lines ?? []), ...(c.reveal ?? []), ...(c.options ?? []), c.cliff]
    .join(' ').split(/\s+/).length;
  const interactive = c.format === 'interactive' ? 6000 : 0;
  return Math.max(4000, Math.min(22000, (words / 3.6) * 1000 + 1500 + interactive));
}

/* ---------------- engine ---------------- */

export class Engine {
  s: PersistedState;
  items: FeedItem[] = [];
  cur = 0;
  combo = 0;
  bonusLeft = 0;
  version = 0;
  effects: Effect[] = [];
  pending: { chain: string; order: number; dueAt: number } | null = null;

  private keySeq = 0;
  private drift: Partial<Record<Subject, number>> = {};
  private recentRatios: number[] = [];
  private skipsInRow = 0;
  private sinceBanger = 0;
  private bangerTarget = randInt(...TUNING.bangerEvery);
  private sinceChest = 0;
  private chestTarget = randInt(...TUNING.chestEvery);
  private sinceRecall = 0;
  private relearn: { cardId: string; atPos: number }[] = [];
  private sessionStart = Date.now();
  private sessionCards = 0;
  private seenThisSession = new Set<string>();
  private listeners = new Set<() => void>();
  private logBuffer: LogEvent[] = [];
  private answered = new Set<string>();
  private chestOpened = new Set<string>();
  private recallDone = new Set<string>();
  private touched = new Set<string>();

  constructor(state: PersistedState) {
    this.s = state;
    this.rollDay();
    const h = new Date().getHours();
    this.s.openHours[h] = (this.s.openHours[h] ?? 0) + 1;
    const today = dayKey();
    if (!this.s.daysUsed.includes(today)) this.s.daysUsed = [...this.s.daysUsed.slice(-59), today];
    this.s.sessions = [...this.s.sessions.slice(-59), { start: this.sessionStart, end: this.sessionStart, cards: 0 }];
    if (this.isNewUser()) {
      this.items.push({ key: this.key(), kind: 'milestone', tone: 'welcome', title: 'Swipe up.', lines: ['One idea per card. Swipe up for the next.', 'Swipe right when a card has depth.', 'Double-tap anything you love.'] });
    }
    this.fill();
  }

  /* ----- subscription ----- */
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  getVersion = () => this.version;
  private changed() { this.version++; this.listeners.forEach(l => l()); }
  drainEffects(): Effect[] { const e = this.effects; this.effects = []; return e; }
  drainLog(): LogEvent[] { const e = this.logBuffer; this.logBuffer = []; return e; }
  private log(e: Omit<LogEvent, 'ts'>) { this.logBuffer.push({ ts: Date.now(), ...e }); }
  private key() { return `i${Date.now().toString(36)}${(this.keySeq++).toString(36)}`; }

  /* ----- derived values for the HUD ----- */
  get level() { return levelFor(this.s.xp); }
  get levelProgress() { const l = this.level; return (this.s.xp - levelStart(l)) / (levelStart(l + 1) - levelStart(l)); }
  get comboTier() { return [...TUNING.comboTiers].reverse().find(t => this.combo >= t.at) ?? null; }
  get multiplier() { return (this.comboTier?.mult ?? 1) * (this.bonusLeft > 0 ? 1.5 : 1); }
  get goal() { return this.s.settings.goal; }
  get streakAtRisk() { return this.s.streak.lastDay !== dayKey() && this.effectiveStreak > 0; }
  get effectiveStreak() {
    const { lastDay, count, freezes } = this.s.streak;
    if (!lastDay) return 0;
    const gap = daysBetween(lastDay, dayKey());
    if (gap <= 1) return count;
    return gap - 1 <= freezes ? count : 0;
  }
  current(): FeedItem | undefined { return this.items[this.cur]; }
  pendingInfo(): { name: string; part: number; inCards: number } | null {
    if (!this.pending) return null;
    return { name: CHAINS[this.pending.chain]?.name ?? '', part: this.pending.order, inCards: Math.max(1, this.pending.dueAt - this.cur) };
  }

  /* ----- day rollover ----- */
  private rollDay() {
    const today = dayKey();
    if (this.s.daily.day !== today) this.s.daily = { day: today, done: 0, completed: false };
  }

  private isNewUser() { return Object.keys(this.s.cards).length === 0; }

  /* ----- feed generation ----- */

  /** Keep two items ready beyond the current one. Items past cur+1 are regenerated after every exit, so the feed reacts in real time. */
  fill() {
    while (this.items.length < this.cur + 3) this.items.push(this.next(this.items.length));
  }
  private reshuffleAhead() {
    const keep = this.cur + 2;
    if (this.items.length > keep) {
      const milestones = this.items.slice(keep).filter(i => i.kind === 'milestone');
      this.items = [...this.items.slice(0, keep), ...milestones];
    }
    this.fill();
  }

  private queued(): Set<string> {
    const s = new Set<string>();
    for (const it of this.items) if (it.kind === 'card' || it.kind === 'recall') s.add(it.cardId);
    return s;
  }

  private chainUnlocked(chainId: string): boolean {
    const after = CHAINS[chainId]?.after;
    if (!after) return true;
    return (this.s.chains[after] ?? 0) >= Math.min(3, CHAIN_LENGTH[after] ?? 1);
  }

  /** Cards the bandit may serve: chain openers that are unlocked, and the next part of any chain in progress. */
  private candidates(queued: Set<string>): Card[] {
    const out: Card[] = [];
    for (const c of CARDS) {
      if (c.depthOnly || queued.has(c.id) || this.s.cards[c.id]?.seen) continue;
      if (c.chain) {
        const prog = this.s.chains[c.chain] ?? 0;
        if (c.order !== prog + 1) continue;
        if (prog === 0 && !this.chainUnlocked(c.chain)) continue;
        if (this.pending && this.pending.chain === c.chain) continue;
      }
      out.push(c);
    }
    return out;
  }

  private courseShare(): { share: number; focus: CourseId | null } {
    let share = this.s.settings.courseShare, focus: CourseId | null = null, best = Infinity;
    for (const [id, iso] of Object.entries(this.s.exams)) {
      if (!iso) continue;
      const days = daysBetween(dayKey(), iso);
      if (days < 0 || days > 14) continue;
      share = Math.max(share, Math.min(0.85, 0.6 + ((14 - days) / 14) * 0.25));
      if (days < best) { best = days; focus = id as CourseId; }
    }
    return { share, focus };
  }

  private score(c: Card, prev: Card[], focus: CourseId | null): number {
    const [a, b] = this.s.arms[armKey(c)] ?? [1, 1];
    let s = betaSample(a, b) * (0.7 + 0.08 * c.hook);
    s *= 1 + Math.min(0.5, this.drift[c.subject] ?? 0);
    if (prev[0] && prev[0].format === c.format) s *= 0.35;
    if (prev[0] && prev[1] && prev[0].subject === c.subject && prev[1].subject === c.subject) s *= 0.15;
    if (c.chain && (c.order ?? 1) > 1) s *= 1.3; // finish what you started
    if (focus && courseOf(c) === focus) s *= 2;
    return s;
  }

  private prevCards(pos: number): Card[] {
    const out: Card[] = [];
    for (let i = pos - 1; i >= 0 && out.length < 2; i--) {
      const it = this.items[i];
      if (it && it.kind === 'card') out.push(CARD_BY_ID[it.cardId]);
    }
    return out;
  }

  private next(pos: number): FeedItem {
    const queued = this.queued();
    const prev = this.prevCards(pos);

    const { share, focus } = this.courseShare();
    const wantCourse = rand() < share;

    // 1. A promised chain continuation is due (held a few cards if it would break the course/curiosity mix).
    const pendingIsCourse = this.pending ? !!CHAINS[this.pending.chain]?.course : false;
    if (this.pending && pos >= this.pending.dueAt && (pendingIsCourse === wantCourse || pos >= this.pending.dueAt + 4)) {
      const card = CHAIN_CARDS[this.pending.chain]?.[this.pending.order - 1];
      this.pending = null;
      if (card && !queued.has(card.id) && !this.s.cards[card.id]?.seen) return this.cardItem(card);
    }
    // 2. Mystery drop on a variable schedule.
    if (this.sinceChest >= this.chestTarget && this.items[pos - 1]?.kind !== 'chest') {
      this.sinceChest = 0; this.chestTarget = randInt(...TUNING.chestEvery);
      return { key: this.key(), kind: 'chest' };
    }
    // 3. Spaced repetition and same-session relearning.
    if (this.sinceRecall >= TUNING.recallEvery) {
      const r = this.dueRecall(pos, queued);
      if (r) { this.sinceRecall = 0; return { key: this.key(), kind: 'recall', cardId: r }; }
    }

    const all = this.candidates(queued);
    const course = all.filter(c => courseOf(c));
    const breadth = all.filter(c => !courseOf(c));
    let pool = wantCourse ? course : breadth;
    if (!pool.length) pool = pool === course ? breadth : course;
    if (!pool.length) return this.rerun(queued);

    // 4. Peak moments: session opener, leaving risk, and a banger every 4–6 cards.
    const firstOfSession = this.sessionCards === 0 && pos <= 1;
    const exitRisk = this.skipsInRow >= 2 || (this.recentRatios.length >= 3 && avg(this.recentRatios.slice(-3)) < 0.35);
    const bangerDue = this.sinceBanger >= this.bangerTarget;
    if (firstOfSession || exitRisk || bangerDue) {
      const okBanger = (c: Card) => c.hook >= 4 && !(prev[0] && prev[0].format === c.format);
      const bangers = pool.filter(okBanger).length ? pool.filter(okBanger) : all.filter(okBanger);
      if (bangers.length) {
        if (exitRisk) this.skipsInRow = 0;
        const best = exitRisk ? bangers.sort((x, y) => y.hook - x.hook + (y.legendary ? 1 : 0) - (x.legendary ? 1 : 0))[0] : this.best(bangers, prev, focus);
        return this.cardItem(best);
      }
    }
    // 5. Wildcard: explore an arm we know little about.
    if (rand() < TUNING.wildcard) {
      const pulls = (c: Card) => { const [a, b] = this.s.arms[armKey(c)] ?? [1, 1]; return a + b; };
      const fewest = Math.min(...pool.map(pulls));
      return this.cardItem(pick(pool.filter(c => pulls(c) <= fewest + 1)));
    }
    // 6. Thompson sampling.
    return this.cardItem(this.best(pool, prev, focus));
  }

  private best(pool: Card[], prev: Card[], focus: CourseId | null): Card {
    let top = pool[0], topScore = -1;
    for (const c of pool) { const sc = this.score(c, prev, focus); if (sc > topScore) { top = c; topScore = sc; } }
    return top;
  }

  private cardItem(c: Card): FeedItem {
    this.sinceChest++; this.sinceRecall++;
    if (c.hook >= 4) { this.sinceBanger = 0; this.bangerTarget = randInt(...TUNING.bangerEvery); } else this.sinceBanger++;
    return { key: this.key(), kind: 'card', cardId: c.id };
  }

  private rerun(queued: Set<string>): FeedItem {
    const seen = CARDS.filter(c => !c.depthOnly && !queued.has(c.id) && !this.seenThisSession.has(c.id))
      .sort((a, b) => (this.s.cards[a.id]?.last ?? 0) - (this.s.cards[b.id]?.last ?? 0));
    const c = pick(seen.slice(0, 8).length ? seen.slice(0, 8) : CARDS.filter(x => !x.depthOnly));
    this.sinceChest++;
    return { key: this.key(), kind: 'card', cardId: c.id, rerun: true };
  }

  private dueRecall(pos: number, queued: Set<string>): string | null {
    const rl = this.relearn.findIndex(r => r.atPos <= pos && !queued.has(r.cardId));
    if (rl >= 0) return this.relearn.splice(rl, 1)[0].cardId;
    const now = Date.now();
    const due = Object.entries(this.s.srs)
      .filter(([id, e]) => e.due <= now && !queued.has(id) && !this.seenThisSession.has(id) && CARD_BY_ID[id])
      .sort((a, b) => a[1].due - b[1].due);
    return due[0]?.[0] ?? null;
  }

  /* ----- user actions ----- */

  /** Called when the user leaves an item (swipes away). */
  exit(index: number, info: ExitInfo) {
    const item = this.items[index];
    if (!item) return;
    this.rollDay();
    if (item.kind === 'card') this.exitCard(item.cardId, info);
    else {
      const interacted = info.interacted || (item.kind === 'chest' && this.chestOpened.has(item.key)) || (item.kind === 'recall' && this.recallDone.has(item.key));
      if (interacted) this.bumpCombo();
    }
    this.changed();
  }

  private exitCard(id: string, info: ExitInfo) {
    const card = CARD_BY_ID[id];
    const st = (this.s.cards[id] ??= { seen: 0, last: 0, dwell: 0 });
    const firstView = st.seen === 0;
    st.seen++; st.last = Date.now(); st.dwell += info.dwellMs;
    this.seenThisSession.add(id);
    this.sessionCards++;
    const sess = this.s.sessions[this.s.sessions.length - 1];
    if (sess) { sess.end = Date.now(); sess.cards = this.sessionCards; }

    const interacted = info.interacted || this.answered.has(id) || this.touched.has(id) || !!st.liked;
    const ratio = info.dwellMs / expectedMs(card);
    const skip = info.dwellMs < TUNING.skipMs && !interacted && !info.deeper;
    const engaged = !skip && (interacted || info.deeper || info.dwellMs >= Math.max(2500, 0.4 * expectedMs(card)));

    // reward for the bandit: dwell is the main signal, skips score zero
    let r = skip ? 0 : Math.min(1, ratio) * 0.6;
    if (info.deeper) r += 0.25;
    if (st.liked) r += 0.3;
    if (st.saved) r += 0.25;
    if (interacted) r += 0.2;
    if (info.revisit) r += 0.15;
    r = Math.max(0, Math.min(1, r));
    if (!card.depthOnly) {
      const k = armKey(card);
      let [a, b] = this.s.arms[k] ?? [1, 1];
      a += r; b += 1 - r;
      if (a + b > TUNING.armCap) { const f = TUNING.armCap / (a + b); a *= f; b *= f; }
      this.s.arms[k] = [a, b];
    }
    for (const sub in this.drift) this.drift[sub as Subject]! *= 0.9;
    this.drift[card.subject] = (this.drift[card.subject] ?? 0) + r * 0.5;
    this.recentRatios = [...this.recentRatios.slice(-5), skip ? 0 : Math.min(1.5, ratio)];
    this.skipsInRow = skip ? this.skipsInRow + 1 : 0;
    this.log({ type: 'exit', cardId: id, subject: card.subject, format: card.format, dwell: info.dwellMs, value: r });

    if (skip) this.breakCombo();
    else if (engaged) this.bumpCombo();

    if (engaged && firstView) {
      this.gainXp(card.legendary ? 10 : 2, card.subject, card.legendary ? 'LEGENDARY' : undefined);
      this.countTowardGoal();
      // spaced repetition: course cards and anything with a recall prompt or an answer
      const reviewable = !!courseOf(card) || !!card.recall || card.format === 'quiz' || card.format === 'predict' || card.format === 'myth';
      if (reviewable && !this.s.srs[id]) this.s.srs[id] = { box: 0, due: Date.now() + TUNING.srsDays[0] * 86400000 };
    }

    // chain progress and cliffhanger continuation
    if (card.chain && firstView) {
      const ch = card.chain, order = card.order ?? 1;
      const unitCourse = CHAINS[ch].course;
      if (order === 1 && unitCourse) this.effects.push({ type: 'toast', text: `New unit: ${COURSES.find(c => c.id === unitCourse)?.short} · ${CHAINS[ch].name} · ${CHAIN_LENGTH[ch]} cards` });
      this.s.chains[ch] = Math.max(this.s.chains[ch] ?? 0, order);
      if (order < CHAIN_LENGTH[ch]) {
        if (!this.pending) this.pending = { chain: ch, order: order + 1, dueAt: this.cur + randInt(...TUNING.chainGap) };
      } else {
        this.gainXp(25, card.subject, 'CHAIN COMPLETE');
        this.effects.push({ type: 'toast', text: `${CHAINS[ch].name}: complete. It comes back for review.` });
        const course = CHAINS[ch].course;
        if (course) {
          const p = this.courseProgress(course);
          if (p.seen === p.total) {
            const name = COURSES.find(c => c.id === course)?.name ?? course;
            this.gainXp(100, card.subject, 'COURSE COMPLETE');
            this.insertNext({ key: this.key(), kind: 'milestone', tone: 'chain', title: `${name}: done.`, lines: [`All ${p.total} cards seen. +100 XP.`, `Exam readiness: ${Math.round(this.readiness(course) * 100)}%. Reviews keep it alive.`] });
          }
        }
      }
    }
  }

  private countTowardGoal() {
    const d = this.s.daily;
    d.done += d.done === 0 ? 2 : 1; // endowed progress: the first card counts double
    if (this.bonusLeft > 0) this.bonusLeft--;
    if (!d.completed && d.done >= this.goal) {
      d.completed = true;
      this.updateStreak();
      this.gainXp(30, undefined, 'DAILY GOAL');
      this.bonusLeft = TUNING.bonusRound;
      this.effects.push({ type: 'goal' });
      const lines = this.s.settings.stopAtGoal
        ? ['That’s today done. Go outside.', 'Keep swiping if you want: bonus XP is on.']
        : [`Streak: ${this.s.streak.count} day${this.s.streak.count === 1 ? '' : 's'}.`, `Bonus round: next ${TUNING.bonusRound} cards earn 1.5× XP.`];
      this.insertNext({ key: this.key(), kind: 'milestone', tone: 'goal', title: 'Daily goal done.', lines });
    }
  }

  private updateStreak() {
    const st = this.s.streak, today = dayKey();
    if (st.lastDay === today) return;
    if (!st.lastDay) st.count = 1;
    else {
      const gap = daysBetween(st.lastDay, today);
      if (gap === 1) st.count++;
      else if (gap - 1 <= st.freezes) {
        st.freezes -= gap - 1; st.count++;
        this.effects.push({ type: 'toast', text: `Streak freeze used. ${st.freezes} left.` });
      } else st.count = 1;
    }
    st.lastDay = today;
    st.best = Math.max(st.best, st.count);
    if (st.count % 7 === 0 && st.freezes < 2) {
      st.freezes++;
      this.effects.push({ type: 'toast', text: `${st.count}-day streak. Earned a streak freeze.` });
    }
  }

  private bumpCombo() {
    const before = this.comboTier;
    this.combo++;
    this.s.bestCombo = Math.max(this.s.bestCombo, this.combo);
    const after = this.comboTier;
    if (after && after !== before) this.effects.push({ type: 'combo', tier: TUNING.comboTiers.indexOf(after) + 1, name: after.name });
  }

  private breakCombo() {
    if (this.combo < 3) { this.combo = 0; return; }
    if (this.s.shields > 0) { this.s.shields--; this.effects.push({ type: 'shield' }); return; }
    this.effects.push({ type: 'comboBreak', lost: this.combo });
    this.combo = 0;
  }

  /** Adds XP with combo and bonus multipliers on gains. Returns the amount actually added. */
  gainXp(base: number, subject?: Subject, label?: string, crit = 1): number {
    const before = this.level;
    const amount = base > 0 ? Math.round(base * this.multiplier * crit) : Math.max(base, -this.s.xp);
    this.s.xp += amount;
    if (subject && amount > 0) {
      const old = this.s.subjectXp[subject] ?? 0, now = old + amount;
      this.s.subjectXp[subject] = now;
      for (const [at, tier] of SUBJECT_TIERS) {
        const title = `${tier} ${SUBJECT_NOUN[subject]}`;
        if (old < at && now >= at && !this.s.titles.includes(title)) {
          this.s.titles.push(title);
          if (at < 500) { this.effects.push({ type: 'toast', text: `New title: ${title}` }); continue; }
          this.insertNext({ key: this.key(), kind: 'milestone', tone: 'title', title: `Unlocked: ${title}`, lines: [`${now} XP in ${subject === 'lit' ? 'literature' : subject}.`, 'Next title unlocks further up.'] });
        }
      }
    }
    if (amount !== 0) this.effects.push({ type: 'xp', amount, label, crit: crit > 1 ? crit : undefined });
    const after = this.level;
    if (after > before) {
      this.effects.push({ type: 'level', level: after });
      if (after % 5 === 0) this.insertNext({ key: this.key(), kind: 'milestone', tone: 'level', title: `Level ${after}`, lines: [`Title: ${levelTitle(after)}.`, `${levelStart(after + 1) - this.s.xp} XP to level ${after + 1}.`] });
    }
    return amount;
  }

  /** Queues a milestone one card ahead, so the card already peeking in doesn't get swapped out. */
  private insertNext(item: FeedItem) {
    const at = Math.min(this.items.length, this.cur + 2);
    this.items.splice(at, 0, item);
  }

  /** Moves the feed to a new index. */
  setCurrent(index: number) {
    this.cur = Math.max(0, Math.min(index, this.items.length - 1));
    this.reshuffleAhead();
    this.changed();
  }

  /* ----- in-card actions ----- */

  answer(cardId: string, correct: boolean, bet?: number): { xp: number; crit: number } {
    if (this.answered.has(cardId)) return { xp: 0, crit: 1 };
    this.answered.add(cardId);
    const card = CARD_BY_ID[cardId];
    const st = (this.s.cards[cardId] ??= { seen: 0, last: 0, dwell: 0 });
    st.correct = correct;
    const roll = rand();
    const crit = correct ? (roll < 0.05 ? 3 : roll < 0.2 ? 2 : 1) : 1;
    let xp: number;
    if (card.format === 'predict' && bet) xp = this.gainXp(correct ? bet : -bet, card.subject, correct ? 'CALLED IT' : undefined, crit);
    else if (card.format === 'myth') xp = this.gainXp(correct ? 10 : 2, card.subject, undefined, crit);
    else xp = this.gainXp(correct ? 15 : 2, card.subject, undefined, crit);
    if (!correct) {
      this.relearn.push({ cardId, atPos: this.cur + 7 });
      this.s.srs[cardId] = { box: 0, due: Date.now() + 86400000 };
    }
    this.bumpCombo();
    this.log({ type: 'answer', cardId, subject: card.subject, format: card.format, value: correct ? 1 : 0 });
    this.changed();
    return { xp, crit };
  }

  touch(cardId: string) {
    if (this.touched.has(cardId)) return;
    this.touched.add(cardId);
    this.gainXp(5, CARD_BY_ID[cardId]?.subject);
    this.changed();
  }

  toggleLike(cardId: string): boolean {
    const st = (this.s.cards[cardId] ??= { seen: 0, last: 0, dwell: 0 });
    st.liked = !st.liked;
    if (st.liked) { this.gainXp(1); this.log({ type: 'like', cardId }); }
    this.changed();
    return st.liked;
  }
  like(cardId: string) { const st = this.s.cards[cardId]; if (!st?.liked) this.toggleLike(cardId); }

  toggleSave(cardId: string): boolean {
    const st = (this.s.cards[cardId] ??= { seen: 0, last: 0, dwell: 0 });
    st.saved = !st.saved;
    if (st.saved) this.log({ type: 'save', cardId });
    this.changed();
    return st.saved;
  }

  wentDeeper(cardId: string) {
    const st = (this.s.cards[cardId] ??= { seen: 0, last: 0, dwell: 0 });
    if (!st.deeper) { st.deeper = true; this.gainXp(3, CARD_BY_ID[cardId]?.subject); this.log({ type: 'deeper', cardId }); }
    this.changed();
  }

  openChest(key: string): Prize {
    if (this.chestOpened.has(key)) return { kind: 'xp', amount: 0 };
    this.chestOpened.add(key);
    const r = rand();
    let prize: Prize;
    if (r < 0.08) prize = { kind: 'xp', amount: 100, jackpot: true };
    else if (r < 0.28) prize = { kind: 'xp', amount: 50 };
    else if (r < 0.38) prize = this.s.streak.freezes < 2 ? { kind: 'freeze' } : { kind: 'xp', amount: 40 };
    else if (r < 0.5) prize = { kind: 'shield' };
    else prize = { kind: 'xp', amount: randInt(10, 30) };
    if (prize.kind === 'xp') this.gainXp(prize.amount, undefined, prize.jackpot ? 'JACKPOT' : 'DROP');
    if (prize.kind === 'freeze') this.s.streak.freezes++;
    if (prize.kind === 'shield') this.s.shields++;
    this.log({ type: 'chest', value: prize.kind === 'xp' ? prize.amount : 0 });
    this.changed();
    return prize;
  }

  gradeRecall(key: string, cardId: string, gotIt: boolean) {
    if (this.recallDone.has(key)) return;
    this.recallDone.add(key);
    const e = this.s.srs[cardId] ?? { box: 0, due: 0 };
    if (gotIt) e.box = Math.min(TUNING.srsDays.length - 1, e.box + 1);
    else { e.box = 0; this.relearn.push({ cardId, atPos: this.cur + 6 }); }
    e.due = Date.now() + TUNING.srsDays[e.box] * 86400000;
    this.s.srs[cardId] = e;
    this.seenThisSession.add(cardId);
    this.gainXp(gotIt ? 8 : 3, CARD_BY_ID[cardId]?.subject);
    this.bumpCombo();
    this.log({ type: 'recall', cardId, value: gotIt ? 1 : 0 });
    this.changed();
  }

  /* ----- settings and courses ----- */

  setExam(id: CourseId, iso: string | null) {
    if (iso) this.s.exams[id] = iso; else delete this.s.exams[id];
    this.changed();
  }
  updateSettings(p: Partial<PersistedState['settings']>) {
    this.s.settings = { ...this.s.settings, ...p };
    this.changed();
  }

  /** 0–1 readiness for a course, from coverage, answers and review strength. */
  readiness(id: CourseId): number {
    const cards = courseCards(id);
    if (!cards.length) return 0;
    let sum = 0;
    for (const c of cards) {
      const st = this.s.cards[c.id];
      if (!st?.seen) continue;
      let m = 0.35 + 0.1 * Math.min(4, this.s.srs[c.id]?.box ?? 0);
      if (st.correct === true) m += 0.25;
      if (st.correct === false) m -= 0.15;
      sum += Math.max(0.1, Math.min(1, m));
    }
    return sum / cards.length;
  }
  courseProgress(id: CourseId): { seen: number; total: number } {
    const cards = courseCards(id);
    return { seen: cards.filter(c => this.s.cards[c.id]?.seen).length, total: cards.length };
  }
  courses() { return COURSES; }
  /** Best unseen hook, for notifications. */
  teaser(): Card | undefined {
    return CARDS.filter(c => !c.depthOnly && !this.s.cards[c.id]?.seen && c.hook >= 4 && (!c.chain || c.order === 1))
      .sort((a, b) => b.hook - a.hook)[0];
  }
}

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
