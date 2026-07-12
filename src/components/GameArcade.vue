<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref } from 'vue'
import { GAMES, type GameEntry, type GameId, type GameResult } from '../games/registry'
import { readHighscore } from '../games/highscore'

const selected = ref<GameEntry | null>(null)
const muted = ref(false)
const volume = ref(0.65)
const paused = ref(false)
const guideVisible = ref(false)
const result = ref<GameResult | null>(null)
const runId = ref(0)
const highscores = ref<Record<GameId, number>>({
  snake: 0,
  mario: 0,
  tetris: 0,
  breakout: 0,
  sokoban: 0,
  shooter: 0,
})

const ActiveGame = computed(() => selected.value
  ? defineAsyncComponent(selected.value.component)
  : null)

onMounted(async () => {
  window.addEventListener('keydown', handleGlobalKey)
  window.addEventListener('blur', pauseOnBlur)
  document.addEventListener('visibilitychange', pauseWhenHidden)
  await refreshScores()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKey)
  window.removeEventListener('blur', pauseOnBlur)
  document.removeEventListener('visibilitychange', pauseWhenHidden)
})

function openGame(game: GameEntry) {
  selected.value = game
  result.value = null
  guideVisible.value = !hasSeenGuide(game.id)
  paused.value = guideVisible.value
  runId.value += 1
}

async function closeGame() {
  selected.value = null
  paused.value = false
  guideVisible.value = false
  result.value = null
  await refreshScores()
}

function handleGlobalKey(event: KeyboardEvent) {
  if (!selected.value) return
  if (event.code === 'Escape') {
    event.preventDefault()
    void closeGame()
    return
  }
  if (event.code === 'KeyP' && !event.repeat) {
    event.preventDefault()
    togglePause()
  }
}

function startGuidedGame() {
  if (!selected.value) return
  markGuideSeen(selected.value.id)
  guideVisible.value = false
  paused.value = false
}

function togglePause() {
  if (!selected.value || result.value) return
  if (guideVisible.value) {
    startGuidedGame()
    return
  }
  paused.value = !paused.value
}

function restartGame() {
  if (!selected.value) return
  result.value = null
  guideVisible.value = false
  paused.value = false
  runId.value += 1
}

function showResult(gameResult: GameResult) {
  result.value = gameResult
  paused.value = true
  if (!selected.value) return
  const id = selected.value.id
  const existing = highscores.value[id]
  highscores.value[id] = id === 'sokoban'
    ? (existing ? Math.min(existing, gameResult.score) : gameResult.score)
    : Math.max(existing, gameResult.score)
  void refreshScores()
}

function pauseOnBlur() {
  if (selected.value && !guideVisible.value && !result.value) paused.value = true
}

function pauseWhenHidden() {
  if (document.hidden) pauseOnBlur()
}

function hasSeenGuide(id: GameId) {
  try {
    return window.localStorage.getItem(`cute-sticky:game-guide:${id}`) === '1'
  } catch {
    return false
  }
}

function markGuideSeen(id: GameId) {
  try {
    window.localStorage.setItem(`cute-sticky:game-guide:${id}`, '1')
  } catch {
    // A disabled localStorage should not prevent play.
  }
}

async function refreshScores() {
  const pairs = await Promise.all(GAMES.map(async game => [game.id, await readHighscore(game.id)] as const))
  highscores.value = Object.fromEntries(pairs) as Record<GameId, number>
}
</script>

<template>
  <div class="arcade">
    <div class="arcade-top">
      <button v-if="selected" class="back-btn" @click="closeGame" title="返回列表">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
      </button>
      <div class="arcade-title">
        <strong>{{ selected ? selected.name : '复古游戏角' }}</strong>
        <span>{{ selected ? (paused ? '已暂停 · P 继续' : 'P 暂停 · ESC 返回') : '选择游戏' }}</span>
      </div>
      <button v-if="selected" class="tool-btn" :class="{ active: paused }" @click="togglePause" :title="paused ? '继续' : '暂停'">
        <svg v-if="paused" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="m8 5 11 7-11 7V5z" /></svg>
        <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 5h4v14H7zM13 5h4v14h-4z" /></svg>
      </button>
      <button v-if="selected" class="tool-btn" @click="restartGame" title="重新开始">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 7v5h-5M19 12a7 7 0 1 0-2 5" />
        </svg>
      </button>
      <div class="volume-control">
      <button class="mute-btn" :class="{ active: muted }" @click="muted = !muted" :title="muted ? '取消静音' : '静音'">
        <svg v-if="muted" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 5 6 9H3v6h3l5 4V5zM23 9l-6 6M17 9l6 6" />
        </svg>
        <svg v-else width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 5 6 9H3v6h3l5 4V5zM15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14" />
        </svg>
      </button>
        <input v-model.number="volume" type="range" min="0" max="1" step="0.05" aria-label="游戏音量" />
      </div>
    </div>

    <div v-if="ActiveGame && selected" class="game-stage">
      <component
        :is="ActiveGame"
        :key="`${selected.id}-${runId}`"
        :muted="muted"
        :volume="volume"
        :paused="paused"
        @exit="closeGame"
        @finish="showResult"
      />

      <div v-if="guideVisible" class="game-overlay">
        <div class="overlay-panel">
          <span class="overlay-kicker">操作说明</span>
          <strong>{{ selected.name }}</strong>
          <p>{{ selected.controls }}</p>
          <small>{{ selected.scoreRule }}</small>
          <button type="button" @click="startGuidedGame">开始游戏</button>
        </div>
      </div>

      <div v-else-if="result" class="game-overlay">
        <div class="overlay-panel result-panel">
          <span class="overlay-kicker">本局结束</span>
          <strong>{{ result.title }}</strong>
          <p>{{ selected.scoreLabel }} {{ result.score }}</p>
          <small>{{ result.detail || selected.scoreRule }}</small>
          <div class="overlay-actions">
            <button type="button" @click="restartGame">再来一局</button>
            <button type="button" class="secondary" @click="closeGame">返回列表</button>
          </div>
        </div>
      </div>

      <div v-else-if="paused" class="game-overlay pause-overlay">
        <div class="overlay-panel">
          <span class="overlay-kicker">游戏已暂停</span>
          <strong>准备好再继续</strong>
          <small>窗口失焦时会自动暂停</small>
          <button type="button" @click="togglePause">继续游戏</button>
        </div>
      </div>
    </div>

    <div v-else class="game-grid">
      <button
        v-for="game in GAMES"
        :key="game.id"
        class="game-card"
        :class="`thumb-${game.id}`"
        @click="openGame(game)"
      >
        <span class="thumb" :class="`cover-${game.id}`" :style="{ '--game-color': game.palette }">
          <span v-for="n in 9" :key="n" />
        </span>
        <span class="card-copy">
          <strong>{{ game.name }}</strong>
          <small>{{ game.tagline }}</small>
        </span>
        <span class="card-score">{{ game.scoreLabel }} {{ highscores[game.id] || '-' }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.arcade {
  display: grid;
  grid-template-rows: 34px 1fr;
  gap: 8px;
  height: 100%;
  min-height: 0;
}

.arcade-top {
  display: flex;
  align-items: center;
  gap: 8px;
}

.arcade-title {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.arcade-title strong {
  color: var(--ink-1);
  font-size: 13px;
  font-weight: 800;
  line-height: 16px;
}

.arcade-title span {
  color: var(--ink-3);
  font-size: 10px;
  font-weight: 700;
  line-height: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.back-btn,
.mute-btn,
.tool-btn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 10px;
  display: grid;
  place-items: center;
  color: var(--accent-color);
  background: var(--surface-color);
  box-shadow: var(--shadow-raised);
  cursor: pointer;
  flex: 0 0 auto;
}

.mute-btn.active,
.tool-btn.active {
  color: var(--ink-2);
  background: var(--tint-color);
  box-shadow: var(--shadow-pressed);
}

.volume-control {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 5px;
}

.volume-control input {
  width: 46px;
  height: 14px;
  accent-color: var(--accent-color);
  cursor: pointer;
}

.game-stage {
  position: relative;
  min-height: 0;
  overflow: hidden;
}

.game-stage > :deep(*) {
  height: 100%;
}

.game-overlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(255, 253, 251, 0.72);
  backdrop-filter: blur(8px);
}

.pause-overlay {
  background: rgba(255, 253, 251, 0.58);
}

.overlay-panel {
  width: min(100%, 244px);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 18px;
  border-radius: var(--radius-md);
  color: var(--ink-1);
  background: var(--surface-color);
  box-shadow: var(--shadow-raised), 0 14px 32px rgba(43, 38, 33, 0.12);
  text-align: center;
}

.overlay-kicker {
  color: var(--accent-color);
  font-size: 10px;
  font-weight: 800;
}

.overlay-panel strong {
  font-size: 16px;
  line-height: 1.2;
}

.overlay-panel p,
.overlay-panel small {
  margin: 0;
  line-height: 1.55;
}

.overlay-panel p {
  color: var(--ink-2);
  font-size: 12px;
  font-weight: 650;
}

.overlay-panel small {
  color: var(--ink-3);
  font-size: 10px;
}

.overlay-panel button {
  min-width: 88px;
  border: 0;
  border-radius: 999px;
  padding: 7px 14px;
  color: #fff;
  background: var(--accent-color);
  box-shadow: 0 4px 10px var(--accent-soft);
  font: inherit;
  font-size: 11px;
  font-weight: 800;
  cursor: pointer;
}

.overlay-actions {
  display: flex;
  gap: 8px;
}

.overlay-panel button.secondary {
  color: var(--ink-2);
  background: var(--tint-color);
  box-shadow: var(--shadow-pressed);
}

.game-grid {
  min-height: 0;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-auto-rows: 99px;
  align-content: start;
  gap: 8px;
  padding-right: 2px;
}

.game-card {
  min-height: 0;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--surface-color);
  box-shadow: var(--shadow-raised);
  cursor: pointer;
  display: grid;
  grid-template-rows: 40px 27px 12px;
  gap: 3px;
  padding: 6px;
  text-align: left;
  font-family: inherit;
  color: var(--ink-1);
  overflow: hidden;
  transition: transform 0.15s ease;
}

.game-card:hover {
  transform: translateY(-1px);
}

.thumb {
  --game-color: #ff8c55;
  position: relative;
  overflow: hidden;
  border-radius: 6px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 3px;
  padding: 6px;
  background: color-mix(in srgb, var(--game-color) 18%, #ffffff);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--game-color) 28%, transparent);
}

.thumb::before,
.thumb::after {
  content: "";
  position: absolute;
  pointer-events: none;
}

.thumb span {
  border-radius: 2px;
  background: var(--game-color);
  opacity: 0.92;
}

.cover-snake {
  background: #b9c978;
  box-shadow: inset 0 0 0 3px #32401f, inset 0 0 0 5px rgba(255, 255, 255, 0.16);
}

.cover-snake span {
  opacity: 0;
}

.cover-snake span:nth-child(4),
.cover-snake span:nth-child(5),
.cover-snake span:nth-child(6),
.cover-snake span:nth-child(9) {
  opacity: 1;
  background: #32401f;
  border-radius: 1px;
}

.cover-snake::after {
  right: 18px;
  top: 22px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #32401f;
}

.cover-mario {
  background: linear-gradient(#8fd7ff 0 56%, #7cc95e 56% 74%, #bd7431 74%);
}

.cover-mario span {
  opacity: 0;
}

.cover-mario span:nth-child(1),
.cover-mario span:nth-child(2) {
  opacity: 1;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 999px;
}

.cover-mario span:nth-child(7) {
  opacity: 1;
  background: #e84d38;
  box-shadow: 0 8px 0 #2d66c2;
}

.cover-mario::after {
  right: 15px;
  bottom: 12px;
  width: 12px;
  height: 24px;
  background: #2fac61;
  box-shadow: 0 -6px 0 5px #37c870;
}

.cover-tetris {
  background: #c8d0bd;
  box-shadow: inset 0 0 0 4px #22291f;
}

.cover-tetris span {
  background: #22291f;
  border-radius: 1px;
}

.cover-tetris span:nth-child(1),
.cover-tetris span:nth-child(5),
.cover-tetris span:nth-child(9) {
  opacity: 0.16;
}

.cover-breakout {
  display: block;
  background: #19152a;
  box-shadow: inset 0 0 0 3px #38262c;
}

.cover-breakout span {
  position: absolute;
  width: 26px;
  height: 8px;
  opacity: 1;
  background: #f05d75;
}

.cover-breakout span:nth-child(1) { left: 9px; top: 9px; background: #ffcf5a; }
.cover-breakout span:nth-child(2) { left: 39px; top: 9px; background: #f05d75; }
.cover-breakout span:nth-child(3) { right: 9px; top: 9px; background: #6ee7f5; }
.cover-breakout span:nth-child(4) { left: 9px; top: 21px; background: #f05d75; }
.cover-breakout span:nth-child(5) { left: 39px; top: 21px; background: #6ee7f5; }
.cover-breakout span:nth-child(6) { right: 9px; top: 21px; background: #ffcf5a; }
.cover-breakout span:nth-child(n+7) { opacity: 0; }
.cover-breakout::before {
  left: 50%;
  bottom: 14px;
  width: 8px;
  height: 8px;
  transform: translateX(-50%);
  border-radius: 50%;
  background: white;
}
.cover-breakout::after {
  left: 50%;
  bottom: 5px;
  width: 46px;
  height: 6px;
  transform: translateX(-50%);
  border-radius: 999px;
  background: #6ee7f5;
}

.cover-sokoban {
  background: #e8c28b;
  box-shadow: inset 0 0 0 4px #8d572c;
}

.cover-sokoban span {
  background: #f8dfb3;
  box-shadow: inset 0 0 0 1px rgba(93, 53, 24, 0.12);
}

.cover-sokoban span:nth-child(1),
.cover-sokoban span:nth-child(2),
.cover-sokoban span:nth-child(3),
.cover-sokoban span:nth-child(7),
.cover-sokoban span:nth-child(8),
.cover-sokoban span:nth-child(9) {
  background: #8d572c;
}

.cover-sokoban span:nth-child(5) {
  background: #bd7c36;
  box-shadow: inset 0 0 0 2px rgba(80, 43, 16, 0.28);
}

.cover-sokoban::after {
  right: 16px;
  bottom: 13px;
  width: 10px;
  height: 10px;
  border: 3px solid #d95242;
  border-radius: 50%;
}

.cover-shooter {
  display: block;
  background: linear-gradient(#111a58, #6c55b9);
  box-shadow: inset 0 0 0 3px #17235f;
}

.cover-shooter span {
  position: absolute;
  width: 2px;
  height: 10px;
  background: rgba(232, 244, 255, 0.72);
  opacity: 1;
}

.cover-shooter span:nth-child(1) { left: 18px; top: 9px; }
.cover-shooter span:nth-child(2) { left: 48px; top: 16px; }
.cover-shooter span:nth-child(3) { right: 16px; top: 8px; }
.cover-shooter span:nth-child(4) { left: 25px; top: 30px; }
.cover-shooter span:nth-child(n+5) { opacity: 0; }
.cover-shooter::before {
  left: 50%;
  bottom: 9px;
  transform: translateX(-50%);
  border-left: 12px solid transparent;
  border-right: 12px solid transparent;
  border-bottom: 24px solid #e8f4ff;
}
.cover-shooter::after {
  top: 12px;
  right: 26px;
  width: 20px;
  height: 14px;
  border-radius: 50% 50% 6px 6px;
  background: #ff6b9a;
}

.card-copy {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.card-copy strong {
  font-size: 11px;
  line-height: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-copy small,
.card-score {
  color: var(--ink-2);
  font-size: 9px;
  line-height: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
