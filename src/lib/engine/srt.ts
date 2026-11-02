import type { TimedSentence } from "./timing";

const TIMESTAMP =
  /^\s*(\d{2,}):(\d{2}):(\d{2})[,.](\d{1,3})\s*-->\s*(\d{2,}):(\d{2}):(\d{2})[,.](\d{1,3})(?:\s+.*)?$/;

function parseTimestamp(hours: string, minutes: string, seconds: string, millis: string): number {
  if (Number(minutes) > 59 || Number(seconds) > 59) return Number.NaN;
  return (
    Number(hours) * 3600 +
    Number(minutes) * 60 +
    Number(seconds) +
    Number(millis.padEnd(3, "0")) / 1000
  );
}

function cleanSubtitleText(text: string): string {
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Parse subtitle cues from a SubRip (.srt) file into timeline sentences. */
export function parseSrt(source: string): TimedSentence[] {
  const blocks = source
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/);
  const cues: TimedSentence[] = [];

  for (const block of blocks) {
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const timingIndex = lines.findIndex((line) => TIMESTAMP.test(line));
    if (timingIndex < 0) continue;

    const match = TIMESTAMP.exec(lines[timingIndex] ?? "");
    if (!match) continue;
    const start = parseTimestamp(match[1]!, match[2]!, match[3]!, match[4]!);
    const end = parseTimestamp(match[5]!, match[6]!, match[7]!, match[8]!);
    const text = cleanSubtitleText(lines.slice(timingIndex + 1).join(" "));
    if (!text || !Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start)
      continue;

    cues.push({ text, start, end });
  }

  if (cues.length === 0) {
    throw new Error("Tidak ada subtitle SRT valid. Periksa format timestamp dan teks file.");
  }

  return cues.sort((a, b) => a.start - b.start || a.end - b.end);
}
