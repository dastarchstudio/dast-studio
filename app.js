/* ===== تبدیل تاریخ شمسی/میلادی — jalaali-js (MIT, © Behrang Noruzi Niya) ===== */
const JalaaliLib = (function () {
//#region src/index.ts
/**
* Jalaali years that begin a new 33-year leap cycle. Used by the
* Borkowski algorithm to locate the correct cycle for any given year.
*/
const BREAKS = [
	-61,
	9,
	38,
	199,
	426,
	686,
	756,
	818,
	1111,
	1181,
	1210,
	1635,
	2060,
	2097,
	2192,
	2262,
	2324,
	2394,
	2456,
	3178
];
/** Minimum supported Jalaali year (inclusive). */
const MIN_JALAALI_YEAR = BREAKS[0];
/** Maximum supported Jalaali year (inclusive). */
const MAX_JALAALI_YEAR = BREAKS[BREAKS.length - 1] - 1;
function toJalaali(gyOrDate, gm, gd) {
	if (gyOrDate instanceof Date) return d2j(g2d(gyOrDate.getFullYear(), gyOrDate.getMonth() + 1, gyOrDate.getDate()));
	return d2j(g2d(gyOrDate, gm, gd));
}
/**
* Converts a Jalaali date to Gregorian.
*
* @example
* toGregorian(1395, 1, 23) // { gy: 2016, gm: 4, gd: 11 }
*
* @throws {RangeError} if `jy` falls outside `[-61, 3177]`.
*/
function toGregorian(jy, jm, jd) {
	return d2g(j2d(jy, jm, jd));
}
/**
* Returns `true` if `(jy, jm, jd)` is a real date in the Jalaali calendar.
*
* The check is **lenient** — non-integer inputs that happen to fall inside
* the allowed numeric ranges are accepted. Pass integers in production code.
*
* @example
* isValidJalaaliDate(1394, 12, 30) // false (1394 is a common year)
* isValidJalaaliDate(1395, 12, 30) // true  (1395 is leap)
*/
function isValidJalaaliDate(jy, jm, jd) {
	return jy >= MIN_JALAALI_YEAR && jy <= MAX_JALAALI_YEAR && jm >= 1 && jm <= 12 && jd >= 1 && jd <= jalaaliMonthLength(jy, jm);
}
/**
* Returns `true` if the given Jalaali year is leap (366 days).
*
* @example
* isLeapJalaaliYear(1394) // false
* isLeapJalaaliYear(1395) // true
*
* @throws {RangeError} if `jy` falls outside `[-61, 3177]`.
*/
function isLeapJalaaliYear(jy) {
	return jalCalLeap(jy) === 0;
}
/**
* Returns the number of days in the given Jalaali month.
*
* The function trusts its inputs: `jm` is not range-checked, and an
* out-of-range `jm` will return whichever branch happens to match.
* For input validation, use {@link isValidJalaaliDate} instead.
*
* @example
* jalaaliMonthLength(1394, 12) // 29 (common year)
* jalaaliMonthLength(1395, 12) // 30 (leap year)
*/
function jalaaliMonthLength(jy, jm) {
	if (jm <= 6) return 31;
	if (jm <= 11) return 30;
	return isLeapJalaaliYear(jy) ? 30 : 29;
}
/**
* Computes the leap-cycle state of a Jalaali year and the Gregorian date
* of Farvardin 1 in that year.
*
* Use this directly when you need the leap field; if you only need
* `{ gy, march }`, prefer {@link jalCalShort}.
*
* @example
* jalCal(1391) // { leap: 0, gy: 2012, march: 20 }
* jalCal(1395) // { leap: 0, gy: 2016, march: 20 }
*
* @throws {RangeError} if `jy` falls outside `[-61, 3177]`.
*/
function jalCal(jy) {
	const { gy, march, jump, n } = jalCalCore(jy);
	return {
		leap: leapFromCycle(jump, n),
		gy,
		march
	};
}
/**
* Like {@link jalCal} but omits the leap-cycle computation.
*
* @remarks
* Equivalent to v1's `jalCal(jy, true)` — extracted to its own export
* in v2 to give it a proper return type. Prefer this when the leap field
* isn't needed; it avoids a small amount of work per call.
*
* @example
* jalCalShort(1391) // { gy: 2012, march: 20 }
*
* @throws {RangeError} if `jy` falls outside `[-61, 3177]`.
*/
function jalCalShort(jy) {
	const { gy, march } = jalCalCore(jy);
	return {
		gy,
		march
	};
}
/**
* Converts a Jalaali date to a Julian Day number.
*
* The result is an integer corresponding to noon UT on the given calendar
* day. Inputs are not range-checked — pass valid dates.
*
* @example
* j2d(1395, 1, 23) // 2457490
*/
function j2d(jy, jm, jd) {
	const r = jalCalShort(jy);
	return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}
const FIRST_JALAALI_JDN = j2d(MIN_JALAALI_YEAR, 1, 1);
const LAST_JALAALI_JDN = j2d(MAX_JALAALI_YEAR, 12, jalaaliMonthLength(MAX_JALAALI_YEAR, 12));
/**
* Converts a Julian Day number to a Jalaali date.
*
* @example
* d2j(2457490) // { jy: 1395, jm: 1, jd: 23 }
*
* @throws {RangeError} if `jdn` falls outside the supported Jalaali range
*   `[-61, 3177]`.
*/
function d2j(jdn) {
	if (jdn < FIRST_JALAALI_JDN || jdn > LAST_JALAALI_JDN) throw new RangeError(`Invalid Julian Day number ${jdn}: outside the supported Jalaali range [${MIN_JALAALI_YEAR}, ${MAX_JALAALI_YEAR}]`);
	const gy = d2g(jdn).gy;
	let jy = Math.min(gy - 621, MAX_JALAALI_YEAR);
	const r = jalCal(jy);
	let k = jdn - g2d(r.gy, 3, r.march);
	if (k >= 0) {
		if (k <= 185) return {
			jy,
			jm: 1 + div(k, 31),
			jd: mod(k, 31) + 1
		};
		k -= 186;
	} else {
		jy -= 1;
		k += 179;
		if (r.leap === 1) k += 1;
	}
	return {
		jy,
		jm: 7 + div(k, 30),
		jd: mod(k, 30) + 1
	};
}
/**
* Converts a Gregorian date to a Julian Day number.
*
* Tested correct from 1 March, -100100 (of both calendars) through several
* million years into the future.
*
* @example
* g2d(2016, 4, 11) // 2457490
*/
function g2d(gy, gm, gd) {
	let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408;
	d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
	return d;
}
/**
* Converts a Julian Day number to a Gregorian date.
*
* Valid for `jdn ≥ -34839655` (year -100100 of both calendars).
*
* @example
* d2g(2457490) // { gy: 2016, gm: 4, gd: 11 }
*/
function d2g(jdn) {
	let j = 4 * jdn + 139361631;
	j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
	const i = div(mod(j, 1461), 4) * 5 + 308;
	const gd = div(mod(i, 153), 5) + 1;
	const gm = mod(div(i, 153), 12) + 1;
	return {
		gy: div(j, 1461) - 100100 + div(8 - gm, 6),
		gm,
		gd
	};
}
/**
* Converts a Jalaali date (optionally with a time of day) to a JavaScript
* `Date` constructed in the local time zone.
*
* Time components default to `0`. Out-of-range time components are *not*
* clamped — they overflow the way the `Date` constructor handles them
* (e.g. `h = 25` rolls into the next day).
*
* @example
* jalaaliToDateObject(1400, 4, 30)
*   // → new Date(2021, 6, 21, 0, 0, 0, 0)
*
* jalaaliToDateObject(1400, 4, 30, 14, 30)
*   // → new Date(2021, 6, 21, 14, 30)
*/
function jalaaliToDateObject(jy, jm, jd, h = 0, m = 0, s = 0, ms = 0) {
	const g = toGregorian(jy, jm, jd);
	return new Date(g.gy, g.gm - 1, g.gd, h, m, s, ms);
}
/**
* Returns the Saturday and Friday bounding the Jalaali week that contains
* the given date. The Jalaali week starts on **Saturday**.
*
* @example
* jalaaliWeek(1400, 4, 30)
*   // → { saturday: { jy: 1400, jm: 4, jd: 26 },
*   //     friday:   { jy: 1400, jm: 5, jd:  1 } }
*
* @remarks
* Uses {@link jalaaliToDateObject} to read the day-of-week, which reflects
* the host's local time zone. For dates near a DST boundary the underlying
* `Date.getDay()` is still correct because the conversion is done in local
* time on both sides.
*/
function jalaaliWeek(jy, jm, jd) {
	const dayOfWeek = jalaaliToDateObject(jy, jm, jd).getDay();
	const startDayDifference = dayOfWeek === 6 ? 0 : -(dayOfWeek + 1);
	const endDayDifference = 6 + startDayDifference;
	return {
		saturday: d2j(j2d(jy, jm, jd + startDayDifference)),
		friday: d2j(j2d(jy, jm, jd + endDayDifference))
	};
}
/**
* Core of the Borkowski algorithm: locate the Jalaali year inside the
* cycle table and compute Farvardin 1's Gregorian date.
*/
function jalCalCore(jy) {
	if (!Number.isFinite(jy) || jy < MIN_JALAALI_YEAR || jy > MAX_JALAALI_YEAR) throw new RangeError(`Invalid Jalaali year ${jy}: must be a finite number between ${MIN_JALAALI_YEAR} and ${MAX_JALAALI_YEAR} (inclusive)`);
	const gy = jy + 621;
	let leapJ = -14;
	let jp = BREAKS[0];
	let jm = 0;
	let jump = 0;
	for (let i = 1; i < BREAKS.length; i += 1) {
		jm = BREAKS[i];
		jump = jm - jp;
		if (jy < jm) break;
		leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
		jp = jm;
	}
	const n = jy - jp;
	leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
	if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
	const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
	return {
		gy,
		march: 20 + leapJ - leapG,
		jump,
		n
	};
}
/**
* Given a 33-year cycle length `jump` and the year offset `n` within that
* cycle, returns the number of years since the last leap year (`0 … 4`).
* `0` means the current year is leap.
*/
function leapFromCycle(jump, n) {
	let adjusted = n;
	if (jump - n < 6) adjusted = n - jump + div(jump + 4, 33) * 33;
	let leap = mod(mod(adjusted + 1, 33) - 1, 4);
	if (leap === -1) leap = 4;
	return leap;
}
/**
* Leap-only variant — same loop as {@link jalCalCore} without computing
* the Gregorian fields. Kept separate to avoid the per-call object
* allocation on the hot `isLeapJalaaliYear` path.
*/
function jalCalLeap(jy) {
	if (!Number.isFinite(jy) || jy < MIN_JALAALI_YEAR || jy > MAX_JALAALI_YEAR) throw new RangeError(`Invalid Jalaali year ${jy}: must be a finite number between ${MIN_JALAALI_YEAR} and ${MAX_JALAALI_YEAR} (inclusive)`);
	let jp = BREAKS[0];
	let jm = 0;
	let jump = 0;
	for (let i = 1; i < BREAKS.length; i += 1) {
		jm = BREAKS[i];
		jump = jm - jp;
		if (jy < jm) break;
		jp = jm;
	}
	return leapFromCycle(jump, jy - jp);
}
/**
* Integer division — `Math.trunc(a / b)` equivalent that's faster on V8
* for values that fit in 32 bits. Used pervasively inside the algorithm.
*/
function div(a, b) {
	return ~~(a / b);
}
/**
* Mathematical modulo — like `%` but always returns a non-negative result
* when `b` is positive (matches Python's `%` semantics, not JavaScript's).
*/
function mod(a, b) {
	return a - ~~(a / b) * b;
}
//#endregion
return { toJalaali, toGregorian, isValidJalaaliDate, jalaaliMonthLength };
})();

const STUDIO_LOGO_LIGHT_URL = '/assets/logo_blue.svg';
const STUDIO_LOGO_DARK_URL = '/assets/logo_white.svg';
function studioLogoUrl() {
  return document.body.classList.contains('dark') ? STUDIO_LOGO_DARK_URL : STUDIO_LOGO_LIGHT_URL;
}
function updateStudioLogos() {
  const url = studioLogoUrl();
  document.querySelectorAll('[data-studio-logo]').forEach(img => {
    if (img.getAttribute('src') !== url) img.setAttribute('src', url);
  });
}
const SUPABASE_URL = "https://ooeedxwyjpcgurxeutdb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vZWVkeHd5anBjZ3VyeGV1dGRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwNzM4NTEsImV4cCI6MjEwNTY0OTg1MX0.ZbDel9uPG0sSsdzWRbgvrH_inLA7IafmprYTpqhTPXQ";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const STAGES = ["سرنخ جدید", "تماس اولیه", "جلسه برگزار شد", "پیشنهاد ارسال شد", "برنده", "بازنده"];
const SPECIALTIES = ["ورزشی", "مسکونی", "تجاری-اداری", "بازسازی بافت فرسوده", "سایر"];
const CLIENT_TYPES = ["خصوصی-مسکونی", "شرکتی-تجاری‌اداری", "دولتی-نهادی"];
const PHASES = ["فاز صفر", "طراحی مفهومی", "طراحی تفصیلی (DD)", "اجرا", "نظارت", "تکمیل‌شده"];
const PROJECT_STATUSES = ["فعال", "متوقف", "لغوشده", "تکمیل‌شده"];
const CONTRACT_STATUSES = ["پیش‌نویس", "امضاشده", "فسخ‌شده"];
const DEPARTMENTS = ["طراحی و اجرا - معماری", "طراحی و اجرا - داخلی", "طراحی و اجرا - نظارت", "توسعه بازار و ورزشی", "مالی و قرارداد", "مدیریت پروژه"];
const ACCESS_LEVELS = ["مشاهده", "تعامل", "مدیریت"];
const TASK_PRIORITIES = ["بالا", "متوسط", "پایین"];
const TASK_STATUSES = ["در انتظار", "در حال انجام", "تکمیل‌شده"];
const TENDER_TYPES = ["مناقصه", "مسابقه"];
const TENDER_STATUSES = ["در حال بررسی", "ثبت‌نام‌شده", "برنده", "بازنده"];

let currentUser = null, currentProfile = null;
let attendanceTimer = null, activeCheckIn = null;
let attendanceReady = false;
let attendanceStatusPromise = null;
let notificationChannel = null;
let notifications = [];
let notificationPreferences = {
  enabled: true,
  task_new: true,
  task_due: true,
  attendance_check_in: true,
  attendance_check_out: true
};
let allProfiles = [];

let personalTasks = [], teamPersonalTasks = [];
let leads = [], clients = [], projects = [], contracts = [], contractStagesMap = {},
    members = [], erpTasks = [], fixedCosts = [], tenders = [], interactions = [];


function toFaDigits(str) { return String(str).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]); }

// نمایش تاریخ: از میلادی (ذخیره‌شده در دیتابیس) به شمسی
function fmtDate(iso) {
  if (!iso) return '';
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(iso);
  const j = JalaaliLib.toJalaali(+m[1], +m[2], +m[3]);
  return toFaDigits(`${j.jy}/${String(j.jm).padStart(2, '0')}/${String(j.jd).padStart(2, '0')}`);
}

// انتخاب تاریخ شمسی با سه کشویی (سال / ماه / روز)
function jalaliDateField(id, iso) {
  const now = new Date();
  const cur = JalaaliLib.toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const m = iso ? String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/) : null;
  const sel = m ? JalaaliLib.toJalaali(+m[1], +m[2], +m[3]) : null;
  let y0 = cur.jy - 2, y1 = cur.jy + 5;
  if (sel) { y0 = Math.min(y0, sel.jy); y1 = Math.max(y1, sel.jy); }
  let years = '<option value="">سال</option>';
  for (let y = y0; y <= y1; y++) years += `<option value="${y}" ${sel && sel.jy === y ? 'selected' : ''}>${toFaDigits(y)}</option>`;
  const months = '<option value="">ماه</option>' + JALALI_MONTHS.map((n, i) => `<option value="${i + 1}" ${sel && sel.jm === i + 1 ? 'selected' : ''}>${n}</option>`).join('');
  let days = '<option value="">روز</option>';
  for (let d = 1; d <= 31; d++) days += `<option value="${d}" ${sel && sel.jd === d ? 'selected' : ''}>${toFaDigits(d)}</option>`;
  return `<span class="jdate" id="${id}"><select>${years}</select><select>${months}</select><select>${days}</select></span>`;
}
// خواندن تاریخ انتخاب‌شده: خروجی میلادی «YYYY-MM-DD» یا null اگر کامل انتخاب نشده
function getJalaliDate(id) {
  const box = document.getElementById(id); if (!box) return null;
  const [ys, ms, ds] = box.querySelectorAll('select');
  const jy = parseInt(ys.value), jm = parseInt(ms.value);
  let jd = parseInt(ds.value);
  if (!jy || !jm || !jd) return null;
  jd = Math.min(jd, JalaaliLib.jalaaliMonthLength(jy, jm));
  const g = JalaaliLib.toGregorian(jy, jm, jd);
  return `${g.gy}-${String(g.gm).padStart(2, '0')}-${String(g.gd).padStart(2, '0')}`;
}
function clearJalaliDate(id) {
  const box = document.getElementById(id);
  if (box) box.querySelectorAll('select').forEach(x => { x.value = ''; });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function statusLabel(s) {
  if (s === 'new') return '<span class="status-badge status-new">جدید</span>';
  if (s === 'progress') return '<span class="status-badge status-progress">در حال انجام</span>';
  return '<span class="status-badge status-done">تکمیل شده</span>';
}
function scoreClass(n) { return n >= 4 ? 'high' : n >= 3 ? 'mid' : 'low'; }

let sessionToken = null;
async function authHeader() {
  if (!sessionToken) { const { data } = await sb.auth.getSession(); sessionToken = data.session ? data.session.access_token : null; }
  return { Authorization: 'Bearer ' + sessionToken };
}
async function apiPost(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeader()) }, body: JSON.stringify(body || {}) });
  return r.json().catch(() => ({}));
}

const DEFAULT_NOTIFICATION_PREFERENCES = {
  enabled: true,
  task_new: true,
  task_due: true,
  attendance_check_in: true,
  attendance_check_out: true
};

function normalizeNotificationPreferences(value) {
  return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...(value && typeof value === 'object' ? value : {}) };
}

async function loadNotificationPreferences() {
  notificationPreferences = normalizeNotificationPreferences(currentProfile?.notification_preferences);
  if (!currentUser?.id) return notificationPreferences;
  const { data, error } = await sb.from('profiles').select('notification_preferences').eq('id', currentUser.id).single();
  if (!error && data) notificationPreferences = normalizeNotificationPreferences(data.notification_preferences);
  if (currentProfile) currentProfile.notification_preferences = notificationPreferences;
  return notificationPreferences;
}

async function saveNotificationPreferences(patch) {
  const next = normalizeNotificationPreferences({ ...notificationPreferences, ...patch });
  const { data, error } = await sb.from('profiles').update({ notification_preferences: next }).eq('id', currentUser.id).select('notification_preferences').single();
  if (error) {
    alert('ذخیره تنظیمات اعلان انجام نشد: ' + error.message);
    return false;
  }
  notificationPreferences = normalizeNotificationPreferences(data?.notification_preferences || next);
  if (currentProfile) currentProfile.notification_preferences = notificationPreferences;
  return true;
}

function notificationPreferenceEnabled(key = 'enabled') {
  return !!notificationPreferences.enabled && notificationPreferences[key] !== false;
}

function notificationPreferenceKey(notification) {
  if (notification?.type === 'task' || notification?.type === 'task_new') return 'task_new';
  if (notification?.type === 'deadline' || notification?.type === 'task_due' || notification?.type === 'due') return 'task_due';
  return 'enabled';
}

async function syncPushSubscriptionWithPreferences() {
  if (!pushSupported() || !swReg) return;
  const sub = await swReg.pushManager.getSubscription();
  if (notificationPreferences.enabled && 'Notification' in window && Notification.permission === 'granted') {
    if (!sub) await subscribeToPush();
    return;
  }
  if (sub) {
    try { await apiPost('/api/push-subscribe', { action: 'unsubscribe', endpoint: sub.endpoint }); } catch (_) {}
    try { await sub.unsubscribe(); } catch (_) {}
  }
}

// ================= AUTH =================
async function doLogin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const email = username + '@daftar.local';
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) { document.getElementById('login-error').innerText = "نام کاربری یا رمز عبور اشتباه است."; return; }
  currentUser = data.user;
  sessionToken = data.session.access_token;
  await loadProfileAndShowApp();
}
async function doLogout() {
  if (taskChannel) { sb.removeChannel(taskChannel); taskChannel = null; }
  if (notificationChannel) { sb.removeChannel(notificationChannel); notificationChannel = null; }
  try {
    const sub = swReg && await swReg.pushManager.getSubscription();
    if (sub) { await apiPost('/api/push-subscribe', { action: 'unsubscribe', endpoint: sub.endpoint }); }
  } catch (e) {}
  await sb.auth.signOut();
  sessionToken = null;
  clearInterval(attendanceTimer);
  document.getElementById('app-root').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
}
async function checkSession() {
  const { data } = await sb.auth.getSession();
  if (data.session) { currentUser = data.session.user; sessionToken = data.session.access_token; await loadProfileAndShowApp(); }
}

function showForgotPassword() {
  const root=document.getElementById('edit-modal-root');
  root.innerHTML=`<div class="overlay" onclick="if(event.target===this)this.remove()"><div class="modal">
    <h3>فراموشی رمز عبور</h3>
    <p style="font-size:13px;line-height:1.9;margin:0;color:var(--text)">
      در حال حاضر حساب‌های دفتر با نام کاربری داخلی ساخته شده‌اند و ایمیل بازیابی ندارند.
      برای امنیت، رمزها در هیچ جدول دیتابیسی به‌صورت قابل‌خواندن نگهداری نمی‌شوند.
    </p>
    <div class="card" style="margin:14px 0;background:var(--bg)">
      <strong>راه‌حل:</strong>
      <div style="font-size:12px;color:var(--muted);margin-top:6px;line-height:1.8">
        با مدیر دفتر تماس بگیر؛ مدیر از بخش «تیم» می‌تواند رمز این حساب را ریست کند و یک رمز موقت بگیرد.
      </div>
    </div>
    <div class="modal-actions"><button class="btn" onclick="this.closest('.overlay').remove()">متوجه شدم</button></div>
  </div></div>`;
}

async function changeMyPassword() {
  const next = prompt('رمز جدید را وارد کنید (حداقل ۸ کاراکتر):');
  if (next === null) return;
  if (next.length < 8) { alert('رمز باید حداقل ۸ کاراکتر باشد.'); return; }
  const { error } = await sb.auth.updateUser({ password: next });
  if (error) { alert('تغییر رمز انجام نشد: ' + error.message); return; }
  showToast('رمز عبور با موفقیت تغییر کرد ✅');
}

async function resetUserPassword(userId, userName) {
  if (!currentProfile?.is_admin) return;
  if (!confirm('رمز ورود «' + userName + '» ریست شود؟')) return;
  const r = await apiPost('/api/admin-reset-password', { user_id: userId });
  if (!r || r.status !== 'reset') {
    alert('ریست رمز انجام نشد. دوباره تلاش کن.');
    return;
  }
  const root=document.getElementById('edit-modal-root');
  root.innerHTML=`<div class="overlay"><div class="modal">
    <h3>🔐 رمز موقت ساخته شد</h3>
    <p style="font-size:13px;line-height:1.8">
      رمز موقت کاربر <strong>${escapeHtml(userName)}</strong>:
    </p>
    <div style="direction:ltr;text-align:center;font-size:20px;font-weight:800;background:var(--bg);border:1px solid var(--border);padding:12px;border-radius:10px;word-break:break-all;">${escapeHtml(r.temp_password)}</div>
    <p style="font-size:11px;color:var(--muted);margin-bottom:0;">این رمز فقط همین بار نمایش داده می‌شود. آن را برای کاربر ارسال کنید و از او بخواهید بعد از ورود رمز خودش را تغییر دهد.</p>
    <div class="modal-actions">
      <button class="btn secondary" onclick="navigator.clipboard?.writeText(${JSON.stringify(r.temp_password)});showToast('رمز کپی شد');">کپی رمز</button>
      <button class="btn" onclick="this.closest('.overlay').remove()">بستن</button>
    </div>
  </div></div>`;
}

const NAV_ITEMS = [
  { id: 'dashboard', label: 'داشبورد', icon: '⌂', group: 'main' },
  { id: 'attendance', label: 'ورود و خروج', icon: '◷', group: 'main' },
  { id: 'tasks', label: 'کارها', icon: '✓', group: 'workspace' },
  { id: 'calendar', label: 'تقویم', icon: '□', group: 'workspace' },
  { id: 'material-lab', label: 'آزمایشگاه متریال', icon: '▦', group: 'main' },
  { id: 'file-namer', label: 'نام‌گذار فایل', icon: '✎', group: 'main' },
  { id: 'pipeline', label: 'سرنخ‌ها', icon: '◇', group: 'crm', adminOnly: true },
  { id: 'clients', label: 'کارفرمایان', icon: '♙', group: 'crm', adminOnly: true },
  { id: 'projects', label: 'پروژه‌ها', icon: '⌂', group: 'crm', adminOnly: true },
  { id: 'contracts', label: 'قراردادها', icon: '▤', group: 'finance', adminOnly: true },
  { id: 'costs', label: 'هزینه‌های ثابت', icon: '◉', group: 'finance', adminOnly: true },
  { id: 'tenders', label: 'مناقصه / مسابقه', icon: '◆', group: 'finance', adminOnly: true },
  { id: 'employees', label: 'کارکنان', icon: '♙', group: 'people' },
  { id: 'team', label: 'مدیریت تیم', icon: '⚙', group: 'people', adminOnly: true },
];

const NAV_GROUPS = [
  { id: 'main', label: 'اصلی' },
  { id: 'workspace', label: 'فضای کاری' },
  { id: 'crm', label: 'مدیریت دفتر', adminOnly: true },
  { id: 'finance', label: 'مالی و فرصت‌ها', adminOnly: true },
  { id: 'people', label: 'تیم و کارکنان' },
];

const SECTION_TITLES = {
  ...Object.fromEntries(NAV_ITEMS.map(item => [item.id, item.label])),
  'erp-tasks': 'وظایف مدیریتی',
  'office-tasks': 'کارهای مرتبط با کارفرما',
  'notification-settings': 'اعلان‌ها'
};

let activeSectionId = 'dashboard';
let openNavGroups = new Set(['main']);

function buildNav(activeId = activeSectionId) {
  const nav = document.getElementById('top-nav');
  if (!nav) return;

  activeSectionId = activeId || activeSectionId || 'dashboard';
  const visibleItems = NAV_ITEMS.filter(item => !item.adminOnly || currentProfile?.is_admin);
  const visibleGroups = NAV_GROUPS.filter(group =>
    (!group.adminOnly || currentProfile?.is_admin) &&
    visibleItems.some(item => item.group === group.id)
  );

  const activeItem = visibleItems.find(item => item.id === activeSectionId);
  if (activeItem) openNavGroups.add(activeItem.group);

  const groupHtml = visibleGroups.map(group => {
    const items = visibleItems.filter(item => item.group === group.id);
    const isOpen = openNavGroups.has(group.id);
    return `
      <section class="sidebar-group ${isOpen ? 'is-open' : ''}" data-nav-group="${group.id}">
        <button type="button" class="sidebar-group-toggle" onclick="toggleNavGroup('${group.id}')" aria-expanded="${isOpen}">
          <span>${group.label}</span><span class="sidebar-group-chevron">⌄</span>
        </button>
        <div class="sidebar-group-items">
          ${items.map(item => `
            <button type="button" class="sidebar-nav-item ${item.id === activeSectionId ? 'active' : ''}" data-id="${item.id}" onclick="switchSection('${item.id}')">
              <span class="sidebar-nav-icon" aria-hidden="true">${item.icon || '•'}</span>
              <span class="sidebar-nav-label">${item.label}</span>
              ${item.id === activeSectionId ? '<span class="sidebar-nav-active-dot" aria-hidden="true"></span>' : ''}
            </button>`).join('')}
        </div>
      </section>`;
  }).join('');

  nav.innerHTML = `
    <div class="sidebar-head">
      <div class="sidebar-brand">
        <div class="sidebar-brand-mark"><img data-studio-logo src="${studioLogoUrl()}" alt="لوگوی استودیو معماری دَست" loading="eager"></div>
        <div><strong>استودیو معماری دَست</strong><span>ERP مدیریت دفتر</span></div>
      </div>
      <button type="button" class="sidebar-mobile-close" onclick="setSidebarOpen(false)" aria-label="بستن منو">×</button>
    </div>
    <div class="sidebar-scroll">${groupHtml}</div>
    <div class="sidebar-foot">
      <button type="button" class="sidebar-settings" onclick="openSettingsCenter()"><span class="sidebar-settings-icon">⚙️</span><span>تنظیمات</span></button>
      <button type="button" class="sidebar-logout" onclick="doLogout()"><span class="sidebar-logout-icon">↪</span><span>خروج از حساب</span></button>
      <div class="sidebar-foot-note"><span class="sidebar-foot-dot"></span><span>پنل داخلی استودیو معماری دَست</span></div>
    </div>`;
}

function updateMobileBottomNav(activeId = activeSectionId) {
  const root = document.getElementById('mobile-bottom-nav');
  if (!root) return;
  root.querySelectorAll('[data-mobile-section]').forEach(btn => {
    const active = btn.dataset.mobileSection === activeId;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-current', active ? 'page' : 'false');
  });
}

function toggleNavGroup(groupId) {
  const nav = document.getElementById('top-nav');
  const group = nav?.querySelector('[data-nav-group="' + groupId + '"]');
  const nextOpen = !openNavGroups.has(groupId);
  if (nextOpen) openNavGroups.add(groupId);
  else openNavGroups.delete(groupId);

  if (group) {
    group.classList.toggle('is-open', nextOpen);
    const toggle = group.querySelector('.sidebar-group-toggle');
    if (toggle) toggle.setAttribute('aria-expanded', String(nextOpen));
  } else {
    buildNav(activeSectionId);
  }
}

function setSidebarOpen(open) {
  document.body.classList.toggle('sidebar-open', !!open);
  const backdrop = document.getElementById('sidebar-backdrop');
  if (backdrop) {
    backdrop.setAttribute('aria-hidden', open ? 'false' : 'true');
    backdrop.classList.toggle('hidden', !open);
  }
}

function toggleSidebar() {
  setSidebarOpen(!document.body.classList.contains('sidebar-open'));
}

function updateHeaderContext(id = activeSectionId) {
  const label = id === 'profile' ? 'پروفایل من' : (SECTION_TITLES[id] || 'داشبورد');
  const title = document.getElementById('header-page-title');
  const date = document.getElementById('header-page-date');
  const contentTitle = document.getElementById('content-page-title');
  const contentDate = document.getElementById('content-page-date');
  if (title) title.textContent = label;
  if (contentTitle) contentTitle.textContent = label;
  if (date) {
    const now = new Date();
    try {
      const j = JalaaliLib.toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate());
      const dateLabel = `${toFaDigits(j.jd)} ${JALALI_MONTHS[j.jm - 1]} ${toFaDigits(j.jy)}`;
      date.textContent = dateLabel;
      if (contentDate) contentDate.textContent = dateLabel;
      const mobileDate = document.getElementById('header-mobile-date');
      if (mobileDate) mobileDate.textContent = dateLabel;
    } catch (_) {
      date.textContent = '';
      if (contentDate) contentDate.textContent = '';
      const mobileDate = document.getElementById('header-mobile-date');
      if (mobileDate) mobileDate.textContent = '';
    }
  }
}

function openSettingsCenter() {
  const root = document.getElementById('edit-modal-root');
  if (!root) return;
  const isDark = document.body.classList.contains('dark');
  const standalone = isStandalone();
  const ios = isIOS();
  const notifSupported = pushSupported();
  const notifGranted = notifSupported && 'Notification' in window && Notification.permission === 'granted';
  const calendarConnected = !!googleStatus?.me?.connected && !googleStatus?.me?.needs_reconnect;
  const calendarNeedsReconnect = !!googleStatus?.me?.needs_reconnect;

  root.innerHTML = `
    <div class="overlay settings-overlay" onclick="if(event.target===this)this.remove()">
      <div class="modal settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-modal-title">
        <div class="settings-modal-head">
          <div>
            <div class="settings-kicker">استودیو معماری دَست</div>
            <h3 id="settings-modal-title">⚙️ تنظیمات</h3>
            <p>تنظیمات این دستگاه، ظاهر پنل و حساب کاربری</p>
          </div>
          <button class="header-icon-btn settings-close" type="button" onclick="this.closest('.overlay').remove()" aria-label="بستن">×</button>
        </div>

        <div class="settings-date-card">
          <span>📅 امروز</span>
          <strong id="settings-current-date">—</strong>
        </div>

        <div class="settings-list">
          <button type="button" class="settings-row" onclick="toggleDarkMode();openSettingsCenter()">
            <span class="settings-row-icon">${isDark ? '☀️' : '🌙'}</span>
            <span class="settings-row-copy"><strong>ظاهر پنل</strong><small>${isDark ? 'حالت تیره فعال است؛ برای روشن شدن بزن' : 'حالت روشن فعال است؛ برای تیره شدن بزن'}</small></span>
            <span class="settings-row-action">${isDark ? 'روشن' : 'تیره'}</span>
          </button>

          <button type="button" class="settings-row" onclick="this.closest('.overlay').remove();switchSection('notification-settings')">
            <span class="settings-row-icon">🔔</span>
            <span class="settings-row-copy"><strong>اعلان‌ها</strong><small>${notifGranted ? 'اعلان‌های این دستگاه فعال است' : notifSupported ? 'اعلان هنوز فعال نشده' : 'این مرورگر اعلان وب را پشتیبانی نمی‌کند'}</small></span>
            <span class="settings-row-action">${notifGranted ? 'فعال ✓' : 'فعال‌سازی'}</span>
          </button>

          <button type="button" class="settings-row" onclick="installApp();setTimeout(openSettingsCenter,500)">
            <span class="settings-row-icon">📲</span>
            <span class="settings-row-copy"><strong>نصب اپ روی گوشی</strong><small>${standalone ? 'اپ روی این دستگاه نصب شده است' : ios ? 'راهنمای نصب روی آیفون' : 'نصب PWA روی صفحه اصلی'}</small></span>
            <span class="settings-row-action">${standalone ? 'نصب شده ✓' : 'نصب'}</span>
          </button>

          <button type="button" class="settings-row" onclick="connectCalendar();setTimeout(openSettingsCenter,700)">
            <span class="settings-row-icon">📅</span>
            <span class="settings-row-copy"><strong>تقویم گوگل</strong><small>${calendarNeedsReconnect ? 'اتصال نیاز به بازسازی دارد' : calendarConnected ? 'تقویم متصل است' : 'تقویم هنوز متصل نیست'}</small></span>
            <span class="settings-row-action">${calendarConnected ? 'متصل ✓' : 'اتصال'}</span>
          </button>

          <button type="button" class="settings-row" onclick="changeMyPassword()">
            <span class="settings-row-icon">🔐</span>
            <span class="settings-row-copy"><strong>امنیت حساب</strong><small>رمز ورود را تغییر بده</small></span>
            <span class="settings-row-action">تغییر</span>
          </button>

          <button type="button" class="settings-row" onclick="this.closest('.overlay').remove();switchSection('profile')">
            <span class="settings-row-icon">👤</span>
            <span class="settings-row-copy"><strong>پروفایل من</strong><small>نام، دپارتمان، سمت و آواتار</small></span>
            <span class="settings-row-action">باز کردن</span>
          </button>

          <button type="button" class="settings-row" onclick="this.closest('.overlay').remove();switchSection('attendance')">
            <span class="settings-row-icon">⏱️</span>
            <span class="settings-row-copy"><strong>حضور و غیاب</strong><small>ثبت ورود و خروج و مشاهده سابقه</small></span>
            <span class="settings-row-action">مشاهده</span>
          </button>
        </div>

        <div class="settings-reminder">
          <span>⏰ یادآورها</span>
          <small>ورود ساعت ۰۹:۰۰ و خروج ساعت ۱۷:۰۰ در صورت فعال بودن اعلان روی این دستگاه ارسال می‌شود.</small>
        </div>

        <button type="button" class="settings-logout" onclick="this.closest('.overlay').remove();doLogout()">
          <span>↪</span><strong>خروج از حساب</strong>
        </button>
      </div>
    </div>`;
  const date = document.getElementById('settings-current-date');
  if (date) {
    const now = new Date();
    try {
      const j = JalaaliLib.toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate());
      date.textContent = `${toFaDigits(j.jd)} ${JALALI_MONTHS[j.jm - 1]} ${toFaDigits(j.jy)}`;
    } catch (_) {}
  }
}

function playBrandSectionMotion() {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const old = document.querySelector('.brand-section-mark');
  if (old) old.remove();
  const mark = document.createElement('div');
  mark.className = 'brand-section-mark';
  mark.innerHTML = '<img src="/assets/logo_white.svg" alt="">';
  document.body.appendChild(mark);
  setTimeout(() => mark.remove(), 760);
}

function notificationToggle(key, title, description) {
  const on = notificationPreferenceEnabled(key);
  const icon = key === 'task_new' ? '📋' : key === 'task_due' ? '📅' : key === 'attendance_check_in' ? '🕘' : '🕔';
  return '<button type="button" class="notification-preference-row" data-preference-key="' + key + '" data-preference-value="' + (!on) + '" onclick="setNotificationPreferenceFromElement(this)">';
    + '<span class="notification-preference-icon">' + icon + '</span>'
    + '<span class="notification-preference-copy"><strong>' + title + '</strong><small>' + description + '</small></span>'
    + '<span class="notification-switch ' + (on ? 'active' : '') + '" aria-hidden="true"><span></span></span>'
    + '</button>';
}

function renderNotificationSettings() {
  const supported = pushSupported();
  const permission = 'Notification' in window ? Notification.permission : 'unsupported';
  const masterOn = notificationPreferences.enabled;
  return '<div class="notification-settings-page">'
    + '<div class="notification-settings-top"><button type="button" class="btn small secondary" onclick="openSettingsCenter()">← بازگشت به تنظیمات</button></div>'
    + '<div class="card notification-preferences-hero">'
    + '<div class="notification-preference-head"><span class="profile-setting-icon">🔔</span><div><strong>دریافت اعلان‌ها</strong><div class="sr-meta">اعلان‌های سیستم، یادآوری‌ها و هشدارهای مرتبط با حساب</div></div>'
    + '<button type="button" class="notification-switch ' + (masterOn ? 'active' : '') + '" data-preference-key="enabled" data-preference-value="' + (!masterOn) + '" onclick="setNotificationPreferenceFromElement(this)" aria-label="' + (masterOn ? 'خاموش کردن اعلان‌ها' : 'روشن کردن اعلان‌ها') + '"><span></span></button></div>'
    + '<div class="notification-device-status ' + (permission === 'granted' && masterOn ? 'ok' : '') + '">'
    + (!supported ? 'مرورگر فعلی اعلان وب را پشتیبانی نمی‌کند.' : permission === 'granted' && masterOn ? 'اعلان‌های این دستگاه فعال است.' : permission === 'denied' ? 'اجازه اعلان توسط مرورگر رد شده؛ از تنظیمات مرورگر فعالش کن.' : 'با روشن کردن کلید اصلی، اجازه اعلان دستگاه هم در صورت نیاز درخواست می‌شود.')
    + '</div></div>'
    + '<div class="notification-preference-group"><div class="notification-group-title"><strong>اعلان‌های سیستم</strong><span>کنترل هر نوع اعلان به‌صورت جداگانه</span></div>'
    + notificationToggle('task_new', 'وظیفه جدید', 'وقتی وظیفه‌ای برایت ایجاد یا به تو اختصاص داده می‌شود.')
    + notificationToggle('task_due', 'نزدیک شدن مهلت وظیفه', 'یادآوری مربوط به نزدیک شدن زمان تحویل وظایف.')
    + '</div>'
    + '<div class="notification-preference-group"><div class="notification-group-title"><strong>حضور و غیاب</strong><span>یادآوری‌های ساعت شروع و پایان کار</span></div>'
    + notificationToggle('attendance_check_in', 'یادآوری ثبت ورود', 'یادآوری ساعت ۰۹:۰۰ در روزهای کاری.')
    + notificationToggle('attendance_check_out', 'یادآوری ثبت خروج', 'یادآوری ساعت ۱۷:۰۰ در روزهای کاری.')
    + '</div>'
    + '<div class="card notification-settings-note"><strong>نکته</strong><span>خاموش کردن کلید اصلی، اعلان‌های Push این دستگاه را هم غیرفعال می‌کند. تاریخچه اعلان‌ها در پنل باقی می‌ماند.</span></div>'
    + '</div>';
}

async function setNotificationPreferenceFromElement(el) {
  const key = el?.dataset?.preferenceKey;
  if (!key) return;
  const value = String(el.dataset.preferenceValue) === 'true';
  await setNotificationPreference(key, value);
}

async function setNotificationPreference(key, value) {
  const nextValue = !!value;
  if (key === 'enabled' && nextValue && pushSupported() && 'Notification' in window && Notification.permission !== 'granted') {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      showToast('اجازه اعلان فعال نشد.');
      renderNotificationSettingsIntoPage();
      return;
    }
  }
  const ok = await saveNotificationPreferences({ [key]: nextValue });
  if (!ok) return;
  if (key === 'enabled') {
    try { await syncPushSubscriptionWithPreferences(); } catch (_) {}
  }
  renderNotificationSettingsIntoPage();
  updateProfileSettingsUI();
  if (key === 'enabled' && nextValue) showToast('اعلان‌ها فعال شدند ✅');
  else if (key === 'enabled') showToast('اعلان‌ها خاموش شدند.');
}

function renderNotificationSettingsIntoPage() {
  const section = document.getElementById('section-notification-settings');
  if (!section || section.classList.contains('hidden')) return;
  section.innerHTML = renderNotificationSettings();
}

function switchSection(id) {
  const previousSectionId = activeSectionId;
  activeSectionId = id;
  updateHeaderContext(id);
  buildNav(id);
  updateMobileBottomNav(id);
  document.querySelectorAll('main > .content-shell > div').forEach(d => d.classList.add('hidden'));
  const section = document.getElementById('section-' + id);
  if (!section) return;
  section.classList.remove('hidden');
  section.classList.remove('section-motion');
  void section.offsetWidth;
  section.classList.add('section-motion');
  if (typeof previousSectionId !== 'undefined' && previousSectionId && previousSectionId !== id) playBrandSectionMotion();
  setSidebarOpen(false);

  const renderMap = {
    dashboard: renderDashboard, pipeline: renderPipeline, clients: renderClients,
    projects: renderProjects, contracts: renderContracts, team: renderTeam,
    profile: renderProfile, employees: renderEmployees,
    'erp-tasks': renderErpTasks, costs: renderFixedCosts, tenders: renderTenders,
    'office-tasks': renderOfficeTasks,
    'notification-settings': renderNotificationSettings
  };

  if (id === 'attendance') renderAttendanceSection();
  else if (id === 'tasks') renderTasksSection();
  else if (id === 'calendar') renderCalendar();
  else if (renderMap[id]) {
    section.innerHTML = renderMap[id]();
    if (id === 'dashboard') { enhanceDashboard(); loadDashboardExtras(); }
    if (id === 'profile') { updateProfileSettingsUI(); }
    if (id === 'employees') { loadEmployeeDirectory(); }
  }
}

async function loadProfileAndShowApp() {
  const { data: profile, error: profileError } = await sb.from('profiles').select('*').eq('id', currentUser.id).single();
  currentProfile = profile || {
    full_name: currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'کاربر دفتر',
    role_title: '',
    is_admin: false
  };
  if (profileError) console.warn('Profile load failed:', profileError.message);
  await loadNotificationPreferences();
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app-root').classList.remove('hidden');
  document.getElementById('user-badge').innerText = `${currentProfile.full_name || ''} ${currentProfile.role_title ? '— ' + currentProfile.role_title : ''}`;
  const headerAvatar = document.getElementById('header-avatar');
  if (headerAvatar) headerAvatar.innerHTML = profileAvatarInner(currentProfile);

  buildNav('dashboard');
  updateHeaderContext('dashboard');
  initDarkMode();
  switchSection('dashboard');
  const mobileSection = new URLSearchParams(location.search).get('section');
  const mobileAllowed = ['dashboard','tasks','calendar','attendance','profile','projects','pipeline','clients','contracts','team','employees','costs','tenders','office-tasks','erp-tasks'];
  if (mobileSection && mobileAllowed.includes(mobileSection)) setTimeout(() => switchSection(mobileSection), 0);
  loadAttendanceStatus();
  const nfcMode = new URLSearchParams(location.search).get('nfc');
  if (nfcMode === 'office') {
    setTimeout(() => window.dastWebNfcAttendance?.(), 450);
  }
  loadMyTasks();
  refreshGoogleStatus();
  startTaskNotifications();
  startNotificationCenter();
  setTimeout(() => window.tryPendingAttendanceQR?.(), 250);

  if (currentProfile.is_admin) {
    const { data: profs } = await sb.from('profiles').select('*');
    allProfiles = profs || [];
    refreshAllErpData();
    if (document.getElementById('teamtasks-table')) { fillEmployeeSelect(); loadTeamTasks(); }
    if (document.getElementById('attendance-all-table')) loadAttendanceAll();
  }
}


// ================= اعلان فوری کار جدید =================
let swReg = null, taskChannel = null;
function showToast(msg) {
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);background:#342D73;color:#fff;padding:12px 18px;border-radius:10px;z-index:200;font-size:14px;box-shadow:0 4px 16px rgba(0,0,0,.3);max-width:90vw;';
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 7000);
}
async function notifyUser(title, body) {
  if (!notificationPreferenceEnabled('enabled')) return;
  showToast(`${title}: ${body}`);
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    if (swReg) await swReg.showNotification(title, { body, dir: 'rtl', lang: 'fa' });
    else new Notification(title, { body, dir: 'rtl' });
  } catch (e) { /* اعلان سیستمی ممکن نشد؛ پیام داخل صفحه نمایش داده شد */ }
}
const VAPID_PUBLIC_KEY = 'BBlhXzAtTRWGRgqQbXw7eaNFdRl_pKd4Gjzg2vGKNdplVGfAq0GGM2pGRpbe5r1inrgmc0GNfkNX8XYGokzdPpg';
function b64ToUint8(b64) {
  const pad = '='.repeat((4 - b64.length % 4) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

// ثبت این دستگاه برای دریافت اعلان‌های سرور (یادآور ورود و خروج)
async function subscribeToPush() {
  if (!pushSupported() || !swReg) return false;
  let sub = await swReg.pushManager.getSubscription();
  if (!sub) sub = await swReg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(VAPID_PUBLIC_KEY) });
  const r = await apiPost('/api/push-subscribe', { subscription: sub.toJSON() });
  return r && r.status === 'saved';
}
async function enableNotifications() {
  if (isIOS() && !isStandalone()) { showInstallHelp(); return; }
  if (!pushSupported()) { alert('این مرورگر از اعلان پشتیبانی نمی‌کند. از کروم یا سافاری استفاده کن.'); return; }
  const p = await Notification.requestPermission();
  if (p !== 'granted') { alert('اجازه‌ی اعلان داده نشد. از تنظیمات مرورگر/گوشی می‌توانی فعالش کنی.'); return; }
  const saved = await saveNotificationPreferences({ enabled: true });
  if (!saved) return;
  const ok = await subscribeToPush();
  const btn = document.getElementById('notif-btn');
  if (ok) {
    if (btn) btn.classList.add('hidden');
    notifyUser('اعلان‌ها فعال شد ✅', 'یادآورهای فعال حساب برای این دستگاه در دسترس هستند.');
    updateProfileSettingsUI();
  } else {
    alert('فعال‌سازی اعلان روی سرور ثبت نشد، دوباره تلاش کن.');
  }
}

// نصب اپ روی گوشی
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstall = e;
  updateInstallBtn();
  updateProfileSettingsUI();
});
window.addEventListener('appinstalled', () => {
  deferredInstall = null;
  updateInstallBtn();
  updateProfileSettingsUI();
  showToast('اپ استودیو معماری دَست نصب شد ✅');
});
function updateInstallBtn() {
  const btn = document.getElementById('install-btn'); if (!btn) return;
  btn.classList.toggle('hidden', isStandalone() || !currentUser);
}
async function installApp() {
  if (deferredInstall) { deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; updateInstallBtn(); }
  else showInstallHelp();
}
function showInstallHelp() {
  const ios = isIOS();
  const steps = ios
    ? ['در Safari این صفحه را باز کن (نه کروم)', 'روی دکمه‌ی اشتراک‌گذاری (مربع با فلش رو به بالا) بزن', '«Add to Home Screen» (افزودن به صفحه‌ی اصلی) را انتخاب کن', 'اپ را از آیکونش روی صفحه‌ی اصلی باز کن و آنجا «فعال‌سازی اعلان» را بزن']
    : ['روی منوی سه‌نقطه‌ی مرورگر بزن', '«Install app» یا «افزودن به صفحه‌ی اصلی» را انتخاب کن', 'اپ را از آیکونش روی صفحه‌ی اصلی باز کن'];
  const root = document.getElementById('edit-modal-root');
  root.innerHTML = `<div class="overlay" onclick="if(event.target===this) this.remove()"><div class="modal">
    <h3>نصب اپ روی ${ios ? 'آیفون' : 'گوشی'}</h3>
    <ol style="line-height:2;padding-right:18px;margin:0;">${steps.map(t => `<li>${t}</li>`).join('')}</ol>
    ${ios ? '<p style="font-size:12px;color:var(--muted);">در آیفون، اعلان فقط بعد از نصب اپ روی صفحه‌ی اصلی کار می‌کند (iOS نسخه ۱۶.۴ به بالا).</p>' : ''}
    <div class="modal-actions"><button class="btn" onclick="this.closest('.overlay').remove()">متوجه شدم</button></div>
  </div></div>`;
}

async function startTaskNotifications() {
  if ('serviceWorker' in navigator) { try { swReg = await navigator.serviceWorker.register('/sw.js'); } catch (e) {} }
  updateInstallBtn();
  const btn = document.getElementById('notif-btn');
  if (notificationPreferences.enabled && pushSupported() && Notification.permission === 'granted') {
    subscribeToPush().catch(() => {});
    if (btn) btn.classList.add('hidden');
  } else if (btn) {
    btn.classList.remove('hidden');
  }
  if (taskChannel) sb.removeChannel(taskChannel);
  taskChannel = sb.channel('tasks-' + currentUser.id)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'personal_tasks', filter: `user_id=eq.${currentUser.id}` }, () => loadMyTasks())
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'personal_tasks', filter: `user_id=eq.${currentUser.id}` }, () => loadMyTasks())
    .subscribe();
}

async function loadNotifications() {
  const { data, error } = await sb.from('notifications').select('*').eq('user_id', currentUser.id).order('created_at', { ascending:false }).limit(30);
  if (error) return;
  notifications = data || [];
  renderNotificationBell();
}
function renderNotificationBell() {
  const count = notifications.filter(n => !n.is_read).length;
  const badge = document.getElementById('notif-count');
  if (badge) { badge.textContent = count > 99 ? '۹۹+' : toFaDigits(count); badge.classList.toggle('hidden', count === 0); }
}
function notificationTime(iso) {
  if (!iso) return '';
  const d = new Date(iso), now = new Date(), mins = Math.max(0, Math.round((now-d)/60000));
  if (mins < 1) return 'همین الان';
  if (mins < 60) return toFaDigits(mins)+' دقیقه پیش';
  if (mins < 1440) return toFaDigits(Math.round(mins/60))+' ساعت پیش';
  return fmtDate(iso.slice(0,10));
}
function openNotificationCenter() {
  const root=document.getElementById('global-search-root'); if(!root)return;
  root.innerHTML=`<div class="overlay" onclick="if(event.target===this)closeNotificationCenter()"><div class="modal notification-modal">
    <div class="row-top"><div><h3 style="margin:0;">🔔 اعلان‌ها</h3><div class="sr-meta">آخرین اتفاقات مربوط به حساب و کارهای شما</div></div><div class="row" style="margin:0"><button class="btn small secondary" onclick="markAllNotificationsRead()">همه خوانده شد</button><button class="btn small secondary" onclick="closeNotificationCenter()">بستن</button></div></div>
    <div id="notification-list"></div>
  </div></div>`;
  renderNotificationList();
}
function closeNotificationCenter(){ const root=document.getElementById('global-search-root'); if(root) root.innerHTML=''; }
function renderNotificationList() {
  const box=document.getElementById('notification-list'); if(!box)return;
  box.innerHTML=notifications.length ? notifications.map(n=>`
    <button class="notification-item ${n.is_read?'read':'unread'}" onclick="markNotificationRead('${n.id}')">
      <span class="notification-icon">${n.type==='task'?'✓':'•'}</span>
      <span class="notification-copy"><strong>${escapeHtml(n.title)}</strong><span>${escapeHtml(n.body||'')}</span><small>${notificationTime(n.created_at)}</small></span>
    </button>`).join('') : '<div class="empty">اعلانی نداری 🎉</div>';
}
async function markNotificationRead(id) {
  await sb.from('notifications').update({is_read:true}).eq('id',id).eq('user_id',currentUser.id);
  const n=notifications.find(x=>x.id===id); if(n)n.is_read=true;
  renderNotificationBell(); renderNotificationList();
  if(n?.section){ closeNotificationCenter(); switchSection(n.section); }
}
async function markAllNotificationsRead() {
  await sb.from('notifications').update({is_read:true}).eq('user_id',currentUser.id).eq('is_read',false);
  notifications.forEach(n=>n.is_read=true);
  renderNotificationBell(); renderNotificationList();
}
function startNotificationCenter() {
  loadNotifications();
  if (notificationChannel) sb.removeChannel(notificationChannel);
  notificationChannel = sb.channel('notifications-' + currentUser.id)
    .on('postgres_changes', { event:'INSERT', schema:'public', table:'notifications', filter:`user_id=eq.${currentUser.id}` }, payload => {
      const n=payload.new;
      notifications=[n,...notifications].slice(0,30);
      renderNotificationBell();
      if (notificationPreferenceEnabled(notificationPreferenceKey(n))) notifyUser(n.title,n.body||'');
      if (document.getElementById('notification-list')) renderNotificationList();
    })
    .subscribe();
}
let googleStatus = null;
async function refreshGoogleStatus() {
  const r = await fetch('/api/google-status', { headers: await authHeader() });
  googleStatus = await r.json().catch(() => null);
  const btn = document.getElementById('calendar-btn');
  if (!googleStatus || !btn) return;
  btn.classList.remove('hidden');
  const icon = googleStatus.me.needs_reconnect ? '⚠️' : googleStatus.me.connected ? '✓' : '◫';
  const label = googleStatus.me.needs_reconnect ? 'نیاز به اتصال مجدد' : googleStatus.me.connected ? 'کلندر متصل' : 'اتصال کلندر';
  const detail = googleStatus.me.connected ? (googleStatus.me.email || '') : '';
  btn.innerHTML = '<span class="header-status-icon" aria-hidden="true">'+icon+'</span><span class="header-status-copy"><strong>'+label+'</strong><small>'+detail+'</small></span>';
  btn.title = googleStatus.me.needs_reconnect ? 'اتصال مجدد گوگل کلندر' : googleStatus.me.connected ? 'گوگل کلندر متصل است' : 'اتصال گوگل کلندر';
  btn.setAttribute('aria-label', btn.title);
  btn.classList.toggle('is-connected', !!googleStatus.me.connected && !googleStatus.me.needs_reconnect);
  btn.classList.toggle('needs-reconnect', !!googleStatus.me.needs_reconnect);
  if (currentProfile.is_admin && document.getElementById('teamtasks-table')) renderEmployeeCalendarBadges();
}
function renderEmployeeCalendarBadges() {
  if (!googleStatus || !googleStatus.all) return;
  ['team-task-employee', 'team-task-filter'].forEach(id => {
    const sel = document.getElementById(id); if (!sel) return;
    [...sel.options].forEach(opt => {
      const st = googleStatus.all[opt.value];
      const base = opt.textContent.replace(/ \((وصل نیست|نیاز به اتصال مجدد)\)$/, '');
      if (st && st.needs_reconnect) opt.textContent = base + ' (نیاز به اتصال مجدد)';
      else if (st && !st.connected) opt.textContent = base + ' (وصل نیست)';
      else opt.textContent = base;
    });
  });
}
async function connectCalendar() {
  const r = await apiPost('/api/auth/login');
  if (r && r.url) window.location.href = r.url;
  else alert('اتصال به گوگل ممکن نشد.');
}

function avatarInitial(profile) {
  const name = String(profile?.full_name || 'د').trim();
  return escapeHtml(name ? Array.from(name)[0] : 'د');
}
function profileAvatarInner(profile) {
  const value = String(profile?.avatar_url || '');
  if (value.startsWith('emoji:')) return escapeHtml(value.slice(6) || '👤');
  if (/^https?:\/\//i.test(value)) {
    return '<img src="' + escapeHtml(value) + '" alt="آواتار" loading="lazy">';
  }
  return avatarInitial(profile);
}
function profileAvatarMarkup(profile, size = '') {
  return '<div class="profile-avatar ' + escapeHtml(size) + '">' + profileAvatarInner(profile) + '</div>';
}
const PROFILE_AVATAR_PRESETS = ['emoji:📐','emoji:🧑‍💻','emoji:🏗️','emoji:🎨','emoji:💼','emoji:🧠','emoji:🖥️','emoji:🚀'];

function renderProfile() {
  const p = currentProfile || {};
  const currentAvatar = p.avatar_url || '';
  const preset = PROFILE_AVATAR_PRESETS.includes(currentAvatar) ? currentAvatar : (currentAvatar.startsWith('http') ? '' : currentAvatar);
  return `
    <div class="row-top"><div><h2>پروفایل من</h2><div class="profile-subtitle">اطلاعات حساب، ظاهر و تنظیمات شخصی</div></div><button class="btn small secondary" onclick="switchSection('employees')">مشاهده کارکنان</button></div>
    <div class="profile-layout">
      <div class="card profile-hero-card">
        <div class="profile-hero">
          ${profileAvatarMarkup(p, 'xl')}
          <div><h3>${escapeHtml(p.full_name || 'کاربر دفتر')}</h3><div class="profile-role">${escapeHtml(p.role_title || (p.is_admin ? 'مدیر دفتر' : 'عضو تیم'))}</div><div class="profile-meta">${escapeHtml(p.department || 'واحد ثبت نشده')}</div></div>
        </div>
        <div class="profile-account-note">این صفحه برای اطلاعاتی است که خودت می‌توانی ویرایش کنی. سطح دسترسی توسط مدیر دفتر کنترل می‌شود.</div>
      </div>
      <div class="card">
        <div class="row-top"><h3>ویرایش اطلاعات</h3><span class="sr-meta">اطلاعات نمایشی</span></div>
        <div class="profile-form-grid">
          <label>نام و نام خانوادگی<input id="profile-full-name" value="${escapeHtml(p.full_name || '')}" maxlength="80"></label>
          <label>واحد / دپارتمان<input id="profile-department" value="${escapeHtml(p.department || '')}" maxlength="80" placeholder="مثلاً طراحی معماری"></label>
        </div>
        <label>سمت <input value="${escapeHtml(p.role_title || (p.is_admin ? 'مدیر دفتر' : 'عضو تیم'))}" disabled></label>
        <label class="profile-bio-field">معرفی کوتاه<textarea id="profile-bio" rows="3" maxlength="240" placeholder="مثلاً معمار، مدل‌ساز و مسئول پروژه‌های...">${escapeHtml(p.bio || '')}</textarea></label>
        <div class="profile-avatar-editor">
          <div><strong>آواتار</strong><div class="sr-meta">یک آواتار آماده انتخاب کن یا لینک عکس خودت را وارد کن.</div></div>
          <div class="profile-avatar-preview" id="profile-avatar-preview">${profileAvatarMarkup(p,'lg')}</div>
          <input type="hidden" id="profile-avatar-value" value="${escapeHtml(preset || '')}">
          <div class="avatar-presets">${PROFILE_AVATAR_PRESETS.map(v=>'<button type="button" class="avatar-option '+(v===preset?'selected':'')+'" data-value="'+escapeHtml(v)+'" onclick="chooseProfileAvatar(this.dataset.value)">'+escapeHtml(v.slice(6))+'</button>').join('')}</div>
          <label class="avatar-url-label">یا لینک مستقیم عکس<input id="profile-avatar-url" type="url" dir="ltr" placeholder="https://..." value="${escapeHtml(/^https?:\/\//i.test(currentAvatar) ? currentAvatar : '')}" oninput="previewProfileAvatarUrl(this.value)"></label>
        </div>
        <div class="modal-actions"><button class="btn" onclick="saveMyProfile()">ذخیره تغییرات</button></div>
      </div>
    </div>
    <div class="profile-settings-divider"><span>⚙️ تنظیمات پنل</span><small>ظاهر، اعلان، امنیت و اتصال‌ها</small></div>
    <div class="profile-settings-grid">
      <div class="card">
        <div class="profile-setting-head"><span class="profile-setting-icon">🎨</span><div><strong>ظاهر پنل</strong><div class="sr-meta">حالت روشن یا تیره</div></div></div>
        <button class="btn small secondary" onclick="toggleDarkMode();updateProfileSettingsUI()">تغییر حالت نمایش</button>
      </div>
      <div class="card">
        <div class="profile-setting-head"><span class="profile-setting-icon">🔔</span><div><strong>اعلان‌ها</strong><div id="profile-notification-status" class="sr-meta">در حال بررسی...</div></div></div>
        <button class="btn small secondary" onclick="switchSection('notification-settings')">مدیریت اعلان‌ها</button>
      </div>
      <div class="card">
        <div class="profile-setting-head"><span class="profile-setting-icon">🔐</span><div><strong>امنیت حساب</strong><div class="sr-meta">رمز ورود را هر زمان خواستی تغییر بده</div></div></div>
        <button class="btn small secondary" onclick="changeMyPassword()">تغییر رمز عبور</button>
      </div>
      <div class="card">
        <div class="profile-setting-head"><span class="profile-setting-icon">📅</span><div><strong>تقویم گوگل</strong><div id="profile-calendar-status" class="sr-meta">از هدر هم قابل مدیریت است</div></div></div>
        <button class="btn small secondary" onclick="connectCalendar()">اتصال تقویم</button>
      </div>
      <div class="card profile-install-card">
        <div class="profile-setting-head"><span class="profile-setting-icon">📲</span><div><strong>اپ استودیو معماری دَست</strong><div id="profile-install-status" class="sr-meta">اپ را روی این دستگاه نصب کن.</div></div></div>
        <button id="profile-install-btn" class="btn small" onclick="installApp()">📲 نصب اپ</button>
      </div>
    </div>`;
}
function updateProfileSettingsUI() {
  const install = document.getElementById('profile-install-status');
  const installBtn = document.getElementById('profile-install-btn');
  if (install && installBtn) {
    const installed = isStandalone();
    if (installed) {
      install.textContent = 'اپ روی این دستگاه نصب شده است ✅';
      installBtn.textContent = '✅ نصب شده';
      installBtn.disabled = true;
    } else {
      install.textContent = isIOS() ? 'برای نصب روی آیفون، از Safari و Add to Home Screen استفاده کن.' : 'با این دکمه اپ را به صفحه اصلی دستگاه اضافه کن.';
      installBtn.textContent = deferredInstall ? '📲 نصب اپ' : '📲 نصب / راهنمای نصب';
      installBtn.disabled = false;
    }
  }

  const notif = document.getElementById('profile-notification-status');
  if (notif) {
    const supported = pushSupported();
    const granted = supported && 'Notification' in window && Notification.permission === 'granted';
    notif.textContent = !supported ? 'این مرورگر اعلان وب را پشتیبانی نمی‌کند' : notificationPreferences.enabled && granted ? 'اعلان‌ها فعال هستند' : notificationPreferences.enabled ? 'اعلان‌ها در انتظار فعال‌سازی دستگاه هستند' : 'اعلان‌ها خاموش هستند';
  }
  const cal = document.getElementById('profile-calendar-status');
  if (cal) cal.textContent = googleStatus?.me?.needs_reconnect ? 'اتصال نیاز به بازسازی دارد' : googleStatus?.me?.connected ? 'تقویم متصل است' : 'تقویم هنوز متصل نیست';
}
function chooseProfileAvatar(value) {
  const input=document.getElementById('profile-avatar-value');
  const url=document.getElementById('profile-avatar-url');
  if(input) input.value=value||'';
  if(url) url.value='';
  document.querySelectorAll('.avatar-option').forEach(b=>b.classList.toggle('selected',b.dataset.value===value));
  const box=document.getElementById('profile-avatar-preview');
  if(box) box.innerHTML=profileAvatarMarkup({full_name:currentProfile?.full_name||'د',avatar_url:value},'lg');
}
function previewProfileAvatarUrl(url) {
  if(String(url||'').trim()) document.querySelectorAll('.avatar-option').forEach(b=>b.classList.remove('selected'));
  const box=document.getElementById('profile-avatar-preview');
  if(box) box.innerHTML=profileAvatarMarkup({full_name:currentProfile?.full_name||'د',avatar_url:String(url||'').trim()},'lg');
}
async function saveMyProfile() {
  const full_name=document.getElementById('profile-full-name')?.value.trim();
  const department=document.getElementById('profile-department')?.value.trim();
  const bio=document.getElementById('profile-bio')?.value.trim();
  const avatarUrl=document.getElementById('profile-avatar-url')?.value.trim();
  const avatarPreset=document.getElementById('profile-avatar-value')?.value || '';
  if(!full_name){alert('نام و نام خانوادگی را وارد کن.');return;}
  if(avatarUrl && !/^https?:\/\//i.test(avatarUrl)){alert('لینک آواتار باید با http یا https شروع شود.');return;}
  const payload={full_name,department,bio,avatar_url:avatarUrl||avatarPreset||null};
  const {data,error}=await sb.from('profiles').update(payload).eq('id',currentUser.id).select('*').single();
  if(error){alert('ذخیره پروفایل انجام نشد: '+error.message);return;}
  currentProfile=data||{...currentProfile,...payload};
  const badge=document.getElementById('user-badge'); if(badge) badge.innerText=`${currentProfile.full_name||''} ${currentProfile.role_title ? '— '+currentProfile.role_title : ''}`;
  const headerAvatar=document.getElementById('header-avatar'); if(headerAvatar) headerAvatar.innerHTML=profileAvatarInner(currentProfile);
  switchSection('profile');
  updateProfileSettingsUI();
  showToast('پروفایل با موفقیت ذخیره شد ✅');
}
function renderEmployees() {
  return `
    <div class="row-top"><div><h2>کارکنان</h2><div class="profile-subtitle">فهرست اعضای دفتر برای دسترسی سریع به تیم</div></div><button class="btn small secondary" onclick="switchSection('profile')">پروفایل من</button></div>
    <div class="card">
      <div class="row-top"><div><h3 style="margin:0;">اعضای دفتر</h3><div class="sr-meta">${currentProfile?.is_admin ? 'از همین بخش می‌توانی سمت هر کارمند را سریع تغییر بدهی.' : 'اطلاعاتی که اعضای تیم برای شناخت همدیگر ثبت کرده‌اند.'}</div></div><input id="employee-search" oninput="filterEmployeeDirectory(this.value)" placeholder="جست‌وجوی نام یا واحد" style="max-width:280px;"></div>
      <div id="employee-directory-grid" class="employee-directory-grid"><div class="empty">در حال بارگذاری کارکنان...</div></div>
    </div>`;
}
async function updateEmployeeRole(userId, userName) {
  if (!currentProfile?.is_admin || !userId) return;
  const input = document.getElementById('employee-role-' + userId);
  if (!input) return;
  const role_title = String(input.value || '').trim().slice(0, 80);
  if (!role_title) { alert('سمت را وارد کن.'); input.focus(); return; }
  const { data, error } = await sb.from('profiles').update({ role_title }).eq('id', userId).select('*').single();
  if (error) { alert('تغییر سمت انجام نشد: ' + error.message); return; }
  employeeDirectory = employeeDirectory.map(p => p.id === userId ? { ...p, role_title: data?.role_title || role_title } : p);
  allProfiles = allProfiles.map(p => p.id === userId ? { ...p, role_title: data?.role_title || role_title } : p);
  renderEmployeeDirectory(employeeDirectory);
  showToast('سمت ' + (userName || 'کارمند') + ' با موفقیت تغییر کرد ✅');
}
let employeeDirectory=[];
async function loadEmployeeDirectory() {
  const box=document.getElementById('employee-directory-grid'); if(!box)return;
  const {data,error}=await sb.from('employee_directory').select('*').order('full_name',{ascending:true});
  if(error){box.innerHTML='<div class="empty">فهرست کارکنان فعلاً در دسترس نیست.</div>';return;}
  employeeDirectory=data||[];
  renderEmployeeDirectory(employeeDirectory);
}
function filterEmployeeDirectory(query) {
  const q=String(query||'').trim().toLowerCase();
  renderEmployeeDirectory(employeeDirectory.filter(p=>(String(p.full_name||'')+' '+String(p.role_title||'')+' '+String(p.department||'')+' '+String(p.bio||'')).toLowerCase().includes(q)));
}
function renderEmployeeDirectory(rows) {
  const box=document.getElementById('employee-directory-grid'); if(!box)return;
  box.innerHTML=rows.length ? rows.map(p=>`
    <article class="employee-card">
      <div class="employee-card-head">${profileAvatarMarkup(p,'lg')}<div><strong>${escapeHtml(p.full_name||'عضو تیم')}</strong><div class="profile-role">${escapeHtml(p.role_title||'عضو تیم')}</div></div></div>
      <div class="employee-meta-row"><span>🏢</span><span>${escapeHtml(p.department||'واحد ثبت نشده')}</span></div>
      ${p.bio?`<p class="employee-bio">${escapeHtml(p.bio)}</p>`:''}
      ${currentProfile?.is_admin ? `
        <div class="employee-admin-role">
          <label for="employee-role-${p.id}">سمت کارمند</label>
          <div class="employee-admin-role-row">
            <input id="employee-role-${p.id}" value="${escapeHtml(p.role_title||'')}" maxlength="80" placeholder="مثلاً معمار، کارآموز، مدیر پروژه">
            <button class="btn small" type="button" onclick="updateEmployeeRole('${p.id}','${escapeHtml(p.full_name||'کارمند')}')">ذخیره</button>
          </div>
        </div>` : ''}
    </article>`).join('') : '<div class="empty">عضوی مطابق جست‌وجوی تو پیدا نشد.</div>';
}

async function refreshAllErpData() {
  const [l, c, p, ct, m, et, fc, td, itr, pt] = await Promise.all([
    sb.from('leads').select('*').order('created_at', { ascending: false }),
    sb.from('clients').select('*').order('created_at', { ascending: false }),
    sb.from('projects').select('*').order('created_at', { ascending: false }),
    sb.from('contracts').select('*').order('created_at', { ascending: false }),
    sb.from('members').select('*').order('created_at', { ascending: false }),
    sb.from('erp_tasks').select('*').order('created_at', { ascending: false }),
    sb.from('fixed_costs').select('*').order('created_at', { ascending: false }),
    sb.from('tenders').select('*').order('created_at', { ascending: false }),
    sb.from('interactions').select('*').order('created_at', { ascending: false }),
    sb.from('personal_tasks').select('*').order('due_date', { ascending: true }),
  ]);
  leads = l.data || []; clients = c.data || []; projects = p.data || []; contracts = ct.data || [];
  members = m.data || []; erpTasks = et.data || []; fixedCosts = fc.data || []; tenders = td.data || [];
  interactions = itr.data || [];
  teamPersonalTasks = pt.data || [];
  cacheRows('leads', leads); cacheRows('clients', clients); cacheRows('projects', projects); cacheRows('contracts', contracts);
  cacheRows('members', members); cacheRows('erp_tasks', erpTasks); cacheRows('fixed_costs', fixedCosts); cacheRows('tenders', tenders);

  const { data: stages } = await sb.from('contract_stages').select('*');
  cacheRows('contract_stages', stages || []);
  contractStagesMap = {};
  (stages || []).forEach(s => {
    if (!contractStagesMap[s.contract_id]) contractStagesMap[s.contract_id] = [];
    contractStagesMap[s.contract_id].push(s);
  });

  const current = document.querySelector('#top-nav button.active');
  if (current) switchSection(current.dataset.id);
}

// ================= قابلیت‌های جدید =================
function toggleDarkMode() {
  document.body.classList.toggle('dark');
  localStorage.setItem('dast-dark', document.body.classList.contains('dark') ? '1' : '0');
  updateDarkButton();
  updateStudioLogos();
  const group = document.querySelector('[data-nav-group]');
  if (group) buildNav(activeSectionId);
}
function updateDarkButton() {
  const b=document.getElementById('dark-btn'); if(!b) return;
  b.classList.remove('hidden');
  const isDark=document.body.classList.contains('dark');
  b.innerHTML='<span aria-hidden="true">'+(isDark?'☀':'☾')+'</span>';
  b.title=isDark?'تغییر به حالت روشن':'تغییر به حالت تیره';
  b.setAttribute('aria-label',b.title);
}
function initDarkMode(){ if(localStorage.getItem('dast-dark')==='1') document.body.classList.add('dark'); updateDarkButton(); updateStudioLogos(); }

let calendarJY = null, calendarJM = null, calendarSelectedDay = null;

function calendarMonthLength(jy, jm) {
  return JalaaliLib.jalaaliMonthLength(jy, jm);
}
function calendarMonthTitle(jy, jm) { return JALALI_MONTHS[jm - 1] + ' ' + toFaDigits(jy); }
function calendarDateKey(jy, jm, jd) {
  const g = JalaaliLib.toGregorian(jy, jm, jd);
  return `${g.gy}-${String(g.gm).padStart(2,'0')}-${String(g.gd).padStart(2,'0')}`;
}
function calendarTodayJalali() {
  const now = new Date();
  return JalaaliLib.toJalaali(now.getFullYear(), now.getMonth()+1, now.getDate());
}
function calendarPrevMonth() {
  if (calendarJM === 1) { calendarJM = 12; calendarJY--; } else calendarJM--;
  calendarSelectedDay = 1;
  renderCalendar();
}
function calendarNextMonth() {
  if (calendarJM === 12) { calendarJM = 1; calendarJY++; } else calendarJM++;
  calendarSelectedDay = 1;
  renderCalendar();
}
function selectCalendarDay(day) {
  calendarSelectedDay = day;
  renderCalendar();
}

async function renderCalendar() {
  const box = document.getElementById('section-calendar');
  if (!box) return;

  const today = calendarTodayJalali();
  if (!calendarJY || !calendarJM) {
    calendarJY = today.jy;
    calendarJM = today.jm;
    calendarSelectedDay = today.jd;
  }

  box.innerHTML = `<div class="card">
    <div class="row-top" style="margin-bottom:10px;">
      <div>
        <h2 style="margin:0;">📅 تقویم دفتر</h2>
        <div style="font-size:12px;color:var(--muted);margin-top:4px;">کارها و اتفاقات هر روز را یکجا ببین</div>
      </div>
      <div class="row" style="margin:0;">
        <button class="btn small secondary" onclick="calendarPrevMonth()">‹ ماه قبل</button>
        <button class="btn small" onclick="calendarGoToday()">امروز</button>
        <button class="btn small secondary" onclick="calendarNextMonth()">ماه بعد ›</button>
      </div>
    </div>
    <div id="calendar-title" style="text-align:center;font-weight:800;font-size:18px;margin:14px 0;"></div>
    <div class="calendar-weekdays">
      <div>شنبه</div><div>یکشنبه</div><div>دوشنبه</div><div>سه‌شنبه</div><div>چهارشنبه</div><div>پنجشنبه</div><div>جمعه</div>
    </div>
    <div id="calendar-grid" class="calendar-grid"></div>
    <div id="calendar-day-details" style="margin-top:18px;"></div>
  </div>`;

  // «کارها» و «تقویم» یک منبع مشترک دارند: personal_tasks
  // کاربر عادی فقط کارهای خودش را می‌بیند؛ مدیر تمام کارهای تیم را.
  let taskQuery = sb.from('personal_tasks').select('*').not('due_date', 'is', null).order('due_date', { ascending:true });
  if (!(currentProfile && currentProfile.is_admin)) taskQuery = taskQuery.eq('user_id', currentUser.id);
  const { data: taskRows, error: taskError } = await taskQuery;
  const calendarTasks = taskRows || [];
  personalTasks = calendarTasks.filter(t => t.user_id === currentUser.id);

  const items = [];
  calendarTasks.forEach(t => {
    const owner = (currentProfile && currentProfile.is_admin && t.user_id !== currentUser.id) ? nameOf(t.user_id) : '';
    items.push({
      date: String(t.due_date).slice(0,10),
      title: t.title,
      type: 'ددلاین',
      meta: owner ? 'مسئول: ' + owner : (t.status === 'done' ? 'انجام‌شده' : 'تحویل این کار'),
      status: t.status,
      task_id: t.id
    });
  });

  if (currentProfile && currentProfile.is_admin) {
    (erpTasks||[]).forEach(t => { if(t.due_date) items.push({date:String(t.due_date).slice(0,10),title:t.title,type:'وظیفه دفتر',meta:t.responsible_member_name||'',status:t.status}); });
    (interactions||[]).forEach(i => { if(i.next_follow_up_date) items.push({date:i.next_follow_up_date,title:i.related_name||'پیگیری',type:i.type||'پیگیری',meta:i.note||''}); });
    (tenders||[]).forEach(t => { if(t.event_date) items.push({date:t.event_date,title:t.title,type:t.type||'رویداد',meta:t.issuing_body||''}); });
    (contracts||[]).forEach(c => { (contractStagesMap[c.id]||[]).forEach(s => { if(s.due_date) items.push({date:s.due_date,title:(c.project_title||'قرارداد')+' — '+s.title,type:'سررسید پرداخت',meta:(s.amount||0).toLocaleString('fa-IR')+' تومان'}); }); });
  }

  const dayItems = {};
  items.forEach(item => { (dayItems[item.date] ||= []).push(item); });

  const daysInMonth = calendarMonthLength(calendarJY, calendarJM);
  const firstG = JalaaliLib.toGregorian(calendarJY, calendarJM, 1);
  const firstWeekday = (new Date(firstG.gy, firstG.gm-1, firstG.gd).getDay() + 1) % 7;
  const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;

  document.getElementById('calendar-title').innerHTML = calendarMonthTitle(calendarJY, calendarJM) + '<div style="font-size:11px;color:var(--muted);font-weight:500;margin-top:5px;">🔴 ددلاین کارها · خاکستری: پنجشنبه و جمعه</div>';
  const grid = document.getElementById('calendar-grid');
  let html = '';
  for (let cell=0; cell<totalCells; cell++) {
    const day = cell-firstWeekday+1;
    if (day<1 || day>daysInMonth) {
      html += '<div class="calendar-day empty-cell"></div>';
      continue;
    }
    const key = calendarDateKey(calendarJY, calendarJM, day);
    const count = (dayItems[key]||[]).length;
    const holiday = holidayFor(calendarJY, calendarJM, day);
    const g = JalaaliLib.toGregorian(calendarJY, calendarJM, day);
    const isFriday = new Date(g.gy, g.gm-1, g.gd).getDay() === 5;
    const isThursday = new Date(g.gy, g.gm-1, g.gd).getDay() === 4;
    const isToday = today.jy===calendarJY && today.jm===calendarJM && today.jd===day;
    const isSelected = calendarSelectedDay===day;
    const classes = [
      'calendar-day',
      isToday ? 'today' : '',
      isSelected ? 'selected' : '',
      holiday ? 'holiday' : '',
      isFriday || isThursday ? 'weekend' : ''
    ].filter(Boolean).join(' ');
    html += `<button class="${classes}" onclick="selectCalendarDay(${day})">
      <span class="calendar-day-number">${toFaDigits(day)}</span>
      <span style="display:flex;gap:5px;align-items:center;width:100%;justify-content:flex-end">
        ${holiday ? '<span class="calendar-holiday-mark">تعطیل</span>' : ''}
        ${count ? `<span class="calendar-day-count">${toFaDigits(count)}</span>` : '<span class="calendar-day-dot"></span>'}
      </span>
    </button>`;
  }
  grid.innerHTML = html;

  const selectedKey = calendarDateKey(calendarJY, calendarJM, calendarSelectedDay);
  const selected = dayItems[selectedKey] || [];
  const selectedHoliday = holidayFor(calendarJY, calendarJM, calendarSelectedDay);
  const details = document.getElementById('calendar-day-details');
  details.innerHTML = `
    <div style="font-size:14px;font-weight:800;margin-bottom:10px;">کارهای ${toFaDigits(calendarSelectedDay)} ${JALALI_MONTHS[calendarJM-1]}</div>
    ${selectedHoliday ? `<div class="calendar-holiday-detail">🔴 ${escapeHtml(selectedHoliday)}</div>` : ''}
    ${selected.length ? selected.map(x => `<div class="calendar-event-row">
      <div class="calendar-event-type">${escapeHtml(x.type)}</div>
      <div style="flex:1"><strong>${escapeHtml(x.title)}</strong><div style="font-size:11px;color:var(--muted);margin-top:3px">${escapeHtml(x.meta||'')}</div></div>
    </div>`).join('') : (selectedHoliday ? '' : '<div class="empty" style="padding:12px 0;">برای این روز کاری ثبت نشده.</div>')}
  `;
}
function calendarGoToday() {
  const t=calendarTodayJalali();
  calendarJY=t.jy; calendarJM=t.jm; calendarSelectedDay=t.jd;
  renderCalendar();
}



// ================= حضور و غیاب =================
const ATTENDANCE_TEHRAN_OFFSET_MS = 3.5 * 3600 * 1000;
const ATTENDANCE_WEEKDAYS = ['یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه','شنبه'];

function attendanceTehranDateKey(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const t = new Date(d.getTime() + ATTENDANCE_TEHRAN_OFFSET_MS);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth()+1).padStart(2,'0')}-${String(t.getUTCDate()).padStart(2,'0')}`;
}

function attendanceTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const t = new Date(d.getTime() + ATTENDANCE_TEHRAN_OFFSET_MS);
  return toFaDigits(`${String(t.getUTCHours()).padStart(2,'0')}:${String(t.getUTCMinutes()).padStart(2,'0')}`);
}

function attendanceDayTitle(dateKey) {
  const m = String(dateKey).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return dateKey;
  const jy = JalaaliLib.toJalaali(+m[1], +m[2], +m[3]);
  const weekday = new Date(Date.UTC(+m[1], +m[2]-1, +m[3])).getUTCDay();
  return `${ATTENDANCE_WEEKDAYS[weekday]} · ${fmtDate(dateKey)}`;
}

function attendanceMonthRange(jy, jm) {
  const nextJy = jm === 12 ? jy + 1 : jy;
  const nextJm = jm === 12 ? 1 : jm + 1;
  const first = JalaaliLib.toGregorian(jy, jm, 1);
  const next = JalaaliLib.toGregorian(nextJy, nextJm, 1);
  const start = new Date(Date.UTC(first.gy, first.gm-1, first.gd) - ATTENDANCE_TEHRAN_OFFSET_MS);
  const end = new Date(Date.UTC(next.gy, next.gm-1, next.gd) - ATTENDANCE_TEHRAN_OFFSET_MS);
  return { start: start.toISOString(), end: end.toISOString() };
}

function currentAttendanceMonth() {
  const now = new Date();
  return JalaaliLib.toJalaali(now.getFullYear(), now.getMonth()+1, now.getDate());
}

function fillAttendanceMonthSelectors(...ids) {
  const cur = currentAttendanceMonth();
  ids.forEach(([yearId, monthId]) => {
    const ys = document.getElementById(yearId), ms = document.getElementById(monthId);
    if (!ys || !ms) return;
    ys.innerHTML = '';
    for (let y=cur.jy-1; y<=cur.jy+1; y++) {
      ys.innerHTML += `<option value="${y}" ${y===cur.jy?'selected':''}>${toFaDigits(y)}</option>`;
    }
    ms.innerHTML = JALALI_MONTHS.map((m,i) => `<option value="${i+1}" ${i+1===cur.jm?'selected':''}>${m}</option>`).join('');
  });
}

function attendanceSelection(yearId, monthId) {
  const jy = parseInt(document.getElementById(yearId)?.value);
  const jm = parseInt(document.getElementById(monthId)?.value);
  return jy && jm ? { jy, jm } : null;
}

function groupAttendanceByDay(rows) {
  const grouped = {};
  (rows || []).forEach(a => {
    const key = attendanceTehranDateKey(a.check_in);
    if (!key) return;
    (grouped[key] ||= []).push(a);
  });
  Object.values(grouped).forEach(items => items.sort((a,b) => new Date(a.check_in) - new Date(b.check_in)));
  return Object.entries(grouped).sort(([a],[b]) => b.localeCompare(a));
}

function attendanceDayMinutes(rows) {
  return (rows || []).reduce((sum,a) => {
    if (!a.check_out) return sum;
    return sum + Math.max(0, Math.round((new Date(a.check_out) - new Date(a.check_in)) / 60000));
  }, 0);
}

function renderAttendanceDays(rows, isAdmin) {
  const groups = groupAttendanceByDay(rows);
  if (!groups.length) return '<div class="empty">برای این ماه هنوز رکوردی ثبت نشده.</div>';
  const todayKey = attendanceTehranDateKey(new Date().toISOString());
  return groups.map(([dateKey, items]) => {
    const minutes = attendanceDayMinutes(items);
    const isToday = dateKey === todayKey;
    return `<details class="attendance-day" ${isToday ? 'open' : ''}>
      <summary>
        <div class="attendance-day-title"><strong>${escapeHtml(attendanceDayTitle(dateKey))}</strong><span>${toFaDigits(items.length)} ثبت</span></div>
        <div class="attendance-day-total">${minutes ? 'مجموع حضور: ' + toFaDigits(formatMinutes(minutes)) : 'هنوز خروج کامل نشده'}</div>
      </summary>
      <div class="attendance-table-wrap">
        <table><thead><tr>${isAdmin ? '<th>نام</th>' : ''}<th>ورود</th><th>خروج</th><th>مدت</th></tr></thead><tbody>
          ${items.map(a => `<tr>
            ${isAdmin ? '<td><strong>'+escapeHtml(nameOf(a.user_id))+'</strong></td>' : ''}
            <td>${attendanceTime(a.check_in)}</td>
            <td>${attendanceTime(a.check_out)}</td>
            <td>${formatDuration(a.check_in, a.check_out)}</td>
          </tr>`).join('')}
        </tbody></table>
      </div>
    </details>`;
  }).join('');
}

function formatMinutes(totalMinutes) {
  return `${Math.floor(totalMinutes/60)} ساعت ${String(totalMinutes%60).padStart(2,'0')} دقیقه`;
}

function renderAttendanceSection() {
  const el = document.getElementById('section-attendance');
  const adminBlock = currentProfile.is_admin ? `
    <div class="card">
      <div class="row-top">
        <div>
          <h2>حضور و غیاب همه پرسنل</h2>
          <div style="font-size:11px;color:var(--muted);">نمایش ماهانه، به‌صورت روزبه‌روز</div>
        </div>
        <div class="row" style="margin:0;">
          <select id="attendance-jy" aria-label="سال حضور و غیاب"></select>
          <select id="attendance-jm" aria-label="ماه حضور و غیاب"></select>
          <button class="btn small" onclick="exportTimesheet()">دریافت خروجی اکسل این ماه</button>
        </div>
      </div>
      <div id="attendance-all-days" class="attendance-day-list"></div>
    </div>` : '';

  el.innerHTML = `
    <div class="card">
      <div class="row-top">
        <div>
          <h2>ورود و خروج من</h2>
          <div style="font-size:11px;color:var(--muted);">ثبت ورود یا خروج مستقیم از همین صفحه</div>
        </div>
        <div id="attendance-status-chip" class="task-summary-chip">وضعیت: —</div>
      </div>
      <div class="counter" id="attendance-counter">--:--:--</div>
      <div style="text-align:center;"><button class="btn big" id="attendance-btn" onclick="toggleAttendance()">ثبت ورود</button></div>
      ${currentProfile.is_admin ? '<div style="text-align:center;margin-top:10px;"><button class="btn secondary small" onclick="openAttendanceQR()">▦ نمایش QR دائمی دفتر</button></div>' : ''}
      <div class="row-top" style="margin-top:24px;margin-bottom:10px;">
        <div>
          <h3>تاریخچه من</h3>
          <div style="font-size:11px;color:var(--muted);">هر روز یک بخش جدا؛ لیست بلند و شلوغ نمی‌شود.</div>
        </div>
        <div class="row" style="margin:0;">
          <select id="my-attendance-jy" aria-label="سال تاریخچه"></select>
          <select id="my-attendance-jm" aria-label="ماه تاریخچه"></select>
        </div>
      </div>
      <div id="attendance-table" class="attendance-day-list"></div>
    </div>
    ${adminBlock}
  `;

  fillAttendanceMonthSelectors(
    ['my-attendance-jy','my-attendance-jm'],
    ...(currentProfile.is_admin ? [['attendance-jy','attendance-jm']] : [])
  );

  ['my-attendance-jy','my-attendance-jm'].forEach(id => document.getElementById(id)?.addEventListener('change', loadMyAttendanceHistory));
  if (currentProfile.is_admin) {
    ['attendance-jy','attendance-jm'].forEach(id => document.getElementById(id)?.addEventListener('change', loadAttendanceAll));
  }

  loadAttendanceStatus();
  loadMyAttendanceHistory();
  if (currentProfile.is_admin) loadAttendanceAll();
}

function updateDashboardAttendanceQuickAction() {
  const btn = document.getElementById('dashboard-attendance-btn');
  if (!btn) return;
  const strong = btn.querySelector('strong');
  const meta = btn.querySelector('.sr-meta');
  const icon = btn.querySelector('.qa-icon');
  const active = !!activeCheckIn;
  if (strong) strong.textContent = active ? 'ثبت خروج' : 'ثبت ورود';
  if (meta) meta.textContent = active ? ('ورود ثبت شد · ' + attendanceTime(activeCheckIn.check_in)) : 'ثبت حضور امروز';
  if (icon) icon.textContent = active ? '⏱️' : '🕘';
  btn.classList.toggle('dashboard-attendance-active', active);
}

function getAttendanceElapsedLabel(startTime) {
  if (!startTime) return '';
  const diff = Math.max(0, Date.now() - startTime.getTime());
  const h=String(Math.floor(diff/3600000)).padStart(2,'0');
  const m=String(Math.floor((diff%3600000)/60000)).padStart(2,'0');
  return `${toFaDigits(h)}:${toFaDigits(m)}`;
}

async function loadAttendanceStatus() {
  if (attendanceStatusPromise) return attendanceStatusPromise;
  attendanceReady = false;
  attendanceStatusPromise = (async () => {
    const { data, error } = await sb.from('attendance').select('*').eq('user_id', currentUser.id).is('check_out', null).order('created_at', { ascending: false }).limit(1);
    if (error) { showToast('وضعیت حضور خوانده نشد.'); return; }
    const btn = document.getElementById('attendance-btn');
  const chip = document.getElementById('attendance-status-chip');
  if (data && data[0]) {
    activeCheckIn = data[0];
    if (btn) { btn.innerText = 'ثبت خروج'; btn.classList.add('is-active'); }
    if (chip) chip.innerText = 'ورود ثبت شد · ' + attendanceTime(activeCheckIn.check_in);
    startCounter(new Date(activeCheckIn.check_in));
  } else {
    activeCheckIn = null;
    if (btn) { btn.innerText = 'ثبت ورود'; btn.classList.remove('is-active'); }
    if (chip) chip.innerText = 'وضعیت: خارج از دفتر';
    const c = document.getElementById('attendance-counter');
    if (c) c.innerText = '--:--:--';
    clearInterval(attendanceTimer);
  }
    updateDashboardAttendanceQuickAction();
    loadMyAttendanceHistory();
    attendanceReady = true;
  })().finally(() => { attendanceStatusPromise = null; });
  return attendanceStatusPromise;
}

function startCounter(startTime) {
  clearInterval(attendanceTimer);
  const tick = () => {
    const diff = Math.max(0, Date.now() - startTime.getTime());
    const h = String(Math.floor(diff/3600000)).padStart(2,'0');
    const m = String(Math.floor((diff%3600000)/60000)).padStart(2,'0');
    const sec = String(Math.floor((diff%60000)/1000)).padStart(2,'0');
    const c = document.getElementById('attendance-counter');
    if (c) c.innerText = `${h}:${m}:${sec}`;
    updateDashboardAttendanceQuickAction();
  };
  tick();
  attendanceTimer = setInterval(tick, 1000);
}

async function performAttendanceToggle({ silent = false } = {}) {
  if (performAttendanceToggle.busy) return { ok: false, status: 'busy' };
  if (!attendanceReady) await loadAttendanceStatus();
  if (!attendanceReady) return { ok: false, status: 'not_ready' };

  const buttons = [document.getElementById('attendance-btn'), document.getElementById('dashboard-attendance-btn')].filter(Boolean);
  const wasCheckedIn = !!activeCheckIn;
  performAttendanceToggle.busy = true;
  buttons.forEach(b => { b.disabled = true; b.style.opacity = '.7'; });

  try {
    let error = null;
    const now = new Date().toISOString();

    if (wasCheckedIn) {
      ({ error } = await sb.from('attendance')
        .update({ check_out: now })
        .eq('id', activeCheckIn.id)
        .eq('user_id', currentUser.id));
    } else {
      ({ error } = await sb.from('attendance')
        .insert([{ user_id: currentUser.id, check_in: now }]));
    }

    if (error) {
      if (!silent) showToast('ثبت حضور و غیاب انجام نشد.');
      return { ok: false, status: 'error' };
    }

    const status = wasCheckedIn ? 'checked_out' : 'checked_in';
    if (!silent) showToast(wasCheckedIn ? 'خروج با موفقیت ثبت شد ✅' : 'ورود با موفقیت ثبت شد ✅');

    await loadAttendanceStatus();
    if (currentProfile?.is_admin && document.getElementById('attendance-all-days')) await loadAttendanceAll();

    return { ok: true, status, at: now };
  } finally {
    performAttendanceToggle.busy = false;
    buttons.forEach(b => { b.disabled = false; b.style.opacity = ''; });
    updateDashboardAttendanceQuickAction();
  }
}

async function toggleAttendance() {
  return performAttendanceToggle({ silent: false });
}

// این هوک فقط برای اپ اندروید است؛ بدون نمایش UI سایت، همان رکورد حضور و غیاب عادی را ثبت می‌کند.
window.dastNfcAttendance = async function() {
  if (!currentUser) {
    try {
      const { data } = await sb.auth.getSession();
      if (data?.session) {
        currentUser = data.session.user;
        sessionToken = data.session.access_token;
      }
    } catch (e) {}
  }
  if (!currentUser) return { ok: false, status: 'not_logged_in' };
  return performAttendanceToggle({ silent: true });
}

function formatDuration(inTime, outTime) {
  if (!outTime) return '—';
  const diff = new Date(outTime) - new Date(inTime);
  if (!Number.isFinite(diff) || diff < 0) return '—';
  return `${Math.floor(diff/3600000)} ساعت ${Math.floor((diff%3600000)/60000)} دقیقه`;
}

async function loadMyAttendanceHistory() {
  const sel = attendanceSelection('my-attendance-jy','my-attendance-jm') || currentAttendanceMonth();
  const { start, end } = attendanceMonthRange(sel.jy, sel.jm);
  const { data, error } = await sb.from('attendance')
    .select('*')
    .eq('user_id', currentUser.id)
    .gte('check_in', start)
    .lt('check_in', end)
    .order('check_in', { ascending: true });
  const box = document.getElementById('attendance-table');
  if (!box) return;
  if (error) { box.innerHTML = '<div class="empty">خواندن تاریخچه انجام نشد.</div>'; return; }
  box.innerHTML = renderAttendanceDays(data || [], false);
}

async function loadAttendanceAll() {
  const sel = attendanceSelection('attendance-jy','attendance-jm') || currentAttendanceMonth();
  const { start, end } = attendanceMonthRange(sel.jy, sel.jm);
  const { data, error } = await sb.from('attendance')
    .select('*')
    .gte('check_in', start)
    .lt('check_in', end)
    .order('check_in', { ascending: true });
  const box = document.getElementById('attendance-all-days');
  if (!box) return;
  if (error) { box.innerHTML = '<div class="empty">خواندن حضور و غیاب انجام نشد.</div>'; return; }
  box.innerHTML = renderAttendanceDays(data || [], true);
}

const JALALI_MONTHS = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
function exportTimesheet() {
  const sel = attendanceSelection('attendance-jy','attendance-jm');
  if (!sel) { alert('سال و ماه رو انتخاب کن'); return; }
  window.open(`/api/export-timesheet?jy=${sel.jy}&jm=${sel.jm}`, '_blank');
}

const HOLIDAYS_1405 = {
  '1405/01/01':'نوروز؛ تعطیل رسمی و عید فطر',
  '1405/01/02':'عید نوروز؛ تعطیل رسمی',
  '1405/01/03':'عید نوروز؛ تعطیل رسمی',
  '1405/01/04':'عید نوروز؛ تعطیل رسمی',
  '1405/01/12':'روز جمهوری اسلامی ایران؛ تعطیل رسمی',
  '1405/01/13':'روز طبیعت (سیزده‌به‌در)؛ تعطیل رسمی',
  '1405/01/24':'شهادت امام جعفر صادق (ع)؛ تعطیل رسمی',
  '1405/03/03':'شهادت امام محمد باقر (ع)؛ تعطیل رسمی',
  '1405/03/06':'عید قربان؛ تعطیل رسمی',
  '1405/03/14':'رحلت امام خمینی و عید غدیر؛ تعطیل رسمی',
  '1405/03/15':'قیام ۱۵ خرداد؛ تعطیل رسمی',
  '1405/04/03':'تاسوعای حسینی؛ تعطیل رسمی',
  '1405/04/04':'عاشورای حسینی؛ تعطیل رسمی',
  '1405/04/13':'تعطیلی ویژه استان تهران',
  '1405/04/14':'تعطیلی ویژه کل کشور',
  '1405/04/15':'تعطیلی ویژه سراسری کشور',
  '1405/04/16':'تعطیلی ویژه استان تهران',
  '1405/05/13':'اربعین حسینی؛ تعطیل رسمی',
  '1405/05/21':'رحلت پیامبر اکرم (ص) و شهادت امام حسن مجتبی (ع)؛ تعطیل رسمی',
  '1405/05/22':'شهادت امام رضا (ع)؛ تعطیل رسمی',
  '1405/05/30':'شهادت امام حسن عسکری (ع)؛ تعطیل رسمی',
  '1405/06/08':'ولادت پیامبر اکرم (ص) و ولادت امام جعفر صادق (ع)؛ تعطیل رسمی',
  '1405/08/22':'شهادت حضرت فاطمه زهرا (س)؛ تعطیل رسمی',
  '1405/10/02':'ولادت امام علی (ع)؛ روز پدر؛ تعطیل رسمی',
  '1405/10/16':'مبعث پیامبر اکرم (ص)؛ تعطیل رسمی',
  '1405/11/04':'ولادت امام زمان (عج) و نیمه شعبان؛ تعطیل رسمی',
  '1405/11/22':'پیروزی انقلاب اسلامی؛ تعطیل رسمی',
  '1405/12/09':'شهادت امام علی (ع)؛ تعطیل رسمی',
  '1405/12/19':'عید فطر؛ تعطیل رسمی',
  '1405/12/20':'تعطیل عید فطر؛ تعطیل رسمی',
  '1405/12/29':'ملی شدن صنعت نفت؛ تعطیل رسمی'
};

function holidayFor(jy,jm,jd) {
  return HOLIDAYS_1405[`${jy}/${String(jm).padStart(2,'0')}/${String(jd).padStart(2,'0')}`] || null;
}



// ================= کارها (شخصی) =================
function priorityBadge(priority) {
  const p = priority || 'متوسط';
  const cls = p === 'بالا' ? 'priority-high' : p === 'پایین' ? 'priority-low' : 'priority-mid';
  return `<span class="priority-badge ${cls}">${escapeHtml(p)}</span>`;
}
function taskDueMeta(t) {
  if (!t.due_date) return '<span class="task-no-date">بدون ددلاین</span>';
  const today = new Date().toISOString().slice(0,10);
  const due = String(t.due_date).slice(0,10);
  const state = t.status === 'done' ? 'done' : due < today ? 'overdue' : due === today ? 'today' : 'upcoming';
  const label = state === 'overdue' ? 'عقب‌افتاده' : state === 'today' ? 'امروز' : fmtDate(t.due_date);
  return `<span class="task-due ${state}">${label}</span>`;
}
function taskKanbanCard(t, mine=true) {
  const deleteFn = mine ? `deleteMyTask('${t.id}')` : `deleteTeamTask('${t.id}')`;
  return '<div class="task-kanban-card" draggable="true" data-task-id="'+t.id+'" ondragstart="dragTask(event)" onclick="editRow(\'personal_tasks\',\''+t.id+'\')"><div class="task-kanban-top"><strong>'+escapeHtml(t.title)+'</strong>'+priorityBadge(t.priority)+'</div><div class="task-kanban-meta">'+taskDueMeta(t)+( !mine && currentProfile?.is_admin ? ' · '+escapeHtml(nameOf(t.user_id)) : '')+'</div><div class="task-kanban-actions" onclick="event.stopPropagation()">'+taskActionButtons(t, deleteFn)+'</div></div>';
}
function taskBoardColumn(status,title,rows,mine=true){ return '<div class="task-board-column" data-status="'+status+'" ondragover="event.preventDefault()" ondrop="dropTask(event,\''+status+'\')"><div class="task-board-head"><h3>'+title+'</h3><span>'+toFaDigits(rows.length)+'</span></div><div class="task-board-list">'+(rows.map(t=>taskKanbanCard(t,mine)).join('')||'<div class="empty">کاری نیست</div>')+'</div></div>'; }
function renderTaskBoard(rows,mine=true){const g={new:[],progress:[],done:[]};(rows||[]).forEach(t=>(g[t.status]||g.new).push(t));return '<div class="task-board">'+taskBoardColumn('new','در انتظار',g.new,mine)+taskBoardColumn('progress','در حال انجام',g.progress,mine)+taskBoardColumn('done','تکمیل‌شده',g.done,mine)+'</div>';}
function dragTask(e){e.dataTransfer.setData('text/task-id',e.currentTarget.dataset.taskId);}
async function dropTask(e,status){
  e.preventDefault();
  const id=e.dataTransfer.getData('text/task-id');
  if(!id)return;
  const { error } = await sb.from('personal_tasks').update({status}).eq('id',id);
  if(error){ showToast('تغییر وضعیت انجام نشد.'); return; }
  apiPost('/api/task-calendar', { task_id:id, action:'sync' }).catch(()=>{});
  if(currentProfile?.is_admin) await loadTeamTasks();
  else await loadMyTasks();
}
function renderTasksSection() {
  const el = document.getElementById('section-tasks');
  const teamBlock = currentProfile.is_admin ? `
    <div class="card">
      <div class="row-top"><h2>مرکز کارهای تیم</h2><span style="font-size:11px;color:var(--muted)">اولویت، ددلاین و وضعیت</span></div>
      <div class="row">
        <select id="team-task-employee"></select>
        <input type="text" id="team-task-title" placeholder="عنوان کار">
        <select id="team-task-priority">${TASK_PRIORITIES.map(p=>`<option>${p}</option>`).join('')}</select>
        ${jalaliDateField('team-task-date')}
        <button class="btn" onclick="addTeamTask()">محول کردن کار</button>
      </div>
      <div class="row">
        <label style="margin:0;">نمایش کارهای:</label>
        <select id="team-task-filter" onchange="loadTeamTasks()"><option value="">— همه پرسنل —</option></select>
        <select id="team-task-status-filter" onchange="loadTeamTasks()"><option value="">— همه وضعیت‌ها —</option><option value="new">در انتظار</option><option value="progress">در حال انجام</option><option value="done">تکمیل‌شده</option></select>
        <select id="team-task-priority-filter" onchange="loadTeamTasks()"><option value="">— همه اولویت‌ها —</option>${TASK_PRIORITIES.map(p=>`<option>${p}</option>`).join('')}</select>
      </div>
      <div id="team-task-summary" style="margin-bottom:10px;font-size:13px;color:var(--muted);"></div>
      <div id="team-task-board-wrap"></div>
      <details style="margin-top:12px;"><summary style="cursor:pointer;color:var(--muted);font-size:12px;">نمایش جدول کامل</summary><div class="table-wrap"><table><thead><tr><th>کارمند</th><th>عنوان</th><th>اولویت</th><th>ددلاین</th><th>وضعیت</th><th></th></tr></thead><tbody id="teamtasks-table"></tbody></table></div></details>
    </div>` : '';
  el.innerHTML = `
    <div class="card">
      <div class="row-top"><div><h2>مرکز کارهای من</h2><div style="font-size:11px;color:var(--muted)">همه کارها را بر اساس وضعیت و اولویت مدیریت کن</div></div></div>
      <div class="row">
        <input type="text" id="mytask-title" placeholder="عنوان کار">
        <select id="mytask-priority">${TASK_PRIORITIES.map(p=>`<option>${p}</option>`).join('')}</select>
        ${jalaliDateField('mytask-date')}
        <button class="btn" onclick="addMyTask()">+ افزودن کار</button>
      </div>
      <div class="row">
        <select id="mytask-status-filter" onchange="loadMyTasks()"><option value="">— همه وضعیت‌ها —</option><option value="new">در انتظار</option><option value="progress">در حال انجام</option><option value="done">تکمیل‌شده</option></select>
        <select id="mytask-priority-filter" onchange="loadMyTasks()"><option value="">— همه اولویت‌ها —</option>${TASK_PRIORITIES.map(p=>`<option>${p}</option>`).join('')}</select>
        <button class="btn secondary small" onclick="loadMyTasks()">↻ تازه‌سازی</button>
      </div>
      <div id="mytask-summary" class="task-summary"></div>
      <div id="mytask-board-wrap"></div>
      <details style="margin-top:12px;"><summary style="cursor:pointer;color:var(--muted);font-size:12px;">نمایش جدول کامل</summary><div class="table-wrap"><table><thead><tr><th>عنوان</th><th>اولویت</th><th>ددلاین</th><th>وضعیت</th><th></th></tr></thead><tbody id="mytasks-table"></tbody></table></div></details>
    </div>
    ${teamBlock}
    <div class="card task-unified-card">
      <div class="row-top"><div><h2>🧩 منابع کاری دفتر</h2><div style="font-size:11px;color:var(--muted)">همه مدل‌های قدیمی کار از اینجا یکپارچه دیده می‌شوند؛ برای ویرایش وارد منبع مربوط شو.</div></div></div>
      <div id="task-unified-overview" class="task-source-grid"></div>
    </div>
  `;
  loadMyTasks();
  if (currentProfile.is_admin) { fillEmployeeSelect(); loadTeamTasks(); loadUnifiedTaskOverview(); }
}

const CAL_MSG = {
  not_connected: 'گوگل کلندر وصل نیست، پس مهلت در کلندر ثبت نشد.',
  needs_reconnect: 'اتصال گوگل کلندر منقضی شده و باید دوباره وصل شود.',
  error: 'ثبت در گوگل کلندر انجام نشد.',
  google_error: 'ثبت در گوگل کلندر انجام نشد.'
};
async function syncTaskCalendar(taskId, forOther) {
  const r = await apiPost('/api/task-calendar', { task_id: taskId, action: 'sync' });
  if (r && r.status === 'created') showToast('مهلت در گوگل کلندر ثبت شد ✅');
  else if (r && CAL_MSG[r.status]) showToast((forOther ? 'برای این کارمند: ' : '') + CAL_MSG[r.status]);
}
function taskActionButtons(t, onDelete) {
  const next = { new: ['progress', 'شروع کار'], progress: ['done', 'انجام شد'] }[t.status];
  return `${next ? `<button class="btn small" onclick="advanceTask('${t.id}','${next[0]}')">${next[1]}</button>` : ''}
    ${t.status === 'done' ? `<button class="btn small secondary" onclick="advanceTask('${t.id}','new')">بازگشایی</button>` : ''}
    <button class="btn small secondary" onclick="editRow('personal_tasks','${t.id}')">ویرایش</button>
    <button class="btn small danger" onclick="${onDelete}">حذف</button>`;
}
async function advanceTask(id, status) {
  await sb.from('personal_tasks').update({ status }).eq('id', id);
  apiPost('/api/task-calendar', { task_id: id, action: 'sync' });
  loadMyTasks(); if (currentProfile.is_admin) loadTeamTasks();
}

async function addMyTask() {
  const title = document.getElementById('mytask-title').value.trim();
  const due_date = getJalaliDate('mytask-date');
  if (!title) return;
  const priority = document.getElementById('mytask-priority')?.value || 'متوسط';
  const { data, error } = await sb.from('personal_tasks').insert([{ user_id: currentUser.id, title, due_date, priority, status: 'new' }]).select().single();
  document.getElementById('mytask-title').value=''; clearJalaliDate('mytask-date');
  if (error) { alert('ذخیره نشد: ' + error.message); return; }
  if (data && due_date) syncTaskCalendar(data.id, false);
  loadMyTasks();
}
async function loadMyTasks() {
  let q = sb.from('personal_tasks').select('*').eq('user_id', currentUser.id).order('due_date', { ascending: true });
  const sf = document.getElementById('mytask-status-filter')?.value || '';
  const pf = document.getElementById('mytask-priority-filter')?.value || '';
  if (sf) q = q.eq('status', sf);
  if (pf) q = q.eq('priority', pf);
  const { data } = await q;
  personalTasks = data || [];
  const tbody = document.getElementById('mytasks-table'); if (!tbody) return;
  cacheRows('personal_tasks', data||[]);
  const counts = {new:0,progress:0,done:0};
  (data||[]).forEach(t => counts[t.status] = (counts[t.status]||0)+1);
  const summary = document.getElementById('mytask-summary');
  if (summary) summary.innerHTML = `<span class="task-summary-chip">${toFaDigits(data?.length||0)} کار</span> <span class="task-summary-chip">در انتظار: ${toFaDigits(counts.new||0)}</span> <span class="task-summary-chip">در حال انجام: ${toFaDigits(counts.progress||0)}</span> <span class="task-summary-chip">تکمیل‌شده: ${toFaDigits(counts.done||0)}</span>`;
  const board=document.getElementById("mytask-board-wrap"); if(board) board.innerHTML=renderTaskBoard(data||[],true);
  tbody.innerHTML = (data||[]).map(t => `<tr>
    <td><strong>${escapeHtml(t.title)}</strong></td>
    <td>${priorityBadge(t.priority)}</td>
    <td>${taskDueMeta(t)}</td>
    <td>${statusLabel(t.status)}</td>
    <td>${taskActionButtons(t, `deleteMyTask('${t.id}')`)}</td>
  </tr>`).join('') || '<tr><td colspan="5" class="empty">کاری با این فیلتر پیدا نشد.</td></tr>';
}
async function deleteMyTask(id) {
  await apiPost('/api/task-calendar', { task_id: id, action: 'remove' });
  await sb.from('personal_tasks').delete().eq('id', id);
  loadMyTasks(); if (currentProfile.is_admin) loadTeamTasks();
}

function nameOf(uid) { const p = allProfiles.find(x => x.id === uid); return p ? (p.full_name || '—') : '—'; }
function fillEmployeeSelect() {
  const opts = allProfiles.map(p => `<option value="${p.id}">${escapeHtml(p.full_name || p.id.slice(0,8))}</option>`).join('');
  const sel = document.getElementById('team-task-employee'); if (sel) sel.innerHTML = opts;
  const filt = document.getElementById('team-task-filter'); if (filt) filt.innerHTML = '<option value="">— همه پرسنل —</option>' + opts;
}
async function addTeamTask() {
  const user_id = document.getElementById('team-task-employee').value;
  const title = document.getElementById('team-task-title').value.trim();
  const due_date = getJalaliDate('team-task-date');
  if (!title || !user_id) return;
  const priority = document.getElementById('team-task-priority')?.value || 'متوسط';
  const { data, error } = await sb.from('personal_tasks').insert([{ user_id, title, due_date, priority, status: 'new', assigned_by: currentUser.id }]).select().single();
  document.getElementById('team-task-title').value=''; clearJalaliDate('team-task-date');
  if (error) { alert('ذخیره نشد: ' + error.message); return; }
  if (data && due_date) syncTaskCalendar(data.id, data.user_id !== currentUser.id);
  loadTeamTasks(); if (data && data.user_id === currentUser.id) loadMyTasks();
}
async function loadTeamTasks() {
  const filterId = document.getElementById('team-task-filter')?.value || '';
  const statusFilter = document.getElementById('team-task-status-filter')?.value || '';
  const priorityFilter = document.getElementById('team-task-priority-filter')?.value || '';
  let q = sb.from('personal_tasks').select('*').order('due_date', { ascending: true });
  if (filterId) q = q.eq('user_id', filterId);
  if (statusFilter) q = q.eq('status', statusFilter);
  if (priorityFilter) q = q.eq('priority', priorityFilter);
  const { data } = await q;
  const rows = data || [];
  cacheRows('personal_tasks', rows);
  const board=document.getElementById("team-task-board-wrap"); if(board) board.innerHTML=renderTaskBoard(rows,false);
  const tbody = document.getElementById('teamtasks-table'); if (!tbody) return;
  tbody.innerHTML = rows.map(t => `<tr>
    <td>${escapeHtml(nameOf(t.user_id))}</td><td><strong>${escapeHtml(t.title)}</strong></td><td>${priorityBadge(t.priority)}</td><td>${taskDueMeta(t)}</td><td>${statusLabel(t.status)}</td>
    <td>${taskActionButtons(t, `deleteTeamTask('${t.id}')`)}</td>
  </tr>`).join('') || '<tr><td colspan="6" class="empty">کاری با این فیلتر پیدا نشد.</td></tr>';

  const summary = document.getElementById('team-task-summary');
  if (summary) {
    const c = { new: 0, progress: 0, done: 0 };
    rows.forEach(t => { c[t.status] = (c[t.status]||0) + 1; });
    const high = rows.filter(t => t.priority === 'بالا').length;
    const overdue = rows.filter(t => t.due_date && String(t.due_date).slice(0,10) < new Date().toISOString().slice(0,10) && t.status !== 'done').length;
    summary.innerHTML = `مجموع: <b>${rows.length}</b> · در انتظار: <b>${c.new||0}</b> · در حال انجام: <b>${c.progress||0}</b> · تکمیل‌شده: <b>${c.done||0}</b> · اولویت بالا: <b>${high}</b> · عقب‌افتاده: <b>${overdue}</b>`;
  }
}
async function deleteTeamTask(id) {
  await apiPost('/api/task-calendar', { task_id: id, action: 'remove' });
  await sb.from('personal_tasks').delete().eq('id', id);
  loadTeamTasks();
}

// ================= جست‌وجوی سراسری =================
function openGlobalSearch(){
  const root=document.getElementById('global-search-root'); if(!root)return;
  root.innerHTML='<div class="overlay" onclick="if(event.target===this)closeGlobalSearch()"><div class="modal" style="max-width:620px;"><div class="row-top"><h3 style="margin:0;">⌕ جست‌وجوی سراسری</h3><button class="btn small secondary" onclick="closeGlobalSearch()">بستن</button></div><input id="global-search-input" placeholder="مثلاً: پلان طبقات، احمد، پروژه میرداماد..." autocomplete="off"><div id="global-search-results"></div></div></div>';
  const input=document.getElementById('global-search-input'); input.addEventListener('input',()=>runGlobalSearch(input.value)); input.focus();
}
function closeGlobalSearch(){const root=document.getElementById('global-search-root');if(root)root.innerHTML='';}
function runGlobalSearch(query){
  const q=(query||'').trim().toLowerCase(); const box=document.getElementById('global-search-results'); if(!box)return;
  if(!q){box.innerHTML='<div class="empty">نام کارفرما، پروژه، سرنخ یا کار را جست‌وجو کن.</div>';return;}
  const results=[];
  const add=(arr,type,icon,section,titleFn,metaFn)=>{(arr||[]).forEach(x=>{const title=String(titleFn(x)||''),meta=String(metaFn(x)||'');if((title+' '+meta).toLowerCase().includes(q))results.push({type,icon,section,title,meta});});};
  add(leads,'سرنخ','🎯','pipeline',x=>x.name,x=>x.specialty_category||x.source);
  add(clients,'کارفرما','👤','clients',x=>x.name,x=>x.type||x.contact_info);
  add(projects,'پروژه','🏗️','projects',x=>x.title,x=>x.client_name||x.responsible_member);
  add(contracts,'قرارداد','📄','contracts',x=>x.project_title,x=>x.status);
  add(personalTasks,'کار','✓','tasks',x=>x.title,x=>x.due_date?'ددلاین: '+fmtDate(x.due_date):'بدون ددلاین');
  if(currentProfile?.is_admin){add(erpTasks,'وظیفه','📌','erp-tasks',x=>x.title,x=>x.responsible_member_name||x.priority);add(fixedCosts,'هزینه','💰','costs',x=>x.title,x=>x.monthly_amount?(Number(x.monthly_amount).toLocaleString('fa-IR')+' تومان'):'');add(tenders,'مناقصه / مسابقه','🏆','tenders',x=>x.title,x=>x.issuing_body||x.status);add(members,'عضو تیم','👥','team',x=>x.name,x=>x.department||x.access_level);}
  const shown=results.slice(0,30);
  box.innerHTML=shown.length?shown.map((r,i)=>'<div class="search-result" style="animation-delay:'+Math.min(i,8)*20+'ms" onclick="closeGlobalSearch();switchSection(\''+r.section+'\')"><div class="sr-icon">'+r.icon+'</div><div><strong>'+escapeHtml(r.title)+'</strong><div class="sr-meta">'+escapeHtml(r.type)+' · '+escapeHtml(r.meta||'')+'</div></div></div>').join(''):'<div class="empty">چیزی پیدا نشد.</div>';
}
window.addEventListener('keydown',(e)=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openGlobalSearch();}if(e.key==='Escape')closeGlobalSearch();});
function enhanceDashboard(){
  const section=document.getElementById('section-dashboard'); if(!section)return;
  if(!document.getElementById('dashboard-quick-actions') && !section.querySelector('.quick-actions')){
    const card=document.createElement('div'); card.className='card';
    card.innerHTML='<div class="row-top"><h2>⚡ دسترسی سریع</h2><span style="font-size:11px;color:var(--muted)">کارهای پرتکرار دفتر</span></div><div id="dashboard-quick-actions" class="quick-actions"></div>';
    const greeting = section.querySelector('.dashboard-greeting');
    if (greeting) greeting.after(card);
    else section.insertBefore(card,section.firstElementChild);
    const grid=card.querySelector('#dashboard-quick-actions');
    const b=document.createElement('button'); b.className='quick-action dashboard-attendance-action'; b.id='dashboard-attendance-btn'; b.innerHTML='<span class="qa-icon">🕘</span><span><strong>ثبت ورود</strong><div class="sr-meta">ثبت حضور امروز</div></span>'; b.onclick=()=>toggleAttendance(); grid.appendChild(b);
    const actions=currentProfile?.is_admin ? [['✓','کار جدید','tasks'],['👤','کارفرمای جدید','clients'],['🏗️','پروژه جدید','projects']] : [['✓','کار جدید','tasks'],['📅','تقویم','calendar']];
    actions.forEach(a=>{const b=document.createElement('button');b.className='quick-action';b.innerHTML='<span class="qa-icon">'+a[0]+'</span><span><strong>'+a[1]+'</strong><div class="sr-meta">باز کردن بخش</div></span>';b.onclick=()=>switchSection(a[2]);grid.appendChild(b);});
  }
  updateDashboardAttendanceQuickAction();
  if(!document.getElementById('dashboard-deadlines')){
    const taskList=currentProfile?.is_admin?[...(erpTasks||[]), ...(teamPersonalTasks||[])]: (personalTasks||[]);
    const todayStr=new Date().toISOString().slice(0,10);
    const due=taskList.filter(t=>t.due_date&&t.status!=='done').sort((a,b)=>String(a.due_date).localeCompare(String(b.due_date))).slice(0,6);
    const overdue=due.filter(t=>String(t.due_date).slice(0,10)<todayStr).length;
    const card=document.createElement('div');card.className='card';card.id='dashboard-deadlines';
    card.innerHTML='<div class="row-top"><h2>📌 ددلاین‌های نزدیک</h2><span class="'+(overdue?'deadline-badge':'')+'">'+(overdue?toFaDigits(overdue)+' عقب‌افتاده':'همه به‌روز')+'</span></div>'+ (due.length?due.map(t=>{const late=String(t.due_date).slice(0,10)<todayStr;return '<div class="lead-card '+(late?'task-overdue':'task-soon')+'"><div class="row-top" style="margin:0"><strong>'+escapeHtml(t.title)+'</strong><span class="deadline-badge '+(late?'':'soon')+'">'+(late?'عقب‌افتاده':'ددلاین '+fmtDate(t.due_date))+'</span></div>'+(t.responsible_member_name?'<div class="meta">'+escapeHtml(t.responsible_member_name)+'</div>':'')+'</div>';}).join(''):'<div class="empty">ددلاین فعالی نداری 🎉</div>');
    const cards=section.querySelectorAll('.card'); if(cards.length>0) cards[0].after(card); else section.appendChild(card);
  }
}
// ================= داشبورد =================
function dashboardGreeting(context = '') {
  const firstName = String(currentProfile?.full_name || currentUser?.email || 'دوست عزیز').trim().split(' ')[0] || 'دوست عزیز';
  const name = escapeHtml(firstName);
  const role = currentProfile?.role_title || (currentProfile?.is_admin ? 'مدیر دفتر' : 'عضو تیم');
  const now = new Date();
  let todayLabel = '';
  try {
    const j = JalaaliLib.toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate());
    todayLabel = `${toFaDigits(j.jd)} ${JALALI_MONTHS[j.jm - 1]} ${toFaDigits(j.jy)}`;
  } catch (_) {}
  return `
    <section class="dashboard-greeting">
      <div class="dashboard-greeting-art" aria-hidden="true">
        <span class="greeting-sticker sticker-one">👋</span>
        <span class="greeting-sticker sticker-two">📐</span>
        <span class="greeting-sticker sticker-three">☕</span>
        <span class="greeting-sticker sticker-four">✨</span>
      </div>
      <div class="dashboard-greeting-copy">
        <div class="dashboard-greeting-kicker">صبح بخیر، ${name} <span>🌤️</span></div>
        <div class="dashboard-today-badge">📅 امروز · ${todayLabel}</div>
        <h2>خوش اومدی به استودیو معماری دَست</h2>
        <p>${context} <span class="greeting-inline-emoji">🚀</span></p>
      </div>
      <div class="dashboard-greeting-role"><span>سمت</span><strong>${escapeHtml(role)}</strong></div>
    </section>`;
}
function renderPersonalDashboard() {
  const today = new Date().toISOString().slice(0,10);
  const all = personalTasks || [];
  const active = all.filter(t => t.status !== 'done');
  const overdue = active.filter(t => t.due_date && String(t.due_date).slice(0,10) < today);
  const todayTasks = active.filter(t => t.due_date && String(t.due_date).slice(0,10) === today);
  const high = active.filter(t => t.priority === 'بالا');
  return `
    ${dashboardGreeting('کارهای مهمت، حضور امروز و ددلاین‌های نزدیکت اینجا جمع شده‌اند.')}
    <div class="card">
      <div class="row-top"><h2>⚡ دسترسی سریع</h2><span style="font-size:11px;color:var(--muted)">کارهای پرتکرار دفتر</span></div>
      <div class="quick-actions">
        <button class="quick-action dashboard-attendance-action" id="dashboard-attendance-btn" onclick="toggleAttendance()"><span class="qa-icon">🕘</span><span><strong>ثبت ورود</strong><div class="sr-meta">ثبت حضور امروز</div></span></button>
        <button class="quick-action" onclick="switchSection('tasks')"><span class="qa-icon">✓</span><span><strong>کار جدید</strong><div class="sr-meta">افزودن کار</div></span></button>
        <button class="quick-action" onclick="switchSection('calendar')"><span class="qa-icon">📅</span><span><strong>تقویم</strong><div class="sr-meta">دیدن ددلاین‌ها</div></span></button>
      </div>
    </div>
    <div class="grid-stats">
      <div class="stat"><div class="num">${active.length}</div><div class="label">کار باز</div></div>
      <div class="stat"><div class="num" style="color:var(--danger);">${overdue.length}</div><div class="label">عقب‌افتاده</div></div>
      <div class="stat"><div class="num">${todayTasks.length}</div><div class="label">ددلاین امروز</div></div>
      <div class="stat"><div class="num">${high.length}</div><div class="label">اولویت بالا</div></div>
    </div>
    <div class="card">
      <div class="row-top"><div><h2>👋 نمای شخصی من</h2><div style="font-size:12px;color:var(--muted)">کارهای مهم و نزدیکت را اینجا می‌بینی.</div></div><button class="btn small" onclick="switchSection('tasks')">رفتن به مرکز کارها</button></div>
      ${active.sort((a,b)=>String(a.due_date||'9999').localeCompare(String(b.due_date||'9999'))).slice(0,7).map(t=>`
        <div class="lead-card ${t.due_date && String(t.due_date).slice(0,10)<today?'task-overdue':''}">
          <div class="row-top" style="margin:0"><strong>${escapeHtml(t.title)}</strong><span>${priorityBadge(t.priority)}</span></div>
          <div class="meta" style="margin-top:6px">${taskDueMeta(t)} · ${statusLabel(t.status)}</div>
        </div>`).join('') || '<div class="empty">فعلاً کار بازی نداری 🎉</div>'}
    </div>
`;
}
function renderDashboard() {
  if (!currentProfile?.is_admin) return renderPersonalDashboard();
  const activeLeads = leads.filter(l => l.stage !== 'برنده' && l.stage !== 'بازنده').length;
  const won = leads.filter(l => l.stage === 'برنده').length;
  const lost = leads.filter(l => l.stage === 'بازنده').length;
  const total = won + lost;
  const conv = total > 0 ? Math.round((won/total)*100) : 0;
  const activeProjects = projects.filter(p => p.status === 'فعال').length;
  let overdueSum = 0, pendingSum = 0;
  Object.values(contractStagesMap).flat().forEach(s => {
    const eff = stageEffectiveStatus(s);
    if (eff === 'سررسید گذشته') overdueSum += (s.amount||0);
    if (eff === 'در انتظار') pendingSum += (s.amount||0);
  });
  const monthlyCosts = fixedCosts.reduce((a,c) => a + (c.monthly_amount||0), 0);
  const netFlow = pendingSum - monthlyCosts;
  const todayStr = new Date().toISOString().slice(0,10);
  const upcoming = interactions.filter(i => i.next_follow_up_date && i.next_follow_up_date >= todayStr)
    .sort((a,b) => new Date(a.next_follow_up_date)-new Date(b.next_follow_up_date)).slice(0,6);

  return `
    ${dashboardGreeting('سرنخ‌ها، پروژه‌ها، قراردادها و وضعیت تیم را از همین‌جا زیر نظر داشته باش.')}
    <div class="grid-stats">
      <div class="stat"><div class="num">${activeLeads}</div><div class="label">سرنخ فعال</div></div>
      <div class="stat"><div class="num">${clients.length}</div><div class="label">کارفرما</div></div>
      <div class="stat"><div class="num">${conv}%</div><div class="label">نرخ تبدیل</div></div>
      <div class="stat"><div class="num">${activeProjects}</div><div class="label">پروژه فعال</div></div>
      <div class="stat"><div class="num" style="color:var(--danger);">${overdueSum.toLocaleString('fa-IR')}</div><div class="label">مطالبات معوق (تومان)</div></div>
    </div>
    <div class="card">
      <div class="row-top" style="margin-bottom:0;">
        <div><h2 style="margin:0;">جریان نقدی برآوردی</h2><div class="meta" style="color:var(--muted);font-size:12px;">مطالبات در انتظار منهای هزینه ثابت ماهانه</div></div>
        <div class="num" style="font-size:22px;color:${netFlow>=0?'var(--success)':'var(--danger)'};">${netFlow.toLocaleString('fa-IR')} تومان</div>
      </div>
    </div>
    <div class="card">
      <div class="row-top"><div><h2>👥 وضعیت کارهای تیم</h2><div style="font-size:12px;color:var(--muted)">الان هر کار دست چه کسی است و در چه مرحله‌ای قرار دارد.</div></div><button class="btn small secondary" onclick="switchSection('tasks')">مدیریت کارها</button></div>
      <div id="dashboard-team-tasks"><div class="empty">در حال بارگذاری...</div></div>
    </div>
    <div class="card">
      <div class="row-top"><h2>🧾 آخرین فعالیت‌ها</h2><span style="font-size:11px;color:var(--muted)">ثبت خودکار تغییرات مهم</span></div>
      <div id="dashboard-activity"><div class="empty">در حال بارگذاری...</div></div>
    </div>
    <div class="card">
      <h2>پیگیری‌های نزدیک</h2>
      ${upcoming.length ? upcoming.map(i => `<div style="border-bottom:1px solid var(--border);padding:10px 0;font-size:13px;">
        <strong>${escapeHtml(i.related_name||'')}</strong> — ${escapeHtml(i.type)}
        <div style="color:var(--muted);font-size:11px;">${escapeHtml(i.note||'')} ${i.next_follow_up_date===todayStr?'· امروز':'· '+fmtDate(i.next_follow_up_date)}</div>
      </div>`).join('') : '<div class="empty">پیگیری‌ای ثبت نشده</div>'}
    </div>
  `;
}

async function loadDashboardExtras() {
  if (!currentProfile?.is_admin) return;
  const box=document.getElementById('dashboard-activity');
  const teamBox=document.getElementById('dashboard-team-tasks');
  if (!box && !teamBox) return;
  const [{data},{data:teamRows}] = await Promise.all([sb.from('activity_logs').select('*').order('created_at',{ascending:false}).limit(8),sb.from('personal_tasks').select('*').neq('status','done').order('due_date',{ascending:true})]);
  if(teamBox){const grouped={};(teamRows||[]).forEach(t=>{const k=t.user_id||'unknown';if(!grouped[k])grouped[k]=[];grouped[k].push(t);});const people=Object.keys(grouped);teamBox.innerHTML=people.length?people.map(uid=>'<div class="team-work-row"><div class="team-work-person"><strong>'+escapeHtml(nameOf(uid))+'</strong><span>'+toFaDigits(grouped[uid].length)+' کار باز</span></div><div class="team-work-tasks">'+grouped[uid].slice(0,4).map(t=>'<span class="team-task-chip">'+escapeHtml(t.title)+' · '+statusLabel(t.status)+' · '+taskDueMeta(t)+'</span>').join('')+(grouped[uid].length>4?'<span class="team-task-chip">+ '+(grouped[uid].length-4)+' کار دیگر</span>':'')+'</div></div>').join(''):'<div class="empty">فعلاً کار بازی برای تیم ثبت نشده 🎉</div>';}
  box.innerHTML=(data||[]).length ? (data||[]).map(a=>`
    <div class="activity-row">
      <span class="activity-dot"></span>
      <div><strong>${escapeHtml(activityLabel(a))}</strong><div class="sr-meta">${escapeHtml(a.entity_name||a.entity_type)} · ${notificationTime(a.created_at)}</div></div>
    </div>`).join('') : '<div class="empty">هنوز فعالیتی ثبت نشده.</div>';
}
function activityLabel(a) {
  const map={insert:'ایجاد شد',update:'ویرایش شد',delete:'حذف شد'};
  const names={personal_tasks:'کار',attendance:'حضور و غیاب',leads:'سرنخ',clients:'کارفرما',projects:'پروژه',contracts:'قرارداد',erp_tasks:'وظیفه',fixed_costs:'هزینه ثابت',tenders:'مناقصه / مسابقه',interactions:'پیگیری'};
  return (names[a.entity_type]||a.entity_type)+' '+(map[a.action]||a.action);
}

// ================= پایپ‌لاین سرنخ‌ها =================
function renderPipeline() {
  let html = `
    <div class="row-top"><h2>پایپ‌لاین سرنخ‌ها</h2></div>
    <div class="card">
      <div class="row">
        <input type="text" id="lead-name" placeholder="نام سرنخ">
        <input type="text" id="lead-source" placeholder="منبع">
        <select id="lead-specialty"><option value="">دسته تخصصی</option>${SPECIALTIES.map(s=>`<option>${s}</option>`).join('')}</select>
        <button class="btn" onclick="addLead()">+ سرنخ جدید</button>
      </div>
    </div>
    <div class="pipeline">`;
  STAGES.forEach(stage => {
    const items = leads.filter(l => l.stage === stage);
    html += `<div class="stage-col"><h3>${stage} <span>${items.length}</span></h3>`;
    if (!items.length) html += `<div class="empty" style="padding:10px 0;">—</div>`;
    items.forEach(l => {
      const idx = STAGES.indexOf(l.stage) + 1;
      const nextStage = idx < STAGES.length - 2 ? STAGES[idx] : null;
      html += `<div class="lead-card">
        <div class="name">${escapeHtml(l.name)}</div>
        <div class="meta">${l.specialty_category?`<span class="tag">${l.specialty_category}</span>`:''}${l.source?escapeHtml(l.source):''}</div>
        <div class="actions">
          ${nextStage?`<button class="btn small secondary" onclick="updateLeadStage('${l.id}','${nextStage}')">→ ${nextStage}</button>`:''}
          ${stage!=='برنده'&&stage!=='بازنده'?`<button class="btn small secondary" onclick="updateLeadStage('${l.id}','بازنده')">بازنده</button>`:''}
          ${stage!=='برنده'?`<button class="btn small" onclick="convertLeadToClient('${l.id}')">تبدیل به کارفرما</button>`:''}
          <button class="btn small secondary" onclick="editRow('leads','${l.id}')">ویرایش</button>
          <button class="btn small danger" onclick="deleteLead('${l.id}')">حذف</button>
        </div>
      </div>`;
    });
    html += `</div>`;
  });
  html += `</div>`;
  return html;
}
async function addLead() {
  const name = document.getElementById('lead-name').value.trim();
  const source = document.getElementById('lead-source').value.trim();
  const specialty_category = document.getElementById('lead-specialty').value;
  if (!name) return;
  await sb.from('leads').insert([{ name, source, specialty_category, stage: STAGES[0], status: 'new' }]);
  refreshAllErpData();
}
async function updateLeadStage(id, stage) { await sb.from('leads').update({ stage }).eq('id', id); refreshAllErpData(); }
async function deleteLead(id) { await sb.from('leads').delete().eq('id', id); refreshAllErpData(); }
async function convertLeadToClient(id) {
  const lead = leads.find(x => x.id === id); if (!lead) return;
  await sb.from('clients').insert([{ name: lead.name, type: CLIENT_TYPES[1], contact_info: lead.source || '', reliability_score: 3, status: 'new' }]);
  await updateLeadStage(id, 'برنده');
}

// ================= کارفرمایان =================
function renderClients() {
  let html = `
    <div class="row-top"><h2>کارفرمایان</h2></div>
    <div class="card">
      <div class="row">
        <input type="text" id="client-name" placeholder="نام کارفرما">
        <select id="client-type"><option value="">نوع</option>${CLIENT_TYPES.map(t=>`<option>${t}</option>`).join('')}</select>
        <input type="text" id="client-contact" placeholder="اطلاعات تماس">
        <select id="client-score">${[1,2,3,4,5].map(n=>`<option value="${n}" ${n===3?'selected':''}>امتیاز اعتبار ${n}</option>`).join('')}</select>
        <button class="btn" onclick="addClient()">+ کارفرمای جدید</button>
      </div>
    </div>
    <div class="card">`;
  if (!clients.length) html += `<div class="empty">هنوز کارفرمایی ثبت نشده</div>`;
  else {
    html += `<table><thead><tr><th>نام</th><th>نوع</th><th>امتیاز اعتبار</th><th>تماس</th><th></th></tr></thead><tbody>`;
    clients.forEach(c => {
      html += `<tr>
        <td>${escapeHtml(c.name)}</td>
        <td>${escapeHtml(c.type||'')}</td>
        <td class="score ${scoreClass(c.reliability_score||3)}">${c.reliability_score||3}/۵</td>
        <td>${escapeHtml(c.contact_info||c.phone||'')}</td>
        <td>
          <button class="btn small secondary" onclick="editRow('clients','${c.id}')">ویرایش</button>
          <button class="btn small danger" onclick="deleteRow('clients','${c.id}')">حذف</button>
        </td>
      </tr>`;
    });
    html += `</tbody></table>`;
  }
  html += `</div>`;
  return html;
}
async function addClient() {
  const name = document.getElementById('client-name').value.trim();
  const type = document.getElementById('client-type').value;
  const contact_info = document.getElementById('client-contact').value.trim();
  const reliability_score = parseInt(document.getElementById('client-score').value);
  if (!name) return;
  await sb.from('clients').insert([{ name, type, contact_info, reliability_score, status: 'new' }]);
  refreshAllErpData();
}

// ================= پروژه‌ها =================
function renderProjects() {
  let html = `<div class="row-top"><h2>پروژه‌ها</h2></div>
    <div class="card">
      <div class="row">
        <input type="text" id="project-title" placeholder="عنوان پروژه">
        <select id="project-client"><option value="">— کارفرما —</option>${clients.map(c=>`<option value="${c.id}" data-name="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`).join('')}</select>
        <input type="text" id="project-responsible" placeholder="مسئول پروژه">
        <select id="project-specialty"><option value="">دسته تخصصی</option>${SPECIALTIES.map(s=>`<option>${s}</option>`).join('')}</select>
        <button class="btn" onclick="addProject()">+ پروژه جدید</button>
      </div>
    </div>`;
  if (!projects.length) { html += `<div class="card"><div class="empty">هنوز پروژه‌ای ثبت نشده</div></div>`; return html; }
  projects.forEach(p => {
    html += `<div class="card">
      <div class="row-top" style="margin-bottom:6px;">
        <div><strong>${escapeHtml(p.title)}</strong> ${p.specialty_category?`<span class="tag">${p.specialty_category}</span>`:''}
          <div style="color:var(--muted);font-size:12px;">کارفرما: ${escapeHtml(p.client_name||'—')} · مسئول: ${escapeHtml(p.responsible_member||'—')}</div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <select onchange="updateProjectField('${p.id}','phase',this.value)" style="width:auto;">${PHASES.map(ph=>`<option ${ph===p.phase?'selected':''}>${ph}</option>`).join('')}</select>
          <select onchange="updateProjectField('${p.id}','status',this.value)" style="width:auto;">${PROJECT_STATUSES.map(s=>`<option ${s===p.status?'selected':''}>${s}</option>`).join('')}</select>
          <button class="btn small secondary" onclick="editRow('projects','${p.id}')">ویرایش</button>
          <button class="btn small danger" onclick="deleteRow('projects','${p.id}')">حذف</button>
        </div>
      </div>
    </div>`;
  });
  return html;
}
async function addProject() {
  const title = document.getElementById('project-title').value.trim();
  const clientSel = document.getElementById('project-client');
  const client_id = clientSel.value || null;
  const client_name = clientSel.selectedOptions[0] ? clientSel.selectedOptions[0].dataset.name : '';
  const responsible_member = document.getElementById('project-responsible').value.trim();
  const specialty_category = document.getElementById('project-specialty').value;
  if (!title) return;
  await sb.from('projects').insert([{ title, client_id, client_name, responsible_member, specialty_category }]);
  refreshAllErpData();
}
async function updateProjectField(id, field, value) { await sb.from('projects').update({ [field]: value }).eq('id', id); refreshAllErpData(); }

// ================= قراردادها =================
function renderContracts() {
  const allStages = Object.entries(contractStagesMap).flatMap(([cid, arr]) => arr);
  const overdue = allStages.filter(s => stageEffectiveStatus(s) === 'سررسید گذشته');
  const pending = allStages.filter(s => stageEffectiveStatus(s) === 'در انتظار');
  let html = `<div class="row-top"><h2>قراردادها و مطالبات</h2></div>
    <div class="grid-stats">
      <div class="stat"><div class="num">${overdue.length}</div><div class="label">مرحله سررسید گذشته</div></div>
      <div class="stat"><div class="num">${overdue.reduce((a,s)=>a+(s.amount||0),0).toLocaleString('fa-IR')}</div><div class="label">مبلغ معوق</div></div>
      <div class="stat"><div class="num">${pending.length}</div><div class="label">مرحله در انتظار</div></div>
      <div class="stat"><div class="num">${pending.reduce((a,s)=>a+(s.amount||0),0).toLocaleString('fa-IR')}</div><div class="label">مبلغ در انتظار</div></div>
    </div>
    <div class="card">
      <div class="row">
        <select id="contract-project"><option value="">— پروژه —</option>${projects.map(p=>`<option value="${p.id}" data-title="${escapeHtml(p.title)}">${escapeHtml(p.title)}</option>`).join('')}</select>
        <input type="number" id="contract-amount" placeholder="مبلغ کل (تومان)">
        <input type="number" id="contract-advance" placeholder="درصد پیش‌پرداخت">
        <button class="btn" onclick="addContract()">+ قرارداد جدید</button>
      </div>
    </div>`;
  if (!contracts.length) { html += `<div class="card"><div class="empty">هنوز قراردادی ثبت نشده</div></div>`; return html; }
  contracts.forEach(c => {
    const stages = contractStagesMap[c.id] || [];
    html += `<div class="card">
      <div class="row-top" style="margin-bottom:6px;">
        <div><strong>${escapeHtml(c.project_title||'—')}</strong>
          <div style="color:var(--muted);font-size:12px;">مبلغ کل: ${(c.total_amount||0).toLocaleString('fa-IR')} تومان · پیش‌پرداخت: ${c.advance_payment_percent||0}٪</div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <select onchange="updateContractField('${c.id}','status',this.value)" style="width:auto;">${CONTRACT_STATUSES.map(s=>`<option ${s===c.status?'selected':''}>${s}</option>`).join('')}</select>
          <button class="btn small secondary" onclick="editRow('contracts','${c.id}')">ویرایش</button>
        </div>
      </div>
      <div class="row">
        <input type="text" placeholder="عنوان مرحله" id="stage-title-${c.id}">
        <input type="number" placeholder="مبلغ" id="stage-amount-${c.id}">
        ${jalaliDateField('stage-date-' + c.id)}
        <button class="btn small" onclick="addStage('${c.id}')">+ مرحله</button>
      </div>
      <table><thead><tr><th>مرحله</th><th>مبلغ</th><th>سررسید</th><th>وضعیت</th><th></th></tr></thead><tbody>
        ${stages.map(s => { const eff = stageEffectiveStatus(s); const cls = eff==='وصول‌شده'?'high':eff==='سررسید گذشته'?'low':'mid';
          return `<tr><td>${escapeHtml(s.title)}</td><td>${(s.amount||0).toLocaleString('fa-IR')}</td><td>${fmtDate(s.due_date) || '—'}</td>
          <td class="score ${cls}">${eff}</td>
          <td><button class="btn small secondary" onclick="editRow('contract_stages','${s.id}')">ویرایش</button> ${eff!=='وصول‌شده'?`<button class="btn small secondary" onclick="markStageReceived('${s.id}')">وصول شد</button>`:''}</td></tr>`;
        }).join('')}
      </tbody></table>
    </div>`;
  });
  return html;
}
function stageEffectiveStatus(s) {
  if (s.received) return 'وصول‌شده';
  if (s.due_date && new Date(s.due_date) < new Date(new Date().toDateString())) return 'سررسید گذشته';
  return 'در انتظار';
}
async function addContract() {
  const sel = document.getElementById('contract-project');
  const project_id = sel.value || null;
  const project_title = sel.selectedOptions[0] ? sel.selectedOptions[0].dataset.title : '';
  const total_amount = parseFloat(document.getElementById('contract-amount').value) || 0;
  const advance_payment_percent = parseInt(document.getElementById('contract-advance').value) || 0;
  await sb.from('contracts').insert([{ project_id, project_title, total_amount, advance_payment_percent }]);
  refreshAllErpData();
}
async function updateContractField(id, field, value) { await sb.from('contracts').update({ [field]: value }).eq('id', id); refreshAllErpData(); }
async function addStage(contractId) {
  const title = document.getElementById(`stage-title-${contractId}`).value.trim();
  const amount = parseFloat(document.getElementById(`stage-amount-${contractId}`).value) || 0;
  const due_date = getJalaliDate(`stage-date-${contractId}`);
  if (!title) return;
  await sb.from('contract_stages').insert([{ contract_id: contractId, title, amount, due_date }]);
  refreshAllErpData();
}
async function markStageReceived(stageId) { await sb.from('contract_stages').update({ received: true }).eq('id', stageId); refreshAllErpData(); }

async function loadUnifiedTaskOverview() {
  if (!currentProfile?.is_admin) return;
  const box = document.getElementById('task-unified-overview');
  if (!box) return;
  const { data: officeRows, error } = await sb.from('tasks').select('id,status');
  const office = !error ? (officeRows || []) : [];
  const personalOpen = (teamPersonalTasks || []).filter(t => t.status !== 'done').length;
  const personalAll = (teamPersonalTasks || []).length;
  const erpOpen = (erpTasks || []).filter(t => t.status !== 'تکمیل‌شده').length;
  const erpAll = (erpTasks || []).length;
  const officeOpen = office.filter(t => t.status !== 'done').length;
  const officeAll = office.length;
  const sources = [
    { icon:'👥', title:'کارهای تیم', open:personalOpen, total:personalAll, section:'tasks', hint:'مسئول مشخص + ددلاین + اولویت' },
    { icon:'📌', title:'وظایف مدیریتی', open:erpOpen, total:erpAll, section:'erp-tasks', hint:'وظایف دفتر و تأیید مؤسس' },
    { icon:'🏷️', title:'کارهای مرتبط با کارفرما', open:officeOpen, total:officeAll, section:'office-tasks', hint:'کارهای قدیمی متصل به کارفرما' }
  ];
  box.innerHTML = sources.map(s => '<div class="task-source-card"><div class="task-source-icon">'+s.icon+'</div><div class="task-source-copy"><strong>'+s.title+'</strong><span>'+toFaDigits(s.open)+' باز · '+toFaDigits(s.total)+' کل</span><small>'+s.hint+'</small></div><button class="btn small secondary" onclick="switchSection(\''+s.section+'\')">باز کردن</button></div>').join('');
}

// ================= کارهای دفتر (CRM tasks + کلندر) =================
function renderOfficeTasks() {
  let html = `<div class="row-top"><h2>کارهای دفتر</h2></div>
    <div class="card">
      <div class="row">
        <input type="text" id="task-title" placeholder="عنوان کار">
        ${jalaliDateField('task-date')}
        <select id="task-client"><option value="">— انتخاب کارفرما —</option>${clients.map(c=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</select>
        <button class="btn" onclick="addOfficeTask()">افزودن کار</button>
      </div>
    </div>
    <div class="card"><table><thead><tr><th>عنوان</th><th>تاریخ</th><th>مربوط به</th><th>وضعیت</th><th></th></tr></thead><tbody id="tasks-table"></tbody></table></div>`;
  loadOfficeTasks();
  return html;
}
async function addOfficeTask() {
  const title = document.getElementById('task-title').value.trim();
  const date = getJalaliDate('task-date');
  const client_id = document.getElementById('task-client').value || null;
  if (!title) return;
  await sb.from('tasks').insert([{ title, date, client_id, status: 'new' }]);
  if (date) apiPost('/api/create-event', { title, date });
  document.getElementById('task-title').value=''; clearJalaliDate('task-date');
  loadOfficeTasks();
}
async function loadOfficeTasks() {
  const { data } = await sb.from('tasks').select('*, clients(name)').order('date', { ascending: true });
  const tbody = document.getElementById('tasks-table'); if (!tbody) return;
  cacheRows('tasks', data||[]);
  tbody.innerHTML = (data||[]).map(t => `<tr>
    <td>${escapeHtml(t.title)}</td><td>${fmtDate(t.date)}</td><td>${t.clients?t.clients.name:'-'}</td><td>${statusLabel(t.status)}</td>
    <td><button class="btn small secondary" onclick="editRow('tasks','${t.id}')">ویرایش</button> <button class="btn small danger" onclick="deleteRow('tasks','${t.id}')">حذف</button></td>
  </tr>`).join('');
}

// ================= تیم =================
function renderTeam() {
  let html = `<div class="row-top"><h2>تیم</h2></div>
    <div class="card">
      <div class="row">
        <input type="text" id="member-name" placeholder="نام عضو">
        <select id="member-department"><option value="">واحد</option>${DEPARTMENTS.map(d=>`<option>${d}</option>`).join('')}</select>
        <select id="member-access"><option value="">سطح دسترسی</option>${ACCESS_LEVELS.map(a=>`<option>${a}</option>`).join('')}</select>
        <button class="btn" onclick="addMember()">+ عضو جدید</button>
      </div>
    </div>
    <div class="card">`;
  if (!members.length) html += `<div class="empty">هنوز عضوی ثبت نشده</div>`;
  else {
    html += `<table><thead><tr><th>نام</th><th>واحد</th><th>سطح دسترسی</th><th></th></tr></thead><tbody>`;
    members.forEach(m => html += `<tr><td>${escapeHtml(m.name)}</td><td>${escapeHtml(m.department||'')}</td><td>${escapeHtml(m.access_level||'')}</td>
      <td><button class="btn small secondary" onclick="editRow('members','${m.id}')">ویرایش</button> <button class="btn small danger" onclick="deleteRow('members','${m.id}')">حذف</button></td></tr>`);
    html += `</tbody></table>`;
  }
  html += `</div>`;

  const accounts = (allProfiles || []).map(p => `
    <tr>
      <td>${escapeHtml(p.full_name || '—')}</td>
      <td>${escapeHtml(p.role_title || (p.is_admin ? 'مدیر' : 'عضو تیم'))}</td>
      <td>${p.is_admin ? 'مدیر' : 'کاربر'}</td>
      <td><button class="btn small secondary" onclick="resetUserPassword('${p.id}', ${JSON.stringify(p.full_name || 'کاربر')})">🔐 ریست رمز</button></td>
    </tr>`).join('');

  html += `<div class="card">
    <div class="row-top"><h2>🔐 حساب‌های ورود</h2><span style="font-size:11px;color:var(--muted)">پسوردها ذخیره یا نمایش دائمی نمی‌شوند</span></div>
    <table><thead><tr><th>نام</th><th>سمت</th><th>نوع حساب</th><th></th></tr></thead>
    <tbody>${accounts || '<tr><td colspan="4" class="empty">حسابی پیدا نشد</td></tr>'}</tbody></table>
  </div>`;
  return html;
}
async function addMember() {
  const name = document.getElementById('member-name').value.trim();
  const department = document.getElementById('member-department').value;
  const access_level = document.getElementById('member-access').value;
  if (!name) return;
  await sb.from('members').insert([{ name, department, access_level }]);
  refreshAllErpData();
}

// ================= وظایف (ERP) =================
function renderErpTasks() {
  let html = `<div class="row-top"><h2>وظایف</h2></div>
    <div class="card">
      <div class="row">
        <input type="text" id="erptask-title" placeholder="عنوان وظیفه">
        <input type="text" id="erptask-responsible" placeholder="مسئول">
        <select id="erptask-priority">${TASK_PRIORITIES.map(p=>`<option>${p}</option>`).join('')}</select>
        ${jalaliDateField('erptask-date')}
        <label style="display:flex;align-items:center;gap:4px;font-size:12px;"><input type="checkbox" id="erptask-approval" checked style="width:auto;"> نیازمند تأیید مؤسس</label>
        <button class="btn" onclick="addErpTask()">+ وظیفه جدید</button>
      </div>
    </div>
    <div class="pipeline">`;
  TASK_STATUSES.forEach(status => {
    const items = erpTasks.filter(t => t.status === status);
    html += `<div class="stage-col"><h3>${status} <span>${items.length}</span></h3>`;
    if (!items.length) html += `<div class="empty" style="padding:10px 0;">—</div>`;
    items.forEach(t => {
      const idx = TASK_STATUSES.indexOf(t.status) + 1;
      const next = idx < TASK_STATUSES.length ? TASK_STATUSES[idx] : null;
      html += `<div class="lead-card">
        <div class="name">${escapeHtml(t.title)}</div>
        <div class="meta">${t.responsible_member_name?escapeHtml(t.responsible_member_name):'بدون مسئول'} · اولویت ${escapeHtml(t.priority||'')} ${t.due_date?'· '+fmtDate(t.due_date):''}</div>
        <div class="meta" style="margin-bottom:6px;">${t.requires_founder_approval?'<span class="tag">نیازمند تأیید مؤسس</span>':'<span class="tag">مستقل</span>'}</div>
        <div class="actions">
          ${next?`<button class="btn small secondary" onclick="updateErpTask('${t.id}','status','${next}')">→ ${next}</button>`:''}
          <button class="btn small secondary" onclick="updateErpTask('${t.id}','requires_founder_approval',${!t.requires_founder_approval})">تغییر وضعیت تأیید</button>
          <button class="btn small secondary" onclick="editRow('erp_tasks','${t.id}')">ویرایش</button>
          <button class="btn small danger" onclick="deleteRow('erp_tasks','${t.id}')">حذف</button>
        </div>
      </div>`;
    });
    html += `</div>`;
  });
  html += `</div>`;
  return html;
}
async function addErpTask() {
  const title = document.getElementById('erptask-title').value.trim();
  const responsible_member_name = document.getElementById('erptask-responsible').value.trim();
  const priority = document.getElementById('erptask-priority').value;
  const due_date = getJalaliDate('erptask-date');
  const requires_founder_approval = document.getElementById('erptask-approval').checked;
  if (!title) return;
  await sb.from('erp_tasks').insert([{ title, responsible_member_name, priority, due_date, requires_founder_approval, status: TASK_STATUSES[0] }]);
  refreshAllErpData();
}
async function updateErpTask(id, field, value) { await sb.from('erp_tasks').update({ [field]: value }).eq('id', id); refreshAllErpData(); }

// ================= هزینه‌های ثابت =================
function renderFixedCosts() {
  const totalMonthly = fixedCosts.reduce((a,c)=>a+(c.monthly_amount||0),0);
  const unpaid = fixedCosts.filter(c=>c.payment_status!=='پرداخت‌شده');
  const unpaidSum = unpaid.reduce((a,c)=>a+(c.monthly_amount||0),0);
  let html = `<div class="row-top"><h2>هزینه‌های ثابت دفتر</h2></div>
    <div class="grid-stats">
      <div class="stat"><div class="num">${totalMonthly.toLocaleString('fa-IR')}</div><div class="label">مجموع ماهانه</div></div>
      <div class="stat"><div class="num" style="color:${unpaidSum>0?'var(--danger)':'var(--success)'};">${unpaidSum.toLocaleString('fa-IR')}</div><div class="label">پرداخت‌نشده</div></div>
    </div>
    <div class="card">
      <div class="row">
        <input type="text" id="cost-title" placeholder="عنوان هزینه">
        <input type="number" id="cost-amount" placeholder="مبلغ ماهانه">
        <input type="number" id="cost-day" placeholder="روز سررسید" min="1" max="31">
        <button class="btn" onclick="addFixedCost()">+ هزینه جدید</button>
      </div>`;
  if (!fixedCosts.length) html += `<div class="empty">هنوز هزینه ثابتی ثبت نشده</div>`;
  else {
    html += `<table><thead><tr><th>عنوان</th><th>مبلغ ماهانه</th><th>سررسید</th><th>وضعیت</th><th></th></tr></thead><tbody>`;
    fixedCosts.forEach(c => { const paid = c.payment_status === 'پرداخت‌شده';
      html += `<tr><td>${escapeHtml(c.title)}</td><td>${(c.monthly_amount||0).toLocaleString('fa-IR')}</td><td>روز ${c.due_day||1}</td>
      <td class="score ${paid?'high':'low'}">${c.payment_status}</td>
      <td><button class="btn small secondary" onclick="editRow('fixed_costs','${c.id}')">ویرایش</button> <button class="btn small secondary" onclick="toggleCostPaid('${c.id}',${paid})">${paid?'پرداخت‌نشده کن':'پرداخت‌شده کن'}</button></td></tr>`;
    });
    html += `</tbody></table>`;
  }
  html += `</div>`;
  return html;
}
async function addFixedCost() {
  const title = document.getElementById('cost-title').value.trim();
  const monthly_amount = parseFloat(document.getElementById('cost-amount').value) || 0;
  const due_day = parseInt(document.getElementById('cost-day').value) || 1;
  if (!title) return;
  await sb.from('fixed_costs').insert([{ title, monthly_amount, due_day }]);
  refreshAllErpData();
}
async function toggleCostPaid(id, currentlyPaid) {
  await sb.from('fixed_costs').update({ payment_status: currentlyPaid ? 'پرداخت‌نشده' : 'پرداخت‌شده' }).eq('id', id);
  refreshAllErpData();
}

// ================= مناقصه / مسابقه =================
function renderTenders() {
  const sportsTenders = tenders.filter(t => t.specialty_category === 'ورزشی');
  const won = tenders.filter(t => t.status === 'برنده').length;
  let html = `<div class="row-top"><h2>مناقصه / مسابقه</h2></div>
    <div class="grid-stats">
      <div class="stat"><div class="num">${tenders.length}</div><div class="label">کل ثبت‌شده</div></div>
      <div class="stat"><div class="num">${sportsTenders.length}</div><div class="label">دسته ورزشی</div></div>
      <div class="stat"><div class="num">${won}</div><div class="label">برنده‌شده</div></div>
    </div>
    <div class="card">
      <div class="row">
        <input type="text" id="tender-title" placeholder="عنوان">
        <select id="tender-type">${TENDER_TYPES.map(t=>`<option>${t}</option>`).join('')}</select>
        <input type="text" id="tender-issuer" placeholder="برگزارکننده">
        <select id="tender-specialty"><option value="">دسته</option>${SPECIALTIES.map(s=>`<option>${s}</option>`).join('')}</select>
        ${jalaliDateField('tender-date')}
        <button class="btn" onclick="addTender()">+ جدید</button>
      </div>
    </div>`;
  if (!tenders.length) { html += `<div class="card"><div class="empty">هنوز مناقصه/مسابقه‌ای ثبت نشده</div></div>`; return html; }
  html += `<div class="card"><table><thead><tr><th>عنوان</th><th>نوع</th><th>برگزارکننده</th><th>دسته</th><th>تاریخ</th><th>وضعیت</th><th></th></tr></thead><tbody>`;
  tenders.forEach(t => {
    html += `<tr><td>${escapeHtml(t.title)}</td><td>${escapeHtml(t.type||'')}</td><td>${escapeHtml(t.issuing_body||'')}</td>
      <td>${t.specialty_category?`<span class="tag">${t.specialty_category}</span>`:''}</td><td>${fmtDate(t.event_date) || '—'}</td>
      <td><select onchange="updateTenderStatus('${t.id}',this.value)" style="width:auto;">${TENDER_STATUSES.map(s=>`<option ${s===t.status?'selected':''}>${s}</option>`).join('')}</select></td>
      <td><button class="btn small secondary" onclick="editRow('tenders','${t.id}')">ویرایش</button> <button class="btn small danger" onclick="deleteRow('tenders','${t.id}')">حذف</button></td></tr>`;
  });
  html += `</tbody></table></div>`;
  return html;
}
async function addTender() {
  const title = document.getElementById('tender-title').value.trim();
  const type = document.getElementById('tender-type').value;
  const issuing_body = document.getElementById('tender-issuer').value.trim();
  const specialty_category = document.getElementById('tender-specialty').value;
  const event_date = getJalaliDate('tender-date');
  if (!title) return;
  await sb.from('tenders').insert([{ title, type, issuing_body, specialty_category, event_date }]);
  refreshAllErpData();
}
async function updateTenderStatus(id, status) { await sb.from('tenders').update({ status }).eq('id', id); refreshAllErpData(); }

// ================= عمومی =================
async function deleteRow(table, id) { await sb.from(table).delete().eq('id', id); refreshAllErpData(); }

const rowCache = {};
function cacheRows(table, rows) { (rows || []).forEach(r => { rowCache[table + ':' + r.id] = r; }); }

const EDIT_CONFIG = {
  clients: { title: 'کارفرما', fields: [
    { key: 'name', label: 'نام', type: 'text' },
    { key: 'type', label: 'نوع', type: 'select', options: CLIENT_TYPES },
    { key: 'contact_info', label: 'اطلاعات تماس', type: 'text' },
    { key: 'reliability_score', label: 'امتیاز اعتبار (۱ تا ۵)', type: 'select', options: [1,2,3,4,5] } ] },
  leads: { title: 'سرنخ', fields: [
    { key: 'name', label: 'نام', type: 'text' },
    { key: 'source', label: 'منبع', type: 'text' },
    { key: 'specialty_category', label: 'دسته تخصصی', type: 'select', options: SPECIALTIES },
    { key: 'stage', label: 'مرحله', type: 'select', options: STAGES } ] },
  projects: { title: 'پروژه', fields: [
    { key: 'title', label: 'عنوان پروژه', type: 'text' },
    { key: 'responsible_member', label: 'مسئول پروژه', type: 'text' },
    { key: 'specialty_category', label: 'دسته تخصصی', type: 'select', options: SPECIALTIES },
    { key: 'phase', label: 'فاز', type: 'select', options: PHASES },
    { key: 'status', label: 'وضعیت', type: 'select', options: PROJECT_STATUSES } ] },
  contracts: { title: 'قرارداد', fields: [
    { key: 'project_title', label: 'عنوان پروژه', type: 'text' },
    { key: 'total_amount', label: 'مبلغ کل (تومان)', type: 'number' },
    { key: 'advance_payment_percent', label: 'درصد پیش‌پرداخت', type: 'number' },
    { key: 'status', label: 'وضعیت', type: 'select', options: CONTRACT_STATUSES } ] },
  contract_stages: { title: 'مرحله پرداخت', fields: [
    { key: 'title', label: 'عنوان مرحله', type: 'text' },
    { key: 'amount', label: 'مبلغ (تومان)', type: 'number' },
    { key: 'due_date', label: 'تاریخ سررسید', type: 'date' } ] },
  tasks: { title: 'کار دفتر', fields: [
    { key: 'title', label: 'عنوان', type: 'text' },
    { key: 'date', label: 'تاریخ', type: 'date' } ] },
  personal_tasks: { title: 'کار', fields: [
    { key: 'title', label: 'عنوان', type: 'text' },
    { key: 'priority', label: 'اولویت', type: 'select', options: TASK_PRIORITIES },
    { key: 'due_date', label: 'ددلاین', type: 'date' },
    { key: 'status', label: 'وضعیت', type: 'select', options: ['new','progress','done'] } ] },
  members: { title: 'عضو تیم', fields: [
    { key: 'name', label: 'نام', type: 'text' },
    { key: 'department', label: 'واحد', type: 'select', options: DEPARTMENTS },
    { key: 'access_level', label: 'سطح دسترسی', type: 'select', options: ACCESS_LEVELS } ] },
  erp_tasks: { title: 'وظیفه', fields: [
    { key: 'title', label: 'عنوان', type: 'text' },
    { key: 'responsible_member_name', label: 'مسئول', type: 'text' },
    { key: 'priority', label: 'اولویت', type: 'select', options: TASK_PRIORITIES },
    { key: 'due_date', label: 'تاریخ', type: 'date' },
    { key: 'status', label: 'وضعیت', type: 'select', options: TASK_STATUSES } ] },
  fixed_costs: { title: 'هزینه ثابت', fields: [
    { key: 'title', label: 'عنوان', type: 'text' },
    { key: 'monthly_amount', label: 'مبلغ ماهانه (تومان)', type: 'number' },
    { key: 'due_day', label: 'روز سررسید (۱ تا ۳۱)', type: 'number' } ] },
  tenders: { title: 'مناقصه / مسابقه', fields: [
    { key: 'title', label: 'عنوان', type: 'text' },
    { key: 'type', label: 'نوع', type: 'select', options: TENDER_TYPES },
    { key: 'issuing_body', label: 'برگزارکننده', type: 'text' },
    { key: 'specialty_category', label: 'دسته', type: 'select', options: SPECIALTIES },
    { key: 'event_date', label: 'تاریخ', type: 'date' },
    { key: 'status', label: 'وضعیت', type: 'select', options: TENDER_STATUSES } ] },
};

function editRow(table, id) {
  const cfg = EDIT_CONFIG[table], row = rowCache[table + ':' + id];
  if (!cfg || !row) { alert('اطلاعات این مورد پیدا نشد، صفحه را رفرش کن.'); return; }
  openEditModal(table, id, cfg.title, cfg.fields, row);
}

function openEditModal(table, id, title, fields, values) {
  const root = document.getElementById('edit-modal-root');
  root.innerHTML = `
    <div class="overlay" onclick="if(event.target===this) closeEditModal()">
      <div class="modal">
        <h3>ویرایش ${title}</h3>
        ${fields.map(f => {
          const cur = values[f.key] ?? '';
          if (f.type === 'select') {
            const blank = String(cur) === '' ? '<option value="">—</option>' : '';
            return `<label>${f.label}</label><select id="edit-${f.key}">${blank}${f.options.map(o => `<option value="${o}" ${String(o) === String(cur) ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
          }
          if (f.type === 'date') return `<label>${f.label}</label>${jalaliDateField('edit-' + f.key, cur)}`;
          return `<label>${f.label}</label><input type="${f.type}" id="edit-${f.key}" value="${escapeHtml(cur)}">`;
        }).join('')}
        <div class="modal-actions">
          <button class="btn secondary" onclick="closeEditModal()">انصراف</button>
          <button class="btn" onclick="saveEditModal('${table}','${id}')">ذخیره تغییرات</button>
        </div>
      </div>
    </div>`;
  root.dataset.fields = JSON.stringify(fields.map(f => ({ key: f.key, type: f.type })));
}
function closeEditModal() { document.getElementById('edit-modal-root').innerHTML = ''; }
async function saveEditModal(table, id) {
  const root = document.getElementById('edit-modal-root');
  const fields = JSON.parse(root.dataset.fields);
  const payload = {};
  fields.forEach(f => {
    if (f.type === 'date') { payload[f.key] = getJalaliDate('edit-' + f.key); return; }
    const el = document.getElementById('edit-' + f.key);
    let v = el.value;
    if (f.type === 'number') v = v === '' ? null : (parseFloat(v) || 0);
    payload[f.key] = v;
  });
  const { error } = await sb.from(table).update(payload).eq('id', id);
  if (error) { alert('ذخیره نشد: ' + error.message); return; }
  if (table === 'personal_tasks') apiPost('/api/task-calendar', { task_id: id, action: 'sync' });
  closeEditModal();
  if (currentProfile.is_admin) { refreshAllErpData(); if (document.getElementById('teamtasks-table')) loadTeamTasks(); }
  else renderTasksSection();
}

checkSession();

const _attendanceQrParam = new URLSearchParams(location.search).get('attendance_qr');
if (_attendanceQrParam === 'office') {
  sessionStorage.setItem('dast_pending_attendance_qr', 'office');
  window.history.replaceState({}, '', location.pathname);
  setTimeout(() => window.tryPendingAttendanceQR?.(), 900);
}
const _calParam = new URLSearchParams(location.search).get('calendar');
if (_calParam) {
  window.history.replaceState({}, '', location.pathname);
  if (_calParam === 'connected') setTimeout(() => alert('گوگل کلندر با موفقیت وصل شد.'), 300);
  else if (_calParam === 'error') setTimeout(() => alert('اتصال گوگل کلندر ناموفق بود، دوباره تلاش کن.'), 300);
}
