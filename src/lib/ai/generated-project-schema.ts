import {
  generatedProjectManifestSchema,
  type GeneratedProjectManifest,
  VISUAL_KINDS,
} from "@/lib/export/generated-project";
import { ICON_NAMES } from "@/lib/engine/icon-names";

export const GENERATED_PROJECT_TOOL = {
  name: "submit_remotion_visual_manifest",
  description:
    "Kirim arahan visual per scene untuk source Remotion khusus konten ini. Jangan mengembalikan source code; isi manifest ringkas dan konkret.",
  input_schema: {
    type: "object",
    properties: {
      version: { type: "number", enum: [1] },
      title: { type: "string" },
      scenes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            visual: {
              type: "string",
              description: "Deskripsi visual konkret yang unik untuk kalimat ini",
            },
            visualKind: {
              type: "string",
              enum: VISUAL_KINDS,
              description: "Pilih tepat satu komposisi visual yang paling sesuai isi scene",
            },
            motion: {
              type: "string",
              enum: ["spring", "slide", "zoom", "drift", "glitch", "fade"],
            },
            emphasis: { type: "array", items: { type: "string" } },
            accent: { type: "string", description: "Warna hex" },
          },
          required: ["id", "visual", "visualKind", "motion", "emphasis", "accent"],
        },
      },
    },
    required: ["version", "title", "scenes"],
  },
} as const;

export function generatedProjectPrompt(input: {
  title: string;
  mode: string;
  aspect: string;
  scenes: { id: string; text: string; start: number; end: number }[];
}): string {
  return `Kamu adalah art director Remotion. Rancang source visual yang benar-benar spesifik untuk konten video ini, bukan template generik. Kembalikan tool submit_remotion_visual_manifest.
Judul: ${input.title}; mode: ${input.mode}; rasio: ${input.aspect}.
Untuk setiap scene, visual harus menyebut objek/metafora/komposisi yang berasal dari kalimat scene, motion dipilih sesuai emosi, emphasis berisi maksimal 4 kata/frasa dari narasi, accent hex kontras. Jumlah scenes harus tepat ${input.scenes.length}; pertahankan id dan urutan.
WAJIB memilih visualKind yang paling sesuai isi scene; visualKind bukan label kosmetik dan akan mengubah objek, staging, serta animasi. Pilihan valid: ${VISUAL_KINDS.join(", ")}.
Panduan: ritual untuk simbol/ilmu gaib dan lingkaran mantra; phone-wallet untuk ponsel/dompet digital/transaksi; character-punchline untuk tokoh yang menyampaikan punchline; kite-reveal untuk benda terbang atau pengungkapan; trading-card untuk kartu/profil; loading-window untuk proses menunggu/progress; salary-slip untuk gaji/angka pembayaran; lightning untuk petir/listrik/kejutan energi; heat untuk panas/api; anatomy untuk tubuh/struktur biologis; current-path untuk arus/jalur; object-transform untuk perubahan benda; diagram untuk hubungan/penjelasan sistem; text-stage untuk kalimat abstrak yang paling tepat ditampilkan sebagai tipografi. Jangan memilih ritual atau lightning hanya karena gaya; pilih berdasarkan makna scene.
Ikon yang tersedia bila relevan: ${ICON_NAMES.join(", ")}.
${input.scenes.map((s, i) => `${i + 1}. id=${s.id}, ${s.start.toFixed(2)}-${s.end.toFixed(2)}s: ${s.text}`).join("\n")}`;
}

export function parseGeneratedManifest(
  candidate: unknown,
  expectedIds: string[],
): GeneratedProjectManifest | null {
  const result = generatedProjectManifestSchema.safeParse(candidate);
  if (!result.success || result.data.scenes.length !== expectedIds.length) return null;
  if (result.data.scenes.some((scene, i) => scene.id !== expectedIds[i])) return null;
  return result.data;
}
