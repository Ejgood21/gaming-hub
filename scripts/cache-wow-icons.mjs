/** Download original Blizzard art from Wowhead; only this explicit command uses the network. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const mappingUrl = new URL('../apps/wow/config/icons.json', import.meta.url);
const mapping = JSON.parse(await readFile(mappingUrl,'utf8'));
const directory = new URL('../apps/wow/assets/icons/', import.meta.url);
await mkdir(directory,{recursive:true});
for (const kind of ['specs','classes','roles']) for (const [name,item] of Object.entries(mapping[kind])) {
  const url = `${mapping.cdn}${item.icon}.jpg`;
  const response = await fetch(url,{signal:AbortSignal.timeout(30000)});
  if (!response.ok) throw new Error(`${name}: CDN returned ${response.status}: ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 500 || bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error(`${name}: CDN did not return a JPEG`);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (item.sha256 && item.sha256 !== sha256) throw new Error(`${name}: upstream bytes changed; review the artwork before updating its checksum`);
  await writeFile(new URL(`${item.icon}.jpg`,directory), bytes);
  item.sha256 = sha256;
  console.log(`${kind}/${name}: ${response.status}, ${bytes.length} bytes, ${sha256}`);
}
await writeFile(mappingUrl,JSON.stringify(mapping,null,2)+'\n');
console.log('Cached 40 spec, 13 class, and 3 role icons. Artwork © Blizzard Entertainment; CDN: Wowhead.');
