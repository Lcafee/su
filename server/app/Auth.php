<?php

declare(strict_types=1);

namespace LCafe\Admin;

use DateTimeImmutable;
use DateTimeZone;
use PDO;

function clear_session_identity(): void
{
    unset(
        $_SESSION['user_id'],
        $_SESSION['username'],
        $_SESSION['issued_at'],
        $_SESSION['last_seen'],
        $_SESSION['csrf_token']
    );
}

/**
 * @param array<string, mixed> $config
 * @return array{id:int,username:string}|null
 */
function session_user(PDO $pdo, array $config, bool $touch = true): ?array
{
    $userId = $_SESSION['user_id'] ?? null;
    $issuedAt = $_SESSION['issued_at'] ?? null;
    $lastSeen = $_SESSION['last_seen'] ?? null;
    if (!is_int($userId) || !is_int($issuedAt) || !is_int($lastSeen)) {
        clear_session_identity();
        return null;
    }

    $now = time();
    $idleTimeout = max(60, (int) $config['security']['idle_timeout_seconds']);
    $absoluteTimeout = max($idleTimeout, (int) $config['security']['absolute_timeout_seconds']);
    if (($now - $lastSeen) > $idleTimeout || ($now - $issuedAt) > $absoluteTimeout) {
        clear_session_identity();
        return null;
    }

    $statement = $pdo->prepare('SELECT id, username FROM admin_users WHERE id = ? AND is_active = 1');
    $statement->execute([$userId]);
    $user = $statement->fetch();
    if (!is_array($user)) {
        clear_session_identity();
        return null;
    }
    if ($touch) {
        $_SESSION['last_seen'] = $now;
    }
    return ['id' => (int) $user['id'], 'username' => (string) $user['username']];
}

/** @param array<string, mixed> $config @return array{id:int,username:string} */
function require_user(PDO $pdo, array $config): array
{
    $user = session_user($pdo, $config);
    if ($user === null) {
        throw new ApiException(401, 'authentication_required', 'Authentication is required.');
    }
    return $user;
}

/** @param array<string, mixed> $config */
function require_csrf(array $config): void
{
    require_allowed_origin($config);
    $expected = $_SESSION['csrf_token'] ?? null;
    $actual = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? null;
    if (!is_string($expected) || !is_string($actual) || !hash_equals($expected, $actual)) {
        throw new ApiException(403, 'csrf_rejected', 'The CSRF token is missing or invalid.');
    }
}

/** @param array<string, mixed> $config @return array<string, mixed> */
function session_payload(PDO $pdo, array $config): array
{
    $user = session_user($pdo, $config);
    if ($user === null) {
        return ['authenticated' => false];
    }
    return [
        'authenticated' => true,
        'user' => $user,
        'csrfToken' => (string) $_SESSION['csrf_token'],
    ];
}

/** @param array<string, mixed> $config @param array<string, mixed> $input @return array<string, mixed> */
function login(PDO $pdo, array $config, array $input): array
{
    require_allowed_origin($config);
    $username = required_text($input['username'] ?? null, 'username', 191);
    $password = $input['password'] ?? null;
    if (!is_string($password) || $password === '' || strlen($password) > 4096) {
        throw new ApiException(401, 'invalid_credentials', 'The username or password is incorrect.');
    }

    $statement = $pdo->prepare(
        'SELECT id, username, password_hash, is_active, failed_login_count, locked_until '
        . 'FROM admin_users WHERE username = ? LIMIT 1'
    );
    $statement->execute([$username]);
    $row = $statement->fetch();
    $dummyHash = '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.';
    $hash = is_array($row) ? (string) $row['password_hash'] : $dummyHash;
    $passwordMatches = password_verify($password, $hash);

    $now = new DateTimeImmutable('now', new DateTimeZone('UTC'));
    $locked = false;
    if (is_array($row) && $row['locked_until'] !== null) {
        $lockedUntil = new DateTimeImmutable((string) $row['locked_until'], new DateTimeZone('UTC'));
        $locked = $lockedUntil > $now;
    }
    $valid = is_array($row) && (int) $row['is_active'] === 1 && $passwordMatches && !$locked;

    if (!$valid) {
        if (is_array($row)) {
            $priorFailures = $locked ? (int) $row['failed_login_count'] : 0;
            if (!$locked && $row['locked_until'] === null) {
                $priorFailures = (int) $row['failed_login_count'];
            }
            $failures = $priorFailures + 1;
            $maxFailures = max(1, (int) $config['security']['max_login_failures']);
            $lockValue = null;
            if ($failures >= $maxFailures) {
                $lockValue = $now
                    ->modify('+' . max(60, (int) $config['security']['login_lock_seconds']) . ' seconds')
                    ->format('Y-m-d H:i:s.u');
            }
            $update = $pdo->prepare('UPDATE admin_users SET failed_login_count = ?, locked_until = ? WHERE id = ?');
            $update->execute([$failures, $lockValue, (int) $row['id']]);
        }
        throw new ApiException(401, 'invalid_credentials', 'The username or password is incorrect.');
    }

    $pdo->prepare(
        'UPDATE admin_users SET failed_login_count = 0, locked_until = NULL, last_login_at = UTC_TIMESTAMP(6) WHERE id = ?'
    )->execute([(int) $row['id']]);
    if (password_needs_rehash($hash, PASSWORD_DEFAULT)) {
        $pdo->prepare('UPDATE admin_users SET password_hash = ? WHERE id = ?')
            ->execute([password_hash($password, PASSWORD_DEFAULT), (int) $row['id']]);
    }

    session_regenerate_id(true);
    $_SESSION['user_id'] = (int) $row['id'];
    $_SESSION['username'] = (string) $row['username'];
    $_SESSION['issued_at'] = time();
    $_SESSION['last_seen'] = time();
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    return session_payload($pdo, $config);
}

/** @param array<string, mixed> $config */
function logout(array $config): void
{
    require_csrf($config);
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', [
            'expires' => time() - 42000,
            'path' => $params['path'],
            'domain' => $params['domain'],
            'secure' => $params['secure'],
            'httponly' => $params['httponly'],
            'samesite' => $params['samesite'] ?? 'Strict',
        ]);
    }
    session_destroy();
}
