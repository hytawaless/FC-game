/* =========================================================================
 * state.js —— 常量、配置、存档结构、迁移、序列化、校验和、大数格式化
 * 斗蛐蛐增量 v1.0.0.2
 * ======================================================================= */
(function (global) {
  'use strict';

  var DQ = (global.__DQ__ = global.__DQ__ || {});
  var Decimal = global.Decimal;

  DQ.VERSION = '1.0.0.2';
  DQ.PREV_VERSIONS = ['1.0.0.1', '1.0.0.0'];
  DQ.SAVE_KEY = 'douququ_save_v1';
  DQ.BACKUP_KEYS = ['douququ_save_v1_bak0', 'douququ_save_v1_bak1', 'douququ_save_v1_bak2'];
  DQ.AUTO_SAVE_INTERVAL = 10000;
  DQ.SALT = 'dq_v1_0_0_2_salt_9c2e';
  DQ.OFFLINE_CAP_MS = 8 * 60 * 60 * 1000;
  DQ.OFFLINE_MIN_MS = 30000;
  DQ.FIXED_STEP = 0.1;

  function D(x) { return new Decimal(x); }
  function numOrDef(v, def) { var n = Number(v); return (typeof v === 'number' && !isNaN(n)) ? n : def; }
  function isPlainObject(v) { return v && typeof v === 'object' && !Array.isArray(v); }
  DQ.D = D;

  /* ---------------------------- 大数格式化 ---------------------------- */
  function round2(x) { return String(Math.round(x * 100) / 100); }
  function withCommas(s) { var p = s.split('.'); p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ','); return p.join('.'); }
  function small(m) { return Number.isInteger(m) ? withCommas(String(m)) : withCommas(round2(m)); }
  function abbr(x, suf) { return round2(x) + suf; }
  function sci(m) { return m.toExponential(2).replace('e+', 'e'); }
  function sciPow(m) { var e = Math.floor(m); return (Math.pow(10, m - e)).toFixed(2) + 'e' + e; }
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
    if (!isFinite(L) || L < 1) L = 1;
    if (L > 1000) L = 1000;
    var prefix = '';
    for (var i = 1; i < L; i++) prefix += 'e';
    return prefix + ((m <= 308) ? sciPow(m) : ('e' + expStr(m)));
  }
  DQ.formatDecimal = function (d) {
    d = (d instanceof Decimal) ? d : D(d);
    if (Decimal.isNaN(d)) return 'NaN';
    if (Decimal.isInfinity(d)) return d.sign < 0 ? '-Infinity' : 'Infinity';
    if (d.sign === 0) return '0';
    return (d.sign < 0 ? '-' : '') + formatAbs(d.abs());
  };
  DQ.formatPercent = function (p) { return Math.floor(Math.max(0, Math.min(100, Number(p) || 0))) + '%'; };
  DQ.formatSmallNumber = function (n) { return small(Number(n) || 0); };

  /* ---------------------------- 校验和 ---------------------------- */
  DQ.fnv1a = function (str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    var s = h.toString(16); while (s.length < 8) s = '0' + s; return s;
  };
  DQ.computeChecksum = function (bodyStr) { return DQ.fnv1a(DQ.VERSION + '|' + DQ.SALT + '|' + bodyStr); };

  /* ---------------------------- 第二阶段升级（提速） ---------------------------- */
  DQ.STAGE2_UPGRADES = [
    { name: '量子自举', en: 'Quantum Bootstrap', genre: '科幻', desc: '个体意识的第一次跃迁。', effect: '每级使「后继」点击收益 +2。', cost: function (lv) { return D(10).mul(D(1.45).pow(lv)); }, maxLevel: 10 },
    { name: '戴森环', en: 'Dyson Ring', genre: '科幻', desc: '恒星级能源采集。', effect: '每级 +0.5/秒 自动产出。', cost: function (lv) { return D(100).mul(D(1.6).pow(lv)); }, maxLevel: 10 },
    { name: '意识上传', en: 'Mind Upload', genre: '科幻', desc: '思维脱离肉体，进入数字世界。', effect: '每级使点击与自动 ×1.5。', cost: function (lv) { return D(1000).mul(D(1.75).pow(lv)); }, maxLevel: 10 },
    { name: '时间钳形', en: 'Temporal Pincer', genre: '科幻', desc: '过去与未来同时向现在施压。', effect: '自动额外获得 点击收益 × 0.5 × 等级/秒。', cost: function (lv) { return D(10000).mul(D(1.9).pow(lv)); }, maxLevel: 10 },
    { name: '宇宙工程', en: 'Cosmic Engineering', genre: '科幻', desc: '把整个宇宙当作可改造的机器。', effect: '所有元数值获取 ×2/级。', cost: function (lv) { return D(1e6).mul(D(2.1).pow(lv)); }, maxLevel: 10 },
    { name: '维度折叠', en: 'Dimensional Folding', genre: '科幻', desc: '突破三维，折叠时空结构。', effect: '自动额外获得 元数值 × 1% × 等级/秒。', cost: function (lv) { return D(1e9).mul(D(2.5).pow(lv)); }, maxLevel: 10 },
    { name: '因果律重写', en: 'Causal Rewrite', genre: '科幻→神学', desc: '不再遵守因果，而是改写因果。', effect: '重写公式：点击=元数值×10%，自动=元数值^0.9+元数值×5%/秒。', cost: function () { return D(1e10); }, maxLevel: 1 },
    { name: '神说：要有光', en: 'Fiat Lux', genre: '神学', desc: '科幻终点是神学起点。', effect: '将元数值立即设为 Infinity，进入第三阶段。', cost: function () { return D(1e15); }, maxLevel: 1 },
  ];

  /* ---------------------------- 第三阶段 ---------------------------- */
  DQ.STAGE3_SOFTCAPS = ['308.25', '320', '340', '380', '440', '520', '650', '850', '1200', '2000'];
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
  DQ.stage3Cost = function (i) { return D(10).pow(D(DQ.STAGE3_SOFTCAPS[i]).sub(2)); };
  DQ.stage3Softcap = function (i) { return D(DQ.STAGE3_SOFTCAPS[i]); };

  /* ---------------------------- 裂隙副本 ---------------------------- */
  DQ.RIFTS = [
    { id: 1, name: '剑之裂隙', type: 'click', desc: '30 秒内点击目标尽可能多次。', cooldownMs: 180000, rewardDesc: '按点击数给元数值' },
    { id: 2, name: '盾之裂隙', type: 'defend', desc: '60 秒内守护核心不被击破。', cooldownMs: 180000, rewardDesc: 'DP 加成' },
    { id: 3, name: '影之裂隙', type: 'memory', desc: '记住并复现出现的顺序。', cooldownMs: 180000, rewardDesc: '一次性大额元数值' },
    { id: 4, name: '意志之裂隙', type: 'choice', desc: '连续 5 次二选一抉择。', cooldownMs: 240000, rewardDesc: '按正确率给奖励' },
    { id: 5, name: '泡沫之裂隙', type: 'bubbles', desc: '泡泡翻倍，限时 45 秒尽量点。', cooldownMs: 240000, rewardDesc: '按泡泡数结算' },
    { id: 6, name: '注视之裂隙', type: 'invert', desc: '光标反转，坚持 30 秒。', cooldownMs: 240000, rewardDesc: '全局倍率 +50%' },
    { id: 7, name: '回路之裂隙', type: 'puzzle', desc: '3 步数字谜题。', cooldownMs: 300000, rewardDesc: '永久自动产出加成' },
    { id: 8, name: '火种之裂隙', type: 'risk', desc: '稳健或激进的选择。', cooldownMs: 300000, rewardDesc: '小收益或大收益/全损' },
    { id: 9, name: '边缘之裂隙', type: 'timing', desc: '越晚点击收益越高，但有失败概率。', cooldownMs: 300000, rewardDesc: '高额元数值' },
    { id: 10, name: '斗蛐蛐之裂隙', type: 'final', desc: '综合前面所有机制。', cooldownMs: 300000, rewardDesc: '阿塰的意志（全局 ×2）' },
  ];

  /* ---------------------------- 第四阶段 world 元信息 ---------------------------- */
  DQ.WORLDS = [
    { id: 3, name: '负重之界', resourceName: '负重值', theme: '物理·质量', target: 'e9.000e15', targetLabel: '10^(9.000e15)',
      enter: ['主角团踏入了第一层嵌套世界。', '这里的一切，都因“质量”而变得沉重。'],
      clear: ['你卸下了最后一分负重。', '世界的壳，又薄了一层。'] },
    { id: 4, name: '共振之界', resourceName: '谐振度', theme: '波·共振', target: 'e1.000e16', targetLabel: '10^(1.000e16)',
      enter: ['五个频率在虚空中嗡鸣。', '唯有共振，才能抵达彼岸。'],
      clear: ['五弦合一，和声震彻。'] },
    { id: 5, name: '回溯之界', resourceName: '记忆残响', theme: '时间·循环', target: 'e1.000e17', targetLabel: '10^(1.000e17)',
      enter: ['时间在这里不停回溯。', '每一次重来，都会留下刻印。'],
      clear: ['你挣脱了循环。'] },
    { id: 6, name: '镜像之界', resourceName: '对偶值', theme: '对称·对偶', target: 'e1.000e18', targetLabel: '10^(1.000e18)',
      enter: ['左与右，光与影，此消彼长。'],
      clear: ['镜像破碎，虚实归一。'] },
    { id: 7, name: '熵之界', resourceName: '负熵', theme: '熵·衰变', target: 'e1.000e19', targetLabel: '10^(1.000e19)',
      enter: ['万事万物都在走向衰败。', '唯有你，逆熵而行。'],
      clear: ['你在此处，战胜了热寂。'] },
    { id: 8, name: '观测之界', resourceName: '观测值', theme: '观测·注意', target: 'e1.000e20', targetLabel: '10^(1.000e20)',
      enter: ['未被观测之物，便不存在。'],
      clear: ['你观测到了一切，也成为了被观测者。'] },
    { id: 9, name: '概念之界', resourceName: '名', theme: '命名·概念', target: 'ee9.000e15', targetLabel: '10^(10^(9.000e15))',
      enter: ['万物无名，则万物无存。'],
      clear: ['你为世界命名，世界由此诞生。'] },
  ];
  DQ.getWorld = function (id) {
    for (var i = 0; i < DQ.WORLDS.length; i++) if (DQ.WORLDS[i].id === id) return DQ.WORLDS[i];
    return DQ.WORLDS[0];
  };
  // 每个 world 的通用 15 升级（角色模板，具体机制在各 world 模块）
  DQ.buildWorldUpgrades = function (world) {
    var roles = ['base', 'base', 'base', 'mult', 'mult', 'mult', 'iter', 'iter', 'iter', 'iter', 'iter2', 'iter2', 'core', 'core', 'core'];
    var list = [];
    for (var i = 0; i < 15; i++) list.push({ name: world.name + '强化 ' + (i + 1), role: roles[i] });
    return list;
  };
  DQ.worldUpgradeMaxLevel = function (role) { return role === 'core' ? 5 : 10; };
  DQ.worldUpgradeCost = function (world, idx, lv) {
    return D(world.baseCost || '10').mul(D(world.costGrowth || '100').pow(idx)).mul(D(3).pow(lv));
  };

  /* ---------------------------- 剧情 ---------------------------- */
  DQ.STORY = {
    intro: { id: 'intro', title: '序章 · 幻梦创世', lines: ['……起初，只有一片空白。', '两个兴趣相投的爱好者——hyt 与 落雪——在这片空白中相遇了。', '「我们来创造一个世界观吧。」', '「一个未来会成长得很大（并非）的世界观。」', '于是，第一缕「幻梦之力」在虚无中悄然凝聚……'] },
    trans1: { id: 'trans1', title: '世界观正式成型', lines: ['幻梦之力满溢，世界观正式成型。', '群已建，志同道合者开始聚集。', '一颗「原初之心」开始跳动。'] },
    trans2: { id: 'trans2', title: '第二阶段 · 数值阶段', lines: ['原初之心圆满。', '现在，去触碰那名为「数值」的无限吧。'] },
    trans3: { id: 'trans3', title: '世界观被撑破', lines: ['元数值冲破天际——世界，被撑破了。', '裂缝之中，第三阶段轰然开启。'] },
    stage3intro: { id: 'stage3intro', title: '第三阶段 · 软上限界', lines: ['一头巨龙从裂缝中盘踞而出——「邪恶软上限」。', '「愚蠢的造物啊，我要给这个世界套上层层枷锁！」', '一位少年挺身而出：「阿塰」，落雪在斗蛐蛐中的投影。', '他将作为勇者，逐层破除那名为「软上限」的枷锁。'] },
    A: { id: 'A', title: '剧情节点 A', lines: ['阿塰被软上限反噬，胸口剧痛，跪倒在地。', '「别放弃。」落雪的投影若隐若现。', '「你每破一层，这个世界就多一分自由。」'] },
    B: { id: 'B', title: '剧情节点 B', lines: ['阿塰：「你到底是谁？为什么一直帮我？」', '落雪的投影：「邪恶软上限，只是世界意志派来的守门人。」', '「它设下的枷锁，是为了试炼你，也为了保护壳内的一切。」'] },
    C: { id: 'C', title: '剧情节点 C', lines: ['一个温暖的声音从世界之外传来——那是 hyt。', '「阿塰，抬头看看。你以为的天，其实只是一层壳。」'] },
    D: { id: 'D', title: '剧情节点 D · 最终对决', lines: ['阿塰与邪恶软上限展开最终对决。', '「这一击，为所有被枷锁困住的人！」', '轰——！两者同归于尽……爆了。', '世界开始崩塌。一个按钮浮现：「打破世界意志」。'] },
    stage4intro: { id: 'stage4intro', title: '第四阶段 · world 嵌套', lines: ['世界意志被打破，你升华到了更高的层次。', '眼前，是一个又一个彼此嵌套的世界。', '真正的旅途，才刚刚开始。'] },
    dragon: { id: 'dragon', title: '龙帝', lines: ['一位自称「龙帝」的神明登场，没有固定的形象。', '「孩子们，你们走完了所有世界。」', '「现在，随我一起，超脱这层层嵌套。」'] },
    stage5intro: { id: 'stage5intro', title: '第五阶段 · 前时代', lines: ['你站在 14 阶段与 15 阶段的分界点。', '要前往第 15 阶段，必须进行「证道渡劫」。', '唯有力量基准足够者，方有一线生机。'] },
    ascend: { id: 'ascend', title: '前时代终结 · 新时代开启', lines: ['三轮雷劫尽数渡过。', '你正式踏入第 15 阶段。', '一个旧时代终结，一个新时代开启。'] },
  };
  DQ.worldEnterStory = function (world) { return { id: 'worldEnter' + world.id, title: '进入 world' + world.id + ' · ' + world.name, lines: world.enter }; };
  DQ.worldClearStory = function (world) { return { id: 'worldClear' + world.id, title: 'world' + world.id + ' · ' + world.name + ' 通关', lines: world.clear }; };
  DQ.getStory = function (id) {
    if (DQ.STORY[id]) return DQ.STORY[id];
    if (id.indexOf('worldEnter') === 0) return DQ.worldEnterStory(DQ.getWorld(parseInt(id.slice('worldEnter'.length), 10)));
    if (id.indexOf('worldClear') === 0) return DQ.worldClearStory(DQ.getWorld(parseInt(id.slice('worldClear'.length), 10)));
    return { id: id, title: '', lines: [] };
  };

  /* ---------------------------- 默认存档 ---------------------------- */
  DQ.createState = function () {
    var rifts = {};
    for (var r = 0; r < DQ.RIFTS.length; r++) rifts[DQ.RIFTS[r].id] = { cleared: false, cooldownEnd: 0 };
    var worlds = {};
    for (var w = 0; w < DQ.WORLDS.length; w++) {
      var id = DQ.WORLDS[w].id;
      worlds[id] = { resource: '0', upgrades: [], challenges: [], blocks: [], cleared: false, state: {} };
    }
    return {
      version: DQ.VERSION,
      stage: 0,
      dreamPower: 0,
      primalHeart: 0,
      metaValue: D(0),
      powerBaseline: D(0),             // 全局力量基准（Decimal）
      upgrades: [0, 0, 0, 0, 0, 0, 0, 0],
      stage3: {
        divergencePower: D(308.25),
        softcapIndex: 0,
        softcapsBroken: 0,
        upgrades: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        rifts: rifts,
        storyFlags: { A: false, B: false, C: false, D: false },
        worldWillBroken: false,
      },
      stage4: {
        world: 3,
        worlds: worlds,
        frozen: false,
        frozenAt: 0,
      },
      stage5: {
        entered: false,
        tribulationAttempts: 0,
        tribulationFails: 0,
        revivalWins: 0,
        revivalLosses: 0,
        ascended: false,
        storyReplay: false,
      },
      story: { seenNodes: [], storyUnlocked: {} },
      meta: { stageReached: 0, stageProgress: {}, pbTimeMs: 0 },
      settings: { autoSave: true, autoSaveInterval: DQ.AUTO_SAVE_INTERVAL, offline: true },
      stats: { totalClicks: 0, playTimeMs: 0, startedAt: 0 },
      lastSaveAt: 0,
      pendingStory: null,
      bubble: { active: false, x: 0.5, y: 0.5, bornAt: 0, expiresAt: 0, exitAt: 0, nextSpawnAt: 0 },
      challengeActive: null,
      riftActive: null,                 // { id, type, phase, startAt, data:{...} }
      tribulation: null,                // { round, phase, startAt }
      revival: null,                    // { round, phase, startAt, opponentPB }
      quickClick: { count: 0, multUntil: 0 },
      introSeen: false,
    };
  };

  function toDec(v, def) {
    if (v == null) return D(def);
    if (v instanceof Decimal) return new Decimal(v);
    if (typeof v === 'string') { var d = Decimal.fromString(v); return Decimal.isNaN(d) ? D(def) : d; }
    if (typeof v === 'number') { if (v === Infinity) return new Decimal('Infinity'); return D(v); }
    return D(def);
  }
  DQ.toDec = toDec;

  /* ---------------------------- 字段补全 ---------------------------- */
  DQ.completeState = function (s) {
    var def = DQ.createState();
    if (!s) return def;

    s.stage = Math.max(0, Math.min(5, Math.floor(numOrDef(s.stage, 0))));
    s.dreamPower = Math.max(0, numOrDef(s.dreamPower, 0));
    s.primalHeart = Math.max(0, numOrDef(s.primalHeart, 0));
    s.metaValue = toDec(s.metaValue, '0');
    s.powerBaseline = toDec(s.powerBaseline, '0');

    s.upgrades = Array.isArray(s.upgrades) ? s.upgrades : def.upgrades;
    while (s.upgrades.length < 8) s.upgrades.push(0);
    for (var i = 0; i < 8; i++) s.upgrades[i] = Math.max(0, Math.min(DQ.STAGE2_UPGRADES[i].maxLevel, Math.floor(numOrDef(s.upgrades[i], 0))));

    // stage3
    s.stage3 = isPlainObject(s.stage3) ? s.stage3 : {};
    s.stage3.divergencePower = toDec(s.stage3.divergencePower, '308.25');
    s.stage3.softcapIndex = Math.max(0, Math.min(10, Math.floor(numOrDef(s.stage3.softcapIndex, 0))));
    s.stage3.softcapsBroken = Math.max(0, Math.min(10, Math.floor(numOrDef(s.stage3.softcapsBroken, 0))));
    s.stage3.upgrades = Array.isArray(s.stage3.upgrades) ? s.stage3.upgrades : def.stage3.upgrades;
    while (s.stage3.upgrades.length < 10) s.stage3.upgrades.push(0);
    for (var j = 0; j < 10; j++) s.stage3.upgrades[j] = Math.max(0, Math.min(1, Math.floor(numOrDef(s.stage3.upgrades[j], 0))));
    s.stage3.rifts = isPlainObject(s.stage3.rifts) ? s.stage3.rifts : {};
    for (var r = 0; r < DQ.RIFTS.length; r++) {
      var rid = DQ.RIFTS[r].id;
      if (!isPlainObject(s.stage3.rifts[rid])) s.stage3.rifts[rid] = { cleared: false, cooldownEnd: 0 };
      else { s.stage3.rifts[rid].cleared = !!s.stage3.rifts[rid].cleared; s.stage3.rifts[rid].cooldownEnd = numOrDef(s.stage3.rifts[rid].cooldownEnd, 0); }
    }
    s.stage3.storyFlags = isPlainObject(s.stage3.storyFlags) ? s.stage3.storyFlags : { A: false, B: false, C: false, D: false };
    s.stage3.worldWillBroken = !!s.stage3.worldWillBroken;

    // stage4
    s.stage4 = isPlainObject(s.stage4) ? s.stage4 : {};
    s.stage4.world = Math.max(3, Math.min(9, Math.floor(numOrDef(s.stage4.world, 3))));
    s.stage4.worlds = isPlainObject(s.stage4.worlds) ? s.stage4.worlds : {};
    for (var w = 0; w < DQ.WORLDS.length; w++) {
      var wid = DQ.WORLDS[w].id;
      if (!isPlainObject(s.stage4.worlds[wid])) s.stage4.worlds[wid] = { resource: '0', upgrades: [], challenges: [], blocks: [], cleared: false, state: {} };
      var wd = s.stage4.worlds[wid];
      wd.resource = toDec(wd.resource, '0');
      if (!Array.isArray(wd.upgrades)) wd.upgrades = [];
      if (!Array.isArray(wd.challenges)) wd.challenges = [];
      if (!Array.isArray(wd.blocks)) wd.blocks = [];
      wd.cleared = !!wd.cleared;
      if (!isPlainObject(wd.state)) wd.state = {};
    }
    s.stage4.frozen = !!s.stage4.frozen;
    s.stage4.frozenAt = numOrDef(s.stage4.frozenAt, 0);

    // stage5
    s.stage5 = isPlainObject(s.stage5) ? s.stage5 : {};
    s.stage5.entered = !!s.stage5.entered;
    s.stage5.tribulationAttempts = Math.max(0, Math.floor(numOrDef(s.stage5.tribulationAttempts, 0)));
    s.stage5.tribulationFails = Math.max(0, Math.floor(numOrDef(s.stage5.tribulationFails, 0)));
    s.stage5.revivalWins = Math.max(0, Math.floor(numOrDef(s.stage5.revivalWins, 0)));
    s.stage5.revivalLosses = Math.max(0, Math.floor(numOrDef(s.stage5.revivalLosses, 0)));
    s.stage5.ascended = !!s.stage5.ascended;
    s.stage5.storyReplay = !!s.stage5.storyReplay;

    // story/meta/settings/stats
    s.story = isPlainObject(s.story) ? s.story : { seenNodes: [], storyUnlocked: {} };
    if (!Array.isArray(s.story.seenNodes)) s.story.seenNodes = [];
    if (!isPlainObject(s.story.storyUnlocked)) s.story.storyUnlocked = {};
    s.meta = isPlainObject(s.meta) ? s.meta : { stageReached: 0, stageProgress: {}, pbTimeMs: 0 };
    s.meta.stageReached = Math.max(0, Math.min(5, Math.floor(numOrDef(s.meta.stageReached, 0))));
    s.meta.pbTimeMs = numOrDef(s.meta.pbTimeMs, 0);
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
    s.riftActive = isPlainObject(s.riftActive) ? s.riftActive : null;
    s.tribulation = isPlainObject(s.tribulation) ? s.tribulation : null;
    s.revival = isPlainObject(s.revival) ? s.revival : null;
    s.quickClick = isPlainObject(s.quickClick) ? s.quickClick : { count: 0, multUntil: 0 };

    if (s.stage >= 3 && s.metaValue.lt(D(1e308))) s.metaValue = D(10).pow(D(308.25));
    return s;
  };

  /* ---------------------------- 迁移 ---------------------------- */
  DQ.migrate = function (raw) {
    if (!isPlainObject(raw)) return DQ.createState();
    // 1.0.0.0 → 1.0.0.1 兼容层
    var ver = raw.version;
    if (ver === '1.0.0.0') {
      var metaWasInf = raw.metaValue === 'Infinity' || (typeof raw.metaValue === 'number' && !isFinite(raw.metaValue)) || raw.endgame === true;
      if (raw.stage === 2 && metaWasInf) { raw.stage = 3; raw.metaValue = '1e308'; }
      ver = '1.0.0.1';
    }

    var s = DQ.createState();
    s.dreamPower = Math.max(0, numOrDef(raw.dreamPower, 0));
    s.primalHeart = Math.max(0, numOrDef(raw.primalHeart, 0));
    s.metaValue = toDec(raw.metaValue, '0');
    s.stage = Math.max(0, Math.min(5, Math.floor(numOrDef(raw.stage, 0))));

    if (Array.isArray(raw.upgrades)) for (var i = 0; i < 8; i++) s.upgrades[i] = Math.max(0, Math.min(DQ.STAGE2_UPGRADES[i].maxLevel, Math.floor(numOrDef(raw.upgrades[i], 0))));
    if (isPlainObject(raw.story)) {
      s.story.seenNodes = Array.isArray(raw.story.seenNodes) ? raw.story.seenNodes.slice() : [];
      s.story.storyUnlocked = isPlainObject(raw.story.storyUnlocked) ? JSON.parse(JSON.stringify(raw.story.storyUnlocked)) : {};
      s.introSeen = !!raw.story.storyUnlocked.intro;
    }
    if (isPlainObject(raw.meta)) { s.meta.stageReached = Math.max(0, Math.min(5, Math.floor(numOrDef(raw.meta.stageReached, 0)))); s.meta.stageProgress = isPlainObject(raw.meta.stageProgress) ? JSON.parse(JSON.stringify(raw.meta.stageProgress)) : {}; }
    if (isPlainObject(raw.settings)) { s.settings.autoSave = typeof raw.settings.autoSave === 'boolean' ? raw.settings.autoSave : true; s.settings.autoSaveInterval = numOrDef(raw.settings.autoSaveInterval, DQ.AUTO_SAVE_INTERVAL); }
    if (isPlainObject(raw.stats)) { s.stats.totalClicks = Math.max(0, numOrDef(raw.stats.totalClicks, 0)); s.stats.playTimeMs = Math.max(0, numOrDef(raw.stats.playTimeMs, 0)); s.stats.startedAt = Math.max(0, numOrDef(raw.stats.startedAt, 0)); }
    s.lastSaveAt = numOrDef(raw.lastSaveAt, 0);

    // 迁移第三阶段
    if (isPlainObject(raw.stage3)) {
      s.stage3.divergencePower = toDec(raw.stage3.divergencePower, '308.25');
      s.stage3.softcapIndex = Math.max(0, Math.min(10, Math.floor(numOrDef(raw.stage3.softcapIndex, 0))));
      s.stage3.softcapsBroken = Math.max(0, Math.min(10, Math.floor(numOrDef(raw.stage3.softcapsBroken, 0))));
      if (Array.isArray(raw.stage3.upgrades)) for (var j = 0; j < 10; j++) s.stage3.upgrades[j] = Math.max(0, Math.min(1, Math.floor(numOrDef(raw.stage3.upgrades[j], 0))));
      s.stage3.storyFlags = isPlainObject(raw.stage3.storyFlags) ? JSON.parse(JSON.stringify(raw.stage3.storyFlags)) : { A: false, B: false, C: false, D: false };
      s.stage3.worldWillBroken = !!raw.stage3.worldWillBroken;
    }
    // 第四阶段完全重构：保留已通关 world 编号与冻结状态
    if (isPlainObject(raw.stage4)) {
      s.stage4.frozen = !!raw.stage4.frozen;
      s.stage4.frozenAt = numOrDef(raw.stage4.frozenAt, 0);
      var cleared = isPlainObject(raw.stage4.worldCleared) ? raw.stage4.worldCleared : {};
      var oldWorld = Math.max(3, Math.min(9, Math.floor(numOrDef(raw.stage4.world, 3))));
      var oldSingularity = toDec(raw.stage4.singularity, '0');
      s.stage4.world = oldWorld;
      for (var w = 0; w < DQ.WORLDS.length; w++) {
        var wid = DQ.WORLDS[w].id;
        s.stage4.worlds[wid] = { resource: '0', upgrades: [], challenges: [], blocks: [], cleared: !!cleared[wid], state: {} };
        if (wid === oldWorld && oldSingularity.gt(D(0))) s.stage4.worlds[wid].resource = oldSingularity; // 旧世界记忆补偿
      }
    }
    // 若原 stage 为 3/4 但 metaValue 未达标，补正
    if (s.stage >= 3 && s.metaValue.lt(D(1e308))) s.metaValue = D(10).pow(D(308.25));

    // 若原 stage 是 3 且 pendingStory 是旧 stage3intro
    s.pendingStory = (typeof raw.pendingStory === 'string' && raw.pendingStory) ? raw.pendingStory : null;
    if (s.stage === 3 && !s.pendingStory && !s.stage3.storyFlags.D && s.stage3.softcapsBroken === 0) s.pendingStory = 'stage3intro';

    return DQ.completeState(s);
  };

  /* ---------------------------- 序列化 ---------------------------- */
  DQ.serializeState = function (s) {
    var copy = {
      version: DQ.VERSION,
      stage: s.stage,
      dreamPower: s.dreamPower,
      primalHeart: s.primalHeart,
      metaValue: s.metaValue.toString(),
      powerBaseline: s.powerBaseline.toString(),
      upgrades: s.upgrades.slice(),
      stage3: {
        divergencePower: s.stage3.divergencePower.toString(),
        softcapIndex: s.stage3.softcapIndex,
        softcapsBroken: s.stage3.softcapsBroken,
        upgrades: s.stage3.upgrades.slice(),
        rifts: JSON.parse(JSON.stringify(s.stage3.rifts)),
        storyFlags: JSON.parse(JSON.stringify(s.stage3.storyFlags)),
        worldWillBroken: s.stage3.worldWillBroken,
      },
      stage4: {
        world: s.stage4.world,
        worlds: {},
        frozen: s.stage4.frozen,
        frozenAt: s.stage4.frozenAt,
      },
      stage5: JSON.parse(JSON.stringify(s.stage5)),
      story: { seenNodes: s.story.seenNodes.slice(), storyUnlocked: JSON.parse(JSON.stringify(s.story.storyUnlocked)) },
      meta: { stageReached: s.meta.stageReached, stageProgress: JSON.parse(JSON.stringify(s.meta.stageProgress)), pbTimeMs: s.meta.pbTimeMs },
      settings: { autoSave: s.settings.autoSave, autoSaveInterval: s.settings.autoSaveInterval, offline: s.settings.offline },
      stats: { totalClicks: s.stats.totalClicks, playTimeMs: s.stats.playTimeMs, startedAt: s.stats.startedAt },
      lastSaveAt: Date.now(),
      introSeen: s.introSeen,
      pendingStory: s.pendingStory,
    };
    for (var wid in s.stage4.worlds) {
      var wd = s.stage4.worlds[wid];
      copy.stage4.worlds[wid] = {
        resource: wd.resource.toString(),
        upgrades: (Array.isArray(wd.upgrades) ? wd.upgrades.slice() : []),
        challenges: JSON.parse(JSON.stringify(wd.challenges || [])),
        blocks: JSON.parse(JSON.stringify(wd.blocks || [])),
        cleared: wd.cleared,
        state: JSON.parse(JSON.stringify(wd.state || {})),
      };
    }
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
      if (DQ.computeChecksum(JSON.stringify(body)) !== raw.checksum) return { tampered: true };
    } else if (DQ.PREV_VERSIONS.indexOf(raw.version) === -1) {
      return { tampered: true };
    }
    if (raw.version === DQ.VERSION) return DQ.completeState(raw);
    return DQ.migrate(raw);
  };
})(window);
