import path from 'node:path';
import fs from 'node:fs';
import { app } from 'electron';

let db: any;

export const database = {
  init: (Database: any, userId?: string) => {
    const DATA_DIR = path.join(app.getPath('userData'), 'ClinicData');
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    const legacyDbPath = path.join(DATA_DIR, 'medflow.db');
    const buvoraDbPath = path.join(DATA_DIR, 'buvora.db');

    if (fs.existsSync(legacyDbPath) && !fs.existsSync(buvoraDbPath)) {
      try {
        fs.renameSync(legacyDbPath, buvoraDbPath);
        console.log('[DB] Renamed legacy medflow.db to buvora.db');
      } catch (e) {
        console.warn('[DB] Could not rename legacy medflow.db:', e);
      }
    }

    const DB_PATH = fs.existsSync(buvoraDbPath) ? buvoraDbPath : (fs.existsSync(legacyDbPath) ? legacyDbPath : buvoraDbPath);

    if (db) {
      try {
        db.close();
        console.log('Closed previous database connection.');
      } catch (err) {
        console.error('Failed to close previous database connection:', err);
      }
    }

    db = new Database(DB_PATH);
    db.exec('PRAGMA foreign_keys = ON;');
    db.exec('PRAGMA journal_mode = WAL;');

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
        customTopMargin INTEGER DEFAULT 0,
        upiId TEXT,
        qrCodeText TEXT,
        showQrCodeOnReceipt INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS services (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        amount REAL NOT NULL
      );

      CREATE TABLE IF NOT EXISTS receipts (
        id TEXT PRIMARY KEY,
        receiptNumber TEXT NOT NULL,
        date TEXT NOT NULL,
        patientName TEXT NOT NULL,
        patientAge TEXT,
        patientGender TEXT,
        patientPhone TEXT,
        doctorId TEXT NOT NULL,
        doctorName TEXT NOT NULL,
        total REAL NOT NULL,
        paymentMethod TEXT DEFAULT 'CASH',
        appointmentId TEXT,
        showQrCode INTEGER DEFAULT 0,
        qrCodeText TEXT
      );

      CREATE TABLE IF NOT EXISTS receipt_items (
        id TEXT PRIMARY KEY,
        receiptId TEXT NOT NULL,
        description TEXT NOT NULL,
        amount REAL NOT NULL,
        FOREIGN KEY (receiptId) REFERENCES receipts(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS prescriptions (
        id TEXT PRIMARY KEY,
        receiptId TEXT,
        date TEXT NOT NULL,
        patientName TEXT NOT NULL,
        patientAge TEXT,
        patientGender TEXT,
        patientPhone TEXT,
        doctorId TEXT NOT NULL,
        doctorName TEXT NOT NULL,
        diagnosis TEXT,
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
        date TEXT,
        timeSlot TEXT,
        notes TEXT,
        rejectionReason TEXT,
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
    try {
      db.exec('ALTER TABLE doctors ADD COLUMN upiId TEXT;');
    } catch (e) {}
    try {
      db.exec('ALTER TABLE doctors ADD COLUMN qrCodeText TEXT;');
    } catch (e) {}
    try {
      db.exec('ALTER TABLE doctors ADD COLUMN showQrCodeOnReceipt INTEGER DEFAULT 0;');
    } catch (e) {}
    try {
      db.exec('ALTER TABLE receipts ADD COLUMN showQrCode INTEGER DEFAULT 0;');
    } catch (e) {}
    try {
      db.exec('ALTER TABLE receipts ADD COLUMN qrCodeText TEXT;');
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
      'date TEXT',
      'timeSlot TEXT',
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
    const buvoraDb = path.join(DATA_DIR, 'buvora.db');
    const legacyDb = path.join(DATA_DIR, 'medflow.db');
    return fs.existsSync(buvoraDb) ? buvoraDb : (fs.existsSync(legacyDb) ? legacyDb : buvoraDb);
  },

  // Doctors
  getDoctors: () => {
    const docs = db.prepare('SELECT * FROM doctors').all() as any[];
    return docs.map(d => ({
      ...d,
      printHeader: d.printHeader === 1 || d.printHeader === null || d.printHeader === undefined ? true : false,
      showQrCodeOnReceipt: d.showQrCodeOnReceipt === 1 ? true : false,
      upiId: d.upiId || '',
      qrCodeText: d.qrCodeText || '',
    }));
  },
  saveDoctor: (doctor: any) => {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO doctors (id, name, specialization, qualifications, phone, address, printHeader, customTopMargin, upiId, qrCodeText, showQrCodeOnReceipt)
      VALUES (@id, @name, @specialization, @qualifications, @phone, @address, @printHeader, @customTopMargin, @upiId, @qrCodeText, @showQrCodeOnReceipt)
    `);
    return stmt.run({
      ...doctor,
      printHeader: doctor.printHeader !== false ? 1 : 0,
      customTopMargin: doctor.customTopMargin || 0,
      upiId: doctor.upiId || '',
      qrCodeText: doctor.qrCodeText || '',
      showQrCodeOnReceipt: doctor.showQrCodeOnReceipt ? 1 : 0
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
  getReceipts: (options?: { limit?: number; offset?: number; search?: string; startDate?: string; endDate?: string }) => {
    let query = 'SELECT * FROM receipts';
    const params: any = {};
    const conditions: string[] = [];

    if (options?.startDate) {
      conditions.push("date(date) >= date(@startDate)");
      params.startDate = options.startDate;
    }
    if (options?.endDate) {
      conditions.push("date(date) <= date(@endDate)");
      params.endDate = options.endDate;
    }
    if (options?.search) {
      conditions.push("(patientName LIKE @search OR patientPhone LIKE @search OR receiptNumber LIKE @search)");
      params.search = `%${options.search}%`;
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY date DESC';

    if (options?.limit) {
      query += ' LIMIT @limit OFFSET @offset';
      params.limit = options.limit;
      params.offset = options.offset || 0;
    }

    const receipts = db.prepare(query).all(params) as any[];
    return receipts.map(r => {
      try {
        return {
          ...r,
          showQrCode: r.showQrCode === 1 ? true : false,
          qrCodeText: r.qrCodeText || '',
          items: JSON.parse(r.items || '[]')
        };
      } catch (e) {
        console.error('Failed to parse receipt items:', r.id, e);
        return {
          ...r,
          showQrCode: r.showQrCode === 1 ? true : false,
          qrCodeText: r.qrCodeText || '',
          items: []
        };
      }
    });
  },
  getDashboardMetrics: () => {
    const totalReceiptsRow = db.prepare("SELECT COUNT(*) as count FROM receipts").get() as { count: number };
    const totalRevenueRow = db.prepare("SELECT SUM(total) as sum FROM receipts WHERE paymentMethod != 'FREE'").get() as { sum: number };
    
    const count = totalReceiptsRow?.count || 0;
    const revenue = totalRevenueRow?.sum || 0;
    
    return {
      totalReceipts: count,
      totalRevenue: revenue,
      avgPerReceipt: count > 0 ? revenue / count : 0
    };
  },
  saveReceipt: (receipt: any) => {
    if (!receipt.id || !receipt.receiptNumber || !receipt.date || !receipt.patientName) {
      throw new Error('Receipt missing required fields: id, receiptNumber, date, patientName');
    }
    if (typeof receipt.total !== 'number' || receipt.total < 0) throw new Error('Total must be a non-negative number');
    if (receipt.items && Array.isArray(receipt.items)) {
      for (const item of receipt.items) {
        if (typeof item.amount !== 'number' || item.amount < 0) throw new Error('Item amount must be non-negative');
      }
    }
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO receipts (id, receiptNumber, date, patientName, patientAge, patientGender, patientPhone, doctorId, doctorName, items, total, paymentMethod, showQrCode, qrCodeText)
      VALUES (@id, @receiptNumber, @date, @patientName, @patientAge, @patientGender, @patientPhone, @doctorId, @doctorName, @items, @total, @paymentMethod, @showQrCode, @qrCodeText)
    `);
    return stmt.run({
      patientAge: '',
      patientGender: 'Male',
      patientPhone: '',
      doctorId: '',
      doctorName: '',
      paymentMethod: 'CASH',
      ...receipt,
      patientName: String(receipt.patientName).substring(0, 500),
      items: JSON.stringify(receipt.items || []),
      showQrCode: receipt.showQrCode ? 1 : 0,
      qrCodeText: receipt.qrCodeText || ''
    });
  },
  updateReceipt: (receipt: any) => {
    if (!receipt.id) throw new Error('Missing receipt ID for update');
    if (typeof receipt.total !== 'number' || receipt.total < 0) throw new Error('Total must be a non-negative number');
    if (receipt.items && Array.isArray(receipt.items)) {
      for (const item of receipt.items) {
        if (typeof item.amount !== 'number' || item.amount < 0) throw new Error('Item amount must be non-negative');
      }
    }
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
        paymentMethod = @paymentMethod,
        showQrCode = @showQrCode,
        qrCodeText = @qrCodeText
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
      items: JSON.stringify(receipt.items || []),
      showQrCode: receipt.showQrCode ? 1 : 0,
      qrCodeText: receipt.qrCodeText || ''
    });
  },
  deleteReceipt: (id: string) => db.prepare('DELETE FROM receipts WHERE id = ?').run(id),

  // Metadata (for receipt numbers, etc)
  getMetadata: (key: string) => db.prepare('SELECT value FROM metadata WHERE key = ?').get(key),
  setMetadata: (key: string, value: string) => {
    const stmt = db.prepare('INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)');
    return stmt.run(key, value);
  },

  // Atomic receipt save + number increment in a single transaction
  saveReceiptAtomic: (receipt: any, metaKey: string, nextNum: string) => {
    const saveStmt = db.prepare(`
      INSERT OR REPLACE INTO receipts (id, receiptNumber, date, patientName, patientAge, patientGender, patientPhone, doctorId, doctorName, items, total, paymentMethod)
      VALUES (@id, @receiptNumber, @date, @patientName, @patientAge, @patientGender, @patientPhone, @doctorId, @doctorName, @items, @total, @paymentMethod)
    `);
    const metaStmt = db.prepare('INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)');
    const txn = db.transaction(() => {
      saveStmt.run({
        patientAge: '',
        patientGender: 'Male',
        patientPhone: '',
        doctorId: '',
        doctorName: '',
        paymentMethod: 'CASH',
        ...receipt,
        patientName: String(receipt.patientName).substring(0, 500),
        items: JSON.stringify(receipt.items || [])
      });
      metaStmt.run(metaKey, nextNum);
    });
    return txn();
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
      const rows = db.prepare(`
        SELECT * FROM appointments 
        ORDER BY 
          CASE WHEN status = 'PENDING' THEN 0 ELSE 1 END,
          appointmentDate ASC, 
          appointmentTime ASC
      `).all() as any[];

      return rows.map((r) => ({
        ...r,
        appointmentDate: r.appointmentDate || r.date || '',
        appointmentTime: r.appointmentTime || r.timeSlot || '',
        date: r.appointmentDate || r.date || '',
        timeSlot: r.appointmentTime || r.timeSlot || ''
      }));
    } catch (e) {
      console.error('[Database] Error fetching appointments:', e);
      return [];
    }
  },
  saveAppointment: (appointment: any) => {
    const aptDate = appointment.appointmentDate || appointment.date || new Date().toISOString().split('T')[0];
    const aptTime = appointment.appointmentTime || appointment.timeSlot || 'Standard Slot';
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO appointments (id, patientName, patientPhone, patientAge, patientGender, doctorId, doctorName, appointmentDate, appointmentTime, date, timeSlot, notes, rejectionReason, source, status, createdAt)
      VALUES (@id, @patientName, @patientPhone, @patientAge, @patientGender, @doctorId, @doctorName, @appointmentDate, @appointmentTime, @date, @timeSlot, @notes, @rejectionReason, @source, @status, @createdAt)
    `);
    return stmt.run({
      id: appointment.id || ('APT-' + Math.floor(100000 + Math.random() * 900000)),
      patientName: appointment.patientName || 'Unknown Patient',
      patientPhone: appointment.patientPhone || '',
      patientAge: appointment.patientAge || '30',
      patientGender: appointment.patientGender || 'Male',
      doctorId: appointment.doctorId || 'default_doc',
      doctorName: appointment.doctorName || 'Consulting Doctor',
      appointmentDate: aptDate,
      appointmentTime: aptTime,
      date: aptDate,
      timeSlot: aptTime,
      notes: appointment.notes || '',
      rejectionReason: appointment.rejectionReason || '',
      source: appointment.source || 'WHATSAPP',
      status: appointment.status || 'PENDING',
      createdAt: appointment.createdAt || new Date().toISOString()
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
