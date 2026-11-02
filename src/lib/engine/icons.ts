// Penggambar ikon di canvas dengan efek "digambar" (draw-on) — dipakai
// renderer untuk objek utama, stiker, dan bullet.

import { ICONS } from "./icon-map";
import { safeIcon } from "./icon-names";

export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const pathCache = new Map<string, Path2D>();

function path2d(d: string): Path2D {
  let p = pathCache.get(d);
  if (!p) {
    p = new Path2D(d);
    pathCache.set(d, p);
  }
  return p;
}

function num(v: unknown, d = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function points(v: unknown): [number, number][] {
  const nums = String(v ?? "")
    .trim()
    .split(/[\s,]+/)
    .map(Number)
    .filter((n) => Number.isFinite(n));
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) out.push([nums[i] ?? 0, nums[i + 1] ?? 0]);
  return out;
}

/**
 * Gambar ikon terpusat di (0,0) dengan ukuran `size` px.
 * progress 0..1 = seberapa jauh garis sudah "tergambar".
 */
export function drawIcon(
  ctx: Ctx2D,
  name: string | undefined,
  size: number,
  color: string,
  progress = 1,
  lineWidth = 2,
) {
  const node = ICONS[safeIcon(name)];
  const p = Math.min(1, Math.max(0, progress));
  if (p <= 0) return;
  ctx.save();
  const s = size / 24;
  ctx.scale(s, s);
  ctx.translate(-12, -12);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (p < 1) {
    ctx.setLineDash([80, 80]);
    ctx.lineDashOffset = 80 * (1 - p);
  }
  for (const [tag, a] of node) {
    switch (tag) {
      case "path":
        if (a["d"]) ctx.stroke(path2d(String(a["d"])));
        break;
      case "circle":
        ctx.beginPath();
        ctx.arc(num(a["cx"]), num(a["cy"]), num(a["r"]), 0, Math.PI * 2);
        ctx.stroke();
        break;
      case "ellipse":
        ctx.beginPath();
        ctx.ellipse(num(a["cx"]), num(a["cy"]), num(a["rx"]), num(a["ry"]), 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case "rect": {
        const x = num(a["x"]);
        const y = num(a["y"]);
        const w = num(a["width"]);
        const h = num(a["height"]);
        const r = Math.min(num(a["rx"]), w / 2, h / 2);
        ctx.beginPath();
        if (r > 0) ctx.roundRect(x, y, w, h, r);
        else ctx.rect(x, y, w, h);
        ctx.stroke();
        break;
      }
      case "line":
        ctx.beginPath();
        ctx.moveTo(num(a["x1"]), num(a["y1"]));
        ctx.lineTo(num(a["x2"]), num(a["y2"]));
        ctx.stroke();
        break;
      case "polyline":
      case "polygon": {
        const pts = points(a["points"]);
        if (pts.length === 0) break;
        ctx.beginPath();
        pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
        if (tag === "polygon") ctx.closePath();
        ctx.stroke();
        break;
      }
      default:
        break;
    }
  }
  ctx.restore();
}
