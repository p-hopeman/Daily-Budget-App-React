import webpush from 'web-push';

const subsMemory = globalThis.__SUBS__ || (globalThis.__SUBS__ = new Map());
const budgetsMemory = globalThis.__BUDGETS__ || (globalThis.__BUDGETS__ = new Map());

function ensureVapid() {
  const publicKey = process.env.VAPID_PUBLIC_KEY || '';
  const privateKey = process.env.VAPID_PRIVATE_KEY || '';
  const subject = process.env.VAPID_SUBJECT || 'mailto:example@example.com';
  if (publicKey && privateKey) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
  }
}

export const config = {
  schedule: '0 9,20 * * *' // UTC by default; we filter by user timezone below if needed
};

export async function handler() {
  try {
    ensureVapid();
    const nowUtc = new Date();

    const sends = [];
    for (const [userId, subEntry] of subsMemory.entries()) {
      const tz = subEntry.timezone || 'Europe/Berlin';
      // Compute local hour for the user
      const local = new Date(nowUtc.toLocaleString('en-US', { timeZone: tz }));
      const hour = local.getHours();
      if (hour !== 9 && hour !== 20) continue;

      const budgetEntry = budgetsMemory.get(userId);
      const daily = budgetEntry?.dailyBudget ?? 0;
      const body = `Heutiges Tagesbudget: ${daily.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}`;

      const payload = JSON.stringify({
        title: '💸 Daily Budget',
        body,
        icon: '/assets/DailyBudget_icon_48x48.png',
        tag: `daily-budget-${hour}`
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


