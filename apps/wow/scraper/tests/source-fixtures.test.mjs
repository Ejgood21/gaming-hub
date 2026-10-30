import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {scrapeWowhead} from '../wowhead.mjs';
import {scrapeArchon} from '../archon.mjs';
import {scrapeRaiderio} from '../raiderio.mjs';
import {chooseVideo, scrapeYoutube} from '../youtube.mjs';

// All fixtures and counts in this file are synthetic, never production evidence.
const fixture = name => readFile(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const spec = {id:'windwalker-monk', name:'Windwalker', spec:'Windwalker', class_name:'Monk', role:'dps', game_id:269, wowhead_slug:'monk/windwalker', raiderio_spec:'windwalker', raiderio_class:'monk'};
const context = {patch:'12.1.5', expansion:'Midnight', season_number:2, slug:'season-mn-2'};
const config = {
  region:'us', preferred_creators:['Preferred Creator'],
  wowhead:{base_url:'https://www.wowhead.com/guide/classes', sections:['rotation-cooldowns','talent-builds','gear']},
  archon:{mythic_plus_template:'https://www.archon.gg/wow/builds/{spec}/{class}/mythic-plus/overview/10/all-dungeons/this-week',raid_template:'https://www.archon.gg/wow/builds/{spec}/{class}/raid/overview/mythic/all-bosses'},
  raiderio:{sample_pages:1}, youtube:{max_results:12,max_age_days:120},
};

test('Wowhead reads script-only JSON-LD guide prose without evaluating JavaScript', async () => {
  const html = await fixture('wowhead-script-only.html');
  const result = await scrapeWowhead({spec,content:'mythic_plus',context,config,httpGetText:async()=>html});
  assert.equal(result.status,'success');
  assert.equal(result.data.sections.length,3);
  assert.ok(result.data.sections.every(section=>section.status==='success'));
  assert.match(result.data.sections[0].text,/Tiger Palm/);
  assert.match(result.data.sections[0].url,/rotation-cooldowns-pve-dps$/);
});

test('one blocked Wowhead section preserves the other sections and explicit gap', async () => {
  const html = await fixture('wowhead-script-only.html');
  const result = await scrapeWowhead({spec,content:'raid',context,config,httpGetText:async url=>url.includes('/gear-')?'<html><title>Just a moment</title><p>Verify you are human</p></html>':html});
  assert.equal(result.status,'success');
  assert.equal(result.data.sections.filter(section=>section.status==='success').length,2);
  assert.equal(result.data.sections.find(section=>section.section==='gear').status,'failed');
  assert.ok(result.coverage_gaps.some(gap=>/gear/.test(gap)));
});

test('a source access challenge is recorded as failure rather than guide evidence', async () => {
  const result = await scrapeWowhead({spec,content:'raid',context,config,httpGetText:async()=>'<html><title>Just a moment</title><p>Verify you are human</p></html>'});
  assert.equal(result.status,'failed');
  assert.ok(result.data.sections.every(section=>section.status==='failed'));
  assert.ok(result.coverage_gaps.length>=3);
});

test('navigation and generic site chrome are not accepted as guide prose', async () => {
  const chrome=`<html><head><title>Windwalker Monk Guide</title></head><body><nav>${'Windwalker Monk News Guides Database Classes '.repeat(30)}</nav></body></html>`;
  const result=await scrapeWowhead({spec,content:'raid',context,config,httpGetText:async()=>chrome});
  assert.equal(result.status,'failed');
  assert.ok(result.data.sections.every(section=>/Guide prose missing/.test(section.error)));
});

test('old-patch Wowhead prose stays available as stale evidence and cannot count as current coverage', async () => {
  const html=(await fixture('wowhead-script-only.html')).replaceAll('12.1.5','12.1.0');
  const result=await scrapeWowhead({spec,content:'raid',context,config,httpGetText:async()=>html});
  assert.equal(result.status,'stale');
  assert.ok(result.data.sections.every(section=>section.status==='stale'));
  assert.match(result.data.sections[0].text,/Tiger Palm/);
  assert.ok(result.coverage_gaps.some(gap=>/12\.1\.0/.test(gap)));
});

test('Archon preserves combined spec/hero popularity without inventing hero pick rates', async () => {
  const html=await fixture('archon-overview.html');
  const result=await scrapeArchon({spec,content:'mythic_plus',context,config,httpGetText:async()=>html});
  assert.equal(result.status,'success');
  assert.ok(result.data.numeric_records.some(entry=>entry.record.specAndHeroPopularity===17.6));
  assert.match(result.data.text,/not the standalone pick rate/);
  assert.equal(result.data.hero_talents,undefined);
  assert.equal(result.data.pick_rates,undefined);
});

test('an Archon parser failure remains local to that source', async () => {
  const result=await scrapeArchon({spec,content:'raid',context,config,httpGetText:async()=>{throw new Error('HTTP 403 from source');}});
  assert.equal(result.status,'failed');
  assert.match(result.error,/403/);
  assert.ok(result.coverage_gaps.length>0);
});

test('Archon rejects a different spec page even when it has numeric percentages', async () => {
  const html=(await fixture('archon-overview.html')).replaceAll('Windwalker Monk','Frost Mage');
  const result=await scrapeArchon({spec,content:'mythic_plus',context,config,httpGetText:async()=>html});
  assert.equal(result.status,'failed');
  assert.match(result.error,/spec identity/);
});

test('Raider.IO counts role-specific roster slots and discloses repeated-player sample limits', async () => {
  const response=JSON.parse(await fixture('raiderio-runs.json'));
  const result=await scrapeRaiderio({spec,content:'mythic_plus',context,config,httpGetJSON:async()=>response});
  assert.equal(result.status,'success');
  assert.equal(result.data.matching_roster_slots,3);
  assert.equal(result.data.total_role_roster_slots,6);
  assert.equal(result.data.representation_percent,50);
  assert.equal(result.data.sample_runs,2);
  assert.match(result.data.interpretation,/Repeated players and runs/);
  assert.match(result.coverage_gaps.join(' '),/not the complete season population/);
});

test('Raider.IO malformed roster fails instead of emitting a zero pick rate', async () => {
  const result=await scrapeRaiderio({spec,content:'mythic_plus',context,config,httpGetJSON:async()=>({rankings:[{run:{roster:[{character:{name:'NoSpec'}}]}}]})});
  assert.equal(result.status,'failed');
  assert.equal(result.data,undefined);
});

test('Raider.IO raid coverage never substitutes guild progression for spec representation', async () => {
  let requests=0;
  const result=await scrapeRaiderio({spec,content:'raid',context,config,httpGetJSON:async()=>{requests++;throw new Error('Should not query guild rankings');}});
  assert.equal(result.status,'missing');
  assert.equal(requests,0);
  assert.match(result.error,/guild progression/);
});

const recent = offset => new Date(Date.now()-offset*86400000).toISOString();
const video=(id,changes={})=>({id,title:'Windwalker Monk Mythic+ guide 12.1.5',channel:'Independent Creator',views:1000,uploaded_at:recent(1),url:`https://www.youtube.com/watch?v=${id}`,...changes});

test('YouTube creator hints only break equal views and never whitelist', () => {
  const selected=chooseVideo([video('more-views',{views:1001}),video('preferred',{channel:'Preferred Creator',views:1000})],{spec,content:'mythic_plus',context,config});
  assert.equal(selected.id,'more-views');
  const tie=chooseVideo([video('ordinary'),video('preferred',{channel:'Preferred Creator'})],{spec,content:'mythic_plus',context,config});
  assert.equal(tie.id,'preferred');
});

test('YouTube excludes wrong content, patch, class, and stale uploads', () => {
  const frost={...spec,id:'frost-mage',name:'Frost',spec:'Frost',class_name:'Mage'};
  const selected=chooseVideo([
    video('wrong-content',{title:'Frost Mage raid guide 12.1.5',views:9000}),
    video('wrong-patch',{title:'Frost Mage Mythic+ guide 12.1.0',views:8000}),
    video('wrong-class',{title:'Frost Death Knight Mythic+ guide 12.1.5',views:7000}),
    video('stale',{title:'Frost Mage Mythic+ guide 12.1.5',views:6000,uploaded_at:recent(121)}),
    video('suitable',{title:'Frost Mage Mythic+ guide 12.1.5',views:100}),
  ],{spec:frost,content:'mythic_plus',context,config});
  assert.equal(selected.id,'suitable');
});

test('YouTube rejects an explicit old patch even when uploaded after the current patch release', () => {
  const recentContext={...context,patch_started_at:recent(3)};
  const selected=chooseVideo([
    video('late-old-guide',{title:'Windwalker Monk Mythic+ guide 12.1.0',views:100000,uploaded_at:recent(1)}),
    video('current-guide',{title:'Windwalker Monk Mythic+ guide 12.1.5',views:100,uploaded_at:recent(2)}),
  ],{spec,content:'mythic_plus',context:recentContext,config});
  assert.equal(selected.id,'current-guide');
});

function youtubeResponses() {
  return async url => {
    if(new URL(url).pathname.endsWith('/search'))return {items:[{id:{videoId:'fixturevid1'}}]};
    return {items:[{id:'fixturevid1',snippet:{title:'Windwalker Monk Mythic+ guide 12.1.5',channelTitle:'Synthetic Channel',channelId:'synthetic-channel',publishedAt:recent(1),liveBroadcastContent:'none'},statistics:{viewCount:'1234'},contentDetails:{duration:'PT12M'}}]};
  };
}

test('YouTube transcript failure preserves metadata as a gap, not qualitative success', async () => {
  const result=await scrapeYoutube({spec,content:'mythic_plus',context,config,apiKey:'fixture-key',httpGetJSON:youtubeResponses(),fetchTranscript:async()=>({error:'Captions disabled'})});
  assert.equal(result.status,'missing');
  assert.equal(result.data.selected.title,'Windwalker Monk Mythic+ guide 12.1.5');
  assert.equal(result.data.selected.channel,'Synthetic Channel');
  assert.equal(result.data.selected.views,1234);
  assert.ok(result.data.selected.uploaded_at);
  assert.deepEqual(result.data.transcript,[]);
  assert.equal(result.data.creator_notes,null);
});

test('YouTube successful captions preserve timing for agent source citations', async () => {
  const result=await scrapeYoutube({spec,content:'mythic_plus',context,config,apiKey:'fixture-key',httpGetJSON:youtubeResponses(),fetchTranscript:async()=>({language:'en',transcript:[{text:'Synthetic ability explanation',start:85.5,duration:4.5}]})});
  assert.equal(result.status,'success');
  assert.equal(result.data.transcript[0].start,85.5);
  assert.equal(result.data.transcript_language,'en');
  assert.equal(result.data.creator_notes,null);
});
