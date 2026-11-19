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
