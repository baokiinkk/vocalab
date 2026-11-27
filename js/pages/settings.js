/* VocaLab — Cài đặt (design-v3/project/Settings.dc.html).
   #/settings                 full settings (nav 'settings')
   #/settings?scope=practice  "Cài đặt luyện" — practice sections only, no navigation (v3), back link to #/practice
   Every control writes straight to VL.store.settings() via VL.store.setSetting(path, value) and re-renders.
   Settings the v3 design no longer shows (modes, order, prio/review/flash, exn, lang, streak, weekly days, size, sw.backup)
   keep their stored values / defaults. */
(function () {
  'use strict';
  const VL = window.VL;
  const h = VL.html, raw = VL.raw;

  const SEGS = {
    pen: [[10, '−10%'], [20, '−20%'], [30, '−30%']],
    voice: [['uk', 'Anh-Anh (UK)'], ['us', 'Anh-Mỹ (US)']],
    theme: [['light', 'Sáng'], ['dark', 'Tối'], ['sys', 'Theo máy']]
  };
  const SEG_LABEL = { pen: 'Mức trừ khi sai', voice: 'Giọng phát âm', theme: 'Giao diện' };
  const STEPS = { count: [5, 50, 5], fresh: [0, 50, 5] };

  let checking = false;

  const set = () => VL.store.settings();
  const scoped = (ctx) => !!(ctx && ctx.query && ctx.query.scope === 'practice');
  const seg = (key) => VL.ui.seg('seg-' + key, SEGS[key], set()[key], SEG_LABEL[key]);
  const label = (title, sub, extra) => h`<span class="set-label"><span class="set-title">${title}</span>${sub ? h`<span class="set-sub">${sub}</span>` : ''}${extra || ''}</span>`;

  function notifyHint() {
    if (!set().sw.notify) return '';
    if (!('Notification' in window)) return 'Trình duyệt này không hỗ trợ thông báo.';
    if (Notification.permission === 'denied') return 'Thông báo đang bị chặn. Hãy cho phép thông báo trong cài đặt trình duyệt.';
    return '';
  }

  function render(ctx) {
    const s = set();
    const sc = scoped(ctx);
    const hint = notifyHint();

    return h`<div class="page"><div class="page-inner set-wrap">
      <header class="set-head">
        ${sc ? h`<a href="#/practice" class="back-link set-back">${VL.icon('back', 18, 2.2)}Luyện tập</a>` : ''}
        <h1 class="h1">${sc ? 'Cài đặt luyện' : 'Cài đặt'}</h1>
        <span class="set-subtitle">${sc ? 'Áp dụng cho mọi phiên luyện.' : 'Chỉ những gì bạn cần chỉnh, còn lại đã được đặt sẵn.'}</span>
      </header>

      <section class="set-sec" aria-labelledby="h-nhac">
        <h2 id="h-nhac" class="set-h2">Nhắc ôn</h2>
        <div class="set-group">
          <div class="set-row">
            ${label('Nhắc ôn mỗi ngày', 'Gửi thông báo khi có từ đến hạn', hint ? h`<span class="set-sub set-hint" role="note">${hint}</span>` : '')}
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
      </section>

      ${sc ? '' : h`
      <section class="set-sec" aria-labelledby="h-chung">
        <h2 id="h-chung" class="set-h2">Chung</h2>
        <div class="set-group">
          <div class="set-row-col">
            <span class="set-title">Giọng phát âm</span>
            ${seg('voice')}
          </div>
          <div class="set-row-col">
            <span class="set-title">Giao diện</span>
            ${seg('theme')}
          </div>
          <div class="set-row-col">
            <label for="groq-key" class="set-label"><span class="set-title">GROQ API key</span><span class="set-sub">Dùng cho gợi ý AI · chỉ lưu trên máy này</span></label>
            <div class="set-key">
              <div class="set-key-field">
                <input id="groq-key" type="password" class="set-key-input" value="${s.groqKey || ''}" autocomplete="off" spellcheck="false" placeholder="gsk_…" data-action="groq-key">
                <button type="button" class="set-key-eye" data-action="key-eye" aria-pressed="false" aria-label="Hiện API key">Hiện</button>
              </div>
              <button type="button" class="set-btn" data-action="key-test"${checking ? raw(' disabled aria-busy="true"') : ''}>${checking ? h`<span class="spinner" aria-hidden="true"></span> Đang kiểm tra` : 'Kiểm tra'}</button>
            </div>
          </div>
        </div>
      </section>

      <section class="set-sec" aria-labelledby="h-dl">
        <h2 id="h-dl" class="set-h2">Dữ liệu</h2>
        <div class="set-group">
          <div class="set-row">
            ${label('Xuất từ vựng', 'Tự động sao lưu mỗi ngày')}
            <div class="set-actions">
              <button type="button" class="set-btn" data-action="import">Nhập</button>
              <button type="button" class="set-btn" data-action="export">Xuất</button>
              <input id="import-file" type="file" accept=".json,application/json" hidden data-action="import-file" aria-label="Chọn tệp dữ liệu VocaLab">
            </div>
          </div>
          <div class="set-row">
            <span class="set-label"><span class="set-title set-danger">Đặt lại tiến độ</span><span class="set-sub">Đưa mọi từ về 0%, không xoá từ</span></span>
            <button type="button" class="set-btn set-btn-danger" data-action="reset">Đặt lại</button>
          </div>
        </div>
      </section>`}
    </div></div>`;
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
      async reset() {
        const ok = await VL.ui.confirm({ title: 'Đặt lại tiến độ?', body: 'Mọi từ sẽ về 0%, chuỗi ngày và lịch sử luyện bị xoá. Từ vựng vẫn được giữ.', ok: 'Đặt lại', danger: true });
        if (!ok) return;
        VL.srs.resetAll();
        VL.ui.toast('Đã đặt lại tiến độ');
        VL.refresh();
      },
      'sw-notify'() {
        const on = !set().sw.notify;
        VL.store.setSetting('sw.notify', on);
        VL.refresh();
        if (on && 'Notification' in window && Notification.permission === 'default') {
          try {
            Promise.resolve(Notification.requestPermission()).then(() => {
              if (VL.current() && VL.current().name === 'settings') VL.refresh();
            }).catch(() => {});
          } catch (e) { /* ignore */ }
        }
      }
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
      remind(el) { if (el.value) VL.store.setSetting('remindAt', el.value); },
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
    const onKey = (e) => { if (e.key === 'Enter' && e.target.id === 'groq-key') { e.preventDefault(); saveKey(); } };
    root.addEventListener('keydown', onKey);
    return () => { offClick(); offChange(); root.removeEventListener('keydown', onKey); };
  }

  VL.page('settings', {
    // Router reads def.nav before render; derive it from the current hash (scope=practice → 'practice').
    get nav() { return scoped(VL.parseHash()) ? 'practice' : 'settings'; },
    // v3: the scoped "Cài đặt luyện" screen has no sidebar / rail / tab bar.
    get focus() { return scoped(VL.parseHash()); },
    title: (ctx) => (scoped(ctx) ? 'Cài đặt luyện' : 'Cài đặt'),
    enter() { checking = false; },
    render,
    mount
  });
})();
