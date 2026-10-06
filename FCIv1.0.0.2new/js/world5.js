/* world5 · 回溯之界：每 5 分钟强制回溯，清零升级但累积刻印 */
(function (global) {
  'use strict';
  var DQ = global.__DQ__;
  var D = DQ.D;

  DQ.registerWorld(5, {
    makeState: function () { return { imprints: 0, nextBacktrackAt: Date.now() + 300000 }; },
    compute: function (s, wd) {
      var world = DQ.getWorld(5);
      var factor = D(2).pow(wd.state.imprints);
      return DQ.worldIterCore(s, wd, world, factor);
    },
    tick: function (s, wd, dt) {
      if (Date.now() >= wd.state.nextBacktrackAt) {
        wd.state.imprints += 1;
        wd.resource = wd.resource.mul(D(0.1)); // 保留 10%
        for (var i = 0; i < wd.upgrades.length; i++) wd.upgrades[i] = 0; // 升级清零
        wd.state.nextBacktrackAt = Date.now() + 300000;
      }
    },
    action: function (s, wd, name, payload) {
      if (name === 'buyUpgrade') return DQ.worldBuyUpgrade(s, wd, DQ.getWorld(5), payload.i);
      return { ok: false };
    },
    snapshot: function (s, wd) {
      var remain = Math.max(0, Math.round((wd.state.nextBacktrackAt - Date.now()) / 1000));
      return { imprints: wd.state.imprints, remain: remain, echo: DQ.formatDecimal(wd.resource) };
    },
  });
})(window);
