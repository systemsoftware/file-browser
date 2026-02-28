const { contextBridge, ipcRenderer, webUtils } = require('electron');


contextBridge.exposeInMainWorld('electron', {
    getWorkspaces: async () => {
        return await ipcRenderer.invoke('get-workspaces');
    },
    getAllLocations: async () => {
        return await ipcRenderer.invoke('get-all-locations');
    },
    getExternalLocations: async () => {
        return await ipcRenderer.invoke('get-external-locations');
    },
    getSetting: async (setting) => {
        return await ipcRenderer.invoke('get-setting', setting);
    },
    addWorkspace: async (workspace) => {
        return await ipcRenderer.invoke('add-workspace', workspace);
    },
    navContextMenu: async (x,y,n,t) => {
        return await ipcRenderer.invoke('nav-contextmenu', x, y, n, t);
    },
    handleUpdatedWorkspaces: (callback) => {
        ipcRenderer.on('updated-workspaces', (event, data) => callback(data));
    },
    getRecents: async () => {
        return await ipcRenderer.invoke('get-recents');
    },
    handleViewChange: (callback) => ipcRenderer.on('set-view', (event, data) => callback(data)),
    goTo : async (path, enter, ref) => {
        return await ipcRenderer.invoke('go-to', path, enter || false, ref || '');
    },
    homedir() {
        return ipcRenderer.sendSync('homedir');
    },
    prompt: async (title, message, defaultText) => {
        return await ipcRenderer.invoke('prompt', title, message, defaultText);
    },
    addLocation: async () => {
        return await ipcRenderer.invoke('add-location');
    },
    handleUpdatedLocations: (callback) => {
        ipcRenderer.on('updated-locations', (event, data) => callback(data));
    },
    addToWorkspace: async (workspace, location) => {
        console.log('adding to workspace', workspace, location);
        return await ipcRenderer.invoke('add-to-workspace', workspace, location);
    },
    startDrag: (fileName) => {
        ipcRenderer.send('ondragstart', fileName);
    },
    onDragComplete: (callback) => {
        ipcRenderer.on('drag-complete', (event, success) => {
            callback(success);
        });
    },
      goBack:(path) => {
        ipcRenderer.invoke('go-to', 'back', false, path);
      },
      handleDragComplete: (callback) => ipcRenderer.on('drag-complete', (event, data) => callback(data)),
      openFile: async (path) => {
       ipcRenderer.send('open-file', path);
      },
    webUtils,
    handleNewFileInWorkspace: (callback) => ipcRenderer.on('file-added-to-workspace', (event, data) => callback(data)),
    handleFileRemoved: (callback) => ipcRenderer.on('file-removed', (event, data) => callback(data)),
    fileContextMenu: async (x,y,n,p) => {
        return await ipcRenderer.invoke('file-contextmenu', x, y, n, p, 'file');
    },
    dirContextMenu: async (x,y,n,p) => {
        return await ipcRenderer.invoke('file-contextmenu', x, y, n, p,'dir');
    },
    handleFileColorChange: (callback) => ipcRenderer.on('file-color-set', (event, data) => callback(data)),
    settings: async () => {
       ipcRenderer.send('settings');
    },
    handleChangeSidebarColor: (callback) => ipcRenderer.on('set-sidebar-color', (event, data) => callback(data)),
    handleChangeSidebarWidth: (callback) => ipcRenderer.on('set-sidebar-width', (event, data) => callback(data)),
})


ipcRenderer.on('goto', (event, path) => {
    console.log('go to', path);
    ipcRenderer.invoke('go-to', path);
})