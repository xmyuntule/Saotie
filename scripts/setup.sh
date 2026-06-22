#!/usr/bin/env bash
# HahaSNS 一键安装：构建前端 + 安装后端依赖（宝塔/任意 Linux 通用）。
# 用法：在项目根目录执行  bash scripts/setup.sh
# 完成后用「宝塔 Node 项目」或 PM2 启动 server/src/index.js 即可（详见 docs/INSTALL-bt.md）。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# 大陆加速：export NPM_REGISTRY=https://registry.npmmirror.com 后再跑本脚本即可
REG="${NPM_REGISTRY:-}"
NPMFLAGS=(--no-audit --no-fund)
[ -n "$REG" ] && { NPMFLAGS+=(--registry "$REG"); echo "▶ 使用 npm 镜像：$REG"; }

echo "▶ [1/2] 构建前端 (client)…"
( cd client && npm install "${NPMFLAGS[@]}" && npm run build )

echo "▶ [2/2] 安装后端依赖 (server)…"
( cd server && npm install --omit=dev "${NPMFLAGS[@]}" )

echo ""
echo "✓ 安装完成。"
echo "  前端产物：client/dist   后端入口：server/src/index.js（单进程同时伺服 SPA + /api + /uploads）"
echo "  下一步：在宝塔「Node 项目」里添加 server 目录、启动 node src/index.js、设置环境变量(JWT_SECRET 等)、绑定域名。"
echo "  （可选）填充演示数据：cd server && npm run seed   —— 会清空并重置演示内容，已有真实数据请勿执行。"
