/* world8 · 观测之界：只有被聚焦的面板才会生产 */
(function (global) {
  'use strict';
  var DQ = global.__DQ__;
  var D = DQ.D;

  var PANELS = [
    { name: 'α 面板', rate: 1.0 },
    { name: 'β 面板', rate: 1.6 },
    { name: 'γ 面板', rate: 0.7 },
    { name: 'δ 面板', rate: 1.3 },
  ];

  DQ.registerWorld(8, {
    makeState: function () { return { focus: 0 }; },
    compute: function (s, wd) {
      var world = DQ.getWorld(8);
      var rate = PANELS[wd.state.focus].rate;
      return DQ.worldIterCore(s, wd, world, D(rate));
    },
    tick: null,
    action: function (s, wd, name, payload) {
      if (name === 'buyUpgrade') return DQ.worldBuyUpgrade(s, wd, DQ.getWorld(8), payload.i);
      if (name === 'focus') { wd.state.focus = Math.max(0, Math.min(PANELS.length - 1, Number(payload.i))); return { ok: true }; }
      return { ok: false };
    },
    snapshot: function (s, wd) {
      return { focus: wd.state.focus, panels: PANELS.map(function (p, i) { return { name: p.name, rate: p.rate, focused: i === wd.state.focus }; }) };
    },
  });
})(window);
