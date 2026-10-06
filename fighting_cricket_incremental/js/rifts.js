/* =========================================================================
 * rifts.js —— 10 个破限副本（每个独立小玩法）
 * 斗蛐蛐增量 v1.0.0.2
 * ======================================================================= */
(function (global) {
  'use strict';

  var DQ = (global.__DQ__ = global.__DQ__ || {});
  var Decimal = global.Decimal;
  var D = DQ.D;

  function def(id) { for (var i = 0; i < DQ.RIFTS.length; i++) if (DQ.RIFTS[i].id === id) return DQ.RIFTS[i]; return null; }
  function duration(id) {
    var m = { 1: 30000, 2: 60000, 3: 60000, 4: 60000, 5: 45000, 6: 30000, 7: 60000, 8: 0, 9: 20000, 10: 30000 };
    return m[id] || 30000;
  }
  function metaReward(s, mult) {
    var cap = DQ.currentSoftcap(s) || DQ.stage3Softcap(9);
    return D(10).pow(cap.sub(2)).mul(mult);
  }
  function finish(s, reward) {
    var r = s.riftActive;
    var rf = s.stage3.rifts[r.id];
    rf.cleared = true;
    rf.cooldownEnd = Date.now() + def(r.id).cooldownMs;
    // 永久加成
    DQ.riftApplyPermanent(s);
    if (r.id === 6) s.meta.stageProgress.riftGlobalMult = DQ.formatDecimal(DQ.riftGlobalMult(s).mul(D(1.5)));
    else if (r.id === 7) s.meta.stageProgress.riftAutoMult = DQ.formatDecimal(DQ.riftAutoMult(s).mul(D(2)));
    else if (r.id === 10) s.meta.stageProgress.riftGlobalMult = DQ.formatDecimal(DQ.riftGlobalMult(s).mul(D(2)));
    s.riftActive = null;
    s.riftResult = { id: r.id, reward: reward }; // 供 UI 展示
  }

  DQ.riftStart = function (s, id) {
    var d = def(id);
    if (!d) return { ok: false };
    var rf = s.stage3.rifts[id];
    if (rf.cooldownEnd > Date.now()) return { ok: false, cooldown: true };
    if (s.riftActive) return { ok: false };
    var data = {};
    if (d.type === 'click' || d.type === 'bubbles') data = { count: 0 };
    else if (d.type === 'defend') data = { hp: 100 };
    else if (d.type === 'memory') data = { round: 0, showing: true, seq: [], input: [], correct: 0 };
    else if (d.type === 'choice') data = { round: 0, correct: 0, answer: Math.round(Math.random()) };
    else if (d.type === 'invert') data = { hits: 0, tx: 0.5, ty: 0.5 };
    else if (d.type === 'puzzle') data = { step: 0, correct: 0 };
    else if (d.type === 'risk') data = {};
    else if (d.type === 'timing') data = {};
    else if (d.type === 'final') data = { clicks: 0, chosen: false, answer: Math.round(Math.random()) };
    s.riftActive = { id: id, type: d.type, phase: 'run', startAt: Date.now(), endAt: Date.now() + duration(id), data: data };
    if (d.type === 'memory') nextMemoryRound(s);
    if (d.type === 'invert') { s.riftActive.data.tx = Math.random(); s.riftActive.data.ty = Math.random(); }
    return { ok: true };
  };

  function nextMemoryRound(s) {
    var r = s.riftActive;
    r.data.showing = true;
    r.data.input = [];
    r.data.seq = [];
    var len = 3 + r.data.round;
    for (var i = 0; i < len; i++) r.data.seq.push(Math.floor(Math.random() * 4));
  }

  DQ.riftTick = function (s, dt) {
    var r = s.riftActive;
    if (!r) return;
    if (r.type === 'defend') {
      r.data.hp -= dt * 1.4;
      if (r.data.hp <= 0) { r.data.hp = 0; finish(s, metaReward(s, D(0.1))); return; }
    }
    if (r.type === 'invert') {
      // 目标周期性移动
      var t = (Date.now() - r.startAt) / 1000;
      r.data.tx = 0.5 + 0.4 * Math.sin(t * 3);
      r.data.ty = 0.5 + 0.4 * Math.cos(t * 2.3);
    }
    if (r.phase === 'run' && Date.now() >= r.endAt) {
      if (r.type === 'click') finish(s, metaReward(s, D(r.data.count).mul(D(0.05))));
      else if (r.type === 'bubbles') finish(s, metaReward(s, D(r.data.count).mul(D(0.1))));
      else if (r.type === 'defend') finish(s, metaReward(s, D(1)));
      else if (r.type === 'memory') finish(s, metaReward(s, D(1).add(D(r.data.correct).mul(D(0.5)))));
      else if (r.type === 'choice') finish(s, metaReward(s, D(1).add(D(r.data.correct).mul(D(0.5)))));
      else if (r.type === 'invert') finish(s, metaReward(s, D(2)));
      else if (r.type === 'puzzle') finish(s, metaReward(s, D(1).add(D(r.data.correct).mul(D(0.5)))));
      else if (r.type === 'timing') finish(s, metaReward(s, D(0.2)));
      else if (r.type === 'final') finish(s, metaReward(s, D(3)));
    }
  };

  DQ.riftAction = function (s, name, payload) {
    var r = s.riftActive;
    if (!r) return;
    var d = r.data;
    if (r.type === 'click' || r.type === 'bubbles') {
      if (name === 'hit') { d.count += 1; return; }
    } else if (r.type === 'defend') {
      if (name === 'repair') { d.hp = Math.min(100, d.hp + 20); return; }
    } else if (r.type === 'memory') {
      if (name === 'press') {
        d.input.push(payload.i);
        if (d.input.length >= d.seq.length) {
          var okRound = d.input.every(function (v, k) { return v === d.seq[k]; });
          if (okRound) d.correct += 1;
          d.round += 1;
          if (d.round >= 3) { finish(s, metaReward(s, D(1).add(D(d.correct).mul(D(0.5))))); return; }
          nextMemoryRound(s);
        }
        return;
      }
    } else if (r.type === 'choice') {
      if (name === 'choose') {
        if (payload.i === d.answer) d.correct += 1;
        d.round += 1;
        d.answer = Math.round(Math.random());
        if (d.round >= 5) { finish(s, metaReward(s, D(1).add(D(d.correct).mul(D(0.5))))); }
        return;
      }
    } else if (r.type === 'invert') {
      if (name === 'hit') { d.hits += 1; d.tx = Math.random(); d.ty = Math.random(); return; }
    } else if (r.type === 'puzzle') {
      if (name === 'solve') {
        var answers = [1, 2, 0]; // 3 步各自正确答案
        if (payload.i === answers[d.step]) d.correct += 1;
        d.step += 1;
        if (d.step >= 3) finish(s, metaReward(s, D(1).add(D(d.correct).mul(D(0.5)))));
        return;
      }
    } else if (r.type === 'risk') {
      if (name === 'steady') { finish(s, metaReward(s, D(0.5))); return; }
      if (name === 'bold') { finish(s, Math.random() < 0.5 ? metaReward(s, D(4)) : D(0)); return; }
    } else if (r.type === 'timing') {
      if (name === 'hit') {
        var elapsed = (Date.now() - r.startAt) / duration(9);
        if (elapsed < 0.3) finish(s, metaReward(s, D(0.1)));
        else if (elapsed > 0.95 && Math.random() < 0.4) finish(s, D(0)); // 贪心失败
        else finish(s, metaReward(s, D(elapsed * 5)));
        return;
      }
    } else if (r.type === 'final') {
      if (name === 'hit') { d.clicks += 1; return; }
      if (name === 'choose') { if (payload.i === d.answer) d.chosen = true; d.answer = Math.round(Math.random()); return; }
    }
  };

  /* 裂隙 6/10 的永久加成在通关时结算（见 riftTick / 主循环） */
  DQ.riftApplyPermanent = function (s) {
    if (!s.meta.stageProgress.riftGlobalMult) s.meta.stageProgress.riftGlobalMult = '1';
    if (!s.meta.stageProgress.riftAutoMult) s.meta.stageProgress.riftAutoMult = '1';
  };
  DQ.riftGlobalMult = function (s) { DQ.riftApplyPermanent(s); return D(s.meta.stageProgress.riftGlobalMult); };
  DQ.riftAutoMult = function (s) { DQ.riftApplyPermanent(s); return D(s.meta.stageProgress.riftAutoMult); };
})(window);
