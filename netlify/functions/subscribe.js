import crypto from 'crypto';
import { getStore } from '@netlify/blobs';

// Wir speichern Subscriptions persistent in Netlify Blobs
const subsStore = getStore('subscriptions');

function signToken(endpoint) {
  const secret = process.env.HMAC_SECRET || '';
  return crypto.createHmac('sha256', secret).update(endpoint).digest('base64url');
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  try {
    const { timezone, subscription } = JSON.parse(event.body || '{}');
    if (!subscription?.endpoint) {
      return { statusCode: 400, body: 'Missing subscription endpoint' };
    }
    const endpoint = subscription.endpoint;
    const key = crypto.createHash('sha256').update(endpoint).digest('hex'); // key ohne PII
    const token = signToken(endpoint);

    await subsStore.set(key, JSON.stringify({
      endpoint,
      subscription,
      timezone: timezone || 'Europe/Berlin',
      createdAt: Date.now()
    }));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ ok: true, key, token })
    };
  } catch (e) {
    return { statusCode: 500, body: `subscribe error: ${e.message}` };
  }
}


