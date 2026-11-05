import {
  CAMERAS,
  COLOR_TOKENS,
  MOTIONS,
  PAPERCUT_COMPONENTS,
  PAPERCUT_DOCS,
  STAGE_GROUND,
  STAGE_PRESETS,
  normalizePaperCutManifest,
  type PaperCutManifest,
} from "@/lib/export/papercut/manifest";

export const PAPERCUT_PROJECT_TOOL = {
  name: "submit_papercut_manifest",
  description:
    "Kirim rancangan visual paper-cut per scene: daftar lapisan dari pustaka komponen yang tersedia. Jangan mengembalikan source code.",
  input_schema: {
    type: "object",
    required: ["version", "style", "title", "scenes"],
    properties: {
      version: { type: "integer", enum: [2] },
      style: { type: "string", enum: ["paper-cut"] },
      title: { type: "string", maxLength: 120 },
      header: {
        type: "object",
        description: "Hanya untuk mode edit: judul pendek di atas kartu footage.",
        properties: { title: { type: "string", maxLength: 40 } },
      },
      scenes: {
        type: "array",
        minItems: 1,
        maxItems: 120,
        items: {
          type: "object",
          required: ["id", "stage", "layers"],
          properties: {
            id: { type: "string" },
            visual: { type: "string", maxLength: 240, description: "Satu kalimat: ide visual utama scene." },
            stage: { type: "string", enum: [...STAGE_PRESETS] },
            camera: { type: "string", enum: [...CAMERAS] },
            emphasis: { type: "array", maxItems: 4, items: { type: "string", maxLength: 40 } },
            tag: { type: "string", maxLength: 32, description: "Penanda atribusi untuk klaim/opini, mis. 'Menurut narasumber'." },
            layers: {
              type: "array",
              minItems: 1,
              maxItems: 10,
              items: {
                type: "object",
                required: ["c"],
                properties: {
                  c: { type: "string", enum: [...PAPERCUT_COMPONENTS] },
                  x: { type: "number", minimum: 0, maximum: 1 },
                  y: { type: "number", minimum: 0, maximum: 1 },
                  s: { type: "number", minimum: 0.2, maximum: 3 },
                  color: { type: "string", enum: [...COLOR_TOKENS] },
                  text: { type: "string", maxLength: 40 },
                  n: { type: "integer", minimum: 0, maximum: 14 },
                  flip: { type: "boolean" },
                  motion: { type: "string", enum: [...MOTIONS] },
                  enter: { type: "string", maxLength: 30, description: "Satu kata dari kalimat scene; objek muncul saat kata ini diucapkan." },
                  exit: { type: "string", maxLength: 30 },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

export function paperCutPrompt(input: {
  title: string;
  mode: string;
  aspect: string;
  scenes: { id: string; text: string; start: number; end: number }[];
}): string {
  const docs = PAPERCUT_COMPONENTS.map((c) => `- ${c}: ${PAPERCUT_DOCS[c]}`).join("\n");
  const ground = STAGE_PRESETS.map((s) => `${s}=${STAGE_GROUND[s]}`).join(", ");
  const edit = input.mode === "edit";
  return `Kamu art director video bergaya PAPER-CUT (lapisan kertas bertumpuk, bayangan lembut, palet cerah). Rancang visual tiap scene dengan menyusun LAPISAN dari pustaka komponen di bawah, lalu kembalikan lewat tool submit_papercut_manifest. Jangan menulis kode.
Judul: ${input.title}; mode: ${input.mode}; rasio: ${input.aspect}. Jumlah scenes harus tepat ${input.scenes.length}; pertahankan id dan urutan.

CARA KERJA
- Layar (stage) berukuran relatif: x dan y adalah pecahan 0-1 dari lebar/tinggi stage. s = skala (1 = ukuran nominal; utama 1.3-2.2, pendukung 0.8-1.3).
- Komponen bertanda "(tapak)" ditempatkan dengan y = garis tanah preset stage: ${ground}. Komponen lain (melayang) pakai y 0.2-0.6.
- Urutan layers = urutan tumpukan dari belakang ke depan: dekor besar dulu (sun, cloud, mountain, city, waves), lalu subjek, lalu properti, terakhir label (chip/stat).
- "enter" = SATU kata persis dari kalimat scene (tanpa tanda baca) yang menentukan kapan lapisan itu muncul. Beri kata berbeda per lapisan supaya objek muncul bergantian sesuai pengucapan. Lapisan pertama boleh tanpa enter.
- stage memilih latar: sky, sea (laut/kapal), land, city, night (malam tetap terang, bukan gelap), plain. camera: none, push, pull, pan-left, pan-right, drift; variasikan antar scene berurutan.
- color hanya token: ${COLOR_TOKENS.join(", ")}. Gunakan maksimal 4 aksen per scene dan konsisten antar scene.
- motion: ${MOTIONS.join(", ")}. Pilih sesuai makna (bob untuk tokoh, float untuk benda melayang, sway untuk kapal/bendera).

ATURAN KOMPOSISI
1. Tiap scene = SATU ide visual utama yang berasal dari kalimatnya + 2-5 lapisan pendukung (maksimal 8). Jangan layar kosong, jangan terlalu ramai.
2. Tokoh utama: gunakan person dengan color dan n yang sama di semua scene agar konsisten; pose lewat text (stand|point|think|cheer|sad|walk).
3. Teks pada chip/stat/calendar/scroll/speech-bubble singkat dan memakai bahasa narasi. emphasis berisi maksimal 4 kata dari narasi.
4. Variasikan komposisi: jangan mengulang susunan yang sama pada scene berurutan.
5. Topik gelap (horor, malam, bencana, misteri) tetap divisualkan cerah dengan aksen dan ilustrasi, bukan dengan menggelapkan layar.
6. Jangan menggambar atau menyebut tokoh nyata, wajah, logo, atau merek. Gunakan ikon dan siluet generik. Jika kalimat berisi klaim, tuduhan, atau opini, isi tag (mis. "Menurut narasumber") dan jangan menyajikannya sebagai fakta lewat visual.
${edit ? "7. Mode edit: sebagian layar diisi footage pembicara, jadi stage lebih pendek. Pakai s <= 1.4 dan maksimal 5 lapisan. Isi header.title dengan judul singkat (<= 40 huruf).\n" : input.aspect === "9:16" ? "" : "7. Rasio lebar: stage lebih pendek. Pakai s <= 1.2 dan maksimal 5 lapisan.\n"}
PUSTAKA KOMPONEN
${docs}

CONTOH SCENE (kalimat: "Pagi-pagi ada email masuk, kamu kira spam pinjol")
{"id":"s3","visual":"Tokoh heran menatap ponsel yang menerima email","stage":"sky","camera":"push","emphasis":["email","pinjol"],"layers":[{"c":"cloud","x":0.25,"y":0.2,"s":1,"motion":"float"},{"c":"person","x":0.4,"y":0.82,"s":1.7,"text":"think","n":1,"color":"blue","motion":"bob","enter":"Pagi-pagi"},{"c":"phone","x":0.65,"y":0.55,"s":1.4,"color":"teal","motion":"float","enter":"email"},{"c":"chip","x":0.65,"y":0.22,"text":"spam pinjol?","color":"yellow","enter":"spam"}]}

SCENES
${input.scenes.map((s, i) => `${i + 1}. id=${s.id}, ${s.start.toFixed(2)}-${s.end.toFixed(2)}s: ${s.text}`).join("\n")}`;
}

/** Selalu menghasilkan manifest valid: layer/scene rusak dari AI diganti heuristik. */
export function parsePaperCutManifest(
  candidate: unknown,
  input: { title: string; mode: "explainer" | "edit"; scenes: { id: string; text: string }[] },
): { manifest: PaperCutManifest; repaired: number } {
  return normalizePaperCutManifest(candidate, input);
}
