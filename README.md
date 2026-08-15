# Monorepo React + Express Starter

Proyek ini adalah **starter template** untuk aplikasi full-stack dengan **React (Vite)** di frontend dan **Express.js** di backend, dijalankan bersamaan dengan `concurrently`.

## Struktur

```
├── api/              # Backend Express (routes, controllers, models)
├── src/              # Frontend React (components, pages, hooks)
├── public/           # Static assets
├── server.js         # Entry point Express
├── vite.config.js    # Konfigurasi Vite
└── package.json      # Dependencies & scripts
```

## Cara Pakai

```bash
# Clone repository
git clone <repo-url>
cd <project-folder>

# Install dependencies
npm install

# Jalankan development (server + client concurrently)
npm run dev
```

- Frontend: `http://localhost:9000`
- Backend: `http://localhost:9001`

## Scripts

| Script          | Deskripsi                              |
| --------------- | -------------------------------------- |
| `npm run dev`   | Jalankan server & client bersamaan     |
| `npm run dev:server` | Backend saja (nodemon)           |
| `npm run dev:client` | Frontend saja (Vite)             |
| `npm run build` | Build frontend untuk production        |
| `npm start`     | Jalankan server production             |
| `npm run preview` | Preview build Vite                  |

## Ganti Nama Project

Ubah field `"name"` di `package.json` sesuai nama project Anda:

```json
{
  "name": "nama-project-anda"
}
```
