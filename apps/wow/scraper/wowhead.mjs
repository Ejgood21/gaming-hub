import {httpGetText as productionGetText, sourceResult, cleanError} from './http.mjs';
import {plainText, jsonScripts, isBlockedPage} from './html.mjs';

/** Every guide section is retained separately so extraction cites real anchors. */
function articleFields(value, found = {bodies:[],dates:[],headlines:[]},depth=0) {
  if(!value || typeof value!=='object' || depth>30)return found;
  for(const [key,child] of Object.entries(value)) {
    if(typeof child==='string') {
      if(/^(?:articleBody|bodyMarkup|contentHtml)$/i.test(key))found.bodies.push(plainText(child));
      if(/^(?:dateModified|datePublished|updatedAt|updated_at)$/i.test(key) && Number.isFinite(Date.parse(child)))found.dates.push(new Date(child).toISOString());
      if(/^(?:headline|title)$/i.test(key))found.headlines.push(child);
    } else if(child && typeof child==='object')articleFields(child,found,depth+1);
  }
  return found;
}
export function parseWowheadHTML(html,spec) {
  if(isBlockedPage(html))throw new Error('Access challenge; source was not scraped');
  const scripts=jsonScripts(html), fields=articleFields(scripts);
  const embedded = [...html.matchAll(/(?:["']?(?:articleBody|bodyMarkup|contentHtml)["']?)\s*[=:]\s*("(?:\\.|[^"\\])*")/g)].flatMap(match => {try{return [plainText(JSON.parse(match[1]))];}catch{return [];}});
  const article=html.match(/<(?:article|main)\b[^>]*>([\s\S]*?)<\/(?:article|main)>/i)?.[1];
  // Read the returned author fallback without executing the page's scripts.
  // Generic body keys and later comment fallbacks are not guide evidence.
  const guideStart=html.search(/<div\b[^>]*\bid=["']guide-body["']/i);
  const guideFallback=guideStart>=0?html.slice(guideStart).match(/<noscript\b[^>]*>([\s\S]*?)<\/noscript>/i)?.[1]:null;
  const authorFallback=guideFallback && !/\bid=["'](?:user-comments|comments)["']/i.test(guideFallback)?guideFallback:null;
  const bodies=[...new Set([...fields.bodies,...embedded,article?plainText(article):'',authorFallback?plainText(authorFallback):''].filter(Boolean))];
  // A navigation-heavy page is not evidence even when its chrome names a spec.
  const text=bodies.join('\n\n');
  const guidePatch=html.match(/<div\b[^>]*\bclass=["'][^"']*\binterior-sidebar-header-text-subtitle\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1];
  const identity=[text,...fields.headlines,guidePatch?plainText(guidePatch):''].join(' ');
  const specName=(spec.name || spec.spec).toLowerCase();
  if(text.length<500 || !identity.toLowerCase().includes(specName) || !/\b(?:rotation|cooldown|talent|tier|ability|abilities|healing|mitigation)\b/i.test(text))throw new Error('Guide prose missing or unexpected page; parser may need updating');
  return {text,structured_data:scripts,updated_at:fields.dates.sort().at(-1)||null,detected_patches:[...new Set([...identity.matchAll(/\b(?:Patch\s*)?(\d{1,2}\.\d+\.\d+)\b/g)].map(match=>match[1]))]};
}
export async function scrapeWowhead({spec, content, context = {}, config, httpGetText = productionGetText}) {
  const roleSuffix = spec.role === 'healer' ? 'healer' : spec.role === 'tank' ? 'tank' : 'dps';
  const base = `${config.wowhead.base_url}/${spec.wowhead_slug}`;
  const sections = await Promise.all(config.wowhead.sections.map(async section => {
    // The guide navigation links gear pages as /bis-gear, without a role suffix.
    const url = `${base}/${section==='gear'?'bis-gear':`${section}-pve-${roleSuffix}`}`;
    try {
      const html = await httpGetText(url,{timeout:config.request_timeout_seconds});
      const parsed=parseWowheadHTML(html,spec);
      const stale=parsed.detected_patches.length>0 && context.patch && !parsed.detected_patches.includes(context.patch);
      return {section, url, status:stale?'stale':'success', ...parsed, ...(stale?{error:`Guide names ${parsed.detected_patches.join(', ')} instead of target ${context.patch}`} : {}), scraped_at:new Date().toISOString()};
    } catch (error) { return {section, url, status:'failed', error:cleanError(error), scraped_at:new Date().toISOString()}; }
  }));
  const succeeded = sections.filter(section => section.status === 'success');
  const status=succeeded.length?'success':sections.some(section=>section.status==='stale')?'stale':'failed';
  return sourceResult('wowhead', base, status, {data:{content_type:content,sections,updated_at:sections.map(x=>x.updated_at).filter(Boolean).sort().at(-1)||null},coverage_gaps:[...sections.filter(x=>x.status!=='success').map(x=>`${x.section}: ${x.error}`),...succeeded.filter(x=>!x.updated_at).map(x=>`${x.section}: guide freshness could not be determined`)],...(succeeded.length?{}:{error:'No current guide sections could be scraped'})});
}
export const scrape = scrapeWowhead;
