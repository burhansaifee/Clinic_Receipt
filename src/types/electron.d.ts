/**
 * Type declarations for Electron context-bridge APIs
 * exposed via preload.ts. Replaces all @ts-ignore usage.
 */

import type {
  Doctor,
  Service,
  Receipt,
  Prescription,
  Appointment,
  AppointmentStatus,
  FollowUp,
  FollowUpStatus,
  Expense,
  Medicine,
  MedicineBatch,
  PharmacySale,
  PharmacyDashboardMetrics,
  Ward,
  HospitalBed,
  BedAdmission,
  AdmissionVital,
  IpdDashboardMetrics,
  LabTest,
  LabTestParameter,
  LabParameterResult,
  LabOrderItem,
  LabOrder,
  LabDashboardMetrics,
} from '../lib/storage';

interface DatabaseBridge {
  getDoctors(): Promise<Doctor[]>;
  saveDoctor(doctor: Doctor): Promise<void>;
  deleteDoctor(id: string): Promise<void>;
  getServices(): Promise<Service[]>;
  saveService(service: Service): Promise<void>;
  deleteService(id: string): Promise<void>;
  getReceipts(options?: { limit?: number; offset?: number; search?: string; startDate?: string; endDate?: string }): Promise<Receipt[]>;
  getDashboardMetrics(): Promise<{ totalReceipts: number; totalRevenue: number; avgPerReceipt: number }>;
  saveReceipt(receipt: Receipt): Promise<void>;
  saveReceiptAtomic(receipt: Receipt, metaKey: string, nextNum: string): Promise<void>;
  updateReceipt(receipt: Receipt): Promise<void>;
  deleteReceipt(id: string): Promise<void>;
  getMetadata(key: string): Promise<{ value: string } | null>;
  setMetadata(key: string, value: string): Promise<void>;
  batchImportDoctors(doctors: Doctor[]): Promise<void>;
  openFolder(): Promise<void>;
  getPrescriptions(): Promise<Prescription[]>;
  savePrescription(prescription: Prescription): Promise<void>;
  deletePrescription(id: string): Promise<void>;
  getAppointments(): Promise<Appointment[]>;
  saveAppointment(appointment: Appointment): Promise<void>;
  updateAppointmentStatus(
    id: string,
    status: AppointmentStatus,
    rejectionReason?: string
  ): Promise<void>;
  deleteAppointment(id: string): Promise<void>;
  getFollowUps(options?: { limit?: number; offset?: number; search?: string; startDate?: string; endDate?: string; doctorId?: string; status?: string }): Promise<FollowUp[]>;
  saveFollowUp(followUp: FollowUp): Promise<void>;
  updateFollowUpStatus(id: string, status: FollowUpStatus): Promise<void>;
  deleteFollowUp(id: string): Promise<void>;
  getExpenses(options?: { limit?: number; offset?: number; search?: string; category?: string; startDate?: string; endDate?: string }): Promise<Expense[]>;
  saveExpense(expense: Expense): Promise<Expense>;
  deleteExpense(id: string): Promise<void>;
  getMedicines(search?: string, category?: string): Promise<Medicine[]>;
  saveMedicine(medicine: Medicine): Promise<Medicine>;
  deleteMedicine(id: string): Promise<void>;
  getMedicineBatches(medicineId?: string): Promise<MedicineBatch[]>;
  saveMedicineBatch(batch: MedicineBatch): Promise<MedicineBatch>;
  deleteMedicineBatch(id: string): Promise<void>;
  adjustMedicineStock(batchId: string, quantityDiff: number): Promise<void>;
  getPharmacySales(options?: { limit?: number; offset?: number; search?: string; startDate?: string; endDate?: string }): Promise<PharmacySale[]>;
  savePharmacySale(sale: PharmacySale): Promise<PharmacySale>;
  deletePharmacySale(id: string): Promise<void>;
  getPharmacyMetrics(): Promise<PharmacyDashboardMetrics>;
  getWards(): Promise<Ward[]>;
  saveWard(ward: Partial<Ward>): Promise<Ward>;
  deleteWard(id: string): Promise<void>;
  getBeds(wardId?: string): Promise<HospitalBed[]>;
  saveBed(bed: Partial<HospitalBed>): Promise<HospitalBed>;
  deleteBed(id: string): Promise<void>;
  updateBedStatus(bedId: string, status: string): Promise<void>;
  getBedAdmissions(options?: { status?: string; billingStatus?: string; patientId?: string; limit?: number }): Promise<BedAdmission[]>;
  admitPatientToBed(data: any): Promise<BedAdmission>;
  transferPatientBed(admissionId: string, newBedId: string, reason?: string): Promise<any>;
  updateAdmissionBillingStatus(admissionId: string, billingStatus: string, notes?: string): Promise<any>;
  dischargePatientAdmission(admissionId: string, data?: any): Promise<any>;
  addAdmissionVital(admissionId: string, vital: any): Promise<any>;
  addAdmissionCharge(admissionId: string, charge: any): Promise<any>;
  deleteAdmissionCharge(admissionId: string, chargeId: string): Promise<any>;
  getIpdDashboardMetrics(): Promise<IpdDashboardMetrics>;
  getLabTests(category?: string): Promise<LabTest[]>;
  saveLabTest(test: Partial<LabTest>): Promise<{ success: boolean; id: string }>;
  deleteLabTest(id: string): Promise<{ success: boolean }>;
  getNextLabOrderNumber(): Promise<string>;
  getLabOrders(): Promise<LabOrder[]>;
  getLabOrderById(id: string): Promise<LabOrder | null>;
  saveLabOrder(order: Partial<LabOrder>): Promise<{ success: boolean; id: string; orderNumber: string }>;
  updateLabOrderStatus(id: string, status: string, details?: any): Promise<{ success: boolean }>;
  saveLabOrderResults(id: string, testsWithResults: any[], pathologistRemarks?: string): Promise<{ success: boolean; status: string }>;
  deleteLabOrder(id: string): Promise<{ success: boolean }>;
  getLabDashboardMetrics(): Promise<LabDashboardMetrics>;
}

interface LicensingBridge {
  getMachineID(): Promise<string>;
  checkActivation(): Promise<{
    status: 'NOT_ACTIVATED' | 'ACTIVATED' | 'EXPIRED' | 'TAMPERED' | 'INVALID';
    daysLeft?: number;
    expiryDate?: string;
    message?: string;
  }>;
  activateLicense(key: string): Promise<{ success: boolean; message?: string }>;
  deactivate(): Promise<{ success: boolean }>;
}

interface UsersBridge {
  getKnownUsers(): Promise<
    { id: string; role: string; doctorId?: string; allowedTabs?: string[] }[]
  >;
  addKnownUser(
    userId: string,
    role: string,
    doctorId?: string,
    allowedTabs?: string[]
  ): Promise<{ success: boolean; error?: string }>;
  deleteKnownUser(
    userId: string
  ): Promise<{ success: boolean; error?: string }>;
  connectUser(
    userId: string,
    password?: string
  ): Promise<{
    success: boolean;
    error?: string;
    role?: string;
    doctorId?: string;
    requirePasswordSetup?: boolean;
    requirePasswordInput?: boolean;
  }>;
  setUserPassword(
    userId: string,
    password?: string
  ): Promise<{ success: boolean; error?: string }>;
  getCurrentUser(): Promise<string | null>;
  getCurrentUserRole(): Promise<string>;
  getCurrentUserDoctorId(): Promise<string | null>;
  getCurrentUserTabs(): Promise<string[] | null>;
  updateUserTabs(userId: string, tabs: string[]): Promise<{ success: boolean; error?: string }>;
  disconnectUser(): Promise<void>;
  resetAdminPassword(): Promise<{ success: boolean; message?: string; error?: string }>;
}

interface ConnectionBridge {
  getSettings(): Promise<{
    mode: 'standalone' | 'host' | 'client';
    hostIp: string;
    hostPort: number;
    localIp: string;
    networkSecret: string;
  }>;
  saveSettings(settings: {
    mode: 'standalone' | 'host' | 'client';
    hostIp: string;
    hostPort: number;
    networkSecret?: string;
  }): Promise<{ success: boolean }>;
  getServerStatus(): Promise<{
    status: string;
    localIp?: string;
    port?: number;
    hostIp?: string;
  }>;
  testConnection(
    hostIp: string,
    hostPort: number,
    secret?: string
  ): Promise<{ success: boolean; error?: string }>;
  saveClientSecret(
    secret: string
  ): Promise<{ success: boolean; error?: string }>;
}

interface WhatsAppBotBridge {
  start(): Promise<{ status: string; qrCodeDataUrl?: string }>;
  stop(): Promise<{ status: string }>;
  getStatus(): Promise<{ status: string; qrCodeDataUrl?: string }>;
  toggleAutoReply(enabled: boolean): Promise<void>;
  sendMessage(phone: string, message: string): Promise<void>;
  sharePrescriptionPdf(phone: string, rxData: any): Promise<{ success: boolean; message?: string; error?: string }>;
  getSchedule(): Promise<{
    allowedDays: string[];
    timeSlots: string[];
  }>;
  saveSchedule(schedule: {
    allowedDays: string[];
    timeSlots: string[];
  }): Promise<{ success: boolean }>;
  onStatusChange(callback: (state: { status: string; qrCodeDataUrl?: string }) => void): () => void;
}

interface ExcelStorageBridge {
  saveData(data: unknown): Promise<void>;
  loadData(): Promise<unknown>;
  openFile(): Promise<void>;
}

interface IpcRendererBridge {
  on(channel: string, listener: (event: unknown, ...args: unknown[]) => void): void;
  off(channel: string, listener: (...args: unknown[]) => void): void;
  send(channel: string, ...args: unknown[]): void;
  invoke(channel: string, ...args: unknown[]): Promise<unknown>;
}

interface SystemBridge {
  openExternal(url: string): Promise<void>;
}

declare global {
  interface Window {
    database: DatabaseBridge;
    licensing: LicensingBridge;
    users: UsersBridge;
    connection: ConnectionBridge;
    whatsappBot: WhatsAppBotBridge;
    callBot?: any;
    system?: SystemBridge;
    excelStorage?: ExcelStorageBridge;
    ipcRenderer: IpcRendererBridge;
  }
}

export {};
