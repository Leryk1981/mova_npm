import fs from 'fs'; import path from 'path';
export function readJSON(p){return JSON.parse(fs.readFileSync(p,'utf-8'));}
export function listJsonFiles(dir){const out=[]; for(const e of fs.readdirSync(dir)){const p=path.join(dir,e); const s=fs.statSync(p); if(s.isDirectory()) out.push(...listJsonFiles(p)); else if(e.endsWith('.json')) out.push(p);} return out;}
