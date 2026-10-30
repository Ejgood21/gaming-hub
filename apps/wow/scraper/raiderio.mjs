import {httpGetJSON as productionGetJSON, sourceResult, cleanError} from './http.mjs';
const sampleCaches = new WeakMap();

async function getSample(context, config, httpGetJSON) {
  if(!sampleCaches.has(httpGetJSON))sampleCaches.set(httpGetJSON,new Map());
  const samples=sampleCaches.get(httpGetJSON);
  const key = `${context.slug}:${config.region}:${config.raiderio.sample_pages}`;
  if (!samples.has(key)) samples.set(key,(async()=>{
    const rankings = [], urls = [];
    for (let page=0;page<Number(config.raiderio.sample_pages || 1);page++) {
      const url = `https://raider.io/api/v1/mythic-plus/runs?region=${encodeURIComponent(config.region || 'us')}&season=${encodeURIComponent(context.slug)}&dungeon=all&affixes=all&page=${page}`;
      const data = await httpGetJSON(url,{timeout:config.request_timeout_seconds});
      if (!Array.isArray(data.rankings)) throw new Error('Unexpected Raider.IO run response; rankings missing');
      rankings.push(...data.rankings);
      urls.push(url);
    }
    const members = rankings.flatMap(row=>(row.run || row).roster || []);
    if (!members.length) throw new Error('Raider.IO returned no roster entries; representation cannot be inferred');
    return {rankings,members,urls};
  })());
  return samples.get(key);
}
export async function scrapeRaiderio({spec, content, context, config, httpGetJSON = productionGetJSON}) {
  const url = `https://raider.io/api/v1/mythic-plus/runs?season=${encodeURIComponent(context.slug)}&region=${encodeURIComponent(config.region)}`;
  if (content === 'raid') return sourceResult('raiderio','https://raider.io/api','missing',{error:'The documented public Raider.IO raid ranking endpoints rank guild progression, not specialization representation. Raid quantitative coverage comes from Archon; guild rank is not a spec pick rate.',coverage_gaps:['No public raid specialization representation endpoint available']});
  try {
    const {members,rankings,urls} = await getSample(context,config,httpGetJSON);
    const role = spec.role === 'dps' ? 'dps' : spec.role;
    const roleMembers = members.filter(member => {
      const value = String(member.role || member.character?.spec?.role || member.spec?.role || '').toLowerCase();
      return value === role || (role === 'dps' && ['damage','damager'].includes(value));
    });
    const matching = roleMembers.filter(member => Number(member.character?.spec?.id || member.spec?.id || member.spec_id) === Number(spec.game_id));
    if (!roleMembers.length) throw new Error('Run roster role/spec fields are unavailable; parser needs updating');
    return sourceResult('raiderio',url,'success',{data:{spec_id:spec.id,content_type:content,season:context.slug,region:config.region,matching_roster_slots:matching.length,total_role_roster_slots:roleMembers.length,representation_percent:Number((100*matching.length/roleMembers.length).toFixed(2)),sample_runs:rankings.length,sample_kind:'top-run roster slots',sample_urls:urls,interpretation:'High-key leaderboard sample only. Repeated players and runs may appear; this is neither overall player population nor a viability verdict.'},coverage_gaps:['Representation sampled from top runs; not the complete season population']});
  } catch (error) { return sourceResult('raiderio',url,'failed',{error:cleanError(error),coverage_gaps:['M+ representation sample unavailable']}); }
}
export const scrape = scrapeRaiderio;
