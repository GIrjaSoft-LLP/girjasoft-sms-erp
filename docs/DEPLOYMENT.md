# Deploying GirjaSoft SMS ERP on AWS EC2

Auto-deploy runs on every push to `main` via GitHub Actions.

## What happens on each push

GitHub Actions automates the same steps you run manually on EC2:

```bash
cd ~/girjasoft-sms-erp
npm ci                                    # was: npm i
NODE_OPTIONS="--max-old-space-size=768" npm run build
pm2 restart gs-sms-erp
```

The workflow syncs the latest `main` code to the server first (via rsync), then runs `scripts/deploy-remote.sh` over SSH.

```text
Push to main → security tests → rsync code to EC2 → npm ci → build → pm2 restart gs-sms-erp
```

## One-time setup

### 1. GitHub secrets

**GitHub → Settings → Secrets and variables → Actions → New repository secret**

| Secret | Value |
|--------|-------|
| `EC2_HOST` | `35.154.77.254` |
| `EC2_USER` | `ec2-user` |
| `EC2_SSH_KEY` | Full contents of your `.pem` private key |

### 2. EC2 security group

| Port | Purpose |
|------|---------|
| 22 | SSH (GitHub Actions deploys here) |
| 80 | HTTP (nginx or direct access) |

### 3. Server layout

Your existing setup is already correct:

```text
/home/ec2-user/girjasoft-sms-erp/   ← app code
/home/ec2-user/girjasoft-sms-erp/.env.local   ← production secrets (never overwritten by deploy)
/home/ec2-user/girjasoft-sms-erp/public/uploads/   ← user uploads (preserved across deploys)
```

PM2 process name: **`gs-sms-erp`**

If PM2 is not set up yet:

```bash
cd ~/girjasoft-sms-erp
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup    # follow the printed command so PM2 survives reboots
```

### 4. Environment file

Ensure `~/girjasoft-sms-erp/.env.local` exists on the server with production values. Deploy never touches this file.

## Manual deploy

Same as before — SSH in and run:

```bash
cd ~/girjasoft-sms-erp
npm i
NODE_OPTIONS="--max-old-space-size=768" npm run build
pm2 restart gs-sms-erp
```

Or after the auto-deploy scripts are on the server:

```bash
bash ~/girjasoft-sms-erp/scripts/deploy-remote.sh
```

## Useful commands

```bash
pm2 status
pm2 logs gs-sms-erp
pm2 restart gs-sms-erp
```

## First auto-deploy

1. Add the three GitHub secrets above
2. Commit and push the workflow files to `main`
3. Watch **Actions** tab on GitHub — deploy takes ~5–10 min (build runs on t2.micro)
