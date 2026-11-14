// Синхронизация <video>/<audio> с таймлайном.
// Отдельная (отделённая от видео) звуковая дорожка живёт в своих <audio>-элементах:
// по одному на слой, с упреждающей подготовкой следующего слоя, чтобы на стыках
// кусков и после паузы/перемотки звук не пропадал.
(function () {
  const VM = (window.VM = window.VM || {});

  const LOOKAHEAD_MS = 1500;   // за сколько заранее готовим следующий звуковой слой
  const RESEEK_DIFF = 0.45;    // рассинхрон, после которого элемент перематывается
  const PAUSED_TOL = 0.03;     // допуск позиции звука на паузе, с
  const VIDEO_TOL = 0.004;     // допуск видео на паузе (меньше кадра, иначе шаг не сдвинет картинку)
  const SCRUB_IDLE_MS = 200;   // звук не перематываем, пока пользователь листает кадры

  function create(env) {
    const S = env.S;
    const srcUri = env.srcUri;
    const layerVolume = env.layerVolume;
    const now = env.now || (() => performance.now());
    const newAudio = env.newAudio || (() => new Audio());
    const newVideo = env.newVideo || (() => document.createElement('video'));

    // ---------- общие помощники ----------

    function track(el) {
      if (el._tracked) return el;
      el._tracked = true;
      el._lat = 0.15;     // измеренная задержка перемотки, с
      el._seekAt = -1e9;
      el._rateAdj = 0;
      el._pending = undefined; // последняя цель, пришедшая во время перемотки
      if (el.addEventListener) {
        el.addEventListener('seeked', () => {
          const dt = (now() - el._seekAt) / 1000;
          if (dt > 0 && dt < 3) el._lat = Math.max(0.03, Math.min(1.5, dt));
          S.frameEpoch = (S.frameEpoch || 0) + 1; // пришёл новый кадр -> нужен перерисовать
          if (el._pending !== undefined) {
            const p = el._pending;
            el._pending = undefined;
            if (Math.abs(p - el.currentTime) > 0.001) {
              el._seekAt = now();
              try { el.currentTime = p; } catch (e) { /* ignore */ }
            }
          }
        });
        const bump = () => { S.frameEpoch = (S.frameEpoch || 0) + 1; };
        el.addEventListener('loadeddata', bump);
        el.addEventListener('canplay', bump);
      }
      return el;
    }

    // Не копим очередь перемоток: пока элемент перематывается, запоминаем только последнюю цель.
    // При принудительной перемотке пользователем (force) бьём сразу в новую точку, не дожидаясь старого seeked.
    function seekEl(el, sec, lead, forceNow) {
      const target = Math.max(0, sec + (lead || 0));
      if (el.seeking && !forceNow) { el._pending = target; return; }
      el._pending = undefined;
      el._seekAt = now();
      try { el.currentTime = target; } catch (e) { /* метаданные ещё не готовы */ }
    }

    function play(el) {
      const pr = el.play();
      if (pr && pr.catch) pr.catch(() => {});
    }

    // ---------- пул звуковых элементов ----------

    function audioPool(mm) {
      if (!mm.apool) {
        mm.apool = [];
        if (mm.kind === 'audio') mm.apool.push(mm.el);
        else if (mm.audioEl) mm.apool.push(mm.audioEl);
      }
      return mm.apool;
    }

    function acquireAudio(mm, key, needed) {
      const pool = audioPool(mm);
      let el = pool.find((e) => e._owner === key);
      if (!el) el = pool.find((e) => !e._owner || !needed.has(e._owner));
      if (!el) {
        if (!mm.url) return null;
        el = newAudio();
        el.preload = 'auto';
        el.src = mm.url;
        if (!mm.audioEl && mm.kind !== 'audio') mm.audioEl = el;
        pool.push(el);
      }
      el._owner = key;
      return track(el);
    }

    // ---------- видеоэлементы (их же рисует рендерер) ----------

    function acquireVideo(mm, slot) {
      if (slot === 0) return track(mm.el);
      if (!mm.extraEls) mm.extraEls = [];
      let ex = mm.extraEls[slot - 1];
      if (!ex && mm.url) {
        ex = mm.kind === 'audio' ? newAudio() : newVideo();
        ex.preload = 'auto';
        if (ex.tagName === 'VIDEO') ex.playsInline = true;
        ex.src = mm.url;
        mm.extraEls[slot - 1] = ex;
      }
      return ex ? track(ex) : null;
    }

    // ---------- подгонка одного элемента под слой ----------

    function syncElementToLayer(el, L, vol, force, isClockMaster) {
      const mute = vol <= 0.0001;
      if (el.muted !== mute) el.muted = mute;
      if (Math.abs(el.volume - vol) > 0.002) el.volume = vol;

      const want = Math.max(0, ((L.inTime || 0) + (S.t - L.start)) / 1000);
      const maxDur = isFinite(el.duration) && el.duration > 0 ? Math.max(0, el.duration - 0.01) : Infinity;
      const w = Math.min(want, maxDur);
      const diff = w - el.currentTime;
      if (el.seeking && el._pending !== undefined && !force) {
        el._pending = w + (S.playing ? Math.min(0.12, el._lat * 0.5) : 0);
      }

      if (S.playing) {
        if (want >= maxDur && maxDur < Infinity) {
          if (!el.paused) el.pause();
          if (el.playbackRate !== 1) el.playbackRate = 1;
          return;
        }
        if (el.seeking && !force) {
          if (el.paused && el.readyState >= 2) play(el);
          return;
        }

        const cool = Math.max(450, el._lat * 1600);
        if (force || (Math.abs(diff) > RESEEK_DIFF && now() - el._seekAt > cool)) {
          if (el.playbackRate !== 1) el.playbackRate = 1;
          el._rateAdj = 0;
          const lead = force ? Math.min(0.06, el._lat * 0.35) : Math.min(0.15, el._lat * 0.7);
          seekEl(el, w, lead, force);
          if (el.paused && el.readyState >= 1) play(el);
        } else if (!isClockMaster) {
          const absDiff = Math.abs(diff);
          if (absDiff > 0.09) el._rateAdj = diff > 0 ? 1 : -1;
          else if (absDiff < 0.025) el._rateAdj = 0;
          const targetRate = el._rateAdj === 1 ? 1.02 : el._rateAdj === -1 ? 0.98 : 1;
          if (el.playbackRate !== targetRate) el.playbackRate = targetRate;
        } else if (el.playbackRate !== 1) {
          el.playbackRate = 1;
          el._rateAdj = 0;
        }
        if (el.paused && el.readyState >= 2) play(el);
      } else {
        if (el.playbackRate !== 1) el.playbackRate = 1;
        el._rateAdj = 0;
        if (!el.paused) el.pause();
        const audioOnly = el.tagName === 'AUDIO';
        // картинка должна попадать в кадр точно, звук достаточно подтянуть, когда перемотка затихла
        const scrubbing = now() - (S.seekAt || -1e9) < SCRUB_IDLE_MS;
        if (!(audioOnly && scrubbing) && Math.abs(diff) > (audioOnly ? PAUSED_TOL : VIDEO_TOL)) seekEl(el, w, 0);
      }
    }

    // следующий звуковой слой: заранее ставим на его in-точку и грузим
    function preroll(el, L) {
      el.muted = true;
      if (!el.paused) el.pause();
      if (el.seeking) return;
      const w = Math.max(0, (L.inTime || 0) / 1000);
      if (Math.abs(w - el.currentTime) > 0.05 && now() - el._seekAt > 300) seekEl(el, w, 0);
    }

    // ---------- главный проход ----------

    function sync(scene) {
      for (const mm of S.media.values()) if (mm.el && mm.el.addEventListener) track(mm.el);
      const usedEls = new Set();
      const videoSlots = new Map();
      const activePairs = [];
      const audioWork = [];

      for (const L of scene.layers) {
        if (L.hidden || !(L.fillType === 'media' || L.fillType === 'audio')) continue;
        const mm = S.media.get(srcUri(L));
        if (!mm || mm.kind === 'image' || !mm.el) continue;
        const active = S.t >= L.start && S.t < L.end + 1;
        if (L.fillType === 'audio') {
          const ahead = L.start - S.t;
          if (active || (ahead > 0 && ahead <= LOOKAHEAD_MS)) audioWork.push({ L, mm, active });
        } else if (active) {
          const slot = videoSlots.get(mm) || 0;
          videoSlots.set(mm, slot + 1);
          const el = acquireVideo(mm, slot);
          if (!el) continue;
          usedEls.add(el);
          activePairs.push({ el, L, vol: layerVolume(L) });
        }
      }

      const needed = new Set(audioWork.map((x) => 'a:' + x.L.id));
      const prerolls = [];
      for (const x of audioWork) {
        const el = acquireAudio(x.mm, 'a:' + x.L.id, needed);
        if (!el) continue;
        usedEls.add(el);
        if (x.active) activePairs.push({ el, L: x.L, vol: layerVolume(x.L) });
        else prerolls.push({ el, L: x.L });
      }

      const force = !!S.forceSeek;
      S.forceSeek = false;

      // ведущие часы: первый играющий элемент со звуком (не перехватываем в первые 350 мс после пользовательской перемотки)
      let clockMaster = null;
      const recentlySeeked = now() - (S.seekAt || -1e9) < 350;
      if (S.playing && !force && !recentlySeeked) {
        const audible = activePairs.find((p) => p.vol > 0.0001 && !p.el.paused && !p.el.seeking && p.el.readyState >= 3 && now() - (p.el._seekAt || -1e9) > 300);
        if (audible) {
          const expectedMs = audible.L.start + (audible.el.currentTime * 1000 - (audible.L.inTime || 0));
          if (Math.abs(expectedMs - S.t) < 120 && expectedMs >= audible.L.start && expectedMs <= audible.L.end + 1) {
            S.t = expectedMs;
            clockMaster = audible.el;
          }
        }
      }

      for (const { el, L, vol } of activePairs) syncElementToLayer(el, L, vol, force, el === clockMaster);
      for (const { el, L } of prerolls) preroll(el, L);

      for (const mm of S.media.values()) {
        const pool = [mm.el, ...(mm.apool || []), mm.audioEl, ...(mm.extraEls || [])];
        for (const el of pool) {
          if (!el || !el.pause || usedEls.has(el)) continue;
          if (!el.paused) el.pause();
          if (el.playbackRate !== 1) el.playbackRate = 1;
          el._rateAdj = 0;
          if (!el.muted) el.muted = true;
        }
      }
    }

    return { sync };
  }

  VM.MediaSync = { create };
})();
