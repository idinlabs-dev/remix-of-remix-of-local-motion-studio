import { z } from "zod";

/** Komponen paper-cut yang tersedia (harus sama dengan REGISTRY di PaperCut.kit.tsx). */
export const PAPERCUT_COMPONENTS = [
  "sun", "moon", "cloud", "mountain", "island", "tree", "palm", "house", "building", "city",
  "landmark", "ship", "car", "rocket", "planet", "waves", "person", "crowd", "mic", "phone",
  "laptop", "document", "calendar", "clock", "coin", "chart-bars", "chart-line", "magnifier",
  "lightbulb", "gear", "padlock", "shield", "check-badge", "cross-badge", "question",
  "exclamation", "arrow", "heart", "star", "flag", "scroll", "quote-bubble", "speech-bubble",
  "megaphone", "chip", "stat", "title",
] as const;
export type PaperCutComponent = (typeof PAPERCUT_COMPONENTS)[number];

export const COLOR_TOKENS = ["blue", "teal", "yellow", "red", "ink", "white"] as const;
export const STAGE_PRESETS = ["sky", "sea", "land", "city", "night", "plain"] as const;
export const MOTIONS = ["none", "bob", "sway", "pulse", "float", "spin"] as const;
export const CAMERAS = ["none", "push", "pull", "pan-left", "pan-right", "drift"] as const;
export type StagePreset = (typeof STAGE_PRESETS)[number];

/** Posisi tapak (garis tanah) per preset, sebagai pecahan tinggi stage. */
export const STAGE_GROUND: Record<StagePreset, number> = {
  sky: 0.82, sea: 0.76, land: 0.8, city: 0.86, night: 0.84, plain: 0.9,
};

/** Dokumentasi singkat tiap komponen (dipakai di prompt AI). "(tapak)" = y layer adalah garis tanah. */
export const PAPERCUT_DOCS: Record<PaperCutComponent, string> = {
  sun: "matahari", moon: "bulan sabit", cloud: "awan putih", mountain: "gunung (tapak)",
  island: "pulau dengan palem (tapak)", tree: "pohon (tapak)", palm: "pohon kelapa (tapak)",
  house: "rumah (tapak)", building: "gedung tinggi (tapak)", city: "deretan gedung kota (tapak)",
  landmark: "gedung berpilar: istana/kantor pemerintah/pengadilan (tapak)", ship: "kapal layar (tapak)",
  car: "mobil (tapak)", rocket: "roket menyala", planet: "planet bercincin", waves: "pita ombak lebar (tapak)",
  person: "orang kartun (tapak). text=pose: stand|point|think|cheer|sad|walk; n=0-5 variasi rambut/kulit; color=baju",
  crowd: "kerumunan membawa spanduk kosong (tapak). n=jumlah 3-14",
  mic: "mikrofon podcast", phone: "ponsel", laptop: "laptop", document: "dokumen/surat",
  calendar: "kalender. text='OKT|20' (label atas|angka)", clock: "jam berputar", coin: "koin. text=label <=8 huruf",
  "chart-bars": "grafik batang tumbuh", "chart-line": "grafik garis naik", magnifier: "kaca pembesar bergerak",
  lightbulb: "lampu ide", gear: "roda gigi berputar", padlock: "gembok", shield: "perisai berbintang",
  "check-badge": "centang bulat", "cross-badge": "silang bulat", question: "tanda tanya", exclamation: "tanda seru",
  arrow: "panah tebal. n=0-7 arah (0 kanan, 2 bawah, 4 kiri, 6 atas)", heart: "hati", star: "bintang", flag: "bendera berkibar (tapak)",
  scroll: "gulungan. text<=14", "quote-bubble": "gelembung tanda kutip", "speech-bubble": "gelembung ucapan. text<=2 baris dipisah |",
  megaphone: "pengeras suara", chip: "label kecil. text<=22", stat: "kartu angka. text='50%|Naik' (angka|keterangan)",
  title: "kartu judul. text<=24",
};

const cleanText = (s: string) => s.replace(/[<>{}`\\]/g, "").replace(/[\u0000-\u001f]/g, "").trim();

export const layerSchema = z.object({
  c: z.enum(PAPERCUT_COMPONENTS),
  x: z.number().min(0).max(1).catch(0.5),
  y: z.number().min(0).max(1).catch(0.78),
  s: z.number().min(0.2).max(3).catch(1),
  color: z.enum(COLOR_TOKENS).optional().catch(undefined),
  text: z.string().max(40).transform(cleanText).optional().catch(undefined),
  n: z.number().int().min(0).max(14).optional().catch(undefined),
  flip: z.boolean().optional().catch(undefined),
  motion: z.enum(MOTIONS).catch("none"),
  enter: z.string().max(30).transform(cleanText).optional().catch(undefined),
  exit: z.string().max(30).transform(cleanText).optional().catch(undefined),
});
export type PaperCutLayer = z.infer<typeof layerSchema>;

export const paperCutSceneSchema = z.object({
  id: z.string().min(1).max(80),
  visual: z.string().max(240).catch(""),
  stage: z.enum(STAGE_PRESETS).catch("sky"),
  camera: z.enum(CAMERAS).catch("none"),
  layers: z.array(layerSchema).min(1).max(12),
  emphasis: z.array(z.string().max(40)).max(4).catch([]),
  tag: z.string().max(32).transform(cleanText).optional().catch(undefined),
});
export type PaperCutScene = z.infer<typeof paperCutSceneSchema>;

export const paperCutManifestSchema = z.object({
  version: z.literal(2),
  style: z.literal("paper-cut"),
  title: z.string().min(1).max(120),
  header: z.object({ title: z.string().max(60).transform(cleanText).optional() }).optional().catch(undefined),
  scenes: z.array(paperCutSceneSchema).min(1).max(120),
});
export type PaperCutManifest = z.infer<typeof paperCutManifestSchema>;

// ---------- heuristik tanpa AI (cadangan + perbaikan) ----------
interface Rule { re: RegExp; c: PaperCutComponent; color?: PaperCutLayer["color"]; stage?: StagePreset }
const RULES: Rule[] = [
  { re: /\b(laut|kapal|perahu|pelayaran|pinisi|samudra|ombak)\b/i, c: "ship", stage: "sea" },
  { re: /\b(roket|nasa|astronot|antariksa|angkasa|orbit)\b/i, c: "rocket", stage: "night" },
  { re: /\b(bumi|planet|galaksi|tata surya)\b/i, c: "planet", stage: "night" },
  { re: /\b(demo|unjuk rasa|massa|buruh|rakyat|warga|kerumunan|aksi)\b/i, c: "crowd", stage: "city" },
  { re: /\b(istana|pemerintah|presiden|negara|kementerian|pengadilan|dpr)\b/i, c: "landmark", stage: "city" },
  { re: /\b(kota|gedung|jakarta|perkotaan|kantor)\b/i, c: "city", stage: "city" },
  { re: /\b(uang|gaji|rupiah|harga|bayar|cicilan|tagihan|biaya|pinjol|utang|pajak|cuan)\b/i, c: "coin", color: "yellow" },
  { re: /\b(waktu|jam|menit|detik|lama|deadline)\b/i, c: "clock" },
  { re: /\b(data|grafik|persen|statistik|naik|turun|angka|peningkatan)\b/i, c: "chart-bars" },
  { re: /\b(ponsel|hp|tiktok|scroll|medsos|notifikasi|aplikasi|email)\b/i, c: "phone" },
  { re: /\b(laptop|komputer|kode|program|internet)\b/i, c: "laptop" },
  { re: /\b(ide|gagasan|solusi|inovasi|kreatif|pikir)\b/i, c: "lightbulb" },
  { re: /\b(cari|selidik|diselidiki|lacak|dilacak|riset|periksa|analisis|investigasi)\b/i, c: "magnifier" },
  { re: /\b(aman|polisi|polri|keamanan|lindungi|pertahanan|aparat)\b/i, c: "shield" },
  { re: /\b(kunci|rahasia|terkunci|tersandera|sandera|privasi)\b/i, c: "padlock" },
  { re: /\b(benar|tepat|berhasil|selesai|sukses|valid)\b/i, c: "check-badge" },
  { re: /\b(salah|gagal|bahaya|larangan|dilarang|hoaks|bohong)\b/i, c: "cross-badge" },
  { re: /\b(kenapa|mengapa|bagaimana|siapa|misteri|rahasia|skenario)\b/i, c: "question" },
  { re: /\b(awas|waspada|hati-hati|peringatan|darurat)\b/i, c: "exclamation" },
  { re: /\b(podcast|suara|wawancara|bicara|mikrofon)\b/i, c: "mic" },
  { re: /\b(kalender|tanggal|oktober|november|desember|januari|februari|maret|april|mei|juni|juli|agustus|september)\b/i, c: "calendar", color: "red" },
  { re: /\b(mobil|kendaraan|jalan|rem|macet|lalu lintas)\b/i, c: "car" },
  { re: /\b(gunung|hutan|alam)\b/i, c: "mountain", stage: "land" },
  { re: /\b(mesin|sistem|mekanisme|cara kerja|roda gigi)\b/i, c: "gear" },
  { re: /\b(buku|belajar|sejarah|dokumen|surat|laporan)\b/i, c: "document" },
  { re: /\b(rumah|kos|tempat tinggal|kasur|rebahan)\b/i, c: "house" },
  { re: /\b(cinta|sayang|hati|keluarga)\b/i, c: "heart" },
  { re: /\b(juara|terbaik|bintang|prestasi)\b/i, c: "star" },
  { re: /\b(bendera|merdeka|kemerdekaan)\b/i, c: "flag" },
  { re: /\b(umum|kata orang|katanya|kutipan|ucap|berkata)\b/i, c: "quote-bubble" },
];
const NIGHT = /\b(malam|gelap|tengah malam|subuh|bintang|bulan)\b/i;
const MONTHS: Record<string, string> = { januari: "JAN", februari: "FEB", maret: "MAR", april: "APR", mei: "MEI", juni: "JUN", juli: "JUL", agustus: "AGU", september: "SEP", oktober: "OKT", november: "NOV", desember: "DES" };

export function suggestPaperCutScene(
  scene: { id: string; text: string; keywords?: string[] | undefined },
  index: number,
): PaperCutScene {
  const text = scene.text;
  const hits: Rule[] = [];
  for (const r of RULES) if (r.re.test(text) && !hits.some((h) => h.c === r.c)) hits.push(r);
  const stage: StagePreset = hits.find((h) => h.stage)?.stage ?? (NIGHT.test(text) ? "night" : index % 2 ? "plain" : "sky");
  const ground = STAGE_GROUND[stage];
  const layers: PaperCutLayer[] = [];
  const base = (c: PaperCutComponent) => ["ship", "mountain", "city", "landmark", "crowd", "house", "car", "person", "flag", "building", "tree", "palm", "island", "waves"].includes(c);
  const main = hits[0];
  if (main) {
    let t: string | undefined;
    if (main.c === "calendar") {
      const m = /(\d{1,2})\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)/i.exec(text) ?? /(dua puluh|tiga puluh|sepuluh|lima belas)\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)/i.exec(text);
      const num = m ? ({ "dua puluh": "20", "tiga puluh": "30", sepuluh: "10", "lima belas": "15" } as Record<string, string>)[(m[1] ?? "").toLowerCase()] ?? m[1] : "1";
      t = `${MONTHS[(m?.[2] ?? "januari").toLowerCase()] ?? "JAN"}|${num ?? "1"}`;
    }
    const first = main.c === "calendar" ? { text: t } : {};
    layers.push({ c: main.c, x: 0.5, y: base(main.c) ? ground : 0.5, s: ({ ship: 0.62, city: 0.75, crowd: 0.75, landmark: 0.8, mountain: 0.8, waves: 1 } as Record<string, number>)[main.c] ?? (base(main.c) ? 1.1 : 1.2), color: main.color, motion: base(main.c) ? "sway" : "float", enter: undefined, ...first } as PaperCutLayer);
  } else {
    layers.push({ c: "person", x: 0.5, y: ground, s: 1.3, text: /\?/.test(text) ? "think" : /!/.test(text) ? "cheer" : "stand", n: index % 6, color: (["blue", "teal", "red", "yellow"] as const)[index % 4], motion: "bob" });
  }
  const second = hits[1];
  if (second) layers.push({ c: second.c, x: index % 2 ? 0.14 : 0.86, y: base(second.c) ? ground : 0.42, s: 0.7, color: second.color, motion: base(second.c) ? "sway" : "float" });
  else if (main) layers.push({ c: "person", x: index % 2 ? 0.16 : 0.84, y: ground, s: 0.9, text: "point", n: (index + 2) % 6, color: "teal", motion: "bob" });
  const kw = (scene.keywords?.[0] ?? "").replace(/[.,!?;:]+$/g, "").trim();
  if (kw) layers.push({ c: "chip", x: 0.5, y: 0.1, s: 1, text: kw.slice(0, 22), color: "yellow", motion: "none", enter: kw.split(/\s+/)[0] });
  if (stage === "night") layers.push({ c: "star", x: 0.14, y: 0.3, s: 0.6, motion: "spin" });
  return {
    id: scene.id,
    visual: hits.length ? `Ilustrasi ${hits.map((h) => h.c).slice(0, 2).join(" + ")}` : "Tokoh kartun berekspresi sesuai kalimat",
    stage,
    camera: (["push", "none", "pan-right", "pull", "drift"] as const)[index % 5] ?? "none",
    layers,
    emphasis: (scene.keywords ?? []).map((k) => k.replace(/[.,!?;:]+$/g, "")).slice(0, 4),
    tag: undefined,
  };
}

export function defaultPaperCutManifest(input: {
  title: string;
  mode?: "explainer" | "edit";
  scenes: { id: string; text: string; keywords?: string[] | undefined }[];
}): PaperCutManifest {
  return {
    version: 2,
    style: "paper-cut",
    title: input.title.slice(0, 120) || "Video",
    header: input.mode === "edit" ? { title: input.title.slice(0, 40) } : undefined,
    scenes: input.scenes.map((s, i) => suggestPaperCutScene(s, i)),
  };
}

/** Memperbaiki keluaran AI: layer/scene yang rusak diganti heuristik. Selalu mengembalikan manifest valid. */
export function normalizePaperCutManifest(
  candidate: unknown,
  input: { title: string; mode?: "explainer" | "edit"; scenes: { id: string; text: string; keywords?: string[] | undefined }[] },
): { manifest: PaperCutManifest; repaired: number } {
  const rec = (candidate && typeof candidate === "object" ? candidate : {}) as Record<string, unknown>;
  const rawScenes = Array.isArray(rec["scenes"]) ? (rec["scenes"] as unknown[]) : [];
  let repaired = 0;
  const scenes = input.scenes.map((sc, i) => {
    const raw = rawScenes.find((r) => r && typeof r === "object" && (r as Record<string, unknown>)["id"] === sc.id) as Record<string, unknown> | undefined;
    const layersRaw = Array.isArray(raw?.["layers"]) ? (raw!["layers"] as unknown[]) : [];
    const layers = layersRaw.map((l) => layerSchema.safeParse(l)).flatMap((r) => (r.success ? [r.data] : [])).slice(0, 12);
    if (!raw || layers.length === 0) { repaired++; return suggestPaperCutScene(sc, i); }
    if (layers.length < layersRaw.length) repaired++;
    const parsed = paperCutSceneSchema.safeParse({ ...raw, id: sc.id, layers });
    if (!parsed.success) { repaired++; return suggestPaperCutScene(sc, i); }
    return parsed.data;
  });
  const header = paperCutManifestSchema.shape.header.parse(rec["header"]);
  const manifest: PaperCutManifest = {
    version: 2,
    style: "paper-cut",
    title: (typeof rec["title"] === "string" && rec["title"].trim() ? rec["title"] : input.title).slice(0, 120) || "Video",
    header: input.mode === "edit" ? (header ?? { title: input.title.slice(0, 40) }) : undefined,
    scenes,
  };
  return { manifest: paperCutManifestSchema.parse(manifest), repaired };
}
