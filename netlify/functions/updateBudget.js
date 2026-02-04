import crypto from 'crypto';
import { getStore } from '@netlify/blobs';

function getStores() {
  const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID;
  const token = process.env.NETLIFY_API_TOKEN || process.env.NETLIFY_BLOBS_TOKEN;
  const opts = siteID && token ? { siteID, token } : null;
  const budgetsStore = opts ? getStore({ name: 'budgets', ...opts }) : getStore('budgets');
  const subsStore = opts ? getStore({ name: 'subscriptions', ...opts }) : getStore('subscriptions');
  return { budgetsStore, subsStore };
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
    const { budgetsStore, subsStore } = getStores();
    const auth = event.headers.authorization || '';
    const { key, dailyBudget, remainingBudget, remainingDays } = JSON.parse(event.body || '{}');
    if (!key || !auth.startsWith('Bearer ')) return { statusCode: 401, body: 'Unauthorized' };
    const token = auth.slice('Bearer '.length);

    // Hole Subscription, um endpoint zu validieren
    const subRaw = await subsStore.get(key);
    if (!subRaw) return { statusCode: 404, body: 'Subscription not found' };
    const sub = JSON.parse(subRaw);
    if (!verifyToken(sub.endpoint, token)) return { statusCode: 401, body: 'Invalid token' };

    const existingRaw = await budgetsStore.get(key);
    const existing = existingRaw ? JSON.parse(existingRaw) : {};

    await budgetsStore.set(key, JSON.stringify({
      dailyBudget: Number(dailyBudget) || 0,
      remainingBudget: Number(remainingBudget) || 0,
      remainingDays: Number(remainingDays) || 0,
      schedule: existing.schedule,
      timezone: sub.timezone || existing.timezone || 'Europe/Berlin',
      updatedAt: Date.now()
    }));
    return { statusCode: 200, body: JSON.stringify({ ok: true, key }) };
  } catch (e) {
    return { statusCode: 500, body: `updateBudget error: ${e.message}` };
  }
}


