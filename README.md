# 🧠 Cerebro Principal

Sistema de conocimiento y trabajo sincronizado entre Mac, Toshiba e iPhone.

## Arquitectura

```
GitHub (akera2010/akera2010)
         │
    ┌────┼────┐
    │    │    │
   Mac Toshiba iPhone
  (~/.claude) (~/.claude) (Working Copy)
         │
    Obsidian Vault
```

## Estructura

| Carpeta | Descripción |
|---------|-------------|
| `settings.json` | Config global Claude Code + hooks |
| `CLAUDE.md` | Memoria persistente de Claude |
| `hooks/` | Scripts automáticos |
| `obsidian/` | Vault Obsidian (notas, diario, proyectos) |
| `scripts/` | Setup por dispositivo |

## Setup rápido

**Mac:**
```bash
bash <(curl -fsSL https://raw.githubusercontent.com/akera2010/akera2010/ccr-302eb251-8ontw0/scripts/setup-mac.sh)
```

**Toshiba:**
```bash
bash <(curl -fsSL https://raw.githubusercontent.com/akera2010/akera2010/ccr-302eb251-8ontw0/scripts/setup-toshiba.sh)
```

**iPhone:** Ver `scripts/setup-mobile.md`

## Sincronización manual

```bash
bash ~/.claude/hooks/sync.sh
```

## Flujo automático
1. Claude Code al **terminar sesión** → crea nota en `obsidian/02-Sesiones-Claude/`
2. Claude Code al **iniciar** → `git pull` automático
3. Obsidian Git → push/pull cada 10 minutos
