import { verifyState, svcHeaders, restUrl } from '../_lib.js';

// برگشت از گوگل: حساب گوگل را به همان کاربری که اتصال را شروع کرده وصل می‌کنیم
export default async function handler(req, res) {
  const { code, state, error } = req.query;
  const userId = verifyState(state);
  if (error || !code || !userId) { res.redirect('/?calendar=error'); return; }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code'
      })
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.refresh_token) { res.redirect('/?calendar=error'); return; }

    let email = null;
    try {
      email = JSON.parse(Buffer.from(tokenData.id_token.split('.')[1], 'base64url').toString()).email || null;
    } catch { /* ایمیل اختیاری است */ }

    const save = await fetch(restUrl('google_connections?on_conflict=user_id'), {
      method: 'POST',
      headers: svcHeaders({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify({
        user_id: userId,
        refresh_token: tokenData.refresh_token,
        google_email: email,
        needs_reconnect: false,
        connected_at: new Date().toISOString()
      })
    });
    res.redirect(save.ok ? '/?calendar=connected' : '/?calendar=error');
  } catch {
    res.redirect('/?calendar=error');
  }
}
