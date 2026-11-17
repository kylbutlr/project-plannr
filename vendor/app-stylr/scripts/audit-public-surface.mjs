import { execFile } from "node:child_process";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { repoRoot } from "./token-utils.mjs";

const execFileAsync = promisify(execFile);
const errors = [];
const textExtensions = new Set([".css", ".html", ".js", ".json", ".md", ".mjs", ".swift", ".toml", ".txt", ".xml"]);

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function checkText(relativePath, source) {
  const rules = [
    [/\/Users\/[A-Za-z0-9._-]+\//u, "contains an absolute macOS user path"],
    [/file:\/\//u, "contains a file URL"],
    [/https:\/\/github\.com\/kylbutlr\/(?!(?:app-stylr|portfolio)(?:\.git)?(?:[\s/#)"'`]|$))/u, "links to a repository outside the approved public projects"],
    [/(?:family|consumers)\/registry\.json/u, "references a private registry path"],
    [/\bconsumers:audit\b|audit-consumers\.mjs/u, "references private fleet audit tooling"]
  ];

  for (const [pattern, message] of rules) {
    if (pattern.test(source)) errors.push(`${relativePath} ${message}.`);
  }
}

const { stdout } = await execFileAsync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { cwd: repoRoot });
const trackedFiles = stdout.split("\0").filter(Boolean);

for (const relativePath of trackedFiles) {
  if (["scripts/audit-public-surface.mjs", "scripts/verify-package.mjs"].includes(relativePath)) continue;
  if (!textExtensions.has(path.extname(relativePath)) && !["LICENSE", "Package.swift"].includes(relativePath)) continue;
  const absolutePath = path.join(repoRoot, relativePath);
  if (await exists(absolutePath)) checkText(relativePath, await readFile(absolutePath, "utf8"));
}

for (const privateDirectory of ["family", "consumers"]) {
  if (await exists(path.join(repoRoot, privateDirectory))) errors.push(`${privateDirectory}/ must not exist in the public tree.`);
}

const packageJson = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));
if (Object.hasOwn(packageJson.exports ?? {}, "./family")) errors.push("package.json must not export private family data.");
if ((packageJson.files ?? []).some((entry) => ["family", "consumers"].includes(entry))) {
  errors.push("package.json files must not include private registry directories.");
}

const siteRoot = path.join(repoRoot, ".site");
if (await exists(siteRoot)) {
  const queue = [siteRoot];
  while (queue.length > 0) {
    const directory = queue.pop();
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) queue.push(absolutePath);
      else if (textExtensions.has(path.extname(entry.name))) {
        checkText(path.relative(repoRoot, absolutePath), await readFile(absolutePath, "utf8"));
      }
    }
  }
}

if (errors.length > 0) {
  console.error("Public-surface privacy audit failed:\n");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log("Public tracked text, package metadata, and site artifact contain no private registry or local-path dependencies.");
}
