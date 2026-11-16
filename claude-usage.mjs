// Read account limits through Claude Code's own /usage command. No credential access.
import { providerEnv } from './provider-auth.mjs';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
let cache, pending;
export function terminalScreen() {
  const rows = Array.from({ length: 120 }, () => Array(180).fill(' ')); let x=0,y=0,tail='';
  return { push(chunk) {
    const data=tail+chunk; tail='';
    for(let i=0;i<data.length;i++) {
      const c=data[i];
      if(c==='\x1b') {
        if(i+1>=data.length){tail=data.slice(i);break;}
        if(data[i+1]===']') { const m=data.slice(i).match(/^\x1b\][\s\S]*?(?:\x07|\x1b\\)/);if(!m){tail=data.slice(i);break;}i+=m[0].length-1;continue; }
        if(data[i+1]==='[') {
          const m=data.slice(i).match(/^\x1b\[([0-9;?<>]*)([ -\/]*)([@-~])/);if(!m){tail=data.slice(i);break;}
          const a=m[1].split(';').map(Number), n=a[0]||1, op=m[3];
          if(!/[?<>]/.test(m[1])) {
            if(op==='H'||op==='f'){y=(a[0]||1)-1;x=(a[1]||1)-1;}
            if(op==='G')x=n-1;
            if(op==='A')y-=n;if(op==='B')y+=n;if(op==='C')x+=n;if(op==='D')x-=n;
            if(op==='J'&&a[0]===2)for(const r of rows)r.fill(' ');
            if(op==='K'){const r=rows[Math.max(0,Math.min(119,y))];if(a[0]===2)r.fill(' ');else if(a[0]===1)r.fill(' ',0,x+1);else r.fill(' ',x);}
          }
          x=Math.max(0,Math.min(179,x));y=Math.max(0,Math.min(119,y));i+=m[0].length-1;continue;
        }
        i+=data[i+1]==='('||data[i+1]===')'?2:1;continue;
      }
      if(c==='\r')x=0;else if(c==='\n')y=Math.min(119,y+1);else if(c==='\b')x=Math.max(0,x-1);else if(c>=' '){rows[y][x]=c;x=Math.min(179,x+1);}
    }
    return rows.map(r=>r.join('').trimEnd()).join('\n');
  }};
}
export function parseUsageScreen(text, now = new Date()) {
  const windows=[];
  const re=/(Current session|Current week(?:\s*\(([^)]+)\))?)[^\n]*\n([\s\S]*?)(?=\n\s*Current (?:week|session)|\n\s*Extra usage|$)/g;
  for(const m of text.matchAll(re)) {
    const pct=m[3].match(/(\d+(?:\.\d+)?)%\s*used/i);if(!pct)continue;
    const name=m[1]==='Current session'?'five_hour':!m[2]||/all models/i.test(m[2])?'seven_day':'seven_day_'+m[2].toLowerCase().replace(/\W+/g,'_');
    let resetsAt=null;const reset=m[3].match(/Resets\s+(.+?)(?:\n|$)/i);
    if(reset) {
      const r=reset[1].trim().match(/(?:(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d+)\s+at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*\(([^)]+)\)/i);
      if(r){
        const zone=r[6],parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'numeric',day:'numeric',hour:'numeric',minute:'numeric',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value]));
        const month=r[1]?['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(r[1].toLowerCase())+1:+parts.month,day=r[2]?+r[2]:+parts.day,hour=+r[3]%12+(r[5].toLowerCase()==='pm'?12:0);
        let target=Date.UTC(+parts.year,month-1,day,hour,+(r[4]||0));
        for(let k=0;k<2;k++){const dt=new Date(target),local=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'numeric',day:'numeric',hour:'numeric',minute:'numeric',hourCycle:'h23'}).formatToParts(dt).map(p=>[p.type,p.value]));target-=Date.UTC(+local.year,+local.month-1,+local.day,+local.hour,+local.minute)-Date.UTC(+parts.year,month-1,day,hour,+(r[4]||0));}
        if(!r[1]&&target<now.getTime())target+=86400000;
        resetsAt=target/1000;
      }
    }
    windows.push({name,usedPercent:Math.min(100,+pct[1]),resetsAt,resetText:reset?.[1]?.trim()||null});
  }
  return windows;
}
function trustedCwd() {
  try {const c=JSON.parse(fs.readFileSync(path.join(os.homedir(),'.claude.json'),'utf8'));for(const [p,v]of Object.entries(c.projects||{}))if(v.hasTrustDialogAccepted&&fs.existsSync(p))return p;}catch{}
  return process.env.AGENT_OFFICE_CWD || os.homedir();
}
export async function claudeUsage(bin, force=false) {
  if(cache&&!force&&Date.now()-cache.time<120000)return cache.value;
  if(pending)return pending;
  if(!bin||process.platform!=='darwin')return {windows:[],source:'unknown',message:'Čtení limitů přes /usage není dostupné.'};
  pending=new Promise(resolve=>{
    const screen=terminalScreen();let timer,settled=false,settle=null,lastSig='';
    const child=spawn('/usr/bin/python3',[fileURLToPath(new URL('./scripts/claude-usage-pty.py',import.meta.url)),bin],{cwd:trustedCwd(),env:{...providerEnv('claude'),TERM:'xterm-256color',NO_COLOR:'1'},stdio:['ignore','pipe','pipe']});
    child.stdout.setEncoding('utf8');
    const finish=value=>{if(settled)return;settled=true;clearTimeout(timer);clearTimeout(settle);try{child.kill('SIGTERM');}catch{};if(value.windows.length)cache={time:Date.now(),value};resolve(value);};
    child.stdout.on('data',d=>{
      const text=screen.push(d.toString()),windows=parseUsageScreen(text);
      // /usage first paints the last cached numbers, then refreshes them from the server a moment later.
      // Only accept a reading once it has stopped changing (or the refreshed "contributing" section is on screen).
      if(windows.some(w=>w.name==='seven_day'&&w.resetText)&&windows.some(w=>w.name==='five_hour')){
        const sig=JSON.stringify(windows.map(w=>[w.name,w.usedPercent,w.resetsAt]));
        if(sig!==lastSig){lastSig=sig;clearTimeout(settle);settle=setTimeout(()=>finish({windows:parseUsageScreen(screen.push('')),source:'claude-code-usage',updated:new Date().toISOString(),message:'Skutečné využití z Claude Code /usage'}),/What.s contributing/i.test(text)?600:2500);}
      }
      else if(/usage endpoint is rate limited|Failed to load usage|Failed to fetch usage/i.test(text))finish({windows:[],source:'unknown',message:'Claude Code nyní nemůže načíst usage.'});
    });
    child.stderr.resume();child.on('error',()=>finish({windows:[],source:'unknown',message:'Claude Code /usage se nepodařilo spustit.'}));
    child.on('close',()=>finish({windows:[],source:'unknown',message:'Claude Code /usage neposkytl přehled limitů.'}));
    timer=setTimeout(()=>finish(lastSig?{windows:parseUsageScreen(screen.push('')),source:'claude-code-usage',updated:new Date().toISOString(),message:'Skutečné využití z Claude Code /usage'}:cache?{...cache.value,stale:true,message:'Poslední známé využití Claude; obnovení nyní neodpovědělo.'}:{windows:[],source:'unknown',message:'Claude Code /usage neodpověděl včas.'}),12000);
  }).finally(()=>{pending=null;});return pending;
}

/** Reset time from a limit message, e.g. "resets 2:10am (Europe/Prague)", "resets Nov 17 at 11:59pm (Europe/Prague)",
 *  "try again in 2 hours 13 minutes", "try again at 3:45 PM". Returns epoch ms or null. */
export function resetTimeFromText(text, now = new Date()) {
  const t = String(text || '');
  const rel = t.match(/\bin\s+(\d+)\s*(h\b|hours?|hod\w*|m\b|mins?|minutes?|minut\w*)(?:\s*(?:and\s+|a\s+)?(\d+)\s*(?:m\b|mins?|minutes?|minut\w*))?/i);
  if (rel) { const hours = /^h/i.test(rel[2]); return now.getTime() + ((hours ? +rel[1] * 60 : +rel[1]) + (+rel[3] || 0)) * 60000; }
  const w = parseUsageScreen(`Current session\n0% used\nResets ${(t.match(/(?:resets?|again at)\s+((?:[A-Z][a-z]{2}\s+\d+\s+at\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm)\s*(?:\([^)]+\))?)/i) || [])[1] || ''}`.replace(/(am|pm)\s*$/i, `$1 (${Intl.DateTimeFormat().resolvedOptions().timeZone})`), now);
  return w[0]?.resetsAt ? w[0].resetsAt * 1000 : null;
}
