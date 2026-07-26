# Payroll Tentor

Sistem operasional payroll tentor berbasis Cloudflare Workers + D1, dengan alur:

1. **Setup awal**: buat akun Tim pertama di `/setup.html` (hanya bisa sekali, sebelum ada akun Tim).
2. Tim login (`/login.html`) lalu setup master data: **Paket** (jenis belajar online/offline, fee tentor, kuota sesi), **Tentor**, **Siswa** — masing-masing tentor & siswa otomatis dapat akun login sendiri (di halaman `/admin.html`).
3. Tim input **Sesi** belajar (tentor, siswa, tempat, jumlah peserta, keterangan) di `/sesi.html`. Harga & total dihitung otomatis dari paket siswa.
4. Tentor & siswa masing-masing login ke akunnya sendiri (`/login.html`), lihat sesi miliknya di `/dashboard.html`, upload foto bukti (dikompres otomatis + lokasi GPS direkam) dan klik "Acc".
5. Sesi yang sudah di-acc oleh **kedua** pihak otomatis masuk ke `/rekap.html`, dan kuota sesi siswa otomatis berkurang 1.

## Struktur

- `schema.sql` — skema database D1 (tim, paket, tentor, siswa, sesi, sessions/login)
- `src/index.js` — Worker: semua endpoint `/api/*` (auth, master data, sesi, acc, rekap)
- `public/` — halaman statis (login, setup, admin, input sesi, dashboard, rekap)
- `wrangler.toml` — konfigurasi binding D1 dan static assets

## Setup Awal

Prasyarat: Node.js (https://nodejs.org) sudah terinstall, dan punya akun Cloudflare.

```bash
npm install
npx wrangler login
```

Buat database D1:

```bash
npx wrangler d1 create tentor-payroll-db
```

Salin `database_id` yang muncul ke `wrangler.toml` (ganti `REPLACE_WITH_YOUR_D1_DATABASE_ID`).

Jalankan migrasi schema (lokal untuk testing):

```bash
npm run db:migrate
```

Migrasi ke database production:

```bash
npm run db:migrate:remote
```

## Development

```bash
npm run dev
```

Buka `http://localhost:8787`.

## Deploy ke Cloudflare

```bash
npm run deploy
```

## Deploy Otomatis via GitHub Actions (opsional)

Tambahkan secret `CLOUDFLARE_API_TOKEN` dan `CLOUDFLARE_ACCOUNT_ID` di GitHub repo settings, lalu buat workflow `.github/workflows/deploy.yml` yang menjalankan `npx wrangler deploy` setiap push ke branch `main`.
