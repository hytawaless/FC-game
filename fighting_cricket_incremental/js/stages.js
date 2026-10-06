/* =========================================================================
 * stages.js —— 四阶段状态机与数值逻辑（全部使用 Decimal）
 * 斗蛐蛐增量 v1.0.0.1
 * ======================================================================= */
(function (global) {
  'use strict';

  var DQ = (global.__DQ__ = global.__DQ__ || {});
  var Decimal = global.Decimal;
  var D = DQ.D;

  DQ.STAGE_NAMES = ['第零阶段 · 幻梦创世', '第一阶段 · 建群时节', '第二阶段 · 数值阶段', '第三阶段 · 软上限界', '第四阶段 · world 嵌套'];

  function finiteMeta(s) {
    var m = s.metaValue;
    if (Decimal.isNaN(m) || Decimal.isInfinity(m)) return D(1e308);
    return m;
  }

  /* ------------------------- 第二阶段收益 ------------------------- */
  DQ.computeStage2Rates = function (s) {
    var u = s.upgrades;
    var meta = finiteMeta(s);

    var clickPre = D(1).add(u[0]).mul(D(1.5).pow(u[2]));
    var auto = D(u[1]).mul(D(0.5)).mul(D(1.5).pow(u[2]));
    auto = auto.add(clickPre.mul(D(0.5)).mul(u[3]));
    auto = auto.add(meta.mul(D(0.01)).mul(u[5]));
    var cosmic = D(2).pow(u[4]);
    var click = clickPre.mul(cosmic);
    auto = auto.mul(cosmic);
    if (u[6] >= 1) {
      click = meta.mul(D(0.1));
      auto = meta.pow(D(0.9)).add(meta.mul(D(0.05)));
    }
    return { click: click, auto: auto };
  };

  /* ------------------------- 第三阶段收益 ------------------------- */
  DQ.stage3Mult = function (s) {
    var clickMult = D(1), autoMult = D(1), globalMult = D(1);
    for (var i = 0; i < 10; i++) {
      if (s.stage3.upgrades[i] >= 1) {
        var u = DQ.STAGE3_UPGRADES[i];
        clickMult = clickMult.mul(D(u.clickMult));
        autoMult = autoMult.mul(D(u.autoMult));
        globalMult = globalMult.mul(D(u.globalMult));
      }
    }
    return { clickMult: clickMult, autoMult: autoMult, globalMult: globalMult };
  };

  DQ.currentSoftcap = function (s) {
    if (s.stage3.softcapIndex < 10) return DQ.stage3Softcap(s.stage3.softcapIndex);
    return null; // 无软上限
  };

  DQ.softcapFactor = function (s) {
    var cap = DQ.currentSoftcap(s);
    if (!cap) return D(1);
    var dp = finiteMeta(s).log10();
    var dist = cap.sub(dp);
    if (dist.lt(D(0.5))) return D(0.001);
    return D(1);
  };

  DQ.computeStage3Rates = function (s) {
    var r2 = DQ.computeStage2Rates(s);
    var m = DQ.stage3Mult(s);
    var factor = DQ.softcapFactor(s);
    var meta = finiteMeta(s);
    var click = r2.click.mul(m.clickMult).mul(m.globalMult).mul(factor);
    // 自动产出 = 第二阶段产出 × 倍率 + DP 指数驱动项（meta × log10(meta)）
    // 该驱动项让发散之力（log10 元数值）呈指数增长，从而能跨越逐级放大的软上限。
    var auto = r2.auto.mul(m.autoMult).mul(m.globalMult);
    var dpDrive = D(0.03).mul(m.globalMult);
    auto = auto.add(meta.mul(meta.log10()).mul(dpDrive));
    auto = auto.mul(factor);
    return { click: click, auto: auto };
  };

  /* ------------------------- 第四阶段收益 ------------------------- */
  DQ.computeWorldRates = function (s) {
    var world = DQ.getWorld(s.stage4.world);
    var lvls = s.stage4.upgrades[s.stage4.world] || [];
    var ups = DQ.buildWorldUpgrades(world);
    var S = s.stage4.singularity;

    var baseProd = D(0);
    var mult = D(1);
    var iterLvl = 0, iter2Lvl = 0;
    for (var i = 0; i < ups.length; i++) {
      var lv = lvls[i] || 0;
      if (lv <= 0) continue;
      var role = ups[i].role;
      if (role === 'base') baseProd = baseProd.add(D(10).pow(i).mul(lv));
      else if (role === 'mult') mult = mult.mul(D(1e3).pow(lv));
      else if (role === 'iter') iterLvl += lv;
      else if (role === 'iter2') iter2Lvl += lv;
      else if (role === 'core') mult = mult.mul(D(world.coreJump).pow(lv));
    }

    // 挑战奖励（已完成挑战永久 ×10）
    var ch = s.stage4.challenges[s.stage4.world] || [];
    for (var c = 0; c < ch.length; c++) {
      if (ch[c] && ch[c].done) mult = mult.mul(D(10));
    }
    // 无法破除软上限：未绕过时惩罚 ÷10
    var ub = s.stage4.unbreakable[s.stage4.world] || [];
    for (var u = 0; u < ub.length; u++) {
      if (!(ub[u] && ub[u].bypassed)) mult = mult.div(D(10));
    }
    // 挑战进行中惩罚
    if (s.challengeActive && s.challengeActive.world === s.stage4.world) {
      mult = mult.mul(D(0.5));
    }

    var auto = baseProd;
    if (S.gt(D(0))) {
      var L1 = S.log10();
      if (iterLvl > 0) auto = auto.add(S.mul(L1).mul(D(world.iterRate).mul(iterLvl)));
      if (iter2Lvl > 0 && L1.gt(D(1))) {
        var L2 = L1.log10();
        auto = auto.add(S.mul(L1).mul(L2).mul(D(world.iter2Rate).mul(iter2Lvl)));
      }
    }
    auto = auto.mul(mult);
    return { auto: auto };
  };

  /* ------------------------- 固定步长更新 ------------------------- */
  DQ.update = function (s, dt) {
    if (s.stage4.frozen) return;
    if (s.pendingStory) return; // 剧情期间暂停
    s.stats.playTimeMs += dt * 1000;

    if (s.stage === 0) {
      if (s.introSeen) {
        s.dreamPower += dt * 1;
        if (s.dreamPower >= 100) { s.dreamPower = 100; s.pendingStory = 'trans1'; }
      }
    } else if (s.stage === 1) {
      if (s.primalHeart >= 100) { s.primalHeart = 100; s.pendingStory = 'trans2'; }
    } else if (s.stage === 2) {
      if (Decimal.isInfinity(s.metaValue) || s.metaValue.gte(D(1e308))) {
        s.metaValue = Decimal.dInf;
        s.pendingStory = 'trans3';
      } else {
        var r2 = DQ.computeStage2Rates(s);
        s.metaValue = s.metaValue.add(r2.auto.mul(dt));
      }
    } else if (s.stage === 3) {
      var r3 = DQ.computeStage3Rates(s);
      s.metaValue = s.metaValue.add(r3.auto.mul(dt));
      // 软上限压制：超出部分被吃掉
      var cap = DQ.currentSoftcap(s);
      if (cap) {
        if (s.metaValue.gt(D(10).pow(cap))) s.metaValue = D(10).pow(cap);
      }
      s.stage3.divergencePower = s.metaValue.log10();
    } else if (s.stage === 4) {
      var world = DQ.getWorld(s.stage4.world);
      var target = D(world.target);
      var rw = DQ.computeWorldRates(s);
      s.stage4.singularity = s.stage4.singularity.add(rw.auto.mul(dt));
      if (s.stage4.singularity.gte(target) && !s.stage4.worldCleared[world.id]) {
        s.stage4.singularity = target;
        s.pendingStory = 'worldClear' + world.id;
      }
    }

    if (s.stage > s.meta.stageReached) s.meta.stageReached = s.stage;
  };

  /* ------------------------- 点击 ------------------------- */
  DQ.clickSuccessor = function (s) {
    if (s.stage4.frozen) return D(0);
    if (s.stage !== 2 && s.stage !== 3) return D(0);
    var rates = s.stage === 2 ? DQ.computeStage2Rates(s) : DQ.computeStage3Rates(s);
    s.metaValue = s.metaValue.add(rates.click);
    s.stats.totalClicks += 1;
    if (s.stage === 3) {
      var cap = DQ.currentSoftcap(s);
      if (cap && s.metaValue.gt(D(10).pow(cap))) s.metaValue = D(10).pow(cap);
      s.stage3.divergencePower = s.metaValue.log10();
    }
    if (s.stage === 2 && (Decimal.isInfinity(s.metaValue) || s.metaValue.gte(D(1e308)))) {
      s.metaValue = Decimal.dInf;
      s.pendingStory = 'trans3';
    }
    return rates.click;
  };

  DQ.clickBubble = function (s) {
    if (s.stage !== 1 || s.stage4.frozen) return;
    s.primalHeart = Math.min(100, s.primalHeart + 5);
    s.stats.totalClicks += 1;
    s.bubble.active = false;
    s.bubble.exitAt = 0;
    s.bubble.nextSpawnAt = Date.now() + 500 + Math.random() * 1500;
    if (s.primalHeart >= 100) { s.primalHeart = 100; s.pendingStory = 'trans2'; }
  };

  /* ------------------------- 购买 ------------------------- */
  DQ.buyStage2Upgrade = function (s, i) {
    var def = DQ.STAGE2_UPGRADES[i];
    if (!def || s.stage4.frozen) return { ok: false };
    if (s.stage !== 2) return { ok: false };
    if (s.upgrades[i] >= def.maxLevel) return { ok: false };
    if (s.metaValue.lt(def.cost(s.upgrades[i]))) return { ok: false };
    s.metaValue = s.metaValue.sub(def.cost(s.upgrades[i]));
    s.upgrades[i] += 1;
    if (i === 7) {
      s.metaValue = Decimal.dInf;
      s.pendingStory = 'trans3';
    }
    return { ok: true };
  };

  DQ.buyStage3Upgrade = function (s, i) {
    if (s.stage !== 3 || s.stage4.frozen) return { ok: false };
    if (i !== s.stage3.softcapIndex) return { ok: false }; // 必须按顺序
    if (s.stage3.upgrades[i] >= 1) return { ok: false };
    var cost = DQ.stage3Cost(i);
    if (s.metaValue.lt(cost)) return { ok: false };
    s.metaValue = s.metaValue.sub(cost);
    s.stage3.divergencePower = s.metaValue.log10();
    s.stage3.upgrades[i] = 1;
    s.stage3.softcapIndex += 1;
    s.stage3.softcapsBroken += 1;
    var st = DQ.STAGE3_UPGRADES[i].story;
    if (st) s.pendingStory = st;
    return { ok: true };
  };

  DQ.buyWorldUpgrade = function (s, i) {
    if (s.stage !== 4 || s.stage4.frozen) return { ok: false };
    var world = DQ.getWorld(s.stage4.world);
    var ups = DQ.buildWorldUpgrades(world);
    if (i < 0 || i >= ups.length) return { ok: false };
    var lvls = s.stage4.upgrades[s.stage4.world];
    var max = DQ.worldUpgradeMaxLevel(ups[i].role);
    if (lvls[i] >= max) return { ok: false };
    var cost = DQ.worldUpgradeCost(world, i, lvls[i]);
    if (s.stage4.singularity.lt(cost)) return { ok: false };
    s.stage4.singularity = s.stage4.singularity.sub(cost);
    lvls[i] += 1;
    return { ok: true };
  };

  DQ.bypassUnbreakable = function (s, i) {
    if (s.stage !== 4 || s.stage4.frozen) return { ok: false };
    var world = DQ.getWorld(s.stage4.world);
    var ub = s.stage4.unbreakable[s.stage4.world];
    if (!ub) return { ok: false };
    var already = !!(ub[i] && ub[i].bypassed);
    if (already) return { ok: false };
    var cost = D(10).pow(D(world.target).log10().mul(D(0.25))); // 绕过成本 = 目标值的 1/4（对数）
    if (s.stage4.singularity.lt(cost)) return { ok: false };
    s.stage4.singularity = s.stage4.singularity.sub(cost);
    ub[i] = { bypassed: true };
    return { ok: true };
  };

  /* ------------------------- 挑战 ------------------------- */
  DQ.enterChallenge = function (s, i) {
    if (s.stage !== 4 || s.stage4.frozen) return { ok: false };
    var ch = s.stage4.challenges[s.stage4.world];
    if (!ch) return { ok: false };
    var done = !!(ch[i] && ch[i].done);
    if (done) return { ok: false };
    s.challengeActive = { world: s.stage4.world, index: i };
    return { ok: true };
  };

  DQ.exitChallenge = function (s) {
    s.challengeActive = null;
  };

  /* 挑战完成判定（在 update 中调用） */
  DQ.checkChallenge = function (s) {
    if (!s.challengeActive) return;
    if (s.challengeActive.world !== s.stage4.world) { s.challengeActive = null; return; }
    var world = DQ.getWorld(s.stage4.world);
    var target = D(world.target);
    var fracs = [0.5, 0.9, 1.0];
    var i = s.challengeActive.index;
    var frac = fracs[i % fracs.length];
    var goal = D(10).pow(target.log10().mul(frac));
    if (s.stage4.singularity.gte(goal)) {
      s.stage4.challenges[s.stage4.world][i] = { done: true };
      s.challengeActive = null;
    }
  };

  /* ------------------------- 破界 / 冻结 ------------------------- */
  DQ.breakWorldWill = function (s) {
    if (s.stage !== 3) return { ok: false };
    if (!(s.stage3.storyFlags.D && s.stage3.softcapsBroken >= 10)) return { ok: false };
    s.stage3.worldWillBroken = true;
    s.pendingStory = 'stage4intro';
    return { ok: true };
  };

  DQ.freezeSave = function (s) {
    if (s.stage !== 4 || !s.stage4.worldCleared[9]) return { ok: false };
    s.stage4.frozen = true;
    s.stage4.frozenAt = Date.now();
    return { ok: true };
  };

  DQ.unfreezeSave = function (s) {
    s.stage4.frozen = false;
  };

  /* ------------------------- 剧情 ------------------------- */
  DQ.getStory = function (id) {
    if (DQ.STORY[id]) return DQ.STORY[id];
    if (id.indexOf('worldEnter') === 0) {
      var wid = parseInt(id.slice('worldEnter'.length), 10);
      return DQ.worldEnterStory(DQ.getWorld(wid));
    }
    if (id.indexOf('worldClear') === 0) {
      var wid2 = parseInt(id.slice('worldClear'.length), 10);
      return DQ.worldClearStory(DQ.getWorld(wid2));
    }
    return { id: id, title: '', lines: [] };
  };

  function addSeen(s, id) {
    if (s.story.seenNodes.indexOf(id) === -1) s.story.seenNodes.push(id);
  }

  DQ.completeStory = function (s) {
    var id = s.pendingStory;
    if (!id) return;
    s.story.storyUnlocked[id] = true;
    addSeen(s, id);
    s.pendingStory = null;

    switch (id) {
      case 'intro': s.introSeen = true; break;
      case 'trans1': s.stage = 1; s.dreamPower = 100; break;
      case 'trans2': s.stage = 2; s.primalHeart = 100; break;
      case 'trans3':
        s.stage = 3;
        s.metaValue = D(10).pow(D(308.25));
        s.stage3.divergencePower = D(308.25);
        s.stage3.softcapIndex = 0;
        s.stage3.softcapsBroken = 0;
        s.pendingStory = 'stage3intro';
        break;
      case 'stage3intro': break;
      case 'A': s.stage3.storyFlags.A = true; break;
      case 'B': s.stage3.storyFlags.B = true; break;
      case 'C': s.stage3.storyFlags.C = true; break;
      case 'D': s.stage3.storyFlags.D = true; break;
      case 'stage4intro':
        s.stage = 4;
        s.stage4.world = 3;
        s.stage4.singularity = D(0);
        s.pendingStory = 'worldEnter3';
        break;
      case 'dragon': break;
      default:
        if (id.indexOf('worldClear') === 0) {
          var wc = parseInt(id.slice('worldClear'.length), 10);
          s.stage4.worldCleared[wc] = true;
          if (wc >= 9) {
            s.pendingStory = 'dragon';
          } else {
            s.stage4.world = wc + 1;
            s.stage4.singularity = D(0);
            s.pendingStory = 'worldEnter' + (wc + 1);
          }
        }
        break;
    }
    if (s.stage > s.meta.stageReached) s.meta.stageReached = s.stage;
  };

  /* ------------------------- 泡泡 ------------------------- */
  DQ.updateBubble = function (s, now) {
    var b = s.bubble;
    if (s.stage !== 1 || s.stage4.frozen || s.pendingStory) {
      if (b.active) { b.active = false; b.exitAt = 0; }
      return;
    }
    if (!b.active) {
      if (now >= b.nextSpawnAt) {
        var life = 3000 + Math.random() * 3000;
        b.active = true;
        b.x = 0.08 + Math.random() * 0.84;
        b.y = 0.10 + Math.random() * 0.78;
        b.bornAt = now;
        b.expiresAt = now + life;
        b.exitAt = 0;
      }
      return;
    }
    if (b.exitAt > 0) {
      if (now >= b.exitAt) {
        b.active = false;
        b.exitAt = 0;
        b.nextSpawnAt = now + 500 + Math.random() * 1500;
      }
      return;
    }
    if (now >= b.expiresAt) b.exitAt = now + 350;
  };

  /* ------------------------- 离线收益 ------------------------- */
  DQ.offlineProduce = function (s, seconds) {
    // 返回 { metaGain, singularityGain, dreamGain, dpGain }（字符串格式）
    var beforeMeta = s.metaValue.toString();
    var beforeSing = s.stage4.singularity.toString();
    var beforeDream = s.dreamPower;

    var steps = Math.min(Math.floor(seconds), 7200); // 最多模拟 2 小时
    var dt = 1;
    for (var i = 0; i < steps; i++) {
      if (s.pendingStory) break;
      if (s.stage === 0) {
        if (s.introSeen) {
          s.dreamPower = Math.min(100, s.dreamPower + dt);
          if (s.dreamPower >= 100) break;
        } else break;
      } else if (s.stage === 2) {
        if (s.metaValue.gte(D(1e308)) || Decimal.isInfinity(s.metaValue)) { s.metaValue = D(1e308); break; }
        s.metaValue = s.metaValue.add(DQ.computeStage2Rates(s).auto.mul(dt));
        if (s.metaValue.gte(D(1e308))) s.metaValue = D(1e308);
      } else if (s.stage === 3) {
        s.metaValue = s.metaValue.add(DQ.computeStage3Rates(s).auto.mul(dt));
        var cap = DQ.currentSoftcap(s);
        if (cap && s.metaValue.gt(D(10).pow(cap))) s.metaValue = D(10).pow(cap);
        s.stage3.divergencePower = s.metaValue.log10();
      } else if (s.stage === 4) {
        var world = DQ.getWorld(s.stage4.world);
        var target = D(world.target);
        s.stage4.singularity = s.stage4.singularity.add(DQ.computeWorldRates(s).auto.mul(dt));
        if (s.stage4.singularity.gte(target)) { s.stage4.singularity = target; break; }
      }
    }

    return {
      seconds: steps,
      dreamGain: s.dreamPower - beforeDream,
      metaGain: DQ.formatDecimal(D(s.metaValue).sub(D(beforeMeta)).max(D(0))),
      singularityGain: DQ.formatDecimal(D(s.stage4.singularity).sub(D(beforeSing)).max(D(0))),
    };
  };
})(window);
