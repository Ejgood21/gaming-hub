import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,readdir,rename,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {gzipSync, gunzipSync} from 'node:zlib';
import {scrape,finalize,commitJSONFiles} from '../../pipeline/update-data.mjs';

const readJSON=async file=>JSON.parse(await readFile(file,'utf8'));
const realCatalog=JSON.parse(await readFile(new URL('../../config/specs.json',import.meta.url),'utf8'));
const catalog=[realCatalog.find(spec=>spec.id==='windwalker-monk')];
const patch='12.1.5';
const config={region:'us',max_concurrency:2};
const seasonDetector=async()=>({patch,expansion:'Midnight',name:'Synthetic Season 2',slug:'season-mn-2',number:2,season_number:2,detected_at:new Date().toISOString(),source:'https://fixture.invalid/season',is_fallback:false,coverage_gaps:[]});
const success=source=>async()=>({source,status:'success',url:`https://fixture.invalid/${source}`,fetched_at:new Date().toISOString(),data:{fixture:true}});
const sourceModules={wowhead:success('wowhead'),archon:async()=>{throw new Error('Synthetic source access denial');},raiderio:success('raiderio')};

async function temporaryRoot(t) {
  const root=await mkdtemp(path.join(os.tmpdir(),'wow-pipeline-test-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  return root;
}
async function recursiveNames(directory) {
  const output=[];
  for(const entry of await readdir(directory,{withFileTypes:true})) {
    const file=path.join(directory,entry.name);
    output.push(file);
    if(entry.isDirectory())output.push(...await recursiveNames(file));
  }
  return output;
}

test('scrape isolates a thrown source and preserves published profiles and edited candidate',async t=>{
  const root=await temporaryRoot(t),patchDir=path.join(root,'data',patch);
  await mkdir(patchDir,{recursive:true});
  const profilesPath=path.join(patchDir,'profiles.json');
  const originalProfiles=' { "previous": "published profiles" }\n';
  await writeFile(profilesPath,originalProfiles);

  const first=await scrape({},catalog,config,{root,sourceModules,seasonDetector,log:()=>{}});
  assert.equal(first.bundle.specs.length,2);
  assert.deepEqual(first.bundle.specs.map(row=>row.content_type),['raid','mythic_plus']);
  for(const row of first.bundle.specs) {
    assert.equal(row.sources.wowhead.status,'success');
    assert.equal(row.sources.archon.status,'failed');
    assert.match(row.sources.archon.error,/Synthetic source access denial/);
    assert.equal(row.sources.raiderio.status,'success');
  }
  assert.equal(await readFile(profilesPath,'utf8'),originalProfiles);
  const candidatePath=path.join(patchDir,'candidate-profiles.json');
  const candidate=await readJSON(candidatePath);
  assert.equal(candidate.profiles.length,2);
  const archivePath=path.join(patchDir,'raw','runs',`${first.bundle.run_id}.json`);
  const originalArchive=await readFile(archivePath,'utf8');
  assert.deepEqual(JSON.parse(originalArchive),first.bundle);
  const editedCandidate=' { "agent": "in-progress extraction; preserve exact bytes" }\n';
  await writeFile(candidatePath,editedCandidate);

  await scrape({},catalog,config,{root,sourceModules,seasonDetector,log:()=>{}});
  assert.equal(await readFile(candidatePath,'utf8'),editedCandidate);
  assert.equal(await readFile(profilesPath,'utf8'),originalProfiles);
  assert.equal(await readFile(archivePath,'utf8'),originalArchive);
});

test('failed multi-file commit rolls back previous bytes and cleans staging files',async t=>{
  const root=await temporaryRoot(t),first=path.join(root,'profiles.json'),second=path.join(root,'changes.json');
  const originalFirst='{ "keep": "profile bytes" }\n',originalSecond='{"keep":"diff bytes"}\n\n';
  await writeFile(first,originalFirst);
  await writeFile(second,originalSecond);
  let renames=0;
  await assert.rejects(commitJSONFiles([[first,{changed:true}],[second,{changed:true}]],{renameFile:async(from,to)=>{
    renames++;
    if(renames===2)throw new Error('Synthetic filesystem rename failure');
    await rename(from,to);
  }}),/Synthetic filesystem rename failure/);
  assert.equal(await readFile(first,'utf8'),originalFirst);
  assert.equal(await readFile(second,'utf8'),originalSecond);
  assert.ok((await recursiveNames(root)).every(file=>!file.endsWith('.tmp') && !file.endsWith('.rollback')));
});

test('successful multi-file commit publishes the latest pointer last',async t=>{
  const root=await temporaryRoot(t),profilePath=path.join(root,'profiles.json'),latestPath=path.join(root,'latest.json');
  const order=[];
  await commitJSONFiles([[profilePath,{patch,profiles:[]}],[latestPath,{patch,path:'12.1.5/profiles.json'}]],{renameFile:async(from,to)=>{
    order.push(path.basename(to));
    if(to===latestPath)assert.equal((await readJSON(profilePath)).patch,patch);
    await rename(from,to);
  }});
  assert.deepEqual(order,['profiles.json','latest.json']);
  assert.equal((await readJSON(latestPath)).patch,patch);
  assert.ok((await recursiveNames(root)).every(file=>!file.endsWith('.tmp')));
});

test('strict finalize refuses missing coverage and partial finalize pins immutable evidence across later scrapes',async t=>{
  const root=await temporaryRoot(t),patchDir=path.join(root,'data',patch);
  await mkdir(patchDir,{recursive:true});
  const profilesPath=path.join(patchDir,'profiles.json'),original=' { "published": "preserve until finalize passes" }\n';
  await writeFile(profilesPath,original);
  const partialSources={...sourceModules,wowhead:async()=>({source:'wowhead',status:'failed',url:'https://fixture.invalid/wowhead',fetched_at:new Date().toISOString(),error:'Synthetic blocked guide'})};
  const initial=await scrape({},catalog,config,{root,sourceModules:partialSources,seasonDetector,log:()=>{}});
  const candidatePath=path.join(patchDir,'candidate-profiles.json');
  await assert.rejects(finalize(candidatePath,{},catalog,{root}),/lack the required Wowhead \+ quantitative source/);
  assert.equal(await readFile(profilesPath,'utf8'),original);
  const selectedRawPath=path.join(patchDir,'raw','runs',`${initial.bundle.run_id}.json`);
  const selectedRaw=await readFile(selectedRawPath,'utf8');

  const finalized=await finalize(candidatePath,{'allow-partial':true},catalog,{root});
  assert.equal(finalized.status.status,'finalized_partial');
  assert.equal(finalized.status.acceptance_coverage_passed,false);
  assert.equal(finalized.bundle.profiles.length,2);
  const expectedRef=`data/${patch}/raw/runs/${initial.bundle.run_id}.json`;
  assert.ok(finalized.bundle.profiles.every(profile=>profile.provenance.raw_bundle===expectedRef));
  assert.equal((await readJSON(path.join(root,'data','latest.json'))).patch,patch);
  const finalizedProfiles=await readFile(profilesPath,'utf8');

  const next=await scrape({},catalog,config,{root,sourceModules,seasonDetector,log:()=>{}});
  assert.notEqual(next.bundle.run_id,initial.bundle.run_id);
  assert.equal(await readFile(profilesPath,'utf8'),finalizedProfiles);
  assert.equal(await readFile(selectedRawPath,'utf8'),selectedRaw);
  assert.ok((await readJSON(profilesPath)).profiles.every(profile=>profile.provenance.raw_bundle===expectedRef));
});

for(const blocked of [false,true]) test(`gzip evidence retains immutable provenance and ${blocked?'strictly refuses missing':'accepts complete'} source coverage`,async t=>{
  const root=await temporaryRoot(t),patchDir=path.join(root,'data',patch);
  const modules=blocked?{...sourceModules,wowhead:async()=>({source:'wowhead',status:'failed',url:'https://fixture.invalid/wowhead',fetched_at:new Date().toISOString(),error:'Synthetic blocked guide'})}:sourceModules;
  const {bundle}=await scrape({},catalog,config,{root,sourceModules:modules,seasonDetector,log:()=>{}});
  const plain=path.join(patchDir,'raw','runs',`${bundle.run_id}.json`), compressed=plain+'.gz';
  const original=await readFile(plain), archive=gzipSync(original);
  await writeFile(compressed,archive);
  assert.deepEqual(gunzipSync(archive),original);
  const candidatePath=path.join(patchDir,'candidate-profiles.json'),candidate=await readJSON(candidatePath);
  const rawRef=`data/${patch}/raw/runs/${bundle.run_id}.json.gz`;
  for(const profile of candidate.profiles)profile.provenance.raw_bundle=rawRef;
  await writeFile(candidatePath,JSON.stringify(candidate));
  await rm(plain);
  const profilesPath=path.join(patchDir,'profiles.json');
  if(blocked){
    const preserved='{"published":"preserve these exact bytes"}\n';
    await writeFile(profilesPath,preserved);
    await assert.rejects(finalize(candidatePath,{},catalog,{root}),/lack the required Wowhead \+ quantitative source/);
    assert.equal(await readFile(profilesPath,'utf8'),preserved);
  }else{
    const result=await finalize(candidatePath,{},catalog,{root});
    assert.equal(result.status.status,'finalized');
    assert.equal(result.status.acceptance_coverage_passed,true);
    assert.equal(result.status.raw_bundle,rawRef);
    assert.ok(result.bundle.profiles.every(profile=>profile.provenance.raw_bundle===rawRef));
  }
  assert.deepEqual(await readFile(compressed),archive);
});
