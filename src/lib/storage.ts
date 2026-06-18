import { format } from 'date-fns';

export interface Doctor {
  id: string;
  name: string;
  specialization: string;
  qualifications: string;
  phone: string;
  address: string;
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
        // @ts-ignore
        await window.database.batchImportDoctors(doctors);
      }
      
      if (servicesStr) {
        const services = JSON.parse(servicesStr);
        console.log(`Migrating ${services.length} services...`);
        for (const s of services) {
          // @ts-ignore
          await window.database.saveService(s);
        }
      }

      if (receiptsStr) {
        const receipts = JSON.parse(receiptsStr);
        console.log(`Migrating ${receipts.length} receipts...`);
        for (const r of receipts) {
          // @ts-ignore
          await window.database.saveReceipt(r);
        }
      }

      if (lastNum) {
        // @ts-ignore
        await window.database.setMetadata('last_receipt_num', lastNum);
      }

      if (lastFreeNum) {
        // @ts-ignore
        await window.database.setMetadata('last_free_receipt_num', lastFreeNum);
      }

      localStorage.setItem(STORAGE_KEYS.SQLITE_MIGRATED, 'true');
      console.log('Migration successfully completed!');
      
      // Perform a single sync to Excel after full migration
      await storage.syncToExcel();
    } catch (error) {
      console.error('Migration failed:', error);
      // We don't set the flag so it tries again next time
    }
  },

  getDoctors: async (): Promise<Doctor[]> => {
    // @ts-ignore
    return window.database.getDoctors();
  },
  
  saveDoctor: async (doctor: Doctor) => {
    // @ts-ignore
    await window.database.saveDoctor(doctor);
    await storage.syncToExcel();
  },

  deleteDoctor: async (id: string) => {
    // @ts-ignore
    await window.database.deleteDoctor(id);
    await storage.syncToExcel();
  },

  getServices: async (): Promise<Service[]> => {
    // @ts-ignore
    return window.database.getServices();
  },

  saveService: async (service: Service) => {
    // @ts-ignore
    await window.database.saveService(service);
    await storage.syncToExcel();
  },

  deleteService: async (id: string) => {
    // @ts-ignore
    await window.database.deleteService(id);
    await storage.syncToExcel();
  },

  getReceipts: async (): Promise<Receipt[]> => {
    // @ts-ignore
    return window.database.getReceipts();
  },

  saveReceipt: async (receipt: Receipt) => {
    // @ts-ignore
    await window.database.saveReceipt(receipt);
    
    // Increment correct receipt number
    const isFree = receipt.paymentMethod === 'FREE';
    const key = isFree ? 'last_free_receipt_num' : 'last_receipt_num';
    const nextNum = parseInt(receipt.receiptNumber.replace(/\D/g, '')) + 1;
    const prefix = isFree ? 'F' : '';
    // @ts-ignore
    await window.database.setMetadata(key, prefix + nextNum.toString());
    
    await storage.syncToExcel();
  },

  deleteReceipt: async (id: string) => {
    // @ts-ignore
    await window.database.deleteReceipt(id);
    await storage.syncToExcel();
  },

  updateReceipt: async (receipt: Receipt) => {
    // @ts-ignore
    await window.database.updateReceipt(receipt);
    await storage.syncToExcel();
    return true;
  },

  getNextReceiptNumber: async (isFree: boolean = false): Promise<string> => {
    const key = isFree ? 'last_free_receipt_num' : 'last_receipt_num';
    // @ts-ignore
    const meta = await window.database.getMetadata(key);
    if (meta) return meta.value;
    return isFree ? 'F1001' : '1001';
  },

  syncToExcel: async () => {
    const doctors = await storage.getDoctors();
    const services = await storage.getServices();
    const receipts = await storage.getReceipts();
    const lastNum = await storage.getNextReceiptNumber(false);
    
    // Safety check: Don't sync if everything is empty but we have a flag
    // (This avoids overwriting Excel with empty data if SQLite fails to load)
    if (doctors.length === 0 && receipts.length === 0 && localStorage.getItem(STORAGE_KEYS.SQLITE_MIGRATED) === 'true') {
      console.warn('Sync aborted: SQLite returned empty data. Not overwriting Excel.');
      return;
    }

    const data = {
      doctors,
      services,
      receipts: receipts.map(r => ({
        ...r,
        items: JSON.stringify(r.items)
      })),
      lastReceiptNum: lastNum
    };
    // @ts-ignore
    window.excelStorage?.saveData(data);
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
      const data = JSON.parse(jsonData);
      if (data.doctors) {
        // @ts-ignore
        await window.database.batchImportDoctors(data.doctors);
      }
      if (data.services) {
        for (const s of data.services) {
          // @ts-ignore
          await window.database.saveService(s);
        }
      }
      if (data.receipts) {
        for (const r of data.receipts) {
          // @ts-ignore
          await window.database.saveReceipt(r);
        }
      }
      if (data.lastReceiptNum) {
        // @ts-ignore
        await window.database.setMetadata('last_receipt_num', data.lastReceiptNum);
      }
      await storage.syncToExcel();
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
        // @ts-ignore
        await window.database.batchImportDoctors(newDoctors);
        await storage.syncToExcel();
        return true;
      }
      return false;
    } catch (e) {
      console.error('Failed to batch import doctors:', e);
      return false;
    }
  }
};
