import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

type GestureState = "idle" | "loading" | "ready" | "error";
type HandState = "open" | "fist" | "unknown";

const VISION_WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const HAND_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

const ATTACK_PULSE_MS = 170;
const ATTACK_COOLDOWN_MS = 520;
const DETECT_INTERVAL_MS = 66;
const OPEN_THRESHOLD = 0.92;
const FIST_THRESHOLD = 0.62;
const TRANSITION_WINDOW_MS = 460;

let state: GestureState = "idle";
let enabled = false;
let video: HTMLVideoElement | null = null;
let landmarker: HandLandmarker | null = null;
let landmarkerPromise: Promise<HandLandmarker> | null = null;
let rafId = 0;
let lastDetectAt = 0;
let lastOpenAt = 0;
let lastAttackAt = 0;
let attackUntil = 0;
let lastVideoTime = -1;
let statusEl: HTMLDivElement | null = null;
let toggleBtn: HTMLButtonElement | null = null;
let warmupStarted = false;
let startRequestId = 0;

export const gestureControls = {
  init,
  preload,
  stop,
  get attack() {
    return enabled && performance.now() < attackUntil;
  },
  get enabled() {
    return enabled;
  },
  get state() {
    return state;
  },
};

function init() {
  ensureUi();
  scheduleWarmup();
}

async function start() {
  if (state === "loading" || enabled) return;
  if (!navigator.mediaDevices?.getUserMedia) {
    setState("error", "此浏览器不支持摄像头");
    return;
  }

  setState("loading", "手势初始化");
  const requestId = ++startRequestId;

  try {
    const landmarkerReady = preload();
    const localVideo = createVideo();
    video = localVideo;
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: 640 },
        height: { ideal: 480 },
      },
      audio: false,
    });
    if (requestId !== startRequestId) {
      stopVideoElement(localVideo, stream);
      return;
    }

    localVideo.srcObject = stream;
    await Promise.all([localVideo.play(), landmarkerReady]);

    if (requestId !== startRequestId) {
      stopVideoElement(localVideo);
      if (video === localVideo) video = null;
      return;
    }

    enabled = true;
    setState("ready", "开掌握拳攻击");
    loop();
  } catch (error) {
    console.warn("[gesture] failed to start", error);
    stopCamera();
    enabled = false;
    setState("error", "手势不可用");
  }
}

function scheduleWarmup() {
  if (warmupStarted) return;
  warmupStarted = true;
  addResourceHints();

  const run = () => {
    void preload().catch((error) => {
      console.warn("[gesture] warmup skipped", error);
    });
  };

  const requestIdleCallback = (window as any).requestIdleCallback;
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(run, { timeout: 2200 });
    return;
  }

  window.setTimeout(run, 900);
}

function preload() {
  if (landmarker) return Promise.resolve(landmarker);
  if (!landmarkerPromise) {
    landmarkerPromise = createHandLandmarker()
      .then((instance) => {
        landmarker = instance;
        return instance;
      })
      .catch((error) => {
        landmarkerPromise = null;
        throw error;
      });
  }
  return landmarkerPromise;
}

async function createHandLandmarker() {
  const vision = await FilesetResolver.forVisionTasks(VISION_WASM_URL);
  return HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: HAND_MODEL_URL,
      delegate: "CPU",
    },
    runningMode: "VIDEO",
    numHands: 2,
  });
}

function stop() {
  startRequestId += 1;
  enabled = false;
  attackUntil = 0;
  lastOpenAt = 0;
  lastVideoTime = -1;
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
  stopCamera();
  setState("idle", "手势关闭");
}

function loop() {
  if (!enabled || !video || !landmarker) return;
  rafId = requestAnimationFrame(loop);

  const now = performance.now();
  if (now - lastDetectAt < DETECT_INTERVAL_MS || video.currentTime === lastVideoTime) return;

  lastDetectAt = now;
  lastVideoTime = video.currentTime;

  const result = landmarker.detectForVideo(video, now);
  const handState = classifyHands(result.landmarks ?? []);
  updateGestureState(handState, now);
}

function updateGestureState(handState: HandState, now: number) {
  if (handState === "open") {
    lastOpenAt = now;
    setStatus("开掌");
    return;
  }

  if (handState === "fist") {
    const wasRecentlyOpen = now - lastOpenAt < TRANSITION_WINDOW_MS;
    const cooledDown = now - lastAttackAt > ATTACK_COOLDOWN_MS;
    if (wasRecentlyOpen && cooledDown) {
      lastAttackAt = now;
      attackUntil = now + ATTACK_PULSE_MS;
      setStatus("攻击");
    } else {
      setStatus("握拳");
    }
    return;
  }

  setStatus("对准手掌");
}

function classifyHands(hands: Array<Array<{ x: number; y: number; z?: number }>>): HandState {
  let hasOpen = false;
  let hasFist = false;

  for (const landmarks of hands) {
    if (landmarks.length < 21) continue;
    const openness = getHandOpenness(landmarks);
    if (openness > OPEN_THRESHOLD) hasOpen = true;
    if (openness < FIST_THRESHOLD) hasFist = true;
  }

  if (hasFist) return "fist";
  if (hasOpen) return "open";
  return "unknown";
}

function getHandOpenness(landmarks: Array<{ x: number; y: number; z?: number }>) {
  const wrist = landmarks[0];
  const middleMcp = landmarks[9];
  const palmSize = Math.max(distance(wrist, middleMcp), 0.001);
  const tipIds = [8, 12, 16, 20];
  const pipIds = [6, 10, 14, 18];

  let score = 0;
  for (let index = 0; index < tipIds.length; index += 1) {
    const tip = landmarks[tipIds[index]];
    const pip = landmarks[pipIds[index]];
    score += distance(tip, wrist) / palmSize;
    score += distance(tip, pip) / palmSize;
  }

  return score / (tipIds.length * 2);
}

function distance(a: { x: number; y: number; z?: number }, b: { x: number; y: number; z?: number }) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = (a.z ?? 0) - (b.z ?? 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function createVideo() {
  const el = document.createElement("video");
  el.className = "gesture-video";
  el.autoplay = true;
  el.muted = true;
  el.playsInline = true;
  document.body.appendChild(el);
  return el;
}

function stopCamera() {
  if (!video) return;
  stopVideoElement(video);
  video = null;
}

function stopVideoElement(targetVideo: HTMLVideoElement, streamOverride?: MediaStream) {
  const stream = streamOverride ?? (targetVideo.srcObject as MediaStream | null);
  stream?.getTracks().forEach((track) => track.stop());
  targetVideo.remove();
}

function ensureUi() {
  if (toggleBtn) return;

  const panel = document.createElement("div");
  panel.className = "gesture-panel";

  toggleBtn = document.createElement("button");
  toggleBtn.type = "button";
  toggleBtn.className = "gesture-toggle";
  toggleBtn.textContent = "✊";
  toggleBtn.setAttribute("aria-label", "开启手势攻击");
  toggleBtn.addEventListener("click", () => {
    if (enabled || state === "loading") {
      stop();
      return;
    }
    void start();
  });

  statusEl = document.createElement("div");
  statusEl.className = "gesture-status";
  statusEl.textContent = "手势关闭";

  panel.append(toggleBtn, statusEl);
  document.body.appendChild(panel);
}

function addResourceHints() {
  addResourceHint("preconnect", "https://cdn.jsdelivr.net");
  addResourceHint("preconnect", "https://storage.googleapis.com");
  addResourceHint("dns-prefetch", "https://cdn.jsdelivr.net");
  addResourceHint("dns-prefetch", "https://storage.googleapis.com");
}

function addResourceHint(rel: string, href: string) {
  if (document.head.querySelector(`link[rel="${rel}"][href="${href}"]`)) return;
  const link = document.createElement("link");
  link.rel = rel;
  link.href = href;
  if (rel === "preconnect") link.crossOrigin = "anonymous";
  document.head.appendChild(link);
}

function setState(nextState: GestureState, label: string) {
  state = nextState;
  setStatus(label);
  if (!toggleBtn) return;
  toggleBtn.classList.toggle("is-active", enabled);
  toggleBtn.classList.toggle("is-loading", state === "loading");
  toggleBtn.setAttribute("aria-label", enabled ? "关闭手势攻击" : "开启手势攻击");
}

function setStatus(label: string) {
  if (!statusEl) return;
  statusEl.textContent = label;
  statusEl.classList.toggle("is-attack", label === "攻击");
}
