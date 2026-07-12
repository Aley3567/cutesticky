<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ArcadeAudio, arcadeLoop } from './audio'
import { readHighscore, writeHighscore } from './highscore'
import { stepSnake, type Cell, type SnakeDir } from './logic/snake'
import type { GameResult, GameRuntimeProps } from './registry'

const props = defineProps<GameRuntimeProps>()
const emit = defineEmits<{ exit: []; finish: [result: GameResult] }>()

const size = 14
const snake = ref<Cell[]>([{ x: 6, y: 7 }, { x: 5, y: 7 }, { x: 4, y: 7 }])
const food = ref<Cell>({ x: 10, y: 7 })
const dir = ref<SnakeDir>('right')
const score = ref(3)
const highscore = ref(0)
const dead = ref(false)
let timer: ReturnType<typeof setInterval> | null = null
let audio: ArcadeAudio | null = null

const cells = computed(() => {
  const body = new Set(snake.value.map(cell => `${cell.x}:${cell.y}`))
  return Array.from({ length: size * size }, (_, index) => {
    const cell = { x: index % size, y: Math.floor(index / size) }
    const key = `${cell.x}:${cell.y}`
    return { key, snake: body.has(key), food: food.value.x === cell.x && food.value.y === cell.y }
  })
})

onMounted(async () => {
  highscore.value = await readHighscore('snake')
  audio = new ArcadeAudio(props.muted, props.volume)
  audio.setPaused(props.paused)
  audio.startLoop(arcadeLoop, 170)
  window.addEventListener('keydown', handleKey)
  timer = setInterval(tick, 230)
})

onBeforeUnmount(() => {
  if (score.value > highscore.value) void save()
  if (timer) clearInterval(timer)
  audio?.close()
  window.removeEventListener('keydown', handleKey)
})

watch(() => props.muted, muted => audio?.setMuted(muted))
watch(() => props.volume, volume => audio?.setVolume(volume))
watch(() => props.paused, paused => audio?.setPaused(paused))

function handleKey(event: KeyboardEvent) {
  if (event.code === 'Escape') { event.preventDefault(); emit('exit'); return }
  if (props.paused) return
  const next = keyToDir(event.code)
  if (!next || isOpposite(next, dir.value)) return
  event.preventDefault()
  dir.value = next
}

function keyToDir(code: string): SnakeDir | null {
  if (code === 'ArrowUp' || code === 'KeyW') return 'up'
  if (code === 'ArrowDown' || code === 'KeyS') return 'down'
  if (code === 'ArrowLeft' || code === 'KeyA') return 'left'
  if (code === 'ArrowRight' || code === 'KeyD') return 'right'
  return null
}

function isOpposite(a: SnakeDir, b: SnakeDir) {
  return (a === 'up' && b === 'down') || (a === 'down' && b === 'up') || (a === 'left' && b === 'right') || (a === 'right' && b === 'left')
}

function tick() {
  if (dead.value || props.paused) return
  const next = stepSnake({ snake: snake.value, dir: dir.value, food: food.value, size })
  if (next.dead) {
    dead.value = true
    audio?.noise()
    void finishGame()
    return
  }
  snake.value = next.snake
  score.value = snake.value.length
  if (next.ate) {
    audio?.tone({ freq: 880, duration: 0.06 })
    food.value = placeFood()
  }
}

function placeFood() {
  const occupied = new Set(snake.value.map(cell => `${cell.x}:${cell.y}`))
  for (let i = 0; i < size * size; i += 1) {
    const cell = { x: Math.floor(Math.random() * size), y: Math.floor(Math.random() * size) }
    if (!occupied.has(`${cell.x}:${cell.y}`)) return cell
  }
  return { x: 0, y: 0 }
}

async function save() {
  highscore.value = await writeHighscore('snake', score.value)
}

async function finishGame() {
  await save()
  emit('finish', { title: '撞到了', score: score.value, detail: '本局按蛇身长度计分。' })
}

function restart() {
  snake.value = [{ x: 6, y: 7 }, { x: 5, y: 7 }, { x: 4, y: 7 }]
  food.value = { x: 10, y: 7 }
  dir.value = 'right'
  score.value = 3
  dead.value = false
}
</script>

<template>
  <div class="snake-game">
    <div class="hud">
      <span>长度 {{ score }}</span>
      <span>最高 {{ highscore || '-' }}</span>
      <button @click="restart">重开</button>
    </div>
    <div class="device">
      <div class="brand-row">
        <span>SNAKE</span>
        <span>{{ dir.toUpperCase() }}</span>
      </div>
      <div class="screen">
        <span v-for="cell in cells" :key="cell.key" :class="{ snake: cell.snake, food: cell.food }" />
        <strong v-if="dead">GAME OVER</strong>
      </div>
      <div class="hint">方向键 / WASD 控制</div>
    </div>
  </div>
</template>

<style scoped>
.snake-game { height: 100%; display: grid; grid-template-rows: 28px 1fr; gap: 8px; color: #263219; }
.hud { display: grid; grid-template-columns: 1fr 1fr auto; align-items: center; gap: 6px; font-size: 12px; font-weight: 900; }
.hud span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hud button { border: none; border-radius: 14px; padding: 5px 10px; background: #263219; color: #dce99f; font-weight: 900; cursor: pointer; }
.device {
  width: min(100%, 238px);
  margin: 0 auto;
  padding: 10px 10px 8px;
  border-radius: 12px;
  background: linear-gradient(145deg, #46513a, #2f3926);
  box-shadow: inset 0 0 0 2px rgba(255,255,255,.08), 0 10px 20px rgba(38,50,25,.12);
}
.brand-row {
  display: flex;
  justify-content: space-between;
  padding: 0 3px 6px;
  color: #dce99f;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: .8px;
}
.screen {
  position: relative;
  aspect-ratio: 1;
  width: 100%;
  padding: 8px;
  background:
    linear-gradient(rgba(255,255,255,.05) 50%, transparent 50%) 0 0 / 100% 8px,
    #b8c979;
  border: 4px solid #1f2816;
  border-radius: 6px;
  display: grid;
  grid-template-columns: repeat(14, 1fr);
  gap: 2px;
}
.screen span { background: rgba(52, 65, 31, 0.10); border-radius: 1px; }
.screen span.snake { background: #263219; box-shadow: inset 0 0 0 1px rgba(220,233,159,.12); }
.screen span.food { background: #263219; border-radius: 50%; animation: foodPulse 1.1s steps(2) infinite; }
.screen strong { position: absolute; inset: 0; display: grid; place-items: center; background: rgba(184, 201, 121, 0.78); color: #263219; font-size: 18px; letter-spacing: 0; }
.hint { padding-top: 6px; color: rgba(220,233,159,.72); font-size: 10px; font-weight: 800; text-align: center; }
@keyframes foodPulse { 50% { opacity: .42; } }
</style>
