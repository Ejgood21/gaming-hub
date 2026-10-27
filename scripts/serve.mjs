import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { watch } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build, normalizeBasePath, output, root } from "./build.mjs";

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};
const securityHeaders = Object.fromEntries(
  (await readFile(path.join(root, "_headers"), "utf8"))
    .split("\n")
    .filter((line) => line.startsWith("  "))
    .map((line) => {
      const index = line.indexOf(":");
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
    }),
);
export function createStaticServer({
  basePath = "/",
  useSecurityHeaders = basePath === "/",
} = {}) {
  basePath = normalizeBasePath(basePath);
  return createServer(async (req, res) => {
    // GitHub Pages ignores _headers. Subpath previews model that behavior;
    // the root development server retains the optional local-only headers.
    if (useSecurityHeaders)
      for (const [name, value] of Object.entries(securityHeaders))
        res.setHeader(name, value);
    if (!["GET", "HEAD"].includes(req.method)) {
      res.writeHead(405, { Allow: "GET, HEAD" });
      res.end();
      return;
    }
    try {
      const url = new URL(req.url, "http://localhost");
      const decoded = decodeURIComponent(url.pathname);
      if (decoded.includes("\0") || decoded.includes("\\")) {
        res.writeHead(400);
        res.end();
        return;
      }
      if (basePath !== "/" && decoded === basePath.slice(0, -1)) {
        res.writeHead(308, { Location: basePath + url.search });
        res.end();
        return;
      }
      if (!decoded.startsWith(basePath)) {
        res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
        res.end(
          req.method === "HEAD"
            ? undefined
            : await readFile(path.join(output, "404.html")),
        );
        return;
      }
      let file = path.resolve(output, `./${decoded.slice(basePath.length)}`);
      if (file !== output && !file.startsWith(output + path.sep)) {
        res.writeHead(403);
        res.end();
        return;
      }
      try {
        if ((await stat(file)).isDirectory()) {
          if (!url.pathname.endsWith("/")) {
            res.writeHead(308, { Location: url.pathname + "/" + url.search });
            res.end();
            return;
          }
          file = path.join(file, "index.html");
        }
        const bytes = await readFile(file);
        res.writeHead(200, {
          "Content-Type":
            types[path.extname(file)] || "application/octet-stream",
        });
        res.end(req.method === "HEAD" ? undefined : bytes);
      } catch (error) {
        if (!["ENOENT", "ENOTDIR"].includes(error.code)) throw error;
        res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
        res.end(
          req.method === "HEAD"
            ? undefined
            : await readFile(path.join(output, "404.html")),
        );
      }
    } catch {
      res.writeHead(400);
      res.end("Bad request");
    }
  });
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const basePath = normalizeBasePath(process.env.BASE_PATH ?? "/");
  await build({ basePath });
  const server = createStaticServer({ basePath });
  const port = Number(process.env.PORT || 4173);
  server.listen(port, "127.0.0.1", () =>
    console.log(
      `Serving dist at http://127.0.0.1:${port}${basePath}. ${process.argv.includes("--watch") ? "Watching source files; refresh the browser after edits." : ""}`,
    ),
  );
  if (process.argv.includes("--watch")) {
    let timer;
    let building = Promise.resolve();
    const queue = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        building = building
          .then(() => build({ basePath }))
          .catch((error) => console.error("Build failed:", error.message));
      }, 120);
    };
    for (const entry of ["assets", "apps", "data"])
      watch(path.join(root, entry), { recursive: true }, queue);
    for (const entry of ["index.html", "404.html", "_headers", "robots.txt"])
      watch(path.join(root, entry), queue);
  }
}
