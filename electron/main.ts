import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createRequire } from 'node:module'
import Store from 'electron-store'
import crypto from 'node:crypto'
import http from 'node:http'
import os from 'node:os'
import { database } from './database'
import { whatsappBot } from './whatsappBot'
import { shell } from 'electron'
import pkg from 'electron-updater'
const { autoUpdater } = pkg

const require = createRequire(import.meta.url)
const { machineIdSync } = require('node-machine-id')
const Database = require('better-sqlite3')

const store = new Store()

// License salt — used ONLY for license key generation/validation
const LICENSE_SALT = 'MEDFLOW-OFFLINE-LICENSE-2024-X99'
// Password salt — separate from license salt for security isolation
// Generated per-installation and stored in electron-store
if (!store.get('password_salt')) {
  store.set('password_salt', crypto.randomBytes(32).toString('hex'));
}
const PASSWORD_SALT = store.get('password_salt') as string;

// Ensure a network secret exists for RPC authentication
if (!store.get('network_secret')) {
  store.set('network_secret', crypto.randomBytes(32).toString('hex'));
}

// Seed or migrate default known users
const rawUsers = store.get('known_users');
let knownUsersList: any[] = [];

if (!rawUsers) {
  knownUsersList = [
    { id: 'default', role: 'reception' },
    { id: 'admin', role: 'reception' }
  ];
  store.set('known_users', knownUsersList);
} else if (Array.isArray(rawUsers)) {
  if (rawUsers.length > 0 && typeof rawUsers[0] === 'string') {
    knownUsersList = (rawUsers as string[]).map(u => ({
      id: u.toLowerCase(),
      role: u.toLowerCase().includes('doctor') ? 'doctor' : 'reception'
    }));
  } else {
    knownUsersList = rawUsers;
  }
  
  // Clean out legacy demo profiles
  knownUsersList = knownUsersList.filter(u => u && !['reception1', 'doctor1', 'doctor2'].includes(u.id));

  // Ensure 'admin' user profile is always present
  const hasAdmin = knownUsersList.some(u => u && u.id === 'admin');
  if (!hasAdmin) {
    knownUsersList.push({ id: 'admin', role: 'reception' });
  }

  // Ensure 'default' user profile is always present
  const hasDefault = knownUsersList.some(u => u && u.id === 'default');
  if (!hasDefault) {
    knownUsersList.unshift({ id: 'default', role: 'reception' });
  }

  store.set('known_users', knownUsersList);
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
    return standardIps[0];
  }
  if (ips.length > 0) {
    return ips[0];
  }
  return '127.0.0.1';
}

function startHostServer() {
  if (hostServer) {
    try { hostServer.close(); } catch (e) {}
  }

  const port = store.get('host_port') as number || 49152;

  // Simple rate limiter: max 60 requests per minute per IP
  const rpcRateMap = new Map<string, { count: number; resetAt: number }>();

  // Periodically clean up expired rate limiter entries every 5 minutes to prevent memory leaks
  const rateLimitCleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of rpcRateMap.entries()) {
      if (entry.resetAt <= now) {
        rpcRateMap.delete(ip);
      }
    }
  }, 5 * 60 * 1000);
  rateLimitCleanupInterval.unref();

  hostServer = http.createServer((req, res) => {
    // Allow any origin since authentication is strictly enforced via X-Buvora-Auth token
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Buvora-Auth, X-MedFlow-Auth');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.url === '/api/rpc' && req.method === 'POST') {
      // Rate limiting
      const clientIp = req.socket.remoteAddress || 'unknown';
      const now = Date.now();
      const entry = rpcRateMap.get(clientIp);
      if (entry && entry.resetAt > now) {
        entry.count++;
        if (entry.count > 3000) {
          res.writeHead(429, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Too many requests. Try again later.' }));
          return;
        }
      } else {
        rpcRateMap.set(clientIp, { count: 1, resetAt: now + 60000 });
      }

      const authHeader = req.headers['x-buvora-auth'] || req.headers['x-medflow-auth'];
      const expectedSecret = store.get('network_secret') as string;
      if (authHeader !== expectedSecret) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized: Invalid network secret' }));
        return;
      }

      let body = '';
      let bodySize = 0;
      const MAX_BODY_SIZE = 1024 * 1024; // 1MB limit

      req.on('data', (chunk: Buffer) => {
        bodySize += chunk.length;
        if (bodySize > MAX_BODY_SIZE) {
          res.writeHead(413, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Request body too large (max 1MB)' }));
          req.destroy();
          return;
        }
        body += chunk;
      });
      req.on('end', async () => {
        if (bodySize > MAX_BODY_SIZE) return; // Already handled
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
          } else if (method === 'get-known-users') {
            const knownUsers = store.get('known_users') as any[] || [];
            try {
              const allDocs = database.getDoctors();
              for (const doc of allDocs) {
                const docIdClean = (doc.id || '').toLowerCase();
                const docNameClean = (doc.name || '').toLowerCase();
                if (docIdClean && !knownUsers.some((u: any) => u.id === docIdClean || u.id === docNameClean)) {
                  knownUsers.push({ id: docNameClean || docIdClean, role: 'doctor', doctorId: doc.id });
                }
              }
            } catch (e) {}
            result = knownUsers;
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
            let idx = knownUsers.findIndex(u => u.id === cleanId);
            if (idx === -1) {
              try {
                const allDocs = database.getDoctors();
                const matchedDoc = allDocs.find((d: any) => 
                  (d.id && d.id.toLowerCase() === cleanId) || 
                  (d.name && d.name.toLowerCase() === cleanId) ||
                  (d.name && d.name.toLowerCase().replace(/^dr\.?\s*/i, '') === cleanId.replace(/^dr\.?\s*/i, ''))
                );
                if (matchedDoc) {
                  knownUsers.push({ id: cleanId, role: 'doctor', doctorId: matchedDoc.id });
                  idx = knownUsers.length - 1;
                }
              } catch (e) {}
            }
            if (idx !== -1) {
              const hashPassword = (pwd: string) => crypto.createHash('sha256').update(pwd + PASSWORD_SALT).digest('hex');
              knownUsers[idx].password = password ? hashPassword(password) : '';
              store.set('known_users', knownUsers);
              result = { success: true };
            } else {
              result = { success: false, error: 'User ID not found' };
            }
          } else if (method === 'reset-admin-password') {
            const knownUsers = store.get('known_users') as any[] || [];
            const idx = knownUsers.findIndex(u => u && u.id === 'admin');
            if (idx !== -1) {
              knownUsers[idx].password = '';
              store.set('known_users', knownUsers);
              result = { success: true, message: 'Admin password reset successfully! Enter "admin" to set a new password.' };
            } else {
              result = { success: false, error: 'Admin user not found.' };
            }
          } else if (method === 'connect-user') {
            const [userId, password] = args;
            const cleanId = userId.trim().toLowerCase();
            const knownUsers = store.get('known_users') as any[] || [];
            const hashPassword = (pwd: string) => crypto.createHash('sha256').update(pwd + PASSWORD_SALT).digest('hex');
            let user = knownUsers.find(u => u.id === cleanId);
            if (!user) {
              try {
                const allDocs = database.getDoctors();
                const matchedDoc = allDocs.find((d: any) => 
                  (d.id && d.id.toLowerCase() === cleanId) || 
                  (d.name && d.name.toLowerCase() === cleanId) ||
                  (d.name && d.name.toLowerCase().replace(/^dr\.?\s*/i, '') === cleanId.replace(/^dr\.?\s*/i, ''))
                );
                if (matchedDoc) {
                  user = { id: cleanId, role: 'doctor', doctorId: matchedDoc.id, password: '' };
                  knownUsers.push(user);
                  store.set('known_users', knownUsers);
                }
              } catch (e) {}
            }
            if (!user) {
              result = { success: false, error: 'Access Denied: User ID is not recognized.' };
            } else if (!user.password) {
              result = { success: true, requirePasswordSetup: true, role: user.role, doctorId: user.doctorId };
            } else if (password === undefined || password === null || password === '') {
              result = { success: false, requirePasswordInput: true };
            } else {
              const isHashedMatch = user.password === hashPassword(password);
              const isPlainMatch = user.password === password;
              if (isHashedMatch || isPlainMatch) {
                if (isPlainMatch && !isHashedMatch) {
                  user.password = hashPassword(password);
                  store.set('known_users', knownUsers);
                }
                result = { success: true, role: user.role, doctorId: user.doctorId };
              } else {
                result = { success: false, error: 'Incorrect password' };
              }
            }
          } else if (method === 'whatsapp-get-schedule') {
            result = store.get('whatsapp_schedule') || {
              allowedDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
              timeSlots: [
                '09:00 AM - 10:00 AM',
                '10:00 AM - 11:00 AM',
                '11:00 AM - 12:00 PM',
                '12:00 PM - 01:00 PM',
                '04:00 PM - 05:00 PM',
                '05:00 PM - 06:00 PM',
                '06:00 PM - 07:00 PM',
                '07:00 PM - 08:00 PM'
              ]
            };
          } else if (method === 'whatsapp-save-schedule') {
            const [schedule] = args;
            store.set('whatsapp_schedule', schedule);
            result = { success: true };
          } else if (method === 'whatsapp-send-message') {
            const [phone, message] = args;
            result = await whatsappBot.sendMessage(phone, message);
          } else if (method === 'validate-client-license') {
            const [machineId, fullKey] = args;
            if (!fullKey) {
              result = { status: 'NOT_ACTIVATED' };
            } else {
              const cleanKey = fullKey.trim().toUpperCase();
              const parts = cleanKey.split('-');
              const dateStr = parts[0];
              
              if (!dateStr || dateStr.length !== 8) {
                result = { status: 'INVALID' };
              } else {
                const expectedKey = generateDateBoundKey(machineId, dateStr);
                if (cleanKey !== expectedKey) {
                  result = { status: 'INVALID' };
                } else {
                  const expiryDate = new Date(
                    parseInt(dateStr.substring(0, 4)),
                    parseInt(dateStr.substring(4, 6)) - 1,
                    parseInt(dateStr.substring(6, 8)),
                    23, 59, 59
                  );
                  const now = new Date();
                  if (now > expiryDate) {
                    result = { status: 'EXPIRED', expiryDate: expiryDate.toLocaleDateString() };
                  } else {
                    const daysLeft = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    result = { status: 'ACTIVATED', daysLeft, expiryDate: expiryDate.toLocaleDateString() };
                  }
                }
              }
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
    } else if (req.method === 'GET' && !req.url?.startsWith('/api/')) {
      try {
        const fs = require('node:fs');
        const urlPath = req.url === '/' || !req.url ? '/index.html' : req.url;
        const cleanUrl = urlPath.split('?')[0];
        
        const myDirname = path.dirname(fileURLToPath(import.meta.url));
        const staticBasePath = app.isPackaged 
          ? path.join(process.resourcesPath, 'app.asar', 'dist')
          : path.join(myDirname, '..', 'dist');

        const targetPath = path.resolve(staticBasePath, '.' + (cleanUrl.startsWith('/') ? cleanUrl : '/' + cleanUrl));
        const rel = path.relative(staticBasePath, targetPath);
        if (rel.startsWith('..') || path.isAbsolute(rel)) {
          res.writeHead(403);
          res.end('Forbidden');
          return;
        }

        let filePath = targetPath;

        if (!fs.existsSync(filePath) && !path.extname(cleanUrl)) {
          filePath = path.join(staticBasePath, 'index.html');
        }

        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const extname = path.extname(filePath).toLowerCase();
          const mimeTypes: Record<string, string> = {
            '.html': 'text/html',
            '.js': 'text/javascript',
            '.mjs': 'text/javascript',
            '.css': 'text/css',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.svg': 'image/svg+xml',
            '.ico': 'image/x-icon',
            '.woff': 'font/woff',
            '.woff2': 'font/woff2'
          };
          const contentType = mimeTypes[extname] || 'application/octet-stream';
          const content = fs.readFileSync(filePath);
          res.writeHead(200, { 'Content-Type': contentType });
          res.end(content);
        } else {
          res.writeHead(404);
          res.end('Not Found');
        }
      } catch (err: any) {
        console.error('Static server error:', err);
        res.writeHead(500);
        res.end('Internal Server Error');
      }
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  hostServer.listen(port, '0.0.0.0', () => {
    console.log(`Buvora Host Server listening on 0.0.0.0:${port}`);
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
  // Use the secret that was copied from the Host machine, not this machine's own secret.
  const secret = (store.get('client_network_secret') as string) || '';
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Buvora-Auth': secret,
        'X-MedFlow-Auth': secret
      },
      body: JSON.stringify({ method, args }),
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText || `Server returned ${res.status} — check network token in Settings`);
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
  const hash = crypto.createHash('sha256').update(id + dateStr + LICENSE_SALT).digest('hex').toUpperCase()
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

ipcMain.handle('deactivate-license', () => {
  store.delete('license_key')
  store.delete('last_seen_date')
  return { success: true }
})

// Database folder IPC
ipcMain.handle('open-db-folder', () => {
  if (workstationMode === 'client') return;
  const dbDir = path.join(app.getPath('userData'), 'ClinicData');
  shell.openPath(dbDir);
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

ipcMain.handle('db-get-receipts', (_, options) => {
  if (workstationMode === 'client') return clientRequest('db-get-receipts', options);
  return database.getReceipts(options);
});

ipcMain.handle('db-get-dashboard-metrics', () => {
  if (workstationMode === 'client') return clientRequest('db-get-dashboard-metrics');
  return database.getDashboardMetrics();
});

ipcMain.handle('db-save-receipt', (_, receipt) => {
  if (workstationMode === 'client') return clientRequest('db-save-receipt', receipt);
  return database.saveReceipt(receipt);
})
ipcMain.handle('db-save-receipt-atomic', (_, receipt, metaKey, nextNum) => {
  if (workstationMode === 'client') return clientRequest('db-save-receipt-atomic', receipt, metaKey, nextNum);
  return database.saveReceiptAtomic(receipt, metaKey, nextNum);
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

ipcMain.handle('db-get-appointments', () => {
  if (workstationMode === 'client') return clientRequest('db-get-appointments');
  return database.getAppointments();
})
ipcMain.handle('db-save-appointment', (_, appointment) => {
  if (workstationMode === 'client') return clientRequest('db-save-appointment', appointment);
  return database.saveAppointment(appointment);
})
ipcMain.handle('db-update-appointment-status', (_, id, status, rejectionReason) => {
  if (workstationMode === 'client') return clientRequest('db-update-appointment-status', id, status, rejectionReason);
  return database.updateAppointmentStatus(id, status, rejectionReason);
})
ipcMain.handle('db-delete-appointment', (_, id) => {
  if (workstationMode === 'client') return clientRequest('db-delete-appointment', id);
  return database.deleteAppointment(id);
})

// WhatsApp Bot IPCs
whatsappBot.setOnAppointmentSavedCallback(() => {
  if (win) win.webContents.send('appointment-updated');
});

ipcMain.handle('whatsapp-start', async () => {
  return whatsappBot.start((state) => {
    if (win) win.webContents.send('whatsapp-state-update', state);
  });
})
ipcMain.handle('whatsapp-stop', async () => {
  return whatsappBot.stop();
})
ipcMain.handle('whatsapp-get-status', () => {
  return whatsappBot.getStatus();
})
ipcMain.handle('whatsapp-toggle-autoreply', (_, enabled: boolean) => {
  return whatsappBot.toggleAutoReply(enabled);
})
ipcMain.handle('whatsapp-send-message', (_, phone: string, message: string) => {
  if (workstationMode === 'client') return clientRequest('whatsapp-send-message', phone, message);
  return whatsappBot.sendMessage(phone, message);
})
ipcMain.handle('whatsapp-get-schedule', () => {
  if (workstationMode === 'client') return clientRequest('whatsapp-get-schedule');
  const schedule = store.get('whatsapp_schedule');
  return schedule || {
    allowedDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    timeSlots: [
      '09:00 AM - 10:00 AM',
      '10:00 AM - 11:00 AM',
      '11:00 AM - 12:00 PM',
      '12:00 PM - 01:00 PM',
      '04:00 PM - 05:00 PM',
      '05:00 PM - 06:00 PM',
      '06:00 PM - 07:00 PM',
      '07:00 PM - 08:00 PM'
    ]
  };
})
ipcMain.handle('whatsapp-save-schedule', (_, schedule) => {
  if (workstationMode === 'client') return clientRequest('whatsapp-save-schedule', schedule);
  store.set('whatsapp_schedule', schedule);
  return { success: true };
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
  const knownUsers = store.get('known_users') as any[] || [
    { id: 'default', role: 'reception' },
    { id: 'admin', role: 'reception' }
  ];
  try {
    const allDocs = database.getDoctors();
    for (const doc of allDocs) {
      const docIdClean = (doc.id || '').toLowerCase();
      const docNameClean = (doc.name || '').toLowerCase();
      if (docIdClean && !knownUsers.some((u: any) => u.id === docIdClean || u.id === docNameClean)) {
        knownUsers.push({ id: docNameClean || docIdClean, role: 'doctor', doctorId: doc.id });
      }
    }
  } catch (e) {}
  return knownUsers;
});

ipcMain.handle('add-known-user', (_, userId: string, role: string, doctorId?: string) => {
  const activeUser = store.get('current_user') as string || '';
  if (activeUser.toLowerCase() !== 'admin') {
    return { success: false, error: 'Unauthorized: Only the "admin" profile can add users.' };
  }

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
  const activeUser = store.get('current_user') as string || '';
  if (activeUser.toLowerCase() !== 'admin') {
    return { success: false, error: 'Unauthorized: Only the "admin" profile can delete users.' };
  }

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
    database.init(Database);
  }
  
  return { success: true };
});

ipcMain.handle('connect-user', async (_, userId: string, password?: string) => {
  const cleanId = userId.trim().toLowerCase();
  
  if (workstationMode === 'client') {
    try {
      const res = await clientRequest('connect-user', userId, password);
      if (res && res.success && !res.requirePasswordSetup) {
        store.set('current_user', cleanId);
      }
      return res;
    } catch (err: any) {
      return { success: false, error: err.message || 'Cannot reach Host Server. Check connection settings.' };
    }
  }

  const knownUsers = store.get('known_users') as any[] || [];
  const hashPassword = (pwd: string) => {
    return crypto.createHash('sha256').update(pwd + PASSWORD_SALT).digest('hex');
  };

  let user = knownUsers.find(u => u.id === cleanId);
  if (!user) {
    try {
      const allDocs = database.getDoctors();
      const matchedDoc = allDocs.find((d: any) => 
        (d.id && d.id.toLowerCase() === cleanId) || 
        (d.name && d.name.toLowerCase() === cleanId) ||
        (d.name && d.name.toLowerCase().replace(/^dr\.?\s*/i, '') === cleanId.replace(/^dr\.?\s*/i, ''))
      );
      if (matchedDoc) {
        user = { id: cleanId, role: 'doctor', doctorId: matchedDoc.id, password: '' };
        knownUsers.push(user);
        store.set('known_users', knownUsers);
      }
    } catch (e) {}
  }

  if (!user) {
    return { success: false, error: 'Access Denied: User ID is not recognized.' };
  }
  
  // Enforce password check for all workstation user profiles
  if (!user.password) {
    return { success: true, requirePasswordSetup: true, role: user.role, doctorId: user.doctorId };
  }
  if (password === undefined || password === null || password === '') {
    return { success: false, requirePasswordInput: true };
  }
  
  const isHashedMatch = user.password === hashPassword(password);
  const isPlainMatch = user.password === password;
  if (isHashedMatch || isPlainMatch) {
    if (isPlainMatch && !isHashedMatch) {
      user.password = hashPassword(password);
      store.set('known_users', knownUsers);
    }
    database.init(Database, cleanId);
    store.set('current_user', cleanId);
    return { success: true, role: user.role, doctorId: user.doctorId };
  } else {
    return { success: false, error: 'Incorrect password' };
  }
});

ipcMain.handle('set-user-password', (_, userId: string, password?: string) => {
  if (workstationMode === 'client') return clientRequest('set-user-password', userId, password);

  const cleanId = userId.trim().toLowerCase();
  const knownUsers = store.get('known_users') as { id: string, role: string, doctorId?: string, password?: string }[] || [];
  let idx = knownUsers.findIndex(u => u.id === cleanId);
  if (idx === -1) {
    try {
      const allDocs = database.getDoctors();
      const matchedDoc = allDocs.find((d: any) => 
        (d.id && d.id.toLowerCase() === cleanId) || 
        (d.name && d.name.toLowerCase() === cleanId) ||
        (d.name && d.name.toLowerCase().replace(/^dr\.?\s*/i, '') === cleanId.replace(/^dr\.?\s*/i, ''))
      );
      if (matchedDoc) {
        knownUsers.push({ id: cleanId, role: 'doctor', doctorId: matchedDoc.id });
        idx = knownUsers.length - 1;
      }
    } catch (e) {}
  }
  if (idx !== -1) {
    const hashPassword = (pwd: string) => crypto.createHash('sha256').update(pwd + PASSWORD_SALT).digest('hex');
    knownUsers[idx].password = password ? hashPassword(password) : '';
    store.set('known_users', knownUsers);
    return { success: true };
  }
  return { success: false, error: 'User ID not found' };
});

ipcMain.handle('reset-admin-password', () => {
  if (workstationMode === 'client') return clientRequest('reset-admin-password');

  const knownUsers = store.get('known_users') as any[] || [];
  const idx = knownUsers.findIndex(u => u && u.id === 'admin');
  if (idx !== -1) {
    knownUsers[idx].password = '';
    store.set('known_users', knownUsers);
    return { success: true, message: 'Admin password reset successfully! Enter "admin" to set a new password.' };
  }
  return { success: false, error: 'Admin user not found.' };
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
    // Host exposes its own secret; client exposes whatever token it has saved
    networkSecret: workstationMode === 'host'
      ? (store.get('network_secret') as string)
      : (store.get('client_network_secret') as string) || '',
  };
});

ipcMain.handle('save-connection-settings', (_, settings) => {
  const { mode, hostIp, hostPort, networkSecret } = settings;
  const cleanIp = (hostIp || '').trim().replace(/^https?:\/\//i, '').replace(/\/$/, '');
  store.set('workstation_mode', mode);
  store.set('host_ip', cleanIp || '127.0.0.1');
  store.set('host_port', hostPort || 49152);
  if (networkSecret !== undefined && mode === 'client') {
    store.set('client_network_secret', (networkSecret || '').trim());
  }

  app.relaunch();
  app.exit();
  return { success: true };
});

// Save the host's network token on the client — no relaunch needed, takes effect immediately.
ipcMain.handle('save-client-secret', (_, secret: string) => {
  if (workstationMode !== 'client') {
    return { success: false, error: 'Only client workstations need to save a network token.' };
  }
  const trimmed = (secret || '').trim();
  if (!trimmed) return { success: false, error: 'Token cannot be empty.' };
  store.set('client_network_secret', trimmed);
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

// test-connection: send the provided client secret or the stored client secret
ipcMain.handle('test-connection', async (_, ip: string, port: number, secretOverride?: string) => {
  const cleanIp = (ip || '').trim().replace(/^https?:\/\//i, '').replace(/\/$/, '');
  const url = `http://${cleanIp}:${port}/api/rpc`;
  const secret = (secretOverride !== undefined ? secretOverride : store.get('client_network_secret') as string) || '';
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Buvora-Auth': secret,
        'X-MedFlow-Auth': secret,
      },
      body: JSON.stringify({ method: 'ping', args: [] }),
      signal: AbortSignal.timeout(4000)
    });
    if (res.ok) {
      const data = (await res.json()) as any;
      if (data.result && data.result.pong) {
        return { success: true };
      }
    }
    if (res.status === 401) {
      return { success: false, error: 'Unauthorized: Network Token is invalid or missing. Please copy the Network Token from the Host PC.' };
    }
    return { success: false, error: `Server responded with status ${res.status}. Check network token.` };
  } catch (err: any) {
    if (err.name === 'TimeoutError' || err.message?.includes('aborted') || err.message?.includes('timeout')) {
      return { success: false, error: `Connection timed out. Check Host IP (${cleanIp}), port (${port}), and Firewall settings on the Host PC.` };
    }
    if (err.message?.includes('ECONNREFUSED')) {
      return { success: false, error: `Connection refused. Make sure Host PC is running Buvora in 'Host' mode on port ${port}.` };
    }
    if (err.message?.includes('ENETUNREACH') || err.message?.includes('EHOSTUNREACH')) {
      return { success: false, error: `Host unreachable. Make sure both PCs are connected to the same Wi-Fi / LAN network.` };
    }
    return { success: false, error: err.message };
  }
});


function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 900,
    title: 'Buvora Management',
    icon: path.join(process.env.VITE_PUBLIC || RENDERER_DIST, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  // Content Security Policy — restrict script/style sources
  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' http:* https:*;"
        ],
      },
    });
  });

  // Open external web links (e.g. WhatsApp Web wa.me) in system default browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://') || url.startsWith('mailto:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date()).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
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

// Prompt user before installing update — don't interrupt work unexpectedly
autoUpdater.on('update-downloaded', () => {
  if (win) {
    dialog.showMessageBox(win, {
      type: 'info',
      title: 'Update Ready',
      message: 'A new version has been downloaded. The application will restart to apply the update.',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  } else {
    autoUpdater.quitAndInstall();
  }
})
