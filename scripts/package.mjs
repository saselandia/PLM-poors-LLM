import { packager } from '@electron/packager';
import { copyFile, chmod, readFile } from 'node:fs/promises';
import path from 'node:path';

const targetPlatform = process.argv[2] || process.platform;
const targetArch = process.argv[3] || process.arch;
const metadata = JSON.parse(await readFile('package.json', 'utf8'));
if (
  !['linux', 'darwin', 'win32'].includes(targetPlatform) ||
  !['x64', 'arm64'].includes(targetArch)
)
  throw new Error('Uso: pnpm package [linux|darwin|win32] [x64|arm64]');
const outputs = await packager({
  dir: '.',
  name: 'PLM',
  appVersion: metadata.version,
  appBundleId: 'dev.plm.desktop',
  executableName: 'plm',
  platform: targetPlatform,
  arch: targetArch,
  out: 'dist',
  overwrite: true,
  prune: false,
  ignore: [
    /^\/node_modules($|\/)/,
    /^\/\.git($|\/)/,
    /^\/\.github($|\/)/,
    /^\/sandbox($|\/)/,
    /^\/test($|\/)/,
    /^\/test-results($|\/)/,
    /^\/scripts($|\/)/,
    /^\/docs($|\/)/,
    /^\/dist($|\/)/,
  ],
  appCategoryType: 'public.app-category.developer-tools',
  win32metadata: { CompanyName: 'PLM', FileDescription: 'PLM — poors LLM', ProductName: 'PLM' },
});
if (targetPlatform === 'linux') {
  for (const output of outputs) {
    const launcher = path.join(output, 'plm-launch');
    await copyFile('scripts/linux-launch.sh', launcher);
    await chmod(launcher, 0o755);
  }
}
console.log(outputs.join('\n'));
