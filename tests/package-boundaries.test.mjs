import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packagesRoot = fileURLToPath(new URL('../packages/', import.meta.url));
const expected = {
  hasunosora_runtime: ['shader', 'garupa-expression-adapter'],
  garupa_runtime: ['behavior'],
  llas_runtime: ['shader', 'behavior', 'garupa-expression-adapter'],
};

async function files(directory) {
  const result = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await files(file));
    else if (entry.isFile()) result.push(file);
  }
  return result;
}

test('each game has one self-contained runtime manifest', async () => {
  assert.deepEqual((await fs.readdir(packagesRoot)).sort(), Object.keys(expected).sort());
  for (const [name, types] of Object.entries(expected)) {
    const directory = path.join(packagesRoot, name);
    const { components } = JSON.parse(await fs.readFile(path.join(directory, 'config.json'), 'utf8'));
    assert.deepEqual([...new Set(components.map(item => item.type))].sort(), types.sort());
    for (const component of components) {
      for (const field of ['src', 'script']) {
        if (!component[field]) continue;
        const target = path.resolve(directory, component[field]);
        assert.ok(target.startsWith(directory + path.sep), `${name}: ${component[field]} escapes the package`);
        assert.ok((await fs.stat(target)).isFile());
      }
    }
  }
});

test('runtime scripts only import relative files inside their own package', async () => {
  const imports = /(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)["'](\.[^"']+)["']/g;
  for (const name of Object.keys(expected)) {
    const directory = path.join(packagesRoot, name);
    for (const file of await files(directory)) {
      if (!file.endsWith('.js')) continue;
      for (const match of (await fs.readFile(file, 'utf8')).matchAll(imports)) {
        const target = path.resolve(path.dirname(file), match[1]);
        assert.ok(target.startsWith(directory + path.sep), `${file}: ${match[1]} escapes the package`);
        assert.ok((await fs.stat(target)).isFile());
      }
    }
  }
});
