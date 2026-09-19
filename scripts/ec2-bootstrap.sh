#!/usr/bin/env bash
# One-time EC2 setup for GirjaSoft SMS ERP auto-deploy.
# Run on the server as ec2-user (Amazon Linux):
#   curl -fsSL <raw-url> | bash
# or copy this file to the server and run it.
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/girjasoft-sms-erp}"

echo "==> Checking Node.js..."
if ! command -v node >/dev/null 2>&1; then
  echo "Install Node.js 20 first (nvm or nodesource for your AMI)." >&2
  exit 1
fi

echo "==> Installing PM2..."
if ! command -v pm2 >/dev/null 2>&1; then
  sudo npm install -g pm2
  pm2 startup systemd -u "$USER" --hp "$HOME" | tail -1 | bash || true
fi

echo "==> Creating app directory..."
mkdir -p "$APP_DIR/public/uploads"

if [[ ! -f "$APP_DIR/.env.local" ]]; then
  echo "==> Creating .env.local template..."
  cat > "$APP_DIR/.env.local" <<'EOF'
MONGODB_URI=mongodb://127.0.0.1:27017/girjasoft_sms_erp
JWT_SECRET=replace-with-a-long-random-secret-at-least-32-chars
NEXT_PUBLIC_APP_NAME=GirjaSoft SMS ERP
NEXT_PUBLIC_COMPANY_NAME=GirjaSoft LLP
NEXT_PUBLIC_APP_URL=http://YOUR_PUBLIC_IP_OR_DOMAIN
SUPER_ADMIN_EMAIL=admin@girjasoft.com
SUPER_ADMIN_PASSWORD=set-a-strong-password-here
EOF
  echo "Edit $APP_DIR/.env.local before the first deploy."
fi

if pm2 describe gs-sms-erp >/dev/null 2>&1; then
  echo "==> PM2 app gs-sms-erp already registered."
else
  echo "==> Register PM2 app gs-sms-erp..."
  cd "$APP_DIR"
  pm2 start ecosystem.config.cjs
  pm2 save
fi

echo
echo "Bootstrap complete."
echo "Next steps:"
echo "  1. Edit $APP_DIR/.env.local with production values"
echo "  2. Ensure MongoDB is reachable from this server"
echo "  3. Add GitHub repository secrets: EC2_HOST, EC2_USER, EC2_SSH_KEY"
echo "  4. Push to main branch to trigger the first auto-deploy"
