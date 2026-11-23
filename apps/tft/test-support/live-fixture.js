'use strict';

const assert = require('node:assert/strict');
const academy = require('../data/academy-18.3b.json');

const liveFixtureUpdated = Date.parse('2026-10-01T12:00:00Z');
function liveFixture({academyPatch = '18.3b', metaPatch = '18.3b', metaSet = 18, omitAcademyPatch = false,
                      staleGuideDates = false, fail = false, timeout = false, guides = academy.guides,
                      allowOtherUnits = false} = {}) {
  const updated = staleGuideDates ? '2026-09-26T12:00:00Z' : academy.sourceUpdated;
  const liveGuides = guides.map(g=>({...g,isPublic:true,updated}));
  const fetchJSON = async url => {
    if (fail) throw new TypeError('Network error');
    if (timeout) throw new DOMException('Timed out','TimeoutError');
    const {pathname, searchParams} = new URL(url);
    let data;
    if (pathname.endsWith('__data.json')) {
      if (omitAcademyPatch) return {type:'opaque'};
      data = {nodes:[{data:[{patch:1},academyPatch]}]};
    } else if (pathname.endsWith('/api/tierlist/comps')) {
      data = {guides:liveGuides};
    } else if (pathname.includes('/api/assets/')) {
      const kind = pathname.split('/').at(-1);
      assert.equal(searchParams.get('set'), '18');
      data = {[kind]:academy[kind]};
    } else {
      const unit = searchParams.get('unit');
      if (!allowOtherUnits) assert.equal(unit, 'DA_18_Ashe');
      const patch = metaPatch.slice(0,4), revision = metaPatch.slice(4);
      data = {unit,tft_set:'TFTSet'+metaSet,updated:liveFixtureUpdated};
      if (pathname.endsWith('_overall')) {
        data.games = [{day:1,count:1200,patch:[patch,revision]},
          {day:2,count:1200,patch:[patch,revision]},{day:3,count:1200,patch:['18.2','']}];
        data.levels = [{lvl_items:[2,3],places:[120,120,120,120,120,120,120,120]}];
      } else {
        const places = [12,11,10,10,8,6,4,2];
        data.build_games = [{patch,b_patch_version:revision}];
        data.items = [{places}];
        data.builds = [{buildNames:'DA_HandOfJustice|DA_IonicSpark|DA_JeweledGauntlet',places}];
      }
    }
    return {ok:true,json:async()=>data};
  };
  return fetchJSON;
}

module.exports = liveFixture;
