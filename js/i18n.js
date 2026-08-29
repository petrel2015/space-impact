/* =====================================================================
   Space Impact — i18n
   English / 简体中文. Detection: saved choice > browser language.
   Static markup uses data-i18n attributes; dynamic strings call SI.t().
   {x} placeholders in values are replaced via SI.t(key, {x: val}).
   No DOM access at load time, so node tests can require this file.
   ===================================================================== */
(function (global) {
  'use strict';

  var SI = global.SI = global.SI || {};
  var STORE_KEY = 'si-lang';

  var DICT = {
    en: {
      docTitle: 'Space Impact — Pixel Space Shooter',
      tagline: 'A tribute to the Nokia 3310 classic side-scroller. Levels & enemies are plain JSON — the browser is just the engine.',

      startBtn: 'Start',
      howTitle: 'How to play',
      howMove: 'Move: arrows / WASD · Fire: Space / J — one volley per press (enable Auto-fire in settings to hold-and-spray) · Pause: P / Esc.',
      howSpecial: 'Special: collect ⚡ energy blocks, unleash with K / X — a screen-clearing beam.',
      howItem: 'Items: P power up · S spread · L laser · M homing missiles · + heal · E energy · G shield · ◎ aim tracer.',
      howAim: 'Aim tracer item: for 20s a faint dashed line previews where your shots land, cross marks the hit — line up before you spend ammo.',
      howTouch: 'Touch: D-pad bottom-left, FIRE & BOMB bottom-right.',
      settingsTitle: 'Settings',
      difficultyLabel: 'Difficulty',
      diffCasual: 'Casual',
      diffStandard: 'Standard',
      diffTight: 'Tight',
      diffHardcore: 'Hardcore',
      themeLabel: 'Theme',
      themeRetro: 'Retro LCD',
      themeNight: 'Night',
      themePaper: 'Paper',
      soundLabel: 'Sound',
      autoFireLabel: 'Auto-fire (hold to spray)',
      highScoreLabel: 'High score',

      pauseTitle: 'Paused',
      resumeBtn: 'Resume',
      restartBtn: 'Restart',
      menuBtn: 'Menu',

      overTitle: 'GAME OVER',
      scoreLabel: 'Score',
      bestLabel: 'Best',
      newRecord: '★ New record! ★',
      retryBtn: 'Retry level',

      loadingText: 'Loading level data…',
      errorTitle: 'Failed to load game data',
      errorHelp: 'The browser blocked reading local JSON (file://). Run “python3 -m http.server” inside the space-impact folder, then open http://localhost:8000/',
      errorRetry: 'Retry',
      downloadTpl: 'Download level template',
      uploadLevel: 'Upload level JSON',
      uploadOk: 'Custom level loaded — good luck, pilot!',

      closeLabel: 'Close',

      codexBtn: 'Codex',
      codexTitle: 'Codex',
      codexTabEnemies: 'Enemies',
      codexTabItems: 'Items',
      codexProgress: 'Enemies {e}/{E} · Items {i}/{I}',
      codexLocked: 'Not yet encountered',
      codexFirstSeen: 'first appears in level {n}',
      codexStatHp: 'HP',
      codexStatScore: 'Score',
      codexStatSpeed: 'Speed',
      codexStatMovement: 'Movement',
      codexStatAttack: 'Attack',
      codexStatFireRate: 'Fire interval',
      codexStatBulletSpeed: 'Bullet speed',
      codexHabitat: 'Habitat',
      codexTagBoss: 'BOSS',
      codexTagMiniboss: 'MINIBOSS',
      codexSeconds: '{x}s',
      codexNoAttack: 'None (ramming only)',
      codexFootnote: 'All enemy bullets deal 1 damage, ramming deals 2. Each new loop: enemy HP ×1.4, speed ×1.12.',

      atkStraight: 'fires straight ahead',
      atkAimed: 'aimed shot at your position',
      atkFan: '{ways}-way fan spread',
      atkBurst: '{count}-round burst with jitter',
      atkSpiral: 'rotating spiral stream',
      atkCurtain: 'bullet curtain with one gap',
      atkCross: 'X-shaped diagonal cross',
      atkSpawn: 'releases {count} × {enemy}',
      atkCycle: 'cycles: {list}',

      mvStraight: 'flies straight left',
      mvSine: 'sine-wave weaving',
      mvDrift: 'slow vertical drift',
      mvHover: 'parks at mid-field and holds',
      mvChase: 'homes in on your altitude',
      mvBossHover: 'hovers with vertical sweep',
      mvZigzag: 'sharp zigzag dash',
      mvDive: 'hovers, then dive-bombs your row',
      mvPulse: 'advance-stop-advance rhythm',

      saveBtn: 'Save progress',
      continueBtn: 'Continue',
      saveModeTitle: 'Save progress',
      loadModeTitle: 'Continue game',
      saveSlotN: 'Slot {n}',
      saveEmpty: 'Empty slot',
      saveLevelLabel: 'Level {n}',
      saveLoopLabel: 'Loop {n}',
      saveSaveHint: 'Click a slot to overwrite it with current progress.',
      saveLoadHint: 'Click a slot to continue from it.',
      saveSavedToast: 'Saved to slot {n}.',
      saveClearedToast: 'Slot {n} cleared.',
      saveMissingLevel: 'Level data missing (custom level?)',
      saveDelete: 'Delete',

      storySkip: 'Skip',
      storyTitleL1: 'EP01 · The Drift',
      storyTitleL2: 'EP02 · Swarm Nebula',
      storyTitleL3: 'EP03 · Iron Graveyard',
      storyTitleL4: 'EP04 · The Blockade',
      storyTitleL5: 'EP05 · The Way Home',
      storyL1Open: 'Wake up, pilot. This is not home — cut through the debris field ahead first.',
      storyL1Clear: 'The Rockmaw is down. In the wreck’s nav bay, the first beacon is glowing.',
      storyL2Open: 'The beacon points to a crimson nebula. The swarm reads no IFF — only prey.',
      storyL2Clear: 'The Queen has fallen silent. The second beacon, still warm from the brood sac.',
      storyL3Open: 'The Iron Graveyard. Its defenses never slept — and you are not on their friend list.',
      storyL3Clear: 'Master Brain offline. The third beacon — and a message a hundred years old.',
      storyL4Open: 'The Blockade. They are the ones who threw you here — and the whole fleet is stolen.',
      storyL4Clear: 'The flagship capsizes. The last beacon, back where it belongs.',
      storyL5Open: 'Four beacons in place. The turbulence has dragged in every debt of the voyage — punch through, home is at the other end.',
      storyL5Clear: 'Out of the wormhole. Home port’s lights shine through the viewport. Welcome home.',

      footerNote: 'Runs entirely in your browser · levels & enemies are data-driven JSON',

      donateEntry: 'Buy me a coffee',
      donateTitle: 'Buy me a coffee',
      donateSubtitle: 'If this little tool helped you, you can buy the author a coffee.',
      donateAlipay: 'Alipay',
      donateWechatPay: 'WeChat Pay',
      donateScanAlipay: 'Scan with Alipay',
      donateScanWechat: 'Scan with WeChat',
      donateFallbackHint: 'Didn’t open automatically? Scan the QR code instead.',
      donateQrAlt: '{channel} tip QR code',
      donateQrError: 'QR code failed to load — close and retry.',
      donateClose: 'Close',

      errEnemyRef: 'Level “{lvl}” references unknown enemy “{id}”.',
      errSpriteRef: 'Enemy “{id}” references unknown sprite “{sp}”.',
      errMovement: 'Enemy “{id}” uses unknown movement “{mv}”.',
      errAttack: 'Enemy “{id}” uses unknown attack “{at}”.',
      errCycle: 'Enemy “{id}” cycle lists unknown attack “{at}”.',
      errFormation: 'Level “{lvl}” uses unknown formation “{f}”.',
      errField: 'Enemy “{id}”: field “{f}” is missing or invalid.',
      errLevelShape: 'Level file “{f}” is malformed (needs numeric id + events array).'
    },

    zh: {
      docTitle: '空间大战 — 像素空间射击',
      tagline: '致敬诺基亚 3310 经典横版射击。关卡与怪物都是 JSON 数据，前端只是一个解释引擎。',

      startBtn: '开始游戏',
      howTitle: '玩法',
      howMove: '移动：方向键 / WASD；射击：空格 / J —— 点按单发（设置里可开“自动连发”按住连射）；暂停：P / Esc。',
      howSpecial: '大招：吃 ⚡ 能量块充能，按 K / X 释放清屏激光。',
      howItem: '道具：P 火力 · S 散弹 · L 激光 · M 追踪导弹 · + 回血 · E 能量 · G 护盾 · ◎ 瞄准虚线。',
      howAim: '瞄准虚线道具：20 秒内淡淡的虚线预示弹道落点，命中点带十字标记——对准再开火，省子弹。',
      howTouch: '触屏：左下方向键，右下 FIRE 射击 / BOMB 大招。',
      settingsTitle: '设置',
      difficultyLabel: '难度',
      diffCasual: '轻松',
      diffStandard: '标准',
      diffTight: '紧凑',
      diffHardcore: '硬核',
      themeLabel: '主题',
      themeRetro: '复古黄绿',
      themeNight: '暗夜',
      themePaper: '纸墨',
      soundLabel: '音效',
      autoFireLabel: '自动连发（按住连射）',
      highScoreLabel: '最高分',

      pauseTitle: '已暂停',
      resumeBtn: '继续',
      restartBtn: '重新开始',
      menuBtn: '主菜单',

      overTitle: '游戏结束',
      scoreLabel: '得分',
      bestLabel: '最佳',
      newRecord: '★ 新纪录！★',
      retryBtn: '重试本关',

      loadingText: '正在加载关卡数据…',
      errorTitle: '游戏数据加载失败',
      errorHelp: '浏览器限制了 file:// 下读取本地 JSON。请在 space-impact 目录运行 python3 -m http.server，然后访问 http://localhost:8000/',
      errorRetry: '重试',
      downloadTpl: '下载关卡模板',
      uploadLevel: '上传关卡 JSON',
      uploadOk: '自定义关卡已加载，飞行员祝你好运！',

      closeLabel: '关闭',

      codexBtn: '图鉴',
      codexTitle: '图鉴',
      codexTabEnemies: '敌人',
      codexTabItems: '道具',
      codexProgress: '敌人 {e}/{E} · 道具 {i}/{I}',
      codexLocked: '尚未遭遇',
      codexFirstSeen: '首次出现于第 {n} 关',
      codexStatHp: '血量',
      codexStatScore: '得分',
      codexStatSpeed: '速度',
      codexStatMovement: '移动方式',
      codexStatAttack: '攻击方式',
      codexStatFireRate: '攻击间隔',
      codexStatBulletSpeed: '弹速',
      codexHabitat: '栖息地',
      codexTagBoss: 'BOSS',
      codexTagMiniboss: '精英',
      codexSeconds: '{x} 秒',
      codexNoAttack: '无远程攻击（仅碰撞）',
      codexFootnote: '敌方子弹均造成 1 点伤害，碰撞造成 2 点；每进入新一周目：敌人血量 ×1.4、速度 ×1.12。',

      atkStraight: '直线前射',
      atkAimed: '瞄准射击（锁定你的位置）',
      atkFan: '{ways} 向扇形弹',
      atkBurst: '{count} 连发点射（带散布）',
      atkSpiral: '旋转螺旋弹幕',
      atkCurtain: '留一道缺口的弹幕墙',
      atkCross: 'X 形斜向交叉弹',
      atkSpawn: '放出 {count} 只{enemy}',
      atkCycle: '循环使用：{list}',

      mvStraight: '直线左飞',
      mvSine: '正弦波飘移',
      mvDrift: '缓慢垂直漂移',
      mvHover: '飞至半场停驻',
      mvChase: '追踪你的高度',
      mvBossHover: '悬停并上下巡航',
      mvZigzag: '急促折线突进',
      mvDive: '悬停后俯冲你的航线',
      mvPulse: '走走停停的脉冲推进',

      saveBtn: '保存进度',
      continueBtn: '继续游戏',
      saveModeTitle: '保存进度',
      loadModeTitle: '继续游戏',
      saveSlotN: '档位 {n}',
      saveEmpty: '空档位',
      saveLevelLabel: '第 {n} 关',
      saveLoopLabel: '{n} 周目',
      saveSaveHint: '点击档位，当前进度将覆盖保存。',
      saveLoadHint: '点击档位，从该存档继续。',
      saveSavedToast: '已保存到档位 {n}。',
      saveClearedToast: '档位 {n} 已清空。',
      saveMissingLevel: '关卡数据缺失（自定义关卡？）',
      saveDelete: '删除',

      storySkip: '跳过',
      storyTitleL1: 'EP01 · 碎石回廊',
      storyTitleL2: 'EP02 · 猩红虫巢',
      storyTitleL3: 'EP03 · 钢铁坟场',
      storyTitleL4: 'EP04 · 掠夺者封锁线',
      storyTitleL5: 'EP05 · 归途·时空乱流',
      storyL1Open: '醒醒，飞行员。这里不是家——先穿过眼前的碎石带。',
      storyL1Clear: '岩喉兽倒下了。沉船的导航舱里，第一块信标在发光。',
      storyL2Open: '信标指向紫红星云。虫族不看敌我识别，只看猎物。',
      storyL2Clear: '蜂后沉默了。第二块信标，还带着卵鞘的温度。',
      storyL3Open: '钢铁坟场。守卫系统还醒着——它们的敌我名单上没有你。',
      storyL3Clear: '主脑下线。第三块信标，和一句一百年前的留言。',
      storyL4Open: '封锁线。就是他们把你抛到这里——整支舰队都是抢来的。',
      storyL4Clear: '旗舰倾覆。最后一块信标，回到它该在的地方。',
      storyL5Open: '四块信标就位。乱流把一路的旧账都卷进来了——冲过去，家就在另一头。',
      storyL5Clear: '跃出虫洞。母港的灯在舷窗里亮着。欢迎回家。',

      footerNote: '纯前端运行 · 关卡与怪物均为 JSON 数据驱动',

      donateEntry: '请作者喝杯咖啡',
      donateTitle: '请作者喝杯咖啡',
      donateSubtitle: '如果这个小工具帮到了你，可以请作者喝杯咖啡。',
      donateAlipay: '支付宝',
      donateWechatPay: '微信支付',
      donateScanAlipay: '打开支付宝扫一扫',
      donateScanWechat: '打开微信扫一扫',
      donateFallbackHint: '没有自动打开？请使用支付宝 / 微信扫码',
      donateQrAlt: '{channel}收款码',
      donateQrError: '二维码生成失败，请关闭后重试。',
      donateClose: '关闭',


      errEnemyRef: '关卡「{lvl}」引用了未知怪物「{id}」。',
      errSpriteRef: '怪物「{id}」引用了未知精灵图「{sp}」。',
      errMovement: '怪物「{id}」使用了未知移动方式「{mv}」。',
      errAttack: '怪物「{id}」使用了未知攻击方式「{at}」。',
      errCycle: '怪物「{id}」的 cycle 列表包含未知攻击「{at}」。',
      errFormation: '关卡「{lvl}」使用了未知编队「{f}」。',
      errField: '怪物「{id}」的字段「{f}」缺失或非法。',
      errLevelShape: '关卡文件「{f}」格式错误（需要数字 id 和 events 数组）。'
    }
  };

  var lang = 'en';

  function detect() {
    var saved = null;
    try { saved = global.localStorage && global.localStorage.getItem(STORE_KEY); } catch (e) {}
    if (saved === 'en' || saved === 'zh') return saved;
    var nav = (global.navigator && global.navigator.language) || '';
    return /^zh\b|\bzh/i.test(nav) ? 'zh' : 'en';
  }

  function t(key, params) {
    var table = DICT[lang] || DICT.en;
    var s = table[key] != null ? table[key] : DICT.en[key];
    if (s == null) return key;
    if (params) {
      Object.keys(params).forEach(function (k) {
        s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), String(params[k]));
      });
    }
    return s;
  }

  function applyToDom() {
    if (!global.document) return;
    var nodes = global.document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      var key = nodes[i].getAttribute('data-i18n');
      var val = t(key);
      if (val) nodes[i].textContent = val;
    }
    global.document.documentElement.setAttribute('lang', lang);
    if (global.document.title) global.document.title = t('docTitle');
  }

  function setLang(next) {
    lang = next;
    try { global.localStorage && global.localStorage.setItem(STORE_KEY, lang); } catch (e) {}
    applyToDom();
    /* widgets whose strings are set dynamically (not via data-i18n) follow this */
    if (global.document && typeof global.document.dispatchEvent === 'function') {
      global.document.dispatchEvent(new Event('langchange'));
    }
  }

  lang = detect();

  SI.i18n = {
    DICT: DICT,
    get lang() { return lang; },
    t: t,
    setLang: setLang,
    applyToDom: applyToDom
  };
})(typeof window !== 'undefined' ? window : globalThis);
