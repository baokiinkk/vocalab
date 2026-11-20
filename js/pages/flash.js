/* VocaLab — 7 · Flashcard (#/flash). Focus screen. Design: design-v2/project/Flashcard.dc.html (+ Illo, FlashcardBack).
   Front (POS, word, IPA speak pill, "Lật thẻ xem nghĩa") and back (illustration, UK/US IPA, meaning, definition,
   examples, grammar & collocation, synonyms/antonyms, note, "Úp thẻ lại"). "Chưa nhớ" / "Đã nhớ" are available on
   both sides; answering records once, shows the back + feedback (mastery before → after) and
   "Thẻ tiếp theo" / "Tiếp: <mode>" / "Xem kết quả". Missing details are filled by AI in the background
   (once per word per session). Keys: Space = lật thẻ, 1 = Chưa nhớ, 2 = Đã nhớ, Enter = tiếp theo. */
(function () {
  'use strict';
  const VL = window.VL;
  const h = VL.html, raw = VL.raw;

  // page-local state
  let flipped = false;
  let shownFor = null;      // "<sessionId>:<idx>" the state above belongs to
  let justAnswered = false; // animate the mastery bar / reveal feedback only right after answering
  let busy = false;         // guard against double "next"
  let redirecting = false;
  let mainScroll = 0;       // scroll position of the card area (iPhone) across re-renders
  let enrichSession = null; // session id the enrichment log belongs to
  let enrich = {};          // word key -> 'loading' | 'done' | 'fail'

  // level colour tokens (dark-mode aware) instead of the fixed hexes from VL.srs.level()
  const LV_VAR = { weak: 'var(--weak)', learning: 'var(--learning-ink)', good: 'var(--good)', master: 'var(--master)' };
  const SPEAKER = raw('<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10v4h4l5 4V6L8 10z"></path><path d="M16 9a4 4 0 0 1 0 6"></path></svg>');
  const EYE = raw('<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"></path><circle cx="12" cy="12" r="3"></circle></svg>');
  const X = raw('<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"></path></svg>');
  const CHECK = raw('<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"></path></svg>');

  const sess = () => VL.session.current();

  function syncState(s, it) {
    const id = s.id + ':' + it.index;
    if (enrichSession !== s.id) { enrichSession = s.id; enrich = {}; }
    if (shownFor !== id) {
      shownFor = id;
      flipped = !!it.answered;
      justAnswered = false;
      busy = false;
      mainScroll = 0;
    }
  }

  /* ---------- AI enrichment of missing details ---------- */
  const exampleList = (w) => (w.examples || []).filter((e) => e && e.en);
  function missingDetails(w) {
    const want = VL.store.settings().exn || 2;
    return !w.def || !w.ipaUs || !w.gram || !(w.syn && w.syn.length) || !w.note || exampleList(w).length < want;
  }
  function maybeEnrich(key) {
    const w = VL.words.get(key);
    if (!w || enrich[key] || !missingDetails(w) || !VL.ai.hasKey()) return;
    enrich[key] = 'loading';
    const sid = enrichSession;
    VL.ai.suggest(w.w, 'all', { vi: w.vi, silent: true }).then((sugg) => {
      const cur = VL.words.get(key);
      if (!cur) return;
      const SCALARS = ['ipa', 'ipaUs', 'def', 'cefr', 'gram', 'syn', 'ant', 'note'];
      const base = {}; const add = {};
      SCALARS.forEach((f) => { base[f] = cur[f]; if (sugg[f] != null) add[f] = sugg[f]; });
      const merged = VL.ai.fillEmpty(base, add);
      const fields = {};
      SCALARS.forEach((f) => { if (merged[f] !== base[f]) fields[f] = merged[f]; });
      // examples: keep the existing ones, append new AI sentences up to the "exn" setting
      const have = exampleList(cur);
      const want = Math.max(have.length, VL.store.settings().exn || 2);
      const seen = new Set(have.map((e) => VL.norm(e.en)));
      const extra = (sugg.examples || []).filter((e) => e.en && !seen.has(VL.norm(e.en))).slice(0, Math.max(0, want - have.length));
      if (extra.length) fields.examples = have.concat(extra);
      if (Object.keys(fields).length) VL.words.save(fields, { key });
      if (enrichSession === sid) enrich[key] = 'done';
    }).catch(() => { if (enrichSession === sid) enrich[key] = 'fail'; })
      .then(() => {
        const c = VL.current();
        const it = VL.session.item();
        if (c && c.name === 'flash' && it && it.key === key && flipped) VL.refresh();
      });
  }

  /* ---------- pieces ---------- */
  function nextLabel() {
    const s = sess();
    if (!s || s.idx >= s.queue.length - 1) return 'Xem kết quả';
    const nx = VL.session.peek();
    return nx && nx.mode !== 'flash' ? 'Tiếp: ' + VL.modeTitle(nx.mode) : 'Thẻ tiếp theo';
  }

  function feedback(res) {
    const ok = res.ok;
    const d = Math.abs(res.delta || 0);
    const title = ok
      ? 'Đã nhớ · +' + d + '%'
      : 'Chưa nhớ' + (d ? ' · −' + d + '%' : '') + ' · thẻ này sẽ quay lại sớm hơn';
    const from = justAnswered ? res.before : res.after;
    return h`<div class="flash-fb ${ok ? 'is-ok' : 'is-bad'}" role="status">
      <span class="flash-fb-title">${title}</span>
      <span class="flash-fb-row"><span class="flash-fb-track"><span class="flash-fb-bar" data-to="${Math.max(res.after, 3)}" style="${raw('width:' + Math.max(from, 3) + '%')}"></span></span><strong class="flash-fb-text">${res.before + '% → ' + res.after + '%'}</strong></span>
    </div>`;
  }

  const lvTag = (lv, sc) => h`<span class="flash-lv" style="${raw('color:' + LV_VAR[lv.id])}">${lv.label + ' · ' + sc + '%'}</span>`;

  function front(w, lv, sc) {
    return h`<section class="flash-card flash-front" aria-label="Mặt trước thẻ" data-action="flip">
      <div class="flash-front-head">${lvTag(lv, sc)}${w.deckObj ? h`<span class="flash-deck">${w.deckObj.name}</span>` : ''}</div>
      <div class="flash-front-mid">
        ${w.posLabel ? h`<span class="flash-pos">${w.posLabel}</span>` : ''}
        <h1 class="flash-word" lang="en">${w.w}</h1>
        <button type="button" class="flash-say" data-action="speak" data-text="${w.w}" data-accent="" aria-label="${'Nghe phát âm ' + w.w}">${SPEAKER}${w.ipa || 'Nghe'}</button>
      </div>
      <button type="button" class="flash-reveal" data-action="flip" data-focus="reveal" aria-keyshortcuts="Space">${EYE}Lật thẻ xem nghĩa</button>
    </section>`;
  }

  function back(w, key, lv, sc) {
    const exs = exampleList(w);
    const coll = String(w.gram || '').split('\n').map((x) => x.trim()).filter(Boolean);
    const syn = w.syn || [], ant = w.ant || [];
    const ipaBtn = (tag, ipa, accent) => h`<button type="button" class="flash-ipa" data-action="speak" data-text="${w.w}" data-accent="${accent}" aria-label="${'Nghe giọng ' + tag}"><b>${tag}</b>${ipa}</button>`;
    return h`<section class="flash-card flash-back" aria-label="Mặt sau thẻ">
      <div class="flash-back-top">
        <div class="flash-illo">${VL.ui.wordImage(key, 'flash-illo-img')}</div>
        <div class="flash-back-id">
          <div class="flash-tags">${lvTag(lv, sc)}${w.posLabel ? h`<span class="flash-pos-pill">${w.posLabel}</span>` : ''}</div>
          <span class="flash-back-w" lang="en">${w.w}</span>
          <div class="flash-ipas">${ipaBtn('UK', w.ipa, 'uk')}${ipaBtn('US', w.ipaUs, 'us')}</div>
          <span class="flash-vi">${w.vi}</span>
          ${w.def ? h`<span class="flash-def" lang="en">${w.def}</span>` : ''}
          ${enrich[key] === 'loading' ? h`<span class="flash-enrich" role="status"><span class="spinner" aria-hidden="true"></span>Đang bổ sung chi tiết…</span>` : ''}
        </div>
      </div>
      ${exs.length ? h`<div class="flash-sec"><span class="flash-sec-t">Ví dụ</span>
        ${exs.map((e) => h`<div class="flash-ex-box"><span class="flash-ex" lang="en">${e.en}</span>${e.vi ? h`<span class="flash-ex-vi">${e.vi}</span>` : ''}</div>`)}
      </div>` : ''}
      ${coll.length || syn.length || ant.length ? h`<div class="flash-info${coll.length && (syn.length || ant.length) ? ' is-2' : ''}">
        ${coll.length ? h`<div class="flash-sec"><span class="flash-sec-t">Ngữ pháp &amp; collocation</span>
          <div class="flash-chips">${coll.map((c) => h`<span class="flash-chip" lang="en">${c}</span>`)}</div></div>` : ''}
        ${syn.length || ant.length ? h`<div class="flash-sec"><span class="flash-sec-t">${syn.length && ant.length ? 'Đồng nghĩa · Trái nghĩa' : syn.length ? 'Đồng nghĩa' : 'Trái nghĩa'}</span>
          <div class="flash-chips">${syn.map((c) => h`<span class="flash-chip is-syn" lang="en">${c}</span>`)}${ant.map((c) => h`<span class="flash-chip is-ant" lang="en">${c}</span>`)}</div></div>` : ''}
      </div>` : ''}
      ${w.note ? h`<div class="flash-note"><b>Ghi chú</b><span>${w.note}</span></div>` : ''}
      <button type="button" class="flash-unflip" data-action="flip" data-focus="unflip" aria-keyshortcuts="Space">Úp thẻ lại</button>
    </section>`;
  }

  function renderEmpty() {
    return h`<div class="flash flash-empty-wrap">
      ${VL.ui.empty('Chưa có phiên luyện', 'Chọn bộ từ và chế độ ở trang Luyện tập để bắt đầu.', h`<a class="btn btn-primary" href="#/practice">Đến Luyện tập</a>`)}
    </div>`;
  }

  VL.page('flash', {
    nav: null,
    focus: true,
    title: 'Flashcard',
    enter() { flipped = false; shownFor = null; justAnswered = false; busy = false; redirecting = false; mainScroll = 0; },
    render() {
      const s = sess();
      const it = VL.session.item();
      if (!s) return renderEmpty();
      if (s.done || !it || it.mode !== 'flash') {
        // the current item belongs to another screen (or the session is over) → go there
        if (!redirecting) {
          redirecting = true;
          // replace (no new history entry → Back is not trapped); skip if the user already navigated elsewhere
          setTimeout(() => { redirecting = false; const c = VL.current(); if (c && c.name === 'flash') VL.session.go(true); }, 0);
        }
        return h`<div class="flash"></div>`;
      }
      if (!it.word) return renderEmpty(); // word was deleted meanwhile
      syncState(s, it);
      const w = it.word;
      const ans = it.answered;
      const sc = ans ? ans.before : VL.srs.score(it.key);
      const lv = VL.srs.level(sc);
      const total = s.queue.length;
      const step = Math.min(s.idx + 1, total);
      if (flipped) maybeEnrich(it.key); // background; sets the loading line before this render

      return h`<div class="flash">
        <header class="flash-top">
          <button type="button" class="flash-close" data-action="quit" data-focus="quit" aria-label="Thoát phiên luyện">${VL.icon('close', 18, 2.2)}</button>
          <div class="flash-top-mid">
            <div class="flash-top-row"><span>Flashcard</span><span class="flash-count">${VL.session.progressText()}</span></div>
            <div class="flash-prog" role="progressbar" aria-label="Tiến độ phiên" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${step}"><div class="flash-prog-fill" style="${raw('width:' + (step / total * 100) + '%')}"></div></div>
          </div>
        </header>

        <div class="flash-main">
          <div class="flash-wrap">
            ${flipped ? back(w, it.key, lv, sc) : front(w, lv, sc)}
            ${ans ? feedback(ans) : ''}
          </div>
        </div>

        <footer class="flash-bottom">
          ${!ans ? h`<button type="button" class="flash-btn flash-btn-wrong" data-action="wrong" data-focus="wrong" aria-keyshortcuts="1">${X}Chưa nhớ</button>
            <button type="button" class="flash-btn flash-btn-right" data-action="right" data-focus="right" aria-keyshortcuts="2">${CHECK}Đã nhớ</button>`
          : h`<button type="button" class="flash-btn flash-btn-primary" data-action="next" data-focus="next" aria-keyshortcuts="Enter">${nextLabel()}</button>`}
        </footer>
      </div>`;
    },
    mount(root) {
      const main = root.querySelector('.flash-main');
      if (main) {
        main.scrollTop = mainScroll;
        main.addEventListener('scroll', () => { mainScroll = main.scrollTop; }, { passive: true });
      }

      const answer = (ok) => {
        const it = VL.session.item();
        if (!it || it.mode !== 'flash' || it.answered) return;
        VL.session.answer(ok);
        justAnswered = true;
        if (!flipped) { flipped = true; mainScroll = 0; }
        VL.refresh();
        justAnswered = false;
        const nb = root.querySelector('[data-action="next"]');
        if (nb) nb.focus({ preventScroll: true });
        const fb = root.querySelector('.flash-fb');
        if (fb && fb.scrollIntoView) fb.scrollIntoView({ block: 'nearest' });
      };
      const flip = () => { flipped = !flipped; mainScroll = 0; VL.refresh(); };
      const next = () => {
        const it = VL.session.item();
        if (busy || !it || !it.answered) return;
        busy = true;
        VL.session.next();
      };
      const quit = () => {
        VL.ui.confirm({ title: 'Thoát phiên?', body: 'Kết quả các từ bạn đã trả lời vẫn được lưu.', ok: 'Thoát', cancel: 'Ở lại' }).then((yes) => {
          if (!yes) return;
          const s = sess();
          const any = !!(s && s.results.length);
          VL.session.quit();
          VL.go(any ? '#/result' : '#/practice', true);
        });
      };
      const off = VL.ui.delegate(root, {
        flip, next, quit,
        wrong: () => answer(false),
        right: () => answer(true)
      });

      const onKey = (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
        if (document.querySelector('.sheet-backdrop')) return;
        const t = e.target;
        if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
        const it = VL.session.item();
        if (!it || it.mode !== 'flash') return;
        const ans = !!it.answered;
        if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); if (!e.repeat) flip(); }
        else if (e.key === '1' && !ans) { e.preventDefault(); answer(false); }
        else if (e.key === '2' && !ans) { e.preventDefault(); answer(true); }
        else if (e.key === 'Enter') {
          if (ans) { e.preventDefault(); if (!e.repeat) next(); }
          else if (t && t.closest && t.closest('button, a')) return; // let the focused control act
          else if (!flipped) { e.preventDefault(); flip(); }
        }
      };
      document.addEventListener('keydown', onKey);

      // animate the mastery bar from "before" to "after"
      const bar = root.querySelector('.flash-fb-bar');
      let raf = 0;
      if (bar && bar.style.width !== bar.getAttribute('data-to') + '%') {
        raf = requestAnimationFrame(() => { raf = requestAnimationFrame(() => { bar.style.width = bar.getAttribute('data-to') + '%'; }); });
      }
      return () => { off(); document.removeEventListener('keydown', onKey); cancelAnimationFrame(raf); };
    }
  });
})();
