#!/usr/bin/env node
'use strict';
// Actualiza los picks inline en beisboliq.html con los datos del día
const fs = require('fs');
const path = require('path');

const dataFile  = process.argv[2] || path.join(__dirname, '..', 'baseball_data.json');
const htmlFile  = process.argv[3] || path.join(__dirname, '..', 'beisboliq.html');

const d = JSON.parse(fs.readFileSync(dataFile, 'utf8'));

const picks = (d.picks || []).map(p => ({
  id: p.id, league: p.league, flag: p.flag, leagueId: p.leagueId,
  home: p.home, away: p.away, time: p.time,
  R: {
    mc: {
      p1: +p.R.mc.p1.toFixed(5), p2: +p.R.mc.p2.toFixed(5),
      alta: +p.R.mc.alta.toFixed(5), baja: +p.R.mc.baja.toFixed(5),
      rl1: +p.R.mc.rl1.toFixed(5), rl2: +p.R.mc.rl2.toFixed(5),
    },
    lh: p.R.lh, la: p.R.la, hH: [], hA: [], pitcherH: null, pitcherA: null,
  },
  markets: p.markets.map(m => ({ code: m.code, label: m.label, p: +m.p.toFixed(5), odds: m.odds })),
  bestMkt: { code: p.bestMkt.code, label: p.bestMkt.label, p: +p.bestMkt.p.toFixed(5), odds: p.bestMkt.odds },
  score: +p.score.toFixed(5), pitcherH: null, pitcherA: null, dataQ: 0, statz: true,
}));

const combos = (d.combos || []).map(c => ({
  name: c.name, pComb: +c.pComb.toFixed(5), oddsComb: c.oddsComb,
  picks: c.picks.map(x => ({ match: x.match, label: x.label, p: +x.p.toFixed(5), odds: x.odds })),
}));

const dateStr  = d.updated || new Date().toLocaleString('en-CA', { timeZone: 'Europe/Madrid' }).slice(0, 10);
const j1 = JSON.stringify(picks);
const j2 = JSON.stringify(combos);

let html = fs.readFileSync(htmlFile, 'utf8');

// Reemplazar los tres const BAKED_*  (en una sola línea cada uno, como los genera este script)
html = html.replace(/const BAKED_DATE_B='[^']*';/, `const BAKED_DATE_B='${dateStr}';`);
html = html.replace(/const BAKED_PICKS_B=\[.*?\];/, `const BAKED_PICKS_B=${j1};`);
html = html.replace(/const BAKED_COMBOS_B=\[.*?\];/, `const BAKED_COMBOS_B=${j2};`);

fs.writeFileSync(htmlFile, html, 'utf8');
console.log(`✓ beisboliq.html actualizado inline: ${picks.length} picks, ${combos.length} combinados para ${dateStr}`);
