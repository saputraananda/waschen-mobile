# Waschen Mobile - HRIS & Operational App

Aplikasi web berbasis seluler (*Mobile-First Web App*) untuk **PT Waschen Alora Indonesia** yang menangani Sistem Informasi Sumber Daya Manusia (HRIS), Presensi GPS, Manajemen Profil Karyawan, dan Operasional Laundry.

---

## 📌 Fitur Utama

* **Presensi GPS & Swafoto**: Catat jam masuk dan keluar (*Clock In / Clock Out*) secara *real-time* berbasis koordinat lokasi dan kamera.
* **Riwayat Absensi & Jadwal Kerja**: Kalender interaktif bergaya *Google Calendar* dengan filter bulan/tahun, status Hadir, Izin, Sakit, dan Jadwal Libur mingguan.
* **Profil & Edit Profil Karyawan**: Terhubung 100% dengan database MySQL (tabel `mst_employee`, `mst_position`, `mst_department`, `mst_bank`, `mst_education_level`).
* **Autentikasi Biometrik WebAuthn**: Dukungan masuk menggunakan Face ID / Touch ID / Fingerprint sidik jari.
* **Pengajuan Cuti & Perizinan**: Formulir pengajuan izin/cuti karyawan beserta unggah dokumen pendukung.
* **Manajemen Berkas Upload Dinamis**: Middleware pengunggahan otomatis yang fleksibel berdasarkan variabel `UPLOAD_BASE_DIR` pada `.env`.

---

## 📂 Struktur Proyek

```
waschen-mobile/
├── api/                        # Backend Express.js
│   ├── config/                 # Konfigurasi koneksi MySQL Pool
│   ├── controllers/            # Controller bisnis (Profile, Auth, Biometrics, dll.)
│   ├── middleware/             # Middleware upload (Multer) & autentikasi
│   ├── routes/                 # Rute REST API Express
│   └── index.js                # Serverless handler (Vercel export)
├── src/                        # Frontend React 18 (Vite)
│   ├── assets/                 # Gambar & logo statis
│   ├── components/             # Komponen UI (Navbar, ConfirmModal, Modal, dll.)
│   ├── pages/                  # Halaman utama (Home, Attendance, History, Leave, Profile, EditProfile)
│   ├── utils/                  # Utility helpers (FormatName, dll.)
│   ├── App.jsx                 # Routing aplikasi & Splash Screen
│   └── main.jsx                # Entry point React
├── agent/                      # Acuan sistem desain & dokumentasi proyek (ReferensiDesign.md)
├── server.js                   # Server backend Express utama
├── vite.config.js              # Konfigurasi Vite & API Proxy
└── package.json                # Dependensi & skrip proyek
```

---

## 🚀 Cara Menjalankan Proyek

### 1. Prasyarat
* **Node.js**: v18.x atau yang lebih baru
* **MySQL Database**: Berjalan di port 3306

### 2. Instalasi Dependensi
```bash
npm install
```

### 3. Konfigurasi File `.env`
Buat file `.env` di direktori akar proyek menggunakan contoh pola variabel berikut:

```env
PORT=9001
NODE_ENV=development
CORS_ORIGIN=http://localhost:9000
SESSION_SECRET=your_session_secret
UPLOAD_BASE_DIR=uploads

# Database MainPool SuperApp
DB_HOST=your_db_host
DB_PORT=3306
DB_USER=your_db_user
DB_PASS=your_db_password
DB_NAME=waschen

# Database My Waschen
DB_HOST_MY_WASCHEN=your_db_host
DB_PORT_MY_WASCHEN=3306
DB_USER_MY_WASCHEN=your_db_user
DB_PASS_MY_WASCHEN=your_db_password
DB_NAME_MY_WASCHEN=my_waschen_prod
```

### 4. Jalankan Mode Development
Jalankan backend (port 9001) dan frontend (port 9000) secara bersamaan:

```bash
npm run dev
```

* **Frontend (React)**: `http://localhost:9000`
* **Backend API (Express)**: `http://localhost:9001`

---

## 📜 Skrip NPM yang Tersedia

| Skrip | Deskripsi |
| :--- | :--- |
| `npm run dev` | Menjalankan server backend & client frontend secara bersamaan |
| `npm run dev:server` | Menjalankan server Express backend saja (dengan nodemon) |
| `npm run dev:client` | Menjalankan dev server Vite frontend saja |
| `npm run build` | Melakukan kompilasi (*bundle build*) aplikasi untuk produksi |
| `npm start` | Menjalankan server Express di lingkungan produksi |
| `npm run preview` | Meninjau (*preview*) hasil kompilasi produksi Vite |

---

## 🛠️ Rute REST API Utama

| Method | Endpoint | Deskripsi |
| :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Autentikasi masuk akun karyawan |
| `GET` | `/api/employee/profile-detail` | Mengambil detail rincian data karyawan dari `mst_employee` |
| `PUT` | `/api/employee/update-profile` | Memperbarui rincian data karyawan di `mst_employee` |
| `GET` | `/api/employee/banks` | Mengambil daftar referensi bank |
| `GET` | `/api/employee/education-levels` | Mengambil daftar referensi tingkat pendidikan |
| `GET` | `/uploads/*` | Mengakses file statis dokumen/foto hasil upload |

---

## 🎨 Sistem Desain & Dokumentasi

Spesifikasi lengkap mengenai sistem desain, warna (`bg-gradient-to-br from-[#210415] via-[#450d2e] to-[#5f1340]`), tipografi, batas layar mobile-first (`max-w-[430px]`), splash screen, navbar, serta aturan penguncian scroll modal dapat dilihat di file acuan:
* [**`agent/ReferensiDesign.md`**](file:///c:/Users/oemar/Music/PT%20Waschen%20Alora%20Indonesia/waschen-mobile/agent/ReferensiDesign.md)

---

## 📄 Lisensi
Hak Cipta © 2026 **PT Waschen Alora Indonesia**. Seluruh Hak Dilindungi Undang-Undang.
