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
  addEmarOrder: (admissionId: string, order: any) => ipcRenderer.invoke('db-add-emar-order', admissionId, order),
  updateEmarOrderStatus: (admissionId: string, orderId: string, status: string) => ipcRenderer.invoke('db-update-emar-order-status', admissionId, orderId, status),
  recordEmarAdministration: (admissionId: string, record: any) => ipcRenderer.invoke('db-record-emar-administration', admissionId, record),
  addFluidIoEntry: (admissionId: string, entry: any) => ipcRenderer.invoke('db-add-fluid-io-entry', admissionId, entry),
  deleteFluidIoEntry: (admissionId: string, entryId: string) => ipcRenderer.invoke('db-delete-fluid-io-entry', admissionId, entryId),
  addNursingShiftNote: (admissionId: string, note: any) => ipcRenderer.invoke('db-add-nursing-shift-note', admissionId, note),
  deleteNursingShiftNote: (admissionId: string, noteId: string) => ipcRenderer.invoke('db-delete-nursing-shift-note', admissionId, noteId),
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
  getTpaProviders: () => ipcRenderer.invoke('db-get-tpa-providers'),
  saveTpaProvider: (provider: any) => ipcRenderer.invoke('db-save-tpa-provider', provider),
  deleteTpaProvider: (id: string) => ipcRenderer.invoke('db-delete-tpa-provider', id),
  getInsuranceClaims: (options?: any) => ipcRenderer.invoke('db-get-insurance-claims', options),
  getInsuranceClaimById: (id: string) => ipcRenderer.invoke('db-get-insurance-claim-by-id', id),
  saveInsuranceClaim: (claim: any) => ipcRenderer.invoke('db-save-insurance-claim', claim),
  updateClaimStatus: (id: string, status: string, notes?: string) => ipcRenderer.invoke('db-update-claim-status', id, status, notes),
  addClaimQuery: (claimId: string, query: any) => ipcRenderer.invoke('db-add-claim-query', claimId, query),
  getInsuranceDashboardMetrics: () => ipcRenderer.invoke('db-get-insurance-dashboard-metrics'),
  saveDischargeSummary: (admissionId: string, summary: any) => ipcRenderer.invoke('db-save-discharge-summary', admissionId, summary),
  getDischargeSummary: (admissionId: string) => ipcRenderer.invoke('db-get-discharge-summary', admissionId),
  getOperationTheatres: () => ipcRenderer.invoke('db-get-operation-theatres'),
  saveOperationTheatre: (theatre: any) => ipcRenderer.invoke('db-save-operation-theatre', theatre),
  deleteOperationTheatre: (id: string) => ipcRenderer.invoke('db-delete-operation-theatre', id),
  getSurgicalCases: (options?: any) => ipcRenderer.invoke('db-get-surgical-cases', options),
  getSurgicalCaseById: (id: string) => ipcRenderer.invoke('db-get-surgical-case-by-id', id),
  saveSurgicalCase: (sc: any) => ipcRenderer.invoke('db-save-surgical-case', sc),
  updateSurgicalCaseStatus: (id: string, status: string, notes?: string) => ipcRenderer.invoke('db-update-surgical-case-status', id, status, notes),
  getOtDashboardMetrics: () => ipcRenderer.invoke('db-get-ot-dashboard-metrics'),
  getEmergencyVisits: (options?: any) => ipcRenderer.invoke('db-get-emergency-visits', options),
  getEmergencyVisitById: (id: string) => ipcRenderer.invoke('db-get-emergency-visit-by-id', id),
  saveEmergencyVisit: (visit: any) => ipcRenderer.invoke('db-save-emergency-visit', visit),
  updateEmergencyDisposition: (id: string, disposition: string, details?: any) => ipcRenderer.invoke('db-update-emergency-disposition', id, disposition, details),
  getMlcRecords: () => ipcRenderer.invoke('db-get-mlc-records'),
  getMlcRecordById: (id: string) => ipcRenderer.invoke('db-get-mlc-record-by-id', id),
  saveMlcRecord: (mlc: any) => ipcRenderer.invoke('db-save-mlc-record', mlc),
  getEmergencyDashboardMetrics: () => ipcRenderer.invoke('db-get-emergency-dashboard-metrics'),
  getDoctorCommissionRules: () => ipcRenderer.invoke('db-get-doctor-commission-rules'),
  getDoctorCommissionRuleByDoctorId: (doctorId: string) => ipcRenderer.invoke('db-get-doctor-commission-rule-by-doctor-id', doctorId),
  saveDoctorCommissionRule: (rule: any) => ipcRenderer.invoke('db-save-doctor-commission-rule', rule),
  calculateDoctorAccruedEarnings: (doctorId: string, startDate?: string, endDate?: string) => ipcRenderer.invoke('db-calculate-doctor-accrued-earnings', doctorId, startDate, endDate),
  getDoctorPayoutTransactions: (doctorId?: string) => ipcRenderer.invoke('db-get-doctor-payout-transactions', doctorId),
  saveDoctorPayoutTransaction: (payout: any) => ipcRenderer.invoke('db-save-doctor-payout-transaction', payout),
  getHospitalIndents: (filter?: any) => ipcRenderer.invoke('db-get-hospital-indents', filter),
  getHospitalIndentById: (id: string) => ipcRenderer.invoke('db-get-hospital-indent-by-id', id),
  saveHospitalIndent: (indent: any, items: any[]) => ipcRenderer.invoke('db-save-hospital-indent', indent, items),
  issueHospitalIndent: (indentId: string, itemsIssued: any[], fulfilledBy: string) => ipcRenderer.invoke('db-issue-hospital-indent', indentId, itemsIssued, fulfilledBy),
  completeHospitalIndent: (indentId: string, fulfilledBy?: string) => ipcRenderer.invoke('db-complete-hospital-indent', indentId, fulfilledBy),
  cancelHospitalIndent: (indentId: string, reason?: string) => ipcRenderer.invoke('db-cancel-hospital-indent', indentId, reason),
  getHospitalTier3Metrics: () => ipcRenderer.invoke('db-get-hospital-tier3-metrics'),
  searchGlobalPatients: (query: string) => ipcRenderer.invoke('db-search-global-patients', query),
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
  openTvDisplay: () => ipcRenderer.invoke('open-tv-display'),
})

