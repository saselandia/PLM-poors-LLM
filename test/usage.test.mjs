import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import {
  normalizeCodexUsage,
  normalizeStatusUsage,
  usageState,
  readCodexUsage,
} from '../src/core/usage.mjs';

const at = '2026-10-27T08:00:00Z';
const now = Date.parse(at);
const reset = now / 1000 + 3600;
test('el uso es cuota de suscripción: porcentajes reales, nulos desconocidos y múltiples límites sin datos personales', () => {
  const data = {
    accountId: 'private',
    rateLimits: { primary: { usedPercent: 99 } },
    rateLimitsByLimitId: {
      codex: {
        planType: 'plus',
        primary: { usedPercent: 81, windowDurationMins: 300, resetsAt: reset },
        secondary: { usedPercent: 0, windowDurationMins: 10080, resetsAt: reset },
      },
      other: { primary: { usedPercent: null, resetsAt: null } },
    },
  };
  const usage = normalizeCodexUsage(data, at);
  assert.equal(usage.windows[0].usedPercent, 81);
  assert.equal(usage.windows[0].remainingPercent, 19);
  assert.equal(usage.windows[1].usedPercent, 0);
  assert.equal(usage.windows[1].remainingPercent, 100);
  assert.equal(usage.windows[2].usedPercent, null);
  assert.equal(usage.windows[2].remainingPercent, null);
  assert.equal(usage.accountId, undefined);
  assert.equal(usage.plan, 'plus');
  assert.equal(usageState(usage, now).available, true);
  assert.equal(usageState(usage, now + 3600_001).available, false);
  assert.equal(usageState(usage, now + 3600_001).windows[0].usedPercent, 81);
  assert.equal(usageState(usage, now + 3600_001).windows[0].expired, true);
  assert.equal(usageState(null, now).available, false);
  assert.equal(usageState(usage, now + 301_000).stale, true);
});
test('las exportaciones oficiales de Claude y Antigravity no confunden contexto con cuota', () => {
  const claude = normalizeStatusUsage(
    'claude',
    {
      context_window: { used_percentage: 99 },
      email: 'private',
      rate_limits: {
        five_hour: { used_percentage: 23.5, resets_at: reset },
        seven_day: { used_percentage: null },
      },
    },
    at,
  );
  assert.equal(claude.windows[0].usedPercent, 23.5);
  assert.equal(claude.windows[1].usedPercent, null);
  assert.equal(claude.email, undefined);
  assert.deepEqual(
    normalizeStatusUsage('claude', { context_window: { used_percentage: 99 } }, at).windows,
    [],
  );
  const ag = normalizeStatusUsage(
    'antigravity',
    {
      quota: {
        gemini: { remaining_fraction: 0.75, reset_time: new Date(reset * 1000).toISOString() },
        credits: { remaining_amount: 12 },
        invalid: { remaining_fraction: 4 },
      },
      plan_tier: 'Pro',
    },
    at,
  );
  assert.equal(ag.windows[0].usedPercent, 25);
  assert.equal(ag.windows[0].remainingPercent, 75);
  assert.equal(ag.windows[1].usedPercent, null);
  assert.equal(ag.windows[1].remainingAmount, 12);
  assert.equal(ag.windows[2].usedPercent, null);
  assert.throws(() => normalizeStatusUsage('unknown', {}));
});
function fakeServer(reply = true) {
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stdin = new PassThrough();
  child.exitCode = null;
  child.killed = false;
  const calls = [];
  child.kill = () => {
    child.killed = true;
    child.exitCode = 0;
    queueMicrotask(() => child.emit('exit', 0));
    return true;
  };
  child.stdin.on('data', (chunk) => {
    for (const line of chunk.toString().trim().split('\n')) {
      const message = JSON.parse(line);
      calls.push(message);
      if (reply && message.method === 'initialize')
        queueMicrotask(() =>
          child.stdout.write(JSON.stringify({ id: 0, result: { userAgent: 'test' } }) + '\n'),
        );
      if (reply && message.method === 'account/rateLimits/read')
        queueMicrotask(() =>
          child.stdout.write(
            JSON.stringify({
              id: 1,
              result: {
                rateLimits: {
                  primary: { usedPercent: 12, windowDurationMins: 300, resetsAt: reset },
                },
              },
            }) + '\n',
          ),
        );
    }
  });
  return { child, calls };
}
test('la consulta de Codex solo inicializa y lee límites; cierra el proceso, sin inferencia, login ni reset', async () => {
  const { child, calls } = fakeServer();
  const usage = await readCodexUsage('/official/codex', {
    spawnProcess: (file, args, options) => {
      assert.equal(file, '/official/codex');
      assert.deepEqual(args, ['app-server', '--listen', 'stdio://']);
      assert.equal(options.shell, false);
      return child;
    },
  });
  assert.equal(usage.windows[0].usedPercent, 12);
  assert.deepEqual(
    calls.map((c) => c.method),
    ['initialize', 'initialized', 'account/rateLimits/read'],
  );
  assert.equal(calls[0].params.clientInfo.name, 'plm_usage');
  assert.equal(child.killed, true);
});
test('el lector de cuotas termina ante un proceso bloqueado o respuesta desmedida', async () => {
  const blocked = fakeServer(false);
  await assert.rejects(
    () => readCodexUsage('/official/codex', { timeoutMs: 15, spawnProcess: () => blocked.child }),
    /a tiempo/,
  );
  assert.equal(blocked.child.killed, true);
  const oversized = fakeServer(false);
  const promise = readCodexUsage('/official/codex', { spawnProcess: () => oversized.child });
  oversized.child.stdout.write('x'.repeat(1024 * 1024 + 1));
  await assert.rejects(() => promise, /límite admitido/);
  assert.equal(oversized.child.killed, true);
});
