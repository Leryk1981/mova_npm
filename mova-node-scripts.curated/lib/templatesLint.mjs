import fs from 'fs'; import path from 'path';
const ALLOWED = new Set(['http_fetch','set','assert','emit_event','log','sleep']);
function listJsonFiles(dir){ const out=[]; for(const e of fs.readdirSync(dir)){
  const p=path.join(dir,e); const s=fs.statSync(p);
  if(s.isDirectory()) out.push(...listJsonFiles(p)); else if(e.endsWith('.json')) out.push(p);
} return out; }
export default function templatesLint({dir}){
  let problems=0;
  for(const f of listJsonFiles(dir)){
    const j=JSON.parse(fs.readFileSync(f,'utf-8'));
    if(Array.isArray(j.actions)){
      j.actions.forEach((a,i)=>{
        if(!ALLOWED.has(a.type)){ console.error(`[${f}] actions[${i}].type="${a.type}" not allowed`); problems++; }
        if(a.type==='http_fetch'){
          if('url' in a){  console.error(`[${f}] actions[${i}] uses url (use endpoint)`); problems++; }
          if('body' in a){ console.error(`[${f}] actions[${i}] uses body (use payload)`); problems++; }
        }
      });
    }
  }
  if(problems===0) console.log('Templates lint OK');
  return problems?1:0;
}
