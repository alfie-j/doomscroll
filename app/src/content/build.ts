import type { Card, Chain, Subject } from './types';

type Draft = Omit<Card, 'chain' | 'order' | 'subject'> & { subject?: Subject };

/** Builds an ordered chain: each card gets the chain id and its position. */
export function chain(meta: Chain, drafts: Draft[]): { meta: Chain; cards: Card[] } {
  return {
    meta,
    cards: drafts.map((d, i) => ({ ...d, subject: d.subject ?? meta.subject, chain: meta.id, order: i + 1 })),
  };
}

/** Cards reached only by swiping right from another card. */
export function depth(subject: Subject, drafts: Omit<Card, 'subject' | 'depthOnly'>[]): Card[] {
  return drafts.map(d => ({ ...d, subject, depthOnly: true }));
}
