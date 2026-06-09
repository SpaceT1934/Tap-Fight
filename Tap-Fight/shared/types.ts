// 前后端共享类型定义

// ==================== 玩家输入 ====================

export interface InputSnapshot {
  seq: number
  pos: { x: number; y: number }
  state: 'idle' | 'walk' | 'jump' | 'attack' | 'taunt' | 'hurt'
  facing: -1 | 1
}

// ==================== 攻击事件 ====================

export interface AttackEvent {
  attackerId: string
  attackType: 'melee' | 'ranged'
  pos: { x: number; y: number }
  facing: -1 | 1
  tick: number
}

export interface TauntEvent {
  playerId: string
  pos: { x: number; y: number }
  text: string
}

// ==================== 服务端广播 ====================

export interface ProjectileState {
  id: string
  pos: { x: number; y: number }
  vel: { x: number; y: number }
  ownerId: string
}

export interface PlayerState {
  id: string
  nickname: string
  pos: { x: number; y: number }
  vel: { x: number; y: number }
  state: string
  facing: -1 | 1
  hp: number
  maxHp: number
  stunned: boolean
  role: 'melee' | 'ranged'
}

export interface GameState {
  tick: number
  players: PlayerState[]
  projectiles: ProjectileState[]
}

// ==================== 事件结果 ====================

export interface AttackResult {
  attackerId: string
  targetId: string | null
  hit: boolean
  damage: number
}

export interface TauntResult {
  playerId: string
  targetId: string | null
  hit: boolean
  stunMs: number
}

export interface GameOver {
  winnerId: string
  winnerNickname: string
  reason: string
}

// ==================== 匹配 ====================

export interface Matched {
  roomId: string
  opponent: {
    id: string
    nickname: string
  }
  themeId: string
  yourRole: 'melee' | 'ranged'
  tick: number
}

// ==================== Socket.IO 事件名 ====================

export enum ClientEvent {
  JoinQueue = 'join_queue',
  InputSnapshot = 'input_snapshot',
  AttackEvent = 'attack_event',
  TauntEvent = 'taunt_event',
}

export enum ServerEvent {
  Matched = 'matched',
  GameState = 'game_state',
  AttackResult = 'attack_result',
  TauntResult = 'taunt_result',
  GameOver = 'game_over',
  OpponentLeft = 'opponent_left',
}
