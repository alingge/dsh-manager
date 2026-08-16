# 🖥️ DeepSeek Harness — Windows Desktop Manager

[中文](README.md) | English

![Platform](https://img.shields.io/badge/Platform-Windows_10%2F11-0078D6) ![Tech](https://img.shields.io/badge/Electron-37-47848F) ![dsh](https://img.shields.io/badge/dsh-0.1.0--rc.5-4CC38A) ![Release](https://img.shields.io/badge/Release-portable_%2B_installer-orange)

> **A Windows desktop version of DeepSeek Harness** — manage the official source repository visually, no command line required:
> **git version switching · source updates · one-click build · launch the dsh web UI**, all by clicking buttons.

## Quick Start (use the prebuilt exe)

> **No need to build it yourself** — ready-made exe files are shipped with this repository.

### 1. Download the exe (choose one)

| File (in the repository `release/` folder) | Description |
|---|---|
| `DeepSeek Harness Manager 0.1.0.exe` | **Portable**: double-click to run, no installation, works from a USB drive |
| `DeepSeek Harness Manager Setup 0.1.0.exe` | **Installer**: installs to Start Menu / Desktop |

### 2. Prerequisite (only one required step)

The manager does **not bundle** the deepseek-harness source code (otherwise the exe would be 1.4 GB). It manages a **local copy of the official source**. First clone the official repo (MIT licensed):

```powershell
git clone https://github.com/deepseek-ai/deepseek-harness %USERPROFILE%\deepseek-harness
```

> Tip: cloning to `%USERPROFILE%\deepseek-harness` is recommended — the manager auto-detects that path; otherwise pick the folder manually in the Settings tab.
> You also need: Windows 10/11 (64-bit), Node.js ≥ 22.19, pnpm, PowerShell (dsh requirements).

### 3. First run (5 steps)

```
① Double-click the portable exe (if SmartScreen appears, click "More info → Run anyway")
② Open the Settings tab and confirm the repo path points to the deepseek-harness source
③ Build tab → Install Dependencies (required the first time, skippable afterwards)
④ Build tab → One-Click Build (compiles the source into a runnable program)
⑤ Run tab → Start → Open Desktop Window (enter the dsh UI)
```

## Features

| Tab | What it does |
|---|---|
| Overview | Branch/version/sync status, build-artifact status; update; open folders; one-click rollback to official |
| Git | Switch between historical versions (release anchors); fetch / pull (`--ff-only`, conflict-proof); branch switching |
| Build | Install dependencies / one-click build / clean; live scrolling logs; every result shows a banner |
| Run | Start/stop dsh web; open in an embedded window or your browser; auto-assigns a free port |
| Settings | Repo path, Node path, DSH_HOME, workspace directory |
| Guide | Built-in detailed user manual (searchable) |

## Requirements

- Windows 10/11
- A local clone of deepseek-harness source (with `.git`)
- Node.js ≥ 22.19 (dsh requires `^22.19.0 || >=24.0.0`)
- pnpm (repo `packageManager: pnpm@11.7.0`)
- PowerShell (used by dsh's shell tools)

## Development

```powershell
cd E:\deepseek-harness\dsh-desktop
npm install
npm start
```

## Packaging

```powershell
npm run dist            # portable exe + NSIS installer (output to release/)
npm run dist:portable   # portable only
npm run dist:installer  # installer only
```

## CI / Auto Release

Pushing a tag matching `v*` triggers [GitHub Actions](.github/workflows/build.yml), which builds both exe files and publishes them as a GitHub Release automatically. You can also trigger it manually from the Actions tab.

## Configuration

On first launch the repo path is auto-detected (`E:\deepseek-harness\deepseek-harness` or `%USERPROFILE%\deepseek-harness`); it can also be set manually in the Settings tab. Settings are stored in `settings.json` under the Electron userData directory.

## Security Design

- Pull uses `git pull --ff-only`: fast-forward only, never merges, so accidental conflicts cannot occur
- "Sync with official" automatically creates a `backup/<timestamp>` branch first — reversible
- Renderer: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
- The dsh UI window only loads `http://127.0.0.1:*`

## Project Layout

```
dsh-desktop/
├── package.json          # Electron app + electron-builder config
├── src/
│   ├── main.js           # Main process: git/pnpm/dsh services, IPC, windows
│   ├── preload.js        # contextBridge bridge
│   └── renderer/         # Renderer (index.html / style.css / renderer.js)
└── release/              # Packaged output (electron-builder)
```

## License

This project is open source under the [MIT License](LICENSE) — **free to use, modify and redistribute** (keep the copyright notice).

- The manager shell is original code of this project (MIT)
- The managed [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) official source is also [MIT](https://github.com/deepseek-ai/deepseek-harness/blob/main/LICENSE) licensed
