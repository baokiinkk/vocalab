/* VocaLab — pronunciation (Web Speech API) and word images.
   Images: Wikipedia page thumbnail first (good for concrete nouns), then Openverse (CC images), cached in localStorage.
   A user-provided image URL on the word (w.img) always wins. Abstract words often have no image → callers show a placeholder. */
(function () {
  'use strict';
  const VL = window.VL;
  const IMG_KEY = 'vocalab.imgcache';
  const imgCache = VL.ls.get(IMG_KEY, {});
  const pending = {};

  let voices = [];
  const loadVoices = () => { try { voices = window.speechSynthesis ? speechSynthesis.getVoices() : []; } catch (e) { voices = []; } };
  if (window.speechSynthesis) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }

  const media = (VL.media = {
    canSpeak() { return !!window.speechSynthesis; },
    /** Speak English text. accent: 'uk' | 'us' (default from settings). rate 0.5..1.2 */
    speak(text, accent, rate) {
      if (!window.speechSynthesis || !text) return false;
      accent = accent || VL.store.settings().voice;
      const lang = accent === 'us' ? 'en-US' : 'en-GB';
      try {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = lang;
        u.rate = rate || 0.92;
        if (!voices.length) loadVoices();
        const v = voices.find((x) => x.lang === lang) || voices.find((x) => x.lang && x.lang.replace('_', '-').startsWith(lang)) || voices.find((x) => /^en/i.test(x.lang));
        if (v) u.voice = v;
        speechSynthesis.speak(u);
        return true;
      } catch (e) { return false; }
    },
    /** Resolve an image URL for a word object (or null). Cached; concurrent calls share one request. */
    image(w) {
      if (!w) return Promise.resolve(null);
      if (w.img) return Promise.resolve(w.img);
      const term = String(w.w || '').trim().toLowerCase();
      if (!term) return Promise.resolve(null);
      if (Object.prototype.hasOwnProperty.call(imgCache, term)) return Promise.resolve(imgCache[term]);
      if (pending[term]) return pending[term];
      const p = (async () => {
        let url = null;
        // Skip abstract parts of speech for Wikipedia; it tends to return unrelated pages.
        const concrete = !w.pos || w.pos === 'n' || w.pos === 'exp';
        if (concrete) url = await media.wikiThumb(term);
        if (!url) url = await media.openverse(term + (w.pos === 'n' || !w.pos ? '' : ' ' + (w.def || '').split(' ').slice(0, 2).join(' ')));
        imgCache[term] = url || null;
        const keys = Object.keys(imgCache);
        if (keys.length > 2000) delete imgCache[keys[0]];
        VL.ls.set(IMG_KEY, imgCache);
        delete pending[term];
        return url || null;
      })().catch(() => { delete pending[term]; return null; });
      pending[term] = p;
      return p;
    },
    async wikiThumb(term) {
      try {
        const r = await fetch('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(term.replace(/\s+/g, '_')), { headers: { Accept: 'application/json' } });
        if (!r.ok) return null;
        const j = await r.json();
        if (j.type === 'disambiguation') return null;
        return (j.thumbnail && j.thumbnail.source) || null;
      } catch (e) { return null; }
    },
    async openverse(q) {
      try {
        const r = await fetch('https://api.openverse.org/v1/images/?page_size=3&mature=false&q=' + encodeURIComponent(q.trim()));
        if (!r.ok) return null;
        const j = await r.json();
        const hit = (j.results || []).find((x) => x.thumbnail || x.url);
        return hit ? hit.thumbnail || hit.url : null;
      } catch (e) { return null; }
    },
    /** Read an image File (from <input type=file>) and return a small JPEG data URL (max side `max` px, default 480)
        so it fits in localStorage. Rejects non-images. */
    fileToDataURL(file, max) {
      max = max || 480;
      return new Promise((resolve, reject) => {
        if (!file || !/^image\//.test(file.type)) { reject(new Error('Chỉ chọn được file ảnh.')); return; }
        const fr = new FileReader();
        fr.onerror = () => reject(new Error('Không đọc được ảnh.'));
        fr.onload = () => {
          const img = new Image();
          img.onerror = () => reject(new Error('Ảnh không hợp lệ.'));
          img.onload = () => {
            const k = Math.min(1, max / Math.max(img.width, img.height));
            const c = document.createElement('canvas');
            c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
            c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
            resolve(c.toDataURL('image/jpeg', 0.82));
          };
          img.src = fr.result;
        };
        fr.readAsDataURL(file);
      });
    },
    /** Forget the cached image for a word (e.g. after the user edits it). */
    forget(term) { delete imgCache[String(term || '').trim().toLowerCase()]; VL.ls.set(IMG_KEY, imgCache); },
    /** Fill every <img data-word-img="KEY"> / [data-word-img] placeholder inside root with the word image.
        Markup: VL.ui.wordImage(key, cls) generates it. */
    hydrate(root) {
      (root || document).querySelectorAll('[data-word-img]:not([data-hydrated])').forEach((el) => {
        el.setAttribute('data-hydrated', '1');
        const w = VL.words.get(el.getAttribute('data-word-img'));
        media.image(w).then((url) => {
          if (!url || !el.isConnected) { el.classList.add('is-empty'); return; }
          const img = new Image();
          img.alt = w ? 'Hình minh hoạ cho “' + w.w + '”' : '';
          img.loading = 'lazy';
          img.referrerPolicy = 'no-referrer';
          img.onload = () => { el.classList.add('is-loaded'); };
          img.onerror = () => { el.classList.add('is-empty'); img.remove(); };
          img.src = url;
          el.appendChild(img);
        });
      });
    }
  });
})();
