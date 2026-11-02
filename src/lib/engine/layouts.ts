// Pola layout universal (hook, stat, versus, timeline, anatomy, quote, list,
// icon, outro, speaker). Tiap fungsi menggambar adegan pada waktu-adegan t —
// murni fungsi dari data + waktu, jadi preview = hasil render.

import { drawIcon, type Ctx2D } from "./icons";
import { bodyFontCss, displayFont, luminance, withAlpha } from "./themes";
import { wordTimings } from "./timing";
import type { Scene, Theme } from "./types";

export interface LayoutCtx {
  ctx: Ctx2D;
  W: number;
  H: number;
  U: number;
  theme: Theme;
  scene: Scene;
  /** waktu sejak adegan mulai (detik) */
  t: number;
  dur: number;
  /** batas area konten (px) */
  top: number;
  bottom: number;
}

// ---------- easing ----------
export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
export function backOut(x: number) {
  const c = 1.70158;
  const v = clamp01(x) - 1;
  return 1 + (c + 1) * v * v * v + c * v * v;
}
export const prog = (t: number, delay: number, len = 0.5) => clamp01((t - delay) / len);

// ---------- warna kontras ----------
export function textOn(fill: string, theme: Theme): string {
  const light = luminance(fill) > 0.55;
  if (light) return luminance(theme.ink) < 0.5 ? theme.ink : "#141414";
  return luminance(theme.ink) > 0.5 ? theme.ink : "#f7f7f2";
}

// ---------- teks ----------
export function wrapLines(ctx: Ctx2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const attempt = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(attempt).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else cur = attempt;
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Kecilkan font sampai teks muat dalam maxW × maxLines. */
export function fitText(
  ctx: Ctx2D,
  text: string,
  font: (px: number) => string,
  maxW: number,
  maxLines: number,
  startPx: number,
  minPx = 12,
): { px: number; lines: string[] } {
  let px = startPx;
  for (let i = 0; i < 24; i++) {
    ctx.font = font(px);
    const lines = wrapLines(ctx, text, maxW);
    const widest = Math.max(0, ...lines.map((l) => ctx.measureText(l).width));
    if ((lines.length <= maxLines && widest <= maxW) || px <= minPx) return { px, lines };
    px *= 0.9;
  }
  ctx.font = font(px);
  return { px, lines: wrapLines(ctx, text, maxW) };
}

function drawLines(ctx: Ctx2D, lines: string[], x: number, y: number, lh: number) {
  const start = y - ((lines.length - 1) * lh) / 2;
  lines.forEach((l, i) => ctx.fillText(l, x, start + i * lh));
}

// ---------- bentuk ----------
export function card(
  ctx: Ctx2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string,
  shadow: string,
  U: number,
  stroke?: string,
) {
  const off = U * 0.014;
  ctx.fillStyle = shadow;
  ctx.beginPath();
  ctx.roundRect(x + off, y + off, w, h, r);
  ctx.fill();
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = U * 0.005;
    ctx.stroke();
  }
}

export function pill(
  ctx: Ctx2D,
  cx: number,
  cy: number,
  text: string,
  font: string,
  bg: string,
  fg: string,
  padX: number,
  h: number,
): number {
  ctx.font = font;
  const w = ctx.measureText(text).width + padX * 2;
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(cx - w / 2, cy - h / 2, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, cx, cy + h * 0.04);
  return w;
}

/** Lingkaran berisi ikon (stiker/bullet) dengan efek pop. */
export function iconBadge(
  L: LayoutCtx,
  cx: number,
  cy: number,
  r: number,
  icon: string | undefined,
  p: number,
  fill = L.theme.surface,
  color = L.theme.accent,
) {
  const { ctx, U } = L;
  if (p <= 0) return;
  const s = backOut(p);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.fillStyle = withAlpha("#000000", 0.18);
  ctx.beginPath();
  ctx.arc(U * 0.01, U * 0.012, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, r * 0.07);
  ctx.stroke();
  drawIcon(ctx, icon, r * 1.15, color, clamp01(p * 1.6 - 0.2), 2);
  ctx.restore();
}

function headlineTop(L: LayoutCtx, text: string | undefined, y: number, p: number) {
  if (!text) return;
  const { ctx, W, U, theme } = L;
  const fit = fitText(ctx, text, (px) => displayFont(theme.font, px), W * 0.86, 2, U * 0.085);
  ctx.save();
  ctx.globalAlpha = easeOut(p);
  ctx.translate(0, (1 - easeOut(p)) * -U * 0.05);
  ctx.fillStyle = theme.ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  drawLines(ctx, fit.lines, W / 2, y, fit.px * 1.08);
  ctx.restore();
}

function underline(L: LayoutCtx, cx: number, y: number, w: number, p: number) {
  const { ctx, U, theme } = L;
  if (p <= 0) return;
  ctx.save();
  ctx.strokeStyle = theme.accent2;
  ctx.lineWidth = U * 0.012;
  ctx.lineCap = "round";
  ctx.beginPath();
  const x0 = cx - w / 2;
  const x1 = x0 + w * easeOut(p);
  ctx.moveTo(x0, y);
  ctx.quadraticCurveTo((x0 + x1) / 2, y + U * 0.02, x1, y - U * 0.005);
  ctx.stroke();
  ctx.restore();
}

// ---------- layout ----------

function hook(L: LayoutCtx) {
  const { ctx, W, U, theme, scene, t, top, bottom } = L;
  const area = bottom - top;
  iconBadge(L, W / 2, top + area * 0.2, U * 0.12, scene.icon ?? "sparkles", prog(t, 0, 0.6));
  if (scene.sub) {
    const p = easeOut(prog(t, 0.25));
    ctx.save();
    ctx.globalAlpha = p;
    pill(ctx, W / 2, top + area * 0.42, scene.sub.toUpperCase(), bodyFontCss(theme.font, U * 0.035, 700), theme.accent, textOn(theme.accent, theme), U * 0.035, U * 0.065);
    ctx.restore();
  }
  const text = scene.headline || scene.text;
  const fit = fitText(ctx, text, (px) => displayFont(theme.font, px), W * 0.86, 3, U * 0.12);
  const lh = fit.px * 1.05;
  const cy = top + area * 0.64;
  const start = cy - ((fit.lines.length - 1) * lh) / 2;
  ctx.fillStyle = theme.ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  fit.lines.forEach((line, i) => {
    const p = backOut(prog(t, 0.35 + i * 0.15, 0.45));
    if (p <= 0) return;
    ctx.save();
    ctx.translate(W / 2, start + i * lh);
    ctx.scale(p, p);
    ctx.fillText(line, 0, 0);
    ctx.restore();
  });
  ctx.font = displayFont(theme.font, fit.px);
  const widest = Math.max(...fit.lines.map((l) => ctx.measureText(l).width), 10);
  underline(L, W / 2, start + (fit.lines.length - 1) * lh + fit.px * 0.62, Math.min(widest, W * 0.8), prog(t, 0.8, 0.5));
}

function parseNumeric(v: string): { prefix: string; num: number; decimals: number; suffix: string; sep: string } | null {
  const m = /^([^\d-]*)(-?[\d.,]+)(.*)$/.exec(v.trim());
  if (!m || !m[2]) return null;
  const raw = m[2];
  // Format Indonesia "8.848" atau "1,5"; Inggris "8,848" / "1.5".
  let sep = "";
  let numStr = raw;
  if (/^\d{1,3}([.,]\d{3})+$/.test(raw)) {
    sep = raw.includes(".") ? "." : ",";
    numStr = raw.replace(/[.,]/g, "");
  } else numStr = raw.replace(",", ".");
  const num = Number(numStr);
  if (!Number.isFinite(num)) return null;
  const decimals = numStr.includes(".") ? (numStr.split(".")[1]?.length ?? 0) : 0;
  return { prefix: m[1] ?? "", num, decimals, suffix: m[3] ?? "", sep };
}

export function countValue(value: string, p: number): string {
  const n = parseNumeric(value);
  if (!n) return value;
  const cur = n.num * easeOut(p);
  let s = cur.toFixed(n.decimals);
  if (n.sep) s = Math.round(cur).toString().replace(/\B(?=(\d{3})+(?!\d))/g, n.sep);
  return `${n.prefix}${s}${n.suffix}`;
}

function stat(L: LayoutCtx) {
  const { ctx, W, U, theme, scene, t, top, bottom } = L;
  const area = bottom - top;
  const w = Math.min(W * 0.84, U * 0.92);
  const h = Math.min(area * 0.46, U * 0.62);
  const cx = W / 2;
  const cy = top + area * 0.45;
  const p = backOut(prog(t, 0, 0.5));
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(p, p);
  card(ctx, -w / 2, -h / 2, w, h, U * 0.04, theme.surface, theme.accent, U);
  const ink = textOn(theme.surface, theme);
  const value = countValue(scene.value || "100%", prog(t, 0.2, 1.1));
  const fit = fitText(ctx, value, (px) => displayFont(theme.font, px), w * 0.86, 1, U * 0.22);
  ctx.fillStyle = theme.accent;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(value, 0, -h * 0.08);
  if (scene.sub) {
    ctx.font = bodyFontCss(theme.font, U * 0.042, 700);
    ctx.fillStyle = ink;
    const lines = wrapLines(ctx, scene.sub.toUpperCase(), w * 0.85).slice(0, 2);
    drawLines(ctx, lines, 0, h * 0.3, U * 0.05);
  }
  void fit;
  ctx.restore();
  iconBadge(L, cx - w / 2 + U * 0.03, cy - h / 2 + U * 0.01, U * 0.075, scene.icon ?? "trending-up", prog(t, 0.35, 0.5));
  if (scene.headline) {
    const hp = easeOut(prog(t, 0.6));
    const f = fitText(ctx, scene.headline, (px) => displayFont(theme.font, px), W * 0.86, 2, U * 0.07);
    ctx.save();
    ctx.globalAlpha = hp;
    ctx.fillStyle = theme.ink;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    drawLines(ctx, f.lines, cx, cy + h / 2 + area * 0.13, f.px * 1.1);
    ctx.restore();
  }
}

function versus(L: LayoutCtx) {
  const { ctx, W, U, theme, scene, t, top, bottom } = L;
  const area = bottom - top;
  headlineTop(L, scene.headline, top + area * 0.1, prog(t, 0));
  const items = scene.items ?? [];
  const sides = [items[0] ?? { label: "A" }, items[1] ?? { label: "B" }];
  const gap = U * 0.06;
  const cw = Math.min((W - gap * 3) / 2, U * 0.62);
  const ch = Math.min(area * 0.55, cw * 1.35);
  const cy = top + area * 0.56;
  sides.forEach((side, i) => {
    const p = easeOut(prog(t, 0.15 + i * 0.25, 0.55));
    if (p <= 0) return;
    const dir = i === 0 ? -1 : 1;
    const x = W / 2 + dir * (gap / 2 + cw / 2) - cw / 2 + dir * (1 - p) * W * 0.4;
    const color = i === 0 ? theme.accent : theme.accent2;
    ctx.save();
    ctx.globalAlpha = p;
    card(ctx, x, cy - ch / 2, cw, ch, U * 0.035, theme.surface, color, U, color);
    const ccx = x + cw / 2;
    ctx.restore();
    iconBadge(L, ccx, cy - ch * 0.18, Math.min(cw * 0.26, U * 0.1), side.icon ?? (i === 0 ? "check" : "x"), prog(t, 0.35 + i * 0.25, 0.5), theme.surface, color);
    ctx.save();
    ctx.globalAlpha = p;
    const f = fitText(ctx, side.label, (px) => displayFont(theme.font, px), cw * 0.84, 3, U * 0.07);
    ctx.fillStyle = textOn(theme.surface, theme);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    drawLines(ctx, f.lines, ccx, cy + ch * 0.2, f.px * 1.08);
    ctx.restore();
  });
  const vp = backOut(prog(t, 0.6, 0.45));
  if (vp > 0) {
    const pulse = 1 + Math.sin(t * 5) * 0.04;
    ctx.save();
    ctx.translate(W / 2, cy);
    ctx.scale(vp * pulse, vp * pulse);
    ctx.fillStyle = theme.ink;
    ctx.beginPath();
    ctx.arc(0, 0, U * 0.065, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = theme.bg;
    ctx.font = displayFont(theme.font, U * 0.06);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("VS", 0, U * 0.004);
    ctx.restore();
  }
}

function timeline(L: LayoutCtx) {
  const { ctx, W, H, U, theme, scene, t, dur, top, bottom } = L;
  const area = bottom - top;
  headlineTop(L, scene.headline, top + area * 0.08, prog(t, 0));
  const items = (scene.items ?? []).slice(0, 5);
  if (items.length === 0) return;
  const n = items.length;
  const portrait = H > W * 1.1;
  const span = Math.max(0.6, dur * 0.8);
  const appear = (i: number) => (i / n) * span * 0.85 + 0.2;
  const lineP = clamp01((t - 0.15) / span);
  ctx.save();
  ctx.strokeStyle = withAlpha(theme.ink, 0.35);
  ctx.lineWidth = U * 0.008;
  ctx.lineCap = "round";
  if (portrait) {
    const x = W * 0.2;
    const y0 = top + area * 0.24;
    const y1 = top + area * 0.94;
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.lineTo(x, y0 + (y1 - y0) * lineP);
    ctx.stroke();
    items.forEach((it, i) => {
      const p = prog(t, appear(i), 0.45);
      const y = y0 + ((y1 - y0) * (i + 0.5)) / n;
      const active = t >= appear(i) && (i === n - 1 || t < appear(i + 1));
      iconBadge(L, x, y, U * (active ? 0.065 : 0.05), it.icon ?? "circle-help", p, active ? theme.accent : theme.surface, active ? textOn(theme.accent, theme) : theme.accent);
      ctx.save();
      ctx.globalAlpha = easeOut(p);
      ctx.translate((1 - easeOut(p)) * U * 0.08, 0);
      const f = fitText(ctx, it.label, (px) => bodyFontCss(theme.font, px, 700), W * 0.62, 2, U * 0.05);
      ctx.fillStyle = active ? theme.ink : withAlpha(theme.ink, 0.75);
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      drawLines(ctx, f.lines, x + U * 0.1, y, f.px * 1.15);
      ctx.restore();
    });
  } else {
    const y = top + area * 0.55;
    const x0 = W * 0.1;
    const x1 = W * 0.9;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x0 + (x1 - x0) * lineP, y);
    ctx.stroke();
    items.forEach((it, i) => {
      const p = prog(t, appear(i), 0.45);
      const x = x0 + ((x1 - x0) * (i + 0.5)) / n;
      const active = t >= appear(i) && (i === n - 1 || t < appear(i + 1));
      iconBadge(L, x, y, U * (active ? 0.07 : 0.055), it.icon ?? "circle-help", p, active ? theme.accent : theme.surface, active ? textOn(theme.accent, theme) : theme.accent);
      ctx.save();
      ctx.globalAlpha = easeOut(p);
      const f = fitText(ctx, it.label, (px) => bodyFontCss(theme.font, px, 700), ((x1 - x0) / n) * 0.92, 3, U * 0.045);
      ctx.fillStyle = theme.ink;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      drawLines(ctx, f.lines, x, y + U * 0.16, f.px * 1.15);
      ctx.restore();
    });
  }
  ctx.restore();
}

function anatomy(L: LayoutCtx) {
  const { ctx, W, U, theme, scene, t, top, bottom } = L;
  const area = bottom - top;
  headlineTop(L, scene.headline, top + area * 0.08, prog(t, 0));
  const cx = W / 2;
  const cy = top + area * 0.55;
  const r = U * 0.16;
  // cincin berputar
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(t * 0.4);
  ctx.strokeStyle = withAlpha(theme.accent, 0.5);
  ctx.lineWidth = U * 0.006;
  ctx.setLineDash([U * 0.02, U * 0.025]);
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.3 * easeOut(prog(t, 0.1, 0.6)), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  iconBadge(L, cx, cy, r, scene.icon ?? "target", prog(t, 0.05, 0.7));
  const items = (scene.items ?? []).slice(0, 4);
  const slots: [number, number][] =
    items.length <= 2
      ? [[-1, -0.55], [1, 0.55]]
      : [[-1, -0.6], [1, -0.6], [-1, 0.6], [1, 0.6]];
  items.forEach((it, i) => {
    const slot = slots[i] ?? [0, 1];
    const p = prog(t, 0.5 + i * 0.3, 0.5);
    if (p <= 0) return;
    const lx = cx + slot[0] * Math.min(W * 0.28, U * 0.36);
    const ly = cy + slot[1] * Math.min(area * 0.38, U * 0.42);
    const sx = cx + Math.sign(slot[0]) * r * 0.75;
    const sy = cy + Math.sign(slot[1]) * r * 0.75;
    ctx.save();
    ctx.strokeStyle = theme.ink;
    ctx.lineWidth = U * 0.005;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    const e = easeOut(p);
    ctx.lineTo(sx + (lx - sx) * e, sy + (ly - sy) * e);
    ctx.stroke();
    ctx.fillStyle = theme.ink;
    ctx.beginPath();
    ctx.arc(sx, sy, U * 0.01, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = clamp01(p * 2 - 0.6);
    const label = it.label;
    ctx.font = bodyFontCss(theme.font, U * 0.04, 700);
    const lines = wrapLines(ctx, label, Math.min(W * 0.36, U * 0.4)).slice(0, 2);
    const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + U * 0.05;
    const h = lines.length * U * 0.05 + U * 0.035;
    card(ctx, lx - w / 2, ly - h / 2, w, h, U * 0.02, theme.surface, theme.accent2, U);
    ctx.fillStyle = textOn(theme.surface, theme);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    drawLines(ctx, lines, lx, ly, U * 0.05);
    ctx.restore();
  });
}

function quote(L: LayoutCtx) {
  const { ctx, W, U, theme, scene, t, dur, top, bottom } = L;
  const area = bottom - top;
  ctx.save();
  ctx.globalAlpha = 0.18 * easeOut(prog(t, 0));
  ctx.translate(W * 0.18, top + area * 0.14);
  drawIcon(ctx, "quote", U * 0.22, theme.accent, 1, 2.4);
  ctx.restore();
  const text = scene.headline || scene.text;
  const fit = fitText(ctx, text, (px) => displayFont(theme.font, px), W * 0.82, 5, U * 0.1);
  const lh = fit.px * 1.12;
  const words = wordTimings(text, 0, Math.max(0.5, Math.min(dur, (scene.headline ? dur * 0.6 : dur))));
  const kw = new Set((scene.keywords ?? []).map((k) => k.toLowerCase()));
  ctx.font = displayFont(theme.font, fit.px);
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  const space = ctx.measureText(" ").width;
  const cy = top + area * 0.5;
  let wi = 0;
  const startY = cy - ((fit.lines.length - 1) * lh) / 2;
  fit.lines.forEach((line, li) => {
    const lw = ctx.measureText(line).width;
    let x = W / 2 - lw / 2;
    for (const word of line.split(" ")) {
      const wt = words[wi];
      wi++;
      const w = ctx.measureText(word).width;
      const p = backOut(prog(t, wt ? wt.start - 0.05 : 0, 0.25));
      if (p > 0) {
        const clean = word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
        const isKw = kw.has(clean) || [...kw].some((k) => k.includes(clean) && clean.length > 3);
        ctx.save();
        ctx.translate(x + w / 2, startY + li * lh);
        ctx.scale(p, p);
        ctx.fillStyle = isKw ? theme.accent : theme.ink;
        ctx.fillText(word, -w / 2, 0);
        ctx.restore();
      }
      x += w + space;
    }
  });
  if (scene.sub) {
    ctx.save();
    ctx.globalAlpha = easeOut(prog(t, dur * 0.5));
    ctx.font = bodyFontCss(theme.font, U * 0.04, 600);
    ctx.fillStyle = withAlpha(theme.ink, 0.75);
    ctx.textAlign = "center";
    ctx.fillText(`— ${scene.sub}`, W / 2, startY + fit.lines.length * lh + U * 0.04);
    ctx.restore();
  }
}

function list(L: LayoutCtx) {
  const { ctx, W, U, theme, scene, t, dur, top, bottom } = L;
  const area = bottom - top;
  headlineTop(L, scene.headline, top + area * 0.1, prog(t, 0));
  const items = (scene.items ?? []).slice(0, 5);
  const n = Math.max(1, items.length);
  const y0 = top + area * 0.28;
  const rowH = Math.min((area * 0.68) / n, U * 0.2);
  const step = Math.min(0.6, (dur * 0.7) / n);
  const x = W * 0.5 - Math.min(W * 0.38, U * 0.5);
  items.forEach((it, i) => {
    const p = prog(t, 0.25 + i * step, 0.45);
    const y = y0 + rowH * (i + 0.5);
    iconBadge(L, x + U * 0.05, y, U * 0.05, it.icon ?? "check", p);
    ctx.save();
    ctx.globalAlpha = easeOut(p);
    ctx.translate((1 - easeOut(p)) * -U * 0.1, 0);
    const f = fitText(ctx, it.label, (px) => bodyFontCss(theme.font, px, 700), Math.min(W * 0.66, U * 0.84), 2, U * 0.052);
    ctx.fillStyle = theme.ink;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    drawLines(ctx, f.lines, x + U * 0.14, y, f.px * 1.12);
    ctx.restore();
  });
}

function iconHero(L: LayoutCtx) {
  const { ctx, W, U, theme, scene, t, top, bottom } = L;
  const area = bottom - top;
  const cx = W / 2;
  const cy = top + area * 0.4 + Math.sin(t * 2) * U * 0.01;
  const r = Math.min(U * 0.26, area * 0.26);
  const p = backOut(prog(t, 0, 0.55));
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(p, p);
  ctx.fillStyle = withAlpha(theme.accent, 0.15);
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(t * 0.5);
  ctx.strokeStyle = theme.accent;
  ctx.lineWidth = U * 0.008;
  ctx.setLineDash([U * 0.04, U * 0.03]);
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.15, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.translate(cx, cy);
  drawIcon(ctx, scene.icon ?? "lightbulb", r * 1.25, theme.ink, prog(t, 0.1, 1.0), 1.6);
  ctx.restore();
  if (scene.headline) {
    const hp = easeOut(prog(t, 0.45));
    const f = fitText(ctx, scene.headline, (px) => displayFont(theme.font, px), W * 0.86, 2, U * 0.09);
    ctx.save();
    ctx.globalAlpha = hp;
    ctx.translate(0, (1 - hp) * U * 0.04);
    ctx.fillStyle = theme.ink;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    drawLines(ctx, f.lines, cx, top + area * 0.78, f.px * 1.06);
    ctx.restore();
  }
  if (scene.sub) {
    ctx.save();
    ctx.globalAlpha = easeOut(prog(t, 0.7));
    pill(ctx, cx, top + area * 0.93, scene.sub, bodyFontCss(theme.font, U * 0.036, 700), theme.accent2, textOn(theme.accent2, theme), U * 0.03, U * 0.062);
    ctx.restore();
  }
}

function outro(L: LayoutCtx) {
  const { ctx, W, U, theme, scene, t, top, bottom } = L;
  const area = bottom - top;
  const pulse = 1 + Math.sin(t * 4) * 0.05;
  ctx.save();
  ctx.translate(W / 2, top + area * 0.28);
  ctx.scale(pulse, pulse);
  ctx.restore();
  iconBadge(L, W / 2, top + area * 0.28, U * 0.11 * pulse, scene.icon ?? "heart", prog(t, 0, 0.55), theme.accent, textOn(theme.accent, theme));
  const text = scene.headline || "Terima kasih!";
  const f = fitText(ctx, text, (px) => displayFont(theme.font, px), W * 0.84, 3, U * 0.1);
  ctx.save();
  const p = backOut(prog(t, 0.25, 0.5));
  ctx.translate(W / 2, top + area * 0.55);
  ctx.scale(p, p);
  ctx.fillStyle = theme.ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  drawLines(ctx, f.lines, 0, 0, f.px * 1.06);
  ctx.restore();
  if (scene.sub) {
    ctx.save();
    ctx.globalAlpha = easeOut(prog(t, 0.6));
    pill(ctx, W / 2, top + area * 0.8, scene.sub, bodyFontCss(theme.font, U * 0.042, 700), theme.accent, textOn(theme.accent, theme), U * 0.045, U * 0.08);
    ctx.restore();
  }
}

/** Mode edit — footage penuh: cukup label lower-third dari headline. */
function speaker(L: LayoutCtx) {
  const { ctx, W, U, theme, scene, t, top } = L;
  if (!scene.headline) return;
  const p = easeOut(prog(t, 0.1, 0.4));
  ctx.save();
  ctx.globalAlpha = p;
  ctx.translate((1 - p) * -W * 0.3, 0);
  pill(ctx, W / 2, top + U * 0.02, scene.headline, displayFont(theme.font, U * 0.055), theme.accent, textOn(theme.accent, theme), U * 0.04, U * 0.095);
  ctx.restore();
}

export function drawLayout(L: LayoutCtx) {
  switch (L.scene.layout) {
    case "hook":
      return hook(L);
    case "stat":
      return stat(L);
    case "versus":
      return versus(L);
    case "timeline":
      return timeline(L);
    case "anatomy":
      return anatomy(L);
    case "quote":
      return quote(L);
    case "list":
      return list(L);
    case "outro":
      return outro(L);
    case "speaker":
      return speaker(L);
    case "icon":
    default:
      return iconHero(L);
  }
}

/** Stiker/objek dekoratif animasi. */
export function drawStickers(L: LayoutCtx) {
  const { ctx, W, H, U, theme, scene, t } = L;
  (scene.stickers ?? []).slice(0, 3).forEach((st, i) => {
    const p = prog(t, 0.4 + i * 0.25, 0.5);
    if (p <= 0) return;
    let x = Math.min(0.92, Math.max(0.08, st.x)) * W;
    let y = Math.min(0.9, Math.max(0.08, st.y)) * H;
    let rot = -0.12 + i * 0.12;
    let s = backOut(p);
    switch (st.anim) {
      case "bob":
        y += Math.sin(t * 2.4 + i) * U * 0.015;
        break;
      case "spin":
        rot += t * 1.2;
        break;
      case "pulse":
        s *= 1 + Math.sin(t * 5 + i) * 0.08;
        break;
      case "drift":
        x += Math.sin(t * 0.9 + i) * U * 0.03;
        y += Math.cos(t * 0.7 + i) * U * 0.015;
        break;
      default:
        break;
    }
    const r = U * 0.07;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(s, s);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.12, 0, Math.PI * 2);
    ctx.fill();
    const fill = i % 2 === 0 ? theme.accent : theme.accent2;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    drawIcon(ctx, st.icon, r * 1.15, textOn(fill, theme), 1, 2.2);
    ctx.restore();
  });
}
