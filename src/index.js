function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function err(message, status = 400) {
  return json({ error: message }, status);
}

function token() {
  return crypto.randomUUID().replace(/-/g, "");
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

// ---- Paket ----
async function listPaket(env) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM paket ORDER BY id DESC"
  ).all();
  return json(results);
}

async function createPaket(request, env) {
  const b = await readJson(request);
  if (!b.nama || !b.jenis_belajar || b.fee_tentor == null) {
    return err("nama, jenis_belajar, fee_tentor wajib diisi");
  }
  const r = await env.DB.prepare(
    "INSERT INTO paket (nama, jenis_belajar, fee_tentor) VALUES (?, ?, ?)"
  )
    .bind(b.nama, b.jenis_belajar, Number(b.fee_tentor))
    .run();
  return json({ id: r.meta.last_row_id }, 201);
}

// ---- Tentor ----
async function listTentor(env) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM tentor ORDER BY id DESC"
  ).all();
  return json(results);
}

async function createTentor(request, env) {
  const b = await readJson(request);
  if (!b.nama) return err("nama wajib diisi");
  const r = await env.DB.prepare("INSERT INTO tentor (nama) VALUES (?)")
    .bind(b.nama)
    .run();
  return json({ id: r.meta.last_row_id }, 201);
}

// ---- Siswa ----
async function listSiswa(env) {
  const { results } = await env.DB.prepare(
    `SELECT siswa.*, paket.nama AS paket_nama, paket.fee_tentor AS paket_fee
     FROM siswa JOIN paket ON paket.id = siswa.paket_id
     ORDER BY siswa.id DESC`
  ).all();
  return json(results);
}

async function createSiswa(request, env) {
  const b = await readJson(request);
  if (!b.nama || !b.paket_id) return err("nama dan paket_id wajib diisi");
  const r = await env.DB.prepare(
    "INSERT INTO siswa (nama, paket_id) VALUES (?, ?)"
  )
    .bind(b.nama, Number(b.paket_id))
    .run();
  return json({ id: r.meta.last_row_id }, 201);
}

// ---- Sesi ----
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
  if (!siswa) return err("siswa tidak ditemukan", 404);

  const jumlahPeserta = Number(b.jumlah_peserta || 1);
  const harga = siswa.fee_tentor;
  const total = harga * jumlahPeserta;
  const tokenTentor = token();
  const tokenSiswa = token();

  const r = await env.DB.prepare(
    `INSERT INTO sesi
      (tentor_id, siswa_id, tempat, jumlah_peserta, harga, total, keterangan, token_tentor, token_siswa)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      Number(b.tentor_id),
      Number(b.siswa_id),
      b.tempat || "",
      jumlahPeserta,
      harga,
      total,
      b.keterangan || "",
      tokenTentor,
      tokenSiswa
    )
    .run();

  return json(
    {
      id: r.meta.last_row_id,
      total,
      link_tentor: `/approve.html?token=${tokenTentor}`,
      link_siswa: `/approve.html?token=${tokenSiswa}`,
    },
    201
  );
}

// ---- Approval (by token, no login) ----
async function getSesiByToken(env, tok) {
  const sesi = await env.DB.prepare(
    `SELECT sesi.*, tentor.nama AS tentor_nama, siswa.nama AS siswa_nama
     FROM sesi
     JOIN tentor ON tentor.id = sesi.tentor_id
     JOIN siswa ON siswa.id = sesi.siswa_id
     WHERE token_tentor = ? OR token_siswa = ?`
  )
    .bind(tok, tok)
    .first();
  if (!sesi) return null;
  const role = sesi.token_tentor === tok ? "tentor" : "siswa";
  return { sesi, role };
}

async function viewAcc(env, tok) {
  const found = await getSesiByToken(env, tok);
  if (!found) return err("Link tidak valid", 404);
  const { sesi, role } = found;
  return json({
    role,
    tentor_nama: sesi.tentor_nama,
    siswa_nama: sesi.siswa_nama,
    tempat: sesi.tempat,
    jumlah_peserta: sesi.jumlah_peserta,
    harga: sesi.harga,
    total: sesi.total,
    keterangan: sesi.keterangan,
    status: role === "tentor" ? sesi.status_tentor : sesi.status_siswa,
    sudah_ada_foto:
      role === "tentor" ? !!sesi.foto_tentor_key : !!sesi.foto_siswa_key,
  });
}

async function submitAcc(request, env, tok) {
  const found = await getSesiByToken(env, tok);
  if (!found) return err("Link tidak valid", 404);
  const { sesi, role } = found;

  const form = await request.formData();
  const file = form.get("foto");
  if (!file || typeof file === "string") {
    return err("Foto wajib diupload");
  }

  const key = `sesi-${sesi.id}-${role}-${Date.now()}.jpg`;
  await env.PHOTOS.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type || "image/jpeg" },
  });

  if (role === "tentor") {
    await env.DB.prepare(
      "UPDATE sesi SET foto_tentor_key = ?, status_tentor = 'approved' WHERE id = ?"
    )
      .bind(key, sesi.id)
      .run();
  } else {
    await env.DB.prepare(
      "UPDATE sesi SET foto_siswa_key = ?, status_siswa = 'approved' WHERE id = ?"
    )
      .bind(key, sesi.id)
      .run();
  }

  return json({ ok: true });
}

// ---- Foto ----
async function getPhoto(env, key) {
  const obj = await env.PHOTOS.get(key);
  if (!obj) return err("Foto tidak ditemukan", 404);
  return new Response(obj.body, {
    headers: {
      "content-type": obj.httpMetadata?.contentType || "image/jpeg",
    },
  });
}

// ---- Rekap payroll ----
async function rekap(env, url) {
  const tentorId = url.searchParams.get("tentor_id");
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
      if (pathname === "/api/paket" && method === "GET") return listPaket(env);
      if (pathname === "/api/paket" && method === "POST")
        return createPaket(request, env);

      if (pathname === "/api/tentor" && method === "GET") return listTentor(env);
      if (pathname === "/api/tentor" && method === "POST")
        return createTentor(request, env);

      if (pathname === "/api/siswa" && method === "GET") return listSiswa(env);
      if (pathname === "/api/siswa" && method === "POST")
        return createSiswa(request, env);

      if (pathname === "/api/sesi" && method === "GET") return listSesi(env, url);
      if (pathname === "/api/sesi" && method === "POST")
        return createSesi(request, env);

      if (pathname === "/api/rekap" && method === "GET") return rekap(env, url);

      const accMatch = pathname.match(/^\/api\/acc\/([a-f0-9]+)$/);
      if (accMatch && method === "GET") return viewAcc(env, accMatch[1]);
      if (accMatch && method === "POST") return submitAcc(request, env, accMatch[1]);

      const photoMatch = pathname.match(/^\/api\/photo\/(.+)$/);
      if (photoMatch && method === "GET") return getPhoto(env, photoMatch[1]);

      return err("Not found", 404);
    } catch (e) {
      return err(e.message || "Server error", 500);
    }
  },
};
