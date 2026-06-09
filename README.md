# Tap-Fight

抖音风格视频入口 × 1v1 联机对战 Web 游戏。浏览器即玩，手机/电脑均可。

## 五个主题

| 主题 | 近战 | 远程 | BGM |
|------|------|------|------|
| 🏢 办公室大作战 | 战士 | 射手 · 文件夹投掷 | ✅ |
| 🌌 星际剑士训练场 | 剑士 | 训练者 · 能量球 | ✅ |
| 👑 皇帝 vs 甄嬛 | 皇帝/朕 | 嬛嬛/甄嬛 | — |
| 🍉 黑衣买瓜男 vs 水果摊主 | 黑衣买瓜男 | 水果摊主 · 保熟西瓜拍 | — |
| 🥛 牛奶瓶医生 vs 橙味汽水男 | 牛奶瓶医生 | 橙味汽水男 · 甩动听诊器 | — |

## 功能

- **自动匹配**：进入即自动配对，无需房间号
- **语音技能**：说出技能语句眩晕对手（需麦克风）
- **手势交互**：摄像头手势攻击（需摄像头权限）
- **上升平台**：动态场地，平台冒出上升、天花板即死
- **排行榜**：胜负结算 + 历史排名
- **视频入口**：抖音风格上下滑动切主题

## 项目结构

```
Tap-Fight/
├── client/              # 前端 (Canvas 2D + Vite)
│   ├── public/
│   │   ├── theme_packs/ # 5 套主题素材
│   │   ├── videos/      # 5 个主题视频
│   │   ├── bgm/         # 背景音乐
│   │   └── covers/      # 主题封面
│   └── src/
│       ├── main.ts      # 游戏主逻辑
│       └── gestureControls.ts
├── server/              # 后端 (Socket.IO + Node.js)
├── shared/              # 共享类型
└── theme_packs/         # 场景模板源文件

video_theme_asset_pipeline/  # 素材管线：视频 → 主题包
├── video-pipeline/          # Node.js 管线代码
├── package_video.ps1        # 入口脚本
└── input_videos/            # 放待处理视频
```

## 本地运行

```bash
cd Tap-Fight/server && npm install && npm run dev    # 后端 → :42222
cd Tap-Fight/client && npm install && npm run dev    # 前端 → :5173
```

## 生成新主题（素材管线）

```bash
cd video_theme_asset_pipeline
./setup.ps1
./package_video.ps1 -Video "./input_videos/your_video.mp4" -ThemeId "my_theme" -ExportTapFight -TapFightDir "../Tap-Fight"
```

需要配置 `RIGHT_CODES_API_KEY` 环境变量。

## 技术栈

Canvas 2D · Vite · Socket.IO · TypeScript · Node.js · MediaPipe
