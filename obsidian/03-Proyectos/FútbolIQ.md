# FútbolIQ v5.0

## Estado: ACTIVO ✅

## Artifact
URL: https://claude.ai/artifact/NkwEbsvb4JFLHxV8RMkdvY (Version 24)

## Trigger Diario
ID: trig_0155PGM3sSZsoqaFnUBQHFU2
Hora: 06:00 Madrid (CRON_TZ=Europe/Madrid 0 6 * * *)

## Archivos
- `futboliq.html` — app principal
- `statz_data.json` — data diaria (picks + combos)
- `scripts/compute_picks.js` — algoritmo Dixon-Coles + MC 100K antitético

## Algoritmo
- Dixon-Coles bivariate Poisson, ρ=−0.05
- Monte Carlo antitético 100K simulaciones
- Bayesian blend W=0.65 con datos Statz
- UMBRAL: 0.60, MIN_ODDS: 1.10, TOP: 8
- Genera 8 picks + 2 combinados

## Mercados
- 1/X/2 (resultado), G+1.5/G+2.5/G+3.5 (goles), BTTS
- Max 2 por familia de mercado

## Fixes Aplicados (sesión 47-B)
- MIN_ODDS: 1.45→1.10 (corregía bug de 0 picks)
- buildCombos pComb: 0.35→0.25
- Alt threshold: 0.62→0.55
- Logo ⚽ sin recuadro azul
- JSON export → PDF historial (exportHistPDF)
- Auto-actualización al abrir sin botón
