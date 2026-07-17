import { ipcRenderer, contextBridge } from 'electron'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },

  // You can expose other apts you need here.
  // ...
})

contextBridge.exposeInMainWorld('licensing', {
  getMachineID: () => ipcRenderer.invoke('get-machine-id'),
  checkActivation: () => ipcRenderer.invoke('check-activation'),
  activateLicense: (key: string) => ipcRenderer.invoke('activate-license', key),
  devGenerateKey: (mid: string) => ipcRenderer.invoke('dev-generate-key', mid),
})

contextBridge.exposeInMainWorld('excelStorage', {
  saveData: (data: any) => ipcRenderer.invoke('save-to-excel', data),
  loadData: () => ipcRenderer.invoke('load-from-excel'),
  openFile: () => ipcRenderer.invoke('open-excel-file'),
})

contextBridge.exposeInMainWorld('database', {
  getDoctors: () => ipcRenderer.invoke('db-get-doctors'),
  saveDoctor: (doctor: any) => ipcRenderer.invoke('db-save-doctor', doctor),
  deleteDoctor: (id: string) => ipcRenderer.invoke('db-delete-doctor', id),
  getServices: () => ipcRenderer.invoke('db-get-services'),
  saveService: (service: any) => ipcRenderer.invoke('db-save-service', service),
  deleteService: (id: string) => ipcRenderer.invoke('db-delete-service', id),
  getReceipts: () => ipcRenderer.invoke('db-get-receipts'),
  saveReceipt: (receipt: any) => ipcRenderer.invoke('db-save-receipt', receipt),
  updateReceipt: (receipt: any) => ipcRenderer.invoke('db-update-receipt', receipt),
  deleteReceipt: (id: string) => ipcRenderer.invoke('db-delete-receipt', id),
  getMetadata: (key: string) => ipcRenderer.invoke('db-get-metadata', key),
  setMetadata: (key: string, value: string) => ipcRenderer.invoke('db-set-metadata', key, value),
  batchImportDoctors: (doctors: any[]) => ipcRenderer.invoke('db-batch-import-doctors', doctors),
  openFolder: () => ipcRenderer.invoke('open-db-folder'),
  getPrescriptions: () => ipcRenderer.invoke('db-get-prescriptions'),
  savePrescription: (prescription: any) => ipcRenderer.invoke('db-save-prescription', prescription),
  deletePrescription: (id: string) => ipcRenderer.invoke('db-delete-prescription', id),
})

contextBridge.exposeInMainWorld('users', {
  getKnownUsers: () => ipcRenderer.invoke('get-known-users'),
  addKnownUser: (userId: string, role: string, doctorId?: string) => ipcRenderer.invoke('add-known-user', userId, role, doctorId),
  deleteKnownUser: (userId: string) => ipcRenderer.invoke('delete-known-user', userId),
  connectUser: (userId: string, password?: string) => ipcRenderer.invoke('connect-user', userId, password),
  setUserPassword: (userId: string, password?: string) => ipcRenderer.invoke('set-user-password', userId, password),
  getCurrentUser: () => ipcRenderer.invoke('get-current-user'),
  getCurrentUserRole: () => ipcRenderer.invoke('get-current-user-role'),
  getCurrentUserDoctorId: () => ipcRenderer.invoke('get-current-user-doctor-id'),
  disconnectUser: () => ipcRenderer.invoke('disconnect-user'),
})

contextBridge.exposeInMainWorld('connection', {
  getSettings: () => ipcRenderer.invoke('get-connection-settings'),
  saveSettings: (settings: any) => ipcRenderer.invoke('save-connection-settings', settings),
  getServerStatus: () => ipcRenderer.invoke('get-server-status'),
  testConnection: (hostIp: string, hostPort: number) => ipcRenderer.invoke('test-connection', hostIp, hostPort),
})

