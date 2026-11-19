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
    lang: 'vi',                          // AI explanation language: vi | en
    theme: 'sys',                        // light | dark | sys
    size: 'm',                           // flashcard font size s | m | l
    sw: { notify: true, streak: true, prio: true, review: true, flash: true, auto: true, backup: true },
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

  function load() {
    const saved = VL.ls.get(KEY, null);
    state = saved && saved.v === 1 ? deepMerge(fresh(), saved) : fresh();
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
      VL.ls.set(KEY, state);
      VL.emit('change');
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
      state = deepMerge(fresh(), data);
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
    restoreBackup() { const b = VL.ls.get(BACKUP_KEY, null); if (!b) return false; state = deepMerge(fresh(), b.data); store.save(); return true; },
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
