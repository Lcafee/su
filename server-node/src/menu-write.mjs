import crypto from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

import { requireCsrf, requireOwner, requireUser } from './auth.mjs';
import { ApiError, booleanValue, optionalText, requiredText, requireObjectBody } from './http.mjs';
import { publishStatus } from './menu-read.mjs';
import {
  discardPreparedSnapshot,
  prepareSnapshot,
  promotePreparedSnapshot,
  snapshotTimestamp,
} from './snapshot.mjs';

function sqlNow(date = new Date()) {
  return date.toISOString().replace('T', ' ').replace('Z', '000');
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizedUuid(value, field) {
  if (value == null || value === '') return crypto.randomUUID();
  if (typeof value !== 'string' || !isUuid(value)) {
    throw new ApiError(422, 'validation_error', `${field} must be a UUID.`, { field });
  }
  return value.toLowerCase();
}

function normalizedPublicId(value, field) {
  const id = requiredText(value, field, 100);
  if (!/^[a-z0-9][a-z0-9_-]{0,99}$/.test(id)) {
    throw new ApiError(
      422,
      'validation_error',
      `${field} may contain only lowercase letters, numbers, underscores, and hyphens.`,
      { field },
    );
  }
  return id;
}

function normalizeMenuInput(input) {
  const baseRevision = input.baseRevision;
  if (!Number.isSafeInteger(baseRevision) || baseRevision < 0) {
    throw new ApiError(422, 'validation_error', 'baseRevision must be a non-negative integer.');
  }
  if (!Array.isArray(input.categories) || input.categories.length > 100) {
    throw new ApiError(422, 'validation_error', 'categories must be a list with at most 100 entries.');
  }

  const categoryIds = new Set();
  const categoryPublicIds = new Set();
  const itemIds = new Set();
  const itemPublicIds = new Set();
  const optionIds = new Set();
  let totalItems = 0;

  const categories = input.categories.map((rawCategory, categoryIndex) => {
    const fieldPath = `categories[${categoryIndex}]`;
    if (!rawCategory || typeof rawCategory !== 'object' || Array.isArray(rawCategory)) {
      throw new ApiError(422, 'validation_error', `${fieldPath} must be an object.`);
    }
    const id = normalizedUuid(rawCategory.id, `${fieldPath}.id`);
    const publicId = normalizedPublicId(rawCategory.publicId, `${fieldPath}.publicId`);
    if (categoryIds.has(id) || categoryPublicIds.has(publicId)) {
      throw new ApiError(422, 'validation_error', 'Category identifiers must be unique.');
    }
    categoryIds.add(id);
    categoryPublicIds.add(publicId);

    const layout = requiredText(rawCategory.layout, `${fieldPath}.layout`, 16);
    if (layout !== 'grid' && layout !== 'addons') {
      throw new ApiError(422, 'validation_error', `${fieldPath}.layout must be grid or addons.`);
    }
    if (!Array.isArray(rawCategory.items)) {
      throw new ApiError(422, 'validation_error', `${fieldPath}.items must be a list.`);
    }
    totalItems += rawCategory.items.length;
    if (totalItems > 1000) {
      throw new ApiError(422, 'validation_error', 'The menu may contain at most 1000 items.');
    }

    const items = rawCategory.items.map((rawItem, itemIndex) => {
      const itemPath = `${fieldPath}.items[${itemIndex}]`;
      if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) {
        throw new ApiError(422, 'validation_error', `${itemPath} must be an object.`);
      }
      const itemId = normalizedUuid(rawItem.id, `${itemPath}.id`);
      const itemPublicId = normalizedPublicId(rawItem.publicId, `${itemPath}.publicId`);
      if (itemIds.has(itemId) || itemPublicIds.has(itemPublicId)) {
        throw new ApiError(422, 'validation_error', 'Item identifiers must be unique.');
      }
      itemIds.add(itemId);
      itemPublicIds.add(itemPublicId);

      let mediaId = rawItem.mediaId ?? null;
      if (mediaId !== null) {
        if (typeof mediaId !== 'string' || !isUuid(mediaId)) {
          throw new ApiError(422, 'validation_error', `${itemPath}.mediaId must be null or a UUID.`);
        }
        mediaId = mediaId.toLowerCase();
      }

      const metadata = rawItem.metadata ?? [];
      if (!metadata || typeof metadata !== 'object') {
        throw new ApiError(422, 'validation_error', `${itemPath}.metadata must be an object or list.`);
      }
      const metadataJson = JSON.stringify(metadata);
      if (Buffer.byteLength(metadataJson, 'utf8') > 16_384) {
        throw new ApiError(422, 'validation_error', `${itemPath}.metadata is too large.`);
      }

      const rawOptions = rawItem.options ?? [];
      if (!Array.isArray(rawOptions) || rawOptions.length > 50) {
        throw new ApiError(422, 'validation_error', `${itemPath}.options must be a list of at most 50 entries.`);
      }
      const options = rawOptions.map((rawOption, optionIndex) => {
        const optionPath = `${itemPath}.options[${optionIndex}]`;
        if (!rawOption || typeof rawOption !== 'object' || Array.isArray(rawOption)) {
          throw new ApiError(422, 'validation_error', `${optionPath} must be an object.`);
        }
        const optionId = normalizedUuid(rawOption.id, `${optionPath}.id`);
        if (optionIds.has(optionId)) {
          throw new ApiError(422, 'validation_error', 'Option identifiers must be unique.');
        }
        optionIds.add(optionId);
        return {
          id: optionId,
          label: requiredText(rawOption.label, `${optionPath}.label`, 191),
          price: requiredText(rawOption.price, `${optionPath}.price`, 64),
          code: optionalText(rawOption.code, `${optionPath}.code`, 64),
          sortOrder: optionIndex,
        };
      });

      return {
        id: itemId,
        publicId: itemPublicId,
        name: requiredText(rawItem.name, `${itemPath}.name`, 191),
        description: optionalText(rawItem.description, `${itemPath}.description`, 4000),
        price: optionalText(rawItem.price, `${itemPath}.price`, 64),
        mediaId,
        metadata,
        metadataJson,
        archived: booleanValue(rawItem.archived, `${itemPath}.archived`),
        sortOrder: itemIndex,
        options,
      };
    });

    return {
      id,
      publicId,
      title: requiredText(rawCategory.title, `${fieldPath}.title`, 191),
      intro: optionalText(rawCategory.intro, `${fieldPath}.intro`, 4000),
      layout,
      archived: booleanValue(rawCategory.archived, `${fieldPath}.archived`),
      sortOrder: categoryIndex,
      items,
    };
  });

  return { baseRevision, categories };
}

function idSet(db, table) {
  if (table !== 'menu_categories' && table !== 'menu_items') throw new Error('unsupported identifier table');
  return new Set(db.prepare(`SELECT id FROM ${table}`).all().map((row) => row.id));
}

function assertNoImplicitDeletes(db, document) {
  const submittedCategories = new Set(document.categories.map((category) => category.id));
  const submittedItems = new Set(document.categories.flatMap((category) => category.items.map((item) => item.id)));
  const missingCategoryIds = [...idSet(db, 'menu_categories')].filter((id) => !submittedCategories.has(id));
  const missingItemIds = [...idSet(db, 'menu_items')].filter((id) => !submittedItems.has(id));
  if (missingCategoryIds.length || missingItemIds.length) {
    throw new ApiError(
      422,
      'archive_required',
      'Existing categories and items must be archived, not omitted.',
      { missingCategoryIds, missingItemIds },
    );
  }
}

function cashierAdvancedFieldError(field) {
  throw new ApiError(
    403,
    'permission_denied',
    'Cashier accounts cannot change advanced menu fields.',
    { field },
  );
}

function assertActorCanSaveMenu(db, actor, document) {
  const submittedCategories = new Map(document.categories.map((category) => [category.id, category]));
  const submittedItems = new Map(
    document.categories.flatMap((category) => category.items.map((item) => [item.id, item])),
  );
  const storedCategories = new Map(db.prepare(
    'SELECT id, public_id, intro, layout FROM menu_categories'
  ).all().map((row) => [row.id, row]));
  const storedItems = new Map(db.prepare(
    'SELECT id, public_id, metadata_json FROM menu_items'
  ).all().map((row) => [row.id, row]));

  for (const [id, stored] of storedCategories) {
    if (submittedCategories.get(id)?.publicId !== stored.public_id) {
      throw new ApiError(422, 'immutable_identifier', 'Existing category identifiers cannot be changed.');
    }
  }
  for (const [id, stored] of storedItems) {
    if (submittedItems.get(id)?.publicId !== stored.public_id) {
      throw new ApiError(422, 'immutable_identifier', 'Existing item identifiers cannot be changed.');
    }
  }

  if (actor.role === 'owner') return;
  if (actor.role !== 'cashier') {
    throw new ApiError(403, 'permission_denied', 'The admin role cannot edit the menu.');
  }

  const storedOptions = new Map();
  for (const row of db.prepare(`
    SELECT id, item_id, label, price_text, external_code, sort_order
    FROM menu_item_options ORDER BY item_id, sort_order, id
  `).all()) {
    const entries = storedOptions.get(row.item_id) || [];
    entries.push({
      id: row.id,
      label: row.label,
      price: row.price_text,
      code: row.external_code ?? null,
      sortOrder: row.sort_order,
    });
    storedOptions.set(row.item_id, entries);
  }

  for (const [id, submitted] of submittedCategories) {
    const stored = storedCategories.get(id);
    if (!stored) {
      if (submitted.intro !== null || submitted.layout !== 'grid') cashierAdvancedFieldError('category');
      continue;
    }
    if (submitted.intro !== (stored.intro ?? null) || submitted.layout !== stored.layout) {
      cashierAdvancedFieldError('category');
    }
  }

  for (const [id, submitted] of submittedItems) {
    const stored = storedItems.get(id);
    if (!stored) {
      if (!isDeepStrictEqual(submitted.metadata, []) || submitted.options.length !== 0) {
        cashierAdvancedFieldError('item');
      }
      continue;
    }
    let storedMetadata;
    try { storedMetadata = JSON.parse(stored.metadata_json); } catch { storedMetadata = []; }
    if (!isDeepStrictEqual(submitted.metadata, storedMetadata)
        || !isDeepStrictEqual(submitted.options, storedOptions.get(id) || [])) {
      cashierAdvancedFieldError('item');
    }
  }
}

function assertMediaExists(db, document) {
  const ids = new Set();
  for (const category of document.categories) {
    for (const item of category.items) if (item.mediaId) ids.add(item.mediaId);
  }
  if (ids.size === 0) return;
  const found = new Set();
  const lookup = db.prepare('SELECT id FROM media_assets WHERE id = ?');
  for (const id of ids) if (lookup.get(id)) found.add(id);
  if (found.size !== ids.size) {
    throw new ApiError(422, 'validation_error', 'One or more selected media assets do not exist.');
  }
}

function referencedMediaSet(db) {
  return new Set(
    db.prepare('SELECT DISTINCT media_id FROM menu_items WHERE media_id IS NOT NULL').all().map((row) => row.media_id),
  );
}

function persistMenuDocument(db, document, oldMedia) {
  const existingCategories = idSet(db, 'menu_categories');
  const existingItems = idSet(db, 'menu_items');
  const now = sqlNow();

  const insertCategory = db.prepare(`
    INSERT INTO menu_categories
      (id, public_id, title, intro, layout, sort_order, archived_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const updateCategory = db.prepare(`
    UPDATE menu_categories
    SET public_id = ?, title = ?, intro = ?, layout = ?, sort_order = ?, archived_at = ?, updated_at = ?
    WHERE id = ?
  `);
  const insertItem = db.prepare(`
    INSERT INTO menu_items
      (id, category_id, public_id, name, description, price_text, media_id, metadata_json,
       sort_order, archived_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const updateItem = db.prepare(`
    UPDATE menu_items
    SET category_id = ?, public_id = ?, name = ?, description = ?, price_text = ?, media_id = ?,
        metadata_json = ?, sort_order = ?, archived_at = ?, updated_at = ?
    WHERE id = ?
  `);
  const deleteOptions = db.prepare('DELETE FROM menu_item_options WHERE item_id = ?');
  const insertOption = db.prepare(`
    INSERT INTO menu_item_options
      (id, item_id, label, price_text, external_code, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const currentCategoryArchive = db.prepare('SELECT archived_at FROM menu_categories WHERE id = ?');
  const currentItemArchive = db.prepare('SELECT archived_at FROM menu_items WHERE id = ?');
  const newMedia = new Set();

  for (const category of document.categories) {
    const oldArchive = existingCategories.has(category.id)
      ? currentCategoryArchive.get(category.id)?.archived_at ?? null
      : null;
    const archivedAt = category.archived ? (oldArchive || now) : null;
    if (existingCategories.has(category.id)) {
      updateCategory.run(
        category.publicId, category.title, category.intro, category.layout,
        category.sortOrder, archivedAt, now, category.id,
      );
    } else {
      insertCategory.run(
        category.id, category.publicId, category.title, category.intro, category.layout,
        category.sortOrder, archivedAt, now, now,
      );
    }

    for (const item of category.items) {
      if (item.mediaId) newMedia.add(item.mediaId);
      const oldItemArchive = existingItems.has(item.id)
        ? currentItemArchive.get(item.id)?.archived_at ?? null
        : null;
      const itemArchivedAt = item.archived ? (oldItemArchive || now) : null;
      if (existingItems.has(item.id)) {
        updateItem.run(
          category.id, item.publicId, item.name, item.description, item.price, item.mediaId,
          item.metadataJson, item.sortOrder, itemArchivedAt, now, item.id,
        );
      } else {
        insertItem.run(
          item.id, category.id, item.publicId, item.name, item.description, item.price, item.mediaId,
          item.metadataJson, item.sortOrder, itemArchivedAt, now, now,
        );
      }

      deleteOptions.run(item.id);
      for (const option of item.options) {
        insertOption.run(
          option.id, item.id, option.label, option.price, option.code,
          option.sortOrder, now, now,
        );
      }
    }
  }

  const retire = db.prepare(
    'UPDATE media_assets SET retired_at = COALESCE(retired_at, ?) WHERE id = ?'
  );
  for (const id of oldMedia) if (!newMedia.has(id)) retire.run(now, id);
  const activate = db.prepare(
    'UPDATE media_assets SET retired_at = NULL, orphan_candidate_at = NULL WHERE id = ?'
  );
  for (const id of newMedia) activate.run(id);
}

function decodedMetadata(json) {
  try {
    const value = JSON.parse(json);
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

function buildPublicSnapshot(db, revision) {
  const categories = [];
  const categoryIndexes = new Map();
  for (const row of db.prepare(`
    SELECT id, public_id, title, intro, layout
    FROM menu_categories WHERE archived_at IS NULL ORDER BY sort_order, id
  `).all()) {
    categoryIndexes.set(row.id, categories.length);
    categories.push({
      id: row.public_id,
      title: row.title,
      intro: row.intro ?? null,
      layout: row.layout,
      items: [],
    });
  }

  const optionsByItem = new Map();
  for (const row of db.prepare(`
    SELECT o.item_id, o.label, o.price_text, o.external_code
    FROM menu_item_options o
    JOIN menu_items i ON i.id = o.item_id
    JOIN menu_categories c ON c.id = i.category_id
    WHERE i.archived_at IS NULL AND c.archived_at IS NULL
    ORDER BY o.item_id, o.sort_order, o.id
  `).all()) {
    const entries = optionsByItem.get(row.item_id) || [];
    const entry = { label: row.label, price: row.price_text };
    if (row.external_code != null) entry.code = row.external_code;
    entries.push(entry);
    optionsByItem.set(row.item_id, entries);
  }

  for (const row of db.prepare(`
    SELECT i.id, i.category_id, i.public_id, i.name, i.description, i.price_text,
           i.metadata_json, m.rendition_300_filename, m.rendition_600_filename
    FROM menu_items i
    JOIN menu_categories c ON c.id = i.category_id
    LEFT JOIN media_assets m ON m.id = i.media_id
    WHERE i.archived_at IS NULL AND c.archived_at IS NULL
    ORDER BY c.sort_order, i.sort_order, i.id
  `).all()) {
    const categoryIndex = categoryIndexes.get(row.category_id);
    if (categoryIndex == null) continue;
    const item = {
      id: row.public_id,
      name: row.name,
      description: row.description ?? null,
      price: row.price_text ?? null,
      metadata: decodedMetadata(row.metadata_json),
      options: optionsByItem.get(row.id) || [],
      image: null,
    };
    if (row.rendition_600_filename != null) {
      const url300 = `/managed-media/${encodeURIComponent(row.rendition_300_filename)}`;
      const url600 = `/managed-media/${encodeURIComponent(row.rendition_600_filename)}`;
      item.image = {
        src: url600,
        srcSet: `${url300} 300w, ${url600} 600w`,
        width: 600,
        height: 600,
      };
    }
    categories[categoryIndex].items.push(item);
  }

  return {
    schemaVersion: 1,
    revision,
    publishedAt: snapshotTimestamp(db, revision),
    categories,
  };
}

function markPublishSuccess(db, revision, sha) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const now = sqlNow();
    db.prepare(`
      UPDATE menu_revisions
      SET publish_state = 'published', snapshot_sha256 = ?, error_message = NULL, published_at = ?
      WHERE revision = ?
    `).run(sha, now, revision);
    db.prepare(`
      UPDATE menu_state
      SET published_revision = CASE WHEN published_revision > ? THEN published_revision ELSE ? END,
          updated_at = ?
      WHERE id = 1
    `).run(revision, revision, now);
    db.exec('COMMIT');
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch {}
    throw error;
  }
}

function markPublishFailure(db, revision) {
  try {
    db.prepare(`
      UPDATE menu_revisions
      SET publish_state = 'failed',
          error_message = 'Snapshot publication failed; retry after storage is restored.'
      WHERE revision = ?
    `).run(revision);
  } catch {
    // The operation already failed at the filesystem boundary. Do not mask it.
  }
}

function saveMenuWithLock(db, config, actor, input) {
  const document = normalizeMenuInput(input);
  let prepared = null;
  let revision = 0;

  db.exec('BEGIN IMMEDIATE');
  try {
    const state = db.prepare('SELECT edit_revision FROM menu_state WHERE id = 1').get();
    if (!state) {
      throw new ApiError(503, 'schema_unavailable', 'The menu database has not been initialized.');
    }
    const currentRevision = state.edit_revision;
    if (document.baseRevision !== currentRevision) {
      throw new ApiError(
        409,
        'revision_conflict',
        'The menu changed after it was loaded. Reload before saving.',
        { currentRevision },
      );
    }

    assertNoImplicitDeletes(db, document);
    assertActorCanSaveMenu(db, actor, document);
    assertMediaExists(db, document);
    const oldMedia = referencedMediaSet(db);
    persistMenuDocument(db, document, oldMedia);

    revision = currentRevision + 1;
    const now = sqlNow();
    db.prepare('UPDATE menu_state SET edit_revision = ?, updated_at = ? WHERE id = 1')
      .run(revision, now);
    db.prepare(`
      INSERT INTO menu_revisions
        (revision, publish_state, actor_user_id, created_at, lifecycle_retained)
      VALUES (?, 'pending', ?, ?, 0)
    `).run(revision, actor.id, now);
    prepared = prepareSnapshot(config, buildPublicSnapshot(db, revision), revision);
    db.exec('COMMIT');
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch {}
    if (prepared) discardPreparedSnapshot(prepared, { discardArchive: true });
    throw error;
  }

  let published = false;
  try {
    promotePreparedSnapshot(config, prepared);
    published = true;
  } catch {
    discardPreparedSnapshot(prepared);
    markPublishFailure(db, revision);
  }

  let publishState = published ? 'published' : 'failed';
  if (published) {
    try {
      markPublishSuccess(db, revision, prepared.sha256);
    } catch {
      publishState = 'published_status_pending';
    }
  }

  return { revision, published, publishState };
}

function retryPublishWithLock(db, config) {
  let prepared = null;
  let revision = 0;
  db.exec('BEGIN IMMEDIATE');
  try {
    const state = db.prepare(
      'SELECT edit_revision, published_revision FROM menu_state WHERE id = 1'
    ).get();
    if (!state || state.edit_revision === 0) {
      throw new ApiError(409, 'nothing_to_publish', 'There is no saved menu revision to publish.');
    }
    revision = state.edit_revision;
    if (state.published_revision >= revision) {
      db.exec('COMMIT');
      return publishStatus(db);
    }
    db.prepare(
      "UPDATE menu_revisions SET publish_state = 'pending', error_message = NULL WHERE revision = ?"
    ).run(revision);
    prepared = prepareSnapshot(config, buildPublicSnapshot(db, revision), revision);
    db.exec('COMMIT');
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch {}
    if (prepared) discardPreparedSnapshot(prepared);
    throw error;
  }

  let promoted = false;
  try {
    promotePreparedSnapshot(config, prepared);
    promoted = true;
  } catch {
    discardPreparedSnapshot(prepared);
    markPublishFailure(db, revision);
  }
  if (promoted) {
    try { markPublishSuccess(db, revision, prepared.sha256); } catch {}
  }
  return publishStatus(db);
}

export function registerMenuWriteRoutes(app, { db, config, mutationLock }) {
  app.put('/api/admin/menu', async (request, reply) => {
    const context = requireUser(db, config, request);
    requireCsrf(config, request, context);
    const input = requireObjectBody(request);
    const result = await mutationLock.run(() => saveMenuWithLock(db, config, context.user, input));
    reply.code(result.published ? 200 : 202);
    return result;
  });

  app.post('/api/admin/publish-retry', async (request) => {
    const context = requireUser(db, config, request);
    requireOwner(context.user);
    requireCsrf(config, request, context);
    return mutationLock.run(() => retryPublishWithLock(db, config));
  });
}
