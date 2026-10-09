import { createECDH } from 'node:crypto';

const DESTINATION_REF = 'rzysrvrtkxongcxouywl';
const decodeJwtPayload = (value) => {
  try {
    const parts = String(value || '').split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
};
const decodeKey = (value) => Buffer.from(String(value || ''), 'base64url');

export default async function handler(req, res) {
  let stage = 'start';
  try {
    res.setHeader('Cache-Control', 'no-store');
    if (process.env.VERCEL_ENV !== 'preview') {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'method_not_allowed' });
      return;
    }

    stage = 'read_env';
    const urlValue = process.env.SUPABASE_URL || '';
    const anonValue = process.env.SUPABASE_ANON_KEY || '';
    const serviceValue = process.env.SUPABASE_SERVICE_KEY || '';
    const publicValue = process.env.VAPID_PUBLIC_KEY || '';
    const privateValue = process.env.VAPID_PRIVATE_KEY || '';
    const anonClaims = decodeJwtPayload(anonValue);
    const serviceClaims = decodeJwtPayload(serviceValue);

    stage = 'validate_url';
    let urlMatches = false;
    try {
      const parsed = new URL(urlValue);
      urlMatches = parsed.protocol === 'https:' && parsed.hostname === DESTINATION_REF + '.supabase.co';
    } catch {}

    stage = 'database_check';
    let dbStatus = null;
    let pushTableReadable = false;
    if (urlMatches && serviceValue && serviceClaims?.ref === DESTINATION_REF && serviceClaims?.role === 'service_role') {
      try {
        let baseUrl = urlValue;
        while (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
        const response = await fetch(baseUrl + '/rest/v1/push_subscriptions?select=endpoint&limit=0', {
          headers: { apikey: serviceValue, Authorization: 'Bearer ' + serviceValue }
        });
        dbStatus = response.status;
        pushTableReadable = response.ok;
        if (response.body) await response.body.cancel();
      } catch {
        dbStatus = 0;
      }
    }

    stage = 'validate_vapid_pair';
    let vapidPairMatches = false;
    try {
      const pub = decodeKey(publicValue);
      const priv = decodeKey(privateValue);
      const ecdh = createECDH('prime256v1');
      ecdh.setPrivateKey(priv);
      const derived = ecdh.getPublicKey(null, 'uncompressed');
      vapidPairMatches = pub.length === derived.length && pub.equals(derived);
    } catch {}

    const checks = {
      previewOnly: true,
      supabaseUrlConfigured: !!urlValue,
      supabaseUrlMatchesDestination: urlMatches,
      anonKeyConfigured: !!anonValue,
      anonKeyMatchesDestination: anonClaims?.ref === DESTINATION_REF && anonClaims?.role === 'anon',
      serviceKeyConfigured: !!serviceValue,
      serviceKeyIsDestinationServiceRoleJwt: serviceClaims?.ref === DESTINATION_REF && serviceClaims?.role === 'service_role',
      serviceRoleDatabaseStatus: dbStatus,
      pushSubscriptionsTableReadable: pushTableReadable,
      cronSecretConfigured: !!process.env.CRON_SECRET,
      vapidPublicKeyConfigured: !!publicValue,
      vapidPrivateKeyConfigured: !!privateValue,
      vapidKeyPairMatches
    };
    const ready = checks.supabaseUrlMatchesDestination &&
      checks.anonKeyMatchesDestination &&
      checks.serviceKeyIsDestinationServiceRoleJwt &&
      checks.pushSubscriptionsTableReadable &&
      checks.cronSecretConfigured &&
      checks.vapidKeyPairMatches;
    res.status(ready ? 200 : 503).json({ ready, checks });
  } catch (error) {
    const message = String(error?.message || '');
    const safeDetail = /^[A-Za-z_$][A-Za-z0-9_$]* is not defined$/.test(message) ? message : 'see_runtime_logs';
    console.error('push_health_check_failed', stage, error?.name || 'unknown', safeDetail);
    res.status(500).json({ error: 'push_health_check_failed', stage, type: error?.name || 'unknown', detail: safeDetail });
  }
}
