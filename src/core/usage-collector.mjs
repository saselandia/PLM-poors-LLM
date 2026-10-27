// Executed only by the provider's documented statusLine extension point.
import { mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { normalizeStatusUsage } from './usage.mjs';

const [provider, destination, backupFile] = process.argv.slice(2);
if (!['claude', 'antigravity'].includes(provider) || !path.isAbsolute(destination || ''))
  process.exit(1);
let raw = '';
for await (const chunk of process.stdin) {
  raw += chunk;
  if (Buffer.byteLength(raw) > 2 * 1024 * 1024) process.exit(1);
}
let input;
try {
  input = JSON.parse(raw);
} catch {
  process.exit(1);
}
const snapshot = normalizeStatusUsage(provider, input);
// Persist only quotas. Discard email, session IDs, transcript paths, prompts and
// context-window counts: none of those is the subscription allowance.
const data =
  provider === 'claude'
    ? {
        rate_limits: Object.fromEntries(
          snapshot.windows.map((w) => [
            w.id,
            { used_percentage: w.usedPercent, resets_at: w.resetsAt },
          ]),
        ),
      }
    : {
        plan_tier: snapshot.plan,
        quota: Object.fromEntries(
          snapshot.windows.map((w) => [
            w.id,
            {
              remaining_fraction: w.remainingPercent === null ? null : w.remainingPercent / 100,
              remaining_amount: w.remainingAmount,
              disabled: w.disabled,
              reset_time: w.resetsAt === null ? null : new Date(w.resetsAt * 1000).toISOString(),
            },
          ]),
        ),
      };
let temporary;
try {
  await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
  temporary = `${destination}.${randomUUID()}.tmp`;
  await writeFile(
    temporary,
    JSON.stringify({ version: 1, provider, updatedAt: snapshot.updatedAt, data }),
    { flag: 'wx', mode: 0o600 },
  );
  await rename(temporary, destination);
} catch {
} finally {
  if (temporary) await unlink(temporary).catch(() => {});
}
let previous;
try {
  previous = JSON.parse(await readFile(backupFile, 'utf8')).statusLine?.command;
} catch {}
if (typeof previous === 'string' && previous.trim()) {
  // This is the user's pre-existing statusLine command, run with the same input
  // and shell semantics as the original CLI. Nothing comes from PLM's renderer.
  const result = spawnSync(previous, {
    shell: true,
    input: raw,
    encoding: 'utf8',
    timeout: 1500,
    maxBuffer: 128 * 1024,
    windowsHide: true,
  });
  if (result.stdout) process.stdout.write(result.stdout);
} else {
  console.log(
    snapshot.windows
      .filter((w) => w.usedPercent !== null)
      .map((w) => `${w.label}: ${Math.round(w.usedPercent)}% usado`)
      .join(' · ') || 'PLM · cuota no disponible',
  );
}
