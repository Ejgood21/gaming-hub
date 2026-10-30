import {readFile, writeFile, mkdir, readdir, rename, copyFile, rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {detectSeason} from '../scraper/season.mjs';
import {scrapeWowhead} from '../scraper/wowhead.mjs';
import {scrapeArchon} from '../scraper/archon.mjs';
import {scrapeRaiderio} from '../scraper/raiderio.mjs';
import {scrapeYoutube} from '../scraper/youtube.mjs';
import {scrapeWarcraftlogs} from '../scraper/warcraftlogs.mjs';
import {cleanError, sourceResult} from '../scraper/http.mjs';

const appRoot = fileURLToPath(new URL('../',import.meta.url));
const dataRoot = path.join(appRoot,'data');
const readJSON = async file => JSON.parse(await readFile(file,'utf8'));
const existsJSON = async file => {try{return await readJSON(file);}catch(error){if(error.code==='ENOENT')return null;throw error;}};
const writeJSON = async (file,data) => {await mkdir(path.dirname(file),{recursive:true});const temp=`${file}.${randomUUID()}.tmp`;try{await writeFile(temp,JSON.stringify(data,null,2)+'\n');await rename(temp,file);}finally{await rm(temp,{force:true});}};

export function args(values) {
  const result = {};
  const supported=new Set(['allow-partial','help','finalize','raw-bundle','patch','season','expansion','season-number','patch-start']);
  for (let index=0;index<values.length;index++) {
    const arg = values[index];
    if (!arg.startsWith('--')) throw new Error(`Unexpected argument ${arg}`);
    const name = arg.slice(2);
    if(!supported.has(name))throw new Error(`Unknown option ${arg}`);
    if (['allow-partial','help'].includes(name)) result[name]=true;
    else if (values[index+1] && !values[index+1].startsWith('--')) result[name]=values[++index];
    else throw new Error(`${arg} requires a value`);
  }
  return result;
}

export async function pool(items, limit, work) {
  limit=Math.min(8,Math.max(1,Math.floor(Number(limit)||1)));
  const output = new Array(items.length); let next=0;
  await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{
    while(next<items.length) { const index=next++;output[index]=await work(items[index],index); }
  }));
  return output;
}

async function previousBundle(patch, dataRoot) {
  let names=[];try{names=await readdir(dataRoot);}catch{return null;}
  const older = names.filter(name=>/^\d+\.\d+(?:\.\d+)?$/.test(name) && name.localeCompare(patch,undefined,{numeric:true})<0).sort((a,b)=>b.localeCompare(a,undefined,{numeric:true}));
  for (const version of older) {const data=await existsJSON(path.join(dataRoot,version,'profiles.json'));if(data)return data;}
  return null;
}

/** Stage all outputs before publishing them; roll back if a rename fails.
 * latest.json is the last commit pointer. Existing profile/history files are
 * never touched by validation or extraction failures. */
export async function commitJSONFiles(entries,{renameFile=rename}={}) {
  const transaction=randomUUID(), staged=[], committed=[];
  try {
    for(const [file,data] of entries) {
      await mkdir(path.dirname(file),{recursive:true});
      let previous=null;try{previous=await readFile(file);}catch(error){if(error.code!=='ENOENT')throw error;}
      const temp=`${file}.${transaction}.tmp`;
      await writeFile(temp,JSON.stringify(data,null,2)+'\n');
      staged.push({file,temp,previous});
    }
    for(const entry of staged) {await renameFile(entry.temp,entry.file);committed.push(entry);}
  } catch(error) {
    for(const entry of committed.reverse()) {
      if(entry.previous===null)await rm(entry.file,{force:true});
      else {const rollback=`${entry.file}.${transaction}.rollback`;await writeFile(rollback,entry.previous);await rename(rollback,entry.file);}
    }
    throw error;
  } finally {await Promise.all(staged.map(entry=>rm(entry.temp,{force:true})));}
}

export async function finalize(candidatePath, options, catalog, {root=appRoot}={}) {
  const dataRoot=path.join(root,'data');
  const candidate = await readJSON(path.resolve(candidatePath));
  if (!/^\d+\.\d+(?:\.\d+)?$/.test(candidate.patch || '')) throw new Error('Candidate patch must be a plain version such as 12.1.5');
  const patchDir = path.join(dataRoot,candidate.patch);
  const candidateRawRefs=[...new Set((candidate.profiles||[]).map(profile=>profile.provenance?.raw_bundle).filter(Boolean))];
  if(candidateRawRefs.length>1 && !options['raw-bundle'])throw new Error('Candidate refers to multiple raw runs; use one immutable run per extraction.');
  const frozenRef=candidateRawRefs.length===1 && /\/raw\/runs\/[^/]+\.json$/.test(candidateRawRefs[0])?candidateRawRefs[0]:null;
  const rawPath=options['raw-bundle']?path.resolve(options['raw-bundle']):frozenRef?path.resolve(root,frozenRef):path.join(patchDir,'raw/bundle.json');
  if(!rawPath.startsWith(path.join(patchDir,'raw')+path.sep))throw new Error('Raw bundle must belong to this patch under its raw directory.');
  const raw = await existsJSON(rawPath);
  if (!raw) throw new Error('No scraped raw bundle for this patch. Run npm run update-data before extraction/finalization.');
  if(raw.context?.patch!==candidate.patch || !/^[\da-z-]+$/i.test(raw.run_id||''))throw new Error('Raw bundle patch/run identity is invalid or differs from the candidate.');
  const {deriveBundle} = await import('./derive.mjs');
  const {validateBundle} = await import('./validate.mjs');
  const previous = await previousBundle(candidate.patch,dataRoot);
  const derived = deriveBundle(candidate,previous);
  const bundle = derived || candidate;
  const rawRef=`data/${candidate.patch}/raw/runs/${raw.run_id}.json`;
  for(const profile of bundle.profiles)profile.provenance.raw_bundle=rawRef;
  const validation = validateBundle(bundle,{catalog,requireComplete:true});
  const result = await validation;
  // validateBundle may return an error array or throw. Do not silently continue
  // if a future validator changes its return contract.
  const errors = Array.isArray(result) ? result : result?.errors || [];
  if (errors.length || result === false || result?.valid === false) throw new Error(`Profile validation failed: ${JSON.stringify(errors).slice(0,4000)}`);

  const rawProfiles = new Map(raw.specs.map(entry=>[`${entry.spec_id}:${entry.content_type}`,entry]));
  const gaps = [];
  for (const profile of bundle.profiles) {
    const evidence = rawProfiles.get(`${profile.spec_id}:${profile.content_type}`);
    const successful = Object.values(evidence?.sources || {}).filter(source=>source.status==='success');
    const quantitative = successful.some(source=>['archon','raiderio'].includes(source.source));
    const wowhead = successful.some(source=>source.source==='wowhead');
    if (!wowhead || !quantitative) gaps.push(profile.id);
    for (const source of profile.provenance.sources) {
      const direct = evidence?.sources?.[source.id];
      if (direct && source.status==='success' && direct.status!=='success') throw new Error(`${profile.id} claims ${source.id} success but this run recorded ${direct.status}. Keep independent web evidence under its own source id.`);
    }
  }
  if (gaps.length && !options['allow-partial']) throw new Error(`${gaps.length} profiles lack the required Wowhead + quantitative source. Preserve coverage gaps and resolve access, or explicitly use --allow-partial to finalize a clearly incomplete dataset.`);
  // Same-patch refresh keeps an immutable pre-refresh snapshot too.
  const existing = await existsJSON(path.join(patchDir,'profiles.json'));
  if (existing) {
    await mkdir(path.join(patchDir,'history'),{recursive:true});
    await copyFile(path.join(patchDir,'profiles.json'),path.join(patchDir,'history',`${Date.now()}-profiles.json`));
  }
  const changes = {patch:bundle.patch,previous_patch:previous?.patch || null,generated_at:new Date().toISOString(),profiles:bundle.profiles.filter(profile=>profile.changes?.length).map(profile=>({id:profile.id,changes:profile.changes}))};
  // Freeze evidence even when finalizing an imported legacy mutable raw bundle.
  const archivePath=path.join(root,rawRef), archived=await existsJSON(archivePath);
  if(archived && JSON.stringify(archived)!==JSON.stringify(raw))throw new Error('Immutable raw archive differs from the selected bundle; refusing to replace evidence.');
  if(!archived)await writeJSON(archivePath,raw);
  const status={run_id:raw.run_id,raw_bundle:rawRef,patch:bundle.patch,status:gaps.length?'finalized_partial':'finalized',generated_at:new Date().toISOString(),profiles:bundle.profiles.length,required_coverage_missing:gaps.length,acceptance_coverage_passed:gaps.length===0};
  await commitJSONFiles([
    [path.join(patchDir,'profiles.json'),bundle],
    [path.join(patchDir,'changes.json'),changes],
    [path.join(patchDir,'run.json'),status],
    [path.join(dataRoot,'latest.json'),{patch:bundle.patch,path:`${bundle.patch}/profiles.json`,generated_at:bundle.generated_at}]
  ]);
  console.log(`Finalized ${bundle.profiles.length} profiles for ${bundle.patch}. Required source coverage: ${gaps.length ? `${gaps.length} incomplete (partial dataset)` : 'passed'}.`);
  return {bundle,status,changes};
}

export async function scrape(options,catalog,config,{root=appRoot,sourceModules,seasonDetector=detectSeason,log=console.log}={}) {
  const dataRoot=path.join(root,'data');
  const detected = await seasonDetector(config,options);
  const context = {...detected,season:{expansion:detected.expansion,name:detected.name,slug:detected.slug,number:detected.number,detected_at:detected.detected_at,source:detected.source,coverage_gaps:detected.coverage_gaps}};
  const generated_at = new Date().toISOString(), run_id = `${generated_at.replaceAll(/[^\da-z]/gi,'-')}-${randomUUID()}`;
  log(`Scraping ${catalog.length} specs × 2 content types for ${context.patch} / ${context.name}${context.is_fallback?' (explicit fallback)':''}.`);
  const modules = sourceModules || {wowhead:scrapeWowhead,archon:scrapeArchon,raiderio:scrapeRaiderio,youtube:scrapeYoutube,warcraftlogs:scrapeWarcraftlogs};
  const entries=catalog.flatMap(spec=>['raid','mythic_plus'].map(content=>({spec,content})));
  const specs = await pool(entries,Number(config.max_concurrency || 4),async({spec,content},index)=>{
    const sourceEntries = await Promise.all(Object.entries(modules).map(async([name,run])=>{
      try{return [name,await run({spec,content,context,config})];}
      catch(error){return [name,sourceResult(name,null,'failed',{error:cleanError(error)})];}
    }));
    if ((index+1)%10===0) log(`Processed ${index+1}/${entries.length} profiles.`);
    return {spec_id:spec.id,content_type:content,sources:Object.fromEntries(sourceEntries)};
  });
  const bundle={schema_version:'1.0.0',run_id,generated_at,context,specs};
  const patchDir=path.join(dataRoot,context.patch);
  await writeJSON(path.join(patchDir,'raw/runs',`${run_id}.json`),bundle);
  await writeJSON(path.join(patchDir,'raw/bundle.json'),bundle);
  const successful_sources=Object.fromEntries(Object.keys(modules).map(name=>[name,specs.filter(entry=>entry.sources[name].status==='success').length]));
  const status={run_id,patch:context.patch,status:'awaiting_extraction',generated_at,profiles:specs.length,successful_sources,acceptance_coverage_passed:specs.every(entry=>entry.sources.wowhead?.status==='success' && ['archon','raiderio'].some(name=>entry.sources[name]?.status==='success')),context_gaps:context.coverage_gaps,next_step:'Codex reads pipeline/extract-playstyle.md and the raw bundle, writes candidate-profiles.json, then runs npm run update-data -- --finalize <candidate path>.'};
  await writeJSON(path.join(patchDir,'run.json'),status);
  try {
    const {makeUnknownBundle}=await import('./derive.mjs');
    const target=path.join(patchDir,'candidate-profiles.json');
    if (!await existsJSON(target)) {
      const template=makeUnknownBundle(bundle,catalog);
      for(const profile of template.profiles)profile.provenance.raw_bundle=`data/${context.patch}/raw/runs/${run_id}.json`;
      await writeJSON(target,template);
    }
  } catch(error) { if(error.code!=='ERR_MODULE_NOT_FOUND')throw error; }
  log(JSON.stringify(status,null,2));
  log('Scrape stage complete. Agent extraction is required; published profiles have not been changed.');
  return {bundle,status};
}

export async function main() { try {
  for (const envFile of new Set([path.resolve('.env'),path.join(appRoot,'.env')])) {
    try { process.loadEnvFile(envFile); } catch(error) { if(error.code!=='ENOENT')throw error; }
  }
  const options=args(process.argv.slice(2));
  if (options.help) console.log('npm run update-data [-- --patch VERSION --season SLUG --expansion NAME --season-number N --patch-start ISO]\nnpm run update-data -- --finalize CANDIDATE [--raw-bundle PATH] [--allow-partial]');
  else {
    const [catalog,config]=await Promise.all([readJSON(path.join(appRoot,'config/specs.json')),readJSON(path.join(appRoot,'config/sources.json'))]);
    if(options.finalize)await finalize(options.finalize,options,catalog);else await scrape(options,catalog,config);
  }
} catch(error) { console.error(`Update failed: ${cleanError(error)}`);process.exitCode=1; } }
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
