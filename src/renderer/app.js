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
  render();
}
function sidebar() {
  return `<aside class="sidebar">
    <div class="brand"><div class="brand-symbol">p<span>l</span>m</div><span class="version">LAB 0.1</span></div>
    <div class="brand-caption">poors LLM</div>
    <button class="new-project" data-action="new">${icon('plus')} Nuevo proyecto <span>↗</span></button>
    <div class="sidebar-section"><span>ESPACIO DE TRABAJO</span><span>${String(workspace.projects.length).padStart(2, '0')}</span></div>
    <nav aria-label="Proyectos">${workspace.projects.length ? workspace.projects.map((project) => `<button data-project="${escape(project.id)}" class="project-link ${selected === project.id ? 'active' : ''}">${icon('folder')}<span>${escape(project.name)}</span>${selected === project.id ? '<i></i>' : ''}</button>`).join('') : '<p class="sidebar-empty">Tus proyectos aparecerán aquí.</p>'}</nav>
    <button class="import-link" data-action="import">${icon('upload')} Importar proyecto PLM</button>
    <div class="sidebar-bottom"><div class="local-dot"></div><div>Tu espacio, en tu equipo.<small>Sin cuenta de PLM · Sin nube</small></div></div>
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
  return `<div class="conversation-body">${p.messages.length ? p.messages.map((m) => `<article class="message"><div class="message-avatar ${m.role === 'user' ? 'user' : m.provider}">${m.role === 'user' ? 'Tú' : m.role === 'note' ? '↳' : tools[m.provider].mark}</div><div class="message-content"><div class="message-meta"><strong>${m.role === 'user' ? 'Tú' : m.role === 'note' ? 'Nota de trabajo' : tools[m.provider].name}</strong><span>${formatDate(m.createdAt)}</span><button data-remove-message="${escape(m.id)}" class="remove-message" aria-label="Eliminar mensaje">×</button></div><p>${escape(m.content)}</p>${m.role === 'assistant' ? '<small class="entry-source">Respuesta añadida manualmente</small>' : ''}</div></article>`).join('') : `<div class="conversation-empty"><div class="empty-orbit">${icon('chat')}</div><h3>Las herramientas cambian.<br>Tu trabajo continúa.</h3><p>Añade una pregunta, una respuesta o una nota.<br>Decide qué contexto llevarte al siguiente paso.</p></div>`}</div>
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
  return `<form id="context-form" class="context-form"><label>Nombre del proyecto<input name="name" value="${escape(draft.name)}" maxlength="120" required></label><label>Objetivo<textarea name="goal" rows="3" maxlength="20000" placeholder="El resultado que quieres conseguir">${escape(draft.goal)}</textarea></label><label>Decisiones tomadas<textarea name="decisions" rows="4" maxlength="100000" placeholder="Qué habéis decidido y por qué">${escape(draft.decisions)}</textarea></label><label>Próximos pasos<textarea name="nextSteps" rows="4" maxlength="100000" placeholder="Qué debería hacer la siguiente herramienta">${escape(draft.nextSteps)}</textarea></label><div class="form-actions"><span>Guarda los cambios antes de preparar un traspaso.</span><button type="submit" class="primary">Guardar contexto ${icon('arrow')}</button></div></form>`;
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
    <div class="field-caption">DESTINO</div><div class="target-tools" role="group" aria-label="Destino del contexto">${Object.entries(
      tools,
    )
      .map(
        ([id, tool]) =>
          `<button data-target="${id}" class="${target === id ? 'selected' : ''}" aria-pressed="${target === id}"><span class="tiny-mark ${id}">${tool.mark}</span>${tool.name}</button>`,
      )
      .join('')}</div>
    <div class="context-summary"><div><span>${icon('edit')} Objetivo y decisiones</span><span>Siempre</span></div><label><span>${icon('chat')} Historial de conversación <small>${p.messages.length} entradas</small></span><input id="include-history" type="checkbox" ${includeHistory ? 'checked' : ''}></label><label><span>${icon('folder')} Ruta de la carpeta <small>Sin adjuntar archivos</small></span><input id="include-folder" type="checkbox" ${includeFolder ? 'checked' : ''} ${p.folder ? '' : 'disabled'}></label></div>
    <button class="preview-button" data-action="preview">Revisar contexto ${icon('arrow')}</button>
    <div class="handoff-buttons"><button class="primary" data-action="copy">${icon('copy')} Copiar contexto</button><button class="secondary" data-action="export-handoff" aria-label="Exportar contexto Markdown" title="Exportar Markdown">${icon('download')}</button></div>
    <div class="handoff-instructions"><div class="step"><span>1</span><p>Copia y revisa tu contexto.</p></div><div class="step"><span>2</span><p>Abre ${selectedTool.name} y pégalo en su chat.</p></div><button class="launch-target" data-launch="${target}" ${providers.find((item) => item.id === target)?.installed ? '' : 'disabled'}>Abrir ${selectedTool.name} ${icon('external')}</button></div>
    <div class="privacy-note">${icon('shield')}<p>El contexto se prepara en tu equipo. Tú decides cuándo y con quién compartirlo.</p></div>
    <button class="source-link" data-docs="${target}">Condiciones de ${selectedTool.name} ${icon('external')}</button>`;
}
function renderRight() {
  const p = current();
  if (p && $('#handoff-panel')) $('#handoff-panel').innerHTML = handoffPanel(p);
}
function render() {
  const p = current();
  $('#app').innerHTML =
    `${sidebar()}<main class="main"><header class="topbar"><div>${icon('layers')}<span>Workspace</span><span class="breadcrumb">/</span><strong>${p ? escape(p.name) : 'Bienvenido'}</strong></div><div><span class="local-badge"><i></i> Local</span><button class="icon-button" data-action="refresh-providers" title="Volver a detectar aplicaciones" aria-label="Volver a detectar aplicaciones">↻</button></div></header><div class="workspace-content"><div class="page-heading"><div><span class="eyebrow">UN PROYECTO. DISTINTAS PERSPECTIVAS.</span><h1>${p ? escape(p.name) : 'Tu trabajo, sin perder el hilo.'}</h1><p>${p ? 'Un espacio común para lo que construyes con tus herramientas.' : 'Reúne tus proyectos y conserva el contexto entre aplicaciones.'}</p></div>${p ? `<button class="secondary" data-action="export-project">${icon('download')} Exportar proyecto</button>` : '<span class="edition">PLM / EXPERIMENTAL</span>'}</div>${providerCards()}
      ${p ? `<div class="workspace-grid"><section class="work-panel"><div class="panel-tabs" role="tablist" aria-label="Contenido del proyecto"><button role="tab" data-tab="conversation" aria-selected="${tab === 'conversation'}" class="${tab === 'conversation' ? 'active' : ''}">${icon('chat')} Conversación <span>${p.messages.length}</span></button><button role="tab" data-tab="context" aria-selected="${tab === 'context'}" class="${tab === 'context' ? 'active' : ''}">${icon('edit')} Contexto</button><button role="tab" data-tab="activity" aria-selected="${tab === 'activity'}" class="${tab === 'activity' ? 'active' : ''}">${icon('clock')} Actividad</button></div><div class="tab-content">${tab === 'conversation' ? conversation(p) : tab === 'context' ? context(p) : activity(p)}</div><div class="project-footer"><button data-action="reveal-folder" ${p.folder ? '' : 'disabled'} title="${escape(p.folder)}">${icon('folder')} ${p.folder ? escape(p.folder.split(/[\\/]/).filter(Boolean).pop()) : 'Sin carpeta vinculada'}</button><button data-action="delete-project" class="delete-project">Eliminar proyecto</button></div></section><aside id="handoff-panel" class="handoff-panel">${handoffPanel(p)}</aside></div>` : `<section class="welcome-panel"><div class="welcome-art"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><span class="art-center">plm</span><span class="art-node node-codex">C</span><span class="art-node node-claude">✳</span><span class="art-node node-antigravity">A</span></div><div><span class="eyebrow">CADA IDEA TIENE UN PUNTO DE PARTIDA</span><h2>Empieza un proyecto.<br>Conserva lo que importa.</h2><p>Registra tus decisiones, reúne las respuestas y prepara el contexto para tu siguiente conversación.</p><button class="primary" data-action="new">Crear mi primer proyecto ${icon('arrow')}</button></div></section>`}
      <footer class="workspace-footer"><span>PLM — poors LLM</span><span>Aplicaciones originales · Traspasos manuales · Datos locales</span></footer></div></main>`;
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
      if (button.dataset.project) {
        selected = button.dataset.project;
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
        target = button.dataset.target;
        renderRight();
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
          chosenFolder = '';
          $('#project-form').reset();
          $('#chosen-folder').textContent = 'Sin carpeta seleccionada';
          $('#project-dialog').showModal();
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
        case 'import': {
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
            selected = null;
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
document.addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.target,
    input = Object.fromEntries(new FormData(form));
  void run(form.id, async () => {
    const submit = form.querySelector('[type="submit"]');
    if (submit) submit.disabled = true;
    try {
      if (form.id === 'project-form') {
        const project = await api.createProject({ ...input, folder: chosenFolder });
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
try {
  [workspace, providers] = await Promise.all([api.workspace(), api.providers()]);
  selected = workspace.projects[0]?.id || null;
  render();
} catch (error) {
  $('#app').textContent = `No se ha podido abrir PLM: ${error.message}`;
}
