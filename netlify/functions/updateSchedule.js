import crypto from 'crypto';
import { getStore } from '@netlify/blobs';

function getStores() {
  const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID;
  const token = process.env.NETLIFY_API_TOKEN || process.env.NETLIFY_BLOBS_TOKEN;
  const opts = siteID && token ? { siteID, token } : null;
  const subsStore = opts ? getStore({ name: 'subscriptions', ...opts }) : getStore('subscriptions');
  return { subsStore };
}

function verifyToken(endpoint, token) {
  const secret = process.env.HMAC_SECRET || '';
  const expected = crypto.createHmac('sha256', secret).update(endpoint).digest('base64url');
  return token === expected;
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  try {
    const { subsStore } = getStores();
    const auth = event.headers.authorization || '';
    const { key, timezone, schedule } = JSON.parse(event.body || '{}');
    if (!key || !Array.isArray(schedule)) return { statusCode: 400, body: 'Bad Request' };
    if (!auth.startsWith('Bearer ')) return { statusCode: 401, body: 'Unauthorized' };
    const token = auth.slice('Bearer '.length);

    const subRaw = await subsStore.get(key);
    if (!subRaw) return { statusCode: 404, body: 'Subscription not found' };
    const sub = JSON.parse(subRaw);
    if (!verifyToken(sub.endpoint, token)) return { statusCode: 401, body: 'Invalid token' };

    const unique = [...new Set(schedule.filter(s => /^\\d{2}:\\d{2}$/.test(s)))];
    const updated = {
      ...sub,
      timezone: timezone || sub.timezone || 'Europe/Berlin',
      schedule: unique.slice(0, 6), // bis zu 6 Zeiten zulassen
      updatedAt: Date.now()
    };
    await subsStore.set(key, JSON.stringify(updated));

    return { statusCode: 200, body: JSON.stringify({ ok: true, schedule: updated.schedule }) };
  } catch (e) {
    return { statusCode: 500, body: `updateSchedule error: ${e.message}` };
  }
}





