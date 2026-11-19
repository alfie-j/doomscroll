// Splits a book's plain text into bite-sized passages (~150 words), keeping paragraphs whole where
// possible and recording chapter starts. Shared by the bundling script and on-device import.
import type { BookData, Chapter } from './types';

const TARGET = 105, MIN = 60, MAX = 150;
const HEADING = /^(chapter|book|part|letter|volume|section|canto|act|scene|stave)\b[\s.:\-–—]*[\w\s.,'’:\-–—]{0,60}$|^[ivxlcdm]+\.?$|^\d{1,3}\.?$/i;

const NUMERAL = /^([ivxlcdm]+|\d{1,3})\.?$/i;
const words = (s: string) => (s.match(/\S+/g) ?? []).length;

/** Removes Project Gutenberg's licence header and footer if present. */
export function stripGutenberg(text: string): string {
  const start = text.search(/\*\*\*\s*START OF (THE|THIS) PROJECT GUTENBERG[^\n]*\n/i);
  const end = text.search(/\*\*\*\s*END OF (THE|THIS) PROJECT GUTENBERG/i);
  let body = text;
  if (start >= 0) body = body.slice(body.indexOf('\n', start) + 1);
  if (end >= 0) body = body.slice(0, body.search(/\*\*\*\s*END OF (THE|THIS) PROJECT GUTENBERG/i));
  return body;
}

/** Turns raw text into paragraphs, unwrapping hard line breaks inside them. */
export function paragraphs(text: string): string[] {
  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map(p => p.replace(/\s*\n\s*/g, ' ').replace(/[ \t]+/g, ' ').replace(/(^|[\s(])_([^_]+)_(?=[\s.,;:!?'")]|$)/g, '$1$2').replace(/--/g, '—').trim())
    .filter(p => p.length > 0 && !/^[*_\-=~\s.]+$/.test(p));
}

function isHeading(p: string): boolean {
  return p.length <= 70 && words(p) <= 10 && (HEADING.test(p) || (p === p.toUpperCase() && /[A-Z]{2}/.test(p) && words(p) <= 8 && !/[.!?]$/.test(p)));
}

/** Breaks an over-long sentence at semicolons, colons or commas, then by word count as a last resort. */
function splitSentence(s: string): string[] {
  if (words(s) <= MAX) return [s];
  const parts = s.match(/[^;:,]+[;:,]+\s*|[^;:,]+$/g) ?? [s];
  const out: string[] = [];
  let cur = '';
  for (const part of parts) {
    if (cur && words(cur) + words(part) > TARGET) { out.push(cur); cur = ''; }
    cur += part;
  }
  if (cur) out.push(cur);
  return out.flatMap(x => {
    if (words(x) <= MAX) return [x];
    const w = x.match(/\S+\s*/g) ?? [x];
    const chunks: string[] = [];
    for (let i = 0; i < w.length; i += TARGET) chunks.push(w.slice(i, i + TARGET).join(''));
    return chunks;
  });
}

function splitLong(p: string): string[] {
  const sentences = (p.match(/[^.!?]+[.!?]+["'”’)\]]*\s*|[^.!?]+$/g) ?? [p]).flatMap(splitSentence);
  const out: string[] = [];
  let cur = '';
  for (const s of sentences) {
    if (cur && words(cur) + words(s) > TARGET) { out.push(cur.trim()); cur = ''; }
    cur += s;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** Splits paragraphs into bites. Headings start new bites and are recorded as chapters. */
export function toBites(paras: string[]): { bites: string[]; chapters: Chapter[] } {
  const bites: string[] = [];
  const chapters: Chapter[] = [];
  let cur: string[] = [];
  let pendingHeading: string | null = null;
  let major: string | null = null;
  const flush = () => {
    if (!cur.length) return;
    bites.push(cur.join('\n\n'));
    cur = [];
  };
  for (const p of paras) {
    if (isHeading(p)) {
      flush();
      pendingHeading = pendingHeading ? `${pendingHeading} · ${p}` : p;
      continue;
    }
    if (pendingHeading) {
      // A bare numeral ("II.") inherits the last named heading, so a reader sees "A Scandal in Bohemia · II."
      const parts = pendingHeading.split(' · ');
      const named = parts.filter(x => !NUMERAL.test(x));
      if (named.length) major = titleCase(named.join(' · '));
      const title = named.length ? titleCase(pendingHeading) : major ? `${major} · ${pendingHeading}` : pendingHeading;
      chapters.push({ title, bite: bites.length });
      pendingHeading = null;
    }
    const pieces = words(p) > TARGET + 30 ? splitLong(p) : [p];
    for (const piece of pieces) {
      const n = cur.reduce((a, s) => a + words(s), 0);
      if ((n >= MIN && n + words(piece) > TARGET) || (n > 0 && n + words(piece) > MAX)) flush();
      cur.push(piece);
      if (cur.reduce((a, s) => a + words(s), 0) >= MAX) flush();
    }
  }
  flush();
  return { bites, chapters };
}

function titleCase(s: string): string {
  if (s !== s.toUpperCase()) return s;
  return s.toLowerCase().replace(/\b([a-z])/g, m => m.toUpperCase()).replace(/\b(Ii|Iii|Iv|Vi|Vii|Viii|Ix|Xi|Xii)\b/g, m => m.toUpperCase());
}

export function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'book';
}

export function bookFromText(text: string, title: string, author: string, id?: string): BookData {
  const { bites, chapters } = toBites(paragraphs(stripGutenberg(text)));
  return { id: id ?? `${slug(title)}-${Date.now().toString(36)}`, title, author, bites, chapters };
}

/** Best-effort title/author from a Gutenberg-style header. */
export function guessTitleAuthor(text: string, fallback: string): { title: string; author: string } {
  const t = /^Title:\s*(.+)$/m.exec(text)?.[1]?.trim();
  const a = /^Author:\s*(.+)$/m.exec(text)?.[1]?.trim();
  return { title: t ?? fallback.replace(/\.(txt|epub)$/i, ''), author: a ?? 'Unknown' };
}
