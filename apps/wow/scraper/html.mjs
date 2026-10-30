export function decodeHtml(text) {
  return String(text).replace(/&#(x[\da-f]+|\d+);/gi, (_, code) => String.fromCodePoint(code[0].toLowerCase() === 'x' ? parseInt(code.slice(1),16) : Number(code)))
    .replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'");
}
export function plainText(html) {
  return decodeHtml(html.replace(/<(script|style|nav|footer|header)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<\/(?:p|div|h\d|li|br)>/gi,'\n').replace(/<[^>]*>/g,' ')).replace(/[ \t]+/g,' ').replace(/\n\s*\n+/g,'\n').trim();
}
export function jsonScripts(html) {
  const result = [];
  for (const script of html.matchAll(/<script\b[^>]*(?:type=["']application\/(?:ld\+)?json["']|id=["']__NEXT_DATA__["'])[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {result.push(JSON.parse(script[1]));} catch { /* A malformed script is a coverage gap at the adapter. */ }
  }
  return result;
}
export function isBlockedPage(html) { return /checking your browser|verify you are human|just a moment|access denied|captcha|challenge-platform|enable javascript and cookies to continue/i.test(html.slice(0,30000)); }
