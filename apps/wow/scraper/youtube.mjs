import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { httpGetJSON as productionGetJSON, cleanError } from './http.mjs';

const execute = promisify(execFile);
const transcriptScript = fileURLToPath(new URL('./transcript.py', import.meta.url));
const normalize = value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const aliases = {
  'beast mastery': ['bm'], marksmanship: ['mm'], survival: ['sv'],
  restoration: ['resto'], discipline: ['disc'], preservation: ['pres'],
  retribution: ['ret'], protection: ['prot'], assassination: ['assa'],
  subtlety: ['sub'], windwalker: ['ww'], mistweaver: ['mw'], brewmaster: ['brew'],
  'unholy': ['uh'], destruction: ['destro'], affliction: ['aff'], demonology: ['demo'],
  enhancement: ['enh'], elemental: ['ele'], balance: ['boomkin'], devastation: ['dev'],
};

function preferredChannels(config) {
  const values = config.preferred_creators ?? config.youtube?.preferred_creators ?? [];
  return (Array.isArray(values) ? values : Object.values(values).flat()).map(normalize);
}

function safeError(error) {
  const message = String(error?.message ?? error ?? 'YouTube request failed');
  return cleanError(message).replace(/([?&]key=)[^&\s]+/gi, '$1[redacted]').slice(0, 400);
}

async function productionTranscript(videoID,config) {
  try {
    const {stdout}=await execute(config.youtube?.python || 'python3',[transcriptScript,videoID],{timeout:45000,maxBuffer:8*1024*1024});
    return JSON.parse(stdout);
  } catch(error) {
    return {error:error.killed?'Transcript request timed out.':'Transcript helper failed; install scraper/requirements.txt and check transcript network access.'};
  }
}

export function chooseVideo(videos, { spec, content, context, config = {} }) {
  const specName = normalize(spec.spec_name ?? spec.spec ?? spec.name);
  const acceptedNames = [specName, ...(spec.youtube_aliases ?? []), ...(aliases[specName] ?? [])];
  const patch = String(context.patch ?? '');
  const release = context.patch_started_at ?? context.patch_released_at ?? context.released_at;
  const cutoff = release && Number.isFinite(Date.parse(release)) ? Date.parse(release) : null;
  const preferred = preferredChannels(config);
  const className = normalize(spec.class_name ?? spec.class);
  const classNames = [className, ...({ 'death knight': ['dk'], 'demon hunter': ['dh'] }[className] ?? [])];
  const ambiguousSpec = ['frost', 'holy', 'restoration', 'protection'].includes(specName);
  const maxAgeDays = Number(config.youtube?.max_age_days ?? 120);
  const exactPatch = patch ? new RegExp(`(?:^|[^0-9.])${patch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|[^0-9.])`, 'i') : null;
  return videos.filter(video => {
    const title = normalize(video.title);
    const words = ` ${title} `;
    const identifiesSpec = acceptedNames.some(name => name && words.includes(` ${normalize(name)} `));
    const identifiesClass = !ambiguousSpec || classNames.some(name => name && words.includes(` ${name} `));
    const guide = /\b(guide|build|rotation|tutorial|how to play)\b/.test(title);
    const mythic = /mythic\s*(?:plus|\+)|m\+|mplus/i.test(video.title);
    const raid = /\braid(?:ing)?\b/i.test(video.title);
    const wrongContent = content === 'raid' ? mythic && !raid : raid && !mythic;
    const date = Date.parse(video.uploaded_at);
    // A current-patch title or a known patch-release boundary is required.
    // An arbitrary "last 90 days" window would quietly admit old-patch guides.
    const validDate = Number.isFinite(date) && date <= Date.now() && Date.now() - date <= maxAgeDays * 86400000;
    const currentPatch = validDate && (cutoff !== null ? date >= cutoff : exactPatch?.test(video.title));
    const namedPatches=[...video.title.matchAll(/\b(\d{1,2}\.\d+\.\d+)\b/g)].map(match=>match[1]);
    const contradictoryPatch=namedPatches.length>0 && patch && !namedPatches.includes(patch);
    return identifiesSpec && identifiesClass && guide && !wrongContent && currentPatch && !contradictoryPatch;
  }).sort((a, b) => {
    if (b.views !== a.views) return b.views - a.views;
    const aPreferred = preferred.includes(normalize(a.channel));
    const bPreferred = preferred.includes(normalize(b.channel));
    if (aPreferred !== bPreferred) return Number(bPreferred) - Number(aPreferred);
    return Date.parse(b.uploaded_at) - Date.parse(a.uploaded_at);
  })[0] ?? null;
}

/**
 * Search costs 100 quota units and videos.list costs 1 per spec/content pair.
 * Preferred creators resolve equal view counts only; they are never a whitelist.
 * Captions use youtube-transcript-api through transcript.py; no LLM/API extraction.
 */
export async function scrapeYoutube({ spec, content, context, config = {}, httpGetJSON = productionGetJSON, fetchTranscript = productionTranscript, apiKey = process.env.YOUTUBE_API_KEY }) {
  const fetched_at = new Date().toISOString();
  const base = { source: 'youtube', fetched_at, url: 'https://www.youtube.com/' };
  const key = apiKey;
  if (!key) return { ...base, status: 'missing', error: 'YOUTUBE_API_KEY is not configured; video search and transcript coverage unavailable.' };
  const specName = spec.spec_name ?? spec.spec ?? spec.name;
  const className = spec.class_name ?? spec.class ?? '';
  const contentQuery = content === 'mythic_plus' ? 'mythic plus guide' : 'raid guide';
  const season = context.season_number ?? context.season;
  const expansion = context.expansion ?? '';
  const query = [specName, className, contentQuery, expansion, season ? `season ${season}` : '', context.patch].filter(Boolean).join(' ');
  const release = context.patch_started_at ?? context.patch_released_at ?? context.released_at;
  const maxResults = Math.min(50, Math.max(1, Number(config.youtube?.max_results ?? 25)));
  const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
  Object.entries({ key, part: 'snippet', type: 'video', order: 'viewCount', q: query, maxResults, relevanceLanguage: 'en' }).forEach(([name, value]) => searchUrl.searchParams.set(name, value));
  if (release && Number.isFinite(Date.parse(release))) searchUrl.searchParams.set('publishedAfter', new Date(release).toISOString());
  try {
    const search = await httpGetJSON(searchUrl.toString(),{timeout:config.request_timeout_seconds});
    const ids = (search.items ?? []).map(item => item.id?.videoId).filter(Boolean);
    if (!ids.length) return { ...base, status: 'missing', error: 'No recent guide found for this spec and content type.', data: { query, candidates: [] } };
    const videosUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
    Object.entries({ key, part: 'snippet,statistics,contentDetails', id: ids.join(',') }).forEach(([name, value]) => videosUrl.searchParams.set(name, value));
    const response = await httpGetJSON(videosUrl.toString(),{timeout:config.request_timeout_seconds});
    const candidates = (response.items ?? []).filter(item => item.snippet?.liveBroadcastContent !== 'live').map(item => ({
      id: item.id, title: item.snippet.title, channel: item.snippet.channelTitle,
      channel_id: item.snippet.channelId, views: Number(item.statistics?.viewCount ?? 0),
      uploaded_at: item.snippet.publishedAt, duration: item.contentDetails?.duration ?? null,
      url: `https://www.youtube.com/watch?v=${encodeURIComponent(item.id)}`,
    }));
    const selected = chooseVideo(candidates, { spec, content, context, config });
    if (!selected) return { ...base, status: 'missing', error: 'No suitable current-patch guide found. Videos without verifiable patch freshness were excluded.', data: { query, candidates } };
    let transcriptResult;
    try { transcriptResult=await fetchTranscript(selected.id,config); }
    catch { transcriptResult={error:'Transcript retrieval failed; selected video metadata is retained.'}; }
    const transcript = transcriptResult.transcript ?? [];
    if (!transcript.length) return {
      ...base, status: 'missing', url: selected.url,
      error: transcriptResult.error ?? 'Chosen video has no accessible transcript.',
      data: { query, selected, candidates, transcript: [], creator_notes: null, coverage_gaps: ['Video metadata available; transcript unavailable.'] },
    };
    return {
      ...base, status: 'success', url: selected.url,
      data: { query, selected, candidates, transcript, transcript_language: transcriptResult.language, creator_notes: null, coverage_gaps: ['Codex creator-note extraction pending.'] },
    };
  } catch (error) {
    return { ...base, status: 'failed', error: safeError(error), data: { query } };
  }
}

export const scrape = scrapeYoutube;
