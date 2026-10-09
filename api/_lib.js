const env = (k) => process.env[k];

export function svcHeaders(extra = {}) {
  return {
    apikey: env('SUPABASE_SERVICE_KEY'),
    Authorization: `Bearer ${env('SUPABASE_SERVICE_KEY')}`,
    'Content-Type': 'application/json',
    ...extra
  };
}
export const restUrl = (path) => {
  const base = env('SUPABASE_URL');
  if (!base) throw new Error('missing_supabase_url');
  return base.replace(/\/+$/, '') + '/rest/v1/' + path;
};

// تشخیص اینکه چه کسی درخواست داده (از روی توکن ورود Supabase)
export async function getCaller(req) {
  // Fail closed when server-side credentials are not configured. This avoids
  // malformed requests such as "undefined/auth/v1/user" during first deploys.
  const base = env('SUPABASE_URL');
  const anonKey = env('SUPABASE_ANON_KEY');
  const serviceKey = env('SUPABASE_SERVICE_KEY');
  if (!base || !anonKey || !serviceKey) return null;

  const normalizedBase = base.replace(/\/+$/, '');
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;

  try {
    const r = await fetch(normalizedBase + '/auth/v1/user', {
      headers: { apikey: anonKey, Authorization: 'Bearer ' + token }
    });
    if (!r.ok) return null;
    const user = await r.json();
    if (!user || !user.id) return null;

    const profileUrl = normalizedBase + '/rest/v1/profiles?id=eq.' + encodeURIComponent(user.id) + '&select=is_admin';
    const pr = await fetch(profileUrl, {
      headers: { apikey: serviceKey, Authorization: 'Bearer ' + serviceKey }
    });
    if (!pr.ok) return null;
    const rows = await pr.json();
    return { id: user.id, is_admin: Array.isArray(rows) && !!(rows[0] && rows[0].is_admin) };
  } catch {
    return null;
  }
}
