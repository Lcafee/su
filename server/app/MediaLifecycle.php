<?php

declare(strict_types=1);

namespace LCafe\Admin;

use JsonException;
use PDO;
use Throwable;

const MEDIA_LIFECYCLE_LOCK_NAME = 'lcafe:managed-media-lifecycle:v1';
const MEDIA_LIFECYCLE_LOCK_TIMEOUT_SECONDS = 10;

function acquire_media_lifecycle_lock(PDO $pdo): void
{
    try {
        $statement = $pdo->prepare('SELECT GET_LOCK(?, ?)');
        $statement->execute([
            MEDIA_LIFECYCLE_LOCK_NAME,
            MEDIA_LIFECYCLE_LOCK_TIMEOUT_SECONDS,
        ]);
        $acquired = $statement->fetchColumn();
    } catch (Throwable $exception) {
        error_log('L Cafe media lifecycle lock acquisition failed: ' . $exception->getMessage());
        throw new ApiException(
            503,
            'media_lifecycle_unavailable',
            'Managed media maintenance coordination is unavailable.'
        );
    }
    if ((string) $acquired !== '1') {
        throw new ApiException(
            503,
            'media_lifecycle_busy',
            'Managed media is temporarily busy. Retry shortly.'
        );
    }
}

function release_media_lifecycle_lock(PDO $pdo): void
{
    try {
        $statement = $pdo->prepare('SELECT RELEASE_LOCK(?)');
        $statement->execute([MEDIA_LIFECYCLE_LOCK_NAME]);
        if ((string) $statement->fetchColumn() !== '1') {
            error_log('L Cafe media lifecycle lock was not owned when release was requested.');
        }
    } catch (Throwable $exception) {
        // The operation has already reached its mutation boundary. Do not mask
        // its result; this non-persistent connection releases the lock on close.
        error_log('L Cafe media lifecycle lock release failed: ' . $exception->getMessage());
    }
}

/** @template T @param callable():T $operation @return T */
function with_media_lifecycle_lock(PDO $pdo, callable $operation): mixed
{
    acquire_media_lifecycle_lock($pdo);
    try {
        return $operation();
    } finally {
        release_media_lifecycle_lock($pdo);
    }
}

/** @param array<string, mixed> $raw */
function lifecycle_optional_nonnegative_int(array $raw, string $key, array &$issues): ?int
{
    if (!array_key_exists($key, $raw) || $raw[$key] === null || $raw[$key] === '') {
        return null;
    }
    $value = filter_var($raw[$key], FILTER_VALIDATE_INT);
    if ($value === false || $value < 0) {
        $issues[] = "media_lifecycle.$key must be null or a non-negative integer.";
        return null;
    }
    return (int) $value;
}

/** @param array<string, mixed> $config @return array{policy:array<string,mixed>,issues:list<string>} */
function media_lifecycle_policy(array $config): array
{
    $raw = isset($config['media_lifecycle']) && is_array($config['media_lifecycle'])
        ? $config['media_lifecycle']
        : [];
    $issues = [];
    $configuredDestructive = (bool) ($raw['destructive_cleanup_enabled'] ?? false);
    if ($configuredDestructive) {
        $issues[] = 'Destructive cleanup was requested in configuration, but this source foundation cannot enable it.';
    }

    return [
        'policy' => [
            'destructiveCleanupEnabled' => false,
            'configuredDestructiveCleanupEnabled' => $configuredDestructive,
            'backupHorizonDays' => lifecycle_optional_nonnegative_int($raw, 'backup_horizon_days', $issues),
            'revisionRetentionDays' => lifecycle_optional_nonnegative_int(
                $raw,
                'revision_retention_days',
                $issues
            ),
            'publishedRevisionFloor' => lifecycle_optional_nonnegative_int(
                $raw,
                'published_revision_floor',
                $issues
            ),
            'effectiveRevisionArchiveRetention' => 'all',
            'futureDeletionEligibility' => 'disabled',
            'ownerConfirmationRequired' => [
                'production backup retention horizon',
                'coordinated database, snapshot, original, and rendition restore contract',
            ],
            'nonAuthoritativeRecommendation' => [
                'revisionRetentionDays' => 180,
                'publishedRevisionFloor' => 50,
            ],
            'lock' => [
                'name' => MEDIA_LIFECYCLE_LOCK_NAME,
                'timeoutSeconds' => MEDIA_LIFECYCLE_LOCK_TIMEOUT_SECONDS,
            ],
        ],
        'issues' => $issues,
    ];
}

/** @param list<array<string, mixed>> $uncertainties @param list<string> $assetIds */
function lifecycle_add_uncertainty(
    array &$uncertainties,
    string $scope,
    string $message,
    array $assetIds = []
): void {
    sort($assetIds, SORT_STRING);
    $uncertainties[] = [
        'scope' => $scope,
        'message' => $message,
        'assetIds' => array_values(array_unique($assetIds)),
    ];
}

/** @param list<array<string, mixed>> $uncertainties */
function lifecycle_readable_directory(string $configured, string $label, array &$uncertainties): ?string
{
    if ($configured === '' || is_link($configured)) {
        lifecycle_add_uncertainty($uncertainties, 'storage', "$label directory is empty or is a symlink.");
        return null;
    }
    $resolved = realpath($configured);
    if ($resolved === false || !is_dir($resolved) || !is_readable($resolved)) {
        lifecycle_add_uncertainty($uncertainties, 'storage', "$label directory is unavailable or unreadable.");
        return null;
    }
    return rtrim($resolved, DIRECTORY_SEPARATOR);
}

function lifecycle_safe_filename(string $filename): bool
{
    return $filename !== ''
        && strlen($filename) <= 191
        && basename($filename) === $filename
        && preg_match('/^[A-Za-z0-9][A-Za-z0-9._-]*$/D', $filename) === 1;
}

/** @param list<array<string, mixed>> $uncertainties */
function lifecycle_inspect_owned_file(
    ?string $directory,
    string $filename,
    string $label,
    string $assetId,
    array &$uncertainties
): ?int {
    if (!lifecycle_safe_filename($filename)) {
        lifecycle_add_uncertainty(
            $uncertainties,
            'ownership',
            "$label filename is unsafe: $filename",
            [$assetId]
        );
        return null;
    }
    if ($directory === null) {
        return null;
    }
    $path = $directory . DIRECTORY_SEPARATOR . $filename;
    if (is_link($path)) {
        lifecycle_add_uncertainty($uncertainties, 'ownership', "$label is a symlink.", [$assetId]);
        return null;
    }
    if (!is_file($path) || !is_readable($path)) {
        lifecycle_add_uncertainty($uncertainties, 'ownership', "$label is missing or unreadable.", [$assetId]);
        return null;
    }
    $bytes = filesize($path);
    if ($bytes === false) {
        lifecycle_add_uncertainty($uncertainties, 'ownership', "$label size is unavailable.", [$assetId]);
        return null;
    }
    return (int) $bytes;
}

/** @param array<string, true> $expected @param list<array<string, mixed>> $uncertainties */
function lifecycle_inventory_directory_entries(
    ?string $directory,
    array $expected,
    string $label,
    array &$uncertainties
): void {
    if ($directory === null) {
        return;
    }
    $entries = scandir($directory);
    if (!is_array($entries)) {
        lifecycle_add_uncertainty($uncertainties, 'storage', "$label directory could not be listed.");
        return;
    }
    foreach ($entries as $entry) {
        if ($entry === '.' || $entry === '..') {
            continue;
        }
        if (!isset($expected[$entry])) {
            lifecycle_add_uncertainty(
                $uncertainties,
                'ownership',
                "$label directory contains an entry without authoritative ownership: $entry"
            );
        }
    }
}

/** @param array<string, array<string, string>> $references */
function lifecycle_add_reference(
    array &$references,
    string $assetId,
    string $source,
    string $reachability
): void {
    $references[$assetId][$source] = $reachability;
}

/**
 * @param array<string, string> $filenameOwners
 * @param array<string, array<string, string>> $references
 * @param list<array<string, mixed>> $uncertainties
 */
function lifecycle_collect_snapshot_references(
    mixed $value,
    string $mediaUrl,
    string $source,
    string $reachability,
    array $filenameOwners,
    array &$references,
    array &$uncertainties
): void {
    if (is_array($value)) {
        foreach ($value as $child) {
            lifecycle_collect_snapshot_references(
                $child,
                $mediaUrl,
                $source,
                $reachability,
                $filenameOwners,
                $references,
                $uncertainties
            );
        }
        return;
    }
    if (!is_string($value)) {
        return;
    }

    $base = rtrim($mediaUrl, '/');
    if ($base === '') {
        lifecycle_add_uncertainty($uncertainties, 'configuration', 'The managed-media URL base is empty.');
        return;
    }
    $pattern = '~' . preg_quote($base . '/', '~') . '([^\s,"\'<>?#)]+)~u';
    $matched = preg_match_all($pattern, $value, $matches);
    if ($matched === false) {
        lifecycle_add_uncertainty($uncertainties, 'snapshot', "Could not scan managed-media references in $source.");
        return;
    }
    foreach ($matches[1] as $encoded) {
        $filename = rawurldecode((string) $encoded);
        if (!lifecycle_safe_filename($filename)) {
            lifecycle_add_uncertainty(
                $uncertainties,
                'snapshot',
                "$source contains an unsafe managed-media reference."
            );
            continue;
        }
        $assetId = $filenameOwners[$filename] ?? null;
        if ($assetId === null) {
            lifecycle_add_uncertainty(
                $uncertainties,
                'snapshot',
                "$source references managed-media filename $filename without authoritative ownership."
            );
            continue;
        }
        lifecycle_add_reference($references, $assetId, $source, $reachability);
    }
}

/**
 * @param array<string, string> $filenameOwners
 * @param array<string, array<string, string>> $references
 * @param list<array<string, mixed>> $uncertainties
 * @return array<string, mixed>
 */
function lifecycle_read_snapshot(
    string $path,
    string $source,
    string $reachability,
    bool $required,
    string $mediaUrl,
    array $filenameOwners,
    array &$references,
    array &$uncertainties,
    ?int $expectedRevision = null,
    ?string $expectedSha = null
): array {
    if (!file_exists($path)) {
        if ($required) {
            lifecycle_add_uncertainty($uncertainties, 'snapshot', "$source is missing.");
        }
        return ['source' => $source, 'status' => 'absent', 'referenceCount' => 0];
    }
    if (is_link($path) || !is_file($path) || !is_readable($path)) {
        lifecycle_add_uncertainty($uncertainties, 'snapshot', "$source is not a readable regular file.");
        return ['source' => $source, 'status' => 'unsafe', 'referenceCount' => 0];
    }
    $bytes = file_get_contents($path);
    if (!is_string($bytes)) {
        lifecycle_add_uncertainty($uncertainties, 'snapshot', "$source could not be read.");
        return ['source' => $source, 'status' => 'unsafe', 'referenceCount' => 0];
    }
    $sha = hash('sha256', $bytes);
    if ($expectedSha !== null && !hash_equals($expectedSha, $sha)) {
        lifecycle_add_uncertainty($uncertainties, 'snapshot', "$source content hash does not match its archive name.");
    }
    try {
        $snapshot = json_decode($bytes, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        lifecycle_add_uncertainty($uncertainties, 'snapshot', "$source contains malformed JSON.");
        return [
            'source' => $source,
            'status' => 'unsafe',
            'sha256' => $sha,
            'bytes' => strlen($bytes),
            'referenceCount' => 0,
        ];
    }
    if (!is_array($snapshot)) {
        lifecycle_add_uncertainty($uncertainties, 'snapshot', "$source root is not a JSON object.");
        return [
            'source' => $source,
            'status' => 'unsafe',
            'sha256' => $sha,
            'bytes' => strlen($bytes),
            'referenceCount' => 0,
        ];
    }
    $revision = isset($snapshot['revision']) && is_int($snapshot['revision'])
        ? $snapshot['revision']
        : null;
    if ($expectedRevision !== null && $revision !== $expectedRevision) {
        lifecycle_add_uncertainty($uncertainties, 'snapshot', "$source revision does not match its archive name.");
    }

    $before = 0;
    foreach ($references as $assetReferences) {
        $before += isset($assetReferences[$source]) ? 1 : 0;
    }
    lifecycle_collect_snapshot_references(
        $snapshot,
        $mediaUrl,
        $source,
        $reachability,
        $filenameOwners,
        $references,
        $uncertainties
    );
    $after = 0;
    foreach ($references as $assetReferences) {
        $after += isset($assetReferences[$source]) ? 1 : 0;
    }
    return [
        'source' => $source,
        'status' => 'read',
        'revision' => $revision,
        'sha256' => $sha,
        'bytes' => strlen($bytes),
        'referenceCount' => $after - $before,
    ];
}

/** @param mixed $value @return mixed */
function lifecycle_canonicalize(mixed $value): mixed
{
    if (!is_array($value)) {
        return $value;
    }
    if (array_is_list($value)) {
        return array_map(__NAMESPACE__ . '\\lifecycle_canonicalize', $value);
    }
    ksort($value, SORT_STRING);
    foreach ($value as $key => $child) {
        $value[$key] = lifecycle_canonicalize($child);
    }
    return $value;
}

/** @param array<string, mixed> $config @return array<string, mixed> */
function build_media_lifecycle_plan(PDO $pdo, array $config): array
{
    $uncertainties = [];
    $policyResult = media_lifecycle_policy($config);
    foreach ($policyResult['issues'] as $issue) {
        lifecycle_add_uncertainty($uncertainties, 'policy', $issue);
    }
    $policy = $policyResult['policy'];

    $state = $pdo->query(
        'SELECT edit_revision, published_revision FROM menu_state WHERE id = 1'
    )->fetch();
    if (!is_array($state)) {
        throw new ApiException(503, 'schema_unavailable', 'The menu database has not been initialized.');
    }
    $editRevision = (int) $state['edit_revision'];
    $publishedRevision = (int) $state['published_revision'];

    $publicMediaDir = lifecycle_readable_directory(
        (string) $config['paths']['media_public_dir'],
        'Managed media',
        $uncertainties
    );
    $originalMediaDir = lifecycle_readable_directory(
        (string) $config['paths']['media_original_dir'],
        'Original media',
        $uncertainties
    );
    $publicSnapshotDir = lifecycle_readable_directory(
        (string) $config['paths']['snapshot_public_dir'],
        'Public snapshot',
        $uncertainties
    );
    $archiveSnapshotDir = lifecycle_readable_directory(
        (string) $config['paths']['snapshot_archive_dir'],
        'Snapshot archive',
        $uncertainties
    );

    $assets = [];
    $filenameOwners = [];
    $allOwnedFilenames = [];
    $expectedPublicMediaFiles = [];
    $expectedOriginalMediaFiles = [];
    $references = [];
    $assetRows = $pdo->query(
        'SELECT id, source_sha256, source_extension, byte_size, original_filename, '
        . 'rendition_300_filename, rendition_600_filename, retired_at, orphan_candidate_at, created_at '
        . 'FROM media_assets ORDER BY id'
    )->fetchAll();
    foreach ($assetRows as $row) {
        $id = (string) $row['id'];
        $sha = strtolower((string) $row['source_sha256']);
        $original = (string) $row['original_filename'];
        $rendition300 = (string) $row['rendition_300_filename'];
        $rendition600 = (string) $row['rendition_600_filename'];
        $expectedOriginal = $sha . '.' . strtolower((string) $row['source_extension']);
        if (preg_match('/^[a-f0-9]{64}$/D', $sha) !== 1) {
            lifecycle_add_uncertainty($uncertainties, 'ownership', 'Asset source hash is invalid.', [$id]);
        }
        if (
            $original !== $expectedOriginal
            || $rendition300 !== $sha . '-300.webp'
            || $rendition600 !== $sha . '-600.webp'
        ) {
            lifecycle_add_uncertainty(
                $uncertainties,
                'ownership',
                'Asset filenames do not match their source hash and rendition contract.',
                [$id]
            );
        }
        foreach ([$original, $rendition300, $rendition600] as $filename) {
            if (isset($allOwnedFilenames[$filename]) && $allOwnedFilenames[$filename] !== $id) {
                lifecycle_add_uncertainty(
                    $uncertainties,
                    'ownership',
                    "Managed filename $filename has conflicting owners.",
                    [$allOwnedFilenames[$filename], $id]
                );
            } else {
                $allOwnedFilenames[$filename] = $id;
            }
        }
        $filenameOwners[$rendition300] = $id;
        $filenameOwners[$rendition600] = $id;
        $expectedPublicMediaFiles[$rendition300] = true;
        $expectedPublicMediaFiles[$rendition600] = true;
        $expectedOriginalMediaFiles[$original] = true;

        $originalBytes = lifecycle_inspect_owned_file(
            $originalMediaDir,
            $original,
            'Private original',
            $id,
            $uncertainties
        );
        $rendition300Bytes = lifecycle_inspect_owned_file(
            $publicMediaDir,
            $rendition300,
            '300px rendition',
            $id,
            $uncertainties
        );
        $rendition600Bytes = lifecycle_inspect_owned_file(
            $publicMediaDir,
            $rendition600,
            '600px rendition',
            $id,
            $uncertainties
        );
        if ($originalBytes !== null && $originalBytes !== (int) $row['byte_size']) {
            lifecycle_add_uncertainty(
                $uncertainties,
                'ownership',
                'Private original size differs from the authoritative database byte size.',
                [$id]
            );
        }
        $assets[$id] = [
            'id' => $id,
            'sourceSha256' => $sha,
            'createdAt' => (string) $row['created_at'],
            'retiredAt' => $row['retired_at'] !== null ? (string) $row['retired_at'] : null,
            'orphanCandidateAt' => $row['orphan_candidate_at'] !== null
                ? (string) $row['orphan_candidate_at']
                : null,
            'filenames' => [
                'original' => $original,
                'rendition300' => $rendition300,
                'rendition600' => $rendition600,
            ],
            'bytes' => [
                'databaseSourceBytes' => (int) $row['byte_size'],
                'originalBytes' => $originalBytes,
                'rendition300Bytes' => $rendition300Bytes,
                'rendition600Bytes' => $rendition600Bytes,
                'observedTotalBytes' => ($originalBytes ?? 0)
                    + ($rendition300Bytes ?? 0)
                    + ($rendition600Bytes ?? 0),
            ],
        ];
        $references[$id] = [];
    }
    lifecycle_inventory_directory_entries(
        $publicMediaDir,
        $expectedPublicMediaFiles,
        'Managed media',
        $uncertainties
    );
    lifecycle_inventory_directory_entries(
        $originalMediaDir,
        $expectedOriginalMediaFiles,
        'Original media',
        $uncertainties
    );

    $menuRows = $pdo->query(
        'SELECT i.media_id, i.archived_at AS item_archived_at, '
        . 'c.archived_at AS category_archived_at FROM menu_items i '
        . 'JOIN menu_categories c ON c.id = i.category_id WHERE i.media_id IS NOT NULL'
    )->fetchAll();
    foreach ($menuRows as $row) {
        $assetId = (string) $row['media_id'];
        if (!isset($assets[$assetId])) {
            lifecycle_add_uncertainty(
                $uncertainties,
                'database',
                'A menu item references media without an authoritative asset row.',
                [$assetId]
            );
            continue;
        }
        $archived = $row['item_archived_at'] !== null || $row['category_archived_at'] !== null;
        lifecycle_add_reference(
            $references,
            $assetId,
            $archived ? 'database.menu_items.archived' : 'database.menu_items.active',
            $archived ? 'retained' : 'active'
        );
    }

    $revisionRows = $pdo->query(
        'SELECT revision, publish_state, snapshot_sha256, created_at, published_at, '
        . 'lifecycle_retained, lifecycle_retain_until, '
        . 'CASE WHEN lifecycle_retained = 1 AND '
        . '(lifecycle_retain_until IS NULL OR lifecycle_retain_until >= UTC_TIMESTAMP(6)) '
        . 'THEN 1 ELSE 0 END AS lifecycle_pin_active '
        . 'FROM menu_revisions ORDER BY revision'
    )->fetchAll();
    $revisions = [];
    foreach ($revisionRows as $row) {
        $revision = (int) $row['revision'];
        $revisions[$revision] = [
            'revision' => $revision,
            'publishState' => (string) $row['publish_state'],
            'snapshotSha256' => $row['snapshot_sha256'] !== null ? (string) $row['snapshot_sha256'] : null,
            'createdAt' => (string) $row['created_at'],
            'publishedAt' => $row['published_at'] !== null ? (string) $row['published_at'] : null,
            'lifecycleRetained' => (bool) $row['lifecycle_retained'],
            'lifecycleRetainUntil' => $row['lifecycle_retain_until'] !== null
                ? (string) $row['lifecycle_retain_until']
                : null,
            'lifecyclePinActive' => (bool) $row['lifecycle_pin_active'],
            'archivePresent' => false,
            'protectionReasons' => [],
        ];
    }

    $snapshotSources = [];
    if ($publicSnapshotDir !== null) {
        lifecycle_inventory_directory_entries(
            $publicSnapshotDir,
            ['current.json' => true, 'previous.json' => true],
            'Public snapshot',
            $uncertainties
        );
        $snapshotSources[] = lifecycle_read_snapshot(
            $publicSnapshotDir . DIRECTORY_SEPARATOR . 'current.json',
            'snapshot.current',
            'active',
            $publishedRevision > 0,
            (string) $config['urls']['media'],
            $filenameOwners,
            $references,
            $uncertainties
        );
        $snapshotSources[] = lifecycle_read_snapshot(
            $publicSnapshotDir . DIRECTORY_SEPARATOR . 'previous.json',
            'snapshot.previous',
            'retained',
            false,
            (string) $config['urls']['media'],
            $filenameOwners,
            $references,
            $uncertainties
        );
    }

    $archiveRevisions = [];
    if ($archiveSnapshotDir !== null) {
        $entries = scandir($archiveSnapshotDir);
        if (!is_array($entries)) {
            lifecycle_add_uncertainty($uncertainties, 'snapshot', 'Snapshot archive directory could not be listed.');
        } else {
            foreach ($entries as $entry) {
                if ($entry === '.' || $entry === '..') {
                    continue;
                }
                $path = $archiveSnapshotDir . DIRECTORY_SEPARATOR . $entry;
                if (preg_match('/^menu-(\d{20})-([a-f0-9]{64})\.json$/D', $entry, $matches) !== 1) {
                    lifecycle_add_uncertainty(
                        $uncertainties,
                        'snapshot',
                        "Snapshot archive contains an unrecognized entry: $entry"
                    );
                    continue;
                }
                $revision = (int) $matches[1];
                $sha = (string) $matches[2];
                if (isset($archiveRevisions[$revision])) {
                    lifecycle_add_uncertainty(
                        $uncertainties,
                        'snapshot',
                        "Revision $revision has more than one archive file."
                    );
                }
                $archiveRevisions[$revision] = $entry;
                if (!isset($revisions[$revision])) {
                    lifecycle_add_uncertainty(
                        $uncertainties,
                        'snapshot',
                        "Archive $entry has no menu_revisions row."
                    );
                } else {
                    $revisions[$revision]['archivePresent'] = true;
                }
                $source = 'snapshot.revision.' . $revision;
                $snapshotSources[] = lifecycle_read_snapshot(
                    $path,
                    $source,
                    'retained',
                    true,
                    (string) $config['urls']['media'],
                    $filenameOwners,
                    $references,
                    $uncertainties,
                    $revision,
                    $sha
                );
                if (
                    isset($revisions[$revision])
                    && $revisions[$revision]['snapshotSha256'] !== null
                    && !hash_equals((string) $revisions[$revision]['snapshotSha256'], $sha)
                ) {
                    lifecycle_add_uncertainty(
                        $uncertainties,
                        'snapshot',
                        "Revision $revision archive hash differs from menu_revisions."
                    );
                }
            }
        }
    }

    foreach ($revisions as $revision => &$revisionData) {
        if (!$revisionData['archivePresent']) {
            lifecycle_add_uncertainty(
                $uncertainties,
                'snapshot',
                "Revision $revision has no retained private archive."
            );
        }
        $reasons = ['destructive_cleanup_disabled'];
        if ($revision === $editRevision) {
            $reasons[] = 'current_edit_revision';
        }
        if ($revision === $publishedRevision) {
            $reasons[] = 'current_published_revision';
        }
        if (in_array($revisionData['publishState'], ['pending', 'failed'], true)) {
            $reasons[] = 'publish_recovery';
        }
        if ($revisionData['lifecyclePinActive']) {
            $reasons[] = 'explicit_lifecycle_retention';
        }
        sort($reasons, SORT_STRING);
        $revisionData['protectionReasons'] = $reasons;
    }
    unset($revisionData);

    usort(
        $uncertainties,
        static fn (array $left, array $right): int => strcmp(
            $left['scope'] . '|' . $left['message'] . '|' . implode(',', $left['assetIds']),
            $right['scope'] . '|' . $right['message'] . '|' . implode(',', $right['assetIds'])
        )
    );
    $globallySafe = $uncertainties === [];
    $classifications = [];
    $classificationCounts = [];
    $bytesByClassification = [];
    $orphanCandidates = [];
    $proposedActions = [];
    foreach ($assets as $assetId => $asset) {
        $assetReferences = [];
        $hasActive = false;
        foreach ($references[$assetId] as $source => $reachability) {
            $assetReferences[] = ['source' => $source, 'reachability' => $reachability];
            $hasActive = $hasActive || $reachability === 'active';
        }
        usort(
            $assetReferences,
            static fn (array $left, array $right): int => strcmp($left['source'], $right['source'])
        );
        $hasReferences = $assetReferences !== [];
        if ($hasActive) {
            $classification = 'active';
        } elseif ($hasReferences) {
            $classification = 'retained';
        } elseif (!$globallySafe) {
            $classification = 'uncertain';
        } elseif ($asset['orphanCandidateAt'] !== null) {
            $classification = 'orphan-candidate';
        } elseif ($asset['retiredAt'] !== null) {
            $classification = 'retired';
        } else {
            $classification = 'unreferenced';
        }

        $proposedAction = 'none';
        if ($hasReferences && $asset['orphanCandidateAt'] !== null) {
            $proposedAction = 'clear_orphan_candidate';
        } elseif (!$hasReferences && $globallySafe && $asset['orphanCandidateAt'] === null) {
            $proposedAction = 'mark_orphan_candidate';
        } elseif (!$hasReferences && !$globallySafe) {
            $proposedAction = 'retain_uncertain';
        }
        if (!$hasReferences && $globallySafe) {
            $orphanCandidates[] = $assetId;
        }
        if ($proposedAction !== 'none') {
            $proposedActions[] = ['assetId' => $assetId, 'action' => $proposedAction];
        }
        $classificationCounts[$classification] = ($classificationCounts[$classification] ?? 0) + 1;
        $bytesByClassification[$classification] = ($bytesByClassification[$classification] ?? 0)
            + (int) $asset['bytes']['observedTotalBytes'];
        $classifications[] = [
            ...$asset,
            'classification' => $classification,
            'references' => $assetReferences,
            'proposedBookkeepingAction' => $proposedAction,
            'futureDestructiveEligibility' => false,
        ];
    }
    ksort($classificationCounts, SORT_STRING);
    ksort($bytesByClassification, SORT_STRING);
    sort($orphanCandidates, SORT_STRING);
    usort(
        $proposedActions,
        static fn (array $left, array $right): int => strcmp($left['assetId'], $right['assetId'])
    );

    $plan = [
        'schemaVersion' => 1,
        'safeForBookkeepingApply' => $globallySafe,
        'destructiveBehaviorEnabled' => false,
        'menuState' => [
            'editRevision' => $editRevision,
            'publishedRevision' => $publishedRevision,
        ],
        'policy' => $policy,
        'referenceSources' => [
            'database' => [
                'activeMenuReferenceRows' => count(array_filter(
                    $menuRows,
                    static fn (array $row): bool => $row['item_archived_at'] === null
                        && $row['category_archived_at'] === null
                )),
                'archivedMenuReferenceRows' => count(array_filter(
                    $menuRows,
                    static fn (array $row): bool => $row['item_archived_at'] !== null
                        || $row['category_archived_at'] !== null
                )),
            ],
            'snapshots' => $snapshotSources,
        ],
        'retainedRevisions' => array_values($revisions),
        'summary' => [
            'assetCount' => count($classifications),
            'classificationCounts' => $classificationCounts,
            'observedBytesByClassification' => $bytesByClassification,
            'observedTotalBytes' => array_sum($bytesByClassification),
            'orphanCandidateCount' => count($orphanCandidates),
            'uncertaintyCount' => count($uncertainties),
        ],
        'assets' => $classifications,
        'orphanCandidates' => $orphanCandidates,
        'uncertainties' => $uncertainties,
        'proposedBookkeepingActions' => $proposedActions,
        'proposedFutureActions' => [
            'archivePruning' => 'disabled',
            'mediaDeletion' => 'disabled',
            'ownershipRowDeletion' => 'disabled',
        ],
    ];
    $canonical = lifecycle_canonicalize($plan);
    $encoded = json_encode($canonical, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    $plan['planSha256'] = hash('sha256', $encoded);
    return $plan;
}

/** @param array<string, mixed> $plan @return array<string, mixed> */
function apply_media_lifecycle_bookkeeping(PDO $pdo, array $plan): array
{
    if (($plan['safeForBookkeepingApply'] ?? false) !== true) {
        return [
            'attempted' => true,
            'completed' => false,
            'reason' => 'Authoritative reference state is uncertain; no bookkeeping was changed.',
            'marked' => 0,
            'cleared' => 0,
        ];
    }

    $mark = $pdo->prepare(
        'UPDATE media_assets SET orphan_candidate_at = UTC_TIMESTAMP(6) '
        . 'WHERE id = ? AND orphan_candidate_at IS NULL'
    );
    $clear = $pdo->prepare(
        'UPDATE media_assets SET orphan_candidate_at = NULL '
        . 'WHERE id = ? AND orphan_candidate_at IS NOT NULL'
    );
    $marked = 0;
    $cleared = 0;
    $pdo->beginTransaction();
    try {
        foreach ($plan['proposedBookkeepingActions'] as $action) {
            if ($action['action'] === 'mark_orphan_candidate') {
                $mark->execute([(string) $action['assetId']]);
                $marked += $mark->rowCount();
            } elseif ($action['action'] === 'clear_orphan_candidate') {
                $clear->execute([(string) $action['assetId']]);
                $cleared += $clear->rowCount();
            }
        }
        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $exception;
    }
    return [
        'attempted' => true,
        'completed' => true,
        'reason' => null,
        'marked' => $marked,
        'cleared' => $cleared,
    ];
}
