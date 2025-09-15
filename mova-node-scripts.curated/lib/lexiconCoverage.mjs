import fs from 'fs';
export default function lexiconCoverage({lexicon,frames}){
  const L=JSON.parse(fs.readFileSync(lexicon,'utf-8'));
  const F=JSON.parse(fs.readFileSync(frames,'utf-8'));
  const framesSet=new Set(Object.keys(F?.messages ?? F ?? {}));
  const lexSet=new Set(Object.keys(L));
  const missing=[...framesSet].filter(k=>!lexSet.has(k));
  const extra=[...lexSet].filter(k=>!framesSet.has(k));
  const rep={ total_frames: framesSet.size, total_lexicon: lexSet.size, missing, extra };
  console.log(JSON.stringify(rep,null,2));
  return missing.length?1:0;
}
