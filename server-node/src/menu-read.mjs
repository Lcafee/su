import { requireUser } from './auth.mjs';
import { ApiError } from './http.mjs';

function mediaUrl(filename) {
  return `/managed-media/${encodeURIComponent(filename)}`;
}

function decodedMetadata(json) {
  try {
    const value = JSON.parse(json);
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

export function loadMenuDocument(db) {
  const state = db.prepare(
    'SELECT edit_revision, published_revision FROM menu_state WHERE id = 1'
  ).get();
  if (!state) {
    throw new ApiError(503, 'schema_unavailable', 'The menu database has not been initialized.');
  }

  const categories = [];
  const categoryIndexes = new Map();
  const categoryRows = db.prepare(`
    SELECT id, public_id, title, intro, layout, sort_order, archived_at
    FROM menu_categories
    ORDER BY (archived_at IS NOT NULL), sort_order, id
  `).all();
  for (const row of categoryRows) {
    categoryIndexes.set(row.id, categories.length);
    categories.push({
      id: row.id,
      publicId: row.public_id,
      title: row.title,
      intro: row.intro ?? null,
      layout: row.layout,
      sortOrder: row.sort_order,
      archived: row.archived_at != null,
      items: [],
    });
  }

  const optionsByItem = new Map();
  const optionRows = db.prepare(`
    SELECT id, item_id, label, price_text, external_code, sort_order
    FROM menu_item_options
    ORDER BY item_id, sort_order, id
  `).all();
  for (const row of optionRows) {
    const entries = optionsByItem.get(row.item_id) || [];
    entries.push({
      id: row.id,
      label: row.label,
      price: row.price_text,
      code: row.external_code ?? null,
      sortOrder: row.sort_order,
    });
    optionsByItem.set(row.item_id, entries);
  }

  const itemRows = db.prepare(`
    SELECT i.id, i.category_id, i.public_id, i.name, i.description, i.price_text,
           i.media_id, i.metadata_json, i.sort_order, i.archived_at,
           m.width, m.height, m.rendition_300_filename, m.rendition_600_filename
    FROM menu_items i
    LEFT JOIN media_assets m ON m.id = i.media_id
    ORDER BY i.category_id, (i.archived_at IS NOT NULL), i.sort_order, i.id
  `).all();

  for (const row of itemRows) {
    const categoryIndex = categoryIndexes.get(row.category_id);
    if (categoryIndex == null) continue;
    const media = row.media_id != null && row.rendition_600_filename != null
      ? {
          id: row.media_id,
          width: row.width,
          height: row.height,
          urls: {
            '300': mediaUrl(row.rendition_300_filename),
            '600': mediaUrl(row.rendition_600_filename),
          },
        }
      : null;
    categories[categoryIndex].items.push({
      id: row.id,
      publicId: row.public_id,
      name: row.name,
      description: row.description ?? null,
      price: row.price_text ?? null,
      mediaId: row.media_id ?? null,
      media,
      metadata: decodedMetadata(row.metadata_json),
      sortOrder: row.sort_order,
      archived: row.archived_at != null,
      options: optionsByItem.get(row.id) || [],
    });
  }

  return {
    revision: state.edit_revision,
    publishedRevision: state.published_revision,
    categories,
  };
}

export function publishStatus(db) {
  const row = db.prepare(`
    SELECT s.edit_revision, s.published_revision,
           r.publish_state, r.error_message, r.published_at
    FROM menu_state s
    LEFT JOIN menu_revisions r ON r.revision = s.edit_revision
    WHERE s.id = 1
  `).get();
  if (!row) {
    throw new ApiError(503, 'schema_unavailable', 'The menu database has not been initialized.');
  }
  return {
    editRevision: row.edit_revision,
    publishedRevision: row.published_revision,
    state: row.publish_state ?? 'not_published',
    error: row.error_message ?? null,
    publishedAt: row.published_at ?? null,
  };
}

export function registerReadOnlyMenuRoutes(app, { db, config }) {
  app.get('/api/admin/menu', async (request) => {
    requireUser(db, config, request);
    return loadMenuDocument(db);
  });

  app.get('/api/admin/publish-status', async (request) => {
    requireUser(db, config, request);
    return publishStatus(db);
  });
}
