// Renderer canvas deterministik per frame — dipakai preview & ekspor video.
// Aturan Remotion-nya: apa yang tergambar murni fungsi dari (komposisi, waktu).

import { drawBackground, drawParticles, rand } from "./background";
import type { Ctx2D } from "./icons";
import { clamp01, drawLayout, drawStickers, easeOut, backOut, type LayoutCtx } from "./layouts";
import { bodyFontCss, displayFont, withAlpha } from "./themes";
import { wordTimings } from "./timing";
import { pickScene, type Composition, type Scene, type Theme } from "./types";

export interface RenderAssets {
  bg?: CanvasImageSource | null;
  bgWidth?: number;
  bgHeight?: number;
  /** Mode edit: frame video pembicara saat ini. */
  video?: CanvasImageSource | null;
  videoWidth?: number;
  videoHeight?: number;
}

function drawCover(ctx: Ctx2D, img: CanvasImageSource, iw: number, ih: number, x: number, y: number, w: number, h: number, zoom = 1) {
  const scale = Math.max(w / iw, h / ih) * zoom;
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

export function subtitleZone(comp: Composition): number {
  const H = comp.height;
  return comp.mode === "edit" ? H * 0.26 : H * (comp.width > comp.height ? 0.2 : 0.16);
}

/** Mode edit: adegan selain "speaker" menampilkan pembicara sebagai PiP. */
export function speakerModeOf(comp: Composition, scene: Scene | null): "full" | "pip" | "hidden" {
  if (comp.mode !== "edit") return "hidden";
  if (!scene) return "full";
  if (scene.speaker) return scene.speaker;
  return scene.layout === "speaker" ? "full" : "pip";
}

/** Render satu frame komposisi pada waktu `time` (detik) ke ctx. */
export function drawFrame(ctx: Ctx2D, comp: Composition, time: number, assets: RenderAssets = {}) {
  const W = comp.width;
  const H = comp.height;
  const U = Math.min(W, H);
  const theme = comp.theme;
  const scene = pickScene(comp, time);
  const sceneTime = scene ? time - scene.start : time;
  const sceneDur = scene ? Math.max(0.3, scene.end - scene.start) : 1;
  const spk = speakerModeOf(comp, scene);
  const hasVideo = Boolean(assets.video && assets.videoWidth && assets.videoHeight);

  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  // ---- latar ----
  if (spk === "full" && hasVideo && assets.video) {
    const zoom = 1.02 + 0.045 * clamp01(sceneTime / sceneDur);
    drawCover(ctx, assets.video, assets.videoWidth ?? 1, assets.videoHeight ?? 1, 0, 0, W, H, zoom);
    const g = ctx.createLinearGradient(0, H * 0.55, 0, H);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.6)");
    ctx.fillStyle = g;
    ctx.fillRect(0, H * 0.55, W, H * 0.45);
  } else if (comp.mode === "explainer" && assets.bg && assets.bgWidth && assets.bgHeight) {
    drawCover(ctx, assets.bg, assets.bgWidth, assets.bgHeight, 0, 0, W, H, 1 + 0.03 * Math.sin(time * 0.2));
    ctx.fillStyle = withAlpha(theme.bg, 0.3);
    ctx.fillRect(0, 0, W, H);
  } else {
    drawBackground(ctx, theme, W, H, time);
  }
  if (spk !== "full") drawParticles(ctx, theme.particles, theme, W, H, time);

  const zone = comp.subtitleOn ? subtitleZone(comp) : H * 0.06;
  const top = H * 0.07;
  let bottom = H - zone - U * 0.02;

  // ---- PiP pembicara ----
  if (spk === "pip" && hasVideo && assets.video) {
    const portrait = H > W * 1.1;
    const ph = portrait ? H * 0.22 : U * 0.36;
    const pw = ph * 0.8;
    const px = W - pw - U * 0.05;
    const py = H - zone - ph - U * 0.02;
    if (portrait) bottom = py - U * 0.02;
    const p = backOut(clamp01(sceneTime / 0.45));
    ctx.save();
    ctx.translate(px + pw / 2, py + ph / 2);
    ctx.scale(p, p);
    ctx.fillStyle = theme.accent;
    ctx.beginPath();
    ctx.roundRect(-pw / 2 + U * 0.012, -ph / 2 + U * 0.012, pw, ph, U * 0.035);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(-pw / 2, -ph / 2, pw, ph, U * 0.035);
    ctx.save();
    ctx.clip();
    drawCover(ctx, assets.video, assets.videoWidth ?? 1, assets.videoHeight ?? 1, -pw / 2, -ph / 2, pw, ph, 1.05);
    ctx.restore();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = U * 0.008;
    ctx.stroke();
    ctx.restore();
  }

  // ---- adegan ----
  if (scene) {
    const L: LayoutCtx = { ctx, W, H, U, theme: spk === "full" ? onVideoTheme(theme) : theme, scene, t: sceneTime, dur: sceneDur, top, bottom };
    const tp = easeOut(clamp01(sceneTime / 0.4));
    ctx.save();
    switch (scene.transition) {
      case "zoom": {
        const s = 1.12 - 0.12 * tp;
        ctx.translate(W / 2, H / 2);
        ctx.scale(s, s);
        ctx.translate(-W / 2, -H / 2);
        break;
      }
      case "slide":
        ctx.translate((1 - tp) * W * 0.25, 0);
        break;
      case "fade":
        ctx.translate(0, (1 - tp) * U * 0.03);
        break;
      default:
        break;
    }
    drawLayout(L);
    drawStickers(L);
    ctx.restore();

    if (scene.transition === "wipe" && sceneTime < 0.45) {
      const p = easeOut(sceneTime / 0.45);
      ctx.fillStyle = theme.accent;
      ctx.fillRect(W * p, 0, W * (1 - p), H);
    }
    if (scene.transition === "glitch" && sceneTime < 0.3) {
      for (let i = 0; i < 7; i++) {
        const y = rand(i + Math.floor(sceneTime * 30) * 7) * H;
        ctx.fillStyle = withAlpha(i % 2 ? theme.accent : theme.accent2, 0.35);
        ctx.fillRect((rand(i + 3) - 0.5) * U * 0.1, y, W, H * 0.02 * (1 + rand(i + 9) * 2));
      }
    }

    if (comp.subtitleOn) {
      if (comp.mode === "edit") drawPunchCaption(ctx, scene, time, W, H, U, theme);
      else drawSubtitle(ctx, scene, time, W, H, U, theme, zone);
    }
  }

  // ---- bar progres ----
  if (comp.duration > 0) {
    ctx.fillStyle = theme.accent;
    ctx.globalAlpha = 0.9;
    ctx.fillRect(0, 0, W * Math.min(1, time / comp.duration), H * 0.008);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

/** Di atas footage penuh, teks memakai warna terang agar terbaca. */
function onVideoTheme(theme: Theme): Theme {
  return { ...theme, ink: "#ffffff", surface: "#ffffff" };
}

function isKeyword(word: string, keywords: string[] | undefined): boolean {
  if (!keywords || keywords.length === 0) return false;
  const w = word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  if (w.length < 2) return false;
  return keywords.some((k) => {
    const kk = k.toLowerCase();
    return kk === w || (w.length > 3 && kk.split(/\s+/).includes(w));
  });
}

function drawSubtitle(ctx: Ctx2D, scene: Scene, time: number, W: number, H: number, U: number, theme: Theme, zone: number) {
  const words = wordTimings(scene.text, scene.start, scene.end - scene.start);
  if (words.length === 0) return;
  const fontSize = Math.round(U * 0.046);
  ctx.save();
  ctx.font = bodyFontCss(theme.font, fontSize, 700);
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  const maxWidth = W * 0.86;
  const lines: { words: typeof words; width: number }[] = [];
  let cur: typeof words = [];
  let curW = 0;
  const spaceW = ctx.measureText(" ").width;
  for (const wt of words) {
    const w = ctx.measureText(wt.word).width;
    const attempt = curW === 0 ? w : curW + spaceW + w;
    if (attempt > maxWidth && cur.length > 0) {
      lines.push({ words: cur, width: curW });
      cur = [wt];
      curW = w;
    } else {
      cur.push(wt);
      curW = attempt;
    }
  }
  if (cur.length > 0) lines.push({ words: cur, width: curW });
  // tampilkan maksimal 3 baris di sekitar kata aktif
  const foundIdx = words.findIndex((wt) => time >= wt.start && time < wt.end);
  const activeIdx = Math.max(0, foundIdx);
  let acc = 0;
  let activeLine = 0;
  lines.forEach((l, i) => {
    if (activeIdx >= acc && activeIdx < acc + l.words.length) activeLine = i;
    acc += l.words.length;
  });
  const firstLine = Math.max(0, Math.min(activeLine - 1, lines.length - 3));
  const shown = lines.slice(firstLine, firstLine + 3);
  const lineH = fontSize * 1.45;
  const blockH = shown.length * lineH;
  const startY = H - zone + (zone - blockH) / 2 + lineH / 2;
  // panel lembut di belakang subtitle
  ctx.fillStyle = withAlpha(theme.bg, 0.72);
  ctx.beginPath();
  ctx.roundRect(W * 0.05, startY - lineH / 2 - U * 0.015, W * 0.9, blockH + U * 0.03, U * 0.03);
  ctx.fill();
  const active = foundIdx < 0 ? null : words[activeIdx];
  shown.forEach((line, li) => {
    let x = (W - line.width) / 2;
    const y = startY + li * lineH;
    for (const wt of line.words) {
      const w = ctx.measureText(wt.word).width;
      const on = active === wt && time >= wt.start;
      if (on) {
        ctx.fillStyle = theme.accent;
        ctx.beginPath();
        ctx.roundRect(x - fontSize * 0.18, y - fontSize * 0.64, w + fontSize * 0.36, fontSize * 1.28, fontSize * 0.25);
        ctx.fill();
      }
      ctx.fillStyle = on ? theme.bg : isKeyword(wt.word, scene.keywords) ? theme.accent2 : theme.ink;
      ctx.fillText(wt.word, x, y);
      x += w + spaceW;
    }
  });
  ctx.restore();
}

/** Caption punchy ala reels: 3-4 kata per kelompok, kata aktif membesar. */
function drawPunchCaption(ctx: Ctx2D, scene: Scene, time: number, W: number, H: number, U: number, theme: Theme) {
  const words = wordTimings(scene.text, scene.start, scene.end - scene.start);
  if (words.length === 0) return;
  const idx = words.findIndex((wt) => time >= wt.start && time < wt.end);
  const activeIdx = idx < 0 ? words.length - 1 : idx;
  const group = Math.floor(activeIdx / 4);
  const chunk = words.slice(group * 4, group * 4 + 4);
  const fontSize = Math.round(U * 0.075);
  ctx.save();
  ctx.font = displayFont(theme.font, fontSize);
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  const space = ctx.measureText(" ").width;
  const widths = chunk.map((c) => ctx.measureText(c.word.toUpperCase()).width);
  let total = widths.reduce((a, b) => a + b, 0) + space * (chunk.length - 1);
  let scale = 1;
  if (total > W * 0.9) {
    scale = (W * 0.9) / total;
    total = W * 0.9;
  }
  const y = H * 0.8;
  let x = (W - total) / 2;
  chunk.forEach((wt, i) => {
    const w = (widths[i] ?? 0) * scale;
    const on = wt === words[activeIdx];
    const pop = on ? 1 + 0.12 * (1 - clamp01((time - wt.start) / 0.15)) : 1;
    ctx.save();
    ctx.translate(x + w / 2, y);
    ctx.scale(scale * pop, scale * pop);
    ctx.lineWidth = fontSize * 0.16;
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(0,0,0,0.85)";
    const txt = wt.word.toUpperCase();
    const tw = widths[i] ?? 0;
    ctx.strokeText(txt, -tw / 2, 0);
    ctx.fillStyle = on ? theme.accent : isKeyword(wt.word, scene.keywords) ? theme.accent2 : "#ffffff";
    ctx.fillText(txt, -tw / 2, 0);
    ctx.restore();
    x += w + space * scale;
  });
  ctx.restore();
}
