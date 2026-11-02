// Tema visual: preset suasana universal + pasangan font. AI memilih preset &
// boleh menimpa warna; user juga bisa ganti di editor.

import type { FontKey, Theme } from "./types";

export const FONT_DISPLAY: Record<FontKey, { family: string; weight: number; label: string }> = {
  grotesk: { family: '"Space Grotesk", sans-serif', weight: 700, label: "Modern grotesk" },
  serif: { family: '"Playfair Display", serif', weight: 700, label: "Serif elegan" },
  condensed: { family: '"Bebas Neue", sans-serif', weight: 400, label: "Condensed tegas" },
  hand: { family: '"Caveat", cursive', weight: 700, label: "Tulisan tangan" },
  mono: { family: '"JetBrains Mono", monospace', weight: 700, label: "Mono teknologi" },
  horror: { family: '"Creepster", cursive', weight: 400, label: "Horor" },
  rounded: { family: '"Fredoka", sans-serif', weight: 600, label: "Bulat ramah" },
  heavy: { family: '"Archivo Black", sans-serif', weight: 400, label: "Tebal punchy" },
};

/** Font isi (subtitle, label) — selalu mudah dibaca. */
export function bodyFont(key: FontKey): string {
  if (key === "mono") return '"JetBrains Mono", monospace';
  if (key === "rounded") return '"Fredoka", sans-serif';
  return '"Space Grotesk", sans-serif';
}

export function displayFont(key: FontKey, px: number): string {
  const f = FONT_DISPLAY[key];
  return `${f.weight} ${Math.round(px)}px ${f.family}`;
}

export function bodyFontCss(key: FontKey, px: number, weight = 600): string {
  return `${weight} ${Math.round(px)}px ${bodyFont(key)}`;
}

export const THEME_PRESETS: Record<string, Theme> = {
  paper: {
    mood: "Kertas studio",
    bg: "#fcfbf6", surface: "#ffffff", ink: "#1e2a4a", muted: "#9aa7c9", accent: "#f2761b", accent2: "#0e7c7b",
    font: "grotesk", background: "paper-grid", particles: "none",
  },
  nature: {
    mood: "Alam & petualangan",
    bg: "#14281d", surface: "#f3efe2", ink: "#f3efe2", muted: "#6f8f72", accent: "#e9a23b", accent2: "#8fc79a",
    font: "condensed", background: "topo", particles: "dust",
  },
  horror: {
    mood: "Misteri gelap",
    bg: "#0b0b0f", surface: "#1a1a22", ink: "#ece6dc", muted: "#5d5a66", accent: "#c1121f", accent2: "#d9c5a0",
    font: "horror", background: "noise-dark", particles: "fog",
  },
  science: {
    mood: "Sains futuristik",
    bg: "#07111f", surface: "#0f2238", ink: "#e6f4ff", muted: "#2f5578", accent: "#22d3ee", accent2: "#a3e635",
    font: "mono", background: "blueprint", particles: "sparkle",
  },
  space: {
    mood: "Luar angkasa",
    bg: "#05040f", surface: "#16133a", ink: "#f1edff", muted: "#4b4590", accent: "#8b5cf6", accent2: "#fbbf24",
    font: "grotesk", background: "stars", particles: "sparkle",
  },
  finance: {
    mood: "Bisnis & finansial",
    bg: "#0d1b14", surface: "#13291e", ink: "#effaf3", muted: "#3c6b52", accent: "#22c55e", accent2: "#facc15",
    font: "heavy", background: "gradient", particles: "none",
  },
  history: {
    mood: "Sejarah klasik",
    bg: "#f1e6cf", surface: "#fbf5e6", ink: "#3b2a1a", muted: "#b49b74", accent: "#9c2f1f", accent2: "#2f5d62",
    font: "serif", background: "dots", particles: "dust",
  },
  calm: {
    mood: "Tenang & reflektif",
    bg: "#eef2f0", surface: "#ffffff", ink: "#24343a", muted: "#a9bbb6", accent: "#5c7c89", accent2: "#c98b6b",
    font: "serif", background: "gradient", particles: "bubbles",
  },
  energetic: {
    mood: "Energik & viral",
    bg: "#fff4d6", surface: "#ffffff", ink: "#161616", muted: "#e0c27a", accent: "#ff3d6e", accent2: "#2563eb",
    font: "heavy", background: "dots", particles: "none",
  },
  winter: {
    mood: "Dingin & bersalju",
    bg: "#0f2433", surface: "#e9f4fb", ink: "#eaf6ff", muted: "#4f7b96", accent: "#7dd3fc", accent2: "#fde68a",
    font: "condensed", background: "gradient", particles: "snow",
  },
  kids: {
    mood: "Ceria & edukatif",
    bg: "#fef9ef", surface: "#ffffff", ink: "#2b2d42", muted: "#ffd6a5", accent: "#ff6b6b", accent2: "#4ecdc4",
    font: "rounded", background: "dots", particles: "bubbles",
  },
};

export const PRESET_NAMES = Object.keys(THEME_PRESETS);

/** Pastikan font tema termuat sebelum menggambar canvas (preview & render). */
export async function ensureThemeFonts(key: FontKey): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  const d = FONT_DISPLAY[key];
  await Promise.allSettled([
    document.fonts.load(`${d.weight} 48px ${d.family}`),
    document.fonts.load(`600 48px ${bodyFont(key)}`),
    document.fonts.load(`700 48px ${bodyFont(key)}`),
  ]);
}

/** Warna hex → rgba dengan alpha. */
export function withAlpha(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m || !m[1]) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/** Luminansi kasar 0..1 — untuk memilih warna teks kontras. */
export function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m || !m[1]) return 1;
  const n = parseInt(m[1], 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}
