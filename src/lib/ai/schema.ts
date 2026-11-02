// Skema & prompt AI Creative Director — dipakai bersama server function & client.
// Murni data, tanpa API browser.

import { z } from "zod";

import { ICON_NAMES, safeIcon } from "@/lib/engine/icon-names";
import { PRESET_NAMES } from "@/lib/engine/themes";
import {
  BACKGROUNDS,
  FONT_KEYS,
  LAYOUTS,
  PARTICLES,
  SPEAKER_MODES,
  STICKER_ANIMS,
  TRANSITIONS,
  type Mode,
} from "@/lib/engine/types";

const shortText = (max: number) =>
  z
    .string()
    .transform((s) => s.trim().slice(0, max))
    .optional()
    .catch(undefined);

const iconField = z
  .string()
  .transform((s) => safeIcon(s))
  .optional()
  .catch(undefined);

const hex = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/)
  .optional()
  .catch(undefined);

export const designSceneSchema = z.object({
  layout: z.enum(LAYOUTS).catch("icon"),
  transition: z.enum(TRANSITIONS).catch("fade"),
  headline: shortText(70),
  sub: shortText(50),
  value: shortText(16),
  icon: iconField,
  items: z
    .array(z.object({ label: z.string().transform((s) => s.trim().slice(0, 40)), icon: iconField }))
    .max(5)
    .optional()
    .catch(undefined),
  keywords: z.array(z.string().max(30)).max(5).optional().catch(undefined),
  stickers: z
    .array(
      z.object({
        icon: z.string().transform((s) => safeIcon(s)),
        x: z.number().min(0).max(1).catch(0.8),
        y: z.number().min(0).max(1).catch(0.2),
        anim: z.enum(STICKER_ANIMS).catch("bob"),
      }),
    )
    .max(3)
    .optional()
    .catch(undefined),
  speaker: z.enum(SPEAKER_MODES).optional().catch(undefined),
});

export const designPlanSchema = z.object({
  theme: z.object({
    preset: z.string().catch("paper"),
    mood: z.string().max(40).catch("Kustom"),
    colors: z
      .object({ bg: hex, surface: hex, ink: hex, muted: hex, accent: hex, accent2: hex })
      .optional()
      .catch(undefined),
    font: z.enum(FONT_KEYS).optional().catch(undefined),
    background: z.enum(BACKGROUNDS).optional().catch(undefined),
    particles: z.enum(PARTICLES).optional().catch(undefined),
  }),
  scenes: z.array(designSceneSchema).min(1),
});

export type DesignPlan = z.infer<typeof designPlanSchema>;
export type DesignScene = z.infer<typeof designSceneSchema>;

export type AiFailReason = "no-access" | "no-credit" | "api-error" | "parse-error" | "limit";

export type DesignResponse =
  { ok: true; plan: DesignPlan } | { ok: false; reason: AiFailReason; message: string };

export type TranscribeResponse =
  { ok: true; texts: string[] } | { ok: false; reason: AiFailReason; message: string };

export type VerifyResponse =
  { ok: true; plan: "starter" | "pro" } | { ok: false; reason: AiFailReason; message: string };

/** JSON Schema untuk tool "submit_design" (format Anthropic input_schema). */
export const DESIGN_TOOL = {
  name: "submit_design",
  description: "Kirim rancangan visual lengkap (tema + adegan) untuk video.",
  input_schema: {
    type: "object",
    properties: {
      theme: {
        type: "object",
        properties: {
          preset: { type: "string", enum: PRESET_NAMES },
          mood: { type: "string" },
          colors: {
            type: "object",
            properties: {
              bg: { type: "string" },
              surface: { type: "string" },
              ink: { type: "string" },
              muted: { type: "string" },
              accent: { type: "string" },
              accent2: { type: "string" },
            },
          },
          font: { type: "string", enum: [...FONT_KEYS] },
          background: { type: "string", enum: [...BACKGROUNDS] },
          particles: { type: "string", enum: [...PARTICLES] },
        },
        required: ["preset", "mood", "font", "background", "particles"],
      },
      scenes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            layout: { type: "string", enum: [...LAYOUTS] },
            transition: { type: "string", enum: [...TRANSITIONS] },
            headline: { type: "string" },
            sub: { type: "string" },
            value: { type: "string" },
            icon: { type: "string" },
            items: {
              type: "array",
              items: {
                type: "object",
                properties: { label: { type: "string" }, icon: { type: "string" } },
                required: ["label"],
              },
            },
            keywords: { type: "array", items: { type: "string" } },
            stickers: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  icon: { type: "string" },
                  x: { type: "number" },
                  y: { type: "number" },
                  anim: { type: "string", enum: [...STICKER_ANIMS] },
                },
                required: ["icon", "x", "y", "anim"],
              },
            },
            speaker: { type: "string", enum: [...SPEAKER_MODES] },
          },
          required: ["layout", "transition"],
        },
      },
    },
    required: ["theme", "scenes"],
  },
} as const;

export function designPrompt(input: {
  mode: Mode;
  aspect: string;
  scenes: { text: string; seconds: number }[];
}): string {
  const editRules =
    input.mode === "edit"
      ? `
MODE EDIT VIDEO (ada footage orang bicara):
- Mayoritas adegan pakai layout "speaker" (footage penuh) dengan speaker "full" + 0-2 stiker kontekstual + headline pendek opsional sebagai label.
- Setiap 2-4 kalimat, sisipkan "cut-in" infografis (stat/versus/timeline/list/anatomy/icon/quote) dengan speaker "pip" agar pembicara tetap terlihat kecil.
- Jangan dua cut-in berturut-turut kecuali kalimatnya data padat.`
      : `
MODE EXPLAINER (faceless, tanpa footage): jangan pakai layout "speaker". Variasikan layout — jangan pakai layout yang sama lebih dari 2 kali berturut-turut.`;
  return `Kamu adalah Creative Director & Motion Designer kelas dunia untuk video pendek (Reels/TikTok/Shorts/YouTube).
Tugasmu: baca narasi berikut (topik APA SAJA — alam, horor, sains, finansial, sejarah, filosofi, olahraga, dll), tentukan mood & identitas visual yang PALING cocok untuk topiknya, lalu rancang komposisi visual tiap kalimat.

LANGKAH BERPIKIR:
1. Deteksi genre & emosi narasi → pilih "preset" tema terdekat (${PRESET_NAMES.join(", ")}), lalu boleh override "colors" (hex #rrggbb) agar khas topiknya. Pastikan kontras: ink terbaca di atas bg, teks di atas surface terbaca.
2. Pilih font: grotesk (modern), serif (elegan/sejarah/filosofi), condensed (tegas/dokumenter/alam), hand (santai/edukasi), mono (teknologi/sains), horror (HANYA horor/misteri seram), rounded (anak/ceria), heavy (viral/bisnis/punchy).
3. Pilih background (${BACKGROUNDS.join(", ")}) & particles (${PARTICLES.join(", ")}) sesuai atmosfer (mis. horor: noise-dark + fog; luar angkasa: stars + sparkle; gunung: topo + dust; salju: snow).
4. Untuk tiap kalimat tentukan FUNGSI pesannya lalu pilih layout:
   - hook: pembuka yang memancing (headline singkat + sub sebagai kicker + icon).
   - stat: ada angka/data → value (angka saja, mis. "8.848", "73%", "1,5 jt"), sub = satuan/penjelas pendek, headline = konteks.
   - versus: perbandingan/mitos vs fakta → items tepat 2 {label, icon}, headline opsional.
   - timeline: kronologi/langkah → items 3-5 {label pendek, icon}.
   - anatomy: menjelaskan bagian/struktur sesuatu → icon pusat + items 2-4 label penunjuk.
   - quote: kalimat dramatis/kutipan → headline = kalimat padat (boleh sama dengan narasi), keywords 1-3 kata penting.
   - list: beberapa poin → items 2-5 {label, icon}.
   - icon: satu konsep utama → icon besar + headline + sub opsional.
   - outro: penutup → headline + sub sebagai CTA (mis. "Follow untuk part 2").
5. Tambahkan stickers (0-2, kadang 3) berupa objek ikon animasi yang relevan dengan kalimat agar visual tidak membosankan. Posisi x,y 0..1; hindari tengah (0.3-0.7) agar tidak menutupi konten, hindari y > 0.75 (zona subtitle).
6. keywords: 1-3 kata dari kalimat itu yang paling penting untuk disorot di subtitle (tulis persis seperti di kalimat).
7. transition bervariasi: zoom untuk hook, wipe/slide untuk pergantian topik, glitch hanya untuk tema gelap/teknologi, fade untuk tenang.
${editRules}

ATURAN TEKS: semua teks (headline, sub, label) memakai BAHASA YANG SAMA dengan narasi, singkat & punchy (headline maks 7 kata, label maks 4 kata). Jangan mengarang fakta di luar narasi.
ATURAN IKON & RELEVANSI: field icon/items[].icon/stickers[].icon HANYA boleh dari daftar ini: ${ICON_NAMES.join(", ")}.
- Ikon utama wajib mewakili benda, proses, atau konsep konkret yang benar-benar disebut/diterangkan pada kalimat scene yang sama. Jangan memilih ikon hanya karena topik umumnya mirip.
- Setiap item harus punya label dan ikon yang saling cocok. Untuk kalimat tentang mekanisme fisik, pilih objek/proses mekanismenya (mis. piston/mesin → cog, bahan bakar → fuel, panas/pembakaran → flame, tekanan → gauge), bukan simbol salju/planet/atom yang tak disebut.
- Jangan mengulang ikon yang sama di scene berurutan kecuali objek yang sama memang tetap menjadi fokus. Jika tidak ada ikon spesifik yang cocok, pilih layout quote/list berbasis teks dan gunakan ikon netral secukupnya.
JUMLAH: scenes HARUS tepat ${input.scenes.length} item, urut sama dengan kalimat.

Rasio video: ${input.aspect}.
NARASI (${input.scenes.length} kalimat):
${input.scenes.map((s, i) => `${i + 1}. [${s.seconds.toFixed(1)} dtk] ${s.text}`).join("\n")}

Kirim hasilnya dengan memanggil tool "submit_design". Jika tidak bisa memakai tool, balas HANYA JSON {"theme":{...},"scenes":[...]}.`;
}
