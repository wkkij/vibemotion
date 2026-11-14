// Граф параметра: кривая значения по времени слоя, ключи (тянутся мышью) и редактор кривой сглаживания (Безье).
(function () {
  const VM = (window.VM = window.VM || {});
  const NS = 'http://www.w3.org/2000/svg';

  function svg(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.append(e);
    return e;
  }
  function html(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const r3 = (x) => Math.round(x * 1000) / 1000;

  const PRESETS = [
    ['Линейно', null],
    ['Плавно (Ease In-Out)', [0.42, 0, 0.58, 1]],
    ['Плавный старт (Ease In)', [0.42, 0, 1, 1]],
    ['Плавный финиш (Ease Out)', [0, 0, 0.58, 1]],
    ['Резкий удар (Snap)', [0.05, 0.95, 0.15, 1]],
    ['Пружина (Overshoot)', [0.18, 1.55, 0.32, 1]],
    ['Отскок (Bounce Back)', [0.34, -0.45, 0.22, 1.38]],
    ['Вылет и торможение', [0.12, 0.92, 0.24, 1]],
  ];

  // meta: { min, max, step } для подписи; getLt(): текущее время слоя 0..1; onEdit(): после любой правки
  function create(p, meta, getLt, onEdit) {
    const root = html('div', 'graph');
    const W = 280, H = 148, PX = 10, PY = 12;
    let sel = 0;
    let frozen = null; // диапазон по Y на время перетаскивания, чтобы график не «прыгал»
    let mode = 'value'; // 'value' | 'speed'

    const topBar = html('div', 'grow');
    const mVal = html('button', 'on', 'Значение');
    const mSpd = html('button', '', 'Скорость');
    mVal.addEventListener('click', () => { mode = 'value'; mVal.classList.add('on'); mSpd.classList.remove('on'); draw(); });
    mSpd.addEventListener('click', () => { mode = 'speed'; mSpd.classList.add('on'); mVal.classList.remove('on'); draw(); });
    topBar.append(mVal, mSpd);
    root.append(topBar);

    const plot = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'gsvg' });
    root.append(plot);
    const detail = html('div', 'gdetail');
    root.append(detail);

    const valAt = (t) => {
      const v = VM.evalProp(p, t);
      return typeof v === 'number' ? v : (Array.isArray(v) ? v[0] : 0);
    };

    const xOf = (t) => PX + clamp(t, 0, 1) * (W - 2 * PX);
    function yRange() {
      if (frozen && mode === 'value') return frozen;
      const vals = [];
      if (mode === 'speed') {
        const eps = 0.005;
        for (let i = 0; i <= 100; i++) {
          const t = i / 100;
          const dv = Math.abs(valAt(Math.min(1, t + eps)) - valAt(Math.max(0, t - eps))) / (2 * eps);
          vals.push(dv);
        }
        vals.push(0);
      } else {
        for (let i = 0; i <= 100; i++) vals.push(valAt(i / 100));
        for (const k of p.kfs) if (typeof k.v === 'number') vals.push(k.v);
      }
      let lo = Math.min(...vals), hi = Math.max(...vals);
      if (!(hi > lo)) { lo -= 1; hi += 1; }
      const pad = (hi - lo) * 0.14;
      return [lo - pad, hi + pad];
    }

    function draw() {
      plot.textContent = '';
      const [lo, hi] = yRange();
      const yOf = (v) => PY + (1 - (v - lo) / (hi - lo)) * (H - 2 * PY);
      const vOf = (y) => hi - ((y - PY) / (H - 2 * PY)) * (hi - lo);
      // сетка: 0..1 по времени и горизонтальные линии
      for (const g of [0, 0.25, 0.5, 0.75, 1]) {
        svg('line', { x1: xOf(g), x2: xOf(g), y1: 0, y2: H, class: 'ggrid' }, plot);
        svg('line', { x1: 0, x2: W, y1: PY + g * (H - 2 * PY), y2: PY + g * (H - 2 * PY), class: 'ggrid' }, plot);
      }
      let d = '';
      const eps = 0.005;
      for (let i = 0; i <= 120; i++) {
        const t = i / 120;
        const v = mode === 'speed'
          ? Math.abs(valAt(Math.min(1, t + eps)) - valAt(Math.max(0, t - eps))) / (2 * eps)
          : valAt(t);
        d += (i ? 'L' : 'M') + xOf(t).toFixed(1) + ' ' + yOf(v).toFixed(1);
      }
      const hitCurve = svg('path', { d, fill: 'none', stroke: 'transparent', 'stroke-width': '14', style: 'cursor:pointer' }, plot);
      hitCurve.addEventListener('pointerdown', (ev) => {
        if (!p.kfs.length) return;
        const rect = plot.getBoundingClientRect();
        const x = ((ev.clientX - rect.left) / rect.width) * W;
        const tClick = clamp((x - PX) / (W - 2 * PX), 0, 1);
        const nextIdx = p.kfs.findIndex((q) => q.t >= tClick);
        if (nextIdx > 0) {
          sel = nextIdx;
          draw();
          drawDetail();
        }
      });
      svg('path', { d, class: 'gcurve', style: 'pointer-events:none' }, plot);
      const lt = clamp(getLt(), 0, 1);
      svg('line', { x1: xOf(lt), x2: xOf(lt), y1: 0, y2: H, class: 'gplayhead' }, plot);
      svg('text', { x: 4, y: 10, class: 'glabel' }, plot).textContent = r3(hi);
      svg('text', { x: 4, y: H - 3, class: 'glabel' }, plot).textContent = r3(lo);

      p.kfs.forEach((k, i) => {
        if (k.t < 0 || k.t > 1 || typeof k.v !== 'number') return;
        const c = svg('circle', { cx: xOf(k.t), cy: yOf(k.v), r: i === sel ? 6 : 5, class: 'gdot' + (i === sel ? ' sel' : '') }, plot);
        c.addEventListener('pointerdown', (ev) => {
          ev.preventDefault(); ev.stopPropagation();
          sel = i;
          frozen = yRange();
          const rect = plot.getBoundingClientRect();
          const move = (e2) => {
            const x = ((e2.clientX - rect.left) / rect.width) * W;
            const y = ((e2.clientY - rect.top) / rect.height) * H;
            const prev = p.kfs[i - 1], next = p.kfs[i + 1];
            let t = (x - PX) / (W - 2 * PX);
            t = clamp(t, prev ? prev.t + 0.001 : 0, next ? next.t - 0.001 : 1);
            p.kfs[i].t = r3(t);
            p.kfs[i].v = r3(vOf(clamp(y, 0, H)));
            draw(); onEdit();
          };
          const up = () => {
            window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
            frozen = null; draw(); drawDetail();
          };
          window.addEventListener('pointermove', move);
          window.addEventListener('pointerup', up);
          drawDetail();
        });
      });
    }

    function drawDetail() {
      detail.textContent = '';
      if (!p.kfs.length) return;
      sel = clamp(sel, 0, p.kfs.length - 1);
      const k = p.kfs[sel];
      const head = html('div', 'grow');
      head.append(html('span', 'muted', 'Ключ ' + (sel + 1) + ' из ' + p.kfs.length));
      const add = html('button', '', '+ ключ здесь');
      add.title = 'Добавить ключ в текущей точке времени';
      add.addEventListener('click', () => {
        const lt = r3(clamp(getLt(), 0, 1));
        if (!p.kfs.some((q) => Math.abs(q.t - lt) < 0.0005)) {
          p.kfs.push({ t: lt, v: VM.evalProp(p, lt), e: null });
          p.kfs.sort((a, b) => a.t - b.t);
          sel = p.kfs.findIndex((q) => q.t === lt);
        }
        draw(); drawDetail(); onEdit();
      });
      const del = html('button', 'danger', 'Удалить ключ');
      del.addEventListener('click', () => {
        const cur = VM.evalProp(p, clamp(getLt(), 0, 1));
        p.kfs.splice(sel, 1);
        if (!p.kfs.length) p.constant = cur;
        onEdit(true); // может понадобиться перерисовать всю панель
        draw(); drawDetail();
      });
      head.append(add, del);
      detail.append(head);

      const nums = html('div', 'grow');
      const tIn = html('input'); tIn.type = 'number'; tIn.step = '0.01'; tIn.value = r3(k.t);
      tIn.addEventListener('change', () => {
        const prev = p.kfs[sel - 1], next = p.kfs[sel + 1];
        k.t = r3(clamp(Number(tIn.value) || 0, prev ? prev.t + 0.001 : -10, next ? next.t - 0.001 : 10));
        draw(); onEdit();
      });
      nums.append(html('span', 'muted', 'время'), tIn);
      if (typeof k.v === 'number') {
        const vIn = html('input'); vIn.type = 'number'; vIn.step = meta.step || 'any'; vIn.value = r3(k.v);
        vIn.addEventListener('change', () => { k.v = Number(vIn.value) || 0; draw(); onEdit(); });
        nums.append(html('span', 'muted', 'значение'), vIn);
      }
      detail.append(nums);

      if (sel > 0) detail.append(easingEditor(k));
      else detail.append(html('div', 'muted', 'Начальный ключ: выберите следующий ключ (2..N), чтобы настроить кривую прихода к нему.'));
    }

    function easingEditor(k) {
      const box = html('div', 'ease');
      const top = html('div', 'grow');
      top.append(html('span', 'muted', 'Кривая к этому ключу'));
      const sel2 = document.createElement('select');
      PRESETS.forEach(([n]) => { const o = document.createElement('option'); o.textContent = n; sel2.append(o); });
      const oc = document.createElement('option'); oc.textContent = 'Своя'; sel2.append(oc);
      const match = () => {
        const i = PRESETS.findIndex(([, e]) => (e === null ? k.e === null : k.e && e.every((v, j) => Math.abs(v - k.e[j]) < 0.001)));
        return i >= 0 ? i : PRESETS.length;
      };
      sel2.selectedIndex = match();
      top.append(sel2);
      box.append(top);

      // Диапазон Y от -1.2 до +2.2 (поддержка пружин с сильным выбросом как в Alight Motion)
      const S = 144, M = 18;
      const Y_MIN = -1.2, Y_MAX = 2.2, Y_SPAN = Y_MAX - Y_MIN;
      const s2 = svg('svg', { viewBox: `0 0 ${S + 2 * M} ${S + 2 * M}`, class: 'esvg' });
      box.append(s2);
      const ex = (x) => M + x * S;
      const ey = (y) => M + (1 - (y - Y_MIN) / Y_SPAN) * S;
      const eyInv = (py) => Y_MIN + (1 - (py - M) / S) * Y_SPAN;

      function drawE() {
        s2.textContent = '';
        svg('rect', { x: ex(0), y: ey(1), width: S, height: ey(0) - ey(1), class: 'ebox' }, s2);
        svg('line', { x1: ex(0), y1: ey(0), x2: ex(1), y2: ey(1), class: 'ediag' }, s2);
        const e = k.e || [0.3333, 0.3333, 0.6667, 0.6667];
        let d = '';
        for (let i = 0; i <= 48; i++) {
          const s = i / 48, m = 1 - s;
          const x = 3 * m * m * s * e[0] + 3 * m * s * s * e[2] + s * s * s;
          const y = 3 * m * m * s * e[1] + 3 * m * s * s * e[3] + s * s * s;
          d += (i ? 'L' : 'M') + ex(x).toFixed(1) + ' ' + ey(y).toFixed(1);
        }
        svg('line', { x1: ex(0), y1: ey(0), x2: ex(e[0]), y2: ey(e[1]), class: 'ehandle-line' }, s2);
        svg('line', { x1: ex(1), y1: ey(1), x2: ex(e[2]), y2: ey(e[3]), class: 'ehandle-line' }, s2);
        svg('path', { d, class: 'ecurve' }, s2);
        [[0, 1], [2, 3]].forEach(([ix, iy]) => {
          const h = svg('circle', { cx: ex(e[ix]), cy: ey(e[iy]), r: 6.5, class: 'ehandle' }, s2);
          h.addEventListener('pointerdown', (ev) => {
            ev.preventDefault(); ev.stopPropagation();
            if (!k.e) k.e = e.slice();
            const rect = s2.getBoundingClientRect();
            const sc = (S + 2 * M) / rect.width;
            const move = (e2) => {
              const px = (e2.clientX - rect.left) * sc, py = (e2.clientY - rect.top) * sc;
              k.e[ix] = r3(clamp((px - M) / S, 0, 1));
              k.e[iy] = r3(clamp(eyInv(py), Y_MIN, Y_MAX));
              sel2.selectedIndex = match();
              drawE(); draw(); onEdit();
            };
            const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
            window.addEventListener('pointermove', move);
            window.addEventListener('pointerup', up);
          });
        });
      }
      sel2.addEventListener('change', () => {
        const i = sel2.selectedIndex;
        if (i < PRESETS.length) { k.e = PRESETS[i][1] ? PRESETS[i][1].slice() : null; drawE(); draw(); onEdit(); }
      });
      drawE();
      return box;
    }

    draw(); drawDetail();
    let lastLt = -1;
    return { el: root, update: () => { const lt = getLt(); if (!frozen && lt !== lastLt) { lastLt = lt; draw(); } } };
  }

  VM.Graph = { create };
})();
