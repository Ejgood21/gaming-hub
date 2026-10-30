import {httpGetText as productionGetText, sourceResult, cleanError} from './http.mjs';
import {plainText, jsonScripts, isBlockedPage} from './html.mjs';

function walk(value, path = [], found = [], depth = 0) {
  if (depth > 35 || !value || typeof value !== 'object') return found;
  if (!Array.isArray(value)) {
    const keys = Object.keys(value);
    if (keys.some(key => /(?:pick|usage|popularity|representation|percent|sample|count|frequency|rate)/i.test(key)) && keys.some(key=>typeof value[key] === 'number')) found.push({path:path.join('.'),record:value});
  }
  for (const [key, child] of Object.entries(value)) if (child && typeof child === 'object') walk(child,[...path,key],found,depth+1);
  return found;
}
export async function scrapeArchon({spec, content, context = {}, config, httpGetText = productionGetText}) {
  const url = config.archon[`${content}_template`].replaceAll('{spec}',spec.raiderio_spec).replaceAll('{class}',spec.raiderio_class);
  try {
    const html = await httpGetText(url,{timeout:config.request_timeout_seconds});
    if (isBlockedPage(html)) throw new Error('Access challenge; no quantitative data captured');
    const text = plainText(html), structured = jsonScripts(html), numeric_records = structured.flatMap(value=>walk(value));
    if(!text.toLowerCase().includes((spec.name || spec.spec).toLowerCase()) || !text.toLowerCase().includes(spec.class_name.toLowerCase()))throw new Error('Unexpected Archon page; spec identity is missing');
    // Prose percentages are retained as evidence snippets, not assigned to a hero
    // tree by guessing proximity. Codex must resolve the actual labels.
    const numeric_snippets = text.split('\n').filter(line=>/%|\b(?:sample|parses|builds|popularity)\b/i.test(line)).slice(0,100);
    if (!numeric_records.length && !numeric_snippets.some(line=>/\d+(?:\.\d+)?\s*%/.test(line))) throw new Error('Page loaded without interpretable quantitative evidence; parser may need updating');
    const detectedPatches=[...new Set([...text.matchAll(/\b(\d{1,2}\.\d+\.\d+)\b/g)].map(match=>match[1]))];
    const stale=detectedPatches.length>0 && context.patch && !detectedPatches.includes(context.patch);
    return sourceResult('archon',url,stale?'stale':'success',{data:{content_type:content,text,structured_data:structured,numeric_records,numeric_snippets,detected_patches:detectedPatches,interpretation:'Combined spec and hero build popularity is not a marginal hero-tree pick rate. Extraction must preserve the source denominator.'},coverage_gaps:stale?[`Page names ${detectedPatches.join(', ')} instead of ${context.patch}`]:[],...(stale?{error:'Source page targets an earlier patch'}:{})});
  } catch (error) { return sourceResult('archon',url,'failed',{error:cleanError(error),coverage_gaps:['Hero talent pick rates and representation unavailable from Archon']}); }
}
export const scrape = scrapeArchon;
