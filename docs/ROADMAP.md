# Plan de desarrollo

## 0.1 — Prototipo local

Objetivo: demostrar un ciclo real de continuidad mediante contexto portable, manteniendo las aplicaciones independientes.

- [x] Aplicación Electron con interfaz en español y almacenamiento local.
- [x] Proyectos, historial manual, decisiones y próximos pasos.
- [x] Vista previa, copia y exportación Markdown del contexto.
- [x] Exportación/importación JSON de proyectos PLM.
- [x] Detección y lanzadores originales; selección manual de ubicaciones.
- [x] Repositorio Git local `sandbox/PLM- poors LLM` reproducible.
- [x] Pruebas de integridad, validación, portabilidad y límites de datos.
- [ ] Verificación completa en ventanas reales de Windows y macOS.
- [ ] Confirmar manualmente cada lanzador en instalaciones nativas y distribuciones de Linux.

## 0.2 — Importar contexto de conversaciones

- [x] Desplegable con instrucciones y petición copiable para generar `plm.md` desde una conversación existente.
- [x] Importación revisable de Markdown UTF-8 de hasta 500 líneas, sin recortes automáticos.
- [x] Selección de modelo después de añadir el archivo; niveles Low, Mid, High y Frontier.
- [x] Mid recomendado con Terra, Gemini Flash, Claude Haiku y Claude Sonnet.
- [x] Persistencia del contexto base y modelo, traspasos y compatibilidad con copias JSON anteriores.
- [x] Pruebas del límite exacto, rechazo de 501 líneas, cancelación y conservación tras reinicio.

## Continuidad pendiente

1. Varias conversaciones por carpeta ya disponibles; identificación opcional de sesiones externas mediante referencias documentadas pendiente.
2. Importadores de exportaciones públicas y compatibles, con muestra anonimizada, atribución y pruebas por versión. No modificar bases privadas de proveedores.
3. Historial de diez revisiones de contexto y recuperación disponibles; copias de seguridad independientes pendientes.
4. Estimaciones de tamaño claramente aproximadas y selección de entradas para traspaso. Los resúmenes por modelo serán opcionales y tendrán uso explícito.
5. Abrir carpetas o sesiones desde enlaces oficiales únicamente cuando estén documentados y probados para cada aplicación.
6. Prueba manual: tarea breve en Codex, traspaso a Claude y continuación en Antigravity, comparando los resultados con el historial conservado.

## 0.3 — Integraciones oficiales y estudio de ventanas

- Evaluar SIWC de OpenAI con identidad PLM, requisitos de código abierto y flujos oficiales. No heredar tokens de otras aplicaciones.
- Evaluar ejecución del binario Claude Code sin modificar bajo sus requisitos. Mantener distinguido el modo aplicación original.
- Antigravity seguirá siendo independiente salvo autorización documentada o integración API separada.
- Probar alojamiento visual de ventanas por plataforma. Criterios: teclado, foco, adjuntos, diálogos, accesibilidad, escalado, recuperación y actualizaciones del proveedor. La prueba debe poder descartarse sin romper la experiencia principal.

## Distribución

Configurar CI en macOS, Windows y Linux para pruebas del núcleo y empaquetado. Los binarios generados no se consideran validados solo por compilar. Firma, notarización, instaladores, actualización segura y requisitos jurídicos son hitos posteriores. El repositorio de pruebas es local; no se crea remoto o publicación automáticamente.

## 0.4 — Contexto como flujo principal

- [x] Contexto como pantalla inicial; registro manual opcional.
- [x] Añadir Markdown pegado con revisión, modelo y límite de 500 líneas.
- [x] Actualizar el resumen de una conversación existente sin duplicarla ni perder su carpeta o contexto duro.
- [x] Versiones anteriores revisables y restauración; diez versiones no vacías por conversación.
- [x] Rechazo de importaciones si el contexto cambió durante la revisión; cancelación sin escrituras.
- [x] Revisión de condiciones oficiales por proveedor; ninguna reutilización de credenciales o inferencia en esta versión.
- [ ] Sincronización real de chats mediante integraciones autorizadas y documentadas; no está incluida en este flujo de documentos.
