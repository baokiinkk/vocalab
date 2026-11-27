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
    // header + stat tiles (live)
    assert.equal(await page.textContent('.lib-head-sub'), 'Từ bạn tự thêm và các bộ có sẵn, gom về một chỗ.');
    const st = await page.evaluate(() => ({ saved: VL.words.library().length, master: VL.srs.overview(VL.words.library()).buckets.master, due: VL.srs.todayPlan().due.length }));
    assert.equal(await page.textContent('[data-stat="saved"] .lib-stat-n'), String(st.saved));
    assert.equal(await page.textContent('[data-stat="master"] .lib-stat-n'), String(st.master));
    assert.equal(await page.textContent('[data-stat="due"] .lib-stat-n'), String(st.due));
    assert.equal(await page.getAttribute('[data-stat="due"]', 'href'), '#/practice');
    assert.equal(await page.getAttribute('[data-stat="master"]', 'href'), '#/practice');
    // Bộ của tôi: hero (Từ của tôi) + added decks
    const live = await page.evaluate(() => VL.decks.mineIds().map((id) => ({ id, n: VL.decks.get(id).n, level: VL.decks.get(id).level, pct: VL.decks.stats(id).pct, st: VL.decks.stats(id) })));
    assert.equal(await page.textContent('.lib-count'), live.length + ' bộ');
    const m = live[0].st;
    assert.equal(live[0].n, 6);
    assert.equal(await page.textContent('.lib-hero-name'), 'Từ của tôi');
    assert.equal(await page.textContent('.lib-hero-meta'), '6 từ tự thêm · ' + m.buckets.weak + ' từ yếu');
    assert.equal(await page.textContent('.lib-hero .lib-ring-in'), m.startedPct + '%');
    assert.deepEqual(await page.$$eval('.lib-hero-stat b', (els) => els.map((e) => e.textContent)), [String(m.buckets.master), String(m.buckets.learning + m.buckets.good), String(m.buckets.weak)]);
    assert.equal(await page.getAttribute('.lib-hero-go', 'href'), '#/practice?deck=mine');
    assert.equal(await page.textContent('.lib-hero-see'), 'Xem 6 từ');
    const cards = await page.$$eval('.lib-added-card', (els) => els.map((e) => ({ href: e.getAttribute('href'), name: e.querySelector('.lib-added-name').textContent, meta: e.querySelector('.lib-added-meta').textContent, pct: e.querySelector('.lib-ring-in').textContent })));
    assert.equal(cards.length, live.length - 1);
    cards.forEach((c, i) => {
      const d = live[i + 1];
      assert.equal(c.href, '#/deck/' + d.id);
      assert.equal(c.pct, d.pct + '%');
      assert.equal(c.meta, d.n + ' từ · ' + d.level);
    });
    const cols = await page.$eval('.lib-mine-grid', (e) => getComputedStyle(e).gridTemplateColumns.split(' ').length);
    assert.equal(cols, dev === 'iphone' ? 1 : 2);
    // categories
    const cats = await page.$$eval('.lib-cat-head .lib-h2', (els) => els.map((e) => e.textContent));
    assert.deepEqual(cats, ['Giao tiếp', 'Hằng ngày', 'Chuyên ngành', 'Luyện thi']);
    assert.equal(await page.$$eval('.lib-deck-card', (e) => e.length), 12);
    assert.equal(await page.textContent('.lib-deck-card[data-deck="comm"] .lib-badge'), '✓ Đã thêm');
    assert.equal(await page.textContent('.lib-deck-card[data-deck="phr"] .lib-badge'), '+ Có sẵn');
    const phr = await page.evaluate(() => VL.decks.get('phr'));
    assert.equal(await page.textContent('.lib-deck-card[data-deck="phr"] .lib-deck-n'), phr.n + ' từ');
    assert.equal(await page.textContent('.lib-deck-card[data-deck="phr"] .lib-deck-level'), phr.level);
    assert.ok(await page.$('.lib-deck-card[data-deck="phr"] .lib-tile svg'), 'deck glyph svg');
    assert.equal(await page.$eval('.lib-row', (e) => getComputedStyle(e).gridTemplateColumns.split(' ').length), dev === 'iphone' ? 2 : 3);
    if (dev === 'iphone') {
      const w = await page.$$eval('[aria-labelledby="c-talk"] .lib-deck-card', (els) => els.map((e) => Math.round(e.getBoundingClientRect().width)));
      assert.ok(w[2] > w[0] * 1.8, 'third card spans the row on iPhone');
    }
    assert.ok(await noHScroll(page), 'no horizontal page scroll');
    await page.screenshot({ path: path.join(SHOTS, `browse-${dev}.png`), fullPage: true });
    // navigation
    await page.click('.lib-deck-card[data-deck="phr"]');
    await page.waitForFunction(() => location.hash === '#/deck/phr');
    await page.goBack();
    await page.waitForFunction(() => VL.current().name === 'library');
    await page.click('.lib-hero-see');
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
    assert.ok(await page.$('.lib-added-card[data-deck="phr"]'));
    assert.equal(await page.textContent('.lib-deck-card[data-deck="phr"] .lib-badge'), '✓ Đã thêm');
    await page.reload();
    await page.waitForFunction(() => VL.current() && VL.current().name === 'library');
    assert.ok(await page.$('.lib-added-card[data-deck="phr"]'), 'persisted after reload');
    assert.equal(await page.textContent('.lib-count'), '4 bộ');
    // progress live: % changes after practice
    const before = await page.textContent('.lib-hero .lib-ring-in');
    await page.evaluate(() => { for (let i = 0; i < 10; i++) VL.srs.record('mine:albeit', true, 'mean'); VL.refresh(); });
    const after = await page.textContent('.lib-hero .lib-ring-in');
    assert.notEqual(before, after);
    assert.deepEqual(page.errors, []);
    await page.context().close();

    // fresh user, no custom words
    const p2 = await open(browser, dev, '#/library');
    assert.equal(await p2.textContent('.lib-hero-meta'), '0 từ tự thêm · 0 từ yếu');
    assert.equal(await p2.textContent('.lib-hero-see'), 'Xem 0 từ');
    const fresh = await p2.evaluate(() => ({ added: VL.decks.mineIds().length - 1, saved: VL.words.library().length }));
    assert.equal(await p2.$$eval('.lib-added-card', (e) => e.length), fresh.added);
    assert.equal(await p2.textContent('[data-stat="saved"] .lib-stat-n'), String(fresh.saved));
    assert.equal(await p2.textContent('.lib-hero .lib-ring-in'), '0%');
    assert.ok(await noHScroll(p2));
    assert.deepEqual(p2.errors, []);
    await p2.context().close();
  });
}

for (const dev of DEVS) {
  test(`${dev}: "từ đã lưu" and "Thêm bộ có sẵn" jump to categories (also from search)`, async () => {
    const page = await open(browser, dev, '#/library', { seed });
    await page.click('.lib-add-more');
    await page.waitForFunction(() => document.activeElement && document.activeElement.id === 'lib-cats');
    await page.waitForTimeout(600);
    const sc = await page.evaluate(() => { const el = document.scrollingElement; const want = Math.min(document.getElementById('lib-cats').getBoundingClientRect().top + el.scrollTop - 16, el.scrollHeight - innerHeight); return { y: el.scrollTop, want }; });
    assert.ok(sc.y > 100 && Math.abs(sc.y - sc.want) < 40, 'categories scrolled into view ' + JSON.stringify(sc));
    assert.equal(await page.evaluate(() => location.hash), '#/library');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.fill('#lib-q', 'ielts');
    await page.waitForSelector('.lib-deck-hit');
    await page.click('[data-stat="saved"]');
    await page.waitForSelector('#lib-cats');
    assert.equal(await page.inputValue('#lib-q'), '');
    assert.equal(await page.evaluate(() => location.hash), '#/library');
    // stat links
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.click('[data-stat="due"]');
    await page.waitForFunction(() => location.hash === '#/practice');
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });
}

test('dark theme: library renders without errors (laptop + iphone)', async () => {
  for (const dev of ['laptop', 'iphone']) {
    const p = await open(browser, dev, '#/library', { seed: `(VL)=>{(${seed.toString()})(VL); VL.store.setSetting('theme','dark');}` });
    await p.waitForTimeout(200);
    assert.equal(await p.evaluate(() => document.documentElement.getAttribute('data-theme')), 'dark');
    assert.ok(await noHScroll(p));
    await p.screenshot({ path: path.join(SHOTS, `browse-dark-${dev}.png`), fullPage: true });
    assert.deepEqual(p.errors, []);
    await p.context().close();
  }
});

test('iphone: search hit with a long unbroken meaning wraps (no horizontal scroll)', async () => {
  const p = await open(browser, 'iphone', '#/library', { seed });
  await p.evaluate(() => VL.words.save({ w: 'donkeyword' + 'k'.repeat(50), vi: 'x'.repeat(300) }));
  await p.fill('#lib-q', 'donkey');
  await p.waitForSelector('.lib-word-hit');
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth), 390);
  assert.deepEqual(p.errors, []);
  await p.context().close();
});
