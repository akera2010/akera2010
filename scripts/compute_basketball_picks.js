#!/usr/bin/env node
'use strict';
/**
 * compute_basketball_picks.js
 * Ridge Regression / Sagarin-style ratings para NBA y baloncesto europeo.
 * Ejecutado por el trigger diario. Genera basketball_data.json con picks y combinados.
 */
const fs = require('fs');
const path = require('path');

/* ===== LEAGUE PARAMS ===== */
const LG = {
  nba:  { ortg: 115.0, drtg: 115.0, pace: 98.0, sigma_m: 12.0, sigma_t: 15.0, hAdv: 2.5 },
  euro: { ortg: 107.5, drtg: 107.5, pace: 73.5, sigma_m: 10.0, sigma_t: 12.0, hAdv: 2.0 },
};

/* ===== THRESHOLDS ===== */
const UMBRAL_ML     = 0.65;
const UMBRAL_SPREAD = 2.5;
const UMBRAL_TOTAL  = 3.0;
const MIN_ODDS      = 1.10;
const TOP           = 8;

/* ===== MATH ===== */
function normalCDF(z) {
  const a1=0.254829592, a2=-0.284496736, a3=1.421413741, a4=-1.453152027, a5=1.061405429, p=0.3275911;
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5*t + a4)*t) + a3)*t + a2)*t + a1)*t * Math.exp(-x*x);
  return 0.5 * (1.0 + sign * y);
}

function impliedOdds(p) {
  if (p <= 0 || p >= 1) return 1.01;
  return Math.round((1 / p) * 0.95 * 100) / 100;
}

function projectGame(h, a, isNBA) {
  const lg = isNBA ? LG.nba : LG.euro;
  // Modelo completo si hay ortg/drtg/pace reales
  if (h.ortg != null && a.ortg != null && h.pace != null && a.pace != null) {
    const paceAvg = (h.pace + a.pace) / 2;
    const projH = h.ortg * (a.drtg / lg.drtg) * paceAvg / 100;
    const projA = a.ortg * (h.drtg / lg.drtg) * paceAvg / 100;
    const projMargin = projH - projA + lg.hAdv;
    const projTotal = projH + projA;
    const pHome = normalCDF(projMargin / lg.sigma_m);
    return { projH, projA, projMargin, projTotal, pHome, pAway: 1 - pHome, sigma_m: lg.sigma_m, sigma_t: lg.sigma_t };
  }
  // Fallback desde net rating estimado (récord W-L)
  const netH = h.net || 0;
  const netA = a.net || 0;
  const projMargin = netH - netA + lg.hAdv;
  // Puntos/equipo = ORtg × Pace/100; para NBA pace≈100 → ~ORtg; para Euroliga pace≈73.5 → ~79 pts
  const base = isNBA ? lg.ortg : lg.ortg * lg.pace / 100;
  const projH = base + netH * 0.5;
  const projA = base + netA * 0.5;
  const projTotal = projH + projA;
  const pHome = normalCDF(projMargin / lg.sigma_m);
  return { projH, projA, projMargin, projTotal, pHome, pAway: 1 - pHome, sigma_m: lg.sigma_m, sigma_t: lg.sigma_t };
}

function buildMarkets(proj, spreadLine, totalLine) {
  const { pHome, pAway, projMargin, projTotal, sigma_t } = proj;
  const spreadDiv = +(Math.abs(projMargin) - Math.abs(spreadLine)).toFixed(2);
  const totalDivRaw = projTotal - totalLine;
  const totalDiv = +Math.abs(totalDivRaw).toFixed(2);
  const p_spread_home = normalCDF(projMargin - spreadLine);
  const p_total_over  = normalCDF(totalDivRaw / sigma_t);
  const p_total_under = 1 - p_total_over;

  return {
    mc: { pHome, pAway, projH: +proj.projH.toFixed(1), projA: +proj.projA.toFixed(1),
          projMargin: +projMargin.toFixed(1), projTotal: +projTotal.toFixed(1),
          spreadLine, totalLine, spreadDiv, totalDiv },
    markets: [
      { code: 'ml_home',      p: pHome,          label: null },
      { code: 'ml_away',      p: pAway,          label: null },
      { code: 'spread_home',  p: p_spread_home,  label: `Local ${spreadLine > 0 ? '+' : ''}${spreadLine}` },
      { code: 'spread_away',  p: 1 - p_spread_home, label: `Visit. ${-spreadLine > 0 ? '+' : ''}${-spreadLine}` },
      { code: 'total_over',   p: p_total_over,   label: `Más ${totalLine} pts` },
      { code: 'total_under',  p: p_total_under,  label: `Menos ${totalLine} pts` },
    ],
    spreadDiv, totalDiv,
  };
}

function pickScore(mkt, mc) {
  const code = mkt.code;
  if (code === 'ml_home' || code === 'ml_away') return mkt.p >= UMBRAL_ML ? mkt.p : 0;
  if (code.startsWith('spread')) return mc.spreadDiv >= UMBRAL_SPREAD ? mkt.p : 0;
  if (code.startsWith('total')) return mc.totalDiv >= UMBRAL_TOTAL ? mkt.p : 0;
  return 0;
}

function confidenceLabel(mkt, mc) {
  const code = mkt.code;
  if (code === 'ml_home' || code === 'ml_away') return mkt.p >= 0.70 ? 'Alto' : 'Medio';
  if (code.startsWith('spread')) return mc.spreadDiv >= 3.5 ? 'Alto' : 'Medio';
  if (code.startsWith('total')) return mc.totalDiv >= 4.5 ? 'Alto' : 'Medio';
  return 'Medio';
}

function buildCombos(picks) {
  const pool = picks.filter(p => p.bestMkt.p >= 0.65);
  if (pool.length < 3) return [];
  const combos = [];
  for (let i = 0; i < pool.length - 2; i++) {
    for (let j = i + 1; j < pool.length - 1; j++) {
      for (let k = j + 1; k < pool.length; k++) {
        const a = pool[i], b = pool[j], c = pool[k];
        const pComb = a.bestMkt.p * b.bestMkt.p * c.bestMkt.p;
        const oddsComb = +(a.bestMkt.odds * b.bestMkt.odds * c.bestMkt.odds).toFixed(2);
        if (pComb < 0.25 || oddsComb < 1.30) continue;
        combos.push({
          name: '', pComb: +pComb.toFixed(5), oddsComb,
          picks: [
            { match: `${a.home} vs ${a.away}`, label: a.bestMkt.label, p: +a.bestMkt.p.toFixed(5), odds: a.bestMkt.odds },
            { match: `${b.home} vs ${b.away}`, label: b.bestMkt.label, p: +b.bestMkt.p.toFixed(5), odds: b.bestMkt.odds },
            { match: `${c.home} vs ${c.away}`, label: c.bestMkt.label, p: +c.bestMkt.p.toFixed(5), odds: c.bestMkt.odds },
          ],
        });
      }
    }
  }
  combos.sort((a, b) => b.pComb - a.pComb);
  return combos.slice(0, 2).map((c, i) => ({ ...c, name: `Combinado ${i + 1}` }));
}

/* ===== FIXTURES DESDE JSON (no hardcodeados) ===== */
const today = new Date().toLocaleString('en-CA', { timeZone: 'Europe/Madrid' }).slice(0, 10);
const dataFile = process.argv[2] || path.join(__dirname, '..', 'basketball_data.json');
let _data = { updated: today, fixtures: [], picks: [], combos: [] };
try { _data = JSON.parse(fs.readFileSync(dataFile, 'utf8')); } catch {}

// NBA: solo partidos de hoy. Europa (Euroliga/EuroCup/ACB): incluir próximos 4 días
const FIXTURES_JSON = (_data.fixtures || []).filter(f => {
  if (!f.time) return false;
  const fDay = new Date(f.time).toLocaleString('en-CA', { timeZone: 'Europe/Madrid' }).slice(0, 10);
  if (f.isNBA) return fDay === today;
  // Ligas europeas: juegan martes-jueves; mostrar próximos 4 días
  const diff = (new Date(fDay) - new Date(today)) / 86400000;
  return diff >= 0 && diff <= 4;
});

// Legacy: fixtures hardcodeados solo si JSON está vacío Y no hay fecha actualizada
const _hasRealData = FIXTURES_JSON.length > 0 || _data.updated === today;

const FIXTURES_LEGACY = _hasRealData ? [] : [
  // NBA
  {
    id: 'k1', league: 'NBA', flag: '🇺🇸', leagueId: 'nba',
    home: 'Boston Celtics', away: 'Philadelphia 76ers', time: `${today}T00:00:00Z`,
    isNBA: true, spreadLine: -9.0, totalLine: 224.0,
    H: { ortg: 123.5, drtg: 110.2, pace: 98.3, net: 13.3, record: '8-3', injuries: ['K. Porzingis (OUT-Achilles)'] },
    A: { ortg: 117.1, drtg: 117.8, pace: 97.1, net: -0.7, record: '3-7', injuries: ['J. Embiid (OUT-manager)'] },
    rest: { H: 1, A: 2 },
  },
  {
    id: 'k2', league: 'NBA', flag: '🇺🇸', leagueId: 'nba',
    home: 'OKC Thunder', away: 'Dallas Mavericks', time: `${today}T01:00:00Z`,
    isNBA: true, spreadLine: -10.5, totalLine: 225.0,
    H: { ortg: 122.8, drtg: 109.5, pace: 99.1, net: 13.3, record: '10-2', injuries: [] },
    A: { ortg: 116.2, drtg: 118.4, pace: 97.8, net: -2.2, record: '4-9', injuries: ['L. Doncic (PROB-ankle)'] },
    rest: { H: 2, A: 1 },
  },
  {
    id: 'k3', league: 'NBA', flag: '🇺🇸', leagueId: 'nba',
    home: 'Denver Nuggets', away: 'Phoenix Suns', time: `${today}T03:00:00Z`,
    isNBA: true, spreadLine: -7.5, totalLine: 222.0,
    H: { ortg: 120.5, drtg: 112.3, pace: 97.4, net: 8.2, record: '7-4', injuries: [] },
    A: { ortg: 114.2, drtg: 118.9, pace: 100.1, net: -4.7, record: '3-9', injuries: ['B. Beal (OUT)'] },
    rest: { H: 0, A: 1 },
  },
  {
    id: 'k4', league: 'NBA', flag: '🇺🇸', leagueId: 'nba',
    home: 'Golden State Warriors', away: 'Los Angeles Lakers', time: `${today}T04:30:00Z`,
    isNBA: true, spreadLine: 1.5, totalLine: 232.0,
    H: { ortg: 117.3, drtg: 116.8, pace: 101.2, net: 0.5, record: '5-7', injuries: ['S. Curry (DOUBT-knee)'] },
    A: { ortg: 118.9, drtg: 115.1, pace: 99.3, net: 3.8, record: '6-5', injuries: [] },
    rest: { H: 1, A: 2 },
  },
  {
    id: 'k5', league: 'NBA', flag: '🇺🇸', leagueId: 'nba',
    home: 'Milwaukee Bucks', away: 'Miami Heat', time: `${today}T01:30:00Z`,
    isNBA: true, spreadLine: -7.0, totalLine: 219.5,
    H: { ortg: 119.4, drtg: 113.5, pace: 98.8, net: 5.9, record: '6-5', injuries: ['G. Antetokounmpo (DOUBT-knee)'] },
    A: { ortg: 112.8, drtg: 116.5, pace: 97.2, net: -3.7, record: '4-7', injuries: [] },
    rest: { H: 1, A: 2 },
  },
  // ACB
  {
    id: 'k6', league: 'ACB Liga', flag: '🇪🇸', leagueId: 'acb',
    home: 'FC Barcelona', away: 'Joventut Badalona', time: `${today}T17:30:00Z`,
    isNBA: false, spreadLine: -8.0, totalLine: 167.0,
    H: { ortg: 112.4, drtg: 98.3, pace: 76.2, net: 14.1, record: '9-1', injuries: [] },
    A: { ortg: 103.2, drtg: 108.7, pace: 74.8, net: -5.5, record: '4-7', injuries: ['A. Kuric (PROB)'] },
    rest: { H: 2, A: 2 },
  },
  // Euroliga
  {
    id: 'k7', league: 'EuroLeague', flag: '🇪🇺', leagueId: 'euroliga',
    home: 'Real Madrid', away: 'Fenerbahçe', time: `${today}T19:45:00Z`,
    isNBA: false, spreadLine: -4.0, totalLine: 163.5,
    H: { ortg: 109.8, drtg: 99.2, pace: 74.1, net: 10.6, record: '7-3', injuries: ['V. Hezonja (OUT)'] },
    A: { ortg: 107.3, drtg: 103.5, pace: 73.8, net: 3.8, record: '5-5', injuries: ['N. de Colo (PROB)'] },
    rest: { H: 2, A: 3 },
  },
  // EuroCup
  {
    id: 'k8', league: 'EuroCup', flag: '🇪🇺', leagueId: 'eurocup',
    home: 'Valencia Basket', away: 'AS Monaco', time: `${today}T19:30:00Z`,
    isNBA: false, spreadLine: 1.5, totalLine: 165.0,
    H: { ortg: 107.5, drtg: 102.3, pace: 74.5, net: 5.2, record: '4-4', injuries: [] },
    A: { ortg: 110.2, drtg: 103.8, pace: 75.2, net: 6.4, record: '5-3', injuries: [] },
    rest: { H: 2, A: 1 },
  },
];

const FIXTURES = FIXTURES_JSON.length > 0 ? FIXTURES_JSON : FIXTURES_LEGACY;

/* ===== COMPUTE PICKS ===== */
const picks = [];
for (const f of FIXTURES) {
  const proj = projectGame(f.H, f.A, f.isNBA);
  const { mc, markets, spreadDiv, totalDiv } = buildMarkets(proj, f.spreadLine, f.totalLine);
  mc.rest = f.rest;

  const mktsFormatted = markets.map(m => ({
    code: m.code,
    label: m.label
      ? m.label.replace('Local', f.home).replace('Visit.', f.away)
      : (m.code === 'ml_home' ? `Ganador Local (${f.home})` : `Ganador Visit. (${f.away})`),
    p: +m.p.toFixed(5), odds: impliedOdds(m.p),
  })).filter(m => m.odds >= MIN_ODDS && m.p > 0.01 && m.p < 0.99);

  // Sort by score
  mktsFormatted.sort((a, b) => pickScore(b, { spreadDiv, totalDiv }) - pickScore(a, { spreadDiv, totalDiv }));

  const best = mktsFormatted.find(m => pickScore(m, { spreadDiv, totalDiv }) > 0);
  if (!best) continue;

  picks.push({
    id: f.id, league: f.league, flag: f.flag, leagueId: f.leagueId,
    home: f.home, away: f.away, time: f.time,
    R: {
      mc,
      ortgH: f.H.ortg, drtgH: f.H.drtg, paceH: f.H.pace, netH: f.H.net,
      ortgA: f.A.ortg, drtgA: f.A.drtg, paceA: f.A.pace, netA: f.A.net,
      recordH: f.H.record, recordA: f.A.record,
      injuriesH: f.H.injuries || [], injuriesA: f.A.injuries || [],
    },
    markets: mktsFormatted,
    bestMkt: best,
    score: +best.p.toFixed(5),
    confidence: confidenceLabel(best, { spreadDiv, totalDiv }),
    statz: true,
  });
}

picks.sort((a, b) => b.score - a.score);
const topPicks = picks.slice(0, TOP);
const combos = buildCombos(topPicks);

_data.picks   = topPicks;
_data.combos  = combos;
_data.updated = today;
fs.writeFileSync(dataFile, JSON.stringify(_data, null, 2), 'utf8');
console.log(`✓ basketball_data.json generado: ${topPicks.length} picks, ${combos.length} combinados para ${today} (${FIXTURES.length} fixtures procesados)`);
