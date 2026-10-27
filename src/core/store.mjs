import { mkdir, open, readFile, rename, unlink, stat } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { emptyState, validateState, MAX_BYTES } from './model.mjs';

export class Store {
  #state;
  #queue = Promise.resolve();
  constructor(directory) {
    this.directory = directory;
    this.file = path.join(directory, 'workspace.json');
  }
  async load() {
    try {
      const info = await stat(this.file);
      if (info.size > MAX_BYTES) throw new Error('El archivo local supera 8 MB.');
      this.#state = validateState(JSON.parse(await readFile(this.file, 'utf8')));
    } catch (error) {
      if (error.code !== 'ENOENT')
        throw new Error(
          `No se ha podido leer el espacio de trabajo. Se conserva el archivo original. ${error.message}`,
        );
      this.#state = emptyState();
    }
    return this.snapshot();
  }
  snapshot() {
    return structuredClone(this.#state);
  }
  mutate(update) {
    const operation = this.#queue.then(async () => {
      const next = validateState(await update(this.snapshot()));
      const contents = JSON.stringify(next, null, 2);
      if (Buffer.byteLength(contents) > MAX_BYTES)
        throw new Error(
          'El espacio supera 8 MB. Exporta y elimina proyectos antiguos antes de continuar.',
        );
      await mkdir(this.directory, { recursive: true, mode: 0o700 });
      const temporary = `${this.file}.${randomUUID()}.tmp`;
      try {
        const handle = await open(temporary, 'wx', 0o600);
        try {
          await handle.writeFile(contents);
          await handle.sync();
        } finally {
          await handle.close();
        }
        await rename(temporary, this.file);
        this.#state = next;
      } finally {
        await unlink(temporary).catch(() => {});
      }
      return this.snapshot();
    });
    this.#queue = operation.catch(() => {});
    return operation;
  }
}
