import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

test('publish build is a whitelist and refuses unexpected leftover files', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'plannr-build-'));
  t.after(() => rm(directory, {recursive: true, force: true}));
  await mkdir(join(directory, 'vendor/app-stylr/adapters/css'), {recursive: true});
  await mkdir(join(directory, 'vendor/app-stylr/assets/fonts'), {recursive: true});
  await mkdir(join(directory, 'assets'), {recursive: true});
  const sources = ['prototype.html', 'board.js', 'board-client.js', 'ticket-priority.js', 'ticket-checklist.js', 'board.css', 'vendor/app-stylr/adapters/css/app-stylr.css', 'vendor/app-stylr/assets/fonts/Geist-Variable.woff2', 'assets/app-icon.svg', 'assets/favicon-16.png', 'assets/favicon-32.png'];
  for (const source of sources) await writeFile(join(directory, source), 'public fixture');
  for (const secret of ['.env', 'server.mjs', 'workspace.json']) await writeFile(join(directory, secret), 'PRIVATE-FIXTURE');
  const script = fileURLToPath(new URL('../scripts/build.mjs', import.meta.url)), run = promisify(execFile);
  await run(process.execPath, [script], {cwd: directory});
  const published = await readdir(join(directory, 'dist'));
  assert.deepEqual(published.sort(), ['board.css', 'board.js', 'board-client.js', 'ticket-priority.js', 'ticket-checklist.js', 'index.html', 'prototype.html', 'sans.woff2', 'tokens.css', 'app-icon.svg', 'favicon-16.png', 'favicon-32.png'].sort());
  for (const file of published) assert.doesNotMatch(await readFile(join(directory, 'dist', file), 'utf8'), /PRIVATE-FIXTURE/);
  // Netlify adds its resolved configuration to published artifacts, then restores
  // it with dist on the next cached build. It is not an application asset.
  await writeFile(join(directory, 'dist/netlify.toml'), 'GENERATED-HOST-CONFIG');
  await assert.rejects(run(process.execPath, [script], {cwd: directory, env: {...process.env, NETLIFY: 'false'}}), /Unexpected publish files/);
  await run(process.execPath, [script], {cwd: directory, env: {...process.env, NETLIFY: 'true'}});
  assert.deepEqual((await readdir(join(directory, 'dist'))).sort(), published.sort());
  await run(process.execPath, [script], {cwd: directory, env: {...process.env, NETLIFY: 'true'}});
  await writeFile(join(directory, 'dist/unexpected.json'), 'PRIVATE-FIXTURE');
  await writeFile(join(directory, 'dist/netlify.toml'), 'GENERATED-HOST-CONFIG');
  await assert.rejects(run(process.execPath, [script], {cwd: directory, env: {...process.env, NETLIFY: 'true'}}), /Unexpected publish files/);
  assert.equal(await readFile(join(directory, 'dist/unexpected.json'), 'utf8'), 'PRIVATE-FIXTURE');
  assert.equal(await readFile(join(directory, 'dist/netlify.toml'), 'utf8'), 'GENERATED-HOST-CONFIG');
});
