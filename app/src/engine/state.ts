import type { CourseId, Subject } from '../content/types';
import type { ThemeName } from '../theme';

export type ThemeSetting = ThemeName;

export interface CardStat {
  seen: number;
  last: number; // ms timestamp
  dwell: number; // total ms
  liked?: boolean;
  saved?: boolean;
  correct?: boolean; // last answer
  deeper?: boolean;
}

export interface SrsEntry { box: number; due: number }

export interface PersistedState {
  v: 1;
  xp: number;
  subjectXp: Partial<Record<Subject, number>>;
  titles: string[];
  streak: { count: number; lastDay: string | null; freezes: number; best: number };
  daily: { day: string; done: number; completed: boolean };
  shields: number;
  bestCombo: number;
  arms: Record<string, [number, number]>;
  cards: Record<string, CardStat>;
  chains: Record<string, number>; // highest order seen
  srs: Record<string, SrsEntry>;
  exams: Partial<Record<CourseId, string>>; // ISO date
  settings: { theme: ThemeSetting; sound: boolean; haptics: boolean; stopAtGoal: boolean; goal: number; courseShare: number };
  sessions: { start: number; end: number; cards: number }[];
  daysUsed: string[];
  openHours: number[];
}

export function dayKey(t: number = Date.now()): string {
  const d = new Date(t);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

export function defaultState(): PersistedState {
  return {
    v: 1,
    xp: 0,
    subjectXp: {},
    titles: [],
    streak: { count: 0, lastDay: null, freezes: 1, best: 0 },
    daily: { day: dayKey(), done: 0, completed: false },
    shields: 0,
    bestCombo: 0,
    arms: {},
    cards: {},
    chains: {},
    srs: {},
    exams: {},
    settings: { theme: 'swiss', sound: true, haptics: true, stopAtGoal: false, goal: 15, courseShare: 0.6 },
    sessions: [],
    daysUsed: [],
    openHours: Array(24).fill(0),
  };
}

/** Fills in fields added after a state was saved, so old saves keep loading. */
export function migrate(raw: unknown): PersistedState {
  const base = defaultState();
  if (!raw || typeof raw !== 'object') return base;
  const s = raw as Partial<PersistedState>;
  return {
    ...base,
    ...s,
    streak: { ...base.streak, ...(s.streak ?? {}) },
    daily: { ...base.daily, ...(s.daily ?? {}) },
    settings: { ...base.settings, ...(s.settings ?? {}) },
    openHours: Array.isArray(s.openHours) && s.openHours.length === 24 ? s.openHours : base.openHours,
  };
}

export interface LogEvent {
  ts: number;
  type: 'exit' | 'answer' | 'chest' | 'recall' | 'like' | 'save' | 'deeper';
  cardId?: string;
  subject?: string;
  format?: string;
  dwell?: number;
  value?: number;
}
