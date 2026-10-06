/* =========================================================================
 * ui.js —— 纯渲染层 + 事件绑定（只读快照渲染，事件调用公开 API）
 * 斗蛐蛐增量 v1.0.0.1
 * ======================================================================= */
(function (global) {
  'use strict';

  var DQ = (global.__DQ__ = global.__DQ__ || {});

  var dq = null;                 // 公开 API（main.js 注入）
  var dom = {};
  var bubbleEl = null;
  var toastTimer = null;
  var confirmArmed = false;
  var lastSnap = null;
  var listSigs = { stage2: '', stage3: '', stage4: '', ch: '', ub: '' };

  function $(id) { return document.getElementById(id); }

  /* ------------------------------ DOM 缓存 ------------------------------ */
  function cacheDom() {
    dom.statDreamValue = $('stat-dream-value');
    dom.statHeart = $('stat-heart'); dom.statHeartValue = $('stat-heart-value');
    dom.statMeta = $('stat-meta'); dom.statMetaValue = $('stat-meta-value');
    dom.statDp = $('stat-dp'); dom.statDpValue = $('stat-dp-value');
    dom.statSoftcap = $('stat-softcap'); dom.statSoftcapValue = $('stat-softcap-value');
    dom.statSingularity = $('stat-singularity'); dom.statSingularityValue = $('stat-singularity-value');
    dom.statWorld = $('stat-world'); dom.statWorldValue = $('stat-world-value');
    dom.main = $('main');
    dom.views = { 0: $('view-stage0'), 1: $('view-stage1'), 2: $('view-stage2'), 3: $('view-stage3'), 4: $('view-stage4') };
    dom.stage0Dream = $('stage0-dream'); dom.stage0Progress = $('stage0-progress'); dom.stage0Hint = $('stage0-hint');
    dom.stage1Heart = $('stage1-heart'); dom.stage1Progress = $('stage1-progress'); dom.stage1Hint = $('stage1-hint');
    dom.stage2Meta = $('stage2-meta'); dom.rateClick = $('rate-click'); dom.rateAuto = $('rate-auto');
    dom.btnSuccessor = $('btn-successor'); dom.stage2List = $('stage2-upgrade-list');
    dom.stage3Meta = $('stage3-meta'); dom.stage3Dp = $('stage3-dp');
    dom.stage3Progress = $('stage3-progress'); dom.stage3Hint = $('stage3-hint');
    dom.stage3Click = $('stage3-click'); dom.stage3Auto = $('stage3-auto');
    dom.btnSuccessor3 = $('btn-successor3'); dom.btnBreakWill = $('btn-break-will');
    dom.stage3List = $('stage3-upgrade-list');
    dom.stage4Title = $('stage4-title'); dom.stage4Theme = $('stage4-theme');
    dom.stage4Singularity = $('stage4-singularity'); dom.stage4Target = $('stage4-target');
    dom.stage4Progress = $('stage4-progress'); dom.stage4Hint = $('stage4-hint');
    dom.stage4UpgradeList = $('stage4-upgrade-list');
    dom.stage4Challenges = $('stage4-challenges'); dom.stage4Unbreakables = $('stage4-unbreakables');
    dom.stage4FreezeArea = $('stage4-freeze-area'); dom.btnFreeze = $('btn-freeze'); dom.btnUnfreeze = $('btn-unfreeze');
    dom.stage4FrozenNote = $('stage4-frozen-note');
    dom.bubbleLayer = $('bubble-layer');
    dom.storyOverlay = $('story-overlay'); dom.storyTitle = $('story-title'); dom.storyLines = $('story-lines');
    dom.offlineOverlay = $('offline-overlay'); dom.offlineLines = $('offline-lines');
    dom.footerStage = $('footer-stage');
    dom.chkAutosave = $('chk-autosave'); dom.autosaveToggle = $('chk-autosave').closest('.autosave-toggle');
    dom.toast = $('toast');
    dom.resetBackdrop = $('reset-backdrop');
    dom.optKeepStory = $('opt-keepStory'); dom.optKeepMeta = $('opt-keepMeta'); dom.optAllReset = $('opt-allReset');
    dom.optOnlyStage3 = $('opt-onlyStage3'); dom.optOnlyStage4 = $('opt-onlyStage4');
    dom.btnResetConfirm = $('btn-reset-confirm'); dom.btnAdvanced = $('btn-advanced'); dom.advancedOptions = $('advanced-options');
    dom.storylogBackdrop = $('storylog-backdrop'); dom.storylogList = $('storylog-list');
  }

  /* ------------------------------ 初始化 ------------------------------ */
  function init(publicApi) {
    dq = publicApi;
    cacheDom();
    bindEvents();
  }

  /* ------------------------------ 轻提示 ------------------------------ */
  function toast(msg) {
    if (!dom.toast) return;
    dom.toast.textContent = msg;
    dom.toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { dom.toast.classList.remove('show'); }, 2200);
  }

  function cleanup() {
    if (bubbleEl) { bubbleEl.remove(); bubbleEl = null; }
    if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
    if (dom.main) {
      var floats = dom.main.querySelectorAll('.float-text');
      for (var i = 0; i < floats.length; i++) floats[i].remove();
    }
    listSigs = { stage2: '', stage3: '', stage4: '', ch: '', ub: '' };
  }

  /* ------------------------------ 渲染 ------------------------------ */
  function render(snap) {
    lastSnap = snap;
    if (!snap) return;

    // 横幅
    dom.statDreamValue.textContent = snap.banner.dream.value;
    dom.statHeart.classList.toggle('locked', snap.banner.heart.locked);
    dom.statHeartValue.textContent = snap.banner.heart.value;
    dom.statMeta.classList.toggle('locked', snap.banner.meta.locked);
    dom.statMetaValue.textContent = snap.banner.meta.value;
    dom.statDp.classList.toggle('hidden', snap.banner.dp.locked);
    dom.statDpValue.textContent = snap.banner.dp.value;
    dom.statSoftcap.classList.toggle('hidden', snap.banner.softcap.locked);
    dom.statSoftcapValue.textContent = snap.banner.softcap.value;
    dom.statSingularity.classList.toggle('hidden', snap.banner.singularity.locked);
    dom.statSingularityValue.textContent = snap.banner.singularity.value;
    dom.statWorld.classList.toggle('hidden', snap.banner.world.locked);
    dom.statWorldValue.textContent = snap.banner.world.value;

    // 阶段视图
    for (var k = 0; k < 5; k++) dom.views[k].classList.toggle('hidden', k !== snap.stage);
    dom.footerStage.textContent = snap.footer.stageName;
    dom.chkAutosave.checked = snap.settings.autoSave;
    dom.autosaveToggle.classList.toggle('off', !snap.settings.autoSave);

    if (snap.stage === 0 && snap.stage0) {
      dom.stage0Dream.textContent = snap.stage0.dream;
      dom.stage0Progress.style.width = snap.stage0.progress + '%';
      dom.stage0Hint.textContent = snap.stage0.hint;
    } else if (snap.stage === 1 && snap.stage1) {
      dom.stage1Heart.textContent = snap.stage1.heart;
      dom.stage1Progress.style.width = snap.stage1.progress + '%';
      dom.stage1Hint.textContent = snap.stage1.hint;
    } else if (snap.stage === 2 && snap.stage2) {
      dom.stage2Meta.textContent = snap.stage2.meta;
      dom.rateClick.textContent = '+' + snap.stage2.click;
      dom.rateAuto.textContent = '+' + snap.stage2.auto + '/s';
      renderStage2List(snap.stage2.upgrades);
    } else if (snap.stage === 3 && snap.stage3) {
      dom.stage3Meta.textContent = snap.stage3.meta;
      dom.stage3Dp.textContent = snap.stage3.dp;
      dom.stage3Progress.style.width = snap.stage3.progress + '%';
      dom.stage3Hint.textContent = '已破除 ' + snap.stage3.softcapsBroken + '/' + snap.stage3.softcapTotal + ' · 当前上限 ' + snap.stage3.softcapCurrent;
      dom.stage3Click.textContent = '+' + snap.stage3.click;
      dom.stage3Auto.textContent = '+' + snap.stage3.auto + '/s';
      dom.btnBreakWill.classList.toggle('hidden', !snap.stage3.canBreakWorldWill);
      renderStage3List(snap.stage3.upgrades);
    } else if (snap.stage === 4 && snap.stage4) {
      dom.stage4Title.textContent = '第四阶段 · world' + snap.stage4.world + ' · ' + snap.stage4.worldName;
      dom.stage4Theme.textContent = snap.stage4.theme;
      dom.stage4Singularity.textContent = snap.stage4.singularity;
      dom.stage4Target.textContent = snap.stage4.targetLabel + '（' + snap.stage4.target + '）';
      dom.stage4Progress.style.width = snap.stage4.progress + '%';
      dom.stage4Hint.textContent = '通关进度 ' + Math.floor(snap.stage4.progress) + '%';
      renderStage4Lists(snap.stage4);
      dom.stage4FreezeArea.classList.toggle('hidden', !(snap.stage4.canFreeze || snap.stage4.frozen));
      dom.btnFreeze.classList.toggle('hidden', !snap.stage4.canFreeze);
      dom.btnUnfreeze.classList.toggle('hidden', !snap.stage4.frozen);
      dom.stage4FrozenNote.classList.toggle('hidden', !snap.stage4.frozen);
    }

    // 剧情 / 离线覆盖层
    if (snap.story) {
      dom.storyOverlay.classList.remove('hidden');
      dom.storyTitle.textContent = snap.story.title;
      dom.storyLines.innerHTML = '';
      for (var li = 0; li < snap.story.lines.length; li++) {
        var p = document.createElement('p');
        p.textContent = snap.story.lines[li];
        dom.storyLines.appendChild(p);
      }
    } else {
      dom.storyOverlay.classList.add('hidden');
    }
    if (snap.offline) {
      dom.offlineOverlay.classList.remove('hidden');
      var lines = ['你离开了 ' + fmtSeconds(snap.offline.seconds) + '。'];
      if (snap.offline.dreamGain > 0) lines.push('幻梦之力 +' + snap.offline.dreamGain);
      if (snap.offline.metaGain !== '0') lines.push('元数值 +' + snap.offline.metaGain);
      if (snap.offline.singularityGain !== '0') lines.push('宇宙奇点 +' + snap.offline.singularityGain);
      if (lines.length === 1) lines.push('没有新的产出。');
      dom.offlineLines.innerHTML = '';
      for (var l2 = 0; l2 < lines.length; l2++) {
        var p2 = document.createElement('p');
        p2.textContent = lines[l2];
        dom.offlineLines.appendChild(p2);
      }
    } else {
      dom.offlineOverlay.classList.add('hidden');
    }
  }

  function fmtSeconds(s) {
    if (s < 60) return s + ' 秒';
    if (s < 3600) return Math.floor(s / 60) + ' 分钟';
    return Math.floor(s / 3600) + ' 小时 ' + Math.floor((s % 3600) / 60) + ' 分钟';
  }

  /* ------------------------------ 列表渲染 ------------------------------ */
  function renderStage2List(items) {
    var sig = JSON.stringify(items);
    if (listSigs.stage2 === sig) return;
    listSigs.stage2 = sig;
    dom.stage2List.innerHTML = items.map(function (it, i) {
      return '<div class="upgrade-card">' +
        '<div class="upgrade-head"><div class="upgrade-name"><span class="upgrade-cn">' + it.name + '</span><span class="upgrade-en">' + it.en + '</span><span class="upgrade-genre">' + it.genre + '</span></div>' +
        '<div class="upgrade-level">Lv ' + it.level + '/' + it.max + '</div></div>' +
        '<div class="upgrade-desc">' + it.desc + '</div>' +
        '<div class="upgrade-effect">' + it.effect + '</div>' +
        '<div class="upgrade-foot"><div class="upgrade-cost">' + (it.maxed ? '已满级' : '成本：' + it.cost) + '</div>' +
        '<button class="btn btn-buy' + (it.affordable ? ' can-buy' : '') + '" data-stage="2" data-idx="' + i + '"' + (it.affordable ? '' : ' disabled') + '>' + (it.maxed ? '已满级' : '购买') + '</button></div></div>';
    }).join('');
  }

  function renderStage3List(items) {
    var sig = JSON.stringify(items);
    if (listSigs.stage3 === sig) return;
    listSigs.stage3 = sig;
    dom.stage3List.innerHTML = items.map(function (it, i) {
      var badge = it.current ? '<span class="badge-current">当前</span>' : '';
      return '<div class="upgrade-card' + (it.current ? ' current' : '') + '">' +
        '<div class="upgrade-head"><div class="upgrade-name"><span class="upgrade-cn">' + it.name + badge + '</span><span class="upgrade-en">破除软上限 ' + it.softcapNo + '</span></div>' +
        '<div class="upgrade-level">' + (it.maxed ? '已破除' : '待破除') + '</div></div>' +
        '<div class="upgrade-desc">' + it.desc + '</div>' +
        '<div class="upgrade-effect">' + it.effect + '</div>' +
        '<div class="upgrade-foot"><div class="upgrade-cost">' + (it.maxed ? '已破除' : '成本：' + it.cost) + '</div>' +
        '<button class="btn btn-buy' + (it.affordable ? ' can-buy' : '') + '" data-stage="3" data-idx="' + i + '"' + (it.affordable ? '' : ' disabled') + '>' + (it.maxed ? '已破除' : '破除') + '</button></div></div>';
    }).join('');
  }

  function renderStage4Lists(st4) {
    var upsig = JSON.stringify(st4.upgrades);
    if (listSigs.stage4 !== upsig) {
      listSigs.stage4 = upsig;
      dom.stage4UpgradeList.innerHTML = st4.upgrades.map(function (it, i) {
        return '<div class="upgrade-card">' +
          '<div class="upgrade-head"><div class="upgrade-name"><span class="upgrade-cn">' + it.name + '</span><span class="upgrade-en">' + roleLabel(it.role) + '</span></div>' +
          '<div class="upgrade-level">Lv ' + it.level + '/' + it.max + '</div></div>' +
          '<div class="upgrade-foot"><div class="upgrade-cost">' + (it.maxed ? '已满级' : '成本：' + it.cost) + '</div>' +
          '<button class="btn btn-buy' + (it.affordable ? ' can-buy' : '') + '" data-stage="4" data-idx="' + i + '"' + (it.affordable ? '' : ' disabled') + '>' + (it.maxed ? '已满级' : '购买') + '</button></div></div>';
      }).join('');
    }

    var chsig = JSON.stringify(st4.challenges);
    if (listSigs.ch !== chsig) {
      listSigs.ch = chsig;
      dom.stage4Challenges.innerHTML = st4.challenges.map(function (c, i) {
        var btn;
        if (c.done) btn = '<span class="done-tag">已完成 ✓</span>';
        else if (c.active) btn = '<button class="btn" data-act="exitCh">退出挑战</button>';
        else btn = '<button class="btn btn-buy can-buy" data-act="enterCh" data-idx="' + i + '">进入挑战</button>';
        return '<div class="challenge-item"><div class="ch-name">挑战 ' + (i + 1) + '</div><div class="ch-goal">目标：' + c.goal + '</div><div class="ch-act">' + btn + '</div></div>';
      }).join('');
    }

    var ubsig = JSON.stringify(st4.unbreakable);
    if (listSigs.ub !== ubsig) {
      listSigs.ub = ubsig;
      dom.stage4Unbreakables.innerHTML = st4.unbreakable.map(function (u, i) {
        var btn = u.bypassed
          ? '<span class="done-tag">已绕过 ✓</span>'
          : '<button class="btn btn-buy' + (u.affordable ? ' can-buy' : '') + '" data-act="bypass" data-idx="' + i + '"' + (u.affordable ? '' : ' disabled') + '>绕过（' + u.cost + '）</button>';
        return '<div class="challenge-item"><div class="ch-name">' + u.name + '</div><div class="ch-goal">永久性阻碍，只能绕过</div><div class="ch-act">' + btn + '</div></div>';
      }).join('');
    }
  }

  function roleLabel(role) {
    var map = { base: '基础产出', mult: '倍率', iter: '一阶迭代', iter2: '高阶迭代', core: '核心跃迁' };
    return map[role] || role;
  }

  /* ------------------------------ 泡泡 ------------------------------ */
  function renderBubble(view) {
    if (!view.visible || !view.active) {
      if (bubbleEl) { bubbleEl.remove(); bubbleEl = null; }
      return;
    }
    if (!bubbleEl) {
      bubbleEl = document.createElement('div');
      bubbleEl.className = 'bubble bubble--enter';
      bubbleEl.addEventListener('click', onBubbleClick);
      dom.bubbleLayer.appendChild(bubbleEl);
    }
    bubbleEl.style.left = (view.x * 100) + '%';
    bubbleEl.style.top = (view.y * 100) + '%';
    if (view.exitAt > 0) { bubbleEl.classList.add('bubble--exit'); bubbleEl.classList.remove('bubble--enter'); }
    else bubbleEl.classList.remove('bubble--exit');
  }

  function onBubbleClick(e) {
    spawnFloat(e, '+5%');
    if (dq) dq.clickBubble();
  }

  /* ------------------------------ 漂浮文字 ------------------------------ */
  function spawnFloat(e, text) {
    if (!dom.main) return;
    var rect = dom.main.getBoundingClientRect();
    var x = e.clientX - rect.left, y = e.clientY - rect.top;
    var el = document.createElement('div');
    el.className = 'float-text';
    el.textContent = text;
    el.style.left = x + 'px'; el.style.top = y + 'px';
    dom.main.appendChild(el);
    el.addEventListener('animationend', function () { el.remove(); });
  }

  /* ------------------------------ 事件 ------------------------------ */
  function bindEvents() {
    dom.btnSuccessor.addEventListener('click', function (e) { var g = lastSnap && lastSnap.stage2 ? '+' + lastSnap.stage2.click : '+1'; spawnFloat(e, g); if (dq) dq.clickSuccessor(); });
    dom.btnSuccessor3.addEventListener('click', function (e) { var g = lastSnap && lastSnap.stage3 ? '+' + lastSnap.stage3.click : '+1'; spawnFloat(e, g); if (dq) dq.clickSuccessor(); });
    dom.btnBreakWill.addEventListener('click', function () { if (dq) dq.breakWorldWill(); });
    dom.btnFreeze.addEventListener('click', function () { if (dq) dq.freezeSave(); });
    dom.btnUnfreeze.addEventListener('click', function () { if (dq) dq.unfreezeSave(); });
    dom.btnStoryNext = $('btn-story-next');
    dom.btnStoryNext.addEventListener('click', function () { if (dq) dq.advanceStory(); });
    $('btn-offline-next').addEventListener('click', function () { if (dq) dq.dismissOffline(); });

    // 升级列表（事件委托）
    dom.stage2List.addEventListener('click', onBuyClick);
    dom.stage3List.addEventListener('click', onBuyClick);
    dom.stage4UpgradeList.addEventListener('click', onBuyClick);
    dom.stage4Challenges.addEventListener('click', onStage4Act);
    dom.stage4Unbreakables.addEventListener('click', onStage4Act);

    // 页脚
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
    var btn = e.target.closest('button[data-idx]');
    if (!btn || !dq) return;
    var stage = btn.getAttribute('data-stage');
    var idx = parseInt(btn.getAttribute('data-idx'), 10);
    if (stage === '2') dq.buyStage2Upgrade(idx);
    else if (stage === '3') dq.buyStage3Upgrade(idx);
    else if (stage === '4') dq.buyWorldUpgrade(idx);
  }

  function onStage4Act(e) {
    var btn = e.target.closest('button[data-act]');
    if (!btn || !dq) return;
    var act = btn.getAttribute('data-act');
    var idx = parseInt(btn.getAttribute('data-idx') || '0', 10);
    if (act === 'enterCh') dq.enterChallenge(idx);
    else if (act === 'exitCh') dq.exitChallenge();
    else if (act === 'bypass') dq.bypassUnbreakable(idx);
  }

  /* ------------------------------ 硬重置模态 ------------------------------ */
  function openResetModal() {
    confirmArmed = false;
    dom.btnResetConfirm.textContent = '确认重置';
    dom.btnResetConfirm.classList.remove('armed');
    dom.optKeepStory.checked = dom.optKeepMeta.checked = dom.optAllReset.checked = dom.optOnlyStage3.checked = dom.optOnlyStage4.checked = false;
    dom.resetBackdrop.classList.remove('hidden');
  }
  function closeResetModal() { dom.resetBackdrop.classList.add('hidden'); confirmArmed = false; }

  function confirmReset() {
    var keepStory = dom.optKeepStory.checked, keepMeta = dom.optKeepMeta.checked, allReset = dom.optAllReset.checked;
    var onlyStage3 = dom.optOnlyStage3.checked, onlyStage4 = dom.optOnlyStage4.checked;
    if (!keepStory && !keepMeta && !allReset && !onlyStage3 && !onlyStage4) { toast('请至少选择一种重置方式'); return; }
    if (!confirmArmed) {
      confirmArmed = true;
      dom.btnResetConfirm.textContent = '再次点击确认';
      dom.btnResetConfirm.classList.add('armed');
      toast('请再次点击以确认重置');
      return;
    }
    closeResetModal();
    if (dq) dq.reset({ keepStory: keepStory, keepMeta: keepMeta, allReset: allReset, onlyStage3: onlyStage3, onlyStage4: onlyStage4 });
  }

  /* ------------------------------ 剧情图鉴 ------------------------------ */
  function openStoryLog() {
    if (!lastSnap || !lastSnap.storyGallery) return;
    dom.storylogList.innerHTML = '';
    lastSnap.storyGallery.forEach(function (it) {
      var div = document.createElement('div');
      div.className = 'storylog-item' + (it.seen ? '' : ' locked');
      div.innerHTML = '<div class="storylog-title">' + (it.seen ? '✓ ' : '🔒 ') + it.title + '</div>' + (it.seen ? '<div class="storylog-text">已解锁</div>' : '<div class="storylog-text">（尚未解锁）</div>');
      dom.storylogList.appendChild(div);
    });
    dom.storylogBackdrop.classList.remove('hidden');
  }
  function closeStoryLog() { dom.storylogBackdrop.classList.add('hidden'); }

  DQ.ui = { init: init, render: render, renderBubble: renderBubble, cleanup: cleanup, toast: toast };
})(window);
