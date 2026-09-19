import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import sharp from 'sharp';

import { requireCsrf, requireUser } from './auth.mjs';
import { ApiError } from './http.mjs';

const FORMAT_TO_MIME = Object.freeze({
  jpeg: ['image/jpeg', 'jpg'],
  png: ['image/png', 'png'],
  webp: ['image/webp', 'webp'],
});

function sqlNow(date = new Date()) {
  return date.toISOString().replace('T', ' ').replace('Z', '000');
}

function mediaUrl(filename) {
  return `/managed-media/${encodeURIComponent(filename)}`;
}

function mediaPayload(row) {
  return {
    id: row.id,
    width: row.width,
    height: row.height,
    urls: {
      '300': mediaUrl(row.rendition_300_filename),
      '600': mediaUrl(row.rendition_600_filename),
    },
  };
}

function existingMediaByHash(db, sha) {
  const row = db.prepare(`
    SELECT id, width, height, rendition_300_filename, rendition_600_filename
    FROM media_assets WHERE source_sha256 = ? LIMIT 1
  `).get(sha);
  if (!row) return null;
  db.prepare(
    'UPDATE media_assets SET retired_at = NULL, orphan_candidate_at = NULL WHERE id = ?'
  ).run(row.id);
  return mediaPayload(row);
}

function writableDirectory(directory, purpose) {
  const resolved = fs.realpathSync(directory);
  if (!fs.statSync(resolved).isDirectory()) {
    throw new ApiError(503, 'storage_unavailable', `${purpose} storage is unavailable.`);
  }
  try {
    fs.accessSync(resolved, fs.constants.R_OK | fs.constants.W_OK);
  } catch {
    throw new ApiError(503, 'storage_unavailable', `${purpose} storage is unavailable.`);
  }
  return resolved;
}

function reserveTemp(directory, prefix) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const file = path.join(directory, `${prefix}${crypto.randomBytes(12).toString('hex')}`);
    try {
      const fd = fs.openSync(file, 'wx', 0o600);
      fs.closeSync(fd);
      return file;
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
    }
  }
  throw new Error('Could not reserve media staging storage.');
}

function durableWrite(file, bytes, mode) {
  const fd = fs.openSync(file, 'w', mode);
  try {
    let offset = 0;
    while (offset < bytes.length) {
      offset += fs.writeSync(fd, bytes, offset, bytes.length - offset, offset);
    }
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.chmodSync(file, mode);
}

function removeIfExists(file) {
  try { fs.unlinkSync(file); } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

function promoteImmutable(temp, final, mode) {
  if (fs.existsSync(final)) {
    removeIfExists(temp);
  } else {
    try {
      fs.renameSync(temp, final);
    } catch (error) {
      if (fs.existsSync(final)) removeIfExists(temp);
      else throw error;
    }
  }
  fs.chmodSync(final, mode);
}

async function processRendition(sourceBytes, format, size, quality) {
  let pipeline = sharp(sourceBytes, { failOn: 'error' });
  if (format === 'jpeg') pipeline = pipeline.rotate();
  return pipeline
    .resize(size, size, { fit: 'cover', position: 'centre' })
    .webp({ quality })
    .toBuffer();
}

async function importMediaBuffer(db, config, sourceBytes) {
  if (!Buffer.isBuffer(sourceBytes) || sourceBytes.length < 1) {
    throw new ApiError(422, 'upload_failed', 'The image source is invalid.');
  }
  if (sourceBytes.length > config.uploads.maxBytes) {
    throw new ApiError(413, 'upload_too_large', 'The uploaded image exceeds the configured size limit.');
  }

  let metadata;
  try {
    metadata = await sharp(sourceBytes, { failOn: 'error' }).metadata();
  } catch {
    throw new ApiError(415, 'unsupported_media', 'The uploaded file is not a readable image.');
  }
  const format = metadata.format;
  const type = FORMAT_TO_MIME[format];
  if (!type) {
    throw new ApiError(415, 'unsupported_media', 'Only JPEG, PNG, and WebP images are accepted.');
  }
  const width = Number(metadata.width || 0);
  const height = Number(metadata.height || 0);
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height)
      || width < 1 || height < 1 || width * height > config.uploads.maxPixels) {
    throw new ApiError(413, 'image_dimensions_too_large', 'The image dimensions exceed the configured limit.');
  }

  const sha = crypto.createHash('sha256').update(sourceBytes).digest('hex');
  const existing = existingMediaByHash(db, sha);
  if (existing) return existing;

  const publicDir = writableDirectory(config.paths.managedMedia, 'Managed media');
  const originalDir = writableDirectory(config.paths.mediaOriginals, 'Original media');
  const filenames = {};
  const quality = Math.min(100, Math.max(1, config.uploads.webpQuality));

  for (const size of [300, 600]) {
    const bytes = await processRendition(sourceBytes, format, size, quality);
    const filename = `${sha}-${size}.webp`;
    const temp = reserveTemp(publicDir, '.media-');
    try {
      durableWrite(temp, bytes, 0o644);
      promoteImmutable(temp, path.join(publicDir, filename), 0o644);
      filenames[size] = filename;
    } finally {
      removeIfExists(temp);
    }
  }

  const [mime, extension] = type;
  const originalFilename = `${sha}.${extension}`;
  const originalPath = path.join(originalDir, originalFilename);
  if (!fs.existsSync(originalPath)) {
    const temp = reserveTemp(originalDir, '.original-');
    try {
      durableWrite(temp, sourceBytes, 0o600);
      promoteImmutable(temp, originalPath, 0o600);
    } finally {
      removeIfExists(temp);
    }
  }

  const id = crypto.randomUUID();
  try {
    db.prepare(`
      INSERT INTO media_assets
        (id, source_sha256, source_mime, source_extension, width, height, byte_size,
         rendition_300_filename, rendition_600_filename, original_filename,
         retired_at, orphan_candidate_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?)
    `).run(
      id, sha, mime, extension, width, height, sourceBytes.length,
      filenames[300], filenames[600], originalFilename, sqlNow(),
    );
  } catch (error) {
    const raced = existingMediaByHash(db, sha);
    if (raced) return raced;
    throw error;
  }

  return {
    id,
    width,
    height,
    urls: {
      '300': mediaUrl(filenames[300]),
      '600': mediaUrl(filenames[600]),
    },
  };
}

export function registerMediaRoute(app, { db, config, mutationLock }) {
  app.post('/api/admin/media', async (request, reply) => {
    const context = requireUser(db, config, request);
    requireCsrf(config, request, context);

    let part;
    try {
      part = await request.file({
        limits: { fileSize: config.uploads.maxBytes, files: 1, fields: 0, parts: 1 },
      });
    } catch (error) {
      if (error instanceof app.multipartErrors.RequestFileTooLargeError) {
        throw new ApiError(413, 'upload_too_large', 'The uploaded image exceeds the configured size limit.');
      }
      throw new ApiError(422, 'upload_failed', 'The image upload did not complete.');
    }
    if (!part || part.type !== 'file' || part.fieldname !== 'image') {
      throw new ApiError(422, 'upload_required', 'A single image upload is required.');
    }

    let sourceBytes;
    try {
      sourceBytes = await part.toBuffer();
    } catch (error) {
      if (error instanceof app.multipartErrors.RequestFileTooLargeError || part.file?.truncated) {
        throw new ApiError(413, 'upload_too_large', 'The uploaded image exceeds the configured size limit.');
      }
      throw new ApiError(422, 'upload_failed', 'The image upload did not complete.');
    }
    if (part.file?.truncated) {
      throw new ApiError(413, 'upload_too_large', 'The uploaded image exceeds the configured size limit.');
    }

    const media = await mutationLock.run(() => importMediaBuffer(db, config, sourceBytes));
    reply.code(201);
    return { media };
  });
}
