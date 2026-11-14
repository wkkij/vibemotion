// Нижняя панель со слоями (таймлайн). Ничего не знает про рендер: получает сцену и колбэки.
(function () {
  const $ = (id) => document.getElementById(id);
  const MIN_PPS = 0.02, MAX_PPS = 2; // пикселей на миллисекунду
  const HDR = 164;

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  const EYE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  const EYE_OFF = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.9 17.9A10.9 10.9 0 0112 19C5 19 1 12 1 12a18 18 0 015.1-5.9M9.9 4.2A10.7 10.7 0 0112 4c7 0 11 8 11 8a18 18 0 01-2.2 3.2M1 1l22 22"/></svg>';

  function create(api) {
    // api: { getScene, getTime, seek(ms), select(id), toggleHidden(id), mediaIndex(L) }
    const scroll = $('tl-scroll'), inner = $('tl-inner'), ticks = $('ticks'), tracks = $('tracks');
    const playhead = $('playhead'), zoomEl = $('zoom'), empty = $('tl-empty');
    const snapGuide = el('div', 'snap-guide');
    snapGuide.hidden = true;
    inner.append(snapGuide);
    const beatLayer = el('div', '');
    beatLayer.id = 'beat-layer';
    inner.append(beatLayer);
    let pps = 0.1, scene = null, rows = new Map(), lastLive = '';

    const zoomToPps = (z) => MIN_PPS * Math.pow(MAX_PPS / MIN_PPS, z / 100);
    const ppsToZoom = (p) => (Math.log(p / MIN_PPS) / Math.log(MAX_PPS / MIN_PPS)) * 100;
    const msToX = (ms) => ms * pps;

    function fmtTime(ms) {
      const s = ms / 1000;
      return s >= 60 ? Math.floor(s / 60) + ':' + (s % 60).toFixed(1).padStart(4, '0') : s.toFixed(s < 10 ? 2 : 1) + 'с';
    }

    function drawRuler() {
      ticks.textContent = '';
      if (!scene) return;
      const width = Math.ceil(msToX(scene.totalTime)) + 80;
      ticks.style.width = width + 'px';
      const steps = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 30000, 60000];
      const step = steps.find((s) => s * pps >= 70) || 60000; // подпись не чаще раза в ~70 px
      const minor = step / 5;
      for (let t = 0; t <= scene.totalTime + step; t += minor) {
        const major = Math.round(t / minor) % 5 === 0;
        const tk = el('div', 'tick' + (major ? ' major' : ''));
        tk.style.left = msToX(t) + 'px';
        if (major) tk.append(el('span', 'lb', fmtTime(t)));
        ticks.append(tk);
      }
      drawBeats();
    }

    // метки битов: ромбики на линейке (клик — перейти, Alt+клик / ПКМ — убрать) и тонкие линии через все дорожки
    function drawBeats() {
      beatLayer.textContent = '';
      for (const m of ticks.querySelectorAll('.beat-mark')) m.remove();
      const beats = scene && Array.isArray(scene.beats) ? scene.beats : [];
      beatLayer.style.left = HDR + 'px';
      for (const ms of beats) {
        const line = el('div', 'beat-line');
        line.style.left = msToX(ms) + 'px';
        beatLayer.append(line);
        const mark = el('div', 'beat-mark');
        mark.style.left = msToX(ms) + 'px';
        mark.title = 'Метка бита ' + fmtTime(ms) + ' — клик: перейти, Alt+клик или ПКМ: убрать';
        mark.addEventListener('pointerdown', (e) => e.stopPropagation()); // не скрабить линейку
        mark.addEventListener('click', (e) => {
          if (e.altKey) api.beatAction && api.beatAction(ms, 'remove');
          else api.seek(ms);
        });
        mark.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          api.beatAction && api.beatAction(ms, 'remove');
        });
        ticks.append(mark);
      }
    }

    // показать время ms в видимой части таймлайна
    function reveal(ms) {
      const x = HDR + msToX(ms), left = scroll.scrollLeft, w = scroll.clientWidth;
      if (x > left + w - 40 || x < left + HDR) scroll.scrollLeft = Math.max(0, x - HDR - 60);
    }

    function layout() {
      if (!scene) return;
      const width = Math.ceil(msToX(scene.totalTime)) + 80;
      inner.style.width = HDR + width + 'px';
      for (const [, r] of rows) {
        r.lane.style.width = width + 'px';
        r.clip.style.left = msToX(r.L.start) + 'px';
        r.clip.style.width = Math.max(4, msToX(r.L.end + 1 - r.L.start)) + 'px';
      }
      drawRuler();
      placePlayhead();
    }

    function placePlayhead() {
      playhead.style.transform = 'translateX(' + (HDR + msToX(api.getTime())) + 'px)';
    }

    function showSnap(ms) {
      if (ms === null || ms === undefined) {
        snapGuide.hidden = true;
        return;
      }
      snapGuide.hidden = false;
      snapGuide.style.transform = 'translateX(' + (HDR + msToX(ms)) + 'px)';
    }

    function collectSnapTargets(excludeIds) {
      const pts = [0, Math.round(api.getTime())];
      if (!scene) return pts;
      for (const L of scene.layers) {
        if (excludeIds && excludeIds.has(L.id)) continue;
        pts.push(L.start, L.end + 1);
      }
      if (Array.isArray(scene.beats)) pts.push(...scene.beats); // слои прилипают к меткам битов
      return pts;
    }

    function snapMs(rawMs, targets, disabled) {
      if (disabled) return { ms: rawMs, snapped: null };
      const tol = 8 / pps;
      let best = rawMs, bestDist = tol, snapped = null;
      for (const t of targets) {
        const d = Math.abs(rawMs - t);
        if (d < bestDist) {
          bestDist = d;
          best = t;
          snapped = t;
        }
      }
      return { ms: best, snapped };
    }

    function startClipDrag(e, L, mode) {
      if (!scene || e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      api.select(L.id, false, e);

      const selIds = api.getSelectedIds ? api.getSelectedIds() : new Set([L.id]);
      const movingIds = mode === 'move' && selIds.has(L.id) ? selIds : new Set([L.id]);
      const orig = new Map();
      for (const id of movingIds) {
        const item = scene.layers.find((x) => x.id === id);
        if (item) orig.set(id, { start: item.start, end: item.end, inTime: item.inTime || 0 });
      }
      const base = orig.get(L.id);
      if (!base) return;
      const startX = e.clientX;
      const targets = collectSnapTargets(movingIds);
      let changed = false;

      const move = (ev) => {
        const dxMs = (ev.clientX - startX) / pps;
        const noSnap = ev.altKey;
        if (mode === 'move') {
          let delta = Math.round(dxMs);
          const sStart = snapMs(base.start + delta, targets, noSnap);
          const sEnd = snapMs(base.end + 1 + delta, targets, noSnap);
          if (sStart.snapped !== null && (sEnd.snapped === null || Math.abs(sStart.ms - (base.start + delta)) <= Math.abs(sEnd.ms - (base.end + 1 + delta)))) {
            delta = sStart.ms - base.start;
            showSnap(sStart.snapped);
          } else if (sEnd.snapped !== null) {
            delta = sEnd.ms - (base.end + 1);
            showSnap(sEnd.snapped);
          } else {
            showSnap(null);
          }
          let minStart = Infinity;
          for (const v of orig.values()) minStart = Math.min(minStart, v.start);
          if (minStart + delta < 0) delta = -minStart;
          for (const [id, v] of orig) {
            const item = scene.layers.find((x) => x.id === id);
            if (!item) continue;
            item.start = Math.round(v.start + delta);
            item.end = Math.round(v.end + delta);
          }
          changed = true;
        } else if (mode === 'trim-l') {
          const rawStart = Math.round(base.start + dxMs);
          const sn = snapMs(rawStart, targets, noSnap);
          const minAllowed = Math.max(0, base.start - base.inTime);
          const nextStart = Math.max(minAllowed, Math.min(base.end - 40, Math.round(sn.ms)));
          showSnap(sn.snapped !== null && nextStart === Math.round(sn.ms) ? sn.snapped : null);
          const diff = nextStart - base.start;
          L.start = nextStart;
          L.inTime = Math.max(0, base.inTime + diff);
          changed = true;
        } else if (mode === 'trim-r') {
          const rawEnd = Math.round(base.end + 1 + dxMs);
          const sn = snapMs(rawEnd, targets, noSnap);
          const nextEnd = Math.max(base.start + 40, Math.round(sn.ms) - 1);
          showSnap(sn.snapped !== null && nextEnd + 1 === Math.round(sn.ms) ? sn.snapped : null);
          L.end = nextEnd;
          changed = true;
        }
        let maxEnd = 0;
        for (const item of scene.layers) maxEnd = Math.max(maxEnd, item.end + 1);
        scene.totalTime = Math.max(100, maxEnd);
        layout();
        if (api.onLayersChanged) api.onLayersChanged(false);
      };

      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        showSnap(null);
        if (changed && api.onLayersChanged) api.onLayersChanged(true);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    }

    function startReorderDrag(e, L) {
      if (!scene || e.button !== 0 || e.target.closest('.eye')) return;
      const startY = e.clientY;
      let dragging = false;
      let dropIndex = -1;
      const revLayers = () => scene.layers.slice().reverse();

      const clearMarkers = () => {
        for (const [, r] of rows) r.track.classList.remove('drop-above', 'drop-below', 'reordering');
      };

      const move = (ev) => {
        if (!dragging && Math.abs(ev.clientY - startY) < 6) return;
        dragging = true;
        clearMarkers();
        const srcRow = rows.get(L.id);
        if (srcRow) srcRow.track.classList.add('reordering');
        const list = revLayers();
        dropIndex = list.length;
        for (let i = 0; i < list.length; i++) {
          const r = rows.get(list[i].id);
          if (!r) continue;
          const rect = r.track.getBoundingClientRect();
          if (ev.clientY < rect.top + rect.height / 2) {
            dropIndex = i;
            r.track.classList.add('drop-above');
            break;
          }
          if (i === list.length - 1) r.track.classList.add('drop-below');
        }
      };

      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        clearMarkers();
        if (!dragging || dropIndex < 0) return;
        const list = revLayers();
        const from = list.findIndex((x) => x.id === L.id);
        if (from < 0) return;
        const [item] = list.splice(from, 1);
        const target = dropIndex > from ? dropIndex - 1 : dropIndex;
        list.splice(Math.max(0, Math.min(list.length, target)), 0, item);
        scene.layers = list.reverse();
        build(scene, true);
        if (api.onLayersChanged) api.onLayersChanged(true);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    }

    function build(newScene, keep) {
      scene = newScene;
      rows.clear();
      tracks.textContent = '';
      empty.classList.toggle('hide', !!scene);
      if (!scene) return;
      // как в Alight Motion: последний слой в XML лежит сверху, поэтому показываем в обратном порядке
      for (const L of scene.layers.slice().reverse()) {
        const track = el('div', 'track' + (L.hidden ? ' hid' : ''));
        const head = el('div', 'thead');
        const eye = el('button', 'eye'); eye.innerHTML = L.hidden ? EYE_OFF : EYE;
        eye.title = 'Показать / скрыть слой';
        eye.addEventListener('click', (e) => { e.stopPropagation(); api.toggleHidden(L.id); });
        const nameEl = el('span', 'name', L.label || L.id);
        nameEl.title = 'Двойной клик — переименовать, потяните вверх/вниз — изменить порядок';
        nameEl.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          if (api.renameLayer) api.renameLayer(L.id);
        });
        head.append(eye, nameEl);
        head.addEventListener('click', (e) => api.select(L.id, true, e));
        head.addEventListener('pointerdown', (e) => startReorderDrag(e, L));
        const lane = el('div', 'lane');
        const clip = el('div', 'clip');
        clip.style.setProperty('--c', 'var(--c' + (api.colorIndex(L) % 4) + ')');
        clip.title = (L.label || L.id) + '\nТяните клип для сдвига (Alt — без привязки), края — для обрезки';
        const trimL = el('div', 'trim-h left');
        const trimR = el('div', 'trim-h right');
        const clipLabel = el('span', 'clip-txt', L.label || L.id);
        trimL.addEventListener('pointerdown', (e) => startClipDrag(e, L, 'trim-l'));
        trimR.addEventListener('pointerdown', (e) => startClipDrag(e, L, 'trim-r'));
        clip.addEventListener('pointerdown', (e) => {
          if (e.target.closest('.trim-h')) return;
          startClipDrag(e, L, 'move');
        });
        clip.append(trimL, clipLabel, trimR);
        lane.append(clip);
        track.append(head, lane);
        tracks.append(track);
        rows.set(L.id, { L, track, lane, clip, eye });
      }
      if (!keep) {
        pps = Math.min(MAX_PPS, Math.max(MIN_PPS, fitPps()));
        zoomEl.value = ppsToZoom(pps);
      }
      layout();
      if (!keep) scroll.scrollLeft = 0;
    }

    function fitPps() {
      if (!scene || !scene.totalTime) return 0.1;
      return Math.max(MIN_PPS, (scroll.clientWidth - HDR - 40) / scene.totalTime);
    }

    function setZoom(newPps, anchorMs) {
      if (!scene) return;
      newPps = Math.min(MAX_PPS, Math.max(MIN_PPS, newPps));
      const ax = anchorMs === undefined ? api.getTime() : anchorMs;
      const screenX = HDR + msToX(ax) - scroll.scrollLeft; // где якорь на экране сейчас
      pps = newPps;
      zoomEl.value = ppsToZoom(pps);
      layout();
      scroll.scrollLeft = HDR + msToX(ax) - screenX;
    }

    // ----- скраб по линейке и по дорожкам -----
    function msFromEvent(e) {
      const rect = inner.getBoundingClientRect();
      return (e.clientX - rect.left - HDR) / pps;
    }
    function startScrub(e) {
      if (!scene || e.button !== 0) return;
      e.preventDefault();
      api.seek(msFromEvent(e));
      const move = (ev) => api.seek(msFromEvent(ev));
      const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    }
    ticks.addEventListener('pointerdown', startScrub);
    tracks.addEventListener('pointerdown', (e) => { if (e.target.closest('.lane')) startScrub(e); });

    // ----- зум -----
    zoomEl.addEventListener('input', () => setZoom(zoomToPps(Number(zoomEl.value))));
    $('zoomin').addEventListener('click', () => setZoom(pps * 1.4));
    $('zoomout').addEventListener('click', () => setZoom(pps / 1.4));
    $('fit').addEventListener('click', () => { setZoom(fitPps()); scroll.scrollLeft = 0; });
    scroll.addEventListener('wheel', (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const ms = msFromEvent(e);
      setZoom(pps * (e.deltaY < 0 ? 1.15 : 1 / 1.15), ms);
    }, { passive: false });

    // ----- каждый кадр -----
    function update(playing) {
      if (!scene) return;
      const t = api.getTime();
      placePlayhead();
      if (playing) { // держим плейхед в поле зрения
        const x = HDR + msToX(t), left = scroll.scrollLeft, w = scroll.clientWidth;
        if (x > left + w - 40 || x < left + HDR) scroll.scrollLeft = Math.max(0, x - HDR - 60);
      }
      const live = [];
      for (const [id, r] of rows) if (!r.L.hidden && t >= r.L.start && t < r.L.end + 1) live.push(id);
      const key = live.join(',');
      if (key !== lastLive) {
        lastLive = key;
        const set = new Set(live);
        for (const [id, r] of rows) r.clip.classList.toggle('live', set.has(id));
      }
    }

    function refreshRow(id) {
      const r = rows.get(id);
      if (!r) return;
      r.track.classList.toggle('hid', !!r.L.hidden);
      r.eye.innerHTML = r.L.hidden ? EYE_OFF : EYE;
      const nameEl = r.track.querySelector('.thead .name');
      if (nameEl) nameEl.textContent = r.L.label || r.L.id;
      const clipTxt = r.clip.querySelector('.clip-txt');
      if (clipTxt) clipTxt.textContent = r.L.label || r.L.id;
      lastLive = '';
    }
    function setSelected(ids, primaryId) {
      const set = ids instanceof Set ? ids : new Set(ids ? [ids] : []);
      for (const [rid, r] of rows) {
        r.track.classList.toggle('sel', set.has(rid));
        r.track.classList.toggle('primary', rid === primaryId);
      }
    }

    window.addEventListener('resize', () => { if (scene) layout(); });
    return { build, update, refreshRow, setSelected, refreshBeats: drawBeats, reveal };
  }

  window.VM = window.VM || {};
  window.VM.Timeline = { create };
})();
