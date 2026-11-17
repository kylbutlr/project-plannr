import path from "node:path";
import {
  contrastRatio,
  getPath,
  readJson,
  readTokens,
  resolveTheme,
  repoRoot
} from "./token-utils.mjs";

const errors = [];
const report = [];
const hexPattern = /^#[0-9A-Fa-f]{6}$/;
const requiredThemeRoles = [
  "canvas",
  "sidebar",
  "surface",
  "surfaceRaised",
  "border",
  "borderStrong",
  "text",
  "textMuted",
  "accent",
  "accentText",
  "accentStrong",
  "link",
  "focus",
  "selected",
  "selectedText",
  "success",
  "successSurface",
  "warning",
  "warningSurface",
  "danger",
  "dangerSurface",
  "info",
  "infoSurface"
];

function assert(condition, message) {
  if (!condition) errors.push(message);
}

function validateColorMap(name, colors) {
  assert(colors && typeof colors === "object", `${name} must be an object.`);
  if (!colors || typeof colors !== "object") return;

  for (const [tokenName, value] of Object.entries(colors)) {
    assert(hexPattern.test(value), `${name}.${tokenName} must be a six-digit hex color.`);
  }
}

const tokens = await readTokens();
const packageJson = await readJson(path.join(repoRoot, "package.json"));

assert(tokens.name === "App Stylr", "Token name must be App Stylr.");
assert(tokens.version === packageJson.version, "Token and package versions must match.");
assert(packageJson.private !== true, "The public package must not be marked private.");
assert(packageJson.publishConfig?.access === "public", "The public package must declare public npm access.");

validateColorMap("brand", tokens.brand);
validateColorMap("themes.light", tokens.themes?.light);
validateColorMap("themes.dark", tokens.themes?.dark);

for (const themeName of ["light", "dark"]) {
  const theme = tokens.themes?.[themeName] ?? {};
  for (const role of requiredThemeRoles) {
    assert(role in theme, `themes.${themeName}.${role} is required.`);
  }

  const extraRoles = Object.keys(theme).filter((role) => !requiredThemeRoles.includes(role));
  assert(extraRoles.length === 0, `themes.${themeName} has unknown roles: ${extraRoles.join(", ")}`);
}

for (const [name, value] of Object.entries(tokens.spacing ?? {})) {
  assert(Number(name) === value, `spacing.${name} must equal its pixel value.`);
  assert(value > 0, `spacing.${name} must be positive.`);
}

const accentRoles = ["accent", "accentText", "accentStrong", "link", "focus", "selected", "selectedText", "info", "infoSurface"];
const presetIds = ["mint", ...Object.keys(tokens.accents ?? {})];
assert(JSON.stringify(Object.keys(tokens.accentPresets ?? {}).sort()) === JSON.stringify([...presetIds].sort()), "Every accent must have one display name and description.");
const presetNames = Object.values(tokens.accentPresets ?? {}).map(preset => preset.name);
assert(new Set(presetNames).size === presetNames.length, "Accent display names must be unique.");
for (const [id, preset] of Object.entries(tokens.accentPresets ?? {})) {
  assert(typeof preset.name === "string" && preset.name.trim().length > 0, `${id} must have a display name.`);
  assert(typeof preset.description === "string" && preset.description.trim().length > 0, `${id} must have a description.`);
}
for (const [name, themes] of Object.entries(tokens.accents ?? {})) {
  assert(name !== "mint", "The original mint default must not be replaced by an overlay.");
  assert(/^[a-z][a-z0-9-]*$/.test(name), `Invalid accent name: ${name}.`);
  for (const themeName of ["dark", "light"]) {
    validateColorMap(`accents.${name}.${themeName}`, themes[themeName]);
    assert(Object.keys(themes[themeName] ?? {}).every(role => accentRoles.includes(role)), `Accent ${name} must not replace neutral or success/warning/error roles.`);
  }
}

const neutralRoles = ["canvas", "sidebar", "surface", "surfaceRaised", "border", "borderStrong"];
assert(JSON.stringify(Object.keys(tokens.surfaceTonePresets ?? {})) === JSON.stringify(["lighter", "normal", "darker"]), "Surface tone presets must be Lighter, Normal, and Darker in order.");
assert(JSON.stringify(Object.keys(tokens.surfaceTones ?? {}).sort()) === JSON.stringify(["darker", "lighter"]), "Only Lighter and Darker override the original Normal surfaces.");
for (const [tone, modes] of Object.entries(tokens.surfaceTones ?? {})) {
  for (const mode of ["dark", "light"]) {
    validateColorMap(`surfaceTones.${tone}.${mode}`, modes[mode]);
    assert(JSON.stringify(Object.keys(modes[mode] ?? {}).sort()) === JSON.stringify([...neutralRoles].sort()), `${tone}/${mode} must define exactly the six neutral surface roles.`);
    for (const role of neutralRoles) {
      const originalBrightness = contrastRatio(tokens.themes[mode][role], "#000000");
      const brightness = contrastRatio(modes[mode]?.[role] ?? "#000000", "#000000");
      assert(tone === "lighter" ? brightness >= originalBrightness : brightness <= originalBrightness, `${tone}/${mode}/${role} must follow the named brightness direction.`);
    }
  }
}
for (const [id, preset] of Object.entries(tokens.surfaceTonePresets ?? {})) {
  assert(typeof preset.name === "string" && preset.name.trim().length > 0, `${id} must have a surface-tone display name.`);
  assert(typeof preset.description === "string" && preset.description.trim().length > 0, `${id} must have a surface-tone description.`);
}
for (const accent of presetIds) for (const tone of Object.keys(tokens.surfaceTonePresets ?? {})) for (const mode of ["dark", "light"]) {
  const theme = resolveTheme(tokens, { theme: mode, accent, tone });
  assert(contrastRatio(theme.accentText, theme.accentStrong) >= 4.5, `${accent}/${tone}/${mode} accentStrong action labels must meet 4.5:1.`);
  const resolved = { ...tokens, themes: { ...tokens.themes, [mode]: theme } };
  for (const pair of tokens.accessibility.contrastPairs.filter(pair => pair.foreground.startsWith(`themes.${mode}.`))) {
    const ratio = contrastRatio(getPath(resolved, pair.foreground), getPath(resolved, pair.background));
    assert(ratio >= pair.minimum, `${accent}/${tone} ${pair.name} is ${ratio.toFixed(2)}:1, below ${pair.minimum}:1.`);
  }
  for (const background of ["canvas", "sidebar", "surface", "surfaceRaised"]) {
    for (const foreground of ["text", "textMuted", "link", "success", "warning", "danger", "info", "focus", "borderStrong"]) {
      const minimum = ["focus", "borderStrong"].includes(foreground) ? 3 : 4.5;
      const ratio = contrastRatio(theme[foreground], theme[background]);
      assert(ratio >= minimum, `${accent}/${tone}/${mode} ${foreground} on ${background} is ${ratio.toFixed(2)}:1, below ${minimum}:1.`);
    }
  }
}
validateColorMap("icon", { background: tokens.icon.background, foreground: tokens.icon.foreground });
assert(contrastRatio(tokens.icon.foreground, tokens.icon.background) >= 4.5, "The flat icon glyph must contrast with its tile.");
const monochromeStops = tokens.icon.monochromeGradient.stops;
assert(monochromeStops.length === 2 && monochromeStops[0].offset === 0 && monochromeStops[1].offset === 100, "The monochrome icon gradient must have two endpoint stops.");
assert(tokens.icon.monochromeGradient.angle === 135, "The monochrome icon uses top-left to bottom-right lighting.");
for (const stop of monochromeStops) {
  const channels = stop.color?.match(/^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  assert(channels && channels[1].toLowerCase() === channels[2].toLowerCase() && channels[2].toLowerCase() === channels[3].toLowerCase(), "Monochrome icon stops must remain neutral grays.");
  assert(contrastRatio(tokens.icon.foreground, stop.color) >= 4.5, "The icon glyph must contrast with every monochrome gradient stop.");
}

for (const [name, value] of Object.entries(tokens.radius ?? {})) {
  assert(value > 0, `radius.${name} must be positive.`);
}

for (const [name, value] of Object.entries(tokens.motion ?? {})) {
  assert(Number.isInteger(value) && value > 0, `motion.${name} must be a positive integer in milliseconds.`);
}

for (const [name, style] of Object.entries(tokens.typography?.styles ?? {})) {
  assert(style.size > 0, `typography.styles.${name}.size must be positive.`);
  assert(style.lineHeight >= style.size, `typography.styles.${name}.lineHeight must not be below its size.`);
  assert(style.weight >= 100 && style.weight <= 900, `typography.styles.${name}.weight must be between 100 and 900.`);
}

const gameProfile = tokens.profiles?.game ?? {};
assert(gameProfile.minimumViewportWidth >= 1024, "profiles.game.minimumViewportWidth must support at least 1024px desktop layouts.");
assert(gameProfile.controlHeight >= tokens.size.control, "profiles.game.controlHeight must not be smaller than the standard control.");
assert(gameProfile.primaryControlHeight > gameProfile.controlHeight, "profiles.game.primaryControlHeight must be larger than the standard game control.");
assert(gameProfile.readingLineHeight >= gameProfile.readingTextSize, "profiles.game reading line height must not be below its text size.");
assert(gameProfile.labelLineHeight >= gameProfile.labelTextSize, "profiles.game label line height must not be below its text size.");
assert(gameProfile.disclosureSummaryHeight >= gameProfile.primaryControlHeight, "profiles.game disclosures must be at least as tall as primary controls.");
assert(gameProfile.disclosureToggleSize >= 32, "profiles.game disclosure toggles must remain visibly actionable.");

assert(
  tokens.icon.square + tokens.icon.inset * 2 === tokens.icon.canvas,
  "The icon square and insets must exactly fill the icon canvas."
);

const gradientStops = tokens.icon.gradient.stops;
assert(gradientStops[0]?.offset === 0, "The icon gradient must begin at 0%.");
assert(gradientStops.at(-1)?.offset === 100, "The icon gradient must end at 100%.");
for (let index = 1; index < gradientStops.length; index += 1) {
  assert(
    gradientStops[index - 1].offset < gradientStops[index].offset,
    "Icon gradient offsets must be strictly increasing."
  );
}

assert(gradientStops[0]?.color === "#0D0D0D", "The icon gradient must begin with Evening charcoal.");
assert(gradientStops[1]?.offset === 48 && gradientStops[1]?.color === "#3B4145", "The icon gradient midpoint must use Evening slate at 48%.");
assert(gradientStops.at(-1)?.color === "#899F98", "The icon gradient must end with Evening mint.");

for (const pair of tokens.accessibility?.contrastPairs ?? []) {
  const foreground = getPath(tokens, pair.foreground);
  const background = getPath(tokens, pair.background);
  assert(hexPattern.test(foreground ?? ""), `${pair.name} has an invalid foreground reference.`);
  assert(hexPattern.test(background ?? ""), `${pair.name} has an invalid background reference.`);
  if (!hexPattern.test(foreground ?? "") || !hexPattern.test(background ?? "")) continue;

  const ratio = contrastRatio(foreground, background);
  assert(ratio >= pair.minimum, `${pair.name} is ${ratio.toFixed(2)}:1, below ${pair.minimum}:1.`);
  report.push(`${pair.name}: ${ratio.toFixed(2)}:1`);
}

if (errors.length > 0) {
  console.error("App Stylr token validation failed:\n");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Validated App Stylr ${tokens.version}.`);
  for (const line of report) console.log(`- ${line}`);
}
