// Store the latest dailyBudget snapshot per user
const memory = globalThis.__BUDGETS__ || (globalThis.__BUDGETS__ = new Map());

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  try {
    const { userId, timezone, dailyBudget, remainingBudget, remainingDays } = JSON.parse(event.body || '{}');
    if (!userId) return { statusCode: 400, body: 'Missing userId' };
    memory.set(userId, {
      dailyBudget: Number(dailyBudget) || 0,
      remainingBudget: Number(remainingBudget) || 0,
      remainingDays: Number(remainingDays) || 0,
      timezone: timezone || 'Europe/Berlin',
      updatedAt: Date.now()
    });
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    return { statusCode: 500, body: `updateBudget error: ${e.message}` };
  }
}


