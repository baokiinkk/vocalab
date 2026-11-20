const test = require('node:test');
const assert = require('node:assert');
const loadCore = require('./load-core');

test('html escaping', () => {
  const { VL } = loadCore();
  assert.equal(String(VL.html`<b>${'<x>'}</b>${VL.raw('<i>')}`), '<b>&lt;x&gt;</b><i>');
  assert.equal(String(VL.html`${['a', '<']}`), 'a&lt;');
});

test('first run adds comm + ielts decks; mine always present', () => {
  const { VL } = loadCore();
  assert.deepEqual(VL.decks.mineIds(), ['mine', 'comm', 'ielts']);
  assert.equal(VL.decks.get('comm').n, 5);
});

test('score: +10 per correct, 10 correct = 100, wrong subtracts pen, floor 0', () => {
  const { VL } = loadCore();
  const k = 'comm:suggest';
  for (let i = 0; i < 12; i++) VL.srs.record(k, true, 'mean');
  assert.equal(VL.srs.score(k), 100);
  VL.srs.record(k, false, 'mean');
  assert.equal(VL.srs.score(k), 80);
  VL.store.setSetting('pen', 30);
  for (let i = 0; i < 5; i++) VL.srs.record(k, false, 'mean');
  assert.equal(VL.srs.score(k), 0);
});

test('decay: score drops slowly when not practised', () => {
  const { VL } = loadCore();
  const k = 'comm:mention';
  for (let i = 0; i < 5; i++) VL.srs.record(k, true, 'mean');
  const p = VL.srs.progress(k);
  const s0 = VL.srs.score(k);
  const now = p.t;
  assert.equal(VL.srs.score(k, now + 0.4 * VL.DAY), s0, 'no decay in grace period');
  const later = VL.srs.score(k, now + 3 * VL.DAY);
  const muchLater = VL.srs.score(k, now + 30 * VL.DAY);
  assert.ok(later < s0 && later > 0, 'decays after days: ' + later);
  assert.ok(muchLater < later, 'keeps decaying');
});

test('spacing: spaced correct answers grow stability more than cramming', () => {
  const { VL } = loadCore();
  const a = 'comm:actually', b = 'comm:awkward';
  VL.srs.record(a, true); VL.srs.record(b, true);
  VL.srs.record(a, true); // crammed
  const pb = VL.srs.progress(b);
  pb.t -= 2 * VL.DAY; // simulate 2 days later
  VL.srs.record(b, true);
  assert.ok(VL.srs.progress(b).st > VL.srs.progress(a).st);
});

test('weights: low score picked more often; 100% excluded when review off', () => {
  const { VL } = loadCore();
  const lo = 'comm:appreciate', hi = 'comm:suggest';
  VL.srs.start(lo);
  for (let i = 0; i < 10; i++) VL.srs.record(hi, true);
  assert.ok(VL.srs.weight(lo) > VL.srs.weight(hi) * 5);
  VL.store.setSetting('sw.review', false);
  assert.equal(VL.srs.weight(hi), 0);
  let loCount = 0;
  VL.store.setSetting('sw.review', true);
  for (let i = 0; i < 300; i++) if (VL.srs.pick([lo, hi], 1)[0] === lo) loCount++;
  assert.ok(loCount > 220, 'low-score word should dominate: ' + loCount);
});

test('custom word save, find, edit and remove', () => {
  const { VL } = loadCore();
  const key = VL.words.save({ w: 'meticulous', vi: 'tỉ mỉ', examples: [{ en: 'She is meticulous.', vi: '' }], syn: 'thorough, precise' });
  assert.equal(key, 'mine:meticulous');
  assert.equal(VL.words.findByText('Meticulous'), key);
  assert.deepEqual(VL.words.get(key).syn, ['thorough', 'precise']);
  assert.ok(VL.srs.isStarted(key));
  VL.words.save({ vi: 'tỉ mỉ, kỹ lưỡng' }, { key });
  assert.equal(VL.words.get(key).vi, 'tỉ mỉ, kỹ lưỡng');
  VL.words.save({ note: 'x' }, { key: 'comm:awkward' });
  assert.equal(VL.words.get('comm:awkward').note, 'x');
  VL.words.remove(key);
  assert.equal(VL.words.get(key), null);
});

test('search matches english and vietnamese without diacritics', () => {
  const { VL } = loadCore();
  assert.equal(VL.words.search('phan tich')[0].w, 'analyse');
  assert.equal(VL.words.search('sugg')[0].w, 'suggest');
});

test('blankOut finds inflected forms', () => {
  const { VL } = loadCore();
  assert.equal(VL.blankOut('We analysed the data.', 'analyse').hit, 'analysed');
  assert.equal(VL.blankOut('She mentioned your name.', 'mention').hit, 'mentioned');
  assert.equal(VL.blankOut('I figured out the answer.', 'figure out').hit, 'figured out');
});

test('session flow: start, answer, next, finish, retry wrong', () => {
  const { VL, location } = loadCore();
  const s = VL.session.start({ modes: ['flash', 'mean'], count: 4, order: 'seq' });
  assert.ok(s && s.queue.length === 4);
  assert.ok(['#/flash', '#/quiz'].includes(location.hash));
  let n = 0;
  while (VL.session.item()) { VL.session.answer(n++ % 2 === 0); VL.session.next(); }
  assert.equal(location.hash, '#/result');
  const sum = VL.session.last();
  assert.equal(sum.total, 4);
  assert.equal(sum.right, 2);
  assert.equal(sum.wrongKeys.length, 2);
  const r = VL.session.retryWrong();
  assert.equal(r.queue.length, 2);
});

test('distractors are distinct and exclude the answer', () => {
  const { VL } = loadCore();
  const d = VL.distractors('comm:suggest');
  assert.equal(d.length, 3);
  assert.ok(!d.includes('comm:suggest'));
  assert.equal(new Set(d).size, 3);
});

test('streak increments on consecutive days', () => {
  const { VL } = loadCore();
  VL.srs.touchStreak('2026-11-17');
  VL.srs.touchStreak('2026-11-18');
  VL.srs.touchStreak('2026-11-18');
  assert.equal(VL.store.state.streak.count, 2);
  VL.srs.touchStreak('2026-11-20');
  assert.equal(VL.store.state.streak.count, 1);
});

test('ai.fillEmpty never overwrites user input', () => {
  const { VL } = loadCore();
  const out = VL.ai.fillEmpty({ vi: 'của tôi', ipa: '', examples: [{ en: '', vi: '' }] }, { vi: 'AI', ipa: '/x/', examples: [{ en: 'a', vi: 'b' }] });
  assert.equal(out.vi, 'của tôi');
  assert.equal(out.ipa, '/x/');
  assert.equal(out.examples[0].en, 'a');
});

test('reset progress keeps words', () => {
  const { VL } = loadCore();
  const key = VL.words.save({ w: 'albeit', vi: 'mặc dù' });
  VL.srs.record(key, true);
  VL.srs.resetAll();
  assert.equal(VL.srs.score(key), 0);
  assert.ok(VL.words.get(key));
});

/* ---------- regression tests (core review) ---------- */

function coreWithSave(saveObj) {
  const ctx = loadCore();
  ctx.localStorage.setItem('vocalab.v1', typeof saveObj === 'string' ? saveObj : JSON.stringify(saveObj));
  ctx.VL.store.load();
  return ctx;
}

test('old / corrupted save shapes are repaired instead of crashing', () => {
  const { VL } = coreWithSave({
    v: 1, settings: { sw: null, count: '24' }, sessions: null, streak: 5, days: { '2026-11-01': 3 },
    progress: { 'comm:suggest': { s: 50 }, 'comm:mention': 'bad' }, decks: { comm: true }, extraDeck: { 'comm:suggest': 'ielts' },
    session: { id: 'x', queue: 'oops' }
  });
  const st = VL.store.state;
  assert.ok(Array.isArray(st.sessions));
  assert.equal(typeof st.settings.sw, 'object');
  assert.equal(st.settings.count, 24);
  assert.equal(st.session, null);
  assert.equal(st.progress['comm:mention'], undefined);
  assert.deepEqual(VL.decks.mineIds(), ['mine', 'comm']);
  // record on the old record without history must not throw
  VL.srs.record('comm:suggest', true, 'mean');
  assert.equal(VL.srs.progress('comm:suggest').h.length, 1);
  assert.ok(VL.srs.todayPlan());
  assert.equal(VL.session.last(), null);
});

test('unreadable save is kept aside, not silently overwritten', () => {
  const ctx = coreWithSave('{not json');
  ctx.VL.store.save();
  assert.equal(ctx.localStorage.getItem('vocalab.v1.unreadable'), '{not json');
});

test('localStorage full: caches are dropped and the save retried; user is warned when it still fails', async () => {
  const ctx = loadCore();
  const { VL } = ctx;
  const ls = ctx.localStorage;
  const realSet = ls.setItem;
  ls.setItem('vocalab.imgcache', 'x'.repeat(100));
  let full = true;
  ls.setItem = (k, v) => { if (k === 'vocalab.v1' && full && ls.getItem('vocalab.imgcache') != null) { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; } realSet(k, v); };
  VL.words.save({ w: 'zest', vi: 'hứng thú' });
  assert.equal(ls.getItem('vocalab.imgcache'), null, 'cache dropped');
  assert.ok(JSON.parse(ls.getItem('vocalab.v1')).custom['mine:zest'], 'save succeeded after freeing space');
  // still failing → toast
  const toasts = [];
  VL.ui.toast = (m, kind) => toasts.push([m, kind]);
  ls.setItem = (k, v) => { if (k === 'vocalab.v1') { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; } realSet(k, v); };
  VL.words.save({ w: 'zeal', vi: 'nhiệt huyết' });
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(toasts.length, 1);
  assert.equal(toasts[0][1], 'error');
  assert.match(toasts[0][0], /đầy/);
});

test('todayPlan.done counts distinct words answered today (same unit as plan)', () => {
  const { VL } = loadCore();
  const before = VL.srs.todayPlan();
  assert.equal(before.done, 0);
  for (let i = 0; i < 5; i++) VL.srs.record('comm:suggest', true, 'mean');
  VL.srs.record('comm:mention', false, 'mean');
  const p = VL.srs.todayPlan();
  assert.equal(p.done, 2);
  assert.equal(p.answers, 6);
  assert.ok(p.done + p.plan <= before.plan + 0, 'answered words leave the plan: ' + p.done + '+' + p.plan + ' vs ' + before.plan);
});

test('flash "Chưa nhớ" without penalty still counts as practice (streak, day log, new-word quota)', () => {
  const { VL } = loadCore();
  VL.store.setSetting('sw.flash', false);
  VL.session.start({ keys: ['comm:suggest'], modes: ['flash'], count: 1 });
  const r = VL.session.answer(false);
  assert.equal(r.delta, 0);
  assert.equal(VL.srs.streak(), 1);
  assert.ok(VL.srs.practicedToday());
  assert.equal(VL.srs.freshToday('comm'), 1);
  // the first real answer later must not count the word as new a second time
  VL.srs.record('comm:suggest', true, 'mean');
  assert.equal(VL.srs.freshToday('comm'), 1);
});

test('answers are recorded once per item', () => {
  const { VL } = loadCore();
  VL.session.start({ keys: ['comm:suggest', 'comm:mention'], modes: ['mean'], count: 2 });
  VL.session.answer(true); VL.session.answer(false); VL.session.answer(true);
  assert.equal(VL.srs.progress(VL.session.item().key).n, 1);
  assert.equal(VL.store.state.session.results.length, 1);
});

test('session skips words deleted while it runs (no dead end)', () => {
  const { VL, location } = loadCore();
  const a = VL.words.save({ w: 'zest', vi: 'hứng thú' });
  const b = VL.words.save({ w: 'zeal', vi: 'nhiệt huyết' });
  VL.session.start({ keys: [a, b, 'comm:suggest'], modes: ['mean'], order: 'seq', count: 3 });
  VL.store.state.session.queue = [{ key: a, mode: 'mean' }, { key: b, mode: 'mean' }, { key: 'comm:suggest', mode: 'mean' }];
  VL.words.remove(a);
  assert.equal(VL.session.item().key, b);
  VL.session.answer(true);
  VL.words.remove('comm:suggest'); // built-in: still exists
  VL.session.next();
  assert.equal(VL.session.item().key, 'comm:suggest');
  // deleting the last remaining word finishes the session
  VL.session.start({ keys: [b], modes: ['mean'], count: 1 });
  VL.words.remove(b);
  assert.equal(VL.session.item(), null);
  VL.session.go();
  assert.equal(location.hash, '#/result');
});

test('session navigation replaces the history entry (Back is not trapped between #/flash and #/quiz)', () => {
  const ctx = loadCore();
  const { VL } = ctx;
  const calls = [];
  VL.go = (h, replace) => { calls.push([h, !!replace]); ctx.location.hash = h; };
  VL.session.start({ keys: ['comm:suggest', 'comm:mention'], modes: ['flash'], count: 2 });
  VL.session.answer(true); VL.session.next();
  VL.session.answer(true); VL.session.next();
  assert.deepEqual(calls.slice(1), [['#/flash', true], ['#/result', true]]);
});

test('starting a new session archives the running one; retryWrong uses the session on screen', () => {
  const { VL } = loadCore();
  // finished session A: suggest wrong
  VL.session.start({ keys: ['comm:suggest'], modes: ['mean'], count: 1 });
  VL.session.answer(false); VL.session.next();
  // session B running: mention wrong, then retry mid-session
  VL.session.start({ keys: ['comm:mention', 'comm:awkward'], modes: ['mean'], order: 'seq', count: 2 });
  VL.store.state.session.queue = [{ key: 'comm:mention', mode: 'mean' }, { key: 'comm:awkward', mode: 'mean' }];
  VL.session.answer(false);
  const r = VL.session.retryWrong();
  assert.deepEqual(r.queue.map((q) => q.key), ['comm:mention']);
  assert.equal(VL.store.state.sessions.length, 2, 'running session B was archived');
  assert.deepEqual(VL.store.state.sessions[0].wrongKeys, ['comm:mention']);
});

test('non-latin words get a stable key and are found as duplicates', () => {
  const { VL } = loadCore();
  const k = VL.words.save({ w: '日本', vi: 'Nhật Bản' });
  assert.ok(k.length > 'mine:'.length);
  assert.equal(VL.words.findByText('日本'), k);
});
