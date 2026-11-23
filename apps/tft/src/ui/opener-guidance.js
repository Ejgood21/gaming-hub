/* Curated from BunnyMuffins' Patch 18.3b opener guidance and the archetypes'
   needs. The groupings apply to augment types, independent of live rankings. */
(() => {
  const priorities = {
    fast9: ['Econ › Item › Combat', 'Item › Combat › Econ', 'Combat › Item › Econ'],
    reroll: ['Item › Combat › Econ', 'Combat › Item › Econ', 'Combat › Item › Econ'],
    flex: ['Item › Combat › Econ', 'Item › Combat › Econ', 'Item › Combat › Econ']
  };
  const banner = document.createElement('div');
  banner.className = 'opener-banner';
  banner.innerHTML = '<small>Opener guidance · Patch 18.3b snapshot</small><p id="opener-guidance"></p>';
  const guidance = banner.querySelector('p');
  const workspace = document.querySelector('.workspace');
  const shopping = document.querySelector('.shopping');
  const nextBuild = document.getElementById('next-build');
  nextBuild.after(banner);

  function openers() {
    const units = CompFinder.units(state);
    const completed = state.queue.filter(q => q.done);
    const owns = apiName => {
      const id = Academy.itemMap.get(apiName);
      return id && completed.some(q => Academy.itemMatches(id, q.item));
    };
    const rules = [];
    if (Academy.live) {
      const guide = slug => Academy.snapshot.guides.find(g => g.compSlug === slug);
      const invoker = guide('set-18-ahri-morgana');
      if (invoker && owns('DA_18_EmblemInvoker')) rules.push('Invoker Emblem → ' + invoker.title);
      const veigar = guide('set-18-dark-mages');
      if (veigar && units.some(u => u.apiName === 'DA_18_Veigar' && u.stars >= 2) &&
          veigar.finalComp.find(u => u.apiName === 'DA_18_Veigar')?.items.some(owns)) {
        rules.push('Veigar 2 + slam → ' + veigar.title);
      }
      const ticket = CompFinder.augment('DA_PrismaticTicket');
      const kayle = guide('set-18-solar-kayle');
      if (kayle && ticket && CompFinder.heldAugments(state).includes(ticket.apiName)) {
        rules.push(ticket.name + ' → ' + kayle.title);
      }
    }
    rules.push(completed.length ? 'Build around your slam' : 'Slam for tempo');
    rules.push(units.some(u => u.stars >= 2) ? 'Play your upgrades' : 'Look for early upgrades');
    return rules.slice(0, 2).join(' · ');
  }

  function draw() {
    const guide = Academy.currentGuide(state) || Academy.guide(state);
    if (state.activeComp) {
      // Use the next unrecorded round so opening or reviewing the chooser cannot
      // change the banner. After the third pick, retain the final round.
      const next = AugmentAdvisor.slots(state).findIndex(id => !id);
      const round = next === -1 ? AugmentAdvisor.stages.length - 1 : next;
      const style = guide?.style || guide?.title || '';
      const archetype = /reroll/i.test(style) ? 'reroll' : /fast\s*9\b/i.test(style) ? 'fast9' : 'flex';
      guidance.textContent = AugmentAdvisor.stages[round] + ': ' + priorities[archetype][round];
      if (shopping.nextElementSibling !== banner) banner.before(shopping);
    } else {
      guidance.textContent = openers();
      if (shopping.previousElementSibling !== workspace) workspace.after(shopping);
    }
  }

  const previous = render;
  render = function () { previous(); draw(); };
  render();
})();
