import {copyFile, mkdir, readdir, unlink} from 'node:fs/promises';

// A whitelist, never the repository root. Secrets and backend source cannot publish.
const files = new Map([
  ['index.html', 'prototype.html'], ['prototype.html', 'prototype.html'],
  ['workspace-preferences.js', 'workspace-preferences.js'], ['controls.css', 'vendor/app-stylr/styles/controls.css'], ['board.js', 'board.js'], ['board-client.js', 'board-client.js'], ['board.css', 'board.css'],
  ['ticket-priority.js', 'ticket-priority.js'], ['ticket-checklist.js', 'ticket-checklist.js'],
  ['tokens.css', 'vendor/app-stylr/adapters/css/app-stylr.css'],
  ['sans.woff2', 'vendor/app-stylr/assets/fonts/Geist-Variable.woff2'],
  ['app-icon.svg', 'assets/app-icon.svg'], ['favicon-16.png', 'assets/favicon-16.png'], ['favicon-32.png', 'assets/favicon-32.png'],
]);
await mkdir('dist', {recursive: true});
// Netlify restores its generated config with dist on subsequent hosted builds.
// Remove only that reserved host artifact, never publish it or relax the guard.
const cachedHostConfig = process.env.NETLIFY === 'true' ? 'netlify.toml' : null;
const entries = await readdir('dist');
const unexpected = entries.filter(file => !files.has(file) && file !== cachedHostConfig);
if (unexpected.length) throw Error('Unexpected publish files. Inspect dist before building; no files were deleted.');
if (cachedHostConfig && entries.includes(cachedHostConfig)) await unlink(`dist/${cachedHostConfig}`);
for (const [target, source] of files) await copyFile(source, `dist/${target}`);
console.log(`Built ${files.size} public assets. No environment files or backend code published.`);
