// Mesin timing: pemecahan kalimat, deteksi jeda audio, dan penentuan batas
// adegan. Semua fungsi murni & deterministik agar bisa diuji.

export interface Silence {
  start: number;
  end: number;
}

export interface TimedSentence {
  text: string;
  start: number;
  end: number;
}

export interface AlignedWord {
  text: string;
  start: number;
  end: number;
}

export interface AlignedSentence extends TimedSentence {
  words: { word: string; start: number; end: number }[];
}

/** Pecah teks narasi jadi kalimat, menyatukan potongan terlalu pendek. */
export function splitSentences(text: string): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  const parts = cleaned
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const merged: string[] = [];
  for (const part of parts) {
    const prev = merged[merged.length - 1];
    if (prev && (part.length < 8 || prev.length < 8)) {
      merged[merged.length - 1] = `${prev} ${part}`;
    } else {
      merged.push(part);
    }
  }
  return merged;
}

/** Deteksi keheningan dari AudioBuffer — jadi kandidat batas adegan. */
export function computeSilences(
  samples: Float32Array,
  sampleRate: number,
  opts: { windowSec?: number; threshold?: number; minGapSec?: number } = {},
): Silence[] {
  const windowSec = opts.windowSec ?? 0.02;
  const threshold = opts.threshold ?? 0.04;
  const minGapSec = opts.minGapSec ?? 0.25;
  const window = Math.max(1, Math.round(windowSec * sampleRate));
  const windows = Math.floor(samples.length / window);
  const quiet: boolean[] = [];
  for (let i = 0; i < windows; i++) {
    let sum = 0;
    const offset = i * window;
    for (let j = 0; j < window; j++) {
      const v = samples[offset + j] ?? 0;
      sum += v * v;
    }
    quiet.push(Math.sqrt(sum / window) < threshold);
  }
  const gaps: Silence[] = [];
  let gapStart: number | null = null;
  for (let i = 0; i < quiet.length; i++) {
    if (quiet[i]) {
      if (gapStart === null) gapStart = i;
    } else if (gapStart !== null) {
      const start = gapStart * windowSec;
      const end = i * windowSec;
      if (end - start >= minGapSec) gaps.push({ start, end });
      gapStart = null;
    }
  }
  if (gapStart !== null) {
    const start = gapStart * windowSec;
    const end = windows * windowSec;
    if (end - start >= minGapSec) gaps.push({ start, end });
  }
  return gaps;
}

/**
 * Petakan kalimat ke waktu memakai jeda audio: batas antar kalimat jatuh di
 * tengah jeda. Kalau jumlah jeda kurang, sisa batas dibagi merata berbobot
 * panjang kalimat sampai durasi penuh.
 */
export function buildTimings(
  sentences: string[],
  silences: Silence[],
  duration: number,
): TimedSentence[] {
  if (sentences.length === 0) return [];
  const midpoints = silences
    .filter((s) => s.start > 0.15 && s.end < duration - 0.05)
    .map((s) => (s.start + s.end) / 2)
    .sort((a, b) => a - b);

  const boundariesNeeded = sentences.length - 1;
  const boundaries: number[] = [];
  if (boundariesNeeded > 0) {
    // Estimate each target from spoken word counts, then snap to a nearby
    // distinct pause. Use available pauses even when there are fewer pauses
    // than scene boundaries; never reuse a pause.
    const weights = sentences.map((s) => Math.max(1, s.trim().split(/\s+/).length));
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const snapRadius = Math.max(0.35, Math.min(1.2, (duration / (boundariesNeeded + 1)) * 0.45));
    let cumulative = 0;
    let candidateIndex = 0;
    for (let i = 0; i < boundariesNeeded; i++) {
      cumulative += weights[i] ?? 1;
      const target = (cumulative / totalWeight) * duration;
      while (
        candidateIndex < midpoints.length &&
        (midpoints[candidateIndex] ?? 0) < target - snapRadius
      )
        candidateIndex++;
      let snapped: number | undefined;
      if (
        candidateIndex < midpoints.length &&
        Math.abs((midpoints[candidateIndex] ?? 0) - target) <= snapRadius
      ) {
        snapped = midpoints[candidateIndex];
        candidateIndex++;
      }
      const lower = (boundaries.at(-1) ?? 0) + 0.3;
      const upper = duration - (boundariesNeeded - i) * 0.3;
      boundaries.push(Math.max(lower, Math.min(upper, snapped ?? target)));
    }
  }

  const timings: TimedSentence[] = [];
  let cursor = 0;
  for (let i = 0; i < sentences.length; i++) {
    const end = i < boundaries.length ? (boundaries[i] ?? duration) : duration;
    const t: TimedSentence = {
      text: sentences[i] ?? "",
      start: cursor,
      end: Math.max(end, cursor + 0.3),
    };
    timings.push(t);
    cursor = t.end;
  }
  // Jaga agar kalimat terakhir menutup sampai durasi.
  const last = timings[timings.length - 1];
  if (last) last.end = Math.max(last.end, duration);
  return timings;
}

/** Susun timeline dari transkrip ber-waktu (hasil AI). */
export function buildFromTranscript(
  items: { text: string; start: number; end: number }[],
  duration: number,
): TimedSentence[] {
  if (items.length === 0) return [];
  const sorted = [...items].sort((a, b) => a.start - b.start);
  const out: TimedSentence[] = sorted.map((it, i) => ({
    text: it.text,
    start: it.start,
    end: i === sorted.length - 1 ? Math.max(it.end, duration) : it.end,
  }));
  return out;
}

/**
 * Waktu mulai tiap kata di dalam kalimat — proporsional panjang karakter.
 * Dipakai subtitle sorot kata-per-kata; deterministik.
 */
export function wordTimings(
  text: string,
  start: number,
  duration: number,
): { word: string; start: number; end: number }[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const weights = words.map((w) => Math.max(w.length, 2));
  const total = weights.reduce((a, b) => a + b, 0);
  let cursor = start;
  return words.map((w, i) => {
    const span = ((weights[i] ?? 2) / total) * duration;
    const t = { word: w, start: cursor, end: cursor + span };
    cursor += span;
    return t;
  });
}

/**
 * Potong audio panjang jadi beberapa bagian (untuk transkrip per bagian) —
 * batas dipilih di tengah jeda terdekat dari target panjang.
 */
export function chunkRanges(
  silences: Silence[],
  duration: number,
  target = 12,
  maxLen = 20,
): { start: number; end: number }[] {
  if (duration <= 0) return [];
  const mids = silences
    .map((s) => (s.start + s.end) / 2)
    .filter((m) => m > 0.5 && m < duration - 0.5)
    .sort((a, b) => a - b);
  const out: { start: number; end: number }[] = [];
  let start = 0;
  while (duration - start > maxLen) {
    const ideal = start + target;
    const cands = mids.filter((m) => m > start + target * 0.5 && m <= start + maxLen);
    let cut = ideal;
    for (const m of cands)
      if (Math.abs(m - ideal) < Math.abs(cut - ideal) || cut === ideal) cut = m;
    out.push({ start, end: cut });
    start = cut;
  }
  out.push({ start, end: duration });
  return out;
}

/**
 * Gabungkan transkrip per bagian jadi kalimat ber-waktu: tiap bagian punya
 * waktu pasti, di dalamnya kalimat diselaraskan ke jeda audio.
 */
export function alignChunks(
  chunks: { start: number; end: number; text: string }[],
  silences: Silence[],
  duration: number,
): TimedSentence[] {
  const out: TimedSentence[] = [];
  for (const c of chunks) {
    const sentences = splitSentences(c.text);
    if (sentences.length === 0) {
      const prev = out[out.length - 1];
      if (prev) prev.end = c.end;
      continue;
    }
    const len = c.end - c.start;
    const local = silences
      .filter((s) => s.start >= c.start && s.end <= c.end)
      .map((s) => ({ start: s.start - c.start, end: s.end - c.start }));
    for (const t of buildTimings(sentences, local, len)) {
      out.push({ text: t.text, start: t.start + c.start, end: t.end + c.start });
    }
  }
  const first = out[0];
  if (first) first.start = 0;
  const last = out[out.length - 1];
  if (last) last.end = Math.max(last.end, duration);
  return out;
}

function normalizeToken(text: string): string {
  return text
    .toLocaleLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

/** Cocokkan waktu kata dari forced aligner ke skrip; menolak mismatch agar tidak diam-diam drift. */
export function alignScriptToWords(
  sentences: string[],
  aligned: AlignedWord[],
  duration: number,
): AlignedSentence[] | null {
  if (!sentences.length || !aligned.length || !Number.isFinite(duration) || duration <= 0)
    return null;
  const scriptWords = sentences.flatMap((sentence) => sentence.trim().split(/\s+/).filter(Boolean));
  if (scriptWords.length !== aligned.length) return null;
  for (let i = 0; i < scriptWords.length; i++) {
    const word = aligned[i];
    if (!word || normalizeToken(scriptWords[i] ?? "") !== normalizeToken(word.text)) return null;
    if (
      !Number.isFinite(word.start) ||
      !Number.isFinite(word.end) ||
      word.start < 0 ||
      word.end <= word.start ||
      word.start > duration
    )
      return null;
    if (i > 0 && word.start < (aligned[i - 1]?.start ?? 0)) return null;
  }

  const grouped: { word: string; start: number; end: number }[][] = [];
  let cursor = 0;
  for (const sentence of sentences) {
    const group: { word: string; start: number; end: number }[] = [];
    for (const word of sentence.trim().split(/\s+/).filter(Boolean)) {
      const span = aligned[cursor++];
      if (!span) return null;
      group.push({ word, start: Math.max(0, span.start), end: Math.min(duration, span.end) });
    }
    grouped.push(group);
  }

  const boundaries = grouped.slice(0, -1).map((group, i) => {
    const last = group.at(-1);
    const first = grouped[i + 1]?.[0];
    if (!last || !first) return last?.end ?? 0;
    return Math.max(last.end, Math.min(first.start, (last.end + first.start) / 2));
  });
  const out: AlignedSentence[] = [];
  let start = 0;
  for (let i = 0; i < sentences.length; i++) {
    const words = grouped[i] ?? [];
    const end = i < boundaries.length ? (boundaries[i] ?? duration) : duration;
    if (end <= start || words.some((word) => word.start < start - 0.1 || word.end > end + 0.1))
      return null;
    out.push({ text: sentences[i] ?? "", start, end, words });
    start = end;
  }
  return out;
}
