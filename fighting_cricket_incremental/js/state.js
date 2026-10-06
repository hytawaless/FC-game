/* =========================================================================
 * state.js —— 常量、配置、存档结构、迁移、序列化、校验和、大数格式化
 * 斗蛐蛐增量 v1.0.0.1
 *
 * 说明：本文件只提供“纯函数/配置”，挂到内部命名空间 window.__DQ__，
 * 真正的游戏状态保存在 main.js 的闭包中，不挂到 window。
 * ======================================================================= */
(function (global) {
  'use strict';

  var DQ = (global.__DQ__ = global.__DQ__ || {});
  var Decimal = global.Decimal;

  DQ.VERSION = '1.0.0.1';
  DQ.PREV_VERSION = '1.0.0.0';
  DQ.SAVE_KEY = 'douququ_save_v1';
  DQ.BACKUP_KEYS = ['douququ_save_v1_bak0', 'douququ_save_v1_bak1', 'douququ_save_v1_bak2'];
  DQ.AUTO_SAVE_INTERVAL = 10000;
  DQ.SALT = 'dq_v1_0_0_1_salt_7f3a';
  DQ.OFFLINE_CAP_MS = 8 * 60 * 60 * 1000; // 离线收益上限 8 小时
  DQ.OFFLINE_MIN_MS = 30000;              // 少于 30 秒不弹离线收益
  DQ.FIXED_STEP = 0.1;

  /* ---------------------------- 工具 ---------------------------- */
  function D(x) { return new Decimal(x); }

  function numOrDef(v, def) {
    var n = Number(v);
    return (typeof v === 'number' && !isNaN(n)) ? n : def;
  }

  function isPlainObject(v) { return v && typeof v === 'object' && !Array.isArray(v); }

  DQ.D = D;

  /* ---------------------------- 大数格式化 ---------------------------- */
  function round2(x) {
    var r = Math.round(x * 100) / 100;
    return Number.isInteger(r) ? String(r) : r.toFixed(2);
  }
  function withCommas(s) {
    var parts = s.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  }
  function small(m) {
    if (Number.isInteger(m)) return withCommas(String(m));
    return withCommas(round2(m));
  }
  function abbr(x, suf) { return round2(x) + suf; }
  function sci(m) { return m.toExponential(2).replace('e+', 'e'); }
  function sciPow(m) {
    var e = Math.floor(m);
    var mant = Math.pow(10, m - e);
    return mant.toFixed(2) + 'e' + e;
  }
  function expStr(m) {
    if (m < 1e6) return round2(m);
    if (m < 1e9) return abbr(m / 1e6, 'M');
    if (m < 1e12) return abbr(m / 1e9, 'B');
    if (m < 1e15) return abbr(m / 1e12, 'T');
    return sci(m);
  }
  function formatAbs(d) {
    var L = d.layer, m = d.mag;
    if (L === 0) {
      if (m < 1e6) return small(m);
      if (m < 1e9) return abbr(m / 1e6, 'M');
      if (m < 1e12) return abbr(m / 1e9, 'B');
      if (m < 1e15) return abbr(m / 1e12, 'T');
      return sci(m);
    }
    // L ≥ 1：value = 10^(10^(...m))（L 个 10^）。
    // 等价于 (L-1) 个 'e' 前缀 + 最内层指数（10^m 或 m 的科学/ e 记法）。
    if (!isFinite(L) || L < 1) L = 1;
    if (L > 1000) L = 1000; // 防御：避免异常层数导致深递归
    var prefix = '';
    for (var i = 1; i < L; i++) prefix += 'e';
    var inner = (m <= 308) ? sciPow(m) : ('e' + expStr(m));
    return prefix + inner;
  }
  DQ.formatDecimal = function (d) {
    d = (d instanceof Decimal) ? d : D(d);
    if (Decimal.isNaN(d)) return 'NaN';
    if (Decimal.isInfinity(d)) return d.sign < 0 ? '-Infinity' : 'Infinity';
    if (d.sign === 0) return '0';
    return (d.sign < 0 ? '-' : '') + formatAbs(d.abs());
  };
  DQ.formatPercent = function (p) {
    return Math.floor(Math.max(0, Math.min(100, Number(p) || 0))) + '%';
  };
  DQ.formatSmallNumber = function (n) { return small(Number(n) || 0); };

  /* ---------------------------- 校验和 ---------------------------- */
  DQ.fnv1a = function (str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    var s = h.toString(16);
    while (s.length < 8) s = '0' + s;
    return s;
  };
  DQ.computeChecksum = function (bodyStr) {
    return DQ.fnv1a(DQ.VERSION + '|' + DQ.SALT + '|' + bodyStr);
  };

  /* ---------------------------- 第二阶段升级 ---------------------------- */
  DQ.STAGE2_UPGRADES = [
    { name: '量子自举', en: 'Quantum Bootstrap', genre: '科幻', desc: '个体意识的第一次跃迁。', effect: '每级使「后继」点击收益 +1。', cost: function (lv) { return D(10).mul(D(1.6).pow(lv)); }, maxLevel: 10 },
    { name: '戴森环', en: 'Dyson Ring', genre: '科幻', desc: '恒星级能源采集。', effect: '每级 +0.5/秒 自动产出。', cost: function (lv) { return D(100).mul(D(1.8).pow(lv)); }, maxLevel: 10 },
    { name: '意识上传', en: 'Mind Upload', genre: '科幻', desc: '思维脱离肉体，进入数字世界。', effect: '每级使点击与自动 ×1.5。', cost: function (lv) { return D(1000).mul(D(2).pow(lv)); }, maxLevel: 10 },
    { name: '时间钳形', en: 'Temporal Pincer', genre: '科幻', desc: '过去与未来同时向现在施压。', effect: '自动额外获得 点击收益 × 0.5 × 等级/秒。', cost: function (lv) { return D(10000).mul(D(2.2).pow(lv)); }, maxLevel: 10 },
    { name: '宇宙工程', en: 'Cosmic Engineering', genre: '科幻', desc: '把整个宇宙当作可改造的机器。', effect: '所有元数值获取 ×2/级。', cost: function (lv) { return D(1e6).mul(D(2.5).pow(lv)); }, maxLevel: 10 },
    { name: '维度折叠', en: 'Dimensional Folding', genre: '科幻', desc: '突破三维，折叠时空结构。', effect: '自动额外获得 元数值 × 1% × 等级/秒。', cost: function (lv) { return D(1e9).mul(D(3).pow(lv)); }, maxLevel: 10 },
    { name: '因果律重写', en: 'Causal Rewrite', genre: '科幻→神学', desc: '不再遵守因果，而是改写因果。', effect: '重写公式：点击=元数值×10%，自动=元数值^0.9+元数值×5%/秒。', cost: function () { return D(1e12); }, maxLevel: 1 },
    { name: '神说：要有光', en: 'Fiat Lux', genre: '神学', desc: '科幻终点是神学起点。', effect: '将元数值立即设为 Infinity，进入第三阶段。', cost: function () { return D(1e18); }, maxLevel: 1 },
  ];

  /* ---------------------------- 第三阶段 ---------------------------- */
  DQ.STAGE3_SOFTCAPS = ['308.25', '1e3', '1e6', '1e12', '1e24', '1e48', '1e96', '1e192', '1e384', '1e768'];
  DQ.STAGE3_UPGRADES = [
    { name: '破限之剑', en: 'Limit-Breaking Sword', desc: '勇者的第一柄剑。', effect: '破除软上限 1，点击收益 ×10。', softcapNo: 1, clickMult: '1e1', autoMult: '1', globalMult: '1', story: null },
    { name: '龙鳞护甲', en: 'Dragonscale Armor', desc: '披上巨龙的鳞甲。', effect: '破除软上限 2，自动产出 ×10。', softcapNo: 2, clickMult: '1', autoMult: '1e1', globalMult: '1', story: null },
    { name: '勇者之证', en: 'Hero\'s Proof', desc: '证明你配得上勇者之名。', effect: '破除软上限 3，DP 获取速率 ×2。', softcapNo: 3, clickMult: '1', autoMult: '1', globalMult: '2', story: null },
    { name: '阿塰的意志', en: 'Will of Ahai', desc: '受伤也不曾倒下。', effect: '破除软上限 4，触发剧情节点 A。', softcapNo: 4, clickMult: '1', autoMult: '1', globalMult: '2', story: 'A' },
    { name: '泡沫之盾', en: 'Bubble Shield', desc: '以泡沫为盾，柔克刚。', effect: '破除软上限 5，全局倍率 ×5。', softcapNo: 5, clickMult: '1', autoMult: '1', globalMult: '5', story: null },
    { name: '落雪的注视', en: 'Gaze of Luoxue', desc: '清冷的注视，让你不再孤单。', effect: '破除软上限 6，触发剧情节点 B。', softcapNo: 6, clickMult: '1', autoMult: '1', globalMult: '2', story: 'B' },
    { name: '无限回路', en: 'Infinite Circuit', desc: '能量在回路中永不停歇。', effect: '破除软上限 7，自动产出 ×100。', softcapNo: 7, clickMult: '1', autoMult: '1e2', globalMult: '1', story: null },
    { name: 'hyt 的火种', en: 'Ember of hyt', desc: '世界之外递来的一粒火种。', effect: '破除软上限 8，触发剧情节点 C。', softcapNo: 8, clickMult: '1', autoMult: '1', globalMult: '2', story: 'C' },
    { name: '世界边缘', en: 'Edge of the World', desc: '站到世界的尽头。', effect: '破除软上限 9，全局倍率 ×50。', softcapNo: 9, clickMult: '1', autoMult: '1', globalMult: '50', story: null },
    { name: '斗蛐蛐之心', en: 'Heart of Cricket', desc: '一切争斗的终点。', effect: '破除软上限 10，触发最终对决。', softcapNo: 10, clickMult: '1', autoMult: '1', globalMult: '10', story: 'D' },
  ];
  DQ.stage3Cost = function (i) {
    return D(10).pow(D(DQ.STAGE3_SOFTCAPS[i]).sub(2));
  };
  DQ.stage3Softcap = function (i) {
    return D(DQ.STAGE3_SOFTCAPS[i]);
  };

  /* ---------------------------- 第四阶段 world 配置（数据驱动） ---------------------------- */
  DQ.WORLDS = [
    { id: 3, name: '首个嵌套世界', theme: '科幻', target: 'e9.000e15', targetLabel: '10^(9.000e15)',
      upgradeCount: 15, challengeCount: 3, unbreakableCount: 2,
      baseCost: '10', costGrowth: '100', iterRate: '0.02', iter2Rate: '0', coreJump: '1e4',
      enter: ['主角团穿过世界裂缝，抵达了第一个嵌套世界。', '这里的法则与外面截然不同。'],
      clear: ['世界崩塌，又一层壳被剥落。', '通往下一个世界的门，已经打开。'] },
    { id: 4, name: '回环时序', theme: '科幻', target: 'e1.000e30', targetLabel: '10^(1.000e30)',
      upgradeCount: 16, challengeCount: 3, unbreakableCount: 2,
      baseCost: '10', costGrowth: '120', iterRate: '0.02', iter2Rate: '0.0002', coreJump: '1e4',
      enter: ['时间在这里首尾相接，形成环。'],
      clear: ['时间之环断裂，因果重归直线。'] },
    { id: 5, name: '量子泡沫海', theme: '科幻', target: 'e1.000e60', targetLabel: '10^(1.000e60)',
      upgradeCount: 17, challengeCount: 4, unbreakableCount: 2,
      baseCost: '10', costGrowth: '150', iterRate: '0.02', iter2Rate: '0.0004', coreJump: '1e4',
      enter: ['无尽的泡沫翻涌，每一颗都是一个可能的宇宙。'],
      clear: ['泡沫归于平静，你看见了海面之下的深渊。'] },
    { id: 6, name: '因果之塔', theme: '科幻→神学', target: 'e1.000e100', targetLabel: '10^(1.000e100)',
      upgradeCount: 18, challengeCount: 4, unbreakableCount: 3,
      baseCost: '10', costGrowth: '180', iterRate: '0.02', iter2Rate: '0.0006', coreJump: '1e4',
      enter: ['一座由因果砌成的塔，直插天穹。'],
      clear: ['塔尖触及神域，因果在此处断裂。'] },
    { id: 7, name: '神谕回廊', theme: '神学', target: 'e1.000e160', targetLabel: '10^(1.000e160)',
      upgradeCount: 19, challengeCount: 5, unbreakableCount: 3,
      baseCost: '10', costGrowth: '220', iterRate: '0.02', iter2Rate: '0.0008', coreJump: '1e4',
      enter: ['回廊两侧，是无数被遗弃的神谕。'],
      clear: ['回廊尽头，你听见了一声叹息。'] },
    { id: 8, name: '原初之海', theme: '神学', target: 'e1.000e250', targetLabel: '10^(1.000e250)',
      upgradeCount: 20, challengeCount: 5, unbreakableCount: 4,
      baseCost: '10', costGrowth: '280', iterRate: '0.02', iter2Rate: '0.0010', coreJump: '1e4',
      enter: ['这里是一切世界诞生之前的海洋。'],
      clear: ['海水退去，露出了创世的床。'] },
    { id: 9, name: '龙帝之座', theme: '神学', target: 'ee9.000e15', targetLabel: '10^(10^(9.000e15))',
      upgradeCount: 21, challengeCount: 6, unbreakableCount: 4,
      baseCost: '10', costGrowth: '350', iterRate: '0.02', iter2Rate: '0.0015', coreJump: '1e4',
      enter: ['最高处的王座，空置了不知多少纪元。'],
      clear: ['王座震颤，龙帝将临。'] },
  ];

  DQ.getWorld = function (id) {
    for (var i = 0; i < DQ.WORLDS.length; i++) if (DQ.WORLDS[i].id === id) return DQ.WORLDS[i];
    return DQ.WORLDS[0];
  };

  /* 生成某 world 的升级描述（按角色模板） */
  DQ.buildWorldUpgrades = function (world) {
    var list = [];
    function push(name, role) { list.push({ name: name, role: role }); }
    push('奇点种子', 'base');
    push('奇点聚变', 'base');
    push('奇点风暴', 'base');
    push('增幅矩阵 I', 'mult');
    push('增幅矩阵 II', 'mult');
    push('增幅矩阵 III', 'mult');
    push('迭代回路 I', 'iter');
    push('迭代回路 II', 'iter');
    push('迭代回路 III', 'iter');
    push('迭代回路 IV', 'iter');
    push('高阶迭代 I', 'iter2');
    push('高阶迭代 II', 'iter2');
    push('高阶迭代 III', 'iter2');
    push('临界坍缩', 'core');
    push('世界之核', 'core');
    var extraRoles = ['mult', 'iter', 'mult', 'iter2', 'iter', 'core'];
    for (var i = 15; i < world.upgradeCount; i++) {
      var r = extraRoles[(i - 15) % extraRoles.length];
      push(world.name + '增幅 ' + (i - 14), r);
    }
    return list.slice(0, world.upgradeCount);
  };

  DQ.worldUpgradeMaxLevel = function (role) {
    if (role === 'core') return 5;
    return 10;
  };
  DQ.worldUpgradeCost = function (world, idx, lv) {
    var base = D(world.baseCost);
    var g = D(world.costGrowth);
    return base.mul(g.pow(idx)).mul(D(3).pow(lv));
  };

  /* ---------------------------- 剧情 ---------------------------- */
  DQ.STORY = {
    intro: { id: 'intro', title: '序章 · 幻梦创世', lines: [
      '……起初，只有一片空白。',
      '两个兴趣相投的爱好者——hyt 与 落雪——在这片空白中相遇了。',
      '「我们来创造一个世界观吧。」',
      '「一个未来会成长得很大（并非）的世界观。」',
      '于是，第一缕「幻梦之力」在虚无中悄然凝聚……',
    ] },
    trans1: { id: 'trans1', title: '世界观正式成型', lines: [
      '幻梦之力满溢，世界观正式成型。',
      '群已建，志同道合者开始聚集。',
      '一颗「原初之心」开始跳动。',
    ] },
    trans2: { id: 'trans2', title: '第二阶段 · 数值阶段', lines: [
      '原初之心圆满。',
      '现在，去触碰那名为「数值」的无限吧。',
    ] },
    trans3: { id: 'trans3', title: '世界观被撑破', lines: [
      '元数值冲破天际——世界，被撑破了。',
      '裂缝之中，第三阶段轰然开启。',
    ] },
    stage3intro: { id: 'stage3intro', title: '第三阶段 · 软上限界', lines: [
      '一头巨龙从裂缝中盘踞而出——「邪恶软上限」。',
      '「愚蠢的造物啊，我要给这个世界套上层层枷锁！」',
      '一位少年挺身而出：「阿塰」，落雪在斗蛐蛐中的投影。',
      '他将作为勇者，逐层破除那名为「软上限」的枷锁。',
    ] },
    A: { id: 'A', title: '剧情节点 A', lines: [
      '阿塰被软上限反噬，胸口剧痛，跪倒在地。',
      '「别放弃。」一个清冷的声音响起——落雪的投影若隐若现。',
      '「你每破一层，这个世界就多一分自由。」',
    ] },
    B: { id: 'B', title: '剧情节点 B', lines: [
      '阿塰：「你到底是谁？为什么一直帮我？」',
      '落雪的投影：「邪恶软上限，只是世界意志派来的守门人。」',
      '「它设下的枷锁，是为了试炼你，也为了保护壳内的一切。」',
    ] },
    C: { id: 'C', title: '剧情节点 C', lines: [
      '一个温暖的声音从世界之外传来——那是 hyt。',
      '「阿塰，抬头看看。你以为的天，其实只是一层壳。」',
    ] },
    D: { id: 'D', title: '剧情节点 D · 最终对决', lines: [
      '阿塰与邪恶软上限展开最终对决。',
      '「这一击，为所有被枷锁困住的人！」',
      '轰——！两者同归于尽……爆了。',
      '世界开始崩塌。一个按钮浮现：「打破世界意志」。',
    ] },
    stage4intro: { id: 'stage4intro', title: '第四阶段 · world 嵌套', lines: [
      '世界意志被打破，你升华到了更高的层次。',
      '眼前，是一个又一个彼此嵌套的世界。',
      '真正的旅途，才刚刚开始。',
    ] },
    dragon: { id: 'dragon', title: '龙帝', lines: [
      '一位自称「龙帝」的神明登场，没有固定的形象。',
      '「孩子们，你们走完了所有世界。」',
      '「现在，随我一起，超脱这层层嵌套，抵达终点。」',
    ] },
  };

  DQ.worldEnterStory = function (world) {
    return { id: 'worldEnter' + world.id, title: '进入 world' + world.id + ' · ' + world.name, lines: world.enter };
  };
  DQ.worldClearStory = function (world) {
    return { id: 'worldClear' + world.id, title: 'world' + world.id + ' · ' + world.name + ' 通关', lines: world.clear };
  };

  /* ---------------------------- 默认存档 ---------------------------- */
  DQ.createState = function () {
    return {
      version: DQ.VERSION,
      stage: 0,
      dreamPower: 0,
      primalHeart: 0,
      metaValue: D(0),
      upgrades: [0, 0, 0, 0, 0, 0, 0, 0],
      stage3: {
        divergencePower: D(308.25),
        softcapIndex: 0,
        softcapsBroken: 0,
        upgrades: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        storyFlags: { A: false, B: false, C: false, D: false },
        worldWillBroken: false,
      },
      stage4: {
        world: 3,
        singularity: D(0),
        upgrades: {},
        challenges: {},
        unbreakable: {},
        worldCleared: {},
        frozen: false,
        frozenAt: 0,
      },
      story: { seenNodes: [], storyUnlocked: {} },
      meta: { stageReached: 0, stageProgress: {} },
      settings: { autoSave: true, autoSaveInterval: DQ.AUTO_SAVE_INTERVAL, offline: true },
      stats: { totalClicks: 0, playTimeMs: 0, startedAt: 0 },
      lastSaveAt: 0,
      pendingStory: null,
      bubble: { active: false, x: 0.5, y: 0.5, bornAt: 0, expiresAt: 0, exitAt: 0, nextSpawnAt: 0 },
      challengeActive: null,
      introSeen: false,
    };
  };

  DQ.completeState = function (s) {
    var def = DQ.createState();
    if (!s) return def;

    s.stage = Math.max(0, Math.min(4, Math.floor(numOrDef(s.stage, 0))));
    s.dreamPower = Math.max(0, numOrDef(s.dreamPower, 0));
    s.primalHeart = Math.max(0, numOrDef(s.primalHeart, 0));
    s.metaValue = toDec(s.metaValue, '0');

    s.upgrades = Array.isArray(s.upgrades) ? s.upgrades : def.upgrades;
    while (s.upgrades.length < 8) s.upgrades.push(0);
    for (var i = 0; i < 8; i++) {
      s.upgrades[i] = Math.max(0, Math.min(DQ.STAGE2_UPGRADES[i].maxLevel, Math.floor(numOrDef(s.upgrades[i], 0))));
    }

    s.stage3 = isPlainObject(s.stage3) ? s.stage3 : {};
    s.stage3.divergencePower = toDec(s.stage3.divergencePower, '308.25');
    s.stage3.softcapIndex = Math.max(0, Math.min(10, Math.floor(numOrDef(s.stage3.softcapIndex, 0))));
    s.stage3.softcapsBroken = Math.max(0, Math.min(10, Math.floor(numOrDef(s.stage3.softcapsBroken, 0))));
    s.stage3.upgrades = Array.isArray(s.stage3.upgrades) ? s.stage3.upgrades : def.stage3.upgrades;
    while (s.stage3.upgrades.length < 10) s.stage3.upgrades.push(0);
    for (var j = 0; j < 10; j++) s.stage3.upgrades[j] = Math.max(0, Math.min(1, Math.floor(numOrDef(s.stage3.upgrades[j], 0))));
    s.stage3.storyFlags = isPlainObject(s.stage3.storyFlags) ? s.stage3.storyFlags : { A: false, B: false, C: false, D: false };
    s.stage3.worldWillBroken = !!s.stage3.worldWillBroken;

    s.stage4 = isPlainObject(s.stage4) ? s.stage4 : {};
    s.stage4.world = Math.max(3, Math.min(9, Math.floor(numOrDef(s.stage4.world, 3))));
    s.stage4.singularity = toDec(s.stage4.singularity, '0');
    s.stage4.upgrades = isPlainObject(s.stage4.upgrades) ? s.stage4.upgrades : {};
    s.stage4.challenges = isPlainObject(s.stage4.challenges) ? s.stage4.challenges : {};
    s.stage4.unbreakable = isPlainObject(s.stage4.unbreakable) ? s.stage4.unbreakable : {};
    s.stage4.worldCleared = isPlainObject(s.stage4.worldCleared) ? s.stage4.worldCleared : {};
    for (var w = 0; w < DQ.WORLDS.length; w++) {
      var wid = DQ.WORLDS[w].id;
      var wu = DQ.buildWorldUpgrades(DQ.WORLDS[w]);
      if (!Array.isArray(s.stage4.upgrades[wid])) s.stage4.upgrades[wid] = [];
      while (s.stage4.upgrades[wid].length < wu.length) s.stage4.upgrades[wid].push(0);
      if (!Array.isArray(s.stage4.challenges[wid])) s.stage4.challenges[wid] = new Array(DQ.WORLDS[w].challengeCount).fill(false);
      if (!Array.isArray(s.stage4.unbreakable[wid])) s.stage4.unbreakable[wid] = new Array(DQ.WORLDS[w].unbreakableCount).fill(false);
      if (typeof s.stage4.worldCleared[wid] !== 'boolean') s.stage4.worldCleared[wid] = false;
    }
    s.stage4.frozen = !!s.stage4.frozen;
    s.stage4.frozenAt = numOrDef(s.stage4.frozenAt, 0);

    s.story = isPlainObject(s.story) ? s.story : { seenNodes: [], storyUnlocked: {} };
    if (!Array.isArray(s.story.seenNodes)) s.story.seenNodes = [];
    if (!isPlainObject(s.story.storyUnlocked)) s.story.storyUnlocked = {};
    s.meta = isPlainObject(s.meta) ? s.meta : { stageReached: 0, stageProgress: {} };
    s.meta.stageReached = Math.max(0, Math.min(4, Math.floor(numOrDef(s.meta.stageReached, 0))));
    s.settings = isPlainObject(s.settings) ? s.settings : { autoSave: true, autoSaveInterval: DQ.AUTO_SAVE_INTERVAL, offline: true };
    s.settings.autoSave = typeof s.settings.autoSave === 'boolean' ? s.settings.autoSave : true;
    s.settings.autoSaveInterval = numOrDef(s.settings.autoSaveInterval, DQ.AUTO_SAVE_INTERVAL);
    s.settings.offline = typeof s.settings.offline === 'boolean' ? s.settings.offline : true;
    s.stats = isPlainObject(s.stats) ? s.stats : { totalClicks: 0, playTimeMs: 0, startedAt: 0 };
    s.stats.totalClicks = Math.max(0, numOrDef(s.stats.totalClicks, 0));
    s.stats.playTimeMs = Math.max(0, numOrDef(s.stats.playTimeMs, 0));
    s.stats.startedAt = Math.max(0, numOrDef(s.stats.startedAt, 0));
    s.lastSaveAt = numOrDef(s.lastSaveAt, 0);

    s.pendingStory = (typeof s.pendingStory === 'string' && s.pendingStory) ? s.pendingStory : null;
    s.bubble = isPlainObject(s.bubble) ? s.bubble : def.bubble;
    s.introSeen = !!s.introSeen;
    s.challengeActive = isPlainObject(s.challengeActive) ? s.challengeActive : null;

    if (s.stage >= 3) {
      if (s.metaValue.lt(D(1e308))) s.metaValue = D(10).pow(D(308.25));
      if (s.stage3.divergencePower.lt(D(1))) s.stage3.divergencePower = s.metaValue.log10();
    }
    return s;
  };

  function toDec(v, def) {
    if (v == null) return D(def);
    if (v instanceof Decimal) return new Decimal(v);
    if (typeof v === 'string') {
      var d = Decimal.fromString(v);
      return Decimal.isNaN(d) ? D(def) : d;
    }
    if (typeof v === 'number') {
      if (v === Infinity) return new Decimal('Infinity');
      return D(v);
    }
    return D(def);
  }
  DQ.toDec = toDec;

  /* ---------------------------- 迁移（v1.0.0.0 → v1.0.0.1） ---------------------------- */
  DQ.migrate = function (raw) {
    if (!isPlainObject(raw)) return DQ.createState();
    var metaWasInfinity = raw.metaValue === 'Infinity' ||
      (typeof raw.metaValue === 'number' && !isFinite(raw.metaValue)) ||
      raw.endgame === true;
    var oldStage = Math.max(0, Math.min(2, Math.floor(numOrDef(raw.stage, 0))));

    var s = DQ.createState();
    s.dreamPower = Math.max(0, numOrDef(raw.dreamPower, 0));
    s.primalHeart = Math.max(0, numOrDef(raw.primalHeart, 0));

    if (oldStage === 2 && metaWasInfinity) {
      s.stage = 3;
      s.metaValue = D(10).pow(D(308.25));
      s.stage3.divergencePower = D(308.25);
      s.stage3.softcapIndex = 0;
      s.stage3.softcapsBroken = 0;
      s.pendingStory = 'stage3intro';
    } else {
      s.stage = oldStage;
      s.metaValue = toDec(raw.metaValue, '0');
      if (s.metaValue.gte(D(1e308))) {
        s.stage = 3;
        s.metaValue = D(10).pow(D(308.25));
        s.stage3.divergencePower = D(308.25);
        s.pendingStory = 'stage3intro';
      } else {
        if (s.stage >= 1 && s.dreamPower < 100) s.dreamPower = 100;
        if (s.stage >= 2 && s.primalHeart < 100) s.primalHeart = 100;
      }
    }

    if (Array.isArray(raw.upgrades)) {
      for (var i = 0; i < 8; i++) s.upgrades[i] = Math.max(0, Math.min(DQ.STAGE2_UPGRADES[i].maxLevel, Math.floor(numOrDef(raw.upgrades[i], 0))));
    }
    if (isPlainObject(raw.story)) {
      s.story.seenNodes = Array.isArray(raw.story.seenNodes) ? raw.story.seenNodes.slice() : [];
      s.story.storyUnlocked = isPlainObject(raw.story.storyUnlocked) ? JSON.parse(JSON.stringify(raw.story.storyUnlocked)) : {};
      s.introSeen = !!raw.story.storyUnlocked.intro;
    }
    if (isPlainObject(raw.meta)) {
      s.meta.stageReached = Math.max(0, Math.min(4, Math.floor(numOrDef(raw.meta.stageReached, 0))));
      s.meta.stageProgress = isPlainObject(raw.meta.stageProgress) ? JSON.parse(JSON.stringify(raw.meta.stageProgress)) : {};
    }
    if (isPlainObject(raw.settings)) {
      s.settings.autoSave = typeof raw.settings.autoSave === 'boolean' ? raw.settings.autoSave : true;
      s.settings.autoSaveInterval = numOrDef(raw.settings.autoSaveInterval, DQ.AUTO_SAVE_INTERVAL);
    }
    if (isPlainObject(raw.stats)) {
      s.stats.totalClicks = Math.max(0, numOrDef(raw.stats.totalClicks, 0));
      s.stats.playTimeMs = Math.max(0, numOrDef(raw.stats.playTimeMs, 0));
      s.stats.startedAt = Math.max(0, numOrDef(raw.stats.startedAt, 0));
    }
    s.lastSaveAt = numOrDef(raw.lastSaveAt, 0);

    s = DQ.completeState(s);
    s.version = DQ.VERSION;
    return s;
  };

  /* ---------------------------- 序列化 / 反序列化 ---------------------------- */
  DQ.serializeState = function (s) {
    var copy = {
      version: DQ.VERSION,
      stage: s.stage,
      dreamPower: s.dreamPower,
      primalHeart: s.primalHeart,
      metaValue: s.metaValue.toString(),
      upgrades: s.upgrades.slice(),
      stage3: {
        divergencePower: s.stage3.divergencePower.toString(),
        softcapIndex: s.stage3.softcapIndex,
        softcapsBroken: s.stage3.softcapsBroken,
        upgrades: s.stage3.upgrades.slice(),
        storyFlags: JSON.parse(JSON.stringify(s.stage3.storyFlags)),
        worldWillBroken: s.stage3.worldWillBroken,
      },
      stage4: {
        world: s.stage4.world,
        singularity: s.stage4.singularity.toString(),
        upgrades: JSON.parse(JSON.stringify(s.stage4.upgrades)),
        challenges: JSON.parse(JSON.stringify(s.stage4.challenges)),
        unbreakable: JSON.parse(JSON.stringify(s.stage4.unbreakable)),
        worldCleared: JSON.parse(JSON.stringify(s.stage4.worldCleared)),
        frozen: s.stage4.frozen,
        frozenAt: s.stage4.frozenAt,
      },
      story: { seenNodes: s.story.seenNodes.slice(), storyUnlocked: JSON.parse(JSON.stringify(s.story.storyUnlocked)) },
      meta: { stageReached: s.meta.stageReached, stageProgress: JSON.parse(JSON.stringify(s.meta.stageProgress)) },
      settings: { autoSave: s.settings.autoSave, autoSaveInterval: s.settings.autoSaveInterval, offline: s.settings.offline },
      stats: { totalClicks: s.stats.totalClicks, playTimeMs: s.stats.playTimeMs, startedAt: s.stats.startedAt },
      lastSaveAt: Date.now(),
      introSeen: s.introSeen,
      pendingStory: s.pendingStory,
    };
    var body = JSON.stringify(copy);
    var checksum = DQ.computeChecksum(body);
    copy.checksum = checksum;
    return JSON.stringify(copy);
  };

  DQ.deserializeState = function (json) {
    var raw;
    try { raw = JSON.parse(json); } catch (e) { return null; }
    if (!isPlainObject(raw)) return null;

    if (raw.checksum) {
      var body = JSON.parse(JSON.stringify(raw));
      delete body.checksum;
      var expect = DQ.computeChecksum(JSON.stringify(body));
      if (expect !== raw.checksum) return { tampered: true };
    } else if (raw.version !== DQ.PREV_VERSION) {
      return { tampered: true };
    }

    if (raw.version === DQ.VERSION) {
      return DQ.completeState(raw);
    }
    return DQ.migrate(raw);
  };
})(window);
