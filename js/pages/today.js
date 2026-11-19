/* VocaLab — "Hôm nay" (dashboard). Design: design/project/Main.dc.html */
(function () {
  'use strict';
  const VL = window.VL;
  const h = VL.html, raw = VL.raw;

  let notice = null; // {kind:'today'|'weak'} inline message when a session could not be started

  const LEGEND = [
    ['weak', 'Yếu', 'var(--weak)'],
    ['learning', 'Đang học', 'var(--learning)'],
    ['good', 'Khá', 'var(--good)'],
    ['master', 'Thành thạo', 'var(--master)']
  ];

  /** Started library words that need attention (below "Khá"), lowest score first. */
  function attentionWords() {
    const now = Date.now();
    return VL.words.library()
      .filter(VL.srs.isStarted)
      .map((k) => ({ key: k, score: VL.srs.score(k, now) }))
      .filter((x) => x.score < 70 && VL.words.get(x.key))
      .sort((a, b) => a.score - b.score)
      .slice(0, 3);
  }

  function running() {
    const s = VL.session.current();
    return s && !s.done && s.idx < s.queue.length ? s : null;
  }

  function todayCard() {
    const p = VL.srs.todayPlan();
    // Today's total = words still planned + answers already given (never above the daily target),
    // so "done" always equals total − Cần ôn and the bar fills as the plan shrinks.
    const total = Math.min(p.target, p.plan + p.done);
    const done = total - p.plan;
    const pct = total ? Math.round((done / total) * 100) : (p.done ? 100 : 0);
    const finished = p.plan === 0;
    const run = running();
    const libEmpty = !VL.words.library().length;
    const minutes = p.plan ? p.minutes : 0;

    let sub = null;
    if (finished) {
      sub = p.done
        ? h`<p class="today-msg"><strong>Xong phần hôm nay rồi!</strong> Bạn đã ôn ${p.done} lượt. Muốn ôn thêm thì bấm bên dưới.</p>`
        : libEmpty
          ? h`<p class="today-msg"><strong>Chưa có từ nào để ôn.</strong> Thêm từ mới hoặc chọn một bộ từ trong <a href="#/library">thư viện</a>.</p>`
          : h`<p class="today-msg"><strong>Hôm nay không có từ đến hạn.</strong> Nghỉ ngơi, hoặc ôn thêm vài từ nếu muốn.</p>`;
    }
    const warn = notice && notice.kind === 'today'
      ? h`<p class="today-notice" role="alert">Chưa có từ nào để ôn. <a href="#/library">Chọn bộ từ trong thư viện</a> hoặc <a href="#/add">thêm từ mới</a>.</p>` : '';

    const btn = run
      ? h`<button type="button" class="btn btn-primary btn-lg btn-block" data-action="continue">${VL.icon('play', 16, 'fill')} Tiếp tục phiên <span class="today-btn-sub">${VL.session.progressText()}</span></button>`
      : h`<button type="button" class="btn btn-primary btn-lg btn-block" data-action="start">${VL.icon('play', 16, 'fill')} ${finished && !libEmpty ? 'Ôn thêm' : 'Bắt đầu ôn'}</button>`;

    return h`<section class="card today-card" aria-labelledby="h-today">
      <div class="card-head">
        <h2 id="h-today" class="h2">Phiên hôm nay</h2>
        <span class="today-count">${done} / ${total} từ</span>
      </div>
      ${sub}
      <div class="today-stats">
        <div class="today-stat"><span class="today-stat-n">${p.plan}</span><span class="today-stat-l">Cần ôn</span></div>
        <div class="today-stat"><span class="today-stat-n">${p.weak.length}</span><span class="today-stat-l">Từ yếu</span></div>
        <div class="today-stat"><span class="today-stat-n">~${minutes}′</span><span class="today-stat-l">Thời gian</span></div>
      </div>
      <div class="today-progress" role="progressbar" aria-label="Tiến độ hôm nay" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done}"><div class="today-progress-fill" style="${raw('width:' + Math.max(2, pct) + '%')}"></div></div>
      ${warn}
      ${btn}
    </section>`;
  }

  function masteryCard() {
    const ov = VL.srs.overview();
    const d = ov.weekDelta;
    const delta = d == null ? '' : h`<span class="today-delta ${d > 0 ? 'is-up' : d < 0 ? 'is-down' : 'is-flat'}">${(d > 0 ? '+' : d < 0 ? '−' : '+') + Math.abs(d)}% tuần này</span>`;
    return h`<section class="card" aria-labelledby="h-mastery">
      <div class="card-head">
        <h2 id="h-mastery" class="h2">Thông thạo</h2>
        <span class="muted small">${ov.total} từ</span>
      </div>
      <div class="today-avg"><span class="today-avg-n">${ov.avg}%</span>${delta}</div>
      ${VL.ui.masteryBar(ov.buckets)}
      <div class="today-legend">
        ${LEGEND.map(([id, label, c]) => h`<div class="today-legend-row"><span class="dot" style="${raw('background:' + c)}"></span><span class="today-legend-l">${label}</span><strong>${ov.buckets[id]}</strong></div>`)}
      </div>
    </section>`;
  }

  function addCard() {
    return h`<section class="card" aria-labelledby="h-add">
      <h2 id="h-add" class="h2">Thêm từ nhanh</h2>
      <form class="today-add" data-form="quick-add" novalidate>
        <label class="today-add-field"><span class="sr-only">Từ mới</span>
          <input id="today-add-q" class="input" type="text" name="q" placeholder="Gõ một từ…" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="go">
        </label>
        <button type="submit" class="btn btn-primary today-add-btn" aria-label="Thêm từ">Thêm</button>
      </form>
      <span class="muted small">Tự nhập nghĩa, ví dụ. Cần thì bấm “Gợi ý bằng AI”.</span>
    </section>`;
  }

  function weakCard() {
    const list = attentionWords();
    const warn = notice && notice.kind === 'weak'
      ? h`<p class="today-notice" role="alert">Chưa có từ yếu để ôn. <a href="#/practice">Chọn bài luyện khác</a>.</p>` : '';
    return h`<section class="card" aria-labelledby="h-weak">
      <div class="card-head">
        <h2 id="h-weak" class="h2">Từ cần chú ý</h2>
        <button type="button" class="card-link today-linkbtn" data-action="weak">Ôn ngay</button>
      </div>
      ${warn}
      ${list.length ? h`<ul class="list-plain today-weak">
        ${list.map((x) => { const w = VL.words.get(x.key); return h`<li><a class="today-weak-row" href="${VL.href.word(x.key)}">
          ${VL.ui.ring(x.score, 44)}
          <span class="today-weak-text"><span class="today-weak-w">${w.w}</span><span class="today-weak-vi">${w.vi}</span></span>
        </a></li>`; })}
      </ul>` : h`<div class="today-empty"><strong>Không có từ yếu</strong><span>${VL.words.library().some(VL.srs.isStarted) ? 'Các từ bạn đang học đều ở mức khá trở lên. Tuyệt vời!' : 'Bắt đầu ôn để xem những từ cần chú ý ở đây.'}</span></div>`}
    </section>`;
  }

  function decksCard() {
    const ids = VL.decks.mineIds();
    return h`<section class="card today-decks" aria-labelledby="h-decks">
      <div class="card-head">
        <h2 id="h-decks" class="h2">Bộ đang học</h2>
        <a href="#/library" class="card-link">Xem thư viện</a>
      </div>
      <ul class="list-plain today-deck-row">
        ${ids.map((id) => {
          const d = VL.decks.get(id);
          if (!d) return '';
          const pct = VL.decks.stats(id).pct;
          const color = id === 'mine' ? 'var(--ink)' : d.fg;
          return h`<li><a class="today-deck" href="${VL.href.deck(id)}">
            ${VL.ui.deckIcon(d, 40)}
            <span class="today-deck-mid"><span class="today-deck-name">${d.name}</span>
              <span class="today-deck-track" role="progressbar" aria-label="${'Thông thạo ' + d.name}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span class="today-deck-fill" style="${raw('width:' + pct + '%;background:' + color)}"></span></span></span>
            <span class="today-deck-pct">${pct}%</span>
          </a></li>`;
        })}
      </ul>
    </section>`;
  }

  VL.page('today', {
    nav: 'main',
    title: 'Hôm nay',
    enter() { notice = null; },
    render() {
      const showStreak = VL.store.settings().sw.streak;
      return h`<div class="page"><div class="page-inner">
        <header class="page-head">
          <div class="page-head-text">
            <span class="eyebrow">${VL.fmtToday()}</span>
            <h1 class="h1">${VL.greeting()}</h1>
          </div>
          ${showStreak ? h`<span class="today-streak">${VL.icon('flame', 16)} Chuỗi ${VL.srs.streak()} ngày</span>` : ''}
        </header>
        <div class="today-grid">
          ${todayCard()}
          ${masteryCard()}
          ${addCard()}
          ${weakCard()}
          ${decksCard()}
        </div>
      </div></div>`;
    },
    mount(root) {
      const off = VL.ui.delegate(root, {
        start() {
          notice = null;
          if (!VL.session.start({ preset: 'today' })) {
            notice = { kind: 'today' };
            VL.ui.toast('Chưa có từ nào để ôn. Hãy thêm từ hoặc chọn bộ từ.');
            VL.refresh();
          }
        },
        continue() { VL.session.go(); },
        weak() {
          notice = null;
          if (!VL.session.start({ preset: 'weak' })) {
            notice = { kind: 'weak' };
            VL.ui.toast('Chưa có từ yếu để ôn.');
            VL.refresh();
          }
        }
      });
      const form = root.querySelector('[data-form="quick-add"]');
      const onSubmit = (e) => {
        e.preventDefault();
        const q = form.querySelector('input').value.trim();
        VL.go(q ? VL.href.add({ q }) : '#/add');
      };
      form.addEventListener('submit', onSubmit);
      return () => { off(); form.removeEventListener('submit', onSubmit); };
    }
  });
})();
