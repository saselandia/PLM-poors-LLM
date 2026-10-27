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

## 0.2 — Continuidad más cómoda

1. Varias conversaciones por proyecto e identificación opcional de sesiones externas mediante referencias documentadas.
2. Importadores de exportaciones públicas y compatibles, con muestra anonimizada, atribución y pruebas por versión. No modificar bases privadas de proveedores.
3. Historial de revisiones del contexto, recuperación y copias de seguridad locales.
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
