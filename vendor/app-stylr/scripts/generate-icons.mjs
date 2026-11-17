#!/usr/bin/env node

import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { formatCliError } from "./cli-errors.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultSource = path.join(repoRoot, "assets", "example-app-icon.svg");
const defaultOutput = path.join(repoRoot, "assets", "platform-icons", "reference");

const exports = [
  { relativePath: "chrome/icon-16.png", size: 16 },
  { relativePath: "chrome/icon-32.png", size: 32 },
  { relativePath: "chrome/icon-48.png", size: 48 },
  { relativePath: "chrome/icon-128.png", size: 128 },
  { relativePath: "web/favicon-32.png", size: 32 },
  { relativePath: "web/apple-touch-icon-152.png", size: 152 },
  { relativePath: "web/apple-touch-icon-167.png", size: 167 },
  { relativePath: "web/apple-touch-icon-180.png", size: 180 },
  { relativePath: "web/apple-touch-icon.png", size: 180 },
  { relativePath: "web/icon-192.png", size: 192 },
  { relativePath: "web/icon-512.png", size: 512 }
];

function usage() {
  return `Generate App Stylr platform icons from one square master.

Usage:
  app-stylr-icons [--source <file>] [--source-16 <file>] [--output <directory>] [--check]

Defaults:
  --source assets/example-app-icon.svg
  --output assets/platform-icons/reference`;
}

function parseArguments(argumentsList) {
  const options = {
    check: false,
    output: defaultOutput,
    source: defaultSource,
    source16: null
  };

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];

    if (argument === "--check") {
      options.check = true;
      continue;
    }

    if (argument === "--help" || argument === "-h") {
      console.log(usage());
      process.exit(0);
    }

    if (["--source", "--source-16", "--output"].includes(argument)) {
      const value = argumentsList[index + 1];
      if (!value) throw new Error(`${argument} requires a value.`);
      options[argument === "--source-16" ? "source16" : argument.slice(2)] = path.resolve(process.cwd(), value);
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}\n\n${usage()}`);
  }

  if (!options.source16 && options.source === defaultSource) {
    options.source16 = path.join(repoRoot, "assets", "example-app-icon-16.svg");
  }
  return options;
}

async function renderIcon(source, size) {
  const input = await readFile(source);
  const metadata = await sharp(input).metadata();
  if (metadata.format === "svg") {
    const svg = input.toString("utf8").replace(/<svg\b([^>]*)>/iu, (_match, attributes) => {
      const clean = attributes.replace(/\s(?:width|height)\s*=\s*(?:"[^"]*"|'[^']*')/giu, "");
      const viewBox = /\bviewBox\s*=/u.test(attributes) ? "" : ` viewBox="0 0 ${metadata.width} ${metadata.height}"`;
      return `<svg${clean}${viewBox} width="${size}" height="${size}">`;
    });
    return sharp(Buffer.from(svg)).ensureAlpha().png({ compressionLevel: 9 }).toBuffer();
  }
  return sharp(source, { density: 288 })
    .resize(size, size, {
      fit: "contain",
      kernel: sharp.kernel.lanczos3
    })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  await access(options.source);

  let metadata;
  try {
    metadata = await sharp(options.source).metadata();
  } catch {
    throw new Error(`Could not read the source icon: ${options.source}. Choose a valid square SVG or PNG.`);
  }
  if (!metadata.width || !metadata.height || metadata.width !== metadata.height) {
    throw new Error("The source icon must have equal, non-zero width and height.");
  }
  if (options.source16) {
    await access(options.source16);
    const small = await sharp(options.source16).metadata();
    if (!small.width || small.width !== small.height) {
      throw new Error("The 16px source icon must have equal, non-zero width and height.");
    }
  }

  const mismatches = [];

  for (const iconExport of exports) {
    const destination = path.join(options.output, iconExport.relativePath);
    const source = iconExport.size === 16 && options.source16 ? options.source16 : options.source;
    const rendered = await renderIcon(source, iconExport.size);

    if (options.check) {
      try {
        const current = await readFile(destination);
        if (!current.equals(rendered)) mismatches.push(iconExport.relativePath);
      } catch {
        mismatches.push(iconExport.relativePath);
      }
      continue;
    }

    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, rendered);
    console.log(`Generated ${path.relative(repoRoot, destination)} (${iconExport.size}x${iconExport.size}).`);
  }

  // The Reference identifies the foundation with a blank tile, not the example glyph.
  if (options.source === defaultSource && options.output === defaultOutput) {
    const destination = path.join(repoRoot, "assets", "favicon-32.png");
    const rendered = await renderIcon(path.join(repoRoot, "assets", "app-icon-monochrome-base.svg"), 32);
    if (options.check) {
      try {
        if (!(await readFile(destination)).equals(rendered)) mismatches.push("assets/favicon-32.png");
      } catch { mismatches.push("assets/favicon-32.png"); }
    } else {
      await writeFile(destination, rendered);
      console.log("Generated assets/favicon-32.png (32x32).");
    }
  }

  if (mismatches.length > 0) {
    throw new Error(`Generated platform icons are stale or missing:\n- ${mismatches.join("\n- ")}`);
  }

  if (options.check) console.log("Generated platform icons are current.");
}

main().catch((error) => {
  console.error(formatCliError(error));
  process.exitCode = 1;
});
