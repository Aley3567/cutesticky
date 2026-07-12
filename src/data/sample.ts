import { BACKUP_FORMAT, CURRENT_SCHEMA_VERSION, type BackupEnvelope } from './schema'

function localDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function createSampleBackup(now = new Date()): BackupEnvelope {
  const timestamp = now.getTime()
  const tomorrow = new Date(timestamp)
  tomorrow.setDate(tomorrow.getDate() + 1)

  return {
    format: BACKUP_FORMAT,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    appVersion: 'sample',
    data: {
      notes: [
        { id: 1, text: '欢迎使用 Cute Sticky\n这里适合随手记下灵感。', color: 0, pinned: true, updatedAt: timestamp },
        { id: 2, text: '网页端数据保存在当前浏览器，可从设置中导出备份。', color: 2, pinned: false, updatedAt: timestamp - 1 },
      ],
      todos: [
        { id: 1, text: '试试从待办开始一轮专注', done: false, dueDate: localDateKey(now), createdAt: timestamp },
        { id: 2, text: '导出一份本地数据备份', done: false, dueDate: localDateKey(tomorrow), createdAt: timestamp + 1 },
        { id: 3, text: '完成第一次体验', done: true, createdAt: timestamp + 2 },
      ],
      links: [
        { id: 1, name: 'Open-Meteo', url: 'https://open-meteo.com/' },
      ],
      aiChatHistory: [
        { role: 'assistant', content: '你好，我可以帮你润色便签、总结内容或整理待办。' },
      ],
      llmConfig: { baseUrl: '', model: 'claude-opus-4-6' },
      'game:snake:highscore': 8,
      themeIndex: 0,
      activeTab: 'memo',
    },
  }
}
