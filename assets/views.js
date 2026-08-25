/* الشاشات: اليوم، التقويم، المهام، المالية، الإعدادات */
(function (global) {
  'use strict';

  const state = {
    month: U.monthKey(U.todayISO()),
    selectedDate: U.todayISO(),
    taskFilter: 'open',      // open | today | overdue | done | all
    taskContext: 'all',
    calContext: 'all'
  };

  /* ======================= اليوم ======================= */
  function today(root) {
    const iso = U.todayISO();
    const occs = Store.occurrencesOn(iso);
    const allTasks = Store.tasks();
    const overdue = allTasks.filter(function (t) { return !t.done && t.due && t.due < iso; })
                            .sort(function (a, b) { return a.due < b.due ? -1 : 1; });
    const dueToday = allTasks.filter(function (t) { return !t.done && t.due === iso; });
    const soon = allTasks.filter(function (t) {
      return !t.done && t.due && t.due > iso && t.due <= U.addDays(iso, 3);
    }).sort(function (a, b) { return a.due < b.due ? -1 : 1; });
    const doneToday = allTasks.filter(function (t) { return t.done && t.doneDate === iso; });

    const mk = U.monthKey(iso);
    const monthOccs = Store.occurrencesBetween(U.startOfMonth(mk), U.endOfMonth(mk));
    const owed = monthOccs.filter(function (o) { return Number(o.amount) > 0 && !o.paid; })
                          .reduce(function (s, o) { return s + Number(o.amount); }, 0);

    const nextUp = occs.filter(function (o) { return o.start && o.start >= U.nowHHMM() && o.status !== 'done'; })[0];

    root.innerHTML = '' +
      '<section class="hero">' +
        '<div>' +
          '<h2>' + U.fmtDate(iso, { long: true }) + '</h2>' +
          '<p class="muted">' + U.hijri(iso) + '</p>' +
        '</div>' +
        (nextUp ? '<div class="next-up" style="--ctx:' + Store.context(nextUp.contextId).color + '">' +
            '<small>القادم الآن</small><strong>' + U.escapeHTML(nextUp.title) + '</strong>' +
            '<span>' + U.timeRange(nextUp.start, nextUp.end) + '</span></div>' : '') +
      '</section>' +

      '<section class="stats">' +
        statCard('📅', occs.length, 'موعد اليوم') +
        statCard('🔥', overdue.length, 'مهام متأخرة', overdue.length ? 'danger' : '') +
        statCard('✅', doneToday.length, 'أنجزتها اليوم', doneToday.length ? 'ok' : '') +
        statCard('💰', U.money(owed, Store.settings().currency), 'مستحقات لم تُحصّل هذا الشهر', owed ? 'warn' : '') +
      '</section>' +

      (overdue.length ? '<section class="block alert-block">' +
        UI.sectionTitle('⚠️ متأخرة — ابدأ بها') +
        '<div class="list">' + overdue.slice(0, 6).map(function (t) { return UI.taskCard(t); }).join('') + '</div>' +
      '</section>' : '') +

      '<section class="block">' +
        UI.sectionTitle('جدول اليوم', '<button class="btn btn-sm" data-act="add-event-today">+ موعد</button>') +
        (occs.length ? '<div class="list">' + occs.map(function (o) { return UI.eventCard(o); }).join('') + '</div>'
                     : UI.empty('ما عندك مواعيد اليوم', 'يوم صافي — استغله في المهام المؤجلة')) +
      '</section>' +

      '<section class="block">' +
        UI.sectionTitle('مهام اليوم', '<button class="btn btn-sm" data-act="add-task">+ مهمة</button>') +
        (dueToday.length ? '<div class="list">' + dueToday.map(function (t) { return UI.taskCard(t); }).join('') + '</div>'
                         : UI.empty('لا توجد مهام مستحقة اليوم')) +
      '</section>' +

      (soon.length ? '<section class="block">' +
        UI.sectionTitle('على الأبواب (٣ أيام)') +
        '<div class="list">' + soon.map(function (t) { return UI.taskCard(t); }).join('') + '</div>' +
      '</section>' : '') +

      (doneToday.length ? '<section class="block">' +
        UI.sectionTitle('✔ أنجزتها اليوم') +
        '<div class="list">' + doneToday.map(function (t) { return UI.taskCard(t); }).join('') + '</div>' +
      '</section>' : '');
  }

  function statCard(icon, value, label, kind) {
    return '<div class="stat ' + (kind || '') + '"><span class="stat-icon">' + icon + '</span>' +
      '<strong>' + U.escapeHTML(String(value)) + '</strong><small>' + U.escapeHTML(label) + '</small></div>';
  }

  /* ======================= التقويم ======================= */
  function calendar(root) {
    const mk = state.month;
    const first = U.startOfMonth(mk);
    const last = U.endOfMonth(mk);
    const gridStart = U.startOfWeek(first);
    const cells = [];
    let cur = gridStart;
    while (cells.length < 42) {
      cells.push(cur);
      cur = U.addDays(cur, 1);
      if (cur > last && U.weekdayOf(cur) === 0) break;
    }

    let occs = Store.occurrencesBetween(cells[0], cells[cells.length - 1]);
    if (state.calContext !== 'all') {
      occs = occs.filter(function (o) { return o.contextId === state.calContext; });
    }
    const byDate = {};
    occs.forEach(function (o) { (byDate[o.date] = byDate[o.date] || []).push(o); });

    const tasksByDate = {};
    Store.tasks().forEach(function (t) {
      if (t.due && !t.done) (tasksByDate[t.due] = tasksByDate[t.due] || []).push(t);
    });

    const todayIso = U.todayISO();

    const grid = cells.map(function (d) {
      const out = U.monthKey(d) !== mk;
      const items = byDate[d] || [];
      const tks = tasksByDate[d] || [];
      const labels = items.slice(0, 3).map(function (o) {
        return '<span class="day-ev" style="--ctx:' + Store.context(o.contextId).color + '">' +
          (o.start ? '<b>' + U.fmtTime(o.start).replace(' ', '') + '</b> ' : '') +
          U.escapeHTML(o.title) + '</span>';
      }).join('');
      const extra = items.length > 3 ? items.length - 3 : 0;
      return '<button class="day-cell' + (out ? ' out' : '') + (d === todayIso ? ' today' : '') +
        (d === state.selectedDate ? ' selected' : '') + '" data-day="' + d + '">' +
        '<span class="day-num">' + U.parseISO(d).getDate() + '</span>' +
        '<span class="dots">' +
          items.slice(0, 4).map(function (o) {
            return '<i style="background:' + Store.context(o.contextId).color + '"></i>';
          }).join('') +
          (tks.length ? '<i class="task-dot"></i>' : '') +
        '</span>' +
        '<span class="day-events">' + labels +
          (tks.length ? '<span class="day-ev task">✓ ' + U.count(tks.length, 'task') + '</span>' : '') +
        '</span>' +
        (items.length > 4 ? '<span class="more">+' + (items.length - 4) + '</span>' : '') +
        (extra ? '<span class="more-lg">+' + extra + '</span>' : '') +
        '</button>';
    }).join('');

    const dayOccs = (byDate[state.selectedDate] || []);
    const dayTasks = Store.tasks().filter(function (t) { return t.due === state.selectedDate; });

    root.innerHTML = '' +
      '<section class="cal-head">' +
        '<div class="cal-nav">' +
          '<button class="icon-btn" data-act="month-next">›</button>' +
          '<h2>' + U.monthLabel(mk) + '</h2>' +
          '<button class="icon-btn" data-act="month-prev">‹</button>' +
        '</div>' +
        '<div class="cal-tools">' +
          '<button class="btn btn-sm" data-act="month-today">هذا الشهر</button>' +
          '<select id="calCtx" class="mini-select">' +
            '<option value="all">كل المجالات</option>' +
            Store.contexts().map(function (c) {
              return '<option value="' + c.id + '"' + (state.calContext === c.id ? ' selected' : '') + '>' +
                c.icon + ' ' + U.escapeHTML(c.name) + '</option>';
            }).join('') +
          '</select>' +
        '</div>' +
      '</section>' +

      '<section class="cal-grid-wrap">' +
        '<div class="weekdays">' + U.WEEKDAYS_SHORT.map(function (w) { return '<span>' + w + '</span>'; }).join('') + '</div>' +
        '<div class="cal-grid">' + grid + '</div>' +
        '<div class="legend">' + Store.contexts().map(function (c) {
          return '<span class="legend-item"><i style="background:' + c.color + '"></i>' + U.escapeHTML(c.name) + '</span>';
        }).join('') + '</div>' +
      '</section>' +

      '<section class="block">' +
        UI.sectionTitle(U.fmtDate(state.selectedDate, { long: true }),
          '<button class="btn btn-sm btn-primary" data-act="add-event-day">+ موعد في هذا اليوم</button>') +
        '<p class="muted small hijri-line">' + U.hijri(state.selectedDate) + '</p>' +
        (dayOccs.length ? '<div class="list">' + dayOccs.map(function (o) { return UI.eventCard(o); }).join('') + '</div>'
                        : UI.empty('لا مواعيد في هذا اليوم')) +
        (dayTasks.length ? '<div class="list mt">' + dayTasks.map(function (t) { return UI.taskCard(t); }).join('') + '</div>' : '') +
      '</section>';

    const sel = root.querySelector('#calCtx');
    if (sel) sel.onchange = function () { state.calContext = sel.value; App.render(); };
  }

  /* ======================= المهام ======================= */
  function tasks(root) {
    const iso = U.todayISO();
    let list = Store.tasks().slice();

    if (state.taskContext !== 'all') {
      list = list.filter(function (t) { return t.contextId === state.taskContext; });
    }

    const counts = {
      open: list.filter(function (t) { return !t.done; }).length,
      today: list.filter(function (t) { return !t.done && t.due === iso; }).length,
      overdue: list.filter(function (t) { return !t.done && t.due && t.due < iso; }).length,
      done: list.filter(function (t) { return t.done; }).length
    };

    let shown = list;
    if (state.taskFilter === 'open') shown = list.filter(function (t) { return !t.done; });
    if (state.taskFilter === 'today') shown = list.filter(function (t) { return !t.done && t.due === iso; });
    if (state.taskFilter === 'overdue') shown = list.filter(function (t) { return !t.done && t.due && t.due < iso; });
    if (state.taskFilter === 'done') shown = list.filter(function (t) { return t.done; });

    const prRank = { high: 0, mid: 1, low: 2 };
    shown.sort(function (a, b) {
      if (a.done !== b.done) return a.done ? 1 : -1;
      if (a.done) return (b.doneAt || 0) - (a.doneAt || 0);
      const ad = a.due || '9999', bd = b.due || '9999';
      if (ad !== bd) return ad < bd ? -1 : 1;
      return (prRank[a.priority] || 1) - (prRank[b.priority] || 1);
    });

    const filters = [
      ['open', 'مفتوحة', counts.open],
      ['overdue', 'متأخرة', counts.overdue],
      ['today', 'اليوم', counts.today],
      ['done', 'منجزة', counts.done],
      ['all', 'الكل', list.length]
    ];

    root.innerHTML = '' +
      '<section class="block">' +
        UI.sectionTitle('المهام', '<button class="btn btn-sm btn-primary" data-act="add-task">+ مهمة</button>') +
        '<div class="filters">' + filters.map(function (f) {
          return '<button class="filter' + (state.taskFilter === f[0] ? ' is-active' : '') + '" data-filter="' + f[0] + '">' +
            f[1] + '<span class="count">' + f[2] + '</span></button>';
        }).join('') + '</div>' +
        '<select id="taskCtx" class="mini-select full">' +
          '<option value="all">كل المجالات</option>' +
          Store.contexts().map(function (c) {
            return '<option value="' + c.id + '"' + (state.taskContext === c.id ? ' selected' : '') + '>' +
              c.icon + ' ' + U.escapeHTML(c.name) + '</option>';
          }).join('') +
        '</select>' +
        (shown.length ? '<div class="list mt">' + shown.map(function (t) { return UI.taskCard(t); }).join('') + '</div>'
                      : UI.empty('ما فيه مهام هنا', 'أضف مهمة وعلّم عليها لما تخلّصها')) +
      '</section>';

    const sel = root.querySelector('#taskCtx');
    if (sel) sel.onchange = function () { state.taskContext = sel.value; App.render(); };
    root.querySelectorAll('[data-filter]').forEach(function (b) {
      b.onclick = function () { state.taskFilter = b.dataset.filter; App.render(); };
    });
  }

  /* ======================= المالية ======================= */
  function money(root) {
    const mk = state.month;
    const cur = Store.settings().currency;
    const occs = Store.occurrencesBetween(U.startOfMonth(mk), U.endOfMonth(mk))
                      .filter(function (o) { return Number(o.amount) > 0; });

    const collected = occs.filter(function (o) { return o.paid; }).reduce(function (s, o) { return s + Number(o.amount); }, 0);
    const pending = occs.filter(function (o) { return !o.paid; }).reduce(function (s, o) { return s + Number(o.amount); }, 0);

    const byCtx = {};
    occs.forEach(function (o) {
      const k = o.contextId;
      byCtx[k] = byCtx[k] || { collected: 0, pending: 0, count: 0 };
      byCtx[k].count++;
      if (o.paid) byCtx[k].collected += Number(o.amount); else byCtx[k].pending += Number(o.amount);
    });

    const maxVal = Math.max.apply(null, [1].concat(Object.keys(byCtx).map(function (k) {
      return byCtx[k].collected + byCtx[k].pending;
    })));

    const overdueUnpaid = occs.filter(function (o) { return !o.paid && o.date < U.todayISO(); })
                              .sort(function (a, b) { return a.date < b.date ? -1 : 1; });

    root.innerHTML = '' +
      '<section class="cal-head">' +
        '<div class="cal-nav">' +
          '<button class="icon-btn" data-act="month-next">›</button>' +
          '<h2>مالية ' + U.monthLabel(mk) + '</h2>' +
          '<button class="icon-btn" data-act="month-prev">‹</button>' +
        '</div>' +
        '<button class="btn btn-sm" data-act="month-today">هذا الشهر</button>' +
      '</section>' +

      '<section class="stats">' +
        statCard('💵', U.money(collected, cur), 'محصّل', 'ok') +
        statCard('⏳', U.money(pending, cur), 'لم يُحصّل', pending ? 'warn' : '') +
        statCard('📊', U.money(collected + pending, cur), 'إجمالي الشهر') +
        statCard('🧾', occs.length, 'عمل مدفوع مسجَّل') +
      '</section>' +

      '<section class="block">' +
        UI.sectionTitle('التوزيع على المجالات') +
        (Object.keys(byCtx).length ? '<div class="bars">' + Object.keys(byCtx).map(function (k) {
          const c = Store.context(k), v = byCtx[k];
          const total = v.collected + v.pending;
          return '<div class="bar-row">' +
            '<div class="bar-label"><span>' + c.icon + ' ' + U.escapeHTML(c.name) + '</span>' +
              '<strong>' + U.money(total, cur) + '</strong></div>' +
            '<div class="bar"><i style="width:' + (v.collected / maxVal * 100) + '%;background:' + c.color + '"></i>' +
              '<i class="pending" style="width:' + (v.pending / maxVal * 100) + '%"></i></div>' +
            '<small class="muted">' + U.count(v.count, 'work') + ' · محصّل ' + U.money(v.collected, cur) +
              (v.pending ? ' · متبقٍ ' + U.money(v.pending, cur) : '') + '</small>' +
          '</div>';
        }).join('') + '</div>' : UI.empty('ما فيه مبالغ مسجّلة هذا الشهر', 'أضف المبلغ داخل الموعد نفسه')) +
      '</section>' +

      (overdueUnpaid.length ? '<section class="block alert-block">' +
        UI.sectionTitle('🔔 مستحقات فاتت ولم تُحصّل') +
        '<div class="list">' + overdueUnpaid.map(function (o) { return UI.eventCard(o, { showDate: true }); }).join('') + '</div>' +
      '</section>' : '') +

      '<section class="block">' +
        UI.sectionTitle('كل الأعمال المدفوعة هذا الشهر') +
        (occs.length ? '<div class="list">' + occs.map(function (o) { return UI.eventCard(o, { showDate: true }); }).join('') + '</div>'
                     : UI.empty('لا يوجد')) +
      '</section>';
  }

  /* ======================= الإعدادات ======================= */
  function settings(root) {
    const s = Store.settings();
    const d = Store.raw();
    root.innerHTML = '' +
      '<section class="block">' +
        UI.sectionTitle('مجالاتي', '<button class="btn btn-sm btn-primary" data-act="add-context">+ مجال</button>') +
        '<div class="ctx-list">' + Store.contexts().map(function (c) {
          const evCount = Store.events().filter(function (e) { return e.contextId === c.id; }).length;
          const tkCount = Store.tasks().filter(function (t) { return t.contextId === c.id; }).length;
          return '<button class="ctx-row" data-ctx="' + c.id + '" style="--ctx:' + c.color + '">' +
            '<span class="ctx-icon">' + c.icon + '</span>' +
            '<span class="ctx-body"><strong>' + U.escapeHTML(c.name) + '</strong>' +
              '<small>' + U.escapeHTML(c.role || '') + (c.role ? ' · ' : '') + evCount + ' موعد · ' + tkCount + ' مهمة</small></span>' +
            '<span class="ctx-edit">تعديل</span>' +
          '</button>';
        }).join('') + '</div>' +
      '</section>' +

      '<section class="block">' +
        UI.sectionTitle('عام') +
        '<form id="genForm" class="form">' +
          '<div class="row">' +
            '<label class="field"><span>اسمي</span><input name="name" value="' + U.escapeHTML(s.name || '') + '" placeholder="يظهر في التقرير"></label>' +
            '<label class="field"><span>العملة</span><input name="currency" value="' + U.escapeHTML(s.currency || 'ر.س') + '"></label>' +
          '</div>' +
          '<button class="btn btn-primary btn-sm">حفظ</button>' +
        '</form>' +
      '</section>' +

      '<section class="block">' +
        UI.sectionTitle('النسخ الاحتياطي') +
        '<p class="muted small">بياناتك محفوظة على هذا الجهاز فقط. نزّل نسخة احتياطية بين فترة وأخرى، وارفعها في أي جهاز ثانٍ.</p>' +
        '<div class="btn-row">' +
          '<button class="btn" data-act="export">⬇️ تنزيل نسخة (JSON)</button>' +
          '<button class="btn" data-act="import">⬆️ استيراد نسخة</button>' +
          '<button class="btn btn-danger" data-act="reset">🗑 مسح كل البيانات</button>' +
        '</div>' +
        '<p class="muted small mt">' + d.events.length + ' موعد · ' + d.tasks.length + ' مهمة · ' +
          d.reports.length + ' تقرير مؤرشف</p>' +
        '<input type="file" id="importFile" accept="application/json" hidden>' +
      '</section>' +

      '<section class="block">' +
        UI.sectionTitle('نبذة') +
        '<p class="muted small">منصّة شخصية لتنظيم كل مجالاتك في تقويم واحد، مع متابعة المهام والمبالغ، وتقرير شهري تلقائي يبيّن إنجازاتك وما يحتاج تحسينًا. تعمل بدون إنترنت، ويمكن تثبيتها على الجوال من قائمة المتصفح ← «إضافة إلى الشاشة الرئيسية».</p>' +
      '</section>';

    root.querySelector('#genForm').onsubmit = function (e) {
      e.preventDefault();
      const f = new FormData(e.target);
      Store.saveSettings({ name: (f.get('name') || '').trim(), currency: (f.get('currency') || 'ر.س').trim() });
      UI.toast('تم الحفظ ✔');
      App.render();
    };
  }

  global.Views = { state, today, calendar, tasks, money, settings, statCard };
})(window);
