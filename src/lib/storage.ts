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
  paymentMethod: 'CASH' | 'ONLINE';
}

const STORAGE_KEYS = {
  DOCTORS: 'clinic_doctors',
  SERVICES: 'clinic_services',
  RECEIPTS: 'clinic_receipts',
  LAST_RECEIPT_NUM: 'clinic_last_receipt_num'
};

export const storage = {
  getDoctors: (): Doctor[] => {
    const data = localStorage.getItem(STORAGE_KEYS.DOCTORS);
    return data ? JSON.parse(data) : [];
  },
  
  saveDoctor: (doctor: Doctor) => {
    const doctors = storage.getDoctors();
    const index = doctors.findIndex(d => d.id === doctor.id);
    if (index >= 0) {
      doctors[index] = doctor;
    } else {
      doctors.push(doctor);
    }
    localStorage.setItem(STORAGE_KEYS.DOCTORS, JSON.stringify(doctors));
  },

  deleteDoctor: (id: string) => {
    const doctors = storage.getDoctors().filter(d => d.id !== id);
    localStorage.setItem(STORAGE_KEYS.DOCTORS, JSON.stringify(doctors));
  },

  getServices: (): Service[] => {
    const data = localStorage.getItem(STORAGE_KEYS.SERVICES);
    return data ? JSON.parse(data) : [];
  },

  saveService: (service: Service) => {
    const services = storage.getServices();
    const index = services.findIndex(s => s.id === service.id);
    if (index >= 0) {
      services[index] = service;
    } else {
      services.push(service);
    }
    localStorage.setItem(STORAGE_KEYS.SERVICES, JSON.stringify(services));
  },

  deleteService: (id: string) => {
    const services = storage.getServices().filter(s => s.id !== id);
    localStorage.setItem(STORAGE_KEYS.SERVICES, JSON.stringify(services));
  },

  getReceipts: (): Receipt[] => {
    const data = localStorage.getItem(STORAGE_KEYS.RECEIPTS);
    return data ? JSON.parse(data) : [];
  },

  saveReceipt: (receipt: Receipt) => {
    const receipts = storage.getReceipts();
    receipts.push(receipt);
    localStorage.setItem(STORAGE_KEYS.RECEIPTS, JSON.stringify(receipts));
    
    // Increment receipt number
    const nextNum = parseInt(receipt.receiptNumber) + 1;
    localStorage.setItem(STORAGE_KEYS.LAST_RECEIPT_NUM, nextNum.toString());
  },

  getNextReceiptNumber: (): string => {
    const lastNum = localStorage.getItem(STORAGE_KEYS.LAST_RECEIPT_NUM);
    return lastNum || '1001';
  },

  exportData: () => {
    const data = {
      doctors: storage.getDoctors(),
      services: storage.getServices(),
      receipts: storage.getReceipts(),
      lastReceiptNum: storage.getNextReceiptNumber()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `medflow_backup_${format(new Date(), 'yyyyMMdd_HHmm')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  importData: (jsonData: string): boolean => {
    try {
      const data = JSON.parse(jsonData);
      if (data.doctors) localStorage.setItem(STORAGE_KEYS.DOCTORS, JSON.stringify(data.doctors));
      if (data.services) localStorage.setItem(STORAGE_KEYS.SERVICES, JSON.stringify(data.services));
      if (data.receipts) localStorage.setItem(STORAGE_KEYS.RECEIPTS, JSON.stringify(data.receipts));
      if (data.lastReceiptNum) localStorage.setItem(STORAGE_KEYS.LAST_RECEIPT_NUM, data.lastReceiptNum);
      return true;
    } catch (e) {
      console.error('Failed to import data:', e);
      return false;
    }
  },

  exportToExcel: () => {
    const receipts = storage.getReceipts();
    if (receipts.length === 0) {
      alert('No receipts found to export.');
      return;
    }

    // CSV Headers
    const headers = ['Date', 'Receipt #', 'Patient Name', 'Phone No.', 'Doctor Name', 'Total Amount (₹)', 'Payment Method'];
    
    // CSV Rows
    const rows = receipts.map(r => [
      r.date,
      `#${r.receiptNumber}`,
      r.patientName,
      r.patientPhone || 'N/A',
      r.doctorName,
      r.total.toFixed(2),
      r.paymentMethod || 'CASH'
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Create and download the file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clinic_report_${format(new Date(), 'yyyyMMdd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },

  batchImportDoctors: (syncKey: string): boolean => {
    try {
      // Decode base64
      const jsonStr = atob(syncKey);
      const newDoctors = JSON.parse(jsonStr);
      
      if (Array.isArray(newDoctors)) {
        const existingDoctors = storage.getDoctors();
        const merged = [...existingDoctors];

        newDoctors.forEach(newDoc => {
          // Avoid duplicates by checking name (case insensitive)
          const exists = merged.some(d => d.name.toLowerCase().trim() === newDoc.name.toLowerCase().trim());
          if (!exists) {
            merged.push(newDoc);
          }
        });

        localStorage.setItem(STORAGE_KEYS.DOCTORS, JSON.stringify(merged));
        return true;
      }
      return false;
    } catch (e) {
      console.error('Failed to batch import doctors:', e);
      return false;
    }
  }

};
