<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ArcadeAudio, arcadeLoop } from './audio'
import { readHighscore, writeHighscore } from './highscore'
import { stepBreakout, type BreakoutState, type Brick } from './logic/breakout'
import type { GameResult, GameRuntimeProps } from './registry'

const props = defineProps<GameRuntimeProps>()
const emit = defineEmits<{ exit: []; finish: [result: GameResult] }>()

const width = 240
const height = 280
const paddleSpeed = 5.5
const keys = new Set<string>()

const state = ref(createState())
const highscore = ref(0)
let raf = 0
let audio: ArcadeAudio | null = null
let savedStatus: BreakoutState['status'] | null = null

const liveBricks = computed(() => state.value.bricks.filter(brick => brick.alive).length)
const statusText = computed(() => {
  if (state.value.status === 'won') return 'CLEAR'
  if (state.value.status === 'lost') return 'GAME OVER'
  return ''
})

onMounted(async () => {
  highscore.value = await readHighscore('breakout')
  audio = new ArcadeAudio(props.muted, props.volume)
  audio.setPaused(props.paused)
  audio.startLoop(arcadeLoop, 185)
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
  raf = requestAnimationFrame(frame)
})

onBeforeUnmount(() => {
  if (state.value.score > highscore.value) void writeHighscore('breakout', state.value.score)
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

function createState(): BreakoutState {
  return {
    width,
    height,
    ball: { x: 116, y: 212, w: 10, h: 10 },
    velocity: { x: 2.4, y: -3.2 },
    paddle: { x: 88, y: 252, w: 64, h: 10 },
    bricks: createBricks(),
    score: 0,
    status: 'playing',
  }
}

function createBricks(): Brick[] {
  const colors = [80, 70, 60, 50]
  return colors.flatMap((points, row) => (
    Array.from({ length: 6 }, (_, col) => ({
      x: 12 + col * 36,
      y: 26 + row * 18,
      w: 30,
      h: 12,
      alive: true,
      points,
    }))
  ))
}

function frame() {
  if (state.value.status === 'playing' && !props.paused) {
    const before = state.value
    state.value = stepBreakout({ ...before, paddle: movePaddle(before.paddle) })
    playFrameAudio(before, state.value)
    void saveTerminalScore()
  }
  raf = requestAnimationFrame(frame)
}

function movePaddle(paddle: BreakoutState['paddle']) {
  const left = keys.has('ArrowLeft') || keys.has('KeyA')
  const right = keys.has('ArrowRight') || keys.has('KeyD')
  const dx = (right ? paddleSpeed : 0) - (left ? paddleSpeed : 0)
  const x = Math.max(0, Math.min(width - paddle.w, paddle.x + dx))
  return { ...paddle, x }
}

function playFrameAudio(before: BreakoutState, after: BreakoutState) {
  if (after.status === 'lost' && before.status !== 'lost') {
    audio?.noise(0.18, 0.045)
    return
  }
  if (after.status === 'won' && before.status !== 'won') {
    audio?.tone({ freq: 988, duration: 0.12, wave: 'triangle' })
    return
  }
  if (after.score > before.score) {
    audio?.tone({ freq: 760, duration: 0.05 })
    return
  }
  if (after.velocity.y !== before.velocity.y) {
    audio?.tone({ freq: 420, duration: 0.035 })
  }
}

async function saveTerminalScore() {
  if (state.value.status === 'playing' || savedStatus === state.value.status) return
  savedStatus = state.value.status
  highscore.value = await writeHighscore('breakout', state.value.score)
  emit('finish', {
    title: state.value.status === 'won' ? '砖墙清空' : '球掉下去了',
    score: state.value.score,
    detail: state.value.status === 'won' ? '全部砖块已清除。' : '本局按击碎砖块累计分数。',
  })
}

function handleKeyDown(event: KeyboardEvent) {
  if (event.code === 'Escape') {
    event.preventDefault()
    emit('exit')
    return
  }
  if (props.paused) return
  if (event.code === 'Space' && state.value.status !== 'playing') {
    event.preventDefault()
    restart()
    return
  }
  if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(event.code)) {
    event.preventDefault()
    keys.add(event.code)
  }
}

function handleKeyUp(event: KeyboardEvent) {
  keys.delete(event.code)
}

function restart() {
  savedStatus = null
  keys.clear()
  state.value = createState()
}
</script>

<template>
  <div class="breakout-game">
    <div class="hud">
      <span>分 {{ state.score }}</span>
      <span>砖 {{ liveBricks }}</span>
      <span>最高 {{ highscore || '-' }}</span>
      <button @click="restart">重开</button>
    </div>

    <div class="cabinet">
      <div class="stage">
        <span
          v-for="(brick, index) in state.bricks"
          :key="index"
          class="brick"
          :class="{ broken: !brick.alive }"
          :style="{
            left: `${(brick.x / width) * 100}%`,
            top: `${(brick.y / height) * 100}%`,
            width: `${(brick.w / width) * 100}%`,
            height: `${(brick.h / height) * 100}%`,
          }"
        />
        <i
          class="ball"
          :style="{
            left: `${(state.ball.x / width) * 100}%`,
            top: `${(state.ball.y / height) * 100}%`,
            width: `${(state.ball.w / width) * 100}%`,
            height: `${(state.ball.h / height) * 100}%`,
          }"
        />
        <b
          class="paddle"
          :style="{
            left: `${(state.paddle.x / width) * 100}%`,
            top: `${(state.paddle.y / height) * 100}%`,
            width: `${(state.paddle.w / width) * 100}%`,
            height: `${(state.paddle.h / height) * 100}%`,
          }"
        />
        <strong v-if="statusText">{{ statusText }}</strong>
      </div>
    </div>
  </div>
</template>

<style scoped>
.breakout-game {
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-rows: 28px 1fr;
  gap: 8px;
  color: #2c2431;
}

.hud {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr)) auto;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 900;
}

.hud span {
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hud button {
  border: none;
  border-radius: 14px;
  padding: 5px 9px;
  background: #2c2431;
  color: #fff2d8;
  font: inherit;
  cursor: pointer;
}

.cabinet {
  min-height: 0;
  display: grid;
  place-items: center;
}

.stage {
  position: relative;
  height: min(100%, 286px);
  aspect-ratio: 6 / 7;
  overflow: hidden;
  border: 5px solid #2c2431;
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08), transparent 45%),
    radial-gradient(circle at 50% 112%, rgba(112, 214, 255, 0.22), transparent 42%),
    #151326;
  box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.08);
}

.brick,
.ball,
.paddle {
  position: absolute;
  display: block;
}

.brick {
  border-radius: 3px;
  background: linear-gradient(90deg, #f55373, #ffd15c);
  box-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.18);
}

.brick:nth-child(6n + 2),
.brick:nth-child(6n + 5) {
  background: linear-gradient(90deg, #70d6ff, #9bffb3);
}

.brick:nth-child(6n + 3),
.brick:nth-child(6n + 6) {
  background: linear-gradient(90deg, #b794ff, #ff87c2);
}

.brick.broken {
  opacity: 0;
}

.ball {
  border-radius: 50%;
  background: #fff9e8;
  box-shadow: 0 0 10px rgba(255, 249, 232, 0.68);
}

.paddle {
  border-radius: 999px;
  background: linear-gradient(90deg, #58c7ff, #fff2a3, #58c7ff);
  box-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.24);
}

.stage strong {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(21, 19, 38, 0.72);
  color: #fff2a3;
  font-size: 20px;
  font-weight: 1000;
  letter-spacing: 0;
}
</style>
