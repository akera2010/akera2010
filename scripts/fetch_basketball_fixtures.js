#!/usr/bin/env node
'use strict';
/**
 * fetch_basketball_fixtures.js
 * Obtiene partidos reales de APIs públicas — NBA (ESPN + stats.nba.com), Euroliga/EuroCup, ACB.
 * Usa curl para todas las peticiones HTTPS (maneja proxy, gzip, chunked automáticamente).
 *
 * Uso: node scripts/fetch_basketball_fixtures.js [basketball_data.json]
 */

const { execSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

/* ===== CURL HTTP HELPER ===== */
// curl usa HTTPS_PROXY automáticamente y maneja gzip/chunked nativamente
function getJSON(url, extraHeaders = []) {
  const headers = [
    '-H', 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    '-H', 'Accept: application/json, */*',
    '-H', 'Accept-Language: es-ES,es;q=0.9,en;q=0.8',
    '--compressed',
  ];
  for (const h of extraHeaders) {
    headers.push('-H', h);
  }
  const headerStr = headers.map(h => `'${h}'`).join(' ');
  const cmd = `curl -s --max-time 15 ${headerStr} '${url}'`;
  const out = execSync(cmd, { encoding: 'utf8', timeout: 20000 }).trim();
  if (!out) throw new Error('Respuesta vacía');
  return JSON.parse(out);
}

/* ===== STATS.NBA.COM — HEADERS ANTI-BOT ===== */
const NBA_STATS_HEADERS = [
  'Referer: https://stats.nba.com/',
  'x-nba-stats-origin: stats',
  'x-nba-stats-token: true',
  'Connection: keep-alive',
  'Accept-Encoding: gzip, deflate, br',
];

/* ===== CONFIG DE LIGAS ===== */
const ESPN_HOST = 'site.api.espn.com';
const EURO_HOST = 'api-live.euroleague.net';

const ESPN_LEAGUES = [
  { slug: 'nba',        name: 'NBA',      flag: '🇺🇸', leagueId: 'nba',     isNBA: true,  hAdv: 2.5, totalBase: 225.0 },
  { slug: 'euroleague', name: 'Euroliga', flag: '🌍',  leagueId: 'euro',    isNBA: false, hAdv: 2.0, totalBase: 162.0 },
  { slug: 'eurocup',    name: 'EuroCup',  flag: '🌍',  leagueId: 'eurocup', isNBA: false, hAdv: 2.0, totalBase: 160.0 },
  { slug: 'acb.es',     name: 'ACB Liga', flag: '🇪🇸',  leagueId: 'acb',     isNBA: false, hAdv: 2.0, totalBase: 167.0 },
];

/* ===== UTILIDADES ===== */
function parseRecord(summary) {
  const m = (summary || '').match(/^(\d+)-(\d+)/);
  return m ? { w: +m[1], l: +m[2] } : { w: null, l: null };
}
function estNet(w, l, isNBA) {
  if (w == null || l == null || w + l === 0) return 0;
  return ((w / (w + l)) - 0.5) * (isNBA ? 22 : 18);
}
function roundHalf(x) { return Math.round(x * 2) / 2; }
function normName(n) {
  return (n || '').toLowerCase().normalize('NFD')
    .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
}

/* ===== FETCH NBA ADVANCED STATS (ORtg/DRtg/Pace) ===== */
async function fetchNBAAdvanced() {
  const statsMap = {};
  try {
    const url = 'https://stats.nba.com/stats/leaguedashteamstats?Conference=&DateFrom=&DateTo=&Division=&GameScope=&GameSegment=&Height=&LastNGames=0&LeagueID=00&Location=&MeasureType=Advanced&Month=0&OpponentTeamID=0&Outcome=&PORound=0&PaceAdjust=N&PerMode=PerGame&Period=0&PlayerExperience=&PlayerPosition=&PlusMinus=N&Rank=N&Season=2025-26&SeasonSegment=&SeasonType=Regular+Season&ShotClockRange=&StarterBench=&TeamID=0&TwoWay=0&VsConference=&VsDivision=';
    const d = getJSON(url, NBA_STATS_HEADERS);
    const headers = d.resultSets[0].headers;
    const rows    = d.resultSets[0].rowSet;
    const idx = {
      team:  headers.indexOf('TEAM_NAME'),
      ortg:  headers.indexOf('OFF_RATING'),
      drtg:  headers.indexOf('DEF_RATING'),
      pace:  headers.indexOf('PACE'),
      net:   headers.indexOf('NET_RATING'),
    };
    for (const row of rows) {
      const key = normName(row[idx.team]);
      statsMap[key] = {
        ortg: row[idx.ortg] != null ? +row[idx.ortg].toFixed(1) : null,
        drtg: row[idx.drtg] != null ? +row[idx.drtg].toFixed(1) : null,
        pace: row[idx.pace] != null ? +row[idx.pace].toFixed(1) : null,
        net:  row[idx.net]  != null ? +row[idx.net].toFixed(1)  : null,
      };
    }
    console.log(`  NBA Advanced: ${Object.keys(statsMap).length} equipos con ORtg/DRtg/Pace`);
  } catch (e) {
    console.warn(`  [WARN] NBA Advanced stats: ${e.message.slice(0, 80)}`);
  }
  return statsMap;
}

/* ===== FETCH ESPN (una liga) ===== */
function fetchESPN(league) {
  try {
    const url = `https://${ESPN_HOST}/apis/site/v2/sports/basketball/${league.slug}/scoreboard`;
    const d = getJSON(url);
    const fixtures = [];
    for (const e of (d.events || [])) {
      const comp  = e.competitions[0];
      const homeC = comp.competitors.find(c => c.homeAway === 'home');
      const awayC = comp.competitors.find(c => c.homeAway === 'away');
      if (!homeC || !awayC) continue;
      const recH = parseRecord((homeC.records || []).find(r => r.type === 'total')?.summary);
      const recA = parseRecord((awayC.records || []).find(r => r.type === 'total')?.summary);
      const netH = estNet(recH.w, recH.l, league.isNBA);
      const netA = estNet(recA.w, recA.l, league.isNBA);
      const spread = roundHalf(netH - netA + league.hAdv);
      fixtures.push({
        id: `${league.leagueId.slice(0,3)}${fixtures.length + 1}`,
        league: league.name, flag: league.flag, leagueId: league.leagueId,
        isNBA: league.isNBA,
        home: homeC.team.displayName,
        away: awayC.team.displayName,
        time: e.date,
        status: comp.status?.type?.name || 'Scheduled',
        spreadLine: spread,
        totalLine:  league.totalBase,
        H: { ortg: null, drtg: null, pace: null, net: +netH.toFixed(1),
             record: recH.w != null ? `${recH.w}-${recH.l}` : '?', injuries: [] },
        A: { ortg: null, drtg: null, pace: null, net: +netA.toFixed(1),
             record: recA.w != null ? `${recA.w}-${recA.l}` : '?', injuries: [] },
        rest: { H: 1, A: 1 },
      });
    }
    return fixtures;
  } catch (e) {
    console.warn(`  [WARN] ESPN ${league.name}: ${e.message.slice(0, 80)}`);
    return [];
  }
}

/* ===== FETCH EUROLIGA API OFICIAL ===== */
function fetchEuroliga(today, competition, name, flag, leagueId, totalBase) {
  try {
    const mo = parseInt(today.slice(5, 7));
    const year = parseInt(today.slice(0, 4));
    const seasonEnd = mo >= 9 ? year + 1 : year;
    const code = `${competition}${seasonEnd}`;
    const url = `https://${EURO_HOST}/v2/competitions/${competition}/seasons/${code}/games`;
    const d = getJSON(url);
    const fixtures = [];
    for (const g of (d.data || [])) {
      const gDate = (g.utcDate || g.date || '').slice(0, 10);
      if (gDate !== today) continue;
      fixtures.push({
        id: `${leagueId.slice(0,3)}${fixtures.length + 1}`,
        league: name, flag, leagueId, isNBA: false,
        home: g.homeTeam?.name || g.home?.name || '?',
        away: g.awayTeam?.name || g.away?.name || '?',
        time: g.utcDate || g.date || `${today}T20:00:00Z`,
        status: g.status || 'Scheduled',
        spreadLine: 0, totalLine: totalBase,
        H: { ortg: null, drtg: null, pace: null, net: 0, record: '?', injuries: [] },
        A: { ortg: null, drtg: null, pace: null, net: 0, record: '?', injuries: [] },
        rest: { H: 1, A: 1 },
      });
    }
    return fixtures;
  } catch (e) {
    console.warn(`  [WARN] Euroliga ${name}: ${e.message.slice(0, 80)}`);
    return [];
  }
}

/* ===== DEDUPLICAR por nombre de equipos ===== */
function dedup(list) {
  const seen = new Set();
  return list.filter(f => {
    const k = normName(f.home) + '|' + normName(f.away);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/* ===== ENRIQUECER FIXTURES NBA con ORtg/DRtg/Pace ===== */
function enrichWithAdvanced(fixtures, statsMap) {
  if (Object.keys(statsMap).length === 0) return;
  for (const f of fixtures) {
    if (!f.isNBA) continue;
    const kH = normName(f.home);
    const kA = normName(f.away);
    // Buscar match parcial (ej: "Lakers" en "Los Angeles Lakers")
    const findStats = (key) => {
      if (statsMap[key]) return statsMap[key];
      for (const [k, v] of Object.entries(statsMap)) {
        if (k.includes(key) || key.includes(k)) return v;
      }
      return null;
    };
    const sH = findStats(kH);
    const sA = findStats(kA);
    if (sH) { f.H.ortg = sH.ortg; f.H.drtg = sH.drtg; f.H.pace = sH.pace; f.H.net = sH.net ?? f.H.net; }
    if (sA) { f.A.ortg = sA.ortg; f.A.drtg = sA.drtg; f.A.pace = sA.pace; f.A.net = sA.net ?? f.A.net; }
    if (sH && sA) {
      // Recalcular spread con net ratings reales
      f.spreadLine = roundHalf(f.H.net - f.A.net + 2.5);
    }
  }
}

/* ===== MAIN ===== */
async function main() {
  const outFile = process.argv[2] ||
    path.join(__dirname, '..', 'basketball_data.json');
  const today = new Date().toLocaleString('en-CA', { timeZone: 'Europe/Madrid' }).slice(0, 10);

  console.log(`[fetch] BaloncestoIQ — partidos reales ${today}`);

  const allFixtures = [];

  // ESPN (NBA + ligas europeas)
  for (const lg of ESPN_LEAGUES) {
    const f = fetchESPN(lg);
    console.log(`  ESPN ${lg.name}: ${f.length} juegos`);
    allFixtures.push(...f);
  }

  // Euroliga API oficial (complemento si ESPN no la cubre)
  if (allFixtures.filter(f => f.leagueId === 'euro').length === 0) {
    const f = fetchEuroliga(today, 'E', 'Euroliga', '🌍', 'euro', 162.0);
    console.log(`  Euroliga API: ${f.length} juegos`);
    allFixtures.push(...f);
  }
  if (allFixtures.filter(f => f.leagueId === 'eurocup').length === 0) {
    const f = fetchEuroliga(today, 'U', 'EuroCup', '🌍', 'eurocup', 160.0);
    console.log(`  EuroCup API: ${f.length} juegos`);
    allFixtures.push(...f);
  }

  // Filtrar por fecha Madrid y deduplicar
  const fixtures = dedup(allFixtures.filter(f => {
    if (!f.time) return false;
    const fDay = new Date(f.time).toLocaleString('en-CA', { timeZone: 'Europe/Madrid' }).slice(0, 10);
    return fDay === today;
  }));

  console.log(`\n[fetch] Total partidos de hoy: ${fixtures.length}`);

  // Enriquecer con ORtg/DRtg/Pace de stats.nba.com
  if (fixtures.some(f => f.isNBA)) {
    console.log('\n[fetch] Obteniendo Advanced Stats NBA...');
    const nbaStats = await fetchNBAAdvanced();
    enrichWithAdvanced(fixtures, nbaStats);
    const enriched = fixtures.filter(f => f.isNBA && f.H.ortg != null).length;
    console.log(`  ${enriched} partidos NBA enriquecidos con ORtg/DRtg/Pace`);
  }

  fixtures.forEach((f, i) => {
    const ortgStr = f.H.ortg ? ` ORtg:${f.H.ortg}/${f.A.ortg}` : '';
    console.log(`  ${i+1}. [${f.league}] ${f.away} @ ${f.home} | H:${f.H.record} A:${f.A.record}${ortgStr}`);
  });

  // Leer datos existentes
  let existing = { updated: today, fixtures: [], picks: [], combos: [] };
  try { existing = JSON.parse(fs.readFileSync(outFile, 'utf8')); } catch {}
  existing.updated  = today;
  existing.fixtures = fixtures;
  fs.writeFileSync(outFile, JSON.stringify(existing, null, 2));
  console.log(`\n✓ ${fixtures.length} fixtures escritos en ${path.basename(outFile)}`);
}

main().catch(e => { console.error('[FATAL]', e.message); process.exit(1); });
