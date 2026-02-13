<?php
declare(strict_types=1);
require_once __DIR__ . '/_common.php';

session_start();
session_unset();
session_destroy();

json_response(['ok' => true]);
