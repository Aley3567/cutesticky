<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ArcadeAudio, arcadeLoop } from './audio'
import { readHighscore, writeHighscore } from './highscore'
import type { GameResult, GameRuntimeProps } from './registry'

const props = defineProps<GameRuntimeProps>()
const emit = defineEmits<{ exit: []; finish: [result: GameResult] }>()

type Direction = -1 | 1

interface Rect { x: number; y: number; w: number; h: number }
interface Block extends Rect { kind: 'brick' | 'bonus' | 'used' | 'ground' | 'pipe' | 'flag' }
interface Coin { x: number; y: number; taken: boolean; float: number }
interface Enemy extends Rect { vx: number; alive: boolean; startX: number }
interface Player extends Rect {
  vx: number; vy: number; facing: Direction; grounded: boolean; invuln: number
}

interface LevelDef {
  worldW: number
  startX: number
  blocks: (Rect & { kind: string })[]
  coins: { x: number; y: number }[]
  enemies: { x: number; y: number; vx: number }[]
}

const LEVELS: LevelDef[] = [
  {
    worldW: 1480, startX: 42,
    blocks: [
      { x: 0, y: 164, w: 580, h: 26, kind: 'ground' },
      { x: 630, y: 164, w: 230, h: 26, kind: 'ground' },
      { x: 910, y: 164, w: 570, h: 26, kind: 'ground' },
      { x: 150, y: 108, w: 22, h: 22, kind: 'bonus' },
      { x: 172, y: 108, w: 22, h: 22, kind: 'brick' },
      { x: 238, y: 82, w: 22, h: 22, kind: 'bonus' },
      { x: 326, y: 116, w: 70, h: 14, kind: 'brick' },
      { x: 458, y: 132, w: 36, h: 32, kind: 'pipe' },
      { x: 690, y: 108, w: 22, h: 22, kind: 'bonus' },
      { x: 740, y: 90, w: 66, h: 14, kind: 'brick' },
      { x: 980, y: 132, w: 36, h: 32, kind: 'pipe' },
      { x: 1110, y: 108, w: 88, h: 14, kind: 'brick' },
      { x: 1340, y: 58, w: 10, h: 106, kind: 'flag' },
    ],
    coins: [
      { x: 155, y: 76 }, { x: 243, y: 52 }, { x: 343, y: 86 },
      { x: 714, y: 76 }, { x: 763, y: 60 }, { x: 1138, y: 78 },
    ],
    enemies: [
      { x: 290, y: 142, vx: -0.45 },
      { x: 780, y: 142, vx: -0.42 },
      { x: 1048, y: 142, vx: -0.5 },
    ],
  },
  {
    worldW: 1900, startX: 42,
    blocks: [
      { x: 0, y: 164, w: 420, h: 26, kind: 'ground' },
      { x: 480, y: 164, w: 180, h: 26, kind: 'ground' },
      { x: 720, y: 164, w: 300, h: 26, kind: 'ground' },
      { x: 1080, y: 164, w: 160, h: 26, kind: 'ground' },
      { x: 1300, y: 164, w: 600, h: 26, kind: 'ground' },
      { x: 200, y: 120, w: 22, h: 22, kind: 'bonus' },
      { x: 222, y: 120, w: 22, h: 22, kind: 'brick' },
      { x: 244, y: 120, w: 22, h: 22, kind: 'bonus' },
      { x: 360, y: 132, w: 36, h: 32, kind: 'pipe' },
      { x: 510, y: 110, w: 66, h: 14, kind: 'brick' },
      { x: 580, y: 88, w: 44, h: 14, kind: 'brick' },
      { x: 750, y: 100, w: 22, h: 22, kind: 'bonus' },
      { x: 830, y: 80, w: 88, h: 14, kind: 'brick' },
      { x: 900, y: 132, w: 36, h: 32, kind: 'pipe' },
      { x: 1100, y: 108, w: 22, h: 22, kind: 'bonus' },
      { x: 1340, y: 120, w: 66, h: 14, kind: 'brick' },
      { x: 1420, y: 90, w: 44, h: 14, kind: 'brick' },
      { x: 1500, y: 66, w: 66, h: 14, kind: 'brick' },
      { x: 1620, y: 132, w: 36, h: 32, kind: 'pipe' },
      { x: 1760, y: 58, w: 10, h: 106, kind: 'flag' },
    ],
    coins: [
      { x: 205, y: 88 }, { x: 249, y: 88 }, { x: 530, y: 78 },
      { x: 593, y: 58 }, { x: 755, y: 68 }, { x: 855, y: 50 },
      { x: 1105, y: 76 }, { x: 1440, y: 58 },
    ],
    enemies: [
      { x: 320, y: 142, vx: -0.5 },
      { x: 520, y: 142, vx: -0.42 },
      { x: 800, y: 142, vx: -0.55 },
      { x: 1150, y: 142, vx: -0.48 },
      { x: 1500, y: 142, vx: -0.52 },
    ],
  },
  {
    worldW: 2300, startX: 42,
    blocks: [
      { x: 0, y: 164, w: 320, h: 26, kind: 'ground' },
      { x: 390, y: 164, w: 140, h: 26, kind: 'ground' },
      { x: 600, y: 164, w: 200, h: 26, kind: 'ground' },
      { x: 870, y: 164, w: 120, h: 26, kind: 'ground' },
      { x: 1060, y: 164, w: 300, h: 26, kind: 'ground' },
      { x: 1430, y: 164, w: 140, h: 26, kind: 'ground' },
      { x: 1640, y: 164, w: 660, h: 26, kind: 'ground' },
      { x: 160, y: 120, w: 22, h: 22, kind: 'bonus' },
      { x: 260, y: 132, w: 36, h: 32, kind: 'pipe' },
      { x: 400, y: 108, w: 44, h: 14, kind: 'brick' },
      { x: 460, y: 80, w: 44, h: 14, kind: 'brick' },
      { x: 630, y: 110, w: 22, h: 22, kind: 'bonus' },
      { x: 652, y: 110, w: 22, h: 22, kind: 'brick' },
      { x: 674, y: 110, w: 22, h: 22, kind: 'bonus' },
      { x: 740, y: 82, w: 66, h: 14, kind: 'brick' },
      { x: 880, y: 120, w: 44, h: 14, kind: 'brick' },
      { x: 940, y: 90, w: 22, h: 22, kind: 'bonus' },
      { x: 1000, y: 132, w: 36, h: 32, kind: 'pipe' },
      { x: 1100, y: 108, w: 66, h: 14, kind: 'brick' },
      { x: 1180, y: 78, w: 88, h: 14, kind: 'brick' },
      { x: 1280, y: 54, w: 44, h: 14, kind: 'brick' },
      { x: 1450, y: 110, w: 44, h: 14, kind: 'brick' },
      { x: 1560, y: 80, w: 44, h: 14, kind: 'brick' },
      { x: 1700, y: 100, w: 22, h: 22, kind: 'bonus' },
      { x: 1800, y: 132, w: 36, h: 32, kind: 'pipe' },
      { x: 1900, y: 80, w: 110, h: 14, kind: 'brick' },
      { x: 2050, y: 132, w: 36, h: 32, kind: 'pipe' },
      { x: 2160, y: 58, w: 10, h: 106, kind: 'flag' },
    ],
    coins: [
      { x: 165, y: 88 }, { x: 420, y: 76 }, { x: 475, y: 50 },
      { x: 635, y: 78 }, { x: 679, y: 78 }, { x: 760, y: 52 },
      { x: 945, y: 58 }, { x: 1125, y: 76 }, { x: 1210, y: 46 },
      { x: 1295, y: 24 }, { x: 1705, y: 68 }, { x: 1940, y: 50 },
    ],
    enemies: [
      { x: 220, y: 142, vx: -0.5 },
      { x: 430, y: 142, vx: -0.55 },
      { x: 700, y: 142, vx: -0.48 },
      { x: 920, y: 142, vx: -0.6 },
      { x: 1150, y: 142, vx: -0.52 },
      { x: 1470, y: 142, vx: -0.55 },
      { x: 1750, y: 142, vx: -0.58 },
    ],
  },
]

const canvasRef = ref<HTMLCanvasElement | null>(null)
const score = ref(0)
const coins = ref(0)
const lives = ref(3)
const message = ref('方向键移动，空格跳跃')
const levelNum = ref(1)
const highscore = ref(0)

const view = { w: 288, h: 190 }
const gravity = 0.48
const keys = new Set<string>()
const pressed = { left: false, right: false, jump: false }

let ctx: CanvasRenderingContext2D | null = null
let raf = 0
let cameraX = 0
let won = false
let lastTime = 0
let worldW = 1480
let resultEmitted = false

let flagDescending = false
let flagProgress = 0
let flagPoleX = 0
let flagTopY = 0
let flagPoleH = 0
let levelTransition = 0

const player: Player = {
  x: 42, y: 108, w: 18, h: 24,
  vx: 0, vy: 0, facing: 1, grounded: false, invuln: 0,
}

let blocks: Block[] = []
let coinList: Coin[] = []
let enemies: Enemy[] = []

let audio: ArcadeAudio | null = null

function loadLevel(index: number) {
  const def = LEVELS[index]
  worldW = def.worldW
  blocks = def.blocks.map(b => ({ ...b, kind: b.kind as Block['kind'] }))
  coinList = def.coins.map(c => ({ ...c, taken: false, float: 0 }))
  enemies = def.enemies.map(e => ({
    x: e.x, y: e.y, w: 20, h: 18, vx: e.vx, alive: true, startX: e.x,
  }))

  const flag = blocks.find(b => b.kind === 'flag')
  if (flag) {
    flagPoleX = flag.x
    flagTopY = flag.y
    flagPoleH = flag.h
  }

  player.x = def.startX
  player.y = 108
  player.vx = 0
  player.vy = 0
  player.facing = 1
  player.grounded = false
  player.invuln = 0
  cameraX = 0
  won = false
  flagDescending = false
  flagProgress = 0
  levelTransition = 0
}

onMounted(async () => {
  const canvas = canvasRef.value
  if (!canvas) return
  ctx = canvas.getContext('2d')
  highscore.value = await readHighscore('mario')
  audio = new ArcadeAudio(props.muted, props.volume)
  audio.setPaused(props.paused)
  audio.startLoop(arcadeLoop, 150)
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
  resetGame()
  raf = requestAnimationFrame(loop)
})

onBeforeUnmount(() => {
  if (score.value > highscore.value) void saveHighscore()
  cancelAnimationFrame(raf)
  audio?.close()
  keys.clear()
  pressed.left = false
  pressed.right = false
  pressed.jump = false
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('keyup', handleKeyUp)
})

watch(() => props.muted, muted => audio?.setMuted(muted))
watch(() => props.volume, volume => audio?.setVolume(volume))
watch(() => props.paused, paused => {
  audio?.setPaused(paused)
  if (paused) {
    keys.clear()
    pressed.left = false
    pressed.right = false
    pressed.jump = false
  } else {
    lastTime = performance.now()
  }
})

function handleKeyDown(event: KeyboardEvent) {
  if (event.code === 'Escape') {
    event.preventDefault()
    emit('exit')
    return
  }
  if (props.paused) return
  if (['ArrowLeft', 'ArrowRight', 'Space', 'KeyA', 'KeyD', 'KeyW'].includes(event.code)) {
    event.preventDefault()
    keys.add(event.code)
  }
}

function handleKeyUp(event: KeyboardEvent) { keys.delete(event.code) }

function setPress(key: 'left' | 'right' | 'jump', active: boolean) {
  if (props.paused && active) return
  pressed[key] = active
}

function restart() { resetGame() }

function resetGame() {
  resultEmitted = false
  score.value = 0
  coins.value = 0
  lives.value = 3
  levelNum.value = 1
  message.value = '第 1 关 - 方向键移动，空格跳跃'
  loadLevel(0)
}

function loop(time: number) {
  const dt = Math.min(2, (time - lastTime) / 16.67 || 1)
  lastTime = time
  if (!props.paused) update(dt)
  draw()
  raf = requestAnimationFrame(loop)
}

function update(dt: number) {
  if (levelTransition > 0) {
    levelTransition -= dt
    if (levelTransition <= 0) {
      const next = levelNum.value - 1
      if (next < LEVELS.length) {
        loadLevel(next)
        message.value = `第 ${levelNum.value} 关`
      }
    }
    return
  }

  if (won) return

  if (flagDescending) {
    flagProgress = Math.min(1, flagProgress + 0.012 * dt)
    player.y = flagTopY + flagPoleH * flagProgress - player.h
    player.x = flagPoleX - player.w + 2
    player.facing = 1
    if (flagProgress >= 1) {
      flagDescending = false
      won = true
      score.value += 500
      if (levelNum.value < LEVELS.length) {
        levelNum.value += 1
        message.value = `通关! 进入第 ${levelNum.value} 关...`
        levelTransition = 80
      } else {
        message.value = '全部通关! 按重开再来'
        void finishGame('全部通关', `完成 ${LEVELS.length} 个关卡。`)
      }
    }
    return
  }

  const movingLeft = keys.has('ArrowLeft') || keys.has('KeyA') || pressed.left
  const movingRight = keys.has('ArrowRight') || keys.has('KeyD') || pressed.right
  const jumping = keys.has('Space') || keys.has('KeyW') || pressed.jump
  const accel = 0.46 * dt
  const maxSpeed = 2.4

  if (movingLeft) { player.vx -= accel; player.facing = -1 }
  if (movingRight) { player.vx += accel; player.facing = 1 }
  if (!movingLeft && !movingRight) player.vx *= 0.78
  player.vx = clamp(player.vx, -maxSpeed, maxSpeed)

  if (jumping && player.grounded) {
    player.vy = -8.2
    player.grounded = false
  }

  player.vy += gravity * dt
  movePlayer(player.vx * dt, 0)
  movePlayer(0, player.vy * dt)
  player.x = clamp(player.x, 0, worldW - player.w)

  if (player.y > view.h + 40) hurtPlayer(true)
  if (player.invuln > 0) player.invuln -= dt

  enemies.forEach(e => updateEnemy(e, dt))
  coinList.forEach(coin => {
    if (!coin.taken) {
      coin.float += dt * 0.08
      if (overlap(player, { x: coin.x - 7, y: coin.y - 7, w: 14, h: 14 })) takeCoin(coin)
    }
  })

  if (player.x + player.w > flagPoleX && player.x < flagPoleX + 10 && !won) {
    flagDescending = true
    flagProgress = 0
    player.vx = 0
    player.vy = 0
  }

  cameraX = clamp(player.x - view.w * 0.42, 0, worldW - view.w)
}

function movePlayer(dx: number, dy: number) {
  player.x += dx; player.y += dy
  if (dy !== 0) player.grounded = false
  for (const block of blocks) {
    if (!solid(block) || !overlap(player, block)) continue
    if (dx > 0) player.x = block.x - player.w
    if (dx < 0) player.x = block.x + block.w
    if (dy > 0) { player.y = block.y - player.h; player.vy = 0; player.grounded = true }
    if (dy < 0) { player.y = block.y + block.h; player.vy = 0.8; bumpBlock(block) }
  }
}

function updateEnemy(enemy: Enemy, dt: number) {
  if (!enemy.alive) return
  enemy.x += enemy.vx * dt
  enemy.y += gravity * dt
  for (const block of blocks) {
    if (!solid(block) || !overlap(enemy, block)) continue
    if (enemy.vx > 0) { enemy.x = block.x - enemy.w; enemy.vx *= -1 }
    else { enemy.x = block.x + block.w; enemy.vx *= -1 }
  }
  if (enemy.y > 142) enemy.y = 142
  if (overlap(player, enemy) && player.invuln <= 0) {
    if (player.vy > 1.5 && player.y + player.h - enemy.y < 14) {
      enemy.alive = false; player.vy = -5.4; score.value += 100
      message.value = '踩掉一个敌人!'
    } else { hurtPlayer(false) }
  }
}

function bumpBlock(block: Block) {
  if (block.kind !== 'bonus') return
  block.kind = 'used'
  coins.value += 1; score.value += 50
  audio?.tone({ freq: 784, duration: 0.07 })
  message.value = '隐藏金币 +1'
}

function takeCoin(coin: Coin) {
  coin.taken = true; coins.value += 1; score.value += 30
  audio?.tone({ freq: 988, duration: 0.06 })
}

function hurtPlayer(fell: boolean) {
  lives.value -= 1
  player.invuln = 90
  if (lives.value <= 0) {
    message.value = '失败! 按重开再试'
    player.x = 42; player.y = 108; player.vx = 0; player.vy = 0
    won = true
    void finishGame('闯关失败', `到达第 ${levelNum.value} 关。`)
    return
  }
  message.value = `受伤了! 还剩 ${lives.value} 条命`
  const def = LEVELS[levelNum.value - 1]
  player.x = fell ? Math.max(def.startX, cameraX + 16) : Math.max(def.startX, player.x - 44)
  player.y = 108; player.vx = 0; player.vy = 0
}

async function saveHighscore() {
  highscore.value = await writeHighscore('mario', score.value)
}

async function finishGame(title: string, detail: string) {
  if (resultEmitted) return
  resultEmitted = true
  await saveHighscore()
  emit('finish', { title, score: score.value, detail })
}

// ── Drawing ──

function draw() {
  if (!ctx) return
  ctx.clearRect(0, 0, view.w, view.h)
  drawSky(); drawWorld(); drawPlayer()

  if (levelTransition > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillRect(0, 0, view.w, view.h)
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 18px system-ui'
    ctx.textAlign = 'center'
    ctx.fillText(`第 ${levelNum.value} 关`, view.w / 2, view.h / 2 - 4)
    ctx.font = '11px system-ui'
    ctx.fillText('准备...', view.w / 2, view.h / 2 + 16)
  }
}

function drawSky() {
  if (!ctx) return
  const g = ctx.createLinearGradient(0, 0, 0, view.h)
  g.addColorStop(0, '#8fd7ff'); g.addColorStop(0.62, '#d8f4ff'); g.addColorStop(1, '#fff5d0')
  ctx.fillStyle = g; ctx.fillRect(0, 0, view.w, view.h)
  drawCloud(52 - cameraX * 0.18, 32, 1)
  drawCloud(220 - cameraX * 0.12, 46, 0.75)
  drawCloud(400 - cameraX * 0.15, 28, 0.9)
  drawHill(32 - cameraX * 0.28, 164, 58, '#8ecf61')
  drawHill(190 - cameraX * 0.23, 168, 74, '#6fbe58')
  drawHill(360 - cameraX * 0.2, 166, 50, '#8ecf61')
}

function drawWorld() {
  if (!ctx) return
  blocks.forEach(drawBlock)
  coinList.forEach(drawCoin)
  enemies.forEach(drawEnemy)
}

function drawBlock(block: Block) {
  if (!ctx) return
  const x = Math.round(block.x - cameraX)
  if (x + block.w < -20 || x > view.w + 20) return

  if (block.kind === 'ground') {
    ctx.fillStyle = '#c17832'; ctx.fillRect(x, block.y, block.w, block.h)
    ctx.fillStyle = '#7fbd4a'; ctx.fillRect(x, block.y, block.w, 7)
    for (let px = x; px < x + block.w; px += 18) {
      ctx.fillStyle = 'rgba(92,48,24,0.22)'; ctx.fillRect(px, block.y + 12, 10, 2)
    }
    return
  }
  if (block.kind === 'pipe') {
    ctx.fillStyle = '#159e58'; ctx.fillRect(x + 4, block.y + 8, block.w - 8, block.h - 8)
    ctx.fillStyle = '#20bd6c'; ctx.fillRect(x, block.y, block.w, 12)
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(x + 7, block.y + 3, 6, block.h - 4)
    return
  }
  if (block.kind === 'flag') {
    ctx.fillStyle = '#6b4b2a'; ctx.fillRect(x + 3, block.y, 4, block.h)
    ctx.fillStyle = '#ffd700'
    ctx.beginPath(); ctx.arc(x + 5, block.y, 4, 0, Math.PI * 2); ctx.fill()
    const flagY = block.y + 8 + (flagDescending || won ? flagProgress * (block.h - 36) : 0)
    ctx.fillStyle = '#ff4444'
    ctx.beginPath()
    ctx.moveTo(x + 7, flagY)
    ctx.lineTo(x + 44, flagY + 10)
    ctx.lineTo(x + 7, flagY + 22)
    ctx.closePath(); ctx.fill()
    return
  }
  ctx.fillStyle = block.kind === 'used' ? '#b28b61' : block.kind === 'bonus' ? '#f2b335' : '#bc6a2f'
  ctx.fillRect(x, block.y, block.w, block.h)
  ctx.strokeStyle = 'rgba(90,48,25,0.3)'; ctx.strokeRect(x + 0.5, block.y + 0.5, block.w - 1, block.h - 1)
  ctx.fillStyle = 'rgba(255,255,255,0.26)'; ctx.fillRect(x + 3, block.y + 3, block.w - 6, 3)
  if (block.kind === 'bonus') {
    ctx.fillStyle = '#fff6c9'; ctx.font = 'bold 16px system-ui'; ctx.textAlign = 'center'
    ctx.fillText('?', x + block.w / 2, block.y + 16)
  }
}

function drawCoin(coin: Coin) {
  if (!ctx || coin.taken) return
  const bob = Math.sin(coin.float) * 2
  const x = coin.x - cameraX
  if (x < -20 || x > view.w + 20) return
  ctx.fillStyle = '#ffd84e'; ctx.beginPath()
  ctx.ellipse(x, coin.y + bob, 6, 8, 0, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = '#d5961c'; ctx.stroke()
  ctx.fillStyle = 'rgba(255,255,255,0.48)'; ctx.fillRect(x - 2, coin.y - 5 + bob, 2, 10)
}

function drawEnemy(enemy: Enemy) {
  if (!ctx || !enemy.alive) return
  const x = enemy.x - cameraX
  if (x < -24 || x > view.w + 24) return
  ctx.fillStyle = '#7b4a31'; ctx.beginPath(); ctx.roundRect(x, enemy.y, enemy.w, enemy.h, 6); ctx.fill()
  ctx.fillStyle = '#f6dfb1'; ctx.fillRect(x + 4, enemy.y + 5, 4, 3); ctx.fillRect(x + 12, enemy.y + 5, 4, 3)
  ctx.fillStyle = '#2a1b12'; ctx.fillRect(x + 4, enemy.y + enemy.h - 2, 5, 2); ctx.fillRect(x + 12, enemy.y + enemy.h - 2, 5, 2)
}

function drawPlayer() {
  if (!ctx || (player.invuln > 0 && Math.floor(player.invuln / 6) % 2 === 0)) return
  const x = Math.round(player.x - cameraX), y = Math.round(player.y)
  ctx.fillStyle = '#286bd6'; ctx.fillRect(x + 5, y + 11, 9, 11)
  ctx.fillStyle = '#f15b3d'; ctx.fillRect(x + 3, y + 6, 13, 9)
  ctx.fillStyle = '#f0c18d'; ctx.fillRect(x + 5, y + 1, 11, 9)
  ctx.fillStyle = '#d8442e'; ctx.fillRect(x + 3, y, 14, 4); ctx.fillRect(x + 9, y - 3, 9, 4)
  ctx.fillStyle = '#2b1c16'; ctx.fillRect(player.facing === 1 ? x + 13 : x + 5, y + 4, 2, 2)
  ctx.fillStyle = '#6b3b24'; ctx.fillRect(x + 3, y + 22, 6, 3); ctx.fillRect(x + 12, y + 22, 6, 3)
}

function drawCloud(x: number, y: number, s: number) {
  if (!ctx) return
  ctx.fillStyle = 'rgba(255,255,255,0.86)'; ctx.beginPath()
  ctx.arc(x, y, 12 * s, 0, Math.PI * 2)
  ctx.arc(x + 13 * s, y - 5 * s, 14 * s, 0, Math.PI * 2)
  ctx.arc(x + 28 * s, y, 11 * s, 0, Math.PI * 2); ctx.fill()
}

function drawHill(x: number, y: number, r: number, color: string) {
  if (!ctx) return
  ctx.fillStyle = color; ctx.beginPath()
  ctx.arc(x + r, y, r, Math.PI, 0)
  ctx.lineTo(x + r * 2, view.h); ctx.lineTo(x, view.h); ctx.closePath(); ctx.fill()
}

function solid(block: Block) { return block.kind !== 'flag' }
function overlap(a: Rect, b: Rect) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y }
function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)) }
</script>

<template>
  <div class="game-shell">
    <div class="game-hud">
      <span>关{{ levelNum }}/{{ LEVELS.length }}</span>
      <span>分 {{ score }}</span>
      <span>高 {{ highscore }}</span>
      <span>币 {{ coins }}</span>
      <span>命 {{ lives }}</span>
    </div>
    <canvas ref="canvasRef" class="game-canvas" :width="view.w" :height="view.h" />
    <div class="game-message">{{ message }}</div>
    <div class="game-controls">
      <div class="move-controls">
        <button class="control-btn" @pointerdown.prevent="setPress('left',true)" @pointerup.prevent="setPress('left',false)" @pointerleave="setPress('left',false)">&#8592;</button>
        <button class="control-btn" @pointerdown.prevent="setPress('right',true)" @pointerup.prevent="setPress('right',false)" @pointerleave="setPress('right',false)">&#8594;</button>
      </div>
      <button class="control-btn jump-btn" @pointerdown.prevent="setPress('jump',true)" @pointerup.prevent="setPress('jump',false)" @pointerleave="setPress('jump',false)">跳</button>
      <button class="restart-btn" @click="restart">重开</button>
    </div>
  </div>
</template>

<style scoped>
.game-shell {
  display: grid;
  grid-template-rows: 20px 190px 20px 38px;
  gap: 6px;
  height: 100%;
  overflow: hidden;
}
.game-hud {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: var(--text-primary, #4b463d);
  font-size: 11px;
  font-weight: 800;
  padding: 0 2px;
}
.game-canvas {
  width: 100%;
  height: 190px;
  border: 2px solid rgba(79,55,33,0.18);
  border-radius: 8px;
  image-rendering: pixelated;
  background: #9adaff;
  box-shadow: inset 0 -14px 0 rgba(255,255,255,0.16);
}
.game-message {
  color: var(--text-secondary, #6b6258);
  font-size: 11px;
  line-height: 20px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.game-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.move-controls { display: flex; gap: 6px; }
.control-btn, .restart-btn {
  border: none;
  font-family: inherit;
  font-weight: 800;
  cursor: pointer;
  color: white;
  background: var(--accent-color, #FF8C55);
  box-shadow: 0 4px 12px color-mix(in srgb, var(--accent-color, #FF8C55) 26%, transparent);
}
.control-btn { width: 36px; height: 32px; border-radius: 50%; font-size: 16px; line-height: 1; }
.jump-btn { width: 50px; border-radius: 17px; font-size: 13px; }
.restart-btn {
  width: 58px; height: 30px; border-radius: 16px; font-size: 12px;
  background: #3f3a35; box-shadow: 0 4px 10px rgba(63,58,53,0.18);
}
.control-btn:active, .restart-btn:active { transform: translateY(1px); filter: brightness(0.96); }

.music-btn {
  border: none; background: none; cursor: pointer; padding: 2px;
  color: var(--text-secondary, #999); display: flex; align-items: center;
  transition: color 0.2s;
}
.music-btn.on { color: var(--accent-color, #FF8C55); }
</style>
