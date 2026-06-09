# CLAUDE.md

## 项目概述

Tap Fight 是一个抖音风格视频入口 + 动态场地 1v1 联机对战 Web 游戏。运行在手机浏览器上，使用 Canvas 2D + Socket.IO。

### 新增功能（v0.5+）
- **抖音风格视频入口**：上下滑动切视频、双击红心、拖动进度条、点赞收藏
- **上升平台模式**：平台从底部冒出上升、天花板即死、死亡地板、落石
- **BGM 系统**：每个主题独立背景音乐，进对战播放，结束时停止
- **4 个主题**：办公室、星际、萌宠、宫廷（视频 + 场景 + BGM）
- **冷却时钟**：远程角色旁显示冷却倒计时圆环
- **近战 ×1.5 速度**：510 moveSpeed
- **按钮一行布局**：左右分离、水平排列
- **加载画面**：素材加载中显示 loading，不露白模

## 技术栈

- **前端**：原生 Canvas 2D（手写精灵动画、物理、碰撞），Vite 构建
- **后端**：Node.js + Express + Socket.IO（tsx 运行 TypeScript）
- **通信**：Socket.IO，服务端做消息中转（非权威服务器）

## 关键架构

```
client/src/main.ts   ← 全部前端逻辑（~700 行单文件）
server/src/main.ts   ← 房间管理 + 消息转发
theme_packs/         ← 素材包（帧动画 PNG + manifest.json）
```

## 核心概念

### 跨主题对战
- **主题是纯客户端渲染**，每人进菜单自选主题
- 网络只同步游戏数据（位置、HP、攻击事件），不同步主题
- A 看办公室战士 vs 射手，B 看星际剑士 vs 训练者，完全同步对战
- 主题切换：改 `index.html` 的 `<select>` 加 `<option>` 即可

### 角色分配
- 创建房间者 = **p1**（近战，屏幕左侧）
- 加入房间者 = **p2**（远程，屏幕右侧）
- 每个客户端左边永远近战、右边永远远程
- `setupRole()` 在 p2 加入时交换 player/opponent 的位置和属性

### 网络同步
- 客户端每 80ms 发送 `input_snapshot`（位置、状态、HP、攻击标记）
- 服务端转发给房间内另一个 socket
- 命中时发送 `hit_event` 同步对方 HP
- 远程玩家攻击标记 `attacking=true` 触发本地生投掷物
- `applyRemoteState()` 把网络数据写入 opponent 对象

### 游戏结束
- 任一方 HP 归零 → 双方显示结算画面（赢/输）
- 2 秒后自动发 `leave_room` → 服务端删房间 → 房间号可复用
- `gameOverHandled` 防止重复结算

### 渲染
- 帧动画模式：`drawAnimatedPlayerSprite()` 按 5 状态播放对应帧
- 攻击时长 200ms（320→200），手感更干脆
- 投掷物：有素材图就贴（带呼吸缩放），无图就蓝色方块 fallback
- 动画缺失 → 白模矩形 + 圆圈头 fallback

### 光影特效（粒子系统）
- `spawnParticles(x, y, count, opts)` 通用粒子生成器
- 斩击拖尾：金色弧线 + 发光粒子，近战攻击时触发
- 命中火花：红色粒子从受击点四散，近战和投掷命中时触发
- 发射闪光：橙色粒子，远程攻击时触发
- 投掷物拖尾：蓝色粒子跟随飞行中的投掷物
- 奔跑灰尘：褐色尘粒从脚底扬起
- 跳跃灰尘：灰白尘圈在地面散开
- 粒子自动衰减（life/alpha），无需手动清理

### UI 风格
- 暗色主题：平台半透明暗色 + 顶部高光线
- 背景 fallback 深色渐变 `#1a1a2e → #0d1117`
- 已删除骨骼绘制、吐槽气泡、名签

### 素材包结构
```
theme_packs/{theme_id}/
  manifest.json                           ← 主题配置（角色名）
  background.png                          ← 场景背景（1 张）
  animation_preview/
    p1_animation_manifest.json            ← p1 动画索引
    p2_animation_manifest.json            ← p2 动画索引
    frames/
      p1/                                 ← p1（近战）9 帧
        idle_0.png   idle_1.png
        run_0.png    run_1.png
        run_2.png    run_3.png
        jump_0.png   fall_0.png
        attack_0.png
      p2/                                 ← p2（远程）9 帧
        ...（同上 5 状态 9 帧）
      p2_projectile/                      ← p2 投掷物 4 帧（可选）
        projectile_0.png ~ projectile_3.png
```

## 如何添加新主题

### 1. 准备素材

```
新主题需要 19 ~ 23 个文件：

  1 张  background.png            → 场景背景
  9 张  p1 角色帧                  → 近战角色动画
  9 张  p2 角色帧                  → 远程角色动画
  4 张  p2 投掷物帧（可选）         → 远程攻击物动画
  2 个  动画索引 JSON              → 告诉游戏怎么播帧
  1 个  manifest.json              → 主题配置
```

### 2. 帧文件命名规则

```
p1/                         p2/
  idle_0.png   idle_1.png     ← 待机 2 帧（呼吸循环）
  run_0.png                   ← 跑步 4 帧（奔跑循环）
  run_1.png
  run_2.png
  run_3.png
  jump_0.png                  ← 跳跃 1 帧
  fall_0.png                  ← 下落 1 帧
  attack_0.png                ← 攻击 1 帧

p2_projectile/                ← 投掷物（可选，不提供则用代码绘制）
  projectile_0.png
  projectile_1.png
  projectile_2.png
  projectile_3.png
```

**命名必须严格遵守**，游戏代码按这个模式自动查找帧文件。

### 3. 创建 manifest.json

```json
{
  "contract_version": "0.2.0",
  "theme_id": "你的主题ID",
  "display_name": "显示名称",
  "environment": {
    "background": "background.png"
  },
  "players": {
    "p1": { "name": "近战角色名", "role": "melee", "placeholder_color": "#4A90D9" },
    "p2": { "name": "远程角色名", "role": "ranged", "placeholder_color": "#E67E22" }
  }
}
```

**代码实际只读 3 个字段**：`environment.background`、`players.p1.name`、`players.p2.name`。其余可省略。

### 4. 创建动画索引

`animation_preview/p1_animation_manifest.json` 和 `p2_animation_manifest.json`，内容结构相同，帧路径不同：

```json
{
  "animations": {
    "idle":   { "frames": ["frames/p1/idle_0.png", "frames/p1/idle_1.png"], "fps": 3,  "loop": true },
    "run":    { "frames": ["frames/p1/run_0.png","frames/p1/run_1.png","frames/p1/run_2.png","frames/p1/run_3.png"], "fps": 10, "loop": true },
    "jump":   { "frames": ["frames/p1/jump_0.png"],  "fps": 1, "loop": false },
    "fall":   { "frames": ["frames/p1/fall_0.png"],  "fps": 1, "loop": false },
    "attack": { "frames": ["frames/p1/attack_0.png"], "fps": 1, "loop": false }
  }
}
```

p2 版本把路径中的 `p1` 换成 `p2`。

### 5. 放入项目

```bash
# 放到两个位置（开发时用 client/public，构建时用根目录）
cp -r 新主题文件夹 client/public/theme_packs/
cp -r 新主题文件夹 theme_packs/

# 压缩 PNG
find client/public/theme_packs/新主题 -name '*.png' -exec pngquant --quality 60-80 --speed 1 --force --ext .png {} \;
```

### 6. 切换主题

修改 `client/src/main.ts` 第 8 行：

```javascript
const THEME_ROOT = "./theme_packs/你的主题ID";
```

### 7. 部署

```bash
rsync -avz --delete --exclude node_modules --exclude .git --exclude dist ~/Desktop/Tap-Fight/ tripnote:~/tap-fight/
ssh tripnote 'fuser -k 42222/tcp; fuser -k 5173/tcp'
# 然后重启两个服务
```

### 动态场地系统
- `stage_config.json` 配置场地参数（地面、平台、跷跷板、落石）
- `buildStagePlatforms()` 根据配置生成平台数组
- `updateStage(dt, now)` 每帧更新：地面上升、平台生命周期、跷跷板倾斜、落石
- 地面上升时会检测角色是否站在地上 → 自动托起
- 平台状态：normal → warning(闪烁) → collapsing(掉落) → respawning(飞回)
- 跷跷板：碰撞保持矩形(`rect_locked`)，视觉倾斜由 `stage.seesawTilt` 控制
- 落石每 5 秒生成，碰到角色扣血 + 粒子

### 场地素材
每个主题包根目录需额外放置（来自 `stage_theme_delivery_4packs`）：
```
ground_tile.png    platform_left.png    platform_mid.png
platform_right.png platform_full.png   seesaw_pivot.png
hazard_debris.png
```

## 常用命令

```bash
# 本地开发
cd client && npm install && npm run dev    # → localhost:5173
cd server && npm install && npm run dev    # → localhost:42222

# 部署到腾讯云
rsync -avz --delete --exclude node_modules --exclude .git --exclude dist ~/Desktop/Tap-Fight/ tripnote:~/tap-fight/
ssh tripnote 'fuser -k 42222/tcp; cd ~/tap-fight/server && nohup npx tsx src/main.ts &'
ssh tripnote 'fuser -k 5173/tcp; cd ~/tap-fight/client && nohup npx vite --host 0.0.0.0 --port 5173 &'

# 服务器信息
# tripnote = ubuntu@211.159.160.11 (腾讯云)
# SSH key: ~/.ssh/id_ed25519
# 前端端口: 5173, 后端端口: 42222
# Vite 代理 /socket.io → localhost:42222
```

## 端口占用（重要）

服务器上已占用的端口：
- 80: nginx（其他项目）
- 3000: node /opt/meitu
- 3001: cloudflared 或其他服务
- 3002: /opt/echot (PM2 自动重启)
- 5173: Tap Fight 前端 (Vite)
- 42222: Tap Fight 后端 (Socket.IO)

**不要使用 3000-3002 端口，会被其他项目占用或自动重启覆盖。**

## 注意事项

- 服务器防火墙已关闭，端口依赖腾讯云安全组
- 已开放端口：80, 443, 5173（如加新端口需在腾讯云控制台添加）
- 不要动 `tripnote-*` 和 `/opt/` 下的其他项目
- 素材 PNG 推荐用 pngquant 压缩（quality 60-80）
