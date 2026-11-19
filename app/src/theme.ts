import type { Subject } from './content/types';

export type ThemeName = 'swiss';
export type SurfaceKind = Subject | 'chest' | 'milestone' | 'recall';

export interface Theme {
  name: ThemeName;
  display: string; // giant hook type
  heavy: string; // titles
  body: string;
  label: string; // uppercase labels, buttons
  eq: string; // equations
  bg(s: SurfaceKind): string;
  ink(s: SurfaceKind): string;
  muted(s: SurfaceKind): string;
  accent(s: SurfaceKind): string; // emphasis colour on the card
  onAccent(s: SurfaceKind): string; // text sitting on the accent
  gold: string;
  rule: number; // border weight
  radius: number;
  titleTracking: number;
  hookTracking: number;
}

const SWISS_BG: Record<SurfaceKind, string> = {
  maths: '#1E3CFF', physics: '#FF4F1A', psych: '#00A35C', stats: '#FFD200', cs: '#0A0A0A',
  econ: '#FF8FB8', bio: '#C6F432', history: '#EDE8DC', philo: '#8B6CFF', lit: '#00B8B0',
  chest: '#0A0A0A', milestone: '#E8B400', recall: '#FFFFFF',
};
const SWISS_INK: Record<SurfaceKind, string> = {
  maths: '#FFFFFF', physics: '#0A0A0A', psych: '#0A0A0A', stats: '#0A0A0A', cs: '#FFFFFF',
  econ: '#0A0A0A', bio: '#0A0A0A', history: '#0A0A0A', philo: '#0A0A0A', lit: '#0A0A0A',
  chest: '#FFFFFF', milestone: '#0A0A0A', recall: '#0A0A0A',
};

export const swiss: Theme = {
  name: 'swiss',
  display: 'ArchivoCondBlack',
  heavy: 'ArchivoCondHeavy',
  body: 'ArchivoRegular',
  label: 'ArchivoBold',
  eq: 'ArchivoSemiBold',
  bg: s => SWISS_BG[s],
  ink: s => SWISS_INK[s],
  muted: s => (SWISS_INK[s] === '#FFFFFF' ? 'rgba(255,255,255,0.72)' : 'rgba(10,10,10,0.66)'),
  accent: s => (s === 'chest' ? '#E8B400' : SWISS_INK[s]),
  onAccent: s => (s === 'chest' ? '#0A0A0A' : SWISS_BG[s]),
  gold: '#E8B400',
  rule: 3,
  radius: 0,
  titleTracking: -1.2,
  hookTracking: -2.5,
};

export const themes = { swiss };

export const SUBJECT_NAME: Record<Subject, string> = {
  maths: 'Maths', physics: 'Physics', psych: 'Psychology', stats: 'Stats', cs: 'Computing',
  econ: 'Economics', bio: 'Biology', history: 'History', philo: 'Philosophy', lit: 'Literature',
};
export const SUBJECT_NOUN: Record<Subject, string> = {
  maths: 'Mathematician', physics: 'Physicist', psych: 'Psychologist', stats: 'Statistician', cs: 'Computer Scientist',
  econ: 'Economist', bio: 'Biologist', history: 'Historian', philo: 'Philosopher', lit: 'Reader',
};
