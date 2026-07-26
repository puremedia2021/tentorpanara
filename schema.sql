-- Master data: paket belajar, menentukan fee tentor
CREATE TABLE IF NOT EXISTS paket (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nama TEXT NOT NULL,
  jenis_belajar TEXT NOT NULL,
  fee_tentor REAL NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tentor (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nama TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS siswa (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nama TEXT NOT NULL,
  paket_id INTEGER NOT NULL REFERENCES paket(id),
  created_at TEXT DEFAULT (datetime('now'))
);

-- Sesi belajar = satu baris payroll
CREATE TABLE IF NOT EXISTS sesi (
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
  status_tentor TEXT NOT NULL DEFAULT 'pending',
  status_siswa TEXT NOT NULL DEFAULT 'pending',
  token_tentor TEXT NOT NULL UNIQUE,
  token_siswa TEXT NOT NULL UNIQUE,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sesi_tentor ON sesi(tentor_id);
CREATE INDEX IF NOT EXISTS idx_sesi_siswa ON sesi(siswa_id);
CREATE INDEX IF NOT EXISTS idx_sesi_token_tentor ON sesi(token_tentor);
CREATE INDEX IF NOT EXISTS idx_sesi_token_siswa ON sesi(token_siswa);
