// Server function tipis — satu-satunya jalur ke layanan AI.
// - Rancang desain: Claude Haiku 5.5 via Kie.ai memakai Kode Akses user.
// - Transkrip: Lovable AI Gateway, hanya untuk Kode Akses yang valid.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { PLANS, parseAccessCode } from "@/lib/access/plans";
import { DESIGN_TOOL, designPlanSchema, designPrompt, type DesignResponse, type TranscribeResponse, type VerifyResponse } from "./schema";

const codeField = z.string().min(16).max(160);

export const verifyAccess = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ code: codeField }).parse(data))
  .handler(async ({ data }): Promise<VerifyResponse> => {
    const parsed = parseAccessCode(data.code);
    if (!parsed) return { ok: false, reason: "no-access", message: "Format kode akses tidak dikenali." };
    const { checkKieKey, KieError } = await import("./kie.server");
    try {
      await checkKieKey(parsed.key);
      return { ok: true, plan: parsed.plan };
    } catch (err) {
      const status = err instanceof KieError ? err.status : 500;
      return {
        ok: false,
        reason: status === 402 ? "no-credit" : status === 401 ? "no-access" : "api-error",
        message: err instanceof Error ? err.message : "Gagal memeriksa kode.",
      };
    }
  });

export const designScenes = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        code: codeField,
        mode: z.enum(["explainer", "edit"]),
        aspect: z.string().max(8),
        scenes: z.array(z.object({ text: z.string().min(1).max(600), seconds: z.number().min(0).max(600) })).min(1).max(120),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<DesignResponse> => {
    const parsed = parseAccessCode(data.code);
    if (!parsed) return { ok: false, reason: "no-access", message: "Kode akses tidak valid." };
    if (data.mode === "edit" && !PLANS[parsed.plan].modes.includes("edit")) {
      return { ok: false, reason: "limit", message: "Mode Edit Video hanya untuk paket Pro Creator." };
    }
    const { callClaudeTool, extractJson, KieError } = await import("./kie.server");
    const prompt = designPrompt({ mode: data.mode, aspect: data.aspect, scenes: data.scenes });
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const out = await callClaudeTool(parsed.key, prompt, DESIGN_TOOL);
        const candidate = out.toolInput ?? extractJson(out.text);
        const result = designPlanSchema.safeParse(candidate);
        if (result.success) {
          return { ok: true, plan: { ...result.data, scenes: result.data.scenes.slice(0, data.scenes.length) } };
        }
        console.error("designScenes: hasil tidak valid", result.error.issues.slice(0, 3));
      } catch (err) {
        console.error("designScenes failed:", err);
        const status = err instanceof KieError ? err.status : 500;
        if (status === 401 || status === 402 || status === 422) {
          return { ok: false, reason: status === 402 ? "no-credit" : "no-access", message: (err as Error).message };
        }
        if (attempt === 1 || status === 429) {
          return { ok: false, reason: "api-error", message: err instanceof Error ? err.message : "Gagal memanggil AI." };
        }
      }
    }
    return { ok: false, reason: "parse-error", message: "Rancangan AI tidak valid — coba lagi atau pakai susunan otomatis." };
  });

/** ~32 KB per detik (WAV 16 kHz mono 16-bit). */
const WAV_BYTES_PER_SEC = 32_000;

export const transcribeChunks = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        code: codeField,
        chunks: z.array(z.string().min(100)).min(1).max(40),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<TranscribeResponse> => {
    const parsed = parseAccessCode(data.code);
    if (!parsed) return { ok: false, reason: "no-access", message: "Kode akses tidak valid." };
    const bytes = data.chunks.map((b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
    const total = bytes.reduce((a, b) => a + b.length, 0);
    const maxSec = PLANS[parsed.plan].maxSeconds + 5;
    if (total > maxSec * WAV_BYTES_PER_SEC + 4096) {
      return { ok: false, reason: "limit", message: `Audio melebihi batas paket (${PLANS[parsed.plan].maxSeconds} detik).` };
    }
    const { checkKieKey, KieError } = await import("./kie.server");
    try {
      await checkKieKey(parsed.key);
    } catch (err) {
      const status = err instanceof KieError ? err.status : 500;
      return { ok: false, reason: status === 402 ? "no-credit" : "no-access", message: (err as Error).message };
    }
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { ok: false, reason: "api-error", message: "Layanan transkrip belum dikonfigurasi." };
    const { transcribeWav, TranscribeError } = await import("./transcribe.server");
    try {
      const texts: string[] = [];
      for (const wav of bytes) texts.push(await transcribeWav(apiKey, wav));
      return { ok: true, texts };
    } catch (err) {
      console.error("transcribeChunks failed:", err);
      return {
        ok: false,
        reason: "api-error",
        message: err instanceof TranscribeError ? err.message : "Transkrip gagal — coba lagi.",
      };
    }
  });
