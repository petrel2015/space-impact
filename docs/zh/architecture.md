# 架构

游戏为什么这样设计。English version: [Architecture](../en/architecture.md).

## 高层设计

一切都源自一个决定：**内容即数据，浏览器只是播放器。** 怪物是
（移动 × 攻击 × 数值）元组，关卡是事件时间线——都是纯 JSON，都在
加载时校验并编译。模拟内核纯净且确定，测试才能在 node 里打通整个
游戏。

```
             ┌───────────────────────── 浏览器 ─────────────────────────┐
             │                                                             │
 data/enemies.json ──┐                                                    │
 data/levels.json ───┤ fetch（同源，no-cache）                            │
 data/levels/*.json ─┘                                                    │
             │                                                            │
             ▼                                                            │
      engine.compileEnemies ──▶ defs（已校验、归一化）                     │
      engine.compileLevel   ──▶ level {queue, difficulty, duration}        │
             │                    坏 JSON → 双语 DataError → 界面          │
             ▼                                                            │
      engine.createRuntime ──▶ rt（可变状态：player、enemies、            │
             │                 bullets、powerups、particles、events）      │
             │                                                            │
   app.js：requestAnimationFrame 主循环                                   │
     累积真实时间 → 每个 1/60s 节拍调一次 engine.step(rt, input)           │
     rt.events ──▶ audio.js（仅音效）                                      │
     render.draw(ctx, rt) ──▶ canvas（144×80 / 144×128 逻辑分辨率）        │
             │                                                            │
 输入：键盘 / 十字键 + FIRE + BOMB ──▶ app.js ──▶ engine.step              │
 演示模式自动驾驶 ───────────── 产出同样形状的输入对象 ──┘                   │
             └─────────────────────────────────────────────────────────────┘

 node 测试 require 同一批文件，直接调 engine.step——
 不需要 DOM、canvas、音频。
```

## 模块职责

| 文件 | 职责 | 依赖 |
|------|------|------|
| `js/engine.js` | 编译/校验 JSON → defs；纯确定性模拟；火力与瞄准虚线共用的 `volleyRays` 射线几何 | behaviors、sprites（仅经 `SI.*`） |
| `js/behaviors.js` | 原语词表：9 移动、10 攻击、5 编队——敌人行为逻辑的唯一居所 | 无 |
| `js/sprites.js` | 精灵字符串网格（`X`/`.`）与 5×7 ASCII 点阵字体 | 无 |
| `js/render.js` | 用主题 LCD 色板把 `rt` 画上画布；HUD、视差、特效 | sprites、theme |
| `js/app.js` | 一切「不纯」的东西：输入接线、主循环、界面流转、localStorage、URL 参数、关卡上传 | 以上全部 |
| `js/donation.js` | Footer 捐赠组件：弹窗、支付宝/微信切换、QR 库懒加载 + 按收款链接实时生成二维码、手机端支付宝跳官方收款页 | i18n、audio |
| `js/i18n.js` | 中英词典、`data-i18n` DOM 应用、持久化 | 无（node 安全） |
| `js/theme.js` | 三套主题 = 页面 CSS 自定义属性 + LCD 色板 | 无（node 安全） |
| `js/audio.js` | WebAudio 方波音效合成、手势解锁 | 无（node 安全） |
| `js/level-template.js` | 可下载模板对象（可编译、可玩、`_help` 提示） | 无 |

## 确定性

- **RNG：** 运行时所有随机数都经过按运行时播种的 mulberry32 生成器
  （`createRuntime({seed})`）。同种子 → 同过程，`engine-test.js` 逐
  字节验证。
- **编译期随机**（编队抖动）使用固定种子（1），编译出的关卡跨会话
  稳定。
- **固定时间步：** `app.js` 累积帧时间，按精确 1/60 s 节拍步进引擎
  （设上限防死亡螺旋），把模拟速度与显示器刷新率解耦。

## 编译层

`compileEnemies` / `compileLevel` 在加载时把原始 JSON 一次性变成归
一化定义：

- 未知的精灵/移动/攻击/编队/怪物 id 一律以双语 `DataError` 拒绝
  （`errEnemyRef` 等键，由 `i18n.t` 渲染）；
- 编队编排在编译期展开为具体生成偏移；
- 事件队列按 `t` 排序，记录关卡 `duration`（决定弹药库存规模）；
- 每关 `difficulty` 收敛到 [0.5, 3]。

运行时（`createRuntime`）在竖屏 144×128 场地激活时按比例重映射生成
行——关卡按 80 行场地编排，自动缩放。

## 事件流（引擎 → 应用）

引擎从不直接碰音频。外界需要感知的一切都推入 `rt.events`
（`shoot`、`bossWarn`、`powerup`、`levelClear`、`gameOver`……）。
`app.js` 每帧抽干队列并映射为音效。这既保住了内核的纯净与可测性，
事件词表本身也被测试断言覆盖。

## 难度与缩放

两个独立乘数在 `app.js` 复合成一个数传给引擎：

```
实际难度 = 关卡 difficulty（0.5–3，每关 JSON）
         × 档位乘数     （0.8 / 1.0 / 1.15 / 1.3）
         × (1 + 0.35 × 战役循环圈数)
```

引擎由它推导敌人属性：HP ×(1+0.4·loop)、速度 ×(1+0.12·loop)、开火
间隔 ÷(1+0.1·loop)。生命数/HP/弹药直接来自档位预设（见
[难度与弹药设计](./features/difficulty-and-ammo.md)）。

## 主题

一套主题是一个对象，分两半：`page`（由 `theme.js` 设到 `<html>` 上
的 CSS 自定义属性）与 `lcd`（背景/墨色/暗色像素色 + 像素网格开关，
由 `render.js` 消费）。加主题 = 注册表加一条 + 加一个按钮，渲染代
码零改动。

## LCD 纪律

画布上的一切都来自内置 5×7 ASCII 字体和精灵网格——不用 canvas 文本
 API，不加载图片资产。中文字符串只存在于画布外的 HTML 界面。这让
 canvas 渲染器可移植性极佳，也是测试里无头 PNG 渲染与浏览器完全一
 致的原因。
