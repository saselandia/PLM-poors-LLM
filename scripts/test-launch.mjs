import electronPath from 'electron';
import { startDesktop } from '../src/core/start-desktop.mjs';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';

const directory = await mkdtemp(path.join(tmpdir(), 'plm-real-launch-'));
let pid;
try {
  const options = {
    executable: process.env.PLM_EXECUTABLE || electronPath,
    args: process.env.PLM_EXECUTABLE ? [] : [path.resolve('.')],
    directory,
    cwd: path.resolve('.'),
  };
  const first = await startDesktop(options);
  pid = first.pid;
  const second = await startDesktop(options);
  assert.equal(second.pid, first.pid, 'Reabrir debe presentar la instancia existente.');
  console.log(
    `Arranque sin depurador: interfaz cargada, ventana visible y segunda apertura correctos (PID ${pid}).`,
  );
} finally {
  if (pid) {
    try {
      process.kill(pid, 'SIGTERM');
    } catch (error) {
      if (error.code !== 'ESRCH') throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  await rm(directory, { recursive: true, force: true });
}
