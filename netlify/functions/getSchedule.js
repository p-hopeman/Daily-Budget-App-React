import crypto from 'crypto';
import { getStore } from '@netlify/blobs';

function getStores() {
  const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID;
  const token = process.env.NETLIFY_API_TOKEN || process.env.NETLIFY_BLOBS_TOKEN;
  const opts = siteID && token ? { siteID, token } : null;
  const subsStore = opts ? getStore({ name: 'subscriptions', ...opts }) : getStore('subscriptions');
  const budgetsStore = opts ? getStore({ name: 'budgets', ...opts }) : getStore('budgets');
  return { subsStore, budgetsStore };
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
    const { subsStore, budgetsStore } = getStores();
    const auth = event.headers.authorization || '';
    const { key } = JSON.parse(event.body || '{}');
    if (!key || !auth.startsWith('Bearer ')) return { statusCode: 401, body: 'Unauthorized' };
    const token = auth.slice('Bearer '.length);

    const subRaw = await subsStore.get(key);
    if (!subRaw) return { statusCode: 404, body: 'Subscription not found' };
    const sub = JSON.parse(subRaw);
    if (!verifyToken(sub.endpoint, token)) return { statusCode: 401, body: 'Invalid token' };

    const budgetRaw = await budgetsStore.get(key);
    const budget = budgetRaw ? JSON.parse(budgetRaw) : {};
    const schedule = Array.isArray(sub.schedule) && sub.schedule.length > 0
      ? sub.schedule
      : (Array.isArray(budget.schedule) && budget.schedule.length > 0
        ? budget.schedule
        : ['09:00', '20:00']);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: true,
        timezone: sub.timezone || 'Europe/Berlin',
        schedule
      })
    };
  } catch (e) {
    return { statusCode: 500, body: `getSchedule error: ${e.message}` };
  }
}

