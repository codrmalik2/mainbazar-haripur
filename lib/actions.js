'use server';

import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { db, UPLOAD_DIR } from '@/lib/db';
import { createSession, destroySession, requireAdmin, requireSeller } from '@/lib/auth';
import { NEXT_STATUS, newOrderCode } from '@/lib/util';

const str = (fd, key) => String(fd.get(key) ?? '').trim();
const PHONE_RE = /^[+\d][\d\s\-()]{6,19}$/;
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

/* ------------------------------ Auth ------------------------------ */

export async function registerSeller(_prev, fd) {
  const email = str(fd, 'email').toLowerCase();
  const password = String(fd.get('password') ?? '');
  const shopName = str(fd, 'shopName');
  const address = str(fd, 'address');
  const phone = str(fd, 'phone');
  const whatsapp = str(fd, 'whatsapp') || phone;
  const description = str(fd, 'description');

  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: 'Enter a valid email address.' };
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' };
  if (shopName.length < 2 || shopName.length > 80) return { error: 'Enter your shop name.' };
  if (address.length < 5) return { error: 'Enter your shop address.' };
  if (!PHONE_RE.test(phone) || !PHONE_RE.test(whatsapp))
    return { error: 'Enter valid phone / WhatsApp numbers.' };
  if (description.length > 500) return { error: 'Description is too long (max 500).' };

  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email))
    return { error: 'An account with this email already exists.' };

  const userId = db.transaction(() => {
    const u = db
      .prepare("INSERT INTO users (email, password_hash, role) VALUES (?, ?, 'seller')")
      .run(email, bcrypt.hashSync(password, 10));
    db.prepare(
      `INSERT INTO shops (user_id, name, description, address, phone, whatsapp)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(u.lastInsertRowid, shopName, description, address, phone, whatsapp);
    return u.lastInsertRowid;
  })();

  await createSession(userId);
  redirect('/seller');
}

export async function login(_prev, fd) {
  const email = str(fd, 'email').toLowerCase();
  const password = String(fd.get('password') ?? '');
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  // Always compare to avoid revealing which emails exist
  const ok = bcrypt.compareSync(password, user?.password_hash || DUMMY_HASH);
  if (!user || !ok) return { error: 'Wrong email or password.' };

  await createSession(user.id);
  redirect(user.role === 'admin' ? '/admin' : '/seller');
}

export async function logout() {
  await destroySession();
  redirect('/');
}

/* ----------------------------- Products ---------------------------- */

const IMAGE_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

async function saveImage(file) {
  const ext = IMAGE_TYPES[file.type];
  if (!ext) throw new Error('Image must be JPG, PNG or WebP.');
  if (file.size > 3 * 1024 * 1024) throw new Error('Image must be smaller than 3 MB.');
  const name = `${crypto.randomBytes(16).toString('hex')}.${ext}`;
  await fs.writeFile(path.join(UPLOAD_DIR, name), Buffer.from(await file.arrayBuffer()));
  return name;
}

export async function saveProduct(_prev, fd) {
  const { shop } = await requireSeller();

  const id = Number(fd.get('id')) || null;
  const name = str(fd, 'name');
  const description = str(fd, 'description');
  const price = Number(fd.get('price'));
  const stock = Number(fd.get('stock'));
  const categoryId = Number(fd.get('categoryId'));
  const active = fd.get('active') ? 1 : 0;

  if (name.length < 2 || name.length > 100) return { error: 'Enter a product name.' };
  if (description.length > 1000) return { error: 'Description is too long (max 1000).' };
  if (!Number.isInteger(price) || price < 0) return { error: 'Enter a valid price (whole number).' };
  if (!Number.isInteger(stock) || stock < 0) return { error: 'Enter a valid stock quantity.' };
  if (!db.prepare('SELECT 1 FROM categories WHERE id = ?').get(categoryId))
    return { error: 'Choose a category.' };

  let existing = null;
  if (id) {
    existing = db.prepare('SELECT * FROM products WHERE id = ? AND shop_id = ?').get(id, shop.id);
    if (!existing) return { error: 'Product not found.' };
  }

  let image = existing?.image ?? null;
  const file = fd.get('image');
  if (file && typeof file === 'object' && file.size > 0) {
    try {
      image = await saveImage(file);
    } catch (e) {
      return { error: e.message };
    }
  }
  if (!image) return { error: 'Please upload a product photo.' };

  if (existing) {
    db.prepare(
      `UPDATE products SET name=?, description=?, price=?, stock=?, category_id=?, image=?, active=?
       WHERE id=? AND shop_id=?`
    ).run(name, description, price, stock, categoryId, image, active, id, shop.id);
  } else {
    db.prepare(
      `INSERT INTO products (shop_id, category_id, name, description, price, stock, image, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(shop.id, categoryId, name, description, price, stock, image, active);
  }

  revalidatePath('/', 'layout');
  redirect('/seller');
}

export async function deleteProduct(fd) {
  const { shop } = await requireSeller();
  const id = Number(fd.get('id'));
  const p = db.prepare('SELECT * FROM products WHERE id = ? AND shop_id = ?').get(id, shop.id);
  if (!p) return;
  db.prepare('DELETE FROM products WHERE id = ?').run(id);
  if (p.image) await fs.rm(path.join(UPLOAD_DIR, path.basename(p.image)), { force: true });
  revalidatePath('/', 'layout');
}

/* ------------------------------ Orders ----------------------------- */

export async function placeOrder(_prev, fd) {
  const productId = Number(fd.get('productId'));
  const qty = Number(fd.get('qty'));
  const buyerName = str(fd, 'buyerName');
  const buyerPhone = str(fd, 'buyerPhone');
  const buyerAddress = str(fd, 'buyerAddress');
  const note = str(fd, 'note');

  if (buyerName.length < 2 || buyerName.length > 80) return { error: 'Enter your name.' };
  if (!PHONE_RE.test(buyerPhone)) return { error: 'Enter a valid WhatsApp number.' };
  if (buyerAddress.length < 5 || buyerAddress.length > 300)
    return { error: 'Enter your full delivery address.' };
  if (note.length > 300) return { error: 'Note is too long (max 300).' };
  if (!Number.isInteger(qty) || qty < 1) return { error: 'Enter a valid quantity.' };

  let code;
  try {
    code = db.transaction(() => {
      const p = db
        .prepare(
          `SELECT p.*, s.status AS shop_status FROM products p
           JOIN shops s ON s.id = p.shop_id WHERE p.id = ?`
        )
        .get(productId);
      if (!p || !p.active || p.shop_status !== 'approved') throw new Error('This product is not available.');
      if (p.stock < qty) throw new Error(`Only ${p.stock} left in stock.`);

      db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(qty, p.id);
      const c = newOrderCode();
      db.prepare(
        `INSERT INTO orders (code, shop_id, product_id, product_name, unit_price, qty, total,
                             buyer_name, buyer_phone, buyer_address, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(c, p.shop_id, p.id, p.name, p.price, qty, p.price * qty, buyerName, buyerPhone, buyerAddress, note);
      return c;
    })();
  } catch (e) {
    return { error: e.message };
  }

  redirect(`/order/${code}`);
}

export async function updateOrderStatus(fd) {
  const { shop } = await requireSeller();
  const id = Number(fd.get('id'));
  const next = str(fd, 'status');

  db.transaction(() => {
    const o = db.prepare('SELECT * FROM orders WHERE id = ? AND shop_id = ?').get(id, shop.id);
    if (!o || !NEXT_STATUS[o.status]?.includes(next)) return;
    db.prepare("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?").run(next, id);
    // Put the items back in stock if the order is cancelled
    if (next === 'cancelled' && o.product_id) {
      db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(o.qty, o.product_id);
    }
  })();

  revalidatePath('/seller/orders');
}

/* ------------------------------- Admin ----------------------------- */

export async function setShopStatus(fd) {
  await requireAdmin();
  const id = Number(fd.get('id'));
  const status = str(fd, 'status');
  if (!['pending', 'approved', 'rejected'].includes(status)) return;
  db.prepare('UPDATE shops SET status = ? WHERE id = ?').run(status, id);
  revalidatePath('/', 'layout');
}

export async function adminDeleteProduct(fd) {
  await requireAdmin();
  const id = Number(fd.get('id'));
  const p = db.prepare('SELECT image FROM products WHERE id = ?').get(id);
  if (!p) return;
  db.prepare('DELETE FROM products WHERE id = ?').run(id);
  if (p.image) await fs.rm(path.join(UPLOAD_DIR, path.basename(p.image)), { force: true });
  revalidatePath('/', 'layout');
}
