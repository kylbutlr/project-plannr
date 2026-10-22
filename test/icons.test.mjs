import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('self-contained square icon and 16px/32px fallbacks are declared and opaque artwork retains transparent space', async () => {
  const svg = await readFile(new URL('../assets/app-icon.svg', import.meta.url), 'utf8');
  assert.match(svg, /viewBox="0 0 1024 1024"/);
  assert.match(svg, /x="92" y="92" width="840" height="840" rx="190"/);
  assert.doesNotMatch(svg, /<text\b|<image\b|<script\b|(?:href|src)=/);
  const html = await readFile(new URL('../prototype.html', import.meta.url), 'utf8');
  for (const size of [16, 32]) {
    const png = await readFile(new URL(`../assets/favicon-${size}.png`, import.meta.url));
    assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(png.readUInt32BE(16), size); assert.equal(png.readUInt32BE(20), size);
    assert.ok(html.includes(`/favicon-${size}.png?v=plannr-3`));
  }
  assert.ok(html.includes('/app-icon.svg?v=plannr-3'));
});

test('planning glyph has a first column halfway between the short middle and long last column', async () => {
  const svg = await readFile(new URL('../assets/app-icon.svg', import.meta.url), 'utf8');
  const columns = [...svg.matchAll(/<rect x="(252|444|636)" y="(\d+)" width="136" height="(\d+)" rx="36"/g)];
  assert.deepEqual(columns.map(([, x, y, height]) => [Number(x), Number(y), Number(height)]),
    [[252, 290, 324], [444, 290, 204], [636, 290, 444]]);
});
