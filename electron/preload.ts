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
  deactivate: () => ipcRenderer.invoke('deactivate-license'),
})



contextBridge.exposeInMainWorld('database', {
  getDoctors: () => ipcRenderer.invoke('db-get-doctors'),
  saveDoctor: (doctor: any) => ipcRenderer.invoke('db-save-doctor', doctor),
  deleteDoctor: (id: string) => ipcRenderer.invoke('db-delete-doctor', id),
  getServices: () => ipcRenderer.invoke('db-get-services'),
  saveService: (service: any) => ipcRenderer.invoke('db-save-service', service),
  deleteService: (id: string) => ipcRenderer.invoke('db-delete-service', id),
  getReceipts: (options?: any) => ipcRenderer.invoke('db-get-receipts', options),
  getDashboardMetrics: () => ipcRenderer.invoke('db-get-dashboard-metrics'),
  saveReceipt: (receipt: any) => ipcRenderer.invoke('db-save-receipt', receipt),
  saveReceiptAtomic: (receipt: any, metaKey: string, nextNum: string) => ipcRenderer.invoke('db-save-receipt-atomic', receipt, metaKey, nextNum),
  updateReceipt: (receipt: any) => ipcRenderer.invoke('db-update-receipt', receipt),
  deleteReceipt: (id: string) => ipcRenderer.invoke('db-delete-receipt', id),
  getMetadata: (key: string) => ipcRenderer.invoke('db-get-metadata', key),
  setMetadata: (key: string, value: string) => ipcRenderer.invoke('db-set-metadata', key, value),
  batchImportDoctors: (doctors: any[]) => ipcRenderer.invoke('db-batch-import-doctors', doctors),
  openFolder: () => ipcRenderer.invoke('open-db-folder'),
  getPrescriptions: () => ipcRenderer.invoke('db-get-prescriptions'),
  savePrescription: (prescription: any) => ipcRenderer.invoke('db-save-prescription', prescription),
  deletePrescription: (id: string) => ipcRenderer.invoke('db-delete-prescription', id),
  getAppointments: () => ipcRenderer.invoke('db-get-appointments'),
  saveAppointment: (appointment: any) => ipcRenderer.invoke('db-save-appointment', appointment),
  updateAppointmentStatus: (id: string, status: string, rejectionReason?: string) => ipcRenderer.invoke('db-update-appointment-status', id, status, rejectionReason),
  deleteAppointment: (id: string) => ipcRenderer.invoke('db-delete-appointment', id),
  getFollowUps: (options?: any) => ipcRenderer.invoke('db-get-follow-ups', options),
  saveFollowUp: (followUp: any) => ipcRenderer.invoke('db-save-follow-up', followUp),
  updateFollowUpStatus: (id: string, status: string) => ipcRenderer.invoke('db-update-follow-up-status', id, status),
  deleteFollowUp: (id: string) => ipcRenderer.invoke('db-delete-follow-up', id),
  getExpenses: (options?: any) => ipcRenderer.invoke('db-get-expenses', options),
  saveExpense: (expense: any) => ipcRenderer.invoke('db-save-expense', expense),
  deleteExpense: (id: string) => ipcRenderer.invoke('db-delete-expense', id),
  getMedicines: (search?: string, category?: string) => ipcRenderer.invoke('db-get-medicines', search, category),
  saveMedicine: (medicine: any) => ipcRenderer.invoke('db-save-medicine', medicine),
  deleteMedicine: (id: string) => ipcRenderer.invoke('db-delete-medicine', id),
  getMedicineBatches: (medicineId?: string) => ipcRenderer.invoke('db-get-medicine-batches', medicineId),
  saveMedicineBatch: (batch: any) => ipcRenderer.invoke('db-save-medicine-batch', batch),
  deleteMedicineBatch: (id: string) => ipcRenderer.invoke('db-delete-medicine-batch', id),
  adjustMedicineStock: (batchId: string, quantityDiff: number) => ipcRenderer.invoke('db-adjust-medicine-stock', batchId, quantityDiff),
  getPharmacySales: (options?: any) => ipcRenderer.invoke('db-get-pharmacy-sales', options),
  savePharmacySale: (sale: any) => ipcRenderer.invoke('db-save-pharmacy-sale', sale),
  deletePharmacySale: (id: string) => ipcRenderer.invoke('db-delete-pharmacy-sale', id),
  getPharmacyMetrics: () => ipcRenderer.invoke('db-get-pharmacy-metrics'),
  getWards: () => ipcRenderer.invoke('db-get-wards'),
  saveWard: (ward: any) => ipcRenderer.invoke('db-save-ward', ward),
  deleteWard: (id: string) => ipcRenderer.invoke('db-delete-ward', id),
  getBeds: (wardId?: string) => ipcRenderer.invoke('db-get-beds', wardId),
  saveBed: (bed: any) => ipcRenderer.invoke('db-save-bed', bed),
  deleteBed: (id: string) => ipcRenderer.invoke('db-delete-bed', id),
  updateBedStatus: (bedId: string, status: string) => ipcRenderer.invoke('db-update-bed-status', bedId, status),
  getBedAdmissions: (options?: any) => ipcRenderer.invoke('db-get-bed-admissions', options),
  admitPatientToBed: (data: any) => ipcRenderer.invoke('db-admit-patient-to-bed', data),
  transferPatientBed: (admissionId: string, newBedId: string, reason?: string) => ipcRenderer.invoke('db-transfer-patient-bed', admissionId, newBedId, reason),
  updateAdmissionBillingStatus: (admissionId: string, billingStatus: string, notes?: string) => ipcRenderer.invoke('db-update-admission-billing-status', admissionId, billingStatus, notes),
  dischargePatientAdmission: (admissionId: string, data?: any) => ipcRenderer.invoke('db-discharge-patient-admission', admissionId, data),
  addAdmissionVital: (admissionId: string, vital: any) => ipcRenderer.invoke('db-add-admission-vital', admissionId, vital),
  addAdmissionCharge: (admissionId: string, charge: any) => ipcRenderer.invoke('db-add-admission-charge', admissionId, charge),
  deleteAdmissionCharge: (admissionId: string, chargeId: string) => ipcRenderer.invoke('db-delete-admission-charge', admissionId, chargeId),
  getIpdDashboardMetrics: () => ipcRenderer.invoke('db-get-ipd-dashboard-metrics'),
  getLabTests: (category?: string) => ipcRenderer.invoke('db-get-lab-tests', category),
  saveLabTest: (test: any) => ipcRenderer.invoke('db-save-lab-test', test),
  deleteLabTest: (id: string) => ipcRenderer.invoke('db-delete-lab-test', id),
  getNextLabOrderNumber: () => ipcRenderer.invoke('db-get-next-lab-order-number'),
  getLabOrders: () => ipcRenderer.invoke('db-get-lab-orders'),
  getLabOrderById: (id: string) => ipcRenderer.invoke('db-get-lab-order-by-id', id),
  saveLabOrder: (order: any) => ipcRenderer.invoke('db-save-lab-order', order),
  updateLabOrderStatus: (id: string, status: string, details?: any) => ipcRenderer.invoke('db-update-lab-order-status', id, status, details),
  saveLabOrderResults: (id: string, testsWithResults: any[], pathologistRemarks?: string) => ipcRenderer.invoke('db-save-lab-order-results', id, testsWithResults, pathologistRemarks),
  deleteLabOrder: (id: string) => ipcRenderer.invoke('db-delete-lab-order', id),
  getLabDashboardMetrics: () => ipcRenderer.invoke('db-get-lab-dashboard-metrics'),
})

contextBridge.exposeInMainWorld('whatsappBot', {
  start: () => ipcRenderer.invoke('whatsapp-start'),
  stop: () => ipcRenderer.invoke('whatsapp-stop'),
  getStatus: () => ipcRenderer.invoke('whatsapp-get-status'),
  toggleAutoReply: (enabled: boolean) => ipcRenderer.invoke('whatsapp-toggle-autoreply', enabled),
  sendMessage: (phone: string, message: string) => ipcRenderer.invoke('whatsapp-send-message', phone, message),
  sharePrescriptionPdf: (phone: string, rxData: any) => ipcRenderer.invoke('whatsapp-share-prescription-pdf', phone, rxData),
  getSchedule: () => ipcRenderer.invoke('whatsapp-get-schedule'),
  saveSchedule: (schedule: any) => ipcRenderer.invoke('whatsapp-save-schedule', schedule),
  onStatusChange: (callback: (state: any) => void) => {
    const subscription = (_event: any, state: any) => callback(state);
    ipcRenderer.on('whatsapp-state-update', subscription);
    return () => {
      ipcRenderer.removeListener('whatsapp-state-update', subscription);
    };
  }
})

contextBridge.exposeInMainWorld('users', {
  getKnownUsers: () => ipcRenderer.invoke('get-known-users'),
  addKnownUser: (userId: string, role: string, doctorId?: string, allowedTabs?: string[]) => ipcRenderer.invoke('add-known-user', userId, role, doctorId, allowedTabs),
  deleteKnownUser: (userId: string) => ipcRenderer.invoke('delete-known-user', userId),
  connectUser: (userId: string, password?: string) => ipcRenderer.invoke('connect-user', userId, password),
  setUserPassword: (userId: string, password?: string) => ipcRenderer.invoke('set-user-password', userId, password),
  getCurrentUser: () => ipcRenderer.invoke('get-current-user'),
  getCurrentUserRole: () => ipcRenderer.invoke('get-current-user-role'),
  getCurrentUserDoctorId: () => ipcRenderer.invoke('get-current-user-doctor-id'),
  getCurrentUserTabs: () => ipcRenderer.invoke('get-current-user-tabs'),
  updateUserTabs: (userId: string, tabs: string[]) => ipcRenderer.invoke('update-user-tabs', userId, tabs),
  disconnectUser: () => ipcRenderer.invoke('disconnect-user'),
  resetAdminPassword: () => ipcRenderer.invoke('reset-admin-password'),
})

contextBridge.exposeInMainWorld('connection', {
  getSettings: () => ipcRenderer.invoke('get-connection-settings'),
  saveSettings: (settings: any) => ipcRenderer.invoke('save-connection-settings', settings),
  getServerStatus: () => ipcRenderer.invoke('get-server-status'),
  testConnection: (hostIp: string, hostPort: number, secret?: string) => ipcRenderer.invoke('test-connection', hostIp, hostPort, secret),
  saveClientSecret: (secret: string) => ipcRenderer.invoke('save-client-secret', secret),
})

contextBridge.exposeInMainWorld('system', {
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
})

