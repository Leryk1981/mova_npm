import fs from 'fs'; import { loadValidators } from './loadAjv.mjs';
export default function validateRoute({file,schemasDir}){
  const { validateRoute } = loadValidators(schemasDir);
  const data = JSON.parse(fs.readFileSync(file,'utf-8'));
  const ok = validateRoute(data);
  if(ok){ console.log(`OK route: ${file}`); return 0; }
  console.error(`INVALID route: ${file}`);
  console.error(JSON.stringify(validateRoute.errors,null,2));
  return 1;
}
