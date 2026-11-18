import { SignupError } from '@/lib/seller-signup';

/**
 * Wrap a sign-up step as a JSON POST route handler.
 * Only accepts application/json, which browsers can't send cross-site without CORS,
 * so other websites can't trigger these endpoints from a visitor's browser.
 */
export function jsonRoute(fn) {
  return async function POST(request) {
    if (!request.headers.get('content-type')?.includes('application/json')) {
      return Response.json({ error: 'Expected JSON.' }, { status: 415 });
    }
    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'Invalid request.' }, { status: 400 });
    }
    try {
      return Response.json({ ok: true, ...(await fn(body, request)) });
    } catch (e) {
      if (e instanceof SignupError) {
        const headers = e.extra.retryAfter ? { 'Retry-After': String(e.extra.retryAfter) } : undefined;
        return Response.json({ error: e.message, ...e.extra }, { status: e.status, headers });
      }
      console.error('Seller sign-up error', e);
      const detail = String(e?.message || e);
      return Response.json({ error: `Something went wrong: ${detail}`, detail }, { status: 500 });
    }
  };
}
