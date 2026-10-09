import { getCaller, signState } from '../_lib.js';

// شروع اتصال گوگل کلندر: کاربر واردشده را می‌شناسیم و آدرس اجازه‌گرفتن از گوگل را برمی‌گردانیم
export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }
  const caller = await getCaller(req);
  if (!caller) { res.status(401).json({ error: 'unauthorized' }); return; }

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email https://www.googleapis.com/auth/calendar.events',
    access_type: 'offline',
    prompt: 'consent',
    state: signState(caller.id)
  });
  res.status(200).json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
}
