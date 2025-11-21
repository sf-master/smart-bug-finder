#!/bin/bash

# Initial setup script for DigitalOcean Droplet
# Run this once on a fresh Ubuntu 22.04 droplet

set -e

echo "🚀 Setting up DigitalOcean Droplet for Smart Bug Finder..."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "Please run as root or with sudo"
    exit 1
fi

# Update system (non-interactive to avoid prompts)
print_status "Updating system packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update && apt-get upgrade -y -o Dpkg::Options::="--force-confold"

# Install Docker
print_status "Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
else
    print_status "Docker already installed"
fi

# Install Docker Compose
print_status "Installing Docker Compose..."
apt-get install -y -o Dpkg::Options::="--force-confold" docker-compose-plugin

# Install Git
print_status "Installing Git..."
apt-get install -y -o Dpkg::Options::="--force-confold" git

# Install Nginx (for reverse proxy)
print_status "Installing Nginx..."
apt-get install -y -o Dpkg::Options::="--force-confold" nginx

# Install UFW (firewall)
print_status "Configuring firewall..."
apt-get install -y -o Dpkg::Options::="--force-confold" ufw
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Create app directory
print_status "Creating app directory..."
mkdir -p /opt/smart-bug-finder
mkdir -p /opt/backups

# Clone repository
print_status "Cloning repository..."
if [ ! -d "/opt/smart-bug-finder/.git" ]; then
    git clone -b main https://github.com/sf-master/smart-bug-finder.git /opt/smart-bug-finder
else
    print_status "Repository already exists, skipping clone"
fi

# Make deploy script executable
chmod +x /opt/smart-bug-finder/deploy.sh

# Create .env file template if it doesn't exist
if [ ! -f "/opt/smart-bug-finder/server/.env" ]; then
    print_status "Creating .env file template..."
    cat > /opt/smart-bug-finder/server/.env << EOF
PORT=5050
NODE_ENV=production
CLIENT_ORIGIN=https://smart-bug-finder.vercel.app
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=gemma:2b
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=openai/gpt-oss-20b
EOF
    echo ""
    echo "⚠️  Please edit /opt/smart-bug-finder/server/.env and add your API keys"
    echo ""
fi

print_status "Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit /opt/smart-bug-finder/server/.env with your API keys"
echo "2. Run: cd /opt/smart-bug-finder/server && docker compose build"
echo "3. Run: docker compose up -d"
echo "4. Check logs: docker compose logs -f"
echo ""
echo "For auto-deployment setup, see DEPLOYMENT.md"

