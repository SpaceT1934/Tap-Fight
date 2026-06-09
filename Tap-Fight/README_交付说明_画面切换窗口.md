# Tap-Fight 画面切换窗口交付说明

更新时间：2026-06-07

这份说明记录本窗口已经合入 Tap-Fight 的功能、新增文件、运行方式和打包注意事项。文档中只使用仓库相对路径和本地调试地址，不依赖开发者电脑上的绝对路径。

## 一、已完成的主要功能

### 1. 视频入口与主题包加载

- 首页保持短视频流入口，主题来自 `client/public/theme_registry.json`。
- 视频进入对战时，会按当前视频的 `themeId` 加载 `client/public/theme_packs/<themeId>/manifest.json`。
- 已导入真实主题包和对应视频，主题包位于 `client/public/theme_packs/`，视频位于 `client/public/videos/`。
- 视频右侧声音按钮已改为“原声/静音”，只控制视频文件自身音轨，不再用游戏 BGM 代替视频声音。

### 2. 双方主题与画面切换

- 对战开始时，玩家和对手会保留各自进入游戏时选择的视频主题。
- 开局阶段对手先使用本地主题表现，避免刚开局角色和场景不匹配。
- 对战运行一段时间后，进入曲线分屏画面切换，右侧逐步展示对手主题背景和对手素材。
- 调试页 `client/public/dual-debug.html` 可用于快速检查双主题分屏。

### 3. 自动匹配房间

- 已从手动输入房间号改为自动匹配。
- 第一名玩家进入匹配池时显示可对战人数为 0。
- 第二名玩家进入后，服务器自动创建 `auto_*` 房间并开始对战。
- 服务器会在 `match_start` 中下发双方 `themeId`，客户端据此加载本地和远端主题。

### 4. 语音技能

- 对战中会提示技能语句：`大喊「xxx」，眩晕对手！`
- 用户点击麦克风按钮并说出技能语句后，会眩晕对手 1.5 秒。
- 语音识别支持模糊匹配，不要求完全一致。
- 语音技能会通过网络同步给另一端。
- 浏览器需要麦克风权限。

### 5. 手势交互

- 新增 `client/src/gestureControls.ts`。
- 右侧提供手势启动按钮，支持手势攻击。
- 已接入 MediaPipe Hand Landmarker，支持最多 2 只手。
- 为了提升初始化体验，已加入后台预热、模型和摄像头并行初始化、加载状态保护。
- 摄像头权限通常要求 `localhost` 或 HTTPS 环境。

### 6. 排行榜与结算

- 新增服务器接口：
  - `GET /api/leaderboard`
  - `POST /api/match-result`
- 新增排行榜页面：`client/public/leaderboard.html`
- 菜单页和结算页均有“查看排行榜”入口。
- 结算页展示胜负、双方宇宙、分数明细和总分。
- 分数公式：
  - 胜利基础分：胜利 +500
  - 生存时间分：对局秒数 ×5
  - 输出分：造成伤害 ×30
  - 剩余血量分：剩余 HP ×20
- 排行榜运行时数据写入 `server/leaderboard.json`，该文件已加入 `.gitignore`，不要提交真实玩家记录。

## 二、主要新增和修改文件

### 新增文件

- `client/src/gestureControls.ts`
- `client/public/leaderboard.html`
- `client/public/dual-debug.html`
- `client/public/theme_registry.json`
- `client/public/theme_packs/<themeId>/...`
- `client/public/videos/<themeId>.mp4`
- `README_交付说明_画面切换窗口.md`

### 主要修改文件

- `client/src/main.ts`
- `client/src/styles.css`
- `client/index.html`
- `client/vite.config.ts`
- `client/package.json`
- `client/package-lock.json`
- `server/src/main.ts`
- `.gitignore`

## 三、运行方式

先安装依赖：

```bash
cd server
npm install

cd ../client
npm install
```

启动后端：

```bash
cd server
npm run dev
```

启动前端：

```bash
cd client
npm run dev -- --host 127.0.0.1
```

访问页面：

- 游戏入口：`http://127.0.0.1:5173/`
- 排行榜：`http://127.0.0.1:5173/leaderboard.html`
- 双主题调试页：`http://127.0.0.1:5173/dual-debug.html`

## 四、打包注意事项

建议包含：

- `client/`
- `server/`
- `shared/`
- 根目录配置文件
- `client/public/theme_packs/`
- `client/public/theme_registry.json`
- `client/public/videos/`
- `client/public/bgm/`

建议排除：

- `node_modules/`
- `client/dist/`
- `server/dist/`
- `server/leaderboard.json`
- 临时日志和本地缓存文件

## 五、绝对路径检查

已检查以下范围：

- `Tap-Fight/`
- `分工文件/画面切换/`

检查结果：

- 未发现开发机磁盘绝对路径，例如 Windows 盘符路径、本机用户目录路径或 `file` 协议路径。
- 代码中保留的 `http://localhost:42222`、`http://127.0.0.1:5173` 是本地开发调试地址，不属于打包风险。
- 主题分析报告中的 `https://right.codes/draw` 是生成记录里的接口来源，不包含 API key。
- 手势识别依赖的 CDN URL 是公开模型和 wasm 资源地址，不包含本机路径。

## 六、已验证项目

已通过：

```bash
cd client
npm run build

cd ../server
npx tsc --noEmit --rootDir ..

git diff --check
```

补充验证：

- `client/public/videos/*.mp4` 均检测到视频轨和音轨标记。
- `GET /api/leaderboard` 可返回排行榜数据。
- 双客户端 Socket.IO 自动匹配模拟通过，双方 `themeId` 下发正常。

## 七、已知注意点

- 视频原声需要用户主动点一次右侧“静音/原声”按钮，这是浏览器自动播放策略限制。
- 摄像头和麦克风权限需要在浏览器中授权。
- 手势模型首次加载依赖网络资源，弱网时第一次启动会慢一些。
- 排行榜数据是本地服务器运行时 JSON 文件，打包给同学时无需携带历史战绩。
