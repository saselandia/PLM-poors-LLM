import { MODELS, MODEL_TIERS, DEFAULT_MODEL, modelById, contextText } from '../shared/context.js';
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
  chosenFolder = '';
let includeHistory = false,
  includeFolder = false,
  toastTimer;
let usage = {};
let usageLoading = false;
let pendingContext = null;
let pasteTargetId = null;
let parentProject = null;
let navigationOpen = false;
const collapsedFolders = new Set();
const continuationStatus = new Map();
const contextDrafts = new Map(),
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
    <div class="brand"><div class="brand-symbol">p<span>l</span>m</div><button class="nav-close" data-action="navigation" aria-label="Cerrar navegación">×</button><span class="version">0.7</span></div>
    <div class="brand-caption">poors LLM</div>
    <button class="new-project" data-action="new">${icon('plus')} Nuevo proyecto <span>↗</span></button>
    <div class="sidebar-section"><span>CONVERSACIONES</span><span>${workspace.projects.length}</span></div>
    <nav aria-label="Proyectos">${folders}${workspace.projects.some((p) => !p.folder) ? '<div class="standalone-label">Sin carpeta</div>' : ''}${workspace.projects
      .filter((p) => !p.folder)
      .map(projectLink)
      .join(
        '',
      )}${workspace.projects.length ? '' : '<p class="sidebar-empty">Pega el resumen de un chat para empezar.</p>'}</nav>
    <div class="sidebar-bottom"><div class="local-dot"></div><div>Guardado en este equipo<button class="backup-link" data-action="restore-project">Importar proyecto (.json)</button></div></div>
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
function archive(p) {
  if (!p.messages.length) return '';
  return `<details class="legacy-archive"><summary>Textos guardados en versiones anteriores · ${p.messages.length}</summary><p>Archivo conservado de la versión anterior de PLM. Solo se incluye al copiar contexto si lo marcas en las opciones.</p>${p.messages.map((m) => `<article class="archived-text"><strong>${m.role === 'user' ? 'Usuario' : m.role === 'note' ? 'Nota' : tools[m.provider].name} · ${formatDate(m.createdAt)}</strong><pre>${escape(m.content)}</pre></article>`).join('')}</details>`;
}
function hasContext(p) {
  return !!(
    p.importedContext ||
    p.goal ||
    p.decisions ||
    p.nextSteps ||
    (includeHistory && p.messages.length)
  );
}
function usageWindows(info) {
  if (!info) return '<p class="usage-empty">Consultando el uso…</p>';
  const windows = (info.windows || [])
    .map((w) => {
      const expired = w.resetsAt != null && w.resetsAt * 1000 <= Date.now();
      const valid = !expired && !w.disabled && w.usedPercent != null;
      const used = w.disabled
        ? 'Cuota deshabilitada'
        : valid
          ? `${Math.round(w.usedPercent * 10) / 10}% usado`
          : expired
            ? 'Pendiente de renovar lectura'
            : 'Porcentaje no disponible';
      const remaining = valid
        ? `${Math.round(w.remainingPercent * 10) / 10}% restante`
        : !expired && !w.disabled && w.remainingAmount != null
          ? `${w.remainingAmount} restantes`
          : '';
      const reset =
        w.resetsAt != null ? `Reinicio: ${formatDate(w.resetsAt * 1000)}` : 'Reinicio no informado';
      return `<div class="usage-window"><div class="usage-window-heading"><strong>${escape(w.label)}</strong><span>${escape(used)}</span></div>${valid ? `<progress max="100" value="${w.usedPercent}" aria-label="${escape(w.label)}: ${escape(used)}"></progress>` : ''}<div class="usage-window-footer"><span>${escape(remaining)}</span><span>${escape(reset)}</span></div></div>`;
    })
    .join('');
  let notice = '';
  if (info.error) notice = info.error;
  else if (info.status === 'waiting')
    notice = 'Conexión activada. Esperando a que el CLI oficial publique sus datos de cuota.';
  else if (info.status === 'disconnected')
    notice = 'Conecta la barra de estado del CLI oficial para recibir su cuota aquí.';
  else if (!windows)
    notice = 'La aplicación todavía no ha publicado datos de cuota para esta sesión.';
  const stamp = info.updatedAt
    ? `${info.stale || info.status === 'error' ? 'Lectura anterior' : 'Última lectura'}: ${formatDate(info.updatedAt)}`
    : '';
  return `${windows}${notice ? `<p class="usage-empty">${escape(notice)}</p>` : ''}${stamp ? `<p class="usage-stamp">${escape(stamp)}${info.stale ? ' · puede haber cambiado' : ''}</p>` : ''}`;
}
// Only the CLIs publish Claude/Antigravity quotas; their desktop apps expose none.
const cliNames = { claude: 'Claude Code', antigravity: 'Antigravity CLI' };
function currentUsage() {
  const info = usage[target];
  const name = tools[target].name;
  const body =
    target !== 'codex' && info && !info.windows?.length && !info.error
      ? `<p class="usage-empty">${name} de escritorio no publica su uso. ${info.connected ? `Aparecerá aquí cuando uses ${cliNames[target]} en la terminal.` : `Solo se puede leer si usas ${cliNames[target]} en la terminal.`}</p>`
      : usageWindows(info);
  return `<section class="current-usage" aria-label="Uso de ${name}"><div class="current-usage-heading"><strong>Uso de ${name}</strong><button class="review-link" data-action="usage">Detalles</button></div>${body}</section>`;
}
function usagePanel() {
  return Object.entries(tools)
    .map(([id, tool]) => {
      const info = usage[id];
      return `<section class="usage-card" data-usage-provider="${id}"><h3>${tool.name}${info?.plan ? ` <small>${escape(info.plan)}</small>` : ''}</h3>${usageWindows(info)}${id !== 'codex' ? `<p class="usage-source">Fuente: barra de estado de ${id === 'claude' ? 'Claude Code' : 'Antigravity CLI'}. Se actualiza cuando lo usas; no extrae datos de los chats de escritorio.</p><button class="secondary" data-usage-${info?.connected ? 'disconnect' : 'connect'}="${id}">${info?.connected ? 'Desconectar medidor' : `Conectar ${id === 'claude' ? 'Claude Code' : 'Antigravity CLI'}`}</button>${info?.connected ? '' : '<p class="usage-connection-note">Activa un script local en la configuración del CLI. Conserva la barra de estado que ya tengas y puedes desconectarlo después.</p>'}` : '<p class="usage-source">Fuente: cliente oficial de Codex. Solo consulta los límites; no inicia chats ni usa modelos.</p>'}<button class="review-link" data-usage-help="${id}">Cómo funciona la conexión</button></section>`;
    })
    .join('');
}
function updateUsageViews() {
  const compact = $('.current-usage');
  if (compact) compact.outerHTML = currentUsage();
  if ($('#usage-dialog').open) $('#usage-content').innerHTML = usagePanel();
  const windows = usage[target]?.windows || [];
  const first = windows.find(
    (w) =>
      !w.disabled &&
      w.usedPercent != null &&
      (w.resetsAt == null || w.resetsAt * 1000 > Date.now()),
  );
  const button = $('#usage-button');
  if (button) {
    const previous = usage[target]?.stale || usage[target]?.status === 'error';
    button.textContent = first
      ? `${tools[target].name}: ${Math.round(first.usedPercent)}%${previous ? ' · anterior' : ''}`
      : 'Uso y límites';
    button.title = first
      ? `${tools[target].name} · ${first.label} · ${Math.round(first.usedPercent)}% usado${previous ? ' · lectura anterior' : ''}`
      : 'Consultar el uso de las tres suscripciones';
  }
}
async function loadUsage(force = false, ensureFresh = false) {
  if (usageLoading) {
    await usageLoading;
    if (!force && !ensureFresh) return;
  }
  $('#refresh-usage').disabled = true;
  usageLoading = (async () => {
    try {
      usage = await api.subscriptionUsage(force);
      updateUsageViews();
    } catch (error) {
      toast(error.message, true);
    } finally {
      usageLoading = null;
      $('#refresh-usage').disabled = false;
    }
  })();
  return usageLoading;
}
function continuation(p) {
  const tool = tools[target];
  const installed = providers.find((item) => item.id === target)?.installed;
  return `<section class="continue-card" aria-labelledby="continue-title"><span class="step-number">2</span><h2 id="continue-title">Continúa en tu aplicación</h2><div class="target-tools" role="group" aria-label="Aplicación de destino">${Object.entries(
    tools,
  )
    .map(
      ([id, tool]) =>
        `<button data-target="${id}" aria-pressed="${target === id}" class="${target === id ? 'selected' : ''}">${tool.name}</button>`,
    )
    .join(
      '',
    )}</div>${currentUsage()}<label class="model-picker">Modelo que usarás en ${tool.name}<select id="continuation-model">${modelOptions(p.preferredModel)}</select></label><p class="model-guidance">Solo es un recordatorio: elígelo también dentro de ${tool.name}.</p>${installed ? `<button class="primary continue-button" data-action="continue" ${hasContext(p) ? '' : 'disabled'}>${icon('external')} Copiar contexto y abrir ${tool.name}</button>` : `<button class="primary continue-button" data-configure="${target}">${icon('folder')} Seleccionar aplicación de ${tool.name}</button>`}<p class="continue-help">${hasContext(p) ? `Después, elige el chat en ${tool.name} y pega con Ctrl+V (⌘V en Mac).` : 'Primero pega el resumen de tu chat.'}</p><div class="continue-status" role="status">${escape(continuationStatus.get(p.id) || '')}</div><button class="review-link" data-action="preview" ${hasContext(p) ? '' : 'disabled'}>Revisar lo que se copiará</button><details class="copy-options"><summary>Opciones de copia y exportación</summary><label><input id="include-folder" type="checkbox" ${includeFolder ? 'checked' : ''} ${p.folder ? '' : 'disabled'}> Incluir ruta de carpeta (no adjunta archivos)</label>${p.messages.length ? `<label><input id="include-history" type="checkbox" ${includeHistory ? 'checked' : ''}> Incluir textos de versiones anteriores</label>` : ''}<div class="workflow-actions"><button class="secondary" data-action="copy" ${hasContext(p) ? '' : 'disabled'}>Solo copiar contexto</button><button class="secondary" data-action="export-handoff" ${hasContext(p) ? '' : 'disabled'}>Exportar Markdown</button></div></details></section>`;
}
function context(p) {
  const draft = { ...p, ...contextDrafts.get(p.id) };
  const saved = !!p.importedContext;
  const revisions = p.contextRevisions.length
    ? `<details class="context-versions"><summary>Versiones anteriores del contexto · ${p.contextRevisions.length} / 10</summary>${[
        ...p.contextRevisions,
      ]
        .reverse()
        .map(
          (r) =>
            `<details class="context-version"><summary>${formatDate(r.createdAt)}</summary><pre>${escape(['Contexto duro:', r.goal, 'Decisiones:', r.decisions, 'Próximos pasos:', r.nextSteps, 'plm.md:', r.importedContext].join('\n\n'))}</pre><button class="secondary" data-restore-context="${escape(r.id)}">Restaurar esta versión</button></details>`,
        )
        .join(
          '',
        )}<p>Se guardan las diez últimas versiones no vacías. Restaurar conserva también el contexto que tienes ahora.</p></details>`
    : '';
  const workflow = `<section class="context-workflow" aria-labelledby="summary-title"><span class="step-number">1</span><h2 id="summary-title">${saved ? 'Tu resumen del proyecto' : 'Trae el resumen de tu chat'}</h2>${saved ? `<details class="import-preview saved-context"><summary>Ver resumen · ${contextText(p.importedContext).lines} / 500 líneas · ${formatDate(p.updatedAt)}</summary><pre>${escape(p.importedContext)}</pre></details><p>Cuando avances en otra aplicación, pide un resumen nuevo y pégalo aquí. La versión anterior se guarda.</p>` : requestSteps}<div class="workflow-actions"><button class="secondary" data-action="copy-context-request">${icon('copy')} Copiar petición</button><button class="${saved ? 'secondary' : 'primary'}" data-action="paste-current-context">Pegar resumen</button><button class="secondary" data-action="update-context">${icon('upload')} Abrir plm.md</button></div></section>`;
  // Decisions and next steps predate plm.md; keep them editable only where they already hold text.
  const legacyFields = ['decisions', 'nextSteps']
    .filter((key) => p[key] || draft[key])
    .map(
      (key) =>
        `<label>${key === 'decisions' ? 'Decisiones tomadas' : 'Próximos pasos'}<textarea name="${key}" rows="4" maxlength="100000">${escape(draft[key])}</textarea></label>`,
    )
    .join('');
  return `<div class="journey-grid ${hasContext(p) ? 'ready' : ''}">${workflow}${continuation(p)}</div><details class="project-notes"><summary>Instrucciones fijas y nombre</summary><form id="context-form" class="context-form"><label>Nombre de la conversación<input name="name" value="${escape(draft.name)}" maxlength="120" required></label><label>Contexto duro<textarea name="goal" rows="3" maxlength="20000" placeholder="ejemplos: En cada mensaje de esta conversacion se usara git para especificar que se ha hecho en cada prompt.">${escape(draft.goal)}</textarea></label>${legacyFields}<div class="form-actions"><span>Se añade siempre al contexto que copias.</span><button type="submit" class="primary">Guardar contexto ${icon('arrow')}</button></div></form></details>${revisions}${archive(p)}`;
}
const requestSteps =
  '<ol class="summary-steps"><li>Copia la petición y pégala en el chat que quieres continuar.</li><li>Copia la respuesta de la IA.</li><li>Pulsa <strong>Pegar resumen</strong> y revísala.</li></ol>';
function render() {
  const p = current();
  const openedNotes =
    $('.work-panel')?.dataset.projectId === p?.id && $('#context-form')?.closest('details')?.open;
  $('#app').innerHTML =
    `${sidebar()}<main class="main"><header class="topbar"><div><button class="nav-toggle secondary" data-action="navigation" aria-label="Abrir navegación">☰</button>${p?.folder ? `<span title="${escape(p.folder)}">${icon('folder')} ${escape(p.folder.split(/[\\/]/).filter(Boolean).pop())}</span>` : ''}</div><div class="header-actions"><button id="usage-button" class="secondary" data-action="usage" aria-label="Uso de suscripciones">Uso y límites</button><button class="secondary" data-action="applications">${icon('external')} Aplicaciones</button></div></header><div class="workspace-content"><div class="page-heading"><h1>${p ? escape(p.name) : 'Tu proyecto, en las tres aplicaciones'}</h1></div>${p ? `<section class="work-panel" data-project-id="${escape(p.id)}"><div class="workspace-body">${context(p)}</div><div class="project-footer"><button data-action="reveal-folder" ${p.folder ? '' : 'disabled'}>${icon('folder')} ${p.folder ? 'Abrir carpeta' : 'Sin carpeta'}</button><button data-action="export-project">${icon('download')} Exportar proyecto</button><button data-action="delete-project" class="delete-project">Eliminar de PLM</button></div></section>` : `<p class="product-purpose">PLM guarda el resumen de tu proyecto para continuar entre Codex, Claude y Antigravity. Trabajas y recibes respuestas en sus aplicaciones originales.</p><section class="welcome-panel"><h2>Trae el resumen de tu chat</h2>${requestSteps}<div class="workflow-actions"><button class="secondary" data-action="copy-context-request">${icon('copy')} Copiar petición</button><button class="primary" data-action="paste-context">Pegar resumen</button><button class="secondary" data-action="choose-context">${icon('upload')} Abrir plm.md</button></div><button class="review-link" data-action="new">O crea un proyecto vacío</button></section>`}</div></main>`;
  if (openedNotes && $('.project-notes')) $('.project-notes').open = true;
  if ($('#applications-dialog').open) $('#applications-content').innerHTML = providerCards();
  updateUsageViews();
}
function showContextImport(file) {
  pendingContext = file;
  $('#context-import-title').textContent = file.targetId
    ? 'Revisa el resumen nuevo'
    : 'Revisa el resumen';
  $('#context-file-info').textContent =
    `${file.filename} · ${file.lines} / 500 líneas. ${file.targetId ? 'Sustituye al resumen actual; el anterior queda en las versiones guardadas.' : 'Se creará una conversación nueva con este resumen.'}`;
  const name = $('#context-import-form [name="name"]');
  name.value = file.name;
  name.readOnly = !!file.targetId;
  $('#context-import-form [type="submit"]').textContent = file.targetId
    ? 'Actualizar contexto'
    : 'Importar contexto';
  $('#import-context-content').textContent = file.content;
  $('#toast').className = '';
  $('#context-dialog').showModal();
}
function openPasteDialog(targetId) {
  pasteTargetId = targetId || null;
  $('#paste-context-form').reset();
  $('#paste-line-count').textContent = 'Máximo 500 líneas · 100.000 caracteres';
  $('#paste-context-dialog').showModal();
}
function openProjectDialog(parent = null) {
  parentProject = parent?.id || null;
  chosenFolder = parent?.folder || '';
  $('#project-form').reset();
  $('#project-dialog-title').textContent = parent ? 'Nueva conversación' : 'Nuevo proyecto';
  $('#project-form [type="submit"]').textContent = parent ? 'Crear conversación' : 'Crear proyecto';
  $('#project-folder-selection').hidden = !!parent;
  showChosenFolder();
  $('#conversation-folder-info').textContent = parent ? `En la carpeta: ${parent.folder}` : '';
  $('#conversation-folder-info').hidden = !parent;
  $('#project-dialog').showModal();
}
function showChosenFolder() {
  $('#chosen-folder').textContent = chosenFolder || 'Sin carpeta';
  $('#project-form [data-action="clear-folder"]').hidden = !chosenFolder;
}
const options = () => ({ includeHistory, includeFolder });
function requireSavedContext() {
  const project = current();
  const draft = contextDrafts.get(project?.id);
  if (
    draft &&
    ['name', 'goal', 'decisions', 'nextSteps'].some(
      (key) => key in draft && draft[key].trim() !== project[key],
    )
  ) {
    throw new Error('Guarda los cambios de las instrucciones del proyecto antes de continuar.');
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
      if (button.dataset.usageConnect) {
        button.disabled = true;
        try {
          await api.connectUsage(button.dataset.usageConnect);
          await loadUsage(false, true);
        } finally {
          button.disabled = false;
        }
        toast('Conexión activada. Los datos llegarán desde tu próxima sesión del CLI oficial.');
        return;
      }
      if (button.dataset.usageDisconnect) {
        button.disabled = true;
        try {
          await api.disconnectUsage(button.dataset.usageDisconnect);
          await loadUsage(false, true);
        } finally {
          button.disabled = false;
        }
        toast('Medidor desconectado. Se ha restaurado tu barra de estado anterior.');
        return;
      }
      if (button.dataset.usageHelp) {
        await api.usageHelp(button.dataset.usageHelp);
        return;
      }
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
        includeHistory = false;
        target = modelById(current().preferredModel).provider;
        includeFolder = false;
        render();
        return;
      }
      if (button.dataset.target) {
        const provider = button.dataset.target;
        const model = modelById(current().preferredModel);
        continuationStatus.delete(selected);
        await api.selectModel(
          selected,
          model.provider === provider
            ? model.id
            : MODELS.find((item) => item.provider === provider && item.tier === 'mid').id,
        );
        await refresh();
        void loadUsage();
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
      if (button.dataset.restoreContext) {
        requireSavedContext();
        await api.restoreContext(selected, button.dataset.restoreContext);
        continuationStatus.delete(selected);
        contextDrafts.delete(selected);
        await refresh();
        toast('Versión restaurada. La anterior sigue disponible en el historial de contexto.');
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
        case 'usage':
          $('#usage-content').innerHTML = usagePanel();
          $('#usage-dialog').showModal();
          void loadUsage();
          break;
        case 'refresh-usage':
          await loadUsage(true);
          break;
        case 'applications':
          $('#applications-content').innerHTML = providerCards();
          $('#applications-dialog').showModal();
          break;
        case 'close-dialog':
          button.closest('dialog')?.close();
          break;
        case 'choose-folder':
          chosenFolder = (await api.chooseFolder()) || chosenFolder;
          showChosenFolder();
          break;
        case 'clear-folder':
          chosenFolder = '';
          showChosenFolder();
          break;
        case 'preview':
          requireSavedContext();
          $('#preview-content').textContent = await api.handoff(selected, target, options());
          $('#preview-dialog').showModal();
          break;
        case 'continue': {
          requireSavedContext();
          const id = selected;
          const provider = target;
          const name = tools[provider].name;
          button.disabled = true;
          try {
            const result = await api.continueInProvider(id, provider, options());
            const message = result.started
              ? `Contexto copiado. Inicio de ${name} solicitado. Pégalo en el chat donde quieras continuar.`
              : `Contexto copiado, pero no se pudo abrir ${name}: ${result.error}. Puedes abrirlo y pegar el texto manualmente.`;
            continuationStatus.set(
              id,
              message + (result.recordError ? ' No se pudo guardar el registro de la copia.' : ''),
            );
            await refresh();
          } finally {
            button.disabled = false;
          }
          break;
        }
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
        case 'choose-context':
        case 'update-context': {
          const updateCurrent = button.dataset.action === 'update-context';
          if (updateCurrent) requireSavedContext();
          const file = await api.chooseContext(updateCurrent ? selected : null);
          if (file) showContextImport(file);
          break;
        }
        case 'paste-context':
        case 'paste-current-context': {
          const targetId = button.dataset.action === 'paste-current-context' ? selected : null;
          if (targetId) requireSavedContext();
          // Read the clipboard directly; the text box is only a fallback when it is empty.
          const staged = await api.pasteContext(targetId);
          if (staged) showContextImport(staged);
          else openPasteDialog(targetId);
          break;
        }
        case 'restore-project': {
          const project = await api.importProject();
          if (project) {
            selected = project.id;
            includeHistory = false;
            await refresh();
            toast('Proyecto importado.');
          }
          break;
        }
        case 'delete-project':
          if (await api.deleteProject(selected)) {
            contextDrafts.delete(selected);
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
// Close only the foreground layer so Escape never dismisses the underlying view too.
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing) return;
  const dialog = document.querySelector('dialog[open]');
  const root = dialog || document;
  const expanded = [...root.querySelectorAll('details[open]')].filter(
    (item) => item.getClientRects().length,
  );
  const focused = document.activeElement?.closest('details[open]');
  const detail = focused && root.contains(focused) ? focused : expanded.at(-1);
  if (detail) {
    event.preventDefault();
    detail.open = false;
    detail.querySelector('summary')?.focus();
    return;
  }
  if (dialog) {
    // Native dialog cancellation restores focus and runs the normal close cleanup.
    return;
  }
  if (navigationOpen && $('.sidebar')?.getClientRects().length) {
    event.preventDefault();
    navigationOpen = false;
    render();
    $('.nav-toggle')?.focus();
    return;
  }
  // Folder groups are also expandable, and should obey the same keyboard convention.
  const folderButton = document.activeElement
    ?.closest('.folder-group')
    ?.querySelector('.folder-heading');
  if (folderButton?.getAttribute('aria-expanded') === 'true') {
    event.preventDefault();
    const folder = workspace.projects.find((p) => p.id === folderButton.dataset.folder)?.folder;
    collapsedFolders.add(folder);
    const id = folderButton.dataset.folder;
    render();
    document.querySelector(`[data-folder="${id}"]`)?.focus();
  }
});
document.addEventListener('change', (event) => {
  if (event.target.id === 'continuation-model') {
    const control = event.target;
    control.disabled = true;
    const projectId = selected,
      modelId = event.target.value;
    void run('select-model', async () => {
      try {
        await api.selectModel(projectId, modelId);
        continuationStatus.delete(projectId);
        await refresh();
        toast('Destino guardado. Elige ese modelo cuando abras su aplicación.');
      } finally {
        control.disabled = false;
      }
    });
  }
  if (event.target.id === 'include-history') {
    includeHistory = event.target.checked;
    render();
    $('.copy-options').open = true;
  }
  if (event.target.id === 'include-folder') includeFolder = event.target.checked;
  rememberDraft(event);
});
function rememberDraft(event) {
  const form = event.target.closest('form');
  if (form?.id === 'context-form')
    contextDrafts.set(selected, Object.fromEntries(new FormData(form)));
}
// Ctrl+V outside a text field brings in a new summary, the same as "Pegar resumen".
document.addEventListener('paste', (event) => {
  if (
    document.querySelector('dialog[open]') ||
    event.target.closest?.('input, textarea, select, [contenteditable]')
  )
    return;
  const button = $(
    current() ? '[data-action="paste-current-context"]' : '[data-action="paste-context"]',
  );
  if (!button) return;
  event.preventDefault();
  button.click();
});
document.addEventListener('input', (event) => {
  rememberDraft(event);
  if (event.target.id === 'pasted-context') {
    const text = event.target.value.replace(/\r\n?/g, '\n');
    const lines = text ? text.replace(/\n$/, '').split('\n').length : 0;
    $('#paste-line-count').textContent =
      `${lines} / 500 líneas · ${text.length} / 100.000 caracteres`;
  }
});
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
      if (form.id === 'paste-context-form') {
        const staged = await api.stageContext({ content: input.content, targetId: pasteTargetId });
        $('#paste-context-dialog').close();
        showContextImport(staged);
      }
      if (form.id === 'context-import-form') {
        if (!pendingContext) throw new Error('Añade primero tu archivo plm.md.');
        const updating = !!pendingContext.targetId;
        const project = await api.importContext({
          token: pendingContext.token,
          name: input.name,
          model: pendingContext.model || current()?.preferredModel || DEFAULT_MODEL,
        });
        pendingContext = null;
        selected = project.id;
        includeHistory = false;
        continuationStatus.delete(selected);
        includeFolder = false;
        $('#context-dialog').close();
        await refresh();
        toast(
          updating
            ? 'Contexto actualizado en esta conversación. Puedes recuperar versiones anteriores.'
            : 'Contexto importado. Ya puedes continuar con el modelo elegido.',
        );
      }
      if (form.id === 'project-form') {
        const project = await api.createProject({
          ...input,
          scope: chosenFolder ? 'folder' : 'conversation',
          folder: chosenFolder,
          parentId: parentProject,
        });
        if (project.folder) collapsedFolders.delete(project.folder);
        navigationOpen = false;
        selected = project.id;
        includeHistory = false;
        $('#project-dialog').close();
        await refresh();
      }
      if (form.id === 'context-form') {
        const id = selected;
        const { decisions, nextSteps } = current();
        await api.updateProject(id, { decisions, nextSteps, ...input });
        continuationStatus.delete(id);
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
    void loadUsage();
    setInterval(() => {
      if (document.visibilityState === 'visible') void loadUsage();
    }, 60_000);
  } catch (error) {
    $('#app').textContent = `No se ha podido abrir PLM: ${error.message}`;
  }
