import express from 'express'
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import { createWriteStream } from 'node:fs'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const port = Number(process.env.PORT ?? 42222)
const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: { origin: true, credentials: true },
})

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'tap-fight-server' })
})

// ============== Leaderboard ==============

const DEFAULT_THEME_ID = 'office_battle_001'
const serverDir = path.dirname(fileURLToPath(import.meta.url))
const leaderboardFile = path.join(serverDir, '..', 'leaderboard.json')

function readLeaderboard(): unknown[] {
  try {
    const data = JSON.parse(fs.readFileSync(leaderboardFile, 'utf-8'))
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

function writeLeaderboard(data: unknown[]) {
  fs.mkdirSync(path.dirname(leaderboardFile), { recursive: true })
  fs.writeFileSync(leaderboardFile, JSON.stringify(data, null, 2), 'utf-8')
}

function resolveThemeId(input: unknown): string {
  if (typeof input === 'string' && input.trim()) return input.trim()
  if (input && typeof input === 'object' && 'themeId' in input) {
    const value = (input as { themeId?: unknown }).themeId
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return DEFAULT_THEME_ID
}

app.get('/api/leaderboard', (_req, res) => {
  res.json(readLeaderboard())
})

app.post('/api/match-result', express.json({ limit: '32kb' }), (req, res) => {
  const list = readLeaderboard()
  list.unshift({
    ...req.body,
    time: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
  })
  writeLeaderboard(list.slice(0, 500))
  res.json({ ok: true })
})

// ============== Video Asset Pipeline ==============

type PipelineJobStatus = 'uploading' | 'queued' | 'running' | 'completed' | 'failed'

interface PipelineJob {
  id: string
  themeId: string
  status: PipelineJobStatus
  progress: number
  message: string
  createdAt: string
  updatedAt: string
  videoName: string
  videoPath: string
  pipelineDir: string
  packDir: string
  stageTemplate: string
  frames: number
  exportTapFight: boolean
  generateStageAssets: boolean
  structureOnly: boolean
  uploadedBytes: number
  exitCode?: number | null
  error?: string
  logs: string[]
  result?: unknown
  pid?: number
}

const tapFightRoot = path.resolve(serverDir, '..', '..')
const pipelineJobs = new Map<string, PipelineJob>()

function firstQueryValue(value: unknown): string {
  if (Array.isArray(value)) return firstQueryValue(value[0])
  return typeof value === 'string' ? value : ''
}

function safeSlug(input: string, fallback: string) {
  const slug = input
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80)
  return slug || fallback
}

function safeFileName(input: string) {
  const base = path.basename(input || 'input.mp4')
  return base.replace(/[<>:"/\\|?*\x00-\x1F]+/g, '_').slice(0, 120) || 'input.mp4'
}

function makeJobId() {
  return `asset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function makeThemeId(input: string) {
  return safeSlug(input, `web_asset_${Date.now().toString(36)}`)
}

function clampNumber(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback
  return Math.max(min, Math.min(max, Math.round(value)))
}

function resolveVideoPipelineDir() {
  const candidates = [
    process.env.VIDEO_PIPELINE_DIR,
    path.resolve(tapFightRoot, '..', 'video_theme_asset_pipeline'),
    path.resolve(tapFightRoot, '..', '分工文件', '01_窗口_视频处理与素材生成', '交付物', '给游戏同学_视频转主题资产包'),
  ].filter((item): item is string => Boolean(item))

  return candidates.find((candidate) => fs.existsSync(path.join(candidate, 'package_video.ps1'))) ?? null
}

function readJsonFile(filePath: string): unknown | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch {
    return null
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function getNestedString(value: unknown, keys: string[]) {
  let current: unknown = value
  for (const key of keys) {
    const record = asRecord(current)
    if (!record) return ''
    current = record[key]
  }
  return typeof current === 'string' ? current : ''
}

function getNestedBool(value: unknown, keys: string[]) {
  let current: unknown = value
  for (const key of keys) {
    const record = asRecord(current)
    if (!record) return false
    current = record[key]
  }
  return Boolean(current)
}

function redactLogLine(line: string) {
  return line
    .replace(/sk-[a-zA-Z0-9_-]{12,}/g, 'sk-REDACTED')
    .replace(/AIza[a-zA-Z0-9_-]{12,}/g, 'AIza-REDACTED')
    .replace(/(API_KEY\s*=\s*)(\S+)/gi, '$1REDACTED')
}

function appendJobLog(job: PipelineJob, text: string) {
  const lines = text.replace(/\r/g, '').split('\n').map((line) => redactLogLine(line.trim())).filter(Boolean)
  if (!lines.length) return

  job.logs.push(...lines)
  job.logs = job.logs.slice(-180)
  job.message = lines[lines.length - 1]
  job.updatedAt = new Date().toISOString()

  const lower = text.toLowerCase()
  if (lower.includes('understand') || lower.includes('video understanding')) job.progress = Math.max(job.progress, 24)
  if (lower.includes('generation_brief') || lower.includes('analysis_report')) job.progress = Math.max(job.progress, 36)
  if (lower.includes('draw') || lower.includes('sprite')) job.progress = Math.max(job.progress, 56)
  if (lower.includes('quality retry') || lower.includes('postprocess')) job.progress = Math.max(job.progress, 70)
  if (lower.includes('package_status') || lower.includes('manifest')) job.progress = Math.max(job.progress, 82)
  if (lower.includes('exported themeassetpackage') || lower.includes('can_load')) job.progress = Math.max(job.progress, 92)
}

function isInside(parentDir: string, childPath: string) {
  const relative = path.relative(parentDir, childPath)
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative)
}

function collectAssetFiles(packDir: string, jobId: string) {
  const output: Array<{ path: string; url: string; kind: string }> = []
  const roots = ['assets', 'frames']
  const extensions = new Set(['.png', '.jpg', '.jpeg', '.webp'])

  function walk(dir: string, depth: number) {
    if (output.length >= 48 || depth > 2 || !fs.existsSync(dir)) return
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(fullPath, depth + 1)
        continue
      }
      const ext = path.extname(entry.name).toLowerCase()
      if (!extensions.has(ext)) continue
      const relativePath = path.relative(packDir, fullPath).replace(/\\/g, '/')
      output.push({
        path: relativePath,
        url: `/api/video-pipeline/jobs/${jobId}/asset?path=${encodeURIComponent(relativePath)}`,
        kind: relativePath.startsWith('frames/') ? 'frame' : 'asset',
      })
      if (output.length >= 48) return
    }
  }

  for (const root of roots) walk(path.join(packDir, root), 0)
  return output
}

function buildJobResult(job: PipelineJob) {
  const manifest = readJsonFile(path.join(job.packDir, 'manifest.json'))
  const packageStatus = readJsonFile(path.join(job.packDir, 'package_status.json'))
  const analysisReport = readJsonFile(path.join(job.packDir, 'analysis_report.json'))
  const pipelineResult = readJsonFile(path.join(job.packDir, 'pipeline_result.json'))

  const overview = {
    theme_id: getNestedString(manifest, ['theme_id']) || job.themeId,
    display_name: getNestedString(manifest, ['display_name']),
    can_load_in_game: getNestedBool(packageStatus, ['validation', 'can_load_in_game']),
    validation_status: getNestedString(packageStatus, ['validation', 'status']),
    p1: {
      name: getNestedString(manifest, ['players', 'p1', 'name']),
      role: getNestedString(manifest, ['players', 'p1', 'role']),
      weapon: getNestedString(manifest, ['players', 'p1', 'attack_prop_name']),
      skill_taunt: getNestedString(manifest, ['players', 'p1', 'skill_taunt', 'text']),
    },
    p2: {
      name: getNestedString(manifest, ['players', 'p2', 'name']),
      role: getNestedString(manifest, ['players', 'p2', 'role']),
      weapon: getNestedString(manifest, ['players', 'p2', 'attack_prop_name']),
      skill_taunt: getNestedString(manifest, ['players', 'p2', 'skill_taunt', 'text']),
    },
    taunt: getNestedString(manifest, ['taunt', 'text']),
    package_files: {
      manifest: Boolean(manifest),
      package_status: Boolean(packageStatus),
      analysis_report: Boolean(analysisReport),
      pipeline_result: Boolean(pipelineResult),
    },
  }

  return {
    overview,
    assets: collectAssetFiles(job.packDir, job.id),
    manifest,
    package_status: packageStatus,
    analysis_report: analysisReport,
    pipeline_result: pipelineResult,
  }
}

function publicJob(job: PipelineJob) {
  if (job.status === 'completed' && !job.result) {
    job.result = buildJobResult(job)
  }

  return {
    id: job.id,
    themeId: job.themeId,
    status: job.status,
    progress: job.progress,
    message: job.message,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    videoName: job.videoName,
    stageTemplate: job.stageTemplate,
    frames: job.frames,
    exportTapFight: job.exportTapFight,
    generateStageAssets: job.generateStageAssets,
    structureOnly: job.structureOnly,
    uploadedBytes: job.uploadedBytes,
    exitCode: job.exitCode,
    error: job.error,
    logs: job.logs,
    result: job.result,
  }
}

function finishJob(job: PipelineJob, status: PipelineJobStatus, message: string, error?: string) {
  job.status = status
  job.progress = status === 'completed' ? 100 : job.progress
  job.message = message
  job.error = error
  job.updatedAt = new Date().toISOString()
  if (status === 'completed') {
    job.result = buildJobResult(job)
  }
}

function startPipelineJob(job: PipelineJob) {
  setTimeout(() => {
    job.status = 'running'
    job.progress = Math.max(job.progress, 12)
    job.message = 'pipeline started'
    job.updatedAt = new Date().toISOString()

    const args = [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      path.join(job.pipelineDir, 'package_video.ps1'),
      '-Video',
      job.videoPath,
      '-ThemeId',
      job.themeId,
      '-Frames',
      String(job.frames),
      '-DrawConcurrency',
      '2',
      '-DrawRetries',
      '2',
      '-DrawTimeoutMs',
      '300000',
      '-StageTemplate',
      job.stageTemplate,
    ]

    if (job.structureOnly) args.push('-StructureOnly')
    if (job.generateStageAssets) args.push('-GenerateStageAssets')
    if (job.exportTapFight) args.push('-ExportTapFight', '-TapFightDir', tapFightRoot)

    const child = spawn('powershell.exe', args, {
      cwd: job.pipelineDir,
      env: process.env,
      windowsHide: true,
    })

    job.pid = child.pid
    appendJobLog(job, `Started package_video.ps1 for ${job.themeId}`)

    const progressTimer = setInterval(() => {
      if (job.status !== 'running') {
        clearInterval(progressTimer)
        return
      }
      job.progress = Math.min(92, job.progress + 1)
      job.updatedAt = new Date().toISOString()
    }, 5000)

    child.stdout.on('data', (chunk: Buffer) => appendJobLog(job, chunk.toString('utf-8')))
    child.stderr.on('data', (chunk: Buffer) => appendJobLog(job, chunk.toString('utf-8')))

    child.on('error', (error) => {
      clearInterval(progressTimer)
      finishJob(job, 'failed', 'pipeline failed to start', error.message)
    })

    child.on('close', (code) => {
      clearInterval(progressTimer)
      job.exitCode = code
      job.packDir = path.join(job.pipelineDir, 'theme_packs', job.themeId)

      if (code === 0) {
        finishJob(job, 'completed', 'ThemeAssetPackage ready')
      } else {
        finishJob(job, 'failed', `pipeline exited with code ${code}`, job.logs.slice(-12).join('\n'))
      }
    })
  }, 0)
}

app.post('/api/video-pipeline/jobs', (req, res) => {
  const pipelineDir = resolveVideoPipelineDir()
  if (!pipelineDir) {
    res.status(500).json({ ok: false, error: 'video_theme_asset_pipeline not found; set VIDEO_PIPELINE_DIR.' })
    return
  }

  const jobId = makeJobId()
  const fileName = safeFileName(firstQueryValue(req.query.filename))
  const themeId = makeThemeId(firstQueryValue(req.query.themeId))
  const stageTemplate = safeSlug(firstQueryValue(req.query.stageTemplate), 'office_battle_001')
  const frames = clampNumber(Number(firstQueryValue(req.query.frames)), 1, 6, 3)
  const exportTapFight = firstQueryValue(req.query.exportTapFight) !== '0'
  const generateStageAssets = firstQueryValue(req.query.generateStageAssets) === '1'
  const structureOnly = firstQueryValue(req.query.structureOnly) === '1'
  const uploadDir = path.join(pipelineDir, 'input_videos', 'web_uploads')
  fs.mkdirSync(uploadDir, { recursive: true })

  const videoPath = path.join(uploadDir, `${jobId}_${fileName}`)
  const now = new Date().toISOString()
  const job: PipelineJob = {
    id: jobId,
    themeId,
    status: 'uploading',
    progress: 2,
    message: 'uploading video',
    createdAt: now,
    updatedAt: now,
    videoName: fileName,
    videoPath,
    pipelineDir,
    packDir: path.join(pipelineDir, 'theme_packs', themeId),
    stageTemplate,
    frames,
    exportTapFight,
    generateStageAssets,
    structureOnly,
    uploadedBytes: 0,
    logs: [],
  }
  pipelineJobs.set(jobId, job)

  let responded = false
  const contentLength = Number(req.headers['content-length'] ?? 0)
  const output = createWriteStream(videoPath)

  req.on('data', (chunk: Buffer) => {
    job.uploadedBytes += chunk.length
    if (contentLength > 0) {
      job.progress = Math.max(2, Math.min(8, Math.round((job.uploadedBytes / contentLength) * 8)))
    }
    job.updatedAt = new Date().toISOString()
  })

  req.on('aborted', () => {
    finishJob(job, 'failed', 'upload aborted', 'The browser closed the upload before completion.')
    output.destroy()
  })

  output.on('error', (error) => {
    finishJob(job, 'failed', 'upload failed', error.message)
    if (!responded) {
      responded = true
      res.status(500).json(publicJob(job))
    }
  })

  output.on('finish', () => {
    if (job.status === 'failed') return
    job.status = 'queued'
    job.progress = Math.max(job.progress, 9)
    job.message = 'video uploaded'
    job.updatedAt = new Date().toISOString()
    if (!responded) {
      responded = true
      res.json(publicJob(job))
    }
    startPipelineJob(job)
  })

  req.pipe(output)
})

app.get('/api/video-pipeline/jobs/:id', (req, res) => {
  const job = pipelineJobs.get(req.params.id)
  if (!job) {
    res.status(404).json({ ok: false, error: 'job not found' })
    return
  }
  res.json(publicJob(job))
})

app.get('/api/video-pipeline/jobs/:id/asset', (req, res) => {
  const job = pipelineJobs.get(req.params.id)
  if (!job || !job.packDir) {
    res.status(404).send('job not found')
    return
  }

  const relativePath = firstQueryValue(req.query.path)
  const filePath = path.resolve(job.packDir, relativePath)
  const packRoot = path.resolve(job.packDir)
  if (!isInside(packRoot, filePath) || !fs.existsSync(filePath)) {
    res.status(404).send('asset not found')
    return
  }

  res.sendFile(filePath)
})

// ============== 房间管理（纯内存） ==============

interface Room {
  id: string
  p1: string | null
  p2: string | null
  p1Theme: string
  p2Theme: string
  p1Ready: boolean
  p2Ready: boolean
}

const rooms = new Map<string, Room>()
let quickMatchQueue: string[] = []
const quickMatchThemes = new Map<string, string>()

function compactQuickMatchQueue() {
  const seen = new Set<string>()
  quickMatchQueue = quickMatchQueue.filter((socketId, index, queue) => {
    const keep = queue.indexOf(socketId) === index && !seen.has(socketId) && io.sockets.sockets.has(socketId)
    seen.add(socketId)
    if (!keep) quickMatchThemes.delete(socketId)
    return keep
  })
}

function removeFromQuickMatchQueue(socketId: string) {
  const before = quickMatchQueue.length
  quickMatchQueue = quickMatchQueue.filter((id) => id !== socketId)
  quickMatchThemes.delete(socketId)
  if (quickMatchQueue.length !== before) {
    broadcastQuickMatchQueue()
  }
}

function broadcastQuickMatchQueue() {
  compactQuickMatchQueue()
  for (const socketId of quickMatchQueue) {
    io.to(socketId).emit('match_waiting', {
      waitingPlayers: quickMatchQueue.length,
      availableOpponents: Math.max(0, quickMatchQueue.length - 1),
    })
  }
}

function makeQuickRoomId() {
  return `auto_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

io.on('connection', (socket) => {
  console.log(`[connect] ${socket.id}`)

  // 创建房间
  socket.on('create_room', (roomId: string, themePayload?: unknown) => {
    removeFromQuickMatchQueue(socket.id)
    if (rooms.has(roomId)) {
      socket.emit('error_msg', '房间已存在')
      return
    }
    const room: Room = {
      id: roomId,
      p1: socket.id, p2: null,
      p1Theme: resolveThemeId(themePayload), p2Theme: DEFAULT_THEME_ID,
      p1Ready: false, p2Ready: false,
    }
    rooms.set(roomId, room)
    socket.join(roomId)
    socket.emit('room_created', { roomId })
    console.log(`[room] ${roomId} created by ${socket.id}`)
  })

  // 加入房间
  socket.on('join_room', (roomId: string, themePayload?: unknown) => {
    removeFromQuickMatchQueue(socket.id)
    const room = rooms.get(roomId)
    if (!room) {
      socket.emit('error_msg', '房间不存在')
      return
    }
    if (room.p2) {
      socket.emit('error_msg', '房间已满')
      return
    }
    room.p2 = socket.id
    room.p2Theme = resolveThemeId(themePayload)
    socket.join(roomId)

    // 通知双方开始
    io.to(roomId).emit('match_start', {
      roomId,
      p1: { id: room.p1, role: 'melee', themeId: room.p1Theme },
      p2: { id: room.p2, role: 'ranged', themeId: room.p2Theme },
    })
    console.log(`[room] ${roomId} full, match start`)
  })

  // 自动匹配：第一个玩家进入等待队列，第二个玩家立即配对开局
  socket.on('quick_match', (themePayload?: unknown) => {
    // 已在房间中的玩家不能再次匹配
    for (const [roomId, room] of rooms) {
      if (room.p1 === socket.id || room.p2 === socket.id) {
        socket.emit('error_msg', '你已在房间中')
        return
      }
    }
    const themeId = resolveThemeId(themePayload)
    removeFromQuickMatchQueue(socket.id)
    compactQuickMatchQueue()

    const opponentId = quickMatchQueue.shift()
    if (!opponentId) {
      quickMatchThemes.set(socket.id, themeId)
      quickMatchQueue.push(socket.id)
      socket.emit('match_waiting', {
        waitingPlayers: quickMatchQueue.length,
        availableOpponents: 0,
      })
      console.log(`[match] ${socket.id} waiting for quick match`)
      return
    }

    const opponentSocket = io.sockets.sockets.get(opponentId)
    if (!opponentSocket) {
      quickMatchThemes.delete(opponentId)
      quickMatchThemes.set(socket.id, themeId)
      quickMatchQueue.push(socket.id)
      broadcastQuickMatchQueue()
      return
    }

    const roomId = makeQuickRoomId()
    const room: Room = {
      id: roomId,
      p1: opponentId, p2: socket.id,
      p1Theme: resolveThemeId(quickMatchThemes.get(opponentId)), p2Theme: themeId,
      p1Ready: false, p2Ready: false,
    }
    quickMatchThemes.delete(opponentId)
    rooms.set(roomId, room)
    opponentSocket.join(roomId)
    socket.join(roomId)

    opponentSocket.emit('match_start', {
      roomId,
      role: 'p1',
      p1: { id: room.p1, role: 'melee', themeId: room.p1Theme },
      p2: { id: room.p2, role: 'ranged', themeId: room.p2Theme },
    })
    socket.emit('match_start', {
      roomId,
      role: 'p2',
      p1: { id: room.p1, role: 'melee', themeId: room.p1Theme },
      p2: { id: room.p2, role: 'ranged', themeId: room.p2Theme },
    })
    broadcastQuickMatchQueue()
    console.log(`[match] ${roomId} quick match start: ${opponentId} vs ${socket.id}`)
  })

  socket.on('cancel_quick_match', () => {
    removeFromQuickMatchQueue(socket.id)
    socket.emit('match_cancelled')
  })

  // 对战输入快照转发
  socket.on('input_snapshot', (data: { roomId: string } & Record<string, unknown>) => {
    socket.to(data.roomId).emit('opponent_snapshot', data)
  })

  // 攻击事件转发
  socket.on('attack_event', (data: { roomId: string }) => {
    socket.to(data.roomId).emit('opponent_attack', data)
  })

  // 双方就绪确认
  socket.on('ready_to_start', (data: { roomId: string }) => {
    const room = rooms.get(data.roomId)
    if (!room) return
    if (room.p1 === socket.id) room.p1Ready = true
    if (room.p2 === socket.id) room.p2Ready = true
    if (room.p1Ready && room.p2Ready) {
      io.to(room.id).emit('game_begin', { serverNow: Date.now() })
      console.log(`[room] ${room.id} both ready, game begin`)
    }
  })

  // 伤害事件转发
  socket.on('hit_event', (data: { roomId: string }) => {
    socket.to(data.roomId).emit('opponent_hit', data)
  })

  // 投掷物事件转发
  socket.on('projectile_event', (data: { roomId: string }) => {
    socket.to(data.roomId).emit('opponent_projectile', data)
  })

  // HP 同步（保留备用）
  socket.on('hp_sync', (data: { roomId: string }) => {
    socket.to(data.roomId).emit('opponent_hp', data)
  })

  // 离开房间
  socket.on('leave_room', (roomId: string) => {
    removeFromQuickMatchQueue(socket.id)
    const room = rooms.get(roomId)
    if (room) {
      socket.to(roomId).emit('opponent_left')
      if (room.p1 === socket.id || room.p2 === socket.id) {
        rooms.delete(roomId)
        console.log(`[room] ${roomId} closed`)
      }
    }
    socket.leave(roomId)
  })

  socket.on('disconnect', () => {
    removeFromQuickMatchQueue(socket.id)
    // 清理该玩家所在的所有房间
    for (const [roomId, room] of rooms) {
      if (room.p1 === socket.id || room.p2 === socket.id) {
        socket.to(roomId).emit('opponent_left')
        rooms.delete(roomId)
        console.log(`[room] ${roomId} closed (disconnect)`)
      }
    }
  })
})

httpServer.listen(port, () => {
  console.log(`tap-fight server listening on http://localhost:${port}`)
})
