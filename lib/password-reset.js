import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { sendMail, resetOtpEmail, passwordChangedEmail, siteUrl } from '@/lib/mail';
import { SignupError as ApiError, normalizeEmail, otpHash, sameHash, sha256 } from '@/lib/seller-signup';

/*
 * Forgot-password flow for sellers and admin, used by /api/password/* route handlers:
 *   1. sendResetOtp    registered email -> email a 6-digit code (valid 10 min)
 *   2. verifyResetOtp  correct code -> show the account name, give this browser a reset cookie
 *   3. resetPassword   cookie + new password -> update the hash, log out all sessions
 */

const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;
const RESET_WINDOW_MS = 15 * 60 * 1000; // time to choose the new password after verifying
const RESET_COOKIE = 'mb_pwreset';

/** Name shown on screen so the user can confirm it's the right account. */
async function accountName(email) {
  const u = await db
    .prepare(
      `SELECT u.role, s.name AS shop_name, s.owner_name
       FROM users u LEFT JOIN shops s ON s.user_id = u.id WHERE u.email = ?`
    )
    .get(email);
  if (!u) return null;
  if (u.role === 'admin') return 'MainBazar Admin';
  return u.owner_name ? `${u.shop_name} (${u.owner_name})` : u.shop_name || email;
}

/* ------------------------------ Step 1 ------------------------------ */

export async function sendResetOtp(rawEmail) {
  const email = normalizeEmail(rawEmail);
  if (!(await db.prepare('SELECT 1 FROM users WHERE email = ?').get(email))) {
    throw new ApiError(404, 'No account found with this email.');
  }

  const now = Date.now();
  await db.prepare('DELETE FROM password_resets WHERE last_sent_at < ?').run(now - 24 * 3600 * 1000);

  const prev = await db.prepare('SELECT last_sent_at FROM password_resets WHERE email = ?').get(email);
  const wait = prev ? prev.last_sent_at + RESEND_COOLDOWN_MS - now : 0;
  if (wait > 0) {
    const seconds = Math.ceil(wait / 1000);
    throw new ApiError(429, `Please wait ${seconds} seconds before requesting a new code.`, { retryAfter: seconds });
  }

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  await db
    .prepare(
      `INSERT INTO password_resets (email, otp_hash, expires_at, attempts, last_sent_at, reset_token_hash, verified_at)
       VALUES (?, ?, ?, 0, ?, NULL, NULL)
       ON CONFLICT(email) DO UPDATE SET
         otp_hash = excluded.otp_hash, expires_at = excluded.expires_at, attempts = 0,
         last_sent_at = excluded.last_sent_at, reset_token_hash = NULL, verified_at = NULL`
    )
    .run(email, otpHash(email, code), now + OTP_TTL_MS, now);

  try {
    await sendMail({ to: email, ...resetOtpEmail(code) });
  } catch (e) {
    console.error('Failed to send password reset email to', email, e);
    await db.prepare('DELETE FROM password_resets WHERE email = ?').run(email);
    const detail = String(e?.message || e);
    throw new ApiError(502, `Could not send the reset email: ${detail}`, { detail });
  }

  return { email, cooldown: RESEND_COOLDOWN_MS / 1000 };
}

/* ------------------------------ Step 2 ------------------------------ */

export async function verifyResetOtp(rawEmail, rawCode) {
  const email = normalizeEmail(rawEmail);
  const code = String(rawCode ?? '').trim();
  if (!/^\d{6}$/.test(code)) throw new ApiError(400, 'Enter the 6-digit code from the email.');

  const row = await db.prepare('SELECT * FROM password_resets WHERE email = ?').get(email);
  if (!row) throw new ApiError(400, 'No code was requested for this email. Click "Resend Code".');
  if (row.attempts >= MAX_ATTEMPTS) throw new ApiError(429, 'Too many wrong attempts. Click "Resend Code" to get a new code.');
  if (row.expires_at < Date.now()) throw new ApiError(400, 'This code has expired. Click "Resend Code" to get a new one.');

  if (!sameHash(row.otp_hash, otpHash(email, code))) {
    await db.prepare('UPDATE password_resets SET attempts = attempts + 1 WHERE email = ?').run(email);
    const left = MAX_ATTEMPTS - row.attempts - 1;
    throw new ApiError(
      400,
      left > 0 ? `Wrong code. ${left} attempt${left === 1 ? '' : 's'} left.` : 'Too many wrong attempts. Click "Resend Code" to get a new code.'
    );
  }

  const token = crypto.randomBytes(32).toString('hex');
  // The code can only be used once: clear it when issuing the reset cookie
  await db
    .prepare("UPDATE password_resets SET otp_hash = '', verified_at = ?, reset_token_hash = ? WHERE email = ?")
    .run(Date.now(), sha256(token), email);

  (await cookies()).set(RESET_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: RESET_WINDOW_MS / 1000,
    secure: process.env.COOKIE_SECURE === 'true',
  });

  return { email, name: await accountName(email) };
}

/** {email, name} for this browser's verified reset, or null. */
export async function getVerifiedReset() {
  const token = (await cookies()).get(RESET_COOKIE)?.value;
  if (!token) return null;
  const row = await db
    .prepare('SELECT email FROM password_resets WHERE reset_token_hash = ? AND verified_at > ?')
    .get(sha256(token), Date.now() - RESET_WINDOW_MS);
  if (!row) return null;
  const name = await accountName(row.email);
  return name ? { email: row.email, name } : null;
}

/* ------------------------------ Step 3 ------------------------------ */

export async function resetPassword(body, request) {
  const reset = await getVerifiedReset();
  if (!reset) throw new ApiError(403, 'Your reset session has expired. Please start again.');

  const password = String(body?.password ?? '');
  const confirm = String(body?.confirmPassword ?? '');
  if (password.length < 8) throw new ApiError(400, 'Password must be at least 8 characters.');
  if (password !== confirm) throw new ApiError(400, 'The two passwords do not match.');

  const passwordHash = bcrypt.hashSync(password, 10);
  await db.transaction(async (tx) => {
    const u = await tx.prepare('SELECT id FROM users WHERE email = ?').get(reset.email);
    if (!u) throw new ApiError(404, 'No account found with this email.');
    await tx.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, u.id);
    // Log out everywhere: anyone using the old password loses access
    await tx.prepare('DELETE FROM sessions WHERE user_id = ?').run(u.id);
    await tx.prepare('DELETE FROM password_resets WHERE email = ?').run(reset.email);
  });
  (await cookies()).delete(RESET_COOKIE);

  // Security notice; failure must not undo the reset
  try {
    await sendMail({ to: reset.email, ...passwordChangedEmail({ name: reset.name, loginUrl: `${siteUrl(request)}/login` }) });
  } catch (e) {
    console.error('Failed to send password-changed email to', reset.email, e);
  }

  return { message: 'Password updated. Log in with your new password.' };
}
