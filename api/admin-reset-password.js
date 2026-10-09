import { getCaller, svcHeaders } from './_lib.js';
import { randomBytes } from 'node:crypto';

function makeTempPassword() {
  return 'Dast-' + randomBytes(7).toString('base64url') + '!';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const caller = await getCaller(req);
  if (!caller) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  if (!caller.is_admin) {
    res.status(403).json({ error: 'forbidden' });
    return;
  }

  const { user_id } = req.body || {};
  if (!user_id || !/^[0-9a-f-]{36}$/i.test(user_id)) {
    res.status(400).json({ error: 'bad_request' });
    return;
  }

  const tempPassword = makeTempPassword();

  const r = await fetch(process.env.SUPABASE_URL + '/auth/v1/admin/users/' + encodeURIComponent(user_id), {
    method: 'PUT',
    headers: svcHeaders(),
    body: JSON.stringify({ password: tempPassword })
  });

  if (!r.ok) {
    const body = await r.text().catch(() => '');
    res.status(500).json({ error: 'reset_failed', details: body });
    return;
  }

  await fetch(process.env.SUPABASE_URL + '/rest/v1/account_security_logs', {
    method: 'POST',
    headers: svcHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify({
      user_id,
      performed_by: caller.id,
      action: 'password_reset_by_admin'
    })
  });

  res.status(200).json({ status: 'reset', temp_password: tempPassword });
}
