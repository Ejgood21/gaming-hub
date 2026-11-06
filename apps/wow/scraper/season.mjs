import {httpGetText as productionGetText, httpGetJSON as productionGetJSON, cleanError} from './http.mjs';

function currentSeason(seasons, region, now = Date.now()) {
  return seasons.filter(season => {
    const start = Date.parse(season.starts?.[region] || season.start_date || '');
    const endValue = season.ends?.[region] || season.end_date;
    const end = endValue ? Date.parse(endValue) : Infinity;
    return Number.isFinite(start) && start <= now && (!Number.isFinite(end) || end >= now) && season.is_main_season !== false;
  }).sort((a,b)=>Date.parse(b.starts?.[region] || b.start_date)-Date.parse(a.starts?.[region] || a.start_date))[0];
}

/** Blizzard's live retail version yields the expansion ID; Raider.IO static data
 * supplies the active season by regional dates. Neither season nor expansion is
 * hardcoded. Explicit fallback is identified, dated, and never silently current. */
export async function detectSeason(config, overrides = {}, {httpGetText=productionGetText,httpGetJSON=productionGetJSON} = {}) {
  const now = new Date().toISOString(), gaps = [];
  let patch, detected, expansionId;
  const versionUrl = 'https://us.version.battle.net/wow/versions';
  try {
    const text = await httpGetText(versionUrl,{timeout:config.request_timeout_seconds});
    const lines = text.trim().split('\n'), columns = lines[0].split('|').map(x=>x.split('!')[0]);
    const row = lines.slice(1).find(line => line.startsWith(`${config.region || 'us'}|`))?.split('|');
    patch = row?.[columns.indexOf('VersionsName')]?.match(/\d+\.\d+\.\d+/)?.[0];
    if (!patch) throw new Error('Live version table lacks a retail patch version');
    expansionId = Number(patch.split('.')[0])-1;
    const staticUrl = `https://raider.io/api/v1/mythic-plus/static-data?expansion_id=${expansionId}`;
    const data = await httpGetJSON(staticUrl,{timeout:config.request_timeout_seconds});
    const season = currentSeason(data.seasons || [], config.region || 'us');
    if (!season) throw new Error('No active main season found in Raider.IO regional dates');
    const number = Number(season.name?.match(/Season\s*(\d+)/i)?.[1] || season.slug?.match(/-(\d+)$/)?.[1]);
    const expansion = season.name?.replace(/\s*Season\s*\d+.*/i,'').trim();
    if (!number || !expansion) throw new Error('Active season missing expansion or number');
    detected = {patch,expansion,expansion_id:expansionId,name:season.name,slug:season.slug,number,season_number:number,detected_at:now,source:staticUrl,patch_source:versionUrl,patch_started_at:null,starts_at:season.starts?.[config.region],is_fallback:false,coverage_gaps:['Patch release date unavailable; YouTube candidates must name the exact current patch.']};
  } catch (error) { gaps.push(`Automatic patch/season detection failed: ${cleanError(error)}`); }

  if (!detected) {
    const fallback = config.season_override;
    if (!fallback?.patch || !fallback?.slug || !fallback?.expansion || !fallback?.number) throw new Error(`${gaps.join(' ')} Configure season_override in apps/wow/config/sources.json to stage a clearly marked fallback run.`);
    detected = {...fallback,season_number:fallback.number,expansion_id:Number(fallback.patch.split('.')[0])-1,detected_at:now,is_fallback:true,source:'config override',coverage_gaps:[...gaps,'Using an explicit fallback. Confirm patch and season before finalization.']};
  }
  if (overrides.patch || overrides.season || overrides.expansion || overrides['season-number']) {
    const patchChanged=overrides.patch && overrides.patch!==detected.patch;
    detected = {...detected,patch:overrides.patch || detected.patch,slug:overrides.season || detected.slug,expansion:overrides.expansion || detected.expansion,number:Number(overrides['season-number'] || detected.number),source:'CLI override',is_fallback:true};
    detected.season_number = detected.number;
    detected.expansion_id=Number(detected.patch.split('.')[0])-1;
    if(overrides.expansion || overrides['season-number'])detected.name=`${detected.expansion} Season ${detected.number}`;
    if(patchChanged)detected.patch_started_at=null;
    detected.coverage_gaps.push('CLI season override applied; verify against source evidence.');
  }
  if (overrides['patch-start']) detected.patch_started_at = new Date(overrides['patch-start']).toISOString();
  if(!/^\d+\.\d+(?:\.\d+)?$/.test(detected.patch))throw new Error('Patch override must be a plain version such as 12.1.5');
  if(!/^season-[a-z0-9-]+$/.test(detected.slug) || !Number.isInteger(detected.number) || detected.number<1)throw new Error('Season override requires a season slug and positive season number');
  return detected;
}
export {currentSeason};
