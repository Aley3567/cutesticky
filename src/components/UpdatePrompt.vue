<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import {
  checkForUpdates,
  dismissUpdatePrompt,
  installPendingUpdate,
  updateState,
} from '../services/updateService'

let startupTimer: number | null = null

onMounted(() => {
  if (!import.meta.env.PROD) return
  document.addEventListener('visibilitychange', checkWhenVisible)
  startupTimer = window.setTimeout(() => void checkForUpdates(false), 2400)
})

onBeforeUnmount(() => {
  if (startupTimer !== null) window.clearTimeout(startupTimer)
  document.removeEventListener('visibilitychange', checkWhenVisible)
})

function checkWhenVisible() {
  if (document.visibilityState === 'visible') void checkForUpdates(false)
}

const busyPhases = new Set(['downloading', 'installing', 'restarting'])
</script>

<template>
  <Transition name="update-slide">
    <section v-if="updateState.visible" class="update-card" role="status" aria-live="polite">
      <button
        v-if="!busyPhases.has(updateState.phase)"
        class="update-close"
        title="稍后处理"
        aria-label="关闭更新提示"
        @click="dismissUpdatePrompt"
      >×</button>

      <template v-if="updateState.phase === 'available'">
        <div class="update-icon" aria-hidden="true">↧</div>
        <div class="update-copy">
          <strong>新版本 {{ updateState.version }}</strong>
          <span v-if="updateState.currentVersion">当前 {{ updateState.currentVersion }}</span>
          <p>{{ updateState.notes }}</p>
        </div>
        <div class="update-actions">
          <button class="secondary" @click="dismissUpdatePrompt">稍后</button>
          <button class="primary" @click="installPendingUpdate">一键更新</button>
        </div>
      </template>

      <template v-else>
        <div class="update-spinner" :class="{ static: updateState.phase === 'idle' || updateState.phase === 'error' }" aria-hidden="true" />
        <div class="update-copy compact">
          <strong>{{ updateState.message }}</strong>
          <div v-if="busyPhases.has(updateState.phase)" class="update-progress" aria-label="更新进度">
            <span :style="{ width: `${updateState.progress}%` }" />
          </div>
        </div>
        <button v-if="updateState.phase === 'error'" class="secondary retry" @click="checkForUpdates(true)">重试</button>
      </template>
    </section>
  </Transition>
</template>

<style scoped>
.update-card {
  position: absolute;
  z-index: 30;
  right: 12px;
  bottom: 12px;
  left: 12px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.7);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--surface-color) 92%, transparent);
  box-shadow: 0 14px 34px rgba(43, 38, 33, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(18px);
}

.update-icon {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: 12px;
  background: var(--accent-soft);
  color: var(--accent-color);
  font-size: 23px;
  font-weight: 800;
}

.update-copy {
  min-width: 0;
  padding-right: 18px;
}

.update-copy strong,
.update-copy span {
  display: block;
}

.update-copy strong {
  color: var(--ink-1);
  font-size: 13px;
}

.update-copy span,
.update-copy p {
  color: var(--ink-2);
  font-size: 10px;
}

.update-copy p {
  display: -webkit-box;
  margin-top: 4px;
  overflow: hidden;
  line-height: 1.4;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.update-copy.compact {
  padding-right: 30px;
}

.update-actions {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.update-actions button,
.retry {
  height: 30px;
  padding: 0 13px;
  border: 0;
  border-radius: 10px;
  font: 700 11px/1 var(--font);
  cursor: pointer;
}

.primary {
  background: var(--accent-color);
  color: white;
  box-shadow: 0 5px 12px color-mix(in srgb, var(--accent-color) 28%, transparent);
}

.secondary {
  background: var(--cream);
  color: var(--ink-2);
  box-shadow: var(--shadow-raised);
}

.retry {
  justify-self: end;
}

.update-close {
  position: absolute;
  top: 7px;
  right: 8px;
  width: 22px;
  height: 22px;
  border: 0;
  background: transparent;
  color: var(--ink-3);
  font: 700 17px/1 var(--font);
  cursor: pointer;
}

.update-spinner {
  width: 24px;
  height: 24px;
  border: 3px solid var(--accent-soft);
  border-top-color: var(--accent-color);
  border-radius: 50%;
  animation: update-spin 0.8s linear infinite;
}

.update-spinner.static {
  border-color: var(--accent-soft);
  background: var(--accent-color);
  box-shadow: inset 0 0 0 7px var(--surface-color);
  animation: none;
}

.update-progress {
  height: 5px;
  margin-top: 7px;
  overflow: hidden;
  border-radius: 99px;
  background: var(--accent-soft);
}

.update-progress span {
  height: 100%;
  border-radius: inherit;
  background: var(--accent-color);
  transition: width 0.15s ease;
}

.update-slide-enter-active,
.update-slide-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.update-slide-enter-from,
.update-slide-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

@keyframes update-spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .update-spinner,
  .update-slide-enter-active,
  .update-slide-leave-active {
    animation: none;
    transition: none;
  }
}
</style>
