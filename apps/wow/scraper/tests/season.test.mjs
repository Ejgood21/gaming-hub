import test from 'node:test';
import assert from 'node:assert/strict';
import {detectSeason} from '../season.mjs';

// Deliberately invented future expansion/patch so auto-detection cannot pass by
// returning the current checked-in fallback. No network requests are made.
const day=86400000;
const date=days=>new Date(Date.now()+days*day).toISOString();
const config={region:'us',request_timeout_seconds:18,season_override:{patch:'12.1.5',expansion:'Midnight',name:'Midnight Season 2',slug:'season-mn-2',number:2,patch_started_at:'2026-10-13T00:00:00Z'}};

test('season detection derives expansion and active season from live response shapes',async()=>{
  let staticRequest;
  const detected=await detectSeason(config,{}, {
    httpGetText:async()=> 'Region!STRING:0|BuildConfig!HEX:16|VersionsName!STRING:0\nus|0123456789abcdef|13.2.1.12345\neu|0123456789abcdef|13.2.1.12345\n',
    httpGetJSON:async url=>{
      staticRequest=url;
      return {seasons:[
        {slug:'season-future-2',name:'Future Expansion Season 2',is_main_season:true,starts:{us:date(-90)},ends:{us:date(-1)}},
        {slug:'season-future-3',name:'Future Expansion Season 3',is_main_season:true,starts:{us:date(-7)},ends:{us:date(60)}},
        {slug:'season-future-special-1',name:'Future Expansion Special Season 1',is_main_season:false,starts:{us:date(-2)},ends:{us:date(30)}},
        {slug:'season-future-4',name:'Future Expansion Season 4',is_main_season:true,starts:{us:date(61)},ends:{us:date(120)}},
      ]};
    },
  });
  assert.equal(new URL(staticRequest).searchParams.get('expansion_id'),'12');
  assert.equal(detected.patch,'13.2.1');
  assert.equal(detected.expansion_id,12);
  assert.equal(detected.expansion,'Future Expansion');
  assert.equal(detected.number,3);
  assert.equal(detected.slug,'season-future-3');
  assert.equal(detected.is_fallback,false);
  assert.equal(detected.patch_started_at,null);
  assert.match(detected.coverage_gaps.join(' '),/Patch release date unavailable/);
});

test('blocked season access uses a visibly marked config fallback',async()=>{
  const detected=await detectSeason(config,{}, {httpGetText:async()=>{throw new Error('Synthetic CONNECT policy denial');},httpGetJSON:async()=>assert.fail('Static data must not be requested after version discovery fails')});
  assert.equal(detected.patch,config.season_override.patch);
  assert.equal(detected.is_fallback,true);
  assert.equal(detected.source,'config override');
  assert.ok(detected.coverage_gaps.some(gap=>/Synthetic CONNECT policy denial/.test(gap)));
  assert.ok(detected.coverage_gaps.some(gap=>/explicit fallback/.test(gap)));
});

test('CLI patch change drops the old fallback release date until explicitly replaced',async()=>{
  const blocked={httpGetText:async()=>{throw new Error('Synthetic blocked source');}};
  const changed=await detectSeason(config,{patch:'13.2.1',season:'season-future-3',expansion:'Future Expansion','season-number':'3'},blocked);
  assert.equal(changed.source,'CLI override');
  assert.equal(changed.patch_started_at,null);
  assert.equal(changed.expansion_id,12);
  assert.equal(changed.name,'Future Expansion Season 3');
  const explicitDate=date(-1);
  const explicit=await detectSeason(config,{patch:'13.2.1','patch-start':explicitDate},blocked);
  assert.equal(explicit.patch_started_at,explicitDate);
});
