<?php

declare(strict_types=1);

namespace LCafe\Admin;

use GdImage;
use PDO;
use PDOException;
use RuntimeException;

/** @param array<string, mixed> $config @param array<string, mixed> $row @return array<string, mixed> */
function media_payload(array $config, array $row): array
{
    return [
        'id' => (string) $row['id'],
        'width' => (int) $row['width'],
        'height' => (int) $row['height'],
        'urls' => [
            '300' => media_url($config, (string) $row['rendition_300_filename']),
            '600' => media_url($config, (string) $row['rendition_600_filename']),
        ],
    ];
}

/** @param array<string, mixed> $config */
function existing_media_by_hash(PDO $pdo, array $config, string $sha): ?array
{
    $statement = $pdo->prepare(
        'SELECT id, width, height, rendition_300_filename, rendition_600_filename '
        . 'FROM media_assets WHERE source_sha256 = ? LIMIT 1'
    );
    $statement->execute([$sha]);
    $row = $statement->fetch();
    if (!is_array($row)) {
        return null;
    }
    $pdo->prepare('UPDATE media_assets SET retired_at = NULL WHERE id = ?')->execute([(string) $row['id']]);
    return media_payload($config, $row);
}

function orient_uploaded_image(GdImage $image, string $path, string $mime): GdImage
{
    if ($mime !== 'image/jpeg' || !function_exists('exif_read_data')) {
        return $image;
    }
    try {
        $exif = @exif_read_data($path);
        $orientation = is_array($exif) ? (int) ($exif['Orientation'] ?? 1) : 1;
        $degrees = match ($orientation) {
            3 => 180,
            6 => -90,
            8 => 90,
            default => 0,
        };
        if ($degrees !== 0) {
            $rotated = imagerotate($image, $degrees, 0);
            if ($rotated instanceof GdImage) {
                imagedestroy($image);
                return $rotated;
            }
        }
    } catch (\Throwable) {
        // Orientation is a best-effort normalization; decoding already proved
        // the image itself is usable.
    }
    return $image;
}

function square_rendition(GdImage $source, int $size): GdImage
{
    $sourceWidth = imagesx($source);
    $sourceHeight = imagesy($source);
    $edge = min($sourceWidth, $sourceHeight);
    $sourceX = intdiv($sourceWidth - $edge, 2);
    $sourceY = intdiv($sourceHeight - $edge, 2);

    $target = imagecreatetruecolor($size, $size);
    if (!$target instanceof GdImage) {
        throw new RuntimeException('Could not allocate an image rendition.');
    }
    imagealphablending($target, false);
    imagesavealpha($target, true);
    $transparent = imagecolorallocatealpha($target, 0, 0, 0, 127);
    imagefill($target, 0, 0, $transparent);
    if (!imagecopyresampled(
        $target,
        $source,
        0,
        0,
        $sourceX,
        $sourceY,
        $size,
        $size,
        $edge,
        $edge
    )) {
        imagedestroy($target);
        throw new RuntimeException('Could not resize the uploaded image.');
    }
    return $target;
}

function promote_immutable_file(string $temp, string $final): void
{
    if (is_file($final)) {
        unlink($temp);
        return;
    }
    if (!rename($temp, $final)) {
        if (is_file($final)) {
            unlink($temp);
            return;
        }
        throw new RuntimeException('Could not store an immutable media file.');
    }
}

/** @param array<string, mixed> $config @return array<string, mixed> */
function upload_media(PDO $pdo, array $config): array
{
    $upload = $_FILES['image'] ?? null;
    if (!is_array($upload) || is_array($upload['tmp_name'] ?? null)) {
        throw new ApiException(422, 'upload_required', 'A single image upload is required.');
    }
    $error = (int) ($upload['error'] ?? UPLOAD_ERR_NO_FILE);
    if ($error !== UPLOAD_ERR_OK) {
        $status = in_array($error, [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true) ? 413 : 422;
        throw new ApiException($status, 'upload_failed', 'The image upload did not complete.');
    }
    $tempPath = (string) ($upload['tmp_name'] ?? '');
    if ($tempPath === '' || !is_uploaded_file($tempPath)) {
        throw new ApiException(422, 'upload_failed', 'The uploaded file is invalid.');
    }
    $byteSize = filesize($tempPath);
    $maxBytes = max(1, (int) $config['uploads']['max_bytes']);
    if ($byteSize === false || $byteSize < 1 || $byteSize > $maxBytes) {
        throw new ApiException(413, 'upload_too_large', 'The uploaded image exceeds the configured size limit.');
    }

    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mime = $finfo !== false ? finfo_file($finfo, $tempPath) : false;
    if ($finfo !== false) {
        finfo_close($finfo);
    }
    $extensions = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
    if (!is_string($mime) || !isset($extensions[$mime])) {
        throw new ApiException(415, 'unsupported_media', 'Only JPEG, PNG, and WebP images are accepted.');
    }
    $dimensions = @getimagesize($tempPath);
    if (!is_array($dimensions) || !isset($dimensions[0], $dimensions[1])) {
        throw new ApiException(415, 'unsupported_media', 'The uploaded file is not a readable image.');
    }
    $width = (int) $dimensions[0];
    $height = (int) $dimensions[1];
    if ($width < 1 || $height < 1 || ($width * $height) > (int) $config['uploads']['max_pixels']) {
        throw new ApiException(413, 'image_dimensions_too_large', 'The image dimensions exceed the configured limit.');
    }
    if (!function_exists('imagecreatefromstring') || !function_exists('imagewebp')) {
        throw new ApiException(503, 'image_processing_unavailable', 'WebP image processing is unavailable.');
    }

    $sha = hash_file('sha256', $tempPath);
    if (!is_string($sha)) {
        throw new ApiException(422, 'upload_failed', 'The uploaded image could not be read.');
    }
    $existing = existing_media_by_hash($pdo, $config, $sha);
    if ($existing !== null) {
        return $existing;
    }

    $sourceBytes = file_get_contents($tempPath);
    if ($sourceBytes === false) {
        throw new ApiException(422, 'upload_failed', 'The uploaded image could not be read.');
    }
    $source = @imagecreatefromstring($sourceBytes);
    if (!$source instanceof GdImage) {
        throw new ApiException(415, 'unsupported_media', 'The uploaded file is not a readable image.');
    }
    $source = orient_uploaded_image($source, $tempPath, $mime);

    $publicDir = require_writable_directory((string) $config['paths']['media_public_dir'], 'Managed media');
    $originalDir = require_writable_directory((string) $config['paths']['media_original_dir'], 'Original media');
    $quality = min(100, max(1, (int) $config['uploads']['webp_quality']));
    $filenames = [];
    try {
        foreach ([300, 600] as $size) {
            $rendition = square_rendition($source, $size);
            $temp = tempnam($publicDir, '.media-');
            if ($temp === false) {
                imagedestroy($rendition);
                throw new RuntimeException('Could not reserve a media staging file.');
            }
            try {
                if (!imagewebp($rendition, $temp, $quality)) {
                    throw new RuntimeException('Could not encode a WebP rendition.');
                }
                $filename = $sha . '-' . $size . '.webp';
                promote_immutable_file($temp, $publicDir . DIRECTORY_SEPARATOR . $filename);
                $filenames[$size] = $filename;
            } finally {
                if ($rendition instanceof GdImage) {
                    imagedestroy($rendition);
                }
                if (is_file($temp)) {
                    unlink($temp);
                }
            }
        }
    } finally {
        imagedestroy($source);
    }

    $originalFilename = $sha . '.' . $extensions[$mime];
    $originalPath = $originalDir . DIRECTORY_SEPARATOR . $originalFilename;
    if (!is_file($originalPath)) {
        $originalTemp = tempnam($originalDir, '.original-');
        if ($originalTemp === false) {
            throw new RuntimeException('Could not reserve original media storage.');
        }
        try {
            write_complete_file($originalTemp, $sourceBytes);
            promote_immutable_file($originalTemp, $originalPath);
        } finally {
            if (is_file($originalTemp)) {
                unlink($originalTemp);
            }
        }
    }

    $id = uuid_v4();
    try {
        $pdo->prepare(
            'INSERT INTO media_assets '
            . '(id, source_sha256, source_mime, source_extension, width, height, byte_size, '
            . 'rendition_300_filename, rendition_600_filename, original_filename) '
            . 'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )->execute([
            $id, $sha, $mime, $extensions[$mime], $width, $height, $byteSize,
            $filenames[300], $filenames[600], $originalFilename,
        ]);
    } catch (PDOException $exception) {
        if ((string) $exception->getCode() !== '23000') {
            throw $exception;
        }
        $existing = existing_media_by_hash($pdo, $config, $sha);
        if ($existing !== null) {
            return $existing;
        }
        throw $exception;
    }

    return [
        'id' => $id,
        'width' => $width,
        'height' => $height,
        'urls' => [
            '300' => media_url($config, $filenames[300]),
            '600' => media_url($config, $filenames[600]),
        ],
    ];
}
