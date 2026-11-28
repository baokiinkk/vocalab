/* VocaLab — Cài đặt (design-v3/project/Settings.dc.html + SettingsSub.dc.html).
   #/settings                 main list (nav 'settings'): Học tập · Widget & màn hình khoá (Sắp có — not possible on the web) ·
                              Chung · Dữ liệu (GROQ key, export/import — kept although v3 dropped them) · restore defaults / reset
   #/settings/<sub>           sub-screens without navigation, back link "Cài đặt": theme | voice | reminder | reset
   #/settings?scope=practice  "Cài đặt luyện" — Nhắc ôn + Phiên luyện, no navigation, back link to #/practice
                              (&from=settings → back link to #/settings, used by the "Phiên luyện" row)
   Every control writes straight to VL.store.settings() via VL.store.setSetting(path, value) and re-renders.
   Reminder days map onto settings.freq/days (all 7 days → 'daily', otherwise 'weekly' + days), which VL.reminder reads. */
(function () {
  'use strict';
  const VL = window.VL;
  const h = VL.html, raw = VL.raw;

  /* Reading speed (settings.speed) → speechSynthesis rate. media.speak only takes a rate argument, so apply the stored
     speed to every call that does not pass one (flash/quiz/word speak buttons go through VL.media.speak). */
  const RATE = { slow: 0.7, normal: 0.92, fast: 1.1 };
  if (VL.media && !VL.media.speak.__vlRate) {
    const orig = VL.media.speak;
    const wrapped = function (text, accent, rate) { return orig.call(this, text, accent, rate || RATE[VL.store.settings().speed] || RATE.normal); };
    wrapped.__vlRate = true;
    VL.media.speak = wrapped;
  }

  const SEGS = {
    pen: [[10, '−10%'], [20, '−20%'], [30, '−30%']],
    speed: [['slow', 'Chậm'], ['normal', 'Vừa'], ['fast', 'Nhanh']]
  };
  const SEG_LABEL = { pen: 'Mức trừ khi sai', speed: 'Tốc độ đọc' };
  const STEPS = { count: [5, 50, 5], fresh: [0, 50, 5] };
  const THEMES = [['light', 'Sáng'], ['dark', 'Tối'], ['sys', 'Theo máy']];
  const VOICES = [['uk', 'Anh-Anh (UK)', '/ˈʃedjuːl/'], ['us', 'Anh-Mỹ (US)', '/ˈskedʒuːl/']];
  const DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  const SUBS = {
    reminder: ['Nhắc ôn', 'Chọn giờ và ngày nhận thông báo.'],
    voice: ['Giọng phát âm', 'Giọng đọc dùng trong toàn bộ ứng dụng.'],
    theme: ['Giao diện', 'Chọn màu nền bạn thấy dễ chịu nhất.'],
    reset: ['Đặt lại tiến độ học', 'Đưa mọi từ về 0% để học lại từ đầu.']
  };
  const RESET_WORD = 'ĐẶT LẠI';

  /* icons from the design (stroke 2.2, 24 grid) */
  const I = {
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21h4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    grid: '<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    voice: '<path d="M11 5L6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>',
    play: '<path d="M11 5L6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    restore: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M10.8 12.2L20 3M16 7l3 3M14 9l2 2"/>',
    data: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    warn: '<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4M12 17h.01"/>',
    back: '<path d="M15 6l-6 6 6 6"/>',
    chev: '<path d="M9 6l6 6-6 6"/>'
  };
  const svg = (name, size, sw) => raw('<svg aria-hidden="true" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (sw || 2.2) + '" stroke-linecap="round" stroke-linejoin="round">' + I[name] + '</svg>');
  const tile = (color, icon) => h`<span class="${'set-ic set-ic-' + color}">${svg(icon, 17)}</span>`;
  const chev = () => h`<span class="set-chev">${svg('chev', 16, 2.4)}</span>`;

  let checking = false;
  let confirmText = '';

  const set = () => VL.store.settings();
  const route = () => VL.parseHash();
  const subOf = (r) => (r && r.params && SUBS[r.params.sub] ? r.params.sub : null);
  const scoped = (r) => !!(r && r.query && r.query.scope === 'practice' && !subOf(r));
  const seg = (key) => VL.ui.seg('seg-' + key, SEGS[key], set()[key], SEG_LABEL[key]);
  const label = (title, sub, extra) => h`<span class="set-label"><span class="set-title">${title}</span>${sub ? h`<span class="set-sub">${sub}</span>` : ''}${extra || ''}</span>`;
  const speed = () => (RATE[set().speed] ? set().speed : 'normal');

  /** Reminder days in design order T2..CN (freq 'daily' = every day). */
  const dayOn = () => { const s = set(); return DAYS.map((d) => s.freq === 'daily' || !!(s.days && s.days[d])); };
  function daysLabel(on) {
    const n = on.filter(Boolean).length;
    if (n === 7) return 'Mỗi ngày';
    if (!n) return 'Không nhắc';
    const first = on.indexOf(true), last = on.lastIndexOf(true);
    if (n >= 3 && last - first + 1 === n) return DAYS[first] + '–' + DAYS[last];
    return DAYS.filter((d, i) => on[i]).join(', ');
  }

  function notifyHint() {
    if (!set().sw.notify) return '';
    if (!('Notification' in window)) return 'Trình duyệt này không hỗ trợ thông báo.';
    if (Notification.permission === 'denied') return 'Thông báo đang bị chặn. Hãy cho phép thông báo trong cài đặt trình duyệt.';
    return '';
  }
  const hintEl = () => { const t = notifyHint(); return t ? h`<span class="set-sub set-hint" role="note">${t}</span>` : ''; };

  const head = (title, subtitle, back) => h`<header class="set-head">
      ${back ? h`<a href="${back[0]}" class="back-link set-back">${svg('back', 18, 2.4)}${back[1]}</a>` : ''}
      <h1 class="h1">${title}</h1>
      <span class="set-subtitle">${subtitle}</span>
    </header>`;
  const wrap = (inner) => h`<div class="page"><div class="page-inner set-wrap">${inner}</div></div>`;

  /* ---------- main list ---------- */
  function renderMain() {
    const s = set();
    const theme = (THEMES.find((t) => t[0] === s.theme) || THEMES[2])[1];
    const soon = (color, icon, title) => h`<div class="set-crow is-soon" aria-disabled="true">${tile(color, icon)}<span class="set-ctext"><span class="set-title">${title}</span></span><span class="set-soon">Sắp có</span></div>`;
    return wrap(h`
      ${head('Cài đặt', 'Những gì bạn hay chỉnh nhất.')}

      <section class="set-sec" aria-labelledby="h-hoc">
        <h2 id="h-hoc" class="set-h2">Học tập</h2>
        <div class="set-group">
          <div class="set-crow">${tile('peach', 'bell')}<span class="set-ctext"><span class="set-title">Nhắc ôn mỗi ngày</span>${hintEl()}</span>${VL.ui.switch('sw-notify', s.sw.notify, 'Nhắc ôn mỗi ngày')}</div>
          <a href="#/settings/reminder" class="set-crow" data-row="reminder">${tile('butter', 'clock')}<span class="set-ctext"><span class="set-title">Giờ nhắc</span></span><span class="set-val">${(s.remindAt || '20:00') + ' · ' + daysLabel(dayOn())}</span>${chev()}</a>
          <a href="#/settings?scope=practice&amp;from=settings" class="set-crow" data-row="practice">${tile('lilac', 'sliders')}<span class="set-ctext"><span class="set-title">Phiên luyện</span><span class="set-csub">${s.count + ' từ/phiên · ' + s.fresh + ' từ mới/ngày · sai −' + s.pen + '%'}</span></span>${chev()}</a>
        </div>
      </section>

      <section class="set-sec" aria-labelledby="h-widget">
        <h2 id="h-widget" class="set-h2">Widget &amp; màn hình khoá</h2>
        <div class="set-group">
          ${soon('mint', 'grid', 'Widget màn hình chính')}
          ${soon('sky', 'lock', 'Màn hình khoá')}
          <div class="set-crow is-soon" aria-disabled="true">${tile('pink', 'eye')}<span class="set-ctext"><span class="set-title">Hiện nghĩa</span><span class="set-csub">Tắt để tự đoán nghĩa</span></span><span class="set-soon">Sắp có</span></div>
        </div>
      </section>

      <section class="set-sec" aria-labelledby="h-chung">
        <h2 id="h-chung" class="set-h2">Chung</h2>
        <div class="set-group">
          <a href="#/settings/voice" class="set-crow" data-row="voice">${tile('peach', 'voice')}<span class="set-ctext"><span class="set-title">Giọng phát âm</span></span><span class="set-val">${s.voice === 'us' ? 'Anh-Mỹ' : 'Anh-Anh'}</span>${chev()}</a>
          <a href="#/settings/theme" class="set-crow" data-row="theme">${tile('lilac', 'moon')}<span class="set-ctext"><span class="set-title">Giao diện</span></span><span class="set-val">${theme}</span>${chev()}</a>
        </div>
      </section>

      <section class="set-sec" aria-labelledby="h-dl">
        <h2 id="h-dl" class="set-h2">Dữ liệu</h2>
        <div class="set-group">
          <div class="set-crow set-crow-col">
            <div class="set-crow-top">${tile('butter', 'key')}<label for="groq-key" class="set-ctext"><span class="set-title">GROQ API key</span><span class="set-csub">Dùng cho gợi ý AI · chỉ lưu trên máy này</span></label></div>
            <div class="set-key">
              <div class="set-key-field">
                <input id="groq-key" type="password" class="set-key-input" value="${s.groqKey || ''}" autocomplete="off" spellcheck="false" placeholder="gsk_…" data-action="groq-key">
                <button type="button" class="set-key-eye" data-action="key-eye" aria-pressed="false" aria-label="Hiện API key">Hiện</button>
              </div>
              <button type="button" class="set-btn" data-action="key-test"${checking ? raw(' disabled aria-busy="true"') : ''}>${checking ? h`<span class="spinner" aria-hidden="true"></span> Đang kiểm tra` : 'Kiểm tra'}</button>
            </div>
          </div>
          <div class="set-crow">${tile('mint', 'data')}<span class="set-ctext"><span class="set-title">Sao lưu từ vựng</span><span class="set-csub">Xuất / nhập tệp · tự sao lưu mỗi ngày</span></span>
            <span class="set-actions">
              <button type="button" class="set-btn" data-action="import">Nhập</button>
              <button type="button" class="set-btn" data-action="export">Xuất</button>
              <input id="import-file" type="file" accept=".json,application/json" hidden data-action="import-file" aria-label="Chọn tệp dữ liệu VocaLab">
            </span>
          </div>
        </div>
      </section>

      <section class="set-sec" aria-label="Khôi phục">
        <div class="set-group">
          <button type="button" class="set-crow" data-action="restore">${tile('plain', 'restore')}<span class="set-ctext"><span class="set-title">Khôi phục cài đặt mặc định</span></span></button>
          <a href="#/settings/reset" class="set-crow" data-row="reset">${tile('pink', 'trash')}<span class="set-ctext"><span class="set-title set-danger">Đặt lại tiến độ học</span><span class="set-csub">Mọi từ về 0%. Không thể hoàn tác.</span></span>${chev()}</a>
        </div>
      </section>`);
  }

  /* ---------- "Cài đặt luyện" (scope=practice) ---------- */
  function renderScoped(r) {
    const s = set();
    const fromSettings = r.query.from === 'settings';
    return wrap(h`
      ${head('Cài đặt luyện', 'Áp dụng cho mọi phiên luyện.', fromSettings ? ['#/settings', 'Cài đặt'] : ['#/practice', 'Luyện tập'])}
      <section class="set-sec" aria-labelledby="h-nhac">
        <h2 id="h-nhac" class="set-h2">Nhắc ôn</h2>
        <div class="set-group">
          <div class="set-row">
            ${label('Nhắc ôn mỗi ngày', 'Gửi thông báo khi có từ đến hạn', hintEl())}
            ${VL.ui.switch('sw-notify', s.sw.notify, 'Nhắc ôn mỗi ngày')}
          </div>
          <div class="set-row">
            <label for="remind" class="set-title">Giờ nhắc</label>
            <input id="remind" type="time" class="set-time" value="${s.remindAt || '20:00'}" data-action="remind">
          </div>
        </div>
      </section>
      <section class="set-sec" aria-labelledby="h-phien">
        <h2 id="h-phien" class="set-h2">Phiên luyện</h2>
        <div class="set-group">
          <div class="set-row">
            ${label('Số từ mỗi phiên', 'Cho phiên “Ôn hôm nay”')}
            ${VL.ui.stepper('step-count', s.count, 'Số từ mỗi phiên', STEPS.count[0], STEPS.count[1])}
          </div>
          <div class="set-row">
            ${label('Từ mới mỗi ngày', 'Mở dần từ các bộ có sẵn')}
            ${VL.ui.stepper('step-fresh', s.fresh, 'Từ mới mỗi ngày', STEPS.fresh[0], STEPS.fresh[1])}
          </div>
          <div class="set-row-col">
            ${label('Trả lời sai thì trừ', 'Đúng luôn +10% · 10 lần đúng = 100%')}
            ${seg('pen')}
          </div>
          <div class="set-note">Từ có % thấp sẽ tự động xuất hiện nhiều hơn; từ đã 100% thỉnh thoảng được hỏi lại để không quên.</div>
        </div>
      </section>`);
  }

  /* ---------- sub-screens ---------- */
  function renderReminder() {
    const s = set();
    const plan = VL.srs.todayPlan();
    const streak = VL.srs.streak();
    const on = dayOn();
    return h`
      <div class="set-notif" aria-label="Xem trước thông báo" role="img">
        <span class="set-notif-logo" aria-hidden="true">V</span>
        <span class="set-notif-text"><span class="set-notif-top"><b>VocaLab</b>${s.remindAt || '20:00'}</span>
          <span class="set-notif-title">${plan.due.length ? plan.due.length + ' từ đang chờ bạn ôn' : 'Đến giờ ôn từ vựng rồi'}</span>
          <span class="set-notif-body">${'Chỉ mất khoảng ' + plan.minutes + ' phút' + (streak ? ', giữ chuỗi ' + streak + ' ngày nhé!' : ' mỗi ngày thôi!')}</span></span>
      </div>
      <div class="set-group">
        <div class="set-srow">${label('Nhắc ôn mỗi ngày', 'Gửi thông báo khi có từ đến hạn', hintEl())}${VL.ui.switch('sw-notify', s.sw.notify, 'Nhắc ôn mỗi ngày')}</div>
        <div class="set-srow"><label for="remind" class="set-title set-grow">Giờ nhắc</label><input id="remind" type="time" class="set-time set-time-sm" value="${s.remindAt || '20:00'}" data-action="remind"></div>
        <div class="set-row-col">
          <span class="set-title">Ngày nhắc</span>
          <div class="set-days" role="group" aria-label="Ngày nhắc">${DAYS.map((d, i) => h`<button type="button" class="${'set-day' + (on[i] ? ' is-on' : '')}" aria-pressed="${String(on[i])}" data-action="day" data-value="${d}">${d}</button>`)}</div>
        </div>
        <div class="set-srow">${label('Nhắc lần 2 nếu chưa học', 'Gửi thêm một lần sau 2 tiếng')}${VL.ui.switch('sw-again', s.sw.again !== false, 'Nhắc lần 2')}</div>
      </div>`;
  }

  function renderVoice() {
    const s = set();
    return h`
      <div class="set-group" role="radiogroup" aria-label="Giọng phát âm">
        ${VOICES.map(([id, name, ipa]) => {
          const on = (s.voice === 'us' ? 'us' : 'uk') === id;
          return h`<div class="set-srow">
            <button type="button" role="radio" aria-checked="${String(on)}" class="${'set-radio' + (on ? ' is-on' : '')}" data-action="voice" data-value="${id}">
              <span class="set-radio-ring" aria-hidden="true"><span></span></span>
              <span class="set-label"><span class="set-title set-strong">${name}</span><span class="set-sub">${'schedule ' + ipa}</span></span>
            </button>
            <button type="button" class="set-play" data-action="voice-play" data-value="${id}" aria-label="${'Nghe thử ' + name}">${svg('play', 18)}</button>
          </div>`;
        })}
      </div>
      <div class="set-group">
        <div class="set-row-col"><span class="set-title">Tốc độ đọc</span>${VL.ui.seg('seg-speed', SEGS.speed, speed(), SEG_LABEL.speed)}</div>
        <div class="set-srow">${label('Tự đọc khi hiện từ', 'Trong Flashcard và Chọn nghĩa')}${VL.ui.switch('sw-autoSpeak', s.sw.autoSpeak !== false, 'Tự đọc khi hiện từ')}</div>
      </div>`;
  }

  function renderTheme() {
    const cur = set().theme;
    return h`
      <div class="set-pick" role="radiogroup" aria-label="Giao diện">
        ${THEMES.map(([id, name]) => {
          const on = cur === id;
          return h`<button type="button" role="radio" aria-checked="${String(on)}" class="${'set-pick-card' + (on ? ' is-on' : '')}" data-action="theme" data-value="${id}">
            <span class="${'set-prev set-prev-' + id}" aria-hidden="true"><span class="set-prev-bar"></span><span class="set-prev-a"></span><span class="set-prev-row"><span></span><span></span></span></span>
            <span class="set-pick-label"><span class="set-dot" aria-hidden="true"></span>${name}</span>
          </button>`;
        })}
      </div>
      <span class="set-foot">“Theo máy” tự chuyển sang Tối từ 20h đến 5h, Sáng vào ban ngày.</span>`;
  }

  const resetOk = (t) => String(t || '').normalize('NFC').trim().toUpperCase() === RESET_WORD.normalize('NFC');
  function renderReset() {
    const n = VL.srs.overview().total;
    const streak = VL.srs.streak();
    const items = [['Mức thông thạo của ' + n + ' từ', '→ 0%'], ['Chuỗi ngày', streak + ' → 0'], ['Lịch sử luyện tập', 'Xoá'], ['Bộ có sẵn đã thêm', 'Giữ lại']];
    const ok = resetOk(confirmText);
    return h`
      <div class="set-warn">
        <span class="set-warn-ic">${svg('warn', 22)}</span>
        <span class="set-warn-text"><b>Không thể hoàn tác</b><span>Từ vựng vẫn giữ nguyên, nhưng toàn bộ tiến độ học sẽ bị xoá.</span></span>
      </div>
      <div class="set-group">
        ${items.map(([l, v]) => h`<div class="set-srow set-srow-sm"><span class="set-bullet" aria-hidden="true"></span><span class="set-grow">${l}</span><span class="set-val">${v}</span></div>`)}
      </div>
      <label class="set-confirm" for="reset-confirm">
        <span>Gõ <b>${RESET_WORD}</b> để xác nhận</span>
        <input id="reset-confirm" type="text" class="set-confirm-input" value="${confirmText}" placeholder="${RESET_WORD}" autocomplete="off" spellcheck="false" data-action="reset-text">
      </label>
      <div class="set-reset-actions">
        <a href="#/settings" class="set-cancel">Huỷ</a>
        <button type="button" class="set-reset-btn" data-action="reset"${ok ? '' : raw(' disabled')}>Đặt lại tiến độ</button>
      </div>`;
  }

  const SUB_RENDER = { reminder: renderReminder, voice: renderVoice, theme: renderTheme, reset: renderReset };

  function render(ctx) {
    const r = { params: ctx.params || {}, query: ctx.query || {} };
    const sub = subOf(r);
    if (sub) return wrap(h`${head(SUBS[sub][0], SUBS[sub][1], ['#/settings', 'Cài đặt'])}${SUB_RENDER[sub]()}`);
    if (scoped(r)) return renderScoped(r);
    return renderMain();
  }

  function mount(root) {
    const handlers = {
      'key-eye'(el) {
        const inp = root.querySelector('#groq-key');
        if (!inp) return;
        const show = inp.type === 'password';
        inp.type = show ? 'text' : 'password';
        el.textContent = show ? 'Ẩn' : 'Hiện';
        el.setAttribute('aria-pressed', String(show));
        el.setAttribute('aria-label', show ? 'Ẩn API key' : 'Hiện API key');
      },
      async 'key-test'() {
        saveKey();
        if (checking) return;
        checking = true; VL.refresh();
        try {
          await VL.ai.chatJSON([{ role: 'user', content: 'Reply {"ok":true}' }], { timeout: 15000 });
          VL.ui.toast('Kết nối AI thành công');
        } catch (e) {
          VL.ui.toast(e.message || 'Không kiểm tra được API key', 'error');
        } finally {
          checking = false;
          if (VL.current() && VL.current().name === 'settings') VL.refresh();
        }
      },
      export() {
        VL.store.download('vocalab-' + VL.dayKey() + '.json', VL.store.exportJSON());
        VL.ui.toast('Đã xuất dữ liệu');
      },
      import() { const f = root.querySelector('#import-file'); if (f) f.click(); },
      async restore() {
        const ok = await VL.ui.confirm({ title: 'Khôi phục cài đặt mặc định?', body: 'Mọi cài đặt về như ban đầu. Từ vựng, tiến độ và API key vẫn được giữ.', ok: 'Khôi phục' });
        if (!ok) return;
        VL.store.update((st) => {
          const keep = { groqKey: st.settings.groqKey, groqModel: st.settings.groqModel };
          st.settings = Object.assign(JSON.parse(JSON.stringify(VL.DEFAULT_SETTINGS)), keep);
        });
        VL.emit('settings', '*');
        VL.ui.toast('Đã khôi phục cài đặt mặc định');
        VL.refresh();
      },
      async reset() {
        if (!resetOk(confirmText)) return;
        const ok = await VL.ui.confirm({ title: 'Đặt lại tiến độ?', body: 'Mọi từ sẽ về 0%, chuỗi ngày và lịch sử luyện bị xoá. Từ vựng vẫn được giữ.', ok: 'Đặt lại', danger: true });
        if (!ok) return;
        VL.srs.resetAll();
        confirmText = '';
        VL.ui.toast('Đã đặt lại tiến độ');
        VL.go('#/settings');
      },
      'sw-notify'() {
        const on = !set().sw.notify;
        VL.store.setSetting('sw.notify', on);
        VL.refresh();
        // Permission is only ever requested from this user click.
        if (on && 'Notification' in window && Notification.permission === 'default') {
          try {
            Promise.resolve(Notification.requestPermission()).then(() => {
              if (VL.current() && VL.current().name === 'settings') VL.refresh();
            }).catch(() => {});
          } catch (e) { /* ignore */ }
        }
      },
      'sw-again'() { VL.store.setSetting('sw.again', set().sw.again === false); VL.refresh(); },
      'sw-autoSpeak'() { VL.store.setSetting('sw.autoSpeak', set().sw.autoSpeak === false); VL.refresh(); },
      day(el) {
        const on = dayOn();
        const i = DAYS.indexOf(el.getAttribute('data-value'));
        if (i < 0) return;
        on[i] = !on[i];
        const map = {};
        DAYS.forEach((d, j) => { if (on[j]) map[d] = true; });
        VL.store.setSetting('days', map);
        VL.store.setSetting('freq', on.every(Boolean) ? 'daily' : 'weekly');
        VL.refresh();
      },
      voice(el) { VL.store.setSetting('voice', el.getAttribute('data-value') === 'us' ? 'us' : 'uk'); VL.refresh(); },
      'voice-play'(el) {
        if (!VL.media.canSpeak()) { VL.ui.toast('Trình duyệt này không hỗ trợ đọc phát âm', 'error'); return; }
        VL.media.speak('schedule', el.getAttribute('data-value') === 'us' ? 'us' : 'uk');
      },
      theme(el) { VL.store.setSetting('theme', el.getAttribute('data-value')); VL.refresh(); }
    };
    Object.keys(SEGS).forEach((key) => {
      handlers['seg-' + key] = (el) => {
        const rv = el.getAttribute('data-value');
        VL.store.setSetting(key, typeof SEGS[key][0][0] === 'number' ? Number(rv) : rv);
        VL.refresh();
      };
    });
    Object.keys(STEPS).forEach((key) => {
      handlers['step-' + key] = (el) => {
        const [min, max, by] = STEPS[key];
        const cur = Number(set()[key]) || 0;
        // snap to the 5-grid (default count 24 → 25 / 20)
        const v = VL.clamp(Number(el.getAttribute('data-step')) > 0 ? Math.floor(cur / by) * by + by : Math.ceil(cur / by) * by - by, min, max);
        VL.store.setSetting(key, v);
        VL.refresh();
      };
    });

    function saveKey() {
      const inp = root.querySelector('#groq-key');
      if (!inp) return;
      const v = inp.value.trim();
      if (v !== (set().groqKey || '')) { VL.store.setSetting('groqKey', v); VL.ui.toast(v ? 'Đã lưu API key' : 'Đã xoá API key'); }
    }

    const offClick = VL.ui.delegate(root, handlers);
    const offChange = VL.ui.delegate(root, {
      remind(el) { if (el.value) { VL.store.setSetting('remindAt', el.value); VL.refresh(); } },
      'groq-key'() { saveKey(); },
      'import-file'(el) {
        const file = el.files && el.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async () => {
          el.value = '';
          const ok = await VL.ui.confirm({ title: 'Nhập dữ liệu?', body: 'Dữ liệu trong tệp sẽ thay thế toàn bộ từ vựng, tiến độ và cài đặt hiện tại.', ok: 'Nhập' });
          if (!ok) return;
          try {
            VL.store.importJSON(String(reader.result));
            VL.ui.toast('Đã nhập dữ liệu');
          } catch (e) {
            VL.ui.toast(e instanceof SyntaxError ? 'Tệp không phải JSON hợp lệ' : e.message || 'Không nhập được tệp', 'error');
          }
          VL.refresh();
        };
        reader.onerror = () => { el.value = ''; VL.ui.toast('Không đọc được tệp', 'error'); };
        reader.readAsText(file);
      }
    }, 'change');
    // Typed confirmation: update the button in place (no re-render while typing).
    const offInput = VL.ui.delegate(root, {
      'reset-text'(el) {
        confirmText = el.value;
        const b = root.querySelector('[data-action="reset"]');
        if (b) b.disabled = !resetOk(confirmText);
      }
    }, 'input');
    const onKey = (e) => {
      if (e.key !== 'Enter') return;
      if (e.target.id === 'groq-key') { e.preventDefault(); saveKey(); }
      if (e.target.id === 'reset-confirm') { e.preventDefault(); handlers.reset(); }
    };
    root.addEventListener('keydown', onKey);
    return () => { offClick(); offChange(); offInput(); root.removeEventListener('keydown', onKey); };
  }

  VL.page('settings', {
    // Router reads def.nav / def.focus before render; derive them from the current hash.
    get nav() { return scoped(route()) ? 'practice' : 'settings'; },
    // v3: sub-screens and the scoped "Cài đặt luyện" screen have no sidebar / rail / tab bar.
    get focus() { const r = route(); return scoped(r) || !!subOf(r); },
    title: (ctx) => {
      const r = { params: ctx.params || {}, query: ctx.query || {} };
      const sub = subOf(r);
      return sub ? SUBS[sub][0] : scoped(r) ? 'Cài đặt luyện' : 'Cài đặt';
    },
    enter() { checking = false; confirmText = ''; },
    render,
    mount
  });
})();
