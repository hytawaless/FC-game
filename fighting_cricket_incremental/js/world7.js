/* world7 · 熵之界：升级等级随时间衰减，需维修或丢弃 */
(function (global) {
  'use strict';
  var DQ = global.__DQ__;
  var D = DQ.D;

  DQ.registerWorld(7, {
    makeState: function () { return { nextDecayAt: Date.now() + 300000 }; },
    compute: function (s, wd) {
      var world = DQ.getWorld(7);
      return DQ.worldIterCore(s, wd, world, D(1));
    },
    tick: function (s, wd, dt) {
      if (Date.now() >= wd.state.nextDecayAt) {
        for (var i = 0; i < wd.upgrades.length; i++) if ((wd.upgrades[i] || 0) > 0) wd.upgrades[i] -= 1;
        wd.state.nextDecayAt = Date.now() + 300000;
      }
    },
    action: function (s, wd, name, payload) {
      var world = DQ.getWorld(7);
      if (name === 'buyUpgrade') return DQ.worldBuyUpgrade(s, wd, world, payload.i);
      if (name === 'repair') {
        var cost = DQ.worldUpgradeCost(world, payload.i, wd.upgrades[payload.i] || 0).div(D(10));
        if (wd.resource.lt(cost)) return { ok: false };
        wd.resource = wd.resource.sub(cost);
        wd.upgrades[payload.i] = (wd.upgrades[payload.i] || 0) + 1;
        return { ok: true };
      }
      if (name === 'discard') {
        var lv = wd.upgrades[payload.i] || 0;
        if (lv <= 0) return { ok: false };
        wd.resource = wd.resource.add(D(10).pow(lv));
        wd.upgrades[payload.i] = 0;
        return { ok: true };
      }
      return { ok: false };
    },
    snapshot: function (s, wd) {
      return { decayIn: Math.max(0, Math.round((wd.state.nextDecayAt - Date.now()) / 1000)) };
    },
  });
})(window);
