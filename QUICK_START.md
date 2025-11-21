# Quick Start Guide - DigitalOcean Droplet Deployment

## 🚀 One-Time Setup (Run on Fresh Droplet)

```bash
# 1. Connect to your droplet
ssh root@your-droplet-ip

# 2. Run the setup script
curl -fsSL https://raw.githubusercontent.com/sf-master/smart-bug-finder/main/setup-droplet.sh | bash

# OR download and run locally:
# wget https://raw.githubusercontent.com/sf-master/smart-bug-finder/main/setup-droplet.sh
# chmod +x setup-droplet.sh
# sudo ./setup-droplet.sh
```

## ⚙️ Configure Environment

```bash
# Edit environment file
nano /opt/smart-bug-finder/server/.env

# Add your API keys:
# GROQ_API_KEY=your_key_here
# GROQ_MODEL=openai/gpt-oss-20b
```

## 🐳 Deploy Application

```bash
cd /opt/smart-bug-finder/server

# Build and start
docker compose build
docker compose up -d

# Check status
docker compose ps
docker compose logs -f
```

## 🔄 Auto-Deployment Setup

### Option 1: GitHub Actions (Recommended)

1. **Add GitHub Secrets:**
   - Repository → Settings → Secrets → Actions
   - Add: `DROPLET_HOST`, `DROPLET_USER`, `DROPLET_SSH_KEY`

2. **Push to main branch** - Auto-deploys!

### Option 2: Manual Deploy Script

```bash
cd /opt/smart-bug-finder
sudo bash deploy.sh
```

## 📋 Common Commands

```bash
# View logs
cd /opt/smart-bug-finder/server
docker compose logs -f

# Restart service
docker compose restart

# Stop service
docker compose down

# Update and redeploy
cd /opt/smart-bug-finder
git pull
sudo bash deploy.sh

# Check health
curl http://localhost:8080/health
```

## 🌐 Access Your App

- **Local (on droplet):** `http://localhost:8080`
- **External:** `http://your-droplet-ip:8080`
- **With domain:** Set up Nginx reverse proxy (see DEPLOYMENT.md)

## ✅ Verify Deployment

```bash
# Check container is running
docker ps | grep smart-bug-finder

# Test API endpoint
curl http://localhost:8080/health

# Should return: {"status":"ok","uptime":...,"timestamp":...}
```

