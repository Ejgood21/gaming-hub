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
const artwork = Object.fromEntries(["moon", "sunset", "crystal", "arch"].map(name => [name, true]));
const compass =
  '<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><circle cx="32" cy="32" r="25" stroke="currentColor" stroke-width="1.5"/><circle cx="32" cy="32" r="20" stroke="currentColor" stroke-width=".6"/><path d="m43 20-6 18-17 6 6-18z" fill="currentColor"/><path d="m43 20-11 12 5 6z" fill="#d8e8ff"/><path d="M32 3v9m0 40v9M3 32h9m40 0h9" stroke="currentColor" stroke-width="1.5"/></svg>';
const head =
  '<meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <meta name="robots" content="noindex, nofollow, noarchive">\n  <meta name="theme-color" content="#0b0e14">\n  <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">\n  <link rel="stylesheet" href="/assets/site.css">';
const header = (route) => `<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header"><div class="header-inner">
  <a class="brand" href="/" aria-label="Personal Gaming Hub home"><img class="brand-mark" src="/assets/favicon.svg" alt="" width="39" height="39"><span class="brand-name">gaming<span>hub</span><span aria-hidden="true">.</span></span></a>
  <nav class="main-nav" aria-label="Main navigation">
    <a href="/"${route === "/" ? ' aria-current="page"' : ""}>The hub</a>
    <a href="/wow/"${route === "/wow/" ? ' aria-current="page"' : ""}>WoW compass</a>
    <a href="/placeholder/"${route === "/placeholder/" ? ' aria-current="page"' : ""}>Coming soon</a>
  </nav><span class="header-note">YOUR NEXT SESSION</span>
</div></header>`;
const footer =
  '<footer class="site-footer"><div class="footer-inner"><a class="footer-brand" href="/">Personal Gaming Hub</a><div class="footer-note">No ads. No tracking.</div></div></footer>';
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
  <div class="release-content"><span class="badge badge-${item.status}">${statusLabels[item.status]}</span><h3 id="release-${item.id}">${escape(item.title)}</h3><p class="platform">${escape(item.platform)}</p><p class="release-date">${date}</p><details class="release-note"><summary>${escape(item.note)}</summary><div>${escape(item.note)}</div></details></div>
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
  <h3 id="app-${item.id}">${escape(item.title)}</h3><p title="${escape(item.description)}">${escape(item.description)}</p><div class="tool-meta"><span>Last updated <time datetime="${item.updated}">${formatDate(item.updated)}</time></span><span class="tool-arrow" aria-hidden="true"><svg class="direction-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 12 12 4M4 4h8v8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></span></div>
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
    if (d.name === "tft") {
      const source = path.join(root, "apps", d.name);
      const companion = path.join(source, "carousel-companion.html");
      await cp(companion, path.join(target, "index.html"));
      await cp(companion, path.join(target, "carousel-companion.html"));
      await cp(path.join(source, "data"), path.join(target, "data"), { recursive: true });
      continue;
    }
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
