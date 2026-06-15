<script setup lang="ts">
const memo = defineModel<string>({ default: '' })
</script>

<template>
  <textarea
    v-model="memo"
    class="memo-textarea"
    placeholder="随便写点什么..."
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
