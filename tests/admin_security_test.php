<?php

declare(strict_types=1);

require dirname(__DIR__) . '/server/app/Http.php';
require dirname(__DIR__) . '/server/app/Provisioning.php';
require dirname(__DIR__) . '/server/app/Auth.php';

session_start();

final class AdminSecurityTestPdo extends PDO
{
    /** @var array<string, mixed> */
    public array $user;
    public bool $rotateBeforeLoginUpdate = false;
    public ?string $concurrentPasswordHash = null;

    /** @param array<string, mixed> $user */
    public function __construct(array $user)
    {
        $this->user = $user;
    }

    public function prepare(string $query, array $options = []): PDOStatement|false
    {
        return new AdminSecurityTestStatement($this, $query);
    }
}

final class AdminSecurityTestStatement extends PDOStatement
{
    private mixed $result = false;
    private int $affectedRows = 0;

    public function __construct(
        private readonly AdminSecurityTestPdo $database,
        private readonly string $query
    ) {
    }

    public function execute(?array $params = null): bool
    {
        $params ??= [];
        $this->affectedRows = 0;
        $this->result = false;

        if (str_starts_with($this->query, 'SELECT id, username, role, session_epoch')) {
            if (
                (int) ($params[0] ?? 0) === (int) $this->database->user['id']
                && (int) $this->database->user['is_active'] === 1
            ) {
                $this->result = [
                    'id' => $this->database->user['id'],
                    'username' => $this->database->user['username'],
                    'role' => $this->database->user['role'],
                    'session_epoch' => $this->database->user['session_epoch'],
                ];
            }
            return true;
        }

        if (str_starts_with($this->query, 'SELECT id, username, password_hash, session_epoch')) {
            if (hash_equals((string) $this->database->user['username'], (string) ($params[0] ?? ''))) {
                $this->result = $this->database->user;
            }
            return true;
        }

        if (str_starts_with($this->query, 'UPDATE admin_users SET failed_login_count = 0')) {
            if ($this->database->rotateBeforeLoginUpdate) {
                $this->database->rotateBeforeLoginUpdate = false;
                $this->database->user['password_hash'] = $this->database->concurrentPasswordHash;
                $this->database->user['session_epoch'] = (string) (
                    (int) $this->database->user['session_epoch'] + 1
                );
            }
            [$id, $epoch, $hash] = $params;
            if (
                (int) $id === (int) $this->database->user['id']
                && hash_equals((string) $this->database->user['session_epoch'], (string) $epoch)
                && hash_equals((string) $this->database->user['password_hash'], (string) $hash)
            ) {
                $this->database->user['failed_login_count'] = 0;
                $this->database->user['locked_until'] = null;
                $this->database->user['last_login_at'] = 'test-login-time';
                $this->affectedRows = 1;
            }
            return true;
        }

        if (str_starts_with($this->query, 'UPDATE admin_users SET password_hash = ?') && count($params) === 4) {
            [$newHash, $id, $epoch, $oldHash] = $params;
            if (
                (int) $id === (int) $this->database->user['id']
                && hash_equals((string) $this->database->user['session_epoch'], (string) $epoch)
                && hash_equals((string) $this->database->user['password_hash'], (string) $oldHash)
            ) {
                $this->database->user['password_hash'] = $newHash;
                $this->affectedRows = 1;
            }
            return true;
        }

        if (str_starts_with($this->query, 'UPDATE admin_users SET password_hash = ?') && count($params) === 6) {
            [$newHash, $id, $oldHash, $epoch, $role, $isActive] = $params;
            if (
                (int) $id === (int) $this->database->user['id']
                && hash_equals((string) $this->database->user['password_hash'], (string) $oldHash)
                && hash_equals((string) $this->database->user['session_epoch'], (string) $epoch)
                && hash_equals((string) $this->database->user['role'], (string) $role)
                && (int) $isActive === (int) $this->database->user['is_active']
            ) {
                $this->database->user['password_hash'] = $newHash;
                $this->database->user['failed_login_count'] = 0;
                $this->database->user['locked_until'] = null;
                $this->database->user['session_epoch'] = (string) ((int) $epoch + 1);
                $this->affectedRows = 1;
            }
            return true;
        }

        throw new RuntimeException('Unexpected test query: ' . $this->query);
    }

    public function fetch(
        int $mode = PDO::FETCH_DEFAULT,
        int $cursorOrientation = PDO::FETCH_ORI_NEXT,
        int $cursorOffset = 0
    ): mixed {
        return $this->result;
    }

    public function rowCount(): int
    {
        return $this->affectedRows;
    }
}

function assert_admin_security(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$oldHash = password_hash('Old-password-phrase-27', PASSWORD_DEFAULT);
$database = new AdminSecurityTestPdo([
    'id' => 42,
    'username' => 'cashier',
    'password_hash' => $oldHash,
    'role' => 'cashier',
    'is_active' => 1,
    'failed_login_count' => 5,
    'locked_until' => '2030-01-01 00:00:00.000000',
    'last_login_at' => '2026-09-01 00:00:00.000000',
    'session_epoch' => '7',
]);
$config = [
    'security' => [
        'allowed_origin' => 'https://l-cafe.test',
        'idle_timeout_seconds' => 1800,
        'absolute_timeout_seconds' => 28800,
        'max_login_failures' => 5,
        'login_lock_seconds' => 900,
    ],
];
$_SERVER['HTTP_ORIGIN'] = 'https://l-cafe.test';

$_SESSION = [
    'user_id' => 42,
    'username' => 'cashier',
    'issued_at' => time(),
    'last_seen' => time(),
    'csrf_token' => 'old-session-token',
];
assert_admin_security(
    LCafe\Admin\session_user($database, $config) === null,
    'A pre-epoch session must be rejected.'
);
assert_admin_security($_SESSION === [], 'Rejected session identity must be cleared.');

$_SESSION = [
    'user_id' => 42,
    'username' => 'cashier',
    'session_epoch' => '7',
    'issued_at' => time(),
    'last_seen' => time(),
    'csrf_token' => 'current-session-token',
];
$currentUser = LCafe\Admin\session_user($database, $config);
assert_admin_security($currentUser !== null, 'A current-epoch session must remain valid.');
assert_admin_security($currentUser['role'] === 'cashier', 'The cashier role must remain unchanged.');

$observedUser = $database->user;
$newHash = password_hash('New-password-phrase-83', PASSWORD_DEFAULT);
LCafe\Admin\apply_admin_password_rotation($database, $observedUser, $newHash);

assert_admin_security(
    password_verify('New-password-phrase-83', (string) $database->user['password_hash']),
    'Rotation must install the new password hash.'
);
assert_admin_security($database->user['session_epoch'] === '8', 'Rotation must increment the session epoch once.');
assert_admin_security($database->user['failed_login_count'] === 0, 'Rotation must reset failed logins.');
assert_admin_security($database->user['locked_until'] === null, 'Rotation must clear the lockout timestamp.');
assert_admin_security($database->user['role'] === 'cashier', 'Rotation must preserve the role.');
assert_admin_security($database->user['is_active'] === 1, 'Rotation must preserve active state.');
assert_admin_security(
    $database->user['last_login_at'] === '2026-09-01 00:00:00.000000',
    'Rotation must preserve the last-login timestamp.'
);

assert_admin_security(
    LCafe\Admin\session_user($database, $config) === null,
    'A session issued before rotation must be rejected after the epoch changes.'
);

$_SESSION = [
    'user_id' => 42,
    'username' => 'cashier',
    'session_epoch' => '8',
    'issued_at' => time(),
    'last_seen' => time(),
    'csrf_token' => 'new-session-token',
];
assert_admin_security(
    LCafe\Admin\session_user($database, $config) !== null,
    'A session issued after rotation must remain valid.'
);

$staleUpdateRejected = false;
try {
    LCafe\Admin\apply_admin_password_rotation($database, $observedUser, password_hash('Another-password-45', PASSWORD_DEFAULT));
} catch (RuntimeException) {
    $staleUpdateRejected = true;
}
assert_admin_security($staleUpdateRejected, 'A stale concurrent rotation must fail closed.');
assert_admin_security(
    password_verify('New-password-phrase-83', (string) $database->user['password_hash']),
    'A stale rotation must not overwrite the current password.'
);

$loginDatabase = new AdminSecurityTestPdo([
    'id' => 7,
    'username' => 'owner',
    'password_hash' => password_hash('Current-owner-password-29', PASSWORD_DEFAULT),
    'role' => 'owner',
    'is_active' => 1,
    'failed_login_count' => 0,
    'locked_until' => null,
    'last_login_at' => null,
    'session_epoch' => '3',
]);
$_SESSION = [];
$payload = LCafe\Admin\login($loginDatabase, $config, [
    'username' => 'owner',
    'password' => 'Current-owner-password-29',
]);
assert_admin_security($payload['authenticated'] === true, 'A normal login must still succeed.');
assert_admin_security($payload['user']['role'] === 'owner', 'A normal login must preserve the owner role.');
assert_admin_security(!array_key_exists('sessionEpoch', $payload), 'The API payload must not expose the epoch.');
assert_admin_security(!array_key_exists('session_epoch', $payload['user']), 'The user payload must not expose the epoch.');
assert_admin_security($_SESSION['session_epoch'] === '3', 'Login must bind the session to the current epoch.');

$raceHash = password_hash('Concurrent-rotated-password-61', PASSWORD_DEFAULT);
$raceDatabase = new AdminSecurityTestPdo([
    'id' => 9,
    'username' => 'cashier',
    'password_hash' => password_hash('Pre-rotation-password-14', PASSWORD_BCRYPT, ['cost' => 4]),
    'role' => 'cashier',
    'is_active' => 1,
    'failed_login_count' => 0,
    'locked_until' => null,
    'last_login_at' => null,
    'session_epoch' => '11',
]);
$raceDatabase->rotateBeforeLoginUpdate = true;
$raceDatabase->concurrentPasswordHash = $raceHash;
$_SESSION = [];
$raceRejected = false;
try {
    LCafe\Admin\login($raceDatabase, $config, [
        'username' => 'cashier',
        'password' => 'Pre-rotation-password-14',
    ]);
} catch (LCafe\Admin\ApiException $exception) {
    $raceRejected = $exception->status === 401;
}
assert_admin_security($raceRejected, 'An old-password login racing rotation must fail closed.');
assert_admin_security(
    hash_equals($raceHash, (string) $raceDatabase->user['password_hash']),
    'A racing login must not overwrite the rotated password hash.'
);
assert_admin_security($raceDatabase->user['session_epoch'] === '12', 'A racing login must not revert the epoch.');

fwrite(STDOUT, "admin security tests: ok\n");
