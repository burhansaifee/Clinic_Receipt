import { app, BrowserWindow, ipcMain } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createRequire } from 'node:module'
import Store from 'electron-store'
import crypto from 'node:crypto'
import { excelStorage } from './excelStorage'
import { database } from './database'
import { shell } from 'electron'
import pkg from 'electron-updater'
const { autoUpdater } = pkg

const require = createRequire(import.meta.url)
const { machineIdSync } = require('node-machine-id')
const Database = require('better-sqlite3')

// Initialize Database
database.init(Database)

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const store = new Store()
const SECRET_SALT = 'MEDFLOW-OFFLINE-LICENSE-2024-X99'

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
ipcMain.handle('save-to-excel', (_, data) => {
  return excelStorage.saveData(data)
})

ipcMain.handle('load-from-excel', () => {
  return excelStorage.loadData()
})

ipcMain.handle('open-excel-file', () => {
  shell.openPath(excelStorage.getExcelPath())
})

// SQLite Database IPCs
ipcMain.handle('db-get-doctors', () => database.getDoctors())
ipcMain.handle('db-save-doctor', (_, doctor) => database.saveDoctor(doctor))
ipcMain.handle('db-delete-doctor', (_, id) => database.deleteDoctor(id))

ipcMain.handle('db-get-services', () => database.getServices())
ipcMain.handle('db-save-service', (_, service) => database.saveService(service))
ipcMain.handle('db-delete-service', (_, id) => database.deleteService(id))

ipcMain.handle('db-get-receipts', () => database.getReceipts())
ipcMain.handle('db-save-receipt', (_, receipt) => database.saveReceipt(receipt))
ipcMain.handle('db-update-receipt', (_, receipt) => database.updateReceipt(receipt))
ipcMain.handle('db-delete-receipt', (_, id) => database.deleteReceipt(id))

ipcMain.handle('db-get-metadata', (_, key) => database.getMetadata(key))
ipcMain.handle('db-set-metadata', (_, key, value) => database.setMetadata(key, value))

ipcMain.handle('db-batch-import-doctors', (_, doctors) => database.batchImportDoctors(doctors))

ipcMain.handle('open-db-folder', () => {
  shell.showItemInFolder(database.getDbPath())
})


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

