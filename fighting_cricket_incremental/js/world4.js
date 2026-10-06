/* world4 · 共振之界：5 个滑块追逐漂移的目标频率，越接近产出越高 */
(function (global) {
  'use strict';
  var DQ = global.__DQ__;
  var D = DQ.D;

  function drift() { return Math.max(0, Math.min(100, Math.round(Math.random() * 100))); }

  DQ.registerWorld(4, {
    makeState: function () {
      return { sliders: [50, 50, 50, 50, 50], targets: [30, 60, 40, 70, 50], nextDriftAt: Date.now() + 25000 };
    },
    compute: function (s, wd) {
      var world = DQ.getWorld(4);
      var st = wd.state;
      var sum = 0, perfect = true;
      for (var i = 0; i < 5; i++) {
        var d = Math.abs(st.sliders[i] - st.targets[i]);
        sum += 1 - d / 50;
        if (d > 5) perfect = false;
      }
      var match = Math.max(0.05, sum / 5);
      var factor = D(match);
      if (perfect) factor = factor.mul(5); // 和声奖励
      return DQ.worldIterCore(s, wd, world, factor);
    },
    tick: function (s, wd, dt) {
      var st = wd.state;
      if (Date.now() >= st.nextDriftAt) {
        for (var i = 0; i < 5; i++) st.targets[i] = Math.max(0, Math.min(100, st.targets[i] + (Math.random() * 20 - 10)));
        st.nextDriftAt = Date.now() + 20000 + Math.random() * 20000;
      }
    },
    action: function (s, wd, name, payload) {
      if (name === 'buyUpgrade') return DQ.worldBuyUpgrade(s, wd, DQ.getWorld(4), payload.i);
      if (name === 'setSlider') {
        wd.state.sliders[payload.i] = Math.max(0, Math.min(100, Number(payload.v)));
        return { ok: true };
      }
      return { ok: false };
    },
    snapshot: function (s, wd) {
      var st = wd.state, sum = 0;
      for (var i = 0; i < 5; i++) sum += 1 - Math.abs(st.sliders[i] - st.targets[i]) / 50;
      return { sliders: st.sliders.slice(), targets: st.targets.slice(), match: Math.round(Math.max(0, sum / 5) * 100) };
    },
  });
})(window);
