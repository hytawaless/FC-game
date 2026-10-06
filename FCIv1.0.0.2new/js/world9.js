/* world9 · 概念之界：命名才生效，最终命名世界本身 */
(function (global) {
  'use strict';
  var DQ = global.__DQ__;
  var D = DQ.D;

  DQ.registerWorld(9, {
    makeState: function () { return { named: [] }; },
    compute: function (s, wd) {
      var world = DQ.getWorld(9);
      var ups = DQ.buildWorldUpgrades(world);
      var mult = D(1);
      var namedCount = 0;
      for (var i = 0; i < ups.length; i++) {
        if (wd.state.named[i]) { mult = mult.mul(D(10)); namedCount++; }
      }
      var factor = D(1).add(D(namedCount).mul(D(0.5)));
      return DQ.worldIterCore(s, wd, world, factor.mul(mult.div(D(10))));
    },
    tick: null,
    action: function (s, wd, name, payload) {
      if (name === 'buyUpgrade') return DQ.worldBuyUpgrade(s, wd, DQ.getWorld(9), payload.i);
      if (name === 'name') {
        var i = payload.i;
        var ups = DQ.buildWorldUpgrades(DQ.getWorld(9));
        if (i < 0 || i >= ups.length || wd.state.named[i]) return { ok: false };
        var count = wd.state.named.filter(Boolean).length;
        var cost = D(10).mul(D(10).pow(count));
        if (wd.resource.lt(cost)) return { ok: false };
        wd.resource = wd.resource.sub(cost);
        wd.state.named[i] = true;
        return { ok: true };
      }
      if (name === 'nameWorld') {
        var ups2 = DQ.buildWorldUpgrades(DQ.getWorld(9));
        var all = wd.state.named.length >= ups2.length && wd.state.named.every(Boolean);
        if (!all) return { ok: false };
        var cost = D(10).pow(D(6));
        if (wd.resource.lt(cost)) return { ok: false };
        wd.resource = wd.resource.sub(cost);
        wd.resource = D(DQ.getWorld(9).target); // 通关
        return { ok: true };
      }
      return { ok: false };
    },
    snapshot: function (s, wd) {
      var ups = DQ.buildWorldUpgrades(DQ.getWorld(9));
      var count = wd.state.named.filter(Boolean).length;
      return { named: wd.state.named.slice(), namedCount: count, total: ups.length, nameCost: DQ.formatDecimal(D(10).mul(D(10).pow(Math.max(0, count - 1)))) };
    },
  });
})(window);
