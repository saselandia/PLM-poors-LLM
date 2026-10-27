import { app, BrowserWindow, Menu, ipcMain, dialog, clipboard, shell, session } from 'electron';
import path from 'node:path';
import os from 'node:os';
import { findCodexCli, readCodexUsage, readUsageFile, usageState } from './core/usage.mjs';
import {
  connectionPaths,
  connectionState,
  installUsageConnection,
  uninstallUsageConnection,
} from './core/usage-connection.mjs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFile, stat, open, mkdir, writeFile } from 'node:fs/promises';
import { copyAndOpen } from './core/continue.mjs';
import { Store } from './core/store.mjs';
import {
  PROVIDERS,
  providerId,
  text,
  createProject,
  buildHandoff,
  exportProject,
  importProject,
  recordHandoff,
  reviseContext,
  restoreContext,
  MAX_BYTES,
} from './core/model.mjs';
import { detectLaunchers, isLauncher, launchOfficial } from './core/launchers.mjs';
import { CONTEXT_REQUEST, contextText, modelById } from './shared/context.js';
import { randomUUID } from 'node:crypto';

const root = path.dirname(fileURLToPath(import.meta.url));
const indexUrl = pathToFileURL(path.join(root, 'renderer/index.html')).href;
// A separate profile makes development and desktop tests independent of personal data.
if (process.env.PLM_DATA_DIR) app.setPath('userData', path.resolve(process.env.PLM_DATA_DIR));
app.setName('PLM');
const store = new Store(app.getPath('userData'));
let window;
const selectedFolders = new Set();
const pendingContexts = new Map();
const pendingLaunches = new Set();
let loaded = false;
if (/^[a-f0-9-]{36}$/.test(process.env.PLM_LAUNCH_ID || ''))
  pendingLaunches.add(process.env.PLM_LAUNCH_ID);

async function acknowledgeLaunch(error) {
  const status = {
    pid: process.pid,
    visible: Boolean(window && !window.isDestroyed() && window.isVisible()),
    loaded,
    ...(error ? { error: error.message } : {}),
  };
  await mkdir(app.getPath('userData'), { recursive: true, mode: 0o700 });
  for (const launchId of pendingLaunches) {
    await writeFile(
      path.join(app.getPath('userData'), `launch-${launchId}.json`),
      JSON.stringify({ ...status, launchId }),
      { mode: 0o600 },
    );
  }
  pendingLaunches.clear();
}
function presentWindow() {
  if (!window || window.isDestroyed()) return;
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
}
function startupFailed(error) {
  console.error('PLM: error al iniciar:', error.message);
  void acknowledgeLaunch(error).catch(() => {});
  dialog.showErrorBox(
    'PLM no ha podido abrirse',
    `${error.message}\nLos datos guardados se conservan.`,
  );
  app.quit();
}

function projectFrom(state, id) {
  const found = state.projects.find((p) => p.id === id);
  if (!found) throw new Error('No se ha encontrado el proyecto.');
  return found;
}
function update(id, fn) {
  return store.mutate((state) => {
    const p = projectFrom(state, id);
    state.projects = state.projects.map((item) => (item.id === id ? fn(p) : item));
    return state;
  });
}
function handle(channel, fn) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (
      event.sender !== window?.webContents ||
      event.senderFrame !== window.webContents.mainFrame ||
      event.senderFrame.url !== indexUrl
    )
      throw new Error('Origen no autorizado.');
    return fn(...args);
  });
}
function handoffOptions(options) {
  if (
    !options ||
    typeof options.includeHistory !== 'boolean' ||
    typeof options.includeFolder !== 'boolean'
  )
    throw new Error('Opciones de contexto no válidas.');
  return { includeHistory: options.includeHistory, includeFolder: options.includeFolder };
}
async function saveFile(defaultPath, contents, filters) {
  const result = await dialog.showSaveDialog(window, {
    defaultPath,
    filters,
    properties: ['showOverwriteConfirmation'],
  });
  if (result.canceled || !result.filePath) return false;
  const handle = await open(result.filePath, 'w', 0o600);
  try {
    await handle.writeFile(contents);
    await handle.sync();
  } finally {
    await handle.close();
  }
  return true;
}
function filename(name) {
  return name.replace(/[^\p{L}\p{N}_-]+/gu, '-').slice(0, 80) || 'proyecto';
}

const usageDirectory = path.join(app.getPath('userData'), 'usage');
const usageConnectionOptions = {
  home: process.env.PLM_DATA_DIR
    ? path.join(app.getPath('userData'), 'integration-test-home')
    : os.homedir(),
  directory: usageDirectory,
  executable: process.execPath,
  collector: path.join(root, 'core', 'usage-collector.mjs'),
};
let codexUsageCache = null;
let codexUsagePending = null;
let codexUsageAttempt = 0;
async function codexSubscriptionUsage(force) {
  if (codexUsagePending) return codexUsagePending;
  if (!force && codexUsageCache && Date.now() - codexUsageAttempt < 60_000)
    return { ...codexUsageCache, ...usageState(codexUsageCache) };
  codexUsageAttempt = Date.now();
  codexUsagePending = (async () => {
    try {
      if (process.env.PLM_DISABLE_USAGE_AUTO === '1')
        throw new Error('Consulta de uso desactivada en este perfil de prueba.');
      const cli = await findCodexCli();
      if (!cli)
        throw new Error(
          'Instala el cliente oficial de Codex y abre su sesión para consultar el uso.',
        );
      const snapshot = await readCodexUsage(cli);
      codexUsageCache = { ...snapshot, status: 'ok', error: null };
    } catch (error) {
      codexUsageCache = {
        ...(codexUsageCache || { provider: 'codex', windows: [], updatedAt: null }),
        status: 'error',
        error: error.message,
      };
    }
    return { ...codexUsageCache, ...usageState(codexUsageCache) };
  })().finally(() => {
    codexUsagePending = null;
  });
  return codexUsagePending;
}
async function statusSubscriptionUsage(provider) {
  const connection = await connectionState(provider, usageConnectionOptions);
  try {
    const snapshot = await readUsageFile(
      connectionPaths(provider, usageConnectionOptions).data,
      provider,
    );
    return {
      ...(snapshot || { provider, windows: [], updatedAt: null }),
      ...usageState(snapshot),
      connected: connection.installed,
      stale: !connection.installed || usageState(snapshot).stale,
      status: !connection.installed ? 'disconnected' : snapshot ? 'ok' : 'waiting',
    };
  } catch (error) {
    return {
      provider,
      windows: [],
      updatedAt: null,
      available: false,
      stale: true,
      connected: connection.installed,
      status: 'error',
      error: error.message,
    };
  }
}
handle('usage:read', async (force = false) => {
  if (typeof force !== 'boolean') throw new Error('Consulta de uso no válida.');
  const [codex, claude, antigravity] = await Promise.all([
    codexSubscriptionUsage(force),
    statusSubscriptionUsage('claude'),
    statusSubscriptionUsage('antigravity'),
  ]);
  return { codex, claude, antigravity };
});
handle('usage:connect', async (provider) =>
  installUsageConnection(provider, usageConnectionOptions),
);
handle('usage:disconnect', async (provider) =>
  uninstallUsageConnection(provider, usageConnectionOptions),
);
handle('usage:help', async (provider) => {
  providerId(provider);
  const urls = {
    codex: 'https://learn.chatgpt.com/docs/app-server',
    claude: 'https://code.claude.com/docs/en/statusline',
    antigravity: 'https://www.antigravity.google/docs/cli/statusline',
  };
  await shell.openExternal(urls[provider]);
});
handle('workspace:read', () => {
  const { launchers, ...workspace } = store.snapshot();
  return workspace;
});
handle('window:ready', async () => {
  loaded = true;
  presentWindow();
  await acknowledgeLaunch();
});
handle('folder:choose', async () => {
  const result = await dialog.showOpenDialog(window, { properties: ['openDirectory'] });
  const folder = result.canceled ? '' : result.filePaths[0] || '';
  if (folder) selectedFolders.add(folder);
  return folder;
});
handle('project:create', async (input) => {
  if (!input || typeof input !== 'object') throw new Error('Proyecto no válido.');
  const parent = input.parentId ? projectFrom(store.snapshot(), input.parentId) : null;
  if (parent && !parent.folder) throw new Error('Esta conversación no pertenece a una carpeta.');
  const folder = parent ? parent.folder : input.folder || '';
  const scope = input.scope ?? (folder ? 'folder' : 'conversation');
  if (!['folder', 'conversation'].includes(scope))
    throw new Error('Elige carpeta o solo conversación.');
  if (scope === 'folder' && !folder)
    throw new Error('Elige una carpeta para guardar esta conversación.');
  if (scope === 'conversation' && folder)
    throw new Error('Una conversación sin carpeta no puede tener una carpeta vinculada.');
  if (folder && !parent && !selectedFolders.has(folder))
    throw new Error('Selecciona la carpeta desde PLM.');
  const project = createProject({ name: input.name, goal: input.goal ?? '', folder });
  await store.mutate((state) => {
    state.projects.push(project);
    return state;
  });
  return project;
});
handle('project:update', async (id, input) => {
  if (!input || typeof input !== 'object') throw new Error('Cambios no válidos.');
  await update(id, (p) =>
    reviseContext(p, {
      name: text(input.name, 'Nombre', 120, true),
      goal: text(input.goal, 'Contexto duro', 20_000),
      decisions: text(input.decisions, 'Decisiones'),
      nextSteps: text(input.nextSteps, 'Próximos pasos'),
      updatedAt: new Date().toISOString(),
    }),
  );
});
handle('context:restore', async (id, revisionId) => {
  await update(id, (p) => restoreContext(p, revisionId));
});
handle('project:delete', async (id) => {
  const p = projectFrom(store.snapshot(), id);
  const answer = await dialog.showMessageBox(window, {
    type: 'question',
    buttons: ['Conservar', 'Eliminar de PLM'],
    defaultId: 0,
    cancelId: 0,
    message: `¿Eliminar «${p.name}» de PLM?`,
    detail:
      'Se eliminarán su historial y contexto guardados en PLM. Los archivos de tu carpeta permanecen en su ubicación.',
  });
  if (answer.response !== 1) return false;
  await store.mutate((state) => ({
    ...state,
    projects: state.projects.filter((item) => item.id !== id),
  }));
  return true;
});
handle('folder:reveal', async (id) => {
  const p = projectFrom(store.snapshot(), id);
  if (!p.folder || !path.isAbsolute(p.folder) || !(await stat(p.folder)).isDirectory())
    throw new Error('La carpeta no está disponible.');
  const error = await shell.openPath(p.folder);
  if (error) throw new Error(error);
});
handle('providers:list', () => detectLaunchers(store.snapshot().launchers));
handle('provider:configure', async (id) => {
  providerId(id);
  const options =
    process.platform === 'darwin'
      ? { properties: ['openFile', 'openDirectory'] }
      : { properties: ['openFile'] };
  const result = await dialog.showOpenDialog(window, {
    title: `Seleccionar aplicación oficial de ${PROVIDERS[id].name}`,
    ...options,
  });
  if (result.canceled) return false;
  const executable = result.filePaths[0];
  if (!(await isLauncher(executable)))
    throw new Error('Selecciona una aplicación ejecutable válida.');
  await store.mutate((state) => {
    state.launchers[id] = executable;
    return state;
  });
  return true;
});
handle('provider:launch', async (id) => {
  providerId(id);
  const provider = (await detectLaunchers(store.snapshot().launchers)).find((p) => p.id === id);
  if (!provider.installed) throw new Error(`Selecciona primero la ubicación de ${provider.name}.`);
  return launchOfficial(provider.executable);
});
handle('provider:docs', async (id) => {
  providerId(id);
  await shell.openExternal(PROVIDERS[id].docs);
});
handle('handoff:preview', (id, target, options) =>
  buildHandoff(projectFrom(store.snapshot(), id), target, handoffOptions(options)),
);
handle('handoff:open', async (id, target, options) => {
  const contents = buildHandoff(projectFrom(store.snapshot(), id), target, handoffOptions(options));
  const provider = (await detectLaunchers(store.snapshot().launchers)).find((p) => p.id === target);
  if (!provider.installed) throw new Error(`Selecciona primero la ubicación de ${provider.name}.`);
  return copyAndOpen({
    content: contents,
    copy: (value) => clipboard.writeText(value),
    record: () => update(id, (p) => recordHandoff(p, target, 'copied')),
    launch: () => launchOfficial(provider.executable),
  });
});
handle('handoff:copy', async (id, target, options) => {
  const contents = buildHandoff(projectFrom(store.snapshot(), id), target, handoffOptions(options));
  clipboard.writeText(contents);
  await update(id, (p) => recordHandoff(p, target, 'copied'));
});
handle('handoff:export', async (id, target, options) => {
  const p = projectFrom(store.snapshot(), id);
  const contents = buildHandoff(p, target, handoffOptions(options));
  const saved = await saveFile(`${filename(p.name)}-${target}.md`, contents, [
    { name: 'Markdown', extensions: ['md'] },
  ]);
  if (saved) await update(id, (p) => recordHandoff(p, target, 'exported'));
  return saved;
});
handle('project:export', async (id) => {
  const p = projectFrom(store.snapshot(), id);
  return saveFile(`${filename(p.name)}.plm.json`, JSON.stringify(exportProject(p), null, 2), [
    { name: 'Proyecto PLM', extensions: ['json'] },
  ]);
});
handle('project:import', async () => {
  const result = await dialog.showOpenDialog(window, {
    properties: ['openFile'],
    filters: [{ name: 'Proyecto PLM', extensions: ['json'] }],
  });
  if (result.canceled) return null;
  if ((await stat(result.filePaths[0])).size > MAX_BYTES)
    throw new Error('El archivo supera 8 MB.');
  const project = importProject(await readFile(result.filePaths[0], 'utf8'));
  await store.mutate((state) => {
    state.projects.push(project);
    return state;
  });
  return project;
});
handle('context:request', () => CONTEXT_REQUEST);
handle('context:copy-request', () => {
  clipboard.writeText(CONTEXT_REQUEST);
});
function contextVersion(p) {
  return JSON.stringify([p.goal, p.decisions, p.nextSteps, p.importedContext, p.preferredModel]);
}
function stageContext(raw, filename, targetId) {
  const context = contextText(raw);
  const project = targetId ? projectFrom(store.snapshot(), targetId) : null;
  const name =
    project?.name ||
    context.content
      .match(/^#\s+(.+)$/m)?.[1]
      ?.trim()
      .slice(0, 120) ||
    'Conversación importada';
  const token = randomUUID();
  pendingContexts.clear();
  pendingContexts.set(token, {
    content: context.content,
    targetId: project?.id,
    version: project ? contextVersion(project) : null,
  });
  return {
    token,
    name,
    filename,
    targetId: project?.id,
    model: project?.preferredModel,
    ...context,
  };
}
handle('context:stage', (input) =>
  stageContext(input?.content, 'Contexto pegado', input?.targetId),
);
handle('context:paste', (targetId) => {
  const raw = clipboard.readText();
  if (!raw.trim()) return null;
  if (raw.trim() === CONTEXT_REQUEST.trim())
    throw new Error(
      'El portapapeles tiene la petición, no el resumen. Pégala en tu chat y copia la respuesta de la IA.',
    );
  return stageContext(raw, 'Resumen del portapapeles', targetId || null);
});
handle('context:choose', async (targetId) => {
  // Capture the target before the user opens the native picker.
  const target = targetId ? projectFrom(store.snapshot(), targetId) : null;
  const result = await dialog.showOpenDialog(window, {
    title: 'Añadir plm.md de contexto',
    properties: ['openFile'],
    filters: [{ name: 'Contexto Markdown (plm.md)', extensions: ['md'] }],
  });
  if (result.canceled) return null;
  const file = result.filePaths[0];
  if (path.extname(file).toLowerCase() !== '.md')
    throw new Error('Selecciona un archivo Markdown, como plm.md.');
  if ((await stat(file)).size > 400_000)
    throw new Error('El archivo es demasiado grande. Pide un resumen de hasta 500 líneas.');
  let raw;
  try {
    raw = new TextDecoder('utf-8', { fatal: true }).decode(await readFile(file));
  } catch {
    throw new Error('Guarda plm.md como texto UTF-8 y vuelve a añadirlo.');
  }
  const staged = stageContext(raw, path.basename(file), target?.id);
  if (target) pendingContexts.get(staged.token).version = contextVersion(target);
  return staged;
});
handle('context:discard', (token) => {
  pendingContexts.delete(token);
});
handle('context:import', async (input) => {
  const staged = pendingContexts.get(input?.token);
  if (!staged) throw new Error('Vuelve a añadir el contexto.');
  const { content, targetId } = staged;
  const model = modelById(input.model);
  if (targetId) {
    let project;
    await update(targetId, (p) => {
      if (contextVersion(p) !== staged.version)
        throw new Error(
          'El contexto ha cambiado desde que lo añadiste. Cierra esta vista y vuelve a añadirlo para revisar la versión actual.',
        );
      project = reviseContext(p, { importedContext: content, preferredModel: model.id });
      return project;
    });
    pendingContexts.delete(input.token);
    return project;
  }
  const project = {
    ...createProject({
      name: input.name,
      goal: '',
    }),
    importedContext: content,
    preferredModel: model.id,
  };
  await store.mutate((state) => {
    state.projects.push(project);
    return state;
  });
  pendingContexts.delete(input.token);
  return project;
});
handle('project:model', async (id, modelId) => {
  const model = modelById(modelId);
  await update(id, (p) => ({
    ...p,
    preferredModel: model.id,
    updatedAt: new Date().toISOString(),
  }));
});

function createWindow() {
  window = new BrowserWindow({
    width: 1440,
    height: 950,
    minWidth: 480,
    minHeight: 420,
    title: 'PLM — poors LLM',
    backgroundColor: '#111413',
    show: true,
    webPreferences: {
      preload: path.join(root, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  window.webContents.on('will-attach-webview', (event) => event.preventDefault());
  window.webContents.on('render-process-gone', (_event, details) => {
    if (details.reason !== 'clean-exit')
      startupFailed(new Error(`La interfaz se ha detenido (${details.reason}).`));
  });
  loaded = false;
  window.loadURL(indexUrl).then(presentWindow).catch(startupFailed);
}
if (!app.requestSingleInstanceLock({ launchId: process.env.PLM_LAUNCH_ID || '' })) app.quit();
else {
  app.on('second-instance', (_event, _argv, _cwd, data) => {
    if (/^[a-f0-9-]{36}$/.test(data?.launchId || '')) pendingLaunches.add(data.launchId);
    presentWindow();
    if (loaded) void acknowledgeLaunch().catch(startupFailed);
  });
  app
    .whenReady()
    .then(async () => {
      try {
        await store.load();
      } catch (error) {
        startupFailed(error);
        return;
      }
      session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) =>
        callback(false),
      );
      session.defaultSession.setPermissionCheckHandler(() => false);
      session.defaultSession.webRequest.onBeforeRequest((details, callback) =>
        callback({
          cancel: !details.url.startsWith('file://') && !details.url.startsWith('devtools://'),
        }),
      );
      Menu.setApplicationMenu(
        Menu.buildFromTemplate([
          ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
          {
            label: 'Edición',
            submenu: [
              { role: 'undo' },
              { role: 'redo' },
              { type: 'separator' },
              { role: 'cut' },
              { role: 'copy' },
              { role: 'paste' },
              { role: 'selectAll' },
            ],
          },
          {
            label: 'Ventana',
            submenu: [
              { role: 'reload' },
              { role: 'togglefullscreen' },
              { role: 'minimize' },
              { role: 'close' },
            ],
          },
        ]),
      );
      createWindow();
      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
      });
    })
    .catch(startupFailed);
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
