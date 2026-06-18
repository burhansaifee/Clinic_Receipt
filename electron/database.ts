import path from 'node:path';
import fs from 'node:fs';
import { app } from 'electron';

let db: any;

export const database = {
  init: (Database: any) => {
    const DATA_DIR = path.join(app.getPath('userData'), 'ClinicData');
    const DB_PATH = path.join(DATA_DIR, 'medflow.db');

    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    db = new Database(DB_PATH);
    db.exec('PRAGMA foreign_keys = OFF;');

    // Initialize Tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS doctors (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        specialization TEXT,
        qualifications TEXT,
        phone TEXT,
        address TEXT
      );

      CREATE TABLE IF NOT EXISTS services (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        amount REAL
      );

      CREATE TABLE IF NOT EXISTS receipts (
        id TEXT PRIMARY KEY,
        receiptNumber TEXT NOT NULL,
        date TEXT NOT NULL,
        patientName TEXT NOT NULL,
        patientAge TEXT,
        patientGender TEXT,
        patientPhone TEXT,
        doctorId TEXT,
        doctorName TEXT,
        items TEXT, -- JSON string
        total REAL,
        paymentMethod TEXT
      );

      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);
  },

  getDbPath: () => {
    const DATA_DIR = path.join(app.getPath('userData'), 'ClinicData');
    return path.join(DATA_DIR, 'medflow.db');
  },

  // Doctors
  getDoctors: () => db.prepare('SELECT * FROM doctors').all(),
  saveDoctor: (doctor: any) => {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO doctors (id, name, specialization, qualifications, phone, address)
      VALUES (@id, @name, @specialization, @qualifications, @phone, @address)
    `);
    return stmt.run(doctor);
  },
  deleteDoctor: (id: string) => db.prepare('DELETE FROM doctors WHERE id = ?').run(id),

  // Services
  getServices: () => db.prepare('SELECT * FROM services').all(),
  saveService: (service: any) => {
    const stmt = db.prepare('INSERT OR REPLACE INTO services (id, name, amount) VALUES (@id, @name, @amount)');
    return stmt.run(service);
  },
  deleteService: (id: string) => db.prepare('DELETE FROM services WHERE id = ?').run(id),

  // Receipts
  getReceipts: () => {
    const receipts = db.prepare('SELECT * FROM receipts ORDER BY date DESC').all() as any[];
    return receipts.map(r => {
      try {
        return {
          ...r,
          items: JSON.parse(r.items || '[]')
        };
      } catch (e) {
        console.error('Failed to parse receipt items:', r.id, e);
        return {
          ...r,
          items: []
        };
      }
    });
  },
  saveReceipt: (receipt: any) => {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO receipts (id, receiptNumber, date, patientName, patientAge, patientGender, patientPhone, doctorId, doctorName, items, total, paymentMethod)
      VALUES (@id, @receiptNumber, @date, @patientName, @patientAge, @patientGender, @patientPhone, @doctorId, @doctorName, @items, @total, @paymentMethod)
    `);
    return stmt.run({
      patientAge: '',
      patientGender: 'Male',
      patientPhone: '',
      doctorId: '',
      doctorName: '',
      paymentMethod: 'CASH',
      ...receipt,
      items: JSON.stringify(receipt.items || [])
    });
  },
  updateReceipt: (receipt: any) => {
    const stmt = db.prepare(`
      UPDATE receipts SET 
        receiptNumber = @receiptNumber,
        date = @date,
        patientName = @patientName,
        patientAge = @patientAge,
        patientGender = @patientGender,
        patientPhone = @patientPhone,
        doctorId = @doctorId,
        doctorName = @doctorName,
        items = @items,
        total = @total,
        paymentMethod = @paymentMethod
      WHERE id = @id
    `);
    return stmt.run({
      patientAge: '',
      patientGender: 'Male',
      patientPhone: '',
      doctorId: '',
      doctorName: '',
      paymentMethod: 'CASH',
      ...receipt,
      items: JSON.stringify(receipt.items || [])
    });
  },
  deleteReceipt: (id: string) => db.prepare('DELETE FROM receipts WHERE id = ?').run(id),

  // Metadata (for receipt numbers, etc)
  getMetadata: (key: string) => db.prepare('SELECT value FROM metadata WHERE key = ?').get(key),
  setMetadata: (key: string, value: string) => {
    const stmt = db.prepare('INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)');
    return stmt.run(key, value);
  },

  // Batch import for doctors
  batchImportDoctors: (doctors: any[]) => {
    const insert = db.prepare(`
      INSERT OR IGNORE INTO doctors (id, name, specialization, qualifications, phone, address)
      VALUES (@id, @name, @specialization, @qualifications, @phone, @address)
    `);
    const transaction = db.transaction((docs: any[]) => {
      for (const doc of docs) insert.run(doc);
    });
    transaction(doctors);
  }
};
