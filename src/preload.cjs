const { contextBridge, ipcRenderer } = require('electron');
const invoke =
  (channel) =>
  (...args) =>
    ipcRenderer.invoke(channel, ...args);
contextBridge.exposeInMainWorld(
  'plm',
  Object.freeze({
    ready: invoke('window:ready'),
    workspace: invoke('workspace:read'),
    createProject: invoke('project:create'),
    updateProject: invoke('project:update'),
    addMessage: invoke('message:add'),
    deleteMessage: invoke('message:delete'),
    deleteProject: invoke('project:delete'),
    chooseFolder: invoke('folder:choose'),
    revealFolder: invoke('folder:reveal'),
    providers: invoke('providers:list'),
    configureProvider: invoke('provider:configure'),
    launchProvider: invoke('provider:launch'),
    handoff: invoke('handoff:preview'),
    copyHandoff: invoke('handoff:copy'),
    exportHandoff: invoke('handoff:export'),
    exportProject: invoke('project:export'),
    importProject: invoke('project:import'),
    contextRequest: invoke('context:request'),
    copyContextRequest: invoke('context:copy-request'),
    chooseContext: invoke('context:choose'),
    discardContext: invoke('context:discard'),
    importContext: invoke('context:import'),
    selectModel: invoke('project:model'),
    documentation: invoke('provider:docs'),
  }),
);
