# JokiProyek Engineer Tool (nama sementara)

> Status: tahap perencanaan. Repo di-reset dari awal; kode belum ditulis.

Tool pribadi untuk engineer di `coder.jokiproyek.com`: memakai backend yang sama
(login & data tetap dari website aslinya), tapi tampilannya lebih ringkas dan
bisa diotomasi.

## Aturan kerja

- **Hanya request GET** ke API tanpa izin eksplisit dari pemilik akun.
  Request lain (POST/PUT/PATCH/DELETE, mis. kirim/edit bid) wajib izin dulu.
- Token login **tidak pernah** di-commit; simpan di `.env` (`JP_TOKEN=`).
- Beri jeda antar request, jangan spam API.

## Hasil analisa backend

**Frontend:** Next.js (`coder.jokiproyek.com`).
**Backend:** Laravel (PHP 8.3) di belakang Cloudflare, `api.jokiproyek.com`,
dipisah per service/port.

### Login

1. Tombol "Login with Google" → `GET https://api.jokiproyek.com/18081/api/auth/google/redirect?return_url=/bidding`
2. Setelah login, JWT (HS256) disimpan di cookie **`authTokenPlcs`** (berlaku ±24 jam).
3. Semua request API pakai header `Authorization: Bearer <JWT>`.

Karena login hanya lewat Google, tool kita **tidak** login sendiri: token diambil
dari browser (DevTools → Application → Cookies → `authTokenPlcs`) lalu ditempel ke
tool. Saat token kedaluwarsa (API balas 401) tool minta token baru.

### Endpoint (GET, sudah dicoba)

| Service | Endpoint | Isi |
|---|---|---|
| 18081 | `/api/users/profile` | Profil akun |
| 18082 | `/api/jp-teams/completeness` | Status kelengkapan data (HP, Discord, bank) |
| 18082 | `/api/jp-teams/bank/me` | Data rekening |
| 18083 | `/api/bidding/engineer/projects` | Semua proyek "open" untuk di-bid |
| 18083 | `/api/bidding/engineer/projects/detail/{pro_chrg_code}` | Detail 1 proyek: `bidding_status`, `deadline`, `minimum_rate`, `winner_user_id`, `channel_id` (Discord) |
| 18083 | `/api/bidding/engineer/projects/history` | Riwayat bid sendiri (`bid_status`, `bid_rate`, dll.) |
| 18084 | `/api/payouts/engineer/history` | Riwayat pencairan dana |

Halaman website: `/bidding`, `/bidding/<pro_chrg_code>?req=<req_id>`, `/profile`, `/payouts`.

### Field penting di `/bidding/engineer/projects`

`pro_id`, `pro_chrg_code`, `pro_desc`, `bid_desc`, `project_type`, `pro_deadline`
(deadline klien), **`bid_deadline_internal`** (deadline bidding, yang ditampilkan
website sebagai "Deadline"), `request.req_budget`, `request.req_tier`,
`highest_bid`, `is_highest_bid_visible`.

Tidak ada field status di daftar ini. Status ada di endpoint detail
(`bidding_status`), tapi dicek 28-10-2026: **semua 192 proyek "Fleksibel" berstatus
`OPEN`**, termasuk yang dibuat tahun 2025, dan tidak satu pun punya `winner_user_id`.
Jadi `bidding_status` tidak bisa dipakai untuk menyaring proyek basi. Pengganti yang
masuk akal: umur proyek (`request.created_at`) dan/atau deadline klien (`deadline`).

## Masalah: data terlalu banyak

Endpoint proyek mengembalikan **semua 460 proyek sekaligus** (±418 KB JSON),
padahal yang masih bisa di-bid (deadline ≥ hari ini) cuma ±10.

Sudah dicoba filter/paginasi di sisi server (semua GET, semua **diabaikan**,
respons tetap 460 item): `page`, `per_page`, `limit`, `status`, `sort`, `search`,
`q`, `filter[status]`, `from`, `start_date`, `deadline_from`,
`bid_deadline_internal_from`, `active`. Tidak ada endpoint alternatif
(`/projects/open`, `/projects/active`, `/projects/{kode}` → 404).
**Jadi API asli tidak bisa difilter dari awal.**

Tapi ukuran yang benar-benar lewat jaringan cuma **±40 KB** karena gzip, dan
memfilter 460 item butuh kurang dari 1 ms. Yang berat itu kalau setiap buka
halaman atau setiap user mengambil ulang semuanya, plus browser harus
merender 460 kartu.

## Solusi: backend kita yang memfilter & menyimpan

```
API JokiProyek ──(1x per N menit, gzip ±40KB)──► Backend kita (sync job)
                                                   │ filter + simpan
                                                   ▼
                                            DB/cache: ±10 proyek aktif
                                                   │
Frontend kita ◄──────── hanya data yang sudah difilter (beberapa KB)
```

1. **Sync job terjadwal** (mis. tiap 5–10 menit, bukan setiap buka halaman):
   ambil `/bidding/engineer/projects` sekali dengan `Accept-Encoding: gzip`.
2. **Filter di backend** langsung saat sync:
   - `bid_deadline_internal` ≥ hari ini (zona waktu `Asia/Jakarta`)
   - opsional: buang yang sudah di-bid (cocokkan `pro_id:req_id` dengan `/history`)
   - proyek tanpa deadline ("Fleksibel"): hanya yang `request.created_at` ≤ 30 hari terakhir
     (dan `bidding_status` dari endpoint detail = `OPEN`, dicek hanya untuk yang lolos filter umur)
3. **Simpan hanya hasil filter** (SQLite / cache memori) beserta `first_seen_at`.
4. **Frontend** cuma memanggil endpoint kita (`GET /api/projects`) yang langsung
   membaca data tersimpan, jadi cepat dan tidak membebani API asli.
5. **Bonus dari menyimpan snapshot:** bisa mendeteksi proyek **baru**
   (ada di sync sekarang, tidak ada di sync sebelumnya), lalu kirim notifikasi
   (Discord/Telegram/WhatsApp).

## Yang perlu dikonfirmasi

- [x] Proyek "Fleksibel": tampil jika dibuat ≤ 30 hari terakhir (±38 proyek per 28-10-2026)
- [ ] Deadline hari ini: masih ditampilkan (≥ hari ini) atau hanya setelah hari ini (> hari ini)?
- [ ] Sembunyikan proyek yang sudah di-bid?
- [ ] Interval sync & kanal notifikasi proyek baru
- [x] Deploy: Vercel + Next.js, tanpa notifikasi
- [ ] Otomasi tambahan lainnya

## Deploy (keputusan: tanpa notifikasi)

**Vercel (gratis) + Next.js.** Tidak ada cron/DB; data diambil saat halaman dibuka.

```
Browser kita ──token──► Next.js API route (Vercel) ──GET──► api.jokiproyek.com
     ▲                         │ filter + cache ±5 menit
     └──── hanya proyek lolos filter ◄┘
```

- Proxy server tetap perlu: API asli kemungkinan besar hanya mengizinkan CORS dari
  `coder.jokiproyek.com`, jadi browser kita tidak bisa memanggilnya langsung.
- Token (±24 jam) disimpan di browser kita (localStorage), bukan di server/repo.
  API 401 → ambil token baru.

### Login: 1 klik, bukan copy-paste DevTools

Tujuan: user klik tombol "Login with Google" yang sama, token langsung masuk ke app kita.

Kendala (hasil cek 28-10-2026):
- `redirect_uri` ke Google **dikunci** ke `api.jokiproyek.com/.../callback`
  (milik mereka). `return_url` tidak diteruskan ke Google (tanpa `state`, tanpa cookie sesi).
  → Alur Google mereka **tidak bisa** diarahkan mengantar token ke domain kita.
- Tapi cookie `authTokenPlcs` **bukan HttpOnly** (frontend mereka membacanya via JS),
  jadi JavaScript di tab `coder.jokiproyek.com` bisa membacanya.

Solusi (tanpa buka DevTools):
1. **Bookmarklet** (usulan — tanpa instal): user login Google seperti biasa di
   `coder.jokiproyek.com`, lalu klik 1 bookmarklet. Bookmarklet membaca
   `authTokenPlcs` dari `document.cookie` dan mengirimnya ke app kita (lalu app
   simpan di localStorage). Sejak itu app pakai token yang sama (`Authorization: Bearer`).
2. **Browser extension**: ambil cookie otomatis, UX paling mulus, tapi perlu instal.
3. ~~Headless login Google di server~~: ditolak Google (deteksi bot), butuh password
   Google user, rapuh. **Tidak dipakai.**

App kita memakai **sistem token yang sama** persis: menyimpan JWT dan memanggil API
JokiProyek dengan header `Authorization: Bearer <token>`.
- Cache hasil per token ±5 menit supaya ~38 panggilan detail (proyek Fleksibel) tidak
  diulang setiap refresh.
