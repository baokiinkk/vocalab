/* Browser tests for Cài đặt (#/settings and #/settings?scope=practice). Run: node --test tests/pages/settings.test.js */
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { launch, open } = require('../pw');
const { seed } = require('../fixtures');

const SHOTS = path.join(__dirname, '..', 'shots', 'settings');
let browser;
before(async () => { fs.mkdirSync(SHOTS, { recursive: true }); browser = await launch(); });
after(async () => { if (browser) await browser.close(); });

const S = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('vocalab.v1')).settings);
const reload = async (page) => { await page.reload(); await page.waitForFunction(() => window.VL && VL.current && VL.current()); };
const toast = (page, re) => page.waitForFunction((src) => new RegExp(src).test((document.getElementById('toast') || {}).textContent || ''), re.source);
const heads = (page) => page.locator('.set-h2').allInnerTexts();
const noHScroll = async (page) => {
  const sw = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(sw <= 0, 'horizontal overflow ' + sw);
};
const shoot = async (page, name) => {
  await page.evaluate(() => { VL.store.setSetting('theme', 'light'); });
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: true });
  await page.evaluate(() => { VL.store.setSetting('theme', 'dark'); });
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(SHOTS, name + '-dark.png'), fullPage: true });
  await page.evaluate(() => { VL.store.setSetting('theme', 'sys'); });
};

for (const device of ['laptop', 'ipad', 'iphone']) {
  test(`settings · ${device} · full view renders per design`, async () => {
    const page = await open(browser, device, '#/settings', { seed });
    await page.waitForTimeout(200);
    assert.strictEqual(await page.locator('h1').innerText(), 'Cài đặt');
    assert.match(await page.locator('.set-subtitle').innerText(), /Chỉ những gì bạn cần chỉnh/);
    assert.deepStrictEqual((await heads(page)).map((s) => s.toUpperCase()), ['NHẮC ÔN', 'PHIÊN LUYỆN', 'CHUNG', 'DỮ LIỆU']);
    assert.strictEqual(await page.locator('.set-back').count(), 0);
    assert.ok(await page.locator('.nav-item.is-active[href="#/settings"]').count() >= 1);
    assert.strictEqual(await page.title(), 'Cài đặt · VocaLab');
    assert.ok(await page.evaluate(() => !document.getElementById('app').classList.contains('is-focus')));
    // v3 styles: h1 32/700, groups radius 16 with lip shadow, stepper radius 12
    const st = await page.evaluate(() => {
      const cs = (sel) => getComputedStyle(document.querySelector(sel));
      return { h1: cs('h1').fontSize + ' ' + cs('h1').fontWeight, r: cs('.set-group').borderRadius, sh: cs('.set-group').boxShadow, stp: cs('.stepper').borderRadius };
    });
    assert.strictEqual(st.h1, '32px 700');
    assert.strictEqual(st.r, '16px');
    assert.notStrictEqual(st.sh, 'none');
    assert.strictEqual(st.stp, '12px');
    for (const sel of ['#groq-key', '[data-action="key-test"]', '[data-action="export"]', '[data-action="import"]', '[data-action="reset"]', '#remind'])
      assert.strictEqual(await page.locator(sel).count(), 1, sel);
    // controls removed since v2 are not shown
    for (const sel of ['[data-action="mode"]', '[data-action^="seg-freq"]', '[data-action="sw-prio"]', '[data-action="sw-backup"]', '[data-action^="seg-size"]'])
      assert.strictEqual(await page.locator(sel).count(), 0, sel);
    await noHScroll(page);
    await shoot(page, device);
    assert.deepStrictEqual(page.errors, []);
    await page.context().close();
  });

  test(`settings · ${device} · practice scope view`, async () => {
    const page = await open(browser, device, '#/settings?scope=practice', { seed });
    await page.waitForTimeout(200);
    assert.strictEqual(await page.locator('h1').innerText(), 'Cài đặt luyện');
    assert.strictEqual(await page.locator('.set-subtitle').innerText(), 'Áp dụng cho mọi phiên luyện.');
    assert.deepStrictEqual((await heads(page)).map((s) => s.toUpperCase()), ['NHẮC ÔN', 'PHIÊN LUYỆN']);
    assert.strictEqual(await page.locator('#groq-key').count(), 0);
    assert.strictEqual(await page.title(), 'Cài đặt luyện · VocaLab');
    // v3: the scoped screen hides the navigation (focus layout)
    assert.strictEqual(await page.locator('#nav .nav-item').count(), 0);
    assert.ok(await page.evaluate(() => document.getElementById('app').classList.contains('is-focus')));
    await noHScroll(page);
    await shoot(page, device + '-practice');
    // a control works here too
    await page.click('[data-action="seg-pen"][data-value="10"]');
    assert.strictEqual((await S(page)).pen, 10);
    assert.strictEqual(await page.getAttribute('[data-action="seg-pen"][data-value="10"]', 'aria-checked'), 'true');
    await page.click('.set-back');
    await page.waitForFunction(() => location.hash === '#/practice');
    assert.deepStrictEqual(page.errors, []);
    await page.context().close();
  });

  test(`settings · ${device} · every control persists after reload`, async () => {
    const page = await open(browser, device, '#/settings', { seed });
    await page.fill('#remind', '07:45');
    await page.dispatchEvent('#remind', 'change');
    await page.click('[data-action="step-count"][data-step="1"]'); // 24 → 25 (snaps to step)
    await page.click('[data-action="step-fresh"][data-step="-1"]'); // 10 → 5
    let s = await S(page);
    assert.strictEqual(s.count, 25);
    assert.strictEqual(s.fresh, 5);
    for (let i = 0; i < 12; i++) { const b = page.locator('[data-action="step-count"][data-step="1"]'); if (await b.isDisabled()) break; await b.click(); }
    assert.strictEqual((await S(page)).count, 50);
    assert.ok(await page.locator('[data-action="step-count"][data-step="1"]').isDisabled());
    for (let i = 0; i < 3; i++) { const b = page.locator('[data-action="step-fresh"][data-step="-1"]'); if (await b.isDisabled()) break; await b.click(); }
    assert.strictEqual((await S(page)).fresh, 0);
    await page.click('[data-action="seg-pen"][data-value="30"]');
    await page.click('[data-action="seg-voice"][data-value="us"]');
    // GROQ key
    assert.strictEqual(await page.getAttribute('#groq-key', 'type'), 'password');
    await page.click('[data-action="key-eye"]');
    assert.strictEqual(await page.getAttribute('#groq-key', 'type'), 'text');
    assert.strictEqual(await page.innerText('[data-action="key-eye"]'), 'Ẩn');
    await page.fill('#groq-key', 'gsk_test123');
    await page.locator('#groq-key').blur();
    await page.waitForTimeout(50);

    await reload(page);
    s = await S(page);
    assert.strictEqual(s.remindAt, '07:45');
    assert.strictEqual(await page.inputValue('#remind'), '07:45');
    assert.strictEqual(s.count, 50); assert.strictEqual(s.fresh, 0);
    assert.strictEqual(s.pen, 30); assert.strictEqual(s.voice, 'us');
    assert.strictEqual(s.groqKey, 'gsk_test123');
    assert.strictEqual(await page.inputValue('#groq-key'), 'gsk_test123');
    assert.strictEqual(await page.getAttribute('[data-action="seg-pen"][data-value="30"]', 'aria-checked'), 'true');
    assert.strictEqual(await page.getAttribute('[data-action="seg-voice"][data-value="us"]', 'aria-checked'), 'true');
    // hidden settings keep their defaults
    assert.deepStrictEqual(s.modes, { flash: true, mean: true, fill: true });
    assert.strictEqual(s.sw.backup, true);
    assert.deepStrictEqual(page.errors, []);
    await page.context().close();
  });

  test(`settings · ${device} · theme, notify hint, AI check`, async () => {
    const page = await open(browser, device, '#/settings', { seed });
    await page.click('[data-action="seg-theme"][data-value="dark"]');
    assert.strictEqual(await page.getAttribute('html', 'data-theme'), 'dark');
    await page.click('[data-action="seg-theme"][data-value="light"]');
    assert.strictEqual(await page.getAttribute('html', 'data-theme'), 'light');
    await page.click('[data-action="seg-theme"][data-value="sys"]');
    assert.strictEqual((await S(page)).theme, 'sys');
    await page.click('[data-action="seg-theme"][data-value="dark"]');
    await reload(page);
    assert.strictEqual(await page.getAttribute('html', 'data-theme'), 'dark');
    assert.strictEqual(await page.getAttribute('[data-action="seg-theme"][data-value="dark"]', 'aria-checked'), 'true');

    // notify: off then on → permission requested; denied → muted hint; unsupported → hint
    await page.evaluate(() => {
      window.__req = 0;
      const N = function () {}; N.permission = 'default';
      N.requestPermission = () => { window.__req++; N.permission = 'denied'; return Promise.resolve('denied'); };
      window.Notification = N;
    });
    await page.click('[data-action="sw-notify"]');
    assert.strictEqual((await S(page)).sw.notify, false);
    assert.strictEqual(await page.getAttribute('[data-action="sw-notify"]', 'aria-checked'), 'false');
    await page.click('[data-action="sw-notify"]');
    await page.waitForTimeout(50);
    assert.strictEqual((await S(page)).sw.notify, true);
    assert.strictEqual(await page.evaluate(() => window.__req), 1);
    assert.match(await page.locator('.set-hint').innerText(), /bị chặn/);
    await page.evaluate(() => { delete window.Notification; VL.refresh(); });
    assert.match(await page.locator('.set-hint').innerText(), /không hỗ trợ/);

    // AI check: success then error (mocked network)
    await page.route('https://api.groq.com/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }) }));
    await page.click('[data-action="key-test"]');
    await toast(page, /thành công/);
    await page.unroute('https://api.groq.com/**');
    await page.route('https://api.groq.com/**', (r) => r.fulfill({ status: 401, body: '{}' }));
    await page.click('[data-action="key-test"]');
    await toast(page, /không hợp lệ/);
    assert.ok(await page.locator('#toast.toast-error').count());
    await page.unroute('https://api.groq.com/**');
    assert.deepStrictEqual(page.errors, []);
    await page.context().close();
  });

  test(`settings · ${device} · export, import, reset`, async () => {
    const page = await open(browser, device, '#/settings', { seed });
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-action="export"]')]);
    assert.match(dl.suggestedFilename(), /^vocalab-\d{4}-\d{2}-\d{2}\.json$/);
    const file = path.join(SHOTS, 'export-' + device + '.json');
    await dl.saveAs(file);
    const json = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.strictEqual(json.app, 'VocaLab');
    assert.ok(json.data.progress['comm:mention']);

    const before = await page.evaluate(() => VL.srs.score('comm:mention'));
    assert.ok(before > 0);
    await page.click('[data-action="reset"]');
    await page.click('.sheet [data-r="0"]');
    assert.strictEqual(await page.evaluate(() => VL.srs.score('comm:mention')), before);
    await page.click('[data-action="reset"]');
    await page.click('.sheet [data-r="1"]');
    await toast(page, /Đã đặt lại/);
    const after = await page.evaluate(() => ({ s: VL.srs.score('comm:mention'), all0: Object.values(VL.store.state.progress).every((p) => p.s === 0), kept: !!VL.words.get('mine:albeit') }));
    assert.deepStrictEqual(after, { s: 0, all0: true, kept: true });
    await reload(page);
    assert.strictEqual(await page.evaluate(() => VL.srs.score('comm:mention')), 0);

    json.data.settings.theme = 'dark';
    fs.writeFileSync(file, JSON.stringify(json));
    await page.setInputFiles('#import-file', file);
    await page.click('.sheet [data-r="1"]');
    await toast(page, /Đã nhập/);
    assert.strictEqual(await page.evaluate(() => VL.srs.score('comm:mention')), before);
    assert.strictEqual(await page.getAttribute('html', 'data-theme'), 'dark');
    await reload(page);
    assert.strictEqual(await page.evaluate(() => VL.srs.score('comm:mention')), before);

    const bad = path.join(SHOTS, 'bad-' + device + '.json');
    fs.writeFileSync(bad, '{"nope":1}');
    await page.setInputFiles('#import-file', bad);
    await page.click('.sheet [data-r="1"]');
    await toast(page, /định dạng/);
    fs.unlinkSync(bad); fs.unlinkSync(file);
    assert.deepStrictEqual(page.errors, []);
    await page.context().close();
  });
}
