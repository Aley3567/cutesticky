# 桌面端一键更新发布

Cute Sticky 使用 Tauri Updater + GitHub Releases。应用启动后会自动检查更新，标题栏的下载按钮也可以手动检查；发现新版本时可“一键更新”，安装完成后自动重启。

## 一次性设置

更新包必须签名。私钥仅保存在开发电脑：

```text
~/.tauri/cute-sticky.key
```

公钥已经写入 `src-tauri/tauri.conf.json`。不要提交、复制到聊天或公开私钥。首次启用 GitHub 发布时，在仓库的 Settings → Secrets and variables → Actions 新增：

- `TAURI_SIGNING_PRIVATE_KEY`：`~/.tauri/cute-sticky.key` 的完整内容
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`：当前密钥没有密码，设为空字符串即可；若 GitHub 不接受空 Secret，可以不创建此项

## 以后发布新版本

例如发布 `0.2.1`：

```bash
npm run release:prepare -- 0.2.1
git add package.json package-lock.json src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/tauri.conf.json
git commit -m "Release v0.2.1"
git tag app-v0.2.1
git push origin HEAD --follow-tags
```

推送标签后，`.github/workflows/release.yml` 会自动测试、构建 Apple Silicon 与 Intel 两种 macOS 包，生成带签名的 `latest.json`，并发布 GitHub Release。已经安装 `0.2.0` 或更高版本的用户会在应用内收到提示，不再需要手动下载安装包。

## 恢复与密钥备份

- 必须安全备份 `~/.tauri/cute-sticky.key`；丢失后，已安装版本无法验证新密钥签出的更新。
- 如果发布失败，不要复用一个错误的版本号；修复后递增 patch 版本重新发布。
- GitHub Release 必须保持 Published 状态；草稿版不会成为 `/releases/latest/`。
