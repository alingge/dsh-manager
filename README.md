# 🖥️ DeepSeek Harness — Windows 桌面版管理器

![平台](https://img.shields.io/badge/%E5%B9%B3%E5%8F%B0-Windows_10%2F11-0078D6) ![技术](https://img.shields.io/badge/%E6%8A%80%E6%9C%AF-Electron_37-47848F) ![dsh](https://img.shields.io/badge/dsh-0.1.0--rc.5-4CC38A) ![发布](https://img.shields.io/badge/%E5%8F%91%E5%B8%83-portable_%2B_installer-orange) ![CI](https://img.shields.io/github/actions/workflow/status/alingge/dsh-manager/build.yml)

> **DeepSeek Harness 的 Windows 桌面版** —— 不用记命令行，可视化地管理官方源码仓库：
> **git 版本查看/切换 · 源码更新 · 一键构建 · 启动 dsh web 界面**，全部点按钮完成。

## 快速开始（直接使用成品 exe）

> **不需要自己构建**，成品 exe 已随仓库发布，直接下载使用。

### 1. 下载 exe（二选一）

| 文件（在仓库 `release/` 目录） | 说明 |
|---|---|
| `DeepSeek Harness Manager 0.1.1.exe` | **便携版**：双击即用，免安装，可放 U 盘 |
| `DeepSeek Harness Manager Setup 0.1.1.exe` | **安装版**：安装到开始菜单/桌面 |

### 2. 前置准备（只有一步必须）

管理器**不内置** deepseek-harness 源码（否则 exe 会大 1.4GB），它管理的是**本机的官方源码目录**。请先克隆官方源码（MIT 开源）：

```powershell
git clone https://github.com/deepseek-ai/deepseek-harness %USERPROFILE%\deepseek-harness
```

> 建议克隆到 `%USERPROFILE%\deepseek-harness`——管理器会自动探测到这个路径；放别处则在「设置」页手动选择。
> 另需：Windows 10/11（64 位）、Node.js ≥ 22.19、pnpm、PowerShell（dsh 运行要求）。

### 3. 首次使用（5 步）

```
① 双击便携版 exe（SmartScreen 提示时点「更多信息 → 仍要运行」）
② 打开「设置」页，确认仓库路径已指向 deepseek-harness 源码
③ 「构建」页 → 安装依赖（首次必做，之后可跳过）
④ 「构建」页 → 一键构建（把源码编译成可运行程序）
⑤ 「运行」页 → 启动 → 打开桌面窗口（进入 dsh 界面）
```

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

## 更新日志

版本变更见 [CHANGELOG.md](CHANGELOG.md)。

## License

本项目基于 [MIT License](LICENSE) 开源，**免费使用、自由修改与分发**（保留版权声明即可）。

- 管理器外壳为本项目原创代码（MIT）
- 所管理的 [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) 官方源码同样为 [MIT](https://github.com/deepseek-ai/deepseek-harness/blob/main/LICENSE) 协议
