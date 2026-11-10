import fs from 'node:fs/promises';
import path from 'node:path';
import { UPLOAD_DIR } from '@/lib/db';

const TYPES = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

export async function GET(_req, { params }) {
  const { file } = await params;
  const m = /^[a-f0-9]{32}\.(jpg|png|webp)$/.exec(file);
  if (!m) return new Response('Not found', { status: 404 });
  try {
    const data = await fs.readFile(path.join(UPLOAD_DIR, file));
    return new Response(data, {
      headers: {
        'Content-Type': TYPES[m[1]],
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
