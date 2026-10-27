# Modelos y niveles en PLM

El catálogo es una ayuda local para elegir con qué modelo continuar después de importar un contexto. Las categorías siguen la organización pedida para PLM; no son una taxonomía oficial, un benchmark ni una promesa de acceso con una suscripción concreta.

| Nivel                          | Modelos de referencia                            |
| ------------------------------ | ------------------------------------------------ |
| Low                            | Luna, Gemini Flash-Lite                          |
| Mid — recomendado para empezar | Terra, Gemini Flash, Claude Haiku, Claude Sonnet |
| High                           | Sol, Gemini Pro, Claude Opus                     |
| Frontier                       | Astra, Gemini 4 Argon, Claude Mythos             |

Terra queda seleccionado por defecto en la importación y los proyectos anteriores reciben esta preferencia al cargarse. Mid permite elegir cualquiera de las cuatro familias indicadas. El modelo y su proveedor se conservan con el proyecto, incluidas sus copias JSON. Al elegir un modelo se actualiza el destino del traspaso en PLM; al cambiar de proveedor se propone su modelo Mid.

PLM no descubre el catálogo de tu cuenta, comprueba cuotas ni activa modelos remotos. La disponibilidad y la versión que aparece en cada aplicación pueden diferir de estas familias. Elige el modelo en la interfaz oficial. El contexto Markdown se comparte manualmente.

Fuentes oficiales consultadas el 27 de octubre de 2026 para comprobar las familias y nombres, sin importar sus rankings a los niveles de PLM:

- [OpenAI: modelos de ChatGPT Work y Codex](https://learn.chatgpt.com/docs/models).
- [Google: catálogo de modelos Gemini](https://ai.google.dev/gemini-api/docs/models).
- [Anthropic: anuncios de modelos Claude](https://www.anthropic.com/news/models).

El catálogo compartido entre la interfaz y el proceso principal está en `src/shared/context.js`. No se utilizan estos identificadores como credenciales ni como rutas de acceso a modelos.
