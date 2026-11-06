import {httpGetJSON, sourceResult, cleanError} from './http.mjs';

/** Optional public-data OAuth adapter. Metadata never masquerades as cooldown
 * pattern evidence. A future event query can use the same isolated adapter. */
export async function scrapeWarcraftlogs({spec,content,config}) {
  const url = 'https://www.warcraftlogs.com/api/v2/client';
  if (!config.warcraftlogs?.enabled) return sourceResult('warcraftlogs',url,'missing',{error:'Optional WarcraftLogs source disabled in config.'});
  const clientId = process.env.WCL_CLIENT_ID, secret = process.env.WCL_CLIENT_SECRET;
  if (!clientId || !secret) return sourceResult('warcraftlogs',url,'missing',{error:'Optional WCL_CLIENT_ID / WCL_CLIENT_SECRET not configured.'});
  try {
    const token = await httpGetJSON('https://www.warcraftlogs.com/oauth/token',{method:'POST',headers:{Authorization:`Basic ${Buffer.from(`${clientId}:${secret}`).toString('base64')}`,'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials'});
    if (!token.access_token) throw new Error('OAuth token response missing access token');
    const data = await httpGetJSON(url,{method:'POST',headers:{Authorization:`Bearer ${token.access_token}`,'Content-Type':'application/json'},body:{query:'{ worldData { expansions { id name } } }'}});
    return sourceResult('warcraftlogs',url,'missing',{data:{api_reachable:!data.errors,spec_id:spec.id,content_type:content,expansions:data.data?.worldData?.expansions || []},error:'API connectivity verified; no spec cooldown event corpus collected. Optional source does not count toward coverage.'});
  } catch (error) { return sourceResult('warcraftlogs',url,'failed',{error:cleanError(error)}); }
}
export const scrape = scrapeWarcraftlogs;
