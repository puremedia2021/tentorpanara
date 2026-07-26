-- NOTE: ini akan menghapus data uji coba sebelumnya (skema berubah signifikan
-- untuk menambah login, kuota sesi, dan lokasi GPS).
DROP TABLE IF EXISTS sesi;
DROP TABLE IF EXISTS siswa;
DROP TABLE IF EXISTS tentor;
DROP TABLE IF EXISTS paket;
DROP TABLE IF EXISTS tim;
DROP TABLE IF EXISTS sessions;

-- Tim internal (admin) yang mengelola master data dan input sesi
CREATE TABLE tim (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nama TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Paket belajar: menentukan fee tentor per sesi & kuota sesi yang didapat siswa
CREATE TABLE paket (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nama TEXT NOT NULL,
  jenis_belajar TEXT NOT NULL,
  fee_tentor REAL NOT NULL,
  kuota_sesi INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE tentor (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nama TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE siswa (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nama TEXT NOT NULL,
  paket_id INTEGER NOT NULL REFERENCES paket(id),
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  sisa_sesi INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Sesi belajar = satu baris payroll
CREATE TABLE sesi (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tentor_id INTEGER NOT NULL REFERENCES tentor(id),
  siswa_id INTEGER NOT NULL REFERENCES siswa(id),
  tempat TEXT,
  jumlah_peserta INTEGER NOT NULL DEFAULT 1,
  harga REAL NOT NULL,
  total REAL NOT NULL,
  keterangan TEXT,
  foto_tentor TEXT,
  foto_siswa TEXT,
  lat_tentor REAL,
  lng_tentor REAL,
  lat_siswa REAL,
  lng_siswa REAL,
  status_tentor TEXT NOT NULL DEFAULT 'pending',
  status_siswa TEXT NOT NULL DEFAULT 'pending',
  dipotong_kuota INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE sessions (
  token TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_sesi_tentor ON sesi(tentor_id);
CREATE INDEX idx_sesi_siswa ON sesi(siswa_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
