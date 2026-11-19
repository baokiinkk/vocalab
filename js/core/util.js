/* VocaLab — core utilities. Classic script (works from file:// and any static host).
   Everything lives on the global namespace window.VL. */
(function () {
  'use strict';
  const VL = (window.VL = window.VL || {});

  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  /** Escape a value for safe insertion into HTML text or attribute. */
  VL.esc = (v) => (v == null ? '' : String(v).replace(/[&<>"']/g, (c) => ESC[c]));

  class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
  /** Mark a string as trusted HTML (will not be escaped by VL.html). */
  VL.raw = (s) => new Raw(s == null ? '' : String(s));

  const part = (v) => {
    if (v == null || v === false) return '';
    if (v instanceof Raw) return v.s;
    if (Array.isArray(v)) return v.map(part).join('');
    return VL.esc(v);
  };
  /** Tagged template: escapes every interpolation except VL.raw(...) values and nested VL.html results.
      Arrays are joined. null/false/undefined render as ''. Returns a Raw (use String(x) for the string). */
  VL.html = (strings, ...vals) => {
    let out = strings[0];
    for (let i = 0; i < vals.length; i++) out += part(vals[i]) + strings[i + 1];
    return new Raw(out);
  };

  /** Local day key YYYY-MM-DD. */
  VL.dayKey = (d) => {
    d = d ? new Date(d) : new Date();
    const m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  };
  VL.DAY = 86400000;
  VL.daysBetween = (aKey, bKey) => Math.round((new Date(bKey + 'T00:00:00') - new Date(aKey + 'T00:00:00')) / VL.DAY);

  const WD = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  /** "Thứ Năm, 19/11" */
  VL.fmtToday = (d) => { d = d || new Date(); return WD[d.getDay()] + ', ' + d.getDate() + '/' + (d.getMonth() + 1); };
  /** Greeting by hour: Chào buổi sáng / chiều / tối */
  VL.greeting = (d) => { const h = (d || new Date()).getHours(); return h < 11 ? 'Chào buổi sáng' : h < 13 ? 'Chào buổi trưa' : h < 18 ? 'Chào buổi chiều' : 'Chào buổi tối'; };
  /** Relative time in Vietnamese: "vừa xong", "5 phút trước", "hôm qua", "3 ngày trước". */
  VL.fmtAgo = (ts) => {
    if (!ts) return '';
    const s = (Date.now() - ts) / 1000;
    if (s < 60) return 'vừa xong';
    if (s < 3600) return Math.floor(s / 60) + ' phút trước';
    const dd = VL.daysBetween(VL.dayKey(ts), VL.dayKey());
    if (dd === 0) return 'hôm nay, ' + VL.fmtTime(ts);
    if (dd === 1) return 'hôm qua';
    if (dd < 30) return dd + ' ngày trước';
    return new Date(ts).toLocaleDateString('vi-VN');
  };
  VL.fmtTime = (ts) => { const d = new Date(ts); const h = d.getHours(), m = d.getMinutes(); return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m; };
  /** Future time in Vietnamese: "hôm nay", "ngày mai", "sau 3 ngày". */
  VL.fmtIn = (ts) => {
    if (!ts) return 'hôm nay';
    const dd = VL.daysBetween(VL.dayKey(), VL.dayKey(ts));
    if (dd <= 0) return 'hôm nay';
    if (dd === 1) return 'ngày mai';
    if (dd < 30) return 'sau ' + dd + ' ngày';
    return 'sau ' + Math.round(dd / 30) + ' tháng';
  };

  VL.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  VL.shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  VL.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  /** Normalised text for matching/search: lower case, trimmed, Vietnamese diacritics removed. */
  VL.norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/\s+/g, ' ').trim();
  /** Stable slug for a word/phrase, used in word keys. */
  VL.slug = (s) => VL.norm(s).replace(/[^a-z0-9' -]/g, '').replace(/\s+/g, '-');
  VL.debounce = (fn, ms) => { let t; return function () { clearTimeout(t); const a = arguments; t = setTimeout(() => fn.apply(this, a), ms); }; };

  /** Page registry (router in app.js). See app.js header for the page contract. */
  VL.pages = VL.pages || {};
  VL.page = (name, def) => { VL.pages[name] = def; };

  /** Tiny event bus. */
  const handlers = {};
  VL.on = (ev, fn) => { (handlers[ev] = handlers[ev] || []).push(fn); return () => { handlers[ev] = handlers[ev].filter((f) => f !== fn); }; };
  VL.emit = (ev, data) => { (handlers[ev] || []).slice().forEach((f) => { try { f(data); } catch (e) { console.error('[VL] handler error', ev, e); } }); };

  /** Safe localStorage wrappers. */
  VL.ls = {
    get(k, fallback) { try { const v = localStorage.getItem(k); return v == null ? fallback : JSON.parse(v); } catch (e) { return fallback; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { console.warn('[VL] localStorage write failed', e); return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  };
})();
