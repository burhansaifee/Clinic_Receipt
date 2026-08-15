import path from 'node:path';
import fs from 'node:fs';
import { app } from 'electron';

let db: any;

export const database = {
  init: (Database: any, userId?: string) => {
    const DATA_DIR = path.join(app.getPath('userData'), 'ClinicData');
    const DB_PATH = path.join(DATA_DIR, 'medflow.db');

    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (db) {
      try {
        db.close();
        console.log('Closed previous database connection.');
      } catch (err) {
        console.error('Failed to close previous database connection:', err);
      }
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
        address TEXT,
        printHeader INTEGER DEFAULT 1,
        customTopMargin INTEGER DEFAULT 0
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

      CREATE TABLE IF NOT EXISTS prescriptions (
        id TEXT PRIMARY KEY,
        receiptId TEXT,
        date TEXT NOT NULL,
        patientName TEXT NOT NULL,
        patientAge TEXT,
        patientGender TEXT,
        patientPhone TEXT,
        doctorId TEXT,
        doctorName TEXT,
        symptoms TEXT,
        diagnosis TEXT,
        medicines TEXT, -- JSON string
        notes TEXT
      );

      CREATE TABLE IF NOT EXISTS appointments (
        id TEXT PRIMARY KEY,
        patientName TEXT NOT NULL,
        patientPhone TEXT NOT NULL,
        patientAge TEXT,
        patientGender TEXT,
        doctorId TEXT NOT NULL,
        doctorName TEXT NOT NULL,
        appointmentDate TEXT NOT NULL,
        appointmentTime TEXT NOT NULL,
        notes TEXT,
        source TEXT DEFAULT 'WHATSAPP',
        status TEXT DEFAULT 'PENDING',
        createdAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);

    // Migrations
    try {
      db.exec('ALTER TABLE doctors ADD COLUMN printHeader INTEGER DEFAULT 1;');
    } catch (e) {}
    try {
      db.exec('ALTER TABLE doctors ADD COLUMN customTopMargin INTEGER DEFAULT 0;');
    } catch (e) {}

    // Appointments Migrations
    const aptCols = [
      'patientName TEXT NOT NULL DEFAULT ""',
      'patientPhone TEXT NOT NULL DEFAULT ""',
      'patientAge TEXT',
      'patientGender TEXT',
      'doctorId TEXT NOT NULL DEFAULT ""',
      'doctorName TEXT NOT NULL DEFAULT ""',
      'appointmentDate TEXT NOT NULL DEFAULT ""',
      'appointmentTime TEXT NOT NULL DEFAULT ""',
      'notes TEXT',
      'rejectionReason TEXT',
      'source TEXT DEFAULT "WHATSAPP"',
      'status TEXT DEFAULT "PENDING"',
      'createdAt TEXT'
    ];
    for (const col of aptCols) {
      try {
        db.exec(`ALTER TABLE appointments ADD COLUMN ${col};`);
      } catch (e) {}
    }

    // Performance indexes (CREATE IF NOT EXISTS is idempotent)
    try {
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_receipts_date ON receipts(date);
        CREATE INDEX IF NOT EXISTS idx_receipts_doctorId ON receipts(doctorId);
        CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointmentDate);
        CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
        CREATE INDEX IF NOT EXISTS idx_prescriptions_doctorId ON prescriptions(doctorId);
        CREATE INDEX IF NOT EXISTS idx_prescriptions_date ON prescriptions(date);
      `);
    } catch (e) {
      console.error('[DB] Failed to create indexes:', e);
    }
  },

  getDbPath: () => {
    const DATA_DIR = path.join(app.getPath('userData'), 'ClinicData');
    return path.join(DATA_DIR, 'medflow.db');
  },

  // Doctors
  getDoctors: () => {
    const docs = db.prepare('SELECT * FROM doctors').all() as any[];
    return docs.map(d => ({
      ...d,
      printHeader: d.printHeader === 1 || d.printHeader === null || d.printHeader === undefined ? true : false,
    }));
  },
  saveDoctor: (doctor: any) => {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO doctors (id, name, specialization, qualifications, phone, address, printHeader, customTopMargin)
      VALUES (@id, @name, @specialization, @qualifications, @phone, @address, @printHeader, @customTopMargin)
    `);
    return stmt.run({
      ...doctor,
      printHeader: doctor.printHeader !== false ? 1 : 0,
      customTopMargin: doctor.customTopMargin || 0
    });
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
      INSERT OR IGNORE INTO doctors (id, name, specialization, qualifications, phone, address, printHeader, customTopMargin)
      VALUES (@id, @name, @specialization, @qualifications, @phone, @address, @printHeader, @customTopMargin)
    `);
    const transaction = db.transaction((docs: any[]) => {
      for (const doc of docs) {
        insert.run({
          ...doc,
          printHeader: doc.printHeader !== false ? 1 : 0,
          customTopMargin: doc.customTopMargin || 0
        });
      }
    });
    transaction(doctors);
  },

  // Prescriptions
  getPrescriptions: () => {
    const prescriptions = db.prepare('SELECT * FROM prescriptions ORDER BY date DESC').all() as any[];
    return prescriptions.map(p => {
      try {
        return {
          ...p,
          medicines: JSON.parse(p.medicines || '[]')
        };
      } catch (e) {
        console.error('Failed to parse prescription medicines:', p.id, e);
        return {
          ...p,
          medicines: []
        };
      }
    });
  },
  savePrescription: (prescription: any) => {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO prescriptions (id, receiptId, date, patientName, patientAge, patientGender, patientPhone, doctorId, doctorName, symptoms, diagnosis, medicines, notes)
      VALUES (@id, @receiptId, @date, @patientName, @patientAge, @patientGender, @patientPhone, @doctorId, @doctorName, @symptoms, @diagnosis, @medicines, @notes)
    `);
    return stmt.run({
      receiptId: '',
      patientAge: '',
      patientGender: 'Male',
      patientPhone: '',
      doctorId: '',
      doctorName: '',
      symptoms: '',
      diagnosis: '',
      notes: '',
      ...prescription,
      medicines: JSON.stringify(prescription.medicines || [])
    });
  },
  deletePrescription: (id: string) => db.prepare('DELETE FROM prescriptions WHERE id = ?').run(id),

  // Appointments
  getAppointments: () => {
    try {
      return db.prepare(`
        SELECT * FROM appointments 
        ORDER BY 
          CASE WHEN status = 'PENDING' THEN 0 ELSE 1 END,
          appointmentDate ASC, 
          appointmentTime ASC
      `).all() as any[];
    } catch (e) {
      return db.prepare('SELECT * FROM appointments').all() as any[];
    }
  },
  saveAppointment: (appointment: any) => {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO appointments (id, patientName, patientPhone, patientAge, patientGender, doctorId, doctorName, appointmentDate, appointmentTime, date, timeSlot, notes, rejectionReason, source, status, createdAt)
      VALUES (@id, @patientName, @patientPhone, @patientAge, @patientGender, @doctorId, @doctorName, @appointmentDate, @appointmentTime, @date, @timeSlot, @notes, @rejectionReason, @source, @status, @createdAt)
    `);
    return stmt.run({
      patientAge: '30',
      patientGender: 'Male',
      notes: '',
      rejectionReason: '',
      source: 'WHATSAPP',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      date: appointment.appointmentDate || new Date().toISOString().split('T')[0],
      timeSlot: appointment.appointmentTime || 'Anytime',
      ...appointment
    });
  },
  updateAppointmentStatus: (id: string, status: string, rejectionReason?: string) => {
    if (rejectionReason !== undefined) {
      return db.prepare('UPDATE appointments SET status = ?, rejectionReason = ? WHERE id = ?').run(status, rejectionReason, id);
    }
    return db.prepare('UPDATE appointments SET status = ? WHERE id = ?').run(status, id);
  },
  deleteAppointment: (id: string) => db.prepare('DELETE FROM appointments WHERE id = ?').run(id)
};
