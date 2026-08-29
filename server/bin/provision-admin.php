<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$releaseRoot = dirname(__DIR__);
$appDirectory = is_file($releaseRoot . DIRECTORY_SEPARATOR . 'Http.php')
    ? $releaseRoot
    : $releaseRoot . DIRECTORY_SEPARATOR . 'app';
$migrationDirectory = $releaseRoot . DIRECTORY_SEPARATOR . 'migrations';
$configTemplatePath = $releaseRoot . DIRECTORY_SEPARATOR . 'config.example.php';

foreach (['Http.php', 'Bootstrap.php', 'Provisioning.php'] as $source) {
    require $appDirectory . DIRECTORY_SEPARATOR . $source;
}

function usage(): never
{
    fwrite(STDERR, <<<TEXT
Usage:
  php provision-admin.php \\
    --config=/absolute/private-root/config.php \\
    --private-root=/absolute/private-root \\
    --document-root=/absolute/public-document-root \\
    --origin=https://l-cafe.ir

This interactive command creates the external config and persistent directory
structure, applies release-owned migrations to an empty database, and creates
the initial admin account. Database and admin passwords are hidden prompts;
password or credential command-line options are intentionally unsupported.
TEXT);
    exit(64);
}

$allowedOptions = ['config', 'private-root', 'document-root', 'origin'];
foreach (array_slice($argv, 1) as $argument) {
    if (!is_string($argument) || preg_match('/^--([a-z-]+)=(.+)$/s', $argument, $matches) !== 1) {
        usage();
    }
    if (!in_array($matches[1], $allowedOptions, true)) {
        usage();
    }
}
$options = getopt('', ['config:', 'private-root:', 'document-root:', 'origin:']);
if (!is_array($options)) {
    usage();
}
foreach ($allowedOptions as $name) {
    if (!isset($options[$name]) || !is_string($options[$name]) || $options[$name] === '') {
        usage();
    }
}

try {
    $result = LCafe\Admin\provision_admin_system(
        $options['config'],
        $options['private-root'],
        $options['document-root'],
        $options['origin'],
        $migrationDirectory,
        $configTemplatePath
    );

    fwrite(STDOUT, "Provisioning completed.\n");
    fwrite(STDOUT, $result['configCreated']
        ? "Created the external private config with owner-only permissions.\n"
        : "Reused the existing external private config without modifying it.\n");
    fwrite(STDOUT, "Persistent private and public directories are ready.\n");
    fwrite(
        STDOUT,
        sprintf(
            "Database migrations: %d applied, %d already present.\n",
            count($result['migrationsApplied']),
            count($result['migrationsSkipped'])
        )
    );
    fwrite(STDOUT, $result['adminCreated']
        ? "Created the initial active admin account.\n"
        : "An active admin account already exists; accounts were not modified.\n");
    fwrite(STDOUT, "Next: set the web runtime LCAFE_PRIVATE_CONFIG path, then create menu content in the admin.\n");
    exit(0);
} catch (Throwable $exception) {
    fwrite(STDERR, 'Provisioning stopped: ' . $exception->getMessage() . "\n");
    exit(1);
}
