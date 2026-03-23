#!/bin/bash
# ============================================================
#  AIGC Video Platform — Quick Start (Mac / Linux)
# ============================================================
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo "================================================"
echo "  AIGC 电商视频发布平台 — 一键启动"
echo "================================================"
echo ""

# --- Check Docker ---
if ! command -v docker &>/dev/null; then
    echo -e "${RED}[ERROR] Docker 未安装。${NC}"
    echo "  请先安装 Docker Desktop："
    echo "  Mac:   https://docs.docker.com/desktop/install/mac-install/"
    echo "  Linux: https://docs.docker.com/desktop/install/linux/"
    exit 1
fi

if ! docker info &>/dev/null 2>&1; then
    echo -e "${YELLOW}[WARN] Docker 未运行，正在尝试启动...${NC}"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        open -a Docker
        echo "  等待 Docker Desktop 启动..."
        for i in $(seq 1 30); do
            if docker info &>/dev/null 2>&1; then break; fi
            sleep 2
        done
    fi
    if ! docker info &>/dev/null 2>&1; then
        echo -e "${RED}[ERROR] Docker 未能启动，请手动打开 Docker Desktop。${NC}"
        exit 1
    fi
fi
echo -e "${GREEN}[OK] Docker 已运行${NC}"

# --- Check .env ---
if [ ! -f backend/.env ]; then
    echo -e "${YELLOW}[INFO] 未找到 backend/.env，从模板创建...${NC}"
    cp backend/.env.example backend/.env
    echo -e "${YELLOW}  请编辑 backend/.env 填入你的 API 密钥：${NC}"
    echo "    ANTHROPIC_API_KEY=sk-ant-api03-你的密钥"
    echo "    KIE_API_KEY=你的kie密钥"
    echo ""
    echo "  编辑完成后重新运行此脚本。"

    # Open .env in default editor
    if [[ "$OSTYPE" == "darwin"* ]]; then
        open backend/.env
    elif command -v xdg-open &>/dev/null; then
        xdg-open backend/.env
    fi
    exit 0
fi

# Check if .env has placeholder keys
if grep -q "YOUR_KEY_HERE\|你的密钥\|YOUR_KIE_KEY" backend/.env; then
    echo -e "${YELLOW}[WARN] backend/.env 中仍有未填写的 API 密钥。${NC}"
    echo "  部分功能（AI 文案、视频生成）可能无法使用。"
    echo "  继续启动？(Y/n)"
    read -r answer
    if [[ "$answer" == "n" || "$answer" == "N" ]]; then
        echo "请编辑 backend/.env 后重新运行。"
        exit 0
    fi
fi
echo -e "${GREEN}[OK] 环境配置文件已就绪${NC}"

# --- Ensure AdsPower URL for Docker ---
if grep -q "ADSPOWER_BASE_URL=http://127.0.0.1" backend/.env; then
    echo -e "${YELLOW}[INFO] 检测到 ADSPOWER_BASE_URL 使用 127.0.0.1${NC}"
    echo "  Docker 环境会通过 docker-compose.yml 自动覆盖为 host.docker.internal"
fi

# --- Build and start ---
echo ""
echo "正在启动平台（首次需要 3-5 分钟下载依赖）..."
echo ""
docker compose up --build -d

echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}  平台启动成功！${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo "  浏览器访问: http://localhost:5173"
echo ""
echo "  常用命令："
echo "    查看日志:   docker compose logs -f"
echo "    停止平台:   docker compose down"
echo "    重新构建:   docker compose up --build -d"
echo ""
