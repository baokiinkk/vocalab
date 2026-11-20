/* VocaLab — #/quiz : multiple-choice / typing practice (Chọn nghĩa, Chọn từ, Điền chỗ trống, Nghe & chọn, Gõ chính tả).
   Design: design/project/Quiz.dc.html. Uses VL.session for the queue and recording. */
(function () {
  'use strict';
  const VL = window.VL;
  const h = VL.html, raw = VL.raw;
  const SS_KEY = 'vocalab.quiz';
  const MC = ['mean', 'word', 'fill', 'listen'];

  // Per-question state, keyed by "<sessionId>:<index>": {opts:[keys], pick:key|'skip'|null, typed:''}.
  // Mirrored to sessionStorage so a browser reload keeps the same option order / chosen option.
  let qs = {};
  try { qs = JSON.parse(sessionStorage.getItem(SS_KEY) || '{}') || {}; } catch (e) { qs = {}; }
  const persist = () => {
    const keys = Object.keys(qs);
    if (keys.length > 40) keys.slice(0, keys.length - 40).forEach((k) => delete qs[k]);
    try { sessionStorage.setItem(SS_KEY, JSON.stringify(qs)); } catch (e) { /* ignore */ }
  };
  const played = {}; // listen mode: auto-play once per question
  const AUTO_MS = 3000; // correct answer → detail card, auto-advance after 3 s
  const deadline = {}; // question id → timestamp of the auto-advance
  const stopped = {};  // question id → true once the auto-advance was cancelled

  const qid = (it) => VL.session.current().id + ':' + it.index;

  /** Build (once) the question state for an item. */
  function question(it) {
    const id = qid(it);
    let q = qs[id];
    if (!q || q.key !== it.key) {
      q = { key: it.key, opts: [], pick: null, typed: '' };
      if (MC.indexOf(it.mode) >= 0) q.opts = VL.shuffle([it.key].concat(VL.distractors(it.key, 3)));
      qs[id] = q;
      persist();
    }
    return q;
  }

  /** First example usable for the fill mode → {before, hit, after, vi}. */
  function blank(w) {
    const exs = w.examples || [];
    for (let i = 0; i < exs.length; i++) {
      const b = VL.blankOut(exs[i].en, w.w);
      if (b) return Object.assign({ vi: exs[i].vi || '' }, b);
    }
    return null;
  }

  const speakIco = raw('<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10v4h4l5 4V6L8 10z"></path><path d="M16 9a4 4 0 0 1 0 6"></path></svg>');
  const closeIco = raw('<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"></path></svg>');

  function promptCard(it, w, lv, lvScore) {
    const tag = h`<span class="quiz-lv" style="${raw('color:' + lv.text)}">${lv.label} · ${lvScore}%</span>`;
    const ipaBtn = h`<button type="button" class="quiz-speak" data-action="speak" data-text="${w.w}" aria-label="${'Nghe phát âm ' + w.w}">${speakIco}${w.ipa || 'Nghe'}</button>`;
    const sayBtn = h`<button type="button" class="quiz-speak" data-action="play" aria-label="Nghe phát âm">${speakIco}Nghe</button>`;
    let body;
    if (it.mode === 'mean') {
      body = h`<span class="quiz-prompt">Từ này nghĩa là gì?</span><h1 class="quiz-word">${w.w}</h1>${ipaBtn}`;
    } else if (it.mode === 'word') {
      body = h`<span class="quiz-prompt">Từ nào có nghĩa là…?</span><h1 class="quiz-word quiz-word-vi">${w.vi}</h1>`;
    } else if (it.mode === 'fill') {
      const b = blank(w);
      body = h`<span class="quiz-prompt">Điền từ vào chỗ trống</span>
        <h1 class="quiz-sent">${b ? h`${b.before}<span class="quiz-blank" aria-label="chỗ trống">_____</span>${b.after}` : w.vi}</h1>
        ${b && b.vi ? h`<span class="quiz-sent-vi">${b.vi}</span>` : ''}`;
    } else if (it.mode === 'listen') {
      body = h`<span class="quiz-prompt">Nghe và chọn từ đúng</span>
        <h1 class="sr-only">Nghe và chọn từ đúng</h1>
        <button type="button" class="quiz-play" data-action="play" aria-label="Nghe lại">${VL.icon('speaker', 40)}</button>
        <span class="quiz-play-hint">Bấm để nghe lại</span>`;
    } else {
      body = h`<span class="quiz-prompt">Gõ lại từ bạn nghe / có nghĩa là…</span><h1 class="quiz-word quiz-word-vi">${w.vi}</h1>${sayBtn}`;
    }
    return h`<section class="quiz-card">${tag}${body}</section>`;
  }

  function options(it, q, res) {
    const answered = !!res;
    return h`<div role="group" aria-label="Các đáp án" class="quiz-opts">${q.opts.map((k, j) => {
      const o = VL.words.get(k);
      if (!o) return '';
      const isAns = k === it.key, isPick = k === q.pick;
      const state = !answered ? 'idle' : isAns ? 'right' : isPick && !res.ok ? 'wrong' : 'dim';
      const text = it.mode === 'mean' ? o.vi : o.w;
      return h`<button type="button" class="quiz-opt is-${state}" data-action="pick" data-key="${k}" data-n="${j + 1}"${answered ? raw(' disabled') : ''}>
        <span class="quiz-badge">${'ABCD'[j]}</span>
        <span class="quiz-opt-text">${text}</span>
        <span class="quiz-verdict">${state === 'right' ? '✓ Đúng' : state === 'wrong' ? '✕ Sai' : ''}</span>
      </button>`;
    })}</div>`;
  }

  function typing(it, w, q, res) {
    if (!res) {
      return h`<form class="quiz-type" data-form="type" autocomplete="off">
        <label class="sr-only" for="quiz-input">Gõ từ tiếng Anh</label>
        <input id="quiz-input" class="input quiz-input" type="text" value="${q.typed}" placeholder="Gõ từ tiếng Anh…" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done">
        <button type="submit" class="btn btn-primary quiz-check">Kiểm tra</button>
      </form>`;
    }
    const st = res.ok ? 'right' : 'wrong';
    return h`<div class="quiz-opt quiz-typed is-${st}" role="group" aria-label="Câu trả lời của bạn">
      <span class="quiz-opt-text">${q.typed || (q.pick === 'skip' ? 'Tôi không biết' : '—')}</span>
      <span class="quiz-verdict">${res.ok ? '✓ Đúng' : '✕ Sai'}</span>
    </div>`;
  }

  function feedback(it, w, res) {
    const ok = res.ok;
    const pen = VL.store.settings().pen || 20;
    const ex = (w.examples || [])[0];
    const pct = Math.max(res.after, 3);
    const showAns = !ok && (it.mode === 'type' || it.mode === 'listen' || it.mode === 'fill');
    return h`<div role="status" class="quiz-fb ${ok ? 'is-right' : 'is-wrong'}">
      ${it.mode === 'mean' ? VL.ui.wordImage(it.key, 'quiz-img hide-empty') : ''}
      <span class="quiz-fb-title">${ok ? 'Chính xác · +10%' : 'Chưa đúng · −' + pen + '% · từ này sẽ xuất hiện nhiều hơn'}</span>
      ${showAns || it.mode === 'type' ? h`<span class="quiz-fb-ans">Đáp án: <strong>${w.w}</strong>${w.ipa ? h` <span class="quiz-fb-ipa">${w.ipa}</span>` : ''} · ${w.vi}</span>` : ''}
      <span class="quiz-fb-bar"><span class="quiz-fb-track"><span class="quiz-fb-fill" style="${raw('width:' + pct + '%')}"></span></span><strong>${res.before}% → ${res.after}%</strong></span>
      ${ex && ex.en ? h`<span class="quiz-fb-ex">“${ex.en}”</span>` : ''}
    </div>`;
  }

  const label = (t) => h`<span class="quiz-dt-label">${t}</span>`;
  /** Extra info shown after "Xem chi tiết" (like the flashcard back). */
  function more(w, key) {
    const exs = (w.examples || []).filter((e) => e.en).slice(1); // the first one is already on the card
    const coll = String(w.gram || '').split('\n').map((x) => x.trim()).filter(Boolean);
    const syn = w.syn || [], ant = w.ant || [];
    return h`<div class="quiz-more" id="quiz-more">
      ${w.def ? h`<span class="quiz-def">${w.def}</span>` : ''}
      ${exs.length ? h`<div class="quiz-dt-sec">${label('Ví dụ khác')}${exs.map((e) => h`<div class="quiz-dt-ex2"><span>${e.en}</span>${e.vi ? h`<span class="muted">${e.vi}</span>` : ''}</div>`)}</div>` : ''}
      ${coll.length || syn.length || ant.length ? h`<div class="quiz-dt-grid">
        ${coll.length ? h`<div class="quiz-dt-sec">${label('Ngữ pháp & collocation')}<div class="quiz-tags">${coll.map((c) => h`<span class="quiz-tag">${c}</span>`)}</div></div>` : ''}
        ${syn.length || ant.length ? h`<div class="quiz-dt-sec">${label('Đồng nghĩa · Trái nghĩa')}<div class="quiz-tags">${syn.map((c) => h`<span class="quiz-tag is-syn">${c}</span>`)}${ant.map((c) => h`<span class="quiz-tag is-ant">${c}</span>`)}</div></div>` : ''}
      </div>` : ''}
      ${w.note ? h`<div class="quiz-note"><b>Ghi chú</b><span>${w.note}</span></div>` : ''}
      <a class="quiz-dt-link" href="${VL.href.word(key)}">Mở trang chi tiết từ</a>
    </div>`;
  }

  /** Correct answer → detail card with a 3 s countdown (design: Quiz.dc.html, demoDetail). */
  function detailCard(it, w, q, res, id) {
    const auto = !stopped[id] && !q.hold;
    const left = auto ? Math.max(0, (deadline[id] || Date.now() + AUTO_MS) - Date.now()) : 0;
    const ex = (w.examples || [])[0];
    const last = it.index === it.total - 1;
    return h`<section class="quiz-detail" aria-label="Chi tiết từ vừa trả lời đúng">
      <div class="quiz-cd">${auto ? h`<div class="quiz-cd-fill" style="${raw('animation-duration:' + AUTO_MS + 'ms;animation-delay:-' + (AUTO_MS - left) + 'ms')}"></div>` : ''}</div>
      <div class="quiz-illo">${VL.ui.wordImage(it.key, 'quiz-illo-img')}</div>
      <div class="quiz-dt-body">
        <span class="quiz-dt-tag" role="status">✓ Chính xác · +10% · ${res.before}% → ${res.after}%</span>
        <div class="quiz-dt-head"><h1 class="quiz-dt-word">${w.w}</h1>${w.ipa ? h`<span class="quiz-dt-ipa">${w.ipa}</span>` : ''}${VL.ui.speakBtn(w.w)}</div>
        <span class="quiz-dt-vi">${w.vi}</span>
        ${ex && ex.en ? h`<span class="quiz-dt-ex">${ex.en}${q.hold && ex.vi ? h`<span class="quiz-dt-ex-vi">${ex.vi}</span>` : ''}</span>` : ''}
        ${q.hold ? more(w, it.key) : ''}
        <div class="quiz-dt-actions">
          ${q.hold ? '' : h`<button type="button" class="quiz-dt-more" data-action="more">Xem chi tiết</button>`}
          <button type="button" class="quiz-dt-next" data-action="next" id="quiz-next">${last ? 'Xem kết quả' : 'Tiếp ngay'}</button>
        </div>
        ${auto ? h`<span class="quiz-dt-note">Tự chuyển câu sau 3 giây</span>` : ''}
      </div>
    </section>`;
  }

  function emptyView() {
    return h`<div class="page"><div class="page-inner">${VL.ui.empty('Chưa có phiên luyện tập', 'Chọn bộ từ và chế độ luyện để bắt đầu.', h`<a class="btn btn-primary" href="#/practice">Đến Luyện tập</a>`)}</div></div>`;
  }

  /** Item to show, or null (with redirect decision). */
  function currentItem() {
    const s = VL.session.current();
    if (!s) return { redirect: false };
    const it = VL.session.item();
    if (!it || it.mode === 'flash' || s.done) return { redirect: true };
    if (!it.word) return { redirect: false };
    return { it };
  }

  VL.page('quiz', {
    nav: null,
    focus: true,
    title: () => { const it = VL.session.item(); return it && it.mode !== 'flash' ? VL.modeTitle(it.mode) : 'Luyện tập'; },
    enter() { /* question state is kept per session item; nothing to reset */ },
    render() {
      const cur = currentItem();
      if (!cur.it) return cur.redirect ? h`<div class="empty"><strong>Đang chuyển…</strong></div>` : emptyView();
      const it = cur.it, w = it.word, res = it.answered;
      const q = question(it);
      const s = VL.session.current();
      const step = it.index + 1;
      const lvScore = res ? res.before : VL.srs.score(it.key);
      const lv = VL.srs.level(lvScore);
      const last = it.index === it.total - 1;
      return h`<div class="quiz quiz-mode-${it.mode}">
        <header class="quiz-top">
          <button type="button" class="quiz-close" data-action="quit" aria-label="Thoát phiên luyện">${closeIco}</button>
          <div class="quiz-top-mid">
            <div class="quiz-top-row"><span>${VL.modeTitle(it.mode)}</span><span class="quiz-count">${VL.session.progressText()}</span></div>
            <div class="quiz-prog" role="progressbar" aria-label="Tiến độ phiên" aria-valuemin="0" aria-valuemax="${s.queue.length}" aria-valuenow="${step}"><div class="quiz-prog-fill" style="${raw('width:' + (step / s.queue.length * 100) + '%')}"></div></div>
          </div>
        </header>
        <div class="quiz-main"><div class="quiz-inner">
          ${res && res.ok ? detailCard(it, w, q, res, qid(it)) : h`
          ${promptCard(it, w, lv, lvScore)}
          ${it.mode === 'type' ? typing(it, w, q, res) : options(it, q, res)}
          ${res ? feedback(it, w, res) : ''}`}
        </div></div>
        <footer class="quiz-bottom">
          ${!res ? h`<button type="button" class="quiz-skip" data-action="skip">Tôi không biết</button>` : ''}
          ${res && !res.ok ? h`<button type="button" class="quiz-next" data-action="next" id="quiz-next">${last ? 'Xem kết quả' : 'Câu tiếp theo'}</button>` : ''}
        </footer>
      </div>`;
    },
    mount(root) {
      const cur = currentItem();
      if (!cur.it) {
        if (cur.redirect) { const t = setTimeout(() => VL.session.go(true), 0); return () => clearTimeout(t); }
        return;
      }
      const it = cur.it;
      const id = qid(it);
      const q = question(it);
      let busy = false;
      let timer = null;
      const stopAuto = () => { stopped[id] = true; if (timer) { clearTimeout(timer); timer = null; } };
      const live = () => { const n = VL.session.item(); return n && VL.session.current().id + ':' + n.index === id ? n : null; };

      const answer = (ok, pick, typed) => {
        const n = live();
        if (!n || n.answered) return;
        q.pick = pick;
        if (typed != null) q.typed = typed;
        persist();
        const r = VL.session.answer(ok);
        if (r && r.ok) deadline[id] = Date.now() + AUTO_MS;
        VL.refresh();
        const nb = document.getElementById('quiz-next');
        if (nb) nb.focus({ preventScroll: true });
      };
      const next = () => {
        const n = live();
        if (!n || !n.answered || busy) return;
        busy = true;
        stopAuto();
        VL.session.next();
      };
      const check = () => {
        const inp = root.querySelector('#quiz-input');
        const val = inp ? inp.value : '';
        if (!VL.norm(val)) { VL.ui.toast('Hãy gõ từ trước khi kiểm tra'); if (inp) inp.focus(); return; }
        answer(VL.norm(val) === VL.norm(it.word.w), null, val.trim());
      };
      const play = () => VL.media.speak(it.word.w);
      const quit = () => {
        const wasAuto = timer != null;
        stopAuto();
        VL.ui.confirm({ title: 'Thoát phiên luyện?', body: 'Kết quả các câu đã trả lời vẫn được lưu.', ok: 'Thoát', cancel: 'Tiếp tục học' }).then((yes) => {
          if (!yes) { if (wasAuto) { delete stopped[id]; deadline[id] = Date.now() + AUTO_MS; } VL.refresh(); return; }
          const s = VL.session.current();
          const any = !!(s && s.results.length);
          VL.session.quit();
          VL.go(any ? '#/result' : '#/practice', true);
        });
      };

      const off = VL.ui.delegate(root, {
        pick: (el) => { const k = el.getAttribute('data-key'); answer(k === it.key, k); },
        skip: () => answer(false, 'skip', it.mode === 'type' ? '' : null),
        next, play, quit,
        more: () => { stopAuto(); q.hold = true; persist(); VL.refresh(); const m = document.getElementById('quiz-more'); if (m) m.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
      });
      const form = root.querySelector('[data-form="type"]');
      const onSubmit = (e) => { e.preventDefault(); check(); };
      const inp = root.querySelector('#quiz-input');
      const onInput = () => { q.typed = inp.value; };
      if (form) form.addEventListener('submit', onSubmit);
      if (inp) inp.addEventListener('input', onInput);

      const onKey = (e) => {
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
        if (document.querySelector('.sheet-backdrop')) return;
        const tag = e.target && e.target.tagName;
        const inField = tag === 'INPUT' || tag === 'TEXTAREA';
        const n = live();
        if (!n) return;
        if (e.key === 'Enter') {
          if (inField || tag === 'BUTTON' || tag === 'A') return; // native submit / click handles it
          if (n.answered) { e.preventDefault(); next(); }
          return;
        }
        if (inField || n.answered || it.mode === 'type') return;
        const d = parseInt(e.key, 10);
        if (d >= 1 && d <= q.opts.length) {
          e.preventDefault();
          const k = q.opts[d - 1];
          answer(k === it.key, k);
        }
      };
      document.addEventListener('keydown', onKey);

      let t = null;
      if (it.answered && it.answered.ok && !stopped[id] && !q.hold) {
        if (!deadline[id]) deadline[id] = Date.now() + AUTO_MS; // e.g. after a reload
        timer = setTimeout(() => { timer = null; next(); }, Math.max(0, deadline[id] - Date.now()));
      }
      if (it.mode === 'listen' && !it.answered && !played[id]) { played[id] = true; t = setTimeout(play, 250); }
      if (it.mode === 'type' && !it.answered && inp && document.activeElement !== inp && VL.device() === 'laptop') inp.focus({ preventScroll: true });

      return () => {
        off();
        document.removeEventListener('keydown', onKey);
        if (form) form.removeEventListener('submit', onSubmit);
        if (inp) inp.removeEventListener('input', onInput);
        if (t) clearTimeout(t);
        if (timer) clearTimeout(timer);
      };
    }
  });
})();
