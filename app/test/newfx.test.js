// Новые эффекты: node test/newfx.test.js
global.window = {};
require('../src/parse.js');
require('../src/effects.js');
const VM = global.window.VM;
const assert = require('assert');
const scene = { width: 1080, height: 1080, fps: 60 };
const rect = { center: [540, 540], extent: [540, 540], rot: 0 };
const layer = (id, props) => ({ start: 0, end: 1000, transform: [], effects: [VM.Effects.make('com.alightcreative.effects.' + id)].map((fx) => { for (const [k, v] of Object.entries(props)) VM.getProp(fx.props, k).constant = v; return fx; }) });
const run = (id, props) => VM.Effects.passes(layer(id, props), 0.5, scene, rect);

assert.strictEqual(run('invert', { amount: 0 }).length, 0, 'invert 0 — без прохода');
assert.deepStrictEqual(run('invert', { amount: 1 })[0].a, [1, 0, 0, 4]);
assert.strictEqual(run('brightnesscontrast', {}).length, 0, 'по умолчанию без изменений');
assert.strictEqual(run('brightnesscontrast', { contrast: 1.5 })[0].a[3], 5);
assert.strictEqual(run('colortemperature', { temperature: 0.5 })[0].a[3], 6);
const db = run('directionalblur', { strength: 0.1, angle: 90 })[0];
assert.strictEqual(db.fs, 'blur');
assert.ok(Math.abs(db.dir[0]) < 1e-9 && Math.abs(db.dir[1] - 1) < 1e-9);
for (const k of ['invert', 'brightnesscontrast', 'colortemperature', 'directionalblur']) assert.ok(VM.Effects.metaOf('com.alightcreative.effects.' + k));
console.log('newfx: ok');

// ---- эффекты 2.0 ----
const one = (id, props, lt = 0.5) => VM.Effects.passes(layer(id, props), lt, scene, rect);
assert.deepStrictEqual(one('pixelate', { size: 1 }), [], 'pixelate 1 = без прохода');
assert.strictEqual(one('pixelate', { size: 24 })[0].fs, 'pix');
assert.strictEqual(one('pixelate', { size: 24 })[0].a[0], 24);
assert.strictEqual(one('posterize', { levels: 4 })[0].a[3], 7);
assert.strictEqual(one('threshold', { level: 0.3 })[0].a[3], 8);
assert.deepStrictEqual(one('saturationvibrance', {}), [], 'по умолчанию без изменений');
assert.strictEqual(one('saturationvibrance', { saturation: 0 })[0].a[3], 9);
assert.deepStrictEqual(one('zoomblur', { strength: 0 }), []);
const zb = one('zoomblur', { strength: 0.2, offx: 10, offy: -5 })[0];
assert.strictEqual(zb.fs, 'zoom'); assert.deepStrictEqual(zb.a.slice(1, 3), [550, 535]);
const sb = one('spinblur', { angle: 90 })[0];
assert.strictEqual(sb.fs, 'spin'); assert.ok(Math.abs(sb.a[0] - Math.PI / 2) < 1e-9);

// прозрачность из layerMod
const modOf = (id, props, lt) => VM.Effects.layerMod(layer(id, props), lt);
const po = (lt) => modOf('pulseopacity', { freq: 1, min: 0.2 }, lt).alpha;
assert.ok(po(0.25) <= 1 + 1e-9 && po(0.75) >= 0.2 - 1e-9);
assert.ok(Math.abs(po(0.25) - 1) < 1e-6, 'пик синуса при 1/4 цикла');
assert.ok(Math.abs(po(0.75) - 0.2) < 1e-6, 'минимум при 3/4 цикла');
const fl = (lt) => modOf('flicker', { amount: 1, freq: 10, seed: 3 }, lt).alpha;
assert.ok(fl(0.31) >= 0 && fl(0.31) <= 1);
assert.strictEqual(modOf('flicker', { amount: 0 }, 0.4).alpha, 1);
console.log('newfx 2.0: ok');
