// Compiles the hand-written deck in content-src/*.cards into src/content/generated.json.
// Run: npx tsx scripts/compile-cards.ts
//
// Format (one card per block, blank line between cards):
//   ## chain-id | Chain name | subject | level 0-4 | course or - | after-chain or -
//   quiz 3 | Question?            <- header: format, hook 1-5 ("5!" = legendary), myth adds T/F
//   - body line                   (`- $ ...` renders as an equation, *word* highlights)
//   * correct option
//   o other option
//   = reveal line (after answering)
//   % who :: says                 (meme panel)
//   ? recall question :: answer
//   > cliffhanger
// Formats: hook explain story real quiz predict myth meme
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Card, Chain, CourseId, Format, Level, Subject } from '../src/content/types';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'content-src');
const SUBJECTS: Subject[] = ['maths', 'physics', 'philo', 'lit', 'history', 'psych', 'stats', 'cs', 'econ', 'bio', 'chem', 'arts', 'lang', 'earth'];
const COURSES: CourseId[] = ['calc1', 'calc2', 'calc3', 'phys1', 'phys2', 'phys3'];
const FORMATS: Record<string, Format> = { hook: 'hook', explain: 'explain', story: 'story', real: 'reallife', quiz: 'quiz', predict: 'predict', myth: 'myth', meme: 'meme' };

const chains: Chain[] = [];
const cards: Card[] = [];
const errors: string[] = [];

for (const file of readdirSync(srcDir).filter(f => f.endsWith('.cards')).sort()) {
  const lines = readFileSync(join(srcDir, file), 'utf8').split('\n');
  let chain: Chain | null = null;
  let order = 0;
  let card: (Card & { _opts?: [string, boolean][] }) | null = null;
  const where = (n: number) => `${file}:${n + 1}`;

  const finish = () => {
    if (!card) return;
    const c = card;
    if (c._opts) { c.options = c._opts.map(o => o[0]); c.answer = c._opts.findIndex(o => o[1]); delete c._opts; }
    if (!c.cliff) errors.push(`${c.id}: missing cliff (>)`);
    if ((c.format === 'quiz' || c.format === 'predict') && (!c.options || c.options.length < 2 || c.answer === undefined || c.answer < 0)) errors.push(`${c.id}: needs options with one * correct`);
    if ((c.format === 'quiz' || c.format === 'predict' || c.format === 'myth') && !c.reveal?.length) errors.push(`${c.id}: needs = reveal lines`);
    if (c.format === 'meme' && !c.panels?.length) errors.push(`${c.id}: meme needs % panels`);
    if (c.title.length > 170) errors.push(`${c.id}: title too long (${c.title.length})`);
    cards.push(c);
    card = null;
  };

  lines.forEach((raw, n) => {
    const line = raw.trimEnd();
    if (!line.trim()) { finish(); return; }
    if (line.startsWith('## ')) {
      finish();
      const [id, name, subject, level, course, after] = line.slice(3).split('|').map(s => s.trim());
      if (!SUBJECTS.includes(subject as Subject)) errors.push(`${where(n)}: bad subject ${subject}`);
      if (course !== '-' && !COURSES.includes(course as CourseId)) errors.push(`${where(n)}: bad course ${course}`);
      chain = { id, name, subject: subject as Subject, level: Number(level) as Level, ...(course !== '-' ? { course: course as CourseId } : {}), ...(after && after !== '-' ? { after } : {}) };
      chains.push(chain);
      order = 0;
      return;
    }
    if (line.startsWith('#')) return; // comment
    if (!chain) { errors.push(`${where(n)}: card before any ## chain`); return; }
    const head = /^(hook|explain|story|real|quiz|predict|myth|meme)\s+([1-5])(!?)\s*([TF])?\s*\|\s*(.+)$/.exec(line);
    if (head) {
      finish();
      order++;
      const [, fmt, hook, leg, tf, title] = head;
      card = { id: `${chain.id}-${order}`, subject: chain.subject, format: FORMATS[fmt], hook: Number(hook) as Card['hook'], title: title.trim(), cliff: '', chain: chain.id, order };
      if (leg) card.legendary = true;
      if (fmt === 'myth') { if (!tf) errors.push(`${where(n)}: myth needs T or F`); card.truth = tf === 'T'; }
      return;
    }
    if (!card) { errors.push(`${where(n)}: line outside a card: ${line.slice(0, 40)}`); return; }
    const tag = line.slice(0, 2), body = line.slice(2).trim();
    switch (tag) {
      case '- ': (card.lines ??= []).push(body); break;
      case '= ': (card.reveal ??= []).push(body); break;
      case '* ': (card._opts ??= []).push([body, true]); break;
      case 'o ': (card._opts ??= []).push([body, false]); break;
      case '> ': card.cliff = body; break;
      case '% ': { const [who, says] = body.split('::').map(s => s.trim()); (card.panels ??= []).push([who, says ?? '']); break; }
      case '? ': { const [q, a] = body.split('::').map(s => s.trim()); if (!a) errors.push(`${where(n)}: recall needs q :: a`); card.recall = [q, a ?? '']; break; }
      default: errors.push(`${where(n)}: unknown line: ${line.slice(0, 50)}`);
    }
  });
  finish();
}

const ids = new Set<string>();
for (const c of cards) { if (ids.has(c.id)) errors.push(`duplicate card id ${c.id}`); ids.add(c.id); }
const chainIds = new Set<string>();
for (const ch of chains) { if (chainIds.has(ch.id)) errors.push(`duplicate chain id ${ch.id}`); chainIds.add(ch.id); }

if (errors.length) {
  console.error(`${errors.length} error(s):\n` + errors.slice(0, 80).join('\n'));
  process.exit(1);
}
writeFileSync(join(root, 'src/content/generated.json'), JSON.stringify({ chains, cards }));
const by: Record<string, number> = {};
for (const c of cards) by[c.subject] = (by[c.subject] ?? 0) + 1;
console.log(`compiled ${cards.length} cards in ${chains.length} chains`, by);
