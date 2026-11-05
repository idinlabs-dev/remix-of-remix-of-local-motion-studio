# Gaya paper-cut (manifest v2)

Menambah gaya visual **paper-cut** (lapisan kertas bertumpuk, bayangan lembut, palet cerah) ke Auto Remotion Studio.
AI tidak menulis kode: ia menyusun **lapisan** dari pustaka komponen, lalu renderer deterministik yang sudah ada di source Remotion menggambarnya.

## Alur data

```
UI (project.$id.tsx)           -> generateRemotionProject({ style: "papercut" })   [default]
server fn (ai.functions.ts)    -> Claude Haiku 5.5 via Kie.ai, tool submit_papercut_manifest
papercut-schema.ts             -> parsePaperCutManifest(): layer/scene rusak diganti heuristik (selalu valid)
buildRemotionZip(...)          -> composeGeneratedProject() -> versi 2 -> composePaperCutProject()
ZIP Remotion                   -> src/PaperCut.tsx (kit + renderer), Video.tsx, Root.tsx, timing.json, generated/manifest.json
GitHub Actions                 -> npx remotion render src/index.ts Main out/video.mp4 --codec=h264
```

UI tidak perlu diubah: manifest dari server langsung diteruskan ke `buildRemotionZip`, dan composer memilih jalur berdasarkan `manifest.version`.
Jika AI gagal atau akses tidak ada, `buildRemotionZip` memakai `defaultPaperCutManifest()` (heuristik kata kunci), jadi ZIP tetap bergaya paper-cut.
Gaya lama tetap ada: panggil `generateRemotionProject({ style: "classic" })` untuk manifest v1 (14 `visualKind`).

## Skema scene (v2)

```json
{
  "id": "s3", "visual": "Tokoh heran menatap ponsel", "stage": "sky", "camera": "push",
  "emphasis": ["email"], "tag": "Menurut narasumber",
  "layers": [
    { "c": "person", "x": 0.4, "y": 0.82, "s": 1.7, "text": "think", "n": 1, "color": "blue", "motion": "bob", "enter": "Pagi-pagi" },
    { "c": "phone",  "x": 0.65, "y": 0.55, "s": 1.4, "color": "teal", "motion": "float", "enter": "email" }
  ]
}
```

- `c`: salah satu dari 47 komponen (`PAPERCUT_COMPONENTS`); galeri visual: `docs/papercut-gallery-*.png`.
- `x`,`y`: pecahan 0-1 dari stage. Komponen "tapak" memakai `y` = garis tanah (`STAGE_GROUND`).
- `s`: skala; renderer otomatis memperkecil objek yang melebihi stage dan menjaga objek tetap di dalam bingkai.
- `enter` / `exit`: kata dari kalimat scene; lapisan muncul/hilang saat kata itu diucapkan (waktu kata = estimasi `wordTimings`).
- `color`: hanya token `blue|teal|yellow|red|ink|white` (palet dikunci, tanpa hex).
- `stage`: `sky|sea|land|city|night|plain` (semua terang; `night` = biru langit lembut + bulan/bintang).
- `tag`: penanda atribusi untuk klaim/opini (tampil sebagai pill kuning).

Mode **edit** memakai layout kartu footage + stage di bawahnya (9:16); scene `speaker: "full"` memperbesar kartu menutupi stage. Rasio 16:9 / 1:1 memakai stage penuh + footage sebagai kartu kecil.

## Menambah komponen baru

1. Tulis komponen SVG di `src/lib/export/papercut/PaperCut.kit.tsx` dan daftarkan di `REGISTRY` (`fn`, `w`, `h`, `base`, `color`).
2. Tambahkan namanya ke `PAPERCUT_COMPONENTS` dan satu baris dokumentasi di `PAPERCUT_DOCS` (`manifest.ts`).
3. Jalankan `npm test`: `papercut.test.ts` memastikan registry, dokumentasi, enum tool AI, dan prompt tetap sinkron.

Aturan kit: murni (semua gerak fungsi dari `t`), tanpa `Math.random`, timer, atau jaringan. File ini disalin apa adanya ke source Remotion hasil generate dan lolos `validateGeneratedProject`.

## Yang belum teruji

- Test dijalankan dengan shim Vitest di sandbox tanpa `node_modules` repo; jalankan `npm test` asli di lingkunganmu.
- Type-check strict (opsi tsconfig repo) lolos untuk file TypeScript baru, tetapi `ai.functions.ts` dan `remotion-zip.ts` tidak bisa dicek di sandbox karena dependensinya tidak ada.
- Panggilan AI nyata (Kie.ai/Claude), build Vite dengan impor `?raw`, dan render Remotion asli untuk source v2 belum dijalankan. Pola yang dipakai (feDropShadow, `OffthreadVideo`, font Fredoka 700, Remotion 4.0.250) sudah terbukti pada render lain.
