'use strict';

const assert = require('node:assert/strict');
const {test} = require('node:test');
const createModel = require('../src/model');
const {fetchMetaEmblem} = require('../src/snapshots');
const academy = require('../data/academy-18.3b.json');
const meta = require('../data/metatft-18.3b.json');
const core = require('../data/core-items.json');
// Public guide and placement rows observed on Patch 18.7 on November 24, 2026.
const live = require('../test-support/p111-live-emblems.json');

const brawler = 'DA_18_EmblemBrawler';
const vanguard = 'DA_18_EmblemVanguard';
const board = ['DA_18_Alune', 'DA_18_Ivern', 'DA_18_Rakan', 'DA_18_Diana', 'DA_18_Lillia', 'DA_18_Ornn'];
const brawlerLeaders = ['Adaptor Reroll', 'Yi Rengar'];

function setup() {
  const model = createModel({academy, meta, core, requireLive:true});
  const {Academy} = model;
  const itemOverrides = new Map(live.items.map(item=>[item.apiName, item]));
  Academy.useSnapshot({...academy, patch:live.patch, sourceUpdated:live.academyUpdated, guides:live.guides,
    items:academy.items.map(item=>({...item, ...itemOverrides.get(item.apiName)}))});
  Academy.live = true;
  return model;
}

function plan(Academy, withEmblem) {
  const item = Academy.itemMap.get(brawler);
  return {owned:{}, pins:[], currentUnits:board.map(apiName=>({apiName, stars:1})),
    queue:withEmblem?[{uid:'received-emblem', item, done:true}]:[]};
}

test('18.7 Brawler owned puts Adaptor Reroll and Yi Rengar ahead of flex and item guide matches', () => {
  const {Academy, CompFinder} = setup();
  const input = plan(Academy, true);
  const rows = CompFinder.ranked(input);
  assert.deepEqual(rows.slice(0,2).map(row=>row.guide.title), brawlerLeaders);
  assert.ok(rows.slice(0,2).every(row=>row.primaryEmblem && row.emblemBonus===32));
  assert.ok(rows.slice(2).every(row=>!row.primaryEmblem && row.emblemBonus<=8));
  const tempo = rows.find(row=>row.guide.title==='Tempo Riftbeast');
  assert.equal(tempo.emblemBonus, 8);
  assert.ok(tempo.specialMatches.some(match=>match.champion==='Sentinel'));

  const kayle = rows.find(row=>row.guide.title==='Solar Kayle').guide;
  input.currentUnits = kayle.finalComp.map(unit=>({apiName:unit.apiName, stars:3}));
  const strongBoard = CompFinder.ranked(input);
  assert.ok(strongBoard.find(row=>row.guide===kayle).fitScore>strongBoard[1].fitScore+CompFinder.tierFitGap);
  assert.ok(strongBoard.slice(0,2).every(row=>brawlerLeaders.includes(row.guide.title)));
});

test('18.7 Brawler unowned leaves Yi Rengar at #9 and keeps Ravager Rengar gated', () => {
  const {Academy, CompFinder} = setup();
  const input = plan(Academy, false);
  const rows = CompFinder.ranked(input);
  const yi = rows[8];
  assert.equal(yi.guide.title, 'Yi Rengar');
  assert.equal(yi.blocked, false);
  assert.equal(yi.emblemBonus, 0);
  const ravager = rows.find(row=>row.guide.title==='Ravager Rengar');
  assert.equal(ravager.blocked, true);
  assert.equal(ravager.gateReason, 'Only play with Ravager emblem');
  assert.throws(()=>CompFinder.choose(input, ravager.guide.id), /Only play with Ravager emblem/);
  CompFinder.choose(input, yi.guide.id);
  assert.equal(input.activeComp.title, 'Yi Rengar');
});

test('the Brawler explorer ranks the two Master Yi builds first and names the flex holder', () => {
  const {Academy, EmblemExplorer} = setup();
  const rows = EmblemExplorer.academyRoutes(brawler);
  assert.deepEqual(rows.map(row=>row.guide.title), [...brawlerLeaders, 'Tempo Riftbeast']);
  assert.deepEqual(rows.map(row=>row.holders.map(h=>[h.name,h.use])), [
    [['Master Yi','alternate']], [['Master Yi','alternate']], [['Sentinel','flex']]
  ]);
  Academy.live = false;
  assert.deepEqual(EmblemExplorer.academyRoutes(brawler), []);
});

test('the Vanguard explorer reads Krug from Academy and ranks exact MetaTFT holder pairs', async () => {
  const {EmblemExplorer} = setup();
  const academyRoutes = EmblemExplorer.academyRoutes(vanguard);
  assert.deepEqual(academyRoutes.map(row=>[row.guide.title,row.holders[0].name]), [['Tempo Riftbeast','Krug']]);
  const data = await fetchMetaEmblem(vanguard, live.patch, {fetchJSON:async rawUrl=>{
    const url = new URL(rawUrl);
    assert.equal(url.origin+url.pathname, 'https://api-hc.metatft.com/tft-explorer-api/unit_items');
    assert.equal(url.searchParams.get('item'), vanguard);
    assert.equal(url.searchParams.get('patch'), '18.7');
    return Response.json({data:live.vanguardRows});
  }});
  const holders = EmblemExplorer.metaHolders(vanguard, data);
  assert.deepEqual(holders.map(holder=>holder.name), ['Lux','Kennen','Krug','Morgana']);
  const morgana = holders.at(-1);
  assert.equal(morgana.samples, 5925);
  assert.equal(morgana.avg.toFixed(2), '4.28');
  assert.ok(morgana.comps.some(guide=>guide.title==='Coven Elise'));
  assert.ok(morgana.comps.some(guide=>guide.title==='Ahri Morgana'));
  assert.deepEqual(EmblemExplorer.metaHolders(vanguard, {...data, patch:'18.6'}), []);
});

test('the explorer includes a Vanguard route when an Academy guide explicitly equips Morgana', () => {
  const {Academy, EmblemExplorer} = setup();
  // Exercise the requested route shape even though the 18.7 capture lacks it.
  const guide = Academy.snapshot.guides.find(row=>row.title==='Ahri Morgana');
  const morgana = guide.finalComp.find(unit=>unit.apiName==='DA_18_Morgana');
  const coven = {...guide, id:'test-coven-morgana', title:'Coven Morgana', tier:'S',
    finalComp:[{...morgana, items:[vanguard]}], altBuilds:[{...morgana, items:[vanguard]}]};
  Academy.useSnapshot({...Academy.snapshot, guides:[...Academy.snapshot.guides, coven]});
  const [row] = EmblemExplorer.academyRoutes(vanguard);
  assert.equal(row.guide.title, 'Coven Morgana');
  assert.deepEqual(row.holders.map(h=>[h.name,h.use]), [['Morgana','final']]);
});
