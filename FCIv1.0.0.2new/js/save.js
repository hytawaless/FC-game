/* =========================================================================
 * save.js —— 存档/读档/备份/校验、硬重置（继承 + 扩展）
 * 斗蛐蛐增量 v1.0.0.2
 * ======================================================================= */
(function (global) {
  'use strict';

  var DQ = (global.__DQ__ = global.__DQ__ || {});
  var Decimal = global.Decimal;

  var storageAvailable = true;
  try { var t = '__dq_test__'; localStorage.setItem(t, '1'); localStorage.removeItem(t); } catch (e) { storageAvailable = false; }
  DQ.isStorageAvailable = function () { return storageAvailable; };

  DQ.saveGame = function (s) {
    if (!storageAvailable) return { ok: false, msg: '当前环境无法访问 localStorage' };
    try {
      var json = DQ.serializeState(s);
      var b0 = localStorage.getItem(DQ.BACKUP_KEYS[0]);
      var b1 = localStorage.getItem(DQ.BACKUP_KEYS[1]);
      localStorage.setItem(DQ.BACKUP_KEYS[2], b1);
      localStorage.setItem(DQ.BACKUP_KEYS[1], b0);
      localStorage.setItem(DQ.BACKUP_KEYS[0], json);
      localStorage.setItem(DQ.SAVE_KEY, json);
      return { ok: true, msg: '已保存 ' + new Date(s.lastSaveAt).toLocaleTimeString('zh-CN') };
    } catch (e) { return { ok: false, msg: '保存失败：' + e.message }; }
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
    for (var i = 0; i < DQ.BACKUP_KEYS.length; i++) {
      var bak = readAndDecode(DQ.BACKUP_KEYS[i]);
      if (bak.ok) { bak.msg = '检测到主存档异常，已自动从备份恢复'; bak.recovered = true; try { localStorage.setItem(DQ.SAVE_KEY, localStorage.getItem(DQ.BACKUP_KEYS[i])); } catch (e) {} return bak; }
    }
    return main;
  };
  DQ.hasSave = function () { return storageAvailable && !!localStorage.getItem(DQ.SAVE_KEY); };
  DQ.deleteSave = function () {
    if (!storageAvailable) return;
    localStorage.removeItem(DQ.SAVE_KEY);
    for (var i = 0; i < DQ.BACKUP_KEYS.length; i++) localStorage.removeItem(DQ.BACKUP_KEYS[i]);
  };

  function cloneState(s) {
    var r = DQ.deserializeState(DQ.serializeState(s));
    return (r && !r.tampered) ? r : DQ.completeState(s);
  }

  /* 硬重置：继承 v1.0.1 + 新增 仅重置第五阶段 / 仅重置当前world / 仅重置裂隙冷却 */
  DQ.performReset = function (s, opts) {
    opts = opts || {};
    var keepSettings = { autoSave: s.settings.autoSave, autoSaveInterval: s.settings.autoSaveInterval, offline: s.settings.offline };
    var D = DQ.D;

    if (opts.allReset) {
      var r0 = DQ.createState();
      r0.settings = JSON.parse(JSON.stringify(keepSettings));
      return DQ.completeState(r0);
    }
    if (opts.keepStory && opts.keepMeta) {
      var fix = cloneState(s);
      fix.settings = JSON.parse(JSON.stringify(keepSettings));
      fix.bubble = { active: false, x: 0.5, y: 0.5, bornAt: 0, expiresAt: 0, exitAt: 0, nextSpawnAt: 0 };
      fix.pendingStory = null; fix.challengeActive = null; fix.riftActive = null; fix.tribulation = null; fix.revival = null;
      return fix;
    }
    if (opts.onlyStage5) {
      var r5 = cloneState(s);
      r5.settings = JSON.parse(JSON.stringify(keepSettings));
      r5.stage5 = { entered: r5.stage5.entered, tribulationAttempts: 0, tribulationFails: 0, revivalWins: 0, revivalLosses: 0, ascended: false, storyReplay: r5.stage5.storyReplay };
      r5.tribulation = null; r5.revival = null;
      return r5;
    }
    if (opts.onlyStage4World) {
      var r4 = cloneState(s);
      r4.settings = JSON.parse(JSON.stringify(keepSettings));
      var wid = r4.stage4.world;
      r4.stage4.worlds[wid] = { resource: '0', upgrades: [], challenges: [], blocks: [], cleared: r4.stage4.worlds[wid].cleared, state: {} };
      r4.stage4.frozen = false; r4.stage4.frozenAt = 0;
      r4.pendingStory = null;
      return r4;
    }
    if (opts.onlyRifts) {
      var rr = cloneState(s);
      rr.settings = JSON.parse(JSON.stringify(keepSettings));
      for (var k in rr.stage3.rifts) rr.stage3.rifts[k].cooldownEnd = 0;
      rr.riftActive = null;
      return rr;
    }

    var res = DQ.createState();
    res.settings = JSON.parse(JSON.stringify(keepSettings));
    if (opts.keepStory) {
      res.story.seenNodes = s.story.seenNodes.slice();
      res.story.storyUnlocked = JSON.parse(JSON.stringify(s.story.storyUnlocked));
      res.introSeen = !!res.story.storyUnlocked.intro;
      return DQ.completeState(res);
    }
    if (opts.keepMeta) {
      var rm = cloneState(s);
      rm.settings = JSON.parse(JSON.stringify(keepSettings));
      rm.story.seenNodes = []; rm.story.storyUnlocked = {}; rm.introSeen = false;
      return DQ.completeState(rm);
    }
    return DQ.completeState(res);
  };
})(window);
