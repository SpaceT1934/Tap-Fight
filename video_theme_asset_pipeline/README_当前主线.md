# 视频生成游戏资产当前主线

整理时间：2026-06-09

这个文件夹是当前真正使用的视频素材管线。它负责：

```text
输入视频
-> 视频理解
-> 两个对抗角色
-> 武器/投掷物
-> 技能语句
-> 九帧动画和投掷物动画
-> 可选生成背景、平台、危险物
-> ThemeAssetPackage
-> 可选导入 Tap-Fight
```

## 入口

一次性完整管线：

```powershell
.\package_video.ps1 `
  -Video "<视频路径>" `
  -ThemeId "<theme_id>" `
  -DrawConcurrency 6 `
  -DrawRetries 2 `
  -DrawTimeoutMs 300000
```

导入 Tap-Fight：

```powershell
.\package_video.ps1 `
  -Video "<视频路径>" `
  -ThemeId "<theme_id>" `
  -ExportTapFight `
  -TapFightDir "<Tap-Fight目录>" `
  -StageTemplate "office_battle_001"
```

生成场景资产：

```powershell
.\package_video.ps1 `
  -Video "<视频路径>" `
  -ThemeId "<theme_id>" `
  -GenerateStageAssets `
  -DrawConcurrency 2 `
  -DrawRetries 3 `
  -DrawTimeoutMs 300000
```

说明：生成场景资产会增加 draw 请求数量。若 draw 服务不稳定或出现 `HTTP 524`，优先降低 `DrawConcurrency`，再增加 `DrawRetries`。

## 文件职责

当前主线代码：

```text
package_video.ps1
export_tap_fight.ps1
setup.ps1
video-pipeline/src/index.mjs
video-pipeline/tools/sprite_postprocess.py
video-pipeline/tools/segment_crop.py
video-pipeline/tools/stage_asset_postprocess.py
video-pipeline/package.json
config/right-codes.env.example
```

说明文档：

```text
README.md
README_当前主线.md
交接清单.md
docs/测试记录.md
docs/开发日志.md
docs/已知问题.md
docs/场景资产生成扩展方案.md
```

运行产生：

```text
input_videos/
video_understandings/
theme_packs/
```

## 输出契约

每个 `theme_packs/<theme_id>/` 至少包含：

```text
manifest.json
package_status.json
analysis_report.json
pipeline_result.json
assets/
frames/
p1_animation_manifest.json
p2_animation_manifest.json
```

可选包含：

```text
p1_projectile_manifest.json
p2_projectile_manifest.json
assets/stage/background.png
assets/stage/platform_left.png
assets/stage/platform_mid.png
assets/stage/platform_right.png
assets/stage/hazard_debris.png
```

## 与 Tap-Fight 的边界

这个文件夹只负责生成和导出资产，不负责游戏玩法。

Tap-Fight 运行时读取：

```text
Tap-Fight/client/public/theme_registry.json
Tap-Fight/client/public/theme_packs/<theme_id>/
Tap-Fight/client/public/videos/<theme_id>.mp4
```

网页展示页在 Tap-Fight：

```text
Tap-Fight/client/public/asset-pipeline.html
Tap-Fight/server/src/main.ts
```

网页会调用本文件夹的 `package_video.ps1`。`生成场景资产` 是显式开关，开启后 server 会传 `-GenerateStageAssets`；关闭时沿用模板场景导入。CLI 仍是正式批量生成和问题复现的主入口。

## 场景资产透明度处理

生成背景、平台、危险物是可选扩展，不影响旧角色资产主链路。

透明类 stage asset 包括：

```text
assets/stage/platform_left.png
assets/stage/platform_mid.png
assets/stage/platform_right.png
assets/stage/hazard_debris.png
```

图片模型有时会把“transparent background”画成白底 PNG。管线会在资产生成端做一次交付前清理：

```text
video-pipeline/tools/stage_asset_postprocess.py
```

处理原则：

- 只处理视频资产生成管线，不修改 Tap-Fight 游戏运行代码。
- 只处理透明类 stage asset，不处理完整背景图。
- 只扣除从图片边缘连通进入的近白色/浅灰色背景，尽量保留平台主体纹理。
- 输出尺寸保持 Tap-Fight 固定尺寸不变。

## 验证

```powershell
Push-Location .\video-pipeline
npm run validate
Pop-Location
```

最近已验证：

- `npm run validate` 通过。
- Tap-Fight `npm run build` 通过。
- 最新真实场景资产包：`theme_packs/real_churenmei_stage_20260609_201010/`。
- 该包已导入新仓库 Tap-Fight：
  - `Tap-Fight/client/public/theme_packs/real_churenmei_stage_20260609_201010/`
  - `Tap-Fight/client/public/videos/real_churenmei_stage_20260609_201010.mp4`
  - `Tap-Fight/client/public/theme_registry.json`
