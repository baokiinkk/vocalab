/* Browser tests for the "Hôm nay" page (design v3). Run: node --test tests/pages/today.test.js (from the project root). */
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
const txt = async (p, sel) => (await p.textContent(sel)).replace(/\s+/g, ' ').trim();
const shoot = async (p, name) => {
  for (const theme of ['light', 'dark']) {
    await p.evaluate((t) => { VL.store.setSetting('theme', t); VL.applyTheme(); }, theme);
    await p.waitForTimeout(100);
    await p.screenshot({ path: path.join(SHOTS, `${name}${theme === 'dark' ? '-dark' : ''}.png`), fullPage: true });
  }
};
const seedLight = new Function('VL', `(${seed.toString()})(VL); VL.store.setSetting('theme', 'light'); VL.applyTheme();`);

for (const device of DEVICES) {
  test(`${device}: seeded dashboard renders live data`, async () => {
    const p = await open(browser, device, '#/today', { seed: seedLight });
    await p.waitForTimeout(200);
    assert.equal(await txt(p, '.page-today h1'), 'Chào bạn, học tiếp nhé.');
    assert.equal(await txt(p, '.today-streak'), 'Chuỗi 12 ngày');

    const d = await p.evaluate(() => {
      const x = VL.srs.todayPlan(), ov = VL.srs.overview();
      return { weak: x.weak.length, due: x.due.length, fresh: x.fresh.length, avg: ov.avg, master: ov.buckets.master, words: ov.words,
        lib: VL.words.library().length, builtIn: VL.decks.builtInIds().length };
    });
    // Kế hoạch
    const steps = await p.$$eval('.today-step', (els) => els.map((e) => ({ id: e.dataset.step, cls: e.className, text: e.querySelector('.today-step-text').textContent.trim(), meta: e.querySelector('.today-step-meta').textContent.trim(), href: e.getAttribute('href') })));
    assert.equal(steps.length, 3);
    assert.deepEqual(steps.map((s) => s.id), ['weak', 'due', 'new']);
    assert.equal(steps[0].text, 'Ôn ' + Math.min(15, d.weak) + ' từ yếu');
    assert.equal(steps[1].text, d.due + ' từ đến hạn');
    assert.equal(steps[2].text, d.fresh + ' từ mới');
    assert.match(steps[0].cls, /is-next/); assert.equal(steps[0].meta, 'Tiếp');
    assert.match(steps[2].cls, /is-todo/); assert.match(steps[2].meta, /^~\d+′$/);
    assert.equal(await txt(p, '.today-plan-count'), '0/3');
    assert.equal(await txt(p, '.today-sub'), 'Còn 3 việc nhỏ cho hôm nay.');
    // mastery tile
    assert.equal(await txt(p, '.today-ring-in'), d.avg + '%');
    assert.equal(await txt(p, '.today-prog-n'), `${d.master}/${d.words} từ`);
    assert.equal(await txt(p, '.today-prog-due'), d.due + ' từ cần ôn');
    assert.equal(await p.getAttribute('.today-prog', 'aria-label'), `Tiến độ thông thạo ${d.avg}%, xem thư viện`);
    // tiles
    const badges = await p.$$eval('.today-badge', (els) => els.map((e) => e.textContent.trim()));
    assert.deepEqual(badges, [d.due + ' TỪ ĐẾN HẠN', d.lib + ' TỪ', 'TỰ NHẬP', Math.min(10, d.lib) + ' THẺ', Math.min(8, d.lib) + ' CÂU', d.builtIn + ' BỘ']);
    const titles = await p.$$eval('.today-tile-title', (els) => els.map((e) => e.textContent.trim()));
    assert.deepEqual(titles, ['Ôn tập', 'Từ vựng', 'Thêm từ', 'Flashcard', 'Chọn nghĩa', 'Bộ có sẵn']);

    // layout per device
    const cols = await p.$eval('.today-tiles', (g) => getComputedStyle(g).gridTemplateColumns.split(' ').length);
    assert.equal(cols, { laptop: 6, ipad: 3, iphone: 2 }[device]);
    const duo = await p.$eval('.today-duo', (g) => getComputedStyle(g).gridTemplateColumns.split(' ')[1]);
    assert.equal(duo, { laptop: '230px', ipad: '200px', iphone: '118px' }[device]);
    const h1 = await p.$eval('.today-h1', (e) => getComputedStyle(e).fontSize);
    assert.equal(h1, { laptop: '26px', ipad: '24px', iphone: '20px' }[device]);
    // v3 palette (light): paper background, terracotta ring
    assert.equal(await p.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(251, 247, 240)');

    assert.ok(await noHScroll(p), 'no horizontal scroll');
    await shoot(p, `today-${device}`);
    assert.ok(await noHScroll(p), 'no horizontal scroll (dark)');
    assert.deepEqual(p.errors, []);
    await p.context().close();
  });

  test(`${device}: links and tiles navigate / start sessions`, async () => {
    const p = await open(browser, device, '#/today', { seed });
    const back = async () => { await p.evaluate(() => { VL.session.quit(); VL.go('#/today'); }); await p.waitForSelector('.today-tile'); };
    const clickTo = async (sel, re) => { await p.click(sel); await p.waitForFunction((r) => new RegExp(r).test(location.hash), re.source); };

    await clickTo('.today-step[data-step="weak"]', /^#\/practice\?preset=weak$/); await back();
    await clickTo('.today-step[data-step="new"]', /^#\/practice\?preset=new$/); await back();
    await clickTo('.today-prog', /^#\/library$/); await back();
    await clickTo('[data-tile="lilac"]', /^#\/library$/); await back();
    await clickTo('[data-tile="butter"]', /^#\/add$/); await back();
    await clickTo('[data-tile="sky"]', /^#\/library$/); await back();

    // due step / Ôn tập → 'today' session
    await clickTo('.today-step[data-step="due"]', /^#\/(flash|quiz)$/);
    assert.equal(await p.evaluate(() => VL.session.current().preset), 'today');
    await back();
    await clickTo('[data-tile="peach"]', /^#\/(flash|quiz)$/);
    assert.equal(await p.evaluate(() => VL.session.current().preset), 'today');
    await back();
    // Flashcard → 10 flash cards
    await clickTo('[data-tile="mint"]', /^#\/flash$/);
    assert.deepEqual(await p.evaluate(() => { const s = VL.session.current(); return [s.queue.length, s.modes]; }), [10, ['flash']]);
    await back();
    // Chọn nghĩa → 8 'mean' questions
    await clickTo('[data-tile="pink"]', /^#\/quiz$/);
    assert.deepEqual(await p.evaluate(() => { const s = VL.session.current(); return [s.queue.length, s.modes, s.title]; }), [8, ['mean'], 'Chọn nghĩa']);
    assert.deepEqual(p.errors, []);
    await p.context().close();
  });

  test(`${device}: data is live and persists`, async () => {
    const p = await open(browser, device, '#/today', { seed });
    const due0 = await txt(p, '.today-prog-due');
    // answer every due word → due step done
    await p.evaluate(() => { VL.srs.todayPlan().due.forEach((k) => VL.srs.record(k, true, 'flash')); VL.store.save(); VL.refresh(); });
    assert.notEqual(await txt(p, '.today-prog-due'), due0);
    assert.equal(await txt(p, '.today-prog-due'), '0 từ cần ôn');
    assert.match(await p.getAttribute('.today-step[data-step="due"]', 'class'), /is-done/);
    assert.equal(await txt(p, '.today-step[data-step="due"] .today-step-meta'), 'Xong');
    assert.equal(await txt(p, '.today-plan-count'), '1/3');
    assert.equal(await txt(p, '.today-sub'), 'Còn 2 việc nhỏ cho hôm nay.');
    // a weak session finished today → weak step done, new step becomes "next"
    await p.evaluate(() => { VL.store.state.sessions.unshift({ summary: true, preset: 'weak', results: [], wrongKeys: [], endedAt: Date.now() }); VL.store.save(); VL.refresh(); });
    assert.match(await p.getAttribute('.today-step[data-step="weak"]', 'class'), /is-done/);
    assert.match(await p.getAttribute('.today-step[data-step="new"]', 'class'), /is-next/);
    assert.equal(await txt(p, '.today-plan-count'), '2/3');
    // streak switch hides the streak
    await p.evaluate(() => { VL.store.setSetting('sw.streak', false); VL.refresh(); });
    assert.equal(await p.$('.today-streak'), null);
    await p.reload();
    await p.waitForFunction(() => window.VL && VL.current());
    assert.equal(await p.$('.today-streak'), null, 'setting persisted');
    assert.equal(await txt(p, '.today-plan-count'), '2/3', 'progress persisted');
    assert.equal(await txt(p, '.today-prog-due'), '0 từ cần ôn');
    assert.deepEqual(p.errors, []);
    await p.context().close();
  });

  test(`${device}: empty storage`, async () => {
    const p = await open(browser, device, '#/today', { seed: (VL) => { VL.store.setSetting('theme', 'light'); VL.applyTheme(); } });
    await p.waitForTimeout(200);
    assert.equal(await txt(p, '.today-streak'), 'Chuỗi 0 ngày');
    assert.equal(await txt(p, '.today-ring-in'), '0%');
    assert.equal(await txt(p, '.today-step[data-step="weak"] .today-step-text'), 'Không còn từ yếu (đã xong)');
    assert.match(await p.getAttribute('.today-step[data-step="weak"]', 'class'), /is-done/);
    assert.ok(await noHScroll(p));
    await shoot(p, `today-empty-${device}`);

    // Nothing at all to practise: remove every deck
    await p.evaluate(() => { VL.decks.mineIds().forEach((id) => VL.decks.remove(id)); VL.refresh(); });
    assert.equal(await txt(p, '.today-sub'), 'Thêm từ hoặc chọn bộ từ để bắt đầu.');
    assert.equal(await txt(p, '.today-step[data-step="new"] .today-step-text'), 'Chọn bộ để học');
    assert.equal(await p.getAttribute('.today-step[data-step="new"]', 'href'), '#/library');
    assert.equal(await txt(p, '.today-prog-n'), '0/0 từ');
    // starting a session with nothing to practise → toast, stays here
    for (const t of ['peach', 'mint', 'pink']) {
      await p.click(`[data-tile="${t}"]`);
      await p.waitForSelector('.toast.is-show');
      assert.equal(await hash(p), '#/today');
    }
    await shoot(p, `today-nothing-${device}`);
    assert.deepEqual(p.errors, []);
    await p.context().close();
  });
}
