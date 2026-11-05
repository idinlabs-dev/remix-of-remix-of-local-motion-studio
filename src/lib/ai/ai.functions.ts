// Server function tipis — verifikasi akses dan rancangan visual via Kie.ai.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { PLANS, parseAccessCode } from "@/lib/access/plans";
import {
  DESIGN_TOOL,
  designPlanSchema,
  designPrompt,
  type AiFailReason,
  type DesignResponse,
  type VerifyResponse,
} from "./schema";
import {
  GENERATED_PROJECT_TOOL,
  generatedProjectPrompt,
  parseGeneratedManifest,
} from "./generated-project-schema";
import type { AnyGeneratedManifest } from "@/lib/export/generated-project";
import {
  PAPERCUT_PROJECT_TOOL,
  paperCutPrompt,
  parsePaperCutManifest,
} from "./papercut-schema";

const codeField = z.string().min(16).max(160);

export const verifyAccess = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ code: codeField }).parse(data))
  .handler(async ({ data }): Promise<VerifyResponse> => {
    const parsed = parseAccessCode(data.code);
    if (!parsed)
      return {
        ok: false,
        reason: "no-access",
        message: "Format kode tidak dikenali. Minta kode akses ke admin.",
      };
    const { checkKieKey, KieError } = await import("./kie.server");
    try {
      await checkKieKey(parsed.key);
      return { ok: true, plan: parsed.plan };
    } catch (err) {
      const status = err instanceof KieError ? err.status : 500;
      return {
        ok: false,
        reason: status === 402 ? "no-credit" : status === 401 ? "no-access" : "api-error",
        message:
          err instanceof Error ? err.message : "Gagal memvalidasi API key dan kredit Kie.ai.",
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
        scenes: z
          .array(
            z.object({ text: z.string().min(1).max(600), seconds: z.number().min(0).max(600) }),
          )
          .min(1)
          .max(120),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<DesignResponse> => {
    const parsed = parseAccessCode(data.code);
    if (!parsed) return { ok: false, reason: "no-access", message: "Kode akses tidak valid." };
    if (data.mode === "edit" && !PLANS[parsed.plan].modes.includes("edit")) {
      return {
        ok: false,
        reason: "limit",
        message: "Mode Edit Video hanya untuk paket Pro Creator.",
      };
    }
    const { callClaudeTool, extractJson, KieError } = await import("./kie.server");
    const prompt = designPrompt({ mode: data.mode, aspect: data.aspect, scenes: data.scenes });
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const out = await callClaudeTool(parsed.key, prompt, DESIGN_TOOL);
        const candidate = out.toolInput ?? extractJson(out.text);
        const result = designPlanSchema.safeParse(candidate);
        if (result.success) {
          return {
            ok: true,
            plan: { ...result.data, scenes: result.data.scenes.slice(0, data.scenes.length) },
          };
        }
        console.error("designScenes: hasil tidak valid", result.error.issues.slice(0, 3));
      } catch (err) {
        console.error("designScenes failed:", err);
        const status = err instanceof KieError ? err.status : 500;
        if (status === 401 || status === 402 || status === 422) {
          return {
            ok: false,
            reason: status === 402 ? "no-credit" : "no-access",
            message: (err as Error).message,
          };
        }
        if (attempt === 1 || status === 429) {
          return {
            ok: false,
            reason: "api-error",
            message: err instanceof Error ? err.message : "Gagal memanggil AI.",
          };
        }
      }
    }
    return {
      ok: false,
      reason: "parse-error",
      message: "Rancangan AI tidak valid — coba lagi atau pakai susunan otomatis.",
    };
  });

export const generateRemotionProject = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        code: codeField,
        title: z.string().min(1).max(120),
        mode: z.enum(["explainer", "edit"]),
        aspect: z.string().max(8),
        /** "papercut" (default): lapisan paper-cut dari pustaka komponen. "classic": 14 visualKind lama. */
        style: z.enum(["papercut", "classic"]).default("papercut"),
        scenes: z
          .array(
            z.object({
              id: z.string().min(1).max(80),
              text: z.string().min(1).max(600),
              start: z.number(),
              end: z.number(),
            }),
          )
          .min(1)
          .max(120),
      })
      .parse(data),
  )
  .handler(
    async ({
      data,
    }): Promise<
      | { ok: true; manifest: AnyGeneratedManifest; repaired?: number }
      | { ok: false; reason: AiFailReason; message: string }
    > => {
      const parsed = parseAccessCode(data.code);
      if (!parsed) return { ok: false, reason: "no-access", message: "Kode akses tidak valid." };
      if (data.mode === "edit" && !PLANS[parsed.plan].modes.includes("edit"))
        return {
          ok: false,
          reason: "limit",
          message: "Mode Edit Video hanya untuk paket Pro Creator.",
        };
      const { callClaudeTool, extractJson, KieError } = await import("./kie.server");
      try {
        if (data.style === "papercut") {
          const out = await callClaudeTool(
            parsed.key,
            paperCutPrompt(data),
            PAPERCUT_PROJECT_TOOL,
            16000,
          );
          const candidate = out.toolInput ?? extractJson(out.text);
          // Selalu valid: layer/scene yang rusak dari AI diganti heuristik (repaired = jumlah perbaikan).
          const { manifest, repaired } = parsePaperCutManifest(candidate, {
            title: data.title,
            mode: data.mode,
            scenes: data.scenes,
          });
          return { ok: true, manifest, repaired };
        }
        const out = await callClaudeTool(
          parsed.key,
          generatedProjectPrompt(data),
          GENERATED_PROJECT_TOOL,
          9000,
        );
        const candidate = out.toolInput ?? extractJson(out.text);
        const manifest = parseGeneratedManifest(
          candidate,
          data.scenes.map((s) => s.id),
        );
        if (!manifest)
          return {
            ok: false,
            reason: "parse-error",
            message: "Manifest source Remotion dari AI tidak valid.",
          };
        return { ok: true, manifest };
      } catch (err) {
        const status = err instanceof KieError ? err.status : 500;
        return {
          ok: false,
          reason: status === 402 ? "no-credit" : status === 401 ? "no-access" : "api-error",
          message: err instanceof Error ? err.message : "Gagal membuat source Remotion.",
        };
      }
    },
  );
