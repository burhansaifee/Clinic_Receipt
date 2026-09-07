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
    db.exec('PRAGMA synchronous = NORMAL;');
    db.exec('PRAGMA cache_size = -64000;');

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
        customBottomMargin INTEGER DEFAULT 0,
        upiId TEXT,
        qrCodeText TEXT,
        showQrCodeOnReceipt INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS services (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        amount REAL NOT NULL,
        category TEXT DEFAULT 'General',
        unit TEXT DEFAULT 'Units',
        serviceType TEXT DEFAULT 'OPD'
      );

      CREATE TABLE IF NOT EXISTS receipts (
        id TEXT PRIMARY KEY,
        receiptNumber TEXT NOT NULL,
        date TEXT NOT NULL,
        patientId TEXT,
        patientName TEXT NOT NULL,
        patientAge TEXT,
        patientGender TEXT,
        patientPhone TEXT,
        doctorId TEXT NOT NULL,
        doctorName TEXT NOT NULL,
        items TEXT,
        total REAL NOT NULL,
        paymentMethod TEXT DEFAULT 'CASH',
        appointmentId TEXT,
        showQrCode INTEGER DEFAULT 0,
        qrCodeText TEXT,
        billType TEXT DEFAULT 'OPD',
        roomNumber TEXT,
        admissionDate TEXT,
        dischargeDate TEXT,
        advancePaid REAL DEFAULT 0,
        discount REAL DEFAULT 0
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
        patientId TEXT,
        date TEXT NOT NULL,
        patientName TEXT NOT NULL,
        patientAge TEXT,
        patientGender TEXT,
        patientPhone TEXT,
        doctorId TEXT NOT NULL,
        doctorName TEXT NOT NULL,
        symptoms TEXT,
        diagnosis TEXT,
        medicines TEXT,
        notes TEXT,
        followUpDate TEXT,
        followUpNotes TEXT,
        labInvestigations TEXT
      );

      CREATE TABLE IF NOT EXISTS follow_ups (
        id TEXT PRIMARY KEY,
        prescriptionId TEXT,
        receiptId TEXT,
        patientId TEXT,
        patientName TEXT NOT NULL,
        patientPhone TEXT,
        patientAge TEXT,
        patientGender TEXT,
        doctorId TEXT NOT NULL,
        doctorName TEXT NOT NULL,
        scheduledDate TEXT NOT NULL,
        notes TEXT,
        status TEXT DEFAULT 'PENDING',
        createdAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS appointments (
        id TEXT PRIMARY KEY,
        patientId TEXT,
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

      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        amount REAL NOT NULL,
        paidAmount REAL DEFAULT 0,
        date TEXT NOT NULL,
        dueDate TEXT,
        paymentMode TEXT NOT NULL DEFAULT 'CASH',
        paidTo TEXT,
        vendorPhone TEXT,
        billNumber TEXT,
        isRecurring INTEGER DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'PAID',
        notes TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
      CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
      CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);
      CREATE INDEX IF NOT EXISTS idx_receipts_patientPhone ON receipts(patientPhone);
      CREATE INDEX IF NOT EXISTS idx_receipts_receiptNumber ON receipts(receiptNumber);
      CREATE INDEX IF NOT EXISTS idx_receipt_items_receiptId ON receipt_items(receiptId);

      -- Hospital Pharmacy Tables
      CREATE TABLE IF NOT EXISTS medicines (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        genericName TEXT,
        category TEXT DEFAULT 'Tablet',
        manufacturer TEXT,
        unit TEXT DEFAULT 'Strip',
        hsnCode TEXT,
        minStockAlert INTEGER DEFAULT 10,
        locationRack TEXT,
        notes TEXT,
        createdAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS medicine_batches (
        id TEXT PRIMARY KEY,
        medicineId TEXT NOT NULL,
        batchNumber TEXT NOT NULL,
        expiryDate TEXT NOT NULL,
        purchaseRate REAL DEFAULT 0,
        salePrice REAL NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (medicineId) REFERENCES medicines(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS pharmacy_sales (
        id TEXT PRIMARY KEY,
        saleNumber TEXT NOT NULL,
        patientId TEXT,
        patientName TEXT NOT NULL,
        patientPhone TEXT,
        prescriptionId TEXT,
        date TEXT NOT NULL,
        items TEXT NOT NULL,
        subtotal REAL NOT NULL,
        discount REAL DEFAULT 0,
        tax REAL DEFAULT 0,
        total REAL NOT NULL,
        paymentMethod TEXT DEFAULT 'CASH',
        dispensedBy TEXT,
        notes TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_medicines_name ON medicines(name);
      CREATE INDEX IF NOT EXISTS idx_batches_medicineId ON medicine_batches(medicineId);
      CREATE INDEX IF NOT EXISTS idx_batches_expiry ON medicine_batches(expiryDate);
      CREATE INDEX IF NOT EXISTS idx_pharmacy_sales_date ON pharmacy_sales(date);
      CREATE INDEX IF NOT EXISTS idx_pharmacy_sales_patientId ON pharmacy_sales(patientId);

      -- Hospital IPD (Inpatient Department) Wards & Beds
      CREATE TABLE IF NOT EXISTS wards (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT NOT NULL,
        floor TEXT DEFAULT 'Ground Floor',
        dailyRate REAL NOT NULL DEFAULT 0,
        nursingRate REAL DEFAULT 0,
        totalBeds INTEGER DEFAULT 0,
        description TEXT,
        isActive INTEGER DEFAULT 1,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS beds (
        id TEXT PRIMARY KEY,
        wardId TEXT NOT NULL,
        bedNumber TEXT NOT NULL,
        bedType TEXT DEFAULT 'Standard',
        dailyRate REAL NOT NULL DEFAULT 0,
        status TEXT DEFAULT 'available',
        currentAdmissionId TEXT,
        notes TEXT,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (wardId) REFERENCES wards(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS bed_admissions (
        id TEXT PRIMARY KEY,
        admissionNumber TEXT NOT NULL,
        patientId TEXT,
        patientUhid TEXT,
        patientName TEXT NOT NULL,
        patientPhone TEXT,
        patientGender TEXT,
        patientAge TEXT,
        wardId TEXT NOT NULL,
        wardName TEXT NOT NULL,
        bedId TEXT NOT NULL,
        bedNumber TEXT NOT NULL,
        doctorId TEXT NOT NULL,
        doctorName TEXT NOT NULL,
        admittedAt TEXT NOT NULL,
        dischargedAt TEXT,
        expectedDischargeAt TEXT,
        diagnosis TEXT,
        initialVitals TEXT,
        vitalsLog TEXT,
        wardChargesLog TEXT,
        advancePaid REAL DEFAULT 0,
        paymentMode TEXT DEFAULT 'CASH',
        status TEXT DEFAULT 'admitted',
        billingStatus TEXT DEFAULT 'NONE',
        dischargeSummary TEXT,
        totalBillId TEXT,
        notes TEXT,
        transfersLog TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS lab_tests (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT NOT NULL,
        category TEXT NOT NULL,
        rate REAL NOT NULL DEFAULT 0,
        sampleType TEXT DEFAULT 'Blood (EDTA)',
        turnaroundTime TEXT DEFAULT '2-4 Hours',
        parameters TEXT NOT NULL,
        description TEXT,
        isActive INTEGER DEFAULT 1,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS lab_orders (
        id TEXT PRIMARY KEY,
        orderNumber TEXT NOT NULL,
        patientId TEXT,
        patientName TEXT NOT NULL,
        patientPhone TEXT,
        patientGender TEXT,
        patientAge TEXT,
        doctorId TEXT,
        doctorName TEXT,
        prescriptionId TEXT,
        tests TEXT NOT NULL,
        totalAmount REAL NOT NULL DEFAULT 0,
        discount REAL DEFAULT 0,
        paidAmount REAL DEFAULT 0,
        paymentMode TEXT DEFAULT 'CASH',
        status TEXT DEFAULT 'ORDERED',
        sampleCollectedAt TEXT,
        sampleCollectedBy TEXT,
        completedAt TEXT,
        technicianNotes TEXT,
        pathologistRemarks TEXT,
        orderDate TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_beds_wardId ON beds(wardId);
      CREATE INDEX IF NOT EXISTS idx_beds_status ON beds(status);
      CREATE INDEX IF NOT EXISTS idx_admissions_patientId ON bed_admissions(patientId);
      CREATE INDEX IF NOT EXISTS idx_admissions_status ON bed_admissions(status);
      CREATE INDEX IF NOT EXISTS idx_admissions_bedId ON bed_admissions(bedId);
      CREATE INDEX IF NOT EXISTS idx_prescriptions_receiptId ON prescriptions(receiptId);
      CREATE INDEX IF NOT EXISTS idx_lab_tests_category ON lab_tests(category);
      CREATE INDEX IF NOT EXISTS idx_lab_orders_patientId ON lab_orders(patientId);
      CREATE INDEX IF NOT EXISTS idx_lab_orders_status ON lab_orders(status);
      CREATE INDEX IF NOT EXISTS idx_lab_orders_orderDate ON lab_orders(orderDate);
    `);

    // Clean up any previously seeded default medicines so no hardcoded data remains
    try {
      db.prepare("DELETE FROM medicines WHERE notes = 'Default hospital formulary'").run();
    } catch (_) {}

    // Seed default hospital wards and beds if empty
    try {
      const wardCount = db.prepare('SELECT COUNT(*) as cnt FROM wards').get() as { cnt: number };
      if (wardCount && wardCount.cnt === 0) {
        const seedNow = new Date().toISOString();
        const defaultWards = [
          {
            id: 'WARD-ICU',
            name: 'Intensive Care Unit (ICU)',
            code: 'ICU',
            floor: '1st Floor - Wing A',
            dailyRate: 3500,
            nursingRate: 800,
            beds: [
              { num: 'ICU-01', type: 'ICU Electric Multi-Para' },
              { num: 'ICU-02', type: 'ICU Electric Multi-Para' },
              { num: 'ICU-03', type: 'ICU Electric Multi-Para' },
              { num: 'ICU-04', type: 'ICU Electric Multi-Para' }
            ]
          },
          {
            id: 'WARD-GW-M',
            name: 'General Ward (Male)',
            code: 'GW-M',
            floor: 'Ground Floor',
            dailyRate: 600,
            nursingRate: 150,
            beds: [
              { num: 'GW-M01', type: 'Standard Fowler' },
              { num: 'GW-M02', type: 'Standard Fowler' },
              { num: 'GW-M03', type: 'Standard Fowler' },
              { num: 'GW-M04', type: 'Standard Fowler' },
              { num: 'GW-M05', type: 'Standard Fowler' },
              { num: 'GW-M06', type: 'Standard Fowler' }
            ]
          },
          {
            id: 'WARD-GW-F',
            name: 'General Ward (Female)',
            code: 'GW-F',
            floor: 'Ground Floor',
            dailyRate: 600,
            nursingRate: 150,
            beds: [
              { num: 'GW-F01', type: 'Standard Fowler' },
              { num: 'GW-F02', type: 'Standard Fowler' },
              { num: 'GW-F03', type: 'Standard Fowler' },
              { num: 'GW-F04', type: 'Standard Fowler' },
              { num: 'GW-F05', type: 'Standard Fowler' },
              { num: 'GW-F06', type: 'Standard Fowler' }
            ]
          },
          {
            id: 'WARD-SP',
            name: 'Semi-Private Room',
            code: 'SP',
            floor: '2nd Floor - Wing B',
            dailyRate: 1200,
            nursingRate: 300,
            beds: [
              { num: 'SP-101', type: 'Semi-Fowler' },
              { num: 'SP-102', type: 'Semi-Fowler' },
              { num: 'SP-103', type: 'Semi-Fowler' },
              { num: 'SP-104', type: 'Semi-Fowler' }
            ]
          },
          {
            id: 'WARD-PVT',
            name: 'Deluxe Private Suite',
            code: 'PVT',
            floor: '2nd Floor - Wing A',
            dailyRate: 2500,
            nursingRate: 500,
            beds: [
              { num: 'PVT-201', type: 'Motorized Deluxe Suite' },
              { num: 'PVT-202', type: 'Motorized Deluxe Suite' },
              { num: 'PVT-203', type: 'Motorized Deluxe Suite' }
            ]
          },
          {
            id: 'WARD-DC',
            name: 'Daycare & Observation',
            code: 'DC',
            floor: 'Ground Floor - Emergency',
            dailyRate: 400,
            nursingRate: 100,
            beds: [
              { num: 'DC-01', type: 'Daycare Recliner Bed' },
              { num: 'DC-02', type: 'Daycare Recliner Bed' },
              { num: 'DC-03', type: 'Daycare Recliner Bed' }
            ]
          }
        ];

        const insertWard = db.prepare(`
          INSERT INTO wards (id, name, code, floor, dailyRate, nursingRate, totalBeds, description, isActive, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
        `);
        const insertBed = db.prepare(`
          INSERT INTO beds (id, wardId, bedNumber, bedType, dailyRate, status, notes, updatedAt)
          VALUES (?, ?, ?, ?, ?, 'available', '', ?)
        `);

        for (const w of defaultWards) {
          insertWard.run(w.id, w.name, w.code, w.floor, w.dailyRate, w.nursingRate, w.beds.length, `${w.name} - Floor: ${w.floor}`, seedNow, seedNow);
          for (const b of w.beds) {
            insertBed.run(`BED-${b.num}`, w.id, b.num, b.type, w.dailyRate, seedNow);
          }
        }
        console.log('[DB] Pre-seeded 6 hospital wards with 26 inpatient beds');
      }
    } catch (e) {
      console.warn('[DB] Seeding wards and beds failed or skipped:', e);
    }

    // Seed default standard clinical laboratory tests if empty
    try {
      const testCount = db.prepare('SELECT COUNT(*) as cnt FROM lab_tests').get() as { cnt: number };
      if (testCount && testCount.cnt === 0) {
        const seedNow = new Date().toISOString();
        const defaultLabTests = [
          {
            id: 'LAB-CBC',
            name: 'Complete Blood Count (CBC) with ESR',
            code: 'CBC',
            category: 'Hematology',
            rate: 350,
            sampleType: 'Blood (EDTA)',
            turnaroundTime: '2-4 Hours',
            description: 'Automated 12-parameter blood count for anemia, infection, and platelet assessment',
            parameters: [
              { id: 'hb', name: 'Hemoglobin (Hb)', unit: 'g/dL', maleRange: '13.5 - 17.5', femaleRange: '12.0 - 15.5', defaultRange: '12.0 - 17.5' },
              { id: 'rbc', name: 'Total RBC Count', unit: 'mill/cu.mm', maleRange: '4.5 - 5.9', femaleRange: '4.0 - 5.2', defaultRange: '4.5 - 5.5' },
              { id: 'tlc', name: 'Total Leucocyte Count (TLC)', unit: '/cu.mm', maleRange: '4,000 - 11,000', femaleRange: '4,000 - 11,000', defaultRange: '4,000 - 11,000' },
              { id: 'neutrophils', name: 'Neutrophils', unit: '%', maleRange: '40 - 70', femaleRange: '40 - 70', defaultRange: '40 - 70' },
              { id: 'lymphocytes', name: 'Lymphocytes', unit: '%', maleRange: '20 - 45', femaleRange: '20 - 45', defaultRange: '20 - 45' },
              { id: 'eosinophils', name: 'Eosinophils', unit: '%', maleRange: '1 - 6', femaleRange: '1 - 6', defaultRange: '1 - 6' },
              { id: 'monocytes', name: 'Monocytes', unit: '%', maleRange: '2 - 8', femaleRange: '2 - 8', defaultRange: '2 - 8' },
              { id: 'basophils', name: 'Basophils', unit: '%', maleRange: '0 - 1', femaleRange: '0 - 1', defaultRange: '0 - 1' },
              { id: 'platelets', name: 'Platelet Count', unit: 'lakhs/cu.mm', maleRange: '1.5 - 4.5', femaleRange: '1.5 - 4.5', defaultRange: '1.5 - 4.5' },
              { id: 'pcv', name: 'Packed Cell Volume (PCV)', unit: '%', maleRange: '40 - 50', femaleRange: '36 - 46', defaultRange: '36 - 50' },
              { id: 'mcv', name: 'Mean Corpuscular Volume (MCV)', unit: 'fL', maleRange: '80 - 100', femaleRange: '80 - 100', defaultRange: '80 - 100' },
              { id: 'esr', name: 'ESR (Westergren Method)', unit: 'mm/1st hr', maleRange: '0 - 15', femaleRange: '0 - 20', defaultRange: '0 - 20' }
            ]
          },
          {
            id: 'LAB-LFT',
            name: 'Liver Function Test (LFT Profile)',
            code: 'LFT',
            category: 'Biochemistry',
            rate: 650,
            sampleType: 'Blood (Serum)',
            turnaroundTime: '4-6 Hours',
            description: 'Comprehensive liver enzymes, bilirubin fractions, total protein, and albumin',
            parameters: [
              { id: 'bili_tot', name: 'Bilirubin Total', unit: 'mg/dL', maleRange: '0.2 - 1.2', femaleRange: '0.2 - 1.2', defaultRange: '0.2 - 1.2' },
              { id: 'bili_dir', name: 'Bilirubin Direct', unit: 'mg/dL', maleRange: '0.0 - 0.3', femaleRange: '0.0 - 0.3', defaultRange: '0.0 - 0.3' },
              { id: 'bili_ind', name: 'Bilirubin Indirect', unit: 'mg/dL', maleRange: '0.2 - 0.9', femaleRange: '0.2 - 0.9', defaultRange: '0.2 - 0.9' },
              { id: 'sgot', name: 'SGOT / AST', unit: 'U/L', maleRange: '5 - 40', femaleRange: '5 - 35', defaultRange: '5 - 40' },
              { id: 'sgpt', name: 'SGPT / ALT', unit: 'U/L', maleRange: '7 - 56', femaleRange: '7 - 45', defaultRange: '7 - 56' },
              { id: 'alp', name: 'Alkaline Phosphatase (ALP)', unit: 'U/L', maleRange: '44 - 147', femaleRange: '44 - 147', defaultRange: '44 - 147' },
              { id: 'tot_prot', name: 'Total Protein', unit: 'g/dL', maleRange: '6.0 - 8.3', femaleRange: '6.0 - 8.3', defaultRange: '6.0 - 8.3' },
              { id: 'albumin', name: 'Serum Albumin', unit: 'g/dL', maleRange: '3.5 - 5.0', femaleRange: '3.5 - 5.0', defaultRange: '3.5 - 5.0' },
              { id: 'globulin', name: 'Serum Globulin', unit: 'g/dL', maleRange: '2.0 - 3.5', femaleRange: '2.0 - 3.5', defaultRange: '2.0 - 3.5' },
              { id: 'ag_ratio', name: 'A/G Ratio', unit: 'ratio', maleRange: '1.2 - 2.2', femaleRange: '1.2 - 2.2', defaultRange: '1.2 - 2.2' }
            ]
          },
          {
            id: 'LAB-KFT',
            name: 'Kidney Function Test (KFT / RFT with Electrolytes)',
            code: 'KFT',
            category: 'Biochemistry',
            rate: 600,
            sampleType: 'Blood (Serum)',
            turnaroundTime: '4-6 Hours',
            description: 'Renal panel including Serum Creatinine, Urea, Uric Acid, Calcium, and Electrolytes',
            parameters: [
              { id: 'urea', name: 'Blood Urea', unit: 'mg/dL', maleRange: '15 - 45', femaleRange: '15 - 45', defaultRange: '15 - 45' },
              { id: 'creatinine', name: 'Serum Creatinine', unit: 'mg/dL', maleRange: '0.7 - 1.3', femaleRange: '0.6 - 1.1', defaultRange: '0.6 - 1.3' },
              { id: 'bun', name: 'Blood Urea Nitrogen (BUN)', unit: 'mg/dL', maleRange: '7 - 20', femaleRange: '7 - 20', defaultRange: '7 - 20' },
              { id: 'uric_acid', name: 'Serum Uric Acid', unit: 'mg/dL', maleRange: '3.5 - 7.2', femaleRange: '2.6 - 6.0', defaultRange: '2.6 - 7.2' },
              { id: 'calcium', name: 'Serum Calcium', unit: 'mg/dL', maleRange: '8.5 - 10.5', femaleRange: '8.5 - 10.5', defaultRange: '8.5 - 10.5' },
              { id: 'sodium', name: 'Serum Sodium (Na+)', unit: 'mEq/L', maleRange: '135 - 145', femaleRange: '135 - 145', defaultRange: '135 - 145' },
              { id: 'potassium', name: 'Serum Potassium (K+)', unit: 'mEq/L', maleRange: '3.5 - 5.1', femaleRange: '3.5 - 5.1', defaultRange: '3.5 - 5.1' }
            ]
          },
          {
            id: 'LAB-LIPID',
            name: 'Lipid Profile (Fasting)',
            code: 'LIPID',
            category: 'Biochemistry',
            rate: 550,
            sampleType: 'Blood (Serum - 12h Fasting)',
            turnaroundTime: '4-6 Hours',
            description: 'Cardiovascular risk assessment including Total Cholesterol, HDL, LDL, VLDL, and Triglycerides',
            parameters: [
              { id: 'chol_tot', name: 'Total Cholesterol', unit: 'mg/dL', maleRange: '< 200', femaleRange: '< 200', defaultRange: '< 200 (Desirable)' },
              { id: 'triglycerides', name: 'Serum Triglycerides', unit: 'mg/dL', maleRange: '< 150', femaleRange: '< 150', defaultRange: '< 150 (Normal)' },
              { id: 'hdl', name: 'HDL Cholesterol (Good)', unit: 'mg/dL', maleRange: '> 40', femaleRange: '> 50', defaultRange: '> 40 (Optimal)' },
              { id: 'ldl', name: 'LDL Cholesterol (Bad)', unit: 'mg/dL', maleRange: '< 100', femaleRange: '< 100', defaultRange: '< 100 (Optimal)' },
              { id: 'vldl', name: 'VLDL Cholesterol', unit: 'mg/dL', maleRange: '5 - 30', femaleRange: '5 - 30', defaultRange: '5 - 30' },
              { id: 'chol_hdl_ratio', name: 'Total Chol / HDL Ratio', unit: 'ratio', maleRange: '3.3 - 4.4', femaleRange: '3.3 - 4.4', defaultRange: '3.3 - 4.4' }
            ]
          },
          {
            id: 'LAB-SUGAR',
            name: 'Blood Glucose (Fasting & PPBS)',
            code: 'BSF-PP',
            category: 'Biochemistry',
            rate: 150,
            sampleType: 'Blood (Fluoride)',
            turnaroundTime: '1-2 Hours',
            description: 'Fasting and 2-Hour Post-Prandial Plasma Glucose with urine sugar analysis',
            parameters: [
              { id: 'fbs', name: 'Fasting Blood Sugar (FBS)', unit: 'mg/dL', maleRange: '70 - 100', femaleRange: '70 - 100', defaultRange: '70 - 100 (Normal)' },
              { id: 'ppbs', name: 'Post-Prandial Blood Sugar (PPBS)', unit: 'mg/dL', maleRange: '< 140', femaleRange: '< 140', defaultRange: '< 140 (Normal)' },
              { id: 'urine_sugar', name: 'Urine Glucose (Qualitative)', unit: 'qualitative', maleRange: 'Nil', femaleRange: 'Nil', defaultRange: 'Nil' }
            ]
          },
          {
            id: 'LAB-HBA1C',
            name: 'HbA1c (Glycosylated Hemoglobin)',
            code: 'HBA1C',
            category: 'Biochemistry',
            rate: 450,
            sampleType: 'Blood (EDTA)',
            turnaroundTime: '2-4 Hours',
            description: 'Gold standard 3-month average glycemic control marker with estimated average glucose',
            parameters: [
              { id: 'hba1c_pct', name: 'HbA1c Percentage', unit: '%', maleRange: '< 5.7', femaleRange: '< 5.7', defaultRange: '< 5.7 (Normal), 5.7-6.4 (Prediabetes), >= 6.5 (Diabetes)' },
              { id: 'eag', name: 'Estimated Average Glucose (eAG)', unit: 'mg/dL', maleRange: '90 - 120', femaleRange: '90 - 120', defaultRange: '90 - 120' }
            ]
          },
          {
            id: 'LAB-THYROID',
            name: 'Thyroid Profile (Total T3, T4, TSH)',
            code: 'THYROID',
            category: 'Serology',
            rate: 500,
            sampleType: 'Blood (Serum)',
            turnaroundTime: '6-8 Hours',
            description: 'Evaluation of hyperthyroidism, hypothyroidism, and pituitary-thyroid axis regulation',
            parameters: [
              { id: 't3', name: 'Total Triiodothyronine (T3)', unit: 'ng/dL', maleRange: '80 - 200', femaleRange: '80 - 200', defaultRange: '80 - 200' },
              { id: 't4', name: 'Total Thyroxine (T4)', unit: 'µg/dL', maleRange: '4.5 - 12.0', femaleRange: '4.5 - 12.0', defaultRange: '4.5 - 12.0' },
              { id: 'tsh', name: 'Thyroid Stimulating Hormone (TSH)', unit: 'µIU/mL', maleRange: '0.35 - 4.94', femaleRange: '0.35 - 4.94', defaultRange: '0.35 - 4.94' }
            ]
          },
          {
            id: 'LAB-URINE',
            name: 'Urine Routine & Microscopic (Urine R/M)',
            code: 'URINE-RM',
            category: 'Clinical Pathology',
            rate: 150,
            sampleType: 'Urine (Clean Catch Midstream)',
            turnaroundTime: '1-2 Hours',
            description: 'Physical, chemical, and microscopic examination for renal health, infection, and calculi',
            parameters: [
              { id: 'u_color', name: 'Color & Appearance', unit: 'visual', maleRange: 'Pale Yellow, Clear', femaleRange: 'Pale Yellow, Clear', defaultRange: 'Pale Yellow, Clear' },
              { id: 'u_ph', name: 'pH (Reaction)', unit: 'pH', maleRange: '4.5 - 8.0', femaleRange: '4.5 - 8.0', defaultRange: '4.5 - 8.0' },
              { id: 'u_spgr', name: 'Specific Gravity', unit: 'sp.gr.', maleRange: '1.005 - 1.030', femaleRange: '1.005 - 1.030', defaultRange: '1.005 - 1.030' },
              { id: 'u_protein', name: 'Urine Protein / Albumin', unit: 'semi-quant', maleRange: 'Nil', femaleRange: 'Nil', defaultRange: 'Nil' },
              { id: 'u_sugar', name: 'Urine Sugar', unit: 'semi-quant', maleRange: 'Nil', femaleRange: 'Nil', defaultRange: 'Nil' },
              { id: 'u_ketones', name: 'Ketone Bodies', unit: 'semi-quant', maleRange: 'Negative', femaleRange: 'Negative', defaultRange: 'Negative' },
              { id: 'u_pus', name: 'Pus Cells (WBC)', unit: '/HPF', maleRange: '0 - 5', femaleRange: '0 - 5', defaultRange: '0 - 5' },
              { id: 'u_epi', name: 'Epithelial Cells', unit: '/HPF', maleRange: '0 - 4', femaleRange: '0 - 4', defaultRange: '0 - 4' },
              { id: 'u_rbc', name: 'Red Blood Cells (RBC)', unit: '/HPF', maleRange: 'Nil / Occasional', femaleRange: 'Nil / Occasional', defaultRange: 'Nil / Occasional' },
              { id: 'u_casts', name: 'Casts & Crystals', unit: 'microscopic', maleRange: 'Not Seen', femaleRange: 'Not Seen', defaultRange: 'Not Seen' }
            ]
          },
          {
            id: 'LAB-DENGUE',
            name: 'Dengue Serology (NS1 Ag + IgG / IgM Ab)',
            code: 'DENGUE',
            category: 'Serology',
            rate: 750,
            sampleType: 'Blood (Serum)',
            turnaroundTime: '1-2 Hours',
            description: 'Rapid immuno-chromatographic detection of Dengue NS1 antigen and IgG/IgM antibodies',
            parameters: [
              { id: 'dengue_ns1', name: 'Dengue NS1 Antigen', unit: 'rapid test', maleRange: 'Negative', femaleRange: 'Negative', defaultRange: 'Negative' },
              { id: 'dengue_igm', name: 'Dengue IgM Antibody', unit: 'rapid test', maleRange: 'Negative', femaleRange: 'Negative', defaultRange: 'Negative' },
              { id: 'dengue_igg', name: 'Dengue IgG Antibody', unit: 'rapid test', maleRange: 'Negative', femaleRange: 'Negative', defaultRange: 'Negative' }
            ]
          },
          {
            id: 'LAB-WIDAL',
            name: 'Widal Slide Agglutination (Typhoid Test)',
            code: 'WIDAL',
            category: 'Serology',
            rate: 200,
            sampleType: 'Blood (Serum)',
            turnaroundTime: '1-2 Hours',
            description: 'Serological test for enteric fever (Salmonella enterica serotypes Typhi and Paratyphi)',
            parameters: [
              { id: 'widal_to', name: 'Salmonella Typhi "O" Antigen', unit: 'titer', maleRange: '< 1:80 (Negative)', femaleRange: '< 1:80 (Negative)', defaultRange: '< 1:80 (Negative)' },
              { id: 'widal_th', name: 'Salmonella Typhi "H" Antigen', unit: 'titer', maleRange: '< 1:80 (Negative)', femaleRange: '< 1:80 (Negative)', defaultRange: '< 1:80 (Negative)' },
              { id: 'widal_ah', name: 'Salmonella Paratyphi "AH" Antigen', unit: 'titer', maleRange: '< 1:80 (Negative)', femaleRange: '< 1:80 (Negative)', defaultRange: '< 1:80 (Negative)' },
              { id: 'widal_bh', name: 'Salmonella Paratyphi "BH" Antigen', unit: 'titer', maleRange: '< 1:80 (Negative)', femaleRange: '< 1:80 (Negative)', defaultRange: '< 1:80 (Negative)' }
            ]
          }
        ];

        const insertTest = db.prepare(`
          INSERT INTO lab_tests (id, name, code, category, rate, sampleType, turnaroundTime, parameters, description, isActive, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
        `);

        for (const t of defaultLabTests) {
          insertTest.run(t.id, t.name, t.code, t.category, t.rate, t.sampleType, t.turnaroundTime, JSON.stringify(t.parameters), t.description, seedNow, seedNow);
        }
        console.log('[DB] Pre-seeded 10 standard diagnostic laboratory test profiles');
      }
    } catch (e) {
      console.warn('[DB] Seeding lab tests failed or skipped:', e);
    }

    // Migrations
    try {
      db.exec('ALTER TABLE doctors ADD COLUMN printHeader INTEGER DEFAULT 1;');
    } catch (e) {}
    try {
      db.exec('ALTER TABLE doctors ADD COLUMN customTopMargin INTEGER DEFAULT 0;');
    } catch (e) {}
    try {
      db.exec('ALTER TABLE doctors ADD COLUMN customBottomMargin INTEGER DEFAULT 0;');
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
    try {
      db.exec('ALTER TABLE receipts ADD COLUMN items TEXT;');
    } catch (e) {}
    try {
      db.exec('ALTER TABLE prescriptions ADD COLUMN followUpDate TEXT;');
    } catch (e) {}
    try {
      db.exec('ALTER TABLE prescriptions ADD COLUMN followUpNotes TEXT;');
    } catch (e) {}
    try {
      db.exec('ALTER TABLE prescriptions ADD COLUMN receiptNumber TEXT;');
    } catch (e) {}
    try {
      db.exec('ALTER TABLE prescriptions ADD COLUMN labInvestigations TEXT;');
    } catch (e) {}

    // Follow-ups Migrations
    const followUpCols = [
      'prescriptionId TEXT',
      'receiptId TEXT',
      'patientName TEXT NOT NULL DEFAULT ""',
      'patientPhone TEXT DEFAULT ""',
      'patientAge TEXT',
      'patientGender TEXT',
      'doctorId TEXT NOT NULL DEFAULT ""',
      'doctorName TEXT NOT NULL DEFAULT ""',
      'scheduledDate TEXT NOT NULL DEFAULT ""',
      'notes TEXT',
      'status TEXT DEFAULT "PENDING"',
      'createdAt TEXT'
    ];
    for (const col of followUpCols) {
      try {
        db.exec(`ALTER TABLE follow_ups ADD COLUMN ${col};`);
      } catch (e) {}
    }

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

    // Expenses Migrations
    const expenseCols = [
      'paidAmount REAL DEFAULT 0',
      'dueDate TEXT',
      'vendorPhone TEXT',
      'isRecurring INTEGER DEFAULT 0'
    ];
    for (const col of expenseCols) {
      try {
        db.exec(`ALTER TABLE expenses ADD COLUMN ${col};`);
      } catch (e) {}
    }

    // Patient ID Migrations
    try {
      db.exec('ALTER TABLE receipts ADD COLUMN patientId TEXT;');
    } catch (e) {}
    try {
      db.exec('ALTER TABLE prescriptions ADD COLUMN patientId TEXT;');
    } catch (e) {}
    try {
      db.exec('ALTER TABLE follow_ups ADD COLUMN patientId TEXT;');
    } catch (e) {}
    try {
      db.exec('ALTER TABLE appointments ADD COLUMN patientId TEXT;');
    } catch (e) {}

    // Facility & Inpatient Billing Migrations
    const facilityCols = [
      "billType TEXT DEFAULT 'OPD'",
      "roomNumber TEXT",
      "admissionDate TEXT",
      "dischargeDate TEXT",
      "advancePaid REAL DEFAULT 0",
      "discount REAL DEFAULT 0"
    ];
    for (const col of facilityCols) {
      try {
        db.exec(`ALTER TABLE receipts ADD COLUMN ${col};`);
      } catch (e) {}
    }

    // Services table enhancement for Facility & Inpatient items
    const serviceCols = [
      "category TEXT DEFAULT 'General'",
      "unit TEXT DEFAULT 'Units'",
      "serviceType TEXT DEFAULT 'OPD'"
    ];
    for (const col of serviceCols) {
      try {
        db.exec(`ALTER TABLE services ADD COLUMN ${col};`);
      } catch (e) {}
    }

    try {
      db.exec('ALTER TABLE bed_admissions ADD COLUMN wardChargesLog TEXT;');
    } catch (e) {}
    try {
      db.exec("ALTER TABLE bed_admissions ADD COLUMN billingStatus TEXT DEFAULT 'NONE';");
    } catch (e) {}

    // Seed default facility items if none exist
    try {
      const facCount = (db.prepare("SELECT count(*) as count FROM services WHERE serviceType = 'FACILITY'").get() as any)?.count || 0;
      if (facCount === 0) {
        const seedStmt = db.prepare(`
          INSERT INTO services (id, name, amount, category, unit, serviceType)
          VALUES (@id, @name, @amount, @category, @unit, 'FACILITY')
        `);
        const defaultFacilityItems = [
          { id: 'fac_s_1', name: 'General Ward Bed', amount: 800, category: 'Room Rent', unit: 'Days' },
          { id: 'fac_s_2', name: 'Semi-Private Room', amount: 1500, category: 'Room Rent', unit: 'Days' },
          { id: 'fac_s_3', name: 'Deluxe Private Room', amount: 2500, category: 'Room Rent', unit: 'Days' },
          { id: 'fac_s_4', name: 'ICU / Critical Care Bed', amount: 4500, category: 'Room Rent', unit: 'Days' },
          { id: 'fac_s_5', name: 'Daycare Observation Bed', amount: 600, category: 'Room Rent', unit: 'Hours' },
          { id: 'fac_s_6', name: 'Medical Oxygen (Hourly)', amount: 150, category: 'Oxygen', unit: 'Hours' },
          { id: 'fac_s_7', name: 'Medical Oxygen (24h Flow)', amount: 1200, category: 'Oxygen', unit: 'Days' },
          { id: 'fac_s_8', name: 'Oxygen Cylinder Refill', amount: 650, category: 'Oxygen', unit: 'Cylinders' },
          { id: 'fac_s_9', name: 'Oxygen Concentrator Usage', amount: 400, category: 'Oxygen', unit: 'Days' },
          { id: 'fac_s_10', name: 'General Nursing Care (24h)', amount: 500, category: 'Nursing', unit: 'Days' },
          { id: 'fac_s_11', name: 'Specialized ICU Nursing', amount: 1000, category: 'Nursing', unit: 'Days' },
          { id: 'fac_s_12', name: 'Attendant / DDA Support', amount: 300, category: 'Nursing', unit: 'Days' },
          { id: 'fac_s_13', name: 'In-Patient Doctor Daily Round', amount: 600, category: 'Doctor Rounds', unit: 'Visits' },
          { id: 'fac_s_14', name: 'Specialist Consultant Visit', amount: 1000, category: 'Doctor Rounds', unit: 'Visits' },
          { id: 'fac_s_15', name: 'Emergency RMO Call', amount: 400, category: 'Doctor Rounds', unit: 'Visits' },
          { id: 'fac_s_16', name: 'Multipara Vital Monitor', amount: 500, category: 'Equipment', unit: 'Days' },
          { id: 'fac_s_17', name: 'Pulse Oximeter & BP Monitor', amount: 200, category: 'Equipment', unit: 'Days' },
          { id: 'fac_s_18', name: 'Syringe / Infusion Pump', amount: 350, category: 'Equipment', unit: 'Days' },
          { id: 'fac_s_19', name: 'Nebulizer Therapy Session', amount: 150, category: 'Equipment', unit: 'Sessions' },
          { id: 'fac_s_20', name: 'IV Cannulation & Infusion Setup', amount: 250, category: 'Procedures', unit: 'Procedures' },
          { id: 'fac_s_21', name: 'Surgical Wound Dressing', amount: 300, category: 'Procedures', unit: 'Procedures' },
          { id: 'fac_s_22', name: 'Foley Catheterization', amount: 400, category: 'Procedures', unit: 'Procedures' },
          { id: 'fac_s_23', name: 'Ryle Tube Insertion', amount: 450, category: 'Procedures', unit: 'Procedures' },
          { id: 'fac_s_24', name: 'ECG Recording & Interpretation', amount: 300, category: 'Procedures', unit: 'Tests' }
        ];
        const seedTxn = db.transaction(() => {
          for (const item of defaultFacilityItems) {
            seedStmt.run(item);
          }
        });
        seedTxn();
      }
    } catch (e) {
      console.error('[DB] Failed to seed facility services:', e);
    }

    // Backfill Patient IDs for existing records without one
    try {
      const receiptsWithoutPid = db.prepare("SELECT id, patientName, patientPhone FROM receipts WHERE patientId IS NULL OR patientId = ''").all() as any[];
      if (receiptsWithoutPid.length > 0) {
        const metaRow = db.prepare("SELECT value FROM metadata WHERE key = 'last_patient_id'").get() as { value?: string } | undefined;
        let nextPidNum = metaRow?.value ? (parseInt(metaRow.value.replace(/\D/g, '')) || 1000) : 1000;

        // Build mapping of known patients by phone or name
        const existingWithPid = db.prepare("SELECT patientId, patientName, patientPhone FROM receipts WHERE patientId IS NOT NULL AND patientId != ''").all() as any[];
        const patientMap = new Map<string, string>();
        for (const r of existingWithPid) {
          const key = (r.patientPhone && r.patientPhone.trim()) || (r.patientName && r.patientName.trim().toLowerCase());
          if (key && !patientMap.has(key)) {
            patientMap.set(key, r.patientId);
          }
        }

        const updateReceiptPid = db.prepare("UPDATE receipts SET patientId = ? WHERE id = ?");
        const updatePrescriptionPid = db.prepare("UPDATE prescriptions SET patientId = ? WHERE receiptId = ?");

        const backfillTxn = db.transaction(() => {
          for (const r of receiptsWithoutPid) {
            const key = (r.patientPhone && r.patientPhone.trim()) || (r.patientName && r.patientName.trim().toLowerCase());
            let pid = key ? patientMap.get(key) : undefined;
            if (!pid) {
              nextPidNum++;
              pid = `PID-${nextPidNum}`;
              if (key) patientMap.set(key, pid);
            }
            updateReceiptPid.run(pid, r.id);
            updatePrescriptionPid.run(pid, r.id);
          }
          db.prepare("INSERT OR REPLACE INTO metadata (key, value) VALUES ('last_patient_id', ?)").run(`PID-${nextPidNum}`);
        });
        backfillTxn();
      }
    } catch (err) {
      console.error('[DB] Failed to backfill patient IDs:', err);
    }

    // Performance indexes (CREATE IF NOT EXISTS is idempotent)
    try {
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_receipts_date ON receipts(date);
        CREATE INDEX IF NOT EXISTS idx_receipts_doctorId ON receipts(doctorId);
        CREATE INDEX IF NOT EXISTS idx_receipts_patientId ON receipts(patientId);
        CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointmentDate);
        CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
        CREATE INDEX IF NOT EXISTS idx_appointments_patientId ON appointments(patientId);
        CREATE INDEX IF NOT EXISTS idx_prescriptions_doctorId ON prescriptions(doctorId);
        CREATE INDEX IF NOT EXISTS idx_prescriptions_date ON prescriptions(date);
        CREATE INDEX IF NOT EXISTS idx_prescriptions_patientId ON prescriptions(patientId);
        CREATE INDEX IF NOT EXISTS idx_follow_ups_date ON follow_ups(scheduledDate);
        CREATE INDEX IF NOT EXISTS idx_follow_ups_status ON follow_ups(status);
        CREATE INDEX IF NOT EXISTS idx_follow_ups_doctorId ON follow_ups(doctorId);
        CREATE INDEX IF NOT EXISTS idx_follow_ups_patientId ON follow_ups(patientId);
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
      INSERT OR REPLACE INTO doctors (id, name, specialization, qualifications, phone, address, printHeader, customTopMargin, customBottomMargin, upiId, qrCodeText, showQrCodeOnReceipt)
      VALUES (@id, @name, @specialization, @qualifications, @phone, @address, @printHeader, @customTopMargin, @customBottomMargin, @upiId, @qrCodeText, @showQrCodeOnReceipt)
    `);
    return stmt.run({
      ...doctor,
      printHeader: doctor.printHeader !== false ? 1 : 0,
      customTopMargin: doctor.customTopMargin || 0,
      customBottomMargin: doctor.customBottomMargin || 0,
      upiId: doctor.upiId || '',
      qrCodeText: doctor.qrCodeText || '',
      showQrCodeOnReceipt: doctor.showQrCodeOnReceipt ? 1 : 0
    });
  },
  deleteDoctor: (id: string) => db.prepare('DELETE FROM doctors WHERE id = ?').run(id),

  // Services
  getServices: () => db.prepare('SELECT * FROM services').all(),
  saveService: (service: any) => {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO services (id, name, amount, category, unit, serviceType)
      VALUES (@id, @name, @amount, @category, @unit, @serviceType)
    `);
    return stmt.run({
      id: service.id || crypto.randomUUID(),
      name: service.name,
      amount: typeof service.amount === 'number' ? service.amount : parseFloat(service.amount) || 0,
      category: service.category || 'General',
      unit: service.unit || 'Units',
      serviceType: service.serviceType || 'OPD'
    });
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
      conditions.push("(patientName LIKE @search OR patientPhone LIKE @search OR receiptNumber LIKE @search OR patientId LIKE @search)");
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
  getReceiptById: (id: string) => {
    try {
      const r = db.prepare('SELECT * FROM receipts WHERE id = ?').get(id) as any;
      if (!r) return null;
      return {
        ...r,
        showQrCode: r.showQrCode === 1 ? true : false,
        qrCodeText: r.qrCodeText || '',
        items: JSON.parse(r.items || '[]')
      };
    } catch (e) {
      return null;
    }
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
      INSERT OR REPLACE INTO receipts (
        id, receiptNumber, date, patientId, patientName, patientAge, patientGender, patientPhone,
        doctorId, doctorName, items, total, paymentMethod, showQrCode, qrCodeText,
        billType, roomNumber, admissionDate, dischargeDate, advancePaid, discount
      )
      VALUES (
        @id, @receiptNumber, @date, @patientId, @patientName, @patientAge, @patientGender, @patientPhone,
        @doctorId, @doctorName, @items, @total, @paymentMethod, @showQrCode, @qrCodeText,
        @billType, @roomNumber, @admissionDate, @dischargeDate, @advancePaid, @discount
      )
    `);
    return stmt.run({
      patientAge: '',
      patientGender: 'Male',
      patientPhone: '',
      doctorId: '',
      doctorName: '',
      paymentMethod: 'CASH',
      ...receipt,
      patientId: receipt.patientId || '',
      patientName: String(receipt.patientName).substring(0, 500),
      items: JSON.stringify(receipt.items || []),
      showQrCode: receipt.showQrCode ? 1 : 0,
      qrCodeText: receipt.qrCodeText || '',
      billType: receipt.billType || 'OPD',
      roomNumber: receipt.roomNumber || '',
      admissionDate: receipt.admissionDate || '',
      dischargeDate: receipt.dischargeDate || '',
      advancePaid: typeof receipt.advancePaid === 'number' ? receipt.advancePaid : 0,
      discount: typeof receipt.discount === 'number' ? receipt.discount : 0
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
        patientId = @patientId,
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
        qrCodeText = @qrCodeText,
        billType = @billType,
        roomNumber = @roomNumber,
        admissionDate = @admissionDate,
        dischargeDate = @dischargeDate,
        advancePaid = @advancePaid,
        discount = @discount
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
      patientId: receipt.patientId || '',
      items: JSON.stringify(receipt.items || []),
      showQrCode: receipt.showQrCode ? 1 : 0,
      qrCodeText: receipt.qrCodeText || '',
      billType: receipt.billType || 'OPD',
      roomNumber: receipt.roomNumber || '',
      admissionDate: receipt.admissionDate || '',
      dischargeDate: receipt.dischargeDate || '',
      advancePaid: typeof receipt.advancePaid === 'number' ? receipt.advancePaid : 0,
      discount: typeof receipt.discount === 'number' ? receipt.discount : 0
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
      INSERT OR REPLACE INTO receipts (
        id, receiptNumber, date, patientId, patientName, patientAge, patientGender, patientPhone,
        doctorId, doctorName, items, total, paymentMethod,
        billType, roomNumber, admissionDate, dischargeDate, advancePaid, discount
      )
      VALUES (
        @id, @receiptNumber, @date, @patientId, @patientName, @patientAge, @patientGender, @patientPhone,
        @doctorId, @doctorName, @items, @total, @paymentMethod,
        @billType, @roomNumber, @admissionDate, @dischargeDate, @advancePaid, @discount
      )
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
        patientId: receipt.patientId || '',
        patientName: String(receipt.patientName).substring(0, 500),
        items: JSON.stringify(receipt.items || []),
        billType: receipt.billType || 'OPD',
        roomNumber: receipt.roomNumber || '',
        admissionDate: receipt.admissionDate || '',
        dischargeDate: receipt.dischargeDate || '',
        advancePaid: typeof receipt.advancePaid === 'number' ? receipt.advancePaid : 0,
        discount: typeof receipt.discount === 'number' ? receipt.discount : 0
      });
      metaStmt.run(metaKey, nextNum);
    });
    return txn();
  },

  // Batch import for doctors
  batchImportDoctors: (doctors: any[]) => {
    const insert = db.prepare(`
      INSERT OR IGNORE INTO doctors (id, name, specialization, qualifications, phone, address, printHeader, customTopMargin, customBottomMargin)
      VALUES (@id, @name, @specialization, @qualifications, @phone, @address, @printHeader, @customTopMargin, @customBottomMargin)
    `);
    const transaction = db.transaction((docs: any[]) => {
      for (const doc of docs) {
        insert.run({
          ...doc,
          printHeader: doc.printHeader !== false ? 1 : 0,
          customTopMargin: doc.customTopMargin || 0,
          customBottomMargin: doc.customBottomMargin || 0
        });
      }
    });
    transaction(doctors);
  },

  // Prescriptions
  getPrescriptions: () => {
    const prescriptions = db.prepare(`
      SELECT p.*, COALESCE(p.receiptNumber, r.receiptNumber, '') AS receiptNumber 
      FROM prescriptions p 
      LEFT JOIN receipts r ON p.receiptId = r.id 
      ORDER BY p.date DESC
    `).all() as any[];
    return prescriptions.map(p => {
      let medicines = [];
      try {
        medicines = JSON.parse(p.medicines || '[]');
      } catch (e) {
        console.error('Failed to parse prescription medicines:', p.id, e);
        medicines = [];
      }
      let labInvestigations = [];
      try {
        labInvestigations = JSON.parse(p.labInvestigations || '[]');
      } catch (e) {
        labInvestigations = [];
      }
      return {
        ...p,
        pid: p.receiptNumber || '',
        medicines,
        labInvestigations
      };
    });
  },
  savePrescription: (prescription: any) => {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO prescriptions (id, receiptId, patientId, date, patientName, patientAge, patientGender, patientPhone, doctorId, doctorName, symptoms, diagnosis, medicines, notes, followUpDate, followUpNotes, labInvestigations)
      VALUES (@id, @receiptId, @patientId, @date, @patientName, @patientAge, @patientGender, @patientPhone, @doctorId, @doctorName, @symptoms, @diagnosis, @medicines, @notes, @followUpDate, @followUpNotes, @labInvestigations)
    `);
    return stmt.run({
      receiptId: '',
      receiptNumber: prescription.receiptNumber || prescription.pid || '',
      patientAge: '',
      patientGender: 'Male',
      patientPhone: '',
      doctorId: '',
      doctorName: '',
      symptoms: '',
      diagnosis: '',
      notes: '',
      followUpDate: '',
      followUpNotes: '',
      ...prescription,
      patientId: prescription.patientId || '',
      medicines: JSON.stringify(prescription.medicines || []),
      labInvestigations: JSON.stringify(prescription.labInvestigations || prescription.labTests || [])
    });
  },
  deletePrescription: (id: string) => db.prepare('DELETE FROM prescriptions WHERE id = ?').run(id),

  // Follow-Ups
  getFollowUps: (options?: { limit?: number; offset?: number; search?: string; startDate?: string; endDate?: string; doctorId?: string; status?: string }) => {
    try {
      let query = `
        SELECT * FROM follow_ups
        WHERE 1=1
      `;
      const params: any = {};
      if (options?.doctorId && options.doctorId !== 'ALL') {
        query += ' AND doctorId = @doctorId';
        params.doctorId = options.doctorId;
      }
      if (options?.status && options.status !== 'ALL') {
        query += ' AND status = @status';
        params.status = options.status;
      }
      if (options?.startDate) {
        query += ' AND date(scheduledDate) >= date(@startDate)';
        params.startDate = options.startDate;
      }
      if (options?.endDate) {
        query += ' AND date(scheduledDate) <= date(@endDate)';
        params.endDate = options.endDate;
      }
      if (options?.search) {
        query += ' AND (patientName LIKE @search OR patientPhone LIKE @search OR notes LIKE @search OR patientId LIKE @search)';
        params.search = `%${options.search}%`;
      }
      query += `
        ORDER BY 
          CASE WHEN status = 'PENDING' THEN 0 ELSE 1 END,
          scheduledDate ASC,
          createdAt DESC
      `;
      if (options?.limit) {
        query += ' LIMIT @limit';
        params.limit = options.limit;
        if (options?.offset) {
          query += ' OFFSET @offset';
          params.offset = options.offset;
        }
      }
      return db.prepare(query).all(params);
    } catch (e) {
      console.error('[Database] Error fetching follow-ups:', e);
      return [];
    }
  },
  saveFollowUp: (followUp: any) => {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO follow_ups (
        id, prescriptionId, receiptId, patientId, patientName, patientPhone, patientAge, patientGender,
        doctorId, doctorName, scheduledDate, notes, status, createdAt
      ) VALUES (
        @id, @prescriptionId, @receiptId, @patientId, @patientName, @patientPhone, @patientAge, @patientGender,
        @doctorId, @doctorName, @scheduledDate, @notes, @status, @createdAt
      )
    `);
    const id = followUp.id || ('FU-' + Date.now() + '-' + Math.floor(100 + Math.random() * 900));
    return stmt.run({
      id,
      prescriptionId: followUp.prescriptionId || '',
      receiptId: followUp.receiptId || '',
      patientId: followUp.patientId || '',
      patientName: followUp.patientName || 'Unknown Patient',
      patientPhone: followUp.patientPhone || '',
      patientAge: followUp.patientAge || '',
      patientGender: followUp.patientGender || 'Male',
      doctorId: followUp.doctorId || '',
      doctorName: followUp.doctorName || '',
      scheduledDate: followUp.scheduledDate || new Date().toISOString().split('T')[0],
      notes: followUp.notes || '',
      status: followUp.status || 'PENDING',
      createdAt: followUp.createdAt || new Date().toISOString()
    });
  },
  updateFollowUpStatus: (id: string, status: string) => {
    return db.prepare('UPDATE follow_ups SET status = ? WHERE id = ?').run(status, id);
  },
  deleteFollowUp: (id: string) => db.prepare('DELETE FROM follow_ups WHERE id = ?').run(id),

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
      INSERT OR REPLACE INTO appointments (id, patientId, patientName, patientPhone, patientAge, patientGender, doctorId, doctorName, appointmentDate, appointmentTime, date, timeSlot, notes, rejectionReason, source, status, createdAt)
      VALUES (@id, @patientId, @patientName, @patientPhone, @patientAge, @patientGender, @doctorId, @doctorName, @appointmentDate, @appointmentTime, @date, @timeSlot, @notes, @rejectionReason, @source, @status, @createdAt)
    `);
    return stmt.run({
      id: appointment.id || ('APT-' + Math.floor(100000 + Math.random() * 900000)),
      patientId: appointment.patientId || '',
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
  deleteAppointment: (id: string) => db.prepare('DELETE FROM appointments WHERE id = ?').run(id),

  // Expenses & Clinic Bills
  getExpenses: (options?: { limit?: number; offset?: number; search?: string; category?: string; startDate?: string; endDate?: string }) => {
    try {
      let query = 'SELECT * FROM expenses WHERE 1=1';
      const params: any[] = [];

      if (options?.search) {
        query += ' AND (title LIKE ? OR paidTo LIKE ? OR billNumber LIKE ? OR notes LIKE ?)';
        const term = `%${options.search}%`;
        params.push(term, term, term, term);
      }

      if (options?.category && options.category !== 'ALL') {
        query += ' AND category = ?';
        params.push(options.category);
      }

      if (options?.startDate) {
        query += ' AND date >= ?';
        params.push(options.startDate);
      }

      if (options?.endDate) {
        query += ' AND date <= ?';
        params.push(options.endDate);
      }

      query += ' ORDER BY date DESC, createdAt DESC';

      if (options?.limit) {
        query += ' LIMIT ?';
        params.push(options.limit);
        if (options?.offset) {
          query += ' OFFSET ?';
          params.push(options.offset);
        }
      }

      return db.prepare(query).all(...params);
    } catch (e) {
      console.error('[Database] Error fetching expenses:', e);
      return [];
    }
  },

  saveExpense: (expense: any) => {
    const id = expense.id || ('EXP-' + Math.floor(1000 + Math.random() * 9000));
    const now = new Date().toISOString();
    const amount = Number(expense.amount) || 0;
    const paidAmount = expense.paidAmount !== undefined && expense.paidAmount !== '' ? Number(expense.paidAmount) : amount;
    const status = expense.status || (paidAmount >= amount ? 'PAID' : (paidAmount > 0 ? 'PARTIAL' : 'PENDING'));
    const paymentMode = expense.paymentMode || 'CASH';
    const billNumber = expense.billNumber || id;
    const isRecurring = expense.isRecurring ? 1 : 0;
    const date = expense.date || now.split('T')[0];
    const dueDate = expense.dueDate || date;

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO expenses (id, title, category, amount, paidAmount, date, dueDate, paymentMode, paidTo, vendorPhone, billNumber, isRecurring, status, notes, createdAt, updatedAt)
      VALUES (@id, @title, @category, @amount, @paidAmount, @date, @dueDate, @paymentMode, @paidTo, @vendorPhone, @billNumber, @isRecurring, @status, @notes, @createdAt, @updatedAt)
    `);
    stmt.run({
      id,
      title: expense.title || 'Untitled Expense',
      category: expense.category || 'Utilities & Power',
      amount,
      paidAmount,
      date,
      dueDate,
      paymentMode,
      paidTo: expense.paidTo || '',
      vendorPhone: expense.vendorPhone || '',
      billNumber,
      isRecurring,
      status,
      notes: expense.notes || '',
      createdAt: expense.createdAt || now,
      updatedAt: now
    });
    return {
      id,
      ...expense,
      amount,
      paidAmount,
      date,
      dueDate,
      status,
      paymentMode,
      billNumber,
      isRecurring,
      updatedAt: now
    };
  },

  deleteExpense: (id: string) => db.prepare('DELETE FROM expenses WHERE id = ?').run(id),

  // Pharmacy & Medicine Methods
  getMedicines: (search?: string, category?: string) => {
    try {
      let query = `
        SELECT m.*, 
               COALESCE(SUM(b.quantity), 0) as currentStock,
               MIN(CASE WHEN b.quantity > 0 THEN b.salePrice ELSE NULL END) as minPrice,
               MAX(CASE WHEN b.quantity > 0 THEN b.salePrice ELSE NULL END) as maxPrice
        FROM medicines m
        LEFT JOIN medicine_batches b ON m.id = b.medicineId
      `;
      const where: string[] = [];
      const params: any[] = [];
      if (search && search.trim()) {
        where.push('(m.name LIKE ? OR m.genericName LIKE ? OR m.manufacturer LIKE ? OR m.locationRack LIKE ?)');
        const s = `%${search.trim()}%`;
        params.push(s, s, s, s);
      }
      if (category && category !== 'All') {
        where.push('m.category = ?');
        params.push(category);
      }
      if (where.length > 0) {
        query += ' WHERE ' + where.join(' AND ');
      }
      query += ' GROUP BY m.id ORDER BY m.name ASC';
      return db.prepare(query).all(...params);
    } catch (e) {
      console.error('[Database] getMedicines error:', e);
      return [];
    }
  },

  saveMedicine: (medicine: any) => {
    try {
      const id = medicine.id || ('MED-' + Math.floor(1000 + Math.random() * 9000));
      const now = new Date().toISOString();
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO medicines (id, name, genericName, category, manufacturer, unit, hsnCode, minStockAlert, locationRack, notes, createdAt)
        VALUES (@id, @name, @genericName, @category, @manufacturer, @unit, @hsnCode, @minStockAlert, @locationRack, @notes, @createdAt)
      `);
      stmt.run({
        id,
        name: medicine.name || 'Unnamed Medicine',
        genericName: medicine.genericName || '',
        category: medicine.category || 'Tablet',
        manufacturer: medicine.manufacturer || '',
        unit: medicine.unit || 'Strip',
        hsnCode: medicine.hsnCode || '',
        minStockAlert: Number(medicine.minStockAlert) || 10,
        locationRack: medicine.locationRack || '',
        notes: medicine.notes || '',
        createdAt: medicine.createdAt || now
      });
      return { id, ...medicine, createdAt: medicine.createdAt || now };
    } catch (e) {
      console.error('[Database] saveMedicine error:', e);
      throw e;
    }
  },

  deleteMedicine: (id: string) => {
    try {
      db.prepare('DELETE FROM medicine_batches WHERE medicineId = ?').run(id);
      return db.prepare('DELETE FROM medicines WHERE id = ?').run(id);
    } catch (e) {
      console.error('[Database] deleteMedicine error:', e);
      throw e;
    }
  },

  getMedicineBatches: (medicineId?: string) => {
    try {
      let query = `
        SELECT b.*, m.name as medicineName, m.genericName, m.category, m.unit, m.minStockAlert
        FROM medicine_batches b
        JOIN medicines m ON b.medicineId = m.id
      `;
      const params: any[] = [];
      if (medicineId) {
        query += ' WHERE b.medicineId = ?';
        params.push(medicineId);
      }
      query += ' ORDER BY b.expiryDate ASC';
      return db.prepare(query).all(...params);
    } catch (e) {
      console.error('[Database] getMedicineBatches error:', e);
      return [];
    }
  },

  saveMedicineBatch: (batch: any) => {
    try {
      const id = batch.id || ('BATCH-' + Math.floor(1000 + Math.random() * 9000));
      const now = new Date().toISOString();
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO medicine_batches (id, medicineId, batchNumber, expiryDate, purchaseRate, salePrice, quantity, createdAt)
        VALUES (@id, @medicineId, @batchNumber, @expiryDate, @purchaseRate, @salePrice, @quantity, @createdAt)
      `);
      stmt.run({
        id,
        medicineId: batch.medicineId,
        batchNumber: (batch.batchNumber || '').toUpperCase(),
        expiryDate: batch.expiryDate,
        purchaseRate: Number(batch.purchaseRate) || 0,
        salePrice: Number(batch.salePrice) || 0,
        quantity: Number(batch.quantity) || 0,
        createdAt: batch.createdAt || now
      });
      return { id, ...batch, createdAt: batch.createdAt || now };
    } catch (e) {
      console.error('[Database] saveMedicineBatch error:', e);
      throw e;
    }
  },

  deleteMedicineBatch: (id: string) => {
    return db.prepare('DELETE FROM medicine_batches WHERE id = ?').run(id);
  },

  adjustMedicineStock: (batchId: string, quantityDiff: number) => {
    return db.prepare('UPDATE medicine_batches SET quantity = MAX(0, quantity + ?) WHERE id = ?').run(quantityDiff, batchId);
  },

  getPharmacySales: (options?: any) => {
    try {
      let query = 'SELECT * FROM pharmacy_sales';
      const where: string[] = [];
      const params: any[] = [];
      if (options?.search) {
        where.push('(saleNumber LIKE ? OR patientName LIKE ? OR patientPhone LIKE ? OR patientId LIKE ?)');
        const s = `%${options.search.trim()}%`;
        params.push(s, s, s, s);
      }
      if (options?.startDate) {
        where.push('date >= ?');
        params.push(options.startDate);
      }
      if (options?.endDate) {
        where.push('date <= ?');
        params.push(options.endDate + ' 23:59:59');
      }
      if (where.length > 0) {
        query += ' WHERE ' + where.join(' AND ');
      }
      query += ' ORDER BY date DESC';
      if (options?.limit) {
        query += ` LIMIT ${Number(options.limit)}`;
        if (options?.offset) {
          query += ` OFFSET ${Number(options.offset)}`;
        }
      }
      const rows = db.prepare(query).all(...params);
      return rows.map((r: any) => ({
        ...r,
        items: typeof r.items === 'string' ? JSON.parse(r.items) : (r.items || [])
      }));
    } catch (e) {
      console.error('[Database] getPharmacySales error:', e);
      return [];
    }
  },

  savePharmacySale: (sale: any) => {
    try {
      const now = new Date().toISOString();
      const transaction = db.transaction(() => {
        let saleNumber = sale.saleNumber;
        if (!saleNumber) {
          const meta = db.prepare("SELECT value FROM metadata WHERE key = 'last_pharmacy_sale_num'").get() as { value?: string } | undefined;
          let nextNum = 1001;
          if (meta && meta.value) {
            const parsed = parseInt(meta.value, 10);
            if (!isNaN(parsed)) nextNum = parsed + 1;
          }
          db.prepare("INSERT OR REPLACE INTO metadata (key, value) VALUES ('last_pharmacy_sale_num', ?)").run(nextNum.toString());
          saleNumber = `PH-${nextNum}`;
        }
        const id = sale.id || ('PSALE-' + Math.floor(1000 + Math.random() * 9000));
        const items = typeof sale.items === 'string' ? sale.items : JSON.stringify(sale.items || []);
        const parsedItems = Array.isArray(sale.items) ? sale.items : (typeof sale.items === 'string' ? JSON.parse(sale.items) : []);

        // Deduct batch stocks
        const updateBatchStmt = db.prepare('UPDATE medicine_batches SET quantity = MAX(0, quantity - ?) WHERE id = ?');
        for (const item of parsedItems) {
          const qty = Number(item.quantity) || 0;
          if (item.batchId && qty > 0) {
            updateBatchStmt.run(qty, item.batchId);
          } else if (item.medicineId && qty > 0) {
            const batches = db.prepare('SELECT id, quantity FROM medicine_batches WHERE medicineId = ? AND quantity > 0 ORDER BY expiryDate ASC').all(item.medicineId) as any[];
            let remaining = qty;
            for (const b of batches) {
              if (remaining <= 0) break;
              const deduct = Math.min(b.quantity, remaining);
              updateBatchStmt.run(deduct, b.id);
              remaining -= deduct;
            }
          }
        }

        const stmt = db.prepare(`
          INSERT OR REPLACE INTO pharmacy_sales (id, saleNumber, patientId, patientName, patientPhone, prescriptionId, date, items, subtotal, discount, tax, total, paymentMethod, dispensedBy, notes)
          VALUES (@id, @saleNumber, @patientId, @patientName, @patientPhone, @prescriptionId, @date, @items, @subtotal, @discount, @tax, @total, @paymentMethod, @dispensedBy, @notes)
        `);
        stmt.run({
          id,
          saleNumber,
          patientId: sale.patientId || '',
          patientName: sale.patientName || 'Walk-in Customer',
          patientPhone: sale.patientPhone || '',
          prescriptionId: sale.prescriptionId || '',
          date: sale.date || now,
          items,
          subtotal: Number(sale.subtotal) || 0,
          discount: Number(sale.discount) || 0,
          tax: Number(sale.tax) || 0,
          total: Number(sale.total) || 0,
          paymentMethod: sale.paymentMethod || 'CASH',
          dispensedBy: sale.dispensedBy || '',
          notes: sale.notes || ''
        });

        return {
          ...sale,
          id,
          saleNumber,
          items: parsedItems
        };
      });

      return transaction();
    } catch (e) {
      console.error('[Database] savePharmacySale error:', e);
      throw e;
    }
  },

  deletePharmacySale: (id: string) => db.prepare('DELETE FROM pharmacy_sales WHERE id = ?').run(id),

  getPharmacyDashboardMetrics: () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const next60Days = new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString().split('T')[0];

      const valRow = db.prepare(`
        SELECT COALESCE(SUM(quantity * salePrice), 0) as totalValue,
               COALESCE(SUM(quantity * purchaseRate), 0) as totalCost,
               COALESCE(SUM(quantity), 0) as totalUnits
        FROM medicine_batches
      `).get() as any;

      const formRow = db.prepare('SELECT COUNT(*) as count FROM medicines').get() as any;

      const lowStockRow = db.prepare(`
        SELECT COUNT(*) as count FROM (
          SELECT m.id, m.minStockAlert, COALESCE(SUM(b.quantity), 0) as stock
          FROM medicines m
          LEFT JOIN medicine_batches b ON m.id = b.medicineId
          GROUP BY m.id
          HAVING stock <= m.minStockAlert
        )
      `).get() as any;

      const expiringRow = db.prepare(`
        SELECT COUNT(*) as count FROM medicine_batches
        WHERE expiryDate <= ? AND quantity > 0
      `).get(next60Days) as any;

      const salesRow = db.prepare(`
        SELECT COALESCE(SUM(total), 0) as todaySales,
               COUNT(*) as salesCount
        FROM pharmacy_sales
        WHERE date LIKE ?
      `).get(`${today}%`) as any;

      return {
        totalInventoryValue: valRow?.totalValue || 0,
        totalCostValue: valRow?.totalCost || 0,
        totalUnits: valRow?.totalUnits || 0,
        totalMedicines: formRow?.count || 0,
        lowStockCount: lowStockRow?.count || 0,
        expiringCount: expiringRow?.count || 0,
        todaySales: salesRow?.todaySales || 0,
        todaySalesCount: salesRow?.salesCount || 0
      };
    } catch (e) {
      console.error('[Database] getPharmacyDashboardMetrics error:', e);
      return {
        totalInventoryValue: 0,
        totalCostValue: 0,
        totalUnits: 0,
        totalMedicines: 0,
        lowStockCount: 0,
        expiringCount: 0,
        todaySales: 0,
        todaySalesCount: 0
      };
    }
  },

  // ==================== HOSPITAL IPD (WARDS, BEDS, ADMISSIONS) ====================
  getWards: () => {
    try {
      return db.prepare(`
        SELECT w.*,
               COUNT(b.id) as totalBedsCount,
               SUM(CASE WHEN b.status = 'occupied' THEN 1 ELSE 0 END) as occupiedBedsCount,
               SUM(CASE WHEN b.status = 'available' THEN 1 ELSE 0 END) as availableBedsCount
        FROM wards w
        LEFT JOIN beds b ON w.id = b.wardId
        GROUP BY w.id
        ORDER BY w.name ASC
      `).all();
    } catch (e) {
      console.error('[Database] getWards error:', e);
      return [];
    }
  },

  saveWard: (ward: any) => {
    const id = ward.id || `WARD-${Date.now().toString(36).toUpperCase()}`;
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO wards (id, name, code, floor, dailyRate, nursingRate, totalBeds, description, isActive, createdAt, updatedAt)
      VALUES (@id, @name, @code, @floor, @dailyRate, @nursingRate, @totalBeds, @description, @isActive, COALESCE(@createdAt, @now), @now)
    `);
    stmt.run({
      id,
      name: ward.name || 'General Ward',
      code: ward.code || 'GW',
      floor: ward.floor || 'Ground Floor',
      dailyRate: Number(ward.dailyRate) || 0,
      nursingRate: Number(ward.nursingRate) || 0,
      totalBeds: Number(ward.totalBeds) || 0,
      description: ward.description || '',
      isActive: ward.isActive !== undefined ? (ward.isActive ? 1 : 0) : 1,
      createdAt: ward.createdAt || now,
      now
    });
    return { id, ...ward };
  },

  deleteWard: (id: string) => db.prepare('DELETE FROM wards WHERE id = ?').run(id),

  getBeds: (wardId?: string) => {
    try {
      let query = `
        SELECT b.*,
               w.name as wardName,
               w.code as wardCode,
               w.floor as wardFloor,
               a.admissionNumber,
               a.patientId,
               a.patientUhid,
               a.patientName,
               a.patientPhone,
               a.patientGender,
               a.patientAge,
               a.doctorId,
               a.doctorName,
               a.admittedAt,
               a.diagnosis,
               a.advancePaid,
               a.initialVitals,
               a.vitalsLog
        FROM beds b
        JOIN wards w ON b.wardId = w.id
        LEFT JOIN bed_admissions a ON b.currentAdmissionId = a.id
      `;
      if (wardId) {
        query += ` WHERE b.wardId = ? ORDER BY b.bedNumber ASC`;
        return db.prepare(query).all(wardId);
      } else {
        query += ` ORDER BY w.name ASC, b.bedNumber ASC`;
        return db.prepare(query).all();
      }
    } catch (e) {
      console.error('[Database] getBeds error:', e);
      return [];
    }
  },

  saveBed: (bed: any) => {
    const id = bed.id || `BED-${bed.bedNumber || Date.now().toString(36).toUpperCase()}`;
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO beds (id, wardId, bedNumber, bedType, dailyRate, status, currentAdmissionId, notes, updatedAt)
      VALUES (@id, @wardId, @bedNumber, @bedType, @dailyRate, @status, @currentAdmissionId, @notes, @now)
    `);
    stmt.run({
      id,
      wardId: bed.wardId,
      bedNumber: bed.bedNumber,
      bedType: bed.bedType || 'Standard',
      dailyRate: Number(bed.dailyRate) || 0,
      status: bed.status || 'available',
      currentAdmissionId: bed.currentAdmissionId || null,
      notes: bed.notes || '',
      now
    });
    return { id, ...bed };
  },

  deleteBed: (id: string) => db.prepare('DELETE FROM beds WHERE id = ?').run(id),

  updateBedStatus: (bedId: string, status: string) => {
    const now = new Date().toISOString();
    if (status === 'available') {
      return db.prepare('UPDATE beds SET status = ?, currentAdmissionId = NULL, updatedAt = ? WHERE id = ?').run(status, now, bedId);
    }
    return db.prepare('UPDATE beds SET status = ?, updatedAt = ? WHERE id = ?').run(status, now, bedId);
  },

  getBedAdmissions: (options?: { status?: string; billingStatus?: string; patientId?: string; limit?: number }) => {
    try {
      let query = `SELECT * FROM bed_admissions WHERE 1=1`;
      const params: any[] = [];
      if (options?.status) {
        query += ` AND status = ?`;
        params.push(options.status);
      }
      if (options?.billingStatus) {
        query += ` AND billingStatus = ?`;
        params.push(options.billingStatus);
      }
      if (options?.patientId) {
        query += ` AND (patientId = ? OR patientUhid = ?)`;
        params.push(options.patientId, options.patientId);
      }
      query += ` ORDER BY admittedAt DESC`;
      if (options?.limit) {
        query += ` LIMIT ?`;
        params.push(options.limit);
      }
      return db.prepare(query).all(...params);
    } catch (e) {
      console.error('[Database] getBedAdmissions error:', e);
      return [];
    }
  },

  admitPatientToBed: (data: any) => {
    try {
      const transaction = db.transaction(() => {
        // Get next admission number atomically
        const metaRow = db.prepare("SELECT value FROM metadata WHERE key = 'last_admission_num'").get() as any;
        let nextNum = 1001;
        if (metaRow && metaRow.value) {
          nextNum = parseInt(metaRow.value, 10) + 1;
        }
        db.prepare("INSERT OR REPLACE INTO metadata (key, value) VALUES ('last_admission_num', ?)").run(nextNum.toString());

        const admissionId = `ADM-${nextNum}`;
        const now = new Date().toISOString();
        const admittedAt = data.admittedAt || now;

        const wardRow = db.prepare('SELECT name FROM wards WHERE id = ?').get(data.wardId) as any;
        const bedRow = db.prepare('SELECT bedNumber FROM beds WHERE id = ?').get(data.bedId) as any;

        const wardName = data.wardName || (wardRow ? wardRow.name : '');
        const bedNumber = data.bedNumber || (bedRow ? bedRow.bedNumber : '');

        const initialVitals = typeof data.initialVitals === 'object' ? JSON.stringify(data.initialVitals) : (data.initialVitals || '{}');
        const vitalsLog = typeof data.vitalsLog === 'object' ? JSON.stringify(data.vitalsLog) : (data.vitalsLog || '[]');
        const wardChargesLog = typeof data.wardChargesLog === 'object' ? JSON.stringify(data.wardChargesLog) : (data.wardChargesLog || '[]');

        const stmt = db.prepare(`
          INSERT INTO bed_admissions (
            id, admissionNumber, patientId, patientUhid, patientName, patientPhone, patientGender, patientAge,
            wardId, wardName, bedId, bedNumber, doctorId, doctorName, admittedAt, expectedDischargeAt,
            diagnosis, initialVitals, vitalsLog, wardChargesLog, advancePaid, paymentMode, status, notes, transfersLog, createdAt, updatedAt
          ) VALUES (
            @id, @admissionNumber, @patientId, @patientUhid, @patientName, @patientPhone, @patientGender, @patientAge,
            @wardId, @wardName, @bedId, @bedNumber, @doctorId, @doctorName, @admittedAt, @expectedDischargeAt,
            @diagnosis, @initialVitals, @vitalsLog, @wardChargesLog, @advancePaid, @paymentMode, 'admitted', @notes, '[]', @now, @now
          )
        `);

        stmt.run({
          id: admissionId,
          admissionNumber: admissionId,
          patientId: data.patientId || '',
          patientUhid: data.patientUhid || data.patientId || '',
          patientName: data.patientName || '',
          patientPhone: data.patientPhone || '',
          patientGender: data.patientGender || '',
          patientAge: data.patientAge || '',
          wardId: data.wardId,
          wardName,
          bedId: data.bedId,
          bedNumber,
          doctorId: data.doctorId || '',
          doctorName: data.doctorName || '',
          admittedAt,
          expectedDischargeAt: data.expectedDischargeAt || '',
          diagnosis: data.diagnosis || '',
          initialVitals,
          vitalsLog,
          wardChargesLog,
          advancePaid: Number(data.advancePaid) || 0,
          paymentMode: data.paymentMode || 'CASH',
          notes: data.notes || '',
          now
        });

        // Mark bed as occupied
        db.prepare('UPDATE beds SET status = ?, currentAdmissionId = ?, updatedAt = ? WHERE id = ?')
          .run('occupied', admissionId, now, data.bedId);

        return {
          id: admissionId,
          admissionNumber: admissionId,
          ...data,
          wardName,
          bedNumber,
          status: 'admitted',
          createdAt: now
        };
      });

      return transaction();
    } catch (e) {
      console.error('[Database] admitPatientToBed error:', e);
      throw e;
    }
  },

  transferPatientBed: (admissionId: string, newBedId: string, reason?: string) => {
    try {
      const transaction = db.transaction(() => {
        const admission = db.prepare('SELECT * FROM bed_admissions WHERE id = ?').get(admissionId) as any;
        if (!admission) throw new Error(`Admission ${admissionId} not found`);

        const oldBedId = admission.bedId;
        const newBed = db.prepare('SELECT b.*, w.name as wardName FROM beds b JOIN wards w ON b.wardId = w.id WHERE b.id = ?').get(newBedId) as any;
        if (!newBed) throw new Error(`Destination bed ${newBedId} not found`);
        if (newBed.status === 'occupied') throw new Error(`Destination bed ${newBed.bedNumber} is currently occupied`);

        const now = new Date().toISOString();

        // 1. Mark previous bed as cleaning and clear currentAdmissionId
        db.prepare('UPDATE beds SET status = ?, currentAdmissionId = NULL, updatedAt = ? WHERE id = ?')
          .run('cleaning', now, oldBedId);

        // 2. Mark new bed as occupied with current admission
        db.prepare('UPDATE beds SET status = ?, currentAdmissionId = ?, updatedAt = ? WHERE id = ?')
          .run('occupied', admissionId, now, newBedId);

        // 3. Update admission transfers log
        let existingTransfers: any[] = [];
        try {
          existingTransfers = JSON.parse(admission.transfersLog || '[]');
        } catch (_) {}

        existingTransfers.push({
          fromBedId: oldBedId,
          fromBedNumber: admission.bedNumber,
          fromWardName: admission.wardName,
          toBedId: newBedId,
          toBedNumber: newBed.bedNumber,
          toWardName: newBed.wardName,
          transferredAt: now,
          reason: reason || 'Bed transfer request'
        });

        db.prepare(`
          UPDATE bed_admissions
          SET bedId = ?, bedNumber = ?, wardId = ?, wardName = ?, transfersLog = ?, updatedAt = ?
          WHERE id = ?
        `).run(newBedId, newBed.bedNumber, newBed.wardId, newBed.wardName, JSON.stringify(existingTransfers), now, admissionId);

        return { success: true, newBedNumber: newBed.bedNumber, wardName: newBed.wardName };
      });

      return transaction();
    } catch (e) {
      console.error('[Database] transferPatientBed error:', e);
      throw e;
    }
  },

  updateAdmissionBillingStatus: (admissionId: string, billingStatus: string, dischargeSummary?: string) => {
    try {
      const now = new Date().toISOString();
      if (dischargeSummary !== undefined && dischargeSummary.trim() !== '') {
        db.prepare('UPDATE bed_admissions SET billingStatus = ?, dischargeSummary = ?, updatedAt = ? WHERE id = ?')
          .run(billingStatus, dischargeSummary, now, admissionId);
      } else {
        db.prepare('UPDATE bed_admissions SET billingStatus = ?, updatedAt = ? WHERE id = ?')
          .run(billingStatus, now, admissionId);
      }
      return { success: true };
    } catch (e) {
      console.error('[Database] updateAdmissionBillingStatus error:', e);
      throw e;
    }
  },

  dischargePatientAdmission: (admissionId: string, data?: { dischargeSummary?: string; receiptId?: string; makeBedCleaning?: boolean; billingStatus?: string }) => {
    try {
      const transaction = db.transaction(() => {
        const admission = db.prepare('SELECT * FROM bed_admissions WHERE id = ?').get(admissionId) as any;
        if (!admission) throw new Error(`Admission ${admissionId} not found`);

        const now = new Date().toISOString();
        const dischargeSummary = data?.dischargeSummary || admission.dischargeSummary || 'Discharged';
        const totalBillId = data?.receiptId || admission.totalBillId || null;
        const billingStatus = data?.billingStatus || (totalBillId ? 'BILLED' : (admission.billingStatus || 'NONE'));

        // 1. Update admission status
        db.prepare(`
          UPDATE bed_admissions
          SET status = 'discharged', billingStatus = ?, dischargedAt = ?, dischargeSummary = ?, totalBillId = ?, updatedAt = ?
          WHERE id = ?
        `).run(billingStatus, now, dischargeSummary, totalBillId, now, admissionId);

        // 2. Release bed to 'cleaning' status (ready for sanitization)
        const nextBedStatus = data?.makeBedCleaning !== false ? 'cleaning' : 'available';
        db.prepare('UPDATE beds SET status = ?, currentAdmissionId = NULL, updatedAt = ? WHERE id = ?')
          .run(nextBedStatus, now, admission.bedId);

        return { success: true, dischargedAt: now };
      });

      return transaction();
    } catch (e) {
      console.error('[Database] dischargePatientAdmission error:', e);
      throw e;
    }
  },

  addAdmissionVital: (admissionId: string, vital: any) => {
    try {
      const admission = db.prepare('SELECT vitalsLog FROM bed_admissions WHERE id = ?').get(admissionId) as any;
      if (!admission) throw new Error(`Admission ${admissionId} not found`);

      let log: any[] = [];
      try {
        log = JSON.parse(admission.vitalsLog || '[]');
      } catch (_) {}

      const recordedVital = {
        id: `VIT-${Date.now()}`,
        recordedAt: new Date().toISOString(),
        ...vital
      };

      log.unshift(recordedVital); // latest first
      db.prepare('UPDATE bed_admissions SET vitalsLog = ?, updatedAt = ? WHERE id = ?')
        .run(JSON.stringify(log), new Date().toISOString(), admissionId);

      return { success: true, vital: recordedVital };
    } catch (e) {
      console.error('[Database] addAdmissionVital error:', e);
      throw e;
    }
  },

  addAdmissionCharge: (admissionId: string, charge: any) => {
    try {
      const admission = db.prepare('SELECT wardChargesLog FROM bed_admissions WHERE id = ?').get(admissionId) as any;
      if (!admission) throw new Error(`Admission ${admissionId} not found`);

      let log: any[] = [];
      try {
        log = JSON.parse(admission.wardChargesLog || '[]');
      } catch (_) {}

      const recordedCharge = {
        id: `CHG-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        recordedAt: new Date().toISOString(),
        ...charge
      };

      log.unshift(recordedCharge);
      db.prepare('UPDATE bed_admissions SET wardChargesLog = ?, updatedAt = ? WHERE id = ?')
        .run(JSON.stringify(log), new Date().toISOString(), admissionId);

      return { success: true, charge: recordedCharge };
    } catch (e) {
      console.error('[Database] addAdmissionCharge error:', e);
      throw e;
    }
  },

  deleteAdmissionCharge: (admissionId: string, chargeId: string) => {
    try {
      const admission = db.prepare('SELECT wardChargesLog FROM bed_admissions WHERE id = ?').get(admissionId) as any;
      if (!admission) throw new Error(`Admission ${admissionId} not found`);

      let log: any[] = [];
      try {
        log = JSON.parse(admission.wardChargesLog || '[]');
      } catch (_) {}

      log = log.filter((c: any) => c.id !== chargeId);
      db.prepare('UPDATE bed_admissions SET wardChargesLog = ?, updatedAt = ? WHERE id = ?')
        .run(JSON.stringify(log), new Date().toISOString(), admissionId);

      return { success: true };
    } catch (e) {
      console.error('[Database] deleteAdmissionCharge error:', e);
      throw e;
    }
  },

  getIpdDashboardMetrics: () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const bedStats = db.prepare(`
        SELECT
          COUNT(*) as totalBeds,
          SUM(CASE WHEN status = 'occupied' THEN 1 ELSE 0 END) as occupiedBeds,
          SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as availableBeds,
          SUM(CASE WHEN status = 'cleaning' THEN 1 ELSE 0 END) as cleaningBeds,
          SUM(CASE WHEN status = 'maintenance' THEN 1 ELSE 0 END) as maintenanceBeds
        FROM beds
      `).get() as any;

      const totalBeds = bedStats?.totalBeds || 0;
      const occupiedBeds = bedStats?.occupiedBeds || 0;
      const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

      const admTodayRow = db.prepare('SELECT COUNT(*) as count FROM bed_admissions WHERE admittedAt LIKE ?').get(`${today}%`) as any;
      const disTodayRow = db.prepare('SELECT COUNT(*) as count FROM bed_admissions WHERE dischargedAt LIKE ?').get(`${today}%`) as any;

      return {
        totalBeds,
        occupiedBeds,
        availableBeds: bedStats?.availableBeds || 0,
        cleaningBeds: bedStats?.cleaningBeds || 0,
        maintenanceBeds: bedStats?.maintenanceBeds || 0,
        occupancyRate,
        admissionsTodayCount: admTodayRow?.count || 0,
        dischargesTodayCount: disTodayRow?.count || 0
      };
    } catch (e) {
      console.error('[Database] getIpdDashboardMetrics error:', e);
      return {
        totalBeds: 0,
        occupiedBeds: 0,
        availableBeds: 0,
        cleaningBeds: 0,
        maintenanceBeds: 0,
        occupancyRate: 0,
        admissionsTodayCount: 0,
        dischargesTodayCount: 0
      };
    }
  },

  // ==========================================
  // LABORATORY & DIAGNOSTICS MODULE
  // ==========================================
  getLabTests: (category?: string) => {
    try {
      let query = 'SELECT * FROM lab_tests WHERE isActive = 1';
      const params: any[] = [];
      if (category && category !== 'ALL') {
        query += ' AND category = ?';
        params.push(category);
      }
      query += ' ORDER BY name ASC';
      const rows = db.prepare(query).all(...params) as any[];
      return rows.map(r => ({
        ...r,
        parameters: typeof r.parameters === 'string' ? JSON.parse(r.parameters || '[]') : (r.parameters || [])
      }));
    } catch (e) {
      console.error('[Database] getLabTests error:', e);
      return [];
    }
  },

  saveLabTest: (test: any) => {
    try {
      const now = new Date().toISOString();
      const id = test.id || `TEST-${Date.now()}`;
      const paramsJson = JSON.stringify(test.parameters || []);

      const stmt = db.prepare(`
        INSERT OR REPLACE INTO lab_tests
        (id, name, code, category, rate, sampleType, turnaroundTime, parameters, description, isActive, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT createdAt FROM lab_tests WHERE id = ?), ?), ?)
      `);

      stmt.run(
        id,
        test.name,
        test.code || id,
        test.category || 'General',
        Number(test.rate) || 0,
        test.sampleType || 'Blood (EDTA)',
        test.turnaroundTime || '2-4 Hours',
        paramsJson,
        test.description || '',
        test.isActive !== false ? 1 : 0,
        id,
        now,
        now
      );

      return { success: true, id };
    } catch (e) {
      console.error('[Database] saveLabTest error:', e);
      throw e;
    }
  },

  deleteLabTest: (id: string) => {
    try {
      db.prepare('UPDATE lab_tests SET isActive = 0, updatedAt = ? WHERE id = ?')
        .run(new Date().toISOString(), id);
      return { success: true };
    } catch (e) {
      console.error('[Database] deleteLabTest error:', e);
      throw e;
    }
  },

  getNextLabOrderNumber: () => {
    try {
      const metaRow = db.prepare("SELECT value FROM metadata WHERE key = 'last_lab_order_num'").get() as any;
      let nextNum = 1001;
      if (metaRow && metaRow.value) {
        const parsed = parseInt(metaRow.value, 10);
        if (!isNaN(parsed)) nextNum = parsed + 1;
      }
      return `LAB-${nextNum}`;
    } catch (e) {
      console.error('[Database] getNextLabOrderNumber error:', e);
      return `LAB-${Date.now().toString().slice(-4)}`;
    }
  },

  getLabOrders: () => {
    try {
      const rows = db.prepare('SELECT * FROM lab_orders ORDER BY createdAt DESC').all() as any[];
      return rows.map(r => ({
        ...r,
        tests: typeof r.tests === 'string' ? JSON.parse(r.tests || '[]') : (r.tests || [])
      }));
    } catch (e) {
      console.error('[Database] getLabOrders error:', e);
      return [];
    }
  },

  getLabOrderById: (id: string) => {
    try {
      const row = db.prepare('SELECT * FROM lab_orders WHERE id = ?').get(id) as any;
      if (!row) return null;
      return {
        ...row,
        tests: typeof row.tests === 'string' ? JSON.parse(row.tests || '[]') : (row.tests || [])
      };
    } catch (e) {
      console.error('[Database] getLabOrderById error:', e);
      return null;
    }
  },

  saveLabOrder: (order: any) => {
    try {
      const now = new Date().toISOString();
      const id = order.id || `LABORD-${Date.now()}`;
      let orderNumber = order.orderNumber;

      if (!orderNumber) {
        const metaRow = db.prepare("SELECT value FROM metadata WHERE key = 'last_lab_order_num'").get() as any;
        let nextNum = 1001;
        if (metaRow && metaRow.value) {
          const parsed = parseInt(metaRow.value, 10);
          if (!isNaN(parsed)) nextNum = parsed + 1;
        }
        db.prepare("INSERT OR REPLACE INTO metadata (key, value) VALUES ('last_lab_order_num', ?)").run(nextNum.toString());
        orderNumber = `LAB-${nextNum}`;
      }

      const testsJson = JSON.stringify(order.tests || []);

      const stmt = db.prepare(`
        INSERT OR REPLACE INTO lab_orders (
          id, orderNumber, patientId, patientName, patientPhone, patientGender, patientAge,
          doctorId, doctorName, prescriptionId, tests, totalAmount, discount, paidAmount,
          paymentMode, status, sampleCollectedAt, sampleCollectedBy, completedAt,
          technicianNotes, pathologistRemarks, orderDate, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT createdAt FROM lab_orders WHERE id = ?), ?), ?)
      `);

      stmt.run(
        id,
        orderNumber,
        order.patientId || '',
        order.patientName,
        order.patientPhone || '',
        order.patientGender || '',
        order.patientAge || '',
        order.doctorId || '',
        order.doctorName || 'Self / Walk-in',
        order.prescriptionId || '',
        testsJson,
        Number(order.totalAmount) || 0,
        Number(order.discount) || 0,
        Number(order.paidAmount) || 0,
        order.paymentMode || 'CASH',
        order.status || 'ORDERED',
        order.sampleCollectedAt || null,
        order.sampleCollectedBy || '',
        order.completedAt || null,
        order.technicianNotes || '',
        order.pathologistRemarks || '',
        order.orderDate || now.split('T')[0],
        id,
        now,
        now
      );

      return { success: true, id, orderNumber };
    } catch (e) {
      console.error('[Database] saveLabOrder error:', e);
      throw e;
    }
  },

  updateLabOrderStatus: (id: string, status: string, details?: any) => {
    try {
      const now = new Date().toISOString();
      const current = db.prepare('SELECT * FROM lab_orders WHERE id = ?').get(id) as any;
      if (!current) throw new Error(`Lab order ${id} not found`);

      let sampleCollectedAt = current.sampleCollectedAt;
      let sampleCollectedBy = current.sampleCollectedBy;
      let completedAt = current.completedAt;
      const technicianNotes = details?.technicianNotes !== undefined ? details.technicianNotes : current.technicianNotes;
      const pathologistRemarks = details?.pathologistRemarks !== undefined ? details.pathologistRemarks : current.pathologistRemarks;

      if (status === 'SAMPLE_COLLECTED' && !sampleCollectedAt) {
        sampleCollectedAt = details?.sampleCollectedAt || now;
        sampleCollectedBy = details?.sampleCollectedBy || 'Laboratory Desk';
      }
      if (status === 'COMPLETED' && !completedAt) {
        completedAt = now;
      }

      db.prepare(`
        UPDATE lab_orders SET
          status = ?,
          sampleCollectedAt = ?,
          sampleCollectedBy = ?,
          completedAt = ?,
          technicianNotes = ?,
          pathologistRemarks = ?,
          updatedAt = ?
        WHERE id = ?
      `).run(
        status,
        sampleCollectedAt,
        sampleCollectedBy,
        completedAt,
        technicianNotes,
        pathologistRemarks,
        now,
        id
      );

      return { success: true };
    } catch (e) {
      console.error('[Database] updateLabOrderStatus error:', e);
      throw e;
    }
  },

  saveLabOrderResults: (id: string, testsWithResults: any[], pathologistRemarks?: string) => {
    try {
      const now = new Date().toISOString();
      const testsJson = JSON.stringify(testsWithResults || []);
      const allDone = testsWithResults.every((t: any) => t.results && t.results.length > 0 && t.results.some((r: any) => r.value !== undefined && r.value !== ''));
      const status = allDone ? 'COMPLETED' : 'IN_ANALYSIS';

      db.prepare(`
        UPDATE lab_orders SET
          tests = ?,
          pathologistRemarks = COALESCE(?, pathologistRemarks),
          status = ?,
          completedAt = CASE WHEN ? = 'COMPLETED' THEN ? ELSE completedAt END,
          updatedAt = ?
        WHERE id = ?
      `).run(
        testsJson,
        pathologistRemarks || null,
        status,
        status,
        now,
        now,
        id
      );

      return { success: true, status };
    } catch (e) {
      console.error('[Database] saveLabOrderResults error:', e);
      throw e;
    }
  },

  deleteLabOrder: (id: string) => {
    try {
      db.prepare('DELETE FROM lab_orders WHERE id = ?').run(id);
      return { success: true };
    } catch (e) {
      console.error('[Database] deleteLabOrder error:', e);
      throw e;
    }
  },

  getLabDashboardMetrics: () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const ordersToday = db.prepare('SELECT COUNT(*) as cnt FROM lab_orders WHERE orderDate LIKE ?').get(`${today}%`) as any;
      const samplesPending = db.prepare("SELECT COUNT(*) as cnt FROM lab_orders WHERE status = 'ORDERED'").get() as any;
      const inAnalysis = db.prepare("SELECT COUNT(*) as cnt FROM lab_orders WHERE status IN ('SAMPLE_COLLECTED', 'IN_ANALYSIS')").get() as any;
      const completedToday = db.prepare("SELECT COUNT(*) as cnt FROM lab_orders WHERE status = 'COMPLETED' AND completedAt LIKE ?").get(`${today}%`) as any;

      return {
        ordersTodayCount: ordersToday?.cnt || 0,
        samplesPendingCount: samplesPending?.cnt || 0,
        inAnalysisCount: inAnalysis?.cnt || 0,
        completedTodayCount: completedToday?.cnt || 0
      };
    } catch (e) {
      console.error('[Database] getLabDashboardMetrics error:', e);
      return {
        ordersTodayCount: 0,
        samplesPendingCount: 0,
        inAnalysisCount: 0,
        completedTodayCount: 0
      };
    }
  }
};
