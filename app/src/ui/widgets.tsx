import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import type { Widget } from '../content/types';
import type { SurfaceKind, Theme } from '../theme';
import { Label, Slider } from './primitives';

interface WProps { theme: Theme; surface: SurfaceKind; active: boolean; onTouch: () => void }

/** Shared plot frame: maps data coordinates into a 320×200 viewBox. */
function frame(xmin: number, xmax: number, ymin: number, ymax: number) {
  const L = 34, R = 310, T = 10, B = 180;
  return {
    X: (x: number) => L + ((x - xmin) / (xmax - xmin)) * (R - L),
    Y: (y: number) => B - ((y - ymin) / (ymax - ymin)) * (B - T),
    L, R, T, B,
  };
}
const pathOf = (pts: [number, number][]) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');

function Readout({ items, theme, surface }: { items: [string, string, boolean?][]; theme: Theme; surface: SurfaceKind }) {
  return (
    <View style={{ flexDirection: 'row', gap: 18, alignItems: 'flex-end' }}>
      {items.map(([k, v, hi]) => (
        <View key={k}>
          <Label theme={theme} surface={surface} color={theme.muted(surface)}>{k}</Label>
          <Text style={{ fontFamily: theme.heavy, fontSize: 30, color: hi ? theme.accent(surface) : theme.ink(surface), letterSpacing: theme.titleTracking / 2, fontVariant: ['tabular-nums'] }}>{v}</Text>
        </View>
      ))}
    </View>
  );
}

function Axes({ f, theme, surface, xt, yt, xl, yl }: { f: ReturnType<typeof frame>; theme: Theme; surface: SurfaceKind; xt: [number, string][]; yt: [number, string][]; xl: string; yl: string }) {
  const ink = theme.ink(surface), muted = theme.muted(surface);
  return (
    <G>
      {xt.map(([x]) => <Line key={'gx' + x} x1={f.X(x)} y1={f.T} x2={f.X(x)} y2={f.B} stroke={muted} strokeOpacity={0.25} strokeWidth={1} />)}
      {yt.map(([y]) => <Line key={'gy' + y} x1={f.L} y1={f.Y(y)} x2={f.R} y2={f.Y(y)} stroke={muted} strokeOpacity={0.25} strokeWidth={1} />)}
      <Path d={`M${f.L} ${f.T}V${f.B}H${f.R}`} stroke={ink} strokeWidth={2.5} fill="none" />
      {xt.map(([x, s]) => <SvgText key={'tx' + x} x={f.X(x)} y={f.B + 13} fontSize={10} fill={muted} textAnchor="middle">{s}</SvgText>)}
      {yt.map(([y, s]) => <SvgText key={'ty' + y} x={f.L - 5} y={f.Y(y) + 3.5} fontSize={10} fill={muted} textAnchor="end">{s}</SvgText>)}
      <SvgText x={f.R} y={f.B + 26} fontSize={10} fill={muted} textAnchor="end">{xl}</SvgText>
      <SvgText x={f.L + 4} y={f.T + 10} fontSize={10} fill={muted}>{yl}</SvgText>
    </G>
  );
}

/** Plays a demo loop until the user touches the slider. */
function useDemo(active: boolean, touched: boolean, set: (v: number) => void, period = 6000) {
  const raf = useRef<number | null>(null);
  useEffect(() => {
    if (!active || touched) return;
    const t0 = Date.now() + 700;
    const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
    const tick = () => {
      const t = ((Date.now() - t0) % period) / period;
      const v = Date.now() < t0 ? 0 : t < 0.12 ? 0 : t < 0.65 ? ease((t - 0.12) / 0.53) : t < 0.88 ? 1 : 1 - ease((t - 0.88) / 0.12);
      set(v);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current !== null) cancelAnimationFrame(raf.current); };
  }, [active, touched, set, period]);
}

/* ---------- derivative: secant → tangent ---------- */
function Secant({ theme, surface, active, onTouch }: WProps) {
  const [p, setP] = useState(0);
  const [touched, setTouched] = useState(false);
  useDemo(active, touched, setP);
  const f = frame(0, 4, 0, 80);
  const curve = useMemo(() => pathOf(Array.from({ length: 81 }, (_, i) => { const t = i * 0.05; return [f.X(t), f.Y(5 * t * t)]; })), [f]);
  const h = Math.pow(10, Math.log10(2) + (Math.log10(0.01) - Math.log10(2)) * p);
  const t2 = 2 + h, s2 = 5 * t2 * t2, m = (s2 - 20) / h;
  const line = (t: number) => [f.X(t), f.Y(20 + m * (t - 2))];
  const [x1, y1] = line(0.7), [x2, y2] = line(4.1);
  const ink = theme.ink(surface), acc = theme.accent(surface);
  return (
    <View style={{ gap: 6 }}>
      <Svg viewBox="0 0 320 210" style={{ width: '100%', aspectRatio: 320 / 210, maxHeight: 210 }}>
        <Axes f={f} theme={theme} surface={surface} xt={[[1, '1'], [2, '2'], [3, '3'], [4, '4']]} yt={[[20, '20'], [40, '40'], [60, '60'], [80, '80']]} xl="t (s)" yl="s (m)" />
        <Path d={curve} stroke={ink} strokeWidth={2.5} fill="none" />
        {h < 0.3 && <Line x1={line(0.9)[0]} y1={f.Y(20 + 20 * -1.1)} x2={f.X(4)} y2={f.Y(60)} stroke={ink} strokeDasharray="4 4" strokeOpacity={(0.3 - h) / 0.3} />}
        <Line x1={x1} y1={Math.min(f.B, Math.max(f.T - 40, y1))} x2={x2} y2={y2} stroke={acc} strokeWidth={5} />
        <Path d={`M${f.X(2)} ${f.Y(20)}H${f.X(t2)}V${f.Y(s2)}`} stroke={acc} strokeDasharray="3 3" fill="none" />
        <Circle cx={f.X(2)} cy={f.Y(20)} r={5} fill={ink} />
        <Circle cx={f.X(t2)} cy={f.Y(s2)} r={6} fill={theme.bg(surface)} stroke={acc} strokeWidth={3} />
      </Svg>
      <Readout theme={theme} surface={surface} items={[['Gap h', `${h >= 0.1 ? h.toFixed(2) : h.toFixed(3)} s`], ['Avg speed', `${h >= 0.1 ? m.toFixed(1) : m.toFixed(2)} m/s`, true]]} />
      <Text style={{ fontFamily: theme.label, fontSize: 13, color: ink, minHeight: 18 }}>{h < 0.03 ? 'Gap → 0, speed → 20 m/s. That is the derivative.' : ' '}</Text>
      <Slider theme={theme} surface={surface} value={p} onStart={() => { if (!touched) { setTouched(true); onTouch(); } }} onChange={setP} />
    </View>
  );
}

/* ---------- integral: Riemann sums ---------- */
function Riemann({ theme, surface, active, onTouch }: WProps) {
  const [p, setP] = useState(0);
  const [touched, setTouched] = useState(false);
  useDemo(active, touched, setP, 7000);
  const n = Math.max(2, Math.round(2 + p * 62));
  const f = frame(0, 1, 0, 1);
  const ink = theme.ink(surface), acc = theme.accent(surface);
  let area = 0;
  const rects = Array.from({ length: n }, (_, i) => {
    const x0 = i / n, x1 = (i + 1) / n, y = x1 * x1;
    area += y / n;
    return <Rect key={i} x={f.X(x0)} y={f.Y(y)} width={f.X(x1) - f.X(x0)} height={f.B - f.Y(y)} fill={acc} fillOpacity={0.35} stroke={acc} strokeWidth={n > 30 ? 0.5 : 1.2} />;
  });
  const curve = pathOf(Array.from({ length: 51 }, (_, i) => [f.X(i / 50), f.Y((i / 50) ** 2)]));
  return (
    <View style={{ gap: 6 }}>
      <Svg viewBox="0 0 320 210" style={{ width: '100%', aspectRatio: 320 / 210, maxHeight: 210 }}>
        <Axes f={f} theme={theme} surface={surface} xt={[[0.5, '0.5'], [1, '1']]} yt={[[0.5, '0.5'], [1, '1']]} xl="x" yl="y = x²" />
        {rects}
        <Path d={curve} stroke={ink} strokeWidth={3} fill="none" />
      </Svg>
      <Readout theme={theme} surface={surface} items={[['Rectangles', String(n)], ['Area', area.toFixed(4), true], ['Exact', '0.3333']]} />
      <Slider theme={theme} surface={surface} value={p} onStart={() => { if (!touched) { setTouched(true); onTouch(); } }} onChange={setP} />
    </View>
  );
}

/* ---------- Taylor series of sin x ---------- */
function Taylor({ theme, surface, active, onTouch }: WProps) {
  const [p, setP] = useState(0);
  const [touched, setTouched] = useState(false);
  useDemo(active, touched, setP, 8000);
  const k = 1 + Math.round(p * 7);
  const f = frame(-2 * Math.PI, 2 * Math.PI, -2.2, 2.2);
  const ink = theme.ink(surface), acc = theme.accent(surface);
  const fact = (n: number) => { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; };
  const poly = (x: number) => { let s = 0; for (let j = 0; j < k; j++) s += ((j % 2 ? -1 : 1) * Math.pow(x, 2 * j + 1)) / fact(2 * j + 1); return s; };
  const pts = (fn: (x: number) => number) => Array.from({ length: 161 }, (_, i) => { const x = -2 * Math.PI + (i / 160) * 4 * Math.PI; return [f.X(x), f.Y(Math.max(-2.6, Math.min(2.6, fn(x))))] as [number, number]; });
  const terms = ['x', '− x³/3!', '+ x⁵/5!', '− x⁷/7!', '+ x⁹/9!', '− x¹¹/11!', '+ x¹³/13!', '− x¹⁵/15!'].slice(0, k).join(' ');
  return (
    <View style={{ gap: 6 }}>
      <Svg viewBox="0 0 320 210" style={{ width: '100%', aspectRatio: 320 / 210, maxHeight: 210 }}>
        <Axes f={f} theme={theme} surface={surface} xt={[[-Math.PI, '−π'], [0, '0'], [Math.PI, 'π'], [2 * Math.PI, '2π']]} yt={[[-1, '−1'], [1, '1']]} xl="x" yl="sin x" />
        <Rect x={f.L} y={0} width={f.R - f.L} height={f.T} fill={theme.bg(surface)} />
        <Path d={pathOf(pts(Math.sin))} stroke={ink} strokeWidth={2.5} fill="none" />
        <Path d={pathOf(pts(poly))} stroke={acc} strokeWidth={4.5} fill="none" />
      </Svg>
      <Readout theme={theme} surface={surface} items={[['Terms', String(k), true]]} />
      <Text style={{ fontFamily: theme.eq, fontSize: 13, color: ink }}>{terms}</Text>
      <Slider theme={theme} surface={surface} value={p} steps={7} onStart={() => { if (!touched) { setTouched(true); onTouch(); } }} onChange={setP} />
    </View>
  );
}

/* ---------- compound interest ---------- */
function Compound({ theme, surface, active, onTouch }: WProps) {
  const [p, setP] = useState(0.2);
  const [touched, setTouched] = useState(false);
  useDemo(active, touched, setP, 7000);
  const years = Math.round(p * 50);
  const f = frame(0, 50, 0, 30000);
  const ink = theme.ink(surface), acc = theme.accent(surface);
  const v = (t: number) => 1000 * Math.pow(1.07, t);
  const curve = pathOf(Array.from({ length: 51 }, (_, i) => [f.X(i), f.Y(v(i))]));
  const upTo = pathOf(Array.from({ length: years + 1 }, (_, i) => [f.X(i), f.Y(v(i))]));
  return (
    <View style={{ gap: 6 }}>
      <Svg viewBox="0 0 320 210" style={{ width: '100%', aspectRatio: 320 / 210, maxHeight: 210 }}>
        <Axes f={f} theme={theme} surface={surface} xt={[[10, '10'], [20, '20'], [30, '30'], [40, '40'], [50, '50']]} yt={[[10000, '10k'], [20000, '20k'], [30000, '30k']]} xl="years" yl="£" />
        <Path d={curve} stroke={ink} strokeOpacity={0.35} strokeWidth={2} fill="none" />
        {years > 0 && <Path d={upTo} stroke={acc} strokeWidth={5} fill="none" />}
        <Circle cx={f.X(years)} cy={f.Y(v(years))} r={6} fill={acc} />
      </Svg>
      <Readout theme={theme} surface={surface} items={[['Years', String(years)], ['Balance', `£${Math.round(v(years)).toLocaleString('en-GB')}`, true]]} />
      <Text style={{ fontFamily: theme.label, fontSize: 13, color: ink }}>Doubles roughly every 10 years. Year 50 is worth 4× year 30.</Text>
      <Slider theme={theme} surface={surface} value={p} onStart={() => { if (!touched) { setTouched(true); onTouch(); } }} onChange={setP} />
    </View>
  );
}

/* ---------- birthday paradox ---------- */
function Birthday({ theme, surface, active, onTouch }: WProps) {
  const [p, setP] = useState(0);
  const [touched, setTouched] = useState(false);
  useDemo(active, touched, setP, 7000);
  const n = Math.max(1, Math.round(1 + p * 69));
  const prob = (k: number) => { let q = 1; for (let i = 0; i < k; i++) q *= (365 - i) / 365; return 1 - q; };
  const f = frame(1, 70, 0, 1);
  const ink = theme.ink(surface), acc = theme.accent(surface);
  const curve = pathOf(Array.from({ length: 70 }, (_, i) => [f.X(i + 1), f.Y(prob(i + 1))]));
  return (
    <View style={{ gap: 6 }}>
      <Svg viewBox="0 0 320 210" style={{ width: '100%', aspectRatio: 320 / 210, maxHeight: 210 }}>
        <Axes f={f} theme={theme} surface={surface} xt={[[23, '23'], [50, '50'], [70, '70']]} yt={[[0.5, '50%'], [1, '100%']]} xl="people" yl="P(shared)" />
        <Path d={curve} stroke={ink} strokeWidth={2.5} fill="none" />
        <Line x1={f.X(n)} y1={f.B} x2={f.X(n)} y2={f.Y(prob(n))} stroke={acc} strokeWidth={2} strokeDasharray="3 3" />
        <Circle cx={f.X(n)} cy={f.Y(prob(n))} r={6} fill={acc} />
      </Svg>
      <Readout theme={theme} surface={surface} items={[['People', String(n)], ['Chance', `${(prob(n) * 100).toFixed(1)}%`, true]]} />
      <Slider theme={theme} surface={surface} value={p} onStart={() => { if (!touched) { setTouched(true); onTouch(); } }} onChange={setP} />
    </View>
  );
}

const WIDGETS: Record<Widget, (p: WProps) => React.ReactElement> = { secant: Secant, riemann: Riemann, taylor: Taylor, compound: Compound, birthday: Birthday };

export function WidgetView({ widget, ...p }: WProps & { widget: Widget }) {
  const W = WIDGETS[widget];
  return <W {...p} />;
}
