// فهرست کارمندان برای صفحه‌ی ورود (نام، نقش، بخش و ادمین بودن؛ بدون ایمیل و اطلاعات تماس)
// کلید service_role فقط در سرور استفاده می‌شود و هرگز به مرورگر نمی‌رسد.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }
  let origin;
  try { origin = new URL(process.env.SUPABASE_URL || '').origin; } catch { origin = null; }
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!origin || !origin.endsWith('.supabase.co') || !key) {
    res.status(503).json({ error: 'staff_not_configured' });
    return;
  }
  try {
    const r = await fetch(
      `${origin}/rest/v1/profiles?select=id,full_name,role_title,department,is_admin&order=full_name.asc`,
      { headers: { apikey: key, authorization: `Bearer ${key}` } }
    );
    if (!r.ok) {
      res.status(502).json({ error: 'staff_fetch_failed' });
      return;
    }
    const rows = await r.json();
    res.status(200).json(Array.isArray(rows) ? rows : []);
  } catch {
    res.status(502).json({ error: 'upstream_unreachable' });
  }
}
