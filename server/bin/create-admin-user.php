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

foreach (['Http.php', 'Bootstrap.php', 'Provisioning.php'] as $source) {
    require $appDirectory . DIRECTORY_SEPARATOR . $source;
}

function usage(): never
{
    fwrite(STDERR, <<<TEXT
Usage:
  php create-admin-user.php \
    --config=/absolute/private-root/config.php \
    --username=account-name \
    --role=owner|cashier

The password is requested twice through hidden interactive prompts. Passwords
and database credentials are never accepted as command-line options.
TEXT);
    exit(64);
}

$allowedOptions = ['config', 'username', 'role'];
foreach (array_slice($argv, 1) as $argument) {
    if (!is_string($argument) || preg_match('/^--([a-z-]+)=(.+)$/s', $argument, $matches) !== 1) {
        usage();
    }
    if (!in_array($matches[1], $allowedOptions, true)) {
        usage();
    }
}
$options = getopt('', ['config:', 'username:', 'role:']);
if (!is_array($options)) {
    usage();
}
foreach ($allowedOptions as $name) {
    if (!isset($options[$name]) || !is_string($options[$name]) || $options[$name] === '') {
        usage();
    }
}

try {
    $configPath = realpath($options['config']);
    if ($configPath === false || !is_file($configPath) || !is_readable($configPath)) {
        throw new RuntimeException('The private configuration is unavailable.');
    }
    putenv('LCAFE_PRIVATE_CONFIG=' . $configPath);
    $config = LCafe\Admin\load_private_config();
    $pdo = LCafe\Admin\connect_database($config);
    LCafe\Admin\create_admin_user($pdo, $options['username'], $options['role']);
    fwrite(STDOUT, sprintf("Created active %s account %s.\n", $options['role'], $options['username']));
    exit(0);
} catch (Throwable $exception) {
    fwrite(STDERR, 'Account creation stopped: ' . $exception->getMessage() . "\n");
    exit(1);
}
