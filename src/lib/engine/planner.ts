// Perencana adegan sisi client: susunan generik dari kalimat ber-waktu
// (tanpa AI, berbasis heuristik universal), lalu (opsional) ditimpa rancangan
// AI Creative Director.

import { safeIcon, type IconName } from "./icon-names";
import { THEME_PRESETS } from "./themes";
import type { TimedSentence } from "./timing";
import {
  OUTRO_HOLD_SECONDS,
  TRANSITIONS,
  type Composition,
  type LayoutKind,
  type Scene,
  type SceneItem,
  type Theme,
} from "./types";
import type { DesignPlan } from "@/lib/ai/schema";

const NEUTRAL_ICONS: IconName[] = ["lightbulb", "sparkles", "target", "eye", "star", "zap", "compass", "brain", "rocket", "gem"];

/** Kamus kata kunci → ikon (Indonesia + Inggris), untuk mode tanpa AI. */
const KEYWORD_ICONS: [RegExp, IconName][] = [
  [/piston|silinder|cylinder|mesin|engine|mekanik|mechanical/i, "cog"],
  [/bahan bakar|bensin|fuel|gasoline/i, "fuel"],
  [/pembakaran|combustion|\bpanas\b|\bheat\b|thermal/i, "flame"],
  [/energi kinetik|kinetik|kinetic|listrik|electric|tegangan/i, "zap"],
  [/tekanan|pressure|manometer/i, "gauge"],
  [/gesekan|friction/i, "cog"],
  [/cairan|fluida|fluid|oli|\boil\b/i, "droplet"],
  [/gunung|mountain|puncak|summit|daki/i, "mountain"],
  [/hutan|pohon|forest|tree/i, "tree-pine"],
  [/hantu|ghost|arwah|setan/i, "ghost"],
  [/mati|death|tewas|kubur|skull/i, "skull"],
  [/uang|money|duit|rupiah|dollar|harga|price/i, "coins"],
  [/saham|invest|naik|growth|profit|untung/i, "trending-up"],
  [/rugi|turun|loss|crash/i, "trending-down"],
  [/otak|brain|pikir|mind|psikolog/i, "brain"],
  [/sains|science|lab|eksperimen|kimia/i, "flask-conical"],
  [/atom|fisika|physics|energi|energy/i, "atom"],
  [/luar angkasa|space|planet|bintang|galaxy|galaksi/i, "orbit"],
  [/waktu|time|jam|tahun|year|abad|century/i, "hourglass"],
  [/sejarah|history|kerajaan|kingdom|raja|king/i, "crown"],
  [/perang|war|tentara|army|battle/i, "swords"],
  [/kesehatan|health|sehat|jantung|heart/i, "heart-pulse"],
  [/makan|food|masak|cook/i, "utensils"],
  [/\bair\b|water|laut|ocean|sea|sungai/i, "waves"],
  [/\bapi\b|fire|hot|bakar/i, "flame"],
  [/dingin|cold|salju|snow|es\b/i, "snowflake"],
  [/hujan|rain|badai|storm/i, "cloud-rain"],
  [/teknologi|technology|komputer|computer|ai\b|robot/i, "cpu"],
  [/rahasia|secret|misteri|mystery|kunci|key/i, "key-round"],
  [/dunia|world|global|negara|country/i, "globe"],
  [/orang|people|manusia|human|masyarakat/i, "users"],
  [/buku|book|belajar|learn|ilmu/i, "book-open"],
  [/mobil|car|kendaraan/i, "car"],
  [/pesawat|plane|terbang|fly/i, "plane"],
  [/kapal|ship|perahu|boat/i, "ship"],
  [/musik|music|lagu|song/i, "music"],
  [/menang|win|juara|champion|sukses|success/i, "trophy"],
  [/bahaya|danger|awas|warning|risiko|risk/i, "triangle-alert"],
  [/hewan|animal|binatang/i, "paw-print"],
  [/kenapa|mengapa|why|bagaimana|how|apa\b|what/i, "circle-help"],
];

export function explicitIcon(text: string): IconName | undefined {
  for (const [re, icon] of KEYWORD_ICONS) if (re.test(text)) return icon;
  return undefined;
}

export function guessIcon(text: string, index: number): IconName {
  const match = explicitIcon(text);
  if (match) return match;
  return NEUTRAL_ICONS[index % NEUTRAL_ICONS.length] ?? "sparkles";
}

function shortPhrase(text: string, max = 6): string {
  return text.replace(/[.!?…]+$/, "").split(/\s+/).slice(0, max).join(" ");
}

const VERSUS_RE = /\s(?:vs\.?|versus|atau|bukan|dibanding(?:kan)?|sedangkan|melainkan|but|or|instead of)\s/i;
const STEP_RE = /\b(pertama|kedua|ketiga|langkah|tahap|first|second|step|then|lalu|kemudian|akhirnya)\b/i;
const NUMBER_RE = /(-?\d[\d.,]*\s?%?)(\s+[\p{L}]+)?/u;

/** Tebak pola layout universal dari isi kalimat — deterministik. */
export function heuristicScene(text: string, index: number, total: number): Omit<Scene, "id" | "start" | "end" | "text"> {
  const transition = TRANSITIONS[index % TRANSITIONS.length] ?? "fade";
  const icon = guessIcon(text, index);
  if (index === 0) {
    return { layout: "hook", transition: "zoom", headline: shortPhrase(text, 7), icon, keywords: [] };
  }
  if (index === total - 1 && total > 2) {
    return { layout: "outro", transition: "fade", headline: shortPhrase(text, 6), sub: "Follow untuk part berikutnya", icon: "heart" };
  }
  const num = NUMBER_RE.exec(text);
  if (num && num[1] && /\d/.test(num[1])) {
    return {
      layout: "stat",
      transition,
      value: num[1].trim(),
      sub: (num[2] ?? "").trim() || undefined,
      headline: shortPhrase(text.replace(num[0], "").trim() || text, 6),
      icon,
    };
  }
  const vs = VERSUS_RE.exec(text);
  if (vs && vs.index > 6) {
    const left = text.slice(0, vs.index);
    const right = text.slice(vs.index + vs[0].length);
    if (right.length > 3) {
      return {
        layout: "versus",
        transition,
        items: [
          { label: shortPhrase(left.split(/[,;]/).pop() ?? left, 4), icon },
          { label: shortPhrase(right, 4), icon: guessIcon(right, index + 1) },
        ],
      };
    }
  }
  const parts = text.split(/[,;:]/).map((p) => p.trim()).filter((p) => p.length > 2);
  if (parts.length >= 3 || STEP_RE.test(text)) {
    const items: SceneItem[] = parts.slice(0, 4).map((p, i) => ({ label: shortPhrase(p, 4), icon: guessIcon(p, index + i) }));
    if (items.length >= 2) return { layout: STEP_RE.test(text) ? "timeline" : "list", transition, items, headline: undefined };
  }
  const cycle: LayoutKind[] = ["icon", "quote", "anatomy", "icon"];
  const layout = cycle[index % cycle.length] ?? "icon";
  if (layout === "anatomy" && parts.length >= 2) {
    return { layout, transition, icon, headline: shortPhrase(parts[0] ?? text, 5), items: parts.slice(1, 5).map((p) => ({ label: shortPhrase(p, 3) })) };
  }
  if (layout === "quote") return { layout, transition, keywords: [] };
  return { layout: "icon", transition, icon, headline: shortPhrase(text, 6) };
}

function genericEditScene(text: string, index: number, total: number): Omit<Scene, "id" | "start" | "end" | "text"> {
  if (index % 3 === 2 && index !== total - 1) {
    return { ...heuristicScene(text, index, total), speaker: "pip" };
  }
  return {
    layout: "speaker",
    transition: index === 0 ? "zoom" : "fade",
    speaker: "full",
    headline: index === 0 ? shortPhrase(text, 5) : undefined,
    stickers: index % 2 === 1 ? [{ icon: guessIcon(text, index), x: 0.82, y: 0.2, anim: "bob" }] : undefined,
  };
}

/** Adegan generik untuk satu kalimat. */
export function genericScene(index: number, total: number, timing: TimedSentence, mode: Composition["mode"] = "explainer"): Scene {
  const base = mode === "edit" ? genericEditScene(timing.text, index, total) : heuristicScene(timing.text, index, total);
  return { id: crypto.randomUUID(), start: timing.start, end: timing.end, text: timing.text, ...base };
}

/** Isi comp.scenes dari daftar kalimat ber-waktu + jeda penutup. */
export function scenesFromTimings(comp: Composition, timings: TimedSentence[], mediaDuration?: number): Composition {
  const scenes = timings.map((t, i) => genericScene(i, timings.length, t, comp.mode));
  const last = timings[timings.length - 1];
  const duration =
    comp.mode === "edit" && mediaDuration ? mediaDuration : (last ? last.end : 0) + OUTRO_HOLD_SECONDS;
  return { ...comp, scenes, duration, aiDesigned: false, updatedAt: Date.now() };
}

/** Gabungkan tema AI (preset + override warna yang valid). */
export function mergeTheme(plan: DesignPlan["theme"]): Theme {
  const base = THEME_PRESETS[plan.preset] ?? THEME_PRESETS["paper"];
  const t: Theme = { ...(base as Theme) };
  t.mood = plan.mood || t.mood;
  const c = plan.colors ?? {};
  for (const k of ["bg", "surface", "ink", "muted", "accent", "accent2"] as const) {
    const v = c[k];
    if (v && /^#[0-9a-f]{6}$/i.test(v)) t[k] = v;
  }
  if (plan.font) t.font = plan.font;
  if (plan.background) t.background = plan.background;
  if (plan.particles) t.particles = plan.particles;
  return t;
}

/** Timpa adegan dengan rancangan AI — urut sesuai indeks adegan. */
export function applyDesign(comp: Composition, plan: DesignPlan): Composition {
  const scenes = comp.scenes.map((scene, i) => {
    const d = plan.scenes[i];
    if (!d) return scene;
    const next: Scene = {
      id: scene.id,
      start: scene.start,
      end: scene.end,
      text: scene.text,
      timedWords: scene.timedWords,
      layout: comp.mode === "explainer" && d.layout === "speaker" ? "icon" : d.layout,
      transition: d.transition,
      headline: d.headline,
      sub: d.sub,
      value: d.value,
      icon: explicitIcon(scene.text) ?? (d.icon ? safeIcon(d.icon) : undefined),
      items: d.items?.map((it, itemIndex) => ({
        label: it.label,
        icon:
          explicitIcon(it.label) ??
          (it.icon
            ? safeIcon(it.icon)
            : (explicitIcon(scene.text) ?? guessIcon(it.label, i + itemIndex))),
      })),
      keywords: d.keywords,
      stickers: d.stickers?.map((s) => ({ ...s, icon: explicitIcon(scene.text) ?? safeIcon(s.icon) })),
      speaker: comp.mode === "edit" ? d.speaker : undefined,
    };
    return next;
  });
  return { ...comp, theme: mergeTheme(plan.theme), scenes, aiDesigned: true, updatedAt: Date.now() };
}
