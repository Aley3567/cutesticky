<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watchEffect } from 'vue'
import {
  clearFocusTask,
  initializePomodoro,
  pomodoroState,
  resetPomodoro,
  skipPomodoro,
  subscribePomodoroEvents,
  togglePomodoro,
} from '../services/pomodoroStore'
import type { PomodoroPhase } from '../services/pomodoroLogic'

const PHASE_LABELS: Record<PomodoroPhase, string> = {
  work: '专注',
  shortBreak: '短休',
  longBreak: '长休',
}

const PHASES: PomodoroPhase[] = ['work', 'shortBreak', 'longBreak']
const RADIUS = 70
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const liveMessage = ref('')

const minutes = computed(() => String(Math.floor(pomodoroState.remainingSeconds / 60)).padStart(2, '0'))
const seconds = computed(() => String(pomodoroState.remainingSeconds % 60).padStart(2, '0'))
const progress = computed(() => {
  if (pomodoroState.totalSeconds <= 0) return 0
  return Math.min(1, Math.max(0, 1 - pomodoroState.remainingSeconds / pomodoroState.totalSeconds))
})
const percentLabel = computed(() => `${Math.round(progress.value * 100)}% · ${PHASE_LABELS[pomodoroState.phase]}${pomodoroState.running ? '中' : ''}`)
const dashOffset = computed(() => CIRCUMFERENCE * (1 - progress.value))

let unsubscribe: (() => void) | null = null

onMounted(async () => {
  await initializePomodoro()
  unsubscribe = subscribePomodoroEvents(event => {
    liveMessage.value = `${event.title}：${event.body}`
  })
})

onUnmounted(() => {
  unsubscribe?.()
  document.title = 'cute sticky'
})

watchEffect(() => {
  if (pomodoroState.running && pomodoroState.phase === 'work') {
    const task = pomodoroState.activeTask?.text ? ` · ${pomodoroState.activeTask.text}` : ' · 专注'
    document.title = `${minutes.value}:${seconds.value}${task}`
  } else {
    document.title = 'cute sticky'
  }
})
</script>

<template>
  <div class="pomo">
    <div class="status-row">
      <div class="pomo-mode" aria-label="番茄钟阶段">
        <b v-for="phase in PHASES" :key="phase" :class="{ on: pomodoroState.phase === phase }">
          {{ PHASE_LABELS[phase] }}
        </b>
      </div>
      <span class="today-count" :title="`今天完成 ${pomodoroState.todayRounds} 轮专注`">
        今日 {{ pomodoroState.todayRounds }} 轮
      </span>
    </div>

    <div v-if="pomodoroState.activeTask" class="focus-task">
      <span>正在处理</span>
      <strong :title="pomodoroState.activeTask.text">{{ pomodoroState.activeTask.text }}</strong>
      <button @click="clearFocusTask" title="取消关联任务" aria-label="取消关联任务">×</button>
    </div>
    <div v-else class="focus-task empty-task">未关联待办</div>

    <div class="ring-wrap">
      <div class="ring-base" />
      <svg class="ring-svg" viewBox="0 0 168 168" aria-hidden="true">
        <circle cx="84" cy="84" :r="RADIUS" fill="none" stroke="rgba(43, 38, 33, 0.06)" stroke-width="13" />
        <circle
          cx="84"
          cy="84"
          :r="RADIUS"
          fill="none"
          stroke="var(--accent-color)"
          stroke-width="13"
          stroke-linecap="round"
          :stroke-dasharray="CIRCUMFERENCE"
          :stroke-dashoffset="dashOffset"
          class="ring-progress"
        />
      </svg>
      <div class="ring-center">
        <span class="ring-time">{{ minutes }}:{{ seconds }}</span>
        <span class="ring-lab">{{ percentLabel }}</span>
      </div>
    </div>

    <div class="pomo-dots" :aria-label="`当前第 ${pomodoroState.round} 轮`">
      <i
        v-for="index in 4"
        :key="index"
        :class="{
          fill: index < pomodoroState.round
            || (index === pomodoroState.round && pomodoroState.phase !== 'work')
            || (index <= pomodoroState.round && pomodoroState.phase === 'work' && pomodoroState.running),
        }"
      />
    </div>

    <div class="pomo-ctrl">
      <button class="pomo-btn ghost" @click="resetPomodoro" title="重置" aria-label="重置番茄钟">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 12a9 9 0 1 0 9-9 9 9 0 0 0-6.4 2.6L3 8M3 3v5h5"/>
        </svg>
      </button>
      <button class="pomo-btn" @click="() => togglePomodoro()">
        <svg v-if="!pomodoroState.running" viewBox="0 0 24 24"><polygon points="7,4 20,12 7,20"/></svg>
        <svg v-else viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1.5"/><rect x="14" y="5" width="4" height="14" rx="1.5"/></svg>
        {{ pomodoroState.running ? '暂停' : '开始' }}
      </button>
      <button class="pomo-btn ghost" @click="skipPomodoro" title="跳过当前阶段" aria-label="跳过当前阶段">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 4l10 8-10 8V4zM19 5v14"/>
        </svg>
      </button>
    </div>

    <span class="sr-only" role="status" aria-live="polite">{{ liveMessage }}</span>
  </div>
</template>

<style scoped>
.pomo {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.status-row { width: min(100%, 286px); display: flex; align-items: center; gap: var(--space-2); }
.pomo-mode { display: flex; gap: 2px; padding: var(--space-1); background: var(--tint-color); border-radius: 999px; box-shadow: var(--shadow-pressed); }
.pomo-mode b { font-size: 10px; font-weight: 800; padding: 5px 10px; border-radius: 999px; color: var(--ink-3); transition: color 0.15s ease; white-space: nowrap; }
.pomo-mode b.on { background: var(--surface-color); color: var(--accent-color); box-shadow: var(--shadow-raised); }
.today-count { margin-left: auto; font-size: 10px; font-weight: 800; color: var(--accent-color); white-space: nowrap; }

.focus-task {
  width: min(100%, 286px);
  min-height: 27px;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 5px 9px;
  border-radius: 10px;
  background: var(--surface-color);
  box-shadow: var(--shadow-raised);
  color: var(--ink-3);
  font-size: 9px;
  font-weight: 700;
}
.focus-task strong { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ink-1); font-size: 11px; }
.focus-task button { width: 18px; height: 18px; border: 0; background: transparent; color: var(--ink-3); cursor: pointer; font-size: 15px; line-height: 1; }
.empty-task { justify-content: center; background: transparent; box-shadow: none; }

.ring-wrap {
  position: relative;
  width: clamp(168px, 42vmin, 240px);
  height: clamp(168px, 42vmin, 240px);
  flex: none;
}
.ring-svg { width: 100%; height: 100%; }
.ring-base {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: var(--surface-color);
  box-shadow: 0 12px 26px rgba(43, 38, 33, 0.15), inset 0 2px 6px rgba(255, 255, 255, 0.9), inset 0 -6px 12px rgba(43, 38, 33, 0.06);
}
.ring-svg { position: absolute; inset: 0; transform: rotate(-90deg); }
.ring-progress { transition: stroke-dashoffset 0.35s ease; }
.ring-center {
  position: absolute;
  inset: 24px;
  border-radius: 50%;
  background: var(--surface-color);
  box-shadow: var(--shadow-pressed);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
}
.ring-time { font-size: 34px; font-weight: 800; color: var(--ink-1); letter-spacing: -1px; font-variant-numeric: tabular-nums; }
.ring-lab { font-size: 10px; font-weight: 700; color: var(--ink-3); letter-spacing: 0.7px; }

.pomo-dots { display: flex; gap: 7px; margin-top: 1px; }
.pomo-dots i { width: 8px; height: 8px; border-radius: 50%; background: var(--tint-color); box-shadow: var(--shadow-pressed); transition: background 0.2s ease; }
.pomo-dots i.fill { background: var(--accent-color); box-shadow: 0 2px 5px var(--accent-soft); }
.pomo-ctrl { display: flex; gap: var(--space-3); align-items: center; }
.pomo-btn {
  height: 44px;
  padding: 0 24px;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 13px;
  font-weight: 800;
  color: #fff;
  background: var(--accent-color);
  display: flex;
  align-items: center;
  gap: var(--space-2);
  box-shadow: 0 8px 18px var(--accent-soft), inset 0 1px 0 rgba(255, 255, 255, 0.35);
  transition: transform 0.15s ease;
}
.pomo-btn:hover { transform: translateY(-1px); }
.pomo-btn:active { transform: none; }
.pomo-btn svg { width: 15px; height: 15px; fill: #fff; }
.pomo-btn.ghost { width: 44px; padding: 0; justify-content: center; background: var(--surface-color); color: var(--ink-2); box-shadow: var(--shadow-raised); }
.pomo-btn.ghost svg { width: 17px; height: 17px; fill: none; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }

@media (max-height: 420px) {
  .pomo { gap: 7px; }
  .ring-wrap { width: 150px; height: 150px; }
  .ring-svg { width: 150px; height: 150px; }
  .ring-center { inset: 22px; }
}
</style>
