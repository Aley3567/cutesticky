import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const notesView = readFileSync(new URL('../src/components/NotesView.vue', import.meta.url), 'utf8')
const pomodoroView = readFileSync(new URL('../src/components/PomodoroTimer.vue', import.meta.url), 'utf8')

describe('core focus view layout contract', () => {
  it('keeps note color choices behind one compact palette control', () => {
    expect(notesView).toContain('aria-label="更换便签颜色"')
    expect(notesView).toContain('class="color-menu"')
    expect(notesView).toMatch(/\.note-text\s*\{[^}]*max-height:/s)
    expect(notesView).toContain('.note:only-child .note-text')
  })

  it('groups the task, timer, progress and controls into one visual stage', () => {
    expect(pomodoroView).toContain('class="timer-stage"')
    expect(pomodoroView).toContain('stroke="var(--accent-soft)"')
    expect(pomodoroView).toContain('从待办页选择任务')
  })
})
