function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function err(message, status = 400) {
  return json({ error: message }, status);
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

// ---- Crypto helpers ----
function bytesToHex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex) {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) arr[i] = parseInt(hex.substr(i * 2, 2), 16);
  return arr;
}

function randomHex(numBytes = 16) {
  const arr = new Uint8Array(numBytes);
  crypto.getRandomValues(arr);
  return bytesToHex(arr);
}

async function hashPassword(password, saltHex) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: hexToBytes(saltHex), iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return bytesToHex(new Uint8Array(bits));
}

// ---- Cookies / sessions ----
function parseCookies(request) {
  const header = request.headers.get("Cookie") || "";
  const cookies = {};
  header.split(";").forEach((pair) => {
    const idx = pair.indexOf("=");
    if (idx === -1) return;
    cookies[pair.slice(0, idx).trim()] = decodeURIComponent(pair.slice(idx + 1).trim());
  });
  return cookies;
}

function setSessionCookieHeader(token) {
  return { "Set-Cookie": `session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}` };
}

function clearSessionCookieHeader() {
  return { "Set-Cookie": `session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0` };
}

async function getSession(request, env) {
  const cookies = parseCookies(request);
  const token = cookies.session;
  if (!token) return null;
  const row = await env.DB.prepare("SELECT * FROM sessions WHERE token = ?").bind(token).first();
  if (!row) return null;
  if (new Date(row.expires_at) < new Date()) return null;
  return { token: row.token, role: row.role, userId: row.user_id };
}

// ---- Auth ----
async function login(request, env) {
  const b = await readJson(request);
  const { role, username, password } = b;
  if (!["tim", "tentor", "siswa"].includes(role)) return err("Role tidak valid");
  if (!username || !password) return err("Username dan password wajib diisi");

  const user = await env.DB.prepare(`SELECT * FROM ${role} WHERE username = ?`)
    .bind(username)
    .first();
  if (!user) return err("Username atau password salah", 401);

  const hash = await hashPassword(password, user.salt);
  if (hash !== user.password_hash) return err("Username atau password salah", 401);

  const token = randomHex(24);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await env.DB.prepare(
    "INSERT INTO sessions (token, role, user_id, expires_at) VALUES (?, ?, ?, ?)"
  )
    .bind(token, role, user.id, expiresAt)
    .run();

  return json({ role, id: user.id, nama: user.nama }, 200, setSessionCookieHeader(token));
}

async function logout(request, env) {
  const cookies = parseCookies(request);
  if (cookies.session) {
    await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(cookies.session).run();
  }
  return json({ ok: true }, 200, clearSessionCookieHeader());
}

async function me(request, env) {
  const session = await getSession(request, env);
  if (!session) return err("Belum login", 401);
  const user = await env.DB.prepare(`SELECT id, nama FROM ${session.role} WHERE id = ?`)
    .bind(session.userId)
    .first();
  if (!user) return err("Belum login", 401);
  return json({ role: session.role, id: user.id, nama: user.nama });
}

async function setupTim(request, env) {
  const count = await env.DB.prepare("SELECT COUNT(*) AS c FROM tim").first();
  if (count.c > 0) return err("Setup awal sudah pernah dilakukan", 403);
  const b = await readJson(request);
  if (!b.nama || !b.username || !b.password) return err("nama, username, password wajib diisi");
  const salt = randomHex(16);
  const hash = await hashPassword(b.password, salt);
  const r = await env.DB.prepare(
    "INSERT INTO tim (nama, username, password_hash, salt) VALUES (?, ?, ?, ?)"
  )
    .bind(b.nama, b.username, hash, salt)
    .run();
  return json({ id: r.meta.last_row_id }, 201);
}

// ---- Paket ----
async function listPaket(env) {
  const { results } = await env.DB.prepare("SELECT * FROM paket ORDER BY id DESC").all();
  return json(results);
}

async function createPaket(request, env) {
  const b = await readJson(request);
  if (!b.nama || !b.jenis_belajar || b.fee_tentor == null || b.kuota_sesi == null) {
    return err("nama, jenis_belajar, fee_tentor, kuota_sesi wajib diisi");
  }
  const r = await env.DB.prepare(
    "INSERT INTO paket (nama, jenis_belajar, fee_tentor, kuota_sesi) VALUES (?, ?, ?, ?)"
  )
    .bind(b.nama, b.jenis_belajar, Number(b.fee_tentor), Number(b.kuota_sesi))
    .run();
  return json({ id: r.meta.last_row_id }, 201);
}

// ---- Tentor ----
async function listTentor(env) {
  const { results } = await env.DB.prepare(
    "SELECT id, nama, username, created_at FROM tentor ORDER BY id DESC"
  ).all();
  return json(results);
}

async function createTentor(request, env) {
  const b = await readJson(request);
  if (!b.nama || !b.username || !b.password) return err("nama, username, password wajib diisi");
  const salt = randomHex(16);
  const hash = await hashPassword(b.password, salt);
  try {
    const r = await env.DB.prepare(
      "INSERT INTO tentor (nama, username, password_hash, salt) VALUES (?, ?, ?, ?)"
    )
      .bind(b.nama, b.username, hash, salt)
      .run();
    return json({ id: r.meta.last_row_id }, 201);
  } catch {
    return err("Username sudah dipakai", 409);
  }
}

// ---- Siswa ----
async function listSiswa(env) {
  const { results } = await env.DB.prepare(
    `SELECT siswa.id, siswa.nama, siswa.username, siswa.sisa_sesi, siswa.created_at,
            paket.nama AS paket_nama, paket.fee_tentor AS paket_fee, paket.jenis_belajar
     FROM siswa JOIN paket ON paket.id = siswa.paket_id
     ORDER BY siswa.id DESC`
  ).all();
  return json(results);
}

async function createSiswa(request, env) {
  const b = await readJson(request);
  if (!b.nama || !b.paket_id || !b.username || !b.password) {
    return err("nama, paket_id, username, password wajib diisi");
  }
  const paket = await env.DB.prepare("SELECT kuota_sesi FROM paket WHERE id = ?")
    .bind(Number(b.paket_id))
    .first();
  if (!paket) return err("Paket tidak ditemukan", 404);

  const salt = randomHex(16);
  const hash = await hashPassword(b.password, salt);
  try {
    const r = await env.DB.prepare(
      "INSERT INTO siswa (nama, paket_id, username, password_hash, salt, sisa_sesi) VALUES (?, ?, ?, ?, ?, ?)"
    )
      .bind(b.nama, Number(b.paket_id), b.username, hash, salt, paket.kuota_sesi)
      .run();
    return json({ id: r.meta.last_row_id }, 201);
  } catch {
    return err("Username sudah dipakai", 409);
  }
}

// ---- Sesi (Tim) ----
async function listSesi(env, url) {
  const status = url.searchParams.get("status");
  let query = `
    SELECT sesi.*, tentor.nama AS tentor_nama, siswa.nama AS siswa_nama
    FROM sesi
    JOIN tentor ON tentor.id = sesi.tentor_id
    JOIN siswa ON siswa.id = sesi.siswa_id`;
  if (status === "pending") {
    query += " WHERE sesi.status_tentor != 'approved' OR sesi.status_siswa != 'approved'";
  } else if (status === "approved") {
    query += " WHERE sesi.status_tentor = 'approved' AND sesi.status_siswa = 'approved'";
  }
  query += " ORDER BY sesi.id DESC";
  const { results } = await env.DB.prepare(query).all();
  return json(results);
}

async function createSesi(request, env) {
  const b = await readJson(request);
  if (!b.tentor_id || !b.siswa_id) {
    return err("tentor_id dan siswa_id wajib diisi");
  }
  const siswa = await env.DB.prepare(
    `SELECT siswa.id, paket.fee_tentor
     FROM siswa JOIN paket ON paket.id = siswa.paket_id
     WHERE siswa.id = ?`
  )
    .bind(Number(b.siswa_id))
    .first();
  if (!siswa) return err("Siswa tidak ditemukan", 404);

  const jumlahPeserta = Number(b.jumlah_peserta || 1);
  const harga = siswa.fee_tentor;
  const total = harga * jumlahPeserta;

  const r = await env.DB.prepare(
    `INSERT INTO sesi (tentor_id, siswa_id, tempat, jumlah_peserta, harga, total, keterangan)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      Number(b.tentor_id),
      Number(b.siswa_id),
      b.tempat || "",
      jumlahPeserta,
      harga,
      total,
      b.keterangan || ""
    )
    .run();

  return json({ id: r.meta.last_row_id, total }, 201);
}

// ---- Sesi milik saya (Tentor / Siswa) ----
async function listSesiSaya(env, session) {
  const col = session.role === "tentor" ? "tentor_id" : "siswa_id";
  const { results } = await env.DB.prepare(
    `SELECT sesi.*, tentor.nama AS tentor_nama, siswa.nama AS siswa_nama
     FROM sesi
     JOIN tentor ON tentor.id = sesi.tentor_id
     JOIN siswa ON siswa.id = sesi.siswa_id
     WHERE sesi.${col} = ?
     ORDER BY sesi.id DESC`
  )
    .bind(session.userId)
    .all();
  return json(results);
}

async function accSesi(request, env, session, sesiId) {
  if (!["tentor", "siswa"].includes(session.role)) return err("Tidak punya akses", 403);
  const sesi = await env.DB.prepare("SELECT * FROM sesi WHERE id = ?").bind(Number(sesiId)).first();
  if (!sesi) return err("Sesi tidak ditemukan", 404);

  const ownerCol = session.role === "tentor" ? "tentor_id" : "siswa_id";
  if (sesi[ownerCol] !== session.userId) return err("Bukan sesi Anda", 403);

  const b = await readJson(request);
  if (!b.foto || typeof b.foto !== "string" || !b.foto.startsWith("data:image/")) {
    return err("Foto wajib diupload");
  }
  if (b.foto.length > 900_000) return err("Ukuran foto terlalu besar, coba lagi");

  const lat = b.lat != null ? Number(b.lat) : null;
  const lng = b.lng != null ? Number(b.lng) : null;

  if (session.role === "tentor") {
    await env.DB.prepare(
      "UPDATE sesi SET foto_tentor = ?, lat_tentor = ?, lng_tentor = ?, status_tentor = 'approved' WHERE id = ?"
    )
      .bind(b.foto, lat, lng, sesi.id)
      .run();
  } else {
    await env.DB.prepare(
      "UPDATE sesi SET foto_siswa = ?, lat_siswa = ?, lng_siswa = ?, status_siswa = 'approved' WHERE id = ?"
    )
      .bind(b.foto, lat, lng, sesi.id)
      .run();
  }

  const updated = await env.DB.prepare("SELECT * FROM sesi WHERE id = ?").bind(sesi.id).first();
  if (
    updated.status_tentor === "approved" &&
    updated.status_siswa === "approved" &&
    !updated.dipotong_kuota
  ) {
    await env.DB.prepare("UPDATE siswa SET sisa_sesi = sisa_sesi - 1 WHERE id = ?")
      .bind(updated.siswa_id)
      .run();
    await env.DB.prepare("UPDATE sesi SET dipotong_kuota = 1 WHERE id = ?")
      .bind(updated.id)
      .run();
  }

  return json({ ok: true });
}

// ---- Foto ----
async function getFoto(env, sesiId, role) {
  const col = role === "tentor" ? "foto_tentor" : "foto_siswa";
  const row = await env.DB.prepare(`SELECT ${col} AS foto FROM sesi WHERE id = ?`)
    .bind(Number(sesiId))
    .first();
  if (!row || !row.foto) return err("Foto tidak ditemukan", 404);
  const match = row.foto.match(/^data:(.+);base64,(.*)$/);
  if (!match) return err("Format foto tidak valid", 500);
  const [, contentType, base64] = match;
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return new Response(bytes, { headers: { "content-type": contentType || "image/jpeg" } });
}

// ---- Rekap payroll ----
async function rekap(env, url, session) {
  let tentorId = url.searchParams.get("tentor_id");
  if (session.role === "tentor") tentorId = session.userId;

  let query = `
    SELECT sesi.*, tentor.nama AS tentor_nama, siswa.nama AS siswa_nama
    FROM sesi
    JOIN tentor ON tentor.id = sesi.tentor_id
    JOIN siswa ON siswa.id = sesi.siswa_id
    WHERE sesi.status_tentor = 'approved' AND sesi.status_siswa = 'approved'`;
  const binds = [];
  if (tentorId) {
    query += " AND sesi.tentor_id = ?";
    binds.push(Number(tentorId));
  }
  query += " ORDER BY sesi.tentor_id, sesi.id DESC";
  const { results } = await env.DB.prepare(query)
    .bind(...binds)
    .all();

  const perTentor = {};
  for (const row of results) {
    if (!perTentor[row.tentor_id]) {
      perTentor[row.tentor_id] = { tentor_nama: row.tentor_nama, total: 0, sesi: [] };
    }
    perTentor[row.tentor_id].total += row.total;
    perTentor[row.tentor_id].sesi.push(row);
  }
  return json(Object.values(perTentor));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;

    try {
      if (!pathname.startsWith("/api/")) {
        return env.ASSETS.fetch(request);
      }

      if (pathname === "/api/login" && method === "POST") return login(request, env);
      if (pathname === "/api/logout" && method === "POST") return logout(request, env);
      if (pathname === "/api/me" && method === "GET") return me(request, env);
      if (pathname === "/api/setup-tim" && method === "POST") return setupTim(request, env);

      const session = await getSession(request, env);

      if (pathname === "/api/paket" && method === "GET") {
        if (!session) return err("Belum login", 401);
        return listPaket(env);
      }
      if (pathname === "/api/paket" && method === "POST") {
        if (!session || session.role !== "tim") return err("Tidak punya akses", 403);
        return createPaket(request, env);
      }

      if (pathname === "/api/tentor" && method === "GET") {
        if (!session) return err("Belum login", 401);
        return listTentor(env);
      }
      if (pathname === "/api/tentor" && method === "POST") {
        if (!session || session.role !== "tim") return err("Tidak punya akses", 403);
        return createTentor(request, env);
      }

      if (pathname === "/api/siswa" && method === "GET") {
        if (!session) return err("Belum login", 401);
        return listSiswa(env);
      }
      if (pathname === "/api/siswa" && method === "POST") {
        if (!session || session.role !== "tim") return err("Tidak punya akses", 403);
        return createSiswa(request, env);
      }

      if (pathname === "/api/sesi" && method === "GET") {
        if (!session || session.role !== "tim") return err("Tidak punya akses", 403);
        return listSesi(env, url);
      }
      if (pathname === "/api/sesi" && method === "POST") {
        if (!session || session.role !== "tim") return err("Tidak punya akses", 403);
        return createSesi(request, env);
      }

      if (pathname === "/api/sesi-saya" && method === "GET") {
        if (!session || !["tentor", "siswa"].includes(session.role)) {
          return err("Tidak punya akses", 403);
        }
        return listSesiSaya(env, session);
      }

      const accMatch = pathname.match(/^\/api\/sesi\/(\d+)\/acc$/);
      if (accMatch && method === "POST") {
        if (!session) return err("Belum login", 401);
        return accSesi(request, env, session, accMatch[1]);
      }

      if (pathname === "/api/rekap" && method === "GET") {
        if (!session || !["tim", "tentor"].includes(session.role)) {
          return err("Tidak punya akses", 403);
        }
        return rekap(env, url, session);
      }

      const fotoMatch = pathname.match(/^\/api\/foto\/(\d+)\/(tentor|siswa)$/);
      if (fotoMatch && method === "GET") {
        if (!session) return err("Belum login", 401);
        return getFoto(env, fotoMatch[1], fotoMatch[2]);
      }

      return err("Not found", 404);
    } catch (e) {
      return err(e.message || "Server error", 500);
    }
  },
};
