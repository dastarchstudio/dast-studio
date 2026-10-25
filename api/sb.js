// پراکسی سمت سرور به Supabase
// مرورگر فقط با /api/sb/... همین سایت حرف می‌زند؛ vercel.json این مسیر را به /api/sb?__p=... بازنویسی می‌کند
// و این تابع درخواست را به SUPABASE_URL می‌فرستد.
// - کلید عمومی anon را خودِ سرور می‌فرستد؛ هدر apikey از مرورگر نادیده گرفته می‌شود.
// - توکن کاربر (Authorization) عیناً فوروارد می‌شود، پس RLS همچنان اعمال است.
// - کلید service_role هرگز در این مسیر استفاده نمی‌شود.
export const config = { api: { bodyParser: false } };

const ALLOWED_PREFIXES = ['auth/v1/', 'rest/v1/'];
// مسیرهای مدیریتی Auth فقط از سمت سرور (api/admin-reset-password.js) مجازند
const BLOCKED = [/^auth\/v1\/admin(\/|$)/];
const METHODS = ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE'];
const FORWARD_REQUEST_HEADERS = [
  'content-type', 'accept', 'prefer', 'range',
  'accept-profile', 'content-profile', 'x-client-info', 'authorization'
];
const PASS_RESPONSE_HEADERS = ['content-type', 'content-range', 'preference-applied', 'location'];

function supabaseOrigin() {
  let url;
  try { url = new URL(process.env.SUPABASE_URL || ''); } catch { return null; }
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.supabase.co')) return null;
  return url.origin;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// از URL خام، مسیر (__p) و بقیه‌ی query string را بدون تغییر encoding جدا می‌کند
function splitTarget(rawUrl) {
  const qIndex = rawUrl.indexOf('?');
  const rawQuery = qIndex >= 0 ? rawUrl.slice(qIndex + 1) : '';
  let pathValue = '';
  const kept = [];
  for (const part of rawQuery.split('&')) {
    if (!part) continue;
    if (part.startsWith('__p=')) pathValue = decodeURIComponent(part.slice(4));
    else kept.push(part);
  }
  return { path: pathValue, query: kept.length ? '?' + kept.join('&') : '' };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const origin = supabaseOrigin();
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!origin || !anonKey) {
    res.status(503).json({ error: 'proxy_not_configured' });
    return;
  }
  if (!METHODS.includes(req.method)) {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const target = splitTarget(req.url || '');
  const segments = target.path.split('/').filter(Boolean);
  if (segments.some((s) => s === '.' || s === '..' || s.includes('\\'))) {
    res.status(400).json({ error: 'bad_path' });
    return;
  }
  const path = segments.join('/');
  if (!ALLOWED_PREFIXES.some((p) => path.startsWith(p)) || BLOCKED.some((re) => re.test(path))) {
    res.status(403).json({ error: 'path_not_allowed' });
    return;
  }

  // توکن کاربر در صورت وجود جایگزین توکن anon می‌شود (هر دو با حروف کوچک)
  const headers = { apikey: anonKey, authorization: `Bearer ${anonKey}` };
  for (const name of FORWARD_REQUEST_HEADERS) {
    if (req.headers[name] !== undefined) headers[name] = req.headers[name];
  }

  let body;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    body = await readBody(req);
  }

  let upstream;
  try {
    upstream = await fetch(`${origin}/${path}${target.query}`, {
      method: req.method,
      headers,
      body: body && body.length ? body : undefined,
      redirect: 'manual'
    });
  } catch {
    res.status(502).json({ error: 'upstream_unreachable' });
    return;
  }

  res.status(upstream.status);
  for (const name of PASS_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) res.setHeader(name, value);
  }
  const buffer = Buffer.from(await upstream.arrayBuffer());
  res.send(buffer);
}
