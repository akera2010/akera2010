#!/usr/bin/env node
'use strict';
/**
 * fetch_baseball_fixtures.js
 * Obtiene partidos reales de MLB Stats API (statsapi.mlb.com) — gratuita, sin auth.
 * Cubre: LVBP, LMP, LIDOM, LBPRC (Puerto Rico).
 * NO contiene datos hardcodeados: si la API no devuelve juegos, no hay fixtures.
 *
 * Uso: node scripts/fetch_baseball_fixtures.js [baseball_data.json] [YYYY-MM-DD]
 */

const http  = require('http');
const tls   = require('tls');
const fs    = require('fs');
const path  = require('path');

/* ===== CONFIGURACIÓN ===== */
const BASE = 'statsapi.mlb.com';
const SPORT_ID_WINTER = 17;

const LEAGUE_MAP = {
  135: { name: 'LVBP',   flag: '🇻🇪', leagueId: 'ven.1',  lgAvg: 4.2 },
  131: { name: 'LIDOM',  flag: '🇩🇴', leagueId: 'dom.1',  lgAvg: 4.4 },
  132: { name: 'LMP',    flag: '🇲🇽', leagueId: 'mex.1',  lgAvg: 4.3 },
  133: { name: 'LBPRC',  flag: '🇵🇷', leagueId: 'pri.1',  lgAvg: 4.2 },
};

const SKIP_STATUSES = new Set([
  'Suspended', 'Cancelled', 'Postponed', 'Final', 'Completed Early',
  'Game Over', 'Completed', 'Delayed: Rain', 'Suspended: Rain',
]);

/* ===== HTTP HELPER (túnel CONNECT via proxy) ===== */
const CA_BUNDLE  = '/root/.ccr/ca-bundle.crt';
const _proxyUrl  = process.env.HTTPS_PROXY || process.env.https_proxy || 'http://127.0.0.1:39645';
const _proxyM    = _proxyUrl.match(/:\/\/([^:]+):(\d+)/);
const PROXY_HOST = _proxyM ? _proxyM[1] : '127.0.0.1';
const PROXY_PORT = _proxyM ? +_proxyM[2] : 39645;

function getJSON(urlPath) {
  return new Promise((resolve, reject) => {
    const target = `${BASE}:443`;
    const connectReq = http.request({
      host: PROXY_HOST, port: PROXY_PORT,
      method: 'CONNECT', path: target,
      headers: { Host: target },
    });
    const timer = setTimeout(() => { connectReq.destroy(); reject(new Error('Timeout CONNECT')); }, 20000);

    connectReq.on('connect', (res, socket) => {
      if (res.statusCode !== 200) {
        clearTimeout(timer);
        return reject(new Error(`Proxy CONNECT failed: ${res.statusCode}`));
      }
      let caBundle;
      try { caBundle = fs.readFileSync(CA_BUNDLE); } catch {}

      const tlsOpts = { host: BASE, socket, servername: BASE };
      if (caBundle) tlsOpts.ca = caBundle;

      const tlsSock = tls.connect(tlsOpts, () => {
        const req = [
          `GET ${urlPath} HTTP/1.1`,
          `Host: ${BASE}`,
          'User-Agent: BeisbolIQ/2.0',
          'Connection: close',
          '', '',
        ].join('\r\n');
        tlsSock.write(req);
      });

      let raw = '';
      tlsSock.on('data', c => { raw += c; });
      tlsSock.on('end', () => {
        clearTimeout(timer);
        try {
          const body = raw.split('\r\n\r\n').slice(1).join('\r\n\r\n').trim();
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error(`JSON parse error: ${e.message}\nRaw: ${raw.slice(0, 200)}`));
        }
      });
      tlsSock.on('error', e => { clearTimeout(timer); reject(e); });
    });

    connectReq.on('error', e => { clearTimeout(timer); reject(e); });
    connectReq.end();
  });
}

/* ===== ERA POR EQUIPO ===== */
async function fetchTeamEra(teamId) {
  try {
    const d = await getJSON(
      `/api/v1/teams/${teamId}/stats?stats=season&group=pitching&season=2026&sportId=${SPORT_ID_WINTER}`
    );
    const splits = (d.stats || [])[0]?.splits?.[0]?.stat || {};
    return splits.era ? parseFloat(splits.era) : null;
  } catch {
    return null;
  }
}

/* ===== SCHEDULE ===== */
async function fetchSchedule(date) {
  const hydrate = 'team,linescore,probablePitcher';
  const d = await getJSON(
    `/api/v1/schedule?sportId=${SPORT_ID_WINTER}&date=${date}&hydrate=${hydrate}`
  );
  const games = [];
  for (const dateBlock of (d.dates || [])) {
    for (const g of (dateBlock.games || [])) {
      const leagueId = g.teams?.home?.team?.league?.id;
      if (!LEAGUE_MAP[leagueId]) continue;
      if (SKIP_STATUSES.has(g.status?.detailedState)) continue;

      const home = g.teams.home;
      const away = g.teams.away;
      const lg   = LEAGUE_MAP[leagueId];

      games.push({
        gamePk:    g.gamePk,
        leagueNum: leagueId,
        league:    lg.name,
        flag:      lg.flag,
        leagueId:  lg.leagueId,
        lgAvg:     lg.lgAvg,
        home:      home.team.name,
        away:      away.team.name,
        homeId:    home.team.id,
        awayId:    away.team.id,
        time:      g.gameDate,
        status:    g.status?.detailedState || 'Scheduled',
        pitcherH:  home.probablePitcher?.fullName || null,
        pitcherA:  away.probablePitcher?.fullName || null,
        winsH:     home.leagueRecord?.wins ?? null,
        lossesH:   home.leagueRecord?.losses ?? null,
        winsA:     away.leagueRecord?.wins ?? null,
        lossesA:   away.leagueRecord?.losses ?? null,
      });
    }
  }
  return games;
}

/* ===== PYTHAGOREAN WIN PROB ===== */
function pythagWin(wH, lH, wA, lA) {
  if (wH == null || lH == null || wA == null || lA == null) return null;
  const gpH = wH + lH, gpA = wA + lA;
  if (gpH === 0 || gpA === 0) return null;
  const wpH = wH / gpH, wpA = wA / gpA;
  return Math.max(0.05, Math.min(0.95, (wpH + 0.04) / (wpH + wpA + 0.08)));
}

/* ===== CONSTRUCCIÓN DE CACHE ===== */
function normTeam(n) {
  return (n || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

/* ===== MAIN ===== */
async function main() {
  const outFile = process.argv[2] || path.join(__dirname, '..', 'baseball_data.json');
  const today   = process.argv[3] ||
    new Date().toLocaleString('en-CA', { timeZone: 'Europe/Madrid' }).slice(0, 10);

  console.log(`[fetch] Buscando partidos para ${today} en MLB Stats API...`);

  let games;
  try {
    games = await fetchSchedule(today);
  } catch (e) {
    console.error(`[ERROR] No se pudo conectar a statsapi.mlb.com: ${e.message}`);
    process.exit(1);
  }

  if (!games.length) {
    console.log(`[fetch] Sin partidos encontrados para ${today} en ligas del Caribe.`);
    // Actualiza solo la fecha en fixtures, no borra picks existentes
    const existing = JSON.parse(fs.readFileSync(outFile, 'utf8'));
    existing.fixtures = [];
    existing.updated = today;
    fs.writeFileSync(outFile, JSON.stringify(existing, null, 2), 'utf8');
    return;
  }

  console.log(`[fetch] ${games.length} partidos encontrados. Obteniendo ERA de equipos...`);

  // Obtener ERA de todos los equipos únicos
  const teamIds = [...new Set(games.flatMap(g => [g.homeId, g.awayId]))];
  const eraMap = {};
  await Promise.all(teamIds.map(async id => {
    if (id) eraMap[id] = await fetchTeamEra(id);
  }));

  // Leer datos existentes para mantener cache
  let existing = { updated: today, cache: {}, fixtures: [], picks: [], combos: [] };
  try { existing = JSON.parse(fs.readFileSync(outFile, 'utf8')); } catch {}

  // Construir nuevos fixtures y actualizar cache
  const fixtures = [];
  for (const g of games) {
    const id = `${g.leagueId.slice(0,3)}${fixtures.length + 1}`;
    const teamEraH = eraMap[g.homeId] ?? null;
    const teamEraA = eraMap[g.awayId] ?? null;
    const pHome = pythagWin(g.winsH, g.lossesH, g.winsA, g.lossesA);

    fixtures.push({
      id, league: g.league, flag: g.flag, leagueId: g.leagueId,
      home: g.home, away: g.away, time: g.time, status: g.status,
    });

    const cacheKey = `${normTeam(g.home)}|${normTeam(g.away)}`;
    const lgAvg = g.lgAvg;
    existing.cache[cacheKey] = {
      ...(existing.cache[cacheKey] || {}),
      winH:    pHome ?? (existing.cache[cacheKey]?.winH || 0.5),
      winA:    pHome != null ? +(1 - pHome).toFixed(4) : (existing.cache[cacheKey]?.winA || 0.5),
      xRH:     existing.cache[cacheKey]?.xRH || lgAvg,
      xRA:     existing.cache[cacheKey]?.xRA || lgAvg,
      total:   existing.cache[cacheKey]?.total || lgAvg * 2,
      teamEraH: teamEraH,
      teamEraA: teamEraA,
      pitcherH: g.pitcherH ? { name: g.pitcherH, era: null } : (existing.cache[cacheKey]?.pitcherH || null),
      pitcherA: g.pitcherA ? { name: g.pitcherA, era: null } : (existing.cache[cacheKey]?.pitcherA || null),
      recordH:  g.winsH != null ? `${g.winsH}-${g.lossesH}` : null,
      recordA:  g.winsA != null ? `${g.winsA}-${g.lossesA}` : null,
    };
  }

  existing.updated  = today;
  existing.fixtures = fixtures;

  fs.writeFileSync(outFile, JSON.stringify(existing, null, 2), 'utf8');

  console.log(`\n✓ ${fixtures.length} fixtures escritos en ${outFile}:`);
  fixtures.forEach((f, i) => {
    const c = existing.cache[`${normTeam(f.home)}|${normTeam(f.away)}`] || {};
    const eraH = c.teamEraH != null ? `ERA ${c.teamEraH}` : '—';
    const eraA = c.teamEraA != null ? `ERA ${c.teamEraA}` : '—';
    const rec  = c.recordH ? `${c.recordH} vs ${c.recordA}` : '?-? vs ?-?';
    console.log(`  ${i+1}. [${f.league}] ${f.home} (${eraH}) vs ${f.away} (${eraA})  ${rec}  ${f.time.slice(11,16)}Z`);
  });
}

main().catch(e => { console.error('[FATAL]', e.message); process.exit(1); });
