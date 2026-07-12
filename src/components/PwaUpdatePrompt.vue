<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

const updateReady = ref(false)

function showUpdate() {
  updateReady.value = true
}

function reload() {
  window.location.reload()
}

onMounted(() => window.addEventListener('cute-sticky:pwa-update', showUpdate))
onBeforeUnmount(() => window.removeEventListener('cute-sticky:pwa-update', showUpdate))
</script>

<template>
  <Transition name="pwa-slide">
    <section v-if="updateReady" class="pwa-update" role="status" aria-live="polite">
      <div>
        <strong>网页版已更新</strong>
        <p>刷新后使用最新功能，本地数据不会丢失。</p>
      </div>
      <button @click="reload">立即刷新</button>
    </section>
  </Transition>
</template>

<style scoped>
.pwa-update {
  position: absolute;
  z-index: 30;
  right: 12px;
  bottom: 12px;
  left: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid rgba(255, 255, 255, 0.75);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--surface-color) 92%, transparent);
  box-shadow: 0 14px 34px rgba(43, 38, 33, 0.2);
  backdrop-filter: blur(18px);
}

strong { color: var(--ink-1); font-size: 12px; }
p { margin-top: 2px; color: var(--ink-2); font-size: 10px; }
button {
  flex: none;
  padding: 8px 12px;
  border: 0;
  border-radius: 10px;
  background: var(--accent-color);
  color: white;
  font: 700 11px/1 var(--font);
  cursor: pointer;
}
.pwa-slide-enter-active, .pwa-slide-leave-active { transition: opacity .18s ease, transform .18s ease; }
.pwa-slide-enter-from, .pwa-slide-leave-to { opacity: 0; transform: translateY(8px); }
</style>
