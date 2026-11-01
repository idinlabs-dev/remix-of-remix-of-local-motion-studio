// Skema & prompt AI — dipakai bersama oleh server function (Gemini) dan client.
// Semua murni data, tanpa API browser.

import { z } from "zod";
import { CATALOG, SHAPE_NAMES } from "@/lib/templates/kit";

export const EL_KIND_VALUES = [
  "title", "illustration", "flow", "label", "bubble", "emphasize", "outro", "badge", "list",
] as const;

export const ENTRANCE_VALUES = ["left", "right", "top", "bottom"] as const;

export const transcriptItemSchema = z.object({
  text: z.string().min(1),
  start: z.number().min(0),
  end: z.number().min(0),
});

export const transcriptSchema = z.object({
  items: z.array(transcriptItemSchema).min(1),
  fullText: z.string(),
});

export const planElementSchema = z.object({
  kind: z.enum(EL_KIND_VALUES),
  shape: z.enum(SHAPE_NAMES).optional(),
  text: z.string().optional(),
  x: z.number().min(0).max(1).optional(),
  y: z.number().min(0).max(1).optional(),
  scale: z.number().min(0.5).max(1.6).optional(),
  variant: z.number().int().min(0).max(3).optional(),
  from: z.enum(ENTRANCE_VALUES).optional(),
});

export const planSceneSchema = z.object({
  title: z.string().optional(),
  elements: z.array(planElementSchema).min(1),
});

export const scenePlanSchema = z.object({
  scenes: z.array(planSceneSchema).min(1),
});

export type TranscriptResult = z.infer<typeof transcriptSchema>;
export type ScenePlan = z.infer<typeof scenePlanSchema>;

export type TranscribeResponse =
  | { ok: true; items: { text: string; start: number; end: number }[]; fullText: string }
  | { ok: false; reason: "no-key" | "api-error" | "parse-error"; message?: string };

export type PlanResponse =
  | { ok: true; scenes: z.infer<typeof planSceneSchema>[] }
  | { ok: false; reason: "no-key" | "api-error" | "parse-error"; message?: string };

/** Deskripsi katalog untuk prompt rencana adegan. */
export function catalogPrompt(): string {
  const lines = CATALOG.map((c) => `- kind "${c.kind}": ${c.description}`);
  return lines.join("\n");
}

export const TRANSCRIBE_PROMPT = `Kamu asisten transkrip video narasi berbahasa Indonesia.
Dengarkan audio dan keluarkan SEMUA kalimat yang terdengar, berurutan.
Balas HANYA JSON valid dengan bentuk:
{"items":[{"text":"kalimat lengkap","start":0.0,"end":3.2}],"fullText":"seluruh teks"}
- start/end dalam detik (angka, perkiraan wajar dari panjang kalimat).
- Jangan menambahkan, mengurangi, atau memparafrase kalimat.`;

export function scenePlanPrompt(sentences: string[]): string {
  return `Kamu sutradara video animasi papan tulis (gaya doodle kertas kotak-kotak) untuk video vertikal narasi.
Diberi daftar kalimat narasi (satu kalimat = satu adegan). Susun RENCANA ADEGAN.

Balas HANYA JSON valid dengan bentuk:
{"scenes":[{"title":"judul singkat opsional","elements":[{"kind":"title","text":"...","y":0.12,"variant":0,"from":"top"}]}]}

Aturan:
- Jumlah scenes HARUS sama dengan jumlah kalimat, urut sama.
- Tiap scene 1-4 elemen. Adegan pertama pakai kind "bubble" atau "title" sebagai hook.
- Untuk kind "illustration" pilih shape yang cocok dari daftar di bawah.
- kind "label"/"list"/"badge"/"bubble"/"outro"/"emphasize" wajib punya "text" singkat (bahasa Indonesia, maks 6 kata) yang diambil dari makna kalimatnya.
- Posisi: x & y 0..1 (y kecil = atas). Jangan menumpuk elemen di zona bawah (y > 0.78) karena itu zona subtitle.
- Skala 0.5..1.6. "from" salah satu: left/right/top/bottom. "variant" 0..3 untuk variasi warna.
- Kalimat terakhir boleh pakai kind "outro".

KATALOG ELEMEN:
${catalogPrompt()}

NARASI (${sentences.length} kalimat):
${sentences.map((s, i) => `${i + 1}. ${s}`).join("\n")}`;
}
