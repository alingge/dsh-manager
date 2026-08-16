'use strict'
/**
 * DeepSeek Harness Manager — Electron 主进程
 * 功能：git 版本管理 / 源码更新 / 回滚对齐官方 / 一键构建 / 启动 dsh web 桌面窗口
 * 反馈：所有子进程输出逐行推送（mgr:log），命令起止事件推送（mgr:event），
 *       渲染层据此显示按钮态 / 日志面板 / 结果横幅 / 状态栏，任何结果必有提示。
 */
const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron')
const { spawn, spawnSync } = require('node:child_process')
const path = require('node:path')
const fs = require('node:fs')

/* ================= 设置 ================= */
const HOME = app.getPath('home')
let settings = { repoPath: '', dshHome: '', nodePath: '', workspacePath: '' }
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json')
function loadSettings() {
  try { settings = { ...settings, ...JSON.parse(fs.readFileSync(settingsFile(), 'utf8')) } } catch { /* 首次运行 */ }
  const candidates = [
    'E:/deepseek-harness/deepseek-harness',
    path.join(HOME, 'deepseek-harness'),
    path.join(HOME, 'dsh', 'deepseek-harness'),
  ]
  if (!settings.repoPath) settings.repoPath = candidates.find((p) => fs.existsSync(path.join(p, 'package.json'))) || ''
}
function saveSettings() {
  try {
    fs.mkdirSync(path.dirname(settingsFile()), { recursive: true })
    fs.writeFileSync(settingsFile(), JSON.stringify(settings, null, 2))
  } catch (e) { log('保存设置失败: ' + e.message, 'err') }
}

/* ================= 日志与事件推送（反馈体系的基础） ================= */
const windows = { main: null, dsh: null }
function send(ch, payload) {
  for (const w of Object.values(windows)) if (w && !w.isDestroyed()) w.webContents.send(ch, payload)
}
/** 逐行日志：渲染层显示在日志面板 */
function log(text, kind = 'out') { send('mgr:log', { ts: new Date().toLocaleTimeString(), kind, text: String(text) }) }
/** 结构化事件：渲染层据此更新按钮态/横幅/状态栏 */
function emit(name, payload = {}) { send('mgr:event', { name, ...payload }) }
function notify(kind, title, detail = '') { emit('notify', { kind, title, detail }) }

/* ================= 子进程封装 ================= */
let activeProc = null
let cmdSeq = 0
/**
 * 统一执行命令：逐行推日志；结束发 cmd-end 事件（含耗时/结果），供渲染层弹横幅。
 * opts: { cwd, env, onLine, onStage }
 */
function runCmd(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const id = ++cmdSeq
    const start = Date.now()
    const isWin = process.platform === 'win32'
    const fullCmd = (isWin && cmd === 'pnpm') ? 'pnpm.cmd' : cmd
    const useShell = isWin && cmd === 'pnpm' // pnpm 在 Windows 上是 .cmd 脚本
    const display = `$ ${cmd} ${args.join(' ')}`
    log(display, 'cmd')
    emit('cmd-start', { id, cmd: display, start: new Date().toLocaleTimeString() })
    let child
    try {
      child = spawn(fullCmd, args, {
        cwd: opts.cwd, env: { ...process.env, ...opts.env },
        shell: useShell, windowsHide: true,
      })
    } catch (e) { emit('cmd-end', { id, ok: false, durationMs: Date.now() - start, error: e.message }); reject(e); return }
    activeProc = child
    const onData = (buf, kind) => {
      const text = buf.toString().replace(/\r?\n$/, '')
      if (text) { log(text, kind); if (opts.onLine) opts.onLine(text) }
    }
    child.stdout.on('data', (b) => onData(b, 'out'))
    child.stderr.on('data', (b) => onData(b, 'err'))
    child.on('error', (e) => {
      activeProc = null
      emit('cmd-end', { id, ok: false, durationMs: Date.now() - start, error: e.message })
      reject(e)
    })
    child.on('close', (code) => {
      activeProc = null
      const durationMs = Date.now() - start
      emit('cmd-end', { id, ok: code === 0, durationMs, code })
      if (code === 0) resolve({ code, durationMs })
      else reject(Object.assign(new Error(`命令退出码 ${code}`), { code, durationMs }))
    })
  })
}
/** 取消当前命令（Windows 下杀整个进程树，防残留） */
function cancelActive() {
  if (!activeProc) return false
  if (process.platform === 'win32') {
    try { spawnSync('taskkill', ['/pid', String(activeProc.pid), '/T', '/F'], { windowsHide: true }) } catch { /* noop */ }
  } else { try { activeProc.kill('SIGTERM') } catch { /* noop */ } }
  return true
}

/* ================= Git 服务 ================= */
function gitSync(args) {
  try {
    const r = spawnSync('git', ['-c', 'safe.directory=*', ...args], { cwd: settings.repoPath, encoding: 'utf8', windowsHide: true })
    return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() }
  } catch (e) { return { ok: false, out: '', err: String(e) } }
}
async function gitRun(args) { return runCmd('git', ['-c', 'safe.directory=*', ...args], { cwd: settings.repoPath }) }

function getStatus() {
  const repo = settings.repoPath
  const hasRepo = !!(repo && fs.existsSync(path.join(repo, '.git')))
  if (!hasRepo) return { hasRepo: false, repo }
  const branch = gitSync(['rev-parse', '--abbrev-ref', 'HEAD']).out || '(detached)'
  const head = gitSync(['rev-parse', '--short', 'HEAD']).out
  const ab = gitSync(['rev-list', '--left-right', '--count', 'HEAD...@{upstream}']).out.split(/\s+/)
  const dirty = gitSync(['status', '--porcelain']).out
  let version = ''
  try { version = JSON.parse(fs.readFileSync(path.join(repo, 'package.json'), 'utf8')).version || '' } catch { /* noop */ }
  return {
    hasRepo: true, repo, branch, head, version,
    ahead: ab[0] || '0', behind: ab[1] || '0',
    dirtyCount: dirty ? dirty.split('\n').filter(Boolean).length : 0,
    artifacts: {
      cli: fs.existsSync(path.join(repo, 'apps', 'cli', 'lib', 'bin.js')),
      web: fs.existsSync(path.join(repo, 'apps', 'web', 'dist', 'index.html')),
    },
  }
}
function getVersions() {
  // 从提交历史提取 release 锚点（仓库无 tag，靠 release(dsh): x.y.z 提交信息）
  const r = gitSync(['log', '--grep=release(dsh)', '--format=%h|%ad|%s', '--date=short'])
  if (!r.ok || !r.out) return []
  return r.out.split('\n').map((line) => {
    const [hash, date, , , version] = line.split('|')
    return { hash, date, version: version || '' }
  })
}
async function gitFetch() { return gitRun(['fetch', '--all', '--prune']) }
async function gitPull() { return gitRun(['pull', '--ff-only']) } // 保守：只快进，不产生合并，杜绝意外冲突
async function gitCheckout(ref, newBranch) {
  const dirty = gitSync(['status', '--porcelain']).out
  if (dirty) throw new Error('工作区有未提交改动，请先提交或 stash 后再切换')
  return newBranch ? gitRun(['checkout', '-b', newBranch, ref]) : gitRun(['checkout', ref])
}
/**
 * 回滚：丢弃自己的改动，与官方保持一致。
 * 安全设计：先自动创建备份分支（可反悔），再切到 master 并 reset --hard origin/master。
 */
async function gitSyncToUpstream() {
  const s = gitSync(['status', '--porcelain'])
  const dirtyCount = s.ok && s.out ? s.out.split('\n').filter(Boolean).length : 0
  const ahead = Number((gitSync(['rev-list', '--count', 'HEAD...@{upstream}']).out || '0')) // 粗略探测
  const stamp = new Date().toISOString().replace(/[-T:]/g, '').slice(0, 14)
  const backup = `backup/${stamp}`
  // 1) 备份当前状态（无论是否干净）
  await gitRun(['branch', backup])
  // 2) 确保在 master（detached 时切过去）
  const cur = gitSync(['rev-parse', '--abbrev-ref', 'HEAD']).out
  if (cur && cur !== 'master' && cur !== '(detached)') await gitRun(['checkout', 'master'])
  if (!cur || cur === '(detached)') await gitRun(['checkout', 'master'])
  // 3) 强制对齐远程
  await gitRun(['reset', '--hard', 'origin/master'])
  return { backup, dirtyCount, ahead }
}
async function checkDirtyForPull() {
  const s = gitSync(['status', '--porcelain'])
  return { dirtyCount: s.ok && s.out ? s.out.split('\n').filter(Boolean).length : 0 }
}

/* ================= 构建服务 ================= */
async function runInstall() { return runCmd('pnpm', ['install'], { cwd: settings.repoPath }) }
async function runBuild() { return runCmd('pnpm', ['run', 'build'], { cwd: settings.repoPath }) }
async function runClean() { return runCmd('pnpm', ['run', 'clean'], { cwd: settings.repoPath }) }

/* ================= dsh web 服务 ================= */
const dsh = { proc: null, url: '', port: '' }
function nodeBin() { return settings.nodePath || 'node' }
function checkNodeVersion() {
  const r = spawnSync(nodeBin(), ['--version'], { encoding: 'utf8', windowsHide: true })
  if (r.status !== 0 || r.error) throw new Error('找不到 Node.js：请在「设置」页配置 node 路径')
  const v = (r.stdout || '').trim().replace(/^v/, '')
  const [major, minor] = v.split('.').map(Number)
  const ok = (major === 22 && minor >= 19) || major >= 24
  if (!ok) throw new Error(`Node 版本 ${v} 不满足 dsh 要求（^22.19.0 或 >=24.0.0），请升级或在设置页指定 node 路径`)
  return v
}
function startDsh() {
  if (dsh.proc) return { already: true, url: dsh.url, port: dsh.port }
  const nodeV = checkNodeVersion()
  const bin = path.join(settings.repoPath, 'apps', 'cli', 'lib', 'bin.js')
  if (!fs.existsSync(bin)) throw new Error('CLI 未构建：请先在「构建」页执行 一键构建')
  if (!fs.existsSync(path.join(settings.repoPath, 'apps', 'web', 'dist', 'index.html'))) throw new Error('前端 dist 未构建：请先在「构建」页执行 一键构建')
  const cwd = settings.workspacePath || settings.repoPath
  return new Promise((resolve, reject) => {
    const env = { ...process.env }
    if (settings.dshHome) env.DSH_HOME = settings.dshHome
    let child
    try { child = spawn(nodeBin(), [bin, 'web', '--port', '0'], { cwd, env, windowsHide: true }) }
    catch (e) { reject(e); return }
    dsh.proc = child
    let settled = false
    emit('dsh-booting', { node: nodeV })
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      try { child.kill() } catch { /* noop */ }
      reject(new Error('启动超时：20 秒内未收到 dsh web 地址'))
    }, 20000)
    const onOut = (buf) => {
      const text = buf.toString()
      log(text.trimEnd(), 'out')
      const m = text.match(/dsh web: (https?:\/\/[^\s]+)/)
      if (m && !settled) {
        settled = true
        clearTimeout(timer)
        dsh.url = m[1]
        try { dsh.port = new URL(m[1]).port } catch { dsh.port = '' }
        emit('dsh-started', { url: dsh.url, port: dsh.port })
        resolve({ url: dsh.url, port: dsh.port })
      }
    }
    child.stdout.on('data', onOut)
    child.stderr.on('data', (b) => log(b.toString().trimEnd(), 'err'))
    child.on('error', (e) => { if (!settled) { settled = true; clearTimeout(timer); reject(e) } })
    child.on('close', (code) => {
      dsh.proc = null
      if (settled) { emit('dsh-stopped', { code }); log(`dsh web 已退出 (code=${code})`, 'warn') }
      else { settled = true; clearTimeout(timer); reject(new Error(`dsh web 启动失败 (code=${code})`)) }
    })
  })
}
function stopDsh() {
  if (!dsh.proc) return { running: false }
  if (process.platform === 'win32') {
    try { spawnSync('taskkill', ['/pid', String(dsh.proc.pid), '/T', '/F'], { windowsHide: true }) } catch { /* noop */ }
  } else { try { dsh.proc.kill() } catch { /* noop */ } }
  dsh.proc = null
  return { running: false }
}
function openDshWindow() {
  if (!dsh.url) throw new Error('dsh web 尚未启动，请先点击「启动」')
  if (windows.dsh && !windows.dsh.isDestroyed()) { windows.dsh.focus(); return }
  windows.dsh = new BrowserWindow({
    width: 1280, height: 860, title: 'DeepSeek Harness', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  })
  windows.dsh.loadURL(dsh.url)
  windows.dsh.on('closed', () => { windows.dsh = null })
}
function openDshBrowser() { if (dsh.url) shell.openExternal(dsh.url) }

/* ================= IPC ================= */
function registerIpc() {
  // 统一包装：捕获异常返回 { ok:false, error }，并推送红色横幅
  const wrap = (fn) => async () => {
    try { return { ok: true, data: await fn() } }
    catch (e) { log(e.message, 'err'); notify('error', '操作失败', e.message); return { ok: false, error: e.message } }
  }
  ipcMain.handle('mgr:getSettings', () => settings)
  ipcMain.handle('mgr:saveSettings', (_e, s) => { settings = { ...settings, ...s }; saveSettings(); return settings })
  ipcMain.handle('mgr:chooseRepo', async () => {
    const r = await dialog.showOpenDialog(windows.main, { properties: ['openDirectory'], title: '选择 deepseek-harness 源码仓库目录' })
    if (!r.canceled && r.filePaths[0]) { settings.repoPath = r.filePaths[0]; saveSettings() }
    return settings.repoPath
  })
  ipcMain.handle('mgr:getStatus', wrap(getStatus))
  ipcMain.handle('mgr:getVersions', wrap(getVersions))
  ipcMain.handle('mgr:fetch', wrap(gitFetch))
  ipcMain.handle('mgr:pull', wrap(async () => {
    const d = await checkDirtyForPull()
    if (d.dirtyCount > 0) throw new Error(`工作区有 ${d.dirtyCount} 个文件改动未提交，请先提交或使用「与官方保持一致」后再拉取`)
    return gitPull()
  }))
  ipcMain.handle('mgr:checkout', (_e, ref, branch) => wrap(() => gitCheckout(ref, branch))())
  ipcMain.handle('mgr:syncToUpstream', wrap(gitSyncToUpstream))
  ipcMain.handle('mgr:runInstall', wrap(runInstall))
  ipcMain.handle('mgr:runBuild', wrap(runBuild))
  ipcMain.handle('mgr:runClean', wrap(runClean))
  ipcMain.handle('mgr:cancel', () => ({ canceled: cancelActive() }))
  ipcMain.handle('mgr:startDsh', wrap(startDsh))
  ipcMain.handle('mgr:stopDsh', () => stopDsh())
  ipcMain.handle('mgr:openDshWindow', wrap(openDshWindow))
  ipcMain.handle('mgr:openDshBrowser', () => openDshBrowser())
  ipcMain.handle('mgr:openRepo', () => { if (settings.repoPath) shell.openPath(settings.repoPath) })
  ipcMain.handle('mgr:openDshHome', () => shell.openPath(settings.dshHome || path.join(HOME, '.dsh')))
}

/* ================= 应用生命周期 ================= */
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (windows.main) { if (windows.main.isMinimized()) windows.main.restore(); windows.main.focus() }
  })
  app.whenReady().then(() => {
    Menu.setApplicationMenu(null) // 去掉所有窗口的菜单栏（File/Edit/View/Window/Help 等）
    loadSettings()
    registerIpc()
    windows.main = new BrowserWindow({
      width: 1160, height: 780, minWidth: 900, minHeight: 640, title: 'DeepSeek Harness Manager', autoHideMenuBar: true,
      webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
    })
    windows.main.loadFile(path.join(__dirname, 'renderer', 'index.html'))
    windows.main.on('closed', () => { windows.main = null })
    windows.main.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('http://127.0.0.1') || url.startsWith('http://localhost')) { openDshWindow(); return { action: 'deny' } }
      shell.openExternal(url)
      return { action: 'deny' }
    })
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) app.quit() })
  })
  app.on('window-all-closed', () => { stopDsh(); app.quit() })
}
