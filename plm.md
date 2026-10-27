# Contexto para continuar PLM

## Proyecto y ubicación

PLM (poors LLM) es una aplicación de escritorio Electron que ayuda a conservar y trasladar manualmente el contexto de proyectos entre aplicaciones de IA. La versión actual es 0.7.0. Consulta `README.md` para las funciones, límites y documentación completa.

La carpeta del proyecto es `/home/sasel/Projects/Proyecto-plm`. `~/Projects` es un enlace a `/mnt/HDD1TB/Projects`. El 27 de octubre de 2026 se trasladó desde `/home/sasel/ChatGPT/Proyecto-plm`, incluyendo el repositorio, dependencias, compilaciones y archivos ignorados. El acceso de escritorio de Linux se actualizó con `pnpm install:linux`.

## Repositorio

- Remoto: `git@github.com:saselandia/PLM-poors-LLM.git`.
- Rama: `main`.
- Commit anterior al traslado: `a5e57af` (Show subscription quotas through documented read-only integrations).
- Este archivo de contexto se creó después de ese commit. Comprueba `git status` antes de hacer cambios y conserva el trabajo existente.

## Desarrollo y comprobación

- Requisitos: Node.js 24 o superior, pnpm y sesión gráfica para Electron.
- Instalar dependencias: `pnpm install --frozen-lockfile`.
- Ejecutar: `pnpm start`; preparar entorno de pruebas aislado: `pnpm sandbox`.
- Comprobaciones: `pnpm test` y `pnpm check`. Para pruebas de escritorio y arranque existen `pnpm test:desktop` y `pnpm test:launch`.
- Empaquetar: `pnpm package`; instalar o actualizar el acceso de Linux: `pnpm install:linux` (requiere la aplicación empaquetada en `dist`).
- Código principal: `src/`; pruebas: `test/`; utilidades: `scripts/`; documentación adicional: `docs/`.

## Decisiones y límites

PLM organiza contenido local y abre las aplicaciones oficiales; el usuario copia y pega el contexto. No sincroniza automáticamente chats ni hace peticiones de inferencia. Lee el README y los documentos de `docs/` antes de cambiar integraciones o comportamiento. No se han solicitado cambios funcionales adicionales en este traslado.

## Objetivo del producto

Evitar perder el hilo de un proyecto al cambiar entre Codex, Claude Desktop y Antigravity. El usuario guarda un resumen (`plm.md`), elige destino y modelo, pulsa **Copiar contexto y abrir…** y pega él mismo el texto en la aplicación oficial. PLM es organizador local y lanzador; no es un cliente de IA. Interfaz y documentación están en español.

## Flujo de usuario (0.7.0)

1. **Copiar petición**: el usuario la pega en su chat y la IA responde con un `plm.md` (máx. 500 líneas y 100.000 caracteres).
2. **Pegar resumen** (o Ctrl+V en la ventana): PLM lee el portapapeles (`context:paste`), muestra el resumen para revisarlo y lo guarda; sin conversación seleccionada crea una nueva. **Abrir plm.md** hace lo mismo desde archivo. Diez versiones anteriores restaurables.
3. Elegir Codex/Claude/Antigravity: aparece el uso de esa suscripción y el modelo como recordatorio (Low/Mid/High/Frontier).
4. **Copiar contexto y abrir…** copia el documento y abre la app sin argumentos.
5. Uso: Codex se lee con `codex app-server` y funciona aunque se use la app de escritorio. Claude Desktop y la app de Antigravity no publican cuota; solo sus CLI (Claude Code, Antigravity CLI) mediante `statusLine`. El usuario usa las apps de escritorio, por lo que solo verá el uso de Codex.

## Estructura del código

- `src/main.mjs` (proceso principal, IPC con validación de remitente y esquemas), `src/preload.cjs` (API limitada vía contextBridge), `src/renderer/` (`index.html`, `app.js`, `style.css`; sin framework), `src/shared/context.js` (petición copiable, catálogo, constantes compartidas).
- `src/core/`: `store.mjs` (persistencia atómica en `workspace.json`), `model.mjs` (esquema, validación, versiones, importación/exportación JSON `plm-project` v1), `launchers.mjs` (detección y apertura sin shell), `continue.mjs` (copiar y abrir), `start-desktop.mjs` (arranque confirmado), `usage*.mjs` (cuotas y conexiones de statusLine).
- `test/*.test.mjs` con `node --test`; `scripts/` para check, sandbox, demo, empaquetado, instalador Linux y pruebas de escritorio/arranque con Playwright.
- `docs/`: `ARCHITECTURE.md`, `LEGAL.md`, `MODELS.md`, `ROADMAP.md`, `VERIFICATION.md`.

## Datos y seguridad (invariantes)

- Dependencias de producción: ninguna; solo devDependencies (Electron 45, @electron/packager, Playwright, Prettier). ESM (`"type": "module"`), salvo el preload en CommonJS.
- El renderer no tiene Node, disco ni red. Se bloquean navegación, ventanas extra, webviews y permisos web. No ejecutar Electron como root ni desactivar su sandbox.
- Datos en `userData/workspace.json` en texto claro (0600/0700 en POSIX); `PLM_DATA_DIR` fuerza un perfil separado. Límites: 100 proyectos, 8 MB por espacio, 2.000 mensajes/traspasos por proyecto.
- Compatibilidad hacia atrás: los campos y proyectos antiguos se conservan (registro manual retirado pero conservado como "textos guardados", excluidos por defecto de los traspasos).
- No se leen chats, tokens ni cookies de terceros, no se llama a endpoints privados ni se hace inferencia. Los scripts de statusLine conservan la configuración previa y permiten restaurarla.

## Estado e historial

- `main` va de 0.1 (prototipo) a 0.7.0 (simplificación). Cada versión añadió: 0.2 importación de `plm.md` y modelos; 0.3 carpetas y conversaciones; 0.4 contexto como flujo principal y revisiones; 0.5 copiar y abrir directo, sin registro manual; 0.6 uso y límites; 0.7 pegado directo desde el portapapeles, uso visible por aplicación y retirada de menús y campos redundantes.
- Verificado en Linux (pruebas de núcleo y escritorio, capturas a 1440/1024/480 px). Pendiente: validación nativa en Windows y macOS, lecturas reales de Claude y Antigravity con cuentas autenticadas, firma/notarización, licencia del código (sin definir), CI multiplataforma.
- Pendiente a medio plazo (ver `docs/ROADMAP.md`): SIWC de OpenAI, ejecución de Claude Code sin modificar, estudio de ventanas incrustadas, importadores de exportaciones públicas, copias de seguridad independientes, apertura de carpetas/sesiones por enlaces oficiales documentados.

## Convenciones para quien continúe

- Mantener el idioma español en interfaz, README y docs; actualizar README, ROADMAP y VERIFICATION al cambiar comportamiento.
- Antes de entregar: `pnpm check`, `pnpm test` y, si se toca interfaz o flujos, `pnpm test:desktop` y `pnpm test:launch`.
- Mensajes de commit en inglés, en imperativo, descriptivos (véase `git log`).
- No presentar PLM como método para eludir términos de servicio; no está afiliado a OpenAI, Anthropic ni Google.
