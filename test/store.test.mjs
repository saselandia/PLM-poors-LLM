import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Store } from '../src/core/store.mjs';
import { createProject } from '../src/core/model.mjs';

test('serializa escrituras simultáneas sin perder proyectos y persiste tras reiniciar', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'plm-store-'));
  try {
    const store = new Store(directory);
    await store.load();
    await Promise.all(
      Array.from({ length: 12 }, (_, n) =>
        store.mutate((state) => {
          state.projects.push(createProject({ name: `Proyecto ${n}` }));
          return state;
        }),
      ),
    );
    const restarted = new Store(directory);
    assert.equal((await restarted.load()).projects.length, 12);
    const copy = store.snapshot();
    copy.projects.length = 0;
    assert.equal(store.snapshot().projects.length, 12);
    if (process.platform !== 'win32') assert.equal((await stat(store.file)).mode & 0o777, 0o600);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
test('conserva el archivo corrupto en vez de reemplazarlo por un espacio vacío', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'plm-store-'));
  try {
    const store = new Store(directory);
    await writeFile(store.file, 'datos-corruptos');
    await assert.rejects(store.load(), /Se conserva el archivo original/);
    assert.equal(await readFile(store.file, 'utf8'), 'datos-corruptos');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
test('una actualización inválida no altera el estado guardado y la cola se recupera', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'plm-store-'));
  try {
    const store = new Store(directory);
    await store.load();
    await assert.rejects(store.mutate((state) => ({ ...state, version: 999 })));
    await store.mutate((state) => {
      state.projects.push(createProject({ name: 'Conservado' }));
      return state;
    });
    assert.equal(store.snapshot().projects[0].name, 'Conservado');
    assert.equal(JSON.parse(await readFile(store.file, 'utf8')).version, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
