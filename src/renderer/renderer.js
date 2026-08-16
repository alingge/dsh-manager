'use strict'
/**
 * DeepSeek Harness Manager — 渲染层逻辑
 * 通过 window.dshManager（preload 暴露）与主进程通信。
 * 反馈体系：按钮态 / 日志面板 / 结果横幅 / 状态栏 —— 任何操作必有可见反馈。
 */
/* global dshManager */
const $ = (id) => document.getElementById(id)

const state = {
  busy: false,          // 是否有命令在执行
  cancelRequested: false,
  dshRunning: false,
  dshUrl: '',
  versions: [],
  curBranch: '',
  logLines: 0,
  settings: {},
}

/* ================= 页签切换 ================= */
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'))
    document.querySelectorAll('.tab-pane').forEach((p) => p.classList.remove('active'))
    btn.classList.add('active')
    $('tab-' + btn.dataset.tab).classList.add('active')
  })
})

/* ================= 横幅系统 ================= */
function banner(kind, title, detail = '') {
  const el = document.createElement('div')
  el.className = 'banner ' + kind
  el.innerHTML = '<div class="b-title"></div>' + (detail ? '<div class="b-detail"></div>' : '')
  el.querySelector('.b-title').textContent = title
  if (detail) el.querySelector('.b-detail').textContent = detail
  el.addEventListener('click', () => el.remove())
  $('bannerHost').appendChild(el)
  setTimeout(() => { if (el.parentNode) el.remove() }, 8000)
}

/* ================= 状态栏 ================= */
function setStatus(text, cls = '') {
  $('statusText').textContent = text
  const dot = $('statusDot')
  dot.className = 'status-dot' + (cls ? ' ' + cls : '')
}

/* ================= 日志面板 ================= */
function appendLog(line) {
  const el = document.createElement('div')
  el.className = 'log-line ' + (line.kind || 'out')
  el.innerHTML = '<span class="lt">[' + line.ts + ']</span>'
  const span = document.createElement('span')
  span.textContent = line.text
  el.appendChild(span)
  const body = $('logBody')
  const follow = body.scrollTop + body.clientHeight >= body.scrollHeight - 40
  body.appendChild(el)
  if (follow) body.scrollTop = body.scrollHeight
  state.logLines++
  $('logLineCount').textContent = state.logLines + ' 行'
}
$('btnCopyLog').addEventListener('click', () => {
  const text = Array.from($('logBody').children).map((l) => l.textContent).join('\n')
  navigator.clipboard.writeText(text).then(() => banner('success', '日志已复制到剪贴板'))
})
$('btnClearLog').addEventListener('click', () => { $('logBody').innerHTML = ''; state.logLines = 0; $('logLineCount').textContent = '0 行' })
$('btnToggleLog').addEventListener('click', () => {
  const panel = document.querySelector('.log-panel')
  panel.classList.toggle('collapsed')
  $('btnToggleLog').textContent = panel.classList.contains('collapsed') ? '展开 ▴' : '收起 ▾'
})

/* ================= 按钮忙碌管理 ================= */
const busyButtons = []
function setButtonsBusy(ids, busy) {
  ids.forEach((id) => {
    const btn = $(id)
    if (!btn) return
    if (busy) {
      if (!btn.dataset.orig) btn.dataset.orig = btn.textContent
      btn.disabled = true
      btn.textContent = '执行中…'
    } else {
      btn.disabled = false
      if (btn.dataset.orig) btn.textContent = btn.dataset.orig
    }
  })
}
function withBusy(btnIds, fn) {
  return async () => {
    if (state.busy) { banner('cancel', '已有操作在执行中', '请等待当前操作完成或先取消'); return }
    state.busy = true
    state.cancelRequested = false
    setButtonsBusy(btnIds, true)
    setStatus('正在执行…', 'busy')
    try {
      const res = await fn()
      return res
    } finally {
      state.busy = false
      setButtonsBusy(btnIds, false)
      setStatus('就绪')
      refreshAll()
    }
  }
}

/* ================= 概览渲染 ================= */
function renderOverview(st) {
  if (!st.hasRepo) {
    $('overviewRepoMissing').classList.remove('hidden')
    $('overviewContent').classList.add('hidden')
    return
  }
  $('overviewRepoMissing').classList.add('hidden')
  $('overviewContent').classList.remove('hidden')
  $('ovRepo').textContent = st.repo
  $('ovBranch').textContent = st.branch + (st.branch !== '(detached)' ? ' ●' : '')
  $('ovHead').textContent = st.head
  $('ovVersion').textContent = st.version || '未知'
  $('ovSync').textContent = '领先 ' + st.ahead + ' / 落后 ' + st.behind
  $('ovDirty').textContent = st.dirtyCount > 0 ? '⚠ ' + st.dirtyCount + ' 个文件有改动' : '✓ 干净'
  $('ovDirty').style.color = st.dirtyCount > 0 ? 'var(--yellow)' : 'var(--green)'
  const art = []
  art.push(st.artifacts.cli ? '<span style="color:var(--green)">CLI ✓</span>' : '<span style="color:var(--red)">CLI ✗</span>')
  art.push(st.artifacts.web ? '<span style="color:var(--green)">前端 dist ✓</span>' : '<span style="color:var(--red)">前端 dist ✗</span>')
  $('ovArtifacts').innerHTML = art.join('　')
}
function renderGit(st) {
  $('gitBranch').textContent = st.hasRepo ? st.branch : '-'
  $('gitDirty').textContent = st.hasRepo ? (st.dirtyCount > 0 ? '⚠ ' + st.dirtyCount + ' 个文件有改动' : '✓ 干净') : '-'
}
function renderVersions() {
  const tbody = $('versionList')
  tbody.innerHTML = ''
  if (!state.versions.length) { $('versionEmpty').classList.remove('hidden'); return }
  $('versionEmpty').classList.add('hidden')
  const curHead = state.curHead || ''
  state.versions.forEach((v) => {
    const tr = document.createElement('tr')
    if (v.hash === curHead) tr.classList.add('current')
    tr.innerHTML = '<td>' + v.version + (v.hash === curHead ? ' <span class="tag-current">(当前)</span>' : '') + '</td>' +
      '<td>' + v.date + '</td><td class="mono">' + v.hash + '</td>'
    const tdOp = document.createElement('td')
    const btn = document.createElement('button')
    btn.className = 'btn small'
    btn.textContent = v.hash === curHead ? '已在此版本' : '切换'
    btn.disabled = v.hash === curHead
    btn.addEventListener('click', () => openCheckoutModal(v))
    tdOp.appendChild(btn)
    tr.appendChild(tdOp)
    tbody.appendChild(tr)
  })
}

/* ================= 模态框 ================= */
let modalResolve = null
function openModal(title, bodyHtml) {
  $('modalTitle').textContent = title
  $('modalBody').innerHTML = bodyHtml
  $('modalMask').classList.remove('hidden')
  return new Promise((resolve) => { modalResolve = resolve })
}
$('modalOk').addEventListener('click', () => { $('modalMask').classList.add('hidden'); if (modalResolve) modalResolve(true) })
$('modalCancel').addEventListener('click', () => { $('modalMask').classList.add('hidden'); if (modalResolve) modalResolve(false) })
$('modalMask').addEventListener('click', (e) => { if (e.target === $('modalMask')) { $('modalMask').classList.add('hidden'); if (modalResolve) modalResolve(false) } })

function openCheckoutModal(v) {
  const html =
    '<p>将检出历史版本 <b class="mono">' + v.version + '</b>（提交 <span class="mono">' + v.hash + '</span>，日期 ' + v.date + '）。</p>' +
    '<p style="margin-top:8px"><label><input type="radio" name="coMode" value="detached" checked /> 直接检出（detached HEAD，只查看不改动）</label></p>' +
    '<p><label><input type="radio" name="coMode" value="branch" /> 新建分支并检出</label></p>' +
    '<input type="text" id="coBranchName" placeholder="新分支名，如 ver/0.1.0-rc.3" style="display:none" />'
  openModal('切换版本 ' + v.version, html).then(async (ok) => {
    if (!ok) return
    const mode = document.querySelector('input[name=coMode]:checked').value
    const branch = mode === 'branch' ? $('coBranchName').value.trim() : ''
    if (mode === 'branch' && !branch) { banner('error', '请输入新分支名'); return }
    setStatus('正在切换版本 ' + v.version + '…', 'busy')
    const res = await dshManager.checkout(v.hash, branch)
    if (res.ok) banner('success', '已切换到 ' + v.version, branch ? '新分支：' + branch : 'detached HEAD：' + v.hash)
    else banner('error', '切换失败', res.error)
    refreshAll()
  })
  // 单选切换时显示/隐藏分支输入
  document.querySelectorAll('input[name=coMode]').forEach((r) => {
    r.addEventListener('change', () => {
      $('coBranchName').style.display = document.querySelector('input[name=coMode]:checked').value === 'branch' ? 'block' : 'none'
    })
  })
}

/* ================= 分支渲染与切换 ================= */
function renderBranches(list) {
  const el = $('branchList')
  if (!el) return
  if (!list || !list.length) { el.innerHTML = '<span class="muted">无分支信息</span>'; return }
  el.innerHTML = ''
  list.forEach((b) => {
    const row = document.createElement('div')
    row.className = 'branch-row' + (b.current ? ' current' : '')
    const nameEl = document.createElement('span')
    nameEl.className = 'mono'
    nameEl.textContent = (b.remote ? '🌐 ' : '🌿 ') + b.name + (b.current ? '（当前）' : '')
    row.appendChild(nameEl)
    if (!b.current) {
      const btn = document.createElement('button')
      btn.className = 'btn tiny'
      btn.textContent = '切换'
      btn.addEventListener('click', () => openBranchModal(b))
      row.appendChild(btn)
    }
    el.appendChild(row)
  })
}
function openBranchModal(b) {
  const ref = b.remote ? b.name.replace(/^remotes\/[^/]+\//, '') : b.name
  const html = '<p>切换到分支 <b class="mono">' + ref + '</b>？</p>' +
    '<p style="color:var(--muted)">切换前会检查工作区是否有未提交改动；有改动时会拒绝并提示。</p>'
  openModal('切换分支', html).then(async (ok) => {
    if (!ok) return
    setStatus('正在切换分支 ' + ref + '…', 'busy')
    const res = await dshManager.checkout(ref, '')
    if (res.ok) banner('success', '已切换到分支 ' + ref)
    else banner('error', '切换失败', res.error)
    refreshAll()
  })
}

function openSyncModal() {
  const html =
    '<p style="color:var(--yellow)"><b>⚠ 危险操作</b></p>' +
    '<p>将丢弃本地改动，把仓库恢复到与官方（origin/master）完全一致：</p>' +
    '<ul style="padding-left:20px">' +
    '<li>未提交的文件修改将被丢弃</li>' +
    '<li>本地领先的提交将从当前分支移除</li>' +
    '<li>自动切换到 master 分支</li>' +
    '</ul>' +
    '<p>安全措施：执行前会自动创建备份分支 <span class="mono">backup/&lt;时间戳&gt;</span>，后悔了可在 Git 页切回备份分支找回。</p>' +
    '<p style="color:var(--muted)">确认继续吗？</p>'
  openModal('与官方保持一致', html).then(async (ok) => {
    if (!ok) return
    setStatus('正在回滚到官方最新…', 'busy')
    const res = await dshManager.syncToUpstream()
    if (res.ok) {
      const d = res.data
      banner('success', '已恢复与官方一致', '备份分支：' + d.backup + '（如需找回改动请切回该分支）')
    } else banner('error', '回滚失败', res.error)
    refreshAll()
  })
}

/* ================= 构建摘要 ================= */
function showSummary(okKind, text) {
  const el = $('buildSummary')
  el.className = 'summary ' + okKind
  el.textContent = text
  el.classList.remove('hidden')
}
function fmtDuration(ms) {
  if (ms == null) return ''
  const s = Math.round(ms / 1000)
  if (s < 60) return s + ' 秒'
  const m = Math.floor(s / 60)
  return m + ' 分 ' + (s % 60) + ' 秒'
}

/* ================= 运行页 ================= */
function renderRun() {
  const st = state.dshRunning
  $('runState').innerHTML = st
    ? '<span class="pill green">运行中</span>'
    : '<span class="pill gray">已停止</span>'
  $('runUrl').textContent = state.dshUrl || '-'
  $('runPort').textContent = state.dshUrl ? new URL(state.dshUrl).port : '-'
  $('btnStartDsh').disabled = st || state.busy
  $('btnOpenDshWindow').disabled = !st
  $('btnOpenDshBrowser').disabled = !st
  $('btnStopDsh').disabled = !st
}

/* ================= 事件处理（主进程推送） ================= */
dshManager.onLog((line) => appendLog(line))
dshManager.onEvent((ev) => {
  switch (ev.name) {
    case 'cmd-start':
      setStatus('正在执行：' + ev.cmd.replace(/^\$ /, '') + '（' + ev.start + ' 开始）', 'busy')
      break
    case 'cmd-end': {
      const dur = fmtDuration(ev.durationMs)
      if (!ev.ok) {
        if (state.cancelRequested) {
          banner('cancel', '操作已取消', ev.cmd.replace(/^\$ /, '') + '（' + dur + '）')
          setStatus('已取消', '')
        } else {
          banner('error', '操作失败', ev.cmd.replace(/^\$ /, '') + ' 退出码 ' + ev.code + '（' + dur + '），详见日志面板')
          setStatus('执行失败', 'err')
        }
      } else {
        setStatus('执行完成（' + dur + '）', 'ok')
      }
      break
    }
    case 'notify':
      banner(ev.kind === 'error' ? 'error' : 'success', ev.title, ev.detail)
      break
    case 'dsh-booting':
      setStatus('正在启动 dsh web（Node ' + ev.node + '）…', 'busy')
      banner('cancel', '正在启动 dsh web…', '自动分配空闲端口，请稍候（最多 20 秒）')
      break
    case 'dsh-started':
      state.dshRunning = true
      state.dshUrl = ev.url
      renderRun()
      setStatus('dsh web 运行中', 'ok')
      banner('success', 'dsh web 已启动', ev.url)
      break
    case 'dsh-stopped':
      state.dshRunning = false
      state.dshUrl = ''
      renderRun()
      setStatus('dsh web 已停止', '')
      break
  }
})

/* ================= 状态刷新 ================= */
async function refreshAll() {
  const stRes = await dshManager.getStatus()
  if (stRes.ok) {
    state.curBranch = stRes.data.branch || ''
    state.curHead = stRes.data.head || ''
    renderOverview(stRes.data)
    renderGit(stRes.data)
  }
  const vRes = await dshManager.getVersions()
  if (vRes.ok) { state.versions = vRes.data || []; renderVersions() }
  const bRes = await dshManager.getBranches()
  if (bRes.ok) renderBranches(bRes.data)
  renderRun()
}

/* ================= 按钮绑定 ================= */
function bind(btnId, handler) { $(btnId).addEventListener('click', handler) }

// 概览页
bind('btnChooseRepoMissing', async () => {
  const repo = await dshManager.chooseRepo()
  if (repo) { $('cloneTarget').value = repo; refreshAll() }
})
bind('btnCloneRepo', withBusy(['btnCloneRepo', 'btnChooseRepoMissing'], async () => {
  const target = $('cloneTarget').value.trim()
  if (!target) { banner('error', '请先填写克隆目标目录'); return }
  const ok = await openModal('一键克隆官方源码', '<p>将从 <b>https://github.com/deepseek-ai/deepseek-harness</b> 完整克隆到：</p>' +
    '<p class="mono">' + target + '</p>' +
    '<p>完整克隆保留全部历史版本（供版本切换），视网速约需几分钟。进度显示在底部日志面板。</p>' +
    '<p style="color:var(--yellow)">目标目录需为空或不存在。</p>')
  if (!ok) return
  setStatus('正在克隆官方源码…', 'busy')
  const res = await dshManager.cloneRepo(target)
  if (res.ok) banner('success', '克隆完成', '仓库已就绪：' + res.data)
  else banner('error', '克隆失败', res.error)
  refreshAll()
}))
bind('btnOpenRepo', () => dshManager.openRepo())
bind('btnOpenDshHome', () => dshManager.openDshHome())
bind('btnCheckUpdate', async () => {
  setStatus('正在检查更新…', 'busy')
  const res = await dshManager.checkUpdate()
  setStatus('就绪')
  if (!res.ok) { banner('error', '检查更新失败', res.error); return }
  const d = res.data
  if (d.hasUpdate) {
    openModal('发现新版本 v' + d.latest, '<p>当前版本 <b>v' + d.current + '</b>，最新 <b>v' + d.latest + '</b></p>' +
      '<p>更新说明：</p><p class="mono" style="white-space:pre-wrap">' + (d.notes || '（无说明）') + '</p>' +
      '<p style="color:var(--muted)">点击「确定」打开 GitHub Releases 页面下载新版。</p>').then((ok) => {
      if (ok) window.open(d.url, '_blank')
    })
  } else {
    banner('success', '已是最新版本', '当前 v' + d.current)
  }
})
bind('btnFetchOverview', withBusy(['btnFetchOverview', 'btnFetch'], async () => {
  const res = await dshManager.gitFetch()
  if (res.ok) {
    const st = (await dshManager.getStatus()).data
    banner('success', '已获取远程最新信息', '当前 领先 ' + st.ahead + ' / 落后 ' + st.behind + (Number(st.behind) > 0 ? '，可到 Git 页点「拉取」升级' : '，已是最新'))
  } else banner('error', '更新失败', res.error)
}))
bind('btnSyncUpstream', () => openSyncModal())

// Git 页
bind('btnRefresh', async () => {
  setStatus('正在刷新…', 'busy')
  await refreshAll()
  setStatus('就绪')
  banner('success', '已刷新', '界面已重新读取仓库状态')
})
bind('btnFetch', withBusy(['btnFetch', 'btnFetchOverview'], async () => {
  const res = await dshManager.gitFetch()
  if (res.ok) {
    const st = (await dshManager.getStatus()).data
    banner('success', '已获取远程最新信息', '当前 领先 ' + st.ahead + ' / 落后 ' + st.behind + (Number(st.behind) > 0 ? '，可点「拉取」升级' : '，已是最新'))
  } else banner('error', '更新失败', res.error)
}))
bind('btnPull', withBusy(['btnPull'], async () => {
  const res = await dshManager.gitPull()
  if (res.ok) banner('success', '拉取成功', '源码已更新到远程最新（快进合并，无冲突）')
  else banner('error', '拉取失败', res.error + '（详见日志面板）')
}))

// 构建页
bind('btnInstall', withBusy(['btnInstall', 'btnBuild', 'btnClean'], async () => {
  const res = await dshManager.runInstall()
  if (res.ok) banner('success', '依赖安装完成', '耗时 ' + fmtDuration(res.data && res.data.durationMs) + '，详见日志面板')
  else banner('error', '安装失败', res.error)
}))
bind('btnBuild', withBusy(['btnInstall', 'btnBuild', 'btnClean'], async () => {
  const res = await dshManager.runBuild()
  if (res.ok) banner('success', '构建成功', '耗时 ' + fmtDuration(res.data && res.data.durationMs) + '，产物已更新（概览页徽章已刷新）')
  else banner('error', '构建失败', res.error + '，详见日志面板（红色行为错误）')
}))
bind('btnClean', withBusy(['btnInstall', 'btnBuild', 'btnClean'], async () => {
  const res = await dshManager.runClean()
  if (res.ok) banner('success', '清理完成', '构建产物已删除，如需运行请重新「一键构建」')
  else banner('error', '清理失败', res.error)
}))
bind('btnCancelBuild', () => {
  state.cancelRequested = true
  dshManager.cancel().then((r) => {
    banner('cancel', r.canceled ? '已发送取消请求' : '当前没有正在执行的操作')
  })
})

// 运行页
bind('btnStartDsh', withBusy(['btnStartDsh'], async () => {
  const res = await dshManager.startDsh()
  if (res.ok) {
    state.dshRunning = true
    state.dshUrl = res.data.url
    renderRun()
    banner('success', 'dsh web 已启动', res.data.url)
  } else banner('error', '启动失败', res.error)
}))
bind('btnOpenDshWindow', async () => {
  const res = await dshManager.openDshWindow()
  if (!res.ok) banner('error', '无法打开窗口', res.error)
})
bind('btnOpenDshBrowser', () => dshManager.openDshBrowser())
bind('btnStopDsh', async () => {
  await dshManager.stopDsh()
  state.dshRunning = false
  state.dshUrl = ''
  renderRun()
  banner('cancel', 'dsh web 已停止')
})

// 设置页
bind('btnChooseRepo', async () => {
  const repo = await dshManager.chooseRepo()
  if (repo) $('setRepoPath').value = repo
})
bind('btnSaveSettings', async () => {
  const s = {
    repoPath: $('setRepoPath').value.trim(),
    nodePath: $('setNodePath').value.trim(),
    dshHome: $('setDshHome').value.trim(),
    workspacePath: $('setWorkspacePath').value.trim(),
  }
  await dshManager.saveSettings(s)
  const el = $('settingsSaved')
  el.className = 'summary ok'
  el.textContent = '✔ 设置已保存'
  el.classList.remove('hidden')
  banner('success', '设置已保存')
  setTimeout(() => el.classList.add('hidden'), 3000)
  await refreshAll()
})

/* ================= 使用说明 ================= */
function helpHtml() {
  return `
<h3>1. 这是什么</h3>
<p>DeepSeek Harness Manager 是一个 Windows 桌面管理器，专门管理你本机的 deepseek-harness 官方源码仓库：查看与切换版本、更新源码、一键构建、启动 dsh web 界面。它不修改 dsh 本体，只是把命令行操作变成可视化按钮。</p>
<h3>2. 快速上手（3 分钟）</h3>
<ol>
<li>「设置」页确认源码仓库路径（默认自动探测 E:\\deepseek-harness\\deepseek-harness）</li>
<li>「构建」页点 <b>安装依赖</b>（首次必做，之后可跳过）</li>
<li>「构建」页点 <b>一键构建</b>（把源码编译成可运行程序）</li>
<li>「运行」页点 <b>启动</b>，再点 <b>打开桌面窗口</b> 使用 dsh 界面</li>
</ol>
<h3>3. 界面导览</h3>
<table><tr><th>页签</th><th>作用</th></tr>
<tr><td>概览</td><td>仓库状态总览：分支、版本、同步情况、构建产物</td></tr>
<tr><td>Git</td><td>历史版本列表、切换版本、更新、拉取</td></tr>
<tr><td>构建</td><td>安装依赖 / 一键构建 / 清理，日志在底部面板</td></tr>
<tr><td>运行</td><td>启动 / 停止 dsh web，打开内嵌窗口或浏览器</td></tr>
<tr><td>设置</td><td>仓库路径、Node 路径、数据目录、工作目录</td></tr>
<tr><td>使用说明</td><td>本页：详细说明与 FAQ</td></tr></table>
<h3>4. 按钮详解</h3>
<h4>[更新]（概览/Git 页）</h4>
<p><b>做什么：</b>从 GitHub 获取最新提交信息，更新"领先/落后"数字。<b>背后命令：</b>git fetch --all --prune。<b>注意：</b>只下载信息，<b>不改动任何文件</b>。</p>
<h4>[拉取]（Git 页）</h4>
<p><b>做什么：</b>把远程新提交真正下载并合并进当前分支。<b>背后命令：</b>git pull --ff-only。<b>安全设计：</b>只允许快进，绝不产生合并提交，因此<b>不会遇到合并冲突</b>；若本地有改动或提交导致无法快进，命令会安全失败，文件不受影响。</p>
<h4>[刷新]（Git 页）</h4>
<p>重新读取仓库状态刷新界面（只读，不联网、不动文件）。在别的终端动过仓库、界面没跟上时使用。</p>
<h4>[与官方保持一致]（概览页）</h4>
<p><b>做什么：</b>丢弃自己的改动，把仓库恢复成与官方 origin/master 完全一致。<b>背后命令：</b>自动创建备份分支 → git checkout master → git reset --hard origin/master。<b>安全：</b>执行前必弹确认框，且自动创建 <span class="kbd">backup/&lt;时间戳&gt;</span> 备份分支，后悔了可在终端切回该分支找回改动。</p>
<h4>[安装依赖]（构建页）</h4>
<p><b>做什么：</b>安装/补齐源码仓库依赖。<b>背后命令：</b>pnpm install。<b>何时用：</b>首次使用；拉取更新后依赖有变化时。<b>重复点击：</b>安全。若仓库无变化，几秒完成（pnpm 会校验并跳过）；若 node_modules 缺失会自我修复。</p>
<h4>[一键构建]（构建页）</h4>
<p><b>做什么：</b>把源码编译成可运行程序（lib 编译 + 前端打包）。<b>背后命令：</b>pnpm run build。<b>何时用：</b>每次更新源码后；改了自己代码后。耗时约 3-5 分钟，日志实时滚动，可取消。</p>
<h4>[清理]（构建页）</h4>
<p>删除编译产物（lib/dist/tsbuildinfo），回到未构建状态。<b>背后命令：</b>pnpm run clean。<b>注意：</b>不删源码，但清完后 dsh 无法运行，需重新构建。用于"三板斧"排障：清理 → 安装 → 构建。</p>
<h4>[启动/停止]（运行页）</h4>
<p><b>启动：</b>自动检查 Node 版本（需 ^22.19 或 ≥24）与构建产物，用空闲端口启动 dsh web（背后：node apps\\cli\\lib\\bin.js web --port 0）。<b>打开桌面窗口：</b>在应用内嵌窗口使用 dsh 界面。<b>在浏览器打开：</b>用系统默认浏览器打开。<b>停止：</b>结束 dsh 服务（含子进程树）。</p>
<h3>5. 常见操作流程</h3>
<h4>首次使用</h4>
<p><span class="kbd">设置确认路径</span> → <span class="kbd">安装依赖</span> → <span class="kbd">一键构建</span> → <span class="kbd">启动</span> → <span class="kbd">打开桌面窗口</span></p>
<h4>日常更新源码</h4>
<p><span class="kbd">更新</span>（查看落后几个提交）→ 落后则 <span class="kbd">拉取</span> → <span class="kbd">一键构建</span> → 重新 <span class="kbd">启动</span></p>
<h4>改坏了想回到官方</h4>
<p><span class="kbd">与官方保持一致</span> → 确认 → 自动备份并重置 → 重新构建</p>
<h3>6. 概念解释</h3>
<h4>领先 / 落后</h4>
<p>本地分支相对远程分支相差的提交数。<b>落后 N</b> = 官方有新提交没下载（该拉取了）；<b>领先 N</b> = 你有本地提交没推送。</p>
<h4>ff-only（只允许快进）</h4>
<p>拉取时只允许"本地无新提交 → 指针直接前移"的快进合并。有冲突可能时直接拒绝执行，保证不会意外合并、不会损坏仓库。</p>
<h4>detached HEAD</h4>
<p>检出历史版本时不处于任何分支、直接指向某次提交的状态，适合"只看不改"；要修改请选"新建分支并检出"。</p>
<h3>7. 常见问题 FAQ</h3>
<h4>重复点「安装依赖」有事吗？</h4>
<p>没有。pnpm 会校验 lockfile 与 node_modules，无变化则几秒完成；有缺失会自动补装。</p>
<h4>拉取会冲突吗？</h4>
<p>不会。ff-only 策略下，本地有改动或提交时拉取会直接安全失败，不进入合并流程。</p>
<h4>构建失败了怎么办？</h4>
<p>看底部日志面板的红色行定位错误；常用三板斧：清理 → 安装依赖 → 一键构建；还不行就把日志复制出来排查。</p>
<h4>「与官方保持一致」后能找回我的改动吗？</h4>
<p>能。执行前会自动创建 backup/&lt;时间戳&gt; 分支，在终端执行 <span class="kbd">git checkout backup/&lt;时间戳&gt;</span> 即可找回。</p>
<h4>为什么启动前提示"未构建"？</h4>
<p>需要先在「构建」页执行「一键构建」，生成 apps\\cli\\lib 与 apps\\web\\dist 后才可运行。</p>
<h3>8. 关于</h3>
<p>版本：0.1.0　|　数据目录（DSH_HOME）：见「设置」页　|　管理器日志：见底部日志面板（可复制）。</p>
<p>本项目仅管理仓库与启动 dsh，dsh 本身的会话、API Key、插件均沿用你现有的 DSH_HOME 数据目录。</p>
`
}
$('helpBody').innerHTML = helpHtml()
// 使用说明搜索：按 h3/h4 段落过滤
$('helpSearch').addEventListener('input', (e) => {
  const q = e.target.value.trim().toLowerCase()
  const body = $('helpBody')
  Array.from(body.children).forEach((el) => {
    const text = el.textContent.toLowerCase()
    if (!q) { el.style.display = ''; return }
    if (el.tagName === 'H3' || el.tagName === 'H4') {
      el.style.display = text.includes(q) ? '' : 'none'
    } else {
      // 块级内容：若属于某被隐藏标题之后且不匹配，隐藏；简单策略：匹配才显示
      el.style.display = text.includes(q) ? '' : 'none'
    }
  })
})

/* ================= 初始化 ================= */
async function init() {
  setStatus('正在加载…', 'busy')
  const s = await dshManager.getSettings()
  state.settings = s || {}
  $('setRepoPath').value = s.repoPath || ''
  $('setNodePath').value = s.nodePath || ''
  $('setDshHome').value = s.dshHome || ''
  $('setWorkspacePath').value = s.workspacePath || ''
  await refreshAll()
  setStatus('就绪')
  // 启动后静默检查一次更新（失败不打扰）
  dshManager.checkUpdate().then((res) => {
    if (res.ok && res.data.hasUpdate) {
      banner('success', '发现新版本 v' + res.data.latest, '当前 v' + res.data.current + '，可在概览页「检查更新」查看')
    }
  }).catch(() => { /* 静默 */ })
}
init()
