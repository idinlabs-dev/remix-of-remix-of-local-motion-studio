// Latar & partikel ambient — semua fungsi deterministik dari waktu.

import type { Ctx2D } from "./icons";
import type { ParticleKind, Theme } from "./types";
import { withAlpha } from "./themes";

export function rand(i: number): number {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export function drawBackground(ctx: Ctx2D, theme: Theme, W: number, H: number, t: number) {
  ctx.save();
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, W, H);
  const U = Math.min(W, H);
  switch (theme.background) {
    case "paper-grid": {
      const cell = U / 14;
      ctx.strokeStyle = withAlpha(theme.muted, 0.35);
      ctx.lineWidth = Math.max(1, U * 0.0022);
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
      break;
    }
    case "blueprint": {
      const cell = U / 28;
      ctx.lineWidth = Math.max(1, U * 0.0012);
      for (let pass = 0; pass < 2; pass++) {
        const step = pass === 0 ? cell : cell * 4;
        ctx.strokeStyle = withAlpha(theme.muted, pass === 0 ? 0.25 : 0.5);
        ctx.beginPath();
        for (let x = 0; x < W; x += step) {
          ctx.moveTo(x, 0);
          ctx.lineTo(x, H);
        }
        for (let y = 0; y < H; y += step) {
          ctx.moveTo(0, y);
          ctx.lineTo(W, y);
        }
        ctx.stroke();
      }
      const scanY = ((t * 0.12) % 1) * H;
      const g = ctx.createLinearGradient(0, scanY - H * 0.08, 0, scanY);
      g.addColorStop(0, withAlpha(theme.accent, 0));
      g.addColorStop(1, withAlpha(theme.accent, 0.12));
      ctx.fillStyle = g;
      ctx.fillRect(0, scanY - H * 0.08, W, H * 0.08);
      break;
    }
    case "dots": {
      const cell = U / 18;
      ctx.fillStyle = withAlpha(theme.muted, 0.45);
      for (let y = cell / 2; y < H; y += cell) {
        for (let x = cell / 2; x < W; x += cell) {
          ctx.beginPath();
          ctx.arc(x, y, U * 0.0035, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }
    case "gradient": {
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, theme.bg);
      g.addColorStop(1, theme.muted);
      ctx.fillStyle = g;
      ctx.globalAlpha = 0.55;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
      const cx = W * (0.5 + Math.sin(t * 0.25) * 0.3);
      const cy = H * (0.35 + Math.cos(t * 0.2) * 0.15);
      const r = ctx.createRadialGradient(cx, cy, 0, cx, cy, U * 0.8);
      r.addColorStop(0, withAlpha(theme.accent, 0.22));
      r.addColorStop(1, withAlpha(theme.accent, 0));
      ctx.fillStyle = r;
      ctx.fillRect(0, 0, W, H);
      break;
    }
    case "noise-dark": {
      for (let i = 0; i < 6; i++) {
        const y = ((rand(i) + t * 0.03 * (1 + i * 0.2)) % 1) * H;
        ctx.fillStyle = withAlpha(theme.ink, 0.025);
        ctx.fillRect(0, y, W, H * 0.004);
      }
      const flicker = 0.85 + 0.15 * Math.sin(t * 13) * Math.sin(t * 7.3);
      const r = ctx.createRadialGradient(W / 2, H * 0.45, U * 0.15, W / 2, H * 0.45, Math.max(W, H) * 0.75);
      r.addColorStop(0, withAlpha(theme.surface, 0.5 * flicker));
      r.addColorStop(1, "rgba(0,0,0,0.85)");
      ctx.fillStyle = r;
      ctx.fillRect(0, 0, W, H);
      break;
    }
    case "stars": {
      for (let i = 0; i < 160; i++) {
        const x = rand(i) * W;
        const y = rand(i + 500) * H;
        const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * (0.6 + rand(i + 9) * 2) + i));
        ctx.fillStyle = withAlpha(theme.ink, 0.8 * tw);
        ctx.beginPath();
        ctx.arc(x, y, U * (0.0012 + rand(i + 77) * 0.0028), 0, Math.PI * 2);
        ctx.fill();
      }
      const r = ctx.createRadialGradient(W * 0.75, H * 0.2, 0, W * 0.75, H * 0.2, U * 0.9);
      r.addColorStop(0, withAlpha(theme.accent, 0.18));
      r.addColorStop(1, withAlpha(theme.accent, 0));
      ctx.fillStyle = r;
      ctx.fillRect(0, 0, W, H);
      break;
    }
    case "topo": {
      ctx.strokeStyle = withAlpha(theme.muted, 0.35);
      ctx.lineWidth = Math.max(1, U * 0.002);
      const cx = W * 0.5;
      const cy = H * 0.55;
      for (let k = 1; k <= 14; k++) {
        ctx.beginPath();
        const base = k * U * 0.075 + ((t * U * 0.01) % (U * 0.075));
        for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.12) {
          const wob = 1 + 0.12 * Math.sin(a * 3 + k) + 0.06 * Math.sin(a * 5 - k * 0.7);
          const x = cx + Math.cos(a) * base * wob;
          const y = cy + Math.sin(a) * base * wob * 0.8;
          if (a === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      break;
    }
    case "plain":
    default:
      break;
  }
  ctx.restore();
}

export function drawParticles(ctx: Ctx2D, kind: ParticleKind, theme: Theme, W: number, H: number, t: number) {
  if (kind === "none") return;
  const U = Math.min(W, H);
  ctx.save();
  switch (kind) {
    case "dust": {
      for (let i = 0; i < 40; i++) {
        const x = (rand(i) * W + Math.sin(t * 0.5 + i) * U * 0.02) % W;
        const y = (((rand(i + 40) - t * 0.02 * (0.5 + rand(i + 3))) % 1) + 1) % 1;
        ctx.fillStyle = withAlpha(theme.ink, 0.12 + rand(i + 8) * 0.18);
        ctx.beginPath();
        ctx.arc(x, y * H, U * (0.002 + rand(i + 2) * 0.003), 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "embers": {
      for (let i = 0; i < 36; i++) {
        const y = (((rand(i + 40) - t * 0.06 * (0.6 + rand(i))) % 1) + 1) % 1;
        const x = rand(i) * W + Math.sin(t * 1.3 + i) * U * 0.03;
        const fl = 0.4 + 0.6 * Math.abs(Math.sin(t * 6 + i));
        ctx.fillStyle = withAlpha(theme.accent, 0.7 * fl * y);
        ctx.beginPath();
        ctx.arc(x, y * H, U * (0.003 + rand(i + 4) * 0.004), 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "rain": {
      ctx.strokeStyle = withAlpha(theme.ink, 0.25);
      ctx.lineWidth = Math.max(1, U * 0.0018);
      ctx.beginPath();
      for (let i = 0; i < 70; i++) {
        const y = ((rand(i + 40) + t * (1.4 + rand(i) * 0.8)) % 1) * H;
        const x = rand(i) * W - (y / H) * U * 0.1;
        ctx.moveTo(x, y);
        ctx.lineTo(x - U * 0.01, y + U * 0.04);
      }
      ctx.stroke();
      break;
    }
    case "snow": {
      for (let i = 0; i < 60; i++) {
        const y = ((rand(i + 40) + t * (0.05 + rand(i) * 0.06)) % 1) * H;
        const x = rand(i) * W + Math.sin(t + i) * U * 0.03;
        ctx.fillStyle = withAlpha("#ffffff", 0.5 + rand(i + 2) * 0.4);
        ctx.beginPath();
        ctx.arc(x, y, U * (0.003 + rand(i + 5) * 0.004), 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "sparkle": {
      for (let i = 0; i < 22; i++) {
        const x = rand(i) * W;
        const y = rand(i + 90) * H;
        const a = Math.max(0, Math.sin(t * (1 + rand(i) * 1.5) + i * 2));
        if (a < 0.05) continue;
        const r = U * 0.012 * a;
        ctx.fillStyle = withAlpha(theme.accent2, 0.75 * a);
        ctx.beginPath();
        ctx.moveTo(x, y - r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.quadraticCurveTo(x, y, x, y + r);
        ctx.quadraticCurveTo(x, y, x - r, y);
        ctx.quadraticCurveTo(x, y, x, y - r);
        ctx.fill();
      }
      break;
    }
    case "bubbles": {
      ctx.lineWidth = Math.max(1, U * 0.002);
      for (let i = 0; i < 18; i++) {
        const y = (((rand(i + 40) - t * (0.03 + rand(i) * 0.03)) % 1) + 1) % 1;
        const x = rand(i) * W + Math.sin(t * 0.8 + i) * U * 0.02;
        ctx.strokeStyle = withAlpha(theme.accent, 0.25);
        ctx.beginPath();
        ctx.arc(x, y * H, U * (0.01 + rand(i + 3) * 0.025), 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    }
    case "fog": {
      for (let i = 0; i < 5; i++) {
        const x = ((rand(i) + t * 0.015 * (1 + i * 0.3)) % 1.4 - 0.2) * W;
        const y = H * (0.55 + rand(i + 7) * 0.4);
        const r = U * (0.45 + rand(i + 3) * 0.3);
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, withAlpha(theme.ink, 0.07));
        g.addColorStop(1, withAlpha(theme.ink, 0));
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      break;
    }
    default:
      break;
  }
  ctx.restore();
}
