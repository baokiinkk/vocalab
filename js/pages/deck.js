/* VocaLab — "Chi tiết bộ từ" (#/deck/<id>). Design: design/project/DeckDetail.dc.html
   Three states: deck 'mine' (Từ của tôi), built-in deck not added, built-in deck added to "Bộ của tôi".
   Word list: live search (updated in place so IME typing is not interrupted), level filters, 50 rows per page. */
(function () {
  'use strict';
  const VL = window.VL;
  const h = VL.html, raw = VL.raw;
  const PAGE = 50;
  const FILTERS = [['all', 'Tất cả'], ['weak', 'Yếu'], ['learn', 'Đang học'], ['done', 'Thành thạo']];
  // Bands from the design: ≥100 Thành thạo, ≥30 Đang học (incl. Khá), else Yếu (unstarted words = 0 %).
  const band = (p) => (p >= 100 ? 'done' : p >= 30 ? 'learn' : 'weak');

  let ui = { id: null, q: '', f: 'all', limit: PAGE, perDay: 10 };

  const backIcon = raw('<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"></path></svg>');
  const playIcon = raw('<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"></path></svg>');
  const searchIcon = raw('<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"></circle><path d="M20 20l-3.5-3.5"></path></svg>');
  const chevIcon = raw('<svg aria-hidden="true" class="deck-row-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"></path></svg>');

  const finishText = (left, perDay) => {
    if (!left) return 'Bạn đã bắt đầu học mọi từ trong bộ';
    if (!perDay) return 'Tạm dừng thêm từ mới';
    return 'Học xong cả bộ sau khoảng ' + Math.ceil(left / perDay) + ' ngày';
  };

  const stepper = (value) => h`<div class="deck-stepper" role="group" aria-label="Số từ mới mỗi ngày">
      <button type="button" class="deck-stepper-btn" data-action="per" data-step="-1" aria-label="Giảm"${value <= 0 ? raw(' disabled') : ''}>−</button>
      <span class="deck-stepper-val" aria-live="polite">${value}</span>
      <button type="button" class="deck-stepper-btn" data-action="per" data-step="1" aria-label="Tăng"${value >= 50 ? raw(' disabled') : ''}>+</button>
    </div>`;
  const perDayRow = (value, left) => h`<div class="deck-perday">
      <span class="deck-perday-text"><span class="deck-perday-title">Từ mới mỗi ngày</span><span class="deck-perday-sub">${finishText(left, value)}</span></span>
      ${stepper(value)}
    </div>`;

  /** All word rows of the deck (with live score), computed once per render/update. */
  function allRows(id, showRing) {
    return VL.words.inDeck(id).map((key) => {
      const w = VL.words.get(key);
      if (!w) return null;
      const p = VL.srs.score(key);
      return { key, w: w.w, ipa: w.ipa || '', vi: w.vi || '', p, n: VL.norm(w.w), nv: VL.norm(w.vi), ring: showRing };
    }).filter(Boolean);
  }

  function listHtml(deck, showRing) {
    const rows = allRows(deck.id, showRing);
    const q = VL.norm(ui.q);
    const match = rows.filter((r) => (!q || r.n.includes(q) || r.nv.includes(q)) && (ui.f === 'all' || !showRing || band(r.p) === ui.f));
    const shown = match.slice(0, ui.limit);
    const rest = match.length - shown.length;
    return h`
      ${showRing ? h`<div class="deck-filters" role="group" aria-label="Lọc theo mức thông thạo">${FILTERS.map(([fid, label]) =>
        h`<button type="button" class="deck-filter${ui.f === fid ? ' is-on' : ''}" aria-pressed="${String(ui.f === fid)}" data-action="filter" data-value="${fid}">${label}</button>`)}</div>` : ''}
      ${!rows.length ? h`<div class="deck-noword">Bộ này chưa có từ nào.${deck.id === 'mine' ? h` <a href="${VL.href.add({ deck: 'mine' })}">Thêm từ mới</a>` : ''}</div>`
        : !match.length ? h`<div class="deck-noword" role="status">Không có từ nào khớp. Thử từ khoá khác.</div>` : ''}
      <div class="deck-rows">${shown.map((r) => h`<a class="deck-row" href="${VL.href.word(r.key)}">
          ${r.ring ? VL.ui.ring(r.p, 44) : ''}
          <span class="deck-row-main">
            <span class="deck-row-top"><strong class="deck-row-w">${r.w}</strong>${r.ipa ? h`<span class="deck-row-ipa">${r.ipa}</span>` : ''}</span>
            <span class="deck-row-vi">${r.vi}</span>
          </span>
          ${chevIcon}
        </a>`)}</div>
      ${rest > 0 ? h`<button type="button" class="deck-more" data-action="more">${'Xem thêm ' + Math.min(PAGE, rest) + ' từ'}</button>` : ''}`;
  }

  function render(ctx) {
    const deck = VL.decks.get(ctx.params.id);
    if (!deck) {
      return h`<div class="page"><div class="page-inner deck-inner">
        <a class="back-link deck-back" href="#/library">${backIcon}Thư viện</a>
        ${VL.ui.empty('Không tìm thấy bộ từ này', 'Có thể bộ từ đã bị đổi tên hoặc không còn tồn tại.', h`<a class="btn btn-primary" href="#/library">Về Thư viện</a>`)}
      </div></div>`;
    }
    const id = deck.id;
    const isMine = id === 'mine';
    const added = VL.decks.isAdded(id);
    const st = VL.decks.stats(id);
    const showRing = isMine || added;
    const stats = isMine
      ? [{ v: String(st.total), l: 'từ' }, { v: st.startedPct + '%', l: 'thông thạo TB' }, { v: String(st.buckets.weak), l: 'từ yếu' }]
      : [{ v: String(st.total), l: 'từ' }, { v: deck.level, l: 'trình độ' }, { v: added ? st.pct + '%' : '—', l: 'thông thạo' }];
    const barColor = deck.fg === '#FFFFFF' ? 'var(--ink)' : deck.fg;
    const iconStyle = 'background:' + deck.bg + ';color:' + deck.fg;
    const practiceBtn = h`<button type="button" class="deck-btn-primary" data-action="practice">${playIcon}Luyện bộ này</button>`;

    return h`<div class="page"><div class="page-inner deck-inner">
      <a class="back-link deck-back" href="#/library">${backIcon}Thư viện</a>
      <div class="deck-layout">
        <div class="deck-left">
          <section class="deck-card deck-head">
            <div class="deck-head-top">
              <span class="deck-icon-lg" style="${raw(iconStyle)}" aria-hidden="true">${deck.abbr}</span>
              <div class="deck-head-text">
                <span class="deck-kind">${deck.kind}</span>
                <h1 class="deck-h1">${deck.name}</h1>
              </div>
            </div>
            <div class="deck-stats">${stats.map((s) => h`<div class="deck-stat"><span class="deck-stat-v">${s.v}</span><span class="deck-stat-l">${s.l}</span></div>`)}</div>
            <p class="deck-desc">${deck.desc}</p>
          </section>

          ${isMine ? h`<section class="deck-card">
            ${practiceBtn}
            <a class="deck-btn-outline" href="${VL.href.add({ deck: 'mine' })}">+ Thêm từ mới</a>
            <span class="deck-note">Mọi từ bạn tự thêm đều nằm trong bộ này.</span>
          </section>` : ''}

          ${!isMine && !added ? h`<section class="deck-card">
            <h2 class="deck-h2">Thêm vào Bộ của tôi</h2>
            <span class="deck-sub">Bộ này được thêm nguyên vẹn thành một bộ riêng, không trộn vào “Từ của tôi”.</span>
            ${perDayRow(ui.perDay, st.fresh)}
            <button type="button" class="deck-btn-primary" data-action="add">Thêm vào Bộ của tôi</button>
          </section>` : ''}

          ${!isMine && added ? h`<section class="deck-card">
            <div class="deck-added" role="status">✓ Đã có trong Bộ của tôi</div>
            <div class="deck-mastery">
              <div class="deck-mastery-row"><span class="muted">Thông thạo cả bộ</span><strong>${st.pct + '%'}</strong></div>
              <div class="deck-mastery-track" role="progressbar" aria-label="Thông thạo cả bộ" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${st.pct}"><div class="deck-mastery-fill" style="${raw('width:' + Math.max(st.pct, 2) + '%;background:' + barColor)}"></div></div>
            </div>
            ${perDayRow(VL.decks.perDay(id), st.fresh)}
            ${practiceBtn}
            <button type="button" class="deck-btn-remove" data-action="remove">Gỡ khỏi Bộ của tôi</button>
          </section>` : ''}
        </div>

        <section class="deck-card deck-right" aria-labelledby="h-words">
          <div class="deck-words-head">
            <h2 id="h-words" class="deck-h2">Các từ trong bộ</h2>
            <span class="deck-count">${st.total + ' từ'}</span>
          </div>
          <label class="deck-search">
            <span class="sr-only">Tìm trong bộ</span>
            ${searchIcon}
            <input type="search" id="deck-q" class="deck-search-input" value="${ui.q}" placeholder="Tìm trong bộ này…" autocomplete="off">
          </label>
          <div class="deck-list" id="deck-list">${listHtml(deck, showRing)}</div>
        </section>
      </div>
    </div></div>`;
  }

  VL.page('deck', {
    nav: 'vocab',
    title: (ctx) => { const d = VL.decks.get(ctx.params.id); return d ? d.name : 'Chi tiết bộ từ'; },
    enter(ctx) {
      ui = { id: ctx.params.id, q: '', f: 'all', limit: PAGE, perDay: VL.clamp(VL.store.settings().fresh || 10, 0, 50) };
    },
    render,
    mount(root, ctx) {
      const deck = VL.decks.get(ctx.params.id);
      if (!deck) return;
      const id = deck.id;
      const showRing = id === 'mine' || VL.decks.isAdded(id);
      const updateList = () => {
        const el = root.querySelector('#deck-list');
        if (el) { el.innerHTML = String(listHtml(deck, showRing)); VL.media.hydrate(el); }
      };
      const input = root.querySelector('#deck-q');
      const onInput = () => { ui.q = input.value; ui.limit = PAGE; updateList(); };
      if (input) input.addEventListener('input', onInput);
      const off = VL.ui.delegate(root, {
        filter(el) {
          ui.f = el.getAttribute('data-value'); ui.limit = PAGE; updateList();
          const b = root.querySelector('.deck-filter[data-value="' + ui.f + '"]');
          if (b) b.focus({ preventScroll: true });
        },
        more() {
          ui.limit += PAGE; updateList();
          // keep keyboard focus near where the user was: first newly loaded row
          const rows = root.querySelectorAll('.deck-row');
          const next = rows[ui.limit - PAGE];
          if (next) next.focus({ preventScroll: true });
        },
        per(el) {
          const step = Number(el.getAttribute('data-step')) * 5;
          if (VL.decks.isAdded(id) && id !== 'mine') VL.decks.setPerDay(id, VL.clamp(VL.decks.perDay(id) + step, 0, 50));
          else ui.perDay = VL.clamp(ui.perDay + step, 0, 50);
          VL.refresh();
        },
        add() {
          VL.decks.add(id, ui.perDay);
          VL.ui.toast('Đã thêm “' + deck.name + '” vào Bộ của tôi');
          VL.refresh();
        },
        remove() {
          VL.ui.confirm({
            title: 'Gỡ bộ này khỏi Bộ của tôi?',
            body: 'Tiến độ học vẫn được giữ lại. Bạn có thể thêm lại bộ bất cứ lúc nào để học tiếp.',
            ok: 'Gỡ khỏi Bộ của tôi', danger: true
          }).then((ok) => {
            if (!ok) return;
            VL.decks.remove(id);
            VL.ui.toast('Đã gỡ “' + deck.name + '” khỏi Bộ của tôi');
            VL.refresh();
          });
        },
        practice() {
          const s = VL.session.start({ preset: 'today', decks: [id], source: 'deck' });
          if (!s) VL.ui.toast(VL.words.inDeck(id).length ? 'Chưa có từ nào cần luyện trong bộ này.' : 'Bộ này chưa có từ nào để luyện.');
        }
      });
      return () => { off(); if (input) input.removeEventListener('input', onInput); };
    }
  });
})();
