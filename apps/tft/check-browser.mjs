import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {checkAugmentReferencesAndCarousel, checkChampionStats, checkAugmentRerolls, checkCompFlipAndGrants, checkEmblemAiming, checkKarmaBoardAndOffers, checkMarkMade} from './test-support/p112-browser.mjs';
import {checkChampionOptionalPlay} from './test-support/p116-browser.mjs';
import {checkComponentPriorities} from './test-support/p117-browser.mjs';
import {checkStyleAndText} from './test-support/p118-browser.mjs';

const require = createRequire(import.meta.url);
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const liveFixture = require('./test-support/live-fixture');
const academy = require('./data/academy-18.3b.json');
const emblems = require('./test-support/p111-live-emblems.json');
const rankReplay = require('./test-support/p113-live-rank.json');
const {apFast9, mamawood, covenElise, solarEclipse, currentUnits, darkRitual} = require('./test-support/p16-comps');
const origin = 'https://carousel.test';
let fixture = liveFixture({omitAcademyPatch:true,allowOtherUnits:true,guides:academy.guides.map(guide =>
  guide.title === 'Aphelios Elderwood' ? {...guide,tier:'X'} : guide
)});
const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH});
const errors = [];
const html = await readFile(new URL('carousel-companion.html',import.meta.url),'utf8');

async function newPage(width, ignoreHTTPSErrors = false) {
  const page = await browser.newPage({
    viewport:{width,height:844},isMobile:width===390,hasTouch:width===390,ignoreHTTPSErrors
  });
  page.setDefaultTimeout(10000);
  page.on('pageerror', error=>errors.push(error.message));
  page.on('console', message=>{if(message.type()==='error')errors.push(message.text()+' '+message.location().url);});
  await page.route(origin+'/**',route=>{
    const path = new URL(route.request().url()).pathname;
    return path==='/'?route.fulfill({contentType:'text/html',body:html}):route.fulfill({status:204});
  });
  return page;
}

async function routeFixture(page, respond) {
  await page.route(/^https:\/\/(?:tftacademy\.com|api-hc\.metatft\.com)\//,async route=>{
    const url = new URL(route.request().url());
    if(url.pathname.endsWith('/unit_items')){
      await route.fulfill({headers:{'Access-Control-Allow-Origin':'*'},json:{data:emblems.vanguardRows}});
      return;
    }
    const response = await respond(url);
    await route.fulfill({
      headers:{'Access-Control-Allow-Origin':'*'},
      ...(response.type==='opaque'?{status:204}:{json:await response.json()})
    });
  });
  await page.route(/^https:\/\/(?:assets\.tftacademy\.com|raw\.communitydragon\.org)\//,route=>route.fulfill({
    contentType:'image/gif',body:Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7','base64')
  }));
}

async function replayFixtures() {
  const page = await newPage(390);
  await routeFixture(page,url=>fixture(url));

  async function checkWidth(selectors){
    const clipped = await page.evaluate(selectors=>{
      const width=document.documentElement.clientWidth;
      return [
        ...(document.documentElement.scrollWidth>width?['page']:[]),
        ...[...document.querySelectorAll(selectors)].filter(el=>{
          const {width:span,left,right}=el.getBoundingClientRect();
          return span>0&&((!el.closest('#shopping')&&(left<0||right>width))||el.scrollWidth>el.clientWidth+1);
        }).map(el=>el.id||el.className)
      ];
    },selectors);
    assert.deepEqual(clipped,[]);
  }
  const suggestion = title => page.locator('.comp-suggestion').filter({
    has:page.getByRole('heading',{name:title,exact:true})
  });
  const newGame = async () => {
    await page.getByRole('button',{name:'New game',exact:true}).click();
  };
  const choose = title => suggestion(title).locator('[data-choose-comp]').click();
  const alternate = page.locator('.pivot-section');
  const savedPlan = () => page.evaluate(()=>JSON.parse(localStorage.getItem('carousel-tracker-v1')));
  const owned = name => page.locator(`#bench output[aria-label="${name} owned"]`);
  const add = name => page.getByRole('button',{name:'Add one '+name,exact:true}).click();
  const toggle = page.locator('#component-toggle');
  const stock = (name,count) => toggle.locator(`[aria-label="${name}: ${count} in hand"]`);
  const bench = page.locator('#bench');
  const rod = 'Needlessly Large Rod', vest = 'Chain Vest';
  const inViewport = locator => locator.evaluate(el=>{
    const {top,right,bottom,left,width,height}=el.getBoundingClientRect();
    const hit=document.elementFromPoint(left+width/2,top+height/2);
    return width>0&&height>0&&top>=0&&right<=innerWidth&&bottom<=innerHeight&&left>=0&&el.contains(hit);
  });
  // An offline queue created before the free-form picker was removed.
  await page.addInitScript(() => {
    localStorage.setItem('carousel-tracker-v1', JSON.stringify({
      queue:[{uid:'first',item:'InfinityEdge'},{uid:'second',item:'Deathblade'}],
      owned:{},pins:[]
    }));
  });

  await page.goto(origin);
  await page.getByText('Live · Patch 18.3b',{exact:false}).waitFor();
  const opener = page.getByRole('region',{name:'Opener guide Patch 18.3b',exact:true});
  await opener.waitFor();
  const openerRules = await opener.locator('li').allTextContents();
  assert.ok(openerRules.length>=2 && openerRules.length<=3);
  assert.ok(openerRules.every(rule=>!rule.includes('Patch 18.3b')));
  const utility = page.getByLabel('More options',{exact:true});
  const expectedUtilities = ['Import a game','How it works','Settings'];
  for(let n=0;n<3;n++){
    await utility.click();
    assert.deepEqual(await page.locator('#utility-menu[open] .utility-options button').allTextContents(),expectedUtilities);
    await page.keyboard.press('Escape');
  }

  assert.equal(await page.getByText('Add an item',{exact:false}).count(),0);
  await page.getByRole('button',{name:'Pivot Deathblade',exact:true}).last().click();
  await page.locator('[data-pivot-item="InfinityEdge"][data-pivot-kind="plan"]').click();
  assert.deepEqual(await page.locator('#queue .qcard h3').allTextContents(),['Infinity Edge']);

  await page.getByRole('button',{name:'Got one B.F. Sword from carousel',exact:true}).click();
  await page.locator('#queue [data-action="make"]').click();
  assert.equal(await page.locator('#completed .completeitem[aria-label^="Infinity Edge"]').count(),1);
  assert.equal(await owned('B.F. Sword').textContent(),'1');
  await page.locator('#undo').click();
  assert.deepEqual(await page.locator('#queue .qcard h3').allTextContents(),['Infinity Edge']);

  await page.locator('#explore-unit-search').fill('Caitlyn');
  await page.locator('[data-add-unit="DA_18_Caitlyn"]').click();
  await page.getByRole('button',{name:'Caitlyn 2 stars',exact:true}).click();
  await page.locator('#owned-item-search').fill('rageblade');
  await page.locator('[data-owned-quick="GuinsoosRageblade"]').click();
  await page.locator('#finder-more').click();
  assert.deepEqual(await suggestion('Aphelios Elderwood').locator('.academy-tier').allTextContents(),['X · Situational','B · Patch 18.3b']);

  assert.equal(await alternate.isVisible(),false);
  await choose('Ahri Morgana');
  await alternate.getByRole('heading',{name:'A better fit for your game',exact:true}).waitFor();
  const before = await page.locator('#app-title').textContent();
  const pivotAction = alternate.getByRole('button',{name:/^Pivot to /});
  const next = (await pivotAction.textContent()).replace(/^Pivot to /,'');
  assert.notEqual(next,before);
  await pivotAction.click();
  assert.equal(await page.locator('#app-title').textContent(),next);
  assert.equal(await owned('B.F. Sword').textContent(),'1');
  assert.equal(await page.locator('#completed .completeitem[aria-label^="Guinsoo"]').count(),1);
  await page.locator('#undo').click();
  assert.equal(await page.locator('#app-title').textContent(),before);
  await pivotAction.waitFor();

  const azirRammus=academy.guides.find(g=>g.title==='Azir Rammus');
  fixture = liveFixture({metaPatch:'18.7',omitAcademyPatch:true,allowOtherUnits:true,
    guides:[apFast9,mamawood,covenElise,solarEclipse,azirRammus,{...covenElise,id:'unknown-x-guide',title:'X guide without a badge'}]});
  async function startGame(){
    await newGame();
    await page.getByText('Live · Patch 18.7',{exact:false}).waitFor();
    for(const {apiName} of currentUnits){
      await page.locator('#explore-unit-search').fill(academy.champions.find(c=>c.apiName===apiName).name);
      await page.locator(`[data-add-unit="${apiName}"]`).click();
    }
    assert.equal(await page.locator('.unit-stars button[data-unit-stars="1"][aria-pressed="true"]').count(),6);
  }

  await newGame();
  await page.getByText('Live · Patch 18.7',{exact:false}).waitFor();
  await page.getByRole('button',{name:'Got one Needlessly Large Rod from carousel',exact:true}).click();
  await page.getByRole('button',{name:'Got one Chain Vest from carousel',exact:true}).click();
  const apFast9Row=suggestion('AP Fast 9');
  await suggestion('AP Fast 9').locator('.academy-tier').getByText('S',{exact:true}).waitFor();
  const scoreValue=async name=>Number(await apFast9Row.getAttribute('data-'+name+'-score'));
  assert.equal(await scoreValue('effective'),await scoreValue('fit')+24);
  const originalFit=await scoreValue('fit');
  await page.locator('#first-augment-trigger').click();
  const firstAugments=(await page.locator('#first-augment-choices .icon-select-option span').allTextContents())
    .map(label=>label.trim().replace(/\s+/g,' ').toLowerCase());
  assert.equal(new Set(firstAugments).size,firstAugments.length);
  await page.locator('#first-augment-choices input').fill('Beast Within');
  assert.deepEqual(await page.locator('#first-augment-choices .icon-select-option span').allTextContents(),['Beast Within','Beast Within+']);
  await page.locator('#first-augment-choices input').fill('Tons of Stats!');
  assert.deepEqual(await page.locator('#first-augment-choices .icon-select-option span').allTextContents(),['Tons of Stats!']);
  await page.locator('#first-augment-choices input').fill('Unrivaled');
  assert.deepEqual(await page.locator('#first-augment-choices .icon-select-option span').allTextContents(),['Unrivaled']);
  await page.locator('#first-augment-choices input').fill('Woven Magic');
  await page.locator('[data-option-value="DA_WovenMagic"]').click();
  assert.notEqual(await scoreValue('fit'),originalFit);
  await apFast9Row.getByLabel('Woven Magic · Good augment match').waitFor();

  await startGame();
  await checkWidth('#comp-finder, .comp-suggestion, .current-unit, .need');
  await page.locator('.academy-reference summary').click();
  const sourceRow = name => page.locator('#academy-source-guides li').filter({hasText:name}).locator('.academy-tier');
  for(const [name,badge] of [['Coven Elise','B · Patch 18.7'],['Solar Eclipse','A · Patch 18.7'],['X guide without a badge','Secondary tier unavailable']]){
    assert.deepEqual(await sourceRow(name).allTextContents(),['X',badge]);
  }
  await page.locator('.academy-reference summary').click();
  await choose('Mamawood');
  await alternate.getByRole('button',{name:'Pivot to AP Fast 9',exact:true}).click();
  const noPivot=alternate.getByRole('heading',{name:'No better fit yet',exact:true});
  await noPivot.waitFor();
  assert.equal(await alternate.getByRole('button').count(),0);
  await startGame();
  await choose('AP Fast 9');
  await noPivot.waitFor();
  await checkWidth('.pivot-section, .qcard, .queue-champion, .board-panel, .need');

  const card = name => page.locator('#queue .qcard').filter({has:page.getByRole('heading',{name,exact:true})});
  const holders = name => card(name).locator('.item-owner').allTextContents();
  const hero = page.locator('#next-build');
  assert.equal(await page.locator('.opener-banner').isVisible(),false);
  assert.equal(await page.locator('#augment-priority').innerText(),'2-1: Econ › Item › Combat');
  const lockedFit = async () => Number(await page.locator('#comp-fit').getAttribute('data-fit-score'));
  const carouselPriorities = () => page.locator('#shopping .need').allTextContents();
  const markCrownguard = async (message, received) => {
    const fit=await lockedFit();
    const priorities=await carouselPriorities();
    await card('Crownguard').getByRole('button',{name:'Mark Crownguard made',exact:true}).click();
    assert.equal(await page.locator('#completed .completeitem[aria-label^="Crownguard"]').count(),1);
    assert.ok(await lockedFit()>fit);
    if(received)assert.notDeepEqual(await carouselPriorities(),priorities);
    assert.equal(await page.locator('#toast').textContent(),message);
    assert.equal(await owned(rod).textContent(),'0');
    assert.equal(await owned(vest).textContent(),'0');
    await page.locator('#undo').click();
  };
  assert.deepEqual((await savedPlan()).owned,{});
  await markCrownguard('Received Crownguard; loose components kept.',true);
  await page.evaluate(()=>scrollTo(0,0));
  await toggle.click();
  await add(rod);
  await add(vest);
  await toggle.click();
  for(const width of [390,1440]){
    await page.setViewportSize({width,height:844});
    await page.evaluate(()=>scrollTo(0,0));
    const heroTop=(await hero.boundingBox()).y;
    if(width===390){
      assert.equal(await inViewport(toggle),true);
      assert.equal(await inViewport(stock(rod,1)),true);
      assert.equal(await inViewport(stock(vest,1)),true);
      assert.equal(await bench.isVisible(),false);
      await toggle.click();
    }else{
      assert.equal(await toggle.isVisible(),false);
      const target=await hero.boundingBox();
      assert.ok((await bench.boundingBox()).x>=target.x+target.width);
    }
    assert.equal(await inViewport(bench),true);
    assert.equal((await hero.boundingBox()).y,heroTop);
    assert.equal(await owned(rod).textContent(),'1');
    assert.equal(await owned(vest).textContent(),'1');
    await add(rod);
    assert.equal(await owned(rod).textContent(),'2');
    await page.getByRole('button',{name:'Remove one '+rod,exact:true}).click();
    assert.equal(await owned(rod).textContent(),'1');
    assert.equal(await page.evaluate(()=>scrollY),0);
    if(width===390)await toggle.click();
  }
  await page.setViewportSize({width:390,height:844});

  await markCrownguard('Crownguard marked made.',false);
  await page.getByRole('button',{name:'Record received item',exact:true}).click();
  await page.locator('#receive-search').fill('Crownguard');
  await page.locator('#receive-items [data-receive-item="Crownguard"]').click();
  assert.equal(await page.locator('#completed .completeitem[aria-label^="Crownguard"]').count(),1);
  assert.equal(await owned(rod).textContent(),'1');
  assert.equal(await owned(vest).textContent(),'1');
  await page.locator('#undo').click();
  await page.locator('#undo').click();
  await page.locator('#undo').click();

  const originalQueue = (await savedPlan()).queue;
  assert.equal(originalQueue.length,10);
  assert.deepEqual([originalQueue[0],originalQueue[2]].map(q=>[q.item,q.champion]),[['SpearOfShojin','Ivern'],['BlueBuff','Alune']]);
  const openShojin=()=>page.getByRole('button',{name:'Pivot Spear of Shojin for Ivern',exact:true}).click();
  await openShojin();
  await page.locator('#pivot-search').fill('Spear of Shojin');
  await page.getByText('No matching items.',{exact:true}).waitFor();
  await page.locator('#pivot-search').fill('Blue Buff');
  await checkWidth('#pivot-dialog, .pivot-option, .pivot-actions');
  const confirmation=page.getByRole('dialog',{name:'Confirm item pivot',exact:true});
  const planInstead=id=>page.locator(`[data-pivot-item="${id}"][data-pivot-kind="plan"]`).click();
  const confirmCopy=async (id,message,accept)=>{
    await planInstead(id);
    await confirmation.getByText(message,{exact:true}).waitFor();
    assert.deepEqual((await savedPlan()).queue,originalQueue);
    await confirmation.getByRole('button',{name:accept?'Confirm':'Cancel',exact:true}).click();
    if(accept)await page.locator('#pivot-dialog').waitFor({state:'hidden'});
    else assert.deepEqual((await savedPlan()).queue,originalQueue);
  };
  const blueMessage='Blue Buff is already queued for Alune. Also queue it for Ivern?';
  await confirmCopy('BlueBuff',blueMessage,false);
  assert.deepEqual(await holders('Spear of Shojin'),['For Ivern']);
  assert.deepEqual(await holders('Blue Buff'),['For Alune']);
  await confirmCopy('BlueBuff',blueMessage,true);
  assert.deepEqual((await holders('Blue Buff')).sort(),['For Alune','For Ivern']);
  assert.equal((await savedPlan()).queue.length,10);
  await page.locator('#undo').click();
  await openShojin();
  await page.locator('#pivot-search').fill('Adaptive Helm');
  const helmMessage='Adaptive Helm is already queued for Ivern. Also queue it for Ivern?';
  await confirmCopy('AdaptiveHelm',helmMessage,false);
  await confirmCopy('AdaptiveHelm',helmMessage,true);
  assert.deepEqual(await holders('Adaptive Helm'),['For Ivern','For Ivern']);
  assert.equal((await savedPlan()).queue.length,10);
  await checkWidth('.qcard, .queue-champion, .need');

  const augmentOpen=page.getByRole('button',{name:'Augment choices',exact:true});
  const offerSearch=page.locator('#augment-offer-search');
  await augmentOpen.click();
  await page.locator('[data-augment-round="1"]').click();
  await offerSearch.fill('Beast Within');
  assert.deepEqual(await page.locator('#augment-search-results strong').allTextContents(),['Beast Within','Beast Within+']);
  await offerSearch.fill('Tons of Stats!');
  assert.deepEqual(await page.locator('#augment-search-results strong').allTextContents(),['Tons of Stats!']);
  await offerSearch.press('Enter');
  assert.deepEqual(await page.locator('#augment-search-results .augment-rarity').allTextContents(),['Gold','Prismatic']);
  await offerSearch.fill('Deadlier Caps');
  await offerSearch.press('Enter');
  await page.getByText('Wrong round — Academy lists it for 2-1',{exact:true}).waitFor();
  await page.locator('.augment-offer[data-verdict="avoid"]').getByText('Why and effect',{exact:true}).click();
  await page.getByRole('button',{name:'Enter at 2-1',exact:true}).click();
  assert.equal(await page.locator('[data-augment-round="0"]').getAttribute('aria-pressed'),'true');
  assert.equal((await savedPlan()).augmentOffers.ids[0],'DA_DeadlierCaps');
  await page.getByRole('button',{name:'Close augment chooser',exact:true}).click();
  await page.locator('#undo').click();
  await page.locator('#undo').click();
  await page.locator('#undo').click();

  const lotus='DA_JeweledLotus_I';
  for(const keyboard of [false,true]){
    await augmentOpen.click();
    await offerSearch.fill(keyboard?'Jeweled Lotus':'Jeweled Lotus I');
    if(keyboard){
      await offerSearch.press('ArrowDown');
      await offerSearch.press('ArrowUp');
      await offerSearch.press('Enter');
    }else{
      await page.locator('#augment-search-results').getByText('Jeweled Lotus I',{exact:true}).click();
    }
    assert.equal((await savedPlan()).augmentOffers.ids[0],lotus);
    await page.locator('[data-augment-take="0"]').click();
    assert.equal((await savedPlan()).chosenAugments[0],lotus);
    await page.locator('#undo').click();
    await page.locator('#undo').click();
  }

  await page.getByRole('button',{name:'Explore builds',exact:true}).click();
  await noPivot.waitFor();
  await page.locator('#first-augment-trigger').click();
  await page.locator('#first-augment-choices input').fill('Dark Ritual');
  await page.locator(`[data-option-value="${darkRitual}"]`).click();
  assert.deepEqual(await suggestion('Coven Elise').locator('.academy-tier').allTextContents(),['X · Unlocked','B · Patch 18.7']);
  await alternate.getByRole('button',{name:'Pivot to Coven Elise',exact:true}).click();
  assert.equal(await page.locator('#app-title').textContent(),'Coven Elise');
  await page.getByRole('button',{name:'Pin Tear of the Goddess',exact:true}).click();
  await page.getByRole('button',{name:'Got one Tear of the Goddess from carousel',exact:true}).click();
  assert.equal(await owned('Tear of the Goddess').textContent(),'1');
  await checkWidth('.pivot-section, .qcard, .queue-champion, .board-panel, .need');
  const readyFixture=fixture;
  let releaseRefresh;
  const delayed=new Promise(resolve=>{releaseRefresh=resolve;});
  fixture=async url=>{await delayed;return readyFixture(url);};
  await page.getByRole('button',{name:'Refresh live data',exact:true}).click();
  assert.equal(await page.locator('#meta-status').innerText(),'MetaTFT supplement · checking…');
  fixture=readyFixture;
  releaseRefresh();
  await page.locator('#meta-status').getByText(/Patch 18\.7/).first().waitFor();

  const hex=azirRammus.finalComp.flatMap(u=>academy.champions.find(c=>c.apiName===u.apiName)?.hexIndex||[]);
  const code='02'+hex.map(h=>h.padStart(3,'0')).join('').padEnd(30,'0')+'TFTSet18';
  const beforePaste = await savedPlan();
  await page.evaluate(code=>{
    const data=new DataTransfer();data.setData('text/plain',code);
    document.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));
  },code);
  await page.locator('#app-title').getByText('Azir Rammus',{exact:true}).waitFor();
  await page.locator('.plan-champions > summary').click();
  assert.equal(await page.getByRole('heading',{name:'Current champions',exact:true}).isVisible(),true);
  assert.deepEqual((await savedPlan()).currentUnits,beforePaste.currentUnits);
  const aluneStars=page.getByRole('button',{name:'Alune 2 stars',exact:true});
  await aluneStars.click();
  await page.getByRole('button',{name:'Explore builds',exact:true}).click();
  assert.equal(await aluneStars.getAttribute('aria-pressed'),'true');

  fixture=liveFixture({metaPatch:'18.7',omitAcademyPatch:true,allowOtherUnits:true,
    guides:emblems.guides.map(guide=>guide.title==='AP Fast 9'
      ? {...guide,augments:[{apiName:'DA_UpwardMobility'}]} : guide)});
  await checkEmblemAiming(page,{checkFallback:true,expectedUnownedRank:9});
  await checkAugmentRerolls(page);
  assert.deepEqual(errors,[]);
  console.log('Fixture replay passed at 390px, including emblem Aim, champion portraits, all four augment colors and both rerolls. Components also passed at 1440px. Zero console errors.');
  await page.close();
}

async function replayAugmentFixtures() {
  const liveOffers = new Map(rankReplay.augments.map(augment=>[augment.apiName,augment]));
  const savedChampions = new Map(academy.champions.map(champion=>[champion.apiName,champion]));
  const fixture = liveFixture({
    academyPatch:'18.7',metaPatch:'18.7',allowOtherUnits:true,guides:rankReplay.guides,
    assets:{
      ...rankReplay,
      augments:academy.augments.map(augment=>liveOffers.get(augment.apiName)||augment),
      champions:rankReplay.champions.map(champion=>({...savedChampions.get(champion.apiName),...champion}))
    }
  });
  for (const width of [390,1440]) {
    const page = await newPage(width);
    await routeFixture(page,fixture);
    await page.goto(origin);
    await checkStyleAndText(page,width);
    const alune = await checkEmblemAiming(page,{expectedUnownedRank:8});
    await checkChampionStats(page);
    await checkMarkMade(page);
    await checkAugmentRerolls(page);
    const karma = await checkKarmaBoardAndOffers(page);
    assert.deepEqual([alune.rank,karma.tearOnly.rank,karma.beforeAim.rank,karma.afterAim.rank],[8,8,19,19]);
    await checkCompFlipAndGrants(page);
    await checkAugmentReferencesAndCarousel(page);
    await checkChampionOptionalPlay(page);
    await checkComponentPriorities(page);
    assert.deepEqual(errors,[]);
    console.log(`${width} × 844 · 18.7 fixture · 2-1 offers, rerolls, comp flip, item grants, Yi Rengar #8/#8/#19, Mark made, augment references, menu, Carousel agreement, champion stats, champion-optional play, paste, anvil, P1.17 component priorities and P1.18 style and copy passed · zero console errors`);
    await page.close();
  }
}

async function replayLive() {
  for (const width of [390,1440]) {
    const previousErrors = errors.length;
    const page = await newPage(width,process.env.TFT_BROWSER_IGNORE_HTTPS_ERRORS==='1');
    const sourcePaths = new Set();
    page.on('response',response=>{
      if (!response.ok()) return;
      const {hostname,pathname} = new URL(response.url());
      if (hostname==='tftacademy.com'||hostname==='api-hc.metatft.com') sourcePaths.add(pathname);
    });
    await page.goto(origin);
    await checkStyleAndText(page,width);
    const alune = await checkEmblemAiming(page);
    await checkChampionStats(page);
    await checkMarkMade(page);
    await checkAugmentRerolls(page);
    const karma = await checkKarmaBoardAndOffers(page);
    await checkCompFlipAndGrants(page);
    await checkAugmentReferencesAndCarousel(page);
    await checkChampionOptionalPlay(page);
    await checkComponentPriorities(page);
    console.log(`${width} × 844 · Yi Rengar without Brawler · ${JSON.stringify({alune,karma})}`);
    for (const path of ['/api/tierlist/comps','/api/assets/augments',
      '/tft-stat-api/unit_detail_overall','/tft-stat-api/unit_detail_items','/tft-explorer-api/unit_items']) {
      assert.ok(sourcePaths.has(path),`Missing successful live response for ${path}`);
    }
    assert.deepEqual([alune.rank,karma.tearOnly.rank,karma.beforeAim.rank,karma.afterAim.rank],[8,8,19,19]);
    console.log(`${width} × 844 · Live Set 18 Patch 18.7 · 2-1 offers, rerolls, comp flip, item grants, emblem Aim, portraits, Mark made, augment references, menu, Carousel agreement, champion stats, champion-optional play, paste, anvil, P1.17 component priorities and P1.18 style and copy passed · ${errors.length-previousErrors} console errors`);
    await page.close();
  }
  assert.deepEqual(errors,[]);
}

try {
  if (process.argv.includes('--live')) await replayLive();
  else {
    await replayFixtures();
    await replayAugmentFixtures();
  }
} catch (error) {
  if(errors.length)console.error(errors);
  throw error;
} finally {
  await browser.close();
}
