<?php

declare(strict_types=1);

namespace LCafe\Admin;

use RuntimeException;

/** @param resource $handle */
function flush_file($handle): void
{
    if (!fflush($handle)) {
        throw new RuntimeException('Could not flush a snapshot file.');
    }
    if (function_exists('fsync') && !fsync($handle)) {
        throw new RuntimeException('Could not synchronize a snapshot file.');
    }
}

function write_complete_file(string $path, string $bytes): void
{
    $handle = fopen($path, 'wb');
    if ($handle === false) {
        throw new RuntimeException('Could not create a snapshot file.');
    }
    try {
        $offset = 0;
        $length = strlen($bytes);
        while ($offset < $length) {
            $written = fwrite($handle, substr($bytes, $offset));
            if ($written === false || $written === 0) {
                throw new RuntimeException('Could not finish a snapshot file.');
            }
            $offset += $written;
        }
        flush_file($handle);
    } finally {
        fclose($handle);
    }
    chmod($path, 0644);
}

/**
 * @param array<string, mixed> $config
 * @param array<string, mixed> $snapshot
 * @return array{temp:string,archive:string,archiveCreated:bool,sha256:string}
 */
function prepare_snapshot(array $config, array $snapshot, int $revision): array
{
    $publicDir = require_writable_directory(
        (string) $config['paths']['snapshot_public_dir'],
        'Public snapshot'
    );
    $archiveDir = require_writable_directory(
        (string) $config['paths']['snapshot_archive_dir'],
        'Snapshot archive'
    );
    $bytes = json_encode(
        $snapshot,
        JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR
    ) . "\n";
    $sha = hash('sha256', $bytes);

    $temp = tempnam($publicDir, '.current-');
    if ($temp === false) {
        throw new RuntimeException('Could not reserve a snapshot staging file.');
    }
    $archive = $archiveDir . DIRECTORY_SEPARATOR
        . sprintf('menu-%020d-%s.json', $revision, $sha);
    $archiveCreated = false;

    try {
        write_complete_file($temp, $bytes);
        if (is_file($archive)) {
            if (!hash_equals($sha, (string) hash_file('sha256', $archive))) {
                throw new RuntimeException('A revision archive has unexpected contents.');
            }
        } else {
            $archiveTemp = tempnam($archiveDir, '.revision-');
            if ($archiveTemp === false) {
                throw new RuntimeException('Could not reserve a revision archive file.');
            }
            try {
                write_complete_file($archiveTemp, $bytes);
                if (!rename($archiveTemp, $archive)) {
                    throw new RuntimeException('Could not publish a revision archive file.');
                }
                $archiveCreated = true;
            } finally {
                if (is_file($archiveTemp)) {
                    unlink($archiveTemp);
                }
            }
        }
    } catch (\Throwable $exception) {
        if (is_file($temp)) {
            unlink($temp);
        }
        throw $exception;
    }

    return [
        'temp' => $temp,
        'archive' => $archive,
        'archiveCreated' => $archiveCreated,
        'sha256' => $sha,
    ];
}

/** @param array{temp:string,archive:string,archiveCreated:bool,sha256:string} $prepared */
function discard_prepared_snapshot(array $prepared, bool $discardArchive = false): void
{
    if (is_file($prepared['temp'])) {
        unlink($prepared['temp']);
    }
    if ($discardArchive && $prepared['archiveCreated'] && is_file($prepared['archive'])) {
        unlink($prepared['archive']);
    }
}

/**
 * The staging file and current.json are required to be on the same POSIX
 * filesystem. rename() is the only operation that changes the public current
 * pointer, so a failed promotion leaves the previous current.json in place.
 *
 * @param array<string, mixed> $config
 * @param array{temp:string,archive:string,archiveCreated:bool,sha256:string} $prepared
 */
function promote_prepared_snapshot(array $config, array $prepared): void
{
    $publicDir = require_writable_directory(
        (string) $config['paths']['snapshot_public_dir'],
        'Public snapshot'
    );
    $current = $publicDir . DIRECTORY_SEPARATOR . 'current.json';
    $previous = $publicDir . DIRECTORY_SEPARATOR . 'previous.json';

    if (is_file($current)) {
        $previousTemp = tempnam($publicDir, '.previous-');
        if ($previousTemp === false) {
            throw new RuntimeException('Could not reserve the previous snapshot file.');
        }
        try {
            $currentBytes = file_get_contents($current);
            if ($currentBytes === false) {
                throw new RuntimeException('Could not read the current snapshot.');
            }
            write_complete_file($previousTemp, $currentBytes);
            if (!rename($previousTemp, $previous)) {
                throw new RuntimeException('Could not rotate the previous snapshot.');
            }
        } finally {
            if (is_file($previousTemp)) {
                unlink($previousTemp);
            }
        }
    }

    if (!rename($prepared['temp'], $current)) {
        throw new RuntimeException('Could not atomically publish current.json.');
    }
}
