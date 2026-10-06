/* world3 · 负重之界：资源有“质量”，越多越慢，卸载换惯性 */
(function (global) {
  'use strict';
  var DQ = global.__DQ__;
  var D = DQ.D;
  var THRESHOLD = D('1e60');

  DQ.registerWorld(3, {
    makeState: function () { return { momentum: '0' }; },
    compute: function (s, wd) {
      var world = DQ.getWorld(3);
      var load = wd.resource;
      var momentum = D(wd.state.momentum || '0');
      var speed = D(1).div(D(1).add(load.div(THRESHOLD)));
      var factor = D(1).add(momentum).mul(speed);
      return DQ.worldIterCore(s, wd, world, factor);
    },
    tick: null,
    action: function (s, wd, name, payload) {
      if (name === 'buyUpgrade') return DQ.worldBuyUpgrade(s, wd, DQ.getWorld(3), payload.i);
      if (name === 'discard') {
        var momentum = D(wd.state.momentum || '0');
        var gain = wd.resource.mul(D(0.01)); // 卸载：资源换惯性
        wd.state.momentum = momentum.add(gain).toString();
        wd.resource = D(0);
        return { ok: true };
      }
      return { ok: false };
    },
    snapshot: function (s, wd) {
      var load = wd.resource;
      var momentum = D(wd.state.momentum || '0');
      var speed = D(1).div(D(1).add(load.div(THRESHOLD)));
      return { load: DQ.formatDecimal(load), momentum: DQ.formatDecimal(momentum), speed: DQ.formatDecimal(speed) };
    },
  });
})(window);
