/* End-to-end QC: a brand-new user walks through every main feature by clicking the UI, on laptop, iPad and iPhone.
   Run: node --test tests/e2e.test.js   (VL_BASE=file:///Users/baoho/development/english or a static server on :8765) */
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { launch, open } = require('./pw');

const SHOTS = path.join(__dirname, 'shots', 'e2e');
let browser;
before(async () => { fs.mkdirSync(SHOTS, { recursive: true }); browser = await launch(); });
after(async () => { if (browser) await browser.close(); });

const hash = (p) => p.evaluate(() => location.hash);
const shot = (p, name) => p.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: true });
const noHScroll = async (p) => assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'horizontal scroll');

// Answer whatever practice screen is showing until the session ends. Returns number of answers.
async function playSession(p, wrongEvery) {
  let n = 0;
  for (let guard = 0; guard < 80; guard++) {
    const h = await hash(p);
    if (h.startsWith('#/result')) return n;
    const ok = !(wrongEvery && n % wrongEvery === 0);
    if (h.startsWith('#/flash')) {
      await p.getByRole('button', { name: ok ? 'Đã nhớ' : 'Chưa nhớ' }).first().click();
    } else if (h.startsWith('#/quiz')) {
      const typeInput = p.locator('#view input[type="text"]');
      if (await typeInput.count()) {
        const ans = await p.evaluate(() => VL.session.item().word.w);
        await typeInput.fill(ok ? ans : 'zzz');
        await typeInput.press('Enter');
      } else {
        const right = await p.evaluate(() => { const it = VL.session.item(); return it.mode === 'mean' ? it.word.vi : it.word.w; });
        const opts = p.locator('#view button[data-action="pick"], #view [data-option], #view .quiz-opt, #view .opt');
        if (!ok) await p.getByRole('button', { name: 'Tôi không biết' }).click();
        else {
          const btn = p.locator('#view button').filter({ hasText: right }).first();
          if (await btn.count()) await btn.click(); else await opts.first().click();
        }
      }
    } else throw new Error('unexpected screen ' + h);
    n++;
    await p.waitForTimeout(60);
    const idx = await p.evaluate(() => { const s = VL.session.current(); return s ? s.idx : -1; });
    const next = p.locator('#view button, #view a').filter({ hasText: /tiếp theo|Tiếp ngay|Tiếp:|Xem kết quả/i }).first();
    if (await next.count()) await next.click().catch(() => {}); // a correct quiz answer may auto-advance first
    await p.waitForFunction((i) => { const s = VL.session.current(); return !s || s.idx !== i || s.done || location.hash.startsWith('#/result'); }, idx, { timeout: 6000 });
    await p.waitForTimeout(60);
  }
  throw new Error('session did not finish');
}

for (const device of ['laptop', 'ipad', 'iphone']) {
  test(`e2e · ${device} · new user full journey`, async () => {
    const p = await open(browser, device, '#/today');
    // 1. Today, fresh user
    await p.waitForSelector('h1');
    assert.match(await p.textContent('#view'), /Hôm nay học gì/);
    await noHScroll(p); await shot(p, device + '-1-today');

    // 2. Library → open a built-in deck → add it
    await p.locator('#nav a[href="#/library"]').first().click();
    await p.waitForFunction(() => location.hash === '#/library');
    assert.match(await p.textContent('#view'), /Bộ của tôi/);
    await p.locator('#view a[href="#/deck/travel"]').first().click();
    await p.waitForFunction(() => location.hash === '#/deck/travel');
    await p.getByRole('button', { name: /Thêm vào Bộ của tôi/ }).first().click();
    assert.ok(await p.evaluate(() => VL.decks.isAdded('travel')), 'deck added');
    await noHScroll(p); await shot(p, device + '-2-deck');

    // 3. Practise this deck (flash + quiz modes) and finish with some wrong answers
    await p.getByRole('button', { name: /Luyện bộ này/ }).first().click();
    await p.waitForFunction(() => /#\/(flash|quiz)/.test(location.hash));
    await shot(p, device + '-3-practice-screen');
    const answered = await playSession(p, 3);
    assert.ok(answered > 0);
    assert.match(await p.textContent('#view'), /đúng/);
    await noHScroll(p); await shot(p, device + '-4-result');

    // 4. Retry wrong words
    const retry = p.getByRole('button', { name: /Ôn lại/ });
    if (await retry.count()) {
      await retry.first().click();
      await p.waitForFunction(() => /#\/(flash|quiz)/.test(location.hash));
      await playSession(p, 0);
    }
    await p.getByRole('button', { name: /Về trang chủ/ }).first().click().catch(async () => p.getByRole('link', { name: /Về trang chủ/ }).first().click());
    await p.waitForFunction(() => location.hash === '#/today');
    const done = await p.evaluate(() => VL.store.state.days[VL.dayKey()].n);
    assert.ok(done >= answered, 'answers logged today');
    assert.ok(await p.evaluate(() => VL.srs.streak()) === 1, 'streak started');

    // 5. Add a custom word through the form
    await p.goto(p.url().split('#')[0] + '#/add');
    await p.waitForSelector('#add-word');
    await p.fill('#add-word', 'serendipity');
    await p.fill('#add-vi', 'sự tình cờ may mắn');
    await p.locator('#view [data-action="save"]').click();
    await p.waitForFunction(() => location.hash.startsWith('#/word/') && VL.current().name === 'word' && /serendipity/.test(document.getElementById('view').textContent));
    await noHScroll(p); await shot(p, device + '-5-word');

    // 6. Edit it
    await p.locator('#view a, #view button').filter({ hasText: /^Sửa$/ }).first().click();
    await p.waitForFunction(() => location.hash.startsWith('#/add?edit=') && VL.current().name === 'add' && document.getElementById('add-word'));
    assert.equal(await p.inputValue('#add-word'), 'serendipity');

    // 7. Settings: dark theme persists across reload
    await p.goto(p.url().split('#')[0] + '#/settings/theme');
    await p.getByRole('radio', { name: 'Tối' }).click();
    assert.equal(await p.evaluate(() => document.documentElement.getAttribute('data-theme')), 'dark');
    await p.reload(); await p.waitForFunction(() => window.VL && VL.current());
    assert.equal(await p.evaluate(() => document.documentElement.getAttribute('data-theme')), 'dark');
    await p.goto(p.url().split('#')[0] + '#/today');
    await p.waitForTimeout(150);
    await noHScroll(p); await shot(p, device + '-6-today-dark');

    // 8. Every route renders without errors (with real data loaded)
    for (const h of ['#/today', '#/library', '#/library?q=apple', '#/deck/toeic', '#/deck/mine', '#/word/' + encodeURIComponent('toeic:invoice'), '#/add', '#/practice', '#/flash', '#/quiz', '#/result', '#/settings', '#/word/nope', '#/deck/nope', '#/garbage']) {
      await p.goto(p.url().split('#')[0] + h);
      await p.waitForTimeout(80);
      await noHScroll(p);
      assert.ok((await p.textContent('#view')).trim().length > 0, 'blank page at ' + h);
    }
    assert.deepEqual(p.errors, [], 'console errors: ' + p.errors.join(' | '));
    await p.context().close();
  });
}

test('e2e · data integrity: 12 decks loaded with expected sizes', async () => {
  const p = await open(browser, 'laptop', '#/today');
  const n = await p.evaluate(() => VL.decks.builtInIds().map((id) => [id, VL.decks.get(id).n]));
  const want = { comm: 300, phr: 200, idiom: 150, daily: 300, travel: 300, food: 200, it: 300, work: 300, mkt: 300, toeic: 600, ielts: 570, iw: 400 };
  n.forEach(([id, c]) => assert.equal(c, want[id], id));
  const t = await p.evaluate(() => { VL.decks.builtInIds().forEach((id) => VL.decks.add(id)); const t0 = performance.now(); location.hash = '#/today'; VL.refresh(); const a = performance.now() - t0; const t1 = performance.now(); VL.go('#/library'); return [a, performance.now() - t1]; });
  console.log('render ms with all decks: today', t[0].toFixed(1), 'library', t[1].toFixed(1));
  await p.context().close();
});
