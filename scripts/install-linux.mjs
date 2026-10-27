import { access, mkdir, writeFile, chmod, copyFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

if (process.platform !== 'linux')
  throw new Error('Este acceso de escritorio es específico para Linux.');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = path.join(root, 'dist', `PLM-linux-${process.arch}`);
await access(path.join(directory, 'plm'), constants.X_OK);
const launcher = path.join(directory, 'plm-launch');
await copyFile(path.join(root, 'scripts/linux-launch.sh'), launcher);
await chmod(launcher, 0o755);
const data = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local/share');
const applications = path.join(data, 'applications');
const icons = path.join(data, 'icons/hicolor/scalable/apps');
await mkdir(applications, { recursive: true });
await mkdir(icons, { recursive: true });
await copyFile(path.join(root, 'assets/plm.svg'), path.join(icons, 'dev.plm.desktop.svg'));
// Two levels of escaping: desktop-entry string escaping, then Exec argument quoting.
function execArgument(value) {
  if (/[\r\n=]/.test(value))
    throw new Error(
      'La ruta de instalación contiene caracteres no compatibles con un archivo .desktop.',
    );
  return (
    '"' +
    value
      .replace(/\\/g, '\\\\\\\\')
      .replace(/(["`$])/g, '\\\\$1')
      .replace(/%/g, '%%') +
    '"'
  );
}
const entry = `[Desktop Entry]\nType=Application\nName=PLM\nGenericName=Contexto entre aplicaciones de IA\nComment=poors LLM — conserva el contexto entre tus herramientas\nExec=${execArgument(launcher)}\nIcon=dev.plm.desktop\nTerminal=false\nStartupNotify=true\nStartupWMClass=plm\nCategories=Development;\nKeywords=PLM;LLM;Codex;Claude;Antigravity;\n`;
const destination = path.join(applications, 'dev.plm.desktop');
await writeFile(destination, entry, { mode: 0o644 });
console.log(
  `Acceso instalado: ${destination}\nAbre PLM desde el menú de aplicaciones o con: gtk-launch dev.plm.desktop`,
);
