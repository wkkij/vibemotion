// Логика меток битов: node test/beats.test.js
global.window = {};
require('../src/beats.js');
const B = global.window.VM.Beats;
const assert = require('assert');

const sc = { totalTime: 5000, fps: 60 };
assert.deepStrictEqual(B.get(sc), []);                       // чтение не создаёт поле (иначе лишний шаг в истории)
assert.strictEqual('beats' in sc, false);

assert.strictEqual(B.tap(sc, 1000.4, { fps: 60 }).action, 'added');
B.tap(sc, 500, { fps: 60 }); B.tap(sc, 2500, { fps: 60 });
assert.deepStrictEqual(sc.beats, [500, 1000, 2500]);         // отсортировано

assert.strictEqual(B.tap(sc, 1005, { fps: 60 }).action, 'removed');   // на паузе повтор рядом убирает (в пределах полкадра)
assert.deepStrictEqual(sc.beats, [500, 2500]);
assert.strictEqual(B.tap(sc, 520, { fps: 60 }).action, 'added');       // дальше полкадра — это новая метка
assert.strictEqual(B.tap(sc, 2510, { playing: true, fps: 60 }).action, 'exists'); // на ходу метки не стираются
assert.deepStrictEqual(sc.beats, [500, 520, 2500]);

B.tap(sc, 99999, { fps: 60 }); B.tap(sc, -50, { fps: 60 });            // в пределах проекта
assert.strictEqual(sc.beats[0], 0);
assert.strictEqual(sc.beats[sc.beats.length - 1], 5000);

assert.strictEqual(B.neighbor(sc, 520, 1), 2500);
assert.strictEqual(B.neighbor(sc, 520, -1), 500);
assert.strictEqual(B.neighbor(sc, 5000, 1), undefined);
assert.strictEqual(B.neighbor(sc, 0, -1), undefined);

assert.strictEqual(B.remove(sc, 520), true);
assert.strictEqual(B.remove(sc, 521), false);
assert.strictEqual(B.clear(sc), 4);
assert.deepStrictEqual(sc.beats, []);
console.log('метки битов: все проверки пройдены');
