// Synthesises the app's sound set as small WAV files, so there are no third-party audio assets.
// Run: node scripts/make-sounds.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RATE = 22050;
const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'sounds');

function render(dur, fn) {
  const n = Math.floor(dur * RATE);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = fn(i / RATE);
  return out;
}
const env = (t, a, d) => (t < a ? t / a : Math.exp(-(t - a) / d));
const sweep = (t, f0, f1, dur) => {
  // phase of an exponential sweep
  const k = Math.log(f1 / f0) / dur;
  return (2 * Math.PI * f0 * (Math.exp(k * Math.min(t, dur)) - 1)) / k;
};
const sq = p => (Math.sin(p) >= 0 ? 1 : -1);
let seed = 7;
const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
function mix(...parts) {
  const n = Math.max(...parts.map(p => p.length));
  const out = new Float32Array(n);
  for (const p of parts) for (let i = 0; i < p.length; i++) out[i] += p[i];
  return out;
}
function delay(buf, sec) {
  const pad = Math.floor(sec * RATE);
  const out = new Float32Array(buf.length + pad);
  out.set(buf, pad);
  return out;
}
function lowpass(buf, cutoff) {
  const rc = 1 / (2 * Math.PI * cutoff), dt = 1 / RATE, a = dt / (rc + dt);
  const out = new Float32Array(buf.length);
  let y = 0;
  for (let i = 0; i < buf.length; i++) { y += a * (buf[i] - y); out[i] = y; }
  return out;
}
function highpass(buf, cutoff) {
  const lp = lowpass(buf, cutoff);
  return buf.map((v, i) => v - lp[i]);
}
function wav(name, buf, gain = 0.8) {
  let peak = 0;
  for (const v of buf) peak = Math.max(peak, Math.abs(v));
  const scale = peak ? gain / peak : 1;
  const data = Buffer.alloc(buf.length * 2);
  buf.forEach((v, i) => data.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(v * scale * 32767))), i * 2));
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(RATE, 24); h.writeUInt32LE(RATE * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(data.length, 40);
  const file = join(root, name + '.wav');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, Buffer.concat([h, data]));
}
const tone = (dur, f0, f1, a, d, shape = Math.sin) => render(dur, t => shape(sweep(t, f0, f1 || f0, dur)) * env(t, a, d));
const noiseHit = (dur, a, d) => render(dur, t => noise() * env(t, a, d));

/* ---- Swiss: dry, physical, punchy ---- */
wav('swiss/tick', mix(tone(0.09, 170, 80, 0.002, 0.025), highpass(noiseHit(0.03, 0.001, 0.004), 2500).map(v => v * 0.5)), 0.55);
wav('swiss/pop', mix(tone(0.12, 220, 110, 0.002, 0.04), tone(0.14, 880, 1320, 0.002, 0.04, sq).map(v => v * 0.25)), 0.7);
wav('swiss/nope', tone(0.22, 150, 85, 0.003, 0.08, p => (2 / Math.PI) * Math.asin(Math.sin(p))), 0.6);
wav('swiss/thud', mix(tone(0.3, 90, 40, 0.002, 0.09), lowpass(noiseHit(0.15, 0.001, 0.03), 500)), 0.8);
wav('swiss/legend', mix(tone(0.4, 120, 60, 0.002, 0.12), ...[1047, 1319, 1568, 2093].map((f, i) => delay(tone(0.35, f, f, 0.002, 0.09, sq).map(v => v * 0.18), 0.05 + i * 0.06))), 0.75);
wav('swiss/drop', mix(...[523, 659, 784, 1047, 1319].map((f, i) => delay(tone(0.2, f, f, 0.002, 0.06, sq).map(v => v * 0.3), i * 0.045)), delay(tone(0.35, 140, 70, 0.002, 0.1), 0.22)), 0.75);
wav('swiss/level', mix(...[392, 523, 659, 784, 1047].map((f, i) => delay(tone(0.5, f, f, 0.003, 0.18, sq).map(v => v * 0.22), i * 0.09)), delay(tone(0.6, 110, 55, 0.002, 0.2), 0.36)), 0.8);
wav('swiss/combo', mix(tone(0.12, 300, 900, 0.002, 0.05, sq).map(v => v * 0.3), tone(0.15, 160, 80, 0.002, 0.05)), 0.65);

console.log('sounds written to', root);
