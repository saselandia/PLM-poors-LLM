import { packager } from '@electron/packager';

const targetPlatform = process.argv[2] || process.platform;
const targetArch = process.argv[3] || process.arch;
if (
  !['linux', 'darwin', 'win32'].includes(targetPlatform) ||
  !['x64', 'arm64'].includes(targetArch)
)
  throw new Error('Uso: pnpm package [linux|darwin|win32] [x64|arm64]');
const outputs = await packager({
  dir: '.',
  name: 'PLM',
  appVersion: '0.1.0',
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
console.log(outputs.join('\n'));
