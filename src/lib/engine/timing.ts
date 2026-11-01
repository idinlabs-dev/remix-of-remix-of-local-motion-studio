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
  if (midpoints.length >= boundariesNeeded && boundariesNeeded > 0) {
    // Pilih boundary yang paling merata di antara midpoint yang tersedia.
    for (let i = 1; i <= boundariesNeeded; i++) {
      const ideal = (i / (boundariesNeeded + 1)) * duration;
      let best = midpoints[0];
      let bestDist = Math.abs(midpoints[0] - ideal);
      for (const m of midpoints) {
        const d = Math.abs(m - ideal);
        if (d < bestDist) {
          best = m;
          bestDist = d;
        }
      }
      boundaries.push(best);
    }
    boundaries.sort((a, b) => a - b);
  } else {
    // Fallback: bagi berbobot panjang karakter.
    const weights = sentences.map((s) => Math.max(s.length, 4));
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let acc = 0;
    for (let i = 0; i < boundariesNeeded; i++) {
      acc += weights[i];
      boundaries.push((acc / totalWeight) * duration);
    }
  }

  const timings: TimedSentence[] = [];
  let cursor = 0;
  for (let i = 0; i < sentences.length; i++) {
    const end = i < boundaries.length ? boundaries[i] : duration;
    timings.push({ text: sentences[i], start: cursor, end: Math.max(end, cursor + 0.3) });
    cursor = timings[i].end;
  }
  // Jaga agar kalimat terakhir menutup sampai durasi.
  timings[timings.length - 1].end = Math.max(timings[timings.length - 1].end, duration);
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
    const span = (weights[i] / total) * duration;
    const t = { word: w, start: cursor, end: cursor + span };
    cursor += span;
    return t;
  });
}
