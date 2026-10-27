import { spawnSync } from 'node:child_process';
import { _electron as electron } from 'playwright';
import electronPath from 'electron';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const directory = await mkdtemp(path.join(tmpdir(), 'plm-desktop-'));
const output = path.resolve('test-results');
await mkdir(output, { recursive: true });
const marker = path.join(directory, 'fixture-launched');
const fixture = path.join(directory, 'official-ui-fixture');
const env = {
  ...process.env,
  PLM_DATA_DIR: directory,
  PLM_LAUNCH_MARKER: marker,
  PLM_DISABLE_USAGE_AUTO: '1',
};
delete env.ELECTRON_RUN_AS_NODE;
let desktop;
let page;
const rendererErrors = [];
async function start() {
  desktop = await electron.launch({
    executablePath: process.env.PLM_EXECUTABLE || electronPath,
    args: process.env.PLM_EXECUTABLE ? [] : ['.'],
    env,
    timeout: 30_000,
  });
  await desktop.evaluate(({ clipboard }) => {
    let value = '';
    clipboard.writeText = (text) => {
      value = text;
    };
    clipboard.readText = () => value;
  });
  page = await desktop.firstWindow();
  await page.setViewportSize({ width: 1440, height: 950 });
  page.on('pageerror', (error) => rendererErrors.push(error.message));
  await page.locator('.new-project').waitFor();
  assert.equal(
    await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible()),
    true,
  );
}
async function choose(file) {
  await desktop.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
  }, file);
}
async function paste(content) {
  await page.getByRole('button', { name: 'Pegar resumen', exact: true }).click();
  await page.getByRole('textbox', { name: 'Contenido de plm.md', exact: true }).fill(content);
  await page.getByRole('button', { name: 'Revisar contexto pegado', exact: true }).click();
}
async function saveImport(update = false) {
  await page
    .getByRole('button', {
      name: update ? 'Actualizar contexto' : 'Importar contexto',
      exact: true,
    })
    .click();
  await page
    .getByRole('status')
    .filter({ hasText: update ? 'Contexto actualizado' : 'Contexto importado' })
    .waitFor();
}
async function notes() {
  if (!(await page.locator('.project-notes').getAttribute('open'))) {
    // Empty string is also an open boolean attribute.
    if (!(await page.locator('.project-notes').evaluate((el) => el.open)))
      await page.locator('.project-notes > summary').click();
  }
}
try {
  await start();
  assert.equal(await page.getByRole('tab').count(), 0);
  assert.equal(await page.locator('#message-form').count(), 0);
  assert.ok(
    (await page.locator('.product-purpose').textContent()).includes('aplicaciones originales'),
  );
  await page.locator('.new-project').click();
  await page.locator('#project-form [name="name"]').fill('PLM — poors LLM');
  await page.locator('#project-form [name="goal"]').fill('Conservar las instrucciones y usar Git.');
  assert.equal(
    await page.getByRole('radio', { name: 'Solo una conversación', exact: true }).isChecked(),
    true,
  );
  await page.getByRole('radio', { name: 'Carpeta con esta conversación', exact: true }).check();
  await page.locator('#project-form [type="submit"]').click();
  await page.getByRole('status').filter({ hasText: 'Elige una carpeta' }).waitFor();
  assert.equal((await page.evaluate(() => window.plm.workspace())).projects.length, 0);
  await choose(directory);
  await page.getByRole('button', { name: 'Elegir carpeta', exact: true }).click();
  await page.locator('#project-form [type="submit"]').click();
  await page.getByRole('heading', { name: 'PLM — poors LLM', exact: true }).waitFor();
  assert.equal(await page.locator('#message-form').count(), 0);
  await notes();
  await page.locator('#context-form [name="decisions"]').fill('Usar las aplicaciones originales.');
  await page.locator('#context-form [name="nextSteps"]').fill('Revisar hello.mjs.');
  await page.getByRole('button', { name: 'Revisar lo que se copiará', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Guarda los cambios' }).waitFor();
  await page.getByRole('button', { name: 'Guardar contexto', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Contexto guardado' }).waitFor();
  await page.keyboard.press('Escape');

  // Paste/file import has a review step; cancellation must never create/update a project.
  await paste('Dato\n'.repeat(501));
  await page.getByRole('status').filter({ hasText: '501 líneas' }).waitFor();
  await page
    .getByRole('textbox', { name: 'Contenido de plm.md', exact: true })
    .fill('# Resumen A\nEstado confirmado A.');
  await page.getByRole('button', { name: 'Revisar contexto pegado', exact: true }).click();
  assert.equal(await page.locator('#import-model').inputValue(), 'terra');
  await page.locator('#context-dialog .import-preview > summary').click();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#context-dialog').isVisible(), true);
  await page.keyboard.press('Escape');
  await page.locator('#context-dialog').waitFor({ state: 'hidden' });
  assert.equal((await page.evaluate(() => window.plm.workspace())).projects[0].importedContext, '');
  await paste('# Resumen A\nEstado confirmado A.');
  await saveImport(true);
  let state = await page.evaluate(() => window.plm.workspace());
  const firstId = state.projects[0].id;
  assert.equal(state.projects.length, 1);
  assert.equal(state.projects[0].folder, directory);
  assert.equal(state.projects[0].goal, 'Conservar las instrucciones y usar Git.');
  await paste('# Resumen B\nEstado confirmado B.');
  await saveImport(true);
  await page.locator('.context-versions > summary').click();
  await page.locator('.context-version > summary').first().click();
  await page
    .locator('.context-version')
    .first()
    .getByRole('button', { name: 'Restaurar esta versión', exact: true })
    .click();
  await page.getByRole('status').filter({ hasText: 'Versión restaurada' }).waitFor();
  state = await page.evaluate(() => window.plm.workspace());
  assert.ok(state.projects[0].importedContext.includes('Estado confirmado A.'));
  assert.ok(
    state.projects[0].contextRevisions.at(-1).importedContext.includes('Estado confirmado B.'),
  );
  await page.getByRole('button', { name: 'Revisar lo que se copiará', exact: true }).click();
  const preview = await page.locator('#preview-content').textContent();
  assert.ok(preview.includes('Estado confirmado A.'));
  assert.ok(!preview.includes('Estado confirmado B.'));
  assert.ok(!preview.includes(directory));
  await page
    .locator('#preview-dialog')
    .getByRole('button', { name: 'Copiar contexto', exact: false })
    .click();
  assert.equal(await desktop.evaluate(({ clipboard }) => clipboard.readText()), preview);
  await page.keyboard.press('Escape');
  await page.locator('#preview-dialog').waitFor({ state: 'hidden' });

  await page.locator('[data-target="claude"]').click();
  assert.equal(await page.locator('#continuation-model').inputValue(), 'haiku');
  await page.locator('#continuation-model').selectOption('flash');
  await page.getByRole('status').filter({ hasText: 'Destino guardado' }).waitFor();
  assert.equal(
    await page.locator('[data-target="antigravity"]').getAttribute('aria-pressed'),
    'true',
  );
  await page.locator('#continuation-model').selectOption('terra');
  await page.getByRole('status').filter({ hasText: 'Destino guardado' }).waitFor();
  assert.equal(await page.locator('[data-target="codex"]').getAttribute('aria-pressed'), 'true');
  await page.locator('#continuation-model').focus();
  await page.keyboard.press('Space');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#continuation-model').inputValue(), 'terra');

  // A harmless executable fixture exercises the real copy+launch IPC without using any AI service.
  if (process.platform !== 'win32') {
    await writeFile(fixture, '#!/bin/sh\nprintf \'%s\\n\' "$#" > "$PLM_LAUNCH_MARKER"\n');
    await chmod(fixture, 0o755);
    await choose(fixture);
    await page.getByRole('button', { name: 'Aplicaciones', exact: true }).last().click();
    await page.getByRole('button', { name: 'Ubicación de Codex', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Ubicación guardada' }).waitFor();
    await page.keyboard.press('Escape');
    await page.locator('#applications-dialog').waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: 'Copiar contexto y abrir Codex', exact: true }).click();
    await page
      .locator('.continue-status')
      .filter({ hasText: 'Inicio de Codex solicitado' })
      .waitFor();
    assert.ok(
      (await desktop.evaluate(({ clipboard }) => clipboard.readText())).includes(
        'Estado confirmado A.',
      ),
    );
    for (let attempt = 0; attempt < 40; attempt++) {
      try {
        assert.equal((await readFile(marker, 'utf8')).trim(), '0');
        break;
      } catch (error) {
        if (attempt === 39) throw error;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
    }
    await desktop.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler('handoff:open');
      ipcMain.handle('handoff:open', () => ({
        copied: true,
        started: false,
        error: 'Fallo simulado de apertura',
      }));
    });
    await page.getByRole('button', { name: 'Copiar contexto y abrir Codex', exact: true }).click();
    await page.locator('.continue-status').filter({ hasText: 'no se pudo abrir Codex' }).waitFor();
  }

  for (const size of [
    { width: 1440, height: 950 },
    { width: 1024, height: 700 },
    { width: 480, height: 760 },
  ]) {
    await page.setViewportSize(size);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
    const button = page.locator('.continue-button');
    const bounds = await button.boundingBox();
    assert.ok(
      bounds.y + bounds.height < size.height,
      'La acción principal debe ser visible sin desplazar la página.',
    );
    await page.screenshot({ path: path.join(output, `continue-${size.width}.png`) });
  }
  await page.getByRole('button', { name: 'Abrir navegación', exact: true }).click();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.sidebar').isVisible(), false);
  await page.setViewportSize({ width: 1440, height: 950 });

  // Folder conversations stay independent; importing old copies preserves their texts as an archive.
  await page.locator('.folder-new').first().click();
  await page.locator('#project-form [name="name"]').fill('Segunda conversación');
  await page.locator('#project-form [type="submit"]').click();
  await page.getByRole('heading', { name: 'Segunda conversación', exact: true }).waitFor();
  state = await page.evaluate(() => window.plm.workspace());
  assert.equal(state.projects[1].folder, directory);
  assert.equal(state.projects[1].importedContext, '');
  assert.equal(await page.locator('.continue-button').isDisabled(), true);
  await page.locator(`button[data-project="${firstId}"]`).click();
  const exportPath = path.join(directory, 'copy.json');
  await desktop.evaluate(({ dialog }, file) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
  }, exportPath);
  await page.getByRole('button', { name: 'Exportar proyecto', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Proyecto exportado' }).waitFor();
  const exported = JSON.parse(await readFile(exportPath, 'utf8'));
  assert.equal(exported.project.folder, '');
  const malicious = '<img src=x onerror="window.INJECTED=true">';
  exported.project.messages = [
    {
      id: 'old-text',
      role: 'assistant',
      provider: 'claude',
      content: malicious,
      createdAt: new Date().toISOString(),
    },
  ];
  await writeFile(exportPath, JSON.stringify(exported));
  await choose(exportPath);
  await page.locator('.context-import-menu > summary').click();
  await page.getByRole('button', { name: 'Restaurar copia JSON', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Proyecto importado' }).waitFor();
  assert.equal(await page.locator('#message-form').count(), 0);
  await page.locator('.legacy-archive > summary').click();
  await page.getByText(malicious, { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.INJECTED), undefined);
  await page.getByRole('button', { name: 'Revisar lo que se copiará', exact: true }).click();
  assert.ok(!(await page.locator('#preview-content').textContent()).includes(malicious));
  await page.keyboard.press('Escape');
  await page.locator('#preview-dialog').waitFor({ state: 'hidden' });
  await page.locator('.copy-options > summary').click();
  await page
    .getByRole('checkbox', { name: 'Incluir textos de versiones anteriores', exact: true })
    .check();
  await page.getByRole('button', { name: 'Revisar lo que se copiará', exact: true }).click();
  assert.ok((await page.locator('#preview-content').textContent()).includes(malicious));
  await page.keyboard.press('Escape');
  await page.locator('#preview-dialog').waitFor({ state: 'hidden' });
  assert.equal(await page.evaluate(() => typeof window.require), 'undefined');
  assert.equal(await page.evaluate(() => typeof window.process), 'undefined');
  await desktop.close();
  desktop = null;
  await start();
  state = await page.evaluate(() => window.plm.workspace());
  assert.equal(state.projects.length, 3);
  assert.equal(state.projects[2].messages[0].content, malicious);
  assert.equal(await page.locator('.folder-group [data-project]').count(), 2);
  assert.equal(await page.locator('#message-form').count(), 0);

  // Official statusLine exports feed quotas without starting models or touching personal configuration.
  await page.getByRole('button', { name: 'Uso de suscripciones', exact: true }).click();
  await page.getByRole('button', { name: 'Actualizar uso', exact: true }).click();
  const usageDialog = page.locator('#usage-dialog');
  const claudeUsage = usageDialog.locator('[data-usage-provider="claude"]');
  assert.equal(
    await claudeUsage.locator('progress').count(),
    0,
    'Sin datos no debe inventar 0% de uso.',
  );
  await page.getByRole('button', { name: 'Conectar Claude Code', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Conexión activada' }).waitFor();
  assert.ok((await claudeUsage.textContent()).includes('Esperando'));
  if (process.platform !== 'win32') {
    const connectionScript = path.join(directory, 'usage', 'claude-statusline.sh');
    const collected = spawnSync('/bin/sh', [connectionScript], {
      input: JSON.stringify({
        email: 'private@example.com',
        transcript_path: '/private/chat',
        access_token: 'never-save-this',
        context_window: { used_percentage: 99 },
        rate_limits: {
          five_hour: { used_percentage: 52, resets_at: Math.floor(Date.now() / 1000) + 3600 },
          seven_day: { used_percentage: 20, resets_at: Math.floor(Date.now() / 1000) + 604800 },
        },
      }),
      encoding: 'utf8',
    });
    assert.equal(collected.status, 0, collected.stderr);
    const quotaFile = await readFile(path.join(directory, 'usage', 'claude-usage.json'), 'utf8');
    assert.ok(!quotaFile.includes('private') && !quotaFile.includes('never-save-this'));
    await page.getByRole('button', { name: 'Actualizar uso', exact: true }).click();
    await claudeUsage.getByText('52% usado', { exact: true }).waitFor();
    assert.ok((await claudeUsage.textContent()).includes('48% restante'));
    assert.equal(await claudeUsage.locator('progress').first().getAttribute('value'), '52');
    await page.screenshot({ path: path.join(output, 'subscription-usage.png') });
  }
  await claudeUsage.getByRole('button', { name: 'Desconectar medidor', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Medidor desconectado' }).waitFor();
  const restoredSettings = JSON.parse(
    await readFile(
      path.join(directory, 'integration-test-home', '.claude', 'settings.json'),
      'utf8',
    ),
  );
  assert.equal(restoredSettings.statusLine, undefined);
  await page.keyboard.press('Escape');
  await usageDialog.waitFor({ state: 'hidden' });

  // Conflicting edits and invalid files do not overwrite the existing context.
  await paste('# Conflicto');
  await page.evaluate(async () => {
    const p = (await window.plm.workspace()).projects[0];
    await window.plm.updateProject(p.id, { ...p, goal: p.goal + ' Cambio concurrente.' });
  });
  await page.getByRole('button', { name: 'Actualizar contexto', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'El contexto ha cambiado' }).waitFor();
  await page.keyboard.press('Escape');
  await page.locator('#context-dialog').waitFor({ state: 'hidden' });
  const contextPath = path.join(directory, 'plm.md');
  await choose(contextPath);
  await writeFile(contextPath, 'Dato\n'.repeat(501));
  await page.getByRole('button', { name: 'Actualizar resumen', exact: true }).click();
  await page.getByRole('status').filter({ hasText: '501 líneas' }).waitFor();
  await writeFile(contextPath, '# Archivo\nResumen desde archivo.');
  await page.getByRole('button', { name: 'Actualizar resumen', exact: true }).click();
  assert.equal(
    await page.locator('#context-import-form [name="name"]').getAttribute('readonly'),
    '',
  );
  await saveImport(true);
  state = await page.evaluate(() => window.plm.workspace());
  assert.equal(state.projects.length, 3);
  assert.equal(state.projects[0].id, firstId);
  assert.ok(state.projects[0].goal.includes('Cambio concurrente.'));
  assert.equal(state.projects[0].importedContext, '# Archivo\nResumen desde archivo.');
  await notes();
  await page.locator('#context-form [name="goal"]').fill('Borrador sin guardar');
  await page.getByRole('button', { name: 'Pegar resumen', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Guarda los cambios' }).waitFor();
  assert.equal(await page.locator('#paste-context-dialog').isVisible(), false);
  await page.locator('.context-import-menu > summary').click();
  await page.locator('.request-details > summary').click();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.request-details').evaluate((el) => el.open), false);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.context-import-menu').evaluate((el) => el.open), false);
  assert.equal(
    await page.locator('#context-form [name="goal"]').inputValue(),
    'Borrador sin guardar',
  );
  assert.deepEqual(rendererErrors, []);
  console.log(
    'Desktop E2E: flujo sin chat manual, copia y apertura explícitas, carpetas, archivo heredado, revisiones, conflictos, Esc y persistencia correctos.',
  );
} finally {
  if (desktop) await desktop.close().catch(() => {});
  await rm(directory, { recursive: true, force: true });
}
