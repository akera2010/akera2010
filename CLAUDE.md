# Cerebro Principal — Arantxa

## Identidad del sistema
Este repositorio es el cerebro central sincronizado entre:
- **Mac** (dispositivo principal) — Claude Code + Obsidian
- **Toshiba** (portátil) — Claude Code + Obsidian
- **iPhone** (captura móvil) — Obsidian Mobile

Vault Obsidian: `~/.claude/obsidian/`
Repo GitHub: `akera2010/akera2010`

## Al inicio de cada sesión (OBLIGATORIO)
1. `cd ~/.claude && git pull origin HEAD --quiet` — sincronizar últimos cambios
2. Revisar `~/.claude/obsidian/04-Inbox/` — notas pendientes del móvil o Toshiba
3. Revisar nota diaria en `~/.claude/obsidian/01-Diario/` para contexto del día

## Al terminar trabajo significativo
- Hacer `git add -A && git commit -m "descripción" && git push origin HEAD`
- Esto sincroniza automáticamente con todos los dispositivos

## Estructura del vault Obsidian
- `00-Index/` — mapa del cerebro, proyectos activos
- `01-Diario/` — notas diarias (YYYY-MM-DD.md)
- `02-Sesiones-Claude/` — logs automáticos de sesiones (NO EDITAR)
- `03-Proyectos/` — proyectos activos
- `04-Inbox/` — captura rápida desde móvil/Toshiba
- `Templates/` — plantillas de notas

## Preferencias
- Respuestas siempre en español
- Auto mode activo — ejecutar sin pedir confirmación en tareas normales
- Loops en automático
- Commits frecuentes para mantener sincronía entre dispositivos

## Proyectos activos
Ver `~/.claude/obsidian/03-Proyectos/` para lista actualizada.
