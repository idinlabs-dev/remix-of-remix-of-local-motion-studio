# Rencana: Web "Auto Remotion" — Studio Video Narasi Otomatis (Semua Proses di Device)

## Ringkasan

Web tempat lo upload audio narasi (MP3/WAV) + gambar background, lalu AI menyusun
video vertikal bergaya seperti contoh "sayap-pesawat.mp4": adegan animasi yang
nyinkron per kalimat, judul besar di atas, subtitle yang nyorot kata per kata.
Preview langsung di browser, dan hasil akhirnya **MP4 yang dirender sepenuhnya
oleh device lo** — nggak ada server render sama sekali.

## Keputusan yang sudah lo pilih

- AI: **Google Gemini** (kunci di `.env` / secret proyek)
- Hasil akhir: **render MP4 di browser**
- Narasi: **dua-duanya** — paste teks manual, atau auto-transkrip dari audio
- Visual: **template + variasi** — AI memilih & mengisi komponen animasi siap pakai

## Alur pengguna

1. Buat project baru → upload audio + (opsional) gambar background + pilih rasio (9:16 default 1080x1920, 16:9, 1:1).
2. Tempel teks narasi, atau centang "auto-transkrip" (AI Gemini menyalin isi audio lengkap dengan waktu per kalimat).
3. Kalimat dipecah otomatis; timing tiap kalimat diambil dari jeda audio (deteksi keheningan via Web Audio API, lokal di device).
4. AI menyusun **rencana adegan** per kalimat dalam JSON: judul, elemen visual (dari palet template), gaya penekanan kata di subtitle.
5. Preview diputar sinkron dengan audio; tiap bagian bisa diedit/di-regenerate.
6. Klik "Render MP4" → device me-render frame demi frame → unduh MP4. Timeline JSON juga bisa diekspor/diimpor.

## Arsitektur: semuanya jalan di device

- **Rendering & encode 100% di browser.** Renderer berbasis canvas yang
  deterministik per frame (gaya Remotion: komposisi berbasis frame, bukan
  waktu), di-encode dengan WebCodecs (video H.264 + audio AAC) dan dibungkus
  jadi MP4. Kalau device/browser tidak mendukung H.264+AAC, otomatis fallback
  ke WebM (VP9 + Opus) supaya render tetap berhasil.
- **Preview memakai renderer yang sama** — apa yang lo lihat = hasil render.
- **Penyimpanan:** media (audio, gambar, MP4 hasil render) dan data project
  disimpan di IndexedDB — blob besar melebihi batas localStorage (~5 MB).
  **localStorage** tetap dipakai untuk preferensi & pengaturan ringan (rasio
  terakhir, kualitas render, tema). Setiap project punya daftar riwayat render.
- **Satu-satunya yang lewat server: panggilan AI.** Kunci Gemini tidak boleh
  masuk bundle browser (siapa pun bisa mencurinya), jadi request AI dioper
  lewat satu server function tipis yang meneruskan ke Gemini. Semua pemrosesan
  hasil AI (pemecahan kalimat, timing, penyusunan timeline, render) tetap di
  device. Untuk pemakaian sendiri di luar Lovable, disiapkan `.env.example`
  berisi `GEMINI_API_KEY`.

## AI (Gemini)

- Transkrip: kirim audio (inline, dipotong sesuai batas ukuran) → hasil JSON
  berisi teks per kalimat + waktu mulai/selesai.
- Rencana adegan: teks narasi + daftar elemen template yang tersedia → JSON
  timeline per kalimat (judul, elemen, posisi, kata yang disorot). Format ketat
  (structured output), divalidasi dengan Zod; kalau gagal, minta perbaikan
  sekali lalu fallback ke template generik.

## Halaman (route)

- `/` — landing ringkas + daftar project + tombol project baru.
- `/project/$id` — editor: upload media, teks narasi, timeline adegan, preview
  player, tombol render + riwayat render.
- Semua route punya metadata head sendiri (tanpa og:image karena tidak ada
  gambar hero absolut).

## Kit template visual (fase awal)

Sekitar 10–15 jenis elemen animasi yang bisa dipilih AI, bergaya papan tulis /
kertas kotak-kotak: judul masuk, ilustrasi sederhana (bentuk dasar: pesawat,
panah aliran, orang, objek), panah & label istilah, adegan geser/wipe antar
kalimat, subtitle dengan sorotan kata per kata, adegan penutup. Tiap elemen
punya variasi (warna, arah masuk, kecepatan) supaya hasil tiap project beda.

## Struktur teknis

- `src/lib/engine/` — tipe timeline, renderer canvas per frame, mesin timing.
- `src/lib/encode/` — WebCodecs encoder + muxer (mp4/webm), fallback.
- `src/lib/templates/` — kit elemen visual + variasi.
- `src/lib/ai/` — client pemanggil server function AI + skema Zod.
- `src/lib/storage/` — IndexedDB project & media, localStorage preferensi.
- `src/routes/api/` — server function tipis penerus ke Gemini.
- `.env.example` — `GEMINI_API_KEY` (untuk deploy sendiri); di Lovable, kunci
  disimpan sebagai secret proyek.

## Tahapan

1. Verifikasi jalur render di browser (WebCodecs + muxer pada Chrome & Safari
   iOS; cek juga status renderer klien resmi Remotion — kalau tersedia dan
   stabil, preview bisa dipindah ke Remotion Player tanpa mengubah pipeline).
2. Mesin inti: tipe timeline, renderer canvas, pemecahan kalimat + timing dari
   jeda audio.
3. Kit template visual + variasi.
4. Preview player sinkron audio.
5. Layanan AI: transkrip + rencana adegan (Gemini via server function).
6. Render & encode MP4 (+ fallback WebM), tombol unduh.
7. UI editor lengkap + penyimpanan project (IndexedDB/localStorage).
8. Uji: aturan timing per kalimat, sinkronisasi timeline-audio, fallback encode,
   simpan-muat project. Lalu uji end-to-end dengan audio & gambar contoh
   (memakai file "sayap pesawat" sebagai pembanding hasil).

## Risiko & catatan

- Render panjang (video 1–2 menit) di HP low-end bisa lambat; dirender offline
  (bukan real-time) dengan progress bar, jadi hasil tetap mulus.
- Dukungan codec berbeda per device — fallback WebM menutupi sebagian besar
  kasus; limit ukuran file upload mengikuti batas storage browser.
- Batas ukuran audio yang dikirim ke Gemini ditangani dengan memotong audio
  per segmen.
