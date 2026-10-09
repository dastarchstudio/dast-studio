import { getCaller, svcHeaders, restUrl } from './_lib.js';

// ثبت (یا لغو) اعلان برای دستگاه کاربر. هر دستگاه یک «اشتراک» جدا دارد.
export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }
  const caller = await getCaller(req);
  if (!caller) { res.status(401).json({ error: 'unauthorized' }); return; }

  const { action, subscription, endpoint } = req.body || {};
  const ep = encodeURIComponent(action === 'unsubscribe' ? endpoint : (subscription && subscription.endpoint) || '');

  if (action === 'unsubscribe') {
    if (!endpoint) { res.status(400).json({ error: 'bad_request' }); return; }
    await fetch(restUrl(`push_subscriptions?endpoint=eq.${ep}&user_id=eq.${caller.id}`), { method: 'DELETE', headers: svcHeaders() });
    res.status(200).json({ status: 'removed' });
    return;
  }

  const ok = subscription && typeof subscription.endpoint === 'string' && subscription.endpoint.startsWith('https://')
    && subscription.keys && subscription.keys.p256dh && subscription.keys.auth;
  if (!ok) { res.status(400).json({ error: 'bad_request' }); return; }

  // این دستگاه ممکن است قبلاً با کاربر دیگری ثبت شده باشد؛ اول پاک می‌کنیم تا اعلان به حساب درست برسد
  await fetch(restUrl(`push_subscriptions?endpoint=eq.${ep}`), { method: 'DELETE', headers: svcHeaders() });
  const r = await fetch(restUrl('push_subscriptions'), {
    method: 'POST',
    headers: svcHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify({ user_id: caller.id, endpoint: subscription.endpoint, subscription })
  });
  res.status(r.ok ? 200 : 500).json({ status: r.ok ? 'saved' : 'error' });
}
