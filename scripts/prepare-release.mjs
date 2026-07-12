import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const version = process.argv[2]
if (!version || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error('用法：npm run release:prepare -- 0.2.1')
  process.exit(1)
}

const root = resolve(import.meta.dirname, '..')

function updateJson(relativePath) {
  const path = resolve(root, relativePath)
  const data = JSON.parse(readFileSync(path, 'utf8'))
  data.version = version
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`)
}

function updateCargoVersion() {
  const path = resolve(root, 'src-tauri/Cargo.toml')
  const source = readFileSync(path, 'utf8')
  const next = source.replace(/(\[package\][\s\S]*?\nversion = ")[^"]+("\n)/, `$1${version}$2`)
  if (next === source) throw new Error('无法更新 src-tauri/Cargo.toml 版本号')
  writeFileSync(path, next)
}

function run(command, args) {
  execFileSync(command, args, { cwd: root, stdio: 'inherit' })
}

updateJson('package.json')
updateJson('src-tauri/tauri.conf.json')
updateCargoVersion()
run('npm', ['install', '--package-lock-only', '--ignore-scripts'])
run('cargo', ['check', '--manifest-path', 'src-tauri/Cargo.toml'])
run('npm', ['test'])
run('npm', ['run', 'build'])

console.log(`\n版本 ${version} 已准备并验证。`)
console.log(`下一步：git commit 后创建并推送标签 app-v${version}。`)
