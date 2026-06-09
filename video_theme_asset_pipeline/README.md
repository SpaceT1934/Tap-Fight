# 视频转主题资产包交接说明

这个文件夹是给游戏窗口使用的独立交接包。目标是：

```text
输入一个视频
-> 自动视频理解
-> 自动生成两个对抗角色九帧素材和投掷物素材
-> 输出游戏可加载的 ThemeAssetPackage
```

当前主线和文件边界请先看：

```text
README_当前主线.md
```

## 快速开始

1. 安装依赖：

```powershell
.\setup.ps1
```

2. 把视频放入：

```text
input_videos/
```

3. 运行：

```powershell
.\package_video.ps1 -Video ".\input_videos\your_video.mp4"
```

直接导入 Tap-Fight 游戏仓库：

```powershell
.\package_video.ps1 -Video ".\input_videos\your_video.mp4" -ExportTapFight
```

默认会寻找同一工作区下的 `Tap-Fight/`，并写入 `Tap-Fight/client/public/theme_packs/<theme_id>/`、`Tap-Fight/client/public/videos/<theme_id>.mp4` 和 `Tap-Fight/client/public/theme_registry.json`。如果 Tap-Fight 在其他位置：

```powershell
.\package_video.ps1 -Video ".\input_videos\your_video.mp4" -ExportTapFight -TapFightDir "<Tap-Fight目录>"
```

如果要同时生成视频风格的背景、平台和危险物：

```powershell
.\package_video.ps1 `
  -Video ".\input_videos\your_video.mp4" `
  -ThemeId "<theme_id>" `
  -GenerateStageAssets `
  -DrawConcurrency 2 `
  -DrawRetries 3 `
  -DrawTimeoutMs 300000 `
  -ExportTapFight `
  -TapFightDir "<Tap-Fight目录>" `
  -StageTemplate "office_battle_001"
```

说明：场景资产生成会增加图片请求数。若 draw 服务出现 `HTTP 524` 或连接中断，优先降低 `DrawConcurrency` 并增加 `DrawRetries`。

已有主题包可单独导出：

```powershell
.\export_tap_fight.ps1 -Theme "fullrun_xxx" -Video ".\input_videos\your_video.mp4"
```

4. 输出位置：

```text
theme_packs/<theme_id>/
```

游戏侧优先读取：

```text
theme_packs/<theme_id>/manifest.json
theme_packs/<theme_id>/package_status.json
theme_packs/<theme_id>/analysis_report.json
theme_packs/<theme_id>/assets/
theme_packs/<theme_id>/frames/
```

## 目录结构

```text
给游戏同学_视频转主题资产包/
  README.md
  setup.ps1
  package_video.ps1
  input_videos/
  config/
    right-codes.env.example
  video-pipeline/
    package.json
    src/
    tools/
      stage_asset_postprocess.py
  video_understandings/
    示例理解结果
  theme_packs/
    anim_video_5f1f2057_real/
    anim_p1_ab3ea18b_real/
    anim_beikaichu_p1_real/
  docs/
    测试记录.md
    已知问题.md
    开发日志.md
```

## API Key 配置

不要把 key 写进聊天或提交到仓库。可选两种方式：

方式 A：设置系统环境变量。

```powershell
$env:CODEX_PRO_API_KEY="你的 key"
$env:RIGHT_CODES_API_KEY="你的 key"
```

方式 B：复制示例配置。

```powershell
Copy-Item .\config\right-codes.env.example "$env:USERPROFILE\.hei-ke-song\right-codes.env"
```

然后编辑：

```text
%USERPROFILE%\.hei-ke-song\right-codes.env
```

## 默认策略

- 视频理解默认走 `https://right.codes/codex-pro/v1`，模型 `gpt-5.5`。
- 画图走 `https://right.codes/draw`。
- 画图模型默认 `gpt-image-2`。
- 默认严格模式：LLM 或 draw 失败会中断，不会偷偷输出占位素材。
- 默认 `faithful`：第一轮保留角色名和原视频特征；如果被 IP/相似性 guardrail 拒绝，会第二轮去掉精确角色名但保留光剑、长耳、长袍、兜帽等视觉要素重试一次。
- 可选场景资产生成只属于素材管线，不修改 Tap-Fight 游戏代码。平台/危险物会在交付前做透明边界清理，避免图片模型生成白底 PNG 后在游戏里露出白边。

如果明确接受原创化改编：

```powershell
.\package_video.ps1 -Video ".\input_videos\your_video.mp4" -SafeRemix
```

如果只想测试目录和结构，不调用模型：

```powershell
.\package_video.ps1 -Video ".\input_videos\your_video.mp4" -StructureOnly
```

## 提速与失败恢复

默认已经启用以下优化：

- 同一个视频重复运行时，会复用 `video_understandings/` 里已有的视频理解结果，避免重复调用 `gpt-5.5`。
- 两个角色的九帧生成会并发执行，默认 `-DrawConcurrency 2`。
- draw 遇到 `524`、连接中断、超时等瞬时错误时，默认自动重试 1 次。

如果需要强制重新理解视频：

```powershell
.\package_video.ps1 -Video ".\input_videos\your_video.mp4" -ForceUnderstanding
```

如果 draw 服务不稳定，可以调低并发或增加重试：

```powershell
.\package_video.ps1 -Video ".\input_videos\your_video.mp4" -DrawConcurrency 1 -DrawRetries 2
```

## 输出契约

最终包至少包含：

```text
manifest.json
analysis_report.json
package_status.json
pipeline_result.json
assets/
frames/
p1_animation_manifest.json
p2_animation_manifest.json
```

## Tap-Fight 对接格式

Tap-Fight 当前从 `client/public/theme_packs/<theme_id>/` 读取主题。`export-tap-fight` 会在不改变标准 ThemeAssetPackage 的前提下，额外复制一份游戏兼容目录：

```text
client/public/theme_packs/<theme_id>/
  manifest.json
  background.png
  platform_left.png
  platform_mid.png
  platform_right.png
  hazard_debris.png
  animation_preview/
    p1_animation_manifest.json
    p2_animation_manifest.json
    frames/
      p1/*.png
      p2/*.png
      p2_projectile/*.png
  tap_fight_export.json
```

平台、落石等场地运行素材默认从 Tap-Fight 的 `office_battle_001` 复制作为白模场地 fallback；角色、九帧动画、投掷物和结构化数据来自视频生成包。指定 `-StageTemplate` 时，导出器会用该模板的 `background.png` 同时覆盖运行包根目录背景和 `assets/background.png`；例如华强买瓜复用 `office_battle_001`，甄嬛/嬛嬛复用 `palace_battle_001`。

Tap-Fight 前端已支持可选 `client/public/theme_registry.json`。存在时会把导出的主题追加到视频入口；不存在时仍使用原来的内置主题。

远程角色还会包含：

```text
p1_projectile_manifest.json 或 p2_projectile_manifest.json
assets/<player>_projectile.png
assets/<player>_projectile_sheet.png
frames/<player>_projectile/
```

`package_status.json` 中：

```json
{
  "validation": {
    "can_load_in_game": true
  }
}
```

为 `true` 时，游戏窗口可以加载。

### 角色技能语句

每个角色会输出一条长按攻击触发的“吐槽/经典发言/拟声词”：

```text
manifest.players.p1.skill_taunt.text
manifest.players.p2.skill_taunt.text
```

`skill_taunt` 结构包含：

```json
{
  "text": "技能显示语句",
  "source": "dialogue_or_subtitle | observed_from_video | derived_from_scene | onomatopoeia | fallback_design",
  "speaker": "角色名或 unknown",
  "evidence_frames": ["analysis_frames/frame_01.jpg"],
  "reason": "这句话为什么属于该角色",
  "confidence": 0.0,
  "fallback_text": "兜底短句"
}
```

兼容字段：

```text
manifest.taunt.player_taunts.p1.text
manifest.taunt.player_taunts.p2.text
manifest.taunt.text
```

游戏侧长按攻击建议优先读取 `players.<player>.skill_taunt.text`；如果不存在，再回退到 `taunt.player_taunts.<player>.text`，最后回退到旧版 `taunt.text`。

## 游戏侧读取与防偏移

自动找主体只在素材生成阶段执行，游戏运行时不需要做抠图、识别主体或重新裁剪。

游戏侧读取顺序建议：

```text
1. 读取 theme_packs/<theme_id>/package_status.json，确认 validation.can_load_in_game=true。
2. 读取 theme_packs/<theme_id>/manifest.json，拿到 p1/p2 的 animation_manifest。
3. 长按攻击吐槽文本读取 manifest.players.<player>.skill_taunt.text。
4. 读取 p1_animation_manifest.json 和 p2_animation_manifest.json。
5. 按 animations.<state>.frames 加载 frames/<player>/*.png。
6. 渲染角色时使用 render_origin.mode=bottom_center，normalized=(0.5,0.98) 作为脚底锚点。
7. 如果有 projectile_manifest，投掷物使用 render_origin.mode=center，normalized=(0.5,0.5) 作为中心锚点。
```

角色帧统一输出为 `512x512` 透明 PNG；投掷物帧统一输出为 `256x256` 透明 PNG。生成器会先按九宫格切帧，再基于 alpha 连通区域自动找主体、过滤邻格碎片、裁掉空边并重新贴回固定画布。游戏侧不要按图片左上角摆放角色，应按 `render_origin` 计算 pivot，否则跑步、跳跃和攻击帧会产生视觉跳动。

## 已有示例包

```text
theme_packs/anim_video_5f1f2057_real/
theme_packs/anim_p1_ab3ea18b_real/
theme_packs/anim_beikaichu_p1_real/
```

注意：`anim_p1_ab3ea18b_real` 是旧策略下生成的星战原创化改编示例。如果要用最新“两阶段忠实优先”策略，需要重新输入视频生成。

## 自检

```powershell
Push-Location .\video-pipeline
npm run validate
Pop-Location
```
