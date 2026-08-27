# 部署

本游戏是纯静态站点：**仓库根目录就是可部署产物**——无构建、无打包、
无环境变量。English version: [Deployment](../en/deployment.md).

## 哪里能跑

- 任意静态文件托管：GitHub Pages（当前托管方式）、Netlify、
  Cloudflare Pages、nginx/Apache，甚至 `python3 -m http.server`。
- **不需要后端。** 唯一的网络行为是页面加载自己的 JSON 数据包和
  PNG。
- 要求：必须经 HTTP(S) 伺服——`file://` 会挡住 `fetch`（见
  [故障排查](./troubleshooting.md)）。

## GitHub Pages（当前配置）

线上演示是 <https://petrel2015.github.io/space-impact/>——即 Pages
从仓库根目录伺服 `main` 分支。复现步骤：

1. Fork 或推送本仓库到 GitHub。
2. 仓库 **Settings → Pages → Build and deployment → Source: Deploy
   from a branch**；分支 `main`（或 `gh-pages`），目录 `/ (root)`。
3. 保存。几分钟后站点出现在
   `https://<用户名>.github.io/<仓库名>/`。

这种模式不需要 GitHub Actions workflow（仓库里也没有）。以后若切换
到自定义 Actions 流水线，只需「上传静态产物」这一个动作。

## 子路径安全性

游戏托管在 `/space-impact/`（子路径而非域名根）并且工作正常，因为
**所有引用都是相对路径**：

- `index.html` 以相对 URL 加载 `css/style.css`、`js/*.js`；
- `app.js` 相对页面 fetch `data/enemies.json`、`data/levels.json`
  与 `data/levels/*.json`；
- `donate/` 下的收款码图也是相对路径；
- 没有 `<base>`、没有绝对 `/…` 路径、没有硬编码域名。

因此任何子路径（或域名根）都无需配置直接可用。切勿在
`index.html`/`js/` 里引入绝对路径，否则子路径部署会坏。

## 自定义域名

当前未使用。若在 GitHub Pages 上添加（Settings → Pages → Custom
domain + `CNAME` 文件）：应用侧零改动——代码从不引用 `github.io`
域名。注意 `CNAME` 文件必须留在部署分支里，并在 Pages 设置中开启
HTTPS 强制。

## 上线后核对清单

每次部署后过一遍（以下各项在文档体系建设期间均对线上站实测通过）：

```bash
BASE="https://<你的域名>/<路径>/"
curl -sfo /dev/null -w "%{http_code}\n" "$BASE"                       # 页面
curl -sfo /dev/null -w "%{http_code}\n" "$BASE/data/enemies.json"     # 数据包
curl -sfo /dev/null -w "%{http_code}\n" "$BASE/data/levels.json"      # 关卡索引
curl -sfo /dev/null -w "%{http_code}\n" "$BASE/js/engine.js"          # 脚本
```

再到浏览器里：打开页面（数据加载完 Start 应回变为可用）、玩几秒、打开
设置 ⚙、切换语言/主题，并确认 console 干净（文档截图运行时零报错）。

## 无需操心的事

- **无需缓存头**——页面本身对数据包用 `cache: 'no-cache'` 请求，
  内容改动刷新即生效；静态资产变化时用 `?v=` 查询串指纹。
- **无需 CORS 配置**——一切同源。
- **没有密钥**——真的没有任何要配置的东西。
