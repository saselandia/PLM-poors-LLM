# Arquitectura de PLM

Decisión inicial: Electron, interfaz local HTML/CSS/JavaScript, sin framework de UI y sin dependencias de producción. Se prioriza comprobar la continuidad del trabajo antes de incorporar un motor de agentes.

## Separación de responsabilidades

```text
Interfaz local en sandbox
        │ API limitada mediante contextBridge
        ▼
Proceso principal de Electron
        ├── Proyectos e historial → Store → workspace.json
        ├── Contexto → vista previa / portapapeles / archivo elegido
        └── Launcher → ejecutable original sin shell ni prompts
```

El renderer no tiene Node, acceso directo al disco ni red. El preload expone funciones concretas; no expone `ipcRenderer` ni un ejecutor genérico. El proceso principal valida los remitentes IPC, los proveedores, los textos, los tamaños y los esquemas. Se bloquean navegación, ventanas adicionales, webviews y permisos web.

## Modelo de datos v1

Un proyecto tiene ID propio, nombre, carpeta local opcional, objetivo, decisiones, próximos pasos, mensajes y registros de traspaso. Cada mensaje tiene rol, proveedor de origen y fecha. La atribución la introduce el usuario: no certifica que el proveedor generase ese texto. Cada registro de proyecto representa una conversación; la interfaz agrupa los que comparten carpeta y permite crear nuevas conversaciones desde el grupo.

Los proyectos de PLM y las sesiones de los proveedores son entidades distintas. La interfaz usa un historial común mantenido por el usuario. No se escriben IDs, sesiones o bases internas de otras aplicaciones.

La creación distingue Solo una conversación y Carpeta con esta conversación; la segunda exige una carpeta elegida por el usuario. El tipo se deduce de la vinculación, sin cambiar el esquema. El campo que la interfaz llama Contexto duro conserva la clave `goal` para mantener los datos anteriores, y se incluye con ese título en los traspasos.

Las exportaciones JSON usan `format: plm-project` y `version: 1`. La importación valida el esquema, genera un ID nuevo, descarta propiedades desconocidas y elimina la carpeta local. Las rutas de aplicaciones no forman parte del archivo portable. El Markdown puede excluir el historial y omite la carpeta salvo selección explícita.

El contexto incluye advertencias de procedencia y conserva el texto histórico sin interpretarlo. Esto no constituye una defensa completa contra instrucciones maliciosas en el contenido. Siempre hay revisión manual antes del uso en otra aplicación.

## Importación de plm.md y selección de modelo (0.2)

El selector nativo permite leer solo el Markdown que el usuario elige. Se exige UTF-8 válido, hasta 500 líneas y 100.000 caracteres. Se normalizan BOM y saltos CRLF, sin resumir o recortar el contenido. La importación permanece en memoria con un identificador efímero hasta que el usuario revisa el archivo y confirma el nombre y modelo; cancelar no crea proyectos.

Los campos opcionales `importedContext` y `preferredModel` amplían el esquema v1 conservando los proyectos anteriores. El contexto base siempre forma parte del traspaso; la inclusión del historial posterior es independiente. El archivo de origen tiene límite de 500 líneas; los traspasos que añaden objetivo, instrucciones y mensajes pueden ser más largos. El catálogo y la petición copiable son constantes compartidas, sin llamadas de red ni cambio automático del modelo en las aplicaciones originales.

## Persistencia

Una cola serializa las mutaciones para no perder escrituras concurrentes. Cada cambio se valida y se escribe en un temporal exclusivo; se sincroniza el archivo antes de renombrarlo sobre el destino. El estado en memoria solo cambia después del guardado. El protocolo evita archivos parcialmente escritos; no es un sistema de copias de seguridad ni garantiza recuperación ante todos los fallos de hardware. Un archivo corrupto provoca parada conservando el original.

Límites iniciales: 100 proyectos, 2.000 mensajes y 2.000 traspasos por proyecto, 100.000 caracteres por mensaje y 8 MB por espacio o importación. La interfaz informa del rechazo; la exportación permite archivar proyectos antes de eliminarlos de PLM.

## Lanzadores

Linux: búsqueda en PATH absoluto y ubicaciones comunes de `codex-desktop`, `claude-desktop` y `antigravity`. No se usa `codex`, `claude` o `agy -p` como sustituto de la aplicación de escritorio.

macOS: bundles en `/Applications` y `~/Applications`; apertura mediante `/usr/bin/open -a` con argumentos separados. Windows: candidatos conocidos en AppData y Program Files. La localización mediante selector cubre instalaciones que no estén en esas rutas, aunque la compatibilidad con paquetes de Microsoft Store requiere una prueba específica.

Un ejecutable seleccionado por el usuario se ejecuta directamente, sin shell, argumentos de modelos ni credenciales añadidas. Detectar un archivo no acredita autenticidad o firma: el usuario debe elegir su instalación oficial. El resultado del lanzamiento solo indica creación del proceso, no que su ventana haya cargado correctamente.

## Futuras integraciones

Cada capacidad deberá definirse por proveedor: abrir aplicación, abrir proyecto, leer exportación documentada, importar contexto, continuar sesión, inferencia. Se habilitarán individualmente, con estado real visible y pruebas. Una integración oficial de Codex no presupone permiso para hacer lo mismo con Antigravity.

Incrustar ventanas externas es una investigación independiente. No se utiliza una webview como sustituto de una aplicación instalada. Los límites de macOS y Wayland impiden asumir que el reparentado de ventanas ajenas sea portable. La experiencia base debe funcionar con ventanas separadas.

## Actualización y revisiones de contexto (0.4)

`context:stage` valida un Markdown pegado y `context:choose` valida un archivo elegido explícitamente. Ambos devuelven un token de revisión efímero, sin persistir nada. El proceso principal conserva contenido, destino y una comparación de los campos de contexto y modelo vigentes al añadirlo. El renderer no decide qué versión reemplaza: el destino está vinculado al token. Cancelar descarta el token; solo se mantiene una importación pendiente.

Al confirmar, una nueva conversación conserva el flujo original. Para un destino existente se usa una mutación serializada y se comprueba que el contexto no haya cambiado. `reviseContext` conserva el ID, carpeta, mensajes e instrucciones; sustituye el resumen y el modelo elegido. Las ediciones del formulario y restauraciones usan la misma función de revisiones. El campo opcional `contextRevisions` contiene hasta diez instantáneas de los cuatro campos de contexto. Se valida al leer y al guardar, sin ejecutar Markdown ni incorporar las revisiones a los traspasos. Las copias JSON las conservan. Los límites por campo y los 8 MB globales siguen aplicándose; un guardado rechazado deja el estado anterior intacto.

El renderer abre Contexto como vista inicial. La entrada manual es una pestaña secundaria. Las importaciones y restauraciones exigen guardar antes cualquier borrador del formulario; el borrador manual se mantiene independiente.
