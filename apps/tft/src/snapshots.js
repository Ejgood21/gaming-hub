'use strict';

const ACADEMY_TTL_MS = 24 * 60 * 60 * 1000;
const files = [
  ['academy', 'data/academy-18.3b.json'],
  ['meta', 'data/metatft-18.3b.json'],
  ['core', 'data/core-items.json']
];
const academySource = 'TFT Academy';

function validAcademy(snapshot) {
  return snapshot && typeof snapshot.patch === 'string' && snapshot.patch.trim() &&
    Number.isInteger(snapshot.set) && snapshot.set > 0 &&
    Array.isArray(snapshot.guides) && snapshot.guides.length > 0 && snapshot.guides.length <= 500 &&
    Array.isArray(snapshot.champions) && snapshot.champions.length > 0 &&
    Array.isArray(snapshot.items) && snapshot.items.length > 0 && snapshot.items.length <= 1000;
}

function readAcademyCache(raw, expectedSet, now = Date.now()) {
  const snapshot = JSON.parse(raw || 'null');
  const fetchedAt = Date.parse(snapshot?.fetchedAt);
  const age = now - fetchedAt;
  return validAcademy(snapshot) && snapshot.set === expectedSet && age >= 0 && age < ACADEMY_TTL_MS
    ? snapshot : null;
}

function decodeMetaSnapshot(snapshot) {
  if (!snapshot.itemIds) return snapshot;
  const {itemIds, buildColumns, ...metadata} = snapshot;
  return {
    ...metadata,
    units: snapshot.units.map(unit => ({
      ...unit,
      builds: unit.builds.map(([indices,games,avg,score,tier]) => ({
        items: indices.map(index => itemIds[index]), games, avg, score, tier
      }))
    }))
  };
}

async function loadSnapshots(fallback, pageURL, fetchJSON) {
  if (new URL(pageURL).protocol === 'file:') return fallback;
  const signal = AbortSignal.timeout(5000);
  const loaded = await Promise.all(files.map(async ([key, path]) => {
    try {
      const response = await fetchJSON(new URL(path, pageURL), {signal, credentials: 'omit'});
      if (!response.ok) return fallback[key];
      const snapshot = await response.json();
      const valid = key === 'academy' ? validAcademy(snapshot) :
        key === 'meta' ? Array.isArray(snapshot.units) : Array.isArray(snapshot.items) && Array.isArray(snapshot.components);
      if (valid && snapshot.schemaVersion === fallback[key].schemaVersion &&
          snapshot.set === fallback[key].set && snapshot.patch === fallback[key].patch) {
        return key === 'meta' ? decodeMetaSnapshot(snapshot) : snapshot;
      }
    } catch {
      // The build contains the last known good snapshot for standalone use.
    }
    return fallback[key];
  }));
  return Object.fromEntries(files.map(([key], index) => [key, loaded[index]]));
}

async function refreshAcademy(academy, {fetchJSON, set, bundledSet}) {
  const signal = AbortSignal.timeout(15000);
  async function get(path) {
    const response = await fetchJSON('https://tftacademy.com' + path, {signal, credentials: 'omit'});
    if (!response.ok) throw new Error('TFT Academy returned ' + response.status);
    return response.json();
  }
  try {
    const path = set && set !== bundledSet ? `/tierlist/comps/set${set}/__data.json` : '/tierlist/comps/__data.json';
    const nodes = academy.unpack(await get(path));
    const guideSet = Math.max(...(nodes.find(n => Array.isArray(n?.guides))?.guides || []).map(g => Number(g.set) || 0));
    if (!Number.isInteger(guideSet) || guideSet <= 0 || set && guideSet !== set) {
      throw new Error('That set’s tierlist is not available.');
    }
    const [champions, items, augments] = await Promise.all([
      get(`/api/assets/champions?set=${guideSet}`),
      get(`/api/assets/items?set=${guideSet}`),
      get(`/api/assets/augments?set=${guideSet}`).catch(() => null)
    ]);
    const snapshot = academy.normalize(nodes, champions, items, augments);
    if (!snapshot.augments.length && academy.snapshot.set === guideSet) {
      snapshot.augments = academy.cleanAugments(academy.snapshot.augments);
    }
    academy.useSnapshot(snapshot);
    return {updated: true, notice: ''};
  } catch {
    return {updated: false, notice: 'Refresh unavailable · using saved data'};
  }
}

module.exports = {ACADEMY_TTL_MS, files, academySource, validAcademy, readAcademyCache, decodeMetaSnapshot, loadSnapshots, refreshAcademy};
