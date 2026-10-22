import {mkdtemp, copyFile, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';

// Use the unmodified pinned App Stylr exporter. Only the two favicon sizes ship.
const output = await mkdtemp(join(tmpdir(), 'plannr-icons-'));
try {
  execFileSync(process.execPath, ['vendor/app-stylr/scripts/generate-icons.mjs', '--source', 'assets/app-icon.svg', '--output', output], {stdio: 'pipe'});
  for (const size of [16, 32]) {
    const source = join(output, size === 16 ? 'chrome/icon-16.png' : 'web/favicon-32.png');
    const target = `assets/favicon-${size}.png`;
    if (process.argv.includes('--check')) {
      if (!(await readFile(source)).equals(await readFile(target))) throw Error(`Regenerate ${target} with npm run icons.`);
    } else await copyFile(source, target);
  }
  console.log('Project Plannr 16px and 32px icons match the pinned App Stylr master.');
} finally {await rm(output, {recursive: true, force: true});}
