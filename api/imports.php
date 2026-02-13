<?php
declare(strict_types=1);
require_once __DIR__ . '/_common.php';

$user = require_auth();
$pdo = db();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
  $includeDeleted = isset($_GET['include_deleted']) && $_GET['include_deleted'] === '1';
  $hash = trim((string)($_GET['hash'] ?? ''));
  if ($hash !== '') {
    $stmt = $pdo->prepare('SELECT id, source_name, created_at, deleted_at FROM inventory_imports WHERE content_hash = ? LIMIT 1');
    $stmt->execute([$hash]);
    $existing = $stmt->fetch();
    $isActive = $existing && empty($existing['deleted_at']);
    json_response([
      'ok' => true,
      'exists' => (bool)$isActive,
      'exists_deleted' => (bool)$existing && !$isActive,
      'import' => $existing ? [
        'id' => (int)$existing['id'],
        'source_name' => $existing['source_name'],
        'created_at' => $existing['created_at'],
        'deleted_at' => $existing['deleted_at']
      ] : null
    ]);
  }

  $all = isset($_GET['all']) && $_GET['all'] === '1';
  if ($all) {
    $full = isset($_GET['full']) && $_GET['full'] === '1';
    $sql = 'SELECT id, source_name, created_at, headers_json, rows_json, deleted_at FROM inventory_imports';
    if (!$includeDeleted) {
      $sql .= ' WHERE deleted_at IS NULL';
    }
    $sql .= ' ORDER BY id DESC';
    $stmt = $pdo->query($sql);
    $imports = [];
    foreach ($stmt->fetchAll() as $row) {
      $rows = json_decode((string)$row['rows_json'], true) ?: [];
      $headers = json_decode((string)$row['headers_json'], true) ?: [];
      $entry = [
        'id' => (int)$row['id'],
        'source_name' => $row['source_name'],
        'created_at' => $row['created_at'],
        'deleted_at' => $row['deleted_at'],
        'row_count' => is_array($rows) ? count($rows) : 0,
        'header_count' => is_array($headers) ? count($headers) : 0
      ];
      if ($full) {
        $entry['headers'] = is_array($headers) ? array_values($headers) : [];
        $entry['rows'] = is_array($rows) ? array_values($rows) : [];
      }
      $imports[] = $entry;
    }
    json_response(['ok' => true, 'imports' => $imports]);
  }

  $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
  if ($id > 0) {
    $stmt = $pdo->prepare('SELECT id, source_name, headers_json, rows_json, created_at, deleted_at FROM inventory_imports WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
  } else {
    $sql = 'SELECT id, source_name, headers_json, rows_json, created_at, deleted_at FROM inventory_imports';
    if (!$includeDeleted) {
      $sql .= ' WHERE deleted_at IS NULL';
    }
    $sql .= ' ORDER BY id DESC LIMIT 1';
    $stmt = $pdo->query($sql);
    $row = $stmt->fetch();
  }

  if (!$row) {
    json_response(['ok' => true, 'import' => null]);
  }

  json_response([
    'ok' => true,
    'import' => [
      'id' => (int)$row['id'],
      'source_name' => $row['source_name'],
      'headers' => json_decode((string)$row['headers_json'], true) ?: [],
      'rows' => json_decode((string)$row['rows_json'], true) ?: [],
      'created_at' => $row['created_at'],
      'deleted_at' => $row['deleted_at']
    ]
  ]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $body = request_json();
  $restoreId = isset($body['restore_id']) ? (int)$body['restore_id'] : 0;
  if ($restoreId > 0) {
    $stmt = $pdo->prepare('UPDATE inventory_imports SET deleted_at = NULL WHERE id = ? AND deleted_at IS NOT NULL');
    $stmt->execute([$restoreId]);
    if ((int)$stmt->rowCount() <= 0) {
      json_response(['ok' => false, 'error' => 'Imported CSV not found or already active'], 404);
    }
    json_response(['ok' => true, 'id' => $restoreId]);
  }

  $headers = $body['headers'] ?? [];
  $rows = $body['rows'] ?? [];
  $source = trim((string)($body['source_name'] ?? 'import.csv'));
  $contentHash = trim((string)($body['content_hash'] ?? ''));

  if (!is_array($headers) || count($headers) === 0) {
    json_response(['ok' => false, 'error' => 'Missing headers'], 422);
  }

  if (!is_array($rows)) {
    json_response(['ok' => false, 'error' => 'Invalid rows payload'], 422);
  }

  if ($contentHash === '') {
    json_response(['ok' => false, 'error' => 'Missing file hash'], 422);
  }

  $dupStmt = $pdo->prepare('SELECT id, source_name, created_at, deleted_at FROM inventory_imports WHERE content_hash = ? LIMIT 1');
  $dupStmt->execute([$contentHash]);
  $existing = $dupStmt->fetch();
  if ($existing && empty($existing['deleted_at'])) {
    json_response([
      'ok' => false,
      'error' => 'This CSV file was already uploaded before.',
      'duplicate' => true,
      'existing' => [
        'id' => (int)$existing['id'],
        'source_name' => $existing['source_name'],
        'created_at' => $existing['created_at'],
        'deleted_at' => $existing['deleted_at']
      ]
    ], 409);
  }

  $headersJson = json_encode(array_values($headers), JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
  $rowsJson = json_encode(array_values($rows), JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);

  if (!is_string($headersJson) || !is_string($rowsJson)) {
    json_response(['ok' => false, 'error' => 'Unable to encode imported CSV data'], 422);
  }

  if ($existing && !empty($existing['deleted_at'])) {
    $stmt = $pdo->prepare('UPDATE inventory_imports
      SET source_name = ?, headers_json = ?, rows_json = ?, created_by = ?, created_at = CURRENT_TIMESTAMP, deleted_at = NULL
      WHERE id = ?');
    $stmt->execute([
      $source,
      $headersJson,
      $rowsJson,
      (int)$user['id'],
      (int)$existing['id']
    ]);
    json_response(['ok' => true, 'id' => (int)$existing['id'], 'restored' => true], 200);
  }

  $stmt = $pdo->prepare('INSERT INTO inventory_imports (source_name, headers_json, rows_json, content_hash, created_by) VALUES (?, ?, ?, ?, ?)');
  $stmt->execute([
    $source,
    $headersJson,
    $rowsJson,
    $contentHash,
    (int)$user['id']
  ]);

  json_response(['ok' => true, 'id' => (int)$pdo->lastInsertId()], 201);
}

if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
  $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;

  if ($id > 0) {
    $stmt = $pdo->prepare('UPDATE inventory_imports SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL');
    $stmt->execute([$id]);
    $deleted = (int)$stmt->rowCount();
    if ($deleted <= 0) {
      json_response(['ok' => false, 'error' => 'Imported CSV already deleted or not found'], 404);
    }
    json_response(['ok' => true, 'deleted' => $deleted]);
  }

  $latestId = (int)$pdo->query('SELECT id FROM inventory_imports WHERE deleted_at IS NULL ORDER BY id DESC LIMIT 1')->fetchColumn();
  if ($latestId <= 0) {
    json_response(['ok' => false, 'error' => 'No imported CSV to delete'], 404);
  }

  $stmt = $pdo->prepare('UPDATE inventory_imports SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL');
  $stmt->execute([$latestId]);
  json_response(['ok' => true, 'deleted' => (int)$stmt->rowCount(), 'id' => $latestId]);
}

json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
