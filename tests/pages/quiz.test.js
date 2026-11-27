/* Browser tests for #/quiz. Run: node --test tests/pages/quiz.test.js (static server on :8765). */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { launch, open } = require('../pw');
const { seed } = require('../fixtures');
// fixture data + light theme (theme 'sys' would follow the OS / time of day in screenshots)
const seedLight = new Function('VL', '(' + seed.toString() + ')(VL); VL.store.setSetting("theme", "light");');

const SHOTS = path.join(__dirname, '..', 'shots', 'quiz');
fs.mkdirSync(SHOTS, { recursive: true });
const DEVICES = ['laptop', 'ipad', 'iphone'];

let browser;
test.before(async () => { browser = await launch(); });
test.after(async () => { await browser.close(); });

async function startSession(page, opts) {
  await page.evaluate((o) => {
    const VL = window.VL;
    if (o.keys) {
      const keys = o.keys.filter((k) => VL.words.exists(k) && VL.modeOk(o.modes[0], VL.words.get(k)));
      VL.words.inDeck('comm').forEach((k) => { if (keys.length < o.count && keys.indexOf(k) < 0 && VL.modeOk(o.modes[0], VL.words.get(k))) keys.push(k); });
      o.keys = keys;
    }
    VL.session.start(o);
  }, opts);
  await page.waitForFunction(() => location.hash === '#/quiz' && document.querySelector('.quiz'));
}
const st = (page) => page.evaluate(() => {
  const VL = window.VL; const s = VL.session.current(); const it = VL.session.item();
  return { idx: s && s.idx, n: s && s.results.length, done: s && s.done, key: it && it.key, mode: it && it.mode, score: it && VL.srs.score(it.key), answered: !!(it && it.answered), hash: location.hash };
});
const optTexts = (page) => page.$$eval('.quiz-opt', (els) => els.map((e) => e.querySelector('.quiz-opt-text').textContent.trim()));
async function clickRight(page) {
  const key = (await st(page)).key;
  await page.click(`.quiz-opt[data-key="${key}"]`);
}
async function clickWrong(page) {
  const key = (await st(page)).key;
  await page.click(`.quiz-opt:not([data-key="${key}"])`);
}

for (const device of DEVICES) {
  test(`${device}: empty state without session`, async () => {
    const page = await open(browser, device, '#/quiz');
    await page.waitForSelector('.empty a[href="#/practice"]');
    assert.match(await page.textContent('.empty'), /Chưa có phiên luyện tập/);
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  test(`${device}: Chọn nghĩa — render, answer, single recording, refresh, next, result`, async () => {
    const page = await open(browser, device, '#/practice', { seed: seedLight });
    await startSession(page, { modes: ['mean'], count: 3, keys: ['comm:appreciate', 'comm:suggest', 'mine:reluctant'] });
    await page.waitForSelector('.quiz-opt');
    assert.equal(await page.textContent('.quiz-prompt'), 'Từ này nghĩa là gì?');
    assert.match(await page.textContent('.quiz-top-row'), /Chọn nghĩa\s*1 \/ 3/);
    const word = await page.textContent('.quiz-word');
    const s0 = await st(page);
    assert.equal(word, await page.evaluate((k) => window.VL.words.get(k).w, s0.key));
    assert.match(await page.textContent('.quiz-lv'), new RegExp(s0.score + '%'));
    const opts = await optTexts(page);
    assert.ok(opts.length >= 2 && opts.length <= 4);
    assert.deepEqual(await page.$$eval('.quiz-badge', (e) => e.map((x) => x.textContent)), ['A', 'B', 'C', 'D'].slice(0, opts.length));
    assert.ok(opts.includes(await page.evaluate((k) => window.VL.words.get(k).vi, s0.key)));
    // no image before answering
    assert.equal(await page.$('[data-word-img]'), null);
    // re-render keeps the same order
    await page.evaluate(() => window.VL.refresh());
    assert.deepEqual(await optTexts(page), opts);
    assert.equal(await page.$('.quiz-next'), null);

    await clickRight(page);
    await page.waitForSelector('.quiz-detail');
    const s1 = await st(page);
    assert.equal(s1.n, 1);
    assert.equal(s1.score, Math.min(100, s0.score + 10));
    const wd = await page.evaluate((k) => window.VL.words.get(k), s0.key);
    assert.equal(await page.textContent('.quiz-dt-tag'), '✓ Chính xác · +10% · ' + s0.score + '% → ' + s1.score + '%');
    assert.equal(await page.textContent('.quiz-dt-word'), wd.w);
    assert.equal(await page.textContent('.quiz-dt-vi'), wd.vi);
    assert.ok((await page.textContent('.quiz-dt-ex')).startsWith(wd.examples[0].en));
    assert.equal(await page.textContent('.quiz-dt-note'), 'Tự chuyển câu sau 3 giây');
    assert.equal(await page.textContent('.quiz-dt-next'), 'Tiếp ngay');
    assert.ok(await page.$('.quiz-detail [data-word-img]'), 'image shown in detail');
    assert.equal(await page.$('.quiz-opt'), null, 'options replaced by detail');
    assert.equal(await page.$('.quiz-skip'), null);
    await page.screenshot({ path: path.join(SHOTS, `detail-${device}.png`), fullPage: true });
    // pressing a digit / re-render does not record twice
    await page.keyboard.press('2');
    await page.evaluate(() => window.VL.refresh());
    assert.equal((await st(page)).n, 1);
    // full reload keeps the answered state without re-recording, then auto-advances after ~3 s
    await page.reload();
    await page.waitForSelector('.quiz-detail');
    assert.equal((await st(page)).n, 1);
    assert.equal((await st(page)).score, s1.score);
    await page.waitForTimeout(2000);
    assert.equal((await st(page)).idx, 0, 'not yet advanced');
    await page.waitForFunction(() => window.VL.session.current().idx === 1, null, { timeout: 2500 });
    await page.waitForSelector('.quiz-opt:not([disabled])');
    assert.match(await page.textContent('.quiz-top-row'), /2 \/ 3/);
    await page.waitForTimeout(3300);
    assert.equal((await st(page)).idx, 1, 'no double advance');

    // wrong answer
    const w0 = await st(page);
    await clickWrong(page);
    await page.waitForSelector('.quiz-fb.is-wrong');
    const w1 = await st(page);
    assert.equal(w1.score, Math.max(0, w0.score - 20));
    assert.match(await page.textContent('.quiz-fb-title'), /Chưa đúng · −20%/);
    assert.equal(await page.$$eval('.quiz-opt.is-wrong', (e) => e.length), 1);
    assert.equal(await page.$$eval('.quiz-opt.is-right', (e) => e.length), 1);
    const wOpts = await optTexts(page);
    await page.reload();
    await page.waitForSelector('.quiz-fb.is-wrong');
    assert.deepEqual(await optTexts(page), wOpts);
    assert.equal((await st(page)).n, 2);
    assert.equal(await page.textContent('.quiz-next'), 'Câu tiếp theo');
    await page.waitForTimeout(3300);
    assert.equal((await st(page)).idx, 1, 'wrong answers never auto-advance');
    if (device === 'laptop') await page.screenshot({ path: path.join(SHOTS, 'mean-wrong-laptop.png'), fullPage: true });
    await page.click('.quiz-next');
    await page.waitForFunction(() => window.VL.session.current().idx === 2);

    // last: keys 1–4 + "Tôi không biết"
    await page.waitForSelector('.quiz-skip');
    await page.screenshot({ path: path.join(SHOTS, `mean-unanswered-${device}.png`), fullPage: true });
    await page.click('.quiz-skip');
    await page.waitForSelector('.quiz-fb.is-wrong');
    assert.equal(await page.$$eval('.quiz-opt.is-right', (e) => e.length), 1);
    assert.equal(await page.$$eval('.quiz-opt.is-wrong', (e) => e.length), 0);
    assert.equal(await page.textContent('.quiz-next'), 'Xem kết quả');
    await page.screenshot({ path: path.join(SHOTS, `mean-last-${device}.png`), fullPage: true });
    await page.click('.quiz-next');
    await page.waitForFunction(() => location.hash === '#/result');
    const fin = await page.evaluate(() => window.VL.session.last());
    assert.equal(fin.total, 3); assert.equal(fin.right, 1); assert.equal(fin.wrong, 2);
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  test(`${device}: keyboard 1–4 selects; correct screenshot`, async () => {
    const page = await open(browser, device, '#/practice', { seed: seedLight });
    await startSession(page, { modes: ['mean'], count: 3 });
    await page.waitForSelector('.quiz-opt');
    const s = await st(page);
    const n = await page.$eval(`.quiz-opt[data-key="${s.key}"]`, (e) => e.getAttribute('data-n'));
    await page.keyboard.press(n);
    await page.waitForSelector('.quiz-detail');
    assert.equal((await st(page)).n, 1);
    await page.screenshot({ path: path.join(SHOTS, `mean-correct-${device}.png`), fullPage: true });
    const noHScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    assert.ok(noHScroll, 'no horizontal scroll');
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  test(`${device}: dark theme — question, wrong feedback, correct detail`, async () => {
    const page = await open(browser, device, '#/practice', { seed: seedLight });
    await page.evaluate(() => VL.store.setSetting('theme', 'dark'));
    await page.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'dark');
    await startSession(page, { modes: ['mean'], count: 3 });
    await page.waitForSelector('.quiz-opt');
    assert.equal(await page.$eval('.quiz-card', (c) => getComputedStyle(c).backgroundColor), 'rgb(34, 30, 26)'); // --surface (dark)
    await page.screenshot({ path: path.join(SHOTS, `dark-question-${device}.png`), fullPage: true });
    await clickWrong(page);
    await page.waitForSelector('.quiz-fb.is-wrong');
    await page.waitForTimeout(450);
    await page.screenshot({ path: path.join(SHOTS, `dark-wrong-${device}.png`), fullPage: true });
    await page.click('.quiz-next');
    await page.waitForSelector('.quiz-opt:not([disabled])');
    await clickRight(page);
    await page.waitForSelector('.quiz-detail');
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(SHOTS, `dark-detail-${device}.png`), fullPage: true });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  test(`${device}: Chọn từ, Điền chỗ trống, Nghe & chọn, Gõ chính tả`, async () => {
    const page = await open(browser, device, '#/practice', { seed: seedLight });
    // Chọn từ
    await startSession(page, { modes: ['word'], count: 2, keys: ['comm:suggest', 'ielts:assume'] });
    await page.waitForSelector('.quiz-opt');
    assert.equal(await page.textContent('.quiz-prompt'), 'Từ nào có nghĩa là…?');
    let s = await st(page);
    const w = await page.evaluate((k) => window.VL.words.get(k), s.key);
    assert.equal((await page.textContent('.quiz-word')).trim(), w.vi);
    assert.ok((await optTexts(page)).includes(w.w));
    await clickRight(page);
    await page.waitForSelector('.quiz-detail');
    assert.equal(await page.textContent('.quiz-dt-word'), w.w);
    if (device === 'iphone') await page.screenshot({ path: path.join(SHOTS, 'word-iphone.png'), fullPage: true });

    // Điền chỗ trống
    await startSession(page, { modes: ['fill'], count: 2, keys: ['comm:appreciate', 'mine:deadline'] });
    await page.waitForSelector('.quiz-opt');
    assert.equal(await page.textContent('.quiz-prompt'), 'Điền từ vào chỗ trống');
    s = await st(page);
    assert.equal(s.mode, 'fill');
    const sent = await page.textContent('.quiz-sent');
    assert.match(sent, /_____/);
    const fw = await page.evaluate((k) => window.VL.words.get(k), s.key);
    assert.ok(!sent.toLowerCase().includes(fw.w.toLowerCase()), 'answer hidden in sentence');
    assert.equal(await page.textContent('.quiz-sent-vi'), fw.examples[0].vi);
    assert.ok((await optTexts(page)).includes(fw.w));
    await clickWrong(page);
    await page.waitForSelector('.quiz-fb.is-wrong');
    assert.match(await page.textContent('.quiz-fb-ans'), new RegExp(fw.w));
    await page.screenshot({ path: path.join(SHOTS, `fill-wrong-${device}.png`), fullPage: true });

    // Nghe & chọn: auto-play once + replay
    await page.evaluate(() => { window.__spoken = []; window.VL.media.speak = (t) => { window.__spoken.push(t); return true; }; });
    await startSession(page, { modes: ['listen'], count: 2, keys: ['comm:mention', 'ielts:derive'] });
    await page.waitForSelector('.quiz-play');
    s = await st(page);
    const lw = await page.evaluate((k) => window.VL.words.get(k).w, s.key);
    await page.waitForFunction(() => window.__spoken.length === 1);
    await page.evaluate(() => window.VL.refresh());
    await page.waitForTimeout(400);
    assert.equal(await page.evaluate(() => window.__spoken.length), 1, 'auto-play only once');
    await page.click('.quiz-play');
    assert.deepEqual(await page.evaluate(() => window.__spoken), [lw, lw]);
    assert.ok((await optTexts(page)).includes(lw));
    assert.equal(await page.$('.quiz-word'), null, 'word not shown in listen mode');
    await page.screenshot({ path: path.join(SHOTS, `listen-${device}.png`), fullPage: true });
    await clickRight(page);
    await page.waitForSelector('.quiz-detail');

    // Gõ chính tả
    await startSession(page, { modes: ['type'], count: 3, keys: ['comm:awkward', 'ielts:allocate', 'comm:apple'] });
    await page.waitForSelector('#quiz-input');
    assert.equal(await page.textContent('.quiz-prompt'), 'Gõ lại từ bạn nghe / có nghĩa là…');
    s = await st(page);
    const tw = await page.evaluate((k) => window.VL.words.get(k), s.key);
    assert.equal((await page.textContent('.quiz-word')).trim(), tw.vi);
    await page.click('.quiz-card [data-action="play"]');
    assert.equal(await page.evaluate(() => window.__spoken[window.__spoken.length - 1]), tw.w);
    // empty → no answer
    await page.click('.quiz-check');
    assert.equal((await st(page)).n, 0);
    await page.fill('#quiz-input', '  ' + tw.w.toUpperCase() + '  ');
    await page.screenshot({ path: path.join(SHOTS, `type-${device}.png`), fullPage: true });
    await page.press('#quiz-input', 'Enter');
    await page.waitForSelector('.quiz-detail');
    assert.equal((await st(page)).n, 1);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.VL.session.current().idx === 1);
    await page.waitForSelector('#quiz-input');
    await page.fill('#quiz-input', 'wrongword');
    await page.click('.quiz-check');
    await page.waitForSelector('.quiz-fb.is-wrong');
    const tw2 = await page.evaluate(() => window.VL.session.item().word.w);
    assert.match(await page.textContent('.quiz-fb-ans'), new RegExp(tw2));
    assert.match(await page.textContent('.quiz-typed'), /wrongword/);
    assert.equal((await st(page)).n, 2);
    await page.click('.quiz-next');
    await page.waitForFunction(() => window.VL.session.current().idx === 2);
    await page.waitForSelector('.quiz-skip');
    await page.click('.quiz-skip');
    await page.waitForSelector('.quiz-fb.is-wrong');
    assert.equal(await page.textContent('.quiz-next'), 'Xem kết quả');
    await page.click('.quiz-next');
    await page.waitForFunction(() => location.hash === '#/result');
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  test(`${device}: "Xem chi tiết" cancels auto-advance; Enter advances once; last item auto → result`, async () => {
    const page = await open(browser, device, '#/practice', { seed: seedLight });
    await startSession(page, { modes: ['mean'], count: 3, keys: ['mine:meticulous', 'comm:suggest', 'comm:mention'] });
    await page.waitForSelector('.quiz-opt');
    await clickRight(page);
    await page.waitForSelector('.quiz-dt-more');
    await page.click('.quiz-dt-more');
    await page.waitForSelector('.quiz-more');
    assert.equal(await page.$('.quiz-dt-note'), null);
    assert.equal(await page.$('.quiz-cd-fill'), null);
    assert.equal(await page.$('.quiz-dt-more'), null);
    const key = (await st(page)).key;
    const w = await page.evaluate((k) => window.VL.words.get(k), key);
    const more = await page.textContent('.quiz-more');
    if (w.note) assert.ok(more.includes(w.note));
    (w.syn || []).forEach((x) => assert.ok(more.includes(x)));
    assert.equal(await page.getAttribute('.quiz-dt-link', 'href'), '#/word/' + encodeURIComponent(key));
    await page.screenshot({ path: path.join(SHOTS, `detail-more-${device}.png`), fullPage: true });
    await page.waitForTimeout(3400);
    assert.equal((await st(page)).idx, 0, 'held: no auto-advance');
    await page.evaluate(() => window.VL.refresh());
    assert.ok(await page.$('.quiz-more'), 'expanded state survives refresh');
    await page.click('.quiz-dt-next');
    await page.waitForFunction(() => window.VL.session.current().idx === 1);
    // Enter in detail → exactly one advance (timer cleared)
    await page.waitForSelector('.quiz-opt:not([disabled])');
    await clickRight(page);
    await page.waitForSelector('.quiz-detail');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.VL.session.current().idx === 2);
    await page.waitForSelector('.quiz-opt:not([disabled])');
    await page.waitForTimeout(3300);
    assert.equal((await st(page)).idx, 2);
    // last item: correct → "Xem kết quả" label, auto → #/result
    await clickRight(page);
    await page.waitForSelector('.quiz-detail');
    assert.equal(await page.textContent('.quiz-dt-next'), 'Xem kết quả');
    await page.waitForFunction(() => location.hash === '#/result', null, { timeout: 4000 });
    const fin = await page.evaluate(() => window.VL.session.last());
    assert.equal(fin.total, 3); assert.equal(fin.right, 3);
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  test(`${device}: close × confirms, quits → result if answered else practice; mixed with flash`, async () => {
    const page = await open(browser, device, '#/practice', { seed: seedLight });
    await startSession(page, { modes: ['mean'], count: 3 });
    await page.click('.quiz-close');
    await page.waitForSelector('.sheet');
    await page.click('.sheet [data-r="0"]');
    assert.equal((await st(page)).hash, '#/quiz');
    await page.click('.quiz-close');
    await page.click('.sheet [data-r="1"]');
    await page.waitForFunction(() => location.hash === '#/practice');
    assert.equal(await page.evaluate(() => window.VL.session.current()), null);

    await startSession(page, { modes: ['mean'], count: 3 });
    await clickRight(page);
    await page.waitForSelector('.quiz-detail');
    await page.click('.quiz-close');
    await page.waitForTimeout(3300);
    assert.equal((await st(page)).hash, '#/quiz', 'auto-advance paused while the dialog is open');
    await page.click('.sheet [data-r="0"]');
    await page.waitForFunction(() => window.VL.session.current().idx === 1, null, { timeout: 4000 });
    await clickRight(page);
    await page.waitForSelector('.quiz-detail');
    await page.click('.quiz-close');
    await page.click('.sheet [data-r="1"]');
    await page.waitForFunction(() => location.hash === '#/result');

    // flash item on #/quiz redirects to #/flash
    await page.evaluate(() => { window.VL.session.start({ modes: ['flash'], count: 2 }); });
    await page.waitForFunction(() => location.hash === '#/flash');
    await page.evaluate(() => { location.hash = '#/quiz'; });
    await page.waitForFunction(() => location.hash === '#/flash');
    // a finished session on #/quiz → result
    await page.evaluate(() => { const VL = window.VL; VL.session.answer(true); VL.session.next(); VL.session.answer(true); VL.session.next(); });
    await page.waitForFunction(() => location.hash === '#/result');
    await page.evaluate(() => { location.hash = '#/quiz'; });
    await page.waitForFunction(() => location.hash === '#/result');
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });
}

test('laptop: Back button leaves a running session (no #/flash ⇄ #/quiz trap); auto-advance does not fire after leaving', async () => {
  const page = await open(browser, 'laptop', '#/today', { seed: seedLight });
  await page.evaluate(() => { location.hash = '#/practice'; });
  await page.waitForFunction(() => location.hash === '#/practice');
  await page.evaluate(() => {
    const VL = window.VL;
    VL.session.start({ keys: ['comm:appreciate', 'comm:suggest', 'comm:mention'], modes: ['flash', 'mean'], order: 'seq', count: 3 });
    const s = VL.store.state.session;
    s.queue = [{ key: 'comm:appreciate', mode: 'flash' }, { key: 'comm:suggest', mode: 'mean' }, { key: 'comm:mention', mode: 'mean' }];
    VL.store.save(); VL.session.go(true);
  });
  await page.waitForFunction(() => location.hash === '#/flash' && document.querySelector('.flash-btn-right'));
  await page.click('.flash-btn-right');
  await page.click('[data-action="next"]');
  await page.waitForFunction(() => location.hash === '#/quiz' && document.querySelector('.quiz-opt'));
  await page.goBack();
  await page.waitForFunction(() => location.hash === '#/practice', null, { timeout: 3000 });
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => location.hash), '#/practice', 'Back left the session screens');

  // correct answer starts the 3 s auto-advance; leaving the page must cancel it
  await page.evaluate(() => window.VL.session.go());
  await page.waitForFunction(() => location.hash === '#/quiz' && document.querySelector('.quiz-opt'));
  await clickRight(page);
  await page.waitForSelector('.quiz-detail');
  await page.evaluate(() => { location.hash = '#/today'; });
  await page.waitForTimeout(3400);
  assert.equal(await page.evaluate(() => location.hash), '#/today');
  assert.equal(await page.evaluate(() => window.VL.session.current().idx), 1);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('laptop: a word deleted mid-session is skipped instead of a dead end', async () => {
  const page = await open(browser, 'laptop', '#/today', { seed: seedLight });
  await page.evaluate(() => {
    const VL = window.VL;
    VL.session.start({ keys: ['mine:albeit', 'comm:suggest'], modes: ['mean'], order: 'seq', count: 2 });
    VL.store.state.session.queue = [{ key: 'mine:albeit', mode: 'mean' }, { key: 'comm:suggest', mode: 'mean' }];
    VL.words.remove('mine:albeit');
    VL.refresh();
  });
  await page.waitForFunction(() => document.querySelector('.quiz-word'));
  assert.equal((await page.textContent('.quiz-word')).trim(), 'suggest');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});
