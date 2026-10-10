import webpush from 'web-push';
import { createHash, timingSafeEqual } from 'node:crypto';
import { getCaller, svcHeaders, restUrl } from './_lib.js';

const sha = (s) => createHash('sha256').update(String(s)).digest();
const secureEqual = (a, b) => {
  const left = sha(a || ''), right = sha(b || '');
  return timingSafeEqual(left, right);
};
const json = (res, status, body) => { res.setHeader('Cache-Control', 'no-store'); res.status(status).json(body); };
const cleanText = (v, max) => String(v || '').trim().slice(0, max);

async function db(path, options = {}) {
  const r = await fetch(restUrl(path), { ...options, headers: svcHeaders(options.headers || {}) });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new Error('database_request_failed');
  return data;
}

async function createForUser(row, userId) {
  const prefsRows = await db('profiles?id=eq.' + encodeURIComponent(userId) + '&select=notification_preferences');
  const prefs = prefsRows?.[0]?.notification_preferences || {};
  if (prefs.enabled === false) return { push: 'disabled' };
  await db('notifications', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      user_id: userId, type: 'custom', title: row.title, body: row.body,
      section: null, entity_id: null, is_read: false
    })
  });
  const subscriptions = await db('push_subscriptions?select=endpoint,subscription&user_id=eq.' + encodeURIComponent(userId));
  if (!Array.isArray(subscriptions) || !subscriptions.length) return { push: 'no_subscription' };
  let sent = 0, failed = 0, removed = 0;
  await Promise.all(subscriptions.map(async (sub) => {
    if (!sub?.subscription?.endpoint || !sub?.endpoint) { failed++; return; }
    try {
      await webpush.sendNotification(sub.subscription, JSON.stringify({
        title: row.title, body: row.body, tag: 'custom-notification-' + row.id, url: '/'
      }), { TTL: 86400, urgency: 'normal' });
      sent++;
    } catch (error) {
      if (error?.statusCode === 404 || error?.statusCode === 410) {
        removed++;
        try { await db('push_subscriptions?endpoint=eq.' + encodeURIComponent(sub.endpoint) + '&user_id=eq.' + encodeURIComponent(userId), { method: 'DELETE', headers: { Prefer: 'return=minimal' } }); } catch (_) {}
      } else failed++;
    }
  }));
  return { push: sent ? 'sent' : (failed ? 'failed' : 'no_subscription'), sent, failed, removed };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  // Internal dispatcher: only production cron with the shared secret can trigger sends.
  if (req.query?.dispatch === '1') {
    const given = (req.headers.authorization || '').replace(/^Bearer /, '');
    if (process.env.VERCEL_ENV !== 'production' || !process.env.CRON_SECRET || !secureEqual(given, process.env.CRON_SECRET)) {
      json(res, 401, { error: 'unauthorized' }); return;
    }
    const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_KEY', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY'];
    if (required.some((key) => !process.env[key])) { json(res, 503, { error: 'push_not_configured' }); return; }
    try {
      const url = new URL(process.env.SUPABASE_URL);
      if (url.protocol !== 'https:' || url.hostname !== 'rzysrvrtkxongcxouywl.supabase.co') {
        json(res, 503, { error: 'push_not_configured' }); return;
      }
      webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@example.com', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
      const due = await db('custom_notifications?status=eq.scheduled&scheduled_at=lte.' + encodeURIComponent(new Date().toISOString()) + '&select=*&order=scheduled_at.asc&limit=50');
      let processed = 0, failed = 0;
      for (const row of (Array.isArray(due) ? due : [])) {
        try {
          const claim = await db('custom_notifications?id=eq.' + encodeURIComponent(row.id) + '&status=eq.scheduled', {
            method: 'PATCH', headers: { Prefer: 'return=representation' },
            body: JSON.stringify({ status: 'processing' })
          });
          if (!Array.isArray(claim) || claim.length === 0) continue;
          let targets = [];
          if (row.audience === 'all') {
            const profiles = await db('profiles?select=id,notification_preferences');
            targets = (profiles || []).filter(p => p?.id && p.notification_preferences?.enabled !== false).map(p => p.id);
          } else if (row.user_id) {
            const profile = await db('profiles?id=eq.' + encodeURIComponent(row.user_id) + '&select=id,notification_preferences');
            if (profile?.[0]?.notification_preferences?.enabled !== false) targets = [row.user_id];
          }
          for (const userId of targets) {
            try { await createForUser(row, userId); } catch (_) { failed++; }
          }
          await db('custom_notifications?id=eq.' + encodeURIComponent(row.id), {
            method: 'PATCH', headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({ status: 'sent', sent_at: new Date().toISOString() })
          });
          processed++;
        } catch (_) {
          failed++;
          try {
            await db('custom_notifications?id=eq.' + encodeURIComponent(row.id) + '&status=eq.processing', {
              method: 'PATCH', headers: { Prefer: 'return=minimal' },
              body: JSON.stringify({ status: 'scheduled' })
            });
          } catch (_) {}
        }
      }
      json(res, 200, { status: 'done', processed, failed }); return;
    } catch (_) { json(res, 500, { error: 'dispatch_failed' }); return; }
  }

  const caller = await getCaller(req);
  if (!caller) { json(res, 401, { error: 'unauthorized' }); return; }
  if (!['preview', 'production'].includes(process.env.VERCEL_ENV)) { json(res, 404, { error: 'not_found' }); return; }

  try {
    if (req.method === 'GET') {
      const filter = caller.is_admin
        ? 'select=*&order=created_at.desc&limit=100'
        : 'select=*&or=(user_id.eq.' + encodeURIComponent(caller.id) + ',audience.eq.all)&order=created_at.desc&limit=50';
      const rows = await db('custom_notifications?' + filter);
      json(res, 200, { notifications: Array.isArray(rows) ? rows : [] }); return;
    }
    if (req.method !== 'POST') { json(res, 405, { error: 'method_not_allowed' }); return; }

    const title = cleanText(req.body?.title, 120);
    const body = cleanText(req.body?.body, 1000);
    const audience = req.body?.audience === 'all' ? 'all' : 'personal';
    const scheduledAt = new Date(req.body?.scheduled_at);
    if (!title || !body || !Number.isFinite(scheduledAt.getTime())) {
      json(res, 400, { error: 'title_body_and_schedule_required' }); return;
    }
    if (scheduledAt.getTime() < Date.now() - 60_000 || scheduledAt.getTime() > Date.now() + 180 * 86400_000) {
      json(res, 400, { error: 'schedule_out_of_range' }); return;
    }
    if (audience === 'all' && !caller.is_admin) { json(res, 403, { error: 'admin_required' }); return; }

    const inserted = await db('custom_notifications', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        created_by: caller.id, user_id: audience === 'personal' ? caller.id : null,
        audience, title, body, scheduled_at: scheduledAt.toISOString(), status: 'scheduled'
      })
    });
    json(res, 201, { status: 'scheduled', notification: inserted?.[0] || null }); return;
  } catch (_) { json(res, 500, { error: 'custom_notification_failed' }); }
}
