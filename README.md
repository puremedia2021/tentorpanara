# Payroll Tentor

Sistem operasional payroll tentor berbasis Cloudflare Workers + D1, dengan alur:

1. Setup master data: **Paket** (menentukan fee tentor), **Tentor**, **Siswa** (di halaman `/admin.html`).
2. Input **Sesi** belajar (tentor, siswa, tempat, jumlah peserta, keterangan) di `/sesi.html`. Harga & total dihitung otomatis dari paket siswa.
3. Sistem membuat 2 link unik (tanpa login): satu untuk tentor, satu untuk siswa, di `/approve.html?token=...`.
4. Masing-masing pihak membuka link, upload foto bukti (wajah saat belajar, dikompres otomatis di browser dan disimpan di D1), dan klik "Acc".
5. Sesi yang sudah di-acc oleh **kedua** pihak otomatis masuk ke `/rekap.html` sebagai dasar payroll.

## Struktur

- `schema.sql` — skema database D1 (paket, tentor, siswa, sesi termasuk foto bukti base64)
- `src/index.js` — Worker: semua endpoint `/api/*`
- `public/` — halaman statis (admin, input sesi, approval, rekap)
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
