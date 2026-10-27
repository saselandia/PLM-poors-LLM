# PLM — poors LLM

Aplicación de escritorio experimental para conservar contexto entre Codex, Claude y Antigravity. El nombre provisional es **PLM**. La aplicación organiza proyectos y prepara traspasos manuales; las herramientas oficiales conservan sus interfaces y autenticación.

## Estado de la versión 0.1

- Crear proyectos y vincular una carpeta elegida por el usuario.
- Detectar y abrir las aplicaciones originales; seleccionar su ejecutable si no se detecta.
- Registrar preguntas, respuestas copiadas y notas, con origen y fecha.
- Guardar objetivo, decisiones y próximos pasos.
- Revisar el contexto, copiarlo o exportarlo a Markdown para pegarlo en otra aplicación.
- Elegir si compartir el historial y la ruta local. No se adjuntan archivos.
- Exportar/importar proyectos PLM en JSON. Las importaciones no heredan rutas locales ni lanzadores.
- Conservar los datos localmente entre reinicios, sin servidor, telemetría ni peticiones a modelos.

**Todavía no incorpora las ventanas de terceros dentro de PLM, sincroniza chats automáticamente, importa formatos nativos de otros agentes ni ejecuta inferencia.** Las respuestas se añaden manualmente. La actividad de copiar/exportar no acredita que el contenido se haya enviado o leído en el destino.

## Ejecutar

Necesitas Node.js 24 o superior y pnpm. Desde este repositorio:

```sh
pnpm install --frozen-lockfile
pnpm sandbox
pnpm start
```

`pnpm demo` abre PLM con un proyecto de ejemplo y un perfil separado dentro de `sandbox/demo-profile`. Conserva los cambios que hagas en esa demostración.

Si tu gestor bloquea el script de instalación de Electron, permite exclusivamente el de `electron` y ejecuta `node node_modules/electron/install.js`. La configuración de pnpm del proyecto ya declara esa autorización.

## Flujo de prueba

1. Crea el repositorio de pruebas con `pnpm sandbox`. Está en `sandbox/PLM- poors LLM`, tiene Git propio y no tiene remoto.
2. En PLM, crea un proyecto y elige esa carpeta.
3. Registra una pregunta o respuesta y guarda las decisiones en la pestaña Contexto.
4. Selecciona un destino y pulsa **Revisar contexto**.
5. Copia el contexto. Abre la aplicación original y pégalo tú en su chat.
6. Añade a PLM la respuesta que quieras conservar y continúa con otra herramienta.

Abrir una aplicación no abre automáticamente el proyecto, crea una sesión ni envía el contexto. PLM solicita el arranque del ejecutable; no verifica su estado de inicio de sesión.

## Verificación y distribución

```sh
pnpm check
pnpm test
pnpm test:desktop
pnpm package
```

La prueba de escritorio requiere una sesión gráfica. Usa un perfil temporal y sustituye los diálogos de archivos y el portapapeles por dobles de prueba, para comprobar el flujo sin modificar el portapapeles personal. No consume suscripciones ni interactúa con chats personales. `PLM_EXECUTABLE=/ruta/al/paquete/plm pnpm test:desktop` ejecuta el mismo flujo contra el binario empaquetado.

`pnpm package` genera una carpeta ejecutable en `dist/` para tu plataforma. También admite `pnpm package darwin arm64`, `pnpm package win32 x64` y `pnpm package linux x64`. Los paquetes aún no están firmados ni notarizados y deben verificarse en cada sistema nativo. El empaquetado cruzado no acredita compatibilidad funcional. No ejecutes Electron como root ni desactives su sandbox.

## Datos y privacidad

Los datos se guardan como JSON en `app.getPath('userData')/workspace.json`, según el sistema operativo. Están en texto claro; PLM no promete cifrado en reposo. En POSIX los archivos se crean con permisos `0600` y el directorio propio con `0700`. En Windows se aplican los permisos heredados del perfil.

No se escanean carpetas ni se leen bases de datos, cookies o tokens de otras aplicaciones. Abrir una aplicación original puede provocar las conexiones propias de esa aplicación. Copiar contexto lo deja en el portapapeles del sistema; revisa cualquier información privada antes de pegarla. Las exportaciones pueden contener información sensible del historial aunque omitan las rutas locales estructuradas.

`PLM_DATA_DIR=/ruta/independiente pnpm start` permite usar un perfil de desarrollo distinto. Si el JSON está corrupto, PLM conserva el original y muestra un error; no lo sobrescribe silenciosamente.

## Arquitectura y siguientes pasos

- [Arquitectura](docs/ARCHITECTURE.md)
- [Revisión de condiciones y límites](docs/LEGAL.md)
- [Plan de desarrollo](docs/ROADMAP.md)

Este prototipo no está afiliado a OpenAI, Anthropic ni Google. La revisión de condiciones es una decisión de diseño con fuentes oficiales, no una certificación jurídica. La integración de autenticación y modelos necesita una evaluación adicional antes de implementarse o distribuirse.
