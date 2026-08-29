/* نماذج الإدخال: حدث، مهمة، مجال */
(function (global) {
  'use strict';

  function ctxOptions(selected) {
    return Store.contexts().map(function (c) {
      return '<option value="' + c.id + '"' + (c.id === selected ? ' selected' : '') + '>' +
        c.icon + ' ' + U.escapeHTML(c.name) + '</option>';
    }).join('');
  }

  function typeOptions(selected) {
    return Store.EVENT_TYPES.map(function (t) {
      return '<option value="' + t.id + '"' + (t.id === selected ? ' selected' : '') + '>' +
        t.icon + ' ' + t.name + '</option>';
    }).join('');
  }

  function prOptions(selected) {
    return Store.PRIORITIES.map(function (p) {
      return '<option value="' + p.id + '"' + (p.id === selected ? ' selected' : '') + '>' + p.name + '</option>';
    }).join('');
  }

  /* ---------------- حقول التكرار (مشتركة) ---------------- */
  function recurFields(rec, opts) {
    rec = rec || {};
    opts = opts || {};
    const freq = rec.freq || 'none';
    const days = rec.days || [];
    const interval = Math.max(1, Number(rec.interval) || 1);
    const labels = opts.labels || {
      none: 'بدون تكرار', daily: 'يومي', weekly: 'أسبوعي', monthly: 'شهري'
    };
    return '' +
      '<div class="field">' +
        '<span>' + (opts.title || 'التكرار') + '</span>' +
        '<select name="freq" class="freq-sel">' +
          ['none', 'daily', 'weekly', 'monthly'].map(function (k) {
            return '<option value="' + k + '"' + (freq === k ? ' selected' : '') + '>' + labels[k] + '</option>';
          }).join('') +
        '</select>' +
      '</div>' +
      '<div class="recur-box' + (freq === 'none' ? ' hidden' : '') + '" data-recur>' +
        '<label class="field interval-row">' +
          '<span class="interval-label">كل كم؟</span>' +
          '<input type="number" name="interval" min="1" max="99" value="' + interval + '">' +
        '</label>' +
        '<div class="days-block' + (freq === 'weekly' ? '' : ' hidden') + '" data-days>' +
          '<span class="muted small">في أي أيام؟</span>' +
          '<div class="days">' + U.WEEKDAYS_SHORT.map(function (d, i) {
            return '<label class="day"><input type="checkbox" name="rday" value="' + i + '"' +
              (days.indexOf(i) > -1 ? ' checked' : '') + '><span>' + d + '</span></label>';
          }).join('') + '</div>' +
        '</div>' +
        '<label class="field"><span>يتكرر حتى (اختياري — اتركه فارغًا ليستمر)</span>' +
          '<input type="date" name="until" value="' + (rec.until || '') + '"></label>' +
        '<p class="recur-preview muted small" data-preview></p>' +
      '</div>';
  }

  /* ربط سلوك حقول التكرار + معاينة حيّة */
  function wireRecur(root, anchorInputName) {
    const freqSel = root.querySelector('.freq-sel');
    const box = root.querySelector('[data-recur]');
    const daysBlock = root.querySelector('[data-days]');
    const intervalLabel = root.querySelector('.interval-label');
    const preview = root.querySelector('[data-preview]');
    if (!freqSel) return;
    // "كم" يتبعها مفرد منصوب: كل كم يومًا؟
    const UNITS = { daily: 'كل كم يومًا؟', weekly: 'كل كم أسبوعًا؟', monthly: 'كل كم شهرًا؟' };

    function anchor() {
      const el = root.querySelector('[name="' + anchorInputName + '"]');
      return (el && el.value) || U.todayISO();
    }

    function readRecur() {
      return {
        freq: freqSel.value,
        interval: Math.max(1, Number(root.querySelector('[name="interval"]').value) || 1),
        days: Array.prototype.map.call(root.querySelectorAll('input[name="rday"]:checked'),
          function (i) { return Number(i.value); }),
        until: root.querySelector('[name="until"]').value || '',
        skip: []
      };
    }

    function refresh() {
      const f = freqSel.value;
      box.classList.toggle('hidden', f === 'none');
      daysBlock.classList.toggle('hidden', f !== 'weekly');
      intervalLabel.textContent = UNITS[f] || 'كل كم؟';
      if (f === 'none') { preview.textContent = ''; return; }
      const rec = readRecur();
      const a = anchor();
      const next = Store.recurDates(a, rec, U.todayISO(), U.addDays(U.todayISO(), 400)).slice(0, 4);
      preview.textContent = next.length
        ? UI.recurLabel(rec) + ' — المرّات القادمة: ' +
          next.map(function (d) { return U.fmtDate(d); }).join(' · ')
        : 'ما فيه مرّات قادمة — راجع تاريخ البداية أو «يتكرر حتى».';
    }

    root.addEventListener('change', refresh);
    root.addEventListener('input', function (e) {
      if (e.target.name === 'interval') refresh();
    });
    refresh();
    return readRecur;
  }

  /* ---------------- حدث ---------------- */
  function eventForm(ev, presetDate) {
    ev = ev || {};
    const rec = ev.recur || { freq: 'none', days: [], until: '' };
    return '' +
      '<form id="evForm" class="form">' +
        '<label class="field"><span>العنوان</span>' +
          '<input name="title" required placeholder="مثال: جلسة تصوير عائلة الأحمد" value="' + U.escapeHTML(ev.title || '') + '"></label>' +
        '<div class="row">' +
          '<label class="field"><span>المجال</span><select name="contextId">' + ctxOptions(ev.contextId) + '</select></label>' +
          '<label class="field"><span>النوع</span><select name="type">' + typeOptions(ev.type || 'meeting') + '</select></label>' +
        '</div>' +
        '<div class="row">' +
          '<label class="field"><span>التاريخ</span><input type="date" name="date" required value="' + (ev.date || presetDate || U.todayISO()) + '"></label>' +
          '<label class="field"><span>من</span><input type="time" name="start" value="' + (ev.start || '') + '"></label>' +
          '<label class="field"><span>إلى</span><input type="time" name="end" value="' + (ev.end || '') + '"></label>' +
        '</div>' +
        '<label class="field"><span>المكان</span><input name="location" placeholder="اختياري" value="' + U.escapeHTML(ev.location || '') + '"></label>' +
        '<div class="row">' +
          '<label class="field"><span>المبلغ (للجلسات والأعمال المدفوعة)</span>' +
            '<input type="number" name="amount" min="0" step="1" placeholder="0" value="' + (ev.amount || '') + '"></label>' +
          '<label class="field checkbox"><input type="checkbox" name="paid"' + (ev.paid ? ' checked' : '') + '><span>تم تحصيل المبلغ</span></label>' +
        '</div>' +
        recurFields(rec) +
        '<label class="field"><span>ملاحظات</span><textarea name="notes" rows="2" placeholder="تفاصيل، أرقام تواصل، متطلبات...">' + U.escapeHTML(ev.notes || '') + '</textarea></label>' +
        '<div class="form-actions">' +
          '<button type="submit" class="btn btn-primary">حفظ</button>' +
          (ev.id ? '<button type="button" class="btn btn-danger" id="evDelete">حذف</button>' : '') +
          '<button type="button" class="btn btn-ghost" data-close>إلغاء</button>' +
        '</div>' +
      '</form>';
  }

  function openEventForm(ev, presetDate, onSaved) {
    UI.openModal(ev && ev.id ? 'تعديل موعد' : 'موعد جديد', eventForm(ev, presetDate), function (root) {
      const readRecur = wireRecur(root, 'date');

      root.querySelector('#evForm').addEventListener('submit', function (e) {
        e.preventDefault();
        const f = new FormData(e.target);
        const recur = readRecur();
        recur.skip = (ev && ev.recur && ev.recur.skip) || [];
        const payload = {
          id: ev && ev.id ? ev.id : undefined,
          title: (f.get('title') || '').trim(),
          contextId: f.get('contextId'),
          type: f.get('type'),
          date: f.get('date'),
          start: f.get('start') || '',
          end: f.get('end') || '',
          location: (f.get('location') || '').trim(),
          amount: Number(f.get('amount') || 0),
          paid: !!f.get('paid'),
          notes: (f.get('notes') || '').trim(),
          recur: recur
        };
        Store.saveEvent(payload);
        UI.closeModal();
        UI.toast('تم حفظ الموعد ✔');
        if (onSaved) onSaved();
      });

      const del = root.querySelector('#evDelete');
      if (del) del.addEventListener('click', function () {
        UI.confirmBox('حذف "' + ev.title + '" نهائيًا؟', function () {
          Store.deleteEvent(ev.id);
          UI.toast('حُذف الموعد');
          if (onSaved) onSaved();
        });
      });
    });
  }

  /* ---------------- مهمة ---------------- */
  function taskForm(t) {
    t = t || {};
    const rec = t.recur || { freq: 'none', days: [], interval: 1, until: '' };
    const repeating = rec.freq && rec.freq !== 'none';
    return '' +
      '<form id="tkForm" class="form">' +
        '<label class="field"><span>المهمة</span>' +
          '<input name="title" required placeholder="مثال: تسليم تقرير الفريق" value="' + U.escapeHTML(t.title || '') + '"></label>' +
        '<div class="row">' +
          '<label class="field"><span>المجال</span><select name="contextId">' + ctxOptions(t.contextId) + '</select></label>' +
          '<label class="field"><span>الأولوية</span><select name="priority">' + prOptions(t.priority || 'mid') + '</select></label>' +
        '</div>' +
        '<div class="row">' +
          '<label class="field"><span>' + (repeating ? 'تبدأ من' : 'الموعد النهائي') + '</span>' +
            '<input type="date" name="due" value="' + (t.due || '') + '"></label>' +
          '<label class="field"><span>الوقت المتوقع</span><input name="estimate" placeholder="مثال: ساعة" value="' + U.escapeHTML(t.estimate || '') + '"></label>' +
        '</div>' +
        recurFields(rec, {
          title: 'تتكرر؟',
          labels: { none: 'مرة واحدة', daily: 'يوميًا', weekly: 'أسبوعيًا', monthly: 'شهريًا' }
        }) +
        '<label class="field"><span>ملاحظات</span><textarea name="notes" rows="2">' + U.escapeHTML(t.notes || '') + '</textarea></label>' +
        '<div class="form-actions">' +
          '<button type="submit" class="btn btn-primary">حفظ</button>' +
          (t.id ? '<button type="button" class="btn btn-danger" id="tkDelete">حذف</button>' : '') +
          '<button type="button" class="btn btn-ghost" data-close>إلغاء</button>' +
        '</div>' +
      '</form>';
  }

  function openTaskForm(t, onSaved) {
    UI.openModal(t && t.id ? 'تعديل مهمة' : 'مهمة جديدة', taskForm(t), function (root) {
      const readRecur = wireRecur(root, 'due');
      const dueLabel = root.querySelector('[name="due"]').closest('.field').querySelector('span');
      root.querySelector('.freq-sel').addEventListener('change', function (e) {
        dueLabel.textContent = e.target.value === 'none' ? 'الموعد النهائي' : 'تبدأ من';
      });

      root.querySelector('#tkForm').addEventListener('submit', function (e) {
        e.preventDefault();
        const f = new FormData(e.target);
        const recur = readRecur();
        recur.skip = (t && t.recur && t.recur.skip) || [];
        const repeating = recur.freq !== 'none';
        if (repeating && !f.get('due')) {
          UI.toast('حدّد تاريخ البداية للمهمة المتكرّرة', 'err');
          return;
        }
        Store.saveTask({
          id: t && t.id ? t.id : undefined,
          title: (f.get('title') || '').trim(),
          contextId: f.get('contextId'),
          priority: f.get('priority'),
          due: f.get('due') || '',
          estimate: (f.get('estimate') || '').trim(),
          notes: (f.get('notes') || '').trim(),
          recur: recur,
          occ: (t && t.occ) || {},
          done: repeating ? false : (t ? !!t.done : false),
          doneAt: repeating ? null : (t ? t.doneAt : null),
          doneDate: repeating ? null : (t ? t.doneDate : null)
        });
        UI.closeModal();
        UI.toast('تم حفظ المهمة ✔');
        if (onSaved) onSaved();
      });
      const del = root.querySelector('#tkDelete');
      if (del) del.addEventListener('click', function () {
        UI.confirmBox('حذف المهمة "' + t.title + '"؟', function () {
          Store.deleteTask(t.id);
          UI.toast('حُذفت المهمة');
          if (onSaved) onSaved();
        });
      });
    });
  }

  /* ---------------- مجال ---------------- */
  function openContextForm(ctx, onSaved) {
    ctx = ctx || {};
    const palette = ['#2563eb', '#0d9488', '#7c3aed', '#b45309', '#db2777', '#059669', '#dc2626', '#475569', '#0891b2', '#ca8a04'];
    const html = '' +
      '<form id="ctxForm" class="form">' +
        '<label class="field"><span>اسم المجال</span><input name="name" required value="' + U.escapeHTML(ctx.name || '') + '"></label>' +
        '<div class="row">' +
          '<label class="field"><span>دوري فيه</span><input name="role" placeholder="مثال: مدير" value="' + U.escapeHTML(ctx.role || '') + '"></label>' +
          '<label class="field"><span>الرمز</span><input name="icon" maxlength="2" value="' + U.escapeHTML(ctx.icon || '📌') + '"></label>' +
        '</div>' +
        '<div class="field"><span>اللون</span><div class="swatches">' +
          palette.map(function (c) {
            return '<label class="swatch" style="--s:' + c + '"><input type="radio" name="color" value="' + c + '"' +
              (ctx.color === c ? ' checked' : '') + '><i></i></label>';
          }).join('') + '</div></div>' +
        '<div class="form-actions">' +
          '<button type="submit" class="btn btn-primary">حفظ</button>' +
          (ctx.id ? '<button type="button" class="btn btn-danger" id="ctxDelete">حذف</button>' : '') +
          '<button type="button" class="btn btn-ghost" data-close>إلغاء</button>' +
        '</div>' +
      '</form>';

    UI.openModal(ctx.id ? 'تعديل مجال' : 'مجال جديد', html, function (root) {
      if (!ctx.color) { const first = root.querySelector('input[name="color"]'); if (first) first.checked = true; }
      root.querySelector('#ctxForm').addEventListener('submit', function (e) {
        e.preventDefault();
        const f = new FormData(e.target);
        Store.saveContext({
          id: ctx.id,
          name: (f.get('name') || '').trim(),
          role: (f.get('role') || '').trim(),
          icon: (f.get('icon') || '📌').trim(),
          color: f.get('color') || '#2563eb'
        });
        UI.closeModal();
        UI.toast('تم الحفظ ✔');
        if (onSaved) onSaved();
      });
      const del = root.querySelector('#ctxDelete');
      if (del) del.addEventListener('click', function () {
        UI.confirmBox('حذف المجال "' + ctx.name + '"؟ (المواعيد والمهام المرتبطة تبقى لكن بدون مجال)', function () {
          Store.deleteContext(ctx.id);
          if (onSaved) onSaved();
        });
      });
    });
  }

  /* ---------------- إضافة سريعة ---------------- */
  function openQuickAdd(presetDate, onSaved) {
    const html = '' +
      '<div class="quick-choice">' +
        '<button class="quick-btn" id="qEvent"><span>📅</span><strong>موعد / حدث</strong>' +
          '<small>اجتماع، جلسة تصوير، اختبار، دوام</small></button>' +
        '<button class="quick-btn" id="qTask"><span>✅</span><strong>مهمة</strong>' +
          '<small>شيء لازم أخلّصه وأعلّم عليه</small></button>' +
      '</div>';
    UI.openModal('إضافة جديدة', html, function (root) {
      root.querySelector('#qEvent').onclick = function () { openEventForm(null, presetDate, onSaved); };
      root.querySelector('#qTask').onclick = function () { openTaskForm(null, onSaved); };
    });
  }

  global.Forms = { openEventForm, openTaskForm, openContextForm, openQuickAdd };
})(window);
