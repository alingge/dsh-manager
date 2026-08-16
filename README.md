# 🖥️ DeepSeek Harness — Windows 桌面版管理器

![平台](https://img.shields.io/badge/平台-Windows_10%2F11-0078D6) ![技术](https://img.shields.io/badge/Electron-37-47848F) ![dsh](https://img.shields.io/badge/dsh-0.1.0--rc.5-4CC38A) ![发布](https://img.shields.io/badge/发布-portable_%2B_installer-orange)

> **DeepSeek Harness 的 Windows 桌面版** —— 不用记命令行，可视化地管理官方源码仓库：
> **git 版本查看/切换 · 源码更新 · 一键构建 · 启动 dsh web 界面**，全部点按钮完成。

## 功能

| 页签 | 功能 |
|---|---|
| 概览 | 分支/版本/同步状态/构建产物状态；更新；打开目录；一键回滚到官方 |
| Git | 历史版本列表（release 锚点）切换；fetch / pull（ff-only 防冲突） |
| 构建 | 安装依赖 / 一键构建 / 清理，日志实时滚动，任何结果有横幅提示 |
| 运行 | 启动/停止 dsh web，内嵌窗口或浏览器打开，自动分配空闲端口 |
| 设置 | 仓库路径、Node 路径、DSH_HOME、工作目录 |
| 使用说明 | 内置详细说明书（可搜索） |

## 环境要求

- Windows 10/11
- 已安装并构建好的 deepseek-harness 源码（含 `.git`）
- Node.js ≥ 22.19（dsh 要求 `^22.19.0 || >=24.0.0`）
- pnpm（仓库 `packageManager: pnpm@11.7.0`）
- PowerShell（dsh 的 shell 工具依赖）

## 开发运行

```powershell
cd E:\deepseek-harness\dsh-desktop
npm install
npm start
```

## 打包 exe

```powershell
npm run dist            # portable 单文件 exe + NSIS 安装包（输出到 release/）
npm run dist:portable   # 仅 portable
npm run dist:installer  # 仅安装包
```

## 配置

首次启动自动探测仓库路径（`E:\deepseek-harness\deepseek-harness` 或 `%USERPROFILE%\deepseek-harness`），
也可在「设置」页手动选择。配置保存在 Electron userData 目录的 `settings.json`。

环境变量覆盖（调试用）：`DSH_REPO` 未使用；主进程候选路径见 `src/main.js`。

## 安全设计

- 拉取使用 `git pull --ff-only`：只快进、不合并，杜绝意外冲突
- 「与官方保持一致」执行前自动创建 `backup/<时间戳>` 备份分支，可反悔
- 渲染层 `contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`
- dsh 界面窗口只允许加载 `http://127.0.0.1:*`

## 目录结构

```
dsh-desktop/
├── package.json          # Electron 应用 + electron-builder 配置
├── src/
│   ├── main.js           # 主进程：git/pnpm/dsh 服务、IPC、窗口
│   ├── preload.js        # contextBridge 桥接
│   └── renderer/         # 渲染层（index.html / style.css / renderer.js）
└── release/              # 打包产物（electron-builder 输出）
```
