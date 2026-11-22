#!/usr/bin/env node
'use strict';

const fs = require('fs');

const PRM = {
  VERSION: '5.0', N: 100000, UMBRAL: 0.80, TOP: 8,
  MIN_P: 5, MIN_ODDS: 1.10,
};

const BANNED = new Set(['btts_no']);

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
  const N = PRM.N, half = N / 2, r = rng(seed ^ 0xDEAD);
  let c1=0,cX=0,c2=0,c15=0,c25=0,cBT=0,c35=0,c0=0;
  for (let i = 0; i < half; i++) {
    const u1 = r(), u2 = r();
    [[poisInv(u1,lh),poisInv(u2,la)],[poisInv(1-u1,lh),poisInv(1-u2,la)]].forEach(([gh,ga]) => {
      const t = gh + ga;
      if (gh > ga) c1++; else if (gh === ga) cX++; else c2++;
      if (t > 1.5) c15++; if (t > 2.5) c25++; if (t > 3.5) c35++; if (t === 0) c0++;
      if (gh > 0 && ga > 0) cBT++;
    });
  }
  return {
    p1:c1/N, pX:cX/N, p2:c2/N, BTTS:cBT/N,
    'G+1.5':c15/N,'G-1.5':1-c15/N,'G+2.5':c25/N,'G-2.5':1-c25/N,
    'G+3.5':c35/N,'G-3.5':1-c35/N,'G-0.5':c0/N,'G+0.5':1-c0/N,
  };
}
function impliedOdds(p) {
  return p<=0||p>=1?1.01:Math.round((1/p)*0.95*100)/100;
}
function allMkts(R) {
  const mc = R.mc;
  return [
    {code:'1',label:'Victoria Local',p:mc.p1},
    {code:'X',label:'Empate',p:mc.pX},
    {code:'2',label:'Victoria Visitante',p:mc.p2},
    {code:'g15p',label:'Más 1.5 Goles',p:mc['G+1.5']},
    {code:'g25p',label:'Más 2.5 Goles',p:mc['G+2.5']},
    {code:'g15m',label:'Menos 1.5 Goles',p:mc['G-1.5']},
    {code:'g25m',label:'Menos 2.5 Goles',p:mc['G-2.5']},
    {code:'btts',label:'BTTS Sí',p:mc.BTTS},
    {code:'g35p',label:'Más 3.5 Goles',p:mc['G+3.5']},
    {code:'g35m',label:'Menos 3.5 Goles',p:mc['G-3.5']},
    {code:'g05m',label:'Sin Goles',p:mc['G-0.5']},
  ].map(m=>({...m,odds:impliedOdds(m.p)}))
   .filter(m=>m.p>0.01&&m.p<0.99&&m.odds>=PRM.MIN_ODDS&&!BANNED.has(m.code));
}
function stability(hist) {
  if (!hist||hist.length<3) return 0.5;
  const diffs = hist.slice(0,8).map(x=>x.gf-x.ga);
  const mu = diffs.reduce((a,v)=>a+v,0)/diffs.length;
  const v = diffs.reduce((a,v)=>a+(v-mu)**2,0)/diffs.length;
  return Math.max(0,1-Math.sqrt(v)/3);
}
function pscore(mkt, R) {
  const stab=stability(R.hH||[]),rel=Math.min(1,(R.hH||[]).length/PRM.MIN_P);
  const ob=mkt.odds>=PRM.MIN_ODDS?0.02:0;
  return mkt.p+0.05*stab+0.03*rel+ob;
}
function mktFamily(code) {
  if (code==='1'||code==='X'||code==='2') return '1x2';
  if (['g25p','g25m','g15p','g15m','g35p','g35m'].includes(code)) return 'goles';
  return 'btts';
}
function normTeam(n) {
  return (n||'').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g,'')
    .replace(/\b(fc|cf|sc|afc|bfc|ac|ss|as|ud|rc|sd|cd|rb|vfb|vfl|bvb)\b/g,'')
    .replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
}
function statzKey(h,a) { return normTeam(h)+'|'+normTeam(a); }
function hashStr(s) {
  let h=0xDEADBEEF;
  for(let i=0;i<s.length;i++){h=Math.imul(h^s.charCodeAt(i),0x9e3779b9);h^=h>>>16;}
  return h>>>0;
}
function todayMadrid() {
  return new Date().toLocaleString('en-CA',{timeZone:'Europe/Madrid'}).slice(0,10);
}
function buildCombos(picks) {
  if (picks.length < 3) return [];
  const combos = [];
  for (let i=0;i<Math.min(picks.length,6);i++) {
    for (let j=i+1;j<Math.min(picks.length,6);j++) {
      for (let k=j+1;k<Math.min(picks.length,6);k++) {
        const pa=picks[i],pb=picks[j],pc=picks[k];
        const getAlt = p => p.markets.filter(m=>m.code!==p.bestMkt.code&&m.p>=0.62&&!BANNED.has(m.code))[0]||(p.bestMkt.p>=0.70?p.bestMkt:null);
        const ma=getAlt(pa),mb=getAlt(pb),mc2=getAlt(pc);
        if(!ma||!mb||!mc2) continue;
        const pComb=ma.p*mb.p*mc2.p;
        if(pComb<0.35) continue;
        combos.push({
          name:`Combinado ${combos.length+1}`,
          pComb,oddsComb:parseFloat((ma.odds*mb.odds*mc2.odds).toFixed(2)),
          picks:[
            {match:`${pa.home} vs ${pa.away}`,label:ma.label,p:ma.p,odds:ma.odds},
            {match:`${pb.home} vs ${pb.away}`,label:mb.label,p:mb.p,odds:mb.odds},
            {match:`${pc.home} vs ${pc.away}`,label:mc2.label,p:mc2.p,odds:mc2.odds},
          ]
        });
        if(combos.length>=10) break;
      }
      if(combos.length>=10) break;
    }
    if(combos.length>=10) break;
  }
  combos.sort((a,b)=>b.pComb-a.pComb);
  return combos.slice(0,2);
}

function main() {
  const statzFile = process.argv[2]||'statz_data.json';
  const data = JSON.parse(fs.readFileSync(statzFile,'utf8'));
  const cache = data.cache||{};
  const fixtures = data.fixtures||[];
  const today = todayMadrid();
  const W = 0.65;
  const results = [];

  for (const fix of fixtures) {
    const sfDay = fix.time
      ? new Date(fix.time).toLocaleString('en-CA',{timeZone:'Europe/Madrid'}).slice(0,10)
      : today;
    if(sfDay!==today) continue;

    const k = statzKey(fix.home,fix.away);
    const sd = cache[k]||{};
    const lh = sd.xGH||(sd.winH?(sd.winH>0.5?1.9:1.3):1.5);
    const la = sd.xGA||(sd.winA?(sd.winA>0.5?1.9:1.0):1.0);

    const seed = hashStr((fix.home+fix.away).toLowerCase());
    const mc = runMC(lh,la,seed);

    if(sd.winH!==undefined){mc.p1=mc.p1*(1-W)+sd.winH*W;}
    if(sd.winA!==undefined){mc.p2=mc.p2*(1-W)+sd.winA*W;}
    if(sd.btts!==undefined){mc.BTTS=mc.BTTS*(1-W)+sd.btts*W;}
    if(sd.goals2p!==undefined){mc['G+2.5']=mc['G+2.5']*(1-W)+sd.goals2p*W;}
    if(sd.goals3p!==undefined){mc['G+1.5']=mc['G+1.5']*(1-W)+Math.min(sd.goals3p+0.12,0.99)*W;}
    mc['G-1.5']=1-mc['G+1.5'];mc['G-2.5']=1-mc['G+2.5'];
    const tot=mc.p1+mc.pX+mc.p2;if(tot>0){mc.p1/=tot;mc.pX/=tot;mc.p2/=tot;}

    const R={mc,lh,la,ppgH:1.5,ppgA:1.0,hH:[],hA:[]};
    const mkts=allMkts(R);mkts.sort((a,b)=>pscore(b,R)-pscore(a,R));
    if(!mkts.length) continue;
    const best=mkts[0];
    const sc=pscore(best,R);
    if(sc<PRM.UMBRAL) continue;
    results.push({...fix,R,markets:mkts,bestMkt:best,score:sc,dataQ:0,statz:true});
  }

  results.sort((a,b)=>b.score-a.score);
  const famC={},divP=[];
  for(const r of results){
    const f=mktFamily(r.bestMkt.code);
    if((famC[f]||0)<2){famC[f]=(famC[f]||0)+1;divP.push(r);}
    if(divP.length>=PRM.TOP) break;
  }
  const finalPicks = divP.length>=PRM.TOP?divP:results.slice(0,PRM.TOP);
  const combos = buildCombos(finalPicks);

  data.picks = finalPicks;
  data.combos = combos;
  data.updated = today;
  fs.writeFileSync(statzFile,JSON.stringify(data,null,2));
  console.log(`✓ ${finalPicks.length} picks, ${combos.length} combinados generados para ${today}`);
  if(finalPicks.length){
    finalPicks.forEach((p,i)=>console.log(`  ${i+1}. ${p.home} vs ${p.away} → ${p.bestMkt.label} @${p.bestMkt.odds} (${(p.bestMkt.p*100).toFixed(1)}%)`));
  }
}

main();
