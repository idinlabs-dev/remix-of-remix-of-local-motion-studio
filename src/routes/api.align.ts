import { createFileRoute } from "@tanstack/react-router";

import { parseAccessCode } from "@/lib/access/plans";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const requestWindows = new Map<string, { count: number; expiresAt: number }>();
function rateLimited(request: Request): boolean {
  if (requestWindows.size > 1_000) {
    const now = Date.now();
    for (const [key, value] of requestWindows) {
      if (value.expiresAt <= now) requestWindows.delete(key);
    }
    if (requestWindows.size > 1_000) {
      const oldest = requestWindows.keys().next().value;
      if (oldest) requestWindows.delete(oldest);
    }
  }
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = request.headers.get("cf-connecting-ip") ?? forwarded ?? "unknown";
  const now = Date.now();
  const current = requestWindows.get(address);
  if (!current || current.expiresAt <= now) {
    requestWindows.set(address, { count: 1, expiresAt: now + 60_000 });
    return false;
  }
  current.count++;
  return current.count > 5;
}

export const Route = createFileRoute("/api/align")({
  server: {
    handlers: {
      GET: async () => json({ available: Boolean(process.env["ELEVENLABS_API_KEY"]) }),
      POST: async ({ request }) => {
        const providerKey = process.env["ELEVENLABS_API_KEY"];
        if (!providerKey)
          return json(
            { ok: false, message: "Sinkron presisi belum dikonfigurasi oleh admin." },
            503,
          );
        const origin = request.headers.get("origin");
        const fetchSite = request.headers.get("sec-fetch-site");
        if (
          (origin && new URL(origin).origin !== new URL(request.url).origin) ||
          fetchSite === "cross-site"
        )
          return json(
            { ok: false, message: "Permintaan alignment harus berasal dari situs ini." },
            403,
          );
        if (rateLimited(request))
          return json(
            { ok: false, message: "Batas sinkronisasi tercapai. Tunggu sebentar lalu coba lagi." },
            429,
          );

        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return json({ ok: false, message: "Form audio tidak terbaca." }, 400);
        }
        const code = form.get("code");
        const text = form.get("text");
        const file = form.get("file");
        const parsed = typeof code === "string" ? parseAccessCode(code) : null;
        if (!parsed) return json({ ok: false, message: "Kode akses tidak valid." }, 403);
        if (typeof text !== "string" || !text.trim() || text.length > 24_000)
          return json({ ok: false, message: "Teks narasi kosong atau terlalu panjang." }, 400);
        if (!(file instanceof File) || file.size < 44 || file.size > 4_250_000)
          return json(
            { ok: false, message: "Audio harus WAV mono dan maksimal sekitar 120 detik." },
            413,
          );
        if (file.type !== "audio/wav" && file.type !== "audio/x-wav")
          return json({ ok: false, message: "Format audio untuk sinkron presisi harus WAV." }, 415);

        try {
          const { checkKieKey } = await import("@/lib/ai/kie.server");
          await checkKieKey(parsed.key);
        } catch {
          return json(
            { ok: false, message: "Kode akses atau kredit Kie.ai tidak dapat divalidasi." },
            403,
          );
        }

        const upstream = new FormData();
        upstream.append("file", file, file.name || "narration.wav");
        upstream.append("text", text.trim());
        let response: Response;
        try {
          response = await fetch("https://api.elevenlabs.io/v1/forced-alignment", {
            method: "POST",
            headers: { "xi-api-key": providerKey },
            body: upstream,
          });
        } catch {
          return json(
            { ok: false, message: "Provider sinkronisasi tidak dapat dihubungi. Coba lagi." },
            502,
          );
        }
        if (!response.ok) {
          if (response.status === 401 || response.status === 403)
            return json(
              {
                ok: false,
                message: "Kunci ElevenLabs admin tidak valid atau tidak memiliki akses alignment.",
              },
              502,
            );
          if (response.status === 422)
            return json(
              {
                ok: false,
                message:
                  "Audio dan teks sulit disejajarkan. Periksa naskah, bahasa, dan kualitas audio.",
              },
              422,
            );
          if (response.status === 429)
            return json(
              { ok: false, message: "Batas permintaan provider tercapai. Coba lagi nanti." },
              429,
            );
          return json(
            {
              ok: false,
              message: "Provider gagal menyelaraskan audio. Coba lagi atau gunakan penanda manual.",
            },
            502,
          );
        }

        try {
          const result = (await response.json()) as {
            words?: unknown;
            loss?: unknown;
          };
          if (!Array.isArray(result.words))
            return json(
              { ok: false, message: "Format hasil alignment provider tidak dikenal." },
              502,
            );
          const words = result.words.flatMap((item) => {
            if (!item || typeof item !== "object") return [];
            const raw = item as Record<string, unknown>;
            const word =
              typeof raw["text"] === "string"
                ? raw["text"]
                : typeof raw["word"] === "string"
                  ? raw["word"]
                  : "";
            const start =
              typeof raw["start"] === "number"
                ? raw["start"]
                : typeof raw["start_time"] === "number"
                  ? raw["start_time"]
                  : NaN;
            const end =
              typeof raw["end"] === "number"
                ? raw["end"]
                : typeof raw["end_time"] === "number"
                  ? raw["end_time"]
                  : NaN;
            return word && Number.isFinite(start) && Number.isFinite(end) && end > start
              ? [{ text: word, start, end }]
              : [];
          });
          if (!words.length)
            return json(
              {
                ok: false,
                message: "Provider tidak mengembalikan timing kata yang dapat dipakai.",
              },
              502,
            );
          return json({
            ok: true,
            words,
            loss: typeof result.loss === "number" ? result.loss : null,
          });
        } catch {
          return json({ ok: false, message: "Hasil alignment provider tidak dapat dibaca." }, 502);
        }
      },
    },
  },
});
