# PLM — poors LLM

**Tu proyecto continúa aunque cambies de herramienta.**

PLM es una aplicación de escritorio experimental para **llevar el resumen de un proyecto entre Codex, Claude Desktop y Antigravity**. Añade el resumen, elige el destino y pulsa **Copiar contexto y abrir…**. Después pega el texto en el chat de la aplicación original, donde trabajas y recibes respuestas.

La versión **0.5.0** funciona como un organizador local y un lanzador. Cada herramienta se utiliza en su aplicación original, con su propia cuenta, suscripción e interfaz. El traspaso de contexto es manual.

## Para qué sirve

- **Continuar una tarea en otra herramienta:** guardar lo que ya se ha decidido y los pasos pendientes para explicárselo a otro modelo.
- **Comparar perspectivas:** llevar el mismo resumen a diferentes aplicaciones.
- **Mantener una memoria de trabajo:** conservar el resumen, instrucciones y decisiones del proyecto.
- **Preparar entregas de contexto:** revisar un documento Markdown antes de copiarlo o compartirlo; elegir si incluye el historial o una referencia a la carpeta local.
- **Guardar y trasladar proyectos PLM:** exportar/importar un archivo JSON sin incluir la configuración de aplicaciones ni las rutas locales estructuradas.

Ejemplo: trabajas una solución en Codex, registras las decisiones en PLM, preparas un contexto para Claude y lo pegas en su aplicación oficial para pedir una revisión. Después actualizas el resumen y puedes continuar el mismo trabajo en Antigravity.

## Funciones actuales

| Función                                                                   | Estado                             |
| ------------------------------------------------------------------------- | ---------------------------------- |
| Proyectos, carpeta de referencia, objetivo, decisiones y siguientes pasos | Disponible                         |
| Textos guardados por versiones anteriores                                 | Archivo conservado, sin editor     |
| Detección y apertura de aplicaciones instaladas                           | Disponible; ubicación configurable |
| Vista previa, copia y exportación de contexto a Markdown                  | Disponible                         |
| Exportación/importación JSON de proyectos PLM                             | Disponible                         |
| Almacenamiento local, sin servidor ni telemetría propia                   | Disponible                         |
| Ventanas de las tres aplicaciones incrustadas dentro de PLM               | Pendiente de investigación         |
| Lectura o sincronización automática de chats de terceros                  | No implementada                    |
| Peticiones a modelos, APIs o consumo de suscripciones desde PLM           | No implementadas                   |

Abrir una herramienta no abre automáticamente un proyecto o una sesión. Copiar o exportar contexto tampoco confirma que se haya enviado o leído en el destino.

## Nuevo proyecto y contexto duro

Al crear un proyecto puedes elegir **Solo una conversación**, sin carpeta, o **Carpeta con esta conversación**, que permite seleccionar una carpeta existente. La opción sin carpeta es la inicial; si vuelves a ella después de seleccionar una carpeta, se elimina esa vinculación antes de crear el proyecto.

El campo **Contexto duro** sirve para conservar las instrucciones de la conversación y se incluye en los traspasos. Su texto de ayuda es:

> ejemplos: En cada mensaje de esta conversacion se usara git para especificar que se ha hecho en cada prompt.

El ejemplo es un placeholder, no una instrucción que se guarde automáticamente. Puedes editar el contexto duro desde **Editar instrucciones y datos del proyecto**. Los valores de los proyectos anteriores se conservan.

## Importar contexto de una conversación

1. Abre el desplegable **Importar contexto** de la barra lateral.
2. Pulsa **Copiar petición para la IA** y pégala en la conversación de la que quieras conservar contexto. La petición pide un archivo **plm.md** con el proyecto resumido para que otro agente pueda continuar: objetivo, requisitos, decisiones, estado real, archivos relevantes, pruebas y próximos pasos. Si se usaba Git, también pide identificar los repositorios, URLs conocidas sin credenciales, ramas, commits relevantes y cambios pendientes, sin inventar información.
3. Guarda o descarga la respuesta como Markdown y pulsa **Añadir plm.md**.
4. Revisa el archivo y elige el modelo en el menú que aparece. **Mid es lo recomendado para empezar**, con **Terra, Gemini Flash, Claude Haiku y Claude Sonnet**.
5. Confirma **Importar contexto**. El archivo y la preferencia de modelo se guardan en una nueva conversación de PLM, sin enviar nada a un proveedor. Puedes cambiar después el modelo en la sección **Continúa en tu aplicación**.

El límite es **500 líneas**, con un máximo adicional de 100.000 caracteres. Un salto de línea final no añade una línea vacía al cómputo. Los archivos de 501 líneas o más se rechazan con instrucciones para resumirlos; no se recortan silenciosamente. El contenido importado se conserva y se incluye en los traspasos aunque excluyas los textos archivados de versiones anteriores.

El selector se ordena en **Low → Mid → High → Frontier**. Son categorías orientativas de PLM para organizar el trabajo, no una clasificación oficial de los proveedores ni una garantía de disponibilidad. La selección se guarda como preferencia: tú eliges ese modelo en la aplicación oficial. No se cambia automáticamente el modelo de Claude, Codex o Antigravity ni se hacen peticiones a sus servicios. Véanse las [fuentes y el catálogo](docs/MODELS.md).

Las antiguas copias JSON siguen disponibles dentro del mismo desplegable como **Restaurar copia JSON**, y mediante **Exportar proyecto**. Los proyectos guardados antes de esta versión se conservan.

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
3. En **Contexto**, copia la petición de resumen y úsala en tu conversación original. Añade el `plm.md` recibido o pulsa **Pegar resumen**.
4. Elige una herramienta de destino y pulsa **Revisar contexto**.
5. Copia el documento y pégalo tú en el chat de la aplicación oficial.
6. Cuando avances en la otra aplicación, pide un resumen actualizado y usa **Actualizar plm.md** en la misma conversación de PLM.

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

### Conversaciones dentro de carpetas

La barra lateral agrupa las conversaciones por su carpeta de trabajo. Despliega una carpeta y pulsa **Nueva conversación**, o usa el botón de la cabecera mientras estás en una conversación de esa carpeta. Cada conversación conserva su resumen y contexto duro. Las conversaciones sin carpeta aparecen por separado. Las carpetas ya vinculadas se reconocen al reiniciar, sin tener que seleccionarlas otra vez.

Elige el destino y el modelo en la pantalla principal. **Copiar contexto y abrir…** copia el documento y lanza la aplicación original; **Aplicaciones** permite abrir o configurar Codex, Claude y Antigravity. En ventanas estrechas, el botón de navegación abre la lista de carpetas. Eliminar una conversación solo elimina esa conversación de PLM, nunca su carpeta ni las demás conversaciones.

Esc cierra el desplegable o panel activo. Los diálogos conservan su cierre nativo y los desplegables anidados se cierran antes que el diálogo que los contiene.

## Continuar y actualizar el contexto (0.4.0)

En la versión 0.5.0 ya no hay pestañas ni un editor de registro manual. La pantalla muestra el resumen y las acciones para continuar en una aplicación. No hace falta copiar cada mensaje.

1. Copia la petición de resumen y pégala en tu conversación de la aplicación original.
2. Añade el Markdown con **Añadir plm.md / Actualizar resumen** o usa **Pegar resumen**. Puedes revisar el contenido y el modelo antes de confirmar.
3. Usa **Copiar contexto y abrir…** para copiar el documento y solicitar la apertura de la aplicación instalada. Pega tú el texto en el chat donde quieras continuar. **Revisar lo que se copiará** permite comprobarlo antes.
4. Vuelve a actualizar el resumen cuando avance el trabajo, conservando la misma conversación, carpeta, contexto duro y decisiones.

El desplegable de la barra lateral sigue permitiendo importar una conversación nueva. Actualizar con el botón de la pantalla principal modifica la conversación seleccionada y conserva su nombre; no crea otra. Ambos métodos aceptan hasta 500 líneas y 100.000 caracteres. Cancelar no guarda ni actualiza nada.

**Versiones anteriores del contexto** permite revisar y restaurar las diez últimas versiones no vacías de contexto duro, decisiones, próximos pasos y resumen. Restaurar también conserva una copia del estado sustituido, dentro de ese límite. Las versiones se guardan localmente y se incluyen en las copias JSON; los traspasos a modelos solo incluyen el contexto vigente. El límite general del espacio sigue siendo 8 MB. No son copias de seguridad independientes del archivo de trabajo.

Si el contexto cambia mientras revisas una importación, PLM la rechaza para no sobrescribir cambios sin revisión. Los cambios sin guardar en el formulario también deben guardarse antes de actualizar o restaurar.

## Flujo directo (0.5.0)

La pantalla principal explica el propósito de PLM y muestra dos partes: **Tu resumen del proyecto** y **Continúa en tu aplicación**. Selecciona Codex, Claude o Antigravity y pulsa **Copiar contexto y abrir [aplicación]**. Si no está detectada, aparece **Seleccionar aplicación de…** para indicar dónde está instalada. El modelo elegido es una preferencia: selecciónalo también en la aplicación original.

El botón copia el contexto y solicita abrir el programa instalado, sin argumentos de prompt ni credenciales. No elige el chat externo, pega texto, pulsa Enviar ni inicia inferencia. El usuario elige su conversación y pega allí el texto. La interfaz distingue el inicio solicitado de un fallo de apertura; en caso de fallo, explica si el texto sigue copiado. Puedes revisar antes el contenido o usar **Opciones de copia y exportación** para copiarlo sin abrir ninguna aplicación.

El registro manual se ha retirado. Los textos existentes y los incluidos en antiguas copias JSON se conservan en **Textos guardados en versiones anteriores**. No hay editor para añadir mensajes; el archivo se excluye por defecto de los traspasos y solo se incluye si lo marcas explícitamente. El historial de copias y exportaciones y las revisiones de contexto siguen disponibles en desplegables. Esc los cierra.
