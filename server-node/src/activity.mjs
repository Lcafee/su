import { isDeepStrictEqual } from 'node:util';
import { requireOwner, requireUser } from './auth.mjs';
import { ApiError } from './http.mjs';

export function recordActivity(db, actor, action, revision, details) {
  db.prepare(`
    INSERT INTO admin_activity
      (actor_user_id, actor_username, actor_role, action, revision, details_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(actor.id, actor.username, actor.role, action, revision, JSON.stringify(details), new Date().toISOString());
}

function entities(document) {
  const result = new Map();
  for (const category of document.categories) {
    const { id, title, intro, layout, archived, sortOrder } = category;
    result.set(id, { type: 'category', name: title, values: { title, intro, layout, archived, sortOrder } });
    for (const item of category.items) {
      const { name, description, price, mediaId, metadata, featured, options, archived: itemArchived, sortOrder: itemOrder } = item;
      result.set(item.id, {
        type: 'item', name,
        values: { categoryId: id, name, description, price, mediaId, metadata, featured, options, archived: itemArchived, sortOrder: itemOrder },
      });
    }
  }
  return result;
}

export function menuChanges(before, after) {
  const oldEntities = entities(before);
  const newEntities = entities(after);
  const changes = [];
  for (const id of new Set([...oldEntities.keys(), ...newEntities.keys()])) {
    const oldEntity = oldEntities.get(id);
    const newEntity = newEntities.get(id);
    const entity = newEntity || oldEntity;
    const fields = [];
    for (const field of Object.keys(entity.values)) {
      const oldValue = oldEntity?.values[field] ?? null;
      const newValue = newEntity?.values[field] ?? null;
      if (!isDeepStrictEqual(oldValue, newValue)) fields.push({
        field, before: oldValue, after: newValue,
        ...(field === 'categoryId' ? {
          beforeLabel: oldEntities.get(oldValue)?.name ?? null,
          afterLabel: newEntities.get(newValue)?.name ?? null,
        } : {}),
      });
    }
    if (fields.length) changes.push({
      id, type: entity.type, name: entity.name,
      operation: !oldEntity ? 'create' : !newEntity ? 'delete' : 'update', fields,
    });
  }
  return changes;
}

export function registerActivityRoutes(app, { db, config }) {
  app.get('/api/admin/activity', async (request) => {
    const { user } = requireUser(db, config, request);
    requireOwner(user);
    const before = request.query.before == null ? null : Number(request.query.before);
    if (before !== null && (!Number.isSafeInteger(before) || before < 1)) {
      throw new ApiError(422, 'validation_error', 'before must be a positive integer.');
    }
    const rows = db.prepare(`
      SELECT id, actor_username, action, revision, details_json, created_at
      FROM admin_activity
      WHERE actor_role = 'cashier' AND (? IS NULL OR id < ?)
      ORDER BY id DESC LIMIT 51
    `).all(before, before);
    return {
      entries: rows.slice(0, 50).map((row) => ({
        id: row.id, username: row.actor_username, action: row.action,
        revision: row.revision, createdAt: row.created_at, details: JSON.parse(row.details_json),
      })),
      nextCursor: rows.length > 50 ? rows[49].id : null,
    };
  });
}
