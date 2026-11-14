// Проверка интерполяции и эффектов без Electron: node test/eval.test.js
global.window = {};
require('../src/parse.js');
require('../src/effects.js');
const VM = global.window.VM;
const assert = require('assert');

const mk = (kfs, ty = 'float') => ({ name: 'x', ty, kfs: kfs.map(([t, v, e]) => ({ t, v, e: e || null })) });

// линейно
assert.strictEqual(VM.evalProp(mk([[0, 0], [1, 10]]), 0.5), 5);
// за пределами диапазона: крайние значения
assert.strictEqual(VM.evalProp(mk([[0, 2], [1, 4]]), -5), 2);
assert.strictEqual(VM.evalProp(mk([[0, 2], [1, 4]]), 9), 4);
// вектор
assert.deepStrictEqual(VM.evalProp(mk([[0, [0, 0]], [1, [2, 4]]]), 0.5), [1, 2]);
// int: ступенька
assert.strictEqual(VM.evalProp(mk([[0, 1], [1, 5]], 'int'), 0.9), 1);
// кривая Безье в Alight Motion хранится на конечном ключе отрезка (b.e)
const bzProp = mk([[0, 0], [1, 1, [0.0, 0.0, 0.25, 1.0]]]);
const bzStart = VM.evalProp(bzProp, 0.0001);
const bzMid = VM.evalProp(bzProp, 0.25);
const bzEnd = VM.evalProp(bzProp, 0.9999);
assert.ok(bzStart >= 0 && bzStart < 0.01);
assert.ok(bzMid > 0.5, 'ожидалось ускорение ease-out по кривой конечного ключа, получено ' + bzMid);
assert.ok(bzEnd > 0.99 && bzEnd <= 1.0);
// константа
assert.strictEqual(VM.evalProp({ name: 'c', ty: 'float', constant: 3, kfs: [] }, 0.5), 3);

// проверка проходов эффектов (плитка, фрактальное искажение, размытие движения, гаусс, rgbsep)
const sampleLayer = {
  start: 0, end: 1000,
  transform: [
    { name: 'location', ty: 'vec2', constant: [540, 540], kfs: [{ t: 0, v: [400, 540], e: null }, { t: 1, v: [680, 540], e: null }] },
    { name: 'scale', ty: 'vec2', constant: [1, 1], kfs: [] },
    { name: 'rotation', ty: 'float', constant: 0, kfs: [] },
  ],
  effects: [
    VM.Effects.make('com.alightcreative.effects.tile'),
    VM.Effects.make('com.alightcreative.effects.fractalwarp4'),
    VM.Effects.make('com.alightcreative.effects.wavewarp2'),
    VM.Effects.make('com.alightcreative.effects.circularripple2'),
    VM.Effects.make('com.alightcreative.effects.shake2'),
    VM.Effects.make('com.alightcreative.effects.motionblur4'),
    VM.Effects.make('com.alightcreative.effects.gaussianblur'),
    VM.Effects.make('com.alightcreative.effects.rgbsep'),
    VM.Effects.make('com.alightcreative.effects.exposure'),
  ],
};
// нейтральная экспозиция проход не создаёт (оптимизация), поэтому задаём ненулевое значение
sampleLayer.effects[8].props.find((p) => p.name === 'exposure').constant = 1;
const passes = VM.Effects.passes(sampleLayer, 0.5, { width: 1080, height: 1080, fps: 60 }, { center: [540, 540], extent: [270, 270], rot: 0 });
assert.strictEqual(passes[0].fs, 'geo');
assert.strictEqual(passes[0].ops.length, 5);
assert.ok(passes.some((p) => p.fs === 'mblur'));
assert.ok(passes.some((p) => p.fs === 'blur'));
assert.ok(passes.some((p) => p.fs === 'rgb'));
assert.ok(passes.some((p) => p.fs === 'color'));
console.log('все проверки пройдены');
