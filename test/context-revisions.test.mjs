import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createProject,
  addMessage,
  reviseContext,
  restoreContext,
  validateProject,
  buildHandoff,
  importProject,
  exportProject,
} from '../src/core/model.mjs';

test('actualizar contexto conserva identidad, carpeta, instrucciones y mensajes; guarda la versión anterior', () => {
  let project = addMessage(
    createProject({ name: 'Trabajo', goal: 'Usar Git', folder: '/trabajo' }),
    { role: 'user', provider: 'codex', content: 'Mensaje previo' },
  );
  project = reviseContext(project, { importedContext: '# Resumen A' });
  const updated = reviseContext(project, {
    importedContext: '# Resumen B',
    preferredModel: 'sonnet',
  });
  assert.equal(updated.id, project.id);
  assert.equal(updated.folder, '/trabajo');
  assert.equal(updated.goal, 'Usar Git');
  assert.deepEqual(updated.messages, project.messages);
  assert.equal(updated.contextRevisions.at(-1).importedContext, '# Resumen A');
  const handoff = buildHandoff(updated, 'claude');
  assert.match(handoff, /Resumen B/);
  assert.ok(!handoff.includes('Resumen A'), 'El traspaso solo debe incluir el contexto vigente.');
  const restored = restoreContext(updated, updated.contextRevisions.at(-1).id);
  assert.equal(restored.importedContext, '# Resumen A');
  assert.equal(restored.contextRevisions.at(-1).importedContext, '# Resumen B');
  assert.deepEqual(restored.messages, project.messages);
});

test('mantiene diez versiones, permite recuperar y no crea copias por cambios de nombre o guardados idénticos', () => {
  let project = createProject({ name: 'Prueba' });
  for (let i = 0; i < 15; i++) project = reviseContext(project, { decisions: `Decisión ${i}` });
  assert.equal(project.contextRevisions.length, 10);
  assert.equal(project.contextRevisions[0].decisions, 'Decisión 4');
  const renamed = reviseContext(project, { name: 'Otro nombre' });
  assert.deepEqual(renamed.contextRevisions, project.contextRevisions);
  assert.deepEqual(
    reviseContext(renamed, { decisions: 'Decisión 14' }).contextRevisions,
    project.contextRevisions,
  );
  assert.throws(() => restoreContext(project, 'no-existe'), /No se ha encontrado/);
});

test('copias JSON y esquemas antiguos conservan revisiones válidas sin heredar permisos de carpeta', () => {
  let project = createProject({ name: 'Prueba', goal: 'Original', folder: '/privado' });
  project = reviseContext(project, { goal: 'Nuevo' });
  const portable = importProject(JSON.stringify(exportProject(project)));
  assert.deepEqual(portable.contextRevisions, project.contextRevisions);
  assert.equal(portable.folder, '');
  const { contextRevisions, ...legacy } = project;
  assert.deepEqual(validateProject(legacy).contextRevisions, []);
  assert.throws(
    () =>
      validateProject({
        ...project,
        contextRevisions: [{ ...contextRevisions[0], importedContext: 'x\n'.repeat(501) }],
      }),
    /501 líneas/,
  );
  assert.throws(
    () =>
      validateProject({ ...project, contextRevisions: [contextRevisions[0], contextRevisions[0]] }),
    /duplicadas/,
  );
});
