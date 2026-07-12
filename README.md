# Cute Sticky

Cute Sticky 是一个本地优先的 Tauri + Vue 桌面小工具，同时提供只在本机 `localhost` 运行的 Web/PWA 版本。

## 功能

- 多便签：搜索、置顶、配色、拖动排序、撤销删除、转待办
- 待办：今天/以后/已完成分组、截止日期、拖动排序、启动番茄钟
- 番茄钟：绝对时间计时、休眠恢复、任务关联、今日轮数和通知
- 天气：城市候选、逐时/七日预报、30 分钟缓存和离线降级
- AI：Anthropic Messages API 流式对话、停止/重试/编辑重发、Markdown、转便签/待办
- 复古游戏角：6 个可暂停、可调音量并记录成绩的小游戏
- 常用链接：本地保存并通过系统浏览器打开
- 数据工具：版本化 JSON 备份、按模块导入、自动回滚和示例数据
- 桌面更新：启动自动检查、手动检查、一键下载/安装并重启

## 开发

```bash
npm install

# 本机网页端：http://localhost:5173
npm run dev:web

# Tauri 桌面端
npm run tauri dev
```

## 构建与检查

```bash
npm test
npm run build
npm run build:web
cargo check --manifest-path src-tauri/Cargo.toml
npm run tauri build
```

## 发布桌面更新

从 `0.2.0` 开始，桌面应用支持 GitHub Release 一键更新。发布者只需准备版本并推送 `app-v*` 标签；完整的一次性密钥设置和发布步骤见 [docs/releasing.md](docs/releasing.md)。

## 本地数据

- 桌面端使用 Tauri Store。
- 网页端使用 IndexedDB，不可用时降级到 `localStorage`。
- 两端第一阶段不会自动同步，可通过标题栏的“本地数据”入口导入、导出同一种 JSON 备份。
- API Key 默认不会导出；勾选“包含 API Key”后会以明文进入备份文件。
- PWA 只在生产 Web 构建中注册，便签、待办、番茄钟、链接和已预热的游戏资源支持离线使用。

## Web 版限制

- 只绑定本机 `localhost`，不会开放到公网或局域网。
- 没有托盘、窗口置顶、隐藏和关闭窗口等桌面能力。
- AI 使用浏览器直接请求模型接口；服务商必须允许来自 localhost 的 CORS 请求，否则请使用桌面端。
- 天气与 AI 需要网络，断网时会显示缓存或离线提示。

## 技术栈

- Vue 3、TypeScript、Vite
- Tauri 2、Rust
- Vitest
- IndexedDB / Tauri Store
