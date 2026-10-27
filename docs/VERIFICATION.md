# Verificación del prototipo 0.1.1

Fecha: 27 de octubre de 2026. Entorno local: Linux x64 con sesión gráfica Wayland. Electron 45.0.0; Node.js 24.22.1 para herramientas de desarrollo.

## Comprobaciones realizadas

- Sintaxis de todas las fuentes, scripts y pruebas: correcta.
- 14 pruebas del núcleo: correctas. Cubren serialización de escrituras concurrentes, persistencia tras reinicio, conservación de archivos corruptos, recuperación de la cola después de errores, límites de entrada, validación de roles/proveedores y eliminación de rutas locales al importar/exportar. Las tres nuevas pruebas de arranque rechazan falsos éxitos por crear un proceso, propagan errores y conservan los diagnósticos.
- Repositorio de pruebas independiente: creado, con commit inicial y prueba del saludo correcta. Está ignorado por el repositorio de la aplicación.
- Flujo de escritorio en Electron de desarrollo: correcto.
- Mismo flujo sobre el ejecutable Linux empaquetado: correcto.
- Arranque normal, sin depurador, en desarrollo y contra el paquete Linux: correcto. El lanzador espera una confirmación de que la interfaz se ha inicializado y la ventana es visible. La segunda apertura recupera la misma instancia.
- Interfaz a 480 px: sin desbordamiento horizontal; revisión del contexto operativa.
- Acceso Linux `.desktop` instalado y validado, con registro de errores y sin requerir Node para abrir el paquete.

El flujo de escritorio crea un proyecto con carpeta, añade historial, modifica decisiones, exige guardar el contexto pendiente, previsualiza un traspaso, comprueba la copia, exporta e importa un proyecto y verifica la persistencia después de reiniciar. También comprueba que una entrada con HTML se representa como texto, y que el renderer no expone `require` ni `process`. No sustituye una auditoría de seguridad.

La versión actual de la prueba usa dobles del portapapeles y de los diálogos para controlar los destinos y evitar modificar el portapapeles personal. Verifica el IPC y el contenido del traspaso, no todos los comportamientos del portapapeles del sistema. Los perfiles de prueba son temporales.

La detección local encuentra los ejecutables de Codex, Claude Desktop y Antigravity. No se han enviado mensajes, comprobado sesiones autenticadas o validado la continuidad dentro de esas aplicaciones. No se ha consumido ninguna suscripción para las pruebas del prototipo.

## Pendiente

- Pruebas nativas de interfaz, lanzadores y paquetes en Windows y macOS.
- Instalaciones Windows Store, distintas distribuciones Linux y arquitecturas ARM.
- Confirmación manual del arranque y foco de las aplicaciones de terceros.
- Pruebas de continuidad reales, de importadores nativos y de integraciones oficiales: todavía no implementadas.
- Firma, notarización, instaladores y actualización segura.

La configuración de CI incluida cubre pruebas del núcleo en los tres sistemas cuando se conecte un remoto. No se ha ejecutado CI remoto en esta sesión.
