@echo off
REM ============================================================
REM  AIGC 视频发布平台 — 一键启动 (Windows)
REM ============================================================
chcp 65001 >nul 2>&1

echo.
echo ================================================
echo   AIGC 视频发布平台 - 一键启动
echo ================================================
echo.

REM --- 检查 Docker ---
where docker >nul 2>&1
if errorlevel 1 (
    echo [错误] 未检测到 Docker。
    echo   请先安装 Docker Desktop：
    echo   https://docs.docker.com/desktop/install/windows-install/
    pause
    exit /b 1
)

docker info >nul 2>&1
if errorlevel 1 (
    echo [提示] Docker 未运行，正在尝试启动 Docker Desktop...
    echo   等待 30 秒...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe" 2>nul
    timeout /t 30 /nobreak >nul
    docker info >nul 2>&1
    if errorlevel 1 (
        echo [错误] Docker 启动失败，请手动打开 Docker Desktop 后重试。
        pause
        exit /b 1
    )
)
echo [OK] Docker 已运行

REM --- 检查 .env 配置 ---
if not exist backend\.env (
    echo [提示] 未找到 backend\.env 配置文件，正在从模板创建...
    copy backend\.env.example backend\.env >nul
    echo.
    echo   请在打开的记事本中填写 API 密钥：
    echo     ANTHROPIC_API_KEY=你的 Anthropic 密钥
    echo     KIE_API_KEY=你的 kie.ai 密钥
    echo.
    echo   保存后重新运行此脚本。
    notepad backend\.env
    pause
    exit /b 0
)
echo [OK] 配置文件已就绪

REM --- 构建并启动 ---
echo.
echo 正在启动平台（首次构建约需 3-5 分钟）...
echo.
docker compose up --build -d

if errorlevel 1 (
    echo.
    echo [错误] 启动失败，请检查 Docker Desktop 是否正常运行。
    pause
    exit /b 1
)

echo.
echo ================================================
echo   平台启动成功！
echo ================================================
echo.
echo   浏览器打开: http://localhost:5173
echo.
echo   常用命令:
echo     查看日志:    docker compose logs -f
echo     停止:        docker compose down
echo     重新构建:    docker compose up --build -d
echo.
pause
