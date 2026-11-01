// Perencana adegan sisi client: susun adegan generik dari kalimat ber-waktu,
// lalu (opsional) timpa dengan rencana AI. Deterministik per indeks.

import { OUTRO_HOLD_SECONDS, type Composition, type ElKind, type Entrance, type Scene, type SceneElement } from "@/lib/engine/types";
import { SHAPE_NAMES } from "@/lib/templates/kit";
import type { TimedSentence } from "@/lib/engine/timing";
import type { ScenePlan } from "@/lib/ai/schema";

const ENTRANCES: Entrance[] = ["bottom", "left", "right", "top"];

/** Kata kunci kasar: kata terpanjang dari kalimat (untuk label/badge generik). */
function keyTerm(sentence: string): string {
  const words = sentence.replace(/[^\w\sÀ-ÿ]/g, " ").split(/\s+/).filter(Boolean);
  let best = "";
  for (const w of words) if (w.length > best.length) best = w;
  return best.slice(0, 18);
}

function genericElements(index: number, text: string): SceneElement[] {
  const els: SceneElement[] = [];
  const firstWords = text.split(/\s+/).slice(0, 5).join(" ");
  if (index === 0) {
    els.push({ kind: "title", text: firstWords, y: 0.14, variant: index % 4, from: "top" });
  } else {
    els.push({
      kind: "illustration",
      shape: SHAPE_NAMES[index % SHAPE_NAMES.length] ?? "arrowFlow",
      y: 0.4,
      scale: 1,
      variant: index % 4,
      from: ENTRANCES[index % ENTRANCES.length] ?? "bottom",
    });
    els.push({ kind: "label", text: keyTerm(text), y: 0.62, variant: (index + 1) % 4, from: "left" });
  }
  if (index % 3 === 2) {
    els.push({ kind: "emphasize", y: 0.4, scale: 0.9, variant: (index + 2) % 4 });
  }
  return els;
}

/** Adegan generik untuk satu kalimat. */
export function genericScene(index: number, total: number, timing: TimedSentence): Scene {
  const isLast = index === total - 1;
  const elements: SceneElement[] = isLast
    ? [...genericElements(index, timing.text).slice(0, 1), { kind: "outro", text: "Terima kasih!", y: 0.45, scale: 1, variant: index % 4, from: "bottom" }]
    : genericElements(index, timing.text);
  return {
    id: crypto.randomUUID(),
    start: timing.start,
    end: timing.end,
    text: timing.text,
    elements,
  };
}

/** Isi comp.scenes dari daftar kalimat ber-waktu + jeda penutup. */
export function scenesFromTimings(comp: Composition, timings: TimedSentence[]): Composition {
  const scenes = timings.map((t, i) => genericScene(i, timings.length, t));
  const last = timings[timings.length - 1];
  const duration = (last ? last.end : 0) + OUTRO_HOLD_SECONDS;
  return { ...comp, scenes, duration, updatedAt: Date.now() };
}

/**
 * Timpa elemen generik dengan rencana AI — urut sesuai indeks adegan.
 * Adegan tanpa rencana AI tetap memakai elemen generiknya.
 */
export function applyPlan(comp: Composition, plan: ScenePlan): Composition {
  const scenes = comp.scenes.map((scene, i) => {
    const planned = plan.scenes[i];
    if (!planned) return scene;
    const elements: SceneElement[] = planned.elements.map((el) => {
      const out: SceneElement = { kind: el.kind as ElKind };
      if (el.shape !== undefined) out.shape = el.shape;
      if (el.text !== undefined) out.text = el.text;
      if (el.x !== undefined) out.x = el.x;
      if (el.y !== undefined) out.y = el.y;
      if (el.scale !== undefined) out.scale = el.scale;
      if (el.variant !== undefined) out.variant = el.variant;
      if (el.from !== undefined) out.from = el.from;
      return out;
    });
    const next: Scene = { ...scene, elements };
    if (planned.title !== undefined) next.title = planned.title;
    return next;
  });
  return { ...comp, scenes, updatedAt: Date.now() };
}
