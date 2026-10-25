// ورود کارمند با انتخاب نام و رمز (بدون اینکه ایمیل به مرورگر برسد)
// ورودی: { profile_id, password }  خروجی: { access_token, refresh_token, expires_in, user_id }
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }
  let origin;
  try { origin = new URL(process.env.SUPABASE_URL || '').origin; } catch { origin = null; }
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!origin || !origin.endsWith('.supabase.co') || !anonKey || !serviceKey) {
    res.status(503).json({ error: 'login_not_configured' });
    return;
  }

  let input = req.body;
  if (typeof input === 'string') { try { input = JSON.parse(input); } catch { input = null; } }
  if (!input || typeof input !== 'object') {
    res.status(400).json({ error: 'bad_request' });
    return;
  }
  const profileId = String(input.profile_id || '');
  const password = String(input.password || '');
  if (!/^[0-9a-f-]{36}$/i.test(profileId) || password.length < 1 || password.length > 200) {
    res.status(400).json({ error: 'bad_request' });
    return;
  }

  try {
    // ایمیل کاربر فقط در سرور خوانده می‌شه
    const adminRes = await fetch(`${origin}/auth/v1/admin/users/${profileId}`, {
      headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}` }
    });
    if (!adminRes.ok) {
      res.status(404).json({ error: 'user_not_found' });
      return;
    }
    const authUser = await adminRes.json();
    if (!authUser || !authUser.email) {
      res.status(404).json({ error: 'user_not_found' });
      return;
    }

    const tokenRes = await fetch(`${origin}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: anonKey, 'content-type': 'application/json' },
      body: JSON.stringify({ email: authUser.email, password })
    });
    const data = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !data.access_token) {
      res.status(401).json({ error: 'invalid_credentials' });
      return;
    }
    res.status(200).json({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
      user_id: data.user && data.user.id
    });
  } catch {
    res.status(502).json({ error: 'upstream_unreachable' });
  }
}
