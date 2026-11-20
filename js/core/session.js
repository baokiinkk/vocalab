/* VocaLab — practice session engine shared by Luyện tập, Flashcard, Chọn nghĩa (+ other quiz modes) and Kết quả.

   A session = an ordered queue of {key, mode}. Flashcard items are shown on #/flash, every other mode on #/quiz.
   Modes: flash (Flashcard), mean (Chọn nghĩa: word → meaning), word (Chọn từ: meaning → word),
          fill (Điền chỗ trống: example with the word blanked), listen (Nghe & chọn), type (Gõ chính tả). */
(function () {
  'use strict';
  const VL = window.VL;
  const st = () => VL.store.state;

  VL.MODES = [
    { id: 'flash', glyph: 'Aa', title: 'Flashcard', desc: 'Lật thẻ, tự đánh giá' },
    { id: 'mean', glyph: '1/4', title: 'Chọn nghĩa', desc: 'Từ → chọn nghĩa đúng' },
    { id: 'word', glyph: '4/1', title: 'Chọn từ', desc: 'Nghĩa → chọn từ đúng' },
    { id: 'fill', glyph: '_ _', title: 'Điền chỗ trống', desc: 'Hoàn thành câu ví dụ' },
    { id: 'listen', glyph: '♪', title: 'Nghe & chọn', desc: 'Nghe phát âm, chọn từ' },
    { id: 'type', glyph: 'Ab|', title: 'Gõ chính tả', desc: 'Gõ lại chính xác từ' }
  ];
  VL.modeTitle = (id) => (VL.MODES.find((m) => m.id === id) || { title: id }).title;

  /** Presets on the Luyện tập page. count/modes for 'today' come from Settings. */
  VL.PRESETS = [
    { id: 'today', glyph: '24', title: 'Ôn hôm nay', rec: true, bg: '#ECEEF8', fg: '#2E3A80' },
    { id: 'quick', glyph: '5′', title: 'Nhanh 5 phút', count: 10, modes: ['flash'], bg: '#E7F2EC', fg: '#2A6B4B' },
    { id: 'weak', glyph: '!', title: 'Cứu từ yếu', count: 15, modes: ['mean', 'word'], bg: '#F8EDE4', fg: '#94461F' },
    { id: 'new', glyph: '+', title: 'Học từ mới', count: 10, modes: ['flash', 'mean'], bg: '#F1ECF6', fg: '#5E3F87' }
  ];

  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  /** Irregular verb forms used by phrasal verbs / idioms in the decks. */
  const IRREG = {
    run: 'ran|runs|running', come: 'came|comes|coming', get: 'got|gotten|gets|getting', give: 'gave|given|gives|giving', go: 'went|gone|goes|going',
    take: 'took|taken|takes|taking', break: 'broke|broken|breaks|breaking', bring: 'brought|brings|bringing', buy: 'bought|buys|buying',
    catch: 'caught|catches|catching', do: 'did|done|does|doing', eat: 'ate|eaten|eats|eating', fall: 'fell|fallen|falls|falling',
    find: 'found|finds|finding', hold: 'held|holds|holding', keep: 'kept|keeps|keeping', leave: 'left|leaves|leaving', make: 'made|makes|making',
    put: 'puts|putting', set: 'sets|setting', sell: 'sold|sells|selling', steal: 'stole|stolen|steals|stealing', throw: 'threw|thrown|throws|throwing',
    see: 'saw|seen|sees|seeing', tell: 'told|tells|telling', think: 'thought|thinks|thinking', turn: 'turned|turns|turning', pull: 'pulled|pulls|pulling',
    hit: 'hits|hitting', cut: 'cuts|cutting', let: 'lets|letting', feel: 'felt|feels|feeling', stand: 'stood|stands|standing', speak: 'spoke|spoken|speaks|speaking',
    be: 'is|are|was|were|been|being|am', have: 'has|had|having', pay: 'paid|pays|paying', lay: 'laid|lays|laying', say: 'said|says|saying', drive: 'drove|driven|drives|driving',
    write: 'wrote|written|writes|writing', wear: 'wore|worn|wears|wearing', bite: 'bit|bitten|bites|biting', blow: 'blew|blown|blows|blowing', draw: 'drew|drawn|draws|drawing',
    grow: 'grew|grown|grows|growing', know: 'knew|known|knows|knowing', show: 'showed|shown|shows|showing', sleep: 'slept|sleeps|sleeping', spend: 'spent|spends|spending',
    stick: 'stuck|sticks|sticking', swim: 'swam|swum|swims|swimming', win: 'won|wins|winning', lose: 'lost|loses|losing', meet: 'met|meets|meeting', send: 'sent|sends|sending'
  };
  const POSS = "(?:\\w+'s|my|your|his|her|its|our|their)";
  /** Regex source for one token of a headword, allowing inflection. */
  const tokenRe = (t, inflect) => {
    if (/^(someone's|somebody's|one's)$/i.test(t)) return POSS;
    if (/^(someone|somebody|something|sb|sth)$/i.test(t)) return "(?:\\w+(?:\\s\\w+)?)";
    const e = escRe(t);
    if (!inflect) return e;
    const irr = IRREG[t.toLowerCase()];
    const stem = t.length > 3 ? escRe(t.replace(/(e|y)$/i, '')) : e;
    return '(?:' + (irr ? irr + '|' : '') + stem + '\\w*)';
  };
  /** Find the word (or an inflection of it) inside an example sentence. Returns {before, hit, after} or null. */
  VL.blankOut = function (sentence, word) {
    if (!sentence || !word) return null;
    const w = word.trim();
    const parts = w.split(/\s+/);
    const tries = [escRe(w)];
    if (parts.length === 1) tries.push(tokenRe(w, true));
    else {
      // phrasal verbs / idioms / compounds: first word may be inflected ("ran into"), last word may take a plural ("cold calls"),
      // "someone's" matches a possessive ("pull your leg").
      tries.push(parts.map((t, i) => tokenRe(t, i === 0)).join('\\s+'));
      tries.push(parts.map((t, i) => tokenRe(t, i === 0 || i === parts.length - 1)).join('\\s+'));
    }
    for (let i = 0; i < tries.length; i++) {
      const re = new RegExp('\\b(' + tries[i] + ')\\b', 'i');
      const m = sentence.match(re);
      if (m) return { before: sentence.slice(0, m.index), hit: m[1], after: sentence.slice(m.index + m[1].length) };
    }
    return null;
  };

  /** Whether a mode can be used for a word. */
  VL.modeOk = function (mode, w) {
    if (!w) return false;
    if (mode === 'fill') return !!(w.examples && w.examples.some((e) => VL.blankOut(e.en, w.w)));
    if (mode === 'listen') return !!(window.speechSynthesis || w.audio);
    return true;
  };

  /** Distractors for multiple-choice modes: 3 other words, same deck & part of speech first. Returns keys. */
  VL.distractors = function (key, n) {
    n = n || 3;
    const w = VL.words.get(key);
    if (!w) return [];
    const seen = new Set([VL.norm(w.w), VL.norm(w.vi)]);
    const ok = (k) => {
      const o = VL.words.get(k);
      if (!o || k === key) return false;
      const a = VL.norm(o.w), b = VL.norm(o.vi);
      if (seen.has(a) || seen.has(b) || !o.vi) return false;
      return true;
    };
    const take = (pool, out) => {
      VL.shuffle(pool).forEach((k) => {
        if (out.length >= n || !ok(k)) return;
        const o = VL.words.get(k);
        seen.add(VL.norm(o.w)); seen.add(VL.norm(o.vi));
        out.push(k);
      });
      return out;
    };
    const deckPool = VL.words.inDeck(w.deck);
    const out = take(deckPool.filter((k) => { const o = VL.words.get(k); return o && o.pos === w.pos; }), []);
    take(deckPool, out);
    if (out.length < n) take(VL.words.library(), out);
    if (out.length < n) VL.decks.builtInIds().forEach((id) => { if (out.length < n) take(VL.words.inDeck(id), out); });
    return out;
  };

  const session = (VL.session = {
    /** Build and store a new session, then navigate to its first screen.
        opts: {preset, modes:[...], order:'mix'|'seq', count, decks:[ids], keys:[explicit keys], source:'deck'|'word'|'retry'|...}
        Returns the session or null when there is nothing to practise. */
    start(opts) {
      const set = st().settings;
      const preset = VL.PRESETS.find((p) => p.id === opts.preset);
      let modes = (opts.modes && opts.modes.length ? opts.modes : preset && preset.modes) || Object.keys(set.modes).filter((m) => set.modes[m]);
      if (!modes.length) modes = ['flash'];
      modes = VL.MODES.map((m) => m.id).filter((m) => modes.indexOf(m) >= 0);
      const count = VL.clamp(opts.count || (preset && preset.count) || set.count, 1, 200);
      const order = opts.order || set.order;
      const deckIds = opts.decks && opts.decks.length ? opts.decks : VL.decks.mineIds();
      let keys;
      if (opts.keys && opts.keys.length) keys = opts.keys.filter(VL.words.exists).slice(0, count);
      else keys = session.choose(opts.preset || 'today', deckIds, count);
      if (!keys.length) return null;
      // A session still running is archived (its answers are already recorded) instead of silently dropped.
      const prev = st().session;
      if (prev && !prev.done && prev.results && prev.results.length) session.finish();
      const queue = session.assign(keys, modes, order);
      const s = {
        id: VL.uid(), preset: opts.preset || (opts.keys ? 'custom' : 'today'), source: opts.source || 'practice',
        title: opts.title || (preset ? preset.title : 'Tuỳ chỉnh'),
        modes, order, decks: deckIds, queue, idx: 0, results: [], startedAt: Date.now(),
        avgBefore: VL.srs.overview().avg, streakBefore: VL.srs.streak(), masteredBefore: VL.srs.overview().buckets.master
      };
      st().session = s;
      VL.store.save();
      session.go();
      return s;
    },
    /** Pick words for a preset from the given decks. */
    choose(preset, deckIds, count) {
      const now = Date.now();
      const pool = Array.from(new Set([].concat(...deckIds.map(VL.words.inDeck))));
      const started = pool.filter(VL.srs.isStarted);
      const unstarted = pool.filter((k) => !VL.srs.isStarted(k));
      const fill = (out, list) => { list.forEach((k) => { if (out.length < count && out.indexOf(k) < 0) out.push(k); }); return out; };
      if (preset === 'weak') {
        const weak = started.filter((k) => VL.srs.score(k, now) < 30);
        return fill(VL.srs.pick(weak, count, now), VL.srs.pick(started.filter((k) => VL.srs.score(k, now) < 70), count, now));
      }
      if (preset === 'new') {
        const fresh = VL.srs.newToday().filter((k) => pool.indexOf(k) >= 0);
        return fill(fill([], fresh), unstarted);
      }
      // today / quick / custom: due first (weighted), then today's new words, then weighted pick of the rest.
      const due = started.filter((k) => VL.srs.isDue(k, now));
      const out = fill([], VL.srs.pick(due, count, now));
      const freshCap = preset === 'quick' ? Math.ceil(count / 3) : count;
      fill(out, VL.srs.newToday().filter((k) => pool.indexOf(k) >= 0).slice(0, freshCap));
      fill(out, VL.srs.pick(started, count, now));
      fill(out, unstarted);
      return VL.shuffle(out);
    },
    /** Assign a mode to each key. 'mix' = random allowed mode per word; 'seq' = blocks, one mode after another. */
    assign(keys, modes, order) {
      const items = keys.map((key, i) => {
        const w = VL.words.get(key);
        const allowed = modes.filter((m) => VL.modeOk(m, w));
        const list = allowed.length ? allowed : (modes.indexOf('flash') >= 0 ? ['flash'] : ['mean']);
        const mode = order === 'seq' ? list[i % list.length] : list[Math.floor(Math.random() * list.length)];
        return { key, mode };
      });
      if (order === 'seq') items.sort((a, b) => modes.indexOf(a.mode) - modes.indexOf(b.mode));
      return items;
    },
    /** The running session (or null). */
    current() { return st().session; },
    /** Current item {key, mode, word, index, total, answered:{ok,before,after}|null} or null when finished. */
    item() {
      const s = st().session;
      if (!s) return null;
      session.skipMissing(s);
      if (s.idx >= s.queue.length) return null;
      const it = s.queue[s.idx];
      const res = s.results.find((r) => r.i === s.idx) || null;
      return { ...it, word: VL.words.get(it.key), index: s.idx, total: s.queue.length, answered: res };
    },
    /** Skip queue items whose word was deleted meanwhile (otherwise the session would be stuck on them). */
    skipMissing(s) {
      if (s.done) return;
      let moved = false;
      while (s.idx < s.queue.length && !VL.words.exists(s.queue[s.idx].key) && !s.results.some((r) => r.i === s.idx)) { s.idx++; moved = true; }
      if (moved) { if (s.idx >= s.queue.length) session.finish(); else VL.store.save(); }
    },
    /** Next item after the current one (or null). */
    peek() { const s = st().session; return s && s.queue[s.idx + 1] ? s.queue[s.idx + 1] : null; },
    /** "3 / 24" */
    progressText() { const s = st().session; return s ? Math.min(s.idx + 1, s.queue.length) + ' / ' + s.queue.length : ''; },
    /** Record the answer for the current item (once). Returns {ok, before, after, delta}. */
    answer(ok) {
      const s = st().session;
      if (!s || s.idx >= s.queue.length) return null;
      const prev = s.results.find((r) => r.i === s.idx);
      if (prev) return prev;
      const it = s.queue[s.idx];
      const set = st().settings;
      // Flashcard "Chưa nhớ" only subtracts when the setting is on; otherwise it just doesn't add.
      const r = !ok && it.mode === 'flash' && !set.sw.flash ? VL.srs.recordNeutral(it.key, 'flash') : VL.srs.record(it.key, ok, it.mode);
      const res = { i: s.idx, key: it.key, mode: it.mode, ok: !!ok, before: r.before, after: r.after, delta: r.delta };
      s.results.push(res);
      VL.store.save();
      return res;
    },
    /** Move to the next item and navigate to its screen (or to #/result when done). */
    next() {
      const s = st().session;
      if (!s) { VL.go('#/practice'); return; }
      if (s.done) { session.go(true); return; }
      s.idx++;
      session.skipMissing(s);
      if (s.idx >= s.queue.length) session.finish();
      else VL.store.save();
      // replace: the history keeps ONE entry for the running session, so Back leaves it instead of bouncing
      // between #/flash and #/quiz (each redirecting forward again).
      session.go(true);
    },
    /** Navigate to the screen for the current item. replace=true: replace the current history entry. */
    go(replace) {
      const s = st().session;
      if (!s) { VL.go('#/practice', replace); return; }
      session.skipMissing(s);
      if (s.idx >= s.queue.length || s.done) { VL.go('#/result', replace); return; }
      const mode = s.queue[s.idx].mode;
      VL.go(mode === 'flash' ? '#/flash' : '#/quiz', replace);
    },
    /** Close the session: compute summary and archive it. */
    finish() {
      const s = st().session;
      if (!s || s.done) return s;
      s.done = true;
      s.endedAt = Date.now();
      const ov = VL.srs.overview();
      s.avgAfter = ov.avg;
      s.masteredAfter = ov.buckets.master;
      s.streakAfter = VL.srs.streak();
      const ms = s.endedAt - s.startedAt;
      const dk = VL.dayKey();
      const day = (st().days[dk] = st().days[dk] || { n: 0, ok: 0, fresh: {}, ms: 0 });
      day.ms += Math.min(ms, 3 * 3600000);
      st().sessions.unshift(session.summary(s));
      if (st().sessions.length > 50) st().sessions.length = 50;
      VL.srs.snapshot();
      VL.store.save();
      return s;
    },
    /** Summary of a (finished) session for the Kết quả page. */
    summary(s) {
      s = s || st().session || st().sessions[0];
      if (!s) return null;
      if (s.summary) return s; // already a summary object
      const total = s.results.length;
      const right = s.results.filter((r) => r.ok).length;
      const wrongKeys = Array.from(new Set(s.results.filter((r) => !r.ok).map((r) => r.key)));
      return {
        summary: true, id: s.id, title: s.title, preset: s.preset, modes: s.modes, order: s.order, decks: s.decks,
        total, right, wrong: total - right, pct: total ? Math.round((right / total) * 100) : 0,
        minutes: Math.max(1, Math.round(((s.endedAt || Date.now()) - s.startedAt) / 60000)),
        avgBefore: s.avgBefore, avgAfter: s.avgAfter != null ? s.avgAfter : VL.srs.overview().avg,
        masteredGain: (s.masteredAfter != null ? s.masteredAfter : VL.srs.overview().buckets.master) - (s.masteredBefore || 0),
        streak: s.streakAfter != null ? s.streakAfter : VL.srs.streak(),
        results: s.results.slice(), wrongKeys, startedAt: s.startedAt, endedAt: s.endedAt
      };
    },
    /** Last finished session summary (Kết quả). */
    last() {
      const s = st().session;
      if (s && s.done) return session.summary(s);
      return st().sessions[0] || null;
    },
    /** Start a new session with the words answered wrong in the last session ("Ôn lại từ sai"). */
    retryWrong() {
      // the session on screen (finished or still running), not an older archived one
      const cur = st().session;
      const last = cur && cur.results && cur.results.length ? session.summary(cur) : session.last();
      if (!last || !last.wrongKeys || !last.wrongKeys.length) return null;
      return session.start({ keys: last.wrongKeys, modes: last.modes, order: last.order, count: last.wrongKeys.length, source: 'retry', title: 'Ôn lại từ sai', preset: 'custom' });
    },
    /** Abandon the running session (keeps answers already recorded). */
    quit() {
      const s = st().session;
      if (s && !s.done && s.results.length) session.finish();
      else st().session = null;
      VL.store.save();
    }
  });
})();
