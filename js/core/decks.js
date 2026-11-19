/* VocaLab — deck catalog and word access.
   Built-in deck word lists live in data/decks/<id>.js and call VL.registerDeck(id, rows).
   Row format: [word, pos, ipaUK, vi, exampleEn, exampleVi, cefr]
     pos: n | v | adj | adv | phr (phrasal verb) | idiom | prep | conj | pron | det | int | exp (expression)
   A word is addressed by a key "<deckId>:<slug>"; user-created words use "mine:<slug>". */
(function () {
  'use strict';
  const VL = window.VL;

  const D = (id, abbr, name, kind, level, bg, fg, desc, cat) => ({ id, abbr, name, kind, level, bg, fg, desc, cat, builtIn: id !== 'mine' });
  /** Deck catalog (colors & copy from the design). `n` (word count) is computed from the data files. */
  VL.CATALOG = {
    mine: D('mine', 'TC', 'Từ của tôi', 'Bộ cá nhân', 'Tự thêm', '#1C1C22', '#FFFFFF', 'Những từ bạn tự nhập. Khi thêm từ mới, từ sẽ luôn được lưu vào đây.', null),
    comm: D('comm', 'GT', '300 từ giao tiếp thông dụng', 'Giao tiếp · Bộ có sẵn', 'A2–B1', '#ECEEF8', '#2E3A80', 'Những từ dùng nhiều nhất khi nói chuyện hằng ngày.', 'talk'),
    phr: D('phr', 'PV', '200 phrasal verbs thông dụng', 'Giao tiếp · Bộ có sẵn', 'B1–B2', '#E5F0EF', '#2C625E', 'Cụm động từ người bản xứ dùng hằng ngày.', 'talk'),
    idiom: D('idiom', 'ID', '150 thành ngữ hay dùng', 'Giao tiếp · Bộ có sẵn', 'B2', '#F6EAEE', '#8C3A58', 'Thành ngữ quen thuộc trong hội thoại và phim ảnh.', 'talk'),
    daily: D('daily', 'HN', '300 từ vựng hằng ngày', 'Hằng ngày · Bộ có sẵn', 'A1–A2', '#E7F2EC', '#2A6B4B', 'Nhà cửa, đồ ăn, mua sắm, thời tiết, đi lại.', 'life'),
    travel: D('travel', 'DL', '300 từ du lịch', 'Hằng ngày · Bộ có sẵn', 'A2–B1', '#F6EAEE', '#8C3A58', 'Sân bay, khách sạn, hỏi đường, đặt chỗ.', 'life'),
    food: D('food', 'AU', '200 từ ăn uống & nấu ăn', 'Hằng ngày · Bộ có sẵn', 'A2', '#F8EDE4', '#94461F', 'Món ăn, nguyên liệu, cách nấu, gọi món.', 'life'),
    it: D('it', 'IT', '300 từ IT & công nghệ', 'Chuyên ngành · Bộ có sẵn', 'B1–B2', '#E5F0EF', '#2C625E', 'Phần mềm, mạng, dữ liệu, bảo mật.', 'pro'),
    work: D('work', 'VP', '300 từ văn phòng & kinh doanh', 'Chuyên ngành · Bộ có sẵn', 'B1–B2', '#F6F0E1', '#7A5A1E', 'Họp, email, báo cáo, đàm phán.', 'pro'),
    mkt: D('mkt', 'MK', '300 từ marketing', 'Chuyên ngành · Bộ có sẵn', 'B1–B2', '#F6EAEE', '#8C3A58', 'Chiến dịch, khách hàng, số liệu, thương hiệu.', 'pro'),
    toeic: D('toeic', 'TO', '600 từ TOEIC thiết yếu', 'Luyện thi · Bộ có sẵn', 'B1–B2', '#F8EDE4', '#94461F', 'Từ hay gặp trong TOEIC Listening & Reading, chia theo chủ đề công sở: hợp đồng, tài chính, nhân sự, mua sắm…', 'exam'),
    ielts: D('ielts', 'IE', 'IELTS Academic Word List', 'Luyện thi · Bộ có sẵn', 'B2–C1', '#F1ECF6', '#5E3F87', 'Từ học thuật cho IELTS Reading & Writing.', 'exam'),
    iw: D('iw', 'IW', 'IELTS Writing theo chủ đề', 'Luyện thi · Bộ có sẵn', 'B2–C1', '#ECEEF8', '#2E3A80', 'Từ vựng theo chủ đề Writing Task 2: môi trường, giáo dục, công nghệ…', 'exam')
  };
  /** Library categories (Thư viện page). */
  VL.CATS = [
    { id: 'talk', title: 'Giao tiếp', sub: 'Nói chuyện tự nhiên mỗi ngày', ids: ['comm', 'phr', 'idiom'] },
    { id: 'life', title: 'Hằng ngày', sub: 'Nhà cửa, ăn uống, mua sắm, đi lại', ids: ['daily', 'travel', 'food'] },
    { id: 'pro', title: 'Chuyên ngành', sub: 'Từ vựng theo lĩnh vực công việc', ids: ['it', 'work', 'mkt'] },
    { id: 'exam', title: 'Luyện thi', sub: 'TOEIC, IELTS', ids: ['toeic', 'ielts', 'iw'] }
  ];
  VL.POS_LABEL = { n: 'Danh từ', v: 'Động từ', adj: 'Tính từ', adv: 'Trạng từ', phr: 'Cụm động từ', idiom: 'Thành ngữ', prep: 'Giới từ', conj: 'Liên từ', pron: 'Đại từ', det: 'Hạn định từ', int: 'Thán từ', exp: 'Cụm từ' };
  VL.POS_SHORT = { n: 'n.', v: 'v.', adj: 'adj.', adv: 'adv.', phr: 'phr. v.', idiom: 'idiom', prep: 'prep.', conj: 'conj.', pron: 'pron.', det: 'det.', int: 'int.', exp: 'phr.' };

  const builtin = {};   // deckId -> [key...]
  const rowsByKey = {}; // key -> built-in word object

  /** Called by data/decks/*.js */
  VL.registerDeck = function (id, rows) {
    const keys = [];
    const seen = {};
    rows.forEach((r) => {
      if (!r || !r[0]) return;
      const slug = VL.slug(r[0]);
      if (!slug || seen[slug]) return;
      seen[slug] = 1;
      const key = id + ':' + slug;
      rowsByKey[key] = {
        key, w: r[0], pos: r[1] || '', ipa: r[2] || '', vi: r[3] || '',
        examples: r[4] ? [{ en: r[4], vi: r[5] || '' }] : [], cefr: r[6] || '', deck: id, custom: false
      };
      keys.push(key);
    });
    builtin[id] = keys;
    if (VL.CATALOG[id]) VL.CATALOG[id].n = keys.length;
  };

  const st = () => VL.store.state;

  /* ---------------- words ---------------- */
  const words = (VL.words = {
    /** Full word object (built-in merged with user overrides, or custom), or null. */
    get(key) {
      if (!key) return null;
      const s = st();
      const base = s.custom[key] || rowsByKey[key];
      if (!base) return null;
      const w = { ipaUs: '', def: '', gram: '', syn: [], ant: [], note: '', img: '', ...base, ...(s.overrides[key] || {}) };
      w.key = key;
      w.decks = [w.deck].concat(s.extraDeck[key] || []);
      w.deckObj = VL.CATALOG[w.deck];
      w.posLabel = VL.POS_LABEL[w.pos] || w.pos || '';
      return w;
    },
    exists(key) { return !!(st().custom[key] || rowsByKey[key]); },
    /** Keys of words belonging to a deck (built-in rows + custom words saved into it + extra memberships). */
    inDeck(deckId) {
      const s = st();
      const out = (builtin[deckId] || []).slice();
      Object.keys(s.custom).forEach((k) => { if (s.custom[k].deck === deckId) out.push(k); });
      Object.keys(s.extraDeck).forEach((k) => { if ((s.extraDeck[k] || []).indexOf(deckId) >= 0 && out.indexOf(k) < 0 && words.exists(k)) out.push(k); });
      return out;
    },
    /** Keys of every word in the user's library (Từ của tôi + every added deck). De-duplicated by key. */
    library() {
      const set = new Set();
      decks.mineIds().forEach((id) => words.inDeck(id).forEach((k) => set.add(k)));
      return Array.from(set);
    },
    /** Find an existing word by its text inside the user's library (or a given deck). Returns key or null. */
    findByText(text, deckId) {
      const slug = VL.slug(text);
      if (!slug) return null;
      const pool = deckId ? words.inDeck(deckId) : words.library();
      return pool.find((k) => k.split(':').slice(1).join(':') === slug) || null;
    },
    /** Search all words (library + every built-in deck). Matches English word or Vietnamese meaning, diacritics-insensitive.
        Returns [{key, w, vi, deck, deckName, inLibrary}] sorted: prefix matches first. */
    search(q, limit) {
      const qq = VL.norm(q);
      if (!qq) return [];
      const lib = new Set(words.library());
      const seenText = {};
      const hits = [];
      const consider = (key) => {
        const w = words.get(key);
        if (!w) return;
        const wn = VL.norm(w.w), vn = VL.norm(w.vi);
        let rank = -1;
        if (wn === qq) rank = 0; else if (wn.startsWith(qq)) rank = 1; else if (wn.includes(qq)) rank = 2; else if (vn.includes(qq)) rank = 3;
        if (rank < 0) return;
        const prev = seenText[wn];
        const inLib = lib.has(key);
        if (prev && (prev.inLibrary || !inLib)) return; // one hit per word text, prefer the one in the library
        const hit = { key, w: w.w, vi: w.vi, deck: w.deck, deckName: (VL.CATALOG[w.deck] || {}).name || '', inLibrary: inLib, rank: rank + (inLib ? 0 : 0.5) };
        if (prev) hits.splice(hits.indexOf(prev), 1, hit); else hits.push(hit);
        seenText[wn] = hit;
      };
      Object.keys(st().custom).forEach(consider);
      Object.keys(rowsByKey).forEach(consider);
      hits.sort((a, b) => a.rank - b.rank || a.w.length - b.w.length || a.w.localeCompare(b.w));
      return hits.slice(0, limit || 50);
    },
    /** Create or update a word. data: {w, vi, pos, ipa, ipaUs, def, examples:[{en,vi}], gram, syn:[], ant:[], note, img, cefr}.
        opts.key: edit that word. opts.deck: target deck for a new word (default 'mine').
        Returns the key. Built-in words are edited through overrides. */
    save(data, opts) {
      opts = opts || {};
      const s = st();
      const clean = { ...data };
      ['w', 'vi', 'ipa', 'ipaUs', 'def', 'gram', 'note', 'img', 'pos', 'cefr'].forEach((f) => { if (typeof clean[f] === 'string') clean[f] = clean[f].trim(); });
      if ('examples' in clean) clean.examples = (clean.examples || []).filter((e) => e && (e.en || '').trim()).map((e) => ({ en: e.en.trim(), vi: (e.vi || '').trim() }));
      ['syn', 'ant'].forEach((f) => { if (typeof clean[f] === 'string') clean[f] = clean[f].split(/[,;·\n]/).map((x) => x.trim()).filter(Boolean); });
      if (opts.key && words.exists(opts.key)) {
        const key = opts.key;
        if (s.custom[key]) s.custom[key] = { ...s.custom[key], ...clean, key, updatedAt: Date.now() };
        else s.overrides[key] = { ...(s.overrides[key] || {}), ...clean };
        VL.store.save();
        return key;
      }
      const deck = opts.deck || 'mine';
      let key = deck + ':' + VL.slug(clean.w);
      if (words.exists(key)) key = deck + ':' + VL.slug(clean.w) + '-' + VL.uid().slice(-4);
      s.custom[key] = { ...clean, key, deck, custom: true, createdAt: Date.now() };
      // Words the user types in themselves start learning right away (score 0, due now).
      VL.srs.start(key);
      VL.store.save();
      return key;
    },
    /** Delete a custom word (built-in words cannot be deleted, only their progress reset). */
    remove(key) {
      const s = st();
      if (s.custom[key]) delete s.custom[key];
      delete s.overrides[key];
      delete s.progress[key];
      delete s.extraDeck[key];
      VL.store.save();
    },
    /** Add an existing word to another deck ("+ Thêm vào bộ"). */
    addToDeck(key, deckId) {
      const s = st();
      const w = words.get(key);
      if (!w || w.deck === deckId) return;
      const list = s.extraDeck[key] || [];
      if (list.indexOf(deckId) < 0) list.push(deckId);
      s.extraDeck[key] = list;
      VL.store.save();
    },
    removeFromDeck(key, deckId) {
      const s = st();
      s.extraDeck[key] = (s.extraDeck[key] || []).filter((d) => d !== deckId);
      VL.store.save();
    }
  });

  /* ---------------- decks ---------------- */
  const decks = (VL.decks = {
    /** Catalog entry with live word count `n`. */
    get(id) {
      const d = VL.CATALOG[id];
      if (!d) return null;
      return { ...d, n: words.inDeck(id).length };
    },
    all() { return Object.keys(VL.CATALOG).map(decks.get); },
    builtInIds() { return Object.keys(VL.CATALOG).filter((id) => id !== 'mine'); },
    /** Ids of decks in "Bộ của tôi": always 'mine' first, then added decks in the order they were added. */
    mineIds() {
      const s = st();
      return ['mine'].concat(Object.keys(s.decks).filter((id) => VL.CATALOG[id]).sort((a, b) => s.decks[a].addedAt - s.decks[b].addedAt));
    },
    isAdded(id) { return id === 'mine' || !!st().decks[id]; },
    add(id, perDay) {
      if (id === 'mine' || !VL.CATALOG[id]) return;
      st().decks[id] = { addedAt: Date.now(), perDay: perDay != null ? perDay : st().settings.fresh };
      VL.store.save();
    },
    /** Remove from "Bộ của tôi". Progress is kept, so re-adding restores it. */
    remove(id) { if (id === 'mine') return; delete st().decks[id]; VL.store.save(); },
    perDay(id) { const d = st().decks[id]; return d ? d.perDay : st().settings.fresh; },
    setPerDay(id, n) { const d = st().decks[id]; if (d) { d.perDay = VL.clamp(n, 0, 50); VL.store.save(); } },
    /** Live statistics for a deck. */
    stats(id) {
      const keys = words.inDeck(id);
      const b = { weak: 0, learning: 0, good: 0, master: 0 };
      let sum = 0, started = 0, due = 0;
      keys.forEach((k) => {
        const p = st().progress[k];
        if (!p) return;
        started++;
        const sc = VL.srs.score(k);
        sum += sc;
        b[VL.srs.level(sc).id]++;
        if (VL.srs.isDue(k)) due++;
      });
      const total = keys.length;
      const freshLeft = total - started;
      const perDay = decks.perDay(id);
      return {
        total, started, due, fresh: freshLeft, buckets: b,
        // Mastery of the whole deck: unstarted words count as 0%.
        pct: total ? Math.round(sum / total) : 0,
        // Mastery of the words already started.
        startedPct: started ? Math.round(sum / started) : 0,
        daysToFinish: perDay > 0 ? Math.ceil(freshLeft / perDay) : null
      };
    }
  });
})();
