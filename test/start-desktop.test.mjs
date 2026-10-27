import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { startDesktop } from '../src/core/start-desktop.mjs';

test('crear un proceso no es éxito: exige confirmación de interfaz cargada y visible', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'plm-start-'));
  try {
    const fixture = path.join(directory, 'ready.mjs');
    await writeFile(
      fixture,
      `import {writeFile} from 'node:fs/promises'; import path from 'node:path';
      setTimeout(async () => {
        await writeFile(path.join(process.env.PLM_DATA_DIR, 'launch-' + process.env.PLM_LAUNCH_ID + '.json'), JSON.stringify({launchId:process.env.PLM_LAUNCH_ID,pid:process.pid,loaded:true,visible:true}));
      }, 120);`,
    );
    const started = Date.now();
    const result = await startDesktop({ executable: process.execPath, args: [fixture], directory });
    assert.ok(Date.now() - started >= 120);
    assert.ok(Number.isInteger(result.pid));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
test('propaga un fallo de arranque y conserva stderr en un log', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'plm-start-'));
  try {
    await assert.rejects(
      startDesktop({
        executable: process.execPath,
        args: ['-e', "console.error('fallo-simulado');process.exit(9)"],
        directory,
      }),
      /código 9/,
    );
    assert.match(await readFile(path.join(directory, 'startup.log'), 'utf8'), /fallo-simulado/);
    await assert.rejects(
      startDesktop({ executable: path.join(directory, 'missing'), directory }),
      /ENOENT/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
test('un proceso que termina sin ventana no produce un falso éxito', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'plm-start-'));
  try {
    await assert.rejects(
      startDesktop({
        executable: process.execPath,
        args: ['-e', 'process.exit(0)'],
        directory,
        timeout: 300,
      }),
      /no confirmó la carga/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
