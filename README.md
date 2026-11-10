# CINEMA / 观影会

静态电影小站：李沧东《可能的爱》《诗》各一张 CD。每部影片一页，分为故事、背景、海报三章，附有来源的中文简介、官方剧照和自制海报。无后台、账户、排期或下载服务。

交互：首页 CD 可拖动 / 翻转 / 触摸，键盘方向键选片、空格翻面、回车进入。CINEMA 手写字标是唯一常驻导航，悬停、聚焦或轻点时，专题与目录以液体形式从两侧拉出；Escape 收起。详情页剧照以液体边缘随滚动浸出，右侧章节轨标示阅读位置，海报是一封折起的信纸，悬停或轻点展开、移开折回。支持减少动态效果，WebGL 不可用时回退到 CSS。

## 本地运行

Node.js 22+（验证环境 24）。项目没有运行时依赖：

```sh
npm start          # http://localhost:4173
npm test           # Node 单元测试
npm ci             # 仅浏览器测试 / 格式化 / 海报生成需要的开发依赖
npm run format:check
```

开发服务器只开放运行资源，不公开原稿、测试、文档或隐藏元数据。

## 构建与部署

```sh
npm run build                         # 域名根目录 /
BASE_PATH=/Cinema/ npm run build      # GitHub 项目路径 /Cinema/
```

`dist/` 是唯一发布目录，首页与每个详情页都有真实的 `index.html`，可直接打开或刷新，无需 SPA 重写；`404.html` 提供返回首页的入口。推送到 `main` 后，`.github/workflows/pages.yml` 运行单元测试、按 `/Cinema/` 构建并部署到 GitHub Pages。

发布素材的权利说明见 NOTICE.md。

## 浏览器验证

```sh
npx playwright install chromium
npm start            # 另开终端
npm run test:browser
npm run test:static  # 需要 python3；构建并在无 SPA 回退的静态服务器上验证两种基路径
```

可用 `CINEMA_URL` 指定服务器地址。测试覆盖真实 WebGL、普通 / 减少动态、触摸、历史导航、海报比例与折叠交互、手机无横向溢出、内部链接与资源错误。结构与几何断言不能代替人工视觉验收。

## 编辑内容

- `src/data.js`：两部选片。文字保持独立概述并保留来源 URL；没有的内容不要虚构。
- `src/club-page.js`：详情页章节、右侧章节轨、手绘标记与段落显影。
- `src/liquid-image.js`：剧照的液体浸出（WebGL2）；`src/paper-reveal.js`：海报折叠（Three.js）；`src/topic-menu.js`：导航的液体展开。
- `src/editorial.css`：字体、版式与以上效果的样式；`src/style.css`、`src/restoration.css` 为首页与加载动画的基础样式。
- `npm run posters`：用 Sharp 从 `.do-it/` 原稿重新生成网页衍生图（光盘 cover 裁剪，详情页保留完整竖幅）。原稿只在本地，普通构建不依赖。
- `.do-it/` 只在本地保留（原稿、计划与验证证据），不跟踪、不构建、不上传。

## 字体

全部为本地 WOFF2 子集：马善政（标题与导航）、霞鹜文楷（正文）、Caveat（英文与数字）、Rock Salt（CINEMA 字标），另有 Noto Serif / Sans SC 作回退与小字。许可与来源见 `assets/fonts/README.md`。修改文案后运行联网维护命令 `node scripts/fonts.mjs` 重新生成子集；未包含的字符使用系统中文字体回退。剧照来源和权利说明见 `assets/film-stills-sources.json`。
