# Tap-Fight 游戏交付说明

本包包含 Tap-Fight 1v1 联机对战游戏的完整源码和素材，可直接运行或部署到服务器。

## 当前主题（5 个）

| 主题 | 近战 | 远程 | BGM |
|------|------|------|------|
| 🏢 办公室大作战 | 战士 | 射手 · 文件夹投掷 | office.mp3 |
| 🌌 星际剑士训练场 | 剑士 | 训练者 · 能量球 | space.mp3 |
| 👑 皇帝 vs 甄嬛 | 皇帝/朕 | 嬛嬛/甄嬛 | — |
| 🍉 黑衣买瓜男 vs 水果摊主 | 黑衣买瓜男 | 水果摊主 · 保熟西瓜拍 | — |
| 🥛 牛奶瓶医生 vs 橙味汽水男 | 牛奶瓶医生 | 橙味汽水男 · 甩动听诊器 | — |

## 1. 快速开始

需要 Node.js。首次运行安装依赖：

```bash
cd Tap-Fight/server && npm install
cd ../client && npm install
```

启动后端（终端 A）：

```bash
cd Tap-Fight/server
npm run dev
```

启动前端（终端 B）：

```bash
cd Tap-Fight/client
npm run dev
```

浏览器打开：

```
http://localhost:5173/
```

排行榜页面：

```
http://localhost:5173/leaderboard.html
```

## 2. 玩法说明

- 两人进入匹配界面后自动匹配，不需手动输入房间号。
- 只有一人在等待时显示当前等待人数。
- 语音技能：页面提示技能语句，说出相近内容即可眩晕对手 1.5 秒（需麦克风权限）。
- 双摄像头手势交互：需摄像头权限，点击手势启动按钮。
- 视频原声受浏览器自动播放策略限制，需点击”原声/静音”按钮后播放。

## 3. 服务器部署

```bash
# 上传（排除 node_modules）
rsync -avz --delete --exclude node_modules --exclude dist \
  Tap-Fight/ tripnote:~/tap-fight/

# 启动后端
ssh tripnote 'fuser -k 42222/tcp; cd ~/tap-fight/server && nohup npx tsx src/main.ts &'

# 启动前端
ssh tripnote 'fuser -k 5173/tcp; cd ~/tap-fight/client && nohup npx vite --host 0.0.0.0 --port 5173 &'
```

## 4. 验证

```bash
cd Tap-Fight/client && npm run build   # Vite 构建检查
cd Tap-Fight/server && npx tsc --noEmit --rootDir ..   # TS 类型检查
```

## 5. 打包注意事项

不要包含：`node_modules`、`.git`、`dist`、`server/leaderboard.json`、真实 API key、`.env`。
