# 更新日志

本文件记录本项目所有对用户可见的重要变更。

> **版本说明：** 本仓库目前没有 git tag，也没有 GitHub Release（已检查
> `git tag` 为空、`gh release list` 为空），且没有 `package.json` 版本号。
> 因此下面唯一的条目汇总了 **2026-08-22**（首次公开提交，已上线 GitHub
> Pages）至当前的全部完整功能集。更细的历史请看
> [git 提交记录](https://github.com/petrel2015/space-impact/commits/main/)。
> 维护者打下首个 tag 之后，后续条目将从 `[Unreleased]` 正常拆分。

## [Unreleased] 未发布

### 新增
- 完整双语文档体系：`docs/en` + `docs/zh` 页面集、功能设计文档
  （`docs/*/features/`）、本更新日志，以及面向 AI 助手的
  `README_FOR_AI.md`。

### 变更
- 重做打赏流程：Footer 改为单一低干扰入口（`☕ 请作者喝杯咖啡 /
  ☕ Buy me a coffee`），弹窗内切换支付宝 / 微信支付；二维码改为浏览器
  按收款链接实时生成（深色码 + 白底、纠错 M、静区 ≥ 4），不再提交
  PNG 图片。QR 库（`js/vendor/qrcode-generator.js`）在弹窗首次打开时
  才懒加载——首屏零开销。手机端支付宝以新标签页（`noopener`）打开
  官方 `qr.alipay.com` 收款页（每次弹窗会话至多一次），二维码常驻
  兜底；移除旧的 `alipays://` scheme 尝试与 1.5 秒超时。新增
  `test/donation-test.js`（合同断言 + jsdom 交互）与
  `test/qr-roundtrip.test.js`（jsQR 解码回环）；删除 `donate/*.png`
  与 `test/make-donate-qr.sh`。

## [1.0.0] - 2026-08-22

*首次发布于 2026-08-22；本条目汇总至当前版本的完整功能集。*

### 新增
- 完整游戏内容：14 个关卡、27 种怪物（10 个 Boss 形态、2 个中 Boss），
  最终 Boss 轮换 7 套攻击并召唤增援；第 14 关后战役无限循环，敌人逐圈强化。
- 数据驱动内容：怪物与关卡均为纯 JSON（`data/enemies.json`、
  `data/levels/*.json`），加载即编译校验，坏数据抛双语 `DataError`；
  无需改引擎即可扩展内容。
- 行为原语库：9 种移动原语、10 种攻击原语（含 `cycle` 轮换与 `spawn`
  召唤）、5 种出场编队。
- 四档难度（轻松/标准/紧凑/硬核）：血量 10→8→6→4、生命数 4→3→3→2，
  标准档起弹药有限，击杀可回收。
- 武器与道具：火力 1–3 级、散弹与穿透激光模式、回血、大招能量
  （清屏激光）、护盾，以及独立弹药池、可穿弹幕的 M 追踪导弹奖励武器。
- 默认点射模式 + 自动连发开关；瞄准虚线（弹道预示虚线 + 命中点标记）
  游戏内可开关。
- 子弹对消、震屏、视差星空、Boss 血条与预警。
- 144×80 逻辑分辨率 LCD、整数倍放大（致敬 3310 的 84×48）、5×7 点阵
  字体；触屏手机竖屏时使用 144×128 场地。
- 中英双语界面（自动检测并记忆）；三套主题（复古黄绿/暗夜/纸墨）；
  顶栏设置弹层（游戏中打开自动暂停）。
- 响应式布局：触摸设备及手机/平板尺寸窗口自动显示十字键 + FIRE/BOMB
  虚拟按键。
- WebAudio 方波合成音效（零音频文件）。
- 自定义关卡流程：开始界面下载可玩关卡模板，编辑后上传 JSON 即刻开打。
- 演示模式自动驾驶（`?demo=1&autostart=1`），与真人走同一条输入通道。
- 测试/分享用 URL 参数：`lang`、`theme`、`touch`、`autostart`、`demo`、
  `paused`、`aim`、`level`。
- 零依赖 node 测试套件：数据包校验（`data-test.js`）、确定性整关模拟
  （`engine-test.js`）、瞄准/导弹视觉校验（`aim-visual-test.js`）、无头
  PNG 场景渲染器（`render-shots.js`）。
- 赞助入口：支付宝/微信收款码。
