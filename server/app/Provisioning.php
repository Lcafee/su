<?php

declare(strict_types=1);

namespace LCafe\Admin;

use PDO;
use RuntimeException;

/** @return array{configCreated:bool,migrationsApplied:list<string>,migrationsSkipped:list<string>,adminCreated:bool} */
function provision_admin_system(
    string $configPath,
    string $privateRoot,
    string $documentRoot,
    string $allowedOrigin,
    string $migrationDirectory,
    string $configTemplatePath
): array {
    require_interactive_terminal();

    $privateRoot = ensure_directory($privateRoot, 0700, 'Private persistent root');
    $documentRoot = resolve_existing_directory($documentRoot, 'Public document root');
    assert_separate_roots($privateRoot, $documentRoot);
    assert_runtime_outside_code_bundle($privateRoot, $migrationDirectory);
    $allowedOrigin = normalized_https_origin($allowedOrigin);
    $configPath = normalized_absolute_path($configPath, 'Private configuration path');
    if (!path_is_within($privateRoot, $configPath)) {
        throw new RuntimeException('The private configuration must be inside the private persistent root.');
    }
    if (path_is_within($documentRoot, $configPath)) {
        throw new RuntimeException('The private configuration must be outside the public document root.');
    }

    $configParent = ensure_directory(dirname($configPath), 0700, 'Private configuration directory');
    if (!path_is_within($privateRoot, $configParent)) {
        throw new RuntimeException('The private configuration directory escaped the private persistent root.');
    }

    $expectedPaths = expected_persistent_paths($privateRoot, $documentRoot);
    $configCreated = false;
    if (!is_file($configPath)) {
        $config = prompt_private_config($expectedPaths, $allowedOrigin, $configTemplatePath);
        write_new_private_config($configPath, $config);
        $configCreated = true;
    }
    $configPermissions = fileperms($configPath);
    if ($configPermissions === false || ($configPermissions & 0077) !== 0) {
        throw new RuntimeException('The private configuration must be owner-only (mode 0600).');
    }

    $_SERVER['DOCUMENT_ROOT'] = $documentRoot;
    putenv('LCAFE_PRIVATE_CONFIG=' . $configPath);
    $config = load_private_config();
    assert_provisioning_config($config, $expectedPaths, $allowedOrigin);
    ensure_runtime_directories($expectedPaths);

    $pdo = connect_database($config);
    $migrationResult = apply_database_migrations($pdo, $migrationDirectory);
    $adminCreated = ensure_initial_admin_user($pdo);

    return [
        'configCreated' => $configCreated,
        'migrationsApplied' => $migrationResult['applied'],
        'migrationsSkipped' => $migrationResult['skipped'],
        'adminCreated' => $adminCreated,
    ];
}

function require_interactive_terminal(): void
{
    if (!function_exists('stream_isatty') || !stream_isatty(STDIN)) {
        throw new RuntimeException(
            'Provisioning requires an interactive terminal; piped input is refused so passwords cannot leak.'
        );
    }
}

function normalized_absolute_path(string $path, string $label): string
{
    $path = trim(str_replace('\\', '/', $path));
    if ($path === '' || !str_starts_with($path, '/') || str_contains($path, "\0")) {
        throw new RuntimeException("$label must be an absolute POSIX path.");
    }
    $parts = [];
    foreach (explode('/', $path) as $part) {
        if ($part === '' || $part === '.') {
            continue;
        }
        if ($part === '..') {
            if ($parts === []) {
                throw new RuntimeException("$label is invalid.");
            }
            array_pop($parts);
            continue;
        }
        $parts[] = $part;
    }
    $normalized = '/' . implode('/', $parts);
    if ($normalized === '/') {
        throw new RuntimeException("$label cannot be the filesystem root.");
    }
    return $normalized;
}

function path_is_within(string $parent, string $child): bool
{
    $parent = rtrim(str_replace('\\', '/', $parent), '/');
    $child = rtrim(str_replace('\\', '/', $child), '/');
    return $child === $parent || str_starts_with($child, $parent . '/');
}

function resolve_existing_directory(string $path, string $label): string
{
    $path = normalized_absolute_path($path, $label);
    $resolved = realpath($path);
    if ($resolved === false || !is_dir($resolved) || !is_writable($resolved)) {
        throw new RuntimeException("$label must already exist and be writable.");
    }
    return rtrim(str_replace('\\', '/', $resolved), '/');
}

function ensure_directory(string $path, int $mode, string $label): string
{
    $path = normalized_absolute_path($path, $label);
    if (!file_exists($path)) {
        $priorUmask = umask(0777 & ~$mode);
        try {
            if (!mkdir($path, $mode, true) && !is_dir($path)) {
                throw new RuntimeException("Could not create $label.");
            }
        } finally {
            umask($priorUmask);
        }
    }
    $resolved = realpath($path);
    if ($resolved === false || !is_dir($resolved) || is_link($path) || !is_writable($resolved)) {
        throw new RuntimeException("$label is unavailable, linked, or not writable.");
    }
    $permissions = fileperms($resolved);
    $unsafeMask = $mode === 0700 ? 0077 : 0022;
    if ($permissions === false || ($permissions & $unsafeMask) !== 0) {
        $expectedMode = $mode === 0700 ? '0700' : 'not group/other writable';
        throw new RuntimeException("$label permissions are unsafe; expected $expectedMode.");
    }
    return rtrim(str_replace('\\', '/', $resolved), '/');
}

function assert_separate_roots(string $privateRoot, string $documentRoot): void
{
    if (path_is_within($documentRoot, $privateRoot) || path_is_within($privateRoot, $documentRoot)) {
        throw new RuntimeException('The private persistent root and public document root must be separate.');
    }
}

function assert_runtime_outside_code_bundle(string $privateRoot, string $migrationDirectory): void
{
    $migrationRoot = realpath(dirname($migrationDirectory));
    if ($migrationRoot === false || !is_dir($migrationRoot)) {
        throw new RuntimeException('The release code bundle is unavailable.');
    }
    $migrationRoot = rtrim(str_replace('\\', '/', $migrationRoot), '/');
    if (path_is_within($migrationRoot, $privateRoot) || path_is_within($privateRoot, $migrationRoot)) {
        throw new RuntimeException('The private persistent root must be outside the release/activation code bundle.');
    }
}

function normalized_https_origin(string $origin): string
{
    $origin = rtrim(trim($origin), '/');
    if ($origin === '' || preg_match('/[\x00-\x20\x7F]/', $origin) === 1) {
        throw new RuntimeException('The allowed origin contains invalid characters.');
    }
    $parts = parse_url($origin);
    if (
        !is_array($parts)
        || strtolower((string) ($parts['scheme'] ?? '')) !== 'https'
        || !isset($parts['host'])
        || (isset($parts['path']) && $parts['path'] !== '')
        || isset($parts['query'])
        || isset($parts['fragment'])
        || isset($parts['user'])
        || isset($parts['pass'])
    ) {
        throw new RuntimeException('The allowed origin must be an HTTPS origin without a path.');
    }
    $normalized = 'https://' . strtolower((string) $parts['host']);
    if (isset($parts['port'])) {
        $port = (int) $parts['port'];
        if ($port < 1 || $port > 65535) {
            throw new RuntimeException('The allowed origin port is invalid.');
        }
        $normalized .= ':' . $port;
    }
    return $normalized;
}

/** @return array<string, string> */
function expected_persistent_paths(string $privateRoot, string $documentRoot): array
{
    return [
        'session_dir' => $privateRoot . '/sessions',
        'snapshot_archive_dir' => $privateRoot . '/menu-revisions',
        'media_original_dir' => $privateRoot . '/media-originals',
        'snapshot_public_dir' => $documentRoot . '/managed-menu',
        'media_public_dir' => $documentRoot . '/managed-media',
    ];
}

function prompt_line(string $label): string
{
    fwrite(STDERR, $label);
    $line = fgets(STDIN);
    if ($line === false) {
        throw new RuntimeException('Interactive input ended unexpectedly.');
    }
    return trim($line);
}

function prompt_hidden(string $label): string
{
    if (!function_exists('exec')) {
        throw new RuntimeException('The host must provide the POSIX stty command and PHP exec() for hidden input.');
    }
    $stateLines = [];
    $stateStatus = 1;
    exec('stty -g 2>/dev/null', $stateLines, $stateStatus);
    $state = trim(implode('', $stateLines));
    if ($stateStatus !== 0 || preg_match('/^[A-Za-z0-9:;=+,-]+$/', $state) !== 1) {
        throw new RuntimeException('The terminal state could not be read safely; hidden input is unavailable.');
    }

    fwrite(STDERR, $label);
    $echoStatus = 1;
    exec('stty -echo 2>/dev/null', $unused, $echoStatus);
    if ($echoStatus !== 0) {
        throw new RuntimeException('Terminal echo could not be disabled safely.');
    }
    try {
        $line = fgets(STDIN);
        if ($line === false) {
            throw new RuntimeException('Interactive input ended unexpectedly.');
        }
        return rtrim($line, "\r\n");
    } finally {
        $restoreStatus = 1;
        exec('stty ' . $state . ' 2>/dev/null', $unused, $restoreStatus);
        fwrite(STDERR, "\n");
        if ($restoreStatus !== 0) {
            throw new RuntimeException('Terminal echo could not be restored; reset the terminal before continuing.');
        }
    }
}

/** @return array<string, mixed> */
function load_private_config_template(string $templatePath): array
{
    $resolved = realpath($templatePath);
    if ($resolved === false || !is_file($resolved) || !is_readable($resolved)) {
        throw new RuntimeException('The release private-config template is unavailable.');
    }
    $template = require $resolved;
    if (!is_array($template)) {
        throw new RuntimeException('The release private-config template is invalid.');
    }
    return $template;
}

/** @param array<string, string> $paths @return array<string, mixed> */
function prompt_private_config(array $paths, string $allowedOrigin, string $templatePath): array
{
    $config = load_private_config_template($templatePath);
    $host = prompt_line('MySQL host: ');
    if ($host === '' || strlen($host) > 255 || preg_match('/[;\x00-\x1F\x7F]/', $host) === 1) {
        throw new RuntimeException('The MySQL host is invalid.');
    }
    $portText = prompt_line('MySQL port [3306]: ');
    $port = $portText === '' ? 3306 : filter_var($portText, FILTER_VALIDATE_INT);
    if (!is_int($port) || $port < 1 || $port > 65535) {
        throw new RuntimeException('The MySQL port is invalid.');
    }
    $database = prompt_line('Empty MySQL database name: ');
    if (preg_match('/^[A-Za-z0-9_$-]{1,64}$/', $database) !== 1) {
        throw new RuntimeException('The MySQL database name is invalid.');
    }
    $databaseUser = prompt_hidden('MySQL username (hidden): ');
    if ($databaseUser === '' || strlen($databaseUser) > 191 || preg_match('/[\x00-\x1F\x7F]/', $databaseUser) === 1) {
        throw new RuntimeException('The MySQL username is invalid.');
    }
    $databasePassword = prompt_hidden('MySQL password (hidden): ');
    if ($databasePassword === '' || strlen($databasePassword) > 4096 || str_contains($databasePassword, "\0")) {
        throw new RuntimeException('The MySQL password is invalid.');
    }

    $config['database'] = [
        'dsn' => "mysql:host=$host;port=$port;dbname=$database;charset=utf8mb4",
        'username' => $databaseUser,
        'password' => $databasePassword,
    ];
    $config['paths'] = $paths;
    $config['urls']['media'] = '/managed-media';
    $config['security']['allowed_origin'] = $allowedOrigin;
    return $config;
}

/** @param array<string, mixed> $config */
function write_new_private_config(string $path, array $config): void
{
    if (file_exists($path)) {
        throw new RuntimeException('The private configuration already exists and will not be overwritten.');
    }
    $bytes = "<?php\n\ndeclare(strict_types=1);\n\nreturn " . var_export($config, true) . ";\n";
    $temp = dirname($path) . '/.lcafe-config-' . bin2hex(random_bytes(8));
    $priorUmask = umask(0077);
    try {
        $handle = fopen($temp, 'x+b');
    } finally {
        umask($priorUmask);
    }
    if ($handle === false) {
        throw new RuntimeException('Could not reserve a private configuration file.');
    }
    try {
        try {
            if (!chmod($temp, 0600)) {
                throw new RuntimeException('Could not protect the private configuration file.');
            }
            $offset = 0;
            while ($offset < strlen($bytes)) {
                $written = fwrite($handle, substr($bytes, $offset));
                if ($written === false || $written === 0) {
                    throw new RuntimeException('Could not finish the private configuration file.');
                }
                $offset += $written;
            }
            if (!fflush($handle) || (function_exists('fsync') && !fsync($handle))) {
                throw new RuntimeException('Could not synchronize the private configuration file.');
            }
        } finally {
            fclose($handle);
        }
        if (!link($temp, $path)) {
            throw new RuntimeException('Could not install the private configuration without overwriting a file.');
        }
    } finally {
        if (is_file($temp)) {
            unlink($temp);
        }
    }
}

/** @param array<string, mixed> $config @param array<string, string> $expectedPaths */
function assert_provisioning_config(array $config, array $expectedPaths, string $allowedOrigin): void
{
    foreach ($expectedPaths as $key => $expected) {
        $actual = str_replace('\\', '/', (string) ($config['paths'][$key] ?? ''));
        if (rtrim($actual, '/') !== $expected) {
            throw new RuntimeException("The existing private config has an unexpected paths.$key value.");
        }
    }
    if ((string) ($config['urls']['media'] ?? '') !== '/managed-media') {
        throw new RuntimeException('The existing private config must use /managed-media URLs.');
    }
    if ((string) ($config['security']['allowed_origin'] ?? '') !== $allowedOrigin) {
        throw new RuntimeException('The existing private config has a different allowed origin.');
    }
}

/** @param array<string, string> $paths */
function ensure_runtime_directories(array $paths): void
{
    foreach (['session_dir', 'snapshot_archive_dir', 'media_original_dir'] as $key) {
        ensure_directory($paths[$key], 0700, $key);
    }
    foreach (['snapshot_public_dir', 'media_public_dir'] as $key) {
        ensure_directory($paths[$key], 0755, $key);
    }
}

function schema_migrations_exists(PDO $pdo): bool
{
    $statement = $pdo->query(
        "SELECT COUNT(*) FROM information_schema.tables "
        . "WHERE table_schema = DATABASE() AND table_name = 'schema_migrations'"
    );
    return (int) $statement->fetchColumn() === 1;
}

function assert_empty_database_before_first_migration(PDO $pdo): void
{
    if (schema_migrations_exists($pdo)) {
        return;
    }
    $statement = $pdo->query(
        'SELECT COUNT(*) FROM information_schema.tables '
        . "WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'"
    );
    if ((int) $statement->fetchColumn() !== 0) {
        throw new RuntimeException(
            'The selected database is not empty and has no L Cafe migration history; provisioning refused it.'
        );
    }
}

/** @return list<string> */
function migration_statements(string $sql): array
{
    $lines = preg_split('/\R/', $sql);
    if (!is_array($lines)) {
        throw new RuntimeException('A database migration could not be read.');
    }
    $filtered = array_filter(
        $lines,
        static fn(string $line): bool => preg_match('/^\s*--/', $line) !== 1
    );
    $statements = preg_split('/;\s*(?:\R|$)/', implode("\n", $filtered));
    if (!is_array($statements)) {
        throw new RuntimeException('A database migration could not be parsed.');
    }
    return array_values(array_filter(
        array_map('trim', $statements),
        static fn(string $statement): bool => $statement !== ''
    ));
}

function migration_is_applied(PDO $pdo, string $version): bool
{
    if (!schema_migrations_exists($pdo)) {
        return false;
    }
    $statement = $pdo->prepare('SELECT 1 FROM schema_migrations WHERE version = ? LIMIT 1');
    $statement->execute([$version]);
    return $statement->fetchColumn() !== false;
}

/** @return array{applied:list<string>,skipped:list<string>} */
function apply_database_migrations(PDO $pdo, string $migrationDirectory): array
{
    $resolved = realpath($migrationDirectory);
    if ($resolved === false || !is_dir($resolved) || !is_readable($resolved)) {
        throw new RuntimeException('The release migration directory is unavailable.');
    }
    $files = glob($resolved . DIRECTORY_SEPARATOR . '*.sql');
    if (!is_array($files) || $files === []) {
        throw new RuntimeException('The release contains no database migrations.');
    }
    sort($files, SORT_STRING);
    assert_empty_database_before_first_migration($pdo);

    $applied = [];
    $skipped = [];
    foreach ($files as $file) {
        $filename = basename($file);
        if (preg_match('/^(\d{3}_[a-z0-9_]+)\.sql$/', $filename, $matches) !== 1) {
            throw new RuntimeException("Unexpected database migration filename: $filename");
        }
        $version = $matches[1];
        if (migration_is_applied($pdo, $version)) {
            $skipped[] = $version;
            continue;
        }
        $sql = file_get_contents($file);
        if (!is_string($sql) || $sql === '') {
            throw new RuntimeException("Database migration $version is empty or unreadable.");
        }
        foreach (migration_statements($sql) as $statement) {
            $pdo->exec($statement);
        }
        if (!migration_is_applied($pdo, $version)) {
            throw new RuntimeException("Database migration $version did not record its completion.");
        }
        $applied[] = $version;
    }
    return ['applied' => $applied, 'skipped' => $skipped];
}

function ensure_initial_admin_user(PDO $pdo): bool
{
    $total = (int) $pdo->query('SELECT COUNT(*) FROM admin_users')->fetchColumn();
    if ($total > 0) {
        $active = (int) $pdo->query('SELECT COUNT(*) FROM admin_users WHERE is_active = 1')->fetchColumn();
        if ($active === 0) {
            throw new RuntimeException('Admin users exist, but none is active; provisioning will not modify existing accounts.');
        }
        return false;
    }

    $username = prompt_line('Initial admin username: ');
    if (preg_match('/^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/', $username) !== 1) {
        throw new RuntimeException(
            'The admin username must be 3-64 ASCII letters, numbers, dots, underscores, or hyphens.'
        );
    }
    $password = prompt_hidden('Initial admin password (hidden, at least 12 characters): ');
    if (strlen($password) < 12 || strlen($password) > 4096 || preg_match('/[\x00-\x1F\x7F]/', $password) === 1) {
        throw new RuntimeException('The admin password must contain 12-4096 characters and no control characters.');
    }
    $confirmation = prompt_hidden('Repeat initial admin password: ');
    if (!hash_equals($password, $confirmation)) {
        throw new RuntimeException('The admin passwords did not match.');
    }
    $hash = password_hash($password, PASSWORD_DEFAULT);
    $password = '';
    $confirmation = '';

    $statement = $pdo->prepare(
        'INSERT INTO admin_users (username, password_hash, is_active) VALUES (?, ?, 1)'
    );
    $statement->execute([$username, $hash]);
    return true;
}
