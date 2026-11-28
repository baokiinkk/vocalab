/* Browser tests for Cài đặt: #/settings (main list), #/settings/<theme|voice|reminder|reset> (sub-screens) and
   #/settings?scope=practice. Run: VL_BASE=file:///Users/baoho/development/english node --test tests/pages/settings.test.js */
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
// waits until the router has actually rendered the route of hash h (not just changed location.hash)
const hashIs = (page, h) => page.waitForFunction((x) => {
  const c = VL.current(); const r = VL.parseHash(x);
  return location.hash === x && c && JSON.stringify([c.params, c.query]) === JSON.stringify([r.params, r.query]) && document.querySelector('#view h1');
}, h);
const heads = (page) => page.locator('.set-h2').allInnerTexts();
const isFocus = (page) => page.evaluate(() => document.getElementById('app').classList.contains('is-focus'));
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
const H1 = { laptop: '32px', ipad: '28px', iphone: '26px' };

for (const device of ['laptop', 'ipad', 'iphone']) {
  test(`settings · ${device} · main list renders per design`, async () => {
    const page = await open(browser, device, '#/settings', { seed });
    await page.waitForTimeout(200);
    assert.strictEqual(await page.locator('h1').innerText(), 'Cài đặt');
    assert.strictEqual(await page.locator('.set-subtitle').innerText(), 'Những gì bạn hay chỉnh nhất.');
    assert.deepStrictEqual((await heads(page)).map((s) => s.toUpperCase()), ['HỌC TẬP', 'WIDGET & MÀN HÌNH KHOÁ', 'CHUNG', 'DỮ LIỆU']);
    assert.strictEqual(await page.locator('.set-back').count(), 0);
    assert.ok(await page.locator('.nav-item.is-active[href="#/settings"]').count() >= 1);
    assert.strictEqual(await page.title(), 'Cài đặt · VocaLab');
    assert.strictEqual(await isFocus(page), false);
    const st = await page.evaluate(() => {
      const cs = (sel) => getComputedStyle(document.querySelector(sel));
      return { h1: cs('h1').fontSize + ' ' + cs('h1').fontWeight, r: cs('.set-group').borderRadius, sh: cs('.set-group').boxShadow, row: cs('.set-crow').minHeight };
    });
    assert.strictEqual(st.h1, H1[device] + ' 800');
    assert.strictEqual(st.r, '16px');
    assert.notStrictEqual(st.sh, 'none');
    assert.strictEqual(st.row, '56px');
    // live values
    assert.strictEqual(await page.innerText('[data-row="reminder"] .set-val'), '20:00 · Mỗi ngày');
    assert.strictEqual(await page.innerText('[data-row="practice"] .set-csub'), '24 từ/phiên · 10 từ mới/ngày · sai −20%');
    assert.strictEqual(await page.innerText('[data-row="voice"] .set-val'), 'Anh-Anh');
    assert.strictEqual(await page.innerText('[data-row="theme"] .set-val'), 'Theo máy');
    // widget / lock screen: greyed, "Sắp có", not links
    const soon = page.locator('.set-crow.is-soon');
    assert.strictEqual(await soon.count(), 3);
    assert.match(await soon.nth(0).innerText(), /Widget màn hình chính[\s\S]*Sắp có/);
    assert.match(await soon.nth(1).innerText(), /Màn hình khoá[\s\S]*Sắp có/);
    // they open preview sub-screens (controls disabled)
    assert.strictEqual(await page.locator('a.set-crow.is-soon[href="#/settings/widget"]').count(), 2);
    assert.strictEqual(await page.locator('a.set-crow.is-soon[href="#/settings/lock"]').count(), 1);
    for (const sel of ['#groq-key', '[data-action="key-test"]', '[data-action="export"]', '[data-action="import"]', '[data-action="restore"]', 'a[href="#/settings/reset"]', '[data-action="sw-notify"]'])
      assert.strictEqual(await page.locator(sel).count(), 1, sel);
    await noHScroll(page);
    await shoot(page, device);
    assert.deepStrictEqual(page.errors, []);
    await page.context().close();
  });

  test(`settings · ${device} · rows navigate to sub-screens (no nav, back link)`, async () => {
    const page = await open(browser, device, '#/settings', { seed });
    const subs = [['reminder', 'Nhắc ôn'], ['voice', 'Giọng phát âm'], ['theme', 'Giao diện'], ['reset', 'Đặt lại tiến độ học']];
    for (const [id, title] of subs) {
      await page.click(`a[href="#/settings/${id}"]`);
      await hashIs(page, '#/settings/' + id);
      assert.strictEqual(await page.locator('h1').innerText(), title);
      assert.strictEqual(await page.title(), title + ' · VocaLab');
      assert.strictEqual(await isFocus(page), true, id + ' focus');
      assert.strictEqual(await page.locator('#nav .nav-item').count(), 0);
      assert.strictEqual(await page.innerText('.set-back'), 'Cài đặt');
      assert.strictEqual(await page.evaluate(() => getComputedStyle(document.querySelector('h1')).fontSize), H1[device]);
      await noHScroll(page);
      await shoot(page, device + '-' + id);
      await page.click('.set-back');
      await hashIs(page, '#/settings');
      assert.strictEqual(await isFocus(page), false);
    }
    // Phiên luyện → Cài đặt luyện, back to Cài đặt
    await page.click('[data-row="practice"]');
    await hashIs(page, '#/settings?scope=practice&from=settings');
    assert.strictEqual(await page.locator('h1').innerText(), 'Cài đặt luyện');
    assert.strictEqual(await page.innerText('.set-back'), 'Cài đặt');
    await page.click('.set-back');
    await hashIs(page, '#/settings');
    // "Sắp có" previews: built, but nothing can be switched on
    for (const [scr, title, n] of [['widget', 'Widget màn hình chính', 3], ['lock', 'Màn hình khoá', 3]]) {
      await page.goto(page.url().split('#')[0] + '#/settings/' + scr);
      await page.waitForFunction((t) => VL.current() && document.querySelector('#view h1') && document.querySelector('#view h1').textContent.trim() === t, title);
      assert.ok(await page.locator('.set-soon-banner').isVisible(), scr + ' banner');
      assert.strictEqual(await page.locator('#nav .nav-item').count(), 0, scr + ' hides nav');
      const sw = page.locator('#view [role="switch"]');
      assert.ok(await sw.count() >= 1, scr + ' has switches');
      for (let i = 0; i < await sw.count(); i++) assert.ok(await sw.nth(i).isDisabled(), scr + ' switch disabled');
      assert.ok((await page.locator('#view [role="radio"]').count()) >= n, scr + ' options');
      for (const b of await page.locator('#view [role="radio"]').all()) assert.ok(await b.isDisabled(), scr + ' option disabled');
      await noHScroll(page);
      await shoot(page, device + '-' + scr);
    }
    await page.goto(page.url().split('#')[0] + '#/settings/nope');
    await page.waitForFunction(() => VL.current() && document.querySelector('#view h1'));
    assert.strictEqual(await page.locator('h1').innerText(), 'Cài đặt');
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
    assert.strictEqual(await page.locator('#nav .nav-item').count(), 0);
    assert.strictEqual(await isFocus(page), true);
    await noHScroll(page);
    await shoot(page, device + '-practice');
    await page.fill('#remind', '07:45');
    await page.dispatchEvent('#remind', 'change');
    await page.click('[data-action="step-count"][data-step="1"]'); // 24 → 25
    await page.click('[data-action="step-fresh"][data-step="-1"]'); // 10 → 5
    await page.click('[data-action="seg-pen"][data-value="10"]');
    for (let i = 0; i < 12; i++) { const b = page.locator('[data-action="step-count"][data-step="1"]'); if (await b.isDisabled()) break; await b.click(); }
    await reload(page);
    const s = await S(page);
    assert.deepStrictEqual([s.remindAt, s.count, s.fresh, s.pen], ['07:45', 50, 5, 10]);
    assert.ok(await page.locator('[data-action="step-count"][data-step="1"]').isDisabled());
    assert.strictEqual(await page.getAttribute('[data-action="seg-pen"][data-value="10"]', 'aria-checked'), 'true');
    await page.click('.set-back');
    await page.waitForFunction(() => location.hash === '#/practice');
    await page.goto(page.url().split('#')[0] + '#/settings');
    await page.waitForFunction(() => VL.current() && document.querySelector('[data-row="practice"]'));
    assert.strictEqual(await page.innerText('[data-row="practice"] .set-csub'), '50 từ/phiên · 5 từ mới/ngày · sai −10%');
    assert.strictEqual(await page.innerText('[data-row="reminder"] .set-val'), '07:45 · Mỗi ngày');
    assert.deepStrictEqual(page.errors, []);
    await page.context().close();
  });

  test(`settings · ${device} · theme sub-screen persists`, async () => {
    const page = await open(browser, device, '#/settings/theme', { seed });
    assert.strictEqual(await page.locator('.set-pick-card').count(), 3);
    assert.strictEqual(await page.getAttribute('[data-action="theme"][data-value="sys"]', 'aria-checked'), 'true');
    await page.click('[data-action="theme"][data-value="dark"]');
    assert.strictEqual(await page.getAttribute('html', 'data-theme'), 'dark');
    assert.strictEqual(await page.getAttribute('[data-action="theme"][data-value="dark"]', 'aria-checked'), 'true');
    await page.click('[data-action="theme"][data-value="light"]');
    assert.strictEqual(await page.getAttribute('html', 'data-theme'), 'light');
    await page.click('[data-action="theme"][data-value="dark"]');
    await reload(page);
    assert.strictEqual((await S(page)).theme, 'dark');
    assert.strictEqual(await page.getAttribute('html', 'data-theme'), 'dark');
    assert.strictEqual(await page.getAttribute('[data-action="theme"][data-value="dark"]', 'aria-checked'), 'true');
    await page.click('.set-back');
    await hashIs(page, '#/settings');
    assert.strictEqual(await page.innerText('[data-row="theme"] .set-val'), 'Tối');
    assert.deepStrictEqual(page.errors, []);
    await page.context().close();
  });

  test(`settings · ${device} · voice sub-screen: accent, speed, auto-read, preview`, async () => {
    const page = await open(browser, device, '#/settings/voice', { seed });
    await page.evaluate(() => {
      window.__said = [];
      window.speechSynthesis.speak = (u) => window.__said.push([u.text, u.lang, u.rate]);
    });
    assert.strictEqual(await page.getAttribute('[data-action="voice"][data-value="uk"]', 'aria-checked'), 'true');
    await page.click('[data-action="voice"][data-value="us"]');
    assert.strictEqual(await page.getAttribute('[data-action="voice"][data-value="us"]', 'aria-checked'), 'true');
    await page.click('[data-action="seg-speed"][data-value="slow"]');
    await page.click('[data-action="sw-autoSpeak"]');
    assert.strictEqual(await page.getAttribute('[data-action="sw-autoSpeak"]', 'aria-checked'), 'false');
    await page.click('[data-action="voice-play"][data-value="uk"]');
    await page.click('[data-action="voice-play"][data-value="us"]');
    // other pages' speak() calls pick up the stored speed and accent too
    await page.evaluate(() => VL.media.speak('apple'));
    const said = await page.evaluate(() => window.__said);
    assert.deepStrictEqual(said.map((x) => x[0] + ' ' + x[1]), ['schedule en-GB', 'schedule en-US', 'apple en-US']);
    assert.ok(said.every((x) => Math.abs(x[2] - 0.7) < 1e-6), 'slow rate ' + JSON.stringify(said));
    await reload(page);
    const s = await S(page);
    assert.deepStrictEqual([s.voice, s.speed, s.sw.autoSpeak, s.sw.auto], ['us', 'slow', false, true]);
    assert.strictEqual(await page.getAttribute('[data-action="seg-speed"][data-value="slow"]', 'aria-checked'), 'true');
    assert.strictEqual(await page.getAttribute('[data-action="voice"][data-value="us"]', 'aria-checked'), 'true');
    await page.click('.set-back');
    await hashIs(page, '#/settings');
    assert.strictEqual(await page.innerText('[data-row="voice"] .set-val'), 'Anh-Mỹ');
    assert.deepStrictEqual(page.errors, []);
    await page.context().close();
  });

  test(`settings · ${device} · reminder sub-screen: time, days, 2nd reminder, notification permission`, async () => {
    const page = await open(browser, device, '#/settings/reminder', { seed });
    assert.match(await page.innerText('.set-notif'), /VocaLab[\s\S]*20:00[\s\S]*từ đang chờ bạn ôn|Đến giờ ôn/);
    assert.strictEqual(await page.locator('[data-action="day"][aria-pressed="true"]').count(), 7);
    await page.fill('#remind', '20:30');
    await page.dispatchEvent('#remind', 'change');
    await page.click('[data-action="day"][data-value="CN"]');
    assert.strictEqual(await page.getAttribute('[data-action="day"][data-value="CN"]', 'aria-pressed'), 'false');
    await page.click('[data-action="sw-again"]');
    assert.strictEqual(await page.getAttribute('[data-action="sw-again"]', 'aria-checked'), 'false');
    // Notification permission is requested only from the switch click; denied/unsupported → hint
    await page.evaluate(() => {
      window.__req = 0;
      const N = function () {}; N.permission = 'default';
      N.requestPermission = () => { window.__req++; N.permission = 'denied'; return Promise.resolve('denied'); };
      window.Notification = N;
    });
    await page.click('[data-action="sw-notify"]');
    assert.strictEqual((await S(page)).sw.notify, false);
    assert.strictEqual(await page.evaluate(() => window.__req), 0);
    await page.click('[data-action="sw-notify"]');
    await page.waitForTimeout(50);
    assert.strictEqual(await page.evaluate(() => window.__req), 1);
    assert.match(await page.locator('.set-hint').innerText(), /bị chặn/);
    await page.evaluate(() => { delete window.Notification; VL.refresh(); });
    assert.match(await page.locator('.set-hint').innerText(), /không hỗ trợ/);

    await reload(page);
    let s = await S(page);
    assert.strictEqual(s.remindAt, '20:30');
    assert.strictEqual(s.freq, 'weekly');
    assert.deepStrictEqual(s.days, { T2: true, T3: true, T4: true, T5: true, T6: true, T7: true });
    assert.strictEqual(s.sw.again, false);
    assert.strictEqual(s.sw.notify, true);
    assert.strictEqual(await page.inputValue('#remind'), '20:30');
    assert.strictEqual(await page.locator('[data-action="day"][aria-pressed="true"]').count(), 6);
    // core reminder logic follows the chosen days
    assert.strictEqual(await page.evaluate(() => VL.reminder.isPracticeDay(new Date(2026, 10, 29))), false); // Sunday
    assert.strictEqual(await page.evaluate(() => VL.reminder.isPracticeDay(new Date(2026, 10, 30))), true); // Monday
    await page.click('.set-back');
    await hashIs(page, '#/settings');
    assert.strictEqual(await page.innerText('[data-row="reminder"] .set-val'), '20:30 · T2–T7');
    // main-list switch toggles the same setting
    await page.click('[data-action="sw-notify"]');
    assert.strictEqual((await S(page)).sw.notify, false);
    // all days back on → daily
    await page.click('[data-row="reminder"]');
    await hashIs(page, '#/settings/reminder');
    await page.click('[data-action="day"][data-value="CN"]');
    s = await S(page);
    assert.strictEqual(s.freq, 'daily');
    assert.deepStrictEqual(page.errors, []);
    await page.context().close();
  });

  test(`settings · ${device} · reset sub-screen (typed + sheet confirm, words kept)`, async () => {
    const page = await open(browser, device, '#/settings/reset', { seed });
    const before = await page.evaluate(() => VL.srs.score('comm:mention'));
    assert.ok(before > 0);
    const n = await page.evaluate(() => VL.srs.overview().total);
    assert.match(await page.innerText('.set-group'), new RegExp('Mức thông thạo của ' + n + ' từ'));
    assert.ok(await page.locator('[data-action="reset"]').isDisabled());
    await page.fill('#reset-confirm', 'dat lai');
    assert.ok(await page.locator('[data-action="reset"]').isDisabled());
    await page.fill('#reset-confirm', 'đặt lại');
    assert.ok(!(await page.locator('[data-action="reset"]').isDisabled()));
    await page.click('[data-action="reset"]');
    await page.click('.sheet [data-r="0"]');
    assert.strictEqual(await page.evaluate(() => VL.srs.score('comm:mention')), before);
    await page.click('[data-action="reset"]');
    await page.click('.sheet [data-r="1"]');
    await toast(page, /Đã đặt lại/);
    await hashIs(page, '#/settings');
    const res = await page.evaluate(() => ({ s: VL.srs.score('comm:mention'), all0: Object.values(VL.store.state.progress).every((p) => p.s === 0), kept: !!VL.words.get('mine:albeit'), streak: VL.srs.streak() }));
    assert.deepStrictEqual(res, { s: 0, all0: true, kept: true, streak: 0 });
    await reload(page);
    assert.strictEqual(await page.evaluate(() => VL.srs.score('comm:mention')), 0);
    assert.ok(await page.evaluate(() => !!VL.words.get('mine:albeit')));
    // Huỷ goes back without changes; field is cleared on re-entry
    await page.click('a[href="#/settings/reset"]');
    await hashIs(page, '#/settings/reset');
    assert.strictEqual(await page.inputValue('#reset-confirm'), '');
    await page.click('.set-cancel');
    await hashIs(page, '#/settings');
    assert.deepStrictEqual(page.errors, []);
    await page.context().close();
  });

  test(`settings · ${device} · GROQ key, AI check, restore defaults`, async () => {
    const page = await open(browser, device, '#/settings', { seed });
    assert.strictEqual(await page.getAttribute('#groq-key', 'type'), 'password');
    await page.click('[data-action="key-eye"]');
    assert.strictEqual(await page.getAttribute('#groq-key', 'type'), 'text');
    assert.strictEqual(await page.innerText('[data-action="key-eye"]'), 'Ẩn');
    await page.fill('#groq-key', 'gsk_test123');
    await page.locator('#groq-key').blur();
    await page.waitForTimeout(50);
    await reload(page);
    assert.strictEqual((await S(page)).groqKey, 'gsk_test123');
    assert.strictEqual(await page.inputValue('#groq-key'), 'gsk_test123');

    await page.route('https://api.groq.com/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }) }));
    await page.click('[data-action="key-test"]');
    await toast(page, /thành công/);
    await page.unroute('https://api.groq.com/**');
    await page.route('https://api.groq.com/**', (r) => r.fulfill({ status: 401, body: '{}' }));
    await page.click('[data-action="key-test"]');
    await toast(page, /không hợp lệ/);
    assert.ok(await page.locator('#toast.toast-error').count());
    await page.unroute('https://api.groq.com/**');

    // restore defaults: settings reset, key + words + progress kept
    await page.evaluate(() => { VL.store.setSetting('theme', 'dark'); VL.store.setSetting('count', 40); VL.store.setSetting('voice', 'us'); });
    const before = await page.evaluate(() => VL.srs.score('comm:mention'));
    await page.click('[data-action="restore"]');
    await page.click('.sheet [data-r="0"]');
    assert.strictEqual((await S(page)).count, 40);
    await page.click('[data-action="restore"]');
    await page.click('.sheet [data-r="1"]');
    await toast(page, /khôi phục/);
    await reload(page);
    const s = await S(page);
    assert.deepStrictEqual([s.theme, s.count, s.voice, s.groqKey], ['sys', 24, 'uk', 'gsk_test123']);
    assert.strictEqual(await page.evaluate(() => VL.srs.score('comm:mention')), before);
    assert.strictEqual(await page.innerText('[data-row="voice"] .set-val'), 'Anh-Anh');
    assert.deepStrictEqual(page.errors, []);
    await page.context().close();
  });

  test(`settings · ${device} · export, import`, async () => {
    const page = await open(browser, device, '#/settings', { seed });
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-action="export"]')]);
    assert.match(dl.suggestedFilename(), /^vocalab-\d{4}-\d{2}-\d{2}\.json$/);
    const file = path.join(SHOTS, 'export-' + device + '.json');
    await dl.saveAs(file);
    const json = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.strictEqual(json.app, 'VocaLab');
    assert.ok(json.data.progress['comm:mention']);
    const before = await page.evaluate(() => VL.srs.score('comm:mention'));
    await page.evaluate(() => VL.srs.resetAll());

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
