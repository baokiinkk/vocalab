/* Loads the VocaLab core scripts into Node with a localStorage shim, for unit tests. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
module.exports = function loadCore(opts) {
  opts = opts || {};
  const mem = {};
  const ctx = {
    console, setTimeout, clearTimeout, setInterval, clearInterval, Date, Math, JSON, Promise, URL, Blob: function () {},
    localStorage: { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } },
    fetch: opts.fetch || (async () => { throw new Error('offline'); }),
    AbortController, navigator: {}, document: { readyState: 'complete', addEventListener() {}, getElementById() { return null; }, createElement() { return {}; } },
    location: { hash: '' }, history: {}, addEventListener() {}, innerWidth: 1440, matchMedia: () => ({ matches: false, addEventListener() {} })
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  const root = path.join(__dirname, '..');
  const files = ['util', 'store', 'decks', 'srs', 'session', 'ai', 'media', 'ui'].map((f) => 'js/core/' + f + '.js');
  (opts.decks || []).forEach((d) => files.push('data/decks/' + d + '.js'));
  files.forEach((f) => vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f }));
  if (opts.seed !== false) {
    ctx.VL.registerDeck('comm', [
      ['appreciate', 'v', '/əˈpriːʃieɪt/', 'trân trọng, cảm kích', 'I really appreciate your help.', 'Tôi rất cảm kích sự giúp đỡ của bạn.', 'A2'],
      ['suggest', 'v', '/səˈdʒest/', 'gợi ý, đề xuất', 'I suggest we leave early.', 'Tôi đề xuất chúng ta đi sớm.', 'A2'],
      ['mention', 'v', '/ˈmenʃn/', 'nhắc đến', 'She mentioned your name.', 'Cô ấy nhắc đến tên bạn.', 'A2'],
      ['actually', 'adv', '/ˈæktʃuəli/', 'thật ra', 'Actually, I like it.', 'Thật ra tôi thích nó.', 'A2'],
      ['awkward', 'adj', '/ˈɔːkwəd/', 'ngượng ngùng, khó xử', 'It was an awkward silence.', 'Đó là một sự im lặng khó xử.', 'B1']
    ]);
    ctx.VL.registerDeck('ielts', [
      ['analyse', 'v', '/ˈænəlaɪz/', 'phân tích', 'We analysed the data.', 'Chúng tôi đã phân tích dữ liệu.', 'B2'],
      ['assume', 'v', '/əˈsjuːm/', 'giả định', 'Let us assume it is true.', 'Hãy giả định điều đó đúng.', 'B2'],
      ['derive', 'v', '/dɪˈraɪv/', 'bắt nguồn, thu được', 'The word derives from Latin.', 'Từ này bắt nguồn từ tiếng Latinh.', 'C1']
    ]);
  }
  ctx.VL.go = (h) => { ctx.location.hash = h; };
  return ctx;
};
