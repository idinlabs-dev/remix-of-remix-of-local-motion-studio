import { describe, expect, it } from "vitest";

import { buildTimings, computeSilences, splitSentences, wordTimings } from "@/lib/engine/timing";

describe("splitSentences", () => {
  it("memecah kalimat pada tanda baca", () => {
    expect(splitSentences("Pesawat terbang tinggi. Sayapnya melengkung! Lalu mendarat.")).toHaveLength(3);
  });

  it("menyatukan potongan yang terlalu pendek", () => {
    const out = splitSentences("Halo. Oke baik. Sekarang kita mulai perjalanan panjang menembus awan.");
    expect(out).toHaveLength(2);
  });

  it("kembali kosong untuk teks kosong", () => {
    expect(splitSentences("   ")).toEqual([]);
  });
});

describe("computeSilences", () => {
  it("menemukan jeda di antara dua nada", () => {
    const sr = 8000;
    const loud = new Float32Array(sr * 1).fill(0.5);
    const quiet = new Float32Array(sr * 1); // 1 detik hening
    const samples = new Float32Array([...loud, ...quiet, ...loud]);
    const gaps = computeSilences(samples, sr, { minGapSec: 0.25 });
    expect(gaps).toHaveLength(1);
    expect(gaps[0]?.start).toBeGreaterThanOrEqual(0.9);
    expect(gaps[0]?.end).toBeLessThanOrEqual(2.1);
  });

  it("tidak menemukan jeda saat audio padat", () => {
    const sr = 8000;
    const samples = new Float32Array(sr * 2).fill(0.5);
    expect(computeSilences(samples, sr)).toHaveLength(0);
  });
});

describe("buildTimings", () => {
  const sentences = ["Kalimat pertama cukup panjang.", "Kalimat kedua juga panjang.", "Penutup singkat."];

  it("menempatkan batas di tengah jeda audio", () => {
    const silences = [
      { start: 2.0, end: 2.4 },
      { start: 4.0, end: 4.4 },
    ];
    const timings = buildTimings(sentences, silences, 6);
    expect(timings).toHaveLength(3);
    expect(timings[0]?.start).toBe(0);
    expect(timings[0]?.end).toBeCloseTo(2.2, 5);
    expect(timings[1]?.end).toBeCloseTo(4.2, 5);
    expect(timings[2]?.end).toBe(6);
  });

  it("fallback berbobot panjang saat jeda kurang", () => {
    const timings = buildTimings(sentences, [], 9);
    expect(timings).toHaveLength(3);
    expect(timings[0]?.end).toBeGreaterThan(0);
    expect(timings[2]?.end).toBe(9);
    // urutan waktu tetap naik
    for (let i = 1; i < timings.length; i++) {
      expect(timings[i]?.start).toBeGreaterThanOrEqual(timings[i - 1]?.end ?? 0);
    }
  });

  it("kalimat terakhir selalu menutup sampai durasi", () => {
    const timings = buildTimings(["Satu kalimat panjang sekali, ya."], [], 5);
    expect(timings.at(-1)?.end).toBe(5);
  });
});

describe("wordTimings", () => {
  it("menutup rentang tanpa celah", () => {
    const words = wordTimings("sayap pesawat melengkung ke atas", 10, 4);
    expect(words[0]?.start).toBe(10);
    expect(words.at(-1)?.end).toBeCloseTo(14, 5);
    for (let i = 1; i < words.length; i++) {
      expect(words[i]?.start).toBeCloseTo(words[i - 1]?.end ?? 0, 5);
    }
  });
});
