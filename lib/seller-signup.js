import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { createSession } from '@/lib/auth';
import { sendMail, otpEmail, adminNewSellerEmail, siteUrl } from '@/lib/mail';

/*
 * 3-step seller sign-up used by the /api/seller/* route handlers:
 *   1. sendOtp      email not registered yet -> email a 6-digit code (valid 10 min)
 *   2. verifyOtp    correct code -> mark verified, give this browser a sign-up cookie
 *   3. register     cookie + verified email -> create seller (status 'pending'), email the admin
 */

const OTP_TTL_MS = 10 * 60 * 1000; // code valid for 10 minutes
const RESEND_COOLDOWN_MS = 60 * 1000; // wait between codes for the same email
const MAX_ATTEMPTS = 5; // wrong guesses before the code is locked
const REG_WINDOW_MS = 30 * 60 * 1000; // time to finish step 3 after verifying
const REG_COOKIE = 'mb_reg';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+\d][\d\s\-()]{6,19}$/;

export const REGISTERED_MSG =
  'Registration submitted! Your shop is currently Pending Admin Approval. Once your registration fee is verified, your store will go live.';

/** Error with an HTTP status, turned into a JSON response by the route handlers. */
export class SignupError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

// Shared with lib/password-reset.js
export const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
export const otpHash = (email, code) => sha256(`${email}:${code}`);

export function sameHash(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export function normalizeEmail(raw) {
  const email = String(raw ?? '').trim().toLowerCase();
  // Format check only ("name@domain.tld"); no length limit, so short emails like abc@gmail.com work
  if (!EMAIL_RE.test(email)) throw new SignupError(400, 'Enter a valid email address.');
  return email;
}

async function assertNotRegistered(email, conn = db) {
  if (await conn.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) {
    throw new SignupError(409, 'This email is already registered.');
  }
}

/* ------------------------------ Step 1 ------------------------------ */

export async function sendOtp(rawEmail) {
  const email = normalizeEmail(rawEmail);
  await assertNotRegistered(email);

  const now = Date.now();
  // Housekeeping: drop sign-up attempts older than a day
  await db.prepare('DELETE FROM otp_verifications WHERE last_sent_at < ?').run(now - 24 * 3600 * 1000);

  const prev = await db.prepare('SELECT last_sent_at FROM otp_verifications WHERE email = ?').get(email);
  const wait = prev ? prev.last_sent_at + RESEND_COOLDOWN_MS - now : 0;
  if (wait > 0) {
    const seconds = Math.ceil(wait / 1000);
    throw new SignupError(429, `Please wait ${seconds} seconds before requesting a new code.`, { retryAfter: seconds });
  }

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  // A new code always resets verification, attempts and any earlier sign-up cookie
  await db
    .prepare(
      `INSERT INTO otp_verifications (email, otp_hash, expires_at, verified, attempts, last_sent_at, reg_token_hash, verified_at)
       VALUES (?, ?, ?, 0, 0, ?, NULL, NULL)
       ON CONFLICT(email) DO UPDATE SET
         otp_hash = excluded.otp_hash, expires_at = excluded.expires_at, verified = 0, attempts = 0,
         last_sent_at = excluded.last_sent_at, reg_token_hash = NULL, verified_at = NULL`
    )
    .run(email, otpHash(email, code), now + OTP_TTL_MS, now);

  try {
    await sendMail({ to: email, ...otpEmail(code) });
  } catch (e) {
    console.error('Failed to send OTP email to', email, e);
    // Let the user retry right away instead of waiting for the cooldown
    await db.prepare('DELETE FROM otp_verifications WHERE email = ?').run(email);
    // Return the exact reason so it can be fixed (e.g. wrong Gmail App Password)
    const detail = String(e?.message || e);
    throw new SignupError(502, `Could not send the verification email: ${detail}`, { detail });
  }

  return { email, cooldown: RESEND_COOLDOWN_MS / 1000 };
}

/* ------------------------------ Step 2 ------------------------------ */

export async function verifyOtp(rawEmail, rawCode) {
  const email = normalizeEmail(rawEmail);
  const code = String(rawCode ?? '').trim();
  if (!/^\d{6}$/.test(code)) throw new SignupError(400, 'Enter the 6-digit code from the email.');

  const row = await db.prepare('SELECT * FROM otp_verifications WHERE email = ?').get(email);
  if (!row) throw new SignupError(400, 'No code was requested for this email. Click "Resend Code".');
  if (row.attempts >= MAX_ATTEMPTS) throw new SignupError(429, 'Too many wrong attempts. Click "Resend Code" to get a new code.');
  if (row.expires_at < Date.now()) throw new SignupError(400, 'This code has expired. Click "Resend Code" to get a new one.');

  if (!sameHash(row.otp_hash, otpHash(email, code))) {
    await db.prepare('UPDATE otp_verifications SET attempts = attempts + 1 WHERE email = ?').run(email);
    const left = MAX_ATTEMPTS - row.attempts - 1;
    throw new SignupError(
      400,
      left > 0 ? `Wrong code. ${left} attempt${left === 1 ? '' : 's'} left.` : 'Too many wrong attempts. Click "Resend Code" to get a new code.'
    );
  }

  // Correct: mark verified and tie the next step to this browser
  const token = crypto.randomBytes(32).toString('hex');
  await db
    .prepare('UPDATE otp_verifications SET verified = 1, verified_at = ?, reg_token_hash = ? WHERE email = ?')
    .run(Date.now(), sha256(token), email);

  (await cookies()).set(REG_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: REG_WINDOW_MS / 1000,
    secure: process.env.COOKIE_SECURE === 'true',
  });

  return { email };
}

/** The verified email for this browser's sign-up cookie, or null. */
export async function getVerifiedSignupEmail() {
  const token = (await cookies()).get(REG_COOKIE)?.value;
  if (!token) return null;
  const row = await db
    .prepare('SELECT email FROM otp_verifications WHERE reg_token_hash = ? AND verified = 1 AND verified_at > ?')
    .get(sha256(token), Date.now() - REG_WINDOW_MS);
  return row?.email ?? null;
}

/* ------------------------------ Step 3 ------------------------------ */

const field = (body, key) => String(body?.[key] ?? '').trim();

export async function registerSeller(body, request) {
  const email = await getVerifiedSignupEmail();
  if (!email) throw new SignupError(403, 'Please verify your email first. Your verification may have expired; start again.');

  const ownerName = field(body, 'ownerName');
  const shopName = field(body, 'shopName');
  const phone = field(body, 'phone');
  const whatsapp = field(body, 'whatsapp') || phone;
  const area = field(body, 'area');
  const address = field(body, 'address');
  const description = field(body, 'description');
  const password = String(body?.password ?? '');
  const confirm = String(body?.confirmPassword ?? '');

  if (ownerName.length < 2 || ownerName.length > 80) throw new SignupError(400, 'Enter the owner name.');
  if (shopName.length < 2 || shopName.length > 80) throw new SignupError(400, 'Enter your shop name.');
  if (!PHONE_RE.test(phone) || !PHONE_RE.test(whatsapp)) throw new SignupError(400, 'Enter valid phone / WhatsApp numbers.');
  if (area.length < 2 || area.length > 80) throw new SignupError(400, 'Enter your city / area.');
  if (address.length < 5 || address.length > 200) throw new SignupError(400, 'Enter your shop address.');
  if (description.length > 500) throw new SignupError(400, 'Description is too long (max 500).');
  if (password.length < 8 || password.length > 200) throw new SignupError(400, 'Password must be at least 8 characters.');
  if (password !== confirm) throw new SignupError(400, 'The two passwords do not match.');

  const passwordHash = bcrypt.hashSync(password, 10);
  let userId;
  try {
    userId = await db.transaction(async (tx) => {
      await assertNotRegistered(email, tx);
      const u = await tx
        .prepare("INSERT INTO users (email, password_hash, role, email_verified) VALUES (?, ?, 'seller', 1)")
        .run(email, passwordHash);
      await tx
        .prepare(
          `INSERT INTO shops (user_id, name, owner_name, description, address, area, phone, whatsapp, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
        )
        .run(u.lastInsertRowid, shopName, ownerName, description, address, area, phone, whatsapp);
      await tx.prepare('DELETE FROM otp_verifications WHERE email = ?').run(email);
      return u.lastInsertRowid;
    });
  } catch (e) {
    if (e instanceof SignupError) throw e;
    // UNIQUE(email) is the final guard against two sign-ups racing each other
    if (/UNIQUE/i.test(String(e?.message))) throw new SignupError(409, 'This email is already registered.');
    throw e;
  }

  (await cookies()).delete(REG_COOKIE);
  await createSession(userId);

  // Tell the admin. A failed email must not undo a successful registration.
  if (process.env.ADMIN_EMAIL) {
    try {
      await sendMail({
        to: process.env.ADMIN_EMAIL,
        ...adminNewSellerEmail({ ownerName, shopName, email, phone, area, adminUrl: `${siteUrl(request)}/admin` }),
      });
    } catch (e) {
      console.error('Failed to send new-seller email to admin', e);
    }
  } else {
    console.warn('ADMIN_EMAIL is not set: no admin notification sent for new seller', email);
  }

  return { message: REGISTERED_MSG };
}
