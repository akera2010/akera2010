#!/usr/bin/env node
'use strict';
const fs = require('fs');

const PRM = {
  VERSION: '1.1', N: 50000, UMBRAL: 0.60, TOP: 8,
  MIN_P: 5, MIN_ODDS: 1.10,
  LG_AVG: { mlb: 4.5, 'ven.1': 4.2, 'mex.1': 4.3, 'dom.1': 4.4 },
};
const BANNED = new Set([]);

// Detección automática de temporadas por calendario
function activeLeagues() {
  const m = new Date().getMonth() + 1; // 1-12
  return {
    mlb:   m >= 4 && m <= 10,  // abr-oct
    'ven.1': m >= 10 || m <= 2, // oct-feb (LVBP)
    'mex.1': m >= 10 || m <= 2, // oct-feb (LMP)
    'dom.1': m >= 10 || m <= 2, // oct-feb (LIDOM)
  };
}

function rng(seed) {
  let s = seed >>> 0;
  return () => { s ^= s << 13; s ^= s >> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
}
function poisPmf(k, lam) {
  if (lam <= 0) return k === 0 ? 1 : 0;
  let r = Math.exp(-lam); for (let i = 1; i <= k; i++) r = r * lam / i; return r;
}
function poisInv(u, lam) {
  let k = 0, cum = 0;
  while (cum < u) { cum += poisPmf(k, lam); if (cum >= u) return k; k++; if (k > 30) return k; }
  return k;
}
function runMC(lh, la, seed) {
  const N = PRM.N, half = N / 2, r = rng(seed ^ 0xBEEF);
  let c1 = 0, c2 = 0, cAlta = 0, cBaja = 0, cRL1 = 0, cRL2 = 0;
  for (let i = 0; i < half; i++) {
    const u1 = r(), u2 = r();
    [[poisInv(u1, lh), poisInv(u2, la)], [poisInv(1 - u1, lh), poisInv(1 - u2, la)]].forEach(([rh, ra]) => {
      if (rh > ra) { c1++; if (rh - ra >= 2) cRL1++; } else c2++;
      if (ra >= rh || rh - ra <= 1) cRL2++;
      if (rh + ra > 6.5) cAlta++; else cBaja++;
    });
  }
  return { p1: c1 / N, p2: c2 / N, alta: cAlta / N, baja: cBaja / N, rl1: cRL1 / N, rl2: cRL2 / N };
}
function impliedOdds(p) {
  return p <= 0 || p >= 1 ? 1.01 : Math.round((1 / p) * 0.95 * 100) / 100;
}
function allMkts(R) {
  const mc = R.mc;
  return [
    { code: '1', label: 'Victoria Local', p: mc.p1 },
    { code: '2', label: 'Victoria Visitante', p: mc.p2 },
    { code: 'alta', label: 'Alta +6.5 Carreras', p: mc.alta },
    { code: 'baja', label: 'Baja -6.5 Carreras', p: mc.baja },
    { code: 'rl1', label: 'Run Line Local (-1.5)', p: mc.rl1 },
    { code: 'rl2', label: 'Run Line Visit. (+1.5)', p: mc.rl2 },
  ].map(m => ({ ...m, odds: impliedOdds(m.p) }))
   .filter(m => m.p > 0.01 && m.p < 0.99 && m.odds >= PRM.MIN_ODDS && !BANNED.has(m.code));
}
function mktFamily(code) {
  if (code === '1' || code === '2') return 'ml';
  if (code === 'rl1' || code === 'rl2') return 'rl';
  return 'ou';
}
function stability(hist) {
  if (!hist || hist.length < 3) return 0.5;
  const diffs = hist.slice(0, 8).map(x => x.gf - x.ga);
  const mu = diffs.reduce((a, v) => a + v, 0) / diffs.length;
  const v = diffs.reduce((a, v) => a + (v - mu) ** 2, 0) / diffs.length;
  return Math.max(0, 1 - Math.sqrt(v) / 3);
}
function pscore(mkt, R) {
  const stab = stability(R.hH || []), rel = Math.min(1, (R.hH || []).length / PRM.MIN_P);
  const ob = mkt.odds >= PRM.MIN_ODDS ? 0.02 : 0;
  return mkt.p + 0.05 * stab + 0.03 * rel + ob;
}
function normTeam(n) {
  return (n || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\b(fc|cf|sc|afc|bfc|ac|ss|as|ud|rc|sd|cd|rb|vfb|vfl|bvb)\b/g, '')
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}
function statzKey(h, a) { return normTeam(h) + '|' + normTeam(a); }
function hashStr(s) {
  let h = 0xDEADBEEF;
  for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 0x9e3779b9); h ^= h >>> 16; }
  return h >>> 0;
}
function todayMadrid() {
  return new Date().toLocaleString('en-CA', { timeZone: 'Europe/Madrid' }).slice(0, 10);
}
function poissonCDF_over65(lh, la) {
  let pUnder = 0;
  for (let total = 0; total <= 6; total++) {
    for (let h = 0; h <= total; h++) {
      pUnder += poisPmf(h, lh) * poisPmf(total - h, la);
    }
  }
  return 1 - pUnder;
}
function buildCombos(picks) {
  if (picks.length < 3) return [];
  const combos = [];
  for (let i = 0; i < Math.min(picks.length, 6); i++) {
    for (let j = i + 1; j < Math.min(picks.length, 6); j++) {
      for (let k = j + 1; k < Math.min(picks.length, 6); k++) {
        const pa = picks[i], pb = picks[j], pc = picks[k];
        const getAlt = p => p.markets.filter(m => m.code !== p.bestMkt.code && m.p >= 0.55 && !BANNED.has(m.code))[0] || (p.bestMkt.p >= 0.60 ? p.bestMkt : null);
        const ma = getAlt(pa), mb = getAlt(pb), mc2 = getAlt(pc);
        if (!ma || !mb || !mc2) continue;
        const pComb = ma.p * mb.p * mc2.p;
        if (pComb < 0.25) continue;
        combos.push({
          name: `Combinado ${combos.length + 1}`,
          pComb,
          oddsComb: parseFloat((ma.odds * mb.odds * mc2.odds).toFixed(2)),
          picks: [
            { match: `${pa.home} vs ${pa.away}`, label: ma.label, p: ma.p, odds: ma.odds },
            { match: `${pb.home} vs ${pb.away}`, label: mb.label, p: mb.p, odds: mb.odds },
            { match: `${pc.home} vs ${pc.away}`, label: mc2.label, p: mc2.p, odds: mc2.odds },
          ],
        });
        if (combos.length >= 10) break;
      }
      if (combos.length >= 10) break;
    }
    if (combos.length >= 10) break;
  }
  combos.sort((a, b) => b.pComb - a.pComb);
  return combos.slice(0, 2);
}

function main() {
  const statzFile = process.argv[2] || 'baseball_data.json';
  const data = JSON.parse(fs.readFileSync(statzFile, 'utf8'));
  const cache = data.cache || {};
  const fixtures = data.fixtures || [];
  const today = todayMadrid();
  const W = 0.65;
  const results = [];

  for (const fix of fixtures) {
    const sfDay = fix.time
      ? new Date(fix.time).toLocaleString('en-CA', { timeZone: 'Europe/Madrid' }).slice(0, 10)
      : today;
    if (sfDay !== today) continue;

    const k = statzKey(fix.home, fix.away);
    const sd = cache[k] || {};
    const lgAvg = PRM.LG_AVG[fix.leagueId] || 4.3;
    let lh = sd.xRH || (sd.winH ? (sd.winH > 0.5 ? lgAvg * 1.1 : lgAvg * 0.9) : lgAvg);
    let la = sd.xRA || (sd.winA ? (sd.winA > 0.5 ? lgAvg * 1.1 : lgAvg * 0.9) : lgAvg);

    const seed = hashStr((fix.home + fix.away).toLowerCase());
    const mc = runMC(lh, la, seed);

    if (sd.winH !== undefined) { mc.p1 = mc.p1 * (1 - W) + sd.winH * W; }
    if (sd.winA !== undefined) { mc.p2 = mc.p2 * (1 - W) + sd.winA * W; }
    if (sd.total !== undefined) {
      mc.alta = mc.alta * (1 - W) + (sd.total > 8.5 ? 0.68 : sd.total < 7.5 ? 0.35 : 0.52) * W;
      mc.baja = 1 - mc.alta;
    }
    const totML = mc.p1 + mc.p2; if (totML > 0) { mc.p1 /= totML; mc.p2 /= totML; }

    const R = { mc, lh, la, hH: [], hA: [], pitcherH: sd.pitcherH || null, pitcherA: sd.pitcherA || null, teamEraH: sd.teamEraH||null, teamEraA: sd.teamEraA||null };
    const mkts = allMkts(R); mkts.sort((a, b) => pscore(b, R) - pscore(a, R));
    if (!mkts.length) continue;
    const best = mkts[0];
    const sc = pscore(best, R);
    if (sc < PRM.UMBRAL) continue;
    results.push({ ...fix, R, markets: mkts, bestMkt: best, score: sc, pitcherH: sd.pitcherH || null, pitcherA: sd.pitcherA || null, teamEraH: sd.teamEraH||null, teamEraA: sd.teamEraA||null, dataQ: 0, statz: true });
  }

  results.sort((a, b) => b.score - a.score);
  const active = activeLeagues();
  const mlb = active.mlb ? results.filter(r => r.leagueId === 'mlb') : [];
  const car = results.filter(r => r.leagueId !== 'mlb');
  let finalPicks;
  if (mlb.length >= 5) {
    // Temporada MLB activa: 5 MLB + 3 Caribe
    finalPicks = [...mlb.slice(0, 5), ...car.slice(0, 3)];
  } else {
    // Off-season MLB (nov-mar) o pocos juegos MLB: solo diversidad Caribe
    const famC = {}, divP = [];
    for (const r of results) {
      const f = mktFamily(r.bestMkt.code);
      if ((famC[f] || 0) < 2) { famC[f] = (famC[f] || 0) + 1; divP.push(r); }
      if (divP.length >= PRM.TOP) break;
    }
    finalPicks = divP.length >= PRM.TOP ? divP : results.slice(0, PRM.TOP);
  }
  console.log(`[Ligas activas] MLB:${active.mlb} LVBP:${active['ven.1']} LMP:${active['mex.1']} LIDOM:${active['dom.1']}`);

  const combos = buildCombos(finalPicks);
  data.picks = finalPicks;
  data.combos = combos;
  data.updated = today;
  fs.writeFileSync(statzFile, JSON.stringify(data, null, 2));
  console.log(`✓ ${finalPicks.length} picks, ${combos.length} combinados para ${today}`);
  if (finalPicks.length) {
    finalPicks.forEach((p, i) => console.log(`  ${i + 1}. ${p.home} vs ${p.away} [${p.leagueId}] → ${p.bestMkt.label} @${p.bestMkt.odds} (${(p.bestMkt.p * 100).toFixed(1)}%)`));
  }
  if (combos.length) {
    combos.forEach((c, i) => console.log(`  Combo ${i + 1}: ${c.picks.map(x => x.label).join(' + ')} @${c.oddsComb} (${(c.pComb * 100).toFixed(1)}%)`));
  }
}
main();
