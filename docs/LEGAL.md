# Revisión de condiciones para PLM

Fecha de consulta: **27 de octubre de 2026**. Fuentes oficiales; las condiciones pueden cambiar. Este registro distingue texto documentado, interpretación de diseño y asuntos pendientes. No es un dictamen jurídico ni una garantía de cumplimiento.

## OpenAI / Codex

Fuentes:

- https://developers.openai.com/siwc/token-sharing-open-source
- https://openai.com/policies/sign-in-with-chatgpt-terms/
- https://learn.chatgpt.com/docs/app-server
- https://learn.chatgpt.com/docs/import

La documentación contempla uso del plan mediante Sign in with ChatGPT en aplicaciones de código abierto y ejecución local. La autenticación no concede acceso al historial de ChatGPT. Para productos de pago o alojados remotamente se indica otra vía de acceso. Los términos requieren identidad propia de la aplicación, autorización del usuario y almacenamiento de tokens persistentes local bajo su control. El acceso mediante el plan no puede exigir pagar al desarrollador. No se permite compartir cuentas, agrupar o revender uso, eludir cuotas ni convertir la conexión en acceso API general para otras herramientas. El uso en segundo plano requiere consentimiento expreso.

**Decisión v0.1:** PLM abre la aplicación original y prepara texto; no implementa SIWC, app-server o autenticación. Una futura integración utilizará exclusivamente el flujo autorizado, sin copiar credenciales de Codex. Antes habrá que resolver la licencia del proyecto, elegibilidad, aviso de privacidad y requisitos de distribución. Publicar su código no convierte al prototipo en una integración SIWC aprobada.

La importación oficial admite trabajo y configuración de otras herramientas, con actualizaciones de elementos compatibles. No documenta una sesión universal entre proveedores ni transferencia de su procesamiento interno.

## Anthropic / Claude

Fuentes:

- https://code.claude.com/docs/en/legal-and-compliance
- https://www.anthropic.com/legal/consumer-terms
- https://www.anthropic.com/legal/commercial-terms

La documentación de Claude Code contempla alojar o ejecutar el binario oficial sin modificar dentro de otros productos, condicionado a los términos comerciales y requisitos indicados. Cada usuario debe autenticarse por el flujo propio; no se permite intermediar o revender su uso. El inicio de sesión de Claude.ai no debe implementarse como autenticación propia de terceros ni extraerse sus tokens. La excepción relativa al binario oficial no autoriza reconstruir Claude Desktop ni envolver cualquier endpoint de la suscripción. El uso de marcas no debe implicar patrocinio.

**Decisión v0.1:** solo se abre Claude Desktop instalado. No se incorpora Claude Code dentro de PLM ni se distribuye su binario. No se leen historiales privados, cookies o credenciales. Ejecutar un Claude Code alojado requeriría una evaluación separada de las condiciones y del modelo de distribución.

Los términos de consumo restringen scraping y acceso automatizado salvo permiso explícito; también limitan el uso de los servicios para desarrollar productos competidores. Los comerciales contienen restricciones sobre competencia e ingeniería inversa. La clasificación de un organizador interoperable como PLM necesita revisión antes de utilizar Claude para desarrollarlo o comercializar una integración. Estas cláusulas no se consideran resueltas por conservar el binario original. Las pruebas de v0.1 se ejecutan sobre PLM y datos sintéticos, sin usar el servicio de Claude.

## Google / Antigravity

Fuentes:

- https://antigravity.google/terms
- https://antigravity.google/docs/faq

El apartado 6 restringe acceso al servicio por herramientas de terceros. La FAQ confirma que envolver `agy -p` dentro de aplicaciones o agentes de terceros no está admitido con planes de consumo. Suscribir un plan individual no autoriza pasar ese acceso a un cliente propio.

**Decisión v0.1:** PLM solo solicita abrir el ejecutable original, sin argumentos de inferencia, automatización de chat o login propio. El usuario copia y pega su contexto en la UI oficial. No se afirma que Google haya aprobado PLM: la amplitud de las condiciones deja pendiente obtener aclaración escrita antes de una integración más profunda o comercial. Cualquier integración API futura será independiente y tendrá sus propias condiciones y costes.

## Interpretación común y límites

Llamar al producto wrapper no crea una excepción contractual. Mantener instalada la aplicación original tampoco autoriza por sí solo el acceso indirecto al servicio. La arquitectura inicial reduce el alcance a organizar datos introducidos por el usuario, exportarlos y lanzar programas independientes. No prueba que todas las posibles funcionalidades futuras estén permitidas.

Compartir contexto no comparte cuotas ni evita procesamiento. El siguiente modelo debe leer el contenido que se le entregue, bajo sus límites y condiciones. PLM no promete coste cero de contexto ni fidelidad completa de herramientas, archivos, estado interno o memoria.

## Requisitos antes de una publicación

1. Revisar las condiciones vigentes para el modelo real de distribución, licencia y precio.
2. Resolver con Google cualquier ambigüedad del alcance de un lanzador con traspasos manuales; no promocionarlo como un bypass.
3. Revisar marcas, textos de privacidad y obligaciones de protección de datos para el público objetivo. El tratamiento local no elimina todas las obligaciones.
4. Inventariar licencias de dependencias y avisos de redistribución; conservar los avisos de Electron/Chromium al empaquetar.
5. Firmar/notarizar y verificar los paquetes en los sistemas de destino antes de distribuirlos como producto estable.

No se ha contactado con proveedores ni se han aceptado acuerdos en nombre del usuario.

## Revisión para 0.4.0

Se han vuelto a consultar las fuentes oficiales de OpenAI SIWC, Claude Code y Antigravity indicadas arriba el 27 de octubre de 2026. OpenAI distingue la autorización para usar el plan del acceso a conversaciones: SIWC no concede acceso al historial. Claude Code limita la autenticación de productos de terceros y distingue su binario oficial de un cliente propio. Antigravity mantiene las restricciones al uso de herramientas de terceros con su login de consumo.

La versión 0.4.0 mejora el tratamiento de documentos locales: pegar Markdown elegido por el usuario, actualizar un resumen y recuperar versiones. No implementa autenticación, inferencia ni sincronización con servicios externos. Los botones de apertura siguen lanzando la aplicación original sin prompts. No se presupone autorización contractual para integrar las tres suscripciones ni se presenta el diseño como una garantía jurídica. Las integraciones oficiales continúan como trabajos separados por proveedor.
