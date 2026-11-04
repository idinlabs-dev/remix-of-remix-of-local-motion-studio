# Catatan Pengembangan 2

## Arah Baru: AI Coding Remotion Khusus Per Konten

Tujuan utama pengembangan berikutnya adalah mengubah peran AI di Auto Remotion Studio. AI tidak lagi hanya memilih template, layout, warna, atau ikon dari renderer generik. AI harus memahami isi naskah, konteks tema, struktur joke, objek penting, visual metaphor, punchline, dan alur cerita, lalu menulis kode Remotion khusus untuk konten tersebut.

Setiap naskah harus dapat menghasilkan bahasa visual yang berbeda. Konten tentang ilmu gaib harus menghasilkan karakter, ritual mandi kembang, bunga, aura mistis, HP kehilangan sinyal, dompet kosong, tukang parkir, layangan, harimau putih, intern magang, loading training, dan slip gaji Rp 0. Konten tentang sambaran petir harus menghasilkan visual manusia, petir, panas, aliran listrik, jantung, otak, kulit, tanah, dan visualisasi flash over. Perbedaan konten tidak boleh hanya menghasilkan pergantian warna atau teks pada konsep visual yang sama.

## Target Pipeline

Alur pengembangan yang dituju adalah:

```text
Naskah + audio + subtitle
→ AI memahami story beat dan konteks konten
→ AI menyusun visual direction khusus
→ AI menulis source code Remotion khusus
→ source, audio, subtitle, dan asset divalidasi
→ seluruh project dikemas menjadi ZIP
→ ZIP dikirim ke GitHub
→ GitHub Actions menjalankan render
→ web melakukan polling sampai render selesai
→ artifact MP4 diambil kembali ke web
→ hasil masuk ke Gallery
```

## Bentuk Project Hasil AI

Project Remotion yang dibuat AI harus memiliki struktur yang dapat langsung dijalankan oleh GitHub Actions, minimal meliputi:

```text
generated-project/
├── src/
│   ├── Root.tsx
│   ├── Video.tsx
│   ├── timing.json
│   └── generated-assets.tsx
├── public/
│   └── narasi.mp3
├── assets/
│   └── narasi.srt
├── package.json
├── remotion.config.ts
└── render-remotion.yml
```

File `Video.tsx` harus benar-benar dibuat atau disusun ulang untuk konten yang sedang dirender. Perubahan tidak boleh berhenti pada pengisian data ke satu template universal. Primitive reusable seperti karakter, HP, dompet, bunga, petir, jantung, loading window, kartu, partikel, dan objek SVG boleh dipakai sebagai bahan dasar, tetapi AI harus menentukan primitive mana yang digunakan, bagaimana staging-nya, bagaimana objek bergerak, dan bagaimana punchline divisualkan.

## Peran AI Visual Director

AI perlu bertindak sebagai gabungan script analyst, storyboard artist, visual designer, motion designer, dan Remotion developer. Sebelum menulis kode, AI harus mengekstrak beberapa hal berikut:

- hook dan premis utama;
- setup, escalation, twist, conclusion, dan CTA;
- subjek utama di setiap scene;
- objek konkret yang harus terlihat;
- visual metaphor untuk setiap kalimat penting;
- keyword cue untuk memicu kemunculan atau perubahan objek;
- staging, komposisi, kamera, dan gerakan;
- ekspresi, pose, dan perubahan karakter;
- elemen yang harus dihindari agar tidak jatuh menjadi text card generik.

Contoh visual direction yang diharapkan:

```json
{
  "sceneType": "ritual-to-failure",
  "subject": "person",
  "visualConcept": "ritual mandi kembang menghasilkan kemampuan menghilangkan hal yang merugikan",
  "objects": ["calendar", "flower-bath", "flower", "phone", "wallet", "particle-person"],
  "beats": [
    "tampilkan puasa tiga hari",
    "jatuhkan tujuh bunga ke bak mandi",
    "karakter menghilang menjadi partikel",
    "sinyal HP hilang dan dompet menjadi kosong"
  ],
  "visualMetaphor": "ekspektasi ilmu gaib berubah menjadi masalah sehari-hari",
  "keywordCues": ["puasa", "kembang", "ngilang", "sinyal", "duit"],
  "avoid": ["generic text card", "random floating icons"]
}
```

## Timing dan Audio

Timing harus mengikuti audio secara lebih presisi. Pipeline dapat memakai deteksi silence, pembagian segmen bicara, timestamp kata, dan cue keyword. Setiap scene dan animasi utama harus dapat dipicu berdasarkan waktu atau kata yang relevan, misalnya bunga muncul ketika narasi menyebut “kembang”, karakter menghilang ketika menyebut “ngilang”, atau kartu harimau berubah menjadi intern ketika menyebut “tapi intern magang”.

Semua animasi harus deterministik dan aman untuk render. Source tidak boleh bergantung pada `Math.random()`, timer browser, state yang tidak stabil, atau input eksternal yang tidak tersedia di GitHub Actions. Preview dan hasil render harus menghasilkan frame yang konsisten.

## Validasi Sebelum ZIP dan Render

Sebelum project dikirim ke GitHub, sistem perlu memvalidasi source yang dibuat AI. Validasi minimal meliputi keberadaan file wajib, syntax JSX/TypeScript, composition Remotion, asset lokal, batas ukuran media, import yang aman, dan kemampuan build. Pada tahap berikutnya, perlu ditambahkan validasi visual untuk mendeteksi apakah scene masih terlalu generik.

Validasi visual harus memeriksa apakah setiap scene memiliki subject yang relevan, objek utama benar-benar terlihat, visual metaphor berhubungan dengan narasi, opening mempunyai visual hook, punchline memiliki visual payoff, dan layout tidak berulang secara berlebihan. Jika gagal, AI harus melakukan re-plan atau menulis ulang scene sebelum render dianggap layak.

## Prinsip Produk

AI dipakai karena AI harus mampu berpikir dan membuat keputusan visual, bukan hanya mengisi template. Keberhasilan tidak diukur dari apakah MP4 berhasil dibuat saja, tetapi dari apakah visual video benar-benar merepresentasikan isi konten dan mempunyai nilai jual.

Target akhirnya adalah sistem yang bekerja seperti art director sekaligus developer Remotion: memahami konten, memilih atau membuat visual yang tepat, menulis kode animasi khusus, membuat ZIP project, mengirimnya ke GitHub, menunggu GitHub Actions, lalu mengembalikan video final ke web.

## Tahapan Implementasi

### Tahap 1 — Fondasi generator project

Bangun format project Remotion generator yang dapat menerima visual direction dan menghasilkan `Root.tsx`, `Video.tsx`, timing, asset, package, dan workflow render.

### Tahap 2 — Visual primitive library

Siapkan primitive SVG/Remotion deterministik yang dapat dikomposisikan AI, seperti karakter, tangan, wajah, HP, dompet, bunga, petir, jantung, otak, tanah, kartu status, loading window, slip gaji, partikel, dan objek lingkungan.

### Tahap 3 — AI visual direction dan code generation

Tambahkan tahap AI yang menerjemahkan story beat menjadi visual direction lalu menulis kode scene khusus per project. Template universal hanya menjadi fallback darurat, bukan jalur utama.

### Tahap 4 — Validasi dan iterasi otomatis

Tambahkan pemeriksaan source, build, render preview, serta validasi visual. Jika scene masih berupa teks generik atau tidak sesuai noun penting dari narasi, ulangi proses planning dan code generation.

### Tahap 5 — Integrasi render GitHub

Saat user menekan Render, jalankan generator project, validasi, buat ZIP, kirim ke endpoint GitHub, polling GitHub Actions, ambil artifact MP4, dan simpan hasil ke Gallery.

## Kriteria Sukses

Pengembangan ini dianggap berhasil jika dua naskah dengan tema berbeda menghasilkan project Remotion dengan source scene yang berbeda secara nyata, memakai objek yang sesuai isi masing-masing, memiliki motion dan visual metaphor yang relevan, dapat dikemas menjadi ZIP, berhasil dirender melalui GitHub Actions, dan hasil MP4-nya tidak terasa seperti template yang sama dengan pergantian warna dan teks.
