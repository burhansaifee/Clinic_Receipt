import { format } from 'date-fns';

export interface Doctor {
  id: string;
  name: string;
  specialization: string;
  qualifications: string;
  phone: string;
  address: string;
  printHeader?: boolean;
  customTopMargin?: number;
  customBottomMargin?: number;
  upiId?: string;
  qrCodeText?: string;
  showQrCodeOnReceipt?: boolean;
}

export interface ReceiptItem {
  id: string;
  description: string;
  amount: number;
  category?: string;
  rate?: number;
  quantity?: number;
  unit?: string;
}

export interface Service {
  id: string;
  name: string;
  amount: number;
  category?: string;
  unit?: string;
  serviceType?: 'OPD' | 'FACILITY' | 'ALL';
}

export interface FacilityPreset {
  category: 'Room Rent' | 'Oxygen' | 'Nursing' | 'Doctor Rounds' | 'Equipment' | 'Procedures' | 'Consumables';
  name: string;
  defaultRate: number;
  defaultUnit: string;
}

export const FACILITY_PRESETS: FacilityPreset[] = [
  // Room / Bed
  { category: 'Room Rent', name: 'General Ward Bed', defaultRate: 800, defaultUnit: 'Days' },
  { category: 'Room Rent', name: 'Semi-Private Room', defaultRate: 1500, defaultUnit: 'Days' },
  { category: 'Room Rent', name: 'Deluxe Private Room', defaultRate: 2500, defaultUnit: 'Days' },
  { category: 'Room Rent', name: 'ICU / Critical Care Bed', defaultRate: 4500, defaultUnit: 'Days' },
  { category: 'Room Rent', name: 'Daycare Observation Bed', defaultRate: 600, defaultUnit: 'Hours' },

  // Oxygen
  { category: 'Oxygen', name: 'Medical Oxygen (Hourly)', defaultRate: 150, defaultUnit: 'Hours' },
  { category: 'Oxygen', name: 'Medical Oxygen (24h Flow)', defaultRate: 1200, defaultUnit: 'Days' },
  { category: 'Oxygen', name: 'Oxygen Cylinder Refill', defaultRate: 650, defaultUnit: 'Cylinders' },
  { category: 'Oxygen', name: 'Oxygen Concentrator Usage', defaultRate: 400, defaultUnit: 'Days' },

  // Nursing & Attendant
  { category: 'Nursing', name: 'General Nursing Care (24h)', defaultRate: 500, defaultUnit: 'Days' },
  { category: 'Nursing', name: 'Specialized ICU Nursing', defaultRate: 1000, defaultUnit: 'Days' },
  { category: 'Nursing', name: 'Attendant / DDA Support', defaultRate: 300, defaultUnit: 'Days' },

  // Doctor Rounds
  { category: 'Doctor Rounds', name: 'In-Patient Doctor Daily Round', defaultRate: 600, defaultUnit: 'Visits' },
  { category: 'Doctor Rounds', name: 'Specialist Consultant Visit', defaultRate: 1000, defaultUnit: 'Visits' },
  { category: 'Doctor Rounds', name: 'Emergency RMO Call', defaultRate: 400, defaultUnit: 'Visits' },

  // Equipment & Monitoring
  { category: 'Equipment', name: 'Multipara Vital Monitor', defaultRate: 500, defaultUnit: 'Days' },
  { category: 'Equipment', name: 'Pulse Oximeter & BP Monitor', defaultRate: 200, defaultUnit: 'Days' },
  { category: 'Equipment', name: 'Syringe / Infusion Pump', defaultRate: 350, defaultUnit: 'Days' },
  { category: 'Equipment', name: 'Nebulizer Therapy Session', defaultRate: 150, defaultUnit: 'Sessions' },

  // Procedures & Care
  { category: 'Procedures', name: 'IV Cannulation & Infusion Setup', defaultRate: 250, defaultUnit: 'Procedures' },
  { category: 'Procedures', name: 'Surgical Wound Dressing', defaultRate: 300, defaultUnit: 'Procedures' },
  { category: 'Procedures', name: 'Foley Catheterization', defaultRate: 400, defaultUnit: 'Procedures' },
  { category: 'Procedures', name: 'Ryle Tube Insertion', defaultRate: 450, defaultUnit: 'Procedures' },
  { category: 'Procedures', name: 'ECG Recording & Interpretation', defaultRate: 300, defaultUnit: 'Tests' },
];

export interface Receipt {
  id: string;
  receiptNumber: string;
  date: string;
  patientId?: string;
  patientName: string;
  patientAge: string;
  patientGender: string;
  patientPhone: string;
  doctorId: string;
  doctorName: string;
  items: ReceiptItem[];
  total: number;
  paymentMethod: 'CASH' | 'ONLINE' | 'FREE';
  appointmentId?: string;
  showQrCode?: boolean;
  qrCodeText?: string;
  billType?: 'OPD' | 'FACILITY';
  roomNumber?: string;
  admissionDate?: string;
  dischargeDate?: string;
  advancePaid?: number;
  discount?: number;
}

export interface PrescribedMedicine {
  name: string;
  dosage: string;
  duration: string;
  instructions: string;
}

export interface Prescription {
  id: string;
  receiptId?: string;
  patientId?: string;
  date: string;
  patientName: string;
  patientAge: string;
  patientGender: string;
  patientPhone: string;
  doctorId: string;
  doctorName: string;
  symptoms: string;
  diagnosis: string;
  medicines: PrescribedMedicine[];
  notes: string;
  followUpDate?: string;
  followUpNotes?: string;
}

export type FollowUpStatus = 'PENDING' | 'ATTENDED' | 'MISSED' | 'CANCELLED';

export interface FollowUp {
  id: string;
  prescriptionId?: string;
  receiptId?: string;
  patientId?: string;
  patientName: string;
  patientPhone?: string;
  patientAge?: string;
  patientGender?: string;
  doctorId: string;
  doctorName: string;
  scheduledDate: string; // YYYY-MM-DD
  notes?: string;
  status: FollowUpStatus;
  createdAt: string;
}

export type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';

export interface Appointment {
  id: string;
  patientId?: string;
  patientName: string;
  patientPhone: string;
  patientAge?: string;
  patientGender?: string;
  doctorId: string;
  doctorName: string;
  appointmentDate: string; // YYYY-MM-DD
  appointmentTime: string; // e.g. 10:30 AM
  notes?: string;
  rejectionReason?: string;
  source?: 'WHATSAPP' | 'MANUAL';
  status: AppointmentStatus;
  createdAt: string;
}

export interface PatientHistorySummary {
  receipts: Receipt[];
  prescriptions: Prescription[];
  appointments: Appointment[];
  followUps: FollowUp[];
  totalVisits: number;
  totalSpent: number;
  opdCount: number;
  facilityCount: number;
  prescriptionCount: number;
}

export type ExpenseCategory =
  | 'Utilities & Power'
  | 'Medical Supplies'
  | 'Rent & Premises'
  | 'Equipment'
  | 'Marketing & Software'
  | 'Taxes & Licenses'
  | 'Miscellaneous';

export interface Expense {
  id: string;
  title: string;
  category: ExpenseCategory | string;
  amount: number;
  paidAmount?: number;
  date: string; // YYYY-MM-DD
  dueDate?: string; // YYYY-MM-DD
  paymentMode?: 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE' | 'CARD';
  paidTo?: string;
  vendorPhone?: string;
  billNumber?: string;
  isRecurring?: boolean | number;
  status?: 'PAID' | 'PARTIAL' | 'PENDING';
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type ReceiptPaperType = 'A5' | 'A4' | 'A6' | 'Letter' | 'Thermal80' | 'Thermal58';
export type PrescriptionPaperType = 'A4' | 'A5' | 'Letter' | 'A6';

export interface PrintPaperSettings {
  receiptPaper: ReceiptPaperType;
  prescriptionPaper: PrescriptionPaperType;
}

export interface ClinicProfile {
  clinicName: string;
  clinicPhone?: string;
  clinicAddress?: string;
  clinicUpiId?: string;
  clinicQrText?: string;
  showFacilityQr?: boolean;
}

const STORAGE_KEYS = {
  DOCTORS: 'clinic_doctors',
  SERVICES: 'clinic_services',
  RECEIPTS: 'clinic_receipts',
  LAST_RECEIPT_NUM: 'clinic_last_receipt_num',
  LAST_FREE_RECEIPT_NUM: 'clinic_last_free_receipt_num',
  SQLITE_MIGRATED: 'clinic_sqlite_migrated',
  RECEIPT_PAPER: 'clinic_receipt_paper_type',
  PRESCRIPTION_PAPER: 'clinic_prescription_paper_type',
  CLINIC_NAME: 'clinic_profile_name',
  CLINIC_PHONE: 'clinic_profile_phone',
  CLINIC_ADDRESS: 'clinic_profile_address',
  CLINIC_UPI_ID: 'clinic_profile_upi_id',
  CLINIC_QR_TEXT: 'clinic_profile_qr_text',
  CLINIC_FACILITY_SHOW_QR: 'clinic_facility_show_qr',
};

export const storage = {
  // Migration logic
  migrateToSQLite: async () => {
    if (localStorage.getItem(STORAGE_KEYS.SQLITE_MIGRATED) === 'true') {
      console.log('Already migrated to SQLite');
      return;
    }

    console.log('Starting Migration to SQLite...');
    
    try {
      // Get data from localStorage
      const doctorsStr = localStorage.getItem(STORAGE_KEYS.DOCTORS);
      const servicesStr = localStorage.getItem(STORAGE_KEYS.SERVICES);
      const receiptsStr = localStorage.getItem(STORAGE_KEYS.RECEIPTS);
      const lastNum = localStorage.getItem(STORAGE_KEYS.LAST_RECEIPT_NUM);
      const lastFreeNum = localStorage.getItem(STORAGE_KEYS.LAST_FREE_RECEIPT_NUM);

      // Save to SQLite via bridge
      if (doctorsStr) {
        const doctors = JSON.parse(doctorsStr);
        console.log(`Migrating ${doctors.length} doctors...`);
            await window.database.batchImportDoctors(doctors);
      }
      
      if (servicesStr) {
        const services = JSON.parse(servicesStr);
        console.log(`Migrating ${services.length} services...`);
        for (const s of services) {
                await window.database.saveService(s);
        }
      }

      if (receiptsStr) {
        const receipts = JSON.parse(receiptsStr);
        console.log(`Migrating ${receipts.length} receipts...`);
        for (const r of receipts) {
                await window.database.saveReceipt(r);
        }
      }

      if (lastNum) {
            await window.database.setMetadata('last_receipt_num', lastNum);
      }

      if (lastFreeNum) {
            await window.database.setMetadata('last_free_receipt_num', lastFreeNum);
      }

      localStorage.setItem(STORAGE_KEYS.SQLITE_MIGRATED, 'true');
      console.log('Migration successfully completed!');
    } catch (error) {
      console.error('Migration failed:', error);
      // We don't set the flag so it tries again next time
    }
  },

  getDoctors: async (): Promise<Doctor[]> => {
    return window.database.getDoctors();
  },
  
  saveDoctor: async (doctor: Doctor) => {
    await window.database.saveDoctor(doctor);
  },

  deleteDoctor: async (id: string) => {
    await window.database.deleteDoctor(id);
  },

  getServices: async (type?: 'OPD' | 'FACILITY' | 'ALL'): Promise<Service[]> => {
    const all: Service[] = (await window.database.getServices()) || [];
    if (!type || type === 'ALL') return all;
    const facilityCategories = ['Room Rent', 'Oxygen', 'Nursing', 'Doctor Rounds', 'Equipment'];
    if (type === 'OPD') {
      return all.filter(s =>
        s.serviceType !== 'FACILITY' &&
        (!s.category || !facilityCategories.includes(s.category)) &&
        !s.id?.startsWith('fac_')
      );
    }
    if (type === 'FACILITY') {
      return all.filter(s =>
        s.serviceType === 'FACILITY' ||
        (s.category && facilityCategories.includes(s.category)) ||
        s.id?.startsWith('fac_')
      );
    }
    return all;
  },

  saveService: async (service: Service) => {
    await window.database.saveService(service);
  },

  deleteService: async (id: string) => {
    await window.database.deleteService(id);
  },

  getReceipts: async (options?: { limit?: number; offset?: number; search?: string; startDate?: string; endDate?: string }) => {
    return window.database?.getReceipts(options) || [];
  },
  getDashboardMetrics: async () => {
    return window.database?.getDashboardMetrics() || { totalReceipts: 0, totalRevenue: 0, avgPerReceipt: 0 };
  },

  saveReceipt: async (receipt: Receipt) => {
    // Increment correct receipt number atomically
    const isFree = receipt.paymentMethod === 'FREE';
    const key = isFree ? 'last_free_receipt_num' : 'last_receipt_num';
    const nextNumValue = parseInt(receipt.receiptNumber.replace(/\D/g, '')) + 1;
    const prefix = isFree ? 'F' : '';
    const nextNum = prefix + nextNumValue.toString();
    
    if (window.database?.saveReceiptAtomic) {
        await window.database.saveReceiptAtomic(receipt, key, nextNum);
    } else {
      // Fallback for older host
        await window.database.saveReceipt(receipt);
        await window.database.setMetadata(key, nextNum);
    }

    // Update last_patient_id metadata if a new PID number is higher
    if (receipt.patientId) {
      try {
        const num = parseInt(receipt.patientId.replace(/\D/g, '')) || 0;
        if (num > 0) {
          const meta = await window.database?.getMetadata('last_patient_id');
          const currentMax = meta?.value ? (parseInt(meta.value.replace(/\D/g, '')) || 0) : 0;
          if (num > currentMax) {
            await window.database?.setMetadata('last_patient_id', `PID-${num}`);
          }
        }
      } catch (err) {
        console.warn('Failed to update last_patient_id', err);
      }
    }
  },

  deleteReceipt: async (id: string) => {
    await window.database.deleteReceipt(id);
  },

  updateReceipt: async (receipt: Receipt) => {
    await window.database.updateReceipt(receipt);
    return true;
  },

  getNextReceiptNumber: async (isFree: boolean = false): Promise<string> => {
    const key = isFree ? 'last_free_receipt_num' : 'last_receipt_num';
    const meta = await window.database.getMetadata(key);
    if (meta) return meta.value;
    return isFree ? 'F1001' : '1001';
  },

  getNextPatientId: async (): Promise<string> => {
    try {
      const meta = await window.database?.getMetadata('last_patient_id');
      if (meta && meta.value) {
        const num = parseInt(meta.value.replace(/\D/g, '')) || 1000;
        return `PID-${num + 1}`;
      }
      const receipts = await storage.getReceipts({ limit: 50 });
      let maxNum = 1000;
      for (const r of receipts) {
        if (r.patientId) {
          const num = parseInt(r.patientId.replace(/\D/g, '')) || 0;
          if (num > maxNum) maxNum = num;
        }
      }
      return `PID-${maxNum + 1}`;
    } catch {
      return 'PID-1001';
    }
  },

  findPatientByPhoneOrId: async (query: string): Promise<Receipt | null> => {
    if (!query || !query.trim()) return null;
    const q = query.trim().toLowerCase();
    const receipts = await storage.getReceipts({ search: q, limit: 10 });
    const exactMatch = receipts.find(r => 
      (r.patientId && r.patientId.toLowerCase() === q) ||
      (r.patientPhone && r.patientPhone.trim() === q)
    );
    return exactMatch || receipts[0] || null;
  },

  getPatientCompleteHistory: async (patient: {
    patientId?: string;
    patientPhone?: string;
    patientName?: string;
  }): Promise<PatientHistorySummary> => {
    const pid = patient.patientId?.trim().toLowerCase();
    const phone = patient.patientPhone?.trim();
    const name = patient.patientName?.trim().toLowerCase();

    // 1. Fetch receipts (search broadly then match specifically)
    const searchTarget = pid || phone || name || '';
    const allReceipts = await storage.getReceipts({ search: searchTarget, limit: 200 });
    const matchedReceipts = allReceipts.filter(r => {
      const matchPid = Boolean(pid && r.patientId && r.patientId.trim().toLowerCase() === pid);
      const matchPhone = Boolean(phone && r.patientPhone && r.patientPhone.trim() === phone);
      const matchName = Boolean(name && r.patientName && r.patientName.trim().toLowerCase() === name);
      return matchPid || matchPhone || matchName;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // 2. Fetch prescriptions
    let allPrescriptions: Prescription[] = [];
    try {
      allPrescriptions = await storage.getPrescriptions();
    } catch (e) {
      console.warn('Failed to load prescriptions for patient history', e);
    }
    const matchedPrescriptions = allPrescriptions.filter(p => {
      const matchPid = Boolean(pid && p.patientId && p.patientId.trim().toLowerCase() === pid);
      const matchPhone = Boolean(phone && p.patientPhone && p.patientPhone.trim() === phone);
      const matchName = Boolean(name && p.patientName && p.patientName.trim().toLowerCase() === name);
      return matchPid || matchPhone || matchName;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // 3. Fetch appointments
    let allAppointments: Appointment[] = [];
    try {
      allAppointments = await storage.getAppointments();
    } catch (e) {
      console.warn('Failed to load appointments for patient history', e);
    }
    const matchedAppointments = allAppointments.filter(a => {
      const matchPid = Boolean(pid && a.patientId && a.patientId.trim().toLowerCase() === pid);
      const matchPhone = Boolean(phone && a.patientPhone && a.patientPhone.trim() === phone);
      const matchName = Boolean(name && a.patientName && a.patientName.trim().toLowerCase() === name);
      return matchPid || matchPhone || matchName;
    }).sort((a, b) => new Date(b.appointmentDate).getTime() - new Date(a.appointmentDate).getTime());

    // 4. Fetch follow-ups
    let allFollowUps: FollowUp[] = [];
    try {
      allFollowUps = await storage.getFollowUps();
    } catch (e) {
      console.warn('Failed to load follow-ups for patient history', e);
    }
    const matchedFollowUps = allFollowUps.filter(f => {
      const matchPid = Boolean(pid && f.patientId && f.patientId.trim().toLowerCase() === pid);
      const matchPhone = Boolean(phone && f.patientPhone && f.patientPhone.trim() === phone);
      const matchName = Boolean(name && f.patientName && f.patientName.trim().toLowerCase() === name);
      return matchPid || matchPhone || matchName;
    }).sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime());

    const totalSpent = matchedReceipts.reduce((sum, r) => sum + (Number(r.total) || 0), 0);

    return {
      receipts: matchedReceipts,
      prescriptions: matchedPrescriptions,
      appointments: matchedAppointments,
      followUps: matchedFollowUps,
      totalVisits: matchedReceipts.length,
      totalSpent,
      opdCount: matchedReceipts.filter(r => r.billType !== 'FACILITY').length,
      facilityCount: matchedReceipts.filter(r => r.billType === 'FACILITY').length,
      prescriptionCount: matchedPrescriptions.length
    };
  },

  exportData: async () => {
    const data = {
      doctors: await storage.getDoctors(),
      services: await storage.getServices(),
      receipts: await storage.getReceipts(),
      lastReceiptNum: await storage.getNextReceiptNumber(false)
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `buvora_backup_${format(new Date(), 'yyyyMMdd_HHmm')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  importData: async (jsonData: string): Promise<boolean> => {
    try {
      // Auto-backup before import (H5)
      try {
        await storage.exportData();
      } catch (err) {
        console.warn('Pre-import backup failed', err);
      }

      const data = JSON.parse(jsonData);
      if (data.doctors) {
            await window.database.batchImportDoctors(data.doctors);
      }
      if (data.services) {
        for (const s of data.services) {
                await window.database.saveService(s);
        }
      }
      if (data.receipts) {
        for (const r of data.receipts) {
                await window.database.saveReceipt(r);
        }
      }
      if (data.lastReceiptNum) {
            await window.database.setMetadata('last_receipt_num', data.lastReceiptNum);
      }
      return true;
    } catch (e) {
      console.error('Failed to import data:', e);
      return false;
    }
  },

  exportToExcel: async () => {
    const receipts = await storage.getReceipts();
    if (receipts.length === 0) {
      alert('No receipts found to export.');
      return;
    }

    const paidReceipts = receipts.filter(r => r.paymentMethod !== 'FREE');
    const freeReceipts = receipts.filter(r => r.paymentMethod === 'FREE');

    const headers = ['Date', 'Receipt #', 'Patient ID', 'Patient Name', 'Phone No.', 'Doctor Name', 'Services', 'Total Amount (₹)', 'Payment Method'];
    
    const formatRow = (r: any) => [
      r.date,
      `#${r.receiptNumber}`,
      r.patientId || 'N/A',
      r.patientName,
      r.patientPhone || 'N/A',
      r.doctorName,
      (r.items || []).map((item: any) => item.description).join('; '),
      (Number(r.total) || 0).toFixed(2),
      r.paymentMethod || 'CASH'
    ].map(cell => `"${cell}"`).join(',');

    let csvContent = "PAID PATIENT RECORDS\n" + headers.join(',') + '\n';
    csvContent += paidReceipts.map(formatRow).join('\n');
    
    csvContent += "\n\nFREE PATIENT RECORDS\n" + headers.join(',') + '\n';
    csvContent += freeReceipts.map(formatRow).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clinic_report_${format(new Date(), 'yyyyMMdd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },

  batchImportDoctors: async (syncKey: string): Promise<boolean> => {
    try {
      const jsonStr = atob(syncKey);
      const newDoctors = JSON.parse(jsonStr);
      if (Array.isArray(newDoctors)) {
            await window.database.batchImportDoctors(newDoctors);
        return true;
      }
      return false;
    } catch (e) {
      console.error('Failed to batch import doctors:', e);
      return false;
    }
  },

  getPrescriptions: async (): Promise<Prescription[]> => {
    return window.database.getPrescriptions();
  },

  savePrescription: async (prescription: Prescription) => {
    await window.database.savePrescription(prescription);
  },

  deletePrescription: async (id: string) => {
    await window.database.deletePrescription(id);
  },

  getAppointments: async (): Promise<Appointment[]> => {
    if (window.database?.getAppointments) {
        return window.database.getAppointments();
    }
    return [];
  },

  saveAppointment: async (appointment: Appointment) => {
    if (window.database?.saveAppointment) {
        await window.database.saveAppointment(appointment);
    }
  },

  updateAppointmentStatus: async (id: string, status: AppointmentStatus, rejectionReason?: string) => {
    if (window.database?.updateAppointmentStatus) {
        await window.database.updateAppointmentStatus(id, status, rejectionReason);
    }
  },

  deleteAppointment: async (id: string) => {
    if (window.database?.deleteAppointment) {
        await window.database.deleteAppointment(id);
    }
  },

  getFollowUps: async (options?: { limit?: number; offset?: number; search?: string; startDate?: string; endDate?: string; doctorId?: string; status?: string }): Promise<FollowUp[]> => {
    if (window.database?.getFollowUps) {
      return window.database.getFollowUps(options);
    }
    return [];
  },

  saveFollowUp: async (followUp: FollowUp): Promise<void> => {
    if (window.database?.saveFollowUp) {
      await window.database.saveFollowUp(followUp);
    }
  },

  updateFollowUpStatus: async (id: string, status: FollowUpStatus): Promise<void> => {
    if (window.database?.updateFollowUpStatus) {
      await window.database.updateFollowUpStatus(id, status);
    }
  },

  deleteFollowUp: async (id: string): Promise<void> => {
    if (window.database?.deleteFollowUp) {
      await window.database.deleteFollowUp(id);
    }
  },

  getPrintPaperSettings: async (): Promise<PrintPaperSettings> => {
    let receiptPaper: ReceiptPaperType = (localStorage.getItem(STORAGE_KEYS.RECEIPT_PAPER) as ReceiptPaperType) || 'A5';
    let prescriptionPaper: PrescriptionPaperType = (localStorage.getItem(STORAGE_KEYS.PRESCRIPTION_PAPER) as PrescriptionPaperType) || 'A4';

    if (window.database?.getMetadata) {
      try {
        const [rMeta, pMeta] = await Promise.all([
          window.database.getMetadata('receipt_paper_type'),
          window.database.getMetadata('prescription_paper_type')
        ]);
        if (rMeta?.value) {
          receiptPaper = rMeta.value as ReceiptPaperType;
          localStorage.setItem(STORAGE_KEYS.RECEIPT_PAPER, receiptPaper);
        }
        if (pMeta?.value) {
          prescriptionPaper = pMeta.value as PrescriptionPaperType;
          localStorage.setItem(STORAGE_KEYS.PRESCRIPTION_PAPER, prescriptionPaper);
        }
      } catch (err) {
        console.warn('Failed to fetch print paper metadata:', err);
      }
    }

    return { receiptPaper, prescriptionPaper };
  },

  savePrintPaperSettings: async (settings: Partial<PrintPaperSettings>): Promise<void> => {
    if (settings.receiptPaper) {
      localStorage.setItem(STORAGE_KEYS.RECEIPT_PAPER, settings.receiptPaper);
      if (window.database?.setMetadata) {
        try {
          await window.database.setMetadata('receipt_paper_type', settings.receiptPaper);
        } catch (err) {
          console.warn('Failed to save receipt paper metadata:', err);
        }
      }
    }
    if (settings.prescriptionPaper) {
      localStorage.setItem(STORAGE_KEYS.PRESCRIPTION_PAPER, settings.prescriptionPaper);
      if (window.database?.setMetadata) {
        try {
          await window.database.setMetadata('prescription_paper_type', settings.prescriptionPaper);
        } catch (err) {
          console.warn('Failed to save prescription paper metadata:', err);
        }
      }
    }
  },

  getClinicProfile: async (): Promise<ClinicProfile> => {
    let clinicName = localStorage.getItem(STORAGE_KEYS.CLINIC_NAME) || 'Buvora Clinic';
    let clinicPhone = localStorage.getItem(STORAGE_KEYS.CLINIC_PHONE) || '';
    let clinicAddress = localStorage.getItem(STORAGE_KEYS.CLINIC_ADDRESS) || '';
    let clinicUpiId = localStorage.getItem(STORAGE_KEYS.CLINIC_UPI_ID) || '';
    let clinicQrText = localStorage.getItem(STORAGE_KEYS.CLINIC_QR_TEXT) || '';
    let showFacilityQr = localStorage.getItem(STORAGE_KEYS.CLINIC_FACILITY_SHOW_QR) !== 'false';

    if (window.database?.getMetadata) {
      try {
        const [nameMeta, phoneMeta, addrMeta, upiMeta, qrMeta, showQrMeta] = await Promise.all([
          window.database.getMetadata('clinic_name'),
          window.database.getMetadata('clinic_phone'),
          window.database.getMetadata('clinic_address'),
          window.database.getMetadata('clinic_upi_id'),
          window.database.getMetadata('clinic_qr_text'),
          window.database.getMetadata('clinic_facility_show_qr'),
        ]);
        if (nameMeta?.value) {
          clinicName = nameMeta.value;
          localStorage.setItem(STORAGE_KEYS.CLINIC_NAME, clinicName);
        }
        if (phoneMeta?.value) {
          clinicPhone = phoneMeta.value;
          localStorage.setItem(STORAGE_KEYS.CLINIC_PHONE, clinicPhone);
        }
        if (addrMeta?.value) {
          clinicAddress = addrMeta.value;
          localStorage.setItem(STORAGE_KEYS.CLINIC_ADDRESS, clinicAddress);
        }
        if (upiMeta?.value) {
          clinicUpiId = upiMeta.value;
          localStorage.setItem(STORAGE_KEYS.CLINIC_UPI_ID, clinicUpiId);
        }
        if (qrMeta?.value) {
          clinicQrText = qrMeta.value;
          localStorage.setItem(STORAGE_KEYS.CLINIC_QR_TEXT, clinicQrText);
        }
        if (showQrMeta?.value !== undefined && showQrMeta?.value !== null) {
          showFacilityQr = showQrMeta.value === 'true';
          localStorage.setItem(STORAGE_KEYS.CLINIC_FACILITY_SHOW_QR, String(showFacilityQr));
        }
      } catch (err) {
        console.warn('Failed to fetch clinic profile metadata:', err);
      }
    }

    return {
      clinicName,
      clinicPhone,
      clinicAddress,
      clinicUpiId,
      clinicQrText,
      showFacilityQr
    };
  },

  saveClinicProfile: async (profile: Partial<ClinicProfile>): Promise<void> => {
    if (profile.clinicName !== undefined) {
      localStorage.setItem(STORAGE_KEYS.CLINIC_NAME, profile.clinicName);
      if (window.database?.setMetadata) {
        try { await window.database.setMetadata('clinic_name', profile.clinicName); } catch (e) { console.warn(e); }
      }
    }
    if (profile.clinicPhone !== undefined) {
      localStorage.setItem(STORAGE_KEYS.CLINIC_PHONE, profile.clinicPhone);
      if (window.database?.setMetadata) {
        try { await window.database.setMetadata('clinic_phone', profile.clinicPhone); } catch (e) { console.warn(e); }
      }
    }
    if (profile.clinicAddress !== undefined) {
      localStorage.setItem(STORAGE_KEYS.CLINIC_ADDRESS, profile.clinicAddress);
      if (window.database?.setMetadata) {
        try { await window.database.setMetadata('clinic_address', profile.clinicAddress); } catch (e) { console.warn(e); }
      }
    }
    if (profile.clinicUpiId !== undefined) {
      localStorage.setItem(STORAGE_KEYS.CLINIC_UPI_ID, profile.clinicUpiId);
      if (window.database?.setMetadata) {
        try { await window.database.setMetadata('clinic_upi_id', profile.clinicUpiId); } catch (e) { console.warn(e); }
      }
    }
    if (profile.clinicQrText !== undefined) {
      localStorage.setItem(STORAGE_KEYS.CLINIC_QR_TEXT, profile.clinicQrText);
      if (window.database?.setMetadata) {
        try { await window.database.setMetadata('clinic_qr_text', profile.clinicQrText); } catch (e) { console.warn(e); }
      }
    }
    if (profile.showFacilityQr !== undefined) {
      localStorage.setItem(STORAGE_KEYS.CLINIC_FACILITY_SHOW_QR, String(profile.showFacilityQr));
      if (window.database?.setMetadata) {
        try { await window.database.setMetadata('clinic_facility_show_qr', String(profile.showFacilityQr)); } catch (e) { console.warn(e); }
      }
    }
  },

  getExpenses: async (options?: { limit?: number; offset?: number; search?: string; category?: string; startDate?: string; endDate?: string }): Promise<Expense[]> => {
    if (window.database?.getExpenses) {
      try {
        return await window.database.getExpenses(options);
      } catch (err) {
        console.warn('Failed to fetch expenses from SQLite, falling back to localStorage:', err);
      }
    }
    const raw = localStorage.getItem('clinic_expenses');
    let list: Expense[] = raw ? JSON.parse(raw) : [];
    if (options?.category && options.category !== 'ALL') {
      list = list.filter(e => e.category === options.category);
    }
    if (options?.search) {
      const q = options.search.toLowerCase();
      list = list.filter(e => e.title.toLowerCase().includes(q) || (e.paidTo && e.paidTo.toLowerCase().includes(q)));
    }
    return list;
  },

  saveExpense: async (expense: Expense): Promise<Expense> => {
    if (window.database?.saveExpense) {
      try {
        return await window.database.saveExpense(expense);
      } catch (err) {
        console.warn('Failed to save expense in SQLite, fallback to localStorage:', err);
      }
    }
    const raw = localStorage.getItem('clinic_expenses');
    const list: Expense[] = raw ? JSON.parse(raw) : [];
    const id = expense.id || ('EXP-' + Date.now());
    const item = { ...expense, id, updatedAt: new Date().toISOString() };
    const idx = list.findIndex(e => e.id === id);
    if (idx >= 0) {
      list[idx] = item;
    } else {
      list.unshift(item);
    }
    localStorage.setItem('clinic_expenses', JSON.stringify(list));
    return item;
  },

  deleteExpense: async (id: string): Promise<void> => {
    if (window.database?.deleteExpense) {
      try {
        await window.database.deleteExpense(id);
        return;
      } catch (err) {
        console.warn('Failed to delete expense in SQLite, fallback to localStorage:', err);
      }
    }
    const raw = localStorage.getItem('clinic_expenses');
    if (raw) {
      const list: Expense[] = JSON.parse(raw);
      localStorage.setItem('clinic_expenses', JSON.stringify(list.filter(e => e.id !== id)));
    }
  },

  exportExpensesToCSV: (expenses: Expense[]) => {
    const headers = ['ID', 'Date', 'Title / Description', 'Category', 'Amount (INR)', 'Payment Mode', 'Paid To / Vendor', 'Bill / Invoice No', 'Status', 'Notes'];
    const rows = expenses.map(e => [
      `"${e.id}"`,
      `"${e.date}"`,
      `"${(e.title || '').replace(/"/g, '""')}"`,
      `"${e.category}"`,
      e.amount,
      `"${e.paymentMode}"`,
      `"${(e.paidTo || '').replace(/"/g, '""')}"`,
      `"${(e.billNumber || '').replace(/"/g, '""')}"`,
      `"${e.status || 'PAID'}"`,
      `"${(e.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `clinic_expenses_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

export const cleanAgeString = (ageStr?: string): string => {
  if (!ageStr) return '';
  return ageStr
    .replace(/\b(male|female|other)\b/gi, '')
    .replace(/\//g, '')
    .trim();
};

export const formatAgeGender = (patientAge?: string, patientGender?: string): string => {
  const gender = patientGender?.trim() || 'Male';
  const cleanedAge = cleanAgeString(patientAge);

  if (!cleanedAge) {
    return `N/A / ${gender}`;
  }

  const hasUnit = /[0-9]+\s*[ymYM]\b/.test(cleanedAge) || /\b(years?|months?|yrs?|mths?)\b/i.test(cleanedAge);
  const formattedAge = (!hasUnit && /^\d+$/.test(cleanedAge)) ? `${cleanedAge}Y` : cleanedAge;

  return `${formattedAge} / ${gender}`;
};

