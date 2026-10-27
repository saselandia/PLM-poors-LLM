# PLM — poors LLM

**Tu proyecto continúa aunque cambies de herramienta.**

PLM es una aplicación de escritorio experimental para organizar el trabajo que realizas con **Codex, Claude Desktop y Antigravity**. Conserva tus objetivos, decisiones y conversaciones en tu equipo y prepara el contexto que quieras llevarte a la siguiente aplicación.

La versión **0.1.1** funciona como un organizador local y un lanzador. Cada herramienta se utiliza en su aplicación original, con su propia cuenta, suscripción e interfaz. El traspaso de contexto es manual.

## Para qué sirve

- **Continuar una tarea en otra herramienta:** guardar lo que ya se ha decidido y los pasos pendientes para explicárselo a otro modelo.
- **Comparar perspectivas:** registrar respuestas de distintas herramientas dentro de un mismo proyecto, conservando la atribución que introduces.
- **Mantener una memoria de trabajo:** reunir objetivos, notas, preguntas, respuestas y decisiones sin depender de un único historial externo.
- **Preparar entregas de contexto:** revisar un documento Markdown antes de copiarlo o compartirlo; elegir si incluye el historial o una referencia a la carpeta local.
- **Guardar y trasladar proyectos PLM:** exportar/importar un archivo JSON sin incluir la configuración de aplicaciones ni las rutas locales estructuradas.

Ejemplo: trabajas una solución en Codex, registras las decisiones en PLM, preparas un contexto para Claude y lo pegas en su aplicación oficial para pedir una revisión. Después guardas la respuesta que te interesa y puedes continuar el mismo trabajo en Antigravity.

## Funciones actuales

| Función                                                                   | Estado                             |
| ------------------------------------------------------------------------- | ---------------------------------- |
| Proyectos, carpeta de referencia, objetivo, decisiones y siguientes pasos | Disponible                         |
| Historial con mensajes y notas añadidos por el usuario                    | Disponible                         |
| Detección y apertura de aplicaciones instaladas                           | Disponible; ubicación configurable |
| Vista previa, copia y exportación de contexto a Markdown                  | Disponible                         |
| Exportación/importación JSON de proyectos PLM                             | Disponible                         |
| Almacenamiento local, sin servidor ni telemetría propia                   | Disponible                         |
| Ventanas de las tres aplicaciones incrustadas dentro de PLM               | Pendiente de investigación         |
| Lectura o sincronización automática de chats de terceros                  | No implementada                    |
| Peticiones a modelos, APIs o consumo de suscripciones desde PLM           | No implementadas                   |

Abrir una herramienta no abre automáticamente un proyecto o una sesión. Copiar o exportar contexto tampoco confirma que se haya enviado o leído en el destino.

## Legalidad y condiciones de uso

### Cómo se ha diseñado para respetarlas

PLM organiza contenido que el usuario decide introducir y ofrece traspasos de texto revisables. **El acceso autenticado al modelo sigue ocurriendo dentro de la aplicación oficial de cada proveedor.** PLM no pide contraseñas, extrae tokens, reutiliza cookies, modifica binarios ni llama a endpoints privados. Tampoco comparte cuentas, revende cuotas, rota suscripciones o automatiza peticiones para eludir límites.

Esta separación es la base de la justificación del diseño: el usuario conserva sus documentos y usa cada servicio en su superficie oficial. **Llamar a una aplicación “wrapper” no crea una excepción a los términos de servicio.** La instalación de la aplicación original, por sí sola, tampoco autoriza cualquier integración.

### Qué aplica a cada proveedor

| Proveedor                | Criterio de PLM                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **OpenAI / Codex**       | La versión actual solo abre la aplicación original. OpenAI documenta una vía oficial de Sign in with ChatGPT para uso compatible del plan en aplicaciones locales y de código abierto, con condiciones propias. PLM todavía no la implementa ni hereda credenciales de Codex. [Documentación oficial](https://developers.openai.com/siwc/token-sharing-open-source), [términos de SIWC](https://openai.com/policies/sign-in-with-chatgpt-terms/). |
| **Anthropic / Claude**   | Se abre Claude Desktop instalado; el usuario añade o pega el contexto. La posibilidad documentada de alojar Claude Code sin modificar está sujeta a requisitos y no supone permiso general para reconstruir Claude Desktop o intermediar su suscripción. [Condiciones de Claude Code](https://code.claude.com/docs/en/legal-and-compliance).                                                                                                      |
| **Google / Antigravity** | Se mantiene como aplicación independiente. Google restringe el acceso por herramientas de terceros y envolver `agy -p` en otras aplicaciones con planes de consumo. PLM no utiliza ese mecanismo ni ofrece un login de Antigravity. [FAQ oficial](https://antigravity.google/docs/faq), [términos](https://antigravity.google/terms).                                                                                                             |

### Alcance y límites de esta explicación

PLM **no dispone de una certificación jurídica ni de autorización expresa de los tres proveedores**. En especial, el alcance de las restricciones de Google y las cláusulas de Anthropic sobre automatización y productos competidores necesitan una evaluación específica antes de integraciones profundas o usos comerciales. Véanse los [términos de consumo de Anthropic](https://www.anthropic.com/legal/consumer-terms) y sus [términos comerciales](https://www.anthropic.com/legal/commercial-terms).

Compartir tu propio texto no transfiere el estado interno, herramientas, memoria ni procesamiento de un modelo a otro. El modelo de destino tendrá que procesar lo que le entregues y aplicará sus propios límites. Comparte únicamente contenido para el que tengas los derechos y permisos necesarios, respetando confidencialidad y protección de datos.

Consulta la [revisión detallada de condiciones](docs/LEGAL.md), fechada el **27 de octubre de 2026**. Las condiciones pueden cambiar; no se presenta PLM como un método para saltárselas. No está afiliado a OpenAI, Anthropic ni Google.

## Ejecutar desde el código

Requisitos: **Node.js 24 o superior**, pnpm y una sesión gráfica para ejecutar Electron.

```sh
pnpm install --frozen-lockfile
pnpm sandbox
pnpm start
```

`pnpm demo` prepara un proyecto de ejemplo y lo abre con un perfil separado en `sandbox/demo-profile`. Ahora espera a que la interfaz confirme que ha cargado y que la ventana está visible. Si falla, devuelve un error e indica el archivo `startup.log`; no anuncia éxito solo por haber creado un proceso.

Si el gestor bloquea el script de instalación de Electron, permite exclusivamente el de `electron` y ejecuta `node node_modules/electron/install.js`. La configuración del proyecto declara esa autorización.

## Abrir PLM como aplicación en Linux

```sh
pnpm package
pnpm install:linux
```

Después busca **PLM** en el menú de aplicaciones. También puedes ejecutar:

```sh
gtk-launch dev.plm.desktop
```

El acceso apunta al paquete dentro de `dist/`; si mueves o eliminas esa carpeta, vuelve a empaquetar e instalar el acceso. La carpeta empaquetada incluye `plm-launch`, que se puede ejecutar sin Node y guarda los errores en `${XDG_STATE_HOME:-~/.local/state}/plm/startup.log`.

En gestores de ventanas como Hyprland, PLM puede aparecer en un espacio de trabajo diferente o en una ventana estrecha. La interfaz se adapta a ventanas desde 480 px; revisa el espacio de trabajo y los registros si no la ves. No se modifican reglas del compositor ni se desactiva la sandbox de Electron.

Los paquetes de **Windows y macOS** siguen pendientes de validación nativa. Las rutas candidatas y la selección de aplicaciones están implementadas para los tres sistemas, pero generar un paquete no demuestra que todas sus funciones hayan sido probadas.

## Probar un traspaso

1. Ejecuta `pnpm sandbox`: crea el repositorio local `sandbox/PLM- poors LLM`, con Git independiente y una tarea pequeña.
2. Crea un proyecto en PLM y elige esa carpeta, o ejecuta `pnpm demo`.
3. Añade una entrada al historial y guarda las decisiones en **Contexto**.
4. Elige una herramienta de destino y pulsa **Revisar contexto**.
5. Copia el documento y pégalo tú en el chat de la aplicación oficial.
6. Añade a PLM la respuesta que quieras conservar y continúa desde ahí.

## Desarrollo y verificación

```sh
pnpm check
pnpm test
pnpm test:desktop
pnpm test:launch
pnpm package
```

La prueba de escritorio usa un perfil temporal y dobles para los diálogos y el portapapeles. Comprueba el flujo, persistencia, representación de texto y aislamiento sin tocar chats personales. La prueba de arranque abre la aplicación sin depurador, exige confirmación de interfaz cargada y ventana visible y comprueba la segunda apertura.

Para probar el paquete generado en Linux:

```sh
PLM_EXECUTABLE="$PWD/dist/PLM-linux-x64/plm" pnpm test:desktop
PLM_EXECUTABLE="$PWD/dist/PLM-linux-x64/plm" pnpm test:launch
```

El empaquetador también admite `pnpm package darwin arm64`, `pnpm package win32 x64` y `pnpm package linux x64`. Los paquetes son experimentales, sin firma ni notarización. No ejecutes Electron como root ni desactives su sandbox.

## Datos y privacidad

- Los proyectos se guardan en `app.getPath('userData')/workspace.json`, en texto claro. No hay cifrado en reposo propio.
- Los archivos se crean con permisos `0600` en POSIX y el directorio propio con `0700`; Windows usa los permisos del perfil.
- PLM no escanea el contenido de carpetas ni lee bases privadas, sesiones o credenciales de las otras aplicaciones.
- Los proveedores pueden realizar sus propias conexiones cuando abres sus aplicaciones.
- El portapapeles y los archivos exportados pueden contener información sensible. Revisa el documento antes de compartirlo; omitir la ruta estructurada no elimina las rutas o secretos que hayas escrito en los mensajes.
- Si el JSON local está corrupto, se conserva el original y se muestra un error.

`PLM_DATA_DIR=/ruta/independiente pnpm start` permite elegir un perfil separado. Los perfiles de demostración, logs, paquetes y repositorios de pruebas locales están excluidos de Git.

## Documentación y licencia

- [Arquitectura](docs/ARCHITECTURE.md)
- [Revisión legal y cuestiones pendientes](docs/LEGAL.md)
- [Plan de desarrollo](docs/ROADMAP.md)
- [Registro de verificaciones](docs/VERIFICATION.md)

La licencia de distribución del código de PLM está pendiente de definir. Publicar el repositorio para consulta no se presenta como una licencia general de reutilización. Las dependencias y los productos de terceros conservan sus propias licencias; los paquetes deben conservar los avisos de Electron y Chromium.
