/* Browser tests for page "add" (Thêm / sửa từ + AI). Run: node --test tests/pages/add.test.js */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const pw = require('../pw');
const { launch } = pw;
const open = async (...a) => { const p = await pw.open(...a); p.setDefaultTimeout(8000); return p; };
const { seed } = require('../fixtures');

const SHOTS = path.join(__dirname, '..', 'shots', 'add');
fs.mkdirSync(SHOTS, { recursive: true });
const DEVICES = ['laptop', 'ipad', 'iphone'];
// 2x2 red PNG for the upload test
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP4z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==', 'base64');

const fakeAI = (obj) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { role: 'assistant', content: JSON.stringify(obj) } }] }) });
const ALL = {
  pos: 'adj', ipa: 'rɪˈzɪliənt', ipaUs: '/rɪˈzɪliənt/', vi: 'kiên cường', def: 'able to recover quickly', cefr: 'c1',
  examples: [{ en: 'Children are often more resilient than adults think.', vi: 'Trẻ em mau hồi phục hơn người lớn nghĩ.' }, { en: 'A resilient grid.', vi: 'Lưới điện bền vững.' }],
  gram: 'be resilient to + N', syn: ['tough', 'adaptable'], ant: ['fragile'], note: 'Nhấn âm 2.'
};

let browser;
test.before(async () => { browser = await launch(); });
test.after(async () => { await browser.close(); });

for (const device of DEVICES) {
  test(`${device}: renders, screenshot, no console errors, no horizontal scroll`, async () => {
    const page = await open(browser, device, '#/add', { seed });
    await page.waitForSelector('#add-word');
    await page.evaluate(() => VL.store.setSetting('sw.auto', false));
    assert.equal(await page.textContent('h1'), 'Thêm từ');
    assert.match(await page.textContent('.add-target'), /Lưu vào\s*TCTừ của tôi/);
    assert.equal(await page.locator('.add-chip').count(), 6);
    assert.deepEqual(await page.locator('.add-chip').allTextContents(), ['Danh từ', 'Động từ', 'Tính từ', 'Trạng từ', 'Cụm từ', 'Thành ngữ']);
    assert.equal(await page.locator('.add-ai').count(), 1);
    assert.equal(await page.locator('.add-word-card .add-word-row #add-ai').count(), 1, 'AI button next to the word field');
    assert.equal(await page.textContent('.add-word-card .add-label'), 'Từ hoặc cụm từ tiếng Anh');
    assert.deepEqual(await page.locator('.add-h2').allTextContents(), ['Nghĩa & phát âm', 'Hình minh hoạ', 'Câu ví dụ', 'Ngữ pháp, từ liên quan & ghi chú']);
    assert.ok(await page.isVisible('.add-img-empty:has-text("Tải ảnh lên")'));
    assert.ok(await page.isVisible('text=hoặc để AI tạo khi bấm Gợi ý'));
    assert.ok(await page.isVisible('text=Cần có từ và nghĩa để lưu'));
    assert.equal(await page.locator('.add-ai').first().textContent(), 'Gợi ý bằng AI');
    const sw = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(sw <= 0, 'horizontal scroll ' + sw);
    // nav: "add" active
    const navActive = await page.locator('#nav .is-active').count();
    assert.ok(navActive >= 1);
    await page.fill('#add-word', 'resilient');
    await page.fill('#add-vi', 'kiên cường, mau phục hồi');
    await page.waitForSelector('.add-dup');
    assert.equal(await page.isVisible('text=Cần có từ và nghĩa để lưu'), false);
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(SHOTS, `add-${device}.png`), fullPage: true });
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  test(`${device}: typing keeps focus/caret, validation, chips, examples, save & add next`, async () => {
    const page = await open(browser, device, '#/add', { seed });
    await page.evaluate(() => VL.store.setSetting('sw.auto', false));
    // validation
    await page.click('[data-action="save"]');
    assert.ok(await page.isVisible('text=Cần có từ và nghĩa để lưu'));
    assert.ok(await page.locator('#add-word.is-error').count());
    assert.ok(await page.locator('#add-vi.is-error').count());
    assert.equal(await page.evaluate(() => document.activeElement.id), 'add-word');
    // typing — focus stays
    await page.type('#add-word', 'serendipity', { delay: 5 });
    assert.equal(await page.evaluate(() => document.activeElement.id), 'add-word');
    assert.equal(await page.inputValue('#add-word'), 'serendipity');
    assert.equal(await page.locator('#add-word.is-error').count(), 0);
    await page.fill('#add-vi', 'sự tình cờ may mắn');
    assert.equal(await page.isVisible('text=Cần có từ và nghĩa để lưu'), false);
    await page.fill('#add-ipa', '/ˌserənˈdɪpəti/');
    // pos chip
    await page.click('.add-chip:has-text("Danh từ")');
    assert.equal(await page.getAttribute('.add-chip:has-text("Danh từ")', 'aria-checked'), 'true');
    assert.equal(await page.inputValue('#add-ipa'), '/ˌserənˈdɪpəti/', 'value survives refresh');
    // examples: add, type, remove
    await page.fill('#add-ex-en-0', 'Finding that book was pure serendipity.');
    await page.click('[data-action="exAdd"]');
    assert.equal(await page.locator('.add-ex').count(), 2);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'add-ex-en-1');
    await page.fill('#add-ex-en-1', 'to be removed');
    await page.click('.add-ex >> nth=1 >> [data-action="exDel"]');
    assert.equal(await page.locator('.add-ex').count(), 1);
    assert.equal(await page.inputValue('#add-ex-en-0'), 'Finding that book was pure serendipity.');
    // optional section
    await page.fill('#add-gram', 'by serendipity');
    await page.fill('#add-syn', 'luck, chance / misfortune');
    await page.fill('#add-note', 'ser-en-DIP-i-ty');
    // image upload → data URL; Xoá; upload again
    await page.setInputFiles('#add-file', { name: 'x.png', mimeType: 'image/png', buffer: PNG });
    await page.waitForSelector('#add-img');
    assert.match(await page.getAttribute('#add-img', 'src'), /^data:image\/jpeg;base64,/);
    assert.equal(await page.locator('.add-img-badge').count(), 0, 'uploaded image has no "AI tạo" badge');
    await page.click('[data-action="imgDel"]');
    assert.equal(await page.locator('#add-img').count(), 0);
    assert.ok(await page.isVisible('.add-img-empty'));
    const chooser = page.waitForEvent('filechooser');
    await page.click('.add-img-empty');
    await (await chooser).setFiles({ name: 'x.png', mimeType: 'image/png', buffer: PNG });
    await page.waitForSelector('#add-img');
    assert.ok(await page.isVisible('[data-action="imgPick"]:has-text("Đổi ảnh")'));
    // not an image → error toast
    await page.setInputFiles('#add-file', { name: 'a.txt', mimeType: 'text/plain', buffer: Buffer.from('hi') });
    await page.waitForSelector('#toast.toast-error');
    assert.match(await page.textContent('#toast'), /Chỉ chọn được file ảnh/);
    // save & add next
    await page.click('[data-action="saveNext"]');
    assert.equal(await page.inputValue('#add-word'), '');
    assert.equal(await page.inputValue('#add-vi'), '');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'add-word');
    assert.match(await page.textContent('#toast'), /Đã lưu “serendipity” vào Từ của tôi/);
    const w = await page.evaluate(() => VL.words.get('mine:serendipity'));
    assert.equal(w.vi, 'sự tình cờ may mắn');
    assert.equal(w.pos, 'n');
    assert.equal(w.ipa, '/ˌserənˈdɪpəti/');
    assert.deepEqual(w.examples, [{ en: 'Finding that book was pure serendipity.', vi: '' }]);
    assert.equal(w.gram, 'by serendipity');
    assert.deepEqual(w.syn, ['luck', 'chance']);
    assert.deepEqual(w.ant, ['misfortune']);
    assert.equal(w.note, 'ser-en-DIP-i-ty');
    assert.match(w.img, /^data:image\/jpeg;base64,/);
    // persists after reload
    await page.reload();
    await page.waitForSelector('#add-word');
    assert.ok(await page.evaluate(() => !!VL.words.get('mine:serendipity')));
    // "Lưu từ" → word detail
    await page.fill('#add-word', 'ephemeral');
    await page.fill('#add-vi', 'phù du');
    await page.click('[data-action="save"]');
    await page.waitForFunction(() => location.hash === '#/word/' + encodeURIComponent('mine:ephemeral'));
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });
}

test('query: q prefill + deck target; unknown deck falls back to mine', async () => {
  const page = await open(browser, 'laptop', '#/add?q=wanderlust&deck=ielts', { seed });
  assert.equal(await page.inputValue('#add-word'), 'wanderlust');
  assert.match(await page.textContent('.add-target'), /IELTS Academic Word List/);
  await page.fill('#add-vi', 'niềm đam mê du lịch');
  await page.click('[data-action="save"]');
  await page.waitForFunction(() => location.hash.startsWith('#/word/'));
  assert.equal(await page.evaluate(() => VL.words.get('ielts:wanderlust').deck), 'ielts');
  assert.ok(await page.evaluate(() => VL.words.inDeck('ielts').includes('ielts:wanderlust')));
  await page.evaluate(() => { location.hash = '#/add?deck=nope'; });
  await page.waitForFunction(() => document.querySelector('#add-word') && document.querySelector('#add-word').value === '');
  assert.match(await page.textContent('.add-target'), /Từ của tôi/);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('duplicate check: shows alert with link, hides when changed', async () => {
  const page = await open(browser, 'iphone', '#/add', { seed });
  await page.type('#add-word', 'Meticulous');
  await page.waitForSelector('.add-dup');
  assert.equal((await page.textContent('.add-dup span')).trim(), '“Meticulous” đã có trong Từ của tôi');
  assert.equal(await page.getAttribute('.add-dup a', 'href'), '#/word/' + encodeURIComponent('mine:meticulous'));
  assert.equal(await page.evaluate(() => document.activeElement.id), 'add-word');
  await page.type('#add-word', 'ly');
  await page.waitForTimeout(400);
  assert.equal(await page.locator('.add-dup').count(), 0);
  const comm = await page.evaluate(() => VL.words.get(VL.words.inDeck('comm')[0])); // built-in word in an added deck
  await page.fill('#add-word', comm.w);
  await page.waitForSelector('.add-dup');
  assert.match(await page.textContent('.add-dup'), /đã có trong 300 từ giao tiếp thông dụng/);
  await page.click('.add-dup a');
  await page.waitForFunction((k) => location.hash === '#/word/' + encodeURIComponent(k), comm.key);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('edit mode: prefilled, no self-duplicate, saves to the same key and returns to detail', async () => {
  const page = await open(browser, 'ipad', '#/today', { seed });
  await page.evaluate(() => { location.hash = '#/add?edit=' + encodeURIComponent('mine:meticulous'); });
  await page.waitForSelector('#add-word');
  assert.equal(await page.textContent('h1'), 'Sửa từ');
  assert.equal(await page.inputValue('#add-word'), 'meticulous');
  assert.equal(await page.inputValue('#add-ipa'), '/məˈtɪkjələs/');
  assert.equal(await page.locator('.add-ex').count(), 2);
  assert.equal(await page.getAttribute('.add-chip.is-on', 'data-value'), 'adj');
  assert.equal(await page.inputValue('#add-syn'), 'thorough, painstaking, precise / careless, sloppy');
  await page.waitForTimeout(350);
  assert.equal(await page.locator('.add-dup').count(), 0);
  await page.fill('#add-vi', 'tỉ mỉ');
  await page.setInputFiles('#add-file', { name: 'm.png', mimeType: 'image/png', buffer: PNG });
  await page.waitForSelector('#add-img');
  await page.click('[data-action="save"]');
  await page.waitForFunction(() => location.hash === '#/word/' + encodeURIComponent('mine:meticulous'));
  const w = await page.evaluate(() => VL.words.get('mine:meticulous'));
  assert.equal(w.vi, 'tỉ mỉ');
  assert.match(w.img, /^data:image\/jpeg/);
  assert.deepEqual(w.ant, ['careless', 'sloppy']);
  assert.equal(await page.evaluate(() => Object.keys(VL.store.state.custom).filter((k) => k.startsWith('mine:meticulous')).length), 1);
  // built-in word edit goes through overrides, shows its deck
  const ck = await page.evaluate(() => VL.words.inDeck('comm')[0]);
  await page.evaluate((k) => { location.hash = '#/add?edit=' + encodeURIComponent(k); }, ck);
  await page.waitForSelector('#add-word');
  assert.match(await page.textContent('.add-target'), /300 từ giao tiếp thông dụng/);
  await page.fill('#add-note', 'An apple a day');
  await page.click('[data-action="save"]');
  await page.waitForFunction((k) => location.hash === '#/word/' + encodeURIComponent(k), ck);
  assert.equal(await page.evaluate((k) => VL.store.state.overrides[k].note, ck), 'An apple a day');
  // unknown key → empty state
  await page.evaluate(() => { location.hash = '#/add?edit=nope:zzz'; });
  await page.waitForSelector('text=Không tìm thấy từ này');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('AI: one button fills every empty field (incl. image), keeps typed values, status, undo, error toast', async () => {
  const page = await open(browser, 'laptop', '#/add', { seed });
  await page.evaluate((b64) => {
    VL.store.setSetting('sw.auto', false);
    window.__imgCalls = [];
    VL.media.image = (w) => { window.__imgCalls.push(w); return Promise.resolve(w.w === 'resilient' ? 'data:image/png;base64,' + b64 : null); };
  }, PNG.toString('base64'));
  let calls = 0, mode = 'ok', release, lastBody = '';
  await page.route('https://api.groq.com/**', async (route) => {
    calls++;
    lastBody = route.request().postData() || '';
    if (mode === 'wait') await new Promise((r) => { release = r; });
    if (mode === 'err') return route.fulfill({ status: 401, contentType: 'application/json', body: '{}' });
    if (mode === 'partial') {
      // 'all' reply without the "more" section → page asks again for that section only
      const body = JSON.parse(lastBody); const prompt = body.messages[1].content;
      return route.fulfill(fakeAI(/"gram"/.test(prompt) && !/"examples"/.test(prompt) ? { gram: 'g1', syn: ['s1'], ant: [], note: 'n1' } : { pos: 'v', ipa: '/a/', ipaUs: '/b/', vi: 'nghĩa', examples: [{ en: 'E1.', vi: 'V1.' }] }));
    }
    return route.fulfill(fakeAI(ALL));
  });
  // no word → toast, no call
  await page.click('#add-ai');
  assert.equal(await page.textContent('#toast'), 'Nhập từ trước khi gợi ý.');
  assert.equal(calls, 0);
  await page.fill('#add-word', 'resilient');
  await page.fill('#add-ipa', '/mine/'); // typed by the user → must be kept
  mode = 'wait';
  await page.click('#add-ai');
  await page.waitForSelector('#add-ai[aria-disabled="true"]');
  assert.equal(await page.textContent('#add-ai'), 'Đang điền…');
  assert.ok(await page.isVisible('text=AI đang điền phiên âm, nghĩa, ví dụ, ngữ pháp và hình minh hoạ…'));
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.add-dim')).opacity), '0.45');
  // user keeps typing in another field while waiting
  await page.click('#add-ex-en-0');
  await page.keyboard.type('My own sentence.');
  release();
  await page.waitForSelector('#add-ai:not([aria-disabled])');
  assert.equal(calls, 1, 'single call');
  assert.match(lastBody, /examples/); assert.match(lastBody, /gram/); assert.match(lastBody, /ipaUs/);
  assert.equal(await page.textContent('#add-ai'), 'Gợi ý lại');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'add-ex-en-0', 'focus kept');
  // every section filled, typed values kept
  assert.equal(await page.inputValue('#add-ipa'), '/mine/');
  assert.equal(await page.inputValue('#add-ipaus'), '/rɪˈzɪliənt/');
  assert.equal(await page.inputValue('#add-vi'), 'kiên cường');
  assert.equal(await page.getAttribute('.add-chip.is-on', 'data-value'), 'adj');
  assert.equal(await page.locator('.add-ex').count(), 1, 'user example not overwritten');
  assert.equal(await page.inputValue('#add-ex-en-0'), 'My own sentence.');
  assert.equal(await page.inputValue('#add-gram'), 'be resilient to + N');
  assert.equal(await page.inputValue('#add-syn'), 'tough, adaptable / fragile');
  assert.equal(await page.inputValue('#add-note'), 'Nhấn âm 2.');
  // image fetched automatically → "AI tạo" badge
  await page.waitForSelector('#add-img');
  assert.ok(await page.isVisible('.add-img-badge:has-text("AI tạo")'));
  assert.deepEqual(await page.evaluate(() => window.__imgCalls.map((w) => [w.w, w.pos, w.def])), [['resilient', 'adj', 'able to recover quickly']]);
  assert.ok(await page.isVisible('text=AI đã điền toàn bộ. Kiểm tra và sửa lại nếu cần.'));
  await page.screenshot({ path: path.join(SHOTS, 'add-ai-filled-laptop.png'), fullPage: true });
  // Hoàn tác → form exactly as before the fill
  await page.click('[data-action="undo"]');
  assert.equal(await page.locator('.add-filled').count(), 0);
  assert.equal(await page.textContent('#add-ai'), 'Gợi ý bằng AI');
  assert.equal(await page.inputValue('#add-word'), 'resilient');
  assert.equal(await page.inputValue('#add-ipa'), '/mine/');
  for (const id of ['#add-vi', '#add-ipaus', '#add-gram', '#add-syn', '#add-note', '#add-ex-en-0']) assert.equal(await page.inputValue(id), '', id + ' restored');
  assert.equal(await page.locator('.add-chip.is-on').count(), 0);
  assert.equal(await page.locator('#add-img').count(), 0);
  // fill again (cached reply), then keep my own example
  await page.fill('#add-ex-en-0', 'My own sentence.');
  await page.click('#add-ai');
  await page.waitForSelector('.add-filled');
  assert.equal(calls, 1, 'cached');
  assert.equal(await page.inputValue('#add-ex-en-0'), 'My own sentence.');
  // save keeps AI def/cefr
  await page.click('[data-action="save"]');
  await page.waitForFunction(() => location.hash.startsWith('#/word/'));
  const key = await page.evaluate(() => decodeURIComponent(location.hash.slice(7)));
  const w = await page.evaluate((k) => VL.words.get(k), key);
  assert.equal(w.def, 'able to recover quickly');
  assert.equal(w.cefr, 'C1');
  assert.equal(w.ipa, '/mine/');
  assert.deepEqual(w.examples, [{ en: 'My own sentence.', vi: '' }]);
  // fresh form: all empty → examples from AI too
  await page.evaluate(() => { location.hash = '#/add'; });
  await page.waitForSelector('#add-word');
  mode = 'ok';
  await page.fill('#add-word', 'sturdy');
  await page.click('#add-ai');
  await page.waitForFunction(() => document.querySelectorAll('.add-ex').length === 2);
  assert.equal(await page.inputValue('#add-ex-en-0'), ALL.examples[0].en);
  assert.equal(await page.inputValue('#add-ex-vi-1'), ALL.examples[1].vi);
  assert.equal(await page.inputValue('#add-ipa'), '/rɪˈzɪliənt/');
  // partial reply → follow-up for the missing section only
  await page.evaluate(() => { location.hash = '#/add?n=2'; });
  await page.waitForFunction(() => document.getElementById('add-word') && !document.getElementById('add-word').value);
  mode = 'partial'; calls = 0;
  await page.fill('#add-word', 'wobble');
  await page.click('#add-ai');
  await page.waitForFunction(() => document.getElementById('add-gram').value === 'g1');
  assert.equal(calls, 2);
  assert.equal(await page.inputValue('#add-vi'), 'nghĩa');
  assert.equal(await page.inputValue('#add-note'), 'n1');
  assert.equal(await page.inputValue('#add-ex-en-0'), 'E1.');
  // error → toast with message
  await page.evaluate(() => { location.hash = '#/add?n=3'; });
  await page.waitForFunction(() => document.getElementById('add-word') && !document.getElementById('add-word').value);
  mode = 'err';
  await page.fill('#add-word', 'quixotic');
  await page.click('#add-ai');
  await page.waitForSelector('#toast.toast-error');
  assert.match(await page.textContent('#toast'), /GROQ API key không hợp lệ/);
  assert.equal(await page.textContent('#add-ai'), 'Gợi ý bằng AI');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('AI auto-fill on word blur when sw.auto is on (once, new words only, meaning empty)', async () => {
  const page = await open(browser, 'iphone', '#/add', { seed });
  let calls = 0;
  await page.route('https://api.groq.com/**', (route) => { calls++; route.fulfill(fakeAI(ALL)); });
  await page.fill('#add-word', 'resilient');
  await page.click('#add-ipa');
  await page.waitForFunction(() => document.getElementById('add-vi').value === 'kiên cường');
  assert.equal(calls, 1);
  assert.equal(await page.inputValue('#add-ipa'), '/rɪˈzɪliənt/');
  assert.equal(await page.inputValue('#add-ex-en-0'), ALL.examples[0].en);
  assert.equal(await page.inputValue('#add-gram'), 'be resilient to + N');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'add-ipa');
  // blur again → no second call
  await page.fill('#add-vi', '');
  await page.click('#add-word');
  await page.click('#add-ipa');
  await page.waitForTimeout(200);
  assert.equal(calls, 1);
  // edit mode never auto-runs
  await page.evaluate(() => { location.hash = '#/add?edit=' + encodeURIComponent('mine:albeit'); });
  await page.waitForSelector('#add-word');
  await page.fill('#add-vi', '');
  await page.click('#add-word');
  await page.click('#add-ipa');
  await page.waitForTimeout(200);
  assert.equal(calls, 1);
  assert.equal(await page.textContent('.add-chip.is-on'), 'Liên từ', 'non-listed pos shown as extra chip');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});
