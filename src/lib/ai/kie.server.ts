// Klien server-only untuk request desain Claude Haiku 5.5 melalui Kie.ai.
// Kunci berasal dari Kode Akses user dan tidak pernah dikembalikan ke browser.

const KIE_BASE = "https://api.kie.ai";
export const KIE_MODEL = "claude-haiku-5-5";

export class KieError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function friendly(status: number, msg: string): KieError {
  if (status === 401 || status === 403) return new KieError(401, "Kode akses tidak valid atau sudah dinonaktifkan.");
  if (status === 402) return new KieError(402, "Provider AI menolak request (402). Minta admin memeriksa API key dan akses Kie.ai.");
  if (status === 429) return new KieError(429, "Server AI sedang sibuk. Coba lagi sebentar lagi.");
  return new KieError(status || 500, msg ? `Layanan AI error: ${msg.slice(0, 160)}` : "Layanan AI sedang bermasalah.");
}

interface ToolResult {
  toolInput: unknown | null;
  text: string;
}

/**
 * Panggil Claude Haiku 5.5 (format Anthropic Messages) dengan streaming SSE,
 * kumpulkan teks & input tool di server, lalu kembalikan hasil akhir.
 */
export async function callClaudeTool(
  key: string,
  prompt: string,
  tool: { name: string; description: string; input_schema: unknown },
  maxTokens = 12000,
): Promise<ToolResult> {
  const res = await fetch(`${KIE_BASE}/claude/v1/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: KIE_MODEL,
      max_tokens: maxTokens,
      stream: true,
      thinkingFlag: false,
      tools: [tool],
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const ctype = res.headers.get("content-type") ?? "";
  if (!ctype.includes("text/event-stream")) {
    const raw = await res.text();
    let body: Record<string, unknown> | null = null;
    try {
      body = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      body = null;
    }
    const code = typeof body?.["code"] === "number" ? (body["code"] as number) : res.status;
    if (!res.ok || (code !== 200 && !body?.["content"])) {
      const msg = (body?.["msg"] as string) ?? ((body?.["error"] as { message?: string })?.message ?? raw);
      throw friendly(code === 200 ? res.status : code, String(msg ?? ""));
    }
    // Respons non-stream format Anthropic
    const content = (body?.["content"] ?? (body?.["data"] as Record<string, unknown>)?.["content"]) as
      | { type: string; text?: string; input?: unknown }[]
      | undefined;
    const toolBlock = content?.find((c) => c.type === "tool_use");
    return {
      toolInput: toolBlock?.input ?? null,
      text: (content ?? []).map((c) => c.text ?? "").join(""),
    };
  }

  if (!res.body) throw friendly(500, "respons kosong");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  const toolJson: Record<number, string> = {};
  const toolIdx: number[] = [];
  let stopReason = "";
  let errorMsg = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) >= 0) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const dataLine = frame
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trim())
        .join("");
      if (!dataLine || dataLine === "[DONE]") continue;
      let ev: Record<string, unknown>;
      try {
        ev = JSON.parse(dataLine) as Record<string, unknown>;
      } catch {
        continue;
      }
      const type = ev["type"];
      if (type === "content_block_start") {
        const block = ev["content_block"] as { type?: string } | undefined;
        if (block?.type === "tool_use") {
          const i = Number(ev["index"]);
          toolIdx.push(i);
          toolJson[i] = "";
        }
      } else if (type === "content_block_delta") {
        const d = ev["delta"] as { type?: string; text?: string; partial_json?: string } | undefined;
        const i = Number(ev["index"]);
        if (d?.type === "text_delta") text += d.text ?? "";
        else if (d?.type === "input_json_delta") toolJson[i] = (toolJson[i] ?? "") + (d.partial_json ?? "");
      } else if (type === "message_delta") {
        const d = ev["delta"] as { stop_reason?: string } | undefined;
        if (d?.stop_reason) stopReason = d.stop_reason;
      } else if (type === "error") {
        const e = ev["error"] as { message?: string } | undefined;
        errorMsg = e?.message ?? "error";
      }
    }
  }
  if (errorMsg) throw friendly(500, errorMsg);
  if (stopReason === "refusal") throw new KieError(422, "AI menolak memproses narasi ini.");
  let toolInput: unknown = null;
  const first = toolIdx[0];
  if (first !== undefined && toolJson[first]) {
    try {
      toolInput = JSON.parse(toolJson[first] ?? "");
    } catch {
      toolInput = null;
    }
  }
  return { toolInput, text };
}

/** Ambil objek JSON pertama dari teks bebas. */
export function extractJson(text: string): unknown {
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```/g, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}
