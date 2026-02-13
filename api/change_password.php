<?php
declare(strict_types=1);
require_once __DIR__ . '/_common.php';

$user = require_auth();
$body = request_json();

$currentPassword = (string)($body['current_password'] ?? '');
$newPassword = (string)($body['new_password'] ?? '');
$confirmPassword = (string)($body['confirm_password'] ?? '');

if ($currentPassword === '' || $newPassword === '' || $confirmPassword === '') {
  json_response(['ok' => false, 'error' => 'All password fields are required'], 422);
}

if ($newPassword !== $confirmPassword) {
  json_response(['ok' => false, 'error' => 'New password and confirm password do not match'], 422);
}

if (strlen($newPassword) < 8) {
  json_response(['ok' => false, 'error' => 'New password must be at least 8 characters'], 422);
}

$pdo = db();
$stmt = $pdo->prepare('SELECT password_hash FROM users WHERE id = ? LIMIT 1');
$stmt->execute([(int)$user['id']]);
$row = $stmt->fetch();

if (!$row || !password_verify($currentPassword, $row['password_hash'])) {
  json_response(['ok' => false, 'error' => 'Current password is incorrect'], 401);
}

$update = $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
$update->execute([password_hash($newPassword, PASSWORD_DEFAULT), (int)$user['id']]);

json_response(['ok' => true]);
