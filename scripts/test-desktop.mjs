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
    await page.getByRole('button', { name: 'Continuar en otra app', exact: true }).click();
}
try {
  let page = await start();
  await page.getByRole('button', { name: 'Crear mi primer proyecto' }).click();
  await page.getByRole('textbox', { name: 'Nombre', exact: true }).fill('PLM — poors LLM');
  await page
    .getByRole('textbox', { name: 'Contexto duro', exact: true })
    .fill('Continuar la misma tarea entre Codex, Claude y Antigravity.');
  assert.equal(await page.getByRole('radio', { name: 'Solo una conversación' }).isChecked(), true);
  assert.equal(await page.locator('#project-folder-selection').isVisible(), false);
  assert.equal(
    await page
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
  await page
    .getByRole('textbox', { name: 'Mensaje o nota' })
    .fill('Revisar el saludo de hello.mjs y conservar la decisión anterior.');
  await page.getByRole('button', { name: 'Guardar entrada' }).click();
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
  await page.getByRole('tab', { name: 'Conversación', exact: false }).click();
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
  const malicious = '<img src=x onerror="window.INJECTED=true">';
  await page.getByRole('textbox', { name: 'Mensaje o nota' }).fill(malicious);
  await page.getByRole('button', { name: 'Guardar entrada' }).click();
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
  await page.getByRole('button', { name: 'Añadir plm.md' }).click();
  await page.getByRole('status').filter({ hasText: '501 líneas' }).waitFor();
  assert.equal((await page.evaluate(() => window.plm.workspace())).projects.length, 2);
  const base =
    [
      '# Conversación importada de prueba',
      'Decisión que el siguiente agente debe conservar.',
      ...Array.from({ length: 498 }, (_, n) => `Dato ${n}`),
    ].join('\n') + '\n';
  await writeFile(contextPath, base);
  await page.getByRole('button', { name: 'Añadir plm.md' }).click();
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
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  assert.equal((await page.evaluate(() => window.plm.workspace())).projects.length, 2);
  await page.getByRole('button', { name: 'Añadir plm.md' }).click();
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
  await page.getByRole('textbox', { name: 'Mensaje o nota' }).fill('Borrador que debe conservarse');
  await page.getByRole('tab', { name: 'Contexto', exact: true }).click();
  await page.getByRole('tab', { name: 'Conversación', exact: false }).click();
  assert.equal(
    await page.getByRole('textbox', { name: 'Mensaje o nota' }).inputValue(),
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
