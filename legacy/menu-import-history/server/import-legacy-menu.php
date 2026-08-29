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

foreach ([
    'Http.php',
    'Bootstrap.php',
    'SnapshotPublisher.php',
    'MenuRepository.php',
    'MediaService.php',
    'LegacyMenuMigration.php',
] as $source) {
    require $appDirectory . DIRECTORY_SEPARATOR . $source;
}

function usage(): never
{
    fwrite(STDERR, <<<TEXT
Usage:
  php import-legacy-menu.php --config=/absolute/private-config.php \\
    --menu=/absolute/menu.json --images=/absolute/image-directory \\
    --confirm-empty-import

The command refuses any database that already contains a menu revision,
category, or item. It imports managed media, saves revision 1, and atomically
publishes managed-menu/current.json through the normal backend publisher.
TEXT);
    exit(64);
}

$options = getopt('', ['config:', 'menu:', 'images:', 'confirm-empty-import']);
if (
    !is_array($options)
    || !isset($options['config'], $options['menu'], $options['images'])
    || !array_key_exists('confirm-empty-import', $options)
    || !is_string($options['config'])
    || !is_string($options['menu'])
    || !is_string($options['images'])
) {
    usage();
}

try {
    putenv('LCAFE_PRIVATE_CONFIG=' . $options['config']);
    $config = LCafe\Admin\load_private_config();
    $pdo = LCafe\Admin\connect_database($config);
    $result = LCafe\Admin\migrate_legacy_menu(
        $pdo,
        $config,
        $options['menu'],
        $options['images']
    );
    fwrite(
        STDOUT,
        sprintf(
            "Imported revision %d: %d categories, %d items, %d managed images.\n",
            $result['revision'],
            $result['categoryCount'],
            $result['itemCount'],
            $result['mediaCount']
        )
    );
    fwrite(
        STDOUT,
        $result['published']
            ? "Published managed-menu/current.json atomically.\n"
            : "Database import completed, but snapshot publication is pending; use the admin retry action.\n"
    );
    exit($result['published'] ? 0 : 2);
} catch (Throwable $exception) {
    fwrite(STDERR, 'Migration stopped: ' . $exception->getMessage() . "\n");
    exit(1);
}
