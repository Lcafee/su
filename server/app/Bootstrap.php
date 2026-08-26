<?php

declare(strict_types=1);

namespace LCafe\Admin;

use PDO;
use PDOException;

/** @return array<string, mixed> */
function load_private_config(): array
{
    date_default_timezone_set('UTC');
    $configuredPath = getenv('LCAFE_PRIVATE_CONFIG');
    if (!is_string($configuredPath) || trim($configuredPath) === '') {
        throw new ApiException(503, 'configuration_unavailable', 'The service is not configured.');
    }
    $path = realpath($configuredPath);
    if ($path === false || !is_file($path) || !is_readable($path)) {
        throw new ApiException(503, 'configuration_unavailable', 'The private configuration is unavailable.');
    }

    $documentRoot = realpath((string) ($_SERVER['DOCUMENT_ROOT'] ?? ''));
    if ($documentRoot !== false) {
        $root = rtrim(str_replace('\\', '/', $documentRoot), '/') . '/';
        $normalPath = str_replace('\\', '/', $path);
        if (str_starts_with($normalPath, $root)) {
            throw new ApiException(503, 'configuration_unavailable', 'The private configuration must be outside the web root.');
        }
    }

    $config = require $path;
    if (!is_array($config)) {
        throw new ApiException(503, 'configuration_unavailable', 'The private configuration is invalid.');
    }

    $required = [
        ['database', 'dsn'],
        ['database', 'username'],
        ['database', 'password'],
        ['paths', 'session_dir'],
        ['paths', 'snapshot_public_dir'],
        ['paths', 'snapshot_archive_dir'],
        ['paths', 'media_public_dir'],
        ['paths', 'media_original_dir'],
        ['urls', 'media'],
        ['security', 'allowed_origin'],
        ['security', 'session_name'],
        ['security', 'idle_timeout_seconds'],
        ['security', 'absolute_timeout_seconds'],
        ['security', 'max_login_failures'],
        ['security', 'login_lock_seconds'],
        ['uploads', 'max_bytes'],
        ['uploads', 'max_pixels'],
        ['uploads', 'rendition_sizes'],
        ['uploads', 'webp_quality'],
    ];
    foreach ($required as [$section, $key]) {
        if (!isset($config[$section]) || !is_array($config[$section]) || !array_key_exists($key, $config[$section])) {
            throw new ApiException(503, 'configuration_unavailable', 'The private configuration is incomplete.');
        }
        $value = $config[$section][$key];
        if (is_string($value) && ($value === '' || str_contains($value, '__REPLACE_'))) {
            throw new ApiException(503, 'configuration_unavailable', 'The private configuration contains placeholders.');
        }
    }

    if (!preg_match('/^[A-Za-z0-9_]{1,48}$/', (string) $config['security']['session_name'])) {
        throw new ApiException(503, 'configuration_unavailable', 'The configured session name is invalid.');
    }
    $sizes = $config['uploads']['rendition_sizes'];
    if (!is_array($sizes) || array_values($sizes) !== [300, 600]) {
        throw new ApiException(503, 'configuration_unavailable', 'V1 requires 300px and 600px image renditions.');
    }
    return $config;
}

/** @param array<string, mixed> $config */
function connect_database(array $config): PDO
{
    try {
        return new PDO(
            (string) $config['database']['dsn'],
            (string) $config['database']['username'],
            (string) $config['database']['password'],
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]
        );
    } catch (PDOException $exception) {
        error_log('L Cafe admin database connection failed: ' . $exception->getCode());
        throw new ApiException(503, 'database_unavailable', 'The menu database is temporarily unavailable.');
    }
}

function require_writable_directory(string $path, string $purpose): string
{
    $resolved = realpath($path);
    if ($resolved === false || !is_dir($resolved) || !is_writable($resolved)) {
        throw new ApiException(503, 'storage_unavailable', "$purpose storage is unavailable.");
    }
    return rtrim($resolved, DIRECTORY_SEPARATOR);
}

/** @param array<string, mixed> $config */
function start_admin_session(array $config): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    $sessionDir = require_writable_directory((string) $config['paths']['session_dir'], 'Session');
    $absoluteTimeout = max(300, (int) $config['security']['absolute_timeout_seconds']);

    session_name((string) $config['security']['session_name']);
    session_save_path($sessionDir);
    ini_set('session.use_only_cookies', '1');
    ini_set('session.use_strict_mode', '1');
    ini_set('session.cookie_httponly', '1');
    ini_set('session.cookie_secure', '1');
    ini_set('session.cookie_samesite', 'Strict');
    ini_set('session.gc_maxlifetime', (string) $absoluteTimeout);
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => true,
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    if (!session_start()) {
        throw new ApiException(503, 'session_unavailable', 'The admin session could not be started.');
    }
}
