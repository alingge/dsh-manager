'use strict'
/**
 * 桥接层：把主进程的受限 API 暴露给渲染层。
 * 渲染层（index.html/renderer.js）通过 window.dshManager 调用，无法直接触碰 Node。
 */
const { contextBridge, ipcRenderer } = require('electron')

const api = {
  // 设置
  getSettings: () => ipcRenderer.invoke('mgr:getSettings'),
  saveSettings: (s) => ipcRenderer.invoke('mgr:saveSettings', s),
  chooseRepo: () => ipcRenderer.invoke('mgr:chooseRepo'),
  // 状态
  getStatus: () => ipcRenderer.invoke('mgr:getStatus'),
  getVersions: () => ipcRenderer.invoke('mgr:getVersions'),
  // Git
  gitFetch: () => ipcRenderer.invoke('mgr:fetch'),
  gitPull: () => ipcRenderer.invoke('mgr:pull'),
  checkout: (ref, branch) => ipcRenderer.invoke('mgr:checkout', ref, branch),
  syncToUpstream: () => ipcRenderer.invoke('mgr:syncToUpstream'),
  // 构建
  runInstall: () => ipcRenderer.invoke('mgr:runInstall'),
  runBuild: () => ipcRenderer.invoke('mgr:runBuild'),
  runClean: () => ipcRenderer.invoke('mgr:runClean'),
  cancel: () => ipcRenderer.invoke('mgr:cancel'),
  // 运行 dsh web
  startDsh: () => ipcRenderer.invoke('mgr:startDsh'),
  stopDsh: () => ipcRenderer.invoke('mgr:stopDsh'),
  openDshWindow: () => ipcRenderer.invoke('mgr:openDshWindow'),
  openDshBrowser: () => ipcRenderer.invoke('mgr:openDshBrowser'),
  // 打开目录
  openRepo: () => ipcRenderer.invoke('mgr:openRepo'),
  openDshHome: () => ipcRenderer.invoke('mgr:openDshHome'),
  // 事件订阅（日志逐行 / 结构化事件）
  onLog: (cb) => ipcRenderer.on('mgr:log', (_e, d) => cb(d)),
  onEvent: (cb) => ipcRenderer.on('mgr:event', (_e, d) => cb(d)),
}

contextBridge.exposeInMainWorld('dshManager', api)
