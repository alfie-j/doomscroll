import type { Card, Chain, Course, CourseId } from './types';
import * as M from './maths';
import * as P from './physics';
import * as B from './breadth';

type Built = { meta: Chain; cards: Card[] };

const BUILT: Built[] = [
  M.c1Limits, M.c1Deriv, M.c1Apps, M.c1Int,
  M.c2Tech, M.c2Series, M.c2Fourier,
  M.c3Part, M.c3Mult, M.c3Vec,
  M.infinity,
  P.p1Kin, P.p1New, P.p1En, P.p1Rot, P.p1Adv,
  P.p2Stat, P.p2Circ, P.p2Mag, P.p2Max, P.p2Adv,
  P.p3Wave, P.p3Thermo, P.p3Rel, P.p3Qm, P.p3Adv,
  P.everyday,
  B.philoThought, B.philoSci, B.litStories, B.litPhysics, B.history,
  B.memory, B.biases, B.probability, B.cs, B.money, B.bio,
];

export const COURSES: Course[] = [
  { id: 'calc1', name: 'Calculus 1', short: 'CALC 1', subject: 'maths' },
  { id: 'calc2', name: 'Calculus 2', short: 'CALC 2', subject: 'maths' },
  { id: 'calc3', name: 'Calculus 3 (MVC)', short: 'CALC 3', subject: 'maths' },
  { id: 'phys1', name: 'Physics 1: Mechanics', short: 'PHYS 1', subject: 'physics' },
  { id: 'phys2', name: 'Physics 2: E&M', short: 'PHYS 2', subject: 'physics' },
  { id: 'phys3', name: 'Physics 3: Modern', short: 'PHYS 3', subject: 'physics' },
];

export const CHAINS: Record<string, Chain> = Object.fromEntries(BUILT.map(b => [b.meta.id, b.meta]));

export const CARDS: Card[] = [
  ...BUILT.flatMap(b => b.cards),
  ...M.mathsMemes, ...P.physicsMemes, ...B.memes,
  ...M.mathsDepth, ...B.breadthDepth,
];

export const CARD_BY_ID: Record<string, Card> = Object.fromEntries(CARDS.map(c => [c.id, c]));

export const CHAIN_LENGTH: Record<string, number> = {};
for (const c of CARDS) if (c.chain) CHAIN_LENGTH[c.chain] = Math.max(CHAIN_LENGTH[c.chain] ?? 0, c.order ?? 0);

export const CHAIN_CARDS: Record<string, Card[]> = {};
for (const c of CARDS) if (c.chain) (CHAIN_CARDS[c.chain] ??= []).push(c);
for (const k in CHAIN_CARDS) CHAIN_CARDS[k].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

export function courseOf(card: Card): CourseId | undefined {
  return card.chain ? CHAINS[card.chain]?.course : undefined;
}

export function courseCards(id: CourseId): Card[] {
  return CARDS.filter(c => courseOf(c) === id);
}

/** Throws on broken content so mistakes show up immediately in development and tests. */
export function validateContent(): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const c of CARDS) {
    if (seen.has(c.id)) errors.push(`duplicate id ${c.id}`);
    seen.add(c.id);
    for (const d of c.deeper ?? []) if (!CARD_BY_ID[d]) errors.push(`${c.id}: deeper ${d} missing`);
    if (c.format === 'quiz' || c.format === 'predict') {
      if (!c.options || c.answer === undefined || c.answer < 0 || c.answer >= c.options.length) errors.push(`${c.id}: bad options/answer`);
      if (!c.reveal?.length) errors.push(`${c.id}: missing reveal`);
    }
    if (c.format === 'myth' && (c.truth === undefined || !c.reveal?.length)) errors.push(`${c.id}: myth needs truth + reveal`);
    if (c.format === 'meme' && !c.panels?.length) errors.push(`${c.id}: meme needs panels`);
    if (c.format === 'interactive' && !c.widget) errors.push(`${c.id}: interactive needs widget`);
    if (c.chain && !CHAINS[c.chain]) errors.push(`${c.id}: unknown chain ${c.chain}`);
  }
  for (const ch of Object.values(CHAINS)) if (ch.after && !CHAINS[ch.after]) errors.push(`${ch.id}: after ${ch.after} missing`);
  return errors;
}
