<?php
declare(strict_types=1);

function json_response(array $payload, int $status = 200): void {
  http_response_code($status);
  header('Content-Type: application/json');
  header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
  header('Pragma: no-cache');
  echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
  exit;
}

function db(): PDO {
  static $pdo = null;
  if ($pdo instanceof PDO) {
    return $pdo;
  }

  $configuredPath = getenv('DB_PATH');
  $dbPath = is_string($configuredPath) && trim($configuredPath) !== ''
    ? trim($configuredPath)
    : (__DIR__ . '/../data/database.sqlite');

  $dbDir = dirname($dbPath);
  if (!is_dir($dbDir)) {
    mkdir($dbDir, 0777, true);
  }

  $pdo = new PDO('sqlite:' . $dbPath);
  $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
  $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

  initialize_db($pdo);

  return $pdo;
}

function initialize_db(PDO $pdo): void {
  $pdo->exec('CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ("admin", "staff")),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )');

  $pdo->exec('CREATE TABLE IF NOT EXISTS inventory_items (
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
    updated_by INTEGER,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(updated_by) REFERENCES users(id)
  )');

  migrate_inventory_items_property_no($pdo);
  ensure_column_exists($pdo, 'inventory_items', 'deleted_at', 'TEXT');
  ensure_column_exists($pdo, 'inventory_items', 'extra_json', 'TEXT');

  $pdo->exec('CREATE TABLE IF NOT EXISTS inventory_imports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_name TEXT NOT NULL,
    headers_json TEXT NOT NULL,
    rows_json TEXT NOT NULL,
    content_hash TEXT,
    deleted_at TEXT,
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(created_by) REFERENCES users(id)
  )');

  $columns = $pdo->query('PRAGMA table_info(inventory_imports)')->fetchAll();
  $hasContentHash = false;
  foreach ($columns as $column) {
    if (($column['name'] ?? '') === 'content_hash') {
      $hasContentHash = true;
      break;
    }
  }

  if (!$hasContentHash) {
    $pdo->exec('ALTER TABLE inventory_imports ADD COLUMN content_hash TEXT');
  }
  ensure_column_exists($pdo, 'inventory_imports', 'deleted_at', 'TEXT');

  $pdo->exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_imports_content_hash ON inventory_imports(content_hash)');

  // Enforce a single default admin account and remove old seeded accounts.
  $pdo->exec("DELETE FROM users WHERE lower(username) IN ('admin', 'staff')");
  $stmt = $pdo->prepare(
    'INSERT INTO users (username, password_hash, full_name, role)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(username) DO UPDATE SET
       password_hash = excluded.password_hash,
       full_name = excluded.full_name,
       role = excluded.role'
  );
  $stmt->execute(['ICT', password_hash('admin', PASSWORD_DEFAULT), 'ICT Administrator', 'admin']);
}

function ensure_column_exists(PDO $pdo, string $table, string $column, string $definition): void {
  $cols = $pdo->query("PRAGMA table_info($table)")->fetchAll();
  foreach ($cols as $col) {
    if (($col['name'] ?? '') === $column) {
      return;
    }
  }
  $pdo->exec("ALTER TABLE $table ADD COLUMN $column $definition");
}

function migrate_inventory_items_property_no(PDO $pdo): void {
  $columns = $pdo->query('PRAGMA table_info(inventory_items)')->fetchAll();
  $propertyColumn = null;
  foreach ($columns as $column) {
    if (($column['name'] ?? '') === 'property_no') {
      $propertyColumn = $column;
      break;
    }
  }

  $needsRebuild = false;
  if (is_array($propertyColumn)) {
    $isNotNull = (int)($propertyColumn['notnull'] ?? 0) === 1;
    if ($isNotNull) {
      $needsRebuild = true;
    }
  }

  $indexes = $pdo->query('PRAGMA index_list(inventory_items)')->fetchAll();
  foreach ($indexes as $index) {
    $isUnique = (int)($index['unique'] ?? 0) === 1;
    if (!$isUnique) {
      continue;
    }
    $indexName = (string)($index['name'] ?? '');
    if ($indexName === '') {
      continue;
    }
    $indexInfo = $pdo->query("PRAGMA index_info(" . $pdo->quote($indexName) . ")")->fetchAll();
    foreach ($indexInfo as $idxCol) {
      if (($idxCol['name'] ?? '') === 'property_no') {
        $needsRebuild = true;
        break 2;
      }
    }
  }

  if (!$needsRebuild) {
    return;
  }

  $pdo->beginTransaction();
  try {
    $pdo->exec('CREATE TABLE IF NOT EXISTS inventory_items_new (
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
      updated_by INTEGER,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(updated_by) REFERENCES users(id)
    )');

    $pdo->exec('INSERT INTO inventory_items_new
      (id, property_no, item_name, category, brand_model, serial_no, location, assigned_to, item_condition, acquired_date, remarks, updated_by, updated_at)
      SELECT id, property_no, item_name, category, brand_model, serial_no, location, assigned_to, item_condition, acquired_date, remarks, updated_by, updated_at
      FROM inventory_items');

    $pdo->exec('DROP TABLE inventory_items');
    $pdo->exec('ALTER TABLE inventory_items_new RENAME TO inventory_items');
    $pdo->commit();
  } catch (Throwable $e) {
    $pdo->rollBack();
    throw $e;
  }
}

function require_auth(): array {
  session_start();
  if (!isset($_SESSION['user'])) {
    json_response(['ok' => false, 'error' => 'Unauthorized'], 401);
  }
  return $_SESSION['user'];
}

function request_json(): array {
  $raw = file_get_contents('php://input');
  if ($raw === false || trim($raw) === '') {
    return [];
  }
  $data = json_decode($raw, true);
  return is_array($data) ? $data : [];
}
