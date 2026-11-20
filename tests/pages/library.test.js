/* Thư viện page tests: node --test tests/pages/library.test.js (from the project root). */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { launch, open } = require('../pw');
const { seed } = require('../fixtures');

const SHOTS = path.join(__dirname, '..', 'shots', 'library');
fs.mkdirSync(SHOTS, { recursive: true });
const DEVS = ['laptop', 'ipad', 'iphone'];
let browser;
test.before(async () => { browser = await launch(); });
test.after(async () => { await browser.close(); });

const noHScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

for (const dev of DEVS) {
  test(`${dev}: browse view renders live decks and categories`, async () => {
    const page = await open(browser, dev, '#/library', { seed });
    await page.waitForTimeout(250);
    assert.equal(await page.textContent('h1'), 'Thư viện');
    assert.ok(await page.$('#app.page-library.device-' + dev));
    // nav item active
    assert.equal(await page.getAttribute('#nav a[href="#/library"]', 'aria-current'), 'page');
    const live = await page.evaluate(() => VL.decks.mineIds().map((id) => ({ id, n: VL.decks.get(id).n, pct: VL.decks.stats(id).pct })));
    const cards = await page.$$eval('.lib-mine-card', (els) => els.map((e) => ({ href: e.getAttribute('href'), name: e.querySelector('.lib-mine-name').textContent, meta: e.querySelector('.lib-mine-meta').textContent, pct: e.querySelector('.lib-pct').textContent })));
    assert.equal(cards.length, live.length);
    assert.equal(await page.textContent('.lib-count'), live.length + ' bộ');
    assert.equal(cards[0].name, 'Từ của tôi');
    assert.equal(cards[0].meta, live[0].n + ' từ tự thêm');
    assert.equal(live[0].n, 6);
    cards.forEach((c, i) => {
      assert.equal(c.href, '#/deck/' + live[i].id);
      assert.equal(c.pct, live[i].pct + '%');
      if (i) assert.equal(c.meta, live[i].n + ' từ · bộ có sẵn');
    });
    // grid columns per device
    const cols = await page.$eval('.lib-mine-grid', (e) => getComputedStyle(e).gridTemplateColumns.split(' ').length);
    assert.equal(cols, dev === 'laptop' ? 3 : dev === 'ipad' ? 2 : 1);
    // categories
    const cats = await page.$$eval('.lib-cat-head .h2', (els) => els.map((e) => e.textContent));
    assert.deepEqual(cats, ['Giao tiếp', 'Hằng ngày', 'Chuyên ngành', 'Luyện thi']);
    assert.equal(await page.$$eval('.lib-deck-card', (e) => e.length), 12);
    assert.equal(await page.textContent('.lib-deck-card[data-deck="comm"] .lib-badge'), '✓ Đã thêm');
    assert.equal(await page.textContent('.lib-deck-card[data-deck="phr"] .lib-badge'), 'Có sẵn');
    const phrMeta = await page.evaluate(() => { const d = VL.decks.get('phr'); return d.n + ' từ · ' + d.level; });
    assert.equal(await page.textContent('.lib-deck-card[data-deck="phr"] .lib-deck-meta'), phrMeta);
    if (dev !== 'laptop') {
      const w = await page.$eval('.lib-deck-card', (e) => e.getBoundingClientRect().width);
      assert.equal(Math.round(w), dev === 'ipad' ? 230 : 210);
      assert.equal(await page.$eval('.lib-row', (e) => getComputedStyle(e).overflowX), 'auto');
    } else {
      assert.equal(await page.$eval('.lib-row', (e) => getComputedStyle(e).gridTemplateColumns.split(' ').length), 3);
    }
    assert.ok(await noHScroll(page), 'no horizontal page scroll');
    await page.screenshot({ path: path.join(SHOTS, `browse-${dev}.png`), fullPage: true });
    // navigation
    await page.click('.lib-deck-card[data-deck="phr"]');
    await page.waitForFunction(() => location.hash === '#/deck/phr');
    await page.goBack();
    await page.waitForFunction(() => VL.current().name === 'library');
    await page.click('.lib-mine-card[data-deck="mine"]');
    await page.waitForFunction(() => location.hash === '#/deck/mine');
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  test(`${dev}: search words, decks, no hits, clear, URL & back`, async () => {
    const page = await open(browser, dev, '#/library', { seed });
    await page.click('#lib-q');
    await page.keyboard.type('meti');
    await page.waitForSelector('.lib-word-hit');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'lib-q');
    assert.equal(await page.inputValue('#lib-q'), 'meti');
    assert.equal(await page.evaluate(() => location.hash), '#/library?q=meti');
    const sum = await page.textContent('.lib-sum');
    const n = await page.evaluate(() => VL.words.search('meti', 8).length);
    assert.equal(sum, n + ' từ · 0 bộ khớp “meti”');
    const first = await page.$eval('.lib-word-hit', (e) => ({ href: e.getAttribute('href'), w: e.querySelector('strong').textContent, deck: e.querySelector('.lib-hit-deck').textContent }));
    assert.deepEqual(first, { href: '#/word/mine%3Ameticulous', w: 'meticulous', deck: 'Từ của tôi' });
    assert.ok(!(await page.$('.lib-mine-grid')), 'browse hidden while searching');
    await page.screenshot({ path: path.join(SHOTS, `search-${dev}.png`), fullPage: true });
    // open word, come back: query restored
    await page.click('.lib-word-hit');
    await page.waitForFunction(() => location.hash === '#/word/mine%3Ameticulous');
    await page.goBack();
    await page.waitForFunction(() => VL.current().name === 'library');
    assert.equal(await page.inputValue('#lib-q'), 'meti');
    assert.ok(await page.$('.lib-word-hit'));

    // deck search (diacritics-insensitive)
    await page.fill('#lib-q', 'ielts');
    await page.waitForSelector('.lib-deck-hit');
    const decks = await page.$$eval('.lib-deck-hit', (els) => els.map((e) => e.getAttribute('href')));
    assert.deepEqual(decks, ['#/deck/ielts', '#/deck/iw']);
    assert.match(await page.textContent('.lib-sum'), /· 2 bộ khớp “ielts”$/);
    await page.fill('#lib-q', 'tu cua toi');
    await page.waitForSelector('.lib-deck-hit[href="#/deck/mine"]');
    await page.fill('#lib-q', 'ielts');
    await page.click('.lib-deck-hit[href="#/deck/ielts"]');
    await page.waitForFunction(() => location.hash === '#/deck/ielts');
    await page.goBack();
    await page.waitForFunction(() => VL.current().name === 'library');

    // no hits
    await page.fill('#lib-q', 'zzqxv');
    await page.waitForSelector('.lib-none');
    assert.equal(await page.textContent('.lib-none strong'), 'Không tìm thấy “zzqxv”');
    assert.equal(await page.textContent('.lib-sum'), '0 từ · 0 bộ khớp “zzqxv”');
    assert.equal(await page.getAttribute('.lib-none-add', 'href'), '#/add?q=zzqxv');
    assert.equal(await page.textContent('.lib-none-add'), '+ Thêm “zzqxv” vào Từ của tôi');
    assert.ok(await noHScroll(page));
    await page.screenshot({ path: path.join(SHOTS, `nohits-${dev}.png`), fullPage: true });
    await page.click('.lib-none-add');
    await page.waitForFunction(() => location.hash === '#/add?q=zzqxv');
    await page.goBack();
    await page.waitForFunction(() => VL.current().name === 'library');
    assert.equal(await page.inputValue('#lib-q'), 'zzqxv');

    // refresh keeps query + focus
    await page.focus('#lib-q');
    await page.evaluate(() => VL.refresh());
    assert.equal(await page.evaluate(() => document.activeElement.id), 'lib-q');
    assert.ok(await page.$('.lib-none'));

    // clear
    await page.click('.lib-clear');
    await page.waitForSelector('.lib-mine-grid');
    assert.equal(await page.inputValue('#lib-q'), '');
    assert.equal(await page.evaluate(() => location.hash), '#/library');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'lib-q');
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  test(`${dev}: data is live and persists; direct ?q= link; empty library`, async () => {
    const page = await open(browser, dev, '#/library?q=' + encodeURIComponent('kiên cường'), { seed });
    assert.equal(await page.inputValue('#lib-q'), 'kiên cường');
    assert.equal(await page.getAttribute('.lib-word-hit', 'href'), '#/word/mine%3Aresilient');
    // add a deck → shows in Bộ của tôi + badge
    await page.fill('#lib-q', '');
    await page.evaluate(() => { VL.decks.add('phr'); VL.refresh(); });
    assert.ok(await page.$('.lib-mine-card[data-deck="phr"]'));
    assert.equal(await page.textContent('.lib-deck-card[data-deck="phr"] .lib-badge'), '✓ Đã thêm');
    await page.reload();
    await page.waitForFunction(() => VL.current() && VL.current().name === 'library');
    assert.ok(await page.$('.lib-mine-card[data-deck="phr"]'), 'persisted after reload');
    assert.equal(await page.textContent('.lib-count'), '4 bộ');
    // progress live: % changes after practice
    const before = await page.textContent('.lib-mine-card[data-deck="mine"] .lib-pct');
    await page.evaluate(() => { for (let i = 0; i < 10; i++) VL.srs.record('mine:albeit', true, 'mean'); VL.refresh(); });
    const after = await page.textContent('.lib-mine-card[data-deck="mine"] .lib-pct');
    assert.notEqual(before, after);
    assert.deepEqual(page.errors, []);
    await page.context().close();

    // fresh user, no custom words
    const p2 = await open(browser, dev, '#/library');
    assert.equal(await p2.textContent('.lib-mine-card[data-deck="mine"] .lib-mine-meta'), '0 từ tự thêm');
    assert.equal(await p2.textContent('.lib-mine-card[data-deck="mine"] .lib-pct'), '0%');
    assert.ok(await noHScroll(p2));
    assert.deepEqual(p2.errors, []);
    await p2.context().close();
  });
}

test('iphone: search hit with a long unbroken meaning wraps (no horizontal scroll)', async () => {
  const p = await open(browser, 'iphone', '#/library', { seed });
  await p.evaluate(() => VL.words.save({ w: 'donkeyword' + 'k'.repeat(50), vi: 'x'.repeat(300) }));
  await p.fill('#lib-q', 'donkey');
  await p.waitForSelector('.lib-word-hit');
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth), 390);
  assert.deepEqual(p.errors, []);
  await p.context().close();
});
