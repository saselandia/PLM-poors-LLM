import { mkdir, writeFile, access, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = path.join(root, 'sandbox', 'PLM- poors LLM');
await mkdir(directory, { recursive: true });
try {
  await access(path.join(directory, '.git'));
  console.log(`Repositorio de pruebas existente: ${directory}`);
} catch {
  if ((await readdir(directory)).length) {
    throw new Error(
      `La carpeta de pruebas ya contiene archivos sin un repositorio Git: ${directory}. Se conserva sin cambios.`,
    );
  }
  for (const args of [
    ['init', '-b', 'main', directory],
    ['-C', directory, 'config', 'user.name', 'PLM Test'],
    ['-C', directory, 'config', 'user.email', 'plm-test@example.invalid'],
  ]) {
    const result = spawnSync('git', args, { encoding: 'utf8', shell: false });
    if (result.status !== 0)
      throw new Error(result.stderr || 'No se ha podido crear el repositorio.');
  }
  await writeFile(
    path.join(directory, 'README.md'),
    '# PLM — poors LLM\n\nRepositorio local de pruebas de continuidad entre aplicaciones.\n\nObjetivo: modificar el saludo y registrar la decisión en PLM.\n\nEjecutar la prueba: `node --test hello.test.mjs`\n\nNo contiene credenciales ni conversaciones personales. No tiene remoto.\n',
    { flag: 'wx' },
  );
  await writeFile(
    path.join(directory, 'hello.mjs'),
    "export function hello(name = 'PLM') { return `Hola, ${name}.`; }\n",
    { flag: 'wx' },
  );
  await writeFile(
    path.join(directory, 'hello.test.mjs'),
    "import { test } from 'node:test';\nimport assert from 'node:assert/strict';\nimport { hello } from './hello.mjs';\ntest('saludo de prueba', () => assert.equal(hello(), 'Hola, PLM.'));\n",
    { flag: 'wx' },
  );
  for (const args of [
    ['-C', directory, 'add', '.'],
    ['-C', directory, 'commit', '-m', 'Initial PLM handoff fixture'],
  ]) {
    const result = spawnSync('git', args, { encoding: 'utf8', shell: false });
    if (result.status !== 0)
      throw new Error(result.stderr || 'No se ha podido guardar el repositorio.');
  }
  console.log(`Repositorio de pruebas creado: ${directory}`);
}
