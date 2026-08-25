/* أدوات عامة: التواريخ، التنسيق، المعرّفات */
(function (global) {
  'use strict';

  const WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const WEEKDAYS_SHORT = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
  const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
                  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /* --- التواريخ (نتعامل مع نص YYYY-MM-DD بتوقيت محلي) --- */
  function pad(n) { return String(n).padStart(2, '0'); }

  function toISO(date) {
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  }

  function parseISO(iso) {
    const p = String(iso).split('-').map(Number);
    return new Date(p[0], (p[1] || 1) - 1, p[2] || 1);
  }

  function today() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function todayISO() { return toISO(today()); }

  function addDays(iso, n) {
    const d = parseISO(iso);
    d.setDate(d.getDate() + n);
    return toISO(d);
  }

  function diffDays(isoA, isoB) {
    return Math.round((parseISO(isoA) - parseISO(isoB)) / 86400000);
  }

  function monthKey(iso) { return String(iso).slice(0, 7); }          // YYYY-MM
  function startOfMonth(mk) { return mk + '-01'; }
  function endOfMonth(mk) {
    const p = mk.split('-').map(Number);
    return toISO(new Date(p[0], p[1], 0));
  }
  function shiftMonth(mk, n) {
    const p = mk.split('-').map(Number);
    const d = new Date(p[0], p[1] - 1 + n, 1);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1);
  }
  function monthLabel(mk) {
    const p = mk.split('-').map(Number);
    return MONTHS[p[1] - 1] + ' ' + p[0];
  }

  /* بداية أسبوع العمل في السعودية: الأحد */
  function startOfWeek(iso) {
    const d = parseISO(iso);
    return addDays(iso, -d.getDay());
  }

  function weekdayOf(iso) { return parseISO(iso).getDay(); }

  function hijri(iso) {
    try {
      return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', {
        day: 'numeric', month: 'long', year: 'numeric'
      }).format(parseISO(iso));
    } catch (e) { return ''; }
  }

  function fmtDate(iso, opts) {
    const d = parseISO(iso);
    const long = opts && opts.long;
    const base = WEEKDAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()];
    return long ? base + ' ' + d.getFullYear() : base;
  }

  function fmtRelative(iso) {
    const n = diffDays(iso, todayISO());
    if (n === 0) return 'اليوم';
    if (n === 1) return 'غدًا';
    if (n === 2) return 'بعد يومين';
    if (n === -1) return 'أمس';
    if (n < 0) return 'متأخرة ' + Math.abs(n) + ' يوم';
    if (n <= 7) return 'بعد ' + n + ' أيام';
    return fmtDate(iso);
  }

  function fmtTime(hhmm) {
    if (!hhmm) return '';
    const p = hhmm.split(':').map(Number);
    const h = p[0], m = p[1] || 0;
    const suffix = h < 12 ? 'ص' : 'م';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return h12 + ':' + pad(m) + ' ' + suffix;
  }

  function timeRange(start, end) {
    if (!start) return 'طوال اليوم';
    return end ? fmtTime(start) + ' – ' + fmtTime(end) : fmtTime(start);
  }

  function minutesBetween(start, end) {
    if (!start || !end) return 0;
    const a = start.split(':').map(Number), b = end.split(':').map(Number);
    return Math.max(0, (b[0] * 60 + b[1]) - (a[0] * 60 + a[1]));
  }

  function money(n, currency) {
    const v = Number(n || 0);
    return v.toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' ' + (currency || 'ر.س');
  }

  function pct(a, b) { return b ? Math.round((a / b) * 100) : 0; }

  function escapeHTML(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }


  /* صياغة الجمع بالعربية: ١ مفرد، ٢ مثنى، ٣-١٠ جمع، ١١+ تمييز مفرد منصوب */
  const WORDS = {
    task:  { one: 'مهمة واحدة',  two: 'مهمتان',  few: 'مهام',    many: 'مهمة' },
    event: { one: 'موعد واحد',   two: 'موعدان',  few: 'مواعيد',  many: 'موعدًا' },
    hour:  { one: 'ساعة واحدة',  two: 'ساعتان',  few: 'ساعات',   many: 'ساعة' },
    ctx:   { one: 'مجال واحد',   two: 'مجالان',  few: 'مجالات',  many: 'مجالًا' },
    day:   { one: 'يوم واحد',    two: 'يومان',   few: 'أيام',    many: 'يومًا' },
    work:  { one: 'عمل واحد',    two: 'عملان',   few: 'أعمال',   many: 'عملًا' }
  };

  function count(n, kind) {
    const f = WORDS[kind] || WORDS.task;
    n = Number(n) || 0;
    if (n === 1) return f.one;
    if (n === 2) return f.two;
    if (n >= 3 && n <= 10) return n + ' ' + f.few;
    return n + ' ' + f.many;
  }

  function nowHHMM() {
    const d = new Date();
    return pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  global.U = {
    WEEKDAYS, WEEKDAYS_SHORT, MONTHS,
    uid, pad, toISO, parseISO, today, todayISO, addDays, diffDays,
    monthKey, startOfMonth, endOfMonth, shiftMonth, monthLabel,
    startOfWeek, weekdayOf, hijri, fmtDate, fmtRelative, fmtTime, timeRange,
    minutesBetween, money, pct, escapeHTML, nowHHMM, count
  };
})(window);
