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
}

export interface ReceiptItem {
  id: string;
  description: string;
  amount: number;
}

export interface Service {
  id: string;
  name: string;
  amount: number;
}

export interface Receipt {
  id: string;
  receiptNumber: string;
  date: string;
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
}

export type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';

export interface Appointment {
  id: string;
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

const STORAGE_KEYS = {
  DOCTORS: 'clinic_doctors',
  SERVICES: 'clinic_services',
  RECEIPTS: 'clinic_receipts',
  LAST_RECEIPT_NUM: 'clinic_last_receipt_num',
  LAST_FREE_RECEIPT_NUM: 'clinic_last_free_receipt_num',
  SQLITE_MIGRATED: 'clinic_sqlite_migrated'
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

  getServices: async (): Promise<Service[]> => {
    return window.database.getServices();
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
    a.download = `medflow_backup_${format(new Date(), 'yyyyMMdd_HHmm')}.json`;
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

    const headers = ['Date', 'Receipt #', 'Patient Name', 'Phone No.', 'Doctor Name', 'Services', 'Total Amount (₹)', 'Payment Method'];
    
    const formatRow = (r: any) => [
      r.date,
      `#${r.receiptNumber}`,
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

