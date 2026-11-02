import { describe, expect, it } from "vitest";

import {
  alignScriptToWords,
  buildTimings,
  computeSilences,
  splitSentences,
  wordTimings,
} from "@/lib/engine/timing";

describe("splitSentences", () => {
  it("memecah kalimat pada tanda baca", () => {
    expect(
      splitSentences("Pesawat terbang tinggi. Sayapnya melengkung! Lalu mendarat."),
    ).toHaveLength(3);
  });

  it("menyatukan potongan yang terlalu pendek", () => {
    const out = splitSentences(
      "Halo. Oke baik. Sekarang kita mulai perjalanan panjang menembus awan.",
    );
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
  const sentences = [
    "Kalimat pertama cukup panjang.",
    "Kalimat kedua juga panjang.",
    "Penutup singkat.",
  ];

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

  it("memilih pause berbeda dan tetap berurutan saat jedanya cukup", () => {
    const timings = buildTimings(
      sentences,
      [
        { start: 1.9, end: 2.1 },
        { start: 2.0, end: 2.2 },
        { start: 3.9, end: 4.1 },
      ],
      6,
    );
    expect(timings[0]?.end).toBeLessThan(timings[1]?.end ?? 0);
    expect(timings[1]?.end).toBeCloseTo(4, 4);
  });
});

describe("alignScriptToWords", () => {
  it("mempertahankan naskah dan menggunakan timestamp kata aktual", () => {
    const result = alignScriptToWords(
      ["Halo dunia.", "Ini tes."],
      [
        { text: "Halo", start: 0.2, end: 0.5 },
        { text: "dunia.", start: 0.55, end: 0.9 },
        { text: "Ini", start: 1.2, end: 1.4 },
        { text: "tes.", start: 1.45, end: 1.8 },
      ],
      2,
    );
    expect(result).not.toBeNull();
    expect(result?.[0]?.text).toBe("Halo dunia.");
    expect(result?.[0]?.words[0]?.start).toBe(0.2);
    expect(result?.[0]?.end).toBeGreaterThan(0.9);
    expect(result?.[1]?.start).toBe(result?.[0]?.end);
  });

  it("menolak alignment jika token tidak cocok agar scene tidak bergeser diam-diam", () => {
    expect(
      alignScriptToWords(["Halo dunia."], [{ text: "Halo", start: 0, end: 0.2 }], 1),
    ).toBeNull();
    expect(
      alignScriptToWords(
        ["Halo dunia."],
        [
          { text: "Halo", start: 0, end: 0.2 },
          { text: "planet", start: 0.3, end: 0.5 },
        ],
        1,
      ),
    ).toBeNull();
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
