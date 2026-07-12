<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ArcadeAudio, arcadeLoop } from './audio'
import { readHighscore, writeHighscore } from './highscore'
import type { GameResult, GameRuntimeProps } from './registry'
import {
  nextEnemySpawn,
  rectsOverlap,
  resolveBulletHits,
  type Bullet,
  type Enemy,
  type Rect,
} from './logic/shooter'

const props = defineProps<GameRuntimeProps>()
const emit = defineEmits<{ exit: []; finish: [result: GameResult] }>()

const stageWidth = 220
const stageHeight = 280
const player = ref<Rect>({ x: 98, y: 238, w: 24, h: 30 })
const bullets = ref<Bullet[]>([])
const enemies = ref<Enemy[]>([])
const score = ref(0)
const highscore = ref(0)
const gameOver = ref(false)
const frameCount = ref(0)
const keys = new Set<string>()
let raf = 0
let audio: ArcadeAudio | null = null
let lastShotFrame = -20

const status = computed(() => gameOver.value ? '坠毁' : '升空')

onMounted(async () => {
  highscore.value = await readHighscore('shooter')
  audio = new ArcadeAudio(props.muted, props.volume)
  audio.setPaused(props.paused)
  audio.startLoop(arcadeLoop, 150)
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
  raf = requestAnimationFrame(frame)
})

onBeforeUnmount(() => {
  if (score.value > highscore.value) void saveHighscore()
  cancelAnimationFrame(raf)
  audio?.close()
  keys.clear()
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('keyup', handleKeyUp)
})

watch(() => props.muted, muted => audio?.setMuted(muted))
watch(() => props.volume, volume => audio?.setVolume(volume))
watch(() => props.paused, paused => {
  audio?.setPaused(paused)
  if (paused) keys.clear()
})

function frame() {
  if (!props.paused) tick()
  raf = requestAnimationFrame(frame)
}

function tick() {
  if (gameOver.value) return

  frameCount.value += 1
  movePlayer()
  if (frameCount.value - lastShotFrame >= 14) fireShot()

  const spawn = nextEnemySpawn({
    frame: frameCount.value,
    every: 72,
    playfieldWidth: stageWidth,
    seed: frameCount.value + score.value * 7,
  })
  if (spawn) enemies.value = [...enemies.value, spawn]

  bullets.value = bullets.value
    .map(bullet => ({ ...bullet, y: bullet.y - 5.8 }))
    .filter(bullet => bullet.y + bullet.h > 0)
  enemies.value = enemies.value
    .map(enemy => ({ ...enemy, y: enemy.y + enemy.speed * 0.72 }))
    .filter(enemy => enemy.y < stageHeight + 24)

  const resolved = resolveBulletHits({
    bullets: bullets.value,
    enemies: enemies.value,
    score: score.value,
  })
  bullets.value = resolved.bullets
  enemies.value = resolved.enemies
  score.value = resolved.score
  if (resolved.kills > 0) audio?.noise(0.08, 0.035)

  if (enemies.value.some(enemy => rectsOverlap(enemy, player.value))) endGame()
}

function movePlayer() {
  const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 1.8 : 2.8
  let x = player.value.x
  let y = player.value.y
  if (keys.has('ArrowLeft') || keys.has('KeyA')) x -= speed
  if (keys.has('ArrowRight') || keys.has('KeyD')) x += speed
  if (keys.has('ArrowUp') || keys.has('KeyW')) y -= speed
  if (keys.has('ArrowDown') || keys.has('KeyS')) y += speed
  player.value = {
    ...player.value,
    x: clamp(x, 4, stageWidth - player.value.w - 4),
    y: clamp(y, 92, stageHeight - player.value.h - 6),
  }
}

function fireShot() {
  if (gameOver.value) return
  if (frameCount.value - lastShotFrame < 10) return
  lastShotFrame = frameCount.value
  bullets.value = [
    ...bullets.value,
    {
      id: `bullet-${frameCount.value}-${bullets.value.length}`,
      x: player.value.x + player.value.w / 2 - 2,
      y: player.value.y - 10,
      w: 4,
      h: 13,
    },
  ]
  audio?.tone({ freq: 760, duration: 0.035, wave: 'square', gain: 0.025 })
}

function handleKeyDown(event: KeyboardEvent) {
  if (event.code === 'Escape') {
    event.preventDefault()
    emit('exit')
    return
  }
  if (props.paused) return
  if (!isControlKey(event.code)) return
  event.preventDefault()
  keys.add(event.code)
  if (event.code === 'Space' || event.code === 'KeyJ') fireShot()
}

function handleKeyUp(event: KeyboardEvent) {
  keys.delete(event.code)
}

function isControlKey(code: string) {
  return [
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'KeyW',
    'KeyA',
    'KeyS',
    'KeyD',
    'KeyJ',
    'Space',
    'ShiftLeft',
    'ShiftRight',
  ].includes(code)
}

function endGame() {
  gameOver.value = true
  audio?.noise(0.18, 0.06)
  void finishGame()
}

async function saveHighscore() {
  highscore.value = await writeHighscore('shooter', score.value)
}

async function finishGame() {
  await saveHighscore()
  emit('finish', { title: '战机坠毁', score: score.value, detail: '本局按击坠数量记录。' })
}

function restart() {
  player.value = { x: 98, y: 238, w: 24, h: 30 }
  bullets.value = []
  enemies.value = []
  score.value = 0
  frameCount.value = 0
  lastShotFrame = -20
  gameOver.value = false
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function spriteStyle(rect: Rect) {
  return {
    left: `${(rect.x / stageWidth) * 100}%`,
    top: `${(rect.y / stageHeight) * 100}%`,
    width: `${(rect.w / stageWidth) * 100}%`,
    height: `${(rect.h / stageHeight) * 100}%`,
  }
}
</script>

<template>
  <div class="shooter-game">
    <div class="hud">
      <span>击坠 {{ score }}</span>
      <span>最高 {{ highscore || '-' }}</span>
      <span>{{ status }}</span>
      <button type="button" @click="restart">重开</button>
    </div>

    <div class="stage">
      <span v-for="n in 24" :key="n" class="star" />
      <i v-for="bullet in bullets" :key="bullet.id" class="bullet" :style="spriteStyle(bullet)" />
      <b v-for="enemy in enemies" :key="enemy.id" class="enemy" :style="spriteStyle(enemy)" />
      <strong class="player" :style="spriteStyle(player)" />
      <div v-if="gameOver" class="overlay">
        <span>GAME OVER</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.shooter-game { height: 100%; display: grid; grid-template-rows: 28px 1fr; gap: 8px; }
.hud { display: grid; grid-template-columns: 1fr 1fr 1fr auto; align-items: center; gap: 6px; color: #17235f; font-size: 12px; font-weight: 900; }
.hud button { border: 0; border-radius: 14px; padding: 5px 10px; background: #17235f; color: #e8f4ff; font-weight: 900; }
.stage { position: relative; overflow: hidden; width: min(100%, 260px); height: 100%; min-height: 238px; margin: 0 auto; border: 3px solid #17235f; border-radius: 8px; background: linear-gradient(180deg, #10184d 0%, #273389 52%, #7355b7 100%); box-shadow: inset 0 0 0 2px rgba(255,255,255,.12); }
.star { position: absolute; left: 8%; top: -14px; width: 2px; height: 11px; border-radius: 2px; background: rgba(232,244,255,.68); animation: starfall 1.2s linear infinite; }
.star:nth-child(2n) { left: 32%; animation-delay: -.2s; }
.star:nth-child(3n) { left: 18%; animation-duration: 1.55s; animation-delay: -.4s; }
.star:nth-child(4n) { left: 72%; animation-duration: 1.05s; animation-delay: -.7s; }
.star:nth-child(5n) { left: 44%; animation-duration: 1.8s; animation-delay: -1s; }
.star:nth-child(7n) { left: 88%; animation-duration: 1.35s; animation-delay: -.9s; }
.bullet { position: absolute; border-radius: 4px; background: #92f7ff; box-shadow: 0 0 8px rgba(146,247,255,.78); }
.enemy { position: absolute; border-radius: 50% 50% 8px 8px; background: linear-gradient(180deg, #ffcf66, #ff5f91); box-shadow: inset 0 -4px 0 rgba(23,35,95,.32); }
.enemy::before, .enemy::after { content: ""; position: absolute; top: 45%; width: 42%; height: 28%; border-radius: 8px; background: #ff7aa6; }
.enemy::before { left: -28%; transform: rotate(-18deg); }
.enemy::after { right: -28%; transform: rotate(18deg); }
.player { position: absolute; }
.player::before { content: ""; position: absolute; left: 50%; bottom: 0; width: 0; height: 0; transform: translateX(-50%); border-left: 12px solid transparent; border-right: 12px solid transparent; border-bottom: 30px solid #e8f4ff; filter: drop-shadow(0 0 6px rgba(146,247,255,.55)); }
.player::after { content: ""; position: absolute; left: 50%; bottom: -5px; width: 8px; height: 12px; transform: translateX(-50%); border-radius: 0 0 8px 8px; background: #ffcf66; }
.overlay { position: absolute; inset: 0; display: grid; place-items: center; background: rgba(16,24,77,.68); color: #e8f4ff; font-size: 20px; font-weight: 900; letter-spacing: 0; }
@keyframes starfall {
  from { transform: translateY(-20px); }
  to { transform: translateY(320px); }
}
</style>
