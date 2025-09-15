import fs from 'fs'; import { loadValidators } from './loadAjv.mjs';
export default function validatePlan({file,schemasDir}){
  const { validatePlan } = loadValidators(schemasDir);
  const data = JSON.parse(fs.readFileSync(file,'utf-8'));
  const ok = validatePlan(data);
  if(ok){ console.log(`OK plan: ${file}`); return 0; }
  console.error(`INVALID plan: ${file}`);
  console.error(JSON.stringify(validatePlan.errors,null,2));
  return 1;
}
