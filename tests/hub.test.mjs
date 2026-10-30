import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { build, output, root, validateData } from "../scripts/build.mjs";
import { createStaticServer } from "../scripts/serve.mjs";
import { resolveLatestProfiles } from "../apps/wow/pipeline/validate.mjs";

let server, base;
const releases = JSON.parse(
  await readFile(path.join(root, "data/releases.json"), "utf8"),
);
const apps = JSON.parse(
  await readFile(path.join(root, "data/apps.json"), "utf8"),
);
before(async () => {
  await build({ basePath: "/" });
  server = createStaticServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (server)
    await new Promise((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
});

test("home renders the current JSON as readable HTML, including status, notes, and dates", async () => {
  const response = await fetch(base);
  assert.equal(response.status, 200);
  const html = await response.text();
  const encoded = (value) =>
    String(value).replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char],
    );
  assert.equal(
    (html.match(/class="release-card"/g) || []).length,
    releases.length,
  );
  for (const item of releases) {
    const marker = `aria-labelledby="release-${item.id}"`;
    assert.ok(html.includes(marker));
    const card = html.slice(html.indexOf(marker)).split("</article>")[0];
    for (const field of ["title", "platform", "window", "note"]) {
      assert.ok(
        card.includes(encoded(item[field])),
        `${item.id}: missing ${field}`,
      );
    }
    assert.ok(html.includes(`data-release-status="${item.status}"`));
    if (item.date) assert.ok(card.includes(`datetime="${item.date}"`));
  }
  assert.equal((html.match(/class="tool-card /g) || []).length, apps.length);
  for (const item of apps) {
    assert.ok(html.includes(`href="${item.href}"`));
    assert.ok(html.includes(encoded(item.title)));
    assert.ok(html.includes(`datetime="${item.updated}"`));
  }
  assert.match(html, /class="filters"[^>]*hidden/);
  assert.doesNotMatch(html, /{{\w+}}/);
});

test("every app route has the shared navigation and an honest current state", async () => {
  for (const [route, expected] of [
    ["/wow/", "Find your next"],
    ["/placeholder/", "SLOT 03 / COMING SOON"],
  ]) {
    const response = await fetch(base + route);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.ok(html.replace(/\s+/g, " ").includes(expected));
    assert.ok(html.includes(`href="${route}" aria-current="page"`));
    assert.match(html, /Skip to content/);
    assert.match(html, /class="site-footer"/);
    assert.doesNotMatch(html, /{{\w+}}/);
  }
  const noSlash = await fetch(base + "/wow", { redirect: "manual" });
  assert.equal(noSlash.status, 308);
  assert.equal(noSlash.headers.get("location"), "/wow/");
  const response = await fetch(base + "/not-an-app/");
  assert.equal(response.status, 404);
  assert.match(await response.text(), /OFF THE MAP/);
  assert.equal((await fetch(base + "/_template/")).status, 404);
  assert.equal((await fetch(base + "/wow/README.md")).status, 404);
  assert.equal((await fetch(base, { method: "POST" })).status, 405);
});

test("local assets and app card destinations resolve; external browser dependencies are absent", async () => {
  for (const page of [
    "index.html",
    "wow/index.html",
    "placeholder/index.html",
    "404.html",
  ]) {
    const html = await readFile(path.join(output, page), "utf8");
    assert.doesNotMatch(html, /<(?:script|link|img)[^>]+(?:src|href)=["']https?:/i);
    assert.doesNotMatch(html, /style="/);
    for (const [, url] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
      // Source citations are external navigation, never browser dependencies.
      if (page === "wow/index.html" && /^https:\/\//.test(url)) continue;
      assert.ok(
        url.startsWith("/") || url.startsWith("#"),
        `External or relative dependency in ${page}: ${url}`,
      );
      if (!url.startsWith("#"))
        assert.equal((await fetch(base + url)).status, 200, url);
    }
  }
  for (const card of apps) {
    const [route, fragment] = card.href.split("#");
    const html = await (await fetch(base + route)).text();
    if (fragment) assert.ok(html.includes(`id="${fragment}"`));
  }
  assert.deepEqual(
    JSON.parse(await (await fetch(base + "/data/releases.json")).text()),
    releases,
  );
  const scripts = await readFile(
    path.join(output, "assets/filters.js"),
    "utf8",
  );
  assert.doesNotMatch(
    scripts,
    /fetch\(|XMLHttpRequest|sendBeacon|localStorage|document\.cookie/,
  );
});

test("WoW exports readable separate profiles and the single prompt, without its raw corpus", async () => {
  const html = await (await fetch(base + "/wow/")).text();
  const bundle = JSON.parse(await readFile(resolveLatestProfiles(), "utf8"));
  assert.equal((html.match(/class="static-profile"/g) || []).length, bundle.profiles.length);
  const readable = html.replace(/<!--[\s\S]*?-->/g, "");
  assert.ok(readable.includes("Mythic+ Blood Death Knight"), "Missing readable M+ profile");
  assert.ok(readable.includes("Raid Blood Death Knight"), "Missing readable raid profile");
  assert.match(html, /Per-patch refresh prompt/);
  const incomplete = bundle.profiles.some(profile => !profile.provenance.sources.some(source => source.id === "wowhead" && source.status === "success") || !profile.provenance.sources.some(source => source.kind === "quantitative" && source.status === "success"));
  assert.ok(html.includes(incomplete ? "Provisional coverage" : "Source target met"));
  const browserScript = await readFile(path.join(output, "wow/assets/compass.js"), "utf8");
  assert.doesNotMatch(browserScript, /process\.env\.NODE_ENV/);
  for (const route of ["/wow/data/12.1.5/raw/bundle.json", "/wow/pipeline/extract-playstyle.md", "/wow/scraper/youtube.mjs", "/.env"])
    assert.equal((await fetch(base + route)).status, 404, route);
});

test("root-mode local preview retains legacy security headers", async () => {

  const response = await fetch(base + "/wow/");
  const csp = response.headers.get("content-security-policy");
  assert.match(csp, /default-src 'none'/);
  assert.match(csp, /connect-src 'none'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("bad hand-edited data fails the build validation with a useful diagnosis", () => {
  const change = (field, value) =>
    releases.map((r, i) => (i ? r : { ...r, [field]: value }));
  assert.throws(
    () => validateData(change("status", "confirmed"), apps),
    /status must be/,
  );
  assert.throws(
    () => validateData(change("date", "2027-02-30"), apps),
    /date must be/,
  );
  assert.throws(
    () =>
      validateData(
        [{ ...releases[0], status: "firm", date: null }, ...releases.slice(1)],
        apps,
      ),
    /firm releases require a date/,
  );
  assert.throws(
    () => validateData([...releases, releases[0]], apps),
    /duplicate id/,
  );
  assert.throws(
    () => validateData(releases, [{ ...apps[0], href: "https://example.com" }]),
    /local \/app\//,
  );
  assert.throws(
    () => validateData(releases, [{ ...apps[0], updated: "tomorrow" }]),
    /updated must be/,
  );
});

test("build is repeatable and exports no source, environment files, or provider credentials", async () => {
  const first = await readFile(path.join(output, "index.html"), "utf8");
  await build({ basePath: "/" });
  assert.equal(await readFile(path.join(output, "index.html"), "utf8"), first);
  const walk = async (dir) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(file);
      else {
        assert.doesNotMatch(entry.name, /^\.|\.md$|\.mjs$|package.*\.json$/);
        const content = await readFile(file, "utf8");
        assert.doesNotMatch(
          content,
          /(?:YOUTUBE_API_KEY|WCL_CLIENT_ID|WCL_CLIENT_SECRET|OPENAI_API_KEY|GEMINI_API_KEY)/,
        );
        assert.doesNotMatch(
          content,
          /(?:gh[pousr]_[A-Za-z0-9]{30,}|AIza[A-Za-z0-9_-]{35}|-----BEGIN .*PRIVATE KEY-----)/,
        );
      }
    }
  };
  await walk(output);
});

test("Pages subpath resolves every page, asset and public data link without root aliases", async () => {
  const basePath = "/gaming-hub/";
  const fixture = path.join(root, "apps/your-tool");
  let pagesServer;
  // Exercise a future app without editing WoW content or the committed data.
  await mkdir(fixture);
  try {
    await mkdir(path.join(fixture, "assets"));
    await writeFile(
      path.join(fixture, "index.html"),
      `<!doctype html><html lang="en"><head>{{head}}<title>Base path fixture</title>
      <link rel="stylesheet" href="/your-tool/assets/tool.css">
      <script src="{{basePath}}your-tool/assets/tool.js" defer></script></head>
      <body>{{header}}<main id="main"><a href="/data/releases.json">Release data</a>
      <a href="{{basePath}}data/apps.json">App data</a>
      <img src="/your-tool/assets/icon.svg" alt="Fixture icon"></main>{{footer}}</body></html>`,
    );
    await writeFile(
      path.join(fixture, "assets/tool.css"),
      '.art { background-image: url("/your-tool/assets/icon.svg"); }',
    );
    await writeFile(
      path.join(fixture, "assets/tool.js"),
      'const releaseData = "{{basePath}}data/releases.json";\n',
    );
    await writeFile(
      path.join(fixture, "assets/icon.svg"),
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path d="M0 0h1v1H0z"/></svg>',
    );
    await build({ basePath });
    pagesServer = createStaticServer({ basePath });
    await new Promise((resolve) => pagesServer.listen(0, "127.0.0.1", resolve));
    const origin = `http://127.0.0.1:${pagesServer.address().port}`;
    for (const route of ["", "wow/", "placeholder/", "your-tool/", "404.html"]) {
      const response = await fetch(origin + basePath + route);
      assert.equal(response.status, 200, route || "home");
      const html = await response.text();
      assert.doesNotMatch(html, /{{\w+}}/);
      assert.match(html, /<meta name="robots" content="noindex, nofollow, noarchive">/);
      for (const [, url] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
        // Source citations navigate to evidence; they are not browser dependencies.
        if (route === "wow/" && /^https:\/\//.test(url)) continue;
        if (url.startsWith("#")) {
          assert.ok(html.includes(`id="${url.slice(1)}"`), `${route}: missing ${url}`);
          continue;
        }
        assert.ok(url.startsWith(basePath), `${route}: escaped base path: ${url}`);
        const target = await fetch(origin + url);
        assert.equal(target.status, 200, `${route}: ${url}`);
        const fragment = url.split("#")[1];
        if (fragment)
          assert.ok((await target.text()).includes(`id="${fragment}"`), url);
      }
      if (["", "wow/", "placeholder/"].includes(route))
        assert.ok(html.includes(`href="${basePath + route}" aria-current="page"`));
      if (route === "wow/") {
        const profiles = JSON.parse(await readFile(resolveLatestProfiles(), "utf8"));
        assert.equal((html.match(/class="static-profile"/g) || []).length, profiles.profiles.length);
        assert.match(html, /src="\/gaming-hub\/wow\/assets\/compass\.js"/);
        assert.match(html, /href="\/gaming-hub\/wow\/assets\/[^"/]+\.css"/);
        assert.doesNotMatch(html, /(?:src|href)="\/wow\/assets\//);
      }
      // Pages ignores _headers; the mounted preview must not imply otherwise.
      for (const header of [
        "content-security-policy",
        "referrer-policy",
        "x-content-type-options",
        "x-robots-tag",
      ])
        assert.equal(response.headers.get(header), null, header);
    }
    for (const [from, to] of [
      ["/gaming-hub", basePath],
      [basePath + "wow", basePath + "wow/"],
    ]) {
      const redirect = await fetch(origin + from, { redirect: "manual" });
      assert.equal(redirect.status, 308, from);
      assert.equal(redirect.headers.get("location"), to);
    }
    for (const wrongRoot of [
      "/",
      "/wow/",
      "/placeholder/",
      "/assets/site.css",
      "/data/releases.json",
      "/wow/assets/compass.js",
      "/wow/assets/compass.css",
    ])
      assert.equal((await fetch(origin + wrongRoot)).status, 404, wrongRoot);
    const missing = await fetch(origin + basePath + "not-an-app/");
    assert.equal(missing.status, 404);
    assert.match(await missing.text(), /OFF THE MAP/);
    for (const route of [
      "wow/README.md",
      "wow/data/12.1.5/raw/bundle.json",
      "wow/pipeline/extract-playstyle.md",
      "wow/scraper/youtube.mjs",
      ".env",
    ])
      assert.equal((await fetch(origin + basePath + route)).status, 404, route);
    assert.deepEqual(
      await (await fetch(origin + basePath + "data/releases.json")).json(),
      releases,
    );
    assert.deepEqual(
      await (await fetch(origin + basePath + "data/apps.json")).json(),
      apps.map((app) => ({ ...app, href: basePath + app.href.slice(1) })),
    );
    const css = await (
      await fetch(origin + basePath + "your-tool/assets/tool.css")
    ).text();
    assert.match(css, /url\("\/gaming-hub\/your-tool\/assets\/icon\.svg"\)/);
    const script = await (
      await fetch(origin + basePath + "your-tool/assets/tool.js")
    ).text();
    assert.ok(script.includes('"/gaming-hub/data/releases.json"'));
    assert.doesNotMatch(script, /{{\w+}}/);
    const robots = await fetch(origin + basePath + "robots.txt");
    assert.equal(robots.status, 200);
    assert.match(await robots.text(), /Disallow: \//);
  } finally {
    if (pagesServer)
      await new Promise((resolve, reject) =>
        pagesServer.close((error) => (error ? reject(error) : resolve())),
      );
    await rm(fixture, { recursive: true, force: true });
    await build({ basePath: "/" });
  }
});

test("unsafe base paths fail before replacing the previous export", async () => {
  const before = await readFile(path.join(output, "index.html"), "utf8");
  for (const basePath of [
    "https://example.com/",
    "//example.com/",
    "/../",
    "/gaming-hub?query/",
  ])
    await assert.rejects(build({ basePath }));
  assert.equal(await readFile(path.join(output, "index.html"), "utf8"), before);
});
