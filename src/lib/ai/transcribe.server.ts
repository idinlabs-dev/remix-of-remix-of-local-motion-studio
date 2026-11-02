// Transkrip audio (server-only) lewat Lovable AI Gateway — speech-to-text.

const GATEWAY = "https://ai.gateway.lovable.dev";
const MODEL = "openai/gpt-transcribe";

export class TranscribeError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Transkrip satu potongan WAV; mengumpulkan stream SSE jadi teks utuh. */
export async function transcribeWav(apiKey: string, wav: Uint8Array): Promise<string> {
  const form = new FormData();
  form.append("model", MODEL);
  form.append("file", new File([wav as BlobPart], "chunk.wav", { type: "audio/wav" }));
  form.append("response_format", "json");
  form.append("stream", "true");
  const res = await fetch(`${GATEWAY}/v1/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "X-Lovable-AIG-SDK": "fetch" },
    body: form,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    let msg = detail;
    try {
      const j = JSON.parse(detail) as { error?: { message?: string }; message?: string };
      msg = j.error?.message ?? j.message ?? detail;
    } catch {
      // biarkan teks mentah
    }
    if (res.status === 402) throw new TranscribeError(402, "Layanan transkrip sedang tidak tersedia (kredit server habis). Tempel teks narasi manual dulu.");
    if (res.status === 429) throw new TranscribeError(429, "Layanan transkrip sedang sibuk, coba lagi sebentar.");
    throw new TranscribeError(res.status, `Transkrip gagal: ${msg.slice(0, 160)}`);
  }
  const ctype = res.headers.get("content-type") ?? "";
  if (!ctype.includes("event-stream")) {
    const j = (await res.json().catch(() => ({}))) as { text?: string };
    return (j.text ?? "").trim();
  }
  const reader = res.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let buffer = "";
  let deltas = "";
  let done = "";
  for (;;) {
    const { value, done: end } = await reader.read();
    if (end) break;
    buffer += decoder.decode(value, { stream: true });
    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) >= 0) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const data = frame
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trim())
        .join("");
      if (!data || data === "[DONE]") continue;
      try {
        const ev = JSON.parse(data) as { type?: string; delta?: string; text?: string; error?: { message?: string } };
        if (ev.type === "transcript.text.delta") deltas += ev.delta ?? "";
        else if (ev.type === "transcript.text.done") done = ev.text ?? "";
        else if (ev.error) throw new TranscribeError(500, ev.error.message ?? "Transkrip gagal");
      } catch (e) {
        if (e instanceof TranscribeError) throw e;
      }
    }
  }
  return (done || deltas).trim();
}
