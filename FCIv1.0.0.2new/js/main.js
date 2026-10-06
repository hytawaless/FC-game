/* =========================================================================
 * main.js —— 核心编排：状态闭包、主循环、快照、自检、防篡改、公开 API
 * 斗蛐蛐增量 v1.0.0.2
 * ======================================================================= */
(function (global) {
  'use strict';

  var internal = global.__DQ__;
  var Decimal = global.Decimal;
  var D = internal.D;

  var state = null;
  var accumulator = 0;
  var lastNow = 0;
  var lastAutoSave = 0;
  var lastSnapshotAt = 0;
  var lastSelfCheckAt = 0;
  var booted = false;
  var snapshots = [];
  var offlineResult = null;
  var ui = internal.ui;

  function toast(msg) { if (ui && ui.toast) ui.toast(msg); }
  function nowMs() { return Date.now(); }
  function clonePlain(s) { return JSON.parse(JSON.stringify(s)); }
  function restorePlain(plain) { return internal.completeState(plain); }

  /* ------------------------- 防篡改：原型指纹 ------------------------- */
  function prototypeFingerprint() {
    try {
      if (new Decimal(2).mul(new Decimal(3)).toString() !== '6') return false;
      if (Decimal.fromString('1e100').log10().toString() !== '100') return false;
      if (Decimal.pow(new Decimal(10), new Decimal(300)).toString() !== 'e300') return false;
      var markers = { add: 'addAbsLm', mul: 'pow10', pow: 'pow10', log10: 'Math.log10', toString: 'expToString' };
      for (var k in markers) {
        if (typeof Decimal.prototype[k] !== 'function') return false;
        if (String(Decimal.prototype[k]).indexOf(markers[k]) === -1) return false;
      }
      return true;
    } catch (e) { return false; }
  }

  function pushSnapshot() { snapshots.push(clonePlain(state)); if (snapshots.length > 10) snapshots.shift(); }

  function selfCheck() {
    var issues = false;
    var s = state;
    if (!s) return;
    for (var i = 0; i < 8; i++) if (s.upgrades[i] < 0 || s.upgrades[i] > internal.STAGE2_UPGRADES[i].maxLevel || !Number.isInteger(s.upgrades[i])) issues = true;
    for (var j = 0; j < 10; j++) if (s.stage3.upgrades[j] !== 0 && s.stage3.upgrades[j] !== 1) issues = true;
    if (Decimal.isNaN(s.metaValue) || s.metaValue.sign < 0) issues = true;
    if (Decimal.isNaN(s.powerBaseline) || s.powerBaseline.sign < 0) issues = true;
    if (s.stage >= 3 && !s.pendingStory) {
      var dp = s.metaValue.log10();
      if (Decimal.isNaN(dp) || s.stage3.divergencePower.sub(dp).abs().gt(D(1e-3).mul(dp.add(D(1))))) issues = true;
    }
    if (s.stage === 0 && s.dreamPower > 100) issues = true;
    if (issues) {
      if (snapshots.length) { state = restorePlain(snapshots[snapshots.length - 1]); snapshots.pop(); toast('检测到异常，已自动回滚修复'); }
      else { state = internal.completeState(state); toast('检测到异常，已自动修复'); }
      renderAll();
    }
  }

  function applyOffline() {
    offlineResult = null;
    if (!state.settings.offline) return;
    var last = state.lastSaveAt || state.stats.startedAt;
    if (!last) return;
    var elapsed = nowMs() - last;
    if (elapsed < internal.OFFLINE_MIN_MS) return;
    var seconds = Math.floor(Math.min(elapsed, internal.OFFLINE_CAP_MS) / 1000);
    if (seconds <= 0) return;
    var res = internal.offlineProduce(state, seconds);
    if (res) offlineResult = res;
  }

  function renderAll() { if (ui) ui.render(snapshot()); }

  /* ------------------------- 公开 API ------------------------- */
  var publicApi = {
    version: internal.VERSION,
    snapshot: function () { return snapshot(); },
    save: function () { var r = internal.saveGame(state); toast(r.msg); return r.ok; },
    load: function () {
      var r = internal.loadGame();
      if (!r.ok) { toast(r.msg); return false; }
      if (ui) ui.cleanup();
      state = r.state;
      if (internal.initAllWorldStates) internal.initAllWorldStates(state);
      if (state.stats.startedAt === 0) state.stats.startedAt = nowMs();
      lastAutoSave = nowMs(); snapshots = [];
      applyOffline();
      if (state.stage === 0 && !state.introSeen && !state.pendingStory) state.pendingStory = 'intro';
      renderAll(); toast(r.msg); return true;
    },
    reset: function (opts) {
      if (ui) ui.cleanup();
      state = internal.performReset(state, opts || {});
      if (internal.initAllWorldStates) internal.initAllWorldStates(state);
      if (state.stats.startedAt === 0) state.stats.startedAt = nowMs();
      lastAutoSave = nowMs(); snapshots = []; offlineResult = null;
      if (state.stage === 0 && !state.introSeen && !state.pendingStory) state.pendingStory = 'intro';
      internal.saveGame(state); renderAll(); toast('重置完成');
    },
    setAutoSave: function (on) { state.settings.autoSave = !!on; internal.saveGame(state); },
    clickSuccessor: function () { internal.clickSuccessor(state); renderAll(); },
    clickBubble: function () { internal.clickBubble(state); renderAll(); },
    buyStage2Upgrade: function (i) { internal.buyStage2Upgrade(state, i); renderAll(); },
    buyStage3Upgrade: function (i) { internal.buyStage3Upgrade(state, i); renderAll(); },
    buyWorldUpgrade: function (i) { internal.buyWorldUpgrade(state, i); renderAll(); },
    enterChallenge: function (i) { internal.enterChallenge(state, i); renderAll(); },
    exitChallenge: function () { internal.exitChallenge(state); renderAll(); },
    bypassUnbreakable: function (i) { internal.bypassUnbreakable(state, i); renderAll(); },
    breakWorldWill: function () { internal.breakWorldWill(state); renderAll(); },
    freezeSave: function () { internal.freezeSave(state); internal.saveGame(state); renderAll(); },
    unfreezeSave: function () { internal.unfreezeSave(state); renderAll(); },
    enterStage5: function () { internal.enterStage5(state); renderAll(); },
    cultivate: function () { internal.cultivate(state); renderAll(); },
    startTribulation: function () { internal.startTribulation(state); renderAll(); },
    advanceStory: function () { internal.completeStory(state); renderAll(); },
    dismissOffline: function () { offlineResult = null; renderAll(); },
    riftStart: function (id) { internal.riftStart(state, id); renderAll(); },
    riftAction: function (name, payload) { internal.riftAction(state, name, payload); renderAll(); },
    dismissRiftResult: function () { state.riftResult = null; renderAll(); },
    worldAction: function (name, payload) {
      var mod = internal.worlds[state.stage4.world];
      if (mod && mod.action) mod.action(state, state.stage4.worlds[state.stage4.world], name, payload || {});
      renderAll();
    },
  };
  Object.freeze(publicApi);

  /* ------------------------- 快照 ------------------------- */
  function logHeight(d) {
    var x = d.abs(); if (x.sign === 0) return -Infinity;
    var depth = 0; while (x.layer > 0 && depth < 100) { x = x.log10(); depth++; }
    var m = x.mag; if (m <= 0) return -Infinity;
    return Math.log10(m) + depth * 15.954;
  }
  function progressRatio(v, t) {
    var hv = logHeight(v), ht = logHeight(t);
    if (!isFinite(hv) || !isFinite(ht) || ht <= 0) return 0;
    return Math.max(0, Math.min(100, (hv / ht) * 100));
  }
  function buildStoryGallery(s) {
    var ids = ['intro', 'trans1', 'trans2', 'trans3', 'stage3intro', 'A', 'B', 'C', 'D', 'stage4intro'];
    for (var w = 3; w <= 9; w++) ids.push('worldEnter' + w, 'worldClear' + w);
    ids.push('dragon', 'stage5intro', 'ascend');
    return ids.map(function (id) { var st = internal.getStory(id); return { id: id, title: st.title, seen: s.story.seenNodes.indexOf(id) !== -1 }; });
  }
  function bannerResource(s) {
    if (s.stage === 0) return { label: '阶段进度', value: Math.floor(Math.min(100, s.dreamPower)) + '/100', sub: '' };
    if (s.stage === 1) return { label: '原初之心', value: internal.formatPercent(s.primalHeart), sub: '' };
    if (s.stage === 2) return { label: '元数值', value: internal.formatDecimal(s.metaValue), sub: '' };
    if (s.stage === 3) return { label: '发散之力', value: internal.formatDecimal(s.stage3.divergencePower), sub: '元数值 ' + internal.formatDecimal(s.metaValue) };
    if (s.stage === 4) {
      var w4 = internal.getWorld(s.stage4.world);
      return { label: '宇宙奇点', value: internal.formatDecimal(s.stage4.worlds[s.stage4.world].resource), sub: 'world' + s.stage4.world + ' · ' + Math.floor(progressRatio(s.stage4.worlds[s.stage4.world].resource, D(w4.target))) + '%' };
    }
    var asc = s.stage5.ascended ? '已渡劫' : (s.powerBaseline.gte(D(16)) ? '可渡劫' : (s.revival ? '复活赛中' : '未开启'));
    return { label: '力量基准', value: internal.formatDecimal(s.powerBaseline), sub: asc };
  }

  function snapshot() {
    var s = state;
    var snap = {
      version: internal.VERSION, stage: s.stage, stageName: internal.STAGE_NAMES[s.stage],
      frozen: s.stage4.frozen, settings: { autoSave: s.settings.autoSave },
      stats: { totalClicks: s.stats.totalClicks, playTimeMs: s.stats.playTimeMs },
      story: null, offline: null, rift: null, tribulation: null, revival: null,
      banner: { dream: internal.formatSmallNumber(Math.floor(s.dreamPower)), resource: bannerResource(s) },
      footer: { stageName: internal.STAGE_NAMES[s.stage] },
      storyGallery: buildStoryGallery(s),
      stage0: null, stage1: null, stage2: null, stage3: null, stage4: null, stage5: null,
    };
    if (s.pendingStory) { var st = internal.getStory(s.pendingStory); snap.story = { id: s.pendingStory, title: st.title, lines: st.lines.slice() }; }
    if (offlineResult) snap.offline = { seconds: offlineResult.seconds, dreamGain: offlineResult.dreamGain, metaGain: offlineResult.metaGain, singularityGain: offlineResult.singularityGain };

    if (s.stage === 0) {
      snap.stage0 = { dream: internal.formatSmallNumber(Math.floor(s.dreamPower)), progress: Math.min(100, s.dreamPower), hint: Math.floor(s.dreamPower) + ' / 100' };
    } else if (s.stage === 1) {
      snap.stage1 = { heart: internal.formatPercent(s.primalHeart), progress: Math.min(100, s.primalHeart), hint: Math.floor(s.primalHeart) + '% / 100%' };
    } else if (s.stage === 2) {
      var r2 = internal.computeStage2Rates(s);
      snap.stage2 = {
        meta: internal.formatDecimal(s.metaValue), click: internal.formatDecimal(r2.click), auto: internal.formatDecimal(r2.auto),
        quickClick: s.quickClick.multUntil > nowMs(),
        upgrades: internal.STAGE2_UPGRADES.map(function (def, i) {
          var lv = s.upgrades[i], maxed = lv >= def.maxLevel, cost = def.cost(lv);
          return { name: def.name, en: def.en, genre: def.genre, desc: def.desc, effect: def.effect, level: lv, max: def.maxLevel, maxed: maxed, cost: maxed ? null : internal.formatDecimal(cost), affordable: !maxed && s.metaValue.gte(cost) };
        }),
      };
    } else if (s.stage === 3) {
      var cap = internal.currentSoftcap(s);
      var r3 = internal.computeStage3Rates(s);
      var dp = s.stage3.divergencePower;
      var prog = 0;
      if (cap) { var dl = dp.log10().toNumber(), cl = cap.log10().toNumber(); if (isFinite(cl) && cl > 0) prog = Math.max(0, Math.min(100, (dl / cl) * 100)); }
      snap.stage3 = {
        meta: internal.formatDecimal(s.metaValue), dp: internal.formatDecimal(dp),
        click: internal.formatDecimal(r3.click), auto: internal.formatDecimal(r3.auto),
        pb: internal.formatDecimal(s.powerBaseline),
        softcapCurrent: cap ? internal.formatDecimal(cap) : '已破除全部软上限',
        softcapsBroken: s.stage3.softcapsBroken, softcapTotal: 10, progress: prog,
        canBreakWorldWill: s.stage3.storyFlags.D && s.stage3.softcapsBroken >= 10 && !s.stage3.worldWillBroken,
        upgrades: internal.STAGE3_UPGRADES.map(function (def, i) {
          var lv = s.stage3.upgrades[i], maxed = lv >= 1, cost = internal.stage3Cost(i);
          return { name: def.name, en: def.en, desc: def.desc, effect: def.effect, softcapNo: def.softcapNo, level: lv, maxed: maxed, cost: maxed ? null : internal.formatDecimal(cost), affordable: !maxed && s.metaValue.gte(cost), current: (i === s.stage3.softcapIndex) && !maxed };
        }),
        rifts: internal.RIFTS.map(function (rf) {
          var st3 = s.stage3.rifts[rf.id];
          return { id: rf.id, name: rf.name, desc: rf.desc, rewardDesc: rf.rewardDesc, cleared: st3.cleared, cooldown: Math.max(0, Math.round((st3.cooldownEnd - nowMs()) / 1000)) };
        }),
      };
    } else if (s.stage === 4) {
      var world = internal.getWorld(s.stage4.world);
      var wd = s.stage4.worlds[s.stage4.world];
      var mod = internal.worlds[s.stage4.world];
      var target = D(world.target);
      var ups = internal.buildWorldUpgrades(world);
      var lvls = wd.upgrades || [];
      snap.stage4 = {
        world: world.id, worldName: world.name, theme: world.theme, resourceName: world.resourceName,
        resource: internal.formatDecimal(wd.resource), target: internal.formatDecimal(target), targetLabel: world.targetLabel,
        progress: progressRatio(wd.resource, target),
        frozen: s.stage4.frozen, dragonReached: !!s.stage4.worlds[9].cleared,
        canFreeze: (s.stage4.worlds[9].cleared && !s.stage4.frozen) || s.stage5.ascended,
        canEnterStage5: !!s.stage4.worlds[9].cleared && !s.stage4.frozen,
        worldUI: mod && mod.snapshot ? mod.snapshot(s, wd) : null,
        upgrades: ups.map(function (u, i) {
          var lv = lvls[i] || 0, max = internal.worldUpgradeMaxLevel(u.role), maxed = lv >= max, cost = internal.worldUpgradeCost(world, i, lv);
          return { name: u.name, role: u.role, level: lv, max: max, maxed: maxed, cost: maxed ? null : internal.formatDecimal(cost), affordable: !maxed && wd.resource.gte(cost) };
        }),
        challenges: (wd.challenges || []).map(function (c, i) {
          var fracs = [0.5, 0.9, 1.0], goal = D(10).pow(target.log10().mul(fracs[i % 3]));
          return { index: i, goal: internal.formatDecimal(goal), done: !!(c && c.done), active: !!(s.challengeActive && s.challengeActive.world === world.id && s.challengeActive.index === i) };
        }),
        blocks: (wd.blocks || []).map(function (b, i) {
          var cost = D(10).pow(target.log10().mul(D(0.25)));
          return { index: i, bypassed: !!(b && b.bypassed), cost: internal.formatDecimal(cost), affordable: !(b && b.bypassed) && wd.resource.gte(cost) };
        }),
      };
    } else if (s.stage === 5) {
      var cultCost = D(10).pow(D(2).add(s.stage5.tribulationAttempts));
      snap.stage5 = {
        pb: internal.formatDecimal(s.powerBaseline), ascended: s.stage5.ascended,
        cultivateCost: internal.formatDecimal(cultCost), canCultivate: s.metaValue.gte(cultCost),
        canTribulate: !s.stage5.ascended && !s.tribulation && !s.revival && s.powerBaseline.gte(D(16)),
        needPB: s.powerBaseline.lt(D(16)),
        tribulationAttempts: s.stage5.tribulationAttempts, tribulationFails: s.stage5.tribulationFails,
        revivalWins: s.stage5.revivalWins, revivalLosses: s.stage5.revivalLosses,
        winRate: Math.round(internal.tribulationWinRate(s) * 100),
      };
    }

    // 裂隙 / 渡劫 / 复活赛 演出层
    if (s.riftActive) {
      var rf = s.riftActive;
      var d = rf.data;
      snap.rift = { id: rf.id, name: internal.getStory ? '' : '', type: rf.type, remaining: Math.max(0, Math.round((rf.endAt - nowMs()) / 1000)), data: {} };
      snap.rift.name = (function () { for (var i = 0; i < internal.RIFTS.length; i++) if (internal.RIFTS[i].id === rf.id) return internal.RIFTS[i].name; return ''; })();
      if (d) {
        snap.rift.data.count = d.count; snap.rift.data.hp = d.hp; snap.rift.data.round = d.round; snap.rift.data.correct = d.correct;
        snap.rift.data.showing = d.showing; snap.rift.data.seq = d.seq ? d.seq.slice() : null; snap.rift.data.input = d.input ? d.input.slice() : null;
        snap.rift.data.answer = d.answer; snap.rift.data.step = d.step; snap.rift.data.hits = d.hits; snap.rift.data.tx = d.tx; snap.rift.data.ty = d.ty;
        snap.rift.data.chosen = d.chosen; snap.rift.data.clicks = d.clicks;
      }
    }
    if (s.riftResult) { snap.riftResult = { id: s.riftResult.id, reward: s.riftResult.reward ? internal.formatDecimal(s.riftResult.reward) : '—' }; }
    if (s.tribulation) snap.tribulation = { round: s.tribulation.round, phase: s.tribulation.phase, wins: s.tribulation.wins };
    if (s.revival) snap.revival = { round: s.revival.round, phase: s.revival.phase, wins: s.revival.wins, losses: s.revival.losses, opponentPB: internal.formatDecimal(s.revival.opponentPB) };

    return snap;
  }

  /* ------------------------- 主循环 ------------------------- */
  function frame(now) {
    requestAnimationFrame(frame);
    if (!booted) return;
    var dt = (now - lastNow) / 1000;
    lastNow = now;
    if (dt < 0) dt = 0;
    if (dt > 0.25) dt = 0.25;

    if (!offlineResult) {
      accumulator += dt;
      while (accumulator >= internal.FIXED_STEP) {
        internal.update(state, internal.FIXED_STEP);
        internal.checkChallenge(state);
        internal.updateBubble(state, nowMs());
        accumulator -= internal.FIXED_STEP;
      }
    }
    autoSaveTick(nowMs());
    if (nowMs() - lastSnapshotAt >= 1000) { lastSnapshotAt = nowMs(); pushSnapshot(); }
    if (nowMs() - lastSelfCheckAt >= 5000) { lastSelfCheckAt = nowMs(); selfCheck(); }

    if (ui) {
      ui.render(snapshot());
      ui.renderBubble({ active: state.bubble.active, x: state.bubble.x, y: state.bubble.y, exitAt: state.bubble.exitAt, visible: state.stage === 1 && !state.stage4.frozen && !state.pendingStory });
    }
  }
  function autoSaveTick(now) {
    if (!state.settings.autoSave) return;
    if (now - lastAutoSave >= state.settings.autoSaveInterval) { lastAutoSave = now; internal.saveGame(state); }
  }

  function bootstrap() {
    if (!prototypeFingerprint()) { global.alert('检测到运行环境被修改，请刷新页面。'); return; }
    var res = internal.loadGame();
    state = res.ok ? res.state : internal.completeState(internal.createState());
    if (internal.initAllWorldStates) internal.initAllWorldStates(state);
    if (state.stats.startedAt === 0) state.stats.startedAt = nowMs();
    lastAutoSave = nowMs(); lastSnapshotAt = nowMs(); lastSelfCheckAt = nowMs();
    applyOffline();
    if (state.stage === 0 && !state.introSeen && !state.pendingStory) state.pendingStory = 'intro';
    global.DQ = publicApi;
    try { global.__DQ__ = undefined; } catch (e) {}
    if (ui && ui.init) ui.init(publicApi);
    renderAll();
    booted = true;
    lastNow = performance.now();
    requestAnimationFrame(frame);
    global.addEventListener('beforeunload', function () { internal.saveGame(state); });
  }

  if (global.document.readyState === 'loading') global.document.addEventListener('DOMContentLoaded', bootstrap);
  else bootstrap();
})(window);
