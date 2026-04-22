const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const express = require("express");
const session = require("express-session");
const FileStoreFactory = require("session-file-store");
const bcrypt = require("bcryptjs");

const initSqlJs = require("sql.js");

const app = express();

app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(express.json({ limit: "15mb" }));

const dataDir = path.join(__dirname, "data");
const sessionsDir = path.join(dataDir, "sessions");

ensureDir(dataDir);
ensureDir(sessionsDir);

const FileStore = FileStoreFactory(session);
const cookieSecure =
  process.env.COOKIE_SECURE === "1" ||
  process.env.COOKIE_SECURE === "true" ||
  process.env.NODE_ENV === "production";

app.use(
  session({
    store: new FileStore({ path: sessionsDir, retries: 0 }),
    secret: process.env.SESSION_SECRET || "change-this-secret",
    resave: false,
    saveUninitialized: false,
    name: "ictinv.sid",
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: cookieSecure,
      maxAge: 1000 * 60 * 60 * 12
    }
  })
);

app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  next();
});

// Static assets (only what the frontend needs).
app.use("/assets", express.static(path.join(__dirname, "assets"), { maxAge: 0 }));
app.get("/style.css", (req, res) => res.sendFile(path.join(__dirname, "style.css")));
app.get("/app.js", (req, res) => res.sendFile(path.join(__dirname, "app.js")));
app.get("/imports.js", (req, res) => res.sendFile(path.join(__dirname, "imports.js")));
app.get("/deleted.js", (req, res) => res.sendFile(path.join(__dirname, "deleted.js")));

// Pages: serve existing *.php as HTML by stripping the PHP header.
app.get("/", (req, res) => sendPhpAsHtml(res, path.join(__dirname, "index.php")));
app.get("/index.php", (req, res) => sendPhpAsHtml(res, path.join(__dirname, "index.php")));
app.get("/inventory.php", (req, res) => sendPhpAsHtml(res, path.join(__dirname, "inventory.php")));
app.get("/imports.php", (req, res) => sendPhpAsHtml(res, path.join(__dirname, "imports.php")));
app.get("/deleted.php", (req, res) => sendPhpAsHtml(res, path.join(__dirname, "deleted.php")));
app.get("/index.html", (req, res) => res.redirect(302, "/"));

// --- API (ported from api/*.php) ---
app.get("/api/me.php", requireAuth, (req, res) => {
  res.json({ ok: true, user: req.session.user });
});

app.all("/api/logout.php", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

app.post("/api/login.php", async (req, res) => {
  try {
    const body = isPlainObject(req.body) ? req.body : {};
    const username = String(body.username || "").trim();
    const password = String(body.password || "");

    if (!username || !password) {
      return res.status(422).json({ ok: false, error: "Username and password are required" });
    }

    const db = await getDb();
    const user = await db.get(
      "SELECT id, username, password_hash, full_name, role FROM users WHERE username = ? LIMIT 1",
      username
    );

    if (!user || !bcrypt.compareSync(password, String(user.password_hash || ""))) {
      return res.status(401).json({ ok: false, error: "Invalid credentials" });
    }

    req.session.user = {
      id: Number(user.id),
      username: user.username,
      full_name: user.full_name,
      role: user.role
    };

    res.json({ ok: true, user: req.session.user });
  } catch (err) {
    res.status(500).json({ ok: false, error: "Login failed" });
  }
});

app.post("/api/change_password.php", requireAuth, async (req, res) => {
  try {
    const body = isPlainObject(req.body) ? req.body : {};
    const currentPassword = String(body.current_password || "");
    const newPassword = String(body.new_password || "");
    const confirmPassword = String(body.confirm_password || "");

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(422).json({ ok: false, error: "All password fields are required" });
    }
    if (newPassword !== confirmPassword) {
      return res
        .status(422)
        .json({ ok: false, error: "New password and confirm password do not match" });
    }
    if (newPassword.length < 8) {
      return res.status(422).json({ ok: false, error: "New password must be at least 8 characters" });
    }

    const db = await getDb();
    const row = await db.get("SELECT password_hash FROM users WHERE id = ? LIMIT 1", req.session.user.id);

    if (!row || !bcrypt.compareSync(currentPassword, String(row.password_hash || ""))) {
      return res.status(401).json({ ok: false, error: "Current password is incorrect" });
    }

    const hash = bcrypt.hashSync(newPassword, 10);
    await db.run("UPDATE users SET password_hash = ? WHERE id = ?", hash, req.session.user.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: "Unable to change password" });
  }
});

app.get("/api/items.php", requireAuth, async (req, res) => {
  try {
    const includeDeleted = String(req.query.include_deleted || "") === "1";
    let sql =
      "SELECT id, property_no, item_name, category, brand_model, serial_no, location, assigned_to, item_condition, acquired_date, remarks, extra_json, updated_at, deleted_at FROM inventory_items";
    if (!includeDeleted) sql += " WHERE deleted_at IS NULL";
    sql += " ORDER BY id DESC";

    const db = await getDb();
    const items = await db.all(sql);
    res.json({ ok: true, items });
  } catch (err) {
    res.status(500).json({ ok: false, error: "Failed to load inventory" });
  }
});

app.post("/api/items.php", requireAuth, async (req, res) => {
  const body = isPlainObject(req.body) ? req.body : {};
  try {
    const db = await getDb();

    const restoreId = Number(body.restore_id || 0);
    if (restoreId > 0) {
      const result = await db.run(
        "UPDATE inventory_items SET deleted_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NOT NULL",
        restoreId
      );
      if (Number(result.changes || 0) <= 0) {
        return res.status(404).json({ ok: false, error: "Item not found or already active" });
      }
      return res.json({ ok: true, id: restoreId });
    }

    if (Array.isArray(body.bulk_items)) {
      const stmt = await db.prepare(
        "INSERT INTO inventory_items (property_no, item_name, category, brand_model, serial_no, location, assigned_to, item_condition, acquired_date, remarks, extra_json, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      );
      let success = 0;
      let failed = 0;
      const failedRows = [];
      await db.run("BEGIN");
      try {
        for (let idx = 0; idx < body.bulk_items.length; idx++) {
          const item = body.bulk_items[idx];
          if (!isPlainObject(item)) {
            failed++;
            failedRows.push(`Row ${idx + 1}: Invalid item payload`);
            continue;
          }

          let extraJson = item.extra_json;
          if (Array.isArray(extraJson) || isPlainObject(extraJson)) {
            extraJson = safeJson(extraJson);
          }
          if (typeof extraJson !== "string") extraJson = "";

          try {
            await stmt.run(
              String(item.property_no || "").trim(),
              String(item.item_name || "").trim(),
              String(item.category || "").trim(),
              String(item.brand_model || "").trim(),
              String(item.serial_no || "").trim(),
              String(item.location || "").trim(),
              String(item.assigned_to || "").trim(),
              String(item.item_condition || "").trim(),
              String(item.acquired_date || "").trim(),
              String(item.remarks || "").trim(),
              extraJson,
              Number(req.session.user.id)
            );
            success++;
          } catch (e) {
            failed++;
            failedRows.push(`Row ${idx + 1}: Unable to save item`);
          }
        }
        await db.run("COMMIT");
      } catch (e) {
        await db.run("ROLLBACK");
        return res.status(500).json({ ok: false, error: "Bulk import failed" });
      } finally {
        await stmt.finalize();
      }

      return res.json({
        ok: true,
        success,
        failed,
        failed_rows: failedRows.slice(0, 20)
      });
    }

    const id = Number(body.id || 0);
    let extraJson = body.extra_json;
    if (Array.isArray(extraJson) || isPlainObject(extraJson)) extraJson = safeJson(extraJson);
    if (typeof extraJson !== "string") extraJson = "";

    if (id > 0) {
      await db.run(
        "UPDATE inventory_items SET property_no = ?, item_name = ?, category = ?, brand_model = ?, serial_no = ?, location = ?, assigned_to = ?, item_condition = ?, acquired_date = ?, remarks = ?, extra_json = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        String(body.property_no || "").trim(),
        String(body.item_name || "").trim(),
        String(body.category || "").trim(),
        String(body.brand_model || "").trim(),
        String(body.serial_no || "").trim(),
        String(body.location || "").trim(),
        String(body.assigned_to || "").trim(),
        String(body.item_condition || "").trim(),
        String(body.acquired_date || "").trim(),
        String(body.remarks || "").trim(),
        extraJson,
        Number(req.session.user.id),
        id
      );
      return res.json({ ok: true, id });
    }

    try {
      const result = await db.run(
        "INSERT INTO inventory_items (property_no, item_name, category, brand_model, serial_no, location, assigned_to, item_condition, acquired_date, remarks, extra_json, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        String(body.property_no || "").trim(),
        String(body.item_name || "").trim(),
        String(body.category || "").trim(),
        String(body.brand_model || "").trim(),
        String(body.serial_no || "").trim(),
        String(body.location || "").trim(),
        String(body.assigned_to || "").trim(),
        String(body.item_condition || "").trim(),
        String(body.acquired_date || "").trim(),
        String(body.remarks || "").trim(),
        extraJson,
        Number(req.session.user.id)
      );
      return res.status(201).json({ ok: true, id: Number(result.lastID) });
    } catch (e) {
      return res.status(409).json({ ok: false, error: "Unable to save inventory item" });
    }
  } catch (err) {
    res.status(500).json({ ok: false, error: "Unable to save inventory item" });
  }
});

app.delete("/api/items.php", requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const deleteAll = String(req.query.all || "") === "1";
    if (deleteAll) {
      const result = await db.run(
        "UPDATE inventory_items SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE deleted_at IS NULL"
      );
      return res.json({ ok: true, deleted: Number(result.changes || 0) });
    }

    const id = Number(req.query.id || 0);
    if (id <= 0) return res.status(422).json({ ok: false, error: "Missing item id" });

    const result = await db.run(
      "UPDATE inventory_items SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL",
      id
    );
    if (Number(result.changes || 0) <= 0) {
      return res.status(404).json({ ok: false, error: "Item already deleted or not found" });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: "Unable to delete item" });
  }
});

app.get("/api/imports.php", requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const includeDeleted = String(req.query.include_deleted || "") === "1";
    const hash = String(req.query.hash || "").trim();
    if (hash) {
      const existing = await db.get(
        "SELECT id, source_name, created_at, deleted_at FROM inventory_imports WHERE content_hash = ? LIMIT 1",
        hash
      );
      const isActive = existing && !existing.deleted_at;
      return res.json({
        ok: true,
        exists: Boolean(isActive),
        exists_deleted: Boolean(existing && !isActive),
        import: existing
          ? {
              id: Number(existing.id),
              source_name: existing.source_name,
              created_at: existing.created_at,
              deleted_at: existing.deleted_at
            }
          : null
      });
    }

    const all = String(req.query.all || "") === "1";
    if (all) {
      const full = String(req.query.full || "") === "1";
      let sql = "SELECT id, source_name, created_at, headers_json, rows_json, deleted_at FROM inventory_imports";
      if (!includeDeleted) sql += " WHERE deleted_at IS NULL";
      sql += " ORDER BY id DESC";
      const rows = await db.all(sql);

      const imports = rows.map((row) => {
        const headers = safeParseJson(String(row.headers_json || "[]"), []);
        const dataRows = safeParseJson(String(row.rows_json || "[]"), []);
        const entry = {
          id: Number(row.id),
          source_name: row.source_name,
          created_at: row.created_at,
          deleted_at: row.deleted_at,
          row_count: Array.isArray(dataRows) ? dataRows.length : 0,
          header_count: Array.isArray(headers) ? headers.length : 0
        };
        if (full) {
          entry.headers = Array.isArray(headers) ? headers : [];
          entry.rows = Array.isArray(dataRows) ? dataRows : [];
        }
        return entry;
      });

      return res.json({ ok: true, imports });
    }

    const id = Number(req.query.id || 0);
    let row;
    if (id > 0) {
      row = await db.get(
        "SELECT id, source_name, headers_json, rows_json, created_at, deleted_at FROM inventory_imports WHERE id = ? LIMIT 1",
        id
      );
    } else {
      let sql = "SELECT id, source_name, headers_json, rows_json, created_at, deleted_at FROM inventory_imports";
      if (!includeDeleted) sql += " WHERE deleted_at IS NULL";
      sql += " ORDER BY id DESC LIMIT 1";
      row = await db.get(sql);
    }

    if (!row) return res.json({ ok: true, import: null });

    res.json({
      ok: true,
      import: {
        id: Number(row.id),
        source_name: row.source_name,
        headers: safeParseJson(String(row.headers_json || "[]"), []),
        rows: safeParseJson(String(row.rows_json || "[]"), []),
        created_at: row.created_at,
        deleted_at: row.deleted_at
      }
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: "Failed to load imported CSV data." });
  }
});

app.post("/api/imports.php", requireAuth, async (req, res) => {
  const body = isPlainObject(req.body) ? req.body : {};
  try {
    const db = await getDb();

    const restoreId = Number(body.restore_id || 0);
    if (restoreId > 0) {
      const result = await db.run(
        "UPDATE inventory_imports SET deleted_at = NULL WHERE id = ? AND deleted_at IS NOT NULL",
        restoreId
      );
      if (Number(result.changes || 0) <= 0) {
        return res.status(404).json({ ok: false, error: "Imported CSV not found or already active" });
      }
      return res.json({ ok: true, id: restoreId });
    }

    const headers = Array.isArray(body.headers) ? body.headers : [];
    const rows = Array.isArray(body.rows) ? body.rows : null;
    const source = String(body.source_name || "import.csv").trim();
    const contentHash = String(body.content_hash || "").trim();

    if (!Array.isArray(headers) || headers.length === 0) {
      return res.status(422).json({ ok: false, error: "Missing headers" });
    }
    if (!Array.isArray(rows)) {
      return res.status(422).json({ ok: false, error: "Invalid rows payload" });
    }
    if (!contentHash) {
      return res.status(422).json({ ok: false, error: "Missing file hash" });
    }

    const existing = await db.get(
      "SELECT id, source_name, created_at, deleted_at FROM inventory_imports WHERE content_hash = ? LIMIT 1",
      contentHash
    );
    if (existing && !existing.deleted_at) {
      return res.status(409).json({
        ok: false,
        error: "This CSV file was already uploaded before.",
        duplicate: true,
        existing: {
          id: Number(existing.id),
          source_name: existing.source_name,
          created_at: existing.created_at,
          deleted_at: existing.deleted_at
        }
      });
    }

    const headersJson = safeJson(headers.map((h) => h));
    const rowsJson = safeJson(rows.map((r) => r));

    if (existing && existing.deleted_at) {
      await db.run(
        "UPDATE inventory_imports SET source_name = ?, headers_json = ?, rows_json = ?, created_by = ?, created_at = CURRENT_TIMESTAMP, deleted_at = NULL WHERE id = ?",
        source,
        headersJson,
        rowsJson,
        Number(req.session.user.id),
        Number(existing.id)
      );
      return res.status(200).json({ ok: true, id: Number(existing.id), restored: true });
    }

    const result = await db.run(
      "INSERT INTO inventory_imports (source_name, headers_json, rows_json, content_hash, created_by) VALUES (?, ?, ?, ?, ?)",
      source,
      headersJson,
      rowsJson,
      contentHash,
      Number(req.session.user.id)
    );
    res.status(201).json({ ok: true, id: Number(result.lastID) });
  } catch (err) {
    res.status(500).json({ ok: false, error: "Unable to save imported CSV" });
  }
});

app.delete("/api/imports.php", requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const id = Number(req.query.id || 0);

    if (id > 0) {
      const result = await db.run(
        "UPDATE inventory_imports SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL",
        id
      );
      if (Number(result.changes || 0) <= 0) {
        return res.status(404).json({ ok: false, error: "Imported CSV already deleted or not found" });
      }
      return res.json({ ok: true, deleted: Number(result.changes || 0) });
    }

    const latest = await db.get(
      "SELECT id FROM inventory_imports WHERE deleted_at IS NULL ORDER BY id DESC LIMIT 1"
    );
    const latestId = latest ? Number(latest.id) : 0;
    if (latestId <= 0) {
      return res.status(404).json({ ok: false, error: "No imported CSV to delete" });
    }

    const result = await db.run(
      "UPDATE inventory_imports SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL",
      latestId
    );
    res.json({ ok: true, deleted: Number(result.changes || 0), id: latestId });
  } catch (err) {
    res.status(500).json({ ok: false, error: "Unable to delete imported CSV" });
  }
});

app.use((req, res) => {
  res.status(404).send("Not found");
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

// --- Helpers / DB ---

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function safeJson(v) {
  try {
    return JSON.stringify(v);
  } catch (e) {
    return "[]";
  }
}

function safeParseJson(text, fallback) {
  try {
    const v = JSON.parse(text);
    return v === null || v === undefined ? fallback : v;
  } catch (e) {
    return fallback;
  }
}

function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
  next();
}

function sendPhpAsHtml(res, filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const html = raw.replace(/^\s*<\?php[\s\S]*?\?>\s*/i, "");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (e) {
    res.status(500).send("Unable to render page");
  }
}

let dbPromise = null;
async function getDb() {
  if (dbPromise) return dbPromise;

  const dbPath = String(process.env.DB_PATH || path.join(__dirname, "data", "database.sqlite"));
  ensureDir(path.dirname(dbPath));

  dbPromise = (async () => {
    const SQL = await initSqlJs({
      locateFile: (file) => path.join(__dirname, "node_modules", "sql.js", "dist", file)
    });

    const raw = fs.existsSync(dbPath)
      ? new SQL.Database(new Uint8Array(fs.readFileSync(dbPath)))
      : new SQL.Database();

    const persist = () => {
      const data = raw.export();
      fs.writeFileSync(dbPath, Buffer.from(data));
    };

    const db = {
      exec: async (sql) => {
        raw.run(sql);
        persist();
      },
      run: async (sql, ...params) => {
        raw.run(sql, params);
        const changes = raw.getRowsModified();
        let lastID = 0;
        try {
          const row = await db.get("SELECT last_insert_rowid() AS id");
          lastID = row ? Number(row.id || 0) : 0;
        } catch (e) {
          lastID = 0;
        }
        persist();
        return { changes, lastID };
      },
      all: async (sql, ...params) => {
        const stmt = raw.prepare(sql);
        stmt.bind(params);
        const rows = [];
        while (stmt.step()) {
          rows.push(stmt.getAsObject());
        }
        stmt.free();
        return rows;
      },
      get: async (sql, ...params) => {
        const rows = await db.all(sql, ...params);
        return rows[0];
      },
      prepare: async (sql) => {
        const stmt = raw.prepare(sql);
        return {
          run: async (...params) => {
            stmt.run(params);
            const changes = raw.getRowsModified();
            let lastID = 0;
            try {
              const row = await db.get("SELECT last_insert_rowid() AS id");
              lastID = row ? Number(row.id || 0) : 0;
            } catch (e) {
              lastID = 0;
            }
            persist();
            return { changes, lastID };
          },
          finalize: async () => {
            stmt.free();
          }
        };
      }
    };

    await db.exec("PRAGMA foreign_keys = ON");
    await initializeDb(db);
    return db;
  })();

  return dbPromise;
}

async function initializeDb(db) {
  await db.exec(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ("admin", "staff")),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);

  await db.exec(`CREATE TABLE IF NOT EXISTS inventory_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_no TEXT,
    item_name TEXT NOT NULL,
    category TEXT NOT NULL,
    brand_model TEXT NOT NULL,
    serial_no TEXT NOT NULL,
    location TEXT NOT NULL,
    assigned_to TEXT,
    item_condition TEXT NOT NULL,
    acquired_date TEXT NOT NULL,
    remarks TEXT,
    deleted_at TEXT,
    extra_json TEXT,
    updated_by INTEGER,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(updated_by) REFERENCES users(id)
  )`);

  await db.exec(`CREATE TABLE IF NOT EXISTS inventory_imports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_name TEXT NOT NULL,
    headers_json TEXT NOT NULL,
    rows_json TEXT NOT NULL,
    content_hash TEXT,
    deleted_at TEXT,
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(created_by) REFERENCES users(id)
  )`);

  await ensureColumnExists(db, "inventory_items", "deleted_at", "TEXT");
  await ensureColumnExists(db, "inventory_items", "extra_json", "TEXT");
  await ensureColumnExists(db, "inventory_imports", "content_hash", "TEXT");
  await ensureColumnExists(db, "inventory_imports", "deleted_at", "TEXT");
  await db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_imports_content_hash ON inventory_imports(content_hash)");

  // Enforce a single default admin account and remove old seeded accounts.
  await db.run("DELETE FROM users WHERE lower(username) IN ('admin', 'staff')");

  const hash = bcrypt.hashSync("admin", 10);
  await db.run(
    `INSERT INTO users (username, password_hash, full_name, role)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(username) DO UPDATE SET
       password_hash = excluded.password_hash,
       full_name = excluded.full_name,
       role = excluded.role`,
    "ICT",
    hash,
    "ICT Administrator",
    "admin"
  );

  // Keep this deterministic so DB init doesn't depend on runtime randomness.
  if (!process.env.SESSION_SECRET) {
    const fingerprint = crypto.createHash("sha256").update(String(hash)).digest("hex").slice(0, 12);
    console.warn(`SESSION_SECRET not set. Current default is insecure. Set SESSION_SECRET (hint: ${fingerprint}).`);
  }
}

async function ensureColumnExists(db, table, column, definition) {
  const cols = await db.all(`PRAGMA table_info(${table})`);
  if (cols.some((c) => String(c.name) === column)) return;
  await db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
