/* VocaLab — "Hôm nay" (dashboard). Design: design-v3/project/Main.dc.html
   Head card: greeting + streak, "Kế hoạch" (3 live steps: weak words → due words → new words) and the
   mastery tile (ring = average mastery, mastered / library words, words due).
   "Hôm nay học gì?": 6 pastel tiles (Ôn tập, Từ vựng, Thêm từ, Flashcard, Chọn nghĩa, Bộ có sẵn). */
(function () {
  'use strict';
  const VL = window.VL;
  const h = VL.html, raw = VL.raw;

  const WEAK_N = 15;   // = VL.PRESETS weak.count
  const FLASH_N = 10;  // = VL.PRESETS quick.count (flashcards only)
  const QUIZ_N = 8;    // "Chọn nghĩa" quick round

  const CHECK = raw('<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l2 2 4-4"></path><rect x="4" y="4" width="16" height="16" rx="3"></rect></svg>');
  const FLAME = raw('<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c1 4 5 5.5 5 11a5 5 0 0 1-10 0c0-2.5 1.2-4 2.5-5 .2 1.8 1 3 2.5 3.5C11 8.5 11 5 12 2z"></path></svg>');
  const ART = {
    peach: '<circle cx="104" cy="60" r="38" fill="#FFC9B0"></circle><path d="M30 28l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill="#FFFDF8"></path><rect x="44" y="34" width="62" height="46" rx="7" fill="#FFFDF8" stroke="#2E2A24" stroke-width="2.5" transform="rotate(-9 75 57)"></rect><rect x="62" y="28" width="62" height="46" rx="7" fill="#FFFDF8" stroke="#2E2A24" stroke-width="2.5"></rect><path d="M74 44h36M74 56h24" stroke="#CF4822" stroke-width="4.5" stroke-linecap="round"></path>',
    lilac: '<circle cx="104" cy="60" r="38" fill="#D3C7FA"></circle><path d="M30 30l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill="#FFFDF8"></path><rect x="56" y="28" width="56" height="58" rx="6" fill="#FFFDF8" stroke="#2E2A24" stroke-width="2.5" transform="rotate(-10 84 57)"></rect><rect x="70" y="26" width="56" height="58" rx="6" fill="#FFFDF8" stroke="#2E2A24" stroke-width="2.5"></rect><path d="M80 42h34M80 52h26M80 62h30" stroke="#6A4FD8" stroke-width="4" stroke-linecap="round"></path><circle cx="116" cy="76" r="7" fill="#FFD66B" stroke="#2E2A24" stroke-width="2"></circle>',
    butter: '<circle cx="104" cy="60" r="38" fill="#FFE08A"></circle><path d="M30 30l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill="#FFFDF8"></path><rect x="48" y="30" width="70" height="52" rx="7" fill="#FFFDF8" stroke="#2E2A24" stroke-width="2.5"></rect><path d="M60 46h34M60 58h24" stroke="#D9CFBB" stroke-width="4" stroke-linecap="round"></path><path d="M100 72l26-26 8 8-26 26-11 3z" fill="#FF8C69" stroke="#2E2A24" stroke-width="2.5" stroke-linejoin="round"></path>',
    mint: '<circle cx="104" cy="60" r="38" fill="#B7E2C6"></circle><path d="M30 30l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill="#FFFDF8"></path><rect x="58" y="22" width="52" height="66" rx="8" fill="#FFFDF8" stroke="#2E2A24" stroke-width="2.5"></rect><text x="84" y="62" text-anchor="middle" font-size="22" font-weight="800" fill="#2F7A4F" font-family="Be Vietnam Pro, sans-serif">Aa</text><path d="M116 40c8 6 8 18 0 24" fill="none" stroke="#2E2A24" stroke-width="2.5" stroke-linecap="round"></path><path d="M112 62l4 3 4-4" fill="none" stroke="#2E2A24" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path>',
    pink: '<circle cx="104" cy="60" r="38" fill="#F7BFCD"></circle><path d="M30 30l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill="#FFFDF8"></path><rect x="52" y="26" width="72" height="16" rx="5" fill="#FFFDF8" stroke="#2E2A24" stroke-width="2.2"></rect><rect x="52" y="48" width="72" height="16" rx="5" fill="#9ED7B0" stroke="#2E2A24" stroke-width="2.2"></rect><rect x="52" y="70" width="72" height="16" rx="5" fill="#FFFDF8" stroke="#2E2A24" stroke-width="2.2"></rect><path d="M110 56l3 3 6-6" fill="none" stroke="#2E2A24" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path>',
    sky: '<circle cx="104" cy="60" r="38" fill="#BCD6F2"></circle><path d="M30 30l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill="#FFFDF8"></path><path d="M48 32l24-8 24 8 24-8v54l-24 8-24-8-24 8z" fill="#FFFDF8" stroke="#2E2A24" stroke-width="2.5" stroke-linejoin="round"></path><path d="M72 24v54M96 32v54" stroke="#2E2A24" stroke-width="2"></path><path d="M58 64c8-12 18 4 26-6s14 2 22-10" fill="none" stroke="#CF4822" stroke-width="3" stroke-dasharray="4 5" stroke-linecap="round"></path><circle cx="108" cy="44" r="6" fill="#CF4822" stroke="#2E2A24" stroke-width="2"></circle>'
  };
  const art = (id) => raw('<svg class="today-art" aria-hidden="true" viewBox="0 0 160 96">' + ART[id] + '</svg>');
  const mins = (n) => Math.max(1, Math.round(n * 0.5));

  /** A session with this preset was finished today. */
  function finishedToday(preset) {
    const dk = VL.dayKey();
    const done = (s) => s && s.preset === preset && s.endedAt && VL.dayKey(s.endedAt) === dk;
    const cur = VL.session.current();
    return done(cur) || (VL.store.state.sessions || []).some(done);
  }

  /** Live 3-step plan for today. Each step: {id, title, href, action, done}. */
  function planSteps(p) {
    const hasDecks = VL.decks.mineIds().some((id) => id !== 'mine');
    const nWeak = Math.min(WEAK_N, p.weak.length);
    const nDue = p.due.length;
    const nNew = p.fresh.length;
    const steps = [
      { id: 'weak', n: nWeak, title: nWeak ? 'Ôn ' + nWeak + ' từ yếu' : 'Không còn từ yếu', href: '#/practice?preset=weak',
        done: !nWeak || finishedToday('weak') },
      { id: 'due', n: nDue, title: nDue ? nDue + ' từ đến hạn' : 'Hết từ đến hạn', href: '#/practice?preset=today', action: 'review',
        done: !nDue },
      hasDecks
        ? { id: 'new', n: nNew, title: nNew ? nNew + ' từ mới' : 'Đã mở hết từ mới hôm nay', href: '#/practice?preset=new', done: !nNew }
        : { id: 'new', n: 0, title: 'Chọn bộ để học', href: '#/library', done: false, meta: 'Chọn bộ' }
    ];
    let next = false;
    steps.forEach((s) => {
      s.state = s.done ? 'done' : !next ? (next = true, 'next') : 'todo';
      s.metaText = s.done ? 'Xong' : s.state === 'next' ? 'Tiếp' : s.meta || '~' + mins(s.n) + '′';
    });
    return steps;
  }

  function head(p, ov) {
    const steps = planSteps(p);
    const done = steps.filter((s) => s.done).length;
    const left = steps.length - done;
    const libEmpty = !VL.words.library().length;
    const sub = libEmpty ? 'Thêm từ hoặc chọn bộ từ để bắt đầu.' : left ? 'Còn ' + left + ' việc nhỏ cho hôm nay.' : 'Xong hết việc hôm nay rồi, tuyệt!';
    const showStreak = VL.store.settings().sw.streak;
    return h`<section class="today-head" aria-label="Hôm nay của bạn">
      <div class="today-top">
        <div class="today-hello">
          <h1 class="today-h1">Chào bạn, học tiếp nhé.</h1>
          <span class="today-sub">${sub}</span>
        </div>
        ${showStreak ? h`<span class="today-streak">${FLAME}<span class="sr-only">Chuỗi </span>${VL.srs.streak()} ngày</span>` : ''}
      </div>
      <div class="today-duo">
        <div class="today-plan">
          <div class="today-plan-head">
            <span class="today-plan-title"><span class="today-plan-ic">${CHECK}</span>Kế hoạch</span>
            <span class="today-plan-count">${done}/${steps.length}</span>
          </div>
          <div class="today-plan-list">
            ${steps.map((s) => h`<a href="${s.href}" class="${'today-step is-' + s.state}" data-step="${s.id}"${s.action ? raw(' data-action="' + s.action + '"') : ''}>
              <span class="today-step-box" aria-hidden="true">${s.done ? '✓' : ''}</span>
              <span class="today-step-text">${s.title}${s.done ? h`<span class="sr-only"> (đã xong)</span>` : ''}</span>
              <span class="today-step-meta">${s.metaText}</span>
            </a>`)}
          </div>
        </div>
        <a href="#/library" class="today-prog" aria-label="${'Tiến độ thông thạo ' + ov.avg + '%, xem thư viện'}">
          <div class="today-prog-top">
            <span class="today-ring" aria-hidden="true" style="${raw('--p:' + ov.avg + '%')}"><span class="today-ring-in">${ov.avg}%</span></span>
            <b class="today-prog-n">${ov.buckets.master}/${ov.words} từ</b>
          </div>
          <span class="today-prog-due">${p.due.length} từ cần ôn</span>
        </a>
      </div>
    </section>`;
  }

  function tiles(p) {
    const lib = VL.words.library().length;
    const T = [
      { c: 'peach', href: '#/practice?preset=today', action: 'review', badge: p.due.length + ' TỪ ĐẾN HẠN', title: 'Ôn tập', desc: 'Ôn đúng lúc sắp quên' },
      { c: 'lilac', href: '#/library', badge: lib + ' TỪ', title: 'Từ vựng', desc: 'Từ của bạn và bộ đã thêm' },
      { c: 'butter', href: '#/add', badge: 'TỰ NHẬP', title: 'Thêm từ', desc: 'Gõ từ mới, AI gợi ý khi cần' },
      { c: 'mint', href: '#/practice?preset=quick', action: 'flash', badge: Math.min(FLASH_N, lib) + ' THẺ', title: 'Flashcard', desc: 'Lật thẻ, tự chấm nhớ / chưa nhớ' },
      { c: 'pink', href: '#/practice', action: 'quiz', badge: Math.min(QUIZ_N, lib) + ' CÂU', title: 'Chọn nghĩa', desc: '4 đáp án, biết ngay đúng sai' },
      { c: 'sky', href: '#/library', badge: VL.decks.builtInIds().length + ' BỘ', title: 'Bộ có sẵn', desc: 'Giao tiếp, TOEIC, IELTS…' }
    ];
    return h`<section class="today-what" aria-labelledby="h-what">
      <div class="today-what-head">
        <h2 id="h-what" class="today-h2">Hôm nay học gì?</h2>
        <span class="today-tag"><span class="today-tag-line" aria-hidden="true"></span>Mỗi ngày một chút, đều đặn là nhớ lâu.</span>
      </div>
      <div class="today-tiles">
        ${T.map((t) => h`<a href="${t.href}" class="${'today-tile tile-' + t.c}" data-tile="${t.c}"${t.action ? raw(' data-action="' + t.action + '"') : ''}>
          <span class="today-tape" aria-hidden="true"></span>
          <span class="today-badge">${t.badge}</span>
          <span class="today-tile-title">${t.title}</span>
          <span class="today-tile-desc">${t.desc}</span>
          ${art(t.c)}
        </a>`)}
      </div>
    </section>`;
  }

  /** Start a session; on nothing to practise stay here with a toast. */
  function start(opts, emptyMsg) {
    if (!VL.session.start(opts)) VL.ui.toast(emptyMsg || 'Chưa có từ nào để ôn. Hãy thêm từ hoặc chọn bộ từ.');
  }

  VL.page('today', {
    nav: 'main',
    title: 'Hôm nay',
    render() {
      const p = VL.srs.todayPlan();
      const ov = VL.srs.overview();
      return h`<div class="page"><div class="page-inner today-inner">
        ${head(p, ov)}
        ${tiles(p)}
      </div></div>`;
    },
    mount(root) {
      return VL.ui.delegate(root, {
        review(el, e) { e.preventDefault(); start({ preset: 'today' }); },
        flash(el, e) { e.preventDefault(); start({ preset: 'quick', modes: ['flash'], count: FLASH_N, title: 'Flashcard' }); },
        quiz(el, e) { e.preventDefault(); start({ preset: 'custom', modes: ['mean'], count: QUIZ_N, title: 'Chọn nghĩa' }); }
      });
    }
  });
})();
