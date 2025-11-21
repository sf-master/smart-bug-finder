# Deployment Guide for DigitalOcean Droplet

This guide will help you deploy the Smart Bug Finder server to a DigitalOcean Droplet with auto-deployment.

## Prerequisites

- A DigitalOcean Droplet running Ubuntu 22.04
- SSH access to the droplet
- Docker and Docker Compose installed on the droplet
- GitHub repository access

## Step 1: Initial Droplet Setup

### 1.1 Connect to your Droplet

```bash
ssh root@your-droplet-ip
```

### 1.2 Install Docker and Docker Compose

```bash
# Update system
apt-get update && apt-get upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
apt-get install -y docker-compose-plugin

# Verify installation
docker --version
docker compose version
```

### 1.3 Create App Directory

```bash
mkdir -p /opt/smart-bug-finder
cd /opt/smart-bug-finder
```

### 1.4 Clone Repository

```bash
git clone -b main https://github.com/sf-master/smart-bug-finder.git /opt/smart-bug-finder
cd /opt/smart-bug-finder/server
```

### 1.5 Create Environment File

```bash
nano /opt/smart-bug-finder/server/.env
```

Add your environment variables:

```env
PORT=5050
NODE_ENV=production
CLIENT_ORIGIN=https://smart-bug-finder.vercel.app
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=gemma:2b
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=openai/gpt-oss-20b
```

### 1.6 Make Deploy Script Executable

```bash
chmod +x /opt/smart-bug-finder/deploy.sh
```

## Step 2: Initial Deployment

### 2.1 Build and Start Container

```bash
cd /opt/smart-bug-finder/server
docker compose build
docker compose up -d
```

### 2.2 Verify Deployment

```bash
# Check container status
docker compose ps

# Check logs
docker compose logs -f

# Test health endpoint
curl http://localhost:8080/health
```

## Step 3: Set Up Auto-Deployment

### Option A: GitHub Actions (Recommended)

1. **Add GitHub Secrets:**
   - Go to your GitHub repository → Settings → Secrets and variables → Actions
   - Add the following secrets:
     - `DROPLET_HOST`: Your droplet IP address
     - `DROPLET_USER`: `root` (or your sudo user)
     - `DROPLET_SSH_KEY`: Your private SSH key content

2. **Generate SSH Key (if needed):**
   ```bash
   # On your local machine
   ssh-keygen -t ed25519 -C "github-actions"
   
   # Copy public key to droplet
   ssh-copy-id root@your-droplet-ip
   
   # Copy private key content to GitHub secret DROPLET_SSH_KEY
   cat ~/.ssh/id_ed25519
   ```

3. **Push to main branch:**
   - The workflow will automatically trigger on push to `main`
   - Or manually trigger from Actions tab → "Deploy to DigitalOcean Droplet" → Run workflow

### Option B: Webhook Deployment

1. **Install webhook server on droplet:**
   ```bash
   apt-get install -y webhook
   ```

2. **Create webhook configuration:**
   ```bash
   mkdir -p /opt/webhooks
   nano /opt/webhooks/deploy.json
   ```

   Add:
   ```json
   [
     {
       "id": "smart-bug-finder-deploy",
       "execute-command": "/opt/smart-bug-finder/deploy.sh",
       "command-working-directory": "/opt/smart-bug-finder"
     }
   ]
   ```

3. **Start webhook server:**
   ```bash
   webhook -hooks /opt/webhooks/deploy.json -verbose
   ```

4. **Add webhook URL to GitHub:**
   - Repository → Settings → Webhooks → Add webhook
   - Payload URL: `http://your-droplet-ip:9000/hooks/smart-bug-finder-deploy`
   - Content type: `application/json`
   - Events: `Just the push event`

### Option C: Cron Job (Simple but less secure)

```bash
# Edit crontab
crontab -e

# Add this line to check for updates every 5 minutes
*/5 * * * * cd /opt/smart-bug-finder && git fetch && [ $(git rev-parse HEAD) != $(git rev-parse origin/main) ] && sudo bash deploy.sh
```

## Step 4: Configure Firewall

```bash
# Allow SSH
ufw allow 22/tcp

# Allow HTTP/HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Allow your app port (if not using reverse proxy)
ufw allow 8080/tcp

# Enable firewall
ufw enable
```

## Step 5: Set Up Reverse Proxy (Optional but Recommended)

### Using Nginx

1. **Install Nginx:**
   ```bash
   apt-get install -y nginx
   ```

2. **Create Nginx config:**
   ```bash
   nano /etc/nginx/sites-available/smart-bug-finder
   ```

   Add:
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;

       location / {
           proxy_pass http://localhost:8080;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

3. **Enable site:**
   ```bash
   ln -s /etc/nginx/sites-available/smart-bug-finder /etc/nginx/sites-enabled/
   nginx -t
   systemctl reload nginx
   ```

4. **Set up SSL with Let's Encrypt:**
   ```bash
   apt-get install -y certbot python3-certbot-nginx
   certbot --nginx -d your-domain.com
   ```

## Step 6: Monitoring and Maintenance

### View Logs
```bash
cd /opt/smart-bug-finder/server
docker compose logs -f
```

### Restart Service
```bash
cd /opt/smart-bug-finder/server
docker compose restart
```

### Update Application
```bash
cd /opt/smart-bug-finder
sudo bash deploy.sh
```

### Check Container Status
```bash
docker compose ps
docker stats
```

## Troubleshooting

### Container won't start
```bash
# Check logs
docker compose logs

# Check if port is in use
netstat -tulpn | grep 8080

# Rebuild container
docker compose down
docker compose build --no-cache
docker compose up -d
```

### Playwright browser issues
```bash
# Check if browsers are installed in container
docker compose exec smart-bug-finder-server npx playwright install chromium

# Check system dependencies
docker compose exec smart-bug-finder-server apt list --installed | grep -i nss
```

### Permission issues
```bash
# Ensure deploy script is executable
chmod +x /opt/smart-bug-finder/deploy.sh

# Check Docker permissions
docker ps
```

## Security Notes

1. **Never commit `.env` file** - Keep it on the server only
2. **Use strong passwords** for droplet access
3. **Set up fail2ban** to prevent brute force attacks
4. **Keep system updated**: `apt-get update && apt-get upgrade -y`
5. **Use SSH keys** instead of passwords
6. **Configure firewall** properly
7. **Use HTTPS** with Let's Encrypt

## Backup Strategy

The deploy script automatically creates backups in `/opt/backups/`. To manually backup:

```bash
# Backup current deployment
tar -czf /opt/backups/smart-bug-finder-$(date +%Y%m%d).tar.gz /opt/smart-bug-finder/server

# Restore from backup
tar -xzf /opt/backups/smart-bug-finder-YYYYMMDD.tar.gz -C /
```

