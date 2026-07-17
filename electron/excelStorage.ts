import path from 'node:path';
import fs from 'node:fs';
import * as XLSX from 'xlsx';
import { app } from 'electron';

const DATA_DIR = path.join(app.getPath('userData'), 'ClinicData');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let currentUserId: string | null = null;

const getExcelPath = () => {
  return path.join(DATA_DIR, 'MedFlow_Database.xlsx');
};

export const excelStorage = {
  setUserId: (userId: string | null) => {
    currentUserId = userId;
  },
  saveData: (data: any) => {
    const EXCEL_PATH = getExcelPath();
    try {
      const workbook = XLSX.utils.book_new();

      // Doctors Sheet
      const doctorsWS = XLSX.utils.json_to_sheet(data.doctors || []);
      XLSX.utils.book_append_sheet(workbook, doctorsWS, 'Doctors');

      // Services Sheet
      const servicesWS = XLSX.utils.json_to_sheet(data.services || []);
      XLSX.utils.book_append_sheet(workbook, servicesWS, 'Services');

      // Receipts Sheet
      const receiptsWS = XLSX.utils.json_to_sheet(data.receipts || []);
      XLSX.utils.book_append_sheet(workbook, receiptsWS, 'Receipts');

      // Metadata Sheet
      const metaWS = XLSX.utils.json_to_sheet([{ lastReceiptNum: data.lastReceiptNum }]);
      XLSX.utils.book_append_sheet(workbook, metaWS, 'Metadata');

      XLSX.writeFile(workbook, EXCEL_PATH);
      return { success: true, path: EXCEL_PATH };
    } catch (error: any) {
      console.error('Excel Save Error:', error);
      if (error.code === 'EBUSY' || error.message.includes('EBUSY')) {
        return { success: false, error: 'The Excel file is currently open in another program. Please close it and try again.' };
      }
      return { success: false, error: error.message };
    }
  },

  loadData: () => {
    try {
      const EXCEL_PATH = getExcelPath();
      if (!fs.existsSync(EXCEL_PATH)) return null;

      const workbook = XLSX.readFile(EXCEL_PATH);
      
      const doctors = XLSX.utils.sheet_to_json(workbook.Sheets['Doctors']);
      const services = XLSX.utils.sheet_to_json(workbook.Sheets['Services']);
      const receipts = XLSX.utils.sheet_to_json(workbook.Sheets['Receipts']).map((r: any) => ({
        ...r,
        items: JSON.parse(r.items || '[]') // Items are stored as JSON string in Excel cell
      }));
      const meta = XLSX.utils.sheet_to_json(workbook.Sheets['Metadata']) as any[];
      
      return {
        doctors,
        services,
        receipts,
        lastReceiptNum: meta[0]?.lastReceiptNum || '1001'
      };
    } catch (error) {
      console.error('Excel Load Error:', error);
      return null;
    }
  },

  getExcelPath: () => getExcelPath()
};
