import {
  cp,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { buildWow } from "../apps/wow/build.mjs";

export const root = fileURLToPath(new URL("../", import.meta.url));
export const output = path.join(root, "dist");
export function normalizeBasePath(value) {
  if (
    typeof value !== "string" ||
    !/^\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]*$/.test(value)
  )
    throw new Error("BASE_PATH must be a local path such as / or /gaming-hub/");
  return value.endsWith("/") ? value : `${value}/`;
}
const siteUrl = (url, basePath) =>
  url.startsWith("/") && !url.startsWith("//")
    ? basePath + url.slice(1)
    : url;
// Preserve source routes at /app/ while rendering deployable subpath URLs.
// JS fetch/import URLs can use {{basePath}}; arbitrary JS strings are not rewritten.
function withBasePath(source, basePath) {
  return source
    .replace(
      /\b(href|src|action|poster)=(['"])(\/(?!\/)[^'"\s]*)\2/g,
      (_, attribute, quote, url) =>
        `${attribute}=${quote}${siteUrl(url, basePath)}${quote}`,
    )
    .replace(
      /url\(\s*(['"]?)(\/(?!\/)[^'"\s)]*)\1\s*\)/g,
      (_, quote, url) => `url(${quote}${siteUrl(url, basePath)}${quote})`,
    )
    .replaceAll("{{basePath}}", basePath);
}
async function copyPublicAssets(source, target, basePath) {
  await cp(source, target, { recursive: true });
  const rewrite = async (directory) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await rewrite(file);
      else if (/\.(?:css|js|svg|html)$/.test(entry.name))
        await writeFile(
          file,
          withBasePath(await readFile(file, "utf8"), basePath),
        );
    }
  };
  await rewrite(target);
}
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const statusLabels = { firm: "FIRM", tba: "TBA", unconfirmed: "UNCONFIRMED" };
const artwork = {
  moon: '<circle cx="155" cy="52" r="30" fill="currentColor"/><circle cx="169" cy="43" r="28" fill="#263a39"/><path d="m0 126 43-48 22 21 36-53 57 80m-40 0 57-64 32 39 33-15 40 40" fill="#192e2e"/><path d="M120 126V83h17V63h12v20h18v43" fill="#122727"/>',
  sunset:
    '<circle cx="140" cy="62" r="34" fill="#f5d6a3"/><path d="M0 97h280v29H0z" fill="#a16860"/><path d="M0 106h280M0 114h280" stroke="#e4ac87"/><path d="M52 126c10-36 11-59 7-82m0 2c-21-14-29-7-33-1m33 0c5-20 20-25 32-16M59 46c13-6 24-1 29 8M59 45c-10-19-23-22-33-18" fill="none" stroke="currentColor" stroke-width="4"/><path d="M236 126c-6-25-8-40-4-57m0 0c10-15 23-15 28-12m-28 12c-16-7-24-2-29 4m29-4c-1-13-8-19-17-20" fill="none" stroke="currentColor" stroke-width="3"/>',
  crystal:
    '<circle cx="140" cy="69" r="45" fill="none" stroke="#687e96"/><circle cx="140" cy="69" r="34" fill="none" stroke="#687e96"/><path d="m140 27 24 35-24 48-24-48z" fill="currentColor"/><path d="m140 27 3 41-27-6m27 6-3 42 24-48z" fill="#dae0d8"/><path d="m140 27 3 41 21-6z" fill="#7c9aac"/><path d="M80 71h12m96 0h12M140 8v8m-73 10 7 7m132-7-7 7" stroke="#8da1b6"/>',
  arch: '<circle cx="140" cy="62" r="43" fill="#e0dcc0"/><path d="M93 126V72a47 47 0 0 1 94 0v54h-15V72a32 32 0 0 0-64 0v54z" fill="currentColor"/><path d="m129 126 8-34 8-15 7 18 13 31" fill="#eae2c8"/><path d="M0 126V76l17 19 17-35 25 66m151 0 17-48 18 21 15-40 20 67" fill="#798a5c"/><path d="m0 126 30-16 30 11 28-9 23 14m63 0 26-17 29 13 31-14 20 18" fill="#566b47"/>',
};
const artNames = {
  moon: "INTO THE UNKNOWN",
  sunset: "A DIFFERENT KIND OF HEAT",
  crystal: "FIND YOUR PARTY",
  arch: "BACK TO ALBION",
};
const compass =
  '<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><circle cx="32" cy="32" r="25" stroke="currentColor" stroke-width="1.5"/><circle cx="32" cy="32" r="20" stroke="currentColor" stroke-width=".6"/><path d="m43 20-6 18-17 6 6-18z" fill="currentColor"/><path d="m43 20-11 12 5 6z" fill="#e9eddf"/><path d="M32 3v9m0 40v9M3 32h9m40 0h9" stroke="currentColor" stroke-width="1.5"/></svg>';
const head =
  '<meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <meta name="robots" content="noindex, nofollow, noarchive">\n  <meta name="theme-color" content="#f7f5ef">\n  <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">\n  <link rel="stylesheet" href="/assets/site.css">';
const header = (route) => `<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header"><div class="header-inner">
  <a class="brand" href="/" aria-label="Personal Gaming Hub home"><img class="brand-mark" src="/assets/favicon.svg" alt="" width="39" height="39"><span class="brand-name">gaming<span>hub</span><span aria-hidden="true">.</span></span></a>
  <nav class="main-nav" aria-label="Main navigation">
    <a href="/"${route === "/" ? ' aria-current="page"' : ""}>The hub</a>
    <a href="/wow/"${route === "/wow/" ? ' aria-current="page"' : ""}>WoW compass</a>
    <a href="/placeholder/"${route === "/placeholder/" ? ' aria-current="page"' : ""}>Coming soon</a>
  </nav><span class="header-note">PERSONAL PLAYSPACE</span>
</div></header>`;
const footer =
  '<footer class="site-footer"><div class="footer-inner"><a class="footer-brand" href="/">Personal Gaming Hub</a><div class="footer-note">Built for the love of the game.<span aria-hidden="true">/</span>No ads. No tracking. Just play.</div></div></footer>';
const validDate = (s) =>
  typeof s === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  !Number.isNaN(Date.parse(s)) &&
  new Date(s).toISOString().slice(0, 10) === s;
const formatDate = (s) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${s}T00:00:00Z`));
function assert(ok, message) {
  if (!ok) throw new Error(message);
}
function requiredStrings(item, names, context) {
  for (const name of names)
    assert(
      typeof item?.[name] === "string" && item[name].trim(),
      `${context}: ${name} must be a nonempty string`,
    );
}
export function validateData(releases, apps) {
  assert(
    Array.isArray(releases) && releases.length,
    "releases.json must be a nonempty array",
  );
  assert(
    Array.isArray(apps) && apps.length,
    "apps.json must be a nonempty array",
  );
  for (const [name, items] of [
    ["releases", releases],
    ["apps", apps],
  ]) {
    const ids = new Set();
    for (const item of items) {
      requiredStrings(item, ["id", "title"], name);
      assert(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id),
        `${name}: invalid id ${item.id}`,
      );
      assert(!ids.has(item.id), `${name}: duplicate id ${item.id}`);
      ids.add(item.id);
    }
  }
  for (const item of releases) {
    requiredStrings(
      item,
      ["platform", "status", "window", "note", "art"],
      item.id,
    );
    assert(
      Object.hasOwn(statusLabels, item.status),
      `${item.id}: status must be firm, tba, or unconfirmed`,
    );
    assert(Object.hasOwn(artwork, item.art), `${item.id}: unknown art`);
    assert(
      item.date === null || validDate(item.date),
      `${item.id}: date must be YYYY-MM-DD or null`,
    );
    assert(
      item.status !== "firm" || validDate(item.date),
      `${item.id}: firm releases require a date`,
    );
  }
  for (const item of apps) {
    requiredStrings(
      item,
      ["description", "href", "status", "updated", "icon"],
      item.id,
    );
    assert(
      /^\/[a-z0-9]+(?:-[a-z0-9]+)*\/(?:#[a-z0-9-]+)?$/.test(item.href),
      `${item.id}: href must be a local /app/ route, optionally with a fragment`,
    );
    assert(
      ["shell", "coming-soon", "ready"].includes(item.status),
      `${item.id}: unsupported app status`,
    );
    assert(
      ["compass", "plus"].includes(item.icon),
      `${item.id}: unsupported icon`,
    );
    assert(validDate(item.updated), `${item.id}: updated must be YYYY-MM-DD`);
  }
}
function releaseCard(item) {
  const date = item.date
    ? `<time datetime="${escape(item.date)}">${escape(item.window)}</time>`
    : escape(item.window);
  return `<article class="release-card" data-release-status="${item.status}" aria-labelledby="release-${item.id}">
  <div class="release-art art-${item.art}" aria-hidden="true"><svg viewBox="0 0 280 126" preserveAspectRatio="xMidYMid slice">${artwork[item.art]}</svg><span class="art-caption">${artNames[item.art]}</span></div>
  <div class="release-content"><span class="badge badge-${item.status}">${statusLabels[item.status]}</span><h3 id="release-${item.id}">${escape(item.title)}</h3><p class="platform">${escape(item.platform)}</p><p class="release-date">${date}</p><p class="release-note">${escape(item.note)}</p></div>
</article>`;
}
function appCard(item) {
  const label = {
    shell: "APP SHELL",
    "coming-soon": "COMING SOON",
    ready: "READY TO PLAY",
  }[item.status];
  return `<a class="tool-card ${item.status === "coming-soon" ? "future" : "featured"}" href="${escape(item.href)}" aria-labelledby="app-${item.id}">
  <div class="tool-top"><span class="tool-icon icon-${item.icon}" aria-hidden="true">${item.icon === "compass" ? compass : "+"}</span><span class="badge ${item.status === "coming-soon" ? "badge-soon" : "badge-shell"}">${label}</span></div>
  <h3 id="app-${item.id}">${escape(item.title)}</h3><p>${escape(item.description)}</p><div class="tool-meta"><span>Last updated <time datetime="${item.updated}">${formatDate(item.updated)}</time></span><span class="tool-arrow" aria-hidden="true"><svg class="direction-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 12 12 4M4 4h8v8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></span></div>
</a>`;
}
export async function build({
  basePath = process.env.BASE_PATH ?? "/gaming-hub/",
} = {}) {
  basePath = normalizeBasePath(basePath);
  const releases = JSON.parse(
    await readFile(path.join(root, "data/releases.json"), "utf8"),
  );
  const apps = JSON.parse(
    await readFile(path.join(root, "data/apps.json"), "utf8"),
  );
  validateData(releases, apps);
  const directories = (
    await readdir(path.join(root, "apps"), { withFileTypes: true })
  ).filter((d) => d.isDirectory() && !d.name.startsWith("_"));
  for (const d of directories)
    assert(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(d.name),
      `Invalid app folder: ${d.name}`,
    );
  // Validate card destinations before deleting the previous output.
  for (const app of apps) {
    const [route, fragment] = app.href.slice(1).split("/");
    assert(
      directories.some((d) => d.name === route),
      `${app.id}: missing apps/${route}/ folder`,
    );
    const source = await readFile(
      path.join(root, "apps", route, "index.html"),
      "utf8",
    );
    if (fragment)
      assert(
        source.includes(`id="${fragment.slice(1)}"`),
        `${app.id}: missing ${fragment} anchor`,
      );
  }
  const render = (html, route) =>
    withBasePath(
      html.replace(
        /{{(head|header|footer|releaseCards|appCards|compassIcon)}}/g,
        (_, key) =>
          ({
            head,
            header: header(route),
            footer,
            releaseCards: releases.map(releaseCard).join("\n"),
            appCards: apps.map(appCard).join("\n"),
            compassIcon: compass,
          })[key],
      ),
      basePath,
    );
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  for (const file of ["index.html", "404.html"])
    await writeFile(
      path.join(output, file),
      render(
        await readFile(path.join(root, file), "utf8"),
        file === "index.html" ? "/" : "/404/",
      ),
    );
  for (const d of directories) {
    const target = path.join(output, d.name);
    await mkdir(target, { recursive: true });
    await writeFile(
      path.join(target, "index.html"),
      render(
        await readFile(path.join(root, "apps", d.name, "index.html"), "utf8"),
        `/${d.name}/`,
      ),
    );
    const assets = path.join(root, "apps", d.name, "assets");
    if (
      await stat(assets)
        .then((s) => s.isDirectory())
        .catch((e) => {
          if (e.code === "ENOENT") return false;
          throw e;
        })
    ) {
      await copyPublicAssets(assets, path.join(target, "assets"), basePath);
    }
  }
  await copyPublicAssets(
    path.join(root, "assets"),
    path.join(output, "assets"),
    basePath,
  );
  for (const file of ["data", "_headers", "robots.txt"])
    await cp(path.join(root, file), path.join(output, file), {
      recursive: true,
    });
  await writeFile(
    path.join(output, "data/apps.json"),
    JSON.stringify(
      apps.map((app) => ({ ...app, href: siteUrl(app.href, basePath) })),
      null,
      2,
    ) + "\n",
  );
  await buildWow({ root, output, basePath });

  console.log(
    `Built dist/ for ${basePath}: home + ${directories.length} apps, ${releases.length} releases, ${apps.length} tool cards.`,
  );
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await build();
