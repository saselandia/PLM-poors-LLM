import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  connectionPaths,
  installUsageConnection,
  uninstallUsageConnection,
  connectionState,
  collectorLauncher,
} from '../src/core/usage-connection.mjs';
import { readUsageFile } from '../src/core/usage.mjs';

test('conectar conserva preferencias y barra de estado; desconectar la restaura sin pisar cambios posteriores', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'plm-usage-'));
  const options = {
    home: root,
    directory: path.join(root, 'PLM usage'),
    executable: process.execPath,
    collector: fileURLToPath(new URL('../src/core/usage-collector.mjs', import.meta.url)),
  };
  try {
    const paths = connectionPaths('claude', options);
    const before = {
      theme: 'dark',
      statusLine: { type: 'command', command: 'old-statusline', padding: 1 },
      permissions: { deny: ['test'] },
    };
    await mkdir(path.dirname(paths.settings), { recursive: true });
    await writeFile(paths.settings, JSON.stringify(before));
    await installUsageConnection('claude', options);
    const installed = JSON.parse(await readFile(paths.settings, 'utf8'));
    assert.deepEqual(installed.permissions, before.permissions);
    assert.equal(installed.theme, 'dark');
    assert.equal(installed.statusLine.padding, 1);
    assert.equal((await connectionState('claude', options)).installed, true);
    await installUsageConnection('claude', options);
    assert.equal(
      JSON.parse(await readFile(paths.backup, 'utf8')).statusLine.command,
      'old-statusline',
    );
    await uninstallUsageConnection('claude', options);
    assert.deepEqual(JSON.parse(await readFile(paths.settings, 'utf8')), before);
    await installUsageConnection('claude', options);
    const changed = JSON.parse(await readFile(paths.settings, 'utf8'));
    changed.statusLine.command = 'my-new-statusline';
    await writeFile(paths.settings, JSON.stringify(changed));
    await assert.rejects(() => uninstallUsageConnection('claude', options), /no sobrescribe/);
    assert.equal(
      JSON.parse(await readFile(paths.settings, 'utf8')).statusLine.command,
      'my-new-statusline',
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test('el recolector solo persiste cuotas, no chats, email o credenciales; valida al leer y admite ausencia de cuota', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'plm-collector-'));
  try {
    const file = path.join(root, 'usage.json');
    const backup = path.join(root, 'previous.json');
    await writeFile(backup, JSON.stringify({ statusLine: null }));
    const collector = fileURLToPath(new URL('../src/core/usage-collector.mjs', import.meta.url));
    const input = {
      email: 'private@example.com',
      access_token: 'secret',
      transcript_path: '/private',
      context_window: { used_percentage: 99 },
      rate_limits: { five_hour: { used_percentage: 30, resets_at: Date.now() / 1000 + 3600 } },
    };
    const result = spawnSync(process.execPath, [collector, 'claude', file, backup], {
      input: JSON.stringify(input),
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    const raw = await readFile(file, 'utf8');
    assert.ok(
      !raw.includes('secret') && !raw.includes('private') && !raw.includes('context_window'),
    );
    assert.equal((await readUsageFile(file, 'claude')).windows[0].usedPercent, 30);
    const empty = spawnSync(process.execPath, [collector, 'claude', file, backup], {
      input: '{}',
      encoding: 'utf8',
    });
    assert.equal(empty.status, 0);
    assert.deepEqual((await readUsageFile(file, 'claude')).windows, []);
    await writeFile(backup, JSON.stringify({ statusLine: { command: 'echo existing-status' } }));
    const ag = spawnSync(process.execPath, [collector, 'antigravity', file, backup], {
      input: JSON.stringify({
        email: 'private@example.com',
        plan_tier: 'Pro',
        quota: {
          gemini: {
            remaining_fraction: 0.75,
            reset_time: new Date(Date.now() + 3600000).toISOString(),
          },
          off: { remaining_fraction: 0, disabled: true },
        },
      }),
      encoding: 'utf8',
    });
    assert.equal(ag.status, 0, ag.stderr);
    assert.equal(ag.stdout.trim(), 'existing-status');
    const agUsage = await readUsageFile(file, 'antigravity');
    assert.equal(agUsage.windows[0].usedPercent, 25);
    assert.equal(agUsage.windows[0].remainingPercent, 75);
    assert.equal(agUsage.windows[1].disabled, true);
    assert.ok(!(await readFile(file, 'utf8')).includes('private'));
    await writeFile(file, JSON.stringify({ version: 99, provider: 'claude' }));
    await assert.rejects(() => readUsageFile(file, 'claude'), /no válido/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test('los scripts de conexión citan rutas con espacios y rechazan inyecciones en las rutas', () => {
  const sh = collectorLauncher(
    '/my app/plm',
    "/my app/a'b.mjs",
    'claude',
    '/data/usage.json',
    '/data/old.json',
    'linux',
  );
  assert.ok(sh.includes("'\\''"));
  assert.ok(sh.includes('ELECTRON_RUN_AS_NODE=1 exec'));
  const cmd = collectorLauncher(
    'C:\\My App\\plm.exe',
    'C:\\App\\collector.mjs',
    'claude',
    'C:\\data\\usage.json',
    'C:\\data\\old.json',
    'win32',
  );
  assert.ok(cmd.includes('"C:\\My App\\plm.exe"'));
  assert.throws(() => collectorLauncher('/tmp/a\ncommand', '/x', 'claude', '/y', '/z'));
  assert.throws(() =>
    collectorLauncher('C:\\%PATH%\\x.exe', 'C:\\x', 'claude', 'C:\\y', 'C:\\z', 'win32'),
  );
});
