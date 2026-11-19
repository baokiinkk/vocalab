/* VocaLab — hash router, app shell, theme, reminders. Loaded last among core scripts; pages register with VL.page().

   Routes:
     #/today                      Hôm nay
     #/library?q=                 Thư viện
     #/deck/<deckId>              Chi tiết bộ từ
     #/word/<key>                 Chi tiết từ  (key is encodeURIComponent'ed)
     #/add?edit=<key>&q=<text>&deck=<deckId>   Thêm / sửa từ + AI
     #/practice?deck=<id>         Luyện tập (setup)
     #/flash                      Flashcard (focus screen)
     #/quiz                       Chọn nghĩa & other quiz modes (focus screen)
     #/result                     Kết quả phiên (focus screen)
     #/settings                   Cài đặt

   Page definition: VL.page(name, {
     nav: 'main'|'vocab'|'practice'|'settings'|'add'|null,  // active nav item
     focus: false,          // true = hide navigation (practice screens)
     title: 'Hôm nay',      // document title
     enter(ctx),            // optional; once per navigation (reset local state here)
     render(ctx) -> html,   // string or VL.html value
     mount(root, ctx) -> cleanup fn | undefined   // bind events (use VL.ui.delegate)
   })
   ctx = { name, params:{id,key}, query:{...}, device:'laptop'|'ipad'|'iphone' }
   Call VL.refresh() to re-render the current page (keeps scroll position & focused field). */
(function () {
  'use strict';
  const VL = window.VL;
  const pages = VL.pages;

  const ROUTES = [
    [/^\/?(today)?$/, 'today'],
    [/^\/library$/, 'library'],
    [/^\/deck\/([^/]+)$/, 'deck', 'id'],
    [/^\/word\/([^/]+)$/, 'word', 'key'],
    [/^\/add$/, 'add'],
    [/^\/practice$/, 'practice'],
    [/^\/flash$/, 'flash'],
    [/^\/quiz$/, 'quiz'],
    [/^\/result$/, 'result'],
    [/^\/settings$/, 'settings']
  ];

  VL.parseHash = (hash) => {
    const s = (hash || location.hash || '').replace(/^#/, '');
    const [path, qs] = s.split('?');
    const query = {};
    (qs || '').split('&').filter(Boolean).forEach((p) => { const [k, v] = p.split('='); query[decodeURIComponent(k)] = decodeURIComponent((v || '').replace(/\+/g, ' ')); });
    for (const [re, name, param] of ROUTES) {
      const m = (path || '').match(re);
      if (m) { const params = {}; if (param) params[param] = decodeURIComponent(m[1]); return { name, params, query }; }
    }
    return { name: 'today', params: {}, query, notFound: true };
  };
  /** Build a hash: VL.href('word', {key}) etc. */
  VL.href = {
    today: () => '#/today',
    library: (q) => '#/library' + (q ? '?q=' + encodeURIComponent(q) : ''),
    deck: (id) => '#/deck/' + encodeURIComponent(id),
    word: (key) => '#/word/' + encodeURIComponent(key),
    add: (o) => '#/add' + (o ? '?' + Object.keys(o).filter((k) => o[k]).map((k) => k + '=' + encodeURIComponent(o[k])).join('&') : ''),
    practice: (o) => '#/practice' + (o ? '?' + Object.keys(o).filter((k) => o[k]).map((k) => k + '=' + encodeURIComponent(o[k])).join('&') : ''),
    settings: () => '#/settings'
  };
  /** Navigate. replace=true uses history.replaceState (no new history entry). */
  VL.go = (hash, replace) => {
    if (location.hash === hash) { render(false); return; }
    if (replace) { history.replaceState(null, '', hash); render(true); } else location.hash = hash;
  };
  VL.back = (fallback) => { if (history.length > 1 && document.referrer !== undefined && VL._navCount > 1) history.back(); else VL.go(fallback || '#/today'); };
  VL._navCount = 0;

  let current = null; // {name, ctx, cleanup}
  const $ = (id) => document.getElementById(id);

  function render(isNav) {
    const route = VL.parseHash();
    const def = pages[route.name];
    const view = $('view'), nav = $('nav'), app = $('app');
    if (!def) { view.innerHTML = '<div class="empty"><strong>Đang tải…</strong></div>'; return; }
    if (route.notFound && location.hash && location.hash !== '#' && location.hash !== '#/') { history.replaceState(null, '', '#/today'); }
    const ctx = { name: route.name, params: route.params, query: route.query, device: VL.device() };
    const sameRoute = current && !isNav && current.name === route.name;
    // keep scroll + focus on refresh
    const scroller = document.scrollingElement || document.documentElement;
    const scrollY = scroller.scrollTop;
    const ae = document.activeElement;
    const focusId = ae && ae !== document.body && view.contains(ae) ? ae.id || ae.getAttribute('data-focus') : null;
    const sel = focusId && ae.setSelectionRange && typeof ae.selectionStart === 'number' ? [ae.selectionStart, ae.selectionEnd] : null;

    if (current && current.cleanup) { try { current.cleanup(); } catch (e) { console.error(e); } }
    if (!sameRoute && def.enter) { try { def.enter(ctx); } catch (e) { console.error('[VL] enter failed', e); } }

    app.className = 'app device-' + ctx.device + (def.focus ? ' is-focus' : '') + ' page-' + route.name;
    nav.innerHTML = def.focus ? '' : String(VL.ui.nav(def.nav, ctx.device));
    let htmlOut = '';
    try { htmlOut = String(def.render(ctx)); } catch (e) {
      console.error('[VL] render failed', route.name, e);
      htmlOut = String(VL.html`<div class="empty"><strong>Có lỗi khi hiển thị trang.</strong><span>${e.message}</span><a class="btn btn-primary" href="#/today">Về trang chủ</a></div>`);
    }
    view.innerHTML = htmlOut;
    document.title = (def.title ? (typeof def.title === 'function' ? def.title(ctx) : def.title) + ' · ' : '') + 'VocaLab';
    let cleanup = null;
    try { cleanup = def.mount ? def.mount(view, ctx) : null; } catch (e) { console.error('[VL] mount failed', route.name, e); }
    current = { name: route.name, ctx, cleanup: typeof cleanup === 'function' ? cleanup : null };
    VL.media.hydrate(view);
    if (sameRoute) {
      scroller.scrollTop = scrollY;
      if (focusId) {
        const el = document.getElementById(focusId) || view.querySelector('[data-focus="' + focusId + '"]');
        if (el) { el.focus({ preventScroll: true }); if (sel && el.setSelectionRange) try { el.setSelectionRange(sel[0], sel[1]); } catch (e) { /* ignore */ } }
      }
    } else {
      scroller.scrollTop = 0;
      const h1 = view.querySelector('h1');
      if (h1 && isNav) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); }
    }
    VL.emit('render', ctx);
  }
  /** Re-render the current page in place. */
  VL.refresh = () => render(false);
  VL.current = () => current && current.ctx;

  /* ---------- theme & font size ---------- */
  function applyTheme() {
    const set = VL.store.settings();
    const dark = set.theme === 'dark' || (set.theme === 'sys' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-card-size', set.size || 'm');
  }
  VL.applyTheme = applyTheme;

  /* ---------- reminders (only while the app is open; no server push in v1) ---------- */
  const WD = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  VL.reminder = {
    isPracticeDay(d) {
      const set = VL.store.settings();
      if (set.freq === 'free') return false;
      if (set.freq === 'weekly') return !!set.days[WD[(d || new Date()).getDay()]];
      return true;
    },
    check() {
      const set = VL.store.settings();
      if (!set.sw.notify || !('Notification' in window) || Notification.permission !== 'granted') return;
      const now = new Date();
      if (!VL.reminder.isPracticeDay(now) || VL.srs.practicedToday()) return;
      const [hh, mm] = (set.remindAt || '20:00').split(':').map(Number);
      const mins = now.getHours() * 60 + now.getMinutes();
      const at = hh * 60 + mm;
      const dk = VL.dayKey();
      const sent = VL.ls.get('vocalab.notified', {});
      const fire = (tag, body) => { try { new Notification('VocaLab · đến giờ ôn', { body, tag }); } catch (e) { /* ignore */ } sent[tag] = 1; VL.ls.set('vocalab.notified', sent); };
      if (mins >= at && !sent[dk]) fire(dk, VL.srs.todayPlan().due.length + ' từ đang chờ bạn ôn hôm nay.');
      // "Nhắc thêm lần nữa nếu chưa ôn": second reminder 2 h later
      else if (mins >= at + 120 && sent[dk] && !sent[dk + '-2']) fire(dk + '-2', 'Bạn chưa ôn hôm nay. Chỉ cần ~' + VL.srs.todayPlan().minutes + ' phút để giữ chuỗi!');
    }
  };

  /* ---------- boot ---------- */
  let lastDevice = null;
  function boot() {
    applyTheme();
    VL.on('settings', applyTheme);
    if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
    window.addEventListener('hashchange', () => { VL._navCount++; render(true); });
    window.addEventListener('resize', VL.debounce(() => { const d = VL.device(); if (d !== lastDevice) { lastDevice = d; render(false); } }, 120));
    // Global speak buttons
    document.addEventListener('click', (e) => {
      const b = e.target.closest('[data-action="speak"]');
      if (b) { e.preventDefault(); VL.media.speak(b.getAttribute('data-text'), b.getAttribute('data-accent') || undefined); }
    });
    window.addEventListener('storage', (e) => { if (e.key === VL.store.KEY) { VL.store.load(); render(false); } });
    lastDevice = VL.device();
    VL.store.autoBackup();
    VL.srs.snapshot();
    VL._navCount = 1;
    render(true);
    setInterval(VL.reminder.check, 60000);
    setTimeout(VL.reminder.check, 3000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else setTimeout(boot, 0);
})();
