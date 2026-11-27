/* VocaLab — page "add": Thêm / sửa từ + AI  (#/add?edit=<key>&q=<text>&deck=<id>)
   Design: design-v3/project/AddWord.dc.html.
   Form state lives in this closure (reset in enter()). Keystrokes only update state + small DOM bits in place
   (duplicate alert, validation); structural changes (AI fill, chips, example rows, image) re-render with
   VL.refresh(), which keeps focus/caret because every field has an id. */
(function () {
  'use strict';
  const VL = window.VL;
  const h = VL.html, raw = VL.raw;

  // Part-of-speech chips shown in the design (labels from VL.POS_LABEL: "Cụm từ" = exp).
  const POS_IDS = ['n', 'v', 'adj', 'adv', 'exp', 'idiom'];

  let f = null;       // form fields
  let ui = null;      // page UI state
  let gen = 0;        // generation: ignore late AI replies after leaving / clearing the form

  const blankForm = () => ({ w: '', vi: '', ipa: '', ipaUs: '', pos: '', def: '', cefr: '', examples: [{ en: '', vi: '' }], gram: '', syn: '', note: '', img: '' });
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const synText = (syn, ant) => (syn || []).join(', ') + ((ant || []).length ? ' / ' + ant.join(', ') : '');
  const parseSyn = (s) => {
    const parts = String(s || '').split('/');
    const list = (x) => String(x || '').split(/[,;·\n]/).map((t) => t.trim()).filter(Boolean);
    return { syn: list(parts[0]), ant: list(parts.slice(1).join(',')) };
  };
  const freshUi = (base) => ({ editKey: null, notFound: false, deck: 'mine', status: 'idle', snapshot: null, tried: false, leaving: false, dupKey: null, imgAI: false, autoDone: {}, origImg: '', origW: '', ...(base || {}) });

  function enter(ctx) {
    gen++;
    const q = ctx.query || {};
    f = blankForm();
    ui = freshUi();
    if (q.edit) {
      const w = VL.words.get(q.edit);
      if (!w) { ui.notFound = true; return; }
      ui.editKey = w.key;
      ui.deck = w.deck;
      f = {
        w: w.w || '', vi: w.vi || '', ipa: w.ipa || '', ipaUs: w.ipaUs || '', pos: w.pos || '', def: w.def || '', cefr: w.cefr || '',
        examples: (w.examples || []).length ? w.examples.map((e) => ({ en: e.en || '', vi: e.vi || '' })) : [{ en: '', vi: '' }],
        gram: w.gram || '', syn: synText(w.syn, w.ant), note: w.note || '', img: w.img || ''
      };
      ui.origImg = f.img; ui.origW = f.w;
    } else {
      if (q.deck && VL.CATALOG[q.deck]) ui.deck = q.deck;
      if (q.q) f.w = q.q;
    }
    ui.dupKey = findDup();
  }

  function findDup() {
    const t = (f.w || '').trim();
    if (!t) return null;
    const k = VL.words.findByText(t);
    return k && k !== ui.editKey ? k : null;
  }

  /* ---------------- render ---------------- */
  const sparkle = raw('<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"></path><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"></path></svg>');
  const imgIcon = raw('<svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"></rect><circle cx="9" cy="11" r="2"></circle><path d="M21 17l-5-5-8 7"></path></svg>');
  const closeIcon = raw('<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"></path></svg>');

  // v3 DeckIcon glyphs (design-v3/project/DeckIcon.dc.html). Core VL.ui.deckIcon still renders the 2-letter abbr.
  const DECK_GLYPH = {
    mine: '<path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z"/>',
    comm: '<path d="M4 5h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9l-4 3v-3H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/><path d="M19 9h1a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-1v2.5L16 18"/>',
    phr: '<path d="M4 8h12M12 4l4 4-4 4"/><path d="M20 16H8M12 12l-4 4 4 4"/>',
    idiom: '<path d="M5 11h4v7H3v-5c0-4 2-6 5-7"/><path d="M15 11h4v7h-6v-5c0-4 2-6 5-7"/>',
    daily: '<path d="M3.5 10.5L12 3.5l8.5 7V20a1 1 0 0 1-1 1H15v-6H9v6H4.5a1 1 0 0 1-1-1z"/>',
    travel: '<path d="M10.5 13.5L3 11l1.5-1.5 8 1L17 6a2 2 0 0 1 3 3l-4.5 4.5 1 8L15 23l-2.5-7.5L9 19v3l-1.5 1-1-3.5L3 18.5l1-1.5h3z"/>',
    food: '<path d="M4 9h13v5a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6z"/><path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H17"/><path d="M8 2v3M12 2v3"/>',
    it: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M2 20h20M9 9l-2 2 2 2M15 9l2 2-2 2"/>',
    work: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>',
    mkt: '<path d="M3 11v3a1 1 0 0 0 1 1h3l6 4V6L7 10H4a1 1 0 0 0-1 1z"/><path d="M17 9a4 4 0 0 1 0 6M19.5 6.5a8 8 0 0 1 0 11"/>',
    toeic: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8.5 15l2.5 2.5 4.5-5"/>',
    ielts: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2.5 9 2.5 12 0v-5M22 9v6"/>',
    iw: '<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"/><path d="M14 6l3 3M4 22h16"/>'
  };
  const deckTile = (deck) => h`<span class="add-deck-ico" style="${raw('background:' + deck.bg + ';color:' + deck.fg)}" aria-hidden="true">${DECK_GLYPH[deck.id]
    ? raw('<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + DECK_GLYPH[deck.id] + '</svg>')
    : deck.abbr}</span>`;
  // Section heading icon tiles (v3): colour class + stroke path.
  const H2_ICON = {
    mean: '<path d="M4 19.5V5a2 2 0 0 1 2-2h14v15H6a2 2 0 0 0-2 2 1.5 1.5 0 0 0 1.5 1.5H20"/>',
    img: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M21 17l-5-5-8 7"/>',
    ex: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    gram: '<path d="M4 7V4h16v3M9 20h6M12 4v16"/>'
  };
  const h2 = (kind, text) => h`<h2 class="add-h2"><span class="${'add-h2-ico is-' + kind}">${raw('<svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">' + H2_ICON[kind] + '</svg>')}</span>${text}</h2>`;
  const warnIcon = raw('<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="9"></circle><path d="M12 8v5M12 16h.01"></path></svg>');

  const loading = () => ui.status === 'loading';
  const aiLabel = () => (loading() ? 'Đang điền…' : ui.status === 'filled' ? 'Gợi ý lại' : 'Gợi ý bằng AI');
  const isMissing = () => !f.w.trim() || !f.vi.trim();

  function dupHtml() {
    if (!ui.dupKey) return '';
    const w = VL.words.get(ui.dupKey);
    const deckName = (w && w.deckObj && w.deckObj.name) || 'Từ của tôi';
    return h`<div class="add-dup" role="alert"><span>“${f.w.trim()}” đã có trong ${deckName}</span><a href="${VL.href.word(ui.dupKey)}">Xem từ</a></div>`;
  }
  const missingHtml = () => (isMissing() ? h`<span class="add-missing">${warnIcon}Cần có từ và nghĩa để lưu</span>` : '');

  function posChips() {
    const ids = POS_IDS.slice();
    if (f.pos && ids.indexOf(f.pos) < 0) ids.push(f.pos);
    return ids.map((id) => {
      const on = f.pos === id;
      return h`<button type="button" role="radio" aria-checked="${String(on)}" class="add-chip${on ? ' is-on' : ''}" data-action="pos" data-value="${id}" data-focus="${'pos-' + id}">${VL.POS_LABEL[id] || id}</button>`;
    });
  }

  function exRows() {
    return f.examples.map((e, i) => h`<div class="add-ex">
        <div class="add-ex-fields">
          <textarea id="${'add-ex-en-' + i}" class="add-ta add-ex-en" rows="1" aria-label="Câu ví dụ" data-ex="${i}" data-part="en" placeholder="Viết một câu có dùng từ này…">${e.en}</textarea>
          <textarea id="${'add-ex-vi-' + i}" class="add-ex-vi" rows="1" aria-label="Bản dịch" data-ex="${i}" data-part="vi" placeholder="Bản dịch (tuỳ chọn)">${e.vi}</textarea>
        </div>
        <button type="button" class="add-ex-del" data-action="exDel" data-i="${i}" aria-label="Xoá câu">${closeIcon}</button>
      </div>`);
  }

  function imageSection() {
    if (f.img) {
      return h`<div class="add-img-box">
          <img id="add-img" src="${f.img}" alt="${'Hình minh hoạ cho “' + (f.w.trim() || 'từ') + '”'}" referrerpolicy="no-referrer">
          ${ui.imgAI ? h`<span class="add-img-badge">AI tạo</span>` : ''}
        </div>
        <div class="add-img-actions">
          <button type="button" class="add-img-change" data-action="imgPick" data-focus="img-change">Đổi ảnh</button>
          <button type="button" class="add-img-del" data-action="imgDel">Xoá</button>
        </div>`;
    }
    return h`<button type="button" class="add-img-empty" data-action="imgPick" data-focus="img-pick">${imgIcon}Tải ảnh lên<span>hoặc để AI tạo khi bấm Gợi ý</span></button>`;
  }

  function render() {
    if (ui.notFound) {
      return h`<div class="page add-page"><div class="add-inner">
        <h1 class="add-h1">Sửa từ</h1>
        <div class="add-card">${VL.ui.empty('Không tìm thấy từ này', 'Có thể từ đã bị xoá.', h`<a class="btn btn-primary" href="#/add">Thêm từ mới</a>`)}</div>
      </div></div>`;
    }
    const deck = VL.CATALOG[ui.deck] || VL.CATALOG.mine;
    const missW = ui.tried && !f.w.trim(), missV = ui.tried && !f.vi.trim();
    const busy = loading();
    const noWord = !f.w.trim();
    return h`<div class="page add-page${busy ? ' is-loading' : ''}"><div class="add-inner">
      <header class="add-head">
        <h1 class="add-h1">${ui.editKey ? 'Sửa từ' : 'Thêm từ'}</h1>
        <span class="add-target">Lưu vào <span class="add-deck">${deckTile(deck)}${deck.name}</span></span>
      </header>

      <section class="add-card add-word-card">
        <label for="add-word" class="add-label">Từ hoặc cụm từ tiếng Anh</label>
        <div class="add-word-row">
          <input id="add-word" type="text" class="add-word${missW ? ' is-error' : ''}" data-field="w" value="${f.w}" placeholder="vd. resilient" autocomplete="off" autocapitalize="off" spellcheck="false"${missW ? raw(' aria-invalid="true"') : ''}>
          <button type="button" class="add-ai${noWord ? ' is-off' : ''}" id="add-ai" data-action="ai"${busy ? raw(' aria-disabled="true" aria-busy="true"') : ''}>${sparkle}${aiLabel()}</button>
        </div>
        ${busy ? h`<span class="add-status" role="status">AI đang điền phiên âm, nghĩa, ví dụ, ngữ pháp và hình minh hoạ…</span>` : ''}
        ${ui.status === 'filled' ? h`<div class="add-filled" role="status"><span>AI đã điền toàn bộ. Kiểm tra và sửa lại nếu cần.</span><button type="button" class="add-undo" data-action="undo">Hoàn tác</button></div>` : ''}
        <div id="add-dup-slot" class="add-slot">${dupHtml()}</div>
      </section>

      <div class="add-grid">
        <section class="add-card add-dim">
          ${h2('mean', 'Nghĩa & phát âm')}
          <label class="add-field">Nghĩa tiếng Việt *
            <textarea id="add-vi" class="add-ta${missV ? ' is-error' : ''}" rows="1" data-field="vi" placeholder="Nghĩa của từ…"${missV ? raw(' aria-invalid="true"') : ''}>${f.vi}</textarea>
          </label>
          <div class="add-grid2">
            <label class="add-field">IPA · UK<input id="add-ipa" type="text" class="add-input" data-field="ipa" value="${f.ipa}" placeholder="/…/" autocomplete="off" spellcheck="false"></label>
            <label class="add-field">IPA · US<input id="add-ipaus" type="text" class="add-input" data-field="ipaUs" value="${f.ipaUs}" placeholder="/…/" autocomplete="off" spellcheck="false"></label>
          </div>
          <div class="add-pos">
            <span id="add-pos-l" class="add-label">Loại từ</span>
            <div role="radiogroup" aria-labelledby="add-pos-l" class="add-chips">${posChips()}</div>
          </div>
        </section>

        <section class="add-card add-dim">
          ${h2('img', 'Hình minh hoạ')}
          ${imageSection()}
          <input type="file" id="add-file" class="sr-only" accept="image/*" tabindex="-1" aria-hidden="true">
        </section>
      </div>

      <section class="add-card add-dim">
        ${h2('ex', 'Câu ví dụ')}
        ${exRows()}
        <button type="button" class="add-ex-add" data-action="exAdd">+ Thêm câu</button>
      </section>

      <section class="add-card add-dim">
        ${h2('gram', 'Ngữ pháp & ghi chú')}
        <label class="add-field">Ngữ pháp &amp; collocation
          <textarea id="add-gram" class="add-ta add-ta-15 add-ta-gram" rows="1" data-field="gram" placeholder="Cấu trúc, giới từ đi kèm…">${f.gram}</textarea>
        </label>
        <label class="add-field">Đồng nghĩa / trái nghĩa
          <input id="add-syn" type="text" class="add-input" data-field="syn" value="${f.syn}" placeholder="tough, strong / fragile" autocomplete="off">
        </label>
        <label class="add-field">Ghi chú của bạn
          <textarea id="add-note" class="add-ta add-ta-15" rows="1" data-field="note" placeholder="Mẹo nhớ, ngữ cảnh gặp từ…">${f.note}</textarea>
        </label>
      </section>
    </div></div>
    <footer class="add-bar"><div class="add-bar-inner">
      <div id="add-miss-slot" class="add-slot add-miss-slot">${missingHtml()}</div>
      <button type="button" class="add-btn-next" data-action="saveNext">Lưu &amp; thêm tiếp</button>
      <button type="button" class="add-btn-save" data-action="save">Lưu từ</button>
    </div></footer>`;
  }

  /* ---------------- in-place DOM updates ---------------- */
  const $ = (id) => document.getElementById(id);
  function paintDup() { const s = $('add-dup-slot'); if (s) s.innerHTML = String(dupHtml()); }
  function paintMissing() {
    const s = $('add-miss-slot'); if (s) s.innerHTML = String(missingHtml());
    const mw = ui.tried && !f.w.trim(), mv = ui.tried && !f.vi.trim();
    [['add-word', mw], ['add-vi', mv]].forEach(([id, bad]) => {
      const el = $(id); if (!el) return;
      el.classList.toggle('is-error', bad);
      if (bad) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
    });
    const ai = $('add-ai'); if (ai) ai.classList.toggle('is-off', !f.w.trim());
  }
  const checkDup = VL.debounce(() => { if (!f) return; ui.dupKey = findDup(); paintDup(); }, 250);

  /* ---------------- AI ---------------- */
  // AI reply (word shape) → form shape
  function toForm(s) {
    const out = {};
    ['vi', 'ipa', 'ipaUs', 'def', 'cefr', 'gram', 'note'].forEach((k) => { if (s[k]) out[k] = s[k]; });
    if (s.pos) out.pos = s.pos;
    if (s.examples && s.examples.length) out.examples = s.examples.map((e) => ({ en: e.en, vi: e.vi || '' }));
    if ((s.syn && s.syn.length) || (s.ant && s.ant.length)) out.syn = synText(s.syn, s.ant);
    return out;
  }
  // Which suggestion section feeds each form field (used to re-ask for anything the 'all' reply left out).
  const SECTION_OF = { pos: 'basic', ipa: 'basic', ipaUs: 'basic', vi: 'basic', examples: 'ex', gram: 'more', syn: 'more', note: 'more' };
  const isEmpty = (k) => (k === 'examples' ? !f.examples.some((e) => e && (e.en || '').trim()) : !String(f[k] || '').trim());
  /** Apply an AI reply. overwrite=true (the button): replace every field the AI returned (the word itself never
      changes; fields the AI left out keep their value). overwrite=false (auto-fill on blur): fill empty fields only.
      Returns the form keys the reply covered. */
  function applySuggestion(sugg, overwrite) {
    const got = toForm(sugg);
    delete got.w; delete got.img;
    if (overwrite) Object.keys(got).forEach((k) => { if (k in f) f[k] = got[k]; });
    else {
      const merged = VL.ai.fillEmpty({ ...f, examples: isEmpty('examples') ? [] : f.examples }, got);
      Object.keys(got).forEach((k) => { if (k in f && isEmpty(k)) f[k] = merged[k]; });
    }
    if (!f.examples.length) f.examples = [{ en: '', vi: '' }];
    return Object.keys(got);
  }

  /** One AI call ('all') fills every section + image. Button: overwrites (Hoàn tác restores); auto-fill: empty fields only. */
  async function runAI(auto) {
    const word = (f.w || '').trim();
    if (!word) { VL.ui.toast('Nhập từ trước khi gợi ý.'); const el = $('add-word'); if (el) el.focus(); return; }
    if (loading()) return;
    const myGen = gen;
    const snap = { f: clone(f), imgAI: ui.imgAI };
    const before = JSON.stringify(f);
    const prevStatus = ui.status;
    ui.status = 'loading';
    VL.refresh();
    let ok = false;
    try {
      // Automatic fill (on blur) never opens the key prompt; the explicit button may.
      const ctx = { vi: f.vi.trim(), silent: !!auto };
      const sugg = await VL.ai.suggest(word, 'all', ctx);
      if (myGen !== gen) return;
      const overwrite = !auto;
      const covered = applySuggestion(sugg, overwrite);
      // The model sometimes drops a section from the combined reply: ask again just for those.
      const missing = Array.from(new Set(Object.keys(SECTION_OF).filter((k) => covered.indexOf(k) < 0 && (overwrite || isEmpty(k))).map((k) => SECTION_OF[k])));
      const wantImg = overwrite || !f.img;
      const imgP = wantImg ? VL.media.image({ w: word, pos: f.pos, def: f.def }).catch(() => null) : Promise.resolve(null);
      const extra = await Promise.all(missing.map((sec) => VL.ai.suggest(word, sec, ctx).catch(() => null)));
      if (myGen !== gen) return;
      extra.forEach((x) => { if (x) applySuggestion(x, overwrite); });
      const url = await imgP;
      if (myGen !== gen) return;
      if (url && wantImg) { f.img = url; ui.imgAI = true; }
      ok = true;
      if (JSON.stringify(f) === before) {
        if (!auto) VL.ui.toast('AI không có gợi ý mới cho từ này.');
        ui.status = prevStatus === 'filled' ? 'filled' : 'idle';
      } else {
        ui.status = 'filled';
        ui.snapshot = snap;
      }
      if (ui.tried) paintMissing();
    } catch (e) {
      if (myGen === gen && !auto) VL.ui.toast((e && e.message) || 'AI lỗi, thử lại nhé.', 'error');
    } finally {
      if (myGen === gen) {
        if (!ok) ui.status = prevStatus;
        VL.refresh();
      }
    }
  }

  /* ---------------- save ---------------- */
  function collect() {
    const ss = parseSyn(f.syn);
    return {
      w: f.w.trim(), vi: f.vi.trim(), pos: f.pos, ipa: f.ipa.trim(), ipaUs: f.ipaUs.trim(), def: f.def, cefr: f.cefr,
      examples: f.examples.map((e) => ({ en: e.en, vi: e.vi })), gram: f.gram, syn: ss.syn, ant: ss.ant, note: f.note, img: f.img.trim()
    };
  }
  function doSave() {
    if (ui.leaving) return null; // already saved, navigation pending (double click / double Enter)
    if (isMissing()) {
      ui.tried = true;
      paintMissing();
      const el = $(!f.w.trim() ? 'add-word' : 'add-vi'); if (el) el.focus();
      return null;
    }
    const data = collect();
    let key;
    if (ui.editKey) {
      key = VL.words.save(data, { key: ui.editKey });
      if (data.img !== ui.origImg || data.w !== ui.origW) { VL.media.forget(ui.origW); VL.media.forget(data.w); }
    } else {
      key = VL.words.save(data, { deck: ui.deck });
      VL.media.forget(data.w);
    }
    return key;
  }

  /* ---------------- mount ---------------- */
  function mount(root) {
    if (ui.notFound) return;
    const fileIn = root.querySelector('#add-file');
    const offClick = VL.ui.delegate(root, {
      ai: () => runAI(false),
      undo: () => {
        if (!ui.snapshot) return;
        gen++;
        f = ui.snapshot.f; ui.imgAI = ui.snapshot.imgAI;
        ui.snapshot = null; ui.status = 'idle';
        ui.dupKey = findDup();
        VL.refresh();
        const el = $('add-ai'); if (el) el.focus();
      },
      pos: (el) => { const v = el.getAttribute('data-value'); f.pos = f.pos === v ? '' : v; VL.refresh(); },
      exAdd: () => { f.examples.push({ en: '', vi: '' }); VL.refresh(); const el = $('add-ex-en-' + (f.examples.length - 1)); if (el) el.focus(); },
      exDel: (el) => {
        const i = +el.getAttribute('data-i');
        f.examples.splice(i, 1);
        VL.refresh();
        const next = $('add-ex-en-' + Math.min(i, f.examples.length - 1));
        (next || root.querySelector('[data-action="exAdd"]')).focus();
      },
      imgPick: () => { if (fileIn) { fileIn.value = ''; fileIn.click(); } },
      imgDel: () => { f.img = ''; ui.imgAI = false; VL.refresh(); const el = root.querySelector('[data-action="imgPick"]'); if (el) el.focus(); },
      saveNext: () => {
        const key = doSave();
        if (!key) return;
        const w = VL.words.get(key);
        const deckName = (VL.CATALOG[ui.deck] || VL.CATALOG.mine).name;
        if (ui.editKey) { ui.leaving = true; VL.ui.toast('Đã lưu “' + (w ? w.w : '') + '”'); VL.go(VL.href.add({ deck: ui.deck })); return; }
        VL.ui.toast('Đã lưu “' + (w ? w.w : '') + '” vào ' + deckName);
        gen++; // drop pending AI replies for the previous word
        f = blankForm();
        ui = freshUi({ deck: ui.deck, autoDone: ui.autoDone });
        VL.refresh();
        const el = $('add-word'); if (el) el.focus();
      },
      save: () => {
        const key = doSave();
        if (!key) return;
        ui.leaving = true;
        const w = VL.words.get(key);
        VL.ui.toast(ui.editKey ? 'Đã lưu thay đổi' : 'Đã lưu “' + (w ? w.w : '') + '”');
        gen++;
        VL.go(VL.href.word(key), !!ui.editKey);
      }
    });
    const onFile = () => {
      const file = fileIn.files && fileIn.files[0];
      if (!file) return;
      const myGen = gen;
      VL.media.fileToDataURL(file).then((url) => {
        if (myGen !== gen) return;
        f.img = url; ui.imgAI = false;
        VL.refresh();
        const el = root.querySelector('[data-action="imgPick"]'); if (el) el.focus();
      }).catch((e) => VL.ui.toast((e && e.message) || 'Không đọc được ảnh.', 'error'));
    };
    const onInput = (e) => {
      const el = e.target;
      const field = el.getAttribute('data-field');
      if (field) {
        f[field] = el.value;
        if (field === 'w') checkDup();
        if (field === 'w' || field === 'vi') paintMissing();
        return;
      }
      if (el.hasAttribute('data-ex')) {
        const i = +el.getAttribute('data-ex');
        if (f.examples[i]) f.examples[i][el.getAttribute('data-part')] = el.value;
      }
    };
    const onBlur = (e) => {
      if (e.target.id !== 'add-word') return;
      setTimeout(() => {
        const active = document.activeElement;
        if (active && active.id === 'add-word') return; // re-render restored focus
        const word = (f.w || '').trim();
        const set = VL.store.settings();
        if (ui.editKey || !word || f.vi.trim() || !(set.sw && set.sw.auto) || !VL.ai.hasKey()) return;
        const nk = VL.norm(word);
        if (ui.autoDone[nk] || loading()) return;
        ui.autoDone[nk] = true;
        runAI(true);
      }, 0);
    };
    const onKey = (e) => {
      // Enter in the word field moves to the meaning (no implicit submit).
      if (e.key === 'Enter' && e.target.id === 'add-word' && !e.isComposing) { e.preventDefault(); const v = $('add-vi'); if (v) v.focus(); }
    };
    // A broken image URL falls back to the upload state.
    const onImgErr = (e) => { if (e.target.id === 'add-img') { e.target.closest('.add-img-box').classList.add('is-broken'); } };
    root.addEventListener('input', onInput);
    root.addEventListener('focusout', onBlur);
    root.addEventListener('keydown', onKey);
    root.addEventListener('error', onImgErr, true);
    if (fileIn) fileIn.addEventListener('change', onFile);
    return () => {
      offClick();
      root.removeEventListener('input', onInput);
      root.removeEventListener('focusout', onBlur);
      root.removeEventListener('keydown', onKey);
      root.removeEventListener('error', onImgErr, true);
      if (fileIn) fileIn.removeEventListener('change', onFile);
    };
  }

  VL.page('add', {
    nav: 'add',
    title: () => (ui && ui.editKey ? 'Sửa từ' : 'Thêm từ'),
    enter,
    render,
    mount
  });
})();
