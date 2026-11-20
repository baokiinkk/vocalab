/* VocaLab — AI suggestions via Groq (OpenAI-compatible chat API, called straight from the browser).
   v1 has no server, so the key lives in Settings (default: the trial key in store.js). */
(function () {
  'use strict';
  const VL = window.VL;
  const URL = 'https://api.groq.com/openai/v1/chat/completions';
  const CACHE_KEY = 'vocalab.aicache';
  const cache = VL.ls.get(CACHE_KEY, {});
  const FALLBACK_MODEL = 'openai/gpt-oss-120b';
  VL.on('quota', () => { Object.keys(cache).forEach((k) => { delete cache[k]; }); });

  const ai = (VL.ai = {
    hasKey() { return !!(VL.store.settings().groqKey || '').trim(); },
    /** Low level: send chat messages, return the parsed JSON object from the reply. */
    async chatJSON(messages, opts) {
      opts = opts || {};
      const set = VL.store.settings();
      let key = (set.groqKey || '').trim();
      if (!key && !opts.noPrompt) key = await ai.promptKey();
      if (!key) throw new Error('Chưa có GROQ API key. Vào Cài đặt → nhập GROQ API key.');
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), opts.timeout || 25000);
      let res;
      try {
        res = await fetch(URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
          body: JSON.stringify(Object.assign({ model: set.groqModel || FALLBACK_MODEL, messages, temperature: opts.temperature == null ? 0.3 : opts.temperature }, opts._plain ? {} : { response_format: { type: 'json_object' } })),
          signal: ctrl.signal
        });
      } catch (e) {
        throw new Error(e.name === 'AbortError' ? 'AI phản hồi quá lâu (quá 25 giây), thử lại nhé.' : 'Không kết nối được tới Groq (api.groq.com). Kiểm tra mạng, VPN hoặc trình chặn quảng cáo rồi thử lại.');
      } finally { clearTimeout(timer); }
      if (res.status === 404 && !opts._fallback && set.groqModel !== FALLBACK_MODEL) {
        // the saved model was removed by Groq: fall back to the default model and remember it
        VL.store.setSetting('groqModel', FALLBACK_MODEL);
        return ai.chatJSON(messages, { ...opts, _fallback: true });
      }
      if (!res.ok) {
        // Groq returns {error:{message,type,code}} — surface it so the user sees the real cause.
        let detail = '';
        try { const j = await res.json(); detail = (j && j.error && (j.error.message || j.error.code)) || ''; } catch (e) { /* not JSON */ }
        if (res.status === 400 && !opts._plain && /json/i.test(detail)) {
          // JSON mode occasionally rejects a reply: retry once without response_format.
          return ai.chatJSON(messages, { ...opts, _plain: true });
        }
        let msg;
        if (res.status === 401) msg = 'GROQ API key không hợp lệ hoặc đã bị thu hồi (401). Vào Cài đặt → nhập key mới rồi bấm “Kiểm tra”.';
        else if (res.status === 403) msg = 'Groq từ chối truy cập (403) — key không có quyền hoặc bị chặn theo khu vực.';
        else if (res.status === 404) msg = 'Model AI “' + (set.groqModel || FALLBACK_MODEL) + '” không còn trên Groq (404).';
        else if (res.status === 413) msg = 'Yêu cầu gửi AI quá dài (413).';
        else if (res.status === 429) msg = 'Đã hết lượt gọi AI miễn phí tạm thời (429). Thử lại sau ít phút.';
        else if (res.status >= 500) msg = 'Máy chủ Groq đang lỗi (' + res.status + '). Thử lại sau.';
        else msg = 'AI lỗi (' + res.status + ').';
        if (detail) msg += ' Chi tiết: ' + String(detail).slice(0, 160);
        console.warn('[VL] Groq error', res.status, detail);
        throw new Error(msg);
      }
      const data = await res.json();
      const text = data && data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : '';
      try { return JSON.parse(text); } catch (e) {
        const m = String(text).match(/\{[\s\S]*\}/);
        if (m) return JSON.parse(m[0]);
        throw new Error('AI trả về dữ liệu không đúng định dạng JSON. Bấm gợi ý lại nhé.');
      }
    },
    /** Ask the user for a GROQ key in a small sheet (no native prompt). Resolves to the saved key or '' if cancelled. */
    promptKey() {
      return new Promise((resolve) => {
        if (typeof document === 'undefined' || !document.body || !document.body.appendChild) { resolve(''); return; }
        const wrap = document.createElement('div');
        wrap.className = 'sheet-backdrop';
        wrap.innerHTML = String(VL.html`<form class="sheet" role="dialog" aria-modal="true" aria-labelledby="key-t">
          <h2 id="key-t" class="sheet-title">Nhập GROQ API key</h2>
          <p class="sheet-body">Tính năng AI cần key của bạn. Key chỉ lưu trong trình duyệt này. Lấy key miễn phí tại <a href="https://console.groq.com/keys" target="_blank" rel="noopener">console.groq.com/keys</a>.</p>
          <label class="field"><span class="field-label">GROQ API key</span><input id="key-input" class="input" type="password" autocomplete="off" spellcheck="false" placeholder="gsk_…" required></label>
          <div class="sheet-actions"><button type="button" class="btn btn-ghost" data-r="0">Huỷ</button><button type="submit" class="btn btn-primary">Lưu key</button></div>
        </form>`);
        const input = wrap.querySelector('#key-input');
        const done = (v) => { document.removeEventListener('keydown', onKey); wrap.remove(); resolve(v); };
        const onKey = (e) => { if (e.key === 'Escape') done(''); };
        wrap.querySelector('form').addEventListener('submit', (e) => {
          e.preventDefault();
          const v = input.value.trim();
          if (!v) { input.focus(); return; }
          VL.store.setSetting('groqKey', v);
          VL.ui.toast('Đã lưu GROQ API key');
          done(v);
        });
        wrap.addEventListener('click', (e) => { if (e.target.closest('[data-r="0"]') || e.target === wrap) done(''); });
        document.addEventListener('keydown', onKey);
        document.body.appendChild(wrap);
        input.focus();
      });
    },
    /** Suggest fields for a word. section: 'basic' | 'ex' | 'more' | 'all'.
        Resolves to {w, pos, ipa, ipaUs, vi, def, cefr, examples:[{en,vi}], gram, syn:[], ant:[], note}. Cached per word+section. */
    async suggest(word, section, ctx) {
      word = String(word || '').trim();
      if (!word) throw new Error('Nhập từ trước khi gợi ý.');
      section = section || 'all';
      const set = VL.store.settings();
      const ck = [VL.norm(word), section, set.exn, set.lang].join('|');
      if (cache[ck]) return JSON.parse(JSON.stringify(cache[ck]));
      const explain = set.lang === 'en' ? 'English' : 'Vietnamese';
      const want = {
        basic: '"pos" (one of n,v,adj,adv,phr,idiom,prep,conj,pron,det,int,exp), "ipa" (British IPA in slashes), "ipaUs" (American IPA in slashes), "vi" (concise Vietnamese meaning, 1-2 senses comma separated), "def" (short English definition), "cefr" (A1..C2)',
        ex: '"examples": array of exactly ' + set.exn + ' objects {"en": natural example sentence containing the word, "vi": Vietnamese translation}',
        more: '"gram" (grammar patterns & common collocations, 1-3 short lines separated by \\n, notes in ' + explain + '), "syn" (array of up to 4 synonyms), "ant" (array of up to 3 antonyms, may be empty), "note" (one short learning tip in ' + explain + ': stress, common mistake, or usage)'
      };
      const fields = section === 'all' ? [want.basic, want.ex, want.more].join(', ') : want[section];
      const messages = [
        { role: 'system', content: 'You are an expert English teacher for Vietnamese learners. Reply ONLY with a JSON object. Be accurate; Vietnamese must have correct diacritics.' },
        { role: 'user', content: 'English word or phrase: "' + word + '"' + (ctx && ctx.vi ? ' (meaning the learner has in mind: "' + ctx.vi + '")' : '') + '. Return JSON with keys: ' + fields + '.' }
      ];
      // ctx.silent: background/automatic calls never open the key prompt (they just fail quietly without a key)
      const out = await ai.chatJSON(messages, { noPrompt: !!(ctx && ctx.silent) });
      const norm = ai.normalize(out);
      cache[ck] = norm;
      const keys = Object.keys(cache);
      if (keys.length > 300) delete cache[keys[0]];
      VL.ls.set(CACHE_KEY, cache);
      return JSON.parse(JSON.stringify(norm));
    },
    /** Coerce an AI reply into the word shape. */
    normalize(o) {
      o = o || {};
      const arr = (v) => (Array.isArray(v) ? v : typeof v === 'string' && v ? v.split(/[,;]/) : []).map((x) => String(x).trim()).filter(Boolean);
      const slash = (v) => { v = String(v || '').trim(); if (!v) return ''; return /^\/.*\/$/.test(v) ? v : '/' + v.replace(/^\/|\/$/g, '') + '/'; };
      const out = {};
      if (o.pos) out.pos = String(o.pos).toLowerCase().replace(/\.$/, '');
      if (o.ipa) out.ipa = slash(o.ipa);
      if (o.ipaUs) out.ipaUs = slash(o.ipaUs);
      if (o.vi) out.vi = String(o.vi).trim();
      if (o.def) out.def = String(o.def).trim();
      if (o.cefr) out.cefr = String(o.cefr).toUpperCase().trim();
      if (Array.isArray(o.examples)) out.examples = o.examples.map((e) => (typeof e === 'string' ? { en: e, vi: '' } : { en: String(e.en || '').trim(), vi: String(e.vi || '').trim() })).filter((e) => e.en);
      if (o.gram) out.gram = Array.isArray(o.gram) ? o.gram.join('\n') : String(o.gram).trim();
      if (o.syn) out.syn = arr(o.syn);
      if (o.ant) out.ant = arr(o.ant);
      if (o.note) out.note = String(o.note).trim();
      return out;
    },
    /** Merge AI fields into a form object, filling ONLY empty fields (never overwrite what the user typed). */
    fillEmpty(target, sugg) {
      const out = { ...target };
      Object.keys(sugg).forEach((k) => {
        const cur = out[k];
        const empty = cur == null || cur === '' || (Array.isArray(cur) && (!cur.length || (k === 'examples' && !cur.some((e) => e && e.en))));
        if (empty) out[k] = sugg[k];
      });
      return out;
    }
  });
})();
