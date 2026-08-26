<?php

declare(strict_types=1);

namespace LCafe\Admin;

use DateTimeImmutable;
use DateTimeZone;
use PDO;
use Throwable;

/** @param array<string, mixed> $config */
function media_url(array $config, string $filename): string
{
    return rtrim((string) $config['urls']['media'], '/') . '/' . rawurlencode($filename);
}

/** @return array<string, mixed> */
function decoded_metadata(string $json): array
{
    $value = json_decode($json, true);
    return is_array($value) ? $value : [];
}

/** @param array<string, mixed> $config @return array<string, mixed> */
function load_menu_document(PDO $pdo, array $config): array
{
    $state = $pdo->query('SELECT edit_revision, published_revision FROM menu_state WHERE id = 1')->fetch();
    if (!is_array($state)) {
        throw new ApiException(503, 'schema_unavailable', 'The menu database has not been initialized.');
    }

    $categories = [];
    $categoryIndexes = [];
    $rows = $pdo->query(
        'SELECT id, public_id, title, intro, layout, sort_order, archived_at '
        . 'FROM menu_categories ORDER BY (archived_at IS NOT NULL), sort_order, id'
    )->fetchAll();
    foreach ($rows as $row) {
        $categoryIndexes[(string) $row['id']] = count($categories);
        $categories[] = [
            'id' => (string) $row['id'],
            'publicId' => (string) $row['public_id'],
            'title' => (string) $row['title'],
            'intro' => $row['intro'] !== null ? (string) $row['intro'] : null,
            'layout' => (string) $row['layout'],
            'sortOrder' => (int) $row['sort_order'],
            'archived' => $row['archived_at'] !== null,
            'items' => [],
        ];
    }

    $optionsByItem = [];
    $optionRows = $pdo->query(
        'SELECT id, item_id, label, price_text, external_code, sort_order '
        . 'FROM menu_item_options ORDER BY item_id, sort_order, id'
    )->fetchAll();
    foreach ($optionRows as $row) {
        $itemId = (string) $row['item_id'];
        $optionsByItem[$itemId][] = [
            'id' => (string) $row['id'],
            'label' => (string) $row['label'],
            'price' => (string) $row['price_text'],
            'code' => $row['external_code'] !== null ? (string) $row['external_code'] : null,
            'sortOrder' => (int) $row['sort_order'],
        ];
    }

    $itemRows = $pdo->query(
        'SELECT i.id, i.category_id, i.public_id, i.name, i.description, i.price_text, '
        . 'i.media_id, i.metadata_json, i.sort_order, i.archived_at, '
        . 'm.width, m.height, m.rendition_300_filename, m.rendition_600_filename '
        . 'FROM menu_items i LEFT JOIN media_assets m ON m.id = i.media_id '
        . 'ORDER BY i.category_id, (i.archived_at IS NOT NULL), i.sort_order, i.id'
    )->fetchAll();
    foreach ($itemRows as $row) {
        $categoryId = (string) $row['category_id'];
        if (!array_key_exists($categoryId, $categoryIndexes)) {
            continue;
        }
        $media = null;
        if ($row['media_id'] !== null && $row['rendition_600_filename'] !== null) {
            $media = [
                'id' => (string) $row['media_id'],
                'width' => (int) $row['width'],
                'height' => (int) $row['height'],
                'urls' => [
                    '300' => media_url($config, (string) $row['rendition_300_filename']),
                    '600' => media_url($config, (string) $row['rendition_600_filename']),
                ],
            ];
        }
        $itemId = (string) $row['id'];
        $categories[$categoryIndexes[$categoryId]]['items'][] = [
            'id' => $itemId,
            'publicId' => (string) $row['public_id'],
            'name' => (string) $row['name'],
            'description' => $row['description'] !== null ? (string) $row['description'] : null,
            'price' => $row['price_text'] !== null ? (string) $row['price_text'] : null,
            'mediaId' => $row['media_id'] !== null ? (string) $row['media_id'] : null,
            'media' => $media,
            'metadata' => decoded_metadata((string) $row['metadata_json']),
            'sortOrder' => (int) $row['sort_order'],
            'archived' => $row['archived_at'] !== null,
            'options' => $optionsByItem[$itemId] ?? [],
        ];
    }

    return [
        'revision' => (int) $state['edit_revision'],
        'publishedRevision' => (int) $state['published_revision'],
        'categories' => $categories,
    ];
}

function normalized_uuid(mixed $value, string $field): string
{
    if ($value === null || $value === '') {
        return uuid_v4();
    }
    if (!is_string($value) || !is_uuid($value)) {
        throw new ApiException(422, 'validation_error', "$field must be a UUID.", ['field' => $field]);
    }
    return strtolower($value);
}

function normalized_public_id(mixed $value, string $field): string
{
    $id = required_text($value, $field, 100);
    if (preg_match('/^[a-z0-9][a-z0-9_-]{0,99}$/', $id) !== 1) {
        throw new ApiException(
            422,
            'validation_error',
            "$field may contain only lowercase letters, numbers, underscores, and hyphens.",
            ['field' => $field]
        );
    }
    return $id;
}

/** @param array<string, mixed> $input @return array<string, mixed> */
function normalize_menu_input(array $input): array
{
    $baseRevision = $input['baseRevision'] ?? null;
    if (!is_int($baseRevision) || $baseRevision < 0) {
        throw new ApiException(422, 'validation_error', 'baseRevision must be a non-negative integer.');
    }
    $categoryInput = $input['categories'] ?? null;
    if (!is_array($categoryInput) || !array_is_list($categoryInput) || count($categoryInput) > 100) {
        throw new ApiException(422, 'validation_error', 'categories must be a list with at most 100 entries.');
    }

    $categories = [];
    $categoryIds = [];
    $categoryPublicIds = [];
    $itemIds = [];
    $itemPublicIds = [];
    $optionIds = [];
    $totalItems = 0;
    foreach ($categoryInput as $categoryIndex => $rawCategory) {
        $path = "categories[$categoryIndex]";
        if (!is_array($rawCategory) || array_is_list($rawCategory)) {
            throw new ApiException(422, 'validation_error', "$path must be an object.");
        }
        $categoryId = normalized_uuid($rawCategory['id'] ?? null, "$path.id");
        $publicId = normalized_public_id($rawCategory['publicId'] ?? null, "$path.publicId");
        if (isset($categoryIds[$categoryId]) || isset($categoryPublicIds[$publicId])) {
            throw new ApiException(422, 'validation_error', 'Category identifiers must be unique.');
        }
        $categoryIds[$categoryId] = true;
        $categoryPublicIds[$publicId] = true;
        $layout = required_text($rawCategory['layout'] ?? null, "$path.layout", 16);
        if (!in_array($layout, ['grid', 'addons'], true)) {
            throw new ApiException(422, 'validation_error', "$path.layout must be grid or addons.");
        }
        $rawItems = $rawCategory['items'] ?? null;
        if (!is_array($rawItems) || !array_is_list($rawItems)) {
            throw new ApiException(422, 'validation_error', "$path.items must be a list.");
        }
        $totalItems += count($rawItems);
        if ($totalItems > 1000) {
            throw new ApiException(422, 'validation_error', 'The menu may contain at most 1000 items.');
        }

        $items = [];
        foreach ($rawItems as $itemIndex => $rawItem) {
            $itemPath = "$path.items[$itemIndex]";
            if (!is_array($rawItem) || array_is_list($rawItem)) {
                throw new ApiException(422, 'validation_error', "$itemPath must be an object.");
            }
            $itemId = normalized_uuid($rawItem['id'] ?? null, "$itemPath.id");
            $itemPublicId = normalized_public_id($rawItem['publicId'] ?? null, "$itemPath.publicId");
            if (isset($itemIds[$itemId]) || isset($itemPublicIds[$itemPublicId])) {
                throw new ApiException(422, 'validation_error', 'Item identifiers must be unique.');
            }
            $itemIds[$itemId] = true;
            $itemPublicIds[$itemPublicId] = true;

            $mediaId = $rawItem['mediaId'] ?? null;
            if ($mediaId !== null && (!is_string($mediaId) || !is_uuid($mediaId))) {
                throw new ApiException(422, 'validation_error', "$itemPath.mediaId must be null or a UUID.");
            }
            $metadata = $rawItem['metadata'] ?? [];
            if (!is_array($metadata)) {
                throw new ApiException(422, 'validation_error', "$itemPath.metadata must be an object or list.");
            }
            $metadataJson = json_encode(
                $metadata,
                JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR
            );
            if (strlen($metadataJson) > 16_384) {
                throw new ApiException(422, 'validation_error', "$itemPath.metadata is too large.");
            }

            $rawOptions = $rawItem['options'] ?? [];
            if (!is_array($rawOptions) || !array_is_list($rawOptions) || count($rawOptions) > 50) {
                throw new ApiException(422, 'validation_error', "$itemPath.options must be a list of at most 50 entries.");
            }
            $options = [];
            foreach ($rawOptions as $optionIndex => $rawOption) {
                $optionPath = "$itemPath.options[$optionIndex]";
                if (!is_array($rawOption) || array_is_list($rawOption)) {
                    throw new ApiException(422, 'validation_error', "$optionPath must be an object.");
                }
                $optionId = normalized_uuid($rawOption['id'] ?? null, "$optionPath.id");
                if (isset($optionIds[$optionId])) {
                    throw new ApiException(422, 'validation_error', 'Option identifiers must be unique.');
                }
                $optionIds[$optionId] = true;
                $options[] = [
                    'id' => $optionId,
                    'label' => required_text($rawOption['label'] ?? null, "$optionPath.label", 191),
                    'price' => required_text($rawOption['price'] ?? null, "$optionPath.price", 64),
                    'code' => optional_text($rawOption['code'] ?? null, "$optionPath.code", 64),
                    'sortOrder' => $optionIndex,
                ];
            }

            $items[] = [
                'id' => $itemId,
                'publicId' => $itemPublicId,
                'name' => required_text($rawItem['name'] ?? null, "$itemPath.name", 191),
                'description' => optional_text($rawItem['description'] ?? null, "$itemPath.description", 4000),
                'price' => optional_text($rawItem['price'] ?? null, "$itemPath.price", 64),
                'mediaId' => $mediaId !== null ? strtolower($mediaId) : null,
                'metadataJson' => $metadataJson,
                'archived' => boolean_value($rawItem['archived'] ?? null, "$itemPath.archived"),
                'sortOrder' => $itemIndex,
                'options' => $options,
            ];
        }

        $categories[] = [
            'id' => $categoryId,
            'publicId' => $publicId,
            'title' => required_text($rawCategory['title'] ?? null, "$path.title", 191),
            'intro' => optional_text($rawCategory['intro'] ?? null, "$path.intro", 4000),
            'layout' => $layout,
            'archived' => boolean_value($rawCategory['archived'] ?? null, "$path.archived"),
            'sortOrder' => $categoryIndex,
            'items' => $items,
        ];
    }

    return ['baseRevision' => $baseRevision, 'categories' => $categories];
}

/** @return array<string, true> */
function id_set(PDO $pdo, string $table): array
{
    if (!in_array($table, ['menu_categories', 'menu_items'], true)) {
        throw new \LogicException('Unsupported identifier table.');
    }
    $set = [];
    foreach ($pdo->query("SELECT id FROM $table")->fetchAll() as $row) {
        $set[(string) $row['id']] = true;
    }
    return $set;
}

/** @param array<string, mixed> $document */
function assert_no_implicit_deletes(PDO $pdo, array $document): void
{
    $submittedCategories = [];
    $submittedItems = [];
    foreach ($document['categories'] as $category) {
        $submittedCategories[$category['id']] = true;
        foreach ($category['items'] as $item) {
            $submittedItems[$item['id']] = true;
        }
    }
    $missingCategories = array_diff_key(id_set($pdo, 'menu_categories'), $submittedCategories);
    $missingItems = array_diff_key(id_set($pdo, 'menu_items'), $submittedItems);
    if ($missingCategories !== [] || $missingItems !== []) {
        throw new ApiException(
            422,
            'archive_required',
            'Existing categories and items must be archived, not omitted.',
            [
                'missingCategoryIds' => array_keys($missingCategories),
                'missingItemIds' => array_keys($missingItems),
            ]
        );
    }
}

/** @param array<string, mixed> $document */
function assert_media_exists(PDO $pdo, array $document): void
{
    $ids = [];
    foreach ($document['categories'] as $category) {
        foreach ($category['items'] as $item) {
            if ($item['mediaId'] !== null) {
                $ids[$item['mediaId']] = true;
            }
        }
    }
    if ($ids === []) {
        return;
    }
    $values = array_keys($ids);
    $placeholders = implode(',', array_fill(0, count($values), '?'));
    $statement = $pdo->prepare("SELECT id FROM media_assets WHERE id IN ($placeholders)");
    $statement->execute($values);
    $found = [];
    foreach ($statement->fetchAll() as $row) {
        $found[(string) $row['id']] = true;
    }
    $missing = array_diff_key($ids, $found);
    if ($missing !== []) {
        throw new ApiException(422, 'validation_error', 'One or more selected media assets do not exist.');
    }
}

/** @return array<string, true> */
function referenced_media_set(PDO $pdo): array
{
    $set = [];
    foreach ($pdo->query('SELECT DISTINCT media_id FROM menu_items WHERE media_id IS NOT NULL')->fetchAll() as $row) {
        $set[(string) $row['media_id']] = true;
    }
    return $set;
}

/** @param list<string> $ids @param list<mixed> $prefixParams */
function execute_for_ids(PDO $pdo, string $sqlPrefix, array $ids, array $prefixParams = []): void
{
    if ($ids === []) {
        return;
    }
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $pdo->prepare($sqlPrefix . " ($placeholders)")->execute([...$prefixParams, ...$ids]);
}

/** @param array<string, mixed> $document @param array<string, true> $oldMedia */
function persist_menu_document(PDO $pdo, array $document, array $oldMedia): void
{
    $existingCategories = id_set($pdo, 'menu_categories');
    $existingItems = id_set($pdo, 'menu_items');
    $insertCategory = $pdo->prepare(
        'INSERT INTO menu_categories '
        . '(id, public_id, title, intro, layout, sort_order, archived_at) '
        . 'VALUES (?, ?, ?, ?, ?, ?, IF(? = 1, UTC_TIMESTAMP(6), NULL))'
    );
    $updateCategory = $pdo->prepare(
        'UPDATE menu_categories SET public_id = ?, title = ?, intro = ?, layout = ?, sort_order = ?, '
        . 'archived_at = IF(? = 1, COALESCE(archived_at, UTC_TIMESTAMP(6)), NULL) WHERE id = ?'
    );
    $insertItem = $pdo->prepare(
        'INSERT INTO menu_items '
        . '(id, category_id, public_id, name, description, price_text, media_id, metadata_json, sort_order, archived_at) '
        . 'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, IF(? = 1, UTC_TIMESTAMP(6), NULL))'
    );
    $updateItem = $pdo->prepare(
        'UPDATE menu_items SET category_id = ?, public_id = ?, name = ?, description = ?, price_text = ?, '
        . 'media_id = ?, metadata_json = ?, sort_order = ?, '
        . 'archived_at = IF(? = 1, COALESCE(archived_at, UTC_TIMESTAMP(6)), NULL) WHERE id = ?'
    );
    $deleteOptions = $pdo->prepare('DELETE FROM menu_item_options WHERE item_id = ?');
    $insertOption = $pdo->prepare(
        'INSERT INTO menu_item_options (id, item_id, label, price_text, external_code, sort_order) '
        . 'VALUES (?, ?, ?, ?, ?, ?)'
    );

    $newMedia = [];
    foreach ($document['categories'] as $category) {
        $archived = $category['archived'] ? 1 : 0;
        if (isset($existingCategories[$category['id']])) {
            $updateCategory->execute([
                $category['publicId'], $category['title'], $category['intro'], $category['layout'],
                $category['sortOrder'], $archived, $category['id'],
            ]);
        } else {
            $insertCategory->execute([
                $category['id'], $category['publicId'], $category['title'], $category['intro'],
                $category['layout'], $category['sortOrder'], $archived,
            ]);
        }

        foreach ($category['items'] as $item) {
            $itemArchived = $item['archived'] ? 1 : 0;
            if ($item['mediaId'] !== null) {
                $newMedia[$item['mediaId']] = true;
            }
            if (isset($existingItems[$item['id']])) {
                $updateItem->execute([
                    $category['id'], $item['publicId'], $item['name'], $item['description'], $item['price'],
                    $item['mediaId'], $item['metadataJson'], $item['sortOrder'], $itemArchived, $item['id'],
                ]);
            } else {
                $insertItem->execute([
                    $item['id'], $category['id'], $item['publicId'], $item['name'], $item['description'],
                    $item['price'], $item['mediaId'], $item['metadataJson'], $item['sortOrder'], $itemArchived,
                ]);
            }

            $deleteOptions->execute([$item['id']]);
            foreach ($item['options'] as $option) {
                $insertOption->execute([
                    $option['id'], $item['id'], $option['label'], $option['price'],
                    $option['code'], $option['sortOrder'],
                ]);
            }
        }
    }

    $retired = array_keys(array_diff_key($oldMedia, $newMedia));
    $active = array_keys($newMedia);
    execute_for_ids(
        $pdo,
        'UPDATE media_assets SET retired_at = COALESCE(retired_at, UTC_TIMESTAMP(6)) WHERE id IN',
        $retired
    );
    execute_for_ids($pdo, 'UPDATE media_assets SET retired_at = NULL WHERE id IN', $active);
}

function snapshot_timestamp(PDO $pdo, int $revision): string
{
    $statement = $pdo->prepare('SELECT created_at FROM menu_revisions WHERE revision = ?');
    $statement->execute([$revision]);
    $value = $statement->fetchColumn();
    $time = is_string($value)
        ? new DateTimeImmutable($value, new DateTimeZone('UTC'))
        : new DateTimeImmutable('now', new DateTimeZone('UTC'));
    return $time->format('Y-m-d\\TH:i:s.u\\Z');
}

/** @param array<string, mixed> $config @return array<string, mixed> */
function build_public_snapshot(PDO $pdo, array $config, int $revision): array
{
    $categories = [];
    $indexes = [];
    $categoryRows = $pdo->query(
        'SELECT id, public_id, title, intro, layout FROM menu_categories '
        . 'WHERE archived_at IS NULL ORDER BY sort_order, id'
    )->fetchAll();
    foreach ($categoryRows as $row) {
        $indexes[(string) $row['id']] = count($categories);
        $categories[] = [
            'id' => (string) $row['public_id'],
            'title' => (string) $row['title'],
            'intro' => $row['intro'] !== null ? (string) $row['intro'] : null,
            'layout' => (string) $row['layout'],
            'items' => [],
        ];
    }

    $options = [];
    $optionRows = $pdo->query(
        'SELECT o.item_id, o.label, o.price_text, o.external_code '
        . 'FROM menu_item_options o JOIN menu_items i ON i.id = o.item_id '
        . 'JOIN menu_categories c ON c.id = i.category_id '
        . 'WHERE i.archived_at IS NULL AND c.archived_at IS NULL '
        . 'ORDER BY o.item_id, o.sort_order, o.id'
    )->fetchAll();
    foreach ($optionRows as $row) {
        $entry = ['label' => (string) $row['label'], 'price' => (string) $row['price_text']];
        if ($row['external_code'] !== null) {
            $entry['code'] = (string) $row['external_code'];
        }
        $options[(string) $row['item_id']][] = $entry;
    }

    $itemRows = $pdo->query(
        'SELECT i.id, i.category_id, i.public_id, i.name, i.description, i.price_text, i.metadata_json, '
        . 'm.rendition_300_filename, m.rendition_600_filename '
        . 'FROM menu_items i JOIN menu_categories c ON c.id = i.category_id '
        . 'LEFT JOIN media_assets m ON m.id = i.media_id '
        . 'WHERE i.archived_at IS NULL AND c.archived_at IS NULL '
        . 'ORDER BY c.sort_order, i.sort_order, i.id'
    )->fetchAll();
    foreach ($itemRows as $row) {
        $categoryId = (string) $row['category_id'];
        if (!isset($indexes[$categoryId])) {
            continue;
        }
        $item = [
            'id' => (string) $row['public_id'],
            'name' => (string) $row['name'],
            'description' => $row['description'] !== null ? (string) $row['description'] : null,
            'price' => $row['price_text'] !== null ? (string) $row['price_text'] : null,
            'metadata' => decoded_metadata((string) $row['metadata_json']),
            'options' => $options[(string) $row['id']] ?? [],
            'image' => null,
        ];
        if ($row['rendition_600_filename'] !== null) {
            $url300 = media_url($config, (string) $row['rendition_300_filename']);
            $url600 = media_url($config, (string) $row['rendition_600_filename']);
            $item['image'] = [
                'src' => $url600,
                'srcSet' => "$url300 300w, $url600 600w",
                'width' => 600,
                'height' => 600,
            ];
        }
        $categories[$indexes[$categoryId]]['items'][] = $item;
    }

    return [
        'schemaVersion' => 1,
        'revision' => $revision,
        'publishedAt' => snapshot_timestamp($pdo, $revision),
        'categories' => $categories,
    ];
}

function mark_publish_success(PDO $pdo, int $revision, string $sha): void
{
    $pdo->beginTransaction();
    try {
        $pdo->prepare(
            "UPDATE menu_revisions SET publish_state = 'published', snapshot_sha256 = ?, "
            . 'error_message = NULL, published_at = UTC_TIMESTAMP(6) WHERE revision = ?'
        )->execute([$sha, $revision]);
        $pdo->prepare(
            'UPDATE menu_state SET published_revision = GREATEST(published_revision, ?) WHERE id = 1'
        )->execute([$revision]);
        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $exception;
    }
}

function mark_publish_failure(PDO $pdo, int $revision): void
{
    try {
        $pdo->prepare(
            "UPDATE menu_revisions SET publish_state = 'failed', "
            . "error_message = 'Snapshot publication failed; retry after storage is restored.' WHERE revision = ?"
        )->execute([$revision]);
    } catch (Throwable $exception) {
        error_log('L Cafe admin could not record publish failure: ' . $exception->getMessage());
    }
}

/**
 * @param array<string, mixed> $config
 * @param array{id:int,username:string} $actor
 * @param array<string, mixed> $input
 * @return array<string, mixed>
 */
function save_menu_document(PDO $pdo, array $config, array $actor, array $input): array
{
    $document = normalize_menu_input($input);
    $prepared = null;
    $revision = 0;

    try {
        $pdo->beginTransaction();
        $stateStatement = $pdo->query('SELECT edit_revision FROM menu_state WHERE id = 1 FOR UPDATE');
        $state = $stateStatement->fetch();
        if (!is_array($state)) {
            throw new ApiException(503, 'schema_unavailable', 'The menu database has not been initialized.');
        }
        $currentRevision = (int) $state['edit_revision'];
        if ($document['baseRevision'] !== $currentRevision) {
            throw new ApiException(
                409,
                'revision_conflict',
                'The menu changed after it was loaded. Reload before saving.',
                ['currentRevision' => $currentRevision]
            );
        }

        assert_no_implicit_deletes($pdo, $document);
        assert_media_exists($pdo, $document);
        $oldMedia = referenced_media_set($pdo);
        persist_menu_document($pdo, $document, $oldMedia);

        $revision = $currentRevision + 1;
        $pdo->prepare('UPDATE menu_state SET edit_revision = ? WHERE id = 1')->execute([$revision]);
        $pdo->prepare(
            "INSERT INTO menu_revisions (revision, publish_state, actor_user_id) VALUES (?, 'pending', ?)"
        )->execute([$revision, $actor['id']]);
        $snapshot = build_public_snapshot($pdo, $config, $revision);
        $prepared = prepare_snapshot($config, $snapshot, $revision);
        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        if (is_array($prepared)) {
            discard_prepared_snapshot($prepared, true);
        }
        throw $exception;
    }

    try {
        promote_prepared_snapshot($config, $prepared);
        $published = true;
    } catch (Throwable $exception) {
        error_log('L Cafe admin snapshot promotion failed: ' . $exception->getMessage());
        discard_prepared_snapshot($prepared);
        mark_publish_failure($pdo, $revision);
        $published = false;
    }
    $publishState = $published ? 'published' : 'failed';
    if ($published) {
        try {
            mark_publish_success($pdo, $revision, $prepared['sha256']);
        } catch (Throwable $exception) {
            // current.json is already live. Treat that atomic rename as the
            // publication boundary and leave DB bookkeeping pending for retry.
            error_log('L Cafe admin could not record publish success: ' . $exception->getMessage());
            $publishState = 'published_status_pending';
        }
    }

    return [
        'revision' => $revision,
        'published' => $published,
        'publishState' => $publishState,
    ];
}

/** @return array<string, mixed> */
function publish_status(PDO $pdo): array
{
    $row = $pdo->query(
        'SELECT s.edit_revision, s.published_revision, r.publish_state, r.error_message, r.published_at '
        . 'FROM menu_state s LEFT JOIN menu_revisions r ON r.revision = s.edit_revision WHERE s.id = 1'
    )->fetch();
    if (!is_array($row)) {
        throw new ApiException(503, 'schema_unavailable', 'The menu database has not been initialized.');
    }
    return [
        'editRevision' => (int) $row['edit_revision'],
        'publishedRevision' => (int) $row['published_revision'],
        'state' => $row['publish_state'] !== null ? (string) $row['publish_state'] : 'not_published',
        'error' => $row['error_message'] !== null ? (string) $row['error_message'] : null,
        'publishedAt' => $row['published_at'] !== null ? (string) $row['published_at'] : null,
    ];
}

/** @param array<string, mixed> $config @return array<string, mixed> */
function retry_snapshot_publish(PDO $pdo, array $config): array
{
    $prepared = null;
    $revision = 0;
    try {
        $pdo->beginTransaction();
        $state = $pdo->query(
            'SELECT edit_revision, published_revision FROM menu_state WHERE id = 1 FOR UPDATE'
        )->fetch();
        if (!is_array($state) || (int) $state['edit_revision'] === 0) {
            throw new ApiException(409, 'nothing_to_publish', 'There is no saved menu revision to publish.');
        }
        $revision = (int) $state['edit_revision'];
        if ((int) $state['published_revision'] >= $revision) {
            $pdo->commit();
            return publish_status($pdo);
        }
        $pdo->prepare(
            "UPDATE menu_revisions SET publish_state = 'pending', error_message = NULL WHERE revision = ?"
        )->execute([$revision]);
        $snapshot = build_public_snapshot($pdo, $config, $revision);
        $prepared = prepare_snapshot($config, $snapshot, $revision);
        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        if (is_array($prepared)) {
            discard_prepared_snapshot($prepared);
        }
        throw $exception;
    }

    try {
        promote_prepared_snapshot($config, $prepared);
        $promoted = true;
    } catch (Throwable $exception) {
        error_log('L Cafe admin snapshot retry failed: ' . $exception->getMessage());
        discard_prepared_snapshot($prepared);
        mark_publish_failure($pdo, $revision);
        $promoted = false;
    }
    if ($promoted) {
        try {
            mark_publish_success($pdo, $revision, $prepared['sha256']);
        } catch (Throwable $exception) {
            error_log('L Cafe admin could not record retried publish success: ' . $exception->getMessage());
        }
    }
    return publish_status($pdo);
}
