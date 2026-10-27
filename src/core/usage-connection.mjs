import { mkdir, readFile, writeFile, rename, stat, lstat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export function connectionPaths(provider, { home, directory, platform = process.platform }) {
  if (!['claude', 'antigravity'].includes(provider)) throw new Error('Conexión de uso no válida.');
  const ext = platform === 'win32' ? 'cmd' : 'sh';
  return {
    settings:
      provider === 'claude'
        ? path.join(home, '.claude', 'settings.json')
        : path.join(home, '.gemini', 'antigravity-cli', 'settings.json'),
    backup: path.join(directory, `${provider}-statusline-backup.json`),
    launcher: path.join(directory, `${provider}-statusline.${ext}`),
    data: path.join(directory, `${provider}-usage.json`),
  };
}
const posixQuote = (value) => "'" + value.replace(/'/g, "'\\''") + "'";
export function collectorLauncher(
  executable,
  collector,
  provider,
  data,
  backup,
  platform = process.platform,
) {
  const args = [executable, collector, provider, data, backup];
  if (args.some((v) => typeof v !== 'string' || /[\r\n\0]/.test(v)))
    throw new Error('Ruta de conexión no válida.');
  if (platform === 'win32') {
    if (args.some((v) => /["%]/.test(v)))
      throw new Error('Esta ruta no admite la conexión de uso en Windows.');
    return (
      '@echo off\r\nset ELECTRON_RUN_AS_NODE=1\r\n' +
      args.map((v) => '"' + v + '"').join(' ') +
      '\r\n'
    );
  }
  return '#!/bin/sh\nELECTRON_RUN_AS_NODE=1 exec ' + args.map(posixQuote).join(' ') + '\n';
}
async function settingsText(file) {
  try {
    const info = await lstat(file);
    if (info.isSymbolicLink())
      throw new Error(
        'El archivo de configuración es un enlace. Configura la conexión de uso manualmente para conservarlo.',
      );
    if (info.size > 1024 * 1024) throw new Error('La configuración es demasiado grande.');
    return await readFile(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}
async function atomic(file, content, mode = 0o600) {
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const tmp = `${file}.${randomUUID()}.tmp`;
  try {
    await writeFile(tmp, content, { flag: 'wx', mode });
    await rename(tmp, file);
  } finally {
    await unlink(tmp).catch(() => {});
  }
}
function launcherCommand(file, platform) {
  if (platform === 'win32') {
    if (/["%\r\n]/.test(file)) throw new Error('Ruta de conexión no válida.');
    return '"' + file + '"';
  }
  return posixQuote(file);
}
export async function connectionState(provider, options) {
  const files = connectionPaths(provider, options);
  try {
    const config = JSON.parse((await settingsText(files.settings)) || '{}');
    const installed =
      config.statusLine?.command ===
      launcherCommand(files.launcher, options.platform || process.platform);
    return { installed, settingsFile: files.settings };
  } catch {
    return { installed: false, settingsFile: files.settings };
  }
}
export async function installUsageConnection(provider, options) {
  const platform = options.platform || process.platform;
  const files = connectionPaths(provider, options);
  const original = await settingsText(files.settings);
  const config = JSON.parse(original || '{}');
  if (!config || typeof config !== 'object' || Array.isArray(config))
    throw new Error('La configuración no contiene un objeto JSON válido.');
  const command = launcherCommand(files.launcher, platform);
  const alreadyInstalled = config.statusLine?.command === command;
  if (!alreadyInstalled) {
    await atomic(
      files.backup,
      JSON.stringify(
        {
          version: 1,
          provider,
          statusLinePresent: Object.hasOwn(config, 'statusLine'),
          statusLine: config.statusLine ?? null,
          installedCommand: command,
        },
        null,
        2,
      ),
    );
  } else {
    try {
      await stat(files.backup);
    } catch {
      throw new Error('Falta la copia de la configuración anterior. No se ha modificado.');
    }
  }
  await atomic(
    files.launcher,
    collectorLauncher(
      options.executable,
      options.collector,
      provider,
      files.data,
      files.backup,
      platform,
    ),
    0o700,
  );
  if ((await settingsText(files.settings)) !== original)
    throw new Error('La configuración ha cambiado durante la conexión. Vuelve a intentarlo.');
  config.statusLine = {
    ...(config.statusLine && typeof config.statusLine === 'object' ? config.statusLine : {}),
    type: 'command',
    command,
  };
  if (provider === 'antigravity') config.statusLine = { ...config.statusLine, enabled: true };
  await atomic(files.settings, JSON.stringify(config, null, 2) + '\n');
  return { installed: true, settingsFile: files.settings };
}
export async function uninstallUsageConnection(provider, options) {
  const files = connectionPaths(provider, options);
  const original = await settingsText(files.settings);
  const config = JSON.parse(original || '{}');
  const command = launcherCommand(files.launcher, options.platform || process.platform);
  if (config.statusLine?.command !== command)
    throw new Error('La configuración ha cambiado. PLM no sobrescribe tu nueva barra de estado.');
  const backup = JSON.parse(await readFile(files.backup, 'utf8'));
  if (backup.provider !== provider || backup.installedCommand !== command)
    throw new Error('La copia de la conexión no es válida.');
  if (backup.statusLinePresent) config.statusLine = backup.statusLine;
  else delete config.statusLine;
  if ((await settingsText(files.settings)) !== original)
    throw new Error('La configuración ha cambiado durante la desconexión.');
  await atomic(files.settings, JSON.stringify(config, null, 2) + '\n');
  return { installed: false, settingsFile: files.settings };
}
