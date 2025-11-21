#!/bin/bash

# Auto-deployment script for DigitalOcean Droplet
# This script should be run on the droplet and can be triggered via GitHub Actions or webhook

set -e

echo "🚀 Starting deployment..."

# Configuration
APP_DIR="/opt/smart-bug-finder"
REPO_URL="https://github.com/sf-master/smart-bug-finder.git"
BRANCH="main"
SERVICE_NAME="smart-bug-finder-server"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then 
    print_error "Please run as root or with sudo"
    exit 1
fi

# Create app directory if it doesn't exist
if [ ! -d "$APP_DIR" ]; then
    print_status "Creating app directory: $APP_DIR"
    mkdir -p $APP_DIR
fi

cd $APP_DIR

# Backup current deployment
if [ -d "$APP_DIR/server" ]; then
    print_status "Backing up current deployment..."
    BACKUP_DIR="/opt/backups/smart-bug-finder-$(date +%Y%m%d-%H%M%S)"
    mkdir -p /opt/backups
    cp -r $APP_DIR/server $BACKUP_DIR 2>/dev/null || true
fi

# Clone or update repository
if [ -d "$APP_DIR/.git" ]; then
    print_status "Updating repository..."
    cd $APP_DIR
    git fetch origin
    git reset --hard origin/$BRANCH
    git clean -fd
else
    print_status "Cloning repository..."
    git clone -b $BRANCH $REPO_URL $APP_DIR
    cd $APP_DIR
fi

# Navigate to server directory
cd $APP_DIR/server

# Copy environment file if it exists
if [ -f "$APP_DIR/server/.env.production" ]; then
    print_status "Using production environment file..."
    cp $APP_DIR/server/.env.production $APP_DIR/server/.env
elif [ ! -f "$APP_DIR/server/.env" ]; then
    print_warning "No .env file found. Please create one."
fi

# Build and deploy with Docker Compose
print_status "Building Docker image..."
docker-compose build --no-cache

print_status "Stopping existing container..."
docker-compose down || true

print_status "Starting new container..."
docker-compose up -d

# Wait for health check
print_status "Waiting for service to be healthy..."
sleep 10

# Check if container is running
if docker ps | grep -q $SERVICE_NAME; then
    print_status "Container is running!"
    
    # Check health endpoint
    if curl -f http://localhost:8080/health > /dev/null 2>&1; then
        print_status "Health check passed!"
        echo ""
        echo "✅ Deployment successful!"
        echo "🌐 Service is available at: http://localhost:8080"
    else
        print_warning "Health check failed, but container is running. Check logs with: docker-compose logs"
    fi
else
    print_error "Container failed to start. Check logs with: docker-compose logs"
    exit 1
fi

# Clean up old Docker images (optional)
print_status "Cleaning up old Docker images..."
docker image prune -f > /dev/null 2>&1 || true

echo ""
print_status "Deployment complete!"

