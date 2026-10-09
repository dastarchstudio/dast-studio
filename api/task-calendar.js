import { getCaller, getAccessToken, buildEvent, CAL_EVENTS, svcHeaders, restUrl } from './_lib.js';

// همگام‌سازی مهلت یک کار با گوگل کلندرِ «صاحب کار» (کارمند یا مدیر)
//  action = 'sync'   → ساخت یا به‌روزرسانی رویداد (اگر مهلت دارد)، یا حذف آن (اگر مهلت برداشته شده)
//  action = 'remove' → حذف رویداد (قبل از حذف خود کار)
export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }
  const caller = await getCaller(req);
  if (!caller) { res.status(401).json({ error: 'unauthorized' }); return; }

  const { task_id, action = 'sync' } = req.body || {};
  if (!/^[0-9a-f-]{36}$/i.test(task_id || '')) { res.status(400).json({ error: 'bad_request' }); return; }

  const tr = await fetch(restUrl(`personal_tasks?id=eq.${task_id}&select=*`), { headers: svcHeaders() });
  const rows = await tr.json();
  const task = Array.isArray(rows) ? rows[0] : null;
  if (!task) { res.status(404).json({ error: 'not_found' }); return; }
  if (!caller.is_admin && task.user_id !== caller.id) { res.status(403).json({ error: 'forbidden' }); return; }

  const saveEventId = (id) => fetch(restUrl(`personal_tasks?id=eq.${task.id}`), {
    method: 'PATCH', headers: svcHeaders({ Prefer: 'return=minimal' }), body: JSON.stringify({ google_event_id: id })
  });

  const wantsEvent = action === 'sync' && !!task.due_date && !(task.status === 'done' && !task.google_event_id);
  if (!wantsEvent && !task.google_event_id) { res.status(200).json({ status: 'skipped' }); return; }

  const tk = await getAccessToken(task.user_id);
  if (tk.error) { res.status(200).json({ status: tk.error }); return; }
  const headers = { Authorization: `Bearer ${tk.token}`, 'Content-Type': 'application/json' };

  // حذف رویداد
  if (!wantsEvent) {
    await fetch(`${CAL_EVENTS}/${task.google_event_id}`, { method: 'DELETE', headers }); // ۴۰۴/۴۱۰ یعنی از قبل حذف شده
    await saveEventId(null);
    res.status(200).json({ status: 'removed' });
    return;
  }

  const body = JSON.stringify(buildEvent(task));

  // به‌روزرسانی رویداد موجود
  if (task.google_event_id) {
    const r = await fetch(`${CAL_EVENTS}/${task.google_event_id}`, { method: 'PATCH', headers, body });
    if (r.ok) { res.status(200).json({ status: 'updated' }); return; }
    if (r.status !== 404 && r.status !== 410) { res.status(200).json({ status: 'error' }); return; }
    // رویداد را کسی از کلندر پاک کرده؛ دوباره می‌سازیم
  }

  const r = await fetch(CAL_EVENTS, { method: 'POST', headers, body });
  if (!r.ok) { res.status(200).json({ status: 'error' }); return; }
  const ev = await r.json();
  await saveEventId(ev.id);
  res.status(200).json({ status: 'created' });
}
