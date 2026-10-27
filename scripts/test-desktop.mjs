import { _electron as electron } from 'playwright';
import electronPath from 'electron';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
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
  page.on('pageerror', (error) => rendererErrors.push(error.message));
  await page.getByRole('button', { name: 'Nuevo proyecto', exact: false }).waitFor();
  return page;
}
try {
  let page = await start();
  await page.getByRole('button', { name: 'Crear mi primer proyecto' }).click();
  await page.getByRole('textbox', { name: 'Nombre', exact: true }).fill('PLM — poors LLM');
  await page
    .getByRole('textbox', { name: '¿Qué quieres conseguir?' })
    .fill('Continuar la misma tarea entre Codex, Claude y Antigravity.');
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
  await page.getByRole('button', { name: 'Revisar contexto' }).click();
  await page.getByRole('status').filter({ hasText: 'Guarda los cambios' }).waitFor();
  await page.getByRole('button', { name: 'Guardar contexto' }).click();
  await page.getByRole('status').filter({ hasText: 'Contexto guardado' }).waitFor();
  await page.getByRole('tab', { name: 'Conversación', exact: false }).click();
  await page.getByRole('button', { name: 'Revisar contexto' }).click();
  await page.locator('#preview-dialog').waitFor({ state: 'visible' });
  const preview = await page.locator('#preview-content').textContent();
  assert.ok(preview.includes('Usar las aplicaciones originales'));
  assert.ok(!preview.includes(path.resolve('sandbox')));
  await page.getByRole('button', { name: 'Copiar contexto', exact: false }).last().click();
  assert.equal(await desktop.evaluate(({ clipboard }) => clipboard.readText()), preview);
  await page.getByRole('button', { name: 'Cerrar', exact: true }).last().click();
  await page.screenshot({ path: path.join(output, 'workspace.png'), fullPage: true });

  // Exercise native export/import through controlled dialog destinations.
  const exportPath = path.join(directory, 'export.plm.json');
  await desktop.evaluate(({ dialog }, file) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
  }, exportPath);
  await page.getByRole('button', { name: 'Exportar proyecto', exact: false }).click();
  await page.getByRole('status').filter({ hasText: 'Proyecto exportado' }).waitFor();
  const exported = JSON.parse(await readFile(exportPath, 'utf8'));
  assert.equal(exported.project.folder, '');
  await desktop.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
  }, exportPath);
  await page.getByRole('button', { name: 'Importar proyecto PLM' }).click();
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
