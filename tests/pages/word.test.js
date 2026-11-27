/* Browser tests for page "word" (4 · Chi tiết từ). Run: node --test tests/pages/word.test.js */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { launch, open } = require('../pw');
const { seed } = require('../fixtures');

const SHOTS = path.join(__dirname, '..', 'shots', 'word');
const DEVICES = ['laptop', 'ipad', 'iphone'];
const MET = 'mine:meticulous';
const hashOf = (k) => '#/word/' + encodeURIComponent(k);
// 8x6 PNG (blue) for the upload test
const PNG = require('zlib') && (() => {
  const zlib = require('zlib');
  const crc = (buf) => { let c, n, t = []; for (n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } c = 0xffffffff; for (const b of buf) c = t[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const W = 8, H = 6, ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((W * 3 + 1) * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const o = y * (W * 3 + 1) + 1 + x * 3; raw[o] = 63; raw[o + 1] = 76; raw[o + 2] = 154; }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]).toString('base64');
})();

let browser;
test.before(async () => { browser = await launch(); fs.mkdirSync(SHOTS, { recursive: true }); });
test.after(async () => { await browser.close(); });

const noHScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

for (const device of DEVICES) {
  test(`${device}: renders live data for a full custom word`, async () => {
    const page = await open(browser, device, hashOf(MET), { seed });
    assert.equal(await page.textContent('h1'), 'meticulous');
    assert.equal((await page.textContent('.wd-tag')).trim(), 'Tính từ · C1');
    assert.equal((await page.textContent('.wd-back')).trim(), 'Từ của tôi');
    assert.equal(await page.getAttribute('.wd-back', 'href'), '#/deck/mine');
    assert.equal(await page.locator('.wd-ipa').count(), 2);
    assert.equal(await page.getAttribute('.wd-ipa >> nth=0', 'data-accent'), 'uk');
    assert.equal(await page.getAttribute('.wd-ipa >> nth=1', 'data-accent'), 'us');
    const live = await page.evaluate((k) => ({ score: VL.srs.score(k), note: VL.srs.levelNote(VL.srs.score(k)), need: VL.srs.toMaster(k), p: VL.srs.progress(k) }), MET);
    assert.equal((await page.textContent('.wd-ring-in')).trim(), live.score + '%');
    assert.equal((await page.textContent('.wd-level')).trim(), live.note);
    const lvId = await page.evaluate((k) => VL.srs.level(VL.srs.score(k)).id, MET);
    assert.ok(await page.locator('.wd-score.lv-' + lvId).count(), 'level class drives ring/label colour tokens');
    // v3 hero: peach dotted tile
    const hero = await page.evaluate(() => getComputedStyle(document.querySelector('.wd-hero')).backgroundImage);
    assert.match(hero, /radial-gradient/);
    assert.ok((await page.textContent('.wd-score-text')).includes('Cần ' + live.need + ' lần đúng nữa'));
    assert.ok((await page.textContent('.wd-score-text')).includes('Ôn tiếp: '));
    // sections
    const text = await page.textContent('.wd-cols');
    for (const s of ['Nghĩa', 'Ví dụ', 'Ngữ pháp & collocation', 'Từ liên quan', 'Ghi chú', 'Lịch sử luyện', 'Thuộc bộ']) assert.ok(text.includes(s), s);
    assert.ok(text.includes('showing very careful attention to every detail'));
    assert.equal(await page.locator('.wd-ex').count(), 2);
    assert.equal(await page.textContent('.wd-ex-en b >> nth=0'), 'meticulous');
    assert.equal(await page.getAttribute('.wd-ex .speak-btn >> nth=0', 'data-text'), 'She keeps meticulous records of every expense.');
    assert.equal(await page.locator('.wd-gram-line').count(), 2);
    assert.equal(await page.locator('.wd-chip-syn').count(), 3);
    assert.equal(await page.locator('.wd-chip-ant').count(), 2);
    assert.equal(await page.getAttribute('.wd-chip-syn >> nth=0', 'href'), '#/library?q=thorough');
    assert.ok(text.includes(live.p.c + ' đúng · ' + live.p.x + ' sai'));
    // history: answers (newest first) + "Thêm vào thư viện"
    assert.equal(await page.locator('.wd-hist-row').count(), live.p.h.length + 1);
    assert.equal((await page.textContent('.wd-hist-row >> nth=0 >> .wd-dot')).trim(), '✕');
    assert.equal((await page.textContent('.wd-hist-row >> nth=0 >> .wd-hist-mode')).trim(), 'Chọn nghĩa');
    assert.equal((await page.textContent('.wd-hist-row >> nth=0 >> .wd-delta')).trim(), '−10% → 0%');
    assert.equal((await page.textContent('.wd-hist-row >> nth=1 >> .wd-delta')).trim(), '+10% → 10%');
    assert.equal(await page.locator('.wd-ai').count(), 0, 'no AI buttons when nothing is empty');
    assert.equal(await page.getAttribute('a.wd-btn', 'href'), '#/add?edit=' + encodeURIComponent(MET));
    assert.equal(await page.locator('[data-action="delete"]').count(), 1);
    assert.ok(await noHScroll(page), 'no horizontal scroll');
    // two columns on laptop only
    const tops = await page.evaluate(() => [...document.querySelectorAll('.wd-col')].map((c) => Math.round(c.getBoundingClientRect().top)));
    if (device === 'laptop') assert.equal(tops[0], tops[1]); else assert.ok(tops[1] > tops[0]);
    const sideCards = await page.evaluate(() => [...document.querySelectorAll('.wd-col-side > .wd-card')].slice(0, 2).map((c) => Math.round(c.getBoundingClientRect().top)));
    if (device === 'ipad') assert.equal(sideCards[0], sideCards[1], 'iPad side column is a 2-col grid'); else assert.ok(sideCards[1] > sideCards[0]);
    await page.screenshot({ path: path.join(SHOTS, `word-${device}.png`), fullPage: true });
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  test(`${device}: illustration slot — placeholder, "Đổi ảnh" upload, layout`, async () => {
    const page = await open(browser, device, hashOf(MET), { seed });
    // no image (network blocked) → generic placeholder stays visible
    await page.waitForSelector('.wd-img.is-empty');
    assert.ok(await page.isVisible('.wd-fig'));
    assert.ok(await page.isVisible('.wd-illo'));
    assert.equal(await page.getAttribute('.wd-illo', 'aria-label'), 'Chưa có hình minh hoạ');
    const r = await page.evaluate(() => { const i = document.querySelector('.wd-fig').getBoundingClientRect(), t = document.querySelector('.wd-word').getBoundingClientRect(); return { iw: i.width, ih: i.height, il: i.left, ib: i.bottom, tl: t.left, tt: t.top }; });
    if (device === 'iphone') assert.ok(r.ib <= r.tt + 1 && Math.abs(r.iw / r.ih - 4 / 3) < 0.02, 'image above title, 4:3');
    else { assert.ok(r.il + r.iw <= r.tl + 1, 'image beside title'); assert.equal(Math.round(r.iw), device === 'laptop' ? 300 : 240); assert.ok(r.ih >= r.iw - 1, 'at least square (stretches with the header, as in the design)'); }
    // "Đổi ảnh" opens the file picker
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('[data-action="pickimg"]')]);
    assert.ok(chooser);
    // non-image → error toast
    await page.setInputFiles('#wd-file', { name: 'a.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
    await page.waitForSelector('.toast.toast-error.is-show');
    // small PNG → saved as data URL and shown
    await page.setInputFiles('#wd-file', { name: 'p.png', mimeType: 'image/png', buffer: Buffer.from(PNG, 'base64') });
    await page.waitForFunction((k) => /^data:image\//.test(VL.words.get(k).img || ''), MET);
    await page.waitForSelector('.wd-img.is-loaded img');
    assert.equal(await page.isVisible('.wd-illo'), false);
    assert.ok((await page.textContent('#toast')).includes('Đã đổi ảnh'));
    const ex = await page.evaluate((k) => VL.words.get(k).examples.length, MET);
    assert.equal(ex, 2, 'other fields untouched');
    await page.reload(); await page.waitForSelector('.wd-img.is-loaded img');
    assert.ok(await noHScroll(page));
    await page.waitForTimeout(400); // image fade-in
    await page.screenshot({ path: path.join(SHOTS, `word-img-${device}.png`), fullPage: true });
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  test(`${device}: built-in word with empty fields — AI fills only empty ones and persists`, async () => {
    const page = await open(browser, device, hashOf('ielts:derive'), { seed });
    assert.equal((await page.textContent('.wd-back')).trim(), 'IELTS Academic Word List');
    assert.equal(await page.locator('.wd-ipa').count(), 1, 'missing US IPA hidden');
    assert.equal(await page.locator('[data-action="delete"]').count(), 0, 'built-in words cannot be deleted');
    assert.ok((await page.locator('.wd-ai').count()) >= 4);
    const before = await page.evaluate(() => VL.words.get('ielts:derive'));
    let calls = 0;
    let release;
    const gate = new Promise((r) => { release = r; });
    await page.route('https://api.groq.com/**', async (route) => {
      calls++;
      await gate;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: JSON.stringify({
        vi: 'SHOULD NOT OVERWRITE', ipaUs: '/dɪˈraɪv/', def: 'to get something from something else',
        examples: [{ en: 'NEW EXAMPLE', vi: 'x' }], gram: 'derive sth from sth', syn: ['obtain', 'gain'], ant: [], note: 'Nhấn âm 2.' }) } }] }) });
    });
    await page.click('.wd-ai >> nth=0');
    await page.waitForSelector('.wd-ai[disabled] .spinner');
    release();
    await page.waitForSelector('.wd-ex-vi'); // re-rendered
    await page.waitForFunction(() => !document.querySelector('.wd-ai[disabled]'));
    assert.equal(calls, 1);
    const w = await page.evaluate(() => VL.words.get('ielts:derive'));
    assert.equal(w.vi, before.vi, 'vi not overwritten');
    assert.deepEqual(w.examples, before.examples, 'examples not overwritten');
    assert.equal(w.def, 'to get something from something else');
    assert.deepEqual(w.syn, ['obtain', 'gain']);
    assert.equal(await page.locator('.wd-ipa').count(), 2);
    assert.ok((await page.textContent('.wd-cols')).includes('to get something from something else'));
    assert.equal(await page.locator('.wd-chip-syn').count(), 2);
    assert.ok((await page.textContent('#toast')).includes('Đã thêm gợi ý từ AI'));
    // remaining empty section (antonyms only empty → related section shows synonyms, no AI button)
    assert.equal(await page.locator('.wd-ai').count(), 0);
    await page.reload();
    await page.waitForSelector('.wd-word');
    assert.ok((await page.textContent('.wd-cols')).includes('to get something from something else'), 'persisted');
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  test(`${device}: AI offline → error toast, page still usable`, async () => {
    const page = await open(browser, device, hashOf('ielts:allocate'), { seed });
    await page.screenshot({ path: path.join(SHOTS, `word-builtin-${device}.png`), fullPage: true });
    await page.click('.wd-ai >> nth=0');
    await page.waitForSelector('.toast.toast-error.is-show');
    assert.ok((await page.textContent('#toast')).length > 5);
    await page.waitForFunction(() => document.querySelector('.wd-ai') && !document.querySelector('.wd-ai[disabled]'));
    assert.ok(await noHScroll(page));
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  test(`${device}: practise, add to deck, delete, navigation`, async () => {
    const page = await open(browser, device, hashOf('comm:awkward'), { seed });
    // + Thêm vào bộ
    await page.click('[data-action="menu"]');
    const opts = await page.$$eval('.wd-menu-item', (els) => els.map((e) => e.getAttribute('data-deck')));
    assert.deepEqual(opts, ['mine', 'ielts']);
    await page.click('.wd-menu-item[data-deck="ielts"]');
    assert.equal(await page.locator('.wd-menu').count(), 0);
    assert.equal(await page.locator('a.wd-deck').count(), 2);
    assert.ok(await page.evaluate(() => VL.words.inDeck('ielts').includes('comm:awkward')));
    await page.click('[data-action="menu"]');
    assert.equal(await page.locator('.wd-menu-item').count(), 1);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.wd-menu').count(), 0);
    await page.reload(); await page.waitForSelector('.wd-word');
    assert.equal(await page.locator('a.wd-deck').count(), 2, 'membership persisted');
    // Luyện từ này → Chọn nghĩa
    await page.click('[data-action="practice"]');
    await page.waitForFunction(() => location.hash === '#/quiz');
    const s = await page.evaluate(() => VL.store.state.session);
    assert.deepEqual(s.queue.map((q) => [q.key, q.mode]), [['comm:awkward', 'mean']]);
    assert.equal(s.source, 'word');
    assert.equal(s.title, 'Luyện từ này');
    // synonym chip → library search
    await page.goto(page.url().replace(/#.*$/, '') + hashOf(MET));
    await page.waitForSelector('.wd-chip-syn');
    await page.click('.wd-chip-syn >> nth=1');
    await page.waitForFunction(() => location.hash === '#/library?q=painstaking');
    // delete custom word (cancel first, then confirm)
    await page.goto(page.url().replace(/#.*$/, '') + hashOf(MET));
    await page.waitForSelector('[data-action="delete"]');
    await page.click('[data-action="delete"]');
    await page.click('.sheet [data-r="0"]');
    assert.ok(await page.evaluate((k) => VL.words.exists(k), MET));
    await page.click('[data-action="delete"]');
    await page.click('.sheet [data-r="1"]');
    await page.waitForFunction(() => location.hash === '#/deck/mine');
    assert.equal(await page.evaluate((k) => VL.words.exists(k), MET), false);
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  test(`${device}: unstarted word and unknown key`, async () => {
    const page = await open(browser, device, hashOf('comm:agree'), { seed });
    assert.ok((await page.textContent('.wd-score-text')).includes('Chưa học'));
    assert.equal((await page.textContent('.wd-ring-in')).trim(), '0%');
    assert.ok((await page.textContent('.wd-cols')).includes('Chưa có lần luyện nào'));
    assert.ok((await page.textContent('.wd-cols')).includes('0 đúng · 0 sai'));
    await page.goto(page.url().replace(/#.*$/, '') + hashOf('nope:xyz'));
    await page.waitForSelector('.empty');
    assert.ok((await page.textContent('.empty')).includes('Không tìm thấy từ này'));
    assert.equal(await page.getAttribute('.empty a', 'href'), '#/library');
    await page.screenshot({ path: path.join(SHOTS, `word-empty-${device}.png`), fullPage: true });
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });
}

test('iphone: long unbroken word/meaning/notes/synonyms never cause horizontal scroll', async () => {
  const page = await open(browser, 'iphone', '#/today', { seed });
  const key = await page.evaluate(() => VL.words.save({ w: "don't-" + 'x'.repeat(60), vi: 'x'.repeat(200), note: 'y'.repeat(200), def: 'z'.repeat(200), gram: 'g'.repeat(200), syn: ['s'.repeat(100)], ant: ['a'.repeat(90)], examples: [{ en: 'e'.repeat(200), vi: 'v'.repeat(200) }] }));
  await page.evaluate((k) => { location.hash = '#/word/' + encodeURIComponent(k); }, key);
  await page.waitForSelector('.wd-chip-syn');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});
