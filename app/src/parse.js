// Разбор проекта Alight Motion (XML) и вычисление параметров по времени.
(function () {
  const VM = (window.VM = window.VM || {});

  function inferValue(s) {
    const parts = s.split(',').map((p) => p.trim());
    const nums = parts.map(Number);
    if (parts.every((p) => p !== '') && nums.every((n) => !Number.isNaN(n))) {
      return nums.length === 1 ? nums[0] : nums;
    }
    return s;
  }

  function parseValue(ty, s) {
    if (ty === 'float' || ty === 'int') {
      const n = Number(s);
      return Number.isNaN(n) ? s : n;
    }
    if (ty === 'bool') return s === 'true';
    if (ty === 'color') return s;
    return inferValue(s);
  }

  // "cubicBezier x1 y1 x2 y2" -> [x1,y1,x2,y2]; всё неизвестное = линейно (null)
  function parseEasing(e) {
    if (!e) return null;
    const p = e.trim().split(/\s+/);
    if (p[0] === 'cubicBezier' && p.length === 5) {
      const n = p.slice(1).map(Number);
      if (n.every((x) => !Number.isNaN(x))) return n;
    }
    return null;
  }

  function parseProp(n) {
    const name = n.getAttribute('name') || n.tagName;
    const ty = n.getAttribute('type') || '';
    const constant = n.hasAttribute('value') ? parseValue(ty, n.getAttribute('value')) : undefined;
    const kfs = Array.from(n.children)
      .filter((c) => c.tagName === 'kf')
      .map((k) => ({
        t: Number(k.getAttribute('t')),
        v: parseValue(ty, k.getAttribute('v') || ''),
        e: parseEasing(k.getAttribute('e')),
      }))
      .sort((a, b) => a.t - b.t); // в файле ключи идут вперемешку
    return { name, ty, constant, kfs };
  }

  function allAttrs(n) {
    const o = {};
    for (const a of Array.from(n.attributes)) o[a.name] = a.value;
    return o;
  }

  function parseLayer(n) {
    const volAttr = n.getAttribute('volume');
    const L = {
      id: n.getAttribute('id') || '',
      label: n.getAttribute('label') || '',
      kind: n.getAttribute('s') || '',
      start: Number(n.getAttribute('startTime')) || 0,
      end: Number(n.getAttribute('endTime')) || 0,
      inTime: Number(n.getAttribute('inTime')) || 0,
      hidden: n.getAttribute('hidden') === 'true',
      muted: n.getAttribute('muted') === 'true',
      volume: volAttr !== null && volAttr !== '' && !Number.isNaN(Number(volAttr)) ? Number(volAttr) : 1,
      fillType: n.getAttribute('fillType') || '',
      fillVideo: n.getAttribute('fillVideo') || n.getAttribute('fillImage') || '',
      fillMode: n.getAttribute('mediaFillMode') || '',
      attrs: allAttrs(n),
      transform: [],
      effects: [],
      props: [],
      children: [],
      unknown: [],
    };
    for (const c of Array.from(n.children)) {
      switch (c.tagName) {
        case 'transform':
          L.transform = Array.from(c.children).map(parseProp);
          break;
        case 'effect':
          L.effects.push({
            id: c.getAttribute('id') || '',
            off: c.getAttribute('hidden') === 'true',
            attrs: allAttrs(c),
            props: Array.from(c.children).filter((x) => x.tagName === 'property').map(parseProp),
          });
          break;
        case 'property':
          L.props.push(parseProp(c));
          break;
        case 'shape':
          L.children.push(parseLayer(c));
          break;
        default:
          L.unknown.push(c.tagName); // неизвестное не роняет импорт
      }
    }
    return L;
  }

  VM.parseScene = function (text) {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('Файл не похож на корректный XML');
    const r = doc.documentElement;
    if (r.tagName !== 'scene') throw new Error('Корневой тег <' + r.tagName + '>, ожидался <scene>');
    const num = (k) => Number(r.getAttribute(k)) || 0;
    const scene = {
      title: r.getAttribute('title') || '',
      width: num('width'), height: num('height'),
      exportWidth: num('exportWidth'), exportHeight: num('exportHeight'),
      fps: num('fps') || 60, totalTime: num('totalTime'),
      bgcolor: r.getAttribute('bgcolor') || '#ff000000',
      media: [], layers: [], unknown: [],
    };
    for (const c of Array.from(r.children)) {
      if (c.tagName === 'media') {
        scene.media.push({
          uri: c.getAttribute('uri') || '',
          filename: c.getAttribute('filename') || '',
          width: Number(c.getAttribute('width')) || 0,
          height: Number(c.getAttribute('height')) || 0,
        });
      } else if (c.tagName === 'shape') {
        scene.layers.push(parseLayer(c));
      } else if (c.tagName === 'audio') {
        const L = parseLayer(c);
        L.fillType = 'audio';
        L.src = c.getAttribute('src') || '';
        scene.layers.push(L);
      } else {
        scene.unknown.push(c.tagName);
      }
    }
    return scene;
  };

  // ---------- вычисление параметра в момент t (нормализованное время слоя) ----------

  function bezier(x1, y1, x2, y2, u) {
    let lo = 0, hi = 1;
    for (let i = 0; i < 40; i++) {
      const m = (lo + hi) / 2;
      const x = 3 * (1 - m) * (1 - m) * m * x1 + 3 * (1 - m) * m * m * x2 + m * m * m;
      if (x < u) lo = m; else hi = m;
    }
    const s = (lo + hi) / 2;
    return 3 * (1 - s) * (1 - s) * s * y1 + 3 * (1 - s) * s * s * y2 + s * s * s;
  }

  function lerp(a, b, k) {
    if (typeof a === 'number' && typeof b === 'number') return a + (b - a) * k;
    if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) return a.map((x, i) => x + (b[i] - x) * k);
    return a;
  }

  VM.evalProp = function (p, t) {
    if (!p) return undefined;
    const k = p.kfs;
    if (!k.length) return p.constant;
    if (t <= k[0].t) return k[0].v;
    const last = k[k.length - 1];
    if (t >= last.t) return last.v;
    let i = 0;
    while (!(t >= k[i].t && t < k[i + 1].t)) i++;
    const a = k[i], b = k[i + 1];
    if (p.ty === 'int' || p.ty === 'bool') return a.v; // ступенька
    const u = (t - a.t) / (b.t - a.t);
    // В XML Alight Motion кривая сглаживания (e="cubicBezier ...") записана на КОНЕЧНОМ ключе отрезка (b.e).
    const e = b.e ? bezier(b.e[0], b.e[1], b.e[2], b.e[3], u) : u;
    return lerp(a.v, b.v, e);
  };

  VM.getProp = function (list, name) {
    return list.find((p) => p.name === name);
  };
})();
