# BeisbolIQ v1.0

## Estado: ACTIVO ✅

## Ligas
- MLB (🇺🇸), LVBP (🇻🇪), LMP (🇲🇽), LIDOM (🇩🇴)

## Archivos
- `beisboliq.html` — app principal (en construcción)
- `baseball_data.json` — data diaria (picks + combos)
- `scripts/compute_baseball_picks.js` — algoritmo Poisson carreras + MC 50K antitético

## Algoritmo
- Poisson run-scoring (béisbol)
- Monte Carlo antitético 50K simulaciones
- Bayesian blend W=0.65 con datos Statz/ESPN
- UMBRAL: 0.63, MIN_ODDS: 1.10, TOP: 8

## Mercados
- 1/2 (Moneyline Local/Visitante)
- Alta/Baja +6.5/-6.5 Carreras
- Run Line ±1.5 (rl1/rl2)
- Max 2 por familia (ml/ou/rl)

## Regla Composición
- Si ≥5 juegos MLB disponibles: 5 MLB + 3 Caribe
- Si no hay MLB: hasta 8 Caribe

## Artifact
URL: https://claude.ai/artifact/QKEKC71XUqKmzJwaxJzwwY (Version 1)

## Trigger Diario
ID: trig_01W6NopuKVxRgtPFYbXEmT2w
Hora: 09:00 Madrid (CRON_TZ=Europe/Madrid 0 9 * * *)

## GitHub Raw
URL: https://raw.githubusercontent.com/akera2010/akera2010/ccr-302eb251-8ontw0/baseball_data.json
