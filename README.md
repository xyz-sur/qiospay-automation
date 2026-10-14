# 💳 QiosPay Automation & QRIS Engine

[![Deploy to Cloudflare Workers](https://github.com/xyz-sur/qiospay-automation/actions/workflows/deploy.yml/badge.svg)](https://github.com/xyz-sur/qiospay-automation/actions/workflows/deploy.yml)
[![Cloudflare Workers](https://img.shields.io/badge/Platform-Cloudflare%20Workers-orange.svg)](https://workers.cloudflare.com)
[![Cloudflare D1](https://img.shields.io/badge/Database-Cloudflare%20D1%20SQLite-blue.svg)](https://developers.cloudflare.com/d1/)
[![Cron Trigger](https://img.shields.io/badge/Cron-Every%2012%20Hours-green.svg)](https://developers.cloudflare.com/workers/configuration/cron-triggers/)

Sistem serverless terintegrasi untuk otomatisasi penarikan saldo QRIS QiosPay setiap 12 jam, eksekusi Host-to-Host (H2H) pembelian saldo DANA penampung, Private API mutasi QRIS bebas limit, serta dilengkapi dengan Web Dashboard (otentikasi OTP Telegram) dan bot controller.

Berjalan 100% serverless di **Cloudflare Workers Global Edge** dengan basis data **Cloudflare D1 (Serverless SQLite)**.

---

## 🌟 Fitur Utama

1. **⏰ Auto-Withdrawal 12 Jam Sekali (Cron Trigger):**
   * Berjalan otomatis via cron expression `0 */12 * * *`.
   * Mengecek saldo QRIS & aplikasi QiosPay terkini.
   * Melakukan validasi: Apakah saldo mencukupi target produk (misal `DANA100` dengan batas harga maksimum `harga_max`)?
   * Jika tidak cukup: Transaksi ditunda otomatis dan laporan dikirim ke Telegram admin.
   * Jika mencukupi: Meng-generate signature OtomaX dan menembak endpoint H2H QiosPay (`https://qiospay.id/api/h2h/trx`) untuk mengisi saldo DANA penampung.

2. **⚡ Private QRIS Mutation Cache API (Bebas Limit):**
   * Server QiosPay menerapkan limitasi polling mutasi QRIS.
   * Worker ini bertindak sebagai penerima webhook callback (`POST /api/callback/qris`) dan menyimpannya secara lokal ke Cloudflare D1.
   * Bot-bot lain dapat memanggil `GET /api/qris/mutasi` setiap detik dengan respon sub-10ms tanpa menyentuh server QiosPay dan tanpa risiko banned/rate limit.

3. **🔁 Dual Callback Forwarding:**
   * Setiap ada mutasi masuk, payload otomatis diduplikasi dan diteruskan ke URL callback kedua (misal: Google Apps Script atau bot lain) secara non-blocking.

4. **🔐 Web Dashboard dengan Login OTP Telegram:**
   * Antarmuka modern bertema dark-mode (Tailwind CSS).
   * Login aman: Admin memasukkan Telegram User ID ➔ sistem mengirim kode OTP 6 digit ke akun Telegram admin ➔ verifikasi session token.
   * Pantau grafik mutasi, status penarikan 12 jam, riwayat transaksi H2H, dan tombol eksekusi manual penarikan saldo.

5. **🤖 Telegram Bot Controller:**
   * `/status` — Memeriksa saldo, target produk, dan konfigurasi saat ini.
   * `/tarik` — Memaksa eksekusi penarikan H2H ke DANA sekarang.
   * `/setdana <nomor>` — Mengubah nomor DANA penampung langsung dari chat Telegram.
   * `/setproduk <kode>` — Mengubah produk target (misal `DANA50`, `DANA100`, `DANA200`).
   * `/autoon` & `/autooff` — Mengaktifkan/menonaktifkan auto-withdraw 12 jam.

---

## 📋 Endpoint API

| Method | Endpoint | Akses | Deskripsi |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/callback/qris` | Publik / QiosPay | Menerima webhook dana masuk QRIS dari QiosPay |
| `GET` | `/api/qris/mutasi` | Publik / Bot Lain | Private API cek mutasi QRIS (query: `refid`, `amount`, `limit`) |
| `POST` | `/api/telegram` | Telegram Webhook | Menangani perintah bot telegram admin |
| `POST` | `/api/auth/request-otp` | Admin | Meminta kode OTP verifikasi ke Telegram |
| `POST` | `/api/auth/verify-otp` | Admin | Memverifikasi OTP dan menerbitkan session token |
| `GET` | `/api/dashboard/stats` | Terotentikasi | Mengambil statistik mutasi dan konfigurasi D1 |
| `POST` | `/api/dashboard/config` | Terotentikasi | Menyimpan konfigurasi produk & nomor tujuan DANA |
| `POST` | `/api/dashboard/trigger-wd` | Terotentikasi | Memicu eksekusi H2H penarikan ke DANA secara manual |
| `GET` | `/` atau `/dashboard` | Publik | Web Dashboard GUI |

---

## 🗄️ Skema Basis Data (Cloudflare D1 SQLite)

```sql
-- 1. Mutasi QRIS
CREATE TABLE IF NOT EXISTS mutations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  refid TEXT UNIQUE,
  amount INTEGER,
  buyer_name TEXT,
  issuer TEXT,
  balance INTEGER,
  type TEXT DEFAULT 'CR',
  date_str TEXT,
  raw_payload TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Konfigurasi
CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- 3. Riwayat Transaksi H2H
CREATE TABLE IF NOT EXISTS h2h_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ref_id TEXT UNIQUE,
  product TEXT,
  dest TEXT,
  amount INTEGER,
  status TEXT,
  message TEXT,
  raw_response TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Sesi OTP
CREATE TABLE IF NOT EXISTS otp_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id TEXT,
  otp_code TEXT,
  expires_at INTEGER,
  token TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🚀 Panduan Deployment

### 1. Inisialisasi Database D1
```bash
npx wrangler d1 create qiospay_automation_db
npx wrangler d1 execute qiospay_automation_db --remote --file=schema.sql
```

### 2. Konfigurasi Secret Enkripsi
```bash
npx wrangler secret put API_KEY          # Qiospay API Key
npx wrangler secret put MEMBER_PIN       # PIN Transaksi H2H
npx wrangler secret put MEMBER_PASSWORD  # Password Akun Qiospay
npx wrangler secret put BOT_TOKEN        # Bot Token Telegram Admin
```

### 3. Deploy ke Cloudflare Workers
```bash
npx wrangler deploy
```

---

## 🔒 Keamanan
* Rumus OtomaX Signature dihitung secara kriptografis menggunakan SHA-1 & Base64 di Edge runtime.
* Tidak ada kredensial sensitif (PIN, Password, API Key) yang disimpan di file publik atau riwayat git.
