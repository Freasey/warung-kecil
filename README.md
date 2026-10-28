# Otomasi Website (nama sementara)

> Status: tahap perencanaan. Repo di-reset dari awal; kode belum ditulis.

## Tujuan

Membuat website/tool sendiri yang memakai **backend website target** (cara login
dan ambil data tetap sama seperti di website aslinya), supaya alur kerja yang
sekarang lambat/kurang efisien bisa diotomasi.

## Pendekatan

1. **Analisa backend website target**
   - Buka website di browser → DevTools → tab **Network** (filter `Fetch/XHR`).
   - Lakukan login dan ambil data seperti biasa, lalu **Export HAR**.
   - Catat: endpoint login, cara sesi disimpan (cookie / token Bearer / CSRF),
     endpoint data, parameter, paginasi, dan format respons (JSON/HTML).
2. **Pilih cara akses**

   | Opsi | Kapan dipakai | Catatan |
   |---|---|---|
   | **A. Panggil API langsung (HTTP)** | Website memakai API JSON / form biasa | Paling cepat & ringan. Login → simpan cookie/token → panggil endpoint data. |
   | B. Otomasi browser (Playwright) | Ada captcha, JS rumit, token yang di-generate di browser | Lebih lambat, tapi pasti jalan seperti user biasa. |
   | C. Gabungan | Login via browser, ambil data via API | Sering paling praktis. |

3. **Bangun tool sendiri** di atas endpoint tersebut (UI ringkas + tombol/
   jadwal otomatis, export data, dsb).

## Batasan & etika

- Hanya untuk akun dan data yang memang kita punya akses resminya.
- Cek Syarat & Ketentuan website target soal otomasi/scraping.
- Jangan bypass captcha / proteksi keamanan; beri jeda antar request (rate limit).
- Kredensial disimpan di `.env`, **tidak** di-commit.

## Yang perlu dikonfirmasi

- [ ] URL website target
- [ ] Alur yang mau diotomasi (langkah demi langkah seperti dikerjakan manual)
- [ ] Data apa yang diambil & mau dipakai untuk apa (tampil, export Excel, dll.)
- [ ] Jenis login (username/password, OTP, captcha, SSO?)
- [ ] File HAR / contoh request dari tab Network (hapus password/token sebelum dibagikan)
- [ ] Otomasi tambahan lainnya
