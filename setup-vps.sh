#!/bin/bash
# =================================================================
# KasirMu Automated VPS Setup Script for Ubuntu 24.04 LTS
# Stack: Node.js LTS, PM2, Nginx, PostgreSQL, UFW
# =================================================================

set -e

echo "🚀 Starting KasirMu VPS Setup..."

# 1. Update System
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# 2. Configure UFW Firewall
echo "🛡️ Configuring Firewall (UFW)..."
sudo apt install -y ufw
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

# 3. Install Essential Utilities
echo "🛠️ Installing Git & Curl..."
sudo apt install -y git curl build-essential

# 4. Install Node.js LTS (v20)
echo "🟢 Installing Node.js LTS..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 5. Install PM2 Globally
echo "⚙️ Installing PM2..."
sudo npm install -g pm2

# 6. Install Nginx
echo "🌐 Installing Nginx..."
sudo apt install -y nginx

# 7. Install & Setup PostgreSQL
echo "🐘 Installing PostgreSQL..."
sudo apt install -y postgresql postgresql-contrib

# Start PostgreSQL service
sudo systemctl enable postgresql
sudo systemctl start postgresql

echo "✅ Basic VPS Stack (Node.js, PM2, Nginx, PostgreSQL, UFW) successfully installed!"
echo ""
echo "-----------------------------------------------------------------"
echo "NEXT STEPS TO COMPLETE DEPLOYMENT:"
echo "-----------------------------------------------------------------"
echo "1. Setup PostgreSQL Database & User:"
echo "   sudo -u postgres psql"
echo "   CREATE DATABASE kasirmu;"
echo "   CREATE USER kasirmu_user WITH PASSWORD 'password_super_aman_anda';"
echo "   GRANT ALL PRIVILEGES ON DATABASE kasirmu TO kasirmu_user;"
echo "   \q"
echo ""
echo "2. Clone your repository into /var/www/kasirmu:"
echo "   sudo mkdir -p /var/www"
echo "   sudo chown -R \$USER:\$USER /var/www"
echo "   git clone <YOUR_GITHUB_REPO_URL> /var/www/kasirmu"
echo ""
echo "3. Configure Environment Variables (.env) in Backend & Frontend"
echo "4. Build & Start with PM2:"
echo "   cd /var/www/kasirmu"
echo "   cd backend && npm install && npx prisma generate && npx prisma migrate deploy && npm run build && cd .."
echo "   cd frontend && npm install && npm run build && cd .."
echo "   pm2 start ecosystem.config.js"
echo "   pm2 save && pm2 startup"
echo "-----------------------------------------------------------------"
