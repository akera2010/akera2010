# FútbolIQ v5.0 — Sandra Blanco

## Estado
- Archivo: `futboliq.html` (raíz del repo akera2010/akera2010)
- Artefacto: https://claude.ai/artifact/NkwEbsvb4JFLHxV8RMkdvY
- Trigger diario: `trig_0155PGM3sSZsoqaFnUBQHFU2` — 06:00 AM Madrid (cron: `CRON_TZ=Europe/Madrid 0 6 * * *`)
- Branch: `ccr-302eb251-8ontw0`

## Parámetros clave (PRM)
| Parámetro | Valor |
|---|---|
| Versión | 5.0 |
| Simulaciones MC | 100,000 (antitéticas) |
| Umbral mínimo | 0.80 (pscore) |
| Cuota mínima | ≥ 1.45 |
| Picks por día | 8 de 8 partidos distintos |
| Diversidad | Máx. 2 picks por familia de mercado |
| Shrinkage K | 4 |
| Ventaja local | 0.20 |
| ELO half-life | 3.0 partidos |

## Algoritmo v5 — Mejoras sobre v4
- **Medias Bayesianas por liga** (LEAGUE_MEANS): shrinkage hacia media específica de la liga en vez de global 1.35
- **Fetch paralelo**: Promise.allSettled sobre 24 ligas simultáneamente
- **Diversidad de mercados**: max 2 picks por familia {1x2, goles, btts}
- **Nuevos mercados**: G+3.5, G-3.5, Sin Goles (G-0.5)
- **Integración dual**: ESPN (live) + modelo matemático interno (cacheado en rebuild)

## Medias de goles por liga (x̅)
| Liga | x̅ goles/partido |
|---|---|
| Eredivisie 🇳🇱 | 3.25 |
| Bundesliga 🇩🇪 | 3.15 |
| Premier League 🏴󠁧󠁢󠁥󠁮󠁧󠁿 | 2.90 |
| Süper Lig 🇹🇷 | 2.95 |
| Bundesliga 2 | 3.00 |
| La Liga 🇪🇸 | 2.80 |
| Serie A 🇮🇹 | 2.75 |
| Ligue 1 🇫🇷 | 2.65 |
| Segunda Div | 2.50 |

## Ligas cubiertas (24, sin Rusia)
esp.1, eng.1, ger.1, ita.1, fra.1, por.1, ned.1, tur.1, bel.1, gre.1, sco.1, aut.1, sui.1, den.1, nor.1, swe.1, eng.2, ger.2, esp.2, ita.2, fra.2, cze.1, pol.1, rou.1

## Notación matemática
- x̅ = promedio/media (usado en stats strip)
- λ (lambda) = media de Poisson (goles esperados por equipo)
- ρ (rho) = correlación Dixon-Coles = -0.05
- pscore = p + 0.05·stab + 0.03·rel + odds_bonus

## Fondo / UI
- Fondo: gradiente metalizado azul-plata (`#1a2d58 → #2a4296`)
- PDF: fondo blanco con banda verde profesional
- Sin menciones de IA, Claude, Statz ni ESPN en la interfaz
- Pie: "Por Data Science Sandra Blanco | akera2011@protonmail.com"

## Trigger diario — pendiente
Para que el trigger acceda a datos del modelo matemático externo, activar conector desde:
claude.ai → Configuración → Rutinas → FútbolIQ Actualización Diaria 06:00 Madrid

## Historial de versiones
- v4.0: Base (Dixon-Coles + ELO + 10K MC, Statz cache, TZ selector)
- v5.0: 100K MC, medias por liga, 24 ligas paralelas, PDF blanco, fondo metalizado, x̅ en stats
