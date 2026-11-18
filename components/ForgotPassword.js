'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { post, Msg } from '@/components/SellerSignup';

/**
 * Forgot password: email -> 6-digit code -> confirm account name + new password.
 * `verified` = {email, name} when this browser already verified a code (e.g. after a refresh).
 */
export default function ForgotPassword({ verified = null }) {
  const router = useRouter();
  const [step, setStep] = useState(verified ? 'password' : 'email');
  const [email, setEmail] = useState(verified?.email ?? '');
  const [name, setName] = useState(verified?.name ?? '');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [pending, setPending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

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
      const r = await post('/api/password/send-otp', { email });
      if (r.retryAfter) setCooldown(r.retryAfter);
      if (r.error) return setError(r.error);
      setCooldown(r.cooldown ?? 60);
      setCode('');
      setStep('otp');
      setInfo(isResend ? 'A new code has been sent.' : `We sent a 6-digit code to ${email}. Check your inbox (and spam folder).`);
    });

  const verifyCode = () =>
    run(async () => {
      const r = await post('/api/password/verify-otp', { email, code });
      if (r.error) return setError(r.error);
      setName(r.name);
      setStep('password');
    });

  const savePassword = (fd) =>
    run(async () => {
      const r = await post('/api/password/reset', Object.fromEntries(fd));
      if (r.error) {
        if (/expired/i.test(r.error)) setStep('email');
        return setError(r.error);
      }
      router.push('/login?reset=1');
    });

  return (
    <div className="stack" style={{ maxWidth: 520 }}>
      <ol className="steps" aria-label="Reset steps">
        <li className="done">1. Email</li>
        <li className={step !== 'email' ? 'done' : ''}>2. Code</li>
        <li className={step === 'password' ? 'done' : ''}>3. New password</li>
      </ol>

      {step === 'email' && (
        <form className="form" onSubmit={(e) => { e.preventDefault(); sendCode(false); }}>
          <label>
            Registered email
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </label>
          <Msg error={error} info={info} />
          <button className="btn" disabled={pending || cooldown > 0}>
            {pending ? 'Sending…' : cooldown > 0 ? `Send Code (wait ${cooldown}s)` : 'Send Code'}
          </button>
        </form>
      )}

      {step === 'otp' && (
        <form className="form" onSubmit={(e) => { e.preventDefault(); verifyCode(); }}>
          <label>Email<input value={email} readOnly className="locked" /></label>
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

      {step === 'password' && (
        <form className="form" onSubmit={(e) => { e.preventDefault(); savePassword(new FormData(e.currentTarget)); }}>
          <div className="card">
            <small className="muted">Resetting the password for</small>
            <div><strong style={{ fontSize: '1.15rem' }}>{name}</strong></div>
            <small className="muted">{email}</small>
          </div>
          <label>
            New password <small>(min 8 characters)</small>
            <input name="password" type="password" required minLength={8} autoComplete="new-password" autoFocus />
          </label>
          <label>
            Confirm new password
            <input name="confirmPassword" type="password" required minLength={8} autoComplete="new-password" />
          </label>
          <Msg error={error} info={info} />
          <button className="btn" disabled={pending}>{pending ? 'Saving…' : 'Save new password'}</button>
        </form>
      )}
    </div>
  );
}
