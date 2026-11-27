/* VocaLab — page "word" (4 · Chi tiết từ), route #/word/<key>.
   Design: design-v3/project/WordDetail.dc.html. Live data from VL.words / VL.srs; AI fills empty fields of built-in words. */
(function () {
  'use strict';
  const VL = window.VL;
  const h = VL.html, raw = VL.raw;

  // page-local state (reset in enter)
  let menuOpen = false;   // "+ Thêm vào bộ" inline menu
  const busy = new Set(); // word keys with an AI suggestion in flight
  const imgBusy = new Set(); // word keys with an image upload being processed

  const EDITABLE = ['pos', 'ipa', 'ipaUs', 'vi', 'def', 'cefr', 'examples', 'gram', 'syn', 'ant', 'note'];
  const isEmpty = (v) => v == null || v === '' || (Array.isArray(v) && !v.length);

  const deckName = (id) => (VL.CATALOG[id] || {}).name || id;

  /* ---------- small pieces ---------- */
  const aiBtn = (aiBusy) => h`<button type="button" class="btn btn-soft btn-sm wd-ai" data-action="ai"${aiBusy ? raw(' disabled aria-busy="true"') : ''}>
      ${aiBusy ? h`<span class="spinner" aria-hidden="true"></span>Đang gợi ý…` : h`${VL.icon('sparkle', 16)}Gợi ý bằng AI`}</button>`;
  const emptyBlock = (text, aiBusy) => h`<div class="wd-emptysec"><p class="wd-emptytext">${text}</p>${aiBtn(aiBusy)}</div>`;

  const ipaBtn = (w, accent) => {
    const ipa = accent === 'us' ? w.ipaUs : w.ipa;
    if (!ipa) return '';
    const label = accent === 'us' ? 'Nghe giọng Anh-Mỹ' : 'Nghe giọng Anh-Anh';
    return h`<button type="button" class="wd-ipa" data-action="speak" data-text="${w.w}" data-accent="${accent}" aria-label="${label + ' ' + ipa}">
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10v4h4l5 4V6L8 10z"></path><path d="M16 9a4 4 0 0 1 0 6"></path></svg>
      <span class="wd-ipa-acc">${accent.toUpperCase()}</span><span class="wd-ipa-txt">${ipa}</span></button>`;
  };

  const exampleText = (en, word) => {
    const b = VL.blankOut(en, word);
    return b ? h`${b.before}<b>${b.hit}</b>${b.after}` : en;
  };

  const gramLine = (line) => {
    let i = line.indexOf(' · ');
    if (i > 0) return h`<b>${line.slice(0, i)}</b>${line.slice(i)}`;
    i = line.indexOf(' + ');
    if (i > 0) return h`<b>${line.slice(0, i)}</b>${line.slice(i)}`;
    return line;
  };

  function historyRows(w, p) {
    const rows = (p ? p.h : []).slice(0, 10).map((e) => {
      const d = e.a - e.b;
      return { ok: e.ok, mark: e.ok ? '✓' : '✕', mode: VL.modeTitle(e.m), when: VL.fmtAgo(e.t), change: (d > 0 ? '+' : d < 0 ? '−' : '') + Math.abs(d) + '% → ' + e.a + '%' };
    });
    if (p && p.i && w.custom && p.h.length < 10) rows.push({ ok: null, mark: '+', mode: 'Thêm vào thư viện', when: VL.fmtAgo(p.i), change: '0%' });
    return rows;
  }

  /* ---------- render ---------- */
  function render(ctx) {
    const key = ctx.params.key;
    const w = VL.words.get(key);
    if (!w) {
      return h`<div class="page"><div class="page-inner">
        <h1 class="sr-only">Chi tiết từ</h1>
        ${VL.ui.empty('Không tìm thấy từ này', 'Từ có thể đã bị xoá hoặc đường dẫn không đúng.', h`<a class="btn btn-primary" href="#/library">Về Thư viện</a>`)}
      </div></div>`;
    }
    const p = VL.srs.progress(key);
    const started = !!(p && p.n);
    const score = VL.srs.score(key);
    const lv = VL.srs.level(score);
    const need = VL.srs.toMaster(key);
    const tag = [w.posLabel, w.cefr].filter(Boolean).join(' · ');
    const decks = Array.from(new Set(w.decks)).filter((id) => VL.CATALOG[id]);
    const addable = VL.decks.mineIds().filter((id) => decks.indexOf(id) < 0);
    const hist = historyRows(w, p);
    // Level colours come from theme tokens (var(--weak) …) so the ring/label stay readable in dark mode.
    const ring = 'background:conic-gradient(var(--wd-lv) 0 ' + score + '%, var(--track) ' + score + '% 100%)';
    const gram = String(w.gram || '').split('\n').map((s) => s.trim()).filter(Boolean);
    const ex = (w.examples || []).filter((e) => e && e.en);
    const syn = w.syn || [], ant = w.ant || [];
    const aiBusy = busy.has(key);

    return h`<div class="page"><div class="page-inner wd">
      <a class="wd-back" href="${VL.href.deck(w.deck)}">
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"></path></svg>
        ${deckName(w.deck)}
      </a>

      <section class="wd-hero">
        <figure class="wd-fig">
          <svg class="wd-illo" role="img" aria-label="Chưa có hình minh hoạ" viewBox="0 0 240 180" preserveAspectRatio="xMidYMid slice"><rect x="90" y="62" width="60" height="48" rx="6" fill="none" stroke="currentColor" stroke-width="3"></rect><circle cx="106" cy="80" r="6" fill="currentColor"></circle><path d="M150 104l-18-16-24 20" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"></path></svg>
          ${VL.ui.wordImage(key, 'wd-img')}
          <button type="button" class="wd-chimg" data-action="pickimg" aria-label="Đổi hình minh hoạ"${imgBusy.has(key) ? raw(' disabled aria-busy="true"') : ''}>${imgBusy.has(key) ? h`<span class="spinner" aria-hidden="true"></span>` : h`<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"></rect><circle cx="9" cy="11" r="2"></circle><path d="M21 17l-5-5-8 7"></path></svg>`}Đổi ảnh</button>
          <input type="file" id="wd-file" class="sr-only" accept="image/*" tabindex="-1" aria-hidden="true">
        </figure>
        <div class="wd-body">
          <div class="wd-top">
            <div class="wd-idtext">
              ${tag ? h`<span class="wd-tag">${tag}</span>` : ''}
              <h1 class="wd-word">${w.w}</h1>
              ${w.ipa || w.ipaUs ? h`<div class="wd-ipas">${ipaBtn(w, 'uk')}${ipaBtn(w, 'us')}</div>` : ''}
            </div>
            <div class="${'wd-score lv-' + lv.id}">
              <div class="wd-ring" role="img" aria-label="${'Thông thạo ' + score + '%'}" style="${raw(ring)}">
                <div class="wd-ring-in">${score}%</div>
              </div>
              <div class="wd-score-text">
                <span class="wd-level">${VL.srs.levelNote(score)}</span>
                <span class="wd-sub">${need > 0 ? 'Cần ' + need + ' lần đúng nữa' : 'Đã đạt 100%'}</span>
                <span class="wd-sub">${started ? 'Ôn tiếp: ' + VL.fmtIn(VL.srs.dueAt(key)) : 'Chưa học'}</span>
              </div>
            </div>
          </div>
          <div class="wd-actions">
            <button type="button" class="wd-btn wd-btn-primary" data-action="practice">${VL.icon('play', 16, 'fill')}Luyện từ này</button>
            <a class="wd-btn wd-btn-outline" href="${VL.href.add({ edit: key })}"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"></path></svg>Sửa</a>
            ${w.custom ? h`<button type="button" class="wd-btn wd-btn-outline wd-btn-danger" data-action="delete">${VL.icon('trash', 16)}Xoá</button>` : ''}
          </div>
        </div>
      </section>

      <div class="wd-cols">
        <div class="wd-col wd-col-main">
          <section class="wd-card">
            <h2 class="wd-h2">Nghĩa</h2>
            <p class="wd-vi">${w.vi}</p>
            ${w.def ? h`<p class="wd-def">${w.def}</p>` : emptyBlock('Chưa có định nghĩa tiếng Anh.', aiBusy)}
          </section>
          <section class="wd-card">
            <h2 class="wd-h2">Ví dụ</h2>
            ${ex.length ? ex.map((e, i) => h`<div class="wd-ex">
                ${VL.ui.speakBtn(e.en, '', 'Nghe câu ví dụ ' + (i + 1))}
                <div class="wd-ex-text"><span class="wd-ex-en">${exampleText(e.en, w.w)}</span>${e.vi ? h`<span class="wd-ex-vi">${e.vi}</span>` : ''}</div>
              </div>`) : emptyBlock('Chưa có câu ví dụ.', aiBusy)}
          </section>
          <section class="wd-card">
            <h2 class="wd-h2">Ngữ pháp &amp; collocation</h2>
            ${gram.length ? h`<div class="wd-gram">${gram.map((g) => h`<div class="wd-gram-line">${gramLine(g)}</div>`)}</div>` : emptyBlock('Chưa có ghi chú ngữ pháp hay collocation.', aiBusy)}
          </section>
        </div>

        <div class="wd-col wd-col-side">
          <section class="wd-card">
            <h2 class="wd-h2">Từ liên quan</h2>
            ${syn.length || ant.length ? h`<div class="wd-rel">
              ${syn.length ? h`<span class="wd-rel-label wd-rel-syn">Đồng nghĩa</span>
                <div class="wd-chips">${syn.map((s) => h`<a class="wd-chip wd-chip-syn" href="${VL.href.library(s)}">${s}</a>`)}</div>` : ''}
              ${ant.length ? h`<span class="wd-rel-label wd-rel-ant">Trái nghĩa</span>
                <div class="wd-chips">${ant.map((s) => h`<a class="wd-chip wd-chip-ant" href="${VL.href.library(s)}">${s}</a>`)}</div>` : ''}
            </div>` : emptyBlock('Chưa có từ đồng nghĩa / trái nghĩa.', aiBusy)}
          </section>
          <section class="wd-card">
            <h2 class="wd-h2">Ghi chú</h2>
            ${w.note ? h`<p class="wd-note">${w.note}</p>` : emptyBlock('Chưa có ghi chú.', aiBusy)}
          </section>
          <section class="wd-card">
            <div class="wd-hist-head">
              <h2 class="wd-h2">Lịch sử luyện</h2>
              <span class="wd-sub">${(p ? p.c : 0) + ' đúng · ' + (p ? p.x : 0) + ' sai'}</span>
            </div>
            ${hist.length ? h`<ul class="wd-hist">${hist.map((r) => h`<li class="wd-hist-row">
                <span class="${'wd-dot ' + (r.ok === null ? 'is-add' : r.ok ? 'is-ok' : 'is-bad')}" aria-label="${r.ok === null ? 'Thêm' : r.ok ? 'Đúng' : 'Sai'}">${r.mark}</span>
                <span class="wd-hist-mid"><span class="wd-hist-mode">${r.mode}</span><span class="wd-sub">${r.when}</span></span>
                <span class="${'wd-delta ' + (r.ok === null ? 'is-add' : r.ok ? 'is-ok' : 'is-bad')}">${r.change}</span>
              </li>`)}</ul>` : h`<p class="wd-emptytext">Chưa có lần luyện nào. Bấm “Luyện từ này” để bắt đầu.</p>`}
          </section>
          <section class="wd-card">
            <h2 class="wd-h2">Thuộc bộ</h2>
            <div class="wd-chips wd-decks">
              ${decks.map((id) => { const d = VL.CATALOG[id]; return h`<a class="wd-deck" href="${VL.href.deck(id)}" style="${raw('background:' + d.bg + ';color:' + d.fg)}">${d.name}</a>`; })}
              <button type="button" class="wd-deck wd-deck-add" data-action="menu" aria-expanded="${String(menuOpen)}" aria-controls="wd-menu">+ Thêm vào bộ</button>
            </div>
            ${menuOpen ? h`<div class="wd-menu" id="wd-menu" role="group" aria-label="Chọn bộ để thêm từ">
              ${addable.length ? addable.map((id) => h`<button type="button" class="wd-menu-item" data-action="addto" data-deck="${id}">${VL.ui.deckIcon(VL.decks.get(id), 32)}<span>${deckName(id)}</span></button>`)
                : h`<p class="wd-emptytext">Từ này đã có trong mọi bộ của bạn.</p>`}
            </div>` : ''}
          </section>
        </div>
      </div>
    </div></div>`;
  }

  /* ---------- actions ---------- */
  async function runAI(key) {
    const w = VL.words.get(key);
    if (!w || busy.has(key)) return;
    busy.add(key);
    VL.refresh();
    try {
      const sugg = await VL.ai.suggest(w.w, 'all', { vi: w.vi });
      const cur = VL.words.get(key);
      if (!cur) return;
      const fields = {};
      EDITABLE.forEach((f) => { fields[f] = cur[f]; });
      const merged = VL.ai.fillEmpty(fields, sugg);
      const added = EDITABLE.filter((f) => isEmpty(fields[f]) && !isEmpty(merged[f]));
      if (!added.length) { VL.ui.toast('AI không có thêm gợi ý cho từ này.'); return; }
      // Pass every editable field (core save() resets missing `examples` to []).
      VL.words.save(merged, { key });
      VL.ui.toast('Đã thêm gợi ý từ AI.');
    } catch (e) {
      VL.ui.toast(e && e.message ? e.message : 'Không gợi ý được, thử lại sau.', 'error');
    } finally {
      busy.delete(key);
      const c = VL.current();
      if (c && c.name === 'word' && c.params.key === key) VL.refresh();
    }
  }

  function mount(root, ctx) {
    const key = ctx.params.key;
    const off = VL.ui.delegate(root, {
      practice() {
        const s = VL.session.start({ keys: [key], modes: ['mean'], count: 1, source: 'word', title: 'Luyện từ này' });
        if (!s) VL.ui.toast('Không thể bắt đầu luyện từ này.', 'error');
      },
      menu() { menuOpen = !menuOpen; VL.refresh(); if (menuOpen) { const f = root.querySelector('.wd-menu-item'); if (f) f.focus(); } },
      addto(el) {
        const id = el.getAttribute('data-deck');
        VL.words.addToDeck(key, id);
        menuOpen = false;
        VL.ui.toast('Đã thêm vào ' + deckName(id) + '.');
        VL.refresh();
      },
      ai() { runAI(key); },
      pickimg() { const f = root.querySelector('#wd-file'); if (f) f.click(); },
      async delete() {
        const w = VL.words.get(key);
        if (!w) return;
        const ok = await VL.ui.confirm({ title: 'Xoá từ “' + w.w + '”?', body: 'Từ và toàn bộ lịch sử luyện của nó sẽ bị xoá vĩnh viễn.', ok: 'Xoá', danger: true });
        if (!ok) return;
        VL.words.remove(key);
        VL.ui.toast('Đã xoá “' + w.w + '”.');
        VL.go(VL.href.deck(w.deck), true);
      }
    });
    const file = root.querySelector('#wd-file');
    const onFile = async () => {
      const f = file.files && file.files[0];
      if (!f) return;
      imgBusy.add(key); VL.refresh();
      try {
        const img = await VL.media.fileToDataURL(f);
        VL.words.save({ img }, { key });
        VL.ui.toast('Đã đổi ảnh minh hoạ.');
      } catch (e) {
        VL.ui.toast(e && e.message ? e.message : 'Không đổi được ảnh.', 'error');
      } finally {
        imgBusy.delete(key);
        const c = VL.current();
        if (c && c.name === 'word' && c.params.key === key) VL.refresh();
      }
    };
    if (file) file.addEventListener('change', onFile);
    const onKey = (e) => { if (e.key === 'Escape' && menuOpen) { menuOpen = false; VL.refresh(); const b = document.querySelector('[data-action="menu"]'); if (b) b.focus(); } };
    document.addEventListener('keydown', onKey);
    return () => { off(); document.removeEventListener('keydown', onKey); };
  }

  VL.page('word', {
    nav: 'vocab',
    title: (ctx) => { const w = VL.words.get(ctx.params.key); return w ? w.w : 'Chi tiết từ'; },
    enter() { menuOpen = false; },
    render,
    mount
  });
})();
