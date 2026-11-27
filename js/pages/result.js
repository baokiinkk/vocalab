/* VocaLab — 9 · Kết quả phiên (#/result). Focus screen (no navigation).
   Shows the last finished session (VL.session.last()), or — when a session is still running — a partial summary
   of the answers so far with "Tiếp tục phiên". Per-answer list with Tất cả / Sai filter; each row links to the word. */
(function () {
  'use strict';
  const VL = window.VL;
  const h = VL.html, raw = VL.raw;
  let filter = 'all';

  const st = () => VL.store.state;
  const signed = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n);

  /** Which summary to show: {r, partial}. */
  function current() {
    const s = st().session;
    if (s && !s.done) return { r: VL.session.summary(s), partial: true };
    const r = VL.session.last();
    return { r, partial: false };
  }

  function titleFor(r, partial) {
    if (partial) return 'Phiên đang dở';
    if (r.total && r.pct < 50) return 'Cố lên, ôn lại sẽ nhớ hơn!';
    if (r.preset === 'today') return 'Xong phiên hôm nay!';
    return 'Xong phiên luyện!';
  }

  const closeBtn = () => h`<div class="result-top"><a href="#/today" class="result-close" data-action="home" aria-label="Đóng">${VL.icon('close', 18, 2.2)}</a></div>`;

  function renderEmpty() {
    return h`<div class="result-root">
      <div class="result-main"><div class="result-col">
        ${closeBtn()}
        <section class="result-hero">
          <h1 class="result-h1">Chưa có phiên nào</h1>
          <p class="result-sub">Hoàn thành một phiên luyện tập để xem kết quả tại đây.</p>
          <div class="result-empty-actions">
            <a href="#/practice" class="btn btn-primary">Bắt đầu luyện tập</a>
            <a href="#/today" class="btn btn-outline">Về trang chủ</a>
          </div>
        </section>
      </div></div>
    </div>`;
  }

  function row(res) {
    const w = VL.words.get(res.key);
    const word = w ? w.w : String(res.key).replace(/^[^:]*:/, '');
    const d = res.after - res.before;
    const range = res.before + '% → ' + res.after + '%' + (res.after >= 100 ? ' · thành thạo' : '');
    return h`<li><a href="${VL.href.word(res.key)}" class="result-row ${res.ok ? 'is-ok' : 'is-wrong'}">
      <span class="result-mark" aria-label="${res.ok ? 'Đúng' : 'Sai'}">${res.ok ? '✓' : '✕'}</span>
      <span class="result-word"><strong>${word}</strong><span>${VL.modeTitle(res.mode)}</span></span>
      <span class="result-change"><span class="result-delta">${(d >= 0 ? '+' : '−') + Math.abs(d) + '%'}</span><span class="result-range">${range}</span></span>
    </a></li>`;
  }

  // Static decorative / icon SVGs from design-v3/project/Result.dc.html (trusted constants).
  const DECOR = raw('<svg class="result-decor" aria-hidden="true" viewBox="0 0 320 60" preserveAspectRatio="xMidYMid meet"><path d="M44 18l3 9 9 3-9 3-3 9-3-9-9-3 9-3z" class="d1"/><path d="M276 30l2.5 7 7 2.5-7 2.5-2.5 7-2.5-7-7-2.5 7-2.5z" class="d2"/><circle cx="250" cy="12" r="4" class="d3"/><circle cx="74" cy="48" r="3" class="d4"/></svg>');
  const I_TIME = raw('<svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/></svg>');
  const I_CHART = raw('<svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V5M4 19h16M8 15l4-4 3 3 5-6"/></svg>');
  const I_STAR = raw('<svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z"/></svg>');
  const I_LIST = raw('<svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>');

  function render() {
    const { r, partial } = current();
    if (!r) return renderEmpty();
    const results = r.results || [];
    const wrongN = results.filter((x) => !x.ok).length;
    const list = filter === 'wrong' ? results.filter((x) => !x.ok) : results;
    const pct = r.pct || 0;
    const showStreak = VL.store.settings().sw.streak;
    const avg = r.avgBefore != null ? r.avgBefore + '→' + r.avgAfter + '%' : r.avgAfter + '%';
    const nWrongWords = (r.wrongKeys || []).length;
    const tab = (id, label) => h`<button type="button" role="tab" class="result-tab${filter === id ? ' is-on' : ''}" aria-selected="${String(filter === id)}" data-action="filter" data-value="${id}">${label}</button>`;
    const stat = (cls, icon, v, l) => h`<div class="result-stat ${cls}"><span class="result-stat-ico">${icon}</span><span class="result-stat-txt"><b class="result-stat-v${v.length > 7 ? ' is-long' : ''}">${v}</b><span class="result-stat-l">${l}</span></span></div>`;
    let primary;
    if (partial) primary = h`<button type="button" class="result-btn result-btn-primary" data-action="resume">Tiếp tục phiên</button>`;
    else if (nWrongWords) primary = h`<button type="button" class="result-btn result-btn-primary" data-action="retry">Ôn lại ${nWrongWords} từ sai</button>`;
    else primary = h`<a href="#/practice" class="result-btn result-btn-primary">Luyện tiếp</a>`;

    return h`<div class="result-root">
      <div class="result-main"><div class="result-col">
        ${closeBtn()}
        <section class="result-hero">
          <span class="result-tape" aria-hidden="true"></span>
          ${DECOR}
          <div class="result-ring" role="img" aria-label="${'Đúng ' + r.right + ' trên ' + r.total + ' câu, ' + pct + '%'}" style="${raw('--p:' + pct + '%')}">
            <div class="result-ring-in"><span class="result-pct">${pct}%</span><span class="result-frac">${r.right}/${r.total} đúng</span></div>
          </div>
          <h1 class="result-h1">${titleFor(r, partial)}</h1>
          ${partial ? h`<p class="result-sub">Đã trả lời ${r.total} / ${st().session.queue.length} câu.</p>` : ''}
          ${showStreak ? h`<span class="result-streak">${VL.icon('flame', 15)}<span>Chuỗi ${r.streak} ngày · giữ lửa nhé</span></span>` : ''}
        </section>

        <div class="result-stats">
          ${stat('is-lilac', I_TIME, (r.minutes || 0) + ' phút', 'thời gian học')}
          ${stat('is-butter', I_CHART, avg, 'thông thạo TB')}
          ${stat('is-pink', I_STAR, signed(r.masteredGain || 0) + ' từ', 'đạt 100%')}
        </div>

        <section class="result-card result-list" aria-labelledby="result-list-h">
          <div class="result-list-head">
            <span class="result-list-title"><span class="result-list-ico">${I_LIST}</span><h2 id="result-list-h" class="result-h2">Thay đổi từng từ</h2></span>
            <div class="result-tabs" role="tablist" aria-label="Lọc kết quả">${tab('all', 'Tất cả · ' + results.length)}${tab('wrong', 'Sai · ' + wrongN)}</div>
          </div>
          ${list.length ? h`<ul class="list-plain result-rows">${list.map(row)}</ul>`
            : h`<p class="muted result-none">${results.length ? 'Không có câu sai — tuyệt vời!' : 'Chưa trả lời câu nào.'}</p>`}
        </section>
      </div></div>
      <footer class="result-foot">
        <a href="#/today" class="result-btn result-btn-outline" data-action="home">Về trang chủ</a>
        ${primary}
      </footer>
    </div>`;
  }

  VL.page('result', {
    nav: null,
    focus: true,
    title: 'Kết quả phiên',
    enter() {
      filter = 'all';
      // a session whose queue is exhausted but never closed → close it now
      const s = st().session;
      if (s && !s.done && s.idx >= s.queue.length) VL.session.finish();
    },
    render,
    mount(root) {
      return VL.ui.delegate(root, {
        filter(el) { filter = el.getAttribute('data-value'); VL.refresh(); },
        home() {
          const s = st().session;
          if (s && s.done) { st().session = null; VL.store.save(); }
          // the <a href="#/today"> performs the navigation
        },
        retry() {
          if (!VL.session.retryWrong()) VL.ui.toast('Không có từ sai để ôn lại.');
        },
        resume() { VL.session.go(); }
      });
    }
  });
})();
