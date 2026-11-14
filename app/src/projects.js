// Хранилище проектов в IndexedDB (сцена, прикреплённые медиафайлы Blob и миниатюра превью)
(function () {
  const VM = (window.VM = window.VM || {});
  const DB_NAME = 'vibemotion_projects_v1';
  const STORE = 'projects';

  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const st = db.createObjectStore(STORE, { keyPath: 'id' });
          st.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function withStore(mode, fn) {
    return openDB().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const st = tx.objectStore(STORE);
      const res = fn(st);
      tx.oncomplete = () => { db.close(); resolve(res && res.result !== undefined ? res.result : res); };
      tx.onerror = () => { db.close(); reject(tx.error); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    }));
  }

  function genId() {
    return 'proj_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  // Возвращает облегчённый список проектов без тяжёлых Blob
  async function list() {
    const all = await withStore('readonly', (st) => st.getAll());
    return (all || [])
      .map((p) => ({
        id: p.id,
        title: p.title || 'Без названия',
        isXml: Boolean(p.isXml || (p.scene && p.scene.isXml)),
        width: p.width || 1080,
        height: p.height || 1920,
        fps: p.fps || 60,
        totalTime: p.totalTime || 0,
        layersCount: p.layersCount || 0,
        mediaCount: p.mediaCount || 0,
        thumb: p.thumb || '',
        createdAt: p.createdAt || p.updatedAt || Date.now(),
        updatedAt: p.updatedAt || Date.now(),
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  function get(id) {
    return withStore('readonly', (st) => st.get(id));
  }

  function save(record) {
    return withStore('readwrite', (st) => st.put(record));
  }

  function remove(id) {
    return withStore('readwrite', (st) => st.delete(id));
  }

  async function duplicate(id) {
    const orig = await get(id);
    if (!orig) return null;
    const now = Date.now();
    const copy = Object.assign({}, orig, {
      id: genId(),
      title: (orig.title || 'Проект') + ' (копия)',
      isXml: Boolean(orig.isXml || (orig.scene && orig.scene.isXml)),
      createdAt: now,
      updatedAt: now,
    });
    if (copy.scene) copy.scene = Object.assign({}, copy.scene, { title: copy.title });
    await save(copy);
    return copy;
  }

  async function rename(id, newTitle) {
    const rec = await get(id);
    if (!rec) return null;
    const clean = (newTitle || '').trim() || 'Без названия';
    rec.title = clean;
    if (rec.scene) rec.scene.title = clean;
    rec.updatedAt = Date.now();
    await save(rec);
    return rec;
  }

  VM.Projects = { genId, list, get, save, remove, duplicate, rename };
})();
