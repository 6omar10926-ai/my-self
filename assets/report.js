/* التقرير الشهري: تحليل تلقائي لما أُنجز وما تعثّر + توصيات */
(function (global) {
  'use strict';

  function analyze(mk) {
    const from = U.startOfMonth(mk), to = U.endOfMonth(mk);
    const cur = Store.settings().currency;
    const isPast = to < U.todayISO();

    const occs = Store.occurrencesBetween(from, to);
    const tasksAll = Store.tasks();

    // مهام تخص الشهر: مستحقة فيه أو أُنجزت فيه
    const tasksOfMonth = tasksAll.filter(function (t) {
      return (t.due && U.monthKey(t.due) === mk) || (t.doneDate && U.monthKey(t.doneDate) === mk);
    });
    const doneTasks = tasksOfMonth.filter(function (t) { return t.done; });
    const openTasks = tasksOfMonth.filter(function (t) { return !t.done; });
    const lateDone = doneTasks.filter(function (t) { return t.due && t.doneDate && t.doneDate > t.due; });
    const stillOverdue = openTasks.filter(function (t) { return t.due && t.due < U.todayISO(); });

    const doneEvents = occs.filter(function (o) { return o.status === 'done'; });
    const missedEvents = occs.filter(function (o) { return o.status === 'missed'; });
    // المواعيد المتكررة (دوام، محاضرات) روتين لا نحاسب عليه — نحاسب على المواعيد المفردة فقط
    const isRoutine = function (o) { return o.recur && o.recur.freq && o.recur.freq !== 'none'; };
    const unmarkedPast = occs.filter(function (o) { return o.status === 'pending_past' && !isRoutine(o); });

    const minutes = occs.reduce(function (s, o) { return s + U.minutesBetween(o.start, o.end); }, 0);
    const hours = Math.round(minutes / 60);

    const paidOccs = occs.filter(function (o) { return Number(o.amount) > 0; });
    const collected = paidOccs.filter(function (o) { return o.paid; })
                              .reduce(function (s, o) { return s + Number(o.amount); }, 0);
    const pending = paidOccs.filter(function (o) { return !o.paid; })
                            .reduce(function (s, o) { return s + Number(o.amount); }, 0);

    // تفصيل حسب المجال
    const byCtx = Store.contexts().map(function (c) {
      const ce = occs.filter(function (o) { return o.contextId === c.id; });
      const ct = tasksOfMonth.filter(function (t) { return t.contextId === c.id; });
      const cd = ct.filter(function (t) { return t.done; });
      const cm = ce.reduce(function (s, o) { return s + U.minutesBetween(o.start, o.end); }, 0);
      const cash = ce.filter(function (o) { return o.paid; }).reduce(function (s, o) { return s + Number(o.amount || 0); }, 0);
      const owed = ce.filter(function (o) { return Number(o.amount) > 0 && !o.paid; })
                     .reduce(function (s, o) { return s + Number(o.amount || 0); }, 0);
      return {
        ctx: c, events: ce.length, doneEvents: ce.filter(function (o) { return o.status === 'done'; }).length,
        tasks: ct.length, tasksDone: cd.length, hours: Math.round(cm / 60),
        collected: cash, pending: owed,
        rate: U.pct(cd.length, ct.length)
      };
    });

    const active = byCtx.filter(function (r) { return r.events || r.tasks; });
    const neglected = byCtx.filter(function (r) { return !r.events && !r.tasks; });

    // أكثر الأيام ازدحامًا
    const perDay = {};
    occs.forEach(function (o) { perDay[o.date] = (perDay[o.date] || 0) + 1; });
    const busiest = Object.keys(perDay).sort(function (a, b) { return perDay[b] - perDay[a]; }).slice(0, 3)
      .map(function (d) { return { date: d, count: perDay[d] }; });
    const overloaded = Object.keys(perDay).filter(function (d) { return perDay[d] >= 5; });

    const completionRate = U.pct(doneTasks.length, tasksOfMonth.length);
    const attendanceRate = U.pct(doneEvents.length, doneEvents.length + missedEvents.length);

    /* ---- أبرز الإنجازات ---- */
    const wins = [];
    if (doneTasks.length) {
      wins.push('أنجزت ' + U.count(doneTasks.length, 'task') + ' من أصل ' + tasksOfMonth.length +
        ' (' + completionRate + '٪).');
    }
    const bigWins = doneTasks.filter(function (t) { return t.priority === 'high'; });
    if (bigWins.length) {
      wins.push('من ضمنها ' + U.count(bigWins.length, 'task') + ' عالية الأولوية: ' +
        bigWins.slice(0, 4).map(function (t) { return '«' + t.title + '»'; }).join('، ') + '.');
    }
    if (doneEvents.length) wins.push('حضرت وأتممت ' + U.count(doneEvents.length, 'event') + ' والتزامًا.');
    if (hours) wins.push('خصّصت ما يقارب ' + U.count(hours, 'hour') + ' موزّعة على ' + U.count(active.length, 'ctx') + '.');
    if (collected) wins.push('حصّلت ' + U.money(collected, cur) + ' من الأعمال المدفوعة.');
    const topCtx = active.slice().sort(function (a, b) { return (b.events + b.tasksDone) - (a.events + a.tasksDone); })[0];
    if (topCtx) wins.push('أكثر مجال أعطيته وقتك: ' + topCtx.ctx.name +
      ' (' + U.count(topCtx.events, 'event') + ' و' + U.count(topCtx.tasksDone, 'task') + ' منجزة).');
    const perfect = active.filter(function (r) { return r.tasks >= 3 && r.rate === 100; });
    if (perfect.length) wins.push('أغلقت كل مهام: ' + perfect.map(function (r) { return r.ctx.name; }).join('، ') + ' بنسبة ١٠٠٪.');

    /* ---- السلبيات ---- */
    const issues = [];
    if (stillOverdue.length) {
      issues.push({
        title: 'مهام تجاوزت موعدها ولم تُنجز (' + stillOverdue.length + ')',
        detail: stillOverdue.slice(0, 5).map(function (t) {
          return '«' + t.title + '» — ' + Store.context(t.contextId).name + '، متأخرة ' +
            U.count(Math.abs(U.diffDays(t.due, U.todayISO())), 'day');
        }).join(' · '),
        fix: 'رحّلها الآن بموعد واقعي، أو احذف ما لم يعد له قيمة. المهمة المفتوحة بلا تاريخ تستهلك ذهنك.'
      });
    }
    if (lateDone.length) {
      issues.push({
        title: 'مهام أُنجزت بعد موعدها (' + lateDone.length + ')',
        detail: 'متوسط التأخير ' + U.count(Math.round(lateDone.reduce(function (s, t) {
          return s + U.diffDays(t.doneDate, t.due); }, 0) / lateDone.length), 'day') + '.',
        fix: 'ضع الموعد قبل الموعد الحقيقي بيومين، خصوصًا في مجالات الإدارة.'
      });
    }
    if (unmarkedPast.length) {
      issues.push({
        title: 'مواعيد مضت بلا تعليم (' + unmarkedPast.length + ')',
        detail: unmarkedPast.slice(0, 5).map(function (o) {
          return '«' + o.title + '» ' + U.fmtDate(o.date); }).join(' · ') +
          ' — ما نعرف هل تمّت أو فاتت، والتقرير يضعف بدون هذه المعلومة.',
        fix: 'خصّص دقيقتين آخر كل يوم لتعليم مواعيد اليوم: تمّت / فاتت.'
      });
    }
    if (missedEvents.length) {
      issues.push({
        title: 'مواعيد فاتتك (' + missedEvents.length + ')',
        detail: missedEvents.slice(0, 5).map(function (o) {
          return '«' + o.title + '» ' + U.fmtDate(o.date); }).join(' · '),
        fix: 'راجع سبب الفوات: تعارض جدول أم نسيان؟ إن كان تعارضًا فالمشكلة في القبول لا في الذاكرة.'
      });
    }
    if (pending) {
      issues.push({
        title: 'مستحقات لم تُحصّل: ' + U.money(pending, cur),
        detail: paidOccs.filter(function (o) { return !o.paid; }).slice(0, 5).map(function (o) {
          return '«' + o.title + '» ' + U.money(o.amount, cur); }).join(' · '),
        fix: 'اجعل التحصيل جزءًا من إنهاء العمل نفسه، لا مهمة منفصلة تُنسى.'
      });
    }
    if (neglected.length) {
      issues.push({
        title: 'مجالات لم تسجّل فيها أي نشاط (' + neglected.length + ')',
        detail: neglected.map(function (r) { return r.ctx.name; }).join('، '),
        fix: 'إمّا أنك أهملتها فعلًا، أو أنك تشتغل فيها بدون تسجيل — والاثنان يحتاجان علاجًا.'
      });
    }
    if (overloaded.length) {
      issues.push({
        title: 'أيام محمّلة فوق طاقتها (' + U.count(overloaded.length, 'day') + ' فيها ٥ مواعيد فأكثر)',
        detail: overloaded.slice(0, 5).map(function (d) { return U.fmtDate(d) + ' (' + perDay[d] + ')'; }).join(' · '),
        fix: 'وزّع الالتزامات؛ اليوم المزدحم يأكل يومين بعده.'
      });
    }
    const lowCtx = active.filter(function (r) { return r.tasks >= 3 && r.rate < 50; });
    if (lowCtx.length) {
      issues.push({
        title: 'مجالات نسبة الإنجاز فيها ضعيفة',
        detail: lowCtx.map(function (r) { return r.ctx.name + ' (' + r.rate + '٪)'; }).join('، '),
        fix: 'إمّا أن المهام فيها أكبر من وقتك المتاح، أو تحتاج تفويضًا. قرّر بوضوح.'
      });
    }
    if (!issues.length && isPast) {
      issues.push({ title: 'ما فيه سلبيات ظاهرة', detail: 'شهر منضبط.', fix: 'حافظ على نفس الإيقاع.' });
    }

    /* ---- توصيات ---- */
    const recs = [];
    if (completionRate < 60 && tasksOfMonth.length >= 5) {
      recs.push('قلّل عدد المهام المفتوحة شهريًا؛ نسبة إنجازك ' + completionRate + '٪ تعني أنك تعد نفسك بأكثر مما يتحمّله وقتك.');
    } else if (completionRate >= 85 && tasksOfMonth.length >= 5) {
      recs.push('نسبة إنجازك ' + completionRate + '٪ ممتازة — تقدر ترفع سقف الطموح شهر قادم.');
    }
    if (stillOverdue.length >= 3) recs.push('ابدأ الشهر بجلسة ترحيل: كل مهمة متأخرة إمّا موعد جديد أو حذف.');
    if (pending) recs.push('حدّد يومًا ثابتًا في الشهر لمتابعة التحصيل المالي.');
    if (neglected.length) recs.push('راجع مجالاتك المهملة: هل تستحق أن تبقى على قائمتك؟');
    if (overloaded.length) recs.push('اجعل حدًّا أعلى: لا أكثر من ٤ التزامات في اليوم الواحد.');
    if (unmarkedPast.length >= 3) recs.push('عوّد نفسك على «إغلاق اليوم»: مراجعة سريعة كل مساء.');
    recs.push('اكتب في أول الشهر ٣ نتائج تريد تحقيقها، وقس عليها آخر الشهر.');

    // مقارنة بالشهر السابق
    const prevMk = U.shiftMonth(mk, -1);
    const prev = quickStats(prevMk);
    const compare = {
      month: prevMk,
      tasksDone: doneTasks.length - prev.tasksDone,
      events: occs.length - prev.events,
      collected: collected - prev.collected,
      rate: completionRate - prev.rate
    };

    return {
      month: mk, isPast: isPast,
      totals: {
        tasks: tasksOfMonth.length, tasksDone: doneTasks.length, completionRate: completionRate,
        events: occs.length, doneEvents: doneEvents.length, missedEvents: missedEvents.length,
        unmarkedPast: unmarkedPast.length, attendanceRate: attendanceRate,
        hours: hours, collected: collected, pending: pending
      },
      byCtx: byCtx, active: active, neglected: neglected, busiest: busiest,
      wins: wins, issues: issues, recs: recs, compare: compare,
      doneTasks: doneTasks, openTasks: openTasks, doneEvents: doneEvents
    };
  }

  function quickStats(mk) {
    const from = U.startOfMonth(mk), to = U.endOfMonth(mk);
    const occs = Store.occurrencesBetween(from, to);
    const t = Store.tasks().filter(function (x) {
      return (x.due && U.monthKey(x.due) === mk) || (x.doneDate && U.monthKey(x.doneDate) === mk);
    });
    const done = t.filter(function (x) { return x.done; });
    return {
      tasksDone: done.length,
      events: occs.length,
      rate: U.pct(done.length, t.length),
      collected: occs.filter(function (o) { return o.paid; }).reduce(function (s, o) { return s + Number(o.amount || 0); }, 0)
    };
  }

  function delta(n, suffix) {
    if (!n) return '<span class="delta same">= مثل الشهر الماضي</span>';
    const up = n > 0;
    return '<span class="delta ' + (up ? 'up' : 'down') + '">' + (up ? '▲ +' : '▼ ') +
      Math.abs(n) + (suffix || '') + '</span>';
  }

  function render(root) {
    const mk = Views.state.month;
    const r = analyze(mk);
    const cur = Store.settings().currency;
    const saved = Store.reportFor(mk) || {};
    const name = Store.settings().name;

    root.innerHTML = '' +
      '<section class="cal-head no-print">' +
        '<div class="cal-nav">' +
          '<button class="icon-btn" data-act="month-next">›</button>' +
          '<h2>تقرير ' + U.monthLabel(mk) + '</h2>' +
          '<button class="icon-btn" data-act="month-prev">‹</button>' +
        '</div>' +
        '<div class="cal-tools">' +
          '<button class="btn btn-sm" data-act="month-today">هذا الشهر</button>' +
          '<button class="btn btn-sm btn-primary" data-act="print-report">🖨 طباعة / PDF</button>' +
        '</div>' +
      '</section>' +

      '<article class="report" id="reportSheet">' +
        '<header class="report-head">' +
          '<h1>التقرير الشهري — ' + U.monthLabel(mk) + '</h1>' +
          '<p>' + (name ? U.escapeHTML(name) + ' · ' : '') + U.hijri(U.startOfMonth(mk)) + ' إلى ' + U.hijri(U.endOfMonth(mk)) + '</p>' +
          (r.isPast ? '' : '<p class="muted small">الشهر لم ينتهِ بعد — الأرقام حتى تاريخ اليوم.</p>') +
        '</header>' +

        '<section class="report-stats">' +
          Views.statCard('✅', r.totals.tasksDone + '/' + r.totals.tasks, 'مهام منجزة') +
          Views.statCard('📈', r.totals.completionRate + '٪', 'نسبة الإنجاز',
            r.totals.completionRate >= 75 ? 'ok' : (r.totals.completionRate < 50 ? 'danger' : 'warn')) +
          Views.statCard('📅', r.totals.events, 'التزامات ومواعيد') +
          Views.statCard('⏱', r.totals.hours + ' س', 'ساعات مجدولة') +
          Views.statCard('💵', U.money(r.totals.collected, cur), 'محصّل', 'ok') +
          Views.statCard('⏳', U.money(r.totals.pending, cur), 'غير محصّل', r.totals.pending ? 'warn' : '') +
        '</section>' +

        '<section class="report-block">' +
          '<h2>مقارنة بـ' + U.monthLabel(r.compare.month) + '</h2>' +
          '<div class="compare">' +
            '<div><small>المهام المنجزة</small>' + delta(r.compare.tasksDone) + '</div>' +
            '<div><small>نسبة الإنجاز</small>' + delta(r.compare.rate, '٪') + '</div>' +
            '<div><small>المواعيد</small>' + delta(r.compare.events) + '</div>' +
            '<div><small>المحصّل</small>' + delta(Math.round(r.compare.collected), ' ' + cur) + '</div>' +
          '</div>' +
        '</section>' +

        '<section class="report-block">' +
          '<h2>توزيع الشهر على مجالاتي</h2>' +
          '<div class="table-wrap"><table class="rep-table">' +
            '<thead><tr><th>المجال</th><th>مواعيد</th><th>ساعات</th><th>مهام</th><th>الإنجاز</th><th>محصّل</th></tr></thead>' +
            '<tbody>' + r.byCtx.map(function (x) {
              const dim = (!x.events && !x.tasks) ? ' class="dim"' : '';
              return '<tr' + dim + '>' +
                '<td><span class="dot" style="background:' + x.ctx.color + '"></span>' + U.escapeHTML(x.ctx.name) + '</td>' +
                '<td>' + x.events + '</td>' +
                '<td>' + (x.hours || '—') + '</td>' +
                '<td>' + x.tasksDone + '/' + x.tasks + '</td>' +
                '<td>' + (x.tasks ? '<span class="rate ' + (x.rate >= 75 ? 'ok' : (x.rate < 50 ? 'bad' : 'mid')) + '">' + x.rate + '٪</span>' : '—') + '</td>' +
                '<td>' + (x.collected ? U.money(x.collected, cur) : '—') + '</td>' +
              '</tr>';
            }).join('') + '</tbody>' +
          '</table></div>' +
        '</section>' +

        '<section class="report-block wins">' +
          '<h2>🏅 أبرز ما أنجزته</h2>' +
          (r.wins.length ? '<ul class="rep-list">' + r.wins.map(function (w) {
            return '<li>' + U.escapeHTML(w) + '</li>'; }).join('') + '</ul>'
            : '<p class="muted">ما فيه بيانات كافية لهذا الشهر.</p>') +
          (r.doneTasks.length ? '<details class="rep-details"><summary>قائمة المهام المنجزة (' + r.doneTasks.length + ')</summary>' +
            '<ul class="rep-list small">' + r.doneTasks.map(function (t) {
              return '<li>' + U.escapeHTML(t.title) + ' <span class="muted">— ' +
                U.escapeHTML(Store.context(t.contextId).name) +
                (t.doneDate ? ' · ' + U.fmtDate(t.doneDate) : '') + '</span></li>';
            }).join('') + '</ul></details>' : '') +
        '</section>' +

        '<section class="report-block issues">' +
          '<h2>⚠️ سلبيات لازم أتلافاها الشهر القادم</h2>' +
          (r.issues.length ? r.issues.map(function (i) {
            return '<div class="issue"><h3>' + U.escapeHTML(i.title) + '</h3>' +
              (i.detail ? '<p class="issue-detail">' + U.escapeHTML(i.detail) + '</p>' : '') +
              '<p class="issue-fix">↩ ' + U.escapeHTML(i.fix) + '</p></div>';
          }).join('') : '<p class="muted">لا شيء.</p>') +
        '</section>' +

        '<section class="report-block">' +
          '<h2>🎯 توصيات للشهر القادم</h2>' +
          '<ol class="rep-list">' + r.recs.map(function (x) { return '<li>' + U.escapeHTML(x) + '</li>'; }).join('') + '</ol>' +
        '</section>' +

        '<section class="report-block">' +
          '<h2>✍️ ملاحظاتي الشخصية</h2>' +
          '<textarea id="repNotes" class="rep-notes no-print" rows="4" placeholder="اكتب هنا ما لا تلتقطه الأرقام: الحالة النفسية، الفرص، القرارات...">' +
            U.escapeHTML(saved.notes || '') + '</textarea>' +
          (saved.notes ? '<p class="print-only rep-notes-print">' + U.escapeHTML(saved.notes) + '</p>' : '') +
          '<div class="btn-row no-print"><button class="btn btn-sm btn-primary" id="saveRep">حفظ التقرير في الأرشيف</button></div>' +
        '</section>' +

        '<footer class="report-foot">أُنشئ في ' + U.fmtDate(U.todayISO(), { long: true }) + '</footer>' +
      '</article>' +

      (Store.reports().length ? '<section class="block no-print">' +
        UI.sectionTitle('الأرشيف') +
        '<div class="archive">' + Store.reports().slice().sort(function (a, b) {
          return a.month < b.month ? 1 : -1;
        }).map(function (x) {
          return '<button class="archive-item" data-report="' + x.month + '">' + U.monthLabel(x.month) +
            '<small>' + x.tasksDone + ' مهمة · ' + x.completionRate + '٪</small></button>';
        }).join('') + '</div>' +
      '</section>' : '');

    const btn = root.querySelector('#saveRep');
    if (btn) btn.onclick = function () {
      Store.saveReport({
        month: mk,
        notes: root.querySelector('#repNotes').value,
        tasksDone: r.totals.tasksDone,
        completionRate: r.totals.completionRate,
        collected: r.totals.collected,
        savedAt: Date.now()
      });
      UI.toast('تم حفظ التقرير في الأرشيف ✔');
      App.render();
    };

    root.querySelectorAll('[data-report]').forEach(function (b) {
      b.onclick = function () { Views.state.month = b.dataset.report; App.render(); };
    });
  }

  global.Report = { analyze, render, quickStats };
})(window);
