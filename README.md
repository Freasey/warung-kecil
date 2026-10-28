# Discord Thread Tracker (Next.js)

> Status: tahap perencanaan. Repo ini di-reset dari awal; kode belum ditulis.

## Tujuan

Mengambil semua thread di server Discord yang dibuat admin (kapan saja, acak),
menyaring hanya thread yang berisi **URL unik dari admin**, lalu menampilkannya
di aplikasi Next.js, **diurutkan berdasarkan tanggal pesan terakhir yang
mengandung URL tersebut**.

## Alur

1. Ambil daftar channel/forum yang bisa diakses.
2. Ambil semua thread: aktif + arsip (public, dan private bila punya akses).
3. Untuk tiap thread, baca riwayat pesan dan cari pesan yang mengandung URL target
   (opsional: hanya dari user admin tertentu).
4. Simpan per thread: `id`, `judul`, `link`, `tanggal pesan terakhir berisi URL`.
5. Urutkan menurun berdasarkan tanggal itu dan tampilkan di Next.js.
6. Sinkron berkala (cron) + opsional real-time (event `threadCreate` / `messageCreate`).

## Opsi akses ke Discord

| Opsi | Butuh admin? | Aman (sesuai ToS)? | Catatan |
|---|---|---|---|
| **A. Bot Discord** | Ya, admin harus invite bot | Ya | Cara resmi. Bot perlu izin `View Channel`, `Read Message History`, dan intent `Message Content`. |
| B. Token akun pribadi (self-bot) | Tidak | **Tidak** | Melanggar ToS Discord, risiko akun di-ban. Tidak direkomendasikan. |
| C. Export manual (mis. file JSON) lalu upload ke app | Tidak | Tergantung alat export | Tidak otomatis. |

Rekomendasi: **Opsi A**.

## Rencana teknis (Opsi A)

- Next.js (App Router) + TypeScript
- `discord.js` / Discord REST API v10 di server-side (route handler / cron job)
- Endpoint penting:
  - `GET /guilds/{guild}/threads/active`
  - `GET /channels/{channel}/threads/archived/public`
  - `GET /channels/{channel}/messages?before=…&limit=100` (paginasi)
- Penyimpanan: SQLite / Postgres (mis. via Prisma) supaya tidak scan ulang semua pesan.
- Env: `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`, `TARGET_URL`, `ADMIN_USER_IDS` (opsional).

## Yang perlu dikonfirmasi

- [ ] URL unik yang dicari (persis atau pola/prefix?)
- [ ] Apakah admin bersedia meng-invite bot?
- [ ] Channel/forum mana saja yang dipantau?
- [ ] Hanya pesan dari admin, atau siapa pun yang mengirim URL itu?
- [ ] Otomasi tambahan lainnya
