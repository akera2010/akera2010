#!/bin/bash
# Sincronización manual del cerebro — pull + commit + push

cd "$HOME/.claude"

echo "🔄 Sincronizando cerebro..."
git pull origin HEAD --quiet 2>&1

if ! git diff --quiet || ! git diff --cached --quiet || [ -n "$(git ls-files --others --exclude-standard)" ]; then
  git add -A
  git commit -m "🔄 sync $(date +%Y-%m-%d\ %H:%M) desde $(hostname)"
  git push origin HEAD
  echo "✅ Sincronizado"
else
  echo "✅ Sin cambios pendientes"
fi
