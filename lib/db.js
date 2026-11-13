import { createClient } from '@libsql/client';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/*
 * Database: libSQL (SQLite-compatible).
 * - Production (Vercel): set TURSO_DATABASE_URL + TURSO_AUTH_TOKEN to use a Turso database.
 * - Local dev: no setup needed, uses the file data/mainbazar.db.
 *
 * All queries are async. The API mimics the small better-sqlite3 subset the app uses:
 *   await db.prepare(sql).get(...args) / .all(...args) / .run(...args)
 *   await db.transaction(async (tx) => { await tx.prepare(sql).run(...) })
 */

// On Vercel the app directory is read-only; only /tmp is writable. These are only
// used as a fallback when Turso / Vercel Blob aren't configured (data there is temporary).
const ON_VERCEL = !!process.env.VERCEL;
export const DATA_DIR = ON_VERCEL ? '/tmp/data' : path.join(process.cwd(), 'data');
export const UPLOAD_DIR = ON_VERCEL ? '/tmp/uploads' : path.join(DATA_DIR, 'uploads');

const CATEGORIES = ['Clothes', 'Shoes', 'Bags', 'Accessories', 'Electronics', 'Grocery', 'Home & Kitchen', 'Other'];

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('seller','admin')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS shops (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL,
    phone TEXT NOT NULL,
    whatsapp TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES categories(id),
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    price INTEGER NOT NULL CHECK (price >= 0),
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    image TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    shop_id INTEGER NOT NULL REFERENCES shops(id),
    product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    unit_price INTEGER NOT NULL,
    qty INTEGER NOT NULL,
    total INTEGER NOT NULL,
    buyer_name TEXT NOT NULL,
    buyer_phone TEXT NOT NULL,
    buyer_address TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'placed'
      CHECK (status IN ('placed','confirmed','packed','delivered','cancelled')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_products_shop ON products(shop_id);
  CREATE INDEX IF NOT EXISTS idx_orders_shop ON orders(shop_id);
`;

function makeClient() {
  if (process.env.TURSO_DATABASE_URL) {
    return createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  if (ON_VERCEL) {
    console.warn('TURSO_DATABASE_URL is not set: using a temporary /tmp database. Data WILL be lost.');
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  return createClient({ url: pathToFileURL(path.join(DATA_DIR, 'mainbazar.db')).href });
}

// Convert libSQL rows into plain objects (safe to pass to React client components)
function toObjects(rs) {
  return rs.rows.map((row) => Object.fromEntries(rs.columns.map((c, i) => [c, row[i]])));
}

// `conn` is the client or a transaction; `before` waits for the schema setup.
function wrap(conn, before = async () => {}) {
  const exec = async (sql, args) => {
    await before();
    return conn.execute({ sql, args });
  };
  return {
    prepare(sql) {
      return {
        get: async (...args) => toObjects(await exec(sql, args))[0],
        all: async (...args) => toObjects(await exec(sql, args)),
        run: async (...args) => {
          const rs = await exec(sql, args);
          return {
            changes: rs.rowsAffected,
            lastInsertRowid: rs.lastInsertRowid == null ? null : Number(rs.lastInsertRowid),
          };
        },
      };
    },
  };
}

async function init(client) {
  await client.executeMultiple(SCHEMA);

  // Migrations for columns added after the first release
  const shopCols = (await client.execute('PRAGMA table_info(shops)')).rows.map((r) => r.name);
  if (!shopCols.includes('cover')) await client.execute('ALTER TABLE shops ADD COLUMN cover TEXT');

  await client.batch(
    CATEGORIES.map((name) => ({ sql: 'INSERT OR IGNORE INTO categories (name) VALUES (?)', args: [name] })),
    'write'
  );

  // Seed the first admin account (set ADMIN_EMAIL / ADMIN_PASSWORD in the environment!)
  const admins = await client.execute("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'");
  if (Number(admins.rows[0].n) === 0) {
    const email = (process.env.ADMIN_EMAIL || 'admin@mainbazar.local').toLowerCase();
    const password = process.env.ADMIN_PASSWORD || 'change-me-now';
    await client.execute({
      sql: "INSERT INTO users (email, password_hash, role) VALUES (?, ?, 'admin')",
      args: [email, bcrypt.hashSync(password, 10)],
    });
  }
}

// Reuse one client across hot reloads / warm serverless invocations
const g = globalThis;
const client = (g.__mainbazarClient ??= makeClient());

function ready() {
  // Retry setup on the next request if it failed (e.g. network hiccup)
  g.__mainbazarReady ??= init(client).catch((e) => {
    g.__mainbazarReady = null;
    throw e;
  });
  return g.__mainbazarReady;
}

export const db = {
  ...wrap(client, ready),
  async transaction(fn) {
    await ready();
    const tx = await client.transaction('write');
    try {
      const result = await fn(wrap(tx));
      await tx.commit();
      return result;
    } catch (e) {
      await tx.rollback().catch(() => {});
      throw e;
    } finally {
      tx.close();
    }
  },
};
