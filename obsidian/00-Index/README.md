# Cerebro Principal — Arantxa

## Proyectos Activos
- [[03-Proyectos/FútbolIQ]] — v5.0, picks diarios fútbol, trigger 06:00 Madrid
- [[03-Proyectos/BeisbolIQ]] — v1.0 (en construcción), picks diarios béisbol MLB+Caribe, trigger 09:00 Madrid

## Reglas del Sistema
- Respuestas siempre en **español**
- Auto mode — ejecutar sin pedir confirmación en tareas normales
- **NUNCA** mencionar IA, Claude, Statz, ESPN ni fuentes en la UI
- Footer exacto: `Por Data Science Sandra Blanco | akera2011@protonmail.com`
- Commits frecuentes para mantener sincronía entre dispositivos
- Branch de trabajo: `ccr-302eb251-8ontw0`

## Archivos Clave
- `futboliq.html` — app principal fútbol (artifact: https://claude.ai/artifact/NkwEbsvb4JFLHxV8RMkdvY)
- `statz_data.json` — picks fútbol del día
- `beisboliq.html` — app principal béisbol (en construcción)
- `baseball_data.json` — picks béisbol del día
- `scripts/compute_picks.js` — algoritmo server-side fútbol
- `scripts/compute_baseball_picks.js` — algoritmo server-side béisbol

## Dispositivos
- **Mac** — principal, Claude Code + Obsidian
- **Toshiba** — portátil, Claude Code + Obsidian
- **iPhone** — captura móvil, Obsidian Mobile
