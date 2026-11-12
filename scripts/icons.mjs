import {mkdtemp, copyFile, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';

// Use the unmodified pinned App Stylr exporter for small and high-resolution assets.
const output = await mkdtemp(join(tmpdir(), 'plannr-icons-'));
try {
  execFileSync(process.execPath, ['vendor/app-stylr/scripts/generate-icons.mjs', '--source', 'assets/app-icon.svg', '--output', output], {stdio: 'pipe'});
  for (const size of [16, 32, 128, 512]) {
    const source = join(output, size === 512 ? 'web/icon-512.png' : `chrome/icon-${size}.png`);
    const target = size <= 32 ? `assets/favicon-${size}.png` : `assets/app-icon-${size}.png`;
    if (process.argv.includes('--check')) {
      if (!(await readFile(source)).equals(await readFile(target))) throw Error(`Regenerate ${target} with npm run icons.`);
    } else await copyFile(source, target);
  }
  console.log('Project Plannr small and high-resolution icons match the pinned App Stylr master.');
} finally {await rm(output, {recursive: true, force: true});}
