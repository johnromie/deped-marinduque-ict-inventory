<?php
declare(strict_types=1);
require_once __DIR__ . '/_common.php';

session_start();
if (!isset($_SESSION['user'])) {
  json_response(['ok' => false, 'error' => 'Unauthorized'], 401);
}

json_response(['ok' => true, 'user' => $_SESSION['user']]);
