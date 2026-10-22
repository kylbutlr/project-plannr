#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { formatCliError } from "./cli-errors.mjs";
import { hexToRgb, readTokens, repoRoot } from "./token-utils.mjs";

const themeVersion = "1.0.1";
const rasterArtifactVersion = 1;

function usage() {
  return `Generate an unpacked App Stylr Chrome theme.

Usage:
  app-stylr-chrome-theme [--output <directory>] [--check]

Repository default:
  --output chrome-theme`;
}

function parseArguments(argumentsList) {
  const options = {
    check: false,
    output: path.join(repoRoot, "chrome-theme")
  };

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === "--check") {
      options.check = true;
    } else if (argument === "--help" || argument === "-h") {
      console.log(usage());
      process.exit(0);
    } else if (argument === "--output") {
      const value = argumentsList[index + 1];
      if (!value) throw new Error("--output requires a value.");
      options.output = path.resolve(process.cwd(), value);
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${argument}\n\n${usage()}`);
    }
  }

  return options;
}

function rgb(hex) {
  const { red, green, blue } = hexToRgb(hex);
  return [red, green, blue];
}

function renderManifest(tokens) {
  const { brand, themes } = tokens;
  const dark = themes.dark;

  return `${JSON.stringify(
    {
      manifest_version: 3,
      version: themeVersion,
      name: "App Stylr Dark",
      short_name: "App Stylr",
      description: "A calm, dark Chrome theme built from the App Stylr charcoal-to-mint palette.",
      author: "App Stylr contributors",
      icons: {
        16: "icons/icon-16.png",
        32: "icons/icon-32.png",
        48: "icons/icon-48.png",
        128: "icons/icon-128.png"
      },
      theme: {
        images: {
          theme_ntp_background: "images/theme-ntp-background.png"
        },
        colors: {
          background_tab: rgb(brand.charcoal),
          background_tab_inactive: rgb(dark.sidebar),
          background_tab_incognito: rgb(dark.selected),
          background_tab_incognito_inactive: rgb(dark.sidebar),
          bookmark_text: rgb(dark.textMuted),
          button_background: rgb(dark.selected),
          frame: rgb(dark.surfaceRaised),
          frame_inactive: rgb(dark.sidebar),
          frame_incognito: rgb(dark.selected),
          frame_incognito_inactive: rgb(dark.sidebar),
          ntp_background: rgb(dark.canvas),
          ntp_header: rgb(dark.textMuted),
          ntp_link: rgb(dark.link),
          ntp_text: rgb(dark.text),
          omnibox_background: rgb(dark.surfaceRaised),
          omnibox_text: rgb(dark.text),
          tab_background_text: rgb(dark.textMuted),
          tab_background_text_inactive: rgb(brand.sage),
          tab_background_text_incognito: rgb(dark.textMuted),
          tab_background_text_incognito_inactive: rgb(brand.sage),
          tab_text: rgb(dark.text),
          toolbar: rgb(dark.surface),
          toolbar_button_icon: rgb(dark.accent),
          toolbar_text: rgb(dark.text)
        },
        properties: {
          ntp_background_alignment: "center",
          ntp_background_repeat: "no-repeat",
          ntp_logo_alternate: 1
        }
      }
    },
    null,
    2
  )}\n`;
}

function renderBackgroundSvg(tokens, width, height) {
  const { brand, themes } = tokens;
  const dark = themes.dark;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="base" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="${dark.canvas}" />
      <stop offset="0.56" stop-color="${dark.sidebar}" />
      <stop offset="1" stop-color="${dark.surface}" />
    </linearGradient>
    <radialGradient id="mint" cx="0.88" cy="0.02" r="0.72">
      <stop offset="0" stop-color="${brand.mint}" stop-opacity="0.2" />
      <stop offset="0.42" stop-color="${brand.sage}" stop-opacity="0.07" />
      <stop offset="1" stop-color="${brand.ink}" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="slate" cx="0.04" cy="1" r="0.68">
      <stop offset="0" stop-color="${brand.slate}" stop-opacity="0.2" />
      <stop offset="0.55" stop-color="${brand.charcoal}" stop-opacity="0.06" />
      <stop offset="1" stop-color="${brand.ink}" stop-opacity="0" />
    </radialGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#base)" />
  <rect width="${width}" height="${height}" fill="url(#mint)" />
  <rect width="${width}" height="${height}" fill="url(#slate)" />
</svg>`;
}

function renderPreviewSvg(tokens) {
  const { brand, themes } = tokens;
  const dark = themes.dark;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="900" viewBox="0 0 1440 900">
  <defs>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="150%">
      <feDropShadow dx="0" dy="26" stdDeviation="28" flood-color="#000000" flood-opacity="0.36" />
    </filter>
    <clipPath id="window-clip">
      <rect x="64" y="54" width="1312" height="792" rx="20" />
    </clipPath>
    <linearGradient id="page-base" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="${dark.canvas}" />
      <stop offset="0.56" stop-color="${dark.sidebar}" />
      <stop offset="1" stop-color="${dark.surface}" />
    </linearGradient>
    <radialGradient id="page-mint" cx="0.88" cy="0.02" r="0.72">
      <stop offset="0" stop-color="${brand.mint}" stop-opacity="0.2" />
      <stop offset="0.42" stop-color="${brand.sage}" stop-opacity="0.07" />
      <stop offset="1" stop-color="${brand.ink}" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="mark" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="${brand.ink}" />
      <stop offset="0.48" stop-color="${brand.slate}" />
      <stop offset="1" stop-color="${brand.mint}" />
    </linearGradient>
  </defs>
  <rect width="1440" height="900" fill="${brand.ink}" />
  <g filter="url(#shadow)" clip-path="url(#window-clip)">
    <rect x="64" y="54" width="1312" height="792" rx="20" fill="${dark.surfaceRaised}" />
    <rect x="64" y="54" width="1312" height="84" fill="${dark.surfaceRaised}" />
    <circle cx="94" cy="82" r="7" fill="${dark.danger}" />
    <circle cx="118" cy="82" r="7" fill="${dark.warning}" />
    <circle cx="142" cy="82" r="7" fill="${dark.success}" />
    <path d="M177 96 Q177 76 197 76 H371 Q391 76 391 96 V138 H177 Z" fill="${dark.surface}" />
    <rect x="194" y="93" width="22" height="22" rx="7" fill="url(#mark)" />
    <text x="228" y="109" fill="${dark.text}" font-family="Arial, sans-serif" font-size="15">New Tab</text>
    <path d="M399 96 Q399 76 419 76 H593 Q613 76 613 96 V138 H399 Z" fill="${dark.surfaceRaised}" />
    <text x="426" y="109" fill="${dark.textMuted}" font-family="Arial, sans-serif" font-size="15">App Stylr</text>
    <rect x="64" y="138" width="1312" height="70" fill="${dark.surface}" />
    <path d="M98 173 l12 -10 v20 z" fill="${dark.accent}" opacity="0.85" />
    <path d="M143 163 l12 10 -12 10" fill="none" stroke="${dark.textMuted}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M191 163 a12 12 0 1 0 3 16" fill="none" stroke="${dark.textMuted}" stroke-width="3" stroke-linecap="round" />
    <rect x="238" y="152" width="930" height="42" rx="21" fill="${dark.surfaceRaised}" />
    <circle cx="266" cy="173" r="8" fill="none" stroke="${dark.textMuted}" stroke-width="2" />
    <path d="M272 179 l6 6" stroke="${dark.textMuted}" stroke-width="2" stroke-linecap="round" />
    <text x="292" y="179" fill="${dark.textMuted}" font-family="Arial, sans-serif" font-size="14">Search Google or type a URL</text>
    <circle cx="1216" cy="173" r="4" fill="${dark.accent}" />
    <circle cx="1240" cy="173" r="4" fill="${dark.accent}" />
    <circle cx="1264" cy="173" r="4" fill="${dark.accent}" />
    <rect x="64" y="208" width="1312" height="638" fill="url(#page-base)" />
    <rect x="64" y="208" width="1312" height="638" fill="url(#page-mint)" />
    <rect x="654" y="350" width="132" height="132" rx="34" fill="url(#mark)" />
    <rect x="408" y="526" width="624" height="58" rx="29" fill="${dark.surface}" stroke="${dark.border}" />
    <circle cx="445" cy="555" r="9" fill="none" stroke="${dark.accent}" stroke-width="2" />
    <path d="M452 562 l7 7" stroke="${dark.accent}" stroke-width="2" stroke-linecap="round" />
    <text x="482" y="562" fill="${dark.textMuted}" font-family="Arial, sans-serif" font-size="16">Search the web</text>
  </g>
</svg>`;
}

async function renderIcon(source, size) {
  return sharp(source, { density: 288 })
    .resize(size, size, { fit: "contain", kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function renderPng(svg) {
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const themeRoot = options.output;
  const tokens = await readTokens();
  const iconSource = path.join(repoRoot, "assets", "app-icon-gradient-base.svg");
  const backgroundSvg = renderBackgroundSvg(tokens, 2560, 1440);
  const previewSvg = renderPreviewSvg(tokens);
  const rasterSourceHash = createHash("sha256")
    .update(
      JSON.stringify({
        rasterArtifactVersion,
        themeVersion,
        backgroundSvg,
        previewSvg
      })
    )
    .digest("hex");
  const generatedAssets = {
    rasterArtifactVersion,
    rasterSourceHash,
    outputs: {
      "images/theme-ntp-background.png": {
        width: 2560,
        height: 1440
      },
      "preview.png": {
        width: 1440,
        height: 900
      }
    }
  };
  const outputs = [
    {
      path: path.join(themeRoot, "manifest.json"),
      content: Buffer.from(renderManifest(tokens))
    },
    {
      path: path.join(themeRoot, "images", "theme-ntp-background.png"),
      content: await renderPng(backgroundSvg),
      check: "metadata",
      width: 2560,
      height: 1440
    },
    {
      path: path.join(themeRoot, "preview.png"),
      content: await renderPng(previewSvg),
      check: "metadata",
      width: 1440,
      height: 900
    },
    {
      path: path.join(themeRoot, "generated-assets.json"),
      content: Buffer.from(`${JSON.stringify(generatedAssets, null, 2)}\n`)
    }
  ];

  for (const size of [16, 32, 48, 128]) {
    outputs.push({
      path: path.join(themeRoot, "icons", `icon-${size}.png`),
      content: await renderIcon(iconSource, size)
    });
  }

  const stale = [];

  for (const output of outputs) {
    if (options.check) {
      if (output.check === "metadata") {
        try {
          const metadata = await sharp(output.path).metadata();
          if (metadata.format !== "png" || metadata.width !== output.width || metadata.height !== output.height) {
            stale.push(path.relative(repoRoot, output.path));
          }
        } catch {
          stale.push(path.relative(repoRoot, output.path));
        }
        continue;
      }

      try {
        const current = await readFile(output.path);
        if (!current.equals(output.content)) stale.push(path.relative(repoRoot, output.path));
      } catch {
        stale.push(path.relative(repoRoot, output.path));
      }
      continue;
    }

    await mkdir(path.dirname(output.path), { recursive: true });
    await writeFile(output.path, output.content);
    console.log(`Generated ${path.relative(repoRoot, output.path)}`);
  }

  if (stale.length > 0) {
    throw new Error(`Generated Chrome theme files are stale or missing:\n- ${stale.join("\n- ")}`);
  }

  if (options.check) console.log("Generated Chrome theme files are current.");
}

main().catch((error) => {
  console.error(formatCliError(error));
  process.exitCode = 1;
});
