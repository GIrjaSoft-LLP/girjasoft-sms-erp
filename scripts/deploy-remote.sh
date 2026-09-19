#!/usr/bin/env bash
# Runs on EC2 — same steps as manual deploy:
#   npm i → npm run build → pm2 restart gs-sms-erp
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/girjasoft-sms-erp}"
PM2_NAME="${PM2_NAME:-gs-sms-erp}"
NODE_BUILD_MEMORY="${NODE_BUILD_MEMORY:-768}"

cd "$APP_DIR"

echo "==> Installing dependencies..."
npm ci

echo "==> Building (NODE_OPTIONS=--max-old-space-size=${NODE_BUILD_MEMORY})..."
export NODE_OPTIONS="--max-old-space-size=${NODE_BUILD_MEMORY}"
npm run build

echo "==> Restarting PM2 process: ${PM2_NAME}..."
if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
  pm2 restart "$PM2_NAME"
else
  pm2 start ecosystem.config.cjs
fi

pm2 save 2>/dev/null || true

echo "Deploy complete."
