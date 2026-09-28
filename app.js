/* Smertedagbog – al data gemmes lokalt i browseren (localStorage). */
(function () {
  'use strict';

  var KEY = 'smertedagbog.entries.v1';
  var META_KEY = 'smertedagbog.meta.v1';

  var DAYS = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag'];
  var DAYS_SHORT = ['søn', 'man', 'tir', 'ons', 'tor', 'fre', 'lør'];
  var MONTHS = ['januar', 'februar', 'marts', 'april', 'maj', 'juni', 'juli',
    'august', 'september', 'oktober', 'november', 'december'];

  /* ---------- Hjælpere ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function str(v) { return typeof v === 'string' ? v : (v == null ? '' : String(v)); }
  function fmtTime(d) { return pad2(d.getHours()) + '.' + pad2(d.getMinutes()); }
  function fmtDay(d, alwaysYear) {
    var s = cap(DAYS[d.getDay()]) + ' ' + d.getDate() + '. ' + MONTHS[d.getMonth()];
    if (alwaysYear || d.getFullYear() !== new Date().getFullYear()) s += ' ' + d.getFullYear();
    return s;
  }
  function dayKey(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function hue(n) { return Math.round(135 - (n - 1) * 15); } // 1 = grøn … 10 = rød
  function dec1(n) { return n.toFixed(1).replace('.', ','); }
  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }
  function isScore(n) { return typeof n === 'number' && n % 1 === 0 && n >= 1 && n <= 10; }

  /* ---------- Lager ---------- */
  function normalize(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var head = Number(raw.head), neck = Number(raw.neck);
    var created = Date.parse(raw.createdAt);
    if (!isScore(head) || !isScore(neck) || isNaN(created)) return null;
    var updated = Date.parse(raw.updatedAt);
    return {
      id: raw.id ? String(raw.id) : '',
      createdAt: new Date(created).toISOString(),
      updatedAt: new Date(isNaN(updated) ? created : updated).toISOString(),
      head: head,
      headWhy: str(raw.headWhy),
      neck: neck,
      neckWhy: str(raw.neckWhy),
      activity: str(raw.activity),
      other: !!raw.other,
      otherText: str(raw.otherText)
    };
  }

  function loadEntries() {
    try {
      var list = JSON.parse(localStorage.getItem(KEY) || '[]');
      if (!Array.isArray(list)) return [];
      return list.map(normalize).filter(function (e) { return e && e.id; });
    } catch (err) { return []; }
  }
  function sortEntries() {
    entries.sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0; });
  }
  function persist() {
    sortEntries();
    try {
      localStorage.setItem(KEY, JSON.stringify(entries));
      return true;
    } catch (err) {
      infoDialog('Kunne ikke gemme', 'Telefonen tillod ikke, at data blev gemt. Hvis du bruger privat browsing i Safari, så åbn appen fra hjemmeskærmen i stedet.');
      return false;
    }
  }
  function loadMeta() {
    try { return JSON.parse(localStorage.getItem(META_KEY) || '{}') || {}; } catch (err) { return {}; }
  }
  function saveMeta() {
    try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch (err) { /* ignorer */ }
  }
  function findEntry(id) {
    for (var i = 0; i < entries.length; i++) if (entries[i].id === id) return entries[i];
    return null;
  }
  function requestPersistentStorage() {
    try {
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
    } catch (err) { /* ignorer */ }
  }

  var entries = loadEntries();
  var meta = loadMeta();
  sortEntries();

  /* ---------- Besked (toast) ---------- */
  var toastTimer = null;
  function toast(text) {
    $('#toast-text').textContent = text;
    $('#toast').hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { $('#toast').hidden = true; }, 2200);
  }

  /* ---------- Dialog ---------- */
  var dlg = $('#dlg');
  var dlgResolve = null;

  function openDialog(opts) {
    return new Promise(function (resolve) {
      if (!dlg.showModal) { // meget gamle browsere
        if (opts.info) { alert(opts.title + '\n\n' + opts.message); resolve(true); return; }
        if (opts.requireText) {
          var v = prompt(opts.title + '\n\n' + opts.message + '\n\n' + opts.requireLabel);
          resolve(!!v && v.trim().toUpperCase() === opts.requireText); return;
        }
        resolve(confirm(opts.title + '\n\n' + opts.message)); return;
      }
      $('#dlg-title').textContent = opts.title;
      $('#dlg-msg').textContent = opts.message || '';
      var ok = $('#dlg-ok'), cancel = $('#dlg-cancel'), input = $('#dlg-input');
      ok.textContent = opts.confirmLabel || 'OK';
      ok.className = 'btn ' + (opts.danger ? 'danger-fill' : 'primary');
      cancel.hidden = !!opts.info;
      $('.dialog-actions', dlg).classList.toggle('single', !!opts.info);
      $('#dlg-req').hidden = !opts.requireText;
      input.value = '';
      ok.disabled = !!opts.requireText;
      if (opts.requireText) {
        $('#dlg-req-label').textContent = opts.requireLabel;
        input.oninput = function () { ok.disabled = input.value.trim().toUpperCase() !== opts.requireText; };
      } else {
        input.oninput = null;
      }
      dlg.returnValue = '';
      dlgResolve = resolve;
      dlg.showModal();
      if (opts.requireText) input.focus();
      else (opts.info ? ok : cancel).focus();
    });
  }
  dlg.addEventListener('close', function () {
    if (dlgResolve) { var r = dlgResolve; dlgResolve = null; r(dlg.returnValue === 'ok'); }
  });
  // Enter i tekstfeltet må ikke bekræfte ved en fejl
  $('#dlg-input').addEventListener('keydown', function (e) { if (e.key === 'Enter') e.preventDefault(); });

  function confirmDialog(opts) { return openDialog(opts); }
  function infoDialog(title, message) { return openDialog({ info: true, title: title, message: message }); }

  /* ---------- Formular (bruges til både ny og redigér) ---------- */
  function scaleHtml(kind, label) {
    var h = '<div class="scale" data-scale="' + kind + '" role="radiogroup" aria-label="' + label + ', 1 til 10">';
    for (var n = 1; n <= 10; n++) {
      var extra = n === 1 ? ', ingen smerter' : n === 10 ? ', værst tænkelige smerter' : '';
      h += '<button type="button" role="radio" aria-checked="false" data-v="' + n + '" style="--h:' + hue(n) +
        '" aria-label="' + n + extra + '">' + n + '</button>';
    }
    return h + '</div><div class="scale-ends" aria-hidden="true"><span>1 = ingen smerter</span><span>10 = værst tænkelige smerter</span></div>';
  }

  function createForm(prefix, isEdit) {
    var form = document.createElement('form');
    form.className = 'entry-form';
    form.noValidate = true;
    form.setAttribute('autocomplete', 'off');
    var p = prefix;
    form.innerHTML =
      (isEdit ?
        '<div class="card q"><label class="q-title" for="' + p + '-time">Tidspunkt</label>' +
        '<input type="datetime-local" id="' + p + '-time"></div>' : '') +

      '<div class="card q" data-q="head" role="group" aria-labelledby="' + p + '-qh">' +
        '<div class="q-title" id="' + p + '-qh"><span class="q-num" aria-hidden="true">1</span>Hvordan har hovedet det?</div>' +
        scaleHtml('head', 'Smerte i hovedet') +
        '<p class="field-error" hidden>Vælg et tal fra 1 til 10.</p>' +
        '<label class="field-label" for="' + p + '-headWhy">Hvorfor? (valgfrit)</label>' +
        '<textarea id="' + p + '-headWhy" rows="2"></textarea>' +
      '</div>' +

      '<div class="card q" data-q="neck" role="group" aria-labelledby="' + p + '-qn">' +
        '<div class="q-title" id="' + p + '-qn"><span class="q-num" aria-hidden="true">2</span>Hvordan har nakken det?</div>' +
        scaleHtml('neck', 'Smerte i nakken') +
        '<p class="field-error" hidden>Vælg et tal fra 1 til 10.</p>' +
        '<label class="field-label" for="' + p + '-neckWhy">Hvorfor? (valgfrit)</label>' +
        '<textarea id="' + p + '-neckWhy" rows="2"></textarea>' +
      '</div>' +

      '<div class="card q">' +
        '<label class="q-title" for="' + p + '-activity"><span class="q-num" aria-hidden="true">3</span>Hvad laver du/har du lavet i dag?</label>' +
        '<textarea id="' + p + '-activity" rows="3"></textarea>' +
      '</div>' +

      '<div class="card q" role="group" aria-labelledby="' + p + '-qo">' +
        '<div class="q-title" id="' + p + '-qo"><span class="q-num" aria-hidden="true">4</span>Andet?</div>' +
        '<div class="segmented" role="radiogroup" aria-labelledby="' + p + '-qo">' +
          '<button type="button" role="radio" data-other="yes" aria-checked="false">Ja</button>' +
          '<button type="button" role="radio" data-other="no" aria-checked="true">Nej</button>' +
        '</div>' +
        '<div class="other-wrap" hidden>' +
          '<label class="field-label" for="' + p + '-otherText">Skriv hvad du vil notere</label>' +
          '<textarea id="' + p + '-otherText" rows="3"></textarea>' +
        '</div>' +
      '</div>' +

      '<div class="form-actions">' +
        '<button type="submit" class="btn primary big">Gem</button>' +
        (isEdit ? '<button type="button" class="btn" data-action="cancel-edit">Annullér</button>' : '') +
      '</div>';

    var state = { head: null, neck: null, other: false };
    function field(name) { return form.querySelector('#' + p + '-' + name); }

    function setScore(kind, n) {
      state[kind] = n;
      $$('[data-scale="' + kind + '"] button', form).forEach(function (b) {
        b.setAttribute('aria-checked', String(Number(b.dataset.v) === n));
      });
      if (n) showError(kind, false);
    }
    function setOther(on) {
      state.other = on;
      $$('[data-other]', form).forEach(function (b) {
        b.setAttribute('aria-checked', String((b.dataset.other === 'yes') === on));
      });
      $('.other-wrap', form).hidden = !on;
    }
    function showError(kind, on) {
      var q = $('[data-q="' + kind + '"]', form);
      q.classList.toggle('has-error', on);
      $('.field-error', q).hidden = !on;
    }

    form.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b || !form.contains(b)) return;
      var scale = b.closest('[data-scale]');
      if (scale) { setScore(scale.dataset.scale, Number(b.dataset.v)); return; }
      if (b.dataset.other) {
        setOther(b.dataset.other === 'yes');
        if (state.other) field('otherText').focus();
      }
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var missing = ['head', 'neck'].filter(function (k) { return !state[k]; });
      missing.forEach(function (k) { showError(k, true); });
      if (missing.length) {
        if (document.activeElement) document.activeElement.blur();
        $('[data-q="' + missing[0] + '"]', form).scrollIntoView({ block: 'center' });
        return;
      }
      if (api.onSave) api.onSave(api.getData());
    });

    var api = {
      el: form,
      onSave: null,
      getData: function () {
        var d = {
          head: state.head,
          headWhy: field('headWhy').value.trim(),
          neck: state.neck,
          neckWhy: field('neckWhy').value.trim(),
          activity: field('activity').value.trim(),
          other: state.other,
          otherText: state.other ? field('otherText').value.trim() : ''
        };
        if (isEdit) d.time = field('time').value;
        return d;
      },
      setData: function (e) {
        setScore('head', e.head);
        setScore('neck', e.neck);
        field('headWhy').value = e.headWhy || '';
        field('neckWhy').value = e.neckWhy || '';
        field('activity').value = e.activity || '';
        field('otherText').value = e.otherText || '';
        setOther(!!e.other);
        if (isEdit) {
          var d = new Date(e.createdAt);
          field('time').value = d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) +
            'T' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
        }
        showError('head', false);
        showError('neck', false);
      },
      reset: function () {
        form.reset();
        setScore('head', null);
        setScore('neck', null);
        setOther(false);
        showError('head', false);
        showError('neck', false);
      }
    };
    return api;
  }

  // "2026-09-28T14:05" -> Date (lokal tid)
  function parseLocalDateTime(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v || '');
    if (!m) return null;
    var d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
    return isNaN(d.getTime()) ? null : d;
  }

  /* ---------- Visninger / navigation ---------- */
  var views = {
    'new': $('#view-new'),
    history: $('#view-history'),
    detail: $('#view-detail'),
    edit: $('#view-edit'),
    settings: $('#view-settings')
  };
  var tabOf = { 'new': 'new', history: 'history', detail: 'history', edit: 'history', settings: 'settings' };
  var current = 'new';
  var scrollPos = {};

  function show(name, keepScroll) {
    scrollPos[current] = window.pageYOffset;
    Object.keys(views).forEach(function (k) { views[k].hidden = k !== name; });
    current = name;
    $$('.tabbar button').forEach(function (b) {
      if (b.dataset.tab === tabOf[name]) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    if (name === 'new') updateNowLabel();
    if (name === 'history') renderHistory();
    if (name === 'settings') renderSettings();
    window.scrollTo(0, keepScroll ? (scrollPos[name] || 0) : 0);
  }

  $('.tabbar').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-tab]');
    if (!b) return;
    if (document.activeElement) document.activeElement.blur();
    show(b.dataset.tab, false);
  });

  // Skjul fanebladet mens tastaturet er fremme (kun touch)
  if (window.matchMedia && matchMedia('(pointer: coarse)').matches) {
    document.addEventListener('focusin', function (e) {
      if (e.target.matches('textarea, input:not([type="file"])') && !dlg.open) document.body.classList.add('kb-open');
    });
    document.addEventListener('focusout', function () {
      setTimeout(function () {
        var a = document.activeElement;
        if (!a || !a.matches('textarea, input:not([type="file"])')) document.body.classList.remove('kb-open');
      }, 50);
    });
  }

  /* ---------- Ny registrering ---------- */
  var newForm = createForm('n', false);
  $('#new-form-slot').appendChild(newForm.el);

  function updateNowLabel() {
    var d = new Date();
    $('#now-label').textContent = fmtDay(d) + ' · kl. ' + fmtTime(d);
  }
  updateNowLabel();
  setInterval(function () { if (current === 'new') updateNowLabel(); }, 20000);

  newForm.onSave = function (data) {
    var now = new Date().toISOString();
    var entry = {
      id: uid(), createdAt: now, updatedAt: now,
      head: data.head, headWhy: data.headWhy,
      neck: data.neck, neckWhy: data.neckWhy,
      activity: data.activity,
      other: data.other, otherText: data.otherText
    };
    entries.push(entry);
    if (!persist()) {
      entries = entries.filter(function (e) { return e !== entry; });
      return;
    }
    if (document.activeElement) document.activeElement.blur();
    newForm.reset();
    updateNowLabel();
    window.scrollTo(0, 0);
    toast('Gemt ✓');
    requestPersistentStorage();
  };

  /* ---------- Historik ---------- */
  var chartRange = 7;

  function badge(label, n, large) {
    return '<span class="badge' + (large ? ' large' : '') + '" style="--h:' + hue(n) + '">' +
      label + ' <b>' + n + '</b></span>';
  }

  function renderHistory() {
    renderChart();
    var box = $('#history-list');
    if (!entries.length) {
      box.innerHTML = '<div class="card empty">Ingen registreringer endnu.<br>Tryk på «Ny registrering» for at komme i gang.</div>';
      return;
    }
    var html = '', lastKey = null;
    var chev = '<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
    entries.forEach(function (e) {
      var d = new Date(e.createdAt), k = dayKey(d);
      if (k !== lastKey) {
        if (lastKey) html += '</div></div>';
        html += '<div class="day"><h2>' + esc(fmtDay(d)) + '</h2><div class="list">';
        lastKey = k;
      }
      html += '<button type="button" class="row" data-id="' + esc(e.id) + '" aria-label="Kl. ' + fmtTime(d) +
        ', hoved ' + e.head + ', nakke ' + e.neck + '. Vis detaljer">' +
        '<span class="row-time">' + fmtTime(d) + '</span>' +
        '<span class="row-badges">' + badge('Hoved', e.head) + badge('Nakke', e.neck) + '</span>' +
        chev + '</button>';
    });
    html += '</div></div>';
    box.innerHTML = html;
  }

  $('#history-list').addEventListener('click', function (e) {
    var row = e.target.closest('.row[data-id]');
    if (row) openDetail(row.dataset.id);
  });

  $$('[data-range]').forEach(function (b) {
    b.addEventListener('click', function () {
      chartRange = Number(b.dataset.range);
      $$('[data-range]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      renderChart();
    });
  });

  function renderChart() {
    var box = $('#chart');
    var W = Math.max(260, Math.round(box.clientWidth || 320));
    var H = 210;
    var P = { l: 30, r: 10, t: 12, b: 30 };
    var iw = W - P.l - P.r, ih = H - P.t - P.b;
    var today = startOfDay(new Date());
    var start = addDays(today, -(chartRange - 1)).getTime();
    var end = addDays(today, 1).getTime();
    function X(t) { return (P.l + (t - start) / (end - start) * iw).toFixed(1); }
    function Y(v) { return (P.t + (10 - v) / 9 * ih).toFixed(1); }

    var inRange = entries.filter(function (e) {
      var t = Date.parse(e.createdAt); return t >= start && t < end;
    }).slice().reverse(); // ældste først

    var pts;
    if (chartRange === 7) {
      pts = inRange.map(function (e) { return { t: Date.parse(e.createdAt), head: e.head, neck: e.neck }; });
    } else {
      var byDay = {}, order = [];
      inRange.forEach(function (e) {
        var d = new Date(e.createdAt), k = dayKey(d);
        if (!byDay[k]) {
          byDay[k] = { t: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12).getTime(), h: 0, n: 0, c: 0 };
          order.push(k);
        }
        byDay[k].h += e.head; byDay[k].n += e.neck; byDay[k].c++;
      });
      pts = order.map(function (k) {
        var g = byDay[k]; return { t: g.t, head: g.h / g.c, neck: g.n / g.c };
      });
    }

    var s = '';
    // vandrette linjer
    [1, 5, 10].forEach(function (v) {
      s += '<line class="ch-grid" x1="' + P.l + '" x2="' + (W - P.r) + '" y1="' + Y(v) + '" y2="' + Y(v) + '"/>';
      s += '<text class="ch-label" x="' + (P.l - 8) + '" y="' + (Number(Y(v)) + 4) + '" text-anchor="end">' + v + '</text>';
    });
    // dage
    for (var i = 0; i < chartRange; i++) {
      var d = addDays(new Date(start), i);
      var noon = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12).getTime();
      if (chartRange === 7) {
        if (i > 0) s += '<line class="ch-grid" x1="' + X(d.getTime()) + '" x2="' + X(d.getTime()) + '" y1="' + P.t + '" y2="' + (H - P.b) + '"/>';
        s += '<text class="ch-label" x="' + X(noon) + '" y="' + (H - 9) + '" text-anchor="middle">' + DAYS_SHORT[d.getDay()] + '</text>';
      } else if ((chartRange - 1 - i) % 7 === 0) {
        s += '<line class="ch-grid" x1="' + X(noon) + '" x2="' + X(noon) + '" y1="' + (H - P.b) + '" y2="' + (H - P.b + 5) + '"/>';
        s += '<text class="ch-label" x="' + X(noon) + '" y="' + (H - 9) + '" text-anchor="middle">' + d.getDate() + '/' + (d.getMonth() + 1) + '</text>';
      }
    }

    if (!pts.length) {
      s += '<text class="ch-empty" x="' + (P.l + iw / 2) + '" y="' + (P.t + ih / 2) + '" text-anchor="middle">Ingen registreringer i perioden</text>';
    } else {
      ['head', 'neck'].forEach(function (k) {
        var dPath = pts.map(function (pt, j) { return (j ? 'L' : 'M') + X(pt.t) + ' ' + Y(pt[k]); }).join(' ');
        s += '<path class="ch-' + k + '" d="' + dPath + '"/>';
      });
      var r = chartRange === 7 ? 3.8 : 3.2;
      ['head', 'neck'].forEach(function (k) {
        pts.forEach(function (pt) {
          s += '<circle class="pt-' + k + '" cx="' + X(pt.t) + '" cy="' + Y(pt[k]) + '" r="' + r + '"/>';
        });
      });
    }

    var summary = '';
    if (inRange.length) {
      var sh = 0, sn = 0;
      inRange.forEach(function (e) { sh += e.head; sn += e.neck; });
      summary = 'Gennemsnit: hoved ' + dec1(sh / inRange.length) + ' · nakke ' + dec1(sn / inRange.length) +
        (chartRange === 30 ? ' · grafen viser gennemsnit pr. dag' : '');
    }
    var aria = 'Graf over smerter de sidste ' + chartRange + ' dage. ' + (summary || 'Ingen registreringer i perioden.');
    box.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H +
      '" role="img" aria-label="' + esc(aria) + '">' + s + '</svg>';
    $('#chart-summary').textContent = summary;
  }

  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { if (current === 'history') renderChart(); }, 150);
  });

  /* ---------- Detaljer ---------- */
  var currentId = null;

  function textBlock(title, text, emptyText) {
    return '<div class="card detail-block"><h2>' + title + '</h2>' +
      (text ? '<p class="detail-text">' + esc(text) + '</p>' : '<p class="detail-empty">' + emptyText + '</p>') +
      '</div>';
  }

  function scoreBlock(title, n, why) {
    return '<div class="card detail-block"><h2>' + title + '</h2>' +
      '<span class="badge large" style="--h:' + hue(n) + '"><b>' + n + '</b> af 10</span>' +
      (why ? '<p class="detail-text"><span class="why-label">Hvorfor:</span> ' + esc(why) + '</p>' : '') +
      '</div>';
  }

  function openDetail(id) {
    var e = findEntry(id);
    if (!e) { show('history', true); return; }
    currentId = id;
    var d = new Date(e.createdAt);
    $('#detail-body').innerHTML =
      '<header class="view-header"><h1 id="h-detail">' + esc(fmtDay(d)) + '</h1>' +
      '<p class="sub">kl. ' + fmtTime(d) + '</p></header>' +
      scoreBlock('Hvordan har hovedet det?', e.head, e.headWhy) +
      scoreBlock('Hvordan har nakken det?', e.neck, e.neckWhy) +
      textBlock('Hvad laver du/har du lavet i dag?', e.activity, 'Intet skrevet') +
      textBlock('Andet', e.other ? (e.otherText || 'Ja') : '', 'Nej');
    show('detail', false);
  }

  views.detail.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-action]');
    if (!b) return;
    var a = b.dataset.action;
    if (a === 'back-history') show('history', true);
    if (a === 'edit') openEdit(currentId);
    if (a === 'delete') deleteCurrent();
  });

  function deleteCurrent() {
    var e = findEntry(currentId);
    if (!e) return;
    var d = new Date(e.createdAt);
    confirmDialog({
      title: 'Slet registrering?',
      message: 'Registreringen fra ' + fmtDay(d).toLowerCase() + ' kl. ' + fmtTime(d) + ' bliver slettet. Det kan ikke fortrydes.',
      confirmLabel: 'Slet',
      danger: true
    }).then(function (ok) {
      if (!ok) return;
      var before = entries;
      entries = entries.filter(function (x) { return x.id !== currentId; });
      if (!persist()) { entries = before; return; }
      currentId = null;
      show('history', true);
      toast('Slettet');
    });
  }

  /* ---------- Redigér ---------- */
  var editForm = createForm('e', true);
  $('#edit-form-slot').appendChild(editForm.el);

  function openEdit(id) {
    var e = findEntry(id);
    if (!e) return;
    editForm.setData(e);
    show('edit', false);
  }

  views.edit.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-action]');
    if (!b) return;
    if (b.dataset.action === 'back-detail' || b.dataset.action === 'cancel-edit') {
      if (document.activeElement) document.activeElement.blur();
      openDetail(currentId);
    }
  });

  editForm.onSave = function (data) {
    var e = findEntry(currentId);
    if (!e) return;
    var backup = JSON.parse(JSON.stringify(e));
    var t = parseLocalDateTime(data.time);
    if (t) e.createdAt = t.toISOString();
    e.head = data.head; e.headWhy = data.headWhy;
    e.neck = data.neck; e.neckWhy = data.neckWhy;
    e.activity = data.activity;
    e.other = data.other; e.otherText = data.otherText;
    e.updatedAt = new Date().toISOString();
    if (!persist()) { Object.assign(e, backup); return; }
    if (document.activeElement) document.activeElement.blur();
    openDetail(currentId);
    toast('Ændringer gemt');
  };

  /* ---------- Indstillinger ---------- */
  function renderSettings() {
    var n = entries.length;
    var txt = (n === 1 ? '1 registrering' : n + ' registreringer') + ' på denne telefon. ';
    if (meta.lastBackup) {
      var d = new Date(meta.lastBackup);
      txt += 'Seneste backup: ' + fmtDay(d).toLowerCase() + ' kl. ' + fmtTime(d) + '.';
    } else {
      txt += 'Der er ikke taget backup endnu.';
    }
    $('#settings-meta').textContent = txt;
  }

  function isStandalone() {
    return window.navigator.standalone === true ||
      (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
  }

  // Deler via iOS' delemenu, hvis muligt; ellers download.
  function saveFile(filename, text, mime, preferShare) {
    var blob = new Blob([text], { type: mime });
    if (preferShare && navigator.canShare && window.File) {
      var file;
      try { file = new File([blob], filename, { type: mime }); } catch (err) { file = null; }
      if (file && navigator.canShare({ files: [file] })) {
        return navigator.share({ files: [file], title: filename }).then(function () { return 'shared'; }, function (err) {
          if (err && err.name === 'AbortError') return 'cancelled';
          downloadBlob(blob, filename);
          return 'downloaded';
        });
      }
    }
    downloadBlob(blob, filename);
    return Promise.resolve('downloaded');
  }

  function exportJson() {
    if (!entries.length) { infoDialog('Ingen data', 'Der er ingen registreringer at tage backup af endnu.'); return; }
    var data = { app: 'smertedagbog', version: 1, exportedAt: new Date().toISOString(), entries: entries };
    var name = 'smertedagbog-backup-' + dayKey(new Date()) + '.json';
    // I hjemmeskærm-appen på iPhone er delemenuen ("Gem i Filer") den sikre vej til at gemme en fil.
    saveFile(name, JSON.stringify(data, null, 2), 'application/json', isStandalone()).then(function (res) {
      if (res === 'cancelled') return;
      meta.lastBackup = new Date().toISOString();
      saveMeta();
      renderSettings();
      toast('Backup eksporteret');
    });
  }

  function csvCell(v) {
    var s = str(v);
    if (/^[=+@\t\r]/.test(s)) s = "'" + s; // undgå formler i regneark
    if (/[;"\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function exportCsv() {
    if (!entries.length) { infoDialog('Ingen data', 'Der er ingen registreringer at eksportere endnu.'); return; }
    var rows = [['Dato', 'Ugedag', 'Tidspunkt', 'Hoved (1-10)', 'Hoved - hvorfor', 'Nakke (1-10)', 'Nakke - hvorfor',
      'Hvad laver du/har du lavet i dag', 'Andet']];
    entries.slice().reverse().forEach(function (e) {
      var d = new Date(e.createdAt);
      rows.push([
        pad2(d.getDate()) + '-' + pad2(d.getMonth() + 1) + '-' + d.getFullYear(),
        DAYS[d.getDay()],
        fmtTime(d),
        e.head, e.headWhy, e.neck, e.neckWhy, e.activity,
        e.other ? (e.otherText || 'Ja') : ''
      ]);
    });
    // Semikolon + BOM, så dansk Excel viser kolonner og æøå korrekt
    var csv = '﻿' + rows.map(function (r) { return r.map(csvCell).join(';'); }).join('\r\n') + '\r\n';
    saveFile('smertedagbog-' + dayKey(new Date()) + '.csv', csv, 'text/csv', true);
  }

  function importFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var list;
      try {
        var data = JSON.parse(String(reader.result).replace(/^﻿/, ''));
        list = Array.isArray(data) ? data : data && data.entries;
        if (!Array.isArray(list)) throw new Error('format');
      } catch (err) {
        infoDialog('Kunne ikke læse filen', 'Vælg en backup-fil (.json), der er eksporteret fra Smertedagbog.');
        return;
      }
      var byId = {}, bySig = {};
      function sig(e) { return e.createdAt + '|' + e.head + '|' + e.neck; }
      entries.forEach(function (e) { byId[e.id] = e; bySig[sig(e)] = e; });
      var added = 0, updated = 0, same = 0, invalid = 0;
      list.forEach(function (raw) {
        var e = normalize(raw);
        if (!e) { invalid++; return; }
        var existing = (e.id && byId[e.id]) || bySig[sig(e)];
        if (existing) {
          if (e.updatedAt > existing.updatedAt) {
            e.id = existing.id;
            Object.assign(existing, e);
            updated++;
          } else {
            same++;
          }
          return;
        }
        if (!e.id) e.id = uid();
        entries.push(e);
        byId[e.id] = e; bySig[sig(e)] = e;
        added++;
      });
      if (!persist()) { entries = loadEntries(); return; }
      renderSettings();
      var parts = [added + (added === 1 ? ' ny registrering' : ' nye registreringer') + ' tilføjet.'];
      if (updated) parts.push(updated + ' opdateret.');
      if (same) parts.push(same + ' fandtes allerede.');
      if (invalid) parts.push(invalid + ' kunne ikke læses og blev sprunget over.');
      infoDialog('Import færdig', parts.join('\n'));
    };
    reader.onerror = function () {
      infoDialog('Kunne ikke læse filen', 'Prøv igen, eller vælg en anden fil.');
    };
    reader.readAsText(file);
  }

  $('#import-file').addEventListener('change', function () {
    var f = this.files && this.files[0];
    this.value = '';
    if (f) importFile(f);
  });

  function deleteAll() {
    if (!entries.length) { infoDialog('Ingen data', 'Der er ingen registreringer at slette.'); return; }
    confirmDialog({
      title: 'Slet alle data?',
      message: 'Alle ' + entries.length + ' registreringer bliver slettet permanent fra denne telefon. Det kan ikke fortrydes.\n\nOvervej at eksportere en backup først.',
      requireText: 'SLET',
      requireLabel: 'Skriv SLET for at bekræfte',
      confirmLabel: 'Slet alt',
      danger: true
    }).then(function (ok) {
      if (!ok) return;
      var before = entries;
      entries = [];
      if (!persist()) { entries = before; return; }
      renderSettings();
      toast('Alle data er slettet');
    });
  }

  views.settings.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-action]');
    if (!b) return;
    var a = b.dataset.action;
    if (a === 'export-json') exportJson();
    if (a === 'export-csv') exportCsv();
    if (a === 'delete-all') deleteAll();
  });

  // Opdatér hvis dagen skifter, mens appen står åben i baggrunden
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible') return;
    if (current === 'new') updateNowLabel();
    if (current === 'history') renderHistory();
  });

  /* ---------- Offline (service worker) ---------- */
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }
})();
