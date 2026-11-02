# Roadmap

## Status: inti selesai — tinggal kunci AI + uji dengan audio asli

- [x] Rencana disetujui (lihat .lovable/plan/)
- [x] Instal mediabunny (mux mp4/webm) + verifikasi WebCodecs di browser
- [x] Mesin inti: tipe timeline, renderer canvas per frame, pemecahan kalimat + timing jeda audio
- [x] Kit template visual + variasi
- [x] Preview player sinkron audio
- [x] Layanan AI Gemini: transkrip + rencana adegan (server function) — kode siap, **menunggu GEMINI_API_KEY dari user**
- [x] Render & encode MP4 (+ fallback WebM), unduh — fallback WebM terverifikasi di Chromium headless
- [x] UI editor + penyimpanan IndexedDB/localStorage
- [x] Route landing `/` dan editor `/project/$id` + head metadata
- [x] Uji otomatis: timing kalimat (10 test hijau), sinkron timeline, fallback codec
- [x] Uji end-to-end render di browser (Playwright): buat project → sinkron waktu → render → unduh
- [ ] Uji end-to-end AI — kunci tersimpan & diterima Google, tapi pembuatan jawaban tidak pernah merespons (kemungkinan kuota/billing akun Gemini)
- [ ] Bandingkan hasil dengan audio & gambar contoh "sayap pesawat"
