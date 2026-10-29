import { writeFileSync, mkdirSync } from 'node:fs';
import { emptyDatabase } from '../src/lib/local-db.ts';
import { mergePersonalWorkbook } from '../src/lib/personal-import.ts';
const db=mergePersonalWorkbook(emptyDatabase());
mkdirSync('../output',{recursive:true});
writeFileSync('../output/SubMind-Prefilled-2026-10-28.json',JSON.stringify(db,null,2));
const summary=Object.fromEntries(Object.entries(db).filter(([,v])=>Array.isArray(v)).map(([k,v])=>[k,v.length]));
writeFileSync('../output/import-summary.json',JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary));
