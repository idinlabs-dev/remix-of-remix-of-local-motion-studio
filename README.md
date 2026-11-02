# Auto Remotion Studio

Auto Remotion Studio adalah platform video creation berbasis browser untuk kreator global. Pengguna dapat mengubah naskah, audio narasi, atau video pembicara menjadi video motion yang terstruktur secara otomatis.

AI bertindak sebagai **Creative Director** dan **Motion Designer**: menganalisis isi narasi, memilih mood, palet warna, tipografi, layout, ikon, stiker, dan transisi yang sesuai dengan topik. Sistem tidak dikunci untuk satu niche tertentu. Konten dapat berupa sains, horor, finansial, edukasi, sejarah, filosofi, teknologi, olahraga, petualangan, atau topik lain.

## Mode Produk

### Motion Explainer — Faceless Studio

Mode ini ditujukan untuk video narasi tanpa pembicara di layar.

Input:

- Audio narasi.
- Teks naskah yang ditempel manual, sama dengan audio narasi.
- Gambar background opsional.

Output dan proses:

- Kalimat dipecah menjadi beberapa scene.
- Sinkron waktu berjalan lokal: panjang teks dan jeda audio dipakai untuk memperkirakan batas scene. Penanda manual di preview digunakan untuk mengoreksi awal scene.
- AI memilih layout yang relevan untuk setiap kalimat.
- Subtitle dianimasikan kata demi kata.
- Warna, font, background, partikel, ikon, dan stiker mengikuti topik narasi.
- Video dapat dirender menjadi MP4 atau WebM langsung di browser.

### Podcast / Talking-Head Smart Editor

Mode ini ditujukan untuk video pembicara, podcast, dan konten talking-head.

Fitur yang dirancang:

- Micro-zoom otomatis.
- Caption keyword bergaya short-form video.
- Cut-in kartu infografis.
- Tampilan pembicara picture-in-picture saat infografis muncul.
- Stiker dan ikon kontekstual.
- Progress bar dan engagement end card.
- Export source project Remotion untuk paket Pro Creator.

## Arsitektur

Auto Remotion Studio menggunakan prinsip **device-side first**. Server tidak digunakan untuk merender video berukuran besar.

```text
Browser pengguna
├── IndexedDB
│   ├── Project timeline
│   ├── Audio, gambar, dan video
│   └── Hasil render
├── Canvas API
│   └── Menggambar frame berdasarkan waktu
├── WebCodecs + Mediabunny
│   └── Encode video dan mux audio
└── Server Functions
    ├── Verifikasi kode akses
    └── AI Creative Director via Kie.ai (opsional, untuk desain visual)
```

File media, deteksi jeda, sinkron waktu, dan proses render tetap berada di device pengguna. Sinkron waktu tidak membuat transkrip dan tidak mengirim audio ke server atau layanan lain. Teks narasi disediakan pengguna; Kie.ai hanya dipanggil jika pengguna memilih desain visual AI.

### Sinkronisasi naskah dan audio

Klik **Sinkron waktu** untuk membuat batas scene awal berdasarkan estimasi teks dan jeda yang terdeteksi lokal. Untuk mencocokkan pergantian visual dengan ucapan secara tepat, putar preview dan tekan **Tandai mulai** pada scene ketika kalimatnya mulai terdengar. Audio dan teks tidak dikirim keluar untuk proses ini. Subtitle kata-per-kata memakai estimasi lokal di dalam rentang scene.

Pengguna juga dapat mengimpor file `.srt`. Teks setiap subtitle menjadi teks scene, sedangkan timestamp mulai/selesai dari SRT dipakai langsung untuk timeline. Proses impor berlangsung di browser dan tidak memerlukan layanan transkripsi atau API key tambahan.

## Teknologi

- TanStack Start v1.
- React 19.
- TypeScript.
- Vite.
- Tailwind CSS v4.
- shadcn/ui dan Radix UI.
- Canvas API.
- WebCodecs.
- Mediabunny untuk mux MP4/WebM.
- IndexedDB untuk project dan media lokal.
- `localStorage` untuk kode akses, kuota, dan preferensi ringan.
- Claude Haiku 5.5 melalui endpoint Kie.ai untuk desain scene.
- Vitest untuk pengujian otomatis.

## Mesin Visual

AI dapat memilih pola layout berikut secara dinamis:

- `hook` — pembuka dengan headline kuat.
- `stat` — kartu angka dan data besar.
- `versus` — perbandingan dua sisi.
- `timeline` — kronologi atau langkah.
- `anatomy` — diagram fokus dengan penunjuk.
- `quote` — kinetic quote.
- `list` — daftar poin.
- `icon` — satu objek atau konsep utama.
- `speaker` — footage pembicara penuh.
- `outro` — penutup dan CTA.

Tema, warna, font, background prosedural, partikel, ikon, dan stiker tidak di-hardcode ke satu topik. Semuanya dipilih berdasarkan konteks narasi.

## Paket Akses

Auto Remotion Studio tidak menggunakan sistem login atau database pengguna. Saat aktivasi, server memvalidasi API key Kie.ai dan memastikan saldo kredit masih tersedia; prefiks kode menentukan paket.

| Paket       | Harga promo |     Kuota | Durasi maksimal | Fitur utama                                                   |
| ----------- | ----------: | --------: | --------------: | ------------------------------------------------------------- |
| Starter     |    Rp20.000 |  30 video |        90 detik | Motion Explainer dan render MP4 lokal                         |
| Pro Creator |    Rp49.000 | 100 video |       120 detik | Semua fitur Starter, Mode Edit Video, dan export Remotion ZIP |

Harga coret promo:

- Starter: Rp40.000.
- Pro Creator: Rp99.000.

Kode yang diawali `PRO-` dibaca sebagai paket Pro. Kode Starter menggunakan prefix `STARTER-` atau `STR-`. Status penggunaan disimpan di browser/device pengguna.

> Penghapusan data browser dapat menghapus catatan kuota lokal. Validasi key/kredit berjalan server-side melalui endpoint saldo Kie.ai; request fitur desain tetap dapat ditolak oleh provider jika saldo atau akses berubah setelah aktivasi.

## Pembayaran

Alur pembayaran yang direncanakan:

1. Pengguna memilih paket.
2. Sistem membuat ID pesanan.
3. Pengguna melihat nominal dan QRIS DANA Bisnis.
4. Pengguna melakukan pembayaran.
5. Pengguna mengirim bukti pembayaran melalui tombol WhatsApp admin.
6. Admin memberikan kode akses yang sesuai dengan paket.

Nomor WhatsApp admin sengaja tidak disimpan di source code sampai konfigurasi pembayaran final tersedia.

## Struktur Folder Penting

```text
src/
├── components/
│   └── PreviewPlayer.tsx       # Preview canvas dengan audio sinkron
├── routes/
│   ├── index.tsx               # Landing page, mode, pricing, kode akses
│   ├── project.$id.tsx         # Editor project dan alur render
├── lib/
│   ├── access/
│   │   ├── plans.ts            # Paket, kuota, dan access gate
│   │   ├── promo.ts            # Countdown WIB dan ID pesanan
│   │   └── store.ts            # Kode akses dan pemakaian lokal
│   ├── ai/
│   │   ├── ai.functions.ts     # Server functions AI
│   │   ├── kie.server.ts       # Client server Kie.ai
│   │   ├── schema.ts           # Schema Zod dan prompt Creative Director
│   ├── encode/
│   │   ├── exporter.ts          # Render Canvas dan encode WebCodecs
│   ├── engine/
│   │   ├── background.ts        # Background prosedural dan partikel
│   │   ├── layouts.ts           # Renderer layout infografis
│   │   ├── planner.ts           # Scene generik dan penerapan desain AI
│   │   ├── renderer.ts          # Renderer frame utama
│   │   ├── themes.ts            # Preset tema dan font
│   │   ├── timing.ts             # Timing kalimat, estimasi lokal, dan jeda audio
│   │   └── types.ts              # Model Composition dan Scene
│   ├── export/
│   │   └── remotion-zip.ts      # Generator source project Remotion
│   └── storage/
│       └── db.ts                # IndexedDB dan preferensi localStorage
└── test/                        # Test timing dan routing
```

## Menjalankan Secara Lokal

Persyaratan:

- Node.js 22 atau versi kompatibel.
- npm atau pnpm.

Clone repository dan install dependency:

```bash
git clone https://github.com/wulanvlogaja-byte/remix-of-remix-of-local-motion-studio.git
cd remix-of-remix-of-local-motion-studio
pnpm install
```

Jika pnpm tidak tersedia, gunakan npm:

```bash
npm install
```

Jalankan development server:

```bash
pnpm dev
```

Atau:

```bash
npm run dev
```

Buka URL yang ditampilkan Vite, biasanya `http://localhost:5173`.

## Environment Variable

Salin template environment:

```bash
cp .env.example .env
```

Contoh konfigurasi:

```env
# Origin publik deployment; dipakai untuk canonical dan Open Graph URL.
VITE_SITE_URL=https://domain-anda.example
```

Sinkron waktu dan render tidak memerlukan API key tambahan. Jika pengguna memilih **Rancang adegan (AI)**, request desain visual memakai Kie.ai key yang sudah ada di Kode Akses.

## Perintah Development

```bash
pnpm dev          # Development server
pnpm build        # Production build
pnpm preview      # Preview hasil build
pnpm exec tsc --noEmit
pnpm test -- --run # Test sekali jalan
pnpm lint         # ESLint dan Prettier
```

## Status Implementasi

Yang sudah tersedia:

- Model Composition, Scene, Theme, dan timeline.
- Planner generik berbasis heuristik.
- AI Creative Director server function via Kie.ai.
- Sinkron waktu lokal dari teks dan jeda audio, dengan koreksi batas scene lewat playhead.
- Renderer Canvas dengan layout universal.
- Preview audio dan canvas.
- Export MP4/WebM melalui Mediabunny dan WebCodecs.
- Penyimpanan project/media/render di IndexedDB.
- Sistem paket, kode akses, dan kuota lokal.
- Countdown promo harian WIB.
- Landing page dua mode dan pricing card.
- Export timeline JSON.
- Generator source project Remotion ZIP.
- Test timing dan routing.

Pekerjaan lanjutan:

- Uji end-to-end dengan audio dan video pembicara asli.
- Menambahkan gate kuota pada setiap aksi AI dan render.
- Menyelesaikan upload footage serta preview PiP untuk Mode Edit Video.
- Menambahkan tombol export Remotion ZIP di editor dengan pembatasan paket Pro.
- Menyambungkan aset QRIS DANA ke modal pembayaran.
- Mengisi nomor WhatsApp admin dan mengaktifkan alur konfirmasi pembayaran.
- Mengganti warning API `inputValidator()` ke API `validator()` TanStack Start terbaru.
- Optimasi code splitting untuk mengurangi ukuran bundle Mediabunny dan engine.

## Aturan Pengembangan

- Jangan mengunci generator ke satu niche atau contoh topik tertentu.
- Pertahankan rendering lokal di browser selama memungkinkan.
- Jangan mengekspos API key provider ke client.
- Gunakan native checkbox untuk toggle editor. Radix Switch tidak digunakan karena pernah menyebabkan konflik duplicate React pada dev bundler.
- Jangan rewrite history Git yang sudah dipush ke branch utama.
- Jalankan typecheck, build, dan test setelah perubahan lintas modul.
