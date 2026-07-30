@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0\.."
where node >nul 2>nul
if errorlevel 1 (
  echo 未检测到 Node.js。正在打开官方下载页，安装完成后请重新双击本文件。
  start "" "https://nodejs.org/zh-cn/download"
  pause
  exit /b 1
)

echo.
echo BabyLink 电脑助手
echo 1^) QQ / NapCat
echo 2^) 小红书非官方适配器
set /p PLATFORM_CHOICE=请选择 1 或 2：

if "%PLATFORM_CHOICE%"=="2" (
  set "BABYLINK_BRIDGE_PLATFORM=xiaohongshu"
  set /p XHS_ADAPTER_URL=请输入小红书适配器本机地址（默认 http://127.0.0.1:8790）：
  if not defined XHS_ADAPTER_URL set "XHS_ADAPTER_URL=http://127.0.0.1:8790"
) else (
  set "BABYLINK_BRIDGE_PLATFORM=qq"
  set /p QQ_ONEBOT_URL=请输入 OneBot 本机地址（默认 http://127.0.0.1:3000）：
  if not defined QQ_ONEBOT_URL set "QQ_ONEBOT_URL=http://127.0.0.1:3000"
)

:ASK_URL
set /p BABYLINK_BRIDGE_PUBLIC_URL=请输入你的 HTTPS 电脑助手地址（例如 https://bridge.example.com）：
echo %BABYLINK_BRIDGE_PUBLIC_URL% | findstr /b /c:"https://" >nul
if errorlevel 1 (
  echo 地址必须以 https:// 开头。
  goto ASK_URL
)

if exist "bridge\.babylink-bridge-token" (
  set /p BABYLINK_BRIDGE_TOKEN=<"bridge\.babylink-bridge-token"
) else (
  for /f %%i in ('powershell -NoProfile -Command "([guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N'))"') do set "BABYLINK_BRIDGE_TOKEN=%%i"
  >"bridge\.babylink-bridge-token" echo !BABYLINK_BRIDGE_TOKEN!
)
set "BABYLINK_BRIDGE_OPEN_DASHBOARD=1"
echo 正在启动电脑助手。请保持此窗口开启。
node bridge/babylink-bridge.mjs
pause
