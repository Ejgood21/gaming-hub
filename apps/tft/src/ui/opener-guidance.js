(() => {
  const priorities = {
    fast9: ['Econ › Item › Combat', 'Item › Combat › Econ', 'Combat › Item › Econ'],
    reroll: ['Item › Combat › Econ', 'Combat › Item › Econ', 'Combat › Item › Econ'],
    flex: ['Item › Combat › Econ', 'Item › Combat › Econ', 'Item › Combat › Econ']
  };
  const panel = document.createElement('section');
  panel.className = 'opener-banner';
  panel.setAttribute('aria-label', OpenerGuidance.label);
  panel.innerHTML = `<h2><a href="${OpenerGuidance.source}" target="_blank" rel="noopener">${OpenerGuidance.label}</a></h2><ul></ul>`;
  const rules = panel.querySelector('ul');
  const priority = document.createElement('p');
  priority.id = 'augment-priority';
  priority.className = 'augment-priority';
  const workspace = document.querySelector('.workspace');
  const shopping = document.querySelector('.shopping');
  document.getElementById('next-build').after(panel, priority);

  function draw() {
    const openers = OpenerGuidance.forPlan(state);
    panel.hidden = !openers.length;
    rules.innerHTML = openers.map(text => `<li>${esc(text)} <small>Patch ${OpenerGuidance.patch}</small></li>`).join('');
    priority.hidden = !state.activeComp;
    if (state.activeComp) {
      // Reviewing the chooser does not advance the next unrecorded round.
      const next = AugmentAdvisor.slots(state).findIndex(id => !id);
      const round = next === -1 ? AugmentAdvisor.stages.length - 1 : next;
      const guide = Academy.currentGuide(state) || Academy.guide(state);
      const style = guide?.style || guide?.title || '';
      const archetype = /reroll/i.test(style) ? 'reroll' : /fast\s*9\b/i.test(style) ? 'fast9' : 'flex';
      priority.textContent = AugmentAdvisor.stages[round] + ': ' + priorities[archetype][round];
      if (shopping.nextElementSibling !== priority) priority.before(shopping);
    } else if (shopping.previousElementSibling !== workspace) {
      workspace.after(shopping);
    }
  }

  const previous = render;
  render = function () { previous(); draw(); };
  render();
})();
