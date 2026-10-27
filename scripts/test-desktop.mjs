import { _electron as electron } from 'playwright';
import electronPath from 'electron';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const directory = await mkdtemp(path.join(tmpdir(), 'plm-desktop-'));
const output = path.resolve('test-results');
await mkdir(output, { recursive: true });
const env = { ...process.env, PLM_DATA_DIR: directory };
delete env.ELECTRON_RUN_AS_NODE;
let desktop;
const rendererErrors = [];
async function start() {
  desktop = await electron.launch({
    executablePath: process.env.PLM_EXECUTABLE || electronPath,
    args: process.env.PLM_EXECUTABLE ? [] : ['.'],
    env,
    timeout: 30_000,
  });
  await desktop.evaluate(({ clipboard }) => {
    let content = '';
    clipboard.writeText = (value) => {
      content = value;
    };
    clipboard.readText = () => content;
  });
  const page = await desktop.firstWindow();
  await page.setViewportSize({ width: 1440, height: 950 });
  page.on('pageerror', (error) => rendererErrors.push(error.message));
  await page.getByRole('button', { name: 'Nuevo proyecto', exact: false }).waitFor();
  assert.equal(
    await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible()),
    true,
  );
  return page;
}
async function showHandoff(page) {
  if (!(await page.locator('#handoff-panel').count()))
    await page.getByRole('button', { name: 'Preparar contexto', exact: true }).click();
}
try {
  let page = await start();
  await page.getByRole('button', { name: 'Crear mi primer proyecto' }).click();
  await page.getByRole('textbox', { name: 'Nombre', exact: true }).fill('PLM — poors LLM');
  await page
    .locator('#project-dialog')
    .getByRole('textbox', { name: 'Contexto duro', exact: true })
    .fill('Continuar la misma tarea entre Codex, Claude y Antigravity.');
  assert.equal(await page.getByRole('radio', { name: 'Solo una conversación' }).isChecked(), true);
  assert.equal(await page.locator('#project-folder-selection').isVisible(), false);
  assert.equal(
    await page
      .locator('#project-dialog')
      .getByRole('textbox', { name: 'Contexto duro', exact: true })
      .getAttribute('placeholder'),
    'ejemplos: En cada mensaje de esta conversacion se usara git para especificar que se ha hecho en cada prompt.',
  );
  await page.getByRole('radio', { name: 'Carpeta con esta conversación' }).check();
  await page.getByRole('button', { name: 'Crear proyecto', exact: false }).click();
  await page.getByRole('status').filter({ hasText: 'Elige una carpeta' }).waitFor();
  assert.equal((await page.evaluate(() => window.plm.workspace())).projects.length, 0);
  await desktop.evaluate(({ dialog }, folder) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [folder] });
  }, path.resolve('sandbox/PLM- poors LLM'));
  await page.getByRole('button', { name: 'Elegir carpeta' }).click();
  await page.getByRole('button', { name: 'Crear proyecto', exact: false }).click();
  await page.getByRole('tab', { name: 'Registro manual', exact: false }).click();
  await page
    .getByRole('textbox', { name: 'Texto para guardar' })
    .fill('Revisar el saludo de hello.mjs y conservar la decisión anterior.');
  await page.getByRole('button', { name: 'Guardar texto' }).click();
  await page
    .getByText('Revisar el saludo de hello.mjs y conservar la decisión anterior.', { exact: true })
    .waitFor();
  await page.getByRole('tab', { name: 'Contexto', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Decisiones tomadas' })
    .fill('Usar las aplicaciones originales y mantener el traspaso manual.');
  await page
    .getByRole('textbox', { name: 'Próximos pasos' })
    .fill('Abrir el repositorio de pruebas en Claude y revisar hello.mjs.');
  await showHandoff(page);
  await page.getByRole('button', { name: 'Revisar contexto' }).click();
  await page.getByRole('status').filter({ hasText: 'Guarda los cambios' }).waitFor();
  await page.getByRole('button', { name: 'Guardar contexto' }).click();
  await page.getByRole('status').filter({ hasText: 'Contexto guardado' }).waitFor();
  await page.getByRole('tab', { name: 'Registro manual', exact: false }).click();
  await showHandoff(page);
  await page.getByRole('button', { name: 'Revisar contexto' }).click();
  await page.locator('#preview-dialog').waitFor({ state: 'visible' });
  const preview = await page.locator('#preview-content').textContent();
  assert.ok(preview.includes('Usar las aplicaciones originales'));
  assert.ok(!preview.includes(path.resolve('sandbox')));
  await page.getByRole('button', { name: 'Copiar contexto', exact: false }).last().click();
  assert.equal(await desktop.evaluate(({ clipboard }) => clipboard.readText()), preview);
  await page.getByRole('button', { name: 'Cerrar', exact: true }).last().click();
  await page.screenshot({ path: path.join(output, 'workspace.png'), fullPage: true });
  await page.setViewportSize({ width: 480, height: 760 });
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    true,
    'La interfaz debe caber en una ventana estrecha de un compositor Wayland.',
  );
  await showHandoff(page);
  await page.getByRole('button', { name: 'Revisar contexto' }).click();
  await page.locator('#preview-dialog').waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Cerrar', exact: true }).last().click();
  await page.screenshot({ path: path.join(output, 'workspace-narrow.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 950 });

  // Exercise native export/import through controlled dialog destinations.
  const exportPath = path.join(directory, 'export.plm.json');
  await desktop.evaluate(({ dialog }, file) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
  }, exportPath);
  await page.getByRole('button', { name: 'Exportar conversación', exact: false }).click();
  await page.getByRole('status').filter({ hasText: 'Proyecto exportado' }).waitFor();
  const exported = JSON.parse(await readFile(exportPath, 'utf8'));
  assert.equal(exported.project.folder, '');
  await desktop.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
  }, exportPath);
  await page.locator('.context-import-menu > summary').click();
  await page.getByRole('button', { name: 'Restaurar copia JSON' }).click();
  await page.getByRole('status').filter({ hasText: 'Proyecto importado' }).waitFor();
  assert.equal((await page.evaluate(() => window.plm.workspace())).projects.length, 2);
  assert.equal(await page.evaluate(() => typeof window.require), 'undefined');
  assert.equal(await page.evaluate(() => typeof window.process), 'undefined');
  await page.getByRole('tab', { name: 'Registro manual', exact: false }).click();
  const malicious = '<img src=x onerror="window.INJECTED=true">';
  await page.getByRole('textbox', { name: 'Texto para guardar' }).fill(malicious);
  await page.getByRole('button', { name: 'Guardar texto' }).click();
  await page.getByText(malicious, { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.INJECTED), undefined);
  await desktop.close();
  desktop = null;
  page = await start();
  const restored = await page.evaluate(() => window.plm.workspace());
  assert.equal(restored.projects.length, 2);
  assert.equal(restored.projects[0].messages.length, 1);
  assert.equal(restored.projects[0].handoffs.length, 1);
  assert.equal(restored.projects[1].messages.length, 2);
  // Importing context is a two-step flow: a validated Markdown file, then a model.
  const contextPath = path.join(directory, 'plm.md');
  await page.locator('.context-import-menu > summary').click();
  await page.getByRole('button', { name: 'Copiar petición para la IA' }).click();
  const request = await desktop.evaluate(({ clipboard }) => clipboard.readText());
  assert.ok(request.includes('plm.md') && request.includes('máximo de 500 líneas'));
  assert.ok(request.includes('Si el proyecto usaba Git') && request.includes('repositorios'));
  await desktop.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
  }, contextPath);
  await writeFile(contextPath, Array.from({ length: 501 }, (_, n) => `Línea ${n}`).join('\n'));
  await page.getByRole('button', { name: 'Añadir plm.md', exact: true }).click();
  await page.getByRole('status').filter({ hasText: '501 líneas' }).waitFor();
  assert.equal((await page.evaluate(() => window.plm.workspace())).projects.length, 2);
  const base =
    [
      '# Conversación importada de prueba',
      'Decisión que el siguiente agente debe conservar.',
      ...Array.from({ length: 498 }, (_, n) => `Dato ${n}`),
    ].join('\n') + '\n';
  await writeFile(contextPath, base);
  await page.getByRole('button', { name: 'Añadir plm.md', exact: true }).click();
  await page.locator('#context-dialog').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#import-model').inputValue(), 'terra');
  assert.deepEqual(
    await page
      .locator('#import-model optgroup')
      .evaluateAll((items) => items.map((item) => item.label)),
    ['Low', 'Mid — recomendado para empezar', 'High', 'Frontier'],
  );
  assert.equal((await page.evaluate(() => window.plm.workspace())).projects.length, 2);
  await page.screenshot({ path: path.join(output, 'import-context.png'), fullPage: true });
  await page.locator('#context-dialog .import-preview > summary').click();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#context-dialog .import-preview').getAttribute('open'), null);
  assert.equal(await page.locator('#context-dialog').isVisible(), true);
  await page.keyboard.press('Escape');
  await page.locator('#context-dialog').waitFor({ state: 'hidden' });
  assert.equal((await page.evaluate(() => window.plm.workspace())).projects.length, 2);
  await page.getByRole('button', { name: 'Añadir plm.md', exact: true }).click();
  await page.locator('#context-dialog').waitFor({ state: 'visible' });
  await page.getByLabel('Modelo para empezar', { exact: true }).selectOption('flash');
  await page.getByRole('button', { name: 'Importar contexto', exact: false }).click();
  await page.getByRole('status').filter({ hasText: 'Contexto importado' }).waitFor();
  await showHandoff(page);
  assert.equal(await page.locator('#continuation-model').inputValue(), 'flash');
  assert.ok(
    (await page.evaluate(() => window.plm.workspace())).projects[2].importedContext.includes(
      'Dato 497',
    ),
  );
  await showHandoff(page);
  await page.getByRole('button', { name: 'Revisar contexto' }).click();
  await page.locator('#preview-dialog').waitFor({ state: 'visible' });
  assert.ok(
    (await page.locator('#preview-content').textContent()).includes(
      'Decisión que el siguiente agente debe conservar.',
    ),
  );
  await page.getByRole('button', { name: 'Cerrar', exact: true }).last().click();
  await page.locator('#continuation-model').selectOption('sonnet');
  await page.getByRole('status').filter({ hasText: 'Modelo guardado' }).waitFor();
  await desktop.close();
  desktop = null;
  page = await start();
  const final = await page.evaluate(() => window.plm.workspace());
  assert.equal(final.projects.length, 3);
  assert.equal(final.projects[2].importedContext, base);
  assert.equal(final.projects[2].preferredModel, 'sonnet');
  await page.getByRole('button', { name: 'Nuevo proyecto', exact: false }).click();
  await page.getByRole('textbox', { name: 'Nombre', exact: true }).fill('Solo conversación');
  await page
    .locator('#project-dialog')
    .getByRole('textbox', { name: 'Contexto duro', exact: true })
    .fill(
      'En cada mensaje de esta conversacion se usara git para especificar que se ha hecho en cada prompt.',
    );
  await page.getByRole('radio', { name: 'Carpeta con esta conversación' }).check();
  await desktop.evaluate(({ dialog }, folder) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [folder] });
  }, directory);
  await page.getByRole('button', { name: 'Elegir carpeta' }).click();
  await page.getByRole('radio', { name: 'Solo una conversación' }).check();
  assert.equal(await page.locator('#project-folder-selection').isVisible(), false);
  await page.screenshot({ path: path.join(output, 'new-conversation.png'), fullPage: true });
  await page.getByRole('button', { name: 'Crear proyecto', exact: false }).click();
  await page.getByRole('heading', { name: 'Solo conversación', exact: true }).waitFor();
  const solo = (await page.evaluate(() => window.plm.workspace())).projects[3];
  assert.equal(solo.folder, '');
  assert.ok(solo.goal.includes('En cada mensaje'));
  await showHandoff(page);
  await page.getByRole('button', { name: 'Revisar contexto' }).click();
  await page.locator('#preview-dialog').waitFor({ state: 'visible' });
  assert.ok((await page.locator('#preview-content').textContent()).includes('## Contexto duro'));
  assert.ok((await page.locator('#preview-content').textContent()).includes(solo.goal));
  await page.getByRole('button', { name: 'Cerrar', exact: true }).last().click();
  await page.getByRole('button', { name: 'Cerrar traspaso', exact: true }).click();
  // A saved folder can create more conversations after restart without a new file grant.
  await page.locator('.folder-new').first().click();
  await page.getByRole('textbox', { name: 'Nombre', exact: true }).fill('Segunda conversación');
  await page.getByRole('button', { name: 'Crear conversación', exact: true }).click();
  await page.getByRole('heading', { name: 'Segunda conversación', exact: true }).waitFor();
  assert.equal(
    await page.getByRole('tab', { name: 'Contexto', exact: true }).getAttribute('aria-selected'),
    'true',
  );
  await page.getByRole('tab', { name: 'Registro manual', exact: false }).click();
  const grouped = (await page.evaluate(() => window.plm.workspace())).projects;
  assert.equal(grouped[4].folder, grouped[0].folder);
  assert.equal(grouped[4].messages.length, 0);
  assert.equal(grouped[0].messages.length, 1);
  assert.equal(await page.locator('.folder-group').count(), 1);
  assert.equal(await page.locator('.folder-group [data-project]').count(), 2);
  await page.locator('.folder-heading').click();
  assert.equal(await page.locator('.folder-new').isVisible(), false);
  await page.locator('.folder-heading').click();
  assert.equal(await page.locator('.folder-new').isVisible(), true);
  await page
    .getByRole('textbox', { name: 'Texto para guardar' })
    .fill('Borrador que debe conservarse');
  await page.getByRole('tab', { name: 'Contexto', exact: true }).click();
  await page.getByRole('tab', { name: 'Registro manual', exact: false }).click();
  assert.equal(
    await page.getByRole('textbox', { name: 'Texto para guardar' }).inputValue(),
    'Borrador que debe conservarse',
  );
  for (const size of [
    { width: 1440, height: 950 },
    { width: 1024, height: 700 },
    { width: 480, height: 760 },
    { width: 480, height: 420 },
  ]) {
    await page.setViewportSize(size);
    const bounds = await page.locator('.work-panel').boundingBox();
    const composer = await page.locator('.composer').boundingBox();
    assert.ok(bounds.y < 200, 'El chat debe empezar cerca de la cabecera.');
    assert.ok(
      composer.y + composer.height < size.height,
      'El editor debe quedar visible sin desplazar la página.',
    );
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
    await page.screenshot({ path: path.join(output, `layout-${size.width}.png`) });
  }
  await page.getByRole('button', { name: 'Abrir navegación', exact: true }).click();
  await page.locator('.folder-group [data-project]').first().click();
  assert.equal(await page.locator('.sidebar').isVisible(), false);
  await page.getByRole('tab', { name: 'Registro manual', exact: false }).click();
  await page
    .getByText('Revisar el saludo de hello.mjs y conservar la decisión anterior.', { exact: true })
    .waitFor();
  await desktop.close();
  desktop = null;
  page = await start();
  assert.equal(await page.locator('.folder-group [data-project]').count(), 2);
  await page.getByRole('button', { name: 'Aplicaciones', exact: true }).last().click();
  await page.locator('#applications-dialog').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#applications-dialog .provider-card').count(), 3);
  await page.getByRole('button', { name: 'Volver a detectar aplicaciones', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Aplicaciones actualizadas' }).waitFor();
  await page
    .locator('#applications-dialog')
    .getByRole('button', { name: 'Cerrar', exact: true })
    .click();
  await page.getByRole('tab', { name: 'Registro manual', exact: false }).click();
  // Escape unwinds only the foreground layer and preserves drafts.
  await page.locator('.context-import-menu > summary').click();
  await page.locator('.request-details > summary').click();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.request-details').getAttribute('open'), null);
  assert.equal(await page.locator('.context-import-menu').getAttribute('open'), '');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.context-import-menu').getAttribute('open'), null);
  await page.locator('.folder-heading').focus();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.folder-heading').getAttribute('aria-expanded'), 'false');
  await page.locator('.folder-heading').click();
  await page
    .getByRole('textbox', { name: 'Texto para guardar' })
    .fill('Borrador conservado al pulsar Esc');
  await showHandoff(page);
  await page.locator('#continuation-model').focus();
  const modelBeforeEscape = await page.locator('#continuation-model').inputValue();
  await page.keyboard.press('Space');
  await page.keyboard.press('Escape');
  assert.equal(
    await page.locator('#handoff-panel').isVisible(),
    true,
    'Cerrar el selector nativo no debe cerrar el panel.',
  );
  assert.equal(await page.locator('#continuation-model').inputValue(), modelBeforeEscape);
  await page.getByRole('button', { name: 'Revisar contexto', exact: true }).click();
  await page.keyboard.press('Escape');
  await page.locator('#preview-dialog').waitFor({ state: 'hidden' });
  assert.equal(await page.locator('#handoff-panel').isVisible(), true);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#handoff-panel').count(), 0);
  assert.equal(
    await page
      .getByRole('button', { name: 'Preparar contexto', exact: true })
      .evaluate((el) => el === document.activeElement),
    true,
  );
  assert.equal(
    await page.getByRole('textbox', { name: 'Texto para guardar' }).inputValue(),
    'Borrador conservado al pulsar Esc',
  );
  await page.setViewportSize({ width: 480, height: 760 });
  await page.getByRole('button', { name: 'Abrir navegación', exact: true }).click();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.sidebar').isVisible(), false);
  await page.getByRole('button', { name: 'Aplicaciones', exact: true }).last().click();
  await page.keyboard.press('Escape');
  await page.locator('#applications-dialog').waitFor({ state: 'hidden' });
  // Update this conversation rather than creating another one, using pasted or selected Markdown.
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.getByRole('tab', { name: 'Contexto', exact: true }).click();
  const beforeUpdate = await page.evaluate(() => window.plm.workspace());
  const targetProject = beforeUpdate.projects[0];
  await page.getByRole('button', { name: 'Pegar resumen', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Contenido de plm.md', exact: true })
    .fill('Dato\n'.repeat(501));
  await page.getByRole('button', { name: 'Revisar contexto pegado', exact: true }).click();
  await page.getByRole('status').filter({ hasText: '501 líneas' }).waitFor();
  assert.equal(await page.locator('#paste-context-dialog').isVisible(), true);
  await page
    .getByRole('textbox', { name: 'Contenido de plm.md', exact: true })
    .fill('# Resumen A\nEstado confirmado A.');
  await page.getByRole('button', { name: 'Revisar contexto pegado', exact: true }).click();
  assert.equal(
    await page.locator('#context-import-form [name="name"]').getAttribute('readonly'),
    '',
  );
  await page.keyboard.press('Escape');
  await page.locator('#context-dialog').waitFor({ state: 'hidden' });
  assert.equal((await page.evaluate(() => window.plm.workspace())).projects[0].importedContext, '');
  async function pasteUpdate(content) {
    await page.getByRole('button', { name: 'Pegar resumen', exact: true }).click();
    await page.getByRole('textbox', { name: 'Contenido de plm.md', exact: true }).fill(content);
    await page.getByRole('button', { name: 'Revisar contexto pegado', exact: true }).click();
  }
  await pasteUpdate('# Resumen A\nEstado confirmado A.');
  await page.getByRole('button', { name: 'Actualizar contexto', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Contexto actualizado' }).waitFor();
  let updatedState = await page.evaluate(() => window.plm.workspace());
  assert.equal(updatedState.projects.length, beforeUpdate.projects.length);
  assert.equal(updatedState.projects[0].id, targetProject.id);
  assert.equal(updatedState.projects[0].folder, targetProject.folder);
  assert.equal(updatedState.projects[0].goal, targetProject.goal);
  assert.deepEqual(updatedState.projects[0].messages, targetProject.messages);
  await pasteUpdate('# Resumen B\nEstado confirmado B.');
  await page.getByRole('button', { name: 'Actualizar contexto', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Contexto actualizado' }).waitFor();
  await page.locator('.context-versions > summary').click();
  await page.locator('.context-version > summary').first().click();
  await page
    .locator('.context-version')
    .first()
    .getByRole('button', { name: 'Restaurar esta versión', exact: true })
    .click();
  await page.getByRole('status').filter({ hasText: 'Versión restaurada' }).waitFor();
  updatedState = await page.evaluate(() => window.plm.workspace());
  assert.ok(updatedState.projects[0].importedContext.includes('Estado confirmado A.'));
  assert.ok(
    updatedState.projects[0].contextRevisions
      .at(-1)
      .importedContext.includes('Estado confirmado B.'),
  );
  await showHandoff(page);
  await page.getByRole('button', { name: 'Revisar contexto', exact: true }).click();
  const latestPreview = await page.locator('#preview-content').textContent();
  assert.ok(latestPreview.includes('Estado confirmado A.'));
  assert.ok(!latestPreview.includes('Estado confirmado B.'));
  await page.keyboard.press('Escape');
  await page.locator('#preview-dialog').waitFor({ state: 'hidden' });
  await page.keyboard.press('Escape');
  await pasteUpdate('# No sobrescribir cambios');
  await page.evaluate(async () => {
    const p = (await window.plm.workspace()).projects[0];
    await window.plm.updateProject(p.id, { ...p, goal: p.goal + ' Cambio concurrente.' });
  });
  await page.getByRole('button', { name: 'Actualizar contexto', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'El contexto ha cambiado' }).waitFor();
  assert.ok(
    (await page.evaluate(() => window.plm.workspace())).projects[0].importedContext.includes(
      'Estado confirmado A.',
    ),
  );
  await page.keyboard.press('Escape');
  await page.locator('#context-dialog').waitFor({ state: 'hidden' });
  await desktop.close();
  desktop = null;
  page = await start();
  const restartedContext = (await page.evaluate(() => window.plm.workspace())).projects[0];
  assert.ok(restartedContext.importedContext.includes('Estado confirmado A.'));
  assert.ok(
    restartedContext.contextRevisions.some((r) =>
      r.importedContext.includes('Estado confirmado B.'),
    ),
  );
  assert.ok(restartedContext.goal.includes('Cambio concurrente.'));
  await desktop.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
  }, contextPath);
  await writeFile(contextPath, '# Desde archivo\nResumen actualizado desde un plm.md.');
  await page.getByRole('button', { name: '2. Actualizar plm.md', exact: true }).click();
  await page.getByRole('button', { name: 'Actualizar contexto', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Contexto actualizado' }).waitFor();
  const fileUpdated = (await page.evaluate(() => window.plm.workspace())).projects;
  assert.equal(fileUpdated.length, beforeUpdate.projects.length);
  assert.equal(fileUpdated[0].name, targetProject.name);
  assert.equal(
    fileUpdated[0].importedContext,
    '# Desde archivo\nResumen actualizado desde un plm.md.',
  );
  await page.screenshot({ path: path.join(output, 'context-workspace.png') });
  await page.setViewportSize({ width: 480, height: 760 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: path.join(output, 'context-workspace-narrow.png') });
  await page.setViewportSize({ width: 1440, height: 950 });
  const savedHardContext = fileUpdated[0].goal;
  await page.locator('#context-form [name="goal"]').fill('Borrador sin guardar');
  await page.getByRole('button', { name: 'Pegar resumen', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Guarda los cambios' }).waitFor();
  assert.equal(await page.locator('#paste-context-dialog').isVisible(), false);
  await page.locator('#context-form [name="goal"]').fill(savedHardContext);
  await page.locator('.context-import-menu > summary').click();
  await page.getByRole('button', { name: 'Pegar contexto', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Contenido de plm.md', exact: true })
    .fill('# Nueva desde texto\nResumen independiente.');
  await page.getByRole('button', { name: 'Revisar contexto pegado', exact: true }).click();
  assert.equal(
    await page.locator('#context-import-form [name="name"]').getAttribute('readonly'),
    null,
  );
  assert.equal(await page.locator('#import-model').inputValue(), 'terra');
  await page.getByRole('button', { name: 'Importar contexto', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Contexto importado' }).waitFor();
  const pastedNew = (await page.evaluate(() => window.plm.workspace())).projects;
  assert.equal(pastedNew.length, beforeUpdate.projects.length + 1);
  assert.equal(pastedNew.at(-1).name, 'Nueva desde texto');
  assert.equal(pastedNew[0].importedContext, fileUpdated[0].importedContext);
  assert.deepEqual(rendererErrors, []);
  console.log(
    'Desktop E2E: creación, contexto, portapapeles, exportación/importación, XSS, aislamiento y reinicio correctos.',
  );
  console.log(`Captura: ${path.join(output, 'workspace.png')}`);
} finally {
  if (desktop) {
    await desktop.close().catch(() => {});
  }
  await rm(directory, { recursive: true, force: true });
}
