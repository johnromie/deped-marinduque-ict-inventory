<?php
declare(strict_types=1);
require_once __DIR__ . '/_common.php';

session_start();
$body = request_json();
$username = trim((string)($body['username'] ?? ''));
$password = (string)($body['password'] ?? '');

if ($username === '' || $password === '') {
  json_response(['ok' => false, 'error' => 'Username and password are required'], 422);
}

$stmt = db()->prepare('SELECT id, username, password_hash, full_name, role FROM users WHERE username = ? LIMIT 1');
$stmt->execute([$username]);
$user = $stmt->fetch();

if (!$user || !password_verify($password, $user['password_hash'])) {
  json_response(['ok' => false, 'error' => 'Invalid credentials'], 401);
}

$_SESSION['user'] = [
  'id' => (int)$user['id'],
  'username' => $user['username'],
  'full_name' => $user['full_name'],
  'role' => $user['role']
];

json_response(['ok' => true, 'user' => $_SESSION['user']]);
