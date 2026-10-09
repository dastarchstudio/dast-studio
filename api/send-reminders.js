import webpush from 'web-push';
import { createHash, timingSafeEqual } from 'node:crypto';
import { svcHeaders, restUrl } from './_lib.js';

const TEHRAN_OFFSET_MS = 3.5 * 3600 * 1000;
const sha = (s) => createHash('sha256').update(String(s)).digest();

// فراخوانی‌شده توسط زمان‌بند دیتابیس: kind=in (ساعت ۹) یا kind=out (ساعت ۱۷)
//  - پنج‌شنبه و جمعه ارسال نمی‌شود
//  - ساعت ۹ فقط برای کسانی که هنوز ورود نزده‌اند؛ ساعت ۱۷ فقط برای کسانی که هنوز خروج نزده‌اند
//  - ?dry=1 فقط می‌گوید برای چه کسانی ارسال می‌شود، بدون ارسال
export default async function handler(req, res) {
  const given = (req.headers.authorization || '').replace(/^Bearer /, '');
  if (!process.env.CRON_SECRET || !timingSafeEqual(sha(given), sha(process.env.CRON_SECRET))) {
    res.status(401).json({ error: 'unauthorized' }); return;
  }
  const kind = req.query.kind;
  if (kind !== 'in' && kind !== 'out') { res.status(400).json({ error: 'bad_kind' }); return; }

  const tehranNow = new Date(Date.now() + TEHRAN_OFFSET_MS);
  const weekday = tehranNow.getUTCDay(); // 0=یکشنبه ... 4=پنج‌شنبه 5=جمعه
  if (weekday === 4 || weekday === 5) { res.status(200).json({ status: 'skipped_weekend' }); return; }

  const dayStartUtc = new Date(Date.UTC(tehranNow.getUTCFullYear(), tehranNow.getUTCMonth(), tehranNow.getUTCDate()) - TEHRAN_OFFSET_MS);
  const dayEndUtc = new Date(dayStartUtc.getTime() + 24 * 3600 * 1000);

  const [sr, ar] = await Promise.all([
    fetch(restUrl('push_subscriptions?select=user_id,endpoint,subscription'), { headers: svcHeaders() }),
    fetch(restUrl(`attendance?check_in=gte.${dayStartUtc.toISOString()}&check_in=lt.${dayEndUtc.toISOString()}&select=user_id,check_out`), { headers: svcHeaders() })
  ]);
  const subs = await sr.json(), att = await ar.json();
  if (!Array.isArray(subs) || !Array.isArray(att)) { res.status(500).json({ error: 'db_error' }); return; }

  const hasEntry = new Set(att.map(a => a.user_id));
  const hasOpen = new Set(att.filter(a => !a.check_out).map(a => a.user_id));
  const targets = subs.filter(s => (kind === 'in' ? !hasEntry.has(s.user_id) : hasOpen.has(s.user_id)));

  if (req.query.dry) { res.status(200).json({ status: 'dry', kind, would_send: targets.length, total_devices: subs.length }); return; }

  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@example.com', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  const payload = JSON.stringify(kind === 'in'
    ? { title: '⏰ ساعت ۹ صبح', body: 'یادت نره ورودت رو ثبت کنی.', tag: 'attendance-in', url: '/' }
    : { title: '⏰ ساعت ۵ عصر', body: 'قبل از رفتن، خروجت رو ثبت کن.', tag: 'attendance-out', url: '/' });

  let sent = 0, removed = 0, failed = 0;
  await Promise.all(targets.map(async (s) => {
    try {
      await webpush.sendNotification(s.subscription, payload, { TTL: 3600, urgency: 'high' });
      sent++;
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) {
        removed++;
        await fetch(restUrl(`push_subscriptions?endpoint=eq.${encodeURIComponent(s.endpoint)}`), { method: 'DELETE', headers: svcHeaders() });
      } else failed++;
    }
  }));
  res.status(200).json({ status: 'done', kind, sent, removed, failed });
}
