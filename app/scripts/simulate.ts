// Validates the deck and simulates swiping sessions through the engine. Run: npx tsx scripts/simulate.ts
import { CARDS, CARD_BY_ID, courseOf, validateContent } from '../src/content';
import { Engine } from '../src/engine/engine';
import { setRandom, seeded } from '../src/engine/random';
import { defaultState } from '../src/engine/state';

const errors = validateContent();
console.log(`cards: ${CARDS.length} (${CARDS.filter(c => courseOf(c)).length} course, ${CARDS.filter(c => !courseOf(c)).length} breadth)`);
if (errors.length) { console.error('CONTENT ERRORS\n' + errors.join('\n')); process.exit(1); }

setRandom(seeded(42));
const e = new Engine(defaultState());
// Read The Time Machine along the way: three bites each time one turns up.
const tm = require('../src/content/books/time-machine.json');
e.setReading(tm);
const kinds: Record<string, number> = {};
const formats: string[] = [];
let courseN = 0, breadthN = 0, prevFormat = '', sameFmt = 0;
for (let i = 0; i < 160; i++) {
  const it = e.items[e.cur];
  kinds[it.kind] = (kinds[it.kind] ?? 0) + 1;
  let dwell = 6000, interacted = false;
  if (it.kind === 'card') {
    const c = CARD_BY_ID[it.cardId];
    formats.push(`${c.subject}/${c.format}`);
    if (courseOf(c)) courseN++; else breadthN++;
    if (c.format === prevFormat) sameFmt++;
    prevFormat = c.format;
    if (c.subject === 'history') dwell = 800; // this simulated user skips history
    if (c.format === 'quiz' || c.format === 'predict' || c.format === 'myth') { e.answer(c.id, Math.random() < 0.7, 25); interacted = true; }
  }
  if (it.kind === 'chest') { e.openChest(it.key); interacted = true; }
  if (it.kind === 'recall') { e.gradeRecall(it.key, it.cardId, true); interacted = true; }
  if (it.kind === 'read') for (let k = 0; k < 3; k++) e.readBite(it.bookId, it.start + k);
  e.exit(e.cur, { dwellMs: dwell, deeper: false, interacted, revisit: false });
  e.setCurrent(e.cur + 1);
  e.drainEffects();
}
console.log('item kinds over 160 swipes:', kinds);
console.log(`course/breadth cards: ${courseN}/${breadthN}  same-format-back-to-back: ${sameFmt}`);
console.log('first 12:', formats.slice(0, 12).join(', '));
console.log(`xp ${e.s.xp}, level ${e.level}, streak ${e.s.streak.count}, daily ${e.s.daily.done}/${e.goal} completed=${e.s.daily.completed}, best combo ${e.s.bestCombo}`);
const arms = Object.entries(e.s.arms).map(([k, [a, b]]) => [k, (a / (a + b)).toFixed(2), (a + b - 2).toFixed(1)]).sort((x, y) => Number(y[1]) - Number(x[1]));
console.log('top arms:', arms.slice(0, 4).map(a => a.join(' ')).join(' | '));
console.log('bottom arms:', arms.slice(-3).map(a => a.join(' ')).join(' | '));
console.log('history cards shown after 40 swipes:', formats.slice(40).filter(f => f.startsWith('history')).length);
console.log(`reading: ${e.s.books['time-machine'].progress}/${e.s.books['time-machine'].total} bites, today ${e.s.daily.readBites}`);
console.log('readiness calc1:', e.readiness('calc1').toFixed(2), 'phys1:', e.readiness('phys1').toFixed(2));
