import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { repoRoot } from "../scripts/token-utils.mjs";

async function fixture(run) {
  const root = await mkdtemp(path.join(os.tmpdir(), "app-stylr-output-"));
  try {
    for (const directory of ["scripts", "tokens", "reference", "adapters", "assets", "styles"]) {
      await cp(path.join(repoRoot, directory), path.join(root, directory), { recursive: true });
    }
    const build = (output) => spawnSync(process.execPath, ["scripts/build-site.mjs", "--output", output], {
      cwd: root, encoding: "utf8", timeout: 10_000
    });
    await run(root, build);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("Reference builds refuse source directories, project roots, metadata, and dependencies", async () => {
  await fixture(async (root, build) => {
    const source = await readFile(path.join(root, "reference", "index.html"), "utf8");
    for (const output of ["reference", "reference/nested", "assets", "scripts", ".", "..", ".git/generated", "node_modules/generated"]) {
      const result = build(output);
      assert.equal(result.status, 1, `${output}: ${result.stderr}`);
    }
    assert.equal(await readFile(path.join(root, "reference", "index.html"), "utf8"), source);
  });
});

test("Reference builds preserve unrelated files in an existing output directory", async () => {
  await fixture(async (root, build) => {
    await mkdir(path.join(root, "existing"));
    await writeFile(path.join(root, "existing", "notes.txt"), "Keep this file.");
    const result = build("existing");
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Choose an empty output directory/);
    assert.equal(await readFile(path.join(root, "existing", "notes.txt"), "utf8"), "Keep this file.");
  });
});

test("Reference builds allow an empty directory and a repeat build, preserving added files", async () => {
  await fixture(async (root, build) => {
    await mkdir(path.join(root, "output"));
    assert.equal(build("output").status, 0);
    assert.equal(build("output").status, 0);
    await writeFile(path.join(root, "output", "assets", "notes.txt"), "Keep this file.");
    const result = build("output");
    assert.equal(result.status, 1);
    assert.match(result.stderr, /outside the generated Reference/);
    assert.equal(await readFile(path.join(root, "output", "assets", "notes.txt"), "utf8"), "Keep this file.");
  });
});

test("Reference builds reject symlinked source targets and symlinks inside previous output", async () => {
  await fixture(async (root, build) => {
    await symlink(path.join(root, "reference"), path.join(root, "source-link"));
    assert.equal(build("source-link").status, 1);
    assert.equal(build("output").status, 0);
    await symlink(path.join(root, "tokens"), path.join(root, "output", "extra"));
    assert.equal(build("output").status, 1);
    assert.ok(await readFile(path.join(root, "tokens", "app-stylr.json")));
  });
});

test("Portable builds include the workbench and canonical tokens beneath the requested host path", async () => {
  await fixture(async (root) => {
    const result = spawnSync(process.execPath, ["scripts/build-site.mjs", "--output", "output", "--canonical-url", "https://example.com/app-stylr", "--base-path", "/app-stylr"], { cwd: root, encoding: "utf8", timeout: 10_000 });
    assert.equal(result.status, 0, result.stderr);
    const html = await readFile(path.join(root, "output", "index.html"), "utf8");
    assert.match(html, /src="\/app-stylr\/workbench.js"/);
    assert.match(html, /href="\/app-stylr\/tokens\/app-stylr.json"/);
    assert.match(html, /id="favicon" rel="icon" href="\/app-stylr\/assets\/app-icon-monochrome-base\.svg\?v=graphite-blank-1"/);
    assert.match(html, /rel="icon" href="\/app-stylr\/assets\/favicon-32\.png\?v=graphite-blank-1"/);
    assert.doesNotMatch(html, /rel="icon"[^>]*example-app-icon/);
    const tokens = JSON.parse(await readFile(path.join(root, "output", "tokens", "app-stylr.json"), "utf8"));
    assert.ok(tokens.accents.ember && tokens.accents.blue);
    await accessFile(path.join(root, "output", "workbench.js"));
  });
});

async function accessFile(file) { assert.ok((await readFile(file)).length > 0); }

test("Root-hosted mirrors keep sharing images beneath the canonical Reference route", async () => {
  await fixture(async root => {
    const result = spawnSync(process.execPath, ["scripts/build-site.mjs", "--output", "mirror", "--canonical-url", "https://example.com/app-stylr", "--base-path", "/"], { cwd: root, encoding: "utf8", timeout: 10_000 });
    assert.equal(result.status, 0, result.stderr);
    const html = await readFile(path.join(root, "mirror", "index.html"), "utf8");
    const socialImage = "https://example.com/app-stylr/assets/platform-icons/reference/web/icon-512.png";
    assert.ok(html.includes(`<meta property="og:image" content="${socialImage}"`));
    assert.ok(html.includes(`<meta name="twitter:image" content="${socialImage}"`));
    assert.match(html, /src="\/workbench.js"/);
    assert.match(html, /href="\/styles.css"/);
    assert.match(html, /rel="canonical" href="https:\/\/example.com\/app-stylr"/);
    assert.match(html, /id="favicon" rel="icon" href="\/assets\/app-icon-monochrome-base\.svg\?v=graphite-blank-1"/);
    assert.match(html, /rel="icon" href="\/assets\/favicon-32\.png\?v=graphite-blank-1"/);
    assert.doesNotMatch(html, /rel="icon"[^>]*example-app-icon/);
  });
});
