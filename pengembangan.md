# Dokumentasi Pengembangan Auto Remotion Studio

Dokumen ini mencatat pengerjaan fitur render otomatis melalui GitHub Actions, investigasi error koneksi GitHub, dan penyederhanaan alur koneksi untuk user kreator.

## 1. Tujuan Fitur

Auto Remotion Studio adalah web editor video untuk kreator. Render video berat dijalankan melalui GitHub Actions milik masing-masing user agar proses render tidak membebani RAM dan CPU perangkat, terutama Android dengan spesifikasi rendah.

User tidak perlu memahami repository, workflow, release, artifact, atau GitHub Actions. Dari sisi user, alurnya cukup:

1. Membuat atau membuka project video.
2. Klik **Aktifkan Render Cepat**.
3. Menyelesaikan koneksi GitHub satu kali.
4. Klik **Render video**.
5. Menunggu video selesai dan hasilnya kembali ke editor.

Secara internal, aplikasi membuat repository privat render di akun GitHub user, mengunggah paket project sementara, menjalankan workflow Remotion, mengambil artifact MP4, lalu membersihkan data sementara.

## 2. Repository Proyek

- Repository GitHub: `idinlabs-dev/remix-of-remix-of-local-motion-studio`
- Deployment Production: `https://imautoremotion.vercel.app/`
- Branch deployment: `main`
- Repository render per user: `auto-remotion-render` atau nama alternatif otomatis jika nama tersebut sudah digunakan.
- GitHub App: **Auto Remotion Studio Render**

## 3. Implementasi yang Sudah Ada

### Backend GitHub

File utama:

- `src/lib/github/github.server.ts`
- `src/lib/github/github.functions.ts`
- `src/lib/github/session.ts`
- `src/lib/github/runner-template.ts`
- `src/routes/api/github/connect.ts`
- `src/routes/api/github/callback.ts`
- `src/routes/api/github/render.ts`
- `src/routes/api/github/artifact.ts`

Backend menangani:

- OAuth dan session GitHub.
- Cookie session terenkripsi dan cookie OAuth state.
- Validasi callback URL.
- Pembuatan atau pemakaian repository privat render.
- Pemasangan file marker dan workflow ke repository user.
- Upload paket project sementara sebagai GitHub Release asset.
- Dispatch workflow render.
- Pemantauan status workflow.
- Pengambilan artifact hasil render.
- Pembatalan workflow.
- Penghapusan release dan tag sementara.
- Pemutusan koneksi GitHub.

### Workflow GitHub Actions

Workflow dibuat oleh `src/lib/github/runner-template.ts` di:

```text
.github/workflows/render-remotion.yml
```

Tahapan workflow:

1. Menjalankan workflow dengan `workflow_dispatch`.
2. Mengunduh `project.zip` dari release sementara.
3. Memvalidasi dan mengekstrak ZIP dengan aman.
4. Memasang dependency project.
5. Menyiapkan browser Remotion.
6. Merender `out/video.mp4`.
7. Mengunggah video sebagai artifact dengan masa simpan satu hari.
8. Menghapus release dan tag input sementara pada job cleanup.

Workflow menggunakan action yang dipin ke commit tertentu untuk mengurangi risiko perubahan action eksternal tanpa sengaja.

## 4. Environment Variable

Environment variable server-only yang diperlukan di Vercel:

```env
VITE_SITE_URL=https://imautoremotion.vercel.app
GITHUB_APP_CLIENT_ID=
GITHUB_APP_CLIENT_SECRET=
GITHUB_APP_CALLBACK_URL=https://imautoremotion.vercel.app/api/github/callback
GITHUB_SESSION_SECRET=
```

Nilai secret tidak boleh dimasukkan ke repository, dokumentasi, screenshot publik, atau chat.

Template sudah diperbarui di:

```text
.env.example
```

## 5. Izin GitHub App

Izin yang dibutuhkan GitHub App:

### Repository permissions

- **Actions: Read and write**
- **Contents: Read and write**
- **Repository creation: Read and write**
- **Workflows: Read and write**
- **Metadata: Read-only** sebagai izin wajib/default GitHub

Izin yang tidak diperlukan untuk fitur ini:

- Administration
- Secrets
- Variables
- Webhooks
- Deployments
- Pull requests
- Checks
- Repository discussions

Pengaturan **Request user authorization (OAuth) during installation** digunakan agar proses instalasi dan otorisasi user dapat berjalan dalam satu alur.

## 6. Masalah yang Ditemukan dan Perbaikannya

### 6.1 GitHub App belum terbaca di Production

Gejala awal:

```text
GitHub App belum dikonfigurasi.
```

Endpoint callback Production mengembalikan HTTP 503 karena environment variable belum terbaca.

Perbaikan:

- Memastikan callback URL Production adalah:

```text
https://imautoremotion.vercel.app/api/github/callback
```

- Memastikan push ke branch `main` memicu deployment ulang Vercel.
- Endpoint koneksi kemudian berubah menjadi redirect OAuth GitHub HTTP 302.

### 6.2 Error 403 izin GitHub terlalu umum

Gejala:

```text
Render gagal: izin Github belum lengkap.
```

Backend sebelumnya menggunakan satu pesan umum untuk seluruh error HTTP 403. Pesan tersebut tidak menunjukkan operasi yang gagal.

Perbaikan di `src/lib/github/github.server.ts`:

- Menambahkan pemetaan pesan berdasarkan endpoint yang ditolak.
- Error pembuatan repository menyebut izin **Repository creation**.
- Error pemasangan workflow menyebut **Contents** dan **Workflows**.
- Error menjalankan atau membaca workflow menyebut **Actions**.
- Error release dan tag menyebut izin **Contents**.

Commit perbaikan pesan permission:

```text
8018a9f Explain GitHub render permission failures
```

### 6.3 User harus authorize, install, lalu authorize lagi

Dari rekaman test, alur lama adalah:

1. User klik Hubungkan GitHub.
2. GitHub meminta Authorize.
3. GitHub baru meminta Install App.
4. User memilih akun/repository.
5. User kembali ke website tetapi koneksi belum langsung terbaca.
6. User harus mengulang koneksi sampai berhasil.

Masalah utamanya adalah website memulai dari endpoint OAuth, padahal GitHub App belum ter-install.

Perbaikan:

- Mengubah alur koneksi menjadi **install-first**.
- Endpoint `/api/github/connect` sekarang mengarahkan ke:

```text
https://github.com/apps/auto-remotion-studio-render/installations/new
```

- Parameter state tetap disimpan dalam cookie terenkripsi.
- GitHub menangani instalasi App dan otorisasi user dalam satu alur sesuai konfigurasi App.
- Label tombol user diubah dari **Hubungkan GitHub** menjadi **Aktifkan Render Cepat**.

Commit penyederhanaan alur:

```text
3c393ea Simplify GitHub render activation flow
```

## 7. Alur User Saat Ini

Di editor project, panel Render menampilkan:

- Tombol **Render video**.
- Tombol **Aktifkan Render Cepat** jika GitHub belum terhubung.
- Status **Render otomatis aktif · @username** jika sudah terhubung.
- Tombol **Putuskan** untuk mencabut session dari aplikasi.

Setelah user tersambung:

1. Aplikasi menyiapkan ZIP Remotion di browser.
2. ZIP dikirim ke endpoint server `/api/github/render`.
3. Server menyiapkan repository render privat user.
4. Server membuat release sementara dan mengunggah ZIP.
5. Server menjalankan workflow GitHub Actions.
6. Editor memantau status workflow.
7. Artifact MP4 diunduh melalui endpoint server.
8. Video dimasukkan ke riwayat render lokal.
9. Release sementara dan tag dibersihkan.

## 8. Validasi yang Sudah Dilakukan

Test suite berhasil:

```text
7 test files passed
32 tests passed
```

Build Production berhasil dengan:

```text
npm run build
```

Build menghasilkan bundle client, SSR, dan Nitro tanpa error fatal.

Endpoint live setelah perubahan install-first diverifikasi mengembalikan:

```text
HTTP 302
Location: https://github.com/apps/auto-remotion-studio-render/installations/new
```

## 9. Commit Penting

```text
11e2b0d Align production OAuth callback configuration
8018a9f Explain GitHub render permission failures
3c393ea Simplify GitHub render activation flow
```

## 10. Catatan Keamanan

- Jangan pernah commit `GITHUB_APP_CLIENT_SECRET`.
- Jangan pernah commit `GITHUB_SESSION_SECRET`.
- Jangan menampilkan access token atau refresh token di log, chat, screenshot, atau UI.
- Paket project dan media dikirim hanya saat user memilih render otomatis.
- Release input bersifat sementara dan dibersihkan setelah workflow selesai.
- Artifact output memiliki masa simpan satu hari.
- Cookie session menggunakan `HttpOnly`, `Secure`, dan `SameSite=None` untuk dukungan preview HTTPS.
- Repository render harus privat dan berada di akun GitHub yang sedang terhubung.

## 11. Hal yang Perlu Dipantau

1. Uji ulang dengan akun GitHub yang belum pernah meng-install App.
2. Uji ulang dengan akun yang sudah pernah meng-install App.
3. Pastikan callback pertama setelah install langsung menghasilkan status connected.
4. Pastikan repository render dibuat otomatis tanpa user harus membuka GitHub manual.
5. Pastikan workflow dapat membaca release dan menghasilkan artifact.
6. Pastikan cleanup release tetap berjalan jika job render gagal.
7. Pantau batas ukuran ZIP render saat media besar.
8. Pertimbangkan perbaikan lint/prettier legacy yang saat ini masih melaporkan banyak masalah formatting, meskipun test dan build lulus.

## 12. Prinsip UX

User Auto Remotion Studio adalah kreator, bukan programmer. Detail berikut harus tetap tersembunyi dari alur utama user:

- Nama repository render.
- Nama workflow.
- Release dan artifact.
- Struktur ZIP.
- GitHub API.
- Status teknis Actions.

Bahasa UI sebaiknya berfokus pada manfaat:

- **Aktifkan Render Cepat**
- **Render otomatis aktif**
- **Sedang menyiapkan video**
- **Sedang membuat video**
- **Mengambil hasil video**
- **Video siap diputar dan diunduh**

Tujuan akhirnya adalah user cukup melakukan satu koneksi awal dan setelah itu hanya menggunakan tombol **Render video**.
