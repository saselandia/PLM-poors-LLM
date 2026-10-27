import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createProject,
  addMessage,
  buildHandoff,
  exportProject,
  importProject,
  validateState,
  emptyState,
  providerId,
} from '../src/core/model.mjs';

test('el traspaso conserva roles y orden, sin compartir la ruta local por defecto', () => {
  let project = createProject({
    name: 'Prueba',
    goal: 'Continuar la tarea',
    folder: '/home/private/cliente',
  });
  project = addMessage(project, { role: 'user', provider: 'codex', content: 'Primera pregunta' });
  project = addMessage(project, {
    role: 'assistant',
    provider: 'claude',
    content: 'Decisión ya tomada',
  });
  const output = buildHandoff(project, 'antigravity');
  assert.ok(output.indexOf('Primera pregunta') < output.indexOf('Decisión ya tomada'));
  assert.match(output, /### Usuario/);
  assert.match(output, /### Claude/);
  assert.ok(!output.includes('/home/private'));
  assert.ok(
    buildHandoff(project, 'codex', { includeHistory: false, includeFolder: true }).includes(
      '/home/private/cliente',
    ),
  );
  assert.ok(
    !buildHandoff(project, 'codex', { includeHistory: false }).includes('Primera pregunta'),
  );
});
test('exportar e importar no hereda permisos sobre archivos ni configuración de lanzadores', () => {
  const project = createProject({ name: 'Cliente', folder: '/secret/local/path' });
  const exported = exportProject(project);
  assert.equal(exported.project.folder, '');
  exported.project.folder = '/attacker/suggested/path';
  exported.project.untrustedCommand = 'malicious-command';
  const imported = importProject(JSON.stringify(exported));
  assert.equal(imported.folder, '');
  assert.notEqual(imported.id, project.id);
  assert.equal(imported.untrustedCommand, undefined);
  assert.equal(imported.name, project.name);
});
test('rechaza versiones, proveedores heredados del prototipo, roles y mensajes corruptos', () => {
  assert.throws(() => providerId('__proto__'));
  assert.throws(() => providerId('constructor'));
  assert.throws(() => importProject('{"format":"plm-project","version":99}'));
  assert.throws(() =>
    addMessage(createProject({ name: 'a' }), { role: 'system', provider: 'claude', content: 'b' }),
  );
  const project = addMessage(createProject({ name: 'a' }), {
    role: 'user',
    provider: 'codex',
    content: 'b',
  });
  assert.throws(() =>
    validateState({
      ...emptyState(),
      projects: [{ ...project, messages: [...project.messages, ...project.messages] }],
    }),
  );
  assert.throws(() => createProject({ name: 'a\0b' }));
});
test('limita las entradas e impide importar una exportación sobredimensionada', () => {
  assert.throws(() =>
    addMessage(createProject({ name: 'a' }), {
      role: 'user',
      provider: 'codex',
      content: 'x'.repeat(100001),
    }),
  );
  assert.throws(() => importProject(' '.repeat(8 * 1024 * 1024 + 1)));
});
