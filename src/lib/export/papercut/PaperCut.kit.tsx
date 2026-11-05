// @ts-nocheck
/* eslint-disable */
// PaperCut.tsx — pustaka komponen paper-cut + renderer deterministik.
// Murni: semua gerak adalah fungsi dari t (detik). Tanpa state, timer, atau pengacak (variasi memakai hash deterministik).
import React from 'react';

export const THEME = {
  paper: { cream: '#FFF4DC', sky: '#EAF6FF', mint: '#E3F8F1', blush: '#FFE9E6', lemon: '#FFF8CC', night: '#DDEBFF' },
  ink: '#1B2A3A',
  inkSoft: '#5B6B7B',
  white: '#FFFFFF',
  ghost: '#F4F1EA',
  skin: ['#FFD9B8', '#E7B48F', '#C98F68'],
  accent: {
    blue: { m: '#2D9CDB', s: '#CDEEFB', d: '#1F82BD' },
    teal: { m: '#00BFA6', s: '#CFF3EC', d: '#009C88' },
    yellow: { m: '#FFC93C', s: '#FFF1C2', d: '#FFD966' },
    red: { m: '#FF5D5D', s: '#FFDAD8', d: '#E04444' },
    ink: { m: '#1B2A3A', s: '#5B6B7B', d: '#1B2A3A' },
    white: { m: '#FFFFFF', s: '#F4F1EA', d: '#D6D3E0' },
  },
  sunOuter: '#FFEDB8',
  blueMid: '#9ADCF5',
  blueLight: '#5CC0EC',
  tealMid: '#9FE3D6',
  shadow: { dy: 3.5, blur: 2.6, opacity: 0.28 },
  cardShadow: 'drop-shadow(0 12px 14px rgba(27,42,58,0.28))',
};
const T0 = THEME;
const A = T0.accent;

// ---------- util murni ----------
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const prog = (t, t0, d) => clamp((t - t0) / d);
const eOut = (k) => 1 - Math.pow(1 - clamp(k), 3);
const eIn = (k) => clamp(k) * clamp(k);
const eBack = (k) => { k = clamp(k); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const wrap = (x, a, b) => ((((x - a) % (b - a)) + (b - a)) % (b - a)) + a;
const mixHex = (a, b, k) => {
  const p = (h, i) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  return `rgb(${[0, 1, 2].map((i) => Math.round(lerp(p(a, i), p(b, i), clamp(k)))).join(',')})`;
};
const norm = (w) => String(w || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const fit = (s, base, min = 11) => clamp(base - Math.max(0, String(s || '').length - 6) * 1.6, min, base);

// ---------- komponen (origin di tengah bbox; w/h nominal ada di REGISTRY) ----------
// props: { c: {m,s,d}, t: detik global, k: progres masuk 0..1, text, n }
const Sun = ({ c, t }) => { const p = 1 + Math.sin(t * 1.6) * 0.025; return <g transform={`scale(${p})`}><circle r={62} fill={T0.sunOuter} /><circle r={46} fill={c.d} /><circle r={30} fill={c.m} /></g>; };
const Moon = ({ c }) => <g><path d="M14 -44 A44 44 0 1 0 14 44 A34 34 0 1 1 14 -44Z" fill={c.m} /><circle cx={30} cy={-24} r={3} fill={c.d} /></g>;
const Cloud = () => <g fill={T0.white}><circle cx={-24} cy={4} r={18} /><circle cx={0} cy={-8} r={24} /><circle cx={26} cy={2} r={20} /><rect x={-42} y={4} width={86} height={20} rx={10} /></g>;
const Mountain = ({ c }) => <g><polygon points="-72,45 -20,-45 18,6 40,-24 72,45" fill={c.m} /><polygon points="-20,-45 -34,-22 -24,-26 -16,-18 -6,-27" fill={T0.white} /><polygon points="40,-24 31,-9 38,-12 44,-6 48,-14" fill={T0.white} /></g>;
const PalmShape = ({ t, ph = 0 }) => { const sw = Math.sin(t * 1.5 + ph) * 3; return <g stroke={T0.inkSoft} strokeWidth={4} fill="none" strokeLinecap="round"><path d="M0 0 Q4 -22 10 -40" /><g transform={`rotate(${sw} 10 -40)`} stroke={A.teal.m}><path d="M10 -40 q-16 -10 -30 -2 M10 -40 q-6 -18 -24 -20 M10 -40 q8 -16 26 -16 M10 -40 q18 -4 26 10" /></g></g>; };
const Island = ({ c, t }) => <g><path d="M-62 44 Q-34 6 2 18 Q38 4 62 44Z" fill={c.m} /><path d="M-62 44 L62 44 L52 52 L-52 52Z" fill={c.d} /><g transform="translate(-22 22)"><PalmShape t={t} /></g><g transform="translate(24 24) scale(.8)"><PalmShape t={t} ph={1.7} /></g></g>;
const Tree = ({ c }) => <g><rect x={-4} y={10} width={8} height={30} rx={3} fill={T0.inkSoft} /><circle cx={0} cy={-6} r={22} fill={c.m} /><circle cx={-14} cy={8} r={14} fill={c.m} /><circle cx={14} cy={8} r={14} fill={c.m} /></g>;
const Palm = ({ t }) => <g transform="translate(-6 40)"><PalmShape t={t} /></g>;
const House = ({ c }) => <g><rect x={-34} y={-6} width={68} height={46} fill={A.yellow.s} /><polygon points="-42,-4 0,-38 42,-4" fill={c.m} /><rect x={-9} y={14} width={18} height={26} fill={A.blue.m} /><rect x={-28} y={6} width={14} height={14} fill={T0.blueMid} /><rect x={14} y={6} width={14} height={14} fill={T0.blueMid} /></g>;
const Bldg = ({ x = 0, w = 36, h = 110, f }) => <g transform={`translate(${x} 0)`}><rect x={-w / 2} y={-h / 2} width={w} height={h} fill={f} />{Array.from({ length: Math.floor(h / 22) }, (_, r) => [0, 1].map((q) => <rect key={r + '-' + q} x={-w / 2 + 7 + q * (w / 2 - 4)} y={-h / 2 + 8 + r * 20} width={9} height={11} fill={A.yellow.s} />))}</g>;
const Building = ({ c }) => <g><Bldg w={50} h={118} f={c.m} /><rect x={-4} y={-72} width={8} height={14} fill={A.ink.s} /></g>;
const City = ({ c }) => <g><Bldg x={-62} w={40} h={80} f={A.blue.s} /><Bldg x={-24} w={44} h={116} f={c.m} /><Bldg x={22} w={38} h={92} f={A.teal.m} /><Bldg x={60} w={34} h={70} f={A.yellow.d} /></g>;
const Landmark = ({ c }) => <g><polygon points="-62,-20 0,-52 62,-20" fill={T0.sunOuter} /><rect x={-62} y={-20} width={124} height={7} fill={T0.white} />{[0, 1, 2, 3, 4].map((i) => <rect key={i} x={-54 + i * 22} y={-13} width={10} height={50} fill={T0.white} />)}<rect x={-68} y={37} width={136} height={9} rx={3} fill={T0.white} /><rect x={-2} y={-74} width={3} height={24} fill={T0.ink} /><rect x={1} y={-74} width={20} height={7} fill={c.m} /><rect x={1} y={-67} width={20} height={7} fill={T0.white} /></g>;
const Ship = ({ c, t }) => {
  const sw = (i) => Math.sin(t * 1.7 + i * 1.3) * 1.4;
  const sail = (mx, pts, inner, i) => <g transform={`rotate(${sw(i)} ${mx} 40)`}><polygon points={pts} fill={T0.white} /><polygon points={inner} fill={A.yellow.s} /></g>;
  return <g>
    <path d="M-72 44 L72 44 L52 74 L-52 74Z" fill={c.m} /><path d="M-66 54 L66 54 L63 59 L-63 59Z" fill={T0.paper.cream} />
    <rect x={-10} y={26} width={36} height={18} rx={3} fill={A.yellow.m} /><rect x={-2} y={30} width={7} height={7} fill={T0.blueMid} /><rect x={12} y={30} width={7} height={7} fill={T0.blueMid} />
    <path d="M72 44 L112 20" stroke={T0.ink} strokeWidth={4} strokeLinecap="round" />
    <rect x={-48} y={-50} width={4} height={94} fill={T0.ink} /><rect x={-4} y={-72} width={4} height={116} fill={T0.ink} /><rect x={38} y={-40} width={4} height={84} fill={T0.ink} />
    {sail(-46, '-50,-44 -50,40 -90,40', '-50,-24 -50,40 -70,40', 0)}{sail(-2, '-6,-66 -6,40 -48,40', '-6,-40 -6,40 -26,40', 1)}{sail(40, '36,-34 36,40 -4,40', '36,-14 36,40 16,40', 2)}{sail(44, '46,-28 46,42 96,42', '46,2 46,42 72,42', 3)}
    <polygon points={`-1,-72 ${22 + Math.sin(t * 6) * 2},${-65 + Math.sin(t * 5) * 1.5} -1,-58`} fill={A.red.m} />
  </g>;
};
const Car = ({ c, t }) => <g><rect x={-52} y={-4} width={104} height={30} rx={10} fill={c.m} /><path d="M-30 -4 L-18 -26 L22 -26 L36 -4Z" fill={c.m} /><path d="M-24 -6 L-15 -22 L-2 -22 L-2 -6Z M2 -6 L2 -22 L20 -22 L30 -6Z" fill={A.blue.s} />{[-30, 30].map((x) => <g key={x} transform={`translate(${x} 26) rotate(${t * 200})`}><circle r={11} fill={T0.ink} /><circle r={5} fill={T0.ghost} /><rect x={-1.5} y={-9} width={3} height={18} fill={T0.inkSoft} /></g>)}</g>;
const Rocket = ({ c, t }) => <g><path d="M0 -52 Q22 -24 16 22 L-16 22 Q-22 -24 0 -52Z" fill={T0.white} /><path d="M0 -52 Q12 -40 15 -26 L-15 -26 Q-12 -40 0 -52Z" fill={c.m} /><circle cy={-8} r={8} fill={A.blue.m} /><path d="M-16 6 L-30 28 L-16 22Z M16 6 L30 28 L16 22Z" fill={c.m} /><path d={`M-9 22 L0 ${40 + Math.sin(t * 18) * 6} L9 22Z`} fill={A.yellow.m} /></g>;
const Planet = ({ c, t }) => <g><circle r={34} fill={c.m} /><circle cx={-10} cy={-8} r={7} fill={c.d} opacity={0.6} /><ellipse rx={56} ry={13} fill="none" stroke={A.yellow.m} strokeWidth={5} transform={`rotate(${-18 + Math.sin(t) * 2})`} /></g>;
const Waves = ({ c, t }) => { const dx = (t * 10) % 60; return <g transform={`translate(${dx - 330} 0)`}><path d={`M0 0 q15 -12 30 0${' t30 0'.repeat(21)} L660 40 L0 40Z`} fill={c.m} /></g>; };
const HAIR = [T0.ink, T0.inkSoft, T0.ink];
const Person = ({ c, t, text, n = 0 }) => {
  const pose = String(text || 'stand').toLowerCase(), skin = T0.skin[n % 3], bun = n % 2 === 1;
  const walk = pose === 'walk' ? Math.sin(t * 6) * 22 : 0;
  const armR = pose === 'point' ? -75 : pose === 'cheer' ? -150 : pose === 'think' ? -125 : 4;
  const armL = pose === 'cheer' ? 150 : pose === 'think' ? 40 : 4;
  const mouth = pose === 'sad' ? 'M-4 -26 Q0 -29 4 -26' : 'M-4 -28 Q0 -24 4 -28';
  return <g>
    <rect x={-9} y={8} width={8} height={36} rx={3} fill={T0.inkSoft} transform={`rotate(${walk} -5 8)`} /><rect x={1} y={8} width={8} height={36} rx={3} fill={T0.inkSoft} transform={`rotate(${-walk} 5 8)`} />
    <g transform={`rotate(${armL} -14 -20)`}><rect x={-18} y={-22} width={8} height={30} rx={4} fill={c.m} /><circle cx={-14} cy={10} r={4.5} fill={skin} /></g>
    <rect x={-15} y={-24} width={30} height={36} rx={9} fill={c.m} /><rect x={-15} y={-8} width={30} height={4} fill={T0.white} opacity={0.8} />
    <g transform={`rotate(${armR} 14 -20)`}><rect x={10} y={-22} width={8} height={30} rx={4} fill={c.m} /><circle cx={14} cy={10} r={4.5} fill={skin} /></g>
    <g transform={`translate(0 ${pose === 'sad' ? 2 : 0})`}><circle cy={-38} r={14} fill={skin} /><path d="M-14 -40 A14 14 0 0 1 14 -40 Q0 -48 -14 -40Z" fill={HAIR[n % 3]} />{bun && <circle cy={-54} r={6} fill={HAIR[n % 3]} />}
    <circle cx={-5} cy={-37} r={1.8} fill={T0.ink} /><circle cx={5} cy={-37} r={1.8} fill={T0.ink} /><path d={mouth} transform="translate(0 -4)" stroke={T0.ink} strokeWidth={1.6} fill="none" strokeLinecap="round" /></g>
  </g>;
};
const Crowd = ({ c, t, n }) => { const m = clamp(n || 7, 3, 14); const cols = [A.yellow.m, A.teal.m, A.red.m, A.blue.m]; return <g>{Array.from({ length: m }, (_, i) => { const bob = Math.abs(Math.sin(t * 5 + i * 0.9)) * 2.2; return <g key={i} transform={`translate(${(i - (m - 1) / 2) * 16} ${26 - bob})`}>{i % 3 === 0 && <g><rect x={5} y={-46} width={2.6} height={36} fill={T0.ink} /><rect x={-2} y={-60} width={22} height={15} rx={3} fill={[A.red.m, A.yellow.m, A.teal.m][(i / 3) % 3 | 0]} /></g>}<rect x={-6} y={-20} width={12} height={22} rx={5} fill={cols[i % 4]} /><circle cy={-26} r={7.5} fill={T0.skin[i % 3]} /></g>; })}</g>; };
const Mic = ({ c, t }) => <g><rect x={-14} y={-46} width={28} height={50} rx={14} fill={c.m} />{[-6, 0, 6].map((x) => <line key={x} x1={x} y1={-36} x2={x} y2={-8} stroke={T0.white} strokeWidth={2} opacity={0.7} />)}<path d="M-24 -4 q0 28 24 28 q24 0 24 -28" stroke={T0.ink} strokeWidth={5} fill="none" strokeLinecap="round" /><rect x={-3} y={22} width={6} height={18} fill={T0.ink} /><rect x={-18} y={38} width={36} height={7} rx={3} fill={T0.ink} />{[0, 1].map((i) => <path key={i} d={`M${30 + i * 10} -20 q${8 + Math.sin(t * 5 + i) * 2} 14 0 28`} stroke={A.yellow.m} strokeWidth={4} fill="none" strokeLinecap="round" />)}</g>;
const Phone = ({ c }) => <g><rect x={-30} y={-54} width={60} height={108} rx={12} fill={T0.ink} /><rect x={-25} y={-46} width={50} height={92} rx={6} fill={c.s} /><rect x={-9} y={-52} width={18} height={4} rx={2} fill={T0.inkSoft} /><rect x={-17} y={-30} width={34} height={14} rx={5} fill={c.m} /><rect x={-17} y={-8} width={34} height={14} rx={5} fill={T0.white} /><rect x={-17} y={14} width={22} height={14} rx={5} fill={T0.white} /></g>;
const Laptop = ({ c }) => <g><rect x={-46} y={-34} width={92} height={60} rx={6} fill={T0.ink} /><rect x={-41} y={-29} width={82} height={50} rx={3} fill={c.s} /><rect x={-34} y={-22} width={36} height={6} rx={3} fill={c.m} /><rect x={-34} y={-10} width={54} height={5} rx={2} fill={T0.white} /><rect x={-34} y={0} width={44} height={5} rx={2} fill={T0.white} /><path d="M-58 30 L58 30 L50 40 L-50 40Z" fill={T0.inkSoft} /></g>;
const Doc = ({ c }) => <g><path d="M-30 -42 L14 -42 L30 -26 L30 42 L-30 42Z" fill={T0.white} /><path d="M14 -42 L14 -26 L30 -26Z" fill={c.m} />{[-14, -2, 10, 22].map((y, i) => <rect key={y} x={-20} y={y} width={i === 3 ? 26 : 40} height={5} rx={2.5} fill={i === 0 ? c.m : T0.ghost} />)}</g>;
const Calendar = ({ c, text }) => { const [top, big] = String(text || 'JAN|1').split('|'); return <g><rect x={-40} y={-44} width={80} height={90} rx={10} fill={T0.white} /><path d="M-40 -34 a10 10 0 0 1 10 -10 h60 a10 10 0 0 1 10 10 v20 h-80Z" fill={c.m === T0.white ? A.red.m : c.m} /><circle cx={-20} cy={-44} r={4.5} fill={T0.ink} /><circle cx={20} cy={-44} r={4.5} fill={T0.ink} /><text y={-20} textAnchor="middle" fontSize={fit(top, 16, 10)} fontWeight={700} fill={T0.ink}>{top}</text><text y={32} textAnchor="middle" fontSize={fit(big, 46, 20)} fontWeight={700} fill={T0.ink}>{big || ''}</text></g>; };
const Clock = ({ c, t }) => <g><circle r={44} fill={T0.white} /><circle r={44} fill="none" stroke={c.m} strokeWidth={7} />{Array.from({ length: 12 }, (_, i) => <line key={i} x1={0} y1={-35} x2={0} y2={-40} stroke={T0.ink} strokeWidth={2} transform={`rotate(${i * 30})`} />)}<line x1={0} y1={0} x2={0} y2={-22} stroke={T0.ink} strokeWidth={4} strokeLinecap="round" transform={`rotate(${t * 6})`} /><line x1={0} y1={0} x2={0} y2={-30} stroke={c.d} strokeWidth={3} strokeLinecap="round" transform={`rotate(${t * 72})`} /><circle r={4} fill={T0.ink} /></g>;
const Coin = ({ c, t, text }) => { const k = 0.4 + 0.6 * Math.abs(Math.cos(t * 1.2)); return <g transform={`scale(${k} 1)`}><circle r={40} fill={A.yellow.m} stroke={A.yellow.d} strokeWidth={5} /><circle r={30} fill="none" stroke={A.yellow.s} strokeWidth={3} />{k > 0.55 && <text y={fit(text, 16) / 3} textAnchor="middle" fontSize={fit(text, 16, 9)} fontWeight={700} fill={T0.ink}>{text || '$'}</text>}</g>; };
const ChartBars = ({ c, k }) => { const hs = [26, 44, 34, 62, 80]; const cols = [A.blue.m, A.teal.m, A.yellow.m, A.red.m, A.blue.m]; return <g><rect x={-56} y={42} width={112} height={5} rx={2.5} fill={T0.ink} />{hs.map((h, i) => <rect key={i} x={-52 + i * 22} y={42 - h * eOut(k * 1.2 - i * 0.1)} width={16} height={h * eOut(k * 1.2 - i * 0.1)} rx={3} fill={cols[i]} />)}</g>; };
const ChartLine = ({ c, k }) => <g><path d="M-54 -44 V44 H56" stroke={T0.ink} strokeWidth={4} fill="none" strokeLinecap="round" /><path d="M-44 30 L-18 6 L6 18 L34 -22 L52 -34" stroke={c.m} strokeWidth={6} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={140} strokeDashoffset={140 * (1 - eOut(k))} /><polygon points="52,-46 62,-30 42,-30" fill={c.m} opacity={eOut(k - 0.6)} /></g>;
const Magnifier = ({ t }) => <g transform={`translate(${Math.sin(t * 1.6) * 6} ${Math.cos(t * 1.2) * 4})`}><line x1={18} y1={18} x2={46} y2={46} stroke={T0.ink} strokeWidth={9} strokeLinecap="round" /><circle r={30} fill={A.blue.s} fillOpacity={0.75} stroke={T0.ink} strokeWidth={6} /><path d="M-16 -8 A18 18 0 0 1 4 -20" stroke={T0.white} strokeWidth={4} fill="none" strokeLinecap="round" /></g>;
const Bulb = ({ c, t }) => <g><circle r={28} fill={c.m} /><rect x={-13} y={26} width={26} height={16} rx={4} fill={T0.inkSoft} /><rect x={-9} y={42} width={18} height={6} rx={3} fill={T0.ink} />{Array.from({ length: 7 }, (_, i) => { const a = -150 + i * 50; return <line key={i} x1={0} y1={-40} x2={0} y2={-40 - 8 - 4 * Math.sin(t * 5 + i)} stroke={A.yellow.d} strokeWidth={4} strokeLinecap="round" transform={`rotate(${a + 90 - 90})`} />; })}<path d="M-8 18 Q0 4 8 18" stroke={T0.white} strokeWidth={3} fill="none" /></g>;
const Gear = ({ c, t }) => <g transform={`rotate(${t * 30})`}>{Array.from({ length: 8 }, (_, i) => <rect key={i} x={-7} y={-44} width={14} height={20} rx={3} fill={c.m} transform={`rotate(${i * 45})`} />)}<circle r={34} fill={c.m} /><circle r={14} fill={T0.paper.cream} /></g>;
const Padlock = ({ c }) => <g><path d="M-18 -8 v-16 a18 18 0 0 1 36 0 v16" stroke={T0.ink} strokeWidth={8} fill="none" strokeLinecap="round" /><rect x={-30} y={-8} width={60} height={50} rx={10} fill={c.m} /><circle cy={14} r={6} fill={T0.ink} /><rect x={-2.5} y={16} width={5} height={14} rx={2.5} fill={T0.ink} /></g>;
const Shield = ({ c, t }) => <g transform={`rotate(${Math.sin(t * 1.4) * 2})`}><path d="M-30 -42 L30 -42 L30 -2 Q30 30 0 46 Q-30 30 -30 -2Z" fill={c.m} /><path d="M0 -26 l7 15 16 2 -12 11 4 16 -15 -8 -15 8 4 -16 -12 -11 16 -2Z" fill={A.yellow.m} /></g>;
const CheckBadge = ({ c, k }) => <g><circle r={40} fill={c.m === T0.white ? A.teal.m : c.m} /><path d="M-18 2 L-5 16 L20 -14" stroke={T0.ink} strokeWidth={9} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={64} strokeDashoffset={64 * (1 - eOut(k * 1.4))} /></g>;
const CrossBadge = ({ c }) => <g><circle r={40} fill={c.m === T0.white ? A.red.m : c.m} /><path d="M-16 -16 L16 16 M16 -16 L-16 16" stroke={T0.ink} strokeWidth={9} strokeLinecap="round" /></g>;
const Glyph = ({ c, ch }) => <g><circle r={38} fill={T0.white} /><circle r={38} fill="none" stroke={c.m} strokeWidth={6} /><text y={20} textAnchor="middle" fontSize={56} fontWeight={700} fill={T0.ink}>{ch}</text></g>;
const Arrow = ({ c, t, n = 0 }) => <g transform={`rotate(${(n % 8) * 45}) translate(${Math.sin(t * 4) * 3} 0)`}><path d="M-44 -12 H10 V-30 L46 0 L10 30 V12 H-44Z" fill={c.m === T0.white ? A.red.m : c.m} /></g>;
const Heart = ({ c, t }) => { const p = 1 + Math.sin(t * 5) * 0.06; return <path transform={`scale(${p})`} d="M0 34 C-50 4 -40 -34 -16 -34 C-6 -34 0 -26 0 -20 C0 -26 6 -34 16 -34 C40 -34 50 4 0 34Z" fill={c.m === T0.white ? A.red.m : c.m} />; };
const Star = ({ c, t }) => <path transform={`rotate(${Math.sin(t * 2) * 6})`} d="M0 -40 l11 25 27 3 -20 18 6 27 -24 -14 -24 14 6 -27 -20 -18 27 -3Z" fill={c.m === T0.white ? A.yellow.m : c.m} />;
const Flag = ({ c, t }) => <g><rect x={-30} y={-48} width={4} height={96} fill={T0.ink} /><path d={`M-26 -46 q${14 + Math.sin(t * 5) * 3} -10 ${28} 0 t28 0 V-6 q-14 10 -28 0 t-28 0Z`} fill={c.m === T0.white ? A.red.m : c.m} /></g>;
const Scroll = ({ c, text }) => <g><rect x={-50} y={-32} width={100} height={64} rx={6} fill={T0.white} /><rect x={-58} y={-38} width={14} height={76} rx={7} fill={A.yellow.d} /><rect x={44} y={-38} width={14} height={76} rx={7} fill={A.yellow.d} /><text y={fit(text, 16) / 3} textAnchor="middle" fontSize={fit(text, 16, 9)} fontWeight={700} fill={T0.ink}>{text || ''}</text></g>;
const Quote = ({ c }) => <g><rect x={-46} y={-32} width={92} height={60} rx={22} fill={T0.white} /><path d="M-18 26 l-8 20 l26 -20Z" fill={T0.white} /><text y={34} textAnchor="middle" fontSize={60} fontWeight={700} fill={c.m === T0.white ? A.blue.m : c.m}>{'\u201C\u201D'}</text></g>;
const Bubble = ({ c, text }) => { const lines = String(text || '').split('|').slice(0, 2); const w = clamp(Math.max(...lines.map((l) => l.length), 4) * 8 + 28, 56, 150); return <g><rect x={-w / 2} y={-26} width={w} height={lines.length > 1 ? 56 : 40} rx={18} fill={T0.white} /><path d={`M${-w / 4} ${lines.length > 1 ? 28 : 12} l-6 18 l22 -18Z`} fill={T0.white} />{lines.map((l, i) => <text key={i} y={-2 + i * 20} textAnchor="middle" fontSize={fit(l, 15, 9)} fontWeight={700} fill={T0.ink}>{l}</text>)}</g>; };
const Megaphone = ({ c, t }) => <g><path d="M-30 -14 L22 -38 V38 L-30 14Z" fill={c.m === T0.white ? A.red.m : c.m} /><rect x={-42} y={-16} width={16} height={32} rx={5} fill={T0.ink} /><rect x={-34} y={14} width={10} height={24} rx={4} fill={T0.inkSoft} />{[0, 1, 2].map((i) => <path key={i} d={`M${32 + i * 9} ${-18 - i * 8} q${8 + Math.sin(t * 6 + i) * 2} ${18 + i * 8} 0 ${36 + i * 16}`} stroke={A.yellow.m} strokeWidth={4} fill="none" strokeLinecap="round" />)}</g>;
const Chip = ({ c, text }) => { const s = String(text || ''); const w = clamp(s.length * 8.4 + 26, 40, 220); return <g><rect x={-w / 2} y={-14} width={w} height={28} rx={14} fill={c.m} /><text y={5} textAnchor="middle" fontSize={15} fontWeight={700} fill={T0.ink}>{s}</text></g>; };
const Stat = ({ c, text }) => { const [big, cap] = String(text || '').split('|'); const w = clamp(Math.max((big || '').length * 20, (cap || '').length * 8, 70) + 34, 90, 230); return <g><rect x={-w / 2} y={-34} width={w} height={cap ? 76 : 60} rx={16} fill={T0.white} /><rect x={-w / 2} y={-34} width={w} height={8} rx={4} fill={c.m === T0.white ? A.blue.m : c.m} /><text y={cap ? 10 : 18} textAnchor="middle" fontSize={fit(big, 44, 20)} fontWeight={700} fill={T0.ink}>{big}</text>{cap && <text y={32} textAnchor="middle" fontSize={fit(cap, 14, 9)} fontWeight={700} fill={T0.inkSoft}>{cap}</text>}</g>; };
const Title = ({ c, text }) => { const s = String(text || ''); const w = clamp(s.length * 14 + 40, 80, 300); return <g><rect x={-w / 2} y={-24} width={w} height={48} rx={16} fill={T0.white} /><text y={9} textAnchor="middle" fontSize={fit(s, 26, 14)} fontWeight={700} fill={T0.ink}>{s}</text></g>; };

// REGISTRY: nama -> { fn, w, h (nominal pada s=1), base (true = y layer adalah tapak), color default, doc }
export const REGISTRY = {
  sun: { fn: Sun, w: 124, h: 124, color: 'yellow' }, moon: { fn: Moon, w: 90, h: 90, color: 'yellow' }, cloud: { fn: Cloud, w: 96, h: 56, color: 'white' },
  mountain: { fn: Mountain, w: 144, h: 90, base: true, color: 'blue' }, island: { fn: Island, w: 124, h: 104, base: true, color: 'teal' }, tree: { fn: Tree, w: 56, h: 80, base: true, color: 'teal' },
  palm: { fn: Palm, w: 60, h: 64, base: true, color: 'teal' }, house: { fn: House, w: 84, h: 80, base: true, color: 'red' }, building: { fn: Building, w: 50, h: 118, base: true, color: 'blue' },
  city: { fn: City, w: 170, h: 116, base: true, color: 'blue' }, landmark: { fn: Landmark, w: 136, h: 120, base: true, color: 'red' }, ship: { fn: Ship, w: 204, h: 150, base: true, color: 'red' },
  car: { fn: Car, w: 108, h: 54, base: true, color: 'red' }, rocket: { fn: Rocket, w: 60, h: 96, color: 'red' }, planet: { fn: Planet, w: 112, h: 70, color: 'blue' },
  waves: { fn: Waves, w: 330, h: 40, base: true, color: 'blue' }, person: { fn: Person, w: 40, h: 106, base: true, color: 'blue' }, crowd: { fn: Crowd, w: 160, h: 86, base: true, color: 'blue' },
  mic: { fn: Mic, w: 60, h: 100, color: 'blue' }, phone: { fn: Phone, w: 60, h: 108, color: 'teal' }, laptop: { fn: Laptop, w: 116, h: 76, color: 'blue' },
  document: { fn: Doc, w: 60, h: 84, color: 'blue' }, calendar: { fn: Calendar, w: 80, h: 90, color: 'red' }, clock: { fn: Clock, w: 88, h: 88, color: 'blue' },
  coin: { fn: Coin, w: 80, h: 80, color: 'yellow' }, 'chart-bars': { fn: ChartBars, w: 112, h: 90, color: 'blue' }, 'chart-line': { fn: ChartLine, w: 116, h: 92, color: 'teal' },
  magnifier: { fn: Magnifier, w: 90, h: 90, color: 'blue' }, lightbulb: { fn: Bulb, w: 70, h: 100, color: 'yellow' }, gear: { fn: Gear, w: 88, h: 88, color: 'blue' },
  padlock: { fn: Padlock, w: 60, h: 90, color: 'yellow' }, shield: { fn: Shield, w: 60, h: 90, color: 'blue' }, 'check-badge': { fn: CheckBadge, w: 80, h: 80, color: 'teal' },
  'cross-badge': { fn: CrossBadge, w: 80, h: 80, color: 'red' }, question: { fn: (p) => <Glyph {...p} ch="?" />, w: 76, h: 76, color: 'red' }, exclamation: { fn: (p) => <Glyph {...p} ch="!" />, w: 76, h: 76, color: 'yellow' },
  arrow: { fn: Arrow, w: 92, h: 60, color: 'red' }, heart: { fn: Heart, w: 90, h: 70, color: 'red' }, star: { fn: Star, w: 82, h: 80, color: 'yellow' }, flag: { fn: Flag, w: 90, h: 96, base: true, color: 'red' },
  scroll: { fn: Scroll, w: 116, h: 76, color: 'yellow' }, 'quote-bubble': { fn: Quote, w: 92, h: 90, color: 'blue' }, 'speech-bubble': { fn: Bubble, w: 130, h: 70, color: 'blue' },
  megaphone: { fn: Megaphone, w: 110, h: 76, color: 'red' }, chip: { fn: Chip, w: 120, h: 28, color: 'yellow' }, stat: { fn: Stat, w: 130, h: 76, color: 'blue' }, title: { fn: Title, w: 200, h: 48, color: 'white' },
};

// ---------- panggung (stage), kamera, lapisan ----------
const STAGES = {
  sky: { bg: 'sky', bands: [[T0.paper.mint, 0.82, 5], [T0.tealMid, 0.9, 8]], ambient: 'clouds' },
  sea: { bg: 'cream', bands: [[A.blue.s, 0.66, 8], [T0.blueMid, 0.74, 12], [T0.blueLight, 0.82, 18]], ambient: 'clouds' },
  land: { bg: 'cream', bands: [[A.teal.s, 0.78, 5], [T0.tealMid, 0.88, 8]], ambient: 'clouds' },
  city: { bg: 'sky', bands: [[A.blue.s, 0.86, 4]], ambient: 'clouds' },
  night: { bg: 'night', bands: [[A.blue.s, 0.84, 5]], ambient: 'stars' },
  plain: { bg: 'cream', bands: [[A.yellow.s, 0.9, 3]], ambient: 'sparks' },
};
const stageOf = (d) => STAGES[d && d.stage] || STAGES.sky;
const bgHex = (st) => T0.paper[st.bg] || T0.paper.cream;
const wave = (y, h) => `M-60 ${y} q15 -10 30 0${' t30 0'.repeat(17)} L480 ${h + 40} L-60 ${h + 40}Z`;

const Ambient = ({ st, t, SW, SH, op }) => {
  if (st.ambient === 'clouds') return <g opacity={0.9 * op}>{[0, 1].map((i) => <g key={i} transform={`translate(${wrap(30 + i * 190 + t * (4 + i * 2), -60, SW + 60)} ${SH * (0.14 + i * 0.12)}) scale(${0.8 + i * 0.2})`}><Cloud /></g>)}</g>;
  if (st.ambient === 'stars') return <g opacity={op}><g transform={`translate(${SW - 56} ${SH * 0.2})`}><Moon c={A.yellow} /></g>{Array.from({ length: 12 }, (_, i) => <circle key={i} cx={10 + hash(i + 40) * (SW - 20)} cy={8 + hash(i + 70) * SH * 0.5} r={1.8 + hash(i) * 1.4} fill={A.yellow.m} opacity={0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i * 1.7))} />)}</g>;
  return <g opacity={op}>{Array.from({ length: 6 }, (_, i) => <path key={i} transform={`translate(${20 + hash(i + 3) * (SW - 40)} ${10 + hash(i + 9) * SH * 0.4}) scale(${0.5 + hash(i + 4) * 0.5})`} d="M0 -7 L2 -2 L7 0 L2 2 L0 7 L-2 2 L-7 0 L-2 -2Z" fill={A.yellow.m} opacity={0.35 + 0.65 * Math.abs(Math.sin(t * 2 + i * 1.7))} />)}</g>;
};

const cueTime = (s, word) => {
  const q = norm(word);
  if (!q) return null;
  for (const w of s.words || []) { const x = norm(w.w); if (x === q || (q.length >= 4 && x.startsWith(q))) return w.start; }
  return null;
};

const LayerView = ({ d, t, s, idx, SW, SH, m, fade }) => {
  const R = REGISTRY[d.c];
  if (!R) return null;
  const ts = Math.min(cueTime(s, d.enter) ?? s.start + 0.1 + idx * 0.28, Math.max(s.start, s.end - 0.25));
  if (t < ts) return null;
  let te = cueTime(s, d.exit) ?? s.end + 0.1;
  if (te <= ts + 0.4) te = ts + 0.4;
  const pop = eBack(prog(t, ts, 0.55)), out = prog(t, te, 0.35);
  const op = clamp(pop * 2) * (1 - out) * fade;
  if (op <= 0.01) return null;
  const ph = hash(idx + 7) * 6.28, mo = d.motion || 'none';
  let base = (d.s || 1) * m;
  base *= Math.min(1, (SH * 0.9) / (R.h * base), (SW * 0.94) / (R.w * base));
  const sc = base * lerp(0.55, 1, pop) * (mo === 'pulse' ? 1 + 0.04 * Math.sin(t * 3 + ph) : 1);
  const rot = mo === 'sway' ? Math.sin(t * 1.6 + ph) * 3 : mo === 'float' ? Math.sin(t * 0.9 + ph) * 2 : mo === 'spin' ? t * 40 : 0;
  const dy = (mo === 'bob' ? Math.sin(t * 2 + ph) * 2.5 : mo === 'float' ? Math.sin(t * 1.2 + ph) * 4 : 0) + (1 - pop) * 14 + out * 10;
  const hh = (R.h * base) / 2, hw = (R.w * base) / 2;
  const cx = clamp((d.x == null ? 0.5 : d.x) * SW, hw + 4, SW - hw - 4);
  const cy = clamp((d.y == null ? 0.78 : d.y) * SH - (R.base ? hh : 0), hh + 6, SH - hh - 4);
  const c = A[d.color || R.color] || A.blue;
  const F = R.fn;
  return (
    <g filter="url(#pcs)" opacity={op} transform={`translate(${cx} ${cy + dy}) rotate(${rot}) scale(${d.flip ? -sc : sc} ${sc})`}>
      <F c={c} t={t} k={prog(t, ts, 0.9)} text={d.text} n={d.n} />
    </g>
  );
};

const cameraOf = (move, p, SW, SH) => {
  const e = eOut(p);
  let sc = 1, tx = 0;
  if (move === 'push') sc = lerp(1, 1.07, e);
  else if (move === 'pull') sc = lerp(1.07, 1, e);
  else if (move === 'pan-left') { sc = 1.05; tx = lerp(5, -5, e); }
  else if (move === 'pan-right') { sc = 1.05; tx = lerp(-5, 5, e); }
  else if (move === 'drift') { sc = 1.03; tx = Math.sin(p * 3.14) * 4; }
  return `translate(${SW / 2 + tx} ${SH * 0.55}) scale(${sc}) translate(${-SW / 2} ${-SH * 0.55})`;
};

const Stage = ({ t, scenes, design, si, SW, SH, w, h, x, y, opacity }) => {
  const s = scenes[si], ds = design.scenes[si] || {};
  const prev = si > 0 ? scenes[si - 1] : null, pds = si > 0 ? design.scenes[si - 1] || {} : null;
  const st = stageOf(ds), pst = prev ? stageOf(pds) : st;
  const bgK = prev ? eOut(prog(t, s.start - 0.05, 0.4)) : 1;
  const bandsIn = prev && pst === st ? 1 : eOut(prog(t, s.start - 0.05, 0.5));
  const m = clamp(Math.pow(SH / 210, 0.7), 1, 2);
  const dur = Math.max(0.5, s.end - s.start), p = clamp((t - s.start) / dur);
  const fadePrev = 1 - eOut(prog(t, s.start, 0.35));
  return (
    <svg width={w} height={h} viewBox={`0 0 ${SW} ${SH}`} style={{ position: 'absolute', left: x, top: y, opacity }}>
      <defs>
        <filter id="pcs" x="-15%" y="-15%" width="130%" height="135%"><feDropShadow dx="0" dy={T0.shadow.dy} stdDeviation={T0.shadow.blur} floodColor={T0.ink} floodOpacity={T0.shadow.opacity} /></filter>
        <filter id="pcu" x="-5%" y="-10%" width="110%" height="120%"><feDropShadow dx="0" dy={-T0.shadow.dy} stdDeviation={T0.shadow.blur} floodColor={T0.ink} floodOpacity={T0.shadow.opacity} /></filter>
      </defs>
      <rect width={SW} height={SH} fill={mixHex(bgHex(pst), bgHex(st), bgK)} />
      <Ambient st={st} t={t} SW={SW} SH={SH} op={1} />
      <g transform={cameraOf(ds.camera, p, SW, SH)}>
        {st.bands.map(([f, yf, v], i) => (
          <g key={i} filter="url(#pcu)" transform={`translate(0 ${(1 - bandsIn) * 40})`}><g transform={`translate(${(t * v) % 60} 0)`}><path d={wave(SH * yf, SH)} fill={f} /></g></g>
        ))}
        {prev && fadePrev > 0.01 && (pds.layers || []).map((d, i) => <LayerView key={'p' + i} d={d} t={t} s={prev} idx={i} SW={SW} SH={SH} m={m} fade={fadePrev} />)}
        {(ds.layers || []).map((d, i) => <LayerView key={i} d={d} t={t} s={s} idx={i} SW={SW} SH={SH} m={m} fade={1} />)}
      </g>
    </svg>
  );
};

// ---------- caption per kata ----------
const chunksOf = (words) => {
  const out = []; let cur = [];
  for (const w of words || []) { cur.push(w); if (cur.length >= 7 || (/[.,?!]$/.test(w.w) && cur.length >= 3)) { out.push(cur); cur = []; } }
  if (cur.length) out.push(cur);
  return out;
};
const Caption = ({ t, s, emph, box, u, font }) => {
  const ch = chunksOf(s.words);
  let idx = 0;
  for (let i = 0; i < ch.length; i++) if (ch[i][0].start <= t + 0.05) idx = i;
  const cur = ch[idx] || [];
  return (
    <div style={{ position: 'absolute', left: box.x, top: box.y, width: box.w, height: box.h, background: T0.white, borderTopLeftRadius: 56 * u, borderTopRightRadius: 56 * u, filter: T0.cardShadow }}>
      <div style={{ position: 'absolute', left: 50 * u, top: 20 * u, width: box.w - 100 * u, height: box.h - 40 * u, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignContent: 'center', gap: `${6 * u}px ${16 * u}px` }}>
        {cur.map((w, k) => {
          const on = t >= w.start && t < w.end, done = t >= w.end;
          const em = emph.has(norm(w.w));
          const kk = on ? 1 + 0.1 * Math.sin(clamp((t - w.start) / Math.max(0.12, w.end - w.start)) * Math.PI) : 1;
          return <span key={k} style={{ fontSize: font, lineHeight: `${font * 1.25}px`, fontWeight: 700, color: done || on ? T0.ink : T0.inkSoft, background: on ? A.yellow.m : em ? A.yellow.s : 'transparent', borderRadius: 22 * u, padding: `0 ${14 * u}px`, display: 'inline-block', transform: `scale(${kk})` }}>{w.w}</span>;
        })}
      </div>
    </div>
  );
};

// ---------- komposisi inti ----------
export function layoutFor(W, H, edit, hasHeader) {
  const u = W / 1080, tall = H / W > 1.4;
  const capH = Math.round(tall ? H * 0.1875 : H * 0.22);
  if (tall) {
    const card = edit ? { x: 60 * u, y: (hasHeader ? 224 : 60) * u, w: 960 * u, h: 660 * u } : null;
    const sy = card ? card.y + card.h + 20 * u : 0;
    return { u, tall, cap: { x: 0, y: H - capH, w: W, h: capH }, card, stage: { x: 0, y: sy, w: W, h: H - capH - 24 * u - sy + (card ? 0 : 24 * u) }, font: Math.round(64 * u) };
  }
  const cw = W * 0.34;
  return { u, tall, cap: { x: 0, y: H - capH, w: W, h: capH }, card: edit ? { x: W - cw - 24 * u, y: 24 * u, w: cw, h: (cw * 9) / 16 } : null, stage: { x: 0, y: 0, w: W, h: H - capH }, font: Math.round(H * 0.05) };
}

export function PaperCutVideo({ t, timeline, design, footage, fontFamily }) {
  const W = timeline.width, H = timeline.height, scenes = timeline.scenes;
  const edit = timeline.mode === 'edit' && !!footage;
  const hdr = design.header && design.header.title ? design.header.title : '';
  const L = layoutFor(W, H, edit, !!hdr && edit), u = L.u;
  let si = 0;
  for (let i = 0; i < scenes.length; i++) if (t >= scenes[i].start - 1e-6) si = i;
  const s = scenes[si], ds = design.scenes[si] || {};
  const SW = 360, SH = (SW * L.stage.h) / L.stage.w;
  const fullOf = (i) => (scenes[i] && scenes[i].speaker === 'full' ? 1 : 0);
  const f = edit ? lerp(fullOf(Math.max(0, si - 1)), fullOf(si), eOut(prog(t, s.start - 0.05, 0.4))) : 0;
  const intro = eBack(prog(t, 0.1, 0.6));
  const emph = new Set([...(ds.emphasis || []), ...(s.keywords || [])].map(norm));
  const p = clamp((t - s.start) / Math.max(0.5, s.end - s.start));
  const zoom = (si % 2 === 0 ? 1 : 1.09) * (1 + 0.035 * p);
  const card = L.card && L.tall ? { ...L.card, h: lerp(L.card.h, L.card.h + L.stage.h + 20 * u, f) } : L.card;
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, overflow: 'hidden', background: T0.paper.cream, fontFamily: fontFamily || "'Fredoka','Baloo 2','Arial Rounded MT Bold','Trebuchet MS',sans-serif" }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', left: 0, top: 0 }}>
        <circle cx={W * 0.89} cy={150 * u} r={200 * u} fill={T0.sunOuter} style={{ filter: T0.cardShadow }} />
        <circle cx={W * 0.89} cy={150 * u} r={140 * u} fill={A.yellow.d} style={{ filter: T0.cardShadow }} />
      </svg>
      {edit && hdr && L.tall && (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', left: 0, top: 0 }}>
          <g transform={`translate(${W / 2} ${140 * u}) scale(${intro})`} opacity={clamp(intro * 2)} style={{ filter: T0.cardShadow }}>
            <rect x={-480 * u} y={-48 * u} width={960 * u} height={96 * u} rx={32 * u} fill={T0.white} />
            <text y={20 * u} textAnchor="middle" fontSize={56 * u} fontWeight={700} fill={T0.ink}>{hdr}</text>
          </g>
        </svg>
      )}
      <Stage t={t} scenes={scenes} design={design} si={si} SW={SW} SH={SH} w={L.stage.w} h={L.stage.h} x={L.stage.x} y={L.stage.y} opacity={1 - f} />
      {card && (
        <div style={{ position: 'absolute', left: card.x, top: card.y, width: card.w, height: card.h, filter: T0.cardShadow }}>
          <div style={{ position: 'absolute', inset: 0, background: T0.white, borderRadius: 52 * u, padding: 12 * u }}>
            <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 40 * u, overflow: 'hidden', background: A.blue.s }}>
              <div style={{ position: 'absolute', inset: 0, transform: `scale(${zoom})`, transformOrigin: '50% 40%' }}>{footage}</div>
            </div>
          </div>
        </div>
      )}
      {ds.tag && (
        <div style={{ position: 'absolute', left: card ? card.x + 24 * u : 24 * u, top: card ? card.y + card.h - 30 * u : L.stage.y + 18 * u, background: A.yellow.m, color: T0.ink, fontWeight: 700, fontSize: 28 * u, padding: `${8 * u}px ${28 * u}px`, borderRadius: 40 * u, filter: T0.cardShadow }}>{ds.tag}</div>
      )}
      {timeline.subtitleOn !== false && <Caption t={t} s={s} emph={emph} box={L.cap} u={u} font={L.font} />}
    </div>
  );
}
