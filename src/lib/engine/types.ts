// Tipe data timeline — gaya Remotion: komposisi berbasis frame, dirender
// deterministik dari waktu (detik) ke frame. Universal untuk topik apa pun:
// AI (Creative Director) memilih tema visual + pola layout per adegan.

export type Aspect = "9:16" | "16:9" | "1:1";

export const ASPECT_DIMENSIONS: Record<Aspect, { width: number; height: number }> = {
  "9:16": { width: 1080, height: 1920 },
  "16:9": { width: 1920, height: 1080 },
  "1:1": { width: 1080, height: 1080 },
};

/** Dua keterampilan web: video dari narasi (faceless) & auto-edit video rekaman. */
export type Mode = "explainer" | "edit";

/** Pola komunikasi visual universal — dipilih AI per kalimat. */
export const LAYOUTS = [
  "hook",
  "stat",
  "versus",
  "timeline",
  "anatomy",
  "quote",
  "list",
  "icon",
  "outro",
  "speaker",
] as const;
export type LayoutKind = (typeof LAYOUTS)[number];

export const LAYOUT_LABELS: Record<LayoutKind, string> = {
  hook: "Hook pembuka",
  stat: "Kartu angka besar",
  versus: "Versus / perbandingan",
  timeline: "Timeline / langkah",
  anatomy: "Diagram penunjuk",
  quote: "Kinetic quote",
  list: "Daftar poin",
  icon: "Objek utama",
  outro: "Penutup",
  speaker: "Pembicara penuh",
};

export const TRANSITIONS = ["wipe", "zoom", "slide", "fade", "glitch"] as const;
export type Transition = (typeof TRANSITIONS)[number];

export const FONT_KEYS = ["grotesk", "serif", "condensed", "hand", "mono", "horror", "rounded", "heavy"] as const;
export type FontKey = (typeof FONT_KEYS)[number];

export const BACKGROUNDS = ["paper-grid", "gradient", "dots", "noise-dark", "stars", "topo", "blueprint", "plain"] as const;
export type BackgroundStyle = (typeof BACKGROUNDS)[number];

export const PARTICLES = ["none", "dust", "embers", "rain", "snow", "sparkle", "bubbles", "fog"] as const;
export type ParticleKind = (typeof PARTICLES)[number];

export const STICKER_ANIMS = ["bob", "spin", "pulse", "pop", "drift"] as const;
export type StickerAnim = (typeof STICKER_ANIMS)[number];

export const SPEAKER_MODES = ["full", "pip", "hidden"] as const;
export type SpeakerMode = (typeof SPEAKER_MODES)[number];

export interface Theme {
  /** Label suasana, mis. "Misteri gelap", "Alam & petualangan". */
  mood: string;
  bg: string;
  surface: string;
  ink: string;
  muted: string;
  accent: string;
  accent2: string;
  font: FontKey;
  background: BackgroundStyle;
  particles: ParticleKind;
}

export interface SceneItem {
  label: string;
  icon?: string | undefined;
}

/** Objek dekoratif (stiker/ikon animasi) supaya visual tidak membosankan. */
export interface Sticker {
  icon: string;
  x: number;
  y: number;
  anim: StickerAnim;
}

export interface Scene {
  id: string;
  /** Waktu mulai/selesai dalam detik. */
  start: number;
  end: number;
  /** Kalimat narasi untuk adegan ini (juga subtitle). */
  text: string;
  layout: LayoutKind;
  transition: Transition;
  headline?: string | undefined;
  sub?: string | undefined;
  /** Untuk layout "stat": angka/nilai besar. */
  value?: string | undefined;
  icon?: string | undefined;
  items?: SceneItem[] | undefined;
  /** Kata yang disorot warna aksen di subtitle. */
  keywords?: string[] | undefined;
  stickers?: Sticker[] | undefined;
  /** Mode edit: tampilan footage pembicara di adegan ini. */
  speaker?: SpeakerMode | undefined;
}

export interface Composition {
  id: string;
  title: string;
  mode: Mode;
  aspect: Aspect;
  fps: number;
  width: number;
  height: number;
  /** Durasi total video (detik). */
  duration: number;
  scenes: Scene[];
  theme: Theme;
  subtitleOn: boolean;
  narration?: string | undefined;
  /** Sudah pernah dirancang AI (dipakai untuk hitung kuota). */
  aiDesigned?: boolean | undefined;
  createdAt: number;
  updatedAt: number;
}

export const OUTRO_HOLD_SECONDS = 0.8;

export const DEFAULT_THEME: Theme = {
  mood: "Kertas studio",
  bg: "#fcfbf6",
  surface: "#ffffff",
  ink: "#1e2a4a",
  muted: "#9aa7c9",
  accent: "#f2761b",
  accent2: "#0e7c7b",
  font: "grotesk",
  background: "paper-grid",
  particles: "none",
};

export function newComposition(title: string, aspect: Aspect = "9:16", mode: Mode = "explainer"): Composition {
  const dim = ASPECT_DIMENSIONS[aspect];
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title,
    mode,
    aspect,
    fps: 30,
    width: dim.width,
    height: dim.height,
    duration: 0,
    scenes: [],
    theme: { ...DEFAULT_THEME },
    subtitleOn: true,
    createdAt: now,
    updatedAt: now,
  };
}

function oneOf<T extends string>(list: readonly T[], v: unknown, fallback: T): T {
  return typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : fallback;
}

/** Lengkapi data lama/import supaya selalu valid untuk renderer. */
export function normalizeComposition(raw: unknown): Composition {
  const r = (raw ?? {}) as Record<string, unknown>;
  const aspect = oneOf<Aspect>(["9:16", "16:9", "1:1"], r["aspect"], "9:16");
  const dim = ASPECT_DIMENSIONS[aspect];
  const themeRaw = (r["theme"] ?? {}) as Partial<Theme>;
  const theme: Theme = {
    ...DEFAULT_THEME,
    ...themeRaw,
    font: oneOf(FONT_KEYS, themeRaw.font, DEFAULT_THEME.font),
    background: oneOf(BACKGROUNDS, themeRaw.background, DEFAULT_THEME.background),
    particles: oneOf(PARTICLES, themeRaw.particles, DEFAULT_THEME.particles),
  };
  const scenesRaw = Array.isArray(r["scenes"]) ? (r["scenes"] as Record<string, unknown>[]) : [];
  const scenes: Scene[] = scenesRaw.map((s, i) => {
    const scene: Scene = {
      id: typeof s["id"] === "string" ? (s["id"] as string) : `s-${i}`,
      start: Number(s["start"]) || 0,
      end: Number(s["end"]) || 0,
      text: typeof s["text"] === "string" ? (s["text"] as string) : "",
      layout: oneOf(LAYOUTS, s["layout"], i === 0 ? "hook" : "icon"),
      transition: oneOf(TRANSITIONS, s["transition"], "fade"),
      headline: typeof s["headline"] === "string" ? (s["headline"] as string) : (s["title"] as string | undefined),
      sub: s["sub"] as string | undefined,
      value: s["value"] as string | undefined,
      icon: s["icon"] as string | undefined,
      items: Array.isArray(s["items"]) ? (s["items"] as SceneItem[]) : undefined,
      keywords: Array.isArray(s["keywords"]) ? (s["keywords"] as string[]) : undefined,
      stickers: Array.isArray(s["stickers"]) ? (s["stickers"] as Sticker[]) : undefined,
      speaker: s["speaker"] === undefined ? undefined : oneOf(SPEAKER_MODES, s["speaker"], "full"),
    };
    return scene;
  });
  const now = Date.now();
  return {
    id: typeof r["id"] === "string" ? (r["id"] as string) : crypto.randomUUID(),
    title: typeof r["title"] === "string" ? (r["title"] as string) : "Project",
    mode: oneOf<Mode>(["explainer", "edit"], r["mode"], "explainer"),
    aspect,
    fps: Number(r["fps"]) || 30,
    width: dim.width,
    height: dim.height,
    duration: Number(r["duration"]) || 0,
    scenes,
    theme,
    subtitleOn: r["subtitleOn"] !== false,
    narration: typeof r["narration"] === "string" ? (r["narration"] as string) : undefined,
    aiDesigned: r["aiDesigned"] === true,
    createdAt: Number(r["createdAt"]) || now,
    updatedAt: Number(r["updatedAt"]) || now,
  };
}

/** Adegan yang aktif pada waktu t — dipakai renderer & sinkronisasi. */
export function pickScene(comp: Composition, time: number): Scene | null {
  for (const scene of comp.scenes) {
    if (time >= scene.start && time < scene.end) return scene;
  }
  const last = comp.scenes[comp.scenes.length - 1];
  if (last && time >= last.end && time < comp.duration) return last;
  return null;
}
