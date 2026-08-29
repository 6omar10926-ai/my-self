/* التشغيل والتوجيه بين الشاشات */
(function (global) {
  'use strict';

  const appEl = document.getElementById('app');
  const tabsEl = document.getElementById('tabs');
  const bannerEl = document.getElementById('banner');
  let currentView = 'today';

  const VIEWS = {
    today: Views.today, calendar: Views.calendar, tasks: Views.tasks,
    money: Views.money, report: Report.render, settings: Views.settings
  };

  function render() {
    appEl.innerHTML = '';
    if (!VIEWS[currentView]) currentView = 'today';
    VIEWS[currentView](appEl);
    Array.from(tabsEl.children).forEach(function (b) {
      b.classList.toggle('is-active', b.dataset.view === currentView);
    });
    document.getElementById('todayLabel').textContent = U.fmtDate(U.todayISO()) + ' · ' + U.hijri(U.todayISO());
    const nm = Store.settings().name;
    document.getElementById('brandName').textContent = nm ? 'منصّة ' + nm : 'منصّتي';
    appEl.scrollTop = 0;
  }

  function go(view) {
    currentView = view;
    location.hash = view;
    render();
  }

  /* ------- التنقّل ------- */
  tabsEl.addEventListener('click', function (e) {
    const b = e.target.closest('[data-view]');
    if (b) go(b.dataset.view);
  });

  window.addEventListener('hashchange', function () {
    const v = location.hash.replace('#', '');
    if (v && v !== currentView) { currentView = v; render(); }
  });

  /* ------- الأفعال العامة (تفويض الأحداث) ------- */
  document.addEventListener('click', function (e) {
    const actEl = e.target.closest('[data-act]');
    const dayEl = e.target.closest('[data-day]');
    const ctxRow = e.target.closest('[data-ctx]');

    if (dayEl && !actEl) {
      Views.state.selectedDate = dayEl.dataset.day;
      render();
      return;
    }

    if (ctxRow && !actEl) {
      const c = Store.context(ctxRow.dataset.ctx);
      Forms.openContextForm(c, render);
      return;
    }

    if (!actEl) return;
    const act = actEl.dataset.act;
    const card = actEl.closest('[data-ev]');
    const taskCard = actEl.closest('[data-task]');

    switch (act) {
      case 'add-event-today':
        Forms.openEventForm(null, U.todayISO(), render); break;
      case 'add-event-day':
        Forms.openEventForm(null, Views.state.selectedDate, render); break;
      case 'add-task':
        Forms.openTaskForm(null, render); break;
      case 'add-context':
        Forms.openContextForm(null, render); break;

      case 'ev-done': {
        const ev = Store.event(card.dataset.ev);
        const date = card.dataset.date;
        const inst = Store.materialize(ev, date);
        Store.setOccurrence(ev.id, date, { status: inst.status === 'done' ? 'planned' : 'done' });
        UI.toast(inst.status === 'done' ? 'رجّعناه غير منجز' : 'تم ✔');
        render(); break;
      }
      case 'ev-paid': {
        const ev = Store.event(card.dataset.ev);
        const date = card.dataset.date;
        const inst = Store.materialize(ev, date);
        Store.setOccurrence(ev.id, date, { paid: !inst.paid });
        UI.toast(!inst.paid ? 'تم تسجيل التحصيل 💵' : 'رجّعناه غير محصّل');
        render(); break;
      }
      case 'ev-missed': {
        const ev = Store.event(card.dataset.ev);
        const date = card.dataset.date;
        const inst = Store.materialize(ev, date);
        Store.setOccurrence(ev.id, date, { status: inst.status === 'missed' ? 'planned' : 'missed' });
        UI.toast(inst.status === 'missed' ? 'أُلغي التعليم' : 'سُجّل أنه فات');
        render(); break;
      }
      case 'ev-edit': {
        const ev = Store.event(card.dataset.ev);
        Forms.openEventForm(ev, null, render); break;
      }
      case 'task-toggle': {
        const id = taskCard.dataset.task;
        const date = taskCard.dataset.date || null;
        const res = date ? Store.toggleTaskOccurrence(id, date) : Store.toggleTask(id);
        if (res && res.done && date) {
          const streak = Store.taskStreak(Store.task(id));
          UI.toast(streak > 1 ? 'أحسنت — ' + streak + ' على التوالي 🔥' : 'أحسنت — أُنجزت ✔');
        } else {
          UI.toast(res && res.done ? 'أحسنت — أُنجزت ✔' : 'رجعت مفتوحة');
        }
        render(); break;
      }
      case 'task-skip': {
        const t = Store.task(taskCard.dataset.task);
        const date = taskCard.dataset.date;
        if (!t || !date) break;
        UI.confirmBox('تخطّي «' + t.title + '» ليوم ' + U.fmtDate(date) + '؟ لن تُحتسب عليك.', function () {
          const rec = Object.assign({}, t.recur);
          rec.skip = (rec.skip || []).concat([date]);
          Store.saveTask(Object.assign({}, t, { recur: rec }));
          UI.toast('تُخطّيت هذه المرّة');
          render();
        }, 'نعم، تخطَّها');
        break;
      }
      case 'task-edit':
        Forms.openTaskForm(Store.task(taskCard.dataset.task), render); break;

      case 'month-prev':
        Views.state.month = U.shiftMonth(Views.state.month, -1);
        Views.state.selectedDate = U.startOfMonth(Views.state.month);
        render(); break;
      case 'month-next':
        Views.state.month = U.shiftMonth(Views.state.month, 1);
        Views.state.selectedDate = U.startOfMonth(Views.state.month);
        render(); break;
      case 'month-today':
        Views.state.month = U.monthKey(U.todayISO());
        Views.state.selectedDate = U.todayISO();
        render(); break;

      case 'print-report': window.print(); break;

      case 'export': exportData(); break;
      case 'import': openImport(); break;
      case 'reset':
        UI.confirmBox('سيتم مسح كل المواعيد والمهام والتقارير من هذا الجهاز. متأكد؟', function () {
          Store.resetAll(); UI.toast('تم المسح'); render();
        });
        break;
      case 'open-report':
        Views.state.month = actEl.dataset.month || U.shiftMonth(U.monthKey(U.todayISO()), -1);
        go('report'); break;
      case 'dismiss-banner':
        Store.saveSettings({ lastSeenMonth: U.monthKey(U.todayISO()) });
        bannerEl.classList.add('hidden'); break;
    }
  });

  /* ------- استيراد / تصدير ------- */
  async function exportData() {
    const json = Store.exportJSON();
    const filename = 'نسخة-منصتي-' + U.todayISO() + '.json';

    // في النسخة المستضافة يمرّ الحفظ عبر تأكيد من المتصفّح
    if (global.claude && typeof global.claude.use === 'function') {
      try {
        const downloads = await global.claude.use('downloads');
        if (downloads) {
          await downloads.save({ filename: filename, data: json });
          UI.toast('نُزّلت النسخة الاحتياطية');
          return;
        }
      } catch (err) {
        if (err && err.code === 'declined') { UI.toast('أُلغي التنزيل'); return; }
        if (err && err.code === 'rate_limited') { UI.toast('انتظر لحظة ثم أعد المحاولة', 'err'); return; }
        // خلاف ذلك نكمل بالطريقة الاعتيادية
      }
    }

    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    UI.toast('نُزّلت النسخة الاحتياطية');
  }

  function applyImport(text) {
    try {
      Store.importJSON(text);
      UI.closeModal();
      UI.toast('تم الاستيراد ✔');
      render();
    } catch (err) {
      UI.toast('الملف غير صالح — تأكد أنه ملف النسخة الاحتياطية', 'err');
    }
  }

  function openImport() {
    UI.openModal('استيراد نسخة احتياطية',
      '<p class="muted small">اختر ملف النسخة، أو الصق محتواه هنا إن لم يفتح المتصفّح نافذة الملفات.</p>' +
      '<div class="btn-row"><button class="btn" id="pickFile">📂 اختيار ملف</button></div>' +
      '<label class="field mt"><span>أو ألصق محتوى الملف</span>' +
        '<textarea id="pasteJson" rows="6" placeholder="{ &quot;version&quot;: 1, ... }"></textarea></label>' +
      '<div class="form-actions"><button class="btn btn-primary" id="doImport">استيراد</button>' +
        '<button class="btn btn-ghost" data-close>إلغاء</button></div>',
      function (root) {
        root.querySelector('#pickFile').onclick = function () {
          document.getElementById('importFile').click();
        };
        root.querySelector('#doImport').onclick = function () {
          const v = root.querySelector('#pasteJson').value.trim();
          if (!v) { UI.toast('ألصق المحتوى أولًا', 'err'); return; }
          applyImport(v);
        };
      });
  }

  document.addEventListener('change', function (e) {
    if (e.target.id !== 'importFile') return;
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function () { applyImport(reader.result); };
    reader.readAsText(file);
  });

  /* ------- تنبيه بداية الشهر: تقرير الشهر الماضي جاهز ------- */
  function checkMonthBanner() {
    const nowMk = U.monthKey(U.todayISO());
    const s = Store.settings();
    if (s.lastSeenMonth !== nowMk) {
      const prev = U.shiftMonth(nowMk, -1);
      bannerEl.innerHTML = '<span>📊 تقرير <strong>' + U.monthLabel(prev) + '</strong> جاهز — راجع إنجازاتك وما يحتاج تحسينًا.</span>' +
        '<span class="banner-actions">' +
        '<button class="btn btn-sm btn-primary" data-act="open-report" data-month="' + prev + '">افتح التقرير</button>' +
        '<button class="icon-btn" data-act="dismiss-banner">✕</button></span>';
      bannerEl.classList.remove('hidden');
    }
  }

  /* ------- المظهر ------- */
  const themeBtn = document.getElementById('themeToggle');
  function applyTheme() {
    const t = Store.settings().theme || 'auto';
    document.documentElement.setAttribute('data-theme', t === 'auto' ? '' : t);
    if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  }
  themeBtn.addEventListener('click', function () {
    const order = ['auto', 'light', 'dark'];
    const cur = Store.settings().theme || 'auto';
    const next = order[(order.indexOf(cur) + 1) % order.length];
    Store.saveSettings({ theme: next });
    applyTheme();
    UI.toast(next === 'auto' ? 'المظهر: تلقائي' : (next === 'light' ? 'المظهر: فاتح' : 'المظهر: داكن'));
  });

  document.getElementById('quickAdd').addEventListener('click', function () {
    Forms.openQuickAdd(currentView === 'calendar' ? Views.state.selectedDate : U.todayISO(), render);
  });

  /* ------- الإقلاع ------- */
  Store.load();
  applyTheme();
  const hash = location.hash.replace('#', '');
  if (hash) currentView = hash;
  render();
  checkMonthBanner();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }

  global.App = { render: render, go: go };
})(window);
