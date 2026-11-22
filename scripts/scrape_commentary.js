#!/usr/bin/env node
/**
 * scrape_commentary.js — FútbolIQ v5.0
 * Extrae pronósticos de fuentes secundarias para los picks del día.
 * Uso: node scrape_commentary.js <picks.json> [output.json]
 * picks.json: [{home, away}]
 * Salida: { "home_key|away_key": [{src, type, val, prob, note}] }
 */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');

// ── normalizar nombre de equipo (igual que futboliq.html) ──
function normTeam(n) {
  return (n || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\b(fc|cf|sc|afc|bfc|ac|ss|as|ud|rc|sd|cd|rb|vfb|vfl|bvb)\b/g, '')
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}
function key(h, a) { return normTeam(h) + '|' + normTeam(a); }

// Levenshtein rápido
function lev(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
  return dp[m][n];
}
function similarity(a, b) {
  const na = normTeam(a), nb = normTeam(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.9;
  const d = lev(na, nb);
  return 1 - d / Math.max(na.length, nb.length);
}
function bestMatch(name, candidates) {
  let best = null, bestScore = 0;
  for (const c of candidates) {
    const s = similarity(name, c);
    if (s > bestScore) { bestScore = s; best = c; }
  }
  return bestScore >= 0.65 ? best : null;
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const TIMEOUT = 20000;

// ── FOREBET ──
async function scrapeForebet(ctx, matches) {
  const results = {};
  const page = await ctx.newPage();
  try {
    await page.goto('https://www.forebet.com/en/football-tips-and-predictions/', { timeout: TIMEOUT, waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const rows = await page.$$eval('.rcnt,.tr_0,.tr_1', els => els.map(el => {
      const teams = el.querySelector('.homeTeam,.home_name,.ht')?.innerText?.trim();
      const awayTeam = el.querySelector('.awayTeam,.away_name,.at')?.innerText?.trim();
      const pred = el.querySelector('.forepr,.predict')?.innerText?.trim();
      const prob = el.querySelector('.fpr,.prob')?.innerText?.trim();
      const ou = el.querySelector('.ou25,.ou')?.innerText?.trim();
      return { teams, awayTeam, pred, prob, ou };
    }));
    for (const r of rows) {
      if (!r.teams) continue;
      const parts = r.teams.split(/\s+-\s+|\s+vs\s+/i);
      const hName = parts[0]?.trim() || r.teams;
      const aName = r.awayTeam || parts[1]?.trim() || '';
      for (const m of matches) {
        const mh = bestMatch(m.home, [hName]);
        const ma = bestMatch(m.away, [aName]);
        if (mh && ma) {
          const k = key(m.home, m.away);
          if (!results[k]) results[k] = [];
          if (r.pred) results[k].push({ src: 'Forebet', type: '1X2', val: r.pred, prob: r.prob || '', note: r.ou || '' });
        }
      }
    }
  } catch (e) { console.warn(`[WARN] Forebet: ${e.message}`); }
  await page.close();
  return results;
}

// ── SPORTS MOLE ──
async function scrapeSportsMole(ctx, matches) {
  const results = {};
  const page = await ctx.newPage();
  try {
    await page.goto('https://www.sportsmole.co.uk/football/predictions/', { timeout: TIMEOUT, waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const articles = await page.$$eval('article,div.ipsType_normal,.article-box', els => els.slice(0, 40).map(el => ({
      title: el.querySelector('h2,h3,.article-title')?.innerText?.trim() || '',
      pred: el.querySelector('.prediction,.verdict,.our-pred')?.innerText?.trim() || '',
      href: el.querySelector('a')?.href || '',
    })));
    for (const art of articles) {
      if (!art.title) continue;
      for (const m of matches) {
        const inTitle = (t, name) => t.toLowerCase().includes(normTeam(name).replace(/ /g, ''));
        if ((inTitle(art.title, m.home) || similarity(m.home, art.title) > 0.5) &&
            (inTitle(art.title, m.away) || similarity(m.away, art.title) > 0.5)) {
          const k = key(m.home, m.away);
          if (!results[k]) results[k] = [];
          const pred = art.pred || 'Ver análisis';
          results[k].push({ src: 'Sports Mole', type: 'Análisis', val: pred.slice(0, 40), prob: '', note: '' });
        }
      }
    }
  } catch (e) { console.warn(`[WARN] SportsMole: ${e.message}`); }
  await page.close();
  return results;
}

// ── APWIN ──
async function scrapeAPWin(ctx, matches) {
  const results = {};
  const page = await ctx.newPage();
  try {
    await page.goto('https://www.apwin.com/predictions/', { timeout: TIMEOUT, waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const rows = await page.$$eval('table tr,div.prediction-row,.pred-row', els => els.map(el => {
      const cells = el.querySelectorAll('td,.cell');
      const texts = Array.from(cells).map(c => c.innerText?.trim());
      return texts;
    }));
    for (const cells of rows) {
      if (cells.length < 3) continue;
      for (const m of matches) {
        const rowText = cells.join(' ').toLowerCase();
        if ((rowText.includes(normTeam(m.home)) || similarity(m.home, cells.join(' ')) > 0.5) &&
            (rowText.includes(normTeam(m.away)) || similarity(m.away, cells.join(' ')) > 0.5)) {
          const k = key(m.home, m.away);
          if (!results[k]) results[k] = [];
          const pred = cells[2] || cells[1] || '';
          const prob = cells[3] || '';
          if (pred) results[k].push({ src: 'APWin', type: 'Pick', val: pred.slice(0, 40), prob: prob.slice(0, 8), note: '' });
          break;
        }
      }
    }
  } catch (e) { console.warn(`[WARN] APWin: ${e.message}`); }
  await page.close();
  return results;
}

// ── GOALENCE ──
async function scrapeGoalence(ctx, matches) {
  const results = {};
  const page = await ctx.newPage();
  try {
    await page.goto('https://goalence.com/predictions/', { timeout: TIMEOUT, waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const rows = await page.$$eval('.match-row,.prediction-item,table tr', els => els.map(el => ({
      text: el.innerText?.trim() || '',
      pred: el.querySelector('.pred,.outcome,.result')?.innerText?.trim() || '',
      prob: el.querySelector('.prob,.probability,.pct')?.innerText?.trim() || '',
    })));
    for (const r of rows) {
      if (!r.text) continue;
      const nt = r.text.toLowerCase();
      for (const m of matches) {
        if (nt.includes(normTeam(m.home)) && nt.includes(normTeam(m.away))) {
          const k = key(m.home, m.away);
          if (!results[k]) results[k] = [];
          if (r.pred) results[k].push({ src: 'Goalence', type: 'Pi-Rating', val: r.pred.slice(0, 40), prob: r.prob || '', note: '' });
        }
      }
    }
  } catch (e) { console.warn(`[WARN] Goalence: ${e.message}`); }
  await page.close();
  return results;
}

// ── KQBD ──
async function scrapeKqbd(ctx, matches) {
  const results = {};
  const page = await ctx.newPage();
  try {
    await page.goto('https://kqbd.mobi/du-doan-bong-da', { timeout: TIMEOUT, waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const rows = await page.$$eval('.prediction,.match-item,table tr', els => els.map(el => ({
      text: el.innerText?.trim() || '',
      pred: el.querySelector('.bet,.pick')?.innerText?.trim() || '',
      odds: el.querySelector('.odds,.keo')?.innerText?.trim() || '',
    })));
    for (const r of rows) {
      if (!r.text) continue;
      const nt = r.text.toLowerCase();
      for (const m of matches) {
        if (nt.includes(normTeam(m.home)) && nt.includes(normTeam(m.away))) {
          const k = key(m.home, m.away);
          if (!results[k]) results[k] = [];
          if (r.pred) results[k].push({ src: 'Kqbd', type: 'Hándicap', val: r.pred.slice(0, 40), prob: r.odds || '', note: '' });
        }
      }
    }
  } catch (e) { console.warn(`[WARN] Kqbd: ${e.message}`); }
  await page.close();
  return results;
}

async function main() {
  const picksFile = process.argv[2];
  const outFile = process.argv[3];
  if (!picksFile) { console.error('Uso: node scrape_commentary.js <picks.json> [output.json]'); process.exit(1); }
  const matches = JSON.parse(fs.readFileSync(picksFile, 'utf8'));
  if (!matches.length) { console.log('{}'); return; }

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const ctx = await browser.newContext({
    userAgent: UA,
    extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9,es;q=0.8' },
  });

  const scrapers = [
    scrapeForebet,
    scrapeSportsMole,
    scrapeAPWin,
    scrapeGoalence,
    scrapeKqbd,
  ];

  const combined = {};
  for (const scraper of scrapers) {
    try {
      const r = await scraper(ctx, matches);
      for (const [k, entries] of Object.entries(r)) {
        if (!combined[k]) combined[k] = [];
        combined[k].push(...entries);
      }
    } catch (e) { console.warn(`[WARN] scraper failed: ${e.message}`); }
    await new Promise(r => setTimeout(r, 800)); // pausa cortés entre fuentes
  }

  await browser.close();

  const out = JSON.stringify(combined, null, 2);
  if (outFile) { fs.writeFileSync(outFile, out); console.log(`Guardado en ${outFile}`); }
  else { console.log(out); }
}

main().catch(e => { console.error(e.message); process.exit(1); });
