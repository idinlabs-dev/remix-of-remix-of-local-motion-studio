// Server function tipis: satu-satunya jalur ke Gemini. Kunci API tidak pernah
// masuk bundle browser — dibaca di dalam handler (server-only).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  scenePlanSchema,
  TRANSCRIBE_PROMPT,
  scenePlanPrompt,
  transcriptSchema,
  type PlanResponse,
  type TranscribeResponse,
} from "./schema";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

function model(): string {
  return process.env["GEMINI_MODEL"] || "gemini-flash-latest";
}

async function callGemini(key: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${GEMINI_BASE}/${model()}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Gemini API ${res.status}: ${detail.slice(0, 300)}`);
  }
  return res.json();
}

function extractText(result: unknown): string {
  const candidates = (result as { candidates?: { content?: { parts?: { text?: string }[] } }[] })?.candidates;
  const parts = candidates?.[0]?.content?.parts ?? [];
  return parts.map((p) => p.text ?? "").join("").trim();
}

export const aiStatus = createServerFn({ method: "GET" }).handler(async (): Promise<{ configured: boolean }> => {
  return { configured: Boolean(process.env["GEMINI_API_KEY"]) };
});

export const transcribeAudio = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ audioBase64: z.string().min(1), mime: z.string().min(1) }).parse(data))
  .handler(async ({ data }): Promise<TranscribeResponse> => {
    const key = process.env["GEMINI_API_KEY"];
    if (!key) {
      return { ok: false, reason: "no-key", message: "Kunci GEMINI_API_KEY belum diisi di Project Settings → Secrets." };
    }
    try {
      const result = await callGemini(key, {
        contents: [
          {
            parts: [
              { text: TRANSCRIBE_PROMPT },
              { inline_data: { mime_type: data.mime, data: data.audioBase64 } },
            ],
          },
        ],
        generationConfig: { temperature: 0, responseMimeType: "application/json" },
      });
      const raw = extractText(result);
      const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "");
      const parsed = transcriptSchema.safeParse(JSON.parse(cleaned));
      if (!parsed.success) {
        return { ok: false, reason: "parse-error", message: "Hasil transkrip tidak valid." };
      }
      return { ok: true, items: parsed.data.items, fullText: parsed.data.fullText };
    } catch (err) {
      console.error("transcribeAudio failed:", err);
      return { ok: false, reason: "api-error", message: err instanceof Error ? err.message : "Gagal memanggil Gemini." };
    }
  });

export const planScenes = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ sentences: z.array(z.string().min(1)).min(1) }).parse(data))
  .handler(async ({ data }): Promise<PlanResponse> => {
    const key = process.env["GEMINI_API_KEY"];
    if (!key) {
      return { ok: false, reason: "no-key", message: "Kunci GEMINI_API_KEY belum diisi di Project Settings → Secrets." };
    }
    const prompt = scenePlanPrompt(data.sentences);
    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.8, responseMimeType: "application/json" },
    };
    // Dua percobaan: kalau hasil pertama gagal validasi, minta sekali lagi.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await callGemini(key, body);
        const raw = extractText(result);
        const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "");
        const parsed = scenePlanSchema.safeParse(JSON.parse(cleaned));
        if (parsed.success) {
          const scenes = parsed.data.scenes.slice(0, data.sentences.length);
          return { ok: true, scenes };
        }
      } catch (err) {
        console.error("planScenes failed:", err);
        const message = err instanceof Error ? err.message : "Gagal memanggil Gemini.";
        return { ok: false, reason: "api-error", message };
      }
    }
    return { ok: false, reason: "parse-error", message: "Rencana adegan tidak valid — pakai susunan generik." };
  });
