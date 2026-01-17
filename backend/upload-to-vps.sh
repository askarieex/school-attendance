#!/bin/bash

echo "📦 Copying Excel files and script to VPS..."

# Copy Excel files
scp -r "../Excel Data" root@165.22.214.208:/var/www/school-attendance/

# Copy upload script
scp upload-students-to-production.js root@165.22.214.208:/var/www/school-attendance/backend/

echo "✅ Files copied to VPS"
echo ""
echo "Now run these commands on VPS:"
echo ""
echo "ssh root@165.22.214.208"
echo "cd /var/www/school-attendance/backend"
echo "node upload-students-to-production.js"
