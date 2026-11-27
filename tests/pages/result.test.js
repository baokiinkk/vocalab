/* Browser tests for 9 · Kết quả phiên (#/result). Run: node --test tests/pages/result.test.js */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { launch, open } = require('../pw');
const { seed } = require('../fixtures');

const SHOTS = path.join(__dirname, '..', 'shots', 'result');
fs.mkdirSync(SHOTS, { recursive: true });
const DEVICES = ['laptop', 'ipad', 'iphone'];

// Session plan: the same word appears twice (different modes); wrong answers at index 1 and 3.
const KEYS = ['comm:appreciate', 'comm:suggest', 'mine:deadline', 'mine:reluctant', 'ielts:analyse', 'comm:appreciate'];
const WRONG_AT = [1, 3];

/** Runs inside the page: start a session and answer every item. */
async function runSession(page, opts) {
  opts = opts || {};
  await page.evaluate(({ keys, wrongAt, stopAt, preset }) => {
    const VL = window.VL;
    VL.session.start({ keys, modes: ['flash', 'mean'], order: 'seq', count: keys.length, preset });
    const s = VL.store.state.session;
    // make the queue deterministic (keys in given order, alternate modes)
    s.queue = keys.map((key, i) => ({ key, mode: i % 2 ? 'mean' : 'flash' }));
    VL.store.save();
    for (let i = 0; i < keys.length; i++) {
      if (stopAt != null && i === stopAt) return;
      VL.session.answer(wrongAt.indexOf(i) < 0);
      VL.session.next();
    }
  }, { keys: KEYS, wrongAt: WRONG_AT, stopAt: opts.stopAt == null ? null : opts.stopAt, preset: opts.preset || 'today' });
  await page.waitForFunction(() => location.hash === '#/result' || window.VL.store.state.session && !window.VL.store.state.session.done);
}

let browser;
test.before(async () => { browser = await launch(); });
test.after(async () => { await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 5000))]); });
const pages = [];
test.afterEach(async () => { while (pages.length) { const p = pages.pop(); await p.context().close().catch(() => {}); } });
const openP = async (...a) => { const p = await open(browser, ...a); pages.push(p); return p; };

for (const device of DEVICES) {
  test(`result · ${device} · empty state`, async () => {
    const page = await openP(device, '#/result');
    await page.waitForSelector('.result-root');
    assert.equal((await page.textContent('h1')).trim(), 'Chưa có phiên nào');
    assert.ok(await page.$('.result-root a[href="#/practice"]'));
    assert.ok(await page.$('.result-root a[href="#/today"]'));
    assert.equal(await page.evaluate(() => document.getElementById('app').classList.contains('is-focus')), true);
    assert.equal(await page.$('.tabbar, .sidebar, .rail'), null, 'nav hidden on focus screen');
    await page.screenshot({ path: path.join(SHOTS, `empty-${device}.png`), fullPage: true });
    await page.click('.result-root a[href="#/practice"]');
    await page.waitForFunction(() => location.hash === '#/practice');
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  test(`result · ${device} · finished session numbers, filters, navigation`, async () => {
    const page = await openP(device, '#/today', { seed });
    await runSession(page);
    await page.waitForFunction(() => location.hash === '#/result');
    await page.waitForSelector('.result-ring');
    const r = await page.evaluate(() => window.VL.session.last());
    assert.equal(r.total, 6);
    assert.equal(r.right, 4);
    assert.equal(r.pct, 67);
    assert.deepEqual(r.wrongKeys.sort(), ['comm:suggest', 'mine:reluctant']);

    assert.equal((await page.textContent('.result-pct')).trim(), '67%');
    assert.equal((await page.textContent('.result-frac')).trim(), '4/6 đúng');
    assert.equal((await page.textContent('h1')).trim(), 'Xong phiên hôm nay!');
    assert.equal((await page.textContent('.result-streak')).trim(), `Chuỗi ${r.streak} ngày · giữ lửa nhé`);
    assert.equal(r.streak, 13, 'streak continues from yesterday');
    const stats = await page.$$eval('.result-stat-v', (els) => els.map((e) => e.textContent.trim()));
    assert.equal(stats[0], r.minutes + ' phút');
    assert.deepEqual(await page.$$eval('.result-stat-l', (els) => els.map((e) => e.textContent.trim())), ['thời gian học', 'thông thạo TB', 'đạt 100%']);
    assert.equal(stats[1], `${r.avgBefore}→${r.avgAfter}%`);
    const mg = r.masteredGain;
    assert.equal(stats[2], (mg > 0 ? '+' : mg < 0 ? '−' : '') + Math.abs(mg) + ' từ');
    assert.equal(await page.$$eval('.result-hero .result-stat', (e) => e.length), 0, 'stats are tiles below the hero');
    assert.ok(mg >= 1, 'deadline reached 100%');

    // rows: every answer, in order, with correct mark/mode/change/range/link
    const rows = await page.$$eval('.result-row', (els) => els.map((e) => ({
      href: e.getAttribute('href'), ok: e.classList.contains('is-ok'), mark: e.querySelector('.result-mark').textContent.trim(),
      w: e.querySelector('.result-word strong').textContent.trim(), mode: e.querySelector('.result-word span').textContent.trim(),
      delta: e.querySelector('.result-delta').textContent.trim(), range: e.querySelector('.result-range').textContent.trim() })));
    assert.equal(rows.length, 6);
    const exp = await page.evaluate(() => window.VL.session.last().results.map((x) => ({
      href: window.VL.href.word(x.key), ok: x.ok, w: window.VL.words.get(x.key).w, mode: window.VL.modeTitle(x.mode),
      delta: (x.after - x.before >= 0 ? '+' : '−') + Math.abs(x.after - x.before) + '%',
      range: x.before + '% → ' + x.after + '%' + (x.after >= 100 ? ' · thành thạo' : '') })));
    rows.forEach((row, i) => {
      assert.equal(row.href, exp[i].href); assert.equal(row.ok, exp[i].ok); assert.equal(row.mark, exp[i].ok ? '✓' : '✕');
      assert.equal(row.w, exp[i].w); assert.equal(row.mode, exp[i].mode); assert.equal(row.delta, exp[i].delta); assert.equal(row.range, exp[i].range);
    });
    assert.equal(rows.filter((x) => x.w === 'appreciate').length, 2, 'repeated word shows each answer');
    assert.ok(rows[1].delta.startsWith('−'), 'wrong answer shows negative change');

    // filters
    assert.equal((await page.textContent('[data-value="all"]')).trim(), 'Tất cả · 6');
    assert.equal((await page.textContent('[data-value="wrong"]')).trim(), 'Sai · 2');
    await page.click('[data-value="wrong"]');
    assert.equal(await page.$$eval('.result-row', (e) => e.length), 2);
    assert.equal(await page.$$eval('.result-row.is-ok', (e) => e.length), 0);
    assert.equal(await page.getAttribute('[data-value="wrong"]', 'aria-selected'), 'true');
    await page.screenshot({ path: path.join(SHOTS, `wrong-${device}.png`), fullPage: true });
    await page.click('[data-value="all"]');
    assert.equal(await page.$$eval('.result-row', (e) => e.length), 6);
    await page.screenshot({ path: path.join(SHOTS, `result-${device}.png`), fullPage: true });

    // no horizontal scroll
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no horizontal scroll');

    // persists after reload
    await page.reload();
    await page.waitForSelector('.result-ring');
    assert.equal((await page.textContent('.result-pct')).trim(), '67%');

    // retry button
    assert.equal((await page.textContent('[data-action="retry"]')).trim(), 'Ôn lại 2 từ sai');

    // row link → word page
    await page.click('.result-row >> nth=0');
    await page.waitForFunction((h) => location.hash === h, exp[0].href);
    await page.goBack();
    await page.waitForSelector('.result-ring');

    // Về trang chủ clears the finished session, result still viewable from history
    await page.click('.result-foot [data-action="home"]');
    await page.waitForFunction(() => location.hash === '#/today');
    assert.equal(await page.evaluate(() => window.VL.store.state.session), null);
    await page.evaluate(() => window.VL.go('#/result'));
    await page.waitForSelector('.result-ring');
    assert.equal((await page.textContent('.result-pct')).trim(), '67%');
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  test(`result · ${device} · retry creates session of only wrong words`, async () => {
    const page = await openP(device, '#/today', { seed });
    await runSession(page);
    await page.waitForSelector('[data-action="retry"]');
    await page.click('[data-action="retry"]');
    await page.waitForFunction(() => location.hash === '#/flash' || location.hash === '#/quiz');
    const s = await page.evaluate(() => { const s = window.VL.store.state.session; return { keys: s.queue.map((q) => q.key).sort(), source: s.source, done: !!s.done }; });
    assert.deepEqual(s.keys, ['comm:suggest', 'mine:reluctant']);
    assert.equal(s.source, 'retry');
    assert.equal(s.done, false);
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  test(`result · ${device} · close button, perfect & low-score variants`, async () => {
    const page = await openP(device, '#/today', { seed });
    // all correct, non-today preset → "Xong phiên luyện!", no retry; primary is Luyện tiếp
    await page.evaluate(() => {
      const VL = window.VL;
      VL.session.start({ keys: ['comm:mention', 'ielts:assume'], modes: ['mean'], preset: 'quick', count: 2 });
      while (VL.session.item()) { VL.session.answer(true); VL.session.next(); }
    });
    await page.waitForFunction(() => location.hash === '#/result');
    await page.waitForSelector('.result-ring');
    assert.equal((await page.textContent('h1')).trim(), 'Xong phiên luyện!');
    assert.equal(await page.$('[data-action="retry"]'), null);
    assert.equal((await page.textContent('[data-value="wrong"]')).trim(), 'Sai · 0');
    await page.click('[data-value="wrong"]');
    assert.ok((await page.textContent('.result-none')).includes('Không có câu sai'));
    assert.ok(await page.$('.result-foot a[href="#/practice"]'));
    // close X → home, clears session
    await page.click('.result-close');
    await page.waitForFunction(() => location.hash === '#/today');
    assert.equal(await page.evaluate(() => window.VL.store.state.session), null);
    // low score
    await page.evaluate(() => {
      const VL = window.VL;
      VL.session.start({ keys: ['comm:mention', 'ielts:assume', 'ielts:derive'], modes: ['mean'], preset: 'today', count: 3 });
      while (VL.session.item()) { VL.session.answer(false); VL.session.next(); }
    });
    await page.waitForFunction(() => location.hash === '#/result');
    await page.waitForSelector('.result-ring');
    assert.equal((await page.textContent('.result-pct')).trim(), '0%');
    assert.equal((await page.textContent('h1')).trim(), 'Cố lên, ôn lại sẽ nhớ hơn!');
    assert.equal((await page.textContent('[data-action="retry"]')).trim(), 'Ôn lại 3 từ sai');
    await page.screenshot({ path: path.join(SHOTS, `low-${device}.png`), fullPage: true });
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  test(`result · ${device} · partial summary while session running`, async () => {
    const page = await openP(device, '#/today', { seed });
    await runSession(page, { stopAt: 3 });
    await page.evaluate(() => window.VL.go('#/result'));
    await page.waitForSelector('.result-ring');
    assert.equal((await page.textContent('h1')).trim(), 'Phiên đang dở');
    assert.equal((await page.textContent('.result-frac')).trim(), '2/3 đúng');
    assert.equal(await page.$$eval('.result-row', (e) => e.length), 3);
    assert.equal(await page.$('[data-action="retry"]'), null);
    await page.screenshot({ path: path.join(SHOTS, `partial-${device}.png`), fullPage: true });
    // Về trang chủ keeps a running session
    await page.click('.result-foot [data-action="home"]');
    await page.waitForFunction(() => location.hash === '#/today');
    assert.ok(await page.evaluate(() => window.VL.store.state.session && !window.VL.store.state.session.done));
    await page.evaluate(() => window.VL.go('#/result'));
    await page.waitForSelector('[data-action="resume"]');
    await page.click('[data-action="resume"]');
    // item 3 is 'mean' → quiz screen
    await page.waitForFunction(() => location.hash === '#/quiz');
    assert.equal(await page.evaluate(() => window.VL.store.state.session.idx), 3);
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });
}

for (const theme of ['light', 'dark']) {
  test(`result · ${theme} theme screenshots (v3 tiles)`, async () => {
    for (const device of DEVICES) {
      const page = await openP(device, '#/today', { seed });
      await page.evaluate((t) => window.VL.store.setSetting('theme', t), theme);
      await page.reload();
      await page.waitForFunction(() => window.VL && window.VL.current && window.VL.current());
      await runSession(page);
      await page.waitForSelector('.result-ring');
      assert.equal(await page.evaluate(() => document.documentElement.getAttribute('data-theme')), theme);
      const bgs = await page.$$eval('.result-stat', (els) => els.map((e) => getComputedStyle(e).backgroundColor));
      assert.equal(new Set(bgs).size, 3, 'three distinct pastel stat tiles');
      assert.ok(await page.$('.result-hero .result-tape'));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no horizontal scroll');
      await page.screenshot({ path: path.join(SHOTS, `${theme}-${device}.png`), fullPage: true });
      assert.deepEqual(page.errors, []);
      await page.context().close();
    }
  });
}
