# Verificación del prototipo 0.2.1

Fecha: 27 de octubre de 2026. Entorno local: Linux x64 con sesión gráfica Wayland. Electron 45.0.0; Node.js 24.22.1 para herramientas de desarrollo.

## Comprobaciones realizadas

En 0.2.1, el flujo de escritorio comprueba las dos opciones de creación: exige una carpeta cuando se elige vincularla y elimina la selección anterior al pasar a Solo una conversación. También verifica el placeholder de Contexto duro, su conservación en el proyecto y el traspaso, y la referencia a repositorios Git en la petición copiada.

La versión 0.2 añade 3 pruebas del contexto (17 en total): cómputo exacto de las 500 líneas, normalización UTF-8/CRLF, catálogo ordenado con Mid por defecto, compatibilidad de proyectos anteriores y persistencia del contexto/modelo en exportación e importación. El flujo de escritorio incluye petición copiable, rechazo de 501 líneas, cancelación sin crear proyectos, importación de 500 líneas, elección y cambio de modelo y conservación tras reiniciar.

- Sintaxis de todas las fuentes, scripts y pruebas: correcta.
- 14 pruebas del núcleo: correctas. Cubren serialización de escrituras concurrentes, persistencia tras reinicio, conservación de archivos corruptos, recuperación de la cola después de errores, límites de entrada, validación de roles/proveedores y eliminación de rutas locales al importar/exportar. Las tres nuevas pruebas de arranque rechazan falsos éxitos por crear un proceso, propagan errores y conservan los diagnósticos.
- Repositorio de pruebas independiente: creado, con commit inicial y prueba del saludo correcta. Está ignorado por el repositorio de la aplicación.
- Flujo de escritorio en Electron de desarrollo: correcto.
- Mismo flujo sobre el ejecutable Linux empaquetado: correcto.
- Arranque normal, sin depurador, en desarrollo y contra el paquete Linux: correcto. El lanzador espera una confirmación de que la interfaz se ha inicializado y la ventana es visible. La segunda apertura recupera la misma instancia.
- Interfaz a 480 px: sin desbordamiento horizontal; revisión del contexto operativa.
- Acceso Linux `.desktop` instalado y validado, con registro de errores y sin requerir Node para abrir el paquete.
- Apertura mediante `gtk-launch dev.plm.desktop`: confirmación de interfaz inicializada y ventana visible. No se deduce el éxito únicamente de la creación del proceso.
- CI remoto: sintaxis y 14 pruebas del núcleo correctas en Linux, macOS y Windows. [Ejecución verificada](https://github.com/saselandia/PLM-poors-LLM/actions/runs/40451610987). La primera ejecución detectó rutas construidas con la plataforma anfitriona al simular otra; se corrigió seleccionando explícitamente la semántica de rutas del sistema destino.

El flujo de escritorio crea un proyecto con carpeta, añade historial, modifica decisiones, exige guardar el contexto pendiente, previsualiza un traspaso, comprueba la copia, exporta e importa un proyecto y verifica la persistencia después de reiniciar. También comprueba que una entrada con HTML se representa como texto, y que el renderer no expone `require` ni `process`. No sustituye una auditoría de seguridad.

La versión actual de la prueba usa dobles del portapapeles y de los diálogos para controlar los destinos y evitar modificar el portapapeles personal. Verifica el IPC y el contenido del traspaso, no todos los comportamientos del portapapeles del sistema. Los perfiles de prueba son temporales.

La detección local encuentra los ejecutables de Codex, Claude Desktop y Antigravity. No se han enviado mensajes, comprobado sesiones autenticadas o validado la continuidad dentro de esas aplicaciones. No se ha consumido ninguna suscripción para las pruebas del prototipo.

## Pendiente

- Pruebas nativas de interfaz, lanzadores y paquetes en Windows y macOS.
- Instalaciones Windows Store, distintas distribuciones Linux y arquitecturas ARM.
- Confirmación manual del arranque y foco de las aplicaciones de terceros.
- Pruebas de continuidad reales, de importadores nativos y de integraciones oficiales: todavía no implementadas.
- Firma, notarización, instaladores y actualización segura.

El CI verifica el núcleo en los tres sistemas. La interfaz y los lanzadores en aplicaciones reales de macOS y Windows siguen pendientes de validación nativa.

## Revisión de interfaz 0.3.0

- Conversación como área principal, editor visible y desplazamiento del historial independiente.
- Carpetas desplegables con varias conversaciones; creación en carpeta ya guardada después de reiniciar.
- Historiales independientes y conservación de borradores al cambiar de pestaña.
- Comprobaciones de posición del chat y visibilidad del editor en 1440×950, 1024×700 y 480×760; capturas revisadas.
- Aplicaciones en diálogo separado y traspaso en panel que se abre a petición.
- Datos v1 existentes compatibles: agrupación por la ruta guardada, sin reescribir ni eliminar historiales.

## Teclado y registro manual 0.3.1

- El editor se identifica como registro manual; guardar no envía nada a un proveedor.
- Esc cierra los desplegables anidados, los diálogos, la navegación estrecha, las carpetas y el panel de contexto, respetando el elemento que está delante.
- La prueba de escritorio verifica la conservación del borrador y la devolución del foco al cerrar el panel, así como la cancelación de la importación por teclado.
