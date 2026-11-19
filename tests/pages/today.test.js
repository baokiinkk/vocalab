/* Browser tests for the "Hôm nay" page. Run: node --test tests/pages/today.test.js (from the project root). */
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const { launch, open } = require('../pw');
const { seed } = require('../fixtures');

const DEVICES = ['laptop', 'ipad', 'iphone'];
const SHOTS = path.join(__dirname, '..', 'shots', 'today');
fs.mkdirSync(SHOTS, { recursive: true });

let browser;
test.before(async () => { browser = await launch(); });
test.after(async () => { await browser.close(); });

const hash = (p) => p.evaluate(() => location.hash);
const noHScroll = (p) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

for (const device of DEVICES) {
  test(`${device}: seeded dashboard renders live data`, async () => {
    const p = await open(browser, device, '#/today', { seed });
    await p.waitForTimeout(200);
    assert.ok(await p.isVisible('.page-today h1'), 'h1 visible');
    const h1 = await p.textContent('h1');
    assert.match(h1, /^Chào buổi/);
    const eyebrow = await p.textContent('.page-head .eyebrow');
    assert.equal(eyebrow, await p.evaluate(() => VL.fmtToday()));
    assert.match(await p.textContent('.today-streak'), /Chuỗi 12 ngày/);

    // Phiên hôm nay matches todayPlan
    const plan = await p.evaluate(() => { const x = VL.srs.todayPlan(); return { plan: x.plan, weak: x.weak.length, done: x.done, target: x.target }; });
    const stats = await p.$$eval('.today-stat-n', (els) => els.map((e) => e.textContent.trim()));
    assert.equal(stats[0], String(plan.plan));
    assert.equal(stats[1], String(plan.weak));
    assert.match(stats[2], /^~\d+′$/);
    const total = Math.min(plan.target, plan.plan + plan.done);
    assert.equal((await p.textContent('.today-count')).trim(), `${total - plan.plan} / ${total} từ`);

    // Thông thạo
    const ov = await p.evaluate(() => VL.srs.overview());
    assert.equal((await p.textContent('.today-avg-n')).trim(), ov.avg + '%');
    const legend = await p.$$eval('.today-legend-row strong', (els) => els.map((e) => +e.textContent));
    assert.deepEqual(legend, [ov.buckets.weak, ov.buckets.learning, ov.buckets.good, ov.buckets.master]);
    assert.ok(await p.$('.mastery-bar'));

    // Từ cần chú ý: 3 lowest started words
    const rows = await p.$$eval('.today-weak-w', (els) => els.map((e) => e.textContent));
    assert.equal(rows.length, 3);
    assert.ok(rows.includes('meticulous'), 'meticulous (0%) listed: ' + rows);

    // Bộ đang học
    const ids = await p.evaluate(() => VL.decks.mineIds());
    const hrefs = await p.$$eval('.today-deck', (els) => els.map((e) => e.getAttribute('href')));
    assert.deepEqual(hrefs, ids.map((id) => '#/deck/' + id));
    const pcts = await p.$$eval('.today-deck-pct', (els) => els.map((e) => e.textContent));
    assert.deepEqual(pcts, await p.evaluate(() => VL.decks.mineIds().map((id) => VL.decks.stats(id).pct + '%')));

    // grid layout per device
    const cols = await p.$eval('.today-grid', (g) => getComputedStyle(g).gridTemplateColumns.split(' ').length);
    assert.equal(cols, { laptop: 3, ipad: 2, iphone: 1 }[device]);
    const deckCols = await p.$eval('.today-deck-row', (g) => getComputedStyle(g).gridTemplateColumns.split(' ').length);
    assert.equal(deckCols, device === 'ipad' ? 3 : 1);

    assert.ok(await noHScroll(p), 'no horizontal scroll');
    await p.screenshot({ path: path.join(SHOTS, `today-${device}.png`), fullPage: true });
    assert.deepEqual(p.errors, []);
    await p.context().close();
  });

  test(`${device}: buttons and links navigate`, async () => {
    const p = await open(browser, device, '#/today', { seed });
    // quick add with text (Enter)
    await p.fill('#today-add-q', 'serendipity');
    await p.press('#today-add-q', 'Enter');
    await p.waitForFunction(() => location.hash.startsWith('#/add'));
    assert.equal(await hash(p), '#/add?q=serendipity');
    // empty quick add via button
    await p.evaluate(() => VL.go('#/today'));
    await p.waitForSelector('.today-add-btn');
    await p.click('.today-add-btn');
    await p.waitForFunction(() => location.hash === '#/add');

    // weak word row → word detail
    await p.evaluate(() => VL.go('#/today'));
    await p.waitForSelector('.today-weak-row');
    const href = await p.getAttribute('.today-weak-row', 'href');
    assert.match(href, /^#\/word\//);
    await p.click('.today-weak-row');
    await p.waitForFunction((h) => location.hash === h, href);

    // deck → deck detail, library link
    await p.evaluate(() => VL.go('#/today'));
    await p.waitForSelector('.today-deck');
    await p.click('.today-deck >> nth=1');
    await p.waitForFunction(() => location.hash.startsWith('#/deck/'));
    await p.evaluate(() => VL.go('#/today'));
    await p.click('text=Xem thư viện');
    await p.waitForFunction(() => location.hash === '#/library');

    // Ôn ngay → weak session
    await p.evaluate(() => VL.go('#/today'));
    await p.click('[data-action="weak"]');
    await p.waitForFunction(() => /^#\/(flash|quiz)$/.test(location.hash));
    assert.equal(await p.evaluate(() => VL.session.current().preset), 'weak');

    // a running session shows "Tiếp tục phiên"
    await p.evaluate(() => VL.go('#/today'));
    await p.waitForSelector('[data-action="continue"]');
    assert.match(await p.textContent('[data-action="continue"]'), /Tiếp tục phiên/);
    await p.click('[data-action="continue"]');
    await p.waitForFunction(() => /^#\/(flash|quiz)$/.test(location.hash));

    // finish session → "Bắt đầu ôn" starts a 'today' session
    await p.evaluate(() => { VL.session.quit(); VL.go('#/today'); });
    await p.waitForSelector('[data-action="start"]');
    await p.click('[data-action="start"]');
    await p.waitForFunction(() => /^#\/(flash|quiz)$/.test(location.hash));
    assert.equal(await p.evaluate(() => VL.session.current().preset), 'today');
    assert.deepEqual(p.errors, []);
    await p.context().close();
  });

  test(`${device}: data is live and persists`, async () => {
    const p = await open(browser, device, '#/today', { seed });
    const need = () => p.textContent('.today-stat-n');
    const before = (await need()) + (await p.textContent('.today-count'));
    const key = await p.evaluate(() => VL.srs.todayPlan().fresh[0] || VL.srs.todayPlan().due[0]);
    await p.evaluate((k) => { VL.srs.record(k, true, 'flash'); VL.store.save(); VL.refresh(); }, key);
    const after = (await need()) + (await p.textContent('.today-count'));
    assert.notEqual(before, after, `count changes: ${before} → ${after}`);
    // streak toggle hides the chip
    await p.evaluate(() => { VL.store.setSetting('sw.streak', false); VL.refresh(); });
    assert.equal(await p.$('.today-streak'), null);
    await p.reload();
    await p.waitForFunction(() => window.VL && VL.current());
    assert.equal(await p.$('.today-streak'), null, 'setting persisted');
    assert.equal((await need()) + (await p.textContent('.today-count')), after, 'progress persisted');
    assert.deepEqual(p.errors, []);
    await p.context().close();
  });

  test(`${device}: empty storage`, async () => {
    const p = await open(browser, device, '#/today');
    await p.waitForTimeout(200);
    assert.match(await p.textContent('.today-streak'), /Chuỗi 0 ngày/);
    assert.ok(await p.$('.today-empty'), 'no weak words empty state');
    assert.equal((await p.textContent('.today-avg-n')).trim(), '0%');
    assert.equal(await p.$$eval('.today-deck', (e) => e.length), 3);
    assert.ok(await noHScroll(p));
    await p.screenshot({ path: path.join(SHOTS, `today-empty-${device}.png`), fullPage: true });
    // Ôn ngay with no weak words → toast + inline notice, stays on page
    await p.click('[data-action="weak"]');
    await p.waitForSelector('.toast.is-show');
    assert.equal(await hash(p), '#/today');
    assert.ok(await p.$('.today-notice'));

    // Nothing at all to practise: remove every deck → done state, start falls back to toast + library link
    await p.evaluate(() => { VL.decks.mineIds().forEach((id) => VL.decks.remove(id)); VL.refresh(); });
    assert.match(await p.textContent('.today-card'), /Chưa có từ nào để ôn/);
    assert.equal((await p.textContent('.today-count')).trim(), '0 / 0 từ');
    assert.equal(await p.$$eval('.today-deck', (e) => e.length), 1, 'Từ của tôi always shown');
    await p.click('[data-action="start"]');
    await p.waitForSelector('.today-notice a[href="#/library"]');
    assert.equal(await hash(p), '#/today');
    await p.screenshot({ path: path.join(SHOTS, `today-nothing-${device}.png`), fullPage: true });
    assert.deepEqual(p.errors, []);
    await p.context().close();
  });
}
