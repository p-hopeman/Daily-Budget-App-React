import crypto from 'crypto';
import { getStore } from '@netlify/blobs';

const budgetsStore = getStore('budgets');
const subsStore = getStore('subscriptions');

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
    const auth = event.headers.authorization || '';
    const { key, dailyBudget, remainingBudget, remainingDays } = JSON.parse(event.body || '{}');
    if (!key || !auth.startsWith('Bearer ')) return { statusCode: 401, body: 'Unauthorized' };
    const token = auth.slice('Bearer '.length);

    // Hole Subscription, um endpoint zu validieren
    const subRaw = await subsStore.get(key);
    if (!subRaw) return { statusCode: 404, body: 'Subscription not found' };
    const sub = JSON.parse(subRaw);
    if (!verifyToken(sub.endpoint, token)) return { statusCode: 401, body: 'Invalid token' };

    await budgetsStore.set(key, JSON.stringify({
      dailyBudget: Number(dailyBudget) || 0,
      remainingBudget: Number(remainingBudget) || 0,
      remainingDays: Number(remainingDays) || 0,
      timezone: sub.timezone || 'Europe/Berlin',
      updatedAt: Date.now()
    }));
    return { statusCode: 200, body: JSON.stringify({ ok: true, key }) };
  } catch (e) {
    return { statusCode: 500, body: `updateBudget error: ${e.message}` };
  }
}


