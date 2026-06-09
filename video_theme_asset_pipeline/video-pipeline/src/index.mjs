import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const execFileAsync = promisify(execFile);

const CONTRACT_VERSION = "0.1.0";
const GENERATED_BY = "video-pipeline";
const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DELIVERY_DIR = path.resolve(ROOT_DIR, "..");
const WINDOW_DIR = path.resolve(DELIVERY_DIR, "..");
const WORKSPACE_DIR = path.resolve(WINDOW_DIR, "..", "..", "..");
const CONFIG_DIR = path.join(ROOT_DIR, "mock_configs");
const OUTPUT_DIR = path.join(DELIVERY_DIR, "theme_packs");
const UNDERSTANDING_OUTPUT_DIR = path.join(DELIVERY_DIR, "video_understandings");
const COMPARE_OUTPUT_DIR = path.join(DELIVERY_DIR, "video_understandings_compare");
const DEFAULT_TAP_FIGHT_DIR = path.join(WORKSPACE_DIR, "Tap-Fight");
const DEFAULT_TAP_FIGHT_STAGE_TEMPLATE = "office_battle_001";
const SEGMENT_CROP_SCRIPT = path.join(ROOT_DIR, "tools", "segment_crop.py");
const SPRITE_POSTPROCESS_SCRIPT = path.join(ROOT_DIR, "tools", "sprite_postprocess.py");
const STAGE_POSTPROCESS_SCRIPT = path.join(ROOT_DIR, "tools", "stage_asset_postprocess.py");
const DEFAULT_VIDEO_SOURCE_DIR = path.join(WINDOW_DIR, "视频源素材");
const DEFAULT_GEMINI_BASE_URL = "https://right.codes/gemini";
const DEFAULT_GEMINI_MODEL = "gemini-3.1-pro-preview";
const DEFAULT_CODEX_PRO_BASE_URL = "https://right.codes/codex-pro/v1";
const DEFAULT_CODEX_PRO_MODEL = "gpt-5.5";
const DEFAULT_BASE_URL = DEFAULT_CODEX_PRO_BASE_URL;
const DEFAULT_MODEL = DEFAULT_CODEX_PRO_MODEL;
const DEFAULT_FRAME_COUNT = 8;
const DRAW_FALLBACK_BASE_URL = "https://right.codes/draw";
const DRAW_FALLBACK_MODELS = ["gpt-image-2-vip", "gpt-image-2", "nano-banana", "nano-banana-2", "nano-banana-pro"];
const DEFAULT_DRAW_MODEL = "gpt-image-2";
const DEFAULT_DRAW_API_SIZE = "1024x1024";
const DEFAULT_DRAW_RETRIES = 1;
const DEFAULT_DRAW_RETRY_DELAY_MS = 3000;
const DEFAULT_DRAW_CONCURRENCY = 2;
const CHARACTER_SHEET_SIZE = "1536x1536";
const PROJECTILE_SHEET_SIZE = "1024x256";
const STAGE_BACKGROUND_SIZE = "1080x1920";
const STAGE_PLATFORM_LEFT_SIZE = "58x54";
const STAGE_PLATFORM_MID_SIZE = "128x54";
const STAGE_PLATFORM_RIGHT_SIZE = "58x54";
const STAGE_PLATFORM_STRIP_SIZE = "244x54";
const STAGE_HAZARD_SIZE = "48x48";
const CHROMA_KEY = "00ff00";
const ANIMATION_FRAME_NAMES = ["idle_0", "idle_1", "run_0", "run_1", "run_2", "run_3", "jump_0", "fall_0", "attack_0"];
const PROJECTILE_FRAME_NAMES = ["projectile_0", "projectile_1", "projectile_2", "projectile_3"];
const STAGE_ASSET_SPECS = [
  {
    key: "background",
    file: "background.png",
    path: "assets/stage/background.png",
    raw: "assets/raw/stage_background_raw.png",
    targetSize: STAGE_BACKGROUND_SIZE,
    transparent: false,
    manifestField: "background"
  },
  {
    key: "platform_left",
    file: "platform_left.png",
    path: "assets/stage/platform_left.png",
    raw: "assets/raw/stage_platform_left_raw.png",
    targetSize: STAGE_PLATFORM_LEFT_SIZE,
    transparent: true,
    manifestField: "platform_left"
  },
  {
    key: "platform_mid",
    file: "platform_mid.png",
    path: "assets/stage/platform_mid.png",
    raw: "assets/raw/stage_platform_mid_raw.png",
    targetSize: STAGE_PLATFORM_MID_SIZE,
    transparent: true,
    manifestField: "platform_mid"
  },
  {
    key: "platform_right",
    file: "platform_right.png",
    path: "assets/stage/platform_right.png",
    raw: "assets/raw/stage_platform_right_raw.png",
    targetSize: STAGE_PLATFORM_RIGHT_SIZE,
    transparent: true,
    manifestField: "platform_right"
  },
  {
    key: "hazard_debris",
    file: "hazard_debris.png",
    path: "assets/stage/hazard_debris.png",
    raw: "assets/raw/stage_hazard_debris_raw.png",
    targetSize: STAGE_HAZARD_SIZE,
    transparent: true,
    manifestField: "hazard_debris"
  }
];
const STAGE_PLATFORM_TILE_KEYS = new Set(["platform_left", "platform_mid", "platform_right"]);
const STAGE_PLATFORM_TILE_SPECS = STAGE_ASSET_SPECS.filter((spec) => STAGE_PLATFORM_TILE_KEYS.has(spec.key));
const STAGE_PLATFORM_STRIP_SPEC = {
  key: "platform_strip",
  file: "platform_strip.png",
  path: "assets/stage/platform_strip.png",
  raw: "assets/raw/stage_platform_strip_raw.png",
  targetSize: STAGE_PLATFORM_STRIP_SIZE,
  transparent: true,
  resizeMode: "stretch_transparent",
  manifestField: "platform_strip"
};
const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".mkv", ".avi", ".webm", ".m4v"]);
const ASSET_PATHS = [
  "assets/p1_body.png",
  "assets/p1_head.png",
  "assets/p1_melee_prop.png",
  "assets/p2_body.png",
  "assets/p2_head.png",
  "assets/p2_projectile.png",
  "assets/background.png",
  "assets/taunt_bubble.png"
];

const assetFallbackKeys = {
  "assets/p1_body.png": ["p1", "body"],
  "assets/p1_head.png": ["p1", "head"],
  "assets/p1_melee_prop.png": ["p1", "melee_prop"],
  "assets/p1_projectile.png": ["p1", "projectile"],
  "assets/p2_body.png": ["p2", "body"],
  "assets/p2_head.png": ["p2", "head"],
  "assets/p2_melee_prop.png": ["p2", "melee_prop"],
  "assets/p2_projectile.png": ["p2", "projectile"],
  "assets/background.png": ["environment", "fallback"],
  "assets/taunt_bubble.png": ["taunt", "bubble"]
};

const usage = `Usage:
  node src/index.mjs understand-video [--video <path>] [--input-dir <path>] [--understanding-id <id>] [--frames <n>] [--generate-stage-assets] [--no-llm] [--strict-llm]
  node src/index.mjs compare-llm [--video <path>] [--input-dir <path>] [--frames <n>]
  node src/index.mjs generate-frames [--understanding <id|dir|generation_brief.json>] [--theme-id <id>] [--generate-stage-assets] [--no-draw] [--strict-draw]
  node src/index.mjs package-video --video <path> [--theme-id <id>] [--export-tap-fight] [--tap-fight-dir <path>] [--generate-stage-assets] [--safe-remix] [--allow-fallback] [--force-understanding] [--draw-retries <n>] [--draw-concurrency <n>]
  node src/index.mjs export-tap-fight --theme <theme_id|theme_dir> [--tap-fight-dir <path>] [--video <path>] [--stage-template <theme_id>]
  node src/index.mjs generate-full [--video <path>] [--input-dir <path>] [--frames <n>] [--no-llm] [--no-draw]
  node src/index.mjs validate

Environment:
  CODEX_PRO_API_KEY      Codex Pro API key; falls back to RIGHT_CODES_API_KEY.
  CODEX_PRO_BASE_URL     Defaults to ${DEFAULT_CODEX_PRO_BASE_URL}
  CODEX_PRO_MODEL        Defaults to ${DEFAULT_CODEX_PRO_MODEL}
  RIGHT_CODES_BASE_URL   Optional Gemini endpoint for compare-llm; defaults to ${DEFAULT_GEMINI_BASE_URL}
  RIGHT_CODES_MODEL      Optional Gemini model for compare-llm; defaults to ${DEFAULT_GEMINI_MODEL}
  RIGHT_CODES_DRAW_BASE_URL Defaults to ${DRAW_FALLBACK_BASE_URL}
  RIGHT_CODES_DRAW_MODEL Defaults to ${DEFAULT_DRAW_MODEL}`;

async function main() {
  await loadLocalPrivateEnv();

  const command = process.argv[2] || "understand-video";
  const options = parseOptions(process.argv.slice(3));
  if (options.help) {
    console.log(usage);
    return;
  }

  if (command === "understand" || command === "understand-video") {
    const results = await understandVideos(options);
    console.log(`Generated ${results.length} video understanding result(s):`);
    for (const result of results) console.log(`- ${result.understanding_id}`);
    return;
  }

  if (command === "compare" || command === "compare-llm") {
    const results = await compareLlmVideos(options);
    console.log(`Generated ${results.length} LLM comparison result(s):`);
    for (const result of results) console.log(`- ${result.comparison_id}`);
    return;
  }

  if (command === "generate-frames" || command === "generate-animation" || command === "generate-theme-pack") {
    const results = await generateFramePackages(options);
    console.log(`Generated ${results.length} animation theme package(s):`);
    for (const result of results) console.log(`- ${result.theme_id}`);
    return;
  }

  if (command === "generate-full") {
    const understandResults = await understandVideos(options);
    const results = await generateFramePackages({
      ...options,
      understanding: understandResults.map((result) => result.understanding_id)
    });
    console.log(`Generated ${results.length} full pipeline theme package(s):`);
    for (const result of results) console.log(`- ${result.theme_id}`);
    return;
  }

  if (command === "package-video" || command === "package" || command === "video-to-theme") {
    const result = await packageVideoToTheme(options);
    console.log("Packaged video into ThemeAssetPackage:");
    console.log(`- theme_id: ${result.theme_id}`);
    console.log(`- output_dir: ${result.output_dir}`);
    console.log(`- manifest: ${result.manifest}`);
    console.log(`- package_status: ${result.package_status}`);
    console.log(`- can_load_in_game: ${result.can_load_in_game}`);
    return;
  }

  if (command === "export-tap-fight" || command === "export-game" || command === "tap-fight") {
    const result = await exportTapFightTheme(options);
    console.log("Exported ThemeAssetPackage for Tap-Fight:");
    console.log(`- theme_id: ${result.theme_id}`);
    console.log(`- output_dir: ${result.output_dir}`);
    console.log(`- registry: ${result.registry}`);
    console.log(`- can_load_in_tap_fight: ${result.can_load_in_tap_fight}`);
    return;
  }

  if (["generate", "generate-video", "generate-mock", "legacy-disabled"].includes(command)) {
    throw new Error("Legacy screenshot/crop ThemeAssetPackage generation is disabled. Use `npm run understand:video` or `npm run understand:compare`.");
  }

  if (command === "generate-mock-internal-disabled") {
    const results = await generateAllMock();
    console.log(`Generated ${results.length} mock theme package(s):`);
    for (const result of results) console.log(`- ${result.theme_id}`);
    return;
  }

  if (command === "validate") {
    const results = await validateAll();
    for (const result of results) {
      const label = result.ok ? "PASS" : "FAIL";
      console.log(`${label} ${result.id || result.theme_id || result.understanding_id || result.comparison_id}`);
      for (const issue of result.issues) console.log(`  - ${issue}`);
    }
    if (results.some((result) => !result.ok)) process.exitCode = 1;
    return;
  }

  console.error(usage);
  process.exitCode = 1;
}

async function generateFromVideos(options) {
  const videoPaths = options.video
    ? [path.resolve(options.video)]
    : await listVideos(path.resolve(options.inputDir || DEFAULT_VIDEO_SOURCE_DIR));

  if (videoPaths.length === 0) {
    throw new Error(`No video files found in ${toDisplayPath(options.inputDir || DEFAULT_VIDEO_SOURCE_DIR)}`);
  }
  if (options.themeId && videoPaths.length > 1) {
    throw new Error("--theme-id can only be used with a single --video input to avoid overwriting multiple packages.");
  }

  await mkdir(OUTPUT_DIR, { recursive: true });
  const results = [];
  for (const videoPath of videoPaths) {
    const result = await generateSingleVideoPackage(videoPath, options);
    results.push(result);
  }
  return results;
}

async function understandVideos(options) {
  const videoPaths = options.video
    ? [path.resolve(options.video)]
    : await listVideos(path.resolve(options.inputDir || DEFAULT_VIDEO_SOURCE_DIR));

  if (videoPaths.length === 0) {
    throw new Error(`No video files found in ${toDisplayPath(options.inputDir || DEFAULT_VIDEO_SOURCE_DIR)}`);
  }
  if (options.understandingId && videoPaths.length > 1) {
    throw new Error("--understanding-id can only be used with a single --video input to avoid overwriting multiple outputs.");
  }

  await mkdir(UNDERSTANDING_OUTPUT_DIR, { recursive: true });
  const results = [];
  for (const videoPath of videoPaths) {
    results.push(await understandSingleVideo(videoPath, options));
  }
  return results;
}

async function packageVideoToTheme(options) {
  if (!options.video) {
    throw new Error("package-video requires --video <path>. This wrapper intentionally accepts one video and outputs one ThemeAssetPackage.");
  }

  const pipelineOptions = normalizePackageVideoOptions(options);
  const understandResults = await understandVideos(pipelineOptions);
  if (understandResults.length !== 1) {
    throw new Error(`package-video expected one understanding result, got ${understandResults.length}.`);
  }

  const understandingId = understandResults[0].understanding_id;
  const understandingInput = await resolveSingleUnderstandingInput(understandingId);
  const brief = await readJson(understandingInput.briefPath);
  const themeId = pipelineOptions.themeId || makePackagedThemeId(understandingId, brief, pipelineOptions);
  const frameResults = await generateFramePackages({
    ...pipelineOptions,
    understanding: [understandingId],
    themeId
  });
  if (frameResults.length !== 1) {
    throw new Error(`package-video expected one theme package result, got ${frameResults.length}.`);
  }

  const packDir = path.join(OUTPUT_DIR, frameResults[0].theme_id);
  const packageStatusPath = path.join(packDir, "package_status.json");
  const analysisReportPath = path.join(packDir, "analysis_report.json");
  const status = await readJson(packageStatusPath);
  const analysisReport = existsSync(analysisReportPath) ? await readJson(analysisReportPath) : null;
  const summary = {
    schema_version: "video_to_theme_result.v0.1",
    generated_by: GENERATED_BY,
    generated_at: new Date().toISOString(),
    source_video: makeSourceId(path.resolve(options.video)),
    understanding_id: understandingId,
    understanding_reused: Boolean(understandResults[0].reused),
    understanding_dir: normalizePath(path.relative(DELIVERY_DIR, understandingInput.dir)),
    theme_id: frameResults[0].theme_id,
    output_dir: normalizePath(path.relative(DELIVERY_DIR, packDir)),
    manifest: normalizePath(path.relative(DELIVERY_DIR, path.join(packDir, "manifest.json"))),
    analysis_report: normalizePath(path.relative(DELIVERY_DIR, analysisReportPath)),
    package_status: normalizePath(path.relative(DELIVERY_DIR, packageStatusPath)),
    can_load_in_game: Boolean(status.validation?.can_load_in_game),
    validation_status: status.validation?.status || "unknown",
    strict: {
      llm: Boolean(pipelineOptions.strictLlm),
      draw: Boolean(pipelineOptions.strictDraw)
    },
    model: {
      understanding: pipelineOptions.model || process.env.CODEX_PRO_MODEL || DEFAULT_MODEL,
      draw: pipelineOptions.drawModel || process.env.RIGHT_CODES_DRAW_MODEL || DEFAULT_DRAW_MODEL
    },
    stage_assets: {
      requested: Boolean(pipelineOptions.generateStageAssets),
      generated: Boolean(analysisReport?.image_generation?.stage_generation?.enabled),
      mode: analysisReport?.image_generation?.stage_generation?.mode || "template_fallback"
    },
    visual_mode: analysisReport?.image_generation?.visual_mode || (pipelineOptions.safeRemix ? "safe_remix" : "faithful")
  };

  const tapFightExport = pipelineOptions.exportTapFight || pipelineOptions.tapFightDir
    ? await exportTapFightTheme({
      theme: frameResults[0].theme_id,
      tapFightDir: pipelineOptions.tapFightDir,
      video: options.video,
      stageTemplate: pipelineOptions.stageTemplate,
      allowFallback: pipelineOptions.allowFallback
    })
    : null;

  if (tapFightExport) summary.tap_fight_export = tapFightExport.report;

  await writeJson(path.join(packDir, "pipeline_result.json"), summary);
  if (tapFightExport?.output_dir) {
    await copyFileWithParents(path.join(packDir, "pipeline_result.json"), path.join(tapFightExport.output_dir, "pipeline_result.json"));
  }
  return summary;
}

async function exportTapFightTheme(options) {
  const themeInput = options.theme || options.themeId;
  if (!themeInput) {
    throw new Error("export-tap-fight requires --theme <theme_id|theme_dir>.");
  }

  const sourceDir = await resolveThemePackDir(themeInput);
  const manifest = await readJson(path.join(sourceDir, "manifest.json"));
  const statusPath = path.join(sourceDir, "package_status.json");
  const status = existsSync(statusPath) ? await readJson(statusPath) : null;
  if (status && status.validation?.can_load_in_game === false && !options.allowFallback) {
    throw new Error(`Theme package is not loadable: ${manifest.theme_id}. Use --allow-fallback to export anyway.`);
  }

  const tapFightDir = path.resolve(options.tapFightDir || DEFAULT_TAP_FIGHT_DIR);
  const tapPublicDir = path.join(tapFightDir, "client", "public");
  if (!existsSync(tapPublicDir)) {
    throw new Error(`Tap-Fight client/public not found: ${toDisplayPath(tapPublicDir)}`);
  }

  const targetDir = path.join(tapPublicDir, "theme_packs", manifest.theme_id);
  await rm(targetDir, { recursive: true, force: true });
  await mkdir(targetDir, { recursive: true });

  await copyOptionalDir(path.join(sourceDir, "assets"), path.join(targetDir, "assets"));
  await copyOptionalDir(path.join(sourceDir, "frames"), path.join(targetDir, "frames"));
  for (const file of [
    "analysis_report.json",
    "package_status.json",
    "pipeline_result.json",
    "p1_animation_manifest.json",
    "p2_animation_manifest.json",
    "p1_projectile_manifest.json",
    "p2_projectile_manifest.json"
  ]) {
    await copyOptionalFile(path.join(sourceDir, file), path.join(targetDir, file));
  }

  const tapManifest = buildTapFightManifest(manifest);
  await writeJson(path.join(targetDir, "manifest.json"), tapManifest);
  await copyTapFightBackground(sourceDir, targetDir, manifest);
  await copyTapFightStageAssets(tapFightDir, targetDir, options.stageTemplate || DEFAULT_TAP_FIGHT_STAGE_TEMPLATE, sourceDir);
  await copyTapFightAnimations(sourceDir, targetDir, manifest);

  const copiedVideo = options.video ? await copyTapFightVideo(tapPublicDir, manifest.theme_id, path.resolve(options.video)) : null;
  const registryPath = path.join(tapPublicDir, "theme_registry.json");
  if (!options.noRegistry && copiedVideo) {
    await upsertTapFightRegistry(registryPath, manifest, copiedVideo);
  }

  const verification = verifyTapFightExport(targetDir);
  const exportReport = {
    schema_version: "tap_fight_export.v0.1",
    generated_by: GENERATED_BY,
    generated_at: new Date().toISOString(),
    theme_id: manifest.theme_id,
    source_package: normalizePath(path.relative(DELIVERY_DIR, sourceDir)),
    tap_fight_package: normalizePath(path.relative(tapPublicDir, targetDir)),
    stage_template: options.stageTemplate || DEFAULT_TAP_FIGHT_STAGE_TEMPLATE,
    registry: options.noRegistry || !copiedVideo ? null : normalizePath(path.relative(tapPublicDir, registryPath)),
    video: copiedVideo,
    validation: verification
  };
  await writeJson(path.join(targetDir, "tap_fight_export.json"), exportReport);

  return {
    theme_id: manifest.theme_id,
    output_dir: targetDir,
    registry: options.noRegistry || !copiedVideo ? "" : registryPath,
    can_load_in_tap_fight: verification.can_load_in_tap_fight,
    missing: verification.missing,
    report: exportReport
  };
}

async function resolveThemePackDir(value) {
  const text = String(value || "").trim();
  const direct = path.resolve(text);
  if (existsSync(direct)) {
    const info = await stat(direct);
    if (!info.isDirectory()) throw new Error(`Theme input must be a directory or theme_id: ${text}`);
    return direct;
  }
  const byId = path.join(OUTPUT_DIR, text);
  if (existsSync(byId)) return byId;
  throw new Error(`Theme package not found: ${text}`);
}

function buildTapFightManifest(manifest) {
  const next = JSON.parse(JSON.stringify(manifest));
  const rangedPlayerId = getTapFightRangedPlayerId(manifest);
  next.environment = {
    ...(next.environment || {}),
    background: "background.png"
  };
  next.players = next.players || {};
  if (next.players.p1) next.players.p1.animation_manifest = "animation_preview/p1_animation_manifest.json";
  if (next.players.p2) next.players.p2.animation_manifest = "animation_preview/p2_animation_manifest.json";
  next.projectile = getTapFightProjectileFramePath(rangedPlayerId);
  next.tap_fight_adapter = {
    version: "tap_fight_adapter.v0.1",
    animation_preview: "animation_preview",
    projectile_owner: rangedPlayerId,
    legacy_projectile: getTapFightProjectileFramePath("p2"),
    notes: "Additive compatibility fields for Tap-Fight's current Canvas loader."
  };
  return next;
}

function getTapFightRangedPlayerId(manifest) {
  return Object.entries(manifest.players || {}).find(([, player]) => player?.role === "ranged")?.[0] || "p2";
}

function getTapFightProjectileFramePath(playerId) {
  return `animation_preview/frames/${playerId}_projectile/projectile_0.png`;
}

async function copyTapFightBackground(sourceDir, targetDir, manifest) {
  const candidates = [
    manifest.environment?.background,
    "assets/background.png",
    "background.png"
  ].filter(Boolean);
  for (const candidate of candidates) {
    const source = path.join(sourceDir, candidate);
    if (!existsSync(source)) continue;
    await copyFileWithParents(source, path.join(targetDir, "background.png"));
    return;
  }
}

async function copyTapFightStageAssets(tapFightDir, targetDir, templateId, sourceDir = "") {
  const stageAssets = [
    "background.png",
    "ground_tile.png",
    "platform_left.png",
    "platform_mid.png",
    "platform_right.png",
    "platform_full.png",
    "seesaw_pivot.png",
    "hazard_debris.png"
  ];
  const templateDirs = [
    path.join(tapFightDir, "client", "public", "theme_packs", templateId),
    path.join(tapFightDir, "theme_packs", templateId)
  ];
  for (const asset of stageAssets) {
    const generatedSource = sourceDir ? findGeneratedStageAsset(sourceDir, asset) : "";
    if (generatedSource) {
      await copyFileWithParents(generatedSource, path.join(targetDir, asset));
      await copyFileWithParents(generatedSource, path.join(targetDir, "assets", "stage", asset));
      if (asset === "background.png") {
        await copyFileWithParents(generatedSource, path.join(targetDir, "assets", "background.png"));
      }
      continue;
    }
    for (const templateDir of templateDirs) {
      const source = path.join(templateDir, asset);
      if (!existsSync(source)) continue;
      await copyFileWithParents(source, path.join(targetDir, asset));
      if (asset === "background.png") {
        await copyFileWithParents(source, path.join(targetDir, "assets", "background.png"));
        if (sourceDir && isPathInside(OUTPUT_DIR, sourceDir)) {
          await copyFileWithParents(source, path.join(sourceDir, "assets", "background.png"));
        }
      }
      break;
    }
  }
}

function findGeneratedStageAsset(sourceDir, asset) {
  const candidates = [
    path.join(sourceDir, "assets", "stage", asset)
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return "";
}

async function copyTapFightAnimations(sourceDir, targetDir, manifest) {
  const previewDir = path.join(targetDir, "animation_preview");
  await mkdir(path.join(previewDir, "frames"), { recursive: true });

  for (const playerId of ["p1", "p2"]) {
    const sourceManifest = path.join(sourceDir, `${playerId}_animation_manifest.json`);
    if (existsSync(sourceManifest)) {
      await copyFileWithParents(sourceManifest, path.join(previewDir, `${playerId}_animation_manifest.json`));
    }
    await copyOptionalDir(path.join(sourceDir, "frames", playerId), path.join(previewDir, "frames", playerId));
  }

  const rangedPlayerId = getTapFightRangedPlayerId(manifest);
  const projectileCandidates = [
    path.join(sourceDir, "frames", `${rangedPlayerId}_projectile`),
    path.join(sourceDir, "frames", "p2_projectile"),
    path.join(sourceDir, "frames", "p1_projectile")
  ];
  const sourceProjectileDir = projectileCandidates.find((candidate) => existsSync(candidate));
  if (!sourceProjectileDir) return;

  await copyOptionalDir(sourceProjectileDir, path.join(previewDir, "frames", `${rangedPlayerId}_projectile`));
  if (rangedPlayerId !== "p2") {
    await copyOptionalDir(sourceProjectileDir, path.join(previewDir, "frames", "p2_projectile"));
  }
}

async function copyTapFightVideo(tapPublicDir, themeId, videoPath) {
  if (!existsSync(videoPath)) throw new Error(`Video not found: ${toDisplayPath(videoPath)}`);
  const ext = path.extname(videoPath) || ".mp4";
  const fileName = `${themeId}${ext.toLowerCase()}`;
  const target = path.join(tapPublicDir, "videos", fileName);
  await copyFileWithParents(videoPath, target);
  return {
    src: `./videos/${fileName}`,
    file: normalizePath(path.relative(tapPublicDir, target))
  };
}

async function upsertTapFightRegistry(registryPath, manifest, copiedVideo) {
  const registry = existsSync(registryPath)
    ? await readJson(registryPath)
    : { schema_version: "tap_fight_theme_registry.v0.1", themes: [] };
  if (!Array.isArray(registry.themes)) registry.themes = [];

  const entry = {
    themeId: manifest.theme_id,
    src: copiedVideo?.src || null,
    bgm: null,
    name: manifest.display_name || manifest.theme_id,
    desc: describeTapFightTheme(manifest),
    source: "video_pipeline",
    manifest: `./theme_packs/${manifest.theme_id}/manifest.json`
  };

  const index = registry.themes.findIndex((theme) => theme.themeId === manifest.theme_id);
  if (index >= 0) registry.themes[index] = { ...registry.themes[index], ...entry };
  else registry.themes.push(entry);
  await writeJson(registryPath, registry);
}

function describeTapFightTheme(manifest) {
  const p1 = manifest.players?.p1 || {};
  const p2 = manifest.players?.p2 || {};
  const p1Prop = p1.attack_prop_name || (p1.role === "melee" ? "melee prop" : "projectile");
  const p2Prop = p2.attack_prop_name || (p2.role === "ranged" ? "projectile" : "melee prop");
  return `${p1.name || "p1"} vs ${p2.name || "p2"} / ${p1Prop} vs ${p2Prop}`;
}

function verifyTapFightExport(targetDir) {
  const required = [
    "manifest.json",
    "background.png",
    "platform_left.png",
    "platform_mid.png",
    "platform_right.png",
    "hazard_debris.png",
    "animation_preview/p1_animation_manifest.json",
    "animation_preview/p2_animation_manifest.json",
    ...ANIMATION_FRAME_NAMES.map((name) => `animation_preview/frames/p1/${name}.png`),
    ...ANIMATION_FRAME_NAMES.map((name) => `animation_preview/frames/p2/${name}.png`)
  ];
  const optional = PROJECTILE_FRAME_NAMES.map((name) => `animation_preview/frames/p2_projectile/${name}.png`);
  const missing = required.filter((item) => !existsSync(path.join(targetDir, item)));
  const optionalMissing = optional.filter((item) => !existsSync(path.join(targetDir, item)));
  return {
    can_load_in_tap_fight: missing.length === 0,
    status: missing.length === 0 ? "pass" : "fail",
    missing,
    optional_missing: optionalMissing,
    required
  };
}

async function copyOptionalDir(sourceDir, targetDir) {
  if (!existsSync(sourceDir)) return false;
  const info = await stat(sourceDir);
  if (!info.isDirectory()) return false;
  await mkdir(targetDir, { recursive: true });
  const entries = await readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const source = path.join(sourceDir, entry.name);
    const target = path.join(targetDir, entry.name);
    if (entry.isDirectory()) await copyOptionalDir(source, target);
    else if (entry.isFile()) await copyFileWithParents(source, target);
  }
  return true;
}

async function copyOptionalFile(source, target) {
  if (!existsSync(source)) return false;
  await copyFileWithParents(source, target);
  return true;
}

async function copyFileWithParents(source, target) {
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(source, target);
}

function normalizePackageVideoOptions(options) {
  const allowFallback = Boolean(options.allowFallback || options.noLlm || options.noDraw);
  const next = {
    ...normalizeDrawOptions(options),
    frames: Number.isFinite(options.frames) ? options.frames : 6
  };
  if (!allowFallback && !next.noLlm) next.strictLlm = true;
  if (!allowFallback && !next.noDraw) next.strictDraw = true;
  return next;
}

function makeSourceId(videoPath) {
  const resolved = path.resolve(videoPath);
  const relativeToWindow = path.relative(WINDOW_DIR, resolved);
  if (relativeToWindow && !relativeToWindow.startsWith("..") && !path.isAbsolute(relativeToWindow)) {
    return normalizePath(relativeToWindow);
  }
  return normalizePath(path.join("external_videos", path.basename(resolved)));
}

function normalizeDrawOptions(options) {
  return {
    ...options,
    drawModel: options.drawModel || process.env.RIGHT_CODES_DRAW_MODEL || DEFAULT_DRAW_MODEL,
    drawTimeoutMs: Number.isFinite(options.drawTimeoutMs) ? options.drawTimeoutMs : 300000,
    drawRetries: Number.isFinite(options.drawRetries) ? options.drawRetries : DEFAULT_DRAW_RETRIES,
    drawRetryDelayMs: Number.isFinite(options.drawRetryDelayMs) ? options.drawRetryDelayMs : DEFAULT_DRAW_RETRY_DELAY_MS,
    drawConcurrency: Number.isFinite(options.drawConcurrency) ? options.drawConcurrency : DEFAULT_DRAW_CONCURRENCY
  };
}

function makePackagedThemeId(understandingId, brief, options) {
  const base = makeAnimationThemeId(understandingId, brief);
  const suffix = options.noDraw || options.noLlm || options.allowFallback ? "_package" : "_real";
  return base.endsWith(suffix) ? base : `${base}${suffix}`;
}

async function understandSingleVideo(videoPath, options) {
  if (!existsSync(videoPath)) throw new Error(`Video not found: ${toDisplayPath(videoPath)}`);

  const fileInfo = await stat(videoPath);
  const fileHash = await hashFile(videoPath);
  const baseName = path.basename(videoPath, path.extname(videoPath));
  const understandingId = options.understandingId || makeUnderstandingId(baseName, fileHash);
  const outputDir = path.join(UNDERSTANDING_OUTPUT_DIR, understandingId);
  if (!options.forceUnderstanding) {
    const cached = await tryReuseVideoUnderstanding(outputDir, fileHash, {
      allowHeuristic: Boolean(options.noLlm),
      requireSceneAssets: Boolean(options.generateStageAssets)
    });
    if (cached) return { understanding_id: understandingId, reused: true };
  }

  await rm(outputDir, { recursive: true, force: true });
  await mkdir(path.join(outputDir, "analysis_frames"), { recursive: true });

  const pipelineSteps = [];
  const warnings = [];
  const metadata = await extractVideoMetadata(videoPath, pipelineSteps, warnings);
  const sidecarText = await readTranscriptSidecars(videoPath);
  const framePaths = await extractKeyframes(videoPath, outputDir, metadata, options, pipelineSteps, warnings);
  const sourceId = makeSourceId(videoPath);

  let modelDecision;
  let modelStatus;
  if (options.noLlm) {
    modelDecision = heuristicVideoUnderstanding({ baseName, sourceId, metadata, sidecarText, framePaths });
    modelStatus = { name: "video_understanding_decision", mode: "heuristic", status: "skipped", note: "--no-llm enabled" };
    warnings.push("LLM/VLM disabled by --no-llm; heuristic video understanding was used.");
  } else {
    const result = await understandWithModel({
      videoPath,
      baseName,
      sourceId,
      metadata,
      sidecarText,
      framePaths,
      strict: options.strictLlm,
      model: options.model,
      generateStageAssets: Boolean(options.generateStageAssets)
    });
    modelDecision = result.decision;
    modelStatus = result.status;
    warnings.push(...result.warnings);
  }
  pipelineSteps.push(modelStatus);

  const normalizedUnderstanding = normalizeVideoUnderstanding(modelDecision, {
    baseName,
    sourceId,
    framePaths,
    sidecarText,
    generateStageAssets: Boolean(options.generateStageAssets)
  });
  const relativeFrames = framePaths.map((framePath) => normalizePath(path.relative(outputDir, framePath)));
  const videoUnderstanding = buildVideoUnderstanding({
    understandingId,
    sourceId,
    baseName,
    metadata,
    sidecarText,
    fileInfo,
    fileHash,
    relativeFrames,
    pipelineSteps,
    warnings,
    normalizedUnderstanding,
    generateStageAssets: Boolean(options.generateStageAssets)
  });
  const generationBrief = buildGenerationBrief(videoUnderstanding);

  await writeJson(path.join(outputDir, "video_understanding.json"), videoUnderstanding);
  await writeJson(path.join(outputDir, "generation_brief.json"), generationBrief);

  return { understanding_id: understandingId };
}

async function tryReuseVideoUnderstanding(outputDir, fileHash, options = {}) {
  const understandingPath = path.join(outputDir, "video_understanding.json");
  const briefPath = path.join(outputDir, "generation_brief.json");
  if (!existsSync(understandingPath) || !existsSync(briefPath)) return false;
  try {
    const understanding = await readJson(understandingPath);
    const brief = await readJson(briefPath);
    if (understanding.schema_version !== "video_understanding.v0.1") return false;
    if (brief.schema_version !== "generation_brief.v0.1") return false;
    if (understanding.video?.sha1 !== fileHash) return false;
    if (options.requireSceneAssets && !understanding.pipeline_features?.stage_asset_planning && !hasSceneAssetPlan(understanding) && !hasSceneAssetPlan(brief)) return false;
    if (!options.allowHeuristic && !hasSuccessfulMultimodalUnderstanding(understanding)) return false;
    return true;
  } catch {
    return false;
  }
}

function hasSceneAssetPlan(document) {
  const sceneAssets = document?.scene_assets || document?.creative_game_design?.scene_assets;
  return sceneAssets && typeof sceneAssets === "object" && Object.keys(sceneAssets).length > 0;
}

function hasSuccessfulMultimodalUnderstanding(understanding) {
  return (understanding.pipeline_steps || []).some((step) => (
    step.name === "video_understanding_decision"
    && step.mode === "llm_vlm"
    && step.status === "ok"
  ));
}

async function compareLlmVideos(options) {
  const videoPaths = options.video
    ? [path.resolve(options.video)]
    : await listVideos(path.resolve(options.inputDir || DEFAULT_VIDEO_SOURCE_DIR));

  if (videoPaths.length === 0) {
    throw new Error(`No video files found in ${toDisplayPath(options.inputDir || DEFAULT_VIDEO_SOURCE_DIR)}`);
  }

  await mkdir(COMPARE_OUTPUT_DIR, { recursive: true });
  const results = [];
  for (const videoPath of videoPaths) {
    results.push(await compareSingleVideo(videoPath, options));
  }
  return results;
}

async function compareSingleVideo(videoPath, options) {
  if (!existsSync(videoPath)) throw new Error(`Video not found: ${toDisplayPath(videoPath)}`);

  const fileInfo = await stat(videoPath);
  const fileHash = await hashFile(videoPath);
  const baseName = path.basename(videoPath, path.extname(videoPath));
  const comparisonId = `compare_${makeThemeId(baseName, fileHash)}`;
  const outputDir = path.join(COMPARE_OUTPUT_DIR, comparisonId);
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(path.join(outputDir, "analysis_frames"), { recursive: true });

  const sourceId = makeSourceId(videoPath);
  const basePipelineSteps = [];
  const warnings = [];
  const metadata = await extractVideoMetadata(videoPath, basePipelineSteps, warnings);
  const sidecarText = await readTranscriptSidecars(videoPath);
  const framePaths = await extractKeyframes(videoPath, outputDir, metadata, options, basePipelineSteps, warnings);
  const relativeFrames = framePaths.map((framePath) => normalizePath(path.relative(outputDir, framePath)));

  const providerInputs = {
    videoPath,
    baseName,
    sourceId,
    metadata,
    sidecarText,
    framePaths,
    strict: false
  };
  const providerResults = {
    gemini: await understandWithProvider({
      ...providerInputs,
      providerName: "gemini",
      apiKeyEnvNames: ["RIGHT_CODES_API_KEY", "OPENAI_API_KEY"],
      baseUrl: process.env.RIGHT_CODES_BASE_URL || DEFAULT_GEMINI_BASE_URL,
      model: options.model || process.env.RIGHT_CODES_MODEL || DEFAULT_GEMINI_MODEL,
      promptMode: "vision"
    }),
    codex_pro: await understandWithProvider({
      ...providerInputs,
      providerName: "codex_pro",
      apiKeyEnvNames: ["CODEX_PRO_API_KEY", "RIGHT_CODES_API_KEY", "OPENAI_API_KEY"],
      baseUrl: process.env.CODEX_PRO_BASE_URL || DEFAULT_CODEX_PRO_BASE_URL,
      model: process.env.CODEX_PRO_MODEL || DEFAULT_CODEX_PRO_MODEL,
      promptMode: "vision"
    })
  };

  const normalized = {};
  for (const [provider, result] of Object.entries(providerResults)) {
    normalized[provider] = normalizeVideoUnderstanding(result.decision, {
      baseName,
      sourceId,
      framePaths,
      sidecarText
    });
  }

  const comparison = buildLlmComparison({
    comparisonId,
    sourceId,
    baseName,
    metadata,
    fileInfo,
    fileHash,
    relativeFrames,
    basePipelineSteps,
    warnings,
    providerResults,
    normalized
  });
  await writeJson(path.join(outputDir, "llm_comparison.json"), comparison);
  await writeJson(path.join(outputDir, "gemini.video_understanding.json"), {
    schema_version: "video_understanding.v0.1",
    generated_by: GENERATED_BY,
    generated_at: new Date().toISOString(),
    understanding_id: `${comparisonId}_gemini`,
    source_video: sourceId,
    video: comparison.video,
    extracted_keyframes: relativeFrames,
    pipeline_steps: [...basePipelineSteps, providerResults.gemini.status],
    warnings: [...warnings, ...providerResults.gemini.warnings],
    ...normalized.gemini
  });
  await writeJson(path.join(outputDir, "codex_pro.video_understanding.json"), {
    schema_version: "video_understanding.v0.1",
    generated_by: GENERATED_BY,
    generated_at: new Date().toISOString(),
    understanding_id: `${comparisonId}_codex_pro`,
    source_video: sourceId,
    video: comparison.video,
    extracted_keyframes: relativeFrames,
    pipeline_steps: [...basePipelineSteps, providerResults.codex_pro.status],
    warnings: [...warnings, ...providerResults.codex_pro.warnings],
    ...normalized.codex_pro
  });

  return { comparison_id: comparisonId };
}

async function generateSingleVideoPackage(videoPath, options) {
  if (!existsSync(videoPath)) throw new Error(`Video not found: ${toDisplayPath(videoPath)}`);

  const fileInfo = await stat(videoPath);
  const fileHash = await hashFile(videoPath);
  const baseName = path.basename(videoPath, path.extname(videoPath));
  const themeId = options.themeId || makeThemeId(baseName, fileHash);
  const reusedAnalysisReport = options.reuseAnalysisReport
    ? await readJson(path.resolve(options.reuseAnalysisReport))
    : null;
  const packDir = path.join(OUTPUT_DIR, themeId);
  await rm(packDir, { recursive: true, force: true });
  await mkdir(path.join(packDir, "assets"), { recursive: true });
  await mkdir(path.join(packDir, "analysis_frames"), { recursive: true });

  const pipelineSteps = [];
  const warnings = [];
  const metadata = await extractVideoMetadata(videoPath, pipelineSteps, warnings);
  const sidecarText = await readTranscriptSidecars(videoPath);
  const frameOptions = buildFrameOptions(options, reusedAnalysisReport);
  const framePaths = await extractKeyframes(videoPath, packDir, metadata, frameOptions, pipelineSteps, warnings);
  const sourceId = makeSourceId(videoPath);

  let llmDecision;
  let llmStatus;
  if (reusedAnalysisReport) {
    llmStatus = {
      name: "llm_vlm_decision",
      mode: "reuse_analysis_report",
      status: "ok",
      source: normalizePath(path.relative(WINDOW_DIR, path.resolve(options.reuseAnalysisReport))),
      model: findModelFromPipelineSteps(reusedAnalysisReport.pipeline_steps)
    };
    llmDecision = reusedAnalysisReport.llm_decision;
  } else if (options.noLlm) {
    llmStatus = { mode: "disabled", status: "skipped", note: "--no-llm enabled" };
    llmDecision = heuristicVideoDecision({ baseName, sidecarText, metadata });
    warnings.push("LLM/VLM disabled by --no-llm; heuristic fallback decision was used.");
  } else {
    const llmResult = await decideWithModel({
      videoPath,
      baseName,
      sourceId,
      metadata,
      sidecarText,
      framePaths,
      strict: options.strictLlm,
      model: options.model
    });
    llmDecision = llmResult.decision;
    llmStatus = llmResult.status;
    warnings.push(...llmResult.warnings);
  }
  pipelineSteps.push(llmStatus);

  const normalizedDecision = normalizeDecision(llmDecision, { baseName, sidecarText });
  const config = buildVideoConfig({
    themeId,
    displayName: options.displayName || normalizedDecision.display_name || baseName,
    sourceId,
    metadata,
    sidecarText,
    decision: normalizedDecision
  });

  const manifest = buildManifest(config, normalizedDecision);
  const assetExtraction = await writeVideoExtractedAssets(packDir, manifest, normalizedDecision, framePaths, warnings, options);
  pipelineSteps.push({
    name: "extract_assets_from_frames",
    mode: assetExtraction.mode,
    status: assetExtraction.status,
    count: assetExtraction.assets.length
  });
  const analysisReport = buildAnalysisReport(config, normalizedDecision, {
    mode: "video",
    metadata,
    framePaths: framePaths.map((framePath) => normalizePath(path.relative(packDir, framePath))),
    assetExtraction,
    pipelineSteps,
    warnings,
    file: {
      name: path.basename(videoPath),
      size_bytes: fileInfo.size,
      sha1: fileHash
    }
  });

  await writeJson(path.join(packDir, "manifest.json"), manifest);
  await writeJson(path.join(packDir, "analysis_report.json"), analysisReport);

  const status = buildPackageStatus(packDir, manifest, warnings);
  await writeJson(path.join(packDir, "package_status.json"), status);

  const validation = validatePackage(packDir, manifest, status);
  if (!validation.ok) {
    throw new Error(`${themeId} failed validation:\n${validation.issues.join("\n")}`);
  }

  return { theme_id: themeId };
}

function buildFrameOptions(options, reusedAnalysisReport) {
  if (options.frames) return options;
  const reusedFrameCount = Array.isArray(reusedAnalysisReport?.extracted_keyframes)
    ? reusedAnalysisReport.extracted_keyframes.length
    : 0;
  if (reusedFrameCount > 0) return { ...options, frames: reusedFrameCount };
  return options;
}

async function generateFramePackages(options) {
  options = normalizeDrawOptions(options);
  const inputs = await resolveUnderstandingInputs(options.understanding);
  if (inputs.length === 0) {
    throw new Error(`No video understanding results found in ${toDisplayPath(UNDERSTANDING_OUTPUT_DIR)}.`);
  }
  if (options.themeId && inputs.length > 1) {
    throw new Error("--theme-id can only be used with a single understanding input.");
  }

  await mkdir(OUTPUT_DIR, { recursive: true });
  const results = [];
  for (const input of inputs) {
    results.push(await generateFramePackageFromUnderstanding(input, options));
  }
  return results;
}

async function resolveUnderstandingInputs(input) {
  const values = Array.isArray(input) ? input : input ? [input] : [];
  if (values.length > 0) {
    const resolved = [];
    for (const value of values) resolved.push(await resolveSingleUnderstandingInput(value));
    return resolved;
  }

  if (!existsSync(UNDERSTANDING_OUTPUT_DIR)) return [];
  const entries = await readdir(UNDERSTANDING_OUTPUT_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => ({
      id: entry.name,
      dir: path.join(UNDERSTANDING_OUTPUT_DIR, entry.name),
      briefPath: path.join(UNDERSTANDING_OUTPUT_DIR, entry.name, "generation_brief.json"),
      understandingPath: path.join(UNDERSTANDING_OUTPUT_DIR, entry.name, "video_understanding.json")
    }))
    .filter((item) => existsSync(item.briefPath));
}

async function resolveSingleUnderstandingInput(value) {
  const text = String(value || "").trim();
  const candidate = path.resolve(text);
  if (existsSync(candidate)) {
    const info = await stat(candidate);
    if (info.isDirectory()) {
      return {
        id: path.basename(candidate),
        dir: candidate,
        briefPath: path.join(candidate, "generation_brief.json"),
        understandingPath: path.join(candidate, "video_understanding.json")
      };
    }
    return {
      id: path.basename(path.dirname(candidate)),
      dir: path.dirname(candidate),
      briefPath: candidate.endsWith("generation_brief.json") ? candidate : path.join(path.dirname(candidate), "generation_brief.json"),
      understandingPath: path.join(path.dirname(candidate), "video_understanding.json")
    };
  }

  const dir = path.join(UNDERSTANDING_OUTPUT_DIR, text);
  return {
    id: text,
    dir,
    briefPath: path.join(dir, "generation_brief.json"),
    understandingPath: path.join(dir, "video_understanding.json")
  };
}

async function generateFramePackageFromUnderstanding(input, options = {}) {
  if (!existsSync(input.briefPath)) throw new Error(`generation_brief.json not found: ${toDisplayPath(input.briefPath)}`);
  options = withDrawScheduler(options);

  let brief = await readJson(input.briefPath);
  const understanding = existsSync(input.understandingPath) ? await readJson(input.understandingPath) : null;
  const roleMapping = mapBriefCharactersToContractRoles(brief.characters || []);
  brief = withBriefSkillTaunts(brief, roleMapping.characters);
  const themeId = options.themeId || makeAnimationThemeId(input.id, brief);
  const packDir = path.join(OUTPUT_DIR, themeId);
  const warnings = [];
  const pipelineSteps = [
    {
      name: "load_generation_brief",
      mode: "json",
      status: "ok",
      source: normalizePath(path.relative(DELIVERY_DIR, input.briefPath))
    },
    {
      name: "map_roles_to_contract",
      mode: "deterministic",
      status: roleMapping.warnings.length > 0 ? "warn" : "ok",
      notes: roleMapping.warnings
    }
  ];
  warnings.push(...roleMapping.warnings);

  await rm(packDir, { recursive: true, force: true });
  await mkdir(path.join(packDir, "assets", "raw"), { recursive: true });
  await mkdir(path.join(packDir, "frames"), { recursive: true });

  const manifest = buildAnimationThemeManifest({ themeId, brief, roleMapping, understanding });
  await writePlaceholderAsset(packDir, manifest, manifest.environment.background);
  await writePlaceholderAsset(packDir, manifest, manifest.taunt.bubble);

  const playerResultsPromise = runWithConcurrency(["p1", "p2"], 2, async (playerId) => {
    const localWarnings = [];
    const mapped = roleMapping.byId[playerId];
    const character = mapped.character;
    const role = mapped.role;
    const referenceImagePaths = resolveEvidenceFramePaths(input.dir, character.evidence_frames).slice(0, 2);
    const prompt = buildCharacterSpritePrompt(brief, character, role, options);
    const retryPrompt = options.safeRemix
      ? ""
      : buildCharacterSpritePrompt(brief, character, role, { ...options, deidentifyIpNames: true });
    const rawPath = path.join(packDir, "assets", "raw", `${playerId}_sprite_sheet_raw.png`);
    const sheetPath = path.join(packDir, "assets", `${playerId}_sprite_sheet.png`);
    const framesDir = path.join(packDir, "frames", playerId);
    const projectilePromise = shouldGenerateProjectile(character, role)
      ? generateProjectileAsset({ packDir, brief, character, mapped, manifest, options, warnings: localWarnings, referenceImagePaths })
        .then((value) => ({ ok: true, value }), (error) => ({ ok: false, error }))
      : Promise.resolve({ ok: true, value: null });

    const drawResult = await drawOrPlaceholder({
      prompt,
      outputPath: rawPath,
      kind: "character",
      role,
      playerId,
      referenceImagePaths,
      options,
      retryPrompt,
      visualMode: options.safeRemix ? "safe_remix" : "faithful",
      retryVisualMode: "faithful_deidentified_names",
      color: playerId === "p1" ? manifest.players.p1.placeholder_color : manifest.players.p2.placeholder_color,
      accent: manifest.environment.accent_color,
      targetSize: CHARACTER_SHEET_SIZE,
      layout: "3x3"
    });
    localWarnings.push(...drawResult.warnings);

    let postprocess = await postprocessSpriteSheet({
      inputPath: rawPath,
      sheetPath,
      framesDir,
      layout: "3x3",
      frameNames: ANIMATION_FRAME_NAMES,
      targetSize: CHARACTER_SHEET_SIZE
    });
    let finalDrawResult = drawResult;
    const initialQualityIssues = getPostprocessQualityIssues(postprocess);
    if (shouldRetrySpriteForQuality({ postprocess, drawResult, options })) {
      const repairPrompt = buildSpriteQualityRepairPrompt(prompt, initialQualityIssues, "3x3");
      const repairRetryPrompt = retryPrompt ? buildSpriteQualityRepairPrompt(retryPrompt, initialQualityIssues, "3x3") : "";
      localWarnings.push(`${playerId} sprite sheet triggered quality retry after postprocess warnings: ${initialQualityIssues.join("; ")}`);
      finalDrawResult = await drawOrPlaceholder({
        prompt: repairPrompt,
        outputPath: rawPath,
        kind: "character",
        role,
        playerId,
        referenceImagePaths,
        options,
        retryPrompt: repairRetryPrompt,
        visualMode: `${options.safeRemix ? "safe_remix" : "faithful"}_quality_retry`,
        retryVisualMode: "quality_retry_deidentified_names",
        color: playerId === "p1" ? manifest.players.p1.placeholder_color : manifest.players.p2.placeholder_color,
        accent: manifest.environment.accent_color,
        targetSize: CHARACTER_SHEET_SIZE,
        layout: "3x3"
      });
      localWarnings.push(...finalDrawResult.warnings);
      postprocess = await postprocessSpriteSheet({
        inputPath: rawPath,
        sheetPath,
        framesDir,
        layout: "3x3",
        frameNames: ANIMATION_FRAME_NAMES,
        targetSize: CHARACTER_SHEET_SIZE
      });
      finalDrawResult.status.quality_retry = {
        triggered: true,
        initial_issues: initialQualityIssues,
        final_quality: postprocess.quality?.status || "unknown"
      };
      const finalQualityIssues = getPostprocessQualityIssues(postprocess);
      if (finalQualityIssues.length > 0) {
        localWarnings.push(`${playerId} sprite sheet still has postprocess quality warnings after retry: ${finalQualityIssues.join("; ")}`);
      }
    }

    const projectileOutcome = await projectilePromise;
    if (!projectileOutcome.ok) throw projectileOutcome.error;
    const projectile = projectileOutcome.value;
    const animationManifest = buildCharacterAnimationManifest({
      themeId,
      playerId,
      character,
      role,
      frameSize: postprocess.frame_size,
      projectile
    });
    await writeJson(path.join(packDir, `${playerId}_animation_manifest.json`), animationManifest);
    await writeCompatibilityPlayerAssets({ packDir, playerId, role, projectile });

    return {
      warnings: localWarnings,
      record: {
        player_id: playerId,
        character_name: character.name,
        role,
        original_role_type: character.role_type,
        original_attack_type: character.attack_type,
        visual_mode: finalDrawResult.status.visual_mode || (options.safeRemix ? "safe_remix" : "faithful"),
        prompt_retry: finalDrawResult.status.retry?.triggered ? retryPrompt : undefined,
        prompt,
        reference_images: referenceImagePaths.map((framePath) => normalizePath(path.relative(packDir, framePath))),
        draw: finalDrawResult.status,
        postprocess,
        animation_manifest: `${playerId}_animation_manifest.json`,
        projectile
      }
    };
  });
  const stageGenerationPromise = options.generateStageAssets
    ? generateStageAssets({ packDir, brief, manifest, options, sourceInput: input, warnings })
      .then((value) => ({ ok: true, value }), (error) => ({ ok: false, error }))
    : Promise.resolve({
        ok: true,
        value: {
          enabled: false,
          mode: "template_fallback",
          reason: "--generate-stage-assets was not set"
        }
      });

  const playerResults = await playerResultsPromise;
  const generationRecords = [];
  for (const result of playerResults) {
    warnings.push(...result.warnings);
    generationRecords.push(result.record);
  }

  const stageGenerationOutcome = await stageGenerationPromise;
  if (!stageGenerationOutcome.ok) throw stageGenerationOutcome.error;
  const stageGeneration = stageGenerationOutcome.value;

  const analysisReport = buildAnimationAnalysisReport({
    themeId,
    brief,
    understanding,
    input,
    roleMapping,
    pipelineSteps,
    generationRecords,
    stageGeneration,
    warnings
  });
  await writeJson(path.join(packDir, "manifest.json"), manifest);
  await writeJson(path.join(packDir, "analysis_report.json"), analysisReport);

  const status = buildAnimationPackageStatus(packDir, manifest, warnings);
  await writeJson(path.join(packDir, "package_status.json"), status);

  const validation = await validateThemePackDir(packDir, themeId);
  if (!validation.ok) {
    throw new Error(`${themeId} failed validation:\n${validation.issues.join("\n")}`);
  }

  return { theme_id: themeId };
}

function normalizeDrawConcurrency(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return DEFAULT_DRAW_CONCURRENCY;
  return Math.max(1, Math.min(8, Math.floor(number)));
}

async function runWithConcurrency(items, concurrency, worker) {
  const limit = Math.max(1, Math.min(items.length || 1, concurrency));
  const results = new Array(items.length);
  let index = 0;
  async function runNext() {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await worker(items[current], current);
    }
  }
  await Promise.all(Array.from({ length: limit }, () => runNext()));
  return results;
}

function withDrawScheduler(options) {
  if (options.drawScheduler) return options;
  return {
    ...options,
    drawScheduler: createDrawScheduler(normalizeDrawConcurrency(options.drawConcurrency))
  };
}

function createDrawScheduler(concurrency) {
  const limit = normalizeDrawConcurrency(concurrency);
  const queue = [];
  let active = 0;
  const run = (label, task) => {
    const queuedAtMs = Date.now();
    return new Promise((resolve, reject) => {
      queue.push({ label: label || "asset", task, queuedAtMs, resolve, reject });
      pump();
    });
  };
  const pump = () => {
    while (active < limit && queue.length > 0) {
      const item = queue.shift();
      active += 1;
      const startedAtMs = Date.now();
      Promise.resolve()
        .then(item.task)
        .then((value) => {
          const finishedAtMs = Date.now();
          resolveScheduledDraw(item, value, {
            label: item.label,
            concurrency_limit: limit,
            queued_at: new Date(item.queuedAtMs).toISOString(),
            started_at: new Date(startedAtMs).toISOString(),
            finished_at: new Date(finishedAtMs).toISOString(),
            wait_ms: startedAtMs - item.queuedAtMs,
            duration_ms: finishedAtMs - startedAtMs
          });
        })
        .catch((error) => {
          const finishedAtMs = Date.now();
          error.draw_queue = {
            label: item.label,
            concurrency_limit: limit,
            queued_at: new Date(item.queuedAtMs).toISOString(),
            started_at: new Date(startedAtMs).toISOString(),
            finished_at: new Date(finishedAtMs).toISOString(),
            wait_ms: startedAtMs - item.queuedAtMs,
            duration_ms: finishedAtMs - startedAtMs
          };
          item.reject(error);
        })
        .finally(() => {
          active -= 1;
          pump();
        });
    }
  };
  return { run, concurrency: limit };
}

function resolveScheduledDraw(item, value, drawQueue) {
  item.resolve({ value, drawQueue });
}

async function runScheduledDraw(options, label, task) {
  const scheduler = options.drawScheduler || createDrawScheduler(normalizeDrawConcurrency(options.drawConcurrency));
  if (!options.drawScheduler) options.drawScheduler = scheduler;
  return scheduler.run(label, task);
}

function mapBriefCharactersToContractRoles(characters) {
  const normalized = ["p1", "p2"].map((id, index) => normalizeBriefCharacter(characters[index] || {}, id, index));
  const warnings = [];
  const roleCandidates = normalized.map((character, index) => ({
    index,
    id: character.id,
    character,
    initialRole: inferContractRole(character, index),
    rangedScore: roleScore(character, "ranged"),
    meleeScore: roleScore(character, "melee")
  }));

  let roles = roleCandidates.map((item) => item.initialRole);
  if (!roles.includes("melee") || !roles.includes("ranged") || roles[0] === roles[1]) {
    const ranged = roleCandidates.slice().sort((a, b) => (b.rangedScore - b.meleeScore) - (a.rangedScore - a.meleeScore))[0];
    roles = roleCandidates.map((item) => item.index === ranged.index ? "ranged" : "melee");
    warnings.push("generation_brief role_type may be hybrid/ambiguous; mapped to one melee and one ranged role for ThemeAssetPackage v0.1.");
  }

  const byId = {};
  for (const item of roleCandidates) {
    const role = roles[item.index];
    byId[item.id] = { ...item, role };
  }
  return { characters: normalized, byId, warnings };
}

function withBriefSkillTaunts(brief, normalizedCharacters) {
  const characters = (brief.characters || []).map((character, index) => ({
    ...character,
    skill_taunt: normalizedCharacters[index]?.skill_taunt
      || normalizeSkillTaunt(pickSkillTauntRaw(character), defaultSkillTaunt(index, {
        fighterName: character?.name,
        globalTaunt: brief.taunt,
        fallbackFrames: character?.evidence_frames
      }), {
        fighterName: character?.name,
        fighterId: character?.id || (index === 0 ? "p1" : "p2"),
        fallbackFrames: character?.evidence_frames
      })
  }));
  return {
    ...brief,
    characters,
    player_taunts: {
      ...(brief.player_taunts || {}),
      p1: characters.find((character) => character.id === "p1")?.skill_taunt || characters[0]?.skill_taunt,
      p2: characters.find((character) => character.id === "p2")?.skill_taunt || characters[1]?.skill_taunt
    }
  };
}

function normalizeBriefCharacter(raw, fallbackId, index) {
  const id = raw.id === "p2" ? "p2" : raw.id === "p1" ? "p1" : fallbackId;
  const name = stringOr(raw.name, index === 0 ? "角色A" : "角色B");
  const evidenceFrames = normalizeStringArray(raw.evidence_frames);
  return {
    id,
    name,
    archetype_name: stringOr(raw.archetype_name, raw.name || (index === 0 ? "角色A" : "角色B")),
    role_type: normalizeRoleType(raw.role_type, "unknown"),
    visual_prompt: stringOr(raw.visual_prompt, raw.prompt_seed || raw.name || "源视频匹配的游戏主体"),
    form_constraints: normalizeFormConstraints(raw.form_constraints || raw.formConstraints),
    weapon_prompt: stringOr(raw.weapon_prompt, "默认武器"),
    projectile_prompt: stringOr(raw.projectile_prompt, ""),
    weapon_source: normalizeSource(raw.weapon_source, "fallback_design"),
    creativity_level: normalizeCreativity(raw.creativity_level, "stylized"),
    attack_type: normalizeAttackType(raw.attack_type, "unknown"),
    evidence_frames: evidenceFrames,
    skill_taunt: normalizeSkillTaunt(
      pickSkillTauntRaw(raw),
      defaultSkillTaunt(index, { fighterName: name, fallbackFrames: evidenceFrames }),
      { fighterName: name, fighterId: id, fallbackFrames: evidenceFrames }
    ),
    prompt_seed: stringOr(raw.prompt_seed, [raw.visual_prompt, raw.weapon_prompt, raw.projectile_prompt].filter(Boolean).join("; "))
  };
}

function pickSkillTauntRaw(raw) {
  if (!raw || typeof raw !== "object") return raw;
  return raw.skill_taunt
    ?? raw.skillTaunt
    ?? raw.taunt_skill
    ?? raw.tauntSkill
    ?? raw.skill_line
    ?? raw.skillLine
    ?? raw.catchphrase
    ?? raw.quote
    ?? raw.taunt;
}

function normalizeSkillTaunt(raw, fallback = {}, context = {}) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : { text: raw };
  const text = cleanSkillTauntText(
    source.text
      ?? source.line
      ?? source.skill_text
      ?? source.skillText
      ?? source.skill_line
      ?? source.skillLine
      ?? source.taunt_text
      ?? source.tauntText
      ?? source.catchphrase
      ?? source.quote
      ?? source.content,
    fallback.text || fallback.fallback_text || "嘿！"
  );
  const fallbackFrames = fallback.evidence_frames || fallback.frames || context.fallbackFrames || [frameRef(1, context)];
  return {
    text,
    source: normalizeSkillTauntSource(source.source, fallback.source || "fallback_design"),
    speaker: stringOr(source.speaker || source.character || source.owner || context.fighterName, fallback.speaker || context.fighterId || "unknown"),
    evidence_frames: normalizeFrameArray(source.evidence_frames || source.frames || source.evidence?.frames || fallbackFrames, context),
    reason: stringOr(source.reason || source.note, fallback.reason || "技能语句兜底。"),
    confidence: clampConfidence(source.confidence ?? fallback.confidence ?? 0.35),
    fallback_text: cleanSkillTauntText(source.fallback_text ?? source.fallbackText, fallback.fallback_text || "嘿！")
  };
}

function normalizeSkillTauntSource(value, fallback = "fallback_design") {
  const source = String(value || "").toLowerCase();
  if (["dialogue_or_subtitle", "observed_from_video", "derived_from_scene", "onomatopoeia", "fallback_design"].includes(source)) return source;
  return fallback;
}

function defaultSkillTaunt(index, context = {}) {
  const fallbackText = index === 0 ? "嘿！" : "哼！";
  const dialogueLine = pickDialogueLine(context, index);
  const globalTaunt = context.globalTaunt || {};
  const canUseGlobal = index === 0 && globalTaunt.text && globalTaunt.source !== "fallback_design";
  const text = dialogueLine || (canUseGlobal ? globalTaunt.text : fallbackText);
  return {
    text: cleanSkillTauntText(text, fallbackText),
    source: dialogueLine ? "dialogue_or_subtitle" : canUseGlobal ? normalizeSkillTauntSource(globalTaunt.source) : "onomatopoeia",
    speaker: stringOr(context.fighterName, index === 0 ? "p1" : "p2"),
    evidence_frames: normalizeFrameArray(context.fallbackFrames || [frameRef(index + 1, context)], context),
    reason: dialogueLine
      ? "来自字幕/文稿候选，模型未明确分配给角色时作为技能语句兜底。"
      : "视频没有可稳定分配给该角色的台词时，使用短拟声/情绪语句兜底。",
    confidence: dialogueLine ? 0.45 : canUseGlobal ? clampConfidence(globalTaunt.confidence ?? 0.45) : 0.3,
    fallback_text: fallbackText
  };
}

function pickDialogueLine(context = {}, index = 0) {
  const sourceText = (context.sidecarText || []).map((item) => item?.text || "").join("\n");
  const observedText = Array.isArray(context.observedDialogue) ? context.observedDialogue.join("\n") : "";
  const lines = `${sourceText}\n${observedText}`
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-•\d.、:：]+/, "").trim())
    .filter((line) => line && line.length <= 60);
  const unique = Array.from(new Set(lines));
  return unique[index] || "";
}

function cleanSkillTauntText(value, fallback) {
  return stringOr(value, fallback).replace(/\s+/g, " ").trim().slice(0, 32);
}

function inferContractRole(character, index) {
  if (character.attack_type === "throw") return "ranged";
  if (character.attack_type === "swing") return "melee";
  if (character.role_type === "ranged") return "ranged";
  if (character.role_type === "melee") return "melee";
  return index === 0 ? "melee" : "ranged";
}

function roleScore(character, role) {
  if (role === "ranged") {
    return (character.role_type === "ranged" ? 4 : 0)
      + (character.attack_type === "throw" ? 5 : 0)
      + (character.role_type === "hybrid" ? 2 : 0)
      + (character.attack_type === "hybrid" ? 2 : 0)
      + (character.projectile_prompt ? 1 : 0);
  }
  return (character.role_type === "melee" ? 4 : 0)
    + (character.attack_type === "swing" ? 5 : 0)
    + (character.role_type === "hybrid" ? 2 : 0)
    + (character.attack_type === "hybrid" ? 2 : 0);
}

function makeAnimationThemeId(understandingId, brief) {
  const id = String(understandingId || "").replace(/^understanding_/, "");
  const clean = id.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/^_+|_+$/g, "");
  if (clean) return `anim_${clean}`;
  const source = path.basename(brief.source_video || "video", path.extname(brief.source_video || ""));
  return `anim_${makeThemeId(source, createHash("sha1").update(source).digest("hex"))}`;
}

function buildAnimationThemeManifest(input) {
  const { themeId, brief, roleMapping, understanding } = input;
  const p1 = roleMapping.byId.p1;
  const p2 = roleMapping.byId.p2;
  const p1SkillTaunt = p1?.character?.skill_taunt || defaultSkillTaunt(0, { fighterName: p1?.character?.name, globalTaunt: brief.taunt });
  const p2SkillTaunt = p2?.character?.skill_taunt || defaultSkillTaunt(1, { fighterName: p2?.character?.name, globalTaunt: brief.taunt });
  const globalTauntText = stringOr(brief.taunt?.text, p1SkillTaunt.text || "看招").slice(0, 24);
  const themeColor = colorFromText(brief.shared_style?.world || brief.source_video || "theme", "#4C7A9F");
  const accentColor = colorFromText(brief.conflict?.tone || globalTauntText || "accent", "#D94F30");
  return {
    contract_version: CONTRACT_VERSION,
    theme_id: themeId,
    display_name: buildDisplayName(brief),
    source: {
      type: "video_ai_animation",
      source_id: brief.source_video || understanding?.source_video || "unknown_video",
      rights_mode: "mock_or_authorized"
    },
    environment: {
      name: stringOr(brief.shared_style?.world, "视频主题世界"),
      theme_color: themeColor,
      accent_color: accentColor,
      background: "assets/background.png",
      fallback: "solid_color"
    },
    players: {
      p1: buildAnimationManifestPlayer("p1", p1, themeId, themeColor, accentColor),
      p2: buildAnimationManifestPlayer("p2", p2, themeId, accentColor, themeColor)
    },
    taunt: {
      text: globalTauntText,
      stun_ms: 700,
      cooldown_ms: 12000,
      bubble: "assets/taunt_bubble.png",
      fallback_text: "看招",
      confidence: clampConfidence(brief.taunt?.confidence ?? understanding?.creative_game_design?.confidence ?? 0.7),
      player_taunts: {
        p1: p1SkillTaunt,
        p2: p2SkillTaunt
      }
    },
    animation_package: {
      version: "animation_theme.v0.1",
      frame_order: ANIMATION_FRAME_NAMES,
      projectile_frame_order: PROJECTILE_FRAME_NAMES,
      notes: "Extra animation fields are additive; core ThemeAssetPackage v0.1 fields remain compatible."
    },
    analysis: {
      relationship: stringOr(brief.conflict?.relationship, "视频中的对抗关系"),
      combat_mapping_reason: stringOr(brief.conflict?.reason, "根据视频理解和武器类型映射为 1v1 对抗。"),
      overall_confidence: clampConfidence(understanding?.creative_game_design?.confidence ?? brief.taunt?.confidence ?? 0.7)
    }
  };
}

function buildAnimationManifestPlayer(playerId, mapped, themeId, color, accent) {
  const character = mapped.character;
  const role = mapped.role;
  const hasProjectileAnimation = shouldGenerateProjectile(character, role);
  return {
    name: character.name,
    role,
    body: `assets/${playerId}_body.png`,
    head: `assets/${playerId}_head.png`,
    melee_prop: role === "melee" ? `assets/${playerId}_melee_prop.png` : null,
    projectile: role === "ranged" ? `assets/${playerId}_projectile.png` : null,
    attack_prop_name: extractWeaponName(character.weapon_prompt),
    placeholder_color: color,
    fallback: pickFallbackForRole({
      body: "whitebox_body",
      head: "whitebox_head",
      melee_prop: "default_stick",
      projectile: "default_ball"
    }, role),
    confidence: 0.8,
    sprite_sheet: `assets/${playerId}_sprite_sheet.png`,
    animation_manifest: `${playerId}_animation_manifest.json`,
    projectile_animation: hasProjectileAnimation ? {
      static: `assets/${playerId}_projectile.png`,
      sheet: `assets/${playerId}_projectile_sheet.png`,
      manifest: `${playerId}_projectile_manifest.json`
    } : null,
    original_role_type: character.role_type,
    original_attack_type: character.attack_type,
    weapon_source: character.weapon_source,
    creativity_level: character.creativity_level,
    skill_taunt: character.skill_taunt,
    accent_color: accent,
    character_id: `${playerId}_${themeId}`
  };
}

function buildDisplayName(brief) {
  const names = (brief.characters || []).map((character) => character.name).filter(Boolean).slice(0, 2);
  if (names.length === 2) return `${names[0]} vs ${names[1]}`;
  return path.basename(brief.source_video || "动画主题", path.extname(brief.source_video || ""));
}

function resolveEvidenceFramePaths(understandingDir, evidenceFrames) {
  const baseDir = path.resolve(understandingDir || UNDERSTANDING_OUTPUT_DIR);
  const paths = [];
  for (const frame of normalizeStringArray(evidenceFrames)) {
    const text = String(frame || "").replace(/\\/g, "/");
    if (!text || text.includes("..")) continue;
    const resolved = path.resolve(baseDir, text);
    if (!resolved.startsWith(baseDir) || !existsSync(resolved)) continue;
    paths.push(resolved);
  }
  return Array.from(new Set(paths));
}

function extractWeaponName(weaponPrompt) {
  const text = stringOr(weaponPrompt, "默认武器");
  const parts = text.split(/[：:]/);
  return stringOr(parts[0], text).slice(0, 24);
}

function colorFromText(text, fallback) {
  const hash = createHash("sha1").update(String(text || fallback)).digest();
  const rgb = [hash[0], hash[1], hash[2]].map((value) => 72 + (value % 128));
  return toHex([...rgb, 255]);
}

function buildCharacterSpritePrompt(brief, character, role, options = {}) {
  const roleLine = role === "ranged"
    ? "The attack frame must clearly show aiming, throwing, shooting, or casting; the flying object is generated separately, not only inside attack_0."
    : "The attack frame must clearly show a melee swing, slash, or strike with the weapon extended.";
  const safeRemix = Boolean(options.safeRemix);
  const promptName = imagePromptText(character.name || "fighter", options);
  const visualPrompt = imagePromptText(character.visual_prompt, options);
  const weaponPrompt = imagePromptText(character.weapon_prompt, options);
  const projectilePrompt = imagePromptText(character.projectile_prompt, options);
  const styleWorld = imagePromptText(brief.shared_style?.world || "", options);
  const artDirection = imagePromptText(brief.shared_style?.art_direction || "match the source video's own visual style while making animation frames readable", options);
  const colorNotes = imagePromptText(brief.shared_style?.color_notes || "", options);
  const consistency = imagePromptText(brief.shared_style?.character_consistency || "same source-derived identity, form, scale, colors, weapon, and silhouette across all frames", options);
  const formConstraints = imagePromptText(formatFormConstraints(character.form_constraints), options);
  return [
    "Create a 3x3 sprite sheet for a 2D mobile fighting game on a perfectly flat solid #00ff00 chroma-key background.",
    "Visual target: game-ready animation frames that preserve the source video's own visual medium, shape language, detail density, line weight, flatness, color palette, and rendering style; not abstract, not a placeholder.",
    "Use the attached source-video keyframes as visual references. Match their simplicity, facial feature style, outline thickness, shading amount, accessory count, and material treatment. Do not beautify, polish, upscale, or add detail beyond the source evidence.",
    "The reference keyframes may contain other characters or background elements; use them only for the named subject and source style evidence. Do not include extra characters or background in the sprite sheet.",
    safeRemix
      ? "Safe-remix mode: use the video analysis as archetype and evidence, but create an original game character design."
      : "Faithful mode: use the video analysis as the primary visual reference and preserve the recognizable source character identity, entity type, body plan, costume/surface, weapon, color logic, proportions, and silhouette as much as the image model permits.",
    safeRemix
      ? "Design original identity details while retaining the source-derived entity category, body plan, material family, and broad motion logic unless the source evidence is uncertain; avoid copying iconic franchise shapes, masks, logos, costumes, or exact color-coded weapons."
      : "Do not silently redesign the source entity into a different species, object category, body plan, or art medium. Do not make a non-human source humanoid unless the video clearly shows a humanoid.",
    `One ${promptName} ${role} fighter/entity, facing right in all 9 frames. The subject must be fully visible in every cell in a form compatible with the source video.`,
    `Video-derived character description: ${visualPrompt}`,
    formConstraints ? `Source form constraints: ${formConstraints}` : "",
    `Weapon and attack prop: ${weaponPrompt}`,
    projectilePrompt ? `Projectile idea for separate asset: ${projectilePrompt}` : "",
    `Shared art direction: ${artDirection}`,
    `World/style evidence: ${styleWorld}; ${colorNotes}`,
    `Consistency requirements: ${consistency}`,
    "Use an invisible 3-column by 3-row grid with equal cells and generous spacing. Do not draw visible panel borders.",
    "The sheet must contain exactly 9 poses: exactly 3 columns and exactly 3 rows, with no fourth column, no extra bonus poses, and no cropped partial poses outside the grid.",
    "Scale the subject down when needed so the full body, hair, cape, weapon, slash effect, and extended limbs fit inside each cell. Prefer a smaller readable fighter over a large cropped fighter.",
    "Keep at least 12% clean #00ff00 margin between every visible part and each cell edge; no head, foot, cape, hair, weapon tip, projectile, or motion effect may touch or cross a cell boundary.",
    "Leave a clean #00ff00 safety gutter around every cell. No body part, weapon, slash effect, cable, debris, shadow, or projectile may cross into a neighboring cell.",
    "Keep each pose centered inside its own cell, with a consistent feet baseline for grounded poses and enough green margin on all sides.",
    "Each cell contains exactly one complete pose of the same source-derived subject, with the source body plan visible, clean edges, and readable silhouette.",
    "Keep the same source-derived face/surface details, head or front shape, outfit or material, colors, body scale, weapon, and art style across all nine frames.",
    "Keep details at the source video's level: if the source is flat, low-shadow, sticker-like, low-detail, pixel-like, live-action, 3D, mechanical, or painterly, keep that same level and medium instead of upgrading it to another illustration style.",
    "Feet should stay aligned to a consistent baseline for grounded poses; jump and fall may lift off the baseline while staying centered in their cells.",
    "Frame order left-to-right, top-to-bottom: idle standing, idle breathing, run 1, run 2, run 3, run 4, jump, fall, attack.",
    roleLine,
    "Avoid silhouettes, stick figures, flat color mannequins, geometric blobs, toy blocks, rough thumbnails, icons, UI sprites, unintended low-poly forms, or any visual style not supported by the source video evidence.",
    "No text, no labels, no watermark, no shadows, no floor, no extra characters, no UI, no panel borders.",
    "The background must be one uniform #00ff00 color with no gradient, texture, lighting variation, floor plane, reflection, or shadow.",
    "Avoid #00ff00 anywhere on the character or weapon."
  ].filter(Boolean).join("\n");
}

function buildProjectileSpritePrompt(brief, character, options = {}) {
  const safeRemix = Boolean(options.safeRemix);
  const promptName = imagePromptText(character.name || "owner fighter", options);
  const visualPrompt = imagePromptText(character.visual_prompt, options);
  const weaponPrompt = imagePromptText(character.weapon_prompt, options);
  const projectilePrompt = imagePromptText(character.projectile_prompt || character.weapon_prompt || "readable thrown object", options);
  const artDirection = imagePromptText(brief.shared_style?.art_direction || "match the source video's own visual style while keeping the projectile readable", options);
  const formConstraints = imagePromptText(formatFormConstraints(character.form_constraints), options);
  return [
    "Create a 1x4 sprite sheet for a small 2D game projectile on a perfectly flat solid #00ff00 chroma-key background.",
    "Visual target: game-ready projectile frames that match the source video's own visual medium, detail density, line weight, color palette, and rendering style; not abstract, not a placeholder.",
    "Use the attached source-video keyframes as visual references for style, color, outline, and detail level. Do not beautify, polish, upscale, or add detail beyond the source evidence.",
    "The reference keyframes may contain characters or background elements; use them only for style and weapon/projectile evidence. Do not include characters or background in the projectile sheet.",
    safeRemix
      ? "Safe-remix mode: use the video analysis as archetype and evidence, but create an original projectile design."
      : "Faithful mode: use the video-derived weapon/projectile as the primary visual reference and keep it recognizable as much as the image model permits.",
    `Projectile type: ${projectilePrompt}`,
    `Owner character: ${promptName}. Match the same style and color logic as: ${visualPrompt}`,
    formConstraints ? `Owner source form constraints: ${formConstraints}` : "",
    `Weapon context: ${weaponPrompt}`,
    `Shared art direction: ${artDirection}`,
    "Four equal cells, one projectile per cell, facing right or moving right.",
    "Leave a clean #00ff00 safety gutter around every cell. No trail, sparks, shards, glow, or motion smear may cross into a neighboring cell.",
    "Frame order left-to-right: launch shape, flying rotation 1, flying rotation 2, looping flying shape.",
    "Centered composition in each cell, crisp edges, readable silhouette, consistent scale and colors.",
    "If the projectile is magic or energy, make it a clearly designed object/effect from the video-derived idea, not a simple colored ball.",
    "Do not include character, hand, ground, explosion, impact feedback, text, label, watermark, shadow, or floor.",
    "The background must be one uniform #00ff00 color with no gradient, texture, lighting variation, floor plane, reflection, or shadow.",
    "Avoid #00ff00 anywhere in the projectile."
  ].join("\n");
}

function formatFormConstraints(form) {
  if (!form || typeof form !== "object") return "";
  const parts = [
    form.entity_type ? `entity_type=${form.entity_type}` : "",
    form.body_plan ? `body_plan=${form.body_plan}` : "",
    form.proportions ? `proportions=${form.proportions}` : "",
    form.silhouette ? `silhouette=${form.silhouette}` : "",
    form.surface_material ? `surface_material=${form.surface_material}` : "",
    form.detail_density ? `detail_density=${form.detail_density}` : "",
    form.rendering_style ? `rendering_style=${form.rendering_style}` : "",
    form.motion_style ? `motion_style=${form.motion_style}` : "",
    normalizeStringArray(form.must_keep).length > 0 ? `must_keep=${normalizeStringArray(form.must_keep).join(", ")}` : "",
    normalizeStringArray(form.must_not_change).length > 0 ? `must_not_change=${normalizeStringArray(form.must_not_change).join(", ")}` : ""
  ].filter(Boolean);
  return parts.join("; ");
}

function imagePromptText(value, options = {}) {
  const text = stringOr(value, "");
  if (options.safeRemix) return safeImagePromptText(text);
  if (options.deidentifyIpNames) return deidentifyIpNamesText(text);
  return text;
}

function deidentifyIpNamesText(value) {
  let text = stringOr(value, "");
  const replacements = [
    [/Star\s*Wars|星球大战/gi, "galactic sci-fi fantasy"],
    [/Yoda|尤达大师|尤达/gi, "矮小绿色长耳外星智者"],
    [/Darth\s*Sidious|Sidious|Palpatine|西迪厄斯|帕尔帕廷|西斯大帝/gi, "深色兜帽黑暗术士"],
    [/Galactic\s*Senate|银河议会/gi, "环形金属议事大厅"]
  ];
  for (const [pattern, replacement] of replacements) {
    text = text.replace(pattern, replacement);
  }
  return text;
}

function safeImagePromptText(value) {
  let text = stringOr(value, "");
  const replacements = [
    [/Star\s*Wars|星球大战/gi, "original cosmic fantasy"],
    [/Yoda|尤达大师|尤达/gi, "small original cosmic monk"],
    [/Darth\s*Sidious|Sidious|Palpatine|西迪厄斯|帕尔帕廷|西斯大帝/gi, "masked hooded void mage"],
    [/Sith|西斯/gi, "shadow covenant"],
    [/Jedi|绝地/gi, "luminous order"],
    [/lightsaber|光剑/gi, "rune-charged short energy staff"],
    [/Force|原力/gi, "telekinetic aura"],
    [/Galactic\s*Senate|银河议会/gi, "vast circular metal council hall"],
    [/矮小的绿色外星智者/g, "矮小的原创星际武僧，灰白长袍，脸型和头部轮廓为全新设计"],
    [/绿色外星/g, "原创星际"],
    [/外星智者/g, "星际武僧"],
    [/绿色等离子剑/g, "青白色符文短杖"],
    [/等离子剑/g, "符文能量短杖"],
    [/宗师短符文能量短杖/g, "宗师符文短杖"],
    [/淡绿色/g, "青白色"],
    [/荧光绿/g, "青白光"],
    [/深色兜帽下的阴森老者/g, "戴面具的深色兜帽能量术士"],
    [/眼神中透着邪恶的红光/g, "面罩下透出冷色能量微光"],
    [/红色符文能量短杖/g, "紫红能量短杖"]
  ];
  for (const [pattern, replacement] of replacements) {
    text = text.replace(pattern, replacement);
  }
  return text;
}

async function drawOrPlaceholder(input) {
  const warnings = [];
  if (input.options.noDraw || process.env.VIDEO_PIPELINE_DISABLE_DRAW === "1") {
    await makePlaceholderSheet(input);
    return {
      warnings: [`${input.playerId || "asset"} used local placeholder sheet because draw is disabled.`],
      status: {
        name: "draw_image",
        mode: "placeholder_fallback",
        status: "skipped",
        reason: "draw disabled",
        output: normalizePath(path.relative(input.options.packDir || ROOT_DIR, input.outputPath))
      }
    };
  }

  const apiKey = firstEnv(["RIGHT_CODES_DRAW_API_KEY", "RIGHT_CODES_API_KEY", "OPENAI_API_KEY"]);
  if (!apiKey) {
    if (input.options.strictDraw) throw new Error("RIGHT_CODES_DRAW_API_KEY or RIGHT_CODES_API_KEY is required for strict draw mode.");
    warnings.push(`${input.playerId || "asset"} draw API key not found; local placeholder sheet was used.`);
    await makePlaceholderSheet(input);
    return {
      warnings,
      status: {
        name: "draw_image",
        mode: "placeholder_fallback",
        status: "warn",
        reason: "missing API key"
      }
    };
  }

  const baseUrl = input.options.drawBaseUrl || process.env.RIGHT_CODES_DRAW_BASE_URL || DRAW_FALLBACK_BASE_URL;
  const model = input.options.drawModel || process.env.RIGHT_CODES_DRAW_MODEL || DEFAULT_DRAW_MODEL;
  try {
    const scheduled = await runScheduledDraw(input.options, input.playerId || "asset", () => generateImageWithDrawWithRetries({
      baseUrl,
      apiKey,
      model,
      prompt: input.prompt,
      outputPath: input.outputPath,
      referenceImagePaths: input.referenceImagePaths,
      size: input.options.drawSize || DEFAULT_DRAW_API_SIZE,
      timeoutMs: input.options.drawTimeoutMs,
      retries: input.options.drawRetries,
      retryDelayMs: input.options.drawRetryDelayMs
    }, input.playerId, warnings));
    const result = scheduled.value;
    return {
      warnings,
      status: {
        name: "draw_image",
        mode: "right_codes_draw",
        status: "ok",
        visual_mode: input.visualMode || "faithful",
        base_url: baseUrl,
        model,
        response_kind: result.kind,
        attempts: result.attempts,
        reference_image_count: result.referenceImageCount || 0,
        draw_queue: scheduled.drawQueue,
        output: normalizePath(path.relative(path.dirname(input.outputPath), input.outputPath))
      }
    };
  } catch (error) {
    if (input.retryPrompt && isIpGuardrailError(error)) {
      try {
        const retryScheduled = await runScheduledDraw(input.options, `${input.playerId || "asset"}_ip_retry`, () => generateImageWithDrawWithRetries({
          baseUrl,
          apiKey,
          model,
          prompt: input.retryPrompt,
          outputPath: input.outputPath,
          referenceImagePaths: input.referenceImagePaths,
          size: input.options.drawSize || DEFAULT_DRAW_API_SIZE,
          timeoutMs: input.options.drawTimeoutMs,
          retries: input.options.drawRetries,
          retryDelayMs: input.options.drawRetryDelayMs
        }, input.playerId, warnings));
        const retryResult = retryScheduled.value;
        warnings.push(`${input.playerId || "asset"} draw retried without exact IP character names after similarity guardrail; visual features were preserved where possible.`);
        return {
          warnings,
          status: {
            name: "draw_image",
            mode: "right_codes_draw",
            status: "ok",
            visual_mode: input.retryVisualMode || "faithful_deidentified_names",
            base_url: baseUrl,
            model,
            response_kind: retryResult.kind,
            attempts: retryResult.attempts,
            reference_image_count: retryResult.referenceImageCount || 0,
            draw_queue: retryScheduled.drawQueue,
            output: normalizePath(path.relative(path.dirname(input.outputPath), input.outputPath)),
            retry: {
              triggered: true,
              reason: "ip_similarity_guardrail",
              initial_error: shortError(error)
            }
          }
        };
      } catch (retryError) {
        if (input.options.strictDraw) {
          throw new Error(`${shortError(error)}; retry without exact IP character names also failed: ${shortError(retryError)}`);
        }
        warnings.push(`${input.playerId || "asset"} draw retry without exact IP character names failed: ${shortError(retryError)}`);
      }
    }
    if (input.options.strictDraw) throw error;
    warnings.push(`${input.playerId || "asset"} draw failed; local placeholder sheet was used: ${shortError(error)}`);
    await makePlaceholderSheet(input);
    return {
      warnings,
      status: {
        name: "draw_image",
        mode: "placeholder_fallback",
        status: "warn",
        visual_mode: input.visualMode || "faithful",
        base_url: baseUrl,
        model,
        note: shortError(error)
      }
    };
  }
}

function isIpGuardrailError(error) {
  const text = shortError(error).toLowerCase();
  return /guardrail|similarity|third-party|third party|copyright|trademark|intellectual property|ip-like|violate/.test(text);
}

async function generateImageWithDrawWithRetries(input, label, warnings) {
  const retries = Math.max(0, Math.min(5, Math.floor(Number(input.retries) || 0)));
  const retryDelayMs = Math.max(0, Math.min(60000, Math.floor(Number(input.retryDelayMs) || DEFAULT_DRAW_RETRY_DELAY_MS)));
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await generateImageWithDraw(input);
      const attempts = attempt + 1;
      if (attempts > 1) {
        warnings.push(`${label || "asset"} draw succeeded after ${attempts} attempts; previous transient error: ${shortError(lastError)}`);
      }
      return { ...result, attempts };
    } catch (error) {
      lastError = error;
      if (attempt >= retries || !isTransientDrawError(error)) throw error;
      await sleep(retryDelayMs * (attempt + 1));
    }
  }
  throw lastError;
}

function isTransientDrawError(error) {
  if (isIpGuardrailError(error)) return false;
  const text = shortError(error).toLowerCase();
  return /http\s*(429|5\d\d)|cloudflare|524|520|522|523|terminated|timeout|timed out|econnreset|etimedout|fetch failed|network|socket|aborted|invalid image data|empty or too small|unsupported image header/.test(text);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateImageWithDraw(input) {
  try {
    const chatResult = await generateImageWithDrawChat(input);
    assertGeneratedImageBytes(chatResult.bytes);
    await writeFile(input.outputPath, chatResult.bytes);
    return { kind: chatResult.kind, referenceImageCount: chatResult.referenceImageCount };
  } catch (chatError) {
    const imageResult = await generateImageWithImagesApiFallback(input, `chat/completions failed: ${shortError(chatError)}`);
    assertGeneratedImageBytes(imageResult.bytes);
    await writeFile(input.outputPath, imageResult.bytes);
    return { kind: imageResult.kind, referenceImageCount: imageResult.referenceImageCount };
  }
}

function assertGeneratedImageBytes(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 32) {
    throw new Error(`Draw returned invalid image data: empty or too small (${bytes?.length || 0} bytes).`);
  }
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47;
  const isJpeg = bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF;
  const isWebp = bytes.slice(0, 4).toString("ascii") === "RIFF" && bytes.slice(8, 12).toString("ascii") === "WEBP";
  if (!isPng && !isJpeg && !isWebp) {
    throw new Error(`Draw returned invalid image data: unsupported image header ${bytes.slice(0, 12).toString("hex")}.`);
  }
}

async function generateImageWithDrawChat(input) {
  const referenceImages = await buildReferenceImageContent(input.referenceImagePaths);
  const body = {
    model: input.model,
    stream: true,
    messages: [
      {
        role: "user",
        content: referenceImages.length > 0
          ? [
              { type: "text", text: input.prompt },
              ...referenceImages.map((url) => ({
                type: "image_url",
                image_url: { url }
              }))
            ]
          : input.prompt
      }
    ]
  };
  const json = await postChatCompletion(input.baseUrl, input.apiKey, body, Number(input.timeoutMs || 180000));
  const content = json.choices?.[0]?.message?.content || "";
  const image = await extractImageFromPayload({ content });
  return { ...image, referenceImageCount: referenceImages.length };
}

async function generateImageWithImagesApiFallback(input, previousError) {
  const imagesUrl = buildImagesGenerationsUrl(input.baseUrl);
  const referenceImages = await buildReferenceImageContent(input.referenceImagePaths);
  const imageBody = {
    model: input.model,
    prompt: input.prompt,
    size: input.size,
    response_format: "url",
    n: 1
  };
  if (referenceImages.length > 0) imageBody.image = referenceImages;
  const response = await fetchWithTimeout(imagesUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${input.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(imageBody)
  }, Number(input.timeoutMs || 180000));
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${previousError}; images/generations failed with HTTP ${response.status}: ${text.slice(0, 300)}`);
  }
  const text = await response.text();
  const payload = JSON.parse(text);
  const image = await extractImageFromPayload(payload);
  return { ...image, referenceImageCount: referenceImages.length };
}

async function buildReferenceImageContent(referenceImagePaths) {
  const paths = Array.isArray(referenceImagePaths) ? referenceImagePaths.filter(Boolean).slice(0, 2) : [];
  const images = [];
  for (const filePath of paths) {
    if (!existsSync(filePath)) continue;
    const bytes = await readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = ext === ".png"
      ? "image/png"
      : ext === ".webp"
        ? "image/webp"
        : "image/jpeg";
    images.push(`data:${mimeType};base64,${bytes.toString("base64")}`);
  }
  return images;
}

function buildImagesGenerationsUrl(baseUrl) {
  const normalized = baseUrl.replace(/\/+$/, "");
  if (normalized.endsWith("/images/generations")) return normalized;
  if (normalized.endsWith("/v1")) return `${normalized}/images/generations`;
  return `${normalized}/v1/images/generations`;
}

async function extractImageFromPayload(payload) {
  const candidates = [];
  collectImageCandidates(payload, candidates);
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (candidate.type === "base64") return { bytes: Buffer.from(candidate.value, "base64"), kind: "base64" };
    if (candidate.type === "data_url") return { bytes: decodeDataUrl(candidate.value), kind: "data_url" };
    if (candidate.type === "url") return { bytes: await fetchImageBytes(candidate.value), kind: "url" };
  }
  throw new Error("No image URL or base64 image data found in draw response.");
}

function collectImageCandidates(value, candidates) {
  if (!value) return;
  if (typeof value === "string") {
    for (const match of value.matchAll(/!\[[^\]]*]\((https?:\/\/[^)]+)\)/g)) candidates.push({ type: "url", value: match[1] });
    for (const match of value.matchAll(/https?:\/\/[^\s"'<>),]+/g)) {
      if (/\.(png|jpe?g|webp)(?:\?|$)/i.test(match[0]) || /\/file\//i.test(match[0])) candidates.push({ type: "url", value: match[0] });
    }
    for (const match of value.matchAll(/data:image\/(?:png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+/g)) candidates.push({ type: "data_url", value: match[0] });
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectImageCandidates(item, candidates);
    return;
  }
  if (typeof value !== "object") return;

  if (typeof value.b64_json === "string") candidates.push({ type: "base64", value: value.b64_json });
  if (typeof value.base64 === "string") candidates.push({ type: "base64", value: value.base64 });
  if (typeof value.image_base64 === "string") candidates.push({ type: "base64", value: value.image_base64 });
  if (typeof value.url === "string") candidates.push(value.url.startsWith("data:image/") ? { type: "data_url", value: value.url } : { type: "url", value: value.url });
  if (typeof value.image_url === "string") candidates.push(value.image_url.startsWith("data:image/") ? { type: "data_url", value: value.image_url } : { type: "url", value: value.image_url });
  if (typeof value.content === "string") collectImageCandidates(value.content, candidates);
  for (const key of ["data", "images", "image", "output", "result", "choices", "message", "delta"]) {
    if (value[key]) collectImageCandidates(value[key], candidates);
  }
}

function decodeDataUrl(dataUrl) {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) throw new Error("Invalid data URL.");
  return Buffer.from(dataUrl.slice(comma + 1), "base64");
}

async function fetchImageBytes(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Image download failed with HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function makePlaceholderSheet(input) {
  await mkdir(path.dirname(input.outputPath), { recursive: true });
  const args = [
    SPRITE_POSTPROCESS_SCRIPT,
    "make-placeholder",
    "--kind", input.kind,
    "--output", input.outputPath,
    "--target-size", input.targetSize,
    "--layout", input.layout,
    "--role", input.role || "melee",
    "--color", (input.color || "#6b7280").replace("#", ""),
    "--accent", (input.accent || "#f59e0b").replace("#", ""),
    "--chroma-key", CHROMA_KEY
  ];
  await execFileAsync("python", args, { maxBuffer: 8 * 1024 * 1024 });
}

async function postprocessSpriteSheet(input) {
  await mkdir(path.dirname(input.sheetPath), { recursive: true });
  await mkdir(input.framesDir, { recursive: true });
  const args = [
    SPRITE_POSTPROCESS_SCRIPT,
    "process-sheet",
    "--input", input.inputPath,
    "--sheet-output", input.sheetPath,
    "--frames-dir", input.framesDir,
    "--layout", input.layout,
    "--frame-names", input.frameNames.join(","),
    "--target-size", input.targetSize,
    "--chroma-key", CHROMA_KEY
  ];
  if (input.staticOutput) args.push("--static-output", input.staticOutput);
  const { stdout } = await execFileAsync("python", args, { maxBuffer: 8 * 1024 * 1024 });
  const metadata = parseJsonLine(stdout) || {};
  const packDir = path.dirname(path.dirname(input.sheetPath));
  return {
    status: metadata.status || "ok",
    sheet_size: metadata.sheet_size,
    frame_size: {
      width: metadata.frame_size?.[0] || parseSize(input.targetSize)[0],
      height: metadata.frame_size?.[1] || parseSize(input.targetSize)[1]
    },
    layout: metadata.layout,
    alpha: metadata.alpha,
    quality: metadata.quality,
    frames: normalizePostprocessFrames(metadata.frames, packDir)
  };
}

function getPostprocessQualityIssues(postprocess) {
  const riskyFrames = postprocess?.quality?.risky_frames;
  if (!Array.isArray(riskyFrames) || riskyFrames.length === 0) return [];
  return riskyFrames.map((frame) => {
    const issues = Array.isArray(frame.issues) ? frame.issues.join(",") : "unknown";
    return `${frame.name || "frame"}:${issues}`;
  });
}

function shouldRetrySpriteForQuality(input) {
  const { postprocess, drawResult, options } = input;
  if (options.noDraw || process.env.VIDEO_PIPELINE_DISABLE_DRAW === "1") return false;
  if (drawResult?.status?.mode !== "right_codes_draw") return false;
  return getPostprocessQualityIssues(postprocess).length > 0;
}

function buildSpriteQualityRepairPrompt(prompt, issues, layout = "3x3") {
  const issueText = issues.length > 0 ? issues.join("; ") : "postprocess detected frame edge risk";
  const layoutText = layout === "4x1"
    ? "Use exactly 4 columns and exactly 1 row, exactly 4 projectile frames."
    : "Use exactly 3 columns and exactly 3 rows, exactly 9 poses.";
  const subjectText = layout === "4x1"
    ? "Make every projectile, trail, glow, and motion smear smaller inside its cell, with wide empty #00ff00 margin on all four sides."
    : "Make every character pose and weapon smaller inside its cell, with wide empty #00ff00 margin on all four sides.";
  const edgeText = layout === "4x1"
    ? "No projectile tip, trail, glow, shadow, or effect may touch any cell edge."
    : "No hair, cape, weapon tip, slash effect, foot, hand, or body part may touch any cell edge.";
  return [
    prompt,
    "",
    "QUALITY RETRY:",
    `The previous sprite sheet failed automated crop safety checks: ${issueText}.`,
    "Regenerate the full sprite sheet from scratch.",
    layoutText,
    subjectText,
    edgeText,
    "Do not add extra poses, extra columns, extra rows, labels, borders, shadows, or backgrounds."
  ].join("\n");
}

function normalizePostprocessFrames(frames, packDir) {
  if (!Array.isArray(frames)) return frames;
  return frames.map((frame) => ({
    ...frame,
    path: normalizePostprocessPath(frame.path, packDir)
  }));
}

function normalizePostprocessPath(value, packDir) {
  const text = stringOr(value, "");
  if (!text) return text;
  const normalized = text.replace(/\\/g, "/");
  if (/^[A-Za-z]:\//.test(normalized) || path.isAbsolute(normalized)) {
    return normalizePath(path.relative(packDir, normalized));
  }
  return normalizePath(normalized);
}

function shouldGenerateProjectile(character, role) {
  return role === "ranged"
    || character.role_type === "ranged"
    || character.role_type === "hybrid"
    || character.attack_type === "throw"
    || character.attack_type === "hybrid"
    || Boolean(character.projectile_prompt);
}

async function generateProjectileAsset(input) {
  const { packDir, brief, character, mapped, manifest, options, warnings, referenceImagePaths = [] } = input;
  const playerId = mapped.id;
  const prompt = buildProjectileSpritePrompt(brief, character, options);
  const retryPrompt = options.safeRemix
    ? ""
    : buildProjectileSpritePrompt(brief, character, { ...options, deidentifyIpNames: true });
  const rawPath = path.join(packDir, "assets", "raw", `${playerId}_projectile_sheet_raw.png`);
  const sheetPath = path.join(packDir, "assets", `${playerId}_projectile_sheet.png`);
  const staticPath = path.join(packDir, "assets", `${playerId}_projectile.png`);
  const framesDir = path.join(packDir, "frames", `${playerId}_projectile`);
  const drawResult = await drawOrPlaceholder({
    prompt,
    outputPath: rawPath,
    kind: "projectile",
    role: "ranged",
    playerId: `${playerId}_projectile`,
    referenceImagePaths,
    options,
    retryPrompt,
    visualMode: options.safeRemix ? "safe_remix" : "faithful",
    retryVisualMode: "faithful_deidentified_names",
    color: manifest.environment.theme_color,
    accent: manifest.players[playerId].accent_color || manifest.environment.accent_color,
    targetSize: PROJECTILE_SHEET_SIZE,
    layout: "4x1"
  });
  warnings.push(...drawResult.warnings);
  let postprocess = await postprocessSpriteSheet({
    inputPath: rawPath,
    sheetPath,
    framesDir,
    staticOutput: staticPath,
    layout: "4x1",
    frameNames: PROJECTILE_FRAME_NAMES,
    targetSize: PROJECTILE_SHEET_SIZE
  });
  let finalDrawResult = drawResult;
  const initialQualityIssues = getPostprocessQualityIssues(postprocess);
  if (shouldRetrySpriteForQuality({ postprocess, drawResult, options })) {
    const repairPrompt = buildSpriteQualityRepairPrompt(prompt, initialQualityIssues, "4x1");
    const repairRetryPrompt = retryPrompt ? buildSpriteQualityRepairPrompt(retryPrompt, initialQualityIssues, "4x1") : "";
    warnings.push(`${playerId} projectile sheet triggered quality retry after postprocess warnings: ${initialQualityIssues.join("; ")}`);
    finalDrawResult = await drawOrPlaceholder({
      prompt: repairPrompt,
      outputPath: rawPath,
      kind: "projectile",
      role: "ranged",
      playerId: `${playerId}_projectile`,
      referenceImagePaths,
      options,
      retryPrompt: repairRetryPrompt,
      visualMode: `${options.safeRemix ? "safe_remix" : "faithful"}_quality_retry`,
      retryVisualMode: "quality_retry_deidentified_names",
      color: manifest.environment.theme_color,
      accent: manifest.players[playerId].accent_color || manifest.environment.accent_color,
      targetSize: PROJECTILE_SHEET_SIZE,
      layout: "4x1"
    });
    warnings.push(...finalDrawResult.warnings);
    postprocess = await postprocessSpriteSheet({
      inputPath: rawPath,
      sheetPath,
      framesDir,
      staticOutput: staticPath,
      layout: "4x1",
      frameNames: PROJECTILE_FRAME_NAMES,
      targetSize: PROJECTILE_SHEET_SIZE
    });
    finalDrawResult.status.quality_retry = {
      triggered: true,
      initial_issues: initialQualityIssues,
      final_quality: postprocess.quality?.status || "unknown"
    };
    const finalQualityIssues = getPostprocessQualityIssues(postprocess);
    if (finalQualityIssues.length > 0) {
      warnings.push(`${playerId} projectile sheet still has postprocess quality warnings after retry: ${finalQualityIssues.join("; ")}`);
    }
  }
  const projectileManifest = buildProjectileManifest({
    themeId: manifest.theme_id,
    playerId,
    frameSize: postprocess.frame_size
  });
  await writeJson(path.join(packDir, `${playerId}_projectile_manifest.json`), projectileManifest);
  return {
    prompt,
    reference_images: referenceImagePaths.map((framePath) => normalizePath(path.relative(packDir, framePath))),
    draw: finalDrawResult.status,
    postprocess,
    static: `assets/${playerId}_projectile.png`,
    sheet: `assets/${playerId}_projectile_sheet.png`,
    manifest: `${playerId}_projectile_manifest.json`,
    frames_dir: `frames/${playerId}_projectile`
  };
}

async function generateStageAssets(input) {
  const { packDir, brief, manifest, options, sourceInput, warnings } = input;
  const records = [];
  if (!brief.scene_assets) {
    brief.scene_assets = normalizeSceneAssets(null, {}, { style_brief: brief.shared_style }, { baseName: brief.source_video || manifest.theme_id });
    warnings.push("scene_assets was missing from generation_brief; generated stage asset prompts used shared_style fallback planning.");
  }
  await mkdir(path.join(packDir, "assets", "stage"), { recursive: true });
  await mkdir(path.join(packDir, "assets", "raw"), { recursive: true });

  let platformTilesQueued = false;
  const tasks = [];
  for (const spec of STAGE_ASSET_SPECS) {
    if (STAGE_PLATFORM_TILE_KEYS.has(spec.key)) {
      if (!platformTilesQueued) {
        tasks.push(async () => generateStagePlatformTiles({
          packDir,
          brief,
          manifest,
          options,
          sourceInput,
          warnings
        }));
        platformTilesQueued = true;
      }
      continue;
    }

    tasks.push(async () => {
      const record = await generateSingleStageAsset({
        packDir,
        brief,
        manifest,
        options,
        sourceInput,
        warnings,
        spec
      });
      if (spec.key === "background") {
        await copyFileWithParents(path.join(packDir, record.path), path.join(packDir, "assets", "background.png"));
        manifest.environment.background = spec.path;
      }
      return [record];
    });
  }

  const recordGroups = await Promise.all(tasks.map((task) => task()));
  for (const group of recordGroups) {
    records.push(...group);
  }

  manifest.stage_assets = buildStageAssetManifest(records);
  return {
    enabled: true,
    mode: "generated_stage_assets",
    records,
    manifest_stage_assets: manifest.stage_assets
  };
}

async function generateSingleStageAsset(input) {
  const { packDir, brief, manifest, options, sourceInput, warnings, spec } = input;
  const plan = getSceneAssetPlan(brief.scene_assets, spec.key);
  const referenceImagePaths = resolveEvidenceFramePaths(sourceInput.dir, plan.evidence_frames).slice(0, 2);
  const prompt = buildStageAssetPrompt(brief, plan, spec, options);
  const retryPrompt = options.safeRemix
    ? ""
    : buildStageAssetPrompt(brief, plan, spec, { ...options, deidentifyIpNames: true });
  const rawPath = path.join(packDir, spec.raw);
  const outputPath = path.join(packDir, spec.path);
  const drawResult = await drawStageAssetOrFallback({
    prompt,
    retryPrompt,
    rawPath,
    spec,
    referenceImagePaths,
    options,
    color: manifest.environment.theme_color,
    accent: manifest.environment.accent_color
  });
  warnings.push(...drawResult.warnings);
  const postprocess = await resizeStageAsset({
    inputPath: rawPath,
    outputPath,
    spec
  });
  return {
    key: spec.key,
    file: spec.file,
    path: spec.path,
    raw: spec.raw,
    prompt,
    reference_images: referenceImagePaths.map((framePath) => normalizePath(path.relative(packDir, framePath))),
    draw: drawResult.status,
    postprocess
  };
}

async function generateStagePlatformTiles(input) {
  const { packDir, brief, manifest, options, sourceInput, warnings } = input;
  const spec = STAGE_PLATFORM_STRIP_SPEC;
  const stripRecord = await generateSingleStageAsset({
    packDir,
    brief,
    manifest,
    options,
    sourceInput,
    warnings,
    spec
  });
  return splitStagePlatformStrip({
    packDir,
    stripRecord,
    stripPath: path.join(packDir, spec.path)
  });
}

async function splitStagePlatformStrip(input) {
  const { packDir, stripRecord, stripPath } = input;
  const [stripWidth, stripHeight] = parseSize(STAGE_PLATFORM_STRIP_SIZE);
  let sourceX = 0;
  const records = [];
  for (const spec of STAGE_PLATFORM_TILE_SPECS) {
    const [width, height] = parseSize(spec.targetSize);
    const outputPath = path.join(packDir, spec.path);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await execFileAsync(getFfmpegPath(), [
      "-y",
      "-i", stripPath,
      "-vf", `crop=${width}:${height}:${sourceX}:0,format=rgba`,
      outputPath
    ], { maxBuffer: 16 * 1024 * 1024 });
    const image = await probeImage(outputPath);
    records.push({
      key: spec.key,
      file: spec.file,
      path: spec.path,
      raw: stripRecord.raw,
      source: {
        key: STAGE_PLATFORM_STRIP_SPEC.key,
        path: stripRecord.path,
        offset: [sourceX, 0],
        size: [width, height],
        full_size: [stripWidth, stripHeight]
      },
      prompt: stripRecord.prompt,
      reference_images: stripRecord.reference_images,
      draw: {
        ...stripRecord.draw,
        source_asset: STAGE_PLATFORM_STRIP_SPEC.key,
        derived_output: true
      },
      postprocess: {
        status: image.width === width && image.height === height ? "ok" : "warn",
        output_size: [image.width, image.height],
        expected_size: [width, height],
        transparent_expected: true,
        resize_mode: "split_from_platform_strip",
        source_size: [stripWidth, stripHeight],
        source_offset: [sourceX, 0]
      }
    });
    sourceX += width;
  }
  return records;
}

function buildStageAssetManifest(records) {
  const files = {};
  for (const record of records) files[record.key] = record.path;
  const dimensions = {};
  for (const record of records) {
    dimensions[record.key] = record.postprocess?.expected_size
      ? `${record.postprocess.expected_size[0]}x${record.postprocess.expected_size[1]}`
      : "";
  }
  return {
    version: "stage_assets.v0.1",
    mode: "generated",
    dimensions,
    files,
    tap_fight_export_root_files: STAGE_ASSET_SPECS.map((spec) => spec.file),
    fallback: "stage_template"
  };
}

function getSceneAssetPlan(sceneAssets, key) {
  const scene = sceneAssets && typeof sceneAssets === "object" ? sceneAssets : {};
  if (key === "background") return scene.background || {};
  if (key === "hazard_debris") return scene.hazards || {};
  return scene.platforms || {};
}

function buildStageAssetPrompt(brief, plan, spec, options = {}) {
  const scene = brief.scene_assets || {};
  const world = imagePromptText(scene.world || brief.shared_style?.world || "video-inspired battle arena", options);
  const artDirection = imagePromptText(brief.shared_style?.art_direction || "match the source video's visual medium and material style", options);
  const description = imagePromptText(plan.description || "", options);
  const styleNotes = imagePromptText(plan.style_notes || "", options);
  const material = imagePromptText(plan.material || "", options);
  const shape = imagePromptText(plan.shape_language || "", options);
  const keep = normalizeStringArray(plan.must_keep).map((item) => imagePromptText(item, options)).join("; ");
  const avoid = normalizeStringArray(plan.must_avoid).map((item) => imagePromptText(item, options)).join("; ");
  const [targetWidth, targetHeight] = parseSize(spec.targetSize);
  const dimensionRule = spec.key === "background"
    ? `Final asset will be normalized to ${spec.targetSize}. Compose as a vertical 9:16 playable background for a ${targetWidth}x${targetHeight} portrait canvas, full bleed, no transparent padding.`
    : `Final asset will be normalized to ${spec.targetSize} transparent PNG to match the existing Tap-Fight stage template asset size. Keep the platform/hazard centered, fill the useful sprite area, no opaque background.`;
  const assetRule = getStageAssetSpecificPrompt(spec);
  return [
    `Create Tap-Fight stage asset: ${spec.key}.`,
    `World: ${world}.`,
    `Source-video art direction: ${artDirection}.`,
    description ? `Asset description: ${description}.` : "",
    styleNotes ? `Style notes: ${styleNotes}.` : "",
    material ? `Material: ${material}.` : "",
    shape ? `Shape language: ${shape}.` : "",
    keep ? `Must keep from source evidence: ${keep}.` : "",
    avoid ? `Must avoid: ${avoid}.` : "",
    dimensionRule,
    assetRule,
    "No labels, no UI, no watermark, no large readable text, no full-body fighter portraits."
  ].filter(Boolean).join("\n");
}

function getStageAssetSpecificPrompt(spec) {
  if (spec.key === "background") {
    return "Draw a gameplay-readable arena background with open middle space for two fighters, subtle depth, and clear floor/platform contrast.";
  }
  if (spec.key === "platform_strip") {
    return "Draw one continuous horizontal platform strip on transparent background: a left end cap, a tileable center span, and a right end cap in one perfectly aligned row. The strip will be split into 58x54, 128x54, and 58x54 game files, so keep the top edge, bottom edge, lighting, material, and thickness continuous across the whole strip.";
  }
  if (spec.key === "platform_left") {
    return "Draw only the left end cap of a horizontal platform, transparent background, visually connects to the middle platform tile on its right edge.";
  }
  if (spec.key === "platform_mid") {
    return "Draw only a horizontally tileable middle platform segment, transparent background, left and right edges should repeat cleanly.";
  }
  if (spec.key === "platform_right") {
    return "Draw only the right end cap of a horizontal platform, transparent background, visually connects to the middle platform tile on its left edge.";
  }
  return "Draw one small hazardous debris object or obstacle, transparent background, readable at small game size.";
}

async function drawStageAssetOrFallback(input) {
  const warnings = [];
  const label = `stage_${input.spec.key}`;
  if (input.options.noDraw || process.env.VIDEO_PIPELINE_DISABLE_DRAW === "1") {
    await writeStagePlaceholderAsset(input.rawPath, input.spec, input.color, input.accent);
    return {
      warnings: [`${label} used local placeholder because draw is disabled.`],
      status: {
        name: "draw_stage_asset",
        mode: "placeholder_fallback",
        status: "skipped",
        reason: "draw disabled"
      }
    };
  }

  const apiKey = firstEnv(["RIGHT_CODES_DRAW_API_KEY", "RIGHT_CODES_API_KEY", "OPENAI_API_KEY"]);
  if (!apiKey) {
    if (input.options.strictDraw) throw new Error("RIGHT_CODES_DRAW_API_KEY or RIGHT_CODES_API_KEY is required for strict stage asset draw mode.");
    await writeStagePlaceholderAsset(input.rawPath, input.spec, input.color, input.accent);
    return {
      warnings: [`${label} draw API key not found; local placeholder was used.`],
      status: {
        name: "draw_stage_asset",
        mode: "placeholder_fallback",
        status: "warn",
        reason: "missing API key"
      }
    };
  }

  const baseUrl = input.options.drawBaseUrl || process.env.RIGHT_CODES_DRAW_BASE_URL || DRAW_FALLBACK_BASE_URL;
  const model = input.options.drawModel || process.env.RIGHT_CODES_DRAW_MODEL || DEFAULT_DRAW_MODEL;
  try {
    const scheduled = await runScheduledDraw(input.options, label, () => generateImageWithDrawWithRetries({
      baseUrl,
      apiKey,
      model,
      prompt: input.prompt,
      outputPath: input.rawPath,
      referenceImagePaths: input.referenceImagePaths,
      size: input.options.drawSize || DEFAULT_DRAW_API_SIZE,
      timeoutMs: input.options.drawTimeoutMs,
      retries: input.options.drawRetries,
      retryDelayMs: input.options.drawRetryDelayMs
    }, label, warnings));
    const result = scheduled.value;
    return {
      warnings,
      status: {
        name: "draw_stage_asset",
        mode: "right_codes_draw",
        status: "ok",
        visual_mode: input.options.safeRemix ? "safe_remix" : "faithful",
        base_url: baseUrl,
        model,
        response_kind: result.kind,
        attempts: result.attempts,
        draw_queue: scheduled.drawQueue,
        reference_image_count: result.referenceImageCount || 0
      }
    };
  } catch (error) {
    if (input.retryPrompt && isIpGuardrailError(error)) {
      try {
        const retryScheduled = await runScheduledDraw(input.options, `${label}_ip_retry`, () => generateImageWithDrawWithRetries({
          baseUrl,
          apiKey,
          model,
          prompt: input.retryPrompt,
          outputPath: input.rawPath,
          referenceImagePaths: input.referenceImagePaths,
          size: input.options.drawSize || DEFAULT_DRAW_API_SIZE,
          timeoutMs: input.options.drawTimeoutMs,
          retries: input.options.drawRetries,
          retryDelayMs: input.options.drawRetryDelayMs
        }, label, warnings));
        const retryResult = retryScheduled.value;
        warnings.push(`${label} draw retried without exact IP names after similarity guardrail; scene visual features were preserved where possible.`);
        return {
          warnings,
          status: {
            name: "draw_stage_asset",
            mode: "right_codes_draw",
            status: "ok",
            visual_mode: "faithful_deidentified_names",
            base_url: baseUrl,
            model,
            response_kind: retryResult.kind,
            attempts: retryResult.attempts,
            reference_image_count: retryResult.referenceImageCount || 0,
            draw_queue: retryScheduled.drawQueue,
            retry: { triggered: true, reason: "ip_guardrail" }
          }
        };
      } catch (retryError) {
        if (input.options.strictDraw) throw retryError;
        warnings.push(`${label} draw retry failed; local placeholder was used: ${shortError(retryError)}`);
      }
    } else {
      if (input.options.strictDraw) throw error;
      warnings.push(`${label} draw failed; local placeholder was used: ${shortError(error)}`);
    }
    await writeStagePlaceholderAsset(input.rawPath, input.spec, input.color, input.accent);
    return {
      warnings,
      status: {
        name: "draw_stage_asset",
        mode: "placeholder_fallback",
        status: "warn",
        reason: shortError(error)
      }
    };
  }
}

async function resizeStageAsset(input) {
  const [width, height] = parseSize(input.spec.targetSize);
  await mkdir(path.dirname(input.outputPath), { recursive: true });
  const resizeMode = input.spec.resizeMode || (input.spec.transparent ? "fit_pad_transparent" : "cover_crop_portrait");
  const vf = resizeMode === "stretch_transparent"
    ? `scale=${width}:${height},format=rgba`
    : input.spec.transparent
    ? `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black@0.0,format=rgba`
    : `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},format=rgba`;
  await execFileAsync(getFfmpegPath(), [
    "-y",
    "-i", input.inputPath,
    "-vf", vf,
    input.outputPath
  ], { maxBuffer: 16 * 1024 * 1024 });
  const matteRemove = input.spec.transparent
    ? await removeStageBorderMatte(input.outputPath)
    : null;
  const image = await probeImage(input.outputPath);
  return {
    status: image.width === width && image.height === height ? "ok" : "warn",
    output_size: [image.width, image.height],
    expected_size: [width, height],
    transparent_expected: input.spec.transparent,
    resize_mode: resizeMode,
    matte_remove: matteRemove
  };
}

async function removeStageBorderMatte(outputPath) {
  const { stdout } = await execFileAsync("python", [
    STAGE_POSTPROCESS_SCRIPT,
    "--input", outputPath,
    "--output", outputPath
  ], { maxBuffer: 8 * 1024 * 1024 });
  return parseJsonLine(stdout) || { status: "unknown" };
}

async function writeStagePlaceholderAsset(outputPath, spec, fillHex, accentHex) {
  const [width, height] = parseSize(spec.targetSize);
  const png = createPlaceholderPng(spec.key, fillHex, accentHex, width, height);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, png);
}

async function probeImage(filePath) {
  try {
    const { stdout } = await execFileAsync(getFfprobePath(), [
      "-v", "error",
      "-select_streams", "v:0",
      "-show_entries", "stream=width,height,pix_fmt",
      "-of", "json",
      filePath
    ], { maxBuffer: 1024 * 1024 });
    const data = JSON.parse(stdout);
    const stream = data.streams?.[0] || {};
    return {
      width: Number(stream.width) || 0,
      height: Number(stream.height) || 0,
      pixel_format: stream.pix_fmt || ""
    };
  } catch {
    return { width: 0, height: 0, pixel_format: "" };
  }
}

function buildCharacterAnimationManifest(input) {
  const { themeId, playerId, character, role, frameSize, projectile } = input;
  return {
    character_id: `${playerId}_${themeId}`,
    display_name: character.name,
    role,
    source_sheet: `assets/${playerId}_sprite_sheet.png`,
    frame_size: frameSize,
    render_origin: {
      mode: "bottom_center",
      normalized: {
        x: 0.5,
        y: 0.98
      },
      note: "Use this pivot as the character feet anchor. Frames are fixed-size and pre-centered by the asset pipeline."
    },
    layout: {
      columns: 3,
      rows: 3,
      order: ANIMATION_FRAME_NAMES
    },
    animations: {
      idle: {
        frames: [`frames/${playerId}/idle_0.png`, `frames/${playerId}/idle_1.png`],
        fps: 3,
        loop: true
      },
      run: {
        frames: [`frames/${playerId}/run_0.png`, `frames/${playerId}/run_1.png`, `frames/${playerId}/run_2.png`, `frames/${playerId}/run_3.png`],
        fps: 10,
        loop: true
      },
      jump: {
        frames: [`frames/${playerId}/jump_0.png`],
        fps: 1,
        loop: false
      },
      fall: {
        frames: [`frames/${playerId}/fall_0.png`],
        fps: 1,
        loop: false
      },
      attack: {
        frames: [`frames/${playerId}/attack_0.png`],
        fps: 1,
        loop: false
      }
    },
    projectile: projectile ? {
      static: projectile.static,
      manifest: projectile.manifest
    } : null,
    generation_notes: {
      original_role_type: character.role_type,
      original_attack_type: character.attack_type,
      weapon_source: character.weapon_source,
      creativity_level: character.creativity_level
    }
  };
}

function buildProjectileManifest(input) {
  const { themeId, playerId, frameSize } = input;
  return {
    projectile_id: `${playerId}_projectile_${themeId}`,
    owner_character_id: `${playerId}_${themeId}`,
    source_sheet: `assets/${playerId}_projectile_sheet.png`,
    static: `assets/${playerId}_projectile.png`,
    frame_size: frameSize,
    render_origin: {
      mode: "center",
      normalized: {
        x: 0.5,
        y: 0.5
      },
      note: "Use this pivot for projectile sprite rotation/movement; game code controls trajectory."
    },
    layout: {
      columns: 4,
      rows: 1,
      order: PROJECTILE_FRAME_NAMES
    },
    animations: {
      fly: {
        frames: PROJECTILE_FRAME_NAMES.map((name) => `frames/${playerId}_projectile/${name}.png`),
        fps: 12,
        loop: true
      }
    },
    direction: "right",
    notes: "游戏侧负责移动轨迹、碰撞和命中反馈；本动画只表现飞行物本身。"
  };
}

async function writeCompatibilityPlayerAssets(input) {
  const { packDir, playerId, role, projectile } = input;
  const idle = path.join(packDir, "frames", playerId, "idle_0.png");
  const attack = path.join(packDir, "frames", playerId, "attack_0.png");
  await copyPngWithFfmpeg(idle, path.join(packDir, "assets", `${playerId}_body.png`), "512:512");
  await copyPngWithFfmpeg(idle, path.join(packDir, "assets", `${playerId}_head.png`), "256:256");
  if (role === "melee") {
    await copyPngWithFfmpeg(attack, path.join(packDir, "assets", `${playerId}_melee_prop.png`), "256:256");
  } else if (projectile?.static) {
    // The projectile static asset is already written by postprocessSpriteSheet.
  }
}

async function copyPngWithFfmpeg(inputPath, outputPath, size) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await execFileAsync(getFfmpegPath(), [
    "-y",
    "-i", inputPath,
    "-vf", `scale=${size}:force_original_aspect_ratio=decrease,pad=${size}:(ow-iw)/2:(oh-ih)/2:color=black@0.0,format=rgba`,
    outputPath
  ], { maxBuffer: 8 * 1024 * 1024 });
}

function buildAnimationAnalysisReport(input) {
  const { themeId, brief, understanding, input: sourceInput, roleMapping, pipelineSteps, generationRecords, stageGeneration, warnings } = input;
  return {
    theme_id: themeId,
    input: {
      type: "video_ai_animation",
      source_video: brief.source_video,
      source_understanding: normalizePath(path.relative(DELIVERY_DIR, sourceInput.understandingPath || "")),
      source_generation_brief: normalizePath(path.relative(DELIVERY_DIR, sourceInput.briefPath || ""))
    },
    source_video_understanding_summary: understanding ? summarizeUnderstanding(understanding) : undefined,
    generation_brief: brief,
    contract_role_mapping: {
      p1: {
        original_role_type: roleMapping.byId.p1.character.role_type,
        original_attack_type: roleMapping.byId.p1.character.attack_type,
        mapped_role: roleMapping.byId.p1.role
      },
      p2: {
        original_role_type: roleMapping.byId.p2.character.role_type,
        original_attack_type: roleMapping.byId.p2.character.attack_type,
        mapped_role: roleMapping.byId.p2.role
      },
      warnings: roleMapping.warnings
    },
    pipeline_steps: [
      ...pipelineSteps,
      ...generationRecords.map((record) => ({
        name: "generate_sprite_asset",
        player_id: record.player_id,
        mode: record.draw.mode,
        status: record.draw.status,
        model: record.draw.model,
        response_kind: record.draw.response_kind
      })),
      { name: "postprocess_sheets", mode: "python_pillow", status: "ok" }
    ],
    image_generation: {
      endpoint: process.env.RIGHT_CODES_DRAW_BASE_URL || DRAW_FALLBACK_BASE_URL,
      model: process.env.RIGHT_CODES_DRAW_MODEL || DEFAULT_DRAW_MODEL,
      visual_mode: summarizeVisualMode(generationRecords),
      records: generationRecords,
      stage_generation: stageGeneration
    },
    warnings
  };
}

function summarizeVisualMode(records) {
  const modes = new Set((records || []).map((record) => record.visual_mode).filter(Boolean));
  if (modes.size === 0) return "faithful";
  if (modes.size === 1) return Array.from(modes)[0];
  if (modes.has("safe_remix")) return "mixed_with_safe_remix";
  if (modes.has("faithful_deidentified_names")) return "faithful_with_deidentified_name_retry";
  return "mixed";
}

function buildAnimationPackageStatus(packDir, manifest, upstreamWarnings = []) {
  const status = buildPackageStatus(packDir, manifest, upstreamWarnings);
  const extraPaths = collectAnimationPackagePaths(manifest);
  const existing = new Set(status.files.assets.map((asset) => asset.path));
  for (const assetPath of extraPaths) {
    if (existing.has(assetPath)) continue;
    status.files.assets.push({
      path: assetPath,
      required: true,
      exists: existsSync(path.join(packDir, assetPath)),
      fallback: assetPath.includes("projectile") ? "default_ball" : "whitebox_body"
    });
  }
  const missing = status.files.assets.filter((asset) => asset.required && !asset.exists);
  for (const item of missing) status.validation.errors.push(`${item.path} is missing.`);
  if (missing.length > 0) {
    status.validation.status = "fail";
    status.validation.can_load_in_game = false;
  } else if (status.validation.warnings.length > 0) {
    status.validation.status = "warn";
  } else {
    status.validation.status = "pass";
  }
  return status;
}

function collectAnimationPackagePaths(manifest) {
  const paths = [
    "assets/p1_sprite_sheet.png",
    "assets/p2_sprite_sheet.png",
    "p1_animation_manifest.json",
    "p2_animation_manifest.json",
    ...ANIMATION_FRAME_NAMES.map((name) => `frames/p1/${name}.png`),
    ...ANIMATION_FRAME_NAMES.map((name) => `frames/p2/${name}.png`)
  ];
  for (const playerId of ["p1", "p2"]) {
    const player = manifest.players?.[playerId];
    if (player?.projectile || player?.projectile_animation || shouldCorePlayerHaveProjectile(player)) {
      paths.push(
        `assets/${playerId}_projectile.png`,
        `assets/${playerId}_projectile_sheet.png`,
        `${playerId}_projectile_manifest.json`,
        ...PROJECTILE_FRAME_NAMES.map((name) => `frames/${playerId}_projectile/${name}.png`)
      );
    }
  }
  return paths;
}

function shouldCorePlayerHaveProjectile(player) {
  return player?.role === "ranged";
}

async function validateThemePackDir(dir, id) {
  const issues = [];
  const manifestPath = path.join(dir, "manifest.json");
  const statusPath = path.join(dir, "package_status.json");
  const analysisPath = path.join(dir, "analysis_report.json");
  if (!existsSync(manifestPath)) issues.push("manifest.json missing");
  if (!existsSync(statusPath)) issues.push("package_status.json missing");
  if (!existsSync(analysisPath)) issues.push("analysis_report.json missing");
  try {
    if (existsSync(manifestPath) && existsSync(statusPath)) {
      const manifest = await readJson(manifestPath);
      const status = await readJson(statusPath);
      issues.push(...validatePackage(dir, manifest, status).issues);
      issues.push(...validateAnimationFiles(dir, manifest));
    }
  } catch (error) {
    issues.push(`JSON parse failed: ${shortError(error)}`);
  }
  return { id, ok: issues.length === 0, issues };
}

function validateAnimationFiles(dir, manifest) {
  const issues = [];
  for (const assetPath of collectAnimationPackagePaths(manifest)) {
    if (path.isAbsolute(assetPath)) issues.push(`animation path must be relative: ${assetPath}`);
    if (assetPath.includes("\\")) issues.push(`animation path must use slash separators: ${assetPath}`);
    if (!existsSync(path.join(dir, assetPath))) issues.push(`animation file missing: ${assetPath}`);
  }
  return issues;
}

function parseSize(value) {
  const match = String(value || "").match(/^(\d+)x(\d+)$/i);
  if (!match) return [0, 0];
  return [Number(match[1]), Number(match[2])];
}

async function generateAllMock() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const configFiles = (await readdir(CONFIG_DIR))
    .filter((file) => file.endsWith(".json"))
    .sort();

  const results = [];
  for (const configFile of configFiles) {
    const config = await readJson(path.join(CONFIG_DIR, configFile));
    const packDir = path.join(OUTPUT_DIR, config.theme_id);
    await rm(packDir, { recursive: true, force: true });
    await mkdir(path.join(packDir, "assets"), { recursive: true });

    const decision = normalizeDecision(decideMockCombatMapping(config), { baseName: config.display_name });
    const manifest = buildManifest(config, decision);
    const analysisReport = buildAnalysisReport(config, decision, { mode: "mock" });

    await writeJson(path.join(packDir, "manifest.json"), manifest);
    await writeJson(path.join(packDir, "analysis_report.json"), analysisReport);
    await writeAssets(packDir, manifest);

    const status = buildPackageStatus(packDir, manifest, []);
    await writeJson(path.join(packDir, "package_status.json"), status);

    const validation = validatePackage(packDir, manifest, status);
    if (!validation.ok) {
      throw new Error(`${config.theme_id} failed validation:\n${validation.issues.join("\n")}`);
    }
    results.push({ theme_id: config.theme_id });
  }
  return results;
}

async function validateAll() {
  const results = [];
  if (existsSync(UNDERSTANDING_OUTPUT_DIR)) {
    const entries = await readdir(UNDERSTANDING_OUTPUT_DIR, { withFileTypes: true });
    for (const entry of entries.filter((item) => item.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
      const dir = path.join(UNDERSTANDING_OUTPUT_DIR, entry.name);
      results.push(await validateUnderstandingDir(dir, entry.name));
    }
  }
  if (existsSync(COMPARE_OUTPUT_DIR)) {
    const entries = await readdir(COMPARE_OUTPUT_DIR, { withFileTypes: true });
    for (const entry of entries.filter((item) => item.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
      const dir = path.join(COMPARE_OUTPUT_DIR, entry.name);
      results.push(await validateComparisonDir(dir, entry.name));
    }
  }
  if (existsSync(OUTPUT_DIR)) {
    const entries = await readdir(OUTPUT_DIR, { withFileTypes: true });
    for (const entry of entries.filter((item) => item.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
      const dir = path.join(OUTPUT_DIR, entry.name);
      results.push(await validateThemePackDir(dir, entry.name));
    }
  }
  return results;
}

async function validateUnderstandingDir(dir, id) {
  const issues = [];
  const understandingPath = path.join(dir, "video_understanding.json");
  const briefPath = path.join(dir, "generation_brief.json");
  if (!existsSync(understandingPath)) issues.push("video_understanding.json missing");
  if (!existsSync(briefPath)) issues.push("generation_brief.json missing");
  let understanding = null;
  let brief = null;
  try {
    if (existsSync(understandingPath)) understanding = await readJson(understandingPath);
    if (existsSync(briefPath)) brief = await readJson(briefPath);
  } catch (error) {
    issues.push(`JSON parse failed: ${shortError(error)}`);
  }
  if (understanding) issues.push(...validateUnderstandingDocument(understanding));
  if (brief) issues.push(...validateGenerationBriefDocument(brief));
  return { id, ok: issues.length === 0, issues };
}

async function validateComparisonDir(dir, id) {
  const issues = [];
  const comparisonPath = path.join(dir, "llm_comparison.json");
  const geminiPath = path.join(dir, "gemini.video_understanding.json");
  const codexPath = path.join(dir, "codex_pro.video_understanding.json");
  if (!existsSync(comparisonPath)) issues.push("llm_comparison.json missing");
  if (!existsSync(geminiPath)) issues.push("gemini.video_understanding.json missing");
  if (!existsSync(codexPath)) issues.push("codex_pro.video_understanding.json missing");
  try {
    if (existsSync(comparisonPath)) {
      const comparison = await readJson(comparisonPath);
      if (path.isAbsolute(comparison.source_video || "")) issues.push("comparison source_video must be relative");
      if (!Array.isArray(comparison.providers) || comparison.providers.length < 2) issues.push("comparison must include at least two providers");
    }
    if (existsSync(geminiPath)) issues.push(...validateUnderstandingDocument(await readJson(geminiPath)));
    if (existsSync(codexPath)) issues.push(...validateUnderstandingDocument(await readJson(codexPath)));
  } catch (error) {
    issues.push(`JSON parse failed: ${shortError(error)}`);
  }
  return { id, ok: issues.length === 0, issues };
}

async function listVideos(inputDir) {
  if (!existsSync(inputDir)) return [];
  const entries = await readdir(inputDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && VIDEO_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => path.join(inputDir, entry.name))
    .sort();
}

async function extractVideoMetadata(videoPath, pipelineSteps, warnings) {
  const ffprobePath = getFfprobePath();
  try {
    const { stdout } = await execFileAsync(ffprobePath, [
      "-v", "error",
      "-print_format", "json",
      "-show_format",
      "-show_streams",
      videoPath
    ], { maxBuffer: 8 * 1024 * 1024 });
    const raw = JSON.parse(stdout);
    const videoStream = raw.streams?.find((stream) => stream.codec_type === "video") || {};
    const audioStream = raw.streams?.find((stream) => stream.codec_type === "audio") || {};
    const metadata = {
      duration_s: Number(raw.format?.duration || videoStream.duration || 0),
      format_name: raw.format?.format_name || null,
      size_bytes: raw.format?.size ? Number(raw.format.size) : null,
      bitrate: raw.format?.bit_rate ? Number(raw.format.bit_rate) : null,
      video: {
        codec: videoStream.codec_name || null,
        width: videoStream.width || null,
        height: videoStream.height || null,
        fps: parseFps(videoStream.avg_frame_rate || videoStream.r_frame_rate)
      },
      audio: {
        codec: audioStream.codec_name || null,
        sample_rate: audioStream.sample_rate ? Number(audioStream.sample_rate) : null,
        channels: audioStream.channels || null
      }
    };
    pipelineSteps.push({ name: "extract_video_metadata", mode: "ffprobe", status: "ok" });
    return metadata;
  } catch (error) {
    warnings.push(`ffprobe metadata extraction failed: ${shortError(error)}`);
    pipelineSteps.push({ name: "extract_video_metadata", mode: "ffprobe", status: "warn", note: shortError(error) });
    return { duration_s: 0, video: {}, audio: {} };
  }
}

async function extractKeyframes(videoPath, packDir, metadata, options, pipelineSteps, warnings) {
  const ffmpegPath = getFfmpegPath();
  const frameCount = Number(options.frames || DEFAULT_FRAME_COUNT);
  const duration = Number(metadata.duration_s || 0);
  const timestamps = duration > 0
    ? Array.from({ length: frameCount }, (_, index) => Math.max(0, duration * ((index + 1) / (frameCount + 1))))
    : Array.from({ length: frameCount }, (_, index) => index * 2);

  const framePaths = [];
  for (let index = 0; index < timestamps.length; index++) {
    const outPath = path.join(packDir, "analysis_frames", `frame_${String(index + 1).padStart(2, "0")}.jpg`);
    try {
      await execFileAsync(ffmpegPath, [
        "-y",
        "-ss", timestamps[index].toFixed(3),
        "-i", videoPath,
        "-frames:v", "1",
        "-vf", "scale=640:-1",
        "-q:v", "3",
        outPath
      ], { maxBuffer: 8 * 1024 * 1024 });
      if (existsSync(outPath)) framePaths.push(outPath);
    } catch (error) {
      warnings.push(`keyframe ${index + 1} extraction failed: ${shortError(error)}`);
    }
  }

  const status = framePaths.length > 0 ? "ok" : "warn";
  pipelineSteps.push({
    name: "extract_keyframes",
    mode: "ffmpeg",
    status,
    count: framePaths.length
  });
  return framePaths;
}

async function maybeUseFrameAsBackground(firstFramePath, packDir, warnings) {
  if (!firstFramePath || !existsSync(firstFramePath)) return;
  try {
    await execFileAsync(getFfmpegPath(), [
      "-y",
      "-i", firstFramePath,
      "-vf", "scale=320:180:force_original_aspect_ratio=decrease,pad=320:180:(ow-iw)/2:(oh-ih)/2",
      path.join(packDir, "assets", "background.png")
    ], { maxBuffer: 8 * 1024 * 1024 });
  } catch (error) {
    warnings.push(`background frame conversion failed; placeholder background kept: ${shortError(error)}`);
  }
}

async function readTranscriptSidecars(videoPath) {
  const dir = path.dirname(videoPath);
  const base = path.basename(videoPath, path.extname(videoPath));
  const candidates = [".txt", ".srt", ".vtt"].map((ext) => path.join(dir, `${base}${ext}`));
  const texts = [];
  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    const content = await readFile(candidate, "utf8");
    texts.push({
      file: normalizePath(path.relative(WINDOW_DIR, candidate)),
      text: content.slice(0, 12000)
    });
  }
  return texts;
}

async function decideWithModel(input) {
  const apiKey = process.env.CODEX_PRO_API_KEY || process.env.RIGHT_CODES_API_KEY || process.env.OPENAI_API_KEY;
  const baseUrl = process.env.CODEX_PRO_BASE_URL || process.env.OPENAI_BASE_URL || DEFAULT_BASE_URL;
  const model = input.model || process.env.CODEX_PRO_MODEL || process.env.OPENAI_MODEL || DEFAULT_MODEL;

  if (!apiKey) {
    if (input.strict) throw new Error("CODEX_PRO_API_KEY, RIGHT_CODES_API_KEY, or OPENAI_API_KEY is required for strict LLM mode.");
    return {
      decision: heuristicVideoDecision(input),
      warnings: ["LLM/VLM API key not found; heuristic fallback decision was used."],
      status: { name: "llm_vlm_decision", mode: "heuristic", status: "warn", note: "missing API key" }
    };
  }

  const prompt = buildVideoDecisionPrompt(input);
  try {
    const content = await postVisionDecision(baseUrl, apiKey, model, prompt, input.framePaths);
    return {
      decision: parseJsonFromModel(content),
      warnings: [],
      status: { name: "llm_vlm_decision", mode: "llm_vlm", status: "ok", model }
    };
  } catch (error) {
    if (input.strict) throw error;
    const textOnlyPrompt = `${prompt}\n\n注意：上一轮多模态请求失败，现在只根据文件名、元数据和字幕 sidecar 做保守决策。`;
    try {
      const content = await postVisionDecision(baseUrl, apiKey, model, textOnlyPrompt, []);
      return {
        decision: parseJsonFromModel(content),
        warnings: [`Vision request failed and text-only retry was used: ${shortError(error)}`],
        status: { name: "llm_vlm_decision", mode: "llm_text_retry", status: "warn", model, note: shortError(error) }
      };
    } catch (retryError) {
      return {
        decision: heuristicVideoDecision(input),
        warnings: [`LLM/VLM request failed; heuristic fallback decision was used: ${shortError(retryError)}`],
        status: { name: "llm_vlm_decision", mode: "heuristic", status: "warn", model, note: shortError(retryError) }
      };
    }
  }
}

async function understandWithModel(input) {
  return understandWithProvider({
    ...input,
    providerName: "codex_pro",
    apiKeyEnvNames: ["CODEX_PRO_API_KEY", "RIGHT_CODES_API_KEY", "OPENAI_API_KEY"],
    baseUrl: input.baseUrl || process.env.CODEX_PRO_BASE_URL || process.env.OPENAI_BASE_URL || DEFAULT_BASE_URL,
    model: input.model || process.env.CODEX_PRO_MODEL || process.env.OPENAI_MODEL || DEFAULT_MODEL,
    promptMode: "vision"
  });
}

async function understandWithProvider(input) {
  const providerName = input.providerName || "llm";
  const apiKey = input.apiKey || firstEnv(input.apiKeyEnvNames || ["RIGHT_CODES_API_KEY", "OPENAI_API_KEY"]);
  const baseUrl = input.baseUrl || DEFAULT_BASE_URL;
  const model = input.model || DEFAULT_MODEL;
  if (!apiKey) {
    if (input.strict) throw new Error("CODEX_PRO_API_KEY, RIGHT_CODES_API_KEY, or OPENAI_API_KEY is required for strict LLM mode.");
    return {
      decision: heuristicVideoUnderstanding(input),
      warnings: ["LLM/VLM API key not found; heuristic video understanding was used."],
      status: { name: "video_understanding_decision", provider: providerName, mode: "heuristic", status: "warn", note: "missing API key" }
    };
  }

  const prompt = appendStageAssetUnderstandingPrompt(buildVideoUnderstandingPrompt(input), input);
  try {
    const content = await postVisionDecision(baseUrl, apiKey, model, prompt, input.promptMode === "text_only" ? [] : input.framePaths);
    return {
      decision: parseJsonFromModel(content),
      warnings: [],
      status: { name: "video_understanding_decision", provider: providerName, mode: "llm_vlm", status: "ok", base_url: baseUrl, model }
    };
  } catch (error) {
    if (input.strict) throw error;
    const textOnlyPrompt = `${prompt}\n\n注意：上一轮多模态请求失败，现在只根据文件名、元数据和字幕 sidecar 做保守视频理解。`;
    try {
      const content = await postVisionDecision(baseUrl, apiKey, model, textOnlyPrompt, []);
      return {
        decision: parseJsonFromModel(content),
        warnings: [`Vision request failed and text-only retry was used: ${shortError(error)}`],
        status: { name: "video_understanding_decision", provider: providerName, mode: "llm_text_retry", status: "warn", base_url: baseUrl, model, note: shortError(error) }
      };
    } catch (retryError) {
      return {
        decision: heuristicVideoUnderstanding(input),
        warnings: [`LLM/VLM request failed; heuristic video understanding was used: ${shortError(retryError)}`],
        status: { name: "video_understanding_decision", provider: providerName, mode: "heuristic", status: "warn", base_url: baseUrl, model, note: shortError(retryError) }
      };
    }
  }
}

function buildVideoUnderstandingPrompt(input) {
  const sidecarText = input.sidecarText?.map((item) => `文件 ${item.file}:\n${item.text}`).join("\n\n") || "无";
  const metadata = JSON.stringify(input.metadata || {}, null, 2);
  const frameNames = input.framePaths?.map((_, index) => `analysis_frames/frame_${String(index + 1).padStart(2, "0")}.jpg`) || [];
  return `请理解这个视频，为后续图片生成阶段产出结构化说明。现在不要生成图片，不要输出九帧，不要做游戏玩法实现。

目标：
1. 找到最适合作为 1v1 对抗的两个角色。
2. 理解这两个角色的视觉特征、关系、冲突气质和可用于生成的风格证据。
3. 为每个角色设计攻击使用的武器/道具；武器不要求画面真实出现，可以基于场景推理，也可以适度无厘头。
4. 如果角色适合远程或混合攻击，请给出投掷物/飞行物设计。
5. 为每个角色分别识别一条长按攻击触发的技能语句：优先取该角色在视频中的吐槽、经典发言、字幕台词；无法确定台词时，用符合该角色气质的短拟声词或情绪短句。

输入信息：
- 视频文件名：${path.basename(input.videoPath)}
- source_id：${input.sourceId}
- 视频元数据：${metadata}
- 字幕/文稿 sidecar：${sidecarText}
- 关键帧路径按顺序为：${frameNames.join(", ") || "无"}
- 关键帧图片随消息附带。

请只输出 JSON，不要 Markdown。必须使用下面结构：
{
  "video_summary": "一句话说明视频内容",
  "observed_from_video": {
    "scene": "真实画面场景",
    "visual_style": "画面风格和时代/题材",
    "visible_characters": [
      {
        "name": "角色名，不确定时写描述名",
        "visual_description": "发型、服装、体型、姿态、颜色等可用于生成的外观描述",
        "personality": "从表情、动作、台词推断的气质",
        "evidence_frames": ["analysis_frames/frame_01.jpg"],
        "confidence": 0.0
      }
    ],
    "visible_props": [
      {
        "name": "画面中可见物品",
        "owner": "角色名或 unknown",
        "evidence_frames": ["analysis_frames/frame_01.jpg"],
        "confidence": 0.0
      }
    ],
    "dialogue_or_subtitle": ["视频中的关键台词或字幕"],
    "uncertainties": ["不确定点"]
  },
  "creative_game_design": {
    "fighters": [
      {
        "id": "p1",
        "name": "角色名",
        "archetype_name": "便于生成模型理解的角色类型名",
        "role_type": "melee 或 ranged 或 hybrid 或 unknown，不需要强制一近一远",
        "visual_description": "给图片生成模型看的完整角色外观描述",
        "form_constraints": {
          "entity_type": "源视频中的主体类型，例如真人、动物、怪物、机械、物体、贴纸角色、3D模型、2D卡通等；必须从视频判断，不要套模板",
          "body_plan": "身体/结构方案，例如双足人形、四足动物、漂浮物体、车辆、球体、无固定肢体等",
          "proportions": "源视频中的比例特征，例如头身比、长宽比例、肢体长度、是否夸张或写实",
          "silhouette": "最重要的外轮廓和识别形状",
          "surface_material": "皮肤/毛发/布料/金属/塑料/纸片/像素块/3D材质等源视频材质特征",
          "detail_density": "源视频细节密度：低/中/高，以及哪些细节不应额外添加",
          "rendering_style": "源视频自己的画面媒介和渲染方式，不要预设为卡通、人形或二次元",
          "motion_style": "源视频角色运动方式",
          "must_keep": ["必须保留的形态、比例、轮廓、材质和颜色"],
          "must_not_change": ["禁止改变的实体类型、身体结构、材质或风格"]
        },
        "personality": "战斗气质",
        "weapon": {
          "name": "武器/道具名",
          "attack_type": "swing 或 throw 或 hybrid 或 unknown",
          "source": "observed_from_video 或 derived_from_scene 或 absurd_creative 或 fallback_design",
          "creativity_level": "faithful 或 stylized 或 absurd",
          "description": "武器/道具的可视化描述",
          "projectile_description": "如果有飞行物，描述飞行物；没有则为空字符串",
          "reason": "为什么这样设计",
          "confidence": 0.0
        },
        "skill_taunt": {
          "text": "该角色长按攻击触发的吐槽/经典发言/拟声词，尽量短，优先来自该角色字幕或台词",
          "source": "dialogue_or_subtitle 或 observed_from_video 或 derived_from_scene 或 onomatopoeia 或 fallback_design",
          "speaker": "角色名或 unknown",
          "evidence_frames": ["analysis_frames/frame_01.jpg"],
          "reason": "为什么这句话属于该角色",
          "confidence": 0.0
        },
        "evidence": {
          "frames": ["analysis_frames/frame_01.jpg"],
          "notes": ["支撑这个角色设计的证据"],
          "confidence": 0.0
        }
      },
      {
        "id": "p2",
        "name": "角色名",
        "archetype_name": "便于生成模型理解的角色类型名",
        "role_type": "melee 或 ranged 或 hybrid 或 unknown",
        "visual_description": "给图片生成模型看的完整角色外观描述",
        "form_constraints": {
          "entity_type": "源视频中的主体类型，例如真人、动物、怪物、机械、物体、贴纸角色、3D模型、2D卡通等；必须从视频判断，不要套模板",
          "body_plan": "身体/结构方案，例如双足人形、四足动物、漂浮物体、车辆、球体、无固定肢体等",
          "proportions": "源视频中的比例特征，例如头身比、长宽比例、肢体长度、是否夸张或写实",
          "silhouette": "最重要的外轮廓和识别形状",
          "surface_material": "皮肤/毛发/布料/金属/塑料/纸片/像素块/3D材质等源视频材质特征",
          "detail_density": "源视频细节密度：低/中/高，以及哪些细节不应额外添加",
          "rendering_style": "源视频自己的画面媒介和渲染方式，不要预设为卡通、人形或二次元",
          "motion_style": "源视频角色运动方式",
          "must_keep": ["必须保留的形态、比例、轮廓、材质和颜色"],
          "must_not_change": ["禁止改变的实体类型、身体结构、材质或风格"]
        },
        "personality": "战斗气质",
        "weapon": {
          "name": "武器/道具名",
          "attack_type": "swing 或 throw 或 hybrid 或 unknown",
          "source": "observed_from_video 或 derived_from_scene 或 absurd_creative 或 fallback_design",
          "creativity_level": "faithful 或 stylized 或 absurd",
          "description": "武器/道具的可视化描述",
          "projectile_description": "如果有飞行物，描述飞行物；没有则为空字符串",
          "reason": "为什么这样设计",
          "confidence": 0.0
        },
        "skill_taunt": {
          "text": "该角色长按攻击触发的吐槽/经典发言/拟声词，尽量短，优先来自该角色字幕或台词",
          "source": "dialogue_or_subtitle 或 observed_from_video 或 derived_from_scene 或 onomatopoeia 或 fallback_design",
          "speaker": "角色名或 unknown",
          "evidence_frames": ["analysis_frames/frame_01.jpg"],
          "reason": "为什么这句话属于该角色",
          "confidence": 0.0
        },
        "evidence": {
          "frames": ["analysis_frames/frame_01.jpg"],
          "notes": ["支撑这个角色设计的证据"],
          "confidence": 0.0
        }
      }
    ],
    "conflict": {
      "relationship": "两人的关系",
      "reason": "为什么适合 1v1 对抗",
      "tone": "严肃/荒诞/吐槽/热血等"
    },
    "taunt": {
      "text": "来自视频或根据视频气质提炼的短吐槽",
      "source": "dialogue_or_subtitle 或 derived_from_scene 或 fallback_design",
      "confidence": 0.0
    },
    "style_brief": {
      "world": "世界观/题材",
      "art_direction": "后续九帧生成的统一视觉方向；必须从源视频画面归纳，不要默认卡通化、人形化、二次元化或写实化",
      "character_consistency": "哪些源视频形态、比例、轮廓、材质、颜色和动作特征必须保持一致",
      "color_notes": "服饰、武器、环境主色证据",
      "generation_prompt_base": "后续图像生成可复用的基础英文或中文 prompt"
    },
    "confidence": 0.0,
    "reason": "总体判断理由"
  }
}

约束：
- 必须选出两个 fighters；如果画面多人，选择冲突关系最强或最有辨识度的两人。
- 不要强制一近一远；role_type 可以相同，也可以 hybrid。
- 武器如果画面明确出现，source 写 observed_from_video。
- 武器如果画面没有明确出现但符合场景，source 写 derived_from_scene。
- 武器如果是小游戏梗或无厘头设计，source 写 absurd_creative。
- 如果无法判断，使用 fallback_design，并明确写不确定原因。
- form_constraints 必须描述源视频真实形态，不要把某一种视频的风格当成通用模板；如果源主体不是人，不要改写成标准人形；如果源主体是人，也不要改写成动物、怪物或物体。
- art_direction 必须跟随源视频自身视觉媒介与细节密度，只做动作帧适配，不要默认套用“Q版、卡通、二次元、写实、像素”等固定风格。
- skill_taunt 必须按角色分别给出；如果视频有清晰台词或字幕，尽量把台词分配给说话者，不要只输出一个全局吐槽。
- skill_taunt.text 可以保留原视频中的粗口或口头禅，但要短、清楚、适合游戏中显示；两名角色的技能语句尽量不同。
- 如果视频没有语言、字幕或可识别台词，skill_taunt.source 写 onomatopoeia，text 写符合角色动作和表情的短拟声/情绪语句，例如“嘿！”“哼！”“呀！”之类，不要硬编长台词。
- evidence_frames 只能引用上面列出的关键帧相对路径。`;
}

function appendStageAssetUnderstandingPrompt(prompt, input = {}) {
  if (!input.generateStageAssets) return prompt;
  return `${prompt}

Additional optional stage-asset planning is enabled for this run.
Do not generate images in this step. Only add structured planning data for the later image generation step.
Add creative_game_design.scene_assets to the JSON output with this shape:
{
  "scene_assets": {
    "mode": "generated_stage_assets",
    "world": "short description of the battle arena implied by the video",
    "background": {
      "description": "vertical 9:16 playable background, no main characters, no large text, leaves room for fighters and HUD",
      "style_notes": "lighting, color palette, camera distance, era, material and media style from the source video",
      "must_keep": ["visual evidence to preserve"],
      "must_avoid": ["large readable text", "main character portraits", "busy foreground blocking gameplay"],
      "evidence_frames": ["analysis_frames/frame_01.jpg"],
      "confidence": 0.0
    },
    "platforms": {
      "description": "left, middle and right platform tile visual design for the game stage",
      "material": "dominant material and texture",
      "shape_language": "silhouette, edge style, support details",
      "must_keep": ["source-style details"],
      "must_avoid": ["characters", "logos", "text", "opaque background"],
      "evidence_frames": ["analysis_frames/frame_01.jpg"],
      "confidence": 0.0
    },
    "hazards": {
      "description": "small debris/hazard object matching the scene style",
      "material": "material and color",
      "must_keep": ["source-style details"],
      "must_avoid": ["characters", "text", "large opaque square background"],
      "evidence_frames": ["analysis_frames/frame_01.jpg"],
      "confidence": 0.0
    },
    "effects": {
      "voice_skill": {
        "description": "visual direction for the voice skill stun effect; this run only records the plan unless effect generation is implemented",
        "color": "#RRGGBB",
        "confidence": 0.0
      }
    }
  }
}
Keep scene_assets based on actual video evidence or clearly label it as derived_from_scene/fallback_design in the description when uncertain.`;
}

function buildVideoDecisionPrompt(input) {
  const sidecarText = input.sidecarText?.map((item) => `文件 ${item.file}:\n${item.text}`).join("\n\n") || "无";
  const metadata = JSON.stringify(input.metadata || {}, null, 2);
  return `请分析这个视频，自动产出游戏主题素材包所需的结构化决策。

固定玩法：
- 1v1 对战。
- 两个角色必须一近战一远程。
- 近战普通攻击：挥动物体攻击。
- 远程普通攻击：投掷物体攻击。
- 通用技能“吐槽”：来自视频关键语句，短、清楚、有梗。

输入信息：
- 视频文件名：${path.basename(input.videoPath)}
- source_id：${input.sourceId}
- 视频元数据：${metadata}
- 字幕/文稿 sidecar：${sidecarText}
- 关键帧：随消息附带。

请只输出 JSON，字段如下：
{
  "display_name": "主题显示名",
  "environment_name": "场景名",
  "theme_color": "#RRGGBB",
  "accent_color": "#RRGGBB",
  "main_characters": ["角色1", "角色2"],
  "relationship": "两人的关系/对抗解释",
  "p1_role": "melee 或 ranged",
  "p1_attack_prop": "近战挥动物或远程投掷物",
  "p2_role": "melee 或 ranged",
  "p2_attack_prop": "近战挥动物或远程投掷物",
  "taunt_text": "关键吐槽语句，尽量不超过 12 个中文字",
  "transcript_candidates": ["候选台词"],
  "entity_candidates": [{"name":"角色名","confidence":0.0,"evidence":["证据"]}],
  "prop_candidates": [{"name":"物品名","type":"melee_prop 或 projectile","confidence":0.0}],
  "asset_crops": {
    "p1_head": {"frame_index": 1, "box": [0.0, 0.0, 1.0, 1.0], "note": "角色1头部归一化裁剪框"},
    "p1_body": {"frame_index": 1, "box": [0.0, 0.0, 1.0, 1.0], "note": "角色1上半身/衣服归一化裁剪框"},
    "p1_melee_prop": {"frame_index": 1, "box": [0.0, 0.0, 1.0, 1.0], "note": "近战挥动物归一化裁剪框"},
    "p2_head": {"frame_index": 1, "box": [0.0, 0.0, 1.0, 1.0], "note": "角色2头部归一化裁剪框"},
    "p2_body": {"frame_index": 1, "box": [0.0, 0.0, 1.0, 1.0], "note": "角色2上半身/衣服归一化裁剪框"},
    "p2_projectile": {"frame_index": 1, "box": [0.0, 0.0, 1.0, 1.0], "note": "远程投掷物归一化裁剪框"}
  },
  "confidence": 0.0,
  "reason": "为什么这样映射为战斗角色和道具"
}

约束：
- asset_crops 中 frame_index 从 1 开始，对应附带关键帧顺序；box 是 [x,y,w,h]，均为 0 到 1 的归一化比例。
- 如果无法准确定位，给出最可能包含目标的宽松框，不要省略 asset_crops。
- 如果无法确定人物姓名，使用“角色A”和“角色B”。
- 如果无法确定近战物，使用“默认棍子”。
- 如果无法确定投掷物，使用“默认球体”。
- 如果无法确定吐槽语句，使用“看招”。
- p1_role 和 p2_role 必须一近战一远程。`;
}

async function buildImageContentItems(framePaths) {
  const items = [];
  for (const framePath of framePaths.slice(0, DEFAULT_FRAME_COUNT)) {
    const bytes = await readFile(framePath);
    items.push({
      type: "image_url",
      image_url: {
        url: `data:image/jpeg;base64,${bytes.toString("base64")}`
      }
    });
  }
  return items;
}

async function postVisionDecision(baseUrl, apiKey, model, prompt, framePaths) {
  if (isGeminiNativeBaseUrl(baseUrl)) {
    return postGeminiGenerateContent(baseUrl, apiKey, model, prompt, framePaths);
  }

  const imageItems = await buildImageContentItems(framePaths);
  const messages = [
    {
      role: "system",
      content: "你是一个面向 1v1 白模对战游戏的视频素材分析器。你只输出可解析 JSON，不输出 Markdown。"
    },
    {
      role: "user",
      content: [
        { type: "text", text: prompt },
        ...imageItems
      ]
    }
  ];
  const body = {
    model,
    messages,
    stream: true,
    temperature: 0.2
  };
  const json = await postChatCompletion(baseUrl, apiKey, body);
  return json.choices?.[0]?.message?.content || "";
}

function isGeminiNativeBaseUrl(baseUrl) {
  return /\/gemini(?:\/|$)/.test(baseUrl.replace(/\/+$/, ""));
}

async function postGeminiGenerateContent(baseUrl, apiKey, model, prompt, framePaths) {
  const url = buildGeminiStreamUrl(baseUrl, model);
  const parts = [
    {
      text: `你是一个面向 1v1 白模对战游戏的视频素材分析器。你只输出可解析 JSON，不输出 Markdown。\n\n${prompt}`
    }
  ];
  for (const framePath of framePaths.slice(0, DEFAULT_FRAME_COUNT)) {
    const bytes = await readFile(framePath);
    parts.push({
      inline_data: {
        mime_type: "image/jpeg",
        data: bytes.toString("base64")
      }
    });
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      generationConfig: {
        temperature: 0.2
      },
      contents: [
        {
          role: "user",
          parts
        }
      ]
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 500)}`);
  }

  return readGeminiStream(response);
}

function buildGeminiStreamUrl(baseUrl, model) {
  const normalized = baseUrl.replace(/\/+$/, "");
  if (/:(?:streamGenerateContent|generateContent)(?:\?|$)/.test(normalized)) return normalized;
  if (normalized.endsWith("/v1beta")) {
    return `${normalized}/models/${model}:streamGenerateContent?alt=sse`;
  }
  return `${normalized}/v1beta/models/${model}:streamGenerateContent?alt=sse`;
}

async function readGeminiStream(response) {
  if (!response.body) {
    return parseGeminiStream(await response.text());
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";
    content += parseGeminiStreamLines(lines);
  }

  buffer += decoder.decode();
  return content + parseGeminiStreamLines(buffer.split(/\r?\n/));
}

function parseGeminiStream(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    const payload = JSON.parse(trimmed);
    if (payload?.error) throw new Error(`Gemini response error: ${payload.error.message || JSON.stringify(payload.error)}`);
    return extractGeminiContent(payload);
  }
  return parseGeminiStreamLines(text.split(/\r?\n/));
}

function parseGeminiStreamLines(lines) {
  let content = "";
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") continue;
    let payload;
    try {
      payload = JSON.parse(data);
    } catch {
      // Ignore SSE keepalive or provider-specific non-JSON event payloads.
      continue;
    }
    if (payload?.error) throw new Error(`Gemini stream error: ${payload.error.message || JSON.stringify(payload.error)}`);
    content += extractGeminiContent(payload);
  }
  return content;
}

function extractGeminiContent(payload) {
  if (!payload) return "";
  if (typeof payload === "string") return payload;
  if (Array.isArray(payload)) return payload.map(extractGeminiContent).join("");
  if (payload.text) return stringifyModelContent(payload.text);
  if (payload.content) return stringifyModelContent(payload.content);
  if (payload.response) return stringifyModelContent(payload.response);
  if (Array.isArray(payload.choices)) {
    return payload.choices.map((choice) => {
      const value = choice.delta?.content ?? choice.message?.content ?? choice.text ?? choice.content ?? "";
      return stringifyModelContent(value);
    }).join("");
  }
  const candidates = payload.candidates || [];
  return candidates
    .flatMap((candidate) => candidate.content?.parts || [])
    .map((part) => part.text || "")
    .join("");
}

async function postChatCompletion(baseUrl, apiKey, body, timeoutMs = 180000) {
  const url = buildChatCompletionsUrl(baseUrl);
  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  }, timeoutMs);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 500)}`);
  }
  if (body.stream || (response.headers.get("content-type") || "").includes("text/event-stream")) {
    const content = await readChatCompletionStream(response);
    return { choices: [{ message: { content } }] };
  }
  const text = await response.text();
  return JSON.parse(text);
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 180000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError") throw new Error(`HTTP request timed out after ${timeoutMs}ms: ${url}`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function readChatCompletionStream(response) {
  if (!response.body) {
    return parseChatCompletionStream(await response.text());
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";
    const parsed = parseChatCompletionStreamLines(lines);
    content += parsed.content;
    if (parsed.done) return content;
  }

  buffer += decoder.decode();
  const parsed = parseChatCompletionStreamLines(buffer.split(/\r?\n/));
  return content + parsed.content;
}

function parseChatCompletionStream(text) {
  return parseChatCompletionStreamLines(text.split(/\r?\n/)).content;
}

function parseChatCompletionStreamLines(lines) {
  let content = "";
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (!data) continue;
    if (data === "[DONE]") return { content, done: true };
    try {
      const chunk = JSON.parse(data);
      content += extractStreamContent(chunk);
    } catch {
      // Ignore SSE keepalive or provider-specific non-JSON event payloads.
    }
  }
  return { content, done: false };
}

function extractStreamContent(chunk) {
  const choice = chunk.choices?.[0] || {};
  const value = choice.delta?.content ?? choice.message?.content ?? choice.text ?? "";
  return stringifyModelContent(value);
}

function stringifyModelContent(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map((item) => stringifyModelContent(item?.text ?? item?.content ?? item)).join("");
  }
  return String(value);
}

function buildChatCompletionsUrl(baseUrl) {
  const normalized = baseUrl.replace(/\/+$/, "");
  if (normalized.endsWith("/chat/completions")) return normalized;
  if (normalized.endsWith("/v1")) return `${normalized}/chat/completions`;
  return `${normalized}/v1/chat/completions`;
}

function parseJsonFromModel(content) {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  if (candidate.startsWith("{")) return JSON.parse(candidate);
  const jsonText = extractFirstJsonObject(candidate);
  if (!jsonText) {
    const preview = candidate.replace(/\s+/g, " ").slice(0, 160);
    throw new Error(`Model response does not contain a JSON object. Preview: ${preview || "<empty>"}`);
  }
  return JSON.parse(jsonText);
}

function extractFirstJsonObject(text) {
  const start = text.indexOf("{");
  if (start < 0) return "";
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === "\"") {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  return "";
}

function heuristicVideoDecision(input) {
  const name = input.baseName || "视频主题";
  if (/甄嬛|皇帝|宫廷/.test(name)) {
    return {
      display_name: "皇帝甄嬛",
      environment_name: "宫廷",
      theme_color: "#B8860B",
      accent_color: "#8B0000",
      main_characters: ["皇帝", "甄嬛"],
      relationship: "宫廷权力关系与情绪对抗",
      p1_role: "melee",
      p1_attack_prop: "宝剑",
      p2_role: "ranged",
      p2_attack_prop: "护甲",
      taunt_text: "臣妾做不到",
      transcript_candidates: ["臣妾做不到"],
      entity_candidates: [
        { name: "皇帝", confidence: 0.6, evidence: ["文件名", "启发式规则"] },
        { name: "甄嬛", confidence: 0.6, evidence: ["文件名", "启发式规则"] }
      ],
      prop_candidates: [
        { name: "宝剑", type: "melee_prop", confidence: 0.5 },
        { name: "护甲", type: "projectile", confidence: 0.5 }
      ],
      asset_crops: zhenhuanHeuristicAssetCrops(),
      confidence: 0.55,
      reason: "未完成大模型调用时，根据文件名做保守映射。"
    };
  }

  const transcript = input.sidecarText?.[0]?.text?.split(/\r?\n/).find((line) => line.trim())?.trim();
  return {
    display_name: name,
    environment_name: "视频场景",
    theme_color: "#4C7A9F",
    accent_color: "#D94F30",
    main_characters: ["角色A", "角色B"],
    relationship: "视频中的双人对抗关系",
    p1_role: "melee",
    p1_attack_prop: "默认棍子",
    p2_role: "ranged",
    p2_attack_prop: "默认球体",
    taunt_text: transcript?.slice(0, 12) || "看招",
    transcript_candidates: transcript ? [transcript] : ["看招"],
    entity_candidates: [
      { name: "角色A", confidence: 0.35, evidence: ["启发式 fallback"] },
      { name: "角色B", confidence: 0.35, evidence: ["启发式 fallback"] }
    ],
    prop_candidates: [
      { name: "默认棍子", type: "melee_prop", confidence: 0.3 },
      { name: "默认球体", type: "projectile", confidence: 0.3 }
    ],
    asset_crops: defaultHeuristicAssetCrops(),
    confidence: 0.35,
    reason: "未完成大模型调用时，使用默认双角色和默认道具保证游戏可加载。"
  };
}

function heuristicVideoUnderstanding(input) {
  const name = input.baseName || "视频主题";
  if (/星球大战|尤达|西迪厄斯|帕尔帕廷|光剑|Star\s*Wars/i.test(name)) {
    return {
      video_summary: "两名星战角色进行光剑对决，冲突以高速近身攻防和强烈压迫感为核心。",
      observed_from_video: {
        scene: "科幻议会/室内决斗场景",
        visual_style: "星球大战式科幻史诗，冷色空间、亮色光剑、高对比动作镜头",
        visible_characters: [
          {
            name: "尤达",
            visual_description: "矮小绿色大师，长耳朵，长袍，动作敏捷，使用绿色光剑",
            personality: "冷静、灵活、以小博大",
            evidence_frames: [frameRef(2, input)],
            confidence: 0.72
          },
          {
            name: "西迪厄斯/帕尔帕廷",
            visual_description: "黑袍西斯角色，压迫感强，使用红色光剑，动作阴险凶狠",
            personality: "阴险、强势、攻击性强",
            evidence_frames: [frameRef(4, input)],
            confidence: 0.72
          }
        ],
        visible_props: [
          { name: "绿色光剑", owner: "尤达", evidence_frames: [frameRef(2, input)], confidence: 0.7 },
          { name: "红色光剑", owner: "西迪厄斯/帕尔帕廷", evidence_frames: [frameRef(4, input)], confidence: 0.7 }
        ],
        dialogue_or_subtitle: [],
        uncertainties: ["启发式结果没有真实读取画面语义；需用多模态模型复核角色与武器证据。"]
      },
      creative_game_design: {
        fighters: [
          {
            id: "p1",
            name: "尤达",
            archetype_name: "敏捷光剑大师",
            role_type: "melee",
            visual_description: "矮小绿色外星大师，长耳朵，棕灰长袍，绿色光剑，动作像弹跳旋风",
            form_constraints: {
              entity_type: "源视频中的矮小绿色长耳外星角色",
              body_plan: "双足类人结构，但体型明显矮小，长耳和长袍构成主要轮廓",
              proportions: "保持源视频矮小体型、长耳比例和短武器尺度，不拉高为普通成人比例",
              silhouette: "长耳、矮身、宽松长袍、短柄绿色发光剑",
              surface_material: "绿色皮肤或皮纹、布质长袍、发光能量剑",
              detail_density: "跟随源视频关键帧的细节密度，不额外套用另一种美术模板",
              rendering_style: "匹配源视频画面媒介和光影质感",
              motion_style: "敏捷跳跃、旋转、快速近身挥剑",
              must_keep: ["矮小体型", "绿色皮肤", "长耳轮廓", "棕灰长袍", "绿色发光短剑"],
              must_not_change: ["不要改变源视频实体类型", "不要改变源视频身体比例", "不要脱离源视频画面媒介"]
            },
            personality: "冷静、灵活、反击型",
            weapon: {
              name: "绿色光剑",
              attack_type: "swing",
              source: "observed_from_video",
              creativity_level: "faithful",
              description: "短柄绿色能量光剑，挥动时留下明亮弧光",
              projectile_description: "",
              reason: "视频主题和文件名明确是光剑对决，尤达的核心识别物就是绿色光剑。",
              confidence: 0.72
            },
            evidence: {
              frames: [frameRef(2, input), frameRef(3, input)],
              notes: ["文件名包含尤达与光剑对决", "角色体型和武器具有强识别度"],
              confidence: 0.72
            }
          },
          {
            id: "p2",
            name: "西迪厄斯/帕尔帕廷",
            archetype_name: "西斯黑袍皇帝",
            role_type: "hybrid",
            visual_description: "黑袍西斯皇帝，阴沉表情，红色光剑，能释放夸张的原力闪电",
            form_constraints: {
              entity_type: "源视频中的黑袍人形反派角色",
              body_plan: "双足人形，宽大黑袍和兜帽/阴影构成主要外轮廓",
              proportions: "保持源视频人形比例和黑袍覆盖体块，不改成兽类、机械或玩具比例",
              silhouette: "深色兜帽、宽大黑袍、红色发光剑、电弧手势",
              surface_material: "深色布料长袍、阴影面部、红色能量剑、紫蓝电弧",
              detail_density: "跟随源视频关键帧的细节密度，不额外套用另一种美术模板",
              rendering_style: "匹配源视频画面媒介和高对比光效",
              motion_style: "压迫式近战、蓄力施法或电弧投射",
              must_keep: ["黑袍/兜帽轮廓", "阴沉反派气质", "红色发光剑", "紫蓝电弧"],
              must_not_change: ["不要改变源视频实体类型", "不要改变源视频身体比例", "不要脱离源视频画面媒介"]
            },
            personality: "阴险、压迫、爆发型",
            weapon: {
              name: "红色光剑与原力闪电",
              attack_type: "hybrid",
              source: "derived_from_scene",
              creativity_level: "stylized",
              description: "红色能量光剑用于近战，手中可凝聚紫蓝色电弧",
              projectile_description: "紫蓝色原力闪电球或电弧弹，在空中分叉闪烁",
              reason: "光剑是忠实武器，原力闪电适合把角色扩展为可远程/混合攻击的小游戏角色。",
              confidence: 0.68
            },
            evidence: {
              frames: [frameRef(4, input), frameRef(5, input)],
              notes: ["文件名包含西迪厄斯/帕尔帕廷", "星战反派形象天然适配原力闪电"],
              confidence: 0.68
            }
          }
        ],
        conflict: {
          relationship: "绝地大师与西斯皇帝的生死对决",
          reason: "双方视觉风格、阵营和武器形成清晰对抗，非常适合 1v1。",
          tone: "热血、史诗、带一点夸张动作喜剧"
        },
        taunt: {
          text: "小个子也能赢",
          source: "derived_from_scene",
          confidence: 0.55
        },
        style_brief: {
          world: "星球大战科幻决斗",
          art_direction: "匹配源视频中的科幻决斗画面媒介、角色比例、材质和光剑/电弧光效；只为九帧动作清晰度做必要适配。",
          character_consistency: "保持尤达矮小绿色长耳、黑袍皇帝、绿色/红色光剑的核心差异",
          color_notes: "绿色光剑、红色光剑、黑袍、紫蓝闪电、冷色科幻场景",
          generation_prompt_base: "source-video-matched sci-fi duel animation frames, preserve source character proportions, material cues, robe/skin silhouettes, readable lightsabers and lightning, transparent background"
        },
        confidence: 0.68,
        reason: "根据文件名和常识启发式构造，真实画面证据需要多模态模型确认。"
      }
    };
  }

  if (/甄嬛|祺贵人|宫廷|清宫|皇帝/.test(name)) {
    return {
      video_summary: "两名清宫女性角色发生言语冲突，适合转化为宫斗式 1v1 对抗。",
      observed_from_video: {
        scene: "清宫室内/宫廷剧情场景",
        visual_style: "古装宫廷剧，发髻、旗装、室内暖色布景，台词对抗明显",
        visible_characters: [
          {
            name: "甄嬛",
            visual_description: "清宫女性角色，盘发发饰，旗装，气质冷静克制",
            personality: "冷静、反击、善用语言压制",
            evidence_frames: [frameRef(2, input)],
            confidence: 0.62
          },
          {
            name: "祺贵人",
            visual_description: "清宫女性角色，服饰更华丽，表情偏挑衅",
            personality: "尖锐、挑衅、主动进攻",
            evidence_frames: [frameRef(4, input)],
            confidence: 0.62
          }
        ],
        visible_props: [],
        dialogue_or_subtitle: ["我还以为是什么毒誓呢"],
        uncertainties: ["启发式结果基于文件名和既有测试记录；需用多模态模型复核画面证据。"]
      },
      creative_game_design: {
        fighters: [
          {
            id: "p1",
            name: "甄嬛",
            archetype_name: "冷静宫斗反击者",
            role_type: "ranged",
            visual_description: "清宫女性角色，精致发髻，深色旗装，站姿克制，表情冷静但有压迫感",
            form_constraints: {
              entity_type: "源视频中的真人古装剧女性角色",
              body_plan: "真实成人双足人形，头饰、旗装和站姿形成主要轮廓",
              proportions: "保持源视频真人比例和服装体块，不改成默认小人比例",
              silhouette: "发髻/头饰、旗装肩颈线、长袍下摆、克制站姿",
              surface_material: "织物旗装、发饰、妆容、白瓷茶杯",
              detail_density: "跟随源视频古装剧服化道细节密度，不额外套用另一种美术模板",
              rendering_style: "匹配源视频画面媒介、光影和服装材质",
              motion_style: "克制、端庄、反击式投掷",
              must_keep: ["真人比例", "清宫发饰", "旗装轮廓", "冷静表情气质"],
              must_not_change: ["不要改变源视频实体类型", "不要改变源视频身体比例", "不要脱离源视频画面媒介"]
            },
            personality: "冷静、反击、吐槽精准",
            weapon: {
              name: "茶杯",
              attack_type: "throw",
              source: "derived_from_scene",
              creativity_level: "stylized",
              description: "白瓷茶杯，杯沿带一点金色纹样，投掷时洒出茶水弧线",
              projectile_description: "旋转飞出的茶杯，后面拖着几滴茶水",
              reason: "宫廷场景里茶杯容易成立，也适合做远程投掷物，带一点喜剧感。",
              confidence: 0.6
            },
            evidence: {
              frames: [frameRef(2, input), frameRef(3, input)],
              notes: ["宫廷台词冲突适合做冷静反击角色", "茶杯来自场景推理而非明确画面证据"],
              confidence: 0.62
            }
          },
          {
            id: "p2",
            name: "祺贵人",
            archetype_name: "挑衅宫斗进攻者",
            role_type: "melee",
            visual_description: "清宫女性角色，华丽旗装和发饰，动作更尖锐，表情挑衅",
            form_constraints: {
              entity_type: "源视频中的真人古装剧女性角色",
              body_plan: "真实成人双足人形，华丽发饰和旗装构成主要轮廓",
              proportions: "保持源视频真人比例和服装体块，不改成默认小人比例",
              silhouette: "华丽头饰、旗装肩颈线、长袍下摆、挑衅姿态",
              surface_material: "织物旗装、金色发饰、妆容、金属簪子",
              detail_density: "跟随源视频古装剧服化道细节密度，不额外套用另一种美术模板",
              rendering_style: "匹配源视频画面媒介、光影和服装材质",
              motion_style: "尖锐、压迫、近身挥击",
              must_keep: ["真人比例", "清宫发饰", "旗装轮廓", "挑衅表情气质"],
              must_not_change: ["不要改变源视频实体类型", "不要改变源视频身体比例", "不要脱离源视频画面媒介"]
            },
            personality: "强势、尖锐、主动挑衅",
            weapon: {
              name: "簪子",
              attack_type: "swing",
              source: "absurd_creative",
              creativity_level: "stylized",
              description: "夸张放大的金色发簪，挥动时像小短剑一样划出金光",
              projectile_description: "",
              reason: "视频未必有明确武器，簪子符合宫廷身份，也有小游戏的夸张梗感。",
              confidence: 0.55
            },
            evidence: {
              frames: [frameRef(4, input), frameRef(5, input)],
              notes: ["挑衅气质适合近战压迫", "簪子为创意设计道具"],
              confidence: 0.58
            }
          }
        ],
        conflict: {
          relationship: "宫斗式言语对抗",
          reason: "台词和人物气质能形成一攻一守的对抗关系。",
          tone: "讽刺、宫斗、轻微无厘头"
        },
        taunt: {
          text: "我还以为是什么毒誓呢",
          source: "dialogue_or_subtitle",
          confidence: 0.72
        },
        style_brief: {
          world: "清宫宫斗短视频",
          art_direction: "匹配源视频古装剧画面媒介、真人比例、旗装/发饰材质和宫廷色彩；只为九帧动作清晰度做必要适配。",
          character_consistency: "保留发髻、旗装、冷静与挑衅的表情差异，武器要明显可读",
          color_notes: "宫廷暖色背景、深色旗装、金色发饰、白瓷茶杯",
          generation_prompt_base: "source-video-matched palace drama animation frames, preserve source human proportions, costume material, ornate hairpiece and robe silhouettes, readable teacup projectile and golden hairpin weapon, transparent background"
        },
        confidence: 0.62,
        reason: "根据文件名、既有识别结果和宫廷剧情常识做启发式理解。"
      }
    };
  }

  const transcript = input.sidecarText?.[0]?.text?.split(/\r?\n/).find((line) => line.trim())?.trim();
  return {
    video_summary: "视频中存在可转化为 1v1 对抗的双人或双阵营冲突。",
    observed_from_video: {
      scene: "视频场景",
      visual_style: "待多模态模型确认",
      visible_characters: [
        { name: "角色A", visual_description: "左侧或主要角色", personality: "待确认", evidence_frames: [frameRef(2, input)], confidence: 0.35 },
        { name: "角色B", visual_description: "右侧或对抗角色", personality: "待确认", evidence_frames: [frameRef(3, input)], confidence: 0.35 }
      ],
      visible_props: [],
      dialogue_or_subtitle: transcript ? [transcript] : [],
      uncertainties: ["未配置大模型时只能根据文件名和默认规则产出占位理解。"]
    },
    creative_game_design: {
      fighters: [
        {
          id: "p1",
          name: "角色A",
          archetype_name: "默认近战角色",
          role_type: "melee",
          visual_description: "从视频主角抽象出的小游戏角色/主体，形态和风格等待多模态模型确认",
          form_constraints: defaultSourceAdaptiveFormConstraints(),
          personality: "主动进攻",
          weapon: {
            name: "夸张棍子",
            attack_type: "swing",
            source: "fallback_design",
            creativity_level: "stylized",
            description: "便于读懂的默认挥动物",
            projectile_description: "",
            reason: "无模型 fallback，保证后续结构完整。",
            confidence: 0.3
          },
          evidence: { frames: [frameRef(2, input)], notes: ["启发式 fallback"], confidence: 0.35 }
        },
        {
          id: "p2",
          name: "角色B",
          archetype_name: "默认远程角色",
          role_type: "ranged",
          visual_description: "从视频对手抽象出的小游戏角色/主体，形态和风格等待多模态模型确认",
          form_constraints: defaultSourceAdaptiveFormConstraints(),
          personality: "远程骚扰",
          weapon: {
            name: "弹力球",
            attack_type: "throw",
            source: "fallback_design",
            creativity_level: "stylized",
            description: "便于读懂的默认投掷物",
            projectile_description: "圆形弹力球，在空中带短拖尾",
            reason: "无模型 fallback，保证后续结构完整。",
            confidence: 0.3
          },
          evidence: { frames: [frameRef(3, input)], notes: ["启发式 fallback"], confidence: 0.35 }
        }
      ],
      conflict: {
        relationship: "视频中的对抗关系",
        reason: "默认抽象为两个对抗角色。",
        tone: "白模验证"
      },
      taunt: {
        text: transcript?.slice(0, 16) || "看招",
        source: transcript ? "dialogue_or_subtitle" : "fallback_design",
        confidence: transcript ? 0.45 : 0.3
      },
      style_brief: {
        world: "视频主题世界",
        art_direction: "匹配源视频自身视觉媒介、形态比例和细节密度；仅为动作帧和武器可读性做必要适配。",
        character_consistency: "保持两个角色在颜色、体型、武器上的差异",
        color_notes: "待多模态模型确认",
        generation_prompt_base: "source-video-matched 1v1 mini game animation frames, transparent background, readable weapons, preserve source form"
      },
      confidence: 0.35,
      reason: "未调用多模态模型时的默认结构化理解。"
    }
  };
}

function normalizeVideoUnderstanding(raw, context) {
  const data = raw && typeof raw === "object" ? raw : {};
  const observed = data.observed_from_video && typeof data.observed_from_video === "object" ? data.observed_from_video : {};
  const creative = data.creative_game_design && typeof data.creative_game_design === "object"
    ? data.creative_game_design
    : legacyDecisionToCreativeDesign(data, context);
  const observedDialogue = normalizeStringArray(observed.dialogue_or_subtitle || observed.dialogues || observed.subtitles);
  const globalTaunt = normalizeGlobalTaunt(creative, context);
  const fighterContext = { ...context, observedDialogue, globalTaunt };
  const rawFighters = Array.isArray(creative.fighters) ? creative.fighters.slice(0, 2) : [];
  const rawSceneAssets = creative.scene_assets || creative.stage_assets;
  while (rawFighters.length < 2) {
    rawFighters.push(defaultFighter(rawFighters.length, fighterContext));
  }
  const fighters = rawFighters.map((fighter, index) => normalizeFighter(fighter, index, fighterContext));
  const visibleCharacters = normalizeVisibleCharacters(observed.visible_characters, fighters, fighterContext);

  return {
    video_summary: stringOr(data.video_summary || data.summary, `${context.baseName || "视频"} 的 1v1 对抗理解。`),
    observed_from_video: {
      scene: stringOr(observed.scene, "视频场景"),
      visual_style: stringOr(observed.visual_style || observed.style, "待确认"),
      visible_characters: visibleCharacters,
      visible_props: normalizeVisibleProps(observed.visible_props, fighterContext),
      dialogue_or_subtitle: observedDialogue,
      uncertainties: normalizeStringArray(observed.uncertainties)
    },
    creative_game_design: {
      fighters,
      conflict: {
        relationship: stringOr(creative.conflict?.relationship || creative.relationship, "视频中的对抗关系"),
        reason: stringOr(creative.conflict?.reason || creative.reason, "根据视频理解抽象为 1v1 对抗。"),
        tone: stringOr(creative.conflict?.tone, "白模验证")
      },
      taunt: globalTaunt,
      style_brief: normalizeStyleBrief(creative.style_brief, context),
      scene_assets: (context.generateStageAssets || rawSceneAssets)
        ? normalizeSceneAssets(rawSceneAssets, observed, creative, context)
        : undefined,
      confidence: clampConfidence(creative.confidence ?? data.confidence ?? averageConfidence(fighters)),
      reason: stringOr(creative.reason || data.reason, "根据视频关键帧、文件信息和候选文本做结构化理解。")
    }
  };
}

function normalizeGlobalTaunt(creative, context) {
  const rawTaunt = creative?.taunt && typeof creative.taunt === "object" ? creative.taunt : {};
  const rawText = typeof creative?.taunt === "string" ? creative.taunt : rawTaunt.text;
  const sidecarLine = pickDialogueLine(context, 0);
  return {
    text: stringOr(rawText || creative?.taunt_text || sidecarLine, "看招").slice(0, 24),
    source: normalizeSource(rawTaunt.source || (rawText || creative?.taunt_text || sidecarLine ? "dialogue_or_subtitle" : "fallback_design")),
    confidence: clampConfidence(rawTaunt.confidence ?? creative?.confidence ?? (rawText || creative?.taunt_text || sidecarLine ? 0.5 : 0.3))
  };
}

function legacyDecisionToCreativeDesign(decision, context) {
  const names = Array.isArray(decision.main_characters) ? decision.main_characters : ["角色A", "角色B"];
  return {
    fighters: [
      {
        id: "p1",
        name: names[0] || "角色A",
        archetype_name: names[0] || "角色A",
        role_type: decision.p1_role || "unknown",
        visual_description: names[0] || "角色A",
        personality: "待确认",
        weapon: {
          name: decision.p1_attack_prop || "默认道具",
          attack_type: decision.p1_role === "ranged" ? "throw" : decision.p1_role === "melee" ? "swing" : "unknown",
          source: "fallback_design",
          creativity_level: "stylized",
          description: decision.p1_attack_prop || "默认道具",
          projectile_description: decision.p1_role === "ranged" ? decision.p1_attack_prop || "默认投掷物" : "",
          reason: "旧 llm_decision 字段转换而来。",
          confidence: decision.confidence ?? 0.5
        },
        skill_taunt: {
          text: decision.p1_skill_taunt || decision.p1_taunt_text || decision.taunt_text || pickDialogueLine(context, 0) || "嘿！",
          source: decision.p1_skill_taunt || decision.p1_taunt_text || decision.taunt_text ? "dialogue_or_subtitle" : "fallback_design",
          speaker: names[0] || "角色A",
          evidence_frames: [frameRef(1, context)],
          reason: "旧 llm_decision 字段转换而来。",
          confidence: decision.confidence ?? 0.5
        },
        evidence: { frames: [frameRef(1, context)], notes: ["旧字段转换"], confidence: decision.confidence ?? 0.5 }
      },
      {
        id: "p2",
        name: names[1] || "角色B",
        archetype_name: names[1] || "角色B",
        role_type: decision.p2_role || "unknown",
        visual_description: names[1] || "角色B",
        personality: "待确认",
        weapon: {
          name: decision.p2_attack_prop || "默认道具",
          attack_type: decision.p2_role === "ranged" ? "throw" : decision.p2_role === "melee" ? "swing" : "unknown",
          source: "fallback_design",
          creativity_level: "stylized",
          description: decision.p2_attack_prop || "默认道具",
          projectile_description: decision.p2_role === "ranged" ? decision.p2_attack_prop || "默认投掷物" : "",
          reason: "旧 llm_decision 字段转换而来。",
          confidence: decision.confidence ?? 0.5
        },
        skill_taunt: {
          text: decision.p2_skill_taunt || decision.p2_taunt_text || pickDialogueLine(context, 1) || "哼！",
          source: decision.p2_skill_taunt || decision.p2_taunt_text || pickDialogueLine(context, 1) ? "dialogue_or_subtitle" : "fallback_design",
          speaker: names[1] || "角色B",
          evidence_frames: [frameRef(2, context)],
          reason: "旧 llm_decision 字段转换而来。",
          confidence: decision.confidence ?? 0.5
        },
        evidence: { frames: [frameRef(2, context)], notes: ["旧字段转换"], confidence: decision.confidence ?? 0.5 }
      }
    ],
    conflict: {
      relationship: decision.relationship || "视频中的对抗关系",
      reason: decision.reason || "旧字段转换而来。",
      tone: "白模验证"
    },
    taunt: {
      text: decision.taunt_text || context.sidecarText?.[0]?.text?.slice(0, 16) || "看招",
      source: decision.taunt_text ? "dialogue_or_subtitle" : "fallback_design",
      confidence: decision.confidence ?? 0.5
    },
    style_brief: null,
    confidence: decision.confidence ?? 0.5,
    reason: decision.reason || "旧字段转换而来。"
  };
}

function normalizeFighter(raw, index, context) {
  const fallback = defaultFighter(index, context);
  const weapon = raw.weapon && typeof raw.weapon === "object" ? raw.weapon : {};
  const evidence = raw.evidence && typeof raw.evidence === "object" ? raw.evidence : {};
  const formConstraints = normalizeFormConstraints(raw.form_constraints || raw.formConstraints, fallback.form_constraints);
  const name = stringOr(raw.name || raw.character_name, fallback.name);
  const evidenceFrames = normalizeFrameArray(evidence.frames || raw.evidence_frames, context);
  return {
    id: index === 0 ? "p1" : "p2",
    name,
    archetype_name: stringOr(raw.archetype_name || raw.archetype, fallback.archetype_name),
    role_type: normalizeRoleType(raw.role_type || raw.role, fallback.role_type),
    visual_description: stringOr(raw.visual_description || raw.appearance, fallback.visual_description),
    form_constraints: formConstraints,
    personality: stringOr(raw.personality, fallback.personality),
    weapon: {
      name: stringOr(weapon.name || raw.weapon_name, fallback.weapon.name),
      attack_type: normalizeAttackType(weapon.attack_type || raw.attack_type, fallback.weapon.attack_type),
      source: normalizeSource(weapon.source, fallback.weapon.source),
      creativity_level: normalizeCreativity(weapon.creativity_level, fallback.weapon.creativity_level),
      description: stringOr(weapon.description, fallback.weapon.description),
      projectile_description: stringOr(weapon.projectile_description || raw.projectile_description, ""),
      reason: stringOr(weapon.reason, fallback.weapon.reason),
      confidence: clampConfidence(weapon.confidence ?? raw.confidence ?? fallback.weapon.confidence)
    },
    skill_taunt: normalizeSkillTaunt(
      pickSkillTauntRaw(raw),
      fallback.skill_taunt,
      { ...context, fighterName: name, fighterId: index === 0 ? "p1" : "p2", fallbackFrames: evidenceFrames }
    ),
    evidence: {
      frames: evidenceFrames,
      notes: normalizeStringArray(evidence.notes || raw.evidence_notes),
      confidence: clampConfidence(evidence.confidence ?? raw.confidence ?? fallback.evidence.confidence)
    }
  };
}

function defaultFighter(index, context) {
  const id = index === 0 ? "p1" : "p2";
  const name = index === 0 ? "角色A" : "角色B";
  return {
    id,
    name,
    archetype_name: name,
    role_type: "unknown",
    visual_description: `${name}，等待多模态模型补充外观细节。`,
    form_constraints: defaultSourceAdaptiveFormConstraints(),
    personality: "待确认",
    weapon: {
      name: index === 0 ? "默认棍子" : "默认球体",
      attack_type: index === 0 ? "swing" : "throw",
      source: "fallback_design",
      creativity_level: "stylized",
      description: index === 0 ? "默认挥动物" : "默认投掷物",
      projectile_description: index === 0 ? "" : "默认球体飞行物",
      reason: "结构兜底。",
      confidence: 0.3
    },
    evidence: {
      frames: [frameRef(index + 1, context)],
      notes: ["结构兜底"],
      confidence: 0.3
    },
    skill_taunt: defaultSkillTaunt(index, {
      ...context,
      fighterName: name,
      fighterId: id,
      fallbackFrames: [frameRef(index + 1, context)]
    })
  };
}

function defaultSourceAdaptiveFormConstraints() {
  return {
    entity_type: "unknown_source_entity",
    body_plan: "unknown_source_body_plan",
    proportions: "match source video after multimodal analysis",
    silhouette: "match source video after multimodal analysis",
    surface_material: "match source video after multimodal analysis",
    detail_density: "match source video after multimodal analysis",
    rendering_style: "match source video after multimodal analysis",
    motion_style: "match source video after multimodal analysis",
    must_keep: ["source entity category", "source body plan", "source silhouette", "source material/rendering style"],
    must_not_change: ["do not apply any fixed body, species, material, or art-style template without source video evidence"]
  };
}

function normalizeFormConstraints(rawForm, fallbackForm = {}) {
  const form = rawForm && typeof rawForm === "object" ? rawForm : {};
  return {
    entity_type: stringOr(form.entity_type || form.entityType, fallbackForm.entity_type || "unknown_source_entity"),
    body_plan: stringOr(form.body_plan || form.bodyPlan, fallbackForm.body_plan || "unknown_source_body_plan"),
    proportions: stringOr(form.proportions, fallbackForm.proportions || ""),
    silhouette: stringOr(form.silhouette, fallbackForm.silhouette || ""),
    surface_material: stringOr(form.surface_material || form.surfaceMaterial, fallbackForm.surface_material || ""),
    detail_density: stringOr(form.detail_density || form.detailDensity, fallbackForm.detail_density || ""),
    rendering_style: stringOr(form.rendering_style || form.renderingStyle, fallbackForm.rendering_style || ""),
    motion_style: stringOr(form.motion_style || form.motionStyle, fallbackForm.motion_style || ""),
    must_keep: normalizeStringArray(form.must_keep || form.mustKeep || fallbackForm.must_keep),
    must_not_change: normalizeStringArray(form.must_not_change || form.mustNotChange || fallbackForm.must_not_change)
  };
}

function normalizeVisibleCharacters(rawCharacters, fighters, context) {
  const source = Array.isArray(rawCharacters) && rawCharacters.length > 0
    ? rawCharacters.slice(0, 6)
    : fighters.map((fighter) => ({
        name: fighter.name,
        visual_description: fighter.visual_description,
        personality: fighter.personality,
        evidence_frames: fighter.evidence.frames,
        confidence: fighter.evidence.confidence
      }));
  return source.map((character, index) => ({
    name: stringOr(character.name, index === 0 ? "角色A" : "角色B"),
    visual_description: stringOr(character.visual_description || character.appearance, "待确认"),
    personality: stringOr(character.personality, "待确认"),
    evidence_frames: normalizeFrameArray(character.evidence_frames || character.frames, context),
    confidence: clampConfidence(character.confidence ?? 0.5)
  }));
}

function normalizeVisibleProps(rawProps, context) {
  if (!Array.isArray(rawProps)) return [];
  return rawProps.slice(0, 8).map((prop) => ({
    name: stringOr(prop.name, "未知物品"),
    owner: stringOr(prop.owner, "unknown"),
    evidence_frames: normalizeFrameArray(prop.evidence_frames || prop.frames, context),
    confidence: clampConfidence(prop.confidence ?? 0.5)
  }));
}

function normalizeStyleBrief(rawStyle, context) {
  const style = rawStyle && typeof rawStyle === "object" ? rawStyle : {};
  return {
    world: stringOr(style.world, context.baseName || "视频主题世界"),
    art_direction: stringOr(style.art_direction, "匹配源视频自身视觉媒介、形态比例、材质和细节密度；仅为动作帧和武器可读性做必要适配。"),
    character_consistency: stringOr(style.character_consistency, "保持两个角色/主体的源视频实体类型、身体结构、轮廓、材质、颜色和武器差异。"),
    color_notes: stringOr(style.color_notes, "参考视频关键帧主色。"),
    generation_prompt_base: stringOr(style.generation_prompt_base, "source-video-matched 1v1 mini game animation frames, transparent background, readable silhouette, preserve source form")
  };
}

function normalizeSceneAssets(rawSceneAssets, observed = {}, creative = {}, context = {}) {
  const scene = rawSceneAssets && typeof rawSceneAssets === "object" ? rawSceneAssets : {};
  const style = creative.style_brief && typeof creative.style_brief === "object" ? creative.style_brief : {};
  const fallbackFrames = [frameRef(1, context)].filter(Boolean);
  const world = stringOr(scene.world || style.world || observed.scene, context.baseName || "video-inspired battle arena");
  const color = normalizeHexColor(scene.effects?.voice_skill?.color || creative.accent_color || "#78d7ff", "#78d7ff");
  return {
    mode: stringOr(scene.mode, "generated_stage_assets"),
    world,
    background: normalizeSceneAssetBlock(scene.background, {
      description: `${world}; vertical 9:16 playable battle background with no central fighter portraits and no large readable text`,
      style_notes: stringOr(style.art_direction || observed.visual_style, "match the source video's visual medium, lighting, materials and color evidence"),
      must_keep: normalizeStringArray([style.color_notes || observed.visual_style]),
      must_avoid: ["main character portraits", "large readable text", "busy foreground blocking gameplay"],
      evidence_frames: fallbackFrames,
      confidence: 0.35
    }, context),
    platforms: normalizeSceneAssetBlock(scene.platforms || scene.platform, {
      description: "left, middle and right platform tiles matching the same arena style",
      material: "material inferred from the source scene",
      shape_language: "readable game platform silhouette with left cap, tileable middle and right cap",
      must_keep: normalizeStringArray([style.color_notes || observed.scene]),
      must_avoid: ["characters", "logos", "text", "opaque square background"],
      evidence_frames: fallbackFrames,
      confidence: 0.3
    }, context),
    hazards: normalizeSceneAssetBlock(scene.hazards || scene.hazard_debris || scene.hazard, {
      description: "small debris or hazard object matching the arena material and color",
      material: "material inferred from the source scene",
      must_keep: normalizeStringArray([observed.scene || style.color_notes]),
      must_avoid: ["characters", "text", "large opaque square background"],
      evidence_frames: fallbackFrames,
      confidence: 0.3
    }, context),
    effects: {
      voice_skill: {
        description: stringOr(scene.effects?.voice_skill?.description, "radial stun burst matching the theme accent color"),
        color,
        confidence: clampConfidence(scene.effects?.voice_skill?.confidence ?? 0.3)
      }
    }
  };
}

function normalizeSceneAssetBlock(rawBlock, fallback, context) {
  const block = rawBlock && typeof rawBlock === "object" ? rawBlock : {};
  return {
    description: stringOr(block.description, fallback.description),
    style_notes: stringOr(block.style_notes || block.styleNotes, fallback.style_notes || ""),
    material: stringOr(block.material, fallback.material || ""),
    shape_language: stringOr(block.shape_language || block.shapeLanguage, fallback.shape_language || ""),
    must_keep: normalizeStringArray(block.must_keep || block.mustKeep || fallback.must_keep),
    must_avoid: normalizeStringArray(block.must_avoid || block.mustAvoid || fallback.must_avoid),
    evidence_frames: normalizeFrameArray(block.evidence_frames || block.frames || fallback.evidence_frames, context),
    confidence: clampConfidence(block.confidence ?? fallback.confidence ?? 0.3)
  };
}

function normalizeHexColor(value, fallback) {
  const text = String(value || "").trim();
  return isHexColor(text) ? text : fallback;
}

function buildVideoUnderstanding(input) {
  return {
    schema_version: "video_understanding.v0.1",
    generated_by: GENERATED_BY,
    generated_at: new Date().toISOString(),
    understanding_id: input.understandingId,
    source_video: input.sourceId,
    video: {
      file_name: `${input.baseName}${path.extname(input.sourceId)}`,
      size_bytes: input.fileInfo.size,
      sha1: input.fileHash,
      metadata: input.metadata
    },
    extracted_keyframes: input.relativeFrames,
    sidecar_text_sources: input.sidecarText.map((item) => ({
      file: item.file,
      char_count: item.text.length,
      preview: item.text.slice(0, 300)
    })),
    pipeline_steps: input.pipelineSteps,
    warnings: input.warnings,
    pipeline_features: {
      stage_asset_planning: Boolean(input.generateStageAssets)
    },
    ...input.normalizedUnderstanding
  };
}

function buildGenerationBrief(videoUnderstanding) {
  const design = videoUnderstanding.creative_game_design;
  return {
    schema_version: "generation_brief.v0.1",
    generated_by: GENERATED_BY,
    generated_at: new Date().toISOString(),
    source_understanding: "video_understanding.json",
    source_video: videoUnderstanding.source_video,
    status: {
      video_understanding_ready: true,
      nine_frame_generation: "pending_user_frame_spec",
      image_generation_started: false
    },
    image_generation_channel: {
      endpoint: DRAW_FALLBACK_BASE_URL,
      candidate_models: DRAW_FALLBACK_MODELS,
      note: "本阶段只产出生成说明，不调用画图模型。"
    },
    shared_style: design.style_brief,
    scene_assets: design.scene_assets,
    conflict: design.conflict,
    taunt: design.taunt,
    player_taunts: {
      p1: design.fighters.find((fighter) => fighter.id === "p1")?.skill_taunt || design.fighters[0]?.skill_taunt,
      p2: design.fighters.find((fighter) => fighter.id === "p2")?.skill_taunt || design.fighters[1]?.skill_taunt
    },
    characters: design.fighters.map((fighter) => ({
      id: fighter.id,
      name: fighter.name,
      archetype_name: fighter.archetype_name,
      role_type: fighter.role_type,
      visual_prompt: `${fighter.visual_description}；性格/战斗气质：${fighter.personality}。`,
      form_constraints: fighter.form_constraints,
      weapon_prompt: `${fighter.weapon.name}：${fighter.weapon.description}`,
      projectile_prompt: fighter.weapon.projectile_description || "",
      weapon_source: fighter.weapon.source,
      creativity_level: fighter.weapon.creativity_level,
      attack_type: fighter.weapon.attack_type,
      evidence_frames: fighter.evidence.frames,
      skill_taunt: fighter.skill_taunt,
      prompt_seed: [
        design.style_brief.generation_prompt_base,
        fighter.visual_description,
        formatFormConstraints(fighter.form_constraints),
        fighter.weapon.description,
        fighter.weapon.projectile_description,
        fighter.skill_taunt?.text ? `skill taunt: ${fighter.skill_taunt.text}` : ""
      ].filter(Boolean).join("; ")
    })),
    constraints: [
      "后续九帧生成时保持同一角色服饰、体型、发型和武器一致。",
      "角色素材优先透明背景，动作轮廓清楚，适配小游戏白模验证。",
      "不要把武器 source=derived_from_scene 或 absurd_creative 误标为视频真实出现。"
    ]
  };
}

function buildLlmComparison(input) {
  const video = {
    file_name: `${input.baseName}${path.extname(input.sourceId)}`,
    size_bytes: input.fileInfo.size,
    sha1: input.fileHash,
    metadata: input.metadata
  };
  const providerSummaries = Object.entries(input.providerResults).map(([provider, result]) => ({
    provider,
    status: result.status,
    warnings: result.warnings,
    summary: summarizeUnderstanding(input.normalized[provider])
  }));
  return {
    schema_version: "llm_comparison.v0.1",
    generated_by: GENERATED_BY,
    generated_at: new Date().toISOString(),
    comparison_id: input.comparisonId,
    source_video: input.sourceId,
    video,
    extracted_keyframes: input.relativeFrames,
    shared_pipeline_steps: input.basePipelineSteps,
    shared_warnings: input.warnings,
    providers: providerSummaries,
    comparison_notes: [
      "Gemini path uses the Right Codes Gemini native streaming endpoint.",
      "Codex Pro path uses the Right Codes Codex Pro OpenAI-compatible chat/completions endpoint.",
      "If a provider mode is llm_text_retry or heuristic, it did not complete the same multimodal vision path."
    ]
  };
}

function summarizeUnderstanding(understanding) {
  const design = understanding.creative_game_design || {};
  const fighters = Array.isArray(design.fighters) ? design.fighters : [];
  return {
    video_summary: understanding.video_summary,
    fighters: fighters.map((fighter) => ({
      id: fighter.id,
      name: fighter.name,
      role_type: fighter.role_type,
      weapon: fighter.weapon?.name,
      attack_type: fighter.weapon?.attack_type,
      weapon_source: fighter.weapon?.source,
      creativity_level: fighter.weapon?.creativity_level,
      skill_taunt: fighter.skill_taunt?.text,
      confidence: fighter.evidence?.confidence
    })),
    conflict: design.conflict,
    taunt: design.taunt,
    style_world: design.style_brief?.world,
    scene_assets: design.scene_assets ? {
      world: design.scene_assets.world,
      background: design.scene_assets.background?.description,
      platforms: design.scene_assets.platforms?.description,
      hazards: design.scene_assets.hazards?.description
    } : undefined,
    confidence: design.confidence
  };
}

function frameRef(index, context = {}) {
  const count = Array.isArray(context.framePaths) && context.framePaths.length > 0 ? context.framePaths.length : DEFAULT_FRAME_COUNT;
  return `analysis_frames/frame_${String(clampFrameIndex(index, count)).padStart(2, "0")}.jpg`;
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 12);
}

function normalizeFrameArray(value, context) {
  const allowedCount = Array.isArray(context.framePaths) && context.framePaths.length > 0 ? context.framePaths.length : DEFAULT_FRAME_COUNT;
  const values = Array.isArray(value) ? value : [];
  const normalized = values
    .map((item) => {
      if (typeof item === "number") return frameRef(item, context);
      const text = String(item || "").trim();
      const match = text.match(/frame[_-]?(\d+)/i);
      if (match) return frameRef(Number(match[1]), context);
      if (text.startsWith("analysis_frames/")) return text;
      return "";
    })
    .filter(Boolean)
    .filter((item) => {
      const match = item.match(/frame_(\d+)\.jpg$/);
      return !match || Number(match[1]) <= allowedCount;
    });
  return normalized.length > 0 ? Array.from(new Set(normalized)).slice(0, 4) : [frameRef(1, context)];
}

function normalizeRoleType(value, fallback = "unknown") {
  const role = String(value || "").toLowerCase();
  if (["melee", "ranged", "hybrid", "unknown"].includes(role)) return role;
  return fallback;
}

function normalizeAttackType(value, fallback = "unknown") {
  const type = String(value || "").toLowerCase();
  if (["swing", "throw", "hybrid", "unknown"].includes(type)) return type;
  return fallback;
}

function normalizeSource(value, fallback = "fallback_design") {
  const source = String(value || "").toLowerCase();
  if (["observed_from_video", "derived_from_scene", "absurd_creative", "fallback_design", "dialogue_or_subtitle"].includes(source)) return source;
  return fallback;
}

function normalizeCreativity(value, fallback = "stylized") {
  const level = String(value || "").toLowerCase();
  if (["faithful", "stylized", "absurd"].includes(level)) return level;
  return fallback;
}

function averageConfidence(items) {
  if (!Array.isArray(items) || items.length === 0) return 0.5;
  return items.reduce((sum, item) => sum + clampConfidence(item.evidence?.confidence ?? item.weapon?.confidence ?? 0.5), 0) / items.length;
}

function decideMockCombatMapping(config) {
  const decision = config.mock_decision || {};
  return {
    main_characters: decision.main_characters || config.entity_candidates.slice(0, 2).map((candidate) => candidate.name),
    relationship: decision.relationship || "冲突对抗",
    p1_role: decision.p1_role || "melee",
    p1_attack_prop: decision.p1_attack_prop || findProp(config, "melee_prop") || "默认棍子",
    p2_role: decision.p2_role || "ranged",
    p2_attack_prop: decision.p2_attack_prop || findProp(config, "projectile") || "默认球体",
    taunt_text: decision.taunt_text || config.transcript_candidates[0] || "看招",
    confidence: decision.confidence ?? 0.5,
    reason: decision.reason || "mock 决策使用默认近战/远程映射。"
  };
}

function zhenhuanHeuristicAssetCrops() {
  return {
    p1_head: { frame_index: 1, box: [0.02, 0.06, 0.25, 0.42], note: "无模型 fallback：画面左侧人物头部/上身区域" },
    p1_body: { frame_index: 1, box: [0.00, 0.28, 0.30, 0.62], note: "无模型 fallback：画面左侧衣服区域" },
    p1_melee_prop: { frame_index: 1, box: [0.00, 0.55, 0.32, 0.35], note: "无模型 fallback：近战道具候选区域" },
    p1_projectile: { frame_index: 1, box: [0.02, 0.55, 0.26, 0.28], note: "无模型 fallback：角色1投掷物候选区域" },
    p2_head: { frame_index: 1, box: [0.34, 0.03, 0.36, 0.52], note: "无模型 fallback：主体头部区域" },
    p2_body: { frame_index: 1, box: [0.28, 0.36, 0.52, 0.62], note: "无模型 fallback：主体衣服区域" },
    p2_melee_prop: { frame_index: 1, box: [0.58, 0.44, 0.24, 0.32], note: "无模型 fallback：角色2近战道具候选区域" },
    p2_projectile: { frame_index: 1, box: [0.40, 0.44, 0.38, 0.34], note: "无模型 fallback：远程投掷物候选区域" },
    background: { frame_index: 1, box: [0.0, 0.0, 1.0, 1.0], note: "整帧背景" },
    taunt_bubble: { frame_index: 3, box: [0.25, 0.74, 0.50, 0.20], note: "字幕/吐槽展示区域" }
  };
}

function defaultHeuristicAssetCrops() {
  return {
    p1_head: { frame_index: 2, box: [0.10, 0.12, 0.26, 0.32], note: "无模型 fallback：左侧角色头部区域" },
    p1_body: { frame_index: 2, box: [0.05, 0.38, 0.34, 0.52], note: "无模型 fallback：左侧角色衣服区域" },
    p1_melee_prop: { frame_index: 3, box: [0.03, 0.55, 0.30, 0.30], note: "无模型 fallback：左下道具区域" },
    p1_projectile: { frame_index: 3, box: [0.03, 0.55, 0.30, 0.30], note: "无模型 fallback：左下投掷物区域" },
    p2_head: { frame_index: 2, box: [0.64, 0.12, 0.26, 0.32], note: "无模型 fallback：右侧角色头部区域" },
    p2_body: { frame_index: 2, box: [0.60, 0.38, 0.34, 0.52], note: "无模型 fallback：右侧角色衣服区域" },
    p2_melee_prop: { frame_index: 3, box: [0.67, 0.55, 0.30, 0.30], note: "无模型 fallback：右下道具区域" },
    p2_projectile: { frame_index: 3, box: [0.67, 0.55, 0.30, 0.30], note: "无模型 fallback：右下投掷物区域" },
    background: { frame_index: 1, box: [0.0, 0.0, 1.0, 1.0], note: "整帧背景" },
    taunt_bubble: { frame_index: 3, box: [0.25, 0.74, 0.50, 0.20], note: "字幕/吐槽展示区域" }
  };
}

function normalizeAssetCrops(rawCrops) {
  const defaults = defaultHeuristicAssetCrops();
  const source = rawCrops && typeof rawCrops === "object" ? rawCrops : {};
  const normalized = {};
  for (const key of Object.keys(defaults)) {
    normalized[key] = normalizeCropEntry(source[key], defaults[key]);
  }
  return normalized;
}

function normalizeCropEntry(rawEntry, fallback) {
  if (Array.isArray(rawEntry)) {
    return { ...fallback, box: normalizeCropBox(rawEntry) };
  }
  if (!rawEntry || typeof rawEntry !== "object") return fallback;
  return {
    frame_index: Math.max(1, Math.round(Number(rawEntry.frame_index || rawEntry.frame || fallback.frame_index || 1))),
    box: normalizeCropBox(rawEntry.box || rawEntry.bbox || rawEntry.bbox_norm || fallback.box),
    note: stringOr(rawEntry.note, fallback.note || "")
  };
}

function normalizeCropBox(rawBox) {
  const values = Array.isArray(rawBox) ? rawBox.map(Number) : [0, 0, 1, 1];
  const x = clamp01(values[0] ?? 0);
  const y = clamp01(values[1] ?? 0);
  const width = clamp(values[2] ?? 1, 0.04, 1);
  const height = clamp(values[3] ?? 1, 0.04, 1);
  return [
    Math.min(x, 0.98),
    Math.min(y, 0.98),
    Math.min(width, 1 - Math.min(x, 0.98)),
    Math.min(height, 1 - Math.min(y, 0.98))
  ];
}

function normalizeDecision(raw, context) {
  const decision = raw || {};
  const mainCharacters = Array.isArray(decision.main_characters) ? decision.main_characters.filter(Boolean).slice(0, 2) : [];
  while (mainCharacters.length < 2) mainCharacters.push(mainCharacters.length === 0 ? "角色A" : "角色B");

  let p1Role = decision.p1_role === "ranged" ? "ranged" : "melee";
  let p2Role = decision.p2_role === "melee" ? "melee" : "ranged";
  if (p1Role === p2Role) {
    p1Role = "melee";
    p2Role = "ranged";
  }

  return {
    display_name: stringOr(decision.display_name, context.baseName || "视频主题"),
    environment_name: stringOr(decision.environment_name, "视频场景"),
    theme_color: isHexColor(decision.theme_color) ? decision.theme_color : "#4C7A9F",
    accent_color: isHexColor(decision.accent_color) ? decision.accent_color : "#D94F30",
    main_characters: mainCharacters,
    relationship: stringOr(decision.relationship, "视频中的对抗关系"),
    p1_role: p1Role,
    p1_attack_prop: stringOr(decision.p1_attack_prop, p1Role === "melee" ? "默认棍子" : "默认球体"),
    p2_role: p2Role,
    p2_attack_prop: stringOr(decision.p2_attack_prop, p2Role === "melee" ? "默认棍子" : "默认球体"),
    taunt_text: stringOr(decision.taunt_text, context.sidecarText?.[0]?.text?.slice(0, 12) || "看招").slice(0, 24),
    transcript_candidates: Array.isArray(decision.transcript_candidates) && decision.transcript_candidates.length > 0
      ? decision.transcript_candidates
      : [stringOr(decision.taunt_text, "看招")],
    entity_candidates: Array.isArray(decision.entity_candidates) && decision.entity_candidates.length > 0
      ? decision.entity_candidates
      : mainCharacters.map((name) => ({ name, confidence: clampConfidence(decision.confidence ?? 0.5), evidence: ["LLM/VLM 决策"] })),
    prop_candidates: Array.isArray(decision.prop_candidates) && decision.prop_candidates.length > 0
      ? decision.prop_candidates
      : [
          { name: stringOr(decision.p1_attack_prop, "默认棍子"), type: p1Role === "melee" ? "melee_prop" : "projectile", confidence: clampConfidence(decision.confidence ?? 0.5) },
          { name: stringOr(decision.p2_attack_prop, "默认球体"), type: p2Role === "melee" ? "melee_prop" : "projectile", confidence: clampConfidence(decision.confidence ?? 0.5) }
        ],
    asset_crops: normalizeAssetCrops(decision.asset_crops || decision.asset_regions || defaultHeuristicAssetCrops()),
    confidence: clampConfidence(decision.confidence ?? 0.5),
    reason: stringOr(decision.reason, "根据视频关键帧、文件信息和候选文本做结构化映射。")
  };
}

function buildVideoConfig(input) {
  const decision = input.decision;
  return {
    theme_id: input.themeId,
    display_name: input.displayName,
    input: {
      type: "video",
      source_id: input.sourceId,
      title: input.displayName,
      description: "真实视频输入自动生成的主题素材包。"
    },
    environment: {
      name: decision.environment_name,
      theme_color: decision.theme_color,
      accent_color: decision.accent_color,
      fallback: "solid_color"
    },
    transcript_candidates: decision.transcript_candidates,
    entity_candidates: decision.entity_candidates,
    prop_candidates: decision.prop_candidates,
    players: {
      p1: {
        placeholder_color: "#5C6B73",
        fallback: {
          body: "whitebox_body",
          head: "whitebox_head",
          melee_prop: "default_stick",
          projectile: "default_ball"
        },
        confidence: decision.confidence
      },
      p2: {
        placeholder_color: "#8A6F3E",
        fallback: {
          body: "whitebox_body",
          head: "whitebox_head",
          melee_prop: "default_stick",
          projectile: "default_ball"
        },
        confidence: decision.confidence
      }
    },
    video_metadata: input.metadata,
    sidecar_text: input.sidecarText
  };
}

function buildManifest(config, decision) {
  const p1Name = decision.main_characters[0] || "角色A";
  const p2Name = decision.main_characters[1] || "角色B";
  const p1SkillTaunt = normalizeSkillTaunt(decision.p1_skill_taunt || decision.p1_taunt_text || decision.taunt_text, {
    text: decision.taunt_text || "看招",
    source: decision.taunt_text ? "dialogue_or_subtitle" : "fallback_design",
    speaker: p1Name,
    evidence_frames: [frameRef(1)],
    reason: "旧 mock/截图流程字段转换。",
    confidence: decision.confidence ?? 0.5,
    fallback_text: "嘿！"
  }, { fighterName: p1Name, fighterId: "p1" });
  const p2SkillTaunt = normalizeSkillTaunt(decision.p2_skill_taunt || decision.p2_taunt_text || "哼！", {
    text: "哼！",
    source: "fallback_design",
    speaker: p2Name,
    evidence_frames: [frameRef(2)],
    reason: "旧 mock/截图流程字段转换。",
    confidence: decision.confidence ?? 0.5,
    fallback_text: "哼！"
  }, { fighterName: p2Name, fighterId: "p2" });

  return {
    contract_version: CONTRACT_VERSION,
    theme_id: config.theme_id,
    display_name: config.display_name,
    source: {
      type: config.input.type,
      source_id: config.input.source_id,
      rights_mode: "mock_or_authorized"
    },
    environment: {
      name: config.environment.name,
      theme_color: config.environment.theme_color,
      accent_color: config.environment.accent_color,
      background: "assets/background.png",
      fallback: config.environment.fallback
    },
    players: {
      p1: {
        name: p1Name,
        role: decision.p1_role,
        body: "assets/p1_body.png",
        head: "assets/p1_head.png",
        melee_prop: decision.p1_role === "melee" ? "assets/p1_melee_prop.png" : null,
        projectile: decision.p1_role === "ranged" ? "assets/p1_projectile.png" : null,
        attack_prop_name: decision.p1_attack_prop,
        placeholder_color: config.players.p1.placeholder_color,
        fallback: pickFallbackForRole(config.players.p1.fallback, decision.p1_role),
        confidence: config.players.p1.confidence,
        skill_taunt: p1SkillTaunt
      },
      p2: {
        name: p2Name,
        role: decision.p2_role,
        body: "assets/p2_body.png",
        head: "assets/p2_head.png",
        melee_prop: decision.p2_role === "melee" ? "assets/p2_melee_prop.png" : null,
        projectile: decision.p2_role === "ranged" ? "assets/p2_projectile.png" : null,
        attack_prop_name: decision.p2_attack_prop,
        placeholder_color: config.players.p2.placeholder_color,
        fallback: pickFallbackForRole(config.players.p2.fallback, decision.p2_role),
        confidence: config.players.p2.confidence,
        skill_taunt: p2SkillTaunt
      }
    },
    taunt: {
      text: decision.taunt_text,
      stun_ms: 700,
      cooldown_ms: 12000,
      bubble: "assets/taunt_bubble.png",
      fallback_text: "看招",
      confidence: clampConfidence(decision.confidence),
      player_taunts: {
        p1: p1SkillTaunt,
        p2: p2SkillTaunt
      }
    },
    analysis: {
      relationship: decision.relationship,
      combat_mapping_reason: decision.reason,
      overall_confidence: clampConfidence(decision.confidence)
    }
  };
}

function pickFallbackForRole(fallback, role) {
  const base = {
    body: fallback.body || "whitebox_body",
    head: fallback.head || "whitebox_head"
  };
  if (role === "melee") return { ...base, melee_prop: fallback.melee_prop || "default_stick" };
  return { ...base, projectile: fallback.projectile || "default_ball" };
}

function buildAnalysisReport(config, decision, extras = {}) {
  const steps = extras.mode === "mock"
    ? [
        { name: "extract_video_metadata", mode: "mock", status: "skipped" },
        { name: "asr_extract_transcript", mode: "mock", status: "mocked" },
        { name: "ocr_extract_subtitles", mode: "mock", status: "mocked" },
        { name: "extract_keyframes", mode: "mock", status: "mocked" },
        { name: "detect_entities_and_props", mode: "mock", status: "mocked" },
        { name: "llm_vlm_decision", mode: "mock", status: "mocked" }
      ]
    : extras.pipelineSteps || [];

  return {
    theme_id: config.theme_id,
    input: {
      type: config.input.type,
      source_id: config.input.source_id,
      title: config.input.title,
      description: config.input.description,
      file: extras.file || undefined
    },
    video_metadata: extras.metadata || config.video_metadata || undefined,
    extracted_keyframes: extras.framePaths || undefined,
    asset_extraction: extras.assetExtraction || undefined,
    sidecar_text: config.sidecar_text || undefined,
    pipeline_steps: steps,
    transcript_candidates: config.transcript_candidates,
    entity_candidates: config.entity_candidates,
    prop_candidates: config.prop_candidates,
    llm_decision: decision,
    warnings: extras.warnings || []
  };
}

function findModelFromPipelineSteps(steps) {
  if (!Array.isArray(steps)) return undefined;
  const step = steps.find((item) => item && item.name === "llm_vlm_decision" && item.model);
  return step?.model;
}

function buildPackageStatus(packDir, manifest, upstreamWarnings = []) {
  const assets = getStatusAssetPaths(manifest).map((assetPath) => ({
    path: assetPath,
    required: false,
    exists: existsSync(path.join(packDir, assetPath)),
    fallback: getAssetFallback(manifest, assetPath)
  }));
  const missingAssets = assets.filter((asset) => !asset.exists);
  const errors = validateManifest(manifest);
  const warnings = [
    ...upstreamWarnings,
    ...missingAssets.map((asset) => `${asset.path} is missing, game should use ${asset.fallback} fallback.`)
  ];

  return {
    contract_version: CONTRACT_VERSION,
    theme_id: manifest.theme_id,
    generated_by: GENERATED_BY,
    generated_at: new Date().toISOString(),
    validation: {
      status: errors.length > 0 ? "fail" : warnings.length > 0 ? "warn" : "pass",
      can_load_in_game: errors.length === 0,
      errors,
      warnings
    },
    files: {
      manifest: "manifest.json",
      analysis_report: "analysis_report.json",
      assets
    }
  };
}

function validatePackage(packDir, manifest, status) {
  const issues = [
    ...validateManifest(manifest),
    ...validateStatus(status)
  ];

  for (const asset of status.files?.assets || []) {
    if (path.isAbsolute(asset.path)) issues.push(`asset path must be relative: ${asset.path}`);
    const actualExists = existsSync(path.join(packDir, asset.path));
    if (asset.exists !== actualExists) issues.push(`asset exists flag mismatch for ${asset.path}`);
    if (!actualExists && !asset.fallback) issues.push(`missing asset has no fallback: ${asset.path}`);
  }

  if (manifest.theme_id !== status.theme_id) issues.push("manifest theme_id must match package_status theme_id");
  return { ok: issues.length === 0, issues };
}

function validateManifest(manifest) {
  const issues = [];
  const required = ["contract_version", "theme_id", "display_name", "source", "environment", "players", "taunt"];
  for (const key of required) if (!manifest[key]) issues.push(`manifest missing ${key}`);
  if (manifest.contract_version !== CONTRACT_VERSION) issues.push(`contract_version must be ${CONTRACT_VERSION}`);
  if (!/^[a-zA-Z0-9_-]+$/.test(manifest.theme_id || "")) issues.push("theme_id must contain only letters, numbers, _ or -");
  if (!manifest.players?.p1 || !manifest.players?.p2) issues.push("manifest must contain players.p1 and players.p2");
  const roles = [manifest.players?.p1?.role, manifest.players?.p2?.role];
  if (!roles.includes("melee") || !roles.includes("ranged")) issues.push("players must include one melee and one ranged role");
  if (!manifest.taunt?.text) issues.push("taunt.text is required");
  if (!manifest.taunt?.fallback_text) issues.push("taunt.fallback_text is required");

  for (const [label, player] of Object.entries(manifest.players || {})) {
    if (!player.name) issues.push(`${label}.name is required`);
    if (!["melee", "ranged"].includes(player.role)) issues.push(`${label}.role must be melee or ranged`);
    if (!player.attack_prop_name) issues.push(`${label}.attack_prop_name is required`);
    if (!isHexColor(player.placeholder_color)) issues.push(`${label}.placeholder_color must be #RRGGBB`);
    if (player.role === "melee" && !player.melee_prop && !player.fallback?.melee_prop) {
      issues.push(`${label} melee role requires melee_prop or fallback.melee_prop`);
    }
    if (player.role === "ranged" && !player.projectile && !player.fallback?.projectile) {
      issues.push(`${label} ranged role requires projectile or fallback.projectile`);
    }
    if (player.skill_taunt) {
      if (!player.skill_taunt.text) issues.push(`${label}.skill_taunt.text is required when skill_taunt exists`);
      if (!["dialogue_or_subtitle", "observed_from_video", "derived_from_scene", "onomatopoeia", "fallback_design"].includes(player.skill_taunt.source)) {
        issues.push(`${label}.skill_taunt.source is invalid`);
      }
      for (const frame of player.skill_taunt.evidence_frames || []) {
        if (path.isAbsolute(frame)) issues.push(`${label}.skill_taunt.evidence_frames must be relative: ${frame}`);
      }
    }
  }

  if (!isHexColor(manifest.environment?.theme_color)) issues.push("environment.theme_color must be #RRGGBB");
  if (!isHexColor(manifest.environment?.accent_color)) issues.push("environment.accent_color must be #RRGGBB");

  for (const assetPath of collectManifestPaths(manifest)) {
    if (path.isAbsolute(assetPath)) issues.push(`manifest path must be relative: ${assetPath}`);
    if (assetPath.includes("\\")) issues.push(`manifest path must use slash separators: ${assetPath}`);
  }

  return issues;
}

function validateStatus(status) {
  const issues = [];
  if (status.contract_version !== CONTRACT_VERSION) issues.push(`package_status contract_version must be ${CONTRACT_VERSION}`);
  if (!status.generated_by) issues.push("package_status.generated_by is required");
  if (typeof status.validation?.can_load_in_game !== "boolean") issues.push("package_status.validation.can_load_in_game must be boolean");
  if (!["pass", "warn", "fail"].includes(status.validation?.status)) issues.push("package_status.validation.status must be pass/warn/fail");
  if (!Array.isArray(status.validation?.errors)) issues.push("package_status.validation.errors must be an array");
  if (!Array.isArray(status.validation?.warnings)) issues.push("package_status.validation.warnings must be an array");
  if (status.files?.manifest !== "manifest.json") issues.push("package_status.files.manifest must be manifest.json");
  if (status.files?.analysis_report !== "analysis_report.json") issues.push("package_status.files.analysis_report must be analysis_report.json");
  if (!Array.isArray(status.files?.assets)) issues.push("package_status.files.assets must be an array");
  return issues;
}

async function writeVideoExtractedAssets(packDir, manifest, decision, framePaths, warnings, options = {}) {
  const extraction = {
    mode: "video_frame_segment_or_crop",
    status: "ok",
    segmentation: {
      enabled: !options.noSegmentation && process.env.VIDEO_PIPELINE_DISABLE_SEGMENTATION !== "1",
      method: "auto_opencv_grabcut_or_numpy_border_foreground",
      tool: normalizePath(path.relative(ROOT_DIR, SEGMENT_CROP_SCRIPT)),
      fallback: "video_frame_crop"
    },
    draw_fallback: {
      enabled: false,
      endpoint: DRAW_FALLBACK_BASE_URL,
      candidate_models: DRAW_FALLBACK_MODELS,
      status: "reserved_not_used",
      note: "保留给视频中缺失/不可见素材的后续生成兜底；当前默认不调用 draw 替代视频截图。"
    },
    assets: []
  };

  if (!Array.isArray(framePaths) || framePaths.length === 0) {
    warnings.push("No keyframes available; generated placeholder assets instead of video crops.");
    await writeAssets(packDir, manifest);
    return {
      mode: "placeholder_fallback",
      status: "warn",
      assets: []
    };
  }

  const plan = buildVideoAssetPlan(manifest, decision.asset_crops || defaultHeuristicAssetCrops());
  for (const item of plan) {
    const frameIndex = clampFrameIndex(item.frame_index, framePaths.length);
    const sourceFrame = framePaths[frameIndex - 1];
    try {
      const outputPath = path.join(packDir, item.path);
      const segmented = shouldSegmentAsset(item, options)
        ? await trySegmentFrameToPng(sourceFrame, outputPath, item, warnings)
        : null;
      if (!segmented) {
        await cropFrameToPng(sourceFrame, outputPath, item.box, item.output_size);
      }
      extraction.assets.push({
        path: item.path,
        source: segmented ? "video_frame_segment" : "video_frame_crop",
        source_frame: normalizePath(path.relative(packDir, sourceFrame)),
        frame_index: frameIndex,
        box: item.box,
        output_size: item.output_size,
        segmentation: segmented || undefined,
        note: item.note
      });
    } catch (error) {
      extraction.status = "warn";
      warnings.push(`${item.path} video crop failed; placeholder fallback was generated: ${shortError(error)}`);
      await writePlaceholderAsset(packDir, manifest, item.path);
      extraction.assets.push({
        path: item.path,
        source: "placeholder_fallback",
        source_frame: normalizePath(path.relative(packDir, sourceFrame)),
        frame_index: frameIndex,
        box: item.box,
        output_size: item.output_size,
        note: item.note
      });
    }
  }

  return extraction;
}

function shouldSegmentAsset(item, options = {}) {
  return ["p1_head", "p1_body", "p1_melee_prop", "p1_projectile", "p2_head", "p2_body", "p2_melee_prop", "p2_projectile"].includes(item.key)
    && !isFullFrameBox(item.box)
    && !options.noSegmentation
    && process.env.VIDEO_PIPELINE_DISABLE_SEGMENTATION !== "1";
}

function isFullFrameBox(box) {
  const [x, y, width, height] = normalizeCropBox(box);
  return x <= 0.01 && y <= 0.01 && width >= 0.98 && height >= 0.98;
}

function segmentKindForAsset(item) {
  if (item.key.includes("head")) return "head";
  if (item.key.includes("body")) return "body";
  if (item.key.includes("prop") || item.key.includes("projectile")) return "prop";
  return "asset";
}

async function trySegmentFrameToPng(sourceFrame, outputPath, item, warnings) {
  if (!existsSync(SEGMENT_CROP_SCRIPT)) return null;
  const args = [
    SEGMENT_CROP_SCRIPT,
    "--input", sourceFrame,
    "--output", outputPath,
    "--box", normalizeCropBox(item.box).map((value) => String(value)).join(","),
    "--size", `${item.output_size[0]}x${item.output_size[1]}`,
    "--kind", segmentKindForAsset(item)
  ];

  try {
    const { stdout } = await execFileAsync("python", args, { maxBuffer: 8 * 1024 * 1024 });
    const metadata = parseJsonLine(stdout);
    if (metadata?.status === "ok") {
      return {
        method: metadata.method || "opencv_grabcut",
        alpha_coverage: metadata.alpha_coverage,
        output_size: metadata.output_size,
        crop_pixels: metadata.crop_pixels
      };
    }
  } catch (error) {
    warnings.push(`${item.path} segmentation failed; rectangle video crop fallback was used: ${shortError(error)}`);
  }
  return null;
}

function parseJsonLine(text) {
  const lines = String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index--) {
    try {
      return JSON.parse(lines[index]);
    } catch {
      // Keep scanning earlier lines.
    }
  }
  return null;
}

function buildVideoAssetPlan(manifest, assetCrops) {
  const crops = normalizeAssetCrops(assetCrops);
  const p1PropKey = manifest.players.p1.role === "melee" ? "p1_melee_prop" : "p1_projectile";
  const p2PropKey = manifest.players.p2.role === "melee" ? "p2_melee_prop" : "p2_projectile";
  const items = [
    { key: "background", path: manifest.environment.background, output_size: [320, 180] },
    { key: "p1_body", path: manifest.players.p1.body, output_size: [192, 256] },
    { key: "p1_head", path: manifest.players.p1.head, output_size: [160, 160] },
    { key: p1PropKey, path: manifest.players.p1.melee_prop || manifest.players.p1.projectile, output_size: [160, 160] },
    { key: "p2_body", path: manifest.players.p2.body, output_size: [192, 256] },
    { key: "p2_head", path: manifest.players.p2.head, output_size: [160, 160] },
    { key: p2PropKey, path: manifest.players.p2.melee_prop || manifest.players.p2.projectile, output_size: [160, 160] },
    { key: "taunt_bubble", path: manifest.taunt.bubble, output_size: [256, 96] }
  ];

  return items
    .filter((item) => typeof item.path === "string" && item.path.length > 0)
    .map((item) => {
      const crop = crops[item.key] || defaultHeuristicAssetCrops()[item.key] || { frame_index: 1, box: [0, 0, 1, 1], note: "" };
      return {
        ...item,
        frame_index: crop.frame_index,
        box: crop.box,
        note: crop.note || ""
      };
    });
}

async function cropFrameToPng(sourceFrame, outputPath, box, outputSize) {
  const [x, y, width, height] = normalizeCropBox(box);
  const [outputWidth, outputHeight] = outputSize;
  const filter = [
    `crop=iw*${ratio(width)}:ih*${ratio(height)}:iw*${ratio(x)}:ih*${ratio(y)}`,
    `scale=${outputWidth}:${outputHeight}:force_original_aspect_ratio=decrease`,
    `pad=${outputWidth}:${outputHeight}:(ow-iw)/2:(oh-ih)/2:color=black@0.0`,
    "format=rgba"
  ].join(",");

  await execFileAsync(getFfmpegPath(), [
    "-y",
    "-i", sourceFrame,
    "-vf", filter,
    outputPath
  ], { maxBuffer: 8 * 1024 * 1024 });
}

async function writePlaceholderAsset(packDir, manifest, assetPath) {
  const spec = placeholderSpecForAsset(assetPath, manifest);
  const png = createPlaceholderPng(spec.kind, spec.fill, spec.accent);
  await writeFile(path.join(packDir, assetPath), png);
}

function placeholderSpecForAsset(assetPath, manifest) {
  if (assetPath.includes("head")) {
    const player = assetPath.includes("p2_") ? manifest.players.p2 : manifest.players.p1;
    return { kind: "head", fill: lighten(player.placeholder_color), accent: manifest.environment.accent_color };
  }
  if (assetPath.includes("body")) {
    const player = assetPath.includes("p2_") ? manifest.players.p2 : manifest.players.p1;
    return { kind: "body", fill: player.placeholder_color, accent: manifest.environment.accent_color };
  }
  if (assetPath.includes("melee")) return { kind: "melee_prop", fill: manifest.environment.accent_color, accent: "#FFFFFF" };
  if (assetPath.includes("projectile")) return { kind: "projectile", fill: manifest.environment.theme_color, accent: manifest.environment.accent_color };
  if (assetPath.includes("bubble")) return { kind: "bubble", fill: "#FFFFFF", accent: manifest.environment.accent_color };
  return { kind: "background", fill: manifest.environment.theme_color, accent: manifest.environment.accent_color };
}

async function writeAssets(packDir, manifest) {
  const assets = [
    { path: "assets/p1_body.png", kind: "body", fill: manifest.players.p1.placeholder_color, accent: manifest.environment.accent_color },
    { path: "assets/p1_head.png", kind: "head", fill: lighten(manifest.players.p1.placeholder_color), accent: manifest.environment.accent_color },
    { path: "assets/p1_melee_prop.png", kind: "melee_prop", fill: manifest.environment.accent_color, accent: "#FFFFFF" },
    { path: "assets/p2_body.png", kind: "body", fill: manifest.players.p2.placeholder_color, accent: manifest.environment.theme_color },
    { path: "assets/p2_head.png", kind: "head", fill: lighten(manifest.players.p2.placeholder_color), accent: manifest.environment.theme_color },
    { path: "assets/p2_projectile.png", kind: "projectile", fill: manifest.environment.theme_color, accent: manifest.environment.accent_color },
    { path: "assets/background.png", kind: "background", fill: manifest.environment.theme_color, accent: manifest.environment.accent_color },
    { path: "assets/taunt_bubble.png", kind: "bubble", fill: "#FFFFFF", accent: manifest.environment.accent_color }
  ];

  for (const asset of assets) {
    const png = createPlaceholderPng(asset.kind, asset.fill, asset.accent);
    await writeFile(path.join(packDir, asset.path), png);
  }
}

function createPlaceholderPng(kind, fillHex, accentHex, requestedWidth = 0, requestedHeight = 0) {
  const width = requestedWidth || (kind === "background" ? 320 : 128);
  const height = requestedHeight || (kind === "background" ? 180 : 128);
  const fill = hexToRgb(fillHex);
  const accent = hexToRgb(accentHex);
  const white = [255, 255, 255, 255];
  const transparent = [0, 0, 0, kind === "background" ? 255 : 0];
  const pixels = Array.from({ length: height }, () => Array.from({ length: width }, () => transparent.slice()));

  if (kind === "background") {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) pixels[y][x] = lerpColor(fill, accent, x / width * 0.3);
    }
    rect(pixels, 0, Math.floor(height * 0.68), width, Math.floor(height * 0.32), darken(fillHex, 0.55));
    rect(pixels, 0, Math.floor(height * 0.68), width, 4, accent);
  } else if (kind === "platform_strip") {
    const y = Math.floor(height * 0.28);
    const h = Math.max(24, Math.floor(height * 0.48));
    const margin = Math.max(4, Math.floor(width * 0.03));
    roundedRect(pixels, margin, y, width - margin * 2, h, Math.floor(h * 0.42), fill);
    rect(pixels, margin, y, width - margin * 2, Math.max(4, Math.floor(h * 0.18)), accent);
    roundedRect(pixels, margin, y + Math.floor(h * 0.08), Math.max(24, Math.floor(width * 0.18)), h, Math.floor(h * 0.45), accent);
    roundedRect(pixels, width - margin - Math.max(24, Math.floor(width * 0.18)), y + Math.floor(h * 0.08), Math.max(24, Math.floor(width * 0.18)), h, Math.floor(h * 0.45), accent);
  } else if (kind === "platform_left" || kind === "platform_mid" || kind === "platform_right") {
    const y = Math.floor(height * 0.52);
    const h = Math.max(18, Math.floor(height * 0.18));
    const cap = Math.floor(width * 0.18);
    const x0 = kind === "platform_left" ? Math.floor(width * 0.22) : Math.floor(width * 0.08);
    const x1 = kind === "platform_right" ? Math.floor(width * 0.78) : Math.floor(width * 0.92);
    roundedRect(pixels, x0, y, x1 - x0, h, Math.floor(h * 0.4), fill);
    rect(pixels, x0, y, x1 - x0, Math.max(4, Math.floor(h * 0.18)), accent);
    if (kind === "platform_left") roundedRect(pixels, x0 - cap, y + Math.floor(h * 0.1), cap + 8, h, Math.floor(h * 0.45), accent);
    if (kind === "platform_right") roundedRect(pixels, x1 - 8, y + Math.floor(h * 0.1), cap + 8, h, Math.floor(h * 0.45), accent);
  } else if (kind === "hazard_debris") {
    const cx = Math.floor(width * 0.5);
    const cy = Math.floor(height * 0.55);
    const r = Math.floor(Math.min(width, height) * 0.18);
    polygon(pixels, [[cx - r, cy + r], [cx - Math.floor(r * 0.7), cy - r], [cx + Math.floor(r * 0.9), cy - Math.floor(r * 0.75)], [cx + r, cy + Math.floor(r * 0.8)]], fill);
    polygon(pixels, [[cx - Math.floor(r * 0.45), cy + Math.floor(r * 0.55)], [cx, cy - Math.floor(r * 0.6)], [cx + Math.floor(r * 0.55), cy + Math.floor(r * 0.2)]], accent);
  } else if (kind === "body") {
    ellipse(pixels, 64, 68, 34, 46, fill);
    rect(pixels, 35, 100, 58, 12, accent);
    rect(pixels, 45, 106, 10, 16, fill);
    rect(pixels, 73, 106, 10, 16, fill);
  } else if (kind === "head") {
    ellipse(pixels, 64, 64, 36, 36, fill);
    ellipse(pixels, 52, 58, 4, 4, accent);
    ellipse(pixels, 76, 58, 4, 4, accent);
    rect(pixels, 54, 78, 20, 4, accent);
  } else if (kind === "melee_prop") {
    polygon(pixels, [[54, 104], [66, 104], [82, 24], [74, 20]], accent);
    rect(pixels, 49, 98, 28, 8, fill);
    rect(pixels, 56, 104, 8, 20, darken(fillHex, 0.55));
  } else if (kind === "projectile") {
    ellipse(pixels, 64, 64, 36, 36, fill);
    rect(pixels, 30, 61, 68, 6, accent);
    rect(pixels, 61, 30, 6, 68, accent);
  } else if (kind === "bubble") {
    roundedRect(pixels, 16, 30, 96, 54, 16, white);
    polygon(pixels, [[44, 82], [58, 82], [46, 100]], white);
    rect(pixels, 34, 52, 60, 6, accent);
    rect(pixels, 34, 66, 42, 6, accent);
  }

  return encodePng(width, height, pixels);
}

function encodePng(width, height, pixels) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  let offset = 0;
  for (let y = 0; y < height; y++) {
    raw[offset++] = 0;
    for (let x = 0; x < width; x++) {
      const pixel = pixels[y][x];
      raw[offset++] = pixel[0];
      raw[offset++] = pixel[1];
      raw[offset++] = pixel[2];
      raw[offset++] = pixel[3];
    }
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    pngChunk("IHDR", Buffer.concat([u32(width), u32(height), Buffer.from([8, 6, 0, 0, 0])])),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const crcInput = Buffer.concat([typeBuffer, data]);
  return Buffer.concat([u32(data.length), typeBuffer, data, u32(crc32(crcInput))]);
}

function crc32(buffer) {
  let crc = 0xFFFFFFFF;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function u32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value >>> 0);
  return buffer;
}

function rect(pixels, x, y, width, height, color) {
  for (let yy = Math.max(0, y); yy < Math.min(pixels.length, y + height); yy++) {
    for (let xx = Math.max(0, x); xx < Math.min(pixels[0].length, x + width); xx++) pixels[yy][xx] = color.slice();
  }
}

function roundedRect(pixels, x, y, width, height, radius, color) {
  for (let yy = y; yy < y + height; yy++) {
    for (let xx = x; xx < x + width; xx++) {
      const dx = Math.max(x - xx + radius, 0, xx - (x + width - radius - 1));
      const dy = Math.max(y - yy + radius, 0, yy - (y + height - radius - 1));
      if (dx * dx + dy * dy <= radius * radius) setPixel(pixels, xx, yy, color);
    }
  }
}

function ellipse(pixels, cx, cy, rx, ry, color) {
  for (let y = cy - ry; y <= cy + ry; y++) {
    for (let x = cx - rx; x <= cx + rx; x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) setPixel(pixels, x, y, color);
    }
  }
}

function polygon(pixels, points, color) {
  const minY = Math.floor(Math.min(...points.map((point) => point[1])));
  const maxY = Math.ceil(Math.max(...points.map((point) => point[1])));
  for (let y = minY; y <= maxY; y++) {
    const intersections = [];
    for (let i = 0; i < points.length; i++) {
      const [x1, y1] = points[i];
      const [x2, y2] = points[(i + 1) % points.length];
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) intersections.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
    }
    intersections.sort((a, b) => a - b);
    for (let i = 0; i < intersections.length; i += 2) {
      rect(pixels, Math.floor(intersections[i]), y, Math.ceil(intersections[i + 1] - intersections[i]), 1, color);
    }
  }
}

function setPixel(pixels, x, y, color) {
  if (y >= 0 && y < pixels.length && x >= 0 && x < pixels[0].length) pixels[y][x] = color.slice();
}

function lerpColor(a, b, amount) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * amount),
    Math.round(a[1] + (b[1] - a[1]) * amount),
    Math.round(a[2] + (b[2] - a[2]) * amount),
    255
  ];
}

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
    255
  ];
}

function lighten(hex) {
  const rgb = hexToRgb(hex);
  return toHex([
    Math.min(255, Math.round(rgb[0] + (255 - rgb[0]) * 0.35)),
    Math.min(255, Math.round(rgb[1] + (255 - rgb[1]) * 0.35)),
    Math.min(255, Math.round(rgb[2] + (255 - rgb[2]) * 0.35)),
    255
  ]);
}

function darken(hex, amount) {
  const rgb = hexToRgb(hex);
  return [
    Math.max(0, Math.round(rgb[0] * amount)),
    Math.max(0, Math.round(rgb[1] * amount)),
    Math.max(0, Math.round(rgb[2] * amount)),
    255
  ];
}

function toHex(rgb) {
  return `#${rgb.slice(0, 3).map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function getAssetFallback(manifest, assetPath) {
  if (String(assetPath || "").startsWith("assets/stage/")) return manifest.stage_assets?.fallback || "stage_template";
  const key = assetFallbackKeys[assetPath];
  if (!key) return null;
  if (key[0] === "environment") return manifest.environment.fallback;
  if (key[0] === "taunt") return "default_taunt_bubble";
  return manifest.players[key[0]].fallback[key[1]] || null;
}

function collectManifestPaths(manifest) {
  const paths = [
    manifest.environment?.background,
    manifest.players?.p1?.body,
    manifest.players?.p1?.head,
    manifest.players?.p1?.melee_prop,
    manifest.players?.p1?.projectile,
    manifest.players?.p2?.body,
    manifest.players?.p2?.head,
    manifest.players?.p2?.melee_prop,
    manifest.players?.p2?.projectile,
    manifest.taunt?.bubble,
    ...(manifest.stage_assets?.files ? Object.values(manifest.stage_assets.files) : [])
  ];
  return paths.filter((value) => typeof value === "string");
}

function getStatusAssetPaths(manifest) {
  const paths = collectManifestPaths(manifest);
  return Array.from(new Set(paths));
}

function findProp(config, type) {
  return config.prop_candidates.find((candidate) => candidate.type === type)?.name;
}

async function loadLocalPrivateEnv() {
  const candidates = [
    path.join(os.homedir(), ".hei-ke-song", "right-codes.env"),
    path.join(ROOT_DIR, ".env.local")
  ];
  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    try {
      const text = await readFile(candidate, "utf8");
      for (const rawLine of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;
        const eq = line.indexOf("=");
        if (eq <= 0) continue;
        const key = line.slice(0, eq).trim();
        const value = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
        if (key && value && !process.env[key]) process.env[key] = value;
      }
    } catch {
      // Local private env is optional; environment variables can still provide values.
    }
  }
}

function firstEnv(names) {
  for (const name of names || []) {
    if (process.env[name]) return process.env[name];
  }
  return "";
}

function validateUnderstandingDocument(doc) {
  const issues = [];
  if (doc.schema_version !== "video_understanding.v0.1") issues.push("schema_version must be video_understanding.v0.1");
  if (path.isAbsolute(doc.source_video || "")) issues.push("source_video must be relative");
  if (!Array.isArray(doc.extracted_keyframes) || doc.extracted_keyframes.length === 0) issues.push("extracted_keyframes must be a non-empty array");
  for (const frame of doc.extracted_keyframes || []) {
    if (path.isAbsolute(frame)) issues.push(`keyframe path must be relative: ${frame}`);
  }
  const fighters = doc.creative_game_design?.fighters;
  if (!Array.isArray(fighters) || fighters.length !== 2) issues.push("creative_game_design.fighters must contain exactly two fighters");
  for (const fighter of fighters || []) {
    if (!fighter.id || !fighter.name) issues.push("fighter must include id and name");
    if (!["melee", "ranged", "hybrid", "unknown"].includes(fighter.role_type)) issues.push(`invalid role_type for ${fighter.id || "fighter"}`);
    if (!fighter.visual_description) issues.push(`fighter ${fighter.id || ""} missing visual_description`);
    if (!fighter.weapon?.name) issues.push(`fighter ${fighter.id || ""} missing weapon.name`);
    if (!["swing", "throw", "hybrid", "unknown"].includes(fighter.weapon?.attack_type)) issues.push(`invalid attack_type for ${fighter.id || "fighter"}`);
    if (!["observed_from_video", "derived_from_scene", "absurd_creative", "fallback_design"].includes(fighter.weapon?.source)) {
      issues.push(`invalid weapon.source for ${fighter.id || "fighter"}`);
    }
    if (fighter.skill_taunt) {
      if (!fighter.skill_taunt.text) issues.push(`fighter ${fighter.id || ""} missing skill_taunt.text`);
      if (!["dialogue_or_subtitle", "observed_from_video", "derived_from_scene", "onomatopoeia", "fallback_design"].includes(fighter.skill_taunt.source)) {
        issues.push(`invalid skill_taunt.source for ${fighter.id || "fighter"}`);
      }
      for (const frame of fighter.skill_taunt.evidence_frames || []) {
        if (path.isAbsolute(frame)) issues.push(`fighter skill_taunt evidence frame must be relative: ${frame}`);
      }
    }
    for (const frame of fighter.evidence?.frames || []) {
      if (path.isAbsolute(frame)) issues.push(`fighter evidence frame must be relative: ${frame}`);
    }
  }
  if (!doc.creative_game_design?.style_brief?.generation_prompt_base) issues.push("style_brief.generation_prompt_base missing");
  issues.push(...validateSceneAssetEvidencePaths(doc.creative_game_design?.scene_assets, "creative_game_design.scene_assets"));
  return issues;
}

function validateGenerationBriefDocument(doc) {
  const issues = [];
  if (doc.schema_version !== "generation_brief.v0.1") issues.push("generation_brief schema_version invalid");
  if (path.isAbsolute(doc.source_video || "")) issues.push("generation_brief source_video must be relative");
  if (doc.status?.nine_frame_generation !== "pending_user_frame_spec") issues.push("nine_frame_generation should remain pending_user_frame_spec");
  if (!Array.isArray(doc.characters) || doc.characters.length !== 2) issues.push("generation_brief.characters must contain exactly two characters");
  for (const character of doc.characters || []) {
    if (character.skill_taunt) {
      if (!character.skill_taunt.text) issues.push(`generation_brief character ${character.id || ""} missing skill_taunt.text`);
      for (const frame of character.skill_taunt.evidence_frames || []) {
        if (path.isAbsolute(frame)) issues.push(`generation_brief skill_taunt evidence frame must be relative: ${frame}`);
      }
    }
  }
  issues.push(...validateSceneAssetEvidencePaths(doc.scene_assets, "generation_brief.scene_assets"));
  return issues;
}

function validateSceneAssetEvidencePaths(sceneAssets, label) {
  const issues = [];
  if (!sceneAssets || typeof sceneAssets !== "object") return issues;
  for (const key of ["background", "platforms", "hazards"]) {
    const block = sceneAssets[key];
    if (!block || typeof block !== "object") continue;
    for (const frame of block.evidence_frames || []) {
      if (path.isAbsolute(frame)) issues.push(`${label}.${key}.evidence_frames must be relative: ${frame}`);
    }
  }
  return issues;
}

function parseOptions(args) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--video") options.video = args[++i];
    else if (arg === "--input-dir") options.inputDir = args[++i];
    else if (arg === "--theme-id") options.themeId = args[++i];
    else if (arg === "--theme") options.theme = args[++i];
    else if (arg === "--understanding") {
      const value = args[++i];
      if (!options.understanding) options.understanding = [];
      if (Array.isArray(options.understanding)) options.understanding.push(value);
      else options.understanding = [options.understanding, value];
    }
    else if (arg === "--understanding-id") options.understandingId = args[++i];
    else if (arg === "--display-name") options.displayName = args[++i];
    else if (arg === "--model") options.model = args[++i];
    else if (arg === "--draw-model") options.drawModel = args[++i];
    else if (arg === "--draw-base-url") options.drawBaseUrl = args[++i];
    else if (arg === "--draw-size") options.drawSize = args[++i];
    else if (arg === "--draw-timeout-ms") options.drawTimeoutMs = Number(args[++i]);
    else if (arg === "--draw-retries") options.drawRetries = Number(args[++i]);
    else if (arg === "--draw-retry-delay-ms") options.drawRetryDelayMs = Number(args[++i]);
    else if (arg === "--draw-concurrency") options.drawConcurrency = Number(args[++i]);
    else if (arg === "--frames") options.frames = Number(args[++i]);
    else if (arg === "--reuse-analysis-report") options.reuseAnalysisReport = args[++i];
    else if (arg === "--tap-fight-dir") options.tapFightDir = args[++i];
    else if (arg === "--stage-template") options.stageTemplate = args[++i];
    else if (arg === "--no-registry") options.noRegistry = true;
    else if (arg === "--export-tap-fight") options.exportTapFight = true;
    else if (arg === "--generate-stage-assets") options.generateStageAssets = true;
    else if (arg === "--no-llm") options.noLlm = true;
    else if (arg === "--no-draw") options.noDraw = true;
    else if (arg === "--allow-fallback") options.allowFallback = true;
    else if (arg === "--safe-remix") options.safeRemix = true;
    else if (arg === "--force-understanding") options.forceUnderstanding = true;
    else if (arg === "--strict-llm") options.strictLlm = true;
    else if (arg === "--strict-draw") options.strictDraw = true;
    else if (arg === "--no-segmentation") options.noSegmentation = true;
    else throw new Error(`Unknown option: ${arg}\n${usage}`);
  }
  return options;
}

function getFfmpegPath() {
  try {
    const installer = require("@ffmpeg-installer/ffmpeg");
    if (installer?.path) return installer.path;
  } catch {
    // Fall through to other ffmpeg providers.
  }
  try {
    const ffmpegPath = require("ffmpeg-static");
    if (ffmpegPath) return ffmpegPath;
  } catch {
    // Fall through to system ffmpeg.
  }
  return "ffmpeg";
}

function getFfprobePath() {
  return require("ffprobe-static").path;
}

function parseFps(value) {
  if (!value || value === "0/0") return null;
  const [num, den] = String(value).split("/").map(Number);
  if (!den) return num || null;
  return Math.round((num / den) * 1000) / 1000;
}

async function hashFile(filePath) {
  const bytes = await readFile(filePath);
  return createHash("sha1").update(bytes).digest("hex");
}

function makeThemeId(baseName, hash) {
  const normalized = baseName
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const prefix = normalized || "video";
  return `${prefix}_${hash.slice(0, 8)}`.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function makeUnderstandingId(baseName, hash) {
  return `understanding_${makeThemeId(baseName, hash)}`;
}

function clampConfidence(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0.5;
  return Math.max(0, Math.min(1, number));
}

function clamp(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, number));
}

function clamp01(value) {
  return clamp(value, 0, 1);
}

function clampFrameIndex(value, frameCount) {
  return Math.max(1, Math.min(frameCount, Math.round(Number(value) || 1)));
}

function ratio(value) {
  return Number(value).toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}

function isHexColor(value) {
  return /^#[0-9A-Fa-f]{6}$/.test(value || "");
}

function stringOr(value, fallback) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizePath(value) {
  return value.split(path.sep).join("/");
}

function isPathInside(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === "" || (relative && !relative.startsWith("..") && !path.isAbsolute(relative));
}

function toDisplayPath(value) {
  return normalizePath(path.relative(process.cwd(), path.resolve(value))) || ".";
}

function shortError(error) {
  return String(error?.message || error).replace(/\s+/g, " ").slice(0, 300);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
