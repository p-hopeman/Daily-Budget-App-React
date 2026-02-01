import webpush from 'web-push';
import { getStore } from '@netlify/blobs';

function getStores() {
  const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID;
  const token = process.env.NETLIFY_API_TOKEN || process.env.NETLIFY_BLOBS_TOKEN;
  const opts = siteID && token ? { siteID, token } : null;
  const subsStore = opts ? getStore({ name: 'subscriptions', ...opts }) : getStore('subscriptions');
  return { subsStore };
}

function ensureVapid() {
  const publicKey = process.env.VAPID_PUBLIC_KEY || '';
  const privateKey = process.env.VAPID_PRIVATE_KEY || '';
  const subject = process.env.VAPID_SUBJECT || 'mailto:example@example.com';
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

// POST { key } → sendet sofort eine Test-Push-Nachricht an die gegebene Subscription
export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  try {
    if (!ensureVapid()) {
      return { statusCode: 500, body: 'VAPID keys missing' };
    }
    const { subsStore } = getStores();
    const { key } = JSON.parse(event.body || '{}');
    if (!key) return { statusCode: 400, body: 'Missing key' };
    const subRaw = await subsStore.get(key);
    if (!subRaw) return { statusCode: 404, body: 'Subscription not found' };
    const { subscription } = JSON.parse(subRaw);
    const payload = JSON.stringify({
      title: '🔔 Test',
      body: 'Das ist eine Test-Benachrichtigung von Daily Budget',
      icon: '/assets/DailyBudget_icon_48x48.png',
      tag: 'test-push'
    });
    await webpush.sendNotification(subscription, payload);
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    return { statusCode: 500, body: `testPush error: ${e.message}` };
  }
}





