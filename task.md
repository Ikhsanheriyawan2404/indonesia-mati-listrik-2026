# ⚡ Task List

### Setup & Config

* [x] Init project dengan Bun
* [x] Setup Hono sebagai framework
* [x] Koneksi PostgreSQL + PostGIS via `postgres.js`
* [x] Koneksi Redis via `ioredis`
* [x] Validasi env via Zod (`config/env.ts`)
* [x] Struktur folder modular by feature (`modules/`, `shared/`, `config/`)

### Database

* [x] Enable ekstensi PostGIS
* [x] Buat tabel `reports` dengan kolom final
* [x] Buat tabel `votes` dengan ENUM `vote_type` (`UP`, `DOWN`)
* [x] Index GIST untuk spatial query (`idx_reports_location`)
* [x] Index partial untuk `is_flagged = false`
* [x] Index composite spatial + active (`idx_reports_location_active`)
* [x] Index `started_at DESC`
* [x] Seeder data random seluruh Indonesia (`src/db/seed.ts`)

### Middleware

* [x] Rate limiter via Redis (`1 request / 1 detik per socket IP`)
* [x] Guest ID middleware — baca `X-Guest-ID` dari header, set ke context (`c.set('guestId')`)

### API Endpoints

* [x] `POST /reports` — buat laporan baru
* [x] `GET /reports?bbox=` — get semua laporan (bbox query)
* [x] `DELETE /reports/:id` — hapus laporan berdasarkan kepemilikan `guest_id`
* [ ] `GET /reports/:id` — detail satu laporan + aggregasi realtime vote count up/down
* [ ] `POST /reports/:id/votes` — upvote / downvote dengan smart toggle & switch logic per `guest_id`

### Business Logic & Integrations

* [x] Refactor & fix status derivation agar presisi (`SCHEDULED`, `HISTORY` via Service threshold)
* [ ] **AI Moderation:** Setup DeepSeek client + logic content moderation async (cek toxicity/relevancy pada `reporter_name` & `description`, auto-flag `is_flagged = true`)
* [ ] **Reverse Geocoding:** Integrasi OpenStreetMap Nominatim API untuk translate koordinat `lat, lng` menjadi nama lokasi manusiawi saat user pasang titik map

---

## Frontend (UI)

### Setup & Config

* [x] Init project React + Vite + TypeScript
* [x] Setup shadcn/ui
* [x] Setup MapLibre GL JS
* [x] Setup Sonner toast (`<Toaster />` di root)
* [x] Setup `utils/guest.js` — generate + simpan UUID ke localStorage
* [x] Setup `utils/api.js` — fetch wrapper dengan `X-Guest-ID` header otomatis

### Map & Interactions

* [x] Full screen map (`width: 100vw`, `height: 100vh`)
* [x] Base tile: OSM Raster dengan global center `[118, -1]` zoom `4.5`
* [x] Load GeoJSON source dengan clustering enabled
* [x] `clusterProperties` untuk hitung `history_count` dan `schedule_count`
* [x] Layer `clusters` (circle dengan majority color rule: biru schedule, merah history)
* [x] Layer `cluster-count` (angka dinamis di tengah cluster)
* [x] Layer `unclustered-point` (circle individual per status)
* [x] Klik cluster → zoom in (`getClusterExpansionZoom`)
* [x] Event `moveend` + debounce 300ms → fetch ulang data by bbox & update source data
* [ ] Klik individual marker → tampilkan popup detail (ambil data dinamis dari `GET /reports/:id`)

### Komponen UI & Interaksi

* [x] `Legend.tsx` — top left, penanda warna merah history & biru schedule
* [x] `ReportModal.tsx` — FAB + Long press map to trigger dialog form tambah laporan
* [ ] Integrasi nama lokasi otomatis hasil reverse geocoding Nominatim di `ReportModal.tsx` (bukan cuma angka koordinat mentah)
* [x] Dynamic Popup Component (saat marker diklik):
* [ ] Tombol interaktif Upvote / Downvote (berubah state warna jika aktif, hit `POST /reports/:id/votes`)
* [ ] Tampilkan jumlah total count vote up dan down secara realtime

---

## Deployment

* [x] Frontend deploy ke Cloudflare Pages
* [x] Backend deploy ke VPS pribadilahh (PostgreSQL, PostGIS, Redis)
* [x] Setup environment variables production

---

## Nice to Have (Post-MVP)

* [ ] Atur aelah bos, gw ngikut

---

posisi tombol tambah kurang bagus bro
cek clustering