import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile, access } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { repoRoot } from "../scripts/token-utils.mjs";

const square = (color, width = 16, height = width) => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="${color}"/></svg>`;

test("The Reference favicon is a blank neutral tile while example exports retain their glyph", async () => {
  const result = spawnSync(process.execPath, ["scripts/generate-icons.mjs", "--check"], { cwd: repoRoot, encoding: "utf8", timeout: 20_000 });
  assert.equal(result.status, 0, result.stderr);
  const base = await readFile(path.join(repoRoot, "assets", "app-icon-monochrome-base.svg"), "utf8");
  assert.doesNotMatch(base, /<(?:path|circle|ellipse|polygon|polyline|text|line)\b/);
  const pixels = await sharp(path.join(repoRoot, "assets", "favicon-32.png")).ensureAlpha().raw().toBuffer();
  for (let index = 0; index < pixels.length; index += 4) {
    if (!pixels[index + 3]) continue;
    assert.equal(pixels[index], pixels[index + 1]);
    assert.equal(pixels[index + 1], pixels[index + 2]);
    assert.ok(pixels[index] <= 56, "The Reference favicon must not contain a light foreground glyph.");
  }
  const example = await sharp(path.join(repoRoot, "assets", "platform-icons", "reference", "chrome", "icon-16.png")).removeAlpha().raw().toBuffer();
  assert.ok(example.some(value => value > 200), "The separate example still demonstrates a light glyph.");
});

test("A dedicated 16px source only replaces the 16px export and participates in stale checks", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "app-stylr-small-icon-"));
  try {
    const main = path.join(root, "main.svg"), small = path.join(root, "small.svg"), output = path.join(root, "output");
    await writeFile(main, square("#FF0000", 64));
    await writeFile(small, square("#0000FF"));
    const args = ["scripts/generate-icons.mjs", "--source", main, "--source-16", small, "--output", output];
    const run = extra => spawnSync(process.execPath, [...args, ...extra], { cwd: repoRoot, encoding: "utf8", timeout: 20_000 });
    assert.equal(run([]).status, 0);
    for (const [size, color] of [[16, [0, 0, 255]], [32, [255, 0, 0]]]) {
      const image = await sharp(await readFile(path.join(output, "chrome", `icon-${size}.png`))).removeAlpha().raw().toBuffer();
      assert.deepEqual([...image.subarray(0, 3)], color);
    }
    assert.equal(run(["--check"]).status, 0);
    await writeFile(small, square("#00FF00"));
    const stale = run(["--check"]);
    assert.equal(stale.status, 1);
    assert.match(stale.stderr, /chrome\/icon-16.png/);
    assert.doesNotMatch(stale.stderr, /chrome\/icon-32.png/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("An invalid compact source is rejected before creating output", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "app-stylr-invalid-small-"));
  try {
    const main = path.join(root, "main.svg"), small = path.join(root, "small.svg"), output = path.join(root, "output");
    await writeFile(main, square("#111111"));
    await writeFile(small, square("#111111", 16, 12));
    const result = spawnSync(process.execPath, ["scripts/generate-icons.mjs", "--source", main, "--source-16", small, "--output", output], { cwd: repoRoot, encoding: "utf8", timeout: 20_000 });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /16px source icon/);
    await assert.rejects(access(output));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("SVG masters without a viewBox retain their coordinate system when exported", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "app-stylr-svg-viewport-"));
  try {
    const source = path.join(root, "icon.svg"), output = path.join(root, "output");
    await writeFile(source, '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><circle cx="32" cy="32" r="12" fill="#FF0000"/></svg>');
    const result = spawnSync(process.execPath, ["scripts/generate-icons.mjs", "--source", source, "--output", output], { cwd: repoRoot, encoding: "utf8", timeout: 20_000 });
    assert.equal(result.status, 0, result.stderr);
    const pixels = await sharp(path.join(output, "chrome", "icon-16.png")).ensureAlpha().raw().toBuffer();
    assert.equal(pixels[3], 0);
    const center = (8 * 16 + 8) * 4;
    assert.deepEqual([...pixels.subarray(center, center + 4)], [255, 0, 0, 255]);
  } finally { await rm(root, { recursive: true, force: true }); }
});
