/* DAST MATERIAL LAB — complete workspace */
(function(){
  'use strict';

  if (typeof SECTION_TITLES !== 'undefined') SECTION_TITLES['material-lab'] = 'Material Lab';

  var ML = {
    view: 'overview',
    query: '',
    category: '',
    subcategory: '',
    supplier: '',
    application: '',
    texture: '',
    stock: '',
    boardId: '',
    compareIds: [],
    materials: [],
    suppliers: [],
    catalogs: [],
    categories: [],
    boards: [],
    items: [],
    favorites: [],
    requests: [],
    prices: [],
    files: [],
    profiles: []
  };

  var timer = null;
  var originalSwitch = null;

  function A(){ return window.showToast || function(m){ alert(m); }; }
  function toast(m){ A()(m); }
  function isAdmin(){
    try { if (typeof currentProfile !== 'undefined' && currentProfile) return !!currentProfile.is_admin; } catch (_) {}
    return !!(window.currentProfile && window.currentProfile.is_admin);
  }
  function userId(){
    try { if (typeof currentUser !== 'undefined' && currentUser && currentUser.id) return currentUser.id; } catch (_) {}
    return window.currentUser && window.currentUser.id ? window.currentUser.id : '';
  }
  function projectList(){ return Array.isArray(window.projects) ? window.projects : []; }

  function esc(v){
    if (typeof window.escapeHtml === 'function') return window.escapeHtml(v == null ? '' : String(v));
    return String(v == null ? '' : v).replace(/[&<>"']/g, function(ch){
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch];
    });
  }

  function money(v){
    return Number(v || 0) > 0 ? Number(v).toLocaleString('fa-IR') : 'ثبت نشده';
  }

  function num(v){
    return Number(v || 0).toLocaleString('fa-IR');
  }

  function dateLabel(v){
    if (!v) return 'ثبت نشده';
    var s = String(v).slice(0,10);
    return s.replace(/-/g,'/');
  }

  function safeUrl(v){
    try {
      var u = new URL(String(v || ''), location.origin);
      return ['http:','https:'].indexOf(u.protocol) >= 0 ? u.href : '';
    } catch(e){ return ''; }
  }

  function phone(v){ return String(v || '').replace(/[^\d+]/g,'').replace(/^00/,'+'); }
  function wa(v){
    var d = phone(v).replace(/\D/g,'');
    return d ? 'https://wa.me/' + d : '';
  }

  function cat(id){ return ML.categories.find(function(x){ return x.id === id; }); }
  function catName(id){ var x = cat(id); return x ? x.name_fa : 'بدون دسته'; }
  function supplier(id){ return ML.suppliers.find(function(x){ return x.id === id; }); }
  function supplierName(id){ var x = supplier(id); return x ? x.name : 'شرکت ثبت نشده'; }
  function project(id){ return projectList().find(function(x){ return x.id === id; }); }
  function projectName(id){ var x = project(id); return x ? (x.title || x.name || 'پروژه') : 'بدون پروژه'; }
  function profileName(id){
    var p = ML.profiles.find(function(x){ return x.id === id; });
    return p ? (p.full_name || p.email || 'کاربر') : 'کاربر';
  }
  function priceLabel(m){
    return Number(m && m.price || 0) > 0
      ? money(m.price) + ' ' + (m.price_unit || 'مترمربع') + (m.currency && m.currency !== 'تومان' ? ' ' + esc(m.currency) : '')
      : 'قیمت ثبت نشده';
  }
  function appLabel(v){ return v || 'هر دو'; }
  function stockClass(v){
    var s = String(v || '');
    return s.indexOf('موجود') >= 0 ? 'ok' : (s.indexOf('ناموجود') >= 0 ? 'bad' : 'neutral');
  }
  function selected(id){ return ML.compareIds.indexOf(id) >= 0; }

  async function load(){
    var queries = [
      sb.from('materials').select('*').order('created_at',{ascending:false}),
      sb.from('material_suppliers').select('*').order('name'),
      sb.from('material_catalogs').select('*').order('created_at',{ascending:false}),
      sb.from('material_categories').select('*').order('sort_order').order('name_fa'),
      sb.from('material_boards').select('*').order('updated_at',{ascending:false}),
      sb.from('material_board_items').select('*').order('position').order('created_at'),
      sb.from('material_favorites').select('material_id').eq('user_id',userId()),
      sb.from('material_quote_requests').select('*').order('created_at',{ascending:false}),
      sb.from('material_price_history').select('*').order('recorded_at',{ascending:false}).limit(500),
      sb.from('material_files').select('*').order('created_at',{ascending:false}),
      sb.from('profiles').select('id,full_name,role_title').order('full_name')
    ];

    var r = await Promise.all(queries);

    ML.materials = r[0].data || [];
    ML.suppliers = r[1].data || [];
    ML.catalogs = r[2].data || [];
    ML.categories = r[3].data || [];
    ML.boards = r[4].data || [];
    ML.items = r[5].data || [];
    ML.favorites = (r[6].data || []).map(function(x){ return x.material_id; });
    ML.requests = r[7].data || [];
    ML.prices = r[8].data || [];
    ML.files = r[9].data || [];
    ML.profiles = r[10].data || [];

    r.forEach(function(x,i){
      if (x.error) console.warn('Material Lab query', i, x.error.message);
    });

    if (!ML.boardId && ML.boards.length) ML.boardId = ML.boards[0].id;
    ML.compareIds = ML.compareIds.filter(function(id){
      return ML.materials.some(function(m){ return m.id === id; });
    });
  }

  function counts(){
    var priced = ML.materials.filter(function(m){ return Number(m.price || 0) > 0; }).length;
    var recentPrices = ML.prices.filter(function(p){
      var d = new Date(p.recorded_at || p.created_at);
      if (isNaN(d.getTime())) return false;
      return (Date.now() - d.getTime()) <= 30 * 86400000;
    }).length;
    var openQuotes = ML.requests.filter(function(r){ return String(r.status || 'جدید') !== 'بسته' && String(r.status || 'جدید') !== 'لغو شد'; }).length;
    return {
      materials: ML.materials.length,
      suppliers: ML.suppliers.length,
      catalogs: ML.catalogs.length,
      priced: priced,
      boards: ML.boards.length,
      favorites: ML.favorites.length,
      files: ML.files.length,
      recentPrices: recentPrices,
      openQuotes: openQuotes
    };
  }

  function statCard(label,value,sub,action){
    return '<button class="ml-stat-card" ' + (action ? 'onclick="MaterialLab.setView(\''+action+'\')"' : '') + '>' +
      '<span class="ml-stat-value">'+esc(value)+'</span><span class="ml-stat-label">'+esc(label)+'</span>' +
      (sub ? '<span class="ml-stat-sub">'+esc(sub)+'</span>' : '') +
      '</button>';
  }

  function navTabs(){
    var tabs = [
      ['overview','⌂','نمای کلی'],
      ['materials','🧱','بانک متریال'],
      ['suppliers','🏢','شرکت‌ها'],
      ['catalogs','📚','کاتالوگ‌ها'],
      ['files','📎','فایل‌ها'],
      ['favorites','★','علاقه‌مندی'],
      ['compare','⇄','مقایسه'],
      ['boards','🎨','برد پروژه'],
      ['prices','💰','قیمت‌ها'],
      ['requests','☎','درخواست قیمت'],
      ['categories','🗂','دسته‌بندی']
    ];
    return '<div class="ml-tabs">'+tabs.map(function(t){
      return '<button class="ml-tab '+(ML.view===t[0]?'active':'')+'" onclick="MaterialLab.setView(\''+t[0]+'\')"><span>'+t[1]+'</span>'+t[2]+'</button>';
    }).join('')+'</div>';
  }

  function render(){
    var c = counts();
    var h = '<section class="material-lab-shell">';
    h += '<div class="ml-header">' +
      '<div><div class="ml-kicker">DAST / MATERIAL LAB</div><h2>آزمایشگاه متریال</h2><p>بانک مرکزی متریال دفتر؛ برای پیدا کردن، مقایسه، انتخاب، قیمت‌گذاری و مستندسازی پروژه.</p></div>' +
      '<div class="ml-header-actions">' +
      (isAdmin() ? '<button class="btn" onclick="MaterialLab.openMaterial()">＋ متریال جدید</button><button class="btn secondary" onclick="MaterialLab.openSupplier()">＋ شرکت</button><button class="btn secondary" onclick="MaterialLab.openCatalog()">＋ کاتالوگ</button>' : '') +
      '<button class="btn secondary" onclick="MaterialLab.openBoard()">＋ برد پروژه</button>' +
      '</div></div>';

    h += '<div class="ml-stats">' +
      statCard('متریال ثبت‌شده',num(c.materials),'بانک اصلی','materials') +
      statCard('شرکت / تأمین‌کننده',num(c.suppliers),'دفترچه تماس','suppliers') +
      statCard('کاتالوگ و کتاب',num(c.catalogs),'فیزیکی + دیجیتال','catalogs') +
      statCard('دارای قیمت',num(c.priced),'برای برآورد','prices') +
      statCard('برد پروژه',num(c.boards),'انتخاب‌های پروژه','boards') +
      statCard('علاقه‌مندی',num(c.favorites),'انتخاب‌های شخصی','favorites') +
      statCard('فایل متریال',num(c.files),'تصویر / PDF / CAD','files') +
      statCard('درخواست باز',num(c.openQuotes),'پیگیری تأمین','requests') +
    '</div>';

    h += navTabs();
    if (ML.view === 'overview') h += overview();
    else if (ML.view === 'materials') h += materials();
    else if (ML.view === 'suppliers') h += suppliers();
    else if (ML.view === 'catalogs') h += catalogs();
    else if (ML.view === 'files') h += files();
    else if (ML.view === 'favorites') h += favorites();
    else if (ML.view === 'compare') h += compare();
    else if (ML.view === 'boards') h += boards();
    else if (ML.view === 'prices') h += prices();
    else if (ML.view === 'requests') h += requests();
    else h += categories();

    h += '</section>';
    return h;
  }

  function overview(){
    var c = counts();
    var recent = ML.materials.slice(0,6);
    var priceRecent = ML.prices.slice(0,6);
    var pendingCats = ML.catalogs.filter(function(x){ return !x.extraction_status || x.extraction_status === 'ثبت نشده'; }).length;
    var favoriteM = ML.materials.filter(function(m){ return selectedFavorite(m.id); }).slice(0,4);

    return '<div class="ml-overview-grid">' +
      '<div class="card ml-overview-main"><div class="ml-section-title"><div><span class="ml-kicker">WORKSPACE</span><h3>امروز از کجا شروع کنیم؟</h3></div><button class="btn small secondary" onclick="MaterialLab.openMaterial()">＋ ثبت متریال</button></div>' +
      '<div class="ml-quick-grid">' +
        quick('🧱','جست‌وجوی متریال','نام، برند، کد، فینیش و رنگ','materials') +
        quick('📚','کتابخانه کاتالوگ','کتاب فیزیکی و فایل دیجیتال','catalogs') +
        quick('🏢','پیدا کردن شرکت','تلفن، واتساپ و سایت','suppliers') +
        quick('🎨','ساخت برد پروژه','انتخاب + مقدار + برآورد','boards') +
        quick('⇄','مقایسه','تا ۴ متریال کنار هم','compare') +
        quick('☎','درخواست قیمت','ثبت و پیگیری استعلام','requests') +
      '</div></div>' +
      '<div class="card"><div class="ml-section-title"><div><span class="ml-kicker">LIBRARY</span><h3>وضعیت کتابخانه</h3></div></div>' +
        '<div class="ml-mini-stats"><div><strong>'+num(c.catalogs)+'</strong><span>کاتالوگ</span></div><div><strong>'+num(pendingCats)+'</strong><span>نیازمند استخراج</span></div><div><strong>'+num(c.files)+'</strong><span>فایل</span></div><div><strong>'+num(c.recentPrices)+'</strong><span>قیمت ۳۰ روز اخیر</span></div></div>' +
        '<div class="ml-note">فایل هر کاتالوگ و متریال می‌تواند روی فضای ذخیره‌سازی بیرونی قرار بگیرد و فقط لینک امن آن در دفتر ثبت شود.</div>' +
      '</div>' +
    '</div>' +
    '<div class="ml-two-cols">' +
      '<div class="card"><div class="ml-section-title"><h3>آخرین متریال‌ها</h3><button class="btn small secondary" onclick="MaterialLab.setView(\'materials\')">همه</button></div>' +
      (recent.length ? '<div class="ml-list">'+recent.map(miniMaterial).join('')+'</div>' : empty('هنوز متریالی ثبت نشده.')) + '</div>' +
      '<div class="card"><div class="ml-section-title"><h3>آخرین قیمت‌ها</h3><button class="btn small secondary" onclick="MaterialLab.setView(\'prices\')">تاریخچه</button></div>' +
      (priceRecent.length ? '<div class="ml-list">'+priceRecent.map(function(p){ var m=findMaterial(p.material_id); return '<div class="ml-list-row"><div><strong>'+esc(m?m.name_fa:'—')+'</strong><span>'+esc(dateLabel(p.recorded_at))+' · '+esc(supplierName(p.supplier_id || (m&&m.supplier_id)))+'</span></div><strong>'+money(p.price)+' '+esc(p.price_unit || (m&&m.price_unit) || '')+'</strong></div>'; }).join('') : empty('هنوز سابقه قیمتی ثبت نشده.')) + '</div>' +
    '</div>' +
    (favoriteM.length ? '<div class="card"><div class="ml-section-title"><h3>علاقه‌مندی‌ها</h3><button class="btn small secondary" onclick="MaterialLab.setView(\'favorites\')">مشاهده</button></div><div class="ml-material-strip">'+favoriteM.map(card).join('')+'</div></div>' : '');
  }

  function quick(icon,title,desc,view){
    return '<button class="ml-quick" onclick="MaterialLab.setView(\''+view+'\')"><span class="ml-quick-icon">'+icon+'</span><span><strong>'+title+'</strong><small>'+desc+'</small></span><b>←</b></button>';
  }

  function empty(msg){ return '<div class="empty">'+esc(msg)+'</div>'; }
  function findMaterial(id){ return ML.materials.find(function(x){ return x.id === id; }); }
  function selectedFavorite(id){ return ML.favorites.indexOf(id) >= 0; }

  function filters(){
    var subs = [];
    ML.materials.forEach(function(m){ if (m.subcategory && subs.indexOf(m.subcategory) < 0) subs.push(m.subcategory); });
    subs.sort();

    return '<div class="card ml-filter-panel">' +
      '<div class="ml-filter-top"><div><strong>جست‌وجو و فیلتر</strong><small>هرچه اطلاعات بیشتری از کاتالوگ وارد کنیم، این قسمت کاربردی‌تر می‌شود.</small></div><button class="btn small secondary" onclick="MaterialLab.clearFilters()">پاک کردن فیلترها</button></div>' +
      '<div class="ml-filter-grid">' +
        '<input value="'+esc(ML.query)+'" oninput="MaterialLab.search(this.value)" placeholder="نام، برند، سازنده، کد، رنگ، فینیش...">' +
        selectEl('ml-cat-filter','دسته',ML.categories.map(function(c){return [c.id,c.name_fa];}),ML.category,'MaterialLab.filter(\'category\',this.value)') +
        selectEl('ml-sub-filter','زیر‌دسته',subs.map(function(x){return [x,x];}),ML.subcategory,'MaterialLab.filter(\'subcategory\',this.value)') +
        selectEl('ml-sup-filter','شرکت',ML.suppliers.map(function(s){return [s.id,s.name];}),ML.supplier,'MaterialLab.filter(\'supplier\',this.value)') +
        selectEl('ml-app-filter','کاربرد',[['نما','نما'],['داخلی','داخلی'],['هر دو','هر دو']],ML.application,'MaterialLab.filter(\'application\',this.value)') +
        selectEl('ml-texture-filter','بافت',[['طبیعی','طبیعی'],['مات','مات'],['براق','براق'],['نیمه‌براق','نیمه‌براق'],['سه‌بعدی','سه‌بعدی']],ML.texture,'MaterialLab.filter(\'texture\',this.value)') +
        selectEl('ml-stock-filter','موجودی',[['موجود','موجود'],['ناموجود','ناموجود'],['سفارشی','سفارشی']],ML.stock,'MaterialLab.filter(\'stock\',this.value)') +
      '</div></div>';
  }

  function selectEl(id,label,options,val,onchange){
    return '<label class="ml-field-inline"><span>'+label+'</span><select id="'+id+'" onchange="'+onchange+'"><option value="">همه</option>'+
      options.map(function(o){ return '<option value="'+esc(o[0])+'" '+(String(val)===String(o[0])?'selected':'')+'>'+esc(o[1])+'</option>'; }).join('')+
    '</select></label>';
  }

  function materials(){
    var q = ML.query.trim().toLowerCase();
    var list = ML.materials.filter(function(m){
      var hay = [m.name_fa,m.name_en,m.brand,m.manufacturer,m.code,m.color,m.finish,m.texture_type,m.subcategory,(m.suitable_for||[]).join(' ')].join(' ').toLowerCase();
      var okQ = !q || hay.indexOf(q) >= 0;
      var okCat = !ML.category || m.category_id === ML.category;
      var okSub = !ML.subcategory || m.subcategory === ML.subcategory;
      var okSup = !ML.supplier || m.supplier_id === ML.supplier;
      var okApp = !ML.application || m.application_type === ML.application;
      var okTex = !ML.texture || m.texture_type === ML.texture;
      var okStock = !ML.stock || String(m.stock_status || '').indexOf(ML.stock) >= 0;
      return okQ && okCat && okSub && okSup && okApp && okTex && okStock;
    });

    return '<div class="ml-view-head"><div><span class="ml-kicker">MATERIAL LIBRARY</span><h3>بانک متریال <small>'+num(list.length)+' نتیجه</small></h3></div>' +
      '<div class="ml-head-actions"><button class="btn small secondary" onclick="MaterialLab.setView(\'compare\')">مقایسه ('+num(ML.compareIds.length)+')</button>' + (isAdmin() ? '<button class="btn small" onclick="MaterialLab.openMaterial()">＋ متریال</button>' : '') + '</div></div>' +
      filters() +
      '<div class="ml-material-grid">'+(list.length ? list.map(card).join('') : '<div class="card" style="grid-column:1/-1;">'+empty('برای این فیلتر متریالی پیدا نشد.')+'</div>')+'</div>';
  }

  function card(m){
    var s = supplier(m.supplier_id);
    var img = safeUrl(m.image_url);
    var fav = selectedFavorite(m.id);
    var cmp = selected(m.id);
    var suitable = Array.isArray(m.suitable_for) ? m.suitable_for.slice(0,3).join('، ') : '';
    return '<article class="ml-material-card">' +
      '<div class="ml-material-cover '+(img?'has-image':'')+'">'+(img?'<img loading="lazy" src="'+esc(img)+'" alt="'+esc(m.name_fa)+'">':'<span>'+esc((cat(m.category_id)||{}).icon || '🧱')+'</span>')+
        '<button class="ml-fav '+(fav?'active':'')+'" onclick="MaterialLab.favorite(\''+m.id+'\')" title="علاقه‌مندی">'+(fav?'★':'☆')+'</button>'+
        '<button class="ml-compare-check '+(cmp?'active':'')+'" onclick="MaterialLab.toggleCompare(\''+m.id+'\')" title="مقایسه">'+(cmp?'✓':'⇄')+'</button>'+
      '</div>' +
      '<div class="ml-material-body">' +
        '<div class="ml-chip-line"><span class="ml-chip">'+esc(catName(m.category_id))+'</span><span class="ml-stock '+stockClass(m.stock_status)+'">'+esc(m.stock_status || 'نامشخص')+'</span></div>' +
        '<h3>'+esc(m.name_fa || 'بدون نام')+'</h3>' +
        (m.name_en ? '<div class="ml-en">'+esc(m.name_en)+'</div>' : '') +
        '<div class="ml-card-meta">'+esc([m.brand,m.manufacturer,m.code].filter(Boolean).join(' · ') || 'جزئیات سازنده ثبت نشده')+'</div>' +
        '<div class="ml-spec-line">'+esc([m.color,m.finish,m.texture_type,m.dimensions].filter(Boolean).join(' · '))+'</div>' +
        (suitable ? '<div class="ml-suitable">مناسب برای: '+esc(suitable)+'</div>' : '') +
        '<div class="ml-price-row"><strong>'+priceLabel(m)+'</strong><span>'+esc(dateLabel(m.price_updated_at))+'</span></div>' +
        '<div class="ml-supplier-row">🏢 '+esc(s ? s.name : 'شرکت ثبت نشده')+'</div>' +
        '<div class="ml-card-actions"><button class="btn small" onclick="MaterialLab.details(\''+m.id+'\')">جزئیات</button>' +
          ((s&&(s.phone||s.mobile))?'<a class="btn small secondary" href="tel:'+esc(phone(s.phone||s.mobile))+'">تماس</a>':'')+
          (isAdmin()?'<button class="btn small secondary" onclick="MaterialLab.openMaterial(\''+m.id+'\')">ویرایش</button>':'')+
        '</div>' +
      '</div></article>';
  }

  function miniMaterial(m){
    return '<button class="ml-list-row" onclick="MaterialLab.details(\''+m.id+'\')"><div><strong>'+esc(m.name_fa)+'</strong><span>'+esc([catName(m.category_id),m.brand,m.finish].filter(Boolean).join(' · '))+'</span></div><strong>'+priceLabel(m)+'</strong></button>';
  }

  function suppliers(){
    return '<div class="ml-view-head"><div><span class="ml-kicker">SUPPLIERS</span><h3>شرکت‌ها و تأمین‌کننده‌ها</h3><p>شرکت را یک بار ثبت کن؛ بعد در تمام متریال‌ها، قیمت‌ها و استعلام‌ها دوباره از همان پرونده استفاده می‌کنیم.</p></div>' +
      (isAdmin()?'<button class="btn" onclick="MaterialLab.openSupplier()">＋ شرکت جدید</button>':'')+'</div>' +
      '<div class="ml-supplier-grid">'+(ML.suppliers.length?ML.suppliers.map(supplierCard).join(''):'<div class="card">'+empty('هنوز شرکتی ثبت نشده.')+'</div>')+'</div>';
  }

  function supplierCard(s){
    var materialsCount = ML.materials.filter(function(m){ return m.supplier_id === s.id; }).length;
    return '<article class="card ml-supplier-card"><div class="ml-supplier-head"><div><span class="ml-kicker">SUPPLIER</span><h3>'+esc(s.name)+'</h3>'+(s.brand_name?'<div class="ml-en">'+esc(s.brand_name)+'</div>':'')+'</div><span class="ml-supplier-icon">🏢</span></div>'+
      '<div class="ml-supplier-info">'+
        (s.contact_person?'<div>👤 <span>'+esc(s.contact_person)+'</span></div>':'')+
        (s.city?'<div>📍 <span>'+esc(s.city)+'</span></div>':'')+
        (s.phone||s.mobile?'<div>📞 <span>'+esc(s.phone||s.mobile)+'</span></div>':'')+
        (s.email?'<div>✉️ <span>'+esc(s.email)+'</span></div>':'')+
      '</div>'+
      '<div class="ml-supplier-count">'+num(materialsCount)+' متریال مرتبط</div>'+
      '<div class="ml-card-actions">'+
        ((s.phone||s.mobile)?'<a class="btn small" href="tel:'+esc(phone(s.phone||s.mobile))+'">تماس</a>':'')+
        (s.whatsapp?'<a class="btn small secondary" target="_blank" rel="noopener" href="'+esc(wa(s.whatsapp))+'">واتساپ</a>':'')+
        (safeUrl(s.website)?'<a class="btn small secondary" target="_blank" rel="noopener" href="'+esc(safeUrl(s.website))+'">وب‌سایت</a>':'')+
        (s.instagram&&safeUrl(s.instagram)?'<a class="btn small secondary" target="_blank" rel="noopener" href="'+esc(safeUrl(s.instagram))+'">اینستاگرام</a>':'')+
        '<button class="btn small secondary" onclick="MaterialLab.filterSupplier(\''+s.id+'\')">متریال‌ها</button>'+
        (isAdmin()?'<button class="btn small secondary" onclick="MaterialLab.openSupplier(\''+s.id+'\')">ویرایش</button><button class="btn small danger" onclick="MaterialLab.deleteSupplier(\''+s.id+'\')">حذف</button>':'')+
      '</div>'+
      (s.address?'<div class="ml-address">📍 '+esc(s.address)+'</div>':'')+
    '</article>';
  }

  function catalogs(){
    var list = ML.catalogs.slice();
    return '<div class="ml-view-head"><div><span class="ml-kicker">CATALOG LIBRARY</span><h3>کتابخانه کاتالوگ و کتاب</h3><p>نسخه فیزیکی را هم مثل یک دارایی دفتر ثبت می‌کنیم؛ محل قفسه، فایل، شرکت، سال و وضعیت استخراج مشخص است.</p></div>' +
      '<div class="ml-head-actions">'+(isAdmin()?'<button class="btn" onclick="MaterialLab.openCatalog()">＋ کاتالوگ / کتاب</button>':'')+'</div></div>' +
      '<div class="ml-catalog-grid">'+(list.length?list.map(catalogCard).join(''):'<div class="card">'+empty('هنوز کاتالوگی ثبت نشده.')+'</div>')+'</div>';
  }

  function catalogCard(c){
    var cover = safeUrl(c.cover_url);
    var filesCount = ML.files.filter(function(f){ return f.catalog_id === c.id; }).length;
    var status = c.extraction_status || 'ثبت نشده';
    return '<article class="card ml-catalog-card"><div class="ml-catalog-cover '+(cover?'has-image':'')+'">'+(cover?'<img src="'+esc(cover)+'" alt="">':'📚')+'</div><div class="ml-catalog-copy">'+
      '<div class="ml-chip-line"><span class="ml-chip">'+esc(c.catalog_kind || 'کاتالوگ')+'</span><span class="ml-extract-status">'+esc(status)+'</span></div>'+
      '<h3>'+esc(c.title)+'</h3><div class="ml-line">🏢 '+esc(supplierName(c.supplier_id))+'</div>'+
      '<div class="ml-line">'+esc([c.publisher,c.year && ('سال '+c.year),c.category].filter(Boolean).join(' · ') || 'اطلاعات تکمیلی ثبت نشده')+'</div>'+
      (c.physical_location?'<div class="ml-line">📦 نسخه فیزیکی: '+esc(c.physical_location)+'</div>':'')+
      '<div class="ml-catalog-foot"><span>📎 '+num(filesCount)+' فایل</span><div>'+
        (safeUrl(c.file_url)?'<a class="btn small" target="_blank" rel="noopener" href="'+esc(safeUrl(c.file_url))+'">باز کردن</a>':'')+
        '<button class="btn small secondary" onclick="MaterialLab.catalogDetails(\''+c.id+'\')">جزئیات</button>'+
        (isAdmin()?'<button class="btn small secondary" onclick="MaterialLab.openCatalog(\''+c.id+'\')">ویرایش</button>':'')+
      '</div></div>'+
    '</div></article>';
  }

  function files(){
    var rows = ML.files.filter(function(f){
      var m = f.material_id ? findMaterial(f.material_id) : null;
      var c = f.catalog_id ? ML.catalogs.find(function(x){ return x.id === f.catalog_id; }) : null;
      var hay = [f.name,f.file_type,f.mime_type,m&&m.name_fa,c&&c.title].join(' ').toLowerCase();
      return !ML.query || hay.indexOf(ML.query.trim().toLowerCase()) >= 0;
    });
    return '<div class="ml-view-head"><div><span class="ml-kicker">FILES</span><h3>فایل‌های متریال</h3><p>تصویر نمونه، دیتاشیت، PDF، کاتالوگ، CAD و هر مرجع دیجیتال را به متریال یا کاتالوگ وصل کن.</p></div>'+
      (isAdmin()?'<button class="btn" onclick="MaterialLab.openFile()">＋ فایل / مرجع</button>':'')+'</div>'+
      '<div class="card ml-file-tools"><input value="'+esc(ML.query)+'" oninput="MaterialLab.search(this.value)" placeholder="جست‌وجوی فایل، متریال یا کاتالوگ..."></div>'+
      '<div class="ml-file-grid">'+(rows.length?rows.map(fileCard).join(''):'<div class="card" style="grid-column:1/-1;">'+empty('هنوز فایلی ثبت نشده.')+'</div>')+'</div>';
  }

  function fileCard(f){
    var m = f.material_id ? findMaterial(f.material_id) : null;
    var c = f.catalog_id ? ML.catalogs.find(function(x){ return x.id === f.catalog_id; }) : null;
    var u = safeUrl(f.url);
    var type = String(f.file_type || 'file').toUpperCase();
    return '<article class="card ml-file-card"><div class="ml-file-icon">📎</div><div><span class="ml-kicker">'+esc(type)+'</span><h3>'+esc(f.name || 'فایل بدون نام')+'</h3>'+
      '<div class="ml-line">'+esc(m ? '🧱 '+m.name_fa : c ? '📚 '+c.title : 'بدون اتصال')+'</div>'+
      (f.file_size?'<div class="ml-line">حجم: '+num(Math.round(Number(f.file_size)/1024))+' KB</div>':'')+
      (f.mime_type?'<div class="ml-line">'+esc(f.mime_type)+'</div>':'')+
      '<div class="ml-card-actions">'+(u?'<a class="btn small" target="_blank" rel="noopener" href="'+esc(u)+'">باز کردن فایل</a>':'')+
      (isAdmin()?'<button class="btn small secondary" onclick="MaterialLab.openFile(\''+f.id+'\')">ویرایش</button><button class="btn small danger" onclick="MaterialLab.deleteFile(\''+f.id+'\')">حذف</button>':'')+'</div></div></article>';
  }

  function favorites(){
    var list = ML.materials.filter(function(m){ return selectedFavorite(m.id); });
    return '<div class="ml-view-head"><div><span class="ml-kicker">FAVORITES</span><h3>علاقه‌مندی‌های من</h3><p>متریال‌هایی که احتمالاً دوباره برای پروژه‌ها به آن‌ها برمی‌گردی.</p></div></div>'+
      '<div class="ml-material-grid">'+(list.length?list.map(card).join(''):'<div class="card" style="grid-column:1/-1;">'+empty('هنوز متریالی به علاقه‌مندی‌ها اضافه نشده.')+'</div>')+'</div>';
  }

  function compare(){
    var list = ML.materials.filter(function(m){ return selected(m.id); });
    return '<div class="ml-view-head"><div><span class="ml-kicker">COMPARISON</span><h3>مقایسه متریال‌ها</h3><p>حداکثر ۴ متریال را انتخاب کن تا مشخصات، قیمت، شرکت و کاربردشان کنار هم دیده شود.</p></div>'+
      '<div class="ml-head-actions">'+(list.length?'<button class="btn small secondary" onclick="MaterialLab.clearCompare()">پاک کردن مقایسه</button>':'<button class="btn small" onclick="MaterialLab.setView(\'materials\')">انتخاب متریال</button>')+'</div></div>'+
      (list.length ? compareTable(list) : '<div class="card ml-compare-empty">'+empty('از کارت متریال‌ها روی دکمه ⇄ بزن تا وارد این صفحه شود.')+'</div>');
  }

  function compareTable(list){
    var rows = [
      ['دسته',function(m){return catName(m.category_id);} ],
      ['زیر‌دسته',function(m){return m.subcategory || '—';}],
      ['برند',function(m){return m.brand || '—';}],
      ['سازنده',function(m){return m.manufacturer || '—';}],
      ['کد',function(m){return m.code || '—';}],
      ['رنگ',function(m){return m.color || '—';}],
      ['فینیش',function(m){return m.finish || '—';}],
      ['بافت',function(m){return m.texture_type || '—';}],
      ['کاربرد',function(m){return m.application_type || '—';}],
      ['مناسب برای',function(m){return Array.isArray(m.suitable_for) ? m.suitable_for.join('، ') || '—' : '—';}],
      ['ابعاد',function(m){return m.dimensions || '—';}],
      ['ضخامت',function(m){return m.thickness || '—';}],
      ['وزن / واحد',function(m){return m.weight_per_unit != null ? m.weight_per_unit+' / '+(m.unit||'—') : '—';}],
      ['جذب آب',function(m){return m.water_absorption != null ? m.water_absorption+'٪' : '—';}],
      ['موجودی',function(m){return m.stock_status || '—';}],
      ['قیمت',function(m){return priceLabel(m);} ],
      ['آخرین به‌روزرسانی قیمت',function(m){return dateLabel(m.price_updated_at);} ],
      ['شرکت',function(m){return supplierName(m.supplier_id);} ]
    ];
    return '<div class="card table-wrap ml-compare-wrap"><table class="ml-compare-table"><thead><tr><th>مشخصه</th>'+list.map(function(m){return '<th><div class="ml-compare-name">'+esc(m.name_fa)+'</div><button class="btn small danger" onclick="MaterialLab.toggleCompare(\''+m.id+'\')">حذف</button></th>';}).join('')+'</tr></thead><tbody>'+
      rows.map(function(r){return '<tr><th>'+esc(r[0])+'</th>'+list.map(function(m){return '<td>'+esc(r[1](m))+'</td>';}).join('')+'</tr>';}).join('')+
    '</tbody></table></div>';
  }

  function boards(){
    if (!ML.boardId && ML.boards.length) ML.boardId = ML.boards[0].id;
    var b = ML.boards.find(function(x){ return x.id === ML.boardId; });

    return '<div class="ml-view-head"><div><span class="ml-kicker">PROJECT BOARDS</span><h3>بردهای متریال و برآورد</h3><p>انتخاب متریال پروژه را از حالت عکس و چت خارج می‌کنیم و تبدیلش می‌کنیم به داده قابل برآورد.</p></div><button class="btn" onclick="MaterialLab.openBoard()">＋ برد جدید</button></div>'+
      '<div class="ml-board-layout"><aside class="card ml-board-sidebar">'+
        (ML.boards.length ? ML.boards.map(function(x){ return '<button class="ml-board-nav '+(b&&b.id===x.id?'active':'')+'" onclick="MaterialLab.selectBoard(\''+x.id+'\')"><strong>'+esc(x.name)+'</strong><span>'+esc(projectName(x.project_id))+'</span></button>'; }).join('') : empty('هنوز بردی ساخته نشده.'))+
      '</aside><section class="ml-board-content">'+(b?boardDetail(b):'<div class="card">'+empty('یک برد بساز تا انتخاب متریال را شروع کنیم.')+'</div>')+'</section></div>';
  }

  function boardDetail(b){
    var items = ML.items.filter(function(x){ return x.board_id === b.id; });
    var total = items.reduce(function(sum,i){
      var m = findMaterial(i.material_id);
      return sum + Number(i.quantity || 0) * Number(m && m.price || 0);
    },0);
    var chosen = items.filter(function(i){ return ['منتخب','تأیید کارفرما','سفارش داده‌شده','اجراشده'].indexOf(i.status) >= 0; }).length;

    return '<div class="card ml-board-card"><div class="ml-board-head"><div><span class="ml-kicker">MATERIAL BOARD</span><h3>'+esc(b.name)+'</h3><p>'+esc(projectName(b.project_id))+(b.description?' · '+esc(b.description):'')+'</p></div><div class="ml-board-total"><span>برآورد اولیه</span><strong>'+num(total)+' تومان</strong><small>'+num(chosen)+' آیتم انتخاب‌شده</small><div class="ml-inline-actions"><button class="btn small secondary" onclick="MaterialLab.openBoard(\''+b.id+'\')">ویرایش برد</button>'+(isAdmin()?'<button class="btn small danger" onclick="MaterialLab.deleteBoard(\''+b.id+'\')">حذف برد</button>':'')+'</div></div></div>'+
      '<div class="ml-board-toolbar"><select id="ml-board-material"><option value="">＋ انتخاب متریال</option>'+ML.materials.map(function(m){ return '<option value="'+m.id+'">'+esc(m.name_fa)+' · '+priceLabel(m)+'</option>'; }).join('')+'</select><input id="ml-board-qty" type="number" min="0" step="0.01" placeholder="مقدار"><input id="ml-board-unit" value="مترمربع" placeholder="واحد"><select id="ml-board-status">'+['پیشنهادی','منتخب','تأیید کارفرما','سفارش داده‌شده','اجراشده'].map(function(s){return '<option>'+s+'</option>';}).join('')+'</select><button class="btn" onclick="MaterialLab.addItem(\''+b.id+'\')">افزودن</button></div>'+
      '<div class="ml-board-items">'+(items.length?items.map(boardItem).join(''):'<div class="ml-board-empty">'+empty('هنوز متریالی به این برد اضافه نشده.')+'</div>')+'</div>'+
      '<div class="ml-board-footer"><button class="btn secondary small" onclick="MaterialLab.printBoard(\''+b.id+'\')">🖨 چاپ / PDF</button><button class="btn secondary small" onclick="MaterialLab.setView(\'materials\')">＋ انتخاب متریال بیشتر</button></div>'+
    '</div>';
  }

  function boardItem(i,n){
    var m = findMaterial(i.material_id);
    var line = Number(i.quantity || 0) * Number(m && m.price || 0);
    var img = safeUrl(m && m.image_url);
    return '<div class="ml-board-item">'+
      '<div class="ml-board-thumb">'+(img?'<img src="'+esc(img)+'" alt="">':'🧱')+'</div>'+
      '<div class="ml-board-main"><strong>'+esc(i.custom_label || (m?m.name_fa:'—'))+'</strong><span>'+esc([m&&catName(m.category_id),m&&supplierName(m.supplier_id)].filter(Boolean).join(' · '))+'</span>'+(i.note?'<small>یادداشت: '+esc(i.note)+'</small>':'')+'</div>'+
      '<div class="ml-board-qty">'+(i.quantity != null ? num(i.quantity)+' '+esc(i.unit || (m&&m.unit) || '') : '—')+'</div>'+
      '<span class="ml-chip">'+esc(i.status || 'پیشنهادی')+'</span>'+
      '<strong class="ml-board-line-total">'+(line?num(line)+' تومان':'—')+'</strong>'+
      '<div class="ml-inline-actions"><button class="btn small secondary" onclick="MaterialLab.editItem(\''+i.id+'\')">ویرایش</button><button class="btn small danger" onclick="MaterialLab.removeItem(\''+i.id+'\')">حذف</button></div>'+
    '</div>';
  }

  function prices(){
    var rows = ML.prices.slice(0,160);
    return '<div class="ml-view-head"><div><span class="ml-kicker">PRICE HISTORY</span><h3>قیمت و تاریخچه</h3><p>قیمت فعلی فقط یک عدد نیست؛ سابقه تغییرش هم برای برآورد آینده نگه داشته می‌شود.</p></div>'+
      (isAdmin()?'<button class="btn" onclick="MaterialLab.openPrice()">＋ ثبت قیمت</button>':'')+'</div>'+
      '<div class="card ml-price-summary"><div><strong>'+num(ML.materials.filter(function(m){return Number(m.price||0)>0;}).length)+'</strong><span>متریال قیمت‌دار</span></div><div><strong>'+num(ML.prices.length)+'</strong><span>رکورد قیمت</span></div><div><strong>'+num(counts().recentPrices)+'</strong><span>به‌روزرسانی ۳۰ روز اخیر</span></div></div>'+
      '<div class="card table-wrap"><table><thead><tr><th>متریال</th><th>قیمت</th><th>واحد</th><th>شرکت</th><th>تاریخ</th><th>منبع</th>'+ (isAdmin()?'<th></th>':'') +'</tr></thead><tbody>'+
      (rows.length?rows.map(function(r){var m=findMaterial(r.material_id);return '<tr><td><button class="ml-link-btn" onclick="MaterialLab.details(\''+r.material_id+'\')">'+esc(m?m.name_fa:'—')+'</button></td><td><strong>'+money(r.price)+'</strong> '+esc(r.currency || 'تومان')+'</td><td>'+esc(r.price_unit || (m&&m.price_unit) || '—')+'</td><td>'+esc(supplierName(r.supplier_id || (m&&m.supplier_id)))+'</td><td>'+esc(dateLabel(r.recorded_at))+'</td><td>'+esc(r.source || r.note || '—')+'</td>'+(isAdmin()?'<td><div class="ml-inline-actions"><button class="btn small secondary" onclick="MaterialLab.openPrice(null,\''+r.id+'\')">ویرایش</button><button class="btn small danger" onclick="MaterialLab.deletePrice(\''+r.id+'\')">حذف</button></div></td>':'')+'</tr>';}).join(''):'<tr><td colspan="'+(isAdmin()?7:6)+'">'+empty('هنوز سابقه‌ای وجود ندارد.')+'</td></tr>')+
      '</tbody></table></div>';
  }

  function requests(){
    var rows = ML.requests.filter(function(r){ return isAdmin() || r.requested_by === userId(); });
    return '<div class="ml-view-head"><div><span class="ml-kicker">QUOTE REQUESTS</span><h3>درخواست قیمت</h3><p>استعلام‌ها را ثبت، ویرایش و پیگیری کن؛ حتی بعد از ثبت هم اطلاعات درخواست قابل اصلاح است.</p></div></div>'+
      '<div class="card ml-request-summary"><div><strong>'+num(rows.length)+'</strong><span>درخواست نمایش‌داده‌شده</span></div><div><strong>'+num(rows.filter(function(r){return String(r.status||'جدید')==='جدید';}).length)+'</strong><span>جدید</span></div><div><strong>'+num(rows.filter(function(r){return String(r.status||'')==='قیمت دریافت شد';}).length)+'</strong><span>قیمت دریافت شد</span></div></div>'+
      '<div class="card table-wrap"><table><thead><tr><th>متریال</th><th>پروژه</th><th>شرکت</th><th>مقدار</th><th>ثبت‌کننده</th><th>وضعیت</th><th>تاریخ</th><th>عملیات</th></tr></thead><tbody>'+
      (rows.length?rows.map(function(r){
        var m=findMaterial(r.material_id);
        var canEdit=isAdmin() || r.requested_by===userId();
        return '<tr><td><button class="ml-link-btn" onclick="MaterialLab.details(\''+r.material_id+'\')">'+esc(m?m.name_fa:'—')+'</button></td><td>'+esc(projectName(r.project_id))+'</td><td>'+esc(supplierName(r.supplier_id || (m&&m.supplier_id)))+'</td><td>'+(r.quantity!=null?num(r.quantity)+' '+esc(r.unit||''):'—')+'</td><td>'+esc(profileName(r.requested_by))+'</td><td>'+
          (isAdmin()?'<select onchange="MaterialLab.updateQuoteStatus(\''+r.id+'\',this.value)">'+['جدید','پیگیری شد','قیمت دریافت شد','تأیید شد','بسته','لغو شد'].map(function(s){return '<option '+(s===r.status?'selected':'')+'>'+s+'</option>';}).join('')+'</select>':'<span class="ml-chip">'+esc(r.status||'جدید')+'</span>')+
          '</td><td>'+esc(dateLabel(r.created_at))+'</td><td><div class="ml-inline-actions">'+(canEdit?'<button class="btn small secondary" onclick="MaterialLab.openQuote(\''+r.id+'\')">ویرایش</button><button class="btn small danger" onclick="MaterialLab.deleteQuote(\''+r.id+'\')">حذف</button>':'—')+'</div></td></tr>';
      }).join(''):'<tr><td colspan="8">'+empty('هنوز درخواست قیمتی ثبت نشده.')+'</td></tr>')+
      '</tbody></table></div>';
  }

  function openQuote(id){
    var r=id?ML.requests.find(function(x){return x.id===id;}):null;
    if(id && !r) return toast('درخواست پیدا نشد.');
    if(r && !(isAdmin() || r.requested_by===userId())) return toast('دسترسی ویرایش این درخواست را نداری.');
    var m=r?findMaterial(r.material_id):null;
    var body='<div class="material-form-grid">'+
      '<label>متریال</label><select id="mlqr-material"><option value="">—</option>'+optionsHtml(ML.materials.map(function(x){return [x.id,x.name_fa];}),r&&r.material_id)+'</select>'+
      '<label>پروژه</label><select id="mlqr-project"><option value="">بدون پروژه</option>'+optionsHtml(projectList().map(function(p){return [p.id,p.title||p.name];}),r&&r.project_id)+'</select>'+
      '<label>شرکت</label><select id="mlqr-supplier"><option value="">از متریال</option>'+optionsHtml(ML.suppliers.map(function(s){return [s.id,s.name];}),r&&r.supplier_id)+'</select>'+
      input('mlqr-qty','مقدار',r&&r.quantity,'number')+
      input('mlqr-unit','واحد',r&&r.unit || (m&&m.unit) || 'مترمربع')+
      '<label>وضعیت</label><select id="mlqr-status">'+optionsHtml(['جدید','پیگیری شد','قیمت دریافت شد','تأیید شد','بسته','لغو شد'].map(function(x){return [x,x];}),r&&r.status||'جدید')+'</select>'+
    '</div>'+ta('mlqr-message','پیام / توضیحات',r&&r.message);
    modal(r?'ویرایش درخواست قیمت':'درخواست قیمت',body,'<button class="btn" onclick="MaterialLab.saveQuote(\''+(id||'')+'\')">ذخیره</button>');
  }

  async function saveQuote(id){
    var p={
      material_id:document.getElementById('mlqr-material').value||null,
      project_id:document.getElementById('mlqr-project').value||null,
      supplier_id:document.getElementById('mlqr-supplier').value||null,
      quantity:document.getElementById('mlqr-qty').value?Number(document.getElementById('mlqr-qty').value):null,
      unit:document.getElementById('mlqr-unit').value.trim()||null,
      status:document.getElementById('mlqr-status').value||'جدید',
      message:document.getElementById('mlqr-message').value.trim()||null,
      updated_at:new Date().toISOString()
    };
    if(!p.material_id) return toast('متریال را انتخاب کن.');
    if(id){
      var old=ML.requests.find(function(x){return x.id===id;});
      if(!old || !(isAdmin() || old.requested_by===userId())) return toast('دسترسی این درخواست را نداری.');
      var ur=await sb.from('material_quote_requests').update(p).eq('id',id);
      if(ur.error) return toast('درخواست به‌روزرسانی نشد: '+ur.error.message);
      closeModal(); toast('درخواست قیمت به‌روزرسانی شد ✅'); await load(); refreshDom(); return;
    }
    p.requested_by=userId();
    var r=await sb.from('material_quote_requests').insert([p]);
    if(r.error) return toast('درخواست ثبت نشد: '+r.error.message);
    closeModal(); toast('درخواست قیمت ثبت شد ✅'); await load(); refreshDom();
  }

  async function deleteQuote(id){
    var r=ML.requests.find(function(x){return x.id===id;});
    if(!r || !(isAdmin() || r.requested_by===userId()) || !confirm('این درخواست قیمت حذف شود؟')) return;
    var d=await sb.from('material_quote_requests').delete().eq('id',id);
    if(d.error) return toast('درخواست حذف نشد: '+d.error.message);
    await load(); refreshDom();
  }

  function categories(){
    return '<div class="ml-view-head"><div><span class="ml-kicker">TAXONOMY</span><h3>دسته‌بندی و نظم بانک</h3><p>دسته‌ها را کم ولی کاربردی نگه می‌داریم تا جست‌وجوی دفتر به‌هم نریزد.</p></div>'+(isAdmin()?'<button class="btn" onclick="MaterialLab.openCategory()">＋ دسته جدید</button>':'')+'</div>'+
      '<div class="ml-category-grid">'+(ML.categories.length?ML.categories.map(function(c){var count=ML.materials.filter(function(m){return m.category_id===c.id;}).length;return '<article class="card ml-category-card"><div class="ml-cat-icon">'+esc(c.icon||'🧱')+'</div><div><h3>'+esc(c.name_fa)+'</h3>'+(c.name_en?'<div class="ml-en">'+esc(c.name_en)+'</div>':'')+'<p>'+esc(c.description||'بدون توضیح')+'</p><strong>'+num(count)+' متریال</strong></div><div class="ml-card-actions"><button class="btn small secondary" onclick="MaterialLab.filter(\'category\',\''+c.id+'\')">مشاهده</button>'+(isAdmin()?'<button class="btn small secondary" onclick="MaterialLab.openCategory(\''+c.id+'\')">ویرایش</button><button class="btn small danger" onclick="MaterialLab.deleteCategory(\''+c.id+'\')">حذف</button>':'')+'</div></article>';}).join(''):'<div class="card">'+empty('هنوز دسته‌ای تعریف نشده.')+'</div>')+'</div>';
  }

  function modal(title,body,actions,wide){
    var root = document.getElementById('edit-modal-root');
    if (!root) return;
    root.innerHTML = '<div class="overlay ml-overlay" onclick="if(event.target===this)this.remove()"><div class="modal material-form-modal '+(wide?'ml-modal-wide':'')+'"><div class="row-top"><h3 style="margin:0;">'+esc(title)+'</h3><button class="btn small secondary" onclick="this.closest(\'.overlay\').remove()">بستن</button></div>'+body+'<div class="modal-actions">'+(actions||'')+'</div></div></div>';
  }

  function input(id,label,value,type,ph){
    return '<label>'+esc(label)+'</label><input id="'+id+'" type="'+(type||'text')+'" value="'+esc(value == null ? '' : value)+'" placeholder="'+esc(ph||'')+'">';
  }
  function ta(id,label,value){
    return '<label>'+esc(label)+'</label><textarea id="'+id+'" rows="3" placeholder="">'+esc(value == null ? '' : value)+'</textarea>';
  }
  function optionsHtml(opts, current){
    return opts.map(function(x){ return '<option value="'+esc(x[0])+'" '+(String(current||'')===String(x[0])?'selected':'')+'>'+esc(x[1])+'</option>'; }).join('');
  }

  function openMaterial(id){
    if (!isAdmin()) return;
    var m = id ? findMaterial(id) : null;
    var suitable = Array.isArray(m&&m.suitable_for) ? m.suitable_for.join(', ') : '';
    var body =
      '<div class="ml-form-note">اطلاعات این فرم مستقیماً برای جست‌وجو، مقایسه، برد پروژه و برآورد استفاده می‌شود.</div>'+
      '<div class="material-form-grid">'+
        input('ml-name','نام فارسی',m&&m.name_fa,'text','مثلاً تراورتن عباس‌آباد')+
        input('ml-name-en','نام انگلیسی',m&&m.name_en)+
        '<label>دسته</label><select id="ml-cat"><option value="">—</option>'+optionsHtml(ML.categories.map(function(c){return [c.id,c.name_fa];}),m&&m.category_id)+'</select>'+
        input('ml-subcat','زیر‌دسته',m&&m.subcategory,'text','مثلاً نما / اسلب / کف')+
        '<label>شرکت / تأمین‌کننده</label><select id="ml-sup"><option value="">—</option>'+optionsHtml(ML.suppliers.map(function(s){return [s.id,s.name];}),m&&m.supplier_id)+'</select>'+
        input('ml-brand','برند',m&&m.brand)+
        input('ml-manufacturer','سازنده',m&&m.manufacturer)+
        input('ml-code','کد محصول / SKU',m&&m.code)+
        input('ml-color','رنگ',m&&m.color)+
        input('ml-finish','فینیش / پرداخت',m&&m.finish)+
        input('ml-texture','نوع بافت',m&&m.texture_type,'text','طبیعی، مات، براق...')+
        '<label>کاربرد</label><select id="ml-app">'+optionsHtml([['نما','نما'],['داخلی','داخلی'],['هر دو','هر دو']],m&&m.application_type)+'</select>'+
        input('ml-suitable','مناسب برای',suitable,'text','کف، دیوار، کانتر، پله...')+
        input('ml-dim','ابعاد',m&&m.dimensions,'text','مثلاً 60×120 سانت')+
        input('ml-thickness','ضخامت',m&&m.thickness)+
        input('ml-unit','واحد اصلی',m&&m.unit || 'مترمربع')+
        input('ml-weight','وزن هر واحد',m&&m.weight_per_unit,'number')+
        input('ml-water','جذب آب (%)',m&&m.water_absorption,'number')+
        input('ml-price','قیمت فعلی',m&&m.price,'number')+
        input('ml-price-unit','واحد قیمت',m&&m.price_unit || 'مترمربع')+
        '<label>واحد پول</label><select id="ml-currency">'+optionsHtml([['تومان','تومان'],['ریال','ریال'],['دلار','دلار'],['یورو','یورو']],m&&m.currency || 'تومان')+'</select>'+
        input('ml-price-date','تاریخ قیمت',m&&m.price_updated_at,'date')+
        input('ml-price-source','منبع قیمت',m&&m.price_source,'text','پیش‌فاکتور / واتساپ / سایت...')+
        input('ml-stock','وضعیت موجودی',m&&m.stock_status || 'نامشخص')+
        input('ml-image','لینک تصویر',m&&m.image_url,'url','https://...')+
        input('ml-product-url','لینک صفحه محصول',m&&m.website_url,'url','https://...')+
      '</div>'+
      ta('ml-desc','توضیحات',m&&m.description)+
      ta('ml-tech','مقاومت / اطلاعات فنی',m&&m.resistance_notes)+
      ta('ml-notes','یادداشت داخلی',m&&m.notes);

    modal(m?'ویرایش متریال':'افزودن متریال',body,
      '<button class="btn" onclick="MaterialLab.saveMaterial(\''+(id||'')+'\')">ذخیره</button>'+
      (m?'<button class="btn danger" onclick="MaterialLab.deleteMaterial(\''+m.id+'\')">حذف</button>':''),
      true);
  }

  async function saveMaterial(id){
    if (!isAdmin()) return;
    var p = {
      name_fa: document.getElementById('ml-name').value.trim(),
      name_en: document.getElementById('ml-name-en').value.trim() || null,
      category_id: document.getElementById('ml-cat').value || null,
      subcategory: document.getElementById('ml-subcat').value.trim() || null,
      supplier_id: document.getElementById('ml-sup').value || null,
      brand: document.getElementById('ml-brand').value.trim() || null,
      manufacturer: document.getElementById('ml-manufacturer').value.trim() || null,
      code: document.getElementById('ml-code').value.trim() || null,
      color: document.getElementById('ml-color').value.trim() || null,
      finish: document.getElementById('ml-finish').value.trim() || null,
      texture_type: document.getElementById('ml-texture').value.trim() || null,
      application_type: document.getElementById('ml-app').value || 'هر دو',
      suitable_for: document.getElementById('ml-suitable').value.split(',').map(function(x){return x.trim();}).filter(Boolean),
      dimensions: document.getElementById('ml-dim').value.trim() || null,
      thickness: document.getElementById('ml-thickness').value.trim() || null,
      unit: document.getElementById('ml-unit').value.trim() || 'مترمربع',
      weight_per_unit: document.getElementById('ml-weight').value ? Number(document.getElementById('ml-weight').value) : null,
      water_absorption: document.getElementById('ml-water').value ? Number(document.getElementById('ml-water').value) : null,
      price: document.getElementById('ml-price').value ? Number(document.getElementById('ml-price').value) : 0,
      price_unit: document.getElementById('ml-price-unit').value.trim() || 'مترمربع',
      currency: document.getElementById('ml-currency').value || 'تومان',
      price_updated_at: document.getElementById('ml-price-date').value || null,
      price_source: document.getElementById('ml-price-source').value.trim() || null,
      stock_status: document.getElementById('ml-stock').value.trim() || 'نامشخص',
      image_url: document.getElementById('ml-image').value.trim() || null,
      website_url: document.getElementById('ml-product-url').value.trim() || null,
      description: document.getElementById('ml-desc').value.trim() || null,
      resistance_notes: document.getElementById('ml-tech').value.trim() || null,
      notes: document.getElementById('ml-notes').value.trim() || null,
      updated_at: new Date().toISOString()
    };
    if (!p.name_fa) return toast('نام متریال الزامی است.');
    var old = id ? findMaterial(id) : null;
    var r = id
      ? await sb.from('materials').update(p).eq('id',id).select().single()
      : await sb.from('materials').insert([Object.assign({created_by:userId()},p)]).select().single();

    if (r.error) return toast('ذخیره نشد: '+r.error.message);

    var oldPrice = old ? Number(old.price || 0) : 0;
    if (p.price > 0 && (!old || oldPrice !== Number(p.price) || old.price_updated_at !== p.price_updated_at || old.price_source !== p.price_source)) {
      var pr = await sb.from('material_price_history').insert([{
        material_id:r.data.id,
        price:p.price,
        price_unit:p.price_unit,
        currency:p.currency,
        supplier_id:p.supplier_id,
        source:p.price_source,
        recorded_at:p.price_updated_at || new Date().toISOString().slice(0,10),
        created_by:userId()
      }]);
      if (pr.error) console.warn('price history',pr.error.message);
    }

    closeModal();
    toast(id?'متریال به‌روزرسانی شد ✅':'متریال اضافه شد ✅');
    await load();
    refreshDom();
  }

  async function deleteMaterial(id){
    if (!isAdmin() || !confirm('این متریال حذف شود؟')) return;
    var r = await sb.from('materials').delete().eq('id',id);
    if (r.error) return toast(r.error.message);
    closeModal();
    await load();
    refreshDom();
  }

  function openSupplier(id){
    if (!isAdmin()) return;
    var s = id ? supplier(id) : null;
    var body = '<div class="material-form-grid">'+
      input('mls-name','نام شرکت',s&&s.name,'text','مثلاً شرکت آجر...')+
      input('mls-brand','نام تجاری',s&&s.brand_name)+
      input('mls-contact','شخص تماس',s&&s.contact_person)+
      input('mls-phone','تلفن',s&&s.phone)+
      input('mls-mobile','موبایل',s&&s.mobile)+
      input('mls-wa','واتساپ',s&&s.whatsapp)+
      input('mls-email','ایمیل',s&&s.email,'email')+
      input('mls-website','وب‌سایت',s&&s.website,'url')+
      input('mls-instagram','اینستاگرام',s&&s.instagram)+
      input('mls-city','شهر',s&&s.city)+
    '</div>'+ta('mls-address','آدرس',s&&s.address)+ta('mls-notes','یادداشت',s&&s.notes);
    modal(s?'ویرایش شرکت':'افزودن شرکت / تأمین‌کننده',body,'<button class="btn" onclick="MaterialLab.saveSupplier(\''+(id||'')+'\')">ذخیره</button>',false);
  }

  async function saveSupplier(id){
    if (!isAdmin()) return;
    var p = {
      name:document.getElementById('mls-name').value.trim(),
      brand_name:document.getElementById('mls-brand').value.trim()||null,
      contact_person:document.getElementById('mls-contact').value.trim()||null,
      phone:document.getElementById('mls-phone').value.trim()||null,
      mobile:document.getElementById('mls-mobile').value.trim()||null,
      whatsapp:document.getElementById('mls-wa').value.trim()||null,
      email:document.getElementById('mls-email').value.trim()||null,
      website:document.getElementById('mls-website').value.trim()||null,
      instagram:document.getElementById('mls-instagram').value.trim()||null,
      city:document.getElementById('mls-city').value.trim()||null,
      address:document.getElementById('mls-address').value.trim()||null,
      notes:document.getElementById('mls-notes').value.trim()||null
    };
    if (!p.name) return toast('نام شرکت الزامی است.');
    var r = id ? await sb.from('material_suppliers').update(p).eq('id',id) : await sb.from('material_suppliers').insert([p]);
    if (r.error) return toast(r.error.message);
    closeModal(); toast(id?'شرکت به‌روزرسانی شد ✅':'شرکت اضافه شد ✅'); await load(); refreshDom();
  }

  async function deleteSupplier(id){
    if (!isAdmin() || !confirm('شرکت حذف شود؟')) return;
    var r = await sb.from('material_suppliers').delete().eq('id',id);
    if (r.error) return toast('حذف نشد: '+r.error.message);
    await load(); refreshDom();
  }

  function openCatalog(id){
    if (!isAdmin()) return;
    var c = id ? ML.catalogs.find(function(x){return x.id===id;}) : null;
    var body = '<div class="material-form-grid">'+
      input('mlc-title','عنوان کاتالوگ / کتاب',c&&c.title,'text','کاتالوگ محصولات 2026')+
      '<label>شرکت</label><select id="mlc-sup"><option value="">—</option>'+optionsHtml(ML.suppliers.map(function(s){return [s.id,s.name];}),c&&c.supplier_id)+'</select>'+
      '<label>نوع</label><select id="mlc-kind">'+optionsHtml([['کاتالوگ','کاتالوگ'],['کتاب','کتاب'],['بروشور','بروشور'],['دیتاشیت','دیتاشیت']],c&&c.catalog_kind)+'</select>'+
      input('mlc-pub','ناشر / سازنده',c&&c.publisher)+
      input('mlc-cat','دسته',c&&c.category)+
      input('mlc-year','سال',c&&c.year,'number')+
      input('mlc-cover','لینک جلد',c&&c.cover_url,'url')+
      input('mlc-file','لینک فایل اصلی',c&&c.file_url,'url')+
      input('mlc-loc','محل نگهداری نسخه فیزیکی',c&&c.physical_location,'text','قفسه ۲ / کمد متریال')+
      '<label>وضعیت استخراج محتوا</label><select id="mlc-extract">'+optionsHtml([['ثبت نشده','ثبت نشده'],['در انتظار استخراج','در انتظار استخراج'],['در حال پردازش','در حال پردازش'],['استخراج شد','استخراج شد'],['نیازمند بررسی','نیازمند بررسی'],['خطا','خطا']],c&&c.extraction_status || 'ثبت نشده')+'</select>'+
    '</div>'+ta('mlc-desc','توضیحات',c&&c.description)+ta('mlc-notes','یادداشت',c&&c.notes);
    modal(c?'ویرایش کاتالوگ':'افزودن کاتالوگ / کتاب',body,'<button class="btn" onclick="MaterialLab.saveCatalog(\''+(id||'')+'\')">ذخیره</button>',true);
  }

  async function saveCatalog(id){
    if (!isAdmin()) return;
    var p = {
      title:document.getElementById('mlc-title').value.trim(),
      supplier_id:document.getElementById('mlc-sup').value||null,
      catalog_kind:document.getElementById('mlc-kind').value||'کاتالوگ',
      publisher:document.getElementById('mlc-pub').value.trim()||null,
      category:document.getElementById('mlc-cat').value.trim()||null,
      year:document.getElementById('mlc-year').value ? Number(document.getElementById('mlc-year').value) : null,
      cover_url:document.getElementById('mlc-cover').value.trim()||null,
      file_url:document.getElementById('mlc-file').value.trim()||null,
      physical_location:document.getElementById('mlc-loc').value.trim()||null,
      extraction_status:document.getElementById('mlc-extract').value||'ثبت نشده',
      description:document.getElementById('mlc-desc').value.trim()||null,
      notes:document.getElementById('mlc-notes').value.trim()||null,
      updated_at:new Date().toISOString()
    };
    if (!p.title) return toast('عنوان کاتالوگ الزامی است.');
    var r = id ? await sb.from('material_catalogs').update(p).eq('id',id) : await sb.from('material_catalogs').insert([p]);
    if (r.error) return toast(r.error.message);
    closeModal(); toast(id?'کاتالوگ به‌روزرسانی شد ✅':'کاتالوگ اضافه شد ✅'); await load(); refreshDom();
  }

  async function deleteCatalog(id){
    if (!isAdmin() || !confirm('این کاتالوگ حذف شود؟')) return;
    var r = await sb.from('material_catalogs').delete().eq('id',id);
    if (r.error) return toast('حذف نشد: '+r.error.message);
    await load(); refreshDom();
  }

  function catalogDetails(id){
    var c = ML.catalogs.find(function(x){ return x.id === id; });
    if (!c) return;
    var fs = ML.files.filter(function(f){ return f.catalog_id === id; });
    var ms = ML.materials.filter(function(m){ return c.supplier_id && m.supplier_id === c.supplier_id; }).slice(0,8);
    var body = '<div class="ml-detail-hero"><div class="ml-catalog-cover big">'+(safeUrl(c.cover_url)?'<img src="'+esc(safeUrl(c.cover_url))+'" alt="">':'📚')+'</div><div><span class="ml-kicker">'+esc(c.catalog_kind||'کاتالوگ')+'</span><h3>'+esc(c.title)+'</h3><p>'+esc([supplierName(c.supplier_id),c.publisher,c.year].filter(Boolean).join(' · '))+'</p><span class="ml-extract-status">'+esc(c.extraction_status||'ثبت نشده')+'</span></div></div>'+
      (c.physical_location?'<div class="ml-detail-box">📦 محل نسخه فیزیکی: <strong>'+esc(c.physical_location)+'</strong></div>':'')+
      (c.description?'<div class="ml-detail-box">'+esc(c.description)+'</div>':'')+
      '<div class="modal-section"><h4>📎 فایل‌های مرتبط</h4>'+(fs.length?'<div class="ml-mini-file-list">'+fs.map(fileCard).join('')+'</div>':empty('فایلی به این کاتالوگ وصل نیست.'))+'</div>'+
      '<div class="modal-section"><h4>🧱 متریال‌های مرتبط با شرکت</h4>'+(ms.length?'<div class="ml-material-strip">'+ms.map(card).join('')+'</div>':empty('هنوز متریال مرتبطی ثبت نشده.'))+'</div>';
    modal('جزئیات کاتالوگ',body,(isAdmin()?'<button class="btn" onclick="this.closest(\'.overlay\').remove();MaterialLab.openCatalog(\''+c.id+'\')">ویرایش</button>':''),true);
  }

  function openFile(id){
    if (!isAdmin()) return;
    var f = id ? ML.files.find(function(x){return x.id===id;}) : null;
    var body = '<div class="material-form-grid">'+
      input('mlf-name','نام فایل / مرجع',f&&f.name,'text','دیتاشیت فنی')+
      '<label>نوع فایل</label><select id="mlf-type">'+optionsHtml([['image','تصویر'],['pdf','PDF'],['catalog','کاتالوگ'],['cad','CAD'],['datasheet','دیتاشیت'],['link','لینک'],['other','سایر']],f&&f.file_type||'pdf')+'</select>'+
      '<label>متریال</label><select id="mlf-material"><option value="">بدون اتصال</option>'+optionsHtml(ML.materials.map(function(m){return [m.id,m.name_fa];}),f&&f.material_id)+'</select>'+
      '<label>کاتالوگ</label><select id="mlf-catalog"><option value="">بدون اتصال</option>'+optionsHtml(ML.catalogs.map(function(c){return [c.id,c.title];}),f&&f.catalog_id)+'</select>'+
      input('mlf-url','آدرس فایل / URL',f&&f.url,'url','https://...')+
      input('mlf-mime','MIME Type',f&&f.mime_type,'text','application/pdf')+
      input('mlf-size','حجم فایل (bytes)',f&&f.file_size,'number')+
    '</div>'+ta('mlf-notes','یادداشت',f&&f.notes)+
    '<div class="ml-form-note">فعلاً فایل را می‌توانی روی Cloudflare R2، Google Drive، OneDrive یا هر storage دیگری نگه داری و URL آن را اینجا ثبت کنی.</div>';
    modal(f?'ویرایش فایل':'افزودن فایل / مرجع',body,'<button class="btn" onclick="MaterialLab.saveFile(\''+(id||'')+'\')">ذخیره</button>',false);
  }

  async function saveFile(id){
    if (!isAdmin()) return;
    var p = {
      material_id:document.getElementById('mlf-material').value||null,
      catalog_id:document.getElementById('mlf-catalog').value||null,
      file_type:document.getElementById('mlf-type').value||'other',
      name:document.getElementById('mlf-name').value.trim(),
      url:document.getElementById('mlf-url').value.trim(),
      mime_type:document.getElementById('mlf-mime').value.trim()||null,
      file_size:document.getElementById('mlf-size').value ? Number(document.getElementById('mlf-size').value) : null,
      notes:document.getElementById('mlf-notes').value.trim()||null
    };
    if (!p.name || !p.url) return toast('نام و URL فایل الزامی است.');
    var r = id ? await sb.from('material_files').update(p).eq('id',id) : await sb.from('material_files').insert([Object.assign({created_by:userId()},p)]);
    if (r.error) return toast(r.error.message);
    closeModal(); toast(id?'فایل به‌روزرسانی شد ✅':'فایل ثبت شد ✅'); await load(); refreshDom();
  }

  async function deleteFile(id){
    if (!isAdmin() || !confirm('این مرجع حذف شود؟')) return;
    var r = await sb.from('material_files').delete().eq('id',id);
    if (r.error) return toast(r.error.message);
    await load(); refreshDom();
  }

  function openCategory(id){
    if (!isAdmin()) return;
    var c = id ? cat(id) : null;
    var body = '<div class="material-form-grid">'+
      input('mlcat-name','نام فارسی',c&&c.name_fa,'text','مثلاً سنگ')+
      input('mlcat-name-en','نام انگلیسی',c&&c.name_en)+
      input('mlcat-icon','آیکون',c&&c.icon,'text','🧱')+
      input('mlcat-sort','ترتیب',c&&c.sort_order != null ? c.sort_order : 0,'number')+
    '</div>'+ta('mlcat-desc','توضیحات',c&&c.description);
    modal(c?'ویرایش دسته‌بندی':'افزودن دسته‌بندی',body,'<button class="btn" onclick="MaterialLab.saveCategory(\''+(id||'')+'\')">ذخیره</button>');
  }

  async function saveCategory(id){
    if (!isAdmin()) return;
    var p = {
      name_fa:document.getElementById('mlcat-name').value.trim(),
      name_en:document.getElementById('mlcat-name-en').value.trim()||null,
      icon:document.getElementById('mlcat-icon').value.trim()||'🧱',
      sort_order:Number(document.getElementById('mlcat-sort').value||0),
      description:document.getElementById('mlcat-desc').value.trim()||null
    };
    if (!p.name_fa) return toast('نام دسته الزامی است.');
    var r = id ? await sb.from('material_categories').update(p).eq('id',id) : await sb.from('material_categories').insert([p]);
    if (r.error) return toast(r.error.message);
    closeModal(); toast(id?'دسته به‌روزرسانی شد ✅':'دسته اضافه شد ✅'); await load(); refreshDom();
  }

  async function deleteCategory(id){
    if (!isAdmin() || !confirm('حذف این دسته انجام شود؟ اگر متریالی به آن وابسته باشد، حذف ممکن است انجام نشود.')) return;
    var r = await sb.from('material_categories').delete().eq('id',id);
    if (r.error) return toast('حذف نشد: '+r.error.message);
    await load(); refreshDom();
  }

  function openBoard(id){
    var b = id ? ML.boards.find(function(x){return x.id===id;}) : null;
    var body = '<div class="material-form-grid">'+
      input('mlb-name','نام برد',b&&b.name,'text','مثلاً Meybod Cafe — Material Board')+
      '<label>پروژه</label><select id="mlb-project"><option value="">بدون پروژه</option>'+optionsHtml(projectList().map(function(p){return [p.id,p.title||p.name];}),b&&b.project_id)+'</select>'+
    '</div>'+ta('mlb-desc','توضیحات',b&&b.description);
    modal(b?'ویرایش برد':'ساخت برد متریال',body,'<button class="btn" onclick="MaterialLab.saveBoard(\''+(id||'')+'\')">ذخیره</button>');
  }

  async function saveBoard(id){
    var p = {
      name:document.getElementById('mlb-name').value.trim(),
      project_id:document.getElementById('mlb-project').value||null,
      description:document.getElementById('mlb-desc').value.trim()||null,
      updated_at:new Date().toISOString()
    };
    if (!p.name) return toast('نام برد الزامی است.');
    var r = id ? await sb.from('material_boards').update(p).eq('id',id).select().single() : await sb.from('material_boards').insert([Object.assign({created_by:userId()},p)]).select().single();
    if (r.error) return toast(r.error.message);
    ML.boardId = r.data.id;
    ML.view = 'boards';
    closeModal(); toast(id?'برد به‌روزرسانی شد ✅':'برد ساخته شد ✅'); await load(); refreshDom();
  }

  function editItem(id){
    var i = ML.items.find(function(x){return x.id===id;});
    if (!i) return;
    var m = findMaterial(i.material_id);
    var body = '<div class="material-form-grid">'+
      '<label>متریال</label><select id="mli-material"><option value="">—</option>'+optionsHtml(ML.materials.map(function(x){return [x.id,x.name_fa];}),i.material_id)+'</select>'+
      input('mli-label','برچسب سفارشی',i.custom_label)+
      input('mli-qty','مقدار',i.quantity,'number')+
      input('mli-unit','واحد',i.unit || (m&&m.unit) || 'مترمربع')+
      '<label>وضعیت</label><select id="mli-status">'+optionsHtml(['پیشنهادی','منتخب','تأیید کارفرما','سفارش داده‌شده','اجراشده'].map(function(x){return [x,x];}),i.status||'پیشنهادی')+'</select>'+
    '</div>'+ta('mli-note','یادداشت',i.note);
    modal('ویرایش آیتم برد',body,'<button class="btn" onclick="MaterialLab.saveItem(\''+id+'\')">ذخیره</button>');
  }

  async function saveItem(id){
    var p = {
      material_id:document.getElementById('mli-material').value,
      custom_label:document.getElementById('mli-label').value.trim()||null,
      quantity:document.getElementById('mli-qty').value ? Number(document.getElementById('mli-qty').value) : null,
      unit:document.getElementById('mli-unit').value.trim()||null,
      status:document.getElementById('mli-status').value,
      note:document.getElementById('mli-note').value.trim()||null
    };
    if (!p.material_id) return toast('متریال را انتخاب کن.');
    var r = await sb.from('material_board_items').update(p).eq('id',id);
    if (r.error) return toast(r.error.message);
    closeModal(); await load(); refreshDom();
  }

  async function addItem(boardId){
    var mid = document.getElementById('ml-board-material').value;
    if (!mid) return toast('اول متریال را انتخاب کن.');
    var qty = document.getElementById('ml-board-qty').value;
    var unit = document.getElementById('ml-board-unit').value || 'مترمربع';
    var status = document.getElementById('ml-board-status').value;
    var max = -1;
    ML.items.filter(function(i){return i.board_id===boardId;}).forEach(function(i){max=Math.max(max,Number(i.position||0));});
    var r = await sb.from('material_board_items').insert([{
      board_id:boardId,material_id:mid,quantity:qty?Number(qty):null,unit:unit,status:status,position:max+1
    }]);
    if (r.error) return toast(r.error.message);
    await load(); refreshDom();
  }

  async function removeItem(id){
    if (!confirm('این متریال از برد حذف شود؟')) return;
    var r = await sb.from('material_board_items').delete().eq('id',id);
    if (r.error) return toast(r.error.message);
    await load(); refreshDom();
  }

  async function deleteBoard(id){
    if(!isAdmin() || !confirm('این برد و آیتم‌های داخل آن حذف شوند؟')) return;
    var ri=await sb.from('material_board_items').delete().eq('board_id',id);
    if(ri.error) return toast('آیتم‌های برد حذف نشدند: '+ri.error.message);
    var rb=await sb.from('material_boards').delete().eq('id',id);
    if(rb.error) return toast('برد حذف نشد: '+rb.error.message);
    ML.boardId=''; await load(); ML.view='boards'; refreshDom();
  }

  async function favorite(id){
    var ex = selectedFavorite(id);
    var r = ex
      ? await sb.from('material_favorites').delete().eq('user_id',userId()).eq('material_id',id)
      : await sb.from('material_favorites').insert([{user_id:userId(),material_id:id}]);
    if (r.error) return toast(r.error.message);
    ML.favorites = ex ? ML.favorites.filter(function(x){return x!==id;}) : ML.favorites.concat([id]);
    refreshDom();
  }

  function toggleCompare(id){
    var i = ML.compareIds.indexOf(id);
    if (i >= 0) ML.compareIds.splice(i,1);
    else {
      if (ML.compareIds.length >= 4) return toast('حداکثر ۴ متریال را همزمان مقایسه کن.');
      ML.compareIds.push(id);
    }
    refreshDom();
  }

  function clearCompare(){ ML.compareIds=[]; refreshDom(); }

  function details(id){
    var m = findMaterial(id); if (!m) return;
    var s = supplier(m.supplier_id);
    var hist = ML.prices.filter(function(x){return x.material_id===id;}).slice(0,8);
    var fs = ML.files.filter(function(x){return x.material_id===id;});
    var img = safeUrl(m.image_url);
    var similar = ML.materials.filter(function(x){return x.id!==m.id && x.category_id===m.category_id;}).slice(0,4);

    var body =
      '<div class="ml-detail-top"><div><span class="ml-kicker">MATERIAL</span><h3>'+esc(m.name_fa)+'</h3>'+(m.name_en?'<div class="ml-en">'+esc(m.name_en)+'</div>':'')+'<div class="ml-detail-company">🏢 '+esc(s?s.name:'شرکت ثبت نشده')+'</div></div>'+(img?'<div class="ml-detail-image"><img src="'+esc(img)+'" alt=""></div>':'')+'</div>'+
      '<div class="ml-detail-price-row"><strong>'+priceLabel(m)+'</strong><span>آخرین قیمت: '+esc(dateLabel(m.price_updated_at))+'</span></div>'+
      '<div class="material-spec-grid ml-spec-big">'+[
        ['دسته',catName(m.category_id)],['زیر‌دسته',m.subcategory||'—'],['برند',m.brand||'—'],['سازنده',m.manufacturer||'—'],
        ['کد',m.code||'—'],['رنگ',m.color||'—'],['فینیش',m.finish||'—'],['بافت',m.texture_type||'—'],
        ['کاربرد',m.application_type||'—'],['مناسب برای',Array.isArray(m.suitable_for)?m.suitable_for.join('، ')||'—':'—'],
        ['ابعاد',m.dimensions||'—'],['ضخامت',m.thickness||'—'],['واحد',m.unit||'—'],['وزن / واحد',m.weight_per_unit!=null?m.weight_per_unit:'—'],
        ['جذب آب',m.water_absorption!=null?m.water_absorption+'٪':'—'],['موجودی',m.stock_status||'—']
      ].map(function(x){return '<div><span>'+esc(x[0])+'</span><strong>'+esc(x[1])+'</strong></div>';}).join('')+'</div>'+
      (m.description?'<div class="ml-detail-box">'+esc(m.description)+'</div>':'')+
      (m.resistance_notes?'<div class="ml-detail-box"><strong>اطلاعات فنی:</strong> '+esc(m.resistance_notes)+'</div>':'')+
      '<div class="ml-detail-actions">'+
        (m.website_url&&safeUrl(m.website_url)?'<a class="btn small secondary" target="_blank" rel="noopener" href="'+esc(safeUrl(m.website_url))+'">صفحه محصول</a>':'')+
        (s&&(s.phone||s.mobile)?'<a class="btn small" href="tel:'+esc(phone(s.phone||s.mobile))+'">📞 تماس با شرکت</a>':'')+
        (s&&s.whatsapp?'<a class="btn small secondary" target="_blank" rel="noopener" href="'+esc(wa(s.whatsapp))+'">واتساپ</a>':'')+
        (isAdmin()?'<button class="btn small secondary" onclick="this.closest(\'.overlay\').remove();MaterialLab.openMaterial(\''+m.id+'\')">ویرایش</button>':'')+
      '</div>'+
      '<div class="modal-section"><h4>🎨 افزودن به برد پروژه</h4><div class="row"><select id="mld-board"><option value="">انتخاب برد...</option>'+ML.boards.map(function(b){return '<option value="'+b.id+'">'+esc(b.name)+'</option>';}).join('')+'</select><input id="mld-qty" type="number" min="0" step="0.01" placeholder="مقدار"><input id="mld-unit" value="'+esc(m.unit||'مترمربع')+'" placeholder="واحد"><select id="mld-status">'+optionsHtml(['پیشنهادی','منتخب','تأیید کارفرما','سفارش داده‌شده','اجراشده'].map(function(x){return [x,x];}),'پیشنهادی')+'</select><button class="btn" onclick="MaterialLab.addDetailBoard(\''+m.id+'\')">افزودن</button></div></div>'+
      '<div class="modal-section"><h4>☎ درخواست قیمت از شرکت</h4><div class="row"><input id="mlq-qty" type="number" min="0" step="0.01" placeholder="مقدار"><input id="mlq-unit" value="'+esc(m.unit||'مترمربع')+'" placeholder="واحد"><select id="mlq-project"><option value="">پروژه (اختیاری)</option>'+optionsHtml(projectList().map(function(p){return [p.id,p.title||p.name];}),'')+'</select></div><textarea id="mlq-msg" rows="2" placeholder="متن پیام برای شرکت"></textarea><button class="btn small" onclick="MaterialLab.quote(\''+m.id+'\')">ثبت درخواست قیمت</button></div>'+
      '<div class="modal-section"><h4>💰 آخرین قیمت‌ها</h4>'+(hist.length?'<div class="ml-mini-price-list">'+hist.map(function(x){return '<div><span>'+esc(dateLabel(x.recorded_at))+' · '+esc(x.source||'بدون منبع')+'</span><strong>'+money(x.price)+' '+esc(x.currency||'تومان')+'</strong></div>';}).join(''):' '+empty('هنوز سابقه‌ای ثبت نشده.'))+'</div>'+
      '<div class="modal-section"><h4>📎 فایل‌ها و مراجع</h4>'+(fs.length?'<div class="ml-mini-file-list">'+fs.map(fileCard).join('')+'</div>':empty('هنوز فایلی برای این متریال ثبت نشده.'))+'</div>'+
      (similar.length?'<div class="modal-section"><h4>🔎 متریال‌های مشابه</h4><div class="ml-material-strip">'+similar.map(card).join('')+'</div></div>':'');
    modal('جزئیات متریال',body,(isAdmin()?'<button class="btn small" onclick="this.closest(\'.overlay\').remove();MaterialLab.openPrice(\''+m.id+'\')">＋ ثبت قیمت جدید</button>':''),true);
  }

  async function addDetailBoard(mid){
    var bid=document.getElementById('mld-board').value;
    if(!bid) return toast('یک برد انتخاب کن.');
    var qty=document.getElementById('mld-qty').value;
    var unit=document.getElementById('mld-unit').value || (findMaterial(mid)||{}).unit || 'مترمربع';
    var status=document.getElementById('mld-status').value;
    var max=-1;
    ML.items.filter(function(i){return i.board_id===bid;}).forEach(function(i){max=Math.max(max,Number(i.position||0));});
    var r=await sb.from('material_board_items').insert([{board_id:bid,material_id:mid,quantity:qty?Number(qty):null,unit:unit,status:status,position:max+1}]);
    if(r.error) return toast(r.error.message);
    closeModal(); toast('به برد اضافه شد ✅'); ML.boardId=bid; ML.view='boards'; await load(); refreshDom();
  }

  async function quote(mid){
    var m=findMaterial(mid);
    if(!m) return;
    var qty=document.getElementById('mlq-qty').value;
    var unit=document.getElementById('mlq-unit').value || m.unit || 'مترمربع';
    var pid=document.getElementById('mlq-project').value || null;
    var msg=document.getElementById('mlq-msg').value.trim() || null;
    var r=await sb.from('material_quote_requests').insert([{
      material_id:mid,project_id:pid,supplier_id:m.supplier_id,requested_by:userId(),quantity:qty?Number(qty):null,unit:unit,message:msg,status:'جدید'
    }]);
    if(r.error) return toast('درخواست ثبت نشد: '+r.error.message);
    closeModal(); toast('درخواست قیمت ثبت شد ✅'); await load(); refreshDom();
  }

  async function updateQuoteStatus(id,status){
    if(!isAdmin()) return;
    var r=await sb.from('material_quote_requests').update({status:status,updated_at:new Date().toISOString()}).eq('id',id);
    if(r.error) return toast(r.error.message);
    await load(); refreshDom();
  }

  function openPrice(materialId, priceId){
    if(!isAdmin()) return;
    var record = priceId ? ML.prices.find(function(x){return x.id===priceId;}) : null;
    var m = record ? findMaterial(record.material_id) : (materialId ? findMaterial(materialId) : null);
    if(priceId && !record) return toast('رکورد قیمت پیدا نشد.');
    var body='<div class="material-form-grid">'+
      '<label>متریال</label><select id="mlp-material" '+(record?'disabled':'')+'><option value="">—</option>'+optionsHtml(ML.materials.map(function(x){return [x.id,x.name_fa];}),record ? record.material_id : (m&&m.id))+'</select>'+
      input('mlp-price','قیمت',record ? record.price : (m&&m.price),'number','مثلاً 2800000')+
      input('mlp-unit','واحد قیمت',record ? record.price_unit : (m&&m.price_unit||'مترمربع'))+
      '<label>واحد پول</label><select id="mlp-currency">'+optionsHtml([['تومان','تومان'],['ریال','ریال'],['دلار','دلار'],['یورو','یورو']],record ? record.currency : (m&&m.currency||'تومان'))+'</select>'+
      input('mlp-date','تاریخ',record ? record.recorded_at : (m&&m.price_updated_at),'date')+
      '<label>شرکت</label><select id="mlp-supplier"><option value="">—</option>'+optionsHtml(ML.suppliers.map(function(s){return [s.id,s.name];}),record ? record.supplier_id : (m&&m.supplier_id))+'</select>'+
      input('mlp-source','منبع',record ? record.source : (m&&m.price_source), 'text','پیش‌فاکتور / واتساپ / سایت')+
    '</div>'+ta('mlp-note','یادداشت',record ? record.note : '')+
    '<div class="ml-form-note">'+(record?'این رکورد تاریخچه ویرایش می‌شود و یک رکورد جدید ساخته نمی‌شود.':'ثبت قیمت جدید علاوه بر قیمت فعلی، در تاریخچه هم ذخیره می‌شود.')+'</div>';
    modal(record?'ویرایش رکورد قیمت':'ثبت قیمت جدید',body,'<button class="btn" onclick="MaterialLab.savePrice(\''+(priceId||'')+'\')">ذخیره</button>',false);
  }

  async function savePrice(priceId){
    if(!isAdmin()) return;
    var mid=document.getElementById('mlp-material').value;
    var price=Number(document.getElementById('mlp-price').value||0);
    if(!mid || price<=0) return toast('متریال و قیمت را وارد کن.');
    var p={
      material_id:mid, price:price,
      price_unit:document.getElementById('mlp-unit').value.trim()||'مترمربع',
      currency:document.getElementById('mlp-currency').value||'تومان',
      supplier_id:document.getElementById('mlp-supplier').value||null,
      source:document.getElementById('mlp-source').value.trim()||null,
      note:document.getElementById('mlp-note').value.trim()||null,
      recorded_at:document.getElementById('mlp-date').value||new Date().toISOString().slice(0,10)
    };
    if(priceId){
      var ur=await sb.from('material_price_history').update(p).eq('id',priceId);
      if(ur.error) return toast('رکورد قیمت به‌روزرسانی نشد: '+ur.error.message);
      var all=ML.prices.filter(function(x){return x.material_id===mid;});
      var isLatest=!all.length || all.every(function(x){return x.id===priceId || String(x.recorded_at||'')<=String(p.recorded_at||'');});
      if(isLatest){
        var upd={price:p.price,price_unit:p.price_unit,currency:p.currency,price_source:p.source,price_updated_at:p.recorded_at,supplier_id:p.supplier_id,updated_at:new Date().toISOString()};
        var ur2=await sb.from('materials').update(upd).eq('id',mid);
        if(ur2.error) console.warn('material current price sync',ur2.error.message);
      }
      closeModal(); toast('رکورد قیمت به‌روزرسانی شد ✅'); await load(); refreshDom(); return;
    }
    p.created_by=userId();
    var r=await sb.from('material_price_history').insert([p]);
    if(r.error) return toast('قیمت ثبت نشد: '+r.error.message);
    var upd2=await sb.from('materials').update({
      price:p.price,price_unit:p.price_unit,currency:p.currency,
      price_source:p.source,price_updated_at:p.recorded_at,supplier_id:p.supplier_id||((findMaterial(mid)||{}).supplier_id),
      updated_at:new Date().toISOString()
    }).eq('id',mid);
    if(upd2.error) console.warn('material current price',upd2.error.message);
    closeModal(); toast('قیمت ثبت شد ✅'); await load(); refreshDom();
  }

  async function deletePrice(id){
    if(!isAdmin() || !confirm('این رکورد قیمت حذف شود؟')) return;
    var r=await sb.from('material_price_history').delete().eq('id',id);
    if(r.error) return toast(r.error.message);
    await load(); refreshDom();
  }

  function filterSupplier(id){ ML.supplier=id; ML.view='materials'; ML.query=''; refreshDom(); }
  function search(v){ ML.query=v; clearTimeout(timer); timer=setTimeout(refreshDom,100); }
  function filter(k,v){ ML[k]=v; ML.view='materials'; refreshDom(); }
  function clearFilters(){ ML.query=''; ML.category=''; ML.subcategory=''; ML.supplier=''; ML.application=''; ML.texture=''; ML.stock=''; refreshDom(); }

  function setView(v){
    ML.view=v;
    if(v!=='materials' && v!=='files') ML.query='';
    refreshDom();
  }
  function selectBoard(id){ ML.boardId=id; ML.view='boards'; refreshDom(); }

  function printBoard(id){
    ML.boardId=id;
    setTimeout(function(){ window.print(); },80);
  }

  function closeModal(){
    var root=document.getElementById('edit-modal-root');
    var overlay=root && root.querySelector('.overlay');
    if(overlay) overlay.remove();
  }

  function refreshDom(){
    var s=document.getElementById('section-material-lab');
    if(s && !s.classList.contains('hidden')) s.innerHTML=render();
  }

  async function activate(){
    var s=document.getElementById('section-material-lab');
    if(!s) return;
    s.innerHTML='<div class="card"><div class="empty">در حال آماده‌سازی Material Lab…</div></div>';
    try{
      await load();
      if(window.activeSectionId==='material-lab' || !s.classList.contains('hidden')) s.innerHTML=render();
    }catch(e){
      console.error(e);
      s.innerHTML='<div class="card"><div class="error-msg">خطا در بارگذاری Material Lab: '+esc(e && e.message ? e.message : String(e))+'</div></div>';
    }
  }

  originalSwitch = window.switchSection;
  window.switchSection = function(id){
    if(originalSwitch) originalSwitch(id);
    if(id==='material-lab') activate();
  };

  window.MaterialLab = {
    setView:setView,
    search:search,
    filter:filter,
    filterSupplier:filterSupplier,
    clearFilters:clearFilters,
    selectBoard:selectBoard,
    refresh:async function(){await load();refreshDom();},
    openMaterial:openMaterial,
    saveMaterial:saveMaterial,
    deleteMaterial:deleteMaterial,
    openSupplier:openSupplier,
    saveSupplier:saveSupplier,
    deleteSupplier:deleteSupplier,
    openCatalog:openCatalog,
    saveCatalog:saveCatalog,
    deleteCatalog:deleteCatalog,
    catalogDetails:catalogDetails,
    openFile:openFile,
    saveFile:saveFile,
    deleteFile:deleteFile,
    openCategory:openCategory,
    saveCategory:saveCategory,
    deleteCategory:deleteCategory,
    openBoard:openBoard,
    saveBoard:saveBoard,
    addItem:addItem,
    editItem:editItem,
    saveItem:saveItem,
    removeItem:removeItem,
    deleteBoard:deleteBoard,
    favorite:favorite,
    toggleCompare:toggleCompare,
    clearCompare:clearCompare,
    details:details,
    addDetailBoard:addDetailBoard,
    quote:quote,
    updateQuoteStatus:updateQuoteStatus,
    openQuote:openQuote,
    saveQuote:saveQuote,
    deleteQuote:deleteQuote,
    openPrice:openPrice,
    savePrice:savePrice,
    deletePrice:deletePrice,
    printBoard:printBoard
  };
})();