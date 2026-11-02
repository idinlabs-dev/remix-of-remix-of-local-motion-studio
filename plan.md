# Rencana UI dan Render GitHub-only

## Tujuan

Auto Remotion Studio menggunakan GitHub sebagai jalur wajib untuk membuat video final, sementara preview tetap berjalan lokal di browser. Pengguna dapat login melalui alur GitHub App yang sudah ada, membuka Gallery, dan memakai menu melayang yang tidak memenuhi ruang navigasi utama.

## Keputusan desain

- **Design movement:** clean creator workspace dengan floating utility menu.
- **Core principles:** putih dan lapang, satu CTA utama, status koneksi mudah dipahami, detail teknis GitHub disembunyikan.
- **Color philosophy:** putih sebagai kanvas profesional, navy/charcoal untuk keterbacaan, aksen merah-biru hanya untuk tindakan dan status.
- **Layout paradigm:** konten utama editorial dengan menu kecil yang fixed di sudut kanan atas.
- **Signature elements:** floating menu berbentuk pill, tombol GitHub dengan ikon resmi, kartu render dengan radius lembut dan border tipis.
- **Interaction:** login diarahkan ke alur GitHub App install-first yang sudah tersedia; setelah kembali, project tetap dapat dilanjutkan.
- **Typography:** Space Grotesk untuk heading dan body dengan hierarki tebal yang ringkas.
- **Brand essence:** studio video otomatis untuk kreator yang ingin langsung menghasilkan video; jelas, modern, praktis.

## Struktur implementasi

- `src/components/FloatingMenu.tsx`: menu global Login GitHub dan Gallery.
- `src/routes/index.tsx`: guard pembuatan project agar login GitHub menjadi syarat.
- `src/routes/project.$id.tsx`: render final hanya melalui endpoint GitHub; preview lokal tetap tersedia.
- `src/routes/gallery.tsx`: daftar render lokal lintas project dengan video preview dan download.
- `src/lib/storage/db.ts`: dipakai ulang tanpa mengubah skema IndexedDB.
- `src/styles.css`: menghapus tampilan grid-paper dari halaman web dan memakai putih clean.
- `public/manus-routes.json`: deklarasi route halaman yang tersedia.

## Batasan

Gallery tahap ini menampilkan render yang tersimpan di IndexedDB browser. Embed video langsung dari GitHub belum diaktifkan karena membutuhkan keputusan endpoint publik/akses file yang aman; tidak ada secret atau token yang akan diekspos ke client.
