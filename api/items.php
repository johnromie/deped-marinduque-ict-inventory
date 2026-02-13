<?php
declare(strict_types=1);
require_once __DIR__ . '/_common.php';

$user = require_auth();
$pdo = db();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
  $includeDeleted = isset($_GET['include_deleted']) && $_GET['include_deleted'] === '1';
  $sql = 'SELECT id, property_no, item_name, category, brand_model, serial_no, location, assigned_to, item_condition, acquired_date, remarks, extra_json, updated_at, deleted_at FROM inventory_items';
  if (!$includeDeleted) {
    $sql .= ' WHERE deleted_at IS NULL';
  }
  $sql .= ' ORDER BY id DESC';
  $stmt = $pdo->query($sql);
  json_response(['ok' => true, 'items' => $stmt->fetchAll()]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $body = request_json();
  $restoreId = isset($body['restore_id']) ? (int)$body['restore_id'] : 0;
  if ($restoreId > 0) {
    $stmt = $pdo->prepare('UPDATE inventory_items SET deleted_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NOT NULL');
    $stmt->execute([$restoreId]);
    if ((int)$stmt->rowCount() <= 0) {
      json_response(['ok' => false, 'error' => 'Item not found or already active'], 404);
    }
    json_response(['ok' => true, 'id' => $restoreId]);
  }

  $bulkItems = $body['bulk_items'] ?? null;
  if (is_array($bulkItems)) {
    $stmt = $pdo->prepare('INSERT INTO inventory_items
      (property_no, item_name, category, brand_model, serial_no, location, assigned_to, item_condition, acquired_date, remarks, extra_json, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');

    $success = 0;
    $failed = 0;
    $failedRows = [];

    $pdo->beginTransaction();
    try {
      foreach ($bulkItems as $idx => $item) {
        if (!is_array($item)) {
          $failed++;
          $failedRows[] = 'Row ' . ($idx + 1) . ': Invalid item payload';
          continue;
        }

        $extraJson = $item['extra_json'] ?? null;
        if (is_array($extraJson)) {
          $extraJson = json_encode($extraJson, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
        }
        if (!is_string($extraJson)) {
          $extraJson = '';
        }

        try {
          $stmt->execute([
            trim((string)($item['property_no'] ?? '')),
            trim((string)($item['item_name'] ?? '')),
            trim((string)($item['category'] ?? '')),
            trim((string)($item['brand_model'] ?? '')),
            trim((string)($item['serial_no'] ?? '')),
            trim((string)($item['location'] ?? '')),
            trim((string)($item['assigned_to'] ?? '')),
            trim((string)($item['item_condition'] ?? '')),
            trim((string)($item['acquired_date'] ?? '')),
            trim((string)($item['remarks'] ?? '')),
            $extraJson,
            (int)$user['id']
          ]);
          $success++;
        } catch (Throwable $e) {
          $failed++;
          $failedRows[] = 'Row ' . ($idx + 1) . ': Unable to save item';
        }
      }
      $pdo->commit();
    } catch (Throwable $e) {
      $pdo->rollBack();
      json_response(['ok' => false, 'error' => 'Bulk import failed'], 500);
    }

    json_response([
      'ok' => true,
      'success' => $success,
      'failed' => $failed,
      'failed_rows' => array_slice($failedRows, 0, 20)
    ]);
  }

  $id = isset($body['id']) ? (int)$body['id'] : 0;

  if ($id > 0) {
    $extraJson = $body['extra_json'] ?? null;
    if (is_array($extraJson)) {
      $extraJson = json_encode($extraJson, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    }
    if (!is_string($extraJson)) {
      $extraJson = '';
    }
    $stmt = $pdo->prepare('UPDATE inventory_items
      SET property_no = ?, item_name = ?, category = ?, brand_model = ?, serial_no = ?, location = ?, assigned_to = ?, item_condition = ?, acquired_date = ?, remarks = ?, extra_json = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?');

    $stmt->execute([
      trim((string)($body['property_no'] ?? '')),
      trim((string)$body['item_name']),
      trim((string)$body['category']),
      trim((string)$body['brand_model']),
      trim((string)$body['serial_no']),
      trim((string)$body['location']),
      trim((string)($body['assigned_to'] ?? '')),
      trim((string)$body['item_condition']),
      trim((string)$body['acquired_date']),
      trim((string)($body['remarks'] ?? '')),
      $extraJson,
      (int)$user['id'],
      $id
    ]);

    json_response(['ok' => true, 'id' => $id]);
  }

  $extraJson = $body['extra_json'] ?? null;
  if (is_array($extraJson)) {
    $extraJson = json_encode($extraJson, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
  }
  if (!is_string($extraJson)) {
    $extraJson = '';
  }

  $stmt = $pdo->prepare('INSERT INTO inventory_items
    (property_no, item_name, category, brand_model, serial_no, location, assigned_to, item_condition, acquired_date, remarks, extra_json, updated_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');

  try {
    $stmt->execute([
      trim((string)($body['property_no'] ?? '')),
      trim((string)$body['item_name']),
      trim((string)$body['category']),
      trim((string)$body['brand_model']),
      trim((string)$body['serial_no']),
      trim((string)$body['location']),
      trim((string)($body['assigned_to'] ?? '')),
      trim((string)$body['item_condition']),
      trim((string)$body['acquired_date']),
      trim((string)($body['remarks'] ?? '')),
      $extraJson,
      (int)$user['id']
    ]);
  } catch (Throwable $e) {
    json_response(['ok' => false, 'error' => 'Unable to save inventory item'], 409);
  }

  $newId = (int)$pdo->lastInsertId();
  json_response(['ok' => true, 'id' => $newId], 201);
}

if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
  $deleteAll = isset($_GET['all']) && $_GET['all'] === '1';
  if ($deleteAll) {
    $stmt = $pdo->prepare('UPDATE inventory_items SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE deleted_at IS NULL');
    $stmt->execute();
    json_response(['ok' => true, 'deleted' => (int)$stmt->rowCount()]);
  }

  $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
  if ($id <= 0) {
    json_response(['ok' => false, 'error' => 'Missing item id'], 422);
  }

  $stmt = $pdo->prepare('UPDATE inventory_items SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL');
  $stmt->execute([$id]);

  if ((int)$stmt->rowCount() <= 0) {
    json_response(['ok' => false, 'error' => 'Item already deleted or not found'], 404);
  }

  json_response(['ok' => true]);
}

json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
