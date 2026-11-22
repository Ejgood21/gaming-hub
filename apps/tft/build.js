'use strict';

const {readFileSync, readdirSync, writeFileSync} = require('node:fs');
const {join} = require('node:path');
const {gzipSync} = require('node:zlib');
const {files, decodeMetaSnapshot} = require('./src/snapshots');

const read = path => readFileSync(join(__dirname, path), 'utf8');
const fallback = Object.fromEntries(files.map(([key, path]) => [key, JSON.parse(read(path))]));

// Reference and pivot flows only read S/A. The hosted dataset keeps all
// source rows, including the unfiltered placement and frequency statistics.
fallback.meta = decodeMetaSnapshot(fallback.meta);
fallback.meta.units = fallback.meta.units.map(unit => ({
  ...unit,
  builds: unit.builds.filter(build => build.tier === 'S' || build.tier === 'A')
}));

const embedded = gzipSync(JSON.stringify(fallback)).toString('base64');

const modules = readdirSync(join(__dirname, 'src')).filter(name => name.endsWith('.js')).sort();
const definitions = modules.map(name => {
  const id = './' + name.slice(0,-3);
  return `${JSON.stringify(id)}: (module, require) => {\n${read('src/' + name)}\n}`;
}).join(',\n');

const screens = [
  'augment-icon', 'icons', 'tracker', 'item-picker', 'settings', 'academy',
  'inventory', 'meta-live', 'meta-reference', 'board', 'dialogs', 'comp-finder',
  'decision', 'augment', 'anvil', 'utilities'
].map(name => read(`src/ui/${name}.js`)).join('\n');

const script = `
(async () => {
  const modules = {
${definitions}
  };
  const loaded = new Map();
  function require(id) {
    if (!loaded.has(id)) {
      const module = {exports: {}};
      loaded.set(id,module);
      modules[id](module, require);
    }
    return loaded.get(id).exports;
  }
  const {loadSnapshots, readAcademyCache, refreshAcademy} = require('./snapshots');
  const Backup = require('./backup');
  const bytes = Uint8Array.from(atob('${embedded}'), c => c.charCodeAt(0));
  const embedded = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  const fallback = await new Response(embedded).json();
  const {academy: ACADEMY_BUNDLED, meta: META_BUNDLED, core} =
    await loadSnapshots(fallback, location.href, fetch);
  const model = require('./model')({academy: ACADEMY_BUNDLED, meta: META_BUNDLED, core});
  const {
    DATA, byId, componentOrder, academyTier, Academy, Tracker, OfflineTracker, LootTracker,
    QueueOrder, PivotPlanner, QuickImport, MetaBuilds, CompFinder, DecisionPlanner,
    PlanAdvisor, AugmentAdvisor
  } = model;
  try {
    const cached = readAcademyCache(localStorage.getItem(Academy.cacheKey), ACADEMY_BUNDLED.set);
    if (cached) Academy.useSnapshot(Academy.cleanSnapshot(cached));
  } catch {
    // The bundled snapshot remains available offline.
  }
${screens}
})();
`;

const html = read('src/page.html')
  .replace('<!-- styles -->', () => `<style>\n${read('src/styles.css')}</style>`)
  .replace('<!-- scripts -->', () => `<script>\n${script}</script>`);
writeFileSync(join(__dirname, 'carousel-companion.html'), html);
