import { access, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { providerId, PROVIDERS } from './model.mjs';

const names = {
  codex: {
    linux: ['codex-desktop'],
    darwin: ['Codex.app', 'ChatGPT.app'],
    win32: ['Codex/Codex.exe', 'Programs/Codex/Codex.exe', 'Programs/ChatGPT/ChatGPT.exe'],
  },
  claude: {
    linux: ['claude-desktop'],
    darwin: ['Claude.app'],
    win32: ['AnthropicClaude/Claude.exe', 'Programs/Claude/Claude.exe', 'Claude/Claude.exe'],
  },
  antigravity: {
    linux: ['antigravity'],
    darwin: ['Antigravity.app'],
    win32: ['Programs/Antigravity/Antigravity.exe', 'Antigravity/Antigravity.exe'],
  },
};
export function candidates(provider, platform = process.platform, env = process.env) {
  providerId(provider);
  const home = env.HOME || env.USERPROFILE || '';
  if (platform === 'darwin')
    return ['/Applications', path.join(home, 'Applications')].flatMap((root) =>
      names[provider].darwin.map((n) => path.join(root, n)),
    );
  if (platform === 'win32')
    return [env.LOCALAPPDATA, env.ProgramFiles, env['ProgramFiles(x86)']]
      .filter(Boolean)
      .flatMap((root) => names[provider].win32.map((n) => path.win32.join(root, n)));
  if (platform === 'linux')
    return [
      ...new Set(
        [
          ...(env.PATH || '').split(path.delimiter),
          path.join(home, '.local/bin'),
          '/usr/bin',
          '/usr/local/bin',
        ].filter((p) => path.isAbsolute(p)),
      ),
    ].flatMap((root) => names[provider].linux.map((n) => path.join(root, n)));
  return [];
}
export async function isLauncher(file, platform = process.platform) {
  if (typeof file !== 'string' || !path.isAbsolute(file) || file.includes('\0')) return false;
  try {
    const info = await stat(file);
    if (platform === 'darwin' && file.endsWith('.app')) return info.isDirectory();
    if (!info.isFile()) return false;
    if (platform === 'win32') return file.toLowerCase().endsWith('.exe');
    await access(file, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
export async function detectLaunchers(overrides = {}) {
  const result = [];
  for (const [id, provider] of Object.entries(PROVIDERS)) {
    let executable = null;
    for (const candidate of overrides[id] ? [overrides[id], ...candidates(id)] : candidates(id)) {
      if (await isLauncher(candidate)) {
        executable = candidate;
        break;
      }
    }
    result.push({ id, ...provider, installed: Boolean(executable), executable });
  }
  return result;
}
export function launchSpec(executable, platform = process.platform) {
  if (typeof executable !== 'string' || !path.isAbsolute(executable) || executable.includes('\0'))
    throw new Error('Ruta de aplicación no válida.');
  if (platform === 'darwin' && executable.endsWith('.app'))
    return { command: '/usr/bin/open', args: ['-a', executable] };
  return { command: executable, args: [] };
}
export async function launchOfficial(executable) {
  if (!(await isLauncher(executable)))
    throw new Error('La aplicación ya no está disponible. Selecciona su ubicación.');
  const { command, args } = launchSpec(executable);
  // Launch the original UI without a prompt, token, headless flag, or shell.
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: 'ignore',
      shell: false,
      windowsHide: false,
    });
    child.once('error', reject);
    child.once('spawn', () => {
      child.unref();
      resolve({ started: true });
    });
  });
}
