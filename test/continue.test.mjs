import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copyAndOpen } from '../src/core/continue.mjs';

test('copia el contexto y registra la copia antes de iniciar la aplicación, sin pasarle el prompt', async () => {
  const calls = [];
  const result = await copyAndOpen({
    content: '# Proyecto',
    copy: (value) => calls.push(['copy', value]),
    record: () => calls.push(['record']),
    launch: (...args) => calls.push(['launch', ...args]),
  });
  assert.deepEqual(calls, [['copy', '# Proyecto'], ['record'], ['launch']]);
  assert.equal(result.started, true);
  assert.equal(result.copied, true);
});
test('si falla el portapapeles no abre la aplicación; si falla la apertura conserva y comunica la copia', async () => {
  let launched = false;
  await assert.rejects(
    () =>
      copyAndOpen({
        content: 'texto',
        copy: () => {
          throw new Error('Sin portapapeles');
        },
        record: () => {},
        launch: () => {
          launched = true;
        },
      }),
    /portapapeles/,
  );
  assert.equal(launched, false);
  const result = await copyAndOpen({
    content: 'texto',
    copy: () => {},
    record: () => {},
    launch: () => {
      throw new Error('No se pudo iniciar');
    },
  });
  assert.equal(result.copied, true);
  assert.equal(result.started, false);
  assert.match(result.error, /No se pudo iniciar/);
});
test('un fallo al guardar el historial no oculta la copia ni bloquea la apertura', async () => {
  let launched = false;
  const result = await copyAndOpen({
    content: 'texto',
    copy: () => {},
    record: () => {
      throw new Error('Disco lleno');
    },
    launch: () => {
      launched = true;
    },
  });
  assert.equal(launched, true);
  assert.equal(result.started, true);
  assert.match(result.recordError, /Disco lleno/);
});
