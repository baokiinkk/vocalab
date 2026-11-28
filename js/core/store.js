/* VocaLab — persistent state in localStorage (no server).
   Key "vocalab.v1" holds: settings, custom words, overrides of built-in words, progress per word,
   user's decks, streak, day log and session history. Image/AI/dictionary caches use separate keys
   (see media.js / ai.js) so they never bloat the main save. */
(function () {
  'use strict';
  const VL = window.VL;
  const KEY = 'vocalab.v1';
  const BACKUP_KEY = 'vocalab.backup';

  /** No key is shipped in the code (public repo). The user enters their own GROQ key (Cài đặt or the prompt shown on first AI use);
      it is stored only in this browser's localStorage. */
  VL.DEFAULT_GROQ_KEY = '';

  VL.DEFAULT_SETTINGS = {
    freq: 'daily',                       // daily | weekly | free
    days: { T2: true, T4: true, T6: true }, // used when freq === 'weekly'
    remindAt: '20:00',
    count: 24,                           // words per "Ôn hôm nay" session (5..50 step 5)
    fresh: 10,                           // new words per day per deck (default for new decks)
    modes: { flash: true, mean: true, fill: true }, // default practice modes
    order: 'mix',                        // mix | seq
    pen: 20,                             // % subtracted on a wrong answer (10 | 20 | 30)
    exn: 2,                              // AI example sentences (1..3)
    voice: 'uk',                         // uk | us
    speed: 'normal',                     // reading speed: slow | normal | fast (Cài đặt → Giọng phát âm)
    lang: 'vi',                          // AI explanation language: vi | en
    theme: 'sys',                        // light | dark | sys
    size: 'm',                           // flashcard font size s | m | l
    sw: { notify: true, streak: true, prio: true, review: true, flash: true, auto: true, backup: true, again: true, autoSpeak: true }, // again: 2nd reminder · autoSpeak: read words aloud
    groqKey: VL.DEFAULT_GROQ_KEY,
    groqModel: 'openai/gpt-oss-120b'
  };

  const fresh = () => ({
    v: 1,
    createdAt: Date.now(),
    settings: JSON.parse(JSON.stringify(VL.DEFAULT_SETTINGS)),
    custom: {},       // key -> word object created by the user ("Từ của tôi" or attached to a deck)
    overrides: {},    // key -> partial word fields edited by the user for built-in words
    progress: {},     // key -> { s, st, t, c, x, n, i, h:[{t,m,ok,b,a}] }
    decks: {},        // deckId -> { addedAt, perDay } ; 'mine' is implicit and always present
    extraDeck: {},    // key -> [deckIds] extra deck memberships added via "+ Thêm vào bộ"
    streak: { count: 0, last: null, best: 0 },
    days: {},         // dayKey -> { n: answers, ok: correct, fresh: {deckId: count}, ms: active ms, avg: mastery snapshot }
    sessions: [],     // finished sessions (last 50)
    session: null,    // the session in progress
    lastBackup: null
  });

  let state = null;
  const deepMerge = (base, extra) => {
    if (!extra || typeof extra !== 'object' || Array.isArray(extra)) return extra === undefined ? base : extra;
    const out = Array.isArray(base) ? base.slice() : { ...base };
    Object.keys(extra).forEach((k) => {
      out[k] = base && typeof base[k] === 'object' && !Array.isArray(base[k]) && base[k] !== null ? deepMerge(base[k], extra[k]) : extra[k];
    });
    return out;
  };

  const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
  /** Repair a loaded/imported save: wrong types from old versions or hand-edited files must never crash a page. */
  function sanitize(s) {
    ['settings', 'custom', 'overrides', 'progress', 'decks', 'extraDeck', 'days'].forEach((k) => { if (!isObj(s[k])) s[k] = k === 'settings' ? JSON.parse(JSON.stringify(VL.DEFAULT_SETTINGS)) : {}; });
    if (!Array.isArray(s.sessions)) s.sessions = [];
    s.sessions = s.sessions.filter((x) => isObj(x) && Array.isArray(x.results)).map((x) => ({ ...x, wrongKeys: Array.isArray(x.wrongKeys) ? x.wrongKeys : [] }));
    if (!isObj(s.streak)) s.streak = { count: 0, last: null, best: 0 };
    const set = s.settings;
    Object.keys(VL.DEFAULT_SETTINGS).forEach((k) => {
      const d = VL.DEFAULT_SETTINGS[k];
      if (isObj(d) ? !isObj(set[k]) : typeof set[k] !== typeof d) set[k] = isObj(d) ? JSON.parse(JSON.stringify(d)) : d;
    });
    Object.keys(s.progress).forEach((k) => {
      const p = s.progress[k];
      if (!isObj(p)) { delete s.progress[k]; return; }
      p.s = VL.clamp(num(p.s, 0), 0, 100); p.st = Math.max(0.5, num(p.st, 0.5)); p.t = num(p.t, 0);
      p.c = num(p.c, 0); p.x = num(p.x, 0); p.n = num(p.n, 0); p.i = num(p.i, p.t || Date.now());
      if (!Array.isArray(p.h)) p.h = [];
    });
    Object.keys(s.custom).forEach((k) => { const w = s.custom[k]; if (!isObj(w) || !w.w) delete s.custom[k]; else if (!w.deck) w.deck = 'mine'; });
    Object.keys(s.overrides).forEach((k) => { if (!isObj(s.overrides[k])) delete s.overrides[k]; });
    Object.keys(s.decks).forEach((k) => { if (!isObj(s.decks[k])) s.decks[k] = {}; const d = s.decks[k]; d.addedAt = num(d.addedAt, 0); d.perDay = num(d.perDay, set.fresh); });
    Object.keys(s.extraDeck).forEach((k) => { if (!Array.isArray(s.extraDeck[k])) delete s.extraDeck[k]; });
    Object.keys(s.days).forEach((k) => { const d = s.days[k]; if (!isObj(d)) { delete s.days[k]; return; } d.n = num(d.n, 0); d.ok = num(d.ok, 0); d.ms = num(d.ms, 0); if (!isObj(d.fresh)) d.fresh = {}; });
    const ss = s.session;
    if (ss && !(isObj(ss) && Array.isArray(ss.queue) && ss.queue.length && Array.isArray(ss.results) && typeof ss.idx === 'number')) s.session = null;
    else if (ss) { ss.queue = ss.queue.filter((q) => isObj(q) && q.key && q.mode); ss.idx = VL.clamp(Math.floor(ss.idx), 0, ss.queue.length); if (!Array.isArray(ss.modes)) ss.modes = ['flash']; if (!ss.queue.length) s.session = null; }
    return s;
  }

  function load() {
    let saved = VL.ls.get(KEY, null);
    if (saved && (typeof saved !== 'object' || saved.v !== 1)) {
      // Unreadable / unknown save: keep a copy instead of silently overwriting it on the next save.
      try { const rawSave = localStorage.getItem(KEY); if (rawSave) localStorage.setItem(KEY + '.unreadable', rawSave); } catch (e) { /* ignore */ }
      saved = null;
    } else if (saved == null) {
      try { const rawSave = localStorage.getItem(KEY); if (rawSave) { localStorage.setItem(KEY + '.unreadable', rawSave); } } catch (e) { /* ignore */ }
    }
    state = saved ? sanitize(deepMerge(fresh(), saved)) : fresh();
    // settings.modes/days are "set" maps: keep exactly what the user saved, not merged with defaults.
    if (saved && saved.settings) {
      if (saved.settings.modes) state.settings.modes = saved.settings.modes;
      if (saved.settings.days) state.settings.days = saved.settings.days;
    }
    // Groq retired llama-3.3-70b-versatile; move old saves to the current default model.
    if (state.settings.groqModel === 'llama-3.3-70b-versatile') state.settings.groqModel = VL.DEFAULT_SETTINGS.groqModel;
    if (!saved) {
      // First run: start with the two decks shown as "Bộ của tôi" in the design.
      state.decks.comm = { addedAt: Date.now(), perDay: 10 };
      state.decks.ielts = { addedAt: Date.now(), perDay: 10 };
    }
    return state;
  }

  let saveTimer = null;
  const store = (VL.store = {
    KEY,
    get state() { return state || load(); },
    load,
    /** Persist now and notify listeners ("change"). */
    save() {
      clearTimeout(saveTimer); saveTimer = null;
      store.persist();
      VL.emit('change');
    },
    /** Write the save to localStorage. When the browser storage is full, drop the re-creatable caches (images, AI,
        backup copy) and retry; if it still fails, tell the user instead of silently losing data. Returns true on success. */
    persist() {
      if (VL.ls.set(KEY, state)) { store.quotaWarned = false; return true; }
      ['vocalab.imgcache', 'vocalab.aicache', BACKUP_KEY].forEach((k) => VL.ls.del(k));
      if (VL.emit) VL.emit('quota');
      if (VL.ls.set(KEY, state)) return true;
      if (!store.quotaWarned && VL.ui && VL.ui.toast) {
        store.quotaWarned = true;
        // deferred so a page's own "Đã lưu" toast right after save() cannot hide the warning
        setTimeout(() => VL.ui.toast('Bộ nhớ trình duyệt đã đầy — thay đổi chưa được lưu. Hãy xoá bớt ảnh tải lên hoặc xuất dữ liệu trong Cài đặt.', 'error', 6000), 0);
      }
      return false;
    },
    /** Persist soon (coalesces bursts of writes). */
    saveSoon() { clearTimeout(saveTimer); saveTimer = setTimeout(() => store.save(), 150); },
    /** Mutate state through a function, then save. */
    update(fn) { fn(store.state); store.save(); },

    settings() { return store.state.settings; },
    /** Set a setting by dotted path, e.g. setSetting('sw.notify', false). */
    setSetting(path, value) {
      const parts = path.split('.');
      let o = store.state.settings;
      for (let i = 0; i < parts.length - 1; i++) { o[parts[i]] = o[parts[i]] || {}; o = o[parts[i]]; }
      o[parts[parts.length - 1]] = value;
      store.save();
      VL.emit('settings', path);
    },

    /** Whole save as a pretty JSON string. */
    exportJSON() { return JSON.stringify({ app: 'VocaLab', exportedAt: new Date().toISOString(), data: store.state }, null, 2); },
    /** Replace the save from an export string. Returns true on success. */
    importJSON(text) {
      const obj = JSON.parse(text);
      const data = obj && obj.data ? obj.data : obj;
      if (!data || data.v !== 1) throw new Error('File không đúng định dạng VocaLab');
      state = sanitize(deepMerge(fresh(), data));
      store.save();
      VL.emit('settings', '*');
      return true;
    },
    /** Download the export as a file (no dialogs). */
    download(filename, text, mime) {
      const blob = new Blob([text], { type: mime || 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    },
    /** Copy the save into a separate backup key. */
    backupNow() {
      const ok = VL.ls.set(BACKUP_KEY, { at: Date.now(), data: store.state });
      if (ok) { store.state.lastBackup = Date.now(); store.save(); }
      return ok;
    },
    restoreBackup() { const b = VL.ls.get(BACKUP_KEY, null); if (!b) return false; if (!b.data || b.data.v !== 1) return false; state = sanitize(deepMerge(fresh(), b.data)); store.save(); return true; },
    /** Auto backup once per day when enabled. */
    autoBackup() {
      const s = store.state;
      if (s.settings.sw.backup && (!s.lastBackup || VL.dayKey(s.lastBackup) !== VL.dayKey())) store.backupNow();
    },
    /** Wipe everything (used by tests). */
    wipe() { VL.ls.del(KEY); state = null; load(); store.save(); }
  });

  load();
})();
