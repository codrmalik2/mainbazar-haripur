import nodemailer from 'nodemailer';

/*
 * Outgoing email via Nodemailer.
 *   EMAIL_USER, EMAIL_PASS   SMTP login (for Gmail: your address + a 16-character App Password)
 *   EMAIL_HOST, EMAIL_PORT   optional, for a non-Gmail SMTP server (default: Gmail)
 *   EMAIL_FROM               optional "From" header (default: MainBazar Haripur <EMAIL_USER>)
 *
 * In local development without EMAIL_USER/EMAIL_PASS, emails are printed to the
 * terminal instead of being sent, so the sign-up flow can be tested offline.
 */
const configured = !!(process.env.EMAIL_USER && process.env.EMAIL_PASS);

function makeTransport() {
  const auth = { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS };
  if (process.env.EMAIL_HOST) {
    const port = Number(process.env.EMAIL_PORT) || 587;
    return nodemailer.createTransport({ host: process.env.EMAIL_HOST, port, secure: port === 465, auth });
  }
  // Google shows App Passwords as "abcd efgh ijkl mnop"; the real password has no spaces
  return nodemailer.createTransport({ service: 'gmail', auth: { ...auth, pass: auth.pass.replace(/\s+/g, '') } });
}

const g = globalThis;

/** Send an email. Throws if sending fails (callers decide whether that is fatal). */
export async function sendMail({ to, subject, text, html }) {
  // Header values must be single-line
  subject = String(subject).replace(/[\r\n]+/g, ' ');

  if (!configured) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Email is not configured (set EMAIL_USER and EMAIL_PASS).');
    }
    console.log(`\n----- EMAIL (not sent: EMAIL_USER/EMAIL_PASS not set) -----\nTo: ${to}\nSubject: ${subject}\n\n${text}\n-----------------------------------------------------------\n`);
    return;
  }

  g.__mainbazarMailer ??= makeTransport();
  await g.__mainbazarMailer.sendMail({
    from: process.env.EMAIL_FROM || `MainBazar Haripur <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text,
    html,
  });
}

/** Escape user-supplied text before putting it into an HTML email. */
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/**
 * Public base URL of the site, for links in emails.
 * Prefers APP_URL (set this in production), then Vercel's production domain,
 * then the current request's origin.
 */
export function siteUrl(request) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, '');
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (request) return new URL(request.url).origin;
  return 'http://localhost:3000';
}

/* ------------------------------ Templates ------------------------------ */

const wrapHtml = (body) =>
  `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:560px;margin:auto;color:#0f172a;line-height:1.5">
     <h2 style="color:#0f766e;margin-bottom:4px">MainBazar Haripur</h2>${body}
   </div>`;

export function otpEmail(code) {
  return {
    subject: `Your MainBazar verification code: ${code}`,
    text: `Your MainBazar Haripur verification code is ${code}.\n\nIt expires in 10 minutes. If you did not try to register a shop, you can ignore this email.`,
    html: wrapHtml(
      `<p>Your verification code is:</p>
       <p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:12px 0">${esc(code)}</p>
       <p>It expires in <strong>10 minutes</strong>.</p>
       <p style="color:#64748b">If you did not try to register a shop on MainBazar, you can ignore this email.</p>`
    ),
  };
}

export function adminNewSellerEmail({ ownerName, shopName, email, phone, area, adminUrl }) {
  const rows = [
    ['Seller name', ownerName],
    ['Shop name', shopName],
    ['Email', email],
    ['Phone', phone],
    ['City / Area', area],
  ];
  return {
    subject: `New Seller Registration Pending Approval - ${shopName}`,
    text:
      `A new seller has registered and is waiting for approval.\n\n` +
      rows.map(([k, v]) => `${k}: ${v}`).join('\n') +
      `\n\nReview and approve: ${adminUrl}`,
    html: wrapHtml(
      `<p>A new seller has registered and is waiting for approval.</p>
       <table style="border-collapse:collapse">${rows
         .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#64748b">${k}</td><td style="padding:4px 0"><strong>${esc(v)}</strong></td></tr>`)
         .join('')}</table>
       <p style="margin-top:20px"><a href="${esc(adminUrl)}" style="background:#0f766e;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Open Admin Dashboard</a></p>`
    ),
  };
}

export function sellerApprovedEmail({ ownerName, shopName, shopUrl, dashboardUrl }) {
  const hello = ownerName ? `Hello ${ownerName},` : 'Hello,';
  return {
    subject: `Congratulations! ${shopName} is now live on MainBazar Haripur`,
    text:
      `${hello}\n\nGreat news: your shop "${shopName}" has been approved and is now live on MainBazar Haripur.\n\n` +
      `Add your products: ${dashboardUrl}\nYour shop page: ${shopUrl}\n\nWelcome aboard!`,
    html: wrapHtml(
      `<p>${esc(hello)}</p>
       <p>Great news: your shop <strong>${esc(shopName)}</strong> has been approved and is now <strong>live</strong> on MainBazar Haripur. 🎉</p>
       <p><a href="${esc(dashboardUrl)}" style="background:#0f766e;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Add your products</a></p>
       <p>Your shop page: <a href="${esc(shopUrl)}">${esc(shopUrl)}</a></p>
       <p>Welcome aboard!</p>`
    ),
  };
}
