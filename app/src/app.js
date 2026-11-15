(function () {
  const VM = window.VM;
  const $ = (id) => document.getElementById(id);
  const canvas = $('canvas');

  const S = {
    projectId: null,
    scene: null, t: 0, playing: false, last: 0,
    media: new Map(), // uri -> { kind:'video'|'image'|'audio', el, url, name, w, h, frame, file? }
    renderer: null, selId: null, selIds: new Set(), fxClipboard: [], tab: 'layer', tl: null,
    inspKey: '', valueEls: [], localN: 0, fxOn: true, loop: true, fxui: null,
    masterVol: 1, masterMute: false,
    autosaveMs: 60000, autosaveTimer: null, saving: false, exporting: false,
    blobsDirty: false, stepFps: 0, loadSeq: 0,
    stageTool: 'move', // 'move' | 'crop' | 'corner'
    warpSelPts: new Set(),
    warpHoverIdx: -1,
    homeFilter: 'all', // 'all' | 'regular' | 'xml'
    pickColorCb: null,
    curveProp: 'rotation', // 'location.x' | 'location.y' | 'scale.x' | 'scale.y' | 'rotation' | 'volume' | 'opacity'
    curveSelIdx: 0,
    openLayerGraphs: new Set(),
    activeKeyTarget: null, // { layerId, listName, propName, propRef }
  };

  const ICON_PLAY = '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>';
  const ICON_PAUSE = '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';
  const ICON_VOL = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>';
  const ICON_MUTE = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>';

  const KIND_RU = { video: 'Видео', image: 'Фото', audio: 'Музыка' };
  const asVec = (v, def) => (typeof v === 'number' ? [v, v] : Array.isArray(v) ? v : def);

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function status(msg, bad) {
    const s = $('status');
    s.textContent = msg || '';
    s.className = bad ? 'bad' : '';
  }
  const layerById = (id) => (S.scene ? S.scene.layers.find((x) => x.id === id) : null);
  const srcUri = (L) => L.src || L.fillVideo;
  const mediaInfo = (uri) => (S.scene ? S.scene.media.find((m) => m.uri === uri) : null);
  const kindOfLayer = (L) => {
    if (L.fillType === 'audio') return 'audio';
    const m = S.media.get(srcUri(L));
    return m ? m.kind : 'video';
  };

  // ---------- проект ----------

  function emptyScene(opts) {
    const o = opts || {};
    const w = o.width || 1080;
    const h = o.height || 1920;
    return {
      title: (o.title || '').trim() || 'Новый проект',
      width: w, height: h, exportWidth: w, exportHeight: h,
      fps: o.fps || 60, totalTime: 0, bgcolor: '#ff000000',
      media: [], layers: [], unknown: [],
    };
  }

  function recalcSceneDuration() {
    if (!S.scene) return;
    let maxEnd = 0;
    for (const L of S.scene.layers) {
      if (L && isFinite(L.end)) maxEnd = Math.max(maxEnd, L.end + 1);
    }
    S.scene.totalTime = Math.max(0, maxEnd);
    if (S.t > S.scene.totalTime) S.t = S.scene.totalTime;
  }

  function showEditorScreen() {
    $('home-screen').hidden = true;
    $('app').hidden = false;
  }

  async function showHomeScreen() {
    if (S.scene) {
      setPlaying(false);
      await saveCurrentProject(true);
    }
    $('app').hidden = true;
    $('home-screen').hidden = false;
    await renderProjectsHome();
  }

  function captureThumbDataUrl() {
    try {
      if (!canvas || !canvas.width || !canvas.height) return '';
      const maxSide = 360;
      const scale = Math.min(1, maxSide / Math.max(canvas.width, canvas.height));
      const tw = Math.max(2, Math.round(canvas.width * scale));
      const th = Math.max(2, Math.round(canvas.height * scale));
      const tmp = document.createElement('canvas');
      tmp.width = tw; tmp.height = th;
      const ctx = tmp.getContext('2d');
      ctx.fillStyle = '#0f1117';
      ctx.fillRect(0, 0, tw, th);
      ctx.drawImage(canvas, 0, 0, tw, th);
      return tmp.toDataURL('image/jpeg', 0.78);
    } catch (_) {
      return '';
    }
  }

  function setAutosaveStatus(text, cls) {
    const ind = $('autosave-ind');
    if (!ind) return;
    ind.textContent = text || '';
    ind.className = 'autosave-ind' + (cls ? ' ' + cls : '');
  }

  async function saveCurrentProject(silent) {
    if (!S.scene || !VM.Projects || S.saving) return;
    S.saving = true;
    if (!silent) setAutosaveStatus('Сохранение…', 'saving');
    try {
      if (!S.projectId) S.projectId = VM.Projects.genId();
      const existing = await VM.Projects.get(S.projectId);
      const now = Date.now();
      let mediaBlobs = existing && existing.mediaBlobs ? existing.mediaBlobs : {};
      if (S.blobsDirty || !existing) {
        mediaBlobs = {};
        for (const [uri, m] of S.media.entries()) {
          if (m && m.file) {
            mediaBlobs[uri] = { blob: m.file, name: m.name, kind: m.kind };
          }
        }
        S.blobsDirty = false;
      }
      // принудительно рисуем кадр перед снятием превью, если на экране редактор
      if (!$('app').hidden && S.renderer) {
        const { draws } = buildDraws(S.scene, S.t);
        S.renderer.render(draws, S.scene.bgcolor);
      }
      const thumb = captureThumbDataUrl() || (existing && existing.thumb) || '';
      const sceneCopy = JSON.parse(JSON.stringify(S.scene));
      await VM.Projects.save({
        id: S.projectId,
        title: S.scene.title || 'Без названия',
        isXml: Boolean(S.scene.isXml || (existing && existing.isXml)),
        width: S.scene.width || 1080,
        height: S.scene.height || 1920,
        fps: S.scene.fps || 60,
        totalTime: S.scene.totalTime || 0,
        layersCount: S.scene.layers.length,
        mediaCount: S.scene.media.length,
        thumb,
        scene: sceneCopy,
        mediaBlobs,
        createdAt: (existing && existing.createdAt) || now,
        updatedAt: now,
      });
      const hhmm = new Date(now).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
      setAutosaveStatus('Сохранено в ' + hhmm, 'saved');
    } catch (e) {
      setAutosaveStatus('Ошибка сохранения', '');
      status('Не удалось сохранить проект: ' + e.message, true);
    } finally {
      S.saving = false;
    }
  }

  function restartAutosaveTimer() {
    if (S.autosaveTimer) {
      clearInterval(S.autosaveTimer);
      S.autosaveTimer = null;
    }
    const label = $('home-autosave-label');
    if (label) {
      if (!S.autosaveMs) label.textContent = 'выкл';
      else if (S.autosaveMs < 60000) label.textContent = (S.autosaveMs / 1000) + ' сек';
      else label.textContent = (S.autosaveMs / 60000) + ' мин';
    }
    if (S.autosaveMs > 0) {
      S.autosaveTimer = setInterval(() => {
        if (S.scene && !$('app').hidden) saveCurrentProject(false);
      }, S.autosaveMs);
    } else {
      setAutosaveStatus('Автосохранение выкл', '');
    }
  }

  async function openProjectRecord(rec) {
    if (!rec || !rec.scene) return;
    if (rec.isXml) rec.scene.isXml = true;
    showEditorScreen();
    setScene(rec.scene, rec.id);
    const seq = S.loadSeq;
    $('projname').textContent = S.scene.title || rec.title || 'Проект';
    const blobs = rec.mediaBlobs || {};
    for (const [uri, entry] of Object.entries(blobs)) {
      if (seq !== S.loadSeq) return;
      if (entry && entry.blob) {
        const f = entry.blob instanceof File
          ? entry.blob
          : new File([entry.blob], entry.name || 'media', { type: entry.blob.type || '' });
        await attachFile(uri, f, false);
      }
    }
    if (seq !== S.loadSeq) return;
    S.blobsDirty = false;
    S.forceSeek = true;
    S.lastSig = '';
    buildMediaList();
    renderInspector(true);
    setAutosaveStatus('Проект загружен', 'saved');
    status('Открыт проект: ' + (S.scene.title || rec.title));
  }

  async function createAndOpenNewProject(opts) {
    const scene = emptyScene(opts);
    const id = VM.Projects.genId();
    showEditorScreen();
    setScene(scene, id);
    $('projname').textContent = scene.title;
    await saveCurrentProject(true);
    status('Создан новый проект: ' + scene.title);
  }

  async function importXmlFileToNewProject(f) {
    const parsed = VM.parseScene(await f.text());
    if (!parsed.title) parsed.title = f.name.replace(/\.xml$/i, '');
    parsed.isXml = true;
    const id = VM.Projects.genId();
    showEditorScreen();
    setScene(parsed, id);
    $('projname').textContent = S.scene.title || f.name;
    await saveCurrentProject(true);
    status('Открыт XML: ' + f.name + ' · слоёв ' + S.scene.layers.length);
  }

  $('xmlfile').addEventListener('change', async (ev) => {
    const f = ev.target.files[0];
    if (!f) return;
    try {
      await importXmlFileToNewProject(f);
    } catch (e) {
      status('Ошибка: ' + e.message, true);
    }
    ev.target.value = '';
  });

  function syncFpsControl(fps) {
    const sel = $('proj-fps');
    if (!sel) return;
    const val = String(Math.max(1, Math.round(Number(fps) || 60)));
    if (![...sel.options].some((o) => o.value === val)) {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = val;
      sel.append(opt);
    }
    sel.value = val;
  }

  function setScene(scene, projectId) {
    S.loadSeq = (S.loadSeq || 0) + 1;
    S.projectId = projectId || VM.Projects.genId();
    if (!scene.fps || !isFinite(scene.fps)) scene.fps = 60;
    S.scene = scene;
    S.t = 0;
    S.forceSeek = true;
    S.lastSig = '';
    S.inspKey = '';
    setPlaying(false);
    syncFpsControl(scene.fps);
    canvas.width = scene.width || 1080;
    canvas.height = scene.height || 1080;
    canvas.style.aspectRatio = canvas.width + ' / ' + canvas.height;
    for (const m of S.media.values()) releaseMedia(m);
    S.media.clear();
    S.selId = null;
    S.selIds.clear();
    buildMediaList();
    S.tl.build(scene);
    renderInspector(true);
    histReset();
    updateBeatUI();
  }

  // ---------- файлы: загрузка, замена, добавление ----------

  function releaseMedia(m) {
    m._released = true;
    if (m.el && m.el.pause) m.el.pause();
    if (m.el && 'src' in m.el) { try { m.el.removeAttribute('src'); m.el.load(); } catch (_) {} }
    if (m.origEl && m.origEl !== m.el && m.origEl.pause) m.origEl.pause();
    if (m.audioEl && m.audioEl.pause) m.audioEl.pause();
    if (m.apool) {
      for (const a of m.apool) {
        if (a && a.pause) a.pause();
        if (a && a !== m.el) a.src = '';
      }
      m.apool.length = 0;
    }
    if (m.extraEls) {
      for (const ex of m.extraEls) {
        if (ex && ex.pause) ex.pause();
        if (ex) ex.src = '';
      }
      m.extraEls.length = 0;
    }
    if (m.frame) m.frame.close();
    URL.revokeObjectURL(m.url);
  }

  function kindOfFile(f) {
    if (f.type.startsWith('audio/')) return 'audio';
    if (f.type.startsWith('image/')) return 'image';
    if (f.type.startsWith('video/')) return 'video';
    return /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(f.name) ? 'audio' :
      /\.(png|jpe?g|webp|gif|bmp)$/i.test(f.name) ? 'image' : 'video';
  }

  function swapVideoToProxy(m, proxyPath) {
    if (!m || m._released || m.kind !== 'video' || m.proxyReady) return;
    const proxyUrl = 'file:///' + proxyPath.replace(/\\/g, '/').replace(/^\/+/, '');
    const pv = document.createElement('video');
    pv.preload = 'auto';
    pv.muted = true;
    pv.playsInline = true;
    pv.onloadedmetadata = () => {
      if (m._released) {
        try { pv.removeAttribute('src'); pv.load(); } catch (_) {}
        return;
      }
      const prevEl = m.el;
      const curT = prevEl ? prevEl.currentTime : 0;
      const wasPlaying = prevEl && !prevEl.paused;
      if (prevEl && prevEl.pause) prevEl.pause();
      // сохраняем оригинал для звука и сохранения проекта
      if (!m.origEl) m.origEl = prevEl;
      if (!m.audioEl && prevEl) {
        const a = new Audio();
        a.preload = 'auto';
        a.src = m.url;
        m.audioEl = a;
      }
      if (m.extraEls) {
        for (const ex of m.extraEls) {
          if (ex && ex.pause) ex.pause();
          if (ex) { try { ex.removeAttribute('src'); ex.load(); } catch (_) {} }
        }
        m.extraEls.length = 0;
      }
      pv.currentTime = Math.min(curT, Math.max(0, (pv.duration || curT) - 0.01));
      m.el = pv;
      m.proxyReady = true;
      S.frameEpoch = (S.frameEpoch || 0) + 1;
      S.forceSeek = true;
      S.lastSig = '';
      if (wasPlaying) pv.play().catch(() => {});
      buildMediaList();
    };
    pv.src = proxyUrl;
  }

  // Привязывает файл к uri. Возвращает промис с готовой записью (с длительностью/размером).
  function attachFile(uri, f, markDirty = true) {
    const seq = S.loadSeq;
    const old = S.media.get(uri);
    if (old) releaseMedia(old);
    if (markDirty) S.blobsDirty = true;
    const kind = kindOfFile(f);
    const url = URL.createObjectURL(f);
    const diskPath = window.vmNative ? window.vmNative.getPathForFile(f) : (f.path || '');
    const m = { kind, url, name: f.name, file: f, diskPath, el: null, origEl: null, audioEl: null, w: 0, h: 0, duration: 0, frame: null, proxyReady: false, _released: false };
    S.media.set(uri, m);
    return new Promise((resolve) => {
      const fail = () => { if (!m._released) status('Файл не открывается: ' + f.name, true); resolve(m); };
      if (kind === 'image') {
        const img = new Image();
        img.onload = async () => {
          if (m._released || seq !== S.loadSeq) { URL.revokeObjectURL(url); resolve(m); return; }
          m.el = img; m.w = img.naturalWidth; m.h = img.naturalHeight; m.duration = 3000;
          try { m.frame = new VideoFrame(img, { timestamp: 0 }); } catch (e) { status('Фото не поддерживается: ' + e.message, true); }
          S.lastSig = '';
          resolve(m);
        };
        img.onerror = fail;
        img.src = url;
      } else {
        const v = kind === 'audio' ? new Audio() : document.createElement('video');
        v.preload = 'auto';
        v.muted = false;
        v.volume = 1;
        if (kind === 'video') v.playsInline = true;
        v.onloadedmetadata = () => {
          if (m._released || seq !== S.loadSeq) {
            try { v.removeAttribute('src'); v.load(); } catch (_) {}
            URL.revokeObjectURL(url);
            resolve(m);
            return;
          }
          m.el = v; m.w = v.videoWidth || 0; m.h = v.videoHeight || 0;
          m.duration = isFinite(v.duration) ? Math.round(v.duration * 1000) : 3000;
          S.forceSeek = true;
          S.lastSig = '';
          if (kind === 'video' && diskPath && window.vmNative && window.vmNative.ensureProxy) {
            window.vmNative.ensureProxy(diskPath).then((res) => {
              if (!m._released && seq === S.loadSeq && res && res.ok && res.proxyPath) {
                swapVideoToProxy(m, res.proxyPath);
              }
            });
          }
          resolve(m);
        };
        v.onerror = fail;
        m.el = v;
        v.src = url;
      }
    });
  }

  function newLayer(file, uri, m, startMs) {
    const n = ++S.localN;
    const sc = S.scene;
    const prop = (name, ty, constant) => ({ name, ty, constant, kfs: [] });
    const isAudio = m.kind === 'audio';
    return {
      id: 'local' + n,
      label: (isAudio ? '♪ ' : '') + file.name,
      kind: '.rect',
      start: startMs, end: startMs + Math.max(100, m.duration) - 1, inTime: 0,
      hidden: false,
      muted: false,
      volume: 1,
      fillType: isAudio ? 'audio' : 'media',
      fillVideo: uri, src: '', fillMode: 'fit',
      attrs: {},
      transform: [prop('location', 'vec2', [sc.width / 2, sc.height / 2]), prop('scale', 'vec2', [1, 1]), prop('rotation', 'float', 0)],
      props: [prop('size', 'vec2', [sc.width / 2, sc.height / 2])],
      effects: [], children: [], unknown: [],
    };
  }

  async function importFiles(files) {
    files = Array.from(files);
    if (!files.length) return;
    if (!S.scene) {
      setScene(emptyScene());
      $('projname').textContent = S.scene.title;
    }
    let start = Math.round(S.t);
    let last = null;
    for (const f of files) {
      status('Загружаю: ' + f.name + '…');
      const uri = 'local:' + (++S.localN);
      const m = await attachFile(uri, f);
      if (!m.el) continue;
      S.scene.media.push({ uri, filename: f.name, width: m.w, height: m.h, kind: m.kind, local: true });
      const L = newLayer(f, uri, m, start);
      if (L.fillType === 'audio') S.scene.layers.unshift(L); // музыка внизу стопки
      else S.scene.layers.push(L);                            // видео/фото сверху
      recalcSceneDuration();
      last = L;
    }
    buildMediaList();
    S.tl.build(S.scene, true);
    if (last) { selectLayer(last.id, false); status('Добавлено файлов: ' + files.length); }
  }

  $('addfile').addEventListener('change', (e) => { importFiles(e.target.files); e.target.value = ''; });
  let dragDepth = 0;
  window.addEventListener('dragenter', (e) => { e.preventDefault(); dragDepth++; document.body.classList.add('drag'); });
  window.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; document.body.classList.remove('drag'); } });
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => {
    e.preventDefault(); dragDepth = 0; document.body.classList.remove('drag');
    const files = Array.from(e.dataTransfer.files || []);
    const xml = files.find((f) => /\.xml$/i.test(f.name));
    if (xml) {
      importXmlFileToNewProject(xml).catch((er) => status('Ошибка: ' + er.message, true));
    } else importFiles(files);
  });

  // Левая панель: список файлов проекта
  function buildMediaList() {
    const box = $('media');
    box.textContent = '';
    if (!S.scene || !S.scene.media.length) { box.append(el('div', 'muted', 'Пока пусто')); return; }
    for (const m of S.scene.media) {
      const have = S.media.get(m.uri);
      const used = S.scene.layers.filter((L) => srcUri(L) === m.uri || L.fillVideo === m.uri).length;
      const row = el('div');
      const top = el('div', 'mrow');
      const name = el('span', '', m.filename);
      name.title = m.filename;
      top.append(name);
      const lab = el('label', 'btn', have ? 'Заменить' : 'Выбрать файл');
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'video/*,image/*,audio/*'; inp.hidden = true;
      lab.append(inp);
      top.append(lab);
      inp.addEventListener('change', async () => {
        const f = inp.files[0];
        if (!f) return;
        const nm = await attachFile(m.uri, f);
        m.kind = nm.kind;
        status('Файл «' + m.filename + '» заменён на ' + f.name + ' во всех слоях, где он используется');
        buildMediaList(); renderInspector(true);
      });
      const proxyTag = have && have.kind === 'video'
        ? (have.proxyReady ? ' · прокси 540p' : (have.diskPath ? ' · кодирую прокси…' : ''))
        : '';
      const info = el('div', have ? 'muted ok' : 'muted',
        have ? '✓ ' + have.name + proxyTag : 'файла нет — показывается шахматка');
      row.append(top, info, el('div', 'muted', (m.width && m.height ? m.width + '×' + m.height + ' · ' : '') + 'слоёв: ' + used));
      box.append(row);
    }
  }

  // ---------- управление временем ----------

  function setPlaying(p) {
    S.playing = p;
    S.last = performance.now();
    const btn = $('play');
    btn.innerHTML = p ? ICON_PAUSE : ICON_PLAY;
    btn.classList.toggle('playing', p);
  }
  function seek(ms) {
    if (!S.scene) return;
    S.t = Math.max(0, Math.min(S.scene.totalTime, ms));
    S.forceSeek = true;
    S.seekAt = performance.now();
  }
  function stepFrames(n) {
    if (!S.scene) return;
    const step = 1000 / S.scene.fps;
    seek(Math.round(S.t / step + n) * step);
  }

  // ---------- метки битов ----------

  function updateBeatUI() {
    const n = S.scene ? VM.Beats.get(S.scene).length : 0;
    $('beat-count').textContent = n ? String(n) : '';
    $('beat-clear').hidden = !n;
    if (S.tl) S.tl.refreshBeats();
  }
  function tapBeat() {
    if (!S.scene) return;
    const r = VM.Beats.tap(S.scene, S.t, { playing: S.playing, fps: S.scene.fps });
    const when = (r.ms / 1000).toFixed(3) + ' с';
    status(r.action === 'added' ? 'Метка бита: ' + when :
      r.action === 'removed' ? 'Метка убрана: ' + when : 'Метка уже есть: ' + when);
    const b = $('beat-add');
    b.classList.add('flash');
    clearTimeout(tapBeat.timer);
    tapBeat.timer = setTimeout(() => b.classList.remove('flash'), 120);
    updateBeatUI();
  }
  function jumpBeat(dir) {
    if (!S.scene) return;
    const target = VM.Beats.neighbor(S.scene, S.t, dir);
    if (target === undefined) { status(dir > 0 ? 'Дальше меток нет' : 'Раньше меток нет'); return; }
    seek(target);
    S.tl.reveal(target);
  }
  $('beat-add').addEventListener('click', (e) => { tapBeat(); e.currentTarget.blur(); });
  $('beat-prev').addEventListener('click', (e) => { jumpBeat(-1); e.currentTarget.blur(); });
  $('beat-next').addEventListener('click', (e) => { jumpBeat(1); e.currentTarget.blur(); });
  $('beat-clear').addEventListener('click', (e) => {
    if (S.scene) { const n = VM.Beats.clear(S.scene); status('Убрано меток: ' + n + ' (Ctrl+Z вернёт)'); updateBeatUI(); }
    e.currentTarget.blur();
  });

  $('play').addEventListener('click', (e) => { setPlaying(!S.playing); e.currentTarget.blur(); });
  $('tohome').addEventListener('click', (e) => { seek(0); e.currentTarget.blur(); });
  $('prev').addEventListener('click', (e) => { stepFrames(-1); e.currentTarget.blur(); });
  $('next').addEventListener('click', (e) => { stepFrames(1); e.currentTarget.blur(); });

  function cloneEffects(list) {
    return list.map((fx) => ({
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
          e: Array.isArray(k.e) ? k.e.slice() : k.e,
        })),
      })),
    }));
  }

  function copyEffects(L) {
    const src = L || layerById(S.selId);
    if (!src || !src.effects.length) {
      status('У выбранного слоя нет эффектов для копирования', true);
      return;
    }
    S.fxClipboard = cloneEffects(src.effects);
    status('Скопировано эффектов: ' + S.fxClipboard.length + ' (Ctrl+Shift+V — вставить на выделенные слои)');
    renderInspector(true);
  }

  function pasteEffects() {
    if (!S.scene || !S.fxClipboard.length) return;
    const targets = S.selIds.size ? [...S.selIds] : (S.selId ? [S.selId] : []);
    if (!targets.length) {
      status('Выберите слой (или несколько слоёв через Ctrl/Shift) для вставки эффектов', true);
      return;
    }
    let applied = 0;
    for (const id of targets) {
      const L = layerById(id);
      if (!L || L.fillType === 'audio') continue;
      L.effects.push(...cloneEffects(S.fxClipboard));
      applied++;
    }
    if (applied) {
      status('Вставлено эффектов (' + S.fxClipboard.length + ') на слоёв: ' + applied);
      renderInspector(true);
    }
  }

  function selectLayer(id, jump, ev) {
    if (ev && (ev.ctrlKey || ev.metaKey)) {
      if (S.selIds.has(id) && S.selIds.size > 1) {
        S.selIds.delete(id);
        if (S.selId === id) S.selId = [...S.selIds][S.selIds.size - 1];
      } else {
        S.selIds.add(id);
        S.selId = id;
      }
    } else if (ev && ev.shiftKey && S.selId && S.scene) {
      const order = S.scene.layers.slice().reverse().map((x) => x.id);
      const a = order.indexOf(S.selId), b = order.indexOf(id);
      if (a >= 0 && b >= 0) {
        const [lo, hi] = a < b ? [a, b] : [b, a];
        for (let i = lo; i <= hi; i++) S.selIds.add(order[i]);
      } else {
        S.selIds = new Set([id]);
      }
      S.selId = id;
    } else {
      S.selId = id;
      S.selIds = id ? new Set([id]) : new Set();
    }
    S.tl.setSelected(S.selIds, S.selId);
    const L = layerById(S.selId);
    if (jump && L && !(S.t >= L.start && S.t < L.end + 1)) seek(L.start); // чтобы значения были «живыми»
    renderInspector(true);
  }
  function extractAudioFromLayer(L) {
    if (!S.scene || !L || kindOfLayer(L) !== 'video') return;
    const uri = srcUri(L);
    const mm = S.media.get(uri);
    const info = mediaInfo(uri);
    if (!uri && !mm && !info) {
      status('У слоя нет подключённого видеофайла', true);
      return;
    }
    const baseName = (mm && mm.name) || (info && info.filename) || L.label || 'Аудио';
    const n = ++S.localN;
    const audioLayer = {
      id: 'local' + n,
      label: '♪ ' + baseName,
      kind: '.rect',
      start: L.start,
      end: L.end,
      inTime: L.inTime || 0,
      hidden: false,
      muted: false,
      volume: L.volume !== undefined ? L.volume : 1,
      fillType: 'audio',
      fillVideo: L.fillVideo || '',
      src: L.src || '',
      fillMode: 'fit',
      attrs: {},
      transform: [],
      props: [],
      effects: [],
      children: [],
      unknown: [],
    };
    L.muted = true;
    S.scene.layers.unshift(audioLayer);
    S.tl.build(S.scene, true);
    buildMediaList();
    selectLayer(audioLayer.id, false);
    status('Звук отделён в дорожку: ' + audioLayer.label);
  }

  function removeLayer(id) {
    const ids = S.selIds.size ? S.selIds : new Set([id]);
    S.scene.layers = S.scene.layers.filter((x) => !ids.has(x.id));
    recalcSceneDuration();
    S.selId = null;
    S.selIds.clear();
    S.tl.build(S.scene, true);
    buildMediaList();
    renderInspector(true);
  }

  function cloneLayerData(L) {
    const copy = JSON.parse(JSON.stringify(L));
    copy.id = 'local' + (++S.localN);
    return copy;
  }

  function splitLayerAtPlayhead(id) {
    if (!S.scene) return;
    const L = layerById(id || S.selId);
    if (!L) return;
    const cut = Math.round(S.t);
    if (cut <= L.start + 30 || cut >= L.end - 30) {
      status('Поставьте курсор внутрь слоя, чтобы разрезать его', true);
      return;
    }
    const right = cloneLayerData(L);
    right.start = cut;
    right.inTime = (L.inTime || 0) + (cut - L.start);
    L.end = cut - 1;
    const idx = S.scene.layers.indexOf(L);
    S.scene.layers.splice(idx + 1, 0, right);
    S.tl.build(S.scene, true);
    selectLayer(right.id, false);
    status('Слой разрезан на отметке ' + (cut / 1000).toFixed(2) + ' с');
  }

  function duplicateSelectedLayer(id) {
    if (!S.scene) return;
    const L = layerById(id || S.selId);
    if (!L) return;
    const copy = cloneLayerData(L);
    copy.label = (L.label || L.id) + ' (копия)';
    const idx = S.scene.layers.indexOf(L);
    S.scene.layers.splice(idx + 1, 0, copy);
    S.tl.build(S.scene, true);
    buildMediaList();
    selectLayer(copy.id, false);
    status('Слой продублирован');
  }

  async function renameLayerById(id) {
    const L = layerById(id || S.selId);
    if (!L) return;
    const next = await window.vmI18n.ask('Название слоя:', L.label || L.id);
    if (next === null) return;
    L.label = next.trim() || L.id;
    S.tl.refreshRow(L.id);
    renderInspector(true);
  }

  function setLayerPropValue(L, listName, propName, ty, val, lt) {
    const list = L[listName];
    let p = VM.getProp(list, propName);
    if (!p) {
      p = { name: propName, ty, constant: val, kfs: [] };
      list.push(p);
      return;
    }
    const valCopy = Array.isArray(val) ? val.slice() : val;
    if (p.kfs && p.kfs.length) {
      const tNorm = Math.round(Math.max(0, Math.min(1, lt)) * 1000) / 1000;
      const existing = p.kfs.find((k) => Math.abs(k.t - tNorm) < 0.005);
      if (existing) existing.v = valCopy;
      else {
        p.kfs.push({ t: tNorm, v: valCopy, e: [0.42, 0, 0.58, 1] });
        p.kfs.sort((a, b) => a.t - b.t);
      }
    } else {
      p.constant = valCopy;
    }
  }

  function centerLayerOnCanvas(L) {
    if (!S.scene || !L) return;
    const lt = L.end > L.start ? (S.t - L.start) / (L.end - L.start) : 0;
    setLayerPropValue(L, 'transform', 'location', 'vec2', [S.scene.width / 2, S.scene.height / 2], lt);
    renderInspector(true);
    status('Слой выровнен по центру кадра');
  }

  function fitLayerToCanvas(L) {
    if (!S.scene || !L) return;
    const lt = L.end > L.start ? (S.t - L.start) / (L.end - L.start) : 0;
    setLayerPropValue(L, 'transform', 'location', 'vec2', [S.scene.width / 2, S.scene.height / 2], lt);
    setLayerPropValue(L, 'transform', 'scale', 'vec2', [1, 1], lt);
    setLayerPropValue(L, 'props', 'size', 'vec2', [S.scene.width / 2, S.scene.height / 2], lt);
    L.fillMode = 'fill';
    renderInspector(true);
    status('Слой растянут на весь кадр');
  }

  S.tl = VM.Timeline.create({
    getScene: () => S.scene,
    getTime: () => S.t,
    getSelectedIds: () => S.selIds,
    seek,
    beatAction: (ms, what) => {
      if (what === 'remove' && S.scene && VM.Beats.remove(S.scene, ms)) { status('Метка убрана'); updateBeatUI(); }
    },
    colorIndex: (L) => (L.fillType === 'audio' ? 2 : Math.max(0, S.scene.media.findIndex((m) => m.uri === srcUri(L)))),
    select: selectLayer,
    toggleHidden: (id) => {
      const L = layerById(id);
      if (L) { L.hidden = !L.hidden; S.tl.refreshRow(id); renderInspector(true); }
    },
    renameLayer: renameLayerById,
    onLayersChanged: (done) => {
      recalcSceneDuration();
      if (done) renderInspector(true);
    },
  });


  // ---------- история изменений: Ctrl+Z / Ctrl+Shift+Z (Ctrl+Y) ----------
  // Не привязана к конкретным местам правок: слепок сцены сравнивается с последним сохранённым,
  // когда пользователь закончил действие (отпустил мышь / пауза в изменениях).

  const HIST_LIMIT = 100;
  const H = { undo: [], redo: [], str: '', snap: null, seen: '', down: false };
  const cloneScene = (o) => JSON.parse(JSON.stringify(o));

  function histReset() {
    H.undo.length = 0; H.redo.length = 0;
    H.str = S.scene ? JSON.stringify(S.scene) : '';
    H.snap = S.scene ? cloneScene(S.scene) : null;
    H.seen = H.str;
  }

  function histCommit(cur) {
    if (H.snap) {
      H.undo.push(H.snap);
      if (H.undo.length > HIST_LIMIT) H.undo.shift();
    }
    H.redo.length = 0;
    H.snap = cloneScene(S.scene);
    H.str = cur;
    H.seen = cur;
  }

  // принять накопившуюся правку сразу (перед отменой), чтобы она отменилась одним шагом
  function histFlush() {
    if (!S.scene) return;
    const cur = JSON.stringify(S.scene);
    if (cur !== H.str) histCommit(cur);
  }

  function histApply(snap) {
    S.scene = cloneScene(snap);
    H.snap = snap;
    H.str = JSON.stringify(S.scene);
    H.seen = H.str;
    S.t = Math.max(0, Math.min(S.scene.totalTime, S.t));
    S.forceSeek = true;
    if (S.selId && !layerById(S.selId)) S.selId = null;
    S.selIds = new Set([...S.selIds].filter((id) => layerById(id)));
    if (S.selId && !S.selIds.size) S.selIds.add(S.selId);
    syncFpsControl(S.scene.fps);
    S.tl.build(S.scene, true);
    S.tl.setSelected(S.selIds, S.selId);
    buildMediaList();
    renderInspector(true);
    updateBeatUI();
  }

  function undo() {
    histFlush();
    if (!H.undo.length) { status('Нечего отменять'); return; }
    H.redo.push(H.snap);
    histApply(H.undo.pop());
    status('Отменено (шагов в истории: ' + H.undo.length + ')');
  }

  function redo() {
    histFlush();
    if (!H.redo.length) { status('Нечего повторять'); return; }
    H.undo.push(H.snap);
    histApply(H.redo.pop());
    status('Повторено');
  }

  window.addEventListener('pointerdown', () => { H.down = true; }, true);
  window.addEventListener('pointerup', () => { H.down = false; }, true);
  window.addEventListener('pointercancel', () => { H.down = false; }, true);
  setInterval(() => {
    if (!S.scene || $('app').hidden) return;
    const cur = JSON.stringify(S.scene);
    if (cur === H.str) { H.seen = cur; return; }
    if (H.down || cur !== H.seen) { H.seen = cur; return; } // ещё меняется (перетаскивание, ползунок)
    histCommit(cur);
  }, 250);

  const isTextEntry = (t) =>
    t && (t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && !/^(range|checkbox|radio|button|file|color)$/.test(t.type)));

  window.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || isTextEntry(e.target)) return;
    if (!S.scene || $('app').hidden) return;
    if (e.code === 'KeyZ') {
      e.preventDefault();
      if (e.shiftKey) redo(); else undo();
    } else if (e.code === 'KeyY') {
      e.preventDefault();
      redo();
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || isTextEntry(e.target) || !S.scene || $('app').hidden) return;
    if (e.code === 'KeyB') { e.preventDefault(); if (!e.repeat) tapBeat(); }
    else if (e.code === 'KeyK') { e.preventDefault(); if (!e.repeat) addKeyAtPlayhead(); }
    else if (e.code === 'BracketLeft') { e.preventDefault(); jumpBeat(-1); }
    else if (e.code === 'BracketRight') { e.preventDefault(); jumpBeat(1); }
  });

  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS') {
      e.preventDefault();
      if (S.scene && !$('app').hidden) saveCurrentProject(false);
      return;
    }
    if (!S.scene || $('app').hidden || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyC') { e.preventDefault(); copyEffects(); return; }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyV') { e.preventDefault(); pasteEffects(); return; }
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyD') { e.preventDefault(); duplicateSelectedLayer(); return; }
    if (e.code === 'KeyS' && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); splitLayerAtPlayhead(); return; }
    if (e.code === 'Space') { e.preventDefault(); setPlaying(!S.playing); }
    else if (e.code === 'KeyM') { e.preventDefault(); toggleMasterMute(); }
    else if (e.code === 'ArrowRight') { e.preventDefault(); stepFrames(e.shiftKey ? 10 : 1); }
    else if (e.code === 'ArrowLeft') { e.preventDefault(); stepFrames(e.shiftKey ? -10 : -1); }
    else if (e.code === 'Home') { e.preventDefault(); seek(0); }
    else if (e.code === 'Delete' && S.selId) removeLayer(S.selId);
    else if (e.code === 'Escape' && S.pickColorCb) {
      e.preventDefault();
      S.pickColorCb = null;
      canvas.style.cursor = 'grab';
      status('Выбор цвета пипеткой отменён');
    }
    else if ((e.code === 'Enter' || e.code === 'Escape') && S.stageTool === 'crop') {
      e.preventDefault();
      S.stageTool = 'move';
      S.lastSig = '';
      syncStageOverlay();
      renderInspector(true);
      status('Выделение области применено');
    }
  });

  // ---------- сборка кадра и иерархия слоёв (Parenting) ----------

  function computeLayerLocalState(scene, L, lt, ignoreCrop) {
    const loc = asVec(VM.evalProp(VM.getProp(L.transform, 'location'), lt), [scene.width / 2, scene.height / 2]);
    const pivot = asVec(VM.evalProp(VM.getProp(L.transform, 'pivot'), lt), [0, 0]);
    const sc = asVec(VM.evalProp(VM.getProp(L.transform, 'scale'), lt), [1, 1]);
    const rotDegRaw = VM.evalProp(VM.getProp(L.transform, 'rotation'), lt);
    const rotDeg = typeof rotDegRaw === 'number' ? rotDegRaw : 0;
    const size = asVec(VM.evalProp(VM.getProp(L.props, 'size'), lt), [scene.width / 2, scene.height / 2]);
    const opacityRaw = VM.evalProp(VM.getProp(L.props, 'opacity') || VM.getProp(L.transform, 'opacity'), lt);
    const layerOpacity = typeof opacityRaw === 'number' && isFinite(opacityRaw) ? Math.max(0, Math.min(1, opacityRaw)) : 1;
    let extent = [size[0] * sc[0], size[1] * sc[1]];

    const mm = S.media.get(srcUri(L));
    const vw = mm ? (mm.kind === 'image' ? mm.w : mm.el && mm.el.videoWidth) : 0;
    const vh = mm ? (mm.kind === 'image' ? mm.h : mm.el && mm.el.videoHeight) : 0;
    const ready = mm && vw > 0 && (mm.kind === 'image' ? !!mm.frame : (mm.el.readyState >= 2 || mm.el.seeking));
    let uvScale = [1, 1], uvOffset = [0, 0];
    if (ready) {
      const w = extent[0] * 2, h = extent[1] * 2;
      if (L.fillMode === 'fit') {
        const k = Math.min(w / vw, h / vh);
        extent = [(vw * k) / 2, (vh * k) / 2];
      } else {
        const k = Math.max(w / vw, h / vh);
        const fx = w / (vw * k), fy = h / (vh * k);
        uvScale = [fx, fy];
        uvOffset = [(1 - fx) / 2, (1 - fy) / 2];
      }
    }

    let cropOffset = [0, 0];
    if (L.cropRegion && !ignoreCrop) {
      const cr = L.cropRegion;
      const cw = Math.max(0.02, cr.x1 - cr.x0);
      const ch = Math.max(0.02, cr.y1 - cr.y0);
      uvOffset = [uvOffset[0] + cr.x0 * uvScale[0], uvOffset[1] + cr.y0 * uvScale[1]];
      uvScale = [uvScale[0] * cw, uvScale[1] * ch];
      cropOffset = [((cr.x0 + cr.x1) - 1) * extent[0], ((cr.y0 + cr.y1) - 1) * extent[1]];
      extent = [extent[0] * cw, extent[1] * ch];
    }

    const baseRot = (rotDeg * Math.PI) / 180;
    const mod = S.fxOn ? VM.Effects.layerMod(L, lt) : { dx: 0, dy: 0, sx: 1, sy: 1, drot: 0, alpha: 1 };
    const modExtent = [extent[0] * mod.sx, extent[1] * mod.sy];
    const rot = baseRot + mod.drot;
    const cs = Math.cos(rot), sn = Math.sin(rot);
    const rotCropX = cropOffset[0] * cs - cropOffset[1] * sn;
    const rotCropY = cropOffset[0] * sn + cropOffset[1] * cs;
    const basePx = pivot[0] * extent[0];
    const basePy = pivot[1] * extent[1];
    const pxOff = pivot[0] * modExtent[0];
    const pyOff = pivot[1] * modExtent[1];
    const rpx = pxOff * cs - pyOff * sn;
    const rpy = pxOff * sn + pyOff * cs;
    const center = [
      loc[0] + rotCropX + mod.dx + (basePx - rpx),
      loc[1] + rotCropY + mod.dy + (basePy - rpy),
    ];
    const pivotWorld = [
      loc[0] + rotCropX + mod.dx + basePx,
      loc[1] + rotCropY + mod.dy + basePy,
    ];
    return {
      loc, pivot, sc, rotDeg, rot, extent: modExtent, center, pivotWorld,
      uvScale, uvOffset, alpha: mod.alpha * layerOpacity, ready, mm,
    };
  }

  function resolveLayerWorld(scene, L, t, ignoreCrop, visited) {
    const lt = L.end > L.start ? Math.max(0, Math.min(1, (t - L.start) / (L.end - L.start))) : 0;
    const st = computeLayerLocalState(scene, L, lt, ignoreCrop);
    if (!L.parentId || !scene) return st;
    const seen = visited || new Set();
    if (seen.has(L.id)) return st;
    seen.add(L.id);
    const parent = scene.layers.find((x) => x.id === L.parentId);
    if (!parent || parent.hidden || parent.fillType !== 'media') return st;

    const pWorld = resolveLayerWorld(scene, parent, t, false, seen);
    const pRest = computeLayerLocalState(scene, parent, 0, false);

    const dRot = pWorld.rot - pRest.rot;
    const rx = Math.abs(pRest.extent[0]) > 0.001 ? pWorld.extent[0] / pRest.extent[0] : 1;
    const ry = Math.abs(pRest.extent[1]) > 0.001 ? pWorld.extent[1] / pRest.extent[1] : 1;
    const cs = Math.cos(dRot), sn = Math.sin(dRot);

    const transformPt = (pt) => {
      const vx = (pt[0] - pRest.pivotWorld[0]) * rx;
      const vy = (pt[1] - pRest.pivotWorld[1]) * ry;
      return [
        pWorld.pivotWorld[0] + (vx * cs - vy * sn),
        pWorld.pivotWorld[1] + (vx * sn + vy * cs),
      ];
    };

    st.center = transformPt(st.center);
    st.pivotWorld = transformPt(st.pivotWorld);
    st.rot += dRot;
    st.rotDeg += (dRot * 180) / Math.PI;
    st.extent = [st.extent[0] * rx, st.extent[1] * ry];
    st.alpha *= pWorld.alpha;
    return st;
  }

  function buildDraws(scene, tRaw) {
    let t = tRaw;
    if (S.stepFps > 0) {
      const st = 1000 / S.stepFps;
      t = Math.floor(tRaw / st) * st;
    }
    const draws = [];
    const active = [];
    for (const L of scene.layers) {
      if (L.hidden || L.fillType !== 'media') continue;
      if (!(t >= L.start && t < L.end + 1)) continue;
      active.push(L);
      const lt = L.end > L.start ? (t - L.start) / (L.end - L.start) : 0;
      const editingCropNow = S.stageTool === 'crop' && L.id === S.selId;
      const st = resolveLayerWorld(scene, L, t, editingCropNow);
      const ci = Math.max(0, scene.media.findIndex((m) => m.uri === srcUri(L)));
      const baseCol = [[0.35, 0.55, 1, 1], [1, 0.5, 0.35, 1], [0.4, 0.85, 0.55, 1], [0.85, 0.45, 0.9, 1]][ci % 4];
      draws.push({
        center: st.center,
        extent: st.extent,
        rot: st.rot,
        fx: S.fxOn ? VM.Effects.passes(L, lt, scene, { center: st.center, extent: st.extent, rot: st.rot }) : [],
        uvScale: st.uvScale,
        uvOffset: st.uvOffset,
        color: [baseCol[0], baseCol[1], baseCol[2], st.alpha],
        blend: L.blend || 'normal',
        video: st.ready ? (st.mm.kind === 'image' ? st.mm.frame : st.mm.el) : null,
      });
    }
    return { draws, active };
  }

  function layerVolume(L) {
    if (L.muted || S.masterMute) return 0;
    const p = VM.getProp(L.props, 'volume') || VM.getProp(L.transform, 'volume');
    let v = L.volume !== undefined ? L.volume : 1;
    if (p) {
      const lt = L.end > L.start ? Math.max(0, Math.min(1, (S.t - L.start) / (L.end - L.start))) : 0;
      const ev = VM.evalProp(p, lt);
      if (typeof ev === 'number' && isFinite(ev)) v = ev;
    }
    return Math.max(0, Math.min(1, v * S.masterVol));
  }

  // видео и звук: держим в такт с таймлайном (см. mediasync.js)
  const MS = VM.MediaSync.create({ S, srcUri, layerVolume });
  const syncMedia = (scene) => MS.sync(scene);

  // ---------- правая панель: вкладки ----------

  const fmt = (v) =>
    typeof v === 'number' ? v.toFixed(3) :
    Array.isArray(v) ? v.map((x) => (typeof x === 'number' ? x.toFixed(2) : x)).join(', ') :
    v === undefined ? '—' : String(v);

  const RU = { location: 'Позиция', pivot: 'Опора (Pivot)', scale: 'Масштаб', rotation: 'Поворот', size: 'Размер', opacity: 'Прозрачность' };

  function isDescendantOf(candidateId, rootId) {
    if (!S.scene || !candidateId || !rootId) return false;
    let cur = layerById(candidateId);
    const seen = new Set();
    while (cur && cur.parentId && !seen.has(cur.id)) {
      if (cur.parentId === rootId) return true;
      seen.add(cur.id);
      cur = layerById(cur.parentId);
    }
    return false;
  }

  function extractRegionToChildLayer(L, ltNow) {
    if (!S.scene || !L || !L.cropRegion) return;
    const reg = Object.assign({}, L.cropRegion);
    const copy = cloneLayerData(L);
    copy.label = (L.label || L.id) + ' · часть';
    copy.cropRegion = reg;
    copy.parentId = L.id;
    // Сбрасываем выделение с родительского слоя (торса), чтобы он остался целым
    delete L.cropRegion;
    // Ставим точку опоры (сустав) в нижний центр вырезанной части
    setLayerPropValue(copy, 'transform', 'pivot', 'vec2', [0, 0.85], ltNow);
    const idx = S.scene.layers.indexOf(L);
    S.scene.layers.splice(idx + 1, 0, copy);
    S.tl.build(S.scene, true);
    buildMediaList();
    selectLayer(copy.id, false);
    status('Часть вырезана в новый слой и привязана к «' + (L.label || L.id) + '»');
  }

  function toggleLayerPropKey(L, p) {
    if (!L || !p) return;
    S.activeKeyTarget = { layerId: L.id, propName: p.name, propRef: p };
    const lt = L.end > L.start ? Math.max(0, Math.min(1, (S.t - L.start) / (L.end - L.start))) : 0;
    const tNorm = Math.round(lt * 1000) / 1000;
    const cur = VM.evalProp(p, lt);
    const valCopy = Array.isArray(cur) ? cur.slice() : cur;
    if (!p.kfs) p.kfs = [];
    const hitIdx = p.kfs.findIndex((k) => Math.abs(k.t - tNorm) < 0.005);
    if (hitIdx >= 0) {
      p.kfs.splice(hitIdx, 1);
      if (!p.kfs.length) p.constant = valCopy;
      status('Ключ удалён (' + (RU[p.name] || p.name) + ') на ' + (S.t / 1000).toFixed(2) + ' с');
    } else {
      p.kfs.push({ t: tNorm, v: valCopy, e: p.kfs.length ? [0.42, 0, 0.58, 1] : null });
      p.kfs.sort((a, b) => a.t - b.t);
      status('Ключ поставлен (' + (RU[p.name] || p.name) + ') на ' + (S.t / 1000).toFixed(2) + ' с (осталось ключей: ' + p.kfs.length + ')');
    }
    S.lastSig = '';
    renderInspector(true);
  }

  function resolveKeyTarget(L) {
    if (!L) return null;
    const tgt = S.activeKeyTarget;
    if (tgt && tgt.layerId === L.id && tgt.propRef) {
      const inLayer = L.transform.includes(tgt.propRef) || L.props.includes(tgt.propRef);
      const inFx = L.effects.some((fx) => fx.props && fx.props.includes(tgt.propRef));
      if (inLayer || inFx) return tgt;
    }
    if (S.tab === 'fx' && L.effects.length) {
      const fx = L.effects.find((x) => !x.off && x.props && x.props.length) || L.effects[0];
      if (fx && fx.props && fx.props.length) {
        const p = fx.props.find((q) => q.ty === 'float') || fx.props[0];
        return { layerId: L.id, propName: p.name, label: VM.Effects.title(fx.id) + ' · ' + p.name, propRef: p };
      }
    }
    if (S.tab === 'pivot') {
      const p = VM.getProp(L.transform, 'pivot') || VM.getProp(L.transform, 'rotation');
      if (p) return { layerId: L.id, propName: p.name, label: RU[p.name] || p.name, propRef: p };
    }
    const all = [...L.transform, ...L.props];
    const anim = all.find((q) => q.kfs && q.kfs.length);
    const p = anim || VM.getProp(L.transform, 'location') || all[0];
    return p ? { layerId: L.id, propName: p.name, label: RU[p.name] || p.name, propRef: p } : null;
  }

  function addKeyAtPlayhead() {
    if (!S.scene) return;
    let L = layerById(S.selId);
    if (!L) {
      L = [...S.scene.layers].reverse().find((x) => !x.hidden && S.t >= x.start && S.t < x.end + 1) || S.scene.layers[S.scene.layers.length - 1];
      if (L) selectLayer(L.id, false);
    }
    if (!L) { status('Нет слоёв для добавления ключа', true); return; }
    const tgt = resolveKeyTarget(L);
    if (!tgt || !tgt.propRef) { status('У выбранного слоя нет параметров для анимации', true); return; }
    S.activeKeyTarget = tgt;
    const p = tgt.propRef;
    const lt = L.end > L.start ? Math.max(0, Math.min(1, (S.t - L.start) / (L.end - L.start))) : 0;
    const tNorm = Math.round(lt * 1000) / 1000;
    const cur = VM.evalProp(p, lt);
    const fallback = p.ty === 'vec2' ? [0, 0] : p.ty === 'bool' ? false : 0;
    const valCopy = Array.isArray(cur) ? cur.slice() : (cur !== undefined ? cur : fallback);
    if (!p.kfs) p.kfs = [];
    const hitIdx = p.kfs.findIndex((k) => Math.abs(k.t - tNorm) < 0.005);
    const label = tgt.label || RU[p.name] || p.name;
    if (hitIdx >= 0) {
      p.kfs[hitIdx].v = valCopy;
      status('Ключ обновлён (' + label + ') на ' + (S.t / 1000).toFixed(2) + ' с');
    } else {
      p.kfs.push({ t: tNorm, v: valCopy, e: p.kfs.length ? [0.42, 0, 0.58, 1] : null });
      p.kfs.sort((a, b) => a.t - b.t);
      status('Ключ добавлен (' + label + ') на ' + (S.t / 1000).toFixed(2) + ' с (всего: ' + p.kfs.length + ')');
    }
    S.lastSig = '';
    renderInspector(true);
  }

  const keyAddNowBtn = $('key-add-now');
  if (keyAddNowBtn) {
    keyAddNowBtn.addEventListener('click', (e) => { addKeyAtPlayhead(); e.currentTarget.blur(); });
  }

  function propRow(parent, p, L) {
    const ltNow = L.end > L.start ? Math.max(0, Math.min(1, (S.t - L.start) / (L.end - L.start))) : 0;
    const tNorm = Math.round(ltNow * 1000) / 1000;
    const hasKeyHere = p.kfs && p.kfs.some((k) => Math.abs(k.t - tNorm) < 0.005);

    const wrap = el('div', 'prow');
    const top = el('div', 'ptop');
    const nameEl = el('span', 'pname', (RU[p.name] || p.name) + (p.kfs && p.kfs.length ? ` (${p.kfs.length})` : ''));
    top.append(nameEl);

    const v = el('span', 'pval' + (p.kfs && p.kfs.length ? ' anim' : ''), '');
    if (p.kfs && p.kfs.length) v.append(el('span', 'kfdot', '◆'));

    const kfBtn = el('button', 'kf' + (hasKeyHere ? ' on' : (p.kfs && p.kfs.length ? ' anim' : '')), hasKeyHere ? '◆' : '◇');
    kfBtn.title = hasKeyHere
      ? 'Убрать ключ в текущей точке'
      : (p.kfs && p.kfs.length ? 'Добавить ещё один ключ в текущей точке' : 'Начать анимацию: поставить первый ключ в текущей точке');
    kfBtn.addEventListener('click', () => toggleLayerPropKey(L, p));
    top.append(kfBtn);

    if (p.ty === 'float') {
      const gKey = L.id + ':' + p.name;
      const gBtn = el('button', 'gbtn' + (S.openLayerGraphs.has(gKey) ? ' on' : ''), '∿');
      gBtn.title = 'Открыть график ключей и кривых Безье';
      gBtn.disabled = !(p.kfs && p.kfs.length);
      gBtn.addEventListener('click', () => {
        if (S.openLayerGraphs.has(gKey)) S.openLayerGraphs.delete(gKey);
        else S.openLayerGraphs.add(gKey);
        renderInspector(true);
      });
      top.append(gBtn);
    }
    wrap.append(top);

    const listName = L.transform.includes(p) ? 'transform' : 'props';
    const curVal = VM.evalProp(p, ltNow);
    const controls = {};

    if (p.ty === 'float') {
      const ranges = {
        opacity: [0, 1, 0.01],
        rotation: [-360, 360, 0.5],
        volume: [0, 1, 0.01],
      };
      const [minV, maxV, stepV] = ranges[p.name] || [-1000, 1000, 0.1];
      const numVal = typeof curVal === 'number' && isFinite(curVal) ? curVal : (Number(p.constant) || 0);
      const line = el('div', 'pline');
      const rng = document.createElement('input');
      rng.type = 'range'; rng.min = minV; rng.max = maxV; rng.step = stepV;
      rng.value = Math.max(minV, Math.min(maxV, numVal));
      const num = document.createElement('input');
      num.type = 'number'; num.step = stepV;
      num.value = Math.round(numVal * 1000) / 1000;
      const applyF = (nv) => {
        S.activeKeyTarget = { layerId: L.id, propName: p.name, propRef: p };
        const ltCur = L.end > L.start ? Math.max(0, Math.min(1, (S.t - L.start) / (L.end - L.start))) : 0;
        setLayerPropValue(L, listName, p.name, 'float', nv, ltCur);
        S.lastSig = '';
      };
      rng.addEventListener('input', () => { const nv = Number(rng.value); num.value = nv; applyF(nv); });
      num.addEventListener('change', () => { const nv = Number(num.value) || 0; rng.value = Math.max(minV, Math.min(maxV, nv)); applyF(nv); renderInspector(true); });
      line.append(rng, num);
      wrap.append(line);
      controls.rng = rng;
      controls.num = num;
      controls.minV = minV;
      controls.maxV = maxV;
    } else if (p.ty === 'vec2') {
      const vec = Array.isArray(curVal) ? curVal.slice() : [0, 0];
      const line = el('div', 'pline');
      const stepV = p.name === 'scale' || p.name === 'pivot' ? 0.01 : 1;
      const inX = document.createElement('input');
      inX.type = 'number'; inX.step = stepV; inX.title = 'X';
      inX.value = Math.round((Number(vec[0]) || 0) * 100) / 100;
      const inY = document.createElement('input');
      inY.type = 'number'; inY.step = stepV; inY.title = 'Y';
      inY.value = Math.round((Number(vec[1]) || 0) * 100) / 100;
      const applyV = () => {
        S.activeKeyTarget = { layerId: L.id, propName: p.name, propRef: p };
        const ltCur = L.end > L.start ? Math.max(0, Math.min(1, (S.t - L.start) / (L.end - L.start))) : 0;
        setLayerPropValue(L, listName, p.name, 'vec2', [Number(inX.value) || 0, Number(inY.value) || 0], ltCur);
        S.lastSig = '';
        renderInspector(true);
      };
      inX.addEventListener('change', applyV);
      inY.addEventListener('change', applyV);
      line.append(inX, inY);
      wrap.append(line);
      controls.inX = inX;
      controls.inY = inY;
    }

    parent.append(wrap);
    S.valueEls.push({ p, v, kfBtn, L, controls });
    if (p.ty === 'float' && p.kfs && p.kfs.length && S.openLayerGraphs.has(L.id + ':' + p.name)) {
      const gr = VM.Graph.create(
        p,
        { min: p.name === 'opacity' || p.name === 'volume' ? 0 : -360, max: p.name === 'opacity' || p.name === 'volume' ? 1 : 360, step: 0.01 },
        () => (L.end > L.start ? Math.max(0, Math.min(1, (S.t - L.start) / (L.end - L.start))) : 0),
        (full) => { S.lastSig = ''; if (full) renderInspector(true); }
      );
      parent.append(gr.el);
    }
  }

  function emptyState(box, title, text) {
    const d = el('div', 'empty');
    d.append(el('b', '', title), document.createTextNode(text));
    box.append(d);
  }

  function renderInspector(force) {
    const sc = $('inspector').scrollTop;
    renderInspector0(force);
    $('inspector').scrollTop = sc;
  }
  function renderInspector0(force) {
    const box = $('inspector');
    const L = layerById(S.selId);
    const key = [S.selId, S.tab, L && L.hidden, L && srcUri(L)].join('|');
    if (!force && key === S.inspKey) return;
    S.inspKey = key;
    box.textContent = '';
    box.classList.remove('panel-anim');
    void box.offsetWidth;
    box.classList.add('panel-anim');
    S.valueEls = [];
    for (const b of document.querySelectorAll('#tabs button')) b.classList.toggle('on', b.dataset.tab === S.tab);
    $('fxcount').textContent = L && L.effects.length ? '(' + L.effects.length + ')' : '';
    if (!L) { emptyState(box, 'Слой не выбран', 'Нажмите на слой в полосе внизу — здесь появятся его свойства, эффекты и файл.'); return; }

    const kind = kindOfLayer(L);
    const head = el('div', 'title');
    head.append(el('span', 'badge ' + kind, KIND_RU[kind]), document.createTextNode(L.label || L.id));
    box.append(head);

    if (S.tab === 'layer') {
      box.append(el('div', 'muted', 'Время: ' + (L.start / 1000).toFixed(2) + ' – ' + ((L.end + 1) / 1000).toFixed(2) + ' с' +
        (L.inTime ? ' · старт с ' + (L.inTime / 1000).toFixed(2) + ' с файла' : '')));
      const act = el('div', 'actions');
      const hid = el('button', '', L.hidden ? 'Показать слой' : 'Скрыть слой');
      hid.addEventListener('click', () => { L.hidden = !L.hidden; S.tl.refreshRow(L.id); renderInspector(true); });
      const splitBtn = el('button', '', 'Разрезать');
      splitBtn.title = 'Разрезать слой по позиции курсора (S)';
      splitBtn.addEventListener('click', () => splitLayerAtPlayhead(L.id));
      const dupBtn = el('button', '', 'Дублировать');
      dupBtn.title = 'Создать копию слоя (Ctrl+D)';
      dupBtn.addEventListener('click', () => duplicateSelectedLayer(L.id));
      act.append(hid, splitBtn, dupBtn);
      if (kind === 'video') {
        const extAudio = el('button', '', 'Отделить звук');
        extAudio.title = 'Вынести аудиодорожку на отдельный слой и отключить звук у видео';
        extAudio.addEventListener('click', () => extractAudioFromLayer(L));
        act.append(extAudio);
      }
      if (kind === 'video' || kind === 'image') {
        const ctrBtn = el('button', '', 'По центру');
        ctrBtn.title = 'Поставить слой точно в центр холста';
        ctrBtn.addEventListener('click', () => centerLayerOnCanvas(L));
        const fitBtn = el('button', '', 'На весь кадр');
        fitBtn.title = 'Растянуть слой по размеру кадра';
        fitBtn.addEventListener('click', () => fitLayerToCanvas(L));
        act.append(ctrBtn, fitBtn);
      }
      const del = el('button', 'danger', 'Удалить');
      del.title = 'Delete';
      del.addEventListener('click', () => removeLayer(L.id));
      act.append(del);
      box.append(act);

      if (kind === 'video' || kind === 'image') {
        box.append(el('div', 'sect', 'Режим наложения'));
        const bsel = document.createElement('select');
        for (const [v, name] of [['normal', 'Обычный'], ['add', 'Сложение'], ['screen', 'Экран'], ['multiply', 'Умножение']]) {
          const o = document.createElement('option'); o.value = v; o.textContent = name; bsel.append(o);
        }
        bsel.value = L.blend || 'normal';
        bsel.title = 'Как слой смешивается с тем, что под ним';
        bsel.addEventListener('change', () => { L.blend = bsel.value; histFlush(); });
        box.append(bsel);
      }

      if (kind === 'video' || kind === 'audio') {
        box.append(el('div', 'sect', 'Звук слоя'));
        const acard = el('div', 'fx');
        let volProp = VM.getProp(L.props, 'volume') || VM.getProp(L.transform, 'volume');
        const ltVol = L.end > L.start ? Math.max(0, Math.min(1, (S.t - L.start) / (L.end - L.start))) : 0;
        const curVolNow = volProp ? Number(VM.evalProp(volProp, ltVol)) : (L.volume !== undefined ? L.volume : 1);
        const prow = el('div', 'prow');
        const ptop = el('div', 'ptop');
        ptop.append(el('span', 'pname', 'Громкость'));
        const volKfBtn = el('button', 'kf' + (volProp && volProp.kfs.length ? ' on' : ''), '◆');
        volKfBtn.title = 'Поставить / убрать ключ громкости в текущей точке (для затухания звука в конце)';
        volKfBtn.addEventListener('click', () => {
          if (!volProp) {
            volProp = { name: 'volume', ty: 'float', constant: L.volume !== undefined ? L.volume : 1, kfs: [] };
            L.props.push(volProp);
          }
          toggleLayerPropKey(L, volProp);
        });
        const volGraphKey = L.id + ':volume';
        const volGBtn = el('button', 'gbtn' + (S.openLayerGraphs.has(volGraphKey) ? ' on' : ''), '∿');
        volGBtn.title = 'График затухания громкости';
        volGBtn.disabled = !(volProp && volProp.kfs.length);
        volGBtn.addEventListener('click', () => {
          if (S.openLayerGraphs.has(volGraphKey)) S.openLayerGraphs.delete(volGraphKey);
          else S.openLayerGraphs.add(volGraphKey);
          renderInspector(true);
        });
        const muteBtn = el('button', 'mini' + (L.muted ? ' danger' : ' on'), L.muted ? 'Выкл' : 'Вкл');
        muteBtn.title = 'Включить / выключить звук слоя';
        muteBtn.addEventListener('click', () => { L.muted = !L.muted; renderInspector(true); });
        ptop.append(volKfBtn, volGBtn, muteBtn);
        const pline = el('div', 'pline');
        const rng = document.createElement('input');
        rng.type = 'range'; rng.min = 0; rng.max = 100; rng.step = 1;
        rng.value = Math.round(Math.max(0, Math.min(1, curVolNow)) * 100);
        const num = document.createElement('input');
        num.type = 'number'; num.min = 0; num.max = 100; num.step = 1;
        num.value = rng.value;
        const applyVol = (val01) => {
          L.volume = val01;
          if (volProp && volProp.kfs.length) {
            setLayerPropValue(L, L.props.includes(volProp) ? 'props' : 'transform', 'volume', 'float', val01, ltVol);
          } else if (volProp) {
            volProp.constant = val01;
          }
          if (val01 > 0 && L.muted) L.muted = false;
        };
        rng.addEventListener('input', () => {
          applyVol(Number(rng.value) / 100);
          num.value = rng.value;
        });
        num.addEventListener('change', () => {
          const v = Math.max(0, Math.min(100, Math.round(Number(num.value) || 0)));
          applyVol(v / 100);
          rng.value = v; num.value = v;
        });
        pline.append(rng, num);
        prow.append(ptop, pline);
        if (volProp && volProp.kfs.length && S.openLayerGraphs.has(volGraphKey)) {
          const gr = VM.Graph.create(
            volProp,
            { min: 0, max: 1, step: 0.01 },
            () => (L.end > L.start ? Math.max(0, Math.min(1, (S.t - L.start) / (L.end - L.start))) : 0),
            (full) => { if (full) renderInspector(true); }
          );
          prow.append(gr.el);
        }
        acard.append(prow);
        box.append(acard);
      }

      if (kind === 'video' || kind === 'image') {
        if (!VM.getProp(L.props, 'opacity') && !VM.getProp(L.transform, 'opacity')) {
          L.props.push({ name: 'opacity', ty: 'float', constant: 1, kfs: [] });
        }
      }
      box.append(el('div', 'sect', 'Параметры сейчас'));
      const card = el('div', 'fx');
      const all = [...L.transform, ...L.props];
      if (!all.length) card.append(el('div', 'muted', 'Нет параметров'));
      for (const p of all) propRow(card, p, L);
      box.append(card);
      if (L.unknown.length) box.append(el('div', 'note', 'Не поддержано пока: ' + [...new Set(L.unknown)].join(', ')));
    } else if (S.tab === 'pivot') {
      if (kind !== 'video' && kind !== 'image') {
        emptyState(box, 'Только для визуальных слоёв', 'Для аудиодорожки точка опоры и риггинг не применяются.');
        return;
      }
      const ltNow = L.end > L.start ? Math.max(0, Math.min(1, (S.t - L.start) / (L.end - L.start))) : 0;
      const curPiv = asVec(VM.evalProp(VM.getProp(L.transform, 'pivot'), ltNow), [0, 0]);

      box.append(el('div', 'sect', 'Риггинг и иерархия (Parenting)'));
      const rigCard = el('div', 'fx');
      const parRow = el('div', 'grow');
      parRow.append(el('span', 'pname', 'Родитель:'));
      const parSel = document.createElement('select');
      const noneOpt = document.createElement('option');
      noneOpt.value = '';
      noneOpt.textContent = 'Нет (основной слой / торс)';
      parSel.append(noneOpt);
      for (const cand of S.scene.layers) {
        if (cand.id === L.id || cand.fillType !== 'media') continue;
        if (isDescendantOf(cand.id, L.id)) continue;
        const opt = document.createElement('option');
        opt.value = cand.id;
        opt.textContent = cand.label || cand.id;
        if (L.parentId === cand.id) opt.selected = true;
        parSel.append(opt);
      }
      parSel.addEventListener('change', () => {
        L.parentId = parSel.value || '';
        S.lastSig = '';
        renderInspector(true);
        status(L.parentId ? 'Слой привязан к родителю' : 'Привязка к родителю снята');
      });
      parRow.append(parSel);
      rigCard.append(parRow);

      const toolRow = el('div', 'tool-bar');
      toolRow.style.marginTop = '8px';
      const toolsDef = [
        ['move', 'Перемещение', 'Перетаскивание слоя и точки опоры на сцене'],
        ['crop', 'Выделить часть', 'Выделить голову/руку/волосы рамкой прямо на сцене'],
        ['corner', 'Деформация (сетка)', 'Сетка точек по всему объекту (от 3×3 до 8×8) — тяните любую точку или область'],
      ];
      for (const [tid, tlabel, ttitle] of toolsDef) {
        const tb = el('button', 'btn' + (S.stageTool === tid ? ' primary' : ''), tlabel);
        tb.title = ttitle;
        tb.addEventListener('click', () => {
          S.stageTool = S.stageTool === tid && tid !== 'move' ? 'move' : tid;
          if (S.stageTool === 'corner') {
            ensureLayerMeshWarp(L);
          }
          syncStageOverlay();
          renderInspector(true);
          status(
            S.stageTool === 'crop'
              ? 'Протяните рамку на сцене, чтобы выделить часть объекта (Shift — квадрат)'
              : S.stageTool === 'corner'
                ? 'Сетка деформации активна: тяните любую точку или ячейку (Ctrl — выбор точек, Alt — симметрия)'
                : 'Режим перемещения (розовую опору можно тянуть прямо на сцене)'
          );
        });
        toolRow.append(tb);
      }
      rigCard.append(toolRow);

      if (S.stageTool === 'corner' || L.cornerWarp) {
        const cw = ensureLayerMeshWarp(L);
        const gridRow = el('div', 'tool-subrow');
        gridRow.append(el('span', 'muted', `Сетка (${cw.cols * cw.rows} т.):`));
        for (const [gc, gr, glabel] of [[3, 3, '3×3'], [4, 4, '4×4'], [5, 5, '5×5'], [6, 6, '6×6'], [8, 8, '8×8']]) {
          const gb = el('button', 'mini' + (cw.cols === gc && cw.rows === gr ? ' on' : ''), glabel);
          gb.style.width = 'auto';
          gb.style.padding = '0 7px';
          gb.addEventListener('click', () => {
            resampleLayerMesh(L, gc, gr);
            S.warpSelPts.clear();
            S.lastSig = '';
            syncStageOverlay();
            renderInspector(true);
            status(`Сетка деформации: ${gc}×${gr} (${gc * gr} точек)`);
          });
          gridRow.append(gb);
        }
        rigCard.append(gridRow);

        const modeRow = el('div', 'tool-subrow');
        modeRow.append(el('span', 'muted', 'Кривизна:'));
        const warpModes = [
          [1, 'Плавная кривая'],
          [0, 'Точная сетка'],
        ];
        for (const [mid, mlabel] of warpModes) {
          const mb = el('button', 'mini' + ((cw.mode ?? 1) === mid ? ' on' : ''), mlabel);
          mb.style.width = 'auto';
          mb.style.padding = '0 8px';
          mb.addEventListener('click', () => {
            cw.mode = mid;
            S.lastSig = '';
            syncStageOverlay();
            renderInspector(true);
          });
          modeRow.append(mb);
        }
        rigCard.append(modeRow);

        const brushRow = el('div', 'prow');
        brushRow.style.marginTop = '6px';
        const brushTop = el('div', 'ptop');
        brushTop.append(el('span', 'pname', 'Мягкий захват соседей'));
        const brushValEl = el('span', 'pval', Math.round((cw.brushRadius || 0) * 100) + '%');
        brushTop.append(brushValEl);
        const brushLine = el('div', 'pline');
        const brushRng = document.createElement('input');
        brushRng.type = 'range'; brushRng.min = 0; brushRng.max = 100; brushRng.step = 5;
        brushRng.value = Math.round((cw.brushRadius || 0) * 100);
        brushRng.addEventListener('input', () => {
          cw.brushRadius = Number(brushRng.value) / 100;
          brushValEl.textContent = brushRng.value + '%';
          syncStageOverlay();
        });
        brushLine.append(brushRng);
        brushRow.append(brushTop, brushLine);
        rigCard.append(brushRow);

        const warpActs = el('div', 'actions');
        warpActs.style.marginTop = '6px';
        warpActs.style.marginBottom = '0';
        const detectBtn = el('button', 'btn', 'По контуру объекта');
        detectBtn.title = 'Разместить сетку точек по силуэту объекта на текущем кадре';
        detectBtn.addEventListener('click', () => {
          analyzeLayerCorners(L, { cols: cw.cols, rows: cw.rows, fitContour: true });
          S.warpSelPts.clear();
          S.lastSig = '';
          syncStageOverlay();
          renderInspector(true);
          status('Точки сетки расставлены по контуру объекта');
        });
        const fullGridBtn = el('button', 'btn', 'Весь кадр');
        fullGridBtn.title = 'Расставить сетку равномерно по всему прямоугольнику слоя';
        fullGridBtn.addEventListener('click', () => {
          analyzeLayerCorners(L, { cols: cw.cols, rows: cw.rows, fullFrame: true });
          S.warpSelPts.clear();
          S.lastSig = '';
          syncStageOverlay();
          renderInspector(true);
          status('Сетка выровнена по всему слою');
        });
        const resetWarpBtn = el('button', 'btn danger', 'Сбросить');
        resetWarpBtn.addEventListener('click', () => {
          const keepCols = cw.cols, keepRows = cw.rows, keepMode = cw.mode ?? 1, keepBrush = cw.brushRadius || 0;
          delete L.cornerWarp;
          S.warpSelPts.clear();
          if (S.stageTool === 'corner') {
            analyzeLayerCorners(L, { cols: keepCols, rows: keepRows, fitContour: true });
            L.cornerWarp.mode = keepMode;
            L.cornerWarp.brushRadius = keepBrush;
          }
          S.lastSig = '';
          syncStageOverlay();
          renderInspector(true);
          status('Деформация сброшена');
        });
        warpActs.append(detectBtn, fullGridBtn, resetWarpBtn);
        rigCard.append(warpActs);
      }
      box.append(rigCard);

      box.append(el('div', 'sect', 'Точка опоры (сустав) и нарезка'));
      const pCard = el('div', 'fx');

      const pivSplit = el('div', 'piv-split');
      const pivGrid = el('div', 'piv-grid');
      const pivPresets = [
        ['↖', -1, -1], ['↑', 0, -1], ['↗', 1, -1],
        ['←', -1, 0],  ['•', 0, 0],  ['→', 1, 0],
        ['↙', -1, 1],  ['↓', 0, 1],  ['↘', 1, 1],
      ];
      for (const [glyph, px, py] of pivPresets) {
        const pb = el('button', 'mini' + (Math.abs(curPiv[0] - px) < 0.05 && Math.abs(curPiv[1] - py) < 0.05 ? ' on' : ''), glyph);
        pb.title = `Опора (${px}, ${py})`;
        pb.addEventListener('click', () => {
          setLayerPropValue(L, 'transform', 'pivot', 'vec2', [px, py], ltNow);
          S.lastSig = '';
          renderInspector(true);
        });
        pivGrid.append(pb);
      }

      const pivStage = el('div', 'piv-preview');
      const pivThumbCanvas = document.createElement('canvas');
      pivThumbCanvas.width = 240;
      pivThumbCanvas.height = 180;
      pivThumbCanvas.className = 'piv-thumb-canvas';
      const cropPreviewCanvas = document.createElement('canvas');
      cropPreviewCanvas.width = 240;
      cropPreviewCanvas.height = 180;
      cropPreviewCanvas.className = 'piv-crop-result-canvas';

      const drawLayerSnapshot = (regionOverride) => {
        const mm = S.media.get(srcUri(L));
        const srcEl = mm ? mm.el : null;
        const sw = mm ? (mm.kind === 'image' ? mm.w : (srcEl && srcEl.videoWidth) || 0) : 0;
        const sh = mm ? (mm.kind === 'image' ? mm.h : (srcEl && srcEl.videoHeight) || 0) : 0;
        const fullBox = getLayerVisualBox(L, ltNow, true);
        const asp = Math.max(0.35, Math.min(2.6, fullBox.hx / Math.max(1, fullBox.hy)));
        const cw = 240;
        const ch = Math.max(96, Math.min(180, Math.round(cw / asp)));
        pivThumbCanvas.width = cw;
        pivThumbCanvas.height = ch;
        pivStage.style.height = Math.round(ch * 0.68) + 'px';

        const ctx2 = pivThumbCanvas.getContext('2d');
        ctx2.clearRect(0, 0, cw, ch);
        if (srcEl && sw > 0 && sh > 0) {
          try {
            ctx2.drawImage(srcEl, 0, 0, sw, sh, 0, 0, cw, ch);
          } catch (_) {}
        } else {
          ctx2.fillStyle = '#181c26';
          ctx2.fillRect(0, 0, cw, ch);
        }

        const cr = regionOverride || L.cropRegion || { x0: 0, y0: 0, x1: 1, y1: 1 };
        const rx = Math.round(cr.x0 * cw);
        const ry = Math.round(cr.y0 * ch);
        const rw = Math.max(4, Math.round((cr.x1 - cr.x0) * cw));
        const rh = Math.max(4, Math.round((cr.y1 - cr.y0) * ch));
        if (regionOverride || L.cropRegion) {
          ctx2.fillStyle = 'rgba(8, 10, 16, 0.58)';
          ctx2.fillRect(0, 0, cw, ry);
          ctx2.fillRect(0, ry + rh, cw, ch - (ry + rh));
          ctx2.fillRect(0, ry, rx, rh);
          ctx2.fillRect(rx + rw, ry, cw - (rx + rw), rh);
        }

        const cAsp = Math.max(0.35, Math.min(2.6, ((cr.x1 - cr.x0) * fullBox.hx) / Math.max(1, (cr.y1 - cr.y0) * fullBox.hy)));
        const pw = 220;
        const ph = Math.max(84, Math.min(150, Math.round(pw / cAsp)));
        cropPreviewCanvas.width = pw;
        cropPreviewCanvas.height = ph;
        const pctx = cropPreviewCanvas.getContext('2d');
        pctx.clearRect(0, 0, pw, ph);
        if (srcEl && sw > 0 && sh > 0) {
          try {
            pctx.drawImage(
              srcEl,
              cr.x0 * sw, cr.y0 * sh, Math.max(1, (cr.x1 - cr.x0) * sw), Math.max(1, (cr.y1 - cr.y0) * sh),
              0, 0, pw, ph
            );
          } catch (_) {}
        } else {
          pctx.fillStyle = '#181c26';
          pctx.fillRect(0, 0, pw, ph);
        }
      };

      const selBox = el('div', 'piv-crop-box');
      if (L.cropRegion) {
        selBox.style.left = (L.cropRegion.x0 * 100) + '%';
        selBox.style.top = (L.cropRegion.y0 * 100) + '%';
        selBox.style.width = ((L.cropRegion.x1 - L.cropRegion.x0) * 100) + '%';
        selBox.style.height = ((L.cropRegion.y1 - L.cropRegion.y0) * 100) + '%';
      } else {
        selBox.hidden = true;
      }
      const pivDot = el('div', 'piv-dot');
      pivDot.style.left = ((curPiv[0] * 0.5 + 0.5) * 100) + '%';
      pivDot.style.top = ((curPiv[1] * 0.5 + 0.5) * 100) + '%';
      pivStage.append(pivThumbCanvas, selBox, pivDot);
      drawLayerSnapshot(null);
      pivStage.title = 'Клик — поставить опору; протяните рамку (Shift — квадрат) — выделить часть объекта';
      pivStage.addEventListener('pointerdown', (ev) => {
        ev.preventDefault();
        const r = pivStage.getBoundingClientRect();
        const u0 = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
        const v0 = Math.max(0, Math.min(1, (ev.clientY - r.top) / r.height));
        let dragged = false;

        const computeRegion = (e2) => {
          let u1 = Math.max(0, Math.min(1, (e2.clientX - r.left) / r.width));
          let v1 = Math.max(0, Math.min(1, (e2.clientY - r.top) / r.height));
          if (e2.shiftKey) {
            const side = Math.max(Math.abs(u1 - u0), Math.abs(v1 - v0));
            u1 = Math.max(0, Math.min(1, u0 + Math.sign(u1 - u0 || 1) * side));
            v1 = Math.max(0, Math.min(1, v0 + Math.sign(v1 - v0 || 1) * side));
          }
          return {
            x0: Math.round(Math.min(u0, u1) * 10000) / 10000,
            x1: Math.round(Math.max(u0, u1) * 10000) / 10000,
            y0: Math.round(Math.min(v0, v1) * 10000) / 10000,
            y1: Math.round(Math.max(v0, v1) * 10000) / 10000,
          };
        };

        const move = (e2) => {
          const u1 = Math.max(0, Math.min(1, (e2.clientX - r.left) / r.width));
          const v1 = Math.max(0, Math.min(1, (e2.clientY - r.top) / r.height));
          if (!dragged && Math.hypot(u1 - u0, v1 - v0) < 0.035) return;
          dragged = true;
          const reg = computeRegion(e2);
          selBox.hidden = false;
          selBox.style.left = (reg.x0 * 100) + '%';
          selBox.style.top = (reg.y0 * 100) + '%';
          selBox.style.width = ((reg.x1 - reg.x0) * 100) + '%';
          selBox.style.height = ((reg.y1 - reg.y0) * 100) + '%';
          drawLayerSnapshot(reg);
        };

        const up = (e2) => {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
          const reg = computeRegion(e2);
          if (dragged && (reg.x1 - reg.x0 > 0.03 && reg.y1 - reg.y0 > 0.03)) {
            L.cropRegion = reg;
            setLayerPropValue(L, 'transform', 'pivot', 'vec2', [0, 0.85], ltNow);
            status('Выделена область — можно вырезать её в отдельный дочерний слой');
          } else {
            const u1 = Math.max(0, Math.min(1, (e2.clientX - r.left) / r.width));
            const v1 = Math.max(0, Math.min(1, (e2.clientY - r.top) / r.height));
            const nx = Math.round(Math.max(-1.5, Math.min(1.5, u1 * 2 - 1)) * 100) / 100;
            const ny = Math.round(Math.max(-1.5, Math.min(1.5, v1 * 2 - 1)) * 100) / 100;
            setLayerPropValue(L, 'transform', 'pivot', 'vec2', [nx, ny], ltNow);
          }
          S.lastSig = '';
          renderInspector(true);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
      });

      pivSplit.append(pivGrid, pivStage);
      pCard.append(pivSplit);

      const cropPrevBox = el('div', 'crop-live-card');
      const cropPrevHead = el('div', 'grow');
      const crNow = L.cropRegion;
      cropPrevHead.append(el('span', 'muted', crNow
        ? `Область: ${Math.round((crNow.x1 - crNow.x0) * 100)}% × ${Math.round((crNow.y1 - crNow.y0) * 100)}%`
        : 'Выделите часть (голову/руку) рамкой выше или на сцене'));
      cropPrevBox.append(cropPrevHead, cropPreviewCanvas);
      if (crNow) {
        const cropBtns = el('div', 'actions');
        cropBtns.style.marginBottom = '0';
        const splitChildBtn = el('button', 'btn primary', 'Вырезать в новый слой');
        splitChildBtn.title = 'Создаст отдельный слой для этой части с опорой в суставе и привяжет к текущему слою';
        splitChildBtn.addEventListener('click', () => extractRegionToChildLayer(L, ltNow));
        const clrCrop = el('button', 'btn danger', 'Сбросить');
        clrCrop.addEventListener('click', () => {
          delete L.cropRegion;
          S.lastSig = '';
          renderInspector(true);
          status('Выделение области сброшено');
        });
        cropBtns.append(splitChildBtn, clrCrop);
        cropPrevBox.append(cropBtns);
      }
      pCard.append(cropPrevBox);

      const makeAxis = (label, axisIdx) => {
        const prow = el('div', 'prow');
        const ptop = el('div', 'ptop');
        ptop.append(el('span', 'pname', label));
        const pline = el('div', 'pline');
        const rng = document.createElement('input');
        rng.type = 'range'; rng.min = -1.5; rng.max = 1.5; rng.step = 0.01;
        rng.value = curPiv[axisIdx];
        const num = document.createElement('input');
        num.type = 'number'; num.min = -2; num.max = 2; num.step = 0.01;
        num.value = Math.round(curPiv[axisIdx] * 100) / 100;
        const updateAxis = (val) => {
          const next = curPiv.slice();
          next[axisIdx] = Math.round(val * 100) / 100;
          curPiv[axisIdx] = next[axisIdx];
          pivDot.style.left = ((curPiv[0] * 0.5 + 0.5) * 100) + '%';
          pivDot.style.top = ((curPiv[1] * 0.5 + 0.5) * 100) + '%';
          setLayerPropValue(L, 'transform', 'pivot', 'vec2', next, ltNow);
          S.lastSig = '';
        };
        rng.addEventListener('input', () => { const v = Number(rng.value); num.value = v; updateAxis(v); });
        num.addEventListener('change', () => { const v = Number(num.value) || 0; rng.value = v; updateAxis(v); });
        pline.append(rng, num);
        prow.append(ptop, pline);
        return prow;
      };
      pCard.append(makeAxis('Опора X (−1 лево … +1 право)', 0), makeAxis('Опора Y (−1 верх … +1 низ)', 1));
      const rstRow = el('div', 'actions');
      const rstBtn = el('button', 'btn', 'Сбросить в центр (0, 0)');
      rstBtn.addEventListener('click', () => {
        setLayerPropValue(L, 'transform', 'pivot', 'vec2', [0, 0], ltNow);
        S.lastSig = '';
        renderInspector(true);
      });
      rstRow.append(rstBtn);
      pCard.append(rstRow);
      box.append(pCard);

      box.append(el('div', 'sect', 'Поворот объекта'));
      const rotCard = el('div', 'fx');
      const curRotRaw = VM.evalProp(VM.getProp(L.transform, 'rotation'), ltNow);
      let curRot = typeof curRotRaw === 'number' ? Math.round(curRotRaw * 10) / 10 : 0;
      const rotRow = el('div', 'prow');
      const rotTop = el('div', 'ptop');
      rotTop.append(el('span', 'pname', 'Угол (°) · на сцене тяните за угол'));
      const rotLine = el('div', 'pline');
      const rotRng = document.createElement('input');
      rotRng.type = 'range'; rotRng.min = -360; rotRng.max = 360; rotRng.step = 0.5;
      rotRng.value = Math.max(-360, Math.min(360, curRot));
      const rotNum = document.createElement('input');
      rotNum.type = 'number'; rotNum.min = -3600; rotNum.max = 3600; rotNum.step = 0.5;
      rotNum.value = curRot;
      const applyRotVal = (deg) => {
        curRot = Math.round(deg * 10) / 10;
        setLayerPropValue(L, 'transform', 'rotation', 'float', curRot, ltNow);
        S.lastSig = '';
      };
      rotRng.addEventListener('input', () => { const v = Number(rotRng.value); rotNum.value = v; applyRotVal(v); });
      rotNum.addEventListener('change', () => { const v = Number(rotNum.value) || 0; rotRng.value = Math.max(-360, Math.min(360, v)); applyRotVal(v); });
      rotLine.append(rotRng, rotNum);
      rotRow.append(rotTop, rotLine);
      const rotActs = el('div', 'actions');
      for (const [lbl, deg] of [['−90°', -90], ['0°', 0], ['+90°', 90], ['180°', 180]]) {
        const qb = el('button', 'mini', lbl);
        qb.style.width = 'auto';
        qb.style.padding = '0 8px';
        qb.addEventListener('click', () => {
          applyRotVal(deg);
          renderInspector(true);
        });
        rotActs.append(qb);
      }
      rotCard.append(rotRow, rotActs);
      box.append(rotCard);

      box.append(el('div', 'sect', 'Графики и кривые Безье (Curves)'));
      renderTransformCurveEditor(box, L, ltNow);
    } else if (S.tab === 'fx') {
      S.fxui.render(box, L);
    } else {
      const m = S.media.get(srcUri(L));
      const info = mediaInfo(srcUri(L));
      const card = el('div', 'card');
      card.append(el('div', 'muted', 'Сейчас в слое'));
      card.append(el('div', 'title', m ? m.name : (info ? info.filename : '—')));
      card.append(el('div', m ? 'muted ok' : 'muted',
        m ? '✓ файл подключён' + (m.w ? ' · ' + m.w + '×' + m.h : '') : 'файла нет — показывается шахматка'));
      box.append(card);

      const lab = el('label', 'btn primary big', 'Заменить файл в этом слое…');
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = L.fillType === 'audio' ? 'audio/*' : 'video/*,image/*'; inp.hidden = true;
      lab.append(inp);
      inp.addEventListener('change', async () => {
        const f = inp.files[0];
        if (!f) return;
        const uri = 'local:' + (++S.localN);
        const nm = await attachFile(uri, f);
        S.scene.media.push({ uri, filename: f.name, width: nm.w, height: nm.h, kind: nm.kind, local: true });
        L.src = uri; L.fillMode = 'fit';
        status('В слое «' + (L.label || L.id) + '» теперь ' + f.name);
        buildMediaList(); S.tl.refreshRow(L.id); renderInspector(true);
      });
      box.append(lab);
      box.append(el('div', 'note', 'Замена действует только на этот слой. Чтобы заменить файл сразу во всех слоях — «Заменить» в списке файлов слева.'));

      box.append(el('div', 'sect', 'Или взять из файлов проекта'));
      const sel = document.createElement('select');
      const kindWanted = L.fillType === 'audio' ? 'audio' : null;
      for (const mi of S.scene.media) {
        const have = S.media.get(mi.uri);
        if (kindWanted && (!have || have.kind !== kindWanted)) continue;
        if (!kindWanted && have && have.kind === 'audio') continue;
        const o = document.createElement('option');
        o.value = mi.uri;
        o.textContent = (have ? '' : '(нет файла) ') + mi.filename;
        if (mi.uri === srcUri(L)) o.selected = true;
        sel.append(o);
      }
      sel.addEventListener('change', () => { L.src = sel.value === L.fillVideo ? '' : sel.value; buildMediaList(); renderInspector(true); });
      box.append(sel);
    }
  }

  for (const b of document.querySelectorAll('#tabs button')) {
    b.addEventListener('click', () => { S.tab = b.dataset.tab; renderInspector(true); });
  }

  function renderTransformCurveEditor(box, L, ltNow) {
    const card = el('div', 'fx');
    const topRow = el('div', 'grow');
    const propSel = document.createElement('select');
    const propDefs = [
      ['rotation', 'Поворот (°)', 'rotation', 'float', -1, 0],
      ['location.y', 'Позиция Y (вверх-вниз)', 'location', 'vec2', 1, S.scene ? S.scene.height / 2 : 540],
      ['location.x', 'Позиция X (влево-вправо)', 'location', 'vec2', 0, S.scene ? S.scene.width / 2 : 540],
      ['scale.x', 'Масштаб X', 'scale', 'vec2', 0, 1],
      ['scale.y', 'Масштаб Y', 'scale', 'vec2', 1, 1],
      ['opacity', 'Прозрачность (затемнение)', 'opacity', 'float', -1, 1],
    ];
    for (const [id, lbl] of propDefs) {
      const o = document.createElement('option');
      o.value = id;
      o.textContent = lbl;
      if (id === S.curveProp) o.selected = true;
      propSel.append(o);
    }
    propSel.addEventListener('change', () => {
      S.curveProp = propSel.value;
      S.curveSelIdx = 0;
      renderInspector(true);
    });

    const curDef = propDefs.find((d) => d[0] === S.curveProp) || propDefs[0];
    const [, , propName, propTy, vecIdx, defScalar] = curDef;

    const ensureProp = () => {
      const targetList = propName === 'opacity' ? L.props : L.transform;
      let p = VM.getProp(targetList, propName) || VM.getProp(L.transform, propName) || VM.getProp(L.props, propName);
      if (!p) {
        const initVal = propTy === 'vec2'
          ? (propName === 'location' ? [S.scene.width / 2, S.scene.height / 2] : [1, 1])
          : (propName === 'opacity' ? 1 : 0);
        p = { name: propName, ty: propTy, constant: initVal, kfs: [] };
        targetList.push(p);
      }
      if (!p.kfs) p.kfs = [];
      return p;
    };

    const getScalar = (val) => (vecIdx >= 0 ? (Array.isArray(val) ? Number(val[vecIdx]) || 0 : Number(val) || 0) : Number(val) || 0);
    const setScalarOnVal = (origVal, nextScalar) => {
      if (vecIdx < 0) return Math.round(nextScalar * 1000) / 1000;
      const base = Array.isArray(origVal) ? origVal.slice() : [defScalar, defScalar];
      base[vecIdx] = Math.round(nextScalar * 1000) / 1000;
      return base;
    };

    const p = ensureProp();
    const addKeyBtn = el('button', 'mini on', '+ Ключ');
    addKeyBtn.style.width = 'auto';
    addKeyBtn.style.padding = '0 8px';
    addKeyBtn.title = 'Поставить ключевой кадр в текущей позиции курсора';
    addKeyBtn.addEventListener('click', () => {
      const tNorm = Math.round(ltNow * 1000) / 1000;
      const curFull = VM.evalProp(p, ltNow);
      const fallbackFull = propTy === 'vec2' ? [defScalar, defScalar] : defScalar;
      const valCopy = Array.isArray(curFull) ? curFull.slice() : (typeof curFull === 'number' ? curFull : fallbackFull);
      if (!p.kfs.length) {
        p.kfs.push({ t: 0, v: Array.isArray(valCopy) ? valCopy.slice() : valCopy, e: null });
        if (tNorm > 0.02 && tNorm < 0.98) {
          p.kfs.push({ t: tNorm, v: Array.isArray(valCopy) ? valCopy.slice() : valCopy, e: [0.42, 0, 0.58, 1] });
        }
        p.kfs.push({ t: 1, v: Array.isArray(valCopy) ? valCopy.slice() : valCopy, e: [0.42, 0, 0.58, 1] });
      } else {
        const hit = p.kfs.findIndex((k) => Math.abs(k.t - tNorm) < 0.015);
        if (hit >= 0) S.curveSelIdx = hit;
        else {
          p.kfs.push({ t: tNorm, v: valCopy, e: [0.42, 0, 0.58, 1] });
          p.kfs.sort((a, b) => a.t - b.t);
          S.curveSelIdx = p.kfs.findIndex((k) => Math.abs(k.t - tNorm) < 0.002);
        }
      }
      S.lastSig = '';
      renderInspector(true);
    });
    topRow.append(propSel, addKeyBtn);
    card.append(topRow);

    const W = 260, H = 126, PAD_X = 14, PAD_Y = 14;
    const plotW = W - PAD_X * 2, plotH = H - PAD_Y * 2;

    const samples = [];
    const N_SAMP = 64;
    for (let i = 0; i <= N_SAMP; i++) {
      const tt = i / N_SAMP;
      samples.push({ t: tt, y: getScalar(VM.evalProp(p, tt)) });
    }
    const kfPts = p.kfs.map((k, idx) => ({ idx, t: k.t, y: getScalar(k.v), e: k.e }));
    const allYs = [...samples.map((s) => s.y), ...kfPts.map((k) => k.y)];
    let minY = Math.min(...allYs);
    let maxY = Math.max(...allYs);
    if (Math.abs(maxY - minY) < 1e-4) {
      const span = propName === 'scale' ? 0.5 : propName === 'rotation' ? 30 : 80;
      minY -= span;
      maxY += span;
    } else {
      const margin = (maxY - minY) * 0.16;
      minY -= margin;
      maxY += margin;
    }

    const toSvgX = (t) => PAD_X + Math.max(0, Math.min(1, t)) * plotW;
    const toSvgY = (val) => PAD_Y + (1 - (val - minY) / (maxY - minY)) * plotH;
    const fromSvgX = (sx) => Math.max(0, Math.min(1, (sx - PAD_X) / plotW));
    const fromSvgY = (sy) => minY + (1 - Math.max(0, Math.min(1, (sy - PAD_Y) / plotH))) * (maxY - minY);

    const graphWrap = el('div', 'graph');
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('height', String(H));
    svg.classList.add('gsvg');

    for (let g = 0; g <= 4; g++) {
      const gx = PAD_X + (plotW * g) / 4;
      const gy = PAD_Y + (plotH * g) / 4;
      const vl = document.createElementNS(svgNS, 'line');
      vl.setAttribute('x1', gx); vl.setAttribute('x2', gx); vl.setAttribute('y1', PAD_Y); vl.setAttribute('y2', H - PAD_Y);
      vl.classList.add('ggrid');
      const hl = document.createElementNS(svgNS, 'line');
      hl.setAttribute('x1', PAD_X); hl.setAttribute('x2', W - PAD_X); hl.setAttribute('y1', gy); hl.setAttribute('y2', gy);
      hl.classList.add('ggrid');
      svg.append(vl, hl);
    }

    const pathEl = document.createElementNS(svgNS, 'path');
    pathEl.classList.add('gcurve');
    pathEl.setAttribute('d', samples.map((s, i) => `${i === 0 ? 'M' : 'L'}${toSvgX(s.t).toFixed(1)},${toSvgY(s.y).toFixed(1)}`).join(' '));
    svg.append(pathEl);

    const phLine = document.createElementNS(svgNS, 'line');
    phLine.classList.add('gplayhead');
    phLine.setAttribute('x1', toSvgX(ltNow));
    phLine.setAttribute('x2', toSvgX(ltNow));
    phLine.setAttribute('y1', 4);
    phLine.setAttribute('y2', H - 4);
    svg.append(phLine);

    if (S.curveSelIdx >= kfPts.length) S.curveSelIdx = Math.max(0, kfPts.length - 1);

    kfPts.forEach((pt, idx) => {
      const c = document.createElementNS(svgNS, 'circle');
      c.setAttribute('cx', toSvgX(pt.t));
      c.setAttribute('cy', toSvgY(pt.y));
      c.setAttribute('r', idx === S.curveSelIdx ? '5.2' : '4.2');
      c.classList.add('gdot');
      if (idx === S.curveSelIdx) c.classList.add('sel');
      c.addEventListener('pointerdown', (ev) => {
        ev.stopPropagation();
        ev.preventDefault();
        S.curveSelIdx = idx;
        const rect = svg.getBoundingClientRect();
        const isEdge = idx === 0 || idx === p.kfs.length - 1;
        const movePt = (e2) => {
          const sx = ((e2.clientX - rect.left) / rect.width) * W;
          const sy = ((e2.clientY - rect.top) / rect.height) * H;
          const kf = p.kfs[idx];
          if (!kf) return;
          if (!isEdge) {
            const minT = (p.kfs[idx - 1]?.t ?? 0) + 0.01;
            const maxT = (p.kfs[idx + 1]?.t ?? 1) - 0.01;
            kf.t = Math.round(Math.max(minT, Math.min(maxT, fromSvgX(sx))) * 1000) / 1000;
          }
          kf.v = setScalarOnVal(kf.v, fromSvgY(sy));
          S.lastSig = '';
          c.setAttribute('cx', toSvgX(kf.t));
          c.setAttribute('cy', toSvgY(getScalar(kf.v)));
          const ptsNow = [];
          for (let i = 0; i <= N_SAMP; i++) {
            const tt = i / N_SAMP;
            ptsNow.push(`${i === 0 ? 'M' : 'L'}${toSvgX(tt).toFixed(1)},${toSvgY(getScalar(VM.evalProp(p, tt))).toFixed(1)}`);
          }
          pathEl.setAttribute('d', ptsNow.join(' '));
        };
        const upPt = () => {
          window.removeEventListener('pointermove', movePt);
          window.removeEventListener('pointerup', upPt);
          renderInspector(true);
        };
        window.addEventListener('pointermove', movePt);
        window.addEventListener('pointerup', upPt);
      });
      svg.append(c);
    });

    svg.addEventListener('dblclick', (ev) => {
      const rect = svg.getBoundingClientRect();
      const sx = ((ev.clientX - rect.left) / rect.width) * W;
      const sy = ((ev.clientY - rect.top) / rect.height) * H;
      const tNew = Math.round(fromSvgX(sx) * 1000) / 1000;
      const yNew = fromSvgY(sy);
      if (!p.kfs.length) {
        const baseVal = VM.evalProp(p, 0);
        p.kfs.push({ t: 0, v: Array.isArray(baseVal) ? baseVal.slice() : baseVal, e: null });
        p.kfs.push({ t: 1, v: Array.isArray(baseVal) ? baseVal.slice() : baseVal, e: [0.42, 0, 0.58, 1] });
      }
      const curFull = VM.evalProp(p, tNew);
      p.kfs.push({ t: tNew, v: setScalarOnVal(curFull, yNew), e: [0.42, 0, 0.58, 1] });
      p.kfs.sort((a, b) => a.t - b.t);
      S.curveSelIdx = p.kfs.findIndex((k) => Math.abs(k.t - tNew) < 0.002);
      S.lastSig = '';
      renderInspector(true);
    });

    graphWrap.append(svg);

    if (p.kfs.length > 0 && p.kfs[S.curveSelIdx]) {
      const selKf = p.kfs[S.curveSelIdx];
      const det = el('div', 'gdetail');
      const r1 = el('div', 'grow');
      r1.append(el('span', 'muted', `Ключ #${S.curveSelIdx + 1}:`));
      const valInp = document.createElement('input');
      valInp.type = 'number';
      valInp.step = propName === 'scale' ? '0.05' : '1';
      valInp.value = String(Math.round(getScalar(selKf.v) * 100) / 100);
      valInp.addEventListener('change', () => {
        selKf.v = setScalarOnVal(selKf.v, Number(valInp.value) || 0);
        S.lastSig = '';
        renderInspector(true);
      });

      const easeSel = document.createElement('select');
      const easePresets = [
        ['linear', 'Линейно', null],
        ['smooth', 'Плавно (Ease In-Out)', [0.42, 0, 0.58, 1]],
        ['whip', 'Резкий вылет (Whip)', [0.06, 0.96, 0.18, 1]],
        ['overshoot', 'Перелёт (Overshoot)', [0.16, 1.55, 0.34, 0.96]],
        ['bounce', 'Отскок (Rebound)', [0.22, 1.35, 0.42, 1]],
      ];
      const curEaseStr = JSON.stringify(selKf.e || null);
      for (const [eid, elbl, evec] of easePresets) {
        const o = document.createElement('option');
        o.value = eid;
        o.textContent = elbl;
        if (JSON.stringify(evec) === curEaseStr) o.selected = true;
        easeSel.append(o);
      }
      easeSel.addEventListener('change', () => {
        const found = easePresets.find((x) => x[0] === easeSel.value);
        selKf.e = found && found[2] ? found[2].slice() : null;
        S.lastSig = '';
        renderInspector(true);
      });

      const delKeyBtn = el('button', 'mini danger', '✕');
      delKeyBtn.title = 'Удалить этот ключ';
      delKeyBtn.addEventListener('click', () => {
        p.kfs.splice(S.curveSelIdx, 1);
        S.curveSelIdx = Math.max(0, S.curveSelIdx - 1);
        S.lastSig = '';
        renderInspector(true);
      });
      r1.append(valInp, easeSel, delKeyBtn);
      det.append(r1);

      if (S.curveSelIdx > 0) {
        const bSize = 128, bPad = 14;
        const yMin = -0.6, yMax = 1.8, ySpan = yMax - yMin;
        const bx = (x) => bPad + x * bSize;
        const by = (y) => bPad + (1 - (y - yMin) / ySpan) * bSize;
        const byInv = (py) => yMin + (1 - (py - bPad) / bSize) * ySpan;
        const bSvg = document.createElementNS(svgNS, 'svg');
        bSvg.setAttribute('viewBox', `0 0 ${bSize + bPad * 2} ${bSize + bPad * 2}`);
        bSvg.classList.add('esvg');

        const drawBezierBox = () => {
          bSvg.textContent = '';
          const e = selKf.e || [0.3333, 0.3333, 0.6667, 0.6667];
          const boxR = document.createElementNS(svgNS, 'rect');
          boxR.setAttribute('x', bx(0)); boxR.setAttribute('y', by(1));
          boxR.setAttribute('width', bSize); boxR.setAttribute('height', by(0) - by(1));
          boxR.classList.add('ebox');
          const diag = document.createElementNS(svgNS, 'line');
          diag.setAttribute('x1', bx(0)); diag.setAttribute('y1', by(0));
          diag.setAttribute('x2', bx(1)); diag.setAttribute('y2', by(1));
          diag.classList.add('ediag');
          bSvg.append(boxR, diag);

          let dStr = '';
          for (let i = 0; i <= 40; i++) {
            const s = i / 40, m = 1 - s;
            const cx = 3 * m * m * s * e[0] + 3 * m * s * s * e[2] + s * s * s;
            const cy = 3 * m * m * s * e[1] + 3 * m * s * s * e[3] + s * s * s;
            dStr += (i ? 'L' : 'M') + bx(cx).toFixed(1) + ' ' + by(cy).toFixed(1);
          }
          const l1 = document.createElementNS(svgNS, 'line');
          l1.setAttribute('x1', bx(0)); l1.setAttribute('y1', by(0));
          l1.setAttribute('x2', bx(e[0])); l1.setAttribute('y2', by(e[1]));
          l1.classList.add('ehandle-line');
          const l2 = document.createElementNS(svgNS, 'line');
          l2.setAttribute('x1', bx(1)); l2.setAttribute('y1', by(1));
          l2.setAttribute('x2', bx(e[2])); l2.setAttribute('y2', by(e[3]));
          l2.classList.add('ehandle-line');
          const cPath = document.createElementNS(svgNS, 'path');
          cPath.setAttribute('d', dStr);
          cPath.classList.add('ecurve');
          bSvg.append(l1, l2, cPath);

          [[0, 1], [2, 3]].forEach(([ix, iy]) => {
            const h = document.createElementNS(svgNS, 'circle');
            h.setAttribute('cx', bx(e[ix]));
            h.setAttribute('cy', by(e[iy]));
            h.setAttribute('r', '5.5');
            h.classList.add('ehandle');
            h.addEventListener('pointerdown', (ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              if (!selKf.e) selKf.e = e.slice();
              const rect = bSvg.getBoundingClientRect();
              const sc = (bSize + bPad * 2) / rect.width;
              const moveH = (e2) => {
                const px = (e2.clientX - rect.left) * sc;
                const py = (e2.clientY - rect.top) * sc;
                selKf.e[ix] = Math.round(Math.max(0, Math.min(1, (px - bPad) / bSize)) * 1000) / 1000;
                selKf.e[iy] = Math.round(Math.max(yMin, Math.min(yMax, byInv(py))) * 1000) / 1000;
                S.lastSig = '';
                drawBezierBox();
                const ptsNow = [];
                for (let i = 0; i <= N_SAMP; i++) {
                  const tt = i / N_SAMP;
                  ptsNow.push(`${i === 0 ? 'M' : 'L'}${toSvgX(tt).toFixed(1)},${toSvgY(getScalar(VM.evalProp(p, tt))).toFixed(1)}`);
                }
                pathEl.setAttribute('d', ptsNow.join(' '));
              };
              const upH = () => {
                window.removeEventListener('pointermove', moveH);
                window.removeEventListener('pointerup', upH);
                renderInspector(true);
              };
              window.addEventListener('pointermove', moveH);
              window.addEventListener('pointerup', upH);
            });
            bSvg.append(h);
          });
        };
        drawBezierBox();
        det.append(bSvg);
      }
      graphWrap.append(det);
    } else {
      graphWrap.append(el('div', 'note', 'Двойной клик по графику или «+ Ключ» создаст кривую анимации'));
    }

    card.append(graphWrap);
    box.append(card);
  }

  function syncStageOverlay() {
    let ov = $('stage-overlay');
    const frameBox = document.querySelector('.stage-frame');
    if (!frameBox) return;
    if (!ov) {
      ov = el('div', 'stage-overlay');
      ov.id = 'stage-overlay';
      frameBox.append(ov);
    }
    canvas.classList.toggle('tool-crop', S.stageTool === 'crop');
    canvas.classList.toggle('tool-corner', S.stageTool === 'corner');

    ov.textContent = '';
    const L = layerById(S.selId);
    if (!S.scene || !L || L.hidden || L.fillType !== 'media' || !(S.t >= L.start && S.t < L.end + 1)) {
      ov.hidden = true;
      return;
    }
    if (S.stageTool === 'move' && !L.cropRegion) {
      ov.hidden = true;
      return;
    }
    ov.hidden = false;
    const lt = L.end > L.start ? (S.t - L.start) / (S.end - L.start) : 0;
    const isCropTool = S.stageTool === 'crop';
    const box = getLayerVisualBox(L, lt, isCropTool);
    const W = canvas.width || 1080;
    const H = canvas.height || 1920;

    if (S.stageTool === 'corner') {
      const cw = ensureLayerMeshWarp(L);
      const cols = cw.cols;
      const rows = cw.rows;
      const wPts = getMeshHandlesWorld(L, box);
      const svgNS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible';

      const strokeW = Math.max(1.5, W * 0.0016);
      const outerStrokeW = Math.max(2.2, W * 0.0022);

      // Горизонтальные линии сетки
      for (let r = 0; r < rows; r++) {
        const isBorder = r === 0 || r === rows - 1;
        const pl = document.createElementNS(svgNS, 'polyline');
        const linePts = [];
        for (let c = 0; c < cols; c++) {
          const pt = wPts[r * cols + c];
          linePts.push(`${pt[0].toFixed(1)},${pt[1].toFixed(1)}`);
        }
        pl.setAttribute('points', linePts.join(' '));
        pl.setAttribute('fill', 'none');
        pl.setAttribute('stroke', isBorder ? '#38bdf8' : 'rgba(56, 189, 248, 0.55)');
        pl.setAttribute('stroke-width', String(isBorder ? outerStrokeW : strokeW));
        if (!isBorder) pl.setAttribute('stroke-dasharray', `${Math.max(4, W * 0.005)} ${Math.max(3, W * 0.004)}`);
        svg.append(pl);
      }

      // Вертикальные линии сетки
      for (let c = 0; c < cols; c++) {
        const isBorder = c === 0 || c === cols - 1;
        const pl = document.createElementNS(svgNS, 'polyline');
        const linePts = [];
        for (let r = 0; r < rows; r++) {
          const pt = wPts[r * cols + c];
          linePts.push(`${pt[0].toFixed(1)},${pt[1].toFixed(1)}`);
        }
        pl.setAttribute('points', linePts.join(' '));
        pl.setAttribute('fill', 'none');
        pl.setAttribute('stroke', isBorder ? '#38bdf8' : 'rgba(56, 189, 248, 0.55)');
        pl.setAttribute('stroke-width', String(isBorder ? outerStrokeW : strokeW));
        if (!isBorder) pl.setAttribute('stroke-dasharray', `${Math.max(4, W * 0.005)} ${Math.max(3, W * 0.004)}`);
        svg.append(pl);
      }
      ov.append(svg);

      const dense = cols >= 6 || rows >= 6;
      const dotPx = dense ? 10 : 12;
      const hoverUv = S.warpHoverIdx >= 0 && cw.currPts[S.warpHoverIdx] ? cw.currPts[S.warpHoverIdx] : null;
      const brushR = cw.brushRadius || 0;

      for (let idx = 0; idx < wPts.length; idx++) {
        const pt = wPts[idx];
        const r = Math.floor(idx / cols);
        const c = idx % cols;
        const isCorner = (r === 0 || r === rows - 1) && (c === 0 || c === cols - 1);
        const isSel = S.warpSelPts.has(idx);
        const isHover = idx === S.warpHoverIdx;
        let inBrush = false;
        if (hoverUv && brushR > 0.01 && !isHover) {
          const d = Math.hypot(cw.currPts[idx][0] - hoverUv[0], cw.currPts[idx][1] - hoverUv[1]);
          inBrush = d <= brushR * 1.4;
        }
        const h = el('div', 'stage-corner-handle' + (isSel || isHover ? ' dragging' : ''));
        h.dataset.meshIdx = String(idx);
        h.style.position = 'absolute';
        h.style.left = ((pt[0] / W) * 100) + '%';
        h.style.top = ((pt[1] / H) * 100) + '%';
        h.style.right = 'auto';
        h.style.bottom = 'auto';
        const sz = isCorner ? dotPx + 2 : dotPx;
        h.style.width = sz + 'px';
        h.style.height = sz + 'px';
        if (isSel) {
          h.style.background = '#f59e0b';
          h.style.borderColor = '#fff';
        } else if (inBrush) {
          h.style.background = '#7dd3fc';
          h.style.transform = 'translate(-50%, -50%) scale(1.12)';
        } else {
          h.style.transform = 'translate(-50%, -50%)';
        }
        ov.append(h);
      }
    } else {
      const guide = el('div', 'stage-box-guide' + (isCropTool ? ' crop-mode' : ''));
      guide.style.left = ((box.center[0] / W) * 100) + '%';
      guide.style.top = ((box.center[1] / H) * 100) + '%';
      guide.style.width = (((box.hx * 2) / W) * 100) + '%';
      guide.style.height = (((box.hy * 2) / H) * 100) + '%';
      guide.style.transform = `translate(-50%, -50%) rotate(${box.rotDeg}deg)`;

      if (isCropTool) {
        const cr = L.cropRegion || { x0: 0, y0: 0, x1: 1, y1: 1 };
        const marquee = el('div', 'stage-crop-marquee');
        marquee.id = 'active-crop-marquee';
        marquee.style.left = (cr.x0 * 100) + '%';
        marquee.style.top = (cr.y0 * 100) + '%';
        marquee.style.width = ((cr.x1 - cr.x0) * 100) + '%';
        marquee.style.height = ((cr.y1 - cr.y0) * 100) + '%';
        const wPx = Math.round((cr.x1 - cr.x0) * box.hx * 2);
        const hPx = Math.round((cr.y1 - cr.y0) * box.hy * 2);
        const tag = el('span', 'stage-crop-tag', `${wPx}×${hPx} px (${Math.round((cr.x1 - cr.x0) * 100)}% × ${Math.round((cr.y1 - cr.y0) * 100)}%) · Enter — применить`);
        const grid = el('div', 'stage-crop-grid');
        marquee.append(grid, tag);
        guide.append(marquee);
      }
      ov.append(guide);
    }

    const pivMark = el('div', 'stage-pivot-pin');
    pivMark.style.left = ((box.pivotWorld[0] / W) * 100) + '%';
    pivMark.style.top = ((box.pivotWorld[1] / H) * 100) + '%';
    ov.append(pivMark);
  }

  function updateUI() {
    const L = layerById(S.selId);
    if (L) {
      const lt = L.end > L.start ? Math.max(0, Math.min(1, (S.t - L.start) / (L.end - L.start))) : 0;
      const tNorm = Math.round(lt * 1000) / 1000;
      for (const item of S.valueEls) {
        const { p, v, kfBtn, controls } = item;
        const evalVal = VM.evalProp(p, lt);
        const kf = v.firstChild && v.firstChild.className === 'kfdot' ? v.firstChild : null;
        v.textContent = fmt(evalVal);
        if (kf) v.prepend(kf);
        if (kfBtn) {
          const here = p.kfs && p.kfs.some((k) => Math.abs(k.t - tNorm) < 0.005);
          kfBtn.textContent = here ? '◆' : '◇';
          kfBtn.classList.toggle('on', !!here);
          kfBtn.classList.toggle('anim', !here && !!(p.kfs && p.kfs.length));
        }
        if (controls) {
          if (controls.rng && typeof evalVal === 'number' && isFinite(evalVal)) {
            if (document.activeElement !== controls.rng) {
              controls.rng.value = Math.max(controls.minV, Math.min(controls.maxV, evalVal));
            }
            if (controls.num && document.activeElement !== controls.num) {
              controls.num.value = Math.round(evalVal * 1000) / 1000;
            }
          } else if (controls.inX && controls.inY && Array.isArray(evalVal)) {
            if (document.activeElement !== controls.inX) {
              controls.inX.value = Math.round((Number(evalVal[0]) || 0) * 100) / 100;
            }
            if (document.activeElement !== controls.inY) {
              controls.inY.value = Math.round((Number(evalVal[1]) || 0) * 100) / 100;
            }
          }
        }
      }
    }
    syncStageOverlay();
    if (S.tab === 'fx') S.fxui.tick();
    $('time').textContent = (S.t / 1000).toFixed(3) + ' с · кадр ' + Math.round((S.t / 1000) * S.scene.fps);
  }
  function scenePointFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return [0, 0];
    return [
      ((e.clientX - rect.left) / rect.width) * canvas.width,
      ((e.clientY - rect.top) / rect.height) * canvas.height,
    ];
  }

  function getLayerVisualBox(L, lt, ignoreCrop) {
    const t = L.start + lt * Math.max(0, L.end - L.start);
    const st = resolveLayerWorld(S.scene, L, t, ignoreCrop);
    return {
      loc: st.loc,
      pivot: st.pivot,
      sc: st.sc,
      rotDeg: st.rotDeg,
      rot: st.rot,
      hx: Math.abs(st.extent[0]),
      hy: Math.abs(st.extent[1]),
      center: st.center,
      pivotWorld: st.pivotWorld,
    };
  }

  function bilerp2D(u, v, a, b, c, d) {
    const omU = 1 - u, omV = 1 - v;
    return [
      omU * omV * a[0] + u * omV * b[0] + omU * v * c[0] + u * v * d[0],
      omU * omV * a[1] + u * omV * b[1] + omU * v * c[1] + u * v * d[1],
    ];
  }

  function invBilinear2D(p, a, b, c, d) {
    const cross = (p1, p2) => p1[0] * p2[1] - p1[1] * p2[0];
    const e = [b[0] - a[0], b[1] - a[1]];
    const f = [c[0] - a[0], c[1] - a[1]];
    const g = [a[0] - b[0] - c[0] + d[0], a[1] - b[1] - c[1] + d[1]];
    const h = [p[0] - a[0], p[1] - a[1]];
    const k2 = cross(g, f);
    const k1 = cross(e, f) + cross(h, g);
    const k0 = cross(h, e);
    let v = 0;
    if (Math.abs(k2) < 1e-5) {
      v = Math.abs(k1) > 1e-5 ? -k0 / k1 : 0;
    } else {
      const disc = Math.max(0, k1 * k1 - 4 * k0 * k2);
      const sq = Math.sqrt(disc);
      const ik2 = 0.5 / k2;
      const v1 = (-k1 - sq) * ik2;
      const v2 = (-k1 + sq) * ik2;
      v = Math.abs(v1 - 0.5) <= Math.abs(v2 - 0.5) ? v1 : v2;
    }
    const denom = [e[0] + g[0] * v, e[1] + g[1] * v];
    const dLen = denom[0] * denom[0] + denom[1] * denom[1];
    const u = dLen > 1e-6 ? ((h[0] - f[0] * v) * denom[0] + (h[1] - f[1] * v) * denom[1]) / dLen : 0;
    return [u, v];
  }

  function updateCornerWarpQuad(L) {
    const cw = L && L.cornerWarp;
    if (!cw || !cw.basePts || !cw.currPts) return;
    let maxD = 0;
    const n = Math.min(cw.basePts.length, cw.currPts.length);
    for (let i = 0; i < n; i++) {
      maxD = Math.max(maxD, Math.hypot(cw.currPts[i][0] - cw.basePts[i][0], cw.currPts[i][1] - cw.basePts[i][1]));
    }
    cw.delta = Math.round(maxD * 10000) / 10000;
  }

  function ensureLayerMeshWarp(L) {
    if (!L) return null;
    if (L.cornerWarp && Array.isArray(L.cornerWarp.basePts) && Array.isArray(L.cornerWarp.currPts)) {
      return L.cornerWarp;
    }
    // Миграция старого 4-точечного формата, если он был сохранён в проекте
    if (L.cornerWarp && L.cornerWarp.base && L.cornerWarp.curr) {
      const B = L.cornerWarp.base;
      const C = L.cornerWarp.curr;
      L.cornerWarp = {
        cols: 2,
        rows: 2,
        mode: L.cornerWarp.mode ?? 1,
        brushRadius: 0.35,
        basePts: [B.tl.slice(), B.tr.slice(), B.bl.slice(), B.br.slice()],
        currPts: [C.tl.slice(), C.tr.slice(), C.bl.slice(), C.br.slice()],
      };
      updateCornerWarpQuad(L);
      return L.cornerWarp;
    }
    return analyzeLayerCorners(L, { cols: 4, rows: 4, fitContour: true });
  }

  function evalMeshForwardAt(cw, uNorm, vNorm) {
    const cols = cw.cols, rows = cw.rows;
    const gx = Math.max(0, Math.min(cols - 1.0001, uNorm * (cols - 1)));
    const gy = Math.max(0, Math.min(rows - 1.0001, vNorm * (rows - 1)));
    const ci = Math.floor(gx);
    const cj = Math.floor(gy);
    const s = gx - ci;
    const t = gy - cj;
    const i00 = cj * cols + ci;
    const b00 = cw.basePts[i00], b10 = cw.basePts[i00 + 1], b01 = cw.basePts[i00 + cols], b11 = cw.basePts[i00 + cols + 1];
    const c00 = cw.currPts[i00], c10 = cw.currPts[i00 + 1], c01 = cw.currPts[i00 + cols], c11 = cw.currPts[i00 + cols + 1];
    return {
      base: bilerp2D(s, t, b00, b10, b01, b11),
      curr: bilerp2D(s, t, c00, c10, c01, c11),
    };
  }

  function resampleLayerMesh(L, newCols, newRows) {
    const cw = ensureLayerMeshWarp(L);
    const cols = Math.min(8, Math.max(2, newCols));
    const rows = Math.min(8, Math.max(2, newRows));
    const nextBase = [];
    const nextCurr = [];
    for (let r = 0; r < rows; r++) {
      const v = r / (rows - 1);
      for (let c = 0; c < cols; c++) {
        const u = c / (cols - 1);
        const sample = evalMeshForwardAt(cw, u, v);
        nextBase.push([Math.round(sample.base[0] * 10000) / 10000, Math.round(sample.base[1] * 10000) / 10000]);
        nextCurr.push([Math.round(sample.curr[0] * 10000) / 10000, Math.round(sample.curr[1] * 10000) / 10000]);
      }
    }
    cw.cols = cols;
    cw.rows = rows;
    cw.basePts = nextBase;
    cw.currPts = nextCurr;
    updateCornerWarpQuad(L);
    return cw;
  }

  function analyzeLayerCorners(L, opts) {
    const o = opts || {};
    const cols = Math.min(8, Math.max(2, o.cols || (L && L.cornerWarp && L.cornerWarp.cols) || 4));
    const rows = Math.min(8, Math.max(2, o.rows || (L && L.cornerWarp && L.cornerWarp.rows) || 4));
    const prevMode = L && L.cornerWarp && L.cornerWarp.mode !== undefined ? L.cornerWarp.mode : 1;
    const prevBrush = L && L.cornerWarp && L.cornerWarp.brushRadius !== undefined ? L.cornerWarp.brushRadius : 0.35;

    let uMin = -0.94, uMax = 0.94, vMin = -0.94, vMax = 0.94;
    let rowSpans = null;

    if (L && !o.fullFrame) {
      const mm = S.media.get(srcUri(L));
      const srcEl = mm ? mm.el : null;
      const sw = mm ? (mm.kind === 'image' ? mm.w : (srcEl && srcEl.videoWidth) || 0) : 0;
      const sh = mm ? (mm.kind === 'image' ? mm.h : (srcEl && srcEl.videoHeight) || 0) : 0;
      if (srcEl && sw > 0 && sh > 0) {
        try {
          const maxSide = 140;
          const sc = Math.min(1, maxSide / Math.max(sw, sh));
          const cw = Math.max(16, Math.round(sw * sc));
          const ch = Math.max(16, Math.round(sh * sc));
          const tmp = document.createElement('canvas');
          tmp.width = cw;
          tmp.height = ch;
          const c2 = tmp.getContext('2d');
          const cr = L.cropRegion || { x0: 0, y0: 0, x1: 1, y1: 1 };
          c2.drawImage(
            srcEl,
            cr.x0 * sw, cr.y0 * sh, Math.max(1, (cr.x1 - cr.x0) * sw), Math.max(1, (cr.y1 - cr.y0) * sh),
            0, 0, cw, ch
          );
          const img = c2.getImageData(0, 0, cw, ch).data;
          const total = cw * ch;

          let transparentCount = 0;
          let bgR = 0, bgG = 0, bgB = 0, edgeN = 0;
          for (let y = 0; y < ch; y++) {
            for (let x = 0; x < cw; x++) {
              const idx = (y * cw + x) * 4;
              if (img[idx + 3] < 220) transparentCount++;
              if (x < 2 || x >= cw - 2 || y < 2 || y >= ch - 2) {
                bgR += img[idx]; bgG += img[idx + 1]; bgB += img[idx + 2]; edgeN++;
              }
            }
          }
          bgR /= Math.max(1, edgeN);
          bgG /= Math.max(1, edgeN);
          bgB /= Math.max(1, edgeN);
          const useAlpha = transparentCount > total * 0.04;

          const fg = [];
          for (let y = 0; y < ch; y++) {
            for (let x = 0; x < cw; x++) {
              const idx = (y * cw + x) * 4;
              const r = img[idx], g = img[idx + 1], b = img[idx + 2], a = img[idx + 3];
              const isFg = useAlpha
                ? a > 36
                : a > 36 && Math.hypot(r - bgR, g - bgG, b - bgB) > 38;
              if (isFg) {
                fg.push([((x + 0.5) / cw) * 2 - 1, ((y + 0.5) / ch) * 2 - 1]);
              }
            }
          }

          if (fg.length > Math.max(12, total * 0.015)) {
            let minX = 1, maxX = -1, minY = 1, maxY = -1;
            for (const pt of fg) {
              if (pt[0] < minX) minX = pt[0];
              if (pt[0] > maxX) maxX = pt[0];
              if (pt[1] < minY) minY = pt[1];
              if (pt[1] > maxY) maxY = pt[1];
            }
            if ((maxX - minX) > 0.12 && (maxY - minY) > 0.12) {
              const pad = 0.035;
              uMin = Math.max(-1, minX - pad);
              uMax = Math.min(1, maxX + pad);
              vMin = Math.max(-1, minY - pad);
              vMax = Math.min(1, maxY + pad);

              if (o.fitContour !== false) {
                rowSpans = [];
                const bandHalf = ((vMax - vMin) / Math.max(1, rows - 1)) * 0.65;
                for (let r = 0; r < rows; r++) {
                  const vy = vMin + (r / (rows - 1)) * (vMax - vMin);
                  let rMin = 1, rMax = -1, cnt = 0;
                  for (const pt of fg) {
                    if (Math.abs(pt[1] - vy) <= bandHalf) {
                      if (pt[0] < rMin) rMin = pt[0];
                      if (pt[0] > rMax) rMax = pt[0];
                      cnt++;
                    }
                  }
                  if (cnt >= 3 && (rMax - rMin) > 0.08) {
                    const lo = Math.max(-1, rMin - pad);
                    const hi = Math.min(1, rMax + pad);
                    // Смешиваем локальный контур с общим габаритом, чтобы ячейки оставались гладкими
                    rowSpans.push([
                      lo * 0.65 + uMin * 0.35,
                      hi * 0.65 + uMax * 0.35,
                    ]);
                  } else {
                    rowSpans.push([uMin, uMax]);
                  }
                }
              }
            }
          }
        } catch (_) {}
      }
    }

    const basePts = [];
    const currPts = [];
    for (let r = 0; r < rows; r++) {
      const v = Math.round((vMin + (r / (rows - 1)) * (vMax - vMin)) * 10000) / 10000;
      const [rowU0, rowU1] = rowSpans ? rowSpans[r] : [uMin, uMax];
      for (let c = 0; c < cols; c++) {
        const u = Math.round((rowU0 + (c / (cols - 1)) * (rowU1 - rowU0)) * 10000) / 10000;
        basePts.push([u, v]);
        currPts.push([u, v]);
      }
    }

    if (!L) return { cols, rows, mode: prevMode, brushRadius: prevBrush, basePts, currPts, delta: 0 };
    L.cornerWarp = {
      cols,
      rows,
      mode: prevMode,
      brushRadius: prevBrush,
      basePts,
      currPts,
      delta: 0,
    };
    updateCornerWarpQuad(L);
    return L.cornerWarp;
  }

  function localToWorldInBox(locUv, box) {
    const lx = locUv[0] * box.hx;
    const ly = locUv[1] * box.hy;
    const cs = Math.cos(box.rot), sn = Math.sin(box.rot);
    return [
      box.center[0] + (lx * cs - ly * sn),
      box.center[1] + (lx * sn + ly * cs),
    ];
  }

  function worldToLocalInBox(pt, box) {
    const dx = pt[0] - box.center[0], dy = pt[1] - box.center[1];
    const cs = Math.cos(-box.rot), sn = Math.sin(-box.rot);
    const lx = dx * cs - dy * sn;
    const ly = dx * sn + dy * cs;
    return [lx / Math.max(1, box.hx), ly / Math.max(1, box.hy)];
  }

  function getMeshHandlesWorld(L, box) {
    const cw = ensureLayerMeshWarp(L);
    return cw.currPts.map((uv) => localToWorldInBox(uv, box));
  }

  function pointInLayerBox(pt, box) {
    const dx = pt[0] - box.center[0], dy = pt[1] - box.center[1];
    const cs = Math.cos(-box.rot), sn = Math.sin(-box.rot);
    const lx = dx * cs - dy * sn;
    const ly = dx * sn + dy * cs;
    return { lx, ly, inside: Math.abs(lx) <= box.hx && Math.abs(ly) <= box.hy };
  }

  function detectWarpHandleHit(pt, L, box) {
    const cw = ensureLayerMeshWarp(L);
    const handles = getMeshHandlesWorld(L, box);
    const hitRad = Math.max(18, Math.min(34, Math.min(canvas.width, canvas.height) * 0.024));
    let best = null, bestD = hitRad;
    for (let idx = 0; idx < handles.length; idx++) {
      const d = Math.hypot(pt[0] - handles[idx][0], pt[1] - handles[idx][1]);
      if (d <= bestD) {
        bestD = d;
        best = {
          idx,
          r: Math.floor(idx / cw.cols),
          c: idx % cw.cols,
          pt: handles[idx],
        };
      }
    }
    return best;
  }

  function hitTestWarpCell(pt, L, box) {
    const cw = ensureLayerMeshWarp(L);
    const loc = worldToLocalInBox(pt, box);
    const cols = cw.cols, rows = cw.rows;
    for (let cj = 0; cj < rows - 1; cj++) {
      for (let ci = 0; ci < cols - 1; ci++) {
        const i00 = cj * cols + ci;
        const i10 = i00 + 1;
        const i01 = i00 + cols;
        const i11 = i01 + 1;
        const [u, v] = invBilinear2D(loc, cw.currPts[i00], cw.currPts[i10], cw.currPts[i01], cw.currPts[i11]);
        if (u >= -0.02 && u <= 1.02 && v >= -0.02 && v <= 1.02) {
          return { ci, cj, indices: [i00, i10, i01, i11] };
        }
      }
    }
    return null;
  }

  function hitTestVisualLayer(pt) {
    if (!S.scene) return null;
    for (let i = S.scene.layers.length - 1; i >= 0; i--) {
      const L = S.scene.layers[i];
      if (L.hidden || L.fillType !== 'media') continue;
      if (!(S.t >= L.start && S.t < L.end + 1)) continue;
      const lt = L.end > L.start ? (S.t - L.start) / (L.end - L.start) : 0;
      const box = getLayerVisualBox(L, lt);
      if (L.cornerWarp && Array.isArray(L.cornerWarp.currPts)) {
        if (hitTestWarpCell(pt, L, box)) return L;
      } else if (pointInLayerBox(pt, box).inside) {
        return L;
      }
    }
    return null;
  }

  canvas.addEventListener('pointermove', (e) => {
    if (!S.scene || canvas.classList.contains('grabbing') || canvas.classList.contains('rotating')) return;
    if (S.stageTool === 'crop') {
      canvas.style.cursor = '';
      return;
    }
    const L = layerById(S.selId);
    if (!L || L.hidden || L.fillType !== 'media' || !(S.t >= L.start && S.t < L.end + 1)) {
      canvas.style.cursor = 'grab';
      return;
    }
    const lt = L.end > L.start ? (S.t - L.start) / (L.end - L.start) : 0;
    const pt = scenePointFromEvent(e);
    const box = getLayerVisualBox(L, lt);
    if (S.stageTool === 'corner') {
      const hHit = detectWarpHandleHit(pt, L, box);
      const nextHover = hHit ? hHit.idx : -1;
      if (nextHover !== S.warpHoverIdx) {
        S.warpHoverIdx = nextHover;
        syncStageOverlay();
      }
      if (hHit) {
        canvas.style.cursor = 'move';
      } else if (hitTestWarpCell(pt, L, box)) {
        canvas.style.cursor = 'grab';
      } else {
        canvas.style.cursor = 'crosshair';
      }
    } else if (pointInLayerBox(pt, box).inside) {
      canvas.style.cursor = 'grab';
    } else {
      canvas.style.cursor = 'default';
    }
  });

  canvas.addEventListener('pointerdown', (e) => {
    if (!S.scene || e.button !== 0) return;
    const p0 = scenePointFromEvent(e);
    if (S.pickColorCb) {
      e.preventDefault();
      e.stopPropagation();
      const cb = S.pickColorCb;
      S.pickColorCb = null;
      canvas.style.cursor = 'grab';
      const px = Math.max(0, Math.min(canvas.width - 1, Math.round(p0[0])));
      const py = Math.max(0, Math.min(canvas.height - 1, Math.round(p0[1])));
      if (S.renderer && S.renderer.render) {
        const disabledCk = [];
        for (const L of S.scene.layers) {
          for (const fx of (L.effects || [])) {
            if (!fx.off && fx.id && fx.id.endsWith('.chromakey')) {
              fx.off = true;
              disabledCk.push(fx);
            }
          }
        }
        const { draws } = buildDraws(S.scene, S.t);
        for (const fx of disabledCk) fx.off = false;
        S.renderer.render(draws, S.scene.bgcolor, true).then((shot) => {
          if (shot && shot.data) {
            const idx = (py * shot.w + px) * 4;
            cb([shot.data[idx], shot.data[idx + 1], shot.data[idx + 2]]);
          }
          S.lastSig = '';
        });
      }
      return;
    }
    let target = layerById(S.selId);
    const activeSelected = target && !target.hidden && target.fillType === 'media' && S.t >= target.start && S.t < target.end + 1;

    if (S.stageTool === 'crop' && activeSelected) {
      e.preventDefault();
      const ltCrop = target.end > target.start ? (S.t - target.start) / (target.end - target.start) : 0;
      const boxCrop = getLayerVisualBox(target, ltCrop, true);
      const local0 = pointInLayerBox(p0, boxCrop);
      const u0 = Math.max(0, Math.min(1, (local0.lx / Math.max(1, boxCrop.hx) + 1) * 0.5));
      const v0 = Math.max(0, Math.min(1, (local0.ly / Math.max(1, boxCrop.hy) + 1) * 0.5));
      syncStageOverlay();
      const marquee = $('active-crop-marquee');
      const marqueeTag = marquee ? marquee.querySelector('.stage-crop-tag') : null;

      const calcUvRect = (ev) => {
        const pCur = scenePointFromEvent(ev);
        const locCur = pointInLayerBox(pCur, boxCrop);
        let u1 = Math.max(0, Math.min(1, (locCur.lx / Math.max(1, boxCrop.hx) + 1) * 0.5));
        let v1 = Math.max(0, Math.min(1, (locCur.ly / Math.max(1, boxCrop.hy) + 1) * 0.5));
        if (ev.shiftKey) {
          const fullW = boxCrop.hx * 2;
          const fullH = boxCrop.hy * 2;
          const dxPx = (u1 - u0) * fullW;
          const dyPx = (v1 - v0) * fullH;
          const sidePx = Math.max(Math.abs(dxPx), Math.abs(dyPx));
          u1 = Math.max(0, Math.min(1, u0 + (Math.sign(dxPx || 1) * sidePx) / Math.max(1, fullW)));
          v1 = Math.max(0, Math.min(1, v0 + (Math.sign(dyPx || 1) * sidePx) / Math.max(1, fullH)));
        }
        return {
          x0: Math.round(Math.min(u0, u1) * 10000) / 10000,
          x1: Math.round(Math.max(u0, u1) * 10000) / 10000,
          y0: Math.round(Math.min(v0, v1) * 10000) / 10000,
          y1: Math.round(Math.max(v0, v1) * 10000) / 10000,
        };
      };

      const moveCrop = (ev) => {
        const reg = calcUvRect(ev);
        if (marquee) {
          marquee.style.left = (reg.x0 * 100) + '%';
          marquee.style.top = (reg.y0 * 100) + '%';
          marquee.style.width = ((reg.x1 - reg.x0) * 100) + '%';
          marquee.style.height = ((reg.y1 - reg.y0) * 100) + '%';
        }
        if (marqueeTag) {
          const wPx = Math.round((reg.x1 - reg.x0) * boxCrop.hx * 2);
          const hPx = Math.round((reg.y1 - reg.y0) * boxCrop.hy * 2);
          marqueeTag.textContent = `${wPx}×${hPx} px (${Math.round((reg.x1 - reg.x0) * 100)}% × ${Math.round((reg.y1 - reg.y0) * 100)}%)`;
        }
      };
      const upCrop = (ev) => {
        window.removeEventListener('pointermove', moveCrop);
        window.removeEventListener('pointerup', upCrop);
        const reg = calcUvRect(ev);
        if (reg.x1 - reg.x0 > 0.025 && reg.y1 - reg.y0 > 0.025) {
          target.cropRegion = reg;
          setLayerPropValue(target, 'transform', 'pivot', 'vec2', [0, 1], ltCrop);
          S.stageTool = 'move';
          S.lastSig = '';
          syncStageOverlay();
          renderInspector(true);
          status('Область выделена ровно! Нажмите «Сбросить» во вкладке «Опора», чтобы вернуть целиком');
        } else {
          syncStageOverlay();
        }
      };
      window.addEventListener('pointermove', moveCrop);
      window.addEventListener('pointerup', upCrop);
      return;
    }

    let warpAction = null;

    if (activeSelected && S.stageTool === 'corner') {
      ensureLayerMeshWarp(target);
      const ltSel = target.end > target.start ? (S.t - target.start) / (target.end - target.start) : 0;
      const selBox = getLayerVisualBox(target, ltSel);
      const hHit = detectWarpHandleHit(p0, target, selBox);
      if (hHit) {
        warpAction = { type: 'point', hit: hHit };
      } else {
        const cellHit = hitTestWarpCell(p0, target, selBox);
        if (cellHit) {
          warpAction = { type: 'cell', cell: cellHit };
        }
      }
    }

    if (!warpAction) {
      if (!activeSelected) {
        target = hitTestVisualLayer(p0);
        if (target) selectLayer(target.id, false, e);
      } else {
        const hitOther = hitTestVisualLayer(p0);
        if (hitOther && hitOther.id !== target.id && !e.altKey) {
          target = hitOther;
          selectLayer(target.id, false, e);
        }
      }
    }
    if (!target || target.fillType !== 'media') return;
    e.preventDefault();
    const lt = target.end > target.start ? (S.t - target.start) / (target.end - target.start) : 0;
    const box0 = getLayerVisualBox(target, lt);
    const startLoc = box0.loc.slice();

    if (warpAction) {
      const cw = ensureLayerMeshWarp(target);
      const cols = cw.cols, rows = cw.rows;
      const startPts = cw.currPts.map((pt) => pt.slice());
      const startMouseUv = worldToLocalInBox(p0, box0);
      const weights = new Float32Array(startPts.length);

      if (warpAction.type === 'point') {
        const idx = warpAction.hit.idx;
        if (e.ctrlKey || e.metaKey) {
          if (S.warpSelPts.has(idx)) S.warpSelPts.delete(idx);
          else S.warpSelPts.add(idx);
        } else if (!S.warpSelPts.has(idx)) {
          S.warpSelPts.clear();
          S.warpSelPts.add(idx);
        }
        const activeIndices = S.warpSelPts.size ? [...S.warpSelPts] : [idx];
        const brushR = cw.brushRadius || 0;
        for (const aIdx of activeIndices) {
          weights[aIdx] = 1;
          if (brushR > 0.01) {
            const pA = startPts[aIdx];
            const sigma = brushR * 0.72;
            const maxD = brushR * 1.65;
            for (let k = 0; k < startPts.length; k++) {
              const d = Math.hypot(startPts[k][0] - pA[0], startPts[k][1] - pA[1]);
              if (d <= maxD) {
                const w = Math.exp(-(d * d) / (2 * sigma * sigma));
                if (w > weights[k]) weights[k] = w;
              }
            }
          }
        }
      } else if (warpAction.type === 'cell') {
        S.warpSelPts.clear();
        for (const cIdx of warpAction.cell.indices) {
          weights[cIdx] = 1;
        }
      }

      canvas.style.cursor = 'move';
      syncStageOverlay();

      const moveWarp = (ev) => {
        const p1 = scenePointFromEvent(ev);
        const uv1 = worldToLocalInBox(p1, box0);
        let du = uv1[0] - startMouseUv[0];
        let dv = uv1[1] - startMouseUv[1];
        if (ev.shiftKey) {
          if (Math.abs(du * box0.hx) > Math.abs(dv * box0.hy)) dv = 0;
          else du = 0;
        }
        for (let k = 0; k < startPts.length; k++) {
          const w = weights[k];
          if (w > 0.001) {
            cw.currPts[k] = [
              Math.round((startPts[k][0] + du * w) * 10000) / 10000,
              Math.round((startPts[k][1] + dv * w) * 10000) / 10000,
            ];
          } else {
            cw.currPts[k] = startPts[k].slice();
          }
        }
        if (ev.altKey) {
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              const k = r * cols + c;
              const w = weights[k];
              if (w > 0.001) {
                const symC = cols - 1 - c;
                const symK = r * cols + symC;
                if (symK !== k && weights[symK] < w) {
                  cw.currPts[symK] = [
                    Math.round((startPts[symK][0] - du * w) * 10000) / 10000,
                    Math.round((startPts[symK][1] + dv * w) * 10000) / 10000,
                  ];
                }
              }
            }
          }
        }
        updateCornerWarpQuad(target);
        S.lastSig = '';
        syncStageOverlay();
        const label = warpAction.type === 'point'
          ? `Точка (${warpAction.hit.r + 1}, ${warpAction.hit.c + 1})`
          : `Ячейка (${warpAction.cell.cj + 1}, ${warpAction.cell.ci + 1})`;
        status(`Деформация · ${label}: растяг ${Math.round((cw.delta || 0) * 100)}% (Shift — ось, Alt — симметрия)`);
      };
      const upWarp = () => {
        canvas.style.cursor = 'crosshair';
        if (S.tab === 'pivot') renderInspector(true);
        window.removeEventListener('pointermove', moveWarp);
        window.removeEventListener('pointerup', upWarp);
      };
      window.addEventListener('pointermove', moveWarp);
      window.addEventListener('pointerup', upWarp);
      return;
    }

    canvas.classList.add('grabbing');

    const move = (ev) => {
      const p1 = scenePointFromEvent(ev);
      let nx = startLoc[0] + (p1[0] - p0[0]);
      let ny = startLoc[1] + (p1[1] - p0[1]);
      if (ev.shiftKey) {
        if (Math.abs(nx - startLoc[0]) > Math.abs(ny - startLoc[1])) ny = startLoc[1];
        else nx = startLoc[0];
      }
      const cx = S.scene.width / 2, cy = S.scene.height / 2;
      if (Math.abs(nx - cx) < 12) nx = cx;
      if (Math.abs(ny - cy) < 12) ny = cy;
      setLayerPropValue(target, 'transform', 'location', 'vec2', [Math.round(nx * 10) / 10, Math.round(ny * 10) / 10], lt);
    };
    const up = () => {
      canvas.classList.remove('grabbing');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  });

  canvas.addEventListener('wheel', (e) => {
    if (!S.scene || !S.selId) return;
    const L = layerById(S.selId);
    if (!L || L.fillType !== 'media') return;
    e.preventDefault();
    const lt = L.end > L.start ? (S.t - L.start) / (L.end - L.start) : 0;
    const sc = asVec(VM.evalProp(VM.getProp(L.transform, 'scale'), lt), [1, 1]);
    const factor = e.deltaY < 0 ? 1.05 : 1 / 1.05;
    const next = [Math.round(sc[0] * factor * 1000) / 1000, Math.round(sc[1] * factor * 1000) / 1000];
    setLayerPropValue(L, 'transform', 'scale', 'vec2', next, lt);
  }, { passive: false });

  function frameSignature(draws) {
    const parts = draws.map((d) => {
      const v = d.video;
      const vs = v ? (v.currentTime !== undefined ? [v.currentTime, v.seeking, v.readyState] : 1) : 0;
      return [d.center, d.extent, d.rot, d.uvScale, d.uvOffset, d.color, d.fx, vs];
    });
    return JSON.stringify([parts, S.scene.bgcolor, canvas.width, canvas.height, canvas.clientWidth, S.frameEpoch || 0]);
  }

  function frame(now) {
    if (S.scene && !S.exporting) {
      if (S.playing) {
        const dt = Math.min(100, Math.max(0, now - S.last));
        S.t += dt;
        if (S.t >= S.scene.totalTime) {
          if (S.loop) {
            S.t = 0;
            S.forceSeek = true;
          } else {
            S.t = S.scene.totalTime;
            setPlaying(false);
          }
        }
      }
      syncMedia(S.scene);
      const { draws } = buildDraws(S.scene, S.t);
      if (S.renderer) {
        // на паузе перерисовываем только если картинка реально изменилась (иначе GPU зря молотит эффекты)
        const sig = frameSignature(draws);
        if (S.playing || sig !== S.lastSig) {
          S.lastSig = sig;
          S.renderer.render(draws, S.scene.bgcolor);
        }
      }
      updateUI();
      S.tl.update(S.playing);
    }
    S.last = now;
    requestAnimationFrame(frame);
  }

  // ---------- настройки интерфейса ----------
  const modal = $('settings-modal');
  $('btn-settings').addEventListener('click', () => { modal.hidden = false; });
  $('set-close').addEventListener('click', () => { modal.hidden = true; });
  window.addEventListener('keydown', (e) => { if (e.code === 'Escape' && !modal.hidden) modal.hidden = true; });

  $('set-theme').addEventListener('change', (e) => {
    document.documentElement.dataset.theme = e.target.value;
    try { localStorage.setItem('vm_theme', e.target.value); } catch (_) {}
  });
  $('set-lang').value = window.vmI18n.getLang();
  $('set-lang').addEventListener('change', (e) => window.vmI18n.setLang(e.target.value));
  window.addEventListener('vm-lang', () => { try { updateAudioBtn(); } catch (_) {} });
  $('set-loop').addEventListener('change', (e) => { S.loop = e.target.checked; });
  $('set-checker').addEventListener('change', (e) => {
    document.querySelector('.stage-frame').classList.toggle('checker', e.target.checked);
  });
  $('set-hints').addEventListener('change', (e) => {
    $('tl-keys').style.display = e.target.checked ? '' : 'none';
  });
  $('set-autosave').addEventListener('change', (e) => {
    S.autosaveMs = Number(e.target.value) || 0;
    try { localStorage.setItem('vm_autosave_ms', String(S.autosaveMs)); } catch (_) {}
    restartAutosaveTimer();
  });
  try {
    const savedTheme = localStorage.getItem('vm_theme');
    if (savedTheme === 'light' || savedTheme === 'dark') {
      document.documentElement.dataset.theme = savedTheme;
      $('set-theme').value = savedTheme;
    }
    const savedAuto = localStorage.getItem('vm_autosave_ms');
    if (savedAuto !== null && !Number.isNaN(Number(savedAuto))) {
      S.autosaveMs = Number(savedAuto);
      $('set-autosave').value = String(S.autosaveMs);
    }
  } catch (_) {}

  // ---------- главный экран проектов ----------
  function formatRelDate(ts) {
    const diff = Math.max(0, Date.now() - ts);
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'только что';
    if (min < 60) return min + ' мин назад';
    const hr = Math.floor(min / 60);
    if (hr < 24) return hr + ' ч назад';
    return new Date(ts).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
  }

  function createProjectCard(p, idx) {
    const card = el('article', 'proj-card' + (p.id === S.projectId ? ' active' : '') + (p.isXml ? ' is-xml' : ''));
    card.style.animationDelay = Math.min(idx * 35, 280) + 'ms';

    const thumb = el('div', 'proj-thumb');
    if (p.thumb) {
      const img = document.createElement('img');
      img.src = p.thumb;
      img.alt = p.title;
      thumb.append(img);
    } else {
      const fb = el('div', 'proj-thumb-fallback');
      fb.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
      fb.append(el('span', '', p.width + '×' + p.height));
      thumb.append(fb);
    }
    thumb.append(el('span', 'proj-aspect-tag', p.width + '×' + p.height + ' · ' + p.fps + 'fps'));
    if (p.isXml) {
      const xmlTag = el('span', 'proj-xml-tag', 'XML');
      if (p.id === S.projectId) xmlTag.style.right = '68px';
      thumb.append(xmlTag);
    }
    if (p.id === S.projectId) thumb.append(el('span', 'proj-active-tag', 'Открыт'));

    const body = el('div', 'proj-body');
    const topRow = el('div', 'proj-top-row');
    const titleEl = el('div', 'proj-title', p.title);
    titleEl.title = p.title;
    topRow.append(titleEl);

    const durSec = ((p.totalTime || 0) / 1000).toFixed(1) + ' с';
    const meta = el('div', 'proj-meta', durSec + ' · слоёв: ' + p.layersCount + ' · медиа: ' + p.mediaCount);

    const foot = el('div', 'proj-foot');
    foot.append(el('span', 'proj-date', 'Обновлён ' + formatRelDate(p.updatedAt)));

    const acts = el('div', 'proj-actions');
    const renBtn = el('button', 'mini');
    renBtn.title = 'Переименовать';
    renBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
    renBtn.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      const nextName = await window.vmI18n.ask('Новое название проекта:', p.title);
      if (nextName === null) return;
      await VM.Projects.rename(p.id, nextName);
      if (S.projectId === p.id && S.scene) {
        S.scene.title = nextName.trim() || 'Без названия';
        $('projname').textContent = S.scene.title;
      }
      renderProjectsHome();
    });

    const dupBtn = el('button', 'mini');
    dupBtn.title = 'Дублировать проект';
    dupBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
    dupBtn.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      await VM.Projects.duplicate(p.id);
      renderProjectsHome();
    });

    const delBtn = el('button', 'mini danger');
    delBtn.title = 'Удалить проект';
    delBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>';
    delBtn.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      if (!confirm('Удалить проект «' + p.title + '»?')) return;
      await VM.Projects.remove(p.id);
      if (S.projectId === p.id) S.projectId = null;
      renderProjectsHome();
    });

    acts.append(renBtn, dupBtn, delBtn);
    foot.append(acts);
    body.append(topRow, meta, foot);
    card.append(thumb, body);

    card.addEventListener('click', async () => {
      if (p.id === S.projectId && S.scene) {
        showEditorScreen();
        return;
      }
      const full = await VM.Projects.get(p.id);
      if (full) await openProjectRecord(full);
    });
    return card;
  }

  async function renderProjectsHome() {
    if (!VM.Projects) return;
    const grid = $('home-grid');
    const emptyBox = $('home-empty');
    const q = ($('home-search').value || '').trim().toLowerCase();
    const list = await VM.Projects.list();
    const regularAll = list.filter((p) => !p.isXml);
    const xmlAll = list.filter((p) => p.isXml);

    const secBar = grid.parentElement ? grid.parentElement.querySelector('.home-sec-bar') : null;
    if (secBar) {
      let tabsBar = $('home-type-tabs');
      if (!tabsBar) {
        tabsBar = el('div', 'home-type-tabs');
        tabsBar.id = 'home-type-tabs';
        secBar.append(tabsBar);
      }
      tabsBar.textContent = '';
      const defs = [
        ['all', 'Все', list.length],
        ['regular', 'Обычные', regularAll.length],
        ['xml', 'XML-проекты', xmlAll.length],
      ];
      for (const [fid, flabel, fcnt] of defs) {
        const tb = el('button', 'home-type-tab' + (S.homeFilter === fid ? ' on' : ''));
        tb.append(document.createTextNode(flabel + ' '), el('span', 'tab-cnt', String(fcnt)));
        tb.addEventListener('click', () => {
          S.homeFilter = fid;
          renderProjectsHome();
        });
        tabsBar.append(tb);
      }
    }

    const filtered = list.filter((p) => {
      if (S.homeFilter === 'regular' && p.isXml) return false;
      if (S.homeFilter === 'xml' && !p.isXml) return false;
      if (q && !(p.title || '').toLowerCase().includes(q)) return false;
      return true;
    });

    $('home-count').textContent = String(list.length);
    grid.textContent = '';
    emptyBox.hidden = filtered.length > 0;
    if (!filtered.length) {
      emptyBox.querySelector('b').textContent = list.length
        ? (S.homeFilter === 'xml' ? 'XML-проектов пока нет' : 'Ничего не найдено')
        : 'Проектов пока нет';
      return;
    }

    const regularList = filtered.filter((p) => !p.isXml);
    const xmlList = filtered.filter((p) => p.isXml);

    if (S.homeFilter === 'all' && regularList.length > 0 && xmlList.length > 0) {
      grid.classList.add('split-sections');

      const regSec = el('section', 'home-proj-group');
      const regHead = el('div', 'home-group-head');
      regHead.append(el('span', 'home-group-title', 'Обычные проекты'), el('span', 'home-badge', String(regularList.length)));
      const regGrid = el('div', 'projects-grid');
      regularList.forEach((p, idx) => regGrid.append(createProjectCard(p, idx)));
      regSec.append(regHead, regGrid);

      const xmlSec = el('section', 'home-proj-group');
      const xmlHead = el('div', 'home-group-head');
      xmlHead.append(el('span', 'home-group-title', 'XML-проекты (Alight Motion)'), el('span', 'home-badge xml', String(xmlList.length)));
      const xmlGrid = el('div', 'projects-grid');
      xmlList.forEach((p, idx) => xmlGrid.append(createProjectCard(p, idx)));
      xmlSec.append(xmlHead, xmlGrid);

      grid.append(regSec, xmlSec);
    } else {
      grid.classList.remove('split-sections');
      filtered.forEach((p, idx) => grid.append(createProjectCard(p, idx)));
    }
  }

  $('home-create-btn').addEventListener('click', () => {
    const title = $('new-proj-title').value;
    const raw = $('new-proj-preset').value || '1080x1920@60';
    const [wh, fpsStr] = raw.split('@');
    const [w, h] = wh.split('x').map(Number);
    $('new-proj-title').value = '';
    createAndOpenNewProject({ title, width: w || 1080, height: h || 1920, fps: Number(fpsStr) || 60 });
  });
  $('new-proj-title').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('home-create-btn').click();
  });
  $('home-xmlfile').addEventListener('change', async (ev) => {
    const f = ev.target.files[0];
    if (!f) return;
    try {
      await importXmlFileToNewProject(f);
    } catch (e) {
      alert('Ошибка чтения XML: ' + e.message);
    }
    ev.target.value = '';
  });
  $('home-search').addEventListener('input', () => renderProjectsHome());
  $('home-settings-btn').addEventListener('click', () => { modal.hidden = false; });
  $('btn-home').addEventListener('click', () => showHomeScreen());
  $('btn-save-now').addEventListener('click', () => saveCurrentProject(false));
  $('projname').addEventListener('click', async () => {
    if (!S.scene) return;
    const nextName = await window.vmI18n.ask('Название проекта:', S.scene.title || '');
    if (nextName === null) return;
    S.scene.title = nextName.trim() || 'Без названия';
    $('projname').textContent = S.scene.title;
    await saveCurrentProject(false);
  });
  window.addEventListener('beforeunload', () => {
    if (S.scene && !$('app').hidden) saveCurrentProject(true);
  });

  S.fxui = VM.FxUI.create({
    getLayer: () => layerById(S.selId),
    getLt: () => {
      const L = layerById(S.selId);
      return L && L.end > L.start ? Math.max(0, Math.min(1, (S.t - L.start) / (L.end - L.start))) : 0;
    },
    rerender: () => { S.lastSig = ''; renderInspector(true); },
    pickColor: (onRgb) => {
      if (window.EyeDropper) {
        new window.EyeDropper().open().then((res) => {
          const hex = (res && res.sRGBHex || '').replace('#', '');
          if (hex.length === 6) {
            onRgb([parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)]);
          }
        }).catch(() => {});
        return;
      }
      S.pickColorCb = (rgb) => {
        onRgb(rgb);
        status(`Цвет выбран: rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`);
      };
      canvas.style.cursor = 'crosshair';
      status('Пипетка: кликните по нужному цвету на сцене (Esc — отмена)');
    },
    onTargetProp: (fx, p, pm) => {
      const L = layerById(S.selId);
      if (L && p) {
        S.activeKeyTarget = {
          layerId: L.id,
          propName: p.name,
          label: VM.Effects.title(fx.id) + ' · ' + (pm ? pm.label : p.name),
          propRef: p,
        };
      }
    },
    copyEffects,
    pasteEffects,
    clipboardCount: () => S.fxClipboard.length,
    selectedCount: () => S.selIds.size || (S.selId ? 1 : 0),
    loadEffectsToClipboard: (effects, label) => {
      S.fxClipboard = cloneEffects(effects);
      status(`Пресет «${label}» (${S.fxClipboard.length} эф.) скопирован в буфер — нажмите Ctrl+Shift+V на нужном слое`);
      renderInspector(true);
    },
    applyEffectsList: (effects, label) => {
      const targets = S.selIds.size ? [...S.selIds] : (S.selId ? [S.selId] : []);
      if (!targets.length) {
        status('Сначала выберите слой для применения пресета', true);
        return false;
      }
      let applied = 0;
      for (const id of targets) {
        const L = layerById(id);
        if (!L || L.fillType === 'audio') continue;
        L.effects.push(...cloneEffects(effects));
        applied++;
      }
      if (!applied) {
        status('Выберите видео или фото слой для применения эффектов', true);
        return false;
      }
      S.tab = 'fx';
      S.lastSig = '';
      renderInspector(true);
      status(`Пресет «${label}» применён на слоёв: ${applied}`);
      return true;
    },
  });

  // ---------- экспорт видео ----------
  function ensureVideoReadyForExport(elNode, timeoutMs) {
    return new Promise((resolve) => {
      if (!elNode) { resolve(false); return; }
      if (elNode.readyState >= 2 && elNode.videoWidth > 0) { resolve(true); return; }
      let done = false;
      const finish = (ok) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        elNode.removeEventListener('loadeddata', onOk);
        elNode.removeEventListener('canplay', onOk);
        elNode.removeEventListener('error', onErr);
        resolve(ok);
      };
      const onOk = () => finish(elNode.videoWidth > 0);
      const onErr = () => finish(false);
      const timer = setTimeout(() => finish(elNode.readyState >= 2 && elNode.videoWidth > 0), timeoutMs || 2500);
      elNode.addEventListener('loadeddata', onOk, { once: true });
      elNode.addEventListener('canplay', onOk, { once: true });
      elNode.addEventListener('error', onErr, { once: true });
      if (elNode.readyState === 0) {
        try { elNode.load(); } catch (_) { finish(false); }
      }
    });
  }

  // Перематывает <video> на точное время и дожидается, пока НОВЫЙ кадр реально дойдёт до композитора.
  // Одного 'seeked' мало: importExternalTexture может ещё отдать предыдущий кадр (без всяких ошибок).
  function seekMediaElementExact(elNode, targetSec, timeoutMs) {
    return new Promise((resolve) => {
      if (!elNode || !isFinite(targetSec)) { resolve(); return; }
      const dur = isFinite(elNode.duration) && elNode.duration > 0 ? elNode.duration : targetSec + 1;
      const clamped = Math.max(0, Math.min(Math.max(0, dur - 0.002), targetSec));
      if (Math.abs((elNode.currentTime || 0) - clamped) < 0.002 && elNode.readyState >= 2 && !elNode.seeking) {
        resolve();
        return;
      }
      const hasRvfc = elNode.tagName === 'VIDEO' && typeof elNode.requestVideoFrameCallback === 'function';
      let done = false;
      let seeked = false;
      let presented = !hasRvfc;
      let graceTimer = 0;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        clearTimeout(graceTimer);
        elNode.removeEventListener('seeked', onSeeked);
        elNode.removeEventListener('error', finish);
        resolve();
      };
      const check = () => { if (seeked && presented) finish(); };
      const onSeeked = () => {
        if (elNode.readyState < 2) { setTimeout(finish, 16); return; }
        seeked = true;
        check();
        // если новый кадр совпал с прежним, rVFC не сработает — не ждём вечно
        if (!done) graceTimer = setTimeout(finish, 80);
      };
      const timer = setTimeout(finish, timeoutMs || 1500);
      elNode.addEventListener('seeked', onSeeked, { once: true });
      elNode.addEventListener('error', finish, { once: true });
      if (hasRvfc) {
        // колбэк регистрируем ДО перемотки, чтобы не пропустить кадр
        try { elNode.requestVideoFrameCallback(() => { presented = true; check(); }); } catch (_) { presented = true; }
      }
      try {
        elNode.currentTime = clamped;
      } catch (_) {
        finish();
      }
    });
  }

  async function pickWebCodecsH264Config(width, height, fps, bitrate) {
    if (typeof VideoEncoder === 'undefined' || !VideoEncoder.isConfigSupported) return null;
    const pxPerSec = width * height * fps;
    const levelHex = pxPerSec <= 921600 * 30 ? '1f'
      : pxPerSec <= 2073600 * 30 ? '28'
      : pxPerSec <= 2073600 * 60 ? '2a'
      : pxPerSec <= 8294400 * 30 ? '33'
      : '34';
    const codecs = [
      `avc1.6400${levelHex}`,
      `avc1.4d00${levelHex}`,
      `avc1.4200${levelHex}`,
      'avc1.64002a',
      'avc1.42002a',
      'avc1.42001f',
    ];
    for (const codec of codecs) {
      const cfg = {
        codec,
        width,
        height,
        bitrate,
        framerate: fps,
        avc: { format: 'avc' },
        latencyMode: 'quality',
      };
      try {
        const sup = await VideoEncoder.isConfigSupported(cfg);
        if (sup && sup.supported) return sup.config || cfg;
      } catch (_) {}
    }
    return null;
  }

  function buildMp4MuxedBlob({ width, height, fps, videoSamples, avcC, audioSamples, asc, audioSampleRate, audioChannels, audioBitrate }) {
    const u8 = (arr) => new Uint8Array(arr);
    const strBytes = (s) => {
      const b = new Uint8Array(s.length);
      for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
      return b;
    };
    const concatBytes = (parts) => {
      let total = 0;
      for (const p of parts) total += p.byteLength;
      const out = new Uint8Array(total);
      let off = 0;
      for (const p of parts) {
        out.set(p, off);
        off += p.byteLength;
      }
      return out;
    };
    const box = (type, ...children) => {
      const body = concatBytes(children);
      const out = new Uint8Array(8 + body.byteLength);
      const dv = new DataView(out.buffer);
      dv.setUint32(0, out.byteLength);
      out.set(strBytes(type), 4);
      out.set(body, 8);
      return out;
    };
    const fullBox = (type, version, flags, ...children) => {
      const vf = new Uint8Array(4);
      const dv = new DataView(vf.buffer);
      dv.setUint32(0, ((version & 0xff) << 24) | (flags & 0xffffff));
      return box(type, vf, ...children);
    };
    const u32Arr = (nums) => {
      const out = new Uint8Array(nums.length * 4);
      const dv = new DataView(out.buffer);
      for (let i = 0; i < nums.length; i++) dv.setUint32(i * 4, nums[i] >>> 0);
      return out;
    };
    const matrixBytes = () => u32Arr([0x00010000, 0, 0, 0, 0x00010000, 0, 0, 0, 0x40000000]);

    const ftyp = box('ftyp', strBytes('isom'), u32Arr([0x00000200]), strBytes('isomiso2avc1mp41'));

    const mdatHeaderSize = 8;
    const mdatStartOffset = ftyp.byteLength + mdatHeaderSize;
    let mdatCursor = 0;
    const mdatParts = [];

    const vidOffsets = [];
    const vidSizes = [];
    const syncFrames = [];
    for (let i = 0; i < videoSamples.length; i++) {
      const s = videoSamples[i];
      vidOffsets.push(mdatStartOffset + mdatCursor);
      vidSizes.push(s.data.byteLength);
      if (s.key) syncFrames.push(i + 1);
      mdatParts.push(s.data);
      mdatCursor += s.data.byteLength;
    }

    const hasAudio = audioSamples && audioSamples.length > 0;
    const audOffsets = [];
    const audSizes = [];
    if (hasAudio) {
      for (let i = 0; i < audioSamples.length; i++) {
        const s = audioSamples[i];
        audOffsets.push(mdatStartOffset + mdatCursor);
        audSizes.push(s.data.byteLength);
        mdatParts.push(s.data);
        mdatCursor += s.data.byteLength;
      }
    }

    const mdat = box('mdat', ...mdatParts);

    const movieTimescale = 90000;
    const stepTicks = Math.max(1, Math.round(movieTimescale / Math.max(1, fps)));
    const vidDurationTicks = videoSamples.length * stepTicks;
    const audSampleRate = audioSampleRate || 44100;
    const audSamplesPerFrame = 1024;
    const audDurationSamples = hasAudio ? audioSamples.length * audSamplesPerFrame : 0;
    const audDurationMovieTicks = hasAudio ? Math.round((audDurationSamples / audSampleRate) * movieTimescale) : 0;
    const movieDuration = Math.max(vidDurationTicks, audDurationMovieTicks);

    const mvhdBuf = new Uint8Array(96);
    const mvhdDv = new DataView(mvhdBuf.buffer);
    mvhdDv.setUint32(0, 0); // creation_time
    mvhdDv.setUint32(4, 0); // modification_time
    mvhdDv.setUint32(8, movieTimescale);
    mvhdDv.setUint32(12, movieDuration);
    mvhdDv.setUint32(16, 0x00010000); // rate 1.0
    mvhdDv.setUint16(20, 0x0100); // volume 1.0
    mvhdBuf.set(matrixBytes(), 32);
    mvhdDv.setUint32(92, hasAudio ? 3 : 2); // next_track_ID
    const mvhd = fullBox('mvhd', 0, 0, mvhdBuf);

    // Video Track
    const tkhdVBuf = new Uint8Array(80);
    const tkhdVDv = new DataView(tkhdVBuf.buffer);
    tkhdVDv.setUint32(8, 1); // track_ID
    tkhdVDv.setUint32(16, vidDurationTicks);
    tkhdVBuf.set(matrixBytes(), 36);
    tkhdVDv.setUint32(72, (width & 0xffff) << 16);
    tkhdVDv.setUint32(76, (height & 0xffff) << 16);
    const tkhdV = fullBox('tkhd', 0, 0x000003, tkhdVBuf);

    const mdhdVBuf = new Uint8Array(20);
    const mdhdVDv = new DataView(mdhdVBuf.buffer);
    mdhdVDv.setUint32(8, movieTimescale);
    mdhdVDv.setUint32(12, vidDurationTicks);
    mdhdVDv.setUint16(16, 0x55c4); // 'und'
    const mdhdV = fullBox('mdhd', 0, 0, mdhdVBuf);

    const hdlrV = fullBox('hdlr', 0, 0, u32Arr([0]), strBytes('vide'), u32Arr([0, 0, 0]), strBytes('VideoHandler\0'));
    const vmhd = fullBox('vmhd', 0, 1, new Uint8Array(8));
    const urlBox = fullBox('url ', 0, 1);
    const dref = fullBox('dref', 0, 0, u32Arr([1]), urlBox);
    const dinf = box('dinf', dref);

    const avc1Hdr = new Uint8Array(78);
    const avc1Dv = new DataView(avc1Hdr.buffer);
    avc1Dv.setUint16(6, 1); // data_reference_index
    avc1Dv.setUint16(24, width);
    avc1Dv.setUint16(26, height);
    avc1Dv.setUint32(28, 0x00480000);
    avc1Dv.setUint32(32, 0x00480000);
    avc1Dv.setUint16(40, 1); // frame_count
    avc1Dv.setUint16(74, 0x0018); // depth 24
    avc1Dv.setInt16(76, -1);
    const avcCBox = box('avcC', avcC);
    const avc1 = box('avc1', avc1Hdr, avcCBox);
    const stsdV = fullBox('stsd', 0, 0, u32Arr([1]), avc1);

    const sttsV = fullBox('stts', 0, 0, u32Arr([1, videoSamples.length, stepTicks]));
    const stssV = fullBox('stss', 0, 0, u32Arr([syncFrames.length, ...syncFrames]));
    const stscV = fullBox('stsc', 0, 0, u32Arr([1, 1, 1, 1]));
    const stszV = fullBox('stsz', 0, 0, u32Arr([0, vidSizes.length, ...vidSizes]));
    const stcoV = fullBox('stco', 0, 0, u32Arr([vidOffsets.length, ...vidOffsets]));

    const stblV = box('stbl', stsdV, sttsV, stssV, stscV, stszV, stcoV);
    const minfV = box('minf', vmhd, dinf, stblV);
    const mdiaV = box('mdia', mdhdV, hdlrV, minfV);
    const trakV = box('trak', tkhdV, mdiaV);

    const tracks = [trakV];

    // Audio Track
    if (hasAudio) {
      const tkhdABuf = new Uint8Array(80);
      const tkhdADv = new DataView(tkhdABuf.buffer);
      tkhdADv.setUint32(8, 2); // track_ID
      tkhdADv.setUint32(16, audDurationMovieTicks);
      tkhdADv.setUint16(32, 0x0100); // volume 1.0
      tkhdABuf.set(matrixBytes(), 36);
      const tkhdA = fullBox('tkhd', 0, 0x000003, tkhdABuf);

      const mdhdABuf = new Uint8Array(20);
      const mdhdADv = new DataView(mdhdABuf.buffer);
      mdhdADv.setUint32(8, audSampleRate);
      mdhdADv.setUint32(12, audDurationSamples);
      mdhdADv.setUint16(16, 0x55c4);
      const mdhdA = fullBox('mdhd', 0, 0, mdhdABuf);

      const hdlrA = fullBox('hdlr', 0, 0, u32Arr([0]), strBytes('soun'), u32Arr([0, 0, 0]), strBytes('SoundHandler\0'));
      const smhd = fullBox('smhd', 0, 0, new Uint8Array(4));
      const dinfA = box('dinf', fullBox('dref', 0, 0, u32Arr([1]), fullBox('url ', 0, 1)));

      const mp4aHdr = new Uint8Array(28);
      const mp4aDv = new DataView(mp4aHdr.buffer);
      mp4aDv.setUint16(6, 1); // data_reference_index
      mp4aDv.setUint16(16, audioChannels || 2);
      mp4aDv.setUint16(18, 16); // sample size
      mp4aDv.setUint32(24, (audSampleRate & 0xffff) << 16);

      const ascBytes = asc && asc.byteLength ? asc : u8([0x12, 0x10]);
      const br = audioBitrate || 192000;
      const decSpec = u8([0x05, ascBytes.byteLength, ...ascBytes]);
      const decCfgHdr = new Uint8Array(15);
      const decCfgDv = new DataView(decCfgHdr.buffer);
      decCfgHdr[0] = 0x04;
      decCfgHdr[1] = 13 + decSpec.byteLength;
      decCfgHdr[2] = 0x40; // AAC
      decCfgHdr[3] = 0x15; // AudioStream
      decCfgDv.setUint32(7, br);
      decCfgDv.setUint32(11, br);
      const slCfg = u8([0x06, 0x01, 0x02]);
      const esBody = concatBytes([
        u8([0x00, 0x02, 0x00]),
        decCfgHdr,
        decSpec,
        slCfg,
      ]);
      const esds = fullBox('esds', 0, 0, u8([0x03, esBody.byteLength]), esBody);
      const mp4a = box('mp4a', mp4aHdr, esds);
      const stsdA = fullBox('stsd', 0, 0, u32Arr([1]), mp4a);

      const sttsA = fullBox('stts', 0, 0, u32Arr([1, audioSamples.length, audSamplesPerFrame]));
      const stscA = fullBox('stsc', 0, 0, u32Arr([1, 1, 1, 1]));
      const stszA = fullBox('stsz', 0, 0, u32Arr([0, audSizes.length, ...audSizes]));
      const stcoA = fullBox('stco', 0, 0, u32Arr([audOffsets.length, ...audOffsets]));

      const stblA = box('stbl', stsdA, sttsA, stscA, stszA, stcoA);
      const minfA = box('minf', smhd, dinfA, stblA);
      const mdiaA = box('mdia', mdhdA, hdlrA, minfA);
      const trakA = box('trak', tkhdA, mdiaA);
      tracks.push(trakA);
    }

    const moov = box('moov', mvhd, ...tracks);
    return new Blob([ftyp, mdat, moov], { type: 'video/mp4' });
  }

  let audioIssue = '';
  async function renderMixedProjectAudio(scene, durationMs) {
    audioIssue = '';
    const durSec = Math.max(0.05, durationMs / 1000);
    const sampleRate = 44100;
    const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OfflineCtx) { audioIssue = 'OfflineAudioContext недоступен'; return null; }
    if (S.masterMute || S.masterVol <= 0) { audioIssue = 'общий звук выключен (кнопка M / громкость 0)'; return null; }

    const audioLayers = (scene.layers || []).filter((L) => {
      if (L.hidden || L.muted) return false;
      if (L.fillType !== 'audio' && L.fillType !== 'media') return false;
      const m = S.media.get(srcUri(L));
      return m && (m.kind === 'audio' || m.kind === 'video') && m.url;
    });
    if (!audioLayers.length) { audioIssue = 'в проекте нет слоёв со звуком (или они скрыты / без звука)'; return null; }

    const decodedCache = new Map();
    const tmpCtx = new (window.AudioContext || window.webkitAudioContext)();
    try {
      for (const L of audioLayers) {
        const uri = srcUri(L);
        if (decodedCache.has(uri)) continue;
        const m = S.media.get(uri);
        try {
          const arr = (m.file && m.file.arrayBuffer)
            ? await m.file.arrayBuffer()
            : await (await fetch(m.url)).arrayBuffer();
          const buf = await tmpCtx.decodeAudioData(arr);
          decodedCache.set(uri, buf);
        } catch (err) {
          decodedCache.set(uri, null);
          audioIssue = 'не удалось прочитать звук из «' + (m.name || uri) + '»' + (err && err.message ? ' (' + err.message + ')' : '');
        }
      }
    } finally {
      try { await tmpCtx.close(); } catch (_) {}
    }

    const validLayers = audioLayers.filter((L) => decodedCache.get(srcUri(L)));
    if (!validLayers.length) { if (!audioIssue) audioIssue = 'не удалось декодировать звук'; return null; }

    const offCtx = new OfflineCtx(2, Math.ceil(durSec * sampleRate), sampleRate);
    for (const L of validLayers) {
      const buf = decodedCache.get(srcUri(L));
      if (!buf) continue;
      const startSec = Math.max(0, (L.start || 0) / 1000);
      const endSec = Math.min(durSec, ((L.end || 0) + 1) / 1000);
      const playDur = endSec - startSec;
      if (playDur <= 0.005) continue;
      const offsetSec = Math.max(0, (L.inTime || 0) / 1000);
      if (offsetSec >= buf.duration) continue;

      const src = offCtx.createBufferSource();
      src.buffer = buf;
      const gain = offCtx.createGain();
      const volProp = VM.getProp(L.props, 'volume') || VM.getProp(L.transform, 'volume');
      const baseVol = Math.max(0, Math.min(1, (L.volume !== undefined ? L.volume : 1) * S.masterVol));

      if (volProp && volProp.kfs && volProp.kfs.length) {
        const steps = Math.max(2, Math.ceil(playDur * 30));
        for (let s = 0; s <= steps; s++) {
          const lt = s / steps;
          const ev = VM.evalProp(volProp, lt);
          const v = Math.max(0, Math.min(1, (typeof ev === 'number' && isFinite(ev) ? ev : baseVol) * S.masterVol));
          gain.gain.setValueAtTime(v, startSec + lt * playDur);
        }
      } else {
        gain.gain.setValueAtTime(baseVol, startSec);
      }

      src.connect(gain);
      gain.connect(offCtx.destination);
      src.start(startSec, offsetSec, Math.min(playDur, buf.duration - offsetSec));
    }

    return await offCtx.startRendering();
  }

  function triggerBlobDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  let exportModal = null;
  function openExportModal() {
    if (!S.scene) {
      status('Сначала откройте или создайте проект', true);
      return;
    }
    setPlaying(false);

    if (!exportModal) {
      exportModal = el('div', 'modal-backdrop');
      exportModal.id = 'export-modal';
      const card = el('div', 'modal-card exp-modal');

      const head = el('div', 'modal-head');
      const mTitle = el('div', 'modal-title');
      mTitle.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg><span>Экспорт видео</span>';
      const closeBtn = el('button', 'mini', '✕');
      closeBtn.title = 'Закрыть';
      head.append(mTitle, closeBtn);

      const body = el('div', 'modal-body');
      const grid = el('div', 'exp-grid');

      const resField = el('div', 'exp-field');
      resField.append(el('span', 'pname', 'Разрешение'));
      const resSel = document.createElement('select');
      resField.append(resSel);

      const fpsField = el('div', 'exp-field');
      fpsField.append(el('span', 'pname', 'Частота кадров'));
      const fpsSel = document.createElement('select');
      for (const [val, lbl] of [['project', 'Как в проекте'], ['60', '60 fps'], ['30', '30 fps'], ['24', '24 fps']]) {
        const o = document.createElement('option');
        o.value = val;
        o.textContent = lbl;
        fpsSel.append(o);
      }
      fpsField.append(fpsSel);

      const bitField = el('div', 'exp-field');
      bitField.append(el('span', 'pname', 'Качество (битрейт)'));
      const bitSel = document.createElement('select');
      for (const [val, lbl] of [['16000000', 'Высокое (16 Мбит/с)'], ['8000000', 'Стандартное (8 Мбит/с)'], ['4000000', 'Компактное (4 Мбит/с)']]) {
        const o = document.createElement('option');
        o.value = val;
        o.textContent = lbl;
        bitSel.append(o);
      }
      bitField.append(bitSel);

      const fmtField = el('div', 'exp-field');
      fmtField.append(el('span', 'pname', 'Формат'));
      const fmtSel = document.createElement('select');
      for (const [val, lbl] of [['mp4', 'MP4 (H.264 + AAC)'], ['webm', 'WebM (VP9 / VP8)']]) {
        const o = document.createElement('option');
        o.value = val;
        o.textContent = lbl;
        fmtSel.append(o);
      }
      fmtField.append(fmtSel);

      grid.append(resField, fpsField, bitField, fmtField);

      const audioRow = el('div', 'set-row');
      const audioInfo = el('div');
      audioInfo.append(el('div', 'set-name', 'Звуковая дорожка'), el('div', 'muted', 'Свести аудиослои и звук из видео с учётом громкости'));
      const audioSw = el('label', 'sw');
      const audioChk = document.createElement('input');
      audioChk.type = 'checkbox';
      audioChk.checked = true;
      audioSw.append(audioChk, el('span', 'sw-track'));
      audioRow.append(audioInfo, audioSw);

      const progBox = el('div', 'exp-progress');
      progBox.hidden = true;
      const progTop = el('div', 'row');
      const progLabel = el('span', 'pname', 'Подготовка…');
      const progPct = el('span', 'pval', '0%');
      progTop.append(progLabel, progPct);
      const bar = el('div', 'exp-bar');
      const barFill = el('div', 'exp-bar-fill');
      bar.append(barFill);
      progBox.append(progTop, bar);

      const resBox = el('div', 'exp-result');
      resBox.hidden = true;

      const foot = el('div', 'actions');
      foot.style.margin = '4px 0 0';
      foot.style.justifyContent = 'flex-end';
      const cancelBtn = el('button', 'btn', 'Закрыть');
      const startBtn = el('button', 'btn primary', 'Начать экспорт');
      foot.append(cancelBtn, startBtn);

      body.append(grid, audioRow, progBox, resBox, foot);
      card.append(head, body);
      exportModal.append(card);
      document.body.append(exportModal);

      let abortExport = false;
      let lastExported = null;

      const closeModal = () => {
        if (S.exporting) {
          abortExport = true;
          return;
        }
        exportModal.hidden = true;
      };
      closeBtn.addEventListener('click', closeModal);
      cancelBtn.addEventListener('click', closeModal);
      exportModal.addEventListener('click', (e) => {
        if (e.target === exportModal && !S.exporting) exportModal.hidden = true;
      });

      startBtn.addEventListener('click', async () => {
        if (S.exporting || !S.scene) return;
        recalcSceneDuration();
        const totalMs = S.scene.totalTime || 0;
        if (totalMs <= 0 || !S.scene.layers.length) {
          resBox.hidden = false;
          resBox.className = 'exp-result bad';
          resBox.textContent = 'Нечего экспортировать: добавьте хотя бы один слой на таймлайн.';
          return;
        }
        if (!S.renderer) {
          resBox.hidden = false;
          resBox.className = 'exp-result bad';
          resBox.textContent = 'Рендерер WebGPU не инициализирован.';
          return;
        }

        const rawW = (resSel.value || (S.scene.width + 'x' + S.scene.height)).split('x').map(Number);
        const outW = Math.max(2, Math.round((rawW[0] || 1080) / 2) * 2);
        const outH = Math.max(2, Math.round((rawW[1] || 1920) / 2) * 2);
        const outFps = fpsSel.value === 'project' ? (S.scene.fps || 60) : (Number(fpsSel.value) || 60);
        const bps = Number(bitSel.value) || 8000000;
        const wantMp4 = fmtSel.value === 'mp4';

        const h264Cfg = wantMp4 ? await pickWebCodecsH264Config(outW, outH, outFps, bps) : null;
        const useWebCodecsMp4 = Boolean(h264Cfg);

        if (!useWebCodecsMp4 && typeof MediaRecorder === 'undefined') {
          resBox.hidden = false;
          resBox.className = 'exp-result bad';
          resBox.textContent = 'Среда не поддерживает кодирование видео.';
          return;
        }

        abortExport = false;
        S.exporting = true;
        lastExported = null;
        const savedT = S.t;
        const swappedProxies = [];

        startBtn.disabled = true;
        cancelBtn.textContent = 'Отменить';
        progBox.hidden = false;
        resBox.hidden = true;
        barFill.style.width = '0%';
        progPct.textContent = '0%';
        progLabel.textContent = 'Подготовка видео и звука…';

        let videoEncoder = null;
        let audioEncoder = null;
        let liveAudioCtx = null;
        let recorder = null;
        let stream = null;

        try {
          // Переключаем видеослои на оригиналы и дожидаемся их готовности к декодированию
          for (const m of S.media.values()) {
            if (m && m.el && m.el.pause) m.el.pause();
            if (m && m.audioEl && m.audioEl.pause) m.audioEl.pause();
            if (m && m.kind === 'video') {
              if (m.origEl && m.origEl !== m.el) {
                m.origEl.muted = true;
                const okOrig = await ensureVideoReadyForExport(m.origEl, 2500);
                if (okOrig) {
                  swappedProxies.push({ m, proxyEl: m.el });
                  m.el = m.origEl;
                }
              } else if (m.el) {
                m.el.muted = true;
                await ensureVideoReadyForExport(m.el, 2500);
              }
            }
          }

          let mixedAudioBuf = null;
          if (audioChk.checked) {
            try {
              mixedAudioBuf = await renderMixedProjectAudio(S.scene, totalMs);
            } catch (err) {
              mixedAudioBuf = null;
              audioIssue = 'ошибка микширования: ' + (err && err.message ? err.message : String(err));
            }
          }

          if (abortExport) throw new Error('Экспорт отменён');

          const expCanvas = document.createElement('canvas');
          expCanvas.width = outW;
          expCanvas.height = outH;
          const expCtx = expCanvas.getContext('2d', { alpha: false });
          expCtx.imageSmoothingEnabled = true;
          expCtx.imageSmoothingQuality = 'high';

          const shotCanvas = document.createElement('canvas');
          const shotCtx = shotCanvas.getContext('2d');

          const renderFrameToExpCanvas = async (curMs) => {
            const seekJobs = [];
            for (const L of S.scene.layers) {
              if (L.hidden || L.fillType !== 'media') continue;
              if (!(curMs >= L.start && curMs < L.end + 1)) continue;
              const m = S.media.get(srcUri(L));
              if (m && m.kind === 'video' && m.el) {
                const srcSec = ((L.inTime || 0) + (curMs - L.start)) / 1000;
                seekJobs.push(seekMediaElementExact(m.el, srcSec, 1500));
              }
            }
            if (seekJobs.length) await Promise.all(seekJobs);
            if (window.__vmExportDebug) {
              for (const L of S.scene.layers) {
                const m = S.media.get(srcUri(L));
                if (L.hidden || L.fillType !== 'media' || !m || m.kind !== 'video' || !m.el) continue;
                if (!(curMs >= L.start && curMs < L.end + 1)) continue;
                const want = ((L.inTime || 0) + (curMs - L.start)) / 1000;
                console.log('[export]', L.label, 't=' + curMs.toFixed(1), 'want=' + want.toFixed(3), 'got=' + m.el.currentTime.toFixed(3), 'dur=' + m.el.duration.toFixed(3), 'rs=' + m.el.readyState);
              }
            }

            const { draws } = buildDraws(S.scene, curMs);
            const shot = await S.renderer.render(draws, S.scene.bgcolor, true);

            expCtx.fillStyle = '#000000';
            expCtx.fillRect(0, 0, outW, outH);
            if (shot && shot.data && shot.w > 0 && shot.h > 0) {
              if (shotCanvas.width !== shot.w || shotCanvas.height !== shot.h) {
                shotCanvas.width = shot.w;
                shotCanvas.height = shot.h;
              }
              const expectedBytes = shot.w * shot.h * 4;
              if (shot.data.byteLength >= expectedBytes) {
                const rgba = new Uint8ClampedArray(shot.data.buffer, shot.data.byteOffset, expectedBytes);
                shotCtx.putImageData(new ImageData(rgba, shot.w, shot.h), 0, 0);
                expCtx.drawImage(shotCanvas, 0, 0, outW, outH);
                return;
              }
            }
            expCtx.drawImage(canvas, 0, 0, outW, outH);
          };

          const stepMs = 1000 / outFps;
          const totalFrames = Math.max(1, Math.ceil(totalMs / stepMs));
          let finalBlob = null;
          let audioWritten = false;
          let finalExt = useWebCodecsMp4 ? 'mp4' : 'webm';

          if (useWebCodecsMp4) {
            const videoSamples = [];
            let avcC = null;
            let encError = null;

            videoEncoder = new VideoEncoder({
              output: (chunk, meta) => {
                if (meta && meta.decoderConfig && meta.decoderConfig.description && !avcC) {
                  avcC = new Uint8Array(meta.decoderConfig.description);
                }
                const data = new Uint8Array(chunk.byteLength);
                chunk.copyTo(data);
                videoSamples.push({ data, key: chunk.type === 'key' });
              },
              error: (err) => { encError = err; },
            });
            videoEncoder.configure(h264Cfg);

            const frameDurUs = Math.round(1000000 / outFps);
            const keyEvery = Math.max(1, Math.round(outFps));

            for (let f = 0; f < totalFrames; f++) {
              if (abortExport || encError) break;
              const curMs = Math.min(totalMs, f * stepMs);
              S.t = curMs;

              await renderFrameToExpCanvas(curMs);

              const vf = new VideoFrame(expCanvas, {
                timestamp: f * frameDurUs,
                duration: frameDurUs,
              });
              try {
                videoEncoder.encode(vf, { keyFrame: f % keyEvery === 0 });
              } finally {
                vf.close();
              }

              while (videoEncoder.encodeQueueSize > 6 && !abortExport && !encError) {
                await new Promise((r) => setTimeout(r, 4));
              }

              const pct = Math.round(((f + 1) / totalFrames) * (mixedAudioBuf ? 90 : 98));
              barFill.style.width = pct + '%';
              progPct.textContent = pct + '%';
              progLabel.textContent = `Кодирование кадра ${f + 1} из ${totalFrames}…`;
              if (f % 3 === 0) await new Promise((r) => setTimeout(r, 0));
            }

            if (abortExport) throw new Error('Экспорт отменён');
            if (encError) throw encError;
            await videoEncoder.flush();
            videoEncoder.close();
            videoEncoder = null;

            if (!videoSamples.length || !avcC) {
              throw new Error('Видеопоток не сформирован кодеком H.264');
            }

            const audioSamples = [];
            let asc = null;
            const audioBitrate = 192000;

            if (mixedAudioBuf && typeof AudioEncoder !== 'undefined' && typeof AudioData !== 'undefined') {
              progLabel.textContent = 'Кодирование звуковой дорожки…';
              const aacCfg = {
                codec: 'mp4a.40.2',
                sampleRate: mixedAudioBuf.sampleRate,
                numberOfChannels: 2,
                bitrate: audioBitrate,
              };
              const aSup = await AudioEncoder.isConfigSupported(aacCfg).catch(() => null);
              if (!(aSup && aSup.supported)) audioIssue = 'кодек AAC не поддерживается в этой среде';
              if (aSup && aSup.supported) {
                audioEncoder = new AudioEncoder({
                  output: (chunk, meta) => {
                    if (meta && meta.decoderConfig && meta.decoderConfig.description && !asc) {
                      asc = new Uint8Array(meta.decoderConfig.description);
                    }
                    const data = new Uint8Array(chunk.byteLength);
                    chunk.copyTo(data);
                    audioSamples.push({ data });
                  },
                  error: (e) => { audioIssue = 'ошибка кодирования AAC: ' + (e && e.message ? e.message : e); },
                });
                audioEncoder.configure(aacCfg);

                const sr = mixedAudioBuf.sampleRate;
                const totalAudioSamples = mixedAudioBuf.length;
                const ch0 = mixedAudioBuf.getChannelData(0);
                const ch1 = mixedAudioBuf.numberOfChannels > 1 ? mixedAudioBuf.getChannelData(1) : ch0;
                const chunkFrames = 1024;

                for (let offset = 0; offset < totalAudioSamples; offset += chunkFrames) {
                  if (abortExport) break;
                  const len = Math.min(chunkFrames, totalAudioSamples - offset);
                  const planar = new Float32Array(len * 2);
                  planar.set(ch0.subarray(offset, offset + len), 0);
                  planar.set(ch1.subarray(offset, offset + len), len);
                  const ad = new AudioData({
                    format: 'f32-planar',
                    sampleRate: sr,
                    numberOfFrames: len,
                    numberOfChannels: 2,
                    timestamp: Math.round((offset / sr) * 1000000),
                    data: planar,
                  });
                  try {
                    audioEncoder.encode(ad);
                  } finally {
                    ad.close();
                  }
                }
                await audioEncoder.flush();
                audioEncoder.close();
                audioEncoder = null;
              }
            }

            audioWritten = audioSamples.length > 0;
            progLabel.textContent = 'Сборка MP4-файла…';
            barFill.style.width = '99%';
            progPct.textContent = '99%';

            finalBlob = buildMp4MuxedBlob({
              width: outW,
              height: outH,
              fps: outFps,
              videoSamples,
              avcC,
              audioSamples,
              asc,
              audioSampleRate: mixedAudioBuf ? mixedAudioBuf.sampleRate : 44100,
              audioChannels: 2,
              audioBitrate,
            });
          } else {
            // Резервный режим WebM через MediaRecorder
            audioWritten = Boolean(mixedAudioBuf);
            const webmMimes = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
            const mime = webmMimes.find((m) => MediaRecorder.isTypeSupported(m)) || '';
            stream = expCanvas.captureStream(outFps);

            if (mixedAudioBuf) {
              const AudioCtx = window.AudioContext || window.webkitAudioContext;
              liveAudioCtx = new AudioCtx();
              const dest = liveAudioCtx.createMediaStreamDestination();
              const bufSrc = liveAudioCtx.createBufferSource();
              bufSrc.buffer = mixedAudioBuf;
              bufSrc.connect(dest);
              for (const at of dest.stream.getAudioTracks()) stream.addTrack(at);
              liveAudioCtx._bufSrc = bufSrc;
            }

            const chunks = [];
            const recOpts = { videoBitsPerSecond: bps };
            if (mime) recOpts.mimeType = mime;
            recorder = new MediaRecorder(stream, recOpts);
            recorder.ondataavailable = (ev) => {
              if (ev.data && ev.data.size > 0) chunks.push(ev.data);
            };
            const stoppedPromise = new Promise((resolve) => { recorder.onstop = resolve; });

            recorder.start(200);
            if (liveAudioCtx && liveAudioCtx._bufSrc) {
              if (liveAudioCtx.state === 'suspended') await liveAudioCtx.resume();
              liveAudioCtx._bufSrc.start(0);
            }

            const tStartWall = performance.now();
            for (let f = 0; f < totalFrames; f++) {
              if (abortExport) break;
              const curMs = Math.min(totalMs, f * stepMs);
              S.t = curMs;
              await renderFrameToExpCanvas(curMs);

              const pct = Math.round(((f + 1) / totalFrames) * 100);
              barFill.style.width = pct + '%';
              progPct.textContent = pct + '%';
              progLabel.textContent = `Запись кадра ${f + 1} из ${totalFrames}…`;

              const waitMs = (f + 1) * stepMs - (performance.now() - tStartWall);
              await new Promise((r) => setTimeout(r, waitMs > 1 ? Math.min(waitMs, 120) : 0));
            }

            if (recorder && recorder.state !== 'inactive') recorder.stop();
            await stoppedPromise;
            if (abortExport) throw new Error('Экспорт отменён');
            finalBlob = new Blob(chunks, { type: mime || 'video/webm' });
          }

          barFill.style.width = '100%';
          progPct.textContent = '100%';

          const safeName = (S.scene.title || 'vibemotion').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'vibemotion';
          const fileName = `${safeName}_${outW}x${outH}_${outFps}fps.${finalExt}`;
          lastExported = { blob: finalBlob, fileName };

          triggerBlobDownload(finalBlob, fileName);

          const mb = (finalBlob.size / (1024 * 1024)).toFixed(2);
          progLabel.textContent = 'Готово!';
          resBox.hidden = false;
          resBox.className = 'exp-result ok';
          resBox.textContent = '';
          const hasSound = audioWritten;
          let soundNote = '';
          if (audioChk.checked && !hasSound) {
            soundNote = ' ⚠ Звука в файле НЕТ: ' + (audioIssue || 'причина неизвестна') + '.';
            resBox.className = 'exp-result bad';
          } else if (!audioChk.checked) {
            soundNote = ' Звук отключён в настройках экспорта.';
          } else {
            soundNote = ' Звук включён.';
          }
          resBox.append(
            document.createTextNode(`Файл «${fileName}» (${mb} МБ) сохранён.${soundNote} `),
          );
          const againBtn = el('button', 'mini on', 'Скачать ещё раз');
          againBtn.style.width = 'auto';
          againBtn.style.padding = '2px 8px';
          againBtn.style.marginLeft = '6px';
          againBtn.addEventListener('click', () => {
            if (lastExported) triggerBlobDownload(lastExported.blob, lastExported.fileName);
          });
          resBox.append(againBtn);
          status('Экспорт завершён: ' + fileName);
        } catch (err) {
          resBox.hidden = false;
          resBox.className = 'exp-result bad';
          resBox.textContent = err && err.message === 'Экспорт отменён'
            ? 'Экспорт отменён.'
            : ('Ошибка экспорта: ' + (err && err.message ? err.message : String(err)));
        } finally {
          if (videoEncoder) { try { videoEncoder.close(); } catch (_) {} }
          if (audioEncoder) { try { audioEncoder.close(); } catch (_) {} }
          if (liveAudioCtx) { try { await liveAudioCtx.close(); } catch (_) {} }
          if (stream) {
            for (const tr of stream.getTracks()) {
              try { tr.stop(); } catch (_) {}
            }
          }
          for (const item of swappedProxies) {
            item.m.el = item.proxyEl;
          }
          S.t = savedT;
          S.forceSeek = true;
          S.lastSig = '';
          S.exporting = false;
          startBtn.disabled = false;
          cancelBtn.textContent = 'Закрыть';
        }
      });

      exportModal._sync = () => {
        const w = S.scene.width || 1080;
        const h = S.scene.height || 1920;
        const aspect = w / Math.max(1, h);
        const makeSize = (shortSide) => {
          if (w >= h) {
            const nh = shortSide;
            const nw = Math.round((nh * aspect) / 2) * 2;
            return [nw, nh];
          }
          const nw = shortSide;
          const nh = Math.round((nw / aspect) / 2) * 2;
          return [nw, nh];
        };
        const [w720, h720] = makeSize(720);
        const [w1080, h1080] = makeSize(1080);
        const [w2160, h2160] = makeSize(2160);
        resSel.textContent = '';
        const opts = [
          [`${w}x${h}`, `Оригинал проекта (${w}×${h})`],
          [`${w1080}x${h1080}`, `Full HD (${w1080}×${h1080})`],
          [`${w720}x${h720}`, `HD (${w720}×${h720})`],
          [`${w2160}x${h2160}`, `4K Ultra HD (${w2160}×${h2160})`],
        ];
        const seen = new Set();
        for (const [val, lbl] of opts) {
          if (seen.has(val)) continue;
          seen.add(val);
          const o = document.createElement('option');
          o.value = val;
          o.textContent = lbl;
          resSel.append(o);
        }
        progBox.hidden = true;
        resBox.hidden = true;
        startBtn.disabled = false;
        cancelBtn.textContent = 'Закрыть';
      };
    }

    exportModal._sync();
    exportModal.hidden = false;
  }

  const topActionsBar = document.querySelector('#top .top-actions');
  if (topActionsBar && !$('btn-preset-store')) {
    const storeTopBtn = el('button', 'icon-btn', '✦ Мои пресеты');
    storeTopBtn.id = 'btn-preset-store';
    storeTopBtn.title = 'Ваши сохранённые шейки, переходы и наборы эффектов';
    storeTopBtn.addEventListener('click', () => {
      if (S.fxui && S.fxui.openPresetStore) S.fxui.openPresetStore();
    });

    const exportTopBtn = el('button', 'btn primary icon-btn', 'Экспорт');
    exportTopBtn.id = 'btn-export-video';
    exportTopBtn.title = 'Экспортировать проект в видеофайл';
    exportTopBtn.addEventListener('click', () => openExportModal());

    const setBtn = $('btn-settings');
    if (setBtn && setBtn.parentElement === topActionsBar) {
      topActionsBar.insertBefore(storeTopBtn, setBtn);
      topActionsBar.insertBefore(exportTopBtn, setBtn);
    } else {
      topActionsBar.append(storeTopBtn, exportTopBtn);
    }
  }
  function updateAudioBtn() {
    const btn = $('mute-all');
    const muted = S.masterMute || S.masterVol <= 0;
    btn.innerHTML = muted ? ICON_MUTE : ICON_VOL;
    btn.classList.toggle('muted', muted);
  }
  function toggleMasterMute() {
    S.masterMute = !S.masterMute;
    updateAudioBtn();
  }
  $('mute-all').addEventListener('click', (e) => { toggleMasterMute(); e.currentTarget.blur(); });
  $('master-vol').addEventListener('input', (e) => {
    S.masterVol = Number(e.target.value) / 100;
    if (S.masterVol > 0 && S.masterMute) S.masterMute = false;
    updateAudioBtn();
  });

  $('fxon').addEventListener('change', (e) => { S.fxOn = e.target.checked; });
  const stepFpsEl = $('preview-step-fps');
  if (stepFpsEl) {
    stepFpsEl.addEventListener('change', (e) => {
      S.stepFps = Number(e.target.value) || 0;
      S.lastSig = '';
      status(S.stepFps > 0 ? `Ступенчатый предпросмотр: ${S.stepFps} fps` : 'Плавный предпросмотр');
    });
  }
  const projFpsEl = $('proj-fps');
  if (projFpsEl) {
    projFpsEl.addEventListener('change', (e) => {
      if (!S.scene) return;
      const nextFps = Math.max(1, Math.min(240, Math.round(Number(e.target.value) || 60)));
      S.scene.fps = nextFps;
      updateUI();
      status('Частота кадров проекта: ' + nextFps + ' fps');
    });
  }
  renderInspector(true);
  buildMediaList();
  restartAutosaveTimer();
  renderProjectsHome();
  (async function boot() {
    try {
      S.renderer = await VM.Renderer.create(canvas);
      status('WebGPU готов. Откройте XML или добавьте файлы.');
    } catch (e) {
      status('Ошибка WebGPU: ' + e.message, true);
    }
    requestAnimationFrame(frame);
  })();
})();
