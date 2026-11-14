// Метки битов: хранятся в сцене (scene.beats — миллисекунды по возрастанию), поэтому
// сохраняются вместе с проектом и работают с Ctrl+Z.
(function () {
  const VM = (window.VM = window.VM || {});

  const get = (scene) => (Array.isArray(scene.beats) ? scene.beats : []);

  // Поставить метку; на паузе повторное нажатие рядом с меткой (в пределах половины кадра) её убирает.
  // Во время воспроизведения метки только добавляются: промах по такту не должен стирать уже поставленное.
  function tap(scene, ms, o) {
    const opts = o || {};
    const t = Math.max(0, Math.min(scene.totalTime || Infinity, Math.round(ms)));
    if (!Array.isArray(scene.beats)) scene.beats = [];
    const list = scene.beats;
    const tol = opts.playing ? 30 : Math.max(8, 500 / (opts.fps || 60));
    const i = list.findIndex((b) => Math.abs(b - t) <= tol);
    if (i >= 0) {
      if (opts.playing) return { action: 'exists', ms: list[i] };
      const [gone] = list.splice(i, 1);
      return { action: 'removed', ms: gone };
    }
    list.push(t);
    list.sort((a, b) => a - b);
    return { action: 'added', ms: t };
  }

  function remove(scene, ms) {
    const list = get(scene);
    const i = list.indexOf(ms);
    if (i < 0) return false;
    list.splice(i, 1);
    return true;
  }

  function clear(scene) {
    const n = get(scene).length;
    if (n) scene.beats = [];
    return n;
  }

  // ближайшая метка строго после (dir > 0) или строго до (dir < 0) времени ms
  function neighbor(scene, ms, dir) {
    const list = get(scene);
    if (dir > 0) return list.find((b) => b > ms + 1);
    for (let i = list.length - 1; i >= 0; i--) if (list[i] < ms - 1) return list[i];
    return undefined;
  }

  VM.Beats = { get, tap, remove, clear, neighbor };
})();
