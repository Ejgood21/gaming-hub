/** Build the WoW SPA inside the hub's existing static export and shared shell. */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { build as bundle, createServer } from 'vite';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { validateIcons } from './validate-icons.mjs';
import { assertValidBundle, resolveLatestProfiles } from './pipeline/validate.mjs';

export async function buildWow({root, output, basePath = '/'}) {
  await validateIcons();
  const profiles = JSON.parse(await readFile(resolveLatestProfiles(), 'utf8'));
  assertValidBundle(profiles);
  const appRoot = path.join(root,'apps/wow');
  // Display only a small, read-only summary of the existing collection audit.
  // Candidate data and strict publication gates stay outside the dashboard.
  let coverageAudit = null;
  try {
    const audit = JSON.parse(await readFile(path.join(appRoot,'data',profiles.patch,'live-coverage.json'),'utf8'));
    coverageAudit = {
      patch:audit.patch,
      required_coverage_passed:audit.required_coverage_passed,
      required_coverage_missing:audit.required_coverage_missing,
      total_profiles:audit.profiles.length,
      by_content:audit.by_content,
    };
    if (audit.patch !== profiles.patch || audit.required_coverage_passed + audit.required_coverage_missing !== audit.profiles.length)
      throw new Error('Coverage audit totals do not match its patch/profile count');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const define = {'process.env.NODE_ENV':'"production"', __WOW_COVERAGE_AUDIT__:JSON.stringify(coverageAudit)};
  const target = path.join(output,'wow/assets');
  const assetsBase = `${basePath}wow/assets/`;
  // Profiles and latest.json are eager build-time imports in App.jsx; no runtime
  // data endpoint is needed or exposed beneath this asset URL.
  await bundle({
    configFile:false, root, base:assetsBase, logLevel:'warn', define,
    build:{outDir:target, emptyOutDir:false, target:'es2022', sourcemap:false,minify:'esbuild',
      lib:{entry:path.join(appRoot,'dashboard/main.jsx'),formats:['es'],fileName:()=> 'compass.js',cssFileName:'compass'},
      rollupOptions:{output:{assetFileNames:'[name][extname]'}}}
  });
  const server = await createServer({configFile:false,root,base:assetsBase,define,logLevel:'error',appType:'custom',server:{middlewareMode:true},
    ssr:{noExternal:['lucide-react']}});
  let app;
  try { const {default:App}=await server.ssrLoadModule('/apps/wow/dashboard/App.jsx'); app=renderToString(createElement(App)); }
  finally { await server.close(); }
  const styles=(await readdir(target)).filter(f=>f.endsWith('.css')).map(f=>`<link rel="stylesheet" href="${assetsBase}${f}">`).join('\n');
  const file=path.join(output,'wow/index.html');
  let html=await readFile(file,'utf8');
  html=html.replace('{{wowApp}}',app).replace('{{wowStyles}}',styles).replace('{{wowScripts}}',`<script type="module" src="${assetsBase}compass.js"></script>`);
  await writeFile(file,html);
  console.log(`Built WoW compass: ${profiles.profiles.length} server-rendered profiles; shared hub shell, local assets only.`);
}
