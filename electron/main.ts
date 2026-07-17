import { app, BrowserWindow, ipcMain } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createRequire } from 'node:module'
import Store from 'electron-store'
import crypto from 'node:crypto'
import http from 'node:http'
import os from 'node:os'
import { excelStorage } from './excelStorage'
import { database } from './database'
import { shell } from 'electron'
import pkg from 'electron-updater'
const { autoUpdater } = pkg

const require = createRequire(import.meta.url)
const { machineIdSync } = require('node-machine-id')
const Database = require('better-sqlite3')

const store = new Store()
const SECRET_SALT = 'MEDFLOW-OFFLINE-LICENSE-2024-X99'

// Seed or migrate default known users
const rawUsers = store.get('known_users');
if (!rawUsers) {
  store.set('known_users', [
    { id: 'default', role: 'reception' },
    { id: 'admin', role: 'reception' },
    { id: 'reception1', role: 'reception' },
    { id: 'doctor1', role: 'doctor' },
    { id: 'doctor2', role: 'doctor' }
  ]);
} else if (Array.isArray(rawUsers) && rawUsers.length > 0 && typeof rawUsers[0] === 'string') {
  const migrated = (rawUsers as string[]).map(u => ({
    id: u.toLowerCase(),
    role: u.toLowerCase().includes('doctor') ? 'doctor' : 'reception'
  }));
  store.set('known_users', migrated);
}

// Workstation Mode Configuration
const workstationMode = (store.get('workstation_mode') || 'standalone') as 'standalone' | 'host' | 'client';
const hostIp = store.get('host_ip') as string || '127.0.0.1';
const hostPort = store.get('host_port') as number || 49152;

// Initialize Database using saved user if any (only if NOT running as Client)
const savedUser = store.get('current_user') as string || '';
if (workstationMode !== 'client') {
  if (savedUser) {
    database.init(Database, savedUser)
    excelStorage.setUserId(savedUser)
  } else {
    database.init(Database)
  }
}

// Networking Setup
let hostServer: http.Server | null = null;

function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  const ips: string[] = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  
  // Prioritize standard local network addresses (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
  // and skip link-local (169.254.x.x) if standard ones exist
  const standardIps = ips.filter(ip => !ip.startsWith('169.254.'));
  if (standardIps.length > 0) {
    return standardIps.join(', ');
  }
  if (ips.length > 0) {
    return ips.join(', ');
  }
  return '127.0.0.1';
}

function startHostServer() {
  if (hostServer) {
    try { hostServer.close(); } catch (e) {}
  }

  const port = store.get('host_port') as number || 49152;

  hostServer = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.url === '/api/rpc' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const { method, args } = JSON.parse(body);
          let result;

          if (method.startsWith('db-')) {
            const dbMethod = method.substring(3);
            const camelMethod = dbMethod.replace(/-([a-z])/g, (g: string) => g[1].toUpperCase());
            if (typeof (database as any)[camelMethod] === 'function') {
              result = await (database as any)[camelMethod](...args);
            } else {
              throw new Error(`Database method ${camelMethod} not found`);
            }
          } else if (method === 'save-to-excel') {
            result = await excelStorage.saveData(args[0]);
          } else if (method === 'load-from-excel') {
            result = await excelStorage.loadData();
          } else if (method === 'get-known-users') {
            result = store.get('known_users') || [];
          } else if (method === 'add-known-user') {
            const [userId, role, doctorId] = args;
            const cleanId = userId.trim().toLowerCase();
            const knownUsers = store.get('known_users') as any[] || [];
            if (knownUsers.some(u => u.id === cleanId)) {
              result = { success: false, error: 'User ID already exists' };
            } else {
              knownUsers.push({ id: cleanId, role: role || 'reception', doctorId: doctorId || undefined });
              store.set('known_users', knownUsers);
              result = { success: true };
            }
          } else if (method === 'delete-known-user') {
            const [userId] = args;
            const cleanId = userId.trim().toLowerCase();
            if (cleanId === 'default') {
              result = { success: false, error: 'Cannot delete the default profile' };
            } else {
              let knownUsers = store.get('known_users') as any[] || [];
              knownUsers = knownUsers.filter(u => u.id !== cleanId);
              store.set('known_users', knownUsers);
              result = { success: true };
            }
          } else if (method === 'set-user-password') {
            const [userId, password] = args;
            const cleanId = userId.trim().toLowerCase();
            const knownUsers = store.get('known_users') as any[] || [];
            const idx = knownUsers.findIndex(u => u.id === cleanId);
            if (idx !== -1) {
              knownUsers[idx].password = password || '';
              store.set('known_users', knownUsers);
              result = { success: true };
            } else {
              result = { success: false, error: 'User ID not found' };
            }
          } else if (method === 'ping') {
            result = { pong: true };
          } else {
            throw new Error(`Unknown RPC method: ${method}`);
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ result }));
        } catch (err: any) {
          console.error('Host RPC error:', err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  hostServer.listen(port, '0.0.0.0', () => {
    console.log(`MedFlow Host Server listening on 0.0.0.0:${port}`);
  });
}

// Start host server if in host mode
if (workstationMode === 'host') {
  startHostServer();
}

async function clientRequest(method: string, ...args: any[]) {
  const cHostIp = store.get('host_ip') as string || '127.0.0.1';
  const cHostPort = store.get('host_port') as number || 49152;
  const url = `http://${cHostIp}:${cHostPort}/api/rpc`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ method, args }),
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText || `Server returned status ${res.status}`);
    }
    const data = (await res.json()) as any;
    if (data.error) {
      throw new Error(data.error);
    }
    return data.result;
  } catch (err: any) {
    console.error(`Client RPC request failed to ${url} for ${method}:`, err);
    throw new Error(`Failed to communicate with Host Server: ${err.message}`);
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ └── main.js
// │

process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Built prefix
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

// Licensing Logic
const getMachineID = () => {
  try {
    return machineIdSync()
  } catch (error) {
    console.error('Failed to get machine ID:', error)
    return 'UNKNOWN-DEVICE'
  }
}

// Full Key Format: YYYYMMDD-XXXX-XXXX-XXXX-XXXX
const generateDateBoundKey = (id: string, dateStr: string) => {
  const hash = crypto.createHash('sha256').update(id + dateStr + SECRET_SALT).digest('hex').toUpperCase()
  return `${dateStr}-${hash.substring(0, 4)}-${hash.substring(4, 8)}-${hash.substring(8, 12)}-${hash.substring(12, 16)}`
}

ipcMain.handle('get-machine-id', () => getMachineID())

ipcMain.handle('check-activation', () => {
  const savedKey = store.get('license_key') as string
  if (!savedKey) return { status: 'NOT_ACTIVATED' }

  const parts = savedKey.split('-')
  const dateStr = parts[0]
  
  if (!dateStr || dateStr.length !== 8) return { status: 'NOT_ACTIVATED' }

  const expectedKey = generateDateBoundKey(getMachineID(), dateStr)
  if (savedKey !== expectedKey) return { status: 'INVALID' }

  // Expiry check
  const expiryDate = new Date(
    parseInt(dateStr.substring(0, 4)),
    parseInt(dateStr.substring(4, 6)) - 1,
    parseInt(dateStr.substring(6, 8)),
    23, 59, 59
  )
  
  const now = new Date()
  
  // Anti-tampering check
  const lastSeenStr = store.get('last_seen_date') as string
  if (lastSeenStr) {
    const lastSeen = new Date(lastSeenStr)
    // If current time is more than 24 hours BEFORE last seen, suspect tampering
    // (We allow small drifts but not major clock resets)
    if (now < new Date(lastSeen.getTime() - 1000 * 60 * 60)) {
      return { status: 'TAMPERED', message: 'System clock has been manipulated.' }
    }
  }
  
  if (now > expiryDate) {
    return { status: 'EXPIRED', expiryDate: expiryDate.toLocaleDateString() }
  }

  // Update last seen to current time
  store.set('last_seen_date', now.toISOString())

  const daysLeft = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  return { status: 'ACTIVATED', daysLeft, expiryDate: expiryDate.toLocaleDateString() }
})

ipcMain.handle('activate-license', (_, fullKey: string) => {
  const cleanKey = fullKey.trim().toUpperCase()
  const parts = cleanKey.split('-')
  const dateStr = parts[0]

  if (!dateStr || dateStr.length !== 8) {
    return { success: false, message: 'Invalid License Format' }
  }

  const expectedKey = generateDateBoundKey(getMachineID(), dateStr)
  if (cleanKey === expectedKey) {
    store.set('license_key', cleanKey)
    store.set('last_seen_date', new Date().toISOString())
    return { success: true }
  }
  return { success: false, message: 'Invalid License Key' }
})

// For original developer to generate keys
ipcMain.handle('dev-generate-key', (_, mid: string, dateStr: string) => {
  return generateDateBoundKey(mid, dateStr)
})

// Excel Storage IPCs
ipcMain.handle('save-to-excel', (_, data: any) => {
  if (workstationMode === 'client') return clientRequest('save-to-excel', data);
  return excelStorage.saveData(data)
})

ipcMain.handle('load-from-excel', () => {
  if (workstationMode === 'client') return clientRequest('load-from-excel');
  return excelStorage.loadData()
})

ipcMain.handle('open-excel-file', () => {
  if (workstationMode === 'client') return;
  shell.openPath(excelStorage.getExcelPath())
})

// SQLite Database IPCs
ipcMain.handle('db-get-doctors', () => {
  if (workstationMode === 'client') return clientRequest('db-get-doctors');
  return database.getDoctors();
})
ipcMain.handle('db-save-doctor', (_, doctor) => {
  if (workstationMode === 'client') return clientRequest('db-save-doctor', doctor);
  return database.saveDoctor(doctor);
})
ipcMain.handle('db-delete-doctor', (_, id) => {
  if (workstationMode === 'client') return clientRequest('db-delete-doctor', id);
  return database.deleteDoctor(id);
})

ipcMain.handle('db-get-services', () => {
  if (workstationMode === 'client') return clientRequest('db-get-services');
  return database.getServices();
})
ipcMain.handle('db-save-service', (_, service) => {
  if (workstationMode === 'client') return clientRequest('db-save-service', service);
  return database.saveService(service);
})
ipcMain.handle('db-delete-service', (_, id) => {
  if (workstationMode === 'client') return clientRequest('db-delete-service', id);
  return database.deleteService(id);
})

ipcMain.handle('db-get-receipts', () => {
  if (workstationMode === 'client') return clientRequest('db-get-receipts');
  return database.getReceipts();
})
ipcMain.handle('db-save-receipt', (_, receipt) => {
  if (workstationMode === 'client') return clientRequest('db-save-receipt', receipt);
  return database.saveReceipt(receipt);
})
ipcMain.handle('db-update-receipt', (_, receipt) => {
  if (workstationMode === 'client') return clientRequest('db-update-receipt', receipt);
  return database.updateReceipt(receipt);
})
ipcMain.handle('db-delete-receipt', (_, id) => {
  if (workstationMode === 'client') return clientRequest('db-delete-receipt', id);
  return database.deleteReceipt(id);
})

ipcMain.handle('db-get-metadata', (_, key) => {
  if (workstationMode === 'client') return clientRequest('db-get-metadata', key);
  return database.getMetadata(key);
})
ipcMain.handle('db-set-metadata', (_, key, value) => {
  if (workstationMode === 'client') return clientRequest('db-set-metadata', key, value);
  return database.setMetadata(key, value);
})

ipcMain.handle('db-batch-import-doctors', (_, doctors) => {
  if (workstationMode === 'client') return clientRequest('db-batch-import-doctors', doctors);
  return database.batchImportDoctors(doctors);
})

ipcMain.handle('open-db-folder', () => {
  if (workstationMode === 'client') return;
  shell.showItemInFolder(database.getDbPath())
})

// User Profile Management IPCs
ipcMain.handle('get-known-users', async () => {
  if (workstationMode === 'client') {
    try {
      return await clientRequest('get-known-users');
    } catch (e) {
      return store.get('known_users') || [];
    }
  }
  return store.get('known_users') || [
    { id: 'default', role: 'reception' },
    { id: 'admin', role: 'reception' },
    { id: 'reception1', role: 'reception' },
    { id: 'doctor1', role: 'doctor' },
    { id: 'doctor2', role: 'doctor' }
  ];
});

ipcMain.handle('add-known-user', (_, userId: string, role: string, doctorId?: string) => {
  if (workstationMode === 'client') return clientRequest('add-known-user', userId, role, doctorId);

  const cleanId = userId.trim().toLowerCase();
  if (!cleanId) return { success: false, error: 'User ID cannot be empty' };
  
  const knownUsers = store.get('known_users') as { id: string, role: string, doctorId?: string }[] || [];
  if (knownUsers.some(u => u.id === cleanId)) {
    return { success: false, error: 'User ID already exists' };
  }
  
  knownUsers.push({ id: cleanId, role: role || 'reception', doctorId: doctorId || undefined });
  store.set('known_users', knownUsers);
  return { success: true };
});

ipcMain.handle('delete-known-user', (_, userId: string) => {
  if (workstationMode === 'client') return clientRequest('delete-known-user', userId);

  const cleanId = userId.trim().toLowerCase();
  if (cleanId === 'default') {
    return { success: false, error: 'Cannot delete the default profile' };
  }
  
  let knownUsers = store.get('known_users') as { id: string, role: string, doctorId?: string }[] || [];
  knownUsers = knownUsers.filter(u => u.id !== cleanId);
  store.set('known_users', knownUsers);
  
  // If the deleted user was active, disconnect them
  const currentUser = store.get('current_user') as string || '';
  if (currentUser === cleanId) {
    store.set('current_user', '');
    excelStorage.setUserId(null);
    database.init(Database);
  }
  
  return { success: true };
});

ipcMain.handle('connect-user', async (_, userId: string, password?: string) => {
  const cleanId = userId.trim().toLowerCase();
  
  let knownUsers: any[] = [];
  if (workstationMode === 'client') {
    try {
      knownUsers = await clientRequest('get-known-users');
    } catch (err: any) {
      return { success: false, error: 'Cannot reach Host Server. Check connection settings.' };
    }
  } else {
    knownUsers = store.get('known_users') as any[] || [];
  }
  
  const user = knownUsers.find(u => u.id === cleanId);
  if (!user) {
    return { success: false, error: 'Access Denied: User ID is not recognized.' };
  }
  
  // Doctor role password check
  if (user.role === 'doctor') {
    if (!user.password) {
      return { success: true, requirePasswordSetup: true, role: user.role, doctorId: user.doctorId };
    }
    if (password === undefined) {
      return { success: false, requirePasswordInput: true };
    }
    if (user.password !== password) {
      return { success: false, error: 'Incorrect password' };
    }
  }
  
  if (workstationMode !== 'client') {
    database.init(Database, cleanId);
    excelStorage.setUserId(cleanId);
  }
  store.set('current_user', cleanId);
  return { success: true, role: user.role, doctorId: user.doctorId };
});

ipcMain.handle('set-user-password', (_, userId: string, password?: string) => {
  if (workstationMode === 'client') return clientRequest('set-user-password', userId, password);

  const cleanId = userId.trim().toLowerCase();
  const knownUsers = store.get('known_users') as { id: string, role: string, doctorId?: string, password?: string }[] || [];
  const idx = knownUsers.findIndex(u => u.id === cleanId);
  if (idx !== -1) {
    knownUsers[idx].password = password || '';
    store.set('known_users', knownUsers);
    return { success: true };
  }
  return { success: false, error: 'User ID not found' };
});

ipcMain.handle('get-current-user', () => {
  return store.get('current_user') || '';
});

ipcMain.handle('get-current-user-role', async () => {
  const currentUser = store.get('current_user') as string || '';
  if (!currentUser) return '';
  
  let knownUsers: any[] = [];
  if (workstationMode === 'client') {
    try {
      knownUsers = await clientRequest('get-known-users');
    } catch (e) {
      knownUsers = store.get('known_users') as any[] || [];
    }
  } else {
    knownUsers = store.get('known_users') as any[] || [];
  }
  const user = knownUsers.find(u => u.id === currentUser);
  return user ? user.role : 'reception';
});

ipcMain.handle('get-current-user-doctor-id', async () => {
  const currentUser = store.get('current_user') as string || '';
  if (!currentUser) return '';
  
  let knownUsers: any[] = [];
  if (workstationMode === 'client') {
    try {
      knownUsers = await clientRequest('get-known-users');
    } catch (e) {
      knownUsers = store.get('known_users') as any[] || [];
    }
  } else {
    knownUsers = store.get('known_users') as any[] || [];
  }
  const user = knownUsers.find(u => u.id === currentUser);
  return user ? user.doctorId || '' : '';
});

ipcMain.handle('disconnect-user', () => {
  store.set('current_user', '');
  if (workstationMode !== 'client') {
    excelStorage.setUserId(null);
    database.init(Database);
  }
  return true;
});

// SQLite Database Prescriptions IPCs
ipcMain.handle('db-get-prescriptions', () => {
  if (workstationMode === 'client') return clientRequest('db-get-prescriptions');
  return database.getPrescriptions();
})
ipcMain.handle('db-save-prescription', (_, prescription) => {
  if (workstationMode === 'client') return clientRequest('db-save-prescription', prescription);
  return database.savePrescription(prescription);
})
ipcMain.handle('db-delete-prescription', (_, id) => {
  if (workstationMode === 'client') return clientRequest('db-delete-prescription', id);
  return database.deletePrescription(id);
})

// Workstation Connection Setting IPCs
ipcMain.handle('get-connection-settings', () => {
  return {
    mode: store.get('workstation_mode') || 'standalone',
    hostIp: store.get('host_ip') || '127.0.0.1',
    hostPort: store.get('host_port') || 49152,
    localIp: getLocalIpAddress(),
  };
});

ipcMain.handle('save-connection-settings', (_, settings) => {
  const { mode, hostIp, hostPort } = settings;
  const cleanIp = (hostIp || '').trim().replace(/^https?:\/\//i, '').replace(/\/$/, '');
  store.set('workstation_mode', mode);
  store.set('host_ip', cleanIp || '127.0.0.1');
  store.set('host_port', hostPort || 49152);

  app.relaunch();
  app.exit();
  return { success: true };
});

ipcMain.handle('get-server-status', () => {
  if (workstationMode === 'host') {
    return { status: 'RUNNING', localIp: getLocalIpAddress(), port: hostPort };
  } else if (workstationMode === 'client') {
    return { status: 'CLIENT', hostIp, port: hostPort };
  }
  return { status: 'STANDALONE' };
});

ipcMain.handle('test-connection', async (_, ip: string, port: number) => {
  const cleanIp = (ip || '').trim().replace(/^https?:\/\//i, '').replace(/\/$/, '');
  const url = `http://${cleanIp}:${port}/api/rpc`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: 'ping', args: [] }),
      signal: AbortSignal.timeout(3000)
    });
    if (res.ok) {
      const data = (await res.json()) as any;
      if (data.result && data.result.pong) {
        return { success: true };
      }
    }
    return { success: false, error: `Invalid response from server at ${url}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});


function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 900,
    title: 'MedFlow Clinic Management',
    icon: path.join(process.env.VITE_PUBLIC || RENDERER_DIST, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date()).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  createWindow()
  
  // Check for updates and notify the user using system notifications
  autoUpdater.checkForUpdatesAndNotify()
})

// Automatically install the update when downloaded
autoUpdater.on('update-downloaded', () => {
  autoUpdater.quitAndInstall()
})

