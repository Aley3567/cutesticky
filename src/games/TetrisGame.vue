<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ArcadeAudio, arcadeLoop } from './audio'
import { readHighscore, writeHighscore } from './highscore'
import { clearLines, collides, rotateMatrix, scoreClearedLines, type Matrix } from './logic/tetris'
import type { GameResult, GameRuntimeProps } from './registry'

const props = defineProps<GameRuntimeProps>()
const emit = defineEmits<{ exit: []; finish: [result: GameResult] }>()

const width = 10
const height = 16
const shapes: Matrix[] = [
  [[1, 1, 1, 1]],
  [[1, 1], [1, 1]],
  [[0, 1, 0], [1, 1, 1]],
  [[1, 1, 0], [0, 1, 1]],
  [[0, 1, 1], [1, 1, 0]],
  [[1, 0, 0], [1, 1, 1]],
  [[0, 0, 1], [1, 1, 1]],
]

const board = ref<Matrix>(emptyBoard())
const shape = ref<Matrix>(randomShape())
const nextShape = ref<Matrix>(randomShape())
const pos = ref({ x: 3, y: 0 })
const score = ref(0)
const lines = ref(0)
const highscore = ref(0)
const over = ref(false)
let timer: ReturnType<typeof setInterval> | null = null
let audio: ArcadeAudio | null = null

const cells = computed(() => {
  const merged = board.value.map(row => [...row])
  shape.value.forEach((row, y) => row.forEach((cell, x) => {
    const by = pos.value.y + y
    const bx = pos.value.x + x
    if (cell && by >= 0 && by < height && bx >= 0 && bx < width) merged[by][bx] = 2
  }))
  return merged.flat().map((value, index) => ({ index, value }))
})

const nextCells = computed(() => {
  const preview = Array.from({ length: 4 }, () => Array(4).fill(0))
  const offsetY = Math.max(0, Math.floor((4 - nextShape.value.length) / 2))
  const offsetX = Math.max(0, Math.floor((4 - nextShape.value[0].length) / 2))
  nextShape.value.forEach((row, y) => row.forEach((cell, x) => {
    if (cell) preview[offsetY + y][offsetX + x] = 1
  }))
  return preview.flat().map((value, index) => ({ index, value }))
})

onMounted(async () => {
  highscore.value = await readHighscore('tetris')
  audio = new ArcadeAudio(props.muted, props.volume)
  audio.setPaused(props.paused)
  audio.startLoop(arcadeLoop, 190)
  window.addEventListener('keydown', handleKey)
  timer = setInterval(drop, 760)
  spawn()
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

function emptyBoard() { return Array.from({ length: height }, () => Array(width).fill(0)) }
function randomShape() { return shapes[Math.floor(Math.random() * shapes.length)].map(row => [...row]) }

function handleKey(event: KeyboardEvent) {
  if (event.code === 'Escape') { event.preventDefault(); emit('exit'); return }
  if (over.value || props.paused) return
  if (event.code === 'ArrowLeft') move(-1)
  if (event.code === 'ArrowRight') move(1)
  if (event.code === 'ArrowDown') drop()
  if (event.code === 'ArrowUp' || event.code === 'Space') rotate()
  if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', 'Space'].includes(event.code)) event.preventDefault()
}

function move(dx: number) {
  if (!collides(board.value, shape.value, pos.value.x + dx, pos.value.y)) pos.value = { ...pos.value, x: pos.value.x + dx }
}

function rotate() {
  const rotated = rotateMatrix(shape.value)
  if (!collides(board.value, rotated, pos.value.x, pos.value.y)) {
    shape.value = rotated
    audio?.tone({ freq: 660, duration: 0.04 })
  }
}

function drop() {
  if (over.value || props.paused) return
  if (!collides(board.value, shape.value, pos.value.x, pos.value.y + 1)) {
    pos.value = { ...pos.value, y: pos.value.y + 1 }
    return
  }
  lock()
}

function lock() {
  const next = board.value.map(row => [...row])
  shape.value.forEach((row, y) => row.forEach((cell, x) => {
    if (cell && pos.value.y + y >= 0) next[pos.value.y + y][pos.value.x + x] = 1
  }))
  const result = clearLines(next)
  if (result.cleared) {
    lines.value += result.cleared
    score.value += scoreClearedLines(result.cleared)
    audio?.tone({ freq: 988, duration: 0.09 })
  }
  board.value = result.board
  spawn()
}

function spawn() {
  shape.value = nextShape.value.map(row => [...row])
  nextShape.value = randomShape()
  pos.value = { x: 3, y: 0 }
  if (collides(board.value, shape.value, pos.value.x, pos.value.y)) {
    over.value = true
    audio?.noise()
    void finishGame()
  }
}

async function save() { highscore.value = await writeHighscore('tetris', score.value) }

async function finishGame() {
  await save()
  emit('finish', { title: '方块堆满了', score: score.value, detail: `本局消除 ${lines.value} 行。` })
}

function restart() {
  board.value = emptyBoard()
  score.value = 0
  lines.value = 0
  over.value = false
  nextShape.value = randomShape()
  spawn()
}
</script>

<template>
  <div class="tetris-game">
    <div class="hud">
      <span>分 {{ score }}</span>
      <span>最高 {{ highscore || '-' }}</span>
      <button @click="restart">重开</button>
    </div>
    <div class="gb-shell">
      <div class="well">
        <span v-for="cell in cells" :key="cell.index" :class="{ filled: cell.value === 1, active: cell.value === 2 }" />
        <strong v-if="over">TOP OUT</strong>
      </div>
      <aside class="side-panel">
        <span class="label">NEXT</span>
        <div class="next-grid">
          <span v-for="cell in nextCells" :key="cell.index" :class="{ filled: cell.value }" />
        </div>
        <span class="label">LINES</span>
        <strong>{{ lines }}</strong>
        <span class="label">SPEED</span>
        <strong>SLOW</strong>
      </aside>
    </div>
    <div class="hint">← → 移动 · ↑ / Space 旋转 · ↓ 软降</div>
  </div>
</template>

<style scoped>
.tetris-game { height: 100%; display: grid; grid-template-rows: 26px 1fr 16px; gap: 5px; color: #22291f; overflow: hidden; }
.hud { display: flex; align-items: center; justify-content: space-between; font-size: 12px; font-weight: 900; }
.hud button { border: none; border-radius: 14px; padding: 5px 10px; background: #22291f; color: #d5dcc8; font-weight: 900; }
.gb-shell {
  width: min(100%, 284px);
  height: 259px;
  margin: 0 auto;
  padding: 10px;
  border-radius: 12px 12px 18px 18px;
  background: linear-gradient(145deg, #343c31, #20271f);
  display: grid;
  grid-template-columns: 156px 1fr;
  gap: 10px;
  box-shadow: inset 0 0 0 2px rgba(255,255,255,.06), 0 12px 22px rgba(34,41,31,.12);
}
.well {
  position: relative;
  height: 239px;
  aspect-ratio: 10 / 16;
  padding: 7px;
  background:
    linear-gradient(rgba(255,255,255,.05) 50%, transparent 50%) 0 0 / 100% 8px,
    #c8d0bd;
  border: 4px solid #10150e;
  border-radius: 4px;
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  gap: 2px;
}
.well span,
.next-grid span { background: rgba(34, 41, 31, 0.14); box-shadow: inset 0 0 0 1px rgba(34, 41, 31, 0.08); }
.well span.filled,
.next-grid span.filled { background: #22291f; box-shadow: inset 0 0 0 2px rgba(200,208,189,.10); }
.well span.active { background: #4a5744; box-shadow: inset 0 0 0 2px #22291f, inset 0 0 0 3px rgba(200,208,189,.16); }
.well strong { position: absolute; inset: 0; display: grid; place-items: center; background: rgba(200, 208, 189, 0.75); font-size: 18px; }
.side-panel {
  min-width: 0;
  padding: 6px;
  border-radius: 6px;
  background: #c8d0bd;
  border: 4px solid #10150e;
  display: grid;
  grid-template-rows: auto 54px auto auto auto auto 1fr;
  gap: 5px;
  align-content: start;
  font-size: 10px;
  line-height: 16px;
  font-weight: 900;
}
.label { color: rgba(34,41,31,.68); font-size: 9px; line-height: 10px; }
.side-panel strong { font-size: 13px; line-height: 14px; }
.next-grid {
  width: 54px;
  height: 54px;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 2px;
}
.hint {
  color: var(--text-secondary, #756c64);
  font-size: 10px;
  font-weight: 800;
  text-align: center;
  white-space: nowrap;
}
</style>
