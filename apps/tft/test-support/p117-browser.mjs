import assert from 'node:assert/strict';
import {waitForLive18_7} from './p112-browser.mjs';

const sword = 'BFSword';
const gloves = 'SparringGloves';
const saved = page => page.evaluate(()=>JSON.parse(localStorage.getItem('carousel-tracker-v1')));
const lootCopy = /\b(?:odds|bag|tie[-\s]break|prior (?:PvE )?drops?|use loot history to break ties)\b/i;

export async function checkComponentPriorities(page) {
  const seed = complete => ({
    activeComp:{title:'Component priority test'},
    queue:[
      {item:'ThiefsGloves',done:true,used:{[gloves]:2},usedSources:{[gloves]:['loot','loot']}},
      {item:'InfinityEdge'},
      {item:'SpearOfShojin'}
    ],
    owned:{TearOfTheGoddess:1},
    pins:[],
    lootHistory:{complete,counts:{[gloves]:2},loose:{TearOfTheGoddess:['other']}},
    lootTieBreak:false
  });
  const load = async complete => {
    await page.evaluate(plan=>localStorage.setItem('carousel-tracker-v1',JSON.stringify(plan)),seed(complete));
    await page.reload();
    await waitForLive18_7(page);
  };
  const checkCopy = async () => {
    assert.doesNotMatch(await page.locator('body').innerText(),lootCopy);
    assert.equal(await page.locator('.loot-note, .loot-history-label, #loot-enabled, #loot-coverage, #loot-counts').count(),0);
  };
  const shopping = page.locator('#shopping');
  const anvil = page.getByRole('dialog',{name:'Anvil choices',exact:true});
  const openAnvil = () => page.getByRole('button',{name:'Anvil choices',exact:true}).click();
  const closeAnvil = () => anvil.getByRole('button',{name:'Close anvil choices',exact:true}).click();
  const priorities = async (expected,item) => {
    const carousel = await shopping.locator('.decision-need').evaluateAll(rows=>rows.map(row=>({
      id:row.querySelector('.got').dataset.id,
      count:row.querySelector('.component-shortage')?.textContent
    })));
    assert.deepEqual(carousel.filter(row=>row.count).map(row=>[row.id,row.count]),expected);
    assert.equal(carousel.find(row=>row.id==='TearOfTheGoddess').count,undefined);
    if(item){
      assert.equal(await page.locator('#next-build strong').textContent(),item);
      assert.equal(await shopping.locator('.decision-need').first().locator('.carousel-for').textContent(),'For '+item);
    }
    await openAnvil();
    assert.equal(await anvil.getByRole('button',{name:'Components',exact:true}).getAttribute('aria-pressed'),'true');
    const components = await anvil.locator('#anvil-results .anvil-row').evaluateAll(rows=>rows.map(row=>({
      id:row.querySelector('[data-take-anvil]').dataset.takeAnvil,
      count:row.querySelector('.component-shortage')?.textContent?.split(' ')[0]
    })));
    assert.deepEqual(components,carousel);
    await checkCopy();
    await closeAnvil();
    await checkCopy();
  };

  const scarceFirst = [[gloves,'×1'],[sword,'×2']];
  const swordFirst = [[sword,'×2'],[gloves,'×1']];
  await load(true);
  await priorities(scarceFirst,'Infinity Edge');
  assert.equal(await page.locator('.shoppingfoot').textContent(),'Got one = carousel · ★ Pin to put first');

  const pinSword = shopping.getByRole('button',{name:'Pin B.F. Sword',exact:true});
  await pinSword.click();
  await priorities(swordFirst,'Infinity Edge');
  await pinSword.click();

  const moveShojin = page.getByRole('button',{name:'Reorder Spear of Shojin',exact:true});
  await moveShojin.press('Space');
  await moveShojin.press('ArrowUp');
  await moveShojin.press('Enter');
  await priorities(swordFirst,'Spear of Shojin');

  await load(false);
  await priorities(swordFirst,'Infinity Edge');
  await load(true);

  const checkSource = async (sources,count) => {
    const plan = await saved(page);
    assert.deepEqual(plan.lootHistory.loose[gloves],sources);
    assert.equal(plan.lootHistory.counts[gloves],count);
  };
  await shopping.getByRole('button',{name:'Got one Sparring Gloves from carousel',exact:true}).click();
  await checkSource(['carousel'],2);
  assert.equal(await shopping.locator('.decision-need').filter({has:shopping.locator(`[data-action="gain"][data-id="${gloves}"]`)}).locator('.component-shortage').count(),0);
  const toggle = page.locator('#component-toggle');
  if(await toggle.isVisible())await toggle.click();
  await page.getByRole('button',{name:'Add one Sparring Gloves',exact:true}).click();
  await checkSource(['carousel','loot'],3);
  await openAnvil();
  await anvil.getByRole('button',{name:'Record Sparring Gloves from anvil',exact:true}).click();
  await checkSource(['carousel','loot','other'],3);

  await page.getByLabel('More options',{exact:true}).click();
  await page.getByRole('button',{name:'How it works',exact:true}).click();
  await page.locator('#help').waitFor();
  await checkCopy();
  await page.getByRole('button',{name:'Got it',exact:true}).click();

  await page.getByRole('button',{name:'New game',exact:true}).click();
  assert.equal((await saved(page)).lootHistory.complete,true);
}
