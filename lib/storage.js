import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { put, del } from '@vercel/blob';
import { UPLOAD_DIR } from '@/lib/db';

/*
 * Image storage.
 * - Production (Vercel): set BLOB_READ_WRITE_TOKEN (added automatically when you
 *   connect a Blob store to the project). Images are stored in Vercel Blob and the
 *   full public URL is saved in the database.
 * - Local dev: images are saved to data/uploads and the file name is saved.
 */
const USE_BLOB = !!process.env.BLOB_READ_WRITE_TOKEN;

const IMAGE_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_BYTES = 3 * 1024 * 1024;

/** Validate and store an uploaded image. Returns the value to save in the DB. */
export async function saveImage(file) {
  const ext = IMAGE_TYPES[file.type];
  if (!ext) throw new Error('Image must be JPG, PNG or WebP.');
  if (file.size > MAX_BYTES) throw new Error('Image must be smaller than 3 MB.');
  const name = `${crypto.randomBytes(16).toString('hex')}.${ext}`;
  const data = Buffer.from(await file.arrayBuffer());

  if (USE_BLOB) {
    const blob = await put(`uploads/${name}`, data, { access: 'public', contentType: file.type });
    return blob.url;
  }
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, name), data);
  return name;
}

/** Delete a stored image. Never throws (a leftover file is not worth failing a request). */
export async function deleteImage(value) {
  if (!value) return;
  try {
    if (/^https?:\/\//.test(value)) {
      if (USE_BLOB) await del(value);
    } else {
      await fs.rm(path.join(UPLOAD_DIR, path.basename(value)), { force: true });
    }
  } catch (e) {
    console.error('Failed to delete image', value, e);
  }
}
