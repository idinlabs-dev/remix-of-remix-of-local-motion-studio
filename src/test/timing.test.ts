import { describe, expect, it } from "vitest";

import { buildTimings, computeSilences, splitSentences, wordTimings } from "@/lib/engine/timing";
import { parseSrt } from "@/lib/engine/srt";

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

describe("parseSrt", () => {
  it("membaca cue bertimestamp, teks multi-baris, dan markup umum", () => {
    const cues = parseSrt(
      "\uFEFF1\r\n00:00:01,250 --> 00:00:02,500\r\n<i>Halo</i> &amp;\r\ndunia\r\n\r\n2\r\n00:00:02.750 --> 00:00:04.000 position:50%\r\nSubtitle kedua",
    );

    expect(cues).toEqual([
      { text: "Halo & dunia", start: 1.25, end: 2.5 },
      { text: "Subtitle kedua", start: 2.75, end: 4 },
    ]);
  });

  it("mengurutkan cue berdasarkan timestamp dan mengabaikan blok kosong/tidak valid", () => {
    const cues = parseSrt(
      "1\n00:00:03,000 --> 00:00:04,000\nKedua\n\n2\n00:00:01,000 --> 00:00:02,000\nPertama\n\n3\n00:00:05,000 --> 00:00:05,000\nInvalid",
    );

    expect(cues.map((cue) => cue.text)).toEqual(["Pertama", "Kedua"]);
  });

  it("membaca format timestamp file POV_Petir_Timestamp.srt", () => {
    const cues = parseSrt(
      "1\n00:00:00,000 --> 00:00:02,783\nPOV lo kesambar petir satu miliar volt.\n\n2\n00:00:02,783 --> 00:00:06,709\nDalam nol koma satu detik suhu tiga puluh ribu derajat.\n\n10\n00:00:24,410 --> 00:00:38,399\nPetir itu enggak nyari orang tinggi, dia nyari jalur tercepat ke tanah dan kadang itu lo.",
    );

    expect(cues).toHaveLength(3);
    expect(cues[0]).toEqual({
      text: "POV lo kesambar petir satu miliar volt.",
      start: 0,
      end: 2.783,
    });
    expect(cues[2]?.end).toBe(38.399);
  });

  it("menolak file tanpa cue valid", () => {
    expect(() => parseSrt("bukan file subtitle")).toThrow("Tidak ada subtitle SRT valid");
  });
});
