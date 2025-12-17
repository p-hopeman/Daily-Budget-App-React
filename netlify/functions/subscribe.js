import webpush from 'web-push';

// In Netlify, set env vars: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (e.g. mailto:you@example.com)
function ensureVapid() {
  const publicKey = process.env.VAPID_PUBLIC_KEY || '';
  const privateKey = process.env.VAPID_PRIVATE_KEY || '';
  const subject = process.env.VAPID_SUBJECT || 'mailto:example@example.com';
  if (publicKey && privateKey) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
  }
}

// Very small in-memory fallback (cold starts will lose data). For production, add Netlify Blobs or DB.
// We keep it lean here to avoid external services; Netlify Blobs can be added later.
const memory = globalThis.__SUBS__ || (globalThis.__SUBS__ = new Map());

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  try {
    ensureVapid();
    const { userId, timezone, subscription } = JSON.parse(event.body || '{}');
    if (!userId || !subscription) {
      return { statusCode: 400, body: 'Missing userId or subscription' };
    }
    memory.set(userId, { subscription, timezone: timezone || 'Europe/Berlin' });
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    return { statusCode: 500, body: `subscribe error: ${e.message}` };
  }
}


