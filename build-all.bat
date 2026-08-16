@echo off
chcp 65001 >nul
title DeepSeek Harness Manager - 一键构建
cd /d "%~dp0"

echo ================================================
echo    DeepSeek Harness Manager 一键构建
echo    步骤: 1) 安装依赖  2) 生成图标  3) 打包 exe
echo    输出: release\DeepSeek Harness Manager *.exe
echo ================================================
echo.

rem 使用国内镜像，避免 electron 二进制下载卡在 GitHub
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
set ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/

echo [1/3] 安装依赖...
call npm install --no-audit --no-fund
if errorlevel 1 goto :err

echo [2/3] 生成图标...
call node scripts\gen-icon.mjs
if errorlevel 1 goto :err

echo [3/3] 打包 exe...
call npm run dist
if errorlevel 1 goto :err

echo.
echo ✅ 构建完成！exe 位于 release\ 目录
pause
exit /b 0

:err
echo.
echo ❌ 构建失败，请查看上方错误信息
pause
exit /b 1
