# 更新日志

本项目所有显著变更都记录在此文件中。
格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)。

## [0.1.1] - 2026-08-18

### 修复

- 修复 Git 页「历史版本」列表**版本列恒为空**的问题：`release(dsh): x.y.z` 提交信息解析错误（`src/main.js` `getVersions()`）
- 修复**重复弹横幅**：启动 dsh web 时「dsh web 已启动」出现两次；命令失败/取消时事件层与按钮层各弹一条。改为一次用户操作只出一条提示（`opFail()` 统一反馈，事件层不再弹横幅）
- 修复**日志面板中文乱码/无法显示**：子进程输出改为编码感知解码（严格 UTF-8 优先，自动回退 GBK），并给等宽字体栈补充中文字体回退
- 「与官方保持一致」现在会**先 fetch 远程最新提交**，确保对齐的是最新官方，而非上次抓取的快照

### 安全

- dsh web 窗口不再注入管理器 preload，避免 dsh 页面存在 XSS 时越权调用管理器 IPC（`cloneRepo` / `syncToUpstream` 等）
- `setWindowOpenHandler` 由前缀匹配改为**精确 hostname 匹配**，堵住 `http://127.0.0.1.evil.com` 之类前缀伪造绕过

### 其他

- 子进程 `cmd-end` 事件保证只推送一次（spawn `error` 与 `close` 先后触发的边界情况）

## [0.1.0] - 2026-08-16

### 新增

- 首个 Windows 桌面管理器版本：概览 / Git / 构建 / 运行 / 设置 / 使用说明 六个页签
- Git 版本查看与切换（release 锚点）、更新（fetch）、拉取（`pull --ff-only` 防冲突）、分支切换
- 一键克隆官方源码；「与官方保持一致」自动创建备份分支后可回滚
- 安装依赖 / 一键构建 / 清理，日志实时滚动，任何结果有横幅提示
- 启动 / 停止 dsh web，内嵌窗口或浏览器打开，自动分配空闲端口
- 检查更新（GitHub Release API）、仓库路径自动探测
- CI 自动打包（portable + installer）并发布 Release；随仓库发布成品 exe
