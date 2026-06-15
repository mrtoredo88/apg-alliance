#!/bin/bash
# ship.sh — build, commit, push to GitHub, deploy to Vercel
# Usage: ./ship.sh "описание изменений"

set -e

MSG="${1:-chore: update}"

echo "📦 Building..."
npm run build

echo "📝 Committing..."
git add src/ dist/index.html public/ 2>/dev/null || true
git diff --cached --quiet && echo "Nothing to commit, skipping." || \
  git commit -m "$MSG

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"

echo "⬆️  Pushing to GitHub..."
git push origin main

echo "🚀 Deploying to Vercel..."
npx vercel --prod

echo "✅ Done!"
