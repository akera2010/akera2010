#!/usr/bin/env node
'use strict';
// Actualiza los picks inline en futboliq.html con los datos del día
const fs = require('fs');
const path = require('path');

const dataFile = process.argv[2] || path.join(__dirname, '..', 'statz_data.json');
const htmlFile = process.argv[3] || path.join(__dirname, '..', 'futboliq.html');

const d = JSON.parse(fs.readFileSync(dataFile, 'utf8'));

// Pasar picks completos (con R.mc tal cual, sin transformar)
const picks = (d.picks || []).map(p => ({
  id: p.id, league: p.league, flag: p.flag, leagueId: p.leagueId,
  home: p.home, homeId: p.homeId, away: p.away, awayId: p.awayId, time: p.time,
  R: {
    mc: p.R.mc,
    lh: p.R.lh, la: p.R.la,
    ppgH: p.R.ppgH, ppgA: p.R.ppgA,
    hH: [], hA: [],
  },
  markets: p.markets,
  bestMkt: p.bestMkt,
  score: +p.score.toFixed(5),
  dataQ: p.dataQ || 0, statz: p.statz || true,
}));

const combos = (d.combos || []).map(c => ({
  name: c.name, pComb: +c.pComb.toFixed(5), oddsComb: c.oddsComb,
  picks: c.picks.map(x => ({ match: x.match, label: x.label, p: +x.p.toFixed(5), odds: x.odds })),
}));

const dateStr = d.updated || new Date().toLocaleString('en-CA', { timeZone: 'Europe/Madrid' }).slice(0, 10);
const j1 = JSON.stringify(picks);
const j2 = JSON.stringify(combos);

let html = fs.readFileSync(htmlFile, 'utf8');

html = html.replace(/const BAKED_DATE_F='[^']*';/, `const BAKED_DATE_F='${dateStr}';`);
html = html.replace(/const BAKED_PICKS_F=\[.*?\];/, `const BAKED_PICKS_F=${j1};`);
html = html.replace(/const BAKED_COMBOS_F=\[.*?\];/, `const BAKED_COMBOS_F=${j2};`);

fs.writeFileSync(htmlFile, html, 'utf8');
console.log(`✓ futboliq.html actualizado inline: ${picks.length} picks, ${combos.length} combinados para ${dateStr}`);
