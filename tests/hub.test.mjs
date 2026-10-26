import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { build, output, root, validateData } from "../scripts/build.mjs";
import { createStaticServer } from "../scripts/serve.mjs";

let server, base;
const releases = JSON.parse(
  await readFile(path.join(root, "data/releases.json"), "utf8"),
);
const apps = JSON.parse(
  await readFile(path.join(root, "data/apps.json"), "utf8"),
);
before(async () => {
  await build();
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
    ["/wow/", "No recommendations are available yet."],
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
    for (const [, url] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
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

test("security headers forbid third-party code and connections, with no app authentication required", async () => {
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
  await build();
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
