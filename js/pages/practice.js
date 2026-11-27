/* VocaLab — page "Luyện tập" (#/practice, optional ?deck=<id> and ?preset=today|quick|weak|new).
   Design: design-v3/project/PracticeSetup.dc.html (+ PracticeQuick/Weak/New wrappers = the tabs).
   The words shown ("Từ sẽ luyện", big count) are exactly the keys passed to VL.session.start({keys}). */
(function () {
  'use strict';
  const VL = window.VL;
  const h = VL.html, raw = VL.raw;

  const TABS = [
    { id: 'today', label: 'Ôn hôm nay', name: 'Ôn từ đến hạn' },
    { id: 'quick', label: 'Nhanh', name: 'Ôn nhanh 5 phút' },
    { id: 'weak', label: 'Từ yếu', name: 'Tập trung từ dưới 30%' },
    { id: 'new', label: 'Từ mới', name: 'Học từ mới hôm nay' }
  ];
  const SHORT = { mine: 'Từ của tôi', comm: 'Giao tiếp', phr: 'Phrasal verbs', idiom: 'Thành ngữ', daily: 'Hằng ngày', travel: 'Du lịch',
    food: 'Ăn uống', it: 'IT', work: 'Văn phòng', mkt: 'Marketing', toeic: 'TOEIC', ielts: 'IELTS AWL', iw: 'IELTS Writing' };
  const ARROW = raw('<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>');
  const PREVIEW_ROWS = 5;

  let S = null; // {preset, modes:{}, order, decks:[ids], extraDeck, keys:[], sig}

  const settings = () => VL.store.settings();
  const modeMap = (list) => { const m = {}; (list || []).forEach((k) => { m[k] = true; }); return m; };
  const setModes = () => { const sm = settings().modes || {}; return VL.MODES.map((m) => m.id).filter((k) => sm[k]); };
  const presetDef = (id) => VL.PRESETS.find((p) => p.id === id) || {};

  function presetModes(id) {
    if (id === 'today') return setModes().length ? setModes() : ['flash'];
    return presetDef(id).modes || ['flash'];
  }
  function presetCount(id) {
    if (id === 'today') return VL.clamp(Number(settings().count) || 24, 1, 200);
    return presetDef(id).count || 10;
  }

  /** Decks listed for the current tab (the "Từ mới" tab only opens built-in decks). */
  function deckList() {
    const ids = VL.decks.mineIds();
    if (S.extraDeck && ids.indexOf(S.extraDeck) < 0) ids.push(S.extraDeck);
    return ids.filter((id) => S.preset !== 'new' || id !== 'mine').map(VL.decks.get).filter(Boolean);
  }
  const activeDecks = () => { const shown = deckList().map((d) => d.id); return S.decks.filter((id) => shown.indexOf(id) >= 0); };
  const activeModes = () => (S.preset === 'quick' ? ['flash'] : VL.MODES.map((m) => m.id).filter((m) => S.modes[m]));

  /** The words the session will use; recomputed only when tab / decks / count change, so preview == session. */
  function keys() {
    const decks = activeDecks();
    const count = presetCount(S.preset);
    // Fingerprint of the underlying data, so the pick is refreshed when words/progress change (e.g. another tab).
    const state = VL.store.state;
    let started = 0, answers = 0;
    const pool = Array.from(new Set([].concat(...decks.map(VL.words.inDeck))));
    pool.forEach((k) => { const p = state.progress[k]; if (p) { started++; answers += p.n || 0; } });
    const sig = S.preset + '|' + decks.join(',') + '|' + count + '|' + pool.length + ':' + started + ':' + answers;
    if (S.sig !== sig) { S.sig = sig; S.keys = decks.length ? VL.session.choose(S.preset, decks, count) : []; }
    S.keys = S.keys.filter(VL.words.exists);
    return S.keys;
  }

  function pickTab(id) {
    if (!TABS.some((t) => t.id === id)) return;
    S.preset = id;
    S.modes = modeMap(presetModes(id));
  }

  function render(ctx) {
    const dev = ctx.device;
    const tab = TABS.find((t) => t.id === S.preset) || TABS[0];
    const isNew = S.preset === 'new', isWeak = S.preset === 'weak', isQuick = S.preset === 'quick';
    const list = deckList();
    const decks = activeDecks();
    const modes = activeModes();
    const ks = keys();
    const count = ks.length;
    const onlyFlash = modes.length === 1 && modes[0] === 'flash';
    const ready = modes.length > 0 && decks.length > 0;
    const meta = [
      '~' + Math.max(3, Math.round(count * (onlyFlash ? 0.3 : 0.45))) + ' phút',
      modes.length + ' kiểu' + (modes.length > 1 ? (S.order === 'mix' ? ' · xáo trộn' : ' · lần lượt') : ''),
      decks.length + ' bộ'
    ];

    const tabs = TABS.map((t) => {
      const on = t.id === S.preset;
      return h`<button type="button" role="tab" id="${'pr-tab-' + t.id}" aria-selected="${String(on)}" tabindex="${on ? '0' : '-1'}" class="pr-tab${on ? ' is-on' : ''}" data-action="tab" data-value="${t.id}">${t.label}</button>`;
    });

    let dueSum = 0;
    const deckRows = list.map((d) => {
      const on = S.decks.indexOf(d.id) >= 0;
      const st = VL.decks.stats(d.id);
      if (on) dueSum += st.due;
      return h`<button type="button" role="checkbox" aria-checked="${String(on)}" class="pr-deck${on ? ' is-on' : ''}" data-action="deck" data-value="${d.id}">
        <span class="pr-deck-ico" style="${raw('background:' + d.bg + ';color:' + d.fg)}" aria-hidden="true">${d.abbr}</span>
        <span class="pr-deck-text"><span class="pr-deck-name">${d.name}</span><span class="pr-deck-desc">${isNew ? st.fresh + ' từ chưa mở' : st.due + ' từ đến hạn · ' + st.total + ' từ'}</span></span>
        <span class="pr-box" aria-hidden="true">${on ? '✓' : ''}</span>
      </button>`;
    });

    const weakSection = () => {
      const under = ks.filter((k) => VL.srs.score(k) < 30).length;
      const rows = ks.slice(0, PREVIEW_ROWS).map((k) => {
        const w = VL.words.get(k) || {};
        const sc = VL.srs.score(k);
        const lv = VL.srs.level(sc);
        return h`<a href="${VL.href.word(k)}" class="pr-wrow">
          <span class="pr-ring" style="${raw('border-color:' + lv.color + ';color:' + lv.text)}" aria-label="${'Thông thạo ' + sc + '%'}">${sc}%</span>
          <span class="pr-wrow-text"><strong>${w.w}</strong><span>${w.vi}</span></span>
          <span class="pr-wrow-deck">${SHORT[w.deck] || (VL.decks.get(w.deck) || {}).name || ''}</span>
        </a>`;
      });
      return h`<section aria-labelledby="h-weak" class="pr-sec">
        <div class="pr-sec-head"><h2 id="h-weak" class="pr-h2">Từ sẽ luyện</h2><span class="pr-note">${under + ' từ dưới 30%'}</span></div>
        <div class="pr-list">${ks.length ? rows : h`<div class="pr-list-empty">${decks.length ? 'Chưa có từ yếu trong bộ đã chọn — tuyệt vời!' : 'Chọn ít nhất 1 bộ để xem từ sẽ luyện.'}</div>`}
          ${ks.length > PREVIEW_ROWS ? h`<div class="pr-more">${'+ ' + (ks.length - PREVIEW_ROWS) + ' từ khác'}</div>` : ''}
        </div>
      </section>`;
    };

    const modeCards = VL.MODES.map((m) => {
      const on = !!S.modes[m.id];
      return h`<button type="button" aria-pressed="${String(on)}" class="pr-mode${on ? ' is-on' : ''}" data-action="mode" data-value="${m.id}">
        <span class="pr-mode-top"><span class="pr-mode-ico" aria-hidden="true">${m.glyph}</span><span class="pr-box" aria-hidden="true">${on ? '✓' : ''}</span></span>
        <span class="pr-mode-title">${m.title}</span>
      </button>`;
    });
    const seg = (v, label) => h`<button type="button" role="radio" aria-checked="${String(S.order === v)}" class="pr-seg-btn${S.order === v ? ' is-on' : ''}" data-action="order" data-value="${v}">${label}</button>`;

    return h`<div class="pr-page pr-${dev}">
      <div class="pr-inner">
        <header class="pr-head">
          <h1 class="h1">Luyện tập</h1>
          <a href="#/settings?scope=practice" class="pr-settings-link">Cài đặt luyện</a>
        </header>

        <section aria-label="Phiên sắp luyện" class="pr-hero">
          <div role="tablist" aria-label="Chọn kiểu phiên" class="pr-tabs">${tabs}</div>
          <div class="pr-hero-row">
            <div class="pr-hero-info">
              <div class="pr-count"><span class="pr-count-n">${count}</span><span class="pr-count-l">TỪ</span></div>
              <div class="pr-hero-text">
                <span class="pr-name">${tab.name}</span>
                <div class="pr-meta">${meta.map((m) => h`<span class="pr-chip">${m}</span>`)}</div>
              </div>
            </div>
            ${ready ? h`<button type="button" class="pr-start" data-action="start">Bắt đầu ${ARROW}</button>`
              : h`<span role="status" class="pr-start-off">Chọn ít nhất 1 bộ và 1 kiểu</span>`}
          </div>
          ${ready && !count ? h`<p class="pr-empty-note" role="status">Chưa có từ để luyện ở đây. <a href="#/library">Thêm bộ từ trong Thư viện →</a></p>` : ''}
        </section>

        ${isWeak ? weakSection() : ''}

        ${isQuick ? h`<div class="pr-quick">
          <span class="pr-quick-ico" aria-hidden="true">Aa</span>
          <span class="pr-quick-text"><strong>Chỉ Flashcard</strong><span>${count + ' từ đến hạn sớm nhất · lật thẻ, tự chấm Đã nhớ / Chưa nhớ'}</span></span>
        </div>` : ''}

        <section aria-labelledby="h-deck" class="pr-sec">
          <div class="pr-sec-head">
            <h2 id="h-deck" class="pr-h2">${isNew ? 'Mở từ mới từ bộ' : 'Bộ từ'}</h2>
            <span class="pr-note">${isNew ? settings().fresh + ' từ mới / ngày · theo Cài đặt' : dueSum + ' từ đến hạn'}</span>
          </div>
          <div class="pr-list">${list.length ? deckRows : h`<div class="pr-list-empty">Bạn chưa thêm bộ từ có sẵn nào. <a href="#/library">Mở Thư viện →</a></div>`}</div>
        </section>

        ${!isQuick ? h`<section aria-labelledby="h-mode" class="pr-sec">
          <div class="pr-sec-head pr-sec-head-c">
            <h2 id="h-mode" class="pr-h2">Kiểu luyện</h2>
            <div role="radiogroup" aria-label="Thứ tự kiểu luyện" class="pr-seg">${seg('mix', 'Xáo trộn')}${seg('seq', 'Lần lượt')}</div>
          </div>
          <div class="pr-modes">${modeCards}</div>
        </section>` : ''}
      </div>
    </div>`;
  }

  VL.page('practice', {
    nav: 'practice',
    title: 'Luyện tập',
    enter(ctx) {
      const q = ctx.query || {};
      const qDeck = q.deck && VL.CATALOG[q.deck] ? q.deck : null;
      S = {
        preset: 'today', modes: {}, order: settings().order === 'seq' ? 'seq' : 'mix',
        decks: qDeck ? [qDeck] : VL.decks.mineIds(),
        extraDeck: qDeck && VL.decks.mineIds().indexOf(qDeck) < 0 ? qDeck : null,
        keys: [], sig: null
      };
      pickTab(TABS.some((t) => t.id === q.preset) ? q.preset : 'today');
    },
    render,
    mount(root) {
      const off = VL.ui.delegate(root, {
        tab(el) { pickTab(el.getAttribute('data-value')); VL.refresh(); },
        deck(el) {
          const id = el.getAttribute('data-value');
          const i = S.decks.indexOf(id);
          if (i >= 0) S.decks.splice(i, 1); else S.decks.push(id);
          VL.refresh();
        },
        mode(el) { const id = el.getAttribute('data-value'); S.modes[id] = !S.modes[id]; VL.refresh(); },
        order(el) { S.order = el.getAttribute('data-value') === 'seq' ? 'seq' : 'mix'; VL.refresh(); },
        start() {
          const modes = activeModes(), decks = activeDecks(), ks = keys();
          if (!modes.length || !decks.length) { VL.ui.toast('Chọn ít nhất 1 bộ và 1 kiểu.'); return; }
          const s = ks.length ? VL.session.start({ preset: S.preset, modes, order: S.order, count: ks.length, decks, keys: ks.slice() }) : null;
          if (!s) VL.ui.toast('Chưa có từ để luyện. Hãy thêm bộ từ trong Thư viện.');
        }
      });
      // Arrow keys move between tabs (WAI-ARIA tabs pattern).
      const onKey = (e) => {
        const t = e.target.closest && e.target.closest('[role="tab"]');
        if (!t || !root.contains(t) || ['ArrowLeft', 'ArrowRight', 'Home', 'End'].indexOf(e.key) < 0) return;
        e.preventDefault();
        const i = TABS.findIndex((x) => x.id === t.getAttribute('data-value'));
        const n = e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length;
        pickTab(TABS[n].id);
        VL.refresh();
        const nt = document.getElementById('pr-tab-' + TABS[n].id);
        if (nt) nt.focus();
      };
      root.addEventListener('keydown', onKey);
      return () => { off(); root.removeEventListener('keydown', onKey); };
    }
  });
})();
