/* VocaLab — "Thư viện" (#/library?q=). Design: design/project/Vocab.dc.html.
   Search box (live, results updated in place so the input & IME composition are never re-rendered),
   "Bộ của tôi" grid and the built-in deck categories. Decks open #/deck/<id>, words #/word/<key>. */
(function () {
  'use strict';
  const VL = window.VL;
  const h = VL.html, raw = VL.raw;

  let q = '';

  const deckMeta = (d) => (d.id === 'mine' ? d.n + ' từ tự thêm' : d.n + ' từ · ' + d.level);

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
      ${words.length ? h`<div class="lib-hits">
        <div class="lib-hits-title">Từ</div>
        ${words.map((w) => h`<a class="lib-hit lib-word-hit" href="${VL.href.word(w.key)}">
          <span class="lib-hit-text"><strong>${w.w}</strong><span>${w.vi}</span></span>
          <span class="lib-hit-deck">${w.deckName}</span>
        </a>`)}
      </div>` : ''}
      ${decks.length ? h`<div class="lib-hits">
        <div class="lib-hits-title">Bộ từ</div>
        ${decks.map((d) => h`<a class="lib-hit lib-deck-hit" href="${VL.href.deck(d.id)}">
          ${VL.ui.deckIcon(d, 40)}
          <span class="lib-hit-text"><strong>${d.name}</strong><span>${deckMeta(d)}</span></span>
        </a>`)}
      </div>` : ''}
      ${none ? h`<div class="lib-none">
        <strong>Không tìm thấy “${qq}”</strong>
        <span>Từ này chưa có trong thư viện của bạn hay các bộ có sẵn.</span>
        <a class="lib-none-add" href="${VL.href.add({ q: qq })}">+ Thêm “${qq}” vào Từ của tôi</a>
      </div>` : ''}
    </section>`;
  }

  function browseBody() {
    const mine = VL.decks.mineIds().map(VL.decks.get).filter(Boolean);
    return h`<section class="lib-sec" aria-labelledby="c-mine">
        <div class="lib-mine-head">
          <h2 id="c-mine" class="h2">Bộ của tôi</h2>
          <span class="lib-count">${mine.length} bộ</span>
        </div>
        <div class="lib-mine-grid">
          ${mine.map((d) => {
            const pct = VL.decks.stats(d.id).pct;
            const color = d.id === 'mine' ? 'var(--ink)' : d.fg;
            return h`<a class="lib-mine-card${d.id === 'mine' ? ' is-mine' : ''}" href="${VL.href.deck(d.id)}" data-deck="${d.id}">
              <span class="lib-mine-top">
                ${VL.ui.deckIcon(d, 44)}
                <span class="lib-mine-text">
                  <span class="lib-mine-name">${d.name}</span>
                  <span class="lib-mine-meta">${d.id === 'mine' ? d.n + ' từ tự thêm' : d.n + ' từ · bộ có sẵn'}</span>
                </span>
              </span>
              <span class="lib-mine-prog">
                <span class="lib-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="${'Thông thạo ' + d.name}"><span style="${raw('width:' + Math.max(pct, 2) + '%;background:' + color)}"></span></span>
                <span class="lib-pct">${pct}%</span>
              </span>
            </a>`;
          })}
        </div>
      </section>
      ${VL.CATS.map((c) => h`<section class="lib-sec" aria-labelledby="${'c-' + c.id}">
        <div class="lib-cat-head">
          <h2 id="${'c-' + c.id}" class="h2">${c.title}</h2>
          <span class="lib-cat-sub">${c.sub}</span>
        </div>
        <div class="lib-row">
          ${c.ids.map(VL.decks.get).filter(Boolean).map((d) => {
            const added = VL.decks.isAdded(d.id);
            return h`<a class="lib-deck-card" href="${VL.href.deck(d.id)}" data-deck="${d.id}">
              <span class="lib-deck-top">
                ${VL.ui.deckIcon(d, 48)}
                <span class="lib-badge${added ? ' is-added' : ''}">${added ? '✓ Đã thêm' : 'Có sẵn'}</span>
              </span>
              <span class="lib-deck-name">${d.name}</span>
              <span class="lib-deck-meta">${d.n} từ · ${d.level}</span>
            </a>`;
          })}
        </div>
      </section>`)}`;
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
        <header class="lib-head">
          <h1 class="h1">Thư viện</h1>
          <label class="lib-search-box">
            <span class="sr-only">Tìm kiếm</span>
            ${VL.icon('search', 20)}
            <input id="lib-q" type="search" class="lib-input" value="${q}" placeholder="Tìm bộ từ hoặc một từ bất kỳ…" autocomplete="off" spellcheck="false" enterkeyhint="search">
          </label>
        </header>
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
        clear() { q = ''; input.value = ''; update(); input.focus(); }
      });
      syncUrl();
      return () => { off(); input.removeEventListener('input', onInput); input.removeEventListener('compositionend', onCompEnd); };
    }
  });
})();
