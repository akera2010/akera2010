# Cerebro Principal — Arantxa

## Identidad del sistema
Este repositorio es el cerebro central sincronizado entre:
- **Mac** (dispositivo principal) — Claude Code + Obsidian
- **Toshiba** (portátil) — Claude Code + Obsidian
- **iPhone** (captura móvil) — Obsidian Mobile

Vault Obsidian: `~/.claude/obsidian/`
Repo GitHub: `akera2010/akera2010`

## Especificaciones del Mac (dispositivo principal)
- **Modelo**: MacBook Pro Retina 13 pulgadas, principios de 2015
- **Procesador**: 3,1 GHz Intel Core i7 de doble núcleo — CHIP INTEL (no Apple Silicon)
- **Memoria RAM**: 16 GB 1867 MHz DDR3
- **Gráficos**: Intel Iris Graphics 6100, 1536 MB
- **macOS**: Monterey 12.7.6
- **Número de serie**: C02RW3TMFVH6
- **Compilación APK**: usar Android Studio para Intel Mac o Cordova con JDK 17

## Al inicio de cada sesión (OBLIGATORIO)
1. `cd /home/user/akera2010 && git pull origin HEAD --quiet` — sincronizar últimos cambios
2. Revisar `~/.claude/obsidian/04-Inbox/` — notas pendientes del móvil o Toshiba
3. Revisar nota diaria en `~/.claude/obsidian/01-Diario/` para contexto del día
4. Leer `~/.claude/obsidian/00-Index/README.md` — proyectos activos y reglas

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

## REGLAS PERMANENTES IRROMPIBLES

### 🔴 APLICACIONES PARA TIENDA — APK OBLIGATORIO
- Cuando se entrega una app para tienda (Google Play, App Store): SIEMPRE en formato APK
- El APK va dentro del ZIP junto con todas las carpetas y archivos
- JAMÁS entregar la app en HTML, aunque la app sea una SPA/WebApp
- Si no hay APK disponible: usar el APK original entregado por el propietario
- El APK original siempre está en el scratchpad de sesión o en el historial

### 🔴 ESTRUCTURA DEL ZIP DE ENTREGA
Toda entrega de app para tienda debe incluir en el ZIP:
- `app/NombreApp.apk` — la aplicación instalable
- `store-icons/` — íconos en todos los tamaños requeridos
- `LOGOS PROPUESTOS/` — propuestas de logo + SVGs editables + dossier
- `CONFIGURACION PROPIETARIO/` — dossier confidencial del propietario
- `dossiers/` — guías de publicación en tiendas
- `README.txt` — instrucciones de uso

### 🔴 EJECUCIÓN SIN PÉRDIDA DE TIEMPO
- Ejecutar directamente, sin pedir confirmaciones innecesarias
- Grabar cada instrucción repetida y aplicarla desde la primera vez
- El propietario aporta el 60% del trabajo — aprovechar lo que ya existe

### 🔴 REGLAS DE IDENTIDAD — IRROMPIBLES
- JAMÁS mostrar versión en ningún lugar de la app/landing (título, logo, pie) salvo que el propietario lo pida explícitamente
- JAMÁS mencionar IAs, terceros (ESPN, Statz, etc.) ni tecnologías en la interfaz visible al usuario
- JAMÁS fabricar ni inventar — solo ejecutar con los archivos y datos reales existentes
- FutbolIQ: colores fijos SIEMPRE — "Futbol" = `#102747` (azul oscuro), "IQ" = `#c00000` (rojo)
- El nombre de la app es SIEMPRE "FutbolIQ" — sin version, sin subtítulos técnicos

## Proyectos activos
Ver `~/.claude/obsidian/03-Proyectos/` para lista actualizada.
