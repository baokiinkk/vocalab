/* Browser tests for #/practice (Luyện tập, design-v2). Run: node --test tests/pages/practice.test.js */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { launch, open } = require('../pw');
const { seed } = require('../fixtures');

const SHOTS = path.join(__dirname, '..', 'shots', 'practice');
fs.mkdirSync(SHOTS, { recursive: true });

let browser;
test.before(async () => { browser = await launch(); });
test.after(async () => { await browser.close(); });

const txt = (page, sel) => page.locator(sel).first().innerText();
const vals = (page, sel) => page.locator(sel).evaluateAll((els) => els.map((e) => e.dataset.value));
const tab = (page, id) => page.click('.pr-tab[data-value="' + id + '"]');

for (const device of ['laptop', 'ipad', 'iphone']) {
  test(device + ': every tab renders live data; screenshots', async () => {
    const page = await open(browser, device, '#/practice', { seed });
    assert.equal(await page.locator('h1').innerText(), 'Luyện tập');
    assert.equal(await page.getAttribute('.pr-settings-link', 'href'), '#/settings?scope=practice');
    assert.deepEqual(await page.locator('.pr-tab').allInnerTexts(), ['Ôn hôm nay', 'Nhanh', 'Từ yếu', 'Từ mới']);
    const nDecks = await page.evaluate(() => window.VL.decks.mineIds().length);

    // --- today
    assert.equal(await page.getAttribute('.pr-tab[data-value="today"]', 'aria-selected'), 'true');
    assert.equal(await txt(page, '.pr-name'), 'Ôn từ đến hạn');
    assert.equal(await txt(page, '.pr-count-n'), '24');
    assert.deepEqual(await page.locator('.pr-chip').allInnerTexts(), ['~11 phút', '3 kiểu · xáo trộn', nDecks + ' bộ']);
    assert.equal(await page.locator('[data-action="deck"]').count(), nDecks);
    assert.equal(await page.locator('[data-action="deck"][aria-checked="true"]').count(), nDecks);
    const due = await page.evaluate(() => window.VL.decks.mineIds().reduce((a, id) => a + window.VL.decks.stats(id).due, 0));
    assert.equal(await txt(page, '#h-deck + .pr-note'), due + ' từ đến hạn');
    assert.equal(await txt(page, '#h-deck'), 'BỘ TỪ');
    assert.deepEqual(await vals(page, '[data-action="mode"][aria-pressed="true"]'), ['flash', 'mean', 'fill']);
    assert.equal(await page.locator('.pr-quick').count(), 0);
    assert.equal(await page.locator('#h-weak').count(), 0);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 0, 'horizontal overflow ' + overflow);
    await page.screenshot({ path: path.join(SHOTS, device + '-today.png'), fullPage: true });

    // --- quick
    await tab(page, 'quick');
    assert.equal(await txt(page, '.pr-name'), 'Ôn nhanh 5 phút');
    assert.equal(await txt(page, '.pr-count-n'), '10');
    assert.deepEqual(await page.locator('.pr-chip').allInnerTexts(), ['~3 phút', '1 kiểu', nDecks + ' bộ']);
    assert.equal(await txt(page, '.pr-quick strong'), 'Chỉ Flashcard');
    assert.equal(await txt(page, '.pr-quick-text span'), '10 từ đến hạn sớm nhất · lật thẻ, tự chấm Đã nhớ / Chưa nhớ');
    assert.equal(await page.locator('#h-mode').count(), 0);
    await page.screenshot({ path: path.join(SHOTS, device + '-quick.png'), fullPage: true });

    // --- weak: preview list == chosen keys
    await tab(page, 'weak');
    assert.equal(await txt(page, '.pr-name'), 'Tập trung từ dưới 30%');
    assert.equal(await txt(page, '#h-weak'), 'TỪ SẼ LUYỆN');
    const n = Number(await txt(page, '.pr-count-n'));
    assert.ok(n > 0 && n <= 15);
    const rows = await page.locator('.pr-wrow').count();
    assert.equal(rows, Math.min(5, n));
    if (n > 5) assert.equal(await txt(page, '.pr-more'), '+ ' + (n - 5) + ' từ khác');
    assert.match(await txt(page, '#h-weak + .pr-note'), /^\d+ từ dưới 30%$/);
    assert.match(await txt(page, '.pr-wrow .pr-ring'), /^\d+%$/);
    assert.match(await page.getAttribute('.pr-wrow', 'href'), /^#\/word\//);
    assert.deepEqual(await vals(page, '[data-action="mode"][aria-pressed="true"]'), ['mean', 'word']);
    await page.screenshot({ path: path.join(SHOTS, device + '-weak.png'), fullPage: true });

    // --- new: built-in decks only, "từ chưa mở"
    await tab(page, 'new');
    assert.equal(await txt(page, '.pr-name'), 'Học từ mới hôm nay');
    assert.equal(await txt(page, '#h-deck'), 'MỞ TỪ MỚI TỪ BỘ');
    assert.equal(await page.locator('[data-action="deck"][data-value="mine"]').count(), 0);
    assert.equal(await page.locator('[data-action="deck"]').count(), nDecks - 1);
    assert.match(await txt(page, '[data-action="deck"] .pr-deck-desc'), /^\d+ từ chưa mở$/);
    assert.equal(await txt(page, '#h-deck + .pr-note'), '10 từ mới / ngày · theo Cài đặt');
    assert.equal(await txt(page, '.pr-count-n'), '10');
    await page.screenshot({ path: path.join(SHOTS, device + '-new.png'), fullPage: true });

    if (device === 'iphone') {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      const r = await page.evaluate(() => ({ last: document.querySelector('.pr-mode:last-child').getBoundingClientRect().bottom, tab: document.querySelector('.tabbar').getBoundingClientRect().top }));
      assert.ok(r.last <= r.tab, 'content hidden by tab bar: ' + JSON.stringify(r));
    }
    // hero is sticky: still on screen after scrolling
    const sticky = await page.evaluate(() => { const cs = getComputedStyle(document.querySelector('.pr-hero')); return cs.position + ' ' + cs.top; });
    assert.equal(sticky, 'sticky ' + (device === 'iphone' ? '8px' : '16px'));
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  test(device + ': interactions; preview words are exactly the session words', async () => {
    const page = await open(browser, device, '#/practice?preset=weak', { seed });
    assert.equal(await page.getAttribute('.pr-tab[data-value="weak"]', 'aria-selected'), 'true');
    const preview = await page.locator('.pr-wrow').evaluateAll((els) => els.map((e) => decodeURIComponent(e.getAttribute('href').replace('#/word/', ''))));
    // order seg
    await page.click('[data-action="order"][data-value="seq"]');
    assert.equal(await page.getAttribute('[data-action="order"][data-value="seq"]', 'aria-checked'), 'true');
    assert.equal(await page.locator('.pr-chip').nth(1).innerText(), '2 kiểu · lần lượt');
    // preview stable across refreshes
    const again = await page.locator('.pr-wrow').evaluateAll((els) => els.map((e) => decodeURIComponent(e.getAttribute('href').replace('#/word/', ''))));
    assert.deepEqual(again, preview);
    // toggle a mode
    await page.click('[data-action="mode"][data-value="type"]');
    assert.equal(await page.getAttribute('[data-action="mode"][data-value="type"]', 'aria-pressed'), 'true');
    assert.equal(await page.locator('.pr-chip').nth(1).innerText(), '3 kiểu · lần lượt');
    const count = Number(await txt(page, '.pr-count-n'));
    await page.click('.pr-start');
    await page.waitForFunction(() => location.hash === '#/quiz' || location.hash === '#/flash');
    const s = await page.evaluate(() => { const s = window.VL.session.current(); return { keys: s.queue.map((q) => q.key), modes: s.modes, order: s.order, preset: s.preset }; });
    assert.equal(s.keys.length, count);
    assert.equal(new Set(s.keys).size, s.keys.length);
    preview.forEach((k) => assert.ok(s.keys.indexOf(k) >= 0, 'preview word not in session: ' + k));
    assert.deepEqual(s.modes, ['mean', 'word', 'type']);
    assert.equal(s.order, 'seq');
    assert.equal(s.preset, 'weak');
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  test(device + ': deselecting decks / modes shows hint; tab resets modes', async () => {
    const page = await open(browser, device, '#/practice', { seed });
    const ids = await page.evaluate(() => window.VL.decks.mineIds());
    await page.click('[data-action="deck"][data-value="' + ids[0] + '"]');
    assert.equal(await page.getAttribute('[data-action="deck"][data-value="' + ids[0] + '"]', 'aria-checked'), 'false');
    assert.equal(await page.locator('.pr-chip').nth(2).innerText(), (ids.length - 1) + ' bộ');
    for (const id of ids.slice(1)) await page.click('[data-action="deck"][data-value="' + id + '"]');
    assert.equal(await page.locator('.pr-start').count(), 0);
    assert.equal(await txt(page, '.pr-start-off'), 'Chọn ít nhất 1 bộ và 1 kiểu');
    assert.equal(await txt(page, '.pr-count-n'), '0');
    await page.click('[data-action="deck"][data-value="' + ids[0] + '"]');
    assert.equal(await page.locator('.pr-start').count(), 1);
    for (const m of ['flash', 'mean', 'fill']) await page.click('[data-action="mode"][data-value="' + m + '"]');
    assert.equal(await page.locator('.pr-start').count(), 0);
    assert.equal(await page.locator('.pr-chip').nth(1).innerText(), '0 kiểu');
    await tab(page, 'new');
    assert.deepEqual(await vals(page, '[data-action="mode"][aria-pressed="true"]'), ['flash', 'mean']);
    await tab(page, 'today');
    assert.deepEqual(await vals(page, '[data-action="mode"][aria-pressed="true"]'), ['flash', 'mean', 'fill']);
    // keyboard: arrow right moves to next tab
    await page.focus('.pr-tab[data-value="today"]');
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.getAttribute('.pr-tab[data-value="quick"]', 'aria-selected'), 'true');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.value), 'quick');
    // quick → starts flash only, with the count shown
    const quickCount = Number(await txt(page, '.pr-count-n'));
    assert.ok(quickCount > 0 && quickCount <= 10);
    await page.click('.pr-start');
    await page.waitForFunction(() => location.hash === '#/flash');
    const s = await page.evaluate(() => window.VL.session.current());
    assert.deepEqual(s.modes, ['flash']);
    assert.equal(s.queue.length, quickCount);
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });
}

test('?deck= preselects only that deck; state resets on re-enter; settings link', async () => {
  const page = await open(browser, 'ipad', '#/practice?deck=ielts', { seed });
  assert.deepEqual(await vals(page, '[data-action="deck"][aria-checked="true"]'), ['ielts']);
  await page.click('[data-action="mode"][data-value="type"]');
  await page.evaluate(() => { location.hash = '#/today'; });
  await page.waitForFunction(() => window.VL.current().name === 'today');
  await page.evaluate(() => { location.hash = '#/practice'; });
  await page.waitForFunction(() => document.querySelector('.pr-tab'));
  assert.equal(await page.getAttribute('[data-action="mode"][data-value="type"]', 'aria-pressed'), 'false');
  const n = await page.evaluate(() => window.VL.decks.mineIds().length);
  assert.equal(await page.locator('[data-action="deck"][aria-checked="true"]').count(), n);
  await page.evaluate(() => { location.hash = '#/practice?deck=toeic'; });
  await page.waitForFunction(() => document.querySelector('[data-action="deck"][data-value="toeic"]'));
  assert.equal(await page.getAttribute('[data-action="deck"][data-value="toeic"]', 'aria-checked'), 'true');
  await page.click('.pr-settings-link');
  await page.waitForFunction(() => location.hash === '#/settings?scope=practice');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('settings drive "Ôn hôm nay" (order, count, modes) after reload', async () => {
  const page = await open(browser, 'laptop', '#/practice', { seed: function (VL) {
    VL.store.setSetting('order', 'seq'); VL.store.setSetting('count', 15); VL.store.setSetting('modes', { mean: true, word: true });
  } });
  await page.reload();
  await page.waitForFunction(() => document.querySelector('.pr-tab'));
  assert.equal(await txt(page, '.pr-count-n'), '15');
  assert.equal(await page.locator('.pr-chip').nth(1).innerText(), '2 kiểu · lần lượt');
  assert.equal(await page.getAttribute('[data-action="order"][data-value="seq"]', 'aria-checked'), 'true');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('empty state: no words → 0 TỪ, library hint, toast on start', async () => {
  const page = await open(browser, 'iphone', '#/practice', { seed: function (VL) {
    Object.keys(VL.store.state.decks).forEach((id) => VL.decks.remove(id));
    VL.words.library().forEach((k) => VL.words.remove(k));
  } });
  assert.equal(await page.locator('[data-action="deck"]').count(), 1);
  assert.equal(await txt(page, '.pr-count-n'), '0');
  assert.equal(await page.getAttribute('.pr-empty-note a', 'href'), '#/library');
  await page.click('.pr-start');
  await page.waitForSelector('#toast.is-show');
  assert.match(await page.locator('#toast').innerText(), /^Chưa có từ để luyện/);
  assert.equal(await page.evaluate(() => location.hash), '#/practice');
  await tab(page, 'new');
  assert.equal(await page.getAttribute('.pr-list-empty a', 'href'), '#/library');
  await tab(page, 'weak');
  assert.match(await txt(page, '.pr-list-empty'), /^Chưa có từ yếu/);
  await page.screenshot({ path: path.join(SHOTS, 'iphone-empty.png'), fullPage: true });
  assert.deepEqual(page.errors, []);
  await page.context().close();
});
