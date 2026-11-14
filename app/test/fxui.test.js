// Дымовой тест панели эффектов на заглушке DOM: node test/fxui.test.js
const mkEl = (tag) => {
  const n = { tag, children: [], dataset: {}, style: { setProperty(k, v) { this[k] = v; } }, className: '', textContent: '', value: '', min: '0', max: '1', checked: false, listeners: {}, open: true,
    classList: { add() {}, remove() {}, toggle() {} },
    append(...c) { this.children.push(...c); },
    addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); },
    set title(v) { this._t = v; }, get title() { return this._t; } };
  return n;
};
global.document = { createElement: mkEl, activeElement: null };
global.window = {};
require('../src/parse.js'); require('../src/effects.js'); require('../src/fxui.js');
const VM = global.window.VM, assert = require('assert');
let rerenders = 0, lt = 0.5;
const ui = VM.FxUI.create({ getLayer() {}, getLt: () => lt, rerender() { rerenders++; }, copyEffects() {}, pasteEffects() {}, clipboardCount: () => 0, selectedCount: () => 1 });
const L = { start: 0, end: 1000, effects: ['gaussianblur', 'pixelate', 'zoomblur', 'tile'].map((k) => VM.Effects.make('com.alightcreative.effects.' + k)), transform: [] };
L.effects[0].props[0].kfs = [{ t: 0, v: 0.1, e: null }, { t: 1, v: 0.3, e: null }];
const box = mkEl('div');
ui.render(box, L);
const walk = (n, f) => { f(n); (n.children || []).forEach((c) => walk(c, f)); };
let cards = 0, rsts = [], cats = new Set(), badges = 0;
walk(box, (n) => {
  if (n.tag === 'details') { cards++; cats.add(n.dataset.cat); }
  if (n.className === 'rst') rsts.push(n);
  if (n.className === 'fxbadge') badges++;
});
assert.strictEqual(cards, 4, 'четыре карточки эффектов');
assert.deepStrictEqual([...cats].sort(), ['blur', 'style', 'warp']);
assert.strictEqual(badges, 1, 'бейдж у анимированного эффекта');
assert.ok(rsts.length >= 10, 'кнопка сброса у каждого параметра');
ui.tick(); // обновление значений не должно падать
// сброс анимированного параметра ставит ключ со значением по умолчанию
rsts[0].listeners.click[0]();
assert.ok(rerenders >= 1);
console.log('fxui: ok');
