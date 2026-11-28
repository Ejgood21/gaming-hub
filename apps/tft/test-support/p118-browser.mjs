import assert from 'node:assert/strict';
import {waitForLive18_7} from './p112-browser.mjs';

const devCopy = /Drag to reorder\. Keyboard|Effective score\s*=|Fit score|live check complete|moving this (?:HTML )?file|Ctrl \+ V anywhere|bounded search|fit estimates|reserved from the top down|stale reference|may be stale|verified\s+\d|\b\d{1,2}:\d{2}:\d{2}\b|\b(?:Need strength now|Strength now)\b/i;

async function checkMainCopy(page) {
  const text = await page.locator('body').innerText();
  assert.doesNotMatch(text,devCopy);
  assert.doesNotMatch(text,/Shift \+ number/i);
  assert.equal(await page.locator('[data-tempo]').count(),0);
  for (const rule of await page.locator('.opener-banner li').allTextContents()) {
    assert.doesNotMatch(rule,/Patch 18\.3b/);
  }
  assert.equal(await page.locator('#saved').innerText(),'Saved in this browser');
  assert.match(await page.locator('#academy-status').innerText(),/^Live · Patch 18\.7/);
  assert.match(await page.locator('.footer').innerText(),/Recipes · Patch 18\.7 · TFT Academy/);
}

async function checkCarouselWidth(page,width) {
  const carousel = page.locator('#shopping');
  const ids = await carousel.locator('.decision-need .got').evaluateAll(nodes=>nodes.map(node=>node.dataset.id));
  const standard = ids.filter(id=>id!=='Spatula' && id!=='FryingPan');
  assert.equal(standard.length,8);
  assert.equal(new Set(standard).size,8);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);
  if (width===1440) {
    assert.ok(await carousel.evaluate(el=>el.scrollWidth<=el.clientWidth),'All desktop needs must fit');
  }
}

export async function checkStyleAndText(page,width) {
  await waitForLive18_7(page);
  await page.getByRole('heading',{name:'Carousel',exact:true}).waitFor();
  await checkMainCopy(page);
  await checkCarouselWidth(page,width);
  await page.getByText('How this is ranked',{exact:true}).click();
  const method = await page.locator('.finder-method[open] p').innerText();
  assert.match(method,/Academy tier/);
  assert.doesNotMatch(method,/\d/);

  const menu = page.getByLabel('More options',{exact:true});
  await menu.click();
  await page.getByRole('button',{name:'How it works',exact:true}).click();
  const help = page.getByRole('dialog',{name:'How it works',exact:true});
  const helpText = await help.innerText();
  assert.ok(helpText.length<1500);
  assert.doesNotMatch(helpText,devCopy);
  for (const label of ['Got one','Mark made','Paste a comp','New game','TFT Academy','MetaTFT','Riot Games','Space','Shift + number']) {
    assert.ok(helpText.includes(label),`Missing Help guidance for ${label}`);
  }
  await help.getByRole('button',{name:'Got it',exact:true}).click();

  await menu.click();
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  const settings = page.getByRole('dialog',{name:'Settings',exact:true});
  const settingsText = await settings.innerText();
  assert.match(settingsText,/before switching browsers/);
  assert.doesNotMatch(settingsText,/MetaTFT connection details|moving this/);
  await settings.getByRole('button',{name:'Close settings',exact:true}).click();

  await page.locator('#first-augment-trigger').click();
  await page.locator('#first-augment-choices input').fill('Woven Magic');
  await page.locator('[data-option-value="DA_WovenMagic"]').click();
  const chooseComp = page.getByRole('button',{name:'Choose AP Fast 9',exact:true});
  if (!await chooseComp.isVisible()) await page.locator('#finder-more').click();
  await chooseComp.click();
  await page.getByRole('heading',{name:'AP Fast 9',exact:true}).waitFor();

  const banner = page.getByRole('button',{name:/^Augment choices, 3-2:/});
  const augment = page.getByRole('dialog',{name:'Choose your augment',exact:true});
  const closeAugment = augment.getByRole('button',{name:'Close augment chooser',exact:true});
  await page.evaluate(()=>scrollTo(0,0));
  assert.equal(await banner.getAttribute('aria-controls'),'augment-dialog');
  assert.ok(await banner.evaluate(el=>el.tagName==='BUTTON' && el.getBoundingClientRect().bottom<innerHeight));
  for (const activate of [()=>banner.click(),()=>banner.press('Enter'),()=>banner.press('Space')]) {
    await activate();
    await augment.waitFor();
    assert.equal(await augment.locator('[data-augment-round="1"]').getAttribute('aria-pressed'),'true');
    await closeAugment.click();
    assert.ok(await banner.evaluate(el=>el===document.activeElement));
  }
  await page.getByRole('button',{name:'Augment choices',exact:true}).click();
  await augment.waitFor();
  await closeAugment.click();

  const priority = page.locator('#academy-priority');
  assert.deepEqual(await priority.locator('.academy-priority-item small').allTextContents(),['Rod','Tear','Belt']);
  assert.doesNotMatch(await priority.innerText(),/\bcomponent\b/i);
  const tips = page.locator('details.tips-panel');
  assert.equal(await tips.evaluate(el=>el.open),false);
  assert.equal((await tips.innerText()).trim(),'Academy tips');
  await tips.locator('summary').click();
  assert.deepEqual(await tips.locator('h3').allTextContents(),['Build','Stage 2','Stage 3','Stage 4']);
  await tips.locator('summary').click();

  for (const part of ['Needlessly Large Rod','Chain Vest','B.F. Sword','Tear of the Goddess']) {
    await page.getByRole('button',{name:'Got one '+part+' from carousel',exact:true}).click();
  }
  await checkMainCopy(page);
  await checkCarouselWidth(page,width);
  const craft = page.locator('#craft-strip');
  assert.ok(await craft.isVisible());
  assert.match(await craft.innerText(),/Crownguard/);
  assert.match(await page.locator('#bench-plan').innerText(),/Build these now/);
  const combination = page.locator('#bench-plan');
  const items = await combination.locator('.decision-item').evaluateAll(nodes=>nodes.map(node=>node.title));
  assert.equal(items.length,2);
  for (const item of items) assert.ok((await combination.innerText()).includes(item));
  await combination.getByRole('button',{name:'Record these items as made',exact:true}).click();
  assert.equal(await page.locator('#completed .completeitem').count(),2);
  await page.locator('#undo').click();
  assert.equal(await page.locator('#completed .completeitem').count(),0);

  await page.getByRole('button',{name:'Anvil choices',exact:true}).click();
  const anvil = page.getByRole('dialog',{name:'Anvil choices',exact:true});
  const anvilText = await anvil.innerText();
  assert.match(anvilText,/×\d+ needed/);
  assert.doesNotMatch(anvilText,/still needed for your queue|Pivot item|Shift \+ number/);
  await anvil.getByRole('button',{name:'Close anvil choices',exact:true}).click();

  const benchPlan = await combination.locator('.decision-item').evaluateAll(nodes=>nodes.map(node=>node.title));
  await page.evaluate(()=>{
    const key = 'carousel-tracker-v1';
    const saved = JSON.parse(localStorage.getItem(key));
    localStorage.setItem(key,JSON.stringify({...saved,tempo:'urgent'}));
  });
  await page.reload();
  await waitForLive18_7(page);
  await page.locator('#meta-status').getByText(/Patch 18\.7/).first().waitFor();
  assert.deepEqual(await combination.locator('.decision-item').evaluateAll(nodes=>nodes.map(node=>node.title)),benchPlan);
  assert.equal(await tips.evaluate(el=>el.open),false);
  await checkMainCopy(page);
}
