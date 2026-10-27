import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CONTEXT_REQUEST,
  contextText,
  MODELS,
  MODEL_TIERS,
  DEFAULT_MODEL,
  modelById,
} from '../src/shared/context.js';
import {
  createProject,
  validateProject,
  buildHandoff,
  exportProject,
  importProject,
} from '../src/core/model.mjs';

test('admite 500 líneas con salto final y CRLF; rechaza 501 sin truncar', () => {
  const raw = Array.from({ length: 500 }, (_, index) => `Línea ${index + 1}`).join('\r\n') + '\r\n';
  const result = contextText('\uFEFF' + raw);
  assert.equal(result.lines, 500);
  assert.ok(result.content.includes('Línea 500'));
  assert.throws(() => contextText(result.content + 'Línea 501'), /501 líneas/);
  assert.throws(() => contextText('  \n '), /vacío/);
  assert.throws(() => contextText('dato\0binario'));
});
test('el catálogo ordena los cuatro niveles y recomienda Mid con los modelos pedidos', () => {
  assert.deepEqual(
    MODEL_TIERS.map((t) => t.id),
    ['low', 'mid', 'high', 'frontier'],
  );
  assert.equal(modelById(DEFAULT_MODEL).tier, 'mid');
  assert.deepEqual(
    MODELS.filter((m) => m.tier === 'mid').map((m) => m.id),
    ['terra', 'flash', 'haiku', 'sonnet'],
  );
  assert.throws(() => modelById('__proto__'));
  assert.match(CONTEXT_REQUEST, /plm.md/);
  assert.match(CONTEXT_REQUEST, /máximo de 500 líneas/);
});
test('el contexto importado y el modelo persisten, se exportan y llegan al siguiente agente', () => {
  const project = validateProject({
    ...createProject({ name: 'Conversación' }),
    importedContext: '# Estado\nDecisión importante.\n',
    preferredModel: 'flash',
  });
  const restored = importProject(JSON.stringify(exportProject(project)));
  assert.equal(restored.importedContext, project.importedContext);
  assert.equal(restored.preferredModel, 'flash');
  const handoff = buildHandoff(restored, 'antigravity', { includeHistory: false });
  assert.match(handoff, /Decisión importante/);
  assert.match(handoff, /Gemini Flash/);
  assert.throws(() => validateProject({ ...project, preferredModel: 'unknown' }));
  const { importedContext, preferredModel, ...legacy } = project;
  assert.equal(validateProject(legacy).importedContext, '');
  assert.equal(validateProject(legacy).preferredModel, 'terra');
});
