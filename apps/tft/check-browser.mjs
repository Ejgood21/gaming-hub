import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';

const require = createRequire(import.meta.url);
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const liveFixture = require('./test-support/live-fixture');
const academy = require('./data/academy-18.3b.json');
const {apFast9, mamawood, covenElise, solarEclipse, currentUnits, darkRitual} = require('./test-support/p16-comps');
const origin = 'https://carousel.test';
let fixture = liveFixture({omitAcademyPatch:true,allowOtherUnits:true,guides:academy.guides.map(guide =>
  guide.title === 'Aphelios Elderwood' ? {...guide,tier:'X'} : guide
)});
const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH});
const errors = [];
try {
  const page = await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  page.setDefaultTimeout(10000);
  page.on('pageerror', error=>errors.push(error.message));
  page.on('console', message=>{if(message.type()==='error')errors.push(message.text);});
  const html = await readFile(new URL('carousel-companion.html',import.meta.url),'utf8');
  await page.route(origin+'/**',async route=>{
    const path = new URL(route.request().url()).pathname;
    if(path==='/'){
      await route.fulfill({contentType:'text/html',body:html});
    }else{
      await route.fulfill({status:204});
    }
  });
  await page.route(/^https:\/\/(?:tftacademy\.com|api-hc\.metatft\.com)\//,async route=>{
    const response = await fixture(route.request().url());
    await route.fulfill({
      headers:{'Access-Control-Allow-Origin':'*'},
      ...(response.type==='opaque'?{status:204}:{json:await response.json()})
    });
  });
  await page.route(/^https:\/\/(?:assets\.tftacademy\.com|raw\.communitydragon\.org)\//,route=>route.fulfill({
    contentType:'image/gif',body:Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7','base64')
  }));

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
  const choose = title => suggestion(title).locator('[data-choose-comp]').click();
  const alternate = page.locator('.pivot-section');
  const savedPlan = () => page.evaluate(()=>JSON.parse(localStorage.getItem('carousel-tracker-v1')));
  // An offline queue created before the free-form picker was removed.
  await page.addInitScript(() => {
    localStorage.setItem('carousel-tracker-v1', JSON.stringify({
      queue:[{uid:'first',item:'InfinityEdge'},{uid:'second',item:'Deathblade'}],
      owned:{},pins:[]
    }));
  });

  await page.goto(origin);
  await page.getByText('Live · Patch 18.3b',{exact:false}).waitFor();

  assert.equal(await page.getByText('Add an item',{exact:false}).count(),0);
  await page.getByRole('button',{name:'Pivot Deathblade',exact:true}).last().click();
  await page.locator('[data-pivot-item="InfinityEdge"][data-pivot-kind="plan"]').click();
  assert.deepEqual(await page.locator('#queue .qcard h3').allTextContents(),['Infinity Edge']);

  await page.getByRole('button',{name:'Got one B.F. Sword from carousel',exact:true}).click();
  await page.locator('#queue [data-action="make"]').click();
  await page.getByRole('status').filter({hasText:'Record both recipe components'}).waitFor();
  assert.deepEqual(await page.locator('#queue .qcard h3').allTextContents(),['Infinity Edge']);
  assert.equal(await page.getByRole('status',{name:'B.F. Sword owned',exact:true}).textContent(),'1');

  await page.locator('#explore-unit-search').fill('Caitlyn');
  await page.locator('[data-add-unit="DA_18_Caitlyn"]').click();
  await page.getByRole('button',{name:'Caitlyn 2 stars',exact:true}).click();
  await page.locator('#owned-item-search').fill('rageblade');
  await page.locator('[data-owned-quick="GuinsoosRageblade"]').click();
  await page.locator('#finder-more').click();
  assert.deepEqual(await suggestion('Aphelios Elderwood').locator('.academy-tier').allTextContents(),['X · Situational','B · Patch 18.3b']);

  assert.equal(await alternate.isVisible(),false);
  await choose('Ahri Morgana');
  await alternate.getByRole('heading',{name:'A better fit for your board',exact:true}).waitFor();
  const before = await page.locator('#app-title').textContent();
  const pivotAction = alternate.getByRole('button',{name:/^Pivot to /});
  const next = (await pivotAction.textContent()).replace(/^Pivot to /,'');
  assert.notEqual(next,before);
  await pivotAction.click();
  assert.equal(await page.locator('#app-title').textContent(),next);
  assert.equal(await page.getByRole('status',{name:'B.F. Sword owned',exact:true}).textContent(),'1');
  assert.equal(await page.locator('#completed .completeitem[aria-label^="Guinsoo"]').count(),1);
  await page.locator('#undo').click();
  assert.equal(await page.locator('#app-title').textContent(),before);
  await pivotAction.waitFor();

  const azirRammus=academy.guides.find(g=>g.title==='Azir Rammus');
  fixture = liveFixture({metaPatch:'18.7',omitAcademyPatch:true,allowOtherUnits:true,
    guides:[apFast9,mamawood,covenElise,solarEclipse,azirRammus,{...covenElise,id:'unknown-x-guide',title:'X guide without a badge'}]});
  async function startGame(){
    await page.getByRole('button',{name:'New game',exact:true}).click();
    await page.getByText('Live · Patch 18.7',{exact:false}).waitFor();
    for(const {apiName} of currentUnits){
      await page.locator('#explore-unit-search').fill(academy.champions.find(c=>c.apiName===apiName).name);
      await page.locator(`[data-add-unit="${apiName}"]`).click();
    }
    assert.equal(await page.locator('.unit-stars button[data-unit-stars="1"][aria-pressed="true"]').count(),6);
  }

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
  const noPivot=alternate.getByText('No better-fitting pivot available for your board and items.');
  await noPivot.waitFor();
  await alternate.getByRole('heading',{name:'No better fit yet',exact:true}).waitFor();
  assert.equal(await alternate.getByRole('button').count(),0);
  await startGame();
  await choose('AP Fast 9');
  await noPivot.waitFor();
  await checkWidth('.pivot-section, .qcard, .queue-champion, .board-panel, .need');

  const card = name => page.locator('#queue .qcard').filter({has:page.getByRole('heading',{name,exact:true})});
  const holders = name => card(name).locator('.item-owner').allTextContents();
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
  assert.equal(await page.getByRole('status',{name:'Tear of the Goddess owned',exact:true}).textContent(),'1');
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
  await page.evaluate(code=>{
    const data=new DataTransfer();data.setData('text/plain',code);
    document.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));
  },code);
  await page.locator('#app-title').getByText('Azir Rammus',{exact:true}).waitFor();
  await page.locator('.plan-champions > summary').click();
  assert.equal(await page.getByRole('heading',{name:'Current champions',exact:true}).isVisible(),true);
  const azirStars=page.getByRole('button',{name:'Azir 2 stars',exact:true});
  assert.equal(await page.getByRole('button',{name:'Azir 3 stars',exact:true}).getAttribute('aria-pressed'),'true');
  await azirStars.click();
  await page.getByRole('button',{name:'Explore builds',exact:true}).click();
  assert.equal(await azirStars.getAttribute('aria-pressed'),'true');
  assert.deepEqual(errors,[]);
  console.log('390px passed for Explore, comp and item pivots, queue, board, carousel, augments, and refresh. No console errors.');
} catch (error) {
  if(errors.length)console.error(errors);
  throw error;
} finally {
  await browser.close();
}
