#!/bin/bash

echo "🚀 Pushing School Attendance System to GitHub..."
echo ""
echo "Repository: https://github.com/askarieex/school-attendance"
echo "Branch: main"
echo ""

# Push to GitHub
git push -u origin main

# Check if successful
if [ $? -eq 0 ]; then
  echo ""
  echo "✅ SUCCESS! Code pushed to GitHub"
  echo ""
  echo "📍 View at: https://github.com/askarieex/school-attendance"
  echo ""
else
  echo ""
  echo "❌ Push failed. Please check:"
  echo "  1. Internet connection"
  echo "  2. GitHub credentials"
  echo "  3. Repository exists: https://github.com/askarieex/school-attendance"
  echo ""
  echo "Try running: git push origin main"
  echo ""
fi
