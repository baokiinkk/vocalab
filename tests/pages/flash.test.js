/* Browser tests for 7 · Flashcard (#/flash). Run: node --test tests/pages/flash.test.js (from project root). */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { launch, open } = require('../pw');
const { seed } = require('../fixtures');

const SHOTS = path.join(__dirname, '..', 'shots', 'flash');
fs.mkdirSync(SHOTS, { recursive: true });
const DEVICES = ['laptop', 'ipad', 'iphone'];
const KEYS = ['mine:meticulous', 'comm:appreciate', 'ielts:analyse'];

let browser;
test.before(async () => { browser = await launch(); });
test.after(async () => { await browser.close(); });

/** Open the app seeded, start a session, wait for #/flash. */
async function startFlash(device, opts) {
  const page = await open(browser, device, '#/today', { seed });
  await page.evaluate((o) => { VL.session.start(o); }, opts || { keys: KEYS, modes: ['flash'], count: 3, order: 'seq' });
  await page.waitForFunction(() => location.hash === '#/flash' && document.querySelector('.flash-card'));
  return page;
}
const txt = (page, sel) => page.$eval(sel, (el) => el.textContent.replace(/\s+/g, ' ').trim());
const stored = (page, key) => page.evaluate((k) => { const s = JSON.parse(localStorage.getItem(VL.store.KEY)); return s.progress[k] ? s.progress[k].s : null; }, key);
const noHScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

for (const device of DEVICES) {
  test(device + ': front renders live data, flip by card / Space, answer buttons on the front', async () => {
    const page = await startFlash(device);
    const it = await page.evaluate(() => { const i = VL.session.item(); return { w: i.word.w, vi: i.word.vi, key: i.key, sc: VL.srs.score(i.key), lv: VL.srs.level(VL.srs.score(i.key)).label }; });
    assert.equal(await page.evaluate(() => document.querySelector('#app').classList.contains('is-focus')), true);
    assert.equal(await page.$('#nav .sidebar, #nav .rail, #nav .tabbar'), null, 'no navigation bar');
    assert.equal(await txt(page, '.flash-word'), it.w);
    assert.equal(await txt(page, '.flash-count'), '1 / 3');
    assert.equal(await txt(page, '.flash-top-row span'), 'Flashcard');
    assert.equal(await txt(page, '.flash-lv'), it.lv + ' · ' + it.sc + '%');
    assert.equal(await txt(page, '.flash-pos'), 'Tính từ');
    assert.equal(await txt(page, '.flash-say'), '/məˈtɪkjələs/');
    assert.equal(await txt(page, '.flash-front .flash-deck'), 'Từ của tôi');
    assert.equal(await txt(page, '.flash-reveal'), 'Lật thẻ xem nghĩa');
    assert.deepEqual(await page.$$eval('.flash-bottom button', (b) => b.map((x) => x.textContent.trim())), ['Chưa nhớ', 'Đã nhớ']);
    assert.ok(await noHScroll(page), 'no horizontal scroll');
    // speak pill does not flip the card
    await page.click('.flash-say');
    assert.ok(await page.$('.flash-front'));
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(SHOTS, 'front-' + device + '.png'), fullPage: true });

    // tap card → back
    await page.click('.flash-front', { position: { x: 60, y: 300 } });
    await page.waitForSelector('.flash-back');
    assert.equal(await txt(page, '.flash-vi'), it.vi);
    // rich back: every field of the word
    assert.equal(await txt(page, '.flash-back-w'), 'meticulous');
    assert.equal(await txt(page, '.flash-pos-pill'), 'Tính từ');
    assert.equal(await txt(page, '.flash-back .flash-lv'), it.lv + ' · ' + it.sc + '%');
    assert.deepEqual(await page.$$eval('.flash-ipa', (t) => t.map((x) => x.textContent.replace(/\s+/g, ' ').trim())), ['UK/məˈtɪkjələs/', 'US/məˈtɪkjələs/']);
    assert.deepEqual(await page.$$eval('.flash-ipa', (b) => b.map((x) => x.getAttribute('data-accent') + ':' + x.getAttribute('data-action'))), ['uk:speak', 'us:speak']);
    // illustration box: real image slot; without an image the generic placeholder stays visible
    assert.ok(await page.$('.flash-illo [data-word-img="' + it.key + '"]'), 'image on the back');
    await page.waitForSelector('.flash-illo .word-img.is-empty');
    const box = await page.$eval('.flash-illo', (b) => { const r = b.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), getComputedStyle(b.querySelector('.word-img')).display]; });
    assert.equal(box[2] !== 'none', true, 'placeholder visible');
    assert.equal(box[1], device === 'iphone' ? 200 : 180);
    if (device !== 'iphone') assert.equal(box[0], 240);
    assert.equal(await txt(page, '.flash-def'), 'showing very careful attention to every detail');
    assert.deepEqual(await page.$$eval('.flash-ex', (t) => t.map((x) => x.textContent.trim())), ['She keeps meticulous records of every expense.', 'The plan was the result of meticulous preparation.']);
    assert.deepEqual(await page.$$eval('.flash-ex-vi', (t) => t.map((x) => x.textContent.trim())), ['Cô ấy ghi chép tỉ mỉ mọi khoản chi tiêu.', 'Kế hoạch là kết quả của sự chuẩn bị kỹ lưỡng.']);
    assert.deepEqual(await page.$$eval('.flash-info .flash-sec-t', (t) => t.map((x) => x.textContent)), ['Ngữ pháp & collocation', 'Đồng nghĩa · Trái nghĩa']);
    assert.deepEqual(await page.$$eval('.flash-chip:not(.is-syn):not(.is-ant)', (t) => t.map((x) => x.textContent)), ['be meticulous about / in + N / V-ing', 'meticulous attention to detail']);
    assert.deepEqual(await page.$$eval('.flash-chip.is-syn', (t) => t.map((x) => x.textContent)), ['thorough', 'painstaking', 'precise']);
    assert.deepEqual(await page.$$eval('.flash-chip.is-ant', (t) => t.map((x) => x.textContent)), ['careless', 'sloppy']);
    const cols = await page.$eval('.flash-info', (g) => getComputedStyle(g).gridTemplateColumns.split(' ').length);
    assert.equal(cols, device === 'iphone' ? 1 : 2);
    assert.equal(await txt(page, '.flash-note b'), 'Ghi chú');
    assert.equal(await txt(page, '.flash-note span'), 'Nhấn âm 2: me-TIC-u-lous.');
    assert.equal(await txt(page, '.flash-unflip'), 'Úp thẻ lại');
    assert.equal(await page.$('.flash-enrich'), null, 'complete word: no AI enrichment');
    assert.deepEqual(await page.$$eval('.flash-bottom button', (b) => b.map((x) => x.textContent.trim())), ['Chưa nhớ', 'Đã nhớ']);
    assert.ok(await noHScroll(page));
    assert.ok(await page.$eval('.flash-main', (m) => m.scrollWidth <= m.clientWidth), 'card area has no overflow');
    await page.screenshot({ path: path.join(SHOTS, 'back-' + device + '.png'), fullPage: true });
    if (device === 'iphone') {
      const pinned = await page.$eval('.flash-bottom', (f) => Math.round(f.getBoundingClientRect().bottom) === window.innerHeight);
      assert.ok(pinned, 'footer pinned at the bottom');
      assert.ok(await page.$eval('.flash-main', (m) => m.scrollHeight > m.clientHeight), 'card area scrolls');
      await page.$eval('.flash-main', (m) => { m.scrollTop = m.scrollHeight; });
      await page.waitForTimeout(100);
      await page.screenshot({ path: path.join(SHOTS, 'back-scrolled-iphone.png') });
    }
    await page.click('.flash-ipa');
    assert.ok(await page.$('.flash-back'), 'speak does not flip');
    // "Úp thẻ lại" → front, Space → back, Space → front, "Lật thẻ xem nghĩa" → back
    await page.click('.flash-unflip');
    await page.waitForSelector('.flash-front');
    await page.keyboard.press('Space');
    await page.waitForSelector('.flash-back');
    await page.keyboard.press('Space');
    await page.waitForSelector('.flash-front');
    await page.click('.flash-reveal');
    await page.waitForSelector('.flash-back');
    // nothing recorded by flipping
    assert.equal(await page.evaluate(() => VL.session.current().results.length), 0);
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  test(device + ': "Đã nhớ" on the FRONT records once, flips to back, persists across reload', async () => {
    const page = await startFlash(device);
    const key = await page.evaluate(() => VL.session.item().key);
    const before = await page.evaluate((k) => VL.srs.score(k), key);
    assert.ok(await page.$('.flash-front'));
    await page.click('[data-action="right"]');
    await page.waitForSelector('.flash-fb.is-ok');
    assert.ok(await page.$('.flash-back'), 'flipped to the details after answering');
    assert.equal(await page.evaluate(() => VL.session.current().results.length), 1);
    const after = Math.min(100, before + 10);
    assert.equal(await txt(page, '.flash-fb-title'), 'Đã nhớ · +' + (after - before) + '%');
    assert.equal(await txt(page, '.flash-fb-text'), before + '% → ' + after + '%');
    assert.equal(await stored(page, key), after);
    assert.equal(await txt(page, '.flash-bottom [data-action="next"]'), 'Thẻ tiếp theo');
    assert.equal(await page.$('[data-action="right"]'), null);
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SHOTS, 'answered-right-' + device + '.png'), fullPage: true });
    // key 2 again must not record twice
    await page.keyboard.press('2');
    await page.reload();
    await page.waitForSelector('.flash-fb.is-ok');
    assert.ok(await page.$('.flash-back'), 'answered state shown after reload');
    assert.equal(await txt(page, '.flash-fb-text'), before + '% → ' + after + '%');
    assert.equal(await page.evaluate(() => VL.session.current().results.length), 1);
    assert.equal(await stored(page, key), after);
    // Enter → next item (front, 2 / 3)
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('.flash-count').textContent.trim() === '2 / 3');
    assert.ok(await page.$('.flash-front'));
    assert.equal(await page.$('.flash-fb'), null);
    assert.equal(await page.evaluate(() => VL.session.current().idx), 1);
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  test(device + ': "Chưa nhớ" via keys (Space, 1) lowers score; last item → Xem kết quả → #/result', async () => {
    const page = await startFlash(device);
    // move to item 2 (comm:appreciate has a positive score)
    await page.evaluate(() => { VL.session.answer(true); VL.session.next(); });
    await page.waitForFunction(() => document.querySelector('.flash-count') && document.querySelector('.flash-count').textContent.trim() === '2 / 3');
    const key = await page.evaluate(() => VL.session.item().key);
    assert.equal(key, 'comm:appreciate');
    const before = await page.evaluate((k) => VL.srs.score(k), key);
    const pen = await page.evaluate(() => VL.store.settings().pen);
    await page.keyboard.press('Space');
    await page.waitForSelector('.flash-back');
    await page.keyboard.press('1');
    await page.waitForSelector('.flash-fb.is-bad');
    const after = Math.max(0, before - pen);
    assert.equal(await stored(page, key), after);
    assert.equal(await txt(page, '.flash-fb-title'), 'Chưa nhớ · −' + (before - after) + '% · thẻ này sẽ quay lại sớm hơn');
    assert.equal(await txt(page, '.flash-fb-text'), before + '% → ' + after + '%');
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SHOTS, 'answered-wrong-' + device + '.png'), fullPage: true });
    await page.click('[data-action="next"]');
    await page.waitForFunction(() => document.querySelector('.flash-count').textContent.trim() === '3 / 3');
    await page.keyboard.press('2'); // key 2 straight from the front
    await page.waitForSelector('.flash-fb.is-ok');
    assert.ok(await page.$('.flash-back'));
    await page.keyboard.press('1'); // already answered: ignored
    assert.equal(await txt(page, '[data-action="next"]'), 'Xem kết quả');
    await page.click('[data-action="next"]');
    await page.waitForFunction(() => location.hash === '#/result');
    const sum = await page.evaluate(() => { const s = VL.session.current(); return { done: s.done, n: s.results.length, ok: s.results.filter((r) => r.ok).length }; });
    assert.deepEqual(sum, { done: true, n: 3, ok: 2 });
    // keyboard listener removed: Enter / 2 on another page does nothing
    await page.keyboard.press('2');
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => location.hash), '#/result');
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  test(device + ': mode switch label "Tiếp: Chọn nghĩa" and redirect to #/quiz', async () => {
    const page = await startFlash(device, { keys: ['mine:meticulous', 'comm:appreciate', 'ielts:analyse', 'comm:suggest'], modes: ['flash', 'mean'], order: 'seq', count: 4 });
    const modes = await page.evaluate(() => VL.session.current().queue.map((q) => q.mode));
    assert.deepEqual(modes, ['flash', 'flash', 'mean', 'mean']);
    await page.click('.flash-reveal');
    await page.click('[data-action="right"]');
    assert.equal(await txt(page, '[data-action="next"]'), 'Thẻ tiếp theo');
    await page.click('[data-action="next"]');
    await page.waitForFunction(() => document.querySelector('.flash-count').textContent.trim() === '2 / 4');
    await page.click('[data-action="wrong"]');
    assert.equal(await txt(page, '[data-action="next"]'), 'Tiếp: Chọn nghĩa');
    await page.click('[data-action="next"]');
    await page.waitForFunction(() => location.hash === '#/quiz');
    // opening #/flash while the current item is a quiz item redirects
    await page.evaluate(() => { location.hash = '#/flash'; });
    await page.waitForFunction(() => location.hash === '#/quiz');
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  test(device + ': quit — cancel stays, confirm → #/practice (nothing answered) or #/result', async () => {
    let page = await startFlash(device);
    await page.click('[data-action="quit"]');
    await page.waitForSelector('.sheet');
    assert.equal(await txt(page, '.sheet-title'), 'Thoát phiên?');
    await page.keyboard.press('1'); // sheet open: page keys ignored
    assert.ok(await page.$('.sheet'));
    await page.click('.sheet [data-r="0"]');
    assert.ok(await page.$('.flash-front'));
    await page.click('[data-action="quit"]');
    await page.click('.sheet [data-r="1"]');
    await page.waitForFunction(() => location.hash === '#/practice');
    assert.equal(await page.evaluate(() => VL.session.current()), null);
    await page.context().close();

    page = await startFlash(device);
    await page.click('[data-action="right"]');
    await page.click('[data-action="quit"]');
    await page.click('.sheet [data-r="1"]');
    await page.waitForFunction(() => location.hash === '#/result');
    assert.equal(await page.evaluate(() => VL.session.current().done), true);
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  test(device + ': empty state without a session', async () => {
    const page = await open(browser, device, '#/flash', { seed });
    await page.waitForSelector('.empty');
    assert.match(await txt(page, '.empty'), /Chưa có phiên luyện/);
    assert.ok(await noHScroll(page));
    await page.screenshot({ path: path.join(SHOTS, 'empty-' + device + '.png'), fullPage: true });
    await page.click('.empty a[href="#/practice"]');
    await page.waitForFunction(() => location.hash === '#/practice');
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  test(device + ': AI fills missing details in the background, once per word per session', async () => {
    const page = await startFlash(device, { keys: ['comm:appreciate', 'ielts:analyse'], modes: ['flash'], count: 2, order: 'seq' });
    let calls = 0;
    let release;
    const gate = new Promise((r) => { release = r; });
    const reply = { pos: 'adj', ipa: '/WRONG/', ipaUs: '/əˈpriːʃieɪt/', vi: 'KHÔNG GHI ĐÈ', def: 'to recognize how good someone or something is', cefr: 'B1',
      examples: [{ en: 'I really appreciate your help.', vi: 'trùng' }, { en: 'We appreciate your patience.', vi: 'Chúng tôi cảm kích sự kiên nhẫn của bạn.' }],
      gram: 'appreciate + N / V-ing\nappreciate it if…', syn: ['value', 'be grateful for'], ant: ['ignore'], note: 'Nhấn âm 2: a-PRE-ci-ate.' };
    await page.route(/api\.groq\.com/, async (route) => {
      calls++;
      await gate;
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: JSON.stringify(reply) } }] }) });
    });
    assert.equal(await page.$('.flash-def'), null);
    await page.click('.flash-reveal');
    await page.waitForSelector('.flash-enrich');
    assert.equal(await txt(page, '.flash-enrich'), 'Đang bổ sung chi tiết…');
    // the user can still answer meanwhile
    await page.keyboard.press('2');
    await page.waitForSelector('.flash-fb.is-ok');
    release();
    await page.waitForSelector('.flash-def');
    assert.equal(await page.$('.flash-enrich'), null);
    assert.equal(await txt(page, '.flash-def'), reply.def);
    assert.equal(await txt(page, '.flash-vi'), 'trân trọng, cảm kích', 'existing meaning kept');
    assert.deepEqual(await page.$$eval('.flash-ipa', (t) => t.map((x) => x.textContent.replace(/\s+/g, ' ').trim())), ['UK/əˈpriːʃieɪt/', 'US/əˈpriːʃieɪt/']);
    assert.deepEqual(await page.$$eval('.flash-ex', (t) => t.map((x) => x.textContent.trim())), ['I really appreciate your help.', 'We appreciate your patience.']);
    assert.equal(await page.$$eval('.flash-chip:not(.is-syn):not(.is-ant)', (t) => t.length), 2);
    assert.equal(await page.$$eval('.flash-chip', (t) => t.length), 5);
    assert.equal(await txt(page, '.flash-note span'), reply.note);
    assert.ok(await page.$('.flash-fb.is-ok'), 'feedback kept after update');
    assert.equal(await txt(page, '[data-action="next"]'), 'Thẻ tiếp theo');
    const ov = await page.evaluate(() => JSON.parse(localStorage.getItem(VL.store.KEY)).overrides['comm:appreciate']);
    assert.equal(ov.def, reply.def);
    assert.equal(ov.vi, undefined);
    assert.equal(ov.ipa, undefined);
    assert.equal(ov.examples.length, 2);
    assert.equal(await page.evaluate(() => VL.session.current().results.length), 1);
    assert.ok(await noHScroll(page));
    assert.ok(await page.$eval('.flash-main', (m) => m.scrollWidth <= m.clientWidth));
    await page.screenshot({ path: path.join(SHOTS, 'enriched-' + device + '.png'), fullPage: true });
    // flipping again does not call AI again
    await page.keyboard.press('Space');
    await page.keyboard.press('Space');
    await page.waitForSelector('.flash-back');
    assert.equal(calls, 1);
    // next word: AI failure → silent (no toast), loading line disappears, not retried
    await page.unroute(/api\.groq\.com/);
    await page.route(/api\.groq\.com/, (route) => { calls++; route.fulfill({ status: 500, body: 'x' }); });
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('.flash-count').textContent.trim() === '2 / 2');
    await page.click('.flash-reveal');
    await page.waitForFunction(() => document.querySelector('.flash-back') && !document.querySelector('.flash-enrich'));
    assert.equal(calls, 2);
    assert.equal(await page.evaluate(() => { const t = document.getElementById('toast'); return !!(t && t.classList.contains('is-show')); }), false);
    await page.keyboard.press('Space');
    await page.keyboard.press('Space');
    await page.waitForTimeout(200);
    assert.equal(calls, 2, 'failed word not retried in the same session');
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  test(device + ': dark theme — front, back, answered', async () => {
    const page = await startFlash(device);
    await page.evaluate(() => VL.store.setSetting('theme', 'dark'));
    await page.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'dark');
    const bg = await page.$eval('.flash-front', (c) => getComputedStyle(c).backgroundColor);
    assert.equal(bg, 'rgb(28, 28, 34)');
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(SHOTS, 'dark-front-' + device + '.png'), fullPage: true });
    await page.click('.flash-reveal');
    await page.waitForSelector('.flash-back');
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(SHOTS, 'dark-back-' + device + '.png'), fullPage: true });
    await page.keyboard.press('1');
    await page.waitForSelector('.flash-fb.is-bad');
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SHOTS, 'dark-answered-' + device + '.png'), fullPage: true });
    assert.ok(await noHScroll(page));
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });
}
