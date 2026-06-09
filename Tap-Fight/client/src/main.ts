// @ts-nocheck
import { io } from "socket.io-client";
import { gestureControls } from "./gestureControls";

const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");

const keys = new Set();
let currentThemeId = "office_battle_001";
let opponentThemeId = currentThemeId;
let scoreData = { matchStartTime: 0, damageDealt: 0 };
let bgmAudio = null;

function playBGM(bgmPath) {
  stopBGM();
  if (!bgmPath) return;
  bgmAudio = new Audio(bgmPath);
  bgmAudio.loop = true;
  bgmAudio.volume = 0.5;
  bgmAudio.play().catch(() => {});
}

function stopBGM() {
  if (bgmAudio) {
    bgmAudio.pause();
    bgmAudio.src = "";
    bgmAudio = null;
  }
}

// ============== 视频入口（抖音风格） ==============
const videoOverlay = document.querySelector("#videoOverlay");
const videoPlayer = document.querySelector("#videoPlayer");
const videoThemeName = document.querySelector("#videoThemeName");
const videoThemeDesc = document.querySelector("#videoThemeDesc");
const btnEnterGame = document.querySelector("#btnEnterGame");
const btnSound = document.querySelector("#btnSound");
const soundIcon = document.querySelector("#soundIcon");
const soundLabel = document.querySelector("#soundLabel");
const dyProgressBar = document.querySelector("#dyProgressBar");

const videoPlaylist = [
  { src: "./videos/办公室.mp4", themeId: "office_battle_001", bgm: "./bgm/office.mp3", name: "🏢 办公室大作战", desc: "战士 vs 射手 · 文件夹投掷" },
  { src: "./videos/星球大战.mp4", themeId: "original_space_duelist_001", bgm: "./bgm/space.mp3", name: "🌌 星际剑士训练场", desc: "剑士 vs 训练者 · 能量球" },
];

let currentVideoIndex = -1;
let videoSoundEnabled = false;

function makePreloadVideo(v) {
  const el = document.createElement("video");
  el.preload = "auto";
  el.muted = true;
  el.playsInline = true;
  el.src = v.src;
  el.load();
  return el;
}

// 预加载所有视频
const preloadVideos = videoPlaylist.map(makePreloadVideo);

async function loadThemeRegistry() {
  try {
    const response = await fetch("./theme_registry.json", { cache: "no-store" });
    if (!response.ok) return;
    const registry = await response.json();
    const themes = Array.isArray(registry?.themes) ? registry.themes : [];
    for (const item of themes) {
      if (!item?.themeId || !item?.src) continue;
      const entry = {
        src: item.src,
        themeId: item.themeId,
        bgm: item.bgm || null,
        name: item.name || item.themeId,
        desc: item.desc || item.themeId,
      };
      const existingIndex = videoPlaylist.findIndex((v) => v.themeId === entry.themeId);
      if (existingIndex >= 0) {
        videoPlaylist[existingIndex] = { ...videoPlaylist[existingIndex], ...entry };
        preloadVideos[existingIndex] = makePreloadVideo(entry);
      } else {
        videoPlaylist.push(entry);
        preloadVideos.push(makePreloadVideo(entry));
      }
    }
  } catch (error) {
    console.warn("theme_registry.json load skipped", error);
  }
}

function showVideo(index) {
  if (index < 0) index = videoPlaylist.length - 1;
  if (index >= videoPlaylist.length) index = 0;
  currentVideoIndex = index;
  const v = videoPlaylist[index];
  // 如果视频已加载，直接切；否则等加载
  if (videoPlayer.src !== v.src) {
    videoPlayer.src = v.src;
  }
  videoThemeName.textContent = v.name;
  videoThemeDesc.textContent = `🎵 ${v.desc}`;
  videoPlayer.currentTime = 0;
  if (!videoSoundEnabled) {
    videoPlayer.muted = true;
  }
  videoPlayer.play().catch(() => {});
  syncCurrentVideoSound();
  // 立即显示封面图，隐藏视频空白
  const coverEl = document.querySelector("#videoCover");
  const coverName = v.src?.split("/").pop()?.replace(".mp4", ".jpg");
  const coverSrc = `./covers/${coverName}`;
  coverEl.src = coverSrc;
  coverEl.classList.remove("hidden");
  // 预加载相邻视频
  const nextIdx = (index + 1) % videoPlaylist.length;
  preloadVideos[nextIdx].load();
  // 后台预加载当前主题素材
  currentThemeId = v.themeId;
  loadCurrentTheme();
}

function playNextVideo() { showVideo(currentVideoIndex + 1); }
function playPrevVideo() { showVideo(currentVideoIndex - 1); }
function playRandomVideo() { showVideo(Math.floor(Math.random() * videoPlaylist.length)); }

function getCurrentVideoEntry() {
  return currentVideoIndex >= 0 ? videoPlaylist[currentVideoIndex] : null;
}

function syncSoundButton() {
  btnSound.classList.toggle("sound-on", videoSoundEnabled);
  btnSound.setAttribute("aria-label", videoSoundEnabled ? "关闭视频原声" : "开启视频原声");
  soundIcon.textContent = videoSoundEnabled ? "🔊" : "🔇";
  soundLabel.textContent = videoSoundEnabled ? "原声" : "静音";
}

function syncCurrentVideoSound() {
  if (videoOverlay.classList.contains("hidden")) {
    videoPlayer.muted = true;
    syncSoundButton();
    return;
  }

  if (!videoSoundEnabled) {
    videoPlayer.muted = true;
    stopBGM();
    syncSoundButton();
    return;
  }

  stopBGM();
  videoPlayer.muted = false;
  videoPlayer.volume = 0.85;
  videoPlayer.play().catch(() => {});
  syncSoundButton();
}

function setVideoSoundEnabled(enabled) {
  videoSoundEnabled = enabled;
  syncCurrentVideoSound();
}

function stopVideoFeedPlayback() {
  videoPlayer.pause();
  videoPlayer.muted = true;
  stopBGM();
}

// 进度条
function updateProgressBar() {
  if (videoPlayer.duration) {
    dyProgressBar.style.width = `${(videoPlayer.currentTime / videoPlayer.duration) * 100}%`;
  }
}
videoPlayer.addEventListener("timeupdate", updateProgressBar);

// 可拖动进度条
const dyProgress = document.querySelector(".dy-progress");
let isDragging = false;

dyProgress.addEventListener("pointerdown", (e) => {
  isDragging = true;
  dyProgress.setPointerCapture(e.pointerId);
  seekProgress(e);
});

dyProgress.addEventListener("pointermove", (e) => {
  if (isDragging) seekProgress(e);
});

dyProgress.addEventListener("pointerup", () => { isDragging = false; });
dyProgress.addEventListener("pointercancel", () => { isDragging = false; });

function seekProgress(e) {
  const rect = dyProgress.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  videoPlayer.currentTime = ratio * videoPlayer.duration;
  updateProgressBar();
}

// 滑动切换
let touchStartY = 0, touchStartX = 0;
videoOverlay.addEventListener("touchstart", (e) => {
  touchStartY = e.touches[0].clientY;
  touchStartX = e.touches[0].clientX;
}, { passive: true });

videoOverlay.addEventListener("touchend", (e) => {
  const dy = e.changedTouches[0].clientY - touchStartY;
  const absDy = Math.abs(dy), absDx = Math.abs(e.changedTouches[0].clientX - touchStartX);
  if (absDy > 60 && absDy > absDx) {
    dy < 0 ? playNextVideo() : playPrevVideo();
  }
});

window.addEventListener("keydown", (e) => {
  if (videoOverlay.classList.contains("hidden")) return;
  if (e.key === "ArrowDown") { e.preventDefault(); playNextVideo(); }
  if (e.key === "ArrowUp") { e.preventDefault(); playPrevVideo(); }
});

// ❤️ 点赞交互
const btnLike = document.querySelector("#btnLike");
const likeIcon = document.querySelector("#likeIcon");
const likeCount = document.querySelector("#likeCount");
let isLiked = false;

btnLike.addEventListener("click", () => {
  isLiked = !isLiked;
  if (isLiked) {
    likeIcon.textContent = "❤️";
    likeCount.textContent = "1k";
    btnLike.classList.add("liked");
    setTimeout(() => btnLike.classList.remove("liked"), 400);
  } else {
    likeIcon.textContent = "🤍";
    likeCount.textContent = "999";
  }
});

// ⭐ 收藏交互
const btnStar = document.querySelector("#btnStar");
const starIcon = document.querySelector("#starIcon");
const starCount = document.querySelector("#starCount");
let isStarred = false;

btnStar.addEventListener("click", () => {
  isStarred = !isStarred;
  if (isStarred) {
    starIcon.textContent = "🌟";
    starCount.textContent = "已收藏";
    btnStar.classList.add("starred");
    setTimeout(() => btnStar.classList.remove("starred"), 400);
  } else {
    starIcon.textContent = "⭐";
    starCount.textContent = "收藏";
  }
});

btnSound.addEventListener("click", (event) => {
  event.stopPropagation();
  setVideoSoundEnabled(!videoSoundEnabled);
});
syncSoundButton();

// 双击点亮红心
let lastTapTime = 0;
videoOverlay.addEventListener("click", (e) => {
  const now = Date.now();
  if (now - lastTapTime < 300) {
    // 双击
    if (!isLiked) { likeIcon.textContent = "❤️"; likeCount.textContent = "1k"; isLiked = true; }
    spawnHeart(e.clientX, e.clientY);
  }
  lastTapTime = now;
});

function spawnHeart(x, y) {
  const heart = document.createElement("div");
  heart.className = "float-heart";
  heart.textContent = "❤️";
  heart.style.left = `${x}px`;
  heart.style.top = `${y}px`;
  document.body.appendChild(heart);
  heart.addEventListener("animationend", () => heart.remove());
}

const menuThemeHint = document.querySelector("#menuThemeHint");

btnEnterGame.addEventListener("click", () => {
  currentThemeId = videoPlaylist[currentVideoIndex].themeId;
  menuThemeHint.textContent = `🎬 ${videoPlaylist[currentVideoIndex].name}`;
  stopVideoFeedPlayback();
  videoOverlay.classList.add("hidden");
  menuOverlay.classList.remove("hidden");
  startQuickMatch();
});

videoPlayer.addEventListener("ended", () => {
  playNextVideo();
});

// 视频缓冲指示 + 封面切换
const videoCover = document.querySelector("#videoCover");
videoPlayer.addEventListener("waiting", () => {
  videoPlayer.style.opacity = "0.6";
  if (videoCover) videoCover.classList.remove("hidden");
});
videoPlayer.addEventListener("canplay", () => {
  videoPlayer.style.opacity = "1";
});
videoPlayer.addEventListener("playing", () => {
  if (videoCover) videoCover.classList.add("hidden");
});

loadThemeRegistry().finally(playRandomVideo);

// 后台预加载所有主题素材
async function preloadAllThemes() {
  const loaded = new Set([currentThemeId]);
  for (const v of videoPlaylist) {
    if (loaded.has(v.themeId)) continue;
    loaded.add(v.themeId);
    const root = `./theme_packs/${v.themeId}`;
    try {
      const resp = await fetch(`${root}/manifest.json`);
      if (!resp.ok) continue;
      const manifest = await resp.json();
      const stageAssets = ["platform_left.png", "platform_mid.png", "platform_right.png", manifest.environment?.background].filter(Boolean);
      for (const a of stageAssets) { const img = new Image(); img.src = `${root}/${a}`; }
      for (const role of ["p1", "p2"]) {
        const mResp = await fetch(`${root}/animation_preview/${role}_animation_manifest.json`).catch(() => null);
        if (!mResp?.ok) continue;
        const m = await mResp.json();
        const frames = Object.values(m.animations || {}).flatMap(c => c.frames || []);
        for (const f of frames) { const img = new Image(); img.src = `${root}/animation_preview/${f}`; }
      }
    } catch (e) {}
    await new Promise(r => setTimeout(r, 200));
  }
}
setTimeout(preloadAllThemes, 3000);

// ============== 网络状态 ==============
// Vite 开发时代理 /socket.io 到 3000，生产部署同源直连
const SERVER_URL = window.location.origin;

const network = {
  socket: null,
  roomId: null,
  myRole: null,
  scene: "menu",
  lastSendTime: 0,
  matchmaking: false,
};

const remotePlayer = {
  x: 420, y: 812, vx: 0, vy: 0,
  facing: -1, grounded: true,
  state: "idle", hp: 10, attacking: false,
  skillSeq: 0,
  skillText: "",
};

const world = {
  width: canvas.width,
  height: canvas.height,
  gravity: 2300,
  floorY: 812,
  respawnX: 150,
  respawnY: 960,
};

const player = {
  x: world.respawnX,
  y: world.respawnY,
  vx: 0,
  vy: 0,
  width: 42,
  height: 96,
  facing: 1,
  grounded: true,
  moveSpeed: 510,
  jumpSpeed: 900,
  color: "#d9c39a",
  outline: "#1d242c",
  accent: "#56c7ff",
  state: "idle",
  attackUntil: 0,
  attackDamageMultiplier: 1,
  skillSeq: 0,
  skillUntil: 0,
  skillCooldownUntil: 0,
  skillBubbleUntil: 0,
  skillText: "",
  stunnedUntil: 0,
  hp: 10,
  maxHp: 10,
  hurtUntil: 0,
};

const opponent = {
  x: 420,
  y: world.floorY,
  vx: 0,
  vy: 0,
  width: 46,
  height: 104,
  facing: -1,
  grounded: true,
  moveSpeed: 300,
  jumpSpeed: 880,
  color: "#30343b",
  outline: "#171717",
  accent: "#f85149",
  state: "idle",
  attackUntil: 0,
  attackDamageMultiplier: 1,
  skillSeq: 0,
  skillUntil: 0,
  skillCooldownUntil: 0,
  skillBubbleUntil: 0,
  skillText: "",
  stunnedUntil: 0,
  hp: 10,
  maxHp: 10,
  hurtUntil: 0,
};

function createThemeBundle() {
  return {
    id: null,
    manifest: null,
    images: new Map(),
    loadState: "loading",
  };
}

const theme = createThemeBundle();
const DEFAULT_PROJECTILE_IMAGE = "animation_preview/frames/p2_projectile/projectile_0.png";

const animations = {
  p1: createAnimationState(),
  p2: createAnimationState(),
};

const remoteTheme = createThemeBundle();

const remoteAnimations = {
  p1: createAnimationState(),
  p2: createAnimationState(),
};

function createAnimationState() {
  return {
    manifest: null,
    images: new Map(),
    loadState: "loading",
  };
}

// ============== 上升平台模式 ==============
const stage = {
  config: null,
  platforms: [],
  hazards: [],
  matchStartTime: 0,
  nextSpawnIdx: 0,
  deathFloorY: 960,
};

const SPLIT_VIEW_CONFIG = {
  triggerDelayMs: 10000,
  transitionMs: 1800,
};

const splitView = {
  debugForcedAt: 0,
};

const VOICE_SKILL_CONFIG = {
  stunMs: 1500,
  castMs: 900,
  bubbleMs: 1900,
  defaultCooldownMs: 12000,
  transcriptKeepMs: 3500,
};

const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition || null;
const voiceSecureContext = window.isSecureContext || window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

const voiceSkill = {
  recognition: null,
  supported: Boolean(SpeechRecognitionCtor) && voiceSecureContext,
  listening: false,
  restarting: false,
  recentTranscript: "",
  lastTranscriptAt: 0,
  lastCastSeq: 0,
  status: "idle",
  panel: null,
  promptEl: null,
  statusEl: null,
  buttonEl: null,
};

const skillEffects = [];

// 确定性 hash（保证两台设备生成相同平台布局）
function hashSeed(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

async function loadStageConfig() {
  try {
    const res = await fetch("./stage_config.json");
    stage.config = await res.json();
  } catch (e) {
    console.warn("Stage config failed", e);
    stage.config = null;
  }
}

function buildStagePlatforms() {
  stage.platforms = [];
  stage.nextSpawnIdx = 0;
  stage.deathFloorY = stage.config?.death_floor_start_y ?? 960;

  // 起始平台：两人各一块，从底部出发
  const cfg = stage.config;
  if (cfg) {
    const startY = getInitialPlatformY();
    stage.platforms.push({ x: 60, y: startY, w: 180, h: cfg.platform_height, kind: "platform" });
    stage.platforms.push({ x: 300, y: startY, w: 180, h: cfg.platform_height, kind: "platform" });
    stage.nextSpawnIdx = 2;
  }
}

function getInitialPlatformY() {
  const deathFloorStart = stage.config?.death_floor_start_y ?? 1020;
  return Math.min(deathFloorStart - 60, world.height - 72);
}

function updateStage(dt, now) {
  const cfg = stage.config;
  if (!cfg || !stage.matchStartTime) return;
  const elapsed = (now - stage.matchStartTime) / 1000;
  const speed = cfg.rise_speed;

  // 所有平台上升
  for (let i = stage.platforms.length - 1; i >= 0; i--) {
    const p = stage.platforms[i];
    p.y -= speed * dt;
    // 超出天花板就删掉
    if (p.y < cfg.ceiling_y - 60) {
      stage.platforms.splice(i, 1);
      continue;
    }
  }

  // 站在平台上的角色跟着上升
  for (const ch of [player, opponent]) {
    // 检查是否在任一平台上
    let onAnyPlatform = false;
    for (const p of stage.platforms) {
      const footOnPlatform = Math.abs(ch.y - p.y) < 6;
      const inXRange = ch.x > p.x - 10 && ch.x < p.x + p.w + 10;
      if (footOnPlatform && inXRange) {
        onAnyPlatform = true;
        break;
      }
    }
    if (onAnyPlatform) {
      ch.y -= speed * dt;
      ch.grounded = true;
    } else if (ch.grounded && ch === opponent && network.socket?.connected) {
      // 对手的 grounded 状态可能过期，强制跟随最近的平台
      let closestDist = Infinity;
      for (const p of stage.platforms) {
        if (ch.x > p.x - 20 && ch.x < p.x + p.w + 20) {
          const d = Math.abs(ch.y - p.y);
          if (d < closestDist) { closestDist = d; }
        }
      }
      if (closestDist < 30) {
        ch.y -= speed * dt;
        ch.grounded = true;
      }
    }
  }

  // 新平台从底部冒出（左右交替）
  const spawnInterval = cfg.platform_spawn_interval_s;
  const nextSpawnTime = stage.nextSpawnIdx * spawnInterval;
  if (elapsed >= nextSpawnTime) {
    const idx = stage.nextSpawnIdx;
    const w = cfg.platform_width_min + hashSeed(idx) * (cfg.platform_width_max - cfg.platform_width_min);
    // 左右交替
    const side = idx % 2 === 0 ? 0 : 1;
    const x = side === 0
      ? 20 + hashSeed(idx + 0.3) * (world.width / 2 - w - 40)
      : world.width / 2 + hashSeed(idx + 0.3) * (world.width / 2 - w - 40);
    stage.platforms.push({
      x, y: cfg.platform_min_y + hashSeed(idx + 0.7) * 30,
      w, h: cfg.platform_height,
      kind: "platform",
    });
    stage.nextSpawnIdx++;
  }

  // 死亡地板上升
  stage.deathFloorY -= cfg.death_floor_rise_speed * dt;

  // 天上掉落物
  if (!stage._lastHazardTime) stage._lastHazardTime = now;
  if (now - stage._lastHazardTime > 4000) {
    stage._lastHazardTime = now;
    const hx = 30 + Math.random() * (world.width - 60);
    stage.hazards.push({ x: hx, y: -20, vy: 45 + Math.random() * 30, size: 14 + Math.random() * 12, damage: 1 });
  }
  for (let i = stage.hazards.length - 1; i >= 0; i--) {
    const h = stage.hazards[i];
    h.y += h.vy * dt;
    if (h.y > world.height + 50) { stage.hazards.splice(i, 1); continue; }
    for (const target of [player, opponent]) {
      if (target.hurtUntil > now || target.hp <= 0) continue;
      const dx = target.x - h.x;
      const dy = (target.y - target.height / 2) - h.y;
      if (Math.abs(dx) < h.size + 20 && Math.abs(dy) < h.size + 20) {
        target.hp = Math.max(0, target.hp - h.damage);
        target.hurtUntil = now + 500;
        spawnParticles(h.x, h.y, 6, { color: "#ff6644", speed: 200, life: 0.4, size: 3, spread: Math.PI, gravity: 200 });
        stage.hazards.splice(i, 1);
        break;
      }
    }
  }

  // 撞天花板即死 / 碰死亡地板即死
  for (const ch of [player, opponent]) {
    if (ch.hp <= 0) continue;
    const headY = ch.y - ch.height;
    if (headY <= cfg.ceiling_y) {
      ch.hp = 0;
      spawnParticles(ch.x, cfg.ceiling_y, 15, { color: "#ff0000", speed: 300, life: 0.6, size: 5, spread: Math.PI, gravity: 100 });
    }
    if (ch.y >= stage.deathFloorY) {
      ch.hp = 0;
      spawnParticles(ch.x, stage.deathFloorY, 15, { color: "#ff4400", speed: 300, life: 0.6, size: 5, spread: Math.PI, gravity: 100 });
    }
  }
}

const projectiles = [];
const projectileConfig = {
  speed: 520,
  width: 92,
  height: 34,
  lifetime: 1.8,
};

// ============== 粒子特效系统 ==============
const particles = [];
const SLASH_TRAIL = [];

function spawnParticles(x, y, count, opts = {}) {
  const {
    color = "#ffffff",
    speed = 200,
    life = 0.4,
    size = 3,
    spread = Math.PI * 2,
    gravity = 0,
  } = opts;
  for (let i = 0; i < count; i++) {
    const angle = (Math.random() - 0.5) * spread;
    const spd = speed * (0.5 + Math.random());
    particles.push({
      x, y,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd - Math.random() * 100,
      life, maxLife: life,
      size: size * (0.6 + Math.random() * 0.8),
      color, gravity,
    });
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += p.gravity * dt;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
  // 斩击拖尾淡出
  for (let i = SLASH_TRAIL.length - 1; i >= 0; i--) {
    SLASH_TRAIL[i].life -= dt;
    if (SLASH_TRAIL[i].life <= 0) SLASH_TRAIL.splice(i, 1);
  }
}

function drawParticles() {
  for (const p of particles) {
    const alpha = p.life / p.maxLife;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // 斩击拖尾
  for (const s of SLASH_TRAIL) {
    const alpha = s.life / s.maxLife;
    ctx.save();
    ctx.globalAlpha = alpha * 0.6;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.shadowColor = s.color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(s.x1, s.y1);
    ctx.lineTo(s.x2, s.y2);
    ctx.stroke();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function getLocalRoleId() {
  return network.myRole === "p2" ? "p2" : "p1";
}

function getRemoteRoleId() {
  return network.myRole === "p2" ? "p1" : "p2";
}

function getSkillText(roleId, themeBundle = theme) {
  return themeBundle.manifest?.players?.[roleId]?.skill_taunt?.text
    ?? themeBundle.manifest?.taunt?.player_taunts?.[roleId]?.text
    ?? themeBundle.manifest?.taunt?.text
    ?? themeBundle.manifest?.players?.[roleId]?.attack_prop_name
    ?? "看招";
}

function getSkillCooldownMs(themeBundle = theme) {
  const cooldown = Number(themeBundle.manifest?.taunt?.cooldown_ms);
  return Number.isFinite(cooldown) && cooldown > 0 ? cooldown : VOICE_SKILL_CONFIG.defaultCooldownMs;
}

function normalizeVoiceText(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[，。！？、,.!?'"“”‘’「」《》（）()\[\]{}:：;；\s]/g, "")
    .replace(/大喊|喊出|释放|发动|使用|放技能|放招|技能|眩晕对手|眩晕|对手/g, "");
}

function hasVoiceSkillIntent(text) {
  return /大喊|喊|技能|放招|释放|发动|眩晕|晕|看招/.test(String(text ?? ""));
}

function getLcsRatio(a, b) {
  if (!a || !b) return 0;
  const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length] / Math.max(1, b.length);
}

function getSkillMatchTargets(skillText) {
  const targets = [skillText];
  const normalized = normalizeVoiceText(skillText);
  if (normalized.length > 4) {
    targets.push(normalized.slice(0, Math.ceil(normalized.length * 0.75)));
    targets.push(normalized.slice(Math.floor(normalized.length * 0.25)));
  }
  return Array.from(new Set(targets.map(normalizeVoiceText).filter(Boolean)));
}

function isSkillVoiceMatch(transcript, skillText) {
  const said = normalizeVoiceText(transcript);
  if (!said) return false;

  for (const target of getSkillMatchTargets(skillText)) {
    if (!target) continue;
    if (said.includes(target)) return true;
    if (target.length > 3 && said.length >= Math.ceil(target.length * 0.6) && target.includes(said)) return true;

    const ratio = getLcsRatio(said, target);
    if (target.length <= 3) {
      if (hasVoiceSkillIntent(transcript) && ratio >= 0.75) return true;
    } else if (target.length <= 6) {
      if (ratio >= 0.62) return true;
    } else if (ratio >= 0.56) {
      return true;
    }
  }

  return false;
}

function ensureVoiceSkillUi() {
  if (voiceSkill.panel) return;

  const panel = document.createElement("div");
  panel.className = "voice-skill-panel hidden";

  const prompt = document.createElement("div");
  prompt.className = "voice-skill-prompt";

  const row = document.createElement("div");
  row.className = "voice-skill-row";

  const status = document.createElement("div");
  status.className = "voice-skill-status";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "voice-skill-button";
  button.innerHTML = `
    <span class="voice-mic-icon" aria-hidden="true">
      <span class="voice-mic-wave voice-mic-wave-a"></span>
      <span class="voice-mic-wave voice-mic-wave-b"></span>
      <span class="voice-mic-core"></span>
      <span class="voice-mic-stem"></span>
    </span>
  `;
  button.setAttribute("aria-label", "开启语音技能");
  button.addEventListener("click", () => {
    if (voiceSkill.listening) {
      stopVoiceSkillRecognition();
      return;
    }
    startVoiceSkillRecognition();
  });

  row.append(status, button);
  panel.append(prompt, row);
  document.body.appendChild(panel);

  voiceSkill.panel = panel;
  voiceSkill.promptEl = prompt;
  voiceSkill.statusEl = status;
  voiceSkill.buttonEl = button;
  refreshVoiceSkillUi();
}

function setVoiceSkillStatus(status) {
  voiceSkill.status = status;
  if (voiceSkill.statusEl) {
    voiceSkill.statusEl.textContent = status;
  }
}

function refreshVoiceSkillUi(now = performance.now()) {
  ensureVoiceSkillUi();
  const inBattle = network.scene === "battle";
  voiceSkill.panel.classList.toggle("hidden", !inBattle);
  if (!inBattle) return;

  const skillText = getSkillText(getLocalRoleId(), theme);
  voiceSkill.promptEl.textContent = `大喊「${skillText}」，眩晕对手！`;

  const cooldownLeft = Math.max(0, player.skillCooldownUntil - now);
  voiceSkill.buttonEl.disabled = !voiceSkill.supported;
  voiceSkill.buttonEl.classList.toggle("is-listening", voiceSkill.listening);
  voiceSkill.buttonEl.classList.toggle("is-cooling", cooldownLeft > 0);

  if (!voiceSkill.supported) {
    setVoiceSkillStatus("语音需要 HTTPS 或 localhost 环境");
  } else if (cooldownLeft > 0) {
    setVoiceSkillStatus(`冷却 ${Math.ceil(cooldownLeft / 1000)}s`);
  } else if (voiceSkill.listening) {
    setVoiceSkillStatus("正在听");
  } else {
    setVoiceSkillStatus("点按麦克风后喊出技能语句");
  }
}

function startVoiceSkillRecognition() {
  ensureVoiceSkillUi();
  if (!voiceSkill.supported) {
    setVoiceSkillStatus("语音需要 HTTPS 或 localhost 环境");
    return;
  }
  if (voiceSkill.listening) return;

  try {
    if (!voiceSkill.recognition) {
      const recognition = new SpeechRecognitionCtor();
      recognition.lang = "zh-CN";
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 5;
      recognition.onresult = handleVoiceSkillResult;
      recognition.onerror = (event) => {
        console.warn("[voice skill] recognition error", event.error);
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          voiceSkill.listening = false;
          voiceSkill.restarting = false;
        }
        setVoiceSkillStatus(event.error === "not-allowed" ? "麦克风权限未开启" : "语音识别暂不可用");
        refreshVoiceSkillUi();
      };
      recognition.onend = () => {
        if (!voiceSkill.listening) {
          refreshVoiceSkillUi();
          return;
        }
        if (voiceSkill.restarting) return;
        voiceSkill.restarting = true;
        setTimeout(() => {
          voiceSkill.restarting = false;
          if (!voiceSkill.listening || !voiceSkill.recognition) return;
          try {
            voiceSkill.recognition.start();
          } catch (error) {
            console.warn("[voice skill] restart failed", error);
          }
        }, 260);
      };
      voiceSkill.recognition = recognition;
    }

    voiceSkill.listening = true;
    voiceSkill.recentTranscript = "";
    voiceSkill.lastTranscriptAt = 0;
    voiceSkill.recognition.start();
    refreshVoiceSkillUi();
  } catch (error) {
    console.warn("[voice skill] start failed", error);
    voiceSkill.listening = false;
    setVoiceSkillStatus("语音识别启动失败");
  }
}

function stopVoiceSkillRecognition() {
  voiceSkill.listening = false;
  voiceSkill.restarting = false;
  try {
    voiceSkill.recognition?.abort();
  } catch (error) {
    console.warn("[voice skill] stop failed", error);
  }
  refreshVoiceSkillUi();
}

function handleVoiceSkillResult(event) {
  const now = performance.now();
  if (now - voiceSkill.lastTranscriptAt > VOICE_SKILL_CONFIG.transcriptKeepMs) {
    voiceSkill.recentTranscript = "";
  }
  voiceSkill.lastTranscriptAt = now;

  const candidates = [];
  for (let index = event.resultIndex; index < event.results.length; index += 1) {
    const result = event.results[index];
    for (let alt = 0; alt < Math.min(result.length, 5); alt += 1) {
      const transcript = result[alt]?.transcript ?? "";
      if (transcript) candidates.push(transcript);
    }
  }

  const merged = candidates.join("");
  if (merged) {
    voiceSkill.recentTranscript = `${voiceSkill.recentTranscript}${merged}`.slice(-120);
  }

  for (const candidate of [...candidates, voiceSkill.recentTranscript]) {
    if (tryCastVoiceSkillFromTranscript(candidate)) break;
  }
  refreshVoiceSkillUi(now);
}

function tryCastVoiceSkillFromTranscript(transcript) {
  if (network.scene !== "battle") return false;
  const skillText = getSkillText(getLocalRoleId(), theme);
  if (!isSkillVoiceMatch(transcript, skillText)) return false;
  return castLocalVoiceSkill(skillText);
}

function castLocalVoiceSkill(skillText) {
  const now = performance.now();
  if (now < player.skillCooldownUntil) return false;

  player.skillSeq += 1;
  player.skillUntil = now + VOICE_SKILL_CONFIG.castMs;
  player.skillCooldownUntil = now + getSkillCooldownMs(theme);
  player.skillBubbleUntil = now + VOICE_SKILL_CONFIG.bubbleMs;
  player.skillText = skillText;
  player.attackUntil = Math.max(player.attackUntil, now + 220);

  applySkillStun(opponent, now);
  spawnVoiceSkillEffect(player, opponent, skillText, theme);
  voiceSkill.recentTranscript = "";
  setVoiceSkillStatus("技能触发");
  return true;
}

function applySkillStun(target, now = performance.now()) {
  target.stunnedUntil = Math.max(target.stunnedUntil ?? 0, now + VOICE_SKILL_CONFIG.stunMs);
  target.attackUntil = 0;
  target.vx = 0;
}

function applyRemoteVoiceSkill(skillSeq, skillText) {
  if (network.scene !== "battle") return;
  const now = performance.now();
  const text = skillText || getSkillText(getRemoteRoleId(), shouldUseRemoteCharacterTheme(now) ? remoteTheme : theme);
  opponent.skillSeq = skillSeq;
  opponent.skillUntil = now + VOICE_SKILL_CONFIG.castMs;
  opponent.skillBubbleUntil = now + VOICE_SKILL_CONFIG.bubbleMs;
  opponent.skillText = text;
  opponent.attackUntil = Math.max(opponent.attackUntil, now + 220);
  applySkillStun(player, now);
  spawnVoiceSkillEffect(opponent, player, text, shouldUseRemoteCharacterTheme(now) ? remoteTheme : theme);
}

function spawnVoiceSkillEffect(caster, target, text, themeBundle = theme) {
  const color = themeBundle.manifest?.environment?.accent_color
    ?? themeBundle.manifest?.environment?.theme_color
    ?? "#78d7ff";
  skillEffects.push({
    x: target.x,
    y: target.y - target.height * 0.55,
    life: 0.72,
    maxLife: 0.72,
    color,
  });
  spawnParticles(caster.x, caster.y - caster.height * 0.7, 14, { color, speed: 260, life: 0.42, size: 4, spread: Math.PI * 2, gravity: 40 });
  spawnParticles(target.x, target.y - target.height * 0.55, 18, { color: "#f7d35b", speed: 190, life: 0.56, size: 3.5, spread: Math.PI * 2, gravity: 20 });
}

function updateSkillEffects(dt) {
  for (let index = skillEffects.length - 1; index >= 0; index -= 1) {
    const effect = skillEffects[index];
    effect.life -= dt;
    if (effect.life <= 0) skillEffects.splice(index, 1);
  }
}

function drawVoiceSkillEffects(now = performance.now()) {
  for (const effect of skillEffects) {
    const progress = 1 - effect.life / effect.maxLife;
    const radius = 28 + progress * 92;
    const alpha = Math.max(0, effect.life / effect.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = effect.color;
    ctx.lineWidth = 5 - progress * 3;
    ctx.shadowColor = effect.color;
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(effect.x, effect.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  drawStunIndicators(now);
  drawSkillBubbles(now);
}

function drawStunIndicators(now) {
  for (const model of [player, opponent]) {
    if (model.stunnedUntil <= now) continue;
    const remain = Math.max(0, model.stunnedUntil - now);
    const cx = model.x;
    const cy = model.y - model.height - 22;
    const pulse = Math.sin(now / 90) * 0.18 + 1;
    ctx.save();
    ctx.strokeStyle = "rgba(255, 220, 90, 0.9)";
    ctx.fillStyle = "rgba(255, 235, 130, 0.85)";
    ctx.lineWidth = 3;
    ctx.shadowColor = "#ffe066";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 28 * pulse, 9 * pulse, 0, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 3; i += 1) {
      const angle = now / 240 + i * ((Math.PI * 2) / 3);
      ctx.beginPath();
      ctx.arc(cx + Math.cos(angle) * 28, cy + Math.sin(angle) * 8, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${(remain / 1000).toFixed(1)}s`, cx, cy - 18);
    ctx.restore();
  }
}

function drawSkillBubbles(now) {
  for (const model of [player, opponent]) {
    if (model.skillBubbleUntil <= now || !model.skillText) continue;
    drawSkillBubble(model, model.skillText, now);
  }
}

function drawSkillBubble(model, text, now) {
  ctx.save();
  ctx.font = "bold 15px sans-serif";
  const maxWidth = 250;
  const lines = wrapCanvasText(text, maxWidth - 24);
  const lineHeight = 19;
  const width = Math.min(maxWidth, Math.max(108, ...lines.map((line) => ctx.measureText(line).width + 24)));
  const height = lines.length * lineHeight + 18;
  const x = clamp(model.x - width / 2, 10, canvas.width - width - 10);
  const y = clamp(model.y - model.height - height - 46, 18, canvas.height - height - 18);
  const alpha = Math.min(1, Math.max(0, (model.skillBubbleUntil - now) / 220));

  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(8, 12, 18, 0.86)";
  roundedRect(x, y, width, height, 8);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 230, 120, 0.85)";
  ctx.lineWidth = 2;
  roundedRect(x, y, width, height, 8);
  ctx.stroke();

  ctx.fillStyle = "#fff3a8";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  lines.forEach((line, index) => {
    ctx.fillText(line, x + width / 2, y + 9 + index * lineHeight);
  });
  ctx.restore();
}

function wrapCanvasText(text, maxWidth) {
  const chars = Array.from(String(text ?? ""));
  const lines = [];
  let line = "";
  for (const char of chars) {
    const next = `${line}${char}`;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = char;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines.slice(0, 3) : [""];
}

const playerInput = {
  get left() {
    return keys.has("KeyA") || keys.has("a");
  },
  get right() {
    return keys.has("KeyD") || keys.has("d");
  },
  get jump() {
    return keys.has("KeyW") || keys.has("w") || keys.has("Space") || keys.has(" ");
  },
  get attack() {
    return keys.has("KeyJ") || keys.has("j") || gestureControls.attack;
  },
};

const opponentInput = {
  get left() {
    return keys.has("ArrowLeft") || keys.has("arrowleft");
  },
  get right() {
    return keys.has("ArrowRight") || keys.has("arrowright");
  },
  get jump() {
    return keys.has("ArrowUp") || keys.has("arrowup");
  },
  get attack() {
    return keys.has("KeyK") || keys.has("k") || keys.has("Enter") || keys.has("enter") || keys.has("/") || keys.has("Slash") || keys.has("NumpadEnter");
  },
};

let lastTime = performance.now();
const inputMemory = {
  p1: { jumpWasDown: false, attackWasDown: false },
  p2: { jumpWasDown: false, attackWasDown: false },
};

window.addEventListener("keydown", (event) => {
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "Space"].includes(event.code)) {
    event.preventDefault();
  }

  keys.add(event.code);
  keys.add(event.key.toLowerCase());

  if (event.code === "KeyR") {
    respawnPlayer();
    respawnOpponent();
  }
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
  keys.delete(event.key.toLowerCase());
});

document.querySelectorAll(".touch-left button, .touch-right button").forEach((button) => {
  const code = button.dataset.code;
  const key = button.dataset.key;

  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);

    if (button.dataset.action === "respawn") {
      respawnPlayer();
      return;
    }

    keys.add(code);
    keys.add(key);
  });

  const release = () => {
    if (!code || !key) return;
    keys.delete(code);
    keys.delete(key);
  };

  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("lostpointercapture", release);
});

// ============== 菜单 & 房间 ==============
const menuOverlay = document.querySelector("#menuOverlay");
const menuStatus = document.querySelector("#menuStatus");
const matchCount = document.querySelector("#matchCount");
const matchHint = document.querySelector("#matchHint");
const btnQuickMatch = document.querySelector("#btnQuickMatch");
const touchLeft = document.querySelector(".touch-left");
const touchRight = document.querySelector(".touch-right");

const endOverlay = document.querySelector("#endOverlay");
const endTitle = document.querySelector("#endTitle");
const endSub = document.querySelector("#endSub");
const scoreDetails = document.querySelector("#scoreDetails");
const btnBack = document.querySelector("#btnBack");

touchLeft.style.display = "none";
touchRight.style.display = "none";

function connectServer() {
  if (network.socket) return;
  network.socket = io(SERVER_URL);

  network.socket.on("connect", () => {
    console.log("[net] connected", network.socket.id);
    if (network.matchmaking) {
      network.socket.emit("quick_match", { themeId: currentThemeId });
    }
  });

  network.socket.on("connect_error", () => {
    if (network.matchmaking) {
      updateMatchmakingUi(0, "匹配服务连接中");
    }
  });

  network.socket.on("error_msg", (msg) => {
    menuStatus.textContent = msg;
    network.matchmaking = false;
    updateMatchmakingUi();
  });

  network.socket.on("room_created", ({ roomId }) => {
    network.roomId = roomId;
    network.myRole = "p1";
    menuStatus.textContent = "等待对手加入...";
  });

  network.socket.on("match_waiting", (data = {}) => {
    network.matchmaking = true;
    network.myRole = "p1";
    const availableOpponents = Math.max(0, Number(data.availableOpponents ?? 0));
    updateMatchmakingUi(availableOpponents, "正在等待对手进入");
  });

  network.socket.on("match_cancelled", () => {
    network.matchmaking = false;
    network.roomId = null;
    network.myRole = null;
    updateMatchmakingUi(0, "已取消匹配");
  });

  network.socket.on("game_begin", (data) => {
    if (network.scene !== "loading") return;
    network.scene = "battle";
    // 使用服务器时间对齐，减去当前本地时间偏移
    const serverNow = data?.serverNow || Date.now();
    const offset = Date.now() - serverNow;
    stage.matchStartTime = performance.now() - offset;
  });

  network.socket.on("match_start", (data) => {
    network.matchmaking = false;
    if (data.role) {
      network.myRole = data.role;
    } else if (!network.myRole) {
      network.myRole = "p2";
    }
    network.roomId = data.roomId;
    const localRoleId = getLocalRoleId();
    const remoteRoleId = getRemoteRoleId();
    currentThemeId = data?.[localRoleId]?.themeId || currentThemeId;
    opponentThemeId = data?.[remoteRoleId]?.themeId || currentThemeId;
    scoreData = { matchStartTime: performance.now(), damageDealt: 0 };
    gameOverHandled = false;
    hasSentReady = false;
    if (scoreDetails) scoreDetails.innerHTML = "";
    network.scene = "loading";
    menuOverlay.classList.add("hidden");
    touchLeft.style.display = "flex";
    touchRight.style.display = "flex";
    loadCurrentTheme();
    resetRemoteTheme();
    if (opponentThemeId && opponentThemeId !== currentThemeId) {
      loadRemoteTheme(opponentThemeId);
    }
    resetMatchSkillState();
    setupRole();
    buildStagePlatforms();
    const v = videoPlaylist.find(vp => vp.themeId === currentThemeId);
    if (v?.bgm) playBGM(v.bgm);
    stage.hazards = [];
    stage._lastHazardTime = 0;
    splitView.debugForcedAt = 0;
    const startY = getInitialPlatformY();
    player.y = startY;
    opponent.y = startY;
    player.grounded = true;
    opponent.grounded = true;
    player.vy = 0;
    opponent.vy = 0;
    // 不立即开始，等双方就绪
    stage.matchStartTime = 0;
    updateMatchmakingUi(0, "匹配成功");
  });

  network.socket.on("opponent_snapshot", (data) => {
    if (data.themeId) {
      opponentThemeId = data.themeId;
      loadRemoteTheme(data.themeId);
    }
    remotePlayer.x = data.x;
    remotePlayer.y = data.y;
    remotePlayer.vx = data.vx;
    remotePlayer.vy = data.vy;
    remotePlayer.facing = data.facing;
    remotePlayer.state = data.state;
    remotePlayer.grounded = data.grounded;
    remotePlayer.attacking = data.attacking;
    if (Number(data.skillSeq) > (remotePlayer.skillSeq ?? 0)) {
      remotePlayer.skillSeq = Number(data.skillSeq);
      remotePlayer.skillText = data.skillText || "";
      applyRemoteVoiceSkill(remotePlayer.skillSeq, remotePlayer.skillText);
    }
    if (data.hp !== undefined) opponent.hp = data.hp;
  });

  network.socket.on("opponent_hit", (data) => {
    player.hp = data.targetHp;
    player.hurtUntil = performance.now() + 300;
  });

  network.socket.on("opponent_left", () => {
    // 对局中对手离开 → 显示胜利
    if (network.scene === "battle" && !gameOverHandled) {
      stopBGM();
      gameOverHandled = true;
      network.scene = "gameover";
      endTitle.textContent = "🏆 你赢了！";
      endSub.innerHTML = "对手已离开";
      endOverlay.classList.remove("hidden");
      touchLeft.style.display = "none";
      touchRight.style.display = "none";
      const leftRoomId = network.roomId;
      if (leftRoomId) {
        setTimeout(() => { network.socket?.emit("leave_room", leftRoomId); }, 2000);
      }
      return;
    }
    network.scene = "menu";
    menuOverlay.classList.add("hidden");
    videoOverlay.classList.remove("hidden");
    touchLeft.style.display = "none";
    touchRight.style.display = "none";
    network.roomId = null;
    network.myRole = null;
    network.matchmaking = false;
    updateMatchmakingUi();
    playRandomVideo();
  });

  network.socket.on("disconnect", () => {
    console.log("[net] disconnected");
    network.scene = "menu";
    menuOverlay.classList.add("hidden");
    videoOverlay.classList.remove("hidden");
    touchLeft.style.display = "none";
    touchRight.style.display = "none";
    network.roomId = null;
    network.myRole = null;
    network.matchmaking = false;
    updateMatchmakingUi(0, "连接断开，正在返回视频入口");
    playRandomVideo();
  });
}

function setupRole() {
  if (network.myRole === "p1") {
    // p1 = 近战在左，不需要改动
    return;
  }
  // p2 = 远程在右：交换 player 和 opponent 的所有属性
  const px = player.x, py = player.y, pf = player.facing;
  const ox = opponent.x, oy = opponent.y, of = opponent.facing;

  player.x = ox; player.y = oy; player.facing = of;
  const tmpSpeed = player.moveSpeed;
  player.moveSpeed = opponent.moveSpeed;
  opponent.moveSpeed = tmpSpeed;
  const tmpJump = player.jumpSpeed;
  player.jumpSpeed = opponent.jumpSpeed;
  opponent.jumpSpeed = tmpJump;

  opponent.x = px; opponent.y = py; opponent.facing = pf;
}

function updateMatchmakingUi(availableOpponents = 0, hint = null) {
  if (matchCount) {
    matchCount.textContent = String(Math.max(0, availableOpponents));
  }
  if (matchHint) {
    matchHint.textContent = hint ?? "凑齐 2 人自动开局";
  }
  if (btnQuickMatch) {
    btnQuickMatch.textContent = network.matchmaking ? "取消匹配" : "自动匹配";
    btnQuickMatch.classList.toggle("is-matching", network.matchmaking);
  }
  if (menuStatus) {
    menuStatus.textContent = network.matchmaking
      ? `正在自动匹配 · 可对战人数 ${Math.max(0, availableOpponents)}`
      : (hint ?? "");
  }
}

function startQuickMatch() {
  connectServer();
  network.scene = "menu";
  network.roomId = null;
  network.myRole = null;
  network.matchmaking = true;
  updateMatchmakingUi(0, "正在进入匹配池");
  if (network.socket.connected) {
    network.socket.emit("quick_match", { themeId: currentThemeId });
  }
}

function cancelQuickMatch() {
  if (network.socket?.connected) {
    network.socket.emit("cancel_quick_match");
  }
  network.matchmaking = false;
  network.roomId = null;
  network.myRole = null;
  updateMatchmakingUi(0, "已取消匹配");
}

btnQuickMatch.addEventListener("click", () => {
  if (network.matchmaking) {
    cancelQuickMatch();
    return;
  }
  startQuickMatch();
});

updateMatchmakingUi(0, "点击自动匹配，凑齐 2 人开局");

// ============== 网络同步 ==============
let hasSentReady = false;

function checkReadyToStart(now) {
  const localReady = theme.loadState === "ready" && animations.p1.loadState !== "loading" && animations.p2.loadState !== "loading";
  const remoteReady = opponentThemeId === currentThemeId || (remoteTheme.loadState !== "loading" && remoteAnimations.p1.loadState !== "loading" && remoteAnimations.p2.loadState !== "loading");
  if (localReady && remoteReady && !hasSentReady && network.socket?.connected) {
    hasSentReady = true;
    network.socket.emit("ready_to_start", { roomId: network.roomId });
  }
  // 画加载画面
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#0a0f1e";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const progressText = localReady && remoteReady ? "等待对手就绪..." : "加载素材中...";
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = "18px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(progressText, canvas.width / 2, canvas.height / 2);
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.font = "13px sans-serif";
  const dots = ".".repeat((Math.floor(now / 500) % 3) + 1);
  ctx.fillText(dots, canvas.width / 2, canvas.height / 2 + 30);
}

function syncNetwork(now) {
  if (network.scene !== "battle" || !network.socket) return;
  if (now - network.lastSendTime < 50) return;
  network.lastSendTime = now;

  network.socket.emit("input_snapshot", {
    roomId: network.roomId,
    x: player.x, y: player.y,
    vx: player.vx, vy: player.vy,
    facing: player.facing, grounded: player.grounded,
    state: player.state, attacking: player.attackUntil > now,
    hp: player.hp,
    themeId: currentThemeId,
    skillSeq: player.skillSeq,
    skillText: player.skillText,
  });
}

let remoteWasAttacking = false;

let gameOverHandled = false;

const KNOWN_THEME_UNIVERSE_NAMES = {
  office_battle_001: "办公室宇宙",
  original_space_duelist_001: "星际宇宙",
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getThemeUniverseName(themeId, themeBundle = null) {
  const manifest = themeBundle?.id === themeId ? themeBundle.manifest : null;
  const manifestName = manifest?.display_name || manifest?.environment?.name || manifest?.name;
  const playlistName = videoPlaylist.find((item) => item.themeId === themeId)?.name;
  return manifestName || playlistName || KNOWN_THEME_UNIVERSE_NAMES[themeId] || themeId || "未知宇宙";
}

function getScoreParts(won, elapsedSec, damageDealt, hp) {
  const baseScore = won ? 500 : 0;
  const survivalScore = elapsedSec * 5;
  const damageScore = Math.max(0, damageDealt) * 30;
  const hpScore = Math.max(0, hp) * 20;
  return {
    baseScore,
    survivalScore,
    damageScore,
    hpScore,
    totalScore: baseScore + survivalScore + damageScore + hpScore,
  };
}

function submitMatchResult(payload) {
  if (network.socket?.connected && network.myRole !== "p1") return;
  fetch("/api/match-result", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch((error) => {
    console.warn("[leaderboard] submit failed", error);
  });
}

function checkGameOverWithSettlement() {
  if (gameOverHandled) return;
  if (player.hp > 0 && opponent.hp > 0) return;

  gameOverHandled = true;
  stopBGM();
  network.scene = "gameover";
  touchLeft.style.display = "none";
  touchRight.style.display = "none";

  const won = opponent.hp <= 0;
  const startedAt = scoreData.matchStartTime || stage.matchStartTime || performance.now();
  const elapsedSec = Math.max(0, Math.round((performance.now() - startedAt) / 1000));
  const myHp = Math.max(0, Math.round(player.hp));
  const oppHp = Math.max(0, Math.round(opponent.hp));
  const myRoleId = getLocalRoleId();
  const remoteRoleId = getRemoteRoleId();
  const myName = getThemePlayer(myRoleId, theme)?.name ?? "你";
  const oppName = getRemoteThemePlayer(remoteRoleId)?.name ?? "对手";
  const myUniverse = getThemeUniverseName(currentThemeId, theme);
  const oppUniverse = getThemeUniverseName(opponentThemeId, remoteTheme.loadState === "ready" ? remoteTheme : null);
  const myScore = getScoreParts(won, elapsedSec, scoreData.damageDealt, myHp);
  const opponentDamageDealt = Math.max(0, player.maxHp - myHp);
  const oppScore = getScoreParts(!won, elapsedSec, opponentDamageDealt, oppHp);

  endTitle.textContent = won ? "🏆 胜利！" : "💀 败北";
  endSub.innerHTML = won
    ? `你来自 <b class="settlement-highlight">${escapeHtml(myUniverse)}</b>，击败了来自 <b class="settlement-highlight">${escapeHtml(oppUniverse)}</b> 的对手`
    : `来自 <b class="settlement-highlight">${escapeHtml(oppUniverse)}</b> 的对手击败了你`;

  if (scoreDetails) {
    scoreDetails.innerHTML = `
      <div class="score-row"><span>胜利基础分</span><span>+${myScore.baseScore}</span></div>
      <div class="score-row"><span>生存时间 ×5</span><span>+${myScore.survivalScore}（${elapsedSec}s）</span></div>
      <div class="score-row"><span>造成伤害 ×30</span><span>+${myScore.damageScore}（${scoreData.damageDealt}hp）</span></div>
      <div class="score-row"><span>剩余血量 ×20</span><span>+${myScore.hpScore}（${myHp}hp）</span></div>
      <div class="score-total">总分：${myScore.totalScore}</div>
    `;
  }

  endOverlay.classList.remove("hidden");

  submitMatchResult({
    roomId: network.roomId,
    winnerName: won ? myName : oppName,
    winnerUniverse: won ? myUniverse : oppUniverse,
    winnerScore: won ? myScore.totalScore : oppScore.totalScore,
    loserName: won ? oppName : myName,
    loserUniverse: won ? oppUniverse : myUniverse,
    loserScore: won ? oppScore.totalScore : myScore.totalScore,
    duration: elapsedSec,
  });

  const endedRoomId = network.roomId;
  if (network.socket?.connected && endedRoomId) {
    setTimeout(() => {
      network.socket.emit("leave_room", endedRoomId);
    }, 5000);
  }
}

function backToLobby() {
  stopBGM();
  const previousRoomId = network.roomId;
  const wasMatchmaking = network.matchmaking;
  network.scene = "menu";
  network.roomId = null;
  network.myRole = null;
  network.matchmaking = false;
  endOverlay.classList.add("hidden");
  menuOverlay.classList.add("hidden");
  videoOverlay.classList.remove("hidden");
  touchLeft.style.display = "none";
  touchRight.style.display = "none";
  gameOverHandled = false;
  respawnPlayer();
  respawnOpponent();
  playRandomVideo();
  updateMatchmakingUi(0, "点击自动匹配，凑齐 2 人开局");
  if (network.socket?.connected && wasMatchmaking) {
    network.socket.emit("cancel_quick_match");
  }
}

btnBack.addEventListener("click", backToLobby);

function applyRemoteState() {
  if (network.scene !== "battle") return;
  const prevAttacking = remoteWasAttacking;
  remoteWasAttacking = remotePlayer.attacking;

  opponent.x = remotePlayer.x;
  opponent.y = remotePlayer.y;
  opponent.vx = remotePlayer.vx;
  opponent.vy = remotePlayer.vy;
  opponent.facing = remotePlayer.facing;
  opponent.grounded = remotePlayer.grounded;
  opponent.state = remotePlayer.state;

  // 远程玩家发动攻击 → 生成本地投掷物（2s 冷却）
  const now = performance.now();
  if (remotePlayer.attacking && !prevAttacking && network.myRole === "p1" && now - (stage._lastRemoteAtk || 0) > 1000) {
    stage._lastRemoteAtk = now;
    spawnRemoteProjectile();
  }
}

function spawnRemoteProjectile() {
  spawnProjectileFrom(opponent);
}

function resetSkillState(model, options = {}) {
  if (options.resetSeq) model.skillSeq = 0;
  if (options.resetCooldown) model.skillCooldownUntil = 0;
  model.skillUntil = 0;
  model.skillBubbleUntil = 0;
  model.skillText = "";
  model.stunnedUntil = 0;
}

function resetMatchSkillState() {
  resetSkillState(player, { resetSeq: true, resetCooldown: true });
  resetSkillState(opponent, { resetSeq: true, resetCooldown: true });
  remotePlayer.skillSeq = 0;
  remotePlayer.skillText = "";
  voiceSkill.recentTranscript = "";
  voiceSkill.lastTranscriptAt = 0;
  skillEffects.length = 0;
  refreshVoiceSkillUi();
}

function respawnPlayer() {
  player.x = world.respawnX;
  player.y = world.respawnY;
  player.vx = 0;
  player.vy = 0;
  player.facing = 1;
  player.grounded = true;
  player.attackUntil = 0;
  player.attackDamageMultiplier = 1;
  resetSkillState(player);
  player.hp = player.maxHp;
  player.hurtUntil = 0;
}

function respawnOpponent() {
  opponent.x = 390;
  opponent.y = 900;
  opponent.vx = 0;
  opponent.vy = 0;
  opponent.facing = -1;
  opponent.grounded = true;
  opponent.attackUntil = 0;
  opponent.attackDamageMultiplier = 1;
  resetSkillState(opponent);
  opponent.hp = opponent.maxHp;
  opponent.hurtUntil = 0;
  projectiles.length = 0;
}

function update(dt) {
  const now = performance.now();
  if (network.scene === "loading") {
    checkReadyToStart(now);
    return;
  }
  if (network.scene !== "battle") {
    refreshVoiceSkillUi(now);
    return;
  }

  updateCharacter(player, playerInput, inputMemory.p1, dt, now, respawnPlayer);
  if (!network.socket?.connected) {
    updateCharacter(opponent, opponentInput, inputMemory.p2, dt, now, respawnOpponent);
  } else {
    applyRemoteState();
  }
  // 角色碰撞：防止穿模
  resolveCharacterCollision();
  updateProjectiles(dt);
  updateParticles(dt);
  updateSkillEffects(dt);
  updateStage(dt, now);
  refreshVoiceSkillUi(now);
  // 近战命中：只有 p1 的 player 才有近战攻击
  if (network.myRole === "p1") {
    resolveMeleeHit(player, opponent, now);
  }
  // 远程命中：检测投掷物
  resolveProjectileHits(player, now);
  resolveProjectileHits(opponent, now);
  syncNetwork(now);
  checkGameOverWithSettlement();
}

function resolveCharacterCollision() {
  const dx = opponent.x - player.x;
  const dy = opponent.y - player.y;
  const minDist = (player.width + opponent.width) / 2 + 4;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < minDist && dist > 0) {
    const overlap = (minDist - dist) / 2;
    const nx = dx / dist;
    player.x -= nx * overlap;
    opponent.x += nx * overlap;
  }
}

function resolveMeleeHit(attacker, target, now) {
  if (attacker.attackUntil <= now) return;
  if (target.hurtUntil > now) return;
  const dx = target.x - attacker.x;
  const dy = target.y - attacker.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const hitRange = 80;
  if (dist > hitRange) return;
  const facingCheck = (attacker.facing > 0 && target.x > attacker.x) || (attacker.facing < 0 && target.x < attacker.x);
  if (!facingCheck) return;
  const damage = 2 * (attacker.attackDamageMultiplier ?? 1);
  const beforeHp = target.hp;
  target.hp -= damage;
  target.hurtUntil = now + 500;
  if (target.hp <= 0) target.hp = 0;
  if (attacker === player && target === opponent) {
    scoreData.damageDealt += Math.max(0, beforeHp - target.hp);
  }
  // 命中火花
  spawnParticles(target.x, target.y - target.height / 2, 12, { color: "#ff4444", speed: 300, life: 0.5, size: 4, spread: Math.PI * 2, gravity: 300 });
  // 同步伤害给远程玩家
  if (target === opponent && network.socket?.connected) {
    network.socket.emit("hit_event", { roomId: network.roomId, targetHp: target.hp });
  }
}

function resolveProjectileHits(target, now) {
  if (target.hurtUntil > now) return;
  const cx = target.x;
  const cy = target.y - target.height / 2;
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    if (p.owner === target) continue;
    const dx = cx - p.x;
    const dy = cy - p.y;
    const hitRange = 50;
    if (dx * dx + dy * dy < hitRange * hitRange) {
      const beforeHp = target.hp;
      target.hp -= 1;
      target.hurtUntil = now + 500;
      projectiles.splice(i, 1);
      if (target.hp <= 0) target.hp = 0;
      if (p.owner === player && target === opponent) {
        scoreData.damageDealt += Math.max(0, beforeHp - target.hp);
      }
      // 命中火花
      spawnParticles(p.x, p.y, 8, { color: "#ff9944", speed: 250, life: 0.4, size: 4, spread: Math.PI * 2, gravity: 250 });
      if (target === opponent && network.socket?.connected) {
        network.socket.emit("hit_event", { roomId: network.roomId, targetHp: target.hp });
      }
      break;
    }
  }
}

function updateCharacter(model, controls, memory, dt, now, respawn) {
  const stunned = model.stunnedUntil > now;
  const horizontal = stunned ? 0 : Number(controls.right) - Number(controls.left);
  model.vx = horizontal * model.moveSpeed;

  if (horizontal !== 0) {
    model.facing = horizontal;
  }

  const jumpPressed = !stunned && controls.jump && !memory.jumpWasDown;
  if (jumpPressed && model.grounded) {
    model.vy = -model.jumpSpeed;
    model.grounded = false;
    // 跳跃灰尘
    spawnParticles(model.x, model.y, 6, { color: "#d5cfc0", speed: 80, life: 0.3, size: 4, spread: Math.PI, gravity: 200 });
  }
  memory.jumpWasDown = controls.jump;

  const attackPressed = !stunned && controls.attack && !memory.attackWasDown;
  if (attackPressed) {
    model.attackUntil = now + 200;
    const isGestureMeleeAttack = model === player && network.myRole === "p1" && gestureControls.attack;
    model.attackDamageMultiplier = isGestureMeleeAttack ? 2 : 1;
    // 近战斩击拖尾
    if (model === player && network.myRole === "p1") {
      const sx = model.x + model.facing * 20;
      const sy = model.y - model.height * 0.6;
      const ex = model.x + model.facing * 90;
      const ey = model.y - model.height * 0.4;
      SLASH_TRAIL.push({ x1: sx, y1: sy, x2: ex, y2: ey, life: 0.16, maxLife: 0.16, color: "#ffe066" });
      spawnParticles(ex, ey, 8, { color: "#ffe066", speed: 300, life: 0.22, size: 3, spread: 1.5, gravity: 0 });
    }
    // p2(远程)攻击时发射投掷物
    const isRanged = (network.myRole === "p2" && model === player) ||
                     (network.myRole === "p1" && model === opponent);
    if (isRanged && now - (stage._lastRangedAtk || 0) > 1000) {
      stage._lastRangedAtk = now;
      spawnProjectileFrom(model);
      // 发射闪光
      spawnParticles(model.x + model.facing * 50, model.y - 80, 5, { color: "#ff9944", speed: 150, life: 0.3, size: 4, spread: 1, gravity: 0 });
    }
  }
  memory.attackWasDown = controls.attack;

  model.vy += world.gravity * dt;

  model.x += model.vx * dt;
  resolveHorizontalBounds(model);

  const previousBottom = model.y;
  model.y += model.vy * dt;
  model.grounded = false;
  resolveVerticalCollision(model, previousBottom);

  if (model.y > world.height + 220) {
    if (stage.config?.mode === "climb") {
      model.hp = 0;
    } else {
      respawn();
    }
  }

  model.state = stunned ? "idle" : getCharacterState(model, horizontal, now);

  // 奔跑灰尘
  if (model.state === "run" && model.grounded && Math.random() < 0.3) {
    spawnParticles(model.x, model.y, 1, { color: "#c8c0b0", speed: 40, life: 0.3, size: 2.5, spread: 0.6, gravity: 100 });
  }
}

function resolveHorizontalBounds(model) {
  const halfWidth = model.width / 2;
  model.x = clamp(model.x, halfWidth, world.width - halfWidth);
}

function resolveVerticalCollision(model, previousBottom) {
  if (model.vy < 0) {
    return;
  }

  const left = model.x - model.width / 2;
  const right = model.x + model.width / 2;

  for (const platform of stage.platforms) {
    if (platform.collapsing || platform.respawning) continue;
    const wasAbove = previousBottom <= platform.y;
    const isCrossingTop = model.y >= platform.y;
    const overlapsX = right > platform.x && left < platform.x + platform.w;

    if (wasAbove && isCrossingTop && overlapsX) {
      model.y = platform.y;
      model.vy = 0;
      model.grounded = true;
      return;
    }
  }

  // 死亡地板：碰到即死（climb 模式无安全地面）
  if (stage.config?.mode === "climb") {
    if (model.y >= stage.deathFloorY) {
      model.hp = 0;
      spawnParticles(model.x, stage.deathFloorY, 15, { color: "#ff4400", speed: 300, life: 0.6, size: 5, spread: Math.PI, gravity: 100 });
    }
    return;
  }
  if (model.y >= world.floorY) {
    model.y = world.floorY;
    model.vy = 0;
    model.grounded = true;
  }
}

function getCharacterState(model, horizontal, now = performance.now()) {
  if (model.skillUntil > now) return "attack";
  if (model.attackUntil > now) return "attack";
  if (!model.grounded && model.vy < 0) return "jump";
  if (!model.grounded) return "fall";
  if (horizontal !== 0) return "run";
  return "idle";
}

function spawnProjectileFrom(model) {
  const facing = model.facing || -1;
  projectiles.push({
    x: model.x + facing * 58,
    y: model.y - 82,
    vx: facing * projectileConfig.speed,
    facing,
    age: 0,
    owner: model,
  });
}

function updateProjectiles(dt) {
  for (const projectile of projectiles) {
    projectile.x += projectile.vx * dt;
    projectile.age += dt;
    // 投掷物拖尾
    if (Math.random() < 0.5) {
      spawnParticles(projectile.x, projectile.y, 1, { color: "#88ccff", speed: 30, life: 0.25, size: 2, spread: 0.5, gravity: 0 });
    }
  }

  for (let index = projectiles.length - 1; index >= 0; index -= 1) {
    const projectile = projectiles[index];
    const outOfBounds = projectile.x < -90 || projectile.x > world.width + 90;
    if (outOfBounds || projectile.age > projectileConfig.lifetime) {
      projectiles.splice(index, 1);
    }
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (network.scene !== "battle") {
    ctx.fillStyle = "#0a0f1e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return;
  }
  // 素材加载中 → 显示加载画面，不露出白模 fallback
  const loadingLocal = theme.loadState === "loading" || animations.p1.loadState === "loading" || animations.p2.loadState === "loading";
  const loadingRemote = remoteTheme.loadState === "loading" || remoteAnimations.p1.loadState === "loading" || remoteAnimations.p2.loadState === "loading";
  // 素材加载中，但最多等 8 秒防止永远卡住
  const loadElapsed = (performance.now() - (stage.matchStartTime || performance.now())) / 1000;
  if ((loadingLocal || loadingRemote) && loadElapsed < 8) {
    ctx.fillStyle = "#0a0f1e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "18px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("加载中...", canvas.width / 2, canvas.height / 2);
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = "13px sans-serif";
    const dots = ".".repeat((Math.floor(performance.now() / 500) % 3) + 1);
    ctx.fillText(dots, canvas.width / 2, canvas.height / 2 + 30);
    return;
  }
  drawBackground();
  drawPlatforms();
  drawSplitViewOverlay(performance.now());

  // 左边永远是近战(p1)，右边永远是远程(p2)
  if (network.myRole === "p1") {
    drawPlayerAvatar(opponent, getRemoteThemePlayer("p2"), "p2", remoteAnimations); // 远程 = 对手
    drawPlayerAvatar(player, getThemePlayer("p1"), "p1", animations);               // 近战 = 我
  } else {
    drawPlayerAvatar(opponent, getRemoteThemePlayer("p1"), "p1", remoteAnimations); // 近战 = 对手
    drawPlayerAvatar(player, getThemePlayer("p2"), "p2", animations);               // 远程 = 我
  }
  drawProjectiles();
  drawDeathFloor();
  drawCeiling();
  drawHazards();
  drawRangedCooldown();
  drawParticles();
  drawVoiceSkillEffects(performance.now());
  drawHUD();
}

function drawBackground() {
  const bg = getThemeImage(theme.manifest?.environment?.background);
  if (bg) {
    drawCoverImage(bg, 0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(8, 13, 22, 0.15)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return;
  }

  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, "#1a1a2e");
  sky.addColorStop(1, "#0d1117");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= canvas.width; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= canvas.height; y += 48) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}

function drawPlatforms(themeBundle = theme) {
  const leftImg = themeBundle.images.get("platform_left.png");
  const midImg = themeBundle.images.get("platform_mid.png");
  const rightImg = themeBundle.images.get("platform_right.png");

  for (const p of stage.platforms) {
    if (leftImg && midImg && rightImg) {
      const capW = 28;
      const vh = 36; // 素材视觉高度
      ctx.drawImage(leftImg, p.x, p.y - vh + p.h, capW, vh);
      ctx.drawImage(rightImg, p.x + p.w - capW, p.y - vh + p.h, capW, vh);
      if (p.w > capW * 2) {
        ctx.drawImage(midImg, p.x + capW, p.y - vh + p.h, p.w - capW * 2, vh);
      }
      // 碰撞线
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + p.w, p.y);
      ctx.stroke();
    } else {
      ctx.fillStyle = "rgba(60,70,85,0.8)";
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.lineWidth = 1;
      ctx.strokeRect(p.x, p.y, p.w, p.h);
    }
  }
}

function drawDeathFloor() {
  const y = stage.deathFloorY;
  if (y > world.height || y < 0) return;
  // 红色渐变死亡地板
  const grad = ctx.createLinearGradient(0, y - 8, 0, y + 8);
  grad.addColorStop(0, "rgba(255,30,0,0)");
  grad.addColorStop(0.5, "rgba(255,30,0,0.7)");
  grad.addColorStop(1, "rgba(255,30,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, y - 8, world.width, 16);
  ctx.strokeStyle = "rgba(255,60,30,0.9)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(world.width, y);
  ctx.stroke();
}

function drawCeiling() {
  const cfg = stage.config;
  if (!cfg) return;
  ctx.fillStyle = "rgba(255,20,20,0.15)";
  ctx.fillRect(0, 0, world.width, cfg.ceiling_y);
  ctx.strokeStyle = "rgba(255,40,40,0.5)";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 4]);
  ctx.beginPath();
  ctx.moveTo(0, cfg.ceiling_y);
  ctx.lineTo(world.width, cfg.ceiling_y);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawPlayerAvatar(model, themePlayer = null, animationId = null, animationBundle = null) {
  const useRemoteAvatar = model === opponent && shouldUseRemoteCharacterTheme();
  const hasRemoteAnimation = useRemoteAvatar && remoteAnimations[animationId]?.loadState === "ready";
  const requestedAnimationBundle = useRemoteAvatar
    ? (animationBundle ?? remoteAnimations)
    : (model === opponent ? animations : animationBundle ?? animations);
  const resolvedAnimationBundle = requestedAnimationBundle === remoteAnimations && !hasRemoteAnimation ? animations : requestedAnimationBundle;
  const resolvedThemePlayer = useRemoteAvatar ? getRemoteThemePlayer(animationId) : (model === opponent ? getThemePlayer(animationId) : themePlayer);
  if (drawAnimatedPlayerSprite(model, resolvedThemePlayer, animationId, resolvedAnimationBundle)) {
    return;
  }

  // 帧动画缺失时的 fallback：简单白模矩形
  const footX = model.x;
  const footY = model.y;
  const bodyW = model.width;
  const bodyH = model.height;

  roundedRect(footX - bodyW / 2, footY - bodyH, bodyW, bodyH, 6);
  ctx.fillStyle = resolvedThemePlayer?.placeholder_color ?? "#888888";
  ctx.fill();
  ctx.strokeStyle = "#333333";
  ctx.lineWidth = 2;
  ctx.stroke();

  // 小圆头
  const headY = footY - bodyH - 8;
  ctx.beginPath();
  ctx.arc(footX, headY, 10, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.strokeStyle = "#333333";
  ctx.lineWidth = 2;
  ctx.stroke();

}

function drawAnimatedPlayerSprite(model, themePlayer = null, animationId = null, animationBundle = animations) {
  const animation = animationBundle[animationId];
  if (!animation || animation.loadState === "loading" || !animation.manifest) {
    return false;
  }
  // partial 模式：只有 idle 帧加载了，强制使用 idle
  const useState = animation.loadState === "partial" ? "idle" : model.state;

  const animationKey = animation.manifest.animations[useState] ? useState : "idle";
  const config = animation.manifest.animations[animationKey];
  const framePath = getAnimationFramePath(config);
  const frameImage = animation.images.get(framePath);
  if (!frameImage) {
    return false;
  }

  const drawHeight = model === opponent ? 156 : model.state === "run" ? 148 : 144;
  const drawWidth = drawHeight * (frameImage.width / frameImage.height);
  const drawCenterX = model.x + model.facing * (model === opponent ? 0 : 7);
  const drawCenterY = model.y - drawHeight / 2 + (model === opponent ? 6 : 8);

  drawSlotImage(frameImage, drawCenterX, drawCenterY, drawWidth, drawHeight, model.facing);
  return true;
}

function getAnimationFramePath(config) {
  if (!config?.frames?.length) {
    return null;
  }

  const fps = Math.max(1, config.fps ?? 1);
  const frameIndex = config.loop
    ? Math.floor((performance.now() / 1000) * fps) % config.frames.length
    : 0;
  return config.frames[frameIndex];
}

function drawProjectiles() {
  for (const projectile of projectiles) {
    const projectileTheme = projectile.owner === opponent ? remoteTheme : theme;
    drawFallbackProjectile(projectile, projectileTheme);
  }
}

function drawRangedCooldown() {
  const ranged = network.myRole === "p2" ? player : opponent;
  const now = performance.now();
  const elapsed = now - (stage._lastRangedAtk || 0);
  const cd = 1000;
  const ratio = Math.min(1, elapsed / cd);
  const cx = ranged.x + ranged.facing * 30;
  const cy = ranged.y - ranged.height - 10;
  const r = 8;

  // 底圈
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 冷却进度弧
  if (ratio < 1) {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r - 1, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio);
    ctx.closePath();
    ctx.fillStyle = "rgba(255,150,50,0.7)";
    ctx.fill();
  }
  // 就绪 ✓
  ctx.fillStyle = ratio >= 1 ? "#2ecc71" : "rgba(255,255,255,0.6)";
  ctx.font = "bold 8px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(ratio >= 1 ? "✓" : "", cx, cy);
}

function drawHazards() {
  const hImg = theme.images.get("hazard_debris.png");
  for (const h of stage.hazards) {
    if (hImg) {
      ctx.drawImage(hImg, h.x - h.size, h.y - h.size, h.size * 2, h.size * 2);
    } else {
      ctx.fillStyle = "#ff4444";
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawFallbackProjectile(projectile, themeBundle = theme) {
  // 有素材图就用素材图
  const projImg = getThemeImage(getThemeProjectilePath(themeBundle), themeBundle) ?? getThemeImage(DEFAULT_PROJECTILE_IMAGE, themeBundle);
  if (projImg) {
    const pulse = Math.sin(performance.now() / 100) * 0.08 + 1;
    const w = 40 * pulse;
    const h = 40 * pulse * (projImg.height / projImg.width);
    drawSlotImage(projImg, projectile.x, projectile.y, w, h, projectile.facing);
    return;
  }
  // fallback: 蓝色方块
  ctx.save();
  ctx.translate(projectile.x, projectile.y);
  ctx.scale(projectile.facing, 1);
  ctx.fillStyle = "rgba(0, 220, 255, 0.28)";
  roundedRect(-38, -9, 76, 18, 9);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  roundedRect(-18, -4, 42, 8, 4);
  ctx.fill();
  ctx.restore();
}

function drawSlotImage(image, centerX, centerY, width, height, facing = 1) {
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.scale(facing, 1);
  drawImageCentered(image, 0, 0, width, height);
  ctx.restore();
}

function drawImageCentered(image, centerX, centerY, width, height) {
  ctx.drawImage(image, centerX - width / 2, centerY - height / 2, width, height);
}

function drawNameplate(name, x, y) {
  if (!name) return;

  ctx.font = "14px sans-serif";
  const textWidth = ctx.measureText(name).width;
  const width = Math.max(72, textWidth + 22);
  roundedRect(x - width / 2, y - 13, width, 26, 7);
  ctx.fillStyle = "rgba(255, 255, 255, 0.86)";
  ctx.fill();
  ctx.strokeStyle = "rgba(31, 111, 235, 0.65)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#172033";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(name, x, y);
}

function roundedRect(x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function getSplitViewProgress(now) {
  if (network.scene !== "battle") return 0;

  const startTime = splitView.debugForcedAt || stage.matchStartTime;
  if (!startTime) return 0;

  const delayedElapsed = now - startTime - (splitView.debugForcedAt ? 0 : SPLIT_VIEW_CONFIG.triggerDelayMs);
  return clamp(delayedElapsed / SPLIT_VIEW_CONFIG.transitionMs, 0, 1);
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function drawSplitViewOverlay(now) {
  const progress = getSplitViewProgress(now);
  if (progress <= 0) return;
  if (remoteTheme.loadState !== "ready") return;

  const eased = easeOutCubic(progress);
  const w = canvas.width;
  const h = canvas.height;
  const topX = w * (1.08 - 0.58 * eased);
  const bottomX = w * (0.92 - 0.68 * eased);
  const controlX = w * (1.04 - 0.82 * eased);
  const controlY = h * 0.52;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(w, 0);
  ctx.lineTo(topX, 0);
  ctx.quadraticCurveTo(controlX, controlY, bottomX, h);
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.clip();

  const remoteBg = getThemeImage(remoteTheme.manifest?.environment?.background, remoteTheme);
  if (remoteBg) {
    drawCoverImage(remoteBg, 0, 0, w, h);
  }

  drawPlatforms(remoteTheme);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${0.24 + eased * 0.32})`;
  ctx.lineWidth = 2;
  ctx.shadowColor = "#78d7ff";
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(topX, 0);
  ctx.quadraticCurveTo(controlX, controlY, bottomX, h);
  ctx.stroke();

  ctx.strokeStyle = `rgba(255,118,92,${0.1 + eased * 0.2})`;
  ctx.lineWidth = 5;
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.moveTo(topX + 3, 0);
  ctx.quadraticCurveTo(controlX + 3, controlY, bottomX + 3, h);
  ctx.stroke();
  ctx.restore();
}

function shouldUseRemoteCharacterTheme(now = performance.now()) {
  return remoteTheme.loadState === "ready" && getSplitViewProgress(now) > 0;
}

function drawHUD() {
  const barW = 220;
  const barH = 14;
  const y = 18;
  const leftX = 20;
  const rightX = canvas.width - barW - 20;

  const me = network.myRole === "p1" ? player : opponent;
  const remote = network.myRole === "p1" ? opponent : player;
  const meRoleId = network.myRole === "p1" ? "p1" : "p2";
  const remoteRoleId = network.myRole === "p1" ? "p2" : "p1";

  const remoteThemePlayer = shouldUseRemoteCharacterTheme() ? getRemoteThemePlayer(remoteRoleId) : getThemePlayer(remoteRoleId);

  drawHpBar(leftX, y, barW, barH, me, getThemePlayer(meRoleId));
  drawHpBar(rightX, y, barW, barH, remote, remoteThemePlayer);
}

function drawHpBar(x, y, w, h, model, themePlayer) {
  const ratio = model.hp / model.maxHp;
  const name = themePlayer?.name ?? "角色";

  // 半透明底
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  roundedRect(x - 2, y - 2, w + 4, h + 24, 6);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = 1;
  roundedRect(x - 2, y - 2, w + 4, h + 24, 6);
  ctx.stroke();

  // 名字
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 12px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(name, x + 4, y + 2);

  // 血量数字
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 11px sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(`${model.hp}/${model.maxHp}`, x + w - 4, y + 2);

  // 血条底
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  roundedRect(x, y + 18, w, h, 4);
  ctx.fill();

  // 血量
  if (ratio <= 0) return;
  const hpColor = ratio > 0.5 ? "#2ecc71" : ratio > 0.2 ? "#f39c12" : "#e74c3c";
  const hpGrad = ctx.createLinearGradient(x, 0, x + w * ratio, 0);
  hpGrad.addColorStop(0, hpColor);
  hpGrad.addColorStop(1, ratio > 0.5 ? "#27ae60" : ratio > 0.2 ? "#e67e22" : "#c0392b");
  ctx.fillStyle = hpGrad;
  roundedRect(x, y + 18, w * ratio, h, 3);
  ctx.fill();

  // 高光
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  roundedRect(x, y + 18, w * ratio, h / 2, [3, 3, 0, 0]);
  ctx.fill();
}

function getThemePlayer(id, themeBundle = theme) {
  return themeBundle.manifest?.players?.[id] ?? null;
}

function getRemoteThemePlayer(id) {
  return getThemePlayer(id, remoteTheme) ?? getThemePlayer(id, theme);
}

function getThemeImage(path, themeBundle = theme) {
  if (!path) return null;
  return themeBundle.images.get(path) ?? null;
}

function getThemeProjectilePath(themeBundle = theme) {
  return themeBundle.manifest?.projectile ?? DEFAULT_PROJECTILE_IMAGE;
}

function drawCoverImage(image, x, y, width, height) {
  const scale = Math.max(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

async function loadThemePackage(root, themeBundle = theme, animationBundle = animations, themeId = null) {
  try {
    themeBundle.id = themeId;
    themeBundle.loadState = "loading";
    themeBundle.manifest = null;
    themeBundle.images.clear();
    for (const animation of Object.values(animationBundle)) {
      animation.manifest = null;
      animation.images.clear();
      animation.loadState = "loading";
    }

    const manifest = await fetchJson(`${root}/manifest.json`);
    themeBundle.manifest = manifest;

    // 只加载场景背景
    // 场景图片：背景 + 场地素材
    const stageAssets = ["platform_left.png", "platform_mid.png", "platform_right.png", "hazard_debris.png"];
    const scenePaths = [manifest.environment?.background, ...stageAssets].filter(Boolean);

    await Promise.all(scenePaths.map((path) => loadThemeImage(root, path, themeBundle)));
    // 投掷物图片（可选）
    const projPath = manifest.projectile ?? DEFAULT_PROJECTILE_IMAGE;
    loadThemeImage(root, projPath, themeBundle).catch(() => {});
    await Promise.all([
      loadPlayerAnimation(root, "animation_preview/p1_animation_manifest.json", animationBundle.p1),
      loadPlayerAnimation(root, "animation_preview/p2_animation_manifest.json", animationBundle.p2),
    ]);
    themeBundle.loadState = "ready";
  } catch (error) {
    console.warn("Theme package failed to load, using whitebox fallback.", error);
    themeBundle.loadState = "fallback";
  }
}

async function loadPlayerAnimation(root, manifestPath, animation) {
  try {
    const manifest = await fetchJson(`${root}/${manifestPath}`);
    animation.manifest = manifest;
    const animationRoot = manifestPath.split("/").slice(0, -1).join("/");
    const allFrames = Object.values(manifest.animations).flatMap((config) => config.frames);
    const framePaths = allFrames.map((path) => `${animationRoot}/${path}`);

    // 优先加载 idle 帧，让角色立刻出现
    const idlePaths = framePaths.filter(p => p.includes("idle"));
    const restPaths = framePaths.filter(p => !p.includes("idle"));
    await Promise.all(idlePaths.map((path) => loadAnimationImage(root, path, animation)));
    animation.loadState = "partial";

    // 后台加载其余帧
    await Promise.all(restPaths.map((path) => loadAnimationImage(root, path, animation)));

    for (const config of Object.values(manifest.animations)) {
      config.frames = config.frames.map((path) => `${animationRoot}/${path}`);
    }

    animation.loadState = "ready";
  } catch (error) {
    console.warn("Player animation failed to load", error);
    animation.loadState = "fallback";
  }
}

async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`);
  }
  return response.json();
}

function loadThemeImage(root, path, themeBundle = theme) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      themeBundle.images.set(path, image);
      resolve();
    };
    image.onerror = () => {
      console.warn(`Missing theme image: ${path}`);
      resolve();
    };
    image.src = `${root}/${path}`;
  });
}

function loadAnimationImage(root, path, animation) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      animation.images.set(path, image);
      resolve();
    };
    image.onerror = () => {
      console.warn(`Missing animation image: ${path}`);
      resolve();
    };
    image.src = `${root}/${path}`;
  });
}

function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.033);
  lastTime = now;

  update(dt);
  draw();
  requestAnimationFrame(loop);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

window.tapFightDebug = {
  startLocalBattle: async () => {
    if (!stage.config) {
      await loadStageConfig();
    }
    network.scene = "battle";
    network.myRole = "p1";
    menuOverlay.classList.add("hidden");
    videoOverlay.classList.add("hidden");
    endOverlay.classList.add("hidden");
    touchLeft.style.display = "flex";
    touchRight.style.display = "flex";
    loadCurrentTheme();
    resetRemoteTheme();
    resetMatchSkillState();
    buildStagePlatforms();
    respawnPlayer();
    respawnOpponent();
    const startY = getInitialPlatformY();
    player.y = startY;
    opponent.y = startY;
    player.grounded = true;
    opponent.grounded = true;
    player.vy = 0;
    opponent.vy = 0;
    stage.matchStartTime = performance.now();
    stage.hazards = [];
    stage._lastHazardTime = 0;
    splitView.debugForcedAt = 0;
  },
  fireP2: () => {
    opponent.attackUntil = performance.now() + 200;
    spawnProjectileFrom(opponent);
  },
  castVoiceSkill: () => {
    castLocalVoiceSkill(getSkillText(getLocalRoleId(), theme));
  },
  forceSplitView: () => {
    splitView.debugForcedAt = performance.now();
  },
  resetSplitView: () => {
    splitView.debugForcedAt = 0;
  },
};

// 启动
gestureControls.init();
const debugParams = new URLSearchParams(window.location.search);
if (debugParams.has("debugBattle")) {
  setTimeout(async () => {
    const debugThemeId = debugParams.get("themeId");
    if (debugThemeId) {
      currentThemeId = debugThemeId;
    }
    await window.tapFightDebug?.startLocalBattle();
    const debugRemoteThemeId = debugParams.get("remoteThemeId");
    if (debugRemoteThemeId) {
      loadRemoteTheme(debugRemoteThemeId);
    }
    if (debugParams.has("split")) {
      window.tapFightDebug?.forceSplitView();
    }
  }, 250);
}

loadStageConfig();
requestAnimationFrame(loop);

// 进入对战时加载主题
function loadCurrentTheme() {
  const root = `./theme_packs/${currentThemeId}`;
  loadThemePackage(root, theme, animations, currentThemeId);
}

function loadRemoteTheme(themeId) {
  if (!themeId || remoteTheme.id === themeId) return;
  const root = `./theme_packs/${themeId}`;
  loadThemePackage(root, remoteTheme, remoteAnimations, themeId);
}

function resetRemoteTheme() {
  remoteTheme.id = null;
  remoteTheme.manifest = null;
  remoteTheme.images.clear();
  remoteTheme.loadState = "loading";
  for (const animation of Object.values(remoteAnimations)) {
    animation.manifest = null;
    animation.images.clear();
    animation.loadState = "loading";
  }
}

// 主题由视频入口自动选定，无需手动切换
