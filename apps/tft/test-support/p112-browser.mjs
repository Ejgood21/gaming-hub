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

async function namedVerdict(card, verdict, line) {
  const title = card.locator('.augment-verdict-line');
  assert.equal(await title.isVisible(),true);
  assert.equal(await title.textContent(),line);
  assert.equal(await title.evaluate(el=>{
    const range = document.createRange();
    range.selectNodeContents(el);
    return range.getClientRects().length;
  }),1);
  assert.equal(await card.getAttribute('data-verdict'),verdict);
  assert.equal(await card.evaluate(el=>getComputedStyle(el).borderLeftColor),colors[verdict]);
}

async function yiRank(page) {
  const row = suggestion(page,'Yi Rengar');
  if (!await row.isVisible()) await page.locator('#finder-more').click();
  assert.equal(await choose(row,'Yi Rengar').isEnabled(),true);
  return {
    rank:Number(await row.locator('.finder-rank').textContent()),
    fit:Number(await row.getAttribute('data-fit-score')),
    effective:Number(await row.getAttribute('data-effective-score'))
  };
}

export async function waitForLive18_7(page) {
  await page.locator('#academy-status').getByText(/Live · Patch 18\.7/).waitFor({timeout:25000});
  await page.locator('.academy-reference > summary').getByText(/Set 18 · Patch 18\.7/).waitFor();
}

export async function checkEmblemAiming(page, {checkFallback = false, expectedUnownedRank} = {}) {
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
  // Both Aim actions should use the same live item-build data for the emblem holder.
  await page.evaluate(()=>window.MetaReference.open('Master Yi'));
  await page.locator('#reference-data-summary').getByText(/^[1-9]\d* builds · live$/).waitFor();
  await page.getByRole('button',{name:'Close builds',exact:true}).click();
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
  const withoutBrawler = await yiRank(page);
  if (expectedUnownedRank !== undefined) assert.equal(withoutBrawler.rank,expectedUnownedRank);
  const yi = suggestion(page,'Yi Rengar');
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
  return withoutBrawler;
}

export async function checkKarmaBoardAndOffers(page) {
  await page.getByRole('button',{name:'New game',exact:true}).click();
  await waitForLive18_7(page);
  const champions = ['Karma','Veigar','Ahri','Lux','Morgana','Lillia'];
  for (const name of champions) {
    await page.locator('#explore-unit-search').fill(name);
    await page.getByRole('button',{name:'Add '+name,exact:true}).click();
  }
  const bench = page.locator('#component-toggle');
  const collapsibleBench = await bench.isVisible();
  if (collapsibleBench) await bench.click();
  await page.getByRole('button',{name:'Add one Tear of the Goddess',exact:true}).click();
  if (collapsibleBench) await bench.click();
  const tearOnly = await yiRank(page);
  await page.locator('#owned-item-search').fill('Crownguard');
  await page.getByRole('button',{name:'Record owned Crownguard',exact:true}).click();
  const beforeAim = await yiRank(page);
  const before = await saved(page);

  await page.getByRole('button',{name:'Explore emblems',exact:true}).click();
  const explorer = page.locator('#emblem-explorer');
  await explorer.locator(`[data-explore-emblem="${brawler}"]`).click();
  await choose(explorer,'Yi Rengar').click();
  await explorer.waitFor({state:'hidden'});
  await page.locator('#app-title').getByText('Yi Rengar',{exact:true}).waitFor();
  const after = await saved(page);
  assert.deepEqual(after.currentUnits,before.currentUnits);
  assert.deepEqual(after.owned,{TearOfTheGoddess:1});
  assert.deepEqual(after.queue.filter(item=>item.done).map(item=>item.item),['Crownguard']);
  await page.locator('#explore-mode').click();
  const afterAim = await yiRank(page);
  assert.equal(afterAim.fit,beforeAim.fit);
  assert.equal(afterAim.effective,beforeAim.effective);
  await page.locator('#explore-mode').click();

  await page.getByRole('button',{name:'Augment choices',exact:true}).click();
  const dialog = page.locator('#augment-dialog');
  const search = dialog.getByRole('searchbox');
  assert.equal(await dialog.locator('[data-augment-round="0"]').getAttribute('aria-pressed'),'true');
  for (const name of ['Buried Treasures III','Jeweled Lotus I',"Pandora's Items"]) {
    await search.fill(name);
    await dialog.locator('#augment-search-results').getByText(name,{exact:true}).click();
  }
  const cards = dialog.locator('.augment-offer');
  assert.deepEqual(await cards.locator('.augment-phrase').allTextContents(),[
    'Fits your comp','Wrong round — Academy lists it for 3-2 and 4-2','Decent for your comp'
  ]);
  assert.equal(await cards.locator('details[open], .augment-fit-label, .augment-rarity').count(),0);
  assert.equal(await dialog.getByText('How this is compared',{exact:true}).count(),0);
  assert.equal(await cards.nth(1).getByText(/Jeweled Lotus I is listed by Academy/).isVisible(),false);
  await cards.nth(1).getByText('Why and effect',{exact:true}).click();
  await cards.nth(1).getByText(/Jeweled Lotus I is listed by Academy for 3-2 and 4-2/).waitFor();
  await cards.nth(1).getByText('Why and effect',{exact:true}).click();
  assert.equal(await cards.locator('details[open]').count(),0);
  await namedVerdict(cards.nth(0),'take','Take Buried Treasures III');
  await namedVerdict(cards.nth(1),'avoid','Do not take Jeweled Lotus I');
  await namedVerdict(cards.nth(2),'decent',"Decent: Pandora's Items");
  assert.equal(await dialog.locator('#augment-verdict').textContent(),'Take Buried Treasures III');
  await fitsWidth(dialog);
  await page.getByRole('button',{name:'Close augment chooser',exact:true}).click();
  return {tearOnly,beforeAim,afterAim};
}

export async function checkMarkMade(page) {
  const card = page.locator('#queue .qcard').filter({has:page.getByRole('heading',{name:'Crownguard',exact:true})});
  const mark = card.getByRole('button',{name:'Mark Crownguard made',exact:true});
  const receive = page.locator('#completed .completeitem[aria-label^="Crownguard"]');
  const undo = page.locator('#undo');
  const rod = page.getByRole('button',{name:'Got one Needlessly Large Rod from carousel',exact:true});
  const vest = page.getByRole('button',{name:'Got one Chain Vest from carousel',exact:true});
  const fit = async () => Number(await page.locator('#comp-fit').getAttribute('data-fit-score'));
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
  await namedVerdict(offer(0),'reroll','Reroll: Deadlier Caps');
  assert.equal(await offer(0).locator('.augment-phrase').textContent(),'Reroll this one');
  assert.deepEqual(await offer(0).evaluate(card=>{
    const reroll=card.querySelector('[data-offer-replace]').getBoundingClientRect();
    const take=card.querySelector('[data-augment-take]').getBoundingClientRect();
    return [reroll.height>=44,reroll.width>take.width,reroll.left>take.right,reroll.right<card.getBoundingClientRect().right];
  }),[true,true,true,true]);
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

export async function checkCompFlipAndGrants(page) {
  const dialog = page.locator('#augment-dialog');
  const open = page.getByRole('button',{name:'Augment choices',exact:true});
  const close = page.getByRole('button',{name:'Close augment chooser',exact:true});
  const search = dialog.getByRole('searchbox');
  const offer = slot => dialog.locator('.augment-offer').nth(slot);
  const enter = async name => {
    await search.fill(name);
    await dialog.locator('#augment-search-results').getByText(name,{exact:true}).click();
  };
  const aim = async title => {
    await page.locator('#explore-mode').click();
    const row = suggestion(page,title);
    if (!await row.isVisible()) await page.locator('#finder-more').click();
    await choose(row,title).click();
    await page.locator('#app-title').getByText(title,{exact:true}).waitFor();
  };
  await aim('AP Fast 9');
  await open.click();
  for (const [slot,name] of ['Upward Mobility','Speedy Double Kill','Kingslayer'].entries()) {
    await offer(slot).locator('[data-offer-edit]').click();
    await enter(name);
  }
  await namedVerdict(offer(0),'take','Take Upward Mobility');
  const before = (await saved(page)).augmentOffers.ids;
  await close.click();

  await aim('Mamawood');
  await open.click();
  assert.deepEqual((await saved(page)).augmentOffers.ids,before);
  await namedVerdict(offer(0),'avoid','Do not take Upward Mobility');
  assert.equal(await offer(0).locator('.augment-phrase').textContent(),'Only fits AP Fast 9');
  await namedVerdict(offer(1),'take','Take Speedy Double Kill');

  const checkGrant = async (slot, item, name) => {
    const before = await saved(page);
    const count = state => state.queue.filter(row=>row.done&&row.item===item).length;
    const previousCount = count(before);
    await offer(slot).getByRole('button',{name:'Took this',exact:true}).click();
    await dialog.waitFor({state:'hidden'});
    const after = await saved(page);
    assert.equal(count(after),previousCount+1);
    assert.deepEqual(after.owned,before.owned);
    assert.equal(await page.locator('#toast').textContent(),`Augment recorded. Added ${name}.`);
    await page.locator(`#completed .completeitem[aria-label^="${name}"]`).first().waitFor();
    await page.locator('#undo').click();
    const restored = await saved(page);
    assert.deepEqual(restored.queue,before.queue);
    assert.deepEqual(restored.chosenAugments,before.chosenAugments);
  };
  await checkGrant(1,'GuinsoosRageblade',"Guinsoo's Rageblade");
  await open.click();
  await offer(0).locator('[data-offer-edit]').click();
  await enter('Solo Plate');
  await checkGrant(0,'GargoyleStoneplate','Gargoyle Stoneplate');
}

export async function checkAugmentReferencesAndCarousel(page) {
  const menu = page.locator('#utility-menu');
  const more = page.getByLabel('More options',{exact:true});
  const newGame = page.getByRole('button',{name:'New game',exact:true});
  await page.evaluate(()=>scrollTo(0,0));
  assert.equal(await menu.getAttribute('open'),null);
  assert.ok(await newGame.evaluate(button=>{
    const {left,right,top,bottom,height} = button.getBoundingClientRect();
    const hit = document.elementFromPoint((left+right)/2,(top+bottom)/2);
    return height>=44&&left>=0&&right<=innerWidth&&top>=0&&bottom<=innerHeight&&button.contains(hit);
  }));
  if(page.viewportSize().width===390)await newGame.tap();
  else await newGame.click();
  assert.equal((await saved(page)).queue.length,0);
  for (const [label,id] of [['Import a game','team-code-dialog'],['How it works','help'],['Settings','settings-dialog']]) {
    await more.click();
    assert.deepEqual(await menu.locator('.utility-options button').allTextContents(),['Import a game','How it works','Settings']);
    await menu.getByRole('button',{name:label,exact:true}).click();
    const dialog = page.locator('#'+id);
    await dialog.waitFor();
    await page.keyboard.press('Escape');
    await dialog.waitFor({state:'hidden'});
  }

  const select = async title=>{
    await waitForLive18_7(page);
    const unitSearch=page.locator('#explore-unit-search');
    for(const name of ['Ahri','Morgana']){
      await unitSearch.fill(name);
      await page.getByRole('button',{name:'Add '+name,exact:true}).click();
    }
    const button=choose(suggestion(page,title),title);
    if(!await button.isVisible())await page.locator('#finder-more').click();
    await button.click();
    await page.locator('#app-title').getByText(title,{exact:true}).waitFor();
  };
  await select('Ahri Morgana');
  const next=page.locator('#next-build strong');
  const first=page.locator('#shopping .decision-need').first();
  assert.equal(await next.textContent(),'Spear of Shojin');
  assert.match(await first.locator('[data-action="pin"]').getAttribute('data-id'),/^(TearOfTheGoddess|BFSword)$/);
  assert.equal(await first.locator('.carousel-for').textContent(),'For Spear of Shojin');
  const belt=page.locator('#shopping [data-action="pin"][data-id="GiantsBelt"]');
  assert.equal(await belt.locator('..').locator('.component-shortage').textContent(),'×4');
  await belt.click();
  assert.equal(await next.textContent(),'Spear of Shojin');
  assert.equal(await first.locator('[data-action="pin"]').getAttribute('data-id'),'GiantsBelt');
  assert.equal(await first.locator('.carousel-pin-label').textContent(),'Pinned');
  assert.notEqual(await first.locator('.carousel-for').textContent(),'For Spear of Shojin');
  await first.locator('[data-action="pin"]').click();
  assert.equal(await first.locator('.carousel-for').textContent(),'For Spear of Shojin');

  await newGame.click();
  await select('Spellweaver Ahri');
  const dialog=page.locator('#augment-dialog');
  const search=dialog.getByRole('searchbox');
  const close=()=>dialog.getByRole('button',{name:'Close augment chooser',exact:true}).click();
  const reference=dialog.locator('#augment-reference .augment-offer');
  const entries=[
    ['A.F.K.','AFK','avoid','Do not take A.F.K.','Outside the current augment pool',/17 gold/],
    ['Manaflow I','Manaflow I','avoid','Do not take Manaflow I','Outside the current augment pool',/2 extra Mana per attack/],
    ['Spellweaver Emblem','Spellweaver Emblem','take','Take Spellweaver Emblem','Emblem fits your comp',/holder gains the Spellweaver trait/]
  ];
  for(const [name,alias,verdict,line,phrase,effect] of entries){
    const check=async ()=>{
      await namedVerdict(reference,verdict,line);
      assert.equal(await reference.locator('.augment-phrase').textContent(),phrase);
      await reference.getByText('Why and effect',{exact:true}).click();
      await reference.locator('.augment-description').getByText(effect).waitFor();
      assert.equal(await reference.getByRole('button',{name:'Took this',exact:true}).count(),0);
    };
    await page.getByRole('button',{name:'Augment choices',exact:true}).click();
    await search.fill(name);
    await dialog.locator('#augment-search-results button').filter({hasText:name}).click();
    await check();
    await close();

    await page.locator('#explore-mode').click();
    await page.getByRole('button',{name:'First augment',exact:true}).click();
    await page.getByRole('searchbox',{name:'Search first augment',exact:true}).fill(alias);
    await page.locator('#first-augment-choices button').filter({hasText:name}).click();
    await check();
    await close();
    await page.locator('#explore-mode').click();
    assert.equal((await saved(page)).firstAugment||'','');
  }
}

export async function checkChampionStats(page) {
  const reference=page.locator('#meta-reference');
  for(const name of ['Ivern','Alune','Morgana','Sentinel']){
    await page.locator(`#position-board [data-champion-builds="${name}"]`).click();
    await reference.locator('#reference-data-summary').getByText(/^[1-9]\d* builds · live$/).waitFor();
    await reference.locator('.reference-build .build-games').first().waitFor();
    await reference.getByRole('button',{name:'Close builds',exact:true}).click();
  }
}
