#!/bin/bash
set -x

echo "清除缓存..."
rm -rf dist .wails node_modules/.vite

echo "构建前端..."
npm run build 2>&1 | tail -5

echo "列出生成的文件..."
ls -lh dist/index.html

echo "检查 Go 代码..."
go build -v 2>&1 | wc -l

echo "启动 Wails..."
timeout 10 wails dev 2>&1 || true
