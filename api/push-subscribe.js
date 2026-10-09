import { getCaller, svcHeaders, restUrl } from './_lib.js';

// ثبت (یا لغو) اعلان برای دستگاه کاربر. هر دستگاه یک «اشتراک» جدا دارد.
export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }
  const caller = await getCaller(req);
  if (!caller) { res.status(401).json({ error: 'unauthorized' }); return; }

  const { action, subscription, endpoint } = req.body || {};
  const ep = encodeURIComponent(action === 'unsubscribe' ? endpoint : (subscription && subscription.endpoint) || '');

  if (action === 'unsubscribe') {
    if (!endpoint || typeof endpoint !== 'string' || !endpoint.startsWith('https://')) {
      res.status(400).json({ error: 'bad_request' }); return;
    }
    try {
      const response = await fetch(restUrl(`push_subscriptions?endpoint=eq.${ep}&user_id=eq.${caller.id}`), {
        method: 'DELETE', headers: svcHeaders({ Prefer: 'return=minimal' })
      });
      if (!response.ok) {
        await response.body?.cancel?.();
        res.status(502).json({ error: 'subscription_remove_failed' }); return;
      }
      res.status(200).json({ status: 'removed' });
    } catch (_) {
      res.status(502).json({ error: 'subscription_remove_failed' });
    }
    return;
  }

  const ok = subscription && typeof subscription.endpoint === 'string' && subscription.endpoint.startsWith('https://')
    && subscription.keys && subscription.keys.p256dh && subscription.keys.auth;
  if (!ok) { res.status(400).json({ error: 'bad_request' }); return; }

  // این دستگاه ممکن است قبلاً با کاربر دیگری ثبت شده باشد؛ ابتدا اشتراک قبلی را پاک می‌کنیم.
  try {
    const removed = await fetch(restUrl(`push_subscriptions?endpoint=eq.${ep}`), {
      method: 'DELETE', headers: svcHeaders({ Prefer: 'return=minimal' })
    });
    if (!removed.ok) {
      await removed.body?.cancel?.();
      res.status(502).json({ error: 'subscription_replace_failed' }); return;
    }
    const response = await fetch(restUrl('push_subscriptions'), {
      method: 'POST',
      headers: svcHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify({ user_id: caller.id, endpoint: subscription.endpoint, subscription })
    });
    if (!response.ok) {
      await response.body?.cancel?.();
      res.status(502).json({ error: 'subscription_save_failed' }); return;
    }
    res.status(200).json({ status: 'saved' });
  } catch (_) {
    res.status(502).json({ error: 'subscription_save_failed' });
  }
}
