import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const repoRoot = fileURLToPath(new URL("..", import.meta.url));
export const tokenPath = path.join(repoRoot, "tokens", "app-stylr.json");

export async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

export async function readTokens() {
  return readJson(tokenPath);
}

export function kebabCase(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .toLowerCase();
}

export function pascalCase(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");
}

export function getPath(object, dottedPath) {
  return dottedPath.split(".").reduce((value, key) => value?.[key], object);
}

export function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return {
    red: Number.parseInt(value.slice(0, 2), 16),
    green: Number.parseInt(value.slice(2, 4), 16),
    blue: Number.parseInt(value.slice(4, 6), 16)
  };
}

function relativeLuminance(hex) {
  const { red, green, blue } = hexToRgb(hex);
  const channels = [red, green, blue].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function contrastRatio(foreground, background) {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const light = Math.max(foregroundLuminance, backgroundLuminance);
  const dark = Math.min(foregroundLuminance, backgroundLuminance);
  return (light + 0.05) / (dark + 0.05);
}

export function swiftColor(hex) {
  const { red, green, blue } = hexToRgb(hex);
  const channel = (value) => (value / 255).toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
  return `Color(red: ${channel(red)}, green: ${channel(green)}, blue: ${channel(blue)})`;
}

function renderCssProperties(properties, prefix, formatter = (value) => value) {
  return Object.entries(properties)
    .map(([name, value]) => `  --${prefix}-${kebabCase(name)}: ${formatter(value, name)};`)
    .join("\n");
}

function renderCssTheme(theme) {
  return renderCssProperties(theme, "ui");
}

export function renderCss(tokens) {
  const typeProperties = Object.entries(tokens.typography.styles)
    .flatMap(([styleName, style]) => [
      `  --type-${kebabCase(styleName)}-size: ${style.size}px;`,
      `  --type-${kebabCase(styleName)}-line-height: ${style.lineHeight}px;`,
      `  --type-${kebabCase(styleName)}-weight: ${style.weight};`,
      `  --type-${kebabCase(styleName)}-letter-spacing: ${style.letterSpacing}px;`
    ])
    .join("\n");

  const gradientStops = tokens.icon.gradient.stops
    .map((stop) => `${stop.color} ${stop.offset}%`)
    .join(", ");

  return `/* Generated from tokens/app-stylr.json by npm run build. Do not edit. */

:root {
  --app-stylr-version: "${tokens.version}";

${renderCssProperties(tokens.brand, "brand")}

  --font-sans: "${tokens.typography.families.sans}", ${tokens.typography.families.sansFallback};
  --font-mono: "${tokens.typography.families.mono}", ${tokens.typography.families.monoFallback};

${typeProperties}

${renderCssProperties(tokens.spacing, "space", (value) => `${value}px`)}
${renderCssProperties(tokens.radius, "radius", (value) => `${value}px`)}
  --size-control: ${tokens.size.control}px;
  --size-control-compact: ${tokens.size.controlCompact}px;
  --size-reading-width: ${tokens.size.readingWidth};
${renderCssProperties(tokens.motion, "motion", (value) => `${value}ms`)}
${renderCssProperties(tokens.profiles.game, "profile-game", (value, name) => `${value}px`)}

  --icon-canvas: ${tokens.icon.canvas}px;
  --icon-square: ${tokens.icon.square}px;
  --icon-inset: ${tokens.icon.inset}px;
  --icon-radius: ${tokens.icon.radius}px;
  --icon-safe-area: ${tokens.icon.safeAreaPercent}%;
  --icon-gradient: linear-gradient(${tokens.icon.gradient.angle}deg, ${gradientStops});
}

:root,
[data-app-stylr-theme="dark"] {
${renderCssTheme(tokens.themes.dark)}
  color-scheme: dark;
}

[data-app-stylr-theme="light"] {
${renderCssTheme(tokens.themes.light)}
  color-scheme: light;
}
`;
}

function renderSwiftColorProperties(properties, indent = "    ") {
  return Object.entries(properties)
    .map(([name, value]) => `${indent}public static let ${name} = ${swiftColor(value)}`)
    .join("\n");
}

function renderSwiftThemeArguments(theme, indent = "      ") {
  return Object.entries(theme)
    .map(([name, value], index, entries) => {
      const suffix = index === entries.length - 1 ? "" : ",";
      return `${indent}${name}: ${swiftColor(value)}${suffix}`;
    })
    .join("\n");
}

export function renderSwift(tokens) {
  const themeFields = Object.keys(tokens.themes.dark)
    .map((name) => `    public let ${name}: Color`)
    .join("\n");

  const typeStyles = Object.entries(tokens.typography.styles)
    .map(
      ([name, style]) => `    public static let ${name} = TypeStyle(
      size: ${style.size},
      lineHeight: ${style.lineHeight},
      weight: ${style.weight},
      letterSpacing: ${style.letterSpacing}
    )`
    )
    .join("\n\n");

  const spacing = Object.entries(tokens.spacing)
    .map(([name, value]) => `    public static let space${name}: CGFloat = ${value}`)
    .join("\n");

  return `// Generated from tokens/app-stylr.json by npm run build. Do not edit.

import SwiftUI

public enum AppStylrTokens {
  public static let version = "${tokens.version}"

  public enum Brand {
${renderSwiftColorProperties(tokens.brand)}
  }

  public struct Theme: Sendable {
${themeFields}
  }

  public static let dark = Theme(
${renderSwiftThemeArguments(tokens.themes.dark)}
  )

  public static let light = Theme(
${renderSwiftThemeArguments(tokens.themes.light)}
  )

  public struct TypeStyle: Sendable {
    public let size: CGFloat
    public let lineHeight: CGFloat
    public let weight: Int
    public let letterSpacing: CGFloat
  }

  public enum Typography {
    public static let sansFamily = "${tokens.typography.families.sans}"
    public static let monoFamily = "${tokens.typography.families.mono}"

${typeStyles}
  }

  public enum Spacing {
${spacing}
  }

  public enum Radius {
    public static let button: CGFloat = ${tokens.radius.button}
    public static let control: CGFloat = ${tokens.radius.control}
    public static let card: CGFloat = ${tokens.radius.card}
    public static let dialog: CGFloat = ${tokens.radius.dialog}
  }

  public enum Size {
    public static let control: CGFloat = ${tokens.size.control}
    public static let controlCompact: CGFloat = ${tokens.size.controlCompact}
    public static let readingWidthCharacters = 68
  }

  public enum Motion {
    public static let controlMilliseconds = ${tokens.motion.control}
    public static let panelMilliseconds = ${tokens.motion.panel}
    public static let syncPulseMilliseconds = ${tokens.motion.syncPulse}
  }

  public enum GameProfile {
${Object.entries(tokens.profiles.game).map(([name, value]) => `    public static let ${name}: CGFloat = ${value}`).join("\n")}
  }

  public enum Icon {
    public static let canvas: CGFloat = ${tokens.icon.canvas}
    public static let square: CGFloat = ${tokens.icon.square}
    public static let inset: CGFloat = ${tokens.icon.inset}
    public static let radius: CGFloat = ${tokens.icon.radius}
    public static let safeAreaPercent: CGFloat = ${tokens.icon.safeAreaPercent}
    public static let gradientAngleDegrees: Double = ${tokens.icon.gradient.angle}
  }
}
`;
}
