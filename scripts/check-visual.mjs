/** Chromium acceptance check. Install playwright separately, or set PLAYWRIGHT_MODULE. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.UI_URL || 'http://127.0.0.1:4173/gaming-hub/';
const baseline = process.env.BASELINE_URL;
const out = process.env.UI_OUTPUT || 'work/visual-check';
await mkdir(out, { recursive: true });
const catalog = JSON.parse(await readFile('apps/wow/config/specs.json', 'utf8'));
const pointer = JSON.parse(await readFile('apps/wow/data/latest.json', 'utf8'));
const bundle = JSON.parse(await readFile(`apps/wow/data/${pointer.patch}/profiles.json`, 'utf8'));
const prompt = await readFile('apps/wow/per-patch-prompt.md', 'utf8');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  headless: true, args: ['--no-sandbox'],
});
const metrics = {}, errors = [];
async function ready(page, url, wow = false) {
  await page.goto(url, { waitUntil: 'networkidle' });
  if (wow) await page.waitForSelector('.wow-app.is-enhanced');
  await page.evaluate(() => document.fonts.ready);
}
async function shot(page, name, fullPage = false) {
  await page.screenshot({ path: path.join(out, `${name}.png`), fullPage });
}
async function count(page, n) {
  await page.waitForFunction(expected => document.querySelectorAll('.spec-card').length === expected, n);
}
async function measure(page, selector, scan = false) {
  if (scan) {
    await page.evaluate(selector => {
      const card = document.querySelector(selector), bar = document.querySelector('.explore-toolbar');
      const top = card.getBoundingClientRect().top + window.scrollY;
      window.scrollTo(0, Math.max(0, top - (bar?.offsetHeight || 0) - 8));
    }, selector);
  } else await page.evaluate(() => window.scrollTo(0, 0));
  return page.evaluate(selector => {
    const cards = [...document.querySelectorAll(selector)];
    const bar = document.querySelector('.explore-toolbar');
    const occluded = window.scrollY > 0 && bar ? bar.getBoundingClientRect().bottom : 0;
    const rects = cards.map(card => card.getBoundingClientRect());
    const words = cards.map(card => card.innerText.trim().split(/\s+/).length);
    const summaries = cards.map(card => card.querySelector('.feel-summary')?.innerText.trim().length || 0);
    const round = n => Math.round(n * 10) / 10;
    return {
      viewport: `${innerWidth}×${innerHeight}`,
      fullyVisible: rects.filter(r => r.top >= occluded && r.bottom <= innerHeight).length,
      intersecting: rects.filter(r => r.bottom > occluded && r.top < innerHeight).length,
      cardHeight: { min: round(Math.min(...rects.map(r => r.height))), max: round(Math.max(...rects.map(r => r.height))) },
      averageWordsPerCard: round(words.reduce((a,b) => a+b,0)/words.length),
      averageSummaryCharacters: round(summaries.reduce((a,b) => a+b,0)/summaries.length),
      maxSummaryCharacters: Math.max(...summaries),
      documentHeight: document.documentElement.scrollHeight,
      gridHeight: round(document.querySelector('.spec-grid,.release-grid').getBoundingClientRect().height),
      firstCardTop: round(rects[0].top), scrollY: round(window.scrollY),
    };
  }, selector);
}
async function noOverflow(page) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Horizontal overflow');
}
try {
  for (const [name, viewport] of Object.entries({ desktop:{width:1440,height:900}, mobile:{width:390,height:844} })) {
    const context = await browser.newContext({ viewport, isMobile:name === 'mobile', hasTouch:name === 'mobile', reducedMotion:'reduce' });
    await context.grantPermissions(['clipboard-read','clipboard-write']);
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(`${name}: ${e.message}`));
    if (baseline) {
      await ready(page, `${baseline}wow/`, true);
      metrics[`${name}BeforeGridLanding`] = await measure(page, '.spec-card');
      await shot(page, `${name}-before-wow`);
      metrics[`${name}BeforeGridScan`] = await measure(page, '.spec-card', true);
      await ready(page, baseline);
      metrics[`${name}BeforeHome`] = await measure(page, '.release-card');
      await shot(page, `${name}-before-home`);
    }
    await ready(page, `${base}wow/`, true);
    await count(page, 40);
    await noOverflow(page);
    metrics[`${name}AfterGridLanding`] = await measure(page, '.spec-card');
    await shot(page, `${name}-after-wow`);
    await shot(page, `${name}-all-specs`, true);
    metrics[`${name}AfterGridScan`] = await measure(page, '.spec-card', true);
    assert.equal(metrics[`${name}AfterGridScan`].cardHeight.min, metrics[`${name}AfterGridScan`].cardHeight.max);
    assert.ok(metrics[`${name}AfterGridScan`].maxSummaryCharacters <= 80);
    const badIcons = await page.locator('.spec-card img').evaluateAll(images => images.filter(img => !img.complete || !img.naturalWidth).map(img => img.src));
    assert.deepEqual(badIcons, [], 'Every card icon must load');
    for (const [selector, expected] of [['.spec-art',40],['.class-name img',13],['.role-art',3]]) {
      assert.equal(await page.locator(`.spec-card ${selector}`).evaluateAll(images => new Set(images.map(img => img.src)).size), expected);
    }
    assert.equal(await page.locator('.spec-card .dimension,.spec-card .coverage,.spec-card .sources').count(),0);
    assert.ok(await page.locator('.spec-card .card-tags').evaluateAll(rows => rows.every(row => row.children.length <= 3)));
    assert.equal(await page.locator('.about-coverage').getAttribute('open'), null);
    await page.locator('.about-coverage>summary').click();
    assert.match(await page.locator('.about-coverage').innerText(), /40\/80/);
    assert.match(await page.locator('.about-coverage').innerText(), /Raid gaps remain explicit/);
    await shot(page, `${name}-coverage`);
    await page.locator('.about-coverage>summary').click();
    // Desktop hover and keyboard, mobile tap. Neither changes card geometry.
    await page.evaluate(() => window.scrollTo(0,0));
    const badge = page.locator('.spec-card .card-tags .peek').first();
    const feel = page.locator('.spec-card .feel-summary').first();
    if (name === 'desktop') {
      await badge.locator('summary').hover();
      assert.ok(await badge.locator('.peek-content').isVisible());
      await shot(page,'desktop-trait-tooltip');
      await page.mouse.move(0,0);
      await feel.locator('summary').hover();
      assert.ok(await feel.locator('.peek-content').isVisible());
      await page.mouse.move(0,0);
      await badge.locator('summary').focus();
      assert.ok(await badge.locator('.peek-content').isVisible());
      await page.locator('.search-box input').focus();
    } else {
      await badge.locator('summary').tap();
      assert.notEqual(await badge.getAttribute('open'),null);
      assert.ok(await badge.locator('.peek-content').isVisible());
      await shot(page,'mobile-trait-expanded');
      await badge.locator('summary').tap();
      assert.equal(await badge.getAttribute('open'),null);
      await feel.locator('summary').tap();
      assert.ok(await feel.locator('.peek-content').isVisible());
      await shot(page,'mobile-summary-expanded');
      await feel.locator('summary').tap();
    }
    await page.getByLabel('Filter by class',{exact:true}).selectOption('Druid');
    await count(page,4);
    await page.getByLabel('Filter by class',{exact:true}).selectOption('all');
    await page.locator('.role-tabs').getByRole('button',{name:'Tank',exact:true}).click();
    await count(page,catalog.filter(spec => spec.role === 'tank').length);
    await page.locator('.role-tabs').getByRole('button',{name:'All roles',exact:true}).click();
    await page.getByLabel('Search specs or classes').fill('Devourer');
    await count(page,1);
    await page.getByLabel('Search specs or classes').fill('');
    await page.locator('.feel-filters').getByRole('button',{name:'Stable rotation',exact:true}).click();
    await count(page,bundle.profiles.filter(p => p.content_type === 'mythic_plus' && p.tags.includes('stable-rotation')).length);
    await page.locator('.feel-filters').getByRole('button',{name:'Stable rotation',exact:true}).click();
    await count(page,40);
    await page.locator('.content-toggle').getByRole('button',{name:'Raid',exact:true}).click();
    await count(page,40);
    await page.locator('.content-toggle').getByRole('button',{name:'Side by side',exact:true}).click();
    const firstSpec = await page.locator('.spec-card').first().getAttribute('data-spec');
    await page.locator('.spec-card h3 button').first().click();
    assert.equal(await page.locator('dialog[open] .profile-detail').count(),2);
    assert.deepEqual(await page.locator('dialog .detail-feel').allTextContents(), ['mythic_plus','raid'].map(content => bundle.profiles.find(p => p.spec_id === firstSpec && p.content_type === content).feel_summary));
    await page.getByRole('button',{name:'Close detail view'}).click();
    await page.locator('.content-toggle').getByRole('button',{name:'Mythic+',exact:true}).click();
    await page.locator('.quick-actions button[aria-label^="Compare"]').nth(0).click();
    await page.locator('.quick-actions button[aria-label^="Compare"]').nth(1).click();
    await page.getByRole('button',{name:'Compare playstyles',exact:true}).click();
    assert.equal(await page.locator('dialog .compare-columns .profile-detail').count(),2);
    await page.getByRole('button',{name:'Close detail view'}).click();
    await page.getByRole('button',{name:'Clear comparison'}).click();
    await page.getByRole('button',{name:'Compact list',exact:true}).click();
    metrics[`${name}AfterListLanding`] = await measure(page,'.spec-card');
    metrics[`${name}AfterListScan`] = await measure(page,'.spec-card',true);
    await shot(page,`${name}-compact-list`);
    await noOverflow(page);
    await page.getByRole('button',{name:'Grid',exact:true}).click();
    await page.getByRole('button',{name:'Group by class',exact:true}).click();
    assert.equal(await page.locator('.class-group').count(),13);
    const group = page.locator('.class-group').first();
    await group.locator('.group-heading').click();
    await count(page,37);
    await page.getByRole('navigation',{name:'Jump to class'}).getByRole('button',{name:'Death Knight',exact:true}).click();
    await count(page,40);
    await page.getByRole('navigation',{name:'Jump to class'}).getByRole('button',{name:'Warrior',exact:true}).click();
    await page.waitForFunction(() => document.querySelector('.explore-toolbar').getBoundingClientRect().top === 0);
    assert.ok(await page.locator('#group-Warrior').evaluate(el => el.getBoundingClientRect().top >= document.querySelector('.explore-toolbar').getBoundingClientRect().bottom));
    await shot(page,`${name}-class-navigation`);
    await page.getByRole('link',{name:'↑ Top',exact:true}).click();
    assert.equal(await page.evaluate(() => scrollY),0);
    await page.getByRole('button',{name:'My taste',exact:false}).click();
    await page.locator('.taste-options').first().getByRole('button',{name:'Direct healing',exact:true}).click();
    assert.ok(await page.evaluate(() => JSON.parse(localStorage.getItem('wow-taste-must')).includes('direct-healing')));
    await page.reload({waitUntil:'networkidle'});
    await page.waitForSelector('.wow-app.is-enhanced');
    assert.equal(await page.locator('.taste-options').first().getByRole('button',{name:'Direct healing',exact:true}).getAttribute('aria-pressed'),'true');
    await page.getByRole('button',{name:'Refresh prompt',exact:true}).click();
    await page.getByRole('button',{name:'Copy prompt',exact:true}).click();
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()),prompt);
    await page.getByRole('button',{name:'Processing',exact:true}).click();
    assert.equal(await page.locator('.processing-row').count(),40);
    await ready(page,base);
    await noOverflow(page);
    metrics[`${name}AfterHome`] = await measure(page,'.release-card');
    await shot(page,`${name}-after-home`);
    await page.getByRole('button',{name:'Firm',exact:true}).click();
    assert.equal(await page.locator('.release-card:visible').count(),1);
    await page.getByRole('button',{name:'All games',exact:false}).click();
    assert.equal(await page.locator('.release-card:visible').count(),4);
    const note = page.locator('.release-note').first();
    await note.locator('summary').click();
    assert.ok(await note.locator('div').isVisible());
    await noOverflow(page);
    await context.close();
  }
  assert.deepEqual(errors,[],'No browser runtime errors');
  await writeFile(path.join(out,'measurements.json'), JSON.stringify(metrics,null,2)+'\n');
  console.log(JSON.stringify(metrics,null,2));
  console.log('Visual acceptance passed: desktop + touch, 40 specs, icons, density, filters, grouping, details, compare, taste, prompt, and releases.');
} finally {
  await writeFile(path.join(out,'measurements.json'),JSON.stringify(metrics,null,2)+'\n');
  await browser.close();
}
