/* Seed data for browser tests. Use: open(browser, device, hash, { seed: require('./fixtures').seed })
   The function runs INSIDE the page (no closures). It registers fallback deck rows when the real
   data files are not there yet, adds custom words and realistic progress/history. */
exports.seed = function (VL) {
  if (!VL.decks.get('comm').n) VL.registerDeck('comm', [
    ['appreciate', 'v', '/əˈpriːʃieɪt/', 'trân trọng, cảm kích', 'I really appreciate your help.', 'Tôi rất cảm kích sự giúp đỡ của bạn.', 'A2'],
    ['suggest', 'v', '/səˈdʒest/', 'gợi ý, đề xuất', 'I suggest we leave early.', 'Tôi đề xuất chúng ta đi sớm.', 'A2'],
    ['mention', 'v', '/ˈmenʃn/', 'nhắc đến', 'She mentioned your name.', 'Cô ấy nhắc đến tên bạn.', 'A2'],
    ['actually', 'adv', '/ˈæktʃuəli/', 'thật ra', 'Actually, I like it.', 'Thật ra tôi thích nó.', 'A2'],
    ['awkward', 'adj', '/ˈɔːkwəd/', 'ngượng ngùng, khó xử', 'It was an awkward silence.', 'Đó là một sự im lặng khó xử.', 'B1'],
    ['apple', 'n', '/ˈæpl/', 'quả táo', 'She ate an apple.', 'Cô ấy ăn một quả táo.', 'A1']
  ]);
  if (!VL.decks.get('ielts').n) VL.registerDeck('ielts', [
    ['analyse', 'v', '/ˈænəlaɪz/', 'phân tích', 'We analysed the data.', 'Chúng tôi đã phân tích dữ liệu.', 'B2'],
    ['significant', 'adj', '/sɪɡˈnɪfɪkənt/', 'đáng kể', 'There was a significant increase.', 'Đã có một sự gia tăng đáng kể.', 'B2'],
    ['assume', 'v', '/əˈsjuːm/', 'giả định', 'Let us assume it is true.', 'Hãy giả định điều đó đúng.', 'B2'],
    ['derive', 'v', '/dɪˈraɪv/', 'bắt nguồn, thu được', 'The word derives from Latin.', 'Từ này bắt nguồn từ tiếng Latinh.', 'C1'],
    ['allocate', 'v', '/ˈæləkeɪt/', 'phân bổ', 'Funds were allocated to schools.', 'Quỹ đã được phân bổ cho các trường.', 'C1']
  ]);
  const mk = (w, vi, extra) => VL.words.save(Object.assign({ w, vi }, extra || {}));
  const met = mk('meticulous', 'tỉ mỉ, kỹ lưỡng; cẩn thận đến từng chi tiết', { pos: 'adj', ipa: '/məˈtɪkjələs/', ipaUs: '/məˈtɪkjələs/', cefr: 'C1', def: 'showing very careful attention to every detail',
    examples: [{ en: 'She keeps meticulous records of every expense.', vi: 'Cô ấy ghi chép tỉ mỉ mọi khoản chi tiêu.' }, { en: 'The plan was the result of meticulous preparation.', vi: 'Kế hoạch là kết quả của sự chuẩn bị kỹ lưỡng.' }],
    gram: 'be meticulous about / in + N / V-ing\nmeticulous attention to detail', syn: ['thorough', 'painstaking', 'precise'], ant: ['careless', 'sloppy'], note: 'Nhấn âm 2: me-TIC-u-lous.' });
  mk('albeit', 'mặc dù, dẫu cho', { pos: 'conj', ipa: '/ɔːlˈbiːɪt/' });
  mk('ubiquitous', 'có mặt ở khắp nơi', { pos: 'adj', ipa: '/juːˈbɪkwɪtəs/' });
  mk('reluctant', 'miễn cưỡng', { pos: 'adj', ipa: '/rɪˈlʌktənt/' });
  mk('resilient', 'kiên cường, mau phục hồi', { pos: 'adj', ipa: '/rɪˈzɪliənt/' });
  mk('deadline', 'hạn chót', { pos: 'n', ipa: '/ˈdedlaɪn/', examples: [{ en: 'The deadline is Friday.', vi: 'Hạn chót là thứ Sáu.' }] });
  const set = (key, n, ok) => { for (let i = 0; i < n; i++) VL.srs.record(key, ok !== false, i % 2 ? 'mean' : 'flash'); };
  set(met, 1); set('mine:ubiquitous', 2); set('mine:reluctant', 3); set('mine:resilient', 5); set('mine:deadline', 9);
  set('comm:appreciate', 5); set('comm:suggest', 7); set('comm:mention', 10); set('comm:awkward', 3);
  set('ielts:analyse', 4); set('ielts:significant', 7); set('ielts:assume', 2); set('ielts:derive', 1);
  VL.srs.record(met, false, 'mean');
  // make some words due (pretend last practice was days ago)
  ['comm:appreciate', 'ielts:assume', 'mine:reluctant', 'comm:awkward'].forEach((k) => { const p = VL.srs.progress(k); if (p) p.t -= 3 * VL.DAY; });
  VL.store.state.settings.groqKey = VL.store.state.settings.groqKey || 'gsk_test_fixture'; // AI calls are mocked in tests
  VL.store.state.streak = { count: 12, last: VL.dayKey(Date.now() - VL.DAY), best: 12 };
  VL.store.save();
};
