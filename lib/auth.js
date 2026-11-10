import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';

const COOKIE = 'mb_session';
const TTL_DAYS = 14;

export async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = Date.now() + TTL_DAYS * 86400 * 1000;
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(
    token,
    userId,
    expires
  );
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: TTL_DAYS * 86400,
    secure: process.env.COOKIE_SECURE === 'true',
  });
}

export async function getUser() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT u.id, u.email, u.role FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > ?`
    )
    .get(token, Date.now());
  return row || null;
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  jar.delete(COOKIE);
}

export async function requireSeller() {
  const user = await getUser();
  if (!user || user.role !== 'seller') redirect('/login');
  const shop = db.prepare('SELECT * FROM shops WHERE user_id = ?').get(user.id);
  if (!shop) redirect('/login');
  return { user, shop };
}

export async function requireAdmin() {
  const user = await getUser();
  if (!user || user.role !== 'admin') redirect('/login');
  return user;
}
