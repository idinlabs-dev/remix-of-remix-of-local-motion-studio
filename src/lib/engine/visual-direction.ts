import { z } from "zod";

/**
 * Brief visual per scene. Ini sengaja berbeda dari layout generik: ia menjelaskan
 * subjek, objek nyata, metafora, beat, cue kata, dan gerak yang harus dikodekan.
 */
export const visualDirectionSchema = z.object({
  sceneType: z.string().min(2).max(48),
  subject: z.string().min(2).max(80),
  visualConcept: z.string().min(8).max(280),
  objects: z.array(z.string().min(1).max(48)).min(1).max(12),
  beats: z.array(z.string().min(3).max(160)).min(1).max(8),
  visualMetaphor: z.string().min(4).max(220),
  keywordCues: z.array(z.string().min(1).max(32)).min(1).max(10),
  composition: z.string().min(2).max(120),
  motion: z.string().min(2).max(180),
  expression: z.string().max(100).optional(),
  avoid: z.array(z.string().min(2).max(80)).max(8).default([]),
});

export type VisualDirection = z.infer<typeof visualDirectionSchema>;

export const visualDirectionDefaults: VisualDirection = {
  sceneType: "concept-reveal",
  subject: "narration subject",
  visualConcept: "Visual utama yang merepresentasikan kalimat secara konkret.",
  objects: ["subject"],
  beats: ["Tampilkan subjek utama dan perubahan visual yang mengikuti narasi."],
  visualMetaphor: "Makna narasi diwujudkan sebagai perubahan objek yang terlihat.",
  keywordCues: ["utama"],
  composition: "subject-centered",
  motion: "controlled reveal tied to narration cue",
  expression: "neutral",
  avoid: ["generic text card", "random floating icons"],
};

export function normalizeVisualDirection(raw: unknown): VisualDirection {
  const parsed = visualDirectionSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  return visualDirectionDefaults;
}

/** Ringkas direction ke data yang aman disimpan di timeline.json hasil ZIP. */
export function serializeVisualDirection(direction: VisualDirection): string {
  return JSON.stringify(direction, null, 2);
}
