/** Build the WoW SPA inside the hub's existing static export and shared shell. */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { build as bundle, createServer } from 'vite';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { assertValidBundle, resolveLatestProfiles } from './pipeline/validate.mjs';

export async function buildWow({root, output, basePath = '/'}) {
  const profiles = JSON.parse(await readFile(resolveLatestProfiles(), 'utf8'));
  assertValidBundle(profiles);
  const appRoot = path.join(root,'apps/wow');
  const target = path.join(output,'wow/assets');
  const assetsBase = `${basePath}wow/assets/`;
  // Profiles and latest.json are eager build-time imports in App.jsx; no runtime
  // data endpoint is needed or exposed beneath this asset URL.
  await bundle({
    configFile:false, root, base:assetsBase, logLevel:'warn', define:{'process.env.NODE_ENV':'"production"'},
    build:{outDir:target, emptyOutDir:true, target:'es2022', sourcemap:false,minify:'esbuild',
      lib:{entry:path.join(appRoot,'dashboard/main.jsx'),formats:['es'],fileName:()=> 'compass.js',cssFileName:'compass'},
      rollupOptions:{output:{assetFileNames:'[name][extname]'}}}
  });
  const server = await createServer({configFile:false,root,logLevel:'error',appType:'custom',server:{middlewareMode:true},
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
