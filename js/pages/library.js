/* VocaLab — "Thư viện" (#/library?q=). Design: design-v3/project/Vocab.dc.html.
   Header card with live search (results updated in place so the input & IME composition are never re-rendered),
   3 stat tiles, "Bộ của tôi" (hero card for Từ của tôi + added decks) and the built-in deck categories as pastel tiles.
   Decks open #/deck/<id>, words #/word/<key>.
   Uses VL.ui.deckGlyph (core) for SVG deck icons. */
(function () {
  'use strict';
  const VL = window.VL;
  const h = VL.html, raw = VL.raw;

  /* deck glyphs: VL.ui.deckGlyph lives in js/core/ui.js */

  /* Pastel palette per deck / category (Vocab.dc.html `P`); colours live in css/pages/library.css (.pal-*). */
  const PAL = { mine: 'mine', comm: 'peach', phr: 'lilac', idiom: 'pink', daily: 'mint', travel: 'sky', food: 'butter', it: 'sky', work: 'butter', mkt: 'pink', toeic: 'peach', ielts: 'lilac', iw: 'mint' };
  const CAT_PAL = { talk: 'peach', life: 'mint', pro: 'butter', exam: 'lilac' };
  const CAT_ICON = { talk: 'comm', life: 'daily', pro: 'work', exam: 'ielts' };
  const pal = (id) => 'pal-' + (PAL[id] || 'peach');

  const ICON = {
    book: '<path d="M4 19.5V5a2 2 0 0 1 2-2h14v15H6a2 2 0 0 0-2 2 1.5 1.5 0 0 0 1.5 1.5H20"/>',
    check: '<path d="M5 12l5 5 9-10"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'
  };
  const svg = (name, size, sw) => raw('<svg aria-hidden="true" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + sw + '" stroke-linecap="round" stroke-linejoin="round">' + ICON[name] + '</svg>');
  const starFill = raw('<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z"/></svg>');
  const playFill = raw('<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4l13 8-13 8z"/></svg>');
  const plusIcon = raw('<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>');
  const deco = raw('<svg class="lib-head-deco" aria-hidden="true" viewBox="0 0 300 120"><circle cx="220" cy="6" r="52" class="lib-deco-c"/><path d="M266 26l4 12 12 4-12 4-4 12-4-12-12-4 12-4z" class="lib-deco-y"/><path d="M170 52l2.5 7 7 2.5-7 2.5-2.5 7-2.5-7-7-2.5 7-2.5z" class="lib-deco-l"/></svg>');

  /** Deck tile: palette class + glyph. */
  const tile = (id, cls, size) => h`<span class="${'lib-tile ' + cls + ' ' + pal(id)}" aria-hidden="true">${VL.ui.deckGlyph(id, size)}</span>`;
  /** Conic progress ring. */
  const ring = (pct, cls, label) => h`<span class="${'lib-ring ' + cls}" role="img" aria-label="${label}" style="${raw('--p:' + pct + '%')}"><span class="lib-ring-in">${pct}%</span></span>`;

  let q = '';

  function statsRow() {
    const lib = VL.words.library();
    const ov = VL.srs.overview(lib);
    const due = VL.srs.todayPlan().due.length;
    const T = (n, label, icon, p, attrs) => h`<${raw(attrs.tag)} class="${'lib-stat pal-' + p}" ${raw(attrs.a)}>
        <span class="lib-tape" aria-hidden="true"></span>
        <span class="lib-stat-ico" aria-hidden="true">${svg(icon, 18, icon === 'check' ? 2.6 : 2.2)}</span>
        <b class="lib-stat-n">${n}</b>
        <span class="lib-stat-l">${label}</span>
      </${raw(attrs.tag)}>`;
    return h`<div class="lib-stats">
      ${T(lib.length, 'từ đã lưu', 'book', 'lilac', { tag: 'button', a: 'type="button" data-action="jump" data-stat="saved"' })}
      ${T(ov.buckets.master, 'thành thạo', 'check', 'mint', { tag: 'a', a: 'href="#/practice" data-stat="master"' })}
      ${T(due, 'cần ôn hôm nay', 'clock', 'peach', { tag: 'a', a: 'href="#/practice" data-stat="due"' })}
    </div>`;
  }

  function searchBody(qq) {
    const words = VL.words.search(qq, 8);
    const nq = VL.norm(qq);
    const decks = Object.keys(VL.CATALOG).filter((id) => VL.norm(VL.CATALOG[id].name).includes(nq)).map(VL.decks.get);
    const none = !words.length && !decks.length;
    return h`<section class="lib-search" aria-label="Kết quả tìm kiếm">
      <div class="lib-sum-row">
        <span class="lib-sum" role="status">${words.length} từ · ${decks.length} bộ khớp “${qq}”</span>
        <button type="button" class="lib-clear" data-action="clear">Xoá tìm kiếm</button>
      </div>
      ${words.length ? h`<div class="lib-list">
        ${words.map((w) => h`<a class="lib-hit lib-word-hit" href="${VL.href.word(w.key)}">
          <span class="lib-aa" aria-hidden="true">Aa</span>
          <span class="lib-hit-text"><strong>${w.w}</strong><span>${w.vi}</span></span>
          <span class="lib-hit-deck">${w.deckName}</span>
        </a>`)}
      </div>` : ''}
      ${decks.length ? h`<div class="lib-list">
        ${decks.map((d) => h`<a class="lib-hit lib-deck-hit" href="${VL.href.deck(d.id)}">
          ${tile(d.id, 'lib-tile-40', 20)}
          <span class="lib-hit-text"><strong>${d.name}</strong><span>${d.id === 'mine' ? d.n + ' từ tự thêm' : d.n + ' từ · ' + d.level}</span></span>
        </a>`)}
      </div>` : ''}
      ${none ? h`<div class="lib-none">
        <strong>Không tìm thấy “${qq}”</strong>
        <span>Từ này chưa có trong thư viện hay các bộ có sẵn.</span>
        <a class="lib-none-add" href="${VL.href.add({ q: qq })}">+ Thêm “${qq}” vào Từ của tôi</a>
      </div>` : ''}
    </section>`;
  }

  function mineHero() {
    const d = VL.decks.get('mine');
    const st = VL.decks.stats('mine');
    const b = st.buckets;
    const pct = st.startedPct;
    return h`<div class="lib-hero pal-peach" data-deck="mine">
      <span class="lib-tape lib-tape-lg" aria-hidden="true"></span>
      <div class="lib-hero-top">
        <span class="lib-hero-ico" aria-hidden="true">${VL.ui.deckGlyph('mine', 26)}</span>
        <span class="lib-hero-text">
          <span class="lib-hero-kicker">BỘ CÁ NHÂN</span>
          <b class="lib-hero-name">${d.name}</b>
          <span class="lib-hero-meta">${d.n + ' từ tự thêm · ' + b.weak + ' từ yếu'}</span>
        </span>
        ${ring(pct, 'lib-ring-64', 'Thông thạo ' + pct + '%')}
      </div>
      <div class="lib-hero-stats">
        <span class="lib-hero-stat"><b>${b.master}</b><span>thành thạo</span></span>
        <span class="lib-hero-stat"><b>${b.learning + b.good}</b><span>đang học</span></span>
        <span class="lib-hero-stat is-weak"><b>${b.weak}</b><span>yếu</span></span>
      </div>
      <div class="lib-hero-actions">
        <a class="lib-hero-go" href="${VL.href.practice({ deck: 'mine' })}">${playFill}Luyện ngay</a>
        <a class="lib-hero-see" href="${VL.href.deck('mine')}">${'Xem ' + d.n + ' từ'}</a>
      </div>
    </div>`;
  }

  function browseBody() {
    const mineIds = VL.decks.mineIds();
    const added = mineIds.filter((id) => id !== 'mine').map(VL.decks.get).filter(Boolean);
    return h`<section class="lib-sec" aria-labelledby="c-mine">
        <div class="lib-sec-head">
          <span class="lib-sec-title"><span class="lib-star" aria-hidden="true">${starFill}</span><h2 id="c-mine" class="lib-h2">Bộ của tôi</h2></span>
          <span class="lib-count">${mineIds.length} bộ</span>
        </div>
        <div class="lib-mine-grid">
          ${mineHero()}
          <div class="lib-added">
            ${added.map((d) => {
              const pct = VL.decks.stats(d.id).pct;
              return h`<a class="lib-added-card" href="${VL.href.deck(d.id)}" data-deck="${d.id}">
                ${tile(d.id, 'lib-tile-44', 22)}
                <span class="lib-added-text">
                  <b class="lib-added-name">${d.name}</b>
                  <span class="lib-added-meta">${d.n + ' từ · ' + d.level}</span>
                </span>
                ${ring(pct, 'lib-ring-44 ' + pal(d.id), 'Thông thạo ' + pct + '%')}
              </a>`;
            })}
            <button type="button" class="lib-add-more" data-action="jump">${plusIcon}Thêm bộ có sẵn</button>
          </div>
        </div>
      </section>
      <div id="lib-cats" class="lib-cats" tabindex="-1">
      ${VL.CATS.map((c) => h`<section class="lib-sec" aria-labelledby="${'c-' + c.id}">
        <div class="lib-cat-head">
          <span class="${'lib-tile lib-tile-36 pal-' + CAT_PAL[c.id]}" aria-hidden="true">${VL.ui.deckGlyph(CAT_ICON[c.id], 18)}</span>
          <span class="lib-cat-text"><h2 id="${'c-' + c.id}" class="lib-h2">${c.title}</h2><span class="lib-cat-sub">${c.sub}</span></span>
        </div>
        <div class="lib-row">
          ${c.ids.map(VL.decks.get).filter(Boolean).map((d) => {
            const isAdded = VL.decks.isAdded(d.id);
            return h`<a class="${'lib-deck-card ' + pal(d.id)}" href="${VL.href.deck(d.id)}" data-deck="${d.id}">
              <span class="lib-tape lib-tape-md" aria-hidden="true"></span>
              <span class="lib-deck-top">
                <span class="lib-tile lib-tile-46 lib-tile-white" aria-hidden="true">${VL.ui.deckGlyph(d.id, 22)}</span>
                <span class="lib-badge${isAdded ? ' is-added' : ''}">${isAdded ? '✓ Đã thêm' : '+ Có sẵn'}</span>
              </span>
              <span class="lib-deck-name">${d.name}</span>
              <span class="lib-deck-meta">
                <span class="lib-deck-n">${svg('book', 13, 2.4)}${d.n} từ</span>
                <span class="lib-deck-level">${d.level}</span>
              </span>
            </a>`;
          })}
        </div>
      </section>`)}
      </div>`;
  }

  const body = () => (q.trim() ? searchBody(q.trim()) : browseBody());

  function syncUrl() {
    const want = VL.href.library(q.trim());
    if (location.hash !== want) history.replaceState(null, '', want);
  }

  VL.page('library', {
    nav: 'vocab',
    title: 'Thư viện',
    enter(ctx) { q = (ctx.query && ctx.query.q) || ''; },
    render() {
      return h`<div class="page"><div class="page-inner lib-inner">
        <section class="lib-head" aria-label="Thư viện của bạn">
          ${deco}
          <div class="lib-head-text">
            <h1 class="lib-h1">Thư viện</h1>
            <span class="lib-head-sub">Từ bạn tự thêm và các bộ có sẵn, gom về một chỗ.</span>
          </div>
          <label class="lib-search-box">
            <span class="sr-only">Tìm kiếm</span>
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"></circle><path d="M20 20l-3.5-3.5"></path></svg>
            <input id="lib-q" type="search" class="lib-input" value="${q}" placeholder="Tìm bộ từ hoặc một từ bất kỳ…" autocomplete="off" spellcheck="false" enterkeyhint="search">
          </label>
        </section>
        ${statsRow()}
        <div id="lib-body" class="lib-body">${body()}</div>
      </div></div>`;
    },
    mount(root) {
      const input = root.querySelector('#lib-q');
      const bodyEl = root.querySelector('#lib-body');
      const update = () => {
        bodyEl.innerHTML = String(body());
        VL.media.hydrate(bodyEl);
        syncUrl();
      };
      const onInput = (e) => { if (e.isComposing) return; q = input.value; update(); };
      const onCompEnd = () => { q = input.value; update(); };
      input.addEventListener('input', onInput);
      input.addEventListener('compositionend', onCompEnd);
      const off = VL.ui.delegate(root, {
        clear() { q = ''; input.value = ''; update(); input.focus(); },
        /* "từ đã lưu" / "Thêm bộ có sẵn": scroll to the built-in categories (leaving search mode if needed). */
        jump() {
          if (q.trim()) { q = ''; input.value = ''; update(); }
          const cats = root.querySelector('#lib-cats');
          if (!cats) return;
          const smooth = !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
          cats.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
          cats.focus({ preventScroll: true });
        }
      });
      syncUrl();
      return () => { off(); input.removeEventListener('input', onInput); input.removeEventListener('compositionend', onCompEnd); };
    }
  });
})();
