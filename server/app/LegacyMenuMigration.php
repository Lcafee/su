<?php

declare(strict_types=1);

namespace LCafe\Admin;

use JsonException;
use PDO;
use RuntimeException;

const LEGACY_MENU_UUID_NAMESPACE = 'ff96dbfb-9e49-5d98-871d-1b995c495f40';

function migration_uuid(string $kind, string $publicId): string
{
    $namespaceHex = str_replace('-', '', LEGACY_MENU_UUID_NAMESPACE);
    $namespace = hex2bin($namespaceHex);
    if ($namespace === false) {
        throw new RuntimeException('The migration UUID namespace is invalid.');
    }
    $hash = sha1($namespace . $kind . ':' . $publicId, true);
    $hash[6] = chr((ord($hash[6]) & 0x0f) | 0x50);
    $hash[8] = chr((ord($hash[8]) & 0x3f) | 0x80);
    $hex = bin2hex(substr($hash, 0, 16));
    return sprintf(
        '%s-%s-%s-%s-%s',
        substr($hex, 0, 8),
        substr($hex, 8, 4),
        substr($hex, 12, 4),
        substr($hex, 16, 4),
        substr($hex, 20, 12)
    );
}

function legacy_item_public_id(array $item, string $categoryPublicId, int $itemIndex): string
{
    $slotId = $item['slotId'] ?? null;
    if (is_string($slotId) && trim($slotId) !== '') {
        return trim($slotId);
    }
    return sprintf('%s-item-%02d', $categoryPublicId, $itemIndex + 1);
}

/** @return array<string, mixed> */
function legacy_item_metadata(array $item): array
{
    $mapped = ['slotId', 'name', 'desc', 'price', 'photo', 'options'];
    $metadata = [];
    foreach ($item as $key => $value) {
        if (is_string($key) && !in_array($key, $mapped, true)) {
            $metadata[$key] = $value;
        }
    }
    $photo = $item['photo'] ?? null;
    if (is_string($photo) && trim($photo) !== '') {
        $metadata['sourcePhoto'] = trim($photo);
    }
    return $metadata;
}

function resolve_legacy_image(string $imageDirectory, string $photo): string
{
    if ($photo !== basename($photo) || preg_match('/\.webp$/i', $photo) !== 1) {
        throw new RuntimeException("Legacy photo name is unsafe: $photo");
    }
    $stem = preg_replace('/\.webp$/i', '', $photo);
    $candidates = [$imageDirectory . DIRECTORY_SEPARATOR . $photo];
    foreach (['webp', 'jpeg', 'jpg', 'png'] as $extension) {
        $candidates[] = $imageDirectory . DIRECTORY_SEPARATOR . $stem . '.' . $extension;
    }
    $resolved = [];
    foreach (array_unique($candidates) as $candidate) {
        $path = realpath($candidate);
        if ($path !== false && is_file($path) && is_readable($path)) {
            $resolved[$path] = true;
        }
    }
    $paths = array_keys($resolved);
    if (count($paths) !== 1) {
        throw new RuntimeException(
            count($paths) === 0
                ? "No source image was found for $photo in $imageDirectory."
                : "More than one source image matches $photo in $imageDirectory."
        );
    }
    return $paths[0];
}

/** @param array<string, mixed> $legacy @return array<string, string> */
function legacy_image_sources(array $legacy, string $imageDirectory): array
{
    $categories = $legacy['categories'] ?? null;
    if (!is_array($categories) || !array_is_list($categories)) {
        throw new RuntimeException('Legacy menu categories must be a list.');
    }
    $sources = [];
    foreach ($categories as $category) {
        if (!is_array($category)) {
            throw new RuntimeException('Each legacy menu category must be an object.');
        }
        $items = $category['items'] ?? null;
        if (!is_array($items) || !array_is_list($items)) {
            throw new RuntimeException('Each legacy menu category must contain an item list.');
        }
        foreach ($items as $item) {
            if (!is_array($item)) {
                throw new RuntimeException('Each legacy menu item must be an object.');
            }
            $photo = $item['photo'] ?? null;
            if (is_string($photo) && trim($photo) !== '') {
                $photo = trim($photo);
                $sources[$photo] = resolve_legacy_image($imageDirectory, $photo);
            }
        }
    }
    ksort($sources);
    return $sources;
}

function assert_empty_menu_for_migration(PDO $pdo): void
{
    $state = $pdo->query('SELECT edit_revision, published_revision FROM menu_state WHERE id = 1')->fetch();
    if (!is_array($state)) {
        throw new RuntimeException('The menu schema is not initialized.');
    }
    $categoryCount = (int) $pdo->query('SELECT COUNT(*) FROM menu_categories')->fetchColumn();
    $itemCount = (int) $pdo->query('SELECT COUNT(*) FROM menu_items')->fetchColumn();
    if (
        (int) $state['edit_revision'] !== 0
        || (int) $state['published_revision'] !== 0
        || $categoryCount !== 0
        || $itemCount !== 0
    ) {
        throw new RuntimeException(
            'The one-time migration only runs against an initialized, empty menu database.'
        );
    }
}

/**
 * @param array<string, mixed> $legacy
 * @param array<string, array<string, mixed>> $mediaByPhoto
 * @return array<string, mixed>
 */
function legacy_edit_document(array $legacy, array $mediaByPhoto): array
{
    $categories = [];
    foreach ($legacy['categories'] as $legacyCategory) {
        $publicId = trim((string) ($legacyCategory['id'] ?? ''));
        $items = [];
        foreach ($legacyCategory['items'] as $itemIndex => $legacyItem) {
            $itemPublicId = legacy_item_public_id($legacyItem, $publicId, $itemIndex);
            $photo = $legacyItem['photo'] ?? null;
            $media = is_string($photo) && trim($photo) !== ''
                ? ($mediaByPhoto[trim($photo)] ?? null)
                : null;
            $options = [];
            foreach (($legacyItem['options'] ?? []) as $optionIndex => $legacyOption) {
                $optionIdentity = $itemPublicId . ':' . $optionIndex . ':' . (string) ($legacyOption['code'] ?? '');
                $options[] = [
                    'id' => migration_uuid('option', $optionIdentity),
                    'label' => $legacyOption['label'] ?? null,
                    'price' => $legacyOption['price'] ?? null,
                    'code' => $legacyOption['code'] ?? null,
                ];
            }
            $items[] = [
                'id' => migration_uuid('item', $itemPublicId),
                'publicId' => $itemPublicId,
                'name' => $legacyItem['name'] ?? null,
                'description' => $legacyItem['desc'] ?? null,
                'price' => $legacyItem['price'] ?? null,
                'mediaId' => is_array($media) ? ($media['id'] ?? null) : null,
                'metadata' => legacy_item_metadata($legacyItem),
                'archived' => false,
                'options' => $options,
            ];
        }
        $categories[] = [
            'id' => migration_uuid('category', $publicId),
            'publicId' => $publicId,
            'title' => $legacyCategory['title'] ?? null,
            'intro' => $legacyCategory['intro'] ?? null,
            'layout' => $legacyCategory['layout'] ?? 'grid',
            'archived' => false,
            'items' => $items,
        ];
    }
    return ['baseRevision' => 0, 'categories' => $categories];
}

/** @param array<string, mixed> $config @return array<string, mixed> */
function migrate_legacy_menu(PDO $pdo, array $config, string $menuPath, string $imageDirectory): array
{
    $resolvedMenu = realpath($menuPath);
    $resolvedImages = realpath($imageDirectory);
    if ($resolvedMenu === false || !is_file($resolvedMenu) || !is_readable($resolvedMenu)) {
        throw new RuntimeException('The legacy menu JSON file is unavailable.');
    }
    if ($resolvedImages === false || !is_dir($resolvedImages) || !is_readable($resolvedImages)) {
        throw new RuntimeException('The legacy image directory is unavailable.');
    }
    try {
        $legacy = json_decode(
            (string) file_get_contents($resolvedMenu),
            true,
            64,
            JSON_THROW_ON_ERROR
        );
    } catch (JsonException $exception) {
        throw new RuntimeException('The legacy menu JSON is invalid.', 0, $exception);
    }
    if (!is_array($legacy) || array_is_list($legacy)) {
        throw new RuntimeException('The legacy menu JSON root must be an object.');
    }

    assert_empty_menu_for_migration($pdo);
    $sources = legacy_image_sources($legacy, $resolvedImages);
    $mediaByPhoto = [];
    foreach ($sources as $photo => $sourcePath) {
        $mediaByPhoto[$photo] = import_media_file($pdo, $config, $sourcePath);
    }
    $document = legacy_edit_document($legacy, $mediaByPhoto);
    $result = save_menu_document(
        $pdo,
        $config,
        ['id' => null, 'username' => 'legacy-menu-migration'],
        $document
    );
    $result['categoryCount'] = count($document['categories']);
    $result['itemCount'] = array_sum(array_map(
        static fn(array $category): int => count($category['items']),
        $document['categories']
    ));
    $result['mediaCount'] = count($mediaByPhoto);
    return $result;
}
