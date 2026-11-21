#!/bin/bash
# Setup del Cerebro en Toshiba (Linux/WSL)
# Si usas Windows nativo, ejecuta desde Git Bash o WSL
set -e

REPO="https://github.com/akera2010/akera2010.git"
BRANCH="ccr-302eb251-8ontw0"
CLAUDE_DIR="$HOME/.claude"

echo "🧠 Instalando Cerebro en Toshiba..."

# 1. Git
command -v git >/dev/null 2>&1 || { echo "⚠️  Instala git: sudo apt install git  (Linux) o desde https://git-scm.com (Windows)"; exit 1; }

# 2. Node.js
if ! command -v node >/dev/null 2>&1; then
  echo "📦 Instalando Node.js via nvm..."
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
  nvm install --lts
fi

# 3. Claude Code
echo "🤖 Instalando Claude Code..."
npm install -g @anthropic-ai/claude-code

# 4. Clonar/actualizar cerebro
if [ -d "$CLAUDE_DIR/.git" ]; then
  echo "🔄 Actualizando ~/.claude..."
  cd "$CLAUDE_DIR" && git pull origin "$BRANCH"
else
  echo "📥 Clonando cerebro a ~/.claude..."
  [ -d "$CLAUDE_DIR" ] && mv "$CLAUDE_DIR" "${CLAUDE_DIR}.backup.$(date +%s)"
  git clone -b "$BRANCH" "$REPO" "$CLAUDE_DIR"
fi

chmod +x "$CLAUDE_DIR/hooks/"*.sh

echo ""
echo "✅ ¡Cerebro instalado en Toshiba!"
echo ""
echo "📋 Próximos pasos:"
echo "  1. Instala Obsidian: https://obsidian.md"
echo "  2. Abre como vault: $CLAUDE_DIR/obsidian"
echo "  3. Instala plugin 'Obsidian Git' en Obsidian"
echo "  4. Ejecuta: claude"
