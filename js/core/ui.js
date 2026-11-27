/* VocaLab — shared UI pieces: icons, navigation (sidebar / rail / bottom tab bar), small components,
   toast, confirm sheet, event delegation. All return VL.html (Raw) values; use them inside VL.html templates. */
(function () {
  'use strict';
  const VL = window.VL;
  const h = VL.html, raw = VL.raw;

  /* ---------- icons (inline stroke SVG from the design) ---------- */
  const P = {
    home: '<path d="M3.5 10.5L12 3.5l8.5 7V20a1 1 0 0 1-1 1H15v-6H9v6H4.5a1 1 0 0 1-1-1z"/>',
    book: '<path d="M4 19.5V5a2 2 0 0 1 2-2h14v15H6a2 2 0 0 0-2 2 1.5 1.5 0 0 0 1.5 1.5H20"/>',
    library: '<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="16" rx="1.5"/><path d="M17.5 5.2l3.3 14.4"/>',
    practice: '<rect x="3" y="7" width="13" height="14" rx="3"/><path d="M8 3h10a3 3 0 0 1 3 3v10"/>',
    settings: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    back: '<path d="M15 18l-6-6 6-6"/>',
    chevron: '<path d="M9 6l6 6-6 6"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    x: '<path d="M7 7l10 10M17 7L7 17"/>',
    speaker: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
    play: '<path d="M8 5v14l11-7z"/>',
    shuffle: '<path d="M4 7h3c5 0 5 10 10 10h3M4 17h3c1.7 0 2.8-1.1 3.7-2.6M14 9.6C14.9 8.1 16 7 17.5 7H20M17 4l3 3-3 3M17 14l3 3-3 3"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    upload: '<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>',
    image: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="M21 16l-5-5-8 8"/>',
    flip: '<path d="M4 12a8 8 0 0 1 13.7-5.7L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.7 5.7L4 15.5M4 20v-4.5h4.5"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8"/>',
    more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>'
  };
  const FILLED = {
    flame: '<path d="M12 2c1 4 5 5.5 5 11a5 5 0 0 1-10 0c0-2.5 1.2-4 2.5-5 .2 1.8 1 3 2.5 3.5C11 8.5 11 5 12 2z"/>',
    play: P.play
  };
  /** Inline icon. name from the list above; filled icons: flame, play. size px (default 20). */
  VL.icon = function (name, size, strokeW) {
    size = size || 20;
    if (FILLED[name] && (name === 'flame' || strokeW === 'fill')) return raw('<svg aria-hidden="true" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="currentColor">' + FILLED[name] + '</svg>');
    return raw('<svg aria-hidden="true" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (strokeW || 2) + '" stroke-linecap="round" stroke-linejoin="round">' + (P[name] || '') + '</svg>');
  };

  const ui = (VL.ui = {});

  /** Current device class from viewport width: 'laptop' (≥1100) | 'ipad' (≥640) | 'iphone'. */
  VL.device = () => { const w = window.innerWidth; return w >= 1100 ? 'laptop' : w >= 640 ? 'ipad' : 'iphone'; };

  /* ---------- navigation ---------- */
  const NAV = [
    { id: 'main', href: '#/today', label: 'Hôm nay', icon: 'home' },
    { id: 'vocab', href: '#/library', label: 'Thư viện', icon: 'book' },
    { id: 'add', href: '#/add', label: 'Thêm từ', icon: 'plus' },
    { id: 'practice', href: '#/practice', label: 'Luyện tập', icon: 'practice' },
    { id: 'settings', href: '#/settings', label: 'Cài đặt', icon: 'settings' }
  ];
  /** Render the app navigation for the device. active: main|vocab|add|practice|settings
      laptop: sidebar (brand, 5 items with coloured icon tiles, profile/stats card) ·
      ipad: 88px rail · iphone: bottom tab bar (icon pill + label). */
  ui.nav = function (active, device) {
    const cur = (n) => (n.id === active ? raw(' aria-current="page"') : '');
    const cls = (n) => 'nav-item' + (n.id === active ? ' is-active' : '');
    if (device === 'laptop') {
      const streak = VL.srs.streak();
      const showStreak = VL.store.settings().sw.streak;
      const learned = VL.srs.overview().total;
      const nDecks = VL.decks.mineIds().length;
      return h`<nav class="sidebar" aria-label="Điều hướng chính">
        <a href="#/today" class="brand" aria-label="VocaLab – Hôm nay"><span class="brand-mark">V</span><span class="brand-text"><b class="brand-name">VocaLab</b><span class="brand-sub">ENGLISH</span></span></a>
        <div class="nav-group">${NAV.map((n) => h`<a href="${n.href}" class="${cls(n)}"${cur(n)}><span class="${'nav-tile nav-tile-' + n.id}">${VL.icon(n.icon, 16, 2.3)}</span><span>${n.label}</span></a>`)}</div>
        <div class="nav-card">
          <div class="nav-me"><span class="nav-avatar" aria-hidden="true">B</span><span class="nav-me-text"><b class="nav-me-name">Bạn</b><span class="nav-me-sub">${nDecks + ' bộ từ đang học'}</span></span></div>
          <div class="nav-stats">
            ${showStreak ? h`<div class="nav-stat nav-stat-streak"><b>${streak}</b><span>ngày liên tiếp</span></div>` : ''}
            <div class="nav-stat nav-stat-words"><b>${learned}</b><span>từ đã học</span></div>
          </div>
        </div>
      </nav>`;
    }
    const item = (n) => h`<a href="${n.href}" class="${cls(n)}"${cur(n)}><span class="nav-pill">${VL.icon(n.icon, 22, n.id === active ? 2.3 : 1.9)}</span><span>${n.label}</span></a>`;
    if (device === 'ipad') {
      return h`<nav class="rail" aria-label="Điều hướng chính">
        <a href="#/today" class="brand-mark" aria-label="VocaLab – Hôm nay">V</a>
        <div class="nav-group">${NAV.map(item)}</div>
      </nav>`;
    }
    return h`<nav class="tabbar" aria-label="Điều hướng chính"><div class="nav-group">${NAV.map(item)}</div></nav>`;
  };

  /* ---------- components ---------- */
  /* ---------- deck glyphs (design-v3 DeckIcon.dc.html) ---------- */
  const GLYPH = {
    mine: '<path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z"/>',
    comm: '<path d="M4 5h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9l-4 3v-3H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/><path d="M19 9h1a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-1v2.5L16 18"/>',
    phr: '<path d="M4 8h12M12 4l4 4-4 4"/><path d="M20 16H8M12 12l-4 4 4 4"/>',
    idiom: '<path d="M5 11h4v7H3v-5c0-4 2-6 5-7"/><path d="M15 11h4v7h-6v-5c0-4 2-6 5-7"/>',
    daily: '<path d="M3.5 10.5L12 3.5l8.5 7V20a1 1 0 0 1-1 1H15v-6H9v6H4.5a1 1 0 0 1-1-1z"/>',
    travel: '<path d="M10.5 13.5L3 11l1.5-1.5 8 1L17 6a2 2 0 0 1 3 3l-4.5 4.5 1 8L15 23l-2.5-7.5L9 19v3l-1.5 1-1-3.5L3 18.5l1-1.5h3z"/>',
    food: '<path d="M4 9h13v5a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6z"/><path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H17"/><path d="M8 2v3M12 2v3"/>',
    it: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M2 20h20M9 9l-2 2 2 2M15 9l2 2-2 2"/>',
    work: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>',
    mkt: '<path d="M3 11v3a1 1 0 0 0 1 1h3l6 4V6L7 10H4a1 1 0 0 0-1 1z"/><path d="M17 9a4 4 0 0 1 0 6M19.5 6.5a8 8 0 0 1 0 11"/>',
    toeic: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8.5 15l2.5 2.5 4.5-5"/>',
    ielts: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2.5 9 2.5 12 0v-5M22 9v6"/>',
    iw: '<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"/><path d="M14 6l3 3M4 22h16"/>'
  };
  /** SVG glyph for a deck id (falls back to null for unknown ids). */
  ui.deckGlyph = ((id, size) => (GLYPH[id]
    ? raw('<svg aria-hidden="true" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + GLYPH[id] + '</svg>')
    : null));

  /** Deck icon tile (abbr on deck colours). size px. */
  ui.deckIcon = (deck, size) => {
    size = size || 40;
    if (!deck) return '';
    const glyph = ui.deckGlyph(deck.id, Math.round(size * 0.55));
    return h`<span class="deck-icon" style="${raw('width:' + size + 'px;height:' + size + 'px;flex:0 0 ' + size + 'px;border-radius:' + Math.round(size * 0.3) + 'px;background:' + deck.bg + ';color:' + deck.fg + ';font-size:' + Math.round(size * 0.35) + 'px')}" aria-hidden="true">${glyph || deck.abbr}</span>`;
  };
  /** Circular score ring "10%" coloured by level. size px (default 44). */
  ui.ring = (score, size) => {
    size = size || 44;
    const lv = VL.srs.level(score);
    return h`<span class="score-ring" style="${raw('width:' + size + 'px;height:' + size + 'px;flex:0 0 ' + size + 'px;border-color:' + lv.color + ';color:' + lv.text + ';font-size:' + (size >= 56 ? 15 : 12) + 'px')}" aria-label="${'Thông thạo ' + score + '%'}">${score}%</span>`;
  };
  /** Thin progress bar. pct 0..100, color optional (defaults by level). */
  ui.bar = (pct, color, label) => h`<span class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}"${label ? raw(' aria-label="' + VL.esc(label) + '"') : ''}><span class="bar-fill" style="${raw('width:' + VL.clamp(pct, 0, 100) + '%;background:' + (color || VL.srs.level(pct).color))}"></span></span>`;
  /** Level pill "Yếu" / "Đang học" / "Khá" / "Thành thạo". */
  ui.levelBadge = (score) => { const lv = VL.srs.level(score); return h`<span class="level-badge" style="${raw('background:' + lv.soft + ';color:' + lv.text)}">${lv.label}</span>`; };
  /** Stacked 4-colour mastery bar from buckets {weak,learning,good,master}. */
  ui.masteryBar = (b) => {
    const total = b.weak + b.learning + b.good + b.master;
    const seg = (n, c) => (n ? h`<span style="${raw('flex:' + n + ' 1 0;background:' + c)}"></span>` : '');
    return h`<div class="mastery-bar" role="img" aria-label="${'Yếu ' + b.weak + ', đang học ' + b.learning + ', khá ' + b.good + ', thành thạo ' + b.master}">${total ? [seg(b.weak, 'var(--weak)'), seg(b.learning, 'var(--learning)'), seg(b.good, 'var(--good)'), seg(b.master, 'var(--master)')] : h`<span style="flex:1;background:var(--line)"></span>`}</div>`;
  };
  /** Image placeholder that fills itself (VL.media.hydrate). cls: extra class for sizing. */
  ui.wordImage = (key, cls) => h`<div class="word-img ${cls || ''}" data-word-img="${key}"><span class="word-img-ph" aria-hidden="true">${VL.icon('image', 28, 1.6)}</span></div>`;
  /** Speaker button. data-speak text + accent. */
  ui.speakBtn = (text, accent, label) => h`<button type="button" class="icon-btn speak-btn" data-action="speak" data-text="${text}" data-accent="${accent || ''}" aria-label="${label || 'Nghe phát âm ' + text}">${VL.icon('speaker', 20)}</button>`;
  /** Stepper (− value +). Buttons carry data-action="<action>" data-step="-1|1". */
  ui.stepper = (action, value, label, min, max) => h`<div class="stepper" role="group" aria-label="${label}">
      <button type="button" class="stepper-btn" data-action="${action}" data-step="-1" aria-label="${'Giảm ' + label}"${value <= min ? raw(' disabled') : ''}>−</button>
      <span class="stepper-val" aria-live="polite">${value}</span>
      <button type="button" class="stepper-btn" data-action="${action}" data-step="1" aria-label="${'Tăng ' + label}"${value >= max ? raw(' disabled') : ''}>+</button>
    </div>`;
  /** Segmented radio group. options: [[value,label],...]. Buttons carry data-action, data-value. */
  ui.seg = (action, options, value, label) => h`<div class="seg" role="radiogroup" aria-label="${label}" style="${raw('grid-template-columns:repeat(' + options.length + ',minmax(0,1fr))')}">${options.map(([v, l]) => h`<button type="button" role="radio" aria-checked="${String(String(v) === String(value))}" class="seg-btn${String(v) === String(value) ? ' is-on' : ''}" data-action="${action}" data-value="${v}">${l}</button>`)}</div>`;
  /** Toggle switch. */
  ui.switch = (action, on, label) => h`<button type="button" role="switch" aria-checked="${String(!!on)}" aria-label="${label}" class="switch${on ? ' is-on' : ''}" data-action="${action}"><span class="switch-knob"></span></button>`;
  /** Selectable chip. */
  ui.chip = (action, value, on, label) => h`<button type="button" class="chip${on ? ' is-on' : ''}" aria-pressed="${String(!!on)}" data-action="${action}" data-value="${value}">${label}</button>`;
  /** Top bar for focus screens (Flashcard / Quiz): close button, title, progress. */
  ui.focusTop = (title, progressText, pct) => h`<header class="focus-top">
      <button type="button" class="icon-btn" data-action="quit" aria-label="Thoát phiên luyện">${VL.icon('close', 22)}</button>
      <div class="focus-top-mid"><span class="focus-title">${title}</span>${ui.bar(pct, 'var(--primary)', 'Tiến độ phiên')}</div>
      <span class="focus-count">${progressText}</span>
    </header>`;
  /** Empty-state block. */
  ui.empty = (title, sub, actionHtml) => h`<div class="empty"><strong>${title}</strong>${sub ? h`<span>${sub}</span>` : ''}${actionHtml || ''}</div>`;

  /* ---------- toast & confirm (no native dialogs) ---------- */
  let toastTimer;
  ui.toast = (msg, kind, ms) => {
    let el = document.getElementById('toast');
    if (!el) { el = document.createElement('div'); el.id = 'toast'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite'); document.body.appendChild(el); }
    el.textContent = msg;
    el.className = 'toast is-show' + (kind ? ' toast-' + kind : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = 'toast'; }, ms || 2600);
  };
  /** Promise<boolean>. opts: {title, body, ok:'Đồng ý', cancel:'Huỷ', danger:bool} */
  ui.confirm = (opts) => new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'sheet-backdrop';
    wrap.innerHTML = String(h`<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-t">
      <h2 id="sheet-t" class="sheet-title">${opts.title || 'Xác nhận'}</h2>
      ${opts.body ? h`<p class="sheet-body">${opts.body}</p>` : ''}
      <div class="sheet-actions">
        <button type="button" class="btn btn-ghost" data-r="0">${opts.cancel || 'Huỷ'}</button>
        <button type="button" class="btn ${opts.danger ? 'btn-danger' : 'btn-primary'}" data-r="1">${opts.ok || 'Đồng ý'}</button>
      </div></div>`);
    const done = (v) => { document.removeEventListener('keydown', onKey); wrap.remove(); resolve(v); };
    const onKey = (e) => { if (e.key === 'Escape') done(false); };
    wrap.addEventListener('click', (e) => {
      const b = e.target.closest('[data-r]');
      if (b) done(b.getAttribute('data-r') === '1');
      else if (e.target === wrap) done(false);
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(wrap);
    wrap.querySelector('[data-r="1"]').focus();
  });

  /** Click delegation: handlers = {actionName(el, event)} for elements with data-action inside root.
      Also handles data-action="speak" globally (see app.js). Returns a cleanup fn. */
  ui.delegate = (root, handlers, evName) => {
    const fn = (e) => {
      const el = e.target.closest('[data-action]');
      if (!el || !root.contains(el) || el.disabled) return;
      const a = el.getAttribute('data-action');
      if (handlers[a]) handlers[a](el, e);
    };
    root.addEventListener(evName || 'click', fn);
    return () => root.removeEventListener(evName || 'click', fn);
  };
})();
