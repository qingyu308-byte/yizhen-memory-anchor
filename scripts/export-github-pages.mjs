import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const clientDir = join(projectRoot, "dist", "client");
const serverEntry = join(projectRoot, "dist", "server", "index.js");
const outputDir = join(projectRoot, "dist", "github-pages");

const repository = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "yizhen-memory-anchor";
const owner = process.env.GITHUB_REPOSITORY_OWNER ?? "qingyu308-byte";
const configuredBasePath = process.env.GITHUB_PAGES_BASE_PATH ?? `/${repository}`;
const basePath = `/${configuredBasePath}`.replace(/\/+/g, "/").replace(/\/$/, "");
const pagesOrigin = process.env.GITHUB_PAGES_ORIGIN ?? `https://${owner}.github.io`;

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });
await cp(clientDir, outputDir, { recursive: true });

const workerUrl = pathToFileURL(serverEntry);
workerUrl.searchParams.set("github-pages-export", `${Date.now()}`);
const { default: worker } = await import(workerUrl.href);
const response = await worker.fetch(
  new Request("https://static-export.invalid/", { headers: { accept: "text/html" } }),
  { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
  { waitUntil() {}, passThroughOnException() {} },
);

if (!response.ok) {
  throw new Error(`Static render failed with status ${response.status}`);
}

const publicAssetPaths = [
  "/_next/",
  "/memories/",
  "/favicon.svg",
  "/og.png",
  "/file.svg",
  "/window.svg",
  "/globe.svg",
];

function rewriteForPages(source) {
  let rewritten = source
    .replaceAll("https://static-export.invalid/og.png", `${pagesOrigin}${basePath}/og.png`)
    .replaceAll("http://static-export.invalid/og.png", `${pagesOrigin}${basePath}/og.png`)
    .replaceAll("http://localhost:3000/og.png", `${pagesOrigin}${basePath}/og.png`);

  for (const assetPath of publicAssetPaths) {
    rewritten = rewritten
      .replaceAll(`\"${assetPath}`, `\"${basePath}${assetPath}`)
      .replaceAll(`'${assetPath}`, `'${basePath}${assetPath}`)
      .replaceAll(`\\\"${assetPath}`, `\\\"${basePath}${assetPath}`);
  }

  return rewritten;
}

const html = rewriteForPages(await response.text());
await writeFile(join(outputDir, "index.html"), html);
await writeFile(join(outputDir, "404.html"), html);
await writeFile(join(outputDir, ".nojekyll"), "");

const textExtensions = new Set([".css", ".html", ".js", ".json", ".map", ".svg", ".txt", ".webmanifest", ".xml"]);

async function rewriteDirectory(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await rewriteDirectory(path);
      continue;
    }
    if (!textExtensions.has(extname(entry.name))) continue;

    const source = await readFile(path, "utf8");
    const rewritten = rewriteForPages(source);
    if (rewritten !== source) await writeFile(path, rewritten);
  }
}

await rewriteDirectory(outputDir);

console.log(`GitHub Pages export created at ${outputDir} with base path ${basePath}`);
