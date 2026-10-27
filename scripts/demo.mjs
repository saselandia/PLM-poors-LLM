import './create-sandbox.mjs';
import { Store } from '../src/core/store.mjs';
import { createProject, addMessage } from '../src/core/model.mjs';
import { access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import electronPath from 'electron';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = path.join(root, 'sandbox', 'demo-profile');
const store = new Store(directory);
await store.load();
if (!store.snapshot().projects.length) {
  let project = createProject({
    name: 'PLM — poors LLM',
    goal: 'Probar la continuidad de una tarea entre aplicaciones conservando el contexto.',
    folder: path.join(root, 'sandbox', 'PLM- poors LLM'),
  });
  project.decisions = 'Mantener las aplicaciones originales y usar traspasos manuales de contexto.';
  project.nextSteps =
    'Abrir el repositorio de pruebas en una herramienta, revisar hello.mjs y registrar el resultado en PLM.';
  project = addMessage(project, {
    role: 'note',
    provider: 'codex',
    content:
      'Proyecto de ejemplo. La carpeta contiene un saludo y su prueba; aún no se ha enviado ningún mensaje a otros modelos.',
  });
  await store.mutate((state) => {
    state.projects.push(project);
    return state;
  });
}
const binary = path.join(
  root,
  'dist',
  `PLM-${process.platform}-${process.arch}`,
  process.platform === 'win32' ? 'plm.exe' : 'plm',
);
let executable = electronPath,
  args = [root];
if (process.platform !== 'darwin') {
  try {
    await access(binary);
    executable = binary;
    args = [];
  } catch {
    /* Use development Electron until a package exists. */
  }
}
const env = { ...process.env, PLM_DATA_DIR: directory };
delete env.ELECTRON_RUN_AS_NODE;
await new Promise((resolve, reject) => {
  const child = spawn(executable, args, {
    cwd: root,
    env,
    detached: true,
    stdio: 'ignore',
    shell: false,
  });
  child.once('error', reject);
  child.once('spawn', () => {
    child.unref();
    resolve();
  });
});
console.log(`PLM iniciado con un perfil de demostración: ${directory}`);
