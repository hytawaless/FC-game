/* =========================================================================
 * save.js —— 存档/读档/备份/校验、硬重置语义（继承并扩展）
 * 斗蛐蛐增量 v1.0.0.1
 * ======================================================================= */
(function (global) {
  'use strict';

  var DQ = (global.__DQ__ = global.__DQ__ || {});
  var Decimal = global.Decimal;

  var storageAvailable = true;
  try {
    var t = '__dq_test__';
    localStorage.setItem(t, '1');
    localStorage.removeItem(t);
  } catch (e) { storageAvailable = false; }

  DQ.isStorageAvailable = function () { return storageAvailable; };

  /* --------------------------- 校验和 + 备份 --------------------------- */
  DQ.saveGame = function (s) {
    if (!storageAvailable) return { ok: false, msg: '当前环境无法访问 localStorage' };
    try {
      var json = DQ.serializeState(s);
      // 环形缓冲：保留最近 3 个合法备份
      var b0 = localStorage.getItem(DQ.BACKUP_KEYS[0]);
      var b1 = localStorage.getItem(DQ.BACKUP_KEYS[1]);
      localStorage.setItem(DQ.BACKUP_KEYS[2], b1);
      localStorage.setItem(DQ.BACKUP_KEYS[1], b0);
      localStorage.setItem(DQ.BACKUP_KEYS[0], json);
      localStorage.setItem(DQ.SAVE_KEY, json);
      return { ok: true, msg: '已保存 ' + new Date(s.lastSaveAt).toLocaleTimeString('zh-CN') };
    } catch (e) {
      return { ok: false, msg: '保存失败：' + e.message };
    }
  };

  function readAndDecode(key) {
    if (!storageAvailable) return { ok: false, state: null, msg: '当前环境无法访问 localStorage' };
    var json = localStorage.getItem(key);
    if (!json) return { ok: false, state: null, msg: '没有找到存档' };
    var res = DQ.deserializeState(json);
    if (res == null) return { ok: false, state: null, msg: '存档损坏，无法读取' };
    if (res && res.tampered) return { ok: false, state: null, tampered: true, msg: '检测到存档被篡改或损坏' };
    return { ok: true, state: res, msg: '读档成功' };
  }

  DQ.loadGame = function () {
    var main = readAndDecode(DQ.SAVE_KEY);
    if (main.ok) return main;
    // 主存档损坏/被篡改 → 尝试备份
    for (var i = 0; i < DQ.BACKUP_KEYS.length; i++) {
      var bak = readAndDecode(DQ.BACKUP_KEYS[i]);
      if (bak.ok) {
        bak.msg = '检测到主存档异常，已自动从备份恢复';
        bak.recovered = true;
        // 恢复主存档
        try { localStorage.setItem(DQ.SAVE_KEY, localStorage.getItem(DQ.BACKUP_KEYS[i])); } catch (e) {}
        return bak;
      }
    }
    return main; // 全失败，返回主存档的失败信息
  };

  DQ.hasSave = function () {
    if (!storageAvailable) return false;
    return !!localStorage.getItem(DQ.SAVE_KEY);
  };

  DQ.deleteSave = function () {
    if (!storageAvailable) return;
    localStorage.removeItem(DQ.SAVE_KEY);
    for (var i = 0; i < DQ.BACKUP_KEYS.length; i++) localStorage.removeItem(DQ.BACKUP_KEYS[i]);
  };

  /* -----------------------------------------------------------------------
   * 硬重置语义（继承 v1.0.0.0 + 新增第三/第四阶段粒度）
   * --------------------------------------------------------------------- */
  DQ.performReset = function (s, opts) {
    opts = opts || {};
    var keepStory = !!opts.keepStory;
    var keepMeta = !!opts.keepMeta;
    var allReset = !!opts.allReset;
    var onlyStage3 = !!opts.onlyStage3;
    var onlyStage4 = !!opts.onlyStage4;
    var D = DQ.D;

    var fresh = DQ.createState();
    var keepSettings = {
      autoSave: s.settings.autoSave,
      autoSaveInterval: s.settings.autoSaveInterval,
      offline: s.settings.offline,
    };

    // 全部重置：清空一切进度与剧情，settings 保留
    if (allReset) {
      var r = fresh;
      r.settings = JSON.parse(JSON.stringify(keepSettings));
      return DQ.completeState(r);
    }

    // 两者都勾选：仅自检修复
    if (keepStory && keepMeta) {
      var fixed = DQ.completeState(JSON.parse(JSON.stringify(toPlain(s))));
      fixed.settings = JSON.parse(JSON.stringify(keepSettings));
      fixed.bubble = { active: false, x: 0.5, y: 0.5, bornAt: 0, expiresAt: 0, exitAt: 0, nextSpawnAt: 0 };
      fixed.pendingStory = null;
      fixed.challengeActive = null;
      return fixed;
    }

    // 仅重置第三阶段
    if (onlyStage3) {
      var r3 = DQ.completeState(JSON.parse(JSON.stringify(toPlain(s))));
      r3.settings = JSON.parse(JSON.stringify(keepSettings));
      r3.stage = 3;
      r3.metaValue = D(10).pow(D(308.25));
      r3.stage3 = {
        divergencePower: D(308.25), softcapIndex: 0, softcapsBroken: 0,
        upgrades: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        storyFlags: { A: false, B: false, C: false, D: false }, worldWillBroken: false,
      };
      r3.pendingStory = 'stage3intro';
      r3.bubble = { active: false, x: 0.5, y: 0.5, bornAt: 0, expiresAt: 0, exitAt: 0, nextSpawnAt: 0 };
      return r3;
    }

    // 仅重置第四阶段当前 world
    if (onlyStage4) {
      var r4 = DQ.completeState(JSON.parse(JSON.stringify(toPlain(s))));
      r4.settings = JSON.parse(JSON.stringify(keepSettings));
      var wid = r4.stage4.world;
      var wu = DQ.buildWorldUpgrades(DQ.getWorld(wid));
      r4.stage4.singularity = D(0);
      r4.stage4.upgrades[wid] = wu.map(function () { return 0; });
      r4.stage4.challenges[wid] = r4.stage4.challenges[wid].map(function () { return false; });
      r4.stage4.unbreakable[wid] = r4.stage4.unbreakable[wid].map(function () { return false; });
      r4.stage4.frozen = false;
      r4.stage4.frozenAt = 0;
      r4.pendingStory = null;
      return r4;
    }

    var res = fresh;
    res.settings = JSON.parse(JSON.stringify(keepSettings));

    if (keepStory) {
      // 保留剧情，其余回第零阶段
      res.story.seenNodes = s.story.seenNodes.slice();
      res.story.storyUnlocked = JSON.parse(JSON.stringify(s.story.storyUnlocked));
      res.introSeen = !!res.story.storyUnlocked.intro;
      res.stage = 0;
      res.dreamPower = 0;
      res.primalHeart = 0;
      res.metaValue = D(0);
      res.upgrades = [0, 0, 0, 0, 0, 0, 0, 0];
      res.meta = { stageReached: 0, stageProgress: {} };
      res.pendingStory = null;
      return DQ.completeState(res);
    }

    if (keepMeta) {
      // 保留元进展（阶段与各阶段数值/升级/挑战/软上限），重置剧情
      res.stage = s.stage;
      res.dreamPower = s.dreamPower;
      res.primalHeart = s.primalHeart;
      res.metaValue = new Decimal(s.metaValue);
      res.upgrades = s.upgrades.slice();
      res.stage3 = {
        divergencePower: new Decimal(s.stage3.divergencePower),
        softcapIndex: s.stage3.softcapIndex,
        softcapsBroken: s.stage3.softcapsBroken,
        upgrades: s.stage3.upgrades.slice(),
        storyFlags: JSON.parse(JSON.stringify(s.stage3.storyFlags)),
        worldWillBroken: s.stage3.worldWillBroken,
      };
      res.stage4 = {
        world: s.stage4.world,
        singularity: new Decimal(s.stage4.singularity),
        upgrades: JSON.parse(JSON.stringify(s.stage4.upgrades)),
        challenges: JSON.parse(JSON.stringify(s.stage4.challenges)),
        unbreakable: JSON.parse(JSON.stringify(s.stage4.unbreakable)),
        worldCleared: JSON.parse(JSON.stringify(s.stage4.worldCleared)),
        frozen: s.stage4.frozen,
        frozenAt: s.stage4.frozenAt,
      };
      res.meta.stageReached = s.meta.stageReached;
      res.meta.stageProgress = JSON.parse(JSON.stringify(s.meta.stageProgress));
      res.introSeen = false;
      res.pendingStory = s.pendingStory;
      return DQ.completeState(res);
    }

    // 兜底
    return DQ.completeState(res);
  };

  /* 把含 Decimal 的状态转成纯对象（用于深拷贝，Decimal 转字符串） */
  function toPlain(s) {
    return JSON.parse(JSON.stringify({
      version: s.version, stage: s.stage, dreamPower: s.dreamPower, primalHeart: s.primalHeart,
      metaValue: s.metaValue.toString(), upgrades: s.upgrades.slice(),
      stage3: {
        divergencePower: s.stage3.divergencePower.toString(),
        softcapIndex: s.stage3.softcapIndex, softcapsBroken: s.stage3.softcapsBroken,
        upgrades: s.stage3.upgrades.slice(),
        storyFlags: s.stage3.storyFlags, worldWillBroken: s.stage3.worldWillBroken,
      },
      stage4: {
        world: s.stage4.world, singularity: s.stage4.singularity.toString(),
        upgrades: s.stage4.upgrades, challenges: s.stage4.challenges,
        unbreakable: s.stage4.unbreakable, worldCleared: s.stage4.worldCleared,
        frozen: s.stage4.frozen, frozenAt: s.stage4.frozenAt,
      },
      story: s.story, meta: s.meta, settings: s.settings, stats: s.stats,
      lastSaveAt: s.lastSaveAt, introSeen: s.introSeen, pendingStory: s.pendingStory,
    }));
  }
})(window);
