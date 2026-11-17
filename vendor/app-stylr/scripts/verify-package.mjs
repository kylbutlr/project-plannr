import { execFile } from "node:child_process";
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { repoRoot } from "./token-utils.mjs";

const execFileAsync = promisify(execFile);
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "app-stylr-package-"));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function run(command, argumentsList, options = {}) {
  return execFileAsync(command, argumentsList, {
    maxBuffer: 10 * 1024 * 1024,
    ...options
  });
}

try {
  const packageOutput = await run(
    "npm",
    ["pack", "--json", "--pack-destination", temporaryRoot, "--cache", path.join(temporaryRoot, "npm-cache")],
    { cwd: repoRoot }
  );
  const [packed] = JSON.parse(packageOutput.stdout);
  const paths = packed.files.map((file) => file.path);
  const requiredPaths = [
    "LICENSE",
    "README.md",
    "adapters/css/app-stylr.css",
    "adapters/css/fonts.css",
    "adapters/swift/AppStylrTokens.swift",
    "assets/example-app-icon.svg",
    "docs/design-practice.md",
    "docs/package-interface.md",
    "examples/web/index.html",
    "scripts/build-chrome-theme.mjs",
    "scripts/build-site.mjs",
    "scripts/cli-errors.mjs",
    "scripts/generate-icons.mjs",
    "scripts/token-utils.mjs",
    "scripts/validate-macos-release.mjs",
    "reference/index.html",
    "reference/styles.css",
    "reference/workbench.js",
    "assets/app-icon-flat-base.svg",
    "assets/app-icon-monochrome-base.svg",
    "assets/example-app-icon-16.svg",
    "tokens/app-stylr.json",
    "tokens/app-stylr.schema.json"
  ];

  for (const requiredPath of requiredPaths) {
    assert(paths.includes(requiredPath), `Packed package is missing ${requiredPath}.`);
  }
  assert(!paths.some((file) => file.startsWith("family/") || file.startsWith("consumers/")), "Packed package contains private registry data.");
  assert(!paths.includes("scripts/audit-consumers.mjs"), "Packed package contains private fleet audit tooling.");

  const archivePath = path.join(temporaryRoot, packed.filename);
  const fixtureRoot = path.join(temporaryRoot, "consumer");
  await mkdir(fixtureRoot, { recursive: true });
  await cp(path.join(repoRoot, "examples", "web"), fixtureRoot, { recursive: true });

  const fixturePackagePath = path.join(fixtureRoot, "package.json");
  const fixturePackage = JSON.parse(await readFile(fixturePackagePath, "utf8"));
  fixturePackage.dependencies["app-stylr"] = `file:${archivePath}`;
  await writeFile(fixturePackagePath, `${JSON.stringify(fixturePackage, null, 2)}\n`);

  await run(
    "npm",
    ["install", "--ignore-scripts", "--cache", process.env.APP_STYLR_NPM_CACHE ?? path.join(temporaryRoot, "npm-cache")],
    { cwd: fixtureRoot }
  );

  const exportCheck = `
    import { createRequire } from "node:module";
    import { readFile } from "node:fs/promises";
    const require = createRequire(import.meta.url);
    const tokens = require("app-stylr/tokens");
    if (tokens.version !== "${packed.version}") throw new Error("Token export version mismatch");
    for (const name of ["app-stylr/css", "app-stylr/fonts.css", "app-stylr/controls.css", "app-stylr/assets/example-app-icon.svg", "app-stylr/templates/app-stylr.json", "app-stylr/chrome-theme/manifest.json", "app-stylr/package.json"]) {
      await readFile(require.resolve(name));
    }
  `;
  await run(process.execPath, ["--input-type=module", "--eval", exportCheck], { cwd: fixtureRoot });

  for (const command of ["app-stylr-icons", "app-stylr-chrome-theme", "app-stylr-macos-release-check", "app-stylr-reference"]) {
    await run(path.join(fixtureRoot, "node_modules", ".bin", command), ["--help"], { cwd: fixtureRoot });
  }

  const referenceCommand = path.join(fixtureRoot, "node_modules", ".bin", "app-stylr-reference");
  const referenceOutput = path.join(fixtureRoot, "public", "app-stylr");
  await run(
    referenceCommand,
    ["--output", referenceOutput, "--canonical-url", "https://example.com/app-stylr"],
    { cwd: fixtureRoot }
  );
  const referenceHtml = await readFile(path.join(referenceOutput, "index.html"), "utf8");
  const referenceCss = await readFile(path.join(referenceOutput, "styles.css"), "utf8");
  const referenceManifest = JSON.parse(
    await readFile(path.join(referenceOutput, "app-stylr-reference.json"), "utf8")
  );
  assert(
    referenceHtml.includes('<link rel="canonical" href="https://example.com/app-stylr" />'),
    "Generated Reference canonical URL is incorrect."
  );
  assert(
    referenceHtml.includes('<meta property="og:url" content="https://example.com/app-stylr" />') &&
      referenceHtml.includes(
        '<meta property="og:image" content="https://example.com/app-stylr/assets/platform-icons/reference/web/icon-512.png" />'
      ) &&
      referenceHtml.includes('"url":"https://example.com/app-stylr"'),
    "Generated Reference sharing metadata does not use the requested canonical URL."
  );
  assert(
    !referenceHtml.includes("__APP_STYLR_SOCIAL_IMAGE_URL__"),
    "Generated Reference contains an unresolved metadata placeholder."
  );
  assert(
    referenceHtml.includes('href="/app-stylr/styles.css"') &&
      referenceHtml.includes('src="/app-stylr/assets/example-app-icon.svg"'),
    "Generated Reference HTML does not use the requested base path."
  );
  assert(
    referenceCss.includes('@import "/app-stylr/adapters/css/fonts.css";'),
    "Generated Reference CSS does not use the requested base path."
  );
  assert(
    JSON.stringify(referenceManifest) ===
      JSON.stringify({
        name: "App Stylr Reference",
        version: packed.version,
        canonicalUrl: "https://example.com/app-stylr",
        basePath: "/app-stylr"
      }),
    "Generated Reference manifest is incorrect."
  );

  const iconsCommand = path.join(fixtureRoot, "node_modules", ".bin", "app-stylr-icons");
  try {
    await run(iconsCommand, ["--source", path.join(fixtureRoot, "missing-icon.svg"), "--output", path.join(fixtureRoot, "missing-output")], { cwd: fixtureRoot });
    throw new Error("Icon generation should fail when the selected source is missing.");
  } catch (error) {
    assert(
      error?.stderr?.includes("Could not find") && error.stderr.includes("Check the path and try again."),
      "Installed icon command must explain how to recover from a missing source."
    );
  }
  const iconSource = path.join(fixtureRoot, "node_modules", "app-stylr", "assets", "example-app-icon.svg");
  const iconsOutput = path.join(fixtureRoot, "generated-icons");
  await run(iconsCommand, ["--source", iconSource, "--output", iconsOutput], { cwd: fixtureRoot });
  await run(iconsCommand, ["--source", iconSource, "--output", iconsOutput, "--check"], { cwd: fixtureRoot });
  await readFile(path.join(iconsOutput, "chrome", "icon-128.png"));

  const themeCommand = path.join(fixtureRoot, "node_modules", ".bin", "app-stylr-chrome-theme");
  const themeOutput = path.join(fixtureRoot, "generated-theme");
  await run(themeCommand, ["--output", themeOutput], { cwd: fixtureRoot });
  await run(themeCommand, ["--output", themeOutput, "--check"], { cwd: fixtureRoot });
  await readFile(path.join(themeOutput, "manifest.json"));

  const releaseRoot = path.join(fixtureRoot, "sample-release");
  const archiveName = "Sample-App-1.2.3.zip";
  await mkdir(path.join(releaseRoot, "Sample.app"), { recursive: true });
  await writeFile(path.join(releaseRoot, "Sample.app", "marker.txt"), "sample\n");
  await run("zip", ["-qr", archiveName, "Sample.app"], { cwd: releaseRoot });
  await writeFile(path.join(releaseRoot, "Info.plist"), `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict>
<key>CFBundleShortVersionString</key><string>1.2.3</string>
<key>CFBundleVersion</key><string>1002003</string>
<key>SUFeedURL</key><string>https://updates.example.com/appcast.xml</string>
<key>SUPublicEDKey</key><string>YWJjZA==</string>
<key>SURequireSignedFeed</key><true/>
</dict></plist>
`);
  await writeFile(path.join(releaseRoot, "appcast.xml"), `<rss xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle"><channel><item>
<sparkle:shortVersionString>1.2.3</sparkle:shortVersionString>
<sparkle:version>1002003</sparkle:version>
<enclosure url="https://updates.example.com/${archiveName}" sparkle:edSignature="sample" />
<!-- sparkle-signatures: sample -->
</item></channel></rss>
`);
  await run(
    path.join(fixtureRoot, "node_modules", ".bin", "app-stylr-macos-release-check"),
    ["--root", releaseRoot, "--info-plist", "Info.plist", "--appcast", "appcast.xml", "--archive", archiveName],
    { cwd: fixtureRoot }
  );

  await run("npm", ["run", "build"], { cwd: fixtureRoot });
  await readFile(path.join(fixtureRoot, "dist", "index.html"));
  await readFile(path.join(fixtureRoot, "dist", "vendor", "app-stylr", "adapters", "css", "app-stylr.css"));

  console.log(`Verified ${packed.name}@${packed.version}: ${packed.entryCount} packed files, clean install, public exports, all four commands, generated outputs, and the complete web example.`);
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
