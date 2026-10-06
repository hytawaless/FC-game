/* =========================================================================
 * worlds.js —— 第四阶段 world 注册表与共享框架
 * 斗蛐蛐增量 v1.0.0.2
 * ======================================================================= */
(function (global) {
  'use strict';

  var DQ = (global.__DQ__ = global.__DQ__ || {});
  var Decimal = global.Decimal;
  var D = DQ.D;

  DQ.worlds = {};

  DQ.registerWorld = function (id, mod) { DQ.worlds[id] = mod; };

  /* 初始化某个 world 的 state（makeState 之前未在游戏中被调用，导致空 state 崩溃） */
  DQ.initWorldState = function (s, worldId) {
    var mod = DQ.worlds[worldId];
    var wd = s.stage4.worlds[worldId];
    if (mod && mod.makeState && wd && (!wd.state || Object.keys(wd.state).length === 0)) {
      wd.state = mod.makeState();
    }
  };
  DQ.initAllWorldStates = function (s) {
    for (var w = 3; w <= 9; w++) DQ.initWorldState(s, w);
  };

  /* 迭代核心：资源 × log10(资源) × 0.02，保证各 world 目标可达 */
  DQ.worldIterCore = function (s, wd, world, factor) {
    var S = wd.resource;
    var auto = D(0);
    if (S.gt(D(0))) {
      var L1 = S.log10();
      auto = auto.add(S.mul(L1).mul(D(0.02)));
      if (L1.gt(D(1))) auto = auto.add(S.mul(L1).mul(L1.log10()).mul(D(0.0005)));
    }
    var ups = DQ.buildWorldUpgrades(world);
    var mult = D(1);
    for (var i = 0; i < ups.length; i++) {
      var lv = wd.upgrades[i] || 0;
      if (lv <= 0) continue;
      var r = ups[i].role;
      if (r === 'mult') mult = mult.mul(D(1e3).pow(lv));
      else if (r === 'core') mult = mult.mul(D(1e4).pow(lv));
      else if (r === 'iter') mult = mult.mul(D(2).pow(lv));
    }
    for (var c = 0; c < (wd.challenges || []).length; c++) if (wd.challenges[c] && wd.challenges[c].done) mult = mult.mul(D(10));
    for (var b = 0; b < (wd.blocks || []).length; b++) if (!(wd.blocks[b] && wd.blocks[b].bypassed)) mult = mult.div(D(10));
    if (s && s.challengeActive && s.challengeActive.world === world.id) mult = mult.mul(D(0.5));
    return auto.mul(mult).mul(factor || D(1));
  };

  /* 通用升级购买 */
  DQ.worldBuyUpgrade = function (s, wd, world, i) {
    var ups = DQ.buildWorldUpgrades(world);
    if (i < 0 || i >= ups.length) return { ok: false };
    var max = DQ.worldUpgradeMaxLevel(ups[i].role);
    var lv = wd.upgrades[i] || 0;
    if (lv >= max) return { ok: false };
    var cost = DQ.worldUpgradeCost(world, i, lv);
    if (wd.resource.lt(cost)) return { ok: false };
    wd.resource = wd.resource.sub(cost);
    wd.upgrades[i] = lv + 1;
    return { ok: true };
  };

  /* 默认：仅买升级的世界（供简单 world 复用） */
  DQ.makeSimpleWorld = function (defaultState) {
    return {
      makeState: function () { return defaultState || {}; },
      compute: function (s, wd) { return DQ.worldIterCore(s, wd, DQ.getWorld(s.stage4.world), D(1)); },
      tick: null,
      action: function (s, wd, name, payload) {
        if (name === 'buyUpgrade') return DQ.worldBuyUpgrade(s, wd, DQ.getWorld(s.stage4.world), payload.i);
        return { ok: false };
      },
    };
  };
})(window);
