// Returns the public VAPID key to the client
export async function handler() {
  const publicKey = process.env.VAPID_PUBLIC_KEY || '';
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify({ publicKey }),
  };
}


