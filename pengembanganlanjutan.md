# Ide Pengembangan Lanjutan Visual Auto Remotion Studio

Dokumen ini mencatat arah pengembangan visual berikutnya setelah fitur render GitHub Actions selesai. Fokusnya adalah membuat hasil video lebih berkarakter, variatif, dan terasa seperti motion design yang dibuat khusus untuk isi konten—bukan sekadar satu template dengan teks yang berganti.

## 1. Masalah yang Ingin Diselesaikan

Engine saat ini sudah memiliki tema, layout, ikon, font, background prosedural, dan animasi dasar. Namun output masih mudah terasa seragam karena sebagian besar scene hanya mengubah:

- posisi teks;
- warna tema;
- jenis layout;
- ikon Lucide;
- bentuk kartu dasar.

Video referensi yang dianalisis menunjukkan pendekatan yang lebih kaya. Satu video dapat berganti antara hook, kartu brand, perbandingan, UI desktop, karakter, diagram, checklist, progress indicator, subtitle, dan objek bergerak. Semua elemen tetap terasa satu gaya karena memiliki visual language yang konsisten.

Target pengembangan bukan menyalin video referensi, tetapi mengambil prinsip desainnya:

> Asset yang konsisten + komposisi yang bervariasi + beat animation yang rapat + pemilihan visual berdasarkan makna narasi.

## 2. Arah Besar: Visual Style System

Daripada menambah banyak template terpisah, aplikasi sebaiknya memiliki sistem `Visual Style Pack`. Satu style pack menentukan bukan hanya warna dan font, tetapi seluruh bahasa visual:

- palet warna;
- font display dan body;
- bentuk kartu;
- radius dan ketebalan border;
- jenis shadow;
- gaya ikon;
- asset karakter;
- asset objek;
- sticker dan dekorasi;
- jenis subtitle;
- pola background;
- aturan transisi;
- tempo animasi;
- kepadatan komposisi;
- prinsip penggunaan ruang kosong.

Planner AI kemudian memilih style pack dan menyusun scene berdasarkan isi narasi.

## 3. Style Pack Pertama: Creator Explainer

Style pack pertama yang disarankan adalah `Creator Explainer`, terinspirasi dari motion explainer modern untuk konten edukasi dan teknologi.

### Karakter visual

- Background off-white dengan dot-grid atau kertas tipis.
- Teks hitam atau navy dengan accent merah, biru, atau ungu.
- Kartu putih mengambang dengan shadow lembut.
- Ikon outline dengan stroke konsisten.
- Karakter pixel-art atau maskot sederhana sebagai elemen pendamping.
- Sticker cursor, folder, spark, arrow, check, warning, dan pointer.
- Komposisi mobile-first 9:16.
- Gerakan spring, pop, slide, dan stagger.
- Pergantian beat visual setiap sekitar 1,5–2,5 detik.
- Subtitle pendek dengan highlight kata penting.

### Contoh beat

1. Hook masuk dengan scale dan spring.
2. Logo atau badge kategori muncul satu per satu.
3. Kartu perbandingan masuk dari dua sisi.
4. Karakter kecil bergerak idle di sudut frame.
5. Folder atau panel UI berpindah dengan drag motion.
6. Checklist muncul berurutan.
7. Angka atau hasil akhir membesar.
8. Outro menutup dengan CTA yang ringkas.

## 4. Asset Library

Asset library perlu dibangun sebagai sumber visual lokal yang dapat dipakai engine tanpa mengunggah media user ke server.

### Paket minimum tahap pertama

- 3–5 karakter atau maskot dengan beberapa pose.
- 15–20 sticker dekoratif.
- 20–30 objek visual umum.
- 10 kartu UI.
- 6 diagram dasar.
- 5 pola background.
- 4 treatment subtitle.
- 5 transisi utama.
- 3 gaya border dan shadow.

### Kategori asset

#### Karakter

- Maskot netral.
- Karakter berpikir.
- Karakter menunjuk.
- Karakter terkejut.
- Karakter bekerja di laptop.
- Karakter merayakan hasil.

#### Objek umum

- Folder.
- File.
- Laptop.
- Smartphone.
- Kamera.
- Grafik.
- Jam.
- Lampu ide.
- Robot.
- Otak.
- Globe.
- Koin.
- Buku.
- Api.
- Awan.
- Peta.

#### Sticker

- Cursor.
- Hand pointer.
- Arrow melengkung.
- Spark.
- Checkmark.
- Crossmark.
- Warning.
- Label tape.
- Highlight marker.
- Loading spinner.
- Notification bubble.
- Speech bubble.

#### UI dan diagram

- Browser window.
- Chat window.
- Folder tree.
- Kanban.
- Timeline.
- Progress bar.
- Comparison card.
- Before/after panel.
- Three-step process.
- Metric card.

## 5. Format Asset Teknis

Asset harus mudah dipakai baik di preview Canvas maupun pada render Remotion.

Pilihan format yang disarankan:

- SVG untuk ikon, sticker, diagram, dan objek flat.
- PNG transparan untuk pixel-art atau ilustrasi dengan tekstur.
- JSON metadata untuk setiap asset.
- Sprite sheet hanya jika diperlukan untuk animasi frame-by-frame.

Contoh metadata:

```ts
export type VisualAsset = {
  id: string;
  category: "character" | "object" | "sticker" | "ui" | "diagram";
  src: string;
  tags: string[];
  compatibleStyles: string[];
  anchor: "center" | "bottom" | "top" | "left" | "right";
  defaultScale: number;
  variants?: string[];
};
```

Metadata membuat planner dapat memilih asset berdasarkan makna narasi dan gaya yang sedang digunakan.

## 6. Scene Beat System

Scene saat ini terlalu dekat dengan pola satu kalimat = satu layout. Pengembangan berikutnya perlu memisahkan scene menjadi beberapa beat visual.

Contoh struktur:

```ts
export type SceneBeat = {
  id: string;
  start: number;
  duration: number;
  kind: "text" | "asset" | "card" | "diagram" | "sticker" | "transition";
  asset?: string;
  text?: string;
  motion: "fade" | "spring" | "slide" | "pop" | "shake" | "float";
  emphasis?: "normal" | "accent" | "hero";
};
```

Dengan beat system, satu scene dapat melakukan urutan seperti:

- headline masuk;
- kata kunci diberi highlight;
- kartu muncul;
- asset bergerak ke tengah;
- label muncul;
- checklist tampil satu per satu;
- scene berpindah ke scene berikutnya.

Ini akan membuat video terasa hidup tanpa harus membuat template baru untuk setiap topik.

## 7. Perluasan Model Scene

Model scene perlu berkembang dari model yang hanya berisi layout dan icon menjadi model yang mendeskripsikan komposisi.

Contoh konsep:

```ts
{
  layout: "comparison",
  composition: "center-card",
  beatPlan: "reveal-compare",
  asset: "pixel-folder-open",
  assetVariant: "open",
  textTreatment: "marker-highlight",
  subtitleStyle: "word-punch",
  motionProfile: "spring-stagger",
  stickers: [
    { asset: "cursor", x: 0.8, y: 0.25, motion: "jitter" }
  ]
}
```

Planner tidak hanya memilih `layout: "icon"`, tetapi juga menentukan apa yang dilihat, bagaimana elemen masuk, dan apa yang menjadi fokus utama.

## 8. AI Creative Director yang Lebih Kaya

AI saat ini sudah memilih preset, warna, font, layout, icon, dan beberapa scene property. Pengembangan berikutnya sebaiknya meminta AI mengembalikan:

- style pack;
- visual metaphor;
- asset category;
- asset ID atau asset tag;
- beat plan;
- text treatment;
- subtitle treatment;
- motion profile;
- density level;
- focal point;
- supporting decorations.

Contoh keputusan AI untuk narasi tentang AI Agent:

- Style pack: `creator-explainer`.
- Visual metaphor: folder yang dirapikan otomatis.
- Hero asset: `pixel-folder-open`.
- Supporting asset: `cursor`, `checkmark`, `spark`.
- Layout: comparison lalu desktop UI.
- Motion: drag-and-drop dan spring pop.
- Subtitle: highlight kata `otomatis` dan `agent`.

AI hanya boleh memilih ID asset yang tersedia di library. Jika asset tidak ditemukan, engine menggunakan fallback icon atau bentuk prosedural.

## 9. Variasi Komposisi

Agar dua video dengan tema yang sama tidak menghasilkan tampilan identik, planner perlu memiliki variasi terkontrol:

- `center-hero` untuk satu objek besar.
- `split-screen` untuk perbandingan.
- `top-text-bottom-object` untuk video edukasi.
- `floating-cards` untuk beberapa poin.
- `desktop-ui` untuk proses digital.
- `timeline-path` untuk urutan langkah.
- `orbiting-icons` untuk konsep abstrak.
- `full-bleed-object` untuk hook atau punchline.
- `editorial-column` untuk fakta dan kutipan.

Variasi harus tetap mengikuti style pack agar tidak terasa acak.

## 10. Motion Profile

Animasi perlu dibuat sebagai profil yang dapat dipakai ulang:

- `spring-pop` — objek masuk dengan overshoot ringan.
- `slide-stagger` — item masuk berurutan dari arah yang sama.
- `drag-drop` — asset berpindah dari titik awal ke target.
- `type-on` — teks tampil bertahap.
- `counter-reveal` — angka menghitung ke nilai akhir.
- `orbit-float` — ikon bergerak mengitari focal point.
- `shake-emphasis` — elemen bergetar singkat untuk warning.
- `idle-bob` — karakter bergerak naik-turun perlahan.
- `wipe-highlight` — marker berjalan di bawah kata penting.
- `camera-push` — seluruh komposisi melakukan zoom kecil menuju focal point.

Semua profile harus bekerja konsisten di preview dan render final.

## 11. Subtitle yang Lebih Menarik

Subtitle jangan selalu berupa teks datar di lokasi yang sama. Tambahkan beberapa treatment:

- Word highlight dengan accent color.
- Caption bubble seperti percakapan.
- Kartu subtitle dengan label kategori.
- Dua baris dengan satu kata hero berukuran besar.
- Subtitle mengikuti posisi objek utama.
- Kinetic phrase untuk hook.
- Subtitle minimal untuk bagian demonstrasi UI.

Subtitle harus tetap memiliki safe area dan tidak menutupi focal point.

## 12. Prioritas Implementasi

### Fase 1 — Fondasi style pack

- Tambahkan tipe `StylePack`.
- Pisahkan aturan visual dari `THEME_PRESETS`.
- Buat style pack `creator-explainer`.
- Tambahkan motion profile dasar.
- Tambahkan metadata asset.

### Fase 2 — Asset library awal

- Masukkan asset SVG dan PNG transparan.
- Buat registry asset.
- Tambahkan fallback jika asset gagal dimuat.
- Pastikan asset tersedia untuk preview Canvas dan Remotion ZIP.

### Fase 3 — Scene beat

- Tambahkan `beats` ke model scene.
- Buat renderer beat untuk text, asset, card, sticker, dan diagram.
- Pertahankan kompatibilitas dengan scene lama.

### Fase 4 — AI planner baru

- Perluas schema DesignPlan.
- Minta AI memilih style pack, asset, beat plan, dan motion profile.
- Validasi semua hasil AI dengan Zod.
- Gunakan fallback deterministik jika output AI tidak valid.

### Fase 5 — Kontrol kreator

- Tambahkan pilihan gaya visual sederhana:
  - Modern.
  - Tech.
  - Fun.
  - Dark.
  - Editorial.
- Jangan tampilkan istilah teknis seperti beat, asset registry, atau motion profile.
- Simpan pilihan gaya bersama project.

### Fase 6 — Evaluasi kualitas

Buat beberapa script uji dari topik berbeda:

- Sains.
- Finansial.
- Sejarah.
- Teknologi.
- Horor.
- Edukasi anak.

Bandingkan output berdasarkan:

- Variasi antar-scene.
- Kesesuaian visual dengan narasi.
- Kejelasan subtitle.
- Ritme perubahan visual.
- Konsistensi style pack.
- Tidak adanya layout yang terasa berulang.
- Keberhasilan preview dan render GitHub.

## 13. Prinsip yang Harus Dipertahankan

- Kreator cukup memasukkan naskah, audio, dan asset opsional.
- Render tetap dapat dilakukan lokal atau melalui GitHub Actions.
- Asset internal tidak boleh membuat user memahami sisi teknis sistem.
- Preview dan hasil render wajib memakai renderer yang sama secara visual.
- Jangan menyalin karakter, logo, atau desain spesifik dari video referensi.
- Gunakan referensi hanya untuk mempelajari prinsip komposisi, ritme, dan motion.
- Jangan mengorbankan keterbacaan demi variasi.
- Variasi harus dikontrol oleh style pack, bukan dibuat acak sepenuhnya.
- Semua asset dan pilihan AI harus punya fallback yang aman.

## 14. Kesimpulan

Kualitas visual tidak akan naik hanya dengan menambah jumlah tema warna. Lompatan kualitas datang dari perubahan cara engine menyusun video:

```text
Dari:
kalimat → satu layout → icon → teks

Menjadi:
narasi → visual metaphor → style pack → asset → beat plan → motion profile → scene composition
```

Target akhirnya adalah Auto Remotion Studio yang mampu membuat video dengan identitas visual berbeda berdasarkan isi konten, tetapi tetap konsisten dalam satu gaya. User merasakan hasil yang dibuat khusus untuk narasinya, bukan hasil dari template yang sama berulang-ulang.
