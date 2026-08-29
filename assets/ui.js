/* مكوّنات واجهة مشتركة: النافذة المنبثقة، التنبيه، بطاقات الأحداث والمهام */
(function (global) {
  'use strict';

  const modalRoot = document.getElementById('modalRoot');
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');
  const toastEl = document.getElementById('toast');
  let toastTimer = null;

  function openModal(title, html, afterRender) {
    modalTitle.textContent = title;
    modalBody.innerHTML = html;
    modalRoot.classList.remove('hidden');
    document.body.classList.add('no-scroll');
    if (afterRender) afterRender(modalBody);
    const first = modalBody.querySelector('input, textarea, select');
    if (first && !('ontouchstart' in window)) first.focus();
  }

  function closeModal() {
    modalRoot.classList.add('hidden');
    document.body.classList.remove('no-scroll');
    modalBody.innerHTML = '';
  }

  modalRoot.addEventListener('click', function (e) {
    if (e.target.hasAttribute('data-close')) closeModal();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !modalRoot.classList.contains('hidden')) closeModal();
  });

  function toast(msg, kind) {
    toastEl.textContent = msg;
    toastEl.className = 'toast ' + (kind || '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.add('hidden'); }, 2600);
  }

  function confirmBox(message, onYes, yesLabel) {
    openModal('تأكيد', '<p class="confirm-text">' + U.escapeHTML(message) + '</p>' +
      '<div class="form-actions"><button class="btn btn-danger" id="cfmYes">' +
        U.escapeHTML(yesLabel || 'نعم، احذف') + '</button>' +
      '<button class="btn btn-ghost" data-close>إلغاء</button></div>',
      function (root) {
        root.querySelector('#cfmYes').onclick = function () { closeModal(); onYes(); };
      });
  }

  /* --- بطاقات --- */
  function eventCard(occ, opts) {
    opts = opts || {};
    const ctx = Store.context(occ.contextId);
    const type = Store.eventType(occ.type);
    const done = occ.status === 'done';
    const missed = occ.status === 'missed';
    const amount = Number(occ.amount || 0);
    return '' +
      '<article class="card event-card' + (done ? ' is-done' : '') + (missed ? ' is-missed' : '') + '"' +
        ' style="--ctx:' + ctx.color + '" data-ev="' + occ.id + '" data-date="' + occ.date + '">' +
        '<div class="card-main">' +
          '<div class="card-top">' +
            '<span class="chip" style="--ctx:' + ctx.color + '">' + ctx.icon + ' ' + U.escapeHTML(ctx.name) + '</span>' +
            '<span class="muted small">' + type.icon + ' ' + type.name + '</span>' +
            (occ.recur && occ.recur.freq !== 'none' ? '<span class="muted small">🔁 متكرر</span>' : '') +
          '</div>' +
          '<h4 class="card-title">' + U.escapeHTML(occ.title) + '</h4>' +
          '<div class="card-meta">' +
            '<span>🕒 ' + U.timeRange(occ.start, occ.end) + '</span>' +
            (opts.showDate ? '<span>📅 ' + U.fmtDate(occ.date) + '</span>' : '') +
            (occ.location ? '<span>📍 ' + U.escapeHTML(occ.location) + '</span>' : '') +
            (amount ? '<span class="money-tag' + (occ.paid ? ' paid' : '') + '">💰 ' +
                U.money(amount, Store.settings().currency) + (occ.paid ? ' (محصّل)' : ' (غير محصّل)') + '</span>' : '') +
          '</div>' +
          (occ.notes ? '<p class="card-notes">' + U.escapeHTML(occ.notes) + '</p>' : '') +
        '</div>' +
        '<div class="card-side">' +
          '<button class="mini-btn ok" data-act="ev-done" title="تم">' + (done ? '✔ تم' : 'تم') + '</button>' +
          (occ.date <= U.todayISO() && !done ? '<button class="mini-btn miss" data-act="ev-missed" title="فاتني">' +
              (missed ? '✕ فات' : 'فات') + '</button>' : '') +
          (amount ? '<button class="mini-btn" data-act="ev-paid" title="تحصيل المبلغ">' + (occ.paid ? '💵 محصّل' : 'تحصيل') + '</button>' : '') +
          '<button class="mini-btn" data-act="ev-edit">تعديل</button>' +
        '</div>' +
      '</article>';
  }

  /* وصف التكرار بالعربي: «كل يومين»، «أسبوعيًا: أحد، ثلاثاء»، «كل ٣ أشهر» */
  function recurLabel(rec) {
    if (!rec || !rec.freq || rec.freq === 'none') return '';
    const n = Math.max(1, Number(rec.interval) || 1);
    if (rec.freq === 'daily') {
      return n === 1 ? 'كل يوم' : (n === 2 ? 'كل يومين' : 'كل ' + U.count(n, 'day'));
    }
    if (rec.freq === 'weekly') {
      const days = (rec.days && rec.days.length) ? rec.days : [];
      const names = days.slice().sort().map(function (d) { return U.WEEKDAYS_SHORT[d]; }).join('، ');
      const every = n === 1 ? 'كل أسبوع' : (n === 2 ? 'كل أسبوعين' : 'كل ' + n + ' أسابيع');
      return names ? every + ': ' + names : every;
    }
    if (rec.freq === 'monthly') {
      return n === 1 ? 'كل شهر' : (n === 2 ? 'كل شهرين' : 'كل ' + n + ' أشهر');
    }
    return '';
  }

  function taskCard(t, opts) {
    opts = opts || {};
    const ctx = Store.context(t.contextId);
    const pr = Store.priority(t.priority);
    const repeats = Store.isRecurring(t);
    // بطاقة القالب (لا مرّة مستحقّة اليوم) لا تُعلَّم ولا تُوصف بالتأخر
    const isTemplate = !!opts.template;
    const overdue = !isTemplate && !t.done && t.due && t.due < U.todayISO();
    const streak = opts.streak != null ? opts.streak : 0;
    return '' +
      '<article class="card task-card' + (t.done ? ' is-done' : '') + (overdue ? ' is-overdue' : '') +
        (repeats ? ' is-routine' : '') + '"' +
        ' style="--ctx:' + ctx.color + '" data-task="' + t.id + '"' +
        (t.occDate ? ' data-date="' + t.occDate + '"' : '') + '>' +
        (isTemplate
          ? '<span class="check is-template" title="لا مرّة مستحقّة اليوم">🔁</span>'
          : '<button class="check" data-act="task-toggle" aria-label="تبديل الإنجاز">' + (t.done ? '✔' : '') + '</button>') +
        '<div class="card-main">' +
          '<div class="card-top">' +
            '<span class="chip" style="--ctx:' + ctx.color + '">' + ctx.icon + ' ' + U.escapeHTML(ctx.name) + '</span>' +
            '<span class="pill" style="--pc:' + pr.color + '">' + pr.name + '</span>' +
            (repeats ? '<span class="muted small">🔁 ' + U.escapeHTML(recurLabel(t.recur)) + '</span>' : '') +
          '</div>' +
          '<h4 class="card-title">' + U.escapeHTML(t.title) + '</h4>' +
          '<div class="card-meta">' +
            (isTemplate
              ? (opts.nextDue ? '<span>📅 التالية: ' + U.fmtRelative(opts.nextDue) + '</span>'
                              : '<span class="muted">انتهى تكرارها</span>')
              : (t.due ? '<span class="' + (overdue ? 'danger' : '') + '">📅 ' + U.fmtRelative(t.due) + '</span>'
                       : '<span class="muted">بدون موعد</span>')) +
            (t.estimate ? '<span>⏱ ' + U.escapeHTML(t.estimate) + '</span>' : '') +
            (streak > 0 ? '<span class="streak">🔥 ' + streak + ' على التوالي</span>' : '') +
            (opts.rate ? '<span class="muted">' + opts.rate.done + '/' + opts.rate.due + ' هذا الشهر (' + opts.rate.rate + '٪)</span>' : '') +
            (t.done && t.doneDate ? '<span class="ok-text">✔ أُنجزت ' + U.fmtDate(t.doneDate) + '</span>' : '') +
          '</div>' +
          (t.notes ? '<p class="card-notes">' + U.escapeHTML(t.notes) + '</p>' : '') +
        '</div>' +
        '<div class="card-side">' +
          (repeats && t.occDate ? '<button class="mini-btn miss" data-act="task-skip" title="تخطّي هذه المرّة">تخطّي</button>' : '') +
          '<button class="mini-btn" data-act="task-edit">تعديل</button>' +
        '</div>' +
      '</article>';
  }

  function empty(text, hint) {
    return '<div class="empty"><div class="empty-icon">🌿</div><p>' + U.escapeHTML(text) + '</p>' +
      (hint ? '<small>' + U.escapeHTML(hint) + '</small>' : '') + '</div>';
  }

  function sectionTitle(title, extra) {
    return '<div class="section-head"><h3>' + U.escapeHTML(title) + '</h3>' + (extra || '') + '</div>';
  }

  global.UI = { openModal, closeModal, toast, confirmBox, eventCard, taskCard, empty, sectionTitle, recurLabel };
})(window);
