import { registerHooks, createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const ts = require('typescript');
registerHooks({
 resolve(specifier,context,next){ if(specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)){const url=new URL(specifier+'.ts',context.parentURL);if(existsSync(fileURLToPath(url)))return {url:url.href,shortCircuit:true};}return next(specifier,context); },
 load(url,context,next){if(url.endsWith('.ts')){const source=readFileSync(fileURLToPath(url),'utf8');return {format:'module',source:ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText,shortCircuit:true};}if(url.endsWith('.json')){return {format:'module',source:'export default '+readFileSync(fileURLToPath(url),'utf8'),shortCircuit:true};}return next(url,context);}
});
