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
    { id: string; role: string; doctorId?: string }[]
  >;
  addKnownUser(
    userId: string,
    role: string,
    doctorId?: string
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
  getCurrentUser(): Promise<string>;
  getCurrentUserRole(): Promise<string>;
  getCurrentUserDoctorId(): Promise<string>;
  disconnectUser(): Promise<boolean>;
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

declare global {
  interface Window {
    database: DatabaseBridge;
    licensing: LicensingBridge;
    users: UsersBridge;
    connection: ConnectionBridge;
    whatsappBot: WhatsAppBotBridge;
    excelStorage?: ExcelStorageBridge;
    ipcRenderer: IpcRendererBridge;
  }
}

export {};
