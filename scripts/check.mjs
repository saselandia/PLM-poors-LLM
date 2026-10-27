import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

async function files(directory) {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...(await files(file)));
    else if (/\.(mjs|cjs|js)$/.test(entry.name)) found.push(file);
  }
  return found;
}
for (const file of [
  ...(await files('src')),
  ...(await files('scripts')),
  ...(await files('test')),
]) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log('Sintaxis correcta.');
