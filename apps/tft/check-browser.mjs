import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';

const require = createRequire(import.meta.url);
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const liveFixture = require('./test-support/live-fixture');
const academy = require('./data/academy-18.3b.json');
const origin = 'https://carousel.test';
const fixture = liveFixture({omitAcademyPatch:true,allowOtherUnits:true,guides:academy.guides.map(guide =>
  guide.title === 'Aphelios Elderwood' ? {...guide,tier:'X'} : guide
)});
const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH});
try {
  const page = await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const errors = [];
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

  await page.goto(origin);
  await page.getByText('Live · Patch 18.3b',{exact:false}).waitFor();

  await page.locator('#item-drawer summary').click();
  await page.locator('#catalog [data-id="InfinityEdge"]').click();
  await page.locator('#catalog [data-id="Deathblade"]').click();
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
  const elderwood = page.locator('.comp-suggestion').filter({
    has:page.getByRole('heading',{name:'Aphelios Elderwood',exact:true})
  });
  assert.deepEqual(await elderwood.locator('.academy-tier').allTextContents(),['X · Situational','B · Patch 18.3b']);

  const alternate = page.getByRole('region',{name:'If this game changes'});
  assert.equal(await alternate.isVisible(),false);
  await page.locator('#comp-suggestions button[data-choose-comp]:enabled').first().click();
  await alternate.waitFor();
  const before = await page.locator('#app-title').textContent();
  const next = await alternate.locator('p').textContent();
  assert.notEqual(next,before);
  await alternate.getByRole('button',{name:'Choose '+next}).click();
  assert.equal(await page.locator('#app-title').textContent(),next);
  assert.equal(await page.getByRole('status',{name:'B.F. Sword owned',exact:true}).textContent(),'1');
  assert.equal(await page.locator('#completed .completeitem[aria-label^="Guinsoo"]').count(),1);
  await page.locator('#undo').click();
  assert.equal(await page.locator('#app-title').textContent(),before);
  await alternate.waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390);
  assert.deepEqual(errors,[]);
  console.log('Passed at 390px: comp switch and Undo, pivot deduplication, craft guard, secondary tier, carousel receipt and console.');
} finally {
  await browser.close();
}
