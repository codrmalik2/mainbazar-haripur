'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

async function post(url, data) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json().catch(() => ({}));
    return res.ok ? json : { error: json.error || 'Something went wrong. Please try again.', ...json };
  } catch {
    return { error: 'Network error. Check your internet connection and try again.' };
  }
}

function Msg({ error, info }) {
  if (error) return <p className="error" role="alert">{error}</p>;
  if (info) return <p className="success" role="status">{info}</p>;
  return null;
}

/**
 * 3-step seller sign-up: email -> 6-digit code -> shop details.
 * `verifiedEmail` is set when this browser already verified an email (e.g. after a refresh).
 */
export default function SellerSignup({ verifiedEmail = null }) {
  const [step, setStep] = useState(verifiedEmail ? 'details' : 'email');
  const [email, setEmail] = useState(verifiedEmail ?? '');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [pending, setPending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [doneMsg, setDoneMsg] = useState('');

  // Resend countdown
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function run(fn) {
    setPending(true);
    setError('');
    setInfo('');
    try {
      await fn();
    } finally {
      setPending(false);
    }
  }

  const sendCode = (isResend) =>
    run(async () => {
      const r = await post('/api/seller/send-otp', { email });
      if (r.retryAfter) setCooldown(r.retryAfter);
      if (r.error) return setError(r.error);
      setCooldown(r.cooldown ?? 60);
      setCode('');
      setStep('otp');
      setInfo(isResend ? 'A new code has been sent.' : `We sent a 6-digit code to ${email}. Check your inbox (and spam folder).`);
    });

  const verifyCode = () =>
    run(async () => {
      const r = await post('/api/seller/verify-otp', { email, code });
      if (r.error) return setError(r.error);
      setStep('details');
      setInfo('Email verified. Now enter your shop details.');
    });

  const register = (fd) =>
    run(async () => {
      const r = await post('/api/seller/register', Object.fromEntries(fd));
      if (r.error) {
        // Verification expired: go back to the start
        if (/verify your email/i.test(r.error)) setStep('email');
        return setError(r.error);
      }
      setDoneMsg(r.message);
      setStep('done');
    });

  if (step === 'done') {
    return (
      <div className="card stack" style={{ maxWidth: 520 }}>
        <h2 style={{ margin: 0 }}>✅ Thank you!</h2>
        <p className="banner" style={{ margin: 0 }}>{doneMsg}</p>
        <p className="muted" style={{ margin: 0 }}>We will email you at <strong>{email}</strong> as soon as your shop is approved.</p>
        <div className="actions">
          {/* Full page load so the header picks up the new login */}
          <a href="/seller" className="btn">Go to my dashboard</a>
          <Link href="/" className="btn ghost">Back to home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="stack" style={{ maxWidth: 520 }}>
      <ol className="steps" aria-label="Registration steps">
        <li className="done">1. Email</li>
        <li className={step !== 'email' ? 'done' : ''}>2. Verify</li>
        <li className={step === 'details' ? 'done' : ''}>3. Shop details</li>
      </ol>

      {step === 'email' && (
        <form className="form" onSubmit={(e) => { e.preventDefault(); sendCode(false); }}>
          <label>
            Official email
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <Msg error={error} info={info} />
          <button className="btn" disabled={pending || cooldown > 0}>
            {pending ? 'Sending…' : cooldown > 0 ? `Verify Email (wait ${cooldown}s)` : 'Verify Email'}
          </button>
        </form>
      )}

      {step === 'otp' && (
        <form className="form" onSubmit={(e) => { e.preventDefault(); verifyCode(); }}>
          <label>
            Email
            <input value={email} readOnly className="locked" />
          </label>
          <label>
            6-digit code
            <input
              className="otp"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••••"
              autoFocus
            />
          </label>
          <Msg error={error} info={info} />
          <div className="actions">
            <button className="btn" disabled={pending || code.length !== 6}>{pending ? 'Checking…' : 'Verify Code'}</button>
            <button type="button" className="btn ghost" disabled={pending || cooldown > 0} onClick={() => sendCode(true)}>
              {cooldown > 0 ? `Resend Code (${cooldown}s)` : 'Resend Code'}
            </button>
          </div>
          <button type="button" className="linkbtn muted" style={{ alignSelf: 'flex-start' }} onClick={() => { setStep('email'); setError(''); setInfo(''); }}>
            ← Use a different email
          </button>
        </form>
      )}

      {step === 'details' && (
        // onSubmit (not action=) so React doesn't clear the fields when there's an error
        <form className="form" onSubmit={(e) => { e.preventDefault(); register(new FormData(e.currentTarget)); }}>
          <label>
            Email <small>(verified ✔)</small>
            <input value={email} readOnly className="locked" />
          </label>
          <label>Owner name<input name="ownerName" required maxLength={80} autoComplete="name" /></label>
          <label>Shop name<input name="shopName" required maxLength={80} /></label>
          <div className="row">
            <label>Phone number<input name="phone" required placeholder="03xx xxxxxxx" autoComplete="tel" /></label>
            <label>
              WhatsApp <small>(if different)</small>
              <input name="whatsapp" placeholder="03xx xxxxxxx" />
            </label>
          </div>
          <label>City / Area<input name="area" required maxLength={80} placeholder="e.g. Main Bazar, Haripur" /></label>
          <label>Shop address<input name="address" required maxLength={200} placeholder="Street, shop number" /></label>
          <label>
            About your shop <small>(optional)</small>
            <textarea name="description" rows={3} maxLength={500} />
          </label>
          <hr />
          <label>
            Password <small>(min 8 characters)</small>
            <input name="password" type="password" required minLength={8} autoComplete="new-password" />
          </label>
          <label>
            Confirm password
            <input name="confirmPassword" type="password" required minLength={8} autoComplete="new-password" />
          </label>
          <Msg error={error} info={info} />
          <button className="btn" disabled={pending}>{pending ? 'Submitting…' : 'Submit registration'}</button>
        </form>
      )}
    </div>
  );
}
