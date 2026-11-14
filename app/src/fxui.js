// Вкладка «Эффекты»: список эффектов слоя, редактирование параметров, ключи и графики.
(function () {
  const VM = (window.VM = window.VM || {});
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const r3 = (x) => Math.round(x * 1000) / 1000;
  const SUP = { yes: '', approx: 'в предпросмотре приблизительно', no: 'в предпросмотре пока не применяется' };

  function rgb01ToHex(r, g, b) {
    const hex = (v) => Math.round(clamp(Number(v) || 0, 0, 1) * 255).toString(16).padStart(2, '0');
    return '#' + hex(r) + hex(g) + hex(b);
  }

  function hexToRgb01(hexStr) {
    const hex = (hexStr || '').replace('#', '');
    if (hex.length !== 6) return [0, 1, 0];
    return [
      r3(parseInt(hex.slice(0, 2), 16) / 255),
      r3(parseInt(hex.slice(2, 4), 16) / 255),
      r3(parseInt(hex.slice(4, 6), 16) / 255),
    ];
  }

  function hueDegToRgb01(deg) {
    const h = (((Number(deg) || 0) % 360) + 360) % 360;
    const x = 1 - Math.abs(((h / 60) % 2) - 1);
    if (h < 60) return [1, x, 0];
    if (h < 120) return [x, 1, 0];
    if (h < 180) return [0, 1, x];
    if (h < 240) return [0, x, 1];
    if (h < 300) return [x, 0, 1];
    return [1, 0, x];
  }

  const USER_PRESETS_KEY = 'vm_user_presets_v1';

  const PRESET_CATS = [
    ['all', 'Все'],
    ['shake', 'Шейки'],
    ['transition', 'Переходы'],
    ['color', 'Цвет и свет'],
    ['other', 'Другое'],
  ];

  const CAT_LABELS = {
    shake: 'Шейк',
    transition: 'Переход',
    color: 'Цвет',
    other: 'Пресет',
  };

  function loadUserPresets() {
    try {
      const raw = localStorage.getItem(USER_PRESETS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (_) {
      return [];
    }
  }

  function saveUserPresets(list) {
    try {
      localStorage.setItem(USER_PRESETS_KEY, JSON.stringify(list));
    } catch (_) {}
  }

  function cloneEffectsDeep(list) {
    return (list || []).map((fx) => ({
      id: fx.id,
      off: !!fx.off,
      attrs: Object.assign({}, fx.attrs || {}),
      props: (fx.props || []).map((p) => ({
        name: p.name,
        ty: p.ty,
        constant: Array.isArray(p.constant) ? p.constant.slice() : p.constant,
        kfs: (p.kfs || []).map((k) => ({
          t: k.t,
          v: Array.isArray(k.v) ? k.v.slice() : k.v,
          e: Array.isArray(k.e) ? k.e.slice() : (k.e || null),
        })),
      })),
    }));
  }

  // ctx: { getLayer(), getLt(), rerender(), copyEffects(L), pasteEffects(), clipboardCount(), selectedCount(), loadEffectsToClipboard(effects, label), applyEffectsList(effects, label) }
  function create(ctx) {
    let live = [];
    const openGraph = new WeakSet();
    let storeModal = null;
    let storeCat = 'all';
    let storeSearch = '';
    let showSaveDrawer = false;

    function getAllPresets() {
      return loadUserPresets().map((u) => {
        const cat = u.cat && CAT_LABELS[u.cat] ? u.cat : 'shake';
        return {
          id: u.id,
          title: u.title,
          cat,
          badge: CAT_LABELS[cat] || 'Мой',
          desc: u.desc || ('Эффектов: ' + (u.effects ? u.effects.length : 0)),
          effects: u.effects || [],
        };
      });
    }

    function saveLayerAsPreset(L) {
      if (!L || !L.effects || !L.effects.length) return;
      openPresetStore('all', true);
    }

    function renderStoreGrid(gridEl) {
      if (!gridEl) return;
      gridEl.textContent = '';
      const all = getAllPresets();
      const q = storeSearch.trim().toLowerCase();
      const items = all.filter((item) => {
        if (storeCat !== 'all' && item.cat !== storeCat) return false;
        if (!q) return true;
        const fxNames = item.effects.map((f) => VM.Effects.title(f.id) + ' ' + VM.Effects.subtitle(f.id)).join(' ').toLowerCase();
        return item.title.toLowerCase().includes(q) || (item.desc || '').toLowerCase().includes(q) || fxNames.includes(q);
      });

      if (!items.length) {
        const emp = el('div', 'pstore-empty');
        emp.append(
          el('b', '', all.length ? 'В этой категории пока пусто' : 'Ваших пресетов и шейков пока нет'),
          el('span', 'muted', all.length
            ? 'Выберите «Все» или сохраните новый пресет в эту категорию.'
            : 'Настройте шейк или эффекты на слое и нажмите «+ В пресеты» во вкладке «Эффекты» — всё сохранится сюда.')
        );
        gridEl.append(emp);
        return;
      }

      for (const item of items) {
        const effects = cloneEffectsDeep(item.effects);
        const card = el('div', 'pstore-card');
        card.dataset.pcat = item.cat;

        const top = el('div', 'pstore-card-top');
        const titleWrap = el('div', 'pstore-card-title');
        titleWrap.append(el('b', '', item.title));
        if (item.badge) {
          titleWrap.append(el('span', 'pstore-badge user', item.badge));
        }
        top.append(titleWrap);

        const delBtn = el('button', 'mini danger', '✕');
        delBtn.title = 'Удалить сохранённый пресет';
        delBtn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          if (!confirm('Удалить пресет «' + item.title + '»?')) return;
          const next = loadUserPresets().filter((x) => x.id !== item.id);
          saveUserPresets(next);
          renderStoreGrid(gridEl);
        });
        top.append(delBtn);

        const desc = el('div', 'pstore-desc', item.desc);
        const tags = el('div', 'pstore-tags');
        for (const fx of effects) {
          const hasKfs = (fx.props || []).some((p) => p.kfs && p.kfs.length);
          const tag = el('span', 'pstore-tag', VM.Effects.title(fx.id) + (hasKfs ? ' ◆' : ''));
          tag.title = VM.Effects.subtitle(fx.id);
          tags.append(tag);
        }

        const acts = el('div', 'pstore-acts');
        const copyBtn = el('button', 'btn', 'В буфер');
        copyBtn.title = 'Скопировать набор эффектов в буфер (затем Ctrl+Shift+V на любом слое)';
        copyBtn.addEventListener('click', () => {
          if (ctx.loadEffectsToClipboard) {
            ctx.loadEffectsToClipboard(cloneEffectsDeep(effects), item.title);
          }
          copyBtn.textContent = '✓ Скопировано';
          setTimeout(() => { copyBtn.textContent = 'В буфер'; }, 1200);
        });

        const applyBtn = el('button', 'btn primary', 'Применить');
        applyBtn.title = 'Сразу добавить эти эффекты на выбранный слой';
        applyBtn.addEventListener('click', () => {
          if (ctx.applyEffectsList) {
            const ok = ctx.applyEffectsList(cloneEffectsDeep(effects), item.title);
            if (ok && storeModal) storeModal.hidden = true;
          }
        });

        acts.append(copyBtn, applyBtn);
        card.append(top, desc, tags, acts);
        gridEl.append(card);
      }
    }

    function openPresetStore(initialCat, openSaveForm) {
      if (initialCat) storeCat = initialCat;
      if (typeof openSaveForm === 'boolean') showSaveDrawer = openSaveForm;
      if (!storeModal) {
        storeModal = el('div', 'modal-backdrop');
        storeModal.id = 'preset-store-modal';
        const card = el('div', 'modal-card pstore-modal');

        const head = el('div', 'modal-head');
        const mTitle = el('div', 'modal-title');
        mTitle.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></svg><span>Мои пресеты и шейки</span>';
        const closeBtn = el('button', 'mini', '✕');
        closeBtn.title = 'Закрыть (Esc)';
        closeBtn.addEventListener('click', () => { storeModal.hidden = true; });
        head.append(mTitle, closeBtn);

        const body = el('div', 'modal-body pstore-body');
        const toolbar = el('div', 'pstore-toolbar');
        const searchInp = document.createElement('input');
        searchInp.type = 'search';
        searchInp.className = 'fx-search';
        searchInp.placeholder = 'Поиск по моим пресетам и эффектам…';

        const saveCurBtn = el('button', 'btn primary', '+ Сохранить со слоя');
        saveCurBtn.title = 'Сохранить эффекты текущего выбранного слоя в каталог';
        toolbar.append(searchInp, saveCurBtn);

        const saveBox = el('div', 'pstore-save-box');
        saveBox.hidden = true;
        const nameInp = document.createElement('input');
        nameInp.type = 'text';
        nameInp.className = 'fx-search';
        nameInp.placeholder = 'Название (например: Мой панч-шейк)';
        const catSel = document.createElement('select');
        for (const [cid, cname] of [['shake', 'Шейки'], ['transition', 'Переходы'], ['color', 'Цвет и свет'], ['other', 'Другое']]) {
          const o = document.createElement('option');
          o.value = cid;
          o.textContent = cname;
          catSel.append(o);
        }
        const doSaveBtn = el('button', 'btn primary', 'Сохранить');
        const cancelSaveBtn = el('button', 'btn', 'Отмена');
        saveBox.append(nameInp, catSel, doSaveBtn, cancelSaveBtn);

        const catBar = el('div', 'fx-cats pstore-cats');
        const gridEl = el('div', 'pstore-grid');

        const syncCats = () => {
          catBar.textContent = '';
          for (const [cid, cname] of PRESET_CATS) {
            const cb = el('button', 'fx-cat' + (cid === storeCat ? ' on' : ''), cname);
            cb.addEventListener('click', () => {
              storeCat = cid;
              syncCats();
              renderStoreGrid(gridEl);
            });
            catBar.append(cb);
          }
        };

        const openDrawer = () => {
          const L = ctx.getLayer ? ctx.getLayer() : null;
          if (!L || !L.effects || !L.effects.length) {
            alert('Сначала выберите слой с эффектами, чтобы сохранить его как пресет.');
            return;
          }
          showSaveDrawer = true;
          saveBox.hidden = false;
          nameInp.value = (L.label || 'Слой') + ' · шейк';
          nameInp.focus();
          nameInp.select();
        };

        saveCurBtn.addEventListener('click', openDrawer);
        cancelSaveBtn.addEventListener('click', () => {
          showSaveDrawer = false;
          saveBox.hidden = true;
        });
        doSaveBtn.addEventListener('click', () => {
          const L = ctx.getLayer ? ctx.getLayer() : null;
          if (!L || !L.effects || !L.effects.length) {
            saveBox.hidden = true;
            return;
          }
          const clean = (nameInp.value || '').trim() || ((L.label || 'Слой') + ' · шейк');
          const chosenCat = catSel.value || 'shake';
          const list = loadUserPresets();
          list.unshift({
            id: 'upreset_' + Date.now().toString(36),
            title: clean,
            cat: chosenCat,
            desc: 'Эффектов: ' + L.effects.length + ' · из слоя «' + (L.label || L.id) + '»',
            effects: cloneEffectsDeep(L.effects),
          });
          saveUserPresets(list);
          showSaveDrawer = false;
          saveBox.hidden = true;
          storeCat = 'all';
          syncCats();
          renderStoreGrid(gridEl);
        });
        nameInp.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') doSaveBtn.click();
        });

        searchInp.addEventListener('input', () => {
          storeSearch = searchInp.value;
          renderStoreGrid(gridEl);
        });

        storeModal.addEventListener('click', (e) => {
          if (e.target === storeModal) storeModal.hidden = true;
        });
        window.addEventListener('keydown', (e) => {
          if (e.code === 'Escape' && storeModal && !storeModal.hidden) {
            e.stopPropagation();
            storeModal.hidden = true;
          }
        });

        body.append(toolbar, saveBox, catBar, gridEl);
        card.append(head, body);
        storeModal.append(card);
        document.body.append(storeModal);
        storeModal._sync = (wantSave) => {
          searchInp.value = storeSearch;
          syncCats();
          renderStoreGrid(gridEl);
          if (wantSave) openDrawer();
          else {
            showSaveDrawer = false;
            saveBox.hidden = true;
          }
        };
      }
      storeModal._sync(Boolean(openSaveForm));
      storeModal.hidden = false;
    }

    function ensureProp(fx, pm) {
      let p = VM.getProp(fx.props, pm.name);
      if (!p) { p = { name: pm.name, ty: pm.ty, constant: pm.def, kfs: [] }; fx.props.push(p); }
      return p;
    }

    function setValue(fx, p, pm, v) {
      if (ctx.onTargetProp) ctx.onTargetProp(fx, p, pm);
      const lt = r3(clamp(ctx.getLt(), 0, 1));
      if (p.kfs.length) {
        const k = p.kfs.find((q) => Math.abs(q.t - lt) < 0.005);
        if (k) k.v = v;
        else { p.kfs.push({ t: lt, v, e: [0.42, 0, 0.58, 1] }); p.kfs.sort((a, b) => a.t - b.t); }
      } else p.constant = v;
    }

    function chromaColorRow(parent, fx) {
      const legacyHue = VM.getProp(fx.props, 'hue');
      const legacyRgb = legacyHue ? hueDegToRgb01(VM.evalProp(legacyHue, clamp(ctx.getLt(), 0, 1))) : null;
      const pR = ensureProp(fx, { name: 'keyR', ty: 'float', def: legacyRgb ? legacyRgb[0] : 0 });
      const pG = ensureProp(fx, { name: 'keyG', ty: 'float', def: legacyRgb ? legacyRgb[1] : 1 });
      const pB = ensureProp(fx, { name: 'keyB', ty: 'float', def: legacyRgb ? legacyRgb[2] : 0 });
      if (legacyHue) {
        fx.props = fx.props.filter((q) => q !== legacyHue);
      }

      const row = el('div', 'prow');
      const top = el('div', 'ptop');
      const lab = el('span', 'pname', 'Цвет ключа');
      lab.title = 'Выберите цвет фона через палитру, пипетку или пресеты';
      top.append(lab);

      const animated = () => pR.kfs.length > 0 || pG.kfs.length > 0 || pB.kfs.length > 0;
      const hasKeyHere = () => {
        const lt = r3(clamp(ctx.getLt(), 0, 1));
        return [pR, pG, pB].some((q) => q.kfs.some((k) => Math.abs(k.t - lt) < 0.005));
      };
      const kfBtn = el('button', 'kf' + (hasKeyHere() ? ' on' : ''), hasKeyHere() ? '◆' : '◇');
      kfBtn.title = hasKeyHere()
        ? 'Убрать ключ цвета в текущей точке (Shift+клик — удалить всю анимацию)'
        : 'Поставить ключ цвета в текущей точке';
      kfBtn.addEventListener('click', (ev) => {
        const lt = r3(clamp(ctx.getLt(), 0, 1));
        if (ev.shiftKey && animated()) {
          for (const q of [pR, pG, pB]) { q.constant = VM.evalProp(q, lt); q.kfs = []; }
        } else {
          const hit = hasKeyHere();
          for (const q of [pR, pG, pB]) {
            const cur = VM.evalProp(q, lt);
            const idx = q.kfs.findIndex((k) => Math.abs(k.t - lt) < 0.005);
            if (hit) {
              if (idx >= 0) q.kfs.splice(idx, 1);
              if (!q.kfs.length) q.constant = cur;
            } else if (idx < 0) {
              q.kfs.push({ t: lt, v: cur, e: q.kfs.length ? [0.42, 0, 0.58, 1] : null });
              q.kfs.sort((a, b) => a.t - b.t);
            }
          }
        }
        ctx.rerender();
      });
      top.append(kfBtn);

      const rst = el('button', 'rst', '↺');
      rst.title = 'Сбросить на зелёный экран (#00ff00)';
      rst.addEventListener('click', () => {
        applyRgb01(0, 1, 0);
        ctx.rerender();
      });
      top.append(rst);
      row.append(top);

      const line = el('div', 'pline');
      const colorInp = document.createElement('input');
      colorInp.type = 'color';
      colorInp.title = 'Выбрать ключевой цвет из палитры';
      colorInp.style.cssText = 'width:32px;height:24px;padding:0;border:1px solid var(--line);border-radius:5px;background:transparent;cursor:pointer;flex:none';

      const hexTag = el('span', 'pval', '#00ff00');
      hexTag.style.cssText = 'font-family:monospace;font-size:11px;min-width:56px';

      const applyRgb01 = (r, g, b) => {
        setValue(fx, pR, { name: 'keyR', ty: 'float', label: 'Цвет ключа (R)' }, r3(clamp(r, 0, 1)));
        setValue(fx, pG, { name: 'keyG', ty: 'float', label: 'Цвет ключа (G)' }, r3(clamp(g, 0, 1)));
        setValue(fx, pB, { name: 'keyB', ty: 'float', label: 'Цвет ключа (B)' }, r3(clamp(b, 0, 1)));
      };

      colorInp.addEventListener('input', () => {
        const [r, g, b] = hexToRgb01(colorInp.value);
        applyRgb01(r, g, b);
        hexTag.textContent = colorInp.value.toLowerCase();
      });
      line.append(colorInp);

      if (ctx.pickColor) {
        const pipBtn = el('button', 'mini', '💧');
        pipBtn.title = 'Пипетка: взять точный цвет со сцены';
        pipBtn.style.cssText = 'width:26px;height:24px;flex:none;font-size:12px';
        pipBtn.addEventListener('click', () => {
          ctx.pickColor(([r, g, b]) => {
            applyRgb01(r / 255, g / 255, b / 255);
            ctx.rerender();
          });
        });
        line.append(pipBtn);
      }

      const presets = [
        ['#00ff00', [0, 1, 0], 'Зелёный экран'],
        ['#0000ff', [0, 0, 1], 'Синий экран'],
        ['#000000', [0, 0, 0], 'Чёрный фон'],
        ['#ffffff', [1, 1, 1], 'Белый фон'],
      ];
      for (const [hex, rgb, tip] of presets) {
        const sw = el('button', 'mini', '');
        sw.title = tip;
        sw.style.cssText = `width:18px;height:18px;padding:0;border-radius:4px;border:1px solid var(--line);background:${hex};flex:none`;
        sw.addEventListener('click', () => {
          applyRgb01(rgb[0], rgb[1], rgb[2]);
          ctx.rerender();
        });
        line.append(sw);
      }
      line.append(hexTag);

      const upd = () => {
        const lt = clamp(ctx.getLt(), 0, 1);
        const r = Number(VM.evalProp(pR, lt)) || 0;
        const g = Number(VM.evalProp(pG, lt)) || 0;
        const b = Number(VM.evalProp(pB, lt)) || 0;
        const hex = rgb01ToHex(r, g, b);
        if (document.activeElement !== colorInp) colorInp.value = hex;
        hexTag.textContent = hex;
        const here = hasKeyHere();
        kfBtn.textContent = here ? '◆' : '◇';
        kfBtn.classList.toggle('on', here);
        const isDef = Math.abs(r) < 1e-4 && Math.abs(g - 1) < 1e-4 && Math.abs(b) < 1e-4;
        rst.style.visibility = !isDef ? 'visible' : 'hidden';
      };

      row.append(line);
      upd();
      live.push({ update: upd });
      parent.append(row);
    }

    function paramRow(parent, fx, pm) {
      if (fx.id.endsWith('.chromakey')) {
        if (pm.name === 'keyR') { chromaColorRow(parent, fx); return; }
        if (pm.name === 'keyG' || pm.name === 'keyB') return;
      }
      const p = ensureProp(fx, pm);
      const row = el('div', 'prow');
      const top = el('div', 'ptop');
      const lab = el('span', 'pname', pm.label);
      if (pm.hint) lab.title = pm.hint;
      top.append(lab);

      const animated = () => p.kfs.length > 0;
      const hasKeyHere = () => {
        const lt = r3(clamp(ctx.getLt(), 0, 1));
        return p.kfs.some((q) => Math.abs(q.t - lt) < 0.005);
      };
      const kfBtn = el('button', 'kf' + (hasKeyHere() ? ' on' : ''), hasKeyHere() ? '◆' : '◇');
      kfBtn.title = hasKeyHere()
        ? 'Убрать ключ в текущей точке (Shift+клик — удалить всю анимацию)'
        : 'Поставить ключ в текущей точке';
      kfBtn.addEventListener('click', (ev) => {
        if (ctx.onTargetProp) ctx.onTargetProp(fx, p, pm);
        const lt = r3(clamp(ctx.getLt(), 0, 1));
        const cur = VM.evalProp(p, lt);
        if (ev.shiftKey && animated()) {
          p.constant = cur;
          p.kfs = [];
        } else {
          const hitIdx = p.kfs.findIndex((q) => Math.abs(q.t - lt) < 0.005);
          if (hitIdx >= 0) {
            p.kfs.splice(hitIdx, 1);
            if (!p.kfs.length) p.constant = cur;
          } else {
            p.kfs.push({ t: lt, v: cur, e: p.kfs.length ? [0.42, 0, 0.58, 1] : null });
            p.kfs.sort((a, b) => a.t - b.t);
            if (pm.ty === 'float' && p.kfs.length >= 2) openGraph.add(p);
          }
        }
        ctx.rerender();
      });
      top.append(kfBtn);
      let gBtn = null;
      if (pm.ty === 'float') {
        gBtn = el('button', 'gbtn' + (openGraph.has(p) ? ' on' : ''), '∿');
        gBtn.title = 'График: ключи и кривая значения';
        gBtn.disabled = !animated();
        gBtn.addEventListener('click', () => { openGraph.has(p) ? openGraph.delete(p) : openGraph.add(p); ctx.rerender(); });
        top.append(gBtn);
      }
      const rst = el('button', 'rst', '↺');
      rst.title = 'Сбросить к значению по умолчанию';
      rst.addEventListener('click', () => { setValue(fx, p, pm, pm.def); ctx.rerender(); });
      top.append(rst);
      row.append(top);

      const line = el('div', 'pline');
      let upd = () => {};
      if (pm.ty === 'bool') {
        const sw = el('label', 'sw');
        const cb = document.createElement('input'); cb.type = 'checkbox';
        const tr = el('span', 'sw-track');
        const st = el('span', 'sw-state', 'Выкл');
        cb.addEventListener('change', () => { setValue(fx, p, pm, cb.checked); st.textContent = cb.checked ? 'Вкл' : 'Выкл'; });
        sw.append(cb, tr, st);
        line.append(sw);
        upd = () => {
          const v = !!VM.evalProp(p, clamp(ctx.getLt(), 0, 1));
          if (cb.checked !== v) cb.checked = v;
          st.textContent = v ? 'Вкл' : 'Выкл';
        };
      } else if (pm.options) {
        const sel = document.createElement('select');
        pm.options.forEach((o, i) => { const op = document.createElement('option'); op.value = i; op.textContent = o; sel.append(op); });
        sel.addEventListener('change', () => setValue(fx, p, pm, Number(sel.value)));
        line.append(sel);
        upd = () => { const v = String(Math.round(Number(VM.evalProp(p, clamp(ctx.getLt(), 0, 1))) || 0)); if (document.activeElement !== sel && sel.value !== v) sel.value = v; };
      } else {
        const cur0 = Number(VM.evalProp(p, clamp(ctx.getLt(), 0, 1))) || 0;
        const lo = Math.min(pm.min, cur0), hi = Math.max(pm.max, cur0);
        const rng = document.createElement('input'); rng.type = 'range'; rng.min = lo; rng.max = hi; rng.step = pm.step || 'any';
        const num = document.createElement('input'); num.type = 'number'; num.step = pm.step || 'any';
        const fill = () => { const sp = (Number(rng.max) - Number(rng.min)) || 1; rng.style.setProperty('--p', Math.max(0, Math.min(100, ((Number(rng.value) - Number(rng.min)) / sp) * 100)) + '%'); };
        const apply = (v) => { setValue(fx, p, pm, pm.ty === 'int' ? Math.round(v) : v); };
        rng.addEventListener('input', () => { apply(Number(rng.value)); num.value = rng.value; fill(); });
        num.addEventListener('change', () => { const v = Number(num.value); if (isFinite(v)) { apply(v); rng.value = v; fill(); } });
        line.append(rng, num);
        upd = () => {
          const v = Number(VM.evalProp(p, clamp(ctx.getLt(), 0, 1)));
          if (!isFinite(v)) return;
          if (document.activeElement !== num) num.value = r3(v);
          if (document.activeElement !== rng) rng.value = v;
          fill();
        };
      }
      const baseUpd = upd;
      upd = () => {
        baseUpd();
        const here = hasKeyHere();
        kfBtn.textContent = here ? '◆' : '◇';
        kfBtn.classList.toggle('on', here);
        const cur = Number(VM.evalProp(p, clamp(ctx.getLt(), 0, 1)));
        const dv = Number(pm.def);
        rst.style.visibility = isFinite(cur) && Math.abs(cur - dv) > 1e-6 ? 'visible' : 'hidden';
      };
      row.append(line);
      upd();
      live.push({ update: upd });

      if (pm.ty === 'float' && openGraph.has(p) && animated()) {
        const gr = VM.Graph.create(p, pm, () => ctx.getLt(), (full) => { if (full) ctx.rerender(); });
        row.append(gr.el);
        live.push(gr);
      }
      parent.append(row);
    }

    function render(box, L) {
      live = [];
      // магазин пресетов и сохранение текущей связки
      const storeBar = el('div', 'fxclip');
      const openStoreBtn = el('button', 'btn primary', '✦ Магазин пресетов');
      openStoreBtn.title = 'Готовые шейки, переходы и цветокор — копировать или применить в один клик';
      openStoreBtn.addEventListener('click', () => openPresetStore());

      const savePresetBtn = el('button', 'btn', '+ В пресеты');
      savePresetBtn.title = 'Сохранить эффекты этого слоя в свой каталог пресетов';
      savePresetBtn.disabled = !L.effects.length;
      savePresetBtn.addEventListener('click', () => saveLayerAsPreset(L));
      storeBar.append(openStoreBtn, savePresetBtn);

      // копирование / вставка эффектов
      const clipBar = el('div', 'fxclip');
      const cpBtn = el('button', 'btn', 'Копировать');
      cpBtn.title = 'Скопировать все эффекты слоя со всеми ключами (Ctrl+Shift+C)';
      cpBtn.disabled = !L.effects.length;
      cpBtn.addEventListener('click', () => ctx.copyEffects(L));

      const cnt = ctx.clipboardCount ? ctx.clipboardCount() : 0;
      const selCnt = ctx.selectedCount ? ctx.selectedCount() : 1;
      const psLabel = cnt ? `Вставить (${cnt})${selCnt > 1 ? ' → ' + selCnt + ' сл.' : ''}` : 'Вставить';
      const psBtn = el('button', 'btn' + (cnt ? ' primary' : ''), psLabel);
      psBtn.title = 'Вставить скопированные эффекты на выбранные слои (Ctrl+Shift+V)';
      psBtn.disabled = !cnt;
      psBtn.addEventListener('click', () => ctx.pasteEffects());
      clipBar.append(cpBtn, psBtn);
      const head = el('div', 'fxhead');
      head.append(el('b', '', 'Эффекты слоя'), el('span', 'fxcount', String(L.effects.length)));
      const allOpen = L.effects.some((x) => x._open !== false);
      const colBtn = el('button', 'btn mini-btn', allOpen ? 'Свернуть все' : 'Развернуть все');
      colBtn.disabled = !L.effects.length;
      colBtn.addEventListener('click', () => { for (const x of L.effects) x._open = !allOpen; ctx.rerender(); });
      head.append(colBtn);
      box.append(head);
      box.append(storeBar, clipBar);

      // палитра эффектов с быстрым поиском и категориями
      const CATS = [
        ['all', 'Все'],
        ['move', 'Движение'],
        ['warp', 'Искажение'],
        ['blur', 'Размытие'],
        ['color', 'Цвет'],
        ['style', 'Стилизация'],
      ];
      const CAT_OF = {
        oscillate3: 'move', swing2: 'move', shake2: 'move', autoshake: 'move', jitter: 'move',
        randomdisplace: 'move', transform: 'move', transform2: 'move', scaleassist: 'move',
        pulsesize: 'move', flip: 'move',
        tile: 'warp', fractalwarp4: 'warp', turbulentdisplace: 'warp', swirl: 'warp',
        wavewarp2: 'warp', circularripple2: 'warp', pinchbulge2: 'warp', opticcompesation: 'warp',
        motionblur4: 'blur', gaussianblur: 'blur', gaussianblurplus: 'blur', lensblur2: 'blur',
        rgbsep: 'color', invert: 'color', brightnesscontrast: 'color', colortemperature: 'color', directionalblur: 'blur',
        zoomblur: 'blur', spinblur: 'blur', pixelate: 'style', posterize: 'style', threshold: 'style',
        saturationvibrance: 'color', pulseopacity: 'move', flicker: 'move', exposure: 'color', highlightshadow: 'color', rays: 'color',
        glow: 'style', chromakey: 'style',
        noisefade: 'color', fade: 'color', hueshift: 'color', vignette: 'color',
      };

      const add = el('div', 'fx-palette');
      const searchIn = document.createElement('input');
      searchIn.type = 'search';
      searchIn.className = 'fx-search';
      searchIn.placeholder = 'Поиск эффекта (shake, wave, blur, tile…)';

      const catBar = el('div', 'fx-cats');
      let curCat = 'all';
      const grid = el('div', 'fx-grid');

      function rebuildPalette() {
        const q = searchIn.value.trim().toLowerCase();
        grid.textContent = '';
        const list = VM.Effects.list().filter((e) => {
          const short = e.id.replace('com.alightcreative.effects.', '');
          if (curCat !== 'all' && CAT_OF[short] !== curCat) return false;
          if (!q) return true;
          return e.title.toLowerCase().includes(q) || e.en.toLowerCase().includes(q) || short.includes(q);
        });
        for (const e of list) {
          const short = e.id.replace('com.alightcreative.effects.', '');
          const b = el('button', 'fx-chip');
          b.title = e.title + ' (' + e.en + ') — нажать, чтобы добавить';
          b.dataset.cat = CAT_OF[short] || 'other';
          b.append(el('span', 'fx-chip-ru', e.title), el('span', 'fx-chip-en', e.en));
          b.addEventListener('click', () => {
            L.effects.push(VM.Effects.make(e.id));
            ctx.rerender();
          });
          grid.append(b);
        }
        if (!list.length) grid.append(el('div', 'muted', 'Ничего не найдено'));
      }

      for (const [cid, cname] of CATS) {
        const cb = el('button', 'fx-cat' + (cid === curCat ? ' on' : ''), cname);
        cb.addEventListener('click', () => {
          curCat = cid;
          for (const x of catBar.children) x.classList.remove('on');
          cb.classList.add('on');
          rebuildPalette();
        });
        catBar.append(cb);
      }
      searchIn.addEventListener('input', rebuildPalette);
      rebuildPalette();
      add.append(searchIn, catBar, grid);
      box.append(add);
      if (!L.effects.length) { box.append(el('div', 'note', 'У слоя пока нет эффектов. Добавьте выше или вставьте скопированные.')); return; }
      box.append(el('div', 'note', '◆ — анимация ключами, ∿ — график ключей и кривых. Изменение анимированного параметра ставит ключ в текущей точке.'));

      L.effects.forEach((fx, i) => {
        const meta = VM.Effects.metaOf(fx.id);
        const d = el('details', 'fx' + (fx.off ? ' off' : ''));
        d.dataset.cat = CAT_OF[fx.id.replace('com.alightcreative.effects.', '')] || 'other';
        d.open = fx._open !== false;
        d.addEventListener('toggle', () => { fx._open = d.open; });
        const sum = el('summary');
        const title = el('span', 'fxtitle');
        title.append(el('b', '', VM.Effects.title(fx.id)), el('span', 'en', VM.Effects.subtitle(fx.id)));
        sum.append(title);
        const nAnim = fx.props.filter((q) => q.kfs.length).length;
        if (nAnim) { const bd = el('span', 'fxbadge', '◆ ' + nAnim); bd.title = 'Анимированных параметров: ' + nAnim; sum.append(bd); }
        const tools = el('span', 'fxtools');
        const mk = (txt, tip, fn, cls) => {
          const b = el('button', 'mini' + (cls ? ' ' + cls : ''), txt); b.title = tip;
          b.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); fn(); });
          tools.append(b);
        };
        mk(fx.off ? '○' : '●', fx.off ? 'Включить эффект' : 'Выключить эффект', () => { fx.off = !fx.off; ctx.rerender(); }, fx.off ? '' : 'on');
        mk('▲', 'Выше (применяется раньше)', () => { if (i > 0) { [L.effects[i - 1], L.effects[i]] = [L.effects[i], L.effects[i - 1]]; ctx.rerender(); } });
        mk('▼', 'Ниже (применяется позже)', () => { if (i < L.effects.length - 1) { [L.effects[i + 1], L.effects[i]] = [L.effects[i], L.effects[i + 1]]; ctx.rerender(); } });
        mk('✕', 'Удалить эффект', () => { L.effects.splice(i, 1); ctx.rerender(); }, 'danger');
        sum.append(tools);
        d.append(sum);
        const body = el('div', 'body');
        if (meta && meta.idGuess) body.append(el('div', 'warn', 'Имя эффекта в XML Alight предположительное: при импорте проекта он может не распознаться.'));
        if (meta && SUP[meta.supported]) body.append(el('div', 'warn', 'Эффект ' + SUP[meta.supported] + '.'));
        if (meta) for (const pm of meta.params) paramRow(body, fx, pm);
        else {
          body.append(el('div', 'warn', 'Неизвестный эффект: параметры показаны как есть, в предпросмотре не применяется.'));
          for (const p of fx.props) {
            const r = el('div', 'row'); r.append(el('span', 'pname', p.name), el('span', 'pval', String(VM.evalProp(p, 0))));
            body.append(r);
          }
        }
        d.append(body);
        box.append(d);
      });
    }

    return { render, tick() { for (const l of live) l.update(); }, openPresetStore };
  }

  VM.FxUI = { create };
})();
