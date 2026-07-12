<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ArcadeAudio, arcadeLoop } from './audio'
import { readHighscore, writeLowestBest } from './highscore'
import type { GameResult, GameRuntimeProps } from './registry'
import {
  cellKey,
  isSokobanComplete,
  moveSokoban,
  type Cell,
  type SokobanDirection,
  type SokobanState,
} from './logic/sokoban'

const props = defineProps<GameRuntimeProps>()
const emit = defineEmits<{ exit: []; finish: [result: GameResult] }>()

const WIDTH = 8
const HEIGHT = 7
const INITIAL_STATE: SokobanState = {
  player: { x: 2, y: 2 },
  boxes: [
    { x: 3, y: 2 },
    { x: 4, y: 3 },
  ],
  goals: [
    { x: 5, y: 2 },
    { x: 5, y: 4 },
  ],
  walls: [
    ...row(0),
    ...row(HEIGHT - 1),
    ...col(0),
    ...col(WIDTH - 1),
    { x: 2, y: 4 },
    { x: 3, y: 4 },
  ],
  steps: 0,
}

let audio: ArcadeAudio | null = null
let lastMoveAt = 0
const state = ref<SokobanState>(cloneState(INITIAL_STATE))
const bestSteps = ref(0)
const justSolved = ref(false)
const savingBest = ref(false)
const solved = computed(() => isSokobanComplete(state.value))
const tiles = computed(() => {
  const walls = new Set(state.value.walls.map(cellKey))
  const goals = new Set(state.value.goals.map(cellKey))
  const boxes = new Set(state.value.boxes.map(cellKey))
  const player = cellKey(state.value.player)
  return Array.from({ length: WIDTH * HEIGHT }, (_, index) => {
    const cell = { x: index % WIDTH, y: Math.floor(index / WIDTH) }
    const key = cellKey(cell)
    return {
      key,
      isWall: walls.has(key),
      isGoal: goals.has(key),
      isBox: boxes.has(key),
      isPlayer: key === player,
      isBoxOnGoal: boxes.has(key) && goals.has(key),
    }
  })
})

onMounted(() => {
  audio = new ArcadeAudio(props.muted, props.volume)
  audio.setPaused(props.paused)
  audio.startLoop(arcadeLoop, 210)
  window.addEventListener('keydown', handleKey)
  void loadBest()
})

onBeforeUnmount(() => {
  audio?.close()
  window.removeEventListener('keydown', handleKey)
})

watch(() => props.muted, muted => audio?.setMuted(muted))
watch(() => props.volume, volume => audio?.setVolume(volume))
watch(() => props.paused, paused => audio?.setPaused(paused))

function handleKey(event: KeyboardEvent) {
  if (event.code === 'Escape') {
    event.preventDefault()
    emit('exit')
    return
  }

  if (props.paused) return

  const direction = keyDirection(event.code)
  if (!direction || solved.value) return
  event.preventDefault()
  tryMove(direction)
}

function tryMove(direction: SokobanDirection) {
  if (props.paused || solved.value) return
  const now = performance.now()
  if (now - lastMoveAt < 130) return
  lastMoveAt = now
  const result = moveSokoban(state.value, direction)
  if (!result.moved) {
    audio?.tone({ freq: 140, duration: 0.05, wave: 'square', gain: 0.025 })
    return
  }

  state.value = result.state
  audio?.tone({
    freq: result.pushed ? 220 : 330,
    duration: result.pushed ? 0.08 : 0.045,
    wave: result.pushed ? 'triangle' : 'square',
    gain: 0.03,
  })

  if (isSokobanComplete(result.state)) void finishPuzzle(result.state.steps)
}

function restart() {
  state.value = cloneState(INITIAL_STATE)
  justSolved.value = false
  lastMoveAt = 0
}

async function loadBest() {
  bestSteps.value = await readHighscore('sokoban')
}

async function finishPuzzle(steps: number) {
  if (savingBest.value || justSolved.value) return
  justSolved.value = true
  savingBest.value = true
  audio?.tone({ freq: 523, duration: 0.1, wave: 'square', gain: 0.035 })
  audio?.tone({ freq: 659, duration: 0.12, wave: 'triangle', gain: 0.03 })
  try {
    bestSteps.value = await writeLowestBest('sokoban', steps)
    emit('finish', { title: '全部归位', score: steps, detail: '推箱子按通关最少步数记录。' })
  } finally {
    savingBest.value = false
  }
}

function keyDirection(code: string): SokobanDirection | null {
  if (code === 'ArrowUp') return 'up'
  if (code === 'ArrowDown') return 'down'
  if (code === 'ArrowLeft') return 'left'
  if (code === 'ArrowRight') return 'right'
  return null
}

function cloneState(source: SokobanState): SokobanState {
  return {
    player: cloneCell(source.player),
    boxes: source.boxes.map(cloneCell),
    walls: source.walls.map(cloneCell),
    goals: source.goals.map(cloneCell),
    steps: source.steps,
  }
}

function cloneCell(cell: Cell) {
  return { x: cell.x, y: cell.y }
}

function row(y: number) {
  return Array.from({ length: WIDTH }, (_, x) => ({ x, y }))
}

function col(x: number) {
  return Array.from({ length: HEIGHT }, (_, y) => ({ x, y }))
}
</script>

<template>
  <div class="sokoban-game">
    <div class="mini-hud">
      <span>仓库 A</span>
      <span>步数 {{ state.steps }}</span>
      <span>最佳 {{ bestSteps || '--' }}</span>
    </div>
    <div class="warehouse">
      <span
        v-for="tile in tiles"
        :key="tile.key"
        :class="{
          wall: tile.isWall,
          goal: tile.isGoal,
          box: tile.isBox,
          player: tile.isPlayer,
          solved: tile.isBoxOnGoal,
        }"
      />
    </div>
    <div class="status-row">
      <span>{{ solved ? '全部归位' : '方向键推箱' }}</span>
      <button type="button" @click="restart">重开</button>
    </div>
    <div class="pad" aria-label="推箱子方向键">
      <button type="button" class="up" @click="tryMove('up')">↑</button>
      <button type="button" class="left" @click="tryMove('left')">←</button>
      <button type="button" class="down" @click="tryMove('down')">↓</button>
      <button type="button" class="right" @click="tryMove('right')">→</button>
    </div>
  </div>
</template>

<style scoped>
.sokoban-game { height: 100%; display: grid; grid-template-rows: 22px 202px 26px 49px; gap: 5px; overflow: hidden; }
.mini-hud { display: grid; grid-template-columns: 1fr auto auto; gap: 8px; align-items: center; font-size: 11px; font-weight: 900; color: #5d3518; }
.warehouse {
  aspect-ratio: 8 / 7;
  width: min(100%, 232px);
  margin: 0 auto;
  padding: 7px;
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  grid-template-rows: repeat(7, 1fr);
  gap: 2px;
  background: linear-gradient(145deg, #c89255, #9d642f);
  border: 3px solid #6c3f1e;
  border-radius: 9px;
  box-shadow: inset 0 0 0 2px rgba(255,240,204,.18), 0 10px 18px rgba(108,63,30,.12);
}
.warehouse span {
  position: relative;
  min-width: 0;
  border-radius: 4px;
  background:
    linear-gradient(135deg, rgba(255,255,255,.18), transparent 44%),
    #f2d5a4;
  box-shadow: inset 0 -2px 0 rgba(93, 53, 24, 0.08), inset 0 0 0 1px rgba(93, 53, 24, 0.08);
}
.warehouse span.wall {
  background:
    linear-gradient(135deg, rgba(255,232,188,.16), transparent 40%),
    #7b4824;
  box-shadow: inset 0 0 0 2px rgba(255, 232, 188, 0.12), inset 0 -3px 0 rgba(54,28,12,.22);
}
.warehouse span.goal::after { content: ""; position: absolute; inset: 23%; border: 2px solid #cf4c3e; border-radius: 50%; background: rgba(255,255,255,.12); }
.warehouse span.box {
  background:
    linear-gradient(135deg, rgba(255,235,190,.28), transparent 40%),
    #b87834;
  box-shadow: inset 0 0 0 3px rgba(80, 43, 16, 0.18), inset 0 -4px 0 rgba(80,43,16,.18);
}
.warehouse span.box::before { content: ""; position: absolute; inset: 28% 12%; border-top: 1px solid rgba(80, 43, 16, 0.28); border-bottom: 1px solid rgba(80, 43, 16, 0.28); }
.warehouse span.box::after { content: ""; position: absolute; inset: 12%; border: 2px solid rgba(80,43,16,.16); border-radius: 3px; }
.warehouse span.solved { background: #c78a3f; }
.warehouse span.solved::after { border-color: #f5dfb9; }
.warehouse span.player {
  background: radial-gradient(circle at 50% 28%, #f7d19a 0 24%, #3d6fb6 25% 62%, #244775 63%);
  border-radius: 50%;
  box-shadow: inset 0 -3px 0 rgba(18, 42, 82, 0.24), 0 2px 3px rgba(54,28,12,.18);
}
.status-row { display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: center; color: var(--text-secondary, #756c64); font-size: 11px; font-weight: 800; }
button { height: 25px; padding: 0 9px; border: 0; border-radius: 6px; background: #8d572c; color: #fff4d8; font-size: 11px; font-weight: 900; cursor: pointer; }
button:hover { background: #744620; }
.pad {
  width: 86px;
  height: 49px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(3, 26px);
  grid-template-rows: repeat(2, 22px);
  gap: 4px;
  justify-content: center;
}
.pad button {
  height: 22px;
  padding: 0;
  border-radius: 50%;
  background: #6c3f1e;
}
.pad .up { grid-column: 2; }
.pad .left { grid-column: 1; grid-row: 2; }
.pad .down { grid-column: 2; grid-row: 2; }
.pad .right { grid-column: 3; grid-row: 2; }
</style>
