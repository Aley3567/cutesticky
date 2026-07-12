import type { Component } from 'vue'

export type GameId = 'snake' | 'mario' | 'tetris' | 'breakout' | 'sokoban' | 'shooter'

export interface GameEntry {
  id: GameId
  name: string
  tagline: string
  scoreLabel: string
  palette: string
  controls: string
  scoreRule: string
  component: () => Promise<Component>
}

export interface GameResult {
  title: string
  score: number
  detail?: string
}

export interface GameRuntimeProps {
  muted: boolean
  volume: number
  paused: boolean
}

export const GAMES: GameEntry[] = [
  {
    id: 'snake',
    name: '贪吃蛇',
    tagline: 'Nokia 绿屏',
    scoreLabel: '最长',
    palette: '#8aa35b',
    controls: '方向键或 WASD 改变方向，吃到圆点会增长。',
    scoreRule: '按蛇身最长长度记录，数字越高越好。',
    component: () => import('./SnakeGame.vue'),
  },
  {
    id: 'mario',
    name: '马里奥',
    tagline: '几何横版',
    scoreLabel: '高分',
    palette: '#ff7c43',
    controls: '方向键或 A / D 移动，空格或 W 跳跃。',
    scoreRule: '按单局累计分数记录，数字越高越好。',
    component: () => import('./MarioGame.vue'),
  },
  {
    id: 'tetris',
    name: '俄罗斯方块',
    tagline: 'GameBoy 黑白',
    scoreLabel: '高分',
    palette: '#596257',
    controls: '左右移动，下键软降，上键或空格旋转。',
    scoreRule: '按消行累计分数记录，数字越高越好。',
    component: () => import('./TetrisGame.vue'),
  },
  {
    id: 'breakout',
    name: '打砖块',
    tagline: 'Arkanoid 彩砖',
    scoreLabel: '高分',
    palette: '#db4c6a',
    controls: '左右方向键或 A / D 移动挡板。',
    scoreRule: '按击碎砖块累计分数记录，数字越高越好。',
    component: () => import('./BreakoutGame.vue'),
  },
  {
    id: 'sokoban',
    name: '推箱子',
    tagline: '仓库谜题',
    scoreLabel: '最少步',
    palette: '#bc7a3b',
    controls: '方向键移动，把全部箱子推到圆形目标。',
    scoreRule: '仅记录通关步数，数字越低越好。',
    component: () => import('./SokobanGame.vue'),
  },
  {
    id: 'shooter',
    name: '飞机大战',
    tagline: '1942 弹幕',
    scoreLabel: '击坠',
    palette: '#4d6ee9',
    controls: '方向键或 WASD 移动，J / 空格手动射击。',
    scoreRule: '按单局击坠数量记录，数字越高越好。',
    component: () => import('./ShooterGame.vue'),
  },
]

export function assertUniqueGameIds(entries = GAMES) {
  return new Set(entries.map(game => game.id)).size === entries.length
}
