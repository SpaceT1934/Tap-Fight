import express from 'express'
import { createServer } from 'node:http'
import { Server } from 'socket.io'
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
