/* Browser tests for "Chi tiết bộ từ" (#/deck/<id>). Run: node --test tests/pages/deck.test.js */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { launch, open } = require('../pw');
const { seed } = require('../fixtures');

const SHOTS = path.join(__dirname, '..', 'shots', 'deck');
fs.mkdirSync(SHOTS, { recursive: true });
const DEVICES = ['laptop', 'ipad', 'iphone'];

let browser;
test.before(async () => { browser = await launch(); });
test.after(async () => { await browser.close(); });

const hashOf = (p) => p.evaluate(() => location.hash);
const noHScroll = async (p) => {
  const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(over <= 0, 'horizontal overflow ' + over + 'px');
};

for (const device of DEVICES) {
  test(`[${device}] mine deck: header, stats, actions, list, filters, search`, async () => {
    const p = await open(browser, device, '#/deck/mine', { seed });
    await p.waitForSelector('.deck-h1');
    assert.equal(await p.textContent('.deck-h1'), 'Từ của tôi');
    assert.equal(await p.textContent('.deck-kind'), 'Bộ cá nhân');
    const stats = await p.$$eval('.deck-stat-l', (els) => els.map((e) => e.textContent));
    assert.deepEqual(stats, ['từ', 'thông thạo TB', 'từ yếu']);
    const n = await p.evaluate(() => VL.words.inDeck('mine').length);
    assert.equal(await p.textContent('.deck-stat-v'), String(n));
    assert.equal(await p.textContent('.deck-count'), n + ' từ');
    assert.ok(await p.isVisible('text=Mọi từ bạn tự thêm đều nằm trong bộ này.'));
    assert.equal(await p.getAttribute('.deck-btn-outline', 'href'), '#/add?deck=mine');
    assert.equal(await p.getAttribute('.deck-back', 'href'), '#/library');
    // nav active
    assert.equal(await p.getAttribute('.nav-item[aria-current="page"]', 'href'), '#/library');
    // rows with rings
    assert.equal(await p.locator('.deck-row').count(), n);
    assert.equal(await p.locator('.deck-row .score-ring').count(), n);
    // filters
    const labels = await p.$$eval('.deck-filter', (els) => els.map((e) => e.textContent));
    assert.deepEqual(labels, ['Tất cả', 'Yếu', 'Đang học', 'Thành thạo']);
    await p.click('.deck-filter[data-value="weak"]');
    const weak = await p.evaluate(() => VL.words.inDeck('mine').filter((k) => VL.srs.score(k) < 30).length);
    assert.equal(await p.locator('.deck-row').count(), weak);
    assert.equal(await p.getAttribute('.deck-filter[data-value="weak"]', 'aria-pressed'), 'true');
    await p.click('.deck-filter[data-value="all"]');
    // search keeps focus & filters (diacritics-insensitive on meaning)
    await p.click('#deck-q');
    await p.keyboard.type('tỉ mi');
    assert.equal(await p.locator('.deck-row').count(), 1);
    assert.equal(await p.evaluate(() => document.activeElement.id), 'deck-q');
    assert.match(await p.textContent('.deck-row-w'), /meticulous/);
    await p.fill('#deck-q', 'zzzz');
    assert.ok(await p.isVisible('text=Không có từ nào khớp. Thử từ khoá khác.'));
    await p.fill('#deck-q', 'deadline');
    assert.equal(await p.getAttribute('.deck-row', 'href'), '#/word/' + encodeURIComponent('mine:deadline'));
    await p.click('.deck-row');
    assert.equal(await hashOf(p), '#/word/' + encodeURIComponent('mine:deadline'));
    await p.goBack();
    await p.waitForSelector('.deck-h1');
    // practice starts a session
    await p.click('.deck-btn-primary[data-action="practice"]');
    await p.waitForFunction(() => /#\/(flash|quiz)/.test(location.hash));
    const s = await p.evaluate(() => VL.store.state.session);
    assert.deepEqual(s.decks, ['mine']);
    assert.ok(s.queue.every((it) => it.key.startsWith('mine:')));
    assert.deepEqual(p.errors, []);
    await p.context().close();
  });

  test(`[${device}] built-in deck not added → add with perDay, then added state, perDay, remove`, async () => {
    const p = await open(browser, device, '#/deck/toeic', { seed });
    await p.waitForSelector('.deck-h1');
    await p.waitForTimeout(150);
    await p.screenshot({ path: path.join(SHOTS, `toeic-notadded-${device}.png`), fullPage: true });
    await noHScroll(p);
    assert.equal(await p.textContent('.deck-h1'), '600 từ TOEIC thiết yếu');
    const vals = await p.$$eval('.deck-stat-v', (els) => els.map((e) => e.textContent));
    assert.deepEqual(vals, ['600', 'B1–B2', '—']);
    assert.ok(await p.isVisible('text=Bộ này được thêm nguyên vẹn thành một bộ riêng, không trộn vào “Từ của tôi”.'));
    assert.equal(await p.textContent('.deck-stepper-val'), '10');
    assert.equal(await p.textContent('.deck-perday-sub'), 'Học xong cả bộ sau khoảng 60 ngày');
    await p.click('.deck-stepper-btn[data-step="1"]');
    await p.click('.deck-stepper-btn[data-step="1"]');
    assert.equal(await p.textContent('.deck-stepper-val'), '20');
    assert.equal(await p.textContent('.deck-perday-sub'), 'Học xong cả bộ sau khoảng 30 ngày');
    for (let i = 0; i < 12; i++) if (await p.isEnabled('.deck-stepper-btn[data-step="1"]')) await p.click('.deck-stepper-btn[data-step="1"]');
    assert.equal(await p.textContent('.deck-stepper-val'), '50');
    assert.ok(await p.isDisabled('.deck-stepper-btn[data-step="1"]'));
    for (let i = 0; i < 6; i++) await p.click('.deck-stepper-btn[data-step="-1"]');
    assert.equal(await p.textContent('.deck-stepper-val'), '20');
    // no rings / filters when not added; practice not offered
    assert.equal(await p.locator('.deck-row .score-ring').count(), 0);
    assert.equal(await p.locator('.deck-filter').count(), 0);
    assert.equal(await p.locator('[data-action="practice"]').count(), 0);
    // pagination 50 → 100
    assert.equal(await p.locator('.deck-row').count(), 50);
    assert.equal(await p.textContent('.deck-more'), 'Xem thêm 50 từ');
    await p.click('.deck-more');
    assert.equal(await p.locator('.deck-row').count(), 100);
    // add
    await p.click('.deck-btn-primary[data-action="add"]');
    await p.waitForSelector('.deck-added');
    assert.ok(await p.isVisible('#toast.is-show'));
    assert.deepEqual(await p.evaluate(() => ({ a: VL.decks.isAdded('toeic'), n: VL.decks.perDay('toeic') })), { a: true, n: 20 });
    assert.equal(await p.textContent('.deck-added'), '✓ Đã có trong Bộ của tôi');
    assert.equal(await p.locator('.deck-row .score-ring').count(), 100); // limit kept across refresh
    assert.equal(await p.locator('.deck-filter').count(), 4);
    await p.waitForTimeout(150);
    await p.screenshot({ path: path.join(SHOTS, `toeic-added-${device}.png`), fullPage: true });
    // perDay stepper bound to setPerDay
    await p.click('.deck-stepper-btn[data-step="1"]');
    assert.equal(await p.evaluate(() => VL.decks.perDay('toeic')), 25);
    assert.equal(await p.textContent('.deck-stepper-val'), '25');
    // persists after reload
    await p.reload();
    await p.waitForSelector('.deck-added');
    assert.equal(await p.textContent('.deck-stepper-val'), '25');
    // record progress, mastery shows
    await p.evaluate(() => { for (let i = 0; i < 10; i++) VL.srs.record('toeic:invoice', true, 'flash'); VL.store.save(); VL.refresh(); });
    const pct = await p.evaluate(() => VL.decks.stats('toeic').pct);
    assert.equal(await p.textContent('.deck-mastery-row strong'), pct + '%');
    // remove: cancel then confirm
    await p.click('[data-action="remove"]');
    await p.click('.sheet [data-r="0"]');
    assert.ok(await p.evaluate(() => VL.decks.isAdded('toeic')));
    await p.click('[data-action="remove"]');
    await p.click('.sheet [data-r="1"]');
    await p.waitForSelector('[data-action="add"]');
    assert.equal(await p.evaluate(() => VL.decks.isAdded('toeic')), false);
    assert.ok(await p.evaluate(() => VL.srs.isStarted('toeic:invoice')), 'progress kept');
    assert.deepEqual(p.errors, []);
    await p.context().close();
  });

  test(`[${device}] added deck (comm): practice, screenshot, no overflow`, async () => {
    const p = await open(browser, device, '#/deck/comm', { seed });
    await p.waitForSelector('.deck-added');
    await p.waitForTimeout(150);
    await p.screenshot({ path: path.join(SHOTS, `comm-added-${device}.png`), fullPage: true });
    await noHScroll(p);
    await p.click('[data-action="practice"]');
    await p.waitForFunction(() => /#\/(flash|quiz)/.test(location.hash));
    assert.deepEqual(await p.evaluate(() => VL.store.state.session.decks), ['comm']);
    assert.deepEqual(p.errors, []);
    await p.context().close();
  });

  test(`[${device}] mine deck screenshot; empty mine deck practice toast; unknown deck`, async () => {
    const p = await open(browser, device, '#/deck/mine', { seed });
    await p.waitForSelector('.deck-h1');
    await p.waitForTimeout(150);
    await p.screenshot({ path: path.join(SHOTS, `mine-${device}.png`), fullPage: true });
    await noHScroll(p);
    await p.context().close();

    const e = await open(browser, device, '#/deck/mine');
    await e.waitForSelector('.deck-h1');
    assert.ok(await e.isVisible('text=Bộ này chưa có từ nào.'));
    await e.click('[data-action="practice"]');
    assert.match(await e.textContent('#toast'), /chưa có từ nào/);
    assert.equal(await hashOf(e), '#/deck/mine');
    await e.evaluate(() => VL.go('#/deck/nope'));
    await e.waitForSelector('.empty');
    assert.ok(await e.isVisible('text=Không tìm thấy bộ từ này'));
    assert.equal(await e.getAttribute('.empty a', 'href'), '#/library');
    await e.screenshot({ path: path.join(SHOTS, `unknown-${device}.png`), fullPage: true });
    assert.deepEqual(e.errors, []);
    await e.context().close();
  });
}

test('[laptop] dark theme renders without errors', async () => {
  const p = await open(browser, 'laptop', '#/deck/comm', { seed: (VL) => { VL.store.setSetting('theme', 'dark'); } });
  await p.waitForSelector('.deck-added');
  await p.waitForTimeout(150);
  await p.screenshot({ path: path.join(SHOTS, 'comm-dark-laptop.png'), fullPage: true });
  assert.deepEqual(p.errors, []);
  await p.context().close();
});
