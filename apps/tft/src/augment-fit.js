'use strict';

module.exports = function createAugmentFit({Academy, DATA, byId}) {
  const manaItems = new Set(['BlueBuff', 'SpearOfShojin', 'AdaptiveHelm', 'NashorsTooth', 'ProtectorsVow']);
  const leveling = /fast\s*(8|9|10)\b/i;
  const recommendation = (guide, id) => guide?.mainAugment?.apiName === id ? 'featured' :
    guide?.augments?.some(a => a.apiName === id) ? 'listed' : '';

  function context(plan, guide, targets, placedItems) {
    const needed = {};
    for (const {item} of targets) {
      for (const part of byId[item]?.recipe || []) needed[part] = (needed[part] || 0) + 1;
    }
    for (const part of Object.keys(needed)) needed[part] = Math.max(0, needed[part] - (plan.owned[part] || 0));
    const champions = new Map(Academy.snapshot.champions.map(unit => [unit.apiName, unit]));
    const carries = (guide?.finalComp || []).flatMap(unit => {
      const champion = champions.get(unit.apiName);
      return champion&&(unit.items.length||unit.apiName===guide.mainChampion?.apiName) ?
        [{...champion,boardIndex:unit.boardIndex}] : [];
    });
    const planItems = [...new Set([...targets.map(t => t.item), ...placedItems])];
    return {needed, carries, planItems, style: `${guide?.style || ''} ${guide?.title || ''}`};
  }

  function rule(augment, {needed, carries, planItems, style}) {
    const text = augment.description || '';
    const normalized = Academy.normalizeName(text);
    const component = DATA.components.find(part => needed[part.id] && normalized.includes(Academy.normalizeName(part.name)));
    const item = planItems.map(id => byId[id]).find(item => item?.name.length > 5 && normalized.includes(Academy.normalizeName(item.name)));
    const grants = /\b(?:gain|grants?|choose|receive)\b/i.test(text);
    const casters = carries.filter(unit => /Caster/i.test(unit.role));
    const level = Number(style.match(leveling)?.[1]);

    if (component && grants) return {points: 4, text: 'Offers a component your current targets need', detail: component.name};
    if (item && /gain|grant|holders|give|receive|choose|works/i.test(text)) {
      return {points: 5, text: 'Supports an item in your build', detail: item.name};
    }
    if (/\b(?:random (?:item )?components?|component anvils?|gain \d+ (?:item )?components?|choose \d+ of \d+ components?)\b/i.test(text) && grants) {
      const breadth = Object.values(needed).filter(Boolean).length;
      if (!breadth) return;
      if (/\bmana spent\b/i.test(text) && casters.length && planItems.some(id => manaItems.has(id))) {
        return {points: Math.min(8, 3 + casters.length + Math.floor(breadth / 3)), text: 'Component generation feeds your item plan and rewards Mana spent by your casters'};
      }
      return {points: Math.min(4, Math.ceil(breadth / 2)), text: 'Random components can fill your remaining recipes'};
    }
    if (level && /\b(?:buying|buy) XP\b|\bXP costs?\b/i.test(text)) {
      return {points: 7, text: `More efficient XP purchases help you reach level ${level}`};
    }
    if (level && /\bxp\b|\blevel up\b/i.test(text)) {
      return {points: 7, text: 'Extra XP helps reach the levels your comp needs'};
    }
    if (/\bshop rerolls?\b|\bshop refresh(?:es)?\b|\bfree rerolls?\b|duplicator/i.test(text) && /reroll/i.test(style)) {
      return {points: 5, text: 'Shop rerolls or extra copies help find your upgrades'};
    }
    if (/\bgain \d+ gold\b/i.test(text) && level && !/item|component|champion|combat/i.test(text)) {
      const payoffLevel = Number(text.match(/reach level (\d+)/i)?.[1]);
      if (payoffLevel > level) return;
      return payoffLevel ? {points: 4, text: `Gold at level ${payoffLevel} rewards your leveling route`} :
        {points: 4, text: 'Extra gold helps fund leveling'};
    }
    if (/\b(?:their holders|holders of|will always give your champions ideal items)\b/i.test(text)) return;
    if (!/\b(?:gains?|gaining|grants?|gets?|deal|have|receive|increase)\b/i.test(text)) return;
    const cost = Number(text.match(/(?:your|allied) (\d)-cost champions/i)?.[1]);
    const backRow = /back row/i.test(text);
    const eligible = carries.filter(unit => (!cost||unit.cost===cost)&&(!backRow||unit.boardIndex>=21));
    const benefits = [
      [/\b(?:starting mana|mana regen|restore mana|gain \d+ mana)\b/i, unit => /Caster/i.test(unit.role), 'Mana helps your casters use their abilities'],
      [/\bability power\b/i, unit => /Magic (?!Tank)/i.test(unit.role), 'Ability Power supports your magic damage dealers'],
      [/\battack damage\b/i, unit => /Attack (?!Tank)/i.test(unit.role), 'Attack Damage supports your physical damage dealers'],
      [/\battack speed\b/i, unit => /Marksman/i.test(unit.role), 'Attack Speed supports your marksmen'],
      [/\b(?:damage amp|critical strike)\b/i, unit => !/Tank/i.test(unit.role), 'Combat stats support your damage dealers'],
      [/\b(?:armor|magic resist|durability|max health)\b/i, unit => /Tank/i.test(unit.role), 'Defensive stats support your tanks']
    ];
    const benefit = benefits.find(([effect, role]) => effect.test(text) && eligible.some(role));
    if (benefit) return {points: 4, text: benefit[2], detail: [...new Set(eligible.filter(benefit[1]).map(unit => unit.name))].join(', ')};
  }

  return {
    context,
    recommendation,
    hasRecommendations: guide => !!(guide?.mainAugment?.apiName || guide?.augments?.length),
    score(augment, guide, fitContext) {
      const academy = recommendation(guide, augment.apiName);
      if (academy === 'featured') return {points: 18, text: 'Academy featured augment', academy};
      if (academy === 'listed') return {points: 14, text: 'Academy recommends this augment', academy};
      const match = rule(augment, fitContext);
      return match ? {...match, recommended: match.points >= 3} : {points: 0, text: 'No specific item, economy or combat match'};
    }
  };
};
