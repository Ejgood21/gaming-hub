import assert from 'node:assert/strict';

const brawler = 'DA_18_EmblemBrawler';
const vanguard = 'DA_18_EmblemVanguard';
const board = ['Alune','Ivern','Rakan','Diana','Lillia','Ornn'];
const colors = {
  take:'rgb(73, 199, 128)',
  decent:'rgb(170, 223, 145)',
  reroll:'rgb(109, 170, 255)',
  avoid:'rgb(246, 141, 136)'
};

const saved = page => page.evaluate(()=>JSON.parse(localStorage.getItem('carousel-tracker-v1')));
const choose = (root, title) => root.getByRole('button',{name:'Choose '+title,exact:true});
const suggestion = (page, title) => page.locator('.comp-suggestion').filter({
  has:page.getByRole('heading',{name:title,exact:true})
});
const portrait = row => row.locator('img.champ-icon');

async function fitsWidth(dialog) {
  assert.equal(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
}

export async function waitForLive18_7(page) {
  await page.locator('#academy-status').getByText(/Live · Patch 18\.7/).waitFor({timeout:25000});
  await page.locator('.academy-reference > summary').getByText(/Set 18 · Patch 18\.7/).waitFor();
}

export async function checkEmblemAiming(page, {checkFallback = false} = {}) {
  await page.getByLabel('More options',{exact:true}).click();
  await page.getByRole('button',{name:'New game',exact:true}).click();
  await waitForLive18_7(page);
  const unitSearch = page.locator('#explore-unit-search');
  for (const name of board) {
    await unitSearch.fill(name);
    await page.getByRole('button',{name:'Add '+name,exact:true}).click();
  }
  const title = page.locator('#app-title');
  const undo = page.locator('#undo');
  const emblemDialog = page.getByRole('dialog',{name:'Explore emblems',exact:true});
  const emblemButton = page.getByRole('button',{name:'Explore emblems',exact:true});
  const ownedSearch = page.locator('#owned-item-search');
  await ownedSearch.fill('Brawler');
  await page.getByRole('button',{name:'Record owned Brawler Emblem',exact:true}).click();
  const top = page.locator('.comp-suggestion').first();
  await top.getByRole('heading',{name:'Adaptor Reroll',exact:true}).waitFor();
  assert.deepEqual(await page.locator('.comp-suggestion h3').allTextContents().then(titles=>titles.slice(0,2)),
    ['Adaptor Reroll','Yi Rengar']);
  assert.equal(await suggestion(page,'Adaptor Reroll').locator('.finder-rank').textContent(),'1');
  assert.equal(await suggestion(page,'Yi Rengar').locator('.finder-rank').textContent(),'2');
  await page.getByRole('button',{name:'Explore Brawler Emblem',exact:true}).click();
  const explorer = page.locator('#emblem-explorer');
  await fitsWidth(explorer);
  const brawlerRoutes = explorer.locator('.emblem-route');
  assert.deepEqual(await brawlerRoutes.locator('strong').allTextContents(),
    ['Adaptor Reroll','Yi Rengar','Tempo Riftbeast']);
  assert.equal(await portrait(brawlerRoutes.locator('p')).count(),3);
  const holderIcon = portrait(brawlerRoutes.first().locator('p'));
  assert.match(await holderIcon.getAttribute('src'),/^data:image\//);
  if (checkFallback) {
    await holderIcon.evaluate(image=>image.dispatchEvent(new Event('error')));
    assert.equal(await brawlerRoutes.first().locator('p .champ-fallback').textContent(),'?');
  }
  await choose(brawlerRoutes.first(),'Adaptor Reroll').click();
  await explorer.waitFor({state:'hidden'});
  await title.getByText('Adaptor Reroll',{exact:true}).waitFor();
  const planFromEmblems = await saved(page);
  assert.ok(planFromEmblems.queue.some(item=>!item.done));
  await undo.click();
  await choose(suggestion(page,'Adaptor Reroll'),'Adaptor Reroll').click();
  const planFromBuilds = await saved(page);
  assert.deepEqual(planFromBuilds.activeComp,planFromEmblems.activeComp);
  assert.deepEqual(planFromBuilds.currentUnits,planFromEmblems.currentUnits);
  assert.deepEqual(planFromBuilds.queue.map(({uid,...item})=>item),planFromEmblems.queue.map(({uid,...item})=>item));
  await undo.click();

  await page.getByRole('button',{name:'Remove owned Brawler Emblem',exact:true}).click();
  await page.locator('#finder-more').click();
  const yi = suggestion(page,'Yi Rengar');
  assert.equal(await yi.locator('.finder-rank').textContent(),'9');
  assert.equal(await choose(yi,'Yi Rengar').isEnabled(),true);
  await choose(yi,'Yi Rengar').click();
  await title.getByText('Yi Rengar',{exact:true}).waitFor();
  await undo.click();
  await emblemButton.click();
  await emblemDialog.locator(`[data-explore-emblem="${vanguard}"]`).click();
  const morgana = explorer.locator('.emblem-holder').filter({
    has:page.locator('strong > .inline-entity > span').getByText('Morgana',{exact:true})
  });
  await morgana.waitFor();
  assert.equal(await portrait(morgana.locator(':scope > div > strong')).count(),1);
  await morgana.locator('summary').click();
  await fitsWidth(explorer);
  const ahri = morgana.locator('.emblem-comp').filter({hasText:'Ahri Morgana'});
  assert.equal(await portrait(ahri).count(),1);
  await choose(ahri,'Ahri Morgana').click();
  await explorer.waitFor({state:'hidden'});
  await title.getByText('Ahri Morgana',{exact:true}).waitFor();
  assert.ok((await saved(page)).queue.some(item=>item.champion==='Morgana'));
  await undo.click();
  assert.equal(await page.locator(`#explore-owned-items [data-explore-emblem="${brawler}"]`).count(),0);
  await choose(suggestion(page,'AP Fast 9'),'AP Fast 9').click();
  await title.getByText('AP Fast 9',{exact:true}).waitFor();
  assert.ok(await portrait(page.locator('#next-build')).count()>0);
}

export async function checkMarkMade(page) {
  const card = page.locator('#queue .qcard').filter({has:page.getByRole('heading',{name:'Crownguard',exact:true})});
  const mark = card.getByRole('button',{name:'Mark Crownguard made',exact:true});
  const receive = page.locator('#completed .completeitem[aria-label^="Crownguard"]');
  const undo = page.locator('#undo');
  const rod = page.getByRole('button',{name:'Got one Needlessly Large Rod from carousel',exact:true});
  const vest = page.getByRole('button',{name:'Got one Chain Vest from carousel',exact:true});
  const fit = async () => Number((await page.locator('#comp-fit').innerText()).split('Fit score ').at(-1));
  const before = await fit();
  const carousel = () => page.locator('#shopping .need').allTextContents();
  const needs = await carousel();

  await mark.click();
  await receive.waitFor();
  assert.equal(await page.locator('#toast').textContent(),'Received Crownguard; loose components kept.');
  assert.ok(await fit()>before);
  assert.notDeepEqual(await carousel(),needs);
  await undo.click();
  await rod.click();
  await mark.click();
  await receive.waitFor();
  assert.equal((await saved(page)).owned.NeedlesslyLargeRod,1);
  await undo.click();
  await vest.click();
  await mark.click();
  await receive.waitFor();
  assert.equal(await page.locator('#toast').textContent(),'Crownguard marked made.');
  const made = await saved(page);
  assert.equal(made.owned.NeedlesslyLargeRod,0);
  assert.equal(made.owned.ChainVest,0);
  await undo.click();
}

export async function checkAugmentRerolls(page) {
  const open = page.getByRole('button',{name:'Augment choices',exact:true});
  const close = page.getByRole('button',{name:'Close augment chooser',exact:true});
  const dialog = page.locator('#augment-dialog');
  const search = dialog.getByRole('searchbox');
  const offer = slot => dialog.locator('.augment-offer').nth(slot);
  const summary = dialog.locator('#augment-verdict');
  const enter = async name => {
    await search.fill(name);
    await dialog.locator('#augment-search-results').getByText(name,{exact:true}).click();
  };
  const expectVerdicts = async expected => {
    await fitsWidth(dialog);
    const lines = await summary.evaluate(el=>{
      const range=document.createRange();
      range.selectNodeContents(el);
      return range.getClientRects().length;
    });
    assert.equal(lines,1);
    const rows = await dialog.locator('.augment-offer').evaluateAll(cards=>cards.map(card=>[
      card.dataset.verdict,getComputedStyle(card).borderLeftColor,getComputedStyle(card).backgroundColor
    ]));
    assert.deepEqual(rows.map(([name,border])=>[name,border]),expected.map(name=>[name,colors[name]]));
    assert.equal(new Set(rows.map(row=>row[2])).size,new Set(expected).size);
  };
  const enterThree = async first => {
    await open.click();
    for (const name of [first,'Flowing Tears','Kingslayer']) await enter(name);
  };
  const startReplacement = async (id, name) => {
    await offer(0).getByRole('button',{name:'Reroll this offer',exact:true}).click();
    await offer(0).getByText('Awaiting replacement',{exact:false}).waitFor();
    assert.deepEqual((await saved(page)).augmentOffers.ids,['','DA_FlowingTears','DA_Kingslayer']);
    assert.deepEqual((await saved(page)).augmentOffers.seen,[id]);
    assert.equal(await search.evaluate(el=>el===document.activeElement),true);
    await search.fill(name);
    await dialog.getByText('No remaining matches for this offer.',{exact:true}).waitFor();
    assert.equal(await dialog.locator('#augment-search-results button').count(),0);
    await search.press('Enter');
    assert.equal((await saved(page)).augmentOffers.ids[0],'');
    await close.click();
    await open.click();
    assert.match(await dialog.locator('#augment-search-label').textContent(),/^Offer 1 · enter replacement/);
  };
  async function recordFirst(name,id) {
    await offer(0).getByRole('button',{name:'Took this',exact:true}).click();
    await dialog.waitFor({state:'hidden'});
    assert.equal((await saved(page)).chosenAugments[0],id);
    await page.getByRole('button',{name:'Review '+name+' at 2-1',exact:true}).waitFor();
    await open.click();
    assert.equal(await dialog.locator('[data-augment-round="1"]').getAttribute('aria-pressed'),'true');
    assert.equal(await dialog.locator('.augment-offer[data-verdict]').count(),0);
    await close.click();
  }

  await enterThree('Deadlier Caps');
  await expectVerdicts(['reroll','decent','avoid']);
  assert.equal(await summary.textContent(),'Reroll Deadlier Caps if available');
  await offer(0).getByText('Why and effect',{exact:true}).click();
  await offer(0).getByText(/Same-rarity Academy match.*Upward Mobility/).waitFor();
  await startReplacement('DA_DeadlierCaps','Deadlier Caps');
  await enter('Upward Mobility');
  await expectVerdicts(['take','decent','avoid']);
  assert.equal(await summary.textContent(),'Take Upward Mobility');
  await recordFirst('Upward Mobility','DA_UpwardMobility');

  // Undo the pick and all five edits to start a second 2-1 in the same plan.
  for (let i=0;i<6;i++) await page.locator('#undo').click();

  await enterThree('Upward Mobility');
  await expectVerdicts(['take','decent','avoid']);
  await startReplacement('DA_UpwardMobility','Upward Mobility');
  assert.equal(await summary.textContent(),'Enter the replacement offer');
  await enter('Deadlier Caps');
  await expectVerdicts(['avoid','take','avoid']);
  assert.equal(await summary.textContent(),'Take Flowing Tears');
  assert.equal(await dialog.getByText('Upward Mobility',{exact:false}).count(),0);
  await recordFirst('Deadlier Caps','DA_DeadlierCaps');
}
