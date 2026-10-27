import { test } from 'node:test';
import assert from 'node:assert/strict';
import { candidates, launchSpec, isLauncher } from '../src/core/launchers.mjs';

test('solo detecta superficies de escritorio: nunca usa el agente CLI de Codex o Claude', () => {
  const env = { HOME: '/home/test', PATH: '/usr/bin::.:/safe/bin' };
  assert.ok(candidates('codex', 'linux', env).every((file) => file.endsWith('/codex-desktop')));
  assert.ok(candidates('claude', 'linux', env).every((file) => file.endsWith('/claude-desktop')));
  assert.ok(!candidates('codex', 'linux', env).some((file) => file.startsWith('./')));
});
test('las rutas con espacios y metacaracteres son argumentos, nunca órdenes de shell', () => {
  const file = '/Applications/A name; echo danger.app';
  assert.deepEqual(launchSpec(file, 'darwin'), { command: '/usr/bin/open', args: ['-a', file] });
  assert.deepEqual(launchSpec('/tmp/app $(not-a-command)', 'linux'), {
    command: '/tmp/app $(not-a-command)',
    args: [],
  });
  assert.throws(() => launchSpec('--headless'));
});
test('las rutas candidatas de Windows y macOS usan los directorios de instalación', () => {
  assert.ok(
    candidates('claude', 'win32', { LOCALAPPDATA: 'C:\\Users\\test\\AppData\\Local' }).includes(
      'C:\\Users\\test\\AppData\\Local\\Programs\\Claude\\Claude.exe',
    ),
  );
  assert.ok(
    candidates('antigravity', 'darwin', { HOME: '/Users/test' }).includes(
      '/Applications/Antigravity.app',
    ),
  );
});
test('una carpeta, un archivo relativo o un ejecutable ausente no es un lanzador', async () => {
  assert.equal(await isLauncher('/tmp'), false);
  assert.equal(await isLauncher('relative-program'), false);
  assert.equal(await isLauncher('/nonexistent/plm-test-binary'), false);
});
