// Renderer canvas deterministik per frame — dipakai preview & ekspor MP4.
// Aturan Remotion-nya: apa yang tergambar murni fungsi dari (komposisi, waktu).

import { pickScene, type Composition } from "@/lib/engine/types";
import { wordTimings } from "@/lib/engine/timing";
import { drawElement, PRIMARY_PALETTE, type Palette } from "@/lib/templates/kit";

export interface RenderAssets {
  bg?: CanvasImageSource | null;
  bgWidth?: number;
  bgHeight?: number;
}

function drawGridBackground(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  W: number,
  H: number,
) {
  const palette = PALETTES[0];
  ctx.fillStyle = palette.paper;
  ctx.fillRect(0, 0, W, H);
  const cell = W / 14;
  ctx.strokeStyle = palette.grid;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = Math.max(1, W * 0.0022);
  ctx.beginPath();
  for (let x = cell; x < W; x += cell) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
  }
  for (let y = cell; y < H; y += cell) {
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawImageCover(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  img: CanvasImageSource,
  imgW: number,
  imgH: number,
  W: number,
  H: number,
) {
  const scale = Math.max(W / imgW, H / imgH);
  const w = imgW * scale;
  const h = imgH * scale;
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
}

/** Render satu frame komposisi pada waktu `time` (detik) ke ctx. */
export function drawFrame(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  comp: Composition,
  time: number,
  assets: RenderAssets = {},
) {
  const W = comp.width;
  const H = comp.height;
  const palette = PRIMARY_PALETTE;

  ctx.save();
  if (assets.bg && assets.bgWidth && assets.bgHeight) {
    drawImageCover(ctx, assets.bg, assets.bgWidth, assets.bgHeight, W, H);
    // Lapisan tipis supaya teks tetap terbaca di atas gambar apa pun.
    ctx.fillStyle = palette.paper;
    ctx.globalAlpha = 0.22;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  } else {
    drawGridBackground(ctx, W, H);
  }

  const scene = pickScene(comp, time);
  if (scene) {
    const sceneTime = time - scene.start;

    // Transisi wipe tipis di awal adegan.
    const wipeP = Math.min(1, sceneTime / 0.35);
    if (wipeP < 1) {
      ctx.fillStyle = palette.marker;
      ctx.globalAlpha = 0.16 * (1 - wipeP);
      ctx.fillRect(0, 0, W * (1 - wipeP), H);
      ctx.globalAlpha = 1;
    }

    // Elemen adegan.
    const ctxAny = ctx as CanvasRenderingContext2D;
    ctxAny.textAlign = "left";
    ctxAny.textBaseline = "alphabetic";
    for (const el of scene.elements) {
      drawElement(ctx, el, scene.elements.indexOf(el), sceneTime, { W, H, palette });
    }

    // Judul adegan (kalau ada) tetap digambar di zona atas — dipakai kalau AI
    // tidak menyertakan elemen title.
    if (scene.title && !scene.elements.some((e) => e.kind === "title")) {
      ctx.font = `700 ${Math.round(H * 0.052)}px "Space Grotesk", sans-serif`;
      ctx.fillStyle = palette.ink;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      wrapLines(ctx, scene.title, W / 2, H * 0.1, W * 0.84, H * 0.06);
    }

    // Subtitle sorot kata-per-kata di zona bawah.
    if (comp.subtitleOn) {
      drawSubtitle(ctx, scene.text, scene.start, scene.end, time, W, H, palette);
    }
  }

  // Bar progres tipis di atas.
  if (comp.duration > 0) {
    const progress = Math.min(1, time / comp.duration);
    ctx.fillStyle = palette.marker;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(0, 0, W * progress, H * 0.012);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawSubtitle(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  text: string,
  sceneStart: number,
  sceneEnd: number,
  time: number,
  W: number,
  H: number,
  palette: Palette,
) {
  const words = wordTimings(text, sceneStart, sceneEnd - sceneStart);
  if (words.length === 0) return;
  const fontSize = Math.round(H * 0.034);
  ctx.font = `600 ${fontSize}px "Space Grotesk", sans-serif`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";

  const maxWidth = W * 0.86;
  const lines: { words: typeof words; width: number }[] = [];
  let current: typeof words = [];
  let currentWidth = 0;
  const spaceW = ctx.measureText(" ").width;
  for (const wt of words) {
    const w = ctx.measureText(wt.word).width;
    const attempt = currentWidth === 0 ? w : currentWidth + spaceW + w;
    if (attempt > maxWidth && current.length > 0) {
      lines.push({ words: current, width: currentWidth });
      current = [wt];
      currentWidth = w;
    } else {
      current.push(wt);
      currentWidth = attempt;
    }
  }
  if (current.length > 0) lines.push({ words: current, width: currentWidth });

  const lineH = fontSize * 1.4;
  const blockH = lines.length * lineH;
  const bottomZone = H * 0.16;
  const startY = H - bottomZone + (bottomZone - blockH) / 2 + lineH / 2;

  const active = words.find((wt) => time >= wt.start && time < wt.end);
  lines.forEach((line, li) => {
    let x = (W - line.width) / 2;
    const y = startY + li * lineH;
    for (const wt of line.words) {
      const w = ctx.measureText(wt.word).width;
      const isActive = active === wt;
      if (isActive) {
        ctx.fillStyle = palette.marker;
        ctx.globalAlpha = 0.9;
        roundRectPath(ctx, x - fontSize * 0.18, y - fontSize * 0.62, w + fontSize * 0.36, fontSize * 1.24, fontSize * 0.22);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = palette.ink;
      ctx.fillText(wt.word, x, y);
      x += w + spaceW;
    }
  });
}

function roundRectPath(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapLines(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const attempt = current ? `${current} ${word}` : word;
    if (ctx.measureText(attempt).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = attempt;
    }
  }
  if (current) lines.push(current);
  const startY = y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, i) => ctx.fillText(line, x, startY + i * lineHeight));
}
