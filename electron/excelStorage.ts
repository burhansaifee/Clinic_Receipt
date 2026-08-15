import path from 'node:path';
import fs from 'node:fs';
import { app } from 'electron';

const DATA_DIR = path.join(app.getPath('userData'), 'ClinicData');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const getExcelPath = () => {
  return path.join(DATA_DIR, 'MedFlow_Database.xlsx');
};

export const excelStorage = {
  setUserId: (_userId: string | null) => {
    // userId tracking removed
  },
  saveData: (_data: any) => {
    return { success: false, error: 'Excel sync has been removed for security and performance reasons. Please use the SQLite database or JSON backups.' };
  },
  loadData: () => {
    return null;
  },
  getExcelPath: () => getExcelPath()
};
