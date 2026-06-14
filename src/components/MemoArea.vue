<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { load } from '@tauri-apps/plugin-store'

const memo = ref('')
let store: Awaited<ReturnType<typeof load>> | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null

onMounted(async () => {
  store = await load('sticky-data.json', { autoSave: true })
  const saved = await store.get<string>('memo')
  if (saved) memo.value = saved
})

function onInput() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(async () => {
    await store?.set('memo', memo.value)
  }, 500)
}
</script>

<template>
  <textarea
    v-model="memo"
    class="memo-textarea"
    placeholder="随便写点什么..."
    @input="onInput"
  />
</template>

<style scoped>
.memo-textarea {
  width: 100%;
  height: 100%;
  border: none;
  outline: none;
  resize: none;
  background: transparent;
  font-family: inherit;
  font-size: 13.5px;
  line-height: 1.8;
  color: #444;
  padding: 4px 0;
  user-select: text;
}

.memo-textarea::placeholder {
  color: rgba(0, 0, 0, 0.2);
}
</style>
