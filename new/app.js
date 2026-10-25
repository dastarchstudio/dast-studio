/*
  پنل دفتر دَست — بخش اول
  - ورود با انتخاب کارمند و رمز (همان API قبلی)
  - حضور و غیاب: ثبت ورود و خروج در جدول attendance
  - کارهای من: کارهای خودم در جدول personal_tasks
  - واگذاری کار (فقط ادمین): ساخت کار برای کارمند
  - خروجی Excel ماه (همان API قبلی؛ هر کس فایل خودش، ادمین همه)

  قوانین دسترسی روی خود دیتابیس (RLS) اعمال شده‌اند؛ اینجا فقط نمایش را مدیریت می‌کنیم.
*/
(function () {
  'use strict';

  // ---------- ثابت‌ها ----------
  var SB = location.origin + '/api/sb';          // همه‌ی ترافیک Supabase از پراکسی همین سایت
  var SESSION_KEY = 'dast-session';
  var TEHRAN = '+03:30';
  var STATUS_LABEL = { 'new': 'جدید', 'progress': 'در حال انجام', 'done': 'تکمیل شده' };
  var STATUS_NEXT = { 'new': 'progress', 'progress': 'done', 'done': 'new' };
  var STATUS_BTN = { 'new': 'شروع کار', 'progress': 'تکمیل', 'done': 'بازگردانی' };
  var PRIORITIES = ['بالا', 'متوسط', 'پایین'];
  var PRIORITY_CLASS = { 'بالا': 'p-high', 'متوسط': 'p-mid', 'پایین': 'p-low' };
  var STATUS_CLASS = { 'new': 'b-new', 'progress': 'b-progress', 'done': 'b-done' };

  var staff = [];           // [{id, full_name, role_title, is_admin}]
  var state = { tab: 'attendance' };

  // ---------- ابزارهای کوچک ----------
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = String(text);
    return n;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function staffName(id) {
    for (var i = 0; i < staff.length; i++) if (staff[i].id === id) return staff[i].full_name;
    return '—';
  }
  function todayTehran() {
    // YYYY-MM-DD به وقت تهران
    var parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    var o = {};
    parts.forEach(function (p) { o[p.type] = p.value; });
    return o.year + '-' + o.month + '-' + o.day;
  }
  function dayRange(day) {
    var start = new Date(day + 'T00:00:00' + TEHRAN);
    var end = new Date(start.getTime() + 24 * 3600 * 1000);
    return { start: start.toISOString(), end: end.toISOString() };
  }
  function timeOf(iso) {
    if (!iso) return '—';
    return new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  }
  function dateOf(day) {
    if (!day) return '—';
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { timeZone: 'Asia/Tehran', year: 'numeric', month: 'long', day: 'numeric' })
      .format(new Date(day + 'T12:00:00' + TEHRAN));
  }

  // ---------- نشست و درخواست به Supabase ----------
  function readSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch (e) { return null; }
  }
  function writeSession(s) { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); }
  function clearSession() { localStorage.removeItem(SESSION_KEY); }

  function sbPath(path, query) {
    return SB + '?__p=' + encodeURIComponent(path) + (query ? '&' + query : '');
  }
  function refreshSession(s) {
    return fetch(sbPath('auth/v1/token', 'grant_type=refresh_token'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refresh_token: s.refresh_token })
    }).then(function (r) {
      if (!r.ok) return null;
      return r.json().then(function (d) {
        var next = {
          access_token: d.access_token, refresh_token: d.refresh_token,
          expires_at: Date.now() + (d.expires_in || 3600) * 1000,
          user_id: s.user_id, is_admin: s.is_admin, name: s.name
        };
        writeSession(next);
        return next;
      });
    }).catch(function () { return null; });
  }
  // نشست معتبر را برمی‌گرداند؛ اگر منقضی باشد تازه‌سازی می‌کند
  function ensureSession() {
    var s = readSession();
    if (!s) return Promise.resolve(null);
    if (Date.now() < (s.expires_at || 0) - 60000) return Promise.resolve(s);
    return refreshSession(s);
  }
  // درخواست به جداول Supabase با توکن کاربر (RLS اعمال می‌شود)
  function sb(path, query, opts) {
    opts = opts || {};
    return ensureSession().then(function (s) {
      if (!s) throw new Error('نشست فعال نیست');
      var headers = { 'content-type': 'application/json', authorization: 'Bearer ' + s.access_token };
      if (opts.prefer) headers.prefer = opts.prefer;
      return fetch(sbPath(path, query), {
        method: opts.method || 'GET',
        headers: headers,
        body: opts.body ? JSON.stringify(opts.body) : undefined
      });
    }).then(function (r) {
      if (!r.ok) throw new Error('خطا در ارتباط با سرور (' + r.status + ')');
      return opts.raw ? r : r.json().catch(function () { return null; });
    });
  }

  // ---------- ورود ----------
  function loadStaff() {
    return fetch('/api/staff').then(function (r) {
      if (!r.ok) throw new Error('فهرست کارمندان در دسترس نیست');
      return r.json();
    }).then(function (rows) { staff = Array.isArray(rows) ? rows : []; });
  }

  function showLogin() {
    $('tabs').hidden = true;
    $('logout').hidden = true;
    $('who').textContent = '';
    var app = $('app');
    clear(app);
    var card = el('section', 'card');
    card.appendChild(el('h2', null, 'ورود به پنل'));
    card.appendChild(el('p', 'muted', 'نام خودت را انتخاب کن و رمزت را وارد کن.'));
    var list = el('div', 'staff-list');
    staff.forEach(function (p) {
      var b = el('button', 'staff-btn');
      b.type = 'button';
      b.appendChild(el('span', null, p.full_name || ''));
      b.appendChild(el('small', null, p.role_title || ''));
      b.onclick = function () { askPassword(card, p); };
      list.appendChild(b);
    });
    card.appendChild(list);
    app.appendChild(card);
  }

  function askPassword(card, person) {
    var old = card.querySelector('.pass-box');
    if (old) old.remove();
    var box = el('div', 'pass-box');
    box.style.marginTop = '14px';
    box.appendChild(el('p', null, person.full_name || ''));
    var input = el('input');
    input.type = 'password';
    input.placeholder = 'رمز عبور';
    input.autocomplete = 'current-password';
    input.style.width = '100%';
    var err = el('div', 'error');
    var go = el('button', null, 'ورود');
    go.type = 'button';
    function submit() {
      if (!input.value) { err.textContent = 'رمز را وارد کن'; return; }
      go.disabled = true;
      err.textContent = '';
      fetch('/api/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ profile_id: person.id, password: input.value })
      }).then(function (r) {
        if (r.status === 401) throw new Error('رمز اشتباه است');
        if (!r.ok) throw new Error('ورود انجام نشد');
        return r.json();
      }).then(function (d) {
        writeSession({
          access_token: d.access_token, refresh_token: d.refresh_token,
          expires_at: Date.now() + (d.expires_in || 3600) * 1000,
          user_id: d.user_id || person.id, is_admin: !!person.is_admin, name: person.full_name || ''
        });
        start();
      }).catch(function (e) {
        err.textContent = e.message || 'خطا';
        go.disabled = false;
      });
    }
    go.onclick = submit;
    input.onkeydown = function (e) { if (e.key === 'Enter') submit(); };
    box.appendChild(input);
    box.appendChild(err);
    box.appendChild(go);
    card.appendChild(box);
    input.focus();
  }

  // ---------- پوسته‌ی پنل ----------
  function showApp(session) {
    $('tabs').hidden = false;
    $('logout').hidden = false;
    $('who').textContent = session.name || '';
    var isAdmin = !!session.is_admin;
    document.querySelectorAll('.admin-only').forEach(function (b) { b.hidden = !isAdmin; });
    if (state.tab === 'assign' && !isAdmin) state.tab = 'attendance';
    renderTab();
  }

  function setTab(name) {
    state.tab = name;
    document.querySelectorAll('#tabs button').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-tab') === name);
    });
    renderTab();
  }

  function renderTab() {
    document.querySelectorAll('#tabs button').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-tab') === state.tab);
    });
    ensureSession().then(function (s) {
      if (!s) { start(); return; }
      if (state.tab === 'attendance') return renderAttendance(s);
      if (state.tab === 'mytasks') return renderMyTasks(s);
      if (state.tab === 'assign') return renderAssign(s);
      if (state.tab === 'export') return renderExport(s);
    }).catch(function (e) { showMessage(e.message || 'خطا'); });
  }

  function showMessage(text) {
    var app = $('app');
    clear(app);
    app.appendChild(el('p', 'error', text));
  }

  // ---------- حضور و غیاب ----------
  function renderAttendance(s) {
    var app = $('app');
    clear(app);
    var today = todayTehran();
    var r = dayRange(today);

    var card = el('section', 'card');
    card.appendChild(el('h2', null, 'حضور و غیاب امروز — ' + dateOf(today)));
    var status = el('p', 'muted', 'در حال بارگذاری…');
    card.appendChild(status);
    var row = el('div', 'row');
    var inBtn = el('button', null, 'ثبت ورود');
    var outBtn = el('button', 'light', 'ثبت خروج');
    inBtn.type = outBtn.type = 'button';
    row.appendChild(inBtn);
    row.appendChild(outBtn);
    card.appendChild(row);
    var msg = el('div', 'error');
    card.appendChild(msg);
    app.appendChild(card);

    var mine = el('section', 'card');
    mine.appendChild(el('h2', null, 'رکوردهای امروز من'));
    var mineList = el('div', 'row-list');
    mine.appendChild(mineList);
    app.appendChild(mine);

    var all = null;
    if (s.is_admin) {
      all = el('section', 'card');
      all.appendChild(el('h2', null, 'حضور امروز همه‌ی کارمندان'));
      var allList = el('div', 'row-list');
      all.appendChild(allList);
      app.appendChild(all);
    }

    function refresh() {
      return sb('rest/v1/attendance', 'user_id=eq.' + s.user_id +
        '&check_in=gte.' + encodeURIComponent(r.start) + '&check_in=lt.' + encodeURIComponent(r.end) +
        '&select=id,check_in,check_out&order=check_in.asc').then(function (rows) {
        clear(mineList);
        var open = null;
        (rows || []).forEach(function (x) {
          var line = el('div');
          line.appendChild(el('span', null, 'ورود ' + timeOf(x.check_in)));
          line.appendChild(el('span', null, x.check_out ? 'خروج ' + timeOf(x.check_out) : 'هنوز خارج نشده'));
          mineList.appendChild(line);
          if (!x.check_out) open = x;
        });
        if (!rows || !rows.length) mineList.appendChild(el('p', 'muted', 'امروز ثبتی نداری.'));
        status.textContent = open ? 'وضعیت: در دفتر (از ' + timeOf(open.check_in) + ')' : 'وضعیت: خارج از دفتر';
        inBtn.disabled = !!open;
        outBtn.disabled = !open;
        if (all) return refreshAll();
      });
    }

    function refreshAll() {
      return sb('rest/v1/attendance', 'check_in=gte.' + encodeURIComponent(r.start) +
        '&check_in=lt.' + encodeURIComponent(r.end) + '&select=user_id,check_in,check_out&order=check_in.asc')
        .then(function (rows) {
          var list = all.querySelector('.row-list');
          clear(list);
          if (!rows || !rows.length) list.appendChild(el('p', 'muted', 'امروز ثبتی نیست.'));
          (rows || []).forEach(function (x) {
            var line = el('div');
            line.appendChild(el('span', null, staffName(x.user_id)));
            line.appendChild(el('span', null, timeOf(x.check_in) + ' — ' + (x.check_out ? timeOf(x.check_out) : 'در دفتر')));
            list.appendChild(line);
          });
        });
    }

    inBtn.onclick = function () {
      msg.textContent = '';
      inBtn.disabled = true;
      sb('rest/v1/attendance', '', {
        method: 'POST', prefer: 'return=minimal',
        body: { user_id: s.user_id, check_in: new Date().toISOString() }
      }).then(refresh).catch(function (e) { msg.textContent = e.message; inBtn.disabled = false; });
    };
    outBtn.onclick = function () {
      msg.textContent = '';
      outBtn.disabled = true;
      sb('rest/v1/attendance', 'user_id=eq.' + s.user_id + '&check_out=is.null', {
        method: 'PATCH', prefer: 'return=minimal',
        body: { check_out: new Date().toISOString() }
      }).then(refresh).catch(function (e) { msg.textContent = e.message; outBtn.disabled = false; });
    };

    return refresh();
  }

  // ---------- کارهای من ----------
  function renderMyTasks(s) {
    var app = $('app');
    clear(app);

    var add = el('section', 'card');
    add.appendChild(el('h2', null, 'کار جدید برای خودم'));
    var form = addTaskForm(function (values) {
      return sb('rest/v1/personal_tasks', '', {
        method: 'POST', prefer: 'return=minimal',
        body: { user_id: s.user_id, title: values.title, due_date: values.due || null, priority: values.priority, status: 'new' }
      }).then(function () { renderMyTasks(s); });
    });
    add.appendChild(form.node);
    app.appendChild(add);

    var list = el('section', 'card');
    list.appendChild(el('h2', null, 'کارهای من'));
    var box = el('div');
    list.appendChild(box);
    app.appendChild(list);

    return sb('rest/v1/personal_tasks', 'user_id=eq.' + s.user_id + '&select=*&order=due_date.asc.nullslast')
      .then(function (rows) {
        renderTaskList(box, rows || [], s, function () { renderMyTasks(s); });
      });
  }

  // لیست کار؛ همان‌جا وضعیت و حذف را مدیریت می‌کند
  function renderTaskList(box, rows, s, reload) {
    clear(box);
    if (!rows.length) { box.appendChild(el('p', 'muted', 'کاری ثبت نشده.')); return; }
    rows.forEach(function (t) {
      var item = el('div', 'task');
      item.appendChild(el('div', 'title', t.title));
      var meta = el('div', 'meta');
      meta.appendChild(el('span', 'badge ' + (STATUS_CLASS[t.status] || 'b-new'), STATUS_LABEL[t.status] || t.status));
      meta.appendChild(el('span', 'badge ' + (PRIORITY_CLASS[t.priority] || 'p-mid'), t.priority || 'متوسط'));
      meta.appendChild(el('span', null, 'مهلت: ' + dateOf(t.due_date)));
      if (t.assigned_by && t.assigned_by !== s.user_id) meta.appendChild(el('span', null, ' · واگذار شده از طرف ' + staffName(t.assigned_by)));
      item.appendChild(meta);

      var row = el('div', 'row');
      var next = el('button', 'light', STATUS_BTN[t.status] || 'تغییر وضعیت');
      next.type = 'button';
      next.onclick = function () {
        sb('rest/v1/personal_tasks', 'id=eq.' + t.id, {
          method: 'PATCH', prefer: 'return=minimal', body: { status: STATUS_NEXT[t.status] || 'new' }
        }).then(reload).catch(function (e) { showMessage(e.message); });
      };
      row.appendChild(next);

      // حذف: کارمند فقط کارهای خودش را (که خودش ساخته) حذف می‌کند؛ کار واگذاری‌شده را ادمین حذف می‌کند
      var canDelete = !t.assigned_by || t.assigned_by === s.user_id || s.is_admin;
      if (canDelete) {
        var del = el('button', 'danger', 'حذف');
        del.type = 'button';
        del.onclick = function () {
          if (!confirm('این کار حذف شود؟')) return;
          sb('rest/v1/personal_tasks', 'id=eq.' + t.id, { method: 'DELETE', prefer: 'return=minimal' })
            .then(reload).catch(function (e) { showMessage(e.message); });
        };
        row.appendChild(del);
      }
      item.appendChild(row);
      box.appendChild(item);
    });
  }

  // فرم کار جدید (عنوان، مهلت، اولویت)
  function addTaskForm(onSubmit) {
    var node = el('div');
    var title = el('input'); title.placeholder = 'عنوان کار'; title.style.width = '100%';
    var due = el('input'); due.type = 'date';
    var prio = el('select');
    PRIORITIES.forEach(function (p) { var o = el('option', null, p); o.value = p; prio.appendChild(o); });
    prio.value = 'متوسط';
    var btn = el('button', null, 'ثبت کار'); btn.type = 'button';
    var err = el('div', 'error');
    var r1 = el('div', 'row'); r1.appendChild(title);
    var r2 = el('div', 'row'); r2.appendChild(due); r2.appendChild(prio); r2.appendChild(btn);
    node.appendChild(r1); node.appendChild(r2); node.appendChild(err);
    btn.onclick = function () {
      if (!title.value.trim()) { err.textContent = 'عنوان کار را وارد کن'; return; }
      btn.disabled = true;
      onSubmit({ title: title.value.trim(), due: due.value, priority: prio.value })
        .catch(function (e) { err.textContent = e.message; })
        .then(function () { btn.disabled = false; });
    };
    return { node: node };
  }

  // ---------- واگذاری کار (ادمین) ----------
  function renderAssign(s) {
    var app = $('app');
    clear(app);

    var card = el('section', 'card');
    card.appendChild(el('h2', null, 'واگذاری کار به کارمند'));
    var who = el('select');
    staff.forEach(function (p) { var o = el('option', null, p.full_name); o.value = p.id; who.appendChild(o); });
    var row = el('div', 'row'); row.appendChild(who);
    card.appendChild(row);
    var form = addTaskForm(function (values) {
      return sb('rest/v1/personal_tasks', '', {
        method: 'POST', prefer: 'return=minimal',
        body: { user_id: who.value, title: values.title, due_date: values.due || null,
                priority: values.priority, status: 'new', assigned_by: s.user_id }
      }).then(function () { renderAssign(s); });
    });
    card.appendChild(form.node);
    app.appendChild(card);

    var list = el('section', 'card');
    list.appendChild(el('h2', null, 'کارهایی که واگذار کرده‌ای'));
    var box = el('div');
    list.appendChild(box);
    app.appendChild(list);

    return sb('rest/v1/personal_tasks', 'assigned_by=eq.' + s.user_id + '&select=*&order=due_date.asc.nullslast')
      .then(function (rows) {
        clear(box);
        if (!rows || !rows.length) { box.appendChild(el('p', 'muted', 'هنوز کاری واگذار نکرده‌ای.')); return; }
        rows.forEach(function (t) {
          var item = el('div', 'task');
          item.appendChild(el('div', 'title', t.title));
          var meta = el('div', 'meta');
          meta.appendChild(el('span', 'badge ' + (STATUS_CLASS[t.status] || 'b-new'), STATUS_LABEL[t.status] || t.status));
          meta.appendChild(el('span', null, 'برای: ' + staffName(t.user_id) + ' · مهلت: ' + dateOf(t.due_date)));
          item.appendChild(meta);
          var del = el('button', 'danger', 'حذف');
          del.type = 'button';
          del.onclick = function () {
            if (!confirm('این کار حذف شود؟')) return;
            sb('rest/v1/personal_tasks', 'id=eq.' + t.id, { method: 'DELETE', prefer: 'return=minimal' })
              .then(function () { renderAssign(s); }).catch(function (e) { showMessage(e.message); });
          };
          item.appendChild(del);
          box.appendChild(item);
        });
      });
  }

  // ---------- خروجی Excel ----------
  function renderExport(s) {
    var app = $('app');
    clear(app);
    var card = el('section', 'card');
    card.appendChild(el('h2', null, 'خروجی حضور و غیاب ماه جاری'));
    card.appendChild(el('p', 'muted', s.is_admin
      ? 'ادمین: فایل همه‌ی کارمندان دریافت می‌شود.'
      : 'فایل ماه خودت دریافت می‌شود.'));
    var msg = el('div', 'error');
    var btn = el('button', null, 'دریافت فایل');
    btn.type = 'button';
    btn.onclick = function () {
      btn.disabled = true;
      msg.textContent = '';
      var parts = new Intl.DateTimeFormat('en-u-ca-persian', { timeZone: 'Asia/Tehran', year: 'numeric', month: 'numeric' }).formatToParts(new Date());
      var jy = '', jm = '';
      parts.forEach(function (p) { if (p.type === 'year') jy = p.value; if (p.type === 'month') jm = p.value; });
      fetch('/api/export-timesheet?jy=' + jy + '&jm=' + jm, { headers: { authorization: 'Bearer ' + s.access_token } })
        .then(function (r) { if (!r.ok) throw new Error('دریافت فایل انجام نشد'); return r.blob(); })
        .then(function (blob) {
          var a = el('a');
          a.href = URL.createObjectURL(blob);
          a.download = 'timesheet-' + jy + '-' + jm + '.xlsx';
          document.body.appendChild(a);
          a.click();
          setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
        })
        .catch(function (e) { msg.textContent = e.message; })
        .then(function () { btn.disabled = false; });
    };
    card.appendChild(btn);
    card.appendChild(msg);
    app.appendChild(card);
  }

  // ---------- شروع ----------
  function start() {
    loadStaff().then(function () {
      return ensureSession();
    }).then(function (s) {
      if (!s) { showLogin(); return; }
      showApp(s);
    }).catch(function (e) { showMessage(e.message || 'خطا در بارگذاری'); });
  }

  document.querySelectorAll('#tabs button').forEach(function (b) {
    b.addEventListener('click', function () { setTab(b.getAttribute('data-tab')); });
  });
  $('logout').addEventListener('click', function () {
    clearSession();
    location.reload();
  });

  start();
})();
