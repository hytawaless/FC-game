/* world6 · 镜像之界：左右此消彼长，越接近 50/50 产出越高 */
(function (global) {
  'use strict';
  var DQ = global.__DQ__;
  var D = DQ.D;

  DQ.registerWorld(6, {
    makeState: function () { return { left: 50 }; }, // 右值 = 100 - left
    compute: function (s, wd) {
      var world = DQ.getWorld(6);
      var left = wd.state.left, right = 100 - left;
      var balance = (left * right) / 2500; // 50×50=2500 最大
      return DQ.worldIterCore(s, wd, world, D(Math.max(0.05, balance)));
    },
    tick: null,
    action: function (s, wd, name, payload) {
      if (name === 'buyUpgrade') return DQ.worldBuyUpgrade(s, wd, DQ.getWorld(6), payload.i);
      if (name === 'bias') {
        wd.state.left = Math.max(1, Math.min(99, wd.state.left + (payload.dir > 0 ? 2 : -2)));
        return { ok: true };
      }
      return { ok: false };
    },
    snapshot: function (s, wd) {
      var left = wd.state.left, right = 100 - left;
      return { left: left, right: right, balance: Math.round((left * right) / 2500 * 100) };
    },
  });
})(window);
