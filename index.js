const { app, BrowserWindow, ipcMain, Menu, shell, dialog, Notification, nativeImage, MenuItem } = require('electron');
const path = require('path');
const prompt = require('native-prompt')
const fs = require('fs');
const { execSync, exec } = require('child_process');
const plist = require('plist');
const crypto = require('crypto');


const { homedir, tmpdir, type } = require('os');

const tmp = tmpdir();
const home = homedir();

const userData = app.getPath('userData');

const FileAssociationsList = {}

console.log(userData)

console.log(tmp + '/icon-cache');

let hasDutiInstalled = false;

try{
    execSync('duti -x txt');
    hasDutiInstalled = true;
}catch{
    hasDutiInstalled = false;
}

console.log('Duti installed:', hasDutiInstalled);

let workspaces = [];
let locations = [];
let externalLocations = [];

let settings = {}

function parsePlist(plistPath) {
    try {
        const content = fs.readFileSync(plistPath, 'utf8');
        return plist.parse(content);
    } catch (error) {
        try {
            const xmlContent = execSync(`plutil -convert xml1 -o - "${plistPath}"`).toString();
            return plist.parse(xmlContent);
        } catch (conversionError) {
            return null; 
        }
    }
}

const getDefaultIcon = (ext) => {
    if(!hasDutiInstalled) return null;
    try{
        return execSync(`duti -x ${ext}`).toString().split('\n')[1];
    }catch{
        return null;
    }
}

function getIcon(appPath) {
    const cacheDir = path.join(tmp, 'icon-cache');
    const plistPath = path.join(appPath, 'Contents', 'Info.plist');

    if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
    }

    if (fs.existsSync(plistPath)) {
        const info = parsePlist(plistPath);
        if (info && info.CFBundleIconFile) {
            const iconFile = info.CFBundleIconFile.endsWith('.icns')
                ? info.CFBundleIconFile
                : `${info.CFBundleIconFile}.icns`;
            const icnsPath = path.join(appPath, 'Contents', 'Resources', iconFile);

            if (fs.existsSync(icnsPath)) {
                return getCachedIcon(icnsPath, appPath, cacheDir);
            }
        }
    }

    const resourcesPath = path.join(appPath, 'Contents', 'Resources');
    if (fs.existsSync(resourcesPath)) {
        const icnsFile = fs.readdirSync(resourcesPath).find(file => file.endsWith('.icns'));
        if (icnsFile) {
            const icnsPath = path.join(resourcesPath, icnsFile);
            return getCachedIcon(icnsPath, appPath, cacheDir);
        }
    }

    return null; // Return null if no icon is found
}


function getCachedIcon(icnsPath, appPath, cacheDir) {
    // Create a unique hash based on the app path and icon file name
    const uniqueKey = crypto.createHash('md5').update(`${appPath}-${icnsPath}`).digest('hex');
    const iconName = `${path.basename(icnsPath, '.icns')}-${uniqueKey}.png`;
    const cachedPath = path.join(cacheDir, iconName);

    // Ensure cache directory exists
    if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
    }

    // Use cached icon if it exists
    if (fs.existsSync(cachedPath)) {
        return nativeImage.createFromPath(cachedPath).resize({ width: 16, height: 16 });
    }

    // Convert .icns to .png and cache it
    try {
        execSync(`sips -s format png "${icnsPath}" --out "${cachedPath}"`);
        return nativeImage.createFromPath(cachedPath).resize({ width: 16, height: 16 });
    } catch (error) {
        console.error('Error converting .icns to .png:', error.message);
        return null; // Return null if conversion fails
    }
}

if (fs.existsSync(path.join(userData, 'workspaces'))) {
    workspaces = fs.readFileSync(path.join(userData, 'workspaces.json'), 'utf8') ? JSON.parse(fs.readFileSync(path.join(userData, 'workspaces.json'), 'utf8')) : [];
} else {
    workspaces = []
}

if (fs.existsSync(path.join(userData, 'locations.json'))) {
    locations = JSON.parse(fs.readFileSync(path.join(userData, 'locations.json'), 'utf8'));
}else{
    locations = [];
}


externalLocations = fs.readdirSync(path.join(home, '/Library/CloudStorage')).map(f => {
    let cleanName = f.split('-')[0];
    
    cleanName = cleanName == 'OneDrive' ? cleanName : cleanName.replace(/([a-z])([A-Z])/g, '$1 $2');
    
    return { 
        name: cleanName, 
        path: path.join(home, '/Library/CloudStorage/', f), 
        icon: 'cloud' 
    };
}).filter(f => fs.lstatSync(f.path).isDirectory());


if (fs.existsSync(path.join(userData, 'settings.json'))) {
    settings = JSON.parse(fs.readFileSync(path.join(userData, 'settings.json')));
}else {
settings = {
    sidebarWidth: '20%',
}
}

function createWindow() {
    const bounds = fs.existsSync(path.join(userData, 'window-state.json'))
        ? JSON.parse(fs.readFileSync(path.join(userData, 'window-state.json')))
        : { width: 800, height: 600 };
    const win = new BrowserWindow({
        width: bounds.width,
        height: bounds.height,
        x: bounds.x,
        y: bounds.y,
        minWidth:1025,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            enableRemoteModule: false,
            nodeIntegration: false,
            webSecurity: true,
            allowRunningInsecureContent: false,
        },
        titleBarStyle: 'hidden',
        trafficLightPosition: {
            x: 12,
            y: 12,
        },
    });

    win.loadFile('index.html');

    return win;
}

app.on('ready', () => {
    const win = createWindow();

    
    // add New Window to dock menu
    app.dock.setMenu(Menu.buildFromTemplate([
        {
            label: 'New Window',
            click: () => {
                createWindow();
            }
        },
        {
            label:"Go to",
            click: async () => {
                const to = await dialog.showOpenDialog({
                    properties: ['openDirectory']
                })
               const win = BrowserWindow.getFocusedWindow();
               console.log('goto', to.filePaths[0]);
                win.webContents.send('goto', to.filePaths[0]);
            }
        }
    ])
    );

    win.on('resize', () => {
        fs.writeFileSync(path.join(userData, 'window-state.json'), JSON.stringify(win.getBounds()));
    })

    win.on('move', () => {
        fs.writeFileSync(path.join(userData, 'window-state.json'), JSON.stringify(win.getBounds()));
    })


    ipcMain.handle('nav-contextmenu', async (ev, x, y, name, type) => {
        if(type == 'external') return false;
        const menu = Menu.buildFromTemplate([
            { 
                label: 'Delete', click: async () => {
                    try{
                const confirm = await dialog.showMessageBox({ type: 'warning', buttons: ['Yes', 'No'], title: 'Delete', message: 'Are you sure you want to delete ' + name + '?' });
                if(confirm.response == 1) return false;
                    console.log('deleting', name, type);
                if(type == 'location' || type == 'file'){
                    const index = locations.findIndex(l => l.name === name);
                    locations.splice(index, 1);
                    fs.writeFileSync(path.join(userData, 'locations.json'), JSON.stringify(locations));
                    ev.sender.send('updated-locations', locations);
                }else{
                const index = workspaces.findIndex(w => w.name === name);
                workspaces.splice(index, 1);
                fs.writeFileSync(path.join(userData, 'workspaces.json'), JSON.stringify(workspaces));
                ev.sender.send('updated-workspaces', workspaces);
                fs.rmSync(path.join(userData, 'workspaces', name), { recursive: true });
                }
            }catch{}
            },
        },
            { label: 'Edit', click: async () => { 
                const newName = await prompt('Enter a new name', 'Enter a new name for the workspace',{ defaultText: name });
                if (!newName) {
                    return false;
                }
                const newIcon = await prompt('Enter a new icon', 'Enter a new icon for the workspace', { defaultText: workspaces.find(w => w.name === name)?.icon });
                if (!newIcon) {
                    return false;
                }
                if(type == 'location' || type == 'file'){
                    const index = locations.findIndex(l => l.name === name);
                    locations[index] = {
                        name: newName,
                        icon: newIcon,
                    }
                    fs.writeFileSync(path.join(userData, 'locations.json'), JSON.stringify(locations));
                    ev.sender.send('updated-locations', locations);
                }else{
                const index = workspaces.findIndex(w => w.name === name);
                workspaces[index] = {
                    name: newName,
                    icon: newIcon,
                }
                fs.renameSync(path.join(userData, 'workspaces', name), path.join(userData, 'workspaces', newName));
                fs.writeFileSync(path.join(userData, 'workspaces.json'), JSON.stringify(workspaces));
                ev.sender.send('updated-workspaces', workspaces);
            }
            }
        },
        ]);
        if(type != 'workspace'){
            menu.append(new MenuItem({ type: 'separator' }));
            menu.append(new MenuItem({
                label: 'Add File',
                click: async () => {
                   const _name = await prompt('Enter a name', 'Enter a name for the file');
                        if(!_name) return false;
                            const location = locations.find(l => l.name === name);
                            fs.writeFileSync(path.join(location.path.replace('~', home), _name), '');
                            new Notification({
                                title: 'File added',
                                body: _name + ' has been added to ' + name
                            }).show();
                            ev.sender.send('file-added-to-workspace', { name: _name, path: path.join(location.path.replace('~', home), _name), type: 'file', location: location.path });
                }
            }))
            menu.append(new MenuItem({
                label: 'Add Folder',
                click: async () => {
                    const _name = await prompt('Enter a name', 'Enter a name for the folder');
                    if(!_name) return false;
                    const location = locations.find(l => l.name === name);
                    fs.mkdirSync(path.join(location.path.replace('~', home), _name));
                    new Notification({
                        title: 'Folder added',
                        body: _name + ' has been added to ' + name
                    }).show();
                    ev.sender.send('file-added-to-workspace', { name: _name, path: path.join(location.path.replace('~', home), _name), type: 'dir', location: location.path });
                }
            }))
        }
        menu.popup({ x, y });
    })



ipcMain.handle('go-to', async (ev, _path, enter) => {
    if(_path == 'recents'){
        const _recents = fs.existsSync(path.join(userData, 'recents.json')) ? JSON.parse(fs.readFileSync(path.join(userData, 'recents.json'), 'utf8')) : [];
        const colors = fs.existsSync(path.join(userData, 'colors.json')) ? JSON.parse(fs.readFileSync(path.join(userData, 'colors.json'), 'utf8')) : {};
        const recents = _recents.map(r => { return { name: r.name, path: r.path, type: 'dir', color:colors[r.path] ? colors[r.path] : '#64748b' } });
       return ev.sender.send('set-view', JSON.stringify({
        path: 'Recents',
        data: recents,
        size:null,
    }));
    }
    if(!_path) return dialog.showErrorBox('No path', 'No path provided');
    _path = _path.replace('~', home)
    if(_path == 'back') _path = path.dirname(enter);
    if(!_path || enter) _path = await prompt('Enter a path', 'Enter a path to navigate to', { defaultText: _path == 'Recents' ? '' : _path });
    if(!_path) return false;
    let size = 0;
    let data = []
    const colors = fs.existsSync(path.join(userData, 'colors.json')) ? JSON.parse(fs.readFileSync(path.join(userData, 'colors.json'), 'utf8')) : {};
    fs.readdirSync(_path, { recursive:settings.recursive || false }).forEach(f => {
        if(!settings.showHiddenFiles && path.basename(f).startsWith('.')) return;
        const stats = fs.statSync(path.join(_path, f))
        data.push({
            name: path.basename(f),
            path: path.join(_path, f),
            type:stats.isDirectory() ? 'dir' : 'file',
            color: colors[path.join(_path, f)] ? colors[path.join(_path, f)] : '#64748b'
        })
        size += stats.size
    }
    )

    const recents = fs.existsSync(path.join(userData, 'recents.json')) ? JSON.parse(fs.readFileSync(path.join(userData, 'recents.json'), 'utf8')) : [];
    if(!recents.find(r => r.path == _path)){
        recents.unshift({
            name: path.basename(_path),
            path: _path,
            type: 'dir'
        })
        fs.writeFileSync(path.join(userData, 'recents.json'), JSON.stringify(recents));
    }

    if(size > 1024 * 1024 * 1024 * 1024 * 1024){
        size = (size / (1024 * 1024 * 1024 * 1024 * 1024)).toFixed(2) + ' PB';
    }else if(size > 1024 * 1024 * 1024 * 1024){
        size = (size / (1024 * 1024 * 1024 * 1024)).toFixed(2) + ' TB';
    }else if(size > 1024 * 1024 * 1024){
        size = (size / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    }else if(size > 1024 * 1024){
        size = (size / (1024 * 1024)).toFixed(2) + ' MB';
    }else if(size > 1024){
        size = (size / 1024).toFixed(2) + ' KB';
    }else{
        size = size + ' B';
    }


    if(_path.includes('workspaces')){
        _path = path.basename(_path);
    }

    if(_path.includes('CloudStorage')){
        _path = path.basename(_path.split('-')[0]).replace(/([a-z])([A-Z])/g, '$1 $2');
        if(_path == 'One Drive') _path = 'OneDrive';
    }

    ev.sender.send('set-view', JSON.stringify({
        path: _path,
        data,
        size
    }));
})



ipcMain.on('ondragstart', (event, filePath) => {
    event.sender.startDrag({
        file: filePath,
        icon: path.join(__dirname, 'assets', 'icon.png')
    });
    
    event.sender.send('drag-complete', true);
    win.focus();
});



ipcMain.handle('add-to-workspace', (ev, workspace, location) => {
    fs.symlinkSync(location, workspace + '/' + path.basename(location), 'junction');
    
    ev.sender.send('file-added-to-workspace', {
        name: path.basename(location),
        path: location,
    });
    
})



});



    
ipcMain.handle('get-workspaces', async () => {
    return workspaces;
})

ipcMain.handle('get-all-locations', async () => {
    return locations;
})

ipcMain.handle('get-external-locations', async () => {
    return externalLocations;
})

ipcMain.handle('get-setting', async (ev, s) => {
    if(!settings[s]){
        console.error('Setting not found. Looking for', s, 'in', settings);
        return null;
    }
    return settings[s];
})

ipcMain.handle('add-workspace', async (ev) => {
    const name = await prompt('Enter a name', 'Enter a name for the workspace');
    if (!name) {
        return false;
    }
    const icon = await prompt('Enter an icon', 'Enter an icon for the workspace');
    if (!icon) {
        return false;
    }
    if(workspaces.includes(name)){
        return false;
    }
    workspaces.push({
        name,
        icon,
        path: path.join(userData, 'workspaces', name),
    });
    fs.writeFileSync(path.join(userData, 'workspaces.json'), JSON.stringify(workspaces));
    fs.mkdirSync(path.join(userData, 'workspaces', name), { recursive: true });
    return {
        name,
        icon,
        path: path.join(userData, 'workspaces', name),
    }
})


ipcMain.handle('add-location', async (ev) => {
    const name = await prompt('Enter a name', 'Enter a name for the location');
    if (!name) {
        return false;
    }
    const _path = (await dialog.showOpenDialog({
        properties: ['openDirectory']
    })).filePaths[0];
    if(locations.includes(_path)){
        return dialog.showErrorBox('Location already exists', 'A location with that path already exists');
    }
    const icon = await prompt('Enter an icon', 'Enter an icon for the location');
    locations.push({
        name,
        path:_path,
        icon
    });
    fs.writeFileSync(path.join(userData, 'locations.json'), JSON.stringify(locations));
    return {
        name,
        path:_path,
        icon
    }
}
)


ipcMain.handle('get-recents', async () => {
   try{
    let paths = JSON.parse(fs.readFileSync(path.join(userData, 'recents.json'), 'utf8')).filter(f => fs.existsSync(f.path));
    paths = paths.slice(0, settings.maxRecents || 10);
    fs.writeFileSync(path.join(userData, 'recents.json'), JSON.stringify(paths));
    const colors = fs.existsSync(path.join(userData, 'colors.json')) ? JSON.parse(fs.readFileSync(path.join(userData, 'colors.json'), 'utf8')) : {};
    return paths.map(f => { return { name: f.name, path: f.path, type: 'dir', color: colors[f.path] ? colors[f.path] : '#64748b' } });
   }catch{
         return [
        {
            name: 'Recents',
            path: home,
            type: 'dir'
        },
        {
            name: 'Desktop',
            path: path.join(home, 'Desktop'),
            type: 'dir'
        },
        {
            name: 'Documents',
            path: path.join(home, 'Documents'),
            type: 'dir'
        },
        {
            name: 'Downloads',
            path: path.join(home, 'Downloads'),
            type: 'dir'
        }
         ];
   }
})

ipcMain.on('homedir', (ev) => {
    ev.returnValue = home;
})

ipcMain.handle('file-contextmenu', (ev, x, y, name, _path, type) => {
    const stats = fs.lstatSync(_path);
    let defIcon = null
    if(!stats.isDirectory() && !stats.isSymbolicLink()){
    defIcon = getDefaultIcon(path.extname(_path).replace('.', ''))
    }
    if(settings.showAppIcons == false) defIcon = null;
    const template = [
        {
            label: 'Open',
            enabled:!stats.isSymbolicLink(),
            icon: defIcon ? getIcon(defIcon) : null,
            click: () => {
              if(stats.isDirectory()) return ev.sender.send('goto', _path);
                shell.openPath(_path);
            }
        }           
    ]

    if(!stats.isDirectory()){
        let fileAssociations = execSync('./FileAssociations ' + path.extname(_path).replace('.', ''))
            .toString()
            .split('\n')
            .map(e => {
                return { name: path.basename(e), path: e };
            })
            .filter(e => e.name && !e.name.startsWith('Usage:'))
            .sort((a, b) => a.name.localeCompare(b.name));

            if(fs.existsSync(`${userData}/associations_filter.js`)) {
                delete require.cache[require.resolve(`${userData}/associations_filter.js`)];
                fileAssociations = fileAssociations.filter(f => {
                    const filter = require(`${userData}/associations_filter.js`);
                    return filter(f, _path, path.extname(_path).replace('.', ''));
                })
            }
            
        if (fileAssociations.length > 0 && !stats.isSymbolicLink()) {
            template.push(
                {
                    label: 'Open with',
                    submenu: [{ label:"ASSOCIATED APPS", enabled:false }, ...fileAssociations.map(f => {

                        const icon = settings.showAppIcons == false ? null : getIcon(f.path);              

                        return {
                            label: f.name,
                            icon,
                            click: () => {
                                exec(`open -a "${f.path}" "${_path}"`, (error) => {
                                    if (error) {
                                       dialog.showErrorBox('Error', 'There was an error opening the file with ' + f.name);
                                    }
                                });
                            }
                        }
                    }), { type: 'separator' }, { label:"OTHER APPS", enabled:false }, {
                        label:"Select...",
                        click: async () => {
                            const app = await dialog.showOpenDialog({
                                properties: ['openFile'],
                                filters: [
                                    { name: 'Applications', extensions: ['app'] }
                                ]
                            });
                            if(app.canceled) return false;
                            exec(`open -a "${app.filePaths[0]}" "${_path}"`, (error) => {
                                if (error) {
                                   dialog.showErrorBox('Error', 'There was an error opening the file with ' + app.filePaths[0]);
                                }
                            });
                        }
                    }, {
                        label:"Open App Store",
                        click: () => {
                         execSync(`open -a "App Store"`, (error) => {
                            if (error) {
                               dialog.showErrorBox('Error', 'There was an error opening the file with the App Store');
                            }
                         })
                        }
                    }]
                },
                {
                    label: 'Quicklook',
                    click: () => {
                        execSync('qlmanage -p ' + _path, (error) => {
                            if (error) {
                              console.error(`Error opening QuickLook: ${error.message}`);
                              return;
                            }
                            console.log('QuickLook opened successfully');
                          });
                    }
                },
                { type: 'separator' },
            );
        }
    }else{
        template.push(
            {
                type: 'separator'
            }
        )
    }
    

    if(_path.includes('workspaces')){
        if(stats.isSymbolicLink()){
        template.push({
            label: 'Remove from workspace ' + path.basename(path.dirname(_path)),
            click: () => {
                fs.rmSync(_path);
                ev.sender.send('file-removed', {
                    name,
                    path: _path,
                });
            }
        })
    }
    }else{
        if(_path != home && path.dirname(_path) != home && !_path.includes(`CloudStorage`) && !_path.includes(`workspaces`)){
        template.push({
            label: 'Move to trash',
            click: async () => {
                const confirm = await dialog.showMessageBox({
                    type: 'warning',
                    buttons: ['Yes', 'No'],
                    title: 'Move to trash',
                    message: `Are you sure you want to move ${name} to the trash?`
                });
                if(confirm.response == 1) return false;
                shell.trashItem(_path);
                ev.sender.send('file-removed', {
                    name,
                    path: _path,
                    type
                });
            }
        },
        )}
    template.push(
        {
            label:"Add to workspace",
            submenu: workspaces.map(w => {
                return {
                    label: w.name,
                    click: () => {
                        if(fs.existsSync(w.path + '/' + path.basename(_path))) return new Notification({ title: 'File already exists', body: path.basename(_path) + ' already exists in ' + w.name }).show();
                        fs.symlinkSync(_path, w.path + '/' + path.basename(_path), 'junction');
                        new Notification({
                            title: 'File added to workspace',
                            body: path.basename(_path) + ' has been added to ' + w.name
                        }).show();
                    }
                }
            })
                
        },
        {
            label: 'Copy path',
            click: () => {
                exec(`echo ${_path} | pbcopy`);
            }
        }
    )
    }

   
    
    if (process.platform === 'darwin' && !stats.isSymbolicLink()) {
        template.push(
            { type: 'separator' },
            {
                label: 'Reveal in Finder',
                click: () => {
                    shell.showItemInFolder(_path);
                }
            }
        );
    }
    

    if(stats.isDirectory() && !stats.isSymbolicLink()){
        template.push(
            { type: 'separator' },
            {
                label: 'Open in Terminal',
                click: () => {
                    exec(`open -a Terminal ${_path}`);
                }
            },
            {
                label: 'Add File',
                click: async () => {
                   const name = await prompt('Enter a name', 'Enter a name for the file');
                     if(!name) return false;
                        fs.writeFileSync(path.join(_path, name), '');
                        new Notification({
                            title: 'File added',
                            body: name + ' has been added to ' + path.basename(_path)
                        }).show();
                }
            },
    
            {
                label: 'Add Folder',
                click: async () => {
                 const name = await prompt('Enter a name', 'Enter a name for the folder');
                    if(!name) return false;
                    fs.mkdirSync(path.join(_path, name));
                    new Notification({
                        title: 'Folder added',
                        body: name + ' has been added to ' + path.basename(_path)
                    }).show();
                }
            }
        )
    }

    const recents = JSON.parse(fs.readFileSync(path.join(userData, 'recents.json'), 'utf8'));

    if(recents.find(r => r.path == _path)){
        template.push({ type:"separator" }, {
            label: 'Remove from recents',
            click: () => {
                const index = recents.findIndex(r => r.path === _path);
                recents.splice(index, 1);
                fs.writeFileSync(path.join(userData, 'recents.json'), JSON.stringify(recents));
                ev.sender.send('file-removed', {
                    name,
                    path: _path,
                    type
                });
            }
            })
        }

        const colors = fs.existsSync(path.join(userData, 'colors.json')) ? JSON.parse(fs.readFileSync(path.join(userData, 'colors.json'), 'utf8')) : {};

        template.push({ type: 'separator' }, {
            label: 'Styling',
            submenu: [
            {
                label: 'Set Color',
                click: async () => {
                const color = await prompt('Enter a color', 'Enter a color for the file', { defaultText: colors[_path] ? colors[_path] : '' });
                if (!color) return false;
                colors[_path] = color;
                fs.writeFileSync(path.join(userData, 'colors.json'), JSON.stringify(colors));
                ev.sender.send('file-color-set', {
                    name,
                    path: _path,
                    color
                });
                }
            },
            ...(colors[_path] ? [{
                label: 'Reset Color',
                click: () => {
                delete colors[_path];
                fs.writeFileSync(path.join(userData, 'colors.json'), JSON.stringify(colors));
                ev.sender.send('file-color-set', {
                    name,
                    path: _path,
                    color: '#64748b'
                });
                }
            }] : [])
            ]
        });

    const menu = Menu.buildFromTemplate(template);
    menu.popup({ x, y });
})

ipcMain.on('open-file', (ev, _path) => {
    shell.openPath(_path);
})

ipcMain.handle('prompt', async (ev, title, message, defaultText) => {
    return prompt(title, message, { defaultText });
})


ipcMain.on('settings', (ev) => {
const menu = Menu.buildFromTemplate([
    {
        label:"HELP",
        enabled:false
    },
    {
        label: 'Icon Help',
        click: async () => {
          const dbox = await dialog.showMessageBox({
            type: 'info',
            title: 'Icon Help',
            message: 'Icons must be in the form of a material icon name. For example, "home" or "folder." Click the button below to see a list of available icons.',
            buttons: ['OK','Icon list']
          })
            if(dbox.response == 1){
                shell.openExternal('https://fonts.google.com/icons');
            }
        }
    },
    {
        type: 'separator'
    },
    {
        label:"SETTINGS",
        enabled:false
    },
    {
        label: 'Sidebar',
        submenu:[
            {
                label:"Width",
                click: async () => {
                    const width = await prompt('Enter a width', 'Enter a width for the sidebar', { defaultText: settings.sidebarWidth });
                    if (!width) {
                        return false;
                    }
                    settings.sidebarWidth = width;
                    fs.writeFileSync(path.join(userData, 'settings.json'), JSON.stringify(settings));
                    ev.sender.send('set-sidebar-width', width);
                }
            },
            {
                label:"Color",
                click: async () => {
                    const color = await prompt('Enter a color', 'Enter a color for the sidebar', { defaultText: settings.sidebarColor });
                    if (!color) {
                        return false;
                    }
                    settings.sidebarColor = color;
                    fs.writeFileSync(path.join(userData, 'settings.json'), JSON.stringify(settings));
                    ev.sender.send('set-sidebar-color', color);
                }
            }
        ]
    },
    {
        label: settings.showHiddenFiles ? 'Hide Hidden Files' : 'Show Hidden Files',
        click: async () => {
            const show = await dialog.showMessageBox({
                type: 'info',
                title: 'Show Hidden Files',
                message: `Would you like to ${settings.showHiddenFiles ? 'hide' : 'show'} hidden files?`,
                buttons: ['Yes', 'No']
            });
            if(show.response == 0){
                settings.showHiddenFiles = !settings.showHiddenFiles;
                fs.writeFileSync(path.join(userData, 'settings.json'), JSON.stringify(settings));
            }
        },
    },
    {
        label: 'Recursive',
        click: async () => {
            const show = await dialog.showMessageBox({
                type: 'info',
                title: 'Recursive',
                message: `Would you like to ${settings.recursive ? 'disable' : 'enable'} recursive file viewing? CAUTION: This will read all files in all subdirectories, potentially slowing down the app and straining your system.`,
                buttons: ['Yes', 'No']
            });
            if(show.response == 0){
                settings.recursive = !settings.recursive;
                fs.writeFileSync(path.join(userData, 'settings.json'), JSON.stringify(settings));
            }
        },
    },
    {
        label: 'Max Recents',
        click: async () => {
            const max = await prompt('Max Recents', 'Enter a number for the max number of recents to save', { defaultText: settings.maxRecents || '10' });
            if (!max) {
                return false;
            }
            settings.maxRecents = max;
            fs.writeFileSync(path.join(userData, 'settings.json'), JSON.stringify(settings));
        }
    },
    {
        label: 'Reset Recents',
        click: () => {
            const confirm = dialog.showMessageBox({
                type: 'warning',
                buttons: ['Yes', 'No'],
                title: 'Reset Recents',
                message: 'Are you sure you want to reset your recents?'
            });
            if(confirm.response == 1) return false;
            fs.writeFileSync(path.join(userData, 'recents.json'), JSON.stringify([]));
        },
    },
    {
        label:"File Associations",
        submenu:[
            {
                label:settings.showAppIcons == false ? 'Show App Icons' : 'Don\'t Show App Icons',
                click: async () => {
                    const show = await dialog.showMessageBox({
                        type: 'info',
                        title: 'Show App Icons',
                        message: `Would you like to ${settings.showAppIcons == false ? 'show' : 'hide'} app icons in the Open With menu?`,
                        buttons: ['Yes', 'No']
                    });
                    if(show.response == 0){
                        typeof settings.showAppIcons == 'boolean' ? settings.showAppIcons = !settings.showAppIcons : settings.showAppIcons = false;
                        fs.writeFileSync(path.join(userData, 'settings.json'), JSON.stringify(settings));
                    }
                },
            },
            {
                label:"Clear Icon Cache",
                click: () => {
                    shell.trashItem(path.join(tmp, 'icon-cache'));
                }
            },
            {
                label:"Custom Filter",
                click: async () => {

                    if(!fs.existsSync(`${userData}/associations_filter.js`)){
                        fs.writeFileSync(`${userData}/associations_filter.js`, `module.exports = (association={ name:"", path:"" }, file_path = "", ext = "") => {
// association is an object with name and path of the app, file_path is the path to the file as a string, and ext is the file extension as a string
    return true;
}`);
}
shell.openPath(`${userData}/associations_filter.js`);

                }
            }
        ]
    }
])
menu.popup();
})