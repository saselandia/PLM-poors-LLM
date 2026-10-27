export const MAX_CONTEXT_LINES = 500;
export const MAX_CONTEXT_CHARS = 100_000;
export const DEFAULT_MODEL = 'terra';
export const MODEL_TIERS = [
  { id: 'low', label: 'Low', description: 'Tareas ligeras' },
  {
    id: 'mid',
    label: 'Mid — recomendado para empezar',
    description: 'Contexto y continuación de conversaciones',
  },
  { id: 'high', label: 'High', description: 'Trabajo complejo' },
  { id: 'frontier', label: 'Frontier', description: 'Tareas de máxima exigencia' },
];
// PLM workflow categories, not an official vendor ranking or a statement of account availability.
export const MODELS = [
  { id: 'luna', name: 'Luna', tier: 'low', provider: 'codex' },
  { id: 'flash-lite', name: 'Gemini Flash-Lite', tier: 'low', provider: 'antigravity' },
  { id: 'terra', name: 'Terra', tier: 'mid', provider: 'codex' },
  { id: 'flash', name: 'Gemini Flash', tier: 'mid', provider: 'antigravity' },
  { id: 'haiku', name: 'Claude Haiku', tier: 'mid', provider: 'claude' },
  { id: 'sonnet', name: 'Claude Sonnet', tier: 'mid', provider: 'claude' },
  { id: 'sol', name: 'Sol', tier: 'high', provider: 'codex' },
  { id: 'gemini-pro', name: 'Gemini Pro', tier: 'high', provider: 'antigravity' },
  { id: 'opus', name: 'Claude Opus', tier: 'high', provider: 'claude' },
  { id: 'astra', name: 'Astra', tier: 'frontier', provider: 'codex' },
  { id: 'argon', name: 'Gemini 4 Argon', tier: 'frontier', provider: 'antigravity' },
  { id: 'mythos', name: 'Claude Mythos', tier: 'frontier', provider: 'claude' },
];
export function modelById(id) {
  const model = MODELS.find((item) => item.id === id);
  if (!model) throw new Error('Selecciona un modelo del catálogo de PLM.');
  return model;
}
export function contextText(raw) {
  if (typeof raw !== 'string' || raw.length > MAX_CONTEXT_CHARS || raw.includes('\0'))
    throw new Error('El contexto debe ser texto Markdown y no superar 100.000 caracteres.');
  const content = raw.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  if (!content.trim()) throw new Error('El archivo de contexto está vacío.');
  const lines = content.replace(/\n$/, '').split('\n').length;
  if (lines > MAX_CONTEXT_LINES)
    throw new Error(
      `El contexto tiene ${lines} líneas. Pide a la IA que lo resuma a un máximo de ${MAX_CONTEXT_LINES} líneas y vuelve a añadirlo.`,
    );
  return { content, lines };
}
export const CONTEXT_REQUEST = `Genera un archivo Markdown llamado plm.md con el contexto resumido de este proyecto y esta conversación, para que otro agente pueda continuar trabajando bien sin tener que releer todo el chat.

Límite obligatorio: un máximo de 500 líneas. Resume y prioriza lo importante; no rellenes hasta llegar a 500.

Incluye, de forma clara y compacta:
1. Objetivo del proyecto, alcance y resultado esperado.
2. Requisitos, preferencias y restricciones expresadas por el usuario.
3. Arquitectura y tecnologías, si aplica.
4. Archivos y rutas relevantes, preferiblemente relativos al proyecto.
5. Estado actual: qué está hecho, qué está verificado y qué sigue pendiente.
6. Decisiones tomadas, sus motivos y alternativas descartadas importantes.
7. Comandos de instalación, ejecución y pruebas, cuando proceda.
8. Errores conocidos, riesgos y bloqueos actuales.
9. Próximos pasos priorizados e instrucciones concretas para el siguiente agente.
10. Si el proyecto usaba Git, aplícalo al resumen e indica en qué repositorios se trabajaba: nombres y URLs conocidas sin credenciales, ramas, commits relevantes y cambios pendientes, solo si constan en la conversación. No inventes repositorios ni estados de Git.

Conserva los detalles necesarios para continuar, sin copiar el historial completo. No inventes datos: distingue los hechos comprobados de las suposiciones. No incluyas contraseñas, tokens, claves ni información sensible innecesaria.

Devuelve el archivo plm.md si puedes adjuntarlo. Si no, responde únicamente con su contenido Markdown, sin bloques de código envolventes, para que pueda guardarlo como plm.md e importarlo en PLM.`;
