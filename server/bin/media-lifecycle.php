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

foreach (['Http.php', 'Bootstrap.php', 'MediaLifecycle.php'] as $source) {
    require $appDirectory . DIRECTORY_SEPARATOR . $source;
}

function media_lifecycle_usage(): never
{
    fwrite(STDERR, <<<TEXT
Usage:
  php media-lifecycle.php --config=/absolute/private-root/config.php [--dry-run] [--json]
  php media-lifecycle.php --config=/absolute/private-root/config.php --apply [--json]

Dry-run is the default. --apply may only set or clear orphan_candidate_at.
This foundation cannot delete media, originals, renditions, revision archives,
or database ownership rows.
TEXT);
    exit(64);
}

/** @return array{config:string,dryRun:bool,json:bool,apply:bool} */
function media_lifecycle_options(array $arguments): array
{
    $config = null;
    $dryRunRequested = false;
    $json = false;
    $apply = false;
    foreach (array_slice($arguments, 1) as $argument) {
        if (!is_string($argument)) {
            media_lifecycle_usage();
        }
        if (str_starts_with($argument, '--config=')) {
            $value = substr($argument, strlen('--config='));
            if ($value === '' || $config !== null) {
                media_lifecycle_usage();
            }
            $config = $value;
        } elseif ($argument === '--dry-run') {
            $dryRunRequested = true;
        } elseif ($argument === '--json') {
            $json = true;
        } elseif ($argument === '--apply') {
            $apply = true;
        } else {
            media_lifecycle_usage();
        }
    }
    if ($config === null || ($apply && $dryRunRequested)) {
        media_lifecycle_usage();
    }
    return [
        'config' => $config,
        'dryRun' => !$apply,
        'json' => $json,
        'apply' => $apply,
    ];
}

function media_lifecycle_bytes(int $bytes): string
{
    $units = ['B', 'KiB', 'MiB', 'GiB'];
    $value = (float) max(0, $bytes);
    $unit = 0;
    while ($value >= 1024 && $unit < count($units) - 1) {
        $value /= 1024;
        $unit++;
    }
    return $unit === 0
        ? sprintf('%d %s', (int) $value, $units[$unit])
        : sprintf('%.2f %s', $value, $units[$unit]);
}

/** @param array<string, mixed> $result */
function media_lifecycle_human_report(array $result): string
{
    $plan = $result['plan'];
    $bookkeeping = $result['bookkeeping'];
    $summary = $plan['summary'];
    $policy = $plan['policy'];
    $lines = [
        'L Cafe managed-media lifecycle',
        'Mode: ' . $result['mode'],
        'Plan SHA-256: ' . $plan['planSha256'],
        'Safe for bookkeeping apply: ' . ($plan['safeForBookkeepingApply'] ? 'yes' : 'no'),
        'Destructive behavior: disabled',
        '',
        'Policy:',
        '  Effective revision archive retention: all',
        '  Backup horizon days: ' . ($policy['backupHorizonDays'] ?? 'owner confirmation required'),
        '  Revision retention days: ' . ($policy['revisionRetentionDays'] ?? 'owner confirmation required'),
        '  Published revision floor: ' . ($policy['publishedRevisionFloor'] ?? 'owner confirmation required'),
        '  Non-authoritative recommendation: 180 days / 50 published revisions',
        '',
        'Reference sources:',
        '  Active menu rows: ' . $plan['referenceSources']['database']['activeMenuReferenceRows'],
        '  Archived menu rows: ' . $plan['referenceSources']['database']['archivedMenuReferenceRows'],
    ];
    foreach ($plan['referenceSources']['snapshots'] as $source) {
        $lines[] = sprintf(
            '  %s: %s, %d asset references',
            $source['source'],
            $source['status'],
            $source['referenceCount']
        );
    }
    $lines[] = '';
    $lines[] = 'Retained revisions: ' . count($plan['retainedRevisions']);
    foreach ($plan['retainedRevisions'] as $revision) {
        $lines[] = sprintf(
            '  %d: %s; archive=%s; reasons=%s',
            $revision['revision'],
            $revision['publishState'],
            $revision['archivePresent'] ? 'present' : 'missing',
            implode(',', $revision['protectionReasons'])
        );
    }
    $lines[] = '';
    $lines[] = 'Lifecycle classification:';
    foreach ($summary['classificationCounts'] as $classification => $count) {
        $bytes = (int) ($summary['observedBytesByClassification'][$classification] ?? 0);
        $lines[] = sprintf('  %s: %d assets; %s', $classification, $count, media_lifecycle_bytes($bytes));
    }
    $lines[] = '  Total observed bytes: ' . media_lifecycle_bytes((int) $summary['observedTotalBytes']);
    $lines[] = '  Orphan candidates: ' . $summary['orphanCandidateCount'];
    $lines[] = '';
    $lines[] = 'Proposed bookkeeping actions:';
    if ($plan['proposedBookkeepingActions'] === []) {
        $lines[] = '  none';
    } else {
        foreach ($plan['proposedBookkeepingActions'] as $action) {
            $lines[] = '  ' . $action['assetId'] . ': ' . $action['action'];
        }
    }
    $lines[] = '';
    $lines[] = 'Uncertainties: ' . $summary['uncertaintyCount'];
    foreach ($plan['uncertainties'] as $uncertainty) {
        $assets = $uncertainty['assetIds'] === []
            ? ''
            : ' [' . implode(',', $uncertainty['assetIds']) . ']';
        $lines[] = '  ' . $uncertainty['scope'] . ': ' . $uncertainty['message'] . $assets;
    }
    if ($bookkeeping !== null) {
        $lines[] = '';
        $lines[] = 'Bookkeeping apply:';
        $lines[] = '  Completed: ' . ($bookkeeping['completed'] ? 'yes' : 'no');
        $lines[] = '  Marked: ' . $bookkeeping['marked'];
        $lines[] = '  Cleared: ' . $bookkeeping['cleared'];
        if ($bookkeeping['reason'] !== null) {
            $lines[] = '  Reason: ' . $bookkeeping['reason'];
        }
    }
    $lines[] = '';
    $lines[] = 'Future destructive actions: archive pruning disabled; media deletion disabled; ownership-row deletion disabled.';
    return implode("\n", $lines) . "\n";
}

$options = media_lifecycle_options($argv);

try {
    $configPath = realpath($options['config']);
    if ($configPath === false || !is_file($configPath) || !is_readable($configPath)) {
        throw new RuntimeException('The private configuration is unavailable.');
    }
    putenv('LCAFE_PRIVATE_CONFIG=' . $configPath);
    $config = LCafe\Admin\load_private_config();
    $pdo = LCafe\Admin\connect_database($config);
    $result = LCafe\Admin\with_media_lifecycle_lock(
        $pdo,
        static function () use ($pdo, $config, $options): array {
            $plan = LCafe\Admin\build_media_lifecycle_plan($pdo, $config);
            $bookkeeping = $options['apply']
                ? LCafe\Admin\apply_media_lifecycle_bookkeeping($pdo, $plan)
                : null;
            return [
                'mode' => $options['apply'] ? 'bookkeeping-apply' : 'dry-run',
                'plan' => $plan,
                'bookkeeping' => $bookkeeping,
            ];
        }
    );

    if ($options['json']) {
        fwrite(
            STDOUT,
            json_encode(
                $result,
                JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR
            ) . "\n"
        );
    } else {
        fwrite(STDOUT, media_lifecycle_human_report($result));
    }
    $completed = $result['bookkeeping'] === null || $result['bookkeeping']['completed'];
    exit($result['plan']['safeForBookkeepingApply'] && $completed ? 0 : 2);
} catch (Throwable $exception) {
    if ($options['json']) {
        fwrite(
            STDERR,
            json_encode(
                ['error' => 'media_lifecycle_stopped', 'message' => $exception->getMessage()],
                JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
            ) . "\n"
        );
    } else {
        fwrite(STDERR, 'Media lifecycle stopped: ' . $exception->getMessage() . "\n");
    }
    exit(1);
}
