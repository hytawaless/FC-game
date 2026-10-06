/* =========================================================================
 * ui.js —— 纯渲染层 + 事件绑定（v1.0.0.2）
 * ======================================================================= */
(function (global) {
  'use strict';

  var DQ = (global.__DQ__ = global.__DQ__ || {});
  var dq = null, dom = {}, bubbleEl = null, toastTimer = null, confirmArmed = false, lastSnap = null;
  var listSigs = { s2: '', s3: '', s4: '', ch: '', ub: '', rifts: '', world: '' };

  function $(id) { return document.getElementById(id); }

  function cacheDom() {
    dom.statDreamValue = $('stat-dream-value');
    dom.statResourceLabel = $('stat-resource-label'); dom.statResourceValue = $('stat-resource-value'); dom.statResourceSub = $('stat-resource-sub');
    dom.main = $('main');
    dom.views = { 0: $('view-stage0'), 1: $('view-stage1'), 2: $('view-stage2'), 3: $('view-stage3'), 4: $('view-stage4'), 5: $('view-stage5') };
    dom.stage0Dream = $('stage0-dream'); dom.stage0Progress = $('stage0-progress'); dom.stage0Hint = $('stage0-hint');
    dom.stage1Heart = $('stage1-heart'); dom.stage1Progress = $('stage1-progress'); dom.stage1Hint = $('stage1-hint');
    dom.stage2Meta = $('stage2-meta'); dom.rateClick = $('rate-click'); dom.rateAuto = $('rate-auto'); dom.quickClick = $('quick-click');
    dom.btnSuccessor = $('btn-successor'); dom.stage2List = $('stage2-upgrade-list');
    dom.stage3Meta = $('stage3-meta'); dom.stage3Dp = $('stage3-dp'); dom.stage3Pb = $('stage3-pb');
    dom.stage3Progress = $('stage3-progress'); dom.stage3Hint = $('stage3-hint');
    dom.stage3Click = $('stage3-click'); dom.stage3Auto = $('stage3-auto');
    dom.btnSuccessor3 = $('btn-successor3'); dom.btnBreakWill = $('btn-break-will');
    dom.stage3List = $('stage3-upgrade-list'); dom.stage3Rifts = $('stage3-rifts');
    dom.stage4Title = $('stage4-title'); dom.stage4Theme = $('stage4-theme');
    dom.stage4Resource = $('stage4-resource'); dom.stage4ResourceName = $('stage4-resource-name'); dom.stage4Target = $('stage4-target');
    dom.stage4Progress = $('stage4-progress'); dom.stage4Hint = $('stage4-hint');
    dom.worldUi = $('world-ui'); dom.stage4UpgradeList = $('stage4-upgrade-list');
    dom.stage4Challenges = $('stage4-challenges'); dom.stage4Unbreakables = $('stage4-unbreakables');
    dom.stage4FreezeArea = $('stage4-freeze-area'); dom.btnFreeze = $('btn-freeze'); dom.btnUnfreeze = $('btn-unfreeze'); dom.btnEnterStage5 = $('btn-enter-stage5');
    dom.stage4FrozenNote = $('stage4-frozen-note');
    dom.stage5Pb = $('stage5-pb'); dom.stage5Winrate = $('stage5-winrate'); dom.stage5Fails = $('stage5-fails'); dom.stage5Revival = $('stage5-revival');
    dom.btnCultivate = $('btn-cultivate'); dom.stage5CultivateCost = $('stage5-cultivate-cost'); dom.btnTribulate = $('btn-tribulate');
    dom.stage5AscendedNote = $('stage5-ascended-note'); dom.tribulationArena = $('tribulation-arena'); dom.btnFreeze5 = $('btn-freeze5');
    dom.bubbleLayer = $('bubble-layer');
    dom.storyOverlay = $('story-overlay'); dom.storyTitle = $('story-title'); dom.storyLines = $('story-lines');
    dom.offlineOverlay = $('offline-overlay'); dom.offlineLines = $('offline-lines');
    dom.riftOverlay = $('rift-overlay'); dom.riftTitle = $('rift-title'); dom.riftBody = $('rift-body'); dom.riftTimer = $('rift-timer');
    dom.footerStage = $('footer-stage');
    dom.chkAutosave = $('chk-autosave'); dom.autosaveToggle = $('chk-autosave').closest('.autosave-toggle');
    dom.toast = $('toast');
    dom.resetBackdrop = $('reset-backdrop');
    dom.optKeepStory = $('opt-keepStory'); dom.optKeepMeta = $('opt-keepMeta'); dom.optAllReset = $('opt-allReset');
    dom.optOnlyStage5 = $('opt-onlyStage5'); dom.optOnlyStage4 = $('opt-onlyStage4'); dom.optOnlyRifts = $('opt-onlyRifts');
    dom.btnResetConfirm = $('btn-reset-confirm'); dom.btnAdvanced = $('btn-advanced'); dom.advancedOptions = $('advanced-options');
    dom.storylogBackdrop = $('storylog-backdrop'); dom.storylogList = $('storylog-list');
  }

  function init(publicApi) { dq = publicApi; cacheDom(); bindEvents(); }
  function toast(msg) {
    if (!dom.toast) return;
    dom.toast.textContent = msg; dom.toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { dom.toast.classList.remove('show'); }, 2200);
  }
  function cleanup() {
    if (bubbleEl) { bubbleEl.remove(); bubbleEl = null; }
    if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
    if (dom.main) { var f = dom.main.querySelectorAll('.float-text'); for (var i = 0; i < f.length; i++) f[i].remove(); }
    listSigs = { s2: '', s3: '', s4: '', ch: '', ub: '', rifts: '', world: '' };
  }
  function spawnFloat(e, text) {
    if (!dom.main) return;
    var rect = dom.main.getBoundingClientRect();
    var el = document.createElement('div');
    el.className = 'float-text'; el.textContent = text;
    el.style.left = (e.clientX - rect.left) + 'px'; el.style.top = (e.clientY - rect.top) + 'px';
    dom.main.appendChild(el);
    el.addEventListener('animationend', function () { el.remove(); });
  }

  /* ------------------------------ 渲染 ------------------------------ */
  function render(snap) {
    lastSnap = snap;
    if (!snap) return;
    // 横幅：幻梦之力 + 当前阶段资源
    dom.statDreamValue.textContent = snap.banner.dream;
    dom.statResourceLabel.textContent = snap.banner.resource.label;
    dom.statResourceValue.textContent = snap.banner.resource.value;
    dom.statResourceSub.textContent = snap.banner.resource.sub || '';
    for (var k = 0; k < 6; k++) dom.views[k].classList.toggle('hidden', k !== snap.stage);
    dom.footerStage.textContent = snap.footer.stageName;
    dom.chkAutosave.checked = snap.settings.autoSave;
    dom.autosaveToggle.classList.toggle('off', !snap.settings.autoSave);

    if (snap.stage === 0 && snap.stage0) { dom.stage0Dream.textContent = snap.stage0.dream; dom.stage0Progress.style.width = snap.stage0.progress + '%'; dom.stage0Hint.textContent = snap.stage0.hint; }
    else if (snap.stage === 1 && snap.stage1) { dom.stage1Heart.textContent = snap.stage1.heart; dom.stage1Progress.style.width = snap.stage1.progress + '%'; dom.stage1Hint.textContent = snap.stage1.hint; }
    else if (snap.stage === 2 && snap.stage2) {
      dom.stage2Meta.textContent = snap.stage2.meta;
      dom.rateClick.textContent = '+' + snap.stage2.click; dom.rateAuto.textContent = '+' + snap.stage2.auto + '/s';
      dom.quickClick.classList.toggle('hidden', !snap.stage2.quickClick);
      renderList(dom.stage2List, snap.stage2.upgrades, 's2', function (it, i) {
        return '<div class="upgrade-card"><div class="upgrade-head"><div class="upgrade-name"><span class="upgrade-cn">' + it.name + '</span><span class="upgrade-en">' + it.en + '</span><span class="upgrade-genre">' + it.genre + '</span></div><div class="upgrade-level">Lv ' + it.level + '/' + it.max + '</div></div><div class="upgrade-desc">' + it.desc + '</div><div class="upgrade-effect">' + it.effect + '</div><div class="upgrade-foot"><div class="upgrade-cost">' + (it.maxed ? '已满级' : '成本：' + it.cost) + '</div><button class="btn btn-buy' + (it.affordable ? ' can-buy' : '') + '" data-stage="2" data-idx="' + i + '"' + (it.affordable ? '' : ' disabled') + '>' + (it.maxed ? '已满级' : '购买') + '</button></div></div>';
      });
    }
    else if (snap.stage === 3 && snap.stage3) {
      dom.stage3Meta.textContent = snap.stage3.meta; dom.stage3Dp.textContent = snap.stage3.dp; dom.stage3Pb.textContent = snap.stage3.pb;
      dom.stage3Progress.style.width = snap.stage3.progress + '%';
      dom.stage3Hint.textContent = '已破除 ' + snap.stage3.softcapsBroken + '/' + snap.stage3.softcapTotal + ' · 当前上限 ' + snap.stage3.softcapCurrent;
      dom.stage3Click.textContent = '+' + snap.stage3.click; dom.stage3Auto.textContent = '+' + snap.stage3.auto + '/s';
      dom.btnBreakWill.classList.toggle('hidden', !snap.stage3.canBreakWorldWill);
      renderList(dom.stage3List, snap.stage3.upgrades, 's3', function (it, i) {
        var badge = it.current ? '<span class="badge-current">当前</span>' : '';
        return '<div class="upgrade-card' + (it.current ? ' current' : '') + '"><div class="upgrade-head"><div class="upgrade-name"><span class="upgrade-cn">' + it.name + badge + '</span><span class="upgrade-en">破除软上限 ' + it.softcapNo + '</span></div><div class="upgrade-level">' + (it.maxed ? '已破除' : '待破除') + '</div></div><div class="upgrade-desc">' + it.desc + '</div><div class="upgrade-effect">' + it.effect + '</div><div class="upgrade-foot"><div class="upgrade-cost">' + (it.maxed ? '已破除' : '成本：' + it.cost) + '</div><button class="btn btn-buy' + (it.affordable ? ' can-buy' : '') + '" data-stage="3" data-idx="' + i + '"' + (it.affordable ? '' : ' disabled') + '>' + (it.maxed ? '已破除' : '破除') + '</button></div></div>';
      });
      renderRifts(snap.stage3.rifts);
    }
    else if (snap.stage === 4 && snap.stage4) {
      dom.stage4Title.textContent = '第四阶段 · world' + snap.stage4.world + ' · ' + snap.stage4.worldName;
      dom.stage4Theme.textContent = snap.stage4.theme;
      dom.stage4Resource.textContent = snap.stage4.resource;
      dom.stage4ResourceName.textContent = snap.stage4.resourceName;
      dom.stage4Target.textContent = snap.stage4.targetLabel + '（' + snap.stage4.target + '）';
      dom.stage4Progress.style.width = snap.stage4.progress + '%';
      dom.stage4Hint.textContent = '通关进度 ' + Math.floor(snap.stage4.progress) + '%';
      dom.stage4FreezeArea.classList.toggle('hidden', !(snap.stage4.canFreeze || snap.stage4.canEnterStage5 || snap.stage4.frozen));
      dom.btnFreeze.classList.toggle('hidden', !snap.stage4.canFreeze);
      dom.btnUnfreeze.classList.toggle('hidden', !snap.stage4.frozen);
      dom.btnEnterStage5.classList.toggle('hidden', !snap.stage4.canEnterStage5 || snap.stage4.frozen);
      dom.stage4FrozenNote.classList.toggle('hidden', !snap.stage4.frozen);
      renderWorldUI(snap.stage4);
      renderStage4Lists(snap.stage4);
    }
    else if (snap.stage === 5 && snap.stage5) {
      dom.stage5Pb.textContent = snap.stage5.pb;
      dom.stage5Winrate.textContent = snap.stage5.winRate + '%';
      dom.stage5Fails.textContent = snap.stage5.tribulationFails;
      dom.stage5Revival.textContent = snap.stage5.revivalWins + '胜/' + snap.stage5.revivalLosses + '负';
      dom.stage5CultivateCost.textContent = snap.stage5.cultivateCost;
      dom.btnCultivate.disabled = !snap.stage5.canCultivate;
      dom.btnTribulate.disabled = !snap.stage5.canTribulate;
      dom.stage5AscendedNote.classList.toggle('hidden', !snap.stage5.ascended);
      dom.btnFreeze5.classList.toggle('hidden', !(snap.stage5.ascended || snap.frozen));
      dom.btnFreeze5.textContent = snap.frozen ? '解冻存档' : '冻结存档';
      renderArena(snap);
    }

    // 覆盖层
    if (snap.story) { dom.storyOverlay.classList.remove('hidden'); dom.storyTitle.textContent = snap.story.title; dom.storyLines.innerHTML = ''; for (var li = 0; li < snap.story.lines.length; li++) { var p = document.createElement('p'); p.textContent = snap.story.lines[li]; dom.storyLines.appendChild(p); } }
    else dom.storyOverlay.classList.add('hidden');
    if (snap.offline) {
      dom.offlineOverlay.classList.remove('hidden');
      var lines = ['你离开了 ' + fmtSec(snap.offline.seconds) + '。'];
      if (snap.offline.dreamGain > 0) lines.push('幻梦之力 +' + snap.offline.dreamGain);
      if (snap.offline.metaGain !== '0') lines.push('元数值 +' + snap.offline.metaGain);
      if (snap.offline.singularityGain !== '0') lines.push('宇宙奇点 +' + snap.offline.singularityGain);
      if (lines.length === 1) lines.push('没有新的产出。');
      dom.offlineLines.innerHTML = ''; for (var l2 = 0; l2 < lines.length; l2++) { var p2 = document.createElement('p'); p2.textContent = lines[l2]; dom.offlineLines.appendChild(p2); }
    } else dom.offlineOverlay.classList.add('hidden');

    renderRiftOverlay(snap);
  }

  function fmtSec(s) { if (s < 60) return s + ' 秒'; if (s < 3600) return Math.floor(s / 60) + ' 分钟'; return Math.floor(s / 3600) + ' 小时'; }

  function renderList(container, items, key, builder) {
    var sig = JSON.stringify(items);
    if (listSigs[key] === sig) return;
    listSigs[key] = sig;
    container.innerHTML = items.map(builder).join('');
  }

  function renderRifts(rifts) {
    var sig = JSON.stringify(rifts);
    if (listSigs.rifts === sig) return;
    listSigs.rifts = sig;
    dom.stage3Rifts.innerHTML = rifts.map(function (r) {
      var status = r.cleared ? '<span class="done-tag">已通关</span>' : (r.cooldown > 0 ? '<span class="cooldown">冷却 ' + r.cooldown + 's</span>' : '<button class="btn btn-buy can-buy" data-rift="' + r.id + '">进入</button>');
      return '<div class="rift-item"><div class="ch-name">' + r.name + '</div><div class="ch-goal">' + r.desc + '（奖励：' + r.rewardDesc + '）</div><div class="ch-act">' + status + '</div></div>';
    }).join('');
  }

  /* ---------- 第四阶段 world 专属 UI ---------- */
  function renderWorldUI(st4) {
    var sig = st4.world + ':' + JSON.stringify(st4.worldUI);
    if (listSigs.world === sig) return;
    listSigs.world = sig;
    var u = st4.worldUI || {};
    var h = '';
    if (st4.world === 3) {
      h = '<div class="world-ctl">负重值：<b>' + st4.resource + '</b> · 惯性：<b>' + u.momentum + '</b> · 速度：<b>' + u.speed + '</b></div><button class="btn btn-warn" data-act="discard">卸载（资源换惯性）</button>';
    } else if (st4.world === 4) {
      h = '<div class="world-ctl">共振匹配：<b>' + u.match + '%</b></div><div class="sliders">';
      for (var i = 0; i < 5; i++) h += '<div class="slider-row"><span>' + (i + 1) + '</span><input type="range" min="0" max="100" value="' + u.sliders[i] + '" data-act="setSlider" data-idx="' + i + '"><span class="target">目标 ' + u.targets[i] + '</span></div>';
      h += '</div>';
    } else if (st4.world === 5) {
      h = '<div class="world-ctl">刻印：<b>' + u.imprints + '</b> · 距下次回溯：<b>' + u.remain + 's</b></div>';
    } else if (st4.world === 6) {
      h = '<div class="world-ctl">左：<b>' + u.left + '</b> · 右：<b>' + u.right + '</b> · 平衡：<b>' + u.balance + '%</b></div><div class="world-ctl"><button class="btn" data-act="bias" data-idx="-1">偏向左</button><button class="btn" data-act="bias" data-idx="1">偏向右</button></div>';
    } else if (st4.world === 7) {
      h = '<div class="world-ctl">升级将在 <b>' + u.decayIn + 's</b> 后衰减。可维修或丢弃升级（见升级列表）。</div>';
    } else if (st4.world === 8) {
      h = '<div class="world-ctl">聚焦面板：</div><div class="panel-row">';
      for (var p = 0; p < u.panels.length; p++) h += '<button class="btn' + (u.panels[p].focused ? ' can-buy' : '') + '" data-act="focus" data-idx="' + p + '">' + u.panels[p].name + '（×' + u.panels[p].rate + '）</button>';
      h += '</div>';
    } else if (st4.world === 9) {
      h = '<div class="world-ctl">已命名概念：<b>' + u.namedCount + '/' + u.total + '</b> · 命名成本：<b>' + u.nameCost + '</b></div>' + (u.namedCount >= u.total ? '<button class="btn btn-warn" data-act="nameWorld">命名世界</button>' : '');
    }
    dom.worldUi.innerHTML = h;
  }

  function renderStage4Lists(st4) {
    var upsig = JSON.stringify(st4.upgrades);
    if (listSigs.s4 !== upsig) {
      listSigs.s4 = upsig;
      dom.stage4UpgradeList.innerHTML = st4.upgrades.map(function (it, i) {
        var extra = '';
        if (st4.world === 7) extra = '<button class="btn" data-act="repair" data-idx="' + i + '">维修</button><button class="btn" data-act="discard" data-idx="' + i + '">丢弃</button>';
        var buyBtn = st4.world === 9 ? '<button class="btn btn-buy can-buy" data-act="name" data-idx="' + i + '">命名</button>' : '<button class="btn btn-buy' + (it.affordable ? ' can-buy' : '') + '" data-stage="4" data-idx="' + i + '"' + (it.affordable ? '' : ' disabled') + '>' + (it.maxed ? '已满级' : '购买') + '</button>';
        return '<div class="upgrade-card"><div class="upgrade-head"><div class="upgrade-name"><span class="upgrade-cn">' + it.name + '</span><span class="upgrade-en">' + roleLabel(it.role) + '</span></div><div class="upgrade-level">Lv ' + it.level + '/' + it.max + '</div></div><div class="upgrade-foot"><div class="upgrade-cost">' + (it.maxed ? '已满级' : '成本：' + it.cost) + '</div><div class="upgrade-acts">' + buyBtn + extra + '</div></div></div>';
      }).join('');
    }
    var chsig = JSON.stringify(st4.challenges);
    if (listSigs.ch !== chsig) {
      listSigs.ch = chsig;
      dom.stage4Challenges.innerHTML = st4.challenges.map(function (c, i) {
        var btn = c.done ? '<span class="done-tag">已完成 ✓</span>' : (c.active ? '<button class="btn" data-act="exitCh">退出挑战</button>' : '<button class="btn btn-buy can-buy" data-act="enterCh" data-idx="' + i + '">进入挑战</button>');
        return '<div class="challenge-item"><div class="ch-name">挑战 ' + (i + 1) + '</div><div class="ch-goal">目标：' + c.goal + '</div><div class="ch-act">' + btn + '</div></div>';
      }).join('');
    }
    var ubsig = JSON.stringify(st4.blocks);
    if (listSigs.ub !== ubsig) {
      listSigs.ub = ubsig;
      dom.stage4Unbreakables.innerHTML = st4.blocks.map(function (u, i) {
        var btn = u.bypassed ? '<span class="done-tag">已绕过 ✓</span>' : '<button class="btn btn-buy' + (u.affordable ? ' can-buy' : '') + '" data-act="bypass" data-idx="' + i + '"' + (u.affordable ? '' : ' disabled') + '>绕过（' + u.cost + '）</button>';
        return '<div class="challenge-item"><div class="ch-name">阻碍 ' + (i + 1) + '</div><div class="ch-act">' + btn + '</div></div>';
      }).join('');
    }
  }

  function roleLabel(role) { var m = { base: '基础', mult: '倍率', iter: '迭代', iter2: '高阶迭代', core: '核心' }; return m[role] || role; }

  /* ---------- 裂隙 / 渡劫 / 复活赛演出 ---------- */
  function renderRiftOverlay(snap) {
    if (snap.riftResult && !snap.rift) {
      dom.riftOverlay.classList.remove('hidden');
      dom.riftTitle.textContent = '副本完成';
      dom.riftBody.innerHTML = '<div class="rift-result">获得奖励：<b>' + snap.riftResult.reward + '</b></div>';
      dom.riftTimer.innerHTML = '<button class="btn btn-primary" data-rift-act="dismiss">继续 ▸</button>';
      return;
    }
    if (!snap.rift) { dom.riftOverlay.classList.add('hidden'); return; }
    dom.riftOverlay.classList.remove('hidden');
    var r = snap.rift;
    dom.riftTitle.textContent = r.name + '（剩余 ' + r.remaining + 's）';
    var h = '';
    var d = r.data;
    if (r.type === 'click' || r.type === 'bubbles') h = '<button class="btn btn-primary btn-big rift-target" data-rift-act="hit">点击！</button><div>已点击：' + (d.count || 0) + '</div>';
    else if (r.type === 'defend') h = '<div class="hp-bar"><div class="hp-fill" style="width:' + Math.max(0, d.hp || 0) + '%"></div></div><button class="btn btn-primary" data-rift-act="repair">修复核心</button>';
    else if (r.type === 'memory') h = '<div>记住顺序：<b>' + (d.seq || []).join(' ') + '</b>（第 ' + ((d.round || 0) + 1) + ' 轮）</div><div class="mem-btns">' + [0, 1, 2, 3].map(function (i) { return '<button class="btn btn-primary" data-rift-act="press" data-idx="' + i + '">' + i + '</button>'; }).join('') + '</div>';
    else if (r.type === 'choice') h = '<div>二选一抉择（第 ' + ((d.round || 0) + 1) + '/5 次）</div><button class="btn btn-primary" data-rift-act="choose" data-idx="0">左</button><button class="btn btn-primary" data-rift-act="choose" data-idx="1">右</button>';
    else if (r.type === 'invert') h = '<button class="btn btn-primary btn-big rift-target" style="position:relative;left:' + ((d.tx - 0.5) * 200) + 'px;top:' + ((d.ty - 0.5) * 100) + 'px" data-rift-act="hit">命中！</button><div>已命中：' + (d.hits || 0) + '</div>';
    else if (r.type === 'puzzle') h = '<div>3 步谜题（第 ' + ((d.step || 0) + 1) + '/3 步）</div>' + [0, 1, 2].map(function (i) { return '<button class="btn btn-primary" data-rift-act="solve" data-idx="' + i + '">方案 ' + (i + 1) + '</button>'; }).join('');
    else if (r.type === 'risk') h = '<div>选择策略</div><button class="btn" data-rift-act="steady">稳健（小收益）</button><button class="btn btn-warn" data-rift-act="bold">激进（大收益或全损）</button>';
    else if (r.type === 'timing') h = '<div>越晚点击收益越高，但可能失败</div><button class="btn btn-primary btn-big" data-rift-act="hit">现在点击</button>';
    else if (r.type === 'final') h = '<button class="btn btn-primary btn-big rift-target" data-rift-act="hit">点击</button><div>已点击：' + (d.clicks || 0) + '</div><div class="mem-btns"><button class="btn" data-rift-act="choose" data-idx="0">左</button><button class="btn" data-rift-act="choose" data-idx="1">右</button></div>';
    dom.riftBody.innerHTML = h;
    dom.riftTimer.innerHTML = '';
  }

  function renderArena(snap) {
    var h = '';
    if (snap.tribulation) {
      var t = snap.tribulation;
      h = '<div class="arena-text">⚡ 雷劫第 ' + t.round + '/3 轮' + (t.phase === 'anim' ? '（雷击酝酿中…）' : '（判定中…）') + '</div><div class="thunder">🌩️🌩️🌩️</div>';
    } else if (snap.revival) {
      var r = snap.revival;
      h = '<div class="arena-text">复活赛 第 ' + r.round + '/3 轮 · 对手力量基准 ' + r.opponentPB + '</div><div class="vs-bar"><div class="vs-fill p" style="width:50%"></div><div class="vs-fill o" style="width:50%"></div></div><div class="arena-text">已 ' + r.wins + ' 胜 / ' + r.losses + ' 负</div>';
    }
    dom.tribulationArena.innerHTML = h;
  }

  /* ------------------------------ 泡泡 ------------------------------ */
  function renderBubble(view) {
    if (!view.visible || !view.active) { if (bubbleEl) { bubbleEl.remove(); bubbleEl = null; } return; }
    if (!bubbleEl) { bubbleEl = document.createElement('div'); bubbleEl.className = 'bubble bubble--enter'; bubbleEl.addEventListener('click', onBubbleClick); dom.bubbleLayer.appendChild(bubbleEl); }
    bubbleEl.style.left = (view.x * 100) + '%'; bubbleEl.style.top = (view.y * 100) + '%';
    if (view.exitAt > 0) { bubbleEl.classList.add('bubble--exit'); bubbleEl.classList.remove('bubble--enter'); } else bubbleEl.classList.remove('bubble--exit');
  }
  function onBubbleClick(e) { spawnFloat(e, '+5%'); if (dq) dq.clickBubble(); }

  /* ------------------------------ 事件 ------------------------------ */
  function bindEvents() {
    dom.btnSuccessor.addEventListener('click', function (e) { var g = lastSnap && lastSnap.stage2 ? '+' + lastSnap.stage2.click : '+1'; spawnFloat(e, g); if (dq) dq.clickSuccessor(); });
    dom.btnSuccessor3.addEventListener('click', function (e) { var g = lastSnap && lastSnap.stage3 ? '+' + lastSnap.stage3.click : '+1'; spawnFloat(e, g); if (dq) dq.clickSuccessor(); });
    dom.btnBreakWill.addEventListener('click', function () { if (dq) dq.breakWorldWill(); });
    dom.btnFreeze.addEventListener('click', function () { if (dq) dq.freezeSave(); });
    dom.btnUnfreeze.addEventListener('click', function () { if (dq) dq.unfreezeSave(); });
    dom.btnEnterStage5.addEventListener('click', function () { if (dq) dq.enterStage5(); });
    dom.btnCultivate.addEventListener('click', function () { if (dq) dq.cultivate(); });
    dom.btnTribulate.addEventListener('click', function () { if (dq) dq.startTribulation(); });
    dom.btnFreeze5.addEventListener('click', function () { if (dq) { if (lastSnap && lastSnap.frozen) dq.unfreezeSave(); else dq.freezeSave(); } });
    $('btn-story-next').addEventListener('click', function () { if (dq) dq.advanceStory(); });
    $('btn-offline-next').addEventListener('click', function () { if (dq) dq.dismissOffline(); });

    dom.stage2List.addEventListener('click', onBuyClick);
    dom.stage3List.addEventListener('click', onBuyClick);
    dom.stage4UpgradeList.addEventListener('click', onStage4UpgradeClick);
    dom.stage4Challenges.addEventListener('click', onStage4Act);
    dom.stage4Unbreakables.addEventListener('click', onStage4Act);
    dom.worldUi.addEventListener('click', onWorldUiClick);
    dom.worldUi.addEventListener('input', onWorldUiInput);
    dom.stage3Rifts.addEventListener('click', function (e) { var b = e.target.closest('button[data-rift]'); if (b && dq) dq.riftStart(parseInt(b.getAttribute('data-rift'), 10)); });
    dom.riftBody.addEventListener('click', onRiftAct);
    dom.riftTimer.addEventListener('click', onRiftAct);

    $('btn-save').addEventListener('click', function () { if (dq) dq.save(); });
    $('btn-load').addEventListener('click', function () { if (dq) dq.load(); });
    dom.chkAutosave.addEventListener('change', function () { if (dq) { dq.setAutoSave(dom.chkAutosave.checked); toast(dom.chkAutosave.checked ? '自动存档已开启' : '自动存档已关闭'); } });
    $('btn-storylog').addEventListener('click', openStoryLog);
    $('btn-storylog-close').addEventListener('click', closeStoryLog);
    $('btn-reset').addEventListener('click', openResetModal);
    $('btn-reset-cancel').addEventListener('click', closeResetModal);
    dom.btnResetConfirm.addEventListener('click', confirmReset);
    dom.btnAdvanced.addEventListener('click', function () { dom.advancedOptions.classList.toggle('hidden'); });
    dom.resetBackdrop.addEventListener('click', function (e) { if (e.target === dom.resetBackdrop) closeResetModal(); });
    dom.storylogBackdrop.addEventListener('click', function (e) { if (e.target === dom.storylogBackdrop) closeStoryLog(); });
    document.addEventListener('keydown', function (e) {
      if (e.code === 'Space' || e.code === 'Enter') {
        if (!dom.storyOverlay.classList.contains('hidden')) { e.preventDefault(); if (dq) dq.advanceStory(); }
        else if (!dom.offlineOverlay.classList.contains('hidden')) { e.preventDefault(); if (dq) dq.dismissOffline(); }
      }
    });
  }

  function onBuyClick(e) {
    var b = e.target.closest('button[data-idx]');
    if (!b || !dq) return;
    var stage = b.getAttribute('data-stage');
    var i = parseInt(b.getAttribute('data-idx'), 10);
    if (stage === '2') dq.buyStage2Upgrade(i);
    else if (stage === '3') dq.buyStage3Upgrade(i);
  }
  function onStage4UpgradeClick(e) {
    var b = e.target.closest('button[data-act]');
    if (!b || !dq) return;
    var act = b.getAttribute('data-act'); var i = parseInt(b.getAttribute('data-idx'), 10);
    if (act === 'repair' || act === 'discard' || act === 'name') dq.worldAction(act, { i: i });
  }
  function onStage4Act(e) {
    var b = e.target.closest('button[data-act]');
    if (!b || !dq) return;
    var act = b.getAttribute('data-act'); var i = parseInt(b.getAttribute('data-idx') || '0', 10);
    if (act === 'enterCh') dq.enterChallenge(i);
    else if (act === 'exitCh') dq.exitChallenge();
    else if (act === 'bypass') dq.bypassUnbreakable(i);
  }
  function onWorldUiClick(e) {
    var b = e.target.closest('button[data-act]');
    if (!b || !dq) return;
    var act = b.getAttribute('data-act'); var i = parseInt(b.getAttribute('data-idx') || '0', 10);
    dq.worldAction(act, { i: i });
  }
  function onWorldUiInput(e) {
    var b = e.target.closest('input[data-act]');
    if (!b || !dq) return;
    dq.worldAction(b.getAttribute('data-act'), { i: parseInt(b.getAttribute('data-idx'), 10), v: parseInt(b.value, 10) });
  }
  function onRiftAct(e) {
    var b = e.target.closest('button[data-rift-act]');
    if (!b || !dq) return;
    var act = b.getAttribute('data-rift-act');
    var i = parseInt(b.getAttribute('data-idx') || '0', 10);
    if (act === 'dismiss') dq.dismissRiftResult();
    else dq.riftAction(act, { i: i });
  }

  /* ------------------------------ 硬重置模态 ------------------------------ */
  function openResetModal() {
    confirmArmed = false; dom.btnResetConfirm.textContent = '确认重置'; dom.btnResetConfirm.classList.remove('armed');
    dom.optKeepStory.checked = dom.optKeepMeta.checked = dom.optAllReset.checked = dom.optOnlyStage5.checked = dom.optOnlyStage4.checked = dom.optOnlyRifts.checked = false;
    dom.resetBackdrop.classList.remove('hidden');
  }
  function closeResetModal() { dom.resetBackdrop.classList.add('hidden'); confirmArmed = false; }
  function confirmReset() {
    var keepStory = dom.optKeepStory.checked, keepMeta = dom.optKeepMeta.checked, allReset = dom.optAllReset.checked;
    var onlyStage5 = dom.optOnlyStage5.checked, onlyStage4 = dom.optOnlyStage4.checked, onlyRifts = dom.optOnlyRifts.checked;
    if (!keepStory && !keepMeta && !allReset && !onlyStage5 && !onlyStage4 && !onlyRifts) { toast('请至少选择一种重置方式'); return; }
    if (!confirmArmed) { confirmArmed = true; dom.btnResetConfirm.textContent = '再次点击确认'; dom.btnResetConfirm.classList.add('armed'); toast('请再次点击以确认重置'); return; }
    closeResetModal();
    if (dq) dq.reset({ keepStory: keepStory, keepMeta: keepMeta, allReset: allReset, onlyStage5: onlyStage5, onlyStage4: onlyStage4, onlyRifts: onlyRifts });
  }

  function openStoryLog() {
    if (!lastSnap || !lastSnap.storyGallery) return;
    dom.storylogList.innerHTML = '';
    lastSnap.storyGallery.forEach(function (it) {
      var div = document.createElement('div');
      div.className = 'storylog-item' + (it.seen ? '' : ' locked');
      div.innerHTML = '<div class="storylog-title">' + (it.seen ? '✓ ' : '🔒 ') + it.title + '</div>';
      dom.storylogList.appendChild(div);
    });
    dom.storylogBackdrop.classList.remove('hidden');
  }
  function closeStoryLog() { dom.storylogBackdrop.classList.add('hidden'); }

  DQ.ui = { init: init, render: render, renderBubble: renderBubble, cleanup: cleanup, toast: toast };
})(window);
