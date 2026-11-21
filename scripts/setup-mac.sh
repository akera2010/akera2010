#!/bin/bash
# Setup del Cerebro Principal en Mac
# Ejecutar: bash setup-mac.sh
set -e

REPO="https://github.com/akera2010/akera2010.git"
BRANCH="ccr-302eb251-8ontw0"
CLAUDE_DIR="$HOME/.claude"

echo "🧠 Instalando Cerebro Principal en Mac..."

# 1. Instalar dependencias
echo "📦 Verificando dependencias..."
command -v node >/dev/null 2>&1 || { echo "⚠️  Instala Node.js desde https://nodejs.org"; exit 1; }
command -v git >/dev/null 2>&1 || { echo "⚠️  Instala Xcode Command Line Tools: xcode-select --install"; exit 1; }

# 2. Claude Code
echo "🤖 Instalando Claude Code..."
npm install -g @anthropic-ai/claude-code

# 3. Clonar cerebro a ~/.claude
if [ -d "$CLAUDE_DIR/.git" ]; then
  echo "🔄 ~/.claude ya existe — actualizando..."
  cd "$CLAUDE_DIR" && git pull origin "$BRANCH"
else
  echo "📥 Clonando cerebro a ~/.claude..."
  # Hacer backup si existe
  [ -d "$CLAUDE_DIR" ] && mv "$CLAUDE_DIR" "${CLAUDE_DIR}.backup.$(date +%s)"
  git clone -b "$BRANCH" "$REPO" "$CLAUDE_DIR"
fi

# 4. Permisos de hooks
chmod +x "$CLAUDE_DIR/hooks/"*.sh

echo ""
echo "✅ ¡Cerebro instalado!"
echo ""
echo "📋 Próximos pasos:"
echo "  1. Instala Obsidian: https://obsidian.md"
echo "  2. Abre Obsidian → Abrir carpeta como vault → $CLAUDE_DIR/obsidian"
echo "  3. En Obsidian: Settings → Community plugins → Browse → instala 'Obsidian Git'"
echo "  4. Ejecuta: claude  (para iniciar Claude Code)"
echo ""
echo "📱 Para el móvil: sigue scripts/setup-mobile.md"
