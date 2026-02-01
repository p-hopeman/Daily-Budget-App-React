import webpush from 'web-push';
import { getStore } from '@netlify/blobs';

function getStores() {
  const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID;
  const token = process.env.NETLIFY_API_TOKEN || process.env.NETLIFY_BLOBS_TOKEN;
  const opts = siteID && token ? { siteID, token } : null;
  const subsStore = opts ? getStore({ name: 'subscriptions', ...opts }) : getStore('subscriptions');
  const budgetsStore = opts ? getStore({ name: 'budgets', ...opts }) : getStore('budgets');
  return { subsStore, budgetsStore };
}

function ensureVapid() {
  const publicKey = process.env.VAPID_PUBLIC_KEY || '';
  const privateKey = process.env.VAPID_PRIVATE_KEY || '';
  const subject = process.env.VAPID_SUBJECT || 'mailto:example@example.com';
  if (publicKey && privateKey) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
  }
}

export const config = {
  schedule: '*/1 * * * *' // jede Minute ausführen, wir filtern client-spezifisch nach HH:MM
};

export async function handler() {
  try {
    const { subsStore, budgetsStore } = getStores();
    ensureVapid();
    const nowUtc = new Date();

    const sends = [];
    // Liste aller Keys aus dem Subscriptions-Store holen
    const list = await subsStore.list();
    for (const { key } of list.blobs) {
      const subRaw = await subsStore.get(key);
      if (!subRaw) continue;
      const subEntry = JSON.parse(subRaw);
      const tz = subEntry.timezone || 'Europe/Berlin';
      const local = new Date(nowUtc.toLocaleString('en-US', { timeZone: tz }));
      const hh = local.getHours();
      const mm = local.getMinutes();
      const hhmm = `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
      const schedule = Array.isArray(subEntry.schedule) && subEntry.schedule.length > 0
        ? subEntry.schedule
        : ['09:00', '20:00'];
      if (!schedule.includes(hhmm)) continue;

      const budgetRaw = await budgetsStore.get(key);
      const budgetEntry = budgetRaw ? JSON.parse(budgetRaw) : {};
      const daily = budgetEntry?.dailyBudget ?? 0;
      const body = `Heutiges Tagesbudget: ${daily.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}`;

      const payload = JSON.stringify({
        title: '💸 Daily Budget',
        body,
        icon: '/assets/DailyBudget_icon_48x48.png',
        tag: `daily-budget-${hhmm}`
      });

      const subscription = subEntry.subscription;
      if (!subscription) continue;
      sends.push(webpush.sendNotification(subscription, payload).catch(() => {}));
    }

    await Promise.all(sends);
    return { statusCode: 200, body: JSON.stringify({ ok: true, sent: sends.length }) };
  } catch (e) {
    return { statusCode: 500, body: `sendReminders error: ${e.message}` };
  }
}


