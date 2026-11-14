// Имитация <audio>/<video> с задержкой перемотки: проверяем, что звук не пропадает.
// Запуск: node test/mediasync.test.js [old]
global.window = {};
const fs = require('fs');
const path = require('path');
const assert = require('assert');

let T = 0; // «часы», мс
class MockEl {
  constructor(tag, seekMs) {
    this.tagName = tag; this.seekMs = seekMs;
    this.paused = true; this.muted = false; this.volume = 1; this.playbackRate = 1;
    this._pos = 0; this._seekDone = -1; this.duration = 30; this.readyState = 4; this.src = ''; this.preload = '';
    this._ls = {};
  }
  get seeking() { return this._seekDone > T; }
  get currentTime() { return this._pos; }
  set currentTime(v) { this._pos = v; this._seekDone = T + this.seekMs; this._ev = true; }
  get readyState_() { return 4; }
  addEventListener(n, f) { (this._ls[n] = this._ls[n] || []).push(f); }
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
  step(dt) {
    if (this._ev && !this.seeking) { this._ev = false; (this._ls.seeked || []).forEach((f) => f()); }
    if (!this.paused && !this.seeking) this._pos += (dt / 1000) * this.playbackRate;
  }
  get audible() { return !this.paused && !this.seeking && !this.muted && this.volume > 0; }
}

function run(mode, seekMs) {
  const all = [];
  const mk = (tag) => { const e = new MockEl(tag, seekMs); all.push(e); return e; };
  const S = { t: 0, playing: false, forceSeek: false, media: new Map(), masterVol: 1, masterMute: false };
  const mm = { kind: 'video', url: 'blob:x', el: mk('VIDEO'), audioEl: null };
  S.media.set('u', mm);
  // 13 кусков подряд, как в shake.xml, у каждого отдельная звуковая дорожка
  const cuts = [[0,432,0],[433,899,3715],[900,1349,6314],[1350,1799,9796],[1800,2299,12296],[2300,2732,966],[2733,3149,2350],
    [3150,3415,3050],[3416,3665,3750],[3666,3882,4683],[3883,4099,5316],[4100,4349,7033],[4350,4582,7583]];
  const layers = [];
  cuts.forEach(([a, b, i], k) => {
    layers.push({ id: 'v' + k, fillType: 'media', fillVideo: 'u', start: a, end: b, inTime: i, muted: true, volume: 1 });
    layers.unshift({ id: 'a' + k, fillType: 'audio', fillVideo: 'u', start: a, end: b, inTime: i, muted: false, volume: 1 });
  });
  const scene = { layers, totalTime: 4582 };
  const srcUri = (L) => L.src || L.fillVideo;
  const layerVolume = (L) => (L.muted ? 0 : 1);
  let sync;
  if (mode === 'old') {
    const src = fs.readFileSync('/home/claude/app.js.orig', 'utf8');
    const a = src.indexOf('  function ensureDetachedAudioEl'), b = src.indexOf('  // ---------- правая панель');
    const body = src.slice(a, b);
    global.Audio = function () { return mk('AUDIO'); };
    global.document = { createElement: () => mk('VIDEO') };
    global.performance = { now: () => T };
    sync = new Function('S', 'srcUri', 'layerVolume', body + '; return syncMedia;')(S, srcUri, layerVolume);
  } else {
    require(path.join(__dirname, '../src/mediasync.js'));
    sync = global.window.VM.MediaSync.create({
      S, srcUri, layerVolume, now: () => T, newAudio: () => mk('AUDIO'), newVideo: () => mk('VIDEO'),
    }).sync;
  }
  const FRAME = 1000 / 60;
  let ok = 0, tot = 0;
  const wantLayer = () => layers.find((L) => L.fillType === 'audio' && S.t >= L.start && S.t < L.end + 1);
  const frame = () => {
    T += FRAME;
    all.forEach((e) => e.step(FRAME));
    if (S.playing) { S.t += FRAME; if (S.t >= 4582) { S.t = 0; S.forceSeek = true; } }
    sync(scene);
    if (S.playing) {
      tot++;
      const L = wantLayer();
      const w = L ? (L.inTime + (S.t - L.start)) / 1000 : 0;
      if (all.some((e) => e.audible && Math.abs(e.currentTime - w) < 0.2 && e.tagName === 'AUDIO')) ok++;
    }
  };
  const seek = (ms) => { S.t = ms; S.forceSeek = true; };
  const secs = (n) => { for (let i = 0; i < n * 60; i++) frame(); };
  // сценарий: играем, пауза, возобновление, несколько перемоток во время игры, перемотка на паузе
  seek(0); S.playing = true; secs(1.0);
  S.playing = false; secs(0.5); S.playing = true; secs(0.8);
  seek(2400); secs(0.8); seek(3900); secs(0.5); seek(700); secs(0.7);
  S.playing = false; seek(1500); secs(0.3); S.playing = true; secs(1.2);
  return (ok / tot * 100).toFixed(1);
}

for (const seekMs of [60, 250, 700]) {
  T = 0;
  const mode = process.argv[2] === 'old' ? 'old' : 'new';
  const pct = run(mode, seekMs);
  console.log(`${mode}: задержка перемотки ${seekMs} мс -> звук слышен ${pct}% времени воспроизведения`);
  if (mode === 'new') assert.ok(Number(pct) >= 100 - 6 * seekMs / 63 - 5, 'звук слишком часто пропадает при задержке ' + seekMs); // перемотки вручную неизбежно дают паузу на время seek
}

// ---- листание кадров стрелками на паузе, затем воспроизведение ----
function stepTest(seekMs) {
  T = 0;
  const all = [];
  const mk = (tag) => { const e = new MockEl(tag, seekMs); e.sets = 0; const d = Object.getOwnPropertyDescriptor(MockEl.prototype, 'currentTime'); Object.defineProperty(e, 'currentTime', { get() { return d.get.call(this); }, set(v) { this.sets++; d.set.call(this, v); } }); all.push(e); return e; };
  const S = { t: 1000, playing: false, forceSeek: true, media: new Map(), masterVol: 1, masterMute: false };
  const mm = { kind: 'video', url: 'blob:x', el: mk('VIDEO'), audioEl: null };
  S.media.set('u', mm);
  const layers = [
    { id: 'a0', fillType: 'audio', fillVideo: 'u', start: 0, end: 4582, inTime: 0, muted: false, volume: 1 },
    { id: 'v0', fillType: 'media', fillVideo: 'u', start: 0, end: 4582, inTime: 0, muted: true, volume: 1 },
  ];
  require(path.join(__dirname, '../src/mediasync.js'));
  const sync = global.window.VM.MediaSync.create({ S, srcUri: (L) => L.fillVideo, layerVolume: (L) => (L.muted ? 0 : 1),
    now: () => T, newAudio: () => mk('AUDIO'), newVideo: () => mk('VIDEO') }).sync;
  const FRAME = 1000 / 60;
  const frame = () => { T += FRAME; all.forEach((e) => e.step(FRAME)); if (S.playing) S.t += FRAME; sync({ layers }); };
  for (let i = 0; i < 60; i++) frame();                       // устоялись на 1.0 с
  const audio = () => all.find((e) => e.tagName === 'AUDIO');
  const v = mm.el, a0 = audio().sets, v0 = v.sets;
  for (let i = 0; i < 40; i++) {                              // держим стрелку: шаг на кадр каждые ~2 кадра
    S.t += FRAME; S.forceSeek = true; S.seekAt = T;
    frame(); frame();
  }
  assert.ok(audio().sets - a0 === 0, 'звук перематывался во время листания: ' + (audio().sets - a0));
  for (let i = 0; i < 60 + Math.ceil(seekMs / FRAME); i++) frame(); // пауза в листании: звук подтягивается один раз
  assert.ok(audio().sets - a0 <= 1, 'звук перематывался лишний раз: ' + (audio().sets - a0));
  assert.ok(Math.abs(v.currentTime - S.t / 1000) < 0.02, 'видео не дошло до кадра');
  S.playing = true;                                           // Пробел
  let gap = 0;
  for (let i = 0; i < 120; i++) { frame(); if (!audio().audible) gap++; }
  console.log(`шаги: задержка ${seekMs} мс -> перемоток звука ${audio().sets - a0}, пауза звука после старта ${(gap * FRAME).toFixed(0)} мс`);
  assert.ok(gap * FRAME < 150, 'звук долго молчит после листания');
}
[60, 250, 700].forEach(stepTest);
