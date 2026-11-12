#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, resolve } from "node:path";
import { formatCliError } from "./cli-errors.mjs";

function usage(message) {
  if (message) console.error(`Error: ${message}`);
  console.error("Usage: app-stylr-macos-release-check --info-plist PATH --appcast PATH --archive PATH [--root PATH]");
  process.exit(64);
}

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log("Usage: app-stylr-macos-release-check --info-plist PATH --appcast PATH --archive PATH [--root PATH]");
  process.exit(0);
}

function argumentsMap(arguments_) {
  const values = new Map();
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (!argument.startsWith("--")) usage(`Unexpected argument ${argument}.`);
    const [key, inlineValue] = argument.slice(2).split("=", 2);
    const value = inlineValue ?? arguments_[index + 1];
    if (inlineValue === undefined) index += 1;
    if (!value || value.startsWith("--")) usage(`Missing value for --${key}.`);
    values.set(key, value);
  }
  return values;
}

function escaped(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function plistString(contents, key) {
  const match = contents.match(new RegExp(`<key>${escaped(key)}</key>\\s*<string>([^<]*)</string>`, "u"));
  if (!match) throw new Error(`Info.plist is missing ${key}.`);
  return match[1];
}

function plistBoolean(contents, key) {
  const match = contents.match(new RegExp(`<key>${escaped(key)}</key>\\s*<(true|false)\\s*/>`, "u"));
  if (!match) throw new Error(`Info.plist is missing ${key}.`);
  return match[1] === "true";
}

function expectedBuild(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/u.exec(version);
  if (!match) throw new Error(`CFBundleShortVersionString ${version} must use major.minor.patch format.`);
  const components = match.slice(1).map(Number);
  if (components.some((component) => component > 999)) throw new Error(`Version ${version} has a component above 999.`);
  return String((components[0] * 1_000_000) + (components[1] * 1_000) + components[2]);
}

function requireText(contents, text, description) {
  if (!contents.includes(text)) throw new Error(`Appcast is missing ${description}.`);
}

function main() {
  const options = argumentsMap(process.argv.slice(2));
  const root = resolve(options.get("root") ?? process.cwd());
  const infoPlistPath = resolve(root, options.get("info-plist") ?? "");
  const appcastPath = resolve(root, options.get("appcast") ?? "");
  const archivePath = resolve(root, options.get("archive") ?? "");

  if (!options.has("info-plist") || !options.has("appcast") || !options.has("archive")) {
    usage("--info-plist, --appcast, and --archive are required.");
  }

  for (const [label, path] of [["Info.plist", infoPlistPath], ["appcast", appcastPath], ["archive", archivePath]]) {
    if (!existsSync(path)) throw new Error(`${label} does not exist: ${path}`);
  }

  const infoPlist = readFileSync(infoPlistPath, "utf8");
  const appcast = readFileSync(appcastPath, "utf8");
  const version = plistString(infoPlist, "CFBundleShortVersionString");
  const build = plistString(infoPlist, "CFBundleVersion");
  const expected = expectedBuild(version);
  const feedUrl = plistString(infoPlist, "SUFeedURL");
  const publicKey = plistString(infoPlist, "SUPublicEDKey");
  const archiveName = basename(archivePath);

  if (build !== expected) throw new Error(`CFBundleVersion ${build} does not match ${version}'s expected build ${expected}.`);
  if (!/^https:\/\//u.test(feedUrl)) throw new Error("SUFeedURL must use HTTPS.");
  if (publicKey.includes("REPLACE_WITH") || !/^[A-Za-z0-9+/]+={0,2}$/u.test(publicKey)) throw new Error("SUPublicEDKey must contain a real base64 Sparkle public key.");
  if (!plistBoolean(infoPlist, "SURequireSignedFeed")) throw new Error("SURequireSignedFeed must be true.");
  if (statSync(archivePath).size === 0) throw new Error(`Release archive is empty: ${archivePath}`);

  requireText(appcast, `<sparkle:shortVersionString>${version}</sparkle:shortVersionString>`, `version ${version}`);
  requireText(appcast, `<sparkle:version>${build}</sparkle:version>`, `build ${build}`);
  requireText(appcast, archiveName, `archive ${archiveName}`);
  requireText(appcast, "sparkle:edSignature=", `archive signature for ${archiveName}`);
  requireText(appcast, "<!-- sparkle-signatures:", "signed-feed metadata");

  try {
    execFileSync("unzip", ["-t", archivePath], { stdio: "pipe" });
  } catch (error) {
    const detail = error?.stderr?.toString().trim() || "invalid zip archive";
    throw new Error(`Release archive failed zip validation: ${detail}`);
  }

  console.log(`Verified macOS ${version} (${build}) release metadata.`);
  console.log(`Feed: ${feedUrl}`);
  console.log(`Archive: ${archiveName}`);
}

try {
  main();
} catch (error) {
  console.error(formatCliError(error));
  process.exitCode = 1;
}
