# TODO

## Render final wajib GitHub

- [ ] Tombol Render video tidak menjalankan renderer lokal.
- [ ] Pengguna yang belum login menerima pesan “Silakan login terlebih dahulu untuk membuat video.” dan tombol menuju login GitHub.
- [ ] Pengguna yang sudah login tetap memakai endpoint GitHub render, polling status, pengambilan MP4, dan riwayat render yang sudah ada.

## Login dan navigasi

- [ ] Halaman utama memiliki guard sebelum membuat project baru.
- [ ] Menu melayang di sudut atas menyediakan Login GitHub dengan ikon GitHub dan tautan Gallery.
- [ ] Setelah callback GitHub, pengguna dapat melanjutkan ke halaman sebelumnya tanpa kehilangan konteks.

## Gallery

- [ ] Halaman Gallery menampilkan video render yang tersimpan di browser pengguna.
- [ ] Setiap video memiliki preview, nama, waktu render, tautan ke project, dan tombol unduh.
- [ ] Empty state menjelaskan bahwa Gallery berisi video yang dibuat pada browser ini.

## Visual clean

- [ ] Background halaman utama, editor, dan Gallery menjadi putih polos/profesional.
- [ ] Kartu dan border tetap terbaca tanpa grid-paper.
- [ ] Preview canvas dan visual engine tidak diubah oleh styling halaman.
