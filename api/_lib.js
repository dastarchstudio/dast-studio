import { createHmac, timingSafeEqual } from 'node:crypto';

const env = (k) => process.env[k];

export function svcHeaders(extra = {}) {
  return {
    apikey: env('SUPABASE_SERVICE_KEY'),
    Authorization: `Bearer ${env('SUPABASE_SERVICE_KEY')}`,
    'Content-Type': 'application/json',
    ...extra
  };
}
export const restUrl = (path) => `${env('SUPABASE_URL')}/rest/v1/${path}`;

// تشخیص اینکه چه کسی درخواست داده (از روی توکن ورود Supabase)
export async function getCaller(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  const r = await fetch(`${env('SUPABASE_URL')}/auth/v1/user`, {
    headers: { apikey: env('SUPABASE_ANON_KEY'), Authorization: `Bearer ${token}` }
  });
  if (!r.ok) return null;
  const user = await r.json();
  if (!user || !user.id) return null;
  const pr = await fetch(restUrl(`profiles?id=eq.${user.id}&select=is_admin`), { headers: svcHeaders() });
  const rows = await pr.json();
  return { id: user.id, is_admin: Array.isArray(rows) && !!(rows[0] && rows[0].is_admin) };
}

// «state» امضاشده برای اتصال گوگل: مشخص می‌کند حساب گوگل به کدام کاربر پنل وصل شود
export function signState(userId) {
  const payload = Buffer.from(JSON.stringify({ u: userId, e: Date.now() + 10 * 60 * 1000 })).toString('base64url');
  const sig = createHmac('sha256', env('SUPABASE_SERVICE_KEY')).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}
export function verifyState(state) {
  if (!state || typeof state !== 'string' || !state.includes('.')) return null;
  const [payload, sig] = state.split('.');
  const expected = createHmac('sha256', env('SUPABASE_SERVICE_KEY')).update(payload).digest('base64url');
  const a = Buffer.from(sig || ''), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return p.e > Date.now() ? p.u : null;
  } catch { return null; }
}

// گرفتن access token گوگل برای یک کاربر (با refresh token ذخیره‌شده‌اش)
export async function getAccessToken(userId) {
  const r = await fetch(restUrl(`google_connections?user_id=eq.${userId}&select=*`), { headers: svcHeaders() });
  const rows = await r.json();
  const conn = Array.isArray(rows) ? rows[0] : null;
  if (!conn) return { error: 'not_connected' };
  if (conn.needs_reconnect) return { error: 'needs_reconnect' };

  const t = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env('GOOGLE_CLIENT_ID'),
      client_secret: env('GOOGLE_CLIENT_SECRET'),
      refresh_token: conn.refresh_token,
      grant_type: 'refresh_token'
    })
  });
  const d = await t.json();
  if (!d.access_token) {
    if (d.error === 'invalid_grant') {
      await fetch(restUrl(`google_connections?user_id=eq.${userId}`), {
        method: 'PATCH', headers: svcHeaders({ Prefer: 'return=minimal' }), body: JSON.stringify({ needs_reconnect: true })
      });
      return { error: 'needs_reconnect' };
    }
    return { error: 'google_error', details: d };
  }
  return { token: d.access_token };
}

export const CAL_EVENTS = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

function nextDay(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// رویداد «تمام‌روز» در تاریخ مهلت + یادآور پاپ‌آپ ساعت ۹ صبحِ روز قبل
export function buildEvent({ title, due_date, status }) {
  const done = status === 'done';
  return {
    summary: `${done ? '✅ انجام شد: ' : '⏳ مهلت: '}${title}`,
    description: 'ثبت‌شده از پنل مدیریت دفتر',
    start: { date: due_date },
    end: { date: nextDay(due_date) },
    transparency: 'transparent',
    reminders: { useDefault: false, overrides: [
      { method: 'popup', minutes: 3780 }, // ۳ روز قبل، ساعت ۹ صبح
      { method: 'popup', minutes: 900 },  // یک روز قبل، ساعت ۹ صبح
      { method: 'email', minutes: 900 }   // ایمیل یادآوری، یک روز قبل
    ] }
  };
}
