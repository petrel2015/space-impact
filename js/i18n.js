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
      howMove: 'Move: arrows / WASD. Fire: Space / J (hold to auto-fire). P / Esc to pause.',
      howSpecial: 'Special: collect ⚡ energy blocks, unleash with K / X — a screen-clearing beam.',
      howItem: 'Items: P power up · S spread · L laser · + heal · E energy · G shield.',
      howTouch: 'Touch: D-pad bottom-left, FIRE & BOMB bottom-right.',
      settingsTitle: 'Settings',
      difficultyLabel: 'Difficulty',
      diffEasy: 'Easy',
      diffNormal: 'Normal',
      diffHard: 'Hard',
      themeLabel: 'Theme',
      themeRetro: 'Retro LCD',
      themeNight: 'Night',
      themePaper: 'Paper',
      soundLabel: 'Sound',
      autoFireLabel: 'Touch auto-fire',
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

      footerNote: 'Runs entirely in your browser · levels & enemies are data-driven JSON',

      hintControls: 'Move: arrows / WASD · Fire: Space / J (hold = auto) · Special: K / X · Pause: P / Esc',
      hintItems: 'Items: P power · S spread · L laser · + heal · E energy ⚡ · G shield',

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
      howMove: '移动：方向键 / WASD；射击：空格 / J（按住连发）；暂停：P / Esc。',
      howSpecial: '大招：吃 ⚡ 能量块充能，按 K / X 释放清屏激光。',
      howItem: '道具：P 火力 · S 散弹 · L 激光 · + 回血 · E 能量 · G 护盾。',
      howTouch: '触屏：左下方向键，右下 FIRE 射击 / BOMB 大招。',
      settingsTitle: '设置',
      difficultyLabel: '难度',
      diffEasy: '简单',
      diffNormal: '普通',
      diffHard: '困难',
      themeLabel: '主题',
      themeRetro: '复古黄绿',
      themeNight: '暗夜',
      themePaper: '纸墨',
      soundLabel: '音效',
      autoFireLabel: '触屏自动连发',
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

      footerNote: '纯前端运行 · 关卡与怪物均为 JSON 数据驱动',

      hintControls: '移动：方向键 / WASD · 射击：空格 / J（按住连发） · 大招：K / X · 暂停：P / Esc',
      hintItems: '道具：P 火力 · S 散弹 · L 激光 · + 回血 · E 能量 ⚡ · G 护盾',

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
