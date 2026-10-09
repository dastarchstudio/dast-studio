import webpush from 'web-push';
import { getCaller, svcHeaders, restUrl } from './_lib.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  // Allow only Preview and Production. The handler authenticates the caller and targets only that user's devices.
  if (!['preview', 'production'].includes(process.env.VERCEL_ENV)) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const caller = await getCaller(req);
  if (!caller) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_KEY', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY'];
  if (required.some((key) => !process.env[key])) {
    res.status(503).json({ error: 'push_not_configured' });
    return;
  }
  try {
    const url = new URL(process.env.SUPABASE_URL);
    if (url.protocol !== 'https:' || url.hostname !== 'rzysrvrtkxongcxouywl.supabase.co') {
      res.status(503).json({ error: 'push_not_configured' });
      return;
    }
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
  } catch {
    res.status(503).json({ error: 'push_not_configured' });
    return;
  }

  try {
    const profileResponse = await fetch(restUrl('profiles?id=eq.' + encodeURIComponent(caller.id) + '&select=notification_preferences'), {
      headers: svcHeaders()
    });
    if (!profileResponse.ok) {
      await profileResponse.body?.cancel?.();
      res.status(502).json({ error: 'preference_lookup_failed' }); return;
    }
    const profileRows = await profileResponse.json();
    const preferences = Array.isArray(profileRows) && profileRows[0]?.notification_preferences && typeof profileRows[0].notification_preferences === 'object'
      ? profileRows[0].notification_preferences : {};
    if (preferences.enabled === false) {
      res.status(409).json({ error: 'notifications_disabled' }); return;
    }
    const response = await fetch(restUrl('push_subscriptions?select=user_id,endpoint,subscription&user_id=eq.' + encodeURIComponent(caller.id)), {
      headers: svcHeaders()
    });
    if (!response.ok) {
      await response.body?.cancel?.();
      res.status(502).json({ error: 'subscription_lookup_failed' });
      return;
    }
    const subscriptions = await response.json();
    if (!Array.isArray(subscriptions)) {
      res.status(502).json({ error: 'subscription_lookup_failed' });
      return;
    }
    if (subscriptions.length === 0) {
      res.status(200).json({ status: 'no_subscription', sent: 0, failed: 0, removed: 0 });
      return;
    }

    const payload = JSON.stringify({
      title: '🔔 اعلان آزمایشی دَست',
      body: 'اعلان Push روی این دستگاه فعال است.',
      tag: 'dast-push-test',
      url: '/'
    });
    let sent = 0, failed = 0, removed = 0;
    await Promise.all(subscriptions.map(async (row) => {
      if (!row?.endpoint || !row?.subscription?.endpoint) {
        failed++;
        return;
      }
      try {
        await webpush.sendNotification(row.subscription, payload, { TTL: 300, urgency: 'normal' });
        sent++;
      } catch (error) {
        if (error?.statusCode === 404 || error?.statusCode === 410) {
          removed++;
          try {
            await fetch(restUrl('push_subscriptions?endpoint=eq.' + encodeURIComponent(row.endpoint) + '&user_id=eq.' + encodeURIComponent(caller.id)), {
              method: 'DELETE',
              headers: svcHeaders({ Prefer: 'return=minimal' })
            });
          } catch (_) {}
        } else {
          failed++;
        }
      }
    }));

    res.status(sent > 0 ? 200 : 502).json({
      status: sent > 0 ? 'sent' : 'failed',
      sent,
      failed,
      removed
    });
  } catch {
    res.status(500).json({ error: 'push_test_failed' });
  }
}
