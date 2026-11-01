// Kit template visual bergaya "kertas kotak-kotak / papan tulis" — elemen
// doodle siap pakai yang diisi & dipilih AI, dengan variasi per elemen.

import type { ElKind, SceneElement } from "@/lib/engine/types";

export interface Palette {
  ink: string;
  paper: string;
  marker: string;
  teal: string;
  red: string;
  grid: string;
}

export const PALETTES: Palette[] = [
  { ink: "#1e2a4a", paper: "#fcfbf6", marker: "#f2761b", teal: "#0e7c7b", red: "#c73e3a", grid: "#9aa7c9" },
  { ink: "#22303f", paper: "#fbfaf4", marker: "#e0483e", teal: "#2b7a78", red: "#b3403b", grid: "#a3aecb" },
  { ink: "#2a2340", paper: "#fcf9f2", marker: "#d8871f", teal: "#3a7d5c", red: "#c04a6b", grid: "#a9a0c4" },
  { ink: "#1d3b2a", paper: "#f9f8ef", marker: "#d94f2b", teal: "#1f6f8b", red: "#a63d40", grid: "#9db6a7" },
];

/** Katalog untuk AI: daftar elemen + deskripsi bahasa Indonesia. */
export const CATALOG: { kind: ElKind; description: string }[] = [
  { kind: "title", description: "Judul besar di bagian atas canvas, muncul dengan efek pop. Cocok untuk pembuka atau nama bagian." },
  { kind: "illustration", description: "Ilustrasi doodle sederhana di tengah. shape wajib diisi: plane (pesawat), wing (sayap), person (orang berlari), cloud, arrowUp (panah ke atas), box (kardus/triplek), fuel (tangki bahan bakar), engine (mesin), bird, flag, star, wheel, paperPlane, arrowFlow (aliran angin)." },
  { kind: "flow", description: "Beberapa panah aliran yang bergerak menyamping, melambangkan angin/aliran/urutan proses." },
  { kind: "label", description: "Label istilah dengan garis penunjuk, misalnya 'gaya angkat', 'tekanan kecil'. text wajib." },
  { kind: "bubble", description: "Gelembung pertanyaan gaya ngobrol, cocok untuk hook pembuka. text wajib." },
  { kind: "emphasize", description: "Sorotan lingkaran tangan (sketsa) di sekitar teks/objek penting. text opsional." },
  { kind: "list", description: "Daftar 2-3 poin singkat dengan bullet sketsa. text = poin dipisah ' | '." },
  { kind: "badge", description: "Stiker kecil bertuliskan kata kunci, miring sedikit. text wajib." },
  { kind: "outro", description: "Kartu penutup dengan kalimat pamit. text wajib." },
];

export const SHAPE_NAMES = [
  "plane", "wing", "person", "cloud", "arrowUp", "box", "fuel", "engine",
  "bird", "flag", "star", "wheel", "paperPlane", "arrowFlow",
] as const;

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

/** Gambar satu doodle shape terpusat di (0,0) dengan ukuran size. */
export function drawShape(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  shape: string,
  size: number,
  color: string,
  progress: number,
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(2, size * 0.055);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const s = size / 2;
  const p = Math.min(1, Math.max(0, progress));
  ctx.globalAlpha = p;
  const path = (fn: () => void) => {
    ctx.beginPath();
    fn();
    ctx.stroke();
  };
  switch (shape) {
    case "plane": {
      // badan + sayap + jendela, miring naik
      ctx.rotate(-0.18);
      path(() => {
        ctx.moveTo(-s, 0);
        ctx.quadraticCurveTo(-s * 0.2, -s * 0.35, s, -s * 0.1);
        ctx.quadraticCurveTo(s * 1.05, 0, s * 0.6, s * 0.18);
        ctx.lineTo(-s * 0.8, s * 0.22);
        ctx.quadraticCurveTo(-s, s * 0.15, -s, 0);
        ctx.closePath();
      });
      path(() => {
        ctx.moveTo(-s * 0.1, -s * 0.05);
        ctx.lineTo(-s * 0.5, s * 0.75);
        ctx.lineTo(-s * 0.15, s * 0.7);
        ctx.lineTo(s * 0.2, -s * 0.02);
      });
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(-s * 0.2 + i * s * 0.4, s * 0.02, s * 0.07, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    }
    case "wing": {
      // penampang sayap: atas melengkung, bawah rata
      path(() => {
        ctx.moveTo(-s, s * 0.25);
        ctx.quadraticCurveTo(0, -s * 0.95, s, s * 0.05);
        ctx.quadraticCurveTo(0, s * 0.45, -s, s * 0.25);
        ctx.closePath();
      });
      path(() => {
        ctx.moveTo(-s * 0.3, s * 0.28);
        ctx.lineTo(-s * 0.3, -s * 0.3);
      });
      break;
    }
    case "person": {
      // orang berlari membawa benda lebar
      ctx.beginPath();
      ctx.arc(s * 0.1, -s * 0.6, s * 0.22, 0, Math.PI * 2);
      ctx.stroke();
      path(() => {
        ctx.moveTo(s * 0.05, -s * 0.38);
        ctx.lineTo(-s * 0.05, s * 0.05);
        ctx.lineTo(-s * 0.4, s * 0.5);
      });
      path(() => {
        ctx.moveTo(-s * 0.05, s * 0.05);
        ctx.lineTo(s * 0.3, s * 0.45);
      });
      path(() => {
        ctx.moveTo(-s * 0.02, -s * 0.25);
        ctx.lineTo(-s * 0.7, -s * 0.35);
      });
      path(() => {
        ctx.moveTo(-s * 0.95, -s * 0.5);
        ctx.lineTo(-s * 0.95, s * 0.05);
        ctx.lineTo(-s * 0.35, s * 0.05);
        ctx.lineTo(-s * 0.35, -s * 0.5);
        ctx.closePath();
      });
      break;
    }
    case "cloud": {
      path(() => {
        ctx.moveTo(-s * 0.8, s * 0.25);
        ctx.arc(-s * 0.45, s * 0.05, s * 0.3, Math.PI * 0.6, Math.PI * 1.6);
        ctx.arc(0, -s * 0.15, s * 0.4, Math.PI * 1.1, Math.PI * 1.95);
        ctx.arc(s * 0.55, s * 0.05, s * 0.28, Math.PI * 1.4, Math.PI * 0.4);
        ctx.lineTo(-s * 0.8, s * 0.25);
      });
      break;
    }
    case "arrowUp": {
      path(() => {
        ctx.moveTo(0, s);
        ctx.lineTo(0, -s * 0.6);
      });
      path(() => {
        ctx.moveTo(-s * 0.45, -s * 0.1);
        ctx.lineTo(0, -s * 0.8);
        ctx.lineTo(s * 0.45, -s * 0.1);
      });
      break;
    }
    case "box": {
      path(() => {
        ctx.rect(-s * 0.9, -s * 0.7, s * 1.8, s * 1.4);
      });
      path(() => {
        ctx.moveTo(-s * 0.9, -s * 0.1);
        ctx.lineTo(s * 0.9, -s * 0.1);
      });
      break;
    }
    case "fuel": {
      path(() => {
        ctx.rect(-s * 0.55, -s * 0.7, s * 1.1, s * 1.5);
      });
      path(() => {
        ctx.moveTo(-s * 0.25, -s * 0.95);
        ctx.lineTo(s * 0.25, -s * 0.95);
        ctx.lineTo(s * 0.25, -s * 0.7);
        ctx.lineTo(-s * 0.25, -s * 0.7);
      });
      path(() => {
        ctx.moveTo(0, -s * 0.35);
        ctx.lineTo(0, s * 0.4);
        ctx.moveTo(-s * 0.2, s * 0.1);
        ctx.lineTo(0, s * 0.4);
        ctx.lineTo(s * 0.2, s * 0.1);
      });
      break;
    }
    case "engine": {
      path(() => {
        ctx.ellipse(0, 0, s * 0.9, s * 0.55, 0, 0, Math.PI * 2);
      });
      path(() => {
        ctx.ellipse(s * 0.45, 0, s * 0.35, s * 0.4, 0, 0, Math.PI * 2);
      });
      for (let i = 0; i < 3; i++) {
        path(() => {
          ctx.moveTo(-s * 0.9, -s * 0.25 + i * s * 0.25);
          ctx.lineTo(s * 0.1, -s * 0.25 + i * s * 0.25);
        });
      }
      break;
    }
    case "bird": {
      path(() => {
        ctx.moveTo(-s, 0);
        ctx.quadraticCurveTo(-s * 0.4, -s * 0.5, 0, -s * 0.05);
        ctx.quadraticCurveTo(s * 0.4, -s * 0.5, s, 0);
        ctx.quadraticCurveTo(s * 0.4, s * 0.35, 0, s * 0.1);
        ctx.quadraticCurveTo(-s * 0.4, s * 0.35, -s, 0);
      });
      break;
    }
    case "flag": {
      path(() => {
        ctx.moveTo(-s * 0.6, s);
        ctx.lineTo(-s * 0.6, -s);
      });
      path(() => {
        ctx.moveTo(-s * 0.6, -s);
        ctx.quadraticCurveTo(0, -s * 0.6, s * 0.7, -s * 0.9);
        ctx.quadraticCurveTo(s * 0.3, -s * 0.3, -s * 0.6, -s * 0.05);
      });
      break;
    }
    case "star": {
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a1 = -Math.PI / 2 + (i * 2 * Math.PI * 2) / 5;
        const a2 = -Math.PI / 2 + ((i * 2 + 1) * Math.PI * 2) / 5;
        if (i === 0) ctx.moveTo(Math.cos(a1) * s, Math.sin(a1) * s);
        else ctx.lineTo(Math.cos(a1) * s, Math.sin(a1) * s);
        ctx.lineTo(Math.cos(a2) * s * 0.45, Math.sin(a2) * s * 0.45);
      }
      ctx.closePath();
      ctx.stroke();
      break;
    }
    case "wheel": {
      path(() => {
        ctx.arc(0, 0, s * 0.9, 0, Math.PI * 2);
      });
      path(() => {
        ctx.arc(0, 0, s * 0.25, 0, Math.PI * 2);
      });
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        path(() => {
          ctx.moveTo(Math.cos(a) * s * 0.25, Math.sin(a) * s * 0.25);
          ctx.lineTo(Math.cos(a) * s * 0.9, Math.sin(a) * s * 0.9);
        });
      }
      break;
    }
    case "paperPlane": {
      path(() => {
        ctx.moveTo(-s, 0);
        ctx.lineTo(s, -s * 0.7);
        ctx.lineTo(-s * 0.2, s * 0.1);
        ctx.closePath();
      });
      path(() => {
        ctx.moveTo(-s * 0.2, s * 0.1);
        ctx.lineTo(-s * 0.45, s * 0.6);
        ctx.lineTo(-s * 0.1, s * 0.15);
      });
      break;
    }
    case "arrowFlow":
    default: {
      path(() => {
        ctx.moveTo(-s, 0);
        ctx.lineTo(s * 0.4, 0);
      });
      path(() => {
        ctx.moveTo(s * 0.05, -s * 0.35);
        ctx.lineTo(s * 0.55, 0);
        ctx.lineTo(s * 0.05, s * 0.35);
      });
      break;
    }
  }
  ctx.restore();
}

interface Layout {
  W: number;
  H: number;
  palette: Palette;
}

function elementProgress(globalIndex: number, sceneTime: number) {
  const delay = globalIndex * 0.22;
  return easeOutCubic(Math.min(1, Math.max(0, (sceneTime - delay) / 0.55)));
}

function entranceOffset(from: SceneElement["from"], p: number, W: number, H: number) {
  const d = (1 - p) * W * 0.35;
  switch (from) {
    case "left": return { dx: -d, dy: 0 };
    case "right": return { dx: d, dy: 0 };
    case "top": return { dx: 0, dy: -d };
    case "bottom": return { dx: 0, dy: d };
    default: return { dx: 0, dy: (1 - p) * H * 0.04 };
  }
}

/** Gambar satu elemen adegan pada progress tertentu. */
export function drawElement(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  el: SceneElement,
  index: number,
  sceneTime: number,
  layout: Layout,
) {
  const { W, H, palette } = layout;
  const variant = Math.max(0, el.variant ?? index);
  const accent = [palette.marker, palette.teal, palette.red, palette.ink][variant % 4];
  const p = elementProgress(index, sceneTime);
  if (p <= 0.001) return;
  const scale = el.scale ?? 1;
  const x = (el.x ?? 0.5) * W;
  const y = (el.y ?? 0.45) * H;
  const { dx, dy } = entranceOffset(el.from, p, W, H);

  ctx.save();
  ctx.translate(x + dx, y + dy);
  const baseFont = `${Math.round(H * 0.045 * scale)}px "Space Grotesk", sans-serif`;

  switch (el.kind) {
    case "title": {
      const size = H * 0.062 * scale;
      ctx.font = `700 ${Math.round(size)}px "Space Grotesk", sans-serif`;
      ctx.fillStyle = palette.ink;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const pop = 1 + (1 - p) * 0.25;
      ctx.translate(0, 0);
      ctx.scale(pop, pop);
      ctx.globalAlpha = p;
      const text = el.text ?? "";
      const maxWidth = W * 0.86;
      wrapText(ctx, text, 0, 0, maxWidth, size * 1.15);
      break;
    }
    case "illustration": {
      const size = H * 0.2 * scale;
      drawShape(ctx, el.shape ?? "arrowFlow", size, accent, p);
      break;
    }
    case "flow": {
      const count = 3;
      const size = H * 0.06 * scale;
      ctx.globalAlpha = p;
      for (let i = 0; i < count; i++) {
        const phase = ((sceneTime * 0.6 + i * 0.33) % 1);
        const fx = (phase - 0.5) * W * 0.5;
        ctx.save();
        ctx.translate(fx, (i - 1) * size * 0.9);
        ctx.globalAlpha = p * (0.45 + 0.55 * (1 - phase));
        drawShape(ctx, "arrowFlow", size, accent, 1);
        ctx.restore();
      }
      break;
    }
    case "label": {
      ctx.font = `600 ${Math.round(H * 0.032 * scale)}px "Space Grotesk", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.globalAlpha = p;
      const text = el.text ?? "";
      const w = Math.min(W * 0.5, ctx.measureText(text).width + W * 0.06);
      const h = H * 0.055 * scale;
      ctx.fillStyle = palette.paper;
      ctx.strokeStyle = accent;
      ctx.lineWidth = W * 0.004;
      roundRect(ctx, -w / 2, -h / 2, w, h, h * 0.3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = accent;
      ctx.fillText(text, 0, 0);
      break;
    }
    case "bubble": {
      ctx.font = `500 ${Math.round(H * 0.036 * scale)}px "Space Grotesk", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.globalAlpha = p;
      const text = el.text ?? "";
      const w = Math.min(W * 0.8, ctx.measureText(text).width + W * 0.09);
      const h = H * 0.075 * scale;
      ctx.fillStyle = palette.ink;
      roundRect(ctx, -w / 2, -h / 2, w, h, h * 0.45);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-w * 0.2, h / 2);
      ctx.lineTo(-w * 0.28, h * 0.95);
      ctx.lineTo(-w * 0.08, h / 2);
      ctx.fill();
      ctx.fillStyle = palette.paper;
      ctx.font = `500 ${Math.round(H * 0.034 * scale)}px "Space Grotesk", sans-serif`;
      ctx.fillText(text, 0, 0);
      break;
    }
    case "emphasize": {
      const r = H * 0.12 * scale;
      ctx.strokeStyle = accent;
      ctx.lineWidth = W * 0.008;
      ctx.globalAlpha = p * 0.9;
      ctx.beginPath();
      for (let a = 0; a <= Math.PI * 2.05; a += 0.25) {
        const rr = r * (1 + Math.sin(a * 5 + index) * 0.04);
        const px = Math.cos(a) * rr;
        const py = Math.sin(a) * rr * 0.8;
        if (a === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      if (el.text) {
        ctx.font = `600 ${Math.round(H * 0.03 * scale)}px "Caveat", cursive`;
        ctx.fillStyle = accent;
        ctx.textAlign = "center";
        ctx.fillText(el.text, 0, r * 1.3);
      }
      break;
    }
    case "list": {
      const points = (el.text ?? "").split("|").map((s) => s.trim()).filter(Boolean);
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.font = `500 ${Math.round(H * 0.034 * scale)}px "Space Grotesk", sans-serif`;
      const lineH = H * 0.065 * scale;
      points.forEach((pt, i) => {
        const lp = elementProgress(index + i, sceneTime);
        ctx.globalAlpha = lp;
        const yy = (i - (points.length - 1) / 2) * lineH;
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(-W * 0.06, yy, W * 0.008, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = palette.ink;
        ctx.fillText(pt, -W * 0.035, yy);
      });
      break;
    }
    case "badge": {
      ctx.font = `700 ${Math.round(H * 0.03 * scale)}px "Caveat", cursive`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.globalAlpha = p;
      ctx.rotate(-0.08);
      const text = el.text ?? "";
      const w = ctx.measureText(text).width + W * 0.05;
      const h = H * 0.05 * scale;
      ctx.fillStyle = accent;
      roundRect(ctx, -w / 2, -h / 2, w, h, h * 0.25);
      ctx.fill();
      ctx.fillStyle = palette.paper;
      ctx.fillText(text, 0, 0);
      break;
    }
    case "outro": {
      ctx.globalAlpha = p;
      const w = W * 0.8;
      const h = H * 0.22 * scale;
      ctx.fillStyle = palette.ink;
      roundRect(ctx, -w / 2, -h / 2, w, h, H * 0.03);
      ctx.fill();
      ctx.fillStyle = palette.paper;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `600 ${Math.round(H * 0.04 * scale)}px "Space Grotesk", sans-serif`;
      wrapText(ctx, el.text ?? "", 0, 0, w * 0.85, H * 0.052 * scale);
      break;
    }
    default:
      break;
  }
  ctx.restore();
}

function roundRect(
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

function wrapText(
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
