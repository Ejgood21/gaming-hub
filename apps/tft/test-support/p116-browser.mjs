import assert from 'node:assert/strict';
import {waitForLive18_7} from './p112-browser.mjs';

const saved = page => page.evaluate(()=>JSON.parse(localStorage.getItem('carousel-tracker-v1')));
const riftbeastRerollCode = '023F742941942640F4283F3401000000TFTSet18';
const apFast9Code = '024203FA4004124184284304043EC000TFTSet18';

function checkImportedPlan(before, after, title) {
  assert.equal(after.activeComp.title,title);
  const targets = after.queue.filter(item=>!item.done);
  assert.ok(targets.length>0);
  assert.ok(targets.every(item=>item.sourceComp===title));
  assert.notDeepEqual(targets.map(item=>item.item),before.queue.filter(item=>!item.done).map(item=>item.item));
  assert.deepEqual(after.currentUnits??[],before.currentUnits??[]);
  assert.deepEqual(after.owned,before.owned);
  assert.deepEqual(after.chosenAugments,before.chosenAugments);
  assert.deepEqual(after.queue.filter(item=>item.done),before.queue.filter(item=>item.done));
}

async function checkAnvil(page) {
  const open = page.getByRole('button',{name:'Anvil choices',exact:true});
  const dialog = page.getByRole('dialog',{name:'Anvil choices',exact:true});
  const button = name => dialog.getByRole('button',{name,exact:true});
  const carousel = await page.locator('#shopping .need [data-action="gain"]').evaluateAll(rows=>rows.map(row=>row.dataset.id));
  const anvil = () => dialog.locator('#anvil-results [data-take-anvil]').evaluateAll(rows=>rows.map(row=>row.dataset.takeAnvil));
  await open.click();
  assert.equal(await button('Components').getAttribute('aria-pressed'),'true');
  const components = await anvil();
  assert.equal(components.length,8);
  assert.deepEqual(components,carousel.filter(id=>components.includes(id)));
  assert.ok(await dialog.locator('.anvil-row').first().locator('.component-shortage').isVisible());
  for (const tab of ['Artifacts','Completed','Radiant','Emblems']) {
    await button(tab).click();
    assert.equal(await button(tab).getAttribute('aria-pressed'),'true');
    assert.ok((await anvil()).some(id=>!components.includes(id)));
  }
  await button('Close anvil choices').click();
  await open.click();
  assert.equal(await button('Components').getAttribute('aria-pressed'),'true');
  assert.deepEqual(await anvil(),components);
  await button('Close anvil choices').click();
}

export async function checkChampionOptionalPlay(page) {
  await page.getByRole('button',{name:'New game',exact:true}).click();
  await waitForLive18_7(page);
  const title = page.locator('#app-title');
  const top = page.locator('#comp-suggestions .comp-suggestion').first();
  const pivot = page.locator('.pivot-section');
  const topTitle = () => top.locator('h3').textContent();
  const nextBuild = () => page.locator('#next-build strong').textContent();
  const carouselTarget = () => page.locator('#shopping .need').first().locator('.carousel-for').textContent();
  await page.getByText('TFT Academy tier list',{exact:true}).waitFor();
  assert.equal(await page.locator('#comp-suggestions [data-effective-score]').count(),0);

  for (const item of ['Needlessly Large Rod','Chain Vest']) {
    await page.getByRole('button',{name:'Got one '+item+' from carousel',exact:true}).click();
  }
  await page.locator('#first-augment-trigger').click();
  await page.locator('#first-augment-choices input').fill('Woven Magic');
  await page.locator('[data-option-value="DA_WovenMagic"]').click();
  await page.locator('#owned-item-search').fill('Deathblade');
  await page.getByRole('button',{name:'Record owned Deathblade',exact:true}).click();
  const best = await topTitle();
  const destination = 'Riftbeast Reroll';
  assert.notEqual(best,destination);
  assert.equal(await top.locator('.finder-rank').textContent(),'1');
  assert.ok(Number(await top.getAttribute('data-fit-score'))>0);
  await top.getByRole('button',{name:'Choose '+best,exact:true}).click();
  await title.getByText(best,{exact:true}).waitFor();
  assert.equal(await pivot.getByRole('button').count(),0);
  assert.match(await pivot.textContent(),/No better fit yet/);
  const beforePaste = await saved(page);
  const bannerBefore = await nextBuild();
  const carouselBefore = await carouselTarget();
  await page.evaluate(code=>{
    const data = new DataTransfer();
    data.setData('text/plain',code);
    document.body.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));
  },riftbeastRerollCode);
  await title.getByText(destination,{exact:true}).waitFor();
  const afterPaste = await saved(page);
  checkImportedPlan(beforePaste,afterPaste,destination);
  await page.locator('.plan-champions > summary').click();
  await page.getByText('No champions recorded.',{exact:true}).waitFor();
  assert.equal(await page.locator('.current-unit').count(),0);
  assert.notEqual(await nextBuild(),bannerBefore);
  assert.notEqual(await carouselTarget(),carouselBefore);
  assert.equal(await carouselTarget(),'For '+await nextBuild());
  assert.equal(await page.locator('#augment-priority').textContent(),'3-2: Combat › Item › Econ');
  await checkAnvil(page);

  await page.getByRole('button',{name:'Augment choices',exact:true}).click();
  const augment = page.locator('#augment-dialog');
  await augment.locator('[data-augment-round="1"]').click();
  await augment.getByRole('searchbox').fill('Jeweled Lotus I');
  await augment.locator('#augment-search-results').getByText('Jeweled Lotus I',{exact:true}).click();
  await augment.getByText('Why and effect',{exact:true}).click();
  await augment.getByText(/Academy recommends this augment for Riftbeast Reroll/).waitFor();
  await augment.getByRole('button',{name:'Close augment chooser',exact:true}).click();

  await page.locator('#explore-mode').click();
  assert.equal(await topTitle(),best);
  await pivot.getByRole('heading',{name:'A better fit for your game',exact:true}).waitFor();
  assert.equal(await pivot.getByRole('button').innerText(),'Pivot to '+best);
  await page.getByRole('button',{name:'Explore emblems',exact:true}).click();
  const emblems = page.locator('#emblem-explorer');
  await emblems.locator('[data-explore-emblem="DA_18_EmblemBrawler"]').click();
  assert.equal(await emblems.getByRole('button',{name:'Choose Adaptor Reroll',exact:true}).isEnabled(),true);
  await page.keyboard.press('Escape');
  await emblems.waitFor({state:'hidden'});

  for (const name of ['Ahri','Caitlyn']) {
    await page.locator('#explore-unit-search').fill(name);
    await page.getByRole('button',{name:'Add '+name,exact:true}).click();
  }
  await page.getByRole('button',{name:'Caitlyn 2 stars',exact:true}).click();
  const beforeDialog = await saved(page);
  assert.deepEqual(beforeDialog.currentUnits,[{apiName:'DA_18_Ahri',stars:1},{apiName:'DA_18_Caitlyn',stars:2}]);
  const paste = page.getByRole('button',{name:'Paste a comp',exact:true});
  await page.evaluate(()=>scrollTo(0,0));
  assert.equal(await page.locator('#utility-menu').getAttribute('open'),null);
  assert.ok(await paste.evaluate(button=>{
    const {left,right,top,bottom,width,height} = button.getBoundingClientRect();
    const hit = document.elementFromPoint((left+right)/2,(top+bottom)/2);
    const newGame = button.nextElementSibling;
    const next = newGame.getBoundingClientRect();
    return newGame.matches('[data-action="reset"]')&&top===next.top&&right<=next.left&&height===next.height&&
      height>=44&&width>=44&&left>=0&&next.right<=innerWidth&&top>=0&&bottom<=innerHeight&&button.contains(hit);
  }));
  if(page.viewportSize().width===390)await paste.tap();
  else await paste.click();
  const dialog = page.getByRole('dialog',{name:'Import a game',exact:true});
  await dialog.getByLabel('TFT Academy team code').fill(apFast9Code);
  await dialog.getByRole('button',{name:'Import',exact:true}).click();
  await dialog.waitFor({state:'hidden'});
  await title.getByText('AP Fast 9',{exact:true}).waitFor();
  checkImportedPlan(beforeDialog,await saved(page),'AP Fast 9');
  if(await page.locator('.plan-champions').getAttribute('open')===null)await page.locator('.plan-champions > summary').click();
  assert.deepEqual(await page.locator('.current-unit strong').allTextContents(),['Ahri','Caitlyn']);
  assert.equal(await page.getByRole('button',{name:'Caitlyn 2 stars',exact:true}).getAttribute('aria-pressed'),'true');
}
