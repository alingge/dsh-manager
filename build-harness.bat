@echo off
chcp 65001 >nul
title DeepSeek Harness 源码一键构建
cd /d "%~dp0"

rem 官方源码仓库路径（可按需修改）
set REPO=E:\deepseek-harness\deepseek-harness

if not exist "%REPO%\package.json" (
    echo ❌ 未找到源码仓库: %REPO%
    echo    请修改本文件顶部的 REPO 变量
    pause
    exit /b 1
)

cd /d "%REPO%"
echo ================================================
echo    DeepSeek Harness 源码一键构建
echo    仓库: %REPO%
echo    命令: pnpm run build  ^(lib + web^)
echo ================================================
echo.

call pnpm run build
if errorlevel 1 goto :err

echo.
echo ✅ 构建完成！现在可以启动 dsh web（管理器「运行」页）
pause
exit /b 0

:err
echo.
echo ❌ 构建失败，请查看上方错误信息
pause
exit /b 1
