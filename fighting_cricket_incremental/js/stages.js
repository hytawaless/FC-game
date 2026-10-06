/* =========================================================================
 * stages.js —— 五阶段状态机、数值、力量基准、渡劫/复活赛
 * 斗蛐蛐增量 v1.0.0.2
 * ======================================================================= */
(function (global) {
  'use strict';

  var DQ = (global.__DQ__ = global.__DQ__ || {});
  var Decimal = global.Decimal;
  var D = DQ.D;

  DQ.STAGE_NAMES = ['第零阶段 · 幻梦创世', '第一阶段 · 建群时节', '第二阶段 · 数值阶段', '第三阶段 · 软上限界', '第四阶段 · world 嵌套', '第五阶段 · 前时代'];

  function finiteMeta(s) {
    var m = s.metaValue;
    if (Decimal.isNaN(m) || Decimal.isInfinity(m)) return D(1e308);
    return m;
  }

  /* ------------------------- 力量基准 ------------------------- */
  DQ.pbBonus = function (s) { return D(1).add(s.powerBaseline.mul(D(0.005))); };
  DQ.applyPBGrowth = function (s, dt) {
    if (s.stage < 3) return;
    s.powerBaseline = s.powerBaseline.add(D(0.0001).mul(dt)); // 每 10 秒 +0.001
    if (s.stage === 5) s.powerBaseline = s.powerBaseline.add(D(0.05).mul(dt / 600)); // 每 10 分钟 +0.05
    else s.powerBaseline = s.powerBaseline.add(D(0.01).mul(dt / 300));               // 每 5 分钟 +0.01
  };

  /* ------------------------- 第二阶段收益 ------------------------- */
  DQ.computeStage2Rates = function (s) {
    var u = s.upgrades;
    var meta = finiteMeta(s);
    var clickPre = D(1).add(D(2).mul(u[0])).mul(D(1.5).pow(u[2]));
    var auto = D(u[1]).mul(D(0.5)).mul(D(1.5).pow(u[2]));
    auto = auto.add(clickPre.mul(D(0.5)).mul(u[3]));
    auto = auto.add(meta.mul(D(0.01)).mul(u[5]));
    var cosmic = D(2).pow(u[4]);
    var click = clickPre.mul(cosmic);
    auto = auto.mul(cosmic);
    if (u[6] >= 1) { click = meta.mul(D(0.1)); auto = meta.pow(D(0.9)).add(meta.mul(D(0.05))); }
    return { click: click, auto: auto };
  };

  /* ------------------------- 第三阶段 ------------------------- */
  DQ.stage3Mult = function (s) {
    var clickMult = D(1), autoMult = D(1), globalMult = D(1);
    for (var i = 0; i < 10; i++) if (s.stage3.upgrades[i] >= 1) {
      var u = DQ.STAGE3_UPGRADES[i];
      clickMult = clickMult.mul(D(u.clickMult));
      autoMult = autoMult.mul(D(u.autoMult));
      globalMult = globalMult.mul(D(u.globalMult));
    }
    return { clickMult: clickMult, autoMult: autoMult, globalMult: globalMult };
  };
  DQ.currentSoftcap = function (s) { return s.stage3.softcapIndex < 10 ? DQ.stage3Softcap(s.stage3.softcapIndex) : null; };
  DQ.softcapFactor = function (s) {
    var cap = DQ.currentSoftcap(s);
    if (!cap) return D(1);
    var dist = cap.sub(finiteMeta(s).log10());
    if (dist.gte(D(1))) return D(1);
    if (dist.lte(D(0))) return D(0.3);
    return D(0.3).add(dist.mul(D(0.7))); // 线性压制，最低 30%
  };
  DQ.computeStage3Rates = function (s) {
    var r2 = DQ.computeStage2Rates(s);
    var m = DQ.stage3Mult(s);
    var factor = DQ.softcapFactor(s).mul(DQ.pbBonus(s));
    var meta = finiteMeta(s);
    var riftG = (DQ.riftGlobalMult && s.meta.stageProgress) ? DQ.riftGlobalMult(s) : D(1);
    var riftA = (DQ.riftAutoMult && s.meta.stageProgress) ? DQ.riftAutoMult(s) : D(1);
    var click = r2.click.mul(m.clickMult).mul(m.globalMult).mul(riftG).mul(factor);
    var auto = r2.auto.mul(m.autoMult).mul(m.globalMult).mul(riftA);
    var dpDrive = D(0.03).mul(m.globalMult);
    auto = auto.add(meta.mul(meta.log10()).mul(dpDrive));
    auto = auto.mul(factor);
    return { click: click, auto: auto };
  };

  /* ------------------------- 固定步长更新 ------------------------- */
  DQ.update = function (s, dt) {
    if (s.stage4.frozen) return;
    if (s.pendingStory) return;
    s.stats.playTimeMs += dt * 1000;
    if (s.stage >= 1) s.dreamPower += dt * 0.2; // 幻梦之力作为世界观象征持续缓慢增长

    // 裂隙副本推进
    if (s.riftActive && DQ.riftTick) DQ.riftTick(s, dt);

    if (s.stage === 0) {
      if (s.introSeen) { s.dreamPower += dt * 1; if (s.dreamPower >= 100) { s.dreamPower = 100; s.pendingStory = 'trans1'; } }
    } else if (s.stage === 1) {
      if (s.primalHeart >= 100) { s.primalHeart = 100; s.pendingStory = 'trans2'; }
    } else if (s.stage === 2) {
      if (Decimal.isInfinity(s.metaValue) || s.metaValue.gte(D(1e308))) { s.metaValue = Decimal.dInf; s.pendingStory = 'trans3'; }
      else s.metaValue = s.metaValue.add(DQ.computeStage2Rates(s).auto.mul(dt));
    } else if (s.stage === 3) {
      DQ.applyPBGrowth(s, dt);
      s.metaValue = s.metaValue.add(DQ.computeStage3Rates(s).auto.mul(dt));
      var cap = DQ.currentSoftcap(s);
      if (cap && s.metaValue.gt(D(10).pow(cap))) s.metaValue = D(10).pow(cap);
      s.stage3.divergencePower = s.metaValue.log10();
    } else if (s.stage === 4) {
      DQ.applyPBGrowth(s, dt);
      var mod = DQ.worlds[s.stage4.world];
      var wd = s.stage4.worlds[s.stage4.world];
      if (mod) {
        if (mod.tick) mod.tick(s, wd, dt);
        var rate = mod.compute ? mod.compute(s, wd) : D(0);
        wd.resource = wd.resource.add(rate.mul(dt));
        var world = DQ.getWorld(s.stage4.world);
        var target = D(world.target);
        if (wd.resource.gte(target) && !wd.cleared) {
          wd.resource = target; wd.cleared = true;
          s.powerBaseline = s.powerBaseline.add(D(1));
          s.pendingStory = 'worldClear' + world.id;
        }
      }
    } else if (s.stage === 5) {
      DQ.applyPBGrowth(s, dt);
      if (s.tribulation) DQ.tribulationTick(s, dt);
      else if (s.revival) DQ.revivalTick(s, dt);
    }

    if (s.stage > s.meta.stageReached) s.meta.stageReached = s.stage;
  };

  /* ------------------------- 点击 ------------------------- */
  DQ.clickMultiplier = function (s) {
    if (s.quickClick.multUntil > Date.now()) return D(2);
    return D(1);
  };
  DQ.clickSuccessor = function (s) {
    if (s.stage4.frozen || (s.stage !== 2 && s.stage !== 3)) return D(0);
    var rates = s.stage === 2 ? DQ.computeStage2Rates(s) : DQ.computeStage3Rates(s);
    var gain = rates.click.mul(DQ.clickMultiplier(s));
    s.metaValue = s.metaValue.add(gain);
    s.stats.totalClicks += 1;
    // 快速点击连击：10 次内触发 ×2
    var now = Date.now();
    if (now < s.quickClick.multUntil) s.quickClick.count = 0;
    else {
      s.quickClick.count += 1;
      if (s.quickClick.count >= 10) { s.quickClick.multUntil = now + 5000; s.quickClick.count = 0; }
    }
    if (s.stage === 3) { var cap = DQ.currentSoftcap(s); if (cap && s.metaValue.gt(D(10).pow(cap))) s.metaValue = D(10).pow(cap); s.stage3.divergencePower = s.metaValue.log10(); }
    if (s.stage === 2 && (Decimal.isInfinity(s.metaValue) || s.metaValue.gte(D(1e308)))) { s.metaValue = Decimal.dInf; s.pendingStory = 'trans3'; }
    return gain;
  };
  DQ.clickBubble = function (s) {
    if (s.stage !== 1 || s.stage4.frozen) return;
    s.primalHeart = Math.min(100, s.primalHeart + 5);
    s.stats.totalClicks += 1;
    s.bubble.active = false; s.bubble.exitAt = 0;
    s.bubble.nextSpawnAt = Date.now() + 500 + Math.random() * 1500;
    if (s.primalHeart >= 100) { s.primalHeart = 100; s.pendingStory = 'trans2'; }
  };

  /* ------------------------- 购买 ------------------------- */
  DQ.buyStage2Upgrade = function (s, i) {
    var def = DQ.STAGE2_UPGRADES[i];
    if (!def || s.stage4.frozen || s.stage !== 2) return { ok: false };
    if (s.upgrades[i] >= def.maxLevel || s.metaValue.lt(def.cost(s.upgrades[i]))) return { ok: false };
    s.metaValue = s.metaValue.sub(def.cost(s.upgrades[i]));
    s.upgrades[i] += 1;
    if (i === 7) { s.metaValue = Decimal.dInf; s.pendingStory = 'trans3'; }
    return { ok: true };
  };
  DQ.buyStage3Upgrade = function (s, i) {
    if (s.stage !== 3 || s.stage4.frozen || i !== s.stage3.softcapIndex || s.stage3.upgrades[i] >= 1) return { ok: false };
    var cost = DQ.stage3Cost(i);
    if (s.metaValue.lt(cost)) return { ok: false };
    s.metaValue = s.metaValue.sub(cost);
    s.stage3.upgrades[i] = 1;
    s.stage3.softcapIndex += 1;
    s.stage3.softcapsBroken += 1;
    // 破限脉冲：获得新上限 10% 的元数值
    if (s.stage3.softcapIndex < 10) {
      var newCap = DQ.stage3Softcap(s.stage3.softcapIndex);
      s.metaValue = s.metaValue.add(D(10).pow(newCap.sub(1)));
    }
    s.powerBaseline = s.powerBaseline.add(D(0.05)); // 每破限 +0.05 PB
    s.stage3.divergencePower = s.metaValue.log10();
    var st = DQ.STAGE3_UPGRADES[i].story;
    if (st) s.pendingStory = st;
    return { ok: true };
  };

  /* ------------------------- 第四阶段购买/挑战/阻碍（派发给 world 模块） ------------------------- */
  DQ.buyWorldUpgrade = function (s, i) {
    if (s.stage !== 4 || s.stage4.frozen) return { ok: false };
    var mod = DQ.worlds[s.stage4.world];
    if (mod && mod.action) return mod.action(s, s.stage4.worlds[s.stage4.world], 'buyUpgrade', { i: i });
    return { ok: false };
  };
  DQ.enterChallenge = function (s, i) {
    if (s.stage !== 4 || s.stage4.frozen) return { ok: false };
    var wd = s.stage4.worlds[s.stage4.world];
    var done = !!(wd.challenges[i] && wd.challenges[i].done);
    if (done) return { ok: false };
    s.challengeActive = { world: s.stage4.world, index: i };
    return { ok: true };
  };
  DQ.exitChallenge = function (s) { s.challengeActive = null; };
  DQ.checkChallenge = function (s) {
    if (!s.challengeActive) return;
    if (s.challengeActive.world !== s.stage4.world) { s.challengeActive = null; return; }
    var world = DQ.getWorld(s.stage4.world);
    var wd = s.stage4.worlds[s.stage4.world];
    var target = D(world.target);
    var fracs = [0.5, 0.9, 1.0];
    var i = s.challengeActive.index;
    var goal = D(10).pow(target.log10().mul(fracs[i % fracs.length]));
    if (wd.resource.gte(goal)) {
      wd.challenges[i] = { done: true };
      s.powerBaseline = s.powerBaseline.add(D(0.1)); // 完成挑战 +0.1 PB
      s.challengeActive = null;
    }
  };
  DQ.bypassUnbreakable = function (s, i) {
    if (s.stage !== 4 || s.stage4.frozen) return { ok: false };
    var wd = s.stage4.worlds[s.stage4.world];
    if (!wd.blocks) return { ok: false };
    var already = !!(wd.blocks[i] && wd.blocks[i].bypassed);
    if (already) return { ok: false };
    var world = DQ.getWorld(s.stage4.world);
    var cost = D(10).pow(D(world.target).log10().mul(D(0.25)));
    if (wd.resource.lt(cost)) return { ok: false };
    wd.resource = wd.resource.sub(cost);
    wd.blocks[i] = { bypassed: true };
    return { ok: true };
  };

  /* ------------------------- 破界 / 冻结 / 第五阶段 ------------------------- */
  DQ.breakWorldWill = function (s) {
    if (s.stage !== 3 || !(s.stage3.storyFlags.D && s.stage3.softcapsBroken >= 10)) return { ok: false };
    s.stage3.worldWillBroken = true;
    s.pendingStory = 'stage4intro';
    return { ok: true };
  };
  DQ.freezeSave = function (s) {
    if (s.stage4.frozen) return { ok: true };
    s.stage4.frozen = true; s.stage4.frozenAt = Date.now();
    return { ok: true };
  };
  DQ.unfreezeSave = function (s) { s.stage4.frozen = false; };
  DQ.enterStage5 = function (s) {
    if (s.stage !== 4 || !s.stage4.worlds[9].cleared) return { ok: false };
    s.pendingStory = 'stage5intro';
    return { ok: true };
  };
  DQ.cultivate = function (s) {
    if (s.stage !== 5 || s.stage4.frozen) return { ok: false };
    var cost = D(10).pow(D(2).add(s.stage5.tribulationAttempts));
    if (s.metaValue.lt(cost)) return { ok: false };
    s.metaValue = s.metaValue.sub(cost);
    s.powerBaseline = s.powerBaseline.add(D(0.1));
    return { ok: true };
  };

  /* ------------------------- 渡劫 / 复活赛 ------------------------- */
  DQ.tribulationWinRate = function (s) {
    return Math.min(0.95, 0.35 + (s.powerBaseline.toNumber() - 16) * 0.03);
  };
  DQ.startTribulation = function (s) {
    if (s.stage !== 5) return { ok: false };
    if (s.powerBaseline.lt(D(16))) return { ok: false, needPB: true };
    if (s.tribulation || s.revival) return { ok: false };
    s.stage5.tribulationAttempts += 1;
    s.tribulation = { round: 1, phase: 'anim', startAt: Date.now(), wins: 0 };
    return { ok: true };
  };
  DQ.tribulationTick = function (s, dt) {
    var t = s.tribulation;
    if (!t) return;
    if (t.phase === 'anim') {
      if (Date.now() - t.startAt >= 2500) { t.phase = 'result'; t.startAt = Date.now(); }
      return;
    }
    // result 阶段：判定胜负
    var win = Math.random() < DQ.tribulationWinRate(s);
    if (win) {
      t.wins += 1;
      if (t.wins >= 3) {
        s.tribulation = null;
        s.stage5.ascended = true;
        s.pendingStory = 'ascend';
      } else { t.round += 1; t.phase = 'anim'; t.startAt = Date.now(); }
    } else {
      s.stage5.tribulationFails += 1;
      s.powerBaseline = s.powerBaseline.add(D(0.02).add(D(0.005).mul(s.stage5.tribulationFails)));
      s.tribulation = null;
      DQ.startRevival(s);
    }
  };
  DQ.startRevival = function (s) {
    var opp = s.powerBaseline.mul(D(0.9).add(D(0.2).mul(Math.random())));
    s.revival = { round: 1, phase: 'anim', startAt: Date.now(), wins: 0, losses: 0, opponentPB: opp };
  };
  DQ.revivalWinRate = function (s) {
    var r = s.revival; if (!r) return 0.5;
    var diff = s.powerBaseline.sub(r.opponentPB).toNumber();
    return Math.max(0.4, Math.min(0.9, 0.65 + diff * 0.02));
  };
  DQ.revivalTick = function (s, dt) {
    var r = s.revival;
    if (!r) return;
    if (r.phase === 'anim') {
      if (Date.now() - r.startAt >= 2000) { r.phase = 'result'; r.startAt = Date.now(); }
      return;
    }
    var win = Math.random() < DQ.revivalWinRate(s);
    if (win) { r.wins += 1; s.stage5.revivalWins += 1; } else { r.losses += 1; s.stage5.revivalLosses += 1; }
    s.powerBaseline = s.powerBaseline.add(D(0.02));
    if (r.wins >= 2 || r.losses >= 2 || r.round >= 3) { s.revival = null; return; }
    r.round += 1; r.phase = 'anim'; r.startAt = Date.now();
  };

  /* ------------------------- 剧情 ------------------------- */
  function addSeen(s, id) { if (s.story.seenNodes.indexOf(id) === -1) s.story.seenNodes.push(id); }
  DQ.completeStory = function (s) {
    var id = s.pendingStory;
    if (!id) return;
    s.story.storyUnlocked[id] = true;
    addSeen(s, id);
    s.pendingStory = null;
    switch (id) {
      case 'intro': s.introSeen = true; break;
      case 'trans1': s.stage = 1; s.dreamPower = 100; break;
      case 'trans2': s.stage = 2; s.primalHeart = 100; s.metaValue = D(5); break; // 启动资金
      case 'trans3':
        s.stage = 3; s.metaValue = D(10).pow(D(308.25)); s.stage3.divergencePower = D(308.25);
        s.stage3.softcapIndex = 0; s.stage3.softcapsBroken = 0; s.pendingStory = 'stage3intro'; break;
      case 'stage3intro': break;
      case 'A': s.stage3.storyFlags.A = true; break;
      case 'B': s.stage3.storyFlags.B = true; break;
      case 'C': s.stage3.storyFlags.C = true; break;
      case 'D': s.stage3.storyFlags.D = true; break;
      case 'stage4intro': s.stage = 4; s.stage4.world = 3; s.pendingStory = 'worldEnter3'; break;
      case 'stage5intro': s.stage = 5; s.stage5.entered = true; break;
      case 'ascend': break;
      case 'dragon': break;
      default:
        if (id.indexOf('worldClear') === 0) {
          var wc = parseInt(id.slice('worldClear'.length), 10);
          s.stage4.worlds[wc].cleared = true;
          if (wc >= 9) s.pendingStory = 'dragon';
          else { s.stage4.world = wc + 1; s.pendingStory = 'worldEnter' + (wc + 1); }
        }
        break;
    }
    if (s.stage > s.meta.stageReached) s.meta.stageReached = s.stage;
  };

  /* ------------------------- 泡泡 ------------------------- */
  DQ.updateBubble = function (s, now) {
    var b = s.bubble;
    if (s.stage !== 1 || s.stage4.frozen || s.pendingStory) { if (b.active) { b.active = false; b.exitAt = 0; } return; }
    if (!b.active) {
      if (now >= b.nextSpawnAt) {
        b.active = true; b.x = 0.08 + Math.random() * 0.84; b.y = 0.10 + Math.random() * 0.78;
        b.bornAt = now; b.expiresAt = now + 3000 + Math.random() * 3000; b.exitAt = 0;
      }
      return;
    }
    if (b.exitAt > 0) { if (now >= b.exitAt) { b.active = false; b.exitAt = 0; b.nextSpawnAt = now + 500 + Math.random() * 1500; } return; }
    if (now >= b.expiresAt) b.exitAt = now + 350;
  };

  /* ------------------------- 离线收益 ------------------------- */
  DQ.offlineProduce = function (s, seconds) {
    var beforeMeta = s.metaValue.toString();
    var beforeDream = s.dreamPower;
    var beforeSing = s.stage4.worlds[s.stage4.world] ? s.stage4.worlds[s.stage4.world].resource.toString() : '0';
    var steps = Math.min(Math.floor(seconds), 7200);
    for (var i = 0; i < steps; i++) {
      if (s.pendingStory) break;
      if (s.stage === 0) { if (s.introSeen) { s.dreamPower = Math.min(100, s.dreamPower + 1); if (s.dreamPower >= 100) break; } else break; }
      else if (s.stage === 2) {
        if (s.metaValue.gte(D(1e308)) || Decimal.isInfinity(s.metaValue)) { s.metaValue = D(1e308); break; }
        s.metaValue = s.metaValue.add(DQ.computeStage2Rates(s).auto);
        if (s.metaValue.gte(D(1e308))) s.metaValue = D(1e308);
      } else if (s.stage === 3) {
        s.metaValue = s.metaValue.add(DQ.computeStage3Rates(s).auto);
        var cap = DQ.currentSoftcap(s); if (cap && s.metaValue.gt(D(10).pow(cap))) s.metaValue = D(10).pow(cap);
        s.stage3.divergencePower = s.metaValue.log10();
      } else if (s.stage === 4) {
        var mod = DQ.worlds[s.stage4.world]; var wd = s.stage4.worlds[s.stage4.world];
        if (mod && mod.compute) {
          wd.resource = wd.resource.add(mod.compute(s, wd));
          var target = D(DQ.getWorld(s.stage4.world).target);
          if (wd.resource.gte(target)) { wd.resource = target; break; }
        }
      }
    }
    return {
      seconds: steps,
      dreamGain: s.dreamPower - beforeDream,
      metaGain: DQ.formatDecimal(D(s.metaValue).sub(D(beforeMeta)).max(D(0))),
      singularityGain: DQ.formatDecimal(D(s.stage4.worlds[s.stage4.world] ? s.stage4.worlds[s.stage4.world].resource : '0').sub(D(beforeSing)).max(D(0))),
    };
  };
})(window);
