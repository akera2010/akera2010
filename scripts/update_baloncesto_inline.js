#!/usr/bin/env node
'use strict';
// Actualiza los picks inline en baloncestoiq.html con los datos del día
const fs = require('fs');
const path = require('path');

const dataFile = process.argv[2] || path.join(__dirname, '..', 'basketball_data.json');
const htmlFile = process.argv[3] || path.join(__dirname, '..', 'baloncestoiq.html');

const d = JSON.parse(fs.readFileSync(dataFile, 'utf8'));

const picks = (d.picks || []).map(p => ({
  id: p.id, league: p.league, flag: p.flag, leagueId: p.leagueId,
  home: p.home, away: p.away, time: p.time,
  R: {
    mc: p.R.mc,
    ortgH: p.R.ortgH, drtgH: p.R.drtgH, paceH: p.R.paceH, netH: p.R.netH,
    ortgA: p.R.ortgA, drtgA: p.R.drtgA, paceA: p.R.paceA, netA: p.R.netA,
    recordH: p.R.recordH, recordA: p.R.recordA,
    injuriesH: p.R.injuriesH || [], injuriesA: p.R.injuriesA || [],
  },
  markets: p.markets.map(m => ({ code: m.code, label: m.label, p: +m.p.toFixed(5), odds: m.odds })),
  bestMkt: { code: p.bestMkt.code, label: p.bestMkt.label, p: +p.bestMkt.p.toFixed(5), odds: p.bestMkt.odds },
  score: +p.score.toFixed(5), confidence: p.confidence || 'Medio', statz: true,
}));

const combos = (d.combos || []).map(c => ({
  name: c.name, pComb: +c.pComb.toFixed(5), oddsComb: c.oddsComb,
  picks: c.picks.map(x => ({ match: x.match, label: x.label, p: +x.p.toFixed(5), odds: x.odds })),
}));

const dateStr = d.updated || new Date().toLocaleString('en-CA', { timeZone: 'Europe/Madrid' }).slice(0, 10);
const j1 = JSON.stringify(picks);
const j2 = JSON.stringify(combos);

let html = fs.readFileSync(htmlFile, 'utf8');

html = html.replace(/const BAKED_DATE_K='[^']*';/, `const BAKED_DATE_K='${dateStr}';`);
html = html.replace(/const BAKED_PICKS_K=\[.*?\];/, `const BAKED_PICKS_K=${j1};`);
html = html.replace(/const BAKED_COMBOS_K=\[.*?\];/, `const BAKED_COMBOS_K=${j2};`);

fs.writeFileSync(htmlFile, html, 'utf8');
console.log(`✓ baloncestoiq.html actualizado inline: ${picks.length} picks, ${combos.length} combinados para ${dateStr}`);
