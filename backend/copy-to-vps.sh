#!/bin/bash

echo "📦 Step 1: Copying Excel files to VPS..."
scp -r "../Excel Data" root@165.22.214.208:/var/www/school-attendance/

echo ""
echo "📦 Step 2: Copying upload script to VPS..."
scp upload-students-to-production.js root@165.22.214.208:/var/www/school-attendance/backend/

echo ""
echo "✅ All files copied successfully!"
echo ""
echo "========================================="
echo "Next steps - Run on VPS:"
echo "========================================="
echo "ssh root@165.22.214.208"
echo "cd /var/www/school-attendance/backend"
echo "node upload-students-to-production.js"
echo "========================================="
