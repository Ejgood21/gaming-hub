import {spawn} from 'node:child_process';

const pending = new Map();
const blockedHosts = new Map();
const quote = value => `"${String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\n').replaceAll('\r', '')}"`;
export const cleanError = error => {
  let message = String(error?.message || error).replace(/([?&](?:key|access_token|client_secret)=)[^&\s]+/gi, '$1[redacted]').replace(/(?:Bearer|Basic)\s+[^\s]+/gi, '[authorization redacted]');
  for (const name of ['YOUTUBE_API_KEY','WCL_CLIENT_ID','WCL_CLIENT_SECRET']) if (process.env[name]) message=message.replaceAll(process.env[name],'[redacted]');
  return message.trim().slice(0, 500);
};

/** curl honors the environment's HTTP(S)_PROXY and CA trust. URLs/headers,
 * including API keys, travel over stdin, never shell arguments or files. */
export async function httpRequest(url, options = {}) {
  const host = new URL(url).hostname;
  if (blockedHosts.has(host)) throw new Error(blockedHosts.get(host));
  const config = [
    `url = ${quote(url)}`, 'silent', 'show-error', 'location', 'max-redirs = 3',
    `max-time = ${Number(options.timeout || 18)}`, 'connect-timeout = 8',
    'user-agent = "WoWPlaystyleCompass/1.0 (personal research; respects source access controls)"',
    'write-out = "\\n%{http_code}"',
    ...Object.entries(options.headers || {}).map(([key, value]) => `header = ${quote(`${key}: ${value}`)}`),
    ...(options.method ? [`request = ${quote(options.method)}`] : []),
    ...(options.body !== undefined ? [`data = ${quote(typeof options.body === 'string' ? options.body : JSON.stringify(options.body))}`] : [])
  ].join('\n');
  return new Promise((resolve, reject) => {
    const child = spawn('curl', ['--config', '-'], {stdio: ['pipe', 'pipe', 'pipe']});
    let output = '', stderr = '', bytes = 0;
    child.stdout.on('data', part => { bytes += part.length; if (bytes > 8_000_000) child.kill(); else output += part; });
    child.stderr.on('data', part => { stderr += part; });
    child.on('error', reject);
    child.on('close', code => {
      const divider = output.lastIndexOf('\n');
      const status = Number(output.slice(divider + 1));
      const body = output.slice(0, divider);
      if (code !== 0 || status < 200 || status >= 300) {
        const message = cleanError(new Error(code !== 0 ? stderr || `Transport exited ${code}` : `HTTP ${status} from ${host}${status === 429 ? '; rate limited, retry on a later run' : ''}`));
        // Stop repeated host requests after access denial; preserve a gap for each spec.
        if ([401,403,429].includes(status) || /Failed to connect to proxy|Could not resolve proxy|CONNECT tunnel failed, response (?:401|403|429)/i.test(message)) blockedHosts.set(host, message);
        reject(new Error(message));
      } else resolve({body, status, url});
    });
    child.stdin.end(config + '\n');
  });
}

export async function httpGetText(url, options = {}) {
  // Cache GETs only. OAuth/GraphQL POSTs may share an endpoint but have distinct
  // request bodies or authorization; reusing their response would be incorrect.
  if (options.method && options.method!=='GET') return (await httpRequest(url,options)).body;
  const key = `GET ${url}`;
  if (!pending.has(key)) pending.set(key, httpRequest(url, options).then(result => result.body));
  return pending.get(key);
}

export async function httpGetJSON(url, options = {}) {
  const text = await httpGetText(url, options);
  try { return JSON.parse(text); } catch { throw new Error(`Expected JSON from ${new URL(url).hostname}; source format may have changed`); }
}

export function sourceResult(source, url, status, rest = {}) {
  return {source, status, url, fetched_at: new Date().toISOString(), ...rest};
}
