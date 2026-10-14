-- Skema Database Qiospay Automation Engine di Cloudflare D1

-- 1. Tabel Mutasi QRIS (Penyimpanan Lokal untuk Private API bebas limit)
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
CREATE INDEX IF NOT EXISTS idx_mutations_refid ON mutations(refid);
CREATE INDEX IF NOT EXISTS idx_mutations_date ON mutations(created_at);

-- 2. Tabel Konfigurasi Auto-Withdraw & H2H
CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- Inisialisasi default config
INSERT OR IGNORE INTO config (key, value) VALUES ('auto_wd_enabled', '1');
INSERT OR IGNORE INTO config (key, value) VALUES ('dana_dest', '085397538187');
INSERT OR IGNORE INTO config (key, value) VALUES ('target_product', 'DANA100');
INSERT OR IGNORE INTO config (key, value) VALUES ('target_amount', '100000');
INSERT OR IGNORE INTO config (key, value) VALUES ('harga_max', '100500');
INSERT OR IGNORE INTO config (key, value) VALUES ('cron_interval_hours', '12');
INSERT OR IGNORE INTO config (key, value) VALUES ('last_wd_attempt', '0');
INSERT OR IGNORE INTO config (key, value) VALUES ('last_wd_status', 'Belum pernah dieksekusi');

-- 3. Tabel Riwayat Transaksi H2H
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
CREATE INDEX IF NOT EXISTS idx_h2h_ref ON h2h_transactions(ref_id);

-- 4. Tabel Sesi OTP Telegram untuk Web Dashboard
CREATE TABLE IF NOT EXISTS otp_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id TEXT,
  otp_code TEXT,
  expires_at INTEGER,
  token TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_otp_token ON otp_sessions(token);

-- 5. Tabel Tagihan QRIS Dinamis & Kode Unik (Auto-Validation 3 Menit + 1 Menit Grace Period)
CREATE TABLE IF NOT EXISTS qris_invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trx_id TEXT UNIQUE,
  nominal_base INTEGER,
  unique_code INTEGER,
  nominal_total INTEGER,
  qris_string TEXT,
  qr_image_url TEXT,
  user_id TEXT,
  chat_id TEXT,
  status TEXT DEFAULT 'PENDING',
  created_at INTEGER,
  user_expires_at INTEGER,
  grace_expires_at INTEGER,
  paid_at INTEGER,
  paid_refid TEXT,
  buyer_name TEXT
);
CREATE INDEX IF NOT EXISTS idx_qris_inv_total ON qris_invoices(nominal_total);
CREATE INDEX IF NOT EXISTS idx_qris_inv_status ON qris_invoices(status);
CREATE INDEX IF NOT EXISTS idx_qris_inv_trx ON qris_invoices(trx_id);
