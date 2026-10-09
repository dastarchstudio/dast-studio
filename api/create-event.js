import { getCaller, getAccessToken, buildEvent, CAL_EVENTS } from './_lib.js';

// «کارهای دفتر» (بخش CRM، فقط مدیر): مهلت را در کلندرِ خودِ مدیر ثبت می‌کند
export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }
  const caller = await getCaller(req);
  if (!caller) { res.status(401).json({ error: 'unauthorized' }); return; }
  if (!caller.is_admin) { res.status(403).json({ error: 'forbidden' }); return; }

  const { title, date } = req.body || {};
  if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date || '')) { res.status(400).json({ error: 'bad_request' }); return; }

  const tk = await getAccessToken(caller.id);
  if (tk.error) { res.status(200).json({ status: tk.error }); return; }

  const r = await fetch(CAL_EVENTS, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tk.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(buildEvent({ title, due_date: date, status: 'new' }))
  });
  res.status(200).json({ status: r.ok ? 'created' : 'error' });
}
