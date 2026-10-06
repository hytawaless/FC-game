/* =========================================================================
 * main.js —— 核心编排：状态闭包、主循环、离线收益、快照、自检、防篡改、公开 API
 * 斗蛐蛐增量 v1.0.0.1
 *
 * 游戏状态保存在本 IIFE 闭包内，不挂到 window/globalThis；
 * 对外只暴露 Object.freeze 的有限接口 window.DQ。
 * ======================================================================= */
(function (global) {
  'use strict';

  var internal = global.__DQ__;          // 内部纯函数集
  var Decimal = global.Decimal;
  var D = internal.D;

  /* ------------------------- 闭包内状态 ------------------------- */
  var state = null;
  var accumulator = 0;
  var lastNow = 0;
  var lastAutoSave = 0;
  var lastSnapshotAt = 0;
  var lastSelfCheckAt = 0;
  var booted = false;
  var snapshots = [];                     // 最近 10 个内存快照
  var offlineResult = null;               // 离线收益结果（供对话框展示）

  var ui = internal.ui;                   // ui.js 注册的渲染器

  /* ------------------------- 工具 ------------------------- */
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

  /* ------------------------- 快照 & 自检 ------------------------- */
  function pushSnapshot() {
    snapshots.push(clonePlain(state));
    if (snapshots.length > 10) snapshots.shift();
  }

  function selfCheck() {
    var issues = false;
    var s = state;
    if (!s) return;
    // 升级等级合法
    for (var i = 0; i < 8; i++) {
      if (s.upgrades[i] < 0 || s.upgrades[i] > internal.STAGE2_UPGRADES[i].maxLevel || !Number.isInteger(s.upgrades[i])) issues = true;
    }
    for (var j = 0; j < 10; j++) {
      if (s.stage3.upgrades[j] !== 0 && s.stage3.upgrades[j] !== 1) issues = true;
    }
    // 数值合法性
    if (Decimal.isNaN(s.metaValue) || s.metaValue.sign < 0) issues = true;
    if (Decimal.isNaN(s.stage4.singularity) || s.stage4.singularity.sign < 0) issues = true;
    if (Decimal.isNaN(s.stage3.divergencePower)) issues = true;
    // 发散之力 ≈ log10(元数值)（剧情期间暂停，跳过该检查）
    if (s.stage >= 3 && !s.pendingStory) {
      var expectDp = s.metaValue.log10();
      var diff = s.stage3.divergencePower.sub(expectDp).abs();
      if (diff.gt(D(1e-6).mul(expectDp.add(D(1))))) issues = true;
    }
    // 阶段与数值区间匹配
    if (s.stage === 0 && s.dreamPower > 100) issues = true;
    if (s.stage < 1 && s.dreamPower >= 100 && !s.pendingStory) issues = true;
    if (s.stage < 2 && s.primalHeart >= 100 && !s.pendingStory) issues = true;

    if (issues) {
      if (snapshots.length) {
        state = restorePlain(snapshots[snapshots.length - 1]);
        snapshots.pop();
        toast('检测到异常，已自动回滚修复');
      } else {
        state = internal.completeState(state);
        toast('检测到异常，已自动修复');
      }
      renderAll();
    }
  }

  /* ------------------------- 离线收益 ------------------------- */
  function applyOffline() {
    offlineResult = null;
    if (!state.settings.offline) return;
    var last = state.lastSaveAt || state.stats.startedAt;
    if (!last) return;
    var elapsed = nowMs() - last;
    if (elapsed < internal.OFFLINE_MIN_MS) return;
    var capped = Math.min(elapsed, internal.OFFLINE_CAP_MS);
    var seconds = Math.floor(capped / 1000);
    if (seconds <= 0) return;
    var res = internal.offlineProduce(state, seconds);
    if (res) offlineResult = res;
  }

  /* ------------------------- 渲染入口 ------------------------- */
  function renderAll() {
    if (ui) ui.render(snapshot());
  }

  /* ------------------------- 公开 API ------------------------- */
  function publicSnapshot() { return snapshot(); }

  var publicApi = {
    version: internal.VERSION,
    snapshot: publicSnapshot,
    save: function () {
      var r = internal.saveGame(state);
      toast(r.msg);
      return r.ok;
    },
    load: function () {
      var r = internal.loadGame();
      if (!r.ok) { toast(r.msg); return false; }
      if (ui) ui.cleanup();
      state = r.state;
      if (state.stats.startedAt === 0) state.stats.startedAt = nowMs();
      lastAutoSave = nowMs();
      snapshots = [];
      applyOffline();
      if (state.stage === 0 && !state.introSeen && !state.pendingStory) state.pendingStory = 'intro';
      renderAll();
      toast(r.msg);
      return true;
    },
    reset: function (opts) {
      if (ui) ui.cleanup();
      state = internal.performReset(state, opts || {});
      if (state.stats.startedAt === 0) state.stats.startedAt = nowMs();
      lastAutoSave = nowMs();
      snapshots = [];
      offlineResult = null;
      if (state.stage === 0 && !state.introSeen && !state.pendingStory) state.pendingStory = 'intro';
      internal.saveGame(state);
      renderAll();
      toast('重置完成');
    },
    setAutoSave: function (on) {
      state.settings.autoSave = !!on;
      internal.saveGame(state);
    },
    clickSuccessor: function () { internal.clickSuccessor(state); renderAll(); },
    clickBubble: function () { internal.clickBubble(state); renderAll(); },
    buyStage2Upgrade: function (i) { internal.buyStage2Upgrade(state, i); renderAll(); },
    buyStage3Upgrade: function (i) { internal.buyStage3Upgrade(state, i); renderAll(); },
    buyWorldUpgrade: function (i) { internal.buyWorldUpgrade(state, i); renderAll(); },
    enterChallenge: function (i) { internal.enterChallenge(state, i); renderAll(); },
    exitChallenge: function () { internal.exitChallenge(state); renderAll(); },
    bypassUnbreakable: function (i) { internal.bypassUnbreakable(state, i); renderAll(); },
    breakWorldWill: function () { internal.breakWorldWill(state); renderAll(); },
    freezeSave: function () { var r = internal.freezeSave(state); if (r.ok) internal.saveGame(state); renderAll(); },
    unfreezeSave: function () { internal.unfreezeSave(state); renderAll(); },
    advanceStory: function () { internal.completeStory(state); renderAll(); },
    dismissOffline: function () { offlineResult = null; renderAll(); },
  };

  Object.freeze(publicApi);
  Object.freeze(publicApi.snapshot);

  /* ------------------------- 快照（只读视图，供 UI 渲染） ------------------------- */
  function logHeight(d) {
    var x = d.abs();
    if (x.sign === 0) return -Infinity;
    var depth = 0;
    while (x.layer > 0 && depth < 100) { x = x.log10(); depth++; }
    var m = x.mag;
    if (m <= 0) return -Infinity;
    return Math.log10(m) + depth * 15.954;
  }

  function buildStoryGallery(s) {
    var ids = ['intro', 'trans1', 'trans2', 'trans3', 'stage3intro', 'A', 'B', 'C', 'D', 'stage4intro'];
    for (var w = 3; w <= 9; w++) { ids.push('worldEnter' + w, 'worldClear' + w); }
    ids.push('dragon');
    return ids.map(function (id) {
      var st = internal.getStory(id);
      return { id: id, title: st.title, seen: s.story.seenNodes.indexOf(id) !== -1 };
    });
  }

  function progressRatio(value, target) {
    var hv = logHeight(value);
    var ht = logHeight(target);
    if (!isFinite(hv) || !isFinite(ht) || ht <= 0) return 0;
    return Math.max(0, Math.min(100, (hv / ht) * 100));
  }

  function snapshot() {
    var s = state;
    var snap = {
      version: internal.VERSION,
      stage: s.stage,
      stageName: internal.STAGE_NAMES[s.stage],
      frozen: s.stage4.frozen,
      frozenAt: s.stage4.frozenAt,
      settings: { autoSave: s.settings.autoSave },
      stats: { totalClicks: s.stats.totalClicks, playTimeMs: s.stats.playTimeMs },
      story: null,
      offline: null,
      banner: {},
      stage0: null, stage1: null, stage2: null, stage3: null, stage4: null,
      footer: { stageName: internal.STAGE_NAMES[s.stage] },
      storyGallery: buildStoryGallery(s),
    };

    // 剧情
    if (s.pendingStory) {
      var st = internal.getStory(s.pendingStory);
      snap.story = { id: s.pendingStory, title: st.title, lines: st.lines.slice() };
    }

    // 离线对话框
    if (offlineResult) {
      snap.offline = {
        seconds: offlineResult.seconds,
        dreamGain: offlineResult.dreamGain,
        metaGain: offlineResult.metaGain,
        singularityGain: offlineResult.singularityGain,
      };
    }

    // 顶部横幅
    snap.banner = {
      dream: { value: internal.formatSmallNumber(Math.floor(s.dreamPower)), visible: true },
      heart: { value: s.stage >= 1 ? internal.formatPercent(s.primalHeart) : '—', locked: s.stage < 1 },
      meta: { value: s.stage >= 2 ? internal.formatDecimal(s.metaValue) : '—', locked: s.stage < 2 },
      dp: { value: s.stage >= 3 ? internal.formatDecimal(s.stage3.divergencePower) : '—', locked: s.stage < 3, label: '发散之力' },
      softcap: { value: s.stage >= 3 ? (internal.currentSoftcap(s) ? internal.formatDecimal(internal.currentSoftcap(s)) : '已破除') : '—', locked: s.stage < 3, label: '当前软上限' },
      singularity: { value: s.stage >= 4 ? internal.formatDecimal(s.stage4.singularity) : '—', locked: s.stage < 4, label: '宇宙奇点' },
      world: { value: s.stage >= 4 ? ('world' + s.stage4.world) : '—', locked: s.stage < 4, label: '当前世界' },
    };

    if (s.stage === 0) {
      snap.stage0 = {
        dream: internal.formatSmallNumber(Math.floor(s.dreamPower)),
        progress: Math.min(100, s.dreamPower),
        hint: Math.floor(s.dreamPower) + ' / 100',
      };
    } else if (s.stage === 1) {
      snap.stage1 = {
        heart: internal.formatPercent(s.primalHeart),
        progress: Math.min(100, s.primalHeart),
        hint: Math.floor(s.primalHeart) + '% / 100%',
      };
    } else if (s.stage === 2) {
      var r2 = internal.computeStage2Rates(s);
      snap.stage2 = {
        meta: internal.formatDecimal(s.metaValue),
        click: internal.formatDecimal(r2.click),
        auto: internal.formatDecimal(r2.auto),
        upgrades: internal.STAGE2_UPGRADES.map(function (def, i) {
          var lv = s.upgrades[i];
          var maxed = lv >= def.maxLevel;
          var cost = def.cost(lv);
          return {
            name: def.name, en: def.en, genre: def.genre, desc: def.desc, effect: def.effect,
            level: lv, max: def.maxLevel, maxed: maxed,
            cost: maxed ? null : internal.formatDecimal(cost),
            affordable: !maxed && s.metaValue.gte(cost),
          };
        }),
      };
    } else if (s.stage === 3) {
      var cap = internal.currentSoftcap(s);
      var r3 = internal.computeStage3Rates(s);
      var dp = s.stage3.divergencePower;
      var prog = 0;
      if (cap) {
        var dpLog = dp.log10().toNumber();
        var capLog = cap.log10().toNumber();
        if (isFinite(capLog) && capLog > 0) prog = Math.max(0, Math.min(100, (dpLog / capLog) * 100));
      }
      snap.stage3 = {
        meta: internal.formatDecimal(s.metaValue),
        dp: internal.formatDecimal(dp),
        click: internal.formatDecimal(r3.click),
        auto: internal.formatDecimal(r3.auto),
        softcapCurrent: cap ? internal.formatDecimal(cap) : '已破除全部软上限',
        softcapNext: (s.stage3.softcapIndex <= 8) ? internal.formatDecimal(internal.stage3Softcap(s.stage3.softcapIndex + 1)) : null,
        softcapsBroken: s.stage3.softcapsBroken,
        softcapTotal: 10,
        progress: prog,
        canBreakWorldWill: s.stage3.storyFlags.D && s.stage3.softcapsBroken >= 10 && !s.stage3.worldWillBroken,
        upgrades: internal.STAGE3_UPGRADES.map(function (def, i) {
          var lv = s.stage3.upgrades[i];
          var maxed = lv >= 1;
          var cost = internal.stage3Cost(i);
          var isCurrent = (i === s.stage3.softcapIndex) && !maxed;
          return {
            name: def.name, en: def.en, desc: def.desc, effect: def.effect, softcapNo: def.softcapNo,
            level: lv, maxed: maxed,
            cost: maxed ? null : internal.formatDecimal(cost),
            affordable: !maxed && s.metaValue.gte(cost),
            current: isCurrent,
          };
        }),
      };
    } else if (s.stage === 4) {
      var world = internal.getWorld(s.stage4.world);
      var target = D(world.target);
      var ups = internal.buildWorldUpgrades(world);
      var lvls = s.stage4.upgrades[s.stage4.world] || [];
      var chs = s.stage4.challenges[s.stage4.world] || [];
      var ubs = s.stage4.unbreakable[s.stage4.world] || [];
      var ubNames = ['时间锚定', '因果壁垒', '虚空屏障', '永恒之锁'];
      var fracs = [0.5, 0.9, 1.0];
      snap.stage4 = {
        world: world.id, worldName: world.name, theme: world.theme,
        singularity: internal.formatDecimal(s.stage4.singularity),
        target: internal.formatDecimal(target),
        targetLabel: world.targetLabel,
        progress: progressRatio(s.stage4.singularity, target),
        worldCleared: s.stage4.worldCleared[world.id],
        frozen: s.stage4.frozen,
        frozenAt: s.stage4.frozenAt,
        dragonReached: !!s.stage4.worldCleared[9],
        canFreeze: !!s.stage4.worldCleared[9] && !s.stage4.frozen,
        upgrades: ups.map(function (u, i) {
          var lv = lvls[i] || 0;
          var max = internal.worldUpgradeMaxLevel(u.role);
          var maxed = lv >= max;
          var cost = internal.worldUpgradeCost(world, i, lv);
          return {
            name: u.name, role: u.role, level: lv, max: max, maxed: maxed,
            cost: maxed ? null : internal.formatDecimal(cost),
            affordable: !maxed && s.stage4.singularity.gte(cost),
          };
        }),
        challenges: chs.map(function (c, i) {
          var frac = fracs[i % fracs.length];
          var goal = D(10).pow(target.log10().mul(frac));
          var done = !!(c && c.done);
          var active = !!(s.challengeActive && s.challengeActive.world === world.id && s.challengeActive.index === i);
          return { index: i, goal: internal.formatDecimal(goal), done: done, active: active };
        }),
        unbreakable: ubs.map(function (u, i) {
          var bypassed = !!(u && u.bypassed);
          var cost = D(10).pow(target.log10().mul(D(0.25)));
          return { index: i, name: ubNames[i % ubNames.length], bypassed: bypassed, cost: internal.formatDecimal(cost), affordable: !bypassed && s.stage4.singularity.gte(cost) };
        }),
      };
    }

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

    // 离线收益对话框显示期间暂停逻辑更新（避免与剧情/过渡重叠）
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
      ui.renderBubble({
        active: state.bubble.active,
        x: state.bubble.x, y: state.bubble.y,
        exitAt: state.bubble.exitAt,
        visible: state.stage === 1 && !state.stage4.frozen && !state.pendingStory,
      });
    }
  }

  function autoSaveTick(now) {
    if (!state.settings.autoSave) return;
    if (now - lastAutoSave >= state.settings.autoSaveInterval) {
      lastAutoSave = now;
      internal.saveGame(state);
    }
  }

  /* ------------------------- 启动引导 ------------------------- */
  function bootstrap() {
    if (!prototypeFingerprint()) {
      global.alert('检测到运行环境被修改，请刷新页面。');
      return;
    }
    var res = internal.loadGame();
    state = res.ok ? res.state : internal.createState();
    if (state.stats.startedAt === 0) state.stats.startedAt = nowMs();
    lastAutoSave = nowMs();
    lastSnapshotAt = nowMs();
    lastSelfCheckAt = nowMs();

    applyOffline();
    if (state.stage === 0 && !state.introSeen && !state.pendingStory) state.pendingStory = 'intro';

    // 注册公开 API
    global.DQ = publicApi;
    try { global.__DQ__ = undefined; } catch (e) {}

    if (ui && ui.init) ui.init(publicApi);
    renderAll();

    booted = true;
    lastNow = performance.now();
    requestAnimationFrame(frame);

    // 关闭页面前保存（用于离线收益的 lastSaveAt）
    global.addEventListener('beforeunload', function () { internal.saveGame(state); });
  }

  if (global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})(window);
