#!/bin/bash

# VPS Complete Setup Script
# Run this ONCE on your VPS to set up everything

echo "========================================"
echo "🚀 School Attendance System - VPS Setup"
echo "========================================"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "❌ Please run as root (use: sudo bash vps-setup.sh)"
  exit 1
fi

# Install git if not installed
if ! command -v git &> /dev/null; then
  echo "📦 Installing git..."
  apt update
  apt install git -y
fi

# Go to web directory
cd /var/www

# Backup existing directory if exists
if [ -d "school-attendance-system" ]; then
  echo "📁 Backing up existing directory..."
  mv school-attendance-system school-attendance-system-backup-$(date +%Y%m%d-%H%M%S)
fi

# Clone repository
echo "📥 Cloning repository from GitHub..."
git clone https://github.com/askarieex/school-attendance.git school-attendance-system

if [ $? -ne 0 ]; then
  echo "❌ Failed to clone repository"
  exit 1
fi

cd school-attendance-system

# Setup Backend
echo ""
echo "🔧 Setting up Backend..."
cd backend

# Install dependencies
npm install --production

# Stop old PM2 process if exists
pm2 delete school-attendance-api 2>/dev/null || true

# Start backend with PM2 (2 instances for zero downtime)
pm2 start src/server.js --name school-attendance-api -i 2 --max-memory-restart 500M

# Save PM2 configuration
pm2 save
pm2 startup

# Setup School Dashboard
echo ""
echo "🏫 Setting up School Dashboard..."
cd ../school-dashboard

# Create production .env file
cat > .env << 'EOF'
REACT_APP_API_URL=https://adtenz.site/api/v1
PORT=3003
EOF

# Install and build
npm install
npm run build

# Create nginx directory and copy files
mkdir -p /var/www/html
rm -rf /var/www/html/*
cp -r build/* /var/www/html/

# Setup Super Admin Panel
echo ""
echo "👨‍💼 Setting up Super Admin Panel..."
cd ../super-admin-panel

# Create production .env file
cat > .env << 'EOF'
REACT_APP_API_URL=https://adtenz.site/api/v1
PORT=3002
EOF

# Install and build
npm install
npm run build

# Create nginx directory and copy files
mkdir -p /var/www/super-admin
rm -rf /var/www/super-admin/*
cp -r build/* /var/www/super-admin/

# Create deployment script
echo ""
echo "📝 Creating deployment script..."
cd /var/www/school-attendance-system

cat > deploy.sh << 'DEPLOYEOF'
#!/bin/bash
echo "🚀 Deploying updates..."
cd /var/www/school-attendance-system

# Pull latest code
git pull origin main || git pull origin master

# Backend
cd backend
npm install --production
pm2 restart school-attendance-api

# School Dashboard
cd ../school-dashboard
cat > .env << 'EOF'
REACT_APP_API_URL=https://adtenz.site/api/v1
PORT=3003
EOF
npm install
npm run build
rm -rf /var/www/html/*
cp -r build/* /var/www/html/

# Super Admin
cd ../super-admin-panel
cat > .env << 'EOF'
REACT_APP_API_URL=https://adtenz.site/api/v1
PORT=3002
EOF
npm install
npm run build
rm -rf /var/www/super-admin/*
cp -r build/* /var/www/super-admin/

echo "✅ Deployment complete!"
pm2 status
DEPLOYEOF

chmod +x deploy.sh

echo ""
echo "========================================"
echo "✅ Setup Complete!"
echo "========================================"
echo ""
echo "🌐 Your applications:"
echo "   📡 Backend:  https://adtenz.site/api/v1"
echo "   🏫 School:   https://adtenz.site"
echo "   👨‍💼 Admin:    https://adtenz.site:3002"
echo ""
echo "📝 To deploy updates in the future:"
echo "   /var/www/school-attendance-system/deploy.sh"
echo ""
echo "📊 Useful commands:"
echo "   pm2 status              - Check backend status"
echo "   pm2 logs                - View backend logs"
echo "   pm2 restart all         - Restart backend"
echo ""
