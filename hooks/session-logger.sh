#!/bin/bash
# Hook Stop de Claude Code — crea nota de sesión en Obsidian y sincroniza

VAULT="$HOME/.claude/obsidian"
DATE=$(date +%Y-%m-%d)
TIME=$(date +%H:%M)
SESSIONS_DIR="$VAULT/02-Sesiones-Claude"

mkdir -p "$SESSIONS_DIR"

# Actividad reciente del repo
RECENT=$(cd "$HOME/.claude" && git log --oneline --since="3 hours ago" --pretty=format:"- %s" 2>/dev/null | head -20)
[ -z "$RECENT" ] && RECENT="_sin commits en esta sesión_"

SESSION_FILE="$SESSIONS_DIR/${DATE} ${TIME}.md"

cat > "$SESSION_FILE" << NOTA
---
fecha: $DATE
hora: $TIME
tipo: sesion-claude
tags: [sesion, claude-code, auto]
---
# Sesión Claude Code — $DATE $TIME

## Actividad
$RECENT

## Dispositivo
$(hostname 2>/dev/null || echo "desconocido")
NOTA

# Sincronizar al vault
cd "$HOME/.claude"
git add "obsidian/02-Sesiones-Claude/" 2>/dev/null || true
git diff --cached --quiet 2>/dev/null || git commit -m "🧠 sesion $DATE $TIME" 2>/dev/null || true
git push origin HEAD --quiet 2>/dev/null || true
