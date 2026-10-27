import {
  MODELS,
  MODEL_TIERS,
  DEFAULT_MODEL,
  modelById,
  CONTEXT_REQUEST,
  contextText,
} from '../shared/context.js';
const api = window.plm;
const $ = (selector) => document.querySelector(selector);
const escape = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  );
const icons = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10H3V7Z"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  upload: '<path d="M12 16V4m-5 5 5-5 5 5M4 17v4h16v-4"/>',
  copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
  chat: '<path d="M21 11a8 8 0 0 1-8 8H7l-4 3V11a9 9 0 0 1 18 0Z"/>',
  external: '<path d="M14 3h7v7m0-7L10 14M11 3H3v18h18v-8"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  edit: '<path d="m15 4 5 5M4 20l5-1L21 7l-5-5L4 14v6Z"/>',
};
const icon = (name) =>
  `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || ''}</svg>`;
const tools = {
  codex: { name: 'Codex', mark: 'C', description: 'Piensa, construye y revisa.' },
  claude: { name: 'Claude', mark: '✳', description: 'Otra perspectiva, el mismo proyecto.' },
  antigravity: {
    name: 'Antigravity',
    mark: 'A',
    description: 'Continúa en su aplicación original.',
  },
};
let workspace = { projects: [] },
  providers = [],
  selected = null,
  target = 'claude',
  tab = 'conversation',
  chosenFolder = '';
let includeHistory = true,
  includeFolder = false,
  toastTimer;
let pendingContext = null;
let parentProject = null;
let handoffOpen = false;
let navigationOpen = false;
const collapsedFolders = new Set();
const scrollPositions = new Map();
const contextDrafts = new Map(),
  composerDrafts = new Map(),
  pending = new Set();
const current = () => workspace.projects.find((project) => project.id === selected);
const formatDate = (date) =>
  new Date(date).toLocaleString('es-ES', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
function toast(message, error = false) {
  $('#toast').textContent = String(message).replace(
    /^Error invoking remote method '[^']+': (Error: )?/,
    '',
  );
  $('#toast').className = error ? 'visible error' : 'visible';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(
    () => {
      $('#toast').className = '';
    },
    error ? 8500 : 3800,
  );
}
async function refresh() {
  workspace = await api.workspace();
  target = modelById(current()?.preferredModel ?? DEFAULT_MODEL).provider;
  render();
}
function modelOptions(selectedModel = DEFAULT_MODEL) {
  return MODEL_TIERS.map(
    (tier) =>
      `<optgroup label="${escape(tier.label)}">${MODELS.filter((model) => model.tier === tier.id)
        .map(
          (model) =>
            `<option value="${model.id}" ${model.id === selectedModel ? 'selected' : ''}>${escape(model.name)} · ${tools[model.provider].name}</option>`,
        )
        .join('')}</optgroup>`,
  ).join('');
}
function projectLink(project) {
  return `<button data-project="${escape(project.id)}" class="project-link ${selected === project.id ? 'active' : ''}" ${selected === project.id ? 'aria-current="page"' : ''}>${icon('chat')}<span>${escape(project.name)}</span></button>`;
}
function sidebar() {
  const groups = new Map();
  for (const project of workspace.projects) {
    if (project.folder) {
      if (!groups.has(project.folder)) groups.set(project.folder, []);
      groups.get(project.folder).push(project);
    }
  }
  const folders = [...groups]
    .map(([folder, projects]) => {
      const id = projects[0].id;
      const name = folder.split(/[\\/]/).filter(Boolean).pop() || folder;
      const open = !collapsedFolders.has(folder);
      return `<section class="folder-group"><button class="folder-heading" data-folder="${escape(id)}" aria-expanded="${open}" title="${escape(folder)}">${icon('folder')}<span>${escape(name)}</span><small>${projects.length}</small><span>${open ? '⌄' : '›'}</span></button><div class="folder-children" ${open ? '' : 'hidden'}>${projects.map(projectLink).join('')}<button class="folder-new" data-new-conversation="${escape(id)}">${icon('plus')} Nueva conversación</button></div></section>`;
    })
    .join('');
  return `<aside class="sidebar ${navigationOpen ? 'is-open' : ''}">
    <div class="brand"><div class="brand-symbol">p<span>l</span>m</div><button class="nav-close" data-action="navigation" aria-label="Cerrar navegación">×</button><span class="version">0.3</span></div>
    <div class="brand-caption">poors LLM</div>
    <button class="new-project" data-action="new">${icon('plus')} Nuevo proyecto <span>↗</span></button>
    <div class="sidebar-section"><span>CARPETAS Y CONVERSACIONES</span><span>${workspace.projects.length}</span></div>
    <nav aria-label="Proyectos">${folders}${workspace.projects.some((p) => !p.folder) ? '<div class="standalone-label">Sin carpeta</div>' : ''}${workspace.projects
      .filter((p) => !p.folder)
      .map(projectLink)
      .join(
        '',
      )}${workspace.projects.length ? '' : '<p class="sidebar-empty">Crea una conversación o importa tu contexto para empezar.</p>'}</nav>
    <details class="context-import-menu"><summary>${icon('upload')} Importar contexto <span>⌄</span></summary><div class="context-import-guide"><p>Pídele a la IA de la conversación que genere <strong>plm.md</strong> con el contexto resumido del proyecto para que otro agente pueda continuar bien.</p><p><strong>Máximo 500 líneas.</strong> Incluye objetivo, decisiones, estado actual y próximos pasos.</p><button class="secondary" data-action="copy-context-request">${icon('copy')} Copiar petición para la IA</button><details class="request-details"><summary>Ver la petición completa</summary><pre>${escape(CONTEXT_REQUEST)}</pre></details><button class="primary" data-action="choose-context">${icon('upload')} Añadir plm.md</button><p>Después podrás elegir el modelo. Empieza por <strong>Mid</strong>.</p><button class="backup-link" data-action="restore-project">Restaurar copia JSON</button></div></details>
    <button class="apps-button secondary" data-action="applications">${icon('layers')} Aplicaciones</button>
    <div class="sidebar-bottom"><div class="local-dot"></div><div>Guardado en este equipo</div></div>
  </aside>`;
}
function providerCards() {
  return `<div class="provider-grid">${Object.entries(tools)
    .map(([id, tool]) => {
      const provider = providers.find((p) => p.id === id);
      return `<article class="provider-card ${id}"><div class="provider-top"><span class="tool-mark ${id}">${tool.mark}</span><span class="availability ${provider?.installed ? 'detected' : ''}"><i></i>${provider?.installed ? 'Detectada' : 'Seleccionar app'}</span></div><h3>${tool.name}</h3><p>${tool.description}</p><div class="provider-actions"><button data-launch="${id}" ${provider?.installed ? '' : 'disabled'}>Abrir aplicación ${icon('external')}</button><button class="configure" data-configure="${id}" aria-label="Ubicación de ${tool.name}" title="Seleccionar ubicación">${icon('folder')}</button></div></article>`;
    })
    .join('')}</div>`;
}
function conversation(p) {
  const draft = composerDrafts.get(p.id) || { content: '', role: 'user', provider: 'codex' };
  return `<div class="conversation-body" data-conversation="${escape(p.id)}">${p.messages.length ? p.messages.map((m) => `<article class="message"><div class="message-avatar ${m.role === 'user' ? 'user' : m.provider}">${m.role === 'user' ? 'Tú' : m.role === 'note' ? '↳' : tools[m.provider].mark}</div><div class="message-content"><div class="message-meta"><strong>${m.role === 'user' ? 'Tú' : m.role === 'note' ? 'Nota de trabajo' : tools[m.provider].name}</strong><span>${formatDate(m.createdAt)}</span><button data-remove-message="${escape(m.id)}" class="remove-message" aria-label="Eliminar mensaje">×</button></div><p>${escape(m.content)}</p>${m.role === 'assistant' ? '<small class="entry-source">Respuesta añadida manualmente</small>' : ''}</div></article>`).join('') : `<div class="conversation-empty"><div class="empty-orbit">${icon('chat')}</div><h3>Esta conversación está lista</h3><p>Guarda mensajes, respuestas o notas aquí.<br>Usa «Continuar en otra app» para llevarte el contexto.</p></div>`}</div>
    <form id="message-form" class="composer"><textarea name="content" aria-label="Mensaje o nota" placeholder="Añade lo que quieras conservar de esta conversación…" rows="3" maxlength="100000" required>${escape(draft.content)}</textarea><div class="composer-toolbar"><div class="composer-fields"><select name="role" aria-label="Tipo de entrada"><option value="user" ${draft.role === 'user' ? 'selected' : ''}>Mi mensaje</option><option value="assistant" ${draft.role === 'assistant' ? 'selected' : ''}>Respuesta de la herramienta</option><option value="note" ${draft.role === 'note' ? 'selected' : ''}>Nota</option></select><select name="provider" aria-label="Herramienta de origen">${Object.entries(
      tools,
    )
      .map(
        ([id, tool]) =>
          `<option value="${id}" ${draft.provider === id ? 'selected' : ''}>${tool.name}</option>`,
      )
      .join(
        '',
      )}</select></div><button class="primary small" type="submit">Guardar entrada ${icon('plus')}</button></div></form><div class="composer-caption">Se guarda en PLM. Para hablar con un modelo, abre su aplicación.</div>`;
}
function context(p) {
  const draft = contextDrafts.get(p.id) || p;
  const base = p.importedContext
    ? `<details class="import-preview saved-context"><summary>plm.md · ${contextText(p.importedContext).lines} / 500 líneas · contexto importado</summary><pre>${escape(p.importedContext)}</pre></details>`
    : '';
  return `${base}<form id="context-form" class="context-form"><label>Nombre de la conversación<input name="name" value="${escape(draft.name)}" maxlength="120" required></label><label>Contexto duro<textarea name="goal" rows="3" maxlength="20000" placeholder="ejemplos: En cada mensaje de esta conversacion se usara git para especificar que se ha hecho en cada prompt.">${escape(draft.goal)}</textarea></label><label>Decisiones tomadas<textarea name="decisions" rows="4" maxlength="100000" placeholder="Qué habéis decidido y por qué">${escape(draft.decisions)}</textarea></label><label>Próximos pasos<textarea name="nextSteps" rows="4" maxlength="100000" placeholder="Qué debería hacer la siguiente herramienta">${escape(draft.nextSteps)}</textarea></label><div class="form-actions"><span>Guarda los cambios antes de preparar un traspaso.</span><button type="submit" class="primary">Guardar contexto ${icon('arrow')}</button></div></form>`;
}
function activity(p) {
  return `<div class="activity-list">${
    p.handoffs.length
      ? [...p.handoffs]
          .reverse()
          .map(
            (h) =>
              `<article class="activity"><div class="activity-icon">${icon(h.kind === 'copied' ? 'copy' : 'download')}</div><div><strong>Contexto ${h.kind === 'copied' ? 'copiado' : 'exportado'} para ${tools[h.provider].name}</strong><p>${formatDate(h.createdAt)}</p><small>Este registro no confirma el envío ni la lectura en la otra aplicación.</small></div></article>`,
          )
          .join('')
      : '<div class="empty-activity">Todavía no has preparado ningún traspaso.<br>Los contextos copiados o exportados aparecerán aquí.</div>'
  }</div>`;
}
function handoffPanel(p) {
  const selectedTool = tools[target];
  return `<div class="handoff-heading"><span class="eyebrow">SIGUIENTE PASO</span>${icon('layers')}</div><h2>Continúa donde quieras.</h2><p class="handoff-intro">Llévate lo que ya sabes a otra herramienta.</p>
    <label class="model-picker">Modelo de continuación<select id="continuation-model">${modelOptions(p.preferredModel)}</select></label><p class="model-guidance">Mid recomendado para empezar. Selecciona después ese modelo en su aplicación oficial; la disponibilidad depende de tu cuenta.</p>
    <div class="field-caption">DESTINO</div><div class="target-tools" role="group" aria-label="Destino del contexto">${Object.entries(
      tools,
    )
      .map(
        ([id, tool]) =>
          `<button data-target="${id}" class="${target === id ? 'selected' : ''}" aria-pressed="${target === id}"><span class="tiny-mark ${id}">${tool.mark}</span>${tool.name}</button>`,
      )
      .join('')}</div>
    <div class="context-summary">${p.importedContext ? `<div><span>${icon('edit')} plm.md · ${contextText(p.importedContext).lines} líneas</span><span>Siempre</span></div>` : ''}<div><span>${icon('edit')} Contexto duro y decisiones</span><span>Siempre</span></div><label><span>${icon('chat')} Historial de conversación <small>${p.messages.length} entradas</small></span><input id="include-history" type="checkbox" ${includeHistory ? 'checked' : ''}></label><label><span>${icon('folder')} Ruta de la carpeta <small>Sin adjuntar archivos</small></span><input id="include-folder" type="checkbox" ${includeFolder ? 'checked' : ''} ${p.folder ? '' : 'disabled'}></label></div>
    <button class="preview-button" data-action="preview">Revisar contexto ${icon('arrow')}</button>
    <div class="handoff-buttons"><button class="primary" data-action="copy">${icon('copy')} Copiar contexto</button><button class="secondary" data-action="export-handoff" aria-label="Exportar contexto Markdown" title="Exportar Markdown">${icon('download')}</button></div>
    <div class="handoff-instructions"><div class="step"><span>1</span><p>Copia y revisa tu contexto.</p></div><div class="step"><span>2</span><p>Abre ${selectedTool.name} y pégalo en su chat.</p></div><button class="launch-target" data-launch="${target}" ${providers.find((item) => item.id === target)?.installed ? '' : 'disabled'}>Abrir ${selectedTool.name} ${icon('external')}</button></div>
    <div class="privacy-note">${icon('shield')}<p>El contexto se prepara en tu equipo. Tú decides cuándo y con quién compartirlo.</p></div>
    <button class="source-link" data-docs="${target}">Condiciones de ${selectedTool.name} ${icon('external')}</button>`;
}
function renderRight() {
  const p = current();
  if (p && $('#handoff-content')) $('#handoff-content').innerHTML = handoffPanel(p);
}
function render() {
  const previousBody = $('.conversation-body');
  if (previousBody) scrollPositions.set(previousBody.dataset.conversation, previousBody.scrollTop);
  const p = current();
  $('#app').innerHTML =
    `${sidebar()}<main class="main"><header class="topbar"><div><button class="nav-toggle secondary" data-action="navigation" aria-label="Abrir navegación">☰</button><span>${p?.folder ? 'Carpeta' : 'Conversaciones'}</span><span class="breadcrumb">/</span><strong>${p?.folder ? escape(p.folder.split(/[\\/]/).filter(Boolean).pop()) : 'Sin carpeta'}</strong></div><button class="secondary" data-action="applications">${icon('external')} Aplicaciones</button></header>
    <div class="workspace-content"><div class="page-heading"><h1>${p ? escape(p.name) : 'Tu siguiente conversación'}</h1><div class="heading-actions">${p?.folder ? `<button class="secondary" data-new-conversation="${escape(p.id)}" title="Crear otra conversación en esta carpeta">${icon('plus')} Nueva conversación</button>` : ''}${p ? `<button class="secondary handoff-toggle" data-action="toggle-handoff" aria-expanded="${handoffOpen}">${icon('copy')} Continuar en otra app</button>` : ''}</div></div>
    ${p ? `<div class="workspace-grid ${handoffOpen ? 'with-handoff' : ''}"><section class="work-panel"><div class="panel-tabs" role="tablist" aria-label="Contenido de la conversación"><button role="tab" data-tab="conversation" aria-selected="${tab === 'conversation'}" class="${tab === 'conversation' ? 'active' : ''}">${icon('chat')} Conversación <span>${p.messages.length}</span></button><button role="tab" data-tab="context" aria-selected="${tab === 'context'}" class="${tab === 'context' ? 'active' : ''}">${icon('edit')} Contexto</button><button role="tab" data-tab="activity" aria-selected="${tab === 'activity'}" class="${tab === 'activity' ? 'active' : ''}">${icon('clock')} Actividad</button></div><div class="tab-content ${tab === 'conversation' ? 'chat-content' : ''}">${tab === 'conversation' ? conversation(p) : tab === 'context' ? context(p) : activity(p)}</div><div class="project-footer"><button data-action="reveal-folder" ${p.folder ? '' : 'disabled'} title="${escape(p.folder)}">${icon('folder')} ${p.folder ? 'Abrir carpeta' : 'Sin carpeta'}</button><button data-action="export-project">${icon('download')} Exportar conversación</button><button data-action="delete-project" class="delete-project">Eliminar conversación</button></div></section>${handoffOpen ? `<aside id="handoff-panel" class="handoff-panel" aria-label="Continuar en otra aplicación"><button class="handoff-close secondary" data-action="toggle-handoff" aria-label="Cerrar traspaso">Cerrar ×</button><div id="handoff-content">${handoffPanel(p)}</div></aside>` : ''}</div>` : `<section class="welcome-panel"><div><h2>Conserva el contexto.<br>Continúa en tu aplicación.</h2><p>Crea una conversación independiente o agrupa varias en una carpeta. Importa un plm.md para retomar trabajo anterior.</p><button class="primary" data-action="new">Crear mi primer proyecto ${icon('plus')}</button></div></section>`}</div></main>`;
  const body = $('.conversation-body');
  if (body) body.scrollTop = scrollPositions.get(p.id) ?? body.scrollHeight;
  if ($('#applications-dialog').open) $('#applications-content').innerHTML = providerCards();
}
function openProjectDialog(parent = null) {
  parentProject = parent?.id || null;
  chosenFolder = parent?.folder || '';
  $('#project-form').reset();
  $('#project-dialog-title').textContent = parent ? 'Nueva conversación' : 'Nuevo proyecto';
  $('#project-form [type="submit"]').textContent = parent ? 'Crear conversación' : 'Crear proyecto';
  $('#project-form .scope-options').hidden = !!parent;
  $('#project-folder-selection').hidden = true;
  $('#chosen-folder').textContent = 'Sin carpeta seleccionada';
  $('#conversation-folder-info').textContent = parent ? `En la carpeta: ${parent.folder}` : '';
  $('#conversation-folder-info').hidden = !parent;
  $('#project-dialog').showModal();
}
const options = () => ({ includeHistory, includeFolder });
function requireSavedContext() {
  const project = current();
  const draft = contextDrafts.get(project?.id);
  if (
    draft &&
    ['name', 'goal', 'decisions', 'nextSteps'].some((key) => draft[key]?.trim() !== project[key])
  ) {
    throw new Error('Guarda los cambios de la pestaña Contexto antes de preparar el traspaso.');
  }
}
async function run(key, operation) {
  if (pending.has(key)) return;
  pending.add(key);
  try {
    await operation();
  } catch (error) {
    toast(error.message || error, true);
  } finally {
    pending.delete(key);
  }
}
document.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button || button.disabled) return;
  void run(
    button.dataset.action ||
      button.dataset.launch ||
      button.dataset.configure ||
      button.dataset.docs ||
      'navigation',
    async () => {
      if (button.dataset.folder) {
        const folder = workspace.projects.find((p) => p.id === button.dataset.folder)?.folder;
        if (collapsedFolders.has(folder)) collapsedFolders.delete(folder);
        else collapsedFolders.add(folder);
        render();
        return;
      }
      if (button.dataset.newConversation) {
        openProjectDialog(workspace.projects.find((p) => p.id === button.dataset.newConversation));
        return;
      }
      if (button.dataset.project) {
        navigationOpen = false;
        selected = button.dataset.project;
        target = modelById(current().preferredModel).provider;
        includeFolder = false;
        tab = 'conversation';
        render();
        return;
      }
      if (button.dataset.tab) {
        tab = button.dataset.tab;
        render();
        return;
      }
      if (button.dataset.target) {
        const provider = button.dataset.target;
        const model = modelById(current().preferredModel);
        await api.selectModel(
          selected,
          model.provider === provider
            ? model.id
            : MODELS.find((item) => item.provider === provider && item.tier === 'mid').id,
        );
        await refresh();
        return;
      }
      if (button.dataset.launch) {
        await api.launchProvider(button.dataset.launch);
        toast(`Inicio de ${tools[button.dataset.launch].name} solicitado.`);
        return;
      }
      if (button.dataset.configure) {
        if (await api.configureProvider(button.dataset.configure)) {
          providers = await api.providers();
          render();
          toast('Ubicación guardada.');
        }
        return;
      }
      if (button.dataset.docs) {
        await api.documentation(button.dataset.docs);
        return;
      }
      if (button.dataset.removeMessage) {
        await api.deleteMessage(selected, button.dataset.removeMessage);
        await refresh();
        return;
      }
      switch (button.dataset.action) {
        case 'new':
          openProjectDialog();
          break;
        case 'navigation':
          navigationOpen = !navigationOpen;
          render();
          break;
        case 'toggle-handoff':
          handoffOpen = !handoffOpen;
          render();
          break;
        case 'applications':
          $('#applications-content').innerHTML = providerCards();
          $('#applications-dialog').showModal();
          break;
        case 'close-dialog':
          button.closest('dialog')?.close();
          break;
        case 'choose-folder':
          chosenFolder = await api.chooseFolder();
          $('#chosen-folder').textContent = chosenFolder || 'Sin carpeta seleccionada';
          break;
        case 'preview':
          requireSavedContext();
          $('#preview-content').textContent = await api.handoff(selected, target, options());
          $('#preview-dialog').showModal();
          break;
        case 'copy':
          requireSavedContext();
          await api.copyHandoff(selected, target, options());
          await refresh();
          toast('Contexto copiado. Revísalo y pégalo en la aplicación de destino.');
          break;
        case 'export-handoff':
          requireSavedContext();
          if (await api.exportHandoff(selected, target, options())) {
            await refresh();
            toast('Contexto exportado como Markdown.');
          }
          break;
        case 'export-project':
          if (await api.exportProject(selected)) toast('Proyecto exportado sin rutas locales.');
          break;
        case 'copy-context-request':
          await api.copyContextRequest();
          toast('Petición copiada. Pégala en la conversación que quieres resumir.');
          break;
        case 'choose-context': {
          const file = await api.chooseContext();
          if (!file) break;
          pendingContext = file;
          $('#context-file-info').textContent =
            `${file.filename} · ${file.lines} / 500 líneas. Revisa el contexto y elige con qué modelo continuar.`;
          $('#context-import-form [name="name"]').value = file.name;
          $('#import-model').innerHTML = modelOptions();
          $('#import-context-content').textContent = file.content;
          $('#toast').className = '';
          $('#context-dialog').showModal();
          break;
        }
        case 'restore-project': {
          const project = await api.importProject();
          if (project) {
            selected = project.id;
            await refresh();
            toast('Proyecto importado.');
          }
          break;
        }
        case 'delete-project':
          if (await api.deleteProject(selected)) {
            contextDrafts.delete(selected);
            composerDrafts.delete(selected);
            selected = workspace.projects.find((p) => p.id !== selected)?.id || null;
            await refresh();
          }
          break;
        case 'reveal-folder':
          await api.revealFolder(selected);
          break;
        case 'refresh-providers':
          providers = await api.providers();
          render();
          toast('Aplicaciones actualizadas.');
          break;
      }
    },
  );
});
document.addEventListener('change', (event) => {
  if (event.target.form?.id === 'project-form' && event.target.name === 'scope') {
    const withFolder = event.target.value === 'folder';
    $('#project-folder-selection').hidden = !withFolder;
    if (!withFolder) {
      chosenFolder = '';
      $('#chosen-folder').textContent = 'Sin carpeta seleccionada';
    }
  }
  if (event.target.id === 'continuation-model') {
    const control = event.target;
    control.disabled = true;
    const projectId = selected,
      modelId = event.target.value;
    void run('select-model', async () => {
      try {
        await api.selectModel(projectId, modelId);
        await refresh();
        toast('Modelo guardado. Selecciónalo en la aplicación oficial para continuar.');
      } finally {
        control.disabled = false;
      }
    });
  }
  if (event.target.id === 'include-history') includeHistory = event.target.checked;
  if (event.target.id === 'include-folder') includeFolder = event.target.checked;
  rememberDraft(event);
});
function rememberDraft(event) {
  const form = event.target.closest('form');
  if (form?.id === 'context-form')
    contextDrafts.set(selected, Object.fromEntries(new FormData(form)));
  if (form?.id === 'message-form')
    composerDrafts.set(selected, Object.fromEntries(new FormData(form)));
}
document.addEventListener('input', rememberDraft);
$('#context-dialog').addEventListener('close', () => {
  if (pendingContext) {
    const token = pendingContext.token;
    pendingContext = null;
    void run('discard-context', () => api.discardContext(token));
  }
});
document.addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.target,
    input = Object.fromEntries(new FormData(form));
  void run(form.id, async () => {
    const submit = form.querySelector('[type="submit"]');
    if (submit) submit.disabled = true;
    try {
      if (form.id === 'context-import-form') {
        if (!pendingContext) throw new Error('Añade primero tu archivo plm.md.');
        const project = await api.importContext({
          token: pendingContext.token,
          name: input.name,
          model: input.model,
        });
        pendingContext = null;
        selected = project.id;
        includeFolder = false;
        tab = 'context';
        $('#context-dialog').close();
        await refresh();
        toast('Contexto importado. Ya puedes continuar con el modelo elegido.');
      }
      if (form.id === 'project-form') {
        const project = await api.createProject({
          ...input,
          scope: parentProject ? 'folder' : input.scope,
          folder: chosenFolder,
          parentId: parentProject,
        });
        if (project.folder) collapsedFolders.delete(project.folder);
        navigationOpen = false;
        selected = project.id;
        tab = 'conversation';
        $('#project-dialog').close();
        await refresh();
      }
      if (form.id === 'message-form') {
        const id = selected;
        await api.addMessage(id, input);
        composerDrafts.delete(id);
        await refresh();
        $('.conversation-body')?.scrollTo(0, 1e9);
        toast('Entrada guardada en tu proyecto.');
      }
      if (form.id === 'context-form') {
        const id = selected;
        await api.updateProject(id, input);
        contextDrafts.delete(id);
        await refresh();
        toast('Contexto guardado.');
      }
    } finally {
      if (submit) submit.disabled = false;
    }
  });
});
if (!api) {
  $('#app').innerHTML =
    '<main class="desktop-required"><span class="eyebrow">PLM — POORS LLM</span><h1>Abre PLM desde tu menú de aplicaciones</h1><p>Esta vista previa contiene la interfaz. Para guardar proyectos y abrir tus herramientas, utiliza la aplicación de escritorio instalada.</p><p>En Linux puedes iniciarla con <code>gtk-launch dev.plm.desktop</code> después de instalar el acceso.</p></main>';
} else
  try {
    [workspace, providers] = await Promise.all([api.workspace(), api.providers()]);
    selected = workspace.projects[0]?.id || null;
    target = modelById(current()?.preferredModel ?? DEFAULT_MODEL).provider;
    render();
    await api.ready();
  } catch (error) {
    $('#app').textContent = `No se ha podido abrir PLM: ${error.message}`;
  }
