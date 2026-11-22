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


const liveTimeout = 15000;
const dayMs = 24 * 60 * 60 * 1000;
const assetKinds = ['champions', 'items', 'augments'];
const academyHost = 'https://tftacademy.com';
const metaHost = 'https://api-hc.metatft.com/tft-stat-api/unit_detail_';

async function getJSON(fetchJSON, url, signal, mode = 'cors') {
  const response = await fetchJSON(url, {signal, credentials: 'omit', cache: 'no-store', mode});
  if (response.type === 'opaque') return null;
  if (!response.ok) throw new Error(new URL(url).host + ' returned HTTP ' + response.status);
  return response.json();
}

function patchId(patch, revision = '') {
  const value = String(patch || '') + String(revision || '');
  return /^\d+\.\d+[a-z]?$/i.test(value) ? value.toLowerCase() : '';
}

function gamePatch(row) {
  return Array.isArray(row.patch) ? patchId(...row.patch) : patchId(row.patch);
}

function metaPatch(overall, items) {
  const days = (overall.games || []).filter(row => row.count > 0 && Number.isInteger(row.day) && row.day > 0);
  const newest = Math.min(...days.map(row => row.day));
  const latest = new Set(days.filter(row => row.day === newest).map(gamePatch));
  const builds = new Set((items.build_games || []).map(row => patchId(row.patch, row.b_patch_version)));
  const [patch] = latest;
  if (!patch || latest.size !== 1 || builds.size !== 1 || !builds.has(patch)) {
    throw new Error('MetaTFT returned inconsistent current patch data');
  }
  return patch;
}

async function fetchMetaTFT(unit, {fetchJSON, signal = AbortSignal.timeout(liveTimeout)}) {
  const params = '?unit=' + encodeURIComponent(unit) +
    '&queue=1100&patch=current&days=3&rank=CHALLENGER,DIAMOND,EMERALD,GRANDMASTER,MASTER,PLATINUM&permit_filter_adjustment=true';
  const [overall, items] = await Promise.all([
    getJSON(fetchJSON, metaHost + 'overall' + params, signal),
    getJSON(fetchJSON, metaHost + 'items' + params + '&num_items=3', signal)
  ]);
  if (overall?.unit !== unit || items?.unit !== unit || overall.tft_set !== items.tft_set) {
    throw new Error('MetaTFT returned a different champion or set');
  }
  return {overall, items, patch: metaPatch(overall, items)};
}

// Academy's current guide API omits the patch ID. Require an Academy update
// inside a full day of MetaTFT's current-only patch window in that case.
function guideUpdateMatchesPatch(sourceUpdated, overall, patch) {
  const updated = Date.parse(sourceUpdated);
  const today = Math.floor(Number(overall.updated) / dayMs) * dayMs;
  const days = (overall.games || []).filter(row => row.count > 0 && Number.isInteger(row.day) && row.day > 0);
  const latestOther = Math.min(...days.filter(row => gamePatch(row) !== patch).map(row => row.day));
  const oldestCurrent = Math.max(...days.filter(row => gamePatch(row) === patch).map(row => row.day));
  const firstFullDay = Math.min(latestOther - 1, oldestCurrent);
  return firstFullDay >= 1 && updated >= today - (firstFullDay - 1) * dayMs &&
    updated <= Number(overall.updated);
}

function verificationUnit(guides, champions) {
  const playable = new Set(champions.filter(unit => unit.cost > 0).map(unit => unit.apiName));
  return guides.find(guide => playable.has(guide.mainChampion?.apiName))?.mainChampion.apiName ||
    playable.values().next().value;
}

async function refreshAcademy(academy, {fetchJSON, set, compactMeta, signal = AbortSignal.timeout(liveTimeout)}) {
  try {
    const get = (path, mode) => getJSON(fetchJSON, academyHost + path, signal, mode);
    const readAssets = gameSet => Promise.all(assetKinds.map(kind => get(`/api/assets/${kind}?set=${gameSet}`)));
    const previous = academy.snapshot;
    const previousUnit = verificationUnit(previous.guides, previous.champions);
    const initialAssets = readAssets(previous.set).catch(error => error);
    const initialMeta = fetchMetaTFT(previousUnit, {fetchJSON, signal}).catch(error => error);
    // The legacy route no longer allows CORS. A browser can still request it
    // without a CORS error, and same-origin clients can read its patch field.
    const legacy = await get('/tierlist/comps/__data.json', 'no-cors');
    const nodes = legacy ? academy.unpack(legacy) : [];
    let guideData = nodes.find(node => Array.isArray(node?.guides));
    if (!guideData) guideData = await get('/api/tierlist/comps');
    const guides = guideData?.guides?.filter(guide => guide.isPublic && Array.isArray(guide.finalComp)) || [];
    const guideSet = Math.max(...guides.map(guide => Number(guide.set) || 0));
    if (!Number.isInteger(guideSet) || guideSet <= 0 || set && guideSet !== set) {
      throw new Error('TFT Academy returned a different or empty set');
    }
    const currentGuides = guides.filter(guide => Number(guide.set) === guideSet);
    const assets = guideSet === previous.set ? await initialAssets : await readAssets(guideSet);
    if (assets instanceof Error) throw assets;
    const [champions, items, augments] = assets;
    for (const [kind, assets] of Object.entries({champions, items, augments})) {
      if (!Array.isArray(assets?.[kind]) || !assets[kind].length ||
          assets[kind].some(asset => asset.set != null && Number(asset.set) !== guideSet)) {
        throw new Error('TFT Academy returned missing or mismatched ' + kind);
      }
    }
    const previousUnitIsCurrent = guideSet === previous.set &&
      champions.champions.some(unit => unit.apiName === previousUnit && unit.cost > 0);
    const unit = previousUnitIsCurrent ? previousUnit : verificationUnit(currentGuides, champions.champions);
    if (!unit) throw new Error('No current champion to verify against MetaTFT');
    const meta = previousUnitIsCurrent ? await initialMeta : await fetchMetaTFT(unit, {fetchJSON, signal});
    if (meta instanceof Error) throw meta;
    if (meta.overall.tft_set !== 'TFTSet' + guideSet) throw new Error('Academy and MetaTFT sets differ');
    const academyPatch = nodes.find(node => node?.patch)?.patch || guideData.patch;
    const guideUpdated = currentGuides.map(guide => String(guide.updated || '').replace(' ', 'T'))
      .filter(date => Number.isFinite(Date.parse(date))).sort((a, b) => Date.parse(a) - Date.parse(b)).at(-1);
    const sourceUpdated = guideData.lastUpdated || nodes.find(node => node?.lastUpdated)?.lastUpdated || guideUpdated;
    if (academyPatch ? patchId(academyPatch) !== meta.patch :
        !guideUpdateMatchesPatch(String(sourceUpdated).replace(' ', 'T'), meta.overall, meta.patch)) {
      throw new Error('Academy and MetaTFT patches could not be matched');
    }
    const snapshot = academy.normalize([{guides: currentGuides, patch: meta.patch, lastUpdated: sourceUpdated}],
      champions, items, augments);
    const stats = compactMeta(meta.overall, meta.items, meta.patch);
    signal.throwIfAborted();
    return {updated: true, snapshot, stats};
  } catch (error) {
    return {updated: false, notice: error.name === 'TimeoutError' ? 'Live data refresh timed out' : error.message};
  }
}

async function refreshLiveData({Academy, MetaBuilds}, options) {
  const revision = ++Academy.revision;
  Academy.live = false;
  const result = await refreshAcademy(Academy, {...options, compactMeta: MetaBuilds.compact});
  if (revision !== Academy.revision) return {updated: false, superseded: true};
  if (result.updated) {
    Academy.useSnapshot(result.snapshot);
    MetaBuilds.cache({...result.stats, fetchedAt: Date.now()}, 'live');
    Academy.liveMetaUnit = result.stats.unit;
    Academy.live = true;
  }
  return result;
}

module.exports = {ACADEMY_TTL_MS, files, academySource, validAcademy, readAcademyCache, decodeMetaSnapshot, loadSnapshots, refreshLiveData, fetchMetaTFT};
