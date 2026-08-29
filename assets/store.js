/* طبقة البيانات: التخزين المحلي + العمليات على المجالات والأحداث والمهام */
(function (global) {
  'use strict';

  const KEY = 'myself.data.v1';

  const DEFAULT_CONTEXTS = [
    { id: 'ctx_watad',   name: 'فريق وتد التربوي',        color: '#2563eb', icon: '🧭', role: 'مدير الفريق' },
    { id: 'ctx_masjid',  name: 'جامع بدر الراجحي',        color: '#0d9488', icon: '🕌', role: 'مدير الشؤون التعليمية' },
    { id: 'ctx_uni',     name: 'الجامعة',                  color: '#7c3aed', icon: '🎓', role: 'طالب' },
    { id: 'ctx_aqar',    name: 'دوام العقار',              color: '#b45309', icon: '🏢', role: 'دوام' },
    { id: 'ctx_photo',   name: 'جلسات التصوير',            color: '#db2777', icon: '📸', role: 'مصوّر' },
    { id: 'ctx_jam',     name: 'الجمعية',                  color: '#059669', icon: '💼', role: 'مدير تقني' },
    { id: 'ctx_amlak',   name: 'إدارة الأملاك العقارية',   color: '#dc2626', icon: '🔑', role: 'مدير أملاك' },
    { id: 'ctx_personal',name: 'شخصي وعائلي',              color: '#475569', icon: '🏠', role: '' }
  ];

  const EVENT_TYPES = [
    { id: 'meeting', name: 'اجتماع',        icon: '👥' },
    { id: 'session', name: 'جلسة تصوير',    icon: '📸' },
    { id: 'exam',    name: 'اختبار',        icon: '📝' },
    { id: 'lecture', name: 'محاضرة',        icon: '🎓' },
    { id: 'shift',   name: 'دوام',          icon: '🏢' },
    { id: 'deadline',name: 'تسليم / بحث',   icon: '⏳' },
    { id: 'visit',   name: 'زيارة / معاينة',icon: '🚗' },
    { id: 'other',   name: 'موعد آخر',      icon: '📌' }
  ];

  const PRIORITIES = [
    { id: 'high', name: 'عالية', color: '#dc2626' },
    { id: 'mid',  name: 'متوسطة', color: '#d97706' },
    { id: 'low',  name: 'منخفضة', color: '#64748b' }
  ];

  function emptyData() {
    return {
      version: 1,
      settings: {
        name: '',
        currency: 'ر.س',
        theme: 'auto',
        lastSeenMonth: U.monthKey(U.todayISO())
      },
      contexts: DEFAULT_CONTEXTS.map(function (c) { return Object.assign({}, c); }),
      events: [],
      tasks: [],
      reports: []   // تقارير الشهور المؤرشفة
    };
  }

  let data = emptyData();
  const listeners = [];

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        data = Object.assign(emptyData(), parsed);
        data.settings = Object.assign(emptyData().settings, parsed.settings || {});
        if (!Array.isArray(data.contexts) || !data.contexts.length) data.contexts = emptyData().contexts;
      }
    } catch (e) {
      console.warn('تعذّر قراءة البيانات المحفوظة', e);
    }
    return data;
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {
      console.error('تعذّر الحفظ', e);
    }
    listeners.forEach(function (fn) { fn(data); });
  }

  function onChange(fn) { listeners.push(fn); }

  /* ---------- المجالات ---------- */
  function contexts() { return data.contexts; }
  function context(id) {
    return data.contexts.find(function (c) { return c.id === id; }) ||
           { id: id, name: 'بدون مجال', color: '#94a3b8', icon: '•' };
  }
  function saveContext(ctx) {
    if (ctx.id) {
      const i = data.contexts.findIndex(function (c) { return c.id === ctx.id; });
      if (i > -1) { data.contexts[i] = Object.assign(data.contexts[i], ctx); save(); return data.contexts[i]; }
    }
    ctx.id = ctx.id || U.uid('ctx');
    data.contexts.push(ctx);
    save();
    return ctx;
  }
  function deleteContext(id) {
    data.contexts = data.contexts.filter(function (c) { return c.id !== id; });
    save();
  }

  /* ---------- الأحداث ---------- */
  function events() { return data.events; }
  function event(id) { return data.events.find(function (e) { return e.id === id; }); }

  function saveEvent(ev) {
    if (ev.id && event(ev.id)) {
      Object.assign(event(ev.id), ev, { updatedAt: Date.now() });
    } else {
      ev.id = ev.id || U.uid('ev');
      ev.createdAt = Date.now();
      ev.occ = ev.occ || {};
      data.events.push(ev);
    }
    save();
    return ev;
  }

  function deleteEvent(id) {
    data.events = data.events.filter(function (e) { return e.id !== id; });
    save();
  }

  /* توليد مرات التكرار داخل مدى زمني.
     يرجع كائنات "occurrence" = { ...event, date, occId, status, paid } */
  function occurrencesBetween(fromISO, toISO_) {
    const out = [];
    data.events.forEach(function (ev) {
      recurDates(ev.date, ev.recur, fromISO, toISO_).forEach(function (d) {
        out.push(materialize(ev, d));
      });
    });
    out.sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return (a.start || '99:99') < (b.start || '99:99') ? -1 : 1;
    });
    return out;
  }

  function occurrencesOn(iso) { return occurrencesBetween(iso, iso); }

  function materialize(ev, date) {
    const o = ev.occ && ev.occ[date] ? ev.occ[date] : {};
    const inst = Object.assign({}, ev, {
      date: date,
      occId: ev.id + '@' + date,
      status: o.status || defaultStatus(ev, date),
      paid: o.paid != null ? o.paid : !!ev.paid,
      occNote: o.note || ''
    });
    delete inst.occ;
    return inst;
  }

  function defaultStatus(ev, date) {
    if (date < U.todayISO()) return 'pending_past';
    return 'planned';
  }

  /* محرّك التكرار العام — يخدم الأحداث والمهام.
     rec = { freq: none|daily|weekly|monthly, interval: كل كم، days: [٠-٦]، until، skip: [] } */
  function isRecurring(item) {
    return !!(item && item.recur && item.recur.freq && item.recur.freq !== 'none');
  }

  function recurDates(anchor, rec, fromISO, toISO_) {
    const res = [];
    if (!anchor) return res;

    if (!rec || !rec.freq || rec.freq === 'none') {
      if (anchor >= fromISO && anchor <= toISO_) res.push(anchor);
      return res;
    }

    const step = Math.max(1, Number(rec.interval) || 1);
    const until = rec.until || '2099-12-31';
    const skip = rec.skip || [];
    const limit = toISO_ < until ? toISO_ : until;
    if (limit < anchor || limit < fromISO) return res;

    const push = function (iso) {
      if (iso >= fromISO && iso >= anchor && iso <= limit && skip.indexOf(iso) === -1) res.push(iso);
    };

    if (rec.freq === 'daily') {
      let cur = anchor;
      if (cur < fromISO) cur = U.addDays(cur, Math.floor(U.diffDays(fromISO, cur) / step) * step);
      let guard = 0;
      while (cur <= limit && guard++ < 3000) { push(cur); cur = U.addDays(cur, step); }
      return res;
    }

    if (rec.freq === 'weekly') {
      const days = (rec.days && rec.days.length) ? rec.days.slice().sort() : [U.weekdayOf(anchor)];
      let weekStart = U.startOfWeek(anchor);
      if (weekStart < fromISO) {
        const cycles = Math.floor(U.diffDays(U.startOfWeek(fromISO), weekStart) / (7 * step));
        weekStart = U.addDays(weekStart, cycles * 7 * step);
      }
      let guard = 0;
      while (weekStart <= limit && guard++ < 3000) {
        days.forEach(function (d) { push(U.addDays(weekStart, d)); });
        weekStart = U.addDays(weekStart, 7 * step);
      }
      res.sort();
      return res;
    }

    if (rec.freq === 'monthly') {
      // نثبّت اليوم من تاريخ البداية حتى لا ينزلق الشهر (٣١ ← ٣ من الشهر التالي)
      const day = U.parseISO(anchor).getDate();
      let mk = U.monthKey(anchor);
      let guard = 0;
      while (U.endOfMonth(mk) < fromISO && guard++ < 900) mk = U.shiftMonth(mk, step);
      guard = 0;
      while (U.startOfMonth(mk) <= limit && guard++ < 900) {
        const parts = mk.split('-').map(Number);
        const last = U.parseISO(U.endOfMonth(mk)).getDate();
        push(U.toISO(new Date(parts[0], parts[1] - 1, Math.min(day, last))));
        mk = U.shiftMonth(mk, step);
      }
      return res;
    }

    return res;
  }

  function setOccurrence(eventId, date, patch) {
    const ev = event(eventId);
    if (!ev) return;
    ev.occ = ev.occ || {};
    ev.occ[date] = Object.assign({}, ev.occ[date], patch);
    save();
  }

  /* ---------- المهام ---------- */
  function tasks() { return data.tasks; }
  function task(id) { return data.tasks.find(function (t) { return t.id === id; }); }

  function saveTask(t) {
    if (t.id && task(t.id)) {
      Object.assign(task(t.id), t, { updatedAt: Date.now() });
    } else {
      t.id = t.id || U.uid('tk');
      t.createdAt = Date.now();
      t.done = !!t.done;
      data.tasks.push(t);
    }
    save();
    return t;
  }

  function toggleTask(id) {
    const t = task(id);
    if (!t) return;
    t.done = !t.done;
    t.doneAt = t.done ? Date.now() : null;
    t.doneDate = t.done ? U.todayISO() : null;
    save();
    return t;
  }

  /* ---------- المهام المتكرّرة ---------- */
  /* المهمة المتكرّرة قالب: كل مرّة مستحقّة لها حالتها الخاصة داخل occ */
  function oneOffTasks() {
    return data.tasks.filter(function (t) { return !isRecurring(t); });
  }

  function routineTasks() {
    return data.tasks.filter(function (t) { return isRecurring(t); });
  }

  function materializeTask(t, date) {
    const o = (t.occ && t.occ[date]) || {};
    const inst = Object.assign({}, t, {
      due: date,
      occDate: date,
      occId: t.id + '@' + date,
      isOcc: true,
      done: !!o.done,
      doneAt: o.doneAt || null,
      doneDate: o.done ? (o.doneDate || date) : null
    });
    delete inst.occ;
    return inst;
  }

  /* كل مرّات المهام المتكرّرة داخل مدى زمني */
  function taskOccurrencesBetween(fromISO, toISO_) {
    const out = [];
    routineTasks().forEach(function (t) {
      recurDates(t.due, t.recur, fromISO, toISO_).forEach(function (d) {
        out.push(materializeTask(t, d));
      });
    });
    out.sort(function (a, b) { return a.due < b.due ? -1 : (a.due > b.due ? 1 : 0); });
    return out;
  }

  /* المهام المستحقّة في مدى: المفردة + مرّات المتكرّرة */
  function tasksDueBetween(fromISO, toISO_) {
    const single = oneOffTasks().filter(function (t) {
      return t.due && t.due >= fromISO && t.due <= toISO_;
    });
    return single.concat(taskOccurrencesBetween(fromISO, toISO_))
      .sort(function (a, b) { return (a.due || '') < (b.due || '') ? -1 : 1; });
  }

  function toggleTaskOccurrence(id, date) {
    const t = task(id);
    if (!t) return null;
    if (!isRecurring(t) || !date) return toggleTask(id);
    t.occ = t.occ || {};
    const cur = t.occ[date] || {};
    const now = !cur.done;
    t.occ[date] = Object.assign({}, cur, {
      done: now,
      doneAt: now ? Date.now() : null,
      doneDate: now ? U.todayISO() : null
    });
    save();
    return { id: t.id, done: now };
  }

  /* نسبة الالتزام داخل مدى زمني */
  function taskRate(t, fromISO, toISO_) {
    const all = recurDates(t.due, t.recur, fromISO, toISO_);
    const done = all.filter(function (d) { return t.occ && t.occ[d] && t.occ[d].done; }).length;
    return { due: all.length, done: done, rate: U.pct(done, all.length) };
  }

  /* عدد المرّات المتتالية المنجزة حتى الآن (اليوم لا يكسر السلسلة قبل انتهائه) */
  function taskStreak(t) {
    if (!isRecurring(t)) return 0;
    const todayIso = U.todayISO();
    const all = recurDates(t.due, t.recur, U.addDays(todayIso, -400), todayIso);
    let streak = 0;
    for (let i = all.length - 1; i >= 0; i--) {
      const o = (t.occ && t.occ[all[i]]) || {};
      if (o.done) { streak++; continue; }
      if (all[i] === todayIso) continue;
      break;
    }
    return streak;
  }

  /* آخر المرّات الفائتة غير المنجزة (نافذة قصيرة حتى لا تغرق الشاشة) */
  function missedRoutineOccurrences(daysBack) {
    const todayIso = U.todayISO();
    const from = U.addDays(todayIso, -(daysBack || 7));
    return taskOccurrencesBetween(from, U.addDays(todayIso, -1))
      .filter(function (o) { return !o.done; });
  }

  function deleteTask(id) {
    data.tasks = data.tasks.filter(function (t) { return t.id !== id; });
    save();
  }

  /* ---------- التقارير المؤرشفة ---------- */
  function reports() { return data.reports; }
  function reportFor(mk) { return data.reports.find(function (r) { return r.month === mk; }); }
  function saveReport(r) {
    const i = data.reports.findIndex(function (x) { return x.month === r.month; });
    if (i > -1) data.reports[i] = Object.assign(data.reports[i], r);
    else data.reports.push(r);
    save();
    return r;
  }

  /* ---------- النسخ الاحتياطي ---------- */
  function exportJSON() { return JSON.stringify(data, null, 2); }

  function importJSON(text) {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object') throw new Error('ملف غير صالح');
    data = Object.assign(emptyData(), parsed);
    data.settings = Object.assign(emptyData().settings, parsed.settings || {});
    save();
  }

  function resetAll() { data = emptyData(); save(); }

  function settings() { return data.settings; }
  function saveSettings(patch) { Object.assign(data.settings, patch); save(); }
  function raw() { return data; }

  global.Store = {
    EVENT_TYPES, PRIORITIES,
    load, save, onChange, raw, settings, saveSettings,
    contexts, context, saveContext, deleteContext,
    events, event, saveEvent, deleteEvent,
    occurrencesBetween, occurrencesOn, setOccurrence, materialize,
    tasks, task, saveTask, toggleTask, deleteTask,
    isRecurring, recurDates,
    oneOffTasks, routineTasks, materializeTask, taskOccurrencesBetween, tasksDueBetween,
    toggleTaskOccurrence, taskRate, taskStreak, missedRoutineOccurrences,
    reports, reportFor, saveReport,
    exportJSON, importJSON, resetAll,
    eventType: function (id) {
      return EVENT_TYPES.find(function (t) { return t.id === id; }) || EVENT_TYPES[EVENT_TYPES.length - 1];
    },
    priority: function (id) {
      return PRIORITIES.find(function (p) { return p.id === id; }) || PRIORITIES[2];
    }
  };
})(window);
