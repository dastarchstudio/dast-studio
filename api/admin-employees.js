import { getCaller, svcHeaders, restUrl } from './_lib.js';

const json = (res, status, body) => { res.status(status).json(body); };
const clean = (value, max = 120) => typeof value === 'string' ? value.trim().slice(0, max) : '';

async function supabaseFetch(path, options = {}) {
  return fetch(restUrl(path), { ...options, headers: svcHeaders(options.headers || {}) });
}

export default async function handler(req, res) {
  const caller = await getCaller(req);
  if (!caller) return json(res, 401, { error: 'unauthorized' });
  if (!caller.is_admin) return json(res, 403, { error: 'forbidden' });

  if (req.method === 'GET') {
    try {
      const r = await supabaseFetch('profiles?select=id,full_name,email,job_title,role,employee_code,is_active,is_admin&order=full_name.asc');
      if (!r.ok) { await r.body?.cancel?.(); return json(res, 502, { error: 'employee_list_failed' }); }
      return json(res, 200, await r.json());
    } catch {
      return json(res, 502, { error: 'employee_list_failed' });
    }
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const full_name = clean(body.full_name);
    const email = clean(body.email, 254).toLowerCase();
    const job_title = clean(body.job_title);
    const role = clean(body.role, 60) || 'employee';
    const employee_code = clean(body.employee_code, 20).toUpperCase();
    const password = typeof body.password === 'string' ? body.password : '';

    if (!full_name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 10 || !job_title) {
      return json(res, 400, { error: 'invalid_input', message: 'نام، ایمیل معتبر، سمت و رمز اولیه حداقل ۱۰ کاراکتری لازم است.' });
    }
    if (!['employee', 'manager', 'designer', 'accounting', 'intern', 'other'].includes(role)) {
      return json(res, 400, { error: 'invalid_role' });
    }

    let createdUserId = null;
    try {
      const create = await fetch(restUrl('../auth/v1/admin/users'), {
        method: 'POST',
        headers: { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: 'Bearer ' + process.env.SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name } })
      });
      const user = await create.json().catch(() => ({}));
      if (!create.ok || !user.id) {
        return json(res, create.status === 422 ? 409 : 502, { error: 'auth_user_create_failed', message: create.status === 422 ? 'این ایمیل احتمالاً قبلاً ثبت شده است.' : 'ساخت حساب ورود ناموفق بود.' });
      }
      createdUserId = user.id;

      const profile = await supabaseFetch('profiles', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ id: user.id, full_name, email, job_title, role, employee_code: employee_code || null, is_active: true, is_admin: false })
      });
      if (!profile.ok) {
        await profile.body?.cancel?.();
        await fetch(restUrl('../auth/v1/admin/users/' + encodeURIComponent(user.id)), {
          method: 'DELETE',
          headers: { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: 'Bearer ' + process.env.SUPABASE_SERVICE_KEY }
        }).catch(() => {});
        return json(res, 502, { error: 'profile_create_failed', message: 'حساب ورود ساخته نشد چون ثبت پروفایل کامل نشد؛ عملیات برگشت داده شد.' });
      }
      return json(res, 201, { employee: (await profile.json())[0] || { id: user.id, full_name, email, job_title, role, employee_code, is_active: true, is_admin: false } });
    } catch {
      if (createdUserId) {
        await fetch(restUrl('../auth/v1/admin/users/' + encodeURIComponent(createdUserId)), {
          method: 'DELETE',
          headers: { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: 'Bearer ' + process.env.SUPABASE_SERVICE_KEY }
        }).catch(() => {});
      }
      return json(res, 502, { error: 'employee_create_failed' });
    }
  }

  if (req.method === 'PATCH') {
    const body = req.body || {};
    const id = clean(body.id, 80);
    if (!id || id === caller.id) return json(res, 400, { error: 'invalid_employee' });
    const patch = {};
    if (typeof body.is_active === 'boolean') patch.is_active = body.is_active;
    if (typeof body.full_name === 'string' && clean(body.full_name)) patch.full_name = clean(body.full_name);
    if (typeof body.job_title === 'string' && clean(body.job_title)) patch.job_title = clean(body.job_title);
    if (typeof body.role === 'string') {
      if (!['employee', 'manager', 'designer', 'accounting', 'intern', 'other'].includes(body.role)) return json(res, 400, { error: 'invalid_role' });
      patch.role = body.role;
    }
    if (typeof body.employee_code === 'string') patch.employee_code = clean(body.employee_code, 20).toUpperCase() || null;
    if (!Object.keys(patch).length) return json(res, 400, { error: 'empty_update' });
    // The administrator flag is intentionally not editable through this endpoint.
    try {
      const r = await supabaseFetch('profiles?id=eq.' + encodeURIComponent(id), {
        method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(patch)
      });
      if (!r.ok) { await r.body?.cancel?.(); return json(res, 502, { error: 'employee_update_failed' }); }
      const rows = await r.json();
      if (!rows.length) return json(res, 404, { error: 'employee_not_found' });
      return json(res, 200, { employee: rows[0] });
    } catch {
      return json(res, 502, { error: 'employee_update_failed' });
    }
  }

  res.setHeader('Allow', 'GET, POST, PATCH');
  return json(res, 405, { error: 'method_not_allowed' });
}
