import fs from 'fs'; import path from 'path'; import crypto from 'crypto';
import { listJsonFiles } from './util.mjs';
function canonicalJSON(obj){ return JSON.stringify(sortKeys(obj)); }
function sortKeys(x){ if(Array.isArray(x)) return x.map(sortKeys);
  if(x && typeof x==='object') return Object.fromEntries(Object.keys(x).sort().map(k=>[k, sortKeys(x[k]) ]));
  return x; }
export default async function schemaFingerprint({schemasDir,out}){
  const files = listJsonFiles(schemasDir); const entries=[];
  for(const p of files){
    const j = JSON.parse(fs.readFileSync(p,'utf-8'));
    const canon = canonicalJSON(j);
    const hash = crypto.createHash('sha256').update(Buffer.from(canon)).digest('hex');
    entries.push({ file: path.relative(schemasDir, p), sha256: hash });
  }
  entries.sort((a,b)=>a.file.localeCompare(b.file));
  const payload = { version:'1', generated_at:new Date().toISOString(), entries };
  if(out) fs.writeFileSync(out, JSON.stringify(payload,null,2));
  console.log(JSON.stringify(payload,null,2));
  return 0;
}
