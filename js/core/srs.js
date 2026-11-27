/* VocaLab — mastery score + spaced repetition.

   Memory model (from research on human memory):
   • Ebbinghaus forgetting curve: recall probability decays exponentially with time, R = e^(−t/S),
     where S ("stability") is how long the memory lasts.
   • Spacing effect: a successful review made AFTER some forgetting has begun raises stability far more
     than cramming the same word again minutes later (SM-2 / FSRS style interval growth).
   • Testing effect: actively retrieving (quiz) strengthens memory more than re-reading; a failed recall
     sharply lowers stability ("lapse").
   • Interleaving and mixed practice modes help transfer (handled by the session builder).

   How the app applies it:
   • score (0–100 %) = mastery shown to the user. Correct = +10 (10 correct answers = 100 %),
     wrong = −pen (setting, 10/20/30 %), never below 0.
   • Each word has stability S in days. Correct & spaced (elapsed ≥ 60 % of S): S ×= 2.2 + score/100.
     Correct but crammed: S ×= 1.15. Wrong: S ×= 0.4 (min 0.5 day).
   • Next review is due S days after the last one.
   • Decay: if a word is not practised, the displayed score slowly drops:
       effective = score × 2^(−max(0, days − 0.5) / (3·S))   (half-life = 3 × stability, 12 h grace)
     A word answered once (S ≈ 1 day) loses half its score in ~3 days; a 100 % word with S = 60 days
     still shows ~89 % after a month. The decayed value becomes the new base at the next answer.
   • Picking for practice: weight = 110 − score (0 % ≈ 11× more often than 100 %), × overdue boost
     (up to 3× when far past due). 100 % words are skipped unless "Ôn lại từ đã 100 %" is on.
*/
(function () {
  'use strict';
  const VL = window.VL;
  const st = () => VL.store.state;
  const S0 = 0.5;          // initial stability (days) for a brand-new word
  const S_MAX = 365;
  const HALF_LIFE_K = 3;
  const GRACE_DAYS = 0.5;

  const LEVELS = [
    { id: 'weak', label: 'Yếu', min: 0, color: '#C2465E', text: '#A8324F', soft: '#FCE4EA' },
    { id: 'learning', label: 'Đang học', min: 30, color: '#E9A23B', text: '#8A6414', soft: '#FFF1C7' },
    { id: 'good', label: 'Khá', min: 70, color: '#5B40C9', text: '#5B40C9', soft: '#ECE6FF' },
    { id: 'master', label: 'Thành thạo', min: 100, color: '#2F7A4F', text: '#2F7A4F', soft: '#DFF2E5' }
  ];

  const srs = (VL.srs = {
    LEVELS,
    /** Level for a score: {id, label, color (bars/rings), text (accessible text color), soft (background)}. */
    level(score) {
      score = score || 0;
      return score >= 100 ? LEVELS[3] : score >= 70 ? LEVELS[2] : score >= 30 ? LEVELS[1] : LEVELS[0];
    },
    /** Short priority label shown under the score on Chi tiết từ. */
    levelNote(score) {
      return score >= 100 ? 'Thành thạo · ôn thỉnh thoảng' : score >= 70 ? 'Khá · ưu tiên thấp' : score >= 30 ? 'Đang học · ưu tiên vừa' : 'Yếu · ưu tiên cao';
    },
    /** Raw progress record or null (word not started). */
    progress(key) { return st().progress[key] || null; },
    isStarted(key) { return !!st().progress[key]; },
    /** Begin tracking a word (score 0, due now). No-op if it already exists. */
    start(key) {
      const s = st();
      if (!s.progress[key]) s.progress[key] = { s: 0, st: S0, t: 0, c: 0, x: 0, n: 0, i: Date.now(), h: [] };
      return s.progress[key];
    },
    /** Retention factor 0..1 for a record at time `now`. */
    retention(p, now) {
      if (!p || !p.t) return 1;
      const days = ((now || Date.now()) - p.t) / VL.DAY;
      return Math.pow(2, -Math.max(0, days - GRACE_DAYS) / (HALF_LIFE_K * Math.max(S0, p.st)));
    },
    /** Current (decayed) score 0..100, integer. */
    score(key, now) {
      const p = st().progress[key];
      if (!p) return 0;
      return Math.round(p.s * srs.retention(p, now));
    },
    /** Stored score at last practice (no decay). */
    rawScore(key) { const p = st().progress[key]; return p ? p.s : 0; },
    /** Timestamp when the word is next due (ms). Unstarted words: now. */
    dueAt(key) {
      const p = st().progress[key];
      if (!p || !p.t) return p ? p.i || 0 : 0;
      return p.t + p.st * VL.DAY;
    },
    isDue(key, now) { const p = st().progress[key]; if (!p) return false; return srs.dueAt(key) <= (now || Date.now()); },
    /** Correct answers still needed to reach 100 %. */
    toMaster(key) { return Math.max(0, Math.ceil((100 - srs.score(key)) / 10)); },
    /** Selection weight for practice (see header). */
    weight(key, now) {
      now = now || Date.now();
      const set = st().settings;
      const sc = srs.score(key, now);
      if (sc >= 100 && !set.sw.review && !srs.isDue(key, now)) return 0;
      if (!set.sw.prio) return 1;
      let w = 110 - sc;
      const p = st().progress[key];
      if (p && p.t) {
        const over = (now - srs.dueAt(key)) / (Math.max(S0, p.st) * VL.DAY);
        if (over > 0) w *= 1 + Math.min(2, over);
      }
      return Math.max(1, w);
    },
    /** Relative frequency of a score vs a 100 % word (for the Settings explainer): 0 → ×11 … 100 → ×1. */
    relFreq(score) { return Math.round((110 - score) / 10); },

    /** Record one answer. ok: boolean. mode: flash|mean|word|fill|listen|type.
        Returns {before, after, delta} using decayed score as the base. */
    record(key, ok, mode) {
      const s = st();
      const now = Date.now();
      const p = srs.start(key);
      const before = srs.score(key, now);
      const elapsed = p.t ? (now - p.t) / VL.DAY : null;
      let after;
      if (ok) {
        after = Math.min(100, before + 10);
        if (elapsed == null) p.st = 1;
        else if (elapsed >= 0.6 * p.st) p.st = Math.min(S_MAX, p.st * (2.2 + before / 100));
        else p.st = Math.min(S_MAX, p.st * 1.15);
        p.c++;
      } else {
        after = Math.max(0, before - (s.settings.pen || 20));
        p.st = Math.max(S0, p.st * 0.4);
        p.x++;
      }
      const isNew = !p.t;
      p.s = after; p.t = now; p.n++;
      srs.logAnswer(key, p, now, ok, mode, before, after, isNew);
      return { before, after, delta: after - before };
    },
    /** Log an answer that does not change the score (Flashcard "Chưa nhớ" with the penalty switched off):
        history entry, day log, new-word quota and streak still count it as practice. */
    recordNeutral(key, mode) {
      const now = Date.now();
      const p = srs.start(key);
      const sc = srs.score(key, now);
      const isNew = !p.t;
      if (isNew) p.t = now;
      srs.logAnswer(key, p, now, false, mode || 'flash', sc, sc, isNew);
      return { before: sc, after: sc, delta: 0 };
    },
    logAnswer(key, p, now, ok, mode, before, after, isNew) {
      const s = st();
      p.h.unshift({ t: now, m: mode || 'flash', ok: !!ok, b: before, a: after });
      if (p.h.length > 30) p.h.length = 30;
      // day log + streak
      const dk = VL.dayKey(now);
      const day = (s.days[dk] = s.days[dk] || { n: 0, ok: 0, fresh: {}, ms: 0 });
      if (!day.fresh) day.fresh = {};
      day.n++; if (ok) day.ok++;
      // first time this word is practised → counts against today's new-word allowance of its deck
      if (isNew) { const w = VL.words.get(key); const dId = w ? w.deck : 'mine'; day.fresh[dId] = (day.fresh[dId] || 0) + 1; }
      srs.touchStreak(dk);
      VL.store.saveSoon();
    },
    /** Whether a word was answered today (any mode). */
    answeredToday(key) { const p = st().progress[key]; return !!(p && p.h && p.h[0] && VL.dayKey(p.h[0].t) === VL.dayKey()); },
    /** Update streak for an active day. */
    touchStreak(dk) {
      const k = st().streak;
      if (k.last === dk) return;
      k.count = k.last && VL.daysBetween(k.last, dk) === 1 ? k.count + 1 : 1;
      k.last = dk;
      k.best = Math.max(k.best || 0, k.count);
    },
    /** Current streak (0 when broken: last active day older than yesterday). */
    streak() {
      const k = st().streak;
      if (!k.last) return 0;
      return VL.daysBetween(k.last, VL.dayKey()) <= 1 ? k.count : 0;
    },
    practicedToday() { const d = st().days[VL.dayKey()]; return !!(d && d.n); },
    /** Words introduced (first answered) today per deck. */
    freshToday(deckId) { const d = st().days[VL.dayKey()]; return d && d.fresh ? d.fresh[deckId] || 0 : 0; },

    /** Today's new-word allowance: for every added built-in deck, the first unstarted words up to perDay − already introduced today. */
    newToday() {
      const out = [];
      VL.decks.mineIds().forEach((id) => {
        if (id === 'mine') return;
        let quota = VL.decks.perDay(id) - srs.freshToday(id);
        if (quota <= 0) return;
        const keys = VL.words.inDeck(id);
        for (let i = 0; i < keys.length && quota > 0; i++) if (!st().progress[keys[i]]) { out.push(keys[i]); quota--; }
      });
      return out;
    },
    /** Plan for the "Hôm nay" page. deckIds defaults to the whole library. */
    todayPlan(deckIds) {
      const lib = deckIds ? Array.from(new Set([].concat(...deckIds.map(VL.words.inDeck)))) : VL.words.library();
      const now = Date.now();
      const started = lib.filter((k) => st().progress[k]);
      const due = started.filter((k) => srs.isDue(k, now)).sort((a, b) => srs.weight(b, now) - srs.weight(a, now));
      const fresh = srs.newToday().filter((k) => lib.indexOf(k) >= 0);
      const weak = started.filter((k) => srs.score(k, now) < 30).sort((a, b) => srs.score(a, now) - srs.score(b, now));
      const target = st().settings.count;
      const d = st().days[VL.dayKey()];
      // done = distinct words of this scope answered today (same unit as `plan`, the words still waiting);
      // answers = raw number of answers today (one word can be answered several times).
      const done = started.filter(srs.answeredToday).length;
      const plan = Math.min(target, due.length + fresh.length);
      return { due, fresh, weak, target, plan, done, answers: d ? d.n : 0, minutes: Math.max(1, Math.round(plan * 0.4)) };
    },
    /** Weighted random sample of n keys without replacement (Efraimidis–Spirakis). */
    pick(keys, n, now) {
      now = now || Date.now();
      return keys.map((k) => ({ k, w: srs.weight(k, now) })).filter((x) => x.w > 0)
        .map((x) => ({ k: x.k, r: Math.pow(Math.random(), 1 / x.w) }))
        .sort((a, b) => b.r - a.r).slice(0, n).map((x) => x.k);
    },
    /** Library overview: totals, level buckets, average mastery of started words, change vs 7 days ago. */
    overview(keys) {
      keys = keys || VL.words.library();
      const b = { weak: 0, learning: 0, good: 0, master: 0 };
      let sum = 0, n = 0;
      keys.forEach((k) => { if (!st().progress[k]) return; const sc = srs.score(k); sum += sc; n++; b[srs.level(sc).id]++; });
      const avg = n ? Math.round(sum / n) : 0;
      const weekAgo = st().days[VL.dayKey(Date.now() - 7 * VL.DAY)];
      // nearest snapshot within the last 7..14 days
      let base = null;
      for (let i = 7; i <= 14 && base == null; i++) { const d = st().days[VL.dayKey(Date.now() - i * VL.DAY)]; if (d && d.avg != null) base = d.avg; }
      if (base == null && weekAgo && weekAgo.avg != null) base = weekAgo.avg;
      return { total: n, words: keys.length, buckets: b, avg, weekDelta: base == null ? null : avg - base };
    },
    /** Save today's average mastery (called on app start and after sessions) for the weekly delta. */
    snapshot() {
      const dk = VL.dayKey();
      const s = st();
      const day = (s.days[dk] = s.days[dk] || { n: 0, ok: 0, fresh: {}, ms: 0 });
      day.avg = srs.overview().avg;
      VL.store.saveSoon();
    },
    /** "Đặt lại tiến độ": every word back to 0 %, words kept. */
    resetAll() {
      const s = st();
      s.progress = {};
      s.streak = { count: 0, last: null, best: 0 };
      s.days = {};
      s.sessions = [];
      s.session = null;
      Object.keys(s.custom).forEach((k) => srs.start(k));
      VL.store.save();
    },
    resetWord(key) { delete st().progress[key]; srs.start(key); VL.store.save(); }
  });
})();
