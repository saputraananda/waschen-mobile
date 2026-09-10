# Waschen Mobile

Aplikasi mobile-first untuk operasional karyawan PT Waschen Alora Indonesia: HRIS, presensi, profil, cuti/izin, kasbon, dan progres produksi laundry.

## Fitur

- Presensi dengan lokasi dan swafoto
- Riwayat absensi dan status kehadiran
- Profil karyawan
- Pengajuan cuti / izin
- Kasbon
- Progres pengerjaan produksi

## Stack

- Frontend: React 18, Vite, Tailwind CSS
- Backend: Node.js, Express
- Database: MySQL

## Struktur

```
waschen-mobile/
├── api/           # Backend Express (controllers, routes, middleware)
├── src/           # Frontend React
├── server.js      # Entry server
├── vite.config.js
└── package.json
```

## Menjalankan

Prasyarat: Node.js 18+ dan akses database yang sudah dikonfigurasi di environment lokal.

```bash
npm install
npm run dev
```

- Frontend: `http://localhost:9000`
- Backend: `http://localhost:9001`

Konfigurasi environment disimpan di file `.env` lokal (tidak ikut ke repository).

## Scripts

| Command | Keterangan |
| --- | --- |
| `npm run dev` | Jalankan frontend + backend |
| `npm run build` | Build produksi |
| `npm start` | Jalankan server produksi |

## Lisensi

Hak cipta PT Waschen Alora Indonesia. Semua hak dilindungi.
