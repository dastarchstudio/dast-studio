import { getCaller, svcHeaders, restUrl } from './_lib.js';

// وضعیت اتصال گوگل کلندر: برای خود کاربر، و برای مدیر وضعیت همه‌ی افراد
export default async function handler(req, res) {
  const caller = await getCaller(req);
  if (!caller) { res.status(401).json({ error: 'unauthorized' }); return; }

  const r = await fetch(restUrl('google_connections?select=user_id,google_email,needs_reconnect'), { headers: svcHeaders() });
  const rows = await r.json();
  const list = Array.isArray(rows) ? rows : [];
  const info = (c) => ({ connected: !!c, email: c ? c.google_email : null, needs_reconnect: !!(c && c.needs_reconnect) });

  const out = { me: info(list.find(c => c.user_id === caller.id)) };
  if (caller.is_admin) {
    out.all = {};
    list.forEach(c => { out.all[c.user_id] = info(c); });
  }
  res.status(200).json(out);
}
