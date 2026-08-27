# 开发

如何参与开发本项目。English version: [Development](../en/development.md).

## 环境

- **Node.js** —— 任何能跑普通 CommonJS `.js` 的版本（已在 Node 22 上
  验证；没有 `engines` 字段，因为根本没有 `package.json`——
  本项目**运行时与开发依赖均为零**）。
- **Python 3**（或任意静态文件服务器）本地起服务——游戏用 `fetch`
  加载 JSON 数据包，`file://` 打不开。
- 无框架、无打包器、无转译：`js/` 里的文件在浏览器里原样运行。

## 命令

以下命令均在本仓库当前树上实际执行并通过：

| 命令 | 作用 | 最近一次验证结果 |
|------|------|------------------|
| `python3 -m http.server 8000` | 在 `http://localhost:8000/` 提供游戏 | `/index.html` 与 `/data/enemies.json` 均 200 |
| `node test/data-test.js` | 数据包校验 | **全部通过**（27 怪物、14 关卡、54 个 i18n 键） |
| `node test/engine-test.js` | 确定性模拟测试 | **全部通过**（模拟通关全部 14 关） |
| `node test/aim-visual-test.js` | 瞄准虚线 + 导弹渲染校验 | **全部通过** |
| `node test/render-shots.js` | 无头 PNG 场景截图 → `/tmp/si-shots/` | 生成 11 张 PNG |
| `node test/render-shots.js 5 42` | 渲染第 5 关第 42 秒（开发目检） | 任意关卡/秒数可用 |

没有构建、没有打包、没有 lint——没有任何需要配置的东西。

## 各测试到底测什么

**`test/data-test.js`** —— 内容完整性，毫秒级跑完：

- 每张精灵网格是矩形且只含 `X`/`.`；每个字体字形是 5×7。
- `data/enemies.json` 里每个怪物：`hp`/`score`/`speed` 为正、精灵/
  移动/攻击已知、`fireRate` 一致、掉落表合法（类型 + 概率在
  [0,1]）、`miniboss` 必须同时 `boss`。
- 每个关卡：数字 `id`、`difficulty` 在 [0.5, 3]、事件按 `t` 排序、
  怪物/编队已知、`y` 在 0–1、`count` 1–20、至少一个 boss 事件、
  战役 id 严格递增。
- `levels.json` 条目不能逃出 `data/` 目录（路径穿越检查）。
- 可下载的关卡模板能通过真实词表编译。
- i18n：中英词典键集合一致；`index.html` 用到的每个 `data-i18n`
  键都存在。

**`test/engine-test.js`** —— 用固定种子把真实数据包喂给真实引擎：

1. 全部 14 关都可通关（脚本化无敌玩家在时限内击杀最终 Boss）。
2. 中 Boss 死亡**不会**过关（第 8 关的 mb1 + 末尾 Boss）。
3. 第 2 关挂机的玩家会受到伤害（难度是真实的）。
4. 确定性：同种子 → 状态轨迹逐字节一致。
5. 大招每次触发恰好消耗一格；按住不会连发。
6. 道具生效并正确封顶（大招上限 5）。
7. 坏数据抛出正确的双语错误键。
8. 双方子弹接触即对消。
9. 有限弹药：一轮恰好一发、打空扳机不动、击杀回收、补充后恢复射击。
10. 竖屏 144×128 场地：生成行重映射且不出界；Boss 垂直居中。
11. 追踪导弹：拾取得 12 发（上限 20）、独立弹药池、离轴也能锁定击
    杀、免疫子弹对消、耗尽后回落普通弹、死亡清空库存。
12. 每种武器模式下瞄准虚线射线数 = 真实齐射弹数。

**`test/aim-visual-test.js`** —— 把真实渲染器画进一个记录像素的
mock，断言虚线射线几何、命中标记和导弹尾迹真实出现在画布上。

**`test/render-shots.js`** —— 把关键时刻（Boss、弹幕墙、游戏结束、
瞄准虚线、导弹……）渲染成 4 倍放大的 PNG 供目检。

## 目录结构

```
space-impact/
├── index.html            # 页面骨架；每条 UI 文案都由 data-i18n 键驱动
├── css/style.css         # 像素风 UI；主题走 CSS 自定义属性
├── data/                 # ←—— 全部游戏内容
│   ├── enemies.json      # 怪物表（27 条）
│   ├── levels.json       # 关卡顺序（id 必须递增）
│   └── levels/*.json     # 每关一条事件时间线
├── js/
│   ├── i18n.js           # 中英词典 + 检测/记忆
│   ├── theme.js          # 主题注册表：页面 CSS 变量 + LCD 色板
│   ├── audio.js          # WebAudio 方波音效合成
│   ├── sprites.js        # 精灵字符串网格 + 5×7 点阵字体
│   ├── level-template.js # 可下载的自定义关卡模板
│   ├── behaviors.js      # 移动/攻击/编队原语库
│   ├── engine.js         # 编译（校验）+ 纯确定性模拟
│   ├── render.js         # Canvas 渲染（LCD 色板、HUD、特效）
│   ├── app.js            # 输入、主循环、界面流转、持久化
│   ├── donation.js       # Footer 捐赠组件（弹窗、懒加载 QR、实时生成）
│   └── vendor/           # 第三方库（qrcode-generator.js，MIT）
├── test/                 # node 测试套件 + 资产生成器
└── docs/                 # 本套文档（中英双语）
```

## 资产脚本（开发工具，非运行时）

- `node test/make-icons.js` —— 用游戏自己的精灵网格重新生成
  `favicon-16/32.png` 和 `apple-touch-icon.png`（零依赖）。

收款二维码没有资产脚本也没有图片文件——`js/donation.js` 在弹窗
打开后用 vendored QR 库按收款链接实时生成。收款链接变更时只改
`js/donation.js` 里的 `DONATION_CONFIG`（并跑
`node test/donation-test.js`）。

## 改内容 vs 改引擎

- **内容**（怪物、关卡）：只改 JSON。跑 `node test/data-test.js`；
  新增关卡在 `data/levels.json` 里按递增 id 注册后，
  `engine-test.js` 会自动验证它可通关。
- **引擎/行为**：保持模拟纯净且确定——`engine.js` 里不得出现
  DOM/音频/渲染调用，一切随机数走带种子的 `rt.rng`，固定时间步进。
  这正是 node 测试能整关打通的原因。
- **全新移动/攻击原语**是唯一需要动引擎代码的内容扩展：在
  `behaviors.js` 加一个函数，JSON 里立刻可以按名引用（校验白名单
  与运行时分发读的是同一个注册表）。

## 本地验证「生产形态」

部署产物就是仓库本身——没有构建产物。验证用户拿到的东西：

```bash
python3 -m http.server 8000
# 打开 http://localhost:8000/ —— 逐项点过：开始界面 → 游戏 →
# 设置弹层 → 暂停/继续 → 游戏结束 → 自定义关卡上传
```

自动化验证则用上面四条测试命令，外加一次浏览器冒烟（本文档体系的
 截图正是这样截的，console 零报错）。
