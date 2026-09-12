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
    database.init(Database, savedUser);
  } else {
    database.init(Database);
  }

  // Two-way synchronization: ensure users in SQLite are merged with electron-store
  try {
    const dbUsers = database.getUsers();
    if (dbUsers && dbUsers.length > 0) {
      for (const du of dbUsers) {
        const existingIdx = knownUsersList.findIndex(u => u && u.id === du.id);
        if (existingIdx !== -1) {
          knownUsersList[existingIdx] = { ...knownUsersList[existingIdx], ...du };
        } else {
          knownUsersList.push(du);
        }
      }
      store.set('known_users', knownUsersList);
    }
    // Persist all known users to SQLite database
    for (const su of knownUsersList) {
      if (su && su.id) {
        database.saveUser(su);
      }
    }
  } catch (e) {
    console.error('[User Bootstrap] Failed to sync users with database:', e);
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
            let camelMethod = dbMethod.replace(/-([a-z])/g, (g: string) => g[1].toUpperCase());
            if (camelMethod === 'getPharmacyMetrics') {
              camelMethod = 'getPharmacyDashboardMetrics';
            }
            const allowedMethods = [
              'getDoctors', 'saveDoctor', 'deleteDoctor', 'getServices', 'saveService', 'deleteService',
              'getReceipts', 'getDashboardMetrics', 'saveReceipt', 'saveReceiptAtomic', 'updateReceipt',
              'deleteReceipt', 'getMetadata', 'setMetadata', 'batchImportDoctors', 'getPrescriptions',
              'savePrescription', 'deletePrescription', 'getAppointments', 'saveAppointment',
              'updateAppointmentStatus', 'deleteAppointment', 'getFollowUps', 'saveFollowUp',
              'updateFollowUpStatus', 'deleteFollowUp', 'getExpenses', 'saveExpense', 'deleteExpense',
              'getMedicines', 'saveMedicine', 'deleteMedicine', 'getMedicineBatches', 'saveMedicineBatch',
              'deleteMedicineBatch', 'adjustMedicineStock', 'getPharmacySales', 'savePharmacySale',
              'deletePharmacySale', 'getPharmacyDashboardMetrics', 'getPharmacyMetrics',
              'getWards', 'saveWard', 'deleteWard',
              'getBeds', 'saveBed', 'deleteBed', 'updateBedStatus',
              'getBedAdmissions', 'admitPatientToBed', 'transferPatientBed',
              'updateAdmissionBillingStatus', 'dischargePatientAdmission', 'addAdmissionVital', 'addAdmissionCharge', 'deleteAdmissionCharge',
              'addEmarOrder', 'updateEmarOrderStatus', 'recordEmarAdministration', 'addFluidIoEntry', 'deleteFluidIoEntry', 'addNursingShiftNote', 'deleteNursingShiftNote',
              'getIpdDashboardMetrics',
              'getLabTests', 'saveLabTest', 'deleteLabTest', 'getNextLabOrderNumber',
              'getLabOrders', 'getLabOrderById', 'saveLabOrder', 'updateLabOrderStatus',
              'saveLabOrderResults', 'deleteLabOrder', 'getLabDashboardMetrics',
              'getTpaProviders', 'saveTpaProvider', 'deleteTpaProvider',
              'getInsuranceClaims', 'getInsuranceClaimById', 'saveInsuranceClaim',
              'updateClaimStatus', 'addClaimQuery', 'getInsuranceDashboardMetrics',
              'saveDischargeSummary', 'getDischargeSummary',
              'getOperationTheatres', 'saveOperationTheatre', 'deleteOperationTheatre',
              'getSurgicalCases', 'getSurgicalCaseById', 'saveSurgicalCase', 'updateSurgicalCaseStatus',
              'getOtDashboardMetrics',
              'getEmergencyVisits', 'getEmergencyVisitById', 'saveEmergencyVisit', 'updateEmergencyDisposition',
              'getMlcRecords', 'getMlcRecordById', 'saveMlcRecord', 'getEmergencyDashboardMetrics',
              'getDoctorCommissionRules', 'getDoctorCommissionRuleByDoctorId', 'saveDoctorCommissionRule',
              'calculateDoctorAccruedEarnings', 'getDoctorPayoutTransactions', 'saveDoctorPayoutTransaction',
              'getHospitalIndents', 'getHospitalIndentById', 'saveHospitalIndent', 'issueHospitalIndent',
              'completeHospitalIndent', 'cancelHospitalIndent',
              'getHospitalTier3Metrics', 'searchGlobalPatients'
            ];
            if (allowedMethods.includes(camelMethod) && typeof (database as any)[camelMethod] === 'function') {
              result = await (database as any)[camelMethod](...args);
            } else {
              throw new Error(`Unauthorized or unknown database method: ${camelMethod}`);
            }
          } else if (method === 'get-known-users') {
            let knownUsers = store.get('known_users') as any[] || [];
            try {
              const dbUsers = database.getUsers();
              if (dbUsers && dbUsers.length > 0) {
                const map = new Map<string, any>();
                for (const u of knownUsers) {
                  if (u && u.id) map.set(u.id.toLowerCase(), u);
                }
                for (const u of dbUsers) {
                  if (u && u.id) {
                    const existing = map.get(u.id.toLowerCase());
                    map.set(u.id.toLowerCase(), { ...(existing || {}), ...u });
                  }
                }
                knownUsers = Array.from(map.values());
                store.set('known_users', knownUsers);
              }
            } catch (e) {
              console.error('[RPC get-known-users] DB error:', e);
            }
            if (knownUsers.length === 0) {
              knownUsers = [
                { id: 'default', role: 'reception' },
                { id: 'admin', role: 'reception' }
              ];
            }
            result = knownUsers;
          } else if (method === 'add-known-user') {
            const [userId, role, doctorId, allowedTabs] = args;
            const cleanId = userId.trim().toLowerCase();
            const knownUsers = store.get('known_users') as any[] || [];
            if (knownUsers.some(u => u.id === cleanId)) {
              result = { success: false, error: 'User ID already exists' };
            } else {
              const newUser = { id: cleanId, role: role || 'reception', doctorId: doctorId || undefined, allowedTabs: allowedTabs || [], createdAt: new Date().toISOString() };
              knownUsers.push(newUser);
              store.set('known_users', knownUsers);
              try {
                database.saveUser(newUser);
              } catch (e) {
                console.error('[RPC add-known-user] DB save error:', e);
              }
              result = { success: true };
            }
          } else if (method === 'delete-known-user') {
            const [userId] = args;
            const cleanId = userId.trim().toLowerCase();
            if (cleanId === 'default' || cleanId === 'admin') {
              result = { success: false, error: 'Cannot delete the default/admin profile' };
            } else {
              let knownUsers = store.get('known_users') as any[] || [];
              knownUsers = knownUsers.filter(u => u.id !== cleanId);
              store.set('known_users', knownUsers);
              try {
                database.deleteUser(cleanId);
              } catch (e) {
                console.error('[RPC delete-known-user] DB delete error:', e);
              }
              result = { success: true };
            }
          } else if (method === 'set-user-password') {
            const [userId, password] = args;
            const cleanId = userId.trim().toLowerCase();
            const knownUsers = store.get('known_users') as any[] || [];
            const idx = knownUsers.findIndex(u => u.id === cleanId);
            if (idx !== -1) {
              const hashPassword = (pwd: string) => crypto.createHash('sha256').update(pwd + PASSWORD_SALT).digest('hex');
              const pwdHash = password ? hashPassword(password) : '';
              knownUsers[idx].password = pwdHash;
              store.set('known_users', knownUsers);
              try {
                database.setUserPassword(cleanId, pwdHash);
              } catch (e) {
                console.error('[RPC set-user-password] DB error:', e);
              }
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
              try {
                database.setUserPassword('admin', '');
              } catch (e) {
                console.error('[RPC reset-admin-password] DB error:', e);
              }
              result = { success: true, message: 'Admin password reset successfully! Enter "admin" to set a new password.' };
            } else {
              result = { success: false, error: 'Admin user not found.' };
            }
          } else if (method === 'connect-user') {
            const [userId, password] = args;
            const cleanId = userId.trim().toLowerCase();
            const knownUsers = store.get('known_users') as any[] || [];
            const hashPassword = (pwd: string) => crypto.createHash('sha256').update(pwd + PASSWORD_SALT).digest('hex');
            const user = knownUsers.find(u => u.id === cleanId);
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
                  try {
                    database.setUserPassword(cleanId, user.password);
                  } catch (e) {}
                }
                result = { success: true, role: user.role, doctorId: user.doctorId };
              } else {
                result = { success: false, error: 'Incorrect password' };
              }
            }
          } else if (method === 'update-user-tabs') {
            const [userId, tabs] = args;
            const cleanId = userId.trim().toLowerCase();
            const knownUsers = store.get('known_users') as any[] || [];
            const userIndex = knownUsers.findIndex(u => u.id === cleanId);
            if (userIndex !== -1) {
              knownUsers[userIndex].allowedTabs = tabs;
              store.set('known_users', knownUsers);
              try {
                database.updateUserTabs(cleanId, tabs);
              } catch (e) {
                console.error('[RPC update-user-tabs] DB error:', e);
              }
              result = { success: true };
            } else {
              result = { success: false, error: 'User not found' };
            }
          } else if (method === 'whatsapp-get-status') {
            result = whatsappBot.getStatus();
          } else if (method === 'whatsapp-toggle-autoreply') {
            const [enabled] = args;
            result = whatsappBot.toggleAutoReply(enabled);
          } else if (method === 'whatsapp-start') {
            result = await whatsappBot.start((state) => {
              if (win) win.webContents.send('whatsapp-state-update', state);
            });
          } else if (method === 'whatsapp-stop') {
            result = await whatsappBot.stop();
          } else if (method === 'whatsapp-get-schedule') {
            const saved = store.get('whatsapp_schedule') as any;
            const clinicName = (saved && saved.clinicName) || store.get('clinic_name') || 'Buvora';
            result = saved ? { ...saved, clinicName } : {
              clinicName,
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
            if (schedule && schedule.clinicName) {
              store.set('clinic_name', schedule.clinicName);
            }
            result = { success: true };
          } else if (method === 'whatsapp-send-message') {
            const [phone, message] = args;
            result = await whatsappBot.sendMessage(phone, message);
          } else if (method === 'whatsapp-share-prescription-pdf') {
            const [phone, rxData] = args;
            result = await generateAndSendPrescriptionPdf(phone, rxData);
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
          res.writeHead(200, {
            'Content-Type': contentType,
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          });
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
      signal: AbortSignal.timeout(method.includes('whatsapp') || method.includes('export') || method.includes('batch') ? 30000 : 8000)
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


ipcMain.handle('update-user-tabs', (_, userId: string, tabs: string[]) => {
  const activeUser = (store.get('current_user') as string || '').toLowerCase();
  if (activeUser && activeUser !== 'admin' && activeUser !== 'default') {
    return { success: false, error: 'Unauthorized: Only the "admin" profile can edit user tabs.' };
  }
  if (workstationMode === 'client') return clientRequest('update-user-tabs', userId, tabs);

  const cleanId = userId.trim().toLowerCase();
  const knownUsers = store.get('known_users') as any[] || [];
  const userIndex = knownUsers.findIndex(u => u.id === cleanId);
  if (userIndex !== -1) {
    knownUsers[userIndex].allowedTabs = tabs;
    store.set('known_users', knownUsers);
  }
  try {
    database.updateUserTabs(cleanId, tabs);
  } catch (e) {
    console.error('[DB] updateUserTabs error:', e);
  }
  return { success: true };
});

ipcMain.handle('get-current-user-tabs', () => {
  const currentUser = store.get('current_user') as string || null;
  if (!currentUser) return null;
  if (currentUser.toLowerCase() === 'admin') return null;
  try {
    const dbUsers = database.getUsers();
    const dbUser = dbUsers.find(u => u.id.toLowerCase() === currentUser.toLowerCase());
    if (dbUser && Array.isArray(dbUser.allowedTabs)) {
      return dbUser.allowedTabs;
    }
  } catch (e) {}
  const knownUsers = store.get('known_users') as any[] || [];
  const user = knownUsers.find(u => u.id.toLowerCase() === currentUser.toLowerCase());
  return user && Array.isArray(user.allowedTabs) ? user.allowedTabs : null;
});

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

// SQLite Database Follow-Ups IPCs
ipcMain.handle('db-get-follow-ups', (_, options) => {
  if (workstationMode === 'client') return clientRequest('db-get-follow-ups', options);
  return database.getFollowUps(options);
})
ipcMain.handle('db-save-follow-up', (_, followUp) => {
  if (workstationMode === 'client') return clientRequest('db-save-follow-up', followUp);
  return database.saveFollowUp(followUp);
})
ipcMain.handle('db-update-follow-up-status', (_, id, status) => {
  if (workstationMode === 'client') return clientRequest('db-update-follow-up-status', id, status);
  return database.updateFollowUpStatus(id, status);
})
ipcMain.handle('db-delete-follow-up', (_, id) => {
  if (workstationMode === 'client') return clientRequest('db-delete-follow-up', id);
  return database.deleteFollowUp(id);
})

// SQLite Database Expenses & Bills IPCs
ipcMain.handle('db-get-expenses', (_, options) => {
  if (workstationMode === 'client') return clientRequest('db-get-expenses', options);
  return database.getExpenses(options);
})
ipcMain.handle('db-save-expense', (_, expense) => {
  if (workstationMode === 'client') return clientRequest('db-save-expense', expense);
  return database.saveExpense(expense);
})
ipcMain.handle('db-delete-expense', (_, id) => {
  if (workstationMode === 'client') return clientRequest('db-delete-expense', id);
  return database.deleteExpense(id);
})

// SQLite Database Hospital Pharmacy IPCs
ipcMain.handle('db-get-medicines', (_, search, category) => {
  if (workstationMode === 'client') return clientRequest('db-get-medicines', search, category);
  return database.getMedicines(search, category);
})
ipcMain.handle('db-save-medicine', (_, medicine) => {
  if (workstationMode === 'client') return clientRequest('db-save-medicine', medicine);
  return database.saveMedicine(medicine);
})
ipcMain.handle('db-delete-medicine', (_, id) => {
  if (workstationMode === 'client') return clientRequest('db-delete-medicine', id);
  return database.deleteMedicine(id);
})
ipcMain.handle('db-get-medicine-batches', (_, medicineId) => {
  if (workstationMode === 'client') return clientRequest('db-get-medicine-batches', medicineId);
  return database.getMedicineBatches(medicineId);
})
ipcMain.handle('db-save-medicine-batch', (_, batch) => {
  if (workstationMode === 'client') return clientRequest('db-save-medicine-batch', batch);
  return database.saveMedicineBatch(batch);
})
ipcMain.handle('db-delete-medicine-batch', (_, id) => {
  if (workstationMode === 'client') return clientRequest('db-delete-medicine-batch', id);
  return database.deleteMedicineBatch(id);
})
ipcMain.handle('db-adjust-medicine-stock', (_, batchId, quantityDiff) => {
  if (workstationMode === 'client') return clientRequest('db-adjust-medicine-stock', batchId, quantityDiff);
  return database.adjustMedicineStock(batchId, quantityDiff);
})
ipcMain.handle('db-get-pharmacy-sales', (_, options) => {
  if (workstationMode === 'client') return clientRequest('db-get-pharmacy-sales', options);
  return database.getPharmacySales(options);
})
ipcMain.handle('db-save-pharmacy-sale', (_, sale) => {
  if (workstationMode === 'client') return clientRequest('db-save-pharmacy-sale', sale);
  return database.savePharmacySale(sale);
})
ipcMain.handle('db-delete-pharmacy-sale', (_, id) => {
  if (workstationMode === 'client') return clientRequest('db-delete-pharmacy-sale', id);
  return database.deletePharmacySale(id);
})
ipcMain.handle('db-get-pharmacy-metrics', () => {
  if (workstationMode === 'client') return clientRequest('db-get-pharmacy-metrics');
  return database.getPharmacyDashboardMetrics();
})

// SQLite Database Hospital IPD (Wards, Beds, Admissions) IPCs
ipcMain.handle('db-get-wards', () => {
  if (workstationMode === 'client') return clientRequest('db-get-wards');
  return database.getWards();
})
ipcMain.handle('db-save-ward', (_, ward) => {
  if (workstationMode === 'client') return clientRequest('db-save-ward', ward);
  return database.saveWard(ward);
})
ipcMain.handle('db-delete-ward', (_, id) => {
  if (workstationMode === 'client') return clientRequest('db-delete-ward', id);
  return database.deleteWard(id);
})
ipcMain.handle('db-get-beds', (_, wardId) => {
  if (workstationMode === 'client') return clientRequest('db-get-beds', wardId);
  return database.getBeds(wardId);
})
ipcMain.handle('db-save-bed', (_, bed) => {
  if (workstationMode === 'client') return clientRequest('db-save-bed', bed);
  return database.saveBed(bed);
})
ipcMain.handle('db-delete-bed', (_, id) => {
  if (workstationMode === 'client') return clientRequest('db-delete-bed', id);
  return database.deleteBed(id);
})
ipcMain.handle('db-update-bed-status', (_, bedId, status) => {
  if (workstationMode === 'client') return clientRequest('db-update-bed-status', bedId, status);
  return database.updateBedStatus(bedId, status);
})
ipcMain.handle('db-get-bed-admissions', (_, options) => {
  if (workstationMode === 'client') return clientRequest('db-get-bed-admissions', options);
  return database.getBedAdmissions(options);
})
ipcMain.handle('db-admit-patient-to-bed', (_, data) => {
  if (workstationMode === 'client') return clientRequest('db-admit-patient-to-bed', data);
  return database.admitPatientToBed(data);
})
ipcMain.handle('db-transfer-patient-bed', (_, admissionId, newBedId, reason) => {
  if (workstationMode === 'client') return clientRequest('db-transfer-patient-bed', admissionId, newBedId, reason);
  return database.transferPatientBed(admissionId, newBedId, reason);
})
ipcMain.handle('db-update-admission-billing-status', (_, admissionId, billingStatus, notes) => {
  if (workstationMode === 'client') return clientRequest('db-update-admission-billing-status', admissionId, billingStatus, notes);
  return database.updateAdmissionBillingStatus(admissionId, billingStatus, notes);
})
ipcMain.handle('db-discharge-patient-admission', (_, admissionId, data) => {
  if (workstationMode === 'client') return clientRequest('db-discharge-patient-admission', admissionId, data);
  return database.dischargePatientAdmission(admissionId, data);
})
ipcMain.handle('db-add-admission-vital', (_, admissionId, vital) => {
  if (workstationMode === 'client') return clientRequest('db-add-admission-vital', admissionId, vital);
  return database.addAdmissionVital(admissionId, vital);
})
ipcMain.handle('db-add-admission-charge', (_, admissionId, charge) => {
  if (workstationMode === 'client') return clientRequest('db-add-admission-charge', admissionId, charge);
  return database.addAdmissionCharge(admissionId, charge);
})
ipcMain.handle('db-delete-admission-charge', (_, admissionId, chargeId) => {
  if (workstationMode === 'client') return clientRequest('db-delete-admission-charge', admissionId, chargeId);
  return database.deleteAdmissionCharge(admissionId, chargeId);
})
ipcMain.handle('db-add-emar-order', (_, admissionId, order) => {
  if (workstationMode === 'client') return clientRequest('db-add-emar-order', admissionId, order);
  return database.addEmarOrder(admissionId, order);
})
ipcMain.handle('db-update-emar-order-status', (_, admissionId, orderId, status) => {
  if (workstationMode === 'client') return clientRequest('db-update-emar-order-status', admissionId, orderId, status);
  return database.updateEmarOrderStatus(admissionId, orderId, status);
})
ipcMain.handle('db-record-emar-administration', (_, admissionId, record) => {
  if (workstationMode === 'client') return clientRequest('db-record-emar-administration', admissionId, record);
  return database.recordEmarAdministration(admissionId, record);
})
ipcMain.handle('db-add-fluid-io-entry', (_, admissionId, entry) => {
  if (workstationMode === 'client') return clientRequest('db-add-fluid-io-entry', admissionId, entry);
  return database.addFluidIoEntry(admissionId, entry);
})
ipcMain.handle('db-delete-fluid-io-entry', (_, admissionId, entryId) => {
  if (workstationMode === 'client') return clientRequest('db-delete-fluid-io-entry', admissionId, entryId);
  return database.deleteFluidIoEntry(admissionId, entryId);
})
ipcMain.handle('db-add-nursing-shift-note', (_, admissionId, note) => {
  if (workstationMode === 'client') return clientRequest('db-add-nursing-shift-note', admissionId, note);
  return database.addNursingShiftNote(admissionId, note);
})
ipcMain.handle('db-delete-nursing-shift-note', (_, admissionId, noteId) => {
  if (workstationMode === 'client') return clientRequest('db-delete-nursing-shift-note', admissionId, noteId);
  return database.deleteNursingShiftNote(admissionId, noteId);
})
ipcMain.handle('db-get-ipd-dashboard-metrics', () => {
  if (workstationMode === 'client') return clientRequest('db-get-ipd-dashboard-metrics');
  return database.getIpdDashboardMetrics();
})

// SQLite Database Laboratory & Diagnostics IPCs
ipcMain.handle('db-get-lab-tests', (_, category) => {
  if (workstationMode === 'client') return clientRequest('db-get-lab-tests', category);
  return database.getLabTests(category);
})
ipcMain.handle('db-save-lab-test', (_, test) => {
  if (workstationMode === 'client') return clientRequest('db-save-lab-test', test);
  return database.saveLabTest(test);
})
ipcMain.handle('db-delete-lab-test', (_, id) => {
  if (workstationMode === 'client') return clientRequest('db-delete-lab-test', id);
  return database.deleteLabTest(id);
})
ipcMain.handle('db-get-next-lab-order-number', () => {
  if (workstationMode === 'client') return clientRequest('db-get-next-lab-order-number');
  return database.getNextLabOrderNumber();
})
ipcMain.handle('db-get-lab-orders', () => {
  if (workstationMode === 'client') return clientRequest('db-get-lab-orders');
  return database.getLabOrders();
})
ipcMain.handle('db-get-lab-order-by-id', (_, id) => {
  if (workstationMode === 'client') return clientRequest('db-get-lab-order-by-id', id);
  return database.getLabOrderById(id);
})
ipcMain.handle('db-save-lab-order', (_, order) => {
  if (workstationMode === 'client') return clientRequest('db-save-lab-order', order);
  return database.saveLabOrder(order);
})
ipcMain.handle('db-update-lab-order-status', (_, id, status, details) => {
  if (workstationMode === 'client') return clientRequest('db-update-lab-order-status', id, status, details);
  return database.updateLabOrderStatus(id, status, details);
})
ipcMain.handle('db-save-lab-order-results', (_, id, testsWithResults, pathologistRemarks) => {
  if (workstationMode === 'client') return clientRequest('db-save-lab-order-results', id, testsWithResults, pathologistRemarks);
  return database.saveLabOrderResults(id, testsWithResults, pathologistRemarks);
})
ipcMain.handle('db-delete-lab-order', (_, id) => {
  if (workstationMode === 'client') return clientRequest('db-delete-lab-order', id);
  return database.deleteLabOrder(id);
})
ipcMain.handle('db-get-lab-dashboard-metrics', () => {
  if (workstationMode === 'client') return clientRequest('db-get-lab-dashboard-metrics');
  return database.getLabDashboardMetrics();
})

// SQLite Database TPA & Health Insurance Claims IPCs
ipcMain.handle('db-get-tpa-providers', () => {
  if (workstationMode === 'client') return clientRequest('db-get-tpa-providers');
  return database.getTpaProviders();
})
ipcMain.handle('db-save-tpa-provider', (_, provider) => {
  if (workstationMode === 'client') return clientRequest('db-save-tpa-provider', provider);
  return database.saveTpaProvider(provider);
})
ipcMain.handle('db-delete-tpa-provider', (_, id) => {
  if (workstationMode === 'client') return clientRequest('db-delete-tpa-provider', id);
  return database.deleteTpaProvider(id);
})
ipcMain.handle('db-get-insurance-claims', (_, options) => {
  if (workstationMode === 'client') return clientRequest('db-get-insurance-claims', options);
  return database.getInsuranceClaims(options);
})
ipcMain.handle('db-get-insurance-claim-by-id', (_, id) => {
  if (workstationMode === 'client') return clientRequest('db-get-insurance-claim-by-id', id);
  return database.getInsuranceClaimById(id);
})
ipcMain.handle('db-save-insurance-claim', (_, claim) => {
  if (workstationMode === 'client') return clientRequest('db-save-insurance-claim', claim);
  return database.saveInsuranceClaim(claim);
})
ipcMain.handle('db-update-claim-status', (_, id, status, notes) => {
  if (workstationMode === 'client') return clientRequest('db-update-claim-status', id, status, notes);
  return database.updateClaimStatus(id, status, notes);
})
ipcMain.handle('db-add-claim-query', (_, claimId, query) => {
  if (workstationMode === 'client') return clientRequest('db-add-claim-query', claimId, query);
  return database.addClaimQuery(claimId, query);
})
ipcMain.handle('db-get-insurance-dashboard-metrics', () => {
  if (workstationMode === 'client') return clientRequest('db-get-insurance-dashboard-metrics');
  return database.getInsuranceDashboardMetrics();
})
ipcMain.handle('db-save-discharge-summary', (_, admissionId, summary) => {
  if (workstationMode === 'client') return clientRequest('db-save-discharge-summary', admissionId, summary);
  return database.saveDischargeSummary(admissionId, summary);
})
ipcMain.handle('db-get-discharge-summary', (_, admissionId) => {
  if (workstationMode === 'client') return clientRequest('db-get-discharge-summary', admissionId);
  return database.getDischargeSummary(admissionId);
})

// Operation Theatre (OT) IPCs
ipcMain.handle('db-get-operation-theatres', () => {
  if (workstationMode === 'client') return clientRequest('db-get-operation-theatres');
  return database.getOperationTheatres();
})
ipcMain.handle('db-save-operation-theatre', (_, theatre) => {
  if (workstationMode === 'client') return clientRequest('db-save-operation-theatre', theatre);
  return database.saveOperationTheatre(theatre);
})
ipcMain.handle('db-delete-operation-theatre', (_, id) => {
  if (workstationMode === 'client') return clientRequest('db-delete-operation-theatre', id);
  return database.deleteOperationTheatre(id);
})
ipcMain.handle('db-get-surgical-cases', (_, options) => {
  if (workstationMode === 'client') return clientRequest('db-get-surgical-cases', options);
  return database.getSurgicalCases(options);
})
ipcMain.handle('db-get-surgical-case-by-id', (_, id) => {
  if (workstationMode === 'client') return clientRequest('db-get-surgical-case-by-id', id);
  return database.getSurgicalCaseById(id);
})
ipcMain.handle('db-save-surgical-case', (_, sc) => {
  if (workstationMode === 'client') return clientRequest('db-save-surgical-case', sc);
  return database.saveSurgicalCase(sc);
})
ipcMain.handle('db-update-surgical-case-status', (_, id, status, notes) => {
  if (workstationMode === 'client') return clientRequest('db-update-surgical-case-status', id, status, notes);
  return database.updateSurgicalCaseStatus(id, status, notes);
})
ipcMain.handle('db-get-ot-dashboard-metrics', () => {
  if (workstationMode === 'client') return clientRequest('db-get-ot-dashboard-metrics');
  return database.getOtDashboardMetrics();
})

// Emergency Department & MLC IPCs
ipcMain.handle('db-get-emergency-visits', (_, options) => {
  if (workstationMode === 'client') return clientRequest('db-get-emergency-visits', options);
  return database.getEmergencyVisits(options);
})
ipcMain.handle('db-get-emergency-visit-by-id', (_, id) => {
  if (workstationMode === 'client') return clientRequest('db-get-emergency-visit-by-id', id);
  return database.getEmergencyVisitById(id);
})
ipcMain.handle('db-save-emergency-visit', (_, visit) => {
  if (workstationMode === 'client') return clientRequest('db-save-emergency-visit', visit);
  return database.saveEmergencyVisit(visit);
})
ipcMain.handle('db-update-emergency-disposition', (_, id, disposition, details) => {
  if (workstationMode === 'client') return clientRequest('db-update-emergency-disposition', id, disposition, details);
  return database.updateEmergencyDisposition(id, disposition, details);
})
ipcMain.handle('db-get-mlc-records', () => {
  if (workstationMode === 'client') return clientRequest('db-get-mlc-records');
  return database.getMlcRecords();
})
ipcMain.handle('db-get-mlc-record-by-id', (_, id) => {
  if (workstationMode === 'client') return clientRequest('db-get-mlc-record-by-id', id);
  return database.getMlcRecordById(id);
})
ipcMain.handle('db-save-mlc-record', (_, mlc) => {
  if (workstationMode === 'client') return clientRequest('db-save-mlc-record', mlc);
  return database.saveMlcRecord(mlc);
})
ipcMain.handle('db-get-emergency-dashboard-metrics', () => {
  if (workstationMode === 'client') return clientRequest('db-get-emergency-dashboard-metrics');
  return database.getEmergencyDashboardMetrics();
})

// Module 3: Doctor Revenue Share, Commission & Payouts IPCs
ipcMain.handle('db-get-doctor-commission-rules', () => {
  if (workstationMode === 'client') return clientRequest('db-get-doctor-commission-rules');
  return database.getDoctorCommissionRules();
})
ipcMain.handle('db-get-doctor-commission-rule-by-doctor-id', (_, doctorId) => {
  if (workstationMode === 'client') return clientRequest('db-get-doctor-commission-rule-by-doctor-id', doctorId);
  return database.getDoctorCommissionRuleByDoctorId(doctorId);
})
ipcMain.handle('db-save-doctor-commission-rule', (_, rule) => {
  if (workstationMode === 'client') return clientRequest('db-save-doctor-commission-rule', rule);
  return database.saveDoctorCommissionRule(rule);
})
ipcMain.handle('db-calculate-doctor-accrued-earnings', (_, doctorId, startDate, endDate) => {
  if (workstationMode === 'client') return clientRequest('db-calculate-doctor-accrued-earnings', doctorId, startDate, endDate);
  return database.calculateDoctorAccruedEarnings(doctorId, startDate, endDate);
})
ipcMain.handle('db-get-doctor-payout-transactions', (_, doctorId) => {
  if (workstationMode === 'client') return clientRequest('db-get-doctor-payout-transactions', doctorId);
  return database.getDoctorPayoutTransactions(doctorId);
})
ipcMain.handle('db-save-doctor-payout-transaction', (_, payout) => {
  if (workstationMode === 'client') return clientRequest('db-save-doctor-payout-transaction', payout);
  return database.saveDoctorPayoutTransaction(payout);
})

// Module 3: Hospital Stock Indenting IPCs
ipcMain.handle('db-get-hospital-indents', (_, filter) => {
  if (workstationMode === 'client') return clientRequest('db-get-hospital-indents', filter);
  return database.getHospitalIndents(filter);
})
ipcMain.handle('db-get-hospital-indent-by-id', (_, id) => {
  if (workstationMode === 'client') return clientRequest('db-get-hospital-indent-by-id', id);
  return database.getHospitalIndentById(id);
})
ipcMain.handle('db-save-hospital-indent', (_, indent, items) => {
  if (workstationMode === 'client') return clientRequest('db-save-hospital-indent', indent, items);
  return database.saveHospitalIndent(indent, items);
})
ipcMain.handle('db-issue-hospital-indent', (_, indentId, itemsIssued, fulfilledBy) => {
  if (workstationMode === 'client') return clientRequest('db-issue-hospital-indent', indentId, itemsIssued, fulfilledBy);
  return database.issueHospitalIndent(indentId, itemsIssued, fulfilledBy);
})
ipcMain.handle('db-complete-hospital-indent', (_, indentId, fulfilledBy) => {
  if (workstationMode === 'client') return clientRequest('db-complete-hospital-indent', indentId, fulfilledBy);
  return database.completeHospitalIndent(indentId, fulfilledBy);
})
ipcMain.handle('db-cancel-hospital-indent', (_, indentId, reason) => {
  if (workstationMode === 'client') return clientRequest('db-cancel-hospital-indent', indentId, reason);
  return database.cancelHospitalIndent(indentId, reason);
})
ipcMain.handle('db-get-hospital-tier3-metrics', () => {
  if (workstationMode === 'client') return clientRequest('db-get-hospital-tier3-metrics');
  return database.getHospitalTier3Metrics();
})
ipcMain.handle('db-search-global-patients', (_, query) => {
  if (workstationMode === 'client') return clientRequest('db-search-global-patients', query);
  return database.searchGlobalPatients(query);
})

// WhatsApp Bot IPCs
whatsappBot.setOnAppointmentSavedCallback(() => {
  if (win) win.webContents.send('appointment-updated');
});

ipcMain.handle('whatsapp-start', async () => {
  if (workstationMode === 'client') return clientRequest('whatsapp-start');
  return whatsappBot.start((state) => {
    if (win) win.webContents.send('whatsapp-state-update', state);
  });
})
ipcMain.handle('whatsapp-stop', async () => {
  if (workstationMode === 'client') return clientRequest('whatsapp-stop');
  return whatsappBot.stop();
})
ipcMain.handle('whatsapp-get-status', () => {
  if (workstationMode === 'client') return clientRequest('whatsapp-get-status');
  return whatsappBot.getStatus();
})
ipcMain.handle('whatsapp-toggle-autoreply', (_, enabled: boolean) => {
  if (workstationMode === 'client') return clientRequest('whatsapp-toggle-autoreply', enabled);
  return whatsappBot.toggleAutoReply(enabled);
})
ipcMain.handle('whatsapp-send-message', (_, phone: string, message: string) => {
  if (workstationMode === 'client') return clientRequest('whatsapp-send-message', phone, message);
  return whatsappBot.sendMessage(phone, message);
})

async function generateAndSendPrescriptionPdf(phone: string, rxData: any) {
  const cleanDoctorName = '' + (rxData.doctorName || '').replace(/^(Dr\.?\s*)+/gi, '').trim();

  // Resolve PID (UHID / Patient ID / Receipt Number)
  let pid = rxData.patientId || rxData.pid || rxData.receiptNumber || '';
  if (!pid && rxData.receiptId) {
    try {
      const receipt = (database as any).getReceiptById ? (database as any).getReceiptById(rxData.receiptId) : null;
      if (receipt && (receipt.patientId || receipt.receiptNumber)) {
        pid = receipt.patientId || receipt.receiptNumber;
      }
    } catch (e) {
      console.error('Error resolving PID from database by receiptId:', e);
    }
  }
  if (!pid && rxData.patientPhone) {
    try {
      const receipts = database.getReceipts ? database.getReceipts({ search: rxData.patientPhone, limit: 1 }) : [];
      if (receipts && receipts.length > 0 && (receipts[0].patientId || receipts[0].receiptNumber)) {
        pid = receipts[0].patientId || receipts[0].receiptNumber;
      }
    } catch (e) {}
  }
  const cleanPid = pid ? String(pid).trim() : '';
  const displayPid = cleanPid 
    ? (cleanPid.startsWith('#') || cleanPid.startsWith('PID-') ? cleanPid : '#' + cleanPid)
    : (rxData.id ? '#' + String(rxData.id).replace(/^rx_/, '').slice(-6).toUpperCase() : 'N/A');

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin: 0; padding: 40px; color: #1e293b; }
        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 20px; }
        .clinic-name { font-size: 24px; font-weight: bold; color: #0284c7; margin: 0 0 5px 0; }
        .clinic-details { font-size: 12px; color: #64748b; line-height: 1.5; }
        .doctor-name { font-size: 18px; font-weight: 600; margin: 0 0 5px 0; color: #0f172a; }
        .doctor-details { font-size: 12px; color: #64748b; line-height: 1.5; text-align: right; }
        .patient-info { display: flex; justify-content: space-between; background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px; font-size: 13px; }
        .section-title { font-size: 14px; font-weight: 600; color: #0284c7; text-transform: uppercase; margin: 20px 0 10px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; }
        .text-block { font-size: 13px; line-height: 1.6; margin-bottom: 20px; white-space: pre-wrap; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
        th { text-align: left; padding: 10px; background: #f1f5f9; color: #475569; font-weight: 600; border-bottom: 1px solid #cbd5e1; }
        td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
        .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 20px; }
        .signature { margin-top: 50px; text-align: right; font-size: 13px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1 class="clinic-name">${rxData.clinicName || 'Clinic'}</h1>
          <div class="clinic-details">${(rxData.clinicAddress || '').replace(/\n/g, '<br/>')}</div>
          <div class="clinic-details">${rxData.clinicPhone ? 'Phone: ' + rxData.clinicPhone : ''}</div>
        </div>
        <div>
          <h2 class="doctor-name">${cleanDoctorName}</h2>
          <div class="doctor-details">${rxData.doctorSpecialization || ''}</div>
          <div class="doctor-details">${rxData.doctorQualifications || ''}</div>
          <div class="doctor-details">${rxData.doctorRegNo ? 'Reg: ' + rxData.doctorRegNo : ''}</div>
        </div>
      </div>
      
      <div class="patient-info">
        <div>
          <strong>Patient:</strong> ${rxData.patientName} 
          (${rxData.patientAge ? (String(rxData.patientAge).match(/[a-zA-Z]/) ? String(rxData.patientAge) + ' ' : String(rxData.patientAge) + ' Y ') : ''}${rxData.patientGender ? '/ ' + rxData.patientGender : ''})<br/>
          <strong style="margin-top: 4px; display: inline-block;">Phone:</strong> ${rxData.patientPhone || 'N/A'}
        </div>
        <div style="text-align: right;">
          <strong>Date:</strong> ${new Date(rxData.date).toLocaleDateString()}<br/>
          <strong style="margin-top: 4px; display: inline-block;">PID:</strong> ${displayPid}
        </div>
      </div>

      ${rxData.chiefComplaints ? `
      <div class="section-title">Chief Complaints & Symptoms</div>
      <div class="text-block">${rxData.chiefComplaints}</div>
      ` : ''}

      ${rxData.diagnosis ? `
      <div class="section-title">Clinical Diagnosis</div>
      <div class="text-block">${rxData.diagnosis}</div>
      ` : ''}

      ${rxData.medicines && rxData.medicines.length > 0 ? `
      <div class="section-title">Prescribed Medicines</div>
      <table>
        <thead>
          <tr>
            <th>Medicine</th>
            <th>Dosage</th>
            <th>Timing</th>
            <th>Duration</th>
          </tr>
        </thead>
        <tbody>
          ${rxData.medicines.map((m: any) => `
            <tr>
              <td>
                <strong>${m.name}</strong> ${m.composition ? `<br/><span style="color: #64748b; font-size: 11px;">${m.composition}</span>` : ''}
              </td>
              <td>${m.dosage}</td>
              <td>${m.timing}</td>
              <td>${m.duration}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ` : ''}

      ${((rxData.labInvestigations && rxData.labInvestigations.length > 0) || rxData.labTests) ? `
      <div class="section-title">Diagnostic Laboratory Investigations</div>
      <div class="text-block">${Array.isArray(rxData.labInvestigations) ? rxData.labInvestigations.join(', ') : (Array.isArray(rxData.labTests) ? rxData.labTests.join(', ') : (rxData.labInvestigations || rxData.labTests))}</div>
      ` : ''}

      ${rxData.advice ? `
      <div class="section-title">Diet & Lifestyle Advice</div>
      <div class="text-block">${rxData.advice}</div>
      ` : ''}

      ${rxData.followUpDate ? `
      <div class="section-title">Follow-up</div>
      <div class="text-block">Please revisit on <strong>${new Date(rxData.followUpDate).toLocaleDateString()}</strong></div>
      ` : ''}

      <div class="signature">
        <div>_________________________</div>
        <div style="margin-top: 5px;">${cleanDoctorName}</div>
      </div>

      <div class="footer">
        This is a digitally generated medical prescription.<br/>
        Generated on ${new Date().toLocaleString()}
      </div>
    </body>
    </html>
  `;

  const win = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false } });
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  const pdfBuffer = await win.webContents.printToPDF({
    printBackground: true,
    pageSize: 'A4',
    margins: { marginType: 'default' }
  });
  win.close();

  const fileName = `Prescription_${rxData.patientName.replace(/\s+/g, '_')}_${rxData.date}.pdf`;
  const caption = `Hello ${rxData.patientName},\n\nPlease find your digital prescription attached from ${cleanDoctorName}.\n\nGet well soon!`;
  
  return whatsappBot.sendDocument(phone, pdfBuffer, fileName, caption);
}

ipcMain.handle('whatsapp-share-prescription-pdf', async (_, phone: string, rxData: any) => {
  if (workstationMode === 'client') return clientRequest('whatsapp-share-prescription-pdf', phone, rxData);
  return generateAndSendPrescriptionPdf(phone, rxData);
})

ipcMain.handle('whatsapp-get-schedule', () => {
  if (workstationMode === 'client') return clientRequest('whatsapp-get-schedule');
  const schedule = store.get('whatsapp_schedule') as any;
  const clinicName = (schedule && schedule.clinicName) || store.get('clinic_name') || 'Buvora';
  return schedule ? { ...schedule, clinicName } : {
    clinicName,
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
  if (schedule && schedule.clinicName) {
    store.set('clinic_name', schedule.clinicName);
  }
  return { success: true };
});

// User Profile Management IPCs
ipcMain.handle('get-known-users', async () => {
  if (workstationMode === 'client') {
    try {
      return await clientRequest('get-known-users');
    } catch (e) {
      return store.get('known_users') || [];
    }
  }
  let knownUsers = store.get('known_users') as any[] || [];
  try {
    const dbUsers = database.getUsers();
    if (dbUsers && dbUsers.length > 0) {
      const map = new Map<string, any>();
      for (const u of knownUsers) {
        if (u && u.id) map.set(u.id.toLowerCase(), u);
      }
      for (const u of dbUsers) {
        if (u && u.id) {
          const existing = map.get(u.id.toLowerCase());
          map.set(u.id.toLowerCase(), { ...(existing || {}), ...u });
        }
      }
      knownUsers = Array.from(map.values());
      store.set('known_users', knownUsers);
    }
  } catch (e) {
    console.error('[get-known-users] DB lookup error:', e);
  }

  if (knownUsers.length === 0) {
    knownUsers = [
      { id: 'default', role: 'reception' },
      { id: 'admin', role: 'reception' }
    ];
    store.set('known_users', knownUsers);
  }
  return knownUsers;
});

ipcMain.handle('add-known-user', (_, userId: string, role: string, doctorId?: string, allowedTabs?: string[]) => {
  const activeUser = (store.get('current_user') as string || '').toLowerCase();
  if (activeUser && activeUser !== 'admin' && activeUser !== 'default') {
    return { success: false, error: 'Unauthorized: Only the "admin" profile can add users.' };
  }

  if (workstationMode === 'client') return clientRequest('add-known-user', userId, role, doctorId, allowedTabs);

  const cleanId = userId.trim().toLowerCase();
  if (!cleanId) return { success: false, error: 'User ID cannot be empty' };
  
  const knownUsers = store.get('known_users') as { id: string, role: string, doctorId?: string, allowedTabs?: string[] }[] || [];
  if (knownUsers.some(u => u.id === cleanId)) {
    return { success: false, error: 'User ID already exists' };
  }
  
  const newUser = { id: cleanId, role: role || 'reception', doctorId: doctorId || undefined, allowedTabs, createdAt: new Date().toISOString() };
  knownUsers.push(newUser);
  store.set('known_users', knownUsers);
  try {
    database.saveUser(newUser);
  } catch (e) {
    console.error('[add-known-user] DB save error:', e);
  }
  return { success: true };
});

ipcMain.handle('delete-known-user', (_, userId: string) => {
  const activeUser = (store.get('current_user') as string || '').toLowerCase();
  if (activeUser && activeUser !== 'admin' && activeUser !== 'default') {
    return { success: false, error: 'Unauthorized: Only the "admin" profile can delete users.' };
  }

  if (workstationMode === 'client') return clientRequest('delete-known-user', userId);

  const cleanId = userId.trim().toLowerCase();
  if (cleanId === 'default' || cleanId === 'admin') {
    return { success: false, error: 'Cannot delete the default/admin profile' };
  }
  
  let knownUsers = store.get('known_users') as { id: string, role: string, doctorId?: string }[] || [];
  knownUsers = knownUsers.filter(u => u.id !== cleanId);
  store.set('known_users', knownUsers);
  try {
    database.deleteUser(cleanId);
  } catch (e) {
    console.error('[delete-known-user] DB delete error:', e);
  }
  
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

  const user = knownUsers.find(u => u.id === cleanId);
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
      try {
        database.setUserPassword(cleanId, user.password);
      } catch (e) {}
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
  const idx = knownUsers.findIndex(u => u.id === cleanId);
  if (idx !== -1) {
    const hashPassword = (pwd: string) => crypto.createHash('sha256').update(pwd + PASSWORD_SALT).digest('hex');
    const pwdHash = password ? hashPassword(password) : '';
    knownUsers[idx].password = pwdHash;
    store.set('known_users', knownUsers);
    try {
      database.setUserPassword(cleanId, pwdHash);
    } catch (e) {
      console.error('[set-user-password] DB error:', e);
    }
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
    try {
      database.setUserPassword('admin', '');
    } catch (e) {
      console.error('[reset-admin-password] DB error:', e);
    }
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

// Open external URL handler
ipcMain.handle('open-external', (_, url: string) => {
  if (url && (url.startsWith('https://') || url.startsWith('http://') || url.startsWith('mailto:'))) {
    return shell.openExternal(url);
  }
});

let tvDisplayWindow: BrowserWindow | null = null;
ipcMain.handle('open-tv-display', async () => {
  if (tvDisplayWindow && !tvDisplayWindow.isDestroyed()) {
    tvDisplayWindow.show();
    tvDisplayWindow.focus();
    return { success: true };
  }

  tvDisplayWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    title: 'Buvora OPD Queue - 1080p TV Display',
    icon: path.join(process.env.VITE_PUBLIC || RENDERER_DIST, 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  });

  if (VITE_DEV_SERVER_URL) {
    tvDisplayWindow.loadURL(`${VITE_DEV_SERVER_URL}?mode=tv-display`);
  } else {
    tvDisplayWindow.loadFile(path.join(RENDERER_DIST, 'index.html'), { query: { mode: 'tv-display' } });
  }

  tvDisplayWindow.on('closed', () => {
    tvDisplayWindow = null;
  });

  return { success: true };
});

app.whenReady().then(() => {
  createWindow()
  
  // Register permanent state broadcast listener for WhatsApp bot updates
  whatsappBot.addStateListener((state) => {
    if (win) win.webContents.send('whatsapp-state-update', state);
  });

  // Auto-connect WhatsApp bot if a previously authenticated session exists
  if (workstationMode !== 'client' && whatsappBot.hasSavedSession()) {
    console.log('[Main] Found saved WhatsApp session credentials. Auto-connecting WhatsApp bot...');
    whatsappBot.start().catch(err => {
      console.error('[Main] Auto-start WhatsApp bot error:', err);
    });
  }

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
