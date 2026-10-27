import { spawn } from 'node:child_process';
import { access, stat, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

function percentage(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100
    ? value
    : null;
}
function epoch(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value < 253402300800
    ? value
    : null;
}
function safeLabel(value, fallback) {
  return typeof value === 'string' && value.length <= 120 && !/[\x00-\x1f]/.test(value)
    ? value
    : fallback;
}
function windowData(id, label, used, resetsAt, durationMins = null) {
  const usedPercent = percentage(used);
  return {
    id,
    label,
    usedPercent,
    remainingPercent: usedPercent === null ? null : 100 - usedPercent,
    resetsAt: epoch(resetsAt),
    durationMins:
      typeof durationMins === 'number' && durationMins > 0 && Number.isFinite(durationMins)
        ? durationMins
        : null,
  };
}
export function normalizeCodexUsage(data, at = new Date().toISOString()) {
  const buckets =
    data?.rateLimitsByLimitId && Object.keys(data.rateLimitsByLimitId).length
      ? data.rateLimitsByLimitId
      : { codex: data?.rateLimits };
  const windows = [];
  let plan = null;
  for (const [id, bucket] of Object.entries(buckets || {}).slice(0, 20)) {
    if (!bucket || typeof bucket !== 'object') continue;
    plan ??= safeLabel(bucket.planType, null);
    for (const key of ['primary', 'secondary']) {
      const w = bucket[key];
      if (!w) continue;
      const label =
        w.windowDurationMins === 300
          ? '5 horas'
          : w.windowDurationMins === 10080
            ? 'Semanal'
            : w.windowDurationMins
              ? `${w.windowDurationMins} minutos`
              : key === 'primary'
                ? 'Ventana principal'
                : 'Ventana secundaria';
      windows.push(
        windowData(
          `${safeLabel(id, 'codex')}-${key}`,
          Object.keys(buckets).length > 1 ? `${safeLabel(bucket.limitName, id)} · ${label}` : label,
          w.usedPercent,
          w.resetsAt,
          w.windowDurationMins,
        ),
      );
    }
  }
  return {
    provider: 'codex',
    source: 'Codex app-server · consulta oficial',
    plan,
    updatedAt: at,
    windows,
  };
}
export function normalizeStatusUsage(provider, data, at = new Date().toISOString()) {
  if (!['claude', 'antigravity'].includes(provider)) throw new Error('Proveedor de uso no válido.');
  const windows = [];
  if (provider === 'claude') {
    for (const [key, label, minutes] of [
      ['five_hour', '5 horas', 300],
      ['seven_day', 'Semanal', 10080],
    ]) {
      const item = data?.rate_limits?.[key];
      if (item) windows.push(windowData(key, label, item.used_percentage, item.resets_at, minutes));
    }
  } else {
    for (const [id, item] of Object.entries(data?.quota || {}).slice(0, 20)) {
      if (!item || typeof item !== 'object') continue;
      const fraction =
        typeof item.remaining_fraction === 'number' &&
        item.remaining_fraction >= 0 &&
        item.remaining_fraction <= 1
          ? item.remaining_fraction
          : null;
      const reset = typeof item.reset_time === 'string' ? Date.parse(item.reset_time) / 1000 : null;
      const w = windowData(
        safeLabel(id, 'cuota'),
        safeLabel(id, 'Cuota'),
        fraction === null ? null : (1 - fraction) * 100,
        reset,
      );
      if (
        typeof item.remaining_amount === 'number' &&
        Number.isFinite(item.remaining_amount) &&
        item.remaining_amount >= 0
      )
        w.remainingAmount = item.remaining_amount;
      w.disabled = item.disabled === true;
      windows.push(w);
    }
  }
  return {
    provider,
    source:
      provider === 'claude'
        ? 'Claude Code · statusLine oficial'
        : 'Antigravity CLI · statusLine oficial',
    plan: provider === 'antigravity' ? safeLabel(data?.plan_tier, null) : null,
    updatedAt: at,
    windows,
  };
}
export function usageState(snapshot, now = Date.now()) {
  const updated = Date.parse(snapshot?.updatedAt);
  if (!Number.isFinite(updated) || updated > now + 60_000)
    return { available: false, stale: true, windows: [] };
  const windows = (snapshot.windows || []).map((w) => ({
    ...w,
    expired: w.resetsAt !== null && w.resetsAt * 1000 <= now,
  }));
  return {
    available: windows.some(
      (w) => !w.expired && !w.disabled && (w.usedPercent !== null || w.remainingAmount != null),
    ),
    stale: now - updated > 5 * 60_000,
    windows,
  };
}
export async function findCodexCli({ platform = process.platform, env = process.env } = {}) {
  const paths = platform === 'win32' ? path.win32 : path.posix;
  const home = env.HOME || env.USERPROFILE || '';
  const names = platform === 'win32' ? ['codex.exe'] : ['codex'];
  const dirs = [
    ...(env.PATH || '').split(paths.delimiter),
    paths.join(home, '.local', 'bin'),
  ].filter((d) => paths.isAbsolute(d));
  const candidates = dirs.flatMap((d) => names.map((n) => paths.join(d, n)));
  if (platform === 'darwin')
    candidates.push(
      '/Applications/Codex.app/Contents/Resources/codex',
      '/Applications/ChatGPT.app/Contents/Resources/codex',
    );
  if (platform === 'linux')
    candidates.push(
      paths.join(home, '.local/share/codex-desktop/app/usr/lib/chatgpt/resources/codex'),
    );
  if (platform === 'win32' && env.LOCALAPPDATA)
    candidates.push(paths.join(env.LOCALAPPDATA, 'Programs', 'Codex', 'resources', 'codex.exe'));
  for (const file of [...new Set(candidates)]) {
    try {
      if (!(await stat(file)).isFile()) continue;
      await access(file, platform === 'win32' ? constants.F_OK : constants.X_OK);
      return file;
    } catch {}
  }
  return null;
}
// Only these two read-only protocol operations are sent. Never request a login,
// list conversations, create a turn, consume reset credits, or accept external tokens.
export function readCodexUsage(
  executable,
  { timeoutMs = 15_000, spawnProcess = spawn, cwd = os.tmpdir() } = {},
) {
  return new Promise((resolve, reject) => {
    let child;
    let buffer = '';
    let size = 0;
    let initialized = false;
    let settled = false;
    let killTimer;
    const timer = setTimeout(
      () => finish(new Error('Codex no respondió a la consulta de uso a tiempo.')),
      timeoutMs,
    );
    function finish(error, result) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (child) {
        child.stdin.end();
        child.kill();
        killTimer = setTimeout(() => {
          if (child.exitCode === null) child.kill('SIGKILL');
        }, 1000);
        killTimer.unref();
      }
      if (error) reject(error);
      else resolve(normalizeCodexUsage(result));
    }
    const send = (message) => {
      if (!settled) child.stdin.write(JSON.stringify(message) + '\n');
    };
    try {
      child = spawnProcess(executable, ['app-server', '--listen', 'stdio://'], {
        stdio: ['pipe', 'pipe', 'ignore'],
        shell: false,
        windowsHide: true,
        cwd,
      });
      child.once('error', () =>
        finish(new Error('No se pudo iniciar el lector oficial de Codex.')),
      );
      child.stdin.on('error', () => finish(new Error('Se cerró la conexión con Codex.')));
      child.once('exit', () => {
        clearTimeout(killTimer);
        if (!settled) finish(new Error('Codex terminó sin devolver el uso.'));
      });
      child.stdout.on('data', (chunk) => {
        if (settled) return;
        size += chunk.length;
        if (size > 1024 * 1024)
          return finish(new Error('La respuesta de uso de Codex supera el límite admitido.'));
        buffer += chunk.toString('utf8');
        let index;
        while ((index = buffer.indexOf('\n')) >= 0 && !settled) {
          const line = buffer.slice(0, index);
          buffer = buffer.slice(index + 1);
          let msg;
          try {
            msg = JSON.parse(line);
          } catch {
            continue;
          }
          if (msg.id === 0 && !initialized) {
            if (msg.error)
              return finish(new Error('Codex rechazó la conexión para consultar el uso.'));
            if (!msg.result) continue;
            initialized = true;
            send({ method: 'initialized', params: {} });
            send({ id: 1, method: 'account/rateLimits/read' });
          } else if (msg.id === 1 && initialized) {
            if (msg.error)
              return finish(
                new Error(
                  'El uso no está disponible en esta sesión de Codex. Inicia sesión en el cliente oficial y vuelve a actualizar.',
                ),
              );
            return finish(null, msg.result);
          }
        }
      });
      send({
        id: 0,
        method: 'initialize',
        params: {
          clientInfo: { name: 'plm_usage', title: 'PLM subscription usage', version: '0.6.0' },
        },
      });
    } catch {
      finish(new Error('No se pudo iniciar la consulta oficial de Codex.'));
    }
  });
}
export async function readUsageFile(file, provider) {
  try {
    if ((await stat(file)).size > 64_000) throw new Error('Archivo de uso demasiado grande.');
    const data = JSON.parse(await readFile(file, 'utf8'));
    if (
      data.provider !== provider ||
      data.version !== 1 ||
      !Number.isFinite(Date.parse(data.updatedAt))
    )
      throw new Error('Archivo de uso no válido.');
    // Re-normalize the allowlisted telemetry, never trust arbitrary cached UI fields.
    return normalizeStatusUsage(provider, data.data, data.updatedAt);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}
