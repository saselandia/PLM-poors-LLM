import { spawn } from 'node:child_process';
import { mkdir, open, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

// Development launcher: success means the application has loaded and shown its window.
export async function startDesktop({ executable, args = [], directory, cwd, timeout = 20_000 }) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const launchId = randomUUID();
  const statusFile = path.join(directory, `launch-${launchId}.json`);
  const logFile = path.join(directory, 'startup.log');
  const log = await open(logFile, 'a', 0o600);
  const env = { ...process.env, PLM_DATA_DIR: directory, PLM_LAUNCH_ID: launchId };
  delete env.ELECTRON_RUN_AS_NODE;
  let child;
  try {
    await log.write(`\n${new Date().toISOString()} PLM: inicio solicitado\n`);
    child = spawn(executable, args, {
      cwd,
      env,
      detached: true,
      stdio: ['ignore', log.fd, log.fd],
      shell: false,
    });
    let spawnError;
    let exitCode;
    child.once('error', (error) => {
      spawnError = error;
    });
    child.once('exit', (code) => {
      exitCode = code;
    });
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (spawnError) throw spawnError;
      try {
        const status = JSON.parse(await readFile(statusFile, 'utf8'));
        if (status.launchId === launchId) {
          if (status.error) throw new Error(status.error);
          if (status.visible && status.loaded && Number.isInteger(status.pid)) {
            child.unref();
            return { pid: status.pid, logFile };
          }
        }
      } catch (error) {
        if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
      }
      if (exitCode !== undefined && exitCode !== 0)
        throw new Error(`PLM terminó al arrancar (código ${exitCode}).`);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error('PLM no confirmó la carga de su ventana.');
  } catch (error) {
    child?.unref();
    throw new Error(`${error.message} Revisa ${logFile}`);
  } finally {
    await log.close();
    await unlink(statusFile).catch(() => {});
  }
}
