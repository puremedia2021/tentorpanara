const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-callback-token, x-callback-signature, x-duitku-signature",
  "Access-Control-Max-Age": "86400",
};

const jsonRes = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const APP_NAME = "cloudmember";
const APP_VERSION = "1.0.58";
const APP_RELEASE_DATE = "2026-06-20";
const DEFAULT_INSTALLATION_MODE = "master";
const D1_SCHEMA_VERSION = "2026-07-27-affiliate-coupons";

function slugify(name) {
  return String(name || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "kategori";
}

async function generateUniqueCategorySlug(env, name) {
  const base = slugify(name);
  let candidate = base;
  let n = 2;
  while (await env.DB.prepare("SELECT id FROM categories WHERE slug = ?").bind(candidate).first()) {
    candidate = `${base}-${n}`;
    n++;
  }
  return candidate;
}

const noCacheHtmlHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  "Pragma": "no-cache",
  "Expires": "0"
};

function htmlHeaders(extra = {}) {
  return { "Content-Type": "text/html;charset=utf-8", ...noCacheHtmlHeaders, ...extra };
}

function isHtmlRoute(pathname = "/") {
  const cleanPath = pathname || "/";
  const lastSegment = cleanPath.split("/").pop() || "";
  return cleanPath === "/" || cleanPath.endsWith(".html") || !lastSegment.includes(".");
}

function withNoCacheHtml(request, response) {
  if (!response || response.status !== 200) return response;
  const contentType = String(response.headers.get("Content-Type") || "").toLowerCase();
  const pathname = new URL(request.url).pathname;
  if (!contentType.includes("text/html") && !isHtmlRoute(pathname)) return response;

  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(noCacheHtmlHeaders)) headers.set(key, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

const ADMIN_ACTIONS = new Set([
  "get_admin_data",
  "update_order_status",
  "delete_order",
  "save_product",
  "bulk_save_products",
  "save_coupon",
  "delete_coupon",
  "delete_product",
  "bulk_delete_products",
  "save_page",
  "delete_page",
  "update_settings",
  "update_admin_access",
  "purge_cf_cache",
  "takeover_domain",
  "get_ik_auth",
  "reset_commission",
  "save_lms_materi",
  "import_youtube_playlist",
  "reset_license_domain",
  "preview_blast_targets",
  "send_blast_batch",
  "test_wa_gateway",
  "test_meta_capi",
  "sync_meta_purchases",
  "bulk_edit_products",
  "bulk_grant_access",
  "save_category",
  "delete_category",
  "reorder_categories",
  "get_sub_admins",
  "set_user_permissions",
]);

// Hanya role Admin (super admin) yang bisa akses — tidak bisa di-grant ke sub-admin
const ADMIN_ONLY_ACTIONS = new Set([
  "update_settings",
  "update_admin_access",
  "purge_cf_cache",
  "takeover_domain",
  "test_wa_gateway",
  "test_meta_capi",
  "sync_meta_purchases",
  "reset_license_domain",
  "activate_client_license",
  "check_client_license",
  "self_reset_client_domain",
  "get_sub_admins",
  "set_user_permissions",
]);

// Mapping action → permission yang diperlukan (untuk sub-admin)
const ACTION_PERMISSION_MAP = {
  "update_order_status":    "dashboard.manage_orders",
  "delete_order":           "dashboard.manage_orders",
  "preview_blast_targets":  "blast.view",
  "send_blast_batch":       "blast.send",
  "save_product":           "products.manage",
  "bulk_save_products":     "products.manage",
  "bulk_edit_products":     "products.manage",
  "delete_product":         "products.manage",
  "bulk_delete_products":   "products.manage",
  "save_category":          "products.manage",
  "delete_category":        "products.manage",
  "reorder_categories":     "products.manage",
  "save_coupon":            "coupons.manage",
  "delete_coupon":          "coupons.manage",
  "reset_commission":       "affiliate.reset",
  "save_lms_materi":        "lms.manage",
  "import_youtube_playlist":"lms.manage",
  "bulk_grant_access":      "access.grant",
  "get_ik_auth":            "media.upload",
  // save_page & delete_page → dicek dinamis berdasarkan page_type
};

const PRE_ACTIVATION_ACTIONS = new Set([
  "get_global_settings",
  "check_master_update",
  "activate_client_license",
  "check_client_license",
  "self_reset_client_domain"
]);

const PUBLIC_SETTING_KEYS = new Set([
  "site_url",
  "site_name",
  "site_tagline",
  "site_headline",
  "site_address",
  "site_logo",
  "site_favicon",
  "theme_color",
  "theme_color_1",
  "theme_color_2",
  "wa_admin",
  "mail_sender_email",
  "ga_id",
  "meta_pixel_id",
  "meta_currency",
  "currency",
  "enable_social_proof",
  "is_manual_active",
  "auto_gateway",
  "duitku_enabled_channels",
  "tripay_enabled_channels",
  "xendit_enabled_channels",
  "duitku_merchant_name",
  "duitku_env",
  "tripay_merchant_name",
  "tripay_env",
  "xendit_merchant_name",
  "bank_name",
  "bank_norek",
  "bank_owner",
  "bank_name_2",
  "bank_norek_2",
  "bank_owner_2",
  "bank_name_3",
  "bank_norek_3",
  "bank_owner_3",
  "qris_image_url",
  "qris_owner_name",
  "footer_links",
  "catalog_per_page",
  "show_hero_section",
  "checkout_akun_desc",
  "checkout_akun_desc_text"
]);

function getPublicSettings(settings = {}) {
  const safe = {};
  for (const key of PUBLIC_SETTING_KEYS) {
    if (settings[key] !== undefined) safe[key] = settings[key];
  }
  safe.app_name = APP_NAME;
  safe.app_version = APP_VERSION;
  safe.app_release_date = APP_RELEASE_DATE;
  return safe;
}

function normalizeBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function normalizeDomainValue(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
    .trim();
}

function getInstallationMode(env, settings = {}) {
  return String(env.INSTALLATION_MODE || settings.installation_mode || DEFAULT_INSTALLATION_MODE).trim().toLowerCase();
}

function isBuyerInstallation(env, settings = {}) {
  return getInstallationMode(env, settings) === "buyer";
}

function isLicenseActive(settings = {}) {
  return String(settings.license_status || "").trim().toLowerCase() === "active" && String(settings.license_key || "").trim() !== "";
}

function isInstallAllowedPath(path) {
  const cleanPath = path || "";
  return cleanPath === "/install" ||
    cleanPath === "/install.html" ||
    cleanPath === "/config.js" ||
    cleanPath === "/version.json" ||
    cleanPath === "/favicon.ico" ||
    cleanPath === "/__cloudmember/health" ||
    cleanPath === "/__cloudmember/version";
}

function compareVersions(a, b) {
  const pa = String(a || "0").split(".").map(n => parseInt(n, 10) || 0);
  const pb = String(b || "0").split(".").map(n => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
}

async function saveSettings(env, payload = {}) {
  for (const [key, value] of Object.entries(payload)) {
    await env.DB.prepare("INSERT OR REPLACE INTO settings (kunci, nilai) VALUES (?, ?)").bind(key, String(value || "")).run();
  }
}

const D1_SCHEMA = {
  settings: {
    create: `CREATE TABLE IF NOT EXISTS settings (
      kunci TEXT PRIMARY KEY,
      nilai TEXT
    )`,
    columns: [
      ["kunci", "TEXT"],
      ["nilai", "TEXT"]
    ]
  },
  users: {
    create: `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_user TEXT UNIQUE,
      email TEXT UNIQUE,
      password TEXT,
      nama TEXT,
      role TEXT DEFAULT 'member',
      tanggal_daftar TEXT,
      whatsapp TEXT,
      affiliate TEXT,
      rekening TEXT,
      info_rekening TEXT
    )`,
    columns: [
      ["id", "INTEGER"],
      ["id_user", "TEXT"],
      ["email", "TEXT"],
      ["password", "TEXT"],
      ["nama", "TEXT"],
      ["role", "TEXT DEFAULT 'member'"],
      ["tanggal_daftar", "TEXT"],
      ["whatsapp", "TEXT"],
      ["affiliate", "TEXT"],
      ["rekening", "TEXT"],
      ["info_rekening", "TEXT"]
    ]
  },
  access_rules: {
    create: `CREATE TABLE IF NOT EXISTS access_rules (
      id_produk TEXT PRIMARY KEY,
      title TEXT,
      "desc" TEXT,
      deskripsi TEXT,
      url_akses TEXT,
      url TEXT,
      harga REAL DEFAULT 0,
      status TEXT DEFAULT 'Active',
      lp_url TEXT,
      komisi REAL DEFAULT 0,
      komisi_l2 REAL DEFAULT 0,
      komisi_l3 REAL DEFAULT 0,
      affiliate_wajib_beli INTEGER DEFAULT 0,
      bump_status TEXT DEFAULT 'Inactive',
      bump_title TEXT,
      bump_price REAL DEFAULT 0,
      bump_desc TEXT,
      bump_url TEXT,
      bump_items TEXT DEFAULT '[]',
      gambar TEXT,
      kategori TEXT DEFAULT 'Umum',
      category_id INTEGER,
      harga_coret REAL DEFAULT 0,
      pdf_drive_id TEXT,
      ga_id TEXT,
      meta_pixel_id TEXT,
      webhook_url TEXT,
      is_featured INTEGER DEFAULT 0,
      panara_paket_id TEXT,
      parent_product_id TEXT,
      gambar_list TEXT DEFAULT '[]',
      category_ids TEXT DEFAULT '[]',
      access_list TEXT DEFAULT '[]'
    )`,
    columns: [
      ["id_produk", "TEXT"],
      ["title", "TEXT"],
      ['"desc"', "TEXT"],
      ["deskripsi", "TEXT"],
      ["url_akses", "TEXT"],
      ["url", "TEXT"],
      ["harga", "REAL DEFAULT 0"],
      ["status", "TEXT DEFAULT 'Active'"],
      ["lp_url", "TEXT"],
      ["komisi", "REAL DEFAULT 0"],
      ["komisi_l2", "REAL DEFAULT 0"],
      ["komisi_l3", "REAL DEFAULT 0"],
      ["affiliate_wajib_beli", "INTEGER DEFAULT 0"],
      ["bump_status", "TEXT DEFAULT 'Inactive'"],
      ["bump_title", "TEXT"],
      ["bump_price", "REAL DEFAULT 0"],
      ["bump_desc", "TEXT"],
      ["bump_url", "TEXT"],
      ["bump_items", "TEXT DEFAULT '[]'"],
      ["gambar", "TEXT"],
      ["kategori", "TEXT DEFAULT 'Umum'"],
      ["category_id", "INTEGER"],
      ["harga_coret", "REAL DEFAULT 0"],
      ["pdf_drive_id", "TEXT"],
      ["ga_id", "TEXT"],
      ["meta_pixel_id", "TEXT"],
      ["webhook_url", "TEXT"],
      ["is_featured", "INTEGER DEFAULT 0"],
      ["panara_paket_id", "TEXT"],
      ["parent_product_id", "TEXT"],
      ["gambar_list", "TEXT DEFAULT '[]'"],
      ["category_ids", "TEXT DEFAULT '[]'"],
      ["access_list", "TEXT DEFAULT '[]'"]
    ]
  },
  orders: {
    create: `CREATE TABLE IF NOT EXISTS orders (
      invoice TEXT PRIMARY KEY,
      email TEXT,
      nama TEXT,
      whatsapp TEXT,
      id_produk TEXT,
      nama_produk TEXT,
      harga_total REAL DEFAULT 0,
      status TEXT DEFAULT 'Pending',
      tanggal_order TEXT,
      affiliate TEXT,
      komisi REAL DEFAULT 0,
      affiliate_l1 TEXT,
      affiliate_l2 TEXT,
      affiliate_l3 TEXT,
      komisi_l1 REAL DEFAULT 0,
      komisi_l2 REAL DEFAULT 0,
      komisi_l3 REAL DEFAULT 0,
      reminder_level INTEGER DEFAULT 0,
      take_bump TEXT,
      bump_selected TEXT,
      license_key TEXT,
      payment_method TEXT,
      payment_channel TEXT,
      payment_name TEXT,
      payment_code TEXT,
      payment_owner TEXT,
      payment_url TEXT,
      payment_qr_url TEXT,
      payment_instruction TEXT,
      domain TEXT,
      meta_fbp TEXT,
      meta_fbc TEXT,
      meta_client_ip TEXT,
      meta_user_agent TEXT,
      meta_purchase_sent TEXT,
      meta_purchase_prod_sent TEXT,
      meta_purchase_test_sent TEXT,
      meta_purchase_last_error TEXT,
      meta_purchase_events_received INTEGER DEFAULT 0,
      meta_purchase_fbtrace_id TEXT,
      meta_purchase_last_attempt TEXT,
      kode_promo TEXT
    )`,
    columns: [
      ["invoice", "TEXT"],
      ["email", "TEXT"],
      ["nama", "TEXT"],
      ["whatsapp", "TEXT"],
      ["id_produk", "TEXT"],
      ["nama_produk", "TEXT"],
      ["harga_total", "REAL DEFAULT 0"],
      ["status", "TEXT DEFAULT 'Pending'"],
      ["tanggal_order", "TEXT"],
      ["affiliate", "TEXT"],
      ["komisi", "REAL DEFAULT 0"],
      ["affiliate_l1", "TEXT"],
      ["affiliate_l2", "TEXT"],
      ["affiliate_l3", "TEXT"],
      ["komisi_l1", "REAL DEFAULT 0"],
      ["komisi_l2", "REAL DEFAULT 0"],
      ["komisi_l3", "REAL DEFAULT 0"],
      ["reminder_level", "INTEGER DEFAULT 0"],
      ["take_bump", "TEXT"],
      ["bump_selected", "TEXT"],
      ["license_key", "TEXT"],
      ["payment_method", "TEXT"],
      ["payment_channel", "TEXT"],
      ["payment_name", "TEXT"],
      ["payment_code", "TEXT"],
      ["payment_owner", "TEXT"],
      ["payment_url", "TEXT"],
      ["payment_qr_url", "TEXT"],
      ["payment_instruction", "TEXT"],
      ["domain", "TEXT"],
      ["meta_fbp", "TEXT"],
      ["meta_fbc", "TEXT"],
      ["meta_client_ip", "TEXT"],
      ["meta_user_agent", "TEXT"],
      ["meta_purchase_sent", "TEXT"],
      ["meta_purchase_prod_sent", "TEXT"],
      ["meta_purchase_test_sent", "TEXT"],
      ["meta_purchase_last_error", "TEXT"],
      ["meta_purchase_events_received", "INTEGER DEFAULT 0"],
      ["meta_purchase_fbtrace_id", "TEXT"],
      ["meta_purchase_last_attempt", "TEXT"],
      ["is_new_account", "INTEGER DEFAULT 0"],
      ["temp_password", "TEXT"],
      ["kode_promo", "TEXT"]
    ]
  },
  coupons: {
    create: `CREATE TABLE IF NOT EXISTS coupons (
      kode_promo TEXT PRIMARY KEY,
      tipe TEXT,
      nilai REAL DEFAULT 0,
      status TEXT DEFAULT 'Active',
      berlaku_untuk_prod TEXT DEFAULT 'All',
      kategori TEXT DEFAULT 'Umum',
      allow_affiliate_clone INTEGER DEFAULT 0
    )`,
    columns: [
      ["kode_promo", "TEXT"],
      ["tipe", "TEXT"],
      ["nilai", "REAL DEFAULT 0"],
      ["status", "TEXT DEFAULT 'Active'"],
      ["berlaku_untuk_prod", "TEXT DEFAULT 'All'"],
      ["kategori", "TEXT DEFAULT 'Umum'"],
      ["allow_affiliate_clone", "INTEGER DEFAULT 0"]
    ]
  },
  affiliate_coupons: {
    create: `CREATE TABLE IF NOT EXISTS affiliate_coupons (
      kode_promo TEXT PRIMARY KEY,
      base_kode TEXT NOT NULL,
      owner_ref TEXT NOT NULL,
      owner_email TEXT,
      status TEXT DEFAULT 'Active',
      tanggal_buat TEXT
    )`,
    columns: [
      ["kode_promo", "TEXT"],
      ["base_kode", "TEXT"],
      ["owner_ref", "TEXT"],
      ["owner_email", "TEXT"],
      ["status", "TEXT DEFAULT 'Active'"],
      ["tanggal_buat", "TEXT"]
    ]
  },
  pages: {
    create: `CREATE TABLE IF NOT EXISTS pages (
      id_page TEXT PRIMARY KEY,
      slug TEXT UNIQUE,
      title TEXT,
      content TEXT,
      seo_title TEXT,
      seo_description TEXT,
      seo_keywords TEXT,
      seo_image TEXT,
      category TEXT DEFAULT 'Umum',
      protect_products TEXT,
      ga_id TEXT,
      meta_pixel_id TEXT,
      status TEXT DEFAULT 'Active',
      tanggal_buat TEXT,
      page_type TEXT DEFAULT 'lp',
      icon TEXT,
      sort_order INTEGER DEFAULT 0,
      jenis_halaman TEXT DEFAULT ''
    )`,
    columns: [
      ["id_page", "TEXT"],
      ["slug", "TEXT"],
      ["title", "TEXT"],
      ["content", "TEXT"],
      ["seo_title", "TEXT"],
      ["seo_description", "TEXT"],
      ["seo_keywords", "TEXT"],
      ["seo_image", "TEXT"],
      ["category", "TEXT DEFAULT 'Umum'"],
      ["protect_products", "TEXT"],
      ["ga_id", "TEXT"],
      ["meta_pixel_id", "TEXT"],
      ["status", "TEXT DEFAULT 'Active'"],
      ["tanggal_buat", "TEXT"],
      ["page_type", "TEXT DEFAULT 'lp'"],
      ["icon", "TEXT"],
      ["sort_order", "INTEGER DEFAULT 0"],
      ["jenis_halaman", "TEXT DEFAULT ''"]
    ]
  },
  lms: {
    create: `CREATE TABLE IF NOT EXISTS lms (
      id_produk TEXT PRIMARY KEY,
      product_id TEXT,
      product_ids TEXT,
      target_category TEXT,
      videos TEXT DEFAULT '[]',
      deskripsi TEXT,
      "desc" TEXT,
      cert_leader1 TEXT,
      cert_role1 TEXT,
      cert_leader2 TEXT,
      cert_role2 TEXT,
      cert_stamp TEXT,
      cert_template TEXT DEFAULT 'formal',
      cert_sign_count TEXT DEFAULT '2',
      cert_sign1_img TEXT,
      cert_sign2_img TEXT,
      cert_stamp_img TEXT
    )`,
    columns: [
      ["id_produk", "TEXT"],
      ["product_id", "TEXT"],
      ["product_ids", "TEXT"],
      ["target_category", "TEXT"],
      ["videos", "TEXT DEFAULT '[]'"],
      ["deskripsi", "TEXT"],
      ['"desc"', "TEXT"],
      ["cert_leader1", "TEXT"],
      ["cert_role1", "TEXT"],
      ["cert_leader2", "TEXT"],
      ["cert_role2", "TEXT"],
      ["cert_stamp", "TEXT"],
      ["cert_template", "TEXT DEFAULT 'formal'"],
      ["cert_sign_count", "TEXT DEFAULT '2'"],
      ["cert_sign1_img", "TEXT"],
      ["cert_sign2_img", "TEXT"],
      ["cert_stamp_img", "TEXT"]
    ]
  },
  categories: {
    create: `CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      slug TEXT,
      type TEXT DEFAULT 'utama'
    )`,
    columns: [
      ["id", "INTEGER"],
      ["name", "TEXT"],
      ["sort_order", "INTEGER DEFAULT 0"],
      ["slug", "TEXT"],
      ["type", "TEXT DEFAULT 'utama'"]
    ]
  },
  user_permissions: {
    create: `CREATE TABLE IF NOT EXISTS user_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      permission TEXT NOT NULL,
      granted_by TEXT,
      granted_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, permission)
    )`,
    columns: [
      ["id", "INTEGER"],
      ["user_id", "TEXT"],
      ["permission", "TEXT"],
      ["granted_by", "TEXT"],
      ["granted_at", "TEXT DEFAULT (datetime('now'))"]
    ]
  }
};

const D1_INDEXES = [
  "CREATE INDEX IF NOT EXISTS idx_orders_email_lower ON orders(LOWER(email))",
  "CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)",
  "CREATE INDEX IF NOT EXISTS idx_orders_status_total ON orders(status, harga_total)",
  "CREATE INDEX IF NOT EXISTS idx_orders_status_reminder ON orders(status, reminder_level)",
  "CREATE INDEX IF NOT EXISTS idx_orders_affiliate ON orders(affiliate)",
  "CREATE INDEX IF NOT EXISTS idx_orders_affiliate_l1 ON orders(affiliate_l1)",
  "CREATE INDEX IF NOT EXISTS idx_orders_affiliate_l2 ON orders(affiliate_l2)",
  "CREATE INDEX IF NOT EXISTS idx_orders_affiliate_l3 ON orders(affiliate_l3)",
  "CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users(LOWER(email))",
  "CREATE INDEX IF NOT EXISTS idx_access_rules_upper_id ON access_rules(UPPER(id_produk))",
  "CREATE INDEX IF NOT EXISTS idx_lms_upper_id_produk ON lms(UPPER(id_produk))",
  "CREATE INDEX IF NOT EXISTS idx_lms_upper_product_id ON lms(UPPER(product_id))"
];

let d1SchemaEnsuredAt = 0;
let d1SchemaPromise = null;
const D1_SCHEMA_CACHE_MS = 5 * 60 * 1000;

async function runSchemaStatement(env, sql, binds = []) {
  try {
    const stmt = env.DB.prepare(sql);
    if (binds.length) await stmt.bind(...binds).run();
    else await stmt.run();
  } catch(e) {
    const message = String(e.message || "");
    if (!/duplicate column|already exists/i.test(message)) {
      console.log("D1 schema patch skipped:", message);
    }
  }
}

function normalizeSchemaColumnName(value) {
  return String(value || "").replace(/^"|"$/g, "").trim();
}

async function getExistingTableColumns(env, tableName) {
  try {
    const result = await env.DB.prepare(`PRAGMA table_info(${tableName})`).all();
    return new Set((result.results || []).map(row => String(row.name || "").toLowerCase()));
  } catch(e) {
    return new Set();
  }
}

async function runD1SchemaPatch(env) {
  try {
    const marker = await env.DB.prepare("SELECT nilai FROM settings WHERE kunci = ?").bind("__schema_patch_version").first();
    if (marker && marker.nilai === D1_SCHEMA_VERSION) return;
  } catch(e) {}

  for (const table of Object.values(D1_SCHEMA)) {
    await runSchemaStatement(env, table.create);
  }

  for (const [tableName, table] of Object.entries(D1_SCHEMA)) {
    const existingColumns = await getExistingTableColumns(env, tableName);
    for (const [columnName, columnType] of table.columns) {
      const cleanColumnName = normalizeSchemaColumnName(columnName).toLowerCase();
      if (existingColumns.has(cleanColumnName)) continue;
      await runSchemaStatement(env, `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnType}`);
      existingColumns.add(cleanColumnName);
    }
  }

  for (const sql of D1_INDEXES) {
    await runSchemaStatement(env, sql);
  }

  await runSchemaStatement(env, "INSERT INTO users (id_user, email, password, nama, role, tanggal_daftar) SELECT ?, ?, ?, ?, ?, datetime('now') WHERE NOT EXISTS (SELECT 1 FROM users WHERE LOWER(email) = ?)", ["ADM-001", "admin@email.com", "admin123", "Admin", "Admin", "admin@email.com"]);

  const defaultSettings = [
    ["site_name", "Cloudmember"],
    ["site_tagline", "Member Area Digital"],
    ["site_url", "https://domain-anda.com"],
    ["theme_color", "#00AAE7"],
    ["is_manual_active", "true"],
    ["auto_gateway", "none"],
    ["enable_social_proof", "false"],
    ["show_hero_section", "true"]
  ];
  for (const [key, value] of defaultSettings) {
    await runSchemaStatement(env, "INSERT INTO settings (kunci, nilai) SELECT ?, ? WHERE NOT EXISTS (SELECT 1 FROM settings WHERE kunci = ?)", [key, value, key]);
  }

  try {
    await env.DB.prepare(`
      INSERT OR IGNORE INTO categories (name, sort_order)
      SELECT DISTINCT COALESCE(NULLIF(TRIM(kategori),''), 'Umum'), 0
      FROM access_rules
      WHERE kategori IS NOT NULL
    `).run();
  } catch(e) {}
  try {
    await env.DB.prepare(`
      UPDATE access_rules
      SET category_id = (
        SELECT id FROM categories
        WHERE categories.name = COALESCE(NULLIF(TRIM(access_rules.kategori),''), 'Umum')
      )
      WHERE category_id IS NULL
    `).run();
  } catch(e) {}
  try {
    await env.DB.prepare("UPDATE pages SET page_type = 'member' WHERE (content LIKE '%sf-member-page-type%') AND (page_type IS NULL OR page_type = 'lp')").run();
  } catch(e) {}
  try {
    const rowsMissingSlug = await env.DB.prepare("SELECT id, name FROM categories WHERE slug IS NULL OR slug = '' ORDER BY id ASC").all();
    const existingSlugs = new Set((await env.DB.prepare("SELECT slug FROM categories WHERE slug IS NOT NULL AND slug != ''").all()).results.map(r => r.slug));
    for (const row of (rowsMissingSlug.results || [])) {
      let base = slugify(row.name);
      let candidate = base;
      let n = 2;
      while (existingSlugs.has(candidate)) { candidate = `${base}-${n}`; n++; }
      existingSlugs.add(candidate);
      await env.DB.prepare("UPDATE categories SET slug = ? WHERE id = ?").bind(candidate, row.id).run();
    }
  } catch(e) {}
  try {
    await env.DB.prepare("UPDATE categories SET type = 'utama' WHERE type IS NULL OR type = ''").run();
  } catch(e) {}

  await runSchemaStatement(env, "INSERT OR REPLACE INTO settings (kunci, nilai) VALUES (?, ?)", ["__schema_patch_version", D1_SCHEMA_VERSION]);
}

async function ensureD1Schema(env, force = false) {
  if (!env || !env.DB) return;
  const now = Date.now();
  if (!force && d1SchemaEnsuredAt && now - d1SchemaEnsuredAt < D1_SCHEMA_CACHE_MS) return;
  if (!d1SchemaPromise) {
    d1SchemaPromise = runD1SchemaPatch(env)
      .then(() => { d1SchemaEnsuredAt = Date.now(); })
      .finally(() => { d1SchemaPromise = null; });
  }
  await d1SchemaPromise;
}

function splitProductTargets(value) {
  return Array.from(new Set(String(value || "").split(/[\s,;\n]+/).map(s => s.trim().toUpperCase()).filter(Boolean)));
}

async function createAdminToken(admin, settings, env) {
  const secret = String(env.ADMIN_SESSION_SECRET || settings.admin_session_secret || "cloudmember-admin-session").trim();
  return sha256Hex(`${String(admin.email || "").toLowerCase()}|${String(admin.password || "")}|${secret}`);
}

async function verifyAdminAuth(env, body, settings, request) {
  const ctx = await resolveAdminCtx(env, body, settings, request);
  return ctx.ok;
}

// Hitung effective permissions: .manage → .view, dsb.
function computeEffectivePermissions(stored) {
  const perms = new Set(stored);
  const managePrefixes = ['products', 'coupons', 'lms', 'cms_lp', 'cms_akses', 'cms_artikel', 'cms_member'];
  for (const prefix of managePrefixes) {
    if (perms.has(`${prefix}.manage`)) perms.add(`${prefix}.view`);
  }
  const impliedMap = {
    'dashboard.manage_orders': 'dashboard.view',
    'dashboard.export':        'dashboard.view',
    'blast.send':              'blast.view',
    'affiliate.reset':         'affiliate.view',
    'access.grant':            'access.view',
    'access.revoke':           'access.view',
    'media.upload':            'media.view',
  };
  for (const [perm, implied] of Object.entries(impliedMap)) {
    if (perms.has(perm)) perms.add(implied);
  }
  return perms;
}

// Resolve siapa yang melakukan request admin
// Returns: { ok, isAdmin, userId, permissions }
async function resolveAdminCtx(env, body, settings, request) {
  const reqEmail = String(body.admin_email || request.headers.get("x-admin-email") || "").trim().toLowerCase();
  const reqToken = String(body.admin_token || request.headers.get("x-admin-token") || "").trim();
  if (!reqEmail || !reqToken) return { ok: false };

  // Cek super admin (role = Admin)
  const superAdm = await env.DB.prepare("SELECT * FROM users WHERE LOWER(email) = ? AND (role = 'Admin' OR role = 'admin')").bind(reqEmail).first();
  if (superAdm) {
    const expected = await createAdminToken(superAdm, settings, env);
    if (reqToken === expected) {
      return { ok: true, isAdmin: true, userId: String(superAdm.id_user || superAdm.id), permissions: new Set(['*']) };
    }
  }

  // Cek sub-admin (user biasa dengan permissions)
  const user = await env.DB.prepare("SELECT * FROM users WHERE LOWER(email) = ?").bind(reqEmail).first();
  if (!user) return { ok: false };
  const expected = await createAdminToken(user, settings, env);
  if (reqToken !== expected) return { ok: false };

  const permRows = await safeAll(env, "SELECT permission FROM user_permissions WHERE user_id = ?", [String(user.id_user || user.id)]);
  if (!permRows.length) return { ok: false };

  const effective = computeEffectivePermissions(permRows.map(r => r.permission));
  return { ok: true, isAdmin: false, userId: String(user.id_user || user.id), permissions: effective };
}

// Dapatkan permission yang diperlukan untuk action tertentu (handle halaman dinamis)
async function getActionRequiredPermission(action, body, env) {
  if (ACTION_PERMISSION_MAP[action]) return ACTION_PERMISSION_MAP[action];
  if (action === 'save_page') {
    const pageType = String(body.page_type || 'lp');
    const typeMap = { lp: 'cms_lp.manage', akses: 'cms_akses.manage', artikel: 'cms_artikel.manage', member: 'cms_member.manage' };
    return typeMap[pageType] || 'cms_lp.manage';
  }
  if (action === 'delete_page') {
    const pageId = String(body.id || '');
    if (pageId) {
      const page = await env.DB.prepare("SELECT page_type FROM pages WHERE id_page = ?").bind(pageId).first();
      if (page) {
        const typeMap = { lp: 'cms_lp.manage', akses: 'cms_akses.manage', artikel: 'cms_artikel.manage', member: 'cms_member.manage' };
        return typeMap[page.page_type] || 'cms_lp.manage';
      }
    }
    return 'cms_lp.manage';
  }
  return null;
}

async function purgeCloudflareCache(settings = {}) {
  const zoneId = String(settings.cf_zone_id || "").trim();
  const apiToken = String(settings.cf_api_token || "").trim();
  if (!zoneId || !apiToken) return { skipped: true };

  const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ purge_everything: true })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    const message = data.errors && data.errors[0] && data.errors[0].message ? data.errors[0].message : `HTTP ${res.status}`;
    throw new Error(message);
  }
  return { skipped: false };
}

function cleanProductId(value) {
  return String(value || "").trim().toUpperCase();
}

function parseBumpItems(raw) {
  let list = raw;
  if (typeof raw === "string") {
    try { list = JSON.parse(raw); } catch(e) { list = []; }
  }
  if (!Array.isArray(list)) return [];
  return list
    .map(item => ({
      status: String((item && item.status) || "Inactive").trim() === "Active" ? "Active" : "Inactive",
      title: String((item && item.title) || "").trim(),
      price: Number(item && item.price) || 0,
      desc: String((item && item.desc) || "").trim(),
      url: String((item && item.url) || "").trim()
    }))
    .filter(item => item.title || item.url);
}

function parseImageList(raw) {
  let list = raw;
  if (typeof raw === "string") {
    try { list = JSON.parse(raw); } catch(e) { list = []; }
  }
  if (!Array.isArray(list)) return [];
  return list.map(u => String(u || "").trim()).filter(Boolean);
}

function parseCategoryIdList(raw) {
  let list = raw;
  if (typeof raw === "string") {
    try { list = JSON.parse(raw); } catch(e) { list = []; }
  }
  if (!Array.isArray(list)) return [];
  return Array.from(new Set(list.map(v => Number(v)).filter(v => Number.isFinite(v) && v > 0)));
}

function isTruthyOrderValue(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return value === true || value === 1 || normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on";
}

const CLOUDMEMBER_PERSONAL_PRODUCT_ID = "CLOUDP";

function generateCloudMemberLicense() {
  return "ULD-" + Math.random().toString(36).substring(2, 6).toUpperCase() + "-" + Math.floor(1000 + Math.random() * 9000);
}

function looksLikeCloudMemberPersonal(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return false;
  return text.includes("cloudp") || text.includes("cloudmember") || text.includes("cloud member");
}

async function detectCloudMemberPersonalBump(env, body = {}, productRow = {}) {
  if (!isTruthyOrderValue(body.take_bump)) return { isCloudMember: false, title: "", url: "" };

  const bumpTitle = String(body.bump_title || productRow.bump_title || "Order Bump").trim();
  const bumpUrl = String(body.bump_url || productRow.bump_url || "").trim();
  const directIdKeys = ["bump_id", "bump_produk_id", "bump_product_id", "bumpProductId", "bumpProductID", "id_produk_bump"];

  for (const key of directIdKeys) {
    if (cleanProductId(body[key]) === CLOUDMEMBER_PERSONAL_PRODUCT_ID) {
      return { isCloudMember: true, title: bumpTitle, url: bumpUrl };
    }
  }

  if (bumpUrl && env && env.DB) {
    try {
      const bumpProduct = await env.DB.prepare(`
        SELECT id_produk, title, url_akses, url, lp_url
        FROM access_rules
        WHERE url_akses = ? OR url = ? OR lp_url = ?
        LIMIT 1
      `).bind(bumpUrl, bumpUrl, bumpUrl).first();

      if (bumpProduct) {
        const bumpProductId = cleanProductId(bumpProduct.id_produk);
        const bumpProductText = [bumpProduct.title, bumpProduct.url_akses, bumpProduct.url, bumpProduct.lp_url].join(" ");
        if (bumpProductId === CLOUDMEMBER_PERSONAL_PRODUCT_ID || looksLikeCloudMemberPersonal(bumpProductText)) {
          return { isCloudMember: true, title: bumpTitle || bumpProduct.title || "CloudMember Personal", url: bumpUrl };
        }
      }
    } catch(e) {}
  }

  return {
    isCloudMember: looksLikeCloudMemberPersonal(bumpTitle) || looksLikeCloudMemberPersonal(bumpUrl),
    title: bumpTitle,
    url: bumpUrl
  };
}

function splitTargetList(value) {
  return String(value || "")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
}

function splitCategoryTargets(value) {
  return Array.from(new Set(splitTargetList(value).map(item => String(item).trim()).filter(Boolean)));
}

function getCouponTargets(value) {
  return splitTargetList(value).map(item => {
    const clean = String(item || "").trim();
    if (/^(all|semua)$/i.test(clean)) return { type: "all", value: "All" };
    const categoryMatch = clean.match(/^(CAT|CATEGORY|KATEGORI):(.+)$/i);
    if (categoryMatch) return { type: "category", value: categoryMatch[2].trim().toLowerCase() };
    return { type: "product", value: clean.toUpperCase() };
  });
}

async function getMasterUpdateManifest(env, settings) {
  const manifestUrl = normalizeBaseUrl(settings.master_update_url || env.MASTER_UPDATE_URL || "");
  if (!manifestUrl) {
    return { ok: false, message: "URL pusat update belum diatur." };
  }

  const url = manifestUrl.endsWith(".json") ? manifestUrl : manifestUrl + "/version.json";
  const res = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!res.ok) return { ok: false, message: "Gagal membaca manifest update: HTTP " + res.status };
  const data = await res.json();
  return { ok: true, url, data };
}

async function getGlobalSettings(env) {
  try {
    const { results } = await env.DB.prepare("SELECT * FROM settings").all();
    const sObj = {}; 
    if(results) results.forEach(s => sObj[s.kunci] = s.nilai); 
    return sObj;
  } catch(e) { return {}; }
}

async function safeAll(env, query, params = []) {
  try {
    const { results } = await env.DB.prepare(query).bind(...params).all();
    return results || [];
  } catch (e) {
    console.log("safeAll Error:", e.message);
    return [];
  }
}

function cleanAffiliateRef(value) {
  const ref = String(value || "").trim();
  const lower = ref.toLowerCase();
  if (!ref || ref === "-" || lower === "null" || lower === "undefined") return "";
  return ref;
}

function getAffiliateUserKey(user = {}) {
  return cleanAffiliateRef(user.id_user || user.id || user.email);
}

function getAffiliateUserRefs(user = {}, fallbackEmail = "") {
  return Array.from(new Set([user.id_user, user.id, user.email, fallbackEmail]
    .map(cleanAffiliateRef)
    .filter(Boolean)));
}

function affiliateRefMatchesUser(user = {}, ref = "") {
  const target = cleanAffiliateRef(ref).toLowerCase();
  if (!target) return false;
  return getAffiliateUserRefs(user).some(value => value.toLowerCase() === target);
}

async function ensureCategorySchema(env) {
  await ensureD1Schema(env);
}

async function ensureMemberPagesSchema(env) {
  await ensureD1Schema(env);
}

async function ensureAffiliateSchema(env) {
  await ensureD1Schema(env);
}

async function ensurePaymentSnapshotSchema(env) {
  await ensureD1Schema(env);
}

async function ensurePageSeoSchema(env) {
  await ensureD1Schema(env);
}

async function ensureLmsTargetSchema(env) {
  await ensureD1Schema(env);
}

async function findAffiliateUser(env, ref) {
  const key = cleanAffiliateRef(ref);
  if (!key) return null;
  try {
    return await env.DB.prepare("SELECT * FROM users WHERE id_user = ? OR CAST(id AS TEXT) = ? OR LOWER(email) = ? LIMIT 1")
      .bind(key, key, key.toLowerCase())
      .first();
  } catch(e) {
    return null;
  }
}

async function buildAffiliateChain(env, directAffiliate, buyerEmail = "", maxLevel = 3) {
  const chain = [];
  const seen = new Set();
  const buyerKey = cleanAffiliateRef(buyerEmail).toLowerCase();
  if (buyerKey) seen.add(buyerKey);

  let nextRef = cleanAffiliateRef(directAffiliate);
  for (let level = 1; level <= maxLevel && nextRef; level++) {
    const user = await findAffiliateUser(env, nextRef);
    const refKey = user ? getAffiliateUserKey(user) : nextRef;
    const normalizedRef = cleanAffiliateRef(refKey).toLowerCase();
    const normalizedEmail = user && user.email ? cleanAffiliateRef(user.email).toLowerCase() : "";
    if (!normalizedRef || seen.has(normalizedRef) || (normalizedEmail && seen.has(normalizedEmail))) break;

    chain.push({
      level,
      ref: cleanAffiliateRef(refKey),
      email: user && user.email ? String(user.email).toLowerCase() : "",
      name: user && user.nama ? String(user.nama) : ""
    });

    seen.add(normalizedRef);
    if (normalizedEmail) seen.add(normalizedEmail);
    if (!user) break;
    nextRef = cleanAffiliateRef(user.affiliate);
  }
  return chain;
}

function getOrderAffiliateCredits(order = {}) {
  const credits = [];
  for (let level = 1; level <= 3; level++) {
    const ref = cleanAffiliateRef(order[`affiliate_l${level}`] || (level === 1 ? order.affiliate : ""));
    if (!ref) continue;
    let amount = Number(order[`komisi_l${level}`]);
    if (!Number.isFinite(amount) || (level === 1 && amount === 0 && order.komisi !== undefined)) {
      amount = Number(order.komisi) || 0;
    }
    if (amount !== 0) credits.push({ level, ref, amount });
  }
  return credits;
}

function findAffiliateBucket(affMap, ref) {
  const cleanRef = cleanAffiliateRef(ref);
  if (!cleanRef) return null;
  if (affMap[cleanRef]) return affMap[cleanRef];
  const lowerRef = cleanRef.toLowerCase();
  for (const key of Object.keys(affMap)) {
    if ((affMap[key].aliases || []).some(alias => String(alias).toLowerCase() === lowerRef)) return affMap[key];
    if (String(affMap[key].email || "").toLowerCase() === lowerRef) return affMap[key];
  }
  return null;
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function cleanGatewayToken(value) {
  return String(value || "").trim();
}

function normalizeStarSenderApi(value) {
  const endpoint = String(value || "").trim().replace(/\/+$/, "");
  if (!endpoint) return { mode: "v3", url: "https://api.starsender.online/api/v3/send/message" };
  if (/\/api\/v3\//i.test(endpoint) || /\/api\/send\//i.test(endpoint)) return { mode: "v3", url: endpoint };
  if (/starsender/i.test(endpoint) && !/v3/i.test(endpoint)) return { mode: "legacy", url: endpoint };
  return { mode: "v3", url: endpoint };
}

function normalizeOneSenderApiUrl(value) {
  let endpoint = String(value || "").trim();
  if (!endpoint) endpoint = "https://wa4318.cloudwa.my.id/api/v1/messages";
  endpoint = endpoint.replace(/\/+$/, "");
  if (/\/api\/v1\/messages$/i.test(endpoint)) return endpoint;
  if (/\/api\/v1$/i.test(endpoint)) return endpoint + "/messages";
  if (/\/messages$/i.test(endpoint)) return endpoint;
  return endpoint + "/api/v1/messages";
}

function extractGatewayMessage(data, text, fallback = "") {
  if (typeof data === "object" && data !== null) {
    const msg = data.message || data.error || data.reason || data.description || data.detail || data.msg || data.info || data.status;
    if (msg && typeof msg === "string") return msg;
    if (msg && typeof msg === "object") return JSON.stringify(msg).substring(0, 200);
  }
  if (text && text.trim()) return text.substring(0, 300);
  return fallback;
}

async function readGatewayResponse(res, provider) {
  let data = {};
  let text = "";
  try {
    const rawText = await res.text();
    text = rawText;
    try { data = JSON.parse(rawText); } catch(e) {}
  } catch(e) {}
  const message = extractGatewayMessage(data, text, `HTTP ${res.status}`);
  const statusText = String(data && data.status ? data.status : "").toLowerCase();
  const failedByBody = (
    statusText === "error" ||
    statusText === "failed" ||
    statusText === "fail"
  );
  if (!res.ok || failedByBody) {
    throw new Error(provider + " HTTP " + res.status + ": " + message.substring(0, 300));
  }
  return { ok: true, provider, http_status: res.status, message: message.substring(0, 300) };
}

async function sendWA(settings, target, message, options = {}) {
  const detailed = options.detailed === true;
  const token = cleanGatewayToken(settings.wa_token);
  const num = normalizePhone(target);
  if (!num) return detailed ? { ok: false, message: "Nomor WhatsApp tujuan belum valid." } : false;
  if (!token) return detailed ? { ok: false, message: "API Token WhatsApp belum diisi." } : false;

  const gateway = String(settings.wa_gateway || "").toLowerCase();
  try {
    let result;
    if (gateway === "starsender") {
        const starApi = normalizeStarSenderApi(settings.wa_api_url || settings.starsender_api_url || "");
        const res = starApi.mode === "legacy"
          ? await fetch(starApi.url, {
              method: 'POST',
              headers: { 'apikey': token, 'Authorization': token, 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
              body: new URLSearchParams({ tujuan: num, to: num, target: num, message })
            })
          : await fetch(starApi.url, {
              method: 'POST',
              headers: { 'Authorization': token, 'Content-Type': 'application/json', 'Accept': 'application/json' },
              body: JSON.stringify({ messageType: "text", to: num, body: message })
            });
        result = await readGatewayResponse(res, "StarSender");
    } else if (gateway === "fonnte" || String(token).length < 25) {
        const fd = new FormData(); fd.append('target', num); fd.append('message', message);
        const res = await fetch("https://api.fonnte.com/send", { method: 'POST', headers: { 'Authorization': token }, body: fd });
        result = await readGatewayResponse(res, "Fonnte");
    } else {
        const apiUrl = normalizeOneSenderApiUrl(settings.wa_api_url || settings.onesender_api_url || settings.wa_endpoint || "");
        const res = await fetch(apiUrl, { method: 'POST', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify({ recipient_type: "individual", to: num, type: "text", text: { body: message } }) });
        result = await readGatewayResponse(res, "OneSender");
    }
    return detailed ? result : true;
  } catch (e) {
    console.log("WA Error:", e.message);
    return detailed ? { ok: false, message: e.message } : false;
  }
}

function stripHtmlText(value) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function sendEmail(settings, target, subject, bodyContent) {
  const provider = String(settings.mail_provider || '').toLowerCase();
  if (!target || !settings.mail_sender_email) return false;
  const fullHTML = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="background-color:#f1f5f9;margin:0;padding:20px;font-family:sans-serif;">${bodyContent}</body></html>`;
  const plainText = stripHtmlText(bodyContent || "");
  try {
    if (provider === 'resend' && settings.mail_api_key) {
      const res = await fetch("https://api.resend.com/emails", { method: "POST", headers: { "Authorization": "Bearer " + settings.mail_api_key, "Content-Type": "application/json" }, body: JSON.stringify({ from: `${settings.mail_sender_name || "Admin"} <${settings.mail_sender_email}>`, to: [target], subject: subject, html: fullHTML }) });
      if (!res.ok) throw new Error("Resend HTTP " + res.status + ": " + (await res.text()).substring(0, 300));
      return true;
    } else if (provider === 'mailketing' && settings.mail_api_key) {
      const res = await fetch("https://api.mailketing.co.id/api/v1/send", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ api_token: settings.mail_api_key, from_name: settings.mail_sender_name || "Admin", from_email: settings.mail_sender_email, subject: subject, content: fullHTML, recipient: target }) });
      if (!res.ok) throw new Error("Mailketing HTTP " + res.status + ": " + (await res.text()).substring(0, 300));
      return true;
    } else if (provider === 'kirimemail' || provider === 'kirim.email' || provider === 'kirim_email') {
      const username = String(settings.mail_username || "").trim();
      const apiKey = String(settings.mail_api_key || "").trim();
      if (!username || !apiKey) throw new Error("Username dan API Key Kirim.Email wajib diisi.");
      const senderEmail = String(settings.mail_sender_email || "").trim();
      const senderDomain = senderEmail.includes("@") ? senderEmail.split("@").pop().toLowerCase().trim() : "";
      const domain = String(settings.mail_domain || settings.kirimemail_domain || senderDomain || "").trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/.*$/, "").toLowerCase();
      if (!domain) throw new Error("Domain Kirim.Email belum diisi dan tidak bisa dibaca dari Email Pengirim.");
      const authHeader = "Basic " + btoa(`${username}:${apiKey}`);
      const endpoint = `https://smtp-app.kirim.email/api/domains/${encodeURIComponent(domain)}/message`;
      const form = new FormData();
      form.append("from", senderEmail);
      form.append("from_name", settings.mail_sender_name || settings.site_name || "Admin");
      form.append("to", target);
      form.append("subject", subject);
      form.append("text", plainText || subject);
      form.append("html", fullHTML);
      form.append("reply_to", senderEmail);
      let res = await fetch(endpoint, { method: "POST", headers: { "Authorization": authHeader }, body: form });
      if (!res.ok && (res.status === 404 || res.status === 405)) {
        const fallbackBody = new URLSearchParams({ from: senderEmail, to: target, subject, body: plainText || subject, html: fullHTML });
        res = await fetch(`https://smtp-app.kirim.email/api/domains/${encodeURIComponent(domain)}/send`, {
          method: "POST",
          headers: { "Authorization": authHeader, "Content-Type": "application/x-www-form-urlencoded" },
          body: fallbackBody
        });
      }
      await readGatewayResponse(res, "Kirim.Email");
      return true;
    } else if (provider === 'google' || provider === 'gmail') {
      const endpoint = pickSetting(settings, ["mail_api_url", "gmail_webapp_url", "google_mail_api_url"]);
      if (!endpoint) throw new Error("URL Web App Gmail belum diisi.");
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          token: String(settings.mail_api_key || "").trim(),
          to: target, subject, html: fullHTML, text: plainText,
          from_name: settings.mail_sender_name || settings.site_name || "Admin",
          from_email: settings.mail_sender_email,
          reply_to: settings.mail_sender_email
        })
      });
      await readGatewayResponse(res, "Gmail Apps Script");
      return true;
    }
  } catch(e) { console.log("Email Error:", e.message); }
  return false;
}

function splitMailketingName(nama, email) {
  const fallback = String(email || "").split("@")[0] || "Member";
  const parts = String(nama || fallback).trim().split(/\s+/).filter(Boolean);
  const firstName = parts.shift() || fallback;
  return { firstName, lastName: parts.join(" ") };
}

async function addToAutoresponder(settings, nama, email, whatsapp = "") {
  const provider = String(settings.mail_provider || "").toLowerCase();
  const apiToken = String(settings.mail_api_key || "").trim();
  const cleanEmail = String(email || "").trim().toLowerCase();
  const listIds = String(settings.mailketing_list_id || "")
    .split(/[,\s]+/)
    .map(id => id.trim())
    .filter(Boolean);
  if (provider !== "mailketing" || !apiToken || !cleanEmail || listIds.length === 0) return false;

  const nameParts = splitMailketingName(nama, cleanEmail);
  const mobile = normalizePhone(whatsapp || "");
  let success = false;

  for (const listId of listIds) {
    const params = new URLSearchParams({
      api_token: apiToken,
      list_id: listId,
      email: cleanEmail,
      first_name: nameParts.firstName,
      last_name: nameParts.lastName
    });
    if (mobile) { params.set("mobile", mobile); params.set("phone", mobile); }
    try {
      const res = await fetch("https://api.mailketing.co.id/api/v1/addsubtolist", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params
      });
      await readGatewayResponse(res, "Mailketing Autoresponder");
      success = true;
    } catch(e) {
      console.log("Mailketing Autoresponder Error:", e.message);
    }
  }
  return success;
}

function pickSetting(settings, keys) {
  for (const key of keys) {
    const value = String(settings[key] || "").trim();
    if (value) return value;
  }
  return "";
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function limitSeoText(value, maxLength = 160) {
  const clean = stripHtmlText(value);
  if (clean.length <= maxLength) return clean;
  return clean.substring(0, maxLength).replace(/\s+\S*$/, "").trim();
}

function normalizeAbsoluteUrl(value, baseUrl = "") {
  const clean = String(value || "").trim();
  if (!clean) return "";
  if (/^https?:\/\//i.test(clean)) return clean;
  if (clean.startsWith("//")) return "https:" + clean;
  if (clean.startsWith("/") && baseUrl) return String(baseUrl).replace(/\/$/, "") + clean;
  return clean;
}

function getFirstImageFromHtml(value) {
  const match = String(value || "").match(/<img[^>]+src=["']([^"']+)["']/i);
  return match && match[1] ? match[1].trim() : "";
}

function buildCmsSeoMeta(page = {}, settings = {}, requestUrl = "", content = "") {
  const currentUrl = new URL(requestUrl);
  const siteName = String(settings.site_name || APP_NAME).trim();
  const baseUrl = String(settings.site_url || currentUrl.origin).replace(/\/$/, "");
  const rawTitle = String(page.seo_title || page.meta_title || page.title || "Halaman CMS").trim();
  const title = siteName && !rawTitle.toLowerCase().includes(siteName.toLowerCase()) ? `${rawTitle} - ${siteName}` : rawTitle;
  const description = limitSeoText(page.seo_description || page.meta_description || content || settings.site_tagline || siteName, 160);
  const keywords = limitSeoText(page.seo_keywords || page.keywords || "", 220);
  const canonicalUrl = normalizeAbsoluteUrl(page.canonical_url || currentUrl.pathname, baseUrl) || currentUrl.toString();
  const imageUrl = normalizeAbsoluteUrl(page.seo_image || page.og_image || getFirstImageFromHtml(content) || settings.site_logo || settings.site_favicon, baseUrl);
  return { title, description, keywords, canonicalUrl, imageUrl, siteName };
}

function renderCmsSeoTags(seo = {}) {
  const tags = [
    `<title>${escapeHtml(seo.title || "Halaman CMS")}</title>`,
    `<meta name="description" content="${escapeHtml(seo.description || "")}">`,
    `<link rel="canonical" href="${escapeHtml(seo.canonicalUrl || "")}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:title" content="${escapeHtml(seo.title || "")}">`,
    `<meta property="og:description" content="${escapeHtml(seo.description || "")}">`,
    `<meta property="og:url" content="${escapeHtml(seo.canonicalUrl || "")}">`,
    `<meta property="og:site_name" content="${escapeHtml(seo.siteName || APP_NAME)}">`,
    `<meta name="twitter:card" content="${seo.imageUrl ? "summary_large_image" : "summary"}">`,
    `<meta name="twitter:title" content="${escapeHtml(seo.title || "")}">`,
    `<meta name="twitter:description" content="${escapeHtml(seo.description || "")}">`
  ];
  if (seo.keywords) tags.splice(2, 0, `<meta name="keywords" content="${escapeHtml(seo.keywords)}">`);
  if (seo.imageUrl) {
    tags.push(`<meta property="og:image" content="${escapeHtml(seo.imageUrl)}">`);
    tags.push(`<meta name="twitter:image" content="${escapeHtml(seo.imageUrl)}">`);
  }
  return tags.join("\n    ");
}

function normalizeGoogleTrackingId(value) {
  const id = String(value || "").trim().toUpperCase();
  return /^(G|GT|GTM|UA|AW)-[A-Z0-9-]+$/.test(id) ? id : "";
}

function normalizeMetaPixelId(value) {
  const id = String(value || "").trim();
  return /^\d{8,20}$/.test(id) ? id : "";
}

function resolveTrackingIds(record = {}, settings = {}) {
  return {
    gaId: normalizeGoogleTrackingId(record.ga_id) || normalizeGoogleTrackingId(settings.ga_id),
    metaPixelId: normalizeMetaPixelId(record.meta_pixel_id) || normalizeMetaPixelId(settings.meta_pixel_id)
  };
}

function renderTrackingTags(record = {}, settings = {}) {
  const tracking = resolveTrackingIds(record, settings);
  const tags = [];
  if (tracking.gaId) {
    const gaId = JSON.stringify(tracking.gaId).replace(/</g, "\\u003c");
    tags.push(`<script async src="https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(tracking.gaId)}"></script>`);
    tags.push(`<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag("js",new Date());gtag("config",${gaId});window.gaInjected=true;window.activeGaId=${gaId};</script>`);
  }
  if (tracking.metaPixelId) {
    const pixelId = JSON.stringify(tracking.metaPixelId).replace(/</g, "\\u003c");
    tags.push(`<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version="2.0";n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,"script","https://connect.facebook.net/en_US/fbevents.js");fbq("init",${pixelId},{});fbq("track","PageView");window.pixelInjected=true;window.activeMetaPixelId=${pixelId};</script>`);
  }
  return tags.join("\n    ");
}

function renderTemplate(template, data = {}) {
  return String(template || "").replace(/\{\{?\s*([a-zA-Z0-9_]+)\s*\}?\}/g, (match, key) => {
    return data[key] !== undefined && data[key] !== null ? String(data[key]) : "";
  });
}

function textToEmailHtml(value) {
  return escapeHtml(value).replace(/\r?\n/g, "<br>");
}

async function sha256Hex(value) {
  const cleanValue = String(value || "").trim().toLowerCase();
  if (!cleanValue) return "";
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(cleanValue));
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function signMemberSession(email, role, env, settings) {
  const secret = String(env.ADMIN_SESSION_SECRET || settings.admin_session_secret || "cloudmember-admin-session").trim();
  const payload = btoa(JSON.stringify({ email: String(email).toLowerCase(), role: role || "member", exp: Date.now() + 30 * 24 * 60 * 60 * 1000 }));
  const sig = await sha256Hex(payload + "|" + secret);
  return payload + "." + sig;
}

async function verifyMemberSession(token, env, settings) {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot === -1) return null;
  const payload = token.substring(0, dot);
  const sig = token.substring(dot + 1);
  const secret = String(env.ADMIN_SESSION_SECRET || settings.admin_session_secret || "cloudmember-admin-session").trim();
  const expected = await sha256Hex(payload + "|" + secret);
  if (sig !== expected) return null;
  try {
    const data = JSON.parse(atob(payload));
    if (data.exp < Date.now()) return null;
    return data;
  } catch { return null; }
}

function parseCookies(header) {
  const cookies = {};
  if (!header) return cookies;
  header.split(";").forEach(c => {
    const eq = c.indexOf("=");
    if (eq > 0) cookies[c.substring(0, eq).trim()] = c.substring(eq + 1).trim();
  });
  return cookies;
}

function normalizePhone(value) {
  let phone = String(value || "").replace(/\D/g, "");
  if (phone.startsWith("0")) phone = "62" + phone.substring(1);
  else if (phone.startsWith("8")) phone = "62" + phone;
  return phone;
}

function getCookieValue(cookieHeader, name) {
  const cookies = String(cookieHeader || "").split(";");
  for (const cookie of cookies) {
    const parts = cookie.trim().split("=");
    if (parts.shift() === name) return decodeURIComponent(parts.join("="));
  }
  return "";
}

function resolveMetaAccessToken(settings = {}, env = {}) {
  return pickSetting(env, ["META_ACCESS_TOKEN", "FACEBOOK_ACCESS_TOKEN", "CAPI_ACCESS_TOKEN"]) ||
    pickSetting(settings, ["meta_access_token", "facebook_access_token", "fb_access_token", "conversion_api_token", "capi_access_token"]);
}

function resolveMetaGraphApiVersion(settings = {}, env = {}) {
  const raw = pickSetting(env, ["META_GRAPH_API_VERSION"]) || pickSetting(settings, ["meta_graph_api_version"]);
  return /^v\d+\.\d+$/.test(raw) ? raw : "v20.0";
}

async function syncRecentMetaPurchases(env, settings, options = {}) {
  const limit = Math.max(1, Math.min(Number(options.limit || 25), 100));
  if (!resolveMetaAccessToken(settings, env)) {
    return { sent: 0, failed: 0, skipped: 0, reason: "Meta CAPI Access Token belum diatur" };
  }

  const rows = await safeAll(env, `SELECT * FROM orders
    WHERE status IN ('Lunas', 'Success')
      AND COALESCE(meta_purchase_prod_sent, '') = ''
    ORDER BY rowid DESC LIMIT 100`);
  const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000);
  const eligible = rows.filter(order => {
    const orderTime = Date.parse(String(order.tanggal_order || order.created_at || ""));
    return Number.isFinite(orderTime) && orderTime >= cutoff;
  }).slice(0, limit);

  let sent = 0;
  let failed = 0;
  for (const order of eligible) {
    try {
      const result = await sendMetaPurchase(order, settings, env);
      if (result.sent) sent++;
      else if (!String(result.reason || "").includes("sudah pernah")) failed++;
    } catch(e) {
      failed++;
    }
  }
  return { sent, failed, skipped: Math.max(0, rows.length - eligible.length), checked: eligible.length };
}

async function sendMetaPurchase(ord, settings, env, options = {}) {
  const pixelId = pickSetting(settings, ["meta_pixel_id", "facebook_pixel_id", "fb_pixel_id", "pixel_id"]);
  const accessToken = pickSetting(settings, ["meta_access_token", "facebook_access_token", "fb_access_token", "conversion_api_token", "capi_access_token"]);
  if (!pixelId || !accessToken || !ord || !ord.invoice) return { sent: false, reason: "Meta Pixel ID / Access Token belum diatur" };

  try { await env.DB.prepare("ALTER TABLE orders ADD COLUMN meta_purchase_sent TEXT").run(); } catch(e) {}
  try { await env.DB.prepare("ALTER TABLE orders ADD COLUMN meta_purchase_prod_sent TEXT").run(); } catch(e) {}
  try { await env.DB.prepare("ALTER TABLE orders ADD COLUMN meta_purchase_test_sent TEXT").run(); } catch(e) {}
  try { await env.DB.prepare("ALTER TABLE orders ADD COLUMN meta_purchase_last_error TEXT").run(); } catch(e) {}

  const testMode = options.testMode === true;
  const freshOrder = await env.DB.prepare("SELECT meta_purchase_prod_sent, meta_purchase_test_sent FROM orders WHERE invoice = ?").bind(ord.invoice).first();
  if (!options.force && freshOrder) {
    if (!testMode && freshOrder.meta_purchase_prod_sent) return { sent: false, reason: "Purchase production sudah pernah dikirim" };
    if (testMode && freshOrder.meta_purchase_test_sent) return { sent: false, reason: "Purchase test sudah pernah dikirim" };
  }

  const amount = Number(ord.harga_total) || 0;
  const eventId = "purchase_" + String(ord.invoice);
  const siteUrl = String(settings.site_url || "").replace(/\/$/, "");
  const userData = {};
  const emailHash = await sha256Hex(ord.email);
  const phoneHash = await sha256Hex(normalizePhone(ord.whatsapp || ord.wa || ord.no_wa));
  const nameParts = String(ord.nama || "").trim().split(/\s+/).filter(Boolean);

  if (emailHash) userData.em = [emailHash];
  if (phoneHash) userData.ph = [phoneHash];
  if (nameParts[0]) userData.fn = [await sha256Hex(nameParts[0])];
  if (nameParts.length > 1) userData.ln = [await sha256Hex(nameParts.slice(1).join(" "))];
  if (ord.meta_fbp) userData.fbp = String(ord.meta_fbp);
  if (ord.meta_fbc) userData.fbc = String(ord.meta_fbc);
  if (ord.meta_client_ip) userData.client_ip_address = String(ord.meta_client_ip);
  if (ord.meta_user_agent) userData.client_user_agent = String(ord.meta_user_agent);

  const payload = {
    data: [{
      event_name: "Purchase",
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId,
      action_source: "website",
      event_source_url: siteUrl ? siteUrl + "/member" : undefined,
      user_data: userData,
      custom_data: {
        currency: String(settings.meta_currency || settings.currency || "IDR").toUpperCase(),
        value: amount,
        order_id: String(ord.invoice),
        content_name: String(ord.nama_produk || "Produk Digital"),
        content_ids: [String(ord.id_produk || ord.invoice)],
        content_type: "product"
      }
    }]
  };

  const testEventCode = testMode ? pickSetting(settings, ["meta_test_event_code", "fb_test_event_code"]) : "";
  if (testEventCode) payload.test_event_code = testEventCode;

  const res = await fetch(`https://graph.facebook.com/v20.0/${encodeURIComponent(pixelId)}/events?access_token=${encodeURIComponent(accessToken)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    const errorMessage = data.error ? data.error.message : "Meta CAPI HTTP " + res.status;
    try { await env.DB.prepare("UPDATE orders SET meta_purchase_last_error = ? WHERE invoice = ?").bind(errorMessage, ord.invoice).run(); } catch(e) {}
    throw new Error(errorMessage);
  }

  const sentValue = (testMode ? "test:" : "prod:") + eventId;
  if (testMode) {
    await env.DB.prepare("UPDATE orders SET meta_purchase_sent = ?, meta_purchase_test_sent = ?, meta_purchase_last_error = '' WHERE invoice = ?").bind(sentValue, sentValue, ord.invoice).run();
  } else {
    await env.DB.prepare("UPDATE orders SET meta_purchase_sent = ?, meta_purchase_prod_sent = ?, meta_purchase_last_error = '' WHERE invoice = ?").bind(sentValue, sentValue, ord.invoice).run();
  }
  return { sent: true, event_id: eventId, mode: testMode ? "test" : "production" };
}

async function createXendit(inv, amount, body, settings, items) {
  const amountInt = Math.round(Number(amount));
  const auth = btoa(settings.xendit_api_key + ":");

  // Tangkap nama produk untuk dimasukkan ke rincian item
  const prodName = String(body.nama_produk || "Produk Digital").substring(0, 50);

  const payload = {
      external_id: inv,
      amount: amountInt,
      payer_email: String(body.email || "guest@email.com").trim(),
      description: "Pesanan " + prodName,
      customer: {
          given_names: String(body.nama || "Customer").substring(0, 50),
          email: String(body.email || "guest@email.com").trim(),
          mobile_number: normalizePhone(body.whatsapp || body.wa) || "6280000000000"
      },
      success_redirect_url: settings.site_url + "/member",

      // 🔥 FIX: WAJIB ADA UNTUK PAYLATER (AKULAKU) DI XENDIT
      // Mendukung lebih dari 1 paket sekaligus (checkout multi-paket): kalau `items` dikirim
      // (beberapa paket yang dipilih bersamaan), pakai itu; kalau tidak, tetap 1 item seperti semula.
      items: Array.isArray(items) && items.length
          ? items.map(it => ({ name: String(it.name || prodName).substring(0, 50), quantity: 1, price: Math.round(Number(it.price) || 0) }))
          : [
              {
                  name: prodName,
                  quantity: 1,
                  price: amountInt
              }
            ]
  };
  
  const pChannel = String(body.payment_channel || "").trim();
  if (pChannel !== "" && pChannel.toLowerCase() !== "xendit") { 
      payload.payment_methods = [pChannel]; 
  }
  
  const res = await fetch("https://api.xendit.co/v2/invoices", { 
      method: "POST", 
      headers: { "Authorization": "Basic " + auth, "Content-Type": "application/json" }, 
      body: JSON.stringify(payload) 
  });
  
  const data = await res.json(); 
  if (data.invoice_url) { return data.invoice_url; }
  throw new Error("Xendit Error: " + (data.message || JSON.stringify(data)));
}
async function createTripay(inv, amount, body, settings, items) {
  const amountInt = parseInt(amount) || 0;
  const url = settings.tripay_env === 'production' ? "https://tripay.co.id/api/transaction/create" : "https://tripay.co.id/api-sandbox/transaction/create";

  const sigStr = settings.tripay_merchant_code + inv + amountInt;
  const keyData = new TextEncoder().encode(settings.tripay_private_key);
  const cryptoKey = await crypto.subtle.importKey('raw', keyData, {name: 'HMAC', hash: 'SHA-256'}, false, ['sign']);
  const sigBuf = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(sigStr));
  const signature = Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

  const returnUrlBase = String(settings.site_url || "").replace(/\/$/, "") || ".";
  // Mendukung lebih dari 1 paket sekaligus: kalau `items` dikirim, pakai rincian per paket; kalau tidak, 1 item seperti semula.
  const orderItems = Array.isArray(items) && items.length
      ? items.map(it => ({ name: String(it.name || body.nama_produk || "Digital"), price: Math.round(Number(it.price) || 0), quantity: 1 }))
      : [{ name: body.nama_produk || "Digital", price: amountInt, quantity: 1 }];
  const payload = {
      method: String(body.payment_channel || ""), merchant_ref: inv, amount: amountInt,
      customer_name: body.nama, customer_email: body.email, customer_phone: normalizePhone(body.whatsapp || body.wa) || body.whatsapp,
      order_items: orderItems,
      return_url: `${returnUrlBase}/checkout.html?status=success&invoice=${encodeURIComponent(inv)}`, signature
  };
  if(payload.method === "") delete payload.method;
  
  const res = await fetch(url, { method: "POST", headers: { "Authorization": "Bearer " + settings.tripay_api_key, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const data = await res.json(); 
  
  if(data.success) {
      const method = String(payload.method || "").toUpperCase();
      const ewalletMethods = ["OVO", "DANA", "SHOPEEPAY", "LINKAJA"];
      const checkoutUrl = data.data.checkout_url || data.data.payment_url || data.data.pay_url || "";
      return {
        direct_payment: true,
        pay_code: data.data.pay_code,
        qr_url: data.data.qr_url,
        amount: data.data.amount,
        payment_name: data.data.payment_name,
        checkout_url: checkoutUrl,
        redirect_to_tripay: ewalletMethods.includes(method) && checkoutUrl !== ""
      };
  }
  throw new Error("Tripay Error: " + (data.message || JSON.stringify(data)));
}

async function createDuitku(inv, amount, body, settings, items) {
  const isProd = String(settings.duitku_env).toLowerCase() === 'production';
  const url = isProd ? "https://passport.duitku.com/webapi/api/merchant/v2/inquiry" : "https://sandbox.duitku.com/webapi/api/merchant/v2/inquiry";

  const mCode = String(settings.duitku_merchant_code || "").trim();
  const apiKey = String(settings.duitku_api_key || "").trim();
  const pAmount = Math.round(Number(amount));

  const signatureStr = mCode + inv + pAmount + apiKey;
  const msgUint8 = new TextEncoder().encode(signatureStr);
  const hashBuffer = await crypto.subtle.digest('MD5', msgUint8);
  const signature = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

  let pMethod = String(body.payment_channel || body.metode_pembayaran || "").trim();
  if (pMethod.toLowerCase() === 'duitku' || pMethod === 'vc' || pMethod === 'none') pMethod = "";

  const prodName = String(body.nama_produk || body.title || "Pesanan Digital").substring(0, 50);
  const baseUrl = String(settings.site_url || "https://domain-website.com").replace(/\/$/, "");
  // Mendukung lebih dari 1 paket sekaligus: kalau `items` dikirim, pakai rincian per paket; kalau tidak, 1 item seperti semula.
  const itemDetails = Array.isArray(items) && items.length
      ? items.map(it => ({ name: String(it.name || prodName).substring(0, 50), price: Math.round(Number(it.price) || 0), quantity: 1 }))
      : [{ name: prodName, price: pAmount, quantity: 1 }];

  const payload = {
      merchantCode: mCode, paymentAmount: pAmount, paymentMethod: pMethod, merchantOrderId: inv,
      productDetails: prodName, email: String(body.email || "guest@email.com").trim(),
      phoneNumber: (normalizePhone(body.whatsapp || body.wa) || "6280000000000").substring(0, 15),
      customerVaName: String(body.nama || "Customer").substring(0, 50),
      returnUrl: baseUrl + "/member", callbackUrl: baseUrl + "/callback", signature: signature,
      itemDetails: itemDetails
  };

  const res = await fetch(url, { method: "POST", headers: { "Accept": "application/json", "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const data = await res.json(); 
  if (data.paymentUrl) { return data.paymentUrl; }
  throw new Error("Duitku Error: " + (data.statusMessage || JSON.stringify(data)));
}

function normalizeLandingUrl(rawUrl, settings) {
  const url = String(rawUrl || "").trim();
  const baseUrl = String(settings.site_url || "").trim().replace(/\/$/, "");
  if (!url) return baseUrl || "website kami";
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/") && baseUrl) return baseUrl + url;
  return url;
}

function getManualPaymentDetails(settings = {}, channel = "") {
  const selected = String(channel || "bank1").trim().toLowerCase();
  if (selected === "bank2") {
    return {
      type: "bank",
      method: "Transfer " + (settings.bank_name_2 || "Bank"),
      account: settings.bank_norek_2 || "-",
      owner: settings.bank_owner_2 || "-",
      qrisUrl: ""
    };
  }
  if (selected === "bank3") {
    return {
      type: "bank",
      method: "Transfer " + (settings.bank_name_3 || "Bank"),
      account: settings.bank_norek_3 || "-",
      owner: settings.bank_owner_3 || "-",
      qrisUrl: ""
    };
  }
  if (selected === "qris") {
    return {
      type: "qris",
      method: "QRIS Manual",
      account: "Scan QRIS",
      owner: settings.qris_owner_name || settings.bank_owner || "-",
      qrisUrl: settings.qris_image_url || ""
    };
  }
  return {
    type: "bank",
    method: "Transfer " + (settings.bank_name || "Bank"),
    account: settings.bank_norek || "-",
    owner: settings.bank_owner || "-",
    qrisUrl: ""
  };
}

async function getOrderLandingUrl(env, settings, ord) {
  try {
    const prodId = String(ord.id_produk || "").trim().toUpperCase();
    if (prodId) {
      const row = await env.DB.prepare("SELECT lp_url FROM access_rules WHERE UPPER(id_produk) = ?").bind(prodId).first();
      if (row && String(row.lp_url || "").trim()) return normalizeLandingUrl(row.lp_url, settings);
    }
  } catch (e) {
    console.log("Landing URL Error:", e.message);
  }
  return normalizeLandingUrl("", settings);
}

const DEFAULT_REMINDER_WA_TEMPLATES = {
  1: `🕒 *Menunggu Pembayaran*

Halo Kak *{nama}*,

Pesanan Kakak masih tersimpan dan menunggu pembayaran.

━━━━━━━━━━━━━━━━━━━━
🔖 *Invoice:* #{invoice}
📦 *Produk:* {produk}
💰 *Total:* *{total}*
━━━━━━━━━━━━━━━━━━━━

Akses member akan terbuka otomatis setelah pembayaran terkonfirmasi.

✨ *Lanjutkan dari halaman produk:*
{landing_url}

Jika ada kendala, balas pesan ini ya Kak. Tim kami siap bantu. 🙏`,
  2: `🚀 *Akses Kakak Sudah Siap*

Halo Kak *{nama}*,

Tinggal satu langkah lagi untuk membuka akses ke *{produk}*.

━━━━━━━━━━━━━━━━━━━━
🔖 *Invoice:* #{invoice}
💰 *Tagihan:* *{total}*
━━━━━━━━━━━━━━━━━━━━

Yuk selesaikan pembayaran sebelum invoice direset otomatis oleh sistem.

💳 *Selesaikan di sini:*
{landing_url}

Ditunggu konfirmasinya ya Kak.`,
  3: `⚠️ *Pengingat Terakhir*

Halo Kak *{nama}*,

Invoice untuk *{produk}* masih berstatus *Pending* dan akan segera kedaluwarsa.

━━━━━━━━━━━━━━━━━━━━
🔖 *Invoice:* #{invoice}
💰 *Tagihan:* *{total}*
━━━━━━━━━━━━━━━━━━━━

Mohon selesaikan pembayaran hari ini agar pesanan Kakak tetap aktif.

🌐 *Cek halaman produk:*
{landing_url}

Terima kasih ya Kak. 🤝`,
  4: `❌ *Pesanan Dibatalkan Otomatis*

Halo Kak *{nama}*,

Mohon maaf, invoice Kakak sudah melewati batas waktu 24 jam dan telah dibatalkan otomatis.

━━━━━━━━━━━━━━━━━━━━
🔖 *Invoice:* #{invoice}
📦 *Produk:* {produk}
💰 *Tagihan:* *{total}*
━━━━━━━━━━━━━━━━━━━━

Kalau Kakak masih berminat, silakan pesan ulang lewat halaman produk berikut:

{landing_url}

Terima kasih sudah berkunjung. 🙏`
};

const DEFAULT_REMINDER_EMAIL_TEMPLATES = {
  1: `Halo {nama},

Pesanan {produk} dengan invoice #{invoice} masih menunggu pembayaran sebesar {total}.

Selesaikan pembayaran melalui halaman berikut:
{landing_url}

Setelah pembayaran terkonfirmasi, akses member akan aktif otomatis.`,
  2: `Halo {nama},

Akses untuk {produk} sudah siap. Tinggal selesaikan pembayaran invoice #{invoice} sebesar {total}.

Silakan lanjutkan pembayaran dari halaman berikut:
{landing_url}`,
  3: `Halo {nama},

Ini pengingat terakhir untuk invoice #{invoice}. Pesanan {produk} masih berstatus pending dengan tagihan {total}.

Mohon selesaikan pembayaran hari ini agar pesanan tetap aktif:
{landing_url}`,
  4: `Halo {nama},

Invoice #{invoice} untuk {produk} sudah melewati batas waktu dan dibatalkan otomatis.

Jika masih berminat, silakan pesan ulang melalui halaman berikut:
{landing_url}`
};

function buildPaymentReminderVars(ord, nominalFormatted, landingUrl, level, settings = {}) {
  const nama = String(ord.nama || "Kak").trim();
  const produk = String(ord.nama_produk || "Pesanan Kakak").trim();
  const invoice = String(ord.invoice || "-").trim();
  const loginUrl = (settings.site_url || "").replace(/\/$/, "") + "/member";
  const bankName = settings.bank_name || "Bank/Gateway";
  const bankNorek = settings.bank_norek || "-";
  const bankOwner = settings.bank_owner || "Admin";

  return {
    nama: nama,
    email: ord.email || "",
    whatsapp: ord.whatsapp || ord.wa || ord.no_wa || "",
    invoice: invoice,
    produk: produk,
    total: nominalFormatted,
    landing_url: landingUrl,
    link_produk: landingUrl,
    login_url: loginUrl,
    metode: bankName,
    rekening: bankNorek,
    atas_nama: bankOwner,
    instruksi_pembayaran: landingUrl, // Diingatkan kembali untuk mengunjungi LP jika URL Gateway expired
    link_pembayaran: landingUrl,
    level: level
  };
}

function buildPaymentReminderMessage(ord, nominalFormatted, landingUrl, level, settings = {}) {
  const templateKey = "notif_reminder_wa_" + String(level);
  const savedTemplate = settings[templateKey];
  let templateStr = savedTemplate === undefined || savedTemplate === null ? "" : String(savedTemplate);
  if (!templateStr.trim()) templateStr = DEFAULT_REMINDER_WA_TEMPLATES[level] || "";

  return renderTemplate(templateStr, buildPaymentReminderVars(ord, nominalFormatted, landingUrl, level, settings));
}

function buildPaymentReminderEmail(ord, nominalFormatted, landingUrl, level, settings = {}) {
  const templateKey = "notif_reminder_email_" + String(level);
  const savedTemplate = settings[templateKey];
  let templateStr = savedTemplate === undefined || savedTemplate === null ? "" : String(savedTemplate);
  if (!templateStr.trim()) templateStr = DEFAULT_REMINDER_EMAIL_TEMPLATES[level] || "";

  const vars = buildPaymentReminderVars(ord, nominalFormatted, landingUrl, level, settings);
  const copyHtml = textToEmailHtml(renderTemplate(templateStr, vars));
  const isCancelled = Number(level) === 4;
  const headerColor = isCancelled ? "#dc2626" : "#f59e0b";
  const title = isCancelled ? "Pesanan Dibatalkan" : "Pengingat Pembayaran";
  const subject = isCancelled ? `Pesanan Dibatalkan: #${vars.invoice}` : `Pengingat Pembayaran: #${vars.invoice}`;
  const actionHtml = landingUrl ? `<div style="margin-top: 28px; text-align: center;"><a href="${escapeHtml(landingUrl)}" style="background: ${headerColor}; color: white; padding: 14px 26px; text-decoration: none; border-radius: 999px; font-weight: bold; display: inline-block;">${isCancelled ? "PESAN ULANG" : "LANJUTKAN PEMBAYARAN"}</a></div>` : "";
  const html = `<div style="max-width:600px;margin:auto;background:white;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;font-family:Arial,sans-serif;"><div style="background:${headerColor};padding:28px;text-align:center;color:white;"><h1 style="margin:0;font-size:24px;">${title}</h1></div><div style="padding:28px;color:#1e293b;line-height:1.6;"><p>${copyHtml}</p><table style="width:100%;background:#f8fafc;border-radius:8px;margin-top:18px;border-collapse:collapse;"><tr><td style="padding:12px;border-bottom:1px solid #e2e8f0;">${escapeHtml(vars.produk)}</td><td style="padding:12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:bold;">${escapeHtml(vars.total)}</td></tr><tr><td style="padding:12px;color:#64748b;">Invoice</td><td style="padding:12px;text-align:right;font-weight:bold;">#${escapeHtml(vars.invoice)}</td></tr></table>${actionHtml}</div></div>`;
  return { subject, html };
}

async function sendPaymentReminderNotification(settings, ord, nominalFormatted, landingUrl, level) {
  const message = buildPaymentReminderMessage(ord, nominalFormatted, landingUrl, level, settings);
  if (message) {
    try { await sendWA(settings, ord.whatsapp, message); } catch(e){}
  }

  let emailAttempted = false;
  const targetEmail = String(ord.email || "").trim();
  if (targetEmail && String(settings.mail_sender_email || "").trim()) {
    const emailReminder = buildPaymentReminderEmail(ord, nominalFormatted, landingUrl, level, settings);
    try {
      await sendEmail(settings, targetEmail, emailReminder.subject, emailReminder.html);
      emailAttempted = true;
    } catch(e) {}
  }

  return { waAttempted: Boolean(message), emailAttempted };
}

const DEFAULT_AFFILIATE_TEMPLATES = {
  order_wa: `Halo Kak *{nama_affiliate}*,

Ada order baru dari link affiliate Kakak.
Level: {level}
Pembeli: {pembeli}
Produk: {produk}
Invoice: #{invoice}
Total Order: {total}
Potensi Komisi: {komisi}
Status: {status}`,
  order_email: `Halo {nama_affiliate},

Ada order baru dari link affiliate Anda.

Level: {level}
Pembeli: {pembeli}
Produk: {produk}
Invoice: #{invoice}
Total Order: {total}
Potensi Komisi: {komisi}
Status: {status}`,
  paid_wa: `Halo Kak *{nama_affiliate}*,

Order affiliate sudah dibayar.
Level: {level}
Pembeli: {pembeli}
Produk: {produk}
Invoice: #{invoice}
Komisi Masuk: {komisi}`,
  paid_email: `Halo {nama_affiliate},

Order affiliate sudah dibayar.

Level: {level}
Pembeli: {pembeli}
Produk: {produk}
Invoice: #{invoice}
Komisi Masuk: {komisi}`,
  payout_wa: `Halo Kak *{nama_affiliate}*,

Komisi affiliate Kakak sudah diproses pencairannya.
Nominal Cair: {komisi}
Jumlah Order: {jumlah_order}
Rincian: {rincian_level}`,
  payout_email: `Halo {nama_affiliate},

Komisi affiliate Anda sudah diproses pencairannya.

Nominal Cair: {komisi}
Jumlah Order: {jumlah_order}
Rincian: {rincian_level}`
};

function formatCurrency(value) {
  return "Rp " + (Number(value) || 0).toLocaleString("id-ID");
}

function buildAffiliateEmailHtml(title, copy, vars, color = "#2563eb") {
  const copyHtml = textToEmailHtml(copy);
  return `<div style="max-width:600px;margin:auto;background:white;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;font-family:Arial,sans-serif;"><div style="background:${color};padding:28px;text-align:center;color:white;"><h1 style="margin:0;font-size:24px;">${escapeHtml(title)}</h1></div><div style="padding:28px;color:#1e293b;line-height:1.6;"><p>${copyHtml}</p><table style="width:100%;background:#f8fafc;border-radius:8px;margin-top:18px;border-collapse:collapse;"><tr><td style="padding:12px;border-bottom:1px solid #e2e8f0;color:#64748b;">Produk</td><td style="padding:12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:bold;">${escapeHtml(vars.produk || "-")}</td></tr><tr><td style="padding:12px;border-bottom:1px solid #e2e8f0;color:#64748b;">Invoice</td><td style="padding:12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:bold;">${escapeHtml(vars.invoice ? "#" + vars.invoice : "-")}</td></tr><tr><td style="padding:12px;color:#64748b;">Komisi</td><td style="padding:12px;text-align:right;font-weight:bold;">${escapeHtml(vars.komisi || "-")}</td></tr></table></div></div>`;
}

async function notifyAffiliateUser(settings, affiliateUser, type, vars) {
  if (!affiliateUser) return;
  const eventMap = {
    order: { wa: "notif_affiliate_order_wa", email: "notif_affiliate_order_email", defaultWa: "order_wa", defaultEmail: "order_email", subject: `Order affiliate masuk: #${vars.invoice}`, title: "Order Affiliate Masuk", color: "#f59e0b" },
    paid: { wa: "notif_affiliate_paid_wa", email: "notif_affiliate_paid_email", defaultWa: "paid_wa", defaultEmail: "paid_email", subject: `Komisi affiliate masuk: #${vars.invoice}`, title: "Komisi Affiliate Masuk", color: "#16a34a" },
    payout: { wa: "notif_affiliate_payout_wa", email: "notif_affiliate_payout_email", defaultWa: "payout_wa", defaultEmail: "payout_email", subject: "Komisi affiliate dicairkan", title: "Komisi Affiliate Dicairkan", color: "#2563eb" }
  };
  const cfg = eventMap[type];
  if (!cfg) return;

  const waTemplate = String(settings[cfg.wa] || DEFAULT_AFFILIATE_TEMPLATES[cfg.defaultWa] || "");
  const emailTemplate = String(settings[cfg.email] || DEFAULT_AFFILIATE_TEMPLATES[cfg.defaultEmail] || "");
  const waText = renderTemplate(waTemplate, vars);
  const emailCopy = renderTemplate(emailTemplate, vars);

  const phone = affiliateUser.whatsapp || affiliateUser.wa || affiliateUser.no_wa || "";
  if (phone && waText.trim()) {
    try { await sendWA(settings, phone, waText); } catch(e) {}
  }
  if (affiliateUser.email && emailCopy.trim()) {
    try { await sendEmail(settings, affiliateUser.email, cfg.subject, buildAffiliateEmailHtml(cfg.title, emailCopy, vars, cfg.color)); } catch(e) {}
  }
}

async function sendAffiliateOrderNotification(env, settings, ord, type) {
  const total = Number(ord.harga_total) || 0;
  const statusText = type === "paid" ? "Lunas" : (ord.status || "Pending");
  for (const credit of getOrderAffiliateCredits(ord)) {
    const amount = Number(credit.amount) || 0;
    if (amount <= 0) continue;
    const affiliateUser = await findAffiliateUser(env, credit.ref);
    if (!affiliateUser) continue;
    const vars = {
      nama_affiliate: affiliateUser.nama || "Kak",
      affiliate_email: affiliateUser.email || "",
      pembeli: ord.nama || "-",
      email_pembeli: ord.email || "",
      whatsapp_pembeli: ord.whatsapp || ord.wa || ord.no_wa || "",
      invoice: ord.invoice || "",
      produk: ord.nama_produk || "Pesanan Digital",
      total: formatCurrency(total),
      komisi: formatCurrency(amount),
      level: String(credit.level),
      status: statusText
    };
    await notifyAffiliateUser(settings, affiliateUser, type, vars);
  }
}

async function getAffiliatePayoutSummary(env, affId, usr) {
  const refs = getAffiliateUserRefs(usr || {}, affId);
  if (!refs.length) return null;
  const affiliateFields = ["affiliate", "affiliate_l1", "affiliate_l2", "affiliate_l3"];
  const clauses = [];
  const params = [];
  affiliateFields.forEach(field => {
    refs.forEach(ref => {
      clauses.push(`${field} = ?`);
      params.push(ref);
      clauses.push(`LOWER(${field}) = ?`);
      params.push(ref.toLowerCase());
    });
  });
  const orders = clauses.length ? await safeAll(env, `SELECT * FROM orders WHERE (${clauses.join(" OR ")}) AND (status = 'Lunas' OR status = 'Success') ORDER BY rowid DESC`, params) : [];
  const refSet = new Set(refs.map(ref => ref.toLowerCase()));
  const levelTotals = { 1: 0, 2: 0, 3: 0 };
  let total = 0;
  let count = 0;

  orders.forEach(ord => {
    getOrderAffiliateCredits(ord).forEach(credit => {
      const amount = Number(credit.amount) || 0;
      if (amount <= 0 || !refSet.has(cleanAffiliateRef(credit.ref).toLowerCase())) return;
      total += amount;
      levelTotals[credit.level] = (levelTotals[credit.level] || 0) + amount;
      count++;
    });
  });

  return { user: usr, refs, total, count, levelTotals };
}

async function sendAffiliatePayoutNotification(settings, summary) {
  if (!summary || !summary.user || summary.total <= 0) return;
  const rincianLevel = `L1 ${formatCurrency(summary.levelTotals[1] || 0)} | L2 ${formatCurrency(summary.levelTotals[2] || 0)} | L3 ${formatCurrency(summary.levelTotals[3] || 0)}`;
  const vars = {
    nama_affiliate: summary.user.nama || "Kak",
    affiliate_email: summary.user.email || "",
    invoice: "",
    produk: "Pencairan Komisi Affiliate",
    total: formatCurrency(summary.total),
    komisi: formatCurrency(summary.total),
    jumlah_order: String(summary.count || 0),
    rincian_level: rincianLevel,
    level: "-",
    status: "Komisi Cair"
  };
  await notifyAffiliateUser(settings, summary.user, "payout", vars);
}

async function handleGetAdminData(env, settings, adminCtx = null) {
  await ensureAffiliateSchema(env);
  await ensureCategorySchema(env);
  await ensureMemberPagesSchema(env);
  const orders = await safeAll(env, "SELECT * FROM orders ORDER BY rowid DESC");
  const products = await safeAll(env, "SELECT * FROM access_rules");
  const users = await safeAll(env, "SELECT * FROM users ORDER BY rowid DESC");
  const lms = await safeAll(env, "SELECT * FROM lms ORDER BY rowid DESC");
  const coupons = await safeAll(env, "SELECT * FROM coupons ORDER BY rowid DESC");
  const pages = await safeAll(env, "SELECT * FROM pages ORDER BY rowid DESC");
  const categories = await safeAll(env, "SELECT id, name, sort_order, slug, type FROM categories ORDER BY sort_order ASC, id ASC");

  let totalRev = 0; const affMap = {};

  users.forEach(u => {
      const aliases = getAffiliateUserRefs(u);
      const uid = aliases[0] || String(u.id_user || u.id || "");
      affMap[uid] = { id: uid, aliases, name: u.nama || '', email: u.email || '', wa: u.whatsapp || '', rekening: u.rekening || u.info_rekening || '', komisi: 0, komisi_l1: 0, komisi_l2: 0, komisi_l3: 0 };
  });

  orders.forEach(o => {
      if (o.status === 'Lunas' || o.status === 'Success') {
          totalRev += (Number(o.harga_total) || 0);
          for (const credit of getOrderAffiliateCredits(o)) {
              if (credit.amount <= 0) continue;
              const bucket = findAffiliateBucket(affMap, credit.ref);
              if (bucket) {
                  bucket.komisi += credit.amount;
                  bucket[`komisi_l${credit.level}`] = (Number(bucket[`komisi_l${credit.level}`]) || 0) + credit.amount;
              }
          }
      }
  });
  
  const isSuperAdmin = !adminCtx || adminCtx.isAdmin;
  const effectivePerms = adminCtx && !adminCtx.isAdmin ? [...adminCtx.permissions] : null;

  return jsonRes({
    status: 'success',
    is_super_admin: isSuperAdmin,
    permissions: effectivePerms,
    stats: { users: users.length, orders: orders.length, rev: totalRev },
    orders: orders.map(o => [o.invoice, o.email, o.nama, o.whatsapp, o.id_produk, o.nama_produk, o.harga_total, o.status, o.tanggal_order, o.affiliate, o.komisi, o.domain || ""]),
    // INJEKSI HARGA CORET DI SINI BOS (Data ke-16 / Index 15):
    products: products.map(p => [p.id_produk, p.title, p.desc || p.deskripsi, p.url_akses || p.url, p.harga, p.status, p.lp_url, p.komisi, p.bump_status, p.bump_title, p.bump_price, p.bump_desc, p.bump_url, p.gambar, p.kategori || 'Umum', p.harga_coret || "", p.pdf_drive_id || "", p.komisi_l2 || 0, p.komisi_l3 || 0, p.webhook_url || "", p.is_featured || 0, p.affiliate_wajib_beli || 0, p.panara_paket_id || "", p.bump_items || "[]", p.parent_product_id || "", p.gambar_list || "[]", p.category_ids || "[]", p.deskripsi || "", p.url || "", p.access_list || "[]"]),
    lms: lms.map(l => [l.id_produk || l.product_id, l.videos, l.deskripsi || l.desc, l.cert_leader1, l.cert_role1, l.cert_leader2, l.cert_role2, l.cert_stamp, l.product_ids || "", l.kategori || 'Umum', l.cert_template || 'formal', l.cert_sign_count || '2', l.cert_sign1_img || '', l.cert_sign2_img || '', l.cert_stamp_img || '']),
    coupons: coupons.map(c => [c.kode_promo || c.code || "", c.tipe || "", c.nilai || 0, c.status || "Active", c.berlaku_untuk_prod || "All", c.kategori || 'Umum', c.allow_affiliate_clone || 0]),
    pages: pages.map(pg => [pg.id_page || "", pg.slug || "", pg.title || "", pg.content || "", pg.status || "Active", pg.tanggal_buat || "", pg.page_type || "lp", pg.icon || "📄", pg.sort_order || 0, pg.jenis_halaman || "", pg.seo_title || "", pg.seo_description || "", pg.seo_keywords || "", pg.seo_image || "", pg.ga_id || "", pg.meta_pixel_id || "", pg.category || 'Umum']),
    affiliates: Object.values(affMap).filter(a => a.komisi > 0),
    categories: categories.map(c => ({ id: c.id, name: c.name, sort_order: c.sort_order, slug: c.slug, type: c.type || 'utama' })),
    settings: settings
  });
}

async function handleGetMemberProducts(env, body, settings) {
  await ensureAffiliateSchema(env);
  await ensureCategorySchema(env);
  const email = String(body.email || "").trim().toLowerCase();
  const rules = await safeAll(env, "SELECT * FROM access_rules");
  const orders = await safeAll(env, "SELECT * FROM orders WHERE LOWER(email) = ?", [email]);
  const catRows = await safeAll(env, "SELECT id, type FROM categories");
  const catTypeById = {};
  catRows.forEach(c => { catTypeById[c.id] = c.type || 'utama'; });
  const ruleById = {};
  rules.forEach(r => { ruleById[String(r.id_produk).toUpperCase()] = r; });

  let lunasMap = {};
  let bumpMap = {}; // <-- Tambahan: Map khusus untuk mencatat siapa yang beli Bump
  let bumpItemsMap = {}; // <-- Map produk -> daftar bump item yang benar-benar dibeli

  orders.forEach(r => {
      if (r.status === 'Lunas' || r.status === 'Success') {
          const pIdStr = String(r.id_produk).toUpperCase();
          lunasMap[pIdStr] = true;

          // Cek apakah order bump benar-benar dipilih saat checkout
          // (Mengakomodasi format boolean, string 'true', atau angka 1)
          if (r.take_bump === true || String(r.take_bump).toLowerCase() === 'true' || r.take_bump === 1) {
              bumpMap[pIdStr] = true;

              let items = [];
              if (r.bump_selected) {
                  try { items = JSON.parse(r.bump_selected); } catch(e) { items = []; }
              }
              if (!Array.isArray(items) || !items.length) {
                  // Order lama sebelum kolom bump_selected ada: fallback ke konfigurasi bump produk saat ini
                  const productRule = ruleById[pIdStr];
                  if (productRule && (productRule.bump_title || productRule.bump_url)) {
                      items = [{ title: productRule.bump_title || "Order Bump", url: productRule.bump_url || "", price: Number(productRule.bump_price) || 0 }];
                  }
              }
              if (!bumpItemsMap[pIdStr]) bumpItemsMap[pIdStr] = [];
              items.forEach(item => {
                  const url = String((item && item.url) || "").trim();
                  const title = String((item && item.title) || "").trim();
                  if (!title && !url) return;
                  if (!bumpItemsMap[pIdStr].some(existing => existing.url === url && existing.title === title)) {
                      bumpItemsMap[pIdStr].push({ title: title || "Order Bump", url, price: Number(item && item.price) || 0 });
                  }
              });
          }
      }
  });
  
  let owned = [], available = [];
  rules.forEach(r => {
    if (String(r.status).trim() === 'Active') {
        const pId = String(r.id_produk).toUpperCase();
        const hasAccess = lunasMap[pId] || Number(r.harga) === 0;
        
        // PERBAIKAN: bump_access sekarang mengecek bumpMap, bukan lunasMap
        const bumpAccessList = bumpItemsMap[pId] || [];
        // Akses 1-5: gabungkan Link Akses Materi (Akses 1) + URL Cadangan (Akses 2) + access_list (Akses 3+)
        // jadi 1 daftar utuh, member bebas klik yang mana saja.
        const accessUrlList = hasAccess
            ? Array.from(new Set([r.url_akses, r.url, ...parseImageList(r.access_list)].map(u => String(u || "").trim()).filter(Boolean)))
            : [];
        const pObj = {
            id: pId,
            title: r.title,
            desc: r.desc || r.deskripsi,
            url: hasAccess ? (r.url_akses || r.url) : '#',
            access_urls: accessUrlList,
            harga: r.harga,
            access: hasAccess,
            lp_url: r.lp_url || "",
            gambar: r.gambar || "",
            komisi: r.komisi,
            bump_access: bumpMap[pId] || false, // <-- Titik krusialnya di sini bos!
            bump_url: bumpAccessList[0] ? bumpAccessList[0].url : (r.bump_url || ""),
            bump_access_list: bumpAccessList,
            kategori: r.kategori || 'Umum',
            harga_coret: r.harga_coret || 0,
            is_featured: r.is_featured || 0
        };
        
        if (hasAccess && email) {
            owned.push(pObj);
        } else if (catTypeById[r.category_id] !== 'variasi') {
            available.push(pObj);
        }
    }
  });

  let prospek = []; let total_komisi = 0;
  if (email !== "") {
      let user = null;
      try { user = await env.DB.prepare("SELECT * FROM users WHERE LOWER(email) = ?").bind(email).first(); } catch(e){}

      if (user) {
          const userRefs = getAffiliateUserRefs(user, email);
          const affiliateFields = ["affiliate", "affiliate_l1", "affiliate_l2", "affiliate_l3"];
          const clauses = [];
          const params = [];
          affiliateFields.forEach(field => {
              userRefs.forEach(ref => {
                  clauses.push(`${field} = ?`);
                  params.push(ref);
                  clauses.push(`LOWER(${field}) = ?`);
                  params.push(ref.toLowerCase());
              });
          });
          const listProspek = clauses.length ? await safeAll(env, `SELECT * FROM orders WHERE ${clauses.join(" OR ")} ORDER BY rowid DESC`, params) : [];

          prospek = listProspek.flatMap(o => {
              return getOrderAffiliateCredits(o)
                .filter(credit => affiliateRefMatchesUser(user, credit.ref))
                .map(credit => {
                  let komisiNominal = Number(credit.amount) || 0;
                  let isPaid = false;
                  if (komisiNominal < 0) { isPaid = true; komisiNominal = Math.abs(komisiNominal); }
                  if ((o.status === 'Lunas' || o.status === 'Success') && !isPaid && komisiNominal > 0) { total_komisi += komisiNominal; }
                  let statusTampil = isPaid ? 'Komisi Cair' : o.status;
                  return { tanggal: o.tanggal_order ? new Date(o.tanggal_order).toLocaleDateString('id-ID') : '-', produk: o.nama_produk || '-', nama: o.nama || '-', komisi: komisiNominal, status: statusTampil, harga_produk: o.harga_total || 0, level: credit.level };
                });
          });
      }
  }
  await ensureMemberPagesSchema(env);
  const allPagesForMember = await safeAll(env, "SELECT slug, title, content, icon, sort_order, page_type FROM pages WHERE status = 'Active' ORDER BY sort_order ASC, rowid ASC");
  const memberPagesList = allPagesForMember
    .filter(pg => (pg.page_type === 'member') || (pg.content || '').includes('sf-member-page-type'))
    .map(pg => ({ slug: pg.slug || '', title: pg.title || '', icon: pg.icon || '📄' }));

  return jsonRes({ status: 'success', data: getPublicSettings(settings), owned, available, prospek, total_komisi, member_pages: memberPagesList });
}export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, ""); // Menghapus garis miring di akhir jika ada
    
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    if (request.method === "GET" && (path === "/__cloudmember/health" || path === "/__cloudmember/version")) {
      let debugSettings = {};
      try { debugSettings = await getGlobalSettings(env); } catch(e) {}
      return jsonRes({
        status: "success",
        app: APP_NAME,
        version: APP_VERSION,
        release_date: APP_RELEASE_DATE,
        domain: normalizeDomainValue(request.headers.get("host") || url.hostname),
        installation_mode: getInstallationMode(env, debugSettings),
        license_active: isLicenseActive(debugSettings)
      });
    }

    if (request.method === "GET") {
      const settings = await getGlobalSettings(env);
      if (isBuyerInstallation(env, settings) && !isLicenseActive(settings) && !isInstallAllowedPath(path)) {
        const installUrl = new URL("/install.html", url.origin);
        if (url.pathname !== "/" && url.pathname !== "/install.html") installUrl.searchParams.set("next", url.pathname);
        return Response.redirect(installUrl.toString(), 302);
      }
    }
    
    // ==========================================
    // 🚪 PINTU CALLBACK SUPER UNIVERSAL (ALL GATEWAY)
    // Menangani: Duitku, Tripay, Xendit, & Moota (Mutasi)
    // ==========================================
    if (path === '/callback' && request.method === 'POST') {
        try {
            const contentType = (request.headers.get("content-type") || "").toLowerCase();
            const settings = await getGlobalSettings(env);

            // 1. GATEWAY DUITKU (Format Form Data)
            if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
                const formData = await request.formData();
                const merchantOrderId = formData.get('merchantOrderId');
                const resultCode = formData.get('resultCode');
                
                if (resultCode === '00' && merchantOrderId) {
                    const order = await env.DB.prepare("SELECT * FROM orders WHERE invoice = ?").bind(merchantOrderId).first();
                    if (order) await markOrderLunasAndNotify(order, env, settings);
                }
                return new Response("OK", { status: 200 });
            }
            
            // 2. GATEWAY TRIPAY, XENDIT, & MOOTA (Format JSON)
            else if (contentType.includes("application/json")) {
                const rawText = await request.text();
                const body = JSON.parse(rawText);

                // A. Deteksi MOOTA (Mutasi Rekening Bank Otomatis - Bentuknya Array)
                if (Array.isArray(body)) {
                    for (const mut of body) {
                        if (mut.type === 'CR') {
                            // Cocokkan berdasar nominal: baris tunggal (kasus normal), atau kalau tidak ada yang cocok
                            // persis, coba cocokkan total gabungan 1 grup checkout multi-paket (parent + group_invoice-nya).
                            const order = await env.DB.prepare(
                                `SELECT o.* FROM orders o
                                 WHERE o.status = 'Pending' AND (o.group_invoice IS NULL OR o.group_invoice = '')
                                 AND (
                                    o.harga_total = ?
                                    OR (SELECT COALESCE(SUM(harga_total), 0) FROM orders WHERE invoice = o.invoice OR group_invoice = o.invoice) = ?
                                 )
                                 LIMIT 1`
                            ).bind(mut.amount, mut.amount).first();
                            if (order) await markOrderLunasAndNotify(order, env, settings);
                        }
                    }
                    return new Response("OK", { status: 200 });
                }
                
                // B. Deteksi TRIPAY
                if (body.merchant_ref && (body.status === 'PAID' || body.status === 'SETTLED' || body.status === 'PAID_UNVERIFIED')) {
                    const order = await env.DB.prepare("SELECT * FROM orders WHERE invoice = ?").bind(body.merchant_ref).first();
                    if (order) await markOrderLunasAndNotify(order, env, settings);
                    return new Response(JSON.stringify({ success: true }), { headers: {'Content-Type': 'application/json'}, status: 200 });
                }
                
                // C. Deteksi XENDIT
                if (body.external_id && (body.status === 'PAID' || body.status === 'SETTLED')) {
                    const order = await env.DB.prepare("SELECT * FROM orders WHERE invoice = ?").bind(body.external_id).first();
                    if (order) await markOrderLunasAndNotify(order, env, settings);
                    return new Response(JSON.stringify({ success: true }), { headers: {'Content-Type': 'application/json'}, status: 200 });
                }

                return new Response("Ignored", { status: 200 });
            }
            
            return new Response("Ignored", { status: 200 });
        } catch (err) {
            console.error("Fatal Error Callback: ", err.message);
            return new Response("Error: " + err.message, { status: 500 });
        }
    }
    if (request.method === "GET") {
        let response = await env.ASSETS.fetch(request);
        
if (response.status === 404) {
            const slug = url.pathname.replace(/^\/|\/$/g, '').toLowerCase();

            if (slug !== '') {
                try {
                    let targetPage = null;
                    // Prefix URL per jenis CMS (LP/Akses/Artikel) — dikonfigurasi lewat Pengaturan, bukan hardcode.
                    // Kalau prefix untuk suatu jenis diisi, "/prefix/slug" dicoba dulu (dibatasi ke page_type itu);
                    // kalau tidak ketemu atau prefix-nya kosong, fallback ke pencarian slug polos seperti semula
                    // (supaya link lama yang sudah terlanjur dibagikan tetap jalan walau prefix baru diaktifkan).
                    const prefixRows = await env.DB.prepare("SELECT kunci, nilai FROM settings WHERE kunci IN ('lp_url_prefix','akses_url_prefix','artikel_url_prefix')").all();
                    const urlPrefixMap = { lp: '', akses: '', artikel: '' };
                    (prefixRows.results || []).forEach(r => {
                        const cleanPrefix = String(r.nilai || '').trim().replace(/^\/+|\/+$/g, '').toLowerCase();
                        if (r.kunci === 'lp_url_prefix') urlPrefixMap.lp = cleanPrefix;
                        if (r.kunci === 'akses_url_prefix') urlPrefixMap.akses = cleanPrefix;
                        if (r.kunci === 'artikel_url_prefix') urlPrefixMap.artikel = cleanPrefix;
                    });
                    for (const pageType of ['lp', 'akses', 'artikel']) {
                        const prefix = urlPrefixMap[pageType];
                        if (prefix && slug.startsWith(prefix + '/')) {
                            const innerSlug = slug.slice(prefix.length + 1);
                            if (innerSlug) {
                                targetPage = await env.DB.prepare("SELECT * FROM pages WHERE slug = ? AND page_type = ?").bind(innerSlug, pageType).first();
                            }
                            if (targetPage) break;
                        }
                    }
                    if (!targetPage) {
                        targetPage = await env.DB.prepare("SELECT * FROM pages WHERE slug = ?").bind(slug).first();
                    }

                    if (targetPage && targetPage.content) {
                        // Halaman member: redirect untuk akses langsung, serve HTML untuk embed
                        const isMemberPage = (targetPage.page_type === 'member') || ((targetPage.content || '').includes('sf-member-page-type'));
                        if (isMemberPage) {
                            const pageSettings = await getGlobalSettings(env);
                            const baseUrl = String(pageSettings.site_url || url.origin).replace(/\/$/, "");
                            const cookies = parseCookies(request.headers.get("cookie"));
                            const sessionData = await verifyMemberSession(cookies["member_session"], env, pageSettings);
                            const isEmbed = url.searchParams.get('_embed') === '1';
                            if (isEmbed) {
                                // Dimuat dalam iframe di /member — serve HTML langsung setelah validasi sesi
                                if (!sessionData) return new Response('<!DOCTYPE html><html><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#e11d48;"><p>Sesi tidak valid. Silakan <a href="/member" target="_top">login ulang</a>.</p></body></html>', { headers: { 'Content-Type': 'text/html;charset=utf-8' } });
                                // Strip sisa protection script dari konten (misal halaman lama yg pernah jadi CMS Akses)
                                let embedContent = (targetPage.content || '');
                                embedContent = embedContent.replace(/\[PROTECT:[^\]]*\]/gi, '');
                                embedContent = embedContent.replace(/<div[^>]+id=["']sf-member-page-type["'][^>]*><\/div>/gi, '');
                                // Inject CSS override: sembunyikan loading-lock, tampilkan secret-wrapper
                                // (lebih reliable dari regex nested div)
                                const embedOverride = '<style>[id^="sf-loading-lock"]{display:none!important;}[id^="sf-secret-wrapper"]{display:block!important;}#social-proof-toast{display:none!important;}</style><base target="_top">';
                                // Inject <base target="_top"> dan override CSS
                                embedContent = embedContent.includes('<head>')
                                    ? embedContent.replace('<head>', '<head>' + embedOverride)
                                    : embedOverride + '\n' + embedContent;
                                return new Response(embedContent, { headers: { 'Content-Type': 'text/html;charset=utf-8' } });
                            } else {
                                // Akses langsung via browser
                                if (!sessionData) return Response.redirect(baseUrl + "/member", 302);
                                return Response.redirect(baseUrl + "/member?page=" + encodeURIComponent(slug), 302);
                            }
                        }

                        let content = targetPage.content;
                        let protectId = '';
                        let pageSsoToken = null;

                        const protectMatch = content.match(/\[PROTECT:(.*?)\]/i);
                        if (protectMatch) {
                            protectId = protectMatch[1].trim();
                            content = content.replace(/\[PROTECT:.*?\]/gi, '');
                        } else if (content.includes('data-lock="')) {
                            const lockMatch = content.match(/data-lock="(.*?)"/i);
                            if (lockMatch) protectId = lockMatch[1].trim();
                        }

                        // Server-side access check untuk halaman protected
                        if (protectId !== '') {
                            const pageSettings = await getGlobalSettings(env);
                            const cookies = parseCookies(request.headers.get("cookie"));
                            const sessionData = await verifyMemberSession(cookies["member_session"], env, pageSettings);

                            if (!sessionData) {
                                const baseUrl = String(pageSettings.site_url || url.origin).replace(/\/$/, "");
                                return Response.redirect(baseUrl + "/member", 302);
                            }

                            const isAdminRole = String(sessionData.role || "").toLowerCase() === "admin";
                            if (!isAdminRole) {
                                const protectIds = protectId.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
                                const placeholders = protectIds.map(() => '?').join(', ');
                                // Ambil semua order lunas per produk (satu per produk, terbaru)
                                const accessOrders = await safeAll(env,
                                    `SELECT invoice, nama, email, whatsapp, id_produk, nama_produk, harga_total FROM orders WHERE LOWER(email) = ? AND UPPER(id_produk) IN (${placeholders}) AND status IN ('Lunas', 'Success') GROUP BY UPPER(id_produk) ORDER BY rowid DESC`,
                                    [sessionData.email, ...protectIds]
                                );

                                if (!accessOrders || accessOrders.length === 0) {
                                    const lockedHtml = `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Akses Terkunci</title><link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;800;900&display=swap" rel="stylesheet"><style>body{font-family:'Plus Jakarta Sans',sans-serif;margin:0;background:#f8fafc;display:flex;align-items:center;justify-content:center;min-height:100vh;}</style></head><body><div style="text-align:center;padding:2rem;"><svg style="width:5rem;height:5rem;color:#e11d48;margin:0 auto 1.5rem;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg><h2 style="font-size:1.75rem;font-weight:900;color:#e11d48;margin-bottom:1rem;">Akses Terkunci</h2><p style="color:#475569;margin-bottom:1.5rem;">Akun <b>${sessionData.email}</b> belum memiliki akses ke halaman ini.</p><a href="/member" style="background:#0f172a;color:white;padding:0.75rem 2rem;border-radius:0.5rem;text-decoration:none;font-weight:bold;display:inline-block;">Kembali ke Dashboard</a></div></body></html>`;
                                    return new Response(lockedHtml, { headers: { "Content-Type": "text/html;charset=utf-8" } });
                                }

                                // Jalankan webhook semua produk yang sudah dibeli secara paralel
                                const ssoTokens = await Promise.all(accessOrders.map(ord => sendWebhook(env, ord)));
                                pageSsoToken = ssoTokens.find(t => t) || null;
                            }
                        }

                        content = content.replace(/<img[^>]+onload[^>]+>/gi, '');
                        // Inject SSO token ke semua iframe yang src-nya panara.my.id
                        if (pageSsoToken) {
                            content = content.replace(
                                /(<iframe[^>]+src=["'])(https?:\/\/panara\.my\.id)(\/[^"']*)?([^>]*>)/gi,
                                (match, prefix, domain, path, rest) => {
                                    const next = encodeURIComponent(path || '/');
                                    return `${prefix}${domain}/sso/login?token=${pageSsoToken}&next=${next}${rest}`;
                                }
                            );
                        }

                        const hasPanaraEmbed = /panara\.my\.id/i.test(content);

                        const fullHtml = `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${targetPage.title || 'Halaman CMS'}</title>
    <script src="/config.js?v=2026"></script>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/lite-youtube-embed/0.3.3/lite-yt-embed.min.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/lite-youtube-embed/0.3.3/lite-yt-embed.min.js" defer></script>
    <style>
        body { font-family: 'Plus Jakarta Sans', sans-serif; margin: 0; padding: 0; background-color: #ffffff; color: #0f172a; overflow-x: hidden; }
        #cms-wrapper { padding: 0; min-height: 100vh; width: 100%; display: flex; flex-direction: column; }
        #cms-content { width: 100%; max-width: 100%; margin: 0; padding: 0; background: transparent; }
        .judul-halaman { font-size: 2.25rem; font-weight: 900; margin: 0; color: #0f172a; line-height: 1.2; padding: 3rem 1.5rem 1rem; text-align: center; }
        div[id^="sf-loading-lock"], div[id^="sf-loading-state"], div[id^="sf-error-state"], div[id^="sf-debug-box"] { display: none !important; }
        div[id^="sf-secret-wrapper"] { display: block !important; }
    </style>
</head>
<body>
    ${hasPanaraEmbed ? '' : `<div id="social-proof-toast" onclick="if(this.dataset.url) window.location.href = this.dataset.url;" style="position: fixed; bottom: -120px; left: 20px; background: white; padding: 12px 16px; border-radius: 12px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.15); border: 1px solid #e2e8f0; display: flex; align-items: center; gap: 12px; z-index: 99999; transition: bottom 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55); max-width: 320px; opacity: 0; pointer-events: auto; cursor: pointer;">
        <div style="background: #1e3a8a; color: white; width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <svg style="width: 24px; height: 24px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" stroke="#cbd5e1"></path>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.73 21a2 2 0 0 1-3.46 0" stroke="#f59e0b" fill="#f59e0b"></path>
            </svg>
        </div>
        <div>
            <p id="sp-name" style="margin: 0; font-size: 0.85rem; font-weight: 800; color: #0f172a;">...</p>
            <p style="margin: 2px 0 0 0; font-size: 0.75rem; color: #475569;">Sukses membeli <span id="sp-prod" style="font-weight: 700; color: #00AAE7;">...</span></p>
            <p id="sp-time" style="margin: 2px 0 0 0; font-size: 0.65rem; font-weight: 600; color: #94a3b8;">...</p>
        </div>
    </div>`}

    <div id="cms-wrapper">
        <div id="cms-content">
            <div>${content}</div>
        </div>
    </div>

    ${hasPanaraEmbed ? '' : `<script>
        async function initSocialProof() {
            try {
                const targetUrl = window.location.origin;
                const res = await fetch(targetUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'get_social_proof' })
                });
                const r = await res.json();
                if(r.status === 'success' && r.data && r.data.length > 0) {
                    const proofs = r.data;
                    let currentIndex = 0;
                    const toast = document.getElementById('social-proof-toast');
                    const showToast = () => {
                        const p = proofs[currentIndex];
                        document.getElementById('sp-name').innerText = p.name;
                        document.getElementById('sp-prod').innerText = p.product;
                        document.getElementById('sp-time').innerText = p.time;
                        if(p.url && p.url !== "") {
                            toast.dataset.url = p.url;
                        } else {
                            toast.removeAttribute('data-url');
                        }
                        toast.style.bottom = '20px'; toast.style.opacity = '1';
                        setTimeout(() => { toast.style.bottom = '-120px'; toast.style.opacity = '0'; }, 5000);
                        currentIndex = (currentIndex + 1) % proofs.length;
                    };
                    setTimeout(() => { showToast(); setInterval(showToast, 12000); }, 3000);
                }
            } catch(e) {}
        }
        initSocialProof();
    <\/script>`}
</body>
</html>`;
                        return new Response(fullHtml, { headers: { "Content-Type": "text/html;charset=utf-8" } });
                    } else {
                        // Tidak ada halaman CMS dengan slug ini — cek apakah ini link kategori (termasuk kategori Produk Variasi yang disembunyikan dari homepage)
                        const targetCategory = await env.DB.prepare("SELECT id FROM categories WHERE LOWER(slug) = ?").bind(slug).first();
                        if (targetCategory) {
                            const homeAsset = await env.ASSETS.fetch(new Request(new URL("/", url.origin), request));
                            if (homeAsset.status === 200) {
                                return new Response(homeAsset.body, { status: 200, headers: homeAsset.headers });
                            }
                        }
                    }
                } catch(e) { console.log("DB Rescue Error:", e.message); }
            }
        }
        return response;
    }
    try {
      const bodyText = await request.text();
      if (!bodyText) return jsonRes({ status: 'error', message: 'Body request is empty' }, 400);
      
      let body;
      try { body = JSON.parse(bodyText); } catch(e) { return jsonRes({ status: 'error', message: 'Invalid JSON payload' }, 400); }

      const settings = await getGlobalSettings(env);
      const action = String(body.action || "");

      if (isBuyerInstallation(env, settings) && !isLicenseActive(settings) && !PRE_ACTIVATION_ACTIONS.has(action)) {
        return jsonRes({
          status: "license_required",
          message: "Instalasi belum diaktivasi. Buka /install.html untuk memasukkan kode lisensi."
        }, 403);
      }

      let adminCtx = null;
      if (ADMIN_ACTIONS.has(action)) {
        adminCtx = await resolveAdminCtx(env, body, settings, request);
        if (!adminCtx.ok) return jsonRes({ status: "error", message: "Akses admin tidak valid. Silakan login ulang." }, 401);

        if (ADMIN_ONLY_ACTIONS.has(action) && !adminCtx.isAdmin) {
          return jsonRes({ status: "error", message: "Aksi ini hanya untuk Super Admin." }, 403);
        }

        if (!adminCtx.isAdmin) {
          const requiredPerm = await getActionRequiredPermission(action, body, env);
          if (requiredPerm && !adminCtx.permissions.has(requiredPerm)) {
            return jsonRes({ status: "error", message: "Anda tidak memiliki izin untuk aksi ini." }, 403);
          }
        }
      }

      switch (action) {
          case 'check_payment_status': {
          const invReq = String(body.invoice || "").trim();
          if (!invReq) return jsonRes({ status: 'error', message: 'Invoice kosong' });
          
          const cekOrder = await env.DB.prepare("SELECT status, harga_total, nama_produk, id_produk FROM orders WHERE invoice = ?").bind(invReq).first();
          if (!cekOrder) return jsonRes({ status: 'error', message: 'Order tidak ditemukan' });
          
          return jsonRes({
              status: 'success',
              payment_status: cekOrder.status,
              harga_total: cekOrder.harga_total,
              nama_produk: cekOrder.nama_produk,
              id_produk: cekOrder.id_produk
          });
        }
        case 'get_invoice_view': {
          // Dipakai halaman checkout kita sendiri (/checkout?invoice=INV-XXXXX) saat pembeli klik link
          // dari notifikasi WA/Email, supaya lihat detail pembayaran (QR/VA) di situs kita, bukan diarahkan
          // ke domain gateway pihak ketiga. Invoice sudah dipakai sebagai token akses di check_payment_status,
          // jadi pola aksesnya sama (tanpa perlu login/email tambahan).
          const viewInv = String(body.invoice || "").trim();
          if (!viewInv) return jsonRes({ status: 'error', message: 'Invoice kosong' });
          const viewOrder = await env.DB.prepare("SELECT * FROM orders WHERE invoice = ?").bind(viewInv).first();
          if (!viewOrder) return jsonRes({ status: 'error', message: 'Invoice tidak ditemukan' });
          const viewTotalRow = await env.DB.prepare("SELECT COALESCE(SUM(harga_total),0) as total FROM orders WHERE invoice = ? OR group_invoice = ?").bind(viewInv, viewInv).first();
          return jsonRes({
              status: 'success',
              invoice: viewOrder.invoice,
              email: viewOrder.email,
              nama_produk: viewOrder.nama_produk,
              order_status: viewOrder.status,
              tagihan: viewTotalRow ? viewTotalRow.total : viewOrder.harga_total,
              metode_pembayaran: viewOrder.payment_method || '',
              bank_name: viewOrder.payment_name || '',
              bank_norek: viewOrder.payment_code || '',
              bank_owner: viewOrder.payment_owner || '',
              payment_url: viewOrder.payment_url || '',
              qr_url: viewOrder.payment_qr_url || '',
              wa_admin: settings.wa_admin || ''
          });
        }
        case 'get_admin_data': { return await handleGetAdminData(env, settings, adminCtx); }
        case 'get_products': { return await handleGetMemberProducts(env, body, settings); }
        case 'get_categories': {
          await ensureCategorySchema(env);
          const cats = await safeAll(env, "SELECT id, name, sort_order, slug, type FROM categories ORDER BY sort_order ASC, id ASC");
          return jsonRes({ status: 'success', data: cats });
        }
        case 'save_category': {
          await ensureCategorySchema(env);
          const scName = String(body.name || "").trim();
          if (!scName) return jsonRes({ status: 'error', message: 'Nama kategori tidak boleh kosong' });
          if (body.id) {
            // Edit nama — update kategori string di produk juga. Slug & type tidak diubah agar link lama tetap berlaku.
            const oldRow = await env.DB.prepare("SELECT name FROM categories WHERE id = ?").bind(Number(body.id)).first();
            await env.DB.prepare("UPDATE categories SET name = ? WHERE id = ?").bind(scName, Number(body.id)).run();
            if (oldRow && oldRow.name !== scName) {
              await env.DB.prepare("UPDATE access_rules SET kategori = ? WHERE kategori = ?").bind(scName, oldRow.name).run();
            }
          } else {
            const scType = String(body.type || 'utama').trim() === 'variasi' ? 'variasi' : 'utama';
            const scSlug = await generateUniqueCategorySlug(env, scName);
            const maxOrder = await env.DB.prepare("SELECT COALESCE(MAX(sort_order),0)+1 AS next FROM categories").first();
            await env.DB.prepare("INSERT OR IGNORE INTO categories (name, sort_order, slug, type) VALUES (?, ?, ?, ?)").bind(scName, maxOrder ? maxOrder.next : 1, scSlug, scType).run();
          }
          const updatedCats = await safeAll(env, "SELECT id, name, sort_order, slug, type FROM categories ORDER BY sort_order ASC, id ASC");
          return jsonRes({ status: 'success', data: updatedCats });
        }
        case 'delete_category': {
          await ensureCategorySchema(env);
          const dcId = Number(body.id);
          if (!dcId) return jsonRes({ status: 'error', message: 'ID tidak valid' });
          const dcRow = await env.DB.prepare("SELECT name FROM categories WHERE id = ?").bind(dcId).first();
          if (!dcRow) return jsonRes({ status: 'error', message: 'Kategori tidak ditemukan' });
          const usedCount = await env.DB.prepare("SELECT COUNT(*) as n FROM access_rules WHERE category_id = ?").bind(dcId).first();
          if (usedCount && usedCount.n > 0) return jsonRes({ status: 'error', message: `Kategori masih dipakai oleh ${usedCount.n} produk. Pindahkan produk tersebut terlebih dahulu.` });
          await env.DB.prepare("DELETE FROM categories WHERE id = ?").bind(dcId).run();
          const updatedCats = await safeAll(env, "SELECT id, name, sort_order, slug, type FROM categories ORDER BY sort_order ASC, id ASC");
          return jsonRes({ status: 'success', data: updatedCats });
        }
        case 'assign_product_category': {
          await ensureCategorySchema(env);
          const apcProdId = String(body.id || body.id_produk || "").toUpperCase();
          const apcKatName = String(body.kategori || 'Umum').trim() || 'Umum';
          if (!apcProdId) return jsonRes({ status: 'error', message: 'ID produk diperlukan' });
          const existingApcCat = await env.DB.prepare("SELECT id FROM categories WHERE name = ?").bind(apcKatName).first();
          if (!existingApcCat) {
            const apcType = String(body.type || 'utama').trim() === 'variasi' ? 'variasi' : 'utama';
            const apcSlug = await generateUniqueCategorySlug(env, apcKatName);
            try {
              await env.DB.prepare("INSERT OR IGNORE INTO categories (name, sort_order, slug, type) VALUES (?, (SELECT COALESCE(MAX(sort_order),0)+1 FROM categories), ?, ?)").bind(apcKatName, apcSlug, apcType).run();
            } catch(e) {}
          }
          const apcCatRow = await env.DB.prepare("SELECT id FROM categories WHERE name = ?").bind(apcKatName).first();
          await env.DB.prepare("UPDATE access_rules SET kategori=?, category_id=? WHERE UPPER(id_produk)=?")
            .bind(apcKatName, apcCatRow ? apcCatRow.id : null, apcProdId).run();
          return jsonRes({ status: 'success' });
        }
        case 'reorder_categories': {
          // body.order = [{ id, sort_order }, ...]
          const orderList = Array.isArray(body.order) ? body.order : [];
          if (!orderList.length) return jsonRes({ status: 'error', message: 'Data urutan kosong' });
          for (const item of orderList) {
            await env.DB.prepare("UPDATE categories SET sort_order = ? WHERE id = ?").bind(Number(item.sort_order), Number(item.id)).run();
          }
          const updatedCats = await safeAll(env, "SELECT id, name, sort_order, slug, type FROM categories ORDER BY sort_order ASC, id ASC");
          return jsonRes({ status: 'success', data: updatedCats });
        }
        case 'get_global_settings': { return jsonRes({ status: 'success', data: getPublicSettings(settings) }); }
        case 'check_master_update': {
          const manifest = await getMasterUpdateManifest(env, settings);
          if (!manifest.ok) return jsonRes({ status: 'error', message: manifest.message, current_version: APP_VERSION });
          const latestVersion = String(manifest.data.version || "0.0.0");
          return jsonRes({
            status: 'success',
            current_version: APP_VERSION,
            latest_version: latestVersion,
            update_available: compareVersions(latestVersion, APP_VERSION) > 0,
            manifest_url: manifest.url,
            release_date: manifest.data.release_date || "",
            download_url: manifest.data.download_url || "",
            repository_url: manifest.data.repository_url || "",
            notes: manifest.data.notes || manifest.data.update_notes || []
          });
        }
        case 'activate_client_license': {
          const licenseKey = String(body.license_key || settings.license_key || "").trim();
          const licenseServer = normalizeBaseUrl(body.license_server_url || settings.license_server_url || env.LICENSE_SERVER_URL || "");
          const domain = normalizeDomainValue(body.domain || request.headers.get("host") || url.hostname);

          if (!licenseKey) return jsonRes({ status: 'error', message: 'Kode lisensi wajib diisi.' });
          if (!licenseServer) return jsonRes({ status: 'error', message: 'URL pusat lisensi wajib diisi.' });
          if (String(settings.license_status || "").toLowerCase() === "active" && String(settings.license_key || "").trim()) {
            return jsonRes({
              status: 'success',
              message: 'Lisensi sudah aktif untuk domain ini.',
              data: {
                domain: settings.license_domain || domain,
                produk: settings.license_product || '',
                email: settings.license_email || '',
                current_version: APP_VERSION
              }
            });
          }

          const verifyRes = await fetch(licenseServer, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'verify_license', license_key: licenseKey, domain })
          });
          const verifyData = await verifyRes.json().catch(() => ({}));
          if (!verifyRes.ok || verifyData.valid !== true) {
            return jsonRes({ status: 'error', message: verifyData.message || 'Lisensi tidak valid.' });
          }

          await saveSettings(env, {
            license_key: licenseKey,
            license_server_url: licenseServer,
            license_domain: domain,
            license_status: 'active',
            license_email: verifyData.data && verifyData.data.email ? verifyData.data.email : '',
            license_product: verifyData.data && verifyData.data.produk ? verifyData.data.produk : '',
            license_activated_at: new Date().toISOString(),
            master_update_url: (verifyData.data && verifyData.data.update_url) || settings.master_update_url || env.MASTER_UPDATE_URL || ''
          });

          return jsonRes({
            status: 'success',
            message: 'Lisensi aktif untuk domain ini.',
            data: {
              domain,
              produk: verifyData.data && verifyData.data.produk ? verifyData.data.produk : '',
              email: verifyData.data && verifyData.data.email ? verifyData.data.email : '',
              current_version: APP_VERSION
            }
          });
        }
        case 'check_client_license': {
          const licenseKey = String(settings.license_key || body.license_key || "").trim();
          const licenseServer = normalizeBaseUrl(settings.license_server_url || body.license_server_url || env.LICENSE_SERVER_URL || "");
          const domain = normalizeDomainValue(settings.license_domain || body.domain || request.headers.get("host") || url.hostname);

          if (!licenseKey || !licenseServer) {
            return jsonRes({ status: 'error', valid: false, message: 'Instalasi belum diaktivasi.' });
          }

          const verifyRes = await fetch(licenseServer, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'verify_license', license_key: licenseKey, domain })
          });
          const verifyData = await verifyRes.json().catch(() => ({}));
          return jsonRes({
            status: verifyData.valid === true ? 'success' : 'error',
            valid: verifyData.valid === true,
            message: verifyData.message || '',
            domain,
            current_version: APP_VERSION
          });
        }
        // 🚀 FITUR BARU: SOCIAL PROOF POP-UP
        case 'self_reset_client_domain': {
          const licenseKey = String(body.license_key || settings.license_key || "").trim();
          const email = String(body.email || settings.license_email || "").trim().toLowerCase();
          const licenseServer = normalizeBaseUrl(body.license_server_url || settings.license_server_url || env.LICENSE_SERVER_URL || "");

          if (!licenseKey) return jsonRes({ status: 'error', message: 'Kode lisensi wajib diisi.' });
          if (!email || !email.includes("@")) return jsonRes({ status: 'error', message: 'Email terdaftar wajib diisi.' });
          if (!licenseServer) return jsonRes({ status: 'error', message: 'URL pusat lisensi belum diatur.' });

          const resetRes = await fetch(licenseServer, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'self_reset_domain', license_key: licenseKey, email })
          });
          const resetData = await resetRes.json().catch(() => ({}));
          if (!resetRes.ok || resetData.status !== 'success') {
            return jsonRes({ status: 'error', message: resetData.message || 'Reset domain gagal.' });
          }

          await saveSettings(env, {
            license_key: licenseKey,
            license_server_url: licenseServer,
            license_domain: '',
            license_status: '',
            license_email: email,
            license_product: '',
            license_activated_at: '',
            master_update_url: settings.master_update_url || env.MASTER_UPDATE_URL || ''
          });

          return jsonRes({
            status: 'success',
            message: 'Domain lama berhasil direset. Silakan aktivasi lisensi di domain baru ini.',
            data: { license_key: licenseKey, email }
          });
        }
        case 'get_social_proof': { // <-- DITAMBAHKAN KURUNG KURAWAL BUKA
          
          // Perbaikan: Cek berbagai format nilai boolean (true, True, 1)
          const isEnabled = String(settings.enable_social_proof).trim().toLowerCase();
          if (isEnabled !== 'true' && isEnabled !== '1') {
             return jsonRes({ status: 'success', data: [] });
          }
          
          // Menggabungkan tabel orders dengan access_rules untuk mengambil lp_url (Landing Page)
          const recentOrders = await safeAll(env, "SELECT o.nama, o.nama_produk, o.tanggal_order, a.lp_url FROM orders o LEFT JOIN access_rules a ON UPPER(o.id_produk) = UPPER(a.id_produk) WHERE o.status IN ('Lunas', 'Success') ORDER BY o.tanggal_order DESC LIMIT 10");
          
          const proofData = recentOrders.map(o => {
              let orderDate = new Date(o.tanggal_order);
              if (isNaN(orderDate)) {
                 const parts = String(o.tanggal_order).split(/[\s/:-]+/); 
                 if(parts.length >= 3) {
                   const yy = parts[2].length === 4 ? parts[2] : parts[0];
                   const dd = parts[2].length === 4 ? parts[0] : parts[2];
                   const mm = parts[1];
                   orderDate = new Date(`${yy}-${mm}-${dd}T00:00:00Z`);
                 }
              }
              if (isNaN(orderDate)) orderDate = new Date();
              
              const diffMins = Math.floor((new Date() - orderDate) / 60000);
              let timeStr = "Baru saja";
              if(diffMins > 0 && diffMins < 60) timeStr = `${diffMins} menit yang lalu`;
              else if(diffMins >= 60 && diffMins < 1440) timeStr = `${Math.floor(diffMins/60)} jam yang lalu`;
              else if(diffMins >= 1440) timeStr = `${Math.floor(diffMins/1440)} hari yang lalu`;
              
              let fName = String(o.nama).split(' ')[0];
              fName = fName.substring(0, 4) + "***"; // Menyamarkan nama demi privasi
              
              // Menyusun URL lengkap jika lp_url berawalan "/" (misal: /produk-1)
              let urlTujuan = o.lp_url || "";
              if (urlTujuan.startsWith("/")) {
                  urlTujuan = String(settings.site_url || "").replace(/\/$/, "") + urlTujuan;
              }
              
              return { name: fName, product: o.nama_produk, time: timeStr, url: urlTujuan };
          });
          
          return jsonRes({ status: 'success', data: proofData });
			}
        case 'get_product': {
          const gpId = String(body.id || body.id_produk || "").toUpperCase();
          const pRow = await env.DB.prepare("SELECT * FROM access_rules WHERE UPPER(id_produk) = ?").bind(gpId).first();
          if (!pRow) return jsonRes({ status: 'error', message: 'Produk tidak ditemukan' });
          if (String(pRow.status).trim() !== 'Active') return jsonRes({ status: 'error', message: 'Produk sedang di-nonaktifkan' });
          
          let affName = "";
          const affIdReq = String(body.aff_id || "");
          if (affIdReq !== "" && affIdReq !== "GUEST" && affIdReq !== "-") {
            const affUser = await env.DB.prepare("SELECT nama FROM users WHERE id_user = ?").bind(affIdReq).first();
            if(affUser) affName = affUser.nama;
          }
          pRow.nama = pRow.title;

          // Cek apakah produk ini punya varian (produk lain yang di-link via parent_product_id, dan/atau ini sendiri adalah varian)
          const groupParentId = String(pRow.parent_product_id || pRow.id_produk).toUpperCase();
          const groupRows = await safeAll(env,
            "SELECT * FROM access_rules WHERE status = 'Active' AND (UPPER(id_produk) = ? OR UPPER(parent_product_id) = ?) ORDER BY (UPPER(id_produk) = ?) DESC, harga ASC",
            [groupParentId, groupParentId, groupParentId]
          );
          const variants = groupRows.length > 1 ? groupRows.map(r => ({ ...r, nama: r.title })) : [];

          return jsonRes({ status: 'success', data: pRow, variants, payment: getPublicSettings(settings), aff_name: affName });
        }
        case 'get_category_products': {
          await ensureCategorySchema(env);
          const gcpSlug = String(body.slug || "").trim().toLowerCase();
          if (!gcpSlug) return jsonRes({ status: 'error', message: 'Slug kategori diperlukan' });
          const gcpCat = await env.DB.prepare("SELECT id, name, slug, type FROM categories WHERE LOWER(slug) = ?").bind(gcpSlug).first();
          if (!gcpCat) return jsonRes({ status: 'error', message: 'Kategori tidak ditemukan' });
          const gcpRows = await safeAll(env, "SELECT * FROM access_rules WHERE category_id = ? AND status = 'Active'", [gcpCat.id]);
          const gcpProducts = gcpRows.map(r => ({
            id: String(r.id_produk).toUpperCase(),
            title: r.title,
            desc: r.desc || r.deskripsi,
            harga: r.harga,
            lp_url: r.lp_url || "",
            gambar: r.gambar || "",
            kategori: r.kategori || 'Umum',
            harga_coret: r.harga_coret || 0,
            is_featured: r.is_featured || 0
          }));
          return jsonRes({ status: 'success', category: { id: gcpCat.id, name: gcpCat.name, slug: gcpCat.slug, type: gcpCat.type || 'utama' }, products: gcpProducts });
        }

        case 'validate_coupon': {
          const couponReq = String(body.code || body.kode_promo || "").trim().toUpperCase();
          const reqProdId = String(body.id_produk || body.id || "").toUpperCase();
          const validAllCoupons = await safeAll(env, "SELECT * FROM coupons");
          let cp = validAllCoupons.find(c => String(c.kode_promo || c.code || "").toUpperCase() === couponReq && String(c.status || "").trim() === 'Active');
          if (!cp) {
            // Bukan kupon biasa — cek apakah ini kupon personal affiliate (kloningan dari kupon utama)
            const affCoupon = await env.DB.prepare("SELECT * FROM affiliate_coupons WHERE kode_promo = ? AND status = 'Active'").bind(couponReq).first();
            if (affCoupon) {
              cp = await env.DB.prepare("SELECT * FROM coupons WHERE kode_promo = ? AND status = 'Active'").bind(affCoupon.base_kode).first();
            }
          }
          if(!cp) return jsonRes({ status: 'error', message: 'Kupon tidak ditemukan / sudah kadaluarsa.' });

          const vProds = String(cp.berlaku_untuk_prod || cp.products || "All").trim();
          if (vProds.toLowerCase() !== 'all' && vProds !== "") {
             if (!vProds.split(',').map(s => s.trim().toUpperCase()).includes(reqProdId)) {
                 return jsonRes({ status: 'error', message: 'Kupon ini tidak berlaku untuk produk ini.' });
             }
          }
          let disc = 0; let bHarga = parseFloat(body.harga) || 0; let cTipe = String(cp.tipe || cp.type).trim().toLowerCase(); let cNilai = parseFloat(cp.nilai || cp.val);
          if (cTipe === 'persen' || cTipe === 'percentage' || cTipe === '%') { disc = (bHarga * cNilai) / 100; } else { disc = cNilai; }
          if (disc > bHarga) disc = bHarga;
          return jsonRes({ status: 'success', message: 'Kupon berhasil diterapkan!', code: cp.kode_promo || cp.code, discount: disc });
        }

        case 'update_profile': {
          const upEmail = String(body.email || "").toLowerCase().trim();
          const upNama = String(body.nama || "").trim();
          const upWa = String(body.whatsapp || "").replace(/\D/g, '');
          if (!upEmail) return jsonRes({ status: 'error', message: 'Email diperlukan' });
          const upUser = await env.DB.prepare("SELECT id_user FROM users WHERE LOWER(email) = ?").bind(upEmail).first();
          if (!upUser) return jsonRes({ status: 'error', message: 'User tidak ditemukan' });
          const sets = []; const binds = [];
          if (upNama) { sets.push("nama = ?"); binds.push(upNama); }
          if (upWa) { sets.push("whatsapp = ?"); binds.push(upWa); }
          if (!sets.length) return jsonRes({ status: 'success' });
          binds.push(upEmail);
          await env.DB.prepare(`UPDATE users SET ${sets.join(', ')} WHERE LOWER(email) = ?`).bind(...binds).run();
          return jsonRes({ status: 'success' });
        }

        case 'login': {
          const u = await env.DB.prepare("SELECT * FROM users WHERE LOWER(email) = ? AND password = ?").bind(String(body.email).toLowerCase(), body.password).first();
          if (!u) return jsonRes({ status: 'error', message: 'Email/Password Salah' });
          const sessionToken = await signMemberSession(u.email, u.role || "member", env, settings);
          const isSecure = String(settings.site_url || "").startsWith("https");
          const cookieStr = `member_session=${sessionToken}; HttpOnly; ${isSecure ? "Secure; " : ""}SameSite=Lax; Path=/; Max-Age=2592000`;
          return new Response(JSON.stringify({ status: 'success', data: { id: u.id_user || u.id, nama: u.nama, email: u.email, role: u.role, wa: u.whatsapp } }), { headers: { ...corsHeaders, "Content-Type": "application/json", "Set-Cookie": cookieStr } });
        }

        case 'admin_login': {
          const loginEmail = String(body.email || "").toLowerCase().trim();
          const loginPass = String(body.password || "");

          // Cek super admin
          let adm = await env.DB.prepare("SELECT * FROM users WHERE LOWER(email) = ? AND password = ? AND (role = 'Admin' OR role = 'admin')").bind(loginEmail, loginPass).first();
          let isSuperAdmin = !!adm;
          let loginPerms = null;

          if (!isSuperAdmin) {
            // Cek sub-admin: user biasa yang punya permissions
            const user = await env.DB.prepare("SELECT * FROM users WHERE LOWER(email) = ? AND password = ?").bind(loginEmail, loginPass).first();
            if (user) {
              const permRows = await safeAll(env, "SELECT permission FROM user_permissions WHERE user_id = ?", [String(user.id_user || user.id)]);
              if (permRows.length) {
                adm = user;
                loginPerms = [...computeEffectivePermissions(permRows.map(r => r.permission))];
              }
            }
          }

          if (!adm) return jsonRes({ status: 'error', message: 'Akses Ditolak' });

          const adminToken = await createAdminToken(adm, settings, env);
          const adminSessionToken = await signMemberSession(adm.email, isSuperAdmin ? "admin" : "member", env, settings);
          const isSecureAdm = String(settings.site_url || "").startsWith("https");
          const adminCookieStr = `member_session=${adminSessionToken}; HttpOnly; ${isSecureAdm ? "Secure; " : ""}SameSite=Lax; Path=/; Max-Age=2592000`;
          return new Response(JSON.stringify({ status: 'success', data: { id: adm.id_user || adm.id, nama: adm.nama, email: adm.email, admin_token: adminToken, is_super_admin: isSuperAdmin, permissions: loginPerms } }), { headers: { ...corsHeaders, "Content-Type": "application/json", "Set-Cookie": adminCookieStr } });
        }

        case 'logout': {
          return new Response(JSON.stringify({ status: 'success' }), { headers: { ...corsHeaders, "Content-Type": "application/json", "Set-Cookie": "member_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0" } });
        }

        case 'update_admin_access': {
          const currentEmail = String(body.admin_email || "").trim().toLowerCase();
          const currentPassword = String(body.current_password || "");
          const nextName = String(body.nama || "Admin").trim() || "Admin";
          const nextEmail = String(body.new_email || "").trim().toLowerCase();
          const nextPassword = String(body.new_password || "");

          if (!currentEmail || !currentPassword) return jsonRes({ status: 'error', message: 'Email admin dan password lama wajib diisi.' });
          if (!nextEmail || !nextEmail.includes("@")) return jsonRes({ status: 'error', message: 'Email admin baru tidak valid.' });
          if (nextPassword && nextPassword.length < 6) return jsonRes({ status: 'error', message: 'Password baru minimal 6 karakter.' });

          const adm = await env.DB.prepare("SELECT * FROM users WHERE LOWER(email) = ? AND password = ? AND (role = 'Admin' OR role = 'admin')").bind(currentEmail, currentPassword).first();
          if (!adm) return jsonRes({ status: 'error', message: 'Password lama admin salah.' });

          const usedEmail = await env.DB.prepare("SELECT email FROM users WHERE LOWER(email) = ? AND LOWER(email) <> ?").bind(nextEmail, currentEmail).first();
          if (usedEmail) return jsonRes({ status: 'error', message: 'Email baru sudah dipakai akun lain.' });

          const finalPassword = nextPassword || adm.password;
          await env.DB.prepare("UPDATE users SET nama = ?, email = ?, password = ? WHERE LOWER(email) = ? AND (role = 'Admin' OR role = 'admin')")
            .bind(nextName, nextEmail, finalPassword, currentEmail)
            .run();

          const updatedAdmin = { email: nextEmail, password: finalPassword };
          const adminToken = await createAdminToken(updatedAdmin, settings, env);
          return jsonRes({
            status: 'success',
            message: 'Akses admin berhasil diperbarui.',
            data: { nama: nextName, email: nextEmail, admin_token: adminToken }
          });
        }

        case 'create_order': {
          const coEmail = String(body.email || "").toLowerCase().trim();
          const coNama = String(body.nama || "");
          const coWa = String(body.whatsapp || "");
          let total = Number(body.harga) || 0;
          const cookieHeader = request.headers.get("cookie") || "";
          const metaFbp = String(body.fbp || body._fbp || getCookieValue(cookieHeader, "_fbp") || "").trim();
          let metaFbc = String(body.fbc || body._fbc || getCookieValue(cookieHeader, "_fbc") || "").trim();
          const fbclid = String(body.fbclid || "").trim();
          if (!metaFbc && fbclid) metaFbc = "fb.1." + Date.now() + "." + fbclid;
          const metaClientIp = String(request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || "").split(",")[0].trim();
          const metaUserAgent = String(body.user_agent || request.headers.get("user-agent") || "").trim();
          
          let rawId = body.id || body.id_produk || body.product_id || body.produk_id || "";
          if (String(rawId).toLowerCase() === "undefined" || String(rawId).toLowerCase() === "null") rawId = "";
          const coProdId = String(rawId).toUpperCase();
          const payMethod = String(body.metode_pembayaran || body.payment_channel || "manual").toLowerCase();
          const paymentChannel = String(body.payment_channel || "bank1").toLowerCase();
          const isManualPayment = !payMethod.includes('xendit') && !payMethod.includes('tripay') && !payMethod.includes('duitku');
          let rawAffiliate = cleanAffiliateRef(body.affiliate || body.aff_id);
          const coKodePromo = String(body.kupon || body.kode_promo || "").trim().toUpperCase();
          await ensureD1Schema(env);
          if (coKodePromo) {
            // Kupon personal affiliate (kloningan kupon utama) menggantikan link referral —
            // siapa pun yang pakai kode ini otomatis tercatat sebagai referral pemilik kupon.
            const usedAffCoupon = await env.DB.prepare("SELECT owner_ref FROM affiliate_coupons WHERE kode_promo = ? AND status = 'Active'").bind(coKodePromo).first();
            if (usedAffCoupon && usedAffCoupon.owner_ref) rawAffiliate = cleanAffiliateRef(usedAffCoupon.owner_ref);
          }
          const finalAffiliate = rawAffiliate || "-";
          await ensureAffiliateSchema(env);

          // PENANGKAP DATA BUMP SELL BOS! (mendukung banyak bump sekaligus)
          const parsedBumpSelected = parseBumpItems(body.bump_selected);
          const bumpSelected = parsedBumpSelected.length
              ? parsedBumpSelected
              : (isTruthyOrderValue(body.take_bump) && (body.bump_title || body.bump_url)
                  ? [{ status: "Active", title: body.bump_title || "Order Bump", price: 0, desc: "", url: body.bump_url || "" }]
                  : []);
          const takeBumpVal = bumpSelected.length ? "true" : "false";
          const bumpSelectedJson = JSON.stringify(bumpSelected);

          if (isManualPayment) {
              const kodeUnik = Math.floor(Math.random() * 899) + 100;
              total = total + kodeUnik;
          }

          let passAccount = "";
          let isNewUser = false;
          const existUsr = await env.DB.prepare("SELECT * FROM users WHERE LOWER(email) = ?").bind(coEmail).first();
          if (existUsr) {
            passAccount = existUsr.password;
            if (rawAffiliate && !cleanAffiliateRef(existUsr.affiliate) && !affiliateRefMatchesUser(existUsr, rawAffiliate)) {
              try { await env.DB.prepare("UPDATE users SET affiliate = ? WHERE LOWER(email) = ?").bind(rawAffiliate, coEmail).run(); } catch(e) {}
            }
          }

          // Checkout multi-paket: paket lain (varian sama grup) yang dicentang bersamaan dengan paket utama.
          const rawExtraVariantIds = Array.isArray(body.extra_variant_ids) ? body.extra_variant_ids : [];
          const extraVariantIdsUnik = [...new Set(rawExtraVariantIds.map(id => String(id || "").toUpperCase()).filter(Boolean))].filter(id => id !== coProdId);
          const hasExtraVariantsRequested = extraVariantIdsUnik.length > 0;

          // Cegah duplikat order: kalau sudah ada Pending untuk email + produk ini, kembalikan data lama tanpa kirim notif.
          // Kalau kali ini ikut memilih paket lain (checkout multi-paket), batalkan pending lama & buat invoice baru
          // supaya paket tambahan yang baru dipilih tidak hilang begitu saja.
          const existingPending = await env.DB.prepare(
            "SELECT * FROM orders WHERE LOWER(email) = ? AND UPPER(id_produk) = ? AND status = 'Pending' ORDER BY tanggal_order DESC LIMIT 1"
          ).bind(coEmail, coProdId).first();
          if (existingPending && !hasExtraVariantsRequested) {
            const manualPayEx = isManualPayment ? getManualPaymentDetails(settings, paymentChannel) : null;
            return jsonRes({
              status: 'success',
              invoice: existingPending.invoice,
              tagihan: existingPending.harga_total,
              bank_name: manualPayEx ? manualPayEx.method : (settings.bank_name || "Bank"),
              bank_norek: manualPayEx ? manualPayEx.account : (settings.bank_norek || "-"),
              bank_owner: manualPayEx ? manualPayEx.owner : (settings.bank_owner || "-"),
              qr_url: manualPayEx ? (manualPayEx.qrisUrl || "") : "",
              metode_pembayaran: isManualPayment ? "manual" : payMethod,
              is_new_user: false,
              password: passAccount,
              is_duplicate: true
            });
          }
          if (existingPending && hasExtraVariantsRequested) {
            try { await env.DB.prepare("UPDATE orders SET status = 'Cancelled' WHERE invoice = ?").bind(existingPending.invoice).run(); } catch(e) {}
            try { await env.DB.prepare("UPDATE orders SET status = 'Cancelled' WHERE group_invoice = ? AND status != 'Lunas'").bind(existingPending.invoice).run(); } catch(e) {}
          }

          if (!existUsr) {
            isNewUser = true;
            passAccount = Math.random().toString(36).slice(-6);
            await env.DB.prepare("INSERT INTO users (id_user, email, password, nama, role, tanggal_daftar, whatsapp, affiliate) VALUES (?,?,?,?,'member',?,?,?)")
                  .bind('USR-'+Date.now(), coEmail, passAccount, coNama, new Date().toISOString(), coWa, finalAffiliate).run();
            try { await addToAutoresponder(settings, coNama, coEmail); } catch(e){}
          }

          const pRowData = await env.DB.prepare("SELECT komisi, komisi_l2, komisi_l3, bump_title, affiliate_wajib_beli, parent_product_id FROM access_rules WHERE UPPER(id_produk) = ?").bind(coProdId).first();

          let effectiveAffiliate = rawAffiliate;
          let affiliateStripped = false;
          if (rawAffiliate && pRowData && pRowData.affiliate_wajib_beli) {
            const affUser = await findAffiliateUser(env, rawAffiliate);
            const affEmail = affUser ? (affUser.email || "").toLowerCase() : null;
            const hasBought = affEmail ? await env.DB.prepare(
              "SELECT invoice FROM orders WHERE LOWER(email) = ? AND UPPER(id_produk) = ? AND status IN ('Lunas', 'Success') LIMIT 1"
            ).bind(affEmail, coProdId).first() : null;
            if (!hasBought) {
              effectiveAffiliate = "";
              affiliateStripped = true;
            }
          }

          const affiliateChain = await buildAffiliateChain(env, effectiveAffiliate, coEmail, 3);
          const komisiRates = [Number(pRowData && pRowData.komisi) || 0, Number(pRowData && pRowData.komisi_l2) || 0, Number(pRowData && pRowData.komisi_l3) || 0];
          const affiliateRefs = [affiliateChain[0]?.ref || "", affiliateChain[1]?.ref || "", affiliateChain[2]?.ref || ""];
          const komisiLevels = affiliateRefs.map((ref, idx) => ref && komisiRates[idx] > 0 ? (total * komisiRates[idx]) / 100 : 0);
          let nilaiKomisi = komisiLevels[0] || 0;

          // Checkout multi-paket: validasi tiap paket tambahan benar-benar varian dari grup yang sama
          // (parent_product_id sama) & masih Active, supaya request yang diutak-atik tidak bisa
          // menyelundupkan produk lain/nonaktif dengan harga rekaan. Harga & komisi selalu diambil dari DB, bukan dari klien.
          // "Jumlah" berlaku sebagai jumlah bundel (paket utama + semua paket tambahan) yang dibeli sekaligus —
          // harga tiap paket tambahan ikut dikali jumlahAkunVal, sama seperti paket utama.
          const jumlahAkunVal = Math.max(1, Math.min(50, parseInt(body.jumlah_akun, 10) || 1));
          const primaryGroupId = String((pRowData && pRowData.parent_product_id) || coProdId).toUpperCase();
          const extraVariantOrders = [];
          for (const exId of extraVariantIdsUnik) {
            const exRow = await env.DB.prepare("SELECT id_produk, title, harga, komisi, komisi_l2, komisi_l3, parent_product_id FROM access_rules WHERE UPPER(id_produk) = ? AND status = 'Active'").bind(exId).first();
            if (!exRow) continue;
            const exGroupId = String(exRow.parent_product_id || exRow.id_produk).toUpperCase();
            if (exGroupId !== primaryGroupId) continue;
            const exHarga = (Number(exRow.harga) || 0) * jumlahAkunVal;
            const exKomisiRates = [Number(exRow.komisi) || 0, Number(exRow.komisi_l2) || 0, Number(exRow.komisi_l3) || 0];
            const exKomisiLevels = affiliateRefs.map((ref, idx) => ref && exKomisiRates[idx] > 0 ? (exHarga * exKomisiRates[idx]) / 100 : 0);
            extraVariantOrders.push({ id_produk: exId, nama_produk: exRow.title, harga: exHarga, komisiLevels: exKomisiLevels });
          }
          const extraVariantsTotal = extraVariantOrders.reduce((sum, eo) => sum + eo.harga, 0);
          // grandTotal = total keseluruhan yang harus dibayar (paket utama + semua paket tambahan).
          // `total` sendiri (harga_total baris utama) tetap hanya porsi paket utama, supaya komisi per paket tetap akurat.
          const grandTotal = total + extraVariantsTotal;

          const inv = 'INV-' + Math.floor(10000 + Math.random() * 90000);
          // 🛠 TUKANG BANGUNAN OTOMATIS: Tambah kolom license_key jika belum ada
          try { await env.DB.prepare(`ALTER TABLE orders ADD COLUMN license_key TEXT`).run(); } catch(e) {}
          try { await env.DB.prepare(`ALTER TABLE orders ADD COLUMN meta_fbp TEXT`).run(); } catch(e) {}
          try { await env.DB.prepare(`ALTER TABLE orders ADD COLUMN meta_fbc TEXT`).run(); } catch(e) {}
          try { await env.DB.prepare(`ALTER TABLE orders ADD COLUMN meta_client_ip TEXT`).run(); } catch(e) {}
          try { await env.DB.prepare(`ALTER TABLE orders ADD COLUMN meta_user_agent TEXT`).run(); } catch(e) {}
          try { await env.DB.prepare(`ALTER TABLE orders ADD COLUMN group_invoice TEXT`).run(); } catch(e) {}
          try { await env.DB.prepare(`ALTER TABLE orders ADD COLUMN bump_selected TEXT`).run(); } catch(e) {}
          try { await env.DB.prepare(`ALTER TABLE orders ADD COLUMN is_new_account INTEGER DEFAULT 0`).run(); } catch(e) {}
          try { await env.DB.prepare(`ALTER TABLE orders ADD COLUMN temp_password TEXT`).run(); } catch(e) {}

          // Generate Kode Lisensi Unik HANYA UNTUK PRODUK CLOUDP
          let genLicense = "";
          if (coProdId === 'CLOUDP') {
              genLicense = 'ULD-' + Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + Math.floor(1000 + Math.random() * 9000);
          }
         // INJEKSI KOLOM take_bump & license_key KE DATABASE D1
         await env.DB.prepare("INSERT INTO orders (invoice, email, nama, whatsapp, id_produk, nama_produk, harga_total, status, tanggal_order, affiliate, komisi, reminder_level, take_bump, bump_selected, license_key, meta_fbp, meta_fbc, meta_client_ip, meta_user_agent, affiliate_l1, affiliate_l2, affiliate_l3, komisi_l1, komisi_l2, komisi_l3, is_new_account, temp_password, kode_promo) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
                .bind(inv, coEmail, coNama, coWa, coProdId, body.nama_produk, total, 'Pending', new Date().toISOString(), effectiveAffiliate || "-", nilaiKomisi, 0, takeBumpVal, bumpSelectedJson, genLicense, metaFbp, metaFbc, metaClientIp, metaUserAgent, affiliateRefs[0], affiliateRefs[1] || "", affiliateRefs[2] || "", komisiLevels[0] || 0, komisiLevels[1] || 0, komisiLevels[2] || 0, isNewUser ? 1 : 0, isNewUser ? passAccount : "", coKodePromo || "").run();

          // 🛍️ CHECKOUT MULTI-PAKET: tiap paket tambahan yang dicentang jadi baris order sendiri (pembeli
          // & email sama dengan pemesan utama), disatukan lewat group_invoice supaya 1x bayar untuk semuanya.
          // Beda dengan "akun tambahan" di atas: baris ini emailnya SAMA dengan pemesan (dipakai markOrderLunasAndNotify
          // untuk membedakan & menggabungkan notifikasi jadi 1 pesan).
          for (let i = 0; i < extraVariantOrders.length; i++) {
            const eo = extraVariantOrders[i];
            try {
              await env.DB.prepare("UPDATE orders SET status = 'Cancelled' WHERE LOWER(email) = ? AND UPPER(id_produk) = ? AND status = 'Pending'").bind(coEmail, eo.id_produk).run();
            } catch(e) {}
            const variantInv = inv + '-v' + (i + 1);
            try {
              await env.DB.prepare("INSERT INTO orders (invoice, email, nama, whatsapp, id_produk, nama_produk, harga_total, status, tanggal_order, affiliate, komisi, reminder_level, group_invoice, affiliate_l1, affiliate_l2, affiliate_l3, komisi_l1, komisi_l2, komisi_l3) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
                .bind(variantInv, coEmail, coNama, coWa, eo.id_produk, eo.nama_produk, eo.harga, 'Pending', new Date().toISOString(), effectiveAffiliate || "-", eo.komisiLevels[0] || 0, 0, inv, affiliateRefs[0], affiliateRefs[1] || "", affiliateRefs[2] || "", eo.komisiLevels[0] || 0, eo.komisiLevels[1] || 0, eo.komisiLevels[2] || 0)
                .run();
            } catch(e) {}
          }

          // 👨‍👩‍👧‍👦 BELI UNTUK BEBERAPA AKUN SEKALIGUS: buat akun (jika belum ada) + order "anak"
          // untuk tiap email tambahan. Order anak ikut Lunas & dapat notifikasi akses bareng
          // order utama lewat group_invoice (lihat markOrderLunasAndNotify).
          const akunTambahanEmails = Array.isArray(body.akun_tambahan)
            ? body.akun_tambahan.map(e => String(e || "").toLowerCase().trim()).filter(Boolean)
            : [];
          const akunTambahanUnik = [...new Set(akunTambahanEmails)].filter(e => e !== coEmail);
          for (let i = 0; i < akunTambahanUnik.length; i++) {
            const childEmail = akunTambahanUnik[i];
            try {
              const childUser = await env.DB.prepare("SELECT * FROM users WHERE LOWER(email) = ?").bind(childEmail).first();
              const childIsNew = !childUser;
              const childPass = childIsNew ? Math.random().toString(36).slice(-6) : "";
              if (childIsNew) {
                await env.DB.prepare("INSERT INTO users (id_user, email, password, nama, role, tanggal_daftar) VALUES (?,?,?,?,'member',?)")
                  .bind('USR-' + Date.now() + '-' + i, childEmail, childPass, childEmail.split('@')[0], new Date().toISOString()).run();
              }
              const childInv = inv + '-' + (i + 2);
              await env.DB.prepare("INSERT INTO orders (invoice, email, nama, whatsapp, id_produk, nama_produk, harga_total, status, tanggal_order, affiliate, komisi, reminder_level, group_invoice, is_new_account, temp_password) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
                .bind(childInv, childEmail, childUser ? childUser.nama : childEmail.split('@')[0], childUser ? childUser.whatsapp || "" : "", coProdId, body.nama_produk, 0, 'Pending', new Date().toISOString(), "-", 0, 0, inv, childIsNew ? 1 : 0, childPass).run();

              // Checkout multi-paket: akun tambahan ini juga harus dapat akses ke semua paket tambahan
              // yang dicentang, bukan cuma paket utama — sama seperti pembeli utamanya.
              for (let j = 0; j < extraVariantOrders.length; j++) {
                const eo = extraVariantOrders[j];
                const childVariantInv = inv + '-' + (i + 2) + '-v' + (j + 1);
                try {
                  await env.DB.prepare("INSERT INTO orders (invoice, email, nama, whatsapp, id_produk, nama_produk, harga_total, status, tanggal_order, affiliate, komisi, reminder_level, group_invoice) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)")
                    .bind(childVariantInv, childEmail, childUser ? childUser.nama : childEmail.split('@')[0], childUser ? childUser.whatsapp || "" : "", eo.id_produk, eo.nama_produk, 0, 'Pending', new Date().toISOString(), "-", 0, 0, inv).run();
                } catch(e) {}
              }
            } catch(e) {}
          }

          let pUrl = "#";
          let tripayData = null;

          // Rincian item untuk gateway pembayaran (paket utama + semua paket tambahan yang dicentang).
          // Saat tidak ada paket tambahan, ini sama saja dengan 1 item seperti sebelumnya.
          const gatewayItems = [
            { name: body.nama_produk || "Produk Digital", price: total },
            ...extraVariantOrders.map(eo => ({ name: eo.nama_produk, price: eo.harga }))
          ];

          try {
            if (payMethod.includes('xendit')) pUrl = await createXendit(inv, grandTotal, body, settings, gatewayItems);
            else if (payMethod.includes('tripay')) {
                const tRes = await createTripay(inv, grandTotal, body, settings, gatewayItems);
                if (typeof tRes === 'object' && tRes.direct_payment) { tripayData = tRes; pUrl = "DIRECT"; } else { pUrl = tRes; }
            }
            else if (payMethod.includes('duitku')) pUrl = await createDuitku(inv, grandTotal, body, settings, gatewayItems);
          } catch (e) { return jsonRes({ status: 'error', message: 'Error API Gateway: ' + e.message }); }

          const loginUrl = (settings.site_url || "") + "/member";
          const manualPayment = isManualPayment ? getManualPaymentDetails(settings, paymentChannel) : null;
          const bankName = tripayData ? tripayData.payment_name : (manualPayment ? manualPayment.method : (settings.bank_name || "Bank (Cek Pengaturan)"));
          const bankNorek = tripayData ? tripayData.pay_code : (manualPayment ? manualPayment.account : (settings.bank_norek || "-"));
          const tripayMerchantName = String(settings.tripay_merchant_name || settings.site_name || settings.mail_sender_name || "Merchant Tripay").trim();
          let gatewayMerchantName = String(settings.bank_owner || settings.site_name || settings.mail_sender_name || "Merchant").trim();
          if (payMethod.includes('duitku')) gatewayMerchantName = String(settings.duitku_merchant_name || settings.site_name || settings.mail_sender_name || "Merchant Duitku").trim();
          else if (payMethod.includes('xendit')) gatewayMerchantName = String(settings.xendit_merchant_name || settings.site_name || settings.mail_sender_name || "Merchant Xendit").trim();
          const bankOwner = tripayData ? tripayMerchantName : (manualPayment ? manualPayment.owner : gatewayMerchantName);
          const tagihanAkhir = tripayData ? tripayData.amount : grandTotal;
          const formattedTotal = "Rp " + Number(tagihanAkhir).toLocaleString('id-ID');
          // Nama produk gabungan untuk teks notifikasi saat checkout multi-paket (paket utama + tambahan)
          const namaProdukGabungan = extraVariantOrders.length
            ? [body.nama_produk || "Pesanan Digital", ...extraVariantOrders.map(eo => eo.nama_produk)].join(', ')
            : (body.nama_produk || "Pesanan Digital");
          // Link checkout.tripay.co.id cuma benar-benar perlu dibuka kalau metode-nya memang redirect
          // (e-wallet spt OVO/DANA/ShopeePay). Untuk QRIS/VA, pembeli cukup lihat QR/kode-nya langsung —
          // jangan kirim link tripay.co.id ke notifikasi WA/Email kalau tidak perlu.
          const tripayNeedsRedirect = !!(tripayData && tripayData.redirect_to_tripay);
          const tripayCheckoutUrl = tripayNeedsRedirect && tripayData.checkout_url ? String(tripayData.checkout_url) : "";
          const qrisImageUrl = (tripayData && tripayData.qr_url) ? String(tripayData.qr_url) : (manualPayment && manualPayment.type === "qris" ? String(manualPayment.qrisUrl || "") : "");
          const isQrisDisplay = (manualPayment && manualPayment.type === "qris") || (tripayData && !tripayNeedsRedirect && qrisImageUrl);
          // Halaman checkout kita sendiri yang menampilkan detail pembayaran (QR/kode VA) dengan tampilan brand
          // kita — dipakai di notifikasi WA/Email supaya pembeli tidak diarahkan langsung ke domain gateway
          // (tripay.co.id dsb) untuk QRIS/VA otomatis (yang detailnya sudah kita punya sendiri).
          const ownInvoiceViewUrl = `${String(settings.site_url || "").replace(/\/$/, "")}/checkout?invoice=${encodeURIComponent(inv)}`;
          const isAutoGatewayNonRedirect = !!tripayData && !tripayNeedsRedirect;

          const txtManualWA = isQrisDisplay
            ? (isAutoGatewayNonRedirect
                ? `📱 *${bankName || 'QRIS'}*\n👤 Atas Nama: *${bankOwner}*\n💰 Nominal: *${formattedTotal}*\n\nSilakan buka link berikut untuk lihat & scan QR pembayaran:\n${ownInvoiceViewUrl}\n\n⚠️ _PENTING: Harap bayar nominal *TEPAT ${formattedTotal}*._`
                : `📱 *${bankName || 'QRIS'}*\n👤 Atas Nama: *${bankOwner}*\n💰 Nominal: *${formattedTotal}*\n\nSilakan scan QRIS berikut:\n${qrisImageUrl || "-"}\n\n⚠️ _PENTING: Harap bayar nominal *TEPAT ${formattedTotal}* lalu kirim bukti pembayaran ke admin._`)
            : `🏦 *${bankName}*\n💳 Rek / VA: *${bankNorek}*\n👤 Atas Nama: *${bankOwner}*\n\n⚠️ _PENTING: Harap bayar nominal *TEPAT ${formattedTotal}* agar otomatis diverifikasi._`;

          // 🔥 CEK ORDER BUMP UNTUK NOTIFIKASI PENDING 🔥 (mendukung banyak bump sekaligus)
          const isBump = bumpSelected.length > 0;
          const bumpTitle = bumpSelected.length
              ? bumpSelected.map(item => item.title).join(', ')
              : String((pRowData && pRowData.bump_title) || "Order Bump").trim();
          const textBumpWA = isBump ? `\n🎁 *Order Tambahan:* ${bumpTitle}` : "";
          const textBumpEmail = isBump ? `<br><small style="color:#d97706; font-weight:bold;">+ ${escapeHtml(bumpTitle)}</small>` : "";
          const infoBumpText = isBump ? `Order Tambahan: ${bumpTitle}` : "";
          const instruksiPembayaran = (pUrl !== "#" && pUrl !== "DIRECT") ? pUrl : (tripayCheckoutUrl || txtManualWA);

          // Simpan detail pembayaran ke baris order-nya sendiri, supaya halaman /checkout?invoice=INV-XXXXX
          // (dibuka dari link di WA/Email) bisa menampilkan ulang QR/kode VA yang sama tanpa perlu request baru ke gateway.
          try {
            await env.DB.prepare("UPDATE orders SET payment_method=?, payment_channel=?, payment_name=?, payment_code=?, payment_owner=?, payment_url=?, payment_qr_url=?, payment_instruction=? WHERE invoice=?")
              .bind(isManualPayment ? 'manual' : payMethod, paymentChannel, bankName, bankNorek, bankOwner, (pUrl !== "#" && pUrl !== "DIRECT") ? pUrl : "", qrisImageUrl, instruksiPembayaran, inv)
              .run();
          } catch(e) {}

          const templateVars = {
            nama: coNama,
            email: coEmail,
            whatsapp: coWa,
            invoice: inv,
            produk: namaProdukGabungan,
            total: formattedTotal,
            metode: bankName,
            rekening: bankNorek,
            atas_nama: bankOwner,
            qris_url: qrisImageUrl,
            login_url: loginUrl,
            password: passAccount,
            instruksi_pembayaran: instruksiPembayaran,
            link_pembayaran: (pUrl !== "#" && pUrl !== "DIRECT") ? pUrl : tripayCheckoutUrl,
            info_bump: infoBumpText
          };
          const defaultPendingWA = `Halo Kak *{nama}*\n\nTerima kasih, pesanan Anda telah kami terima:\nProduk: *{produk}*${textBumpWA}\nInvoice: *#{invoice}*\nTotal Tagihan: *{total}*\n\nINSTRUKSI PEMBAYARAN:\n{instruksi_pembayaran}\n\nDETAIL LOGIN\nURL: {login_url}\nEmail: {email}\nPass: {password}`;
          
          const msgPending = `Halo Kak *${coNama}* 👋\n\nTerima kasih pesanan Anda telah kami terima:\n📦 *Produk:* ${namaProdukGabungan}${textBumpWA}\n🔖 *Invoice:* #${inv}\n💰 *Total Tagihan:* Rp ${tagihanAkhir.toLocaleString('id-ID')}\n\n💳 *INSTRUKSI PEMBAYARAN:* \n${(pUrl !== "#" && pUrl !== "DIRECT") ? pUrl : txtManualWA}\n\n---\n🔐 *DETAIL LOGIN*\n🌐 *URL:* ${loginUrl}\n✉️ *Email:* ${coEmail}\n🔑 *Pass:* ${passAccount}`;
          
          const finalMsgPending = renderTemplate(settings.notif_pending_wa || defaultPendingWA, templateVars);
          const manualPaymentEmailBody = qrisImageUrl
            ? `<p style="margin:0; font-size:16px; font-weight:bold; color:#2563eb;">${escapeHtml(bankName)}</p><img src="${escapeHtml(qrisImageUrl)}" alt="QRIS Pembayaran" style="width:220px;max-width:100%;margin:12px auto 8px;display:block;border-radius:8px;border:1px solid #e2e8f0;"><p style="margin:0; color:#64748b; font-size:14px;">a.n ${escapeHtml(bankOwner)}</p>`
            : `<p style="margin:0; font-size:16px; font-weight:bold; color:#2563eb;">${escapeHtml(bankName)}</p><p style="margin:5px 0; font-size:24px; font-weight:900; letter-spacing:2px; color:#1e293b;">${escapeHtml(bankNorek)}</p><p style="margin:0; color:#64748b; font-size:14px;">a.n ${escapeHtml(bankOwner)}</p>`;
          const htmlManualEmail = `<div style="background:#f1f5f9; padding:20px; border-radius:8px; text-align:center; border: 2px dashed #cbd5e1; margin-top:20px;"><p style="margin:0 0 10px 0; color:#475569; font-size:14px;">Silakan bayar <strong>TEPAT</strong> sesuai nominal:</p><h2 style="margin:0 0 15px 0; color:#dc2626; font-size:28px;">${escapeHtml(formattedTotal)}</h2>${manualPaymentEmailBody}</div>`;
          const btnBayarEmail = `<div style="margin-top: 30px; text-align: center;"><a href="${templateVars.link_pembayaran}" style="background: #f59e0b; color: white; padding: 15px 30px; text-decoration: none; border-radius: 999px; font-weight: bold; display: inline-block;">BAYAR SEKARANG</a></div>`;
          const actionEmailHTML = templateVars.link_pembayaran ? btnBayarEmail : htmlManualEmail;
          const defaultPendingEmail = `Halo {nama},\n\nPesanan Anda telah dicatat dengan invoice #{invoice}. Silakan selesaikan pembayaran sebesar {total}.`;
          const pendingEmailCopy = textToEmailHtml(renderTemplate(settings.notif_pending_email || defaultPendingEmail, templateVars));
          
          const emailPendingHTML = `<div style="max-width: 600px; margin: auto; background: white; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0;"><div style="background: #f59e0b; padding: 30px; text-align: center; color: white;"><h1 style="margin: 0; font-size: 24px;">Menunggu Pembayaran ⏳</h1></div><div style="padding: 30px; color: #1e293b;"><p>Halo <strong>${coNama}</strong>,</p><p>Pesanan Anda telah dicatat dengan invoice <strong>#${inv}</strong>.</p><table style="width: 100%; background: #f8fafc; border-radius: 8px; margin-top: 10px; border-collapse: collapse;"><tr><td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">${namaProdukGabungan}${textBumpEmail}</td><td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold;">Rp${Number(tagihanAkhir).toLocaleString('id-ID')}</td></tr></table>${actionEmailHTML}<h3 style="color: #64748b; margin-top: 40px; border-bottom: 1px solid #e2e8f0; padding-bottom:10px;">🔐 Detail Akun Anda</h3><p><strong>Email Login:</strong> ${coEmail}<br><strong>Password:</strong> ${passAccount}<br><strong>URL Login:</strong> <a href="${loginUrl}" style="color: #2563eb;">Klik Disini</a></p></div></div>`;

          const finalEmailPendingHTML = `<div style="max-width: 600px; margin: auto; background: white; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0;"><div style="background: #f59e0b; padding: 30px; text-align: center; color: white;"><h1 style="margin: 0; font-size: 24px;">Menunggu Pembayaran</h1></div><div style="padding: 30px; color: #1e293b;"><p>${pendingEmailCopy}</p><table style="width: 100%; background: #f8fafc; border-radius: 8px; margin-top: 10px; border-collapse: collapse;"><tr><td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">${namaProdukGabungan}${textBumpEmail}</td><td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold;">Rp${Number(tagihanAkhir).toLocaleString('id-ID')}</td></tr></table>${actionEmailHTML}<h3 style="color: #64748b; margin-top: 40px; border-bottom: 1px solid #e2e8f0; padding-bottom:10px;">Detail Akun Anda</h3><p><strong>Email Login:</strong> ${coEmail}<br><strong>Password:</strong> ${passAccount}<br><strong>URL Login:</strong> <a href="${loginUrl}" style="color: #2563eb;">Klik Disini</a></p></div></div>`;
          try { await sendWA(settings, coWa, finalMsgPending); } catch(e) {}
          try { await sendEmail(settings, coEmail, "Menunggu Pembayaran: #" + inv, finalEmailPendingHTML); } catch(e) {}
          try { const affiliateOrder = await env.DB.prepare("SELECT * FROM orders WHERE invoice = ?").bind(inv).first(); if (affiliateOrder) await sendAffiliateOrderNotification(env, settings, affiliateOrder, "order"); } catch(e) {}

          if (tripayData) { return jsonRes({ status: 'success', invoice: inv, tagihan: tripayData.amount, pay_code: tripayData.pay_code, qr_url: tripayData.qr_url, payment_name: tripayData.payment_name, payment_url: tripayData.redirect_to_tripay ? tripayData.checkout_url : undefined, tripay_redirect: tripayData.redirect_to_tripay, bank_owner: bankOwner, is_new_user: isNewUser, password: passAccount, affiliate_stripped: affiliateStripped }); }
          return jsonRes({ status: 'success', invoice: inv, payment_url: pUrl, tagihan: grandTotal, bank_name: bankName, bank_norek: bankNorek, bank_owner: bankOwner, qr_url: qrisImageUrl, metode_pembayaran: isManualPayment ? "manual" : payMethod, is_new_user: isNewUser, password: passAccount, affiliate_stripped: affiliateStripped });
        }
        case 'update_order_status': {
          const orderSebelumnya = await env.DB.prepare("SELECT * FROM orders WHERE invoice = ?").bind(body.id).first();
          if (!orderSebelumnya) return jsonRes({ status: 'error', message: 'Order tidak ditemukan' });
          if (orderSebelumnya.status === 'Lunas') return jsonRes({ status: 'success', message: 'Order sudah Lunas' });
          await markOrderLunasAndNotify(orderSebelumnya, env, settings);
          return jsonRes({ status: 'success' });
        }

        case 'cancel_order': {
          const cancelInvoice = String(body.invoice || "").trim();
          const cancelEmail = String(body.email || "").toLowerCase().trim();
          if (!cancelInvoice || !cancelEmail) return jsonRes({ status: 'error', message: 'Data tidak lengkap' });
          const cancelOrder = await env.DB.prepare("SELECT status, id_produk FROM orders WHERE invoice = ? AND LOWER(email) = ?").bind(cancelInvoice, cancelEmail).first();
          if (!cancelOrder) return jsonRes({ status: 'error', message: 'Order tidak ditemukan' });
          if (cancelOrder.status === 'Lunas') return jsonRes({ status: 'error', message: 'Order sudah lunas, tidak bisa dibatalkan' });
          // Cancel invoice ini + semua order Pending lain untuk email + produk yang sama (bersihkan sisa duplikat)
          await env.DB.prepare("UPDATE orders SET status = 'Cancelled' WHERE LOWER(email) = ? AND UPPER(id_produk) = ? AND status = 'Pending'")
            .bind(cancelEmail, String(cancelOrder.id_produk || "").toUpperCase()).run();
          return jsonRes({ status: 'success' });
        }


		case 'save_product': {
          const p = body;
          const saveId = String(p.id || p.id_produk || "").toUpperCase();
          await ensureAffiliateSchema(env);
          await ensureCategorySchema(env);

          // TUKANG BANGUNAN OTOMATIS: Tambah kolom pdf_drive_id jika belum ada
          try { await env.DB.prepare(`ALTER TABLE access_rules ADD COLUMN pdf_drive_id TEXT`).run(); } catch(e) {}
          try { await env.DB.prepare(`ALTER TABLE access_rules ADD COLUMN webhook_url TEXT`).run(); } catch(e) {}
          try { await env.DB.prepare(`ALTER TABLE access_rules ADD COLUMN is_featured INTEGER DEFAULT 0`).run(); } catch(e) {}
          try { await env.DB.prepare(`ALTER TABLE access_rules ADD COLUMN panara_paket_id TEXT`).run(); } catch(e) {}

          const katName = String(p.kategori || 'Umum').trim();
          const katType = String(p.kategori_type || 'utama').trim() === 'variasi' ? 'variasi' : 'utama';
          // Pastikan kategori ada di tabel categories, kalau belum buat baru (dengan slug & type yang benar)
          try {
            const katSlug = await generateUniqueCategorySlug(env, katName);
            await env.DB.prepare("INSERT OR IGNORE INTO categories (name, sort_order, slug, type) VALUES (?, (SELECT COALESCE(MAX(sort_order),0)+1 FROM categories), ?, ?)").bind(katName, katSlug, katType).run();
          } catch(e) {}
          const catRow = await env.DB.prepare("SELECT id FROM categories WHERE name = ?").bind(katName).first();
          const catId = catRow ? catRow.id : null;

          const urlAltVal = String(p.url_alt || "").trim();
          // Sell bump tanpa URL akses sendiri akan pakai URL Cadangan/Alternatif produk ini sebagai fallback
          const bumpItems = parseBumpItems(p.bump_items).map(item => ({ ...item, url: item.url || urlAltVal }));
          const bumpMirror = bumpItems.find(item => item.status === "Active") || bumpItems[0] || null;
          const mirrorBumpStatus = bumpMirror ? bumpMirror.status : "Inactive";
          const mirrorBumpTitle = bumpMirror ? bumpMirror.title : "";
          const mirrorBumpPrice = bumpMirror ? bumpMirror.price : 0;
          const mirrorBumpDesc = bumpMirror ? bumpMirror.desc : "";
          const mirrorBumpUrl = bumpMirror ? bumpMirror.url : "";
          const bumpItemsJson = JSON.stringify(bumpItems);

          const parentProductId = String(p.parent_product_id || "").trim().toUpperCase() || null;
          const imageList = parseImageList(p.gambar_list);
          const gambarMirror = imageList[0] || String(p.gambar || "").trim();
          const gambarListJson = JSON.stringify(imageList.length ? imageList : (gambarMirror ? [gambarMirror] : []));

          // Akses 1-5: link akses tambahan di luar "Link Akses Materi" (Akses 1) & "URL Cadangan" (Akses 2)
          // yang sudah ada. Disimpan sebagai daftar terpisah, digabung jadi 1 daftar utuh saat disajikan ke member.
          const accessListJson = JSON.stringify(parseImageList(p.access_list));

          let categoryIdList = parseCategoryIdList(p.category_ids);
          if (!categoryIdList.length && catId) categoryIdList = [catId];
          else if (categoryIdList.length && !categoryIdList.includes(catId) && catId) categoryIdList = [catId, ...categoryIdList.filter(id => id !== catId)];
          const categoryIdsJson = JSON.stringify(categoryIdList);

          const deskripsiVal = String(p.desc || p.deskripsi || "").trim();
          // URL Landing Page opsional: jika kosong, arahkan otomatis ke halaman checkout produk ini
          const lpUrlVal = String(p.lp_url || "").trim() || `/checkout?id=${encodeURIComponent(saveId)}`;

          // Kita bungkus semua proses database di dalam try agar jika error, catch menangkapnya
          try {
              if (String(p.is_edit) === "true") {
                  await env.DB.prepare(`
                      UPDATE access_rules
                      SET title=?, "desc"=?, url_akses=?, harga=?, status=?, lp_url=?, komisi=?, komisi_l2=?, komisi_l3=?,
                          bump_status=?, bump_title=?, bump_price=?, bump_desc=?, bump_url=?, bump_items=?,
                          gambar=?, kategori=?, category_id=?, harga_coret=?, pdf_drive_id=?, webhook_url=?, is_featured=?, affiliate_wajib_beli=?, panara_paket_id=?,
                          parent_product_id=?, gambar_list=?, category_ids=?, deskripsi=?, url=?, access_list=?
                      WHERE UPPER(id_produk)=?
                  `)
                  .bind(p.title, p.desc, p.url, p.harga, p.status, lpUrlVal, p.komisi, p.komisi_l2 || 0, p.komisi_l3 || 0,
                        mirrorBumpStatus, mirrorBumpTitle, mirrorBumpPrice, mirrorBumpDesc, mirrorBumpUrl, bumpItemsJson,
                        gambarMirror, katName, catId, p.harga_coret || '', p.pdf_drive_id || '', p.webhook_url || '', p.is_featured ? 1 : 0, p.affiliate_wajib_beli ? 1 : 0, p.panara_paket_id || '',
                        parentProductId, gambarListJson, categoryIdsJson, deskripsiVal, urlAltVal, accessListJson, saveId)
                  .run();
              } else {
                  await env.DB.prepare(`
                      INSERT INTO access_rules
                      (id_produk, title, "desc", url_akses, harga, status, lp_url, komisi, komisi_l2, komisi_l3,
                       bump_status, bump_title, bump_price, bump_desc, bump_url, bump_items, gambar,
                       kategori, category_id, harga_coret, pdf_drive_id, webhook_url, is_featured, affiliate_wajib_beli, panara_paket_id,
                       parent_product_id, gambar_list, category_ids, deskripsi, url, access_list)
                      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                      ON CONFLICT(id_produk) DO UPDATE SET
                          title=excluded.title, "desc"=excluded."desc", url_akses=excluded.url_akses, harga=excluded.harga,
                          status=excluded.status, lp_url=excluded.lp_url, komisi=excluded.komisi, komisi_l2=excluded.komisi_l2,
                          komisi_l3=excluded.komisi_l3, bump_status=excluded.bump_status, bump_title=excluded.bump_title,
                          bump_price=excluded.bump_price, bump_desc=excluded.bump_desc, bump_url=excluded.bump_url,
                          bump_items=excluded.bump_items, gambar=excluded.gambar, kategori=excluded.kategori,
                          category_id=excluded.category_id, harga_coret=excluded.harga_coret, pdf_drive_id=excluded.pdf_drive_id,
                          webhook_url=excluded.webhook_url, is_featured=excluded.is_featured,
                          affiliate_wajib_beli=excluded.affiliate_wajib_beli, panara_paket_id=excluded.panara_paket_id,
                          parent_product_id=excluded.parent_product_id, gambar_list=excluded.gambar_list,
                          category_ids=excluded.category_ids, deskripsi=excluded.deskripsi, url=excluded.url, access_list=excluded.access_list
                  `)
                  .bind(saveId, p.title, p.desc, p.url, p.harga, p.status, lpUrlVal, p.komisi, p.komisi_l2 || 0, p.komisi_l3 || 0,
                        mirrorBumpStatus, mirrorBumpTitle, mirrorBumpPrice, mirrorBumpDesc, mirrorBumpUrl, bumpItemsJson,
                        gambarMirror, katName, catId, p.harga_coret || '', p.pdf_drive_id || '', p.webhook_url || '', p.is_featured ? 1 : 0, p.affiliate_wajib_beli ? 1 : 0, p.panara_paket_id || '',
                        parentProductId, gambarListJson, categoryIdsJson, deskripsiVal, urlAltVal, accessListJson)
                  .run();
              }
              return jsonRes({ status: 'success' });
          } catch (e) {
              return jsonRes({ status: 'error', message: e.message });
          }
        }
        case 'save_coupon': {
          const cpnKategori = String(body.kategori || 'Umum').trim() || 'Umum';
          const cpnAllowClone = (body.allow_affiliate_clone === true || body.allow_affiliate_clone === 'true' || body.allow_affiliate_clone === 1) ? 1 : 0;
          await env.DB.prepare("INSERT OR REPLACE INTO coupons (kode_promo, tipe, nilai, status, berlaku_untuk_prod, kategori, allow_affiliate_clone) VALUES (?,?,?,?,?,?,?)").bind((body.code || body.kode_promo || "").toUpperCase(), body.type || body.tipe, body.val || body.nilai, body.status, body.products || body.berlaku_untuk_prod || "All", cpnKategori, cpnAllowClone).run();
          return jsonRes({ status: 'success' });
        }

        case 'delete_coupon': {
          await env.DB.prepare("DELETE FROM coupons WHERE kode_promo = ?").bind((body.code || body.kode_promo || "").toUpperCase()).run();
          await env.DB.prepare("DELETE FROM affiliate_coupons WHERE base_kode = ?").bind((body.code || body.kode_promo || "").toUpperCase()).run();
          return jsonRes({ status: 'success', message: 'Kupon dihapus' });
        }

        case 'get_affiliate_base_coupons': {
          await ensureD1Schema(env);
          const baseCoupons = await safeAll(env, "SELECT kode_promo, tipe, nilai FROM coupons WHERE status = 'Active' AND allow_affiliate_clone = 1 ORDER BY kode_promo ASC");
          return jsonRes({ status: 'success', data: baseCoupons });
        }

        case 'get_my_affiliate_coupons': {
          await ensureD1Schema(env);
          const macEmail = String(body.email || "").trim().toLowerCase();
          if (!macEmail) return jsonRes({ status: 'error', message: 'Email diperlukan' });
          const macRows = await safeAll(env, "SELECT * FROM affiliate_coupons WHERE LOWER(owner_email) = ? ORDER BY tanggal_buat DESC", [macEmail]);
          const macUsage = await safeAll(env, "SELECT kode_promo, COUNT(*) as n FROM orders WHERE kode_promo IN (SELECT kode_promo FROM affiliate_coupons WHERE LOWER(owner_email) = ?) AND status IN ('Lunas','Success') GROUP BY kode_promo", [macEmail]);
          const usageMap = {};
          (macUsage || []).forEach(r => { usageMap[r.kode_promo] = r.n; });
          const data = macRows.map(r => ({ kode_promo: r.kode_promo, base_kode: r.base_kode, status: r.status, tanggal_buat: r.tanggal_buat, penggunaan: usageMap[r.kode_promo] || 0 }));
          return jsonRes({ status: 'success', data });
        }

        case 'create_affiliate_coupon': {
          await ensureD1Schema(env);
          const cacEmail = String(body.email || "").trim().toLowerCase();
          const cacBaseKode = String(body.base_kode || "").trim().toUpperCase();
          const cacKode = String(body.kode_promo || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
          if (!cacEmail) return jsonRes({ status: 'error', message: 'Email diperlukan' });
          if (!cacBaseKode) return jsonRes({ status: 'error', message: 'Pilih kupon utama terlebih dahulu' });
          if (!cacKode) return jsonRes({ status: 'error', message: 'Kode kupon tidak valid' });

          const cacUser = await env.DB.prepare("SELECT * FROM users WHERE LOWER(email) = ?").bind(cacEmail).first();
          if (!cacUser) return jsonRes({ status: 'error', message: 'Akun member tidak ditemukan' });
          const cacOwnerRef = getAffiliateUserRefs(cacUser, cacEmail)[0] || cacEmail;

          const cacBase = await env.DB.prepare("SELECT * FROM coupons WHERE kode_promo = ? AND status = 'Active' AND allow_affiliate_clone = 1").bind(cacBaseKode).first();
          if (!cacBase) return jsonRes({ status: 'error', message: 'Kupon utama tidak tersedia' });

          const cacClashCoupon = await env.DB.prepare("SELECT kode_promo FROM coupons WHERE kode_promo = ?").bind(cacKode).first();
          const cacClashAff = await env.DB.prepare("SELECT kode_promo FROM affiliate_coupons WHERE kode_promo = ?").bind(cacKode).first();
          if (cacClashCoupon || cacClashAff) return jsonRes({ status: 'error', message: 'Kode kupon sudah dipakai, coba kode lain' });

          await env.DB.prepare("INSERT INTO affiliate_coupons (kode_promo, base_kode, owner_ref, owner_email, status, tanggal_buat) VALUES (?,?,?,?,?,?)")
            .bind(cacKode, cacBaseKode, cacOwnerRef, cacEmail, 'Active', new Date().toISOString()).run();
          return jsonRes({ status: 'success', message: 'Kupon kamu berhasil dibuat!', kode_promo: cacKode });
        }
case 'delete_product': {
          await env.DB.prepare("DELETE FROM access_rules WHERE UPPER(id_produk) = ?").bind(String(body.id || "").toUpperCase()).run();
          return jsonRes({ status: 'success', message: 'Produk dihapus' });
        }
        case 'bulk_edit_products': {
          const ids = Array.isArray(body.ids) ? body.ids : [];
          const fields = body.fields || {};
          if (!ids.length) return jsonRes({ status: 'error', message: 'Tidak ada produk yang dipilih' });
          const ALLOWED_FIELDS = ['kategori', 'harga', 'harga_coret', 'status', 'komisi', 'komisi_l2', 'komisi_l3', 'affiliate_wajib_beli'];
          const setClauses = [];
          const vals = [];
          for (const key of ALLOWED_FIELDS) {
            if (fields[key] !== undefined && fields[key] !== null && fields[key] !== '') {
              setClauses.push(`${key}=?`);
              vals.push(fields[key]);
            }
          }
          if (!setClauses.length) return jsonRes({ status: 'error', message: 'Tidak ada field yang diubah' });
          // Kalau kategori diubah, sync category_id sekalian
          if (fields.kategori) {
            const beKatName = String(fields.kategori).trim();
            try {
              const beKatSlug = await generateUniqueCategorySlug(env, beKatName);
              await env.DB.prepare("INSERT OR IGNORE INTO categories (name, sort_order, slug, type) VALUES (?, (SELECT COALESCE(MAX(sort_order),0)+1 FROM categories), ?, 'utama')").bind(beKatName, beKatSlug).run();
            } catch(e) {}
            const beCatRow = await env.DB.prepare("SELECT id FROM categories WHERE name = ?").bind(beKatName).first();
            if (beCatRow) { setClauses.push('category_id=?'); vals.push(beCatRow.id); }
          }
          const placeholders = ids.map(() => '?').join(',');
          vals.push(...ids.map(id => String(id).toUpperCase()));
          try {
            await env.DB.prepare(`UPDATE access_rules SET ${setClauses.join(', ')} WHERE UPPER(id_produk) IN (${placeholders})`).bind(...vals).run();
            return jsonRes({ status: 'success', message: `${ids.length} produk berhasil diperbarui` });
          } catch(e) {
            return jsonRes({ status: 'error', message: e.message });
          }
        }
        case 'bulk_grant_access': {
          await ensureD1Schema(env);
          const bgEmails = Array.isArray(body.emails) ? body.emails : [];
          const bgProdId = String(body.id_produk || "").toUpperCase();
          const bgSendNotif = body.send_notif !== false;
          if (!bgProdId || !bgEmails.length) return jsonRes({ status: 'error', message: 'Data tidak lengkap' });

          const bgProduct = await env.DB.prepare("SELECT * FROM access_rules WHERE UPPER(id_produk) = ?").bind(bgProdId).first();
          if (!bgProduct) return jsonRes({ status: 'error', message: 'Produk tidak ditemukan' });

          const bgResults = [];
          for (const rawEmail of bgEmails) {
            const bgEmail = String(rawEmail || "").toLowerCase().trim();
            if (!bgEmail || !bgEmail.includes('@')) {
              bgResults.push({ email: rawEmail || "", status: 'error', message: 'Email tidak valid' });
              continue;
            }
            try {
              let bgUser = await env.DB.prepare("SELECT * FROM users WHERE LOWER(email) = ?").bind(bgEmail).first();
              let bgIsNew = false;
              let bgPass = "";
              if (!bgUser) {
                bgIsNew = true;
                bgPass = Math.random().toString(36).slice(-6);
                const bgNama = bgEmail.split('@')[0];
                await env.DB.prepare("INSERT INTO users (id_user, email, password, nama, role, tanggal_daftar, whatsapp, affiliate) VALUES (?,?,?,?,'member',?,?,?)")
                  .bind('USR-' + Date.now() + '-' + Math.floor(Math.random()*9999), bgEmail, bgPass, bgNama, new Date().toISOString(), "", "").run();
                bgUser = { nama: bgNama, whatsapp: "", password: bgPass };
              } else {
                bgPass = bgUser.password || "";
              }

              const bgExisting = await env.DB.prepare(
                "SELECT invoice FROM orders WHERE LOWER(email) = ? AND UPPER(id_produk) = ? AND status IN ('Lunas','Success')"
              ).bind(bgEmail, bgProdId).first();
              if (bgExisting) {
                bgResults.push({ email: bgEmail, status: 'skipped', new_user: false });
                continue;
              }

              const bgInv = 'INV-MANUAL-' + Date.now() + '-' + Math.floor(Math.random()*9999);
              await env.DB.prepare(
                "INSERT INTO orders (invoice, email, nama, whatsapp, id_produk, nama_produk, harga_total, status, tanggal_order, affiliate, komisi, reminder_level, is_new_account, temp_password) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
              ).bind(bgInv, bgEmail, bgUser.nama || bgEmail.split('@')[0], bgUser.whatsapp || "", bgProdId, bgProduct.title, 0, 'Lunas', new Date().toISOString(), "", 0, 0, bgIsNew ? 1 : 0, bgIsNew ? bgPass : "").run();

              if (bgSendNotif) {
                try {
                  const bgOrder = await env.DB.prepare("SELECT * FROM orders WHERE invoice = ?").bind(bgInv).first();
                  if (bgOrder) await sendPaidNotification(bgOrder, settings, env);
                } catch(e) {}
              }

              bgResults.push({ email: bgEmail, status: 'success', new_user: bgIsNew, password: bgIsNew ? bgPass : "" });
            } catch(e) {
              bgResults.push({ email: bgEmail, status: 'error', message: e.message });
            }
          }

          const bgSummary = {
            success: bgResults.filter(r => r.status === 'success').length,
            skipped: bgResults.filter(r => r.status === 'skipped').length,
            error: bgResults.filter(r => r.status === 'error').length
          };
          return jsonRes({ status: 'success', results: bgResults, summary: bgSummary });
        }

        case 'save_page': {
          await ensureD1Schema(env);
          let rawSlug = String(body.slug || body.title || "page-baru").trim().toLowerCase(); let cleanSlug = rawSlug.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
          const isEditMode = String(body.is_edit) === "true"; let reqId = String(body.id || body.id_page || "").trim();
          const pageType = String(body.page_type || 'lp');
          const pageIcon = String(body.icon || '📄');
          const sortOrder = parseInt(body.sort_order || 0) || 0;
          const jenisHalaman = String(body.jenis_halaman || '');
          const pageKategori = String(body.kategori || 'Umum').trim() || 'Umum';
          const seoTitle = String(body.seo_title || '');
          const seoDesc = String(body.seo_description || '');
          const seoKeywords = String(body.seo_keywords || '');
          const seoImage = String(body.seo_image || '');
          const gaId = String(body.ga_id || '');
          const metaPixelId = String(body.meta_pixel_id || '');

          if (isEditMode && reqId !== "" && reqId.toLowerCase() !== "undefined" && reqId.toLowerCase() !== "null") {
              await env.DB.prepare("UPDATE pages SET slug=?, title=?, content=?, status=?, page_type=?, icon=?, sort_order=?, jenis_halaman=?, category=?, seo_title=?, seo_description=?, seo_keywords=?, seo_image=?, ga_id=?, meta_pixel_id=? WHERE id_page=?").bind(cleanSlug, body.title, body.content, body.status || "Active", pageType, pageIcon, sortOrder, jenisHalaman, pageKategori, seoTitle, seoDesc, seoKeywords, seoImage, gaId, metaPixelId, reqId).run();
          } else {
              let newId = 'PG-' + Date.now() + Math.floor(Math.random() * 1000);
              const cekSlug = await env.DB.prepare("SELECT id_page FROM pages WHERE slug = ?").bind(cleanSlug).first();
              if (cekSlug) { cleanSlug = cleanSlug + '-' + Math.floor(Math.random() * 1000); }
              await env.DB.prepare("INSERT INTO pages (id_page, slug, title, content, status, tanggal_buat, page_type, icon, sort_order, jenis_halaman, category, seo_title, seo_description, seo_keywords, seo_image, ga_id, meta_pixel_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(newId, cleanSlug, body.title, body.content, body.status || "Active", new Date().toLocaleDateString(), pageType, pageIcon, sortOrder, jenisHalaman, pageKategori, seoTitle, seoDesc, seoKeywords, seoImage, gaId, metaPixelId).run();
          }
          return jsonRes({ status: 'success' });
        }
          
        case 'delete_page': {
          await env.DB.prepare("DELETE FROM pages WHERE id_page = ?").bind(body.id).run();
          return jsonRes({ status: 'success', message: 'Halaman dihapus' });
        }

        case 'update_settings': {
          for (const [k, v] of Object.entries(body.payload || {})) { 
              await env.DB.prepare("INSERT OR REPLACE INTO settings (kunci, nilai) VALUES (?, ?)").bind(k, String(v)).run();
          }
          return jsonRes({ status: 'success' });
        }

        case 'update_rekening': {
          const rekDetail = `${String(body.bank || "")} - ${String(body.norek || "")} (a.n ${String(body.nama || "")})`;
          await env.DB.prepare("UPDATE users SET rekening = ? WHERE LOWER(email) = ?").bind(rekDetail, String(body.email).toLowerCase()).run();
          return jsonRes({ status: 'success', message: 'Data rekening berhasil disimpan!' });
        }

        case 'change_password': {
          const pwdEmail = String(body.email || "").trim().toLowerCase();
          const checkPwd = await env.DB.prepare("SELECT email FROM users WHERE LOWER(email) = ? AND password = ?").bind(pwdEmail, String(body.old_password || "")).first();
          if(!checkPwd) return jsonRes({status: 'error', message: 'Password lama salah!'});
          await env.DB.prepare("UPDATE users SET password = ? WHERE LOWER(email) = ?").bind(String(body.new_password || ""), pwdEmail).run();
          return jsonRes({ status: 'success', message: 'Password berhasil diubah' });
        }
          
        case 'purge_cf_cache': {
          if (!settings.cf_zone_id || !settings.cf_api_token) return jsonRes({ status: 'error', message: 'Token CF belum diatur' });
          await fetch(`https://api.cloudflare.com/client/v4/zones/${settings.cf_zone_id}/purge_cache`, { method: 'POST', headers: { 'Authorization': `Bearer ${settings.cf_api_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ purge_everything: true }) });
          return jsonRes({ status: 'success', message: 'Cache Bersih' });
        }

        case 'takeover_domain': {
          await env.DB.prepare("UPDATE orders SET domain = ? WHERE LOWER(email) = ? AND id_produk = 'SF1D' AND status = 'Lunas'").bind(body.domain, String(body.email).toLowerCase()).run();
          return jsonRes({ status: 'success', message: 'Domain dipindahkan' });
        }
          
        case 'get_ik_auth': {
          const privateKey = settings.ik_private_key;
          if (!privateKey) return jsonRes({ status: 'error', message: 'Private Key ImageKit belum diisi di Pengaturan.' });
          const token = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
          const expire = Math.floor(Date.now() / 1000) + 1800;
          const enc = new TextEncoder();
          const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(privateKey), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
          const signatureBuffer = await crypto.subtle.sign("HMAC", keyMaterial, enc.encode(token + expire));
          const signatureHex = Array.from(new Uint8Array(signatureBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
          return jsonRes({ status: 'success', token: token, expire: expire, signature: signatureHex });
        }

        case 'reset_commission': {
          await ensureAffiliateSchema(env);
          let usr = null;
          try { usr = await env.DB.prepare("SELECT * FROM users WHERE id_user = ?").bind(body.aff_id).first(); } catch(e) {}
          if(!usr) { try { usr = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(body.aff_id).first(); } catch(e) {} }
          if(!usr) { try { usr = await env.DB.prepare("SELECT * FROM users WHERE LOWER(email) = ?").bind(String(body.aff_id || "").toLowerCase()).first(); } catch(e) {} }
          const affEmail = usr && usr.email ? String(usr.email).toLowerCase() : "UNKNOWN";
          const payoutSummary = await getAffiliatePayoutSummary(env, body.aff_id, usr);
          const payoutRefs = payoutSummary && payoutSummary.refs && payoutSummary.refs.length ? payoutSummary.refs : [body.aff_id, affEmail].filter(Boolean);
          for (const ref of payoutRefs) {
            const refLower = String(ref || "").toLowerCase();
            await env.DB.prepare("UPDATE orders SET komisi = CASE WHEN komisi > 0 THEN (komisi * -1) ELSE komisi END, komisi_l1 = CASE WHEN komisi_l1 > 0 THEN (komisi_l1 * -1) ELSE komisi_l1 END WHERE (affiliate = ? OR LOWER(affiliate) = ? OR affiliate_l1 = ? OR LOWER(affiliate_l1) = ?) AND (status = 'Lunas' OR status = 'Success') AND (komisi > 0 OR komisi_l1 > 0)").bind(ref, refLower, ref, refLower).run();
            await env.DB.prepare("UPDATE orders SET komisi_l2 = (komisi_l2 * -1) WHERE (affiliate_l2 = ? OR LOWER(affiliate_l2) = ?) AND (status = 'Lunas' OR status = 'Success') AND komisi_l2 > 0").bind(ref, refLower).run();
            await env.DB.prepare("UPDATE orders SET komisi_l3 = (komisi_l3 * -1) WHERE (affiliate_l3 = ? OR LOWER(affiliate_l3) = ?) AND (status = 'Lunas' OR status = 'Success') AND komisi_l3 > 0").bind(ref, refLower).run();
          }
          try { await sendAffiliatePayoutNotification(settings, payoutSummary); } catch(e) {}
          return jsonRes({ status: 'success' });
        }
          
       case 'save_lms_materi': {
          const lmsId = String(body.product_id || body.id || "").toUpperCase();
          if (!lmsId) return jsonRes({ status: 'error', message: 'ID Produk tidak valid' });

          const vVideos = String(body.videos || "[]");
          const vDesc = String(body.desc || "");
          const cL1 = String(body.cert_leader1 || "");
          const cR1 = String(body.cert_role1 || "");
          const cL2 = String(body.cert_leader2 || "");
          const cR2 = String(body.cert_role2 || "");
          const cS = String(body.cert_stamp || "");
          const cTpl = ['formal', 'modern', 'minimalis'].includes(String(body.cert_template || '').trim()) ? String(body.cert_template).trim() : 'formal';
          const cSignCount = String(body.cert_sign_count || '2') === '1' ? '1' : '2';
          const cSign1Img = String(body.cert_sign1_img || "");
          const cSign2Img = String(body.cert_sign2_img || "");
          const cStampImg = String(body.cert_stamp_img || "");
          const vProductIds = splitProductTargets(body.product_ids || "").join(",");
          const vKategori = String(body.kategori || "Umum").trim() || "Umum";

          const newColumns = ['deskripsi', 'cert_leader1', 'cert_role1', 'cert_leader2', 'cert_role2', 'cert_stamp', 'cert_template', 'cert_sign_count', 'cert_sign1_img', 'cert_sign2_img', 'cert_stamp_img'];
          for (const col of newColumns) {
              try { await env.DB.prepare(`ALTER TABLE lms ADD COLUMN ${col} TEXT`).run(); } catch(e) {}
          }
          try { await env.DB.prepare(`ALTER TABLE lms ADD COLUMN "desc" TEXT`).run(); } catch(e) {}
          try { await env.DB.prepare(`ALTER TABLE lms ADD COLUMN id_produk TEXT`).run(); } catch(e) {}
          try { await env.DB.prepare(`ALTER TABLE lms ADD COLUMN product_id TEXT`).run(); } catch(e) {}
          try { await env.DB.prepare(`ALTER TABLE lms ADD COLUMN product_ids TEXT`).run(); } catch(e) {}
          try { await env.DB.prepare(`ALTER TABLE lms ADD COLUMN kategori TEXT`).run(); } catch(e) {}

          try {
              let checkLms = await env.DB.prepare("SELECT * FROM lms WHERE UPPER(id_produk) = ? OR UPPER(product_id) = ?").bind(lmsId, lmsId).first();

              if (checkLms) {
                  await env.DB.prepare(`UPDATE lms SET videos=?, deskripsi=?, "desc"=?, cert_leader1=?, cert_role1=?, cert_leader2=?, cert_role2=?, cert_stamp=?, cert_template=?, cert_sign_count=?, cert_sign1_img=?, cert_sign2_img=?, cert_stamp_img=?, product_ids=?, kategori=? WHERE UPPER(id_produk)=? OR UPPER(product_id)=?`)
                        .bind(vVideos, vDesc, vDesc, cL1, cR1, cL2, cR2, cS, cTpl, cSignCount, cSign1Img, cSign2Img, cStampImg, vProductIds, vKategori, lmsId, lmsId).run();
              } else {
                  await env.DB.prepare(`INSERT INTO lms (id_produk, product_id, videos, deskripsi, "desc", cert_leader1, cert_role1, cert_leader2, cert_role2, cert_stamp, cert_template, cert_sign_count, cert_sign1_img, cert_sign2_img, cert_stamp_img, product_ids, kategori) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
                        .bind(lmsId, lmsId, vVideos, vDesc, vDesc, cL1, cR1, cL2, cR2, cS, cTpl, cSignCount, cSign1Img, cSign2Img, cStampImg, vProductIds, vKategori).run();
              }
              return jsonRes({ status: 'success' });
          } catch (err) {
              console.log("❌ Error Real DB LMS: ", err.message);
              return jsonRes({ status: 'error', message: 'Error DB LMS: ' + err.message });
          }
        }

        case 'get_lms_materi': {
          const lmsId = String(body.product_id || body.id || "").trim().toUpperCase();
          try {
            let resLms = await env.DB.prepare("SELECT * FROM lms WHERE UPPER(id_produk) = ?").bind(lmsId).first();
            if(!resLms) { resLms = await env.DB.prepare("SELECT * FROM lms WHERE UPPER(product_id) = ?").bind(lmsId).first(); }
            const resolvedProductIds = resLms ? (resLms.product_ids || resLms.id_produk || resLms.product_id || lmsId) : lmsId;
            return jsonRes({
              status: 'success',
              data: {
                id_produk: lmsId, product_id: lmsId, product_ids: resolvedProductIds,
                videos: resLms ? (resLms.videos || '[]') : '[]', deskripsi: resLms ? (resLms.deskripsi || resLms.desc || '') : '',
                cert_leader1: resLms ? (resLms.cert_leader1 || '') : '', cert_role1: resLms ? (resLms.cert_role1 || '') : '', cert_leader2: resLms ? (resLms.cert_leader2 || '') : '', cert_role2: resLms ? (resLms.cert_role2 || '') : '', cert_stamp: resLms ? (resLms.cert_stamp || '') : '', cert_template: resLms ? (resLms.cert_template || 'formal') : 'formal',
                cert_sign_count: resLms ? (resLms.cert_sign_count || '2') : '2', cert_sign1_img: resLms ? (resLms.cert_sign1_img || '') : '', cert_sign2_img: resLms ? (resLms.cert_sign2_img || '') : '', cert_stamp_img: resLms ? (resLms.cert_stamp_img || '') : ''
              }
            });
          } catch (e) { return jsonRes({ status: 'success', data: { id_produk: lmsId, product_ids: lmsId, videos: '[]', deskripsi: 'Materi belum tersedia.' } }); }
        }

        case 'run_cron': {
          const cronToken = String(env.CRON_TOKEN || settings.cron_token || "").trim();
          if (!cronToken || body.token !== cronToken) return jsonRes({ status: 'error', message: 'Akses Ditolak' });
          const pOrders = await safeAll(env, "SELECT * FROM orders WHERE status = 'Pending' AND (reminder_level IS NULL OR reminder_level < 4) AND (group_invoice IS NULL OR group_invoice = '')");
          const nowCron = new Date(); let countSent = 0; let countEmail = 0;

          for (const ord of pOrders) {
            let orderDate = new Date(ord.tanggal_order);
            if (isNaN(orderDate)) {
               const parts = String(ord.tanggal_order).split(/[\s/:-]+/); 
               if(parts.length >= 3) {
                 const yy = parts[2].length === 4 ? parts[2] : parts[0]; const dd = parts[2].length === 4 ? parts[0] : parts[2]; const mm = parts[1];
                 orderDate = new Date(`${yy}-${mm}-${dd}T00:00:00Z`);
               }
            }
            if (isNaN(orderDate)) continue; 

            const diffHours = (nowCron - orderDate) / (1000 * 60 * 60);
            let currentLevel = Number(ord.reminder_level) || 0; let nextLevel = currentLevel; let reminderLevel = 0;
            const hrgTotal = Number(ord.harga_total) || 0; const nominalFormatted = 'Rp ' + hrgTotal.toLocaleString('id-ID');
            const landingUrl = await getOrderLandingUrl(env, settings, ord);

            if (diffHours >= 24) {
              await env.DB.prepare("UPDATE orders SET status = 'Cancelled', reminder_level = 4 WHERE invoice = ?").bind(ord.invoice).run();
              await env.DB.prepare("UPDATE orders SET status = 'Cancelled', reminder_level = 4 WHERE group_invoice = ? AND status != 'Lunas'").bind(ord.invoice).run();
              const sent = await sendPaymentReminderNotification(settings, ord, nominalFormatted, landingUrl, 4);
              countSent++; if (sent.emailAttempted) countEmail++;
            }
            else if (diffHours >= 2 && currentLevel === 0) {
              reminderLevel = 1;
              nextLevel = 1;
            }
            else if (diffHours >= 6 && currentLevel === 1) {
              reminderLevel = 2;
              nextLevel = 2;
            }
            else if (diffHours >= 12 && currentLevel === 2) {
              reminderLevel = 3;
              nextLevel = 3;
            }

            if (reminderLevel > 0 && nextLevel !== currentLevel) {
              const sent = await sendPaymentReminderNotification(settings, ord, nominalFormatted, landingUrl, reminderLevel);
              await env.DB.prepare("UPDATE orders SET reminder_level = ? WHERE invoice = ?").bind(nextLevel, ord.invoice).run(); countSent++;
              if (sent.emailAttempted) countEmail++;
            }
          }
          return jsonRes({ status: 'success', message: `Cron berhasil. Mengirim ${countSent} pengingat WA dan ${countEmail} email.` });
        }

        case 'get_home_page': { return jsonRes({ status: 'success', data: null, message: 'Katalog Default' }); }

        case 'get_page': {
          const reqSlug = String(body.slug || '').trim().toLowerCase().replace(/[^a-z0-9\-]/g, '');
          if (!reqSlug) return jsonRes({ status: 'error', message: 'Slug diperlukan.' });
          const pg = await env.DB.prepare("SELECT title, content FROM pages WHERE slug = ? AND status = 'Active'").bind(reqSlug).first();
          if (!pg) return jsonRes({ status: 'error', message: 'Halaman tidak ditemukan.' });
          if (!(pg.content || '').includes('sf-member-page-type')) return jsonRes({ status: 'error', message: 'Akses ditolak.' });
          return jsonRes({ status: 'success', title: pg.title || '', content: pg.content || '' });
        }

        case 'register_member': {
          const existReg = await env.DB.prepare("SELECT email FROM users WHERE LOWER(email) = ?").bind(String(body.email).toLowerCase()).first();
          if(existReg) return jsonRes({ status: 'error', message: 'Email sudah terdaftar!' });
          const passReg = body.password || Math.random().toString(36).slice(-6);
          await env.DB.prepare(`INSERT INTO users (id_user, email, password, nama, role, tanggal_daftar, whatsapp, affiliate) VALUES (?, ?, ?, ?, 'member', ?, ?, ?)`).bind('USR-'+Date.now(), body.email, passReg, body.nama, new Date().toISOString(), body.whatsapp, body.affiliate || "-").run();
          try { await addToAutoresponder(settings, body.nama, body.email); } catch(e){}
          try { await sendEmail(settings, body.email, "Selamat Datang!", `<h2>Halo ${body.nama}</h2><p>Akun Anda aktif. Pass: ${passReg}</p>`); } catch(e){}
          return jsonRes({ status: 'success', message: 'Akun berhasil dibuat' });
        }

        case 'forgot_password': {
          const fEmail = String(body.email || "").trim().toLowerCase();
          if (!fEmail) return jsonRes({ status: 'error', message: 'Email tidak boleh kosong!' });
          try {
              const fUser = await env.DB.prepare("SELECT * FROM users WHERE LOWER(email) = ?").bind(fEmail).first();
              if (!fUser) return jsonRes({ status: 'error', message: 'Email tidak terdaftar di sistem kami.' });
              const fUserPassword = fUser.password; const fUserName = fUser.nama || 'Member';
              const emailHtml = `<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; color: #334155; line-height: 1.5;"><h2 style="color: #0f172a;">Halo, ${fUserName}!</h2><p>Kami menerima permintaan pengingat akses login untuk akun Anda.</p><p>Berikut adalah informasi login Anda yang tersimpan di sistem kami:</p><div style="background: #f8fafc; padding: 15px; border-left: 4px solid #00AAE7; margin: 20px 0; border-radius: 4px;"><strong>Alamat Email:</strong> ${fEmail}<br><br><strong>Password Anda:</strong> <span style="font-family: monospace; font-size: 1.1em; background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${fUserPassword}</span></div><p>Silakan login kembali menggunakan informasi di atas dan pastikan Anda menjaga kerahasiaan password ini.</p><br><p>Salam Sukses,<br><strong>Tim Admin</strong></p></div>`;
              await sendEmail(settings, fEmail, "🔒 Informasi Password Akun Member Anda", emailHtml);
              return jsonRes({ status: 'success', message: 'Sistem telah mengirim informasi password ke email Anda!' });
          } catch (error) { return jsonRes({ status: 'error', message: 'Sistem error: ' + error.message }); }
        }
        // ==========================================
        // 🔒 SISTEM LISENSI: AUTO-LOCK & VERIFY
        // ==========================================
        case 'verify_license': {
            const reqKey = String(body.license_key || "").trim();
            const reqDomain = normalizeDomainValue(body.domain || request.headers.get("host") || "");
            const updateUrl = normalizeBaseUrl(settings.master_update_url || env.MASTER_UPDATE_URL || "");

            if (!reqKey || !reqDomain) {
                return jsonRes({ status: 'error', valid: false, message: 'Lisensi atau Domain tidak terdeteksi.' });
            }

            // Cari order berdasarkan license_key yang LUNAS
            const check = await env.DB.prepare("SELECT * FROM orders WHERE license_key = ? AND status IN ('Lunas', 'Success')").bind(reqKey).first();

            if (!check) {
                return jsonRes({ status: 'error', valid: false, message: 'Lisensi tidak ditemukan atau belum berstatus Lunas.' });
            }

            // SKENARIO 1: AKTIVASI PERTAMA KALI (KOLOM DOMAIN MASIH KOSONG)
            if (!check.domain || check.domain.trim() === '') {
                await env.DB.prepare("UPDATE orders SET domain = ? WHERE license_key = ?").bind(reqDomain, reqKey).run();
                return jsonRes({ 
                    status: 'success', 
                    valid: true, 
                    message: 'Lisensi berhasil diaktivasi dan dikunci ke domain ini.',
                    data: { produk: check.nama_produk, email: check.email, domain: reqDomain, version: APP_VERSION, update_url: updateUrl } 
                });
            }

            // SKENARIO 2: VERIFIKASI RUTIN (SUDAH DIKUNCI SEBELUMNYA)
            if (check.domain.includes(reqDomain) || reqDomain.includes(check.domain)) {
                 return jsonRes({ status: 'success', valid: true, message: 'Lisensi Valid', data: { produk: check.nama_produk, email: check.email, domain: check.domain, version: APP_VERSION, update_url: updateUrl } });
            } else {
                 return jsonRes({ 
                     status: 'error', 
                     valid: false, 
                     message: `Lisensi ini sudah terdaftar untuk domain lain.` 
                 });
            }
        }

        // ==========================================
        // 🔄 FITUR GANTI DOMAIN (MASTER SIDE)
        // ==========================================
        case 'reset_license_domain': {
            const reqKey = String(body.license_key || "").trim();
            if (!reqKey) return jsonRes({ status: 'error', message: 'License Key wajib diisi.' });

            // Kosongkan kolom domain agar bisa diaktivasi ulang di domain baru
            await env.DB.prepare("UPDATE orders SET domain = '' WHERE license_key = ?").bind(reqKey).run();
            
            return jsonRes({ 
                status: 'success', 
                message: 'Lisensi siap diaktivasi ulang di domain baru.' 
            });
        }
// ==========================================
        // 🔄 FITUR GANTI DOMAIN OTOMATIS (KLIEN SELF-SERVICE)
        // ==========================================
        case 'self_reset_domain': {
            const reqKey = String(body.license_key || "").trim();
            const reqEmail = String(body.email || "").trim().toLowerCase();

            if (!reqKey || !reqEmail) {
                return jsonRes({ status: 'error', message: 'Lisensi dan Email wajib diisi.' });
            }

            // Keamanan: Pastikan lisensi dan email pendaftarannya cocok!
            const checkData = await env.DB.prepare("SELECT * FROM orders WHERE license_key = ? AND LOWER(email) = ? AND status IN ('Lunas', 'Success')").bind(reqKey, reqEmail).first();

            if (!checkData) {
                return jsonRes({ status: 'error', message: 'Verifikasi Gagal! Email tidak cocok dengan pemilik lisensi ini.' });
            }

            // Jika cocok, kosongkan kolom domain agar siap dikunci di domain baru
            await env.DB.prepare("UPDATE orders SET domain = '' WHERE license_key = ?").bind(reqKey).run();
            
            return jsonRes({ status: 'success', message: 'Domain lama berhasil dihapus. Sistem akan otomatis mengunci lisensi di domain baru ini.' });
        }
        // ========================
        // FITUR BARU: BLAST PESAN
        // ========================
        case 'preview_blast_targets': { return await handlePreviewBlastTargets(env, body); }
        case 'send_blast_batch': { return await handleSendBlastBatch(env, settings, body); }

        // ========================
        // FITUR BARU: IMPORT YOUTUBE PLAYLIST
        // ========================
        case 'import_youtube_playlist': { return await handleImportYoutubePlaylist(body, settings, env); }

        // ========================
        // FITUR BARU: DELETE ORDER
        // ========================
        case 'delete_order': {
          const invoice = String(body.invoice || body.id || "").trim();
          if (!invoice) return jsonRes({ status: 'error', message: 'Invoice wajib diisi.' }, 400);
          const existingOrder = await env.DB.prepare("SELECT invoice FROM orders WHERE invoice = ?").bind(invoice).first();
          if (!existingOrder) return jsonRes({ status: 'error', message: 'Order tidak ditemukan.' }, 404);
          await env.DB.prepare("DELETE FROM orders WHERE invoice = ?").bind(invoice).run();
          return jsonRes({ status: 'success', message: 'Order berhasil dihapus.' });
        }

        // ========================
        // FITUR BARU: BULK DELETE PRODUCTS
        // ========================
        case 'bulk_delete_products': {
          const ids = Array.isArray(body.ids) ? body.ids : String(body.ids || "").split(",");
          const cleanIds = Array.from(new Set(ids.map(id => String(id || "").trim().toUpperCase()).filter(Boolean)));
          if (!cleanIds.length) return jsonRes({ status: 'error', message: 'Tidak ada produk yang dipilih.' });
          let deleted = 0;
          for (const id of cleanIds) {
            try {
              const result = await env.DB.prepare("DELETE FROM access_rules WHERE UPPER(id_produk) = ?").bind(id).run();
              deleted += Number(result.meta && result.meta.changes ? result.meta.changes : 0);
            } catch(e) {}
          }
          return jsonRes({ status: 'success', deleted, ids: cleanIds });
        }

        // ========================
        // FITUR BARU: TEST WA GATEWAY
        // ========================
        case 'test_wa_gateway': {
          const allowedOverrideKeys = ["wa_gateway", "wa_api_url", "wa_token", "wa_admin"];
          const overrides = {};
          const rawOverrides = body.settings_override && typeof body.settings_override === "object" ? body.settings_override : {};
          for (const key of allowedOverrideKeys) {
            if (rawOverrides[key] !== undefined) overrides[key] = String(rawOverrides[key] || "");
          }
          const testSettings = { ...settings, ...overrides };
          const targetWa = normalizePhone(body.target || testSettings.wa_admin || "");
          if (!targetWa) return jsonRes({ status: 'error', message: 'Nomor WA Admin belum diisi atau belum valid.' });

          const providerName = String(testSettings.wa_gateway || "onesender").trim() || "onesender";
          const testMessage = `Tes notifikasi CloudMember via ${providerName} berhasil. Waktu: ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}`;
          const result = await sendWA(testSettings, targetWa, testMessage, { detailed: true });
          if (result.ok) {
            return jsonRes({ status: 'success', message: `Tes WhatsApp berhasil dikirim via ${result.provider || providerName}.` });
          }
          return jsonRes({ status: 'error', message: result.message || 'Tes WhatsApp gagal. Periksa token, endpoint, dan status device gateway.' });
        }

        case 'test_meta_capi': {
          const allowedOverrideKeys = ["meta_pixel_id", "meta_access_token", "meta_test_event_code", "meta_currency", "currency", "site_url", "meta_graph_api_version"];
          const overrides = {};
          const rawOverrides = body.settings_override && typeof body.settings_override === "object" ? body.settings_override : {};
          for (const key of allowedOverrideKeys) {
            if (rawOverrides[key] !== undefined) overrides[key] = String(rawOverrides[key] || "");
          }
          const testSettings = { ...settings, ...overrides };
          const latestPaidOrder = await env.DB.prepare("SELECT * FROM orders WHERE status IN ('Lunas', 'Success') ORDER BY rowid DESC LIMIT 1").first();
          if (!latestPaidOrder) return jsonRes({ status: 'error', message: 'Belum ada order lunas untuk pengujian Meta CAPI.' });

          try {
            const result = await sendMetaPurchase(latestPaidOrder, testSettings, env, { testMode: true, force: true });
            if (!result.sent) return jsonRes({ status: 'error', message: result.reason || 'Meta CAPI tidak menerima event test.' });
            return jsonRes({ status: 'success', message: `Test Meta CAPI berhasil. Event ID: ${result.event_id}`, data: result });
          } catch(e) {
            return jsonRes({ status: 'error', message: `Meta CAPI gagal: ${e.message}` });
          }
        }

        case 'sync_meta_purchases': {
          const allowedOverrideKeys = ["meta_pixel_id", "meta_access_token", "meta_currency", "currency", "site_url", "meta_graph_api_version"];
          const overrides = {};
          const rawOverrides = body.settings_override && typeof body.settings_override === "object" ? body.settings_override : {};
          for (const key of allowedOverrideKeys) {
            if (rawOverrides[key] !== undefined) overrides[key] = String(rawOverrides[key] || "");
          }
          const syncSettings = { ...settings, ...overrides };
          const result = await syncRecentMetaPurchases(env, syncSettings, { limit: body.limit || 50 });
          if (result.reason) return jsonRes({ status: 'error', message: result.reason, data: result });
          return jsonRes({
            status: result.failed > 0 && result.sent === 0 ? 'error' : 'success',
            message: `Sinkronisasi Meta selesai: ${result.sent} terkirim, ${result.failed} gagal dari ${result.checked || 0} order terbaru.`,
            data: result
          });
        }

        case 'bulk_save_products': {
          const products = Array.isArray(body.products) ? body.products : [];
          if (!products.length) return jsonRes({ status: 'error', message: 'Data produk kosong.' });
          if (products.length > 500) return jsonRes({ status: 'error', message: 'Maksimal 500 produk per import.' });

          await ensureD1Schema(env);
          try { await env.DB.prepare(`ALTER TABLE access_rules ADD COLUMN pdf_drive_id TEXT`).run(); } catch(e) {}
          try { await env.DB.prepare(`ALTER TABLE access_rules ADD COLUMN webhook_url TEXT`).run(); } catch(e) {}
          try { await env.DB.prepare(`ALTER TABLE access_rules ADD COLUMN is_featured INTEGER DEFAULT 0`).run(); } catch(e) {}
          try { await env.DB.prepare(`ALTER TABLE access_rules ADD COLUMN panara_paket_id TEXT`).run(); } catch(e) {}

          let imported = 0;
          let skipped = 0;
          const errors = [];

          for (let i = 0; i < products.length; i++) {
            const p = products[i] || {};
            const saveId = String(p.id || p.id_produk || "").trim().toUpperCase();
            const title = String(p.title || p.nama_produk || p.nama || "").trim();

            if (!saveId || !title) {
              skipped++;
              if (errors.length < 20) errors.push(`Baris ${i + 1}: ID produk atau nama produk kosong.`);
              continue;
            }

            const statusRaw = String(p.status || "Active").trim();
            const status = /^(inactive|nonaktif|draft|off)$/i.test(statusRaw) ? "Inactive" : "Active";
            const urlAkses = String(p.url || p.url_akses || "").trim() || `/akses-pdf.html?id=${encodeURIComponent(saveId)}`;
            const katName = String(p.kategori || "Ebook").trim() || "Ebook";
            const katType = String(p.kategori_type || 'utama').trim() === 'variasi' ? 'variasi' : 'utama';
            const parentProductId = String(p.parent_product_id || "").trim().toUpperCase() || null;
            const deskripsiVal = String(p.desc || p.deskripsi || "").trim();
            const urlAlt = String(p.url_alt || "").trim();

            try {
              try {
                const katSlug = await generateUniqueCategorySlug(env, katName);
                await env.DB.prepare("INSERT OR IGNORE INTO categories (name, sort_order, slug, type) VALUES (?, (SELECT COALESCE(MAX(sort_order),0)+1 FROM categories), ?, ?)").bind(katName, katSlug, katType).run();
              } catch(e) {}
              const catRow = await env.DB.prepare("SELECT id, type FROM categories WHERE name = ?").bind(katName).first();
              // Nama kategori unik di seluruh sistem — kalau nama yang dipakai sudah dipakai kategori dengan
              // tipe BEDA (mis. "Ebook" sudah ada sebagai kategori Produk biasa, tapi ini import Produk
              // Variasi), jangan diam-diam nempel ke kategori yang salah — hentikan baris ini & kasih tahu adminnya.
              if (catRow && catRow.type !== katType) {
                skipped++;
                if (errors.length < 20) errors.push(`Baris ${i + 1}: Kategori "${katName}" sudah dipakai sebagai kategori ${catRow.type === 'variasi' ? 'Produk Variasi' : 'Produk'} — pakai nama kategori lain untuk ${katType === 'variasi' ? 'Produk Variasi' : 'Produk'}.`);
                continue;
              }
              const catId = catRow ? catRow.id : null;

              // Multi-kategori: KATEGORI_LIST dipisah "|", tiap nama di-resolve/dibuat di tabel categories
              const kategoriListNames = String(p.kategori_list || "").split("|").map(s => s.trim()).filter(Boolean);
              const categoryIdList = [];
              if (catId) categoryIdList.push(catId);
              for (const catName of kategoriListNames) {
                try {
                  const extraSlug = await generateUniqueCategorySlug(env, catName);
                  await env.DB.prepare("INSERT OR IGNORE INTO categories (name, sort_order, slug, type) VALUES (?, (SELECT COALESCE(MAX(sort_order),0)+1 FROM categories), ?, ?)").bind(catName, extraSlug, katType).run();
                } catch(e) {}
                const extraCatRow = await env.DB.prepare("SELECT id FROM categories WHERE name = ?").bind(catName).first();
                if (extraCatRow && !categoryIdList.includes(extraCatRow.id)) categoryIdList.push(extraCatRow.id);
              }
              const categoryIdsJson = JSON.stringify(categoryIdList);

              // Multi-gambar: URL_GAMBAR_LIST dipisah "|"; URL_GAMBAR tunggal tetap jadi gambar utama/mirror
              const gambarUtama = String(p.gambar || p.url_gambar || "").trim();
              const gambarListExtra = String(p.gambar_list || "").split("|").map(s => s.trim()).filter(Boolean);
              const imageList = [];
              if (gambarUtama) imageList.push(gambarUtama);
              for (const url of gambarListExtra) if (!imageList.includes(url)) imageList.push(url);
              const gambarListJson = JSON.stringify(imageList);
              const gambarMirror = imageList[0] || "";

              // Akses 1-5: AKSES_LIST dipisah "|" (link tambahan di luar URL/URL_ALT yang sudah ada = Akses 1 & 2)
              const accessListExtra = String(p.akses_list || p.access_list || "").split("|").map(s => s.trim()).filter(Boolean);
              const accessListJson = JSON.stringify(accessListExtra);

              await env.DB.prepare(`
                INSERT INTO access_rules
                (id_produk, title, "desc", url_akses, harga, status, lp_url, komisi, komisi_l2, komisi_l3,
                 bump_status, bump_title, bump_price, bump_desc, bump_url, gambar,
                 kategori, category_id, harga_coret, pdf_drive_id, ga_id, meta_pixel_id, panara_paket_id,
                 webhook_url, is_featured, affiliate_wajib_beli,
                 parent_product_id, gambar_list, category_ids, deskripsi, url, access_list)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                ON CONFLICT(id_produk) DO UPDATE SET
                  title=excluded.title, "desc"=excluded."desc", url_akses=excluded.url_akses,
                  harga=excluded.harga, status=excluded.status, lp_url=excluded.lp_url,
                  komisi=excluded.komisi, komisi_l2=excluded.komisi_l2, komisi_l3=excluded.komisi_l3,
                  bump_status=excluded.bump_status, bump_title=excluded.bump_title,
                  bump_price=excluded.bump_price, bump_desc=excluded.bump_desc, bump_url=excluded.bump_url,
                  gambar=excluded.gambar, kategori=excluded.kategori, category_id=excluded.category_id,
                  harga_coret=excluded.harga_coret,
                  pdf_drive_id=excluded.pdf_drive_id, ga_id=excluded.ga_id, meta_pixel_id=excluded.meta_pixel_id,
                  panara_paket_id=excluded.panara_paket_id, webhook_url=excluded.webhook_url,
                  is_featured=excluded.is_featured, affiliate_wajib_beli=excluded.affiliate_wajib_beli,
                  parent_product_id=excluded.parent_product_id, gambar_list=excluded.gambar_list,
                  category_ids=excluded.category_ids, deskripsi=excluded.deskripsi, url=excluded.url, access_list=excluded.access_list
              `)
              .bind(
                saveId, title,
                deskripsiVal,
                urlAkses,
                Number(p.harga) || 0, status,
                String(p.lp_url || p.url_landing_page || "").trim() || `/checkout?id=${encodeURIComponent(saveId)}`,
                Number(p.komisi) || 0, Number(p.komisi_l2) || 0, Number(p.komisi_l3) || 0,
                String(p.bump_status || "Inactive").trim() || "Inactive",
                String(p.bump_title || "").trim(),
                Number(p.bump_price) || 0,
                String(p.bump_desc || "").trim(),
                String(p.bump_url || "").trim() || urlAlt,
                gambarMirror,
                katName, catId,
                Number(p.harga_coret) || 0,
                String(p.pdf_drive_id || "").trim(),
                String(p.ga_id || p.google_analytics_id || "").trim(),
                String(p.meta_pixel_id || p.facebook_pixel_id || "").trim(),
                String(p.panara_paket_id || "").trim(),
                String(p.webhook_url || "").trim(),
                p.is_featured ? 1 : 0,
                p.affiliate_wajib_beli ? 1 : 0,
                parentProductId, gambarListJson, categoryIdsJson, deskripsiVal, urlAlt, accessListJson
              )
              .run();
              imported++;
            } catch(e) {
              skipped++;
              if (errors.length < 20) errors.push(`Baris ${i + 1}: ${e.message}`);
            }
          }

          return jsonRes({ status: 'success', imported, skipped, errors });
        }

        case 'get_sub_admins': {
          const subAdminRows = await safeAll(env, `
            SELECT u.id_user, u.nama, u.email, u.whatsapp,
                   GROUP_CONCAT(up.permission) AS permissions
            FROM user_permissions up
            JOIN users u ON u.id_user = up.user_id
            GROUP BY up.user_id
            ORDER BY u.nama ASC
          `);
          return jsonRes({
            status: 'success',
            data: subAdminRows.map(r => ({
              id_user: r.id_user,
              nama: r.nama,
              email: r.email,
              whatsapp: r.whatsapp || '',
              permissions: r.permissions ? r.permissions.split(',') : []
            }))
          });
        }

        case 'set_user_permissions': {
          const targetEmail = String(body.email || "").trim().toLowerCase();
          const newPerms = Array.isArray(body.permissions) ? body.permissions : [];
          if (!targetEmail) return jsonRes({ status: 'error', message: 'Email wajib diisi.' });

          const targetUser = await env.DB.prepare("SELECT id_user FROM users WHERE LOWER(email) = ?").bind(targetEmail).first();
          if (!targetUser) return jsonRes({ status: 'error', message: 'User tidak ditemukan.' });

          const grantorEmail = String(body.admin_email || "").trim().toLowerCase();
          const userId = String(targetUser.id_user);

          // Validasi permission keys yang diizinkan
          const VALID_PERMISSIONS = new Set([
            'dashboard.view', 'dashboard.export', 'dashboard.manage_orders',
            'blast.view', 'blast.send',
            'products.view', 'products.manage',
            'coupons.view', 'coupons.manage',
            'affiliate.view', 'affiliate.reset',
            'lms.view', 'lms.manage',
            'access.view', 'access.grant', 'access.revoke',
            'cms_lp.view', 'cms_lp.manage',
            'cms_akses.view', 'cms_akses.manage',
            'cms_artikel.view', 'cms_artikel.manage',
            'cms_member.view', 'cms_member.manage',
            'media.view', 'media.upload',
          ]);
          const cleanPerms = newPerms.filter(p => VALID_PERMISSIONS.has(p));

          await env.DB.prepare("DELETE FROM user_permissions WHERE user_id = ?").bind(userId).run();
          for (const perm of cleanPerms) {
            await env.DB.prepare("INSERT OR IGNORE INTO user_permissions (user_id, permission, granted_by) VALUES (?, ?, ?)")
              .bind(userId, perm, grantorEmail).run();
          }
          return jsonRes({ status: 'success', message: `Permission untuk ${targetEmail} berhasil diperbarui.` });
        }

        default: return jsonRes({ status: 'error', message: 'Action unknown: ' + action });
      }
    } catch (e) { return jsonRes({ status: 'error', message: "Fatal Error: " + e.message }); }
  },
  
  async scheduled(event, env, ctx) {
    try {
      const settings = await getGlobalSettings(env);
 const ordersData = await env.DB.prepare("SELECT * FROM orders WHERE status = 'Pending' AND (reminder_level IS NULL OR reminder_level < 4) AND (group_invoice IS NULL OR group_invoice = '')").all();
      const orders = ordersData.results || [];
      if (orders.length === 0) return;

      const now = new Date();
      for (const ord of orders) {
        let orderDate = new Date(ord.tanggal_order);
        if (isNaN(orderDate)) {
           const parts = String(ord.tanggal_order).split(/[\s/:-]+/); 
           if(parts.length >= 3) {
             const yy = parts[2].length === 4 ? parts[2] : parts[0]; const dd = parts[2].length === 4 ? parts[0] : parts[2]; const mm = parts[1];
             orderDate = new Date(`${yy}-${mm}-${dd}T00:00:00Z`);
           }
        }
        if (isNaN(orderDate)) continue; 

        const diffHours = (now - orderDate) / (1000 * 60 * 60);
        let currentLevel = Number(ord.reminder_level) || 0; let nextLevel = currentLevel; let reminderLevel = 0;

        const hrgTotal = Number(ord.harga_total) || 0; const nominalFormatted = 'Rp ' + hrgTotal.toLocaleString('id-ID');
        const landingUrl = await getOrderLandingUrl(env, settings, ord);

        if (diffHours >= 24) {
          await env.DB.prepare("UPDATE orders SET status = 'Cancelled', reminder_level = 4 WHERE invoice = ?").bind(ord.invoice).run();
          await env.DB.prepare("UPDATE orders SET status = 'Cancelled', reminder_level = 4 WHERE group_invoice = ? AND status != 'Lunas'").bind(ord.invoice).run();
          await sendPaymentReminderNotification(settings, ord, nominalFormatted, landingUrl, 4);
        } else if (diffHours >= 2 && currentLevel === 0) {
          reminderLevel = 1;
          nextLevel = 1;
        } else if (diffHours >= 6 && currentLevel === 1) {
          reminderLevel = 2;
          nextLevel = 2;
        } else if (diffHours >= 12 && currentLevel === 2) {
          reminderLevel = 3;
          nextLevel = 3;
        }

        if (reminderLevel > 0 && nextLevel !== currentLevel) {
          await sendPaymentReminderNotification(settings, ord, nominalFormatted, landingUrl, reminderLevel);
          await env.DB.prepare("UPDATE orders SET reminder_level = ? WHERE invoice = ?").bind(nextLevel, ord.invoice).run();
        }
      }
    } catch (e) { console.log("Cron Error:", e.message); }
  }
}; 

// Order "anak" (akun tambahan dari 1 pesanan) diberi status Lunas & notifikasi barengan
// dengan order utamanya lewat kolom group_invoice. Dipanggil dari semua jalur konfirmasi
// pembayaran (webhook Xendit/Tripay/Duitku/Moota & konfirmasi manual admin).
async function markOrderLunasAndNotify(order, env, settings) {
    if (!order || order.status === 'Lunas') return;
    await env.DB.prepare("UPDATE orders SET status = 'Lunas' WHERE invoice = ?").bind(order.invoice).run();
    try {
        const siblingsRes = await env.DB.prepare("SELECT * FROM orders WHERE group_invoice = ? AND status != 'Lunas'").bind(order.invoice).all();
        const siblings = siblingsRes.results || [];
        for (const sib of siblings) {
            await env.DB.prepare("UPDATE orders SET status = 'Lunas' WHERE invoice = ?").bind(sib.invoice).run();
        }

        // Kelompokkan SEMUA baris (order utama + siblingnya) per email penerima, supaya tiap orang
        // (pembeli utama, atau tiap "akun tambahan") dapat TEPAT 1 notifikasi gabungan yang mencakup
        // semua produk yang jadi haknya — baik itu cuma 1 paket, atau beberapa paket sekaligus.
        const groupsByEmail = new Map();
        const pushToGroup = (row) => {
            const key = String(row.email || "").toLowerCase();
            if (!groupsByEmail.has(key)) groupsByEmail.set(key, []);
            groupsByEmail.get(key).push(row);
        };
        pushToGroup(order);
        for (const sib of siblings) pushToGroup(sib);

        for (const rows of groupsByEmail.values()) {
            if (rows.length > 1) {
                try { await sendPaidNotificationGrouped(rows, settings, env); } catch(e) {}
            } else {
                try { await sendPaidNotification(rows[0], settings, env); } catch(e) {}
            }
        }
    } catch(e) {
        try { await sendPaidNotification(order, settings, env); } catch(e2) {}
    }
}

// Notifikasi gabungan untuk 1 grup checkout multi-paket (parent + paket-paket tambahan, semua milik
// pembeli yang sama): tetap kirim event tracking (Meta Pixel & notifikasi affiliate) per baris supaya
// nilai per produk akurat, tapi WA & email ke pembeli digabung jadi 1 pesan saja.
async function sendPaidNotificationGrouped(rows, s, env) {
    for (const r of rows) {
        try { await sendMetaPurchase(r, s, env); } catch (e) { console.log("Meta Purchase Error:", e.message); }
        try { await sendAffiliateOrderNotification(env, s, r, "paid"); } catch (e) { console.log("Affiliate Paid Notification Error:", e.message); }
    }

    const main = rows[0];
    const loginUrl = (s.site_url || "").replace(/\/$/, "") + "/member";
    const emailSubject = `[SUKSES] Pembayaran Terkonfirmasi - #${main.invoice}`;
    const combinedTotal = rows.reduce((sum, r) => sum + (Number(r.harga_total) || 0), 0);
    const priceRowText = "Rp" + combinedTotal.toLocaleString('id-ID');
    const produkGabungan = rows.map(r => r.nama_produk || "Pesanan Digital").join(', ');

    const isNewAccount = (main.is_new_account === true || Number(main.is_new_account) === 1);
    const newAccountPass = isNewAccount ? String(main.temp_password || "") : "";
    const boxPasswordEmail = (isNewAccount && newAccountPass) ? `
        <div style="background: #f0fdf4; border: 1px dashed #16a34a; padding: 15px; text-align: center; margin: 20px 0; border-radius: 8px;">
            <p style="margin: 0 0 5px 0; color: #15803d; font-size: 14px;">AKUN MEMBER ANDA:</p>
            <p style="margin: 0; color: #1e293b;"><strong>Email:</strong> ${main.email}</p>
            <p style="margin: 5px 0 0 0; color: #1e293b;"><strong>Password:</strong> ${newAccountPass}</p>
            <p style="margin: 5px 0 0 0; font-size: 12px; color: #166534;">Segera login &amp; ganti password Anda demi keamanan.</p>
        </div>` : "";
    const infoPasswordWA = (isNewAccount && newAccountPass) ? `\n\n🔐 *AKUN MEMBER ANDA:*\nEmail: ${main.email}\nPassword: *${newAccountPass}*\n_Segera login & ganti password Anda demi keamanan._` : "";

    let boxLisensiEmail = "";
    let infoLisensiWA = "";
    const licenseRow = rows.find(r => String(r.id_produk).toUpperCase() === 'CLOUDP');
    if (licenseRow) {
        const lisensiKlien = licenseRow.license_key || "Menunggu Generate";
        boxLisensiEmail = `
        <div style="background: #fffbeb; border: 1px dashed #f59e0b; padding: 15px; text-align: center; margin: 20px 0; border-radius: 8px;">
            <p style="margin: 0 0 5px 0; color: #b45309; font-size: 14px;">KODE LISENSI ANDA:</p>
            <h2 style="margin: 0; color: #d97706; letter-spacing: 2px;">${lisensiKlien}</h2>
            <p style="margin: 5px 0 0 0; font-size: 12px; color: #92400e;">Gunakan kode ini saat pertama kali setup aplikasi di domain Anda.</p>
        </div>`;
        infoLisensiWA = `\n\n🔑 *KODE LISENSI APLIKASI:*\n*${lisensiKlien}*\n_Masukkan kode di atas saat pertama kali install script di panel admin Kakak._`;
    }

    const paidBumpTitles = [];
    for (const r of rows) {
        const isRowBump = (r.take_bump === true || String(r.take_bump).toLowerCase() === 'true' || r.take_bump === 1);
        if (!isRowBump) continue;
        try {
            const orderBumpItems = parseBumpItems(r.bump_selected);
            if (orderBumpItems.length) {
                paidBumpTitles.push(...orderBumpItems.map(item => item.title));
            } else {
                const bumpRow = await env.DB.prepare("SELECT bump_title FROM access_rules WHERE UPPER(id_produk) = ?").bind(String(r.id_produk).toUpperCase()).first();
                if (bumpRow && String(bumpRow.bump_title || "").trim()) paidBumpTitles.push(String(bumpRow.bump_title).trim());
            }
        } catch(e) {}
    }
    const isBump = paidBumpTitles.length > 0;
    const paidBumpTitle = paidBumpTitles.join(', ');
    const infoBumpWA = isBump ? `\n🎁 *Bonus / Tambahan:* Akses produk *${paidBumpTitle}* juga telah terbuka!` : "";
    const infoBumpEmail = isBump ? `<p style="margin: 10px 0 0 0; padding: 10px; background: #fef3c7; color: #d97706; border-radius: 6px; font-weight: bold; text-align: center;">🎁 Selamat! Anda juga mendapatkan akses ${escapeHtml(paidBumpTitle)}.</p>` : "";

    const itemsRowsHtml = rows.map(r => `<tr><td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">${r.nama_produk || "Pesanan Digital"}</td><td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold;">Rp${(Number(r.harga_total) || 0).toLocaleString('id-ID')}</td></tr>`).join('');

    const paidVars = {
        nama: main.nama || "",
        email: main.email || "",
        whatsapp: main.whatsapp || main.wa || main.no_wa || "",
        invoice: main.invoice || "",
        produk: produkGabungan,
        total: priceRowText,
        login_url: loginUrl,
        lisensi: licenseRow ? (licenseRow.license_key || "") : "",
        info_bump: isBump ? `Akses produk ${paidBumpTitle} juga telah terbuka.` : "",
        info_lisensi: licenseRow ? (licenseRow.license_key || "Menunggu Generate") : "",
        info_password: (isNewAccount && newAccountPass) ? `Password: ${newAccountPass}` : ""
    };
    const defaultPaidEmail = `Halo {nama}

Terima kasih, pembayaran untuk {produk} telah diterima. Akses member Anda sudah aktif.`;
    const paidEmailCopy = textToEmailHtml(renderTemplate(s.notif_paid_email || defaultPaidEmail, paidVars));

    const finalPaidEmailHTML = `<div style="max-width: 600px; margin: auto; background: white; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0;"><div style="background: #2563eb; padding: 30px; text-align: center; color: white;"><h1 style="margin: 0; font-size: 24px;">Pembayaran Berhasil!</h1></div><div style="padding: 30px; color: #1e293b;"><p>${paidEmailCopy}</p>${boxLisensiEmail}${boxPasswordEmail}<table style="width: 100%; background: #f8fafc; border-radius: 8px; margin-top: 10px; border-collapse: collapse;">${itemsRowsHtml}</table>${infoBumpEmail}<div style="margin-top: 30px; text-align: center;"><a href="${loginUrl}" style="background: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 999px; font-weight: bold; display: inline-block;">LOGIN MEMBER AREA</a></div></div></div>`;

    const defaultPaidWA = `*PEMBAYARAN SUKSES!*

Halo Kak *{nama}*,
Terima kasih, pembayaran untuk pesanan *{produk}* telah kami terima.
{info_bump}
{info_lisensi}

Detail Akses Member:
Email: {email}
Login: {login_url}
{info_password}

Jika butuh bantuan, balas pesan ini ya Kak!`;
    const finalPaidWaMessage = renderTemplate(s.notif_paid_wa || defaultPaidWA, paidVars) + (s.notif_paid_wa ? infoPasswordWA : "");
    try { await sendWA(s, main.whatsapp || main.wa || main.no_wa, finalPaidWaMessage); } catch (e) {}
    try { await sendEmail(s, main.email, emailSubject, finalPaidEmailHTML); } catch (e) {}
}

async function sendPaidNotification(ord, s, env) {
    try { await sendMetaPurchase(ord, s, env); } catch (e) { console.log("Meta Purchase Error:", e.message); }

    const loginUrl = (s.site_url || "").replace(/\/$/, "") + "/member";
    const emailSubject = `[SUKSES] Pembayaran Terkonfirmasi - #${ord.invoice}`;
    const isBundledAccount = !!ord.group_invoice && (Number(ord.harga_total) || 0) === 0;
    const hrgTotal = Number(ord.harga_total) || 0;
    const priceRowText = isBundledAccount ? "Termasuk dalam 1 pembelian" : ("Rp" + hrgTotal.toLocaleString('id-ID'));
    const targetProdId = String(ord.id_produk).toUpperCase();

    // 🔐 AKUN BARU (belum pernah terdaftar) → tampilkan password di notifikasi.
    // Akun yang sudah terdaftar sebelumnya → password TIDAK disertakan demi keamanan.
    const isNewAccount = (ord.is_new_account === true || Number(ord.is_new_account) === 1);
    const newAccountPass = isNewAccount ? String(ord.temp_password || "") : "";
    const boxPasswordEmail = (isNewAccount && newAccountPass) ? `
        <div style="background: #f0fdf4; border: 1px dashed #16a34a; padding: 15px; text-align: center; margin: 20px 0; border-radius: 8px;">
            <p style="margin: 0 0 5px 0; color: #15803d; font-size: 14px;">AKUN MEMBER ANDA:</p>
            <p style="margin: 0; color: #1e293b;"><strong>Email:</strong> ${ord.email}</p>
            <p style="margin: 5px 0 0 0; color: #1e293b;"><strong>Password:</strong> ${newAccountPass}</p>
            <p style="margin: 5px 0 0 0; font-size: 12px; color: #166534;">Segera login &amp; ganti password Anda demi keamanan.</p>
        </div>` : "";
    const infoPasswordWA = (isNewAccount && newAccountPass) ? `\n\n🔐 *AKUN MEMBER ANDA:*\nEmail: ${ord.email}\nPassword: *${newAccountPass}*\n_Segera login & ganti password Anda demi keamanan._` : "";

    // VARIABEL KOSONG UNTUK PRODUK BIASA
    let boxLisensiEmail = "";
    let infoLisensiWA = "";
    
    // JIKA YANG DIBELI ADALAH CLOUDP, ISI VARIABELNYA
    if (targetProdId === 'CLOUDP') {
        const lisensiKlien = ord.license_key || "Menunggu Generate";
        
        boxLisensiEmail = `
        <div style="background: #fffbeb; border: 1px dashed #f59e0b; padding: 15px; text-align: center; margin: 20px 0; border-radius: 8px;">
            <p style="margin: 0 0 5px 0; color: #b45309; font-size: 14px;">KODE LISENSI ANDA:</p>
            <h2 style="margin: 0; color: #d97706; letter-spacing: 2px;">${lisensiKlien}</h2>
            <p style="margin: 5px 0 0 0; font-size: 12px; color: #92400e;">Gunakan kode ini saat pertama kali setup aplikasi di domain Anda.</p>
        </div>`;
        
        infoLisensiWA = `\n\n🔑 *KODE LISENSI APLIKASI:*\n*${lisensiKlien}*\n_Masukkan kode di atas saat pertama kali install script di panel admin Kakak._`;
    }
    
    // 🔥 CEK APAKAH ORDER TERMASUK BUMP SELL UNTUK NOTIFIKASI LUNAS 🔥 (mendukung banyak bump sekaligus)
    const isBump = (ord.take_bump === true || String(ord.take_bump).toLowerCase() === 'true' || ord.take_bump === 1);
    let paidBumpTitle = "Order Bump";
    if (isBump) {
        try {
            const orderBumpItems = parseBumpItems(ord.bump_selected);
            if (orderBumpItems.length) {
                paidBumpTitle = orderBumpItems.map(item => item.title).join(', ');
            } else {
                const bumpRow = await env.DB.prepare("SELECT bump_title FROM access_rules WHERE UPPER(id_produk) = ?").bind(targetProdId).first();
                if (bumpRow && String(bumpRow.bump_title || "").trim()) paidBumpTitle = String(bumpRow.bump_title).trim();
            }
        } catch(e) {}
    }
    const infoBumpWA = isBump ? `\n🎁 *Bonus / Tambahan:* Akses produk *${paidBumpTitle}* juga telah terbuka!` : "";
    const infoBumpEmail = isBump ? `<p style="margin: 10px 0 0 0; padding: 10px; background: #fef3c7; color: #d97706; border-radius: 6px; font-weight: bold; text-align: center;">🎁 Selamat! Anda juga mendapatkan akses ${escapeHtml(paidBumpTitle)}.</p>` : "";
    
    const emailHTML = `<div style="max-width: 600px; margin: auto; background: white; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0;"><div style="background: #2563eb; padding: 30px; text-align: center; color: white;"><h1 style="margin: 0; font-size: 24px;">Pembayaran Berhasil! 🎉</h1></div><div style="padding: 30px; color: #1e293b;"><p>Halo <strong>${ord.nama}</strong>,</p><p>Terima kasih, pembayaran untuk <strong>${ord.nama_produk}</strong> telah diterima.</p>
    
    ${boxLisensiEmail}
    
    <table style="width: 100%; background: #f8fafc; border-radius: 8px; margin-top: 10px; border-collapse: collapse;"><tr><td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">${ord.nama_produk}</td><td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold;">${priceRowText}</td></tr></table>
    ${infoBumpEmail}
    <div style="margin-top: 30px; text-align: center;"><a href="${loginUrl}" style="background: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 999px; font-weight: bold; display: inline-block;">LOGIN MEMBER AREA</a></div></div></div>`;
    
    const paidVars = {
        nama: ord.nama || "",
        email: ord.email || "",
        whatsapp: ord.whatsapp || ord.wa || ord.no_wa || "",
        invoice: ord.invoice || "",
        produk: ord.nama_produk || "Pesanan Digital",
        total: priceRowText,
        login_url: loginUrl,
        lisensi: ord.license_key || "",
        info_bump: isBump ? `Akses produk ${paidBumpTitle} juga telah terbuka.` : "",
        info_lisensi: targetProdId === 'CLOUDP' ? (ord.license_key || "Menunggu Generate") : "",
        info_password: (isNewAccount && newAccountPass) ? `Password: ${newAccountPass}` : ""
    };
    const defaultPaidEmail = `Halo {nama}

Terima kasih, pembayaran untuk {produk} telah diterima. Akses member Anda sudah aktif.`;
    const paidEmailCopy = textToEmailHtml(renderTemplate(s.notif_paid_email || defaultPaidEmail, paidVars));

    const finalPaidEmailHTML = `<div style="max-width: 600px; margin: auto; background: white; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0;"><div style="background: #2563eb; padding: 30px; text-align: center; color: white;"><h1 style="margin: 0; font-size: 24px;">Pembayaran Berhasil!</h1></div><div style="padding: 30px; color: #1e293b;"><p>${paidEmailCopy}</p>${boxLisensiEmail}${boxPasswordEmail}<table style="width: 100%; background: #f8fafc; border-radius: 8px; margin-top: 10px; border-collapse: collapse;"><tr><td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">${ord.nama_produk || "Pesanan Digital"}</td><td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold;">${priceRowText}</td></tr></table>${infoBumpEmail}<div style="margin-top: 30px; text-align: center;"><a href="${loginUrl}" style="background: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 999px; font-weight: bold; display: inline-block;">LOGIN MEMBER AREA</a></div></div></div>`;

    const waMessage = `*PEMBAYARAN SUKSES!* ✅\n\nHalo Kak *${ord.nama}*,\nTerima kasih, pembayaran untuk pesanan *${ord.nama_produk}* telah kami terima.${infoBumpWA}${infoLisensiWA}\n\n*Detail Akses Member:*\n📧 Email: ${ord.email}\n🌐 Login: ${loginUrl}\n\nJika butuh bantuan, balas pesan ini ya Kak!`;

    const defaultPaidWA = `*PEMBAYARAN SUKSES!*

Halo Kak *{nama}*,
Terima kasih, pembayaran untuk pesanan *{produk}* telah kami terima.
{info_bump}
{info_lisensi}

Detail Akses Member:
Email: {email}
Login: {login_url}
{info_password}

Jika butuh bantuan, balas pesan ini ya Kak!`;
    const finalPaidWaMessage = renderTemplate(s.notif_paid_wa || defaultPaidWA, paidVars) + (s.notif_paid_wa ? infoPasswordWA : "");
    try { await sendWA(s, ord.whatsapp || ord.wa || ord.no_wa, finalPaidWaMessage); } catch (e) {}
    try { await sendEmail(s, ord.email, emailSubject, finalPaidEmailHTML); } catch (e) {}
    try { await sendAffiliateOrderNotification(env, s, ord, "paid"); } catch (e) { console.log("Affiliate Paid Notification Error:", e.message); }
}

async function sendWebhook(env, ord) {
    const [prodRow, settings, userRow] = await Promise.all([
        env.DB.prepare("SELECT webhook_url, title, panara_paket_id FROM access_rules WHERE UPPER(id_produk) = ?").bind(String(ord.id_produk || "").toUpperCase()).first(),
        getGlobalSettings(env),
        env.DB.prepare("SELECT password FROM users WHERE LOWER(email) = ?").bind(String(ord.email || "").toLowerCase()).first(),
    ]);
    const webhookUrl = String(prodRow?.webhook_url || "").trim();
    if (!webhookUrl) return null;
    const siteUrl = String(settings.site_url || "").trim();
    const webhookKey = String(settings.webhook_secret || "").trim();
    const userPassword = String(userRow?.password || "").trim();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
        const res = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Webhook-Source": siteUrl, "X-Webhook-Event": "order.paid", "X-Webhook-Key": webhookKey },
            body: JSON.stringify({
                event: "order.paid",
                invoice: ord.invoice || "",
                nama: ord.nama || "",
                email: ord.email || "",
                whatsapp: ord.whatsapp || ord.wa || ord.no_wa || "",
                nama_produk: prodRow?.title || ord.nama_produk || "",
                id_produk: ord.id_produk || "",
                panara_paket_id: String(prodRow?.panara_paket_id || "").trim(),
                harga_total: Number(ord.harga_total) || 0,
                metode: ord.metode || "",
                password: userPassword,
                timestamp: new Date().toISOString(),
            }),
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        const data = await res.json();
        return String(data.sso_token || "").trim() || null;
    } catch (e) {
        clearTimeout(timeoutId);
        console.log("Webhook Error:", e.message);
        return null;
    }
}

// ========================
// FITUR BARU: BLAST PESAN HELPERS
// ========================

function normalizeBlastStatus(value) {
  const status = String(value || "all").trim().toLowerCase();
  if (["paid", "lunas", "success", "berhasil"].includes(status)) return "paid";
  if (["pending", "menunggu", "menunggu_pembayaran", "unpaid", "belum_bayar"].includes(status)) return "pending";
  if (["cancel", "cancelled", "canceled", "batal", "dibatalkan", "expired", "failed"].includes(status)) return "cancelled";
  return "all";
}

function getBlastStatusLabel(status) {
  if (status === "paid") return "Order Lunas";
  if (status === "pending") return "Order Pending";
  if (status === "cancelled") return "Order Cancel";
  return "Semua Order";
}

function getBlastStatusWhere(status) {
  if (status === "paid") return "WHERE LOWER(COALESCE(status, '')) IN ('lunas', 'success', 'paid', 'berhasil')";
  if (status === "pending") return "WHERE LOWER(COALESCE(status, '')) IN ('pending', 'menunggu pembayaran', 'waiting payment', 'waiting_payment', 'unpaid', 'belum bayar')";
  if (status === "cancelled") return "WHERE LOWER(COALESCE(status, '')) IN ('cancel', 'cancelled', 'canceled', 'batal', 'dibatalkan', 'expired', 'failed', 'gagal')";
  return "";
}

function getBlastProductTargets(body = {}) {
  const raw = Array.isArray(body.product_ids)
    ? body.product_ids.join(",")
    : String(body.product_ids || body.product_id || body.id_produk || body.product_filter || "");
  return splitProductTargets(raw).filter(id => id && id !== "ALL" && id !== "SEMUA");
}

async function getBlastProductLabel(env, productIds = []) {
  if (!productIds.length) return "semua produk";
  const labels = [];
  for (const id of productIds.slice(0, 5)) {
    let title = "";
    try {
      const row = await env.DB.prepare("SELECT title FROM access_rules WHERE UPPER(id_produk) = ?").bind(id).first();
      title = String(row && row.title || "").trim();
    } catch(e) {}
    labels.push(title ? `${id} - ${title}` : id);
  }
  if (productIds.length > labels.length) labels.push(`+${productIds.length - labels.length} produk`);
  return labels.join(", ");
}

function normalizeBlastChannel(value) {
  const channel = String(value || "both").trim().toLowerCase();
  if (channel === "wa" || channel === "whatsapp") return "wa";
  if (channel === "email" || channel === "mail") return "email";
  return "both";
}

function getBlastTargetKey(order) {
  const email = String(order.email || "").trim().toLowerCase();
  const phone = normalizePhone(order.whatsapp || "");
  if (email) return "email:" + email;
  if (phone) return "wa:" + phone;
  return "invoice:" + String(order.invoice || "").trim();
}

function mapBlastOrderTarget(order = {}) {
  return {
    invoice: String(order.invoice || "").trim(),
    name: String(order.nama || order.name || "Kak").trim() || "Kak",
    email: String(order.email || "").trim().toLowerCase(),
    whatsapp: String(order.whatsapp || order.wa || "").trim(),
    product: String(order.nama_produk || order.product || "Produk Digital").trim(),
    product_id: String(order.id_produk || "").trim(),
    total: Number(order.harga_total || 0),
    status: String(order.status || "").trim() || "Pending",
    date: String(order.tanggal_order || "").trim()
  };
}

async function getBlastTargets(env, body = {}) {
  const status = normalizeBlastStatus(body.status || body.target_status);
  const whereParts = [];
  const params = [];
  const statusWhere = getBlastStatusWhere(status).replace(/^WHERE\s+/i, "").trim();
  if (statusWhere) whereParts.push(`(${statusWhere})`);
  const productIds = getBlastProductTargets(body);
  if (productIds.length) {
    whereParts.push(`UPPER(COALESCE(id_produk, '')) IN (${productIds.map(() => "?").join(",")})`);
    params.push(...productIds);
  }
  const whereClause = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
  const rows = await safeAll(env, `
    SELECT invoice, email, nama, whatsapp, id_produk, nama_produk, harga_total, status, tanggal_order
    FROM orders
    ${whereClause}
    ORDER BY rowid DESC
    LIMIT 10000
  `, params);
  const targetMap = new Map();
  const targets = [];

  for (const row of rows) {
    const target = mapBlastOrderTarget(row);
    const key = getBlastTargetKey(target);
    if (!key) continue;
    if (targetMap.has(key)) {
      const existing = targetMap.get(key);
      if (!existing.email && target.email) existing.email = target.email;
      if (!existing.whatsapp && target.whatsapp) existing.whatsapp = target.whatsapp;
      continue;
    }
    targetMap.set(key, target);
    targets.push(target);
  }

  const offset = Math.max(0, Number(body.offset) || 0);
  const limit = Math.min(12, Math.max(1, Number(body.limit) || 10));
  const productLabel = await getBlastProductLabel(env, productIds);
  return {
    status,
    product_ids: productIds,
    product_label: productLabel,
    label: `${getBlastStatusLabel(status)} - ${productLabel}`,
    total: targets.length,
    offset,
    limit,
    targets,
    batch: targets.slice(offset, offset + limit)
  };
}

function buildBlastVars(target = {}, settings = {}) {
  const siteUrl = String(settings.site_url || "").replace(/\/+$/, "");
  const siteName = String(settings.site_name || settings.mail_sender_name || "CloudMember").trim();
  return {
    nama: target.name || "Kak",
    email: target.email || "",
    whatsapp: target.whatsapp || "",
    invoice: target.invoice || "",
    produk: target.product || "",
    id_produk: target.product_id || "",
    total: String(Number(target.total || 0).toLocaleString('id-ID')),
    status: target.status || "",
    tanggal_order: target.date || "",
    site_name: siteName,
    site_url: siteUrl,
    login_url: siteUrl ? `${siteUrl}/member` : "/member",
    checkout_url: siteUrl && target.product_id ? `${siteUrl}/checkout?id=${encodeURIComponent(target.product_id)}` : ""
  };
}

function buildBlastEmailHtml(message, vars) {
  const rendered = textToEmailHtml(renderTemplate(message, vars));
  const siteName = escapeHtml(vars.site_name || "CloudMember");
  return `<div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;"><div style="background:#0f172a;color:#ffffff;padding:24px 28px;"><div style="font-size:18px;font-weight:800;">${siteName}</div></div><div style="padding:28px;color:#1e293b;font-size:15px;line-height:1.7;">${rendered}</div></div>`;
}

async function handlePreviewBlastTargets(env, body) {
  const data = await getBlastTargets(env, body);
  return jsonRes({
    status: "success",
    target_status: data.status,
    product_ids: data.product_ids,
    product_label: data.product_label,
    label: data.label,
    total: data.total,
    wa_ready: data.targets.filter(t => normalizePhone(t.whatsapp)).length,
    email_ready: data.targets.filter(t => t.email && t.email.includes("@")).length,
    sample: data.targets.slice(0, 5).map(t => ({
      nama: t.name,
      email: t.email,
      whatsapp: t.whatsapp,
      produk: t.product,
      status: t.status
    }))
  });
}

async function handleSendBlastBatch(env, settings, body) {
  const channel = normalizeBlastChannel(body.channel);
  const waMessage = String(body.message || body.wa_message || "").trim();
  const emailMessage = String(body.email_message || body.message || "").trim();
  const subjectTemplate = String(body.subject || "Informasi dari {site_name}").trim() || "Informasi dari {site_name}";

  if ((channel === "wa" || channel === "both") && !waMessage) {
    return jsonRes({ status: "error", message: "Isi pesan WhatsApp wajib diisi." }, 400);
  }
  if ((channel === "email" || channel === "both") && !emailMessage) {
    return jsonRes({ status: "error", message: "Isi pesan email wajib diisi." }, 400);
  }

  const data = await getBlastTargets(env, body);
  let sentWa = 0;
  let sentEmail = 0;
  let failed = 0;
  const errors = [];

  for (let i = 0; i < data.batch.length; i++) {
    const target = data.batch[i];
    const vars = buildBlastVars(target, settings);

    if (channel === "wa" || channel === "both") {
      if (i > 0) await sleep(15000);
      try {
        await sendWA(settings, target.whatsapp, renderTemplate(waMessage, vars));
        sentWa++;
      } catch(e) {
        failed++;
        if (errors.length < 10) errors.push(`${target.name}: WhatsApp gagal`);
      }
    }

    if (channel === "email" || channel === "both") {
      try {
        const subject = renderTemplate(subjectTemplate, vars);
        await sendEmail(settings, target.email, subject, buildBlastEmailHtml(emailMessage, vars));
        sentEmail++;
      } catch(e) {
        failed++;
        if (errors.length < 10) errors.push(`${target.name}: Email gagal`);
      }
    }
  }

  const nextOffset = data.offset + data.batch.length;
  return jsonRes({
    status: "success",
    target_status: data.status,
    product_ids: data.product_ids,
    product_label: data.product_label,
    label: data.label,
    total: data.total,
    processed: data.batch.length,
    sent_wa: sentWa,
    sent_email: sentEmail,
    failed,
    errors,
    next_offset: nextOffset,
    done: nextOffset >= data.total
  });
}

// ========================
// IMPORT YOUTUBE PLAYLIST HELPERS
// ========================

function normalizeYoutubeVideoId(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const patterns = [
    /youtu\.be\/([A-Za-z0-9_-]{11})/i,
    /[?&]v=([A-Za-z0-9_-]{11})/i,
    /\/embed\/([A-Za-z0-9_-]{11})/i,
    /\/shorts\/([A-Za-z0-9_-]{11})/i
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) return match[1];
  }
  return /^[A-Za-z0-9_-]{11}$/.test(text) ? text : "";
}

function extractYoutubePlaylistId(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  try {
    const parsed = new URL(text);
    const listId = String(parsed.searchParams.get("list") || "").trim();
    if (listId) return listId;
  } catch(e) {}
  const match = text.match(/(?:[?&]list=|youtube\.com\/playlist\/)([A-Za-z0-9_-]+)/i);
  return match && match[1] ? match[1] : (/^[A-Za-z0-9_-]{12,}$/.test(text) ? text : "");
}

async function fetchYoutubePlaylistItems(playlistId, apiKey, maxVideos = 500) {
  const videos = [];
  const seen = new Set();
  let skipped = 0;
  let totalItems = 0;
  let pageToken = "";
  let pageCount = 0;

  do {
    const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
    url.searchParams.set("part", "snippet,contentDetails");
    url.searchParams.set("playlistId", playlistId);
    url.searchParams.set("maxResults", "50");
    url.searchParams.set("key", apiKey);
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url.toString(), { headers: { "Accept": "application/json" } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = data && data.error && data.error.message ? data.error.message : `YouTube API HTTP ${res.status}`;
      throw new Error(message);
    }

    totalItems = Math.max(totalItems, Number(data.pageInfo && data.pageInfo.totalResults) || 0);
    for (const item of Array.isArray(data.items) ? data.items : []) {
      const snippet = item.snippet || {};
      const videoId = String((item.contentDetails && item.contentDetails.videoId) || (snippet.resourceId && snippet.resourceId.videoId) || "").trim();
      const title = String(snippet.title || "").trim();
      const unavailable = !videoId || /^(private|deleted) video$/i.test(title);
      if (unavailable) { skipped += 1; continue; }
      if (seen.has(videoId)) continue;
      seen.add(videoId);
      videos.push({ id: videoId, title: title || `Video ${videos.length + 1}`, desc: String(snippet.description || "") });
      if (videos.length >= maxVideos) break;
    }

    pageToken = String(data.nextPageToken || "").trim();
    pageCount += 1;
  } while (pageToken && videos.length < maxVideos && pageCount < 20);

  return { videos, skipped, totalItems: totalItems || videos.length + skipped, pageCount };
}

function decodeJsonStringFragment(value) {
  const text = String(value || "");
  try { return JSON.parse(`"${text.replace(/"/g, '\\"')}"`); } catch(e) { return text.replace(/\\u0026/g, "&"); }
}

function extractYoutubeVideosFromText(value) {
  const text = String(value || "");
  const found = [];
  const seen = new Set();
  const add = (id, title = "") => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    found.push({ id, title: title || `Video ${found.length + 1}` });
  };

  text.split(/\r?\n/).forEach(line => {
    const id = normalizeYoutubeVideoId(line);
    if (id) add(id, line.replace(/https?:\/\/\S+/g, "").trim());
  });

  const videoRegex = /"videoId":"([A-Za-z0-9_-]{11})"/g;
  let match;
  while ((match = videoRegex.exec(text)) && found.length < 200) {
    const id = match[1];
    const windowText = text.slice(match.index, match.index + 3000);
    const titleMatch = windowText.match(/"title":\{"runs":\[\{"text":"([^"]+)"/) || windowText.match(/"simpleText":"([^"]+)"/);
    add(id, titleMatch ? decodeJsonStringFragment(titleMatch[1]) : "");
  }

  return found.slice(0, 200);
}

async function handleImportYoutubePlaylist(body, settings = {}, env = {}) {
  const source = String(body.playlist_url || body.url || body.text || "").trim();
  if (!source) return jsonRes({ status: "error", message: "URL playlist atau daftar video kosong." }, 400);

  const playlistId = extractYoutubePlaylistId(source);
  const apiKey = String((env && env.YOUTUBE_API_KEY) || settings.youtube_api_key || "").trim();
  let apiWarning = "";

  if (playlistId && apiKey) {
    try {
      const result = await fetchYoutubePlaylistItems(playlistId, apiKey);
      if (!result.videos.length) return jsonRes({ status: "error", message: "Video playlist tidak ditemukan. Mungkin playlist kosong atau semua video private/dihapus." });
      const responseData = { status: "success", videos: result.videos, source: "api" };
      if (result.skipped > 0) responseData.warning = `${result.skipped} video dilewati karena private atau sudah dihapus.`;
      if (result.totalItems > result.videos.length + result.skipped) responseData.warning = (responseData.warning ? responseData.warning + " " : "") + `Total item playlist: ${result.totalItems}, berhasil dimuat: ${result.videos.length}.`;
      return jsonRes(responseData);
    } catch(e) {
      apiWarning = e.message || "YouTube API error";
    }
  }

  let scrapeText = source;
  if (/^https?:\/\//i.test(source)) {
    const id = normalizeYoutubeVideoId(source);
    try {
      const res = await fetch(source, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (res.ok) scrapeText = await res.text();
    } catch(e) {}
    if (id) scrapeText += `\n${id}`;
  }

  const videos = extractYoutubeVideosFromText(scrapeText);
  if (!videos.length) return jsonRes({ status: "error", message: "Video playlist tidak ditemukan. Paste daftar URL video jika playlist tidak terbaca." + (apiWarning ? ` (API: ${apiWarning})` : "") });
  const responseData = { status: "success", videos, source: "scrape" };
  if (apiWarning) responseData.warning = "YouTube API tidak tersedia: " + apiWarning + ". Data diambil dengan metode alternatif.";
  if (!apiKey && playlistId) responseData.warning = (responseData.warning ? responseData.warning + " " : "") + "Tambahkan YouTube API Key di pengaturan untuk hasil lebih akurat dan mendukung playlist panjang.";
  return jsonRes(responseData);
}

