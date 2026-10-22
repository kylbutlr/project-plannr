#!/usr/bin/env node

import { cp, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { formatCliError } from "./cli-errors.mjs";
import { readTokens, repoRoot } from "./token-utils.mjs";

const defaultCanonicalUrl = "https://kylbutlr.com/app-stylr";

function usage() {
  return `Build the portable App Stylr Reference site.

Usage:
  app-stylr-reference [--output <directory>] [--canonical-url <url>] [--base-path <path>]

Repository defaults:
  --output .site
  --canonical-url ${defaultCanonicalUrl}
  --base-path /`;
}

function normalizeBasePath(value) {
  if (!value.startsWith("/")) throw new Error("--base-path must start with /.");
  if (value.includes("?") || value.includes("#")) {
    throw new Error("--base-path must not include a query string or fragment.");
  }
  if (!/^\/(?:[A-Za-z0-9._~%-]+\/?)*$/u.test(value)) {
    throw new Error("--base-path contains unsupported characters.");
  }

  const normalized = path.posix.normalize(value);
  return normalized === "/" ? "/" : normalized.replace(/\/$/u, "");
}

function normalizeCanonicalUrl(value) {
  let canonicalUrl;

  try {
    canonicalUrl = new URL(value);
  } catch {
    throw new Error("--canonical-url must be an absolute HTTP or HTTPS URL.");
  }

  if (!["http:", "https:"].includes(canonicalUrl.protocol)) {
    throw new Error("--canonical-url must be an absolute HTTP or HTTPS URL.");
  }
  if (canonicalUrl.username || canonicalUrl.password || canonicalUrl.search || canonicalUrl.hash) {
    throw new Error("--canonical-url must not include credentials, a query string, or a fragment.");
  }

  return canonicalUrl.toString();
}

function parseArguments(argumentsList) {
  const options = {
    basePath: null,
    canonicalUrl: defaultCanonicalUrl,
    output: path.join(repoRoot, ".site"),
    usesDefaultCanonicalUrl: true
  };

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];

    if (argument === "--help" || argument === "-h") {
      console.log(usage());
      process.exit(0);
    }

    if (["--base-path", "--canonical-url", "--output"].includes(argument)) {
      const value = argumentsList[index + 1];
      if (!value) throw new Error(`${argument} requires a value.`);

      if (argument === "--base-path") options.basePath = normalizeBasePath(value);
      if (argument === "--canonical-url") {
        options.canonicalUrl = normalizeCanonicalUrl(value);
        options.usesDefaultCanonicalUrl = false;
      }
      if (argument === "--output") options.output = path.resolve(process.cwd(), value);
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}\n\n${usage()}`);
  }

  const canonicalPath = normalizeBasePath(new URL(options.canonicalUrl).pathname);
  options.basePath ??= options.usesDefaultCanonicalUrl ? "/" : canonicalPath;
  delete options.usesDefaultCanonicalUrl;

  return options;
}

function publicPath(basePath, relativePath) {
  const prefix = basePath === "/" ? "" : basePath;
  return `${prefix}/${relativePath}`;
}

function isChildPath(parentPath, candidatePath) {
  const relativePath = path.relative(parentPath, candidatePath);
  return (
    relativePath !== "" &&
    !relativePath.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relativePath)
  );
}

async function resolvePotentialPath(candidatePath) {
  const missingSegments = [];
  let currentPath = candidatePath;

  while (true) {
    try {
      return path.join(await realpath(currentPath), ...missingSegments.reverse());
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      const parentPath = path.dirname(currentPath);
      if (parentPath === currentPath) throw error;
      missingSegments.push(path.basename(currentPath));
      currentPath = parentPath;
    }
  }
}

async function validateOutputPath(outputPath) {
  const resolvedOutput = await resolvePotentialPath(outputPath);
  const allowedRoots = await Promise.all(
    [process.cwd(), repoRoot].map((allowedRoot) => realpath(allowedRoot))
  );
  const matchingRoot = allowedRoots.find((allowedRoot) => isChildPath(allowedRoot, resolvedOutput));

  if (!matchingRoot) {
    throw new Error("--output must be a dedicated child directory of the current project or package.");
  }
  if (path.relative(matchingRoot, resolvedOutput).split(path.sep).includes(".git")) {
    throw new Error("--output must not target Git metadata.");
  }

  return resolvedOutput;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  options.output = await validateOutputPath(options.output);
  const tokens = await readTokens();
  const referenceRoot = path.join(repoRoot, "reference");
  const [referenceHtml, referenceCss] = await Promise.all([
    readFile(path.join(referenceRoot, "index.html"), "utf8"),
    readFile(path.join(referenceRoot, "styles.css"), "utf8")
  ]);
  const socialImageUrl = new URL(
    publicPath(options.basePath, "assets/platform-icons/reference/web/icon-512.png"),
    options.canonicalUrl
  ).toString();

  const renderedHtml = referenceHtml
    .replaceAll(defaultCanonicalUrl, options.canonicalUrl)
    .replaceAll("__APP_STYLR_SOCIAL_IMAGE_URL__", socialImageUrl)
    .replaceAll("../assets/", publicPath(options.basePath, "assets/"))
    .replaceAll("./styles.css", publicPath(options.basePath, "styles.css"));
  const renderedCss = referenceCss.replaceAll(
    "../adapters/",
    publicPath(options.basePath, "adapters/")
  );
  const manifest = {
    name: "App Stylr Reference",
    version: tokens.version,
    canonicalUrl: options.canonicalUrl,
    basePath: options.basePath
  };

  await rm(options.output, { recursive: true, force: true });
  await mkdir(options.output, { recursive: true });

  for (const directory of ["adapters", "assets"]) {
    await cp(path.join(repoRoot, directory), path.join(options.output, directory), {
      recursive: true
    });
  }

  await Promise.all([
    writeFile(path.join(options.output, "index.html"), renderedHtml),
    writeFile(path.join(options.output, "styles.css"), renderedCss),
    writeFile(
      path.join(options.output, "app-stylr-reference.json"),
      `${JSON.stringify(manifest, null, 2)}\n`
    )
  ]);

  console.log(
    `Prepared App Stylr Reference v${tokens.version} for ${options.canonicalUrl} in ${options.output}.`
  );
}

main().catch((error) => {
  console.error(formatCliError(error));
  process.exitCode = 1;
});
